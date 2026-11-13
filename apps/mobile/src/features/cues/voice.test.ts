import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CueCode } from '../pose-engine/cues.ts';

import { countdownIndex, INITIAL_VOICE, nextUtterance, spoke, type VoiceState } from './voice.ts';

/** Feeds the shown instruction at each time and returns the times something was spoken. */
function spokenAt(frames: [number, CueCode][], start: VoiceState = INITIAL_VOICE): number[] {
  let state = start;
  const out: number[] = [];
  for (const [t, code] of frames) {
    const r = nextUtterance(state, code, t);
    state = r.state;
    if (r.speak) out.push(t);
  }
  return out;
}

test('an instruction is spoken once it has been shown for 0.8 s, not before', () => {
  assert.deepEqual(
    spokenAt([
      [0, 'SMILE'],
      [500, 'SMILE'],
      [799, 'SMILE'],
      [800, 'SMILE'],
      [1500, 'SMILE'],
    ]),
    [800],
  );
});

test('a new instruction waits until 3 s after the last utterance', () => {
  assert.deepEqual(
    spokenAt([
      [0, 'SMILE'],
      [800, 'SMILE'], // spoken
      [1000, 'STEP_BACK'],
      [2000, 'STEP_BACK'], // stable, but only 1.2 s after the last utterance
      [3799, 'STEP_BACK'],
      [3800, 'STEP_BACK'], // spoken
    ]),
    [800, 3800],
  );
});

test('the same instruction is repeated only after 6 s', () => {
  assert.deepEqual(
    spokenAt([
      [0, 'RAISE_HAND'],
      [800, 'RAISE_HAND'], // spoken
      [4000, 'RAISE_HAND'], // 3 s gap passed, but it is the same instruction
      [6799, 'RAISE_HAND'],
      [6800, 'RAISE_HAND'], // repeated
    ]),
    [800, 6800],
  );
});

test('MATCHED is never spoken as an instruction, and the countdown counts as speech', () => {
  assert.deepEqual(spokenAt([[0, 'MATCHED'], [5000, 'MATCHED']]), []);
  // After "Tahan ya ... satu" at 10 s, the next instruction waits for the 3 s gap.
  const afterCountdown = spoke(INITIAL_VOICE, 'MATCHED', 10_000);
  assert.deepEqual(
    spokenAt(
      [
        [10_100, 'SMILE'],
        [12_000, 'SMILE'],
        [13_000, 'SMILE'],
      ],
      afterCountdown,
    ),
    [13_000],
  );
});

test('countdown words come one per second after the hold', () => {
  const hold = 600;
  assert.deepEqual(
    [0, 599, 600, 1599, 1600, 2600, 3599].map((t) => countdownIndex(t, hold)),
    [-1, -1, 0, 0, 1, 2, 2],
  );
});
