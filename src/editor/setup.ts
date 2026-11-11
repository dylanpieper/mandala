import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { languages } from '@codemirror/language-data';
import { findField } from './find';
import { formatKeys } from './format';
import { tables } from './tables';
import { listKeys, lists } from './lists';
import { livePreview, onFollowLink } from './livePreview';
import { onOpenDrawing, onRemovePicture, pictureEvents } from './pictures';
import { highlight, theme } from './theme';
import { noteTitles, wikilinkComplete } from './wikilinks';

export interface EditorHandle {
  view: EditorView;
  /** Replace the text without it counting as an edit (a note opened). */
  load(text: string): void;
  /** Source view (⌘/): the raw markdown, every mark shown, tables and pictures as text. Off is live preview. */
  setSource(on: boolean): void;
  destroy(): void;
}

export function createEditor(
  parent: HTMLElement,
  options: { text: string; noteTitles: () => string[]; onExitTop: () => void; onChange: (text: string) => void; onFollowLink: (target: string) => void; onOpenDrawing: (name: string) => void; onRemovePicture: (name: string) => void },
): EditorHandle {
  let loading = false;
  // Live preview and drawn tables sit in one compartment, so source view can take them out.
  const preview = new Compartment();
  const live = [tables, livePreview];
  let source = false;
  const showMode = () => view.dispatch({ effects: preview.reconfigure(source ? [] : live) });

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: options.text,
      extensions: [
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
        // Formatting first. ⌘[ and ⌘] are the rails, ⌘I italic and ⌘/ source view, so their defaults (indent, select syntax, comment) are left out; Tab indents.
        keymap.of(formatKeys),
        // On a list item, Tab and Shift+Tab move it a level; elsewhere they indent as before.
        keymap.of(listKeys),
        keymap.of([...defaultKeymap.filter((k) => !['Mod-[', 'Mod-]', 'Mod-i', 'Mod-/'].includes(k.key ?? '')), ...historyKeymap, indentWithTab]),
        // Fenced code is highlighted by its language, each loaded from the bundle when first used.
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        preview.of(live),
        lists,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': 'Note', spellcheck: 'true' }),
        theme,
        highlight,
        findField,
        wikilinkComplete,
        noteTitles.of(options.noteTitles),
        onFollowLink.of(options.onFollowLink),
        onOpenDrawing.of(options.onOpenDrawing),
        onRemovePicture.of(options.onRemovePicture),
        pictureEvents,
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !loading) options.onChange(u.state.doc.toString());
        }),
      ],
    }),
  });

  return {
    view,
    load(text) {
      loading = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: 0 } });
      loading = false;
      // The mode belongs to the window, not the note: a note opens in it.
      showMode();
    },
    setSource(on) {
      source = on;
      showMode();
    },
    destroy() {
      view.destroy();
    },
  };
}
