<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { drag, draggable, droppable, type Lifted } from '../lib/drag.svelte';
  import { leavingSoon, timeLeft, timeShare } from '../lib/time';
  import { LIVES } from '../lib/lives';
  import { hold } from '../lib/hold';
  import Hourglass from './Hourglass.svelte';
  import Icon from './Icon.svelte';
  import LifeMark from './LifeMark.svelte';
  import type { Life, SandItem } from '../lib/types';
  import { reveal } from '../lib/reveal';

  let {
    sand,
    selected,
    now,
    onOpen,
    onNew,
    onReturn,
    onCombine,
  }: {
    sand: SandItem[];
    selected: string | null;
    now: Date;
    onOpen: (rel: string) => void;
    onNew: (life: Life) => void;
    /** A stone note dropped anywhere on the rail: it returns to sand, once a lifespan is chosen. */
    onReturn: (rel: string) => void;
    /** A note held on a sand note and dropped: combine `dragged` into `into`. */
    onCombine: (into: string, dragged: string) => void;
  } = $props();

  // New note: a menu of the five lifespans, with none chosen for you. A held
  // press on one makes the note.
  let menu = $state(false);
  let anchor = $state<HTMLElement | undefined>();
  function pick(life: Life) {
    menu = false;
    onNew(life);
  }
  function outside(e: PointerEvent) {
    if (menu && anchor && !anchor.contains(e.target as Node)) menu = false;
  }
  function menuKey(e: KeyboardEvent) {
    if (menu && e.key === 'Escape') {
      e.stopPropagation();
      menu = false;
    }
  }

  // Sand is always soonest-to-leave first, so it is not reordered by hand; it
  // drags onto stone, or onto another note to combine. Stone dropped anywhere
  // here comes back to sand.
  const stoneHere = { accepts: (item: Lifted) => item.kind === 'stone', drop: (item: Lifted) => onReturn(item.rel) };
  const stoneLifted = $derived(drag.item?.kind === 'stone');

  // The open note is found in the rail: its row comes into view.
  let rail = $state<HTMLElement | undefined>();
  $effect(() => {
    const rel = selected;
    if (!rel?.startsWith('sand/')) return;
    const id = requestAnimationFrame(() => reveal(rail, rel));
    return () => cancelAnimationFrame(id);
  });
</script>

<svelte:window onpointerdown={outside} onkeydowncapture={menuKey} />

<aside class="rail" class:taking={stoneLifted} bind:this={rail} aria-label="Sand, notes that will dissolve" use:droppable={stoneHere}>
  <header>
    <!-- The hourglass keeps time beside the sand: ⌘T turns it even when the rail is hidden. -->
    <div class="lead">
      <Hourglass />
      <span class="mono count">{sand.length} drifting</span>
    </div>
    <div class="name">
      <h2>Sand</h2>
      <span class="grains" aria-hidden="true"><i></i><i></i><i></i></span>
    </div>
  </header>

  <div class="new" bind:this={anchor}>
    <button class="pill sand" aria-haspopup="menu" aria-expanded={menu} onclick={() => (menu = !menu)}>
      <Icon name="plus" />New note<span class="chev" class:open={menu}><Icon name="next" size={14} /></span>
    </button>
    {#if menu}
      <div class="menu" role="menu" aria-label="Lifespan for the new note" transition:fly={{ y: -4, duration: 160 }}>
        {#each LIVES as l (l.life)}
          <button role="menuitem" aria-label="Hold for a new {l.name.toLowerCase()}, {l.long}" use:hold={{ done: () => pick(l.life) }}>
            <span class="icon" style="color: var(--life-{l.tone})"><Icon name={l.life} size={16} /></span>
            <span class="name">{l.name}</span>
            <span class="mono time">{l.time}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
  {#if stoneLifted}<p class="hint mono" transition:fly={{ y: -4, duration: 160 }}>Drop to return to sand</p>{/if}

  <div class="list">
    {#each sand as s (s.rel)}
      <button
        class="grain"
        data-rel={s.rel}
        class:on={s.rel === selected}
        class:low={leavingSoon(s.dissolves, now)}
        animate:flip={{ duration: 600 }}
        use:draggable={{ rel: s.rel, title: s.title, kind: 'sand', life: s.life }}
        use:droppable={{ accepts: (item: Lifted) => item.rel !== s.rel, onto: true, ontoOnly: true, drop: (item: Lifted) => onCombine(s.rel, item.rel) }}
        onclick={() => onOpen(s.rel)}
      >
        <span class="title">{s.title}</span>
        <span class="meta mono"><span><LifeMark life={s.life} /></span><span>{timeLeft(s.dissolves, now)}</span></span>
        <span class="bar" aria-hidden="true"><span style="width: {(timeShare(s.dissolves, now) * 100).toFixed(1)}%"></span></span>
      </button>
    {/each}
  </div>
</aside>

<style>
  .rail {
    width: 260px;
    flex-shrink: 0;
    padding: 20px 16px;
    border-left: 1px solid var(--line);
    --drop: var(--sand);
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
  .lead,
  .name {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h2 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--sand);
    /* Trimmed to the capitals, so the grains beside it centre on the letters. */
    text-box: trim-both cap alphabetic;
  }
  .grains {
    display: flex;
    gap: 2px;
  }
  .grains i {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--sand);
  }
  .grains i:nth-child(2) {
    opacity: 0.6;
  }
  .grains i:nth-child(3) {
    opacity: 0.3;
  }
  .count {
    font-size: 12px;
    color: var(--dust);
  }
  .rail {
    transition: background var(--quick) var(--ease);
  }
  .rail.taking {
    background: var(--sand-ground);
  }
  .new {
    position: relative;
  }
  .new > .pill {
    width: 100%;
    height: 36px;
    justify-content: center;
  }
  .chev {
    display: inline-flex;
    margin-left: 2px;
    transform: rotate(90deg);
    transition: transform var(--quick) var(--ease);
  }
  .chev.open {
    transform: rotate(-90deg);
  }
  .menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 5;
    padding: 6px;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 14px 36px rgb(0 0 0 / 0.4);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .menu button {
    height: 34px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--ash);
    display: flex;
    align-items: center;
    gap: 10px;
    transition: background var(--quick) var(--ease), color var(--quick) var(--ease);
  }
  .menu button:hover,
  .menu button:focus-visible {
    background: var(--hover);
    color: var(--bone);
    outline: none;
  }
  /* The held press fills in sand. */
  .menu button:global(.holdable)::before {
    background: var(--sand);
  }
  .menu .icon {
    display: inline-flex;
  }
  .menu .name {
    flex: 1;
    text-align: left;
  }
  .menu .time {
    font-size: 11px;
    color: var(--dust);
  }
  .hint {
    margin: 0;
    text-align: center;
    font-size: 11px;
    color: var(--sand);
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .grain {
    text-align: left;
    border: 0;
    background: transparent;
    color: var(--bone);
    padding: 10px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: background var(--quick) var(--ease);
  }
  .grain:hover {
    background: var(--hover);
  }
  .grain.on {
    background: var(--sand-ground);
  }
  .title {
    line-height: 1.35;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--ash);
  }
  .bar {
    display: block;
    height: 2px;
    background: var(--line);
    border-radius: 2px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 2px;
    margin-left: auto;
    background: var(--sand);
    transition: width var(--settle) var(--ease);
  }
  .low .bar span {
    background: var(--vermilion);
  }
</style>
