import { describe, expect, it } from 'vitest';
import { makeTable, parseTable, removeColumn, removeRow, tableMarkdown } from './tables';

describe('tableMarkdown', () => {
  it('writes a table back, keeping alignment', () => {
    const md = '| Day | Minutes |\n| :--- | ---: |\n| Mon | 20 |';
    expect(tableMarkdown(parseTable(md)!)).toBe(md);
  });
  it('escapes a pipe typed in a cell, and flattens a line break', () => {
    expect(tableMarkdown({ head: ['a|b'], align: [null], rows: [['x\ny']] })).toBe('| a\\|b |\n| --- |\n| x y |');
  });
  it('round-trips through parseTable', () => {
    const t = { head: ['A', 'B'], align: ['center', null] as ('center' | null)[], rows: [['1', ''], ['', '2']] };
    expect(parseTable(tableMarkdown(t))).toEqual(t);
  });
});

describe('makeTable', () => {
  it('writes an empty table that reads back with its size', () => {
    const md = makeTable(3, 2);
    expect(md).toBe('|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |');
    const t = parseTable(md);
    expect(t?.head.length).toBe(3);
    expect(t?.rows.length).toBe(2);
  });
});

describe('parseTable', () => {
  it('reads the head, the alignment and the rows', () => {
    const t = parseTable('| Day | Minutes | Note |\n|:---|---:|:---:|\n| Mon | 20 | quiet |\n| Tue | 35 | rain |');
    expect(t).toEqual({
      head: ['Day', 'Minutes', 'Note'],
      align: ['left', 'right', 'center'],
      rows: [
        ['Mon', '20', 'quiet'],
        ['Tue', '35', 'rain'],
      ],
    });
  });

  it('takes rows without outer pipes, and fills short rows', () => {
    const t = parseTable('a | b\n--- | ---\n1');
    expect(t?.head).toEqual(['a', 'b']);
    expect(t?.align).toEqual([null, null]);
    expect(t?.rows).toEqual([['1', '']]);
  });

  it('keeps an escaped pipe inside a cell', () => {
    const t = parseTable('| a |\n|---|\n| x \\| y |');
    expect(t?.rows).toEqual([['x | y']]);
  });

  it('is null without a delimiter row', () => {
    expect(parseTable('| a |\n| b |')).toBeNull();
  });
});

describe('removeRow and removeColumn', () => {
  const t = parseTable('| Day | Minutes | Note |\n|:---|---:|:---:|\n| Mon | 20 | quiet |\n| Tue | 35 | rain |')!;
  it('takes out one body row, keeping the header', () => {
    expect(tableMarkdown(removeRow(t, 0))).toBe('| Day | Minutes | Note |\n| :--- | ---: | :---: |\n| Tue | 35 | rain |');
  });
  it('leaves the table as it is for the header row', () => {
    expect(removeRow(t, -1)).toBe(t);
  });
  it('takes out one column, each other column keeping its alignment', () => {
    expect(tableMarkdown(removeColumn(t, 1))).toBe('| Day | Note |\n| :--- | :---: |\n| Mon | quiet |\n| Tue | rain |');
  });
  it('keeps the last column', () => {
    const one = parseTable('| A |\n| --- |\n| 1 |')!;
    expect(removeColumn(one, 0)).toBe(one);
  });
  it('reads back after taking out every body row', () => {
    const empty = removeRow(removeRow(t, 0), 0);
    expect(parseTable(tableMarkdown(empty))).toEqual({ ...t, rows: [] });
  });
});
