<script lang="ts">
  // The title bar: the hourglass on the left, the vault and the open note's
  // folders in the middle, and on the right the mandala, search, help and the
  // pane toggles. The whole bar drags the window ("deep"); its buttons stay
  // clickable.
  import Glyph from './Glyph.svelte';
  import Help from './Help.svelte';
  import Hourglass from './Hourglass.svelte';
  import Icon from './Icon.svelte';
  import { key } from '../lib/keys';
  import { panes, togglePane } from '../lib/panes.svelte';

  let {
    vaultName,
    crumbs,
    viewing,
    onChangeVault,
    onToggleMandala,
    onSearch,
  }: { vaultName: string; crumbs: string[]; viewing: boolean; onChangeVault: () => void; onToggleMandala: () => void; onSearch: () => void } = $props();

  // The vault's name gives way when the title bar is too narrow for it beside
  // the hourglass and the actions: its column shrinks, and it fades rather
  // than be cut. Only its opacity changes, so the check cannot flip back.
  let squeezed = $state(false);
  function squeeze(el: HTMLElement) {
    const look = () => (squeezed = el.scrollWidth > el.clientWidth + 1);
    const observer = new ResizeObserver(look);
    observer.observe(el);
    return { destroy: () => observer.disconnect() };
  }
</script>

<header class="titlebar" data-tauri-drag-region="deep">
  <div class="start">
    <Hourglass />
  </div>
  <div class="crumbs" class:squeezed use:squeeze inert={squeezed}>
    <Glyph />
    <button class="vault" title="Change vault {key('O')}" onclick={onChangeVault}>{vaultName}<Icon name="folder" size={14} /></button>
    {#each crumbs as c}<span class="path"><span class="sep">/</span><span>{c}</span></span>{/each}
  </div>
  <div class="actions">
    <button class="pill" class:on={viewing} aria-pressed={viewing} onclick={onToggleMandala}><Icon name="mandala" />Mandala <span class="mono key">{key('M')}</span></button>
    <button class="pill" onclick={onSearch}><Icon name="search" />Search <span class="mono key">{key('P')}</span></button>
    <Help />
    <div class="panes">
      <button class="pane" aria-label="Show stone ({key('[')})" aria-pressed={panes.stone} title="Stone {key('[')}" onclick={() => togglePane('stone')}><Icon name="pane-left" on={panes.stone} /></button>
      <button class="pane" aria-label="Show sand ({key(']')})" aria-pressed={panes.sand} title="Sand {key(']')}" onclick={() => togglePane('sand')}><Icon name="pane-right" on={panes.sand} /></button>
    </div>
  </div>
</header>

<style>
  /* Off a Mac the window has its own title bar, so no room is kept for buttons. */
  :global(html[data-os='other']) .titlebar {
    padding-left: 14px;
  }
  .titlebar {
    height: 44px;
    flex-shrink: 0;
    display: grid;
    /* The hourglass and the actions never shrink past their width; the
       vault's column gives way between them (see `squeeze`). */
    grid-template-columns: minmax(max-content, 1fr) minmax(0, auto) minmax(max-content, 1fr);
    column-gap: 16px;
    align-items: center;
    padding: 0 14px 0 84px; /* room for the window's own buttons */
    border-bottom: 1px solid var(--line);
    background: var(--rail);
  }
  .crumbs {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    /* Room inside the clip for the vault's hover background. */
    padding: 2px 6px;
    overflow: hidden;
    white-space: nowrap;
    color: var(--ash);
    transition: opacity var(--quick) var(--ease);
  }
  .crumbs.squeezed {
    opacity: 0;
  }
  .crumbs .path {
    display: contents;
  }
  /* The vault's name changes the vault; its folder shows on hover. */
  .vault {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 6px;
    margin: 0 -6px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--bone);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background var(--quick) var(--ease);
  }
  .vault :global(svg) {
    color: var(--ash);
    opacity: 0;
    transition: opacity var(--quick) var(--ease);
  }
  .vault:hover,
  .vault:focus-visible {
    background: var(--hover);
  }
  .vault:hover :global(svg),
  .vault:focus-visible :global(svg) {
    opacity: 1;
  }
  .sep {
    color: var(--dust);
  }
  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    align-items: center;
  }
  .start {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .panes {
    display: flex;
    gap: 0;
    margin-left: 2px;
  }
  /* Pane toggles, as in an editor: a window icon whose side fills while that rail shows. */
  .pane {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--dust);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background var(--quick) var(--ease), color var(--quick) var(--ease);
  }
  .pane:hover {
    background: var(--hover);
    color: var(--bone);
  }
  .pane[aria-pressed='true'] {
    color: var(--ash);
  }
  .pill {
    height: 28px;
    white-space: nowrap;
  }
  .pill.on {
    color: var(--sand);
    border-color: var(--sand-line);
  }
  .key {
    color: var(--dust);
  }
  /* A narrow bar has no room for the keys; the help card still lists them. */
  @media (max-width: 1100px) {
    .key {
      display: none;
    }
  }
  /* No room for the note's folders beside the actions; the vault stays. */
  @media (max-width: 900px) {
    .crumbs .path {
      display: none;
    }
  }
</style>
