import type { HybridObject } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'

/** Which on-device model runs the detection. Both return the same 33-point BlazePose topology. */
export type PoseEngine = 'mlkit' | 'mediapipe'

export interface PoseResult {
  /**
   * 33 landmarks flattened as [x, y, visibility, x, y, visibility, ...], or empty when no person
   * is found. x and y are normalized (0...1) in the upright image, i.e. after rotating the frame
   * clockwise by `rotationDegrees`. visibility is 0...1.
   */
  landmarks: number[]
  /** Clockwise rotation that makes the raw frame buffer upright (0, 90, 180 or 270). */
  rotationDegrees: number
  /** Time spent inside the model call (and its input conversion), in milliseconds. */
  inferenceMs: number
}

export interface PoseDetector extends HybridObject<{ android: 'kotlin' }> {
  /** Runs synchronously on the calling (camera) thread. */
  detect(frame: Frame, engine: PoseEngine): PoseResult
}
