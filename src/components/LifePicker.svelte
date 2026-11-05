<script lang="ts">
  // The lifespan for new sand, picked from the keyboard: ⌘N shows this card
  // on a breath, each ⌘N again moves one lifespan longer (and round), and
  // letting go of ⌘ makes the note. Esc puts the card away.
  import { fade, fly } from 'svelte/transition';
  import type { Life } from '../lib/types';
  import Icon from './Icon.svelte';

  let { life }: { life: Life } = $props();

  const LIVES: { life: Life; name: string; time: string; tone: string }[] = [
    { life: 'breath', name: 'Breath', time: '', tone: 'breath' },
    { life: 'sun', name: 'Sun', time: '24h', tone: 'sun' },
    { life: 'quarter', name: 'Quarter', time: '7d', tone: 'moon' },
    { life: 'half', name: 'Half', time: '15d', tone: 'moon' },
    { life: 'full', name: 'Full', time: '29d', tone: 'moon' },
  ];
</script>

<div class="veil" transition:fade={{ duration: 160 }}>
  <div class="card" role="listbox" aria-label="Lifespan for new sand" transition:fly={{ y: 6, duration: 200 }}>
    {#each LIVES as l (l.life)}
      <div class="life" class:on={l.life === life} role="option" aria-selected={l.life === life}>
        <span class="icon" style="color: var(--life-{l.tone})"><Icon name={l.life} size={22} /></span>
        <span class="name">{l.name}</span>
        <span class="mono time">{l.time}</span>
      </div>
    {/each}
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
    pointer-events: none;
  }
  .card {
    display: flex;
    gap: 6px;
    padding: 10px;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.45);
  }
  .life {
    width: 84px;
    padding: 14px 8px 10px;
    border: 1px solid transparent;
    border-radius: 12px;
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
  .life.on {
    background: var(--hover);
    border-color: var(--line-strong);
    color: var(--bone);
  }
  .icon {
    display: inline-flex;
    opacity: 0.6;
    transition: opacity var(--quick) var(--ease);
  }
  .life.on .icon {
    opacity: 1;
  }
  .name {
    font-size: 13px;
  }
  .time {
    min-height: 14px;
    font-size: 11px;
    color: var(--dust);
  }
</style>
