<script lang="ts">
  // ⌥⌘⌫ held: a card over the page shows what is about to happen, and its
  // Let go fills as the keys are held. Let the keys go early and it drains,
  // then fades. Nothing happens to the note until the fill is full.
  import { fade, scale } from 'svelte/transition';
  import { key } from '../lib/keys';
  import Icon from './Icon.svelte';

  let { title, progress }: { title: string; progress: number } = $props();
</script>

<div class="ground" transition:fade={{ duration: 160 }}>
  <div class="card" role="alertdialog" aria-modal="true" aria-label="Let go of {title}" transition:scale={{ start: 0.97, duration: 160 }}>
    <span class="serif title">{title}</span>
    <span class="pill holdable" style="--hold: {progress.toFixed(3)}"><Icon name="wind" />Let go</span>
    <span class="hint">Keep holding <span class="mono">{key('⌫', true)}</span></span>
  </div>
</div>

<style>
  .ground {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(14 13 16 / 0.55);
    backdrop-filter: blur(6px);
    pointer-events: none;
  }
  .card {
    min-width: 280px;
    max-width: min(420px, calc(100vw - 48px));
    padding: 24px 28px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 16px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
    text-align: center;
  }
  .title {
    font-size: 22px;
    color: var(--bone);
    overflow-wrap: anywhere;
  }
  .pill {
    color: var(--vermilion);
    border-color: var(--line);
  }
  .hint {
    font-size: 12px;
    color: var(--dust);
  }
</style>
