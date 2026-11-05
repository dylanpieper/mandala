<script lang="ts">
  // The vault as a mandala (⌘M). Stone blooms in the middle, a petal per
  // folder; sand drifts out toward the rim as it ages; past the rim lies the
  // dust of what settled today. Touch a note to open it; touch dust to look
  // at it, then hold Restore to bring it back.
  import { fade, fly } from 'svelte/transition';
  import Glyph from './Glyph.svelte';
  import LifeMark from './LifeMark.svelte';
  import Icon from './Icon.svelte';
  import { api } from '../lib/api';
  import { hold } from '../lib/hold';
  import { layout, R, type PlacedDust } from '../lib/mandala';
  import { sinceWhen, timeLeft } from '../lib/time';
  import type { Mandala } from '../lib/types';

  let {
    picture,
    now,
    onOpen,
    onRestore,
  }: { picture: Mandala; now: Date; onOpen: (rel: string) => void; onRestore: (id: string) => void } = $props();

  const l = $derived(layout(picture));

  type Focus = { kind: 'stone' | 'grain' | 'dust'; key: string };
  let focus = $state<Focus | null>(null);

  const focusRel = $derived(focus && focus.kind !== 'dust' ? focus.key : null);
  const stone = $derived(focus?.kind === 'stone' ? [...l.seeds, ...l.petals.flatMap((p) => p.notes)].find((s) => s.rel === focus!.key) : undefined);
  const grain = $derived(focus?.kind === 'grain' ? l.grains.find((g) => g.rel === focus!.key) : undefined);
  const dust = $derived(focus?.kind === 'dust' ? l.dust.find((d) => d.id === focus!.key) : undefined);
  const touching = (link: { from: string; to: string }) => focusRel !== null && (link.from === focusRel || link.to === focusRel);

  function key(e: KeyboardEvent, act: () => void) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      act();
    }
  }

  // Petal labels sit just past each tip, upright, anchored away from the centre.
  function label(angle: number, tip: number) {
    const a = (angle * Math.PI) / 180;
    const r = tip + 14;
    const x = r * Math.sin(a);
    const anchor = Math.abs(x) < 8 ? 'middle' : x > 0 ? 'start' : 'end';
    return { x, y: -r * Math.cos(a) + 4, anchor };
  }

  // Dust being looked at: its text, and a held Restore. Nothing comes back
  // on a click alone.
  let peek = $state<PlacedDust | null>(null);
  let peekText = $state<string | null>(null);
  async function look(d: PlacedDust) {
    peek = d;
    peekText = null;
    try {
      const text = await api.settledText(d.id);
      if (peek?.id === d.id) peekText = text;
    } catch {
      // A picture, or a file that is not text: the title is enough.
      if (peek?.id === d.id) peekText = '';
    }
  }
  function restore() {
    const id = peek!.id;
    peek = null;
    onRestore(id);
  }
  function escape(e: KeyboardEvent) {
    // Esc closes the preview before it closes the mandala.
    if (peek && e.key === 'Escape') {
      e.stopPropagation();
      peek = null;
    }
  }

  const TICKS =Array.from({ length: 72 }, (_, i) => (i * 360) / 72);
</script>

