import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

export const theme = EditorView.theme(
  {
    '&': { backgroundColor: 'transparent', color: 'var(--bone)', fontSize: '19px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--serif)', lineHeight: '1.65', overflow: 'visible' },
    '.cm-content': { padding: '0 0 96px', caretColor: 'var(--sand)' },
    '.cm-line': { padding: '0' },
    '.cm-cursor': { borderLeftColor: 'var(--sand)', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(217, 174, 108, 0.22) !important',
    },
    // `[[` autocomplete: a raised card of note titles, the chosen one in sand.
    '.cm-tooltip.cm-tooltip-autocomplete': {
      background: 'var(--raised)',
      border: '1px solid var(--line)',
      borderRadius: '10px',
      padding: '4px',
      boxShadow: '0 12px 32px rgb(0 0 0 / 0.35)',
    },
    '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--serif)', maxHeight: '15em', minWidth: '220px' },
    '.cm-tooltip-autocomplete > ul > li': { padding: '4px 10px', borderRadius: '6px', color: 'var(--ash)', lineHeight: '1.5' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { background: 'var(--sand-ground)', color: 'var(--sand)' },
    // Find in note: every match faintly, the current one plainly.
    '.cm-found': { background: 'var(--sand-ground)', borderRadius: '2px' },
    '.cm-found-now': { background: 'var(--sand-line)', color: 'var(--bone)' },
    '.cm-h': { fontWeight: '500', letterSpacing: '-0.01em', lineHeight: '1.25' },
    '.cm-h1': { fontSize: '40px', padding: '0 0 10px' },
    '.cm-h2': { fontSize: '28px', padding: '18px 0 6px' },
    '.cm-h3': { fontSize: '22px', padding: '14px 0 4px' },
    '.cm-h4, .cm-h5, .cm-h6': { fontSize: '19px', fontWeight: '600' },
    '.cm-strong': { fontWeight: '600' },
    '.cm-em': { fontStyle: 'italic' },
    '.cm-strike, .cm-done': { textDecoration: 'line-through', color: 'var(--dust)' },
    '.cm-inline-code': { fontFamily: 'var(--mono)', fontSize: '0.82em', background: 'var(--raised)', borderRadius: '4px', padding: '1px 4px' },
    '.cm-link, .cm-wikilink': { color: 'var(--sand)', textDecoration: 'underline dotted', textUnderlineOffset: '4px', cursor: 'pointer' },
    '.cm-quote': { borderLeft: '1px solid var(--line-strong)', paddingLeft: '20px !important', color: 'var(--parchment)', fontStyle: 'italic' },
    // Fenced code: one raised block, mono, a little smaller than the text.
    '.cm-codeblock': { fontFamily: 'var(--mono)', fontSize: '0.78em', lineHeight: '1.6', background: 'var(--raised)', padding: '0 16px !important' },
    '.cm-code-first': { borderRadius: '8px 8px 0 0', paddingTop: '8px !important' },
    '.cm-code-last': { borderRadius: '0 0 8px 8px', paddingBottom: '8px !important' },
    '.cm-fence': { color: 'var(--dust)' },
    // Tables, drawn (`tables.ts`).
    '.cm-table': { margin: '10px 0', padding: '0 22px 22px 0', position: 'relative', width: 'fit-content', maxWidth: '100%', overflowX: 'auto' },
    // The cell being written in: a frame inside it, clear of the shared borders, the same on all four sides.
    '.cm-table th:focus::after, .cm-table td:focus::after': {
      content: '""', position: 'absolute', inset: '2px', border: '1px solid var(--sand-line)', borderRadius: '3px', pointerEvents: 'none',
    },
    // Add a column (right) or a row (below): faint until the table is hovered.
    '.cm-table-add': {
      position: 'absolute', width: '18px', height: '18px', padding: '0', border: '0', borderRadius: '9px',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--dust)',
      opacity: '0', transition: 'opacity var(--quick) var(--ease), background var(--quick) var(--ease)', cursor: 'pointer',
    },
    '.cm-table:hover .cm-table-add, .cm-table:focus-within .cm-table-add': { opacity: '1' },
    '.cm-table-add:hover': { background: 'var(--hover)', color: 'var(--bone)' },
    '.cm-table-add.col': { right: '0', top: '6px' },
    '.cm-table-add.row': { left: '6px', bottom: '0' },
    '.cm-table table': { borderCollapse: 'collapse', fontSize: '0.86em', lineHeight: '1.5' },
    // One rule for every cell: the key must not repeat, or the later one replaces it.
    '.cm-table th, .cm-table td': {
      position: 'relative', minWidth: '3em', border: '1px solid var(--line)', padding: '6px 12px', textAlign: 'left', verticalAlign: 'top',
      outline: 'none', cursor: 'text', caretColor: 'var(--sand)',
    },
    '.cm-table th': { color: 'var(--bone)', fontWeight: '600', background: 'var(--raised)' },
    '.cm-table td': { color: 'var(--parchment)' },
    '.cm-hr': { color: 'var(--dust)', textAlign: 'center' },
    '.cm-picture': { display: 'block', width: 'fit-content', maxWidth: '100%', position: 'relative', margin: '10px 0', lineHeight: '0' },
    '.cm-picture img': { maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', opacity: '0', transition: 'opacity 320ms cubic-bezier(0.22, 1, 0.36, 1)' },
    '.cm-picture.loaded img': { opacity: '1' },
    '.cm-picture.missing': { lineHeight: '1.65', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--dust)' },
    '.cm-drawing': { cursor: 'pointer' },
    '.cm-drawing img': { background: 'var(--raised)', border: '1px solid var(--line)' },
    '.cm-drawing:hover img': { borderColor: 'var(--line-strong)' },
    // The trash on a picture: hidden until the pointer is on the picture; fills while held.
    '.cm-picture-remove': {
      position: 'absolute', top: '8px', right: '8px', height: '26px', padding: '0 10px', gap: '6px', border: '1px solid var(--line)', borderRadius: '999px',
      background: 'rgb(20 19 23 / 0.82)', color: 'var(--sand)', font: '12px var(--sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden',
      opacity: '0', transition: 'opacity 160ms cubic-bezier(0.22, 1, 0.36, 1), color 160ms cubic-bezier(0.22, 1, 0.36, 1)',
    },
    '.cm-picture:hover .cm-picture-remove, .cm-picture-remove:focus-visible': { opacity: '1' },
    '.cm-picture-remove:hover': { color: 'var(--bone)' },
    '.cm-picture-remove::before': {
      content: '""', position: 'absolute', inset: '0', background: 'rgb(217 101 63 / 0.35)', transform: 'scaleX(0)', transformOrigin: 'left', transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)',
    },
    '.cm-picture-remove.holding::before': { transform: 'scaleX(1)', transition: 'transform 1000ms linear' },
    '.cm-picture-remove svg, .cm-picture-remove span': { position: 'relative' },
    '.cm-task': { accentColor: 'var(--sand)', width: '16px', height: '16px', margin: '0 10px 0 0', verticalAlign: '-2px', cursor: 'pointer' },
  },
  { dark: true },
);

export const highlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.processingInstruction, color: 'var(--dust)' },
    { tag: t.meta, color: 'var(--dust)' },
    { tag: t.url, color: 'var(--dust)' },
    { tag: t.monospace, fontFamily: 'var(--mono)' },
    { tag: t.heading, color: 'var(--bone)' },
    // Code, in the app's own colors: few, and quiet.
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword, t.operatorKeyword], color: 'var(--stone)' },
    { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--sand)' },
    { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--vermilion)' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--dust)', fontStyle: 'italic' },
    { tag: [t.typeName, t.className, t.namespace], color: 'var(--stone)' },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.variableName)], color: 'var(--bone)' },
    { tag: [t.propertyName, t.attributeName], color: 'var(--parchment)' },
    { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--ash)' },
  ]),
);
