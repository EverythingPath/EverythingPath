#!/usr/bin/env bash
# usage: triage-failures.sh <worktree> [report.json] — one verdict (REAL/REGRESSION/LOAD/NEW) per failed full-suite test; exit 1 on REAL or REGRESSION (over 25% and 250 ms slower than head).
# Tests the exact commit at <worktree>'s HEAD in a fresh detached checkout (a unique ep-gate-* beside the main checkout, never /tmp; committed files plus
# `pnpm install --offline`, removed on exit), so nothing that exists only in <worktree> can make the suite pass.
# Reruns each failed test alone in that checkout and in $MAIN (feature head, read-only: tests only).
# Holds $EP_ORCH/heavy.lock from the full suite through the reruns, so only one full suite runs at a time.
# $TRIAGE_LOG overrides the vitest log path (default $EP_ORCH/logs/<worktree>-<stamp>-vitest.log).
# TRIAGE_EVIDENCE optionally names a fresh absolute directory for durable full
# and diagnostic JSON; temporary checkout/TMPDIR cleanup leaves these intact.
# Every Vitest process in the clean checkout (the full suite and each rerun
# there) runs under lane-lock.sh: the files the light landing lane lets a
# docs-only candidate change are unreadable for exactly that process, so a test
# that reads one, directly or through a child process, fails this gate. Its
# record is lane-lock-<report>.json beside each report. Reruns in $MAIN are
# head comparisons and run unlocked: the owner's checkout is never chmodded.
set -uo pipefail
wt=$(cd "${1:?usage: triage-failures.sh <worktree> [report.json]}" && pwd) || exit 1
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/triage-lib.sh"
export NODE_OPTIONS='--experimental-require-module --no-warnings --max-old-space-size=4096'
stamp=$(date +%Y%m%d-%H%M%S)
sha=$(git -C "$wt" rev-parse --verify -q 'HEAD^{commit}') || { echo "no commit at $wt"; exit 1; }
[[ -z $(git -C "$wt" status --porcelain) ]] || echo "warning: $wt has uncommitted changes; they are not tested"
mkdir -p "$orch/logs"
gate= tmp= log=
# tmp is also this run's TMPDIR (outside every checkout, never /tmp).
cleanup() {
  trap - EXIT INT TERM
  [[ -n $tmp ]] && rm -rf "$tmp"
  # Only the checkout this invocation created: mktemp made its name unique.
  if [[ -n $gate && -e $gate ]]; then
    git -C "$wt" worktree remove --force "$gate" >/dev/null 2>&1 || rm -rf "$gate"
    git -C "$wt" worktree prune
    [[ -e $gate ]] && echo "!!!! clean checkout $gate could not be removed; remove it by hand" >&2
  fi
}
trap cleanup EXIT; trap 'exit 130' INT; trap 'exit 143' TERM
run_tmp "triage-$(basename "$wt")" || exit 1
tmp=$run_tmp
diagnostics=$tmp
if [[ -n ${TRIAGE_EVIDENCE:-} ]]; then
  [[ $TRIAGE_EVIDENCE == /* ]] && mkdir "$TRIAGE_EVIDENCE" || { echo 'evidence directory must be fresh and absolute'; exit 1; }
  diagnostics=$TRIAGE_EVIDENCE
fi
gate=$(mktemp -d "$repos/ep-gate-$(basename "$wt")-$stamp-XXXXXX") || { echo "could not reserve a clean checkout directory"; exit 1; }
record_scratch_worktree "$gate" || exit 1

git -C "$wt" worktree add -q --detach "$gate" "$sha" || { echo "could not create clean checkout $gate"; exit 1; }
found=$(env_files "$gate") || { echo "refusing: can't list the clean checkout $gate"; exit 1; }
[[ -z $found ]] || { echo "refusing: $sha commits env files: $found"; exit 1; }
(cd "$gate" && pnpm install --offline) >"$tmp/install.log" 2>&1 \
  || { cp "$tmp/install.log" "$orch/logs/$(basename "$wt")-$stamp-install.log"; echo "pnpm install --offline failed in $gate; see logs/$(basename "$wt")-$stamp-install.log"; exit 1; }
echo "clean checkout: $gate at $sha"

# The lock fd (9) is closed for every child, so a leftover process can't keep holding it.
exec 9>>"$orch/heavy.lock"
flock -n 9 || { echo "waiting for heavy.lock (another full suite is running)"; flock 9; }

# rerun <dir> <file> <fullName> <out>: run one test alone, JSON report to <out>.
rerun() {
  local pat lock=()
  pat=$(printf '%s' "$3" | sed 's/[][\\.*^$?+(){}|]/\\&/g')
  [[ $1 == "$gate" ]] && lock=("$here/lane-lock.sh" "$gate" "$(dirname "$4")/lane-lock-$(basename "$4")")
  (cd "$1" && "${lock[@]}" pnpm vitest run "$2" --testNamePattern="(^| )$pat\$" --reporter=json --outputFile="$4") >/dev/null 2>&1 9>&-
}

report=${2:-}
if [[ -z $report ]]; then
  log=${TRIAGE_LOG:-$orch/logs/$(basename "$wt")-$stamp-vitest.log}; report=$diagnostics/full.json
  echo "vitest log: $log"
  (cd "$gate" && "$here/lane-lock.sh" "$gate" "$diagnostics/lane-lock-full.json" pnpm test --reporter=default --reporter=json --outputFile.json="$report") >"$log" 2>&1 9>&-
  suite=$?
else
  suite=0   # a given report: only its own contents count
  [[ $diagnostics == "$tmp" ]] || cp "$report" "$diagnostics/full.json" || exit 1
fi
# Fails closed: the gate never passes on a missing or unparsable report, or a
# failed suite whose report lists no failure.
listed=$(failed_tests "$report" "$suite") || { echo "gate failed${log:+; see $log}"; exit 1; }
[[ -n $listed ]] || { echo "all green"; exit 0; }
mapfile -t failed <<<"$listed"

bad=0; i=0
for line in "${failed[@]}"; do
  file=${line%%$'\t'*}; name=${line#*$'\t'}; rel=${file#"$gate"/}; rel=${rel#"$wt"/}; rel=${rel#"$main"/}; i=$((i + 1))
  if [[ -z $name ]]; then echo "REAL        $rel (file failed outside any test; see log)"; bad=1; continue; fi
  rerun "$gate" "$rel" "$name" "$diagnostics/b$i.json"; IFS=$'\t' read -r bs bd < <(result "$diagnostics/b$i.json" "$name")
  hs=; hd=
  if [[ -f $main/$rel ]]; then
    rerun "$main" "$rel" "$name" "$diagnostics/h$i.json"; IFS=$'\t' read -r hs hd < <(result "$diagnostics/h$i.json" "$name")
  fi
  label="$rel > $name"
  if [[ ${bs:-} != passed ]]; then verdict=REAL; detail="fails alone on branch${bs:+ (${bd}ms)}"; bad=1
  elif [[ -z $hs ]]; then verdict=NEW; detail="branch ${bd}ms"
  elif awk -v b="$bd" -v h="$hd" 'BEGIN { exit !(b > h * 1.25 && b - h > 250) }'; then verdict=REGRESSION; detail="branch ${bd}ms vs head ${hd}ms"; bad=1
  else verdict=LOAD; detail="branch ${bd}ms vs head ${hd}ms"
  fi
  [[ -n $hs && $hs != passed ]] && detail+=" (head also fails alone)"
  printf '%-11s %s — %s\n' "$verdict" "$label" "$detail"
done
exit $bad
