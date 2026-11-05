import { describe, expect, it } from 'vitest';
import { loudness, minutesLeft, sandLeft } from './timer.svelte';

const FOCUS_MS = 25 * 60_000;

describe('hourglass', () => {
  const at = (msLeft: number) => ({ phase: 'focus' as const, length: FOCUS_MS, now: 0, endsAt: msLeft });

  it('is full when idle and runs through as the minutes pass', () => {
    expect(sandLeft({ ...at(0), phase: null })).toBe(1);
    expect(sandLeft(at(FOCUS_MS))).toBe(1);
    expect(sandLeft(at(FOCUS_MS / 2))).toBe(0.5);
    expect(sandLeft(at(-5))).toBe(0);
  });

  it('turns the volume slider into a gain the ear hears as even', () => {
    expect(loudness(0)).toBe(0);
    expect(loudness(1)).toBe(1);
    expect(loudness(0.5)).toBe(0.25);
    expect(loudness(2)).toBe(1);
  });

  it('shows whole minutes, rounded up', () => {
    expect(minutesLeft(at(FOCUS_MS))).toBe(25);
    expect(minutesLeft(at(61_000))).toBe(2);
    expect(minutesLeft(at(1))).toBe(1);
    expect(minutesLeft(at(0))).toBe(0);
  });
});
