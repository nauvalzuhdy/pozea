// Small persisted preferences, stored on the device with the SQLite key-value store.

import Storage from 'expo-sqlite/kv-store';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = Storage.getItemSync(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    Storage.setItemSync(key, JSON.stringify(value));
  } catch {
    // Preferences are best effort; the camera keeps working with defaults.
  }
}

export type PoseEngineSetting = 'mlkit' | 'mediapipe';

export const settings = {
  /** Developer setting: which model runs the live guidance. */
  poseEngine: () => read<PoseEngineSetting>('dev.poseEngine', 'mediapipe'),
  setPoseEngine: (value: PoseEngineSetting) => write('dev.poseEngine', value),
  /** Developer setting: show fps and model time on the camera. */
  showStats: () => read('dev.showStats', false),
  setShowStats: (value: boolean) => write('dev.showStats', value),
  /** Silhouette opacity from the camera slider, 0.1...1. */
  silhouetteOpacity: () => read('camera.silhouetteOpacity', 0.55),
  setSilhouetteOpacity: (value: number) => write('camera.silhouetteOpacity', value),
};
