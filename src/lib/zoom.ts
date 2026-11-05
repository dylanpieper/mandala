// The size of everything in the window, set with ⌘+ / ⌘− / ⌘0 (Ctrl
// elsewhere) and kept as a window preference. In the app the webview
// zooms, so pointer positions stay right; in a plain browser, CSS does.
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { isTauri } from './api';
import { modHeld } from './keys';

const KEY = 'mandala.zoom';
export const LEVELS = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6];

let level = LEVELS.indexOf(1);

function apply() {
  const scale = LEVELS[level];
  localStorage.setItem(KEY, String(scale));
  if (isTauri) getCurrentWebview().setZoom(scale).catch(() => {});
  else (document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom = String(scale);
}

/** The next level in `step`'s direction, held at either end; 0 goes back to 100%. */
export function nextLevel(at: number, step: -1 | 0 | 1): number {
  if (step === 0) return LEVELS.indexOf(1);
  return Math.min(LEVELS.length - 1, Math.max(0, at + step));
}

/** Set the saved size at start. */
export function restoreZoom() {
  const saved = LEVELS.indexOf(Number(localStorage.getItem(KEY) ?? 1));
  if (saved >= 0) level = saved;
  if (LEVELS[level] !== 1) apply();
}

/** Handle ⌘+, ⌘− and ⌘0. True when the key was a zoom key. */
export function zoomKey(e: KeyboardEvent): boolean {
  if (!modHeld(e) || e.altKey) return false;
  const step = e.key === '=' || e.key === '+' ? 1 : e.key === '-' || e.key === '_' ? -1 : e.key === '0' ? 0 : null;
  if (step === null) return false;
  e.preventDefault();
  const next = nextLevel(level, step);
  if (next !== level) {
    level = next;
    apply();
  }
  return true;
}
