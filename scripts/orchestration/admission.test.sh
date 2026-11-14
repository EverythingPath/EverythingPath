#!/usr/bin/env bash
# usage: admission.test.sh — checks memory admission (admission.sh) with dummy
# commands: the committed table, reservations from recorded real peaks (seed
# until 3, then max + margin), the sampler, admission and queueing against the
# budget, gate priority, a gate beside a curator command when the real
# numbers fit, release when a job ends, is killed or is cancelled, stale-owner
# cleanup, unique ids, two concurrent curators and a gate driver's intent
# (admission.sh intent, status --for). Uses a scratch state
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
# The disk floor (disk_guard.py) reads a healthy fixture volume, never this host's or a CI runner's disk.
printf '20 1 259:2 / / rw - ext4 /dev/fixture1 rw\n' > "$dir/mountinfo"
export DISK_GUARD_SYSFS=$dir/no-sys DISK_GUARD_MOUNTINFO=$dir/mountinfo DISK_GUARD_FREE_BYTES=$(( 100 << 30 ))
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
for class in gate-1 gate-2 gate-3 gate-4 prep-light-1 prep-light-2 prep-light-3 prep-light-4 prep-full-1 prep-full-2 prep-full-3 prep-full-4 prep-remote curator curator-lint curator-corpus curator-test curator-light curator-inventory command role; do
  "$adm" gib "$class" > /dev/null || { echo "FAIL  class $class is missing from the table"; fail=1; }
  awk -v c="$class" '$1 == c && NF >= 3 { ok = 1 } END { exit !ok }' "$here/memory-reservations.tsv" \
    || { echo "FAIL  class $class has no source"; fail=1; }
done
"$adm" table | grep '^gate-3 .* seed (0 qualifying)$' > /dev/null
check "admission.sh table shows each class's basis" "$?" 0
check "the launch inventory's runs are seeded at 3.5 GiB (3.05 GiB real at most over every result, 2.87 GiB the qualifying maximum; + 10%, rounded up)" \
  "$(awk '$1 == "curator-inventory" { print $2 }' "$here/memory-reservations.tsv")" 3.5

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
curator-lintlegs 3 test
curator-typecheck 3 test
curator-corpus 3 test
curator-test 3 test
curator-light 2 test
curator-inventory 1 test
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
check "the full lint is curator-lintlegs" "$(kind pnpm -s lint)" curator-lintlegs
check "typecheck is curator-typecheck" "$(kind pnpm typecheck)" curator-typecheck
check "eslint on its own is curator-lint, tsc curator-typecheck" "$(kind npx eslint a.ts) $(kind node ./node_modules/@typescript/native/bin/tsc -p x.json)" "curator-lint curator-typecheck"
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
check "a declared kind still names a launch inventory run's class" "$(CAPPED_KIND=corpus kind pnpm -s catalog:launch-inventory --verify --write)" curator-corpus
CAPPED_KIND=inventory kind pnpm -s mvp:status > /dev/null 2>&1
check "the inventory kind comes from the words only: CAPPED_KIND=inventory is refused" "$?" 64
check "curator is never below the largest command kind (curator-lint 3, ..., curator 8)" "$("$adm" gib curator)" 8
printf 'budget 16 test\nmargin 10 test\ncurator 2 test\ncurator-lint 3 test\ncurator-corpus 5 test\n' > "$dir/kinds.tsv"
check "curator below a command kind is raised to it" "$(ADMISSION_TABLE=$dir/kinds.tsv "$adm" gib curator) $(ADMISSION_TABLE=$dir/kinds.tsv "$adm" table | grep -c '^curator  .*the largest command kind, curator-corpus')" "5 1"

# The path-scoped lint (mq-lint-paths, 2026-11-13): pnpm lint:paths with
# paths or --since, through pnpm (-s, run), after VAR=value words and env with
# -u or --unset, is curator-lintpaths, seeded at 7 GiB (6.12 GiB measured on
# the worst 50-file set + 10%, rounded up). A table, one command per row: its
# class and its words. The full lint, its legs, ESLint run directly, another
# launcher and a shell wrapper keep the class they had.
lint_paths() {
  local class cmd out status
  while read -r class cmd; do
    [[ -n $class ]] || continue
    eval "set -- $cmd"
    out=$("$adm" class capped 1 "$@" 2> "$dir/shape.err"); status=$?
    check "class [$cmd]" "$out $status$(cat "$dir/shape.err")" "$class 0"
  done
}
lint_paths << 'TABLE'
curator-lintpaths pnpm -s lint:paths src/a.ts convex/b.ts
curator-lintpaths pnpm -s lint:paths --since 6372e4c96c9f275ab31e718d24495901153574db
curator-lintpaths pnpm lint:paths src/a.ts
curator-lintpaths pnpm run lint:paths --since main
curator-lintpaths pnpm --silent lint:paths src/a.ts
curator-lintpaths env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s lint:paths --since 6372e4c9
curator-lintpaths env -u BOUNDED_HELD_LOCKS pnpm -s lint:paths src/a.ts tests/b.test.ts
curator-lintpaths env --unset=LANG TMPDIR=/x/.ep-tmp/a pnpm -s lint:paths --since main
curator-lintpaths TMPDIR=/x/.ep-tmp/a pnpm -s lint:paths src/a.ts
curator-lintlegs  pnpm -s lint
curator-lint      pnpm -s lint:eslint:app x
curator-lintlegs  pnpm -s lint:eslint
curator-lint      pnpm -s lint:paths-all x
curator-lint      npm run lint:paths x
curator-lint      pnpm exec eslint x
curator-lint      npx eslint src/a.ts
curator-lint      node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src/a.ts
curator-lintlegs  env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s lint
curator           bash -c 'pnpm -s lint:paths --since main'
curator           node --import tsx scripts/lint-paths.ts --since main
curator           pnpm -C /x lint:paths src/a.ts
curator           pnpm exec lint:paths src/a.ts
TABLE
check "curator-lintpaths is in the committed table with a source, seeded at 7 GiB" \
  "$(awk '$1 == "curator-lintpaths" && NF >= 3 { print $2 }' "$here/memory-reservations.tsv") $(ADMISSION_TABLE=$here/memory-reservations.tsv "$adm" gib curator-lintpaths)" "7 7"

# The type check and the full lint in classes of their own (mq-typecheck-split,
# 2026-11-14). The typecheck package script (pnpm, npm or yarn, any
# arguments) and tsc run directly are curator-typecheck: one checker
# (package.json typecheck), seeded from its cold peak. The full lint and its
# legs, split at tests/** so that no ESLint process lints both the app and
# tests (package.json lint:eslint), through pnpm (-s, run) with no further
# arguments, after VAR=value words and env with -u or --unset, are
# curator-lintlegs. Any other form keeps the class it had: an argument that
# could add files to a leg, another lint script, ESLint run directly, another
# launcher, a shell wrapper. The same table form as the path-scoped lint's.
lint_paths << 'TABLE'
curator-typecheck pnpm -s typecheck
curator-typecheck pnpm typecheck
curator-typecheck pnpm run typecheck
curator-typecheck pnpm -s typecheck --extendedDiagnostics
curator-typecheck TMPDIR=/x/.ep-tmp/a pnpm -s typecheck
curator-typecheck npm run typecheck
curator-typecheck node ./node_modules/@typescript/native/bin/tsc --noEmit --checkers 1
curator-typecheck node ./node_modules/@typescript/native/bin/tsc -p convex/tsconfig.json --noEmit
curator-typecheck pnpm exec tsc --noEmit
curator-typecheck npx tsc -p x.json
curator-lint      pnpm -s check
curator           pnpm -s typecheck:all
curator           env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s typecheck
curator           bash -c 'pnpm -s typecheck'
curator           node ./node_modules/typescript/lib/tsc.js -p x.json
curator-lintlegs  pnpm -s lint
curator-lintlegs  pnpm lint
curator-lintlegs  pnpm run lint:eslint
curator-lintlegs  pnpm --silent lint:eslint:app
curator-lintlegs  pnpm -s lint:eslint:tests
curator-lintlegs  pnpm -s lint:eslint:convex
curator-lintlegs  pnpm -s lint:fix
curator-lintlegs  env -u BOUNDED_HELD_LOCKS pnpm -s lint
curator-lintlegs  env --unset=LANG TMPDIR=/x/.ep-tmp/a pnpm -s lint:eslint:tests
curator-lintlegs  CAPPED_KIND=lint pnpm -s lint:eslint:app
curator-lint      pnpm -s lint:eslint:tests .
curator-lint      pnpm -s lint:eslint:convex src
curator-lint      pnpm -s lint:eslint:app --fix
curator-lint      pnpm -s lint --fix
curator-lint      pnpm -s lint:fix src/a.ts
curator-lint      pnpm -s lint:unused
curator-lint      pnpm -s lint:suppressions
curator-lint      pnpm -s lint:eslint:all
curator-lint      npm run lint
curator-lint      pnpm exec eslint tests
curator-lint      node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js tests --suppressions-location eslint-suppressions.json
curator           bash -c 'pnpm -s lint:eslint:app; pnpm -s lint:eslint:tests'
curator           pnpm -C /x lint
curator           pnpm exec lint
TABLE
check "curator-typecheck and curator-lintlegs are in the committed table with a source, seeded at 7.5 and 8.5 GiB" \
  "$(awk '($1 == "curator-typecheck" || $1 == "curator-lintlegs") && NF >= 3 { print $1, $2 }' "$here/memory-reservations.tsv" | paste -sd' ') $(ADMISSION_TABLE=$here/memory-reservations.tsv "$adm" gib curator-typecheck) $(ADMISSION_TABLE=$here/memory-reservations.tsv "$adm" gib curator-lintlegs)" \
  "curator-typecheck 7.5 curator-lintlegs 8.5 7.5 8.5"

# Every command shape the classifier receives, from capped.sh or from a
# peaks.log line (reclassify; a line cut at 100 characters can end on any
# word), and every command of the kind checks above: each gets a class, exits
# 0 and says nothing on stderr, under set -u as admission.sh runs. Nothing
# after a launcher (no args, env, pnpm, pnpm exec, npx, node and its flags) is
# no known kind: curator. A table, one command per row: its class before the
# curator-inventory class (checked against the integration head 46f537ac's
# admission.sh), its class now, and its words (shell-quoted). Only the launch
# inventory's own runs change: catalog:launch-inventory --write, --check,
# --verify --write or --verify --check and mvp:status, through pnpm (-s,
# run), after VAR=value words and env with -u or --unset as workers call
# them. A command that only resembles one (other arguments, another
# launcher, a script, a shell) and an unknown catalog script keep the class
# they had, as does any other command after env -u. Since mq-typecheck-split
# the type check and the full lint's forms take curator-typecheck and
# curator-lintlegs (counted apart; their table above has the near misses).
classes() {
  local before after cmd out err status changed=0 split=0
  while read -r before after cmd; do
    [[ -n $before ]] || continue
    eval "set -- $cmd"
    out=$("$adm" class capped 1 "$@" 2> "$dir/shape.err"); status=$?; err=$(cat "$dir/shape.err")
    check "class [$cmd]" "$out $status${err:+ stderr: $err}" "$after 0"
    if [[ $after == curator-typecheck || $after == curator-lintlegs ]]; then
      split=$(( split + 1 ))
    elif [[ $before != "$after" ]]; then
      changed=$(( changed + 1 ))
      [[ $before == curator && $after == curator-inventory ]] || { echo "FAIL  only launch inventory runs change class: [$cmd] $before -> $after"; fail=1; }
    fi
  done
  check "the launch inventory forms, and the two measured commands among the rows (admission-backfill), are the only rows whose class changed" "$changed" 20
  check "and since mq-typecheck-split, the type check and full lint forms among them" "$split" 7
}
classes << 'TABLE'
curator        curator
curator        curator           env
curator        curator           env FOO=1
curator        curator           FOO=1
curator        curator           pnpm
curator        curator           pnpm -s
curator        curator           pnpm run
curator        curator           pnpm exec
curator        curator           pnpm -s exec
curator        curator           npx
curator        curator           npx -y
curator        curator           node
curator        curator           node --import tsx
curator        curator           node --import
curator        curator           node -r
curator        curator           node --max-old-space-size=4096 --import tsx
curator        curator           node --max-old-space-size=4096 --import tsx --input-type=module
curator        curator           node --import tsx --input-type=module -
curator        curator           node --import tsx --input-type=module -e "import x from 'y'"
curator        curator           node --test scripts/check-artifacts.test.mjs
curator        curator           node --import tsx scripts/catalog-record-review.ts --verify --root
curator-lint   curator-lint      node ./node_modules/eslint/bin/eslint.js .
curator-lint   curator-lint      node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js .
curator-lint   curator-typecheck pnpm exec tsc -p x.json
curator-lint   curator-lintlegs  pnpm -s lint:eslint
curator-light  curator-light     pnpm -s exec prettier --check a.ts
curator-corpus curator-corpus    pnpm test
curator-corpus curator-corpus    pnpm vitest
curator-corpus curator-corpus    pnpm vitest run
curator-corpus curator-corpus    npx vitest
curator-corpus curator-corpus    npx vitest run
curator-corpus curator-corpus    pnpm test -t
curator-test   curator-test      pnpm test tests/catalog/a.test.ts -t
curator-test   curator-test      pnpm exec vitest run tests/catalog/a.test.ts -t 'one case'
curator-corpus curator-corpus    node ./node_modules/vitest/vitest.mjs run tests/catalog
curator-test   curator-test      node ./node_modules/vitest/vitest.mjs run tests/catalog/a.test.ts
curator-corpus curator-corpus    npx vitest run --reporter
curator        curator           python3
curator        curator           /usr/bin/python3
curator        curator           python3 -B -I /x/.ep-tmp/replace-gate-cap/tools/measure.py codegen
curator        curator           bash
curator        curator           bash /x/tools/top-process.sh /
curator        curator           /home/x/ep-orch/mvp/replace-gate-cap-evidence/tools
curator        curator           .scratch/cur-388/gen/final.sh
curator-light  curator-light     pnpm -s catalog:format --check
curator-lint   curator-lintlegs  pnpm -s lint
curator-lint   curator-typecheck pnpm typecheck
curator-lint   curator-lint      npx eslint a.ts
curator-lint   curator-typecheck node ./node_modules/@typescript/native/bin/tsc -p x.json
curator-corpus curator-corpus    pnpm -s catalog:preview --system /s/foundryvtt-pf1
curator-corpus curator-corpus    pnpm catalog:curate --system /s
curator-corpus curator-corpus    pnpm test tests/catalog
curator-corpus curator-corpus    npx vitest run tests/catalog/
curator-corpus curator-corpus    pnpm -s test
curator-test   curator-test      pnpm -s vitest run tests/catalog/a.test.ts convex/b.integration.test.ts
curator-test   curator-test      pnpm test tests/catalog/a.test.ts -t 'public resolver'
curator-corpus curator-corpus    pnpm test tests/catalog/a.test.ts tests/catalog
curator-corpus curator-corpus    pnpm test --exclude tests/catalog/example.test.ts
curator-corpus curator-corpus    pnpm -s vitest run --exclude=tests/catalog/x.test.ts
curator-test   curator-test      pnpm test --project unit --reporter dot tests/catalog/a.test.ts
curator-test   curator-test      npx vitest run --reporter=verbose -t 'one case' tests/catalog/a.test.ts
curator-corpus curator-corpus    pnpm test --project unit
curator-corpus curator-corpus    pnpm test --reporter dot
curator-test   curator-test      pnpm test --silent --passWithNoTests tests/catalog/a.test.ts
curator-corpus curator-corpus    pnpm test --sequence.shuffle tests/catalog/a.test.ts
curator-corpus curator-corpus    pnpm test -x tests/catalog/a.test.ts
curator-corpus curator-corpus    pnpm test --changed
curator-corpus curator-corpus    pnpm test --related src/a.ts
curator-corpus curator-corpus    pnpm test --sequence.shuffle=true tests/catalog/a.test.ts
curator-corpus curator-corpus    pnpm test --changed=HEAD~1 tests/catalog/a.test.ts
curator-corpus curator-corpus    pnpm test --related=src/a.ts tests/catalog/a.test.ts
curator-test   curator-test      pnpm test --project=unit --testTimeout=30000 tests/catalog/a.test.ts
curator-light  curator-light     pnpm catalog:pin
curator-corpus curator-corpus    pnpm catalog:notice-deps
curator-light  curator-light     pnpm -s check:initial-migration-writers
curator-light  curator-light     pnpm exec prettier --write a.ts
curator        curator           bash -c 'pnpm -s lint'
curator        curator           node --import tsx .scratch/x.ts
curator        curator           pnpm exec tsx x.ts
curator        curator           pnpm dev
curator-lint   curator-lintlegs  CAPPED_KIND=light pnpm -s lint
curator        curator           CAPPED_KIND=test python3 x.py
curator        curator-inventory pnpm -s catalog:launch-inventory --write
curator        curator-inventory pnpm -s catalog:launch-inventory --check
curator        curator-inventory pnpm -s catalog:launch-inventory --verify --write
curator        curator-inventory pnpm -s catalog:launch-inventory --verify --check
curator        curator-inventory pnpm -s mvp:status
curator        curator-inventory pnpm catalog:launch-inventory --check
curator        curator-inventory pnpm run catalog:launch-inventory --verify --write
curator        curator-inventory pnpm --silent mvp:status
curator        curator-inventory pnpm -s catalog:launch-inventory --write --verify
curator        curator-inventory env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s catalog:launch-inventory --verify --write
curator        curator-inventory env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s catalog:launch-inventory --verify --check
curator        curator-inventory env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s catalog:launch-inventory --check
curator        curator-inventory env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s catalog:launch-inventory --write
curator        curator-inventory env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s mvp:status
curator        curator-inventory env -u LANG LC_ALL=C.UTF-8 TMPDIR=/x/.ep-tmp/a pnpm -s catalog:launch-inventory --verify --check
curator        curator-inventory env --unset=LANG TMPDIR=/x/.ep-tmp/a pnpm -s mvp:status
curator        curator-inventory TMPDIR=/x/.ep-tmp/a pnpm -s catalog:launch-inventory --check
curator        curator-inventory env TMPDIR=/x/.ep-tmp/a pnpm -s catalog:launch-inventory --write
curator        curator           pnpm -s catalog:launch-inventory
curator        curator           pnpm -s catalog:launch-inventory --verify
curator        curator           pnpm -s catalog:launch-inventory --write --check
curator        curator           pnpm -s catalog:launch-inventory --check --check
curator        curator           pnpm -s catalog:launch-inventory --verify --verify --check
curator        curator           pnpm -s catalog:launch-inventory --diagnostics
curator        curator           pnpm -s catalog:launch-inventory --report
curator        curator           pnpm -s catalog:launch-inventory --check --diagnostics
curator        curator           pnpm -s catalog:launch-inventory --check x
curator        curator           pnpm -s catalog:launch-inventory-report --check
curator        curator           pnpm -s mvp:status --json
curator        curator           pnpm -s mvp:status-all
curator        curator           pnpm exec tsx scripts/catalog-launch-inventory.ts --write
curator        curator           node --import tsx scripts/catalog-launch-inventory.ts --check
curator        curator           bash -c 'pnpm -s catalog:launch-inventory --check'
curator        curator           npx catalog:launch-inventory --check
curator        curator           npm run catalog:launch-inventory --check
curator        curator           pnpm -C /x catalog:launch-inventory --check
curator        curator           pnpm --filter x catalog:launch-inventory --check
curator        curator           env -u pnpm -s catalog:launch-inventory --check
curator        curator           env -i pnpm -s catalog:launch-inventory --check
curator        curator           -u X pnpm -s catalog:launch-inventory --check
curator        curator           env -u
curator        curator           env -u X
curator        curator           env -u X pnpm -s
curator        curator           pnpm -s catalog:launch-report --check
curator        curator           pnpm -s catalog:inventory --check
curator-corpus curator-corpus    pnpm -s catalog:release
curator        curator-inventory env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s test:workflow
curator        curator-lintlegs  env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s lint
curator        curator           env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s test tests/catalog/a.test.ts
curator        curator-inventory env -u CAPPED_KIND bash scripts/orchestration/admission.test.sh
curator-corpus curator-corpus    env HEAP_PROBE_DIR=/x pnpm -s catalog:preview --system /s
TABLE

