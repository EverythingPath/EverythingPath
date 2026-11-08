#!/usr/bin/env bash
# usage: e2e-branch.test.sh — checks e2e-branch.sh with a stub pnpm (no browser,
# deployment or Clerk call): --backend/--workers/--budget-minutes/--suite/--group/--journey/--reuse/--discard-prepared passthrough
# and validation, the admin key leftover check, and that finish runs stop → wait and reap → finalize → copy →
# delete, so no late write re-creates e2e-artifacts. Scratch in
# <repo parent>/.ep-tmp. E2E_BRANCH overrides the script under test.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
script=${E2E_BRANCH:-$here/e2e-branch.sh}
mkdir -p "$repos/.ep-tmp"
dir=$(mktemp -d "$repos/.ep-tmp/e2e-branch-test-XXXXXX") || exit 1
cleanup() {
  for f in stuck.pid deaf.pid respawner.pid; do [[ -f $dir/$f ]] && kill -KILL "$(cat "$dir/$f")" 2>/dev/null; done
  rm -rf "$dir"
}
trap cleanup EXIT
wt=$dir/wt
mkdir -p "$dir/main" "$dir/bin" "$dir/logs" "$wt"
git -C "$wt" init -q -b feature
git -C "$wt" config user.email test@example.test; git -C "$wt" config user.name test
mkdir -p "$wt/e2e" "$wt/src"; echo keep > "$wt/e2e/keep.ts"
git -C "$wt" add -A; git -C "$wt" commit -qm base
git -C "$wt" checkout -qb impl; echo change > "$wt/src/app.ts"
git -C "$wt" add -A; git -C "$wt" commit -qm change

