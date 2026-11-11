// Each note keeps its own undo history for the visit. One editor shows every
// note, so the state it had on a note is put aside when another opens, and
// given back when that note opens again. If the note's text changed meanwhile
// (on the phone, say), its history no longer fits, and the note opens fresh.

import type { EditorState } from '@codemirror/state';

export class NoteStates {
  private states = new Map<string, EditorState>();

  /** Put aside the editor's state on note `key`. */
  keep(key: string, state: EditorState) {
    this.states.set(key, state);
  }

  /** The state put aside on `key`, if its text is still `text`; else null. */
  take(key: string, text: string): EditorState | null {
    const state = this.states.get(key);
    this.states.delete(key);
    return state && state.doc.toString() === text ? state : null;
  }
}
