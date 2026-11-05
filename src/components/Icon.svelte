<script lang="ts">
  // Stroke icons, drawn at 16 units. Add new ones here, never as emoji.
  type Name = 'search' | 'stone' | 'wind' | 'bell' | 'plus' | 'back' | 'next' | 'check' | 'commit' | 'restore' | 'folder' | 'quarter' | 'half' | 'full' | 'mandala' | 'chevron' | 'collapse' | 'expand' | 'pane-left' | 'pane-right' | 'pause' | 'play' | 'both' | 'help' | 'carve' | 'draw' | 'eraser' | 'close' | 'text' | 'table' | 'pen' | 'brush' | 'marker' | 'pencil' | 'hourglass' | 'sand' | 'sun' | 'breath' | 'broom';
  let { name, size = 16, on = false }: { name: Name; size?: number; on?: boolean } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'search'}
    <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
  {:else if name === 'stone'}
    <path d="M2 11.5C2 8 4.5 5 8 5s6 3 6 6.5c0 1-1 1.5-2 1.5H4c-1 0-2-.5-2-1.5Z" />
  {:else if name === 'wind'}
    <path d="M2 6c3-2 5 2 8 0s3-1 4-1M2 10c3-2 5 2 8 0s3-1 4-1" />
  {:else if name === 'broom'}
    <!-- Sweep: a long handle, the binding, and a flat head of bristles. -->
    <path d="M14 2L9 7" /><path d="M7.6 5.6l2.8 2.8" /><path d="M7.6 5.6L2.6 9.4l4 4 3.8-5" /><path d="M9 7L4.6 11.4" />
  {:else if name === 'bell'}
    <path d="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11Z" /><path d="M6.5 14h3" />
  {:else if name === 'plus'}
    <path d="M8 3v10M3 8h10" />
  {:else if name === 'back'}
    <path d="M10 3L5 8l5 5" />
  {:else if name === 'next'}
    <path d="M6 3l5 5-5 5" />
  {:else if name === 'check'}
    <path d="M3 8.5l3 3 7-7" />
  {:else if name === 'commit'}
    <circle cx="8" cy="8" r="2.5" /><path d="M1 8h4.5M10.5 8H15" />
  {:else if name === 'restore'}
    <path d="M3 8a5 5 0 1 0 1.5-3.5M3 2.5v3h3" />
  {:else if name === 'folder'}
    <path d="M2 4h4l1.5 1.5H14V12H2Z" />
  {:else if name === 'quarter'}
    <!-- Moons: the outline is the whole cycle, the lit part is the lifespan. -->
    <circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 0 1 0 12a3 6 0 0 0 0-12Z" fill="currentColor" stroke="none" />
  {:else if name === 'half'}
    <circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" stroke="none" />
  {:else if name === 'full'}
    <circle cx="8" cy="8" r="6" fill="currentColor" />
  {:else if name === 'mandala'}
    <circle cx="8" cy="8" r="6.5" /><circle cx="8" cy="8" r="1.6" /><path d="M8 1.5C9.8 4 9.8 6.2 8 6.2S6.2 4 8 1.5ZM8 14.5C9.8 12 9.8 9.8 8 9.8S6.2 12 8 14.5ZM1.5 8C4 9.8 6.2 9.8 6.2 8S4 6.2 1.5 8ZM14.5 8C12 9.8 9.8 9.8 9.8 8S12 6.2 14.5 8Z" />
  {:else if name === 'chevron'}
    <path d="M4.5 6.5L8 10l3.5-3.5" />
  {:else if name === 'collapse'}
    <path d="M4.5 2.5L8 6l3.5-3.5M4.5 13.5L8 10l3.5 3.5" />
  {:else if name === 'expand'}
    <path d="M4.5 5.5L8 2l3.5 3.5M4.5 10.5L8 14l3.5-3.5" />
  {:else if name === 'pause'}
    <path d="M6 4v8M10 4v8" />
  {:else if name === 'play'}
    <path d="M5.5 3.5v9l7-4.5Z" />
  {:else if name === 'pane-left'}
    <!-- A window and its side pane: the pane is filled while it shows. -->
    <rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M6.5 3v10" />
    {#if on}<rect x="2.6" y="3.6" width="3.4" height="8.8" rx="0.8" fill="currentColor" stroke="none" />{/if}
  {:else if name === 'pane-right'}
    <rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M9.5 3v10" />
    {#if on}<rect x="10" y="3.6" width="3.4" height="8.8" rx="0.8" fill="currentColor" stroke="none" />{/if}
  {:else if name === 'both'}
    <rect x="2.5" y="4.5" width="7" height="9" rx="1.5" /><path d="M6.5 4.5V3.5c0-.6.4-1 1-1h5c.6 0 1 .4 1 1v7c0 .6-.4 1-1 1h-3" />
  {:else if name === 'help'}
    <circle cx="8" cy="8" r="6.5" /><path d="M6.2 6.2a1.9 1.9 0 0 1 3.6.8c0 1.2-1.8 1.6-1.8 2.8" /><path d="M8 11.8v.2" />
  {:else if name === 'carve'}
    <!-- A chisel on stone: the reason a note was kept. -->
    <path d="M2.5 13.5h11" /><path d="M5 11l6.5-6.5 1.5 1.5L6.5 12.5H5Z" /><path d="M10 6l1.5 1.5" />
  {:else if name === 'draw'}
    <!-- A paintbrush over one broad sand stroke it has painted: the
         handle, the ferrule, a soft tip. The stroke runs under the tip and
         just below its point, so the point shows against the ground. -->
    <path d="M3.9 14.7c2.5-.5 4.6-.1 7.2-.6 1.3-.3 2.1-1 3.3-.9" stroke="var(--sand)" stroke-width="2.4" />
    <path d="M13.5 2.5l-5.2 5.2" /><path d="M7.2 7.4l1.4 1.4" /><path d="M7.4 9.1c-1.6-.4-3 .5-3.3 2.1-.2 1-.7 1.7-1.6 2.3 2.2.4 4.3-.1 5.2-1.6.5-.9.4-1.9-.3-2.8Z" />
  {:else if name === 'sun'}
    <!-- Lifespans: a sun lasts a day. -->
    <circle cx="8" cy="8" r="2.8" /><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
  {:else if name === 'breath'}
    <!-- A breath lasts one visit: a single wisp that curls away, lighter than the wind of letting go. -->
    <path d="M2 10c2.4-1.6 4.4 1 7-.4 1.8-1 2.6-3.1 1.3-4.1-1.1-.8-2.6 0-2.2 1.3" /><path d="M6 13c1.8-.6 3.4.2 5.2 0 1.2-.2 2.1-.7 2.8-1.4" opacity="0.5" />
  {:else if name === 'sand'}
    <!-- Three grains, fading: the sand rail's mark. -->
    <g fill="currentColor" stroke="none"><circle cx="4" cy="8" r="1.6" /><circle cx="8" cy="8" r="1.6" opacity="0.6" /><circle cx="12" cy="8" r="1.6" opacity="0.3" /></g>
  {:else if name === 'hourglass'}
    <!-- The title bar's hourglass (`Hourglass.svelte`), drawn at 16 units, with sand run through. -->
    <path d="M3.5 1.5h9M3.5 14.5h9" /><path d="M5 2c0 3.5 2.3 4.8 2.3 6S5 10.5 5 14h6c0-3.5-2.3-4.8-2.3-6S11 5.5 11 2Z" />
    <path d="M5.6 13.4c.6-1.4 1.4-2 2.4-2s1.8.6 2.4 2Z" fill="currentColor" stroke="none" />
  {:else if name === 'eraser'}
    <path d="M6 13.5h7.5" /><path d="M3 10.5l6.5-6.5 3.5 3.5-6 6H5.5Z" /><path d="M6.5 7l3.5 3.5" />
  {:else if name === 'close'}
    <path d="M4 4l8 8M12 4l-8 8" />
  {:else if name === 'text'}
    <path d="M3 4h10M3 7h10M3 10h7M3 13h5" />
  {:else if name === 'table'}
    <!-- A table: a frame, its header row, and one column line. -->
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M2.5 9.75h11M7 6.5V13" />
  {:else if name === 'pen'}
    <!-- Drawing tips. A pen: a fine nib, its slit, and the line it draws. -->
    <path d="M10.5 2.5l3 3-6.2 6.2-3.8.8.8-3.8Z" /><path d="M4.3 11.7l2-2" /><path d="M2.5 14h4" />
  {:else if name === 'brush'}
    <!-- A brush: a handle and a soft tip, no stroke under it. -->
    <path d="M13.5 2.5l-5.2 5.2" /><path d="M7.2 7.4l1.4 1.4" /><path d="M7.4 9.1c-1.6-.4-3 .5-3.3 2.1-.2 1-.7 1.7-1.6 2.3 2.2.4 4.3-.1 5.2-1.6.5-.9.4-1.9-.3-2.8Z" />
  {:else if name === 'marker'}
    <!-- A highlighter: a wide, cut tip over a broad band. -->
    <path d="M9.5 2.5l4 4-5 5H5.5v-3Z" /><path d="M5.5 11.5L3.5 13.5" /><path d="M2.5 14.5h11" stroke-width="2.2" opacity=".45" />
  {:else if name === 'pencil'}
    <!-- A pencil: a long body and a sharpened point. -->
    <path d="M11.5 2.5l2 2-8 8-3 1 1-3Z" /><path d="M10 4l2 2" /><path d="M3.5 10.5l2 2" />
  {/if}
</svg>
