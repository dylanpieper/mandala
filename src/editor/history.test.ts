import { describe, expect, it } from 'vitest';
import { history, undo, undoDepth } from '@codemirror/commands';
import { EditorState, type Transaction } from '@codemirror/state';
import { NoteStates } from './history';

const make = (doc: string) => EditorState.create({ doc, extensions: [history()] });

/** Run a command on a state, as a view would, and return the state after it. */
function run(state: EditorState, command: typeof undo): EditorState {
  let next = state;
  command({ state, dispatch: (tr: Transaction) => (next = tr.state) });
  return next;
}

function type(state: EditorState, text: string): EditorState {
  return state.update({ changes: { from: state.doc.length, insert: text } }).state;
}

describe('NoteStates', () => {
  it('gives back a note with its own undo history', () => {
    const notes = new NoteStates();
    const rain = type(make('Rain'), ' falls');
    notes.keep('rain.md', rain);
    const back = notes.take('rain.md', 'Rain falls')!;
    expect(undoDepth(back)).toBe(1);
    expect(run(back, undo).doc.toString()).toBe('Rain');
  });

  it('drops the history when the text changed elsewhere', () => {
    const notes = new NoteStates();
    notes.keep('rain.md', type(make('Rain'), ' falls'));
    expect(notes.take('rain.md', 'Rain falls on the phone')).toBeNull();
  });

  it('knows nothing of a note not kept', () => {
    expect(new NoteStates().take('rain.md', 'Rain')).toBeNull();
  });

  it('never undoes into another note', () => {
    // A fresh state for a newly opened note has nothing to undo, so ⌘Z cannot
    // bring back the text of the note open before it.
    const notes = new NoteStates();
    notes.keep('rain.md', type(make('Rain'), ' falls'));
    const sun = notes.take('sun.md', 'Sun') ?? make('Sun');
    expect(undoDepth(sun)).toBe(0);
    expect(run(sun, undo).doc.toString()).toBe('Sun');
  });
});
