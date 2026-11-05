import { describe, expect, it } from 'vitest';
import { withBase } from './base';

describe('withBase', () => {
  it('puts a site path under the base', () => {
    expect(withBase('/docs/how-it-works')).toBe('/mandala/docs/how-it-works');
  });
  it('gives the base itself for the root', () => {
    expect(withBase('')).toBe('/mandala/');
    expect(withBase('/')).toBe('/mandala/');
  });
  it('leaves a full URL alone', () => {
    expect(withBase('https://github.com/dylanpieper/mandala')).toBe('https://github.com/dylanpieper/mandala');
  });
});
