<script lang="ts">
  // The menu behind ☰, at the right of the title bar: every shortcut as an item to
  // click. Nothing else: the controls show what to hold or drag.
  import { fly } from 'svelte/transition';
  import { hold } from '../lib/hold';
  import { MENU, type MenuAction, type MenuItem } from '../lib/menu';
  import Icon from './Icon.svelte';

  let { run, enabled }: { run: (action: MenuAction) => void; enabled: (action: MenuAction) => boolean } = $props();

  let open = $state(false);
  let root: HTMLDivElement;
  let list = $state<HTMLDivElement | undefined>();

  /** A held item acts only after a full hold; the rest on a click. */
  function holdIf(node: HTMLElement, item: MenuItem) {
    return item.hold ? hold(node, { done: () => choose(item.action) }) : undefined;
  }

  function choose(action: MenuAction) {
    open = false;
    run(action);
  }

  function outside(e: PointerEvent) {
    if (open && !root.contains(e.target as Node)) open = false;
  }

  /** Esc closes; ↑ and ↓ move between the items that can act. */
  function keys(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      open = false;
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...(list?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    if (!items.length) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = at < 0 ? (e.key === 'ArrowDown' ? 0 : items.length - 1) : (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }
</script>

<svelte:window onpointerdown={outside} onkeydowncapture={keys} />

<div class="menu" bind:this={root}>
  <button class="pane" aria-label="Menu" aria-haspopup="menu" aria-expanded={open} title="Menu" onclick={() => (open = !open)}><Icon name="menu" /></button>
  {#if open}
    <div class="card" data-tauri-drag-region="false" transition:fly={{ y: -6, duration: 220 }}>
      <div class="groups" role="menu" aria-label="Menu" bind:this={list}>
        {#each MENU as { group, items }}
          <div class="group" role="group" aria-label={group}>
            <span class="eyebrow">{group}</span>
            {#each items as item}
              {#if item.hold}
                <button role="menuitem" class="held-item {item.hold}" aria-label="Hold to {item.label.toLowerCase()}" disabled={!enabled(item.action)} use:holdIf={item}>{item.label}<span class="mono key">{item.keys}</span></button>
              {:else}
                <button role="menuitem" disabled={!enabled(item.action)} onclick={() => choose(item.action)}>{item.label}<span class="mono key">{item.keys}</span></button>
              {/if}
            {/each}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
  }
  .pane {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--ash);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background var(--quick) var(--ease),
      color var(--quick) var(--ease);
  }
  .pane:hover,
  .pane[aria-expanded='true'] {
    background: var(--hover);
    color: var(--bone);
  }
  .card {
    position: absolute;
    top: 36px;
    right: 0;
    z-index: 20;
    width: 300px;
    max-height: calc(100vh - 60px);
    overflow-y: auto;
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
  }
  .groups {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .group {
    display: flex;
    flex-direction: column;
  }
  .eyebrow {
    padding: 6px 10px 4px;
  }
  button[role='menuitem'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    width: 100%;
    padding: 5px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--bone);
    font-size: 12px;
    text-align: left;
    transition: background var(--quick) var(--ease);
  }
  button[role='menuitem']:hover:not(:disabled),
  button[role='menuitem']:focus-visible {
    background: var(--hover);
    outline: none;
  }
  button[role='menuitem']:disabled {
    color: var(--dust);
  }
  /* Held items wear the color of what they do; the hold fills in it. */
  .held-item.sand {
    color: var(--sand);
  }
  .held-item.stone {
    color: var(--stone);
  }
  .held-item.vermilion {
    color: var(--vermilion);
  }
  .held-item:disabled {
    color: var(--dust);
  }
  .key {
    color: var(--dust);
    font-size: 11px;
  }
</style>
