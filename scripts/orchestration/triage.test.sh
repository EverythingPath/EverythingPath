#!/usr/bin/env bash
# usage: triage.test.sh — checks triage-failures.sh's report reading (triage-lib.sh):
# a failed suite must never pass on a missing, malformed or failure-free report.
# Scratch files go under run_tmp (<repo parent>/.ep-tmp, never /tmp), so it also
# runs on a CI runner, which has no $EP_ORCH.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/triage-lib.sh"
run_tmp triage-test || exit 1
dir=$run_tmp
trap 'rm -rf "$dir"' EXIT
fail=0
# expect <want: ok|fail> <suite status> <label> <report json, or - for none>
expect() {
  local want=$1 status=$2 label=$3 got=ok out
  rm -f "$dir/r.json"; [[ $4 == - ]] || printf '%s' "$4" > "$dir/r.json"
  out=$(failed_tests "$dir/r.json" "$status" 2>&1) || got=fail
  if [[ $got == "$want" ]]; then echo "ok    $want: $label"; else echo "FAIL  want $want, got $got: $label ($out)"; fail=1; fi
}
green='{"success":true,"numFailedTests":0,"numFailedTestSuites":0,"testResults":[{"name":"/w/a.test.ts","status":"passed","assertionResults":[{"fullName":"a works","status":"passed"}]}]}'
red='{"success":false,"numFailedTests":1,"numFailedTestSuites":1,"testResults":[{"name":"/w/a.test.ts","status":"failed","assertionResults":[{"fullName":"a works","status":"failed"}]}]}'
hidden='{"success":false,"numFailedTests":0,"numFailedTestSuites":1,"testResults":[]}'
expect ok   0 "green report, suite 0" "$green"
expect ok   1 "red report lists its failure" "$red"
expect fail 1 "malformed report, suite 1" '{"testResults": [ {"name": '
expect fail 0 "malformed report, suite 0" 'not json'
expect fail 1 "missing report" -
expect fail 1 "empty report" ''
expect fail 1 "suite failed but the report lists no failure" "$green"
expect fail 0 "report says failed but lists no failure" "$hidden"
expect fail 0 "report without testResults" '{"success":true}'
printf '%s' "$red" > "$dir/red.json"
[[ $(failed_tests "$dir/red.json" 1) == $'/w/a.test.ts\ta works' ]] || { echo "FAIL  red report's failure line"; fail=1; }
exit $fail
