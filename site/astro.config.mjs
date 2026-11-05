import { defineConfig } from 'astro/config';

// The Mandala site: a static build for GitHub Pages (see
// docs/superpowers/specs/2026-11-02-site-design.md).
export default defineConfig({
  site: 'https://dylanpieper.github.io',
  base: '/mandala',
  // The teaser imports the app's own code from ../src.
  vite: { server: { fs: { allow: ['..'] } } },
});
