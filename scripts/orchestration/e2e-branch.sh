#!/usr/bin/env bash
# usage: e2e-branch.sh <worktree> [--preflight] [--backend local|preview] [--resources FILE] [--secrets FILE] [--workers N] [--budget-minutes M] [--suite S ... [--group G ...] | [--suite nightly] --journey TITLE|FILE ...] [--reuse | --discard-prepared] — run the browser gate on a clean coder worktree, keep safe evidence in $EP_ORCH/logs/, leave nothing private behind.
# --workers N (1 to the declared cohorts) and --budget-minutes M (5 to 120; default 17.5) pass to the runner (e2e/README.md "Run").
# --suite S (mandatory, focused, live, nightly or release; repeatable), --group G (a focused group; repeatable) and --journey (a journey's
# exact title or file; repeatable) pass to the runner, which checks the combination (e2e/README.md "Suites"). Without them it runs mandatory.
# --suite nightly --journey X runs X in every nightly project that runs it, compatibility projects and nightly extension included.
# --backend local runs the same selection against a disposable local Convex Docker backend instead of the recreated Cloud preview
# (e2e/README.md "Local Convex backend"); without it the runner uses the Cloud preview.
# --reuse (--backend local, a journey or focused groups alone) reuses this worktree's kept prepared environment under
# <repo parent>/.ep-tmp/e2e-prepared/ (#754, e2e/README.md "Reuse a prepared environment"); a pass on a reused one exits 5, which is
# never a gate result. --discard-prepared removes that environment.
# --suite release runs the release-qualification suite instead (#753, e2e/README.md "Release qualification"): it activates a Catalog Release on
# the recreated preview and keeps the preview's admin key in a mode-600 file under the run's TMPDIR until its operator steps end.
# The runner creates and uses <wt>/e2e/.private (slot lock only), writes evidence to <wt>/e2e-artifacts/ and builds .next in a temp workspace
# under TMPDIR, a fresh <repo parent>/.ep-tmp/e2e-* outside every checkout (removed on exit), never /tmp.
# Stopping (INT/TERM, e.g. systemd's stop) is Ctrl+C for the runner; then, in order: wait until every process the run started has
# exited, finalize and print the result, copy the evidence, delete. E2E_STOP_GRACE (seconds, default 120) is how long a stopped runner
# gets before its process group gets SIGTERM; E2E_REAP_GRACE (default 30) is how long processes the runner left behind get before
# SIGTERM. SIGKILL follows either 5 s later. Under systemd, TimeoutStopSec must exceed their sum plus the copy (e.g. 300).
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
feature=${FEATURE:-feature/pf1-character-builder}
logs=${E2E_LOGS:-$orch/logs}
reap_grace=${E2E_REAP_GRACE:-30}; stop_grace=${E2E_STOP_GRACE:-120}
resources=$main/e2e/.private/resources-1-cohort.json; secrets=$main/e2e/.private/test-secrets.env
wt=; preflight=(); passed=()
die() { echo "refusing: $*" >&2; exit 1; }
while (( $# )); do
  case $1 in
    --preflight) preflight=(--preflight) ;;
    --resources) resources=${2:?}; shift ;;
    --secrets) secrets=${2:?}; shift ;;
    --backend) [[ ${2:-} == local || ${2:-} == preview ]] || die "--backend takes local or preview"; passed+=(--backend "$2"); shift ;;
    --workers) [[ ${2:-} =~ ^[1-9][0-9]*$ ]] || die "--workers takes a whole number from 1"; passed+=(--workers "$2"); shift ;;
    --budget-minutes) [[ ${2:-} =~ ^[0-9]+(\.[0-9]+)?$ ]] || die "--budget-minutes takes minutes, e.g. 40"; passed+=(--budget-minutes "$2"); shift ;;
    --suite) [[ ${2:-} =~ ^(mandatory|focused|live|nightly|release)$ ]] || die "--suite takes mandatory, focused, live, nightly or release"; passed+=(--suite "$2"); shift ;;
    --group) [[ ${2:-} =~ ^[a-z][a-z-]*$ ]] || die "--group takes a focused group, e.g. week-activity"; passed+=(--group "$2"); shift ;;
    --journey) [[ -n ${2:-} && ${2:-} != -* ]] || die "--journey takes a journey's title or file"; passed+=(--journey "$2"); shift ;;
    # The runner checks both (#754): --reuse only for a local diagnosis, never a gate.
    --reuse) passed+=(--reuse) ;;
    --discard-prepared) passed+=(--discard-prepared) ;;
    -*) echo "unknown option: $1" >&2; exit 1 ;;
    *) wt=$1 ;;
  esac; shift
