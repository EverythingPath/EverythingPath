#!/usr/bin/env bash
# usage: gate-push.test.sh — checks gate-push.sh against a local bare "origin" in a scratch
# repository: the tree-only commit (parentless, REVIEWED's tree, the three trailers), the one
# pushed ref and nothing else (no history, other branch or tag), and every refusal, each of which
# pushes nothing. Never touches a real remote.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=$(mktemp -d "${TMPDIR:?TMPDIR}/gate-push-test-XXXXXX") || exit 1
trap 'rm -rf "$dir"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
r=$dir/repo
origin=$dir/origin.git
g() { git -C "$r" "$@"; }
git init -q --bare "$origin"
git init -q -b main "$r"
g config user.name Fixture; g config user.email fixture@example.test
# A tag and push.followTags: a gate push must still send no tag.
g config push.followTags true
g remote add origin "$origin"
printf 'base\n' > "$r/a.txt"; g add a.txt; g commit -qm base
base=$(g rev-parse HEAD)
g tag -a -m 'a tag' v-fixture
printf 'history only\n' > "$r/old.txt"; g add old.txt; g commit -qm 'history'
history=$(g rev-parse HEAD:old.txt)
g rm -q old.txt; printf 'reviewed\n' > "$r/b.txt"; g add b.txt; g commit -qm reviewed
reviewed=$(g rev-parse HEAD)
tree=$(g rev-parse HEAD^{tree})
g checkout -q -b side "$base"; printf 'side\n' > "$r/c.txt"; g add c.txt; g commit -qm side
side=$(g rev-parse HEAD)
g checkout -q main
# push_env: env(1) arguments (assignments, -u NAME) for the next pushes; empty by default.
push_env=()
push() { (cd "$r" && env "${push_env[@]}" bash "$here/gate-push.sh" "$@") > "$dir/out" 2> "$dir/err"; }
refs() { git -C "$origin" for-each-ref --format='%(refname)' | paste -sd ' '; }

push "$reviewed" "$base" retro-w1b-r1; status=$?
commit=$(cat "$dir/out")
check "a gate push exits 0" "$status" 0
check "it prints the pushed commit" "$(git -C "$origin" rev-parse refs/heads/gate/retro-w1b-r1)" "$commit"
check "the origin gets exactly gate/<label>" "$(refs)" refs/heads/gate/retro-w1b-r1
check "the commit is parentless" "$(git -C "$origin" cat-file commit "$commit" | grep -c '^parent ')" 0
check "its tree is REVIEWED's" "$(git -C "$origin" rev-parse "$commit^{tree}")" "$tree"
check "its trailers bind REVIEWED, BASE and the tree" \
  "$(git -C "$origin" log -1 --format=%B "$commit" | git interpret-trailers --parse | paste -sd ' ')" \
  "Gate-Reviewed: $reviewed Gate-Base: $base Gate-Tree: $tree"
check "no history reaches the origin: BASE" "$(git -C "$origin" cat-file -e "$base" 2> /dev/null && echo present || echo absent)" absent
check "no history reaches the origin: REVIEWED" "$(git -C "$origin" cat-file -e "$reviewed" 2> /dev/null && echo present || echo absent)" absent
check "no history reaches the origin: an old blob" "$(git -C "$origin" cat-file -e "$history" 2> /dev/null && echo present || echo absent)" absent
check "no tag reaches the origin" "$(git -C "$origin" tag | wc -l)" 0
check "the local repository gains only origin's tracking ref" "$(g for-each-ref --format='%(refname) %(objectname)' | grep gate/)" \
  "refs/remotes/origin/gate/retro-w1b-r1 $commit"
push "$reviewed" "$base" retro-w1b-r1; status=$?
check "the same push again is the same commit" "$status $(cat "$dir/out")" "0 $commit"