# The stub runs where the runner would (the worktree), records its arguments
# and the process marker, and writes evidence the way the runner does. $dir/mode:
#   ok      a complete passing run
#   reused  a passing run on a reused prepared environment (#754): exit 5
#   late    exits leaving an unfinished checkpoint and a detached process that
#           writes stages.log a second later (run 1's dying server)
#   stuck   exits leaving a detached process that ignores SIGTERM
#   signal  runs until interrupted; records the signals it receives
#   deaf    runs until killed, ignoring SIGINT and SIGTERM
#   survivor  exits leaving a respawner (unmarked itself) that keeps starting
#           marked processes, so reaping can never finish
cat > "$dir/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
dir=$(cd "$(dirname "$0")/.." && pwd)
printf '%s\n' "$@" > "$dir/args"
echo "${E2E_PROCESS_TOKEN:-none}" > "$dir/token"
echo "$TMPDIR" > "$dir/tmpdir"
run=$PWD/e2e-artifacts/e2e-local-test-slot-0/everythingpath-e2e-test
mkdir -p "$run"
planned='[{"id":"a","project":"chromium-tablet","file":"x.spec.ts","title":"first"},{"id":"b","project":"chromium-tablet","file":"x.spec.ts","title":"second"},{"id":"c","project":"chromium-tablet","file":"x.spec.ts","title":"third"}]'
checkpoint() {
  echo "{\"status\":\"$1\",\"errors\":0,\"planned\":$planned,\"started\":[{\"id\":\"a\",\"retry\":0},{\"id\":\"b\",\"retry\":0}],\"evidence\":[{\"testId\":\"a\",\"retry\":0,\"status\":\"passed\"}]$2}" > "$run/progress.json"
}
echo "preview deployment and web build: passed" > "$run/stages.log"
case $(cat "$dir/mode") in
  reused)
    # A passing --reuse run on a reused preparation (#754): marked, exit 5.
    echo '{"status":"finished","preparation":"reused","errors":0,"planned":[],"started":[],"evidence":[]}' > "$run/progress.json"
    echo '{"status":"passed","preparation":"reused","tests":[{"project":"chromium-tablet","title":"first","results":[{"status":"passed","retry":0}]}]}' > "$run/report.json"
    exit 5 ;;
  scoped)
    # A complete mandatory run that records its scope, as the reporter does.
    checkpoint finished ''
    echo '{"status":"passed","suite":{"kind":"routine","mandatory":true,"live":false,"groups":[]},"tests":['"$(for i in 1 2 3 4 5 6 7; do printf '%s{"project":"mandatory","title":"t%s","results":[{"status":"passed","retry":0}]}' "$([[ $i == 1 ]] || echo ,)" "$i"; done)"']}' > "$run/report.json"
    exit 0 ;;
  key)
    # A release run whose admin key file escaped into the worktree.
    echo secret > "$PWD/release-admin.key"
    checkpoint finished ''
    exit 0 ;;
  ok)
    # The release runner keeps its admin key file under TMPDIR.
    echo secret > "$TMPDIR/release-admin.key"
    checkpoint finished ''
    echo '{"status":"passed","tests":[{"project":"chromium-tablet","title":"first","results":[{"status":"passed","retry":0}]}]}' > "$run/report.json"
    exit 0 ;;
  late)
    checkpoint running ''
    setsid bash -c 'touch "$2"; sleep 1; echo "production application server: failed" >> "$1/stages.log"' _ "$run" "$dir/late.started" </dev/null >/dev/null 2>&1 &
    until [[ -e $dir/late.started ]]; do sleep 0.02; done
    exit 1 ;;
  stuck)
    checkpoint running ''
    setsid bash -c 'trap "" TERM; echo $$ > "$1"; while :; do sleep 0.2; done' _ "$dir/stuck.pid" </dev/null >/dev/null 2>&1 &
    until [[ -s $dir/stuck.pid ]]; do sleep 0.02; done
    exit 1 ;;
  signal)
    checkpoint running ''
    trap 'echo INT >> "$dir/signals"; checkpoint interrupted ",\"completed\":[{\"project\":\"chromium-tablet\",\"title\":\"first\",\"status\":\"passed\"}],\"interrupted\":[{\"project\":\"chromium-tablet\",\"title\":\"second\"}],\"unstarted\":[{\"project\":\"chromium-tablet\",\"title\":\"third\"}]"; exit 130' INT
    trap 'echo TERM >> "$dir/signals"; exit 143' TERM
    touch "$dir/ready"
    while :; do sleep 0.1; done ;;
  survivor)
    checkpoint running ''
    setsid env -u E2E_PROCESS_TOKEN MARK="$E2E_PROCESS_TOKEN" bash -c 'E2E_PROCESS_TOKEN=$MARK sleep 0.3 & echo $$ > "$1"; while :; do E2E_PROCESS_TOKEN=$MARK sleep 0.3 & sleep 0.05; done' _ "$dir/respawner.pid" </dev/null >/dev/null 2>&1 &
    # Exits only once a marked process is running.
    until [[ -s $dir/respawner.pid ]]; do sleep 0.02; done
    exit 1 ;;
  deaf)
    checkpoint running ''
    trap '' INT TERM
    echo $$ > "$dir/deaf.pid"; touch "$dir/ready"
    while :; do sleep 0.1; done ;;
esac
STUB
chmod +x "$dir/bin/pnpm"

