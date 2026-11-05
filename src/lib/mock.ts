// A small vault in memory, standing in for `src-tauri` when the window runs
// in a plain browser (`npm run dev`). It lets every screen be designed,
// screenshotted and tested without the app. It is not the real logic: that
// lives, tested, in `crates/mandala-core`.

import type { Arrival, Carving, Follow, Hit, Life, Mandala, Note, NoteRef, Overview, Plan, Renamed, Settled, VaultInfo, Woven, WovenLine } from './types';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const MONTH = 29.530589 * DAY;
const DURATION: Record<Life, number | null> = { breath: null, sun: DAY, quarter: MONTH / 4, half: MONTH / 2, full: MONTH };
const FOLDER: Record<Life, string> = {
  breath: 'sand/breath',
  sun: 'sand/sun',
  quarter: 'sand/moon/quarter',
  half: 'sand/moon/half',
  full: 'sand/moon/full',
};

const LIVES: Life[] = ['breath', 'sun', 'quarter', 'half', 'full'];

// The person's own order, as `.mandala/order.json` keeps it.
let order: string[] = [];
// Folders in stone stay after their last note leaves, as on disk.
const stoneFolders = new Set<string>();
function byOrder<T extends { rel: string }>(items: T[]): T[] {
  const rank = (r: string) => (order.includes(r) ? order.indexOf(r) : order.length);
  return [...items].sort((a, b) => rank(a.rel) - rank(b.rel));
}
function moved(from: string, to: string) {
  order = order.map((r) => (r === from ? to : r));
  const c = carvings.get(from);
  if (c) {
    carvings.delete(from);
    carvings.set(to, c);
  }
}

const carvings = new Map<string, Carving>([['stone/Practice/Impermanence.md', { text: 'The first full sit.', at: new Date(Date.now() - 40 * 86400000).toISOString() }]]);

const now = Date.now();
const iso = (t: number) => new Date(t).toISOString();

interface Grain {
  life: Life;
  written: number;
}

