import { describe, expect, it } from 'vitest';
import { runeOf, runeText } from './rune';

const points = (d: string) => [...d.matchAll(/-?\d+/g)].map(Number);

describe('rune', () => {
  it('is the same for the same text, whatever its case or spaces', () => {
    expect(runeOf('It rang true.')).toEqual(runeOf('  it rang TRUE.  '));
  });

  it('differs for different texts', () => {
    const runes = new Set(['a', 'b', 'The first full sit.', 'Morning pages', 'Kyoto', 'Letters home'].map((t) => runeOf(t).join('')));
    expect(runes.size).toBeGreaterThan(4);
  });

  it('is a stave and three to five cuts, inside its box', () => {
    for (const t of ['x', 'Why keep this one?', 'Ryokan', '']) {
      const r = runeOf(t);
      expect(r[0]).toBe('M0 -9V9');
      expect(r.length - 1).toBeGreaterThanOrEqual(3);
      expect(r.length - 1).toBeLessThanOrEqual(5);
      for (const d of r) for (const n of points(d)) expect(Math.abs(n)).toBeLessThanOrEqual(9);
    }
  });

  it('comes from the reason, or else the note’s name without its number', () => {
    expect(runeText('  Because.  ', 'stone/a/Bell.md')).toBe('Because.');
    expect(runeText('', 'sand/sun/2026-11-01 (2).md')).toBe('2026-11-01');
  });
});
