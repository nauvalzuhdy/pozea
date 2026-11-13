// Instruction copy shown in the bubble. Pure TypeScript: the built-in texts work offline, and
// DeepSeek variations (fetched through the cue-phrases Edge Function) only add variety.

import type { CueCode } from '../pose-engine/cues.ts';

export interface CueText {
  title: string;
  detail: string;
}

export const DEFAULT_CUES: Record<CueCode, CueText> = {
  FULL_BODY: { title: 'Pastikan seluruh badan terlihat', detail: 'Mundur sampai kepala dan kaki masuk' },
  STEP_BACK: { title: 'Mundur sedikit', detail: 'Badanmu terlalu dekat dengan kamera' },
  STEP_CLOSER: { title: 'Maju sedikit', detail: 'Badanmu terlalu jauh dari kamera' },
  RAISE_LEFT_HAND: { title: 'Angkat tangan kirimu', detail: 'Ikuti posisi tangan di siluet' },
  RAISE_RIGHT_HAND: { title: 'Angkat tangan kananmu', detail: 'Ikuti posisi tangan di siluet' },
  LOWER_LEFT_HAND: { title: 'Turunkan tangan kirimu sedikit', detail: 'Ikuti posisi tangan di siluet' },
  LOWER_RIGHT_HAND: { title: 'Turunkan tangan kananmu sedikit', detail: 'Ikuti posisi tangan di siluet' },
  STRAIGHTEN_ELBOW_LEFT: { title: 'Luruskan siku kirimu', detail: 'Rentangkan lengan seperti di siluet' },
  STRAIGHTEN_ELBOW_RIGHT: { title: 'Luruskan siku kananmu', detail: 'Rentangkan lengan seperti di siluet' },
  BEND_ELBOW_LEFT: { title: 'Tekuk siku kirimu', detail: 'Ikuti bentuk lengan di siluet' },
  BEND_ELBOW_RIGHT: { title: 'Tekuk siku kananmu', detail: 'Ikuti bentuk lengan di siluet' },
  BEND_KNEES: { title: 'Tekuk lututmu', detail: 'Ikuti bentuk kaki di siluet' },
  STRAIGHTEN_KNEES: { title: 'Luruskan kakimu', detail: 'Berdiri lebih tegak' },
  SMILE: { title: 'Senyum dikit ya', detail: 'Senyum bikin fotonya lebih hidup' },
  CHIN_UP: { title: 'Angkat dagumu sedikit', detail: 'Pandang lurus ke kamera' },
  CHIN_DOWN: { title: 'Turunkan dagumu sedikit', detail: 'Pandang lurus ke kamera' },
  FACE_CAMERA: { title: 'Hadap ke kamera ya', detail: 'Wajahmu sedikit menyamping' },
  TURN_LEFT: { title: 'Tengok ke kiri sedikit', detail: 'Ikuti arah kepala di siluet' },
  TURN_RIGHT: { title: 'Tengok ke kanan sedikit', detail: 'Ikuti arah kepala di siluet' },
  FOLLOW_SILHOUETTE: { title: 'Ikuti bentuk siluet', detail: 'Samakan posisi badanmu dengan garis putih' },
  RAISE_HAND: { title: 'Angkat satu tanganmu', detail: 'Ikuti posisi tangan di siluet' },
  LOWER_HAND: { title: 'Turunkan tanganmu sedikit', detail: 'Ikuti posisi tangan di siluet' },
  HAND_CLOSER: { title: 'Dekatkan tangan ke wajah', detail: 'Ikuti posisi tangan di siluet' },
  HAND_WIDER: { title: 'Jauhkan tangan dari wajah', detail: 'Ikuti posisi tangan di siluet' },
  TILT_HEAD: { title: 'Miringkan kepalamu sedikit', detail: 'Condongkan kepala ke arah bahu' },
  LEVEL_HEAD: { title: 'Tegakkan kepalamu', detail: 'Kepalamu terlalu miring' },
  TURN_HEAD: { title: 'Tengokkan wajah sedikit', detail: 'Ke samping, mata tetap ke kamera' },
  MATCHED: { title: 'Mantap, tahan ya!', detail: 'Pozea memotret otomatis' },
};

/** Generated variations: at most this many words and characters, so the bubble stays one line. */
export const MAX_WORDS = 6;
export const MAX_CHARS = 40;
export const MAX_VARIANTS = 5;

/**
 * Keeps only well-formed variations from an untrusted response: known codes, short single-line
 * strings, at most MAX_VARIANTS per code. Codes without a valid variation are left out, so the
 * caller falls back to the built-in text for them.
 */
export function validatePhrases(
  value: unknown,
  codes: readonly CueCode[],
): Partial<Record<CueCode, string[]>> {
  const out: Partial<Record<CueCode, string[]>> = {};
  if (typeof value !== 'object' || value === null) return out;
  const record = value as Record<string, unknown>;
  for (const code of codes) {
    const list = record[code];
    if (!Array.isArray(list)) continue;
    const valid = list
      .filter((s): s is string => typeof s === 'string' && !/[\r\n<>{}]/.test(s))
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter((s) => s.length > 0 && s.length <= MAX_CHARS && s.split(' ').length <= MAX_WORDS)
      .slice(0, MAX_VARIANTS);
    if (valid.length > 0) out[code] = [...new Set(valid)];
  }
  return out;
}

/**
 * Text for a cue: a generated variation when there is one (chosen by `pick`, 0...1), else the
 * pose's own copy, else the built-in text. The detail line always comes from the pose or default.
 */
export function cueText(
  code: CueCode,
  poseCues: Partial<Record<CueCode, CueText>>,
  variations: Partial<Record<CueCode, string[]>>,
  pick: number,
): CueText {
  const base = poseCues[code] ?? DEFAULT_CUES[code];
  const options = variations[code];
  // Pose-specific titles say something the generic variations cannot, so they win.
  if (!options || options.length === 0 || poseCues[code]) return base;
  const title = options[Math.min(options.length - 1, Math.floor(pick * options.length))];
  return { title, detail: base.detail };
}
