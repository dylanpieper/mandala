// Plays the teaser's loop on the window in Teaser.astro, with the app's own
// sand (src/lib/crumble.ts), runes (src/lib/rune.ts) and times (src/lib/time.ts).
import { crumble } from '../../../../src/lib/crumble';
import { runeOf, runeText } from '../../../../src/lib/rune';
import { timeLeft } from '../../../../src/lib/time';
import { TIMELINE, type Action } from './timeline';
import { POEM_PATH, REASON, SAND, sorted, type SandNote } from './notes';

const NARROW = '(max-width: 820px)';

export function runTeaser(root: HTMLElement): () => void {
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const iconOf = (name: string) => (root.querySelector<HTMLTemplateElement>(`template[data-icon="${name}"]`)!.content.firstElementChild!.cloneNode(true) as Element);
  const list = $('[data-list]');
  const LIFE_COLOR = { breath: 'var(--life-breath)', sun: 'var(--life-sun)', quarter: 'var(--life-moon)' } as const;

  let timers: number[] = [];
  let notes: SandNote[] = [];
  let selected: string | null = null;
  let pendingEnd: Promise<() => void> | null = null;
  let running = false;

  const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
  const narrow = () => matchMedia(NARROW).matches;
  const find = (id: string) => notes.find((n) => n.id === id)!;
  const rowOf = (id: string) => list.querySelector<HTMLElement>(`[data-id="${id}"]`);
  const iso = (left: number | null) => (left === null ? null : new Date(Date.now() + left * 60_000 + 30_000).toISOString());
  const share = (n: SandNote) => (n.left === null ? 0 : Math.max(0, n.left / n.span));

  function renderRow(n: SandNote): HTMLElement {
    const row = document.createElement('div');
    row.className = 'grain';
    row.dataset.id = n.id;
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = n.title;
    const m = document.createElement('span');
    m.className = 'm mono';
    const mark = document.createElement('span');
    mark.style.color = LIFE_COLOR[n.life];
    mark.style.display = 'flex';
    mark.append(iconOf(n.life));
    const left = document.createElement('span');
    left.className = 'left';
    m.append(mark, left);
    const b = document.createElement('span');
    b.className = 'b';
    b.append(document.createElement('i'));
    row.append(t, m, b);
    paintRow(row, n);
    return row;
  }

  function paintRow(row: HTMLElement, n: SandNote) {
    row.querySelector('.left')!.textContent = timeLeft(iso(n.left));
    row.querySelector<HTMLElement>('.b i')!.style.width = `${(share(n) * 100).toFixed(1)}%`;
    row.classList.toggle('low', n.left !== null && share(n) < 0.25);
    row.classList.toggle('on', n.id === selected);
  }

  function paintAll() {
    for (const n of notes) {
      const row = rowOf(n.id);
      if (row) paintRow(row, n);
    }
    $('[data-count]').textContent = `${notes.length} drifting`;
    const open = selected ? notes.find((n) => n.id === selected) : null;
    if (open) {
      $('[data-life-left]').textContent = timeLeft(iso(open.left));
      $('[data-ring]').setAttribute('stroke-dasharray', `${(56.5 * share(open)).toFixed(1)} 56.5`);
    }
  }

  /** Removes a row; the rows below close up over 600 ms, as the app's flip. */
  function closeUp(id: string) {
    const row = rowOf(id);
    if (!row) return;
    const rest = [...list.children].filter((c) => c !== row) as HTMLElement[];
    const before = rest.map((r) => r.getBoundingClientRect().top);
    row.remove();
    rest.forEach((r, i) => {
      const dy = before[i] - r.getBoundingClientRect().top;
      if (dy) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    });
    notes = notes.filter((n) => n.id !== id);
    paintAll();
  }

  function open(id: string, type = false) {
    selected = id;
    const n = find(id);
    const article = $('[data-article]');
    article.style.opacity = '1';
    $('[data-head]').style.opacity = '1';
    $('[data-title]').textContent = n.title;
    $('[data-crumb-title]').textContent = n.title;
    $('[data-crumb]').textContent = 'sand';
    const mark = $('[data-life-mark]');
    mark.replaceChildren(iconOf(n.life));
    mark.style.color = LIFE_COLOR[n.life];
    $('[data-life]').hidden = false;
    $('[data-carving]').hidden = true;
    $('[data-do]').hidden = false;
    // A new note's pills start unheld.
    root.querySelectorAll('[data-do] .fill.go').forEach((f) => f.classList.remove('go'));
    const text = $('[data-text]');
    const full = n.text ?? '';
    if (!type) text.textContent = full;
    else {
      let i = 0;
      const tick = () => {
        text.innerHTML = '';
        text.append(full.slice(0, i), Object.assign(document.createElement('span'), { className: 'caret' }));
        if (i++ < full.length) later(26, tick);
      };
      tick();
    }
    paintAll();
  }

  function hold(kind: 'letgo' | 'keep', id: string) {
    if (narrow()) {
      const h = document.createElement('span');
      h.className = `hold ${kind === 'letgo' ? 'letgo' : ''}`;
      rowOf(id)?.append(h);
      requestAnimationFrame(() => requestAnimationFrame(() => h.classList.add('go')));
    } else {
      const fill = $(`[data-${kind}] .fill`);
      requestAnimationFrame(() => requestAnimationFrame(() => fill.classList.add('go')));
    }
  }

  function toast(text: string) {
    const t = $('[data-toast]');
    $('[data-toast-text]').textContent = text;
    t.classList.add('on');
    later(2400, () => t.classList.remove('on'));
  }

  const strokes = runeOf(runeText(REASON, POEM_PATH));
  const ns = 'http://www.w3.org/2000/svg';
  const path = (d: string, cls: string) => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', cls);
    return p;
  };

  const actions: Record<Action, () => void> = {
    'type-poem': () => open('poem', true),
    'time-runs': () => {
      for (let k = 1; k <= 6; k++)
        later(k * 220, () => {
          for (const n of notes) if (n.left !== null) n.left = Math.max(1, n.left - (n.id === 'movie' ? 1 : 2));
          paintAll();
        });
    },
    'ideas-opens': () => open('ideas'),
    'hold-let-go': () => hold('letgo', 'ideas'),
    'crumble-page': () => {
      if (narrow()) return;
      pendingEnd = crumble([$('[data-article]')], [$('[data-head]')], 'sand');
    },
    'rows-close': () => {
      const going = notes.find((n) => n.id === 'ideas') ?? notes.find((n) => n.id === 'movie' && n.left === 0);
      if (!going) return;
      closeUp(going.id);
      toast(`“${going.title}” ${going.id === 'ideas' ? 'let go' : 'ran out'}`);
      if (going.id === 'ideas') {
        const end = pendingEnd;
        pendingEnd = null;
        open('list');
        end?.then((f) => f());
      }
    },
    'movie-runs-out': () => {
      find('movie').left = 0;
      paintAll();
    },
    'hold-keep': () => hold('keep', 'poem'),
    'card-opens': () => {
      $('[data-why]').textContent = REASON;
      const g = $('[data-card-rune]');
      g.replaceChildren(...strokes.map((d) => path(d, 'ghost')));
      $('[data-card-ring]').setAttribute('stroke-dasharray', '0 377');
      $('[data-card]').classList.add('on');
      root.classList.add('keeping');
    },
    'ring-carves': () => {
      // As in the app's keep card: the whole rune glows in and brightens over
      // three seconds, then a solid stroke paints it on, left to right.
      const ring = $('[data-card-ring]');
      const g = $('[data-card-rune]');
      const glow = document.createElementNS(ns, 'g');
      glow.setAttribute('class', 'glow');
      const paint = document.createElementNS(ns, 'g');
      paint.setAttribute('class', 'paint');
      for (const d of strokes) {
        glow.append(path(d, ''));
        paint.append(path(d, ''));
      }
      g.append(glow, paint);
      const start = performance.now();
      const step = (t: number) => {
        if (!running) return;
        const k = Math.min(1, (t - start) / 3000);
        ring.setAttribute('stroke-dasharray', `${(377 * k).toFixed(1)} 377`);
        (glow as unknown as HTMLElement).style.setProperty('--glow', String(k));
        if (k < 1) requestAnimationFrame(step);
        else paint.classList.add('painted');
      };
      requestAnimationFrame(step);
    },
    'card-closes': () => {
      $('[data-card]').classList.remove('on');
      root.classList.remove('keeping');
      $('[data-life]').hidden = true;
      $('[data-do]').hidden = true;
      const rune = $('[data-carving-rune]');
      rune.replaceChildren(...strokes.map((d) => path(d, '')));
      $('[data-carving-text]').textContent = REASON;
      $('[data-carving]').hidden = false;
      $('[data-crumb]').textContent = 'poems';
    },
    'row-to-stone': () => {
      const row = rowOf('poem');
      const landing = $('[data-landing]');
      landing.classList.add('here');
      landing.style.opacity = '0';
      if (!row) return;
      const from = row.getBoundingClientRect();
      const to = landing.getBoundingClientRect();
      const box = root.getBoundingClientRect();
      const fly = document.createElement('div');
      fly.textContent = 'Low tide';
      Object.assign(fly.style, {
        position: 'absolute',
        left: `${from.left - box.left}px`,
        top: `${from.top - box.top}px`,
        width: `${to.width}px`,
        padding: '6px 8px 6px 22px',
        borderRadius: '6px',
        background: 'var(--stone-ground)',
        color: 'var(--stone)',
        zIndex: '5',
      });
      root.append(fly);
      row.style.visibility = 'hidden';
      fly
        .animate([{ transform: 'none' }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px)` }], { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' })
        .finished.then(() => {
          fly.remove();
          landing.style.opacity = '';
          landing.classList.add('on');
          $('[data-kept]').textContent = '5 kept';
        })
        .catch(() => fly.remove());
      later(300, () => closeUp('poem'));
    },
    'fade-out': () => root.classList.add('fading'),
    restart: () => start(),
  };

  function reset() {
    timers.forEach(clearTimeout);
    timers = [];
    root.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    root.classList.remove('fading', 'keeping');
    root.querySelectorAll('.go').forEach((e) => e.classList.remove('go'));
    root.querySelectorAll('.hold').forEach((e) => e.remove());
    $('[data-card]').classList.remove('on');
    $('[data-toast]').classList.remove('on');
    const landing = $('[data-landing]');
    landing.classList.remove('here', 'on');
    $('[data-kept]').textContent = '4 kept';
    notes = sorted(SAND.map((n) => ({ ...n })));
    selected = null;
    list.replaceChildren(...notes.map(renderRow));
    pendingEnd?.then((f) => f());
    pendingEnd = null;
  }

  function start() {
    running = true;
    reset();
    for (const b of TIMELINE) later(b.at, actions[b.do]);
  }

  function stop() {
    running = false;
    timers.forEach(clearTimeout);
    timers = [];
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reset();
    open('poem');
    return () => {};
  }

  const onVisible = () => (document.hidden ? stop() : start());
  const mq = matchMedia(NARROW);
  // Never in a hidden tab: rAF does not run there, so the sand canvases would pile up.
  const onNarrow = () => !document.hidden && start();
  document.addEventListener('visibilitychange', onVisible);
  mq.addEventListener('change', onNarrow);
  if (!document.hidden) start();
  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisible);
    mq.removeEventListener('change', onNarrow);
  };
}