# The measured commands (admission-backfill, 2026-11-13): small commands that
# took the default class (curator, 9.5 GiB) though $EP_ORCH/admission/peaks.log
# shows them far below it. A table, one form per row: the class it takes, the
# largest memory.peak of every recorded run of the form (any result, any
# class, 2026-10-18 to 2026-11-13; memory.peak counts cache, so it bounds the
# real peak a reservation is made of) and its words. Matched as the launch
# inventory's forms are: through pnpm (-s, run) after VAR=value words and env
# with -u or --unset. The class the committed table gives it must cover that
# peak + 10%, rounded up to 0.5 GiB: a class below it is a defect.
measured() {
  local want=$1 class peak cmd out status need have n=0
  while read -r class peak cmd; do
    [[ -n $class ]] || continue
    eval "set -- $cmd"
    out=$("$adm" class capped 1 "$@" 2> "$dir/shape.err"); status=$?
    check "class [$cmd]" "$out $status$(cat "$dir/shape.err")" "$class 0"
    need=$(awk -v p="$peak" 'BEGIN { h = p * 1.1 * 2; r = int(h); if (r < h) r++; printf "%.1f", r / 2 }')
    have=$(ADMISSION_TABLE=$here/memory-reservations.tsv "$adm" gib "$class")
    awk -v h="$have" -v n="$need" 'BEGIN { exit !(h + 0 >= n + 0) }' \
      || { echo "FAIL  [$cmd] reserves $have GiB, under its measured $peak GiB + 10% ($need)"; fail=1; }
    n=$(( n + 1 ))
  done
  check "every measured form is in the table" "$n" "$want"
}
measured 16 << 'TABLE'
curator-inventory 1.36 pnpm -s test:workflow
curator-inventory 1.36 env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s test:workflow
curator-inventory 0.36 pnpm -s test:affected --base 0f2761c666b746a087c0572d08fa320fd1432e15
curator-inventory 1.77 pnpm -s catalog:party-scope --check
curator-inventory 1.69 pnpm -s catalog:party-scope --write
curator-inventory 1.87 pnpm -s catalog:attribution-227-matches --check
curator-inventory 2.06 pnpm -s catalog:attribution-227-matches --write
curator-inventory 2.63 pnpm -s catalog:launch-legal-authority --check
curator-inventory 2.27 pnpm -s catalog:launch-legal-authority --write
curator-inventory 0.39 pnpm install --offline
curator-inventory 0.40 python3 -B scripts/orchestration/gate-run.test.py
curator-inventory 0.40 env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR python3 -B scripts/orchestration/light-lane.test.py
curator-inventory 2.40 bash scripts/orchestration/admission.test.sh
curator-inventory 2.40 env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR -u BOUNDED_HELD_LOCKS bash scripts/orchestration/wip-ci.test.sh
curator-inventory 1.36 pnpm test:workflow
curator-inventory 0.36 TMPDIR=/x/.ep-tmp/a pnpm run test:affected --base feature/pf1-character-builder
TABLE
# A form that only resembles one keeps the default (or the class its words
# had): another argument, an option's other spelling, another launcher or
# interpreter, another path, a shell, a script on its own.
near() {
  local cmd out status
  while read -r cmd; do
    [[ -n $cmd ]] || continue
    eval "set -- $cmd"
    out=$("$adm" class capped 1 "$@" 2> "$dir/shape.err"); status=$?
    check "near miss [$cmd]" "$out $status$(cat "$dir/shape.err")" "curator 0"
  done
}
near << 'TABLE'
pnpm -s test:workflow x
pnpm -s test:workflow-all
pnpm -s test:affected
pnpm -s test:affected --base
pnpm -s test:affected --base --list
pnpm -s test:affected --base=0f2761c6
pnpm -s test:affected --base 0f2761c6 --list
pnpm -s test:affected --list --base 0f2761c6
pnpm -s catalog:party-scope
pnpm -s catalog:party-scope --status --preview /x
pnpm -s catalog:party-scope --check --write
pnpm -s catalog:party-scope --check x
pnpm -s catalog:attribution-227-matches
pnpm -s catalog:attribution-227-matches --verify
pnpm -s catalog:launch-legal-authority --check x
pnpm -s catalog:launch-legal-authority --write --check
pnpm install
pnpm install --offline --frozen-lockfile
pnpm install --frozen-lockfile --offline
pnpm i --offline
pnpm -C /x install --offline
npm install --offline
npx test:workflow
pnpm exec test:workflow
node --import tsx scripts/affected-tests.ts --base 0f2761c6
node --import tsx scripts/catalog-party-scope.ts --check
python3 -B scripts/orchestration/gate-operator.test.py ImportScanTest
python3 scripts/orchestration/gate-run.test.py
python3 -I -B scripts/orchestration/gate-run.test.py
python3 -B -I scripts/orchestration/gate-run.test.py
python -B scripts/orchestration/gate-run.test.py
/usr/bin/python3 -B scripts/orchestration/gate-run.test.py
python3 -B /x/scripts/orchestration/gate-run.test.py
python3 -B ./scripts/orchestration/gate-run.test.py
python3 -B scripts/orchestration/gate_core.py
python3 -B scripts/orchestration/admission.test.sh
python3 -B scripts/orchestration/x/gate-run.test.py
python3 -B scripts/catalog/a.test.py
python3 -B gate-run.test.py
bash scripts/orchestration/admission.test.sh extra
bash -x scripts/orchestration/admission.test.sh
bash scripts/orchestration/gate-run.test.py
bash scripts/orchestration/admission.sh status
bash scripts/orchestration/../../x/a.test.sh
bash -c 'bash scripts/orchestration/admission.test.sh'
sh scripts/orchestration/admission.test.sh
timeout 300 bash scripts/orchestration/lane-lock.test.sh
scripts/orchestration/admission.test.sh
bash .scratch/admission.test.sh
env -i bash scripts/orchestration/admission.test.sh
TABLE
# The measured node script forms (mq-s1, 2026-11-13): catalog-record-review.ts
# --list, with or without --json, and --verify, with or without --root <dir>;
# both only read. Their peaks.log lines recorded a shell (about 4 MB: the 5 s
# sampler read them before they ran), so the peak column here is a capped
# run's memory.peak sampled every 0.05 s ($EP_ORCH/research/mq-short-tests.md
# A: m04 --list 0.278 GiB, m05 --verify --root 0.259 GiB), the larger for
# every row. Matched as the measured package forms are, after VAR=value words
# and env with -u or --unset.
measured 6 << 'TABLE'
curator-inventory 0.28 node --import tsx scripts/catalog-record-review.ts --list
curator-inventory 0.28 node --import tsx scripts/catalog-record-review.ts --list --json
curator-inventory 0.28 node --import tsx scripts/catalog-record-review.ts --verify
curator-inventory 0.28 node --import tsx scripts/catalog-record-review.ts --verify --root /home/andreas/repos/everythingpath/everythingpath
curator-inventory 0.28 env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR node --import tsx scripts/catalog-record-review.ts --verify --root ../x
curator-inventory 0.28 TMPDIR=/x/.ep-tmp/a node --import tsx scripts/catalog-record-review.ts --list --json
TABLE
# Their near misses keep the default: a form that writes (--t3-run, --record,
# --run, --capture-t3) or wasn't measured (--list --root, --verify --runs), no
# argument, another argument, order or spelling, another loader, launcher,
# interpreter or path, a composite.
near << 'TABLE'
node --import tsx scripts/catalog-record-review.ts
node --import tsx scripts/catalog-record-review.ts --t3-run /x --ids /y
node --import tsx scripts/catalog-record-review.ts --t3-run /x --ids /y --root /z
node --import tsx scripts/catalog-record-review.ts --record /x
node --import tsx scripts/catalog-record-review.ts --list --record /x
node --import tsx scripts/catalog-record-review.ts --run /x --ids /y
node --import tsx scripts/catalog-record-review.ts --capture-t3 /x --config /y --caller-json /z
node --import tsx scripts/catalog-record-review.ts --list --root /x
node --import tsx scripts/catalog-record-review.ts --list --json --root /x
node --import tsx scripts/catalog-record-review.ts --json --list
node --import tsx scripts/catalog-record-review.ts --json
node --import tsx scripts/catalog-record-review.ts --list x
node --import tsx scripts/catalog-record-review.ts --list --list
node --import tsx scripts/catalog-record-review.ts --list --verify
node --import tsx scripts/catalog-record-review.ts --verify --list
node --import tsx scripts/catalog-record-review.ts --verify --json
node --import tsx scripts/catalog-record-review.ts --verify --root
node --import tsx scripts/catalog-record-review.ts --verify --root ''
node --import tsx scripts/catalog-record-review.ts --verify --root --list
node --import tsx scripts/catalog-record-review.ts --verify --root=/x
node --import tsx scripts/catalog-record-review.ts --verify --runs /y
node --import tsx scripts/catalog-record-review.ts --verify --root /x --runs /y
node --import tsx scripts/catalog-record-review.ts --root /x --verify
node --import tsx scripts/catalog-record-review.ts --verify --root /x extra
node --import tsx scripts/catalog-record-review.ts '--list --json'
node --import=tsx scripts/catalog-record-review.ts --list
node --import tsx/esm scripts/catalog-record-review.ts --list
node --require tsx scripts/catalog-record-review.ts --list
node scripts/catalog-record-review.ts --list
node --max-old-space-size=8192 --import tsx scripts/catalog-record-review.ts --verify
node --import tsx --max-old-space-size=8192 scripts/catalog-record-review.ts --verify
node --import tsx ./scripts/catalog-record-review.ts --verify
node --import tsx /x/scripts/catalog-record-review.ts --verify
node --import tsx scripts/catalog/catalog-record-review.ts --verify
node --import tsx scripts/catalog-record-review.mjs --verify
node --import tsx scripts/catalog-party-scope.ts --list
/usr/bin/node --import tsx scripts/catalog-record-review.ts --list
nodejs --import tsx scripts/catalog-record-review.ts --list
tsx scripts/catalog-record-review.ts --list
npx tsx scripts/catalog-record-review.ts --list
pnpm exec node --import tsx scripts/catalog-record-review.ts --verify --root /x
pnpm exec tsx scripts/catalog-record-review.ts --verify
pnpm -s node --import tsx scripts/catalog-record-review.ts --list
bash -c 'node --import tsx scripts/catalog-record-review.ts --list'
env -i node --import tsx scripts/catalog-record-review.ts --list
timeout 60 node --import tsx scripts/catalog-record-review.ts --list
TABLE
check "a declared kind still wins over a measured script form" "$(CAPPED_KIND=test kind node --import tsx scripts/catalog-record-review.ts --list)" curator-test
check "a declared kind still wins over a measured form" "$(CAPPED_KIND=light kind pnpm -s test:workflow) $(CAPPED_KIND=test kind python3 -B scripts/orchestration/gate-run.test.py)" "curator-light curator-test"

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
check "and only says what it would change" "$(cat "$dir/shapes.out")" "s-nodir curator -> curator-lintlegs"
"$adm" reclassify --write > /dev/null 2>&1
check "--write relabels by command and keeps every other line as it was" "$(diff "$dir/shapes.log" "$dir/admission/peaks.log" | grep -c '^[<>]') $(awk 'NR == 7 { print $2 }' "$dir/admission/peaks.log")" "2 curator-lintlegs"
check "no line loses its class" "$(grep -c 'Z  ' "$dir/admission/peaks.log")" 0
# A line whose class can't be worked out keeps it; a dry run says so and
# fails, and --write leaves the log as it was.
cp "$dir/shapes.log" "$dir/admission/peaks.log"
bash -c '. "$1"; admission_class() { return 64; }; admission_reclassify --write' _ "$adm" > /dev/null 2> "$dir/shapes.err"
check "a line it can't classify stops --write" "$? $(cmp -s "$dir/shapes.log" "$dir/admission/peaks.log" && echo same) $(grep -c "^can't classify s-node: " "$dir/shapes.err")" "72 same 1"
rm -rf "$dir/admission" "$dir/logs"
# The live log's launch inventory runs, recorded as plain curator before
# their class, are relabelled curator-inventory; a run declared with another
# kind keeps it, and a form that isn't one of them stays curator.
mkdir -p "$dir/admission" "$dir/logs"
cat > "$dir/admission/peaks.log" << 'LOG'
2026-11-12T10:00:00Z curator 3040000000 3100000000 ok 469 v-write t3-a: pnpm -s catalog:launch-inventory --verify --write
2026-11-12T10:01:00Z curator 1600000000 1700000000 ok 110 v-status t3-a: pnpm -s mvp:status
2026-11-12T10:02:00Z curator-corpus 2000000000 2100000000 ok 110 v-declared t3-a: CAPPED_KIND=corpus pnpm -s catalog:launch-inventory --check
2026-11-12T10:03:00Z curator 2000000000 2100000000 ok 110 v-report t3-a: pnpm -s catalog:launch-inventory --report
LOG
check "reclassify relabels the launch inventory's plain curator lines, and only those" "$("$adm" reclassify)" \
  "$(printf '%s\n' 'v-write curator -> curator-inventory' 'v-status curator -> curator-inventory')"
rm -rf "$dir/admission" "$dir/logs"

# The measured commands' plain curator lines are relabelled curator-inventory
# the same way, so root's reclassify --write moves their history and the
# class's reservation comes from them too; a near miss, a line cut inside its
# last word (the live log's 102-character env -u test:workflow line), a line
# of 100 characters whose last word may be the start of more (the live log's
# capped-20261107-081705-1ba455, a Python test run with a selector: its
# stored words without that word are the no-argument form, which the line
# doesn't prove) and a declared one keep their class.
mkdir -p "$dir/admission" "$dir/logs"
cat > "$dir/admission/peaks.log" << 'LOG'
2026-11-13T10:00:00Z curator 1300000000 1460000000 ok 300 m-workflow t3-a: pnpm -s test:workflow
2026-11-13T10:01:00Z curator 340000000 420000000 ok 120 m-orch t3-a: env -u XDG_RUNTIME_DIR python3 -B scripts/orchestration/gate-run.test.py
2026-11-13T10:02:00Z curator 2250000000 2820000000 ok 70 m-legal t3-a: pnpm -s catalog:launch-legal-authority --check
2026-11-13T10:03:00Z curator 400000000 410000000 ok 2 m-install t3-a: pnpm install --offline
2026-11-13T10:04:00Z curator 400000000 410000000 ok 2 m-near t3-a: pnpm install --offline --frozen-lockfile
2026-11-13T10:05:00Z curator-light 400000000 410000000 ok 300 m-declared t3-a: CAPPED_KIND=light pnpm -s test:workflow
2026-11-07T07:20:29Z curator 38494208 42360832 ok 7 m-selector t3-gate-hold-scope: python3 -B scripts/orchestration/gate-operator.test.py CollectionEquivalenceTest
LOG
printf '2026-11-13T10:06:00Z curator 400000000 410000000 ok 300 m-cut %s\n' \
  "$(printf 't3-2752986e-ce49ff175530fa07: env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s test:workflow' | cut -c1-100)" >> "$dir/admission/peaks.log"
check "reclassify relabels the measured commands' plain curator lines, and only those" "$("$adm" reclassify)" \
  "$(printf '%s\n' 'm-workflow curator -> curator-inventory' 'm-orch curator -> curator-inventory' 'm-legal curator -> curator-inventory' 'm-install curator -> curator-inventory')"
"$adm" reclassify --write > /dev/null
check "--write moves them: curator-inventory then reserves their largest qualifying real peak + 10% (2.10 -> 2.31 -> 2.5)" \
  "$("$adm" gib curator-inventory) $("$adm" table | grep -c '^curator-inventory .*max of 3 qualifying real peaks 2.10 GiB + 10%$')" "2.5 1"
check "and the lines it leaves keep their class" "$(awk '{ print $7, $2 }' "$dir/admission/peaks.log" | paste -sd' ')" \
  "m-workflow curator-inventory m-orch curator-inventory m-legal curator-inventory m-install curator-inventory m-near curator m-declared curator-light m-selector curator m-cut curator"
rm -rf "$dir/admission" "$dir/logs"
# The measured node script forms' plain curator lines move the same way (the
# live log's lines of about 4 MB); a near miss, a declared one and a line of
# 100 characters keep their class: r-cut's stored words without its last,
# cut, word are --list, which the line doesn't prove (it ran --list --json
# here, or anything else).
mkdir -p "$dir/admission" "$dir/logs"
cat > "$dir/admission/peaks.log" << 'LOG'
2026-11-13T11:00:00Z curator 4186112 5242880 ok 1 r-list t3-a: node --import tsx scripts/catalog-record-review.ts --list
2026-11-13T11:01:00Z curator 4186112 5242880 ok 1 r-json t3-a: env -u XDG_RUNTIME_DIR node --import tsx scripts/catalog-record-review.ts --list --json
2026-11-13T11:02:00Z curator 4186112 5242880 failed 1 r-verify t3-a: node --import tsx scripts/catalog-record-review.ts --verify --root /x
2026-11-13T11:03:00Z curator 4186112 5242880 ok 1 r-t3run t3-a: node --import tsx scripts/catalog-record-review.ts --t3-run /x --ids /y
2026-11-13T11:04:00Z curator 4186112 5242880 ok 1 r-runs t3-a: node --import tsx scripts/catalog-record-review.ts --verify --runs /x
2026-11-13T11:05:00Z curator-light 4186112 5242880 ok 1 r-declared t3-a: CAPPED_KIND=light node --import tsx scripts/catalog-record-review.ts --list
LOG
printf '2026-11-13T11:06:00Z curator 4186112 5242880 ok 1 r-cut %s\n' \
  "$(printf 't3-2752986e-ce49ff175530fa07-mq-s1-x: node --import tsx scripts/catalog-record-review.ts --list --json' | cut -c1-100)" >> "$dir/admission/peaks.log"
check "reclassify relabels the measured node script forms' plain curator lines, and only those" "$("$adm" reclassify)" \
  "$(printf '%s\n' 'r-list curator -> curator-inventory' 'r-json curator -> curator-inventory' 'r-verify curator -> curator-inventory')"
"$adm" reclassify --write > /dev/null
check "--write moves them, and the lines it leaves keep their class" "$(awk '{ print $7, $2 }' "$dir/admission/peaks.log" | paste -sd' ')" \
  "r-list curator-inventory r-json curator-inventory r-verify curator-inventory r-t3run curator r-runs curator r-declared curator-light r-cut curator"
rm -rf "$dir/admission" "$dir/logs"

# A line cut at the storage width right after a word stores 100 characters
# ending in that word's space, which reading the line's fields trims (an
# ordinary run, env -u NODE_OPTIONS python3 -B
# scripts/orchestration/gate-run.test.py AdmissionIntentTest, from a
# 28-character worktree: Spec r2 #1, Standards r2 #2). The cut is decided
# from the stored width before any trimming, in bytes, so each
# curator-inventory form cut so keeps its class by every route that reaches
# it (a plain curator line, a named id, a line declared light under
# --declared light), whether the line is ASCII, holds multibyte characters
# cut at 100 characters (as cut -c counts here) or at 100 bytes (as a cut
# that counts bytes does), read in a UTF-8 locale. The same form uncut is
# relabelled by each route, and a cut line's last whole word still counts (an
# ESLint line cut so is relabelled curator-lint). The full lint's forms are
# exact too (curator-lintlegs), so a full lint line cut so keeps its class. The cut forms include mq-s1's
# catalog-record-review.ts forms, each cut before a word that makes it a near miss.
mkdir -p "$dir/admission" "$dir/logs"
# cut_line <class> <id> ascii|chars|bytes <words> <more>: a record whose
# stored command, "<dir>: <words> <more>", is cut at the storage width right
# after the space that follows <words> (ASCII words): ascii, cut by cut -c1-100
# as admission_record cuts it; chars, three é in <dir>, 100 characters (103
# bytes); bytes, three é in <dir>, 100 bytes (97 characters).
cut_line() {
  local pad=$(( 94 - ${#4} )) d stored
  case $3 in
    ascii) d=t3-$(printf 'x%.0s' $(seq "$pad")) ;;
    chars) d=t3-ééé$(printf 'x%.0s' $(seq $(( pad - 3 )))) ;;
    bytes) d=t3-ééé$(printf 'x%.0s' $(seq $(( pad - 6 )))) ;;
  esac
  if [[ $3 == ascii ]]; then stored=$(printf '%s: %s %s' "$d" "$4" "$5" | cut -c1-100); else stored="$d: $4 "; fi
  printf '2026-11-13T11:00:00Z %s 400000000 410000000 ok 30 %s %s\n' "$1" "$2" "$stored"
}
cut_forms=(
  'workflow|pnpm -s test:workflow|--reporter=dot'
  'affected|pnpm -s test:affected --base 6372e4c9|--changed'
  'party|pnpm -s catalog:party-scope --check|--verbose'
  'attribution|pnpm -s catalog:attribution-227-matches --write|--verbose'
  'legal|pnpm -s catalog:launch-legal-authority --check|--verbose'
  'install|pnpm install --offline|--frozen-lockfile'
  'py|env -u NODE_OPTIONS python3 -B scripts/orchestration/gate-run.test.py|AdmissionIntentTest'
  'sh|bash scripts/orchestration/admission.test.sh|--verbose'
  'inventory|pnpm -s catalog:launch-inventory --check|--report'
  'status|pnpm -s mvp:status|--json'
  'review-list|node --import tsx scripts/catalog-record-review.ts --list --json|--root'
  'review-verify|node --import tsx scripts/catalog-record-review.ts --verify|--runs'
  'review-root|node --import tsx scripts/catalog-record-review.ts --verify --root /x|--runs'
)
named=() want_plain=() want_named=() want_declared=()
for row in "${cut_forms[@]}"; do
  IFS='|' read -r key words more <<< "$row"
  for width in ascii chars bytes; do
    cut_line curator "c-$width-$key-plain" "$width" "$words" "$more"
    cut_line curator-light "c-$width-$key-named" "$width" "$words" "$more"
    cut_line curator-light "c-$width-$key-declared" "$width" "CAPPED_KIND=light $words" "$more"
    named+=("c-$width-$key-named")
  done
  printf '2026-11-13T11:00:00Z curator 400000000 410000000 ok 30 u-%s-plain t3-a: %s\n' "$key" "$words"
  printf '2026-11-13T11:00:00Z curator-light 400000000 410000000 ok 30 u-%s-named t3-a: %s\n' "$key" "$words"
  printf '2026-11-13T11:00:00Z curator-light 400000000 410000000 ok 30 u-%s-declared t3-a: CAPPED_KIND=light %s\n' "$key" "$words"
  named+=("u-$key-named")
  want_plain+=("u-$key-plain curator -> curator-inventory")
  want_named+=("u-$key-plain curator -> curator-inventory" "u-$key-named curator-light -> curator-inventory")
  want_declared+=("u-$key-declared curator-light -> curator-inventory")
