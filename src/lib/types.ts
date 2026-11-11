// The shapes `src-tauri` returns. Keep in step with mandala-core's Serialize types.

export type Life = 'breath' | 'sun' | 'quarter' | 'half' | 'full';

export type Place = { kind: 'stone' } | { kind: 'sand'; life: Life } | { kind: 'elsewhere' };

export interface Note {
  rel: string;
  title: string;
  place: Place;
  modified: string;
}

export interface NoteRef {
  rel: string;
  title: string;
  life: Life | null;
  written: string | null;
  dissolves: string | null;
}

export interface SandItem extends NoteRef {
  fraction_left: number;
}

export interface Overview {
  stone: Note[];
  sand: SandItem[];
  elsewhere: Note[];
  /** Folders directly in stone/, empty ones included. */
  folders: string[];
}

export interface Arrival {
  visit: number;
  since: string | null;
  /** What left since the last visit: breaths at its close, and sand that ran out while closed. */
  left: Settled[];
}

/** A note renamed to follow its heading (`rename.rs`), and the notes whose links changed. */
export interface Renamed {
  from: string;
  to: string;
  linked: string[];
}

/** What leaving a note did to its name. A held rename waits for the next time it is left. */
export type Follow =
  | { kind: 'same' }
  | { kind: 'unlinked' }
  | ({ kind: 'renamed' } & Renamed)
  | { kind: 'held'; held: { kind: 'syncing' | 'busy' | 'elsewhere' | 'ambiguous'; rel?: string } };

export interface Settled {
  id: string;
  rel: string;
  title: string;
  reason: 'swept' | 'deleted' | 'merged' | 'combined';
  at: string;
}

export interface Plan {
  moves: string[];
  left_in_place: string[];
  elsewhere: string[];
  notes_in: number[];
  notes: number;
  links_to_rewrite: number;
}

/** One line of two notes woven together, and which note it came from. */
export interface WovenLine {
  text: string;
  from: 'both' | 'into' | 'dragged';
}

/** Two notes woven into one, before combining (`weave`). */
export interface Woven {
  lines: WovenLine[];
  text: string;
  into: string;
  dragged: string;
}

export interface Hit {
  rel: string;
  title: string;
  line: string;
  settled: string | null;
}

export interface VaultInfo {
  root: string;
  name: string;
  arranged: boolean;
}

/** The mandala view's picture of the vault (mandala-core's `Mandala`). */
export interface Stone {
  rel: string;
  title: string;
}

export interface Petal {
  folder: string;
  notes: Stone[];
}

export interface SandGrain {
  rel: string;
  title: string;
  life: Life;
  written: string;
  dissolves: string | null;
  fraction_left: number;
}

export interface Dust {
  id: string;
  title: string;
  reason: Settled['reason'];
  at: string;
  /** 0 just settled, 1 at the end of its day. */
  settled: number;
}

export interface Mandala {
  seeds: Stone[];
  petals: Petal[];
  grains: SandGrain[];
  links: { from: string; to: string }[];
  dust: Dust[];
}

/** Why a stone note was kept (`.mandala/carved.json`). */
export interface Carving {
  text: string;
  at: string;
}