const notes = new Map<string, string>([
  ['sand/sun/Drifts in ten seconds.md', '# Drifts in ten seconds\n\nWatch it go. Restore brings it back.\n'],
  ['stone/Practice/Impermanence.md', '# Impermanence\n\nThe sand mandala takes days to build and a minute to sweep.\n\nThe monks pour the sand into the river, so it travels on.\n'],
  ['stone/Practice/Sitting log.md', '# Sitting log\n\n- 31 Oct: twenty minutes, the whole way.\n- 30 Oct: twelve.\n'],
  ['stone/Practice/Metta phrases.md', '# Metta phrases\n\nMay you be safe. May you be well.\n'],
  ['stone/Reading/Beginner’s mind.md', '# Beginner’s mind\n\nIn the beginner’s mind there are many possibilities.\n'],
  ['stone/Reading/Ryōkan, poems.md', '# Ryōkan, poems\n\nThe thief left it behind: the moon at my window.\n'],
  ['stone/Letters/To my brother.md', '# To my brother\n\n'],
  [
    'sand/sun/Morning pages.md',
    '# Morning pages\n\nSat for the full twenty minutes for the first time this month. The bell at the end sounded further away than it was. Thinking about [[Impermanence]] again, and how the monks sweep the mandala the moment it is finished.\n\n> Everything changes, nothing is lost. Only the form.\n\n- [x] Sit before coffee\n- [ ] Call J. — **don’t** send the letter\n- [ ] Walk the river path at dusk\n\nWhat I want to remember is not the thought itself but the *quiet* before it, the way the room held still and then\n',
  ],
  ['sand/breath/Phone number for the framer.md', '# Phone number for the framer\n\n0161 496 0734, ask about the oak frame.\n'],
  ['sand/sun/Groceries, Saturday.md', '# Groceries, Saturday\n\n- [ ] miso\n- [ ] leeks\n- [ ] two lemons\n'],
  ['sand/moon/quarter/Walking meditation route.md', '# Walking meditation route\n\nRiver path, the long bend, back by the allotments.\n'],
  ['sand/moon/half/To J., unsent.md', '# To J., unsent\n\nI keep starting this.\n'],
  ['sand/moon/full/Half a poem about rain.md', '# Half a poem about rain\n\nThe gutters learn the shape of the street\n'],
  // More of a life, so the mandala view has a shape to draw.
  ['stone/Practice/Body scan.md', '# Body scan\n\nFrom the crown down. See [[Sitting log]].\n'],
  ['stone/Practice/Walking.md', '# Walking\n\nSlow enough to feel the heel land. [[Walking meditation route]]\n'],
  ['stone/Practice/Retreat, spring.md', '# Retreat, spring\n\nTen days of silence. [[Impermanence]], [[Metta phrases]].\n'],
  ['stone/Reading/Basho.md', '# Bashō\n\nThe old pond. [[Ryōkan, poems]]\n'],
  ['stone/Reading/Thich Nhat Hanh.md', '# Thich Nhat Hanh\n\nWashing the dishes to wash the dishes. [[Beginner’s mind]]\n'],
  ['stone/Reading/Reading list.md', '# Reading list\n\n- [[Basho]]\n- [[Thich Nhat Hanh]]\n- [[Beginner’s mind]]\n'],
  ['stone/Letters/To my mother.md', '# To my mother\n\nThe garden in October.\n'],
  ['stone/Letters/From A., kept.md', '# From A., kept\n\nShe wrote about the sea.\n'],
  ['stone/Recipes/Miso soup.md', '# Miso soup\n\nDashi first. [[Groceries, Saturday]]\n'],
  ['stone/Recipes/Bread.md', '# Bread\n\nA slow rise overnight.\n'],
  ['stone/Recipes/Dal.md', '# Dal\n\nRed lentils, cumin, a lemon at the end.\n'],
  ['stone/Work/Principles.md', '# Principles\n\nDo the next right thing.\n'],
  ['stone/Work/Q4 goals.md', '# Q4 goals\n\nShip the small thing first. [[Principles]]\n'],
  ['stone/Inbox.md', '# Inbox\n\n- [ ] call the framer\n'],
  ['stone/Someday.md', '# Someday\n\nKyoto in autumn.\n'],
  ['sand/sun/Dream, the lighthouse.md', '# Dream, the lighthouse\n\nThe stairs kept going.\n'],
  ['sand/sun/Idea for the garden.md', '# Idea for the garden\n\nA bench under the pear. [[Someday]]\n'],
  ['sand/breath/Parking, level 3.md', '# Parking, level 3\n\nBay 41.\n'],
  ['sand/moon/quarter/Questions for Thursday.md', '# Questions for Thursday\n\nAsk about [[Q4 goals]].\n'],
  ['sand/moon/quarter/Bread, attempt 2.md', '# Bread, attempt 2\n\nLess water. [[Bread]]\n'],
  ['sand/moon/half/Gift ideas.md', '# Gift ideas\n\nA [[Basho]] translation for A.\n'],
  ['sand/moon/half/Something A. said.md', '# Something A. said\n\nThat the sea is never the same twice.\n'],
  ['sand/moon/full/Notes on silence.md', '# Notes on silence\n\nAfter the [[Retreat, spring]].\n'],
  ['sand/moon/full/Running.md', '# Running\n\nThree times a week, slowly.\n'],
]);

