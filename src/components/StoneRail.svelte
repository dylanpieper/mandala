<script lang="ts">
  import { flip } from 'svelte/animate';
  import { slide } from 'svelte/transition';
  import { draggable, droppable, type DropInfo, type Lifted } from '../lib/drag.svelte';
  import Icon from './Icon.svelte';
  import type { Note } from '../lib/types';
  import { reveal } from '../lib/reveal';
  import { untrack } from 'svelte';

  let {
    notes,
    folders,
    selected,
    onOpen,
    onPlace,
    onKeepInto,
    onCombine,
  }: {
    notes: Note[];
    /** Folders directly in stone/, empty ones included. */
    folders: string[];
    selected: string | null;
    onOpen: (rel: string) => void;
    /** A stone note dropped in `folder`, before or after `target` (or at the end). */
    onPlace: (rel: string, folder: string, target: string | null, after: boolean) => void;
    /** A sand note dropped on stone: begin keeping it, into `folder`. */
    onKeepInto: (rel: string, folder: string) => void;
    /** A note held on another note and dropped: combine `dragged` into `into`. */
    onCombine: (into: string, dragged: string) => void;
  } = $props();

  const groupOf = (rel: string) => {
    const parts = rel.split('/');
    return parts.length > 2 ? parts[1] : '';
  };

  function dropIn(folder: string, target: string | null) {
    return {
      accepts: (item: Lifted) => item.rel !== target,
      // Resting on a note (not a folder) combines the two.
      onto: target !== null,
      drop: (item: Lifted, { after, onto }: DropInfo) => {
        if (onto && target) onCombine(target, item.rel);
        else if (item.kind === 'stone') onPlace(item.rel, folder, target, after);
        else onKeepInto(item.rel, folder);
      },
    };
  }

  // Grouped by the first folder under stone/.
  const groups = $derived.by(() => {
    const map = new Map<string, Note[]>(folders.map((f) => [f, []]));
    for (const n of notes) {
      const parts = n.rel.split('/');
      const group = parts.length > 2 ? parts[1] : '';
      map.set(group, [...(map.get(group) ?? []), n]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  });

  // Folders the person closed. A preference of this Mac's window, not of the
  // vault, so it lives in localStorage and never syncs.
  const KEY = 'mandala.stone.closed';
  let closed = $state<string[]>(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  $effect(() => localStorage.setItem(KEY, JSON.stringify(closed)));
  const named = $derived(groups.map(([g]) => g).filter(Boolean));
  const isClosed = (folder: string) => closed.includes(folder);
  const toggle = (folder: string) => (closed = isClosed(folder) ? closed.filter((f) => f !== folder) : [...closed, folder]);
  const allClosed = $derived(named.length > 0 && named.every(isClosed));
  const noneClosed = $derived(!named.some(isClosed));

  // The open note is found in the rail: its folder opens if closed, and its row comes into view.
  let rail = $state<HTMLElement | undefined>();
  $effect(() => {
    const rel = selected;
    if (!rel?.startsWith('stone/')) return;
    const group = groupOf(rel);
    const opened = !!group && untrack(() => isClosed(group));
    if (opened) closed = untrack(() => closed.filter((f) => f !== group));
    // After the folder has opened (its slide is 220 ms) and the row is drawn.
    const wait = opened ? 240 : 0;
    const id = setTimeout(() => requestAnimationFrame(() => reveal(rail, rel, opened)), wait);
    return () => clearTimeout(id);
  });
</script>

<nav class="rail" bind:this={rail} aria-label="Stone, kept notes" use:droppable={{ accepts: (item) => item.kind === 'sand', drop: (item) => onKeepInto(item.rel, '') }}>
  <header>
    <div class="name"><span class="stone-mark"><Icon name="stone" size={15} /></span><h2>Stone</h2></div>
    <div class="end">
      <span class="mono count">{notes.length} kept</span>
      {#if named.length}
        <button class="all" aria-label="Collapse all folders" title="Collapse all" disabled={allClosed} onclick={() => (closed = [...named])}><Icon name="collapse" size={15} /></button>
        <button class="all" aria-label="Expand all folders" title="Expand all" disabled={noneClosed} onclick={() => (closed = [])}><Icon name="expand" size={15} /></button>
      {/if}
    </div>
  </header>
  <div class="groups">
    {#each groups as [group, items] (group)}
      <section class="group" use:droppable={dropIn(group, null)}>
        {#if group}
          <h3>
            <button class="folder" class:on={isClosed(group) && items.some((n) => n.rel === selected)} aria-expanded={!isClosed(group)} onclick={() => toggle(group)}>
              <span class="chev" class:shut={isClosed(group)}><Icon name="chevron" size={14} /></span>
              <span class="fname">{group}</span>
              {#if isClosed(group)}<span class="mono n" transition:slide={{ axis: 'x', duration: 160 }}>{items.length}</span>{/if}
            </button>
          </h3>
        {/if}
        {#if !group || !isClosed(group)}
          <div class="items" transition:slide={{ duration: 220 }}>
            {#each items as n (n.rel)}
              <button
                class="note"
                data-rel={n.rel}
                class:on={n.rel === selected}
                class:loose={!group}
                animate:flip={{ duration: 260 }}
                use:draggable={{ rel: n.rel, title: n.title, kind: 'stone' }}
                use:droppable={{ ...dropIn(groupOf(n.rel), n.rel), list: true }}
                onclick={() => onOpen(n.rel)}>{n.title}</button
              >
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</nav>

<style>
  .rail {
    width: 260px;
    flex-shrink: 0;
    padding: 20px 16px;
    border-right: 1px solid var(--line);
    --drop: var(--stone);
    background: var(--rail);
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .stone-mark {
    display: inline-flex;
    color: var(--stone);
    /* The stone is drawn low in its box (y 5 to 13 of 16): lift it to the letters. */
    transform: translateY(-1px);
  }
  h2 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--stone);
    /* Trimmed to the capitals, so the stone beside it centres on the letters. */
    text-box: trim-both cap alphabetic;
  }
  .count {
    font-size: 12px;
    color: var(--dust);
  }
  .groups {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .end {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .end .count {
    margin-right: 6px;
  }
  .all {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--dust);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: center;
    transition: background var(--quick) var(--ease), color var(--quick) var(--ease), opacity var(--quick) var(--ease);
  }
  .all:hover:not(:disabled) {
    background: var(--hover);
    color: var(--bone);
  }
  .all:disabled {
    opacity: 0.35;
    cursor: default;
  }
  section,
  .items {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 400;
  }
  .folder {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px 4px 4px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--ash);
    text-align: left;
    transition: background var(--quick) var(--ease), color var(--quick) var(--ease);
  }
  .folder:hover {
    background: var(--hover);
    color: var(--bone);
  }
  .folder.on {
    color: var(--stone);
  }
  .chev {
    display: inline-flex;
    color: var(--dust);
    transition: transform var(--settle) var(--ease);
  }
  .chev.shut {
    transform: rotate(-90deg);
  }
  .fname {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .n {
    font-size: 11px;
    color: var(--dust);
  }
  .note {
    text-align: left;
    border: 0;
    background: transparent;
    color: var(--bone);
    padding: 6px 8px 6px 22px;
    border-radius: 6px;
    transition: background var(--quick) var(--ease);
  }
  .note.loose {
    padding-left: 8px;
  }
  .note:hover {
    background: var(--hover);
  }
  .note.on {
    background: var(--stone-ground);
    color: var(--stone);
  }
</style>
