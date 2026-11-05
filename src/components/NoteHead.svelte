<script lang="ts">
  // Above the open note. Sand: its life ring and time left, then Table, Draw,
  // Let go and Set in stone. Stone: its carving, then Table, Draw and Let go.
  import { hold } from '../lib/hold';
  import { key } from '../lib/keys';
  import { timeLeft } from '../lib/time';
  import type { SandItem } from '../lib/types';
  import Carving from './Carving.svelte';
  import TablePicker from './TablePicker.svelte';
  import Icon from './Icon.svelte';
  import LifeMark from './LifeMark.svelte';

  let {
    rel,
    sand,
    now,
    onDraw,
    onTable,
    onLetGo,
    onKeep,
  }: { rel: string; sand: SandItem | undefined; now: Date; onDraw: () => void; onTable: (cols: number, rows: number) => void; onLetGo: () => void; onKeep: () => void } = $props();

  // The table button's grid card is open.
  let tabling = $state(false);
</script>

<div class="head">
  {#if sand}
    <div class="life">
      <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true">
        <circle r="9" fill="none" stroke="var(--line)" stroke-width="2" />
        <circle r="9" fill="none" stroke="var(--sand)" stroke-width="2" stroke-linecap="round" stroke-dasharray="{56.5 * sand.fraction_left} 56.5" transform="rotate(-90)" />
      </svg>
      <span><LifeMark life={sand.life} /></span>
      <span class="mono sand">{timeLeft(sand.dissolves, now)}</span>
    </div>
  {:else}
    <Carving {rel} />
  {/if}
  <div class="do">
    <span class="anchor">
      <button class="tool" class:open={tabling} aria-label="Insert a table" aria-expanded={tabling} title="Table" onclick={() => (tabling = !tabling)}><Icon name="table" /></button>
      {#if tabling}<TablePicker onPick={(c, r) => ((tabling = false), onTable(c, r))} onClose={() => (tabling = false)} />{/if}
    </span>
    <button class="tool" aria-label="Draw ({key('D')})" title="Draw {key('D')}" onclick={onDraw}><Icon name="draw" /></button>
    <button class="pill" aria-label="Hold to let go" use:hold={{ done: onLetGo }}><Icon name="wind" />Let go</button>
    {#if sand}
      <button class="pill stone" aria-label="Hold to set in stone" use:hold={{ done: onKeep }}><Icon name="stone" />Set in stone <span class="mono key">{key('↵')}</span></button>
    {/if}
  </div>
</div>

<style>
  .head {
    width: 100%;
    /* The page's measure (`--measure` in Main), so header and note stay one column. */
    max-width: var(--measure, 680px);
    transition: max-width var(--settle) var(--ease);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .do {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .anchor {
    position: relative;
    display: inline-flex;
  }
  .tool.open {
    background: var(--hover);
    color: var(--bone);
  }
  .tool {
    width: 32px;
    height: 32px;
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
  .tool:hover {
    background: var(--hover);
    color: var(--bone);
  }
  .pill {
    height: 32px;
  }
  .key {
    color: var(--dust);
  }
  .life {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ash);
  }
  .sand {
    color: var(--sand);
  }
</style>
