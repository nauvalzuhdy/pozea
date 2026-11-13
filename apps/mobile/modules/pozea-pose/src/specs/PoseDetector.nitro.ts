import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

/** Which on-device model runs the detection. Both return the same 33-point BlazePose topology. */
export type PoseEngine = 'mlkit' | 'mediapipe';

export interface PoseOptions {
  engine: PoseEngine;
  /** Also run ML Kit face detection (smile and head angles). */
  withFace: boolean;
  /** Also run MediaPipe person segmentation and return a small mask. */
  withMask: boolean;
}

export interface PoseResult {
  /**
   * 33 landmarks flattened as [x, y, visibility, x, y, visibility, ...], or empty when no person
   * is found. x and y are normalized (0...1) in the upright image, i.e. after rotating the frame
   * clockwise by `rotationDegrees`. visibility is 0...1.
   */
  landmarks: number[];
  /** Clockwise rotation that makes the raw frame buffer upright (0, 90, 180 or 270). */
  rotationDegrees: number;
  /** Time spent inside the model calls (and their input conversion), in milliseconds. */
  inferenceMs: number;
  /** Width / height of the upright image, so callers can work in isotropic units. */
  uprightAspect: number;
  /** Whether a face was found. The three values below are only meaningful when it was. */
  hasFace: boolean;
  /** ML Kit smiling probability 0...1, or -1 when it could not be computed. */
  smile: number;
  /** Head pitch in degrees; positive looks up. */
  pitch: number;
  /** Head yaw in degrees. */
  yaw: number;
  /** Person confidence per cell (0...1), row by row, in the upright image; empty unless withMask. */
  mask: number[];
  maskWidth: number;
  maskHeight: number;
}

export interface PoseDetector extends HybridObject<{ android: 'kotlin' }> {
  /** Runs synchronously on the calling (camera) thread. */
  detect(frame: Frame, options: PoseOptions): PoseResult;
}
