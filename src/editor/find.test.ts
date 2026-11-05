import { describe, expect, it } from 'vitest';
import { findAll, nearest } from './find';

describe('findAll', () => {
  it('finds every match, ignoring case', () => {
    expect(findAll('Rain, rain, RAIN.', 'rain')).toEqual([
      { from: 0, to: 4 },
      { from: 6, to: 10 },
      { from: 12, to: 16 },
    ]);
  });

  it('finds nothing for an empty query', () => {
    expect(findAll('rain', '')).toEqual([]);
  });

  it('takes the query as plain text, not a pattern', () => {
    expect(findAll('a.b axb', 'a.b')).toEqual([{ from: 0, to: 3 }]);
  });

  it('does not overlap matches', () => {
    expect(findAll('aaaa', 'aa')).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 },
    ]);
  });
});

describe('nearest', () => {
  const m = findAll('one two one two one', 'one');
  it('is the first match at or after the caret', () => {
    expect(nearest(m, 5)).toBe(1);
  });
  it('wraps to the first when the caret is past the last', () => {
    expect(nearest(m, 19)).toBe(0);
  });
  it('is -1 with no matches', () => {
    expect(nearest([], 0)).toBe(-1);
  });
});
