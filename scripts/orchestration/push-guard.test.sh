#!/usr/bin/env bash
# usage: push-guard.test.sh — checks the one push path, push-lib.sh, against a local bare "origin"
# in a scratch repository: in each mode (gate for gate-push.sh, wip for the later wip-ci.sh) it
# pushes only refs/heads/<mode>/<name> and refuses every other ref (main, feature/*, t3/*, tags,
# the other mode's prefix, refspec tricks) and every move of an existing ref (no force, no
# fast-forward over a ref it did not write), each refusal pushing nothing. gate-push.sh pushes
# through it in gate mode and has no push of its own. Never touches a real remote.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=$(mktemp -d "${TMPDIR:?TMPDIR}/push-guard-test-XXXXXX") || exit 1
trap 'rm -rf "$dir"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
r=$dir/repo
origin=$dir/origin.git
g() { git -C "$r" "$@"; }
o() { git -C "$origin" "$@"; }
git init -q --bare "$origin"
git init -q -b main "$r"
g config user.name Fixture; g config user.email fixture@example.test
g config push.followTags true
g remote add origin "$origin"
printf 'base\n' > "$r/a.txt"; g add a.txt; g commit -qm base
base=$(g rev-parse HEAD)
g tag -a -m 'a tag' v-fixture
printf 'next\n' > "$r/b.txt"; g add b.txt; g commit -qm next
tree=$(g rev-parse HEAD^{tree})
date=$(g show -s --format=%cI HEAD)
refs() { o for-each-ref --format='%(refname) %(objectname)' | paste -sd ' '; }

# lib <mode> <args...>: push-lib.sh in a fresh shell in the repository: init with <mode>, check
# origin, then push_ref <args...>. Exit status, stdout and stderr land in $dir/{out,err}.
lib() {
  local mode=$1; shift
  (cd "$r" && bash -c '. "$1"; shift; push_lib_init push-guard-test "$1"; shift; push_origin_url; push_ref "$@"' \
    _ "$here/push-lib.sh" "$mode" "$@") > "$dir/out" 2> "$dir/err"
}
# commit_of <message>: a parentless commit of the fixture tree through the library's construction.
commit_of() {
  (cd "$r" && printf '%s\n' "$1" | bash -c '. "$1"; push_lib_init push-guard-test gate; push_tree_commit "$2" "$3"' \
    _ "$here/push-lib.sh" "$tree" "$date")
}

[[ -r $here/push-lib.sh ]] || { echo "FAIL  push-lib.sh exists: no $here/push-lib.sh"; exit 1; }
gate_commit=$(commit_of 'gate: fixture'); status=$?
check "push_tree_commit exits 0" "$status" 0
check "and builds a parentless commit" "$(g cat-file commit "$gate_commit" | grep -c '^parent ')" 0
check "of the given tree" "$(g rev-parse "$gate_commit^{tree}")" "$tree"
check "dated as given" "$(g show -s --format='%aI %cI' "$gate_commit")" "$date $date"
check "the same inputs give the same commit" "$(commit_of 'gate: fixture')" "$gate_commit"
wip_commit=$(commit_of 'wip: fixture')

# Accepted: each mode's own prefix, and only that ref reaches origin.
lib gate "$gate_commit" refs/heads/gate/g1; status=$?
check "gate mode pushes refs/heads/gate/<name>" "$status $(refs)" "0 refs/heads/gate/g1 $gate_commit"
lib wip "$wip_commit" refs/heads/wip/w1-20261107; status=$?
check "wip mode pushes refs/heads/wip/<name>" "$status $(refs)" \
  "0 refs/heads/gate/g1 $gate_commit refs/heads/wip/w1-20261107 $wip_commit"
check "no tag reaches the origin" "$(o tag | wc -l)" 0
check "no history reaches the origin" "$(o cat-file -e "$base" 2> /dev/null && echo present || echo absent)" absent
lib wip "$wip_commit" refs/heads/wip/w1-20261107; status=$?
check "the same push again is a no-op" "$status $(o rev-parse refs/heads/wip/w1-20261107)" "0 $wip_commit"

