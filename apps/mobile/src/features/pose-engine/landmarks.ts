// BlazePose topology shared by ML Kit and MediaPipe: 33 landmarks, same index order.
// Pure TypeScript with no React or camera imports, so it runs in worklets and in unit tests.

export const LANDMARK_COUNT = 33;

export const Landmark = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

/** Body lines drawn as the skeleton (face points are drawn as dots only). */
export const BONES: readonly (readonly [number, number])[] = [
  [Landmark.leftShoulder, Landmark.rightShoulder],
  [Landmark.leftShoulder, Landmark.leftElbow],
  [Landmark.leftElbow, Landmark.leftWrist],
  [Landmark.rightShoulder, Landmark.rightElbow],
  [Landmark.rightElbow, Landmark.rightWrist],
  [Landmark.leftShoulder, Landmark.leftHip],
  [Landmark.rightShoulder, Landmark.rightHip],
  [Landmark.leftHip, Landmark.rightHip],
  [Landmark.leftHip, Landmark.leftKnee],
  [Landmark.leftKnee, Landmark.leftAnkle],
  [Landmark.rightHip, Landmark.rightKnee],
  [Landmark.rightKnee, Landmark.rightAnkle],
  [Landmark.leftAnkle, Landmark.leftHeel],
  [Landmark.leftHeel, Landmark.leftFootIndex],
  [Landmark.rightAnkle, Landmark.rightHeel],
  [Landmark.rightHeel, Landmark.rightFootIndex],
];

/** Landmarks below this visibility are treated as not seen. */
export const MIN_VISIBILITY = 0.5;

/**
 * Maps a point normalized to the upright image back to pixel coordinates in the raw frame buffer.
 *
 * The detector sees the frame rotated clockwise by `rotationDegrees` (the CameraX rotation), so this
 * applies the inverse rotation. Drawing on a SkiaCamera canvas happens in raw frame coordinates.
 */
export function uprightToFrame(
  u: number,
  v: number,
  rotationDegrees: number,
  frameWidth: number,
  frameHeight: number,
): { x: number; y: number } {
  'worklet';
  let nx: number;
  let ny: number;
  switch (rotationDegrees) {
    case 90:
      nx = v;
      ny = 1 - u;
      break;
    case 180:
      nx = 1 - u;
      ny = 1 - v;
      break;
    case 270:
      nx = 1 - v;
      ny = u;
      break;
    default:
      nx = u;
      ny = v;
  }
  return { x: nx * frameWidth, y: ny * frameHeight };
}

/** Number of landmarks at or above MIN_VISIBILITY in a flattened [x, y, visibility, ...] array. */
export function countVisible(landmarks: readonly number[]): number {
  'worklet';
  let n = 0;
  for (let i = 2; i < landmarks.length; i += 3) if (landmarks[i] >= MIN_VISIBILITY) n++;
  return n;
}
