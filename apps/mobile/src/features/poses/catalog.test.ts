// Selfie poses against real selfie photos of people who were not used to build the templates
// (selfie-photos.fixture.json: MediaPipe heavy landmarks, pixels). The camera feeds the engine the
// same way: landmarks scaled to a 1000-px-high upright frame.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { detectCues, type CueCode } from '../pose-engine/cues.ts';
import { scorePose } from '../pose-engine/score.ts';
import { freeHandOffsets, jointAngles, type MatchSettings, type PoseTemplate } from '../pose-engine/template.ts';

interface CatalogPose {
  slug: string;
  category: string;
  template: PoseTemplate;
  match: MatchSettings;
}

const read = (name: string) => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const poses: CatalogPose[] = read('./catalog.json').poses;
const photos: Record<string, { width: number; height: number; landmarks: number[] }> = read(
  '../pose-engine/selfie-photos.fixture.json',
);
const selfies = poses.filter((p) => p.category === 'selfie');
const pose = (slug: string) => poses.find((p) => p.slug === slug)!;

// Left/right landmark pairs in the BlazePose topology.
const PAIRS = [
  [1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20],
  [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
];

/** The same person doing the pose with the other hand: flip the image and swap the sides. */
function mirrored(photo: { width: number; landmarks: number[] }): number[] {
  const flipped = photo.landmarks.map((v, i) => (i % 3 === 0 ? photo.width - v : v));
  const out = flipped.slice();
  for (const [a, b] of PAIRS) {
    for (let k = 0; k < 3; k++) {
      out[a * 3 + k] = flipped[b * 3 + k];
      out[b * 3 + k] = flipped[a * 3 + k];
    }
  }
  return out;
}

function evaluate(slug: string, photo: string, { smile = 0.9, mirror = false } = {}) {
  const p = photos[photo];
  const raw = mirror ? mirrored(p) : p.landmarks;
  const px = raw.map((v, i) => (i % 3 === 2 ? v : (v * 1000) / p.height));
  const angles = jointAngles(px);
  const { template, match } = pose(slug);
  const score = scorePose(angles, template, { hands: freeHandOffsets(px), smile });
  const cues = detectCues(
    { landmarks: px, frameWidth: (p.width * 1000) / p.height, frameHeight: 1000, face: { smile, pitch: 0, yaw: 0 }, angles },
    template,
    match,
  );
  return { score, matched: score >= match.enter, cue: cues[0]?.code as CueCode | undefined };
}

test('there are six selfie poses, all in selfie framing', () => {
  assert.deepEqual(
    selfies.map((p) => p.slug),
    ['selfie-smile', 'selfie-peace', 'selfie-chin', 'selfie-tilt', 'selfie-three-quarter', 'selfie-wave'],
  );
  for (const p of selfies) assert.equal(p.template.framing, 'selfie');
});

test('every selfie photo matches its own pose, with either hand', () => {
  for (const p of selfies) {
    for (const mirror of [false, true]) {
      const r = evaluate(p.slug, p.slug, { mirror });
      assert.ok(r.matched, `${p.slug}${mirror ? ' mirrored' : ''}: score ${r.score.toFixed(2)}`);
    }
  }
});

test('a photo does not match a pose that asks for something else', () => {
  // "Senyum klasik" asks for no hand position, so any frontal smiling selfie matches it; peace and
  // wave differ only in how far the hand is from the face (finger shape is not detected).
  const allowed = new Set(['selfie-peace>selfie-wave']);
  for (const photo of selfies) {
    for (const p of selfies) {
      if (p.slug === photo.slug || p.slug === 'selfie-smile' || allowed.has(`${photo.slug}>${p.slug}`)) continue;
      const r = evaluate(p.slug, photo.slug);
      assert.ok(!r.matched, `${photo.slug} photo on ${p.slug}: score ${r.score.toFixed(2)}`);
    }
  }
});

test('a selfie that needs a smile does not match without one, and asks for it', () => {
  for (const slug of ['selfie-smile', 'selfie-peace', 'selfie-tilt', 'selfie-wave']) {
    const r = evaluate(slug, slug, { smile: 0.1 });
    assert.ok(!r.matched, `${slug}: score ${r.score.toFixed(2)}`);
    assert.equal(r.cue, 'SMILE', slug);
  }
});

test('the top cue names what differs from the pose', () => {
  assert.equal(evaluate('selfie-peace', 'selfie-smile').cue, 'RAISE_HAND');
  assert.equal(evaluate('selfie-tilt', 'selfie-smile').cue, 'TILT_HEAD');
  assert.equal(evaluate('selfie-three-quarter', 'selfie-smile').cue, 'TURN_HEAD');
  assert.equal(evaluate('selfie-smile', 'selfie-tilt').cue, 'LEVEL_HEAD');
  assert.equal(evaluate('selfie-smile', 'selfie-three-quarter').cue, 'FACE_CAMERA');
  assert.equal(evaluate('selfie-wave', 'selfie-chin').cue, 'HAND_WIDER');
  assert.equal(evaluate('selfie-chin', 'selfie-peace', { mirror: true }).cue, 'HAND_CLOSER');
});
