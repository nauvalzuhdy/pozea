// Body outline from a small person-segmentation mask: keep the largest blob and trace its edge.

// Moore neighborhood in clockwise order (y points down), starting from west.
const DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const DY = [0, -1, -1, -1, 0, 1, 1, 1];

function directionOf(dx: number, dy: number): number {
  for (let d = 0; d < 8; d++) if (DX[d] === dx && DY[d] === dy) return d;
  return 0;
}

/** Cells of the largest 8-connected region with mask values at or above the threshold (1 = inside). */
export function largestComponent(
  mask: ArrayLike<number>,
  width: number,
  height: number,
  threshold = 0.5,
): Uint8Array {
  const label = new Int32Array(width * height);
  const stack: number[] = [];
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let start = 0; start < width * height; start++) {
    if (label[start] !== 0 || mask[start] < threshold) continue;
    next++;
    let size = 0;
    label[start] = next;
    stack.push(start);
    while (stack.length > 0) {
      const cell = stack.pop()!;
      size++;
      const x = cell % width;
      const y = (cell - x) / width;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (label[n] === 0 && mask[n] >= threshold) {
          label[n] = next;
          stack.push(n);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }
  const out = new Uint8Array(width * height);
  if (best === 0) return out;
  for (let i = 0; i < out.length; i++) out[i] = label[i] === best ? 1 : 0;
  return out;
}

/**
 * Moore-neighbor boundary tracing of a single region. Returns the boundary cells in order as a
 * flattened [x, y, ...] list, clockwise, starting at the top-left cell. Empty when the grid is empty.
 */
export function traceBoundary(grid: Uint8Array, width: number, height: number): number[] {
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && grid[y * width + x] === 1;
  let start = -1;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 1) {
      start = i;
      break;
    }
  }
  if (start < 0) return [];
  const sx = start % width;
  const sy = (start - sx) / width;
  const out = [sx, sy];

  let cx = sx;
  let cy = sy;
  let back = 0; // west of the first cell is outside, because the scan reached it from the left
  let secondX = -1;
  let secondY = -1;
  const limit = 4 * width * height + 8;
  for (let step = 0; step < limit; step++) {
    let moved = false;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (!inside(nx, ny)) continue;
      // The neighbor checked just before this one is outside; it is the new backtrack cell.
      const pd = (d + 7) % 8;
      back = directionOf(cx + DX[pd] - nx, cy + DY[pd] - ny);
      if (secondX < 0) {
        secondX = nx;
        secondY = ny;
      } else if (cx === sx && cy === sy && nx === secondX && ny === secondY) {
        return out.slice(0, -2); // back at the start, about to repeat the first move
      }
      cx = nx;
      cy = ny;
      out.push(cx, cy);
      moved = true;
      break;
    }
    if (!moved) return out; // a single isolated cell
  }
  return out;
}

/**
 * Outline of the person in a W x H mask, normalized to 0...1 (cell centers), with at most maxPoints
 * points and a light moving-average smoothing so the drawn line does not look stair-stepped.
 */
export function maskContour(
  mask: ArrayLike<number>,
  width: number,
  height: number,
  maxPoints = 120,
): number[] {
  const boundary = traceBoundary(largestComponent(mask, width, height), width, height);
  const count = boundary.length / 2;
  if (count < 3) return [];
  const stride = Math.max(1, Math.ceil(count / maxPoints));
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < count; i += stride) {
    xs.push(boundary[i * 2]);
    ys.push(boundary[i * 2 + 1]);
  }
  const n = xs.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n;
    const b = (i + 1) % n;
    const x = (xs[a] + 2 * xs[i] + xs[b]) / 4;
    const y = (ys[a] + 2 * ys[i] + ys[b]) / 4;
    out.push((x + 0.5) / width, (y + 0.5) / height);
  }
  return out;
}
