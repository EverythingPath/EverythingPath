#!/usr/bin/env bash
# usage: host-audits.sh <worktree> <manifest> <manifest-sha256> <evidence-dir>
# The gate host's half of remote heavy checks in replace mode (gate-modes, "Remote heavy checks";
# owner 2026-11-02): the tests in the candidate's host-audits.json skip in CI for want of the
# sources only this host has, so they run here, exactly those tests, for the commit at
# <worktree>'s HEAD. Like triage-failures.sh's full suite: a fresh detached ep-gate-* checkout
# beside the main checkout (committed files plus `pnpm install --offline`, removed on exit),
# under $EP_ORCH/heavy.lock, with `pnpm test` and the JSON reporter. Like the rest of a replace
# gate it runs without the light lane's read lock, which only triage-failures.sh takes.
# The selection (remote_checks.py selection) is the listed files and one pattern anchored on the
# listed full names, so a listed file's other tests are filtered out. remote_checks.py audit then
# requires every listed test passed, nothing else ran, the list is the one the manifest binds and
# Vitest exited 0. <evidence-dir> (existing, absolute) gets host-audits-list.json (the
# candidate's list), host-audits-report.json and host-audits.json, the verdict. Exits 0 only
# when that verdict passed.
set -uo pipefail
usage='usage: host-audits.sh <worktree> <manifest> <manifest-sha256> <evidence-dir>'
wt=$(cd "${1:?$usage}" && pwd) || exit 1
manifest=${2:?$usage}; manifest_sha=${3:?$usage}; evidence=${4:?$usage}
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
[[ $evidence == /* && -d $evidence ]] || { echo "host-audits: evidence directory must exist and be absolute: $evidence"; exit 1; }
sha=$(git -C "$wt" rev-parse --verify -q 'HEAD^{commit}') || { echo "host-audits: no commit at $wt"; exit 1; }
stamp=$(date +%Y%m%d-%H%M%S)
gate= tmp=
cleanup() {
  trap - EXIT INT TERM
  [[ -n $tmp ]] && rm -rf "$tmp"
  if [[ -n $gate && -e $gate ]]; then
    git -C "$wt" worktree remove --force "$gate" >/dev/null 2>&1 || rm -rf "$gate"
    git -C "$wt" worktree prune
    [[ -e $gate ]] && echo "!!!! clean checkout $gate could not be removed; remove it by hand" >&2
  fi
}
trap cleanup EXIT; trap 'exit 130' INT; trap 'exit 143' TERM
run_tmp "host-audits-$(basename "$wt")" || exit 1
tmp=$run_tmp
gate=$(mktemp -d "$repos/ep-gate-audits-$(basename "$wt")-$stamp-XXXXXX") || { echo "host-audits: could not reserve a clean checkout directory"; exit 1; }
record_scratch_worktree "$gate" || exit 1
git -C "$wt" worktree add -q --detach "$gate" "$sha" || { echo "host-audits: could not create clean checkout $gate"; exit 1; }
list=$evidence/host-audits-list.json  # The candidate's list, kept beyond the checkout for collection.
cp "$gate/scripts/orchestration/host-audits.json" "$list" || { echo "host-audits: the candidate has no host-audit list"; exit 1; }
mapfile -d '' -t selection < <(python3 -B "$here/remote_checks.py" selection "$list")
(( ${#selection[@]} > 1 )) || { echo "host-audits: no selection from $list"; exit 1; }
(cd "$gate" && pnpm install --offline) > "$tmp/install.log" 2>&1 \
  || { cat "$tmp/install.log"; echo "host-audits: pnpm install --offline failed in $gate"; exit 1; }
echo "host-audits: clean checkout $gate at $sha, ${#selection[@]} arguments"

exec 9>>"$orch/heavy.lock"
flock -n 9 || { echo "host-audits: waiting for heavy.lock"; flock 9; }
report=$evidence/host-audits-report.json
(cd "$gate" && pnpm test "${selection[@]:1}" "${selection[0]}" --reporter=default --reporter=json --outputFile.json="$report") 9>&-
status=$?
python3 -B "$here/remote_checks.py" audit "$manifest" "$manifest_sha" "$list" "$report" "$gate" "$status" "$evidence" 9>&-
