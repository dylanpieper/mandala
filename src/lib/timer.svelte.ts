// The hourglass: a pomodoro. Turn it (click or ⌘T): a bell sounds and the
// work begins. At its end a second bell rings and the glass turns itself for
// the rest; the second bell rings again and it stops. Turn it while it runs
// to stop it. Hold it for its settings: work and rest minutes, volume, and a
// test of both bells.
//
// The end bells are scheduled on the audio clock when the glass is turned,
// so they ring on time even if the window is hidden and its timers slow
// down. The interval only redraws the glass. Settings are this Mac's
// preference (localStorage), not the vault's.

import startUrl from '../assets/start.m4a';
import endUrl from '../assets/end.m4a';

export type Phase = 'focus' | 'rest';

export interface Settings {
  work: number;
  rest: number;
  /** 0 to 1. */
  volume: number;
}

export const DEFAULTS: Settings = { work: 25, rest: 5, volume: 0.8 };
const KEY = 'mandala.hourglass';

function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = $state<Settings>(loadSettings());

export function saveSettings() {
  globalThis.localStorage?.setItem(KEY, JSON.stringify(settings));
  if (master) master.gain.value = loudness(settings.volume);
}

export const timer = $state<{
  phase: Phase | null;
  endsAt: number;
  length: number;
  now: number;
  /** While testing: the sand left in the glass, run quickly; else null. */
  demo: number | null;
  /** True for a moment when a bell rings, so the glass can glow. */
  ringing: boolean;
  /** While paused: the milliseconds that were left; else null. */
  paused: number | null;
}>({ phase: null, endsAt: 0, length: 0, now: Date.now(), demo: null, ringing: false, paused: null });

/** Sand left in the top of the glass: 1 when turned, 0 when it has run through. */
export function sandLeft(t: { phase: Phase | null; endsAt: number; length: number; now: number }): number {
  if (!t.phase || t.length <= 0) return 1;
  return Math.max(0, Math.min(1, (t.endsAt - t.now) / t.length));
}

/** Whole minutes left, rounded up, as the glass shows beside it. */
export function minutesLeft(t: { endsAt: number; now: number }): number {
  return Math.max(0, Math.ceil((t.endsAt - t.now) / 60_000));
}

/** The volume slider is linear to the ear, so the gain is its square. */
export function loudness(volume: number): number {
  const v = Math.max(0, Math.min(1, volume));
  return v * v;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sounds: { start: AudioBuffer; end: AudioBuffer } | null = null;
let scheduled: AudioBufferSourceNode[] = [];
let tick: ReturnType<typeof setInterval> | undefined;

async function load(audio: AudioContext, url: string) {
  return audio.decodeAudioData(await (await fetch(url)).arrayBuffer());
}

/** Wake the audio. It must start inside a click, or the webview keeps it silent. */
async function audio() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = loudness(settings.volume);
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') await ctx.resume();
    if (!sounds) {
      const [start, end] = await Promise.all([load(ctx, startUrl), load(ctx, endUrl)]);
      sounds = { start, end };
    }
    return sounds;
  } catch (e) {
    console.error('the hourglass sounds could not load', e);
    return null;
  }
}

// The samples end after a few seconds. A soft room (a convolver with a long,
// decaying noise impulse) lets each bell ring out for several more, and the
// dry sound eases down over its last second instead of stopping.
const TAIL_S = 4.5;
const WET = 0.4;
const DRY_FADE_S = 1;
/** The room is warm: its echo loses its highs, above this, before it is heard. */
const ROOM_TONE_HZ = 1800;
let room: ConvolverNode | null = null;

/** Stereo noise that decays to silence over `seconds`: the room's impulse.
 * The noise is smoothed more as it decays, so the highs die first, as in a
 * real room, and the tail is a soft wash rather than a hiss. */
function impulse(audio: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(2, length, audio.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const k = 0.5 - 0.42 * t; // from half-smoothed to very smooth
      smooth += k * (Math.random() * 2 - 1 - smooth);
      data[i] = smooth * Math.pow(1 - t, 4);
    }
  }
  return buffer;
}

function roomFor(audio: AudioContext, out: AudioNode): ConvolverNode {
  if (!room) {
    room = audio.createConvolver();
    room.buffer = impulse(audio, TAIL_S);
    const tone = audio.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = ROOM_TONE_HZ;
    tone.Q.value = 0.5;
    const wet = audio.createGain();
    wet.gain.value = WET;
    room.connect(tone).connect(wet).connect(out);
  }
  return room;
}

/** Play a sound `inMs` from now, on the audio clock. */
function ringIn(buffer: AudioBuffer, inMs: number) {
  if (!ctx || !master) return;
  const at = ctx.currentTime + Math.max(0, inMs) / 1000;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const dry = ctx.createGain();
  const fadeFrom = at + Math.max(0, buffer.duration - DRY_FADE_S);
  dry.gain.setValueAtTime(1, fadeFrom);
  dry.gain.linearRampToValueAtTime(0.0001, at + buffer.duration);
  source.connect(dry).connect(master);
  source.connect(roomFor(ctx, master));
  source.start(at);
  scheduled.push(source);
}

