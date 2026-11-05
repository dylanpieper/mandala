// Done tasks sink: in a run of `- [ ]` items at one indent, the open ones
// come first and the done ones after, each keeping its order. An item's
// deeper-indented lines move with it.

const TASK = /^(\s*)[-*+] \[([ xX])\]/;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * Sort the task run that holds line `at` (0-based). Returns the first line,
 * the line after the run, and the run's lines in their new order; or null if
 * line `at` is not a task or nothing would move.
 */
export function sortTaskRun(lines: string[], at: number): { from: number; to: number; lines: string[] } | null {
  const head = TASK.exec(lines[at] ?? '');
  if (!head) return null;
  const indent = head[1].length;
  const isItem = (i: number) => {
    const m = TASK.exec(lines[i]);
    return m !== null && m[1].length === indent;
  };
  const isChild = (i: number) => lines[i].trim() !== '' && indentOf(lines[i]) > indent;

  // Walk back to the first item of the run.
  let from = at;
  for (let i = at - 1; i >= 0; i--) {
    if (isItem(i)) from = i;
    else if (!isChild(i)) break;
  }

  // Walk forward, grouping each item with its children.
  const items: { done: boolean; lines: string[] }[] = [];
  let i = from;
  while (i < lines.length && isItem(i)) {
    const item = { done: /x/i.test(TASK.exec(lines[i])![2]), lines: [lines[i]] };
    i++;
    while (i < lines.length && isChild(i)) item.lines.push(lines[i++]);
    items.push(item);
  }

  const sorted = [...items.filter((t) => !t.done), ...items.filter((t) => t.done)];
  if (sorted.every((t, k) => t === items[k])) return null;
  return { from, to: i, lines: sorted.flatMap((t) => t.lines) };
}