done > "$dir/cut.log"
cut_line curator c-ascii-lint-plain ascii 'pnpm exec eslint' src >> "$dir/cut.log"
cut_line curator c-ascii-lintlegs-plain ascii 'pnpm -s lint' --fix >> "$dir/cut.log"
cp "$dir/cut.log" "$dir/admission/peaks.log"
widths=0
while IFS= read -r l; do
  read -r _ _ _ _ _ _ id _ <<< "$l"; [[ $id == c-* ]] || continue
  w=${l#* * * * * * * }
  case $id in c-ascii-*) want='100 100' ;; c-chars-*) want='100 103' ;; *) want='97 100' ;; esac
  [[ $w == *' ' && "$(LC_ALL=C.UTF-8; echo "${#w}") $(LC_ALL=C; echo "${#w}")" == "$want" ]] && widths=$(( widths + 1 ))
done < "$dir/cut.log"
check "each cut line stores its width (characters, bytes) ending in a space (${#cut_forms[@]} forms, 3 cuts, 3 routes)" \
  "$widths" $(( 9 * ${#cut_forms[@]} + 2 ))
check "a cut line ending in a space keeps its class, a plain curator line" "$(LC_ALL=C.UTF-8 "$adm" reclassify)" \
  "$(printf '%s\n' "${want_plain[@]}" 'c-ascii-lint-plain curator -> curator-lint')"
check "a cut line ending in a space keeps its class, a named id (plain curator lines are chosen too)" "$(LC_ALL=C.UTF-8 "$adm" reclassify "${named[@]}")" \
  "$(printf '%s\n' "${want_named[@]}" 'c-ascii-lint-plain curator -> curator-lint')"
check "a cut line ending in a space keeps its class, a line declared light under --declared light" \
  "$(LC_ALL=C.UTF-8 "$adm" reclassify --declared light)" "$(printf '%s\n' "${want_declared[@]}")"
LC_ALL=C.UTF-8 "$adm" reclassify --write > /dev/null
check "--write leaves every cut line's class as it was, but the lint line's" \
  "$(awk '$7 ~ /^c-/ { print $7, $2 }' "$dir/admission/peaks.log")" "$(awk '$7 ~ /^c-/ { print $7, ($7 == "c-ascii-lint-plain" ? "curator-lint" : $2) }' "$dir/cut.log")"
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
check "a declared line's command classifies by its words" "$(kind CAPPED_KIND=light pnpm -s lint) $(kind CAPPED_KIND=test python3 x.py)" "curator-lintlegs curator"
check "without --declared, declared lines keep their kind; plain curator and prep lines change as always" "$("$adm" reclassify)" \
  "$(printf '%s\n' 'd-plain curator -> curator-typecheck' 'd-lint-old curator -> curator-lintlegs' 'd-plain-test curator -> curator-lintlegs' 'd-prep prep-light-2 -> prep-full-2')"
check "--declared light relabels only lines declared light, by their words" "$("$adm" reclassify --declared light)" \
  "$(printf '%s\n' 'd-codegen curator-light -> curator' 'd-lint curator-light -> curator-lintlegs')"
check "--declared test relabels only lines declared test, a plain curator one too" "$("$adm" reclassify --declared test)" \
  "$(printf '%s\n' 'd-test curator-test -> curator' 'd-plain-test curator -> curator-lintlegs')"
check "--declared and named ids select both, and nothing else" "$("$adm" reclassify --declared test d-old)" \
  "$(printf '%s\n' 'd-old curator-light -> curator' 'd-test curator-test -> curator' 'd-plain-test curator -> curator-lintlegs')"
check "--declared with no line declared that kind changes nothing" "$("$adm" reclassify --declared corpus; echo "exit $?")" "exit 0"
"$adm" reclassify --write --declared corpus > /dev/null
check "and --write with it keeps the log and no backup" "$(cmp -s "$dir/declared.log" "$dir/admission/peaks.log" && echo same) $(find "$dir/admission" -name 'peaks.log.bak-*' | wc -l)" "same 0"
"$adm" reclassify --write --declared light > /dev/null
check "--write --declared light rewrites only those lines" "$(awk '{ print $2 }' "$dir/admission/peaks.log" | paste -sd' ')" \
  "curator curator-light curator-lintlegs curator-light curator-test curator curator-light gate-2 curator-light curator curator prep-light-2 curator-light"
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
lint_after=${rec_lint/ curator / curator-lintlegs }
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
printf '%s\r\n%s\n\n%s' "${rec_declared/ curator-light / curator }" "$rec_codegen" "${rec_declared_lint/ curator-light / curator-lintlegs }" > "$dir/bytes/frag-declared.want"
check "--declared keeps a CR, a blank line and a last line with no newline; an undeclared line keeps its class" \
  "$(rewrite frag-declared --declared light) $(same frag-declared) $(paste -sd, "$dir/rw.out")" \
  "0 1 same f-declared curator-light -> curator,f-declared-lint curator-light -> curator-lintlegs"
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
  "0 1 same f-lint curator -> curator-lintlegs,f-codegen curator-light -> curator"
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
# kind, a light prep whose log says it ran full as prep-full, a measured
# catalog-record-review.ts --list as curator-inventory; its --verify --root
# line, cut, and its --t3-run line keep curator.
mkdir -p "$dir/admission" "$dir/logs"
cp "$here/admission-peaks.sample.log" "$dir/admission/peaks.log"
echo 'prep: full (tests/catalog changed)' > "$dir/logs/bounded-prep391b-20261019-213012-638aad.log"
echo 'prep: light, 4 test files' > "$dir/logs/bounded-prep425b-20261020-022205-c8a417.log"
"$adm" reclassify > "$dir/reclassify.out"
check "reclassify alone only says what it would change" "$(cmp -s "$here/admission-peaks.sample.log" "$dir/admission/peaks.log" && echo same) $(grep -c ' -> ' "$dir/reclassify.out")" "same 31"
"$adm" reclassify --write > /dev/null
check "reclassify --write relabels each line by its command" "$(awk '{ print $2 }' "$dir/admission/peaks.log" | paste -sd' ')" \
  "$(printf '%s ' curator-lintlegs curator-lintlegs curator curator-typecheck curator-lint curator-typecheck curator-typecheck \
    curator-corpus curator-corpus curator curator-corpus curator-corpus curator-corpus curator-corpus curator-corpus \
    curator-test curator-test curator-test curator-corpus curator-test curator curator-test curator-test curator-test \
    curator-light curator-light curator-light curator-light curator-corpus curator-light curator-light curator-light \
    curator curator curator curator curator curator prep-full-3 prep-light-3 \
    curator-inventory curator curator | sed 's/ $//')"
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
# lint one killed 2.20 GiB run, under the seed -> 3; the full lint 2 ok runs
# (the seed, 3), max 6.82 GiB raises it -> 7.5 -> 8; the type check one ok run of
# a few MiB, a failed 7.00 GiB run raises it -> 7.7 -> 8; corpus one ok 8.08
# GiB run raises it -> 8.9 -> 9; test 2 ok, a failed 5.68 GiB run raises it
# -> 6.25 -> 6.5; light 7 short ok runs of a few MiB -> 0.5; composites 6.96
# -> 7.7 -> 8, under the largest kind (corpus 9).
check "each kind's reservation comes from its own lines" \
  "$(for c in curator-lint curator-lintlegs curator-typecheck curator-corpus curator-test curator-light curator; do ADMISSION_MIN_SECONDS=0 "$adm" gib "$c"; done | paste -sd' ')" "3 8 8 9 6.5 0.5 9"
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
lib admission_record curator "$dir/s4" stalled 400 r6s "a run the stall guard stopped"
check "nor does a stalled one" "$("$adm" gib curator) $("$adm" table | grep -o 'seed (2 qualifying)')" "8 seed (2 qualifying)"
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
printf 'real_peak=%s\npeak=0\nsamples=3\n' $(( 14 * G )) > "$dir/s14"
lib admission_record gate-1 "$dir/s14" stalled 400 k3 "a stalled gate"
check "so does a stalled one (14 -> 15.4 -> 15.5)" "$("$adm" gib gate-1)" 15.5
for r in g1 g2 g3; do lib admission_record role "$dir/s13" ok 600 "$r" "a model session"; done
check "a role is never recorded and stays at 0" "$("$adm" gib role) $(grep -c ' role ' "$dir/admission/peaks.log")" "0 0"
rm "$dir/admission/peaks.log"
# curator-inventory rises by the same rule: three qualifying runs replace the
# seed (1) with their largest real peak + 10% (5 -> 5.5), and any recorded
# run above that raises it at once (9 -> 9.9 -> 10).
for r in i1 i2 i3; do lib admission_record curator-inventory "$dir/s5" ok 400 "$r" "pnpm -s catalog:launch-inventory --verify --write"; done
check "three qualifying launch inventory runs set curator-inventory (5 -> 5.5)" "$("$adm" gib curator-inventory)" 5.5
lib admission_record curator-inventory "$dir/s9" killed 30 i4 "pnpm -s catalog:launch-inventory --check"
check "a run above it raises curator-inventory at once (9 -> 9.9 -> 10)" "$("$adm" gib curator-inventory)" 10
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

# --- The stall guard ---
# A fake cgroup (ADMISSION_CGROUP) stands in for the scope, so no test needs
# real memory pressure. fakecg <name> <memory.current> <memory.high>
# <full avg300>: its files, the high counter at 0. feed <name>
# [<ticks>:<memory.current>...]: raises that counter every 0.1 s, as a
# throttled scope's rises, setting memory.current for each step's ticks, the
# last step's value after that. Every write is atomic (a rename).
put() { printf '%s\n' "$2" > "$1.tmp" && mv -f "$1.tmp" "$1"; }
fakecg() {
  local cg=$dir/cg-$1; mkdir -p "$cg"
  put "$cg/memory.current" "$2"; put "$cg/memory.peak" "$2"; put "$cg/memory.high" "$3"
  put "$cg/memory.stat" "$(printf 'file 0\nshmem 0')"
  put "$cg/memory.pressure" "$(printf 'some avg10=60.00 avg60=40.00 avg300=%s total=1\nfull avg10=50.00 avg60=30.00 avg300=%s total=1' "$4" "$4")"
  put "$cg/memory.events" "$(printf 'low 0\nhigh 0\nmax 0\noom 0\noom_kill 0')"
}
feed() {
  local cg=$dir/cg-$1; shift
  ( n=0
    for step in "$@" '100000:'; do
      for (( i = 0; i < ${step%%:*}; i++ )); do
        [[ -n ${step#*:} ]] && put "$cg/memory.current" "${step#*:}"
        n=$(( n + 1000 )); put "$cg/memory.events" "$(printf 'low 0\nhigh %s\nmax 0\noom 0\noom_kill 0' "$n")"
        sleep 0.1
      done
    done ) & pids+=($!)
}
# guarded <name> <command...>: admission.sh run reserves <name> (curator-light),
# then runs the command sampled against the fake cg-<name>, a stall suspect
# after 1 s (ADMISSION_SUSPECT_SECONDS) and stopped after 3 s
# (ADMISSION_STALL_SECONDS, or $stop s); stdout and stderr go to <name>.out
# and .err.
guarded() {
  local name=$1; shift
  ( cd "$dir" && ADMISSION_CGROUP=$dir/cg-$name ADMISSION_SAMPLE_INTERVAL=0.2 ADMISSION_SUSPECT_SECONDS=1 ADMISSION_STALL_SECONDS=${stop:-3} \
      "$adm" run "$name" curator-light normal bash -c '. "$1"; shift; admission_run_sampled curator-light "$@"' _ "$adm" "$name" "$@" \
      > "$dir/$name.out" 2> "$dir/$name.err" ) & pids+=($!)
}
# events <event> <id>: the job's events.log lines of that event, after the event word and the id.
events() { awk -v e="$1" -v n="$2" '$2 == e && $3 == n { $1 = $2 = $3 = ""; sub(/^ +/, ""); print }' "$dir/admission/events.log" 2> /dev/null; }
# until_event <event> <id>: waits up to 10 s for one.
until_event() { local _; for _ in $(seq 100); do [[ -n $(events "$1" "$2") ]] && return 0; sleep 0.1; done; return 1; }
G8=$(( 8 * G ))
fakecg st-stall "$G8" "$G8" 6.59; feed st-stall
t0=${EPOCHREALTIME//[!0-9]/}
guarded st-stall bash -c "sleep 60 & echo \$! > $dir/st-stall.pids; echo \$\$ >> $dir/st-stall.pids; wait"; sp=${pids[-1]}
until_event stall-suspect st-stall
check "at its suspect time (1 s here) a stall at the soft limit is recorded and the job runs on" \
  "$(state st-stall) $(for p in $(cat "$dir/st-stall.pids"); do kill -0 "$p" 2> /dev/null && echo -n alive; done)" "active alivealive"
"$adm" status | grep -qE 'st-stall \(curator-light 2G, [0-9]+s, stalled\? [12] s at its soft limit, '
check "admission.sh status shows it as stalled?, with its seconds at the limit" "$?" 0
wait "$sp"; status=$?
elapsed=$(( ${EPOCHREALTIME//[!0-9]/} - t0 ))
check "only after its stop time (3 s here) does the guard stop the job, with exit 79" "$status $(( elapsed >= 3000000 && elapsed < 12000000 ))" "79 1"
check "the whole process group is gone: the command and its child" \
  "$(for p in $(cat "$dir/st-stall.pids"); do kill -0 "$p" 2> /dev/null && echo alive || echo gone; done | paste -sd' ')" "gone gone"
until_state st-stall gone
check "its reservation is released" "$(state st-stall) $(grep -c ' ended st-stall curator-light 2 no process holds it' "$dir/admission/events.log")" "gone 1"
check "its peaks.log line says stalled" "$(awk '$7 == "st-stall" { print $2, $3, $5 }' "$dir/admission/peaks.log")" "curator-light $G8 stalled"
check "a stall-suspect line at each further suspect time (1 s, 2 s): class, GiB, seconds at the limit, the stretch's smallest gap to memory.high, full avg300, the limit and the command" \
  "$(events stall-suspect st-stall | sed -E 's/: .*sleep 60.*$/: sleep 60/' | paste -sd'|')" \
  "curator-light 2 at_limit=1s longest=1s min_gap=0KiB full_avg300=6.59 high=8GiB: sleep 60|curator-light 2 at_limit=2s longest=2s min_gap=0KiB full_avg300=6.59 high=8GiB: sleep 60"
check "at its end, a stall-observed line: the longest time at the limit, its smallest gap, full avg300 then, the suspects and how it ended" \
  "$(events stall-observed st-stall | sed -E 's/: .*sleep 60.*$/: sleep 60/')" "curator-light 2 longest=3s min_gap=0KiB full_avg300=6.59 suspects=2 ended=stalled: sleep 60"
check "stderr: one line per suspect time, then one naming the limit, the time stalled and the advice" "$(wc -l < "$dir/st-stall.err") $(grep -cE '^admission: st-stall may be stalled at its soft memory limit \(memory.high 8 GiB\) for [12] s, full memory pressure 6.59% \(avg300\); it is stopped if it stays there for 3 s\. Run the heavy step as its own capped command, or raise its limit\.$' "$dir/st-stall.err") $(grep -cE '^admission: st-stall stalled at its soft memory limit \(memory.high 8 GiB\) for 3 s: memory.current within 0.25 GiB of it, its high events rising, full memory pressure 6.59% \(avg300\); its process group was stopped with SIGKILL \(exit 79\)\. Run the heavy step as its own capped command, or raise its limit\.$' "$dir/st-stall.err")" "3 2 1"
rm "$dir/admission/peaks.log"   # its 8 GiB peak would raise curator-light
# A suspect that leaves the limit before its stop time runs to a normal end:
# about 1.5 s at the limit, 100 KiB under memory.high, then 4 GiB.
fakecg st-suspect "$G8" "$G8" 6.59; feed st-suspect "15:$(( G8 - 102400 ))" "100:$(( 4 * G ))"
guarded st-suspect sleep 4; sp=${pids[-1]}
until_event stall-suspect st-suspect
sleep 1.5
check "once it leaves the limit, status shows it plain again" \
  "$("$adm" status | grep -c 'st-suspect (curator-light 2G, [0-9]*s, stalled?') $(state st-suspect)" "0 active"
wait "$sp"
check "a suspect that leaves the limit is never stopped: exit 0, recorded ok" "$? $(awk '$7 == "st-suspect" { print $5 }' "$dir/admission/peaks.log")" "0 ok"
check "its stall-observed line: 1 s longest, 100 KiB smallest gap, ended ok" \
  "$(events stall-observed st-suspect | sed -E 's/: .*$//')" "curator-light 2 longest=1s min_gap=100KiB full_avg300=6.59 suspects=1 ended=ok"
rm "$dir/admission/peaks.log"
# Leaving the limit for one sample resets both times: with a 5 s stop time,
# two stretches of about 3 s, over 6 s at the limit in all, each warned from
# 1 s and neither stopped; this command then fails on its own.
fakecg st-reset "$(( 4 * G ))" "$G8" 6.59
stop=5 guarded st-reset bash -c 'sleep 9; exit 1'; sp=${pids[-1]}
until_state st-reset active; feed st-reset "30:$G8" "3:$(( 4 * G ))" "30:$G8" "100:$(( 4 * G ))"
wait "$sp"
check "a job that leaves the limit for one sample is not stopped: both times start again (exit 1, recorded failed)" "$? $(awk '$7 == "st-reset" { print $5 }' "$dir/admission/peaks.log")" "1 failed"
check "each stretch has its own first suspect at 1 s" "$(events stall-suspect st-reset | grep -c ' at_limit=1s ')" 2
check "its stall-observed line says ended failed, its longest stretch under the stop time" \
  "$(events stall-observed st-reset | sed -E 's/: .*$//; s/ longest=[23]s / longest=2-3s /; s/ suspects=[4-6] / suspects=4-6 /')" "curator-light 2 longest=2-3s min_gap=0KiB full_avg300=6.59 suspects=4-6 ended=failed"
rm "$dir/admission/peaks.log"
# None of these is suspected or stopped, though each runs longer than the
# stop time: a run that touches the soft limit twice for under its suspect
# time and recovers, a scope with no memory.high (max), one at its limit with
# little full pressure (cache reclaim, avg300 0.50 < 2.00), and one whose high
# counter no longer rises.
G4=$(( 4 * G ))
fakecg st-touch "$G8" "$G8" 6.59; feed st-touch "5:$G8" "10:$G4" "5:$G8" "100:$G4"
fakecg st-max "$G8" max 50.00; feed st-max
fakecg st-cache "$G8" "$G8" 0.50; feed st-cache
fakecg st-still "$G8" "$G8" 6.59
for name in st-touch st-max st-cache st-still; do guarded "$name" sleep 4; sps+=("${pids[-1]}"); done
for sp in "${sps[@]}"; do wait "$sp"; codes+=("$?"); done
check "a brief touch, no memory.high, low pressure or a still counter is never stopped" "${codes[*]}" "0 0 0 0"
check "and each is recorded ok, with nothing on stderr and no stall event" \
  "$(for name in st-touch st-max st-cache st-still; do awk -v n="$name" '$7 == n { print $5 }' "$dir/admission/peaks.log"; cat "$dir/$name.err"; events stall-suspect "$name"; events stall-observed "$name"; done | paste -sd' ')" "ok ok ok ok"
rm "$dir/admission/peaks.log"

# --- memory.peak at exit ---
# The sampler reads memory.peak every 5 s, so a command that ends sooner is
# read before it has run. Once the command and its sampler have ended, and
# its shell still holds the scope, admission_run_sampled reads memory.peak
# once more, and that is the line's memory.peak; the real peak stays the
# sampled one. exitrun <name> <step> [<exit status>]: admission_run_sampled
# (sampling every 5 s) under a fake cg-<name>, memory.current and
# memory.peak 1 GiB, of a command that waits for the sampler's first sample,
# runs <step> and exits; it prints the exit status, whether the run took
# under 2 s, the bytes it wrote to stdout and stderr, and its line's real
# peak, memory.peak and result.
exitrun() {
  local name=$1 step=$2 code=${3:-0} t0 status
  fakecg "$name" "$G" "$G8" 0.00
  t0=${EPOCHREALTIME//[!0-9]/}
  ( cd "$dir" && ADMISSION_CGROUP=$dir/cg-$name lib admission_run_sampled curator-light "$name" \
      bash -c 'until [[ -s $1 ]]; do sleep 0.02; done; eval "$2"; exit "$3"' _ "$dir/admission/samples/$name" "$step" "$code" > "$dir/$name.out" 2>&1 )
  status=$?
  echo "$status $(( ${EPOCHREALTIME//[!0-9]/} - t0 < 2000000 )) $(wc -c < "$dir/$name.out") $(awk -v n="$name" '$7 == n { print $3, $4, $5 }' "$dir/admission/peaks.log")"
}
check "a peak that rises after the last sample: the line records the final memory.peak, the sampled real peak beside it" \
  "$(exitrun ex-rise "printf '%s\n' $(( 3 * G )) > $dir/cg-ex-rise/memory.peak")" "0 1 0 $G $(( 3 * G )) ok"
check "the exit read keeps the command's exit status and result" \
  "$(exitrun ex-fail "printf '%s\n' $(( 3 * G )) > $dir/cg-ex-fail/memory.peak" 3)" "3 1 0 $G $(( 3 * G )) failed"
check "a scope that is gone at exit: what the sampler last saw, the command's status, nothing on stderr" \
  "$(exitrun ex-gone "rm -r $dir/cg-ex-gone" 0)" "0 1 0 $G $G ok"
check "an unreadable memory.peak (a directory): what the sampler last saw" \
  "$(exitrun ex-dir "rm $dir/cg-ex-dir/memory.peak; mkdir $dir/cg-ex-dir/memory.peak" 0)" "0 1 0 $G $G ok"
check "memory.peak with no number, or empty: what the sampler last saw" \
  "$(exitrun ex-max "printf 'max\n' > $dir/cg-ex-max/memory.peak"; exitrun ex-empty ": > $dir/cg-ex-empty/memory.peak")" "0 1 0 $G $G ok
0 1 0 $G $G ok"
check "a memory.peak read lower at exit never lowers the line's (the larger of the two)" \
  "$(exitrun ex-lower "printf '%s\n' $(( G / 2 )) > $dir/cg-ex-lower/memory.peak")" "0 1 0 $G $G ok"
check "the sample files are removed" "$(ls "$dir/admission/samples" | wc -l)" 0
rm "$dir/admission/peaks.log"

# --- Test sets (mq-s2) ---
# A pure named-test run's set: its test files, ./ stripped, deduplicated and
# sorted, and its worker count (BOUNDED_WORKERS, else 2), whatever the
# launcher; admission_test_set_key. A file counts only as a regular file of
# the repository the command runs in (its working directory holds
# vitest.config.ts) that matches the config's include and that Vitest's
# substring filter matches alone, so keys are worked out in a fixture
# repository, $dir/repo, that holds the files the rows name. keyof <workers, -
# for unset> <command...>: its key, " (-t)" after it for a -t run, or "none:
# <why>". CAPPED_KIND is unset (the top of this file) unless a row sets it.
repo=$dir/repo
mkdir -p "$repo/src/x" "$repo/tests/catalog" "$repo/convex" "$repo/e2e/support" "$repo/e2e/specs" "$repo/node_modules/p/src" "$repo/src/.hidden"
: > "$repo/vitest.config.ts"
for f in src/a.test.ts tests/b.test.ts src/c.test.tsx tests/Z.test.ts tests/a.test.ts src/x/f.test.ts convex/g.test.ts \
  e2e/support/h.test.ts src/d.test.ts src/d.test.tsx tests/e.test.ts tests/E.test.ts tests/catalog/run.test.ts \
  tests/i.test.tsx convex/j.test.tsx e2e/specs/k.test.ts src/a.spec.ts src/.hidden/l.test.ts tests/catalog/q1.test.ts \
  tests/catalog/q2.test.ts tests/catalog/n1.test.ts tests/catalog/n2.test.ts tests/catalog/n3.test.ts tests/catalog/n4.test.ts \
  tests/catalog/z.test.ts tests/catalog/n5.test.ts; do : > "$repo/$f"; done
mkdir "$repo/tests/dir.test.ts"; ln -s a.test.ts "$repo/tests/link.test.ts"
keyof() {
  local w=$1 pre; shift
  if [[ $w == - ]]; then pre=(-u BOUNDED_WORKERS); else pre=("BOUNDED_WORKERS=$w"); fi
  ( cd "${KEY_DIR:-$repo}" && env "${pre[@]}" bash -uc '. "$1"; shift; if admission_test_set_key "$@"; then echo "$set_key${set_filtered:+ (-t)}"; else echo "none: $set_why"; fi' _ "$adm" "$@" 2>&1 )
}
# samekey <key>: each row's command (shell-quoted words) has that key.
samekey() {
  local want=$1 cmd n=0
  while read -r cmd; do
    [[ -n $cmd ]] || continue
    eval "set -- $cmd"
    check "key [$cmd]" "$(keyof - "$@")" "$want"
    n=$(( n + 1 ))
  done
  echo "$n" > "$dir/samekey.n"
}
# The same key across file order, duplicates, ./ prefixes, every launcher, env
# -u words and the options that leave what runs as it is.
samekey 'workers=2 src/a.test.ts tests/b.test.ts' << 'TABLE'
pnpm -s test src/a.test.ts tests/b.test.ts
pnpm test tests/b.test.ts src/a.test.ts
pnpm --silent test ./src/a.test.ts tests/b.test.ts src/a.test.ts
pnpm -s run test tests/b.test.ts ./tests/b.test.ts src/a.test.ts ././src/a.test.ts
pnpm vitest run src/a.test.ts tests/b.test.ts
pnpm -s vitest src/a.test.ts tests/b.test.ts
pnpm exec vitest run src/a.test.ts tests/b.test.ts
pnpm -s exec vitest src/a.test.ts tests/b.test.ts
npx vitest run src/a.test.ts tests/b.test.ts
npx vitest tests/b.test.ts src/a.test.ts
vitest run src/a.test.ts tests/b.test.ts
./node_modules/.bin/vitest run tests/b.test.ts src/a.test.ts
node ./node_modules/vitest/vitest.mjs run src/a.test.ts tests/b.test.ts
node /x/node_modules/vitest/vitest.mjs src/a.test.ts tests/b.test.ts
env -u BOUNDED_HELD_LOCKS pnpm -s test src/a.test.ts tests/b.test.ts
env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR pnpm -s test src/a.test.ts tests/b.test.ts
env --unset=NODE_OPTIONS pnpm -s test src/a.test.ts tests/b.test.ts
pnpm -s test --reporter dot src/a.test.ts tests/b.test.ts
pnpm -s test --reporter=verbose src/a.test.ts tests/b.test.ts --silent
pnpm -s test --silent --bail 1 src/a.test.ts tests/b.test.ts
pnpm -s test --reporter tap-flat src/a.test.ts tests/b.test.ts
pnpm -s test --bail 1 --passWithNoTests --no-color --hideSkippedTests --run src/a.test.ts tests/b.test.ts
pnpm -s test src/a.test.ts --bail=1 tests/b.test.ts
pnpm -s test src/a.test.ts --bail 0 tests/b.test.ts
TABLE
check "every launcher and allowed option is in the table" "$(cat "$dir/samekey.n")" 24
# --reporter keeps the key only with one of the installed Vitest's built-in
# reporters (its ReportersMap; any other name it imports as a module), each
# in both forms; the list admission.sh holds is that map's, so an upgrade
# that changes the map fails here.
check "the built-in reporters admission.sh allows are the installed Vitest's" \
  "$(lib eval 'echo "${admission_set_reporters[*]}"')" \
  "$(cd "$here/../.." && node --input-type=module -e "import { ReportersMap } from 'vitest/reporters'; console.log(Object.keys(ReportersMap).join(' '))")"
for r in $(lib eval 'echo "${admission_set_reporters[*]}"'); do
  check "key [--reporter $r, both forms]" "$(keyof - pnpm -s test --reporter "$r" src/a.test.ts) $(keyof - npx vitest run "--reporter=$r" src/a.test.ts)" \
    'workers=2 src/a.test.ts workers=2 src/a.test.ts'
done
samekey 'workers=2 src/a.test.ts tests/b.test.ts (-t)' << 'TABLE'
pnpm -s test -t 'a name' src/a.test.ts tests/b.test.ts
pnpm -s test src/a.test.ts tests/b.test.ts --testNamePattern=x
pnpm -s test --testNamePattern x tests/b.test.ts src/a.test.ts
npx vitest run -t=x ./src/a.test.ts tests/b.test.ts
TABLE
check "a -t run has its set's key, marked (it is never recorded)" "$(cat "$dir/samekey.n")" 4
check "the worker count is part of the key: 1" "$(keyof 1 pnpm -s test src/a.test.ts tests/b.test.ts)" 'workers=1 src/a.test.ts tests/b.test.ts'
check "the worker count is part of the key: 4" "$(keyof 4 pnpm -s test src/a.test.ts tests/b.test.ts)" 'workers=4 src/a.test.ts tests/b.test.ts'
check "the worker count is part of the key: 2, as when unset" "$(keyof 2 pnpm -s test src/a.test.ts tests/b.test.ts)" 'workers=2 src/a.test.ts tests/b.test.ts'
check "another set has another key: one of the files" "$(keyof - pnpm -s test src/a.test.ts)" 'workers=2 src/a.test.ts'
check "another set has another key: a file more" "$(keyof - pnpm -s test src/a.test.ts tests/b.test.ts src/c.test.tsx)" 'workers=2 src/a.test.ts src/c.test.tsx tests/b.test.ts'
check "files are sorted bytewise, whatever the locale" "$(LC_ALL=C.UTF-8 keyof - pnpm -s test tests/Z.test.ts src/a.test.ts tests/a.test.ts)" 'workers=2 src/a.test.ts tests/Z.test.ts tests/a.test.ts'
# Each of vitest.config.ts's include patterns gives a file a key; the include
# list admission.sh reads (admission_set_path) is the repository's own.
check "a file under each include pattern has a key" \
  "$(keyof - pnpm -s test src/x/f.test.ts src/c.test.tsx convex/g.test.ts tests/catalog/run.test.ts e2e/support/h.test.ts)" \
  'workers=2 convex/g.test.ts e2e/support/h.test.ts src/c.test.tsx src/x/f.test.ts tests/catalog/run.test.ts'
check "the include patterns are vitest.config.ts's" \
  "$(sed -n '/^    include: \[/,/^    \],/p' "$here/../../vitest.config.ts" | sed -n "s/^ *'\(.*\)',$/\1/p" | paste -sd' ')" \
  'src/**/*.test.ts src/**/*.test.tsx convex/**/*.test.ts tests/**/*.test.ts e2e/support/**/*.test.ts'
# nokey: each row, "<why it has none>|<command>", has no key, for that reason.
nokey() {
  local why cmd out n=0
  while IFS='|' read -r why cmd; do
    [[ -n $cmd ]] || continue
    eval "set -- $cmd"
    out=$(keyof - "$@")
    check "no key [$cmd]" "${out:0:$(( ${#why} + 6 ))}" "none: $why"
    n=$(( n + 1 ))
  done
  echo "$n" > "$dir/nokey.n"
}
nokey << 'TABLE'
an option it doesn't allow: --coverage|pnpm -s test --coverage src/a.test.ts
an option it doesn't allow: --no-coverage|pnpm -s test --no-coverage src/a.test.ts
an option it doesn't allow: --pool|pnpm -s test --pool forks src/a.test.ts
an option it doesn't allow: --pool=threads|pnpm -s test --pool=threads src/a.test.ts
an option it doesn't allow: --maxWorkers|pnpm -s test --maxWorkers 4 src/a.test.ts
an option it doesn't allow: --maxWorkers=1|pnpm -s test src/a.test.ts --maxWorkers=1
an option it doesn't allow: --minWorkers|pnpm -s test --minWorkers 1 src/a.test.ts
an option it doesn't allow: --no-isolate|pnpm -s test --no-isolate src/a.test.ts
an option it doesn't allow: --isolate|pnpm -s test --isolate src/a.test.ts
an option it doesn't allow: --no-file-parallelism|pnpm -s test --no-file-parallelism src/a.test.ts
an option it doesn't allow: --globals|pnpm -s test --globals src/a.test.ts
an option it doesn't allow: --project|pnpm -s test --project unit src/a.test.ts
an option it doesn't allow: --project=unit|pnpm -s test --project=unit src/a.test.ts
an option it doesn't allow: -c|pnpm -s test -c vitest.other.ts src/a.test.ts
an option it doesn't allow: --config=x.ts|pnpm -s test --config=x.ts src/a.test.ts
an option it doesn't allow: --root|pnpm -s test --root /x src/a.test.ts
an option it doesn't allow: -r|pnpm -s test -r /x src/a.test.ts
an option it doesn't allow: --dir|pnpm -s test --dir src src/a.test.ts
an option it doesn't allow: --environment|pnpm -s test --environment jsdom src/a.test.ts
an option it doesn't allow: --environment=node|pnpm -s test --environment=node src/a.test.ts
an option it doesn't allow: --shard|pnpm -s test --shard 1/2 src/a.test.ts
an option it doesn't allow: --shard=1/2|pnpm -s test --shard=1/2 src/a.test.ts
an option it doesn't allow: -u|pnpm -s test -u src/a.test.ts
an option it doesn't allow: --update|pnpm -s test --update src/a.test.ts
an option it doesn't allow: --testTimeout|pnpm -s test --testTimeout 1000 src/a.test.ts
an option it doesn't allow: --retry=2|pnpm -s test --retry=2 src/a.test.ts
an option it doesn't allow: --outputFile|pnpm -s test --reporter json --outputFile x.json src/a.test.ts
an option it doesn't allow: --|pnpm -s test -- src/a.test.ts
an option it doesn't allow: --allowOnly|pnpm -s test --allowOnly src/a.test.ts
not a run of named test files only|pnpm -s test --silent=true src/a.test.ts
not a run of named test files only|pnpm -s test --silent=passed-only src/a.test.ts
--silent with a value: --silent src/a.test.ts|pnpm -s test --silent src/a.test.ts tests/b.test.ts
not a run of named test files only|pnpm -s test --silent true src/a.test.ts
not a run of named test files only|npx vitest run --silent passed-only src/a.test.ts
--silent with a value: --silent ./tests/b.test.ts|pnpm -s test src/a.test.ts --silent ./tests/b.test.ts
an option with no value: -t|pnpm -s test src/a.test.ts -t
an option with no value: --reporter|pnpm -s test src/a.test.ts --reporter
an option with no value: --testNamePattern|pnpm -s test src/a.test.ts --testNamePattern
an option with no value: --bail|pnpm -s test src/a.test.ts --bail
an option with no value: --reporter|pnpm -s test src/a.test.ts --reporter --coverage
an option with no value: --reporter|pnpm -s test --reporter --pool=forks src/a.test.ts
an option with no value: --bail|pnpm -s test --bail --testNamePattern=one src/a.test.ts
an option with no value: --bail|pnpm -s test --bail -t=one src/a.test.ts
an option with no value: -t|pnpm -s test -t --coverage src/a.test.ts
an option with no value: --testNamePattern|pnpm -s test --testNamePattern --no-isolate src/a.test.ts
an option with no value: --reporter=|pnpm -s test --reporter= src/a.test.ts
an option with no value: --reporter=--coverage|pnpm -s test --reporter=--coverage src/a.test.ts
an option with no value: --bail=|pnpm -s test --bail= src/a.test.ts
an option with no value: --bail=--pool=forks|pnpm -s test --bail=--pool=forks src/a.test.ts
an option with no value: -t=|pnpm -s test -t= src/a.test.ts
an option with no value: -t=--coverage|pnpm -s test -t=--coverage src/a.test.ts
an option with no value: --testNamePattern=|pnpm -s test --testNamePattern= src/a.test.ts
an option with no value: --testNamePattern=--maxWorkers=8|pnpm -s test --testNamePattern=--maxWorkers=8 src/a.test.ts
a value it doesn't allow: --reporter src/a.test.ts|pnpm -s test --reporter src/a.test.ts tests/b.test.ts
a value it doesn't allow: --reporter=./tests/duration-budget-reporter.ts|pnpm -s test --reporter=./tests/duration-budget-reporter.ts src/a.test.ts
a value it doesn't allow: --bail one|pnpm -s test --bail one src/a.test.ts
a value it doesn't allow: --reporter vitest-sonar-reporter|pnpm -s test --reporter vitest-sonar-reporter src/a.test.ts
a value it doesn't allow: --reporter=vitest-sonar-reporter|pnpm -s test --reporter=vitest-sonar-reporter src/a.test.ts
a value it doesn't allow: --reporter vitest-sonar-reporter|pnpm exec vitest run --reporter vitest-sonar-reporter src/a.test.ts
a value it doesn't allow: --reporter=vitest-sonar-reporter|npx vitest run --reporter=vitest-sonar-reporter src/a.test.ts
a value it doesn't allow: --reporter vitest-sonar-reporter|vitest run src/a.test.ts --reporter vitest-sonar-reporter
a value it doesn't allow: --reporter=vitest-sonar-reporter|node ./node_modules/vitest/vitest.mjs run --reporter=vitest-sonar-reporter src/a.test.ts
a value it doesn't allow: --reporter=junit-reporter|pnpm -s test --reporter=dot --reporter=junit-reporter src/a.test.ts
a value it doesn't allow: --reporter allure-vitest|pnpm -s test --reporter dot --reporter allure-vitest src/a.test.ts
a value it doesn't allow: --reporter=dot,json|pnpm -s test --reporter=dot,json src/a.test.ts
a value it doesn't allow: --reporter=Verbose|pnpm -s test --reporter=Verbose src/a.test.ts
a value it doesn't allow: --reporter @scope/reporter|pnpm -s test --reporter @scope/reporter src/a.test.ts
a value it doesn't allow: --reporter dot json|pnpm -s test --reporter 'dot json' src/a.test.ts
a value it doesn't allow: --reporter=dot json|pnpm -s test --reporter='dot json' src/a.test.ts
a value it doesn't allow: --reporter default blob|npx vitest run --reporter 'default blob' src/a.test.ts
a value it doesn't allow: --reporter=default blob|pnpm exec vitest run --reporter='default blob' src/a.test.ts
a value it doesn't allow: --reporter=dot |pnpm -s test '--reporter=dot ' src/a.test.ts
a value it doesn't allow: --reporter  verbose|vitest run --reporter ' verbose' src/a.test.ts
a value it doesn't allow: --bail=x|pnpm -s test --bail=x src/a.test.ts
a filter word after the test script's own run: run|pnpm -s test run src/a.test.ts tests/b.test.ts
a filter word after the test script's own run: run|pnpm test run src/a.test.ts
a filter word after the test script's own run: run|pnpm -s run test run src/a.test.ts
a filter word after the test script's own run: run|env -u BOUNDED_HELD_LOCKS pnpm test run src/a.test.ts
a package script it doesn't know: vitest|pnpm -s run vitest run src/a.test.ts
not a run of named test files only|npx vitest run run src/a.test.ts
not a run of named test files only|pnpm exec vitest run run src/a.test.ts
a setting that decides workers or what runs, unset: VITEST_MAX_WORKERS|env -u VITEST_MAX_WORKERS pnpm test src/a.test.ts src/c.test.tsx tests/b.test.ts
a setting that decides workers or what runs, unset: VITEST_MAX_WORKERS|env --unset=VITEST_MAX_WORKERS pnpm -s test src/a.test.ts
a setting that decides workers or what runs, unset: VITEST_MAX_WORKERS|env -u BOUNDED_HELD_LOCKS -u VITEST_MAX_WORKERS npx vitest run src/a.test.ts
a setting that decides workers or what runs, unset: VITEST_MAX_WORKERS|env -u BOUNDED_HELD_LOCKS env --unset=VITEST_MAX_WORKERS pnpm -s test src/a.test.ts
a setting that decides workers or what runs, unset: VITEST_MIN_WORKERS|env -u VITEST_MIN_WORKERS pnpm -s test src/a.test.ts
a setting that decides workers or what runs, unset: VITEST_POOL|env --unset=VITEST_POOL pnpm -s test src/a.test.ts
a setting that decides workers or what runs, unset: BOUNDED_WORKERS|env -u BOUNDED_WORKERS pnpm -s test src/a.test.ts
a setting that decides workers or what runs, unset: CI|env -u CI pnpm -s test src/a.test.ts
a setting that decides workers or what runs, unset: CI|env --unset=CI vitest run src/a.test.ts
not a run of named test files only|env -uVITEST_MAX_WORKERS pnpm -s test src/a.test.ts
not a run of named test files only|env --unset VITEST_MAX_WORKERS pnpm -s test src/a.test.ts
a VAR=value word: NODE_OPTIONS=--max-old-space-size=8192|NODE_OPTIONS=--max-old-space-size=8192 pnpm -s test src/a.test.ts
a VAR=value word: VITEST_MAX_WORKERS=4|VITEST_MAX_WORKERS=4 pnpm -s test src/a.test.ts
a VAR=value word: VITEST_POOL=forks|env VITEST_POOL=forks pnpm -s test src/a.test.ts
a VAR=value word: CI=|env -u BOUNDED_HELD_LOCKS CI= pnpm -s test src/a.test.ts
a VAR=value word: CAPPED_KIND=test|CAPPED_KIND=test pnpm -s test src/a.test.ts
a launcher it doesn't know: npm|npm test src/a.test.ts
a launcher it doesn't know: yarn|yarn test src/a.test.ts
a launcher it doesn't know: --filter=web|pnpm --filter=web test src/a.test.ts
not a run of named test files only|npx -y vitest run src/a.test.ts
a launcher it doesn't know: --max-old-space-size=8192|node --max-old-space-size=8192 ./node_modules/vitest/vitest.mjs run src/a.test.ts
a launcher it doesn't know: --import|node --import tsx ./node_modules/vitest/vitest.mjs run src/a.test.ts
not a run of named test files only|env -i pnpm -s test src/a.test.ts
not a run of named test files only|pnpm -s test
not a run of named test files only|pnpm -s test tests/catalog
not a run of named test files only|pnpm -s test tests/catalog/ src/a.test.ts
not a run of named test files only|pnpm -s test party
not a run of named test files only|pnpm -s test -t x
not a run of named test files only|pnpm -s test --exclude x src/a.test.ts
not a run of named test files only|pnpm -s test --changed src/a.test.ts
not a run of named test files only|pnpm -s test --watch src/a.test.ts
not a run of named test files only|bash -c 'pnpm -s test src/a.test.ts'
not a run of named test files only|timeout 600 pnpm -s test src/a.test.ts
not a run of named test files only|pnpm -s lint
not a run of named test files only|pnpm -s test:workflow
a test path that isn't repository-relative: /x/src/a.test.ts|pnpm -s test /x/src/a.test.ts
a test path that isn't repository-relative: ../x/a.test.ts|pnpm -s test src/a.test.ts ../x/a.test.ts
a test path that isn't repository-relative: src/../a.test.ts|pnpm -s test src/../a.test.ts
not a plain test path: src/a b.test.ts|pnpm -s test 'src/a b.test.ts'
not a plain test path: .test.ts|pnpm -s test .test.ts
not a plain test path: .test.ts|pnpm -s test ./.test.ts
not a plain test path: tests/*.test.ts|pnpm -s test 'tests/*.test.ts'
not a plain test path: tests/catalog/?.test.ts|pnpm -s test 'tests/catalog/?.test.ts'
not a plain test path: src/{a,c}.test.ts|pnpm -s test 'src/{a,c}.test.ts'
not a plain test path: src/app/[id]/page.test.tsx|pnpm -s test 'src/app/[id]/page.test.tsx'
not a run of named test files only|pnpm -s test src/a.test.ts:12
not a plain test path: src//a.test.ts|pnpm -s test src//a.test.ts
not a plain test path: src/./a.test.ts|pnpm -s test src/./a.test.ts
not a plain test path: src/.hidden/l.test.ts|pnpm -s test src/.hidden/l.test.ts
not a plain test path: src/node_modules/a.test.ts|pnpm -s test src/node_modules/a.test.ts
a VAR=value word after the launcher: VITEST_CONFIG=/outside/private.ts|pnpm -s test src/a.test.ts VITEST_CONFIG=/outside/private.ts
a VAR=value word after the launcher: NODE_OPTIONS=x.ts|npx vitest run NODE_OPTIONS=x.ts src/a.test.ts
not a test file by vitest.config.ts's include: a.test.ts|pnpm -s test a.test.ts
not a test file by vitest.config.ts's include: test.ts|pnpm -s test test.ts
not a test file by vitest.config.ts's include: tests/i.test.tsx|pnpm -s test tests/i.test.tsx
not a test file by vitest.config.ts's include: convex/j.test.tsx|pnpm -s test convex/j.test.tsx
not a test file by vitest.config.ts's include: e2e/specs/k.test.ts|pnpm -s test e2e/specs/k.test.ts
not a test file by vitest.config.ts's include: src/a.spec.ts|pnpm -s test src/a.spec.ts
not a test file by vitest.config.ts's include: src/a.test.js|pnpm -s test src/a.test.js
not a test file by vitest.config.ts's include: src/a.test.mts|pnpm -s test src/a.test.mts
no such test file here: src/missing.test.ts|pnpm -s test src/a.test.ts src/missing.test.ts
no such test file here: tests/dir.test.ts|pnpm -s test tests/dir.test.ts
no such test file here: tests/link.test.ts|pnpm -s test tests/link.test.ts
a test path Vitest matches in more than one file: src/d.test.ts|pnpm -s test src/d.test.ts
a test path Vitest matches in more than one file: tests/e.test.ts|pnpm -s test tests/e.test.ts
a test path Vitest matches in more than one file: tests/E.test.ts|pnpm -s test tests/E.test.ts
TABLE
check "every refused option, env word, launcher, run and path is in the table" "$(cat "$dir/nokey.n")" 147
check "a file whose name is part of no other test file's has a key" "$(keyof - pnpm -s test src/d.test.tsx)" 'workers=2 src/d.test.tsx'
check "no key where the files can't be checked (no vitest.config.ts in the working directory)" \
  "$(KEY_DIR=$dir keyof - pnpm -s test src/a.test.ts)" "none: can't check the test files: no vitest.config.ts in $dir"
check "no key from a subdirectory of the repository" "$(KEY_DIR=$repo/src keyof - pnpm -s test x/f.test.ts)" "none: not a test file by vitest.config.ts's include: x/f.test.ts"
check "no key for a declared kind: CAPPED_KIND=test" "$(CAPPED_KIND=test keyof - pnpm -s test src/a.test.ts)" 'none: its kind was declared (CAPPED_KIND=test)'
check "no key for a declared kind: CAPPED_KIND=light" "$(CAPPED_KIND=light keyof - pnpm -s test src/a.test.ts)" 'none: its kind was declared (CAPPED_KIND=light)'
check "an empty CAPPED_KIND declares none" "$(CAPPED_KIND= keyof - pnpm -s test src/a.test.ts)" 'workers=2 src/a.test.ts'
check "no key for a worker count capped.sh refuses" "$(keyof 5 pnpm -s test src/a.test.ts)" 'none: BOUNDED_WORKERS must be 1 to 4, not 5'
check "a key computed under set -u says nothing on stderr" "$(keyof - pnpm 2>&1)" "none: not a run of named test files only"


# The store: one file per set, $state/admission/test-sets/<sha256 of its key>,
# its key on the first line, then one line per recorded run: <time> <id>
# <result> <seconds> <real peak> <memory.peak>. admission_run_sampled records
# a keyed run there (admission_record, under the mutex), whatever its result;
# a -t run, a declared kind and a run with no key add nothing. A pnpm stub
# stands in for the test run: it waits for the sampler's first sample (so the
# run has a real peak), sets the fake scope's memory.peak to 0.6 GiB and
# exits with $TS_EXIT. setrun <id> <exit> <command...>: the run under a fake
# cg-sets (real 0.5 GiB); prints its exit status and the bytes it wrote to
# stdout and stderr.
mkdir -p "$dir/tsbin"
printf '%s\n' '#!/usr/bin/env bash' 'until [[ -s $TS_SAMPLE ]]; do sleep 0.02; done' \
  'printf "%s\n" 644245094 > "$TS_CG/memory.peak"' 'exit "${TS_EXIT:-0}"' > "$dir/tsbin/pnpm"
chmod +x "$dir/tsbin/pnpm"
sets=$dir/admission/test-sets
hashof() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }
setrun() {
  local id=$1 code=$2; shift 2
  fakecg sets $(( G / 2 )) "$G8" 0.00
  ( cd "$repo" && PATH=$dir/tsbin:$PATH TS_SAMPLE=$dir/admission/samples/$id TS_EXIT=$code TS_CG=$dir/cg-sets ADMISSION_CGROUP=$dir/cg-sets \
      lib admission_run_sampled curator-test "$id" "$@" > "$dir/$id.out" 2>&1 )
  echo "$? $(wc -c < "$dir/$id.out")"
}
# lines <key>: the set's recorded runs, without their time and with "s" for their seconds.
lines() { tail -n +2 "$sets/$(hashof "$1")" 2> /dev/null | cut -d' ' -f2- | sed 's/ [0-9]* \([0-9]* [0-9]*\)$/ s \1/'; }
unset BOUNDED_WORKERS
key='workers=2 src/a.test.ts tests/b.test.ts'
check "a keyed run keeps its exit status and says nothing more" "$(setrun ts1 0 pnpm -s test ./tests/b.test.ts src/a.test.ts)" "0 0"
check "its set's file is named by the sha256 of the key and starts with the key" \
  "$(ls "$sets") $(head -1 "$sets/$(hashof "$key")")" "$(hashof "$key") $key"
check "its line: time, id, result, seconds, real peak, exact memory.peak at exit" \
  "$(tail -n +2 "$sets/$(hashof "$key")" | awk '{ print ($1 ~ /^[0-9-]+T[0-9:]+Z$/), $2, $3, ($4 ~ /^[0-9]+$/), $5, $6, NF }')" "1 ts1 ok 1 $(( G / 2 )) 644245094 6"
check "the same time as its peaks.log line" "$(tail -1 "$sets/$(hashof "$key")" | cut -d' ' -f1)" "$(awk '$7 == "ts1" { print $1 }' "$dir/admission/peaks.log")"
check "a failed run is recorded with its result and keeps its status" "$(setrun ts2 3 pnpm test src/a.test.ts tests/b.test.ts src/a.test.ts)" "3 0"
check "an env -u run of the same files is the same set" "$(setrun ts3 0 env -u BOUNDED_HELD_LOCKS pnpm -s test src/a.test.ts tests/b.test.ts)" "0 0"
check "a -t run is never recorded (it runs part of the set)" "$(setrun ts4 0 pnpm -s test -t one src/a.test.ts tests/b.test.ts)" "0 0"
check "a declared kind is never recorded" "$(CAPPED_KIND=test setrun ts5 0 pnpm -s test src/a.test.ts tests/b.test.ts)" "0 0"
check "nor is a run with an option that changes what runs" "$(setrun ts6 0 pnpm -s test --coverage src/a.test.ts tests/b.test.ts)" "0 0"
check "nor a -t run whose name pattern follows an option missing its value" "$(setrun ts15 0 pnpm -s test --bail --testNamePattern=one src/a.test.ts tests/b.test.ts)" "0 0"
check "nor a run of the test script with a second run (a filter word)" "$(setrun ts16 0 pnpm test run src/a.test.ts tests/b.test.ts)" "0 0"
check "nor a run that removes capped.sh's worker limit" "$(setrun ts17 0 env -u VITEST_MAX_WORKERS pnpm -s test src/a.test.ts tests/b.test.ts)" "0 0"
check "nor a run with a custom reporter" "$(setrun ts18 0 pnpm -s test --reporter vitest-sonar-reporter src/a.test.ts tests/b.test.ts)" "0 0"
check "the set holds three runs, in order" "$(lines "$key")" "ts1 ok s $(( G / 2 )) 644245094
ts2 failed s $(( G / 2 )) 644245094
ts3 ok s $(( G / 2 )) 644245094"
check "every run, recorded in a set or not, has its peaks.log line" "$(awk '$7 ~ /^ts[1-6]$/ { print $7 }' "$dir/admission/peaks.log" | paste -sd' ')" "ts1 ts2 ts3 ts4 ts5 ts6"
check "another worker count is another set" "$(BOUNDED_WORKERS=1 setrun ts7 0 pnpm -s test src/a.test.ts tests/b.test.ts) $(lines "workers=1 src/a.test.ts tests/b.test.ts" | cut -d' ' -f1) $(ls "$sets" | wc -l)" "0 0 ts7 2"
lib admission_record curator-test "$dir/s4" killed 400 ts8 "x" "$key"
lib admission_record curator-test "$dir/s4" stalled 1800 ts9 "x" "$key"
lib admission_record curator-test "$dir/s4" oom 30 ts10 "x" "$key"
check "killed, stalled and OOM runs are recorded with their result" "$(lines "$key" | tail -3 | cut -d' ' -f1-2 | paste -sd' ')" "ts8 killed ts9 stalled ts10 oom"
# The store changes no reservation: the table reads the same with it and with it moved aside.
before=$("$adm" table); mv "$sets" "$dir/sets.aside"
check "the store changes no reservation" "$("$adm" table)" "$before"
mv "$dir/sets.aside" "$sets"
check "a set's run line holds no path: only its time, id, result and numbers" \
  "$(tail -q -n +2 "$sets"/* | grep -vcE '^[0-9-]+T[0-9:]+Z ts[0-9]+ (ok|failed|killed|oom|stalled) [0-9]+ [0-9]+ [0-9]+$')" 0
# Appends take the mutex peaks.log takes, so a record waits while it is held,
# and concurrent records never lose or mix a line.
( exec 9>> "$dir/admission/mutex"; flock 9; touch "$dir/mutex.held"; sleep 1.5 ) & holder=$!
until [[ -e $dir/mutex.held ]]; do sleep 0.05; done
lib admission_record curator-test "$dir/s4" ok 5 tsm "x" "workers=2 mutex.test.ts" & rec=$!
sleep 0.7
check "an append waits while the mutex is held" "$(lines "workers=2 mutex.test.ts" | wc -l)" 0
wait "$holder" "$rec"
check "and is made once it is free" "$(lines "workers=2 mutex.test.ts" | cut -d' ' -f1)" tsm
# held_probe <function> <args...>: runs it with admission_set_append wrapped
# to write "held" or "free" to $PROBE: whether another open of the mutex
# could lock it at that moment.
held_probe() {
  bash -c '. "$1"; shift; eval "orig_$(declare -f admission_set_append)"
    admission_set_append() { if flock -n "$admission_dir/mutex" true; then echo free; else echo held; fi >> "$PROBE"; orig_admission_set_append "$@"; }
    "$@"' _ "$adm" "$@"
}
check "the append is made while the record holds the mutex" \
  "$(PROBE=$dir/probe held_probe admission_record curator-test "$dir/s4" ok 5 tsp "x" "workers=2 probe.test.ts"; cat "$dir/probe"; lines "workers=2 probe.test.ts" | cut -d' ' -f1)" "held
tsp"
cp=()
for n in $(seq 20); do lib admission_record curator-test "$dir/s4" ok "$n" "c$n" "x" "workers=2 many.test.ts" & cp+=($!); done
wait "${cp[@]}"
check "twenty concurrent records: one key line and twenty whole lines, one per run" \
  "$(head -1 "$sets/$(hashof "workers=2 many.test.ts")") $(grep -c . "$sets/$(hashof "workers=2 many.test.ts")") $(lines "workers=2 many.test.ts" | awk 'NF == 5 { print $1 }' | sort -u | wc -l)" \
  "workers=2 many.test.ts 21 20"
# A store it can't write is skipped: no output, the command's status kept,
# its peaks.log line written. The store moves aside rather than being removed.
mv "$sets" "$dir/sets.kept"; : > "$sets"
check "a store that is a file: the run keeps its status and says nothing" "$(setrun ts11 3 pnpm -s test src/a.test.ts)" "3 0"
check "and its peaks.log line is written" "$(awk '$7 == "ts11" { print $5 }' "$dir/admission/peaks.log")" failed
check "a store record straight through admission_record says nothing either" \
  "$(lib admission_record curator-test "$dir/s4" ok 5 ts14 "x" "$key" 2>&1; echo "$?")" 0
mv -f "$sets" "$dir/sets.file"; mkdir "$sets"
one=$sets/$(hashof 'workers=2 src/a.test.ts')
mkdir "$one"
check "a set file that is a directory: the same" "$(setrun ts12 0 pnpm -s test src/a.test.ts) $(awk '$7 == "ts12" { print $5 }' "$dir/admission/peaks.log")" "0 0 ok"
mv "$one" "$dir/set.dir"
printf 'workers=2 other.test.ts\n' > "$one"
check "a set file whose first line is another key is left as it is" "$(setrun ts13 0 pnpm -s test src/a.test.ts) $(cat "$one")" "0 0 workers=2 other.test.ts"
mv "$sets" "$dir/sets.other"

# admission.sh sets [<command>]: a command's key and history, or the store's summary.
# sets_cli <args...>: admission.sh sets, run in the fixture repository.
sets_cli() { ( cd "$repo" && "$adm" sets "$@" ); }
G27=$(awk 'BEGIN { printf "%d", 2.7 * 2^30 }')
seed() { local k=$1; shift; mkdir -p "$sets"; printf '%s\n' "$k" "$@" > "$sets/$(hashof "$k")"; }
check "an empty store's summary" "$(sets_cli)" "test sets: 0 sets, 0 runs (0 ok); 0 qualify for curator-test-known (two ok runs, every recorded memory.peak at or under 2.7 GiB, none outgrown)"
seed 'workers=2 tests/catalog/q1.test.ts' "2026-11-13T10:00:00Z c1 ok 3 300 $G27" "2026-11-13T10:01:00Z c2 ok 3 300 1000"
seed 'workers=2 tests/catalog/q2.test.ts' "2026-11-13T10:00:00Z c3 ok 3 300 1000" "2026-11-13T10:00:00Z c4 failed 3 300 1000" "2026-11-13T10:00:00Z c5 ok 3 300 1000"
seed 'workers=2 tests/catalog/n1.test.ts' "2026-11-13T10:00:00Z c6 ok 3 300 1000"
seed 'workers=2 tests/catalog/n2.test.ts' "2026-11-13T10:00:00Z c7 ok 3 300 1000" "2026-11-13T10:00:00Z c8 ok 3 300 1000" "2026-11-13T10:00:00Z c9 failed 3 300 $(( G27 + 1 ))"
seed 'workers=2 tests/catalog/n3.test.ts' "2026-11-13T10:00:00Z c10 ok 3 300 1000" "2026-11-13T10:00:00Z c11 ok 3 300 1000" "a cut line"
seed 'workers=2 tests/catalog/n4.test.ts'
: > "$sets/notes.txt"
check "the summary: sets, runs, ok runs, and how many qualify for the small class" "$(sets_cli)" \
  "test sets: 6 sets, 11 runs (9 ok); 2 qualify for curator-test-known (two ok runs, every recorded memory.peak at or under 2.7 GiB, none outgrown)"
check "a command's key, history file, stats and runs" "$(sets_cli pnpm -s test ./tests/catalog/q1.test.ts)" "key: workers=2 tests/catalog/q1.test.ts
history: $sets/$(hashof 'workers=2 tests/catalog/q1.test.ts')
runs: 2 (2 ok), largest memory.peak 2.70 GiB; qualifies for curator-test-known (two ok runs, every recorded memory.peak at or under 2.7 GiB, none outgrown): yes
2026-11-13T10:00:00Z c1 ok 3 300 $G27
2026-11-13T10:01:00Z c2 ok 3 300 1000"
check "one run above 2.7 GiB, whatever its result, keeps a set out" "$(sets_cli pnpm -s test tests/catalog/n2.test.ts | sed -n 3p)" \
  "runs: 3 (2 ok), largest memory.peak 2.70 GiB; qualifies for curator-test-known (two ok runs, every recorded memory.peak at or under 2.7 GiB, none outgrown): no"
check "so does an unreadable line" "$(sets_cli pnpm -s test tests/catalog/n3.test.ts | sed -n 3p)" \
  "runs: 2 (2 ok), 1 unreadable, largest memory.peak 0.00 GiB; qualifies for curator-test-known (two ok runs, every recorded memory.peak at or under 2.7 GiB, none outgrown): no"
check "a set with no runs yet" "$(sets_cli pnpm -s test tests/catalog/z.test.ts | tail -1)" "runs: none recorded"
check "a -t run: its set, and that it is never recorded" "$(sets_cli pnpm -s test -t x tests/catalog/q1.test.ts | sed -n 3p)" \
  "a -t run: only part of its set runs, so it is never recorded"
check "the worker count is taken from BOUNDED_WORKERS, as capped.sh takes it" "$(BOUNDED_WORKERS=3 sets_cli pnpm -s test tests/catalog/q1.test.ts | head -1)" "key: workers=3 tests/catalog/q1.test.ts"
( cd "$repo" && "$adm" sets pnpm -s test --coverage tests/catalog/q1.test.ts > "$dir/sets.out" )
check "a command with no key: why, and 1" "$? $(cat "$dir/sets.out")" "1 no key: an option it doesn't allow: --coverage"
# A history file is shown and counted only when its first line is its key: the
# requested key with a command, the key its name hashes without one. A file
# whose first line is another set's key (two small ok runs here) and an empty
# one are reported and never counted.
n5=$sets/$(hashof 'workers=2 tests/catalog/n5.test.ts')
printf '%s\n' 'workers=2 tests/catalog/q1.test.ts' "2026-11-13T10:00:00Z c12 ok 3 300 1000" "2026-11-13T10:00:00Z c13 ok 3 300 1000" > "$n5"
( cd "$repo" && "$adm" sets pnpm -s test tests/catalog/n5.test.ts > "$dir/sets.out" )
check "a command whose history file starts with another key: reported, nothing shown or counted, and 1" "$? $(cat "$dir/sets.out")" "1 key: workers=2 tests/catalog/n5.test.ts
history: $n5
not counted: its first line is another key: workers=2 tests/catalog/q1.test.ts"
: > "$sets/$(printf '%064d' 0)"
check "the summary counts neither, and says how many files it left out" "$(sets_cli)" \
  "test sets: 6 sets, 11 runs (9 ok); 2 qualify for curator-test-known (two ok runs, every recorded memory.peak at or under 2.7 GiB, none outgrown); 2 files not counted: their first line isn't their key"
mv "$sets" "$dir/sets.cli"; mv "$dir/admission/peaks.log" "$dir/peaks.sets"

# --- The small class for known test sets (mq-s3) ---
# A keyed run (admission_test_set_key, unchanged) whose set's history
# qualifies reserves curator-test-known, 3 GiB; every other run reserves the
# class its words give it, as before. A set qualifies with at least two ok
# runs, every recorded run's memory.peak at or under 2.7 GiB (below 3 / 1.1) and no
# run that outgrew the small class; a failed, killed, OOM or stalled run
# neither counts nor, under the limit, keeps it out. The class reads the
# history file only when its first line is the key (admission_set_stats, as
# admission.sh sets reads it). A table where the small class is 3 GiB and the
# test class 9, as live.
cat > "$dir/known.tsv" << 'TABLE'
budget 16 test
margin 10 test
curator 9 test
curator-lint 9 test
curator-corpus 9 test
curator-test 9 test
curator-test-known 3 test
curator-light 1 test
curator-inventory 1 test
role 0 test
TABLE
export ADMISSION_TABLE=$dir/known.tsv
# kc <command...>: the class capped.sh gives the command, run in the fixture repository.
kc() { ( cd "$repo" && "$adm" class capped 2 "$@" 2>&1 ); }
q1='workers=2 tests/catalog/q1.test.ts'
ok1="2026-11-14T10:00:00Z k1 ok 3 300 1000"
check "a set with no history: the class its words give it" "$(kc pnpm -s test tests/catalog/q1.test.ts)" curator-test
seed "$q1" "$ok1"
check "one ok run: not yet" "$(kc pnpm -s test tests/catalog/q1.test.ts)" curator-test
seed "$q1" "$ok1" "2026-11-14T10:01:00Z k2 ok 3 300 $G27"
check "two ok runs, one at exactly 2.7 GiB: curator-test-known" "$(kc pnpm -s test tests/catalog/q1.test.ts)" curator-test-known
seed "$q1" "$ok1" "2026-11-14T10:01:00Z k2 ok 3 300 $(( G27 + 1 ))"
check "two ok runs, one at 2.7 GiB plus one byte: not" "$(kc pnpm -s test tests/catalog/q1.test.ts)" curator-test
seed "$q1" "$ok1" "2026-11-14T10:01:00Z k2 failed 3 300 1000"
check "an ok run and a failed one: one ok run, not yet" "$(kc pnpm -s test tests/catalog/q1.test.ts)" curator-test
seed "$q1" "$ok1" "2026-11-14T10:01:00Z k2 failed 3 300 1000" "2026-11-14T10:02:00Z k3 ok 3 300 1000"
check "an ok run after a failed one: two ok runs, it qualifies" "$(kc pnpm -s test tests/catalog/q1.test.ts)" curator-test-known
for r in failed killed oom stalled; do
  seed "$q1" "$ok1" "$ok1" "2026-11-14T10:02:00Z k3 $r 3 300 1000"
  check "a $r run under the limit since the last ok one doesn't keep the set out" "$(kc pnpm -s test tests/catalog/q1.test.ts)" curator-test-known
  seed "$q1" "$ok1" "$ok1" "2026-11-14T10:02:00Z k3 $r 3 300 $(( G27 + 1 ))"
  check "a $r run above the limit does" "$(kc pnpm -s test tests/catalog/q1.test.ts)" curator-test
done
seed "$q1" "$ok1" "$ok1" "a cut line"
check "an unreadable line keeps it out" "$(kc pnpm -s test tests/catalog/q1.test.ts)" curator-test
seed "$q1" "$ok1" "$ok1" "2026-11-14T10:02:00Z k3 outgrown-ok 3 300 1000"
check "a run that outgrew the small class keeps it out, whatever its numbers" "$(kc pnpm -s test tests/catalog/q1.test.ts)" curator-test
seed "$q1" "$ok1" "$ok1"
check "a -t run of a qualifying set: the class its words give it" "$(kc pnpm -s test -t one tests/catalog/q1.test.ts)" curator-test
check "a declared kind: its kind" "$(CAPPED_KIND=test kc pnpm -s test tests/catalog/q1.test.ts)" curator-test
check "an option that changes what runs: its words' class" "$(kc pnpm -s test --coverage tests/catalog/q1.test.ts)" curator-test
check "another worker count is another set" "$(BOUNDED_WORKERS=1 kc pnpm -s test tests/catalog/q1.test.ts)" curator-test
check "outside the repository the files can't be checked: its words' class" \
  "$( cd "$dir" && "$adm" class capped 2 pnpm -s test tests/catalog/q1.test.ts)" curator-test
q2='workers=2 tests/catalog/q2.test.ts'
seed "$q2" "$ok1" "$ok1"
mv "$sets/$(hashof "$q2")" "$sets/$(hashof "$q1")"
check "a history file whose first line is another set's key (two small ok runs): the class its words give it" \
  "$(kc pnpm -s test tests/catalog/q1.test.ts)" curator-test
# Every launcher a key allows gets the small class for a qualifying set,
# whatever class its words give it, env -u included; with no history each
# keeps exactly the class it had (env -u ... pnpm test: curator).
known_launchers() {
  local before cmd n=0
  while read -r before cmd; do
    [[ -n $cmd ]] || continue
    eval "set -- $cmd"
    rm -rf "$sets"
    check "no history [$cmd]" "$(kc "$@")" "$before"
    seed "$q1" "$ok1" "$ok1"
    check "qualifying [$cmd]" "$(kc "$@")" curator-test-known
    n=$(( n + 1 ))
  done
  echo "$n" > "$dir/launchers.n"
}
known_launchers << 'TABLE'
curator-test pnpm -s test tests/catalog/q1.test.ts
curator-test pnpm test ./tests/catalog/q1.test.ts tests/catalog/q1.test.ts
curator-test pnpm -s run test tests/catalog/q1.test.ts
curator-test pnpm vitest run tests/catalog/q1.test.ts
curator-test pnpm exec vitest run tests/catalog/q1.test.ts
curator-test npx vitest run tests/catalog/q1.test.ts
curator-test node ./node_modules/vitest/vitest.mjs run tests/catalog/q1.test.ts
curator-test pnpm -s test --reporter dot --bail 1 tests/catalog/q1.test.ts --silent
curator      env -u BOUNDED_HELD_LOCKS pnpm -s test tests/catalog/q1.test.ts
curator      env --unset=NODE_OPTIONS pnpm -s test tests/catalog/q1.test.ts
curator      env -u DBUS_SESSION_BUS_ADDRESS -u XDG_RUNTIME_DIR npx vitest run tests/catalog/q1.test.ts
TABLE
check "every launcher row ran" "$(cat "$dir/launchers.n")" 11
check "a run with no key (a VAR=value word), beside a qualifying set, keeps its words' class" \
  "$(kc env NODE_OPTIONS=--x pnpm -s test tests/catalog/q1.test.ts) $(kc FOO=1 pnpm -s test tests/catalog/q1.test.ts)" "curator-test curator-test"
# The class reads the store outside the admission mutex: with the mutex held
# it answers at once. The read is one history file, never peaks.log.
( exec 9>> "$dir/admission/mutex"; flock 9; touch "$dir/kmutex.held"; sleep 5 ) & holder=$!
until [[ -e $dir/kmutex.held ]]; do sleep 0.05; done
t0=$SECONDS
check "the class is decided while the mutex is held, at once" "$(kc pnpm -s test tests/catalog/q1.test.ts) $(( SECONDS - t0 < 3 ))" "curator-test-known 1"
kill "$holder" 2> /dev/null; wait "$holder" 2> /dev/null
# reclassify relabels by words only: a plain curator line of a qualifying set
# keeps its class, and a curator-test-known line is never chosen.
mkdir -p "$dir/admission"
printf '%s\n' "2026-11-14T10:00:00Z curator 1000 1000 ok 3 rk1 repo: env -u BOUNDED_HELD_LOCKS pnpm -s test tests/catalog/q1.test.ts" \
  "2026-11-14T10:00:00Z curator-test-known 1000 1000 ok 3 rk2 repo: pnpm -s test tests/catalog/q1.test.ts" > "$dir/admission/peaks.log"
check "reclassify never gives the small class: a qualifying set's plain curator line keeps curator" \
  "$( cd "$repo" && "$adm" reclassify --write 2>&1; echo "$?"; cut -d' ' -f2 "$dir/admission/peaks.log" | paste -sd' ')" "0
curator curator-test-known"
rm -f "$dir/admission/peaks.log"
check "admission.sh sets says it qualifies for the small class" "$(sets_cli pnpm -s test tests/catalog/q1.test.ts | sed -n 3p)" \
  "runs: 2 (2 ok), largest memory.peak 0.00 GiB; qualifies for curator-test-known (two ok runs, every recorded memory.peak at or under 2.7 GiB, none outgrown): yes"
# A set's first two runs reserve its words' class; from the third, the small
# class. A -t run adds nothing, so two of them leave a set as it was.
rm -rf "$sets"
n1=(pnpm -s test tests/catalog/n1.test.ts)
first=$(kc "${n1[@]}"); setrun kr1 0 "${n1[@]}" > /dev/null
second=$(kc "${n1[@]}"); setrun kr2 0 "${n1[@]}" > /dev/null
check "first run curator-test, second curator-test, third curator-test-known" "$first $second $(kc "${n1[@]}")" "curator-test curator-test curator-test-known"
setrun kt1 0 pnpm -s test -t one tests/catalog/n2.test.ts > /dev/null; setrun kt2 0 pnpm -s test -t two tests/catalog/n2.test.ts > /dev/null
check "two -t runs are never counted" "$(kc pnpm -s test tests/catalog/n2.test.ts) $(ls "$sets" | wc -l)" "curator-test 1"
rm -rf "$sets" "$dir/admission/peaks.log"

# The small class's reservation: its seed, 3 GiB, and never below it (a set
# qualifies at 2.7 GiB, below its seed / 1.1), though three qualifying runs would
# lower any other class; a recorded run above it raises it as any other.
check "the committed table seeds curator-test-known at 3 GiB, with its source" \
  "$(awk '$1 == "curator-test-known" && NF >= 3 { print $2 }' "$here/memory-reservations.tsv") $(ADMISSION_TABLE= "$adm" gib curator-test-known)" "3 3"
printf 'real_peak=%s\npeak=%s\nsamples=3\n' $(( G / 2 )) $(( G / 2 )) > "$dir/shalf"
for r in kq1 kq2 kq3; do lib admission_record curator-test-known "$dir/shalf" ok 400 "$r" x; lib admission_record curator-test "$dir/shalf" ok 400 "$r-t" x; done
check "three qualifying 0.5 GiB runs lower curator-test (1) but not curator-test-known (3)" \
  "$("$adm" gib curator-test) $("$adm" gib curator-test-known) $("$adm" table | grep -c '^curator-test-known .*seed (3 qualifying; never below it')" "1 3 1"
printf 'real_peak=%s\npeak=%s\nsamples=3\n' $(( 4 * G )) $(( 4 * G )) > "$dir/sfour"
lib admission_record curator-test-known "$dir/sfour" ok 30 kq4 x
check "a recorded run above it raises it (4 -> 4.4 -> 4.5)" "$("$adm" gib curator-test-known)" 4.5
rm -f "$dir/admission/peaks.log"

# A small-class run that outgrows it: a watcher samples its scope every 0.5 s
# (ADMISSION_GROW_INTERVAL, 0.1 s here; the 5 s sampler and its stall guard
# run as before). Once its real use passes 2.7 GiB, the run is recorded as
# curator-test, its set's history line says outgrown, and its reservation
# grows to curator-test's without stopping or slowing the command: granted at
# once when it fits, else pending (status shows it; the queue waits behind
# it, as behind a growing prep) until the active jobs leave room. At most one
# small-class grow is pending at a time: another outgrower waits for it
# (status says so; the queue waits too). A pnpm stub stands in for the test:
# it prints a line on stdout and one on stderr, runs until finish <name>,
# then exits with its code. grow_run <name> <exit> <test file>: admission.sh
# run reserves <name> as curator-test-known, then admission_run_sampled runs
# the stub under the fake cg-<name> (real 0.5 GiB); out <name>: its exit
# status, stdout and stderr. outgrow <name> <GiB>: its scope's real use and
# memory.peak rise to that.
mkdir -p "$dir/gbin"
printf '%s\n' '#!/usr/bin/env bash' 'echo "stub out $*"; echo "stub err" >&2' 'until [[ -e $GROW_GO ]]; do sleep 0.05; done' 'exit "$GROW_EXIT"' > "$dir/gbin/pnpm"
chmod +x "$dir/gbin/pnpm"
grow_run() {
  local name=$1 code=$2 file=$3
  fakecg "$name" $(( G / 2 )) "$G8" 0.00
  ( cd "$repo" && PATH=$dir/gbin:$PATH GROW_GO=$dir/$name.go GROW_EXIT=$code ADMISSION_CGROUP=$dir/cg-$name ADMISSION_GROW_INTERVAL=0.1 \
      "$adm" run "$name" curator-test-known normal bash -c '. "$1"; shift; admission_run_sampled curator-test-known "$@"' _ "$adm" "$name" pnpm -s test "$file" \
      > "$dir/$name.out" 2> "$dir/$name.err"; echo "$?" > "$dir/$name.code" ) & pids+=($!)
}
out() { local _; for _ in $(seq 100); do [[ -s $dir/$1.code ]] && break; sleep 0.1; done; printf '%s|%s|%s' "$(cat "$dir/$1.code" 2> /dev/null)" "$(cat "$dir/$1.out")" "$(cat "$dir/$1.err")"; }
outgrow() { local m; m=$(awk -v g="$2" 'BEGIN { printf "%d", g * 2^30 }'); put "$dir/cg-$1/memory.current" "$m"; put "$dir/cg-$1/memory.peak" "$m"; }
# field <id> <key>: one field of the entry.
field() { sed -n "s/^$2=//p" "$dir/admission/entries/$1.entry" 2> /dev/null; }
# A watcher step writes the entry's fields first and its event after them,
# and field and events read the files without the mutex that status waits
# for, so a check that reads them waits for the last write it reads, never
# for an earlier write of the same step (CI run 43568558277 read the
# escalating event right after the grow field). until_events <n> <event>
# <id>: waits up to 30 s for n of them. until_field <id> <key> <value>:
# waits up to 30 s for the entry's field to read that.
until_events() { local _; for _ in $(seq 300); do (( $(events "$2" "$3" | wc -l) >= $1 )) && return 0; sleep 0.1; done; return 1; }
until_field() { local _; for _ in $(seq 300); do [[ $(field "$1" "$2") == "$3" ]] && return 0; sleep 0.1; done; return 1; }
# order <event> <id> <event> <id>: "before" when the first event's line comes before the second's.
order() { awk -v a="$1 $2 " -v b="$3 $4 " 'index($0, " " a) && !x { x = NR } index($0, " " b) && !y { y = NR } END { print (x && y && x < y) ? "before" : "not" }' "$dir/admission/events.log"; }
seed "$q1" "$ok1" "$ok1"
grow_run g0 0 tests/catalog/q2.test.ts; until_state g0 active
sleep 1; finish g0
check "a small-class run that stays under 2.7 GiB: its status and output, no grow" "$(out g0) $(events outgrown g0 | wc -l)" "0|stub out -s test tests/catalog/q2.test.ts|stub err 0"
check "it is recorded as curator-test-known, and ok in its set's history" \
  "$(awk '$7 == "g0" { print $2, $5 }' "$dir/admission/peaks.log") $(lines "$q2" | cut -d' ' -f1-2)" "curator-test-known ok g0 ok"
grow_run g1 3 tests/catalog/q1.test.ts; until_state g1 active
outgrow g1 3; until_event grown g1
check "past 2.7 GiB it grows to curator-test at once when that fits: 9 GiB, its class curator-test" "$(field g1 class) $(field g1 mib) $(field g1 grow)" "curator-test 9216 -"
check "events: outgrown, then escalating, then grown" "$(order outgrown g1 escalating g1) $(order escalating g1 grown g1)" "before before"
check "the outgrown event says what it saw" "$(events outgrown g1 | sed 's/^curator-test-known 3 //')" "real 3.00 GiB over 2.70 GiB: recorded as curator-test, grows to curator-test 9 GiB"
finish g1
check "the command's exit status, stdout and stderr are untouched" "$(out g1)" "3|stub out -s test tests/catalog/q1.test.ts|stub err"
until_state g1 gone
check "peaks.log records it as curator-test, with its own result" "$(awk '$7 == "g1" { print $2, $3, $5 }' "$dir/admission/peaks.log")" "curator-test $(( 3 * G )) failed"
check "its set's history line says it outgrew the small class" "$(lines "$q1" | tail -1)" "g1 outgrown-failed s $(( 3 * G )) $(( 3 * G ))"
check "and the set no longer qualifies" "$(kc pnpm -s test tests/catalog/q1.test.ts) $(sets_cli pnpm -s test tests/catalog/q1.test.ts | sed -n 3p | grep -o 'yes$\|no$')" "curator-test no"
check "the class it grew to is forgotten once recorded" "$(ls "$dir/admission/classes" 2> /dev/null | wc -l)" 0
# A grow that doesn't fit is pending: status shows it, the queue waits behind
# it, the command runs on; it grows once an active job ends.
run gb curator normal bash -c "$(job gb)"; until_state gb active
grow_run g2 0 tests/catalog/q2.test.ts; until_state g2 active
outgrow g2 3; until_event escalating g2
check "9 + 3, growing to 9 more doesn't fit (18 > 16): pending, shown by status" \
  "$("$adm" status | grep -cE 'g2 \(curator-test-known 3G, [0-9]+s, growing to curator-test 9G, ')" 1
run gq curator-light normal bash -c "$(job gq)"; until_state gq queued; sleep 1
check "a command that fits beside it (9 + 3 + 1) waits behind the grow; the outgrower runs on" "$(state gq) $(state g2) $([[ -e $dir/g2.code ]] && echo ended || echo running)" "queued active running"
finish gb; until_event grown g2
check "once the other job ends it grows (9), and the queue moves on" "$(field g2 class) $(field g2 mib)" "curator-test 9216"
until_state gq active
check "the queued command started after the grow" "$(order grown g2 admitted gq)" before
finish g2; finish gq
check "its status and output are untouched" "$(out g2)" "0|stub out -s test tests/catalog/q2.test.ts|stub err"
until_state g2 gone; until_state gq gone
# Two outgrowers: the second waits for the first's grow to be granted, and
# then it is the pending one. 9 + 3 + 3 = 15 fit; each grow to 9 waits for
# room. Nothing is admitted meanwhile.
run gb2 curator normal bash -c "$(job gb2)"; until_state gb2 active
grow_run g3 0 tests/catalog/n3.test.ts; until_state g3 active
grow_run g4 0 tests/catalog/n4.test.ts; until_state g4 active
outgrow g3 3; until_event escalating g3
outgrow g4 3; until_event outgrown g4; sleep 1
line=$("$adm" status)
check "one pending small-class grow at a time: g3's is pending, g4's waits" \
  "$(grep -o 'growing to' <<< "$line" | wc -l) $(grep -cE 'g3 \(curator-test-known 3G, [0-9]+s, growing to curator-test 9G, ' <<< "$line") $(grep -cE "g4 \(curator-test-known 3G, [0-9]+s, outgrown: its grow to curator-test 9G waits for another's, " <<< "$line") $(events escalating g4 | wc -l)" \
  "1 1 1 0"
check "g4's outgrown event says it waits" "$(events outgrown g4 | grep -c ', its grow waits for g3.s$')" 1
run gq2 curator-light normal bash -c "$(job gq2)"; until_state gq2 queued; sleep 1
check "a command that fits (15 + 1) waits while a small-class run waits to grow" "$(state gq2)" queued
finish gb2; until_event grown g3; until_event escalating g4
check "the first grows once the job ends (9 + 3); then the second is pending (9 + 9 > 16)" \
  "$(field g3 class) $(field g4 class) $(order grown g3 escalating g4) $("$adm" status | grep -cE 'g4 \(curator-test-known 3G, [0-9]+s, growing to curator-test 9G, ')" "curator-test curator-test-known before 1"
check "nothing was admitted meanwhile" "$(state gq2)" queued
finish g3; until_event grown g4; until_state gq2 active
check "it grows when the first ends" "$(field g4 class) $(field g4 mib) $(order grown g4 admitted gq2)" "curator-test 9216 before"
finish g4; finish gq2
check "both commands' status and output are untouched" "$(out g3) $(out g4)" "0|stub out -s test tests/catalog/n3.test.ts|stub err 0|stub out -s test tests/catalog/n4.test.ts|stub err"
until_state g4 gone; until_state gq2 gone
check "both are recorded as curator-test and outgrown" \
  "$(awk '$7 == "g3" || $7 == "g4" { print $2 }' "$dir/admission/peaks.log" | paste -sd' ') $(lines 'workers=2 tests/catalog/n3.test.ts' | cut -d' ' -f2) $(lines 'workers=2 tests/catalog/n4.test.ts' | cut -d' ' -f2)" \
  "curator-test curator-test outgrown-ok outgrown-ok"
# A run that ends before its grow fits: recorded as outgrown all the same,
# and its pending grow ends with it, so the queue moves on.
run gb3 curator normal bash -c "$(job gb3)"; until_state gb3 active
grow_run g5 0 tests/catalog/n5.test.ts; until_state g5 active
outgrow g5 3; until_event escalating g5
run gq3 curator-light normal bash -c "$(job gq3)"; until_state gq3 queued
finish g5
check "it ends with its own status and output" "$(out g5)" "0|stub out -s test tests/catalog/n5.test.ts|stub err"
until_state gq3 active
check "never grown, recorded as curator-test and outgrown; the queue moves on" \
  "$(events grown g5 | wc -l) $(awk '$7 == "g5" { print $2 }' "$dir/admission/peaks.log") $(lines 'workers=2 tests/catalog/n5.test.ts' | cut -d' ' -f2) $(state gq3)" "0 curator-test outgrown-ok active"
finish gb3; finish gq3; until_state gb3 gone; until_state gq3 gone
# The grow never shrinks a reservation and always covers what the run uses:
# every step that could grant it works its target out afresh, under the
# mutex, from the state now, as the largest of curator-test's seed,
# curator-test's reservation, the run's own and its largest real use + 10%,
# rounded up to 0.5 GiB; it grows again by the same rule when its use rises
# past what it holds. Three slow 0.5 GiB runs lower curator-test to 1 GiB (a
# supported case, above), but a run that outgrew the small class is no small
# test, so an outgrower at 3 GiB grows to curator-test's seed, 9, never to 1
# nor to its 3.5.
rm -f "$dir/admission/peaks.log"
printf 'real_peak=%s\npeak=%s\nsamples=3\n' $(( G / 2 )) $(( G / 2 )) > "$dir/shalf"
for r in gl1 gl2 gl3; do lib admission_record curator-test "$dir/shalf" ok 400 "$r" x; done
grow_run g6 0 tests/catalog/n6.test.ts; until_state g6 active
outgrow g6 3; until_event grown g6
check "curator-test lowered to 1 GiB, an outgrower at 3 GiB grows to its seed, 9, not to 1 or 3.5" \
  "$("$adm" gib curator-test) $(field g6 class) $(field g6 mib) $(field g6 grow)" "1 curator-test 9216 -"
check "its outgrown event names the grow it takes" "$(events outgrown g6 | sed 's/^curator-test-known 3 //')" \
  "real 3.00 GiB over 2.70 GiB: recorded as curator-test, grows to curator-test 9 GiB"
outgrow g6 4; sleep 1
check "a rise to 4 GiB (4.4) stays within its 9: no further grow" "$(field g6 mib) $(events outgrown g6 | wc -l)" "9216 1"
outgrow g6 8.5; until_events 2 grown g6
check "its use rises to 8.5 GiB (9.35): it grows again, to 9.5" "$(field g6 class) $(field g6 mib) $(field g6 grow) $(events grown g6 | wc -l)" "curator-test 9728 - 2"
check "the second rise has its own events" "$(events outgrown g6 | wc -l) $(events escalating g6 | tail -1 | sed 's/^curator-test 9 //')" "2 to curator-test 9.5"
finish g6
check "its status and output are untouched" "$(out g6)" "0|stub out -s test tests/catalog/n6.test.ts|stub err"
until_state g6 gone
rm -f "$dir/admission/peaks.log"
# A rise while a grow is pending: the target is never kept from when the grow
# was asked (the grow field is what status shows), so the grant covers the use
# of the moment, and a queued command that fits only beside the older, smaller
# target stays queued. A table where curator-test's seed is 5 GiB.
cat > "$dir/rise.tsv" << 'TABLE'
budget 16 test
margin 10 test
curator 12 test
curator-corpus 10 test
curator-lint 8 test
curator-test 5 test
curator-test-known 3 test
curator-light 1 test
role 0 test
TABLE
export ADMISSION_TABLE=$dir/rise.tsv
# The first grow: 12 + 3 active; past 2.7 GiB it asks for 5 (12 + 5 > 16), and
# its use rises to 6 GiB (6.6) while that is pending. A curator-corpus command
# (10) queues: it would fit beside 5 (15), not beside 7 (17).
run rb curator normal bash -c "$(job rb)"; until_state rb active
grow_run r1 0 tests/catalog/r1.test.ts; until_state r1 active
outgrow r1 3; until_event escalating r1
check "12 + 3 active, its grow to the seed, 5, doesn't fit: pending" "$(field r1 grow)" "curator-test:5120"
outgrow r1 6; until_field r1 grow curator-test:7168; until_events 2 escalating r1
check "its use rises to 6 GiB while the first grow is pending: the pending grow is now to 7, and says so" \
  "$(field r1 grow) $(events escalating r1 | tail -1 | sed 's/^curator-test-known 3 //')" "curator-test:7168 to curator-test 7, was 5"
run rq curator-corpus normal bash -c "$(job rq)"; until_state rq queued
finish rb; until_event grown r1; sleep 1
check "once the other job ends it is granted 7 in one grant; the queued command (7 + 10 > 16) stays queued" \
  "$(field r1 class) $(field r1 mib) $(field r1 grow) $(events grown r1 | wc -l) $(state rq)" "curator-test 7168 - 1 queued"
finish r1; until_state r1 gone; until_state rq active
check "it starts once the outgrower ends; the outgrower's output is untouched" "$(state rq) $(out r1)" "active 0|stub out -s test tests/catalog/r1.test.ts|stub err"
finish rq; until_state rq gone
rm -f "$dir/admission/peaks.log"
# A repeat grow: alone, past 2.7 GiB it grows to 5 at once; a curator-corpus
# command (10) starts beside it (15). Its use rises to 6 GiB: its grow to 7
# is pending (17 > 16), and its use rises to 8 GiB (8.8) meanwhile. A
# curator-lint command (8) queues: it would fit beside 7 (15), not beside 9
# (17).
grow_run r2 0 tests/catalog/r2.test.ts; until_state r2 active
outgrow r2 3; until_event grown r2
run rc curator-corpus normal bash -c "$(job rc)"; until_state rc active
check "the first grow, at once: 5" "$(field r2 class) $(field r2 mib) $(state rc)" "curator-test 5120 active"
outgrow r2 6; until_field r2 grow curator-test:7168
check "a rise to 6 GiB: its repeat grow to 7 is pending" "$(events outgrown r2 | wc -l) $(field r2 mib)" "2 5120"
outgrow r2 8; until_field r2 grow curator-test:9216; until_events 3 escalating r2
check "its use rises to 8 GiB while the repeat grow is pending: the pending grow is now to 9, and says so" \
  "$(field r2 grow) $(events escalating r2 | tail -1 | sed 's/^curator-test 5 //')" "curator-test:9216 to curator-test 9, was 7"
run rq2 curator-lint normal bash -c "$(job rq2)"; until_state rq2 queued
finish rc; until_events 2 grown r2; sleep 1
check "once the other job ends it is granted 9 in one grant; the queued command (9 + 8 > 16) stays queued" \
  "$(field r2 mib) $(field r2 grow) $(events grown r2 | wc -l) $(state rq2)" "9216 - 2 queued"
finish r2; until_state r2 gone; until_state rq2 active
check "it starts once the outgrower ends; the outgrower's output is untouched" "$(state rq2) $(out r2)" "active 0|stub out -s test tests/catalog/r2.test.ts|stub err"
finish rq2; until_state rq2 gone
rm -f "$dir/admission/peaks.log"
export ADMISSION_TABLE=$dir/known.tsv
# The passing rule treats a small-class command as any command that fits: it
# starts past a head that doesn't (9 + 9 > 16; 9 + 3 fits).
run pk-a curator normal bash -c "$(job pk-a)"; until_state pk-a active
run pk-head curator normal bash -c "$(job pk-head)"; until_state pk-head queued
run pk-s curator-test-known normal bash -c "$(job pk-s)"; until_state pk-s active
check "a small-class command passes a head that can't start, as any command that fits" \
  "$(state pk-head) $(grep -cE " admitted pk-s [^ ]+ [0-9.]+ (after [0-9]+ s )?past pk-head\$" "$dir/admission/events.log")" "queued 1"
finish pk-a; until_state pk-head active
check "the head starts once the older command ends (9 + 3)" "$(state pk-head) $(state pk-s)" "active active"
finish pk-head; finish pk-s; until_state pk-head gone; until_state pk-s gone
rm -rf "$sets" "$dir/admission/peaks.log"
export ADMISSION_TABLE=$dir/test.tsv
# The condition sample by sample, on a fake clock: clocked <id> <step>...
# drives admission_stalled as admission_sample does, one sample every 5 s
# (EPOCHREALTIME unset, then set), against cg-clock (memory.high 8 GiB), with
# a suspect time of 20 s and a stop time of 60 s. A step is <n>:<sample>, n
# samples of: at[=<full avg300>[,<KiB under memory.high>]] (default 6.59, 0),
# at the limit with the high counter rising; off, 4 GiB; no=<file>, that file
# missing; bad=<file>, that file unreadable (no number where one belongs);
# the rest as at. It prints the suspects, then the stalled seconds and the
# clock at the stall, or - -, and writes the observation to clock-<id>, as
# the sampler's file holds it.
clocked_run() {
  local cg=$1 id=$2 G8=$3 step sample i t=0 n=0 at=- cur avg gap obs
  local stall_since= stall_count= stall= stall_gap= stall_next= stall_suspect= stall_suspects=0 stall_longest=-1 stall_longest_gap= stall_longest_avg=
  shift 3; unset EPOCHREALTIME
  for step; do
    for (( i = 0; i < ${step%%:*}; i++ )); do
      sample=${step#*:} avg=6.59 gap=0 cur=$G8 n=$(( n + 1000 ))
      [[ $sample == at=* ]] && { avg=${sample#at=}; [[ $avg == *,* ]] && gap=${avg#*,} avg=${avg%%,*}; }
      [[ $sample == off ]] && cur=$(( G8 >> 1 ))
      printf '%s\n' "$(( cur - gap * 1024 ))" > "$cg/memory.current"; printf '%s\n' "$G8" > "$cg/memory.high"
      printf 'low 0\nhigh %s\nmax 0\noom 0\noom_kill 0\n' "$n" > "$cg/memory.events"
      printf 'some avg10=60.00 avg60=40.00 avg300=%s total=1\nfull avg10=50.00 avg60=30.00 avg300=%s total=1\n' "$avg" "$avg" > "$cg/memory.pressure"
      [[ $sample == no=* ]] && rm "$cg/${sample#no=}"
      if [[ $sample == bad=* ]]; then
        case ${sample#bad=} in
          memory.events) printf 'low 0\nhigh\nmax 0\n' ;;
          memory.pressure) printf 'some avg10=60.00 avg60=40.00 avg300=6.59 total=1\nfull avg10=50.00 avg60=30.00 total=1\n' ;;
          *) printf '8G\n' ;;
        esac > "$cg/${sample#bad=}"
      fi
      cur=; read -r cur 2> /dev/null < "$cg/memory.current"
      EPOCHREALTIME=$(( 1000 + t )).000000
      admission_stalled "$cg" "$cur" "$id" clocked 2> /dev/null
      admission_stall_observation; printf '%s' "$obs" > "$cg/../clock-$id"
      [[ -n $stall ]] && { at=$t; break 2; }
      t=$(( t + 5 ))
    done
  done
  echo "$stall_suspects $(sed -n 's/^stalled=//p' <<< "$stall") $at" | sed 's/  / - /'
}
export -f clocked_run
clocked() { local id=$1; shift; mkdir -p "$dir/cg-clock"; ADMISSION_SUSPECT_SECONDS=20 ADMISSION_STALL_SECONDS=60 lib clocked_run "$dir/cg-clock" "$id" "$G8" "$@"; }
check "at the limit throughout: suspects at 20 s and 40 s, the stop at 60 s, timed from the first sample that holds (the first has no counter to compare)" \
  "$(clocked ck-sustained 30:at)" "2 60 65"
check "a sample off the limit adds no time: the window starts at the first sample at the limit, so the stop comes after 60 s of it, not before" \
  "$(clocked ck-off 2:off 30:at)" "2 60 70"
check "full pressure below 2.00% for the whole window never trips" "$(clocked ck-low 40:at=1.99)" "0 - -"
check "pressure that crosses 2.00% late starts the window there: no stop at the crossing, the stop 60 s after it" \
  "$(clocked ck-late 20:at=1.99 1:at=2.00; clocked ck-late2 20:at=1.99 30:at=2.01)" "0 - -
2 60 160"
check "a dip in pressure resets both times" "$(clocked ck-dip 10:at 1:at=1.50 30:at)" "4 60 115"
check "a missing pressure file resets both times; the window starts again at the recovery" \
  "$(clocked ck-nopsi 10:at 1:no=memory.pressure 30:at)" "4 60 115"
check "pressure with no full avg300 resets both times" "$(clocked ck-badpsi 10:at 1:bad=memory.pressure 30:at)" "4 60 115"
check "a missing or unreadable memory.events, memory.current or memory.high never trips" \
  "$(for f in memory.events memory.current memory.high; do clocked "ck-no-$f" "40:no=$f"; clocked "ck-bad-$f" "40:bad=$f"; done | sort -u)" "0 - -"
check "nor does any one of them missing at each fourth sample" \
  "$(for f in memory.events memory.current memory.high memory.pressure; do clocked "ck-gap-$f" $(for _ in 1 2 3 4 5 6 7 8 9 10; do echo 3:at "1:no=$f"; done); done | sort -u)" "0 - -"
# Two unequal stretches: a longer one 100 KiB under memory.high at 6.59%,
# then a shorter one at 0 KiB and 10.00%; and the reverse order.
check "a later, shorter stretch's suspect line gives the longest stretch's own gap and pressure" \
  "$(clocked ck-two 13:at=6.59,100 1:off 6:at=10.00)|$(events stall-suspect ck-two | sed -E 's/ high=.*$//' | paste -sd'|')" \
  "3 - -|at_limit=20s longest=20s min_gap=100KiB full_avg300=6.59|at_limit=40s longest=40s min_gap=100KiB full_avg300=6.59|at_limit=20s longest=55s min_gap=100KiB full_avg300=6.59"
lib admission_stall_observed ck-two "$dir/clock-ck-two" ok clocked
check "and so does its stall-observed line" "$(events stall-observed ck-two | sed -E 's/: .*$//')" "longest=55s min_gap=100KiB full_avg300=6.59 suspects=3 ended=ok"
check "a later, longer stretch takes over with its own gap and pressure" \
  "$(clocked ck-grow 6:at=10.00 1:off 12:at=6.59,100)|$(events stall-suspect ck-grow | sed -E 's/ high=.*$//' | paste -sd'|')" \
  "3 - -|at_limit=20s longest=20s min_gap=0KiB full_avg300=10.00|at_limit=20s longest=20s min_gap=100KiB full_avg300=6.59|at_limit=40s longest=40s min_gap=100KiB full_avg300=6.59"
lib admission_stall_observed ck-grow "$dir/clock-ck-grow" ok clocked
check "and its stall-observed line" "$(events stall-observed ck-grow | sed -E 's/: .*$//')" "longest=55s min_gap=100KiB full_avg300=6.59 suspects=3 ended=ok"
# A stalled run counts as a failed one: reclassify relabels its line by its
# command, keeping its result, and its peak raises the class (8.27 GiB + 10%
# -> 9.5) without qualifying.
printf '2026-11-12T21:06:09Z curator 8880701440 8889798656 stalled 305 st-r1 wt: pnpm -s typecheck\n' > "$dir/admission/peaks.log"
check "reclassify relabels a stalled line and keeps its result" \
  "$("$adm" reclassify --write; cut -d' ' -f2,5 "$dir/admission/peaks.log")" "$(printf 'st-r1 curator -> curator-typecheck\ncurator-typecheck stalled')"
check "table: a stalled run raises its class, as a failed one does" "$("$adm" table | grep -o '^curator-typecheck .*')" \
  "curator-typecheck   9.5 GiB  raised: a recorded real peak 8.27 GiB + 10%"
rm -f "$dir/admission/peaks.log" "$dir"/admission/peaks.log.bak-*

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

# --- A capped.sh command past a head that cannot start (admission-backfill) ---
# A queued capped.sh command (the head) that doesn't fit no longer holds back
# a later capped.sh command that does: it starts past the head. The bound: the
# head is held, and nothing more starts ahead of it, from the moment the
# commands that started past it are all that keep it out; it then waits only
# for those to end. Only capped.sh commands (priority normal) pass, and only
# earlier capped.sh commands are passed: gates, preps and other bounded jobs
# keep their order, and nothing passes them, a pending intent or a growing
# prep. Throughout, a watcher reads the reserved total from status every
# 0.1 s: it never goes over the budget.
# watch_budget <name>: samples status's "reserved/budget" until <name>.stop.
watch_budget() {
  ( while [[ ! -e $dir/$1.stop ]]; do
      "$adm" status 2> /dev/null | sed -n 's#^memory: \([0-9.]*\)/\([0-9.]*\) GiB reserved.*#\1 \2#p'; sleep 0.1
    done > "$dir/$1.budget" ) & pids+=($!)
}
# over_budget <name>: stops the watcher; "<samples over the budget> <whether it took over 20 samples>".
over_budget() { touch "$dir/$1.stop"; sleep 0.5; awk '$1 + 0 > $2 + 0 { n++ } END { print n + 0, (NR > 20) }' "$dir/$1.budget"; }
# admitted_past <id> <head>: its admission events that name the head as passed.
admitted_past() { grep -cE " admitted $1 [^ ]+ [0-9.]+ (after [0-9]+ s )?past ([^ ]+ )*$2( |\$)" "$dir/admission/events.log"; }
watch_budget pass
run q-a curator normal bash -c "$(job q-a)"; until_state q-a active
run q-b curator-light normal bash -c "$(job q-b)"; until_state q-b active
run q-head curator normal bash -c "$(job q-head)"; until_state q-head queued
run q-s1 curator-light normal bash -c "$(job q-s1)"; until_state q-s1 active
check "a capped.sh command that fits (2 of the 6 GiB free) starts past an earlier one that cannot (8)" "$(state q-head) $(state q-s1)" "queued active"
check "its admission says which it passed" "$(admitted_past q-s1 q-head)" 1
"$adm" status | grep -qE 'queued: q-head \(curator 8G, [0-9]+s, passed by q-s1: it needs 8G, 4G free, '
check "status shows the head as passed, by whom and why" "$?" 0
finish q-b; until_state q-b gone
run q-s2 curator-light normal bash -c "$(job q-s2)"; until_state q-s2 queued; sleep 1
check "once the commands that passed it alone keep it out (8 + 8 fits, 8 + 2 + 8 doesn't), it is held: a later one that fits waits" \
  "$(state q-head) $(state q-s2)" "queued queued"
"$adm" status | grep -qE 'queued: q-head \(curator 8G, [0-9]+s, held: passed by q-s1, nothing more passes it, '
check "status shows it held, and why" "$?" 0
finish q-s1; until_state q-head active
check "it starts as soon as they end, ahead of the later command" "$(state q-head) $(state q-s2)" "active queued"
finish q-a; until_state q-s2 active; finish q-head; finish q-s2; until_state q-head gone; until_state q-s2 gone

# The bound under a stream: a small command (2 GiB, 1 s) every 0.3 s, enough
# to keep the free memory busy, while the head (8) waits behind two earlier
# commands (8 + 2). While those run the stream passes it; once the 2 GiB one
# ends, nothing more starts ahead of the head (no "past r-head" admission
# after that end's event), and the head starts once the commands already past
# it end, though the stream goes on. The order is the claim, not the speed:
# the wait for the head has a deadline of 60 s (a loaded CI runner took over
# 4 s once, run 43521588731), and the next check proves that nothing started
# ahead of it meanwhile.
run r-a curator normal bash -c "$(job r-a)"; until_state r-a active
run r-b curator-light normal bash -c "$(job r-b)"; until_state r-b active
run r-head curator normal bash -c "$(job r-head)"; until_state r-head queued
( i=0; while [[ ! -e $dir/r.stop ]]; do
    i=$(( i + 1 )); echo "r-s$i" >> "$dir/r.ids"
    "$adm" run "r-s$i" curator-light normal sleep 1 > /dev/null 2>&1 &
    sleep 0.3
  done; wait ) & stream=$!; pids+=($stream)
sleep 3
passes=$(grep -cE ' admitted r-s[0-9]+ curator-light 2 (after [0-9]+ s )?past r-head$' "$dir/admission/events.log")
check "the stream starts past the head while the head cannot fit" "$(state r-head) $(( passes >= 3 ))" "queued 1"
before=$(wc -l < "$dir/r.ids"); finish r-b
for _ in $(seq 600); do [[ $(state r-head) == active ]] && break; sleep 0.1; done
during=$(( $(wc -l < "$dir/r.ids") - before ))
check "then the head starts once the commands past it end, while the stream goes on" \
  "$(state r-head) $(( during >= 1 ))" "active 1"
check "and nothing starts past it after the 2 GiB command's end" \
  "$(awk '$2 == "ended" && $3 == "r-b" { e = NR } e && NR > e && $2 == "admitted" && / past (.* )?r-head( |$)/ { n++ } END { print (e > 0), n + 0 }' "$dir/admission/events.log")" "1 0"
touch "$dir/r.stop"; finish r-a; finish r-head; wait "$stream"
check "the stream's commands all ran" "$(grep -cE ' admitted r-s[0-9]+ ' "$dir/admission/events.log")" "$(wc -l < "$dir/r.ids")"

# A passer that is killed, or stopped by the stall guard, ends its
# reservation as any job does; a cancelled head lets the later ones go.
run k2-a curator normal bash -c "$(job k2-a)"; until_state k2-a active
run k2-b curator-light normal bash -c "$(job k2-b)"; until_state k2-b active
run k2-head curator normal bash -c "$(job k2-head)"; until_state k2-head queued
run k2-s1 curator-light normal bash -c "$(job k2-s1)"; until_state k2-s1 active
{ kill -KILL "${pids[-1]}"; wait "${pids[-1]}"; } 2> /dev/null; until_state k2-s1 gone
check "a killed passer's reservation ends; the head still waits for memory" "$(state k2-s1) $(state k2-head)" "gone queued"
fakecg st-pass "$G8" "$G8" 6.59; feed st-pass
guarded st-pass bash -c 'sleep 60'; sp=${pids[-1]}; until_state st-pass active
check "a guarded command passes too" "$(admitted_past st-pass k2-head)" 1
wait "$sp"; status=$?; until_state st-pass gone
check "and when the stall guard stops it (79) its reservation ends; the head still waits" "$status $(state st-pass) $(state k2-head)" "79 gone queued"
rm -f "$dir/admission/peaks.log"   # its 8 GiB peak would raise curator-light
"$adm" cancel k2-head > /dev/null; until_state k2-head gone
run k2-s3 curator-light normal bash -c "$(job k2-s3)"; until_state k2-s3 active
check "a cancelled head holds nothing back" "$(state k2-s3) $(grep -c ' admitted k2-s3 .* past ' "$dir/admission/events.log")" "active 0"
finish k2-a; finish k2-b; finish k2-s3; until_state k2-a gone; until_state k2-b gone; until_state k2-s3 gone

# A light prep that turns full while a command is past the head: its growth
# goes first (nothing starts while it waits), it grows once the passer ends,
# and the head waits for memory.
run x-prep prep-light-1 high bash -c "until [[ -e $dir/x-prep.esc ]]; do sleep 0.1; done; '$adm' escalate \"\$BOUNDED_RESERVATION\" > /dev/null 2>&1; echo \$? > $dir/x-prep.escaped; $(job x-prep)"
until_state x-prep active
run x-head curator normal bash -c "$(job x-head)"; until_state x-head queued
run x-s1 curator-light normal bash -c "$(job x-s1)"; until_state x-s1 active
check "past the head beside a light prep (10 + 2; 10 + 8 doesn't fit)" "$(state x-head) $(state x-s1) $(admitted_past x-s1 x-head)" "queued active 1"
touch "$dir/x-prep.esc"
for _ in $(seq 50); do "$adm" status | grep -q 'growing to prep-full-1' && break; sleep 0.2; done
run x-s2 curator-light normal bash -c "$(job x-s2)"; until_state x-s2 queued; sleep 1
check "while the prep grows (15 + 2 > 16), a command that fits beside its light reservation waits" "$(state x-s2) $([[ -e $dir/x-prep.escaped ]] && echo grown || echo waits)" "queued waits"
finish x-s1
for _ in $(seq 50); do [[ -e $dir/x-prep.escaped ]] && break; sleep 0.2; done
check "it grows once the passer ends; the head and the later command wait (15 + 2, 15 + 8 > 16)" "$(cat "$dir/x-prep.escaped") $(state x-head) $(state x-s2)" "0 queued queued"
finish x-prep; until_state x-head active; until_state x-s2 active
finish x-head; finish x-s2; until_state x-head gone; until_state x-s2 gone

# Gates, preps and other bounded jobs keep their order: a capped.sh command
# that fits never passes one, nor does a later bounded job that fits pass an
# earlier one that doesn't.
run h-a curator normal bash -c "$(job h-a)"; until_state h-a active
run h-b curator-light normal bash -c "$(job h-b)"; until_state h-b active
run h-gate gate-1 high bash -c "$(job h-gate)"; until_state h-gate queued
run h-remote prep-remote high bash -c "$(job h-remote)"; until_state h-remote queued
run h-s curator-light normal bash -c "$(job h-s)"; until_state h-s queued; sleep 1
check "a queued gate (10 + 12 > 16) is passed neither by a later prep that fits (2) nor by a capped.sh command that fits (2)" \
  "$(state h-gate) $(state h-remote) $(state h-s)" "queued queued queued"
"$adm" cancel h-gate > /dev/null; until_state h-remote active; until_state h-s active
check "once it is gone they start, the prep first" "$(state h-remote) $(state h-s) $(awk '$2 == "admitted" && ($3 == "h-remote" || $3 == "h-s") { print $3 }' "$dir/admission/events.log" | paste -sd' ')" "active active h-remote h-s"
finish h-a; finish h-b; finish h-remote; finish h-s; until_state h-a gone; until_state h-s gone; until_state h-remote gone
check "the reserved total never went over the budget in any of these interleavings" "$(over_budget pass)" "0 1"
rm -f "$dir/admission/peaks.log"

# A held head stays held until it is admitted or cancelled, whatever the other
# reservations do meanwhile. At the review's numbers (18 GiB; a light prep of
# 10.5 that grows to 13; commands of 7 and 1.5): when the older command ends,
# the passer alone keeps the head out (10.5 + 7 fits, + 1.5 doesn't), and the
# head is held. The prep then grows beside the passer (13 + 1.5), which would
# keep the head out on its own, and the passer ends: a command that fits still
# waits behind the head, as does a second large command queued behind it.
cat > "$dir/held.tsv" << 'TABLE'
budget 18 test
margin 10 test
prep-light-1 10.5 test
prep-full-1 13 test
curator 7 test
curator-light 1.5 test
role 0 test
TABLE
export ADMISSION_TABLE=$dir/held.tsv
watch_budget held
run y-prep prep-light-1 high bash -c "until [[ -e $dir/y-prep.esc ]]; do sleep 0.1; done; '$adm' escalate \"\$BOUNDED_RESERVATION\" > /dev/null 2>&1; echo \$? > $dir/y-prep.escaped; $(job y-prep)"
until_state y-prep active
run y-old curator-light normal bash -c "$(job y-old)"; until_state y-old active
run y-head curator normal bash -c "$(job y-head)"; until_state y-head queued
run y-p1 curator-light normal bash -c "$(job y-p1)"; until_state y-p1 active
check "past the head (10.5 + 1.5 + 7 > 18)" "$(state y-head) $(admitted_past y-p1 y-head)" "queued 1"
finish y-old; until_state y-old gone
for _ in $(seq 50); do grep -q ' held y-head ' "$dir/admission/events.log" && break; sleep 0.2; done
check "once the older command ends the head is held, and events.log says by whom" \
  "$("$adm" status | grep -cE 'queued: y-head \(curator 7G, [0-9]+s, held: passed by y-p1, nothing more passes it, ') $(grep -c ' held y-head curator 7 by y-p1$' "$dir/admission/events.log")" "1 1"
touch "$dir/y-prep.esc"
for _ in $(seq 50); do [[ -e $dir/y-prep.escaped ]] && break; sleep 0.2; done
check "the prep grows beside the passer (13 + 1.5)" "$(cat "$dir/y-prep.escaped")" 0
run y-p2 curator-light normal bash -c "$(job y-p2)"; until_state y-p2 queued; sleep 1
check "the head stays held when a reservation grows: a command that fits (13 + 1.5 + 1.5) waits" "$(state y-p2) $(admitted_past y-p2 y-head)" "queued 0"
run y-big curator normal bash -c "$(job y-big)"; until_state y-big queued
finish y-p1; until_state y-p1 gone; sleep 1
check "and when its passer ends: the head can't start (13 + 7 > 18), and nothing passes it" "$(state y-head) $(state y-p2) $(state y-big)" "queued queued queued"
check "status still shows it held" "$("$adm" status | grep -cE 'queued: y-head \(curator 7G, [0-9]+s, held: nothing more passes it, ')" 1
finish y-prep; until_state y-head active; until_state y-big active; until_state y-p2 active
check "when the prep ends, the head starts first, then the others in their order, none past it" \
  "$(awk '$2 == "admitted" && $3 ~ /^y-(head|big|p2)$/ { print $3 }' "$dir/admission/events.log" | paste -sd' ') $(grep -c ' admitted y-.* past ' "$dir/admission/events.log")" "y-head y-p2 y-big 1"
finish y-head; finish y-big; finish y-p2; until_state y-head gone; until_state y-big gone; until_state y-p2 gone
# A cancelled held head holds nothing back.
run z-a prep-light-1 high bash -c "$(job z-a)"; until_state z-a active
run z-b curator-light normal bash -c "$(job z-b)"; until_state z-b active
run z-head curator normal bash -c "$(job z-head)"; until_state z-head queued
run z-p1 curator-light normal bash -c "$(job z-p1)"; until_state z-p1 active
check "past the head (10.5 + 1.5 + 7 > 18)" "$(admitted_past z-p1 z-head)" 1
finish z-b; until_state z-b gone
for _ in $(seq 50); do grep -q ' held z-head ' "$dir/admission/events.log" && break; sleep 0.2; done
run z-p2 curator-light normal bash -c "$(job z-p2)"; until_state z-p2 queued; sleep 1
check "held (10.5 + 7 fits without the passer): the next command waits" "$(state z-head) $(state z-p2)" "queued queued"
"$adm" cancel z-head > /dev/null; until_state z-head gone; until_state z-p2 active
check "cancelled, it holds nothing back" "$(state z-p2)" active
finish z-a; finish z-p1; finish z-p2; until_state z-a gone; until_state z-p1 gone; until_state z-p2 gone
# A held head is remembered though the head itself doesn't look again before
# its passer ends (Standards r2 #1): the head polls every 30 s here, so only
# others' looks see the older command and the passer end. When status sees
# the older command end (its sweep), the head is held then; when one sweep
# finds both ended, with no look between, a passer still counts until its
# entry is removed, so the head is held all the same. Then the prep grows to
# 13 (13 + 7 > 18) and a command that fits (13 + 1.5) waits behind the head.
for gap in status none; do
  w=w${gap:0:1}   # ids of their own: a cancelled head looks again only after 30 s
  run $w-prep prep-light-1 high bash -c "until [[ -e $dir/$w-prep.esc ]]; do sleep 0.1; done; '$adm' escalate \"\$BOUNDED_RESERVATION\" > /dev/null 2>&1; echo \$? > $dir/$w-prep.escaped; $(job $w-prep)"
  until_state $w-prep active
  run $w-old curator-light normal bash -c "$(job $w-old)"; old=${pids[-1]}; until_state $w-old active
  ADMISSION_INTERVAL=30 run $w-head curator normal bash -c "$(job $w-head)"; until_state $w-head queued
  run $w-p1 curator-light normal bash -c "$(job $w-p1)"; p1=${pids[-1]}; until_state $w-p1 active
  if [[ $gap == status ]]; then
    finish $w-old; until_state $w-old gone; finish $w-p1; until_state $w-p1 gone
  else
    finish $w-old; finish $w-p1; wait "$old" "$p1"
  fi
  touch "$dir/$w-prep.esc"
  for _ in $(seq 50); do [[ -e $dir/$w-prep.escaped ]] && break; sleep 0.2; done
  run $w-p2 curator-light normal bash -c "$(job $w-p2)"; until_state $w-p2 queued; sleep 1
  check "the head's hold is kept with no look of its own between its passer's start and end [$gap between the two ends]" \
    "$(cat "$dir/$w-prep.escaped") $(grep -c " held $w-head curator 7 by $w-p1\$" "$dir/admission/events.log") $(state $w-head) $(state $w-p2) $(admitted_past $w-p2 $w-head)" "0 1 queued queued 0"
  "$adm" cancel $w-head > /dev/null; until_state $w-head gone; until_state $w-p2 active
  finish $w-prep; finish $w-p2; until_state $w-prep gone; until_state $w-p2 gone
done
check "the reserved total never went over the budget" "$(over_budget held)" "0 1"
export ADMISSION_TABLE=$dir/test.tsv
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
# A curator session's slot (hold-lock.sh, beside its commands) isn't inherited
# by its capped.sh commands, so an intent can't tell a slot holder's command
# apart: while a curator lock it waits for is held, it holds back no curator
# command (that could deadlock); while they are free it holds them all back.
intent h-cgate gate-1 "resource curator"; hc=${pids[-1]}; until_state h-cgate queued
run h-cfree curator normal echo h-cfree ran; until_state h-cfree queued; sleep 1
check "an intent waiting for a free curator lock holds back a curator command" "$(state h-cfree)" queued
exec {slot}>> "$dir/curator.lock"; flock "$slot"
check "while a curator lock it waits for is held, the intent holds back no curator command" "$(ran h-cfree && echo ran)" ran
run h-cur curator normal echo h-cur ran
check "and a new one goes too" "$(ran h-cur && echo ran)" ran
exec {slot}>&-
"$adm" cancel h-cgate > /dev/null; touch "$dir/h-cgate.locks"; wait "$hc" 2> /dev/null

# A command whose job declares locks (BOUNDED_HELD_LOCKS: a bounded role's
# worker, gate_operator.py prepare's record verifier) passes a head only as
# any command does: when it fits and the head doesn't, and never once the
# head is held. Only while a gate or prep intent awaits one of its locks does
# it pass whatever is queued, since holding it back could deadlock (the
# intent waits for its job, the head for the intent).
watch_budget locks
run l-a curator normal bash -c "$(job l-a)"; until_state l-a active
run l-b curator-light normal bash -c "$(job l-b)"; until_state l-b active
run l-head curator normal bash -c "$(job l-head)"; until_state l-head queued
BOUNDED_HELD_LOCKS=curator2 run l-own1 curator-light normal bash -c "$(job l-own1)"; until_state l-own1 active
check "a lock holder that fits (12) starts past a head that doesn't (8 + 2 + 8 > 16), as any command does" "$(admitted_past l-own1 l-head)" 1
finish l-b; until_state l-b gone
for _ in $(seq 50); do grep -q ' held l-head ' "$dir/admission/events.log" && break; sleep 0.2; done
BOUNDED_HELD_LOCKS=curator2 run l-own2 curator-light normal bash -c "$(job l-own2)"; until_state l-own2 queued; sleep 1
check "once the head is held (8 + 8 fits without the passer), a lock holder that fits waits too" "$(state l-head) $(state l-own2)" "queued queued"
intent l-gate gate-1 "resource curator2"; lg=${pids[-1]}; until_state l-gate queued
until_state l-own2 active
check "while a gate's intent awaits a lock it holds, it passes the held head and the intent" "$(state l-head) $(state l-own2) $(state l-gate)" "queued active queued"
"$adm" cancel l-gate > /dev/null; touch "$dir/l-gate.locks"; wait "$lg" 2> /dev/null
finish l-own1; finish l-own2; until_state l-own1 gone; until_state l-own2 gone; until_state l-head active
finish l-a; finish l-head; until_state l-a gone; until_state l-head gone
check "the reserved total never went over the budget" "$(over_budget locks)" "0 1"

# --- A gate unit's own intent: claimed from its registration ---
# A gate unit run by hand (gate_operator.py submit, no script driver) has no driver's intent ahead of it, only
# its own, which its wrapper registers before its locks (run-bounded-command.sh, register_job_intent: id
# BOUNDED_ID, class gate-<n>). While it waits for curator2 it already holds curator, and that partial hold is
# its own, not a worker's slot: the intent is claimed from the start, so it lets no curator command past.
export BOUNDED_ID=u-gate; intent u-gate gate-1 "resource curator curator2"; unset BOUNDED_ID
until_state u-gate queued
check "a gate unit's own intent is registered claimed, with a claiming event" \
  "$(grep -c '^claimed=1$' "$dir/admission/entries/u-gate.entry") $(grep -c ' claiming u-gate gate-1 0 a gate unit'"'"'s own intent: it takes its locks now$' "$dir/admission/events.log")" "1 1"
exec {slot}>> "$dir/curator.lock"; flock "$slot"
run u-cur curator normal echo u-cur ran; until_state u-cur queued; sleep 1
check "while the unit holds part of its locks (curator, not curator2), no curator command goes past it" "$(state u-cur)" queued
BOUNDED_HELD_LOCKS="resource curator curator2" run u-own curator normal echo u-own ran
check "the gate's own declared command still goes" "$(ran u-own && echo ran)" ran
exec {slot}>&-
touch "$dir/u-gate.locks"; until_state u-gate active; finish u-gate; until_state u-gate gone
check "once the unit ends, the curator command goes" "$(ran u-cur && echo ran)" ran
# Only a gate unit's own: an intent under another id (a driver's, driver-<id>), a prep unit's own and one
# registered outside a unit stay unclaimed, so a held curator slot still lets curator commands past them.
export BOUNDED_ID=u-unit
intent u-other gate-1 "resource curator"; intent u-unit prep-light-1 "resource curator"
unset BOUNDED_ID
intent u-plain gate-1 "resource curator"
until_state u-other queued; until_state u-unit queued; until_state u-plain queued
check "a driver's, a prep unit's and an outside intent are not claimed" \
  "$(cat "$dir"/admission/entries/u-{other,unit,plain}.entry | grep -c '^claimed=') $(grep -c ' claiming u-' "$dir/admission/events.log")" "0 1"
exec {slot}>> "$dir/curator.lock"; flock "$slot"
run u-slot curator normal echo u-slot ran
check "and a worker's held slot still lets a curator command past them" "$(ran u-slot && echo ran)" ran
exec {slot}>&-
for u in u-other u-unit u-plain; do "$adm" cancel "$u" > /dev/null; touch "$dir/$u.locks"; done
for u in u-other u-unit u-plain; do until_state "$u" gone; done

# --- A gate driver's intent (admission.sh intent): before its prelaunch, until its gate claims its locks ---
# dintent <id> <seconds> [locks...]: runs admission.sh intent with its stdin on
# a fifo this shell keeps open (fd in ${dfd[<id>]}); its output goes to <id>.out.
declare -A dfd
dintent() {
  local id=$1 seconds=$2; shift 2
  mkfifo "$dir/$id.in"
  "$adm" intent "$id" gate-1 "$seconds" "gate-run $id" "$@" < "$dir/$id.in" > "$dir/$id.out" 2>&1 & pids+=($!)
  exec {dfd[$id]}> "$dir/$id.in"
}
said() { local _; for _ in $(seq 50); do grep -q "$2" "$dir/$1.out" 2> /dev/null && return 0; sleep 0.2; done; return 1; }
event() { grep -c " $1 $2 " "$dir/admission/events.log"; }
run d-run curator normal bash -c "$(job d-run); echo d-run finished"; until_state d-run active
dintent d-gate 600 resource curator curator2 land heavy; dg=${pids[-1]}
said d-gate '^intent d-gate$'
check "the driver's intent says it is registered once it is" "$(head -1 "$dir/d-gate.out")" "intent d-gate"
check "the status line shows it waiting for its locks, and events.log its registration" \
  "$("$adm" status | grep -c 'queued: d-gate (gate-1 waiting for its locks, [0-9]*s, gate/prep, gate-run d-gate)') $(event intent d-gate)" "1 1"
run d-cap curator-test normal echo d-cap ran; until_state d-cap queued; sleep 1
check "a capped command started while the intent exists is not admitted" "$(state d-cap) $(event admitted d-cap)" "queued 0"
check "its wait is a queued event behind the intent, and it says so" \
  "$(grep -c ' queued d-cap curator-test 3 behind d-gate$' "$dir/admission/events.log") $(grep -c '^waiting for a gate or prep: d-cap (curator-test, 3 GiB) waits behind d-gate; memory: ' "$dir/d-cap.out")" "1 1"
check "the status line lists it as queued" "$("$adm" status | grep -c 'queued: d-gate (.*), d-cap (curator-test 3G, ')" 1
check "status --for the intent leaves out the intent and what waits behind it" \
  "$("$adm" status --for d-gate | grep -c '; active: d-run (curator 8G, [0-9]*s, [^)]*); queued: none; behind d-gate: d-cap (curator-test 3G, ')" 1
check "status --for an id that is no intent is the plain line" "$("$adm" status --for d-none | grep -c '; queued: d-gate (.*), d-cap (curator-test 3G, [^;]*$')" 1
check "a command that was running when the intent came is not interrupted" "$(state d-run)" active
finish d-run; until_state d-run gone
check "it finishes normally" "$(grep -c '^d-run finished$' "$dir/d-run.out")" 1
sleep 1
check "and the capped command still waits, with nothing active" "$(state d-cap)" queued
printf 'claim\n' >&"${dfd[d-gate]}"
for _ in $(seq 50); do (( $(event claiming d-gate) )) && break; sleep 0.2; done
check "claim (the gate takes its locks next): the intent stays, now ignoring held curator locks" \
  "$(event claiming d-gate) $(grep -c '^claimed=1$' "$dir/admission/entries/d-gate.entry") $(state d-cap)" "1 1 queued"
exec {slot}>> "$dir/curator.lock"; flock "$slot"; sleep 1
check "a claiming intent holds back curator commands though a curator lock is held (its own gate may hold it)" "$(state d-cap)" queued
BOUNDED_HELD_LOCKS="resource curator curator2" run d-own curator normal echo d-own ran
check "but not its gate's own command, which declares the locks it holds" "$(ran d-own && echo ran)" ran
exec {slot}>&-
printf 'end the gate unit claimed its locks\n' >&"${dfd[d-gate]}"; exec {dfd[d-gate]}>&-; wait "$dg"
check "end <why>: the intent ends with 0, its reason in events.log" \
  "$? $(grep -c ' dropped d-gate gate-1 0 the gate unit claimed its locks$' "$dir/admission/events.log") $(state d-gate)" "0 1 gone"
check "and the capped command is admitted, after the intent ended" "$(ran d-cap && echo ran)" ran
check "events.log has it queued, the intent's end, then its admission" \
  "$(grep -E ' (queued d-cap|dropped d-gate|admitted d-cap) ' "$dir/admission/events.log" | awk '{ print $2 }' | tr '\n' ' ')" "queued dropped admitted "
dintent d-eof 600 resource curator; de=${pids[-1]}; said d-eof '^intent d-eof$'
exec {dfd[d-eof]}>&-; wait "$de"
check "an owner that closes its stdin (or dies) ends the intent" "$? $(state d-eof) $(grep -c ' dropped d-eof gate-1 0 its owner ended it$' "$dir/admission/events.log")" "0 gone 1"
dintent d-kill 600 resource curator; dk=${pids[-1]}; said d-kill '^intent d-kill$'
run d-cap2 curator-test normal echo d-cap2 ran; until_state d-cap2 queued
{ kill -KILL "$dk"; wait "$dk"; } 2> /dev/null
check "a stale intent (its process gone) is swept like any other entry, and the command goes" \
  "$(ran d-cap2 && echo ran) $(state d-kill) $(grep -c ' ended d-kill gate-1 0 no process holds it$' "$dir/admission/events.log")" "ran gone 1"
exec {dfd[d-kill]}>&-
dintent d-limit 1 resource curator; dl=${pids[-1]}; said d-limit '^intent d-limit$'
wait "$dl"
check "an intent past its limit ends with 73 and a timeout event" "$? $(state d-limit) $(grep -c ' timeout d-limit gate-1 0 after its 1 s limit$' "$dir/admission/events.log")" "73 gone 1"
exec {dfd[d-limit]}>&-
dintent d-term 600 resource curator; dt=${pids[-1]}; said d-term '^intent d-term$'
kill -TERM "$dt"; wait "$dt"
check "TERM ends the intent with 143" "$? $(state d-term) $(grep -c ' dropped d-term gate-1 0 signal$' "$dir/admission/events.log")" "143 gone 1"
exec {dfd[d-term]}>&-
dintent d-cancel 600 resource curator; dc=${pids[-1]}; said d-cancel '^intent d-cancel$'
"$adm" cancel d-cancel > /dev/null; wait "$dc"
check "a cancelled intent's process ends with 143" "$? $(state d-cancel)" "143 gone"
exec {dfd[d-cancel]}>&-
"$adm" intent d-bad gate-1 soon x < /dev/null > /dev/null 2>&1
check "an intent's limit must be whole seconds (64)" "$?" 64
# Two drivers: each one's view puts the later intent behind it, so neither waits for the other forever.
dintent d-first 600 resource curator; said d-first '^intent d-first$'
dintent d-second 600 resource curator; said d-second '^intent d-second$'
check "the earlier intent sees the later one behind it" "$("$adm" status --for d-first | grep -c '; queued: none; behind d-first: d-second (gate-1 waiting for its locks, ')" 1
check "the later intent sees the earlier one ahead" "$("$adm" status --for d-second | grep -c '; queued: d-first (gate-1 waiting for its locks, .*; behind d-second: none$')" 1
exec {dfd[d-first]}>&- {dfd[d-second]}>&-
for _ in $(seq 50); do [[ $(state d-first)$(state d-second) == gonegone ]] && break; sleep 0.2; done

# --- A gate's resource observer (gate_operator.py, capped.sh with BOUNDED_GATE_UNIT): part of its gate ---
# The incident of 2026-11-09 (gear-s1-gate-r1): a driver intent held back worker commands; its gate unit was
# admitted near the budget; the observer then queued first come first served behind an earlier worker command
# and was admitted only once the unit ended. An entry that names its gate unit is admitted at once while that
# unit's (high) entry is active, reserving nothing: the unit's reservation counts it.
run o-run curator-test normal bash -c "$(job o-run)"; until_state o-run active
dintent o-drv 600 resource curator curator2 land heavy; od=${pids[-1]}; said o-drv '^intent o-drv$'
run o-w1 curator normal bash -c "$(job o-w1)"; until_state o-w1 queued
intent o-unit gate-1 "resource curator curator2"; until_state o-unit queued
printf 'claim\n' >&"${dfd[o-drv]}"; touch "$dir/o-unit.locks"; until_state o-unit active
printf 'end the gate unit claimed its locks\n' >&"${dfd[o-drv]}"; exec {dfd[o-drv]}>&-; wait "$od"
check "the interleaving: the unit is active near the budget (3 + 12 of 16), the worker command still queued" \
  "$(state o-run) $(state o-unit) $(state o-w1) $(state o-drv)" "active active queued gone"
run o-plain curator-light normal bash -c "$(job o-plain)"; until_state o-plain queued; sleep 1
check "a light command that names no gate unit still queues behind the earlier worker command" "$(state o-plain)" queued
BOUNDED_GATE_UNIT=o-unit run o-obs curator-light normal echo o-obs ran
check "the gate's observer is admitted at once, though it would not fit (15 + 2 of 16) and an earlier command waits" \
  "$(ran o-obs && echo ran) $(state o-w1) $(state o-plain)" "ran queued queued"
check "its admission reserves nothing more and says whose reservation counts it" \
  "$(grep -c ' admitted o-obs curator-light 0 inside gate unit o-unit'"'"'s reservation$' "$dir/admission/events.log") $(grep -c ' queued o-obs ' "$dir/admission/events.log")" "1 0"
BOUNDED_GATE_UNIT=o-run run o-normal curator-light normal echo o-normal ran
BOUNDED_GATE_UNIT=o-none run o-stray curator-light normal echo o-stray ran
until_state o-normal queued; until_state o-stray queued; sleep 1
check "naming a normal command or a missing entry as the gate unit changes nothing: both queue" "$(state o-normal) $(state o-stray)" "queued queued"
"$adm" cancel o-normal > /dev/null; "$adm" cancel o-stray > /dev/null
# The observer starts right after its gate's submission, so its unit may still wait for its locks or memory:
# it then waits, and goes as soon as the unit is admitted.
"$adm" cancel o-w1 > /dev/null; "$adm" cancel o-plain > /dev/null; finish o-unit; until_state o-unit gone
intent o-unit2 gate-1 "resource curator curator2"; until_state o-unit2 queued
run o-w2 curator normal bash -c "$(job o-w2)"; until_state o-w2 queued
BOUNDED_GATE_UNIT=o-unit2 run o-obs2 curator-light normal bash -c "$(job o-obs2)"; until_state o-obs2 queued; sleep 1
check "while its unit waits for its locks, the observer waits too" "$(state o-obs2)" queued
touch "$dir/o-unit2.locks"; until_state o-unit2 active; until_state o-obs2 active
check "and is admitted once its unit is, ahead of the earlier command" "$(state o-unit2) $(state o-obs2) $(state o-w2)" "active active queued"
finish o-obs2; finish o-unit2; finish o-run; until_state o-unit2 gone; until_state o-obs2 gone
until_state o-w2 active; finish o-w2; until_state o-w2 gone

# --- yield: a curator slot taker's pre-acquire check (hold-lock.sh), while a gate or prep intent waits ---
# yielder <name> [seconds]: runs admission.sh yield in the background; its pid in ${yp[<name>]}, its output in <name>.out.
declare -A yp
yielder() { "$adm" yield ${2:+"$2"} > "$dir/$1.out" 2>&1 & yp[$1]=$!; pids+=($!); }
running() { kill -0 "${yp[$1]}" 2> /dev/null; }
# ended <name>: waits up to 10 s for the yield to end and leaves its exit status in $yrc (called in this shell, its parent).
ended() { local _; for _ in $(seq 50); do running "$1" || break; sleep 0.2; done; wait "${yp[$1]}"; yrc=$?; }
started=$SECONDS; "$adm" yield > "$dir/y-none.out" 2>&1
check "yield with no intent returns 0 at once, says nothing and records nothing" \
  "$? $(( SECONDS - started < 3 )) $(wc -c < "$dir/y-none.out") $(grep -c ' yield-' "$dir/admission/events.log")" "0 1 0 0"
run y-act curator normal bash -c "$(job y-act)"; until_state y-act active
run y-que gate-4 high bash -c "$(job y-que)"; until_state y-que queued
"$adm" yield > /dev/null 2>&1
check "an active command and a job queued for memory (it holds its locks) are no intent to yield to" "$?" 0
finish y-act; until_state y-act gone; until_state y-que active; finish y-que; until_state y-que gone
dintent y-gate 600 resource curator curator2 land heavy; said y-gate '^intent y-gate$'
yielder y-wait; sleep 1
check "while a gate driver's intent waits, yield waits" "$(running y-wait && echo waiting)" waiting
said y-wait 'waits behind'
check "it says so once on stderr, with the status line" \
  "$(grep -c "^waiting for a gate or prep: yield-${yp[y-wait]} waits behind y-gate; memory: 0/16 GiB reserved; active: none; queued: y-gate (" "$dir/y-wait.out") $(wc -l < "$dir/y-wait.out")" "1 1"
check "and records a queued event behind the intent" "$(grep -c " queued yield-${yp[y-wait]} yield 0 behind y-gate$" "$dir/admission/events.log")" 1
check "yield takes no entry, so the gate's own view stays idle" "$("$adm" status --for y-gate)" "memory: 0/16 GiB reserved; active: none; queued: none; behind y-gate: none"
printf 'end done\n' >&"${dfd[y-gate]}"; exec {dfd[y-gate]}>&-
ended y-wait; check "once the intent ends, yield returns 0" "$yrc" 0
check "with an admitted event after its wait" "$(grep -c " admitted yield-${yp[y-wait]} yield 0 after [0-9]* s$" "$dir/admission/events.log")" 1
# The claim/lock handoff (spec r1 #1): from the claim until the gate unit holds its locks, the gate holds
# no lock of its own for long (prepare and submit take theirs and release them), so a slot taker that went
# ahead there could take a slot the gate needs while its command waits behind the claimed intent, and each
# would wait for the other. So yield waits on a claimed intent too, and on the unit's intent while it
# waits for its locks; the worker's slot is taken only after the unit holds them.
dintent y-claim 600 resource curator curator2 land heavy; said y-claim '^intent y-claim$'
printf 'claim\n' >&"${dfd[y-claim]}"
for _ in $(seq 50); do (( $(event claiming y-claim) )) && break; sleep 0.2; done
# worker: yield, then the slot (as hold-lock.sh would), then its undeclared capped command.
{ "$adm" yield 2> "$dir/y-worker.err"; echo "yield $?" >> "$dir/y-worker.out"; exec 9>> "$dir/curator.lock"; flock -n 9 && echo slot >> "$dir/y-worker.out"; } &
yp[y-worker]=$!; pids+=($!)
sleep 1
check "handoff: a slot taker's yield waits behind a claimed intent" "$(running y-worker && echo waiting) $(cat "$dir/y-worker.out" 2> /dev/null | grep -c '^slot$')" "waiting 0"
intent y-unit2 gate-1 "resource curator curator2"; until_state y-unit2 queued
exec {u1}>> "$dir/curator.lock" {u2}>> "$dir/curator2.lock"; flock "$u1"; flock "$u2"   # the gate unit takes its locks
run y-free curator normal echo y-free ran; until_state y-free queued; sleep 1
check "handoff: while the unit holds part of its locks, the claimed driver intent holds back an undeclared command" "$(state y-free)" queued
check "handoff: and the slot taker still waits, with no slot" "$(running y-worker && echo waiting) $(cat "$dir/y-worker.out" 2> /dev/null | grep -c '^slot$')" "waiting 0"
touch "$dir/y-unit2.locks"; until_state y-unit2 active                                   # it holds them all and has its memory
printf 'end the gate unit claimed its locks\n' >&"${dfd[y-claim]}"; exec {dfd[y-claim]}>&-
ended y-worker
check "handoff: once the unit holds its locks, yield returns and the slot is the gate's (busy): the worker waits for a lock, not in admission" \
  "$(grep -c '^yield 0$' "$dir/y-worker.out") $(grep -c '^slot$' "$dir/y-worker.out")" "1 0"
exec {u1}>&- {u2}>&-; finish y-unit2; until_state y-unit2 gone
check "and the held-back command goes" "$(ran y-free && echo ran)" ran
for _ in $(seq 50); do [[ $(state y-claim) == gone ]] && break; sleep 0.2; done
intent y-unit gate-1 "resource curator curator2"; until_state y-unit queued
yielder y-u; sleep 1
check "a gate unit's (or prep's) intent waiting for its locks is waited on too" "$(running y-u && echo waiting)" waiting
touch "$dir/y-unit.locks"; until_state y-unit active
ended y-u; check "until it holds its locks" "$yrc" 0
finish y-unit; until_state y-unit gone
dintent y-kill 600 resource curator; yk=${pids[-1]}; said y-kill '^intent y-kill$'
yielder y-k; sleep 1
{ kill -KILL "$yk"; wait "$yk"; } 2> /dev/null
ended y-k; check "an intent whose process is gone is swept, and yield returns 0" "$yrc $(state y-kill)" "0 gone"
exec {dfd[y-kill]}>&-
dintent y-lim 600 resource curator; said y-lim '^intent y-lim$'
yielder y-l 1
ended y-l; check "yield <seconds> gives up after its limit with 73" "$yrc" 73
check "with a timeout event" "$(grep -c " timeout yield-${yp[y-l]} yield 0 after 1 s$" "$dir/admission/events.log")" 1
yielder y-t; sleep 1; kill -TERM "${yp[y-t]}"
ended y-t; check "TERM ends a yield with 143" "$yrc" 143
check "with a cancelled event" "$(grep -c " cancelled yield-${yp[y-t]} yield 0 signal$" "$dir/admission/events.log")" 1
exec {dfd[y-lim]}>&-; for _ in $(seq 50); do [[ $(state y-lim) == gone ]] && break; sleep 0.2; done
"$adm" yield soon > /dev/null 2>&1
check "a limit that isn't whole seconds is refused with 64" "$?" 64

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

# --- The disk floor (disk_guard.py) ---
# A capped.sh command (normal priority) below a floor is refused with 74 before it registers; the incident's
# btrfs volume: free data, metadata at its 0.5 GiB reserve and nothing unallocated.
mkdir -p "$dir/sys/fs/btrfs/fixture-fsid/allocation/"{data,metadata,system} "$dir/sys/fs/btrfs/fixture-fsid/devices/fixture0"
alloc=$dir/sys/fs/btrfs/fixture-fsid/allocation
echo $(( 440 << 30 )) > "$alloc/data/disk_total"; echo $(( 12 << 30 )) > "$alloc/metadata/disk_total"; echo $(( 64 << 20 )) > "$alloc/system/disk_total"
echo $(( 6 << 30 )) > "$alloc/metadata/total_bytes"; echo $(( 21 << 28 )) > "$alloc/metadata/bytes_used"; echo $(( 1 << 29 )) > "$alloc/global_rsv_size"
echo $(( ((440 << 30) + (12 << 30) + (64 << 20)) / 512 )) > "$dir/sys/fs/btrfs/fixture-fsid/devices/fixture0/size"
printf '20 1 0:46 / / rw - btrfs /dev/fixture0 rw\n' > "$dir/btrfs-mountinfo"
full() { DISK_GUARD_SYSFS=$dir/sys DISK_GUARD_MOUNTINFO=$dir/btrfs-mountinfo DISK_GUARD_FREE_BYTES=$(( 20 << 30 )) "$@"; }
full "$adm" run d-full curator-test normal bash -c 'echo ran' > "$dir/d-full.out" 2>&1
check "a capped command below the disk floor is refused with 74 and never runs" "$? $(grep -c '^ran$' "$dir/d-full.out")" "74 0"
check "the refusal names the floor and its values" "$(grep -c '^admission: d-full refused: disk floor: /: btrfs metadata headroom 0.25 GiB < 1.00 GiB and unallocated 0.00 GiB < 2.00 GiB (floors: free data 15 GiB; metadata headroom 1 GiB unless 2 GiB unallocated); not started$' "$dir/d-full.out")" 1
check "a refused command never registers" "$(state d-full) $(grep -c ' d-full ' "$dir/admission/events.log")" "gone 0"
DISK_GUARD_FREE_BYTES=$(( 14 << 30 )) "$adm" run d-data curator-test normal true 2> "$dir/d-data.err"
check "free data below 15 GiB is refused too" "$? $(cat "$dir/d-data.err")" "74 admission: d-data refused: disk floor: /: free data 14.00 GiB < 15.00 GiB (floors: free data 15 GiB; metadata headroom 1 GiB unless 2 GiB unallocated); not started"
DISK_GUARD_MOUNTINFO=$dir/btrfs-mountinfo "$adm" run d-warn curator-test normal bash -c 'echo ran' > "$dir/d-warn.out" 2>&1
check "an unreadable probe only warns: the command runs" "$? $(grep -c '^ran$' "$dir/d-warn.out") $(grep -c '^admission: d-warn: disk floor: warning: probe unavailable (/: btrfs allocation: no .*/fs/btrfs/\*/devices/fixture0); not checked$' "$dir/d-warn.out")" "0 1 1"
full "$adm" run d-gate gate-1 high bash -c 'echo ran' > "$dir/d-gate.out" 2>&1
check "a bounded job (high) is left to its own guard (a gate's prelaunch)" "$? $(grep -c '^ran$' "$dir/d-gate.out")" "0 1"
# A queued capped command is checked again on every wait pass and when it would be admitted: one that queued on a
# healthy volume is refused with 74, its reservation gone, when the volume falls below a floor while it waits, for
# each way a volume falls below one (the metadata headroom, the unallocated space under low headroom, free data).
qsys=$dir/sysq/fs/btrfs/fixture-q
mkdir -p "$qsys/allocation/"{data,metadata,system} "$qsys/devices/fixtureq"
echo $(( (460 << 30) / 512 )) > "$qsys/devices/fixtureq/size"
echo $(( 12 << 30 )) > "$qsys/allocation/metadata/disk_total"; echo $(( 64 << 20 )) > "$qsys/allocation/system/disk_total"
echo $(( 6 << 30 )) > "$qsys/allocation/metadata/total_bytes"; echo $(( 1 << 29 )) > "$qsys/allocation/global_rsv_size"
printf '20 1 0:47 / / rw - btrfs /dev/fixtureq rw\n' > "$dir/q-mountinfo"
# qvolume <metadata used> <data disk_total> <free data>: the volume every probe of the waiting command reads afresh.
qvolume() { echo "$1" > "$qsys/allocation/metadata/bytes_used"; echo "$2" > "$qsys/allocation/data/disk_total"; echo "$3" > "$dir/q-free"; }
filled=$(( (448 << 30) - (64 << 20) ))   # data chunks take every byte metadata and system leave
metadata_low='btrfs metadata headroom 0.25 GiB < 1.00 GiB and unallocated 0.00 GiB < 2.00 GiB'
while IFS='|' read -r form healthy low named; do
  qvolume $healthy
  run "q-$form" gate-4 high bash -c "$(job "q-$form")" < /dev/null   # holds the whole budget
  until_state "q-$form" active
  DISK_GUARD_SYSFS=$dir/sysq DISK_GUARD_MOUNTINFO=$dir/q-mountinfo DISK_GUARD_FREE_BYTES=@$dir/q-free \
    run "w-$form" curator-test normal bash -c 'echo HEAVY_RAN' < /dev/null
  waiter=${pids[-1]}
  until_state "w-$form" queued
  check "$form: a capped command queues on a healthy volume" "$(state "w-$form")" queued
  qvolume $low
  until_state "w-$form" gone
  check "$form: the queued command is refused while memory is still held" "$(state "w-$form") $(state "q-$form")" "gone active"
  finish "q-$form"; wait "$waiter"
  check "$form: refused with 74 and never started" "$? $(grep -c '^HEAVY_RAN$' "$dir/w-$form.out")" "74 0"
  check "$form: the refusal names the floor and its values" \
    "$(grep -c "^admission: w-$form refused: disk floor: /: $named (floors: free data 15 GiB; metadata headroom 1 GiB unless 2 GiB unallocated); not started\$" "$dir/w-$form.out")" 1
  check "$form: its reservation is released, with a refused event" "$(grep -c " refused w-$form curator-test 3 disk floor, queued$" "$dir/admission/events.log") $(ls "$dir/admission/entries" | grep -c "^w-$form\.")" "1 0"
  until_state "q-$form" gone
done << FORMS
metadata|$(( 4 << 30 )) $filled $(( 20 << 30 ))|$(( 21 << 28 )) $filled $(( 20 << 30 ))|$metadata_low
unallocated|$(( 21 << 28 )) $(( 440 << 30 )) $(( 20 << 30 ))|$(( 21 << 28 )) $filled $(( 20 << 30 ))|$metadata_low
data|$(( 4 << 30 )) $filled $(( 20 << 30 ))|$(( 4 << 30 )) $filled $(( 14 << 30 ))|free data 14.00 GiB < 15.00 GiB
FORMS
# An unreadable probe warns and never blocks, at entry and on every wait pass: each way a probe yields "unavailable"
# (a part it cannot read, the same beside a floor it can read, a crash, a timeout) warns once per reason per command,
# not on every pass, and only a floor it read refuses. A copy of admission.sh runs a probe stub beside it that
# records each call with its mode and then crashes, hangs past the 10 s timeout, or runs the real disk_guard.py.
stub=$dir/stub
mkdir -p "$stub"; cp "$adm" "$stub/admission.sh"; echo read > "$stub/mode"
cat > "$stub/disk_guard.py" << STUB
import os, sys, time
mode = open('$stub/mode').read().strip()
open('$stub/calls', 'a').write(mode + '\n')
if mode == 'crash':
    raise RuntimeError('fixture probe crash')
if mode == 'hang':
    time.sleep(60)
os.execvp('python3', ['python3', '-B', '$here/disk_guard.py'] + sys.argv[1:])
STUB
# stubbed <id> <command...>: the copy's admission.sh run, a capped command (normal) on the q volume; output to <id>.out.
stubbed() { local id=$1; shift; DISK_GUARD_SYSFS=$dir/sysq DISK_GUARD_MOUNTINFO=$dir/q-mountinfo DISK_GUARD_FREE_BYTES=@$dir/q-free "$stub/admission.sh" run "$id" curator-test normal "$@" > "$dir/$id.out" 2>&1; }
# calls_reach <mode> <n>: waits up to 40 s until the stub has been called n times in that mode.
calls_reach() { local _; for _ in $(seq 200); do (( $(grep -c "^$1\$" "$stub/calls" 2> /dev/null) >= $2 )) && return 0; sleep 0.2; done; return 1; }
# probe <mode> <metadata used> <data disk_total> <free data> [unreadable]: the stub's mode and the q volume (qvolume);
# unreadable then removes the free-data file, so the probe cannot read free data.
probe() { echo "$1" > "$stub/mode"; qvolume "$2" "$3" "$4"; [[ -z ${5:-} ]] || rm -f "$dir/q-free"; }
warnings() { grep -c '^admission: [^ ]*: disk floor: warning: ' "$dir/$1.out"; }
healthy="$(( 4 << 30 )) $filled $(( 20 << 30 ))" low="$(( 21 << 28 )) $filled $(( 20 << 30 ))"
unreadable_free="probe unavailable (/: free data: \[Errno 2\] No such file or directory: '$dir/q-free'); not checked"
crashed='probe failed (exit 1: Traceback .*'
timed_out='probe timed out after 10 s; not checked'
while IFS='|' read -r outcome mode volume status ran warning; do
  probe "$mode" $volume
  stubbed "e-$outcome" bash -c 'echo HEAVY_RAN'
  check "entry, $outcome: exit $status, ran $ran, one warning" \
    "$? $(grep -c '^HEAVY_RAN$' "$dir/e-$outcome.out") $(warnings "e-$outcome") $(grep -c "^admission: e-$outcome: disk floor: warning: $warning" "$dir/e-$outcome.out")" "$status $ran 1 1"
done << OUTCOMES
unreadable|read|$healthy unreadable|0|1|$unreadable_free
unreadable-below|read|$low unreadable|74|0|$unreadable_free
crash|crash|$healthy|0|1|$crashed
timeout|hang|$healthy|0|1|$timed_out
OUTCOMES
check "entry, unreadable-below: the floor it read still refuses" "$(grep -c "^admission: e-unreadable-below refused: disk floor: /: $metadata_low (floors: .*); not started\$" "$dir/e-unreadable-below.out")" 1
# Queued: a command queues on a healthy volume behind a gate; its probe turns unreadable, then crashes, then times out,
# each for at least two passes; memory frees while the probe still times out, and the command is admitted.
probe read $healthy
run s-gate gate-4 high bash -c "$(job s-gate)" < /dev/null
until_state s-gate active
stubbed s-wait bash -c 'echo HEAVY_RAN' < /dev/null & pids+=($!); waiter=$!
until_state s-wait queued
check "queued, probe failures: the command queues on a healthy volume, without a warning" "$(state s-wait) $(warnings s-wait)" "queued 0"
reads=$(grep -c '^read$' "$stub/calls")
probe read $healthy unreadable; calls_reach read $(( reads + 4 ))
probe crash $healthy; calls_reach crash 3
probe hang $healthy; calls_reach hang 2
check "queued, probe failures: never refused while the probe is unavailable" "$(state s-wait) $(grep -c ' refused s-wait ' "$dir/admission/events.log")" "queued 0"
finish s-gate; wait "$waiter"
check "queued, probe failures: admitted when memory frees, and runs" "$? $(grep -c '^HEAVY_RAN$' "$dir/s-wait.out")" "0 1"
check "queued, probe failures: one warning per reason, not one per pass" \
  "$(warnings s-wait) $(grep -c "^admission: s-wait: disk floor: warning: $unreadable_free\$" "$dir/s-wait.out") $(grep -c "^admission: s-wait: disk floor: warning: $crashed" "$dir/s-wait.out") $(grep -c "^admission: s-wait: disk floor: warning: $timed_out\$" "$dir/s-wait.out")" "3 1 1 1"
until_state s-gate gone
# A reason warned at entry is not repeated on the passes, and a floor read beside it on a pass still refuses.
probe read $healthy unreadable
run s-gate2 gate-4 high bash -c "$(job s-gate2)" < /dev/null
until_state s-gate2 active
reads=$(grep -c '^read$' "$stub/calls")
stubbed s-again bash -c 'echo HEAVY_RAN' < /dev/null & pids+=($!); waiter=$!
until_state s-again queued; calls_reach read $(( reads + 4 ))
probe read $low unreadable
wait "$waiter"
check "queued, warned at entry: refused with 74 by the floor it read, and never started" "$? $(grep -c '^HEAVY_RAN$' "$dir/s-again.out") $(grep -c "^admission: s-again refused: disk floor: /: $metadata_low" "$dir/s-again.out")" "74 0 1"
check "queued, warned at entry: the reason is warned once in all" "$(warnings s-again) $(grep -c "^admission: s-again: disk floor: warning: $unreadable_free\$" "$dir/s-again.out")" "1 1"
finish s-gate2; until_state s-gate2 gone
check "nothing is left reserved after the disk cases" "$("$adm" status)" "memory: 0/16 GiB reserved; active: none; queued: none"

exit $fail
