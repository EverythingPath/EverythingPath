#!/usr/bin/env bash
# usage: wip-sweep.sh [--dry-run]
# The wip-sweep workflow's one step (speed-wip-ci §4, W4; .github/workflows/wip-sweep.yaml, hourly): deletes each
# refs/heads/wip/<task>-<stamp> branch at origin whose stamp is more than 6 h old. wip-ci.sh names its branch so, with
# the push's UTC time, and deletes it on every exit it can handle; this removes what is left: a branch after a KILL,
# or after a deletion that failed (wip-ci.sh's exit 3).
# - It reads only origin's refs/heads/wip/ (git ls-remote through push-lib.sh's checked origin URL). No other ref is
#   ever deleted, whatever its name.
# - Each deletion goes through push-lib.sh in wip mode (push_delete_ref): only refs/heads/wip/<name> with <name> in
#   [a-z0-9-]+, and only while origin still holds the listed commit there.
# - A wip/ branch whose name carries no wip-ci stamp (<task>-YYYYmmdd-HHMMSS) has no known age: it is left, and named.
# --dry-run prints what it would delete and deletes nothing. WIP_SWEEP_NOW (Unix seconds) fixes the clock for tests.
# Exit: 0 done, 1 a listing or a deletion failed (each other branch is still swept), 64 usage. Tests: wip-sweep.test.sh.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/push-lib.sh"
push_lib_init wip-sweep wip
push_require_no_git_config
usage() { echo "usage: wip-sweep.sh [--dry-run]${1:+ ($1)}" >&2; exit 64; }
dry=0
case $# in
  0) ;;
  1) [[ $1 == --dry-run ]] || usage; dry=1 ;;
  *) usage ;;
esac
now=${WIP_SWEEP_NOW:-$(date -u +%s)}
[[ $now =~ ^[0-9]{1,12}$ ]] || usage "WIP_SWEEP_NOW is Unix seconds"
max_age=$((6 * 3600))

push_origin_url
listing=$(git ls-remote --refs -- "$push_url" 'refs/heads/wip/*') || push_fail "could not list origin's wip/ branches"
failed=0
while IFS=$'\t' read -r sha ref; do
  # ls-remote matches its pattern against the end of a ref name, so only what starts with refs/heads/wip/ is read.
  [[ $ref == refs/heads/wip/* ]] || continue
  name=${ref#refs/heads/}
  born=
  if [[ $ref =~ ^refs/heads/wip/[a-z0-9-]+-([0-9]{8})-([0-9]{2})([0-9]{2})([0-9]{2})$ ]]; then
    born=$(date -u -d "${BASH_REMATCH[1]} ${BASH_REMATCH[2]}:${BASH_REMATCH[3]}:${BASH_REMATCH[4]}" +%s 2> /dev/null) || born=
  fi
  if [[ -z $born ]]; then
    echo "wip-sweep: left $(printf %q "$name") (no wip-ci stamp, so no known age)"
    continue
  fi
  age=$((now - born))
  if ((age <= max_age)); then
    echo "wip-sweep: kept $name ($((age / 60)) min old)"
  elif ((dry)); then
    echo "wip-sweep: would delete $name ($((age / 3600)) h old, at $sha)"
  elif (push_delete_ref "$sha" "$ref") < /dev/null; then
    echo "wip-sweep: deleted $name ($((age / 3600)) h old, at $sha)"
  else
    failed=1
  fi
done <<< "$listing"
exit "$failed"
