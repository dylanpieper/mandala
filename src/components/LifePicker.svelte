<script lang="ts">
  // Choose a lifespan: for new sand (⌘N), or for a stone note dropped on the
  // sand rail. Nothing is chosen at first. A held press (pointer, or Enter on
  // the focused one), or a number key (1 to 5), chooses one; Esc or a click
  // outside puts the card away.
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { LIVES } from '../lib/lives';
  import { hold } from '../lib/hold';
  import type { Life } from '../lib/types';
  import Icon from './Icon.svelte';

  // `numbered`: the keys 1 to 5 choose, and each lifespan shows its number (for ⌘N only).
  let { heading, numbered = false, onPick, onCancel }: { heading: string; numbered?: boolean; onPick: (life: Life) => void; onCancel: () => void } = $props();

  let card = $state<HTMLElement | undefined>();
  const buttons = () => [...(card?.querySelectorAll<HTMLButtonElement>('button.life') ?? [])];

  onMount(() => card?.focus());

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }
    const n = Number(e.key);
    if (numbered && n >= 1 && n <= LIVES.length && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      onPick(LIVES[n - 1].life);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const all = buttons();
      const at = all.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const next = at < 0 ? (step > 0 ? 0 : all.length - 1) : (at + step + all.length) % all.length;
      all[next]?.focus();
    }
  }
</script>

<!-- The card takes every key while it is open, so the window's own keys wait. -->
<div class="veil" transition:fade={{ duration: 160 }} onpointerdown={(e) => e.target === e.currentTarget && onCancel()} role="presentation">
  <div class="card" bind:this={card} role="dialog" aria-modal="true" aria-label={heading} tabindex="-1" onkeydown={onKey} transition:fly={{ y: 6, duration: 200 }}>
    <h2 class="eyebrow">{heading}</h2>
    <div class="lives">
      {#each LIVES as l, i (l.life)}
        <button class="life" aria-label="Hold for {l.name}, {l.long}" style="--tone: var(--life-{l.tone})" use:hold={{ done: () => onPick(l.life) }}>
          <span class="icon" style="color: var(--life-{l.tone})"><Icon name={l.life} size={22} /></span>
          <span class="name">{l.name}</span>
          <span class="mono time">{l.time}</span>
          {#if numbered}<span class="mono num" aria-hidden="true">{i + 1}</span>{/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .veil {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(10 9 12 / 0.55);
    backdrop-filter: blur(6px);
  }
  .card {
    padding: 16px 12px 12px;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.45);
    outline: none;
  }
  h2 {
    margin: 0 0 12px;
    text-align: center;
  }
  .lives {
    display: flex;
    gap: 6px;
  }
  .life {
    width: 84px;
    padding: 14px 8px 8px;
    border: 1px solid transparent;
    border-radius: 12px;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: var(--ash);
    transition:
      background var(--quick) var(--ease),
      border-color var(--quick) var(--ease),
      color var(--quick) var(--ease);
  }
  .life:hover,
  .life:focus-visible {
    background: var(--hover);
    border-color: var(--line-strong);
    color: var(--bone);
    outline: none;
  }
  /* The held press fills in the lifespan's own color. */
  .life:global(.holdable)::before {
    background: var(--tone);
  }
  .icon {
    display: inline-flex;
    opacity: 0.7;
    transition: opacity var(--quick) var(--ease);
  }
  .life:hover .icon,
  .life:focus-visible .icon {
    opacity: 1;
  }
  .name {
    font-size: 13px;
  }
  .time,
  .num {
    min-height: 14px;
    font-size: 11px;
    color: var(--dust);
  }
  .num {
    opacity: 0.6;
  }
</style>
