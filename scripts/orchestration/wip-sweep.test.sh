#!/usr/bin/env bash
# usage: wip-sweep.test.sh — checks wip-sweep.sh (speed-wip-ci §4, W4) against a local bare origin holding a fake ref
# list with ages: wip/<task>-<stamp> branches older and younger than 6 h, at and just past the limit, a future stamp,
# wip/ names with no wip-ci stamp, and refs outside refs/heads/wip/ whose names carry old stamps too. Threat model:
# accidents by cooperative agents, with the owner's must-catch list (2026-11-07): a WIP branch older than 6 h left
# behind is deleted (as KILL leaves wip-ci.sh's), and no ref outside refs/heads/wip/ is ever touched. --dry-run
# deletes nothing. The clock is fixed with WIP_SWEEP_NOW; nothing here touches the network or GitHub.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=$(mktemp -d "${TMPDIR:?TMPDIR}/wip-sweep-test-XXXXXX") || exit 1
trap 'rm -rf "$dir"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=Fixture GIT_AUTHOR_EMAIL=fixture@example.test GIT_COMMITTER_NAME=Fixture GIT_COMMITTER_EMAIL=fixture@example.test
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
[[ -r $here/wip-sweep.sh ]] || { echo "FAIL  wip-sweep.sh exists: no $here/wip-sweep.sh"; exit 1; }

r=$dir/repo origin=$dir/origin.git
o() { git -C "$origin" "$@"; }
git init -q --bare "$origin"
git init -q -b main "$r"
git -C "$r" remote add origin "$origin"
printf 'a\n' > "$r/a.txt"; git -C "$r" add a.txt; git -C "$r" commit -qm one
printf 'b\n' > "$r/a.txt"; git -C "$r" commit -qam two
o fetch -q "$r" main:refs/heads/main
one=$(git -C "$r" rev-parse HEAD~1) two=$(git -C "$r" rev-parse HEAD)

