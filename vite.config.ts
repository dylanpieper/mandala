import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Tauri expects a fixed port and no screen clearing, so its own logs stay visible.
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**', '**/crates/**', '**/target/**'] },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
