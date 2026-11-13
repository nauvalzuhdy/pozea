// Live instructions: every frame, find what differs most from the template and name it with a code.
// Sides are the user's own (anatomical) left and right: the detectors see an unmirrored image from
// both cameras, so "tangan kananmu" is right whether the user faces the front or the back camera.

import { faceFrame, isVisible, normalizePose, type Point } from './geometry.ts';
import { Landmark, LANDMARK_COUNT } from './landmarks.ts';
import { HAND_FALLOFF } from './score.ts';
import { freeHandOffsets, type JointId, type MatchSettings, type PoseTemplate } from './template.ts';

export const CUE_CODES = [
  'FULL_BODY',
  'STEP_BACK',
  'STEP_CLOSER',
  'RAISE_LEFT_HAND',
  'RAISE_RIGHT_HAND',
  'LOWER_LEFT_HAND',
  'LOWER_RIGHT_HAND',
  'STRAIGHTEN_ELBOW_LEFT',
  'STRAIGHTEN_ELBOW_RIGHT',
  'BEND_ELBOW_LEFT',
  'BEND_ELBOW_RIGHT',
  'BEND_KNEES',
  'STRAIGHTEN_KNEES',
  'SMILE',
  'CHIN_UP',
  'CHIN_DOWN',
  'FACE_CAMERA',
  'TURN_LEFT',
  'TURN_RIGHT',
  'FOLLOW_SILHOUETTE',
  // Selfie framing: whichever hand is free, and the head.
  'RAISE_HAND',
  'LOWER_HAND',
  'HAND_CLOSER',
  'HAND_WIDER',
  'TILT_HEAD',
  'LEVEL_HEAD',
  'TURN_HEAD',
  'MATCHED',
] as const;

export type CueCode = (typeof CUE_CODES)[number];

export interface CueCandidate {
  code: CueCode;
  /** Weight times how far past its tolerance the error is; the largest is shown. */
  priority: number;
}

export interface FaceReading {
  /** ML Kit smiling probability, 0...1. */
  smile: number;
  /** Degrees; positive pitch looks up. */
  pitch: number;
  yaw: number;
}

export interface Observation {
  /** 33 landmarks in isotropic pixel units of the upright frame. */
  landmarks: readonly number[];
  frameWidth: number;
  frameHeight: number;
  /** Null when no face was found recently. */
  face: FaceReading | null;
  angles: Partial<Record<JointId, number>>;
}

// Arms (elbows, wrists, fingers) are left out of body height, so a raised hand never reads as
// "too close".
const ARM_FIRST = Landmark.leftElbow;
const ARM_LAST = 22;

const BODY_WEIGHT = 2;
const DISTANCE_WEIGHT = 5;
const HAND_WEIGHT = 1.5;
const FACE_WEIGHT = 1;
const HEAD_WEIGHT = 2;
/** Selfie free hand; a hand just past its tolerance ranks below a missing smile. */
const FREE_HAND_WEIGHT = 1;
/** Face landmarks (nose, eyes, mouth); selfie framing counts these for minVisible. */
const FACE_LAST = 10;

