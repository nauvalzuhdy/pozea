// Builds src/features/poses/catalog.json from detected landmarks and poses.config.json.
// Usage: node scripts/pose-templates/build-templates.ts scripts/pose-templates/landmarks.json
// It uses the app's own templateFromLandmarks, so templates and live scoring measure the same way.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LANDMARK_COUNT } from '../../src/features/pose-engine/landmarks.ts';
import {
  DEFAULT_MATCH,
  templateFromLandmarks,
  type FaceTarget,
  type Framing,
  type JointId,
  type JointTarget,
  type MatchSettings,
} from '../../src/features/pose-engine/template.ts';

type Cues = Record<string, { title: string; detail: string }>;

interface PoseConfig {
  slug: string;
  title: string;
  category: string;
  description: string;
  framing: Framing;
  swapSides?: boolean;
  keep: JointId[];
  weights: Partial<Record<JointId, number>>;
  override: Partial<Record<JointId, Partial<JointTarget>>>;
  /** Body framing: hands to guide. */
  hands?: ('left' | 'right')[];
  /** Selfie framing: the free hand in the example photo. */
  freeHand?: { side: 'left' | 'right'; tolerance: number; weight: number };
  face: FaceTarget | null;
  match?: Partial<MatchSettings>;
  cues: Cues;
}

interface Config {
  defaults: { tolerance: number };
  /** Settings and copy every pose of a framing starts from. */
  framings: Record<Framing, { match: Partial<MatchSettings>; cues: Cues }>;
  poses: PoseConfig[];
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
const config = JSON.parse(readFileSync(join(here, 'poses.config.json'), 'utf8')) as Config;
const detected = JSON.parse(readFileSync(process.argv[2], 'utf8'));

const poses = config.poses.map((pose) => {
  const found = detected[pose.slug];
  if (!found || found.landmarks.length !== LANDMARK_COUNT * 3) throw new Error(`No landmarks for ${pose.slug}`);
  // Mannequin renders get low visibility scores although the positions are usable; which joints
  // to trust is decided by `keep` instead. Selfie examples are real photos: their visibility
  // tells which points are out of the frame, so it is kept.
  let landmarks: number[] =
    pose.framing === 'body' ? found.landmarks.map((v: number, i: number) => (i % 3 === 2 ? 1 : v)) : found.landmarks;
  if (pose.swapSides) landmarks = swapSides(landmarks);

  const built = templateFromLandmarks(landmarks, {
    tolerance: config.defaults.tolerance,
    weights: pose.weights,
    face: pose.face,
    framing: pose.framing,
    freeHand: pose.freeHand,
  });
  const joints: Partial<Record<JointId, JointTarget>> = {};
  for (const id of pose.keep) {
    const base = built.joints[id];
    const override = pose.override[id];
    if (!base && override?.angle === undefined) throw new Error(`${pose.slug}: no angle for ${id}`);
    joints[id] = {
      angle: override?.angle ?? base!.angle,
      tolerance: override?.tolerance ?? base?.tolerance ?? config.defaults.tolerance,
      weight: pose.weights[id] ?? 1,
      ...(override?.falloff !== undefined ? { falloff: override.falloff } : {}),
    };
  }
  if (pose.freeHand && !built.freeHand) throw new Error(`${pose.slug}: free hand not visible`);
  const hands = Object.fromEntries((pose.hands ?? []).map((side) => [side, built.hands[side]]));
  const framing = config.framings[pose.framing];
  return {
    slug: pose.slug,
    title: pose.title,
    category: pose.category,
    description: pose.description,
    template: {
      framing: pose.framing,
      joints,
      hands,
      ...(built.freeHand ? { freeHand: built.freeHand } : {}),
      face: pose.face,
    },
    cues: { ...framing.cues, ...pose.cues },
    match: { ...DEFAULT_MATCH, ...framing.match, ...pose.match },
  };
});

const target = join(here, '../../src/features/poses/catalog.json');
writeFileSync(target, JSON.stringify({ schemaVersion: 2, poses }, null, 2) + '\n');
console.log(`Wrote ${poses.length} poses to ${target}`);
