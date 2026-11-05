import { describe, expect, it } from 'vitest';
import { sortTaskRun } from './tasks';

const run = (text: string, at: number) => {
  const lines = text.split('\n');
  const r = sortTaskRun(lines, at);
  if (!r) return null;
  return [...lines.slice(0, r.from), ...r.lines, ...lines.slice(r.to)].join('\n');
};

describe('sortTaskRun', () => {
  it('sinks a done task below the open ones', () => {
    expect(run('- [x] a\n- [ ] b\n- [ ] c', 0)).toBe('- [ ] b\n- [ ] c\n- [x] a');
  });

  it('raises a reopened task above the done ones, keeping order', () => {
    expect(run('- [ ] a\n- [x] b\n- [ ] c\n- [x] d', 2)).toBe('- [ ] a\n- [ ] c\n- [x] b\n- [x] d');
  });

  it('moves an item with its children, and stops at other text', () => {
    const text = '# List\n- [x] a\n  - [ ] a1\n- [ ] b\n\n- [ ] other';
    expect(run(text, 1)).toBe('# List\n- [ ] b\n- [x] a\n  - [ ] a1\n\n- [ ] other');
  });

  it('sorts a nested run on its own', () => {
    const text = '- [ ] a\n  - [x] a1\n  - [ ] a2';
    expect(run(text, 1)).toBe('- [ ] a\n  - [ ] a2\n  - [x] a1');
  });

  it('does nothing when already in order or not a task', () => {
    expect(run('- [ ] a\n- [x] b', 1)).toBeNull();
    expect(run('plain', 0)).toBeNull();
  });
});
