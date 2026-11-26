#!/usr/bin/env bash
# usage: bounded-outcome.test.sh — checks bounded_outcome (bounded-outcome.sh),
# the one classifier behind bounded.sh's receipts and await.sh's systemd
# fallback, against the states systemd reports.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/bounded-outcome.sh"
fail=0
# expect <want> <result> <code> <status> [hint]
expect() {
  local want=$1 got; shift
  got=$(bounded_outcome "$@")
  if [[ $got == "$want" ]]; then echo "ok    $want: $*"; else echo "FAIL  want '$want', got '$got': $*"; fail=1; fi
}
expect "0 ok"               success exited 0
expect "3 failed"           exit-code exited 3
expect "137 oom"            oom-kill killed KILL
expect "137 oom"            oom-kill killed 9
expect "73 lockRefused"     exit-code exited 73 lockRefused
expect "73 failed"          exit-code exited 73
# An orderly stop: systemd counts SIGTERM as success, but the job didn't finish.
expect "143 killed"         success killed TERM
expect "143 killed"         success killed 15
expect "143 killed"         exit-code exited 143 killed
expect "130 killed"         signal killed INT
expect "134 killed"         core-dump dumped ABRT
expect "0 killed"           timeout exited 0
expect "null submitFailed"  submit-failed "" ""
expect "null failed"        "" "" ""
exit $fail