# refuse <name> <exit> <stderr pattern> <args...>: refused, with its message, and nothing pushed.
refuse() {
  local name=$1 want=$2 pattern=$3; shift 3
  local before; before=$(git -C "$origin" for-each-ref --format='%(refname) %(objectname)')
  push "$@"; local status=$?
  check "refuses $name" "$status $(grep -cE "$pattern" "$dir/err")" "$want 1"
  check "and pushes nothing ($name)" "$(git -C "$origin" for-each-ref --format='%(refname) %(objectname)')" "$before"
  check "and prints no commit ($name)" "$(wc -c < "$dir/out")" 0
}
refuse 'no arguments' 64 '^usage: gate-push.sh'
refuse 'two arguments' 64 '^usage: gate-push.sh' "$reviewed" "$base"
refuse 'four arguments' 64 '^usage: gate-push.sh' "$reviewed" "$base" r2 extra
for label in '' 'Retro-r2' 'gate/r2' 'r2 x' 'r_2' 'r2.x'; do
  refuse "label '$label'" 64 '^usage: gate-push.sh' "$reviewed" "$base" "$label"
done
refuse 'an abbreviated REVIEWED' 64 '^usage: gate-push.sh' "${reviewed:0:12}" "$base" r2
refuse 'a branch name for BASE' 64 '^usage: gate-push.sh' "$reviewed" main r2
refuse 'an unknown REVIEWED' 1 "^gate-push: REVIEWED $(printf 1%.0s {1..40}) is not a commit" "$(printf 1%.0s {1..40})" "$base" r2
refuse 'a tree as BASE' 1 "^gate-push: BASE $tree is not a commit" "$reviewed" "$tree" r2
refuse 'REVIEWED not on BASE' 1 "^gate-push: REVIEWED $reviewed does not descend from BASE $side" "$reviewed" "$side" r2
printf 'dirty\n' >> "$r/b.txt"
refuse 'a modified worktree' 1 '^gate-push: the worktree is not clean' "$reviewed" "$base" r2
g checkout -q -- b.txt
printf 'new\n' > "$r/untracked.txt"
refuse 'an untracked file' 1 '^gate-push: the worktree is not clean' "$reviewed" "$base" r2
# Configuration that hides untracked files or submodule changes from a plain `git status` hides nothing here.
g config status.showUntrackedFiles no
refuse 'an untracked file with status.showUntrackedFiles=no' 1 '^gate-push: the worktree is not clean' "$reviewed" "$base" r2
g config --unset status.showUntrackedFiles
mkdir "$r/new-dir"; printf 'nested\n' > "$r/new-dir/file.txt"; rm "$r/untracked.txt"
refuse 'an untracked file in a new directory' 1 '^gate-push: the worktree is not clean' "$reviewed" "$base" r2
rm -r "$r/new-dir"
# An index entry marked assume-unchanged or skip-worktree hides its worktree change from status.
for flag in --assume-unchanged --skip-worktree; do
  g update-index "$flag" b.txt; printf 'hidden\n' >> "$r/b.txt"
  refuse "a change hidden by $flag" 1 '^gate-push: the index hides worktree changes' "$reviewed" "$base" r2
  g update-index "${flag/--/--no-}" b.txt; g checkout -q -- b.txt
