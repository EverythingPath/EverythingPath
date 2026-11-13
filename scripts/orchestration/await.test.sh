#!/usr/bin/env bash
# usage: await.test.sh — checks await.sh on bounded runs (bounded.sh invocation
# ids): the receipt, the systemd fallback when the receipt is missing, label
# refusal, no stale-label reads, no retired spawn.sh run ids and a waiter
# whose caller's shell dies. Uses a
# scratch EP_ORCH under run_tmp (<repo parent>/.ep-tmp, so it also runs on a CI
# runner, which has no $EP_ORCH) and a stub systemctl; no real unit.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
run_tmp await-test || exit 1
dir=$run_tmp
trap 'rm -rf "$dir"' EXIT
mkdir -p "$dir/orch/bounded" "$dir/units" "$dir/bin"
# Stub systemctl: `systemctl --user show <unit> -p ...` prints units/<unit>,
# or a not-found unit; a units/<unit> that says "fail" is an unreachable
# manager, and one that says "hang" never answers.
cat > "$dir/bin/systemctl" <<STUB
#!/usr/bin/env bash
for a; do [[ \$a == *.service || \$a == ep-* ]] && unit=\${a%.service}; done
if [[ \$(cat "$dir/units/\$unit" 2> /dev/null) == fail ]]; then echo "Failed to connect to bus" >&2; exit 1; fi
[[ \$(cat "$dir/units/\$unit" 2> /dev/null) == hang ]] && exec sleep 600
if [[ -f $dir/units/\$unit ]]; then cat "$dir/units/\$unit"; else printf 'LoadState=not-found\nActiveState=inactive\nResult=success\nExecMainCode=0\nExecMainStatus=0\n'; fi
STUB
chmod +x "$dir/bin/systemctl"
export EP_ORCH=$dir/orch AWAIT_SYSTEMCTL=$dir/bin/systemctl AWAIT_INTERVAL=1
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
# invocation <id> <label> [age in seconds]: writes the meta bounded.sh writes.
invocation() {
  mkdir -p "$dir/orch/bounded/$1"
  printf 'label=%s\nid=%s\nunit=ep-fresh-%s\nkind=command\nlog=%s\nstartedAt=%s\n' \
    "$2" "$1" "$1" "$dir/$1.log" "$(date -u -d "@$(( $(date +%s) - ${3:-0} ))" +%FT%TZ)" > "$dir/orch/bounded/$1/meta"
  touch -d "@$(( $(date +%s) - ${3:-0} ))" "$dir/orch/bounded/$1/meta"
}
# receipt <id> <exit code> <outcome>: writes the receipt the unit writes.
receipt() {
  printf '{\n  "label": "x",\n  "id": "%s",\n  "unit": "ep-fresh-%s",\n  "exitCode": %s,\n  "startedAt": "2026-10-18T10:00:00Z",\n  "endedAt": "2026-10-18T10:01:00Z",\n  "outcome": "%s",\n  "log": "%s"\n}\n' \
    "$1" "$1" "$2" "$3" "$dir/$1.log" > "$dir/orch/bounded/$1/receipt.json"
}
unit() { printf 'LoadState=loaded\nActiveState=%s\nResult=%s\nExecMainCode=%s\nExecMainStatus=%s\n' "$2" "$3" "$4" "$5" > "$dir/units/ep-fresh-$1"; }

invocation lbl-20261018-100000-aaaaaa lbl; receipt lbl-20261018-100000-aaaaaa 0 ok
check "a receipt finishes the wait" "$("$here/await.sh" lbl-20261018-100000-aaaaaa --timeout 5)" "lbl-20261018-100000-aaaaaa 0 $dir/lbl-20261018-100000-aaaaaa.log ok"

invocation lbl-20261018-100000-bbbbbb lbl; receipt lbl-20261018-100000-bbbbbb 73 lockRefused
check "a lock refusal has a receipt" "$("$here/await.sh" lbl-20261018-100000-bbbbbb --timeout 5 | cut -d' ' -f2,4)" "73 lockRefused"

# The same label runs again; the earlier receipts must not answer for it.
invocation lbl-20261018-110000-cccccc lbl; unit lbl-20261018-110000-cccccc active "" 0 0
out=$("$here/await.sh" lbl-20261018-110000-cccccc --timeout 2); status=$?
check "a running invocation isn't answered by an earlier one with its label" "$status $out" "124 still running: lbl-20261018-110000-cccccc"
"$here/await.sh" lbl --timeout 2 > "$dir/label.out" 2>&1; status=$?
check "a label alone is refused" "$status $(grep -c 'invocation id' "$dir/label.out")" "2 1"

