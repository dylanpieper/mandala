import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { languages } from '@codemirror/language-data';
import { findField } from './find';
import { NoteStates } from './history';
import { formatKeys } from './format';
import { tables } from './tables';
import { listKeys, lists } from './lists';
import { livePreview, onFollowLink } from './livePreview';
import { onOpenDrawing, onRemovePicture, pictureEvents } from './pictures';
import { highlight, theme } from './theme';
import { noteTitles, wikilinkComplete } from './wikilinks';

export interface EditorHandle {
  view: EditorView;
  /**
   * Show note `key` with `text`, without it counting as an edit. The note
   * left keeps its undo history for the visit, and gets it back when it opens
   * again with the same text (`history.ts`). ⌘Z never reaches another note.
   */
  load(key: string, text: string): void;
  /** The open note was renamed: its history follows it. */
  rekey(key: string): void;
  destroy(): void;
}

export function createEditor(
  parent: HTMLElement,
  options: { key: string; text: string; noteTitles: () => string[]; onExitTop: () => void; onChange: (text: string) => void; onFollowLink: (target: string) => void; onOpenDrawing: (name: string) => void; onRemovePicture: (name: string) => void },
): EditorHandle {
  const notes = new NoteStates();
  let key = options.key;
  const extensions = [
    history(),
    // Up from the first line, or Backspace at the very start, goes to the title above.
    keymap.of([
      {
        key: 'ArrowUp',
        run: (v) => {
          // Only from the top row: a long first line that wraps moves up within itself first.
          const at = v.coordsAtPos(v.state.selection.main.head);
          const top = v.coordsAtPos(0);
          if (!at || !top || at.top > top.top + 1) return false;
          options.onExitTop();
          return true;
        },
      },
      { key: 'Backspace', run: (v) => (v.state.selection.main.empty && v.state.selection.main.head === 0 ? (options.onExitTop(), true) : false) },
    ]),
    // Formatting first. ⌘[ and ⌘] are the rails, and ⌘I italic, so their defaults (indent, select syntax) are left out; Tab indents.
    keymap.of(formatKeys),
    // On a list item, Tab and Shift+Tab move it a level; elsewhere they indent as before.
    keymap.of(listKeys),
    keymap.of([...defaultKeymap.filter((k) => !['Mod-[', 'Mod-]', 'Mod-i'].includes(k.key ?? '')), ...historyKeymap, indentWithTab]),
    // Fenced code is highlighted by its language, each loaded from the bundle when first used.
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    tables,
    lists,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'Note', spellcheck: 'true' }),
    theme,
    highlight,
    livePreview,
    findField,
    wikilinkComplete,
    noteTitles.of(options.noteTitles),
    onFollowLink.of(options.onFollowLink),
    onOpenDrawing.of(options.onOpenDrawing),
    onRemovePicture.of(options.onRemovePicture),
    pictureEvents,
    // A new state (a note loaded) is not a transaction, so it never reaches here.
    EditorView.updateListener.of((u) => {
      if (u.docChanged) options.onChange(u.state.doc.toString());
    }),
  ];
  const fresh = (doc: string) => EditorState.create({ doc, extensions });

  const view = new EditorView({ parent, state: fresh(options.text) });

  return {
    view,
    load(next, text) {
      notes.keep(key, view.state);
      key = next;
      view.setState(notes.take(next, text) ?? fresh(text));
    },
    rekey(next) {
      key = next;
    },
    destroy() {
      view.destroy();
    },
  };
}
