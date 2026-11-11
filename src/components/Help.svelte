<script lang="ts">
  // A small card behind a `?` in the title bar: the shortcuts, then what
  // Mandala can do. Few words, and no how-to: the controls show that.
  import { fly } from 'svelte/transition';
  import { key } from '../lib/keys';
  import Icon from './Icon.svelte';

  let open = $state(false);
  let root: HTMLDivElement;

  const keys = [
    [key('N'), 'New note'],
    [key('P'), 'Search'],
    [key('F'), 'Find in note'],
    [key('M'), 'Mandala'],
    [key('T'), 'Hourglass'],
    [key('D'), 'Draw'],
    [key('['), 'Stone pane'],
    [key(']'), 'Sand pane'],
    [key('\\'), 'Focus'],
    [key('B'), 'Bold'],
    [key('I'), 'Italic'],
    [key('K'), 'Link'],
    [key('E'), 'Code'],
    [key('X', false, true), 'Strikethrough'],
    [key('/'), 'Source view'],
    [key('↩'), 'Set in stone'],
    [key('O'), 'Change vault'],
    [`${key('+')}/−`, 'Zoom'],
    ['Esc', 'Close'],
  ];
  // Each feature shows the icon, in the color, that its control has.
  const features = [
    ['stone', 'stone', 'Stone stays.'],
    ['sand', 'sand', 'Sand dissolves.'],
    ['wind', 'ash', 'What you let go drifts for a day.'],
    ['carve', 'stone', 'Carve why you keep a note.'],
    ['both', 'stone', 'Combine two notes into one.'],
    ['draw', 'ash', 'Draw or paste pictures into a note.'],
    ['hourglass', 'sand', 'The hourglass keeps your time.'],
    ['mandala', 'ash', 'The mandala shows every note’s life.'],
  ] as const;

  function outside(e: PointerEvent) {
    if (open && !root.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window onpointerdown={outside} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="help" bind:this={root}>
  <button class="pane" aria-label="Help" aria-expanded={open} title="Help" onclick={() => (open = !open)}><Icon name="help" /></button>
  {#if open}
    <div class="card" role="dialog" aria-label="Help" data-tauri-drag-region="false" transition:fly={{ y: -6, duration: 220 }}>
      <dl>
        {#each keys as [k, what]}<dt class="mono">{k}</dt><dd>{what}</dd>{/each}
      </dl>
      <ul class="features">
        {#each features as [icon, tone, what]}<li><span class="icon" style="color: var(--{tone})"><Icon name={icon} /></span>{what}</li>{/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .help {
    position: relative;
  }
  .pane {
    width: 28px;
    height: 28px;
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
  .pane:hover,
  .pane[aria-expanded='true'] {
    background: var(--hover);
    color: var(--bone);
  }
  .card {
    position: absolute;
    top: 36px;
    right: 0;
    z-index: 20;
    width: 290px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
  }
  dl {
    margin: 0;
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 9px 14px;
    font-size: 12px;
  }
  dt {
    color: var(--bone);
    font-size: 11px;
  }
  dd {
    margin: 0;
    color: var(--ash);
  }
  .features {
    list-style: none;
    margin: 0;
    padding: 12px 0 0;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 7px;
    font-size: 12px;
    color: var(--ash);
  }
  .features li {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .icon {
    flex: none;
    display: inline-flex;
  }
</style>
