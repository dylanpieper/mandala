<script lang="ts">
  // Which screen is showing. In a plain browser, `?screen=` jumps straight to
  // one (choose, arrange, opening, main, closing), for design work.
  import { onMount } from 'svelte';
  import { api, chooseFolder, onEvent } from './lib/api';
  import Arrange from './screens/Arrange.svelte';
  import Choose from './screens/Choose.svelte';
  import Closing from './screens/Closing.svelte';
  import Main from './screens/Main.svelte';
  import Opening from './screens/Opening.svelte';
  import type { VaultInfo } from './lib/types';
  import { restoreZoom, zoomKey } from './lib/zoom';
  import { leaving } from './lib/leaving';

  restoreZoom();

  type Screen = 'loading' | 'choose' | 'arrange' | 'opening' | 'main' | 'closing';
  let screen = $state<Screen>('loading');
  let vault = $state<VaultInfo | null>(null);
  let before = $state<Screen>('main');
  // Closing ends the visit and quits or, when changing vaults, ends it and
  // goes back to choosing.
  let changing = $state(false);
  // The folder to open once the closing screen ends this visit.
  let next = $state<string | null>(null);
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
    next = path;
    previous = { name: vault.name, root: vault.root };
    before = screen;
    changing = true;
    screen = 'closing';
  }

  async function left() {
    const path = next;
    next = null;
    vault = null;
    changing = false;
    error = '';
    if (path) await openVault(path);
    else screen = 'choose';
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
        // With a vault open, closing always passes the closing screen, so no
        // breath leaves unseen and a failed close is shown, not lost.
        // Closing the window while changing vaults turns the closing into a quit.
        changing = false;
        if (screen === 'closing') return;
        // The last save and rename finish first, even on a quick quit.
        await leaving();
        if (vault) {
          before = screen;
          screen = 'closing';
        } else api.closeVisit();
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
  <Opening onEnter={() => (screen = 'main')} />
{:else if screen === 'main' && vault}
  <Main vaultName={vault.name} vaultRoot={vault.root} onChangeVault={changeVault} />
{:else if screen === 'closing'}
  <Closing onStay={() => ((changing = false), (next = null), (screen = before))} onLeft={changing ? left : null} />
{/if}

<style>
  .drag {
    position: fixed;
    inset: 0 0 auto 0;
    height: 32px;
    z-index: 100;
  }
</style>
