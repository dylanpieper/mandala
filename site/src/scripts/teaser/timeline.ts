// The teaser's loop, in ms from its start: a poem is kept, then a note is let
// go and another runs out, each on its own. Last, the window closes, and the
// closing screen lets the breath go. In a narrow window the poem is written and
// kept on the page, then the rails show. True to the app as it is now: sand lets
// go when its time runs out or Let go is held; keeping opens the card, where
// the rune glows in and is painted on; the rails never get sand; closing lets
// the visit's breaths go with a held Close.

export type Action =
  | 'type-poem'
  | 'time-runs'
  | 'show-rails'
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
  | 'close-window'
  | 'hold-close'
  | 'breaths-leave'
  | 'restart';

export interface Beat {
  at: number;
  do: Action;
}

export const TIMELINE: Beat[] = [
  { at: 0, do: 'type-poem' },
  { at: 1600, do: 'time-runs' },
  { at: 2600, do: 'show-rails' },
  { at: 3200, do: 'hold-keep' },
  { at: 4200, do: 'card-opens' },
  { at: 4800, do: 'ring-carves' },
  { at: 8500, do: 'card-closes' },
  { at: 8800, do: 'row-to-stone' },
  { at: 10200, do: 'ideas-opens' },
  { at: 10800, do: 'hold-let-go' },
  { at: 11800, do: 'crumble-page' },
  { at: 13300, do: 'rows-close' },
  { at: 14000, do: 'movie-runs-out' },
  { at: 14600, do: 'rows-close' },
  { at: 16000, do: 'close-window' },
  { at: 17600, do: 'hold-close' },
  { at: 18600, do: 'breaths-leave' },
  { at: 19800, do: 'restart' },
];

export function beat(action: Action): Beat {
  const b = TIMELINE.find((t) => t.do === action);
  if (!b) throw new Error(`No beat ${action}`);
  return b;
}
