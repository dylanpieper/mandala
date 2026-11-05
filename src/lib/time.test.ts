import { describe, expect, it } from 'vitest';
import { freshTitle, sinceWhen, leavingSoon, timeLeft, timeShare } from './time';

const now = new Date('2026-10-31T12:00:00');
const plus = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

describe('timeShare', () => {
  it('puts every lifespan on one scale, so sooner is always shorter', () => {
    const hours = [0, 1, 6, 23, 24 * 6, 24 * 14, 24 * 29];
    const shares = hours.map((h) => timeShare(plus(h * 60), now));
    for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeGreaterThan(shares[i - 1]);
  });
  it('is empty for a breath or what ran out, and full at a whole moon', () => {
    expect(timeShare(null, now)).toBe(0);
    expect(timeShare(plus(-60), now)).toBe(0);
    expect(timeShare(plus(29.530589 * 1440), now)).toBeCloseTo(1, 5);
  });
});

describe('leavingSoon', () => {
  it('follows the bar, not the lifespan: a few hours left is soon for any note', () => {
    expect(leavingSoon(plus(3 * 60), now)).toBe(true);
    expect(leavingSoon(plus(5 * 60), now)).toBe(false);
    expect(leavingSoon(plus(2 * 1440), now)).toBe(false);
    expect(leavingSoon(null, now)).toBe(false);
  });
});

describe('timeLeft', () => {
  it('calls a breath ephemeral', () => {
    expect(timeLeft(null, now)).toBe('Ephemeral');
  });
  it('counts down in the largest units that matter', () => {
    expect(timeLeft(plus(400), now)).toBe('6h 40m');
    expect(timeLeft(plus(25 * 60), now)).toBe('1d 1h');
    expect(timeLeft(plus(19 * 1440 + 30), now)).toBe('19d');
    expect(timeLeft(plus(0.5), now)).toBe('1m');
  });
  it('never counts below zero', () => {
    expect(timeLeft(plus(-5), now)).toBe('ran out');
  });
});

describe('sinceWhen', () => {
  it('names the part of the day', () => {
    expect(sinceWhen('2026-10-31T08:00:00', now)).toBe('this morning');
    expect(sinceWhen('2026-10-30T19:00:00', now)).toBe('yesterday evening');
    expect(sinceWhen('2026-10-29T19:00:00', now)).toBe('Thursday evening');
  });
});

describe('freshTitle', () => {
  it('is the local date, YYYY-MM-DD', () => {
    expect(freshTitle(new Date('2026-10-31T06:12:00'))).toBe('2026-10-31');
    expect(freshTitle(new Date('2026-03-05T23:59:00'))).toBe('2026-03-05');
  });
});
