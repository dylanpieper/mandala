<script lang="ts">
  // The table button's card: a small grid, as in a word processor. Hover to
  // choose the size (columns by rows below the header), click to put an empty
  // table at the caret. Esc or a click outside closes it.
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';

  let { onPick, onClose }: { onPick: (cols: number, rows: number) => void; onClose: () => void } = $props();

  const MAX = 6;
  let cols = $state(2);
  let rows = $state(2);
  let card: HTMLDivElement;

  onMount(() => {
    // Wait a frame, so the click that opened the card does not close it.
    const away = (e: PointerEvent) => !card.contains(e.target as Node) && onClose();
    const id = requestAnimationFrame(() => window.addEventListener('pointerdown', away));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('pointerdown', away);
    };
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<div class="card" bind:this={card} role="dialog" aria-label="Insert a table" transition:fly={{ y: -6, duration: 180 }}>
  <div class="grid" role="grid" aria-label="Table size">
    {#each Array(MAX) as _, r}
      {#each Array(MAX) as _, c}
        <button
          class="cell"
          class:on={c < cols && r < rows + 1}
          class:head={r === 0}
          aria-label="{c + 1} columns, {Math.max(1, r)} rows"
          onpointerenter={() => ((cols = c + 1), (rows = Math.max(1, r)))}
          onfocus={() => ((cols = c + 1), (rows = Math.max(1, r)))}
          onclick={() => onPick(cols, rows)}
        ></button>
      {/each}
    {/each}
  </div>
  <span class="mono size">{cols} × {rows}</span>
</div>

<style>
  .card {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(6, 18px);
    gap: 4px;
  }
  .cell {
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: transparent;
    transition:
      background var(--quick) var(--ease),
      border-color var(--quick) var(--ease);
  }
  .cell.on {
    border-color: var(--sand-line);
    background: var(--sand-ground);
  }
  /* The first row of the grid is the header row, in stone: a size of 3 × 2
     is a header and two rows below it. */
  .cell.head {
    border-color: var(--stone-line);
  }
  .cell.head.on {
    border-color: var(--stone);
    background: var(--stone-ground);
  }
  .size {
    font-size: 12px;
    color: var(--ash);
  }
</style>