done
# A status that fails (here a corrupt index, exit 128) says nothing about the worktree: refused.
cp "$r/.git/index" "$dir/index"; printf 'not an index\n' > "$r/.git/index"
refuse 'a corrupt index' 1 '^gate-push: git status failed' "$reviewed" "$base" r2
cp "$dir/index" "$r/.git/index"
# The push goes to exactly one destination, or a second one could refuse after the first accepted.
# Pinned corpus of push-destination configuration, each refused before anything is published:
# every value shape through both routes git reads (remote.origin.pushurl, else remote.origin.url),
# then every rewrite or remote that could redirect a push to the one URL.
second=$dir/second.git
git init -q --bare "$second"
cp "$r/.git/config" "$dir/config"
# bad_origin <name> <stderr pattern>: refused, nothing on origin or the second bare repository.
# The second is emptied again after the check, so one case's leak cannot fail the next.
bad_origin() {
  refuse "$1" 1 "$2" "$reviewed" "$base" r2
  check "and pushes nothing to the second ($1)" "$(git -C "$second" for-each-ref | wc -l)" 0
  git -C "$second" for-each-ref --format='delete %(refname)' | git -C "$second" update-ref --stdin
  cp "$dir/config" "$r/.git/config"
}
count='^gate-push: origin has 2 push URLs; a gate push needs exactly one$'
malformed="^gate-push: origin's push URL is empty, starts with '-' or contains a control character$"
# shape <key> <name>: sets <key> to the named shape's values; prints the refusal it expects.
shape() {
  local key=$1
  case $2 in
    two) g config --add "$key" "$origin"; g config --add "$key" "$second"; echo "$count" ;;
    newline-last) g config --add "$key" "$origin"; g config --add "$key" $'\n'; echo "$count" ;;
    newline-first) g config --add "$key" $'\n'; g config --add "$key" "$origin"; echo "$count" ;;
    empty-last) g config --add "$key" "$origin"; g config --add "$key" ''; echo "$count" ;;
    cr-last) g config --add "$key" "$origin"; g config --add "$key" $'\r'; echo "$count" ;;
    empty) g config --add "$key" ''; echo "$malformed" ;;
    valueless) printf '[remote "origin"]\n\t%s\n' "${key##*.}" >> "$r/.git/config"; echo "$malformed" ;;
    newline-only) g config --add "$key" $'\n'; echo "$malformed" ;;
    cr) g config --add "$key" "$origin"$'\r'; echo "$malformed" ;;
    embedded-newline) g config --add "$key" "$origin"$'\n'"$second"; echo "$malformed" ;;
    tab) g config --add "$key" "$origin"$'\t'; echo "$malformed" ;;
    soh) g config --add "$key" $'\x01'"$origin"; echo "$malformed" ;;
    del) g config --add "$key" "$origin"$'\x7f'; echo "$malformed" ;;
    c1-nel) g config --add "$key" "$origin"$'\xc2\x85'; echo "$malformed" ;;
    dash) g config --add "$key" '--mirror'; echo "$malformed" ;;
  esac
}
shapes=(two newline-last newline-first empty-last cr-last empty valueless newline-only cr embedded-newline tab soh del c1-nel dash)
for name in "${shapes[@]}"; do
  want=$(shape remote.origin.pushurl "$name")
  bad_origin "push URL shape $name" "$want"
done
for name in "${shapes[@]}"; do
  g config --unset-all remote.origin.url
  want=$(shape remote.origin.url "$name")
  bad_origin "URL shape $name and no push URL" "$want"
