<script lang="ts">
  // First open of a vault that isn't arranged. The folders chosen here become
  // stone, in place; the rest stay where they are, outside the mandala, and
  // are never swept. All are chosen at first. Two trees, as it is and as it
  // will be, drawn with branches; arranging is a hold, as keeping is.
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import Icon from '../components/Icon.svelte';
  import { api } from '../lib/api';
  import { hold } from '../lib/hold';
  import type { Plan } from '../lib/types';

  let { root, onDone, onChooseAnother }: { root: string; onDone: () => void; onChooseAnother: () => void } = $props();

  let plan = $state<Plan | null>(null);
  let chosen = $state<string[]>([]);
  let working = $state(false);
  let error = $state('');

  const vaultName = $derived(root.split(/[\\/]/).filter(Boolean).pop() ?? root);
  const kept = $derived(plan ? plan.moves.filter((m) => chosen.includes(m)) : []);
  const outside = $derived(plan ? plan.moves.filter((m) => !chosen.includes(m)) : []);
  const count = (m: string) => (plan ? plan.notes_in[plan.moves.indexOf(m)] : 0);
  const notes = $derived(kept.reduce((n, m) => n + count(m), 0));
  // A folder reads with its slash; a loose note keeps its extension.
  const shown = (m: string) => (/\.\w+$/.test(m) ? m : `${m}/`);

  onMount(async () => {
    plan = await api.arrangePlan();
    chosen = [...plan.moves];
  });

  async function arrange() {
    if (working) return;
    working = true;
    try {
      // Always a snapshot first (so arranging can be undone), and Obsidian's
      // new notes start as sand.
      await api.arrange(true, kept.length === plan!.moves.length ? null : kept);
      onDone();
    } catch (e) {
      error = String(e);
      working = false;
    }
  }
</script>

