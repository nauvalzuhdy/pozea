// Speaks instructions with the phone's own text-to-speech (expo-speech): free, offline, and no
// data leaves the phone. Plays on the media stream, so it follows the media volume.

import * as Speech from 'expo-speech';

// expo-speech on Android builds the locale with Locale.Builder().setLanguage(), which takes a bare
// language code; "id-ID" is rejected there and silently falls back to the default voice.
const LANGUAGE = 'id';

/**
 * Whether an Indonesian voice is installed: true, false, or null when the engine cannot tell yet
 * (it lists no voices before it has started). Without one, Android speaks with the default voice.
 */
export async function hasIndonesianVoice(): Promise<boolean | null> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (voices.length === 0) return null;
    // Android reports Indonesian as "id" or, on older engines, the legacy "in".
    return voices.some((v) => /^(id|in)([-_]|$)/i.test(v.language));
  } catch {
    return null;
  }
}

/** Says `text`. An instruction cuts off whatever is being said; `queue` waits for it instead. */
export function say(text: string, { queue = false }: { queue?: boolean } = {}): void {
  if (!queue) void Speech.stop();
  Speech.speak(text, { language: LANGUAGE, rate: 1.0, pitch: 1.0 });
}

export function hush(): void {
  void Speech.stop();
}