done
# Git rewrites a push URL that starts with a url.<base>.insteadOf or pushInsteadOf value (the
# longest one), the explicit URL included, so any rewrite that applies to the one URL is refused.
rewrite="^gate-push: a url.<base>.insteadOf or pushInsteadOf rewrite applies to origin's push URL$"
g config "url.$dir/second.insteadOf" "$dir/origin"
bad_origin 'an insteadOf rewrite of the push URL' "$rewrite"
g config "url.$dir/second.pushInsteadOf" "$dir/origin"
bad_origin 'a pushInsteadOf rewrite of the push URL' "$rewrite"
g config "url.$second.insteadOf" ''
bad_origin 'an empty insteadOf, which prefixes every URL' "$rewrite"
g config "url.$second.pushInsteadOf" ''
bad_origin 'an empty pushInsteadOf' "$rewrite"
printf '[url "%s"]\n\tinsteadOf\n' "$second" >> "$r/.git/config"
bad_origin 'a valueless insteadOf' '^gate-push: a url.<base>.insteadOf or pushInsteadOf rewrite has no value$'
# git push <url> first reads a remote named <url>: its push URLs would replace the one checked.
named='^gate-push: a remote is named by origin.s push URL, so a push to it would use that remote.s URLs$'
g config remote.origin.pushurl "file://$origin"; g config "remote.file://$origin.pushurl" "$second"
bad_origin 'a remote named by the push URL' "$named"
g config remote.origin.pushurl "file://$origin"; g config "remote.file://$origin.mirror" true
bad_origin 'a remote named by the push URL with only mirror set' "$named"
# Validation must read the configuration the push applies. GIT_CONFIG makes `git config`, and no
# other git command, read one file (git-config(1) ENVIRONMENT; a selected file also skips
# include.path), so with it set, whatever its value, the script refuses before any read. Pinned
# corpus: GIT_CONFIG set to another file (the origin's configuration without the rewrite), empty
# or the repository's own config, times a hidden local, global or included rewrite, times both
# routes (remote.origin.pushurl, else remote.origin.url), times insteadOf and pushInsteadOf.
gitconfig='^gate-push: GIT_CONFIG is set; only git config reads it, not git push, so the push URL checked could differ from the one pushed$'
# hidden_rewrite <mode> <where> <route> <kind>: sets the route and a rewrite of origin to the
# second bare repository in <where>, and push_env's GIT_CONFIG for <mode>.
hidden_rewrite() {
  local mode=$1 where=$2 route=$3 kind=$4
  if [[ $route == pushurl ]]; then
    g config remote.origin.url "$dir/fetch-only.git"; g config remote.origin.pushurl "$origin"
  fi
  cp "$r/.git/config" "$dir/gitconfig-file"
  push_env=()
  case $where in
    local) g config "url.$second.$kind" "$origin" ;;
    global) printf '[url "%s"]\n\t%s = %s\n' "$second" "$kind" "$origin" > "$dir/global"
      push_env=(GIT_CONFIG_GLOBAL="$dir/global") ;;
    include) printf '[url "%s"]\n\t%s = %s\n' "$second" "$kind" "$origin" > "$dir/rewrite.inc"
      g config include.path "$dir/rewrite.inc" ;;
  esac
  case $mode in
    file) push_env+=(GIT_CONFIG="$dir/gitconfig-file") ;;
    empty) push_env+=(GIT_CONFIG=) ;;
    own) push_env+=(GIT_CONFIG="$r/.git/config") ;;
  esac
}
for mode in file empty own; do
  for where in local global include; do
    for route in pushurl url; do
      for kind in insteadOf pushInsteadOf; do
        hidden_rewrite "$mode" "$where" "$route" "$kind"
        bad_origin "GIT_CONFIG $mode with a $where $kind rewrite through $route" "$gitconfig"
      done
    done
  done
done
push_env=(GIT_CONFIG="$r/.git/config")
bad_origin 'GIT_CONFIG set to the repository config with no rewrite' "$gitconfig"
refuse 'GIT_CONFIG set, before reading the arguments' 1 "$gitconfig"
push_env=()
# The other variables that change what git reads apply to `git config` and `git push` alike
# (git(1), git-config(1) ENVIRONMENT), so a rewrite that each brings in is seen and refused:
# GIT_CONFIG_GLOBAL, GIT_CONFIG_SYSTEM, GIT_CONFIG_COUNT/KEY_<n>/VALUE_<n>, GIT_CONFIG_PARAMETERS,
# and HOME and XDG_CONFIG_HOME for the global files when GIT_CONFIG_GLOBAL is unset.
mkdir -p "$dir/home" "$dir/xdg/git" "$dir/empty-home"
for kind in insteadOf pushInsteadOf; do
  rule=$(printf '[url "%s"]\n\t%s = %s\n' "$second" "$kind" "$origin")
  printf '%s\n' "$rule" > "$dir/global"; printf '%s\n' "$rule" > "$dir/system"
  printf '%s\n' "$rule" > "$dir/home/.gitconfig"; printf '%s\n' "$rule" > "$dir/xdg/git/config"
  push_env=(GIT_CONFIG_GLOBAL="$dir/global")
  bad_origin "a GIT_CONFIG_GLOBAL $kind rewrite" "$rewrite"
  push_env=(-u GIT_CONFIG_NOSYSTEM GIT_CONFIG_SYSTEM="$dir/system")
  bad_origin "a GIT_CONFIG_SYSTEM $kind rewrite" "$rewrite"
  push_env=(GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0="url.$second.$kind" GIT_CONFIG_VALUE_0="$origin")
  bad_origin "a GIT_CONFIG_COUNT $kind rewrite" "$rewrite"
  push_env=(GIT_CONFIG_PARAMETERS="'url.$second.$kind'='$origin'")
  bad_origin "a GIT_CONFIG_PARAMETERS $kind rewrite" "$rewrite"
  push_env=(-u GIT_CONFIG_GLOBAL HOME="$dir/home" XDG_CONFIG_HOME="$dir/empty-home")
  bad_origin "a HOME .gitconfig $kind rewrite" "$rewrite"
  push_env=(-u GIT_CONFIG_GLOBAL HOME="$dir/empty-home" XDG_CONFIG_HOME="$dir/xdg")
  bad_origin "an XDG_CONFIG_HOME $kind rewrite" "$rewrite"
