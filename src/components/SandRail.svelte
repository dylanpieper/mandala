<script lang="ts">
  import { flip } from 'svelte/animate';
  import { slide } from 'svelte/transition';
  import { drag, draggable, droppable, type Lifted } from '../lib/drag.svelte';
  import { hold } from '../lib/hold';
  import { leavingSoon, timeLeft, timeShare } from '../lib/time';
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
    onSetLife,
    onCombine,
  }: {
    sand: SandItem[];
    selected: string | null;
    now: Date;
    onOpen: (rel: string) => void;
    onNew: (life: Life) => void;
    /** A sand note dropped on another lifespan. */
    onSetLife: (rel: string, life: Life) => void;
    /** A note held on a sand note and dropped: combine `dragged` into `into`. */
    onCombine: (into: string, dragged: string) => void;
  } = $props();

  let moonClicked = $state(false);
  // While sand is lifted, the moons open so each lifespan can be a target.
  const moonOpen = $derived(moonClicked || drag.item?.kind === 'sand');

  // Sand is always soonest-to-leave first, so it is not reordered by hand; it
  // drags onto a lifespan, onto stone, or onto another note to combine. Any other lifespan accepts a note: shorter ends sooner, longer starts the clock over.
  function lifeTarget(life: Life) {
    return {
      accepts: (item: Lifted) => item.kind === 'sand' && !!item.life && item.life !== life,
      drop: (item: Lifted) => onSetLife(item.rel, life),
    };
  }
  const refuses = (life: Life) => drag.item?.kind === 'sand' && !lifeTarget(life).accepts(drag.item);

  // The open note is found in the rail: its row comes into view.
  let rail = $state<HTMLElement | undefined>();
  $effect(() => {
    const rel = selected;
    if (!rel?.startsWith('sand/')) return;
    const id = requestAnimationFrame(() => reveal(rail, rel));
    return () => cancelAnimationFrame(id);
  });
</script>

<aside class="rail" bind:this={rail} aria-label="Sand, notes that will dissolve">
  <header>
    <span class="mono count">{sand.length} drifting</span>
    <div class="name">
      <h2>Sand</h2>
      <span class="grains" aria-hidden="true"><i></i><i></i><i></i></span>
    </div>
  </header>

  <div class="new" role="group" aria-label="New sand">
    <button aria-label="Hold for a new breath, until you close" use:hold={{ done: () => onNew('breath') }} use:droppable={lifeTarget('breath')} class:refuse={refuses('breath')}><span>Breath</span><small class="mono life breath"><Icon name="breath" size={15} /></small></button>
    <button aria-label="Hold for a new sun, 24 hours" use:hold={{ done: () => onNew('sun') }} use:droppable={lifeTarget('sun')} class:refuse={refuses('sun')}><span>Sun</span><small class="mono life sun"><Icon name="sun" size={15} />24h</small></button>
    <button aria-expanded={moonOpen} onclick={() => (moonClicked = !moonClicked)}>
      <span>Moon</span><small class="phases" aria-hidden="true"><Icon name="quarter" size={14} /><Icon name="half" size={14} /><Icon name="full" size={14} /></small>
    </button>
  </div>
  {#if moonOpen}
    <div class="moons" transition:slide={{ duration: 220 }}>
      <button aria-label="Hold for a new quarter moon, 7 days" use:hold={{ done: () => onNew('quarter') }} use:droppable={lifeTarget('quarter')} class:refuse={refuses('quarter')}><Icon name="quarter" size={18} /><small class="mono">7d</small></button>
      <button aria-label="Hold for a new half moon, 15 days" use:hold={{ done: () => onNew('half') }} use:droppable={lifeTarget('half')} class:refuse={refuses('half')}><Icon name="half" size={18} /><small class="mono">15d</small></button>
      <button aria-label="Hold for a new full moon, 29 days" use:hold={{ done: () => onNew('full') }} use:droppable={lifeTarget('full')} class:refuse={refuses('full')}><Icon name="full" size={18} /><small class="mono">29d</small></button>
    </div>
  {/if}

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
  .new {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .new button,
  .moons button {
    height: 44px;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: transparent;
    color: var(--ash);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    transition: background var(--quick) var(--ease), color var(--quick) var(--ease);
  }
  .new button:hover,
  .moons button:hover {
    background: var(--hover);
    color: var(--bone);
  }
  .new button.refuse,
  .moons button.refuse {
    opacity: 0.3;
    transition: opacity var(--quick) var(--ease);
  }
  small {
    font-size: 11.5px;
    opacity: 0.75;
    white-space: nowrap;
  }
  .moons {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .life {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
  }
  /* Each lifespan has its own faint color: a blue breath, a gold sun, a pale moon. */
  .life.breath :global(svg) {
    color: var(--life-breath);
  }
  .life.sun :global(svg) {
    color: var(--life-sun);
  }
  .phases :global(svg),
  .moons button :global(svg) {
    color: var(--life-moon);
  }
  .phases {
    display: flex;
    gap: 3px;
    margin-top: 2px;
  }
  .moons button {
    height: 36px;
    flex-direction: row;
    gap: 6px;
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