const grains = new Map<string, Grain>([
  // Runs out ten seconds after the page loads, to watch sand let go on its own.
  ['sand/sun/Drifts in ten seconds.md', { life: 'sun', written: now - DAY + 10_000 }],
  ['sand/sun/Morning pages.md', { life: 'sun', written: now - 17 * HOUR - 20 * MIN }],
  ['sand/breath/Phone number for the framer.md', { life: 'breath', written: now - 20 * MIN }],
  ['sand/sun/Groceries, Saturday.md', { life: 'sun', written: now - 20 * HOUR - 55 * MIN }],
  ['sand/moon/quarter/Walking meditation route.md', { life: 'quarter', written: now - 1.3 * DAY }],
  ['sand/moon/half/To J., unsent.md', { life: 'half', written: now - 3.8 * DAY }],
  ['sand/moon/full/Half a poem about rain.md', { life: 'full', written: now - 10.5 * DAY }],
  ['sand/sun/Dream, the lighthouse.md', { life: 'sun', written: now - 3 * HOUR }],
  ['sand/sun/Idea for the garden.md', { life: 'sun', written: now - 9 * HOUR }],
  ['sand/breath/Parking, level 3.md', { life: 'breath', written: now - 50 * MIN }],
  ['sand/moon/quarter/Questions for Thursday.md', { life: 'quarter', written: now - 5 * DAY }],
  ['sand/moon/quarter/Bread, attempt 2.md', { life: 'quarter', written: now - 0.4 * DAY }],
  ['sand/moon/half/Gift ideas.md', { life: 'half', written: now - 9 * DAY }],
  ['sand/moon/half/Something A. said.md', { life: 'half', written: now - 13 * DAY }],
  ['sand/moon/full/Notes on silence.md', { life: 'full', written: now - 2 * DAY }],
  ['sand/moon/full/Running.md', { life: 'full', written: now - 24 * DAY }],
]);

const title = (rel: string) => rel.split('/').pop()!.replace(/\.md$/, '');

const settling: { s: Settled; text: string }[] = [
  ['sand/sun/A worry about Tuesday.md', 'deleted', 2],
  ['sand/sun/Shopping, Wednesday.md', 'swept', 9],
  ['sand/breath/Dream, the station.md', 'swept', 17],
  ['sand/moon/quarter/Old plan.md', 'swept', 22],
].map(([rel, reason, hours], i) => ({
  s: { id: `seed-${i}`, rel, title: title(rel as string), reason, at: iso(now - (hours as number) * HOUR) } as Settled,
  text: `# ${title(rel as string)}\n\n`,
}));

const dissolves = (g: Grain) => (DURATION[g.life] === null ? null : g.written + DURATION[g.life]!);
const ref = (rel: string, g: Grain): NoteRef => ({
  rel,
  title: title(rel),
  life: g.life,
  written: iso(g.written),
  dissolves: dissolves(g) === null ? null : iso(dissolves(g)!),
});
const note = (rel: string): Note => ({
  rel,
  title: title(rel),
  place: rel.startsWith('stone/') ? { kind: 'stone' } : { kind: 'sand', life: grains.get(rel)?.life ?? 'sun' },
  modified: iso(now - 2 * HOUR),
});

function settle(rel: string, reason: Settled['reason']): Settled {
  const s: Settled = { id: `${Date.now()}-${settling.length}`, rel, title: title(rel), reason, at: iso(Date.now()) };
  settling.unshift({ s, text: notes.get(rel) ?? '' });
  notes.delete(rel);
  grains.delete(rel);
  return s;
}

// Two notes woven line by line, as the core does (`combine.rs`).
function weaveLines(into: string, dragged: string): WovenLine[] {
  const a = into.split('\n');
  const b = dragged.split('\n');
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: WovenLine[] = [];
  let mine: WovenLine[] = [];
  let theirs: WovenLine[] = [];
  const flush = () => {
    out.push(...mine, ...theirs);
    mine = [];
    theirs = [];
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      flush();
      out.push({ text: a[i], from: 'both' });
      i++;
      j++;
    } else if (j >= m || (i < n && lcs[i + 1][j] >= lcs[i][j + 1])) mine.push({ text: a[i++], from: 'into' });
    else theirs.push({ text: b[j++], from: 'dragged' });
  }
  flush();
  return out;
}

