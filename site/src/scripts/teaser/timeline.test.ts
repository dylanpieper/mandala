import { describe, expect, it } from 'vitest';
import { TIMELINE, beat } from './timeline';

describe('the teaser loop', () => {
  it('runs in time order', () => {
    for (let i = 1; i < TIMELINE.length; i++) expect(TIMELINE[i].at).toBeGreaterThan(TIMELINE[i - 1].at);
  });
  it('restarts at 15.6 s', () => {
    expect(TIMELINE.at(-1)).toEqual({ at: 15600, do: 'restart' });
  });
  it('holds Let go before the page crumbles', () => {
    expect(beat('hold-let-go').at).toBeLessThan(beat('crumble-page').at);
    expect(beat('crumble-page').at - beat('hold-let-go').at).toBeGreaterThanOrEqual(1000);
  });
  it('glows for three seconds, then paints and sets, before the card closes', () => {
    expect(beat('card-closes').at - beat('ring-carves').at).toBe(3700);
  });
  it('keeps the poem first, then lets the mandala ideas go', () => {
    expect(beat('row-to-stone').at).toBeLessThan(beat('ideas-opens').at);
    expect(beat('hold-keep').at).toBeLessThan(beat('hold-let-go').at);
  });
  it('opens the keep card one held second after Set in stone', () => {
    expect(beat('card-opens').at - beat('hold-keep').at).toBe(1000);
  });
});

import { SAND, sorted } from './notes';
describe('the sand rail order', () => {
  it('puts breaths first, then the soonest to leave', () => {
    expect(sorted([...SAND].reverse()).map((n) => n.id)).toEqual(['list', 'movie', 'ideas', 'poem', 'dates']);
  });
});

describe("the owner's notes", () => {
  it('are titled as the owner keeps them', () => {
    expect(SAND.map((n) => n.title)).toEqual(['eggs and potatoes', 'movie to watch tonight', 'mandala ideas', 'Low tide', 'weekend date ideas']);
  });
});
