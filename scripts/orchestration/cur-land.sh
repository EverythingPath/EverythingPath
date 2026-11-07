#!/usr/bin/env bash
# usage: cur-land.sh <branch> <worktree> <logname>
# Final gate for a reviewed and rebased branch: codegen, the pin, the full
# suite via triage (in a clean checkout of the exact commit, under
# heavy.lock), then the E2E preflight with one retry. It stops on any
# failure, and only then calls land.sh with that exact commit.
# Each attempt writes $EP_ORCH/logs/<logname>-<YYYYmmdd-HHMMSS>-<stage>.log.
# Normally run by land-queue.sh, which holds land.lock; run directly, it
# takes land.lock itself. Sibling scripts are run from this script's own
# directory, so a queue snapshot runs only snapshot copies.
# Remote heavy checks (docs/agents/orchestration/operations.md): with
# LAND_REMOTE_CHECKS=<manifest>, LAND_REMOTE_CHECKS_SHA256 and
# LAND_REMOTE_CHECKS_MODE=replace|compare, remote_checks.py verifies the Boat
# manifest for this exact tree and base after the pin (record in
# LAND_REMOTE_EVIDENCE). replace skips typecheck, lint and the suite and runs
# host-audits.sh instead: exactly the tests the candidate's host-audits.json
# lists (they may skip remotely for want of this host's sources), all passed;
# compare runs typecheck, lint and the suite too and requires an equal
# comparison outside that list with every listed test passed locally. Any
# refusal stops before preflight; there is no fallback. Pairs are refused.
# Light landing lane (docs/agents/orchestration/operations.md): with
# LAND_LANE=light, light_lane.py re-proves light-lane-v1 for this exact commit on
# the base after the artifacts stage (record in LAND_LIGHT_EVIDENCE) and runs its
# light checks; codegen, the pin, typecheck, lint, the suite and the preflight are
# skipped. A refusal or failed light check stops; it never falls through to the
# full stages. Remote checks and pairs are refused.
set -uo pipefail
br=${1:?branch}; wt=${2:?worktree}; name=${3:?log name}
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
wt=$(cd "$wt" && pwd) || { echo "no such worktree: $2"; exit 1; }
cd "$orch" || exit 1
stamp=$(date +%Y%m%d-%H%M%S)
log() { printf '%s\n' "logs/$name-$stamp-$1.log"; }
echo "logs: logs/$name-$stamp-*.log"

run_tmp= own_lock=0
trap '[[ $own_lock == 1 ]] && : > "$orch/land.lock"; [[ -n $run_tmp ]] && rm -rf "$run_tmp"' EXIT
if [[ ${LAND_LOCK_HELD:-} != 1 ]]; then
  exec 8>>"$orch/land.lock"
  flock -n 8 || { echo "waiting for land.lock (held by: $(head -1 "$orch/land.lock" | grep . || echo unknown))"; flock 8; }
  echo "cur-land.sh $br (pid $$, since $stamp)" > "$orch/land.lock"
  own_lock=1
fi
run_tmp "cur-land-$name" || exit 1

artifact_base=${LAND_EXPECTED_BASE:-$(git -C "$main" rev-parse HEAD)}
sha=$(git -C "$wt" rev-parse HEAD) || exit 1
[[ -z ${LAND_EXPECTED_TIP:-} || $sha == "$LAND_EXPECTED_TIP" ]] || { echo "staged tip moved before gate"; exit 1; }
lane=${LAND_LANE:-}
[[ -z $lane || $lane == light ]] || { echo "unknown lane '$lane'; not landing"; exit 1; }
if [[ $lane == light ]]; then
  [[ -z ${LAND_REMOTE_CHECKS:-} ]] || { echo "light lane does not combine with remote checks; not landing"; exit 1; }
  [[ -z ${LAND_PAIR_MANIFEST:-} ]] || { echo "light lane does not apply to pairs; not landing"; exit 1; }
  light_evidence=${LAND_LIGHT_EVIDENCE:-$orch/logs/$name-$stamp-light-evidence}
fi
remote_mode=
if [[ -n ${LAND_REMOTE_CHECKS:-} ]]; then
  remote_mode=${LAND_REMOTE_CHECKS_MODE:-}
  remote_evidence=${LAND_REMOTE_EVIDENCE:-$orch/logs/$name-$stamp-remote-evidence}
  [[ -z ${LAND_PAIR_MANIFEST:-} ]] || { echo "remote checks do not apply to pairs; not landing"; exit 1; }
  [[ $remote_mode == replace || $remote_mode == compare ]] || { echo "unknown remote checks mode '$remote_mode'; not landing"; exit 1; }
  [[ $remote_mode == replace || -n ${TRIAGE_EVIDENCE:-} ]] || { echo "compare mode needs TRIAGE_EVIDENCE; not landing"; exit 1; }
