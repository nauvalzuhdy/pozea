package com.margelo.nitro.pozea.pose

import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.PixelFormat
import android.os.SystemClock
import androidx.annotation.Keep
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageProxy
import com.facebook.proguard.annotations.DoNotStrip
import com.google.android.gms.tasks.Tasks
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import com.margelo.nitro.NitroModules
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import java.nio.ByteBuffer
import java.nio.ByteOrder

private const val LANDMARK_COUNT = 33
private const val MEDIAPIPE_MODEL = "pose_landmarker_lite.task"

/**
 * Runs pose detection on a VisionCamera Frame with either ML Kit or MediaPipe.
 *
 * Both engines receive the frame rotated upright (by the CameraX rotation), and both return the
 * same 33-point BlazePose landmarks normalized to that upright image, so the app can compare them
 * and the pose engine never sees engine-specific data.
 */
@DoNotStrip
@Keep
class HybridPoseDetector : HybridPoseDetectorSpec() {
  private var mlKit: com.google.mlkit.vision.pose.PoseDetector? = null
  private var mediaPipe: PoseLandmarker? = null
  private var lastMediaPipeTimestampMs = 0L

  override fun detect(frame: HybridFrameSpec, engine: PoseEngine): PoseResult {
    val nativeFrame = frame as? NativeFrame ?: throw Error("Frame is not a VisionCamera NativeFrame!")
    val image = nativeFrame.image
    val rotation = image.imageInfo.rotationDegrees
    val start = SystemClock.elapsedRealtimeNanos()
    val landmarks =
      when (engine) {
        PoseEngine.MLKIT -> detectWithMlKit(image, rotation)
        PoseEngine.MEDIAPIPE -> detectWithMediaPipe(image, rotation)
      }
    val inferenceMs = (SystemClock.elapsedRealtimeNanos() - start) / 1_000_000.0
    return PoseResult(landmarks, rotation.toDouble(), inferenceMs)
  }

  @OptIn(ExperimentalGetImage::class)
  private fun detectWithMlKit(image: ImageProxy, rotation: Int): DoubleArray {
    val detector =
      mlKit ?: PoseDetection
        .getClient(
          PoseDetectorOptions.Builder().setDetectorMode(PoseDetectorOptions.STREAM_MODE).build(),
        ).also { mlKit = it }

    val input =
      if (image.format == PixelFormat.RGBA_8888) {
        InputImage.fromBitmap(image.toBitmap(), rotation)
      } else {
        val mediaImage = image.image ?: throw Error("Frame has no underlying android.media.Image!")
        InputImage.fromMediaImage(mediaImage, rotation)
      }
    // Blocking is fine: we are on VisionCamera's frame thread, never the main thread.
    val pose = Tasks.await(detector.process(input))
    val points = pose.allPoseLandmarks
    if (points.isEmpty()) return DoubleArray(0)

    // ML Kit returns pixel coordinates in the upright (rotated) image.
    val sideways = rotation == 90 || rotation == 270
    val uprightWidth = (if (sideways) image.height else image.width).toDouble()
    val uprightHeight = (if (sideways) image.width else image.height).toDouble()
    val out = DoubleArray(LANDMARK_COUNT * 3)
    for (landmark in points) {
      val i = landmark.landmarkType
      if (i !in 0 until LANDMARK_COUNT) continue
      out[i * 3] = landmark.position.x / uprightWidth
      out[i * 3 + 1] = landmark.position.y / uprightHeight
      out[i * 3 + 2] = landmark.inFrameLikelihood.toDouble()
    }
    return out
  }

  private fun detectWithMediaPipe(image: ImageProxy, rotation: Int): DoubleArray {
    val landmarker = mediaPipe ?: createMediaPipe().also { mediaPipe = it }

    val raw = image.toBitmap()
    val upright =
      if (rotation == 0) {
        raw
      } else {
        val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
        Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, false)
      }
    // VIDEO mode requires strictly increasing timestamps.
    var timestampMs = SystemClock.uptimeMillis()
    if (timestampMs <= lastMediaPipeTimestampMs) timestampMs = lastMediaPipeTimestampMs + 1
    lastMediaPipeTimestampMs = timestampMs

    val result =
      try {
        landmarker.detectForVideo(BitmapImageBuilder(upright).build(), timestampMs)
      } finally {
        if (upright !== raw) upright.recycle()
        raw.recycle()
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

  private fun createMediaPipe(): PoseLandmarker {
    val context = NitroModules.applicationContext ?: throw Error("React context is not ready yet!")
    // Load the model into memory ourselves, so it works whether or not the asset is compressed in the APK.
    val bytes = context.assets.open(MEDIAPIPE_MODEL).use { it.readBytes() }
    val model = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).put(bytes)
    model.rewind()
    val baseOptions =
      BaseOptions
        .builder()
        .setModelAssetBuffer(model)
        // CPU is the most predictable across Android phones; GPU can be tried after the spike.
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

  override fun dispose() {
    super.dispose()
    mlKit?.close()
    mlKit = null
    mediaPipe?.close()
    mediaPipe = null
  }
}
