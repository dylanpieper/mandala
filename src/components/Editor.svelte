<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { createEditor, type EditorHandle } from '../editor/setup';
  import { pictureChanged } from '../editor/pictures';
  import { endFind, find as findIn, findCount, step } from '../editor/find';
  import { insertTable } from '../editor/tables';

  let {
    rel,
    text,
    titles,
    onChange,
    onFollowLink,
    onOpenDrawing,
    onRemovePicture,
    onExitTop,
  }: {
    rel: string;
    text: string;
    /** The vault's note titles, for `[[` autocomplete. */
    titles: string[];
    onChange: (text: string) => void;
    onFollowLink: (target: string) => void;
    onOpenDrawing: (name: string) => void;
    onRemovePicture: (name: string) => void;
    /** Up or Backspace at the very top: back to the title. */
    onExitTop: () => void;
  } = $props();

  let host: HTMLDivElement;
  let editor: EditorHandle | undefined;
  let loadedRel = '';

  onMount(() => {
    editor = createEditor(host, { text, noteTitles: () => titles, onExitTop: () => onExitTop(), onChange: (t) => onChange(t), onFollowLink: (t) => onFollowLink(t), onOpenDrawing: (n) => onOpenDrawing(n), onRemovePicture: (n) => onRemovePicture(n) });
    loadedRel = rel;
  });

  // A different note opened: load it without counting as an edit.
  $effect(() => {
    if (editor && rel !== loadedRel) {
      editor.load(text);
      loadedRel = rel;
    }
  });

  onDestroy(() => editor?.destroy());

  /** Put `![[name]]` on a line of its own at the caret (or the end). */
  export function embed(name: string) {
    const view = editor?.view;
    if (!view) return;
    const at = view.hasFocus ? view.state.selection.main.head : view.state.doc.length;
    const line = view.state.doc.lineAt(at);
    const before = at === line.from ? '' : '\n';
    const insert = `${before}![[${name}]]\n`;
    view.dispatch({ changes: { from: at, insert }, selection: { anchor: at + insert.length } });
  }

  /** Take every embed of picture `name` out of the note, and a line it leaves empty. */
  export function unembed(name: string) {
    const view = editor?.view;
    if (!view) return;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const embed = new RegExp(`!\\[\\[${esc}(\\|[^\\]]*)?\\]\\]|!\\[[^\\]]*\\]\\([^)]*${esc.replace(/ /g, '(?: |%20)')}\\)`, 'g');
    const doc = view.state.doc.toString();
    const lines: string[] = [];
    for (const line of doc.split('\n')) {
      const left = line.replace(embed, '');
      // A line that held only the embed goes with it.
      if (left === line) lines.push(line);
      else if (left.trim()) lines.push(left.trimEnd());
    }
    const next = lines.join('\n');
    if (next !== doc) view.dispatch({ changes: { from: 0, to: doc.length, insert: next } });
  }

  /** Find in note: mark `query`, and say how many and which is current. */
  export function find(query: string) {
    if (!editor) return { at: 0, of: 0 };
    findIn(editor.view, query);
    return findCount(editor.view.state);
  }
  export function findStep(by: 1 | -1) {
    if (!editor) return { at: 0, of: 0 };
    step(editor.view, by);
    return findCount(editor.view.state);
  }
  /** Stop finding; with `select`, the current match is selected and the editor focused. */
  export function findEnd(select: boolean) {
    if (!editor) return;
    endFind(editor.view, select);
    if (select) editor.view.focus();
  }
  /** Put an empty table at the caret (`editor/tables.ts`). */
  export function table(cols: number, rows: number) {
    if (editor) insertTable(editor.view, cols, rows);
  }

  /** The selected text, to start a find with. */
  export function selection() {
    const view = editor?.view;
    if (!view) return '';
    const { from, to } = view.state.selection.main;
    return view.state.sliceDoc(from, to).split('\n')[0];
  }

  /** From the title into the body: the caret at its start. */
  export function focusStart() {
    if (!editor) return;
    editor.view.focus();
    editor.view.dispatch({ selection: { anchor: 0 }, scrollIntoView: true });
  }

  /** The open note was renamed: the same text under a new path, so nothing is loaded again. */
  export function renamed(to: string) {
    loadedRel = to;
  }

  /** A picture changed on disk: draw it again. */
  export function changed(name: string) {
    pictureChanged(editor?.view, name);
  }
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor {
    width: 100%;
  }
</style>
