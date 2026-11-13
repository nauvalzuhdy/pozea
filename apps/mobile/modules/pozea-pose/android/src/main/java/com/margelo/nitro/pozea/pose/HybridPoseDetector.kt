package com.margelo.nitro.pozea.pose

import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.PixelFormat
import android.os.SystemClock
import android.util.Log
import androidx.annotation.Keep
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageProxy
import com.facebook.proguard.annotations.DoNotStrip
import com.google.android.gms.tasks.Tasks
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.ByteBufferExtractor
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.imagesegmenter.ImageSegmenter
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import com.margelo.nitro.NitroModules
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import java.nio.ByteBuffer
import java.nio.ByteOrder

private const val TAG = "PozeaPose"
private const val LANDMARK_COUNT = 33
private const val POSE_MODEL = "pose_landmarker_lite.task"
private const val SEGMENTER_MODEL = "selfie_segmenter.tflite"

// Face and segmentation are slower than pose and change slowly, so each runs on every third
// frame (on different frames) and the face values are reused in between.
private const val SLOW_TASK_EVERY = 3L

// The segmenter input is scaled to this height; the mask is returned at half of it.
private const val SEGMENTER_INPUT_HEIGHT = 256f

/**
 * Runs pose detection on a VisionCamera Frame with either ML Kit or MediaPipe, plus optional ML Kit
 * face classification (smile, head angles) and MediaPipe person segmentation.
 *
 * Every model receives the frame rotated upright (by the CameraX rotation), and all results are
 * normalized to that upright image, so the app never sees engine-specific data.
 */
@DoNotStrip
@Keep
class HybridPoseDetector : HybridPoseDetectorSpec() {
  private var mlKit: com.google.mlkit.vision.pose.PoseDetector? = null
  private var mediaPipe: PoseLandmarker? = null
  private var faceDetector: com.google.mlkit.vision.face.FaceDetector? = null
  private var segmenter: ImageSegmenter? = null
  private var lastPoseTimestampMs = 0L
  private var lastSegmenterTimestampMs = 0L
  private var frameCount = 0L

  private var hasFace = false
  private var smile = -1.0
  private var pitch = 0.0
  private var yaw = 0.0

  override fun detect(frame: HybridFrameSpec, options: PoseOptions): PoseResult {
    val nativeFrame = frame as? NativeFrame ?: throw Error("Frame is not a VisionCamera NativeFrame!")
    val image = nativeFrame.image
    val rotation = image.imageInfo.rotationDegrees
    val sideways = rotation == 90 || rotation == 270
    val uprightWidth = if (sideways) image.height else image.width
    val uprightHeight = if (sideways) image.width else image.height
    frameCount++

    var raw: Bitmap? = null
    fun rawBitmap(): Bitmap = raw ?: image.toBitmap().also { raw = it }
    var mlInput: InputImage? = null
    fun mlKitInput(): InputImage = mlInput ?: createInputImage(image, rotation, ::rawBitmap).also { mlInput = it }

    val start = SystemClock.elapsedRealtimeNanos()
    try {
      val landmarks =
        when (options.engine) {
          PoseEngine.MLKIT -> detectWithMlKit(mlKitInput(), uprightWidth, uprightHeight)
          PoseEngine.MEDIAPIPE -> detectWithMediaPipe(rawBitmap(), rotation)
        }

      if (!options.withFace) {
        hasFace = false
      } else if (frameCount % SLOW_TASK_EVERY == 0L) {
        try {
          detectFace(mlKitInput())
        } catch (e: Exception) {
          Log.w(TAG, "Face detection failed", e)
          hasFace = false
        }
      }

      var mask = DoubleArray(0)
      var maskWidth = 0
      var maskHeight = 0
      if (options.withMask && landmarks.isNotEmpty() && frameCount % SLOW_TASK_EVERY == 1L) {
        try {
          val result = segment(rawBitmap(), rotation, uprightHeight)
          mask = result.first
          maskWidth = result.second
          maskHeight = result.third
        } catch (e: Exception) {
          Log.w(TAG, "Segmentation failed", e)
        }
      }

      val inferenceMs = (SystemClock.elapsedRealtimeNanos() - start) / 1_000_000.0
      return PoseResult(
        landmarks,
        rotation.toDouble(),
        inferenceMs,
        uprightWidth.toDouble() / uprightHeight.toDouble(),
        hasFace,
        smile,
        pitch,
        yaw,
        mask,
        maskWidth.toDouble(),
        maskHeight.toDouble(),
      )
    } finally {
      raw?.recycle()
    }
  }