fi
check_identity() {
  [[ $(git -C "$wt" rev-parse "$br") == "$sha" && $(git -C "$wt" rev-parse HEAD) == "$sha" \
    && $(git -C "$wt" symbolic-ref --short -q HEAD) == "$br" \
    && $(git -C "$main" rev-parse HEAD) == "$artifact_base" \
    && -z $(git -C "$wt" status --porcelain) ]] && return 0
  echo "$br, $wt or the integration base moved during the gate; not landing"
  return 1
}
check_identity || exit 1
(cd "$wt" && pnpm -s check:artifacts --base "$artifact_base") > "$(log artifacts)" 2>&1 8>&- || { echo "artifact budget failed (see $(log artifacts))"; exit 1; }
check_identity || exit 1

if [[ $lane == light ]]; then
  python3 -B "$here/light_lane.py" verify "$wt" "$artifact_base" "$sha" "$light_evidence" > "$(log light)" 2>&1 8>&-
  r=$?
  grep -E '^light ' "$(log light)"
  [[ $r == 0 ]] || { echo "light lane refused (see $(log light)); not landing"; exit 1; }
  check_identity || exit 1
fi
if [[ $lane != light ]]; then
  "$here/codegen.sh" "$wt" > "$(log codegen)" 2>&1 8>&- || { echo "codegen failed (see $(log codegen))"; exit 1; }
  if [[ -n $(git -C "$wt" status --porcelain) ]]; then
    echo "codegen left changes; commit them first"
    git -C "$wt" status --short
    exit 1
  fi
  check_identity || exit 1
  echo "gating $br at $sha"
  (cd "$wt" && pnpm catalog:pin) > "$(log pin)" 2>&1 8>&- || { echo "catalog:pin failed (see $(log pin))"; exit 1; }
  if [[ -n $remote_mode ]]; then
    python3 -B "$here/remote_checks.py" verify "$LAND_REMOTE_CHECKS" "${LAND_REMOTE_CHECKS_SHA256:-}" "$wt" "$artifact_base" "$remote_evidence" > "$(log remote)" 2>&1 8>&-
    r=$?
    grep -E '^remote ' "$(log remote)"
    [[ $r == 0 ]] || { echo "remote checks refused (see $(log remote)); not landing"; exit 1; }
    check_identity || exit 1
  fi
  if [[ $remote_mode == replace ]]; then
    "$here/host-audits.sh" "$wt" "$LAND_REMOTE_CHECKS" "${LAND_REMOTE_CHECKS_SHA256:-}" "$remote_evidence" > "$(log host-audits)" 2>&1 8>&-
    r=$?
    grep -E '^host-audits ' "$(log host-audits)"
    [[ $r == 0 ]] || { echo "host audits failed (see $(log host-audits)); not landing"; exit 1; }
    check_identity || exit 1
  fi
  if [[ $remote_mode != replace ]]; then
    (cd "$wt" && pnpm -s typecheck) > "$(log typecheck)" 2>&1 8>&- || { echo "typecheck failed (see $(log typecheck))"; exit 1; }
    (cd "$wt" && pnpm -s lint) > "$(log lint)" 2>&1 8>&- || { echo "lint failed (see $(log lint))"; exit 1; }

    TRIAGE_LOG="$orch/$(log vitest)" "$here/triage-failures.sh" "$wt" > "$(log full)" 2>&1 8>&-
    t=$?
    grep -E '^(LOAD|REAL|REGRESSION|NEW|waiting|clean checkout|all green)' "$(log full)"
    [[ $t == 0 ]] || { echo "triage failed ($t) (see $(log full), $(log vitest))"; exit 1; }
    [[ $(grep -Fxc 'all green' "$(log full)") == 1 ]] && ! grep -qE '^[[:space:]]*(LOAD|NEW|REAL|REGRESSION)([[:space:]]|$)' "$(log full)" \
      || { echo "gate requires exact all green from the original suite; see $(log full)"; exit 1; }
  fi
  if [[ $remote_mode == compare ]]; then
    python3 -B "$here/remote_checks.py" compare "$LAND_REMOTE_CHECKS" "${LAND_REMOTE_CHECKS_SHA256:-}" "$TRIAGE_EVIDENCE/full.json" \
      "$wt/scripts/orchestration/host-audits.json" "$remote_evidence" > "$(log remote-compare)" 2>&1 8>&-
    r=$?
    grep -E '^remote ' "$(log remote-compare)"
    [[ $r == 0 ]] || { echo "remote comparison refused (see $(log remote-compare)); not landing"; exit 1; }
  fi

  "$here/e2e-branch.sh" "$wt" --preflight --backend local > "$(log e2e)" 2>&1 8>&- \
    || "$here/e2e-branch.sh" "$wt" --preflight --backend local > "$(log e2e-retry)" 2>&1 8>&- \
    || { echo "e2e preflight failed twice (see $(log e2e), $(log e2e-retry))"; exit 1; }
fi

check_identity || exit 1
if [[ -n ${LAND_PAIR_MANIFEST:-} ]]; then
  node "$here/pair-queue.mjs" --guard "$LAND_PAIR_MANIFEST" "$LAND_PAIR_PLAN_HASH" 8>&- || exit 1
fi
"$here/land.sh" "$sha" "$wt" > "$(log land)" 2>&1 8>&- || { echo "land failed (see $(log land))"; tail -3 "$(log land)"; exit 1; }
git -C "$main" log --oneline -1