done
[[ -n $wt ]] || die "usage: e2e-branch.sh <worktree> [--preflight] [--backend local|preview] [--resources FILE] [--secrets FILE] [--workers N] [--budget-minutes M] [--suite S ... [--group G ...] | [--suite nightly] --journey TITLE|FILE ...] [--reuse | --discard-prepared]"
wt=$(cd "$wt" 2>/dev/null && pwd -P) || die "no such worktree"
[[ $(git -C "$wt" rev-parse --show-toplevel 2>/dev/null) == "$wt" ]] || die "$wt is not a git worktree root"
[[ $wt != "$(cd "$main" && pwd -P)" ]] || die "$wt is the owner's main checkout"

# Skip decision: docs, markdown and tests only.
app=$(git -C "$wt" diff --name-only "$feature...HEAD" | while IFS= read -r f; do
  case $f in docs/*|*.md|*.test.*|tests/*|*/tests/*) ;; *) echo "$f" ;; esac
done)
[[ -n $app ]] || { echo "e2e: skipped (no app changes)"; exit 0; }

# Leftovers the run creates (and cleanup deletes) must not pre-exist. The
# release suite's admin key file (release-admin.key) lives in the runner's
# temporary directory under run_tmp; it is listed wherever it turns up.
leftovers() {
  find "$wt" \( -name node_modules -o -name .git \) -prune -o \
    \( -name '.env*' ! -name .env.example -o -name .next -type d -o -name release-admin.key -o -path "$wt/e2e/.private" -o -path "$wt/e2e-artifacts" \) -print
  [[ -n ${run_tmp:-} && -e $run_tmp ]] && echo "$run_tmp"
  return 0
}
[[ -z $(git -C "$wt" status --porcelain) ]] || die "$wt has uncommitted changes"
junk=$(leftovers); [[ -z $junk ]] || die "$wt already contains:"$'\n'"$junk"
echo "reminder: no Claude coder may be active in $wt while the gate runs (orchestrator guarantees this)"

branch=$(git -C "$wt" branch --show-current); branch=${branch:-detached}; branch=${branch//\//-}
stamp=$(date +%Y%m%d-%H%M%S); log=$logs/e2e-$branch-$stamp.log; evidence=$logs/e2e-$branch-$stamp
mkdir -p "$logs"

# Every process the run starts inherits this marker (the runner forwards it),
# including those in their own process groups: Playwright, its browsers and
# the application server. /proc/<pid>/environ finds them all.
token=$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')
run_processes() {
  # grep exits 2 for other users' unreadable entries, matches or not.
  { grep -lzx "E2E_PROCESS_TOKEN=$token" /proc/[0-9]*/environ 2>/dev/null || :; } | sed -E 's#^/proc/([0-9]+)/environ$#\1#'
}
runner=; stopping=; survivors=
# Ctrl+C for the runner's process group (pnpm, tsx, the runner and tee -i), once:
# the runner interrupts Playwright gracefully and stops everything else.
stop_runner() {
  [[ -n $runner && -z $stopping ]] || return 0
  stopping=1
  kill -INT -- "-$runner" 2>/dev/null
}
# Waits for the runner, then for every marked process; the runner normally
# leaves none. Stragglers get SIGTERM after the grace, SIGKILL 5 s later.
reap() {
  local left=$(( stop_grace * 10 )) signal=TERM pids
  # A stopped runner gets E2E_STOP_GRACE to finish (it keeps 60 s for the
  # browsers' own shutdown), then its process group gets SIGTERM and SIGKILL.
  while [[ -n $runner ]] && kill -0 "$runner" 2>/dev/null; do
    if [[ -n $stopping ]] && (( left-- <= 0 )); then
      [[ $signal == done ]] && break
      echo "e2e: SIG$signal to the runner, still running after its stop"
      kill "-$signal" -- "-$runner" 2>/dev/null
      if [[ $signal == TERM ]]; then signal=KILL; else signal=done; fi
      left=50
    fi
    sleep 0.1
  done
  [[ -n $runner ]] && wait "$runner" 2>/dev/null
  left=$(( reap_grace * 10 )); signal=TERM
  while pids=$(run_processes); [[ -n $pids ]]; do
    if (( left-- <= 0 )); then
      [[ $signal == done ]] && { survivors=$pids; return 1; }
      echo "e2e: SIG$signal to processes the run left: $(tr '\n' ' ' <<<"$pids")"
      kill "-$signal" $pids 2>/dev/null
      if [[ $signal == TERM ]]; then signal=KILL; else signal=done; fi
      left=50
    fi
    sleep 0.1
  done
}
# Reaping failed: finalizing, copying or deleting could race a live writer, so
# everything stays, the slot guard included, and the owner gets the steps.
keep_for_recovery() {
  local kept=("$wt/e2e/.private" "$wt/e2e-artifacts") list
  [[ -n $run_tmp ]] && kept+=("$run_tmp")
  list=$(ps -o pid=,pgid=,comm= -p "$(tr '\n' ',' <<<"$survivors" | sed 's/,$//')" 2>/dev/null)
  {
    echo "!!!!!!!! e2e: processes of this run survived SIGKILL; nothing was finalized, copied or deleted."
    echo "Left running (pid, process group, command):"
    sed 's/^/  /' <<<"${list:-$survivors}"
    echo "Kept, with the slot guard: ${kept[*]}"
    echo "Recover: check \`ps -o pid,stat,comm -p $(tr '\n' ',' <<<"$survivors" | sed 's/,$//')\` until they are gone (a process in state D waits on the kernel), then"
    echo "  $repo/node_modules/.bin/tsx $repo/e2e/finalize-evidence.ts $wt/e2e-artifacts $rc"
    echo "  copy what you need from $wt/e2e-artifacts to $evidence, then: rm -rf ${kept[*]}"
  } >&2
}
# The one checkpoint finalizer (e2e/finalize-evidence.ts, from this script's
# checkout): makes an unfinished checkpoint final and prints the one-line
# result, Playwright's report or the completed, interrupted and unstarted tests.
summarize() {
  "$repo/node_modules/.bin/tsx" "$repo/e2e/finalize-evidence.ts" "$wt/e2e-artifacts" "$rc" \
    || echo "e2e: report.json/progress.json unreadable"
}