const handlers: Record<string, (a: any) => unknown> = {
  last_vault: () => '/Users/you/Notes',
  open_vault: ({ path }): VaultInfo => ({ root: path, name: path.split('/').pop(), arranged: true }),
  arrange_plan: (): Plan => ({ moves: ['Inbox.md', 'Letters', 'Practice', 'Reading'], left_in_place: ['attachments'], elsewhere: [], notes_in: [1, 12, 21, 14], notes: 48, links_to_rewrite: 2 }),
  arrange: () => undefined,
  pending_downloads: (() => {
    let left = 3;
    return () => (left = Math.max(0, left - 1));
  })(),
  arrive: (): Arrival => ({
    visit: 12,
    since: iso(now - 1.7 * DAY),
    stone_changed: [
      { rel: 'stone/Practice/Sitting log.md', title: 'Sitting log', life: null, written: null, dissolves: null },
      { rel: 'stone/Reading/Ryōkan, poems.md', title: 'Ryōkan, poems', life: null, written: null, dissolves: null },
    ],
    kept_elsewhere: [{ rel: 'stone/Practice/Metta phrases.md', title: 'Metta phrases', life: null, written: null, dissolves: null }],
    sand_new: ['sand/moon/quarter/Walking meditation route.md', 'sand/sun/Groceries, Saturday.md', 'sand/breath/Phone number for the framer.md'].map((r) => ref(r, grains.get(r)!)),
    leaving: [
      { rel: 'sand/sun/A worry about Monday.md', title: 'A worry about Monday', life: 'sun', written: iso(now - 2 * DAY), dissolves: iso(now - DAY) },
      { rel: 'sand/breath/Dream, the flooded temple.md', title: 'Dream, the flooded temple', life: 'breath', written: iso(now - 2 * DAY), dissolves: null },
    ],
  }),
  overview: (): Overview => ({
    stone: byOrder([...notes.keys()].filter((r) => r.startsWith('stone/')).sort().map(note)),
    // Soonest to leave first; breaths (no time) leave with the visit, so first of all.
    sand: [...grains.entries()]
      .map(([rel, g]) => {
        const end = dissolves(g);
        return { ...ref(rel, g), fraction_left: end === null ? 1 : Math.max(0, Math.min(1, (end - Date.now()) / (end - g.written))) };
      })
      .sort((a, b) => (a.dissolves ?? '').localeCompare(b.dissolves ?? '')),
    elsewhere: [],
    folders: [...new Set([...stoneFolders, ...[...notes.keys()].map((r) => r.split('/')).filter((p) => p[0] === 'stone' && p.length > 2).map((p) => p[1])])].sort(),
  }),
  mandala: (): Mandala => {
    const ov = handlers.overview({}) as Overview;
    const parts = (rel: string) => rel.split('/');
    const stone = (n: Note) => ({ rel: n.rel, title: n.title });
    const drawn = [...ov.stone.map((n) => n.rel), ...ov.sand.map((s) => s.rel)];
    const byName = new Map(drawn.map((r) => [title(r).toLowerCase(), r] as const).reverse());
    const links: Mandala['links'] = [];
    for (const from of drawn) {
      for (const m of (notes.get(from) ?? '').matchAll(/\[\[([^\]|#^]+)/g)) {
        const to = byName.get(m[1].split('/').pop()!.trim().toLowerCase());
        if (to && to !== from && !links.some((l) => l.from === from && l.to === to)) links.push({ from, to });
      }
    }
    return {
      seeds: ov.stone.filter((n) => parts(n.rel).length === 2).map(stone),
      petals: ov.folders.map((folder) => ({
        folder,
        notes: ov.stone.filter((n) => parts(n.rel).length > 2 && parts(n.rel)[1] === folder).map(stone),
      })),
      grains: ov.sand.map((s) => ({ rel: s.rel, title: s.title, life: s.life!, written: s.written!, dissolves: s.dissolves, fraction_left: s.fraction_left })),
      links,
      dust: settling.map(({ s }) => ({
        id: s.id,
        title: s.title,
        reason: s.reason,
        at: s.at,
        settled: Math.max(0, Math.min(1, (Date.now() - new Date(s.at).getTime()) / DAY)),
      })),
    };
  },
  set_order: ({ rels }: { rels: string[] }) => void (order = [...new Set(rels)]),
  move_stone: ({ rel, folder }: { rel: string; folder: string }) => {
    const from = rel.split('/');
    if (from.length > 2) stoneFolders.add(from[1]);
    const to = `stone/${folder ? folder + '/' : ''}${title(rel)}.md`;
    if (to === rel) return rel;
    notes.set(to, notes.get(rel) ?? '');
    notes.delete(rel);
    moved(rel, to);
    return to;
  },
  // The name follows the heading (`rename.rs`), in short: no sync to wait for here.
  follow_heading: ({ rel, opened }: { rel: string; opened: string }): Follow => {
    const heading = (t: string) => /^# (.+)$/m.exec(t)?.[1]?.trim() ?? null;
    const base = title(rel).replace(/ \(\d+\)$/, '');
    if (heading(opened) !== title(rel) && heading(opened) !== base) return { kind: 'unlinked' };
    const want = heading(notes.get(rel) ?? '');
    if (!want || want === title(rel) || want === base) return { kind: 'same' };
    return { kind: 'renamed', ...(handlers.rename_note({ rel, stem: want }) as Renamed) };
  },
  rename_to: ({ rel, title: t }: { rel: string; title: string }): Follow => {
    if (!t.trim() || t.trim() === title(rel)) return { kind: 'same' };
    return { kind: 'renamed', ...(handlers.rename_note({ rel, stem: t.trim() }) as Renamed) };
  },
  rename_note: ({ rel, stem }: { rel: string; stem: string }): Renamed => {
    const dir = rel.slice(0, rel.lastIndexOf('/'));
    const taken = new Set([...notes.keys()].filter((r) => r !== rel).map((r) => title(r).toLowerCase()));
    let name = stem;
    for (let n = 1; taken.has(name.toLowerCase()); n++) name = `${stem} (${n})`;
    const to = `${dir}/${name}.md`;
    if (to === rel) return { from: rel, to, linked: [] };
    const old = title(rel);
    notes.set(to, notes.get(rel) ?? '');
    notes.delete(rel);
    const g = grains.get(rel);
    if (g) {
      grains.delete(rel);
      grains.set(to, g);
    }
    moved(rel, to);
    const linked: string[] = [];
    for (const [r, t] of notes) {
      const next = t.split(`[[${old}]]`).join(`[[${name}]]`).split(`[[${old}|`).join(`[[${name}|`);
      if (next !== t) {
        notes.set(r, next);
        linked.push(r);
      }
    }
    return { from: rel, to, linked };
  },
  read_note: ({ rel }) => notes.get(rel) ?? '',
  write_note: ({ rel, text }) => void notes.set(rel, text),
  new_sand: ({ title: t, life }: { title: string; life: Life }) => {
    const rel = `${FOLDER[life]}/${t}.md`;
    notes.set(rel, `# ${t}\n\n`);
    grains.set(rel, { life, written: Date.now() });
    return rel;
  },
  set_life: ({ rel, life }: { rel: string; life: Life }) => {
    const from = grains.get(rel)!.life;
    if (from === life) return rel;
    const longer = LIVES.indexOf(life) > LIVES.indexOf(from);
    const to = `${FOLDER[life]}/${title(rel)}.md`;
    notes.set(to, notes.get(rel) ?? '');
    notes.delete(rel);
    grains.set(to, { ...grains.get(rel)!, life, ...(longer ? { written: Date.now() } : {}) });
    grains.delete(rel);
    moved(rel, to);
    return to;
  },
  keep: ({ rel, folder, because }) => {
    const to = `stone/${folder ? folder + '/' : ''}${title(rel)}.md`;
    if (because) carvings.set(to, { text: because, at: new Date().toISOString() });
    notes.set(to, notes.get(rel) ?? '');
    notes.delete(rel);
    grains.delete(rel);
    moved(rel, to);
    return to;
  },
  carving: ({ rel }) => carvings.get(rel) ?? null,
  carve: ({ rel, text }) => {
    if (text.trim()) carvings.set(rel, { text: text.trim(), at: new Date().toISOString() });
    else carvings.delete(rel);
  },
  let_go: ({ rels }) => rels.map((r: string) => settle(r, 'swept')),
  sweep_ran_out: () =>
    [...grains]
      .filter(([, g]) => {
        const d = dissolves(g);
        return d !== null && d <= Date.now();
      })
      .map(([rel]) => settle(rel, 'swept')),
  delete_note: ({ rel }) => settle(rel, 'deleted'),
  restore: ({ id }) => {
    const i = settling.findIndex((x) => x.s.id === id);
    const [{ s, text }] = settling.splice(i, 1);
    notes.set(s.rel, text);
    if (s.rel.startsWith('sand/')) grains.set(s.rel, { life: 'sun', written: Date.now() });
    return s.rel;
  },
  settling: () => settling.map((x) => x.s),
  settled_text: ({ id }) => {
    const found = settling.find((x) => x.s.id === id);
    if (!found) throw new Error(`nothing settling as ${id}`);
    return found.text;
  },
  search: ({ query }): Hit[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: Hit[] = [];
    for (const [rel, text] of notes) {
      const line = text.split('\n').find((l) => l.toLowerCase().includes(q));
      if (line || title(rel).toLowerCase().includes(q)) hits.push({ rel, title: title(rel), line: (line ?? title(rel)).replace(/^#\s*/, ''), settled: null });
    }
    for (const { s, text } of settling) {
      const line = text.split('\n').find((l) => l.toLowerCase().includes(q));
      if (line) hits.push({ rel: s.rel, title: s.title, line, settled: s.id });
    }
    return hits;
  },
  backlinks: ({ title: t }) => [...notes.entries()].filter(([, text]) => text.toLowerCase().includes(`[[${t.toLowerCase()}`)).map(([r]) => note(r)),
  weave: ({ into, dragged }): Woven => {
    const a = notes.get(into) ?? '';
    const b = notes.get(dragged) ?? '';
    const lines = weaveLines(a.replace(/\n$/, ''), b.replace(/\n$/, ''));
    return { lines, text: lines.map((l) => l.text).join('\n') + '\n', into: a, dragged: b };
  },
  remove_picture: ({ name }): Settled => {
    pictures.delete(name);
    return { id: `${Date.now()}-p`, rel: `attachments/${name}`, title: name, reason: 'deleted', at: iso(Date.now()) };
  },
  combine: ({ into, dragged, text }) => {
    notes.set(into, text);
    return settle(dragged, 'combined');
  },
  breaths: (): NoteRef[] => [...grains.entries()].filter(([, g]) => g.life === 'breath').map(([r, g]) => ref(r, g)),
  close_visit: () => {
    for (const [r, g] of [...grains.entries()]) if (g.life === 'breath') settle(r, 'swept');
  },
  leave_vault: () => {
    for (const [r, g] of [...grains.entries()]) if (g.life === 'breath') settle(r, 'swept');
  },
};

export async function mock(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  const handler = handlers[cmd];
  if (!handler) throw new Error(`mock: no command ${cmd}`);
  await new Promise((r) => setTimeout(r, 30));
  return handler(args);
}

// Pictures, kept in memory for the browser.
const pictures = new Map<string, Uint8Array>();

export async function mockPicture(name: string): Promise<ArrayBuffer | null> {
  const bytes = pictures.get(name);
  return bytes ? (bytes.slice().buffer as ArrayBuffer) : null;
}

export async function mockSavePicture(name: string, bytes: Uint8Array, replace: boolean): Promise<string> {
  let free = name;
  if (!replace) {
    const dot = name.lastIndexOf('.');
    for (let n = 1; pictures.has(free); n++) free = `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
  }
  pictures.set(free, bytes);
  return free;
}
