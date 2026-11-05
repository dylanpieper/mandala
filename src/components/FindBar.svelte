<script lang="ts">
  // Find in note (⌘F): a small bar over the top of the page. Enter goes to
  // the next match, Shift+Enter to the one before; Esc closes it and leaves
  // the current match selected in the note. The matches live in the editor
  // (`editor/find.ts`).
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import Icon from './Icon.svelte';

  type Count = { at: number; of: number };
  let {
    start,
    onFind,
    onStep,
    onClose,
  }: { start: string; onFind: (q: string) => Count; onStep: (by: 1 | -1) => Count; onClose: (select: boolean) => void } = $props();

  let query = $state('');
  let count = $state<Count>({ at: 0, of: 0 });
  let field: HTMLInputElement;

  onMount(() => {
    query = start;
    if (query) count = onFind(query);
    field.focus();
    field.select();
  });

  /** ⌘F again while open: back to the field, its text selected. */
  export function refocus() {
    field.focus();
    field.select();
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      count = onStep(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
    }
  }
</script>

<!-- A dock of no height, so the page does not move when the bar opens. -->
<div class="dock">
<div class="find" role="search" transition:fly={{ y: -8, duration: 200 }}>
  <Icon name="search" />
  <input bind:this={field} bind:value={query} oninput={() => (count = onFind(query))} onkeydown={key} placeholder="Find in note" aria-label="Find in note" spellcheck="false" />
  <span class="mono count" class:none={!!query && !count.of} aria-live="polite">{query ? (count.of ? `${count.at} of ${count.of}` : 'None') : ''}</span>
  <button class="tool" aria-label="Previous match" title="Previous (Shift+Enter)" disabled={!count.of} onclick={() => (count = onStep(-1))}><Icon name="back" /></button>
  <button class="tool" aria-label="Next match" title="Next (Enter)" disabled={!count.of} onclick={() => (count = onStep(1))}><Icon name="next" /></button>
  <button class="tool" aria-label="Close find" title="Close (Esc)" onclick={() => onClose(false)}><Icon name="close" /></button>
</div>
</div>

<style>
  .dock {
    position: sticky;
    top: 0;
    z-index: 3;
    height: 0;
    align-self: stretch;
  }
  .find {
    position: absolute;
    top: -16px;
    right: -16px;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 4px 0 14px;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: var(--pill);
    color: var(--ash);
  }
  input {
    width: 200px;
    border: 0;
    background: transparent;
    color: var(--bone);
    font: inherit;
    outline: none;
  }
  .count {
    min-width: 56px;
    font-size: 12px;
    color: var(--dust);
    text-align: right;
  }
  .count.none {
    color: var(--vermilion);
  }
  .tool {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--ash);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background var(--quick) var(--ease),
      color var(--quick) var(--ease),
      opacity var(--quick) var(--ease);
  }
  .tool:hover:not(:disabled) {
    background: var(--hover);
    color: var(--bone);
  }
  .tool:disabled {
    opacity: 0.35;
  }
</style>
