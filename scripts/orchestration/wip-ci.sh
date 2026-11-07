#!/usr/bin/env bash
# usage: wip-ci.sh run [--scope <suite|tests/dir ...>]... [--static] [--timeout <n>s|<n>m] [--task <name>] [--base <commit>]
# A worker's WIP CI run (speed-wip-ci W3, owner 2026-11-06): information for the worker, never landing evidence.
# Run it from the worktree, in the background (run_in_background or t3_background_wait); it waits by itself.
#   1. Snapshot: a temporary GIT_INDEX_FILE (a copy of the worktree's index) takes every file of the worktree,
#      uncommitted and untracked ones included (.gitignore applies); its tree becomes a parentless commit with the
#      trailers Wip-Task, Wip-Base and Wip-Scope (wip_ci.py's format). The worktree's own index and refs are untouched.
#   2. Refusals, before anything is pushed (exit 1, naming each): an .env* file other than .env.example, anything
#      under e2e/.private, a file of 100 MB or more, a .github/ change against Wip-Base, an index entry marked
#      assume-unchanged or skip-worktree, a set GIT_CONFIG or an origin push URL push-lib.sh refuses.
#   3. Slot: one WIP run at a time (flock on $EP_ORCH/wip-ci/slot); it waits at most 20 min, else exits 75.
#   4. Push: through push-lib.sh in wip mode, only <commit>:refs/heads/wip/<task>-<stamp>, never forced, no tags,
#      from a scratch bare repository that borrows the worktree's objects and has no remotes, so no ref of the
#      worktree's repository moves (a push to a URL a configured remote names would update its refs/remotes/*).
#   5. Watch: prints the run URL and polls `gh run view` every 30 s until the run completes or --timeout passes;
#      every gh call runs under timeout(1) for what is left of the deadline, in the background, so neither the
#      deadline nor a signal waits for a stalled call.
#   6. Results: downloads wip-summary-<run> to $TMPDIR/wip-ci/<run>/ (within the deadline) and prints
#      wip-summary.md, at most 200 lines and 16 KB.
#   7. Cleanup, on every exit after the push (green, red, timeout, TERM, INT, HUP): on a timeout or a signal it first
#      cancels the run (gh run cancel, at most 20 s); then it deletes the branch if origin still holds this run's
#      commit there, exiting 3 if that fails; then it releases the slot. A KILL runs no cleanup: the branch stays for
#      W4's wip-sweep, and the slot is freed with the process, since no child keeps its descriptor.
# --scope takes test directories (tests/<dir>) or suite (the default); --static adds static=yes. --task defaults to
# the last part of the worktree's branch name; --base (Wip-Base) defaults to the merge base of HEAD and the
# integration branch, feature/pf1-character-builder. --timeout defaults to 45m, at most 60m.
# Exit: 0 green, 1 red or refused, 124 timeout, 75 no slot, 64 usage, 143/130/129 TERM/INT/HUP, and 3 when the
# branch could not be deleted (whatever the result; the result line above says it).
# Tests: wip-ci.test.sh (stub gh, bare local origin). WIP_CI_POLL, WIP_CI_SLOT_WAIT and WIP_CI_STAMP shorten the
# poll and slot wait and fix the stamp for those tests.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/push-lib.sh"
push_lib_init wip-ci wip
# Before any read (push-lib.sh: GIT_CONFIG changes only what git config reads).
push_require_no_git_config
. "$here/paths.sh"
integration=feature/pf1-character-builder
fail() { push_fail "$@"; }
usage() {
  [[ $# -eq 0 ]] || echo "wip-ci: $*" >&2
  echo "usage: wip-ci.sh run [--scope <suite|tests/dir ...>]... [--static] [--timeout <n>s|<n>m] [--task <name>] [--base <commit>]" >&2
  exit 64
}

[[ $# -ge 1 && $1 == run ]] || usage; shift
scope=() static=no timeout=2700 task= base=
while [[ $# -gt 0 ]]; do
  case $1 in
    --scope)
      [[ $# -ge 2 && $2 != *[[:cntrl:]]* ]] || usage "--scope takes one line of scope tokens"
      read -ra words <<< "$2"
      for word in "${words[@]}"; do [[ $word != static=* ]] || usage "use --static, not $word"; scope+=("$word"); done
      shift 2 ;;
    --static) static=yes; shift ;;
    --timeout)
      [[ $# -ge 2 && $2 =~ ^([1-9][0-9]{0,3})([sm])$ ]] || usage "--timeout takes <n>s or <n>m"
      timeout=${BASH_REMATCH[1]}
      [[ ${BASH_REMATCH[2]} == s ]] || timeout=$((timeout * 60))
      ((timeout <= 3600)) || usage "--timeout is at most 60m"
      shift 2 ;;
    --task) [[ $# -ge 2 && $2 =~ ^[a-z0-9][a-z0-9-]{0,59}$ ]] || usage "--task takes [a-z0-9-]+"; task=$2; shift 2 ;;
    --base) [[ $# -ge 2 ]] || usage; base=$2; shift 2 ;;
    *) usage "unknown argument $(printf %q "$1")" ;;
  esac
done
[[ ${#scope[@]} -gt 0 ]] || scope=(suite)
scope_value="${scope[*]}"
[[ $static == no ]] || scope_value+=" static=yes"
poll=${WIP_CI_POLL:-30} slot_wait=${WIP_CI_SLOT_WAIT:-1200}
[[ $poll =~ ^[1-9][0-9]?$ && $poll -le 30 && $slot_wait =~ ^[0-9]{1,4}$ && $slot_wait -le 1200 ]] \
  || usage "WIP_CI_POLL is 1..30 and WIP_CI_SLOT_WAIT 0..1200"
[[ -z ${WIP_CI_STAMP+set} || $WIP_CI_STAMP =~ ^[0-9]{8}-[0-9]{6}$ ]] || usage "WIP_CI_STAMP is YYYYmmdd-HHMMSS"
[[ -n ${TMPDIR:-} && -d $TMPDIR ]] || usage "TMPDIR must name a directory (the summary lands in \$TMPDIR/wip-ci/<run>/)"

top=$(git rev-parse --show-toplevel 2> /dev/null) || usage "run it inside the worktree"
cd "$top"
if [[ -z $task ]]; then
  branch=$(git symbolic-ref -q --short HEAD) || usage "HEAD is detached; name --task"
  task=$(printf '%s' "${branch##*/}" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9-' '-')
  [[ $task =~ ^[a-z0-9][a-z0-9-]{0,59}$ ]] || usage "branch $(printf %q "$branch") gives no task name; name --task"
fi
if [[ -n $base ]]; then
  base=$(git rev-parse -q --verify "$base^{commit}") || usage "--base $(printf %q "$base") is not a commit"
else
  base=$(git merge-base HEAD "$integration" 2> /dev/null) || usage "no merge base of HEAD and $integration; name --base"
fi
# wip_ci.py's own scope rules, against the worktree, so a scope CI would refuse is refused here.
python3 -B -I -c '
import sys
sys.path.insert(0, sys.argv[1])
import wip_ci
try:
    wip_ci.parse_scope(sys.argv[3], sys.argv[2])
except wip_ci.ScopeRefused as exc:
    sys.exit("wip-ci: Wip-Scope refused: %s" % exc)
' "$here" "$top" "$scope_value" || usage

# 1. Snapshot, in a temporary index; the worktree's index is only read (copied).
work=$(mktemp -d "$TMPDIR/wip-ci-XXXXXX")
# pushed: 0 before the push, 1 while it may have happened, 2 once it did. cancel: the run is cancelled on the way out.
slot_fd= waiter= sleeper= child= pushed=0 cancel=0 run= commit= ref=
pusher=$work/push.git
cleanup() {
  local status=$? pid
  trap '' TERM INT HUP
  for pid in "$waiter" "$sleeper" "$child"; do [[ -z $pid ]] || kill "$pid" 2> /dev/null || true; done
  if [[ $cancel == 1 && -n $run ]]; then
    timeout -k 2 20 gh run cancel "$run" > /dev/null 2>&1 {slot_fd}>&- || echo "wip-ci: gh run cancel $run failed" >&2
  fi
  if [[ $pushed != 0 ]] && ! (cd "$pusher" && push_delete_ref "$commit" "$ref") {slot_fd}>&-; then
    if [[ $pushed == 2 ]]; then
      echo "wip-ci: cleanup failed: ${ref#refs/heads/} is left for wip-sweep" >&2
      status=3
    else
      echo "wip-ci: ${ref#refs/heads/} not deleted (the push did not complete)" >&2
    fi
  fi
  [[ -z $slot_fd ]] || exec {slot_fd}>&-
  rm -rf "$work"
  exit "$status"
}
trap cleanup EXIT
trap 'cancel=1; exit 143' TERM
trap 'cancel=1; exit 130' INT
trap 'cancel=1; exit 129' HUP
index=$(git rev-parse --path-format=absolute --git-path index)
snap() {
  GIT_INDEX_FILE=$work/index git -c core.fsmonitor=false -c core.splitIndex=false -c gc.auto=0 \
    -c maintenance.auto=false "$@"
}
if [[ -f $index ]]; then cp "$index" "$work/index"; else snap read-tree HEAD; fi
# The whole listing is read first: grep -q reading a pipe could stop early and leave ls-files to SIGPIPE.
listing=$(snap ls-files -v) || fail "git ls-files failed reading the index"
! grep -qE '^([a-z]|S) ' <<< "$listing" \
  || fail "refused: the index hides worktree changes (assume-unchanged or skip-worktree entries)"
unset listing
snap add -A
tree=$(snap write-tree)

# 2. Refusals.
refused=0
while IFS= read -r -d '' path; do
  name=${path##*/}
  if [[ $name == .env* && $name != .env.example ]]; then
    echo "wip-ci: refused $(printf %q "$path"): an env file other than .env.example" >&2; refused=1
  fi
  if [[ $path == e2e/.private/* || $path == e2e/.private ]]; then
    echo "wip-ci: refused $(printf %q "$path"): under e2e/.private" >&2; refused=1
  fi
done < <(git --no-replace-objects ls-tree -r -z --name-only "$tree")
[[ $refused == 0 ]] || exit 1
push_check_file_sizes "$tree"
git --no-replace-objects diff-tree -r --quiet "$base" "$tree" -- .github && status=0 || status=$?
[[ $status != 1 ]] || fail "refused: .github/ differs from Wip-Base $base; workflow changes go through the gate"
[[ $status == 0 ]] || fail "git diff-tree failed comparing .github/ with Wip-Base $base"
push_origin_url
# The push and the delete run in $pusher: a bare repository with no remotes and no hooks whose objects are the
# worktree's (alternates). Pushed from the worktree, git would update refs/remotes/origin/wip/* there.
git init -q --bare --template= "$pusher"
mkdir -p "$pusher/objects/info"
printf '%s\n' "$(git rev-parse --path-format=absolute --git-common-dir)/objects" > "$pusher/objects/info/alternates"
commit=$(printf 'wip: %s\n\nWIP CI snapshot of the %s worktree at %s; information only, never landing evidence.\n\nWip-Task: %s\nWip-Base: %s\nWip-Scope: %s\n' \
  "$task" "$task" "$(git rev-parse HEAD)" "$task" "$base" "$scope_value" \
  | GIT_AUTHOR_NAME=wip-ci GIT_AUTHOR_EMAIL=wip-ci@invalid GIT_COMMITTER_NAME=wip-ci GIT_COMMITTER_EMAIL=wip-ci@invalid \
    push_tree_commit "$tree" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")

# 3. Slot. flock runs in the background so a signal ends the wait; its lock is on the shared open file.
mkdir -p "$orch/wip-ci"
exec {slot_fd}>> "$orch/wip-ci/slot"
flock -w "$slot_wait" "$slot_fd" & waiter=$!
wait "$waiter" && status=0 || status=$?
waiter=
[[ $status == 0 ]] || { echo "wip-ci: no WIP slot within ${slot_wait}s ($orch/wip-ci/slot holds another run)" >&2; exit 75; }

# Every child from here on runs without the slot's descriptor, so none can hold the slot after this shell dies:
# a command runs through nofd, and a command substitution, a subshell of its own, closes it first (`exec`).
nofd() { "$@" {slot_fd}>&-; }
pause() { sleep "$1" {slot_fd}>&- & sleeper=$!; wait "$sleeper" || true; sleeper=; }

# 4. Push.
ref=refs/heads/wip/$task-${WIP_CI_STAMP:-$(date -u +%Y%m%d-%H%M%S)}
pushed=1
(cd "$pusher" && push_ref "$commit" "$ref") {slot_fd}>&- || exit 1
pushed=2
echo "wip-ci: pushed ${ref#refs/heads/} at $commit (Wip-Scope: $scope_value)"

# 5. Watch.
deadline=$((SECONDS + timeout))
url= state= conclusion=
# bounded <out> <command...>: the command under timeout(1) for what is left of the deadline, its stdout in <out>. It
# runs in the background so a signal ends the wait at once (cleanup kills it); it fails once the budget is spent.
bounded() {
  local out=$1 left=$((deadline - SECONDS)) status=0
  shift
  ((left > 0)) || return 124
  timeout -k 2 "$left" "$@" > "$out" 2> /dev/null {slot_fd}>&- &
  child=$!
  wait "$child" || status=$?
  child=
  return "$status"
}
timed_out() {
  echo "wip-ci: no result within ${timeout}s (run ${url:-not found}); cancelling it and deleting ${ref#refs/heads/}" >&2
  cancel=1
  exit 124
}
# json_fields <file> <commit>: "id url" of the listed run at <commit>; with no commit, "status conclusion" of a run.
json_fields() {
  nofd python3 -B -I -c '
import json, sys
data, want = json.load(open(sys.argv[1])), sys.argv[2]
if want:
    data = next((run for run in data if run.get("headSha") == want), None) or sys.exit(1)
    print(int(data["databaseId"]), str(data["url"]).split()[0])
else:
    print(str(data.get("status")).split()[0], str(data.get("conclusion") or "-").split()[0])
' "$@"
}
while :; do
  if [[ -z $run ]]; then
    if bounded "$work/runs.json" gh run list --branch "${ref#refs/heads/}" --event push --workflow ci.yaml \
      --json databaseId,headSha,url --limit 20 \
      && fields=$(exec {slot_fd}>&-; json_fields "$work/runs.json" "$commit" 2> /dev/null); then
      read -r run url <<< "$fields"
      echo "wip-ci: run $url"
    fi
  elif bounded "$work/run.json" gh run view "$run" --json status,conclusion,url \
    && fields=$(exec {slot_fd}>&-; json_fields "$work/run.json" '' 2> /dev/null); then
    read -r state conclusion <<< "$fields"
    [[ $state != completed ]] || break
  fi
  left=$((deadline - SECONDS))
  ((left > 0)) || timed_out
  pause $((left < poll ? left : poll))
done

# 6. Results.
dest=$TMPDIR/wip-ci/$run
rm -rf "$dest"; mkdir -p "$dest"
outcome=missing
downloaded=0
bounded /dev/null gh run download "$run" --name "wip-summary-$run" --dir "$dest" && downloaded=1
((downloaded == 1 || deadline - SECONDS > 0)) || timed_out
if [[ $downloaded == 1 && -f $dest/wip-summary.json ]]; then
  outcome=$(exec {slot_fd}>&-; python3 -B -I -c '
import json, sys
summary = json.load(open(sys.argv[1]))
print(summary.get("outcome") if summary.get("kind") == "wip-ci-summary-v1" else "unknown")
' "$dest/wip-summary.json" 2> /dev/null) || outcome=unreadable
fi
if [[ -f $dest/wip-summary.md ]]; then
  # Whole lines only: at most 200, at most 16 KB, control characters but tab shown as '?'.
  nofd python3 -B -I -c '
import sys
lines, size, path = [], 0, sys.argv[1]
raw = open(path, "rb").read().split(b"\n")
if raw and raw[-1] == b"":
    raw.pop()
for line in raw:
    text = "".join(c if c == "\t" or c.isprintable() else "?" for c in line.decode("utf-8", "replace"))
    cost = len(text.encode()) + 1
    if len(lines) == 200 or size + cost > 16384:
        break
    lines.append(text)
    size += cost
sys.stdout.write("".join(line + "\n" for line in lines))
if len(lines) < len(raw):
    print("wip-ci: summary cut at 200 lines and 16 KB (%d of %d lines shown); full file: %s" % (len(lines), len(raw), path))
' "$dest/wip-summary.md"
fi
if [[ $conclusion == success && $outcome == green ]]; then
  echo "wip-ci: green (run $url)"
  exit 0
fi
echo "wip-ci: red (run conclusion $conclusion, summary $outcome; run $url)"
exit 1
