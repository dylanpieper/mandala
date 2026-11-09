<script lang="ts">
  // The window: stone on the left, sand on the right, the page between.
  import { onDestroy, onMount, tick } from 'svelte';
  import { flyToStone, rowRect } from '../lib/flight';
  import { joinNote, splitNote, type Split } from '../lib/title';
  import { beforeLeaving } from '../lib/leaving';
  import { fly, slide } from 'svelte/transition';
  import Editor from '../components/Editor.svelte';
  import Icon from '../components/Icon.svelte';
  import TitleBar from '../components/TitleBar.svelte';
  import DragGhost from '../components/DragGhost.svelte';
  import KeepDialog from '../components/KeepDialog.svelte';
  import Search from '../components/Search.svelte';
  import FindBar from '../components/FindBar.svelte';
  import SandRail from '../components/SandRail.svelte';
  import StoneRail from '../components/StoneRail.svelte';
  import MandalaView from '../components/MandalaView.svelte';
  import { turn } from '../lib/timer.svelte';
  import { panes, togglePane } from '../lib/panes.svelte';
  import { api, isTauri, onEvent } from '../lib/api';
  import { hold } from '../lib/hold';
  import SandFall from '../components/SandFall.svelte';
  import NoteHead from '../components/NoteHead.svelte';
  import Draw from '../components/Draw.svelte';
  import Combine from '../components/Combine.svelte';
  import LifePicker from '../components/LifePicker.svelte';
  import { isMac, modHeld } from '../lib/keys';
  import { freshTitle, leavingSoon } from '../lib/time';
  import { crumble, type Tone } from '../lib/crumble';
  import type { Life, Mandala, Note, Overview, Renamed, SandItem, Settled } from '../lib/types';

  /** A note's file name without its folder or `.md`. */
  const stemOf = (rel: string) => (rel.split('/').pop() ?? rel).replace(/\.md$/, '');

  let { vaultName, vaultRoot, onChangeVault }: { vaultName: string; vaultRoot: string; onChangeVault: () => void } = $props();

  async function changeVault() {
    await flush();
    onChangeVault();
  }

  let overview = $state<Overview>({ stone: [], sand: [], elsewhere: [], folders: [] });
  let selected = $state<string | null>(null);
  let text = $state('');
  let now = $state(new Date());
  let keeping = $state(false);
  // The drawing sheet: open on a new drawing (`name: null`) or an existing one.
  let drawing = $state<{ name: string | null } | null>(null);
  let editor = $state<ReturnType<typeof Editor> | undefined>();

  function drawn(name: string, isNew: boolean) {
    drawing = null;
    if (isNew) editor?.embed(name);
    else editor?.changed(name);
  }

  /** A picture let go: its file rests for a day, and its embed leaves the note. */
  async function removePicture(name: string) {
    drawing = null;
    editor?.unembed(name);
    // A picture whose file is already gone still leaves the note.
    await api.removePicture(name).catch(() => undefined);
  }

  // Two notes being combined: one was held on the other and dropped.
  let combining = $state<{ into: string; dragged: string } | null>(null);

  async function startCombine(into: string, dragged: string) {
    await flush();
    combining = { into, dragged };
  }

  async function combined(settled: Settled) {
    const { into } = combining!;
    const wasOpen = selected === into || selected === combining!.dragged;
    combining = null;
    await refresh();
    // The editor loads a note when its path changes, so it closes first.
    if (wasOpen) {
      selected = null;
      await open(into);
    }
    const name = (into.split('/').pop() ?? into).replace(/\.md$/, '');
    toast = { settled: [settled], message: `Combined into ${name}` };
    setTimeout(() => toast?.settled[0]?.id === settled.id && (toast = null), 8000);
  }
  let keepInto = $state<string | undefined>(undefined);
  let searching = $state(false);
  // The message at the foot of the page: what was let go (Restore), or a note
  // renamed to follow its heading (Undo).
  let toast = $state<{ settled: Settled[]; message: string; renamed?: Renamed & { title: string; named: boolean } } | null>(null);
  let backlinks = $state<Note[]>([]);
  // The mandala view (⌘M) lies over the window; the page stays as it was beneath.
  let picture = $state<Mandala | null>(null);
  let viewing = $state(false);
  // Find in note (⌘F): the bar is open while this is set.
  let finding = $state<{ start: string } | null>(null);
  let findBar = $state<ReturnType<typeof FindBar> | undefined>();
  function endFind(select: boolean) {
    editor?.findEnd(select);
    finding = null;
  }
  // A note leaving soon opens under a fall of sand, to be swept. Once swept,
  // it stays clear for the rest of this visit.
  let swept = $state<string[]>([]);

  const sandNote = $derived<SandItem | undefined>(overview.sand.find((s) => s.rel === selected));
  const sandfall = $derived(!!selected && !!sandNote && leavingSoon(sandNote.dissolves, now) && !swept.includes(selected));
  const folders = $derived(['', ...overview.folders]);
  // Every note's title, for `[[` autocomplete; the open note is left out.
  const titles = $derived([...overview.stone, ...overview.sand].filter((n) => n.rel !== selected).map((n) => n.title));
  // The folders of the open note; its name is the page's title, so not repeated here.
  const crumbs = $derived(selected ? selected.split('/').slice(0, -1) : []);
  // The note's title: its first `# heading`, in its own field above the body
  // (`lib/title.ts`). The editor holds only the body. With no title, the field
  // shows the file's name faintly, and nothing is written into the note.
  let noteTitle = $state('');
  let split: Split = splitNote('');
  let body = '';
  let titleField = $state<HTMLTextAreaElement | undefined>();
  /** The note's whole text now: its title and its body. */
  // A note with no heading keeps none: its title is its file name (see `leave`).
  const whole = () => joinNote(split, split.title === null ? '' : noteTitle, body);

  // While a note crumbles, the rails wait: the watcher sees its file leave at
  // once, but the row closes up only after the sand has blown (`vanish`).
  let crumbling = 0;
  let refreshWaiting = false;
  async function refresh() {
    if (crumbling) {
      refreshWaiting = true;
      return;
    }
    refreshWaiting = false;
    const next = await api.overview();
    // A crumble began while this was asked for: it is stale for the rails now.
    if (crumbling) {
      refreshWaiting = true;
      return;
    }
    overview = next;
    if (viewing) picture = await api.mandala();
    if (!selected) {
      const first = overview.sand[0]?.rel ?? overview.stone[0]?.rel;
      if (first) await open(first);
    }
  }

  // The open note's text as it was opened: if its name matched its heading
  // then, the name follows the heading when the note is left (`rename.rs`).
  let opened = '';

  /**
   * Leaving the open note: its file name follows its heading, links and all.
   * Returns where it is now. A rename that must wait (sync, a linking note
   * just changed) is tried again the next time the note is left.
   */
  // One leave at a time: finishing the title and opening another note can both ask.
  let leaving: Promise<string | null> | null = null;
  function leave(say = true): Promise<string | null> {
    if (!leaving) leaving = leaveNow(say).finally(() => (leaving = null));
    return leaving;
  }
  async function leaveNow(say: boolean): Promise<string | null> {
    const rel = selected;
    if (!rel) return null;
    // A note with no heading (from Obsidian, say): its file name is its title,
    // and the title renames the file, with no heading written.
    const named = split.title === null;
    // The title before this rename, for Undo to put back with the name.
    const before = named ? stemOf(rel) : (splitNote(opened).title ?? '');
    const f = named ? await api.renameTo(rel, noteTitle).catch(() => null) : await api.followHeading(rel, opened).catch(() => null);
    // A cleared title on such a note: its name stays, and shows again.
    if (named && f?.kind !== 'renamed' && !noteTitle.trim() && selected === rel) noteTitle = stemOf(rel);
    if (f?.kind === 'held' && say) {
      // The name waits; say why, quietly. It is tried again next time.
      const other = f.held.rel ? `“${stemOf(f.held.rel)}”` : '';
      const why = {
        syncing: 'Keeps its name until sync catches up',
        busy: `Keeps its name for now: ${other} just changed elsewhere`,
        elsewhere: `Keeps its name: ${other}, outside the mandala, links to it`,
        ambiguous: `Keeps its name: another note is called “${stemOf(rel)}” too`,
      }[f.held.kind];
      toast = { settled: [], message: why };
      const shown = toast;
      setTimeout(() => toast === shown && (toast = null), 6000);
    }
    if (f?.kind !== 'renamed') return rel;
    // The same text under a new path: the editor keeps it as it is.
    editor?.renamed(f.to);
    follow(f.from, f.to);
    await refresh();
    opened = await api.readNote(f.to).catch(() => opened);
    // The name may have taken a (1): the title shows the name it got.
    if (named && selected === f.to) noteTitle = stemOf(f.to);
    if (say) {
      const links = f.linked.length ? ` · links updated in ${f.linked.length} ${f.linked.length === 1 ? 'note' : 'notes'}` : '';
      toast = { settled: [], message: `Renamed to “${stemOf(f.to)}”${links}`, renamed: { ...f, title: before, named } };
      const shown = toast;
      setTimeout(() => toast === shown && (toast = null), 8000);
    }
    return f.to;
  }

  async function open(rel: string) {
    if (finding) endFind(false);
    await flush();
    const was = selected;
    const now = await leave();
    // Opening the note that was just renamed: open it under its new name.
    if (was && rel === was && now) rel = now;
    const all = await api.readNote(rel);
    split = splitNote(all);
    noteTitle = split.title ?? stemOf(rel);
    body = split.body;
    text = split.body;
    opened = all;
    selected = rel;
    searching = false;
    const title = rel.split('/').pop()!.replace(/\.md$/, '');
    backlinks = await api.backlinks(title);
  }

  // Saving: a short pause after typing, and always before switching notes.
  let pending: { rel: string; text: string } | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  function changed(b: string) {
    if (!selected) return;
    body = b;
    // Writing again: what woke in focus sleeps.
    sleep();
    save();
  }
  function save() {
    if (!selected) return;
    pending = { rel: selected, text: whole() };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 400);
  }

  // The title field. Typing saves as the body does; finishing it (Enter, Tab,
  // ↓, or leaving the field) renames the file to match, links and all.
  function titleTyped() {
    save();
  }
  // The field grows with a long title, from the moment the note opens.
  $effect(() => {
    void noteTitle;
    void selected;
    if (!titleField) return;
    titleField.style.height = 'auto';
    titleField.style.height = `${titleField.scrollHeight}px`;
  });
  function titleKey(e: KeyboardEvent) {
    const atEnd = titleField && titleField.selectionStart === titleField.value.length;
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey) || (e.key === 'ArrowDown' && atEnd)) {
      e.preventDefault();
      editor?.focusStart();
    }
  }
  async function titleDone() {
    await flush();
    await leave();
  }
  /** From the top of the body back into the title, the caret at its end. */
  function toTitle() {
    if (!titleField) return;
    titleField.focus();
    titleField.setSelectionRange(titleField.value.length, titleField.value.length);
  }
  async function flush() {
    clearTimeout(saveTimer);
    if (pending) {
      const p = pending;
      pending = null;
      await api.writeNote(p.rel, p.text);
    }
  }

  // The lifespan card: for new sand (⌘N, or New note on an empty page), or for
  // a stone note dropped on the sand rail. Nothing is chosen for the person.
  let choosing = $state<{ kind: 'new' } | { kind: 'return'; rel: string } | null>(null);
  function chose(life: Life) {
    const c = choosing;
    choosing = null;
    if (c?.kind === 'new') newSand(life);
    else if (c?.kind === 'return') returnToSand(c.rel, life);
  }
  // Focus (⌘\): everything but the note fades. A faded part wakes when the
  // pointer comes to it, and sleeps again once writing goes on. The layout
  // stays as it was, so a part is found where it always is.
  let focus = $state(false);
  let awake = $state<string[]>([]);
  const faded = (part: string) => focus && !awake.includes(part);
  function wake(part: string) {
    if (focus && !awake.includes(part)) awake = [...awake, part];
  }
  function sleep() {
    if (awake.length) awake = [];
  }


  async function newSand(life: Life) {
    const rel = await api.newSand(freshTitle(), life);
    await refresh();
    await open(rel);
  }

  async function keep(folder: string, because: string) {
    if (!selected) return;
    await flush();
    // Its name follows its heading first, so the stone note keeps them matched.
    const was = selected;
    const rel = (await leave(false)) ?? was;
    if (rel !== was) {
      await refresh();
      await tick();
    }
    // Where its sand row was, for the card that carries it across to stone.
    const from = rowRect('sand', rel);
    const title = overview.sand.find((s) => s.rel === rel)?.title ?? sandNote?.title ?? '';
    const to = await api.keep(rel, folder, because.trim() || null);
    keeping = false;
    keepInto = undefined;
    selected = null;
    await refresh();
    await open(to);
    await tick();
    if (from) flyToStone(title, from, to);
  }

  // Dragging. The order is one list of stone paths (sand is always soonest first); a note keeps its
  // place in it when it moves (the core carries it), and lands where dropped.
  async function place(from: string, to: string, target: string | null, after: boolean) {
    const rels = overview.stone.map((n) => n.rel).filter((r) => r !== from && r !== to);
    const at = target ? rels.indexOf(target) : -1;
    if (at < 0) rels.push(to);
    else rels.splice(after ? at + 1 : at, 0, to);
    await api.setOrder(rels);
    await refresh();
  }

  /** After a note moved: if it was open, it stays open under its new path. */
  function follow(from: string, to: string) {
    // The same text under a new path: the editor keeps what is typed, and loads nothing.
    if (selected === from && from !== to) editor?.renamed(to);
    if (selected === from) selected = to;
    // Sand already swept stays swept under the new path.
    if (swept.includes(from)) swept = [...swept, to];
  }

  const folderOf = (rel: string) => {
    const parts = rel.split('/');
    return parts.length > 2 ? parts[1] : '';
  };

  async function placeStone(rel: string, folder: string, target: string | null, after: boolean) {
    await flush();
    let to = rel;
    if (folderOf(rel) !== folder) {
      to = await api.moveStone(rel, folder);
      follow(rel, to);
    }
    await place(rel, to, target, after);
  }

  async function setLife(rel: string, life: Life) {
    await flush();
    const to = await api.setLife(rel, life);
    follow(rel, to);
    await refresh();
  }

  async function returnToSand(rel: string, life: Life) {
    if (rel === selected) await flush();
    const to = await api.returnToSand(rel, life);
    follow(rel, to);
    await refresh();
    await open(to);
  }

  async function keepFromDrop(rel: string, folder: string) {
    await open(rel);
    keepInto = folder;
    keeping = true;
  }

  // What leaves crumbles into sand on the page, if it is open; the header
  // fades without grains. The rails get no sand: in the app's WebKit a row in a
  // scrolled rail is not repainted under the sand canvas, so its card stayed
  // drawn while the sand blew. Its row leaves when the rails refresh after.
  let page = $state<HTMLElement | undefined>();
  function vanish(rels: string[], tone: Tone) {
    const open = !!selected && rels.includes(selected);
    const article = open ? page?.querySelector<HTMLElement>('article') : null;
    const head = open ? page?.querySelector<HTMLElement>('.head') : null;
    crumbling++;
    return crumble(article ? [article] : [], head ? [head] : [], tone).then((end) => {
      crumbling--;
      return end;
    });
  }

  async function remove() {
    if (!selected) return;
    const rel = selected;
    await flush();
    const going = vanish([rel], sandNote ? 'sand' : 'stone');
    let settled: Settled;
    try {
      settled = await api.deleteNote(rel);
    } catch (e) {
      (await going)();
      if (refreshWaiting) await refresh();
      throw e;
    }
    const end = await going;
    if (selected === rel) selected = null;
    show([settled], `“${settled.title}” let go`);
    await refresh();
    end();
  }

  // Timed sand lets go on its own the moment it runs out (`sweep_ran_out`).
  // The core refuses while sync still has notes to bring down: then try again.
  const ranOut = (s: SandItem) => !!s.dissolves && Date.parse(s.dissolves) <= Date.now();
  let sweepTimer: ReturnType<typeof setTimeout> | undefined;
  let sweeping = false;
  async function sweepRanOut() {
    if (sweeping || !overview.sand.some(ranOut)) return;
    sweeping = true;
    try {
      // Sync still bringing notes down: wait, and look again.
      if (await api.pendingDownloads()) {
        sweepTimer = setTimeout(sweepRanOut, 5000);
        return;
      }
      const due = overview.sand.filter(ranOut).map((s) => s.rel);
      if (selected && due.includes(selected)) await flush();
      // The crumble begins before the files move, so the watcher's refresh waits for it.
      const going = vanish(due, 'sand');
      let settled: Settled[] = [];
      try {
        settled = await api.sweepRanOut();
      } finally {
        if (!settled.length) {
          (await going)();
          if (refreshWaiting) await refresh();
        }
      }
      if (!settled.length) return;
      const end = await going;
      if (selected && settled.some((s) => s.rel === selected)) selected = null;
      show(settled, settled.length === 1 ? `“${settled[0].title}” ran out` : `${settled.length} notes ran out`);
      await refresh();
      end();
    } finally {
      sweeping = false;
    }
  }
  $effect(() => {
    const next = Math.min(...overview.sand.map((s) => (s.dissolves ? Date.parse(s.dissolves) : Infinity)));
    clearTimeout(sweepTimer);
    if (Number.isFinite(next)) sweepTimer = setTimeout(sweepRanOut, Math.min(Math.max(0, next - Date.now()) + 250, 2 ** 31 - 1));
  });

  function show(settled: Settled[], message: string) {
    toast = { settled, message };
    setTimeout(() => toast?.settled[0]?.id === settled[0].id && (toast = null), 8000);
  }

  /** Restore what the toast names, and open it (the first, if several). Or undo a rename. */
  async function undo() {
    if (!toast) return;
    if (toast.renamed) {
      // Undo puts back both the title and the name, so the two still match
      // and keep following each other.
      const r = toast.renamed;
      toast = null;
      await flush();
      if (r.named) {
        // A note with no heading: only its name goes back, and its title shows it.
        if (selected === r.to) noteTitle = r.title;
      } else if (selected === r.to) {
        noteTitle = r.title;
        save();
        await flush();
      } else {
        const was = splitNote(await api.readNote(r.to));
        await api.writeNote(r.to, joinNote(was, r.title, was.body));
      }
      const back = await api.renameNote(r.to, stemOf(r.from));
      if (selected === r.to) editor?.renamed(back.to);
      follow(r.to, back.to);
      if (selected === back.to) opened = await api.readNote(back.to).catch(() => opened);
      await refresh();
      return;
    }
    const rels = [];
    for (const s of toast.settled) rels.push(await api.restore(s.id));
    toast = null;
    await refresh();
    await open(rels[0]);
  }

  async function toggleMandala() {
    if (viewing) {
      viewing = false;
      return;
    }
    await flush();
    picture = await api.mandala();
    viewing = true;
  }

  async function openFromMandala(rel: string) {
    viewing = false;
    await open(rel);
  }

  // A restored note opens in the editor; a restored picture just comes back.
  async function restoreFromMandala(id: string) {
    const rel = await api.restore(id);
    await refresh();
    if (rel.endsWith('.md')) await openFromMandala(rel);
  }

  function followLink(target: string) {
    const name = target.split('/').pop()!.toLowerCase();
    const all = [...overview.stone, ...overview.sand];
    const hit = all.find((n) => n.title.toLowerCase() === name);
    if (hit) open(hit.rel);
  }

  function onKey(e: KeyboardEvent) {
    // The drawing and combine sheets have their own keys.
    if (drawing || combining || choosing) return;
    if (e.key === 'Escape' && viewing && !searching && !keeping) {
      viewing = false;
      return;
    }
    if (!modHeld(e)) return;
    // In the Mac app, ⌘M comes from the menu (`toggle-mandala`); elsewhere, from here.
    if (e.key === 'm' && !(isTauri && isMac)) {
      e.preventDefault();
      toggleMandala();
      return;
    }
    // ⌘B, ⌘I, ⌘K, ⌘E and ⌘⇧X are the editor's formatting keys (`editor/format.ts`).
    if (e.key === '[' || e.key === ']') {
      // Left bracket, left rail; right bracket, right rail.
      e.preventDefault();
      togglePane(e.key === '[' ? 'stone' : 'sand');
    } else if (e.key === 't') {
      e.preventDefault();
      turn();
    } else if (e.key === 'p') {
      e.preventDefault();
      searching = true;
    } else if (e.key === 'f' && selected) {
      e.preventDefault();
      if (finding) findBar?.refocus();
      else finding = { start: editor?.selection() ?? '' };
    } else if (e.key === 'g' && finding) {
      e.preventDefault();
      editor?.findStep(e.shiftKey ? -1 : 1);
    } else if (e.key === 'd' && selected) {
      e.preventDefault();
      drawing = { name: null };
    } else if (e.key === '\\') {
      e.preventDefault();
      if (e.repeat) return;
      awake = [];
      focus = !focus;
    } else if (e.key === 'o') {
      e.preventDefault();
      changeVault();
    } else if (e.key === 'n') {
      e.preventDefault();
      if (!e.repeat) choosing = { kind: 'new' };
    } else if (e.key === 'Enter' && sandNote && !keeping) {
      e.preventDefault();
      keeping = true;
    }
  }

  let unlisten: () => void = () => {};
  let unlistenMenu: () => void = () => {};
  const clock = setInterval(async () => {
    now = new Date();
    if (viewing) picture = await api.mandala();
  }, 30_000);
  // The window shows once its first note is open, so the empty rails and the
  // empty page never flash between the opening and the visit.
  let ready = $state(false);
  // Before the app closes or changes vaults (it waits for this): the last
  // save, then the open note's name follows its title.
  const stopLeaving = beforeLeaving(async () => {
    await flush();
    await leave(false);
  });
  onMount(async () => {
    try {
      await refresh();
    } finally {
      ready = true;
    }
    unlisten = await onEvent('vault-changed', () => refresh());
    unlistenMenu = await onEvent('toggle-mandala', toggleMandala);
  });
  onDestroy(() => {
    clearInterval(clock);
    unlisten();
    unlistenMenu();
    stopLeaving();
    flush();
  });
