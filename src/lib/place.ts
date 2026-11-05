// Where a note lies, from its path alone, as the core reads it
// (`lifespan.rs`): stone, sand with its lifespan, or neither (`Elsewhere`).
import type { Life } from './types';

export type Place = { kind: 'stone' } | { kind: 'sand'; life: Life } | null;

export function placeOf(rel: string): Place {
  const [top, a, b] = rel.split('/');
  if (top === 'stone') return { kind: 'stone' };
  if (top !== 'sand') return null;
  if (a === 'breath' && b) return { kind: 'sand', life: 'breath' };
  if (a === 'moon') return { kind: 'sand', life: b === 'quarter' || b === 'half' ? b : 'full' };
  return { kind: 'sand', life: 'sun' };
}
