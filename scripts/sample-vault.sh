#!/usr/bin/env bash
# A throwaway vault to try Mandala on. Never the real one.
#
#   scripts/sample-vault.sh                 a small unarranged Obsidian-style vault
#   scripts/sample-vault.sh --from <vault>  a copy of a real vault
#   scripts/sample-vault.sh --arranged      already arranged, with sand of every
#                                           lifespan, some of it run out, so the
#                                           opening sequence has something to show
#   scripts/sample-vault.sh --full          arranged, and a whole life of notes:
#                                           about 60, six stone folders (one empty),
#                                           sand of every age, links between them,
#                                           and notes settling, for the mandala view
#   scripts/sample-vault.sh --large         --full, and hundreds more: about 400 stone
#                                           notes in 24 folders (some nested), 240
#                                           sand of every lifespan, links, and 40
#                                           notes settling, to try the UI at scale
#   scripts/sample-vault.sh --large-unarranged
#                                           the same 24 folders of notes, not yet
#                                           arranged, to try the first arrange
#
# Prints the vault's path. Open it with `npm run app`, then "Choose a vault".
set -euo pipefail

from=""
arranged=0
full=0
large=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) from="$2"; shift 2 ;;
    --arranged) arranged=1; shift ;;
    --full) arranged=1; full=1; shift ;;
    --large) arranged=1; full=1; large=1; shift ;;
    --large-unarranged) large=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

# Not "Notes": the app keeps each vault's state under its folder name, so a
# sample named like a real vault would share that vault's last-seen versions.
dir="$(mktemp -d "${TMPDIR:-/tmp}/mandala-sandbox.XXXXXX")/Sample"
mkdir -p "$dir"

if [[ -n "$from" ]]; then
  cp -R "$from"/. "$dir"/
  echo "$dir"
  exit 0
fi

note() { mkdir -p "$(dirname "$dir/$1")"; printf '%b' "$2" > "$dir/$1"; }
# touch -t wants [[CC]YY]MMDDhhmm; this makes "N hours ago" on macOS and Linux.
ago() {
  local hours="$1" file="$dir/$2"
  if date -v-1H >/dev/null 2>&1; then
    touch -t "$(date -v-"${hours}"H +%Y%m%d%H%M)" "$file"
  else
    touch -d "-${hours} hours" "$file"
  fi
}

mkdir -p "$dir/.obsidian" "$dir/attachments"
printf '{\n  "spellcheck": true\n}\n' > "$dir/.obsidian/app.json"

root=""
[[ $arranged -eq 1 ]] && root="stone/"

note "${root}Practice/Impermanence.md" "# Impermanence\n\nThe sand mandala takes days to build and a minute to sweep.\n\nSee [[Reading/Ryokan]].\n"
note "${root}Practice/Sitting log.md" "# Sitting log\n\n- twenty minutes, the whole way\n"
note "${root}Reading/Ryokan.md" "# Ryokan\n\nThe thief left it behind: the moon at my window.\n"
note "${root}Letters/To my brother.md" "# To my brother\n\n"
note "${root}Inbox.md" "# Inbox\n\n- [ ] call the framer\n"

if [[ $arranged -eq 1 ]]; then
  sed -i.bak 's#\[\[Reading/#[[stone/Reading/#' "$dir/stone/Practice/Impermanence.md" && rm "$dir/stone/Practice/Impermanence.md.bak"
  mkdir -p "$dir/sand/breath" "$dir/sand/sun" "$dir/sand/moon/quarter" "$dir/sand/moon/half" "$dir/sand/moon/full" "$dir/.mandala"
  note "sand/sun/Morning pages.md" "# Morning pages\n\nThinking about [[Impermanence]] again.\n\n- [x] Sit before coffee\n- [ ] Walk the river path\n"
  ago 6 "sand/sun/Morning pages.md"
  note "sand/sun/A worry about Monday.md" "# A worry about Monday\n\nWhat if it goes badly.\n"
  ago 30 "sand/sun/A worry about Monday.md"
  # A sun written 24 hours less ten seconds ago: it runs out ten seconds after
  # this script ends. Open the vault within ten seconds to watch it let go on its
  # own; open it later and it waits under "What's leaving".
  note "sand/sun/Drifts in ten seconds.md" "# Drifts in ten seconds\n\nWatch it go. Restore brings it back.\n"
  if date -v-1S >/dev/null 2>&1; then
    touch -t "$(date -v-86390S +%Y%m%d%H%M.%S)" "$dir/sand/sun/Drifts in ten seconds.md"
  else
    touch -d "-86390 seconds" "$dir/sand/sun/Drifts in ten seconds.md"
  fi
  note "sand/breath/Phone number for the framer.md" "# Phone number for the framer\n\n0161 496 0734\n"
  note "sand/moon/quarter/Walking route.md" "# Walking route\n\nRiver path, the long bend.\n"
  ago 40 "sand/moon/quarter/Walking route.md"
  note "sand/moon/half/To J., unsent.md" "# To J., unsent\n\nI keep starting this.\n"
  ago 200 "sand/moon/half/To J., unsent.md"
  note "sand/moon/full/Half a poem about rain.md" "# Half a poem about rain\n\nThe gutters learn the shape of the street\n"
  ago 300 "sand/moon/full/Half a poem about rain.md"
  printf '{\n  "spellcheck": true\n}\n' > "$dir/.obsidian/app.json"