</script>

<svelte:window onkeydown={onKey} />

{#if choosing}<LifePicker heading={choosing.kind === 'new' ? 'New note' : 'Return to sand'} numbered={choosing.kind === 'new'} onPick={chose} onCancel={() => (choosing = null)} />{/if}

<div class="window" class:ready>
  <div class="chrome bar-wrap" class:faded={faded('bar')} onpointerenter={() => wake('bar')} role="presentation">
    <TitleBar {vaultName} {vaultRoot} {crumbs} {viewing} onChangeVault={changeVault} onToggleMandala={toggleMandala} onSearch={() => (searching = true)} />
  </div>

  <div class="body">
    <!-- In focus a faded rail slides away; its window edge wakes it. -->
    {#if panes.stone && faded('stone')}<div class="edge left" onpointerenter={() => wake('stone')} role="presentation"></div>{/if}
    {#if panes.sand && faded('sand')}<div class="edge right" onpointerenter={() => wake('sand')} role="presentation"></div>{/if}
    <div class="side stone chrome" class:shut={!panes.stone} class:faded={faded('stone')} inert={!panes.stone} onpointerenter={() => wake('stone')} role="presentation">
      <StoneRail notes={overview.stone} folders={overview.folders} {selected} onOpen={open} onPlace={placeStone} onKeepInto={keepFromDrop} onCombine={startCombine} />
    </div>

    <main bind:this={page} class:wide={faded('stone') && faded('sand')}>
      {#if selected}
        {#if finding}
          <FindBar bind:this={findBar} start={finding.start} onFind={(q) => editor?.find(q) ?? { at: 0, of: 0 }} onStep={(by) => editor?.findStep(by) ?? { at: 0, of: 0 }} onClose={endFind} />
        {/if}
        <div class="chrome head-wrap" class:faded={faded('head')} onpointerenter={() => wake('head')} role="presentation">
          <NoteHead rel={selected} sand={sandNote} {now} onDraw={() => (drawing = { name: null })} onTable={(c, r) => editor?.table(c, r)} onLetGo={remove} onKeep={() => (keeping = true)} onSetLife={(life) => selected && setLife(selected, life)} />
        </div>
        <article>
          <!-- Back on the note: what woke in focus sleeps again. -->
          <div class="note" onpointerenter={sleep} role="presentation">
            <label class="sr-only" for="note-title">Title</label>
            <textarea
              id="note-title"
              class="title serif"
              rows="1"
              spellcheck="true"
              bind:this={titleField}
              bind:value={noteTitle}
              placeholder={stemOf(selected)}
              oninput={titleTyped}
              onkeydown={titleKey}
              onblur={titleDone}
            ></textarea>
            <Editor bind:this={editor} rel={selected} {text} {titles} onExitTop={toTitle} onChange={changed} onFollowLink={followLink} onOpenDrawing={(name) => (drawing = { name })} onRemovePicture={removePicture} />
          </div>
          {#if backlinks.length}
            <section class="backlinks chrome" class:faded={faded('links')} onpointerenter={() => wake('links')} role="presentation">
              <h3 class="eyebrow">Linked from</h3>
              <div>
                {#each backlinks as b (b.rel)}<button class="pill" onclick={() => open(b.rel)}>{b.title}</button>{/each}
              </div>
            </section>
          {/if}
        </article>
      {:else}
        <div class="empty">
          <button class="pill sand" onclick={() => (choosing = { kind: 'new' })}><Icon name="plus" />New note</button>
        </div>
      {/if}

      {#if sandfall && selected}
        {@const rel = selected}
        {#key rel}
          <SandFall onSwept={() => (swept = [...swept, rel])} />
        {/key}
      {/if}

      {#if drawing && selected}
        <Draw name={drawing.name} onCancel={() => (drawing = null)} onDone={drawn} onDelete={removePicture} />
      {/if}

      {#if combining}
        <Combine into={combining.into} dragged={combining.dragged} onCancel={() => (combining = null)} onDone={combined} />
      {/if}

      {#if toast}
        <div class="toast" class:quiet={!toast.renamed && !toast.settled.length} role="status" transition:fly={{ y: 12, duration: 320 }}>
          <span>{toast.message}</span>
          {#if toast.renamed || toast.settled.length}<button class="pill sand" onclick={undo}><Icon name="restore" />{toast.renamed ? 'Undo' : 'Restore'}</button>{/if}
        </div>
      {/if}
    </main>

    <div class="side sand chrome" class:shut={!panes.sand} class:faded={faded('sand')} inert={!panes.sand} onpointerenter={() => wake('sand')} role="presentation">
      <SandRail sand={overview.sand} {selected} {now} onOpen={open} onNew={newSand} onReturn={(rel) => (choosing = { kind: 'return', rel })} onCombine={startCombine} />
    </div>

    {#if viewing && picture}
      <MandalaView {picture} {now} onOpen={openFromMandala} onRestore={restoreFromMandala} />
    {/if}
  </div>

</div>

{#if keeping && sandNote}
  <KeepDialog note={sandNote} {folders} startFolder={keepInto} onKeep={keep} onCancel={() => ((keeping = false), (keepInto = undefined))} />
{/if}
{#if searching}
  <Search onOpen={open} onClose={() => (searching = false)} />
{/if}
<DragGhost />

<style>
  .window {
    height: 100%;
    display: flex;
    flex-direction: column;
    opacity: 0;
    transition: opacity var(--settle) var(--ease);
  }
  .window.ready {
    opacity: 1;
  }
  /* A rail slides out by its pane closing over it, keeping its own width;
     stone leaves to the left and sand to the right. */
  .side {
    width: 260px;
    flex-shrink: 0;
    display: flex;
    overflow: hidden;
    transition: width var(--settle) var(--ease), opacity var(--settle) var(--ease);
  }
  .side.stone {
    justify-content: flex-end;
  }
  /* Focus: a faded part keeps its place and still takes the pointer, which wakes it. */
  .chrome {
    transition: opacity var(--settle) var(--ease);
  }
  .side.chrome {
    transition: width var(--settle) var(--ease), opacity var(--settle) var(--ease);
  }
  .chrome.faded {
    opacity: 0;
  }
  /* A faded rail slides away too, so the note has the room. */
  .side.faded {
    width: 0;
  }
  .bar-wrap {
    flex-shrink: 0;
  }
  /* The note's header stays at the top of the page as the note scrolls, so
     Let go and Set in stone are always in reach. */
  .head-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
    position: sticky;
    top: -28px;
    z-index: 3;
    margin-top: -28px;
    padding: 28px 0 12px;
    background: linear-gradient(var(--ground) 82%, transparent);
  }
  .side.shut {
    width: 0;
    opacity: 0;
  }
  .pill {
    height: 28px;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    position: relative;
  }
  main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 32px 0;
  }
  article {
    width: 100%;
    max-width: var(--measure);
    transition: max-width var(--settle) var(--ease);
  }
  /* The note's measure: wider when the page has room for it (a full screen),
     and in focus once both rails have faded. */
  main {
    --measure: 680px;
    container-type: inline-size;
  }
  main.wide {
    --measure: 800px;
  }
  @container (min-width: 960px) {
    article,
    .head-wrap {
      --measure: 800px;
    }
  }
  /* A faded rail wakes when the pointer comes near where it was: most of the
     margin beside the note, not only the window's edge. */
  .edge {
    position: absolute;
    top: 0;
    bottom: 0;
    width: clamp(16px, calc((100% - 800px) / 2 - 48px), 180px);
    z-index: 2;
  }
  .edge.left {
    left: 0;
  }
  .edge.right {
    right: 0;
  }
  .sand {
    color: var(--sand);
  }
  /* Drawn like the editor's `# heading` (.cm-h1), so a file-name title and a written one look the same. */
  /* The title field, drawn as the page's heading. With no title it shows the
     file's name faintly; nothing is written into the note until one is typed. */
  textarea.title {
    display: block;
    width: 100%;
    margin: 0;
    padding: 0 0 10px;
    border: 0;
    background: transparent;
    resize: none;
    overflow: hidden;
    font-size: 40px;
    font-weight: 500;
    letter-spacing: -0.01em;
    line-height: 1.25;
    color: var(--bone);
    caret-color: var(--sand);
    overflow-wrap: anywhere;
    outline: none;
  }
  textarea.title::placeholder {
    color: var(--dust);
    opacity: 0.6;
  }
  article {
    padding: 36px 0 0;
  }
  .backlinks {
    margin: 0 0 40px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .backlinks h3 {
    margin: 0;
  }
  .backlinks div {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .backlinks .pill {
    color: var(--stone);
  }
  .empty {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--ash);
    font-size: 18px;
  }
  .toast {
    position: sticky;
    bottom: 20px;
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 6px 6px 6px 16px;
    background: var(--hover);
    border: 1px solid var(--line);
    border-radius: var(--pill);
    color: var(--ash);
  }
  /* A message with nothing to undo: even on both sides. */
  .toast.quiet {
    padding: 10px 16px;
  }
  @media (max-width: 900px) {
    .side {
      display: none;
    }
  }
</style>
