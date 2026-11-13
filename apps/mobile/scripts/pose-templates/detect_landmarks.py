"""Detects 33 BlazePose landmarks on example pose photos, for build-templates.ts.

Usage (dev only, not part of the app):
  uv venv -p 3.12 .venv && uv pip install -p .venv/bin/python mediapipe==0.10.21
  curl -LO https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
  .venv/bin/python -I detect_landmarks.py pose_landmarker_heavy.task slug=photo.jpg ... > landmarks.json

Prints {slug: {"width", "height", "landmarks": [x, y, visibility] * 33 in pixels}}. A photo where
no person is found is reported on stderr and left out.
"""

import json
import sys

import mediapipe as mp
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions, RunningMode


def main() -> None:
    model, *pairs = sys.argv[1:]
    options = PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model),
        running_mode=RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=0.3,
        min_pose_presence_confidence=0.3,
    )
    out = {}
    with PoseLandmarker.create_from_options(options) as landmarker:
        for pair in pairs:
            slug, path = pair.split("=", 1)
            image = mp.Image.create_from_file(path)
            result = landmarker.detect(image)
            if not result.pose_landmarks:
                print(f"{slug}: no person found in {path}", file=sys.stderr)
                continue
            w, h = image.width, image.height
            flat = []
            for p in result.pose_landmarks[0]:
                flat += [round(p.x * w, 2), round(p.y * h, 2), round(p.visibility, 3)]
            out[slug] = {"width": w, "height": h, "landmarks": flat}
    json.dump(out, sys.stdout, indent=1)


if __name__ == "__main__":
    main()