finish() {
  rc=$?; [[ -n ${status:-} ]] && rc=$status
  trap - EXIT
  # A second signal during cleanup only repeats the (idempotent) stop.
  trap stop_runner INT TERM
  # 1. stop, 2. wait and reap.
  [[ -n $signalled ]] && stop_runner
  reap || { keep_for_recovery; exit 3; }
  # 3. finalize the report.
  summarize
  # 4. copy evidence: reports only, never env files, role storage, run files or locks.
  local skip=( ! -name '.env*' ! -name '*.env' ! -name run.json ! -name owner.json ! -name '*storage*' ! -path '*/auth/*' ! -path '*.lock/*' )
  if [[ -d $wt/e2e-artifacts ]]; then
    mkdir -p "$evidence"; (cd "$wt/e2e-artifacts" && find . -type f "${skip[@]}" -exec cp --parents {} "$evidence" \;)
  fi
  if [[ -d $wt/e2e/.private ]]; then
    for src in stages.log timings.jsonl diagnostics.log progress.json report.json report.html; do
      [[ -f $wt/e2e/.private/$src ]] && mkdir -p "$evidence/private" && cp "$wt/e2e/.private/$src" "$evidence/private/"
    done
  fi
  [[ -d $evidence ]] && echo "evidence: $evidence"
  (( rc == 5 )) && echo "e2e: diagnostic run on a reused preparation (exit 5): not a gate result; rerun without --reuse to qualify"
  # 5. delete.
  rm -rf "$wt/e2e/.private" "$wt/e2e-artifacts"
  [[ -n $run_tmp ]] && rm -rf "$run_tmp"
  find "$wt" \( -name node_modules -o -name .git \) -prune -o \( -name .next -type d -prune -o -name '.env*' ! -name .env.example \) -exec rm -rf {} +
  junk=$(leftovers)
  if [[ -n $junk ]]; then
    echo "!!!!!!!! e2e cleanup FAILED: private files of the run in $wt remain — remove by hand before anything else:"$'\n'"$junk" >&2
    exit 3
  fi
  exit "$rc"
}
# Acquire first: mkdir is exclusive, so a second start fails here without
# touching the first one's files. Only after that is the cleanup ours to run.
mkdir -m 700 "$wt/e2e/.private" || die "$wt/e2e/.private exists or can't be created; another gate may be running"   # runner.ts:105-108 mkdir -p 0700; a real directory, nothing else accepted from us
run_tmp=; signalled=
trap finish EXIT; trap 'signalled=1; status=130; exit 130' INT; trap 'signalled=1; status=143; exit 143' TERM
run_tmp "e2e-$branch" || exit 1
cd "$wt" || exit 1
# Clean environment: no CONVEX_*, NEXT_PUBLIC_CONVEX_URL, Clerk overrides or CI selectors (e2e/support/diagnostics.ts inheritedSelectors).
# Job control gives the runner pipeline its own process group (stop_runner); tee -i outlives Ctrl+C so the runner can still report.
set -m
(
  env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" LANG="${LANG:-C.UTF-8}" TERM="${TERM:-dumb}" \
    E2E_TRUSTED_EXECUTION=true E2E_PROCESS_TOKEN="$token" \
    pnpm test:e2e --resources "$resources" --secrets "$secrets" "${preflight[@]}" "${passed[@]}" 2>&1 | tee -i "$log"
  exit "${PIPESTATUS[0]}"
) &
runner=$!
set +m
wait "$runner"; status=$?
echo "log: $log"