fail=0
check() { if eval "$2"; then echo "ok    $1"; else echo "FAIL  $1"; cat "$dir/out"; fail=1; fi; }
gate=(env MAIN="$dir/main" E2E_LOGS="$dir/logs" FEATURE=feature PATH="$dir/bin:$PATH" E2E_REAP_GRACE=1 E2E_STOP_GRACE=1 "$script" "$wt" --resources /r.json --secrets /s.env)
gate() { "${gate[@]}" "$@"; }
start() { rm -rf "$dir/args" "$dir/tmpdir" "$dir/deaf.pid" "$dir/late.started" "$dir/token" "$dir/signals" "$dir/ready" "$dir/logs"/*; echo "$1" > "$dir/mode"; }
clean() { [[ ! -e $wt/e2e-artifacts && ! -e $wt/e2e/.private ]]; }
copied() { find "$dir/logs" -path "*/e2e-local-test-slot-0/*/$1" | head -1; }

for bad in "--workers 0" "--workers two" "--workers" "--budget-minutes 40m" "--budget-minutes -5" "--budget-minutes" "--suite routine" "--suite" "--group" "--group Sheet" "--journey" "--journey --suite" "--backend cloud" "--backend"; do
  start ok; gate $bad > "$dir/out" 2>&1; rc=$?
  check "refuses $bad before any work" '(( rc == 1 )) && grep -q refusing "$dir/out" && [[ ! -e $dir/args ]] && clean'
done

start ok; gate --workers 2 --budget-minutes 40 > "$dir/out" 2>&1; rc=$?
check "passes --workers and --budget-minutes to the runner" '(( rc == 0 )) && [[ $(tr "\n" " " < "$dir/args") == "test:e2e --resources /r.json --secrets /s.env --workers 2 --budget-minutes 40 " ]]'
check "marks the run's processes" '[[ $(cat "$dir/token") =~ ^[0-9a-f]{24}$ ]]'
check "prints Playwright's result and cleans up" 'grep -qx "e2e: passed: 1 journeys passed, 0 failed" "$dir/out" && clean'
check "removes the run's TMPDIR, with any admin key file in it" '[[ $(cat "$dir/tmpdir") == */.ep-tmp/e2e-* && ! -e $(cat "$dir/tmpdir") ]]'

start ok; gate --suite release > "$dir/out" 2>&1; rc=$?
check "passes --suite release to the runner" '(( rc == 0 )) && [[ $(tr "\n" " " < "$dir/args") == "test:e2e --resources /r.json --secrets /s.env --suite release " ]] && clean'

start ok; gate --suite mandatory --suite focused --group week-activity --group shell --suite live > "$dir/out" 2>&1; rc=$?
check "passes suites and focused groups to the runner in order" '(( rc == 0 )) && [[ $(tr "\n" " " < "$dir/args") == "test:e2e --resources /r.json --secrets /s.env --suite mandatory --suite focused --group week-activity --group shell --suite live " ]] && clean'

start ok; gate --journey "players share a Staged Action Choice" > "$dir/out" 2>&1; rc=$?
check "passes a journey title to the runner as one argument" '(( rc == 0 )) && [[ $(sed -n 7p "$dir/args") == "players share a Staged Action Choice" && $(sed -n 6p "$dir/args") == --journey ]] && clean'

start ok; gate --suite nightly --journey access.spec.ts > "$dir/out" 2>&1; rc=$?
check "passes --suite nightly with a journey to the runner" '(( rc == 0 )) && [[ $(tr "\n" " " < "$dir/args") == "test:e2e --resources /r.json --secrets /s.env --suite nightly --journey access.spec.ts " ]] && clean'

start ok; gate --backend local --suite focused --group week-activity > "$dir/out" 2>&1; rc=$?
check "passes --backend local with a suite and group to the runner" '(( rc == 0 )) && [[ $(tr "\n" " " < "$dir/args") == "test:e2e --resources /r.json --secrets /s.env --backend local --suite focused --group week-activity " ]] && clean'

start ok; gate --backend local --journey "players share a Staged Action Choice" > "$dir/out" 2>&1; rc=$?
check "passes --backend local with a journey title to the runner" '(( rc == 0 )) && [[ $(sed -n 6,8p "$dir/args" | tr "\n" " ") == "--backend local --journey " && $(sed -n 9p "$dir/args") == "players share a Staged Action Choice" ]] && clean'

start reused; gate --backend local --journey access.spec.ts --reuse > "$dir/out" 2>&1; rc=$?
check "passes --reuse to the runner" '[[ $(tr "\n" " " < "$dir/args") == "test:e2e --resources /r.json --secrets /s.env --backend local --journey access.spec.ts --reuse " ]] && clean'
check "a pass on a reused preparation exits 5, never 0, and says it does not qualify" '(( rc == 5 )) && grep -qx "e2e: passed: 1 journeys passed, 0 failed; preparation: reused (diagnostic, not qualifying)" "$dir/out" && grep -q "not a gate result" "$dir/out"'

