import { describe, expect, it } from 'vitest';
import { LEVELS, nextLevel } from './zoom';

describe('zoom', () => {
  const one = LEVELS.indexOf(1);
  it('steps up and down one level, held at either end', () => {
    expect(LEVELS[nextLevel(one, 1)]).toBe(1.1);
    expect(LEVELS[nextLevel(one, -1)]).toBe(0.9);
    expect(nextLevel(LEVELS.length - 1, 1)).toBe(LEVELS.length - 1);
    expect(nextLevel(0, -1)).toBe(0);
  });
  it('goes back to 100% on 0', () => {
    expect(LEVELS[nextLevel(0, 0)]).toBe(1);
  });
});
