import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyAffine, affineFromPoints, mapPoints } from './affine.ts';
import { largestComponent, maskContour, traceBoundary } from './contour.ts';
import { detectCues, INITIAL_CUE, nextCue, type Observation } from './cues.ts';
import { normalizePose } from './geometry.ts';
import { Landmark, LANDMARK_COUNT } from './landmarks.ts';
import { INITIAL_MATCHER, stepMatcher, type MatcherState } from './matcher.ts';
import { jointSimilarity, scorePose } from './score.ts';
import { DEFAULT_MATCH, jointAngles, templateFromLandmarks, type PoseTemplate } from './template.ts';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

// A person standing with arms down, facing the camera, in a 720 x 1280 frame (pixels, y down).
// The person's left side is on the image's right.
function standing(): number[] {
  const p: [number, number][] = Array.from({ length: LANDMARK_COUNT }, () => [360, 200]);
  const set = (i: number, x: number, y: number) => (p[i] = [x, y]);
  for (let i = 1; i <= 10; i++) set(i, 340 + i * 4, 190 + (i % 3) * 5);
  set(Landmark.nose, 360, 200);
  set(Landmark.leftShoulder, 420, 300);
  set(Landmark.rightShoulder, 300, 300);
  set(Landmark.leftElbow, 430, 450);
  set(Landmark.rightElbow, 290, 450);
  set(Landmark.leftWrist, 435, 580);
  set(Landmark.rightWrist, 285, 580);
  for (const i of [17, 19, 21]) set(i, 437, 600);
  for (const i of [18, 20, 22]) set(i, 283, 600);
  set(Landmark.leftHip, 400, 600);
  set(Landmark.rightHip, 320, 600);
  set(Landmark.leftKnee, 400, 850);
  set(Landmark.rightKnee, 320, 850);
  set(Landmark.leftAnkle, 400, 1100);
  set(Landmark.rightAnkle, 320, 1100);
  set(Landmark.leftHeel, 400, 1130);
  set(Landmark.rightHeel, 320, 1130);
  set(Landmark.leftFootIndex, 410, 1150);
  set(Landmark.rightFootIndex, 330, 1150);
  return p.flatMap(([x, y]) => [x, y, 0.99]);
}

function moved(lm: number[], index: number, x: number, y: number): number[] {
  const out = lm.slice();
  out[index * 3] = x;
  out[index * 3 + 1] = y;
  return out;
}

function observe(lm: number[], face: Observation['face'] = null): Observation {
  return { landmarks: lm, frameHeight: 1280, face, angles: jointAngles(lm) };
}

test('normalizePose centers on the mid-hip and scales by the torso', () => {
  const pose = normalizePose(standing())!;
  close(pose.torso, 300);
  // Left wrist (435, 580) relative to mid-hip (360, 600), divided by 300.
  close(pose.points[Landmark.leftWrist].x, 0.25);
  close(pose.points[Landmark.leftWrist].y, -20 / 300);
  close(pose.points[Landmark.nose].y, -400 / 300);
});

test('normalizePose gives the same pose at any distance and position', () => {
  const near = standing();
  const far = near.map((v, i) => (i % 3 === 0 ? v * 0.4 + 100 : i % 3 === 1 ? v * 0.4 - 50 : v));
  const a = normalizePose(near)!;
  const b = normalizePose(far)!;
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    close(a.points[i].x, b.points[i].x);
    close(a.points[i].y, b.points[i].y);
  }
});

test('normalizePose needs both hips and shoulders', () => {
  const lm = standing();
  lm[Landmark.leftHip * 3 + 2] = 0.1;
  assert.equal(normalizePose(lm), null);
});

test('joint similarity is 1 within tolerance and falls linearly to 0', () => {
  assert.equal(jointSimilarity(100, 90, 10), 1);
  close(jointSimilarity(122.5, 90, 10), 0.5);
  close(jointSimilarity(57.5, 90, 10), 0.5);
  assert.equal(jointSimilarity(150, 90, 10), 0);
});

test('score blends the weighted mean with the worst joint, and an unseen joint counts as 0', () => {
  const template: PoseTemplate = {
    joints: {
      leftElbow: { angle: 90, tolerance: 10, weight: 3 },
      rightElbow: { angle: 90, tolerance: 10, weight: 1 },
    },
    hands: {},
    face: null,
  };
  // Weighted means 0.75 and 0.25, worst joint 0: 0.6 * mean.
  close(scorePose({ leftElbow: 95, rightElbow: 180 }, template), 0.45);
  close(scorePose({ leftElbow: 180, rightElbow: 95 }, template), 0.15);
  close(scorePose({ leftElbow: 95 }, template), 0.45);
  close(scorePose({ leftElbow: 90, rightElbow: 122.5 }, template), 0.6 * 0.875 + 0.4 * 0.5);
  close(scorePose({}, template), 0);
});

