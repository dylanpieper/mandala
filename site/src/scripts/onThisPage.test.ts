import { describe, expect, it } from 'vitest';
import { current } from './onThisPage';

describe('which heading is being read', () => {
  it('is the last heading at or above the reading line', () => {
    expect(current([{ id: 'a', top: -200 }, { id: 'b', top: 40 }, { id: 'c', top: 500 }], 96)).toBe('b');
  });
  it('is the first heading when none has reached the line', () => {
    expect(current([{ id: 'a', top: 300 }, { id: 'b', top: 600 }], 96)).toBe('a');
  });
  it('is nothing on a page without headings', () => {
    expect(current([], 96)).toBeNull();
  });
});
