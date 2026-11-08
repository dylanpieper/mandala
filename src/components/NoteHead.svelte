<script lang="ts">
  // Above the open note. Sand: its life ring and time left, then the five
  // lifespans (its own lit; a held press on another changes it, since a longer
  // one starts the clock over), then Table, Draw,
  // Let go and Set in stone. Stone: its carving, then Table, Draw and Let go.
  import { hold } from '../lib/hold';
  import { key } from '../lib/keys';
  import { timeLeft } from '../lib/time';
  import { LIVES } from '../lib/lives';
  import type { Life, SandItem } from '../lib/types';
  import Carving from './Carving.svelte';
  import TablePicker from './TablePicker.svelte';
  import Icon from './Icon.svelte';

  let {
    rel,
    sand,
    now,
    onDraw,
    onTable,
    onLetGo,
    onKeep,
    onSetLife,
  }: { rel: string; sand: SandItem | undefined; now: Date; onDraw: () => void; onTable: (cols: number, rows: number) => void; onLetGo: () => void; onKeep: () => void; onSetLife: (life: Life) => void } = $props();

  // What a held press on another lifespan does: a longer one starts the clock
  // over, a shorter one ends the note no later than now.
  const order = LIVES.map((l) => l.life);
  function change(life: Life) {
    if (!sand?.life) return '';
    return order.indexOf(life) > order.indexOf(sand.life) ? 'starts its clock over' : 'can only end it sooner';
  }

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
      <span class="mono sand">{timeLeft(sand.dissolves, now)}</span>
      <div class="lives" role="radiogroup" aria-label="Lifespan">
        {#each LIVES as l (l.life)}
          <button
            role="radio"
            aria-checked={l.life === sand.life}
            aria-label={l.life === sand.life ? `${l.name}, ${l.long}` : `Hold for ${l.name}: ${change(l.life)}`}
            title={l.life === sand.life ? l.name : `Hold for ${l.name}: ${change(l.life)}`}
            class:on={l.life === sand.life}
            style="--tone: var(--life-{l.tone})"
            use:hold={{ done: () => l.life !== sand.life && onSetLife(l.life) }}><Icon name={l.life} size={15} /></button
          >
        {/each}
      </div>
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
  .lives {
    display: flex;
    gap: 2px;
    margin-left: 6px;
    padding-left: 10px;
    border-left: 1px solid var(--line);
  }
  .lives button {
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--dust);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.55;
    transition:
      background var(--quick) var(--ease),
      color var(--quick) var(--ease),
      opacity var(--quick) var(--ease);
  }
  .lives button:hover {
    background: var(--hover);
    color: var(--tone);
    opacity: 1;
  }
  .lives button.on {
    color: var(--tone);
    background: var(--hover);
    opacity: 1;
  }
</style>
