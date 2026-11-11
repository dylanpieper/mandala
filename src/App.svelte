<script lang="ts">
  // Which screen is showing. In a plain browser, `?screen=` jumps straight to
  // one (choose, arrange, opening, main), for design work.
  import { onMount } from 'svelte';
  import { api, chooseFolder, onEvent } from './lib/api';
  import Arrange from './screens/Arrange.svelte';
  import Choose from './screens/Choose.svelte';
  import Main from './screens/Main.svelte';
  import Opening from './screens/Opening.svelte';
  import type { Settled, VaultInfo } from './lib/types';
  import { restoreZoom, zoomKey } from './lib/zoom';
  import { leaving } from './lib/leaving';

  restoreZoom();

  type Screen = 'loading' | 'choose' | 'arrange' | 'opening' | 'main';
  let screen = $state<Screen>('loading');
  let vault = $state<VaultInfo | null>(null);
  // What left since the last visit, from the opening, for Main to name.
  let left = $state<Settled[]>([]);
  // The vault left behind, offered on the choose screen if the new one fails.
  let previous = $state<{ name: string; root: string } | null>(null);
  let error = $state('');

  async function openVault(path: string) {
    try {
      vault = await api.openVault(path);
      screen = vault.arranged ? 'opening' : 'arrange';
    } catch (e) {
      error = String(e);
      screen = 'choose';
    }
  }

  async function choose() {
    const path = await chooseFolder();
    if (path) await openVault(path);
  }

  // The folder is chosen first. Cancelling, or choosing this same vault,
  // changes nothing; only another folder ends the visit and opens it.
  async function changeVault() {
    const path = await chooseFolder();
    if (!path || !vault || path === vault.root) return;
    await leaving();
    previous = { name: vault.name, root: vault.root };
    try {
      await api.leaveVault();
    } catch (e) {
      error = String(e);
    }
    vault = null;
    left = [];
    await openVault(path);
  }

  async function goBack() {
    const to = previous;
    previous = null;
    error = '';
    if (to) await openVault(to.root);
  }

  onMount(() => {
    let unlisten = () => {};
    (async () => {
      unlisten = await onEvent('close-requested', async () => {
        // The last save and rename finish first; then the visit ends (its
        // breaths settle, and the next arrival names them) and Mandala quits.
        await leaving();
        await api.closeVisit();
      });
      const jump = new URLSearchParams(location.search).get('screen') as Screen | null;
      const last = await api.lastVault();
      if (last) await openVault(last);
      else screen = 'choose';
      if (jump) screen = jump;
    })();
    return () => unlisten();
  });
</script>

<svelte:window onkeydown={zoomKey} />

{#if screen !== 'main'}
  <!-- The main screen has its own title bar; the others drag by this strip. -->
  <div class="drag" data-tauri-drag-region></div>
{/if}

{#if screen === 'choose'}
  <Choose onChoose={choose} {error} back={previous?.name ?? null} onBack={goBack} />
{:else if screen === 'arrange' && vault}
  <Arrange root={vault.root} onDone={() => (screen = 'opening')} onChooseAnother={choose} />
{:else if screen === 'opening'}
  <Opening onEnter={(gone) => ((left = gone), (screen = 'main'))} />
{:else if screen === 'main' && vault}
  <Main vaultName={vault.name} vaultRoot={vault.root} onChangeVault={changeVault} {left} />
{/if}

<style>
  .drag {
    position: fixed;
    inset: 0 0 auto 0;
    height: 32px;
    z-index: 100;
  }
</style>
