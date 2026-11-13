import { JOINT_IDS, type JointId, type PoseTemplate } from './template.ts';

/** Degrees past the tolerance at which a joint scores 0. */
export const ANGLE_FALLOFF = 45;

/** Similarity of one joint: 1 within tolerance, falling linearly to 0 over ANGLE_FALLOFF degrees. */
export function jointSimilarity(angle: number, target: number, tolerance: number): number {
  const over = Math.abs(angle - target) - tolerance;
  if (over <= 0) return 1;
  return Math.max(0, 1 - over / ANGLE_FALLOFF);
}

/**
 * Share of the score taken by the worst joint. A plain weighted mean lets one completely wrong
 * joint pass: with ten equal joints and one at 0 the mean is still 0.9, above the match threshold.
 */
export const WORST_JOINT_SHARE = 0.4;

/**
 * Similarity of the pose to the template, from 0 to 1: the weighted mean of the joints blended with
 * the worst joint. A joint the camera cannot see counts as 0, so a half-visible body never matches.
 */
export function scorePose(
  angles: Partial<Record<JointId, number>>,
  template: PoseTemplate,
): number {
  let sum = 0;
  let weights = 0;
  let worst = 1;
  for (const id of JOINT_IDS) {
    const target = template.joints[id];
    if (!target) continue;
    weights += target.weight;
    const angle = angles[id];
    const similarity = angle === undefined ? 0 : jointSimilarity(angle, target.angle, target.tolerance);
    sum += target.weight * similarity;
    worst = Math.min(worst, similarity);
  }
  if (weights === 0) return 0;
  return (1 - WORST_JOINT_SHARE) * (sum / weights) + WORST_JOINT_SHARE * worst;
}
