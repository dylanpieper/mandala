<script lang="ts">
  // Opening is a ritual of up to four steps: arrive (while sync catches up), see
  // what came in, let go of what ran out, enter. Steps with nothing to show
  // are passed through. Nothing is swept that has not been shown here.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Icon from '../components/Icon.svelte';
  import { api } from '../lib/api';
  import { hold } from '../lib/hold';
  import LifeMark from '../components/LifeMark.svelte';
  import Carving from '../components/Carving.svelte';
  import { sinceWhen, timeLeft } from '../lib/time';
  import type { Arrival, NoteRef } from '../lib/types';

  let { onEnter }: { onEnter: () => void } = $props();

  type Step = 'arrive' | 'came' | 'leaving';
  let step = $state<Step>('arrive');
  let pending = $state(0);
  let arrival = $state<Arrival | null>(null);
  let leaving = $state<NoteRef[]>([]);
  let breath = $state(0);

  const BREATH_MS = 4000;

  // Sand around the breathing mandala: grains in a loose ring that drift out
  // and brighten as the breath comes in, and settle back as it goes. Placed
  // from a seeded random, so the ring is the same each visit.
  const GRAINS = (() => {
    let s = 7;
    const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    return Array.from({ length: 64 }, () => ({ a: rand() * Math.PI * 2, r: 128 + rand() * 18, size: 0.8 + rand() * 1.6, drift: 4 + rand() * 10 }));
  })();

  onMount(() => {
    const started = performance.now();
    let frame = requestAnimationFrame(function loop(t) {
      breath = (1 - Math.cos(((t - started) / BREATH_MS) * Math.PI * 2)) / 2;
      frame = requestAnimationFrame(loop);
    });
    arrive(started);
    return () => cancelAnimationFrame(frame);
  });

  async function arrive(started: number) {
    // Wait for sync (iCloud placeholders), and for at least one full breath.
    for (;;) {
      pending = await api.pendingDownloads();
      if (pending === 0 && performance.now() - started >= BREATH_MS) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    arrival = await api.arrive();
    leaving = arrival.leaving;
    next();
  }

  function next() {
    if (step === 'arrive' && arrival && (arrival.stone_changed.length || arrival.sand_new.length || arrival.kept_elsewhere.length)) return (step = 'came');
    if (step !== 'leaving' && leaving.length) return (step = 'leaving');
    onEnter();
  }

  async function keep(n: NoteRef) {
    await api.keep(n.rel, '', null);
    leaving = leaving.filter((l) => l.rel !== n.rel);
  }

  // Letting go blurs and fades the list, one note after another, as the
  // closing screen does with breaths; then the visit begins.
  let going = $state(false);
  async function letGoAndEnter() {
    if (leaving.length) {
      going = true;
      const stagger = Math.min(leaving.length - 1, STAGGER_MAX) * 80;
      await Promise.all([api.letGo(leaving.map((l) => l.rel)), new Promise((r) => setTimeout(r, 900 + stagger))]);
    }
    onEnter();
  }
  const STAGGER_MAX = 10;
</script>

<div class="opening">
  {#if step === 'arrive'}
    <div class="centre" in:fade={{ duration: 600 }} out:fade={{ duration: 300 }}>
      <svg width="320" height="320" viewBox="-160 -160 320 320" aria-hidden="true">
        <defs><path id="petal" d="M0 -40C22 -62 24 -98 0 -124C-24 -98 -22 -62 0 -40Z" /></defs>
        <circle r="150" fill="none" stroke="#1e1d22" />
        <circle r={90 + 50 * breath} fill="none" stroke="var(--sand)" opacity={0.25 + 0.35 * breath} />
        <g fill="var(--sand)" transform="rotate({-breath * 4})">
          {#each GRAINS as g}
            <circle cx={Math.cos(g.a) * (g.r + g.drift * breath)} cy={Math.sin(g.a) * (g.r + g.drift * breath)} r={g.size} opacity={0.3 + 0.5 * breath} />
          {/each}
        </g>
        <g fill="none" stroke="var(--line-strong)" transform="rotate({breath * 6})">
          {#each [0, 45, 90, 135, 180, 225, 270, 315] as a}<use href="#petal" transform="rotate({a})" />{/each}
        </g>
        <circle r="28" fill="var(--ground)" stroke="var(--stone)" />
        <circle r="4" fill="var(--stone)" />
      </svg>
      <h1 class="serif">{breath > 0.5 ? 'Breathe out' : 'Breathe in'}</h1>
      {#if pending}<p>Syncing · {pending}</p>{/if}
    </div>
  {:else if step === 'came' && arrival}
    <div class="page" class:going in:fade={{ duration: 500 }}>
      <div class="intro">
        <span class="eyebrow">Since {arrival.since ? sinceWhen(arrival.since) : 'last time'}</span>
        <h1 class="serif">What came in</h1>
      </div>
      <div class="columns">
        <section>
          <!-- Kept elsewhere (moved into stone on the phone): a reason can be carved here, or later. -->
          {#if arrival.kept_elsewhere.length}
            <h2 class="eyebrow stone right">Stone · kept</h2>
            {#each arrival.kept_elsewhere as n (n.rel)}
              <article class="card right">
                <span class="serif title">{n.title}</span>
                <span class="mono meta">{n.rel}</span>
                <span class="carve"><Carving rel={n.rel} /></span>
              </article>
            {/each}
          {/if}
          {#if arrival.stone_changed.length || !arrival.kept_elsewhere.length}
            <h2 class="eyebrow stone right">Stone · changed</h2>
            {#each arrival.stone_changed as n (n.rel)}
              <article class="card right"><span class="serif title">{n.title}</span><span class="mono meta">{n.rel}</span></article>
            {:else}
              <p class="none right">Nothing changed.</p>
            {/each}
          {/if}
        </section>
        <section>
          <h2 class="eyebrow sand">Sand · new</h2>
          {#each arrival.sand_new as n (n.rel)}
            <article class="card">
              <span class="row"><span class="serif title">{n.title}</span><span class="mono sand">{timeLeft(n.dissolves)}</span></span>
              <span class="mono meta"><LifeMark life={n.life} /></span>
            </article>
          {:else}
            <p class="none">No new sand.</p>
          {/each}
        </section>
      </div>
      <button class="pill large" onclick={next}>Continue <Icon name="next" /></button>
    </div>
  {:else if step === 'leaving'}
    <div class="page" class:going in:fade={{ duration: 500 }}>
      <div class="intro">
        
        <h1 class="serif">What’s leaving</h1>
      </div>
      <ul class="leaving" class:going>
        {#each leaving as n, i (n.rel)}
          <li class="card" style="--i: {Math.min(i, STAGGER_MAX)}" out:fade={{ duration: 300 }}>
            <span class="row"><span class="serif title">{n.title}</span><span class="mono meta"><LifeMark life={n.life} /></span></span>
            <button class="pill stone" aria-label="Hold to set in stone" use:hold={{ done: () => keep(n) }}><Icon name="stone" />Set in stone</button>
          </li>
        {/each}
      </ul>
      {#if leaving.length}
        <button class="pill sand large" aria-label="Hold to let go and open" use:hold={{ done: letGoAndEnter }}><Icon name="wind" />Open</button>
      {:else}
        <button class="pill sand large" onclick={letGoAndEnter}><Icon name="next" />Enter</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .opening {
    height: 100%;
    background: var(--night);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px;
    overflow: hidden;
  }
  /* Each step sits in the middle of the window. A long list scrolls in
     place, so the title and the buttons always stay in view. */
  .centre,
  .page {
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
  }
  /* A long list scrolls; the buttons keep their full height. */
  .centre > :global(.pill),
  .page > :global(.pill) {
    flex-shrink: 0;
  }
  .columns,
  .leaving {
    min-height: 0;
    overflow-y: auto;
    flex: 0 1 auto;
  }
  .leaving li {
    flex-shrink: 0;
    transition:
      opacity 900ms var(--ease) calc(var(--i) * 80ms),
      letter-spacing 900ms var(--ease) calc(var(--i) * 80ms),
      filter 900ms var(--ease) calc(var(--i) * 80ms);
  }
  /* The title and the button fade with the notes as they leave. */
  .page .intro,
  .page > :global(.pill) {
    transition: opacity 600ms var(--ease);
  }
  .page.going .intro,
  .page.going > :global(.pill) {
    opacity: 0;
    pointer-events: none;
  }
  /* The scrollbar goes while the notes leave, so only they move. */
  .leaving.going {
    scrollbar-width: none;
  }
  .leaving.going::-webkit-scrollbar {
    display: none;
  }
  .leaving.going li {
    opacity: 0;
    letter-spacing: 0.2em;
    filter: blur(2px);
  }
  .centre {
    justify-content: center;
    text-align: center;
    gap: 16px;
  }
  h1 {
    margin: 0;
    font-weight: 400;
    font-size: 40px;
    transition: opacity var(--settle) var(--ease);
  }
  p {
    margin: 0;
    color: var(--ash);
    font-size: 15px;
  }
  .intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }
  .eyebrow.stone {
    color: var(--stone);
  }
  .eyebrow.sand,
  .sand {
    color: var(--sand);
  }
  .columns {
    width: 100%;
    max-width: 980px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .right {
    text-align: right;
  }
  /* The carving spans the card, so its field does too; the chisel sits at the
     card's inner edge, as the text does. */
  .carve {
    display: flex;
  }
  .carve :global(.chisel) {
    margin: 0 -8px 0 auto;
  }
  .carve :global(textarea) {
    text-align: right;
  }
  .card {
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
  }
  .title {
    font-size: 19px;
  }
  .meta {
    font-size: 11px;
    color: var(--dust);
  }
  .none {
    color: var(--dust);
    font-size: 13px;
  }
  .leaving {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: 720px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .leaving .card {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  .leaving .row {
    flex-direction: column;
    gap: 4px;
  }
</style>