# refuse <name> <stderr pattern> <mode> <args...>: exit 1 with the message, origin unchanged.
refuse() {
  local name=$1 pattern=$2; shift 2
  local before; before=$(refs)
  lib "$@"; local status=$?
  check "refuses $name" "$status $(grep -cE "$pattern" "$dir/err")" "1 1"
  check "and pushes nothing ($name)" "$(refs)" "$before"
}
outside='^push-guard-test: refused ref .*: only refs/heads/(gate|wip)/<name> \(\[a-z0-9-\]\+\)$'
# Every ref outside the mode's prefix, in both modes: protected branches, tags, the other mode,
# short names, an empty or nested or uppercase name, and refspec syntax smuggled into the ref.
for mode in gate wip; do
  other=$([[ $mode == gate ]] && echo wip || echo gate)
  for ref in refs/heads/main main refs/heads/feature/pf1-character-builder feature/x \
    refs/heads/t3/wip-ci-w1 t3/x refs/tags/v-fixture refs/tags/$mode/x "refs/heads/$other/x" \
    "$mode/x" "refs/heads/$mode/" "refs/heads/$mode/X" "refs/heads/$mode/a/b" "refs/heads/$mode/a.b" \
    "refs/heads/$mode/../main" "refs/remotes/origin/$mode/x" "refs/$mode/x" HEAD \
    "+refs/heads/$mode/x" "refs/heads/$mode/x:refs/heads/main" "refs/heads/$mode/x refs/heads/main" \
    "refs/heads/$mode/x"$'\n'"refs/heads/main" "refs/heads/$mode/*" "refs/heads/$mode/x^"; do
    printf -v shown %q "$ref"
    refuse "$mode mode: ref $shown" "$outside" "$mode" "$gate_commit" "$ref"
  done
done
# The commit: a full SHA of a parentless commit, never a refspec or an option.
refuse 'an abbreviated commit' '^push-guard-test: refused commit .*: not a full SHA$' gate "${gate_commit:0:12}" refs/heads/gate/g2
refuse 'a forced refspec in the commit' '^push-guard-test: refused commit .*: not a full SHA$' gate "+$gate_commit" refs/heads/gate/g2
refuse 'a refspec as the commit' '^push-guard-test: refused commit .*: not a full SHA$' gate "$gate_commit:refs/heads/main" refs/heads/gate/g2
refuse 'an unknown commit' '^push-guard-test: refused commit .*: not a parentless commit$' gate "$(printf 1%.0s {1..40})" refs/heads/gate/g2
refuse 'a commit with history' '^push-guard-test: refused commit .*: not a parentless commit$' gate "$(g rev-parse HEAD)" refs/heads/gate/g2
refuse 'a tree as the commit' '^push-guard-test: refused commit .*: not a parentless commit$' gate "$tree" refs/heads/gate/g2
# Arguments: exactly <commit> <ref>, so no option (--force, --mirror, --all, --tags, -f) gets in.
usage='^push-guard-test: push_ref takes <commit> <ref>$'
refuse '--force before the arguments' "$usage" gate --force "$gate_commit" refs/heads/gate/g2
refuse '-f after the arguments' "$usage" gate "$gate_commit" refs/heads/gate/g2 -f
refuse '--mirror alone' "$usage" gate --mirror
refuse '--all and --tags before the arguments' "$usage" gate --all --tags "$gate_commit" refs/heads/gate/g2
refuse 'no arguments' "$usage" gate
for flag in --force -f --mirror --all --tags --delete; do
  refuse "the option $flag as the commit" '^push-guard-test: refused commit .*: not a full SHA$' gate "$flag" refs/heads/gate/g2
  refuse "the option $flag as the ref" "$outside" gate "$gate_commit" "$flag"
done
# The mode: gate or wip, nothing else.
for mode in main feature t3 tags heads '' 'gate wip' Gate; do
  refuse "mode '$mode'" '^push-guard-test: mode must be gate or wip' "$mode" "$gate_commit" refs/heads/gate/g2
