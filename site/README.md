# The Mandala site

The home page and the docs explorer, built with Astro 7.4 and published to GitHub Pages. The docs themselves are in `docs/` here; `src/lib/docs.ts` says which page shows which file. It needs Node 22.23 or later and npm 11.

```
npm install
npm run dev
npm test
npm run build
```

`npm run dev` serves the site at `http://localhost:4321/mandala/`. `npm run build` writes `dist/` and its search index.

Astro 7 renders `.md` with its own engine, so the site renders the repository's markdown with its own unified pipeline (`src/lib/markdown.ts`). Unclosed tags in `.astro` files are build errors.
