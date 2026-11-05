<script lang="ts">
  // Setting in stone. Keeping is a decision, so it takes one held breath:
  // three seconds of pressing (or of holding ⌘↵). The breath brings up a rune,
  // made from why the note is kept (or its name): it glows in and brightens,
  // then is painted on, and the note is kept. Let go early and the glow fades.
  import { fade, scale } from 'svelte/transition';
  import { onDestroy, untrack } from 'svelte';
  import Icon from './Icon.svelte';
  import { modHeld } from '../lib/keys';
  import { runeOf, runeText } from '../lib/rune';
  import type { SandItem } from '../lib/types';

  let {
    note,
    folders,
    onKeep,
    onCancel,
    startFolder = undefined,
  }: { note: SandItem; folders: string[]; onKeep: (folder: string, because: string) => void; onCancel: () => void; startFolder?: string } = $props();

  const HOLD_MS = 3000;
  const C = 2 * Math.PI * 60;

  let because = $state('');
  let folder = $state(untrack(() => startFolder ?? folders[0] ?? ''));
  let progress = $state(0);
  let set = $state(false);
  let holding = $state(false);
  let last = 0;
  let frame = 0;

  // The rune: it glows in whole and brightens as the breath goes on, then is
  // painted on in one stroke when the hold is done.
  const strokes = $derived(runeOf(runeText(because, note.rel)));

  function tick(t: number) {
    const dt = last ? t - last : 0;
    last = t;
    progress = Math.min(1, Math.max(0, progress + (holding ? dt / HOLD_MS : -dt / 600)));
    if (progress >= 1) {
      holding = false;
      set = true;
      // The paint and the swell (950 ms), then the note moves.
      setTimeout(() => onKeep(folder, because), 950);
      return;
    }
    if (holding || progress > 0) frame = requestAnimationFrame(tick);
    else last = 0;
  }

  function start() {
    if (holding || set) return;
    holding = true;
    last = 0;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }
  function stop() {
    holding = false;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && modHeld(e) && !e.repeat) start();
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Meta' || e.key === 'Control') stop();
  }

  onDestroy(() => cancelAnimationFrame(frame));
</script>

<svelte:window onkeydown={onKey} onkeyup={onKeyUp} />