done
# Never a force push over a ref this push did not write: an existing ref at another commit stays,
# whoever wrote it, and a parentless commit can never fast-forward one. Another worker's wip ref
# and an existing gate ref at another commit are both refused by origin, unchanged.
moved='^push-guard-test: push of (gate|wip)/[a-z0-9-]+ failed \(an existing (gate|wip)/[a-z0-9-]+ at another commit, or origin unreachable\)$'
refuse 'a gate ref over an existing gate ref at another commit' "$moved" gate "$wip_commit" refs/heads/gate/g1
refuse "a wip ref over another worker's wip ref" "$moved" wip "$gate_commit" refs/heads/wip/w1-20261107
# Even with origin allowing any update (receive.denyNonFastForwards false is the default) and a
# local force configuration, the push sends no '+': push.default, remote.origin.push and a
# configured forced refspec do not apply to an explicit refspec.
g config remote.origin.push '+refs/heads/*:refs/heads/*'
g config push.default matching
refuse 'a configured forced refspec over an existing ref' "$moved" wip "$gate_commit" refs/heads/wip/w1-20261107
check "and main is not pushed by the configured refspec" "$(o for-each-ref refs/heads/main | wc -l)" 0
g config --unset remote.origin.push; g config --unset push.default
# Replacement refs (refs/replace/*, git-replace(1)) change what a plain object read shows, not what
# is pushed; the checks read the real objects. A parentless commit made to look parented is pushed,
# by the library and by gate-push.sh; a parented commit made to look parentless is refused.
reviewed=$(g rev-parse HEAD)
g replace "$gate_commit" "$reviewed"
check "the replacement shows a parent to a plain read" "$(g cat-file commit "$gate_commit" | grep -c '^parent ')" 1
lib gate "$gate_commit" refs/heads/gate/g5; status=$?
check "a parentless commit replaced by a parented one is pushed" "$status $(o rev-parse refs/heads/gate/g5)" "0 $gate_commit"
check "and origin holds it parentless" "$(o cat-file commit "$gate_commit" | grep -c '^parent ')" 0
g replace -d "$gate_commit" > /dev/null
(cd "$r" && bash "$here/gate-push.sh" "$reviewed" "$base" g6) > "$dir/out" 2> "$dir/err"; status=$?
check "gate-push.sh pushes its commit" "$status" 0
gate_push_commit=$(cat "$dir/out")
o update-ref -d refs/heads/gate/g6
g replace "$gate_push_commit" "$reviewed"
(cd "$r" && bash "$here/gate-push.sh" "$reviewed" "$base" g6) > "$dir/out" 2> "$dir/err"; status=$?
check "gate-push.sh pushes the same commit while a replacement makes it look parented" \
  "$status $(cat "$dir/out") $(o rev-parse refs/heads/gate/g6)" "0 $gate_push_commit $gate_push_commit"
g replace -d "$gate_push_commit" > /dev/null
o update-ref -d refs/heads/gate/g6
g replace "$reviewed" "$wip_commit"
check "the replacement hides the parent from a plain read" "$(g cat-file commit "$reviewed" | grep -c '^parent ')" 0
refuse 'a parented commit replaced by a parentless one' '^push-guard-test: refused commit [0-9a-f]{40}: not a parentless commit$' \
  wip "$reviewed" refs/heads/wip/w9
check "and origin never receives it" "$(o cat-file -e "$reviewed" 2> /dev/null && echo present || echo absent)" absent
g replace -d "$reviewed" > /dev/null
check "no replacement ref is left" "$(g for-each-ref refs/replace | wc -l)" 0
# Before push_origin_url there is no checked URL, so push_ref refuses rather than push anywhere.
(cd "$r" && bash -c '. "$1"; push_lib_init push-guard-test gate; push_ref "$2" refs/heads/gate/g3' _ "$here/push-lib.sh" "$gate_commit") \
  > "$dir/out" 2> "$dir/err"; status=$?
check "push_ref without a checked origin URL is refused" "$status $(grep -c '^push-guard-test: no checked origin URL' "$dir/err")" "1 1"
check "and pushes nothing (no checked URL)" "$(o for-each-ref refs/heads/gate/g3 | wc -l)" 0

# gate-push.sh pushes only through the library, in gate mode: it has no `git push` of its own, and
# a label that would leave gate/ is a usage error before anything is read.
check "gate-push.sh sources push-lib.sh" "$(grep -cE '^\. "\$here/push-lib\.sh"$' "$here/gate-push.sh")" 1
check "gate-push.sh initialises the library in gate mode" "$(grep -cE '^push_lib_init gate-push gate$' "$here/gate-push.sh")" 1
check "gate-push.sh has no git push command" "$(grep -vE '^[[:space:]]*#' "$here/gate-push.sh" | grep -cE '(^|[^[:alnum:]_-])push( |$)' )" 0
check "push-lib.sh has exactly one git push" "$(grep -vE '^[[:space:]]*#' "$here/push-lib.sh" | grep -cE '^[[:space:]]*git push ')" 1
(cd "$r" && bash "$here/gate-push.sh" "$reviewed" "$base" main) > "$dir/out" 2> "$dir/err"; status=$?
check "gate-push.sh label 'main' is pushed as gate/main" "$status $(o rev-parse refs/heads/gate/main)" "0 $(cat "$dir/out")"
check "and refs/heads/main stays absent" "$(o for-each-ref refs/heads/main | wc -l)" 0
o update-ref -d refs/heads/gate/main
for label in ../main 'x:refs/heads/main' '+x' 'x refs/heads/main' 'feature/x' 'refs/tags/x' 't3/x' 'wip/x'; do
  before=$(refs)
  (cd "$r" && bash "$here/gate-push.sh" "$reviewed" "$base" "$label") > "$dir/out" 2> "$dir/err"; status=$?
  check "gate-push.sh refuses label '$label'" "$status $(grep -c '^usage: gate-push.sh' "$dir/err")" "64 1"
  check "and pushes nothing (label '$label')" "$(refs)" "$before"
done
exit $fail
