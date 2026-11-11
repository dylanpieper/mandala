import { describe, expect, it } from 'vitest';
import { MENU, menuEnabled } from './menu';

const items = MENU.flatMap((g) => g.items);

describe('MENU', () => {
  it('holds what makes, keeps, lets go or leaves, and nothing else', () => {
    expect(items.filter((i) => i.hold).map((i) => i.action).sort()).toEqual(['keep', 'letGo', 'new', 'vault']);
  });

  it('lists each action once, with its own keys', () => {
    expect(new Set(items.map((i) => i.action)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.keys)).size).toBe(items.length);
  });

  it('needs an open note to find, draw or format', () => {
    const none = { open: false, sand: false };
    expect(menuEnabled('find', none)).toBe(false);
    expect(menuEnabled('bold', none)).toBe(false);
    expect(menuEnabled('new', none)).toBe(true);
    expect(menuEnabled('mandala', none)).toBe(true);
  });

  it('sets only sand in stone', () => {
    expect(menuEnabled('keep', { open: true, sand: false })).toBe(false);
    expect(menuEnabled('keep', { open: true, sand: true })).toBe(true);
  });
});
