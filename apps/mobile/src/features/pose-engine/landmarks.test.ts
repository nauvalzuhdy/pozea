import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countVisible, uprightToFrame } from './landmarks.ts';

// Independent forward model of what the detector sees: rotate the raw W x H buffer clockwise by
// `deg` around its center (y axis pointing down), then shift so the result starts at (0, 0).
function rawToUpright(x: number, y: number, w: number, h: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const cx = x - w / 2;
  const cy = y - h / 2;
  const rx = cx * Math.cos(r) - cy * Math.sin(r);
  const ry = cx * Math.sin(r) + cy * Math.cos(r);
  const sideways = deg === 90 || deg === 270;
  const uw = sideways ? h : w;
  const uh = sideways ? w : h;
  return { u: (rx + uw / 2) / uw, v: (ry + uh / 2) / uh };
}

const W = 1280;
const H = 720;
// Asymmetric points, so a swapped axis or a wrong direction gives a different answer.
const points = [
  { x: 100, y: 50 },
  { x: 1000, y: 600 },
  { x: 640, y: 120 },
];

for (const deg of [0, 90, 180, 270]) {
  test(`maps upright points back to the raw frame at ${deg} degrees`, () => {
    for (const p of points) {
      const { u, v } = rawToUpright(p.x, p.y, W, H, deg);
      const back = uprightToFrame(u, v, deg, W, H);
      assert.ok(Math.abs(back.x - p.x) < 1e-6, `x at ${deg}: ${back.x} vs ${p.x}`);
      assert.ok(Math.abs(back.y - p.y) < 1e-6, `y at ${deg}: ${back.y} vs ${p.y}`);
    }
  });
}

test('a portrait phone with a sensor rotated 90 degrees puts the upright top-left at raw bottom-left', () => {
  // Upright (0, 0) is the top-left of what the user sees; in a 90-degree buffer it is raw (0, H).
  assert.deepEqual(uprightToFrame(0, 0, 90, W, H), { x: 0, y: H });
});

test('counts only landmarks at or above the visibility threshold', () => {
  assert.equal(countVisible([0.1, 0.2, 0.9, 0.3, 0.4, 0.49, 0.5, 0.6, 0.5]), 2);
  assert.equal(countVisible([]), 0);
});
