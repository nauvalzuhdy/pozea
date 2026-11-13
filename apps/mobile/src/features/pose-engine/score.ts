import type { Point } from './geometry.ts';
import { JOINT_IDS, type JointId, type PoseTemplate } from './template.ts';

/** Degrees past the tolerance at which a joint scores 0. */
export const ANGLE_FALLOFF = 45;

/** Face units past the tolerance at which the free hand scores 0. */
export const HAND_FALLOFF = 0.4;

/** Smiling probability below the minimum at which the smile scores 0. */
export const SMILE_FALLOFF = 0.3;

/** Weight of the smile in a selfie score. */
export const SMILE_WEIGHT = 1.5;

/** Similarity of one joint: 1 within tolerance, falling linearly to 0 over `falloff` degrees. */
export function jointSimilarity(angle: number, target: number, tolerance: number, falloff = ANGLE_FALLOFF): number {
  const over = Math.abs(angle - target) - tolerance;
  if (over <= 0) return 1;
  return Math.max(0, 1 - over / falloff);
}

/**
 * Share of the score taken by the worst joint. A plain weighted mean lets one completely wrong
 * joint pass: with ten equal joints and one at 0 the mean is still 0.9, above the match threshold.
 */
export const WORST_JOINT_SHARE = 0.4;

/** What selfie scoring reads besides joint angles. */
export interface SelfieReading {
  /** Wrist offsets from freeHandOffsets. */
  hands: { left?: Point; right?: Point };
  /** ML Kit smiling probability, or null when no face was found. */
  smile: number | null;
}

/**
 * Similarity of the pose to the template, from 0 to 1: the weighted mean of the joints blended with
 * the worst joint. A joint the camera cannot see counts as 0, so a half-visible body never matches.
 * Selfie templates also score the free hand (whichever hand is closer to the target) and the smile.
 */
export function scorePose(
  angles: Partial<Record<JointId, number>>,
  template: PoseTemplate,
  selfie?: SelfieReading,
): number {
  let sum = 0;
  let weights = 0;
  let worst = 1;
  const add = (weight: number, similarity: number) => {
    weights += weight;
    sum += weight * similarity;
    worst = Math.min(worst, similarity);
  };
  for (const id of JOINT_IDS) {
    const target = template.joints[id];
    if (!target) continue;
    const angle = angles[id];
    add(target.weight, angle === undefined ? 0 : jointSimilarity(angle, target.angle, target.tolerance, target.falloff));
  }
  if (template.framing === 'selfie') {
    const hand = template.freeHand;
    if (hand) {
      let best = 0;
      for (const p of [selfie?.hands.left, selfie?.hands.right]) {
        if (!p) continue;
        const over = Math.hypot(p.x - hand.x, p.y - hand.y) - hand.tolerance;
        best = Math.max(best, over <= 0 ? 1 : Math.max(0, 1 - over / HAND_FALLOFF));
      }
      add(hand.weight, best);
    }
    const smileMin = template.face?.smileMin ?? null;
    if (smileMin !== null) {
      const smile = selfie?.smile ?? null;
      add(SMILE_WEIGHT, smile === null ? 0 : smile >= smileMin ? 1 : Math.max(0, 1 - (smileMin - smile) / SMILE_FALLOFF));
    }
  }
  if (weights === 0) return 0;
  return (1 - WORST_JOINT_SHARE) * (sum / weights) + WORST_JOINT_SHARE * worst;
}
