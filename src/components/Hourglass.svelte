<script lang="ts">
  // The hourglass in the title bar (`lib/timer.svelte.ts`). Click to turn it,
  // hold for its settings. Sand runs from the top to the bottom as the
  // minutes pass: sand-colored for work, stone-colored for rest. It turns
  // over when a phase begins and glows when a bell rings.
  import { fade, fly } from 'svelte/transition';
  import { hold } from '../lib/hold';
  import { minutesLeft, pause, sandLeft, saveSettings, settings, test, timer, turn } from '../lib/timer.svelte';
  import Icon from './Icon.svelte';

  let open = $state(false);
  let held = false;
  let root: HTMLDivElement;

  const left = $derived(timer.demo ?? sandLeft(timer));
  const color = $derived(timer.phase === 'rest' ? 'var(--stone)' : 'var(--sand)');
  const running = $derived((!!timer.phase && timer.paused === null) || timer.demo !== null);
  const turnKey = $derived(timer.phase ?? (timer.demo !== null ? 'demo' : 'idle'));
  // The glass is 11 units tall above and below its waist (y 3 to 14, 14 to 25).
  const top = $derived(14 - 11 * left);
  const bottom = $derived(25 - 11 * (1 - left));
  const label = $derived(timer.phase ? `Stop the hourglass, ${minutesLeft(timer)} minutes left. Hold for settings.` : `Turn the hourglass, ${settings.work} minutes. Hold for settings.`);

  function click() {
    if (held) {
      held = false;
      return;
    }
    turn();
  }

  function outside(e: PointerEvent) {
    if (open && !root.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window onpointerdown={outside} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="hourglass" bind:this={root}>
  <button
    class="glass"
    class:running
    class:ringing={timer.ringing}
    style="--c: {color}"
    aria-label={label}
    aria-expanded={open}
    use:hold={{ done: () => ((held = true), (open = !open)), ms: 600 }}
    onclick={click}
  >
    {#key turnKey}
      <svg class:turning={turnKey !== 'idle'} width="14" height="20" viewBox="0 0 20 28" aria-hidden="true">
        <defs>
          <clipPath id="glass">
            <path d="M4.5 3C4.5 9 9 11.5 9 14C9 16.5 4.5 19 4.5 25H15.5C15.5 19 11 16.5 11 14C11 11.5 15.5 9 15.5 3Z" />
          </clipPath>
        </defs>
        <g clip-path="url(#glass)" fill={color}>
          <rect class="sand" class:fast={timer.demo !== null} x="0" y={top} width="20" height={14 - top} />
          <rect class="sand" class:fast={timer.demo !== null} x="0" y={bottom} width="20" height={25 - bottom} />
          {#if running && left > 0}<rect class="stream" x="9.5" y="13" width="1" height="12" />{/if}
        </g>
        <path class="frame" d="M4.5 3C4.5 9 9 11.5 9 14C9 16.5 4.5 19 4.5 25H15.5C15.5 19 11 16.5 11 14C11 11.5 15.5 9 15.5 3Z" />
        <path class="frame" d="M2.5 2.5H17.5M2.5 25.5H17.5" />
      </svg>
    {/key}
  </button>
  {#if timer.phase}
    <span class="mono left" class:held-still={timer.paused !== null} style="color: {color}" transition:fade={{ duration: 220 }}>{minutesLeft(timer)}</span>
    <button class="pause" aria-label={timer.paused === null ? 'Pause' : 'Go on'} title={timer.paused === null ? 'Pause' : 'Go on'} onclick={pause} transition:fade={{ duration: 220 }}>
      <Icon name={timer.paused === null ? 'pause' : 'play'} size={13} />
    </button>
  {/if}

  {#if open}
    <div class="card" role="dialog" aria-label="Hourglass" data-tauri-drag-region="false" transition:fly={{ y: -6, duration: 220 }}>
      <label>
        <span>Work</span>
        <input type="range" min="5" max="90" step="5" bind:value={settings.work} oninput={saveSettings} />
        <output class="mono">{settings.work}m</output>
      </label>
      <label>
        <span>Rest</span>
        <input type="range" min="1" max="30" step="1" bind:value={settings.rest} oninput={saveSettings} />
        <output class="mono">{settings.rest}m</output>
      </label>
      <label>
        <span>Volume</span>
        <input type="range" min="0" max="1" step="0.05" bind:value={settings.volume} oninput={saveSettings} />
        <output class="mono">{Math.round(settings.volume * 100)}</output>
      </label>
      <button class="pill" disabled={timer.demo !== null} onclick={test}><Icon name="bell" />Test</button>
    </div>
  {/if}
</div>

<style>
  .hourglass {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .glass {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--c);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background var(--quick) var(--ease);
  }
  .glass:hover {
    background: var(--hover);
  }
  .glass svg {
    transition: filter 600ms var(--ease);
  }
  .glass.ringing svg {
    filter: drop-shadow(0 0 4px var(--c));
  }
  .frame {
    fill: none;
    stroke: var(--ash);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: stroke var(--quick) var(--ease);
  }
  .glass:hover .frame,
  .running .frame {
    stroke: var(--bone);
  }
  .ringing .frame {
    stroke: var(--c);
  }
  .sand {
    transition:
      y 1s linear,
      height 1s linear,
      fill var(--settle) var(--ease);
  }
  .sand.fast {
    transition: fill var(--settle) var(--ease);
  }
  .stream {
    opacity: 0.8;
    animation: fall 1.2s linear infinite;
  }
  @keyframes fall {
    50% {
      opacity: 0.4;
    }
  }
  .turning {
    animation: turn 700ms var(--ease);
  }
  @keyframes turn {
    from {
      transform: rotate(-180deg);
    }
  }
  .left {
    font-size: 11px;
    min-width: 2ch;
    transition: opacity var(--settle) var(--ease);
  }
  .left.held-still {
    opacity: 0.5;
  }
  /* Pause: barely there until the pointer finds it. */
  .pause {
    width: 20px;
    height: 20px;
    padding: 0;
    margin-left: -2px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--dust);
    opacity: 0.6;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: opacity var(--quick) var(--ease), color var(--quick) var(--ease), background var(--quick) var(--ease);
  }
  .pause:hover,
  .pause:focus-visible {
    opacity: 1;
    color: var(--bone);
    background: var(--hover);
  }

  .card {
    position: absolute;
    top: 36px;
    left: 0;
    z-index: 20;
    width: 232px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
  }
  label {
    display: grid;
    grid-template-columns: 52px 1fr 30px;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--ash);
  }
  output {
    font-size: 11px;
    color: var(--bone);
    text-align: right;
  }
  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 16px;
    background: transparent;
    margin: 0;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 2px;
    border-radius: 2px;
    background: var(--line-strong);
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -5px;
    border-radius: 50%;
    background: var(--sand);
    transition: transform var(--quick) var(--ease);
  }
  input[type='range']:active::-webkit-slider-thumb {
    transform: scale(1.2);
  }
  .card .pill {
    align-self: center;
    height: 28px;
    margin-top: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .turning,
    .stream {
      animation: none;
    }
  }
</style>
