import { describe, expect, it } from 'vitest';
import { toggleMark } from './format';

// `[` and `]` mark the selection in these strings; a lone `|` is the caret.
function run(marked: string, mark: string) {
  const caret = marked.indexOf('|');
  const from = caret >= 0 ? caret : marked.indexOf('[');
  const to = caret >= 0 ? caret : marked.indexOf(']') - 1;
  const text = marked.replace(/[[\]|]/g, '');
  const r = toggleMark(text, from, to, mark);
  return r.from === r.to ? r.text.slice(0, r.from) + '|' + r.text.slice(r.from) : r.text.slice(0, r.from) + '[' + r.text.slice(r.from, r.to) + ']' + r.text.slice(r.to);
}

describe('toggleMark', () => {
  it('wraps a selection', () => {
    expect(run('a [word] here', '**')).toBe('a **[word]** here');
    expect(run('a [word] here', '*')).toBe('a *[word]* here');
    expect(run('a [word] here', '`')).toBe('a `[word]` here');
    expect(run('a [word] here', '~~')).toBe('a ~~[word]~~ here');
  });

  it('unwraps a selection already wrapped, marks outside or inside it', () => {
    expect(run('a **[word]** here', '**')).toBe('a [word] here');
    expect(run('a [**word**] here', '**')).toBe('a [word] here');
    expect(run('a *[word]* here', '*')).toBe('a [word] here');
  });

  it('tells italic from bold', () => {
    // A bold word made italic too, and an italic mark taken from bold-italic.
    expect(run('a **[word]** here', '*')).toBe('a ***[word]*** here');
    expect(run('a ***[word]*** here', '*')).toBe('a **[word]** here');
  });

  it('puts empty marks at the caret, the caret between them', () => {
    expect(run('a | here', '**')).toBe('a **|** here');
    expect(run('a | here', '*')).toBe('a *|* here');
  });

  it('takes empty marks away again', () => {
    expect(run('a **|** here', '**')).toBe('a | here');
  });

  it('pressed again at the end of the text, hops past the closing marks', () => {
    expect(run('a **word|** here', '**')).toBe('a **word**| here');
    expect(run('a *word|* here', '*')).toBe('a *word*| here');
    expect(run('a `code|` here', '`')).toBe('a `code`| here');
    expect(run('a ~~gone|~~ here', '~~')).toBe('a ~~gone~~| here');
  });
});
