// Shortcut labels for this computer: ⌘ and ⌥ on a Mac, Ctrl and Alt elsewhere.
export const isMac = typeof navigator === 'undefined' || /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export const MOD = isMac ? '⌘' : 'Ctrl+';
export const ALT = isMac ? '⌥' : 'Alt+';
export const SHIFT = isMac ? '⇧' : 'Shift+';

// A thin space between a Mac's key symbols, so ⌘ and the letter do not touch.
const GAP = ' ';

/**
 * `key('K')` is "⌘ K" on a Mac (thin spaces) and "Ctrl+K" elsewhere.
 * `key('B', true)` adds ⌥ or Alt; `key('X', false, true)` adds ⇧ or Shift,
 * in the Mac's order (⌥ ⇧ ⌘).
 */
export function key(k: string, alt = false, shift = false): string {
  const mods = [...(alt ? [ALT] : []), ...(shift ? [SHIFT] : [])];
  return isMac ? [...mods, MOD, k].join(GAP) : `${MOD}${mods.join('')}${k}`;
}

/** The modifier of this computer's shortcuts is held: ⌘ on a Mac, Ctrl elsewhere. */
export const modHeld = (e: KeyboardEvent | MouseEvent) => (isMac ? e.metaKey : e.ctrlKey);
