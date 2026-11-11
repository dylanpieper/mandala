// The menu (☰, left of the hourglass): every shortcut as an item to click.
// The window runs the same action for the item and for its keys (`Main.svelte`).
import { key } from './keys';

export type MenuAction = 'new' | 'search' | 'find' | 'draw' | 'keep' | 'letGo' | 'bold' | 'italic' | 'link' | 'code' | 'strike' | 'mandala' | 'focus' | 'stone' | 'sand' | 'hourglass' | 'zoomIn' | 'zoomOut' | 'vault';

export interface MenuItem {
  action: MenuAction;
  label: string;
  keys: string;
  /** Makes, keeps, lets go or leaves: held for a second, in this color, never a click. */
  hold?: 'sand' | 'stone' | 'vermilion';
}

export const MENU: { group: string; items: MenuItem[] }[] = [
  {
    group: 'Note',
    items: [
      { action: 'new', label: 'New note', keys: key('N'), hold: 'sand' },
      { action: 'search', label: 'Search', keys: key('P') },
      { action: 'find', label: 'Find in note', keys: key('F') },
      { action: 'draw', label: 'Draw', keys: key('D') },
      { action: 'keep', label: 'Set in stone', keys: key('↩'), hold: 'stone' },
      { action: 'letGo', label: 'Let go', keys: key('⌫', true), hold: 'vermilion' },
    ],
  },
  {
    group: 'Format',
    items: [
      { action: 'bold', label: 'Bold', keys: key('B') },
      { action: 'italic', label: 'Italic', keys: key('I') },
      { action: 'link', label: 'Link', keys: key('K') },
      { action: 'code', label: 'Code', keys: key('E') },
      { action: 'strike', label: 'Strikethrough', keys: key('X', false, true) },
    ],
  },
  {
    group: 'Window',
    items: [
      { action: 'mandala', label: 'Mandala', keys: key('M') },
      { action: 'focus', label: 'Focus', keys: key('\\') },
      { action: 'stone', label: 'Stone pane', keys: key('[') },
      { action: 'sand', label: 'Sand pane', keys: key(']') },
      { action: 'hourglass', label: 'Hourglass', keys: key('T') },
      { action: 'zoomIn', label: 'Zoom in', keys: key('+') },
      { action: 'zoomOut', label: 'Zoom out', keys: key('−') },
      { action: 'vault', label: 'Change vault', keys: key('O'), hold: 'vermilion' },
    ],
  },
];

/** Actions that need an open note; sand only for Set in stone. */
export function menuEnabled(action: MenuAction, note: { open: boolean; sand: boolean }): boolean {
  if (action === 'keep') return note.sand;
  if (['find', 'draw', 'letGo', 'bold', 'italic', 'link', 'code', 'strike'].includes(action)) return note.open;
  return true;
}
