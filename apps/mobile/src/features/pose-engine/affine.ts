// Mapping from the upright detector image (normalized 0...1) to preview view points.
// Rotation, mirroring, scale and the cover crop are all affine, so three points define the map.

import type { Point } from './geometry.ts';

/** x' = a*x + b*y + c, y' = d*x + e*y + f */
export type Affine = readonly [number, number, number, number, number, number];

/** The affine map that sends (0,0), (1,0) and (0,1) to p0, p1 and p2. */
export function affineFromPoints(p0: Point, p1: Point, p2: Point): Affine {
  return [p1.x - p0.x, p2.x - p0.x, p0.x, p1.y - p0.y, p2.y - p0.y, p0.y];
}

export function applyAffine(m: Affine, x: number, y: number): Point {
  return { x: m[0] * x + m[1] * y + m[2], y: m[3] * x + m[4] * y + m[5] };
}

/** Maps a flattened [u, v, (extra)...] list with the given stride; extra values are copied. */
export function mapPoints(m: Affine, values: readonly number[], stride: 2 | 3): number[] {
  const out = values.slice();
  for (let i = 0; i + 1 < values.length; i += stride) {
    const p = applyAffine(m, values[i], values[i + 1]);
    out[i] = p.x;
    out[i + 1] = p.y;
  }
  return out;
}
