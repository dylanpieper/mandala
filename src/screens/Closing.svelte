<script lang="ts">
  // Closing: the breaths written for this visit leave with it. If they cannot
  // settle, the window stays open and says why.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Icon from '../components/Icon.svelte';
  import { api } from '../lib/api';
  import { hold } from '../lib/hold';
  import type { NoteRef } from '../lib/types';

  // With `onLeft`, the person is changing vaults: the visit ends, the app stays.
  let { onStay, onLeft = null }: { onStay: () => void; onLeft?: (() => void) | null } = $props();

  let breaths = $state<NoteRef[]>([]);
  let leaving = $state(false);
  let error = $state('');

  onMount(async () => {
    try {
      breaths = await api.breaths();
    } catch (e) {
      error = String(e);
      return;
    }
    if (breaths.length === 0) close();
  });

  async function close() {
    error = '';
    leaving = true;
    await new Promise((r) => setTimeout(r, breaths.length ? 900 : 0));
    try {
      if (onLeft) {
        await api.leaveVault();
        onLeft();
      } else await api.closeVisit();
    } catch (e) {
      error = String(e);
      leaving = false;
    }
  }

  const count = ['No breaths', 'One breath', 'Two breaths', 'Three breaths'];
</script>

<div class="closing" class:leaving in:fade={{ duration: 400 }}>
  {#if breaths.length}
    <h1 class="serif">{count[breaths.length] ?? `${breaths.length} breaths`} will leave with you</h1>
    <ul class:leaving>
      {#each breaths as b, i (b.rel)}
        <li style="--i: {i}"><span class="serif">{b.title}</span></li>
      {/each}
    </ul>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if breaths.length || error}
    <div class="actions">
      <button class="pill large" onclick={onStay}><Icon name="back" />Stay</button>
      <button class="pill sand large" aria-label="Hold to close" use:hold={{ done: close }}><Icon name="wind" />Close</button>
    </div>
  {/if}
</div>

<style>
  .closing {
    height: 100%;
    background: var(--night);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 32px;
    padding: 48px 24px;
  }
  h1 {
    margin: 0;
    font-weight: 400;
    font-size: 40px;
    text-align: center;
  }
  .error {
    margin: 0;
    font-size: 15px;
    color: var(--vermilion);
  }
  /* A long list scrolls in place; the title and buttons stay in view. */
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: 560px;
    min-height: 0;
    overflow-y: auto;
    flex: 0 1 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  li {
    flex-shrink: 0;
    padding: 18px 22px;
    border: 1px solid var(--line);
    border-radius: 14px;
    font-size: 19px;
    transition:
      opacity 900ms var(--ease) calc(var(--i) * 80ms),
      letter-spacing 900ms var(--ease) calc(var(--i) * 80ms),
      filter 900ms var(--ease) calc(var(--i) * 80ms);
  }
  /* The title and the buttons fade with the breaths as they leave. */
  .closing h1,
  .closing .actions {
    transition: opacity 600ms var(--ease);
  }
  .closing.leaving h1,
  .closing.leaving .actions {
    opacity: 0;
    pointer-events: none;
  }
  /* The scrollbar goes while the breaths leave, so only they move. */
  ul.leaving {
    scrollbar-width: none;
  }
  ul.leaving::-webkit-scrollbar {
    display: none;
  }
  ul.leaving li {
    opacity: 0;
    letter-spacing: 0.2em;
    filter: blur(2px);
  }
  .actions {
    display: flex;
    gap: 12px;
  }
</style>
