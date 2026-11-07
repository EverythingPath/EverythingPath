#!/usr/bin/env bash
# usage: land-queue.sh [--dry-run] [--pair plan.json | <n|branch[:worktree]|cur/n@branch:worktree>...]
# --pair is exactly two frozen reviewed items on queue-owned disposable scratch;
# see docs/agents/orchestration/paired-gates.md for the plan and resume contract.
# The single landing entry point. Takes an exclusive flock on $EP_ORCH/land.lock
# (waiting its turn), then lands the items in order, each rebased onto the
# current feature head first:
#   <n> or cur/<n>    curation batch: cur-prep.sh <n> briefs/cur-<n>-msg.txt
#                     (commit, rebase, data merge, shared-store count, light or
#                     full catalog tests), worktree ep-cur-<n>; skipped when
#                     its prep receipt (logs/cur-<n>-prep.receipt) still holds:
#                     same commit, feature head, lockfile, prep scripts, test
#                     environment, toolchain and check configuration, and a
#                     clean worktree (prep-lib.sh). Under LAND_REMOTE_CHECKS
#                     only the remote-suite receipt (cur-prep.sh
#                     --remote-suite, logs/cur-<n>-prep.remote.receipt) is
#                     read and must hold; otherwise it refuses and never
#                     preps (fresh prep, push and review)
#   cur/<n>@<br>:<wt> curation in an app branch/worktree; same specialized prep
#   cur/<n>:<wt>     numbered curation branch in an explicit worktree
#   impl/<x>[:<wt>]   git rebase (data-file and append-only table conflicts via
#   <branch>:<wt>     catalog:merge, prep-lib.sh's prep_merge_re; any other
#                     conflict aborts the rebase), pnpm install --offline and
#                     the writer check; worktree defaults to ep-impl-<x>
# (worktrees sit beside the main checkout; briefs and logs are under $EP_ORCH)
# then cur-land.sh (full gate, land.sh). It goes on to the next item only on success.
# It copies the whole scripts/orchestration directory into
# $EP_ORCH/logs/queue-<stamp>/ and runs those copies, so editing a script under scripts/orchestration can't
# break a running queue.
# The queue's output is also in logs/queue-<stamp>/queue.log.
# --dry-run takes the lock, makes the snapshot, checks that every helper the
# snapshot's scripts source is in it and loads, and prints the plan; it never
# rebases, commits or lands.
# LAND_REMOTE_CHECKS (cur-land.sh) binds one exact tree: it refuses --pair,
# more than one item, an unknown LAND_REMOTE_CHECKS_MODE, and compare without
# TRIAGE_EVIDENCE.
# LAND_LANE=light (cur-land.sh, the light landing lane) binds one code item: it
# refuses another value, --pair, more than one item, a curation item and
# LAND_REMOTE_CHECKS.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-lib.sh"
. "$here/worktree-lib.sh"
feature=${FEATURE:-feature/pf1-character-builder}
# Same shared data files and append-only tables as cur-prep.sh.
data_re=$prep_merge_re

if [[ -z ${LAND_QUEUE_SNAPSHOT:-} ]]; then
  snap=$orch/logs/queue-$(date +%Y%m%d-%H%M%S)-$$
  mkdir -p "$snap" || exit 1
  # The whole scripts directory, so every helper the queued scripts source is in the snapshot too.
  cp -pr "$here/." "$snap/" || { echo "snapshot of $here failed"; exit 1; }
  export LAND_QUEUE_SNAPSHOT=$snap
  exec bash "$snap/land-queue.sh" "$@"
fi
snap=$LAND_QUEUE_SNAPSHOT
exec > >(tee -a "$snap/queue.log") 2>&1

dry=0; items=(); pair=
while (( $# )); do
  a=$1; shift
  case $a in
    --dry-run) dry=1; export GIT_OPTIONAL_LOCKS=0 ;;
    --pair) pair=${1:?pair plan}; shift ;;
    -*) echo "unknown option: $a"; exit 1 ;;
    *) items+=("$a") ;;
  esac