done
# Accepted: GIT_CONFIG_GLOBAL alone, holding only a rewrite that does not apply, then a system
# rewrite of origin that GIT_CONFIG_NOSYSTEM hides from both; each push reaches origin only.
printf '[url "%s"]\n\tinsteadOf = https://example.invalid/\n' "$second" > "$dir/global"
# accepted <name> <label>: pushed to origin as gate/<label>, nothing to the second; then removed.
accepted() {
  push "$reviewed" "$base" "$2"; local status=$?
  check "$1 is pushed" "$status $(git -C "$origin" rev-parse "refs/heads/gate/$2")" "0 $(cat "$dir/out")"
  check "and nothing reaches the second ($1)" "$(git -C "$second" for-each-ref | wc -l)" 0
  git -C "$origin" update-ref -d "refs/heads/gate/$2"
}
push_env=(GIT_CONFIG_GLOBAL="$dir/global")
accepted 'GIT_CONFIG_GLOBAL alone with an unrelated rewrite' r5
push_env=(GIT_CONFIG_SYSTEM="$dir/system" GIT_CONFIG_NOSYSTEM=1)
accepted 'a GIT_CONFIG_SYSTEM rewrite under GIT_CONFIG_NOSYSTEM' r5
push_env=()
g config --unset-all remote.origin.url
refuse 'an origin with no URL' 1 '^gate-push: no origin remote' "$reviewed" "$base" r2
cp "$dir/config" "$r/.git/config"
g remote rename origin upstream
refuse 'no origin remote' 1 '^gate-push: no origin remote' "$reviewed" "$base" r2
g remote rename upstream origin
cp "$dir/config" "$r/.git/config"
# Accepted: a rewrite that does not apply, one push URL beside another fetch URL, and another
# remote whose URL is the push URL but whose push URL is not; the push goes to the one URL only.
g config "url.$second.insteadOf" 'https://example.invalid/'
g config remote.origin.url "$second"; g config remote.origin.pushurl "file://$origin"
g remote add other "file://$origin"; g config remote.other.pushurl "$second"
push "$reviewed" "$base" r4; status=$?
check "a push URL beside another URL, an unrelated rewrite and a remote sharing the URL is pushed" \
  "$status $(git -C "$origin" rev-parse refs/heads/gate/r4)" "0 $(cat "$dir/out")"
check "and nothing reaches the other URLs" "$(git -C "$second" for-each-ref | wc -l)" 0
git -C "$origin" update-ref -d refs/heads/gate/r4
cp "$dir/config" "$r/.git/config"
printf 'other\n' > "$r/b.txt"; g commit -qam 'another candidate'
other=$(g rev-parse HEAD)
refuse 'an existing gate/<label> at another commit' 1 '^gate-push: push of gate/retro-w1b-r1 failed' "$other" "$base" retro-w1b-r1

# GitHub refuses a file of 100 MB or more; so does the push, naming it.
mkdir -p "$r/data"
truncate -s 100000000 "$r/data/big.json"
truncate -s 99999999 "$r/data/under.json"
g add data; g commit -qm big
large=$(g rev-parse HEAD)
refuse 'a 100 MB file' 1 '^gate-push: data/big.json is 100000000 bytes' "$large" "$base" r3
check "and names only the file at the limit" "$(grep -c under.json "$dir/err")" 0
g rm -q data/big.json; g commit -qm 'under the limit'
push "$(g rev-parse HEAD)" "$base" r3; status=$?
check "a file just under 100 MB is pushed" "$status $(refs)" "0 refs/heads/gate/r3 refs/heads/gate/retro-w1b-r1"
exit $fail
