import { describe, expect, it } from 'vitest';
import { linkQuery, rankTitles } from './wikilinks';

describe('linkQuery', () => {
  it('reads what is typed after [[', () => {
    expect(linkQuery('See [[Rai')).toEqual({ offset: 6, query: 'Rai' });
  });
  it('starts empty right after [[', () => {
    expect(linkQuery('[[')).toEqual({ offset: 2, query: '' });
  });
  it('works for an embed too', () => {
    expect(linkQuery('![[Wal')).toEqual({ offset: 3, query: 'Wal' });
  });
  it('is null once the link is closed, or past an alias', () => {
    expect(linkQuery('[[Rain]] and')).toBeNull();
    expect(linkQuery('[[Rain|wet')).toBeNull();
    expect(linkQuery('no link here')).toBeNull();
  });
});

describe('rankTitles', () => {
  const titles = ['Rain on the roof', 'Morning rain', 'Ryokan', 'rain', 'Brain'];
  it('puts titles that start with the query first, then words, then anywhere', () => {
    expect(rankTitles(titles, 'rain')).toEqual(['rain', 'Rain on the roof', 'Morning rain', 'Brain']);
  });
  it('lists every title, by name, for an empty query', () => {
    expect(rankTitles(titles, '')).toEqual(['Brain', 'Morning rain', 'rain', 'Rain on the roof', 'Ryokan']);
  });
  it('keeps one of each title', () => {
    expect(rankTitles(['A', 'A', 'B'], '')).toEqual(['A', 'B']);
  });
});