done
[[ -n $pair || ${#items[@]} != 0 ]] || { echo "usage: land-queue.sh [--dry-run] [--pair plan.json | <item>...]"; exit 1; }
[[ -z $pair || ${#items[@]} == 0 ]] || { echo "--pair cannot be mixed with serial items"; exit 1; }
if [[ -n ${LAND_LANE:-} ]]; then
  [[ $LAND_LANE == light ]] || { echo "unknown lane '$LAND_LANE'"; exit 1; }
  [[ -z $pair ]] || { echo "the light lane does not apply to pairs"; exit 1; }
  (( ${#items[@]} == 1 )) || { echo "the light lane binds one item; got ${#items[@]}"; exit 1; }
  [[ -z ${LAND_REMOTE_CHECKS:-} ]] || { echo "the light lane does not combine with remote checks"; exit 1; }
fi
if [[ -n ${LAND_REMOTE_CHECKS:-} ]]; then
  [[ -z $pair ]] || { echo "remote checks do not apply to pairs"; exit 1; }
  (( ${#items[@]} == 1 )) || { echo "remote checks bind one item; got ${#items[@]}"; exit 1; }
  case ${LAND_REMOTE_CHECKS_MODE:-} in
    replace) ;;
    compare) [[ -n ${TRIAGE_EVIDENCE:-} ]] || { echo "compare mode needs TRIAGE_EVIDENCE"; exit 1; } ;;
    *) echo "unknown remote checks mode '${LAND_REMOTE_CHECKS_MODE:-}'"; exit 1 ;;
  esac
fi
echo "snapshot: $snap"

# snapshot_helpers: every `. "$here/<helper>"` in the snapshot resolves to a
# file in the snapshot that sources cleanly there.
snapshot_helpers() {
  local helpers h ok=0
  helpers=$(grep -ohE '^[[:space:]]*\. "\$here/[A-Za-z0-9_.-]+"' "$snap"/*.sh | grep -oE '[A-Za-z0-9_.-]+\.sh' | sort -u)
  for h in $helpers; do
    [[ -f $snap/$h ]] || { echo "snapshot is missing $h"; ok=1; continue; }
    (here=$snap; . "$snap/$h") > /dev/null 2>&1 || { echo "snapshot's $h doesn't load"; ok=1; }
  done
  (( ok == 0 )) && echo "snapshot helpers load from $snap: ${helpers//$'\n'/ }"
  return $ok
}
if [[ $dry == 1 ]]; then snapshot_helpers || exit 1; fi

# Every child runs with fd 8 closed, so no leftover process can keep holding the lock.
exec 8>>"$orch/land.lock"
flock -n 8 || { echo "waiting for land.lock (held by: $(head -1 "$orch/land.lock" | grep . || echo unknown))"; flock 8; }
echo "land-queue.sh ${items[*]} (pid $$, snapshot $snap)" > "$orch/land.lock"
if [[ -n $pair ]]; then
  # The driver owns fd 8; all children inherit only stdin/stdout/stderr.
  exec node "$snap/pair-queue.mjs" "$pair" "$snap" "$dry"
fi
run_tmp=
trap ': > "$orch/land.lock"; [[ -n $run_tmp ]] && rm -rf "$run_tmp"' EXIT
echo "land.lock acquired"
run_tmp queue || exit 1

# resolve <item>: sets kind (cur|impl), num, br, wt, name, msg.
resolve() {
  local item=$1
  queue_target "$1" "$feature" || return 1
  local dirty; dirty=$(git -C "$wt" status --porcelain)
  if [[ $kind == cur && -n $dirty && ! -f $msg ]]; then echo "$item: $wt has uncommitted work but no $msg"; return 1; fi
  if [[ $kind == impl && -n $dirty ]]; then echo "$item: $wt has uncommitted changes"; return 1; fi
  return 0
}

rebasing() { (cd "$1" && [[ -d $(git rev-parse --git-path rebase-merge) || -d $(git rev-parse --git-path rebase-apply) ]]); }

# impl_prep <branch> <worktree>: rebase onto the feature head, reinstall, writer check.
impl_prep() {
  local br=$1 wt=$2 conflicted other data stops=0
  git -C "$wt" rebase -q "$feature" 8>&-
  while rebasing "$wt"; do
    (( ++stops <= 20 )) || { echo "rebase of $br stopped 20 times; aborted"; git -C "$wt" rebase --abort; return 2; }
    conflicted=$(git -C "$wt" diff --name-only --diff-filter=U)
    other=$(printf '%s\n' "$conflicted" | grep -vE "$data_re" | grep . || true)
    if [[ -z $conflicted || -n $other ]]; then
      echo "rebase of $br stopped on non-data conflicts; aborted, resolve by hand: ${other:-(no conflicted files)}"
      git -C "$wt" rebase --abort
      return 2
    fi
    if ! (cd "$wt" && pnpm -s catalog:merge) 8>&-; then
      echo "catalog:merge failed on $br; rebase aborted"
      git -C "$wt" rebase --abort
      return 2
    fi
    data=$(printf '%s\n' "$conflicted" | grep -E "$data_re")
    # shellcheck disable=SC2086 # one path per line, none contain spaces
    (cd "$wt" && git add $data && GIT_EDITOR=true git rebase --continue >/dev/null) 8>&- \
      || { rebasing "$wt" || { echo "rebase --continue failed on $br"; return 2; }; }
  done
  git -C "$wt" merge-base --is-ancestor "$feature" HEAD || { echo "$br is not on top of $feature after the rebase"; return 2; }
  (cd "$wt" && pnpm install --offline) > /dev/null 2>&1 8>&- || { echo "pnpm install --offline failed in $wt"; return 4; }
  git -C "$wt" log --oneline -1
  (cd "$wt" && pnpm -s check:initial-migration-writers) 8>&- || { echo "writer check failed on $br"; return 3; }
}

[[ $(git -C "$main" symbolic-ref --short -q HEAD) == "$feature" ]] || { echo "refusing: $main is not on $feature"; exit 1; }
bad=0
for item in "${items[@]}"; do
  resolve "$item" || bad=1
  [[ -z ${LAND_LANE:-} || ${kind:-} != cur ]] || { echo "$item: light lane is for code items only"; bad=1; }
done
(( bad == 0 )) || { echo "nothing landed"; exit 1; }

echo "feature head: $(git -C "$main" log --oneline -1 "$feature")"
# Under remote checks the remote full suite ran on the reviewed tree: a
# curation item's remote-suite prep receipt must still hold (prep_reusable
# reads only that file), and a missing or stale one is refused rather than
# prepped again here.
reuse_mode=; [[ -n ${LAND_REMOTE_CHECKS:-} ]] && reuse_mode=remote
remote_refusal() { echo "remote checks need a reusable remote-mode prep receipt ($1); fresh prep, push and review"; }
refused=0
done_items=()
for item in "${items[@]}"; do
  resolve "$item" || { echo "== $item no longer valid; stopping"; exit 1; }
  echo "== $item ($kind: $br in $wt)"
  if (( dry )); then
    read -r behind ahead < <(git -C "$main" rev-list --left-right --count "$feature...$br")
    echo "   $ahead ahead, $behind behind $feature; worktree $([[ -n $(git -C "$wt" status --porcelain) ]] && echo dirty || echo clean)"
    if [[ $kind == cur ]] && why=$(prep_reusable "$num" "$wt" "$(git -C "$main" rev-parse "$feature")" "$reuse_mode"); then
      echo "   would reuse the prep: $why"
    elif [[ $kind == cur && -n $reuse_mode ]]; then echo "   would refuse: $(remote_refusal "$why")"; refused=1
    elif [[ $kind == cur ]]; then echo "   would run: $snap/cur-prep.sh --branch $br --worktree $wt $num $msg ($why)"
    else echo "   would run: git rebase $feature, pnpm install --offline, check:initial-migration-writers"
    fi
    if [[ ${LAND_REMOTE_CHECKS_MODE:-} == replace && -n ${LAND_REMOTE_CHECKS:-} ]]; then
      echo "   would verify remote checks $LAND_REMOTE_CHECKS (replace) and run its host audits instead of typecheck, lint and the full suite"
    elif [[ -n ${LAND_REMOTE_CHECKS:-} ]]; then
      echo "   would verify remote checks $LAND_REMOTE_CHECKS (compare) and compare them with the full suite"
    fi
    if [[ -n ${LAND_LANE:-} ]]; then
      echo "   would verify the light lane (light-lane-v1) instead of codegen, pin, typecheck, lint, the full suite and the e2e preflight"
    fi
    echo "   would run: LAND_LOCK_HELD=1 $snap/cur-land.sh $br $wt $name"
    continue
  fi
  if [[ $kind == cur ]] && why=$(prep_reusable "$num" "$wt" "$(git -C "$main" rev-parse "$feature")" "$reuse_mode"); then
    echo "prep $item reused: $why"
  elif [[ $kind == cur && -n $reuse_mode ]]; then
    echo "prep $item: $(remote_refusal "$why"); landed: ${done_items[*]:-none}"; exit 1
  elif [[ $kind == cur ]]; then
    echo "prep $item: not reusing the prep ($why); running it"
    PREP_LOG=$snap/queue.log "$snap/cur-prep.sh" --branch "$br" --worktree "$wt" "$num" "$msg" 8>&- || { echo "prep $item failed; landed: ${done_items[*]:-none}"; exit 1; }
  else
    impl_prep "$br" "$wt" || { echo "prep $item failed; landed: ${done_items[*]:-none}"; exit 1; }
  fi
  LAND_LOCK_HELD=1 "$snap/cur-land.sh" "$br" "$wt" "$name" 8>&- \
    || { echo "land $item failed; landed: ${done_items[*]:-none}"; exit 1; }
  done_items+=("$item")
done
if (( dry && refused )); then echo "dry run: the queue would refuse; nothing rebased or landed"; exit 1
elif (( dry )); then echo "dry run: nothing rebased or landed"; else echo "queue done: ${done_items[*]}"; fi
