import { describe, expect, it } from 'vitest';
import { placeOf } from './place';

describe('placeOf', () => {
  it('reads stone, sand and its lifespan from the folder, as the core does', () => {
    expect(placeOf('stone/Reading/Ryokan.md')).toEqual({ kind: 'stone' });
    expect(placeOf('sand/breath/a.md')).toEqual({ kind: 'sand', life: 'breath' });
    expect(placeOf('sand/sun/a.md')).toEqual({ kind: 'sand', life: 'sun' });
    expect(placeOf('sand/moon/half/a.md')).toEqual({ kind: 'sand', life: 'half' });
    // A loose note in sand/ is a sun; one directly in sand/moon/ is a full moon.
    expect(placeOf('sand/a.md')).toEqual({ kind: 'sand', life: 'sun' });
    expect(placeOf('sand/moon/a.md')).toEqual({ kind: 'sand', life: 'full' });
    expect(placeOf('Outside/a.md')).toBeNull();
  });
});
