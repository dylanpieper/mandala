<script lang="ts">
  // ⌘P. Finds notes, and notes let go of in the last day, which can be
  // restored from here. There is no trash to browse: what is gone is found
  // only by looking for it.
  import { fade, fly } from 'svelte/transition';
  import { api } from '../lib/api';
  import type { Hit } from '../lib/types';
  import Icon from './Icon.svelte';
  import LifeMark from './LifeMark.svelte';
  import { placeOf } from '../lib/place';

  let { onOpen, onClose }: { onOpen: (rel: string) => void; onClose: () => void } = $props();

  let query = $state('');
  let hits = $state<Hit[]>([]);
  let input: HTMLInputElement;

  $effect(() => {
    const q = query;
    const timer = setTimeout(async () => (hits = await api.search(q)), 120);
    return () => clearTimeout(timer);
  });

  $effect(() => input?.focus());

  async function restore(id: string) {
    const rel = await api.restore(id);
    onOpen(rel);
  }
</script>

<!-- Where the note lies: stone, or sand with its lifespan. Nothing for a note outside the mandala. -->
{#snippet tag(rel: string)}
  {@const place = placeOf(rel)}
  {#if place?.kind === 'stone'}
    <span class="tag stone"><Icon name="stone" size={12} />Stone</span>
  {:else if place?.kind === 'sand'}
    <span class="tag sand"><LifeMark life={place.life} size={12} />Sand</span>
  {/if}
{/snippet}

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<div class="scrim" transition:fade={{ duration: 180 }} onclick={onClose} role="presentation">
  <div class="panel" role="dialog" aria-label="Search" tabindex="-1" transition:fly={{ y: -8, duration: 260 }} onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
    <label class="field">
      <Icon name="search" />
      <span class="sr-only">Search notes</span>
      <input bind:this={input} bind:value={query} placeholder="Search" />
    </label>
    {#if hits.length}
      <ul>
        {#each hits as h (h.rel + (h.settled ?? ''))}
          <li class:gone={h.settled}>
            {#if h.settled}
              <div class="hit">
                <span class="top"><span class="title">{h.title}</span>{@render tag(h.rel)}</span>
                <span class="line">{h.line}</span>
              </div>
              <button class="pill sand" onclick={() => restore(h.settled!)}><Icon name="restore" />Restore</button>
            {:else}
              <button class="hit open" onclick={() => onOpen(h.rel)}>
                <span class="top"><span class="title">{h.title}</span>{@render tag(h.rel)}</span>
                <span class="line">{h.line}</span>
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(14, 13, 16, 0.6);
    display: flex;
    justify-content: center;
    padding: 96px 24px;
    z-index: 10;
  }
  .panel {
    width: 100%;
    max-width: 620px;
    height: fit-content;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 16px;
    overflow: hidden;
  }
  .field {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 18px;
    color: var(--ash);
  }
  input {
    flex: 1;
    height: 54px;
    border: 0;
    background: transparent;
    font-size: 16px;
    outline: none;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 6px;
    border-top: 1px solid var(--line);
    max-height: 50vh;
    overflow-y: auto;
  }
  li {
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 10px;
  }
  .hit {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 12px;
    text-align: left;
    border: 0;
    background: transparent;
  }
  .open:hover {
    background: var(--hover);
    border-radius: 10px;
  }
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .title {
    min-width: 0;
    font-family: var(--serif);
    font-size: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Stone or sand, small and quiet, in its own color. */
  .tag {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tag.stone {
    color: var(--stone);
  }
  .tag.sand {
    color: var(--sand);
  }
  .line {
    color: var(--ash);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gone {
    opacity: 0.6;
    padding-right: 8px;
  }
  .gone:hover {
    opacity: 1;
  }
</style>
