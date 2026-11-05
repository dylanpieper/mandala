import type { Life } from './types';

export const LIFE_LABEL: Record<Life, string> = {
  breath: 'a breath',
  sun: 'a sun',
  quarter: 'a quarter moon',
  half: 'a half moon',
  full: 'a full moon',
};

/** Time left, as the rails say it: "6h 40m", "1d 3h", "19d", "Ephemeral" for a breath. */
export function timeLeft(dissolves: string | null, now: Date = new Date()): string {
  if (!dissolves) return 'Ephemeral';
  const ms = new Date(dissolves).getTime() - now.getTime();
  if (ms <= 0) return 'ran out';
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days >= 2) return `${days}d`;
  if (days === 1) return `1d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  return `${Math.max(mins, 1)}m`;
}

/** "Thursday evening", "this morning", "yesterday afternoon". */
export function sinceWhen(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const h = then.getHours();
  const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const dayMs = 86_400_000;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / dayMs);
  if (days === 0) return `this ${part}`;
  if (days === 1) return `yesterday ${part}`;
  if (days < 7) return `${then.toLocaleDateString('en', { weekday: 'long' })} ${part}`;
  return then.toLocaleDateString('en', { day: 'numeric', month: 'long' });
}

const LONGEST_HOURS = 29.530589 * 24; // a full moon, the longest lifespan

/** How much time a note has left, on one scale for every lifespan (0 to 1),
 * so the sand rail's bars fall in step with its order (soonest first). The
 * scale is logarithmic: an hour left and a day left still look different
 * beside a month. A breath has no time to show, so 0. */
export function timeShare(dissolves: string | null, now: Date = new Date()): number {
  if (!dissolves) return 0;
  const hours = Math.max(0, (new Date(dissolves).getTime() - now.getTime()) / 3_600_000);
  return Math.min(1, Math.log1p(hours) / Math.log1p(LONGEST_HOURS));
}

/** Sand leaving soon: its bar is under a quarter of the shared scale (about
 * four hours left), whatever its lifespan. Drawn vermilion. A breath has no
 * clock, so it is never "soon". */
export function leavingSoon(dissolves: string | null, now: Date = new Date()): boolean {
  return dissolves !== null && timeShare(dissolves, now) < 0.25;
}

/** A title for new sand: the local date, "2026-10-31". The exact time is the
 * note's `written` in life.json; a second note that day becomes "2026-10-31 (1)". */
export function freshTitle(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