fi

# An ISO time in UTC, N hours ago, for settling notes' meta.json.
utc_ago() {
  if date -v-1H >/dev/null 2>&1; then
    date -u -v-"$1"H +%Y-%m-%dT%H:%M:%SZ
  else
    date -u -d "-$1 hours" +%Y-%m-%dT%H:%M:%SZ
  fi
}

if [[ $full -eq 1 ]]; then
  # Stone: a petal per folder, of different sizes, and one folder left empty.
  for t in "Body scan" "Walking" "Retreat, spring" "Metta phrases" "Breath counting" "Noting practice"; do
    note "stone/Practice/$t.md" "# $t\n\nPart of the practice. See [[Impermanence]] and [[Sitting log]].\n"
  done
  for t in "Basho" "Thich Nhat Hanh" "Beginner's mind" "The Heart Sutra" "Mary Oliver" "Reading list"; do
    note "stone/Reading/$t.md" "# $t\n\nA line worth keeping. [[Ryokan]]\n"
  done
  note "stone/Reading/Reading list.md" "# Reading list\n\n- [[Basho]]\n- [[Thich Nhat Hanh]]\n- [[Beginner's mind]]\n- [[Mary Oliver]]\n"
  for t in "To my mother" "From A., kept" "To my brother, sent"; do
    note "stone/Letters/$t.md" "# $t\n\nThe garden in October.\n"
  done
  for t in "Miso soup" "Bread" "Dal" "Congee" "Pickled radish"; do
    note "stone/Recipes/$t.md" "# $t\n\nSlowly, by hand.\n"
  done
  note "stone/Recipes/Miso soup.md" "# Miso soup\n\nDashi first, then the miso off the heat. [[Pickled radish]] on the side.\n"
  for t in "Principles" "Q4 goals" "One-on-ones" "Project Lantern"; do
    note "stone/Work/$t.md" "# $t\n\nDo the next right thing. [[Principles]]\n"
  done
  mkdir -p "$dir/stone/Travel"
  note "stone/Someday.md" "# Someday\n\nKyoto in autumn. [[Basho]]\n"

  # Sand of every lifespan and age. Each line: lifespan folder, hours old, title, a link or none.
  while IFS='|' read -r life hours title link; do
    body="# $title\n\nWritten down so it can go.\n"
    [[ -n "$link" ]] && body="$body\nAbout [[$link]].\n"
    note "sand/$life/$title.md" "$body"
    ago "$hours" "sand/$life/$title.md"
  done <<'LIST'
breath|0|Parking, level 3|
breath|1|A tune stuck in my head|
breath|2|Wifi password at the cafe|
sun|1|Dream, the lighthouse|
sun|3|Groceries, Sunday|Miso soup
sun|8|Idea for the garden|Someday
sun|14|Call the dentist|
sun|19|Something overheard on the train|
sun|22|A worry about Tuesday|
moon/quarter|10|Bread, attempt 2|Bread
moon/quarter|40|Questions for Thursday|Q4 goals
moon/quarter|90|Books to look for|Reading list
moon/quarter|130|Running shoes, sizes|
moon/quarter|165|Plan for the weekend|
moon/half|20|Gift ideas|Basho
moon/half|100|Something A. said|From A., kept
moon/half|200|Sketch for a story|
moon/half|280|Lantern, open questions|Project Lantern
moon/half|340|Old phone numbers|
moon/full|30|Notes on silence|Retreat, spring
moon/full|150|Running|
moon/full|320|What the river taught me|Walking
moon/full|480|Second half of the poem|Half a poem about rain
moon/full|640|A list of small joys|
moon/full|700|Letter to J., second draft|To J., unsent
sun|26|Pick up the dry cleaning|
sun|31|Train times, Friday|
sun|44|Half-remembered dream|
sun|60|Ideas from the walk|Walking
sun|90|Questions for the plumber|
moon/quarter|185|Draft reply to the landlord|
moon/quarter|240|Recipe to try, lentils|Dal
moon/quarter|400|Things to say at the meeting|One-on-ones
moon/half|370|Notes from the lecture|
moon/half|520|A list of maybes|
moon/full|730|Old plan for the summer|Someday
moon/full|900|Lines that did not fit the poem|Half a poem about rain
LIST

  # Dust: notes let go in the last day, resting in .mandala/settling/.
  while IFS='|' read -r hours reason rel; do
    id="$(utc_ago "$hours" | tr -d ':-')-$hours"
    name="${rel##*/}"
    mkdir -p "$dir/.mandala/settling/$id"
    printf '# %s\n\nLet go.\n' "${name%.md}" > "$dir/.mandala/settling/$id/$name"
    printf '{\n  "id": "%s",\n  "rel": "%s",\n  "title": "%s",\n  "reason": "%s",\n  "at": "%s"\n}\n' \
      "$id" "$rel" "${name%.md}" "$reason" "$(utc_ago "$hours")" > "$dir/.mandala/settling/$id/meta.json"
  done <<'LIST'