# No receipt: the unit's systemd state decides.
invocation oom-20261018-100000-dddddd oom; unit oom-20261018-100000-dddddd failed oom-kill 2 9
check "no receipt: an OOM-killed unit" "$("$here/await.sh" oom-20261018-100000-dddddd --timeout 5 2> /dev/null)" "oom-20261018-100000-dddddd 137 $dir/oom-20261018-100000-dddddd.log oom"
invocation bad-20261018-100000-eeeeee bad; unit bad-20261018-100000-eeeeee failed exit-code 1 3
check "no receipt: a failed unit" "$("$here/await.sh" bad-20261018-100000-eeeeee --timeout 5 2> /dev/null | cut -d' ' -f2,4)" "3 failed"
invocation stop-20261018-100000-333333 stop; unit stop-20261018-100000-333333 inactive success 2 15
check "no receipt: a SIGTERM-stopped unit is killed, never ok" "$("$here/await.sh" stop-20261018-100000-333333 --timeout 5 2> /dev/null | cut -d' ' -f2,4)" "143 killed"
invocation nobus-20261018-100000-444444 nobus 120; printf 'fail\n' > "$dir/units/ep-fresh-nobus-20261018-100000-444444"
out=$("$here/await.sh" nobus-20261018-100000-444444 --timeout 2 2> /dev/null); status=$?
check "no receipt and no answer from the user manager: keeps waiting, not lost" "$status" 124
invocation hang-20261018-100000-555555 hang 120; printf 'hang\n' > "$dir/units/ep-fresh-hang-20261018-100000-555555"
t0=$(date +%s); out=$("$here/await.sh" hang-20261018-100000-555555 --timeout 3 2> /dev/null); status=$?
check "a systemctl that never answers can't outlast the timeout" "$status $(( $(date +%s) - t0 <= 6 ))" "124 1"
# Several hanging units: once the deadline passes, no further unit is queried
# (#759; before, each remaining id cost one more second past the timeout).
hung=()
for i in 1 2 3 4 5; do
  invocation "hang$i-20261018-100000-55555$i" "hang$i" 120; printf 'hang\n' > "$dir/units/ep-fresh-hang$i-20261018-100000-55555$i"
  hung+=("hang$i-20261018-100000-55555$i")
done
t0=$(date +%s); out=$("$here/await.sh" "${hung[@]}" --timeout 3 2> /dev/null); status=$?; took=$(( $(date +%s) - t0 ))
check "five hanging units still end at the timeout (took ${took}s)" "$status $(( took <= 5 ))" "124 1"
# No receipt, but the wrapper's hint says the run was cancelled: never ok.
invocation qcancel-20261018-100000-666666 qcancel; unit qcancel-20261018-100000-666666 failed exit-code 1 143
echo killed > "$dir/orch/bounded/qcancel-20261018-100000-666666/hint"
check "no receipt: a cancelled queued run is killed" "$("$here/await.sh" qcancel-20261018-100000-666666 --timeout 5 2> /dev/null | cut -d' ' -f2,4)" "143 killed"
invocation trap0-20261018-100000-777777 trap0; unit trap0-20261018-100000-777777 inactive success 1 0
echo killed > "$dir/orch/bounded/trap0-20261018-100000-777777/hint"
check "no receipt: a cancelled command that exits 0 on TERM is killed, not ok" "$("$here/await.sh" trap0-20261018-100000-777777 --timeout 5 2> /dev/null | cut -d' ' -f2,4)" "0 killed"
invocation gone-20261018-100000-ffffff gone 120
check "no receipt and no unit: lost" "$("$here/await.sh" gone-20261018-100000-ffffff --timeout 5 2> /dev/null)" "gone-20261018-100000-ffffff lost $dir/gone-20261018-100000-ffffff.log"
invocation new-20261018-100000-111111 new
out=$("$here/await.sh" new-20261018-100000-111111 --timeout 2 2> /dev/null); status=$?
check "a just-started invocation whose unit isn't up yet keeps waiting" "$status" 124

# A finished run of the retired spawn.sh is no run await.sh waits on.
mkdir -p "$dir/orch/runs/reviewer-20261021-185053-519851"
printf 'id=reviewer-20261021-185053-519851\nrole=reviewer\n' > "$dir/orch/runs/reviewer-20261021-185053-519851/meta"
echo 0 > "$dir/orch/runs/reviewer-20261021-185053-519851/exit"
out=$("$here/await.sh" reviewer-20261021-185053-519851 --timeout 2 2>&1); status=$?
check "a spawn.sh run id is refused" "$status $out" "2 no such run: reviewer-20261021-185053-519851 ($dir/orch/bounded/reviewer-20261021-185053-519851)"

# The waiter outlives the shell that started it, and the receipt still arrives.
invocation late-20261018-100000-222222 late; unit late-20261018-100000-222222 active "" 0 0
{ bash -c 'setsid "$1" late-20261018-100000-222222 --timeout 20 > "$2" 2>&1 < /dev/null & kill -KILL $$' _ \
  "$here/await.sh" "$dir/late.out"; } 2> /dev/null
sleep 2
receipt late-20261018-100000-222222 0 ok
for _ in $(seq 20); do [[ -s $dir/late.out ]] && break; sleep 1; done
check "a waiter whose caller's shell died still reports" "$(cat "$dir/late.out")" "late-20261018-100000-222222 0 $dir/late-20261018-100000-222222.log ok"
exit $fail
