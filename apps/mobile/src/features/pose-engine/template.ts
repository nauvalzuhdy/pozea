// Pose templates: target joint angles and hand positions, plus the thresholds used to match them.
// Templates are built from an example photo by templateFromLandmarks (see scripts/pose-templates).

import { angleAt, faceFrame, isVisible, midpoint, normalizePose, pointAt, type Point } from './geometry.ts';
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

/**
 * Face measures for selfies, in degrees and unsigned, so tilting or turning to either side counts:
 * - headTilt: how far the eye line slants from horizontal.
 * - faceTurn: how far the face turns away from the camera, from the nose's offset along the ear line.
 */
export const FACE_MEASURES = ['headTilt', 'faceTurn'] as const;

export type JointId =
  | keyof typeof JOINTS
  | (typeof BODY_MEASURES)[number]
  | (typeof FACE_MEASURES)[number];
export const JOINT_IDS = [
  ...(Object.keys(JOINTS) as (keyof typeof JOINTS)[]),
  ...BODY_MEASURES,
  ...FACE_MEASURES,
] as JointId[];

/**
 * - body: the whole body is in view; landmarks are normalized by the torso.
 * - selfie: face and shoulders only, one hand holding the phone; the face is the reference.
 */
export type Framing = 'body' | 'selfie';

export interface JointTarget {
  /** Degrees, 0...180. */
  angle: number;
  /** Degrees of difference that still count as a full match. */
  tolerance: number;
  weight: number;
  /** Degrees past the tolerance at which the joint scores 0. Defaults to ANGLE_FALLOFF (score.ts). */
  falloff?: number;
}

/** Wrist position relative to the mid-hip, in torso lengths (y points down). */
export interface HandTarget {
  x: number;
  y: number;
}

/**
 * Selfie target for whichever hand is free (the other one holds the phone), in face units: x is the
 * distance outward from the face toward that hand's own side, y is down from the mid-ear point,
 * both divided by the ear-to-ear distance.
 */
export interface FreeHandTarget {
  x: number;
  y: number;
  /** Distance from the target, in face units, that still counts as a full match. */
  tolerance: number;
  weight: number;
}

export interface FaceTarget {
  /**
   * Minimum ML Kit smiling probability, or null when the pose does not ask for a smile. Selfie
   * poses also score it, so a selfie never matches without the smile it asks for.
   */
  smileMin: number | null;
  /** Head pitch and yaw in degrees (ML Kit Euler X and Y). */
  pitch: number;
  yaw: number;
}

export interface PoseTemplate {
  framing: Framing;
  joints: Partial<Record<JointId, JointTarget>>;
  hands: { left?: HandTarget; right?: HandTarget };
  /** Selfie framing only. */
  freeHand?: FreeHandTarget;
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
  /**
   * Fewer visible landmarks than this asks the user to show the whole body. Selfie framing counts
   * only the 11 face landmarks (0...10).
   */
  minVisible: number;
  /** Body height as a share of the frame height (body framing). */
  minBodyHeight: number;
  maxBodyHeight: number;
  /** Ear-to-ear distance as a share of the frame width (selfie framing). */
  minFaceWidth: number;
  maxFaceWidth: number;
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
  minFaceWidth: 0.15,
  maxFaceWidth: 0.6,
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
  if (seen(Landmark.leftEye, Landmark.rightEye)) {
    const l = pointAt(landmarks, Landmark.leftEye);
    const r = pointAt(landmarks, Landmark.rightEye);
    out.headTilt = (Math.atan2(Math.abs(l.y - r.y), Math.abs(l.x - r.x)) * 180) / Math.PI;
  }
  const face = faceFrame(landmarks);
  if (face && seen(Landmark.nose)) {
    const l = pointAt(landmarks, Landmark.leftEar);
    const r = pointAt(landmarks, Landmark.rightEar);
    const nose = pointAt(landmarks, Landmark.nose);
    // Nose offset from the mid-ear point along the ear line, as a share of the ear distance; a
    // frontal face reads ~0, a three-quarter view ~0.25.
    const along =
      ((nose.x - face.center.x) * (l.x - r.x) + (nose.y - face.center.y) * (l.y - r.y)) / (face.scale * face.scale);
    out.faceTurn = (Math.atan(2 * Math.abs(along)) * 180) / Math.PI;
  }
  return out;
}

/**
 * Wrist positions in the face units of FreeHandTarget: x outward toward each hand's own side
 * (the user's left is the image's right, as the detector sees an unmirrored image), y down.
 */
export function freeHandOffsets(landmarks: readonly number[]): { left?: Point; right?: Point } {
  const face = faceFrame(landmarks);
  const out: { left?: Point; right?: Point } = {};
  if (!face) return out;
  if (isVisible(landmarks, Landmark.leftWrist)) {
    const p = pointAt(landmarks, Landmark.leftWrist);
    out.left = { x: (p.x - face.center.x) / face.scale, y: (p.y - face.center.y) / face.scale };
  }
  if (isVisible(landmarks, Landmark.rightWrist)) {
    const p = pointAt(landmarks, Landmark.rightWrist);
    out.right = { x: (face.center.x - p.x) / face.scale, y: (p.y - face.center.y) / face.scale };
  }
  return out;
}

export interface TemplateOptions {
  tolerance: number;
  weights?: Partial<Record<JointId, number>>;
  face: FaceTarget | null;
  framing?: Framing;
  /** Selfie framing: the hand that is free in the example photo, and how its position is scored. */
  freeHand?: { side: 'left' | 'right'; tolerance: number; weight: number };
}

/** Builds a template from landmarks detected on an example photo (isotropic pixel units). */
export function templateFromLandmarks(
  landmarks: readonly number[],
  { tolerance, weights = {}, face, framing = 'body', freeHand }: TemplateOptions,
): PoseTemplate {
  const angles = jointAngles(landmarks);
  const joints: PoseTemplate['joints'] = {};
  // Selfies keep only the face measures: arms leave the frame and one of them holds the phone.
  const ids = framing === 'selfie' ? FACE_MEASURES : JOINT_IDS.filter((id) => !FACE_MEASURES.includes(id as never));
  for (const id of ids) {
    const angle = angles[id];
    if (angle === undefined) continue;
    joints[id] = { angle: Math.round(angle), tolerance, weight: weights[id] ?? 1 };
  }
  const hands: PoseTemplate['hands'] = {};
  const round = (v: number) => Math.round(v * 100) / 100;
  if (framing === 'selfie') {
    const offset = freeHand ? freeHandOffsets(landmarks)[freeHand.side] : undefined;
    const target = offset && freeHand
      ? { x: round(offset.x), y: round(offset.y), tolerance: freeHand.tolerance, weight: freeHand.weight }
      : undefined;
    return { framing, joints, hands, ...(target ? { freeHand: target } : {}), face };
  }
  const pose = normalizePose(landmarks);
  if (pose) {
    if (isVisible(landmarks, Landmark.leftWrist)) {
      const p = pose.points[Landmark.leftWrist];
      hands.left = { x: round(p.x), y: round(p.y) };
    }
    if (isVisible(landmarks, Landmark.rightWrist)) {
      const p = pose.points[Landmark.rightWrist];
      hands.right = { x: round(p.x), y: round(p.y) };
    }
  }
  return { framing, joints, hands, face };
}