now=$(date -u -d '2026-11-07 12:00:00' +%s)
stamp() { date -u -d "@$((now - $1))" +%Y%m%d-%H%M%S; }
old=$(stamp $((7 * 3600)))
# The fake ref list. Deleted: wip/<task>-<stamp> more than 6 h old.
doomed=(
  "refs/heads/wip/old-task-$old"
  "refs/heads/wip/fixture-task-$(stamp $((6 * 3600 + 1)))"
  "refs/heads/wip/a-$(stamp $((30 * 24 * 3600)))"
)
# Kept: in wip/ but 6 h old or less, in the future, or with no wip-ci stamp (its age is unknown).
kept=(
  "refs/heads/wip/fresh-task-$(stamp 3600)"
  "refs/heads/wip/edge-task-$(stamp $((6 * 3600)))"
  "refs/heads/wip/future-task-$(stamp -3600)"
  refs/heads/wip/no-stamp
  "refs/heads/wip/Upper-$old"
  "refs/heads/wip/nested/task-$old"
  refs/heads/wip/bad-date-20261399-000000
)
# Outside refs/heads/wip/, each with an old stamp: never touched, whatever its name looks like.
outside=(
  refs/heads/main
  "refs/heads/gate/w1-$old"
  "refs/heads/feature/wip/task-$old"
  "refs/heads/wipe/task-$old"
  "refs/heads/wip-task-$old"
  "refs/heads/x/refs/heads/wip/task-$old"
  "refs/tags/wip/task-$old"
  "refs/wip/task-$old"
  "refs/notes/wip/task-$old"
)
for ref in "${doomed[@]}" "${kept[@]}" "${outside[@]:1}"; do o update-ref "$ref" "$one"; done
all() { o for-each-ref --format='%(refname) %(objectname)' | sort; }
# without_doomed: the snapshot on stdin less the doomed refs, the expected refs after a sweep.
without_doomed() { grep -vxF -f <(printf '%s '"$one"'\n' "${doomed[@]}"); }
full=$(all)
check "the fixture holds every listed ref" "$(wc -l <<< "$full")" $((${#doomed[@]} + ${#kept[@]} + ${#outside[@]}))

sweep() { (cd "$r" && WIP_SWEEP_NOW=$now bash "$here/wip-sweep.sh" "$@") > "$dir/out" 2> "$dir/err"; status=$?; }
names() { sed -n "s/^wip-sweep: $1 \([^ ]*\).*/refs\/heads\/\1/p" "$dir/out" | sort | paste -sd ' '; }
sorted() { printf '%s\n' "$@" | sort | paste -sd ' '; }

# --dry-run names exactly the old wip/<task>-<stamp> branches and deletes nothing.
sweep --dry-run
check "a dry run exits 0" "$status" 0
check "a dry run would delete exactly the branches over 6 h" "$(names 'would delete')" "$(sorted "${doomed[@]}")"
check "a dry run deletes nothing" "$(all)" "$full"

# The sweep deletes exactly those; every other ref, inside wip/ or outside it, stays at its commit.
sweep
check "the sweep exits 0" "$status" 0
check "it deletes exactly the branches over 6 h" "$(names deleted)" "$(sorted "${doomed[@]}")"
check "every other ref stays where it was" "$(all)" "$(without_doomed <<< "$full")"
# The oracle is the pre-sweep snapshot: it fails if any ref but the doomed ones went (Std r1 #2's probe deleted main).
check "the oracle would catch an unrelated deletion" \
  "$([[ $(all | grep -v '^refs/heads/main ') == "$(without_doomed <<< "$full")" ]] && echo missed || echo caught)" caught
check "the oracle keeps every ref outside the doomed ones" "$(without_doomed <<< "$full" | wc -l)" $((${#kept[@]} + ${#outside[@]}))
for ref in "${outside[@]}"; do
  check "it never names $ref" "$(grep -cF -- "${ref#refs/heads/}" "$dir/out" "$dir/err" | awk -F: '{ n += $NF } END { print n }')" 0
done
check "it reports the wip/ names it cannot age" "$(names left)" \
  "$(sorted refs/heads/wip/no-stamp "refs/heads/wip/Upper-$old" "refs/heads/wip/nested/task-$old" refs/heads/wip/bad-date-20261399-000000)"
after=$(all)
sweep
check "a second sweep finds nothing more" "$status $(names deleted) $(all | sha256sum)" "0  $(sha256sum <<< "$after")"

# A deletion origin refuses fails the sweep (exit 1) and names the branch; the other old branches are still deleted.
for ref in "${doomed[@]:0:2}"; do o update-ref "$ref" "$two"; done
o config receive.denyDeletes true
sweep
check "a refused deletion exits 1" "$status" 1
check "and names each branch it could not delete" "$(grep -c 'deleting wip/.* failed' "$dir/err")" 2
check "and leaves them at origin" "$(o for-each-ref --format='%(refname)' refs/heads/wip | grep -cE '/(old|fixture)-task-')" 2
o config --unset receive.denyDeletes
sweep
check "once origin allows it, the next sweep deletes them" "$status $(names deleted)" "0 $(sorted "${doomed[@]:0:2}")"
check "and still nothing else" "$(all)" "$after"

# Refusals before any deletion: usage, a malformed clock, a set GIT_CONFIG.
for args in --force '--dry-run extra' refs/heads/main; do
  # shellcheck disable=SC2086
  sweep $args
  check "usage: '$args' exits 64" "$status $(all | sha256sum)" "64 $(sha256sum <<< "$after")"
done
(cd "$r" && WIP_SWEEP_NOW=soon bash "$here/wip-sweep.sh") > /dev/null 2>&1
check "a malformed WIP_SWEEP_NOW exits 64" "$?" 64
o update-ref "${doomed[0]}" "$one"
(cd "$r" && GIT_CONFIG=$r/.git/config WIP_SWEEP_NOW=$now bash "$here/wip-sweep.sh") > /dev/null 2> "$dir/err"
check "a set GIT_CONFIG is refused before any deletion" "$? $(grep -c 'GIT_CONFIG is set' "$dir/err") $(o for-each-ref "${doomed[0]}" | wc -l)" "1 1 1"

# The one push path: the sweep deletes only through push-lib.sh in wip mode (refs/heads/wip/<name>, only at the
# listed commit), with no push command of its own.
check "wip-sweep.sh sources push-lib.sh" "$(grep -cE '^\. "\$here/push-lib\.sh"$' "$here/wip-sweep.sh")" 1
check "wip-sweep.sh initialises the library in wip mode" "$(grep -cE '^push_lib_init wip-sweep wip$' "$here/wip-sweep.sh")" 1
check "wip-sweep.sh has no push command of its own" \
  "$(grep -vE '^[[:space:]]*#' "$here/wip-sweep.sh" | grep -cE '(^|[^[:alnum:]_-])git[[:space:]].*[[:space:]]push( |$)')" 0
exit $fail