function silence() {
  for (const s of scheduled) {
    try {
      s.stop();
    } catch {
      // Already rung.
    }
  }
  scheduled = [];
}

function glow() {
  timer.ringing = true;
  setTimeout(() => (timer.ringing = false), 1400);
}

// The running glass is saved too, so closing and reopening Mandala picks it up.
const RUN_KEY = 'mandala.hourglass.run';

function saveRun() {
  if (timer.phase) {
    const { phase, endsAt, length } = timer;
    globalThis.localStorage?.setItem(RUN_KEY, JSON.stringify({ phase, endsAt, length, rest: settings.rest, paused: timer.paused }));
  } else {
    globalThis.localStorage?.removeItem(RUN_KEY);
  }
}

function begin(phase: Phase) {
  timer.phase = phase;
  timer.paused = null;
  timer.length = (phase === 'focus' ? settings.work : settings.rest) * 60_000;
  timer.now = Date.now();
  timer.endsAt = timer.now + timer.length;
  saveRun();
}

function step() {
  timer.now = Date.now();
  if (timer.now < timer.endsAt) return;
  glow();
  if (timer.phase === 'focus') begin('rest');
  else stop();
}

export function stop() {
  clearInterval(tick);
  silence();
  timer.phase = null;
  timer.paused = null;
  saveRun();
}

/** Pause the glass, or let it run on. The bells still to come wait with it. */
export async function pause() {
  if (!timer.phase) return;
  if (timer.paused === null) {
    clearInterval(tick);
    silence();
    timer.now = Date.now();
    timer.paused = Math.max(0, timer.endsAt - timer.now);
    saveRun();
    return;
  }
  timer.now = Date.now();
  timer.endsAt = timer.now + timer.paused;
  timer.paused = null;
  saveRun();
  clearInterval(tick);
  tick = setInterval(step, 1000);
  await scheduleRemaining();
}

/** Turn the glass: start a sitting, or stop the one running. */
export async function turn() {
  if (timer.phase) {
    stop();
    return;
  }
  begin('focus');
  clearInterval(tick);
  tick = setInterval(step, 1000);
  const s = await audio();
  if (!s || timer.phase !== 'focus') return; // no sound, or stopped while it loaded
  const left = timer.endsAt - Date.now();
  ringIn(s.start, 0);
  ringIn(s.end, left);
  ringIn(s.end, left + settings.rest * 60_000);
}

/** Schedule the bells still to come for the glass as it runs now. */
async function scheduleRemaining() {
  const s = await audio();
  if (!s || !timer.phase || ctx?.state !== 'running') return false;
  silence();
  const left = timer.endsAt - Date.now();
  ringIn(s.end, left);
  if (timer.phase === 'focus') ringIn(s.end, left + settings.rest * 60_000);
  return true;
}

/** Pick up a glass that was running when Mandala last closed. */
function resume() {
  let saved: { phase: Phase; endsAt: number; length: number; rest: number; paused?: number | null } | null = null;
  try {
    saved = JSON.parse(globalThis.localStorage?.getItem(RUN_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  if (!saved || typeof window === 'undefined') return;
  const now = Date.now();
  // A paused glass stays paused, with the time it had.
  if (typeof saved.paused === 'number') {
    Object.assign(timer, { phase: saved.phase, length: saved.length, now, endsAt: now + saved.paused, paused: saved.paused });
    return;
  }
  const restMs = saved.rest * 60_000;
  if (saved.phase === 'focus' && saved.endsAt > now) {
    Object.assign(timer, { phase: 'focus', endsAt: saved.endsAt, length: saved.length, now });
  } else if (saved.phase === 'focus' && saved.endsAt + restMs > now) {
    Object.assign(timer, { phase: 'rest', endsAt: saved.endsAt + restMs, length: restMs, now });
  } else if (saved.phase === 'rest' && saved.endsAt > now) {
    Object.assign(timer, { phase: 'rest', endsAt: saved.endsAt, length: saved.length, now });
  } else {
    globalThis.localStorage?.removeItem(RUN_KEY);
    return;
  }
  saveRun();
  tick = setInterval(step, 1000);
  // Audio may only wake on a touch: try now, and again on the first one.
  scheduleRemaining().then((ok) => {
    if (ok) return;
    const wake = () => scheduleRemaining();
    window.addEventListener('pointerdown', wake, { once: true });
    window.addEventListener('keydown', wake, { once: true });
  });
}

resume();

const DEMO_MS = 2600;

/** Both bells, with the glass turning and running through between them. */
export async function test() {
  if (timer.demo !== null) return;
  timer.demo = 1;
  const s = await audio();
  if (s) ringIn(s.start, 0);
  const from = performance.now();
  const run = (t: number) => {
    const p = Math.min(1, (t - from) / DEMO_MS);
    timer.demo = 1 - p * p * (3 - 2 * p); // ease in and out
    if (p < 1) return void requestAnimationFrame(run);
    if (s) ringIn(s.end, 0);
    glow();
    setTimeout(() => (timer.demo = null), 1400);
  };
  requestAnimationFrame(run);
}
