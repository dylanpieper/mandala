<script lang="ts">
  // The note being dragged, following the pointer.
  import { fade } from 'svelte/transition';
  import { drag } from '../lib/drag.svelte';
</script>

{#if drag.item}
  <div
    class="ghost"
    class:stone={drag.item.kind === 'stone'}
    style="transform: translate({drag.x + 14}px, {drag.y + 10}px)"
    aria-hidden="true"
    transition:fade={{ duration: 160 }}
  >
    {drag.item.title}
  </div>
{/if}

<style>
  .ghost {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 200;
    max-width: 240px;
    padding: 6px 12px;
    border-radius: var(--pill);
    border: 1px solid var(--sand-line);
    background: var(--sand-ground);
    color: var(--sand);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
  }
  .ghost.stone {
    border-color: var(--stone-line);
    background: var(--stone-ground);
    color: var(--stone);
  }
</style>