  @OptIn(ExperimentalGetImage::class)
  private fun createInputImage(image: ImageProxy, rotation: Int, bitmap: () -> Bitmap): InputImage =
    if (image.format == PixelFormat.RGBA_8888) {
      InputImage.fromBitmap(bitmap(), rotation)
    } else {
      val mediaImage = image.image ?: throw Error("Frame has no underlying android.media.Image!")
      InputImage.fromMediaImage(mediaImage, rotation)
    }

  private fun detectWithMlKit(input: InputImage, uprightWidth: Int, uprightHeight: Int): DoubleArray {
    val detector =
      mlKit ?: PoseDetection
        .getClient(
          PoseDetectorOptions.Builder().setDetectorMode(PoseDetectorOptions.STREAM_MODE).build(),
        ).also { mlKit = it }

    // Blocking is fine: we are on VisionCamera's frame thread, never the main thread.
    val pose = Tasks.await(detector.process(input))
    val points = pose.allPoseLandmarks
    if (points.isEmpty()) return DoubleArray(0)

    // ML Kit returns pixel coordinates in the upright (rotated) image.
    val out = DoubleArray(LANDMARK_COUNT * 3)
    for (landmark in points) {
      val i = landmark.landmarkType
      if (i !in 0 until LANDMARK_COUNT) continue
      out[i * 3] = landmark.position.x / uprightWidth.toDouble()
      out[i * 3 + 1] = landmark.position.y / uprightHeight.toDouble()
      out[i * 3 + 2] = landmark.inFrameLikelihood.toDouble()
    }
    return out
  }

  private fun detectWithMediaPipe(raw: Bitmap, rotation: Int): DoubleArray {
    val landmarker = mediaPipe ?: createPoseLandmarker().also { mediaPipe = it }
    val upright =
      if (rotation == 0) {
        raw
      } else {
        val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
        Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, false)
      }
    lastPoseTimestampMs = nextTimestamp(lastPoseTimestampMs)
    val result =
      try {
        landmarker.detectForVideo(BitmapImageBuilder(upright).build(), lastPoseTimestampMs)
      } finally {
        if (upright !== raw) upright.recycle()
      }
    val person = result.landmarks().firstOrNull() ?: return DoubleArray(0)

