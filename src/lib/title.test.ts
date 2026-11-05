import { describe, expect, it } from 'vitest';
import { joinNote, splitNote } from './title';

describe('splitNote', () => {
  it('takes the first heading out as the title', () => {
    const n = splitNote('# Rain on the roof\n\nIt fell all night.\n');
    expect(n.title).toBe('Rain on the roof');
    expect(n.body).toBe('It fell all night.\n');
  });

  it('finds no title in a note without one, or one that starts with ##', () => {
    expect(splitNote('Just words.').title).toBeNull();
    expect(splitNote('## Smaller\n\ntext').title).toBeNull();
  });

  it('round-trips any note exactly when nothing changed', () => {
    for (const t of ['# A\n\nb', '\n\n# A\nb', '# A', 'no heading\n# later', '', '# A\n\n\n\nb\n', '#Not a heading']) {
      const n = splitNote(t);
      expect(joinNote(n, n.title, n.body)).toBe(t);
    }
  });
});

describe('joinNote', () => {
  it('writes a changed title back as the first heading', () => {
    const n = splitNote('# Old\n\nbody');
    expect(joinNote(n, 'New', 'body')).toBe('# New\n\nbody');
  });

  it('adds a heading only when a title is typed into a note without one', () => {
    const n = splitNote('An Obsidian note.');
    expect(joinNote(n, '', 'An Obsidian note.')).toBe('An Obsidian note.');
    expect(joinNote(n, 'Named', 'An Obsidian note.')).toBe('# Named\n\nAn Obsidian note.');
  });

  it('takes the heading line out when the title is cleared', () => {
    const n = splitNote('# Old\n\nbody');
    expect(joinNote(n, '', 'body')).toBe('body');
  });

  it('never lets a heading in the body become the title when the title is cleared', () => {
    // A woven note: the second note's heading is in the body.
    const n = splitNote('# A\n\nline from A\n# B\nline from B');
    const cleared = joinNote(n, '', n.body);
    expect(splitNote(cleared).title ?? '').toBe('');
    expect(splitNote(cleared).body).toBe('line from A\n# B\nline from B');
    const top = splitNote('# A\n\n# B\ntext');
    const out = joinNote(top, '', top.body);
    expect(splitNote(out).title).toBe('');
    expect(splitNote(out).body).toBe('# B\ntext');
  });

  it('reads an empty heading as no title, and keeps it as it was', () => {
    const n = splitNote('# \n\n# B\ntext');
    expect(n.title).toBe('');
    expect(joinNote(n, '', n.body)).toBe('# \n\n# B\ntext');
    expect(joinNote(n, 'Named', n.body)).toBe('# Named\n\n# B\ntext');
  });

  it('keeps the title on one line', () => {
    const n = splitNote('# A\n\nb');
    expect(joinNote(n, 'two\nlines', 'b')).toBe('# two lines\n\nb');
  });
});