test('body measures read torso lean and thigh spread', () => {
  const a = jointAngles(standing());
  // Mid-shoulder is straight above mid-hip; thighs (400,850) and (320,850) from (360,600).
  close(a.torsoLean!, 0);
  close(a.legSpread!, (2 * Math.atan2(40, 250) * 180) / Math.PI);
  // Shoulders shifted 300 px right over a 300 px torso: 45 degrees of lean.
  let leaning = moved(standing(), Landmark.leftShoulder, 720, 300);
  leaning = moved(leaning, Landmark.rightShoulder, 600, 300);
  close(jointAngles(leaning).torsoLean!, 45);
});

test('a pose scores 1 against its own template and lower when an arm moves', () => {
  const lm = standing();
  const template = templateFromLandmarks(lm, { tolerance: 12, face: null });
  close(scorePose(jointAngles(lm), template), 1);
  // Right arm straight out to the side: shoulder angle goes from ~0 to ~90 degrees.
  let raised = moved(lm, Landmark.rightElbow, 150, 300);
  raised = moved(raised, Landmark.rightWrist, 20, 300);
  const score = scorePose(jointAngles(raised), template);
  // Only the right shoulder is wrong, by 90 degrees: the pose must not count as matched.
  assert.ok(score < DEFAULT_MATCH.exit && score > 0.4, `score ${score}`);
});

const RAW = { ...DEFAULT_MATCH, smoothing: 1 };

function run(steps: [number, number][], settings = RAW) {
  let state: MatcherState = INITIAL_MATCHER;
  return steps.map(([t, score]) => {
    const step = stepMatcher(state, score, t, settings);
    state = step.state;
    return step;
  });
}

test('matching uses hysteresis: on at 0.85, off only below 0.75', () => {
  const r = run([
    [0, 0.84],
    [100, 0.86],
    [200, 0.76],
    [300, 0.74],
    [400, 0.8],
  ]);
  assert.deepEqual(
    r.map((s) => s.state.matched),
    [false, true, true, false, false],
  );
  assert.deepEqual(
    r.map((s) => s.justMatched),
    [false, true, false, false, false],
  );
});

test('auto capture fires once after the hold and re-arms only below the exit threshold', () => {
  const r = run([
    [100, 0.9], // matched, hold starts
    [400, 0.8], // still matched (above exit), halfway
    [699, 0.9],
    [700, 0.9], // 600 ms held: capture
    [800, 0.9],
    [900, 0.8], // between exit and enter: stays disarmed
    [950, 0.9],
    [1000, 0.7], // below exit: match ends, re-armed
    [1100, 0.9], // new match
    [1700, 0.9], // capture again
  ]);
  assert.deepEqual(
    r.map((s) => s.capture),
    [false, false, false, true, false, false, false, false, false, true],
  );
  close(r[1].holdProgress, 0.5);
  assert.equal(r[4].holdProgress, 0);
});

