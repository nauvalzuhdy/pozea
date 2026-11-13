// Geometry on flattened landmarks: [x, y, visibility] per point, in isotropic pixel units
// (x and y share one scale, so angles and distances are real). Pure TypeScript.

import { Landmark, LANDMARK_COUNT, MIN_VISIBILITY } from './landmarks.ts';

export interface Point {
  x: number;
  y: number;
}

export function pointAt(landmarks: readonly number[], index: number): Point {
  return { x: landmarks[index * 3], y: landmarks[index * 3 + 1] };
}

export function isVisible(landmarks: readonly number[], index: number): boolean {
  return landmarks.length >= LANDMARK_COUNT * 3 && landmarks[index * 3 + 2] >= MIN_VISIBILITY;
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Angle ABC at B in degrees, from 0 (folded) to 180 (straight). */
export function angleAt(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const len = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (len === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / len));
  return (Math.acos(cos) * 180) / Math.PI;
}

export interface NormalizedPose {
  /** Every landmark centered on the mid-hip and divided by the torso length (y still points down). */
  points: Point[];
  visibility: number[];
  /** Torso length (mid-shoulder to mid-hip) in the input units. */
  torso: number;
}

/**
 * Centers the pose on the midpoint of the hips and scales it by the torso length, so the same pose
 * gives the same numbers at any distance from the camera. Null when hips or shoulders are not seen.
 */
export function normalizePose(landmarks: readonly number[]): NormalizedPose | null {
  const anchors = [Landmark.leftHip, Landmark.rightHip, Landmark.leftShoulder, Landmark.rightShoulder];
  if (!anchors.every((i) => isVisible(landmarks, i))) return null;
  const hip = midpoint(pointAt(landmarks, Landmark.leftHip), pointAt(landmarks, Landmark.rightHip));
  const shoulder = midpoint(
    pointAt(landmarks, Landmark.leftShoulder),
    pointAt(landmarks, Landmark.rightShoulder),
  );
  const torso = distance(hip, shoulder);
  if (torso < 1e-6) return null;
  const points: Point[] = [];
  const visibility: number[] = [];
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    const p = pointAt(landmarks, i);
    points.push({ x: (p.x - hip.x) / torso, y: (p.y - hip.y) / torso });
    visibility.push(landmarks[i * 3 + 2]);
  }
  return { points, visibility, torso };
}

/** Converts landmarks normalized to a W x H image (0...1) into isotropic pixel units. */
export function toPixels(landmarks: readonly number[], width: number, height: number): number[] {
  const out = landmarks.slice();
  for (let i = 0; i < out.length; i += 3) {
    out[i] *= width;
    out[i + 1] *= height;
  }
  return out;
}
