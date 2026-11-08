// The notes in the teaser's window. Minutes left at the start of the loop;
// a breath has none. Sand is shown soonest-to-leave first, breaths first.

export type Life = 'breath' | 'sun' | 'quarter';

export interface SandNote {
  id: string;
  title: string;
  life: Life;
  /** Minutes left, or null for a breath. */
  left: number | null;
  /** The lifespan in minutes, for the bar. */
  span: number;
  text?: string;
}

export const REASON = 'remember the portugal coast';
export const POEM_PATH = 'sand/sun/Low tide.md';

export const SAND: SandNote[] = [
  { id: 'list', title: 'random idea', life: 'breath', left: null, span: 0 },
  { id: 'movie', title: 'movie to watch tonight', life: 'sun', left: 6, span: 1440 },
  { id: 'ideas', title: 'mandala ideas', life: 'sun', left: 26, span: 1440, text: 'a rune for every kept note\nsand that blows away on its own' },
  { id: 'poem', title: 'Low tide', life: 'sun', left: 860, span: 1440, text: 'The sea leaves the shore\nits small bright things,\nand comes back for them.' },
  { id: 'dates', title: 'weekend date ideas', life: 'quarter', left: 8640, span: 10080 },
];

export const STONE: { folder: string | null; notes: string[] }[] = [
  { folder: 'poems', notes: ['Winter, again'] },
  { folder: 'letters', notes: ['To my wife', 'The move'] },
  { folder: null, notes: ['Recipes from Gma'] },
];

/** Breaths first, then soonest to leave, as the app's sand rail. */
export function sorted(notes: SandNote[]): SandNote[] {
  return [...notes].sort((a, b) => (a.left === null ? -1 : b.left === null ? 1 : a.left - b.left));
}
