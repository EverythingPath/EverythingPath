#!/usr/bin/env bash
# usage: host-audits.sh <worktree> <manifest> <manifest-sha256> <evidence-dir>
#        host-audits.sh --receipt <commit> <base> <receipt-dir>
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
# --receipt (speed-host-audits-parallel; owner 2026-11-07, item 3): the same selection and run for
# <commit> (a full SHA in the main checkout, root's pushed gate/<label> commit) while CI runs, before
# any manifest exists. <receipt-dir> is $EP_ORCH/host-audits-receipts/<id>, created here and refused
# when it exists; it gets the list, the report and receipt.json (remote_checks.py receipt: the
# commit, its tree, <base>, the list and report sha256, the lockfile, toolchain, sources, verdict and
# run times), then every file and the directory are made read-only. The toolchain and sources are
# captured before the checkout, install and test run (remote_checks.py receipt-inputs) and compared
# after it: a change in between refuses the receipt, and a source holding a symlink (links are not
# followed) is refused before anything runs. A replace gate given the receipt
# verifies it (remote_checks.py verify-receipt) instead of running the audits. It prints
# `host-audits receipt: <path> <sha256>` and exits 0 only when the verdict passed.
set -uo pipefail
usage='usage: host-audits.sh <worktree> <manifest> <manifest-sha256> <evidence-dir> | --receipt <commit> <base> <receipt-dir>'
here=$(cd "$(dirname "$0")" && pwd)
receipt=
if [[ ${1:-} == --receipt ]]; then
  receipt=1; commit=${2:?$usage}; base=${3:?$usage}; evidence=${4:?$usage}
  . "$here/paths.sh"
  full='^[0-9a-f]{40}$'
  [[ $commit =~ $full && $base =~ $full ]] || { echo "host-audits: commit and base must be full SHAs"; exit 1; }
  [[ $(git -C "$main" rev-parse --verify -q "$commit^{commit}") == "$commit" ]] || { echo "host-audits: no commit $commit in $main"; exit 1; }
  [[ $(git -C "$main" rev-parse --verify -q "$base^{commit}") == "$base" ]] || { echo "host-audits: no base $base in $main"; exit 1; }
  [[ $evidence == "$orch/host-audits-receipts/"* && $(basename "$evidence") =~ ^[a-z0-9][a-z0-9-]*$ \
    && $(dirname "$evidence") == "$orch/host-audits-receipts" ]] \
    || { echo "host-audits: the receipt directory must be $orch/host-audits-receipts/<id> ([a-z0-9-]): $evidence"; exit 1; }
  mkdir -p "$orch/host-audits-receipts" && mkdir "$evidence" 2>/dev/null \
    || { echo "host-audits: the receipt directory exists or cannot be created (create-only): $evidence"; exit 1; }
  repo=$main sha=$commit name=receipt-$(basename "$evidence")
  started=$(date +%s)
else
  wt=$(cd "${1:?$usage}" && pwd) || exit 1
  manifest=${2:?$usage}; manifest_sha=${3:?$usage}; evidence=${4:?$usage}
  . "$here/paths.sh"
  [[ $evidence == /* && -d $evidence ]] || { echo "host-audits: evidence directory must exist and be absolute: $evidence"; exit 1; }
  sha=$(git -C "$wt" rev-parse --verify -q 'HEAD^{commit}') || { echo "host-audits: no commit at $wt"; exit 1; }
  repo=$wt name=$(basename "$wt")
fi
stamp=$(date +%Y%m%d-%H%M%S)
gate= tmp=
cleanup() {
  trap - EXIT INT TERM
  [[ -n $tmp ]] && rm -rf "$tmp"
  if [[ -n $gate && -e $gate ]]; then
    git -C "$repo" worktree remove --force "$gate" >/dev/null 2>&1 || rm -rf "$gate"
    git -C "$repo" worktree prune
    [[ -e $gate ]] && echo "!!!! clean checkout $gate could not be removed; remove it by hand" >&2
  fi
}
trap cleanup EXIT; trap 'exit 130' INT; trap 'exit 143' TERM
# Named by a hash of the worktree or receipt name, as e2e-branch.sh does for the
# branch: tsx listens on $TMPDIR/tsx-<uid>/<pid>.pipe, a Unix socket path holds
# at most 107 bytes, and a long name would overrun it. The checkout keeps the name.
run_tmp "host-audits-$(printf '%s' "$name" | sha256sum | cut -c1-8)" || exit 1
tmp=$run_tmp
if [[ -n $receipt ]]; then  # The run's inputs, before anything runs; the receipt refuses the run if they differ after it.
  python3 -B "$here/remote_checks.py" receipt-inputs "$evidence" "$main" "$commit" "$tmp/receipt-inputs.json" \
    || { echo "host-audits: could not capture the run's inputs"; exit 1; }
fi
gate=$(mktemp -d "$repos/ep-gate-audits-$name-$stamp-XXXXXX") || { echo "host-audits: could not reserve a clean checkout directory"; exit 1; }
record_scratch_worktree "$gate" || exit 1
git -C "$repo" worktree add -q --detach "$gate" "$sha" || { echo "host-audits: could not create clean checkout $gate"; exit 1; }
list=$evidence/host-audits-list.json  # The candidate's list, kept beyond the checkout for collection.
cp "$gate/scripts/orchestration/host-audits.json" "$list" || { echo "host-audits: the candidate has no host-audit list"; exit 1; }
mapfile -d '' -t selection < <(python3 -B "$here/remote_checks.py" selection "$list")
(( ${#selection[@]} > 1 )) || { echo "host-audits: no selection from $list"; exit 1; }
(cd "$gate" && pnpm install --offline) > "$tmp/install.log" 2>&1 \
  || { cat "$tmp/install.log"; echo "host-audits: pnpm install --offline failed in $gate"; exit 1; }
echo "host-audits: clean checkout $gate at $sha, ${#selection[@]} arguments"

exec 9>>"$orch/heavy.lock"
flock -n 9 || { echo "host-audits: waiting for heavy.lock"; gate_wait heavy.lock flock 9; }
report=$evidence/host-audits-report.json
(cd "$gate" && pnpm test "${selection[@]:1}" "${selection[0]}" --reporter=default --reporter=json --outputFile.json="$report") 9>&-
status=$?
if [[ -z $receipt ]]; then
  python3 -B "$here/remote_checks.py" audit "$manifest" "$manifest_sha" "$list" "$report" "$gate" "$status" "$evidence" 9>&-
  exit
fi
python3 -B "$here/remote_checks.py" receipt "$evidence" "$main" "$commit" "$base" "$gate" "$status" "$started" "$tmp/receipt-inputs.json" 9>&-
passed=$?
[[ -f $evidence/receipt.json ]] || { echo "host-audits: no receipt written in $evidence"; exit 1; }
chmod a-w "$evidence"/* && chmod a-w "$evidence" || { echo "host-audits: could not make $evidence read-only"; exit 1; }
echo "host-audits receipt: $evidence/receipt.json $(sha256sum < "$evidence/receipt.json" | cut -d' ' -f1)"
exit $passed
