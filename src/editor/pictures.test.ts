import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { PICTURE, placeBlock, stampedName } from './pictures';

describe('pictures', () => {
  it('names a picture by when it was made', () => {
    expect(stampedName('Pasted', 'png', new Date(2026, 10, 1, 9, 5))).toBe('Pasted 2026-11-01 09.05.png');
  });

  it('knows a picture by its name', () => {
    for (const n of ['a.png', 'b.JPG', 'c.jpeg', 'd.gif', 'e.webp', 'Drawing 2026-11-01 09.05.svg']) expect(PICTURE.test(n)).toBe(true);
    for (const n of ['Note', 'Note.md', 'a.pdf', 'png']) expect(PICTURE.test(n)).toBe(false);
  });
});

describe('placeBlock', () => {
  const state = (doc: string) => EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });
  const place = (doc: string, at: number) => {
    const s = state(doc);
    const { from, insert, caret } = placeBlock(s, at, '![[Drawing.svg]]');
    const next = doc.slice(0, from) + insert + doc.slice(from);
    return { next, caret };
  };
  const tables = (doc: string) => {
    const s = state(doc);
    const found: string[] = [];
    syntaxTree(s).iterate({ enter: (n) => void (n.name === 'Table' && found.push(s.sliceDoc(n.from, n.to))) });
    return found;
  };
  const TABLE = '| a | b |\n| --- | --- |\n| 1 | 2 |';

  it('puts an embed after a note that ends in a table, outside the table', () => {
    const doc = `Intro\n\n${TABLE}`;
    const { next } = place(doc, doc.length);
    expect(next).toBe(`Intro\n\n${TABLE}\n\n![[Drawing.svg]]\n`);
    expect(tables(next)).toEqual([TABLE]);
  });

  it('moves a caret inside a table to after it', () => {
    const doc = `${TABLE}\n\nAfter`;
    const { next } = place(doc, doc.indexOf('1'));
    expect(next).toBe(`${TABLE}\n\n![[Drawing.svg]]\n\nAfter`);
    expect(tables(next)).toEqual([TABLE]);
  });

  it('keeps a blank line between an embed and a table below it', () => {
    const doc = `Intro\n${TABLE}`;
    const { next } = place(doc, 'Intro'.length);
    expect(next.startsWith('Intro\n\n![[Drawing.svg]]\n\n|')).toBe(true);
  });

  it('starts the note without a blank line, and leaves the caret after the embed', () => {
    const { next, caret } = place('', 0);
    expect(next).toBe('![[Drawing.svg]]\n');
    expect(caret).toBe(next.length);
  });

  it('splits a line with blank lines around the embed', () => {
    const { next } = place('one two', 3);
    expect(next).toBe('one\n\n![[Drawing.svg]]\n\n two');
  });
});
