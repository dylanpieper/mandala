<script lang="ts">
  // Two notes combined into one, after one is held on the other and dropped.
  // A calm sheet over the page: the combined note, already put together.
  // Woven (lines both share once, each note's own lines in place, tinted
  // faintly by the note they came from), or one note after the other. Click
  // the page to change anything. Combine saves it into the note dropped on;
  // the dragged note rests for a day and can be restored.
  import { onDestroy, onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fade, fly } from 'svelte/transition';
  import { api } from '../lib/api';
  import type { Settled, Woven } from '../lib/types';
  import Icon from './Icon.svelte';

  let { into, dragged, onDone, onCancel }: { into: string; dragged: string; onDone: (s: Settled) => void; onCancel: () => void } = $props();

  type Way = 'woven' | 'into' | 'dragged';

  let host: HTMLDivElement;
  let rect = $state({ left: 0, top: 0, width: 0, height: 0 });
  let woven = $state<Woven | null>(null);
  let way = $state<Way>('woven');
  let editing = $state(false);
  let text = $state('');
  let saving = $state(false);
  let error = $state('');

  const name = (rel: string) => (rel.split('/').pop() ?? rel).replace(/\.md$/, '');
  const intoName = $derived(name(into));
  const draggedName = $derived(name(dragged));
  const order = $derived(
    way === 'dragged'
      ? [{ kind: 'dragged', name: draggedName }, { kind: 'into', name: intoName }]
      : [{ kind: 'into', name: intoName }, { kind: 'dragged', name: draggedName }],
  );

  const join = (a: string, b: string) => `${a.trimEnd()}\n\n${b.trimStart()}`;
  function textFor(w: Way): string {
    if (!woven) return '';
    if (w === 'woven') return woven.text;
    return w === 'into' ? join(woven.into, woven.dragged) : join(woven.dragged, woven.into);
  }

  function choose(w: Way) {
    way = w;
    editing = false;
    text = textFor(w);
  }

  function measure() {
    const r = (host.parentElement ?? host).getBoundingClientRect();
    rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  async function combine() {
    if (saving) return;
    saving = true;
    error = '';
    try {
      onDone(await api.combine(into, dragged, text));
    } catch (e) {
      error = String(e);
      saving = false;
    }
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  }

  onMount(async () => {
    measure();
    window.addEventListener('resize', measure);
    woven = await api.weave(into, dragged);
    text = woven.text;
  });
  onDestroy(() => window.removeEventListener('resize', measure));
</script>

<svelte:window onkeydown={key} />

<div class="combine" bind:this={host} style="left: {rect.left}px; top: {rect.top}px; width: {rect.width}px; height: {rect.height}px" transition:fade={{ duration: 260 }}>
  <div class="sheet" role="dialog" aria-label="Combine notes" transition:fly={{ y: 10, duration: 320 }}>
    <!-- The two notes in the order they will read: Last puts the first one
         last, and the names change places to show it. -->
    <header>
      {#each order as w, i (w.kind)}
        <span class="who" animate:flip={{ duration: 360 }}>{#if i === 1}<Icon name="plus" size={14} />{/if}<span class="dot {w.kind}"></span>{w.name}</span>
      {/each}
    </header>

    <div class="ways" role="radiogroup" aria-label="How to put them together">
      <button role="radio" aria-checked={way === 'woven'} class:on={way === 'woven'} onclick={() => choose('woven')}>Woven</button>
      <button role="radio" aria-checked={way === 'into'} class:on={way === 'into'} onclick={() => choose('into')}>First</button>
      <button role="radio" aria-checked={way === 'dragged'} class:on={way === 'dragged'} onclick={() => choose('dragged')}>Last</button>
    </div>

    {#if woven}
      {#if editing}
        <textarea class="page serif" bind:value={text} aria-label="The combined note" in:fade={{ duration: 160 }}></textarea>
      {:else}
        <!-- The page as it will read; a click turns it into text to change. -->
        <button class="page serif preview" onclick={() => (editing = true)} aria-label="The combined note. Click to change it." in:fade={{ duration: 200 }}>
          {#if way === 'woven' && text === woven.text}
            {#each woven.lines as l}<span class="line {l.from}">{l.text || ' '}</span>{/each}
          {:else}
            {#each text.split('\n') as l}<span class="line">{l || ' '}</span>{/each}
          {/if}
        </button>
      {/if}
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <footer>
      <button class="pill" onclick={onCancel}><Icon name="close" />Cancel</button>
      <button class="pill stone" disabled={!woven || saving} onclick={combine}><Icon name="both" />Combine</button>
    </footer>
  </div>
</div>

<style>
  .combine {
    position: fixed;
    z-index: 6;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgb(14 13 16 / 0.86);
    backdrop-filter: blur(6px);
  }
  .sheet {
    width: 100%;
    max-width: 680px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px 28px 20px;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.45);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--dust);
    font-size: 13px;
  }
  .who {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--bone);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .dot.into {
    background: var(--stone);
  }
  .dot.dragged {
    background: var(--sand);
  }
  .ways {
    align-self: center;
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    background: #121114;
    border: 1px solid var(--line);
  }
  .ways button {
    padding: 5px 14px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--ash);
    font-size: 12px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition:
      background var(--quick) var(--ease),
      color var(--quick) var(--ease);
  }
  .ways button:hover {
    color: var(--bone);
  }
  .ways button.on {
    background: var(--hover);
    color: var(--bone);
  }
  .page {
    flex: 1;
    min-height: 220px;
    max-height: 56vh;
    overflow-y: auto;
    width: 100%;
    padding: 18px 20px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: #121114;
    color: var(--bone);
    font-size: 17px;
    line-height: 1.6;
    text-align: left;
  }
  textarea.page {
    resize: none;
    outline: none;
  }
  textarea.page:focus {
    border-color: var(--line-strong);
  }
  .preview {
    display: flex;
    flex-direction: column;
    cursor: text;
    transition: border-color var(--quick) var(--ease);
  }
  .preview:hover {
    border-color: var(--line-strong);
  }
  .line {
    white-space: pre-wrap;
    padding-left: 10px;
    margin-left: -10px;
    border-left: 2px solid transparent;
  }
  /* Each note's own lines are marked faintly by its color; shared ones are not. */
  .line.into {
    border-left-color: var(--stone-line);
  }
  .line.dragged {
    border-left-color: var(--sand-line);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .pill {
    height: 30px;
  }
  .error {
    margin: 0;
    color: var(--vermilion);
  }
</style>
