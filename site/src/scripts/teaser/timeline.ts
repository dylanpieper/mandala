// The teaser's loop, in ms from its start: a poem is kept, then a note is let
// go and another runs out, each on its own. True to the app as it is now:
// sand lets go when its time runs out or Let go is held; keeping opens the
// card, where the rune glows in and is painted on; the rails never get sand.

export type Action =
  | 'type-poem'
  | 'time-runs'
  | 'ideas-opens'
  | 'hold-let-go'
  | 'crumble-page'
  | 'rows-close'
  | 'movie-runs-out'
  | 'hold-keep'
  | 'card-opens'
  | 'ring-carves'
  | 'card-closes'
  | 'row-to-stone'
  | 'fade-out'
  | 'restart';

export interface Beat {
  at: number;
  do: Action;
}

export const TIMELINE: Beat[] = [
  { at: 0, do: 'type-poem' },
  { at: 1600, do: 'time-runs' },
  { at: 2000, do: 'hold-keep' },
  { at: 3000, do: 'card-opens' },
  { at: 3600, do: 'ring-carves' },
  { at: 7300, do: 'card-closes' },
  { at: 7600, do: 'row-to-stone' },
  { at: 9000, do: 'ideas-opens' },
  { at: 9600, do: 'hold-let-go' },
  { at: 10600, do: 'crumble-page' },
  { at: 12100, do: 'rows-close' },
  { at: 12800, do: 'movie-runs-out' },
  { at: 13400, do: 'rows-close' },
  { at: 14800, do: 'fade-out' },
  { at: 15600, do: 'restart' },
];

export function beat(action: Action): Beat {
  const b = TIMELINE.find((t) => t.do === action);
  if (!b) throw new Error(`No beat ${action}`);
  return b;
}
