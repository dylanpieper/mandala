// The search sheet: Pagefind's index of the built site, loaded on first open.
// Nothing leaves the site.
import { withBase } from '../lib/base';

type Result = { url: string; excerpt: string; meta: { title?: string }; sub_results?: { title: string; url: string; excerpt: string }[] };
type Pagefind = {
  options: (o: Record<string, unknown>) => Promise<void>;
  debouncedSearch: (q: string, o?: object, ms?: number) => Promise<{ results: { data: () => Promise<Result> }[] } | null>;
};

let pagefind: Pagefind | null = null;
async function load(): Promise<Pagefind> {
  if (pagefind) return pagefind;
  const url = withBase('/pagefind/pagefind.js');
  pagefind = (await import(/* @vite-ignore */ url)) as Pagefind;
  await pagefind.options({ baseUrl: withBase('/'), excerptLength: 18 });
  return pagefind;
}

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

export function openSearch(): void {
  const sheet = document.querySelector<HTMLDialogElement>('[data-search]');
  if (!sheet || sheet.open) return;
  sheet.showModal();
  sheet.querySelector<HTMLInputElement>('input')?.select();
  void load();
}

function bind(): void {
  const sheet = document.querySelector<HTMLDialogElement>('[data-search]');
  if (!sheet || sheet.dataset.bound) return;
  sheet.dataset.bound = '1';
  const input = sheet.querySelector<HTMLInputElement>('input')!;
  const list = sheet.querySelector<HTMLOListElement>('ol')!;
  const empty = sheet.querySelector<HTMLElement>('[data-empty]')!;
  let active = 0;

  const mark = () => {
    [...list.children].forEach((li, i) => li.classList.toggle('on', i === active));
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (!q) {
      list.replaceChildren();
      empty.hidden = true;
      return;
    }
    const found = await (await load()).debouncedSearch(q, {}, 160);
    if (!found) return;
    const rows = await Promise.all(found.results.slice(0, 8).map((r) => r.data()));
    list.replaceChildren(
      ...rows.map((r) => {
        const sub = r.sub_results?.find((s) => s.url.includes('#')) ?? r.sub_results?.[0];
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = sub?.url ?? r.url;
        const t = document.createElement('span');
        t.className = 'title';
        t.textContent = sub && sub.title !== r.meta.title ? `${r.meta.title ?? ''} · ${sub.title}` : (r.meta.title ?? r.url);
        const ex = document.createElement('span');
        ex.className = 'excerpt';
        ex.innerHTML = sub?.excerpt ?? r.excerpt; // Pagefind encodes entities; only <mark> is HTML.
        a.append(t, ex);
        li.append(a);
        return li;
      }),
    );
    empty.hidden = rows.length > 0;
    active = 0;
    mark();
  });

  input.addEventListener('keydown', (e) => {
    const n = list.children.length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      active = (active + 1) % n;
      mark();
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      active = (active - 1 + n) % n;
      mark();
    } else if (e.key === 'Enter' && n) {
      e.preventDefault();
      list.children[active].querySelector('a')?.click();
    }
  });
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet || (e.target as Element).closest('a')) sheet.close();
  });
}

let keyBound = false;
export function startSearch(): void {
  bind();
  document.querySelectorAll('[data-open-search]').forEach((b) => b.addEventListener('click', openSearch));
  if (keyBound) return;
  keyBound = true;
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'k' && (isMac() ? e.metaKey : e.ctrlKey)) {
      e.preventDefault();
      openSearch();
    }
  });
}
