// Every call the window makes. In Tauri these go to `src-tauri/src/main.rs`;
// in a plain browser (`npm run dev`) they go to `mock.ts`, so screens can be
// designed and tested without the app.

import type {
  Arrival,
  Carving,
  Follow,
  Hit,
  Mandala,
  Life,
  Note,
  NoteRef,
  Overview,
  Plan,
  Renamed,
  Settled,
  VaultInfo,
  Woven,
} from './types';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function call<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  const { mock } = await import('./mock');
  return mock(cmd, args) as Promise<T>;
}

export const api = {
  lastVault: () => call<string | null>('last_vault'),
  openVault: (path: string) => call<VaultInfo>('open_vault', { path }),
  arrangePlan: () => call<Plan>('arrange_plan'),
  arrange: (snapshot: boolean, only: string[] | null = null) => call<void>('arrange', { snapshot, only }),
  pendingDownloads: () => call<number>('pending_downloads'),
  arrive: () => call<Arrival>('arrive'),
  overview: () => call<Overview>('overview'),
  mandala: () => call<Mandala>('mandala'),
  readNote: (rel: string) => call<string>('read_note', { rel }),
  writeNote: (rel: string, text: string) => call<void>('write_note', { rel, text }),
  newSand: (title: string, life: Life) => call<string>('new_sand', { title, life }),
  setLife: (rel: string, life: Life) => call<string>('set_life', { rel, life }),
  /** A stone note back to sand, beginning `life` now. Returns its new path. */
  returnToSand: (rel: string, life: Life) => call<string>('return_to_sand', { rel, life }),
  moveStone: (rel: string, folder: string) => call<string>('move_stone', { rel, folder }),
  followHeading: (rel: string, opened: string) => call<Follow>('follow_heading', { rel, opened }),
  renameNote: (rel: string, stem: string) => call<Renamed>('rename_note', { rel, stem }),
  renameTo: (rel: string, title: string) => call<Follow>('rename_to', { rel, title }),
  setOrder: (rels: string[]) => call<void>('set_order', { rels }),
  keep: (rel: string, folder: string, because: string | null) => call<string>('keep', { rel, folder, because }),
  /** During a visit: lets go of timed sand that has run out. Nothing while sync is still downloading. */
  sweepRanOut: () => call<Settled[]>('sweep_ran_out'),
  deleteNote: (rel: string) => call<Settled>('delete_note', { rel }),
  restore: (id: string) => call<string>('restore', { id }),
  settling: () => call<Settled[]>('settling'),
  settledText: (id: string) => call<string>('settled_text', { id }),
  search: (query: string) => call<Hit[]>('search', { query }),
  backlinks: (title: string) => call<Note[]>('backlinks', { title }),
  carving: (rel: string) => call<Carving | null>('carving', { rel }),
  carve: (rel: string, text: string) => call<void>('carve', { rel, text }),
  weave: (into: string, dragged: string) => call<Woven>('weave', { into, dragged }),
  combine: (into: string, dragged: string, text: string) => call<Settled>('combine', { into, dragged, text }),
  removePicture: (name: string) => call<Settled>('remove_picture', { name }),
  closeVisit: () => call<void>('close_visit'),
  leaveVault: () => call<void>('leave_vault'),
};

export async function chooseFolder(): Promise<string | null> {
  if (!isTauri) return '/Users/you/Notes';
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({ directory: true, title: 'Choose your Obsidian vault' });
  return typeof picked === 'string' ? picked : null;
}

/** Show a folder in Finder (or File Explorer), selected. Nothing in a plain browser. */
export async function revealFolder(path: string): Promise<void> {
  if (!isTauri) return;
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
  await revealItemInDir(path);
}

/** Open a web or mail link in the person's default app. Other schemes are ignored. */
export async function openLink(url: string): Promise<void> {
  const href = /^www\./i.test(url) ? `https://${url}` : url;
  if (!/^(https?:|mailto:)/i.test(href)) return;
  if (!isTauri) {
    window.open(href, '_blank', 'noopener');
    return;
  }
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(href);
}

export async function onEvent(name: string, handler: () => void): Promise<() => void> {
  if (!isTauri) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  return listen(name, handler);
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
export const mimeOf = (name: string) => MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
const urls = new Map<string, Promise<string | null>>();

/**
 * A URL for a picture embedded as `name` (`![[name]]`), or null if there is
 * none. Bytes come raw from the core and are kept as a blob URL until the
 * picture changes (`forgetPicture`).
 */
export function pictureUrl(name: string): Promise<string | null> {
  let url = urls.get(name);
  if (!url) {
    url = readPicture(name)
      .then((bytes) => (bytes ? URL.createObjectURL(new Blob([bytes], { type: mimeOf(name) })) : null))
      .catch(() => null);
    urls.set(name, url);
  }
  return url;
}

export function forgetPicture(name: string) {
  urls.get(name)?.then((u) => u && URL.revokeObjectURL(u));
  urls.delete(name);
}

export async function readPicture(name: string): Promise<ArrayBuffer | null> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<ArrayBuffer>('picture', { name });
  }
  const { mockPicture } = await import('./mock');
  return mockPicture(name);
}

/** Save a picture; returns the name to embed. With `replace`, change an existing one. */
export async function savePicture(name: string, bytes: Uint8Array, replace = false): Promise<string> {
  forgetPicture(name);
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('save_picture', bytes, { headers: { name: encodeURIComponent(name), replace: replace ? '1' : '0' } });
  }
  const { mockSavePicture } = await import('./mock');
  return mockSavePicture(name, bytes, replace);
}
