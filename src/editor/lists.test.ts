import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { moveItems, renumberLists } from './lists';

const move = (text: string, first: number, dir: 1 | -1, last = first) => {
  const lines = text.split('\n');
  const edits = moveItems(lines, first, last, dir);
  if (!edits) return null;
  // Apply from the end, so earlier columns stay put.
  for (const e of [...edits].sort((a, b) => b.line - a.line || b.from - a.from || b.to - a.to)) {
    lines[e.line] = lines[e.line].slice(0, e.from) + e.insert + lines[e.line].slice(e.to);
  }
  return lines.join('\n');
};

const state = (doc: string) => EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage }), renumberLists] });

/** Make one edit as the person would, and return the text after it. */
const edit = (doc: string, from: number, to: number, insert: string, userEvent = 'input.type') =>
  state(doc).update({ changes: { from, to, insert }, userEvent }).state.doc.toString();

describe('moveItems', () => {
  it('moves a bullet under the one before, with its children', () => {
    expect(move('- a\n- b\n  - b1\n- c', 1, 1)).toBe('- a\n  - b\n    - b1\n- c');
  });

  it('moves a numbered item under the text of the one before, and starts its list at 1', () => {
    expect(move('1. a\n2. b\n3. c', 1, 1)).toBe('1. a\n   1. b\n3. c');
    expect(move('10. a\n11. b', 1, 1)).toBe('10. a\n    1. b');
  });

  it('nests numbers under a bullet and bullets under a number', () => {
    expect(move('- a\n2. b', 1, 1)).toBe('- a\n  1. b');
    expect(move('1. a\n- b', 1, 1)).toBe('1. a\n   - b');
  });

  it('moves an item out to the level of the item above', () => {
    expect(move('1. a\n   1. x\n2. b', 1, -1)).toBe('1. a\n1. x\n2. b');
    expect(move('- a\n  - b\n    - c', 2, -1)).toBe('- a\n  - b\n  - c');
  });

  it('numbers from 1 the item left starting a list', () => {
    expect(move('1. a\n   1. x\n   2. y', 1, -1)).toBe('1. a\n1. x\n   1. y');
  });

  it('does nothing for the first item, or out from the top level', () => {
    expect(move('- a\n- b', 0, 1)).toBe('- a\n- b');
    expect(move('- a\n- b', 1, -1)).toBe('- a\n- b');
    expect(move('plain', 0, 1)).toBeNull();
  });
});

describe('renumberLists', () => {
  it('counts on after an item is put in', () => {
    // A third item typed between the first two.
    expect(edit('1. a\n2. b\n3. c', 4, 4, '\n2. new')).toBe('1. a\n2. new\n3. b\n4. c');
  });

  it('closes the gap when an item is taken out', () => {
    expect(edit('1. a\n2. b\n3. c\n4. d', 5, 10, '', 'delete')).toBe('1. a\n2. c\n3. d');
  });

  it('keeps the start when the first item is taken out', () => {
    expect(edit('1. a\n2. b\n3. c', 0, 5, '', 'delete')).toBe('1. b\n2. c');
    expect(edit('4. a\n5. b', 0, 5, '', 'delete')).toBe('4. b');
  });

  it('keeps a number just typed, and counts on from it', () => {
    expect(edit('1. a\n2. b\n3. c', 5, 6, '7')).toBe('1. a\n7. b\n8. c');
  });

  it('numbers each level on its own, in mixed lists', () => {
    const doc = '1. a\n   - x\n   - y\n2. b\n   1. p\n   2. q\n3. c';
    // Take out `   1. p`: the inner list still starts at 1, the outer list stays.
    expect(edit(doc, doc.indexOf('   1. p'), doc.indexOf('   2. q'), '', 'delete')).toBe('1. a\n   - x\n   - y\n2. b\n   1. q\n3. c');
    // Take out `2. b` with its list: the outer list closes up.
    expect(edit(doc, doc.indexOf('2. b'), doc.indexOf('3. c'), '', 'delete')).toBe('1. a\n   - x\n   - y\n2. c');
  });

  it('leaves code and notes that are only opened alone', () => {
    const code = '```\n1. a\n3. b\n```';
    expect(edit(code, 8, 8, 'x')).toBe('```\n1. ax\n3. b\n```');
    expect(state('1. a\n3. b').update({ changes: { from: 4, insert: 'x' } }).state.doc.toString()).toBe('1. ax\n3. b');
  });
});
