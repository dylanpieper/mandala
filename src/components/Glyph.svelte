<script lang="ts">
  // Mandala's mark: a circle, four petals, a centre.
  let { size = 18, color = 'var(--sand)', stroke = 1.2 }: { size?: number; color?: string; stroke?: number } = $props();
</script>

<svg width={size} height={size} viewBox="-12 -12 24 24" fill="none" stroke={color} stroke-width={stroke} aria-hidden="true">
  <circle r="10.5" />
  <circle r="3" />
  <path d="M0-10.5C3-6 3-3 0-3C-3-3-3-6 0-10.5ZM0 10.5C3 6 3 3 0 3C-3 3-3 6 0 10.5ZM-10.5 0C-6 3-3 3-3 0C-3-3-6-3-10.5 0ZM10.5 0C6 3 3 3 3 0C3-3 6-3 10.5 0Z" />
</svg>
