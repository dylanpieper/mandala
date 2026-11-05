// Which rails show: this computer's preference, kept in localStorage.
const KEY = 'mandala.panes';

export const panes = $state<{ stone: boolean; sand: boolean }>({ stone: true, sand: true, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') });

function save() {
  localStorage.setItem(KEY, JSON.stringify(panes));
}

export function togglePane(side: 'stone' | 'sand') {
  panes[side] = !panes[side];
  save();
}
