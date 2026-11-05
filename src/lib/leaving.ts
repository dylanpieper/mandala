// What must be done before the window leaves the vault (closing, or changing
// vaults): the last save, and the open note's name following its title. The
// app waits for these before it closes, so nothing is lost on a quick quit.

const tasks = new Set<() => Promise<unknown>>();

/** Do `task` before the vault is left. Returns a function that stops it. */
export function beforeLeaving(task: () => Promise<unknown>): () => void {
  tasks.add(task);
  return () => tasks.delete(task);
}

/** Run every task, each one's failure kept from stopping the rest. */
export async function leaving(): Promise<void> {
  for (const t of [...tasks]) await t().catch(() => undefined);
}
