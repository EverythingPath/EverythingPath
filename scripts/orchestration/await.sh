#!/usr/bin/env bash
# usage: await.sh <id>... [--timeout <seconds>]
# Blocks until any listed run has finished, then prints one line per finished
# run and exits 0. Call it again with the runs still going. On timeout it
# prints "still running: <ids>" and exits 124. Polls every 5 seconds
# (AWAIT_INTERVAL). An id is a bounded.sh invocation id (its "id:" line;
# $EP_ORCH/bounded/<id>/): prints "<id> <exit code> <log path> <outcome>"
# from the run's receipt, outcome ok, failed, lockRefused, oom, killed or
# submitFailed. Without a receipt, the unit's systemd state decides (a note
# goes to stderr; bounded-outcome.sh classifies both), a unit that is gone
# prints "<id> lost <log path>", and while the user manager doesn't answer it
# keeps waiting. A label is never an id: invocations that share a label are
# told apart only by their ids. A run id of the retired spawn.sh is refused:
# T3 delegated tasks report through their task status, not here.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/bounded-outcome.sh"
systemctl=${AWAIT_SYSTEMCTL:-systemctl}
interval=${AWAIT_INTERVAL:-5}
# A unit that isn't loaded yet counts as starting for this long after bounded.sh wrote the meta.
start_grace=30
timeout= ids=() deadline=
while (( $# )); do
  case $1 in
    --timeout) timeout=${2:?seconds}; shift ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) ids+=("$1") ;;
  esac; shift
done
(( ${#ids[@]} )) || { echo "usage: await.sh <id>... [--timeout <seconds>]" >&2; exit 2; }
for id in "${ids[@]}"; do
  [[ -f $orch/bounded/$id/meta ]] && continue
  if compgen -G "$orch/bounded/$id-*/meta" > /dev/null; then
    echo "$id is a bounded.sh label; wait on the invocation id bounded.sh printed (id: ...)" >&2
  else
    echo "no such run: $id ($orch/bounded/$id)" >&2
  fi
  exit 2
done

# meta <file> <key>: one value from a key=value file. Like receipt_field, sed
# quits on the first match: piped into head, a long run of matches fails with
# SIGPIPE (141) under pipefail.
meta() { sed -n "/^$2=/{s///p;q;}" "$1"; }
# receipt_field <file> <key>: one value from a receipt bounded.sh's unit wrote.
receipt_field() { sed -n "/^ *\"$2\": *\"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\}$/{s//\1/p;q;}" "$1"; }

# from_receipt <id>: the finished line from the run's receipt, if it has one.
from_receipt() {
  local dir=$orch/bounded/$1
  [[ -f $dir/receipt.json ]] || return 1
  echo "$1 $(receipt_field "$dir/receipt.json" exitCode) $(meta "$dir/meta" log) $(receipt_field "$dir/receipt.json" outcome)"
}

# query_limit: seconds one systemd query may take: the time left before the
# deadline, at most 30, so a manager that never answers can't hold the wait
# past its timeout. Fails once the deadline has passed: then nothing more is
# asked, however many ids are left (#759).
query_limit() {
  local limit=30
  [[ -n $deadline ]] && limit=$(( deadline - $(date +%s) ))
  (( limit > 30 )) && limit=30
  (( limit >= 1 )) && echo "$limit"
}

# unit_state <unit>: systemd's key=value lines for the unit; fails when the
# user manager can't be asked or doesn't answer in time.
unit_state() {
  local state limit
  limit=$(query_limit) || return 1
  state=$(timeout -k 1 "$limit" "$systemctl" --user show "$1.service" -p LoadState -p ActiveState -p Result -p ExecMainCode -p ExecMainStatus 2> /dev/null) || return 1
  [[ -n $state ]] && echo "$state"
}

# from_unit <id>: without a receipt, the finished line from the unit's
# systemd state. Prints nothing while the unit runs, is still starting, the
# user manager doesn't answer, or the deadline has passed.
from_unit() {
  local dir=$orch/bounded/$1 unit state exit outcome
  query_limit > /dev/null || return 0
  unit=$(meta "$dir/meta" unit)
  state=$(unit_state "$unit") || { echo "can't ask systemd about $unit; still waiting" >&2; return; }
  if [[ $(meta <(echo "$state") LoadState) != loaded ]]; then
    (( $(date +%s) - $(stat -c %Y "$dir/meta") < start_grace )) && return
    echo "no receipt for $1 and unit $unit is gone" >&2
    echo "$1 lost $(meta "$dir/meta" log)"; return
  fi
  [[ $(meta <(echo "$state") ActiveState) =~ ^(inactive|failed)$ ]] || return
  echo "no receipt for $1; from unit $unit (Result=$(meta <(echo "$state") Result))" >&2
  read -r exit outcome < <(classify_unit "$state" "$(cat "$dir/hint" 2> /dev/null)")
  echo "$1 $exit $(meta "$dir/meta" log) $outcome"
}

# classify_unit <state> <hint>: "<exit code> <outcome>" for a stopped unit,
# through the receipts' own classifier, with the inner wrapper's hint
# (bounded/<id>/hint: lockRefused, killed), so a cancelled run is never ok.
classify_unit() {
  local code
  case $(meta <(echo "$1") ExecMainCode) in 1) code=exited ;; 2) code=killed ;; 3) code=dumped ;; *) code= ;; esac
  bounded_outcome "$(meta <(echo "$1") Result)" "$code" "$(meta <(echo "$1") ExecMainStatus)" "$2"
}

deadline=${timeout:+$(( $(date +%s) + timeout ))}
while :; do
  found=0
  for id in "${ids[@]}"; do
    line=$(from_receipt "$id" || from_unit "$id")
    [[ -n $line ]] && { echo "$line"; found=1; }
  done
  (( found )) && exit 0
  if [[ -n $deadline ]] && (( $(date +%s) >= deadline )); then
    echo "still running: ${ids[*]}"
    exit 124
  fi
  sleep "$interval"
done
