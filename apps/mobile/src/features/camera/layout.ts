// Screen geometry of the camera overlay. Pure functions, no React.

export const RATIOS = [
  { id: '3:4', value: 3 / 4 },
  { id: '4:5', value: 4 / 5 },
  { id: '9:16', value: 9 / 16 },
  { id: '1:1', value: 1 },
] as const;

export type RatioId = (typeof RATIOS)[number]['id'];

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The photo area for a width/height ratio: as large as fits between `top` and `bottom` with a side
 * margin, centered in that band.
 */
export function cropRect(
  viewWidth: number,
  top: number,
  bottom: number,
  ratio: number,
  margin = 12,
): CropRect {
  const availableWidth = Math.max(0, viewWidth - 2 * margin);
  const availableHeight = Math.max(0, bottom - top);
  let width = availableWidth;
  let height = width / ratio;
  if (height > availableHeight) {
    height = availableHeight;
    width = height * ratio;
  }
  return { x: (viewWidth - width) / 2, y: top + (availableHeight - height) / 2, width, height };
}

/** Where to draw an image of the given aspect so it fits inside `rect` at `fill` of its height. */
export function fitSilhouette(rect: CropRect, imageWidth: number, imageHeight: number, fill = 0.86): CropRect {
  let height = rect.height * fill;
  let width = (height * imageWidth) / imageHeight;
  if (width > rect.width * 0.95) {
    width = rect.width * 0.95;
    height = (width * imageHeight) / imageWidth;
  }
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}
