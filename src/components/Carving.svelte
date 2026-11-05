<script lang="ts">
  // The carving: why a stone note is kept, in the note's header, after the
  // rune carved for it (`lib/rune.ts`). A faint chisel when nothing is carved.
  // Click to carve or re-carve; it saves on Enter or when the field loses
  // focus, Esc leaves it as it was.
  import { fade } from 'svelte/transition';
  import { api } from '../lib/api';
  import Icon from './Icon.svelte';
  import { runeOf, runeText } from '../lib/rune';

  let { rel }: { rel: string } = $props();

  let text = $state('');
  let draft = $state('');
  let editing = $state(false);
  let field = $state<HTMLTextAreaElement | null>(null);

  $effect(() => {
    const r = rel;
    editing = false;
    text = '';
    api.carving(r).then((c) => {
      if (r === rel) text = c?.text ?? '';
    });
  });

  function begin() {
    draft = text;
    editing = true;
    queueMicrotask(() => field?.focus());
  }

  async function save() {
    if (!editing) return;
    editing = false;
    if (draft.trim() === text) return;
    await api.carve(rel, draft);
    text = draft.trim();
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      editing = false;
    }
  }
</script>

<div class="carving" class:carved={!!text}>
  {#if editing}
    <Icon name="carve" />
    <textarea bind:this={field} bind:value={draft} class="serif" rows="1" placeholder="Why keep this one?" aria-label="Why this is kept" onblur={save} onkeydown={key} in:fade={{ duration: 160 }}></textarea>
  {:else}
    <button class="chisel" aria-label={text ? `Kept because: ${text}. Click to change.` : 'Carve why this is kept'} title={text ? '' : 'Carve why'} onclick={begin}>
      {#if text}
        <svg class="rune" width="16" height="16" viewBox="-12 -12 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          {#each runeOf(runeText(text, rel)) as d}<path {d} />{/each}
        </svg>
        <span class="serif why" in:fade={{ duration: 220 }}>{text}</span>
      {:else}
        <Icon name="carve" />
      {/if}
    </button>
  {/if}
</div>

<style>
  .carving {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--stone);
  }
  .chisel {
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    margin-left: -8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--dust);
    opacity: 0.6;
    text-align: left;
    transition:
      opacity var(--quick) var(--ease),
      color var(--quick) var(--ease),
      background var(--quick) var(--ease);
  }
  .carved .chisel {
    color: var(--stone);
    opacity: 1;
  }
  .chisel:hover,
  .chisel:focus-visible {
    opacity: 1;
    color: var(--stone);
    background: var(--hover);
  }
  .chisel :global(svg),
  .rune {
    flex: none;
  }
  .why {
    font-style: italic;
    font-size: 15px;
    color: var(--parchment);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  textarea {
    flex: 1;
    min-width: 0;
    resize: none;
    padding: 4px 0;
    border: 0;
    border-bottom: 1px solid var(--stone-line);
    background: transparent;
    color: var(--parchment);
    font-size: 15px;
    font-style: italic;
    outline: none;
  }
</style>
