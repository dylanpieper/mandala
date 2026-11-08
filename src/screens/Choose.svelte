<script lang="ts">
  import { fade } from 'svelte/transition';
  import Glyph from '../components/Glyph.svelte';
  import Icon from '../components/Icon.svelte';

  // `back`: the vault left behind, when another one did not open.
  let { onChoose, error = '', back = null, onBack }: { onChoose: () => void; error?: string; back?: string | null; onBack?: () => void } = $props();
</script>

<div class="choose" in:fade={{ duration: 600 }}>
  <Glyph size={72} stroke={0.5} />
  <h1 class="serif">Mandala</h1>
  <button class="pill sand large" onclick={onChoose}><Icon name="folder" />Choose a vault</button>
  {#if back}<button class="pill" onclick={onBack}><Icon name="back" />Back to {back}</button>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .choose {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    text-align: center;
    padding: 24px;
    background: var(--night);
  }
  h1 {
    margin: 0;
    font-weight: 400;
    font-size: 44px;
  }
  p {
    margin: 0 0 8px;
    color: var(--ash);
    font-size: 15px;
    max-width: 420px;
    line-height: 1.55;
  }
  .error {
    color: var(--vermilion);
  }
</style>
