#!/usr/bin/env bash
# usage: admission.test.sh — checks memory admission (admission.sh) with dummy
# commands: the committed table, reservations from recorded real peaks (seed
# until 3, then max + margin), the sampler, admission and queueing against the
# budget, gate priority, a gate beside a curator command when the real
# numbers fit, release when a job ends, is killed or is cancelled, stale-owner
# cleanup, unique ids and two concurrent curators. Uses a scratch state
# directory (run_tmp, under <repo parent>/.ep-tmp, so it also runs on a CI
# runner, which has no $EP_ORCH) and a test table; no systemd unit or scope.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
run_tmp admission-test || exit 1
dir=$run_tmp
pids=()
cleanup() { (( ${#pids[@]} )) && kill "${pids[@]}" 2> /dev/null; wait 2> /dev/null; rm -rf "$dir"; }
trap cleanup EXIT
export BOUNDED_STATE_DIR=$dir ADMISSION_INTERVAL=0.2
unset BOUNDED_WAIT_TIMEOUT BOUNDED_RESERVATION ADMISSION_TABLE CAPPED_KIND
adm=$here/admission.sh
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
# run <id> <class> <priority> <command...>: reserves, then runs the command in
# the background (admission.sh run execs into it); its output goes to <id>.out.
run() { "$adm" run "$@" > "$dir/$1.out" 2>&1 & pids+=($!); }
# state <id>: active, queued or gone, from the status line.
state() {
  local line; line=$("$adm" status)
  if [[ ${line#*active: } == *"$1 "* && ${line%%; queued:*} == *"$1 "* ]]; then echo active
  elif [[ ${line#*queued: } == *"$1 "* ]]; then echo queued
  else echo gone; fi
}
# until_state <id> <state>: waits up to 10 s for it.
until_state() { local _; for _ in $(seq 50); do [[ $(state "$1") == "$2" ]] && return 0; sleep 0.2; done; return 1; }
finish() { touch "$dir/$1.go"; }
# A dummy job that runs until finish <name> (or 60 s).
job() { echo "until [[ -e $dir/$1.go ]]; do sleep 0.1; done"; }

# --- The committed table ---
check "the budget is the table's" "$("$adm" gib budget)" "$(awk '$1 == "budget" { print $2 }' "$here/memory-reservations.tsv")"
check "the margin is 10%" "$(awk '$1 == "margin" { print $2 }' "$here/memory-reservations.tsv")" 10
check "a role (a model session) reserves nothing" "$("$adm" gib role)" 0
for class in gate-1 gate-2 gate-3 gate-4 prep-light-1 prep-light-2 prep-light-3 prep-light-4 prep-full-1 prep-full-2 prep-full-3 prep-full-4 prep-remote curator curator-lint curator-corpus curator-test curator-light command role; do
  "$adm" gib "$class" > /dev/null || { echo "FAIL  class $class is missing from the table"; fail=1; }
  awk -v c="$class" '$1 == c && NF >= 3 { ok = 1 } END { exit !ok }' "$here/memory-reservations.tsv" \
    || { echo "FAIL  class $class has no source"; fail=1; }
done
"$adm" table | grep '^gate-3 .* seed (0 qualifying)$' > /dev/null
check "admission.sh table shows each class's basis" "$?" 0

# The rest uses a test table, so the logic doesn't move with the seeds.
cat > "$dir/test.tsv" << 'TABLE'
budget 16 test
margin 10 test
gate-1 12 test
gate-3 15 test
gate-4 16 test
prep-full-3 13 test
prep-light-1 10 test
prep-full-1 15 test
prep-remote 2 test
curator 8 test
curator-lint 3 test
curator-corpus 3 test
curator-test 3 test
curator-light 2 test
command 12 test
role 0 test
TABLE
export ADMISSION_TABLE=$dir/test.tsv
"$adm" gib bogus > /dev/null 2>&1
check "an unknown class is refused" "$?" 64
check "a landing queue in a gate unit is a gate by its workers" "$("$adm" class gate 3 /x/scripts/orchestration/land-queue.sh 384)" gate-3
check "cur-prep.sh is a light prep by its workers" "$("$adm" class gate 1 /x/scripts/orchestration/cur-prep.sh 384 msg)" prep-light-1
check "cur-prep.sh --full is a full prep" "$("$adm" class command 3 /x/cur-prep.sh --full 384 msg)" prep-full-3
check "cur-prep.sh --remote-suite runs no tests: prep-remote, whatever its workers" \
  "$("$adm" class gate 1 /x/cur-prep.sh --remote-suite 384 msg) $("$adm" class gate 3 /x/cur-prep.sh --remote-suite --branch b --worktree w 384 msg)" "prep-remote prep-remote"
check "with --full too, in either order, it stays prep-remote" \
  "$("$adm" class gate 3 /x/cur-prep.sh --remote-suite --full 384 msg) $("$adm" class command 3 /x/cur-prep.sh --full --remote-suite 384 msg)" "prep-remote prep-remote"
check "--remote-suite before the script names no prep" "$("$adm" class command 1 bash --remote-suite -c true)" command
check "any other command unit gets the default" "$("$adm" class command 1 bash -c true)" command
check "a role unit is a role" "$("$adm" class role 1 implementer)" role

# --- capped.sh commands by what they run ---
kind() { "$adm" class capped 1 "$@"; }
check "lint is curator-lint" "$(kind pnpm -s lint)" curator-lint
check "typecheck is curator-lint" "$(kind pnpm typecheck)" curator-lint
check "eslint and tsc on their own are curator-lint" "$(kind npx eslint a.ts) $(kind node ./node_modules/@typescript/native/bin/tsc -p x.json)" "curator-lint curator-lint"
check "a full-corpus preview is curator-corpus" "$(kind pnpm -s catalog:preview --system /s/foundryvtt-pf1)" curator-corpus
check "catalog:curate is curator-corpus" "$(kind pnpm catalog:curate --system /s)" curator-corpus
check "the whole of tests/catalog is curator-corpus" "$(kind pnpm test tests/catalog) $(kind npx vitest run tests/catalog/)" "curator-corpus curator-corpus"
check "a test run with no files is the whole suite: curator-corpus" "$(kind pnpm -s test)" curator-corpus
check "named test files are curator-test" "$(kind pnpm -s vitest run tests/catalog/a.test.ts convex/b.integration.test.ts)" curator-test
check "-t takes a value, which is no file" "$(kind pnpm test tests/catalog/a.test.ts -t 'public resolver')" curator-test
check "a file filter beside a directory is the corpus" "$(kind pnpm test tests/catalog/a.test.ts tests/catalog)" curator-corpus
check "--exclude runs everything else: curator-corpus" "$(kind pnpm test --exclude tests/catalog/example.test.ts) $(kind pnpm -s vitest run --exclude=tests/catalog/x.test.ts)" "curator-corpus curator-corpus"
check "option values are no file filters" \
  "$(kind pnpm test --project unit --reporter dot tests/catalog/a.test.ts) $(kind npx vitest run --reporter=verbose -t 'one case' tests/catalog/a.test.ts)" "curator-test curator-test"
check "a value option with no file after it is the whole suite" "$(kind pnpm test --project unit) $(kind pnpm test --reporter dot)" "curator-corpus curator-corpus"
check "known boolean flags take no value" "$(kind pnpm test --silent --passWithNoTests tests/catalog/a.test.ts)" curator-test
check "an option it doesn't know is uncertain: curator-corpus" "$(kind pnpm test --sequence.shuffle tests/catalog/a.test.ts) $(kind pnpm test -x tests/catalog/a.test.ts)" "curator-corpus curator-corpus"
check "--changed and --related pick their own files: curator-corpus" "$(kind pnpm test --changed) $(kind pnpm test --related src/a.ts)" "curator-corpus curator-corpus"
check "an unknown option in the --opt=value form is uncertain too: curator-corpus" "$(kind pnpm test --sequence.shuffle=true tests/catalog/a.test.ts)" curator-corpus
check "--changed=value and --related=value beside a named file: curator-corpus" \
  "$(kind pnpm test --changed=HEAD~1 tests/catalog/a.test.ts) $(kind pnpm test --related=src/a.ts tests/catalog/a.test.ts)" "curator-corpus curator-corpus"
check "a known option in the --opt=value form takes its value" "$(kind pnpm test --project=unit --testTimeout=30000 tests/catalog/a.test.ts)" curator-test
check "catalog:pin and catalog:format are curator-light" "$(kind pnpm catalog:pin) $(kind pnpm -s catalog:format --check)" "curator-light curator-light"
check "catalog:notice-deps reads the whole catalog: curator-corpus" "$(kind pnpm catalog:notice-deps)" curator-corpus
check "check:initial-migration-writers and prettier are curator-light" \
  "$(kind pnpm -s check:initial-migration-writers) $(kind pnpm exec prettier --write a.ts)" "curator-light curator-light"
check "bash -c is composite: curator, the largest" "$(kind bash -c 'pnpm -s lint')" curator
check "a script is unknown: curator" "$(kind .scratch/cur-388/gen/final.sh) $(kind node --import tsx .scratch/x.ts) $(kind pnpm exec tsx x.ts)" "curator curator curator"
check "a package script it doesn't know is unknown: curator" "$(kind pnpm dev)" curator
check "CAPPED_KIND names the kind of a composite command" "$(CAPPED_KIND=light kind bash -c 'pnpm catalog:pin; pnpm catalog:format')" curator-light
CAPPED_KIND=huge kind true > /dev/null 2>&1
check "an unknown CAPPED_KIND is refused" "$?" 64
check "curator is never below the largest command kind (curator-lint 3, ..., curator 8)" "$("$adm" gib curator)" 8
printf 'budget 16 test\nmargin 10 test\ncurator 2 test\ncurator-lint 3 test\ncurator-corpus 5 test\n' > "$dir/kinds.tsv"
check "curator below a command kind is raised to it" "$(ADMISSION_TABLE=$dir/kinds.tsv "$adm" gib curator) $(ADMISSION_TABLE=$dir/kinds.tsv "$adm" table | grep -c '^curator  .*the largest command kind, curator-corpus')" "5 1"

# Every command shape the classifier receives, from capped.sh or from a
# peaks.log line (reclassify; a line cut at 100 characters can end on any
# word): each gets a class, exits 0 and says nothing on stderr, under set -u
# as admission.sh runs. Nothing after a launcher (no args, env, pnpm, pnpm
# exec, npx, node and its flags) is no known kind: curator.
shape() {
  local want=$1 out err status; shift
  out=$("$adm" class capped 1 "$@" 2> "$dir/shape.err"); status=$?; err=$(cat "$dir/shape.err")
  check "shape [$*]" "$out $status${err:+ stderr: $err}" "$want 0"
}
shape curator
shape curator env
shape curator env FOO=1
shape curator FOO=1
shape curator pnpm
shape curator pnpm -s
shape curator pnpm run
shape curator pnpm exec
shape curator pnpm -s exec
shape curator npx
shape curator npx -y
shape curator node
shape curator node --import tsx
shape curator node --import
shape curator node -r
shape curator node --max-old-space-size=4096 --import tsx
shape curator node --max-old-space-size=4096 --import tsx --input-type=module
shape curator node --import tsx --input-type=module -
shape curator node --import tsx --input-type=module -e "import x from 'y'"
shape curator node --test scripts/check-artifacts.test.mjs
shape curator node --import tsx scripts/catalog-record-review.ts --verify --root
shape curator-lint node ./node_modules/eslint/bin/eslint.js .
shape curator-lint node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js .
shape curator-lint pnpm exec tsc -p x.json
shape curator-lint pnpm -s lint:eslint
shape curator-light pnpm -s exec prettier --check a.ts
shape curator-corpus pnpm test
shape curator-corpus pnpm vitest
shape curator-corpus pnpm vitest run
shape curator-corpus npx vitest
shape curator-corpus npx vitest run
shape curator-corpus pnpm test -t
shape curator-test pnpm test tests/catalog/a.test.ts -t
shape curator-test pnpm exec vitest run tests/catalog/a.test.ts -t 'one case'
shape curator-corpus node ./node_modules/vitest/vitest.mjs run tests/catalog
shape curator-test node ./node_modules/vitest/vitest.mjs run tests/catalog/a.test.ts
shape curator-corpus npx vitest run --reporter
shape curator python3
shape curator /usr/bin/python3
shape curator python3 -B -I /x/.ep-tmp/replace-gate-cap/tools/measure.py codegen
shape curator bash
shape curator bash /x/tools/top-process.sh /
shape curator /home/x/ep-orch/mvp/replace-gate-cap-evidence/tools
shape curator .scratch/cur-388/gen/final.sh
shape curator pnpm -s catalog:launch-inventory --write
shape curator pnpm -s mvp:status
shape curator-light pnpm -s catalog:format --check

# Reclassify on peaks.log lines of every shape the live log holds: the
# command shapes above, cut lines, an empty command, a line with no "dir: ",
# and lines that aren't a record at all (left as they are). Before #admission-
# light-peaks a "node --import tsx" line stopped the classifier ("line 185: 1:
# unbound variable") and was relabelled to an empty class.
mkdir -p "$dir/admission" "$dir/logs"
cat > "$dir/shapes.log" << 'LOG'
2026-11-01T00:00:01Z curator 1300000000 1400000000 ok 13 s-node-import t3-a: node --import tsx --input-type=module
2026-11-01T00:00:02Z curator 1300000000 1400000000 ok 7 s-node t3-a: node
2026-11-01T00:00:03Z curator 1300000000 1400000000 ok 7 s-node-flags t3-a: node --max-old-space-size=4096 --import tsx
2026-11-01T00:00:04Z curator 1300000000 1400000000 ok 7 s-npx t3-a: npx
2026-11-01T00:00:05Z curator 1300000000 1400000000 ok 7 s-pnpm-exec t3-a: pnpm exec
2026-11-01T00:00:06Z curator 1300000000 1400000000 ok 7 s-empty t3-a:
2026-11-01T00:00:07Z curator 1300000000 1400000000 ok 7 s-nodir pnpm -s lint
2026-11-01T00:00:08Z curator 1300000000 1400000000 ok 7 s-python t3-a: python3 -B -I /x/tools/measure.py
2026-11-01T00:00:09Z curator 1300000000 1400000000 ok 7 s-cut t3-a: node --import tsx /home/andreas/repos/everythingpath/ep-orch/mvp-20261023/768-core-impl/measur
2026-11-01T00:00:10Z curator 1300000000 1400000000 ok 7 s-cut-bash t3-a: bash -c pnpm -s typecheck; echo typecheck $?; pnpm -s lint; echo lint $?; pnpm catalog:pin; pn

not a record
2026-11-01T00:00:11Z curator
LOG
cp "$dir/shapes.log" "$dir/admission/peaks.log"
"$adm" reclassify > "$dir/shapes.out" 2> "$dir/shapes.err"
check "reclassify runs on every line shape" "$? $(cat "$dir/shapes.err")" "0 "
check "and only says what it would change" "$(cat "$dir/shapes.out")" "s-nodir curator -> curator-lint"
"$adm" reclassify --write > /dev/null 2>&1
check "--write relabels by command and keeps every other line as it was" "$(diff "$dir/shapes.log" "$dir/admission/peaks.log" | grep -c '^[<>]') $(awk 'NR == 7 { print $2 }' "$dir/admission/peaks.log")" "2 curator-lint"
check "no line loses its class" "$(grep -c 'Z  ' "$dir/admission/peaks.log")" 0
# A line whose class can't be worked out keeps it; a dry run says so and
# fails, and --write leaves the log as it was.
cp "$dir/shapes.log" "$dir/admission/peaks.log"
bash -c '. "$1"; admission_class() { return 64; }; admission_reclassify --write' _ "$adm" > /dev/null 2> "$dir/shapes.err"
check "a line it can't classify stops --write" "$? $(cmp -s "$dir/shapes.log" "$dir/admission/peaks.log" && echo same) $(grep -c "^can't classify s-node: " "$dir/shapes.err")" "72 same 1"
rm -rf "$dir/admission" "$dir/logs"

# A capped.sh command run with CAPPED_KIND is recorded under the kind it
# declared; a line records neither CAPPED_KIND nor that the kind was declared,
# so a mislabelled run (replace-gate-cap r1's codegen measurements, declared
# light) looks like any other declared run. Named ids are relabelled by their
# command, as if CAPPED_KIND had been unset; every other line keeps its class.
mkdir -p "$dir/admission" "$dir/logs"
cat > "$dir/named.log" << 'LOG'
2026-11-03T22:32:13Z curator-light 4797460480 5121220608 ok 64 n-codegen-1 t3-1b7861ff: python3 -B -I /x/.ep-tmp/replace-gate-cap/tools/measure.py codegen
2026-11-03T22:33:32Z curator-light 4902174720 5169672192 ok 71 n-codegen-2 t3-1b7861ff: python3 -B -I /x/.ep-tmp/replace-gate-cap/tools/measure.py codegen
2026-11-03T22:35:02Z curator-light 5209235456 5263814656 ok 80 n-codegen-3 t3-1b7861ff: bash /x/.ep-tmp/replace-gate-cap/tools/top-process.sh /
2026-11-03T22:40:00Z curator-light 557842432 600000000 ok 70 n-light-1 t3-b: python3 /x/761-gate-ops-r1/inputs.py
2026-11-03T22:41:00Z curator-light 400000000 500000000 ok 61 n-light-2 t3-b: pnpm -s catalog:format --check
2026-11-03T22:42:00Z curator-light 300000000 400000000 ok 62 n-light-3 t3-b: pnpm -s catalog:merge
2026-11-03T22:43:00Z curator-test 4000000000 4100000000 ok 90 n-test t3-b: pnpm test tests/catalog/a.test.ts
2026-11-03T22:44:00Z gate-2 9000000000 9100000000 ok 900 n-gate land1
LOG
cp "$dir/named.log" "$dir/admission/peaks.log"
check "unnamed, a declared kind stays: curator-light from the codegen peaks" "$(ADMISSION_TABLE=$dir/test.tsv "$adm" gib curator-light) $("$adm" reclassify | wc -l)" "5.5 0"
check "named ids are relabelled by their command" "$("$adm" reclassify n-codegen-1 n-codegen-2 n-codegen-3 n-light-2)" \
  "$(printf '%s\n' 'n-codegen-1 curator-light -> curator' 'n-codegen-2 curator-light -> curator' 'n-codegen-3 curator-light -> curator')"
"$adm" reclassify --write nope n-codegen-1 > /dev/null 2> "$dir/named.err"
check "an id with no capped.sh line is refused, and the log stays as it was" \
  "$? $(cmp -s "$dir/named.log" "$dir/admission/peaks.log" && echo same) $(cat "$dir/named.err")" "64 same no capped.sh line nope in $dir/admission/peaks.log; it is unchanged"
"$adm" reclassify n-gate > /dev/null 2>&1
check "a bounded job's line can't be named" "$?" 64
"$adm" reclassify --write n-codegen-1 n-codegen-2 n-codegen-3 > /dev/null
check "--write relabels only the named lines" "$(awk '{ print $2 }' "$dir/admission/peaks.log" | paste -sd' ')" \
  "curator curator curator curator-light curator-light curator-light curator-test gate-2"
check "curator-light then comes from its real light runs" "$(ADMISSION_TABLE=$dir/test.tsv "$adm" gib curator-light)" 1
check "a second run without names keeps them" "$("$adm" reclassify | wc -l)" 0
rm -rf "$dir/admission" "$dir/logs"

# A line recorded since the declared-kind change says CAPPED_KIND=<kind> right
# after "<dir>: " when its kind was declared; older lines say nothing, and
# both classify by the command's words alone (VAR=value words are skipped).
# --declared <kind> relabels by its command only the capped.sh lines declared
# with that kind (and any named id), as a named id is; every other line keeps
# its class: a plain curator line, an undeclared line with the same words, a
# line declared with another kind (a plain curator one too), a prep line whose
# log says it ran full, a bounded line. Without --declared, plain curator and
# prep lines are relabelled as always.
mkdir -p "$dir/admission" "$dir/logs"
echo 'prep: full (tests/catalog changed)' > "$dir/logs/bounded-d-prep.log"
cat > "$dir/declared.log" << 'LOG'
2026-11-06T10:00:01Z curator-light 4797460480 5121220608 ok 64 d-codegen t3-1b7861ff: CAPPED_KIND=light python3 -B -I /x/.ep-tmp/replace-gate-cap/tools/measure.py codegen
2026-11-06T10:01:00Z curator-light 400000000 500000000 ok 61 d-format t3-b: CAPPED_KIND=light pnpm -s catalog:format --check
2026-11-06T10:02:00Z curator-light 1300000000 1400000000 ok 70 d-lint t3-b: CAPPED_KIND=light pnpm -s lint
2026-11-06T10:03:00Z curator-light 557842432 600000000 ok 70 d-old t3-b: python3 /x/761-gate-ops-r1/inputs.py
2026-11-06T10:04:00Z curator-test 4000000000 4100000000 ok 90 d-test t3-b: CAPPED_KIND=test bash -c pnpm test tests/catalog/a.test.ts
2026-11-06T10:05:00Z curator 1300000000 1400000000 ok 70 d-plain t3-b: pnpm -s typecheck
2026-11-06T10:06:00Z curator-light 300000000 400000000 ok 62 d-midword t3-b: bash -c CAPPED_KIND=light python3 x.py
2026-11-06T10:07:00Z gate-2 9000000000 9100000000 ok 900 d-gate land1
2026-11-06T10:07:10Z curator-light 4797460480 5121220608 ok 64 d-codegen-old t3-1b7861ff: python3 -B -I /x/.ep-tmp/replace-gate-cap/tools/measure.py codegen
2026-11-06T10:07:20Z curator 1300000000 1400000000 ok 70 d-lint-old t3-b: pnpm -s lint
2026-11-06T10:07:30Z curator 1300000000 1400000000 ok 70 d-plain-test t3-b: CAPPED_KIND=test pnpm -s lint
2026-11-06T10:07:40Z prep-light-2 3000000000 3100000000 ok 300 d-prep cur-777
LOG
printf '2026-11-06T10:08:00Z curator-light 2000000000 2100000000 ok 65 d-cut %s\n' \
  "$(printf 't3-b: CAPPED_KIND=light pnpm -s exec prettier --check %s' "$(printf 'z%.0s' $(seq 200))" | cut -c1-100)" >> "$dir/declared.log"
cp "$dir/declared.log" "$dir/admission/peaks.log"
check "a declared line's command classifies by its words" "$(kind CAPPED_KIND=light pnpm -s lint) $(kind CAPPED_KIND=test python3 x.py)" "curator-lint curator"
check "without --declared, declared lines keep their kind; plain curator and prep lines change as always" "$("$adm" reclassify)" \
  "$(printf '%s\n' 'd-plain curator -> curator-lint' 'd-lint-old curator -> curator-lint' 'd-plain-test curator -> curator-lint' 'd-prep prep-light-2 -> prep-full-2')"
check "--declared light relabels only lines declared light, by their words" "$("$adm" reclassify --declared light)" \
  "$(printf '%s\n' 'd-codegen curator-light -> curator' 'd-lint curator-light -> curator-lint')"
check "--declared test relabels only lines declared test, a plain curator one too" "$("$adm" reclassify --declared test)" \
  "$(printf '%s\n' 'd-test curator-test -> curator' 'd-plain-test curator -> curator-lint')"
check "--declared and named ids select both, and nothing else" "$("$adm" reclassify --declared test d-old)" \
  "$(printf '%s\n' 'd-old curator-light -> curator' 'd-test curator-test -> curator' 'd-plain-test curator -> curator-lint')"
check "--declared with no line declared that kind changes nothing" "$("$adm" reclassify --declared corpus; echo "exit $?")" "exit 0"
"$adm" reclassify --write --declared corpus > /dev/null
check "and --write with it keeps the log and no backup" "$(cmp -s "$dir/declared.log" "$dir/admission/peaks.log" && echo same) $(find "$dir/admission" -name 'peaks.log.bak-*' | wc -l)" "same 0"
"$adm" reclassify --write --declared light > /dev/null
check "--write --declared light rewrites only those lines" "$(awk '{ print $2 }' "$dir/admission/peaks.log" | paste -sd' ')" \
  "curator curator-light curator-lint curator-light curator-test curator curator-light gate-2 curator-light curator curator prep-light-2 curator-light"
check "and keeps the rest of each line" "$(cut -d' ' -f1,3- "$dir/admission/peaks.log")" "$(cut -d' ' -f1,3- "$dir/declared.log")"
check "a second --declared light run changes nothing" "$("$adm" reclassify --write --declared light | wc -l)" 0
cp "$dir/declared.log" "$dir/admission/peaks.log"
for bad in huge curator '' --write; do
  if [[ -n $bad ]]; then "$adm" reclassify --write --declared "$bad" > /dev/null 2> "$dir/declared.err"; else "$adm" reclassify --write --declared > /dev/null 2> "$dir/declared.err"; fi
  check "an unknown declared kind is refused, and the log stays as it was [${bad:-none}]" \
    "$? $(cmp -s "$dir/declared.log" "$dir/admission/peaks.log" && echo same) $(grep -c 'takes lint, corpus, test or light' "$dir/declared.err")" "64 same 1"
done
rm -rf "$dir/admission" "$dir/logs"

# --write keeps every byte of every line it doesn't relabel, and of the lines
# it does except their class word: a last line with no newline (kept without
# one), blank and whitespace-only lines, CRs, long lines, bytes that aren't
# UTF-8. A NUL byte, or a line it would change whose fields aren't single-space
# separated, refuses the write (72) and leaves the log as it was.
mkdir -p "$dir/admission" "$dir/logs" "$dir/bytes"
rec_lint='2026-11-01T00:00:01Z curator 1300000000 1400000000 ok 70 f-lint t3-a: pnpm -s lint'
rec_codegen='2026-11-01T00:00:02Z curator-light 4797460480 5121220608 ok 64 f-codegen t3-a: python3 -B -I /x/tools/measure.py codegen'
rec_format='2026-11-01T00:00:03Z curator-light 400000000 500000000 ok 61 f-format t3-a: pnpm -s catalog:format --check'
lint_after=${rec_lint/ curator / curator-lint }
codegen_after=${rec_codegen/ curator-light / curator }
# rewrite <name> [<id>...]: $dir/bytes/<name> as peaks.log, then reclassify
# --write; prints its exit status and how many backups it kept.
rewrite() {
  local f=$dir/bytes/$1; shift
  rm -f "$dir"/admission/peaks.log*; cp "$f" "$dir/admission/peaks.log"
  "$adm" reclassify --write "$@" > "$dir/rw.out" 2> "$dir/rw.err"
  echo "$? $(find "$dir/admission" -name 'peaks.log.bak-*' | wc -l)"
}
# same <name>: the log is byte for byte <name>.want (<name> when there is none).
same() { local w=$dir/bytes/$1.want; [[ -e $w ]] || w=$dir/bytes/$1; cmp -s "$w" "$dir/admission/peaks.log" && echo same || echo changed; }
printf '%s\n%s' "$rec_format" "$rec_lint" > "$dir/bytes/frag-record"
printf '%s\n%s' "$rec_format" "$lint_after" > "$dir/bytes/frag-record.want"
check "a last record with no newline is relabelled and keeps no newline" "$(rewrite frag-record) $(same frag-record)" "0 1 same"
printf '%s\n%s\nnot a record' "$rec_lint" "$rec_format" > "$dir/bytes/frag-text"
printf '%s\n%s\nnot a record' "$lint_after" "$rec_format" > "$dir/bytes/frag-text.want"
check "a last line that isn't a record and has no newline is kept as it is" "$(rewrite frag-text) $(same frag-text)" "0 1 same"
printf '%s\n%s' "$rec_format" "$rec_codegen" > "$dir/bytes/frag-named"
printf '%s\n%s' "$rec_format" "$codegen_after" > "$dir/bytes/frag-named.want"
check "a named last line with no newline is relabelled and keeps no newline" "$(rewrite frag-named f-codegen) $(same frag-named)" "0 1 same"
rec_declared='2026-11-01T00:00:08Z curator-light 4797460480 5121220608 ok 64 f-declared t3-a: CAPPED_KIND=light python3 -B -I /x/tools/measure.py codegen'
rec_declared_lint='2026-11-01T00:00:09Z curator-light 1300000000 1400000000 ok 70 f-declared-lint t3-a: CAPPED_KIND=light pnpm -s lint'
printf '%s\r\n%s\n\n%s' "$rec_declared" "$rec_codegen" "$rec_declared_lint" > "$dir/bytes/frag-declared"
printf '%s\r\n%s\n\n%s' "${rec_declared/ curator-light / curator }" "$rec_codegen" "${rec_declared_lint/ curator-light / curator-lint }" > "$dir/bytes/frag-declared.want"
check "--declared keeps a CR, a blank line and a last line with no newline; an undeclared line keeps its class" \
  "$(rewrite frag-declared --declared light) $(same frag-declared) $(paste -sd, "$dir/rw.out")" \
  "0 1 same f-declared curator-light -> curator,f-declared-lint curator-light -> curator-lint"
: > "$dir/bytes/empty"
check "an empty log stays empty, with nothing rewritten" "$(rewrite empty) $(same empty) $(wc -c < "$dir/admission/peaks.log")" "0 0 same 0"
printf 'not a record' > "$dir/bytes/only-text"
check "a log that is one line with no newline is kept" "$(rewrite only-text) $(same only-text)" "0 0 same"
printf '%s' "$rec_lint" > "$dir/bytes/only-record"
printf '%s' "$lint_after" > "$dir/bytes/only-record.want"
check "a log that is one record with no newline is relabelled, with no newline added" "$(rewrite only-record) $(same only-record)" "0 1 same"
{ printf '%s\r\n' "$rec_lint"; printf '\n   \n\t\n'; printf '%s\n' "$rec_format"
  printf 'x%.0s' $(seq 5000); printf '\n'
  printf '2026-11-01T00:00:04Z curator 1300000000 1400000000 ok 70 f-long t3-a: bash .scratch/%s.sh\n' "$(printf 'y%.0s' $(seq 3000))"
  printf 'not \377\376 utf-8\n'; printf '2026-11-01T00:00:05Z curator 1 2 ok 7 f-bytes t3-a: bash \377.sh\n'
  printf '2026-11-01T00:00:06Z curator 1 2 ok 7 f-spaces t3-a: bash -c echo  two   spaces\n'
  printf '2026-11-01T00:00:07Z\tcurator 1 2 ok 7 f-tab-kept t3-a: bash x.sh\n'
  printf '%s' "$rec_codegen"; } > "$dir/bytes/odd"
{ printf '%s\r\n' "$lint_after"; tail -n +2 "$dir/bytes/odd" | head -n -1; printf '%s' "$codegen_after"; } > "$dir/bytes/odd.want"
check "CRs, blank, whitespace-only, long and non-UTF-8 lines are kept byte for byte" "$(rewrite odd f-codegen) $(same odd) $(cat "$dir/rw.out" | paste -sd,)" \
  "0 1 same f-lint curator -> curator-lint,f-codegen curator-light -> curator"
printf '%s\n\0trailing\n' "$rec_lint" > "$dir/bytes/nul"
check "a NUL byte refuses --write and the log stays as it was" "$(rewrite nul) $(same nul) $(grep -c 'holds a NUL byte' "$dir/rw.err")" "72 0 same 1"
"$adm" reclassify > /dev/null 2>&1
check "and a dry run fails on it too" "$?" 72
for odd in $'2026-11-01T00:00:01Z\tcurator 1 2 ok 70 f-odd t3-a: pnpm -s lint' ' 2026-11-01T00:00:01Z curator 1 2 ok 70 f-odd t3-a: pnpm -s lint' \
  '2026-11-01T00:00:01Z curator  1 2 ok 70 f-odd t3-a: pnpm -s lint' '2026-11-01T00:00:01Z  curator 1 2 ok 70 f-odd t3-a: pnpm -s lint'; do
  printf '%s\n%s\n' "$rec_format" "$odd" > "$dir/bytes/spaced"
  check "a line to relabel that isn't single-space separated refuses --write [$(printf '%q' "$odd" | cut -c1-40)]" \
    "$(rewrite spaced) $(same spaced) $(grep -c "^can't relabel f-odd" "$dir/rw.err")" "72 0 same 1"
done

# Every fixture above, with and without its last newline, named ids or none,
# each declared kind or none: --write changes nothing but the class word of
# the lines it reports, and with --declared <kind> each of them is a named id
# or a line whose command starts CAPPED_KIND=<kind> (checked independently, in
# Python, on the bytes). The prep lines' unit logs say they ran full, so a
# selector that let them through would change them.
cp "$here/admission-peaks.sample.log" "$dir/bytes/sample"; cp "$dir/shapes.log" "$dir/bytes/shapes"; cp "$dir/named.log" "$dir/bytes/named"
cp "$dir/declared.log" "$dir/bytes/declared"
for p in d-prep prep391b-20261019-213012-638aad prep425b-20261020-022205-c8a417; do echo 'prep: full (tests/catalog changed)' > "$dir/logs/bounded-$p.log"; done
corpus_bad=
for f in sample shapes named declared odd frag-record frag-text frag-named frag-declared only-text only-record empty; do
  head -c -1 "$dir/bytes/$f" > "$dir/bytes/$f-cut"; [[ $(tail -c 1 "$dir/bytes/$f" | od -An -c) == *'\n'* ]] || cp "$dir/bytes/$f" "$dir/bytes/$f-cut"
  for v in "$f" "$f-cut"; do
    for ids in '' 'n-codegen-1 n-light-2' f-codegen '--declared light' '--declared lint' '--declared corpus' '--declared test' \
      '--declared test d-old' '--declared light n-codegen-1'; do
      cp "$dir/bytes/$v" "$dir/admission/peaks.log"; rm -f "$dir"/admission/peaks.log.bak-*
      # shellcheck disable=SC2086 # ids are words
      "$adm" reclassify --write $ids > "$dir/rw.out" 2> /dev/null; status=$?
      (( status == 64 )) && continue                     # the id isn't in this fixture
      python3 -B -I -c '
import sys
before, after, out = (open(p, "rb").read() for p in sys.argv[1:4])
words = sys.argv[4].split()
declared = words[1].encode() if words[:1] == ["--declared"] else None
named = {w.encode() for w in (words[2:] if declared else words)}
changes = {l.split()[0]: (l.split()[1], l.split()[3]) for l in out.decode().splitlines()}
a, b = before.split(b"\n"), after.split(b"\n")
assert len(a) == len(b), "line count"
seen = 0
for x, y in zip(a, b):
    if x == y: continue
    f = x.split(b" ")
    old, new = changes[f[6].decode()]
    assert f[1] == old.encode() and y == b" ".join([f[0], new.encode()] + f[2:]), x
    if declared is not None and f[6] not in named:
        cmd = b" ".join(f[7:]).rstrip(b"\r").split(b": ", 1)[-1]
        assert (cmd + b" ").startswith(b"CAPPED_KIND=" + declared + b" "), x
    seen += 1
assert seen == len(changes), "changes"
' "$dir/bytes/$v" "$dir/admission/peaks.log" "$dir/rw.out" "$ids" 2> /dev/null || corpus_bad+=" $v[$ids]:$status"
    done
  done
done
check "over the whole corpus only reported class words change, and --declared only lines declared its kind" "${corpus_bad:-none}" none
rm -rf "$dir/admission" "$dir/logs"

# Real peaks.log lines (a committed sample, truncated to 100 characters as
# the log keeps them) reclassified by their command: legacy curator lines by
# kind, a light prep whose log says it ran full as prep-full.
mkdir -p "$dir/admission" "$dir/logs"
cp "$here/admission-peaks.sample.log" "$dir/admission/peaks.log"
echo 'prep: full (tests/catalog changed)' > "$dir/logs/bounded-prep391b-20261019-213012-638aad.log"
echo 'prep: light, 4 test files' > "$dir/logs/bounded-prep425b-20261020-022205-c8a417.log"
"$adm" reclassify > "$dir/reclassify.out"
check "reclassify alone only says what it would change" "$(cmp -s "$here/admission-peaks.sample.log" "$dir/admission/peaks.log" && echo same) $(grep -c ' -> ' "$dir/reclassify.out")" "same 30"
"$adm" reclassify --write > /dev/null
check "reclassify --write relabels each line by its command" "$(awk '{ print $2 }' "$dir/admission/peaks.log" | paste -sd' ')" \
  "$(printf '%s ' curator-lint curator-lint curator curator-lint curator-lint curator-lint curator-lint \
    curator-corpus curator-corpus curator curator-corpus curator-corpus curator-corpus curator-corpus curator-corpus \
    curator-test curator-test curator-test curator-corpus curator-test curator curator-test curator-test curator-test \
    curator-light curator-light curator-light curator-light curator-corpus curator-light curator-light curator-light \
    curator curator curator curator curator curator prep-full-3 prep-light-3 | sed 's/ $//')"
check "and leaves the rest of each line alone" "$(cut -d' ' -f1,3- "$dir/admission/peaks.log")" "$(cut -d' ' -f1,3- "$here/admission-peaks.sample.log")"
check "a second run changes nothing" "$("$adm" reclassify --write | grep -c ' -> ')" 0
check "--write keeps a backup of the log it replaced" "$(for f in "$dir"/admission/peaks.log.bak-*; do cmp -s "$here/admission-peaks.sample.log" "$f" && echo kept; done)" kept
cp "$here/admission-peaks.sample.log" "$dir/admission/peaks.log"
mkdir "$dir/admission/peaks.log.tmp"                              # the rewrite can't be written
"$adm" reclassify --write > /dev/null 2>&1
check "a failed rewrite exits non-zero and leaves the log as it was" "$? $(cmp -s "$here/admission-peaks.sample.log" "$dir/admission/peaks.log" && echo same)" "72 same"
rmdir "$dir/admission/peaks.log.tmp"
"$adm" reclassify --write > /dev/null
# Each kind's reservation from its reclassified lines (every run qualifies here):
# lint 3 ok runs, max 6.82 GiB -> 7.5 -> 8; corpus one ok 8.08 GiB run raises
# it -> 8.9 -> 9; test 2 ok, a failed 5.68 GiB run raises it -> 6.25 -> 6.5;
# light 7 short ok runs of a few MiB -> 0.5; composites 6.96 -> 7.7 -> 8, under
# the largest kind (corpus 9).
check "each kind's reservation comes from its own lines" \
  "$(for c in curator-lint curator-corpus curator-test curator-light curator; do ADMISSION_MIN_SECONDS=0 "$adm" gib "$c"; done | paste -sd' ')" "8 9 6.5 0.5 9"
rm -rf "$dir/admission" "$dir/logs"

# --- Reservations from recorded real peaks ---
lib() { bash -c '. "$1"; shift; "$@"' _ "$adm" "$@"; }
G=1073741824
printf 'real_peak=%s\npeak=%s\nsamples=3\n' $(( 5 * G )) $(( 7 * G )) > "$dir/s5"
printf 'real_peak=%s\npeak=%s\nsamples=3\n' $(( 6 * G )) $(( 8 * G )) > "$dir/s6"
printf 'real_peak=%s\npeak=%s\nsamples=3\n' $(( 9 * G )) $(( 9 * G )) > "$dir/s9"
printf 'real_peak=%s\npeak=%s\nsamples=3\n' $(( 4 * G )) $(( 4 * G )) > "$dir/s4"
lib admission_record curator "$dir/s5" ok 120 r1 "pnpm -s lint"
lib admission_record curator "$dir/s6" ok 300 r2 "pnpm -s catalog:preview"
check "two qualifying runs: still the seed" "$("$adm" gib curator)" 8
lib admission_record curator "$dir/s4" ok 59 r3 "a short run"
check "an ok run under 60 s doesn't qualify" "$("$adm" gib curator) $("$adm" table | grep -o 'seed (2 qualifying)')" "8 seed (2 qualifying)"
lib admission_record curator "$dir/s4" failed 400 r4 "a failed run"
lib admission_record curator "$dir/s4" killed 400 r5 "a stopped run"
lib admission_record curator "$dir/s4" oom 400 r6 "an OOM-killed run"
check "failed, killed and OOM runs don't qualify" "$("$adm" gib curator) $("$adm" table | grep -o 'seed (2 qualifying)')" "8 seed (2 qualifying)"
lib admission_record curator "$dir/s4" ok 60 r7 "pnpm -s typecheck"
check "three qualifying: the largest real peak + 10%, rounded up to 0.5 GiB (6 -> 6.6 -> 7)" "$("$adm" gib curator)" 7
check "admission.sh table says so" "$("$adm" table | grep '^curator ')" "curator            7 GiB  max of 3 qualifying real peaks 6.00 GiB + 10%"
check "the peaks log has class, real peak, memory.peak, result, seconds, id and command" \
  "$(sed -n 1p "$dir/admission/peaks.log" | cut -d' ' -f2-)" "curator $(( 5 * G )) $(( 7 * G )) ok 120 r1 pnpm -s lint"
lib admission_record curator "$dir/s9" oom 10 r8 "an OOM-killed run"
check "an OOM run above the reservation raises it at once (9 -> 9.9 -> 10)" "$("$adm" gib curator)" 10
check "and the table says why" "$("$adm" table | grep -o 'raised: a recorded real peak 9.00 GiB + 10%')" "raised: a recorded real peak 9.00 GiB + 10%"
rm "$dir/admission/peaks.log"
lib admission_record gate-1 "$dir/s9" killed 5 k1 "a stopped gate"
check "a killed run below the seed changes nothing (9 < 12)" "$("$adm" gib gate-1)" 12
printf 'real_peak=%s\npeak=0\nsamples=3\n' $(( 13 * G )) > "$dir/s13"
lib admission_record gate-1 "$dir/s13" failed 30 k2 "a short failed gate"
check "a short failed run above the seed raises it (13 -> 14.3 -> 14.5)" "$("$adm" gib gate-1)" 14.5
for r in g1 g2 g3; do lib admission_record role "$dir/s13" ok 600 "$r" "a model session"; done
check "a role is never recorded and stays at 0" "$("$adm" gib role) $(grep -c ' role ' "$dir/admission/peaks.log")" "0 0"
rm "$dir/admission/peaks.log"

# --- The sampler ---
# It samples its own cgroup: here the test's. Its real peak is current - file + shmem.
ADMISSION_SAMPLE_INTERVAL=0.2 bash -c '. "$1"; admission_sample "$2" & sleep 1' _ "$adm" "$dir/sampled"
sleep 0.5
check "the sampler records a real peak, memory.peak and its sample count" \
  "$(grep -cE '^(real_peak=[1-9][0-9]*|peak=[0-9]+|samples=[2-9][0-9]*)$' "$dir/sampled")" 3
before=$(stat -c %Y.%s "$dir/sampled"); sleep 1
check "and stops when the shell that started it exits" "$(stat -c %Y.%s "$dir/sampled")" "$before"
cg=/sys/fs/cgroup$(sed -n 's/^0:://p' /proc/self/cgroup)
read -r cur < "$cg/memory.current"
check "the real peak is at most memory.current + shmem (cache excluded)" \
  "$(( $(sed -n 's/^real_peak=//p' "$dir/sampled") <= cur + $(awk '$1 == "shmem" { print $2 }' "$cg/memory.stat") + 268435456 ))" 1
( cd "$dir" && lib admission_run_sampled curator samp1 bash -c 'head -c 50M /dev/zero | tail > /dev/null; exit 3' )
check "a sampled command keeps its exit status" "$?" 3
check "and gets its line, with the result and seconds" "$(awk '{ print $2, $5, ($6 <= 2), $7 }' "$dir/admission/peaks.log")" "curator failed 1 samp1"
check "and the command" "$(cut -d' ' -f8- "$dir/admission/peaks.log")" "${dir##*/}: bash -c head -c 50M /dev/zero | tail > /dev/null; exit 3"
check "the sample file is removed" "$(ls "$dir/admission/samples" | wc -l)" 0
( cd "$dir" && CAPPED_KIND=light lib admission_run_sampled curator-light samp1d sleep 0.3 )
check "a declared kind is recorded right after the directory" "$(awk '$7 == "samp1d" { print $2 }' "$dir/admission/peaks.log") $(awk '$7 == "samp1d"' "$dir/admission/peaks.log" | cut -d' ' -f8-)" \
  "curator-light ${dir##*/}: CAPPED_KIND=light sleep 0.3"
( cd "$dir" && CAPPED_KIND='' lib admission_run_sampled curator samp1e sleep 0.3 )
check "an empty CAPPED_KIND records none" "$(awk '$7 == "samp1e"' "$dir/admission/peaks.log" | cut -d' ' -f8-)" "${dir##*/}: sleep 0.3"
printf 'piped\n' | lib admission_run_sampled curator samp2 cat > "$dir/samp2.out"
check "stdin reaches the command" "$(cat "$dir/samp2.out")" piped
# started as a job of its own (set -m), as a terminal or the Bash tool starts
# capped.sh, so its SIGINT isn't ignored on entry
set -m; bash -c '. "$1"; shift; "$@"' _ "$adm" admission_run_sampled curator samp3 sleep 30 & sp=$!; set +m
sleep 1; kill -TERM "$sp"; wait "$sp"
check "TERM reaches the command; the run is recorded as killed" "$? $(awk '$7 == "samp3" { print $5 }' "$dir/admission/peaks.log")" "143 killed"
set -m; bash -c '. "$1"; shift; "$@"' _ "$adm" admission_run_sampled curator samp4 sleep 30 & sp=$!; set +m
sleep 1; t0=$SECONDS; kill -INT "$sp"; wait "$sp"
check "INT stops a command that doesn't handle it (sleep), promptly" "$? $(( SECONDS - t0 < 5 )) $(awk '$7 == "samp4" { print $5 }' "$dir/admission/peaks.log")" "130 1 killed"
rm "$dir/admission/peaks.log"

# --- Two concurrent curators; a third queues ---
run cur-a curator normal bash -c "$(job cur-a)"
until_state cur-a active
run cur-b curator normal bash -c "$(job cur-b)"
until_state cur-b active
check "two curator commands fit the budget together (8 + 8 GiB)" "$(state cur-a) $(state cur-b)" "active active"
run cur-c curator normal bash -c "$(job cur-c)"
until_state cur-c queued
check "a third queues" "$(state cur-c)" queued
check "the status line says why" "$("$adm" status | grep -o '^memory: 16/16 GiB reserved')" "memory: 16/16 GiB reserved"
finish cur-a
until_state cur-c active
check "it is admitted once a reservation is released" "$(state cur-a) $(state cur-c)" "gone active"
finish cur-b; finish cur-c
until_state cur-c gone

# --- Gates and preps first ---
run p-cur1 curator normal bash -c "$(job p-cur1)"; until_state p-cur1 active
run p-cur2 curator normal bash -c "$(job p-cur2)"; until_state p-cur2 active
run p-gate gate-1 high bash -c "$(job p-gate)"; until_state p-gate queued
run p-cur3 curator normal bash -c "$(job p-cur3)"; until_state p-cur3 queued
check "the status line marks the queued gate" "$("$adm" status | grep -c 'p-gate (gate-1 12G, [0-9]*s, gate/prep, ')" 1
finish p-cur1; until_state p-cur1 gone; sleep 1
check "8 GiB free: the queued curator would fit but waits behind the gate" "$(state p-gate) $(state p-cur3)" "queued queued"
finish p-cur2
until_state p-gate active
check "the gate is admitted first" "$(state p-gate) $(state p-cur3)" "active queued"
finish p-gate
until_state p-cur3 active
check "then the curator" "$(state p-cur3)" active
run p-prep prep-full-3 high bash -c "$(job p-prep)"; until_state p-prep queued
check "a prep beside a curator command doesn't fit (13 + 8 GiB) and queues" "$(state p-prep)" queued
finish p-cur3; until_state p-prep active
check "the prep is admitted when the curator command ends" "$(state p-prep)" active
finish p-prep; until_state p-prep gone

# --- A light prep that turns full ---
# cur-prep.sh, once its plan says full and before its tests, runs
# admission.sh escalate on its reservation: prep-light-<n> grows to
# prep-full-<n>, waiting while that doesn't fit, ahead of every queued command.
# esc_job <name>: a prep's job that escalates, notes the status in <name>.escaped, then runs until finish <name>.
esc_job() { echo "'$adm' escalate \"\$BOUNDED_RESERVATION\" > $dir/$1.esc 2>&1; echo \$? > $dir/$1.escaped; $(job "$1")"; }
run e-cur curator-light normal bash -c "$(job e-cur)"; until_state e-cur active
run e-prep prep-light-1 high bash -c "$(esc_job e-prep)"; until_state e-prep active
for _ in $(seq 50); do "$adm" status | grep -q 'growing to prep-full-1' && break; sleep 0.2; done
check "the prep (10 GiB) asks for prep-full-1 (15), which doesn't fit beside a curator command (2)" \
  "$("$adm" status | grep -c 'e-prep (prep-light-1 10G, [0-9]*s, growing to prep-full-1 15G, ')" 1
check "it keeps running meanwhile" "$(state e-prep) $([[ -e $dir/e-prep.escaped ]] && echo returned || echo waits)" "active waits"
run e-cur2 curator-light normal bash -c "$(job e-cur2)"; until_state e-cur2 queued; sleep 1
check "a curator command that fits beside the light prep (10 + 2 + 2) waits behind its growth" "$(state e-cur2)" queued
finish e-cur
for _ in $(seq 50); do [[ -e $dir/e-prep.escaped ]] && break; sleep 0.2; done
check "once the curator command ends the prep holds prep-full-1's 15 GiB" \
  "$(cat "$dir/e-prep.escaped") $(grep -c '^mib=15360$' "$dir/admission/entries/e-prep.entry") $(grep -c '^class=prep-full-1$' "$dir/admission/entries/e-prep.entry")" "0 1 1"
check "the events log says so" "$(grep -c ' escalating e-prep prep-light-1 10 to prep-full-1' "$dir/admission/events.log") $(grep -c ' grown e-prep prep-full-1 15' "$dir/admission/events.log")" "1 1"
check "and the curator command still waits (15 + 2 > 16)" "$(state e-cur2)" queued
finish e-prep; until_state e-prep gone
lib admission_record prep-light-1 "$dir/s5" ok 600 e-prep e-prep
check "the prep's run is recorded as prep-full-1, though its unit's meta says prep-light-1" "$(awk '$7 == "e-prep" { print $2 }' "$dir/admission/peaks.log")" prep-full-1
check "the class it was escalated to is forgotten once recorded" "$(ls "$dir/admission/classes" | wc -l)" 0
until_state e-cur2 active; finish e-cur2; until_state e-cur2 gone
run e-fit prep-light-1 high bash -c "$(esc_job e-fit)"; until_state e-fit active
for _ in $(seq 50); do [[ -e $dir/e-fit.escaped ]] && break; sleep 0.2; done
check "alone, it grows at once" "$(cat "$dir/e-fit.escaped") $(grep -c '^class=prep-full-1$' "$dir/admission/entries/e-fit.entry")" "0 1"
finish e-fit; until_state e-fit gone
run e-gate gate-1 high bash -c "$(esc_job e-gate)"; until_state e-gate active
for _ in $(seq 50); do [[ -e $dir/e-gate.escaped ]] && break; sleep 0.2; done
check "any other class (a landing queue's prep runs under its gate) is left alone" "$(cat "$dir/e-gate.escaped") $(grep -c '^class=gate-1$' "$dir/admission/entries/e-gate.entry")" "0 1"
finish e-gate; until_state e-gate gone
run e-remote prep-remote high bash -c "$(esc_job e-remote)"; until_state e-remote active
for _ in $(seq 50); do [[ -e $dir/e-remote.escaped ]] && break; sleep 0.2; done
check "a remote-suite prep (prep-remote) refuses to escalate and keeps its reservation" \
  "$(cat "$dir/e-remote.escaped") $(grep -c 'prep-remote runs no tests; it never escalates' "$dir/e-remote.esc") $(grep -c '^class=prep-remote$' "$dir/admission/entries/e-remote.entry") $(grep -c '^mib=2048$' "$dir/admission/entries/e-remote.entry") $(grep -c 'escalating e-remote' "$dir/admission/events.log") $(ls "$dir/admission/classes" 2> /dev/null | grep -c e-remote)" \
  "64 1 1 1 0 0"
finish e-remote; until_state e-remote gone
run e-busy curator-light normal bash -c "$(job e-busy)"; until_state e-busy active
run e-term prep-light-1 high bash -c "$(esc_job e-term)"; until_state e-term active
for _ in $(seq 50); do "$adm" status | grep -q 'e-term (prep-light-1 10G, [0-9]*s, growing' && break; sleep 0.2; done
pkill -TERM -f "admission.sh escalate e-term\$"; for _ in $(seq 50); do [[ -e $dir/e-term.escaped ]] && break; sleep 0.2; done
check "TERM ends the wait with 143 and leaves the light reservation" "$(cat "$dir/e-term.escaped") $(state e-term) $("$adm" status | grep -c growing)" "143 active 0"
finish e-term; finish e-busy; until_state e-term gone; until_state e-busy gone
rm -f "$dir/admission/peaks.log"

# --- A gate's intent: ahead of curator commands while it waits for its locks ---
# intent <id> <class> [awaited locks]: registers a pending intent (awaiting
# resource.lock by default), waits for $dir/<id>.locks (its locks), then asks
# for its memory and runs until finish <id>.
intent() {
  bash -c '. "$1"; admission_register "$2" "$3" high "$2" pending "$5" || exit
    until [[ -e $4.locks ]]; do sleep 0.1; done
    admission_request "$2" && admission_wait "$2" || exit
    until [[ -e $4.go ]]; do sleep 0.1; done' _ "$adm" "$1" "$2" "$dir/$1" "${3:-resource}" > "$dir/$1.out" 2>&1 & pids+=($!)
}
run i-cur1 curator normal bash -c "$(job i-cur1)"; until_state i-cur1 active
intent i-gate gate-1; until_state i-gate queued
check "the status line shows the intent" "$("$adm" status | grep -c 'i-gate (gate-1 waiting for its locks, ')" 1
run i-cur2 curator normal bash -c "$(job i-cur2)"; until_state i-cur2 queued; sleep 1
check "a curator command that fits (8 + 8) still waits behind the gate's intent" "$(state i-cur2)" queued
run i-cmd command high bash -c "$(job i-cmd)"
finish i-cur1; until_state i-cmd active
check "a high job (it may hold the gate's lock) is never held back by an intent" "$(state i-cmd) $(state i-cur2)" "active queued"
finish i-cmd; until_state i-cmd gone
touch "$dir/i-gate.locks"; until_state i-gate active
check "with its locks the gate asks for memory and goes first" "$(state i-gate) $(state i-cur2)" "active queued"
finish i-gate; until_state i-cur2 active
check "then the curator command" "$(state i-cur2)" active
finish i-cur2; until_state i-cur2 gone
intent i-gone gate-1; until_state i-gone queued
run i-cur3 curator normal bash -c "$(job i-cur3)"; until_state i-cur3 queued
{ kill -KILL "${pids[-2]}"; wait "${pids[-2]}"; } 2> /dev/null
until_state i-cur3 active
check "an intent whose job is gone ends, and the curator command goes" "$(state i-gone) $(state i-cur3)" "gone active"
finish i-cur3; until_state i-cur3 gone
intent i-cancel gate-1; until_state i-cancel queued
"$adm" cancel i-cancel; touch "$dir/i-cancel.locks"; wait "${pids[-1]}"
check "a cancelled intent ends its job with 143 once it has its locks" "$? $(state i-cancel)" "143 gone"

# --- An intent never holds back the job that holds its lock ---
# A bounded role holds resource.lock and reserves nothing; its worker's
# capped.sh commands inherit BOUNDED_HELD_LOCKS. A gate's intent waiting for
# that lock must not hold them back, or neither could ever finish.
intent h-gate gate-1; hg=${pids[-1]}; until_state h-gate queued
run h-free curator normal bash -c "$(job h-free)"; until_state h-free queued
# ran <id>: waits up to 10 s for <id>.out to say "<id> ran".
ran() { local _; for _ in $(seq 50); do grep -q "^$1 ran$" "$dir/$1.out" 2> /dev/null && return 0; sleep 0.2; done; return 1; }
BOUNDED_HELD_LOCKS=resource run h-role curator normal echo h-role ran
check "a command whose job holds the awaited lock is admitted past the intent and finishes" "$(ran h-role && echo ran)" ran
check "while a command without it still waits" "$(state h-free)" queued
BOUNDED_HELD_LOCKS="curator2 resource" run h-role2 curator normal echo h-role2 ran
check "the held locks are matched by name, in any list" "$(ran h-role2 && echo ran)" ran
BOUNDED_HELD_LOCKS=curator2 run h-other curator normal bash -c "$(job h-other)"; until_state h-other queued
check "holding some other lock doesn't count" "$(state h-other)" queued
"$adm" cancel h-gate > /dev/null; touch "$dir/h-gate.locks"; wait "$hg" 2> /dev/null
until_state h-free active; finish h-free; until_state h-free gone
until_state h-other active; finish h-other; until_state h-other gone
intent h-cgate gate-1 "resource curator"; hc=${pids[-1]}; until_state h-cgate queued
run h-cur curator normal echo h-cur ran
check "an intent waiting for a curator lock holds back no curator command (its holders can't be told apart)" "$(ran h-cur && echo ran)" ran
"$adm" cancel h-cgate > /dev/null; touch "$dir/h-cgate.locks"; wait "$hc" 2> /dev/null

# --- A gate beside a curator command when the real numbers fit ---
run f-cur curator normal bash -c "$(job f-cur)"; until_state f-cur active
run f-gate gate-3 high bash -c "$(job f-gate)"; until_state f-gate queued
check "with the seeds a 3-worker gate (15) doesn't fit beside a curator command (8)" "$(state f-gate)" queued
"$adm" cancel f-gate > /dev/null; wait "${pids[-1]}" 2> /dev/null
printf 'real_peak=%s\npeak=%s\nsamples=9\n' $(( 9 * G )) $(( 13 * G )) > "$dir/g9"
printf 'real_peak=%s\npeak=%s\nsamples=9\n' $(( 5 * G )) $(( 8 * G )) > "$dir/c5"
for r in 1 2 3; do lib admission_record gate-3 "$dir/g9" ok 1200 "g$r" land; lib admission_record curator "$dir/c5" ok 200 "c$r" lint; done
check "recorded real peaks: gate 9 -> 10 GiB, curator 5 -> 5.5 GiB" "$("$adm" gib gate-3) $("$adm" gib curator)" "10 5.5"
run f-cur2 curator normal bash -c "$(job f-cur2)"; until_state f-cur2 active
check "a new curator command reserves the derived 5.5 GiB" "$(grep -c '^mib=5632$' "$dir/admission/entries/f-cur2.entry")" 1
finish f-cur; until_state f-cur gone
run f-gate2 gate-3 high bash -c "$(job f-gate2)"; until_state f-gate2 active
check "the gate is admitted beside one curator command (10 + 5.5 <= 16)" "$(state f-gate2) $(state f-cur2)" "active active"
check "the status line shows it" "$("$adm" status | grep -o '^memory: 15.5/16 GiB reserved')" "memory: 15.5/16 GiB reserved"
run f-cur3 curator normal bash -c "$(job f-cur3)"; until_state f-cur3 queued
check "a second curator command beside them doesn't fit and queues" "$(state f-cur3)" queued
finish f-gate2; finish f-cur2; until_state f-cur3 active; finish f-cur3; until_state f-cur3 gone
rm "$dir/admission/peaks.log"

# --- Release when a job is killed, and stale owners ---
run k-cur curator normal bash -c "$(job k-cur)"; until_state k-cur active
{ kill -KILL "${pids[-1]}"; wait "${pids[-1]}"; } 2> /dev/null
until_state k-cur gone
check "a SIGKILLed job's reservation is gone once its last process is" "$(state k-cur)" gone
check "the sweep records its end" "$(grep -c ' ended k-cur curator 8 no process holds it' "$dir/admission/events.log")" 1
# The reservation belongs to the whole job: a child that outlives the
# reserving process keeps it until it exits too.
"$adm" run k-tree curator normal bash -c "sleep 60 & echo \$! > $dir/k-tree.child; exit 0" > /dev/null 2>&1
check "a child that outlives its parent keeps the reservation" "$(state k-tree)" active
bash -c '. "$1"; admission_drop k-tree' _ "$adm"
check "a wrapper's exit (admission_drop) leaves an admitted reservation to its last process" "$(state k-tree)" active
kill "$(cat "$dir/k-tree.child")"
until_state k-tree gone
check "and it is released when the child exits" "$(state k-tree)" gone
mkdir -p "$dir/admission/entries"
printf 'id=k-ghost\nclass=gate-3\nmib=15360\nprio=0\nseq=999\nstate=active\npid=999999\nsince=%s\nwhat=crashed wrapper\n' "$(date +%s)" > "$dir/admission/entries/k-ghost.entry"
check "an entry without a lock holder (a crashed wrapper) is swept" "$(state k-ghost)" gone
run k-after gate-3 high true
wait "${pids[-1]}"
check "and doesn't block the next job" "$? $(grep -c ' admitted k-after ' "$dir/admission/events.log")" "0 1"

# --- peek: the status line without the sweep, writing nothing ---
# snapshot: every file under the state directory with its size, mtime and sha256.
snapshot() { (cd "$dir/admission" && find . -type f -printf '%p %s %T@\n' | sort && find . -type f -print0 | sort -z | xargs -0 sha256sum); }
run p-live curator normal bash -c "$(job p-live)"; until_state p-live active
printf 'id=p-ghost\nclass=gate-3\nmib=15360\nprio=0\nseq=1000\nstate=active\npid=999999\nsince=%s\nwhat=crashed wrapper\n' "$(date +%s)" > "$dir/admission/entries/p-ghost.entry"
: > "$dir/admission/entries/p-ghost.held"
printf 'id=p-orphan\nclass=curator\nmib=8192\nprio=1\nseq=1001\nstate=queued\npid=999998\nsince=%s\nwhat=no held file\n' "$(date +%s)" > "$dir/admission/entries/p-orphan.entry"
before=$(snapshot); events=$(wc -l < "$dir/admission/events.log")
peeked=$("$adm" peek); code=$?
check "peek exits 0" "$code" 0
check "peek leaves the state directory byte-identical (files, sizes, mtimes, hashes; no new event)" "$(snapshot)" "$before"
check "peek adds no event" "$(wc -l < "$dir/admission/events.log")" "$events"
check "peek's status line counts only the held entry" "$(head -1 <<< "$peeked" | grep -o '^memory: 8/16 GiB reserved; active: p-live (curator 8G, ')" "memory: 8/16 GiB reserved; active: p-live (curator 8G, "
check "peek names the entries no process holds, which status would sweep" "$(sed -n 2p <<< "$peeked")" "stale: p-ghost p-orphan"
check "status then sweeps them, as before" "$(state p-ghost) $(state p-orphan) $(grep -c ' ended p-ghost ' "$dir/admission/events.log")" "gone gone 1"
finish p-live; until_state p-live gone
check "peek of an idle ledger is status's idle line" "$("$adm" peek)" "$(printf 'memory: 0/16 GiB reserved; active: none; queued: none\nstale: none')"
check "held sees a held lock, a free one and a missing file without taking a lock or creating the file" \
  "$(exec 7>> "$dir/flocked"; flock 7; "$adm" held "$dir/flocked" "$dir/missing.lock"; exec 7>&-; "$adm" held "$dir/flocked"; [[ -e $dir/missing.lock ]] && echo created)" \
  "$(printf 'held %s\nmissing %s\nfree %s' "$dir/flocked" "$dir/missing.lock" "$dir/flocked")"

# --- held and peek: a read that fails is an error (exit 3, a reason), never free, stale or idle ---
# Every read they make: the file's stat (inode, device), findmnt (the mount's device), /proc/locks, the
# ledger directory, each entry file, its .held file and the memory table. Each failure below runs with a
# genuinely held lock and a live reservation, so a fail-open answer would show as free or idle.
# fake <tool>: a directory whose <tool> fails, to put first on PATH.
fake() { mkdir -p "$dir/shim-$1"; printf '#!/bin/sh\necho "%s: injected failure" >&2\nexit 2\n' "$1" > "$dir/shim-$1/$1"; chmod +x "$dir/shim-$1/$1"; }
fake stat; fake findmnt
mkdir -p "$dir/locks"; : > "$dir/locks/held.lock"; : > "$dir/unreadable-proc-locks"; chmod 000 "$dir/unreadable-proc-locks"
exec 7>> "$dir/locks/held.lock"; flock 7
run e-live curator normal bash -c "$(job e-live)"; until_state e-live active
before=$(snapshot); events=$(wc -l < "$dir/admission/events.log")
# observe <name> <command...>: the command must exit 3 with a reason on stderr and print no free,
# missing, stale or status line (held may print "error <file>").
observe() { local name=$1 out err code; shift
  out=$("$@" 2> "$dir/observe.err"); code=$?; err=$(cat "$dir/observe.err")
  check "$name" "exit $code; fail-open lines: $(grep -cE '^(free|missing|stale:|memory:)' <<< "$out"); reason: ${err:+yes}" "exit 3; fail-open lines: 0; reason: yes"; }
held_file=$dir/locks/held.lock
observe "held: stat failing is an error, not free" env PATH="$dir/shim-stat:$PATH" "$adm" held "$held_file"
observe "held: findmnt failing is an error, not free" env PATH="$dir/shim-findmnt:$PATH" "$adm" held "$held_file"
observe "held: an unreadable /proc/locks is an error, not free" env ADMISSION_PROC_LOCKS="$dir/unreadable-proc-locks" "$adm" held "$held_file"
observe "held: a missing /proc/locks is an error, not free" env ADMISSION_PROC_LOCKS="$dir/no-proc-locks" "$adm" held "$held_file"
chmod 000 "$dir/locks"
observe "held: a lock in a directory it cannot search is an error, not missing" "$adm" held "$held_file"
chmod 755 "$dir/locks"
check "held: a lock file that does not exist is missing (exit 0)" "$("$adm" held "$dir/locks/never.lock"; echo "exit $?")" "$(printf 'missing %s\nexit 0' "$dir/locks/never.lock")"
check "held: the genuinely held lock still reads held" "$("$adm" held "$held_file")" "held $held_file"
# peek, the same reads plus the ledger's.
observe "peek: stat failing is an error, not stale" env PATH="$dir/shim-stat:$PATH" "$adm" peek
observe "peek: findmnt failing is an error, not stale" env PATH="$dir/shim-findmnt:$PATH" "$adm" peek
observe "peek: an unreadable /proc/locks is an error, not stale" env ADMISSION_PROC_LOCKS="$dir/unreadable-proc-locks" "$adm" peek
observe "peek: a missing state directory is an error, not idle" env BOUNDED_STATE_DIR="$dir/no-such-state" "$adm" peek
observe "peek: a missing memory table is an error, not a zero budget" env ADMISSION_TABLE="$dir/no-table.tsv" "$adm" peek
chmod 000 "$dir/admission/entries"
observe "peek: an unreadable ledger directory is an error, not idle" "$adm" peek
chmod 755 "$dir/admission/entries"
live_entry=$dir/admission/entries/e-live.entry
chmod 000 "$live_entry"
observe "peek: an unreadable entry is an error, not idle" "$adm" peek
chmod 644 "$live_entry"
check "every failure left the state directory byte-identical, with no event" "$(chmod 755 "$dir/locks"; snapshot) $(wc -l < "$dir/admission/events.log")" "$before $events"
cp "$live_entry" "$dir/e-live.saved"
for broken in 's/^mib=.*/mib=abc/' 's/^state=.*/state=bogus/' '/^state=/d' 's/^id=.*/id=other/' 's/^prio=.*/prio=7/' 's/^seq=.*/seq=x/' 's/^since=.*/since=/' '$a garbage line'; do
  sed "$broken" "$dir/e-live.saved" > "$live_entry"
  observe "peek: a malformed entry ($broken) is an error, not idle" "$adm" peek
done
cp "$dir/e-live.saved" "$live_entry"
check "with every read intact, peek shows the live reservation" "$("$adm" peek | head -1 | grep -o 'active: e-live (curator 8G')" "active: e-live (curator 8G"
exec 7>&-
finish e-live; until_state e-live gone

# --- held and peek, closed by construction: their only tools are stat, findmnt, awk and sort, and any of
# them failing (or printing nothing) at any stage is exit 3 with nothing on stdout from peek, never "none"
# or an idle line. Live active, queued and pending reservations (their .held files flocked by this shell)
# would show as idle if a stage fell open.
allow=$dir/allow; mkdir -p "$allow"
tools=(stat findmnt awk sort)
for t in "${tools[@]}"; do ln -sf "$(command -v "$t")" "$allow/$t"; done
bash_bin=$(command -v bash)
for spec in 'c-act active 0 11776 2001' 'c-que queued 0 11776 2002' 'c-pen pending 1 0 2003'; do
  read -r cid cstate cprio cmib cseq <<< "$spec"
  printf 'id=%s\nclass=gate-2\nmib=%s\nprio=%s\nseq=%s\nstate=%s\npid=4242\nsince=%s\nlocks=\nwhat=closure fixture\n' \
    "$cid" "$cmib" "$cprio" "$cseq" "$cstate" "$(date +%s)" > "$dir/admission/entries/$cid.entry"
done
exec 13>> "$dir/admission/entries/c-act.held" 14>> "$dir/admission/entries/c-que.held" 15>> "$dir/admission/entries/c-pen.held"
flock 13; flock 14; flock 15
: > "$dir/locks/free.lock"; exec 16>> "$dir/locks/held.lock"; flock 16
only() { env -i PATH="$1" BOUNDED_STATE_DIR="$dir" "$bash_bin" "$adm" "${@:2}"; }
intact_peek=$(only "$allow" peek); intact_code=$?
check "with only stat, findmnt, awk and sort on PATH, peek succeeds" "$intact_code" 0
check "and shows the live active, queued and pending reservations" \
  "$(head -1 <<< "$intact_peek" | grep -o 'active: c-act (gate-2 11.5G, [0-9]*[sm], closure fixture); queued: c-que (gate-2 11.5G, [0-9]*[sm], gate/prep, closure fixture), c-pen (gate-2 waiting for its locks, [0-9]*[sm], closure fixture)' | grep -c .)" 1
intact_held=$(only "$allow" held "$dir/locks/held.lock" "$dir/locks/free.lock" "$dir/locks/none.lock"); intact_code=$?
check "with only stat, findmnt and awk on PATH, held succeeds" "$intact_code $intact_held" \
  "0 $(printf 'held %s\nfree %s\nmissing %s' "$dir/locks/held.lock" "$dir/locks/free.lock" "$dir/locks/none.lock")"
before=$(snapshot); events=$(wc -l < "$dir/admission/events.log")
for t in "${tools[@]}"; do
  for mode in fails silent; do
    broken=$dir/broken-$t-$mode; rm -rf "$broken"; cp -a "$allow" "$broken"; rm "$broken/$t"
    if [[ $mode == fails ]]; then printf '#!/bin/sh\necho "%s: injected failure" >&2\nexit 2\n' "$t" > "$broken/$t"
    else printf '#!/bin/sh\nexit 0\n' > "$broken/$t"; fi
    chmod +x "$broken/$t"
    out=$(only "$broken" peek 2> "$dir/closure.err"); code=$?
    check "peek with $t that $mode: exit 3, no stdout, a reason" "$code|$out|$( [[ -s $dir/closure.err ]] && echo reason)" "3||reason"
    out=$(only "$broken" held "$dir/locks/held.lock" "$dir/locks/free.lock" 2> "$dir/closure.err"); code=$?
    if [[ $t == sort ]]; then
      check "held never runs sort, so it still reads with sort that $mode" "$code $out" "0 $(head -2 <<< "$intact_held")"
    else
      check "held with $t that $mode: exit 3, only error lines" "$code $(grep -vc '^error ' <<< "$out")" "3 0"
    fi
  done
done
check "no failing or silent tool changed the state directory or wrote an event" "$(snapshot) $(wc -l < "$dir/admission/events.log")" "$before $events"
# The entries' ages ("<n>s" or "<n>m") grow while the probes run; everything else must be identical.
unaged() { sed -E 's/, [0-9]+[sm], /, <age>, /g'; }
check "and with every tool intact peek still shows them" "$(only "$allow" peek | unaged)" "$(unaged <<< "$intact_peek")"
exec 13>&- 14>&- 15>&- 16>&-
rm -f "$dir"/admission/entries/c-{act,que,pen}.{entry,held}

# --- Cancelling a queued wait ---
run c-gate gate-4 high bash -c "$(job c-gate)"; until_state c-gate active
run c-cmd curator normal bash -c 'echo ran'; until_state c-cmd queued
"$adm" cancel c-cmd
wait "${pids[-1]}"
check "admission.sh cancel ends a queued wait with 143" "$? $(state c-cmd) $(grep -c '^ran$' "$dir/c-cmd.out")" "143 gone 0"
"$adm" cancel c-gate 2> /dev/null
check "an admitted reservation can't be cancelled that way" "$? $(state c-gate)" "1 active"
run c-term curator normal bash -c 'echo ran'; until_state c-term queued
kill -TERM "${pids[-1]}"; wait "${pids[-1]}"
check "TERM ends a queued wait with 143" "$? $(state c-term) $(grep -c '^ran$' "$dir/c-term.out")" "143 gone 0"
BOUNDED_WAIT_TIMEOUT=1 "$adm" run c-late curator normal true > "$dir/c-late.out" 2>&1
check "BOUNDED_WAIT_TIMEOUT ends a queued wait with 73" "$? $(state c-late) $(grep -c 'gave up waiting for memory after 1 s' "$dir/c-late.out")" "73 gone 1"
finish c-gate; until_state c-gate gone

# --- A failed state write fails the admission ---
run w-block gate-4 high bash -c "$(job w-block)"; until_state w-block active
run w-cmd curator normal bash -c 'echo ran'; until_state w-cmd queued
mkdir "$dir/admission/entries/w-cmd.entry.tmp"                   # its next state write can't happen
finish w-block; wait "${pids[-1]}"; status=$?
rmdir "$dir/admission/entries/w-cmd.entry.tmp"
check "the admission fails (72) and the command never runs" "$status $(grep -c '^ran$' "$dir/w-cmd.out")" "72 0"
check "the failure is in the events log" "$(grep -c ' failed w-cmd curator 8 state write' "$dir/admission/events.log")" 1
until_state w-cmd gone

# --- Ids, limits and the budget ---
run u-one curator normal bash -c "$(job u-one)"; until_state u-one active
"$adm" run u-one curator normal true > /dev/null 2>&1
check "a reservation id is unique" "$?" 64
finish u-one; until_state u-one gone
"$adm" run u-bad bogus normal true > /dev/null 2>&1
check "an unknown class never starts the command" "$?" 64
printf 'budget 4 test\nbig 8 test\n' > "$dir/small.tsv"
ADMISSION_TABLE=$dir/small.tsv "$adm" run u-big big normal true
check "a job bigger than the budget still runs alone" "$?" 0
check "nothing is left reserved" "$("$adm" status)" "memory: 0/16 GiB reserved; active: none; queued: none"

exit $fail
