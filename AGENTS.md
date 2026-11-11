# AGENTS.md

Mandala is a desktop app for markdown notes that dissolve unless you keep them. It works on a vault folder of plain markdown. Every new note is sand with a lifespan; a note is stone only when someone keeps it. A Rust core (`crates/mandala-core`) owns every rule, a Tauri 2 shell (`src-tauri`) forwards commands, and a Svelte 5 window (`src/`) only shows and asks.

The docs are in `site/docs/`, and the website shows them. Read `site/docs/working.md` first, then the doc for the part you change.

## Rules that hold everywhere

- Nothing is swept while Mandala is closed. Sand that runs out while it is open settles at once, even when its window is not in front (`sweep_ran_out`). What ran out while it was closed settles at the next arrival, after sync. Breaths settle at the close.
- Never sweep from a stale view: wait until `pending_downloads()` is 0.
- Nothing is deleted outright: a note settles for 24 hours in `.mandala/settling/`.
- Every write goes through `fsx::write_atomic`.
- Never name a file `Name 2.md`; use `fsx::unique_path`.
- Lifespans extend only when the person chooses it in Mandala (`Grain::restart`); any other change goes through `Grain::relife`.
- `Elsewhere` notes are never swept.
- Every path from the window goes through `Vault::path`.
- A new command touches `src-tauri/src/main.rs`, `src/lib/api.ts`, `src/lib/types.ts` and `src/lib/mock.ts`.
- One kind of button, `.pill`, with a stroke icon. No emoji.
- No network, in the app or the site.
- Nothing changes from one frame to the next; no line ends with one or two words.
- Never point a test or an experiment at the real vault. Use `scripts/sample-vault.sh`.

## Before you edit, read

| You are about to touch | Read first |
|---|---|
| Anything in `crates/mandala-core` | `site/docs/vault.md` |
| `visit.rs`, `Opening.svelte` | `site/docs/product.md` |
| `copies.rs`, `combine.rs`, `Combine.svelte` | `site/docs/combine.md` |
| `src/editor/*`, `Editor.svelte` | `site/docs/editor.md` |
| Any screen, component, color, spacing or motion | `site/docs/design.md` |
| The website in `site/` | `site/README.md` |

## Checks

Before saying work is done:

```
cargo test -p mandala-core
cargo clippy --workspace
npm run check
npm test
```

For anything visible, take screenshots and look at them (`node scripts/screens.cjs`). For the site, run `npm test` and `npm run build` in `site/`.