test('the score is smoothed with 70% of the old value and 30% of the new one', () => {
  const r = run(
    [
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    DEFAULT_MATCH,
  );
  close(r[0].state.smoothed, 0.3);
  close(r[1].state.smoothed, 0.51);
  close(r[2].state.smoothed, 0.657);
  assert.equal(r[2].state.matched, false);
});

test('asks to show the whole body when too few landmarks are visible', () => {
  const lm = standing();
  // Hide 9 face points: 24 of 33 stay visible, one below the limit, while hips and shoulders stay.
  for (let i = 1; i <= 9; i++) lm[i * 3 + 2] = 0.1;
  const template = templateFromLandmarks(standing(), { tolerance: 12, face: null });
  assert.equal(detectCues(observe(lm), template, DEFAULT_MATCH)[0].code, 'FULL_BODY');
});

test('asks to raise the right hand when the target is above the shoulder', () => {
  const template: PoseTemplate = { joints: {}, hands: { right: { x: -0.5, y: -1.8 } }, face: null };
  const cues = detectCues(observe(standing()), template, DEFAULT_MATCH);
  assert.deepEqual(
    cues.map((c) => c.code),
    ['RAISE_RIGHT_HAND'],
  );
});

test('asks to lower the left hand when it is above the target', () => {
  const template: PoseTemplate = { joints: {}, hands: { left: { x: 0.3, y: -1 } }, face: null };
  // Mid-hip y is 600 and the torso 300, so y = -1.6 torso lengths is pixel y 600 - 480 = 120,
  // above the head (nose at 200). Body height must ignore the hand, so no STEP_BACK either.
  const lm = moved(standing(), Landmark.leftWrist, 450, 120);
  const cues = detectCues(observe(lm), template, DEFAULT_MATCH);
  assert.deepEqual(
    cues.map((c) => c.code),
    ['LOWER_LEFT_HAND'],
  );
});

test('asks for a smile and orders cues by size of the error', () => {
  const template: PoseTemplate = {
    joints: {},
    hands: { right: { x: -0.4, y: -0.05 } },
    face: { smileMin: 0.6, pitch: 0, yaw: 0 },
  };
  const lm = standing();
  const cues = detectCues(observe(lm, { smile: 0.1, pitch: -14, yaw: 2 }), template, DEFAULT_MATCH);
  assert.deepEqual(
    cues.map((c) => c.code),
    ['SMILE', 'CHIN_UP'],
  );
  const happy = detectCues(observe(lm, { smile: 0.9, pitch: 0, yaw: 0 }), template, DEFAULT_MATCH);
  assert.deepEqual(happy, []);
});

test('asks to step back when the body fills more than 95% of the frame height', () => {
  const lm = standing().map((v, i) => (i % 3 === 1 ? (v - 200) * 1.3 + 10 : v));
  const template: PoseTemplate = { joints: {}, hands: {}, face: null };
  assert.equal(detectCues(observe(lm), template, DEFAULT_MATCH)[0].code, 'STEP_BACK');
});

test('the shown cue changes at most every 1.5 s, but a match shows at once', () => {
  const a = [{ code: 'SMILE' as const, priority: 2 }];
  const b = [{ code: 'CHIN_UP' as const, priority: 2 }];
  let s = nextCue(INITIAL_CUE, a, false, 1000);
  assert.equal(s.code, 'SMILE');
  const same = nextCue(s, a, false, 1100);
  assert.equal(same, s);
  s = nextCue(s, b, false, 2000);
  assert.equal(s.code, 'SMILE');
  s = nextCue(s, b, false, 2500);
  assert.equal(s.code, 'CHIN_UP');
  s = nextCue(s, a, true, 2600);
  assert.equal(s.code, 'MATCHED');
});

test('keeps the largest blob and traces its boundary clockwise from the top-left', () => {
  const W = 6;
  const H = 5;
  const mask = new Array(W * H).fill(0);
  for (let y = 1; y <= 2; y++) for (let x = 1; x <= 3; x++) mask[y * W + x] = 1;
  mask[4 * W + 5] = 0.9; // a separate one-cell blob
  const grid = largestComponent(mask, W, H);
  assert.equal(grid[4 * W + 5], 0);
  assert.deepEqual(traceBoundary(grid, W, H), [1, 1, 2, 1, 3, 1, 3, 2, 2, 2, 1, 2]);
});

test('mask contour stays on the person and is normalized to the mask size', () => {
  const W = 40;
  const H = 80;
  const mask = new Array(W * H).fill(0);
  for (let y = 10; y < 70; y++) for (let x = 15; x < 25; x++) mask[y * W + x] = 1;
  const c = maskContour(mask, W, H, 50);
  assert.ok(c.length >= 6 && c.length <= 100);
  for (let i = 0; i < c.length; i += 2) {
    assert.ok(c[i] > 14 / W && c[i] < 26 / W, `x ${c[i]}`);
    assert.ok(c[i + 1] > 9 / H && c[i + 1] < 71 / H, `y ${c[i + 1]}`);
  }
});

test('affine map from three points handles rotation and keeps extra values', () => {
  // Upright image rotated 90 degrees counterclockwise into a 400 x 800 view.
  const m = affineFromPoints({ x: 100, y: 800 }, { x: 100, y: 0 }, { x: 500, y: 800 });
  assert.deepEqual(applyAffine(m, 0.5, 0.25), { x: 200, y: 400 });
  assert.deepEqual(mapPoints(m, [0.5, 0.25, 0.7], 3), [200, 400, 0.7]);
});
