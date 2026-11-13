// Builds src/features/poses/catalog.json from detected landmarks and poses.config.json.
// Usage: node scripts/pose-templates/build-templates.ts landmarks.json
// It uses the app's own templateFromLandmarks, so templates and live scoring measure the same way.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LANDMARK_COUNT } from '../../src/features/pose-engine/landmarks.ts';
import {
  DEFAULT_MATCH,
  templateFromLandmarks,
  type FaceTarget,
  type JointId,
  type JointTarget,
  type MatchSettings,
} from '../../src/features/pose-engine/template.ts';

interface PoseConfig {
  slug: string;
  title: string;
  swapSides: boolean;
  keep: JointId[];
  weights: Partial<Record<JointId, number>>;
  override: Partial<Record<JointId, Partial<JointTarget>>>;
  hands: ('left' | 'right')[];
  face: FaceTarget | null;
  match?: Partial<MatchSettings>;
  cues: Record<string, { title: string; detail: string }>;
}

// Left/right landmark pairs in the BlazePose topology (face, arms, hands, legs, feet).
const PAIRS = [
  [1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20],
  [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
];

function swapSides(landmarks: number[]): number[] {
  const out = landmarks.slice();
  for (const [a, b] of PAIRS) {
    for (let k = 0; k < 3; k++) {
      out[a * 3 + k] = landmarks[b * 3 + k];
      out[b * 3 + k] = landmarks[a * 3 + k];
    }
  }
  return out;
}

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, 'poses.config.json'), 'utf8'));
const detected = JSON.parse(readFileSync(process.argv[2], 'utf8'));

const poses = (config.poses as PoseConfig[]).map((pose) => {
  const found = detected[pose.slug];
  if (!found || found.landmarks.length !== LANDMARK_COUNT * 3) throw new Error(`No landmarks for ${pose.slug}`);
  // Mannequin renders get low visibility scores although the positions are usable; which joints
  // to trust is decided by `keep` instead.
  let landmarks: number[] = found.landmarks.map((v: number, i: number) => (i % 3 === 2 ? 1 : v));
  if (pose.swapSides) landmarks = swapSides(landmarks);

  const built = templateFromLandmarks(landmarks, {
    tolerance: config.defaults.tolerance,
    weights: pose.weights,
    face: pose.face,
  });
  const joints: Partial<Record<JointId, JointTarget>> = {};
  for (const id of pose.keep) {
    const base = built.joints[id];
    const override = pose.override[id];
    if (!base && !override?.angle) throw new Error(`${pose.slug}: no angle for ${id}`);
    joints[id] = {
      angle: override?.angle ?? base!.angle,
      tolerance: override?.tolerance ?? base?.tolerance ?? config.defaults.tolerance,
      weight: pose.weights[id] ?? 1,
    };
  }
  const hands = Object.fromEntries(pose.hands.map((side) => [side, built.hands[side]]));
  return {
    slug: pose.slug,
    title: pose.title,
    template: { joints, hands, face: pose.face },
    cues: pose.cues,
    match: { ...DEFAULT_MATCH, ...pose.match },
  };
});

const target = join(here, '../../src/features/poses/catalog.json');
writeFileSync(target, JSON.stringify({ schemaVersion: 1, poses }, null, 2) + '\n');
console.log(`Wrote ${poses.length} poses to ${target}`);
