<script lang="ts">
  // Opening: wait until sync has brought every note down, so nothing is swept
  // from an old view; then arrive (`visit.rs`), which settles what ran out
  // while Mandala was closed, and enter. The main window names what left.
  // Arriving is usually instant: the glyph shows only when it takes longer
  // than LOADER_DELAY_MS, so a quick opening never flickers.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Glyph from '../components/Glyph.svelte';
  import { api } from '../lib/api';
  import type { Settled } from '../lib/types';

  let { onEnter }: { onEnter: (left: Settled[]) => void } = $props();

  const LOADER_DELAY_MS = 400;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  let pending = $state(0);
  // The last count shown, so "Syncing" fades out with its number, not blank.
  let shownPending = $state(0);
  let error = $state('');

  onMount(() => {
    arrive();
  });

  async function arrive() {
    try {
      for (;;) {
        pending = await api.pendingDownloads();
        if (pending === 0) break;
        shownPending = pending;
        await wait(500);
      }
      const arrival = await api.arrive();
      onEnter(arrival.left);
    } catch (e) {
      error = String(e);
    }
  }
</script>

<div class="opening">
  <div class="centre" in:fade={{ delay: LOADER_DELAY_MS, duration: 400 }}>
    <span class="loader" role="status" aria-label="Opening"><Glyph size={28} color="var(--dust)" stroke={1} /></span>
    <!-- Always in the layout, so the glyph does not move when sync starts or ends. -->
    <p class="syncing" class:on={pending > 0}>Syncing · {shownPending}</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
</div>

<style>
  .opening {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--night);
  }
  .centre {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }
  /* The glyph turns slowly while Mandala waits. */
  .loader {
    display: inline-flex;
    animation: turn 12s linear infinite;
  }
  @keyframes turn {
    to {
      transform: rotate(1turn);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .loader {
      animation: none;
    }
  }
  p {
    margin: 0;
    color: var(--ash);
    font-size: 13px;
  }
  .syncing {
    opacity: 0;
    transition: opacity var(--settle) var(--ease);
  }
  .syncing.on {
    opacity: 1;
  }
  .error {
    max-width: 420px;
    color: var(--vermilion);
  }
</style>
