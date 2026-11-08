// The five lifespans as the window names them, shortest first: for the
// lifespan card, the New note menu and the note's header.
import type { Life } from './types';

export interface LifeInfo {
  life: Life;
  name: string;
  /** Its length in short, or '' for a breath (it has no clock). */
  time: string;
  /** Its length in words, for labels. */
  long: string;
  /** The color token: `--life-<tone>`. */
  tone: 'breath' | 'sun' | 'moon';
}

export const LIVES: LifeInfo[] = [
  { life: 'breath', name: 'Breath', time: '', long: 'until you close', tone: 'breath' },
  { life: 'sun', name: 'Sun', time: '24h', long: '24 hours', tone: 'sun' },
  { life: 'quarter', name: 'Quarter', time: '7d', long: '7 days', tone: 'moon' },
  { life: 'half', name: 'Half', time: '15d', long: '15 days', tone: 'moon' },
  { life: 'full', name: 'Full', time: '29d', long: '29 days', tone: 'moon' },
];