/** All errors in the current frame, largest first. Empty when nothing is off. */
export function detectCues(
  obs: Observation,
  template: PoseTemplate,
  match: MatchSettings,
): CueCandidate[] {
  if (template.framing === 'selfie') return detectSelfieCues(obs, template, match);
  const out: CueCandidate[] = [];
  const { landmarks } = obs;

  let visible = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < LANDMARK_COUNT && landmarks.length >= LANDMARK_COUNT * 3; i++) {
    if (!isVisible(landmarks, i)) continue;
    visible++;
    if (i >= ARM_FIRST && i <= ARM_LAST) continue;
    minY = Math.min(minY, landmarks[i * 3 + 1]);
    maxY = Math.max(maxY, landmarks[i * 3 + 1]);
  }
  const pose = normalizePose(landmarks);
  if (visible < match.minVisible || pose === null) {
    return [{ code: 'FULL_BODY', priority: 100 }];
  }

  const bodyHeight = (maxY - minY) / obs.frameHeight;
  if (bodyHeight > match.maxBodyHeight) {
    out.push({ code: 'STEP_BACK', priority: DISTANCE_WEIGHT * (1 + (bodyHeight - match.maxBodyHeight) / 0.1) });
  } else if (bodyHeight < match.minBodyHeight) {
    out.push({ code: 'STEP_CLOSER', priority: DISTANCE_WEIGHT * (1 + (match.minBodyHeight - bodyHeight) / 0.1) });
  }

  for (const side of ['left', 'right'] as const) {
    const target = template.hands[side];
    const wristIndex = side === 'left' ? Landmark.leftWrist : Landmark.rightWrist;
    const shoulderIndex = side === 'left' ? Landmark.leftShoulder : Landmark.rightShoulder;
    if (!target || !isVisible(landmarks, wristIndex)) continue;
    const wrist = pose.points[wristIndex];
    const shoulder = pose.points[shoulderIndex];
    const raise: CueCode = side === 'left' ? 'RAISE_LEFT_HAND' : 'RAISE_RIGHT_HAND';
    const lower: CueCode = side === 'left' ? 'LOWER_LEFT_HAND' : 'LOWER_RIGHT_HAND';
    const dy = wrist.y - target.y; // positive: the wrist is lower than the target
    const tol = match.handTolerance;
    if (target.y < shoulder.y && wrist.y > shoulder.y) {
      out.push({ code: raise, priority: HAND_WEIGHT * (dy / tol) });
    } else if (dy > tol) {
      out.push({ code: raise, priority: HAND_WEIGHT * (dy / tol) });
    } else if (-dy > tol) {
      out.push({ code: lower, priority: HAND_WEIGHT * (-dy / tol) });
    }
  }

  for (const side of ['left', 'right'] as const) {
    const id: JointId = side === 'left' ? 'leftElbow' : 'rightElbow';
    const target = template.joints[id];
    const angle = obs.angles[id];
    if (!target || angle === undefined) continue;
    const diff = angle - target.angle;
    if (Math.abs(diff) <= target.tolerance) continue;
    const code: CueCode =
      diff < 0
        ? side === 'left'
          ? 'STRAIGHTEN_ELBOW_LEFT'
          : 'STRAIGHTEN_ELBOW_RIGHT'
        : side === 'left'
          ? 'BEND_ELBOW_LEFT'
          : 'BEND_ELBOW_RIGHT';
    out.push({ code, priority: BODY_WEIGHT * target.weight * (Math.abs(diff) / target.tolerance) });
  }

  // Knees together: "tekuk lututmu" reads better than one cue per leg.
  let worstKnee = 0;
  let worstKneePriority = 0;
  for (const id of ['leftKnee', 'rightKnee'] as const) {
    const target = template.joints[id];
    const angle = obs.angles[id];
    if (!target || angle === undefined) continue;
    const diff = angle - target.angle;
    if (Math.abs(diff) <= target.tolerance) continue;
    const priority = BODY_WEIGHT * target.weight * (Math.abs(diff) / target.tolerance);
    if (priority > worstKneePriority) {
      worstKneePriority = priority;
      worstKnee = diff;
    }
  }
  if (worstKneePriority > 0) {
    out.push({ code: worstKnee > 0 ? 'BEND_KNEES' : 'STRAIGHTEN_KNEES', priority: worstKneePriority });
  }

  // Shoulders and hips have no instruction of their own: point the user at the silhouette.
  let worstOther = 0;
  for (const id of ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'torsoLean', 'legSpread'] as const) {
    const target = template.joints[id];
    const angle = obs.angles[id];
    if (!target || angle === undefined) continue;
    const over = Math.abs(angle - target.angle) / target.tolerance;
    if (over > 1) worstOther = Math.max(worstOther, BODY_WEIGHT * target.weight * over);
  }
  if (worstOther > 0) out.push({ code: 'FOLLOW_SILHOUETTE', priority: worstOther * 0.8 });

  faceCues(obs, template, match, true, out);
  return out.sort((a, b) => b.priority - a.priority);
}

function faceCues(
  obs: Observation,
  template: PoseTemplate,
  match: MatchSettings,
  withYaw: boolean,
  out: CueCandidate[],
): void {
  if (!template.face) return;
  const { smileMin, pitch, yaw } = template.face;
  if (!obs.face) {
    // Selfies score the smile, so say what is missing even when ML Kit lost the face.
    if (template.framing === 'selfie' && smileMin !== null) out.push({ code: 'SMILE', priority: FACE_WEIGHT });
    return;
  }
  if (smileMin !== null && obs.face.smile < smileMin) {
    out.push({ code: 'SMILE', priority: FACE_WEIGHT * (1 + (smileMin - obs.face.smile) / 0.2) });
  }
  const dPitch = obs.face.pitch - pitch;
  if (Math.abs(dPitch) > match.pitchTolerance) {
    out.push({
      code: dPitch < 0 ? 'CHIN_UP' : 'CHIN_DOWN',
      priority: FACE_WEIGHT * (Math.abs(dPitch) / match.pitchTolerance),
    });
  }
  const dYaw = obs.face.yaw - yaw;
  if (withYaw && Math.abs(dYaw) > match.yawTolerance) {
    // The yaw sign of TURN_LEFT/RIGHT is not verified on a device yet; no current pose targets a
    // turned head, so only FACE_CAMERA shows today.
    const code: CueCode =
      Math.abs(yaw) < match.yawTolerance ? 'FACE_CAMERA' : dYaw > 0 ? 'TURN_RIGHT' : 'TURN_LEFT';
    out.push({ code, priority: FACE_WEIGHT * (Math.abs(dYaw) / match.yawTolerance) });
  }
}

