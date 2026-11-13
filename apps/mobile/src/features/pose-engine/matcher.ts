// Turns noisy per-frame scores into a stable "matched" state and decides when to auto capture.

import type { MatchSettings } from './template.ts';

export interface MatcherState {
  smoothed: number;
  matched: boolean;
  /** Time the current match started, in milliseconds. */
  matchedSince: number;
  /** Auto capture may fire. It disarms after a capture and re-arms when the score drops below exit. */
  armed: boolean;
}

export const INITIAL_MATCHER: MatcherState = {
  smoothed: 0,
  matched: false,
  matchedSince: 0,
  armed: true,
};

export interface MatcherStep {
  state: MatcherState;
  /** True on the frame the pose became matched. */
  justMatched: boolean;
  /** 0...1 progress of the hold before auto capture; 0 when not counting down. */
  holdProgress: number;
  /** True on exactly one frame per match: take the photo now. */
  capture: boolean;
}

export function stepMatcher(
  prev: MatcherState,
  score: number,
  now: number,
  settings: Pick<MatchSettings, 'enter' | 'exit' | 'holdMs' | 'smoothing'>,
): MatcherStep {
  const smoothed = prev.smoothed * (1 - settings.smoothing) + score * settings.smoothing;
  let { matched, matchedSince, armed } = prev;
  let justMatched = false;

  if (!matched && smoothed >= settings.enter) {
    matched = true;
    matchedSince = now;
    justMatched = true;
  } else if (matched && smoothed < settings.exit) {
    matched = false;
    armed = true;
  }

  let holdProgress = 0;
  let capture = false;
  if (matched && armed) {
    holdProgress = Math.min(1, (now - matchedSince) / settings.holdMs);
    if (holdProgress >= 1) {
      capture = true;
      armed = false;
    }
  }

  return { state: { smoothed, matched, matchedSince, armed }, justMatched, holdProgress, capture };
}