<div class="mandala" transition:fade={{ duration: 420 }}>
  <svg viewBox="-500 -500 1000 1000" role="group" aria-label="Mandala">
    <defs>
      <radialGradient id="glow">
        <stop offset="0" stop-color="var(--sand)" stop-opacity="0.06" />
        <stop offset="0.55" stop-color="var(--sand)" stop-opacity="0.02" />
        <stop offset="1" stop-color="var(--sand)" stop-opacity="0" />
      </radialGradient>
    </defs>

    <circle r={R.rim} fill="url(#glow)" />
    <g class="guides">
      <circle r={R.lotus} />
      <circle r={R.sandIn} class="faint" />
      <circle r={R.rim} class="rim" />
      {#each TICKS as t, i}
        <line y1={-R.rim} y2={-R.rim - (i % 6 === 0 ? 8 : 4)} transform="rotate({t})" />
      {/each}
    </g>

    <g class="links">
      {#each l.links as link (link.from + '→' + link.to)}
        <path d={link.d} class:lit={touching(link)} />
      {/each}
    </g>

    <g class="lotus">
      {#each l.petals as p, i (p.folder)}
        {@const at = label(p.angle, p.tip)}
        <g transform="rotate({p.angle})">
          <path class="petal" class:lit={stone?.folder === p.folder} d={p.path} style="animation-delay: {i * 70}ms" />
        </g>
        <text class="folder" class:lit={stone?.folder === p.folder} x={at.x} y={at.y} text-anchor={at.anchor}>{p.folder}</text>
      {/each}
    </g>

    <g transform="translate(-24 -24)" class="centre"><Glyph size={48} stroke={0.9} color="var(--sand)" /></g>

    {#each [...l.seeds, ...l.petals.flatMap((p) => p.notes)] as s (s.rel)}
      <g
        class="node stone"
        style="transform: translate({s.x}px, {s.y}px)"
        role="button"
        tabindex="0"
        aria-label={s.title}
        onclick={() => onOpen(s.rel)}
        onkeydown={(e) => key(e, () => onOpen(s.rel))}
        onpointerenter={() => (focus = { kind: 'stone', key: s.rel })}
        onpointerleave={() => (focus = null)}
        onfocus={() => (focus = { kind: 'stone', key: s.rel })}
        onblur={() => (focus = null)}
      >
        <circle class="hit" r="10" />
        <circle class="dot" r={s.r} />
      </g>
    {/each}

    {#each l.grains as g, i (g.rel)}
      <g
        class="node grain"
        class:breath={g.life === 'breath'}
        style="transform: translate({g.x}px, {g.y}px); --c: {g.color}; --delay: {(i * 0.37) % 6}s"
        role="button"
        tabindex="0"
        aria-label={g.title}
        onclick={() => onOpen(g.rel)}
        onkeydown={(e) => key(e, () => onOpen(g.rel))}
        onpointerenter={() => (focus = { kind: 'grain', key: g.rel })}
        onpointerleave={() => (focus = null)}
        onfocus={() => (focus = { kind: 'grain', key: g.rel })}
        onblur={() => (focus = null)}
        transition:fade={{ duration: 420 }}
      >
        <circle class="hit" r="10" />
        <circle class="dot" r={g.r} />
      </g>
    {/each}

    {#each l.dust as d (d.id)}
      <g
        class="node dust"
        style="transform: translate({d.x}px, {d.y}px); --o: {d.opacity}"
        role="button"
        tabindex="0"
        aria-label="Look at {d.title}"
        onclick={() => look(d)}
        onkeydown={(e) => key(e, () => look(d))}
        onpointerenter={() => (focus = { kind: 'dust', key: d.id })}
        onpointerleave={() => (focus = null)}
        onfocus={() => (focus = { kind: 'dust', key: d.id })}
        onblur={() => (focus = null)}
        transition:fade={{ duration: 900 }}
      >
        <circle class="hit" r="9" />
        <circle class="dot" r="2" />
      </g>
    {/each}
  </svg>

  <div class="caption" aria-live="polite">
    {#key focus}
      <div in:fade={{ duration: 160 }}>
        {#if stone}
          <p class="title serif">{stone.title}</p>
          <p class="meta"><Icon name="stone" size={14} />{stone.folder || 'stone'}</p>
        {:else if grain}
          <p class="title serif">{grain.title}</p>
          <p class="meta mono"><LifeMark life={grain.life} /><span style="color: {grain.color}">{timeLeft(grain.dissolves, now)}</span></p>
        {:else if dust}
          <p class="title serif">{dust.title}</p>
          <p class="meta"><Icon name="wind" size={14} />Let go {sinceWhen(dust.at, now)}</p>
        {/if}
      </div>
    {/key}
  </div>

  {#if peek}
    <!-- The dust, looked at: a click outside or Esc puts it back. -->
    <div class="veil" role="presentation" onclick={(e) => e.target === e.currentTarget && (peek = null)} transition:fade={{ duration: 220 }}>
      <div class="peek" role="dialog" aria-label={peek.title} transition:fly={{ y: 8, duration: 260 }}>
        <header>
          <h2 class="serif">{peek.title}</h2>
          <p class="meta"><Icon name="wind" size={14} />Let go {sinceWhen(peek.at, now)}</p>
        </header>
        {#if peekText}
          <div class="text serif">{peekText}</div>
        {/if}
        <footer>
          <button class="pill" onclick={() => (peek = null)}><Icon name="back" />Back</button>
          <button class="pill stone" aria-label="Hold to restore" use:hold={{ done: restore }}><Icon name="restore" />Restore</button>
        </footer>
      </div>
    </div>
  {/if}
</div>

<svelte:window onkeydowncapture={escape} />

<style>
  .mandala {
    position: absolute;
    inset: 0;
    z-index: 5;
    background: var(--ground);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 24px 0;
  }
  svg {
    flex: 1;
    min-height: 0;
    width: 100%;
    overflow: visible;
  }

  .guides circle,
  .guides line {
    fill: none;
    stroke: var(--line);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .guides .faint {
    stroke-dasharray: 2 6;
  }
  .guides .rim {
    stroke: var(--line-strong);
  }

  .links path {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    opacity: 0.55;
    transition: stroke var(--quick) var(--ease), opacity var(--quick) var(--ease);
  }
  .links path.lit {
    stroke: var(--sand);
    opacity: 1;
  }

  .petal {
    fill: var(--stone-ground);
    stroke: var(--stone-line);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    transform-box: view-box;
    transform-origin: 0 0;
    animation: bloom 1200ms var(--ease) both;
    transition: stroke var(--quick) var(--ease), fill var(--quick) var(--ease);
  }
  .petal.lit {
    stroke: var(--stone);
  }
  .folder {
    font-family: var(--sans);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    fill: var(--dust);
    transition: fill var(--quick) var(--ease);
    pointer-events: none;
  }
  .folder.lit {
    fill: var(--stone);
  }
  @keyframes bloom {
    from {
      transform: scale(0.55);
      opacity: 0;
    }
  }

  .centre {
    pointer-events: none;
    animation: breathe var(--breath) var(--ease) infinite alternate;
    transform-box: view-box;
    transform-origin: 0 0;
  }
  @keyframes breathe {
    from {
      opacity: 0.7;
    }
  }

  .node {
    cursor: pointer;
    outline: none;
    transition: transform var(--settle) var(--ease);
  }
  .hit {
    fill: transparent;
  }
  .dot {
    transform-box: fill-box;
    transform-origin: center;
    transition: transform var(--quick) var(--ease), opacity var(--quick) var(--ease);
  }
  .node:hover .dot,
  .node:focus-visible .dot {
    transform: scale(1.7);
  }
  .node:focus-visible .hit {
    stroke: var(--sand);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .stone .dot {
    fill: var(--stone);
  }
  .grain .dot {
    fill: var(--c);
    animation: twinkle 7s ease-in-out var(--delay) infinite alternate;
  }
  .grain.breath .dot {
    animation-duration: var(--breath);
  }
  @keyframes twinkle {
    to {
      opacity: 0.55;
    }
  }
  .dust .dot {
    fill: var(--bone);
    opacity: var(--o);
  }

  .caption {
    height: 76px;
    flex-shrink: 0;
    text-align: center;
  }
  .caption p {
    margin: 0;
  }
  .title {
    font-size: 22px;
    color: var(--bone);
  }
  .meta {
    margin-top: 6px !important;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--ash);
    font-size: 12px;
  }

  /* Looking at dust: a calm card over the mandala, as the combine sheet lies over the page. */
  .veil {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgb(14 13 16 / 0.72);
  }
  .peek {
    width: 100%;
    max-width: 560px;
    max-height: 80%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 22px 26px 18px;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.45);
  }
  .peek header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .peek h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 400;
    color: var(--bone);
  }
  .peek .text {
    min-height: 0;
    overflow-y: auto;
    white-space: pre-wrap;
    font-size: 16px;
    line-height: 1.6;
    color: var(--ash);
  }
  .peek footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    .petal,
    .centre,
    .grain .dot {
      animation: none;
    }
  }
</style>
