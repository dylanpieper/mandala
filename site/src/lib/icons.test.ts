import { describe, expect, it } from 'vitest';
import { icon, iconNames } from './icons';

describe('icons from the app', () => {
  it('reads the broom from Icon.svelte', () => {
    expect(icon('broom')).toContain('M14 2L9 7');
  });
  it('knows every name the app declares', () => {
    expect(iconNames()).toEqual(expect.arrayContaining(['search', 'stone', 'wind', 'sun', 'breath', 'broom', 'mandala']));
  });
  it('drops the comments', () => {
    expect(icon('sun')).not.toContain('<!--');
  });
  it('throws on a name the app does not have', () => {
    expect(() => icon('nope')).toThrow(/nope/);
  });
});
