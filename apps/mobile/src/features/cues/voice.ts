// When to speak the live instructions. Pure TypeScript; speaker.ts does the speaking.

import type { CueCode } from '../pose-engine/cues.ts';

/** An instruction is spoken only after it has been on screen this long. */
export const VOICE_STABLE_MS = 800;
/** Minimum time between two utterances. */
export const VOICE_GAP_MS = 3000;
/** The same instruction is spoken again only after this long. */
export const VOICE_REPEAT_MS = 6000;

/** Said when the pose matches, then the countdown runs one word per second before the photo. */
export const HOLD_PHRASE = 'Tahan ya';
export const COUNTDOWN_WORDS = ['Tiga', 'Dua', 'Satu'] as const;
export const COUNTDOWN_MS = COUNTDOWN_WORDS.length * 1000;

export interface VoiceState {
  /** Instruction on screen and since when. */
  code: CueCode | null;
  since: number;
  /** Last instruction spoken, and when anything was last spoken. */
  spoken: CueCode | null;
  spokenAt: number;
}

export const INITIAL_VOICE: VoiceState = { code: null, since: 0, spoken: null, spokenAt: -Infinity };

/**
 * Whether to speak the instruction on screen now. MATCHED is never spoken here: the camera says
 * HOLD_PHRASE and the countdown itself and records them with `spoke`.
 */
export function nextUtterance(state: VoiceState, code: CueCode, now: number): { state: VoiceState; speak: boolean } {
  const next = state.code === code ? state : { ...state, code, since: now };
  if (code === 'MATCHED') return { state: next, speak: false };
  const stable = now - next.since >= VOICE_STABLE_MS;
  const quiet = now - next.spokenAt >= VOICE_GAP_MS;
  const due = code !== next.spoken || now - next.spokenAt >= VOICE_REPEAT_MS;
  if (stable && quiet && due) return { state: { ...next, spoken: code, spokenAt: now }, speak: true };
  return { state: next, speak: false };
}

/** Records an utterance made outside nextUtterance (the hold phrase and countdown). */
export function spoke(state: VoiceState, code: CueCode, now: number): VoiceState {
  return { ...state, spoken: code, spokenAt: now };
}

/** Index into COUNTDOWN_WORDS due `elapsed` ms after the match started, or -1 during the hold. */
export function countdownIndex(elapsed: number, holdMs: number): number {
  if (elapsed < holdMs) return -1;
  return Math.min(COUNTDOWN_WORDS.length - 1, Math.floor((elapsed - holdMs) / 1000));
}
