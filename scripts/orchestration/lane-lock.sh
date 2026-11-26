#!/usr/bin/env bash
# usage: lane-lock.sh <checkout> <evidence.json|-> <command...>
# The light landing lane's read lock (operations.md, "Light landing lane"):
# runs <command> with every tracked file of <checkout> that light-lane-v1
# allows a docs-only candidate to change made unreadable (mode 000), so any
# reader of one, in-process, a child process or another tool, fails. The
# list (light_lane.py lockable: the allowlist without .gitignore, which git
# must read and R5 proves) is taken before the lock; no git command runs
# inside it. The command runs in its own process group. When it exits, or
# on INT or TERM, the whole group gets TERM and, after LANE_LOCK_GRACE seconds
# (default 10), KILL; the original modes come back only once no process of
# the group is left, so no descendant runs with restored modes inside the
# window; HUP, INT, QUIT, TERM and any other exit take the same path. While
# the command is being launched and its group id is not yet recorded, a signal
# is only recorded as pending and acted on right after; nothing is restored
# while a process of the group could exist unrecorded. A mode left
# unrestored, or a group that outlives KILL, is an error (exit 70).
# triage-failures.sh runs every Vitest process of the full suite under it,
# in its own disposable checkout. <evidence.json> (create-only, or - for none)
# records the files, the command, its exit code and a sha256 over the
# restored "<mode> <path>" lines. Exits with the command's status.
# While the lock holds, <evidence.json>.active records the checkout, the files
# with their original modes, a lock id (the command's environment carries it
# as LANE_LOCK_ID) and, once known, the command's process group; it is removed
# after a clean restore. If the lock dies first (SIGKILL, or an exit while the
# group is not yet recorded) it remains for recovery (operations.md).
# Git in the window: chmod changes a file's ctime but not its content or
# mtime, so before locking the checkout's own index is refreshed (no racily
# clean entry is left), and the command alone gets core.trustctime=false as
# GIT_CONFIG_* environment (a linked worktree's `git config` would write the
# shared repository config). Git then compares stat data without re-hashing a
# locked file. The one such reader in the suite is check:artifacts
# (launch-document.test.ts), a stage the light lane runs itself.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
checkout=$(cd "${1:?usage: lane-lock.sh <checkout> <evidence.json|-> <command...>}" && pwd) || exit 64
evidence=${2:?evidence}; shift 2
(( $# )) || { echo "lane-lock: no command" >&2; exit 64; }
[[ $evidence == - || ( $evidence == /* && ! -e $evidence && ! -e $evidence.active ) ]] || { echo "lane-lock: evidence must be - or a new absolute path: $evidence" >&2; exit 64; }
active= lock_id=lane-lock-$$-$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')
[[ $evidence == - ]] || active=$evidence.active
listing=$(mktemp "${TMPDIR:?}/lane-lock-XXXXXX") || exit 64
python3 -B "$here/light_lane.py" lockable "$checkout" > "$listing" || { echo "lane-lock: could not list $checkout" >&2; rm -f "$listing"; exit 64; }
files=() modes=()
while IFS= read -r -d '' file; do
  [[ -f $checkout/$file && ! -L $checkout/$file ]] || continue
  files+=("$file"); modes+=("$(stat -c %a "$checkout/$file")")
done < "$listing"
rm -f "$listing"
git -C "$checkout" update-index -q --refresh > /dev/null 2>&1

# write_active [group]: (re)publish the active record atomically.
write_active() {
  [[ -n $active ]] || return 0
  local i
  for i in "${!files[@]}"; do printf '%s %s\n' "${modes[$i]}" "${files[$i]}"; done | python3 -B -c '
import json, os, sys
path, checkout, lock_id, lock_pid, group = sys.argv[1:6]
files = [dict(path=line.split(" ", 1)[1], mode=line.split(" ", 1)[0]) for line in sys.stdin.read().splitlines()]
with open(path + ".tmp", "w") as stream:
    json.dump(dict(kind="lane-lock-active-v1", checkout=checkout, lockId=lock_id, lockPid=int(lock_pid),
                   group=int(group) if group else None, files=files), stream, indent=2)
    stream.write("\n")
os.replace(path + ".tmp", path)
' "$active" "$checkout" "$lock_id" "$$" "${1:-}"
}
restored=0
restore() {
  (( restored )) && return 0
  local i
  for i in "${!files[@]}"; do chmod "${modes[$i]}" -- "$checkout/${files[$i]}"; done
  restored=1
}
child= grace=${LANE_LOCK_GRACE:-10} survivors=0
# phase: idle (no command yet), launching (it may exist; its group id is not
# recorded), running (child holds its group id), done (the group is gone).
phase=idle pending=
group_alive() { kill -0 -- "-$child" 2>/dev/null; }
# stop_group: TERM the command's process group, KILL it after the grace, and
# return only when it is empty (or KILL failed for a further grace).
stop_group() {
  [[ -n $child ]] || return 0
  local deadline
  if group_alive; then
    kill -TERM -- "-$child" 2>/dev/null
    deadline=$((SECONDS + grace))
    while group_alive && (( SECONDS < deadline )); do sleep 0.1; done
  fi
  if group_alive; then
    kill -KILL -- "-$child" 2>/dev/null
    deadline=$((SECONDS + grace))
    while group_alive && (( SECONDS < deadline )); do sleep 0.1; done
    group_alive && { echo "lane-lock: process group $child outlived KILL" >&2; survivors=1; }
  fi
  wait "$child" 2>/dev/null
  child=
  phase=done
}
# Every way out takes one path: normal or abnormal exit, HUP, INT, QUIT and
# TERM all stop the whole group first and restore the modes only after it.
shutdown() {
  if [[ $phase == launching ]]; then
    echo "lane-lock: exit during launch; the files stay locked" >&2
    return
  fi
  stop_group
  restore
  (( survivors )) || { [[ -z $active ]] || rm -f "$active"; }
}
on_signal() {
  [[ $phase == launching ]] && { pending=$1; return; }
  shutdown
  exit "$1"
}
trap shutdown EXIT
trap 'on_signal 129' HUP
trap 'on_signal 130' INT
trap 'on_signal 131' QUIT
trap 'on_signal 143' TERM

write_active || { echo "lane-lock: could not write $active" >&2; exit 70; }
for file in "${files[@]}"; do chmod 000 -- "$checkout/$file" || { echo "lane-lock: could not lock $file" >&2; exit 70; }; done
count=${GIT_CONFIG_COUNT:-0}
# Monitor mode puts the background command in its own process group (pgid = its pid).
phase=launching
set -m
env LANE_LOCK_ID="$lock_id" GIT_CONFIG_COUNT=$((count + 1)) "GIT_CONFIG_KEY_$count=core.trustctime" "GIT_CONFIG_VALUE_$count=false" "$@" 0<&0 &
child=$!
set +m
phase=running
write_active "$child"
[[ -z $pending ]] || on_signal "$pending"
wait "$child"; rc=$?
shutdown

bad=$survivors lines=
for i in "${!files[@]}"; do
  actual=$(stat -c %a "$checkout/${files[$i]}")
  [[ $actual == "${modes[$i]}" ]] || { echo "lane-lock: ${files[$i]} restored to $actual, not ${modes[$i]}" >&2; bad=1; }
  lines+="$actual ${files[$i]}"$'\n'
done
if [[ $evidence != - ]]; then
  printf '%s' "$lines" | python3 -B -c '
import hashlib, json, sys
evidence, checkout, rc, count = sys.argv[1:5]
lines = sys.stdin.read()
record = dict(kind="lane-lock-v1", checkout=checkout, command=sys.argv[5:], exitCode=int(rc),
              files=[line.split(" ", 1)[1] for line in lines.splitlines()],
              restoredModesSha256=hashlib.sha256(lines.encode()).hexdigest())
assert len(record["files"]) == int(count)
with open(evidence, "x") as stream:
    json.dump(record, stream, indent=2)
    stream.write("\n")
' "$evidence" "$checkout" "$rc" "${#files[@]}" "$@" || bad=1
fi
(( bad == 0 )) || exit 70
exit "$rc"
