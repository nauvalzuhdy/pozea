// Pose templates: target joint angles and hand positions, plus the thresholds used to match them.
// Templates are built from an example photo by templateFromLandmarks (see scripts/pose-templates).

import { angleAt, isVisible, midpoint, normalizePose, pointAt } from './geometry.ts';
import { Landmark } from './landmarks.ts';

/** Each joint is the angle at the middle landmark of three. */
export const JOINTS = {
  leftElbow: [Landmark.leftShoulder, Landmark.leftElbow, Landmark.leftWrist],
  rightElbow: [Landmark.rightShoulder, Landmark.rightElbow, Landmark.rightWrist],
  leftShoulder: [Landmark.leftHip, Landmark.leftShoulder, Landmark.leftElbow],
  rightShoulder: [Landmark.rightHip, Landmark.rightShoulder, Landmark.rightElbow],
  leftHip: [Landmark.leftShoulder, Landmark.leftHip, Landmark.leftKnee],
  rightHip: [Landmark.rightShoulder, Landmark.rightHip, Landmark.rightKnee],
  leftKnee: [Landmark.leftHip, Landmark.leftKnee, Landmark.leftAnkle],
  rightKnee: [Landmark.rightHip, Landmark.rightKnee, Landmark.rightAnkle],
} as const satisfies Record<string, readonly [number, number, number]>;

/**
 * Whole-body measures that joint angles miss, in degrees:
 * - torsoLean: how far the mid-hip to mid-shoulder line tilts from straight up (leaning poses).
 * - legSpread: the angle between the thighs at the mid-hip (walking, wide stances).
 */
export const BODY_MEASURES = ['torsoLean', 'legSpread'] as const;

export type JointId = keyof typeof JOINTS | (typeof BODY_MEASURES)[number];
export const JOINT_IDS = [...(Object.keys(JOINTS) as (keyof typeof JOINTS)[]), ...BODY_MEASURES] as JointId[];

export interface JointTarget {
  /** Degrees, 0...180. */
  angle: number;
  /** Degrees of difference that still count as a full match. */
  tolerance: number;
  weight: number;
}

/** Wrist position relative to the mid-hip, in torso lengths (y points down). */
export interface HandTarget {
  x: number;
  y: number;
}

export interface FaceTarget {
  /** Minimum ML Kit smiling probability, or null when the pose does not ask for a smile. */
  smileMin: number | null;
  /** Head pitch and yaw in degrees (ML Kit Euler X and Y). */
  pitch: number;
  yaw: number;
}

export interface PoseTemplate {
  joints: Partial<Record<JointId, JointTarget>>;
  hands: { left?: HandTarget; right?: HandTarget };
  /** Null when the face is not visible in this pose, such as looking back over the shoulder. */
  face: FaceTarget | null;
}

/** Per-pose thresholds. Stored with each pose in the catalog, never hard-coded in the camera. */
export interface MatchSettings {
  /** Smoothed score at which the pose counts as matched. */
  enter: number;
  /** Smoothed score below which a match ends and auto capture re-arms. */
  exit: number;
  /** How long the match must hold before the photo is taken, in milliseconds. */
  holdMs: number;
  /** Weight of the newest score in the moving average. */
  smoothing: number;
  /** Fewer visible landmarks than this asks the user to show the whole body. */
  minVisible: number;
  /** Body height as a share of the frame height. */
  minBodyHeight: number;
  maxBodyHeight: number;
  /** Wrist distance from the target, in torso lengths, before a hand cue shows. */
  handTolerance: number;
  /** Degrees. */
  pitchTolerance: number;
  yawTolerance: number;
}

export const DEFAULT_MATCH: MatchSettings = {
  enter: 0.85,
  exit: 0.75,
  holdMs: 600,
  smoothing: 0.3,
  minVisible: 25,
  minBodyHeight: 0.5,
  maxBodyHeight: 0.95,
  handTolerance: 0.35,
  pitchTolerance: 10,
  yawTolerance: 15,
};

/** Angles of every joint whose three landmarks are visible. */
export function jointAngles(landmarks: readonly number[]): Partial<Record<JointId, number>> {
  const out: Partial<Record<JointId, number>> = {};
  for (const id of Object.keys(JOINTS) as (keyof typeof JOINTS)[]) {
    const [a, b, c] = JOINTS[id];
    if (!isVisible(landmarks, a) || !isVisible(landmarks, b) || !isVisible(landmarks, c)) continue;
    out[id] = angleAt(pointAt(landmarks, a), pointAt(landmarks, b), pointAt(landmarks, c));
  }
  const seen = (...ids: number[]) => ids.every((i) => isVisible(landmarks, i));
  if (seen(Landmark.leftHip, Landmark.rightHip)) {
    const hip = midpoint(pointAt(landmarks, Landmark.leftHip), pointAt(landmarks, Landmark.rightHip));
    if (seen(Landmark.leftShoulder, Landmark.rightShoulder)) {
      const shoulder = midpoint(
        pointAt(landmarks, Landmark.leftShoulder),
        pointAt(landmarks, Landmark.rightShoulder),
      );
      out.torsoLean = angleAt(shoulder, hip, { x: hip.x, y: hip.y - 1 });
    }
    if (seen(Landmark.leftKnee, Landmark.rightKnee)) {
      out.legSpread = angleAt(
        pointAt(landmarks, Landmark.leftKnee),
        hip,
        pointAt(landmarks, Landmark.rightKnee),
      );
    }
  }
  return out;
}

export interface TemplateOptions {
  tolerance: number;
  weights?: Partial<Record<JointId, number>>;
  face: FaceTarget | null;
}

/** Builds a template from landmarks detected on an example photo (isotropic pixel units). */
export function templateFromLandmarks(
  landmarks: readonly number[],
  { tolerance, weights = {}, face }: TemplateOptions,
): PoseTemplate {
  const angles = jointAngles(landmarks);
  const joints: PoseTemplate['joints'] = {};
  for (const id of JOINT_IDS) {
    const angle = angles[id];
    if (angle === undefined) continue;
    joints[id] = { angle: Math.round(angle), tolerance, weight: weights[id] ?? 1 };
  }
  const hands: PoseTemplate['hands'] = {};
  const pose = normalizePose(landmarks);
  if (pose) {
    const round = (v: number) => Math.round(v * 100) / 100;
    if (isVisible(landmarks, Landmark.leftWrist)) {
      const p = pose.points[Landmark.leftWrist];
      hands.left = { x: round(p.x), y: round(p.y) };
    }
    if (isVisible(landmarks, Landmark.rightWrist)) {
      const p = pose.points[Landmark.rightWrist];
      hands.right = { x: round(p.x), y: round(p.y) };
    }
  }
  return { joints, hands, face };
}