/**
 * Selfie framing: the face is the reference, the free hand may be either one, and head tilt and
 * turn are unsigned, so mirrored versions of a pose count too.
 */
function detectSelfieCues(obs: Observation, template: PoseTemplate, match: MatchSettings): CueCandidate[] {
  const { landmarks } = obs;
  let visible = 0;
  for (let i = 0; i <= FACE_LAST; i++) if (isVisible(landmarks, i)) visible++;
  const face = faceFrame(landmarks);
  if (visible < match.minVisible || face === null) return [{ code: 'FULL_BODY', priority: 100 }];

  const out: CueCandidate[] = [];
  const width = face.scale / obs.frameWidth;
  if (width > match.maxFaceWidth) {
    out.push({ code: 'STEP_BACK', priority: DISTANCE_WEIGHT * (1 + (width - match.maxFaceWidth) / 0.1) });
  } else if (width < match.minFaceWidth) {
    out.push({ code: 'STEP_CLOSER', priority: DISTANCE_WEIGHT * (1 + (match.minFaceWidth - width) / 0.05) });
  }

  const hand = template.freeHand;
  if (hand) {
    const offsets = freeHandOffsets(landmarks);
    let best: Point | null = null;
    let bestDistance = Infinity;
    for (const p of [offsets.left, offsets.right]) {
      if (!p) continue;
      const d = Math.hypot(p.x - hand.x, p.y - hand.y);
      if (d < bestDistance) {
        best = p;
        bestDistance = d;
      }
    }
    if (best === null) {
      // Neither wrist is in view: the free hand is down, below the frame.
      out.push({ code: 'RAISE_HAND', priority: FREE_HAND_WEIGHT * hand.weight * 2 });
    } else if (bestDistance > hand.tolerance) {
      const dx = best.x - hand.x;
      const dy = best.y - hand.y;
      const code: CueCode =
        Math.abs(dy) >= Math.abs(dx) ? (dy > 0 ? 'RAISE_HAND' : 'LOWER_HAND') : dx > 0 ? 'HAND_CLOSER' : 'HAND_WIDER';
      const over = bestDistance - hand.tolerance;
      out.push({ code, priority: FREE_HAND_WEIGHT * hand.weight * (1 + over / HAND_FALLOFF) });
    }
  }

  const head: [JointId, CueCode, CueCode][] = [
    ['headTilt', 'TILT_HEAD', 'LEVEL_HEAD'],
    ['faceTurn', 'TURN_HEAD', 'FACE_CAMERA'],
  ];
  for (const [id, more, less] of head) {
    const target = template.joints[id];
    const angle = obs.angles[id];
    if (!target || angle === undefined) continue;
    const diff = angle - target.angle;
    if (Math.abs(diff) <= target.tolerance) continue;
    out.push({ code: diff < 0 ? more : less, priority: HEAD_WEIGHT * target.weight * (Math.abs(diff) / target.tolerance) });
  }

  faceCues(obs, template, match, false, out);
  return out.sort((a, b) => b.priority - a.priority);
}

export interface CueState {
  code: CueCode | null;
  /** When the shown cue last changed, in milliseconds. */
  since: number;
}

export const INITIAL_CUE: CueState = { code: null, since: 0 };

/** Minimum time a cue stays on screen, so the bubble does not flicker. */
export const CUE_MIN_INTERVAL_MS = 1500;

/**
 * Picks the cue to show. A new instruction replaces the old one at most every 1.5 s; MATCHED shows at
 * once because it is the answer the user is waiting for. Returns the same object when nothing changes.
 */
export function nextCue(
  state: CueState,
  candidates: readonly CueCandidate[],
  matched: boolean,
  now: number,
  minIntervalMs = CUE_MIN_INTERVAL_MS,
): CueState {
  const kept = state.code === 'MATCHED' ? 'FOLLOW_SILHOUETTE' : state.code;
  const desired: CueCode = matched ? 'MATCHED' : (candidates[0]?.code ?? kept ?? 'FULL_BODY');
  if (desired === state.code) return state;
  if (desired === 'MATCHED' || state.code === null || now - state.since >= minIntervalMs) {
    return { code: desired, since: now };
  }
  return state;
}
