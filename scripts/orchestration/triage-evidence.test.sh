#!/usr/bin/env bash
# Complete triage CLI with dummy suite/diagnostics: retain original JSON after TMPDIR cleanup.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(mktemp -d "${TMPDIR:?}/triage-evidence-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
mkdir -p "$root/main" "$root/bin" "$root/orch/logs"
git -C "$root/main" init -qb feature/pf1-character-builder
git -C "$root/main" -c user.name=Test -c user.email=test@example.test commit --allow-empty -qm base
echo sample > "$root/main/sample.test.ts"
git -C "$root/main" add -A
git -C "$root/main" -c user.name=Test -c user.email=test@example.test commit -qm sample
cat > "$root/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
[[ $1 != install ]] || exit 0
for arg in "$@"; do
  case $arg in --outputFile.json=*|--outputFile=*) out=${arg#*=} ;; esac
done
if [[ $1 == test ]]; then
  printf '{"success":false,"numFailedTests":1,"numFailedTestSuites":1,"testResults":[{"name":"%s/sample.test.ts","status":"failed","assertionResults":[{"fullName":"a works","status":"failed","duration":100}]}]}' "$PWD" > "$out"
  exit 1
fi
printf '{"testResults":[{"assertionResults":[{"fullName":"a works","status":"passed","duration":100}]}]}' > "$out"
STUB
chmod +x "$root/bin/pnpm"
MAIN="$root/main" EP_ORCH="$root/orch" PATH="$root/bin:$PATH" TRIAGE_EVIDENCE="$root/evidence" \
  bash "$here/triage-failures.sh" "$root/main" > "$root/out" 2>&1 || { cat "$root/out"; exit 1; }
grep -q '^LOAD' "$root/out"
for report in full b1 h1; do [[ -s $root/evidence/$report.json ]] || { cat "$root/out"; echo "FAIL original $report.json was discarded"; exit 1; }; done
echo 'ok    original failed suite and both diagnostic reports survive triage cleanup; legacy LOAD diagnostics preserved'

# The local suite report is judged only once its writer has finished (regen-carry fix r2, review r2 standards #1):
# Vitest writes full.json in place, and the monitor re-runs authorization while the suite runs. Held half-written, by
# the suite or by the copy of a given report, the gate neither stops (an authorization does not read the report:
# gate_core.carried_checks judges it in cur-land.sh after the suite and at collection) nor passes (the collector
# refuses it by name); written whole, the check passes. A suite that dies mid-write fails triage, and the collector
# refuses its report by name rather than crashing on it.
check='tests/catalog/launch-verification-inputs.test.ts > launchVerificationBinding fingerprints the committed reviewed admission in the committed projection'
mkdir -p "$root/main/tests/catalog"
echo 'it()' > "$root/main/tests/catalog/launch-verification-inputs.test.ts"
git -C "$root/main" add -A
git -C "$root/main" -c user.name=Test -c user.email=test@example.test commit -qm 'the derived check'
cat > "$root/bin/report.py" << 'PY'
import json, sys
root, check = sys.argv[1:]
file, name = check.split(' > ', 1)
describe, _, title = name.partition(' ')
tests = [(file, describe, title), ('sample.test.ts', 'a', 'works')]
print(json.dumps(dict(success=True, numTotalTestSuites=2, numPassedTestSuites=2, numFailedTestSuites=0, numPendingTestSuites=0,
                      numTotalTests=2, numPassedTests=2, numFailedTests=0, numPendingTests=0, numTodoTests=0, startTime=0,
                      testResults=[dict(name=root + '/' + path, status='passed', assertionResults=[dict(
                          ancestorTitles=[describe], title=title, fullName=describe + ' ' + title, status='passed', failureMessages=[])])
                                   for path, describe, title in tests])))
PY
# hold <out> <text>: write the first half of TEXT to OUT, then wait (bounded) for $root/release, then the rest; with
# HOLD_DIE=1, exit 1 after the first half.
cat > "$root/bin/hold.sh" << 'SH'
#!/usr/bin/env bash
out=$1 text=$2 half=$(( ${#2} / 2 ))
printf '%s' "${text:0:half}" > "$out"
: > "$HOLD_ROOT/held"
[[ -z ${HOLD_DIE:-} ]] || exit 1
for _ in $(seq 600); do [[ -e $HOLD_ROOT/release ]] && break; sleep 0.1; done
printf '%s' "${text:half}" >> "$out"
SH
chmod +x "$root/bin/hold.sh"
cat > "$root/bin/pnpm" << 'STUB'
#!/usr/bin/env bash
[[ $1 != install ]] || exit 0
for arg in "$@"; do
  case $arg in --outputFile.json=*|--outputFile=*) out=${arg#*=} ;; esac
done
exec "$HOLD_ROOT/bin/hold.sh" "$out" "$(python3 -B "$HOLD_ROOT/bin/report.py" "$PWD" "$HOLD_CHECK")"
STUB
# The given report's copy is held as the suite's write is: a cp into the evidence directory writes half, then waits.
mkdir "$root/cpbin"
cat > "$root/cpbin/cp" << 'STUB'
#!/usr/bin/env bash
for last; do :; done
[[ $last != */triage-evidence/* ]] || exec "$HOLD_ROOT/bin/hold.sh" "$last" "$(cat "$1")"
exec /bin/cp "$@"
STUB
chmod +x "$root/cpbin/cp"
# gate <mode>: carried_checks at an authorization while the suite runs (mode early) and at collection (mode ran),
# printing the checks or the refusal.
gate() {
  python3 -B - "$here" "$root/main" "$1" "$attempt" "$check" << 'PY'
import sys
sys.path.insert(0, sys.argv[1])
import gate_core
wt, mode, attempt, check = sys.argv[2:]
v = dict(WT=wt, REVIEWED=gate_core.git(wt, 'rev-parse', 'HEAD'), E=attempt)
config = dict(rebaseProof=dict(regen=dict(derived=[dict(field='binding.gate.reviewedInputsFingerprint', check=check)])))
try:
    print('checks', len(gate_core.carried_checks(v, config, ran=mode == 'ran')))
except RuntimeError as error:
    print('refused', error)
PY
}
# held <label> [given report]: triage held mid-write; the gate neither stops nor passes; released, it passes.
held() {
  attempt=$root/attempt-$1; mkdir "$attempt"; rm -f "$root/held" "$root/release"
  local extra=() path=$PATH
  [[ -z ${2:-} ]] || { extra=("$2"); path=$root/cpbin:$PATH; }
  MAIN="$root/main" EP_ORCH="$root/orch" PATH="$root/bin:$path" TRIAGE_EVIDENCE="$attempt/triage-evidence" HOLD_ROOT=$root HOLD_CHECK=$check \
    bash "$here/triage-failures.sh" "$root/main" "${extra[@]}" > "$root/out-$1" 2>&1 &
  local triage=$! waited=0
  until [[ -e $root/held ]]; do (( waited++ < 600 )) || { kill $triage; echo "FAIL $1: the writer never started"; exit 1; }; sleep 0.1; done
  local early ran
  early=$(gate early 2>&1 || true) ran=$(gate ran 2>&1 || true)
  [[ $early == 'checks 1' ]] || { touch "$root/release"; wait $triage; echo "FAIL $1: an authorization while the report is half-written stops the gate: $early"; exit 1; }
  [[ $ran == "refused Regenerated rebase proof: the local suite report $attempt/triage-evidence/full.json is not a whole Vitest JSON report" ]] \
    || { touch "$root/release"; wait $triage; echo "FAIL $1: the collector does not refuse a half-written report: $ran"; exit 1; }
  touch "$root/release"
  wait $triage || { cat "$root/out-$1"; echo "FAIL $1: triage failed"; exit 1; }
  grep -qx 'all green' "$root/out-$1" || { cat "$root/out-$1"; echo "FAIL $1: not all green"; exit 1; }
  [[ $(gate ran 2>&1 || true) == 'checks 1' && $(ls "$attempt/triage-evidence" | grep -c '^full\.json') == 1 ]] \
    || { ls "$attempt/triage-evidence"; echo "FAIL $1: the whole report does not pass: $(gate ran 2>&1 || true)"; exit 1; }
}
held suite
echo 'ok    a local suite report held half-written by Vitest neither stops nor passes the gate; once whole it passes'
python3 -B "$root/bin/report.py" "$root/main" "$check" > "$root/given.json"
held given "$root/given.json"
echo 'ok    a given report held half-copied into the evidence directory neither stops nor passes the gate; once whole it passes'
attempt=$root/attempt-died; mkdir "$attempt"; rm -f "$root/held" "$root/release"
if MAIN="$root/main" EP_ORCH="$root/orch" PATH="$root/bin:$PATH" TRIAGE_EVIDENCE="$attempt/triage-evidence" HOLD_ROOT=$root HOLD_CHECK=$check HOLD_DIE=1 \
    bash "$here/triage-failures.sh" "$root/main" > "$root/out-died" 2>&1; then
  echo "FAIL a suite that died mid-write passed triage"; exit 1
fi
[[ $(gate ran 2>&1 || true) == "refused Regenerated rebase proof: the local suite report $attempt/triage-evidence/full.json is not a whole Vitest JSON report" ]] \
  || { echo "FAIL the collector does not refuse a report its suite died writing: $(gate ran 2>&1 || true)"; exit 1; }
echo 'ok    a suite that dies mid-write fails triage, and the gate refuses its report by name'