<div class="scrim" transition:fade={{ duration: 260 }}>
  <div role="dialog" aria-modal="true" aria-labelledby="keep-title" transition:scale={{ start: 0.97, duration: 320 }}>
    <!-- Sand becoming stone: a few grains, an arrow, a stone. -->
    <svg class="picture" width="120" height="36" viewBox="0 0 120 36" fill="none" aria-hidden="true">
      <g fill="var(--sand)">
        <circle cx="10" cy="24" r="2" /><circle cx="17" cy="20" r="1.6" opacity=".85" /><circle cx="14" cy="28" r="1.4" opacity=".7" />
        <circle cx="23" cy="25" r="1.3" opacity=".6" /><circle cx="7" cy="17" r="1.1" opacity=".5" />
      </g>
      <path d="M36 22H76M71 17l5 5-5 5" stroke="var(--dust)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M92 30c-4 0-5.5-3.2-4.2-7.2 1.5-4.6 5.6-9.3 11.4-9.3 6.4 0 11.6 4.6 11.6 9.8 0 4.4-3.6 6.7-8.6 6.7Z" fill="var(--stone-ground)" stroke="var(--stone)" stroke-width="1.3" stroke-linejoin="round" />
    </svg>

    <div class="what">
      <h1 id="keep-title" class="serif">{note.title}</h1>
      <label class="into">
        <span>into</span>
        <select class="serif" bind:value={folder} aria-label="Stone folder">
          {#each folders as f}<option value={f}>{f || 'Stone'}</option>{/each}
        </select>
      </label>
    </div>

    <label class="sr-only" for="keep-why">Why keep this one?</label>
    <textarea id="keep-why" rows="2" class="serif" bind:value={because} placeholder="Why keep this one?"></textarea>

    <button
      class="hold"
      class:set
      aria-label="Hold to set in stone"
      onpointerdown={start}
      onpointerup={stop}
      onpointerleave={stop}
      onkeydown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && start()}
      onkeyup={stop}
    >
      <svg width="132" height="132" viewBox="-66 -66 132 132" aria-hidden="true">
        <circle r="60" fill="var(--stone-ground)" stroke="#2c3439" stroke-width="3" />
        <circle r="60" fill="none" stroke="var(--stone)" stroke-width="3" stroke-linecap="round" stroke-dasharray="{C * progress} {C}" transform="rotate(-90)" />
        <g transform="scale(3.6)" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <!-- The rune to come, faint; it changes as the reason is written. -->
          {#each strokes as d, i (d + i)}
            <path class="ghost" {d} in:fade={{ duration: 360 }} />
          {/each}
          <!-- The held breath: the whole rune glows in and brightens. -->
          <g class="carved" style="--glow: {progress}">
            {#each strokes as d, i (d + i)}
              <path {d} />
            {/each}
          </g>
          <!-- Done: the rune is painted on, one stroke from left to right. -->
          <g class="paint">
            {#each strokes as d, i (d + i)}
              <path {d} />
            {/each}
          </g>
        </g>
      </svg>
    </button>
    <div class="hold-label" class:holding>
      <span>Hold</span>
    </div>

    <footer>
      <button class="pill" style="color: var(--sand)" onclick={onCancel}><Icon name="back" />Stay sand</button>
    </footer>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(14, 13, 16, 0.86);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 10;
  }
  [role='dialog'] {
    width: 100%;
    max-width: 560px;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 20px;
    padding: 36px 40px 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }
  .picture {
    display: block;
  }
  .what {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
  }
  h1 {
    margin: 0;
    font-weight: 400;
    font-size: 28px;
    overflow-wrap: anywhere;
  }
  .into {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    color: var(--dust);
    font-size: 14px;
  }
  select {
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--stone-line);
    padding: 2px 0;
    color: var(--stone);
    font-size: 17px;
  }
  textarea {
    width: 100%;
    resize: none;
    background: #121114;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 17px;
    line-height: 1.5;
  }
  .hold {
    width: 132px;
    height: 132px;
    border-radius: 50%;
    border: 0;
    padding: 0;
    background: transparent;
    touch-action: none;
  }
  .hold svg {
    overflow: visible;
    transition: transform 600ms var(--ease);
  }
  .ghost {
    stroke: var(--stone);
    stroke-width: 0.5;
    opacity: 0.22;
  }
  /* The whole rune glows in, and brightens as the breath goes on. */
  .carved {
    stroke: color-mix(in srgb, var(--bone) calc(var(--glow) * 100%), var(--stone));
    stroke-width: 1.15;
    opacity: calc(var(--glow) * 0.85);
    filter: drop-shadow(0 0 calc(var(--glow) * 3px) var(--stone));
  }
  /* Then it is painted on: a solid stroke sweeps across, left to right. */
  .paint {
    stroke: var(--stone);
    stroke-width: 1.3;
    clip-path: inset(-20% 100% -20% -20%);
    transition: clip-path 450ms var(--ease);
  }
  .hold.set .paint {
    clip-path: inset(-20% -20% -20% -20%);
  }
  /* The rune sets: one slow swell of light after the paint. */
  .hold.set svg {
    transform: scale(1.06);
  }
  .hold.set .carved {
    animation: set 650ms var(--ease) 300ms forwards;
  }
  @keyframes set {
    40% {
      filter: drop-shadow(0 0 4px var(--stone)) drop-shadow(0 0 10px var(--stone));
    }
    100% {
      opacity: 0.6;
      filter: drop-shadow(0 0 2px var(--stone));
    }
  }
  .hold-label {
    transition: color var(--settle) var(--ease);
    color: var(--ash);
  }
  .hold-label.holding {
    color: var(--stone);
  }
  @media (prefers-reduced-motion: reduce) {
    .hold.set .carved {
      animation: none;
    }
    .paint {
      transition: none;
    }
    .hold svg {
      transition: none;
    }
  }
  .hold-label {
    margin-top: -10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-size: 14px;
  }
  footer {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
  }
</style>