start ok; gate --backend local --discard-prepared > "$dir/out" 2>&1; rc=$?
check "passes --discard-prepared to the runner" '(( rc == 0 )) && [[ $(tr "\n" " " < "$dir/args") == "test:e2e --resources /r.json --secrets /s.env --backend local --discard-prepared " ]] && clean'

start scoped; gate > "$dir/out" 2>&1; rc=$?
check "prints the scope the run recorded" 'grep -qx "e2e: passed: 7 journeys passed, 0 failed; scope: mandatory, 7 required results" "$dir/out" && clean'

start key; gate --suite release > "$dir/out" 2>&1; rc=$?
check "fails loudly on an admin key file left in the worktree" '(( rc == 3 )) && grep -q "cleanup FAILED" "$dir/out" && grep -q "release-admin.key" "$dir/out"'
rm -f "$wt/release-admin.key"

start late; gate > "$dir/out" 2>&1; rc=$?; sleep 1.5
check "waits for a late writer, then copies and deletes" '(( rc == 1 )) && clean && grep -qx "production application server: failed" "$(copied stages.log)"'
check "finalizes and prints an unfinished checkpoint" 'grep -qx "e2e: interrupted (exit 1, no Playwright report): 1 completed (1 passed, 0 failed), 1 interrupted: chromium-tablet: second, 1 not started: chromium-tablet: third" "$dir/out" && grep -q "\"status\": \"interrupted\"" "$(copied progress.json)"'

start stuck; gate > "$dir/out" 2>&1; rc=$?
check "terminates, then kills, a process that ignores SIGTERM before deleting" '(( rc == 1 )) && clean && grep -q "SIGTERM to processes" "$dir/out" && grep -q "SIGKILL to processes" "$dir/out" && ! kill -0 "$(cat "$dir/stuck.pid")" 2>/dev/null'

# Started as a supervisor would, with SIGINT not ignored (job control).
stop() {
  set -m; "${gate[@]}" > "$dir/out" 2>&1 & pid=$!; set +m
  for _ in $(seq 100); do [[ -e $dir/ready ]] && break; sleep 0.1; done
  kill -TERM "$pid"; wait "$pid"
}
start signal; stop; rc=$?
check "a stop is Ctrl+C for the runner, then the same orderly finish" '(( rc == 143 )) && [[ $(cat "$dir/signals" 2>/dev/null) == INT ]] && clean && grep -q "1 interrupted: chromium-tablet: second, 1 not started" "$dir/out"'
start deaf; stop; rc=$?
check "a runner that ignores the stop is terminated, then killed, before cleanup" '(( rc == 143 )) && clean && grep -q "SIGTERM to the runner" "$dir/out" && ! kill -0 "$(cat "$dir/deaf.pid")" 2>/dev/null'
start survivor; gate > "$dir/out" 2>&1; rc=$?
kept_checkpoint=$(find "$wt/e2e-artifacts" -name progress.json 2>/dev/null)
check "keeps everything, slot guard included, when a run process outlives SIGKILL" '(( rc == 3 )) && [[ -d $wt/e2e/.private && -n $kept_checkpoint ]] && grep -q "\"status\":\"running\"" "$kept_checkpoint" && [[ -z $(ls "$dir/logs" | grep -v "\.log$") ]]'
check "names what was left and how to recover" 'grep -q "survived SIGKILL; nothing was finalized, copied or deleted" "$dir/out" && grep -q "^  *[0-9]* *[0-9]* sleep" "$dir/out" && grep -q "Kept, with the slot guard: $wt/e2e/.private $wt/e2e-artifacts" "$dir/out" && grep -q "finalize-evidence.ts $wt/e2e-artifacts 1" "$dir/out"'
kill -KILL "$(cat "$dir/respawner.pid")" 2>/dev/null
exit $fail
