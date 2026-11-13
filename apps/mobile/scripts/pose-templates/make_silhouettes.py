"""Makes the white target silhouettes from the mannequin thumbnails (light figure on navy).

Usage: python -I make_silhouettes.py OUT_DIR slug=thumbnail.jpg ...
Writes OUT_DIR/<slug>.png: a semi-transparent white fill with a solid white edge, cropped to the
figure. Needs numpy and pillow.
"""

import sys

import numpy as np
from PIL import Image, ImageFilter

SCALE = 4
FILL_ALPHA = 0.42
EDGE_PX = 7


def components(mask: np.ndarray) -> list[np.ndarray]:
    """4-connected regions of a boolean mask, each as a boolean array."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    current = 0
    for sy, sx in zip(*np.nonzero(mask)):
        if labels[sy, sx]:
            continue
        current += 1
        labels[sy, sx] = current
        stack = [(sy, sx)]
        while stack:
            y, x = stack.pop()
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = current
                    stack.append((ny, nx))
    return [labels == i for i in range(1, current + 1)]


def fill_small_holes(mask: np.ndarray, max_share: float = 0.004) -> np.ndarray:
    """Fills gaps inside the figure smaller than max_share of the image (keeps arm-to-body gaps)."""
    out = mask.copy()
    limit = max_share * mask.size
    for region in components(~mask):
        touches_border = region[0].any() or region[-1].any() or region[:, 0].any() or region[:, -1].any()
        if not touches_border and region.sum() < limit:
            out |= region
    return out


def largest_blob(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    best, best_size, current = 0, 0, 0
    for sy, sx in zip(*np.nonzero(mask)):
        if labels[sy, sx]:
            continue
        current += 1
        labels[sy, sx] = current
        stack, size = [(sy, sx)], 0
        while stack:
            y, x = stack.pop()
            size += 1
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = current
                    stack.append((ny, nx))
        if size > best_size:
            best, best_size = current, size
    return labels == best


def silhouette(path: str) -> Image.Image:
    src = Image.open(path).convert("RGB")
    src = src.resize((src.width * SCALE, src.height * SCALE), Image.LANCZOS)
    rgb = np.asarray(src).astype(np.float32)
    luminance = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    # Navy background is below ~60; the figure and its cyan rim are well above.
    mask = fill_small_holes(largest_blob(luminance > 88))
    # Smooth the stair-stepped edge: blur the mask, then threshold it again.
    soft = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(SCALE * 1.2))
    mask = np.asarray(soft) > 127
    m = Image.fromarray((mask * 255).astype(np.uint8))
    inner = np.asarray(m.filter(ImageFilter.MinFilter(EDGE_PX * 2 + 1))) > 127
    edge = mask & ~inner
    alpha = np.where(edge, 1.0, np.where(mask, FILL_ALPHA, 0.0))
    alpha_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    out = Image.new("RGBA", src.size, (255, 255, 255, 0))
    out.putalpha(alpha_img)
    left, top, right, bottom = out.getbbox()
    pad = SCALE * 4
    return out.crop((max(0, left - pad), max(0, top - pad), min(out.width, right + pad), min(out.height, bottom + pad)))


def main() -> None:
    out_dir, *pairs = sys.argv[1:]
    for pair in pairs:
        slug, path = pair.split("=", 1)
        image = silhouette(path)
        image.save(f"{out_dir}/{slug}.png", optimize=True)
        print(slug, image.size)


if __name__ == "__main__":
    main()