1|deleted|sand/sun/A draft I did not need.md
4|swept|sand/breath/Dream, the station.md
9|swept|sand/sun/Shopping, Wednesday.md
15|deleted|stone/Work/Old org chart.md
21|swept|sand/moon/quarter/Old plan.md
LIST
fi

if [[ $large -eq 1 ]]; then
  # The same every time: titles from two word lists, picked by a seeded RANDOM.
  RANDOM=42
  first=(Notes Thoughts Questions Draft Plan Ideas Sketch Letter List Memory Reading Lines Map Fragments Pattern Study Outline Journal Answer Story)
  second=(rain light "the river" silence autumn "the garden" morning "the city" winter "the sea" stillness bread "the mountain" friends work "the north wind" home "old maps" "the kitchen")
  # macOS has bash 3.2, so no namerefs: the array's name goes through eval.
  pick() { eval "echo \"\${$1[RANDOM % \${#$1[@]}]}\""; }
  folders=(Archive Projects Health Garden Music Poems Teaching Family Finance Ideas Kitchen Field\ notes Quotes Research Writing Books Film Places People Habits Clients Workshop Dreams Learning)
  titles=()

  # Stone: 24 folders of 8 to 26 notes; a few with a subfolder.
  for f in "${folders[@]}"; do
    n=$((8 + RANDOM % 19))
    for ((i = 1; i <= n; i++)); do
      t="$(pick first) on $(pick second) $i"
      sub=""
      ((RANDOM % 6 == 0)) && sub="Older/"
      link=""
      ((${#titles[@]} > 0 && RANDOM % 3 == 0)) && link="\n\nSee [[${titles[RANDOM % ${#titles[@]}]}]]."
      note "${root}$f/$sub$t.md" "# $t\n\nSomething worth keeping about $(pick second).$link\n\n- one\n- two\n"
      titles+=("$t")
    done
  done
fi

# Unarranged, the large vault is only its folders, for the first arrange.
if [[ $large -eq 1 && $arranged -eq 1 ]]; then
  # Sand: 240 notes, every lifespan, ages inside each lifespan so few run out.
  lives=(breath sun sun sun moon/quarter moon/quarter moon/half moon/half moon/full moon/full)
  for ((i = 1; i <= 240; i++)); do
    life="$(pick lives)"
    case "$life" in
      breath) hours=0 ;;
      sun) hours=$((RANDOM % 23)) ;;
      moon/quarter) hours=$((RANDOM % 170)) ;;
      moon/half) hours=$((RANDOM % 340)) ;;
      moon/full) hours=$((RANDOM % 690)) ;;
    esac
    t="$(pick first) about $(pick second), $i"
    body="# $t\n\nWritten down so it can go.\n"
    ((RANDOM % 4 == 0)) && body="$body\nAbout [[${titles[RANDOM % ${#titles[@]}]}]].\n"
    note "sand/$life/$t.md" "$body"
    ago "$hours" "sand/$life/$t.md"
  done

  # Dust: 40 more notes let go in the last day.
  for ((i = 1; i <= 40; i++)); do
    hours=$((RANDOM % 23))
    name="Let go $i, $(pick second).md"
    id="$(utc_ago "$hours" | tr -d ':-')-large-$i"
    mkdir -p "$dir/.mandala/settling/$id"
    printf '# %s\n\nLet go.\n' "${name%.md}" > "$dir/.mandala/settling/$id/$name"
    printf '{\n  "id": "%s",\n  "rel": "%s",\n  "title": "%s",\n  "reason": "swept",\n  "at": "%s"\n}\n' \
      "$id" "sand/sun/$name" "${name%.md}" "$(utc_ago "$hours")" > "$dir/.mandala/settling/$id/meta.json"
  done
fi

echo "$dir"
