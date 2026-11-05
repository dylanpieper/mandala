import { describe, expect, it } from 'vitest';
import { PICTURE, stampedName } from './pictures';

describe('pictures', () => {
  it('names a picture by when it was made', () => {
    expect(stampedName('Pasted', 'png', new Date(2026, 10, 1, 9, 5))).toBe('Pasted 2026-11-01 09.05.png');
  });

  it('knows a picture by its name', () => {
    for (const n of ['a.png', 'b.JPG', 'c.jpeg', 'd.gif', 'e.webp', 'Drawing 2026-11-01 09.05.svg']) expect(PICTURE.test(n)).toBe(true);
    for (const n of ['Note', 'Note.md', 'a.pdf', 'png']) expect(PICTURE.test(n)).toBe(false);
  });
});
