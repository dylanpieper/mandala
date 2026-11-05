<script lang="ts">
  // A lifespan as the person sees it: its icon (a breath, a sun, a moon as
  // its phase) in its own faint color, named on hover and to screen readers.
  import { LIFE_LABEL } from '../lib/time';
  import type { Life } from '../lib/types';
  import Icon from './Icon.svelte';

  let { life, size = 14 }: { life: Life | null | undefined; size?: number } = $props();
  const tone = (l: Life) => (l === 'breath' || l === 'sun' ? l : 'moon');
</script>

{#if life}
  <span class="mark" style="color: var(--life-{tone(life)})" role="img" aria-label={LIFE_LABEL[life]} title={LIFE_LABEL[life]}><Icon name={life} {size} /></span>
{/if}

<style>
  .mark {
    display: inline-flex;
    vertical-align: -0.15em;
  }
</style>