<div class="arrange" in:fade={{ duration: 500 }}>
  <div class="intro">
    <span class="mono path">{root}</span>
    <h1 class="serif">Arrange this vault as a mandala</h1>
  </div>

  {#if plan}
    <div class="trees">
      <section>
        <h2 class="eyebrow">As it is</h2>
        <div class="tree mono">
          <span class="root">{vaultName}/</span>
          <ul>
            {#each plan.moves as m}
              <li>
                <label class="pick">
                  <input type="checkbox" value={m} bind:group={chosen} />
                  <span class="name" class:off={!chosen.includes(m)}>{shown(m)}</span>
                  <span class="count">{count(m)}</span>
                </label>
              </li>
            {/each}
            {#each plan.left_in_place as m}<li class="dim">{shown(m)}</li>{/each}
          </ul>
        </div>
      </section>

      <svg class="arrow" width="48" height="16" viewBox="0 0 48 16" fill="none" aria-hidden="true"><path d="M2 8H44M39 3l5 5-5 5" stroke="var(--ash)" stroke-width="1.2" /></svg>

      <section>
        <h2 class="eyebrow">Arranged</h2>
        <div class="tree mono">
          <span class="root">{vaultName}/</span>
          <ul>
            <li>
              <span class="row stone"><Icon name="stone" size={14} />stone/<span class="count">{notes}</span></span>
              {#if kept.length}
                <ul>
                  {#each kept as m (m)}<li transition:slide={{ duration: 200 }}>{shown(m)}<span class="count">{count(m)}</span></li>{/each}
                </ul>
              {/if}
            </li>
            <li>
              <span class="row sandy"><Icon name="sand" size={14} />sand/</span>
              <ul>
                <li><span class="row"><span class="life" style="color: var(--life-breath)"><Icon name="breath" size={13} /></span>breath/</span></li>
                <li><span class="row"><span class="life" style="color: var(--life-sun)"><Icon name="sun" size={13} /></span>sun/</span></li>
                <li>
                  <span class="row"><span class="life" style="color: var(--life-moon)"><Icon name="full" size={13} /></span>moon/</span>
                  <ul>
                    <li><span class="row"><span class="life" style="color: var(--life-moon)"><Icon name="quarter" size={13} /></span>quarter/</span></li>
                    <li><span class="row"><span class="life" style="color: var(--life-moon)"><Icon name="half" size={13} /></span>half/</span></li>
                    <li><span class="row"><span class="life" style="color: var(--life-moon)"><Icon name="full" size={13} /></span>full/</span></li>
                  </ul>
                </li>
              </ul>
            </li>
            {#each outside as m (m)}<li class="out" transition:slide={{ duration: 200 }}>{shown(m)}<span class="count">{count(m)}</span></li>{/each}
            {#each plan.left_in_place as m}<li class="dim">{shown(m)}</li>{/each}
            <li class="dim">.mandala/</li>
          </ul>
        </div>
      </section>
    </div>

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <div class="actions">
      <button class="pill" onclick={onChooseAnother}><Icon name="folder" />Choose another vault</button>
      <button class="pill stone large" disabled={working} aria-label="Hold to arrange" use:hold={{ done: arrange }}><Icon name="stone" />{working ? 'Arranging…' : 'Arrange'}</button>
    </div>
  {/if}
</div>

<style>
  .arrange {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    padding: 56px 24px 40px;
  }
  .intro {
    flex: none;
    max-width: 640px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .path {
    font-size: 11px;
    color: var(--dust);
  }
  h1 {
    margin: 0;
    font-weight: 400;
    font-size: 40px;
  }
  p {
    margin: 0;
    color: var(--ash);
    font-size: 15px;
    line-height: 1.55;
  }
  /* The two cards start at the same top; the arrow sits by their headings.
     They take the height the window has, and their trees scroll inside. */
  .trees {
    width: 100%;
    max-width: 920px;
    flex: 0 1 auto;
    min-height: 0;
    display: flex;
    gap: 24px;
    align-items: flex-start;
  }
  .arrow {
    flex: none;
    margin-top: 64px;
  }
  section {
    flex: 1 1 0;
    min-width: 0;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 22px 24px;
  }
  .tree {
    min-height: 0;
    overflow-y: auto;
  }
  h2 {
    margin: 0 0 14px;
  }

  /* A tree drawn with branches: each item hangs from a line that runs down
     from its parent, and the last one ends the line. */
  .tree {
    font-size: 12px;
    color: var(--parchment);
  }
  .root {
    display: block;
    line-height: 28px;
    color: var(--bone);
  }
  .tree ul {
    list-style: none;
    margin: 0;
    padding: 0 0 0 7px;
  }
  .tree li ul {
    padding-left: 6px;
  }
  .tree li {
    position: relative;
    padding-left: 18px;
    line-height: 28px;
  }
  .tree li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 12px;
    height: 14px;
    border-left: 1px solid var(--line-strong);
    border-bottom: 1px solid var(--line-strong);
    border-bottom-left-radius: 4px;
  }
  .tree li::after {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 0;
    border-left: 1px solid var(--line-strong);
  }
  .tree li:last-child::after {
    display: none;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .life {
    display: inline-flex;
  }
  .count {
    margin-left: auto;
    float: right;
    font-family: var(--sans);
    color: var(--dust);
  }
  .stone {
    color: var(--stone);
  }
  .sandy {
    color: var(--sand);
  }
  .dim {
    color: var(--dust);
  }
  .actions {
    flex: none;
    width: 100%;
    max-width: 920px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .error {
    color: var(--vermilion);
  }
  .pick {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }
  .pick input {
    accent-color: var(--stone);
    margin: 0;
  }
  .pick .name {
    flex: 1;
    transition: color var(--quick) var(--ease);
  }
  .pick .name.off {
    color: var(--dust);
  }
  .pick .count {
    float: none;
  }

  @media (max-width: 760px) {
    .trees {
      flex: 1 1 auto;
      flex-direction: column;
      align-items: stretch;
    }
    section {
      min-height: 0;
      max-height: none;
    }
    .arrow {
      margin: 0 auto;
      transform: rotate(90deg);
    }
  }
</style>
