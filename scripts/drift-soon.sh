#!/usr/bin/env bash
# Put a sun note into a vault that runs out in a few seconds, to watch sand let
# go on its own while Mandala is open. Use a sample vault, never the real one.
#
#   scripts/drift-soon.sh <vault> [seconds]     seconds defaults to 10
set -euo pipefail

vault="${1:?usage: scripts/drift-soon.sh <vault> [seconds]}"
secs="${2:-10}"
[[ -d "$vault/sand/sun" ]] || { echo "not an arranged vault: $vault" >&2; exit 2; }

file="$vault/sand/sun/Drifts in $secs seconds $(date +%H%M%S).md"
printf '# Drifts in %s seconds\n\nWatch it go. Restore brings it back.\n' "$secs" > "$file"
# Written a day ago less the seconds: a sun lasts 24 hours from when it was written.
back=$((86400 - secs))
if date -v-1S >/dev/null 2>&1; then
  touch -t "$(date -v-"${back}"S +%Y%m%d%H%M.%S)" "$file"
else
  touch -d "-${back} seconds" "$file"
fi
echo "$file"