    // MediaPipe already returns coordinates normalized to the upright image.
    val out = DoubleArray(LANDMARK_COUNT * 3)
    person.forEachIndexed { i, landmark ->
      if (i >= LANDMARK_COUNT) return@forEachIndexed
      out[i * 3] = landmark.x().toDouble()
      out[i * 3 + 1] = landmark.y().toDouble()
      out[i * 3 + 2] = landmark.visibility().orElse(1f).toDouble()
    }
    return out
  }

  private fun detectFace(input: InputImage) {
    val detector =
      faceDetector ?: FaceDetection
        .getClient(
          FaceDetectorOptions
            .Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
            .setMinFaceSize(0.05f)
            .build(),
        ).also { faceDetector = it }
    val faces = Tasks.await(detector.process(input))
    // The largest face is the person posing.
    val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
    if (face == null) {
      hasFace = false
      return
    }
    hasFace = true
    smile = face.smilingProbability?.toDouble() ?: -1.0
    pitch = face.headEulerAngleX.toDouble()
    yaw = face.headEulerAngleY.toDouble()
  }

  /** Returns the person mask at half the segmenter input size, row by row, with its width and height. */
  private fun segment(raw: Bitmap, rotation: Int, uprightHeight: Int): Triple<DoubleArray, Int, Int> {
    val model = segmenter ?: createSegmenter().also { segmenter = it }
    val scale = SEGMENTER_INPUT_HEIGHT / uprightHeight
    val matrix = Matrix().apply {
      postRotate(rotation.toFloat())
      postScale(scale, scale)
    }
    val small = Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, true)
    lastSegmenterTimestampMs = nextTimestamp(lastSegmenterTimestampMs)
    val result =
      try {
        model.segmentForVideo(BitmapImageBuilder(small).build(), lastSegmenterTimestampMs)
      } finally {
        small.recycle()
      }
    val masks = result.confidenceMasks().orElse(null) ?: return Triple(DoubleArray(0), 0, 0)
    // The selfie segmenter has one category (person); if a background mask comes first, use the last.
    val mask = masks.lastOrNull() ?: return Triple(DoubleArray(0), 0, 0)
    val width = mask.width
    val height = mask.height
    val values = ByteBufferExtractor.extract(mask).order(ByteOrder.nativeOrder()).asFloatBuffer()
    val outWidth = width / 2
    val outHeight = height / 2
    val out = DoubleArray(outWidth * outHeight)
    for (y in 0 until outHeight) {
      for (x in 0 until outWidth) {
        out[y * outWidth + x] = values.get((y * 2) * width + x * 2).toDouble()
      }
    }
    return Triple(out, outWidth, outHeight)
  }

  /** MediaPipe VIDEO mode requires strictly increasing timestamps. */
  private fun nextTimestamp(last: Long): Long {
    val now = SystemClock.uptimeMillis()
    return if (now <= last) last + 1 else now
  }

  private fun loadModel(name: String): ByteBuffer {
    val context = NitroModules.applicationContext ?: throw Error("React context is not ready yet!")
    // Load the model into memory ourselves, so it works whether or not the asset is compressed in the APK.
    val bytes = context.assets.open(name).use { it.readBytes() }
    val buffer = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).put(bytes)
    buffer.rewind()
    return buffer
  }

  private fun createPoseLandmarker(): PoseLandmarker {
    val context = NitroModules.applicationContext ?: throw Error("React context is not ready yet!")
    val baseOptions =
      BaseOptions
        .builder()
        .setModelAssetBuffer(loadModel(POSE_MODEL))
        // CPU is the most predictable across Android phones; GPU can be tried later.
        .setDelegate(Delegate.CPU)
        .build()
    val options =
      PoseLandmarker.PoseLandmarkerOptions
        .builder()
        .setBaseOptions(baseOptions)
        .setRunningMode(RunningMode.VIDEO)
        .setNumPoses(1)
        .setMinPoseDetectionConfidence(0.5f)
        .setMinPosePresenceConfidence(0.5f)
        .setMinTrackingConfidence(0.5f)
        .build()
    return PoseLandmarker.createFromOptions(context, options)
  }

  private fun createSegmenter(): ImageSegmenter {
    val context = NitroModules.applicationContext ?: throw Error("React context is not ready yet!")
    val baseOptions =
      BaseOptions
        .builder()
        .setModelAssetBuffer(loadModel(SEGMENTER_MODEL))
        .setDelegate(Delegate.CPU)
        .build()
    val options =
      ImageSegmenter.ImageSegmenterOptions
        .builder()
        .setBaseOptions(baseOptions)
        .setRunningMode(RunningMode.VIDEO)
        .setOutputConfidenceMasks(true)
        .setOutputCategoryMask(false)
        .build()
    return ImageSegmenter.createFromOptions(context, options)
  }

  override fun dispose() {
    super.dispose()
    mlKit?.close()
    mlKit = null
    mediaPipe?.close()
    mediaPipe = null
    faceDetector?.close()
    faceDetector = null
    segmenter?.close()
    segmenter = null
  }
}
