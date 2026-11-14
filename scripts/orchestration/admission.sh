#!/usr/bin/env bash
# shellcheck shell=bash
# Memory admission for heavy commands (#759). Sourced by the run directory's
# capped.sh, bounded.sh, run-bounded-command.sh, run-bounded-role.sh and
# bounded-receipt.sh; run it for the orchestrator's view:
#   admission.sh status [--for <id>] one line: reserved/budget, active, queued (--for: as an intent sees it)
#   admission.sh peek                status's line without the sweep, then the entries no process holds;
#                                    it writes nothing; 3 when a read fails (gate-run.py's terminal probe)
#   admission.sh held <file>...      "held|free|missing <file>" per file, from /proc/locks; takes no lock
#   admission.sh table               each class's reservation and where it comes from
#   admission.sh cancel <id>         ends a queued wait (the waiter exits 143)
#   admission.sh gib <class>         a class's reservation in GiB
#   admission.sh class <kind> <workers> <command...>   a job's class (kind capped:
#                                    a capped.sh command's)
#   admission.sh reclassify [--write] [--declared <kind>] [<id>...]  relabels peaks.log lines by what they ran
#   admission.sh sets [<command...>] a command's test set key and history, or the store's summary
#   admission.sh escalate <id>       a light prep's reservation grows to full
#   admission.sh intent <id> <class> <seconds> <what> [locks...]   a gate driver's intent (gate-run.py)
#   admission.sh yield [<seconds>]   waits while a gate or prep intent waits (before taking a curator slot)
#   admission.sh run <id> <class> high|normal <command...>
#                                    reserves, then execs the command (tests)
#
# Memory is the owner's `real` measure: memory.current - file + shmem, the
# cgroup's memory without reclaimable file cache (slice-sampler.sh). Every
# bounded unit and capped.sh scope samples its own cgroup every 5 s
# (admission_sample) and records its real peak in peaks.log, one line per
# job: <time> <class> <real peak> <memory.peak> <result> <seconds> <id> <what>
# (a capped.sh command's memory.peak is read once more after it ends, so it
# is its scope's exact peak however short the run: admission_exit_peak;
# reservations read only the real peak; a capped.sh command's what is
# "<dir>: <command>", or "<dir>: CAPPED_KIND=<kind> <command>" when its kind
# was declared; cut to 100 characters).
# A capped.sh command that is a pure named-test run also adds a line to its
# test set's history, test-sets/<sha256 of its key>: the set's key (its test
# files and worker count: admission_test_set_key) on the first line, then
# <time> <id> <result> <seconds> <real peak> <memory.peak> per run, -t runs
# left out (mq-s2; admission.sh sets shows it). A run of a set whose history
# has at least two ok runs, every memory.peak at or under 2.7 GiB and none
# outgrown reserves curator-test-known, 3 GiB, whatever class its words give
# it (mq-s3, admission_known_set); a -t run and a run with no key reserve as
# before. Such a run is watched every 0.5 s: once its real use passes 2.7 GiB
# it is recorded as curator-test and outgrown in its set's history, and its
# reservation grows, never shrinking, to the largest of curator-test's seed,
# curator-test's reservation, its own and its real use plus the margin,
# worked out afresh at every step that could grant it, without stopping the
# command, at once when that fits, else ahead of every queued entry, and again
# if its use rises past that; one small-class grow pending at a time
# (admission_watch, admission_outgrow; status shows it).
# A class's reservation is the largest real peak of its qualifying runs (ok,
# at least 60 s) plus the table's margin, rounded up to 0.5 GiB, once it has
# 3 of them; before that, the table's seed (memory-reservations.tsv, each
# with its source). Any recorded run above that raises it at once (its peak
# plus the margin), so OOM, killed and short runs only ever raise it. A role
# (a model session) always reserves 0.
#
# A heavy command is admitted when the active reservations plus its own fit
# the budget (18 GiB), or when nothing else is active; otherwise it queues.
# Queued entries go in order: high (bounded.sh jobs: gates, preps, other
# bounded commands) before normal (capped.sh: curator and coder commands),
# then first come first served, and nothing is admitted ahead of an earlier
# entry, with one exception (admission-backfill, 2026-11-13): a capped.sh
# command that fits may start past an earlier queued capped.sh command (the
# head) that doesn't, until the head is held: from the moment the commands
# that started past it are all that keep it out, nothing more starts ahead
# of it until it is admitted or cancelled, whatever the other reservations do
# meanwhile (admission_passable, admission_hold). A command whose job holds
# locks passes by the same rule, and past anything queued only while a gate
# or prep intent awaits one of its locks (admission_exempt). Bounded jobs
# never pass and are never passed.
# A bounded job registers its intent before it waits for its locks
# (pending, no memory), and a gate driver (gate-run.py) registers one before
# its prelaunch's first lock probe that lasts until its gate unit claims its
# locks (admission_intent). While one waits, for its locks or for memory, no
# new capped.sh command is admitted before it; commands already admitted run
# on. Two exceptions avoid a deadlock (admission_intent_blocks): a command
# whose job declares a lock the intent awaits (BOUNDED_HELD_LOCKS), and, until
# the intent is claimed, any command while a curator lock it awaits is held,
# since a curator slot's holder may be the command's own wrapper; a slot
# taker checks `admission.sh yield` before it takes a slot. A gate unit's own
# intent is claimed from its registration (admission_unit_claims): while it
# waits, a curator lock it already holds is its own. A gate's own
# resource observer (gate_operator.py runs it through capped.sh with
# BOUNDED_GATE_UNIT, its gate unit's id) is part of its gate: while that
# unit's high entry is active it is admitted at once and reserves nothing,
# since the unit's reservation counts it; until then it waits as any command
# (admission_gate_holds). Admission never changes a cap: the units and
# ep-heavy.slice keep theirs.
#
# A reservation lives as long as a process holds its lock: the reserving
# process takes a flock on entries/<id>.held and its children inherit the
# descriptor, so it is held until the job's last process exits, however it
# ends (exit, kill, OOM). Every admission and status sweeps first: an entry
# whose lock is free belongs to a job that is gone and is removed (an "ended"
# event; that is how every capped.sh command's reservation ends, and how a
# crashed owner's is cleaned up). A bounded unit's ExecStopPost also releases
# it by id, after the unit's last process is gone; the wrapper itself never
# releases an admitted reservation (its descendants may outlive it). Locks come first: a job reserves memory
# only after it holds its heavy-job locks (bounded-lock.sh) and never waits
# for a lock while it holds memory.
#
# Disk floor (disk_guard.py, owner 2026-11-08): a normal (capped.sh) command
# is refused with 74 when the volume holding the state directory or its own
# directory is below a disk floor: free data, and on btrfs the metadata
# headroom unless enough is unallocated. It is checked before it registers
# and again on every pass of its wait, so also at the moment it would be
# admitted; a queued one refused there loses its entry (a "refused" event).
# A high (bounded) job is left to its own guard, a gate's prelaunch.
#
# A queued wait ends with exit 143 on TERM or INT or on `admission.sh cancel`,
# and with 73 after BOUNDED_WAIT_TIMEOUT seconds when that is set.
# State: $BOUNDED_STATE_DIR (else $EP_ORCH, else ep-orch beside the main
# checkout)/admission/: entries/, peaks.log, events.log (one line per queued
# wait, "behind <intent>" when an intent holds it; admission, release, end,
# drop, cancel, timeout, an intent's registration and claim, and failed
# write), test-sets/, seq and the mutex. Entries are pending (a gate's or prep's intent
# while it waits for its locks: no memory, but ahead of every new capped.sh
# command), queued or active.
# A capped.sh command stuck at its scope's soft limit (memory.high) is
# reported as a stall suspect after 300 s (events.log, stderr, status
# "stalled?") and stopped with SIGKILL after 1,800 s, recorded as stalled,
# exiting 79 (admission_stalled, admission_run_sampled).
# Tests only: ADMISSION_PROC_LOCKS (another /proc/locks, for peek and held),
# ADMISSION_TABLE (another table), ADMISSION_INTERVAL (the queue
# poll, default 1 s), ADMISSION_SAMPLE_INTERVAL (the sampler's, default 5 s),
# ADMISSION_CGROUP (a fake cgroup for the sampler), ADMISSION_SUSPECT_SECONDS
# and ADMISSION_STALL_SECONDS (the stall guard's suspect and stop times,
# default 300 and 1,800 s).

# Builtins only (no dirname), so peek and held depend on no tool beyond the ones they check.
admission_source=${BASH_SOURCE[0]}; [[ $admission_source == */* ]] || admission_source=./$admission_source
admission_here=$(cd "${admission_source%/*}" && pwd)
admission_table=${ADMISSION_TABLE:-$admission_here/memory-reservations.tsv}
admission_dir=${BOUNDED_STATE_DIR:-${EP_ORCH:-${admission_here%/*/*/*}/ep-orch}}/admission

# admission_reservation <class>: "<MiB> <basis>" for the class; 64 when the
# class isn't in the table. Qualifying runs ended ok and lasted at least
# ADMISSION_MIN_SECONDS (60; tests only); with 3 of them the reservation is
# their largest real peak plus the margin, rounded up to 0.5 GiB, else the
# seed. Any recorded run whose real peak is above that (an OOM, a killed or a
# short run included) raises it to that peak plus the margin, so OOM and
# killed runs can only raise a reservation, never lower it. The small class
# for known test sets (admission_known_class) never goes below its seed: a
# set qualifies for it at 2.7 GiB (admission_known_limit), a settled
# threshold below its seed / 1.1.
admission_reservation() {
  local ledger=$admission_dir/peaks.log out
  [[ -r $admission_table ]] || { echo "no memory table at $admission_table" >&2; return 64; }
  [[ -r $ledger ]] || ledger=/dev/null
  out=$(awk -v c="$1" -v min="${ADMISSION_MIN_SECONDS:-60}" -v floor="$admission_known_class" "$admission_up"'
    FNR == NR {
      if ($1 == c) { seed = $2; found = 1 }
      if ($1 == "margin") margin = $2
      next
    }
    $2 == c && $3 ~ /^[0-9]+$/ {
      if ($3 + 0 > all) all = $3 + 0
      if ($5 == "ok" && $6 + 0 >= min) { n++; if ($3 + 0 > q) q = $3 + 0 }
    }
    END {
      if (!found) exit 1
      if (c == "role" || c == "budget") { printf "%d fixed\n", seed * 1024; exit }
      if (n >= 3) { mib = up(q); basis = sprintf("max of %d qualifying real peaks %.2f GiB + %s%%", n, q / 2^30, margin) }
      else { mib = seed * 1024; basis = sprintf("seed (%d qualifying)", n) }
      if (c == floor && mib < seed * 1024) { mib = seed * 1024; basis = sprintf("seed (%d qualifying; never below it: a set qualifies at 2.7 GiB, below the seed / 1.1)", n) }
      if (all / 2^20 > mib) { mib = up(all); basis = sprintf("raised: a recorded real peak %.2f GiB + %s%%", all / 2^30, margin) }
      printf "%d %s\n", mib, basis
    }' "$admission_table" "$ledger") || { echo "unknown memory class: $1 (see $admission_table)" >&2; return 64; }
  echo "$out"
}
# admission_up: the awk function up(<bytes>), in MiB: <bytes> plus the
# table's margin (the awk variable margin), rounded up to 0.5 GiB, which
# sizes a reservation from a real peak (admission_reservation) and a growing
# small-class run's need (admission_need).
admission_up='function up(bytes,  h, r) { h = bytes * (1 + margin / 100) / 2^29; r = int(h); if (r < h) r++; return r * 512 }'
admission_mib() { local r; r=$(admission_class_reservation "$1") || return 64; echo "${r%% *}"; }

# admission_class_reservation <class>: admission_reservation, except that
# curator, the class of capped.sh commands of no known kind, never reserves
# less than the largest curator-<kind> class in the table.
admission_class_reservation() {
  local own kind r top=0 topc=
  own=$(admission_reservation "$1") || return 64
  if [[ $1 == curator ]]; then
    for kind in $(awk '$1 ~ /^curator-/ { print $1 }' "$admission_table"); do
      r=$(admission_reservation "$kind") || continue
      (( ${r%% *} > top )) && { top=${r%% *}; topc=$kind; }
    done
    (( top > ${own%% *} )) && own="$top the largest command kind, $topc"
  fi
  echo "$own"
}
admission_show() { awk -v m="$1" 'BEGIN { g = m / 1024; if (g == int(g)) printf "%d", g; else printf "%.1f", g }'; }
# admission_gib <class>: the class's reservation in GiB; 64 for an unknown class.
admission_gib() { local m; m=$(admission_mib "$1") || return 64; admission_show "$m"; echo; }

# admission_class <kind> <workers> <command...>: a job's class. A role is a
# model session; cur-prep.sh is prep-full-<workers> with --full and
# prep-light-<workers> without (a light prep that turns full reserves and is
# recorded as prep-full: admission_escalate), and prep-remote with
# --remote-suite, --full or not (it runs no tests, at any worker count, and
# never escalates); any other gate-kind job is a
# gate; any other command gets the default. Kind capped is a capped.sh
# command: curator-<kind> by what it runs (admission_command_kind), or
# curator, which reserves the largest kind's GiB, for an unknown or composite
# command (bash -c, a script) unless CAPPED_KIND names its kind (lint,
# corpus, test or light; anything else is refused with 64). The inventory
# kind (curator-inventory: the launch inventory's runs and the measured small
# commands) comes only from the command's words (admission_words_class). A
# capped.sh command whose test set has proved small (admission_known_set)
# is curator-test-known instead, whatever class its words give it. Kind
# words is a capped.sh command by its words alone, never the small class
# (reclassify: a set's history then isn't its history at run time).
admission_class() {
  local kind=$1 workers=$2 arg k
  shift 2
  [[ $kind == role ]] && { echo role; return; }
  [[ $kind == words ]] && { admission_words_class "$@"; return; }
  if [[ $kind == capped ]]; then
    k=$(admission_words_class "$@") || return 64
    admission_known_set "$@" && k=$admission_known_class
    echo "$k"
    return
  fi
  local prep=
  for arg; do
    [[ ${arg##*/} == cur-prep.sh ]] && prep=light
    [[ -n $prep && $prep != remote && $arg == --full ]] && prep=full
    [[ -n $prep && $arg == --remote-suite ]] && prep=remote
  done
  [[ $prep == remote ]] && { echo prep-remote; return; }
  [[ -n $prep ]] && { echo "prep-$prep-$workers"; return; }
  if [[ $kind == gate ]]; then echo "gate-$workers"; else echo command; fi
}
# admission_words_class <command...>: a capped.sh command's class from its
# words alone, or its declared kind (admission_class): what it reserved before
# test sets had a history, and what reclassify relabels by.
admission_words_class() {
  local k
  if [[ -z ${CAPPED_KIND:-} ]]; then k=$(admission_command_kind "$@"); echo "curator${k:+-$k}"; return; fi
  case $CAPPED_KIND in
    lint|corpus|test|light) echo "curator-$CAPPED_KIND" ;;
    *) echo "CAPPED_KIND must be lint, corpus, test or light, not $CAPPED_KIND" >&2; return 64 ;;
  esac
}

# The small class for known test sets (mq-s3; $EP_ORCH/research/mq-short-tests.md
# C3-C4, D; root decision 2026-11-13 items 4-5): curator-test-known, its
# reservation never below its seed (3 GiB, admission_reservation); a set
# qualifies at admission_known_limit, 2.7 GiB rounded down to a byte (a
# settled threshold, conservatively below 3 / 1.1, about 2.73), and a run of
# it whose real use passes that grows (admission_watch, admission_outgrow).
admission_known_class=curator-test-known admission_known_grow=curator-test admission_known_limit=2899102924
# admission_known_set <command...>: whether the command's test set has proved
# small, read from the store alone: it has a key (admission_test_set_key,
# worked out here as capped.sh's own run would), isn't a -t run, and its
# history file's first line is that key and its runs qualify
# (admission_set_stats check: at least two ok runs, every recorded run's
# memory.peak at or under admission_known_limit, whatever its result, none
# outgrown, every line readable). Reads one history file, without the mutex: a
# line being appended reads as unreadable, which keeps the set out.
admission_known_set() {
  local set_key set_why set_filtered file first
  admission_test_set_key "$@" 2> /dev/null && [[ -z $set_filtered ]] || return 1
  file=$(admission_set_file "$set_key") && [[ -f $file ]] || return 1
  first=; IFS= read -r first < "$file" 2> /dev/null
  [[ $first == "$set_key" ]] && admission_set_stats check "$file"
}

# admission_command_kind <command...>: what a capped.sh command runs, from its
# words: lint (lint, typecheck, eslint, tsc, knip), corpus (the whole catalog:
# catalog:preview, catalog:curate, catalog:release, catalog:conditions,
# catalog:notice-deps (5.26 GiB real in 9 s, 2026-10-20), or a test run of the
# whole suite or of a directory or filter), test (a test run of named test
# files only) or light (the small package scripts: catalog:pin,
# catalog:format, catalog:merge, the check:, format: and rules: scripts,
# acceptance:check, prettier) or inventory (the launch inventory's own runs
# and the small commands measured with them: admission_inventory_command) or
# lintpaths (pnpm lint:paths: admission_lint_paths_command, before the lint:*
# rule; every other lint form stays lint). Nothing for anything else: a
# shell (bash -c, sh -c), a script, node or tsx on a file, a package script
# it doesn't know.
admission_command_kind() {
  local script
  admission_inventory_command "$@" && { echo inventory; return; }
  admission_lint_paths_command "$@" && { echo lintpaths; return; }
  while [[ ${1:-} == env || ${1:-} =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; do shift; done
  case ${1:-} in
    pnpm|npm|yarn)
      shift
      while [[ ${1:-} == -* ]]; do shift; done
      [[ ${1:-} == run ]] && shift
      [[ ${1:-} == exec ]] && { shift; admission_tool_kind "$@"; return; }
      script=${1:-}; shift
      case $script in
        lint|lint:*|typecheck|check) echo lint ;;
        catalog:preview|catalog:curate|catalog:release|catalog:conditions|catalog:notice-deps) echo corpus ;;
        test|vitest) [[ ${1:-} == run ]] && shift; admission_test_kind "$@" ;;
        catalog:pin|catalog:format|catalog:merge|check:*|format:*|rules:*|acceptance:check) echo light ;;
      esac ;;
    npx) shift; admission_tool_kind "$@" ;;
    node)
      shift
      while [[ ${1:-} == -* ]]; do [[ $1 == --import || $1 == -r || $1 == --require ]] && shift; shift; done
      admission_tool_kind "$@" ;;
    *) admission_tool_kind "$@" ;;
  esac
}
# admission_lint_paths_command <command...>: whether the command is the
# path-scoped lint, pnpm lint:paths with any arguments (paths, or --since
# <ref>), through pnpm with -s or --silent and run, after VAR=value words and
# env with -u NAME or --unset=NAME (admission_env_prefix). It lints at most
# 50 files (scripts/lint-paths.ts refuses more), which curator-lintpaths
# covers (memory-reservations.tsv). Any other form of lint, ESLint run
# directly and a shell wrapper are not, and keep curator-lint or curator.
admission_lint_paths_command() {
  local skip
  admission_env_prefix "$@"; shift "$skip"
  [[ ${1:-} == pnpm ]] || return 1
  shift
  while [[ ${1:-} == -s || ${1:-} == --silent ]]; do shift; done
  [[ ${1:-} == run ]] && shift
  [[ ${1:-} == lint:paths ]]
}
# admission_inventory_command <command...>: whether the command is one that
# curator-inventory reserves for: one of the launch inventory's own runs
# (memory-reservations.tsv: 2.87 GiB real, the qualifying maximum; 3.05 GiB
# over every result) or one of the small commands measured with them
# (admission-backfill, 2026-11-13: 2.63 GiB memory.peak at most over every
# result). The launch inventory's: pnpm catalog:launch-inventory with
# --write, --check, --verify --write or --verify --check, in either order, or
# pnpm mvp:status with no arguments (admission_inventory_form). The measured
# ones: pnpm test:workflow; pnpm test:affected --base <rev>;
# catalog:party-scope, catalog:attribution-227-matches or
# catalog:launch-legal-authority with --check or --write; pnpm install
# --offline (admission_measured_form); and an orchestration test, python3 -B
# scripts/orchestration/<name>.test.py or bash
# scripts/orchestration/<name>.test.sh, with no arguments
# (admission_orchestration_test); and node --import tsx
# scripts/catalog-record-review.ts with --list, --list --json, --verify or
# --verify --root <dir> (admission_measured_script). Each through pnpm with
# -s or --silent and run, after VAR=value words and env with -u NAME or
# --unset=NAME, as workers call them. Anything else is not (other arguments, other pnpm options,
# another launcher, interpreter or path, a script, a shell) and keeps the
# class it had, so a command it misses reserves more, never less.
admission_inventory_command() {
  local skip
  admission_env_prefix "$@"; shift "$skip"
  case ${1:-} in
    pnpm)
      shift
      while [[ ${1:-} == -s || ${1:-} == --silent ]]; do shift; done
      [[ ${1:-} == run ]] && shift
      admission_inventory_form "$@" || admission_measured_form "$@" ;;
    node) shift; admission_measured_script "$@" ;;
    python3) (( $# == 3 )) && [[ $2 == -B ]] && admission_orchestration_test "$3" py ;;
    bash) (( $# == 2 )) && admission_orchestration_test "$2" sh ;;
    *) return 1 ;;
  esac
}
# admission_measured_form <package script or pnpm command> [<args...>]:
# whether it is one of the measured package forms (admission_inventory_command).
admission_measured_form() {
  case ${1:-} in
    test:workflow) (( $# == 1 )) ;;
    test:affected) (( $# == 3 )) && [[ $2 == --base && $3 != -* ]] ;;
    catalog:party-scope|catalog:attribution-227-matches|catalog:launch-legal-authority) (( $# == 2 )) && [[ $2 == --check || $2 == --write ]] ;;
    install) (( $# == 2 )) && [[ $2 == --offline ]] ;;
    *) return 1 ;;
  esac
}
# admission_measured_script <node args...>: whether it is one of the
# measured node script forms (mq-s1, 2026-11-13: 0.28 GiB memory.peak at most,
# capped runs sampled every 0.05 s, $EP_ORCH/research/mq-short-tests.md A):
# --import tsx scripts/catalog-record-review.ts with --list, --list --json,
# --verify or --verify --root <dir>, which only read. Its writing forms
# (--t3-run, --run, --capture-t3) and any other argument are not.
admission_measured_script() {
  (( $# >= 4 )) && [[ $1 == --import && $2 == tsx && $3 == scripts/catalog-record-review.ts ]] || return 1
  shift 3
  case $#:$1 in
    1:--list|1:--verify) return 0 ;;
    2:--list) [[ $2 == --json ]] ;;
    3:--verify) [[ $2 == --root && -n $3 && $3 != -* ]] ;;
    *) return 1 ;;
  esac
}
# admission_orchestration_test <path> py|sh: whether the path is an
# orchestration test of that kind, scripts/orchestration/<name>.test.<kind>,
# relative, with a name of letters, digits, - and _.
admission_orchestration_test() { [[ $1 =~ ^scripts/orchestration/[A-Za-z0-9_-]+\.test\.$2$ ]]; }
# admission_env_prefix <command...>: sets the caller's skip to the number of
# leading VAR=value words and env words (env, then -u NAME or --unset=NAME).
admission_env_prefix() {
  local env=
  skip=0
  while (( $# )); do
    if [[ $1 == env ]]; then env=1
    elif [[ -n $env && $1 == -u && $# -ge 2 ]]; then shift; skip=$(( skip + 1 ))
    elif [[ -n $env && $1 == --unset=?* ]]; then :
    elif [[ ! $1 =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then return 0
    fi
    shift; skip=$(( skip + 1 ))
  done
}
# admission_inventory_form <package script> [<args...>]: whether it is one of
# the launch inventory's forms (admission_inventory_command).
admission_inventory_form() {
  case ${1:-} in
    mvp:status) (( $# == 1 )) ;;
    catalog:launch-inventory)
      shift
      case "$*" in
        --write|--check|'--verify --write'|'--verify --check'|'--write --verify'|'--check --verify') return 0 ;;
        *) return 1 ;;
      esac ;;
    *) return 1 ;;
  esac
}
# admission_tool_kind [<tool> <args...>]: a tool run directly (npx, pnpm exec,
# node <path>). No tool (a launcher with nothing after it, such as node with
# only flags reading stdin, or a line cut there) is no known kind.
admission_tool_kind() {
  (( $# )) || return 0
  case ${1##*/} in
    vitest|vitest.mjs) shift; [[ ${1:-} == run ]] && shift; admission_test_kind "$@" ;;
    eslint|eslint.js|tsc|knip) echo lint ;;
    prettier) echo light ;;
  esac
}
# admission_test_kind <vitest args...>: test when every filter names a test
# file, else corpus (no filter is the whole suite; a directory or a partial
# name can match any number of files). Only known options are accepted:
# those that take a value consume it (--opt value or --opt=value), the known
# flags take none. --exclude, --changed and --related pick files of their
# own, and an option it doesn't know, in either form, may change what runs:
# all of them are corpus.
admission_test_kind() {
  local files=0
  while (( $# )); do
    case $1 in
      --exclude|--exclude=*|--changed|--changed=*|--related|--related=*) echo corpus; return ;;
      -t|--testNamePattern|--project|--reporter|--outputFile|-c|--config|-r|--root|--dir|--pool|--environment|--shard|--maxWorkers|--minWorkers|--testTimeout|--retry|--bail) shift ;;
      -t=*|--testNamePattern=*|--project=*|--reporter=*|--outputFile=*|-c=*|--config=*|-r=*|--root=*|--dir=*|--pool=*|--environment=*|--shard=*|--maxWorkers=*|--minWorkers=*|--testTimeout=*|--retry=*|--bail=*) ;;
      --|--run|--silent|--passWithNoTests|--allowOnly|--no-color|--coverage|--no-coverage|--globals|--isolate|--no-isolate|--no-file-parallelism|--hideSkippedTests|-u|--update) ;;
      -*) echo corpus; return ;;
      *.ts|*.tsx|*.mts|*.js|*.mjs) files=1 ;;
      *) echo corpus; return ;;
    esac
    shift
  done
  if (( files )); then echo test; else echo corpus; fi
}

# admission_test_set_key <command...>: a capped.sh command's test set (mq-s2,
# $EP_ORCH/research/mq-short-tests.md C1), the identity its run history is
# kept under (admission_record). A key is evidence that exactly these files
# ran, all of their tests, so when in doubt there is none. Only a pure
# named-test run has one: after env words (env, -u NAME, --unset=NAME, none of
# them removing a setting that decides the workers or what runs:
# admission_set_unset), a run
# admission_command_kind calls test, through the test package script or
# vitest itself (admission_set_launcher); its arguments the test files
# (admission_set_path), each a regular file here that Vitest's filter matches
# alone (admission_set_present), and only the options that leave what runs as
# it is (admission_set_args). Its key is "workers=<n> <file>...": the worker
# count (BOUNDED_WORKERS, else 2, as capped.sh takes it) and the test files
# with any leading ./ stripped, deduplicated and sorted bytewise; the
# launcher, the allowed options and the order of the words don't count. Sets
# the caller's set_key and returns 0, with set_filtered=1 for a -t run (its
# set's key, but only part of the set ran, so it is never recorded); else
# returns 1 with set_why saying why it has none: a declared kind
# (CAPPED_KIND), a worker count capped.sh refuses, such a setting unset, a
# VAR=value word (it can
# set VITEST_* or NODE_OPTIONS), not a named-test run (a directory, filter,
# the whole suite, a shell, anything else), a launcher or launcher option it
# doesn't know, a second run after the test script's own, an option it
# doesn't allow or one with no value or a value it doesn't allow, or a word
# that isn't a test file.
admission_test_set_key() {
  local workers=${BOUNDED_WORKERS:-2} env= skip files=()
  set_key= set_why= set_filtered=
  [[ -z ${CAPPED_KIND:-} ]] || { set_why="its kind was declared (CAPPED_KIND=$CAPPED_KIND)"; return 1; }
  [[ $workers =~ ^[1-4]$ ]] || { set_why="BOUNDED_WORKERS must be 1 to 4, not $workers"; return 1; }
  while (( $# )); do
    if [[ $1 == env ]]; then env=1
    elif [[ -n $env && $1 == -u && $# -ge 2 ]]; then admission_set_unset "$2" || return 1; shift
    elif [[ -n $env && $1 == --unset=?* ]]; then admission_set_unset "${1#--unset=}" || return 1
    elif [[ $1 =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then set_why="a VAR=value word: $1"; return 1
    else break
    fi
    shift
  done
  [[ $(admission_command_kind "$@") == test ]] || { set_why="not a run of named test files only"; return 1; }
  admission_set_launcher "$@" || return 1
  shift "$skip"
  admission_set_args "$@" || return 1
  admission_set_present || return 1
  set_key="workers=$workers $(printf '%s\n' "${files[@]}" | LC_ALL=C sort -u | paste -sd' ')"
}
# admission_set_unset <name>: returns 1 with set_why when an env word removes
# a setting that decides how many workers run the tests or which tests run:
# VITEST_MAX_WORKERS, capped.sh's worker limit and the only worker setting
# the installed Vitest (4.0.18) reads from the environment (without it Vitest
# picks its own count); any other VITEST_* (older Vitests read
# VITEST_MIN_WORKERS and VITEST_POOL); BOUNDED_WORKERS, the count capped.sh
# and the key take; and CI, which capped.sh sets and Vitest reads (through
# std-env) to refuse a test file's .only: without it a .only runs part of the
# file and passes. Nothing else the test run loads reads them: the test
# script sets only NODE_OPTIONS, and vitest.config.ts reads only CI.
admission_set_unset() {
  case $1 in
    VITEST_*|BOUNDED_WORKERS|CI) set_why="a setting that decides workers or what runs, unset: $1"; return 1 ;;
  esac
}
# admission_set_launcher <command...>: sets the caller's skip to the number of
# launcher words before vitest's arguments, or returns 1 with set_why naming
# the word it doesn't know (another launcher or package script, a pnpm or
# node option). The test package script (pnpm [-s|--silent] [run] test)
# already runs vitest run, so a run after it is a filter word and gives no
# key; vitest run directly (pnpm [-s|--silent] vitest, pnpm exec vitest, npx
# vitest, <path>/vitest or vitest.mjs, node <path>/vitest.mjs) may be
# followed by run.
admission_set_launcher() {
  local w=("$@") i=0 tool='(^|/)vitest(\.mjs)?$' script=
  case ${w[0]} in
    pnpm)
      i=1
      while [[ ${w[i]:-} == -s || ${w[i]:-} == --silent ]]; do i=$(( i + 1 )); done
      if [[ ${w[i]:-} == run ]]; then
        i=$(( i + 1 ))
        [[ ${w[i]:-} == test ]] || { set_why="a package script it doesn't know: ${w[i]:-none}"; return 1; }
      elif [[ ${w[i]:-} == exec && ${w[i + 1]:-} == vitest ]]; then i=$(( i + 1 ))
      elif [[ ${w[i]:-} != test && ${w[i]:-} != vitest ]]; then set_why="a launcher it doesn't know: ${w[i]:-pnpm}"; return 1
      fi
      [[ ${w[i]} == test ]] && script=1 ;;
    npx) i=1; [[ ${w[1]:-} == vitest ]] || { set_why="a launcher it doesn't know: ${w[1]:-npx}"; return 1; } ;;
    node) i=1; [[ ${w[1]:-} =~ $tool ]] || { set_why="a launcher it doesn't know: ${w[1]:-node}"; return 1; } ;;
    *) [[ ${w[0]} =~ $tool ]] || { set_why="a launcher it doesn't know: ${w[0]}"; return 1; } ;;
  esac
  skip=$(( i + 1 ))
  if [[ ${w[skip]:-} == run ]]; then
    [[ -z $script ]] || { set_why="a filter word after the test script's own run: run"; return 1; }
    skip=$(( skip + 1 ))
  fi
  return 0
}
# admission_set_args <vitest args...>: adds each test file to the caller's
# files (admission_set_path), and sets set_filtered for -t or
# --testNamePattern. The options allowed, as admission_test_kind reads them:
# -t, --testNamePattern, --reporter and --bail with a value (as the next word
# or after =; admission_set_value); --passWithNoTests, --no-color,
# --hideSkippedTests and --run; and --silent last or before another option
# (it takes an optional value, so Vitest reads a word after it as that value:
# --silent src/a.test.ts runs no src/a.test.ts). Any other option
# (--coverage, --pool, --maxWorkers, --no-isolate, --project, -c, --root,
# --environment, --shard, -u, --allowOnly, which lets a .only run part of a
# file, --, ...) returns 1 with set_why, and so does one of those four whose
# value is missing, empty or starts with - (Vitest reads that word as an
# option of its own, so it is never taken as the value).
admission_set_args() {
  while (( $# )); do
    case $1 in
      -t|--testNamePattern|--reporter|--bail)
        [[ $# -ge 2 && -n $2 && $2 != -* ]] || { set_why="an option with no value: $1"; return 1; }
        admission_set_value "$1" "$2" "$1 $2" || return 1
        shift ;;
      -t=*|--testNamePattern=*|--reporter=*|--bail=*)
        [[ -n ${1#*=} && ${1#*=} != -* ]] || { set_why="an option with no value: $1"; return 1; }
        admission_set_value "${1%%=*}" "${1#*=}" "$1" || return 1 ;;
      --silent) [[ $# -lt 2 || $2 == -* ]] || { set_why="--silent with a value: $1 $2"; return 1; } ;;
      --passWithNoTests|--no-color|--hideSkippedTests|--run) ;;
      -*) set_why="an option it doesn't allow: $1"; return 1 ;;
      *) admission_set_path "$1" || return 1 ;;
    esac
    shift
  done
}
# The installed Vitest's built-in reporters (Object.keys of its ReportersMap;
# admission.test.sh compares the two). Vitest imports any other --reporter
# name as a module, whose load and memory would join the set's.
admission_set_reporters=(default blob verbose dot json tap tap-flat junit tree hanging-process github-actions)
# admission_set_value <option> <value> <words>: a value-taking option's value:
# -t and --testNamePattern take any (and set set_filtered), --reporter a value
# equal to one of admission_set_reporters (compared whole with each member,
# so a quoted 'dot json', which Vitest takes as one name and imports as a
# module, is none), --bail a number; else returns 1 with set_why quoting the
# words.
admission_set_value() {
  local r member=
  case $1 in
    -t|--testNamePattern) set_filtered=1 ;;
    --reporter) for r in "${admission_set_reporters[@]}"; do [[ $2 == "$r" ]] && member=1; done; [[ -n $member ]] ;;
    --bail) [[ $2 =~ ^[0-9]+$ ]] ;;
  esac || { set_why="a value it doesn't allow: $3"; return 1; }
}
# admission_set_path <word>: adds the word, without its leading ./, to the
# caller's files when it names a test file as vitest.config.ts's include
# defines one (src/**/*.test.ts, src/**/*.test.tsx, convex/**/*.test.ts,
# tests/**/*.test.ts, e2e/support/**/*.test.ts; admission.test.sh checks the
# list against the config); else returns 1 with set_why: a path that isn't
# repository relative (absolute, under ~, with a .. part, empty), a VAR=value
# word, a word that isn't a plain path (a character outside letters, digits,
# ., _, / and -, so no glob, space or :line; an empty part, a part starting
# with ., or node_modules), or one outside the include.
admission_set_path() {
  local p=$1
  while [[ $p == ./* ]]; do p=${p#./}; done
  if [[ -z $p || $p == /* || $p == '~'* || /$p/ == */../* ]]; then
    set_why="a test path that isn't repository-relative: $1"; return 1
  elif [[ $p == *=* ]]; then set_why="a VAR=value word after the launcher: $1"; return 1
  elif [[ ! $p =~ ^[A-Za-z0-9._/-]+$ || /$p/ == *//* || /$p/ == */.* || /$p/ == */node_modules/* ]]; then
    set_why="not a plain test path: $p"; return 1
  elif [[ $p != src/*.test.ts && $p != src/*.test.tsx && $p != convex/*.test.ts && $p != tests/*.test.ts && $p != e2e/support/*.test.ts ]]; then
    set_why="not a test file by vitest.config.ts's include: $p"; return 1
  fi
  files+=("$p")
}
# admission_set_present: whether the caller's files are this repository's
# test files, so that Vitest runs exactly them: the working directory is the
# repository's root (it holds vitest.config.ts), each is a regular file there
# (not a link), and Vitest's filter, a case-insensitive substring of a test
# file's path, matches no other test file under the include (src/a.test.ts
# also matches src/a.test.tsx). Else returns 1 with set_why; where the files
# can't be checked there is no key.
admission_set_present() {
  local f bad
  [[ -f vitest.config.ts ]] || { set_why="can't check the test files: no vitest.config.ts in $PWD"; return 1; }
  for f in "${files[@]}"; do
    [[ -f $f && ! -L $f ]] || { set_why="no such test file here: $f"; return 1; }
  done
  bad=$({ printf '%s\n' "${files[@]}" ''
    find src convex tests e2e/support \( -name node_modules -o -name .git \) -prune -o \( -type f -o -type l \) \
      \( -name '*.test.ts' -o -name '*.test.tsx' \) -print 2> /dev/null; } | awk '
    !listing { if ($0 == "") listing = 1; else { n++; f[n] = $0; low[n] = tolower($0) }; next }
    /^(src\/.*\.test\.tsx?|(convex|tests|e2e\/support)\/.*\.test\.ts)$/ { p = tolower($0); for (i = 1; i <= n; i++) if (index(p, low[i])) hits[i]++ }
    END { for (i = 1; i <= n; i++) if (hits[i] != 1) { print hits[i] + 0, f[i]; exit } }')
  [[ -z $bad ]] && return 0
  if [[ ${bad%% *} == 0 ]]; then set_why="can't list the test files here: ${bad#* }"
  else set_why="a test path Vitest matches in more than one file: ${bad#* }"
  fi
  return 1
}

# admission_cgroup: the cgroup directory of this process (a capped.sh
# scope), or ADMISSION_CGROUP (tests only: a fake one).
admission_cgroup() {
  if [[ -n ${ADMISSION_CGROUP:-} ]]; then echo "$ADMISSION_CGROUP"; else echo "/sys/fs/cgroup$(sed -n 's/^0:://p' /proc/self/cgroup)"; fi
}

# admission_sample <file> [<process group> <id> <what>]: samples this process's
# cgroup every ADMISSION_SAMPLE_INTERVAL (5) s until the shell that started it
# exits (run it in the background; kill it to stop it sooner), and keeps
# <file> at real_peak=<bytes>, peak=<memory.peak bytes>, samples=<n> (atomic
# rewrites). Given a process group and the job's id, it also guards the group
# against a stall at the soft limit (admission_stalled). Once the job has been
# a suspect, <file> also holds suspects=<n> and the observation of its
# longest stretch at the limit: longest=<seconds>, min_gap=<KiB> and
# full_avg300=<%>; while a suspect stretch lasts, suspect=<seconds> (status
# shows it). On a stall it adds stalled=<seconds>, high=<memory.high bytes>
# and pressure=<full avg300>, stops the whole group with SIGKILL (a throttled
# process may not handle TERM for minutes) and ends.
admission_sample() {
  local out=$1 group=${2:-} id=${3:-} what=${4:-} owner=$$ cg cur real rpeak=0 peak=0 n=0 obs
  local stall_since= stall_count= stall= stall_gap= stall_next= stall_suspect= stall_suspects=0 stall_longest=-1 stall_longest_gap= stall_longest_avg=
  cg=$(admission_cgroup)
  [[ -r $cg/memory.stat ]] || return 0
  while kill -0 "$owner" 2> /dev/null; do
    admission_real_use "$cg" || break
    (( real > rpeak )) && rpeak=$real
    [[ -r $cg/memory.peak ]] && read -r peak < "$cg/memory.peak"
    n=$(( n + 1 ))
    [[ -n $group ]] && admission_stalled "$cg" "$cur" "$id" "$what"
    admission_stall_observation
    printf 'real_peak=%s\npeak=%s\nsamples=%s\n%s%s' "$rpeak" "$peak" "$n" "$obs" "$stall" > "$out.tmp" && mv -f "$out.tmp" "$out"
    [[ -n $stall ]] && { kill -KILL -- "-$group" 2> /dev/null; break; }
    sleep "${ADMISSION_SAMPLE_INTERVAL:-5}" & wait $!
  done
}

# admission_real_use <cgroup>: one reading of the cgroup's memory, into the
# caller's cur (memory.current) and real (memory.current - file + shmem, the
# owner's real measure: memory-reservations.tsv), the one calculation
# admission_sample records and admission_watch grows by; 1 when
# memory.current can't be read.
admission_real_use() {
  local file shmem
  read -r cur < "$1/memory.current" || return 1
  read -r file shmem < <(awk '$1 == "file" { f = $2 } $1 == "shmem" { s = $2 } END { print f + 0, s + 0 }' "$1/memory.stat")
  real=$(( cur - file + shmem ))
}

# The stall guard (capped-stall-guard; incident 2026-11-12, a typecheck
# throttled at its scope's 8 GiB memory.high for 49 minutes, never reaching
# memory.max). A sample holds when memory.current is within
# admission_stall_margin (256 MiB) of memory.high, a number, the high counter
# in memory.events rose since the previous sample, and memory.pressure's full
# avg300 is at least admission_stall_pressure (2.00%), each file read and a
# number. A stretch is the run of samples that hold, timed from its first; a
# sample that doesn't, a missing or unreadable file included, ends it, and
# with it both times below. A stretch of admission_stall_suspect (300 s) makes
# the job a stall suspect, recorded and warned again every further 300 s,
# never stopped; one of admission_stall_kill (1,800 s) stops it.
# Why two times: the incident sat at its limit for 49 minutes at full avg300
# 6.59, but 38 successful runs in peaks.log (most of them 25 to 30 minute
# tests/catalog suites peaking at 8.0-8.15 GiB against an 8 GiB limit) may have
# sat there for minutes, and healthy lints run at 16-34% full pressure, so
# neither 300 s nor pressure separates a stall from a busy run. The stop time
# stays this long until the suspects' recorded observations (events.log
# stall-suspect and stall-observed lines) allow a shorter one.
admission_stall_margin=268435456 admission_stall_pressure=2.00 admission_stall_exit=79
admission_stall_suspect=300 admission_stall_kill=1800
# admission_stalled <cg> <memory.current> <id> <what>: one sample of the
# guard, on admission_sample's stall_* variables: a sample that doesn't hold
# ends the stretch; one that holds extends it (admission_stall_extend) and, on
# a suspect time, adds a stall-suspect line in events.log and one on stderr
# (admission_stall_warn); at the stop time, its stall is set to the stalled=,
# high= and pressure= lines.
admission_stalled() {
  local cur=$2 high count avg secs held
  local warn=${ADMISSION_SUSPECT_SECONDS:-$admission_stall_suspect} kill=${ADMISSION_STALL_SECONDS:-$admission_stall_kill}
  admission_stall_read "$1"
  admission_stall_holds "$cur"; held=$?
  stall_count=$count
  (( held == 0 )) || { stall_since= stall_suspect=; return 0; }
  admission_stall_extend "$(( (high - cur) / 1024 ))"
  if (( secs >= kill )); then
    printf -v stall 'stalled=%s\nhigh=%s\npressure=%s\n' "$secs" "$high" "$avg"
  elif (( secs >= stall_next )); then
    stall_suspects=$(( stall_suspects + 1 )) stall_suspect=$secs stall_next=$(( (secs / warn + 1) * warn ))
    admission_stall_warn "$3" "$4"
  fi
}
# admission_stall_read <cg>: admission_stalled's high (memory.high), count (the
# high counter in memory.events) and avg (memory.pressure's full avg300), each
# empty when its file is missing or holds no such field.
admission_stall_read() {
  high= count= avg=
  read -r high 2> /dev/null < "$1/memory.high"
  count=$(awk '$1 == "high" { print $2 }' "$1/memory.events" 2> /dev/null)
  avg=$(awk '$1 == "full" { for (i = 2; i <= NF; i++) if ($i ~ /^avg300=/) print substr($i, 8) }' "$1/memory.pressure" 2> /dev/null)
}
# admission_stall_holds <memory.current>: whether this sample holds, from
# admission_stall_read's values and the previous sample's counter (stall_count).
admission_stall_holds() {
  [[ $1 =~ ^[0-9]+$ && $high =~ ^[0-9]+$ && $count =~ ^[0-9]+$ && $stall_count =~ ^[0-9]+$ && $avg =~ ^[0-9]+(\.[0-9]+)?$ ]] || return 1
  (( $1 >= high - admission_stall_margin && count > stall_count )) || return 1
  awk -v a="$avg" -v t="$admission_stall_pressure" 'BEGIN { exit !(a + 0 >= t + 0) }'
}
# admission_stall_extend <gap KiB>: adds a sample that holds to the stretch,
# starting one at this sample (EPOCHREALTIME) with its suspect time next, and
# sets admission_stalled's secs to its length. The stretch keeps its smallest
# gap (stall_gap); the longest one so far keeps its length, that gap and its
# last full avg300 together (stall_longest, stall_longest_gap,
# stall_longest_avg).
admission_stall_extend() {
  local now=${EPOCHREALTIME//[!0-9]/}
  [[ -n $stall_since ]] || stall_since=$now stall_gap=$1 stall_next=$warn
  (( $1 < stall_gap )) && stall_gap=$1
  secs=$(( (now - stall_since) / 1000000 ))
  (( secs >= stall_longest )) && stall_longest=$secs stall_longest_gap=$stall_gap stall_longest_avg=$avg
  [[ -n $stall_suspect ]] && stall_suspect=$secs
  return 0
}
# admission_stall_warn <id> <what>: a suspect's stall-suspect line in
# events.log (this stretch's time, then the longest stretch's length, gap and
# full avg300) and its warning on stderr.
admission_stall_warn() {
  admission_event stall-suspect "$1" "at_limit=${secs}s longest=${stall_longest}s min_gap=${stall_longest_gap}KiB full_avg300=$stall_longest_avg high=$(admission_show $(( high >> 20 )))GiB: $2"
  printf 'admission: %s may be stalled at its soft memory limit (memory.high %s GiB) for %s s, full memory pressure %s%% (avg300); it is stopped if it stays there for %s s. Run the heavy step as its own capped command, or raise its limit.\n' \
    "$1" "$(admission_show $(( high >> 20 )))" "$secs" "$avg" "$kill" >&2
}
# admission_stall_observation: admission_sample's obs, the lines its file
# holds once the job has been a suspect (suspects=, longest=, min_gap=,
# full_avg300=, and suspect= while a suspect stretch lasts); empty before.
admission_stall_observation() {
  obs=
  (( stall_suspects )) || return 0
  printf -v obs 'suspects=%s\nlongest=%s\nmin_gap=%s\nfull_avg300=%s\n%s' "$stall_suspects" "$stall_longest" \
    "$stall_longest_gap" "$stall_longest_avg" "${stall_suspect:+suspect=$stall_suspect$'\n'}"
}

# admission_record <class> <sample file> <result> <seconds> <id> [what] [set key]:
# appends the job's line to peaks.log: <time> <class> <real peak>
# <memory.peak> <result> <seconds> <id> <what>, result ok, failed, oom,
# killed or stalled (admission_reservation says which count: only ok). The
# real peak is the largest real (memory.current - file + shmem) the sampler
# saw; memory.peak is the kernel's, cache included: the larger of the
# sampler's last read and the file's exit_peak (admission_exit_peak), so a
# capped.sh command's is its scope's peak at its end, however short it ran.
# A file with no real peak (the sampler never sampled) records nothing. A
# role isn't recorded. A job whose class changed while it ran
# (admission_escalate, admission_watch) is recorded under the new one. A
# small-class run's file may also hold its watcher's lines (admission_watch):
# fast_peak=, the larger real peak counts; outgrown=, its set's history line
# says outgrown-<result>. Given a test set's key
# (admission_test_set_key), the run is also added to its set's history,
# under the same hold of the mutex (admission_set_append).
admission_record() {
  local real peak final fast outgrown class= now set=
  [[ $1 == role ]] && return 0
  real=$(sed -n 's/^real_peak=//p' "$2" 2> /dev/null); peak=$(sed -n 's/^peak=//p' "$2" 2> /dev/null)
  final=$(sed -n 's/^exit_peak=//p' "$2" 2> /dev/null)
  fast=$(sed -n 's/^fast_peak=//p' "$2" 2> /dev/null); outgrown=$(sed -n 's/^outgrown=//p' "$2" 2> /dev/null)
  [[ $real =~ ^[0-9]+$ && $real -gt 0 ]] || return 0
  [[ $fast =~ ^[0-9]+$ ]] && (( fast > real )) && real=$fast
  [[ $peak =~ ^[0-9]+$ ]] || peak=0
  [[ $final =~ ^[0-9]+$ ]] && (( final > peak )) && peak=$final
  mkdir -p "$admission_dir" || return 0
  [[ $4 =~ ^[0-9]+$ ]] || return 0
  [[ -f $admission_dir/classes/$5 ]] && class=$(cat "$admission_dir/classes/$5")
  [[ -n ${7:-} ]] && set=$(admission_set_file "$7" 2> /dev/null)
  admission_lock || return 0
  now=$(date -u +%FT%TZ)
  printf '%s %s %s %s %s %s %s %s\n' "$now" "${class:-$1}" "$real" "$peak" "$3" "$4" "$5" \
    "$(printf '%s' "${6:-}" | tr '\n\t' '  ' | cut -c1-100)" >> "$admission_dir/peaks.log"
  [[ -n $set ]] && admission_set_append "$set" "$7" "$now $5 ${outgrown:+outgrown-}$3 $4 $real $peak"
  admission_unlock
  rm -f "$admission_dir/classes/$5"
}
# admission_set_file <key>: the set's history file,
# $state/admission/test-sets/<sha256 of the key, as the bytes of its text>.
admission_set_file() {
  local h
  h=$(printf '%s' "$1" | sha256sum) && [[ ${h%% *} =~ ^[0-9a-f]{64}$ ]] || return 1
  echo "$admission_dir/test-sets/${h%% *}"
}
# admission_set_append <file> <key> <line>: adds the line to the set's history
# file, starting the file with its key when it has none. The caller holds the
# mutex. It never fails and says nothing: a store it can't write (a directory
# it can't create or write, a file that isn't one) or a file whose first line
# is another key is left as it is, and the command's own record and status
# don't depend on it.
admission_set_append() {
  local first=
  {
    mkdir -p "${1%/*}" || return 0
    if [[ -s $1 ]]; then
      read -r first < "$1" && [[ $first == "$2" ]] || return 0
    else
      printf '%s\n' "$2" > "$1" || return 0
    fi
    printf '%s\n' "$3" >> "$1"
  } 2> /dev/null
  return 0
}

# admission_run_sampled <class> <id> <command...>: runs the command (in a
# capped.sh scope) under a sampler, forwarding TERM, INT and HUP to it, then
# records its line and exits with its status. The sampler guards the
# command's process group against a stall at the soft limit (admission_sample,
# admission_stalled): a suspect is warned and runs on; a stalled command is
# stopped with SIGKILL, recorded as stalled, named with the advice in one line
# on stderr, and exits admission_stall_exit (79: not a signal's 128+n, and
# none of capped.sh's or admission's own codes, 64 and 72-74, nor 75, a busy
# WIP slot). A job that was a suspect gets a stall-observed line in events.log
# (admission_stall_observed), whatever its end. A command whose kind was
# declared is recorded as "<dir>: CAPPED_KIND=<kind> <command>", so its line
# says so (reclassify --declared); classifying by its words skips that word.
# A run with a test set's key (admission_test_set_key), worked out once the
# command has ended, is also recorded in its set's history, unless it ran
# with -t (only part of the set).
# A small-class run (admission_known_class) also runs under a watcher
# (admission_watch), stopped with the sampler, whose lines join the sample
# file's before the record; the sampler and its stall guard are unchanged.
# The command runs as a job of its own (set -m, as run-bounded-command.sh
# does), so it doesn't inherit an ignored SIGINT and a forwarded INT stops it.
admission_run_sampled() {
  local class=$1 id=$2 sample sampler watcher= child status result oom0 oom1 cg start=$SECONDS stalled what set_key set_why set_filtered
  shift 2
  what="$(basename "$PWD"): ${CAPPED_KIND:+CAPPED_KIND=$CAPPED_KIND }$*"
  mkdir -p "$admission_dir/samples"
  sample=$admission_dir/samples/$id
  cg=$(admission_cgroup)
  oom0=$(sed -n 's/^oom_kill //p' "$cg/memory.events" 2> /dev/null)
  set -m; "$@" <&0 & child=$!; set +m
  admission_sample "$sample" "$child" "$id" "$what" & sampler=$!
  if [[ $class == "$admission_known_class" ]]; then admission_watch "$sample.grow" "$id" 2> /dev/null & watcher=$!; fi
  trap 'kill -TERM "$child" 2> /dev/null' TERM
  trap 'kill -INT "$child" 2> /dev/null' INT
  trap 'kill -HUP "$child" 2> /dev/null' HUP
  # The shell's notice of a job a signal ended ("Killed") is kept back and
  # printed after, except for a stall, whose own line replaces it.
  while :; do
    wait "$child" 2>> "$sample.notice"; status=$?
    kill -0 "$child" 2> /dev/null || break
  done
  trap - TERM INT HUP
  kill "$sampler" ${watcher:+"$watcher"} 2> /dev/null; wait "$sampler" ${watcher:+"$watcher"} 2> /dev/null
  [[ -f $sample && -f $sample.grow ]] && cat "$sample.grow" >> "$sample" 2> /dev/null
  admission_exit_peak "$sample" "$cg"
  oom1=$(sed -n 's/^oom_kill //p' "$cg/memory.events" 2> /dev/null)
  stalled=$(sed -n 's/^stalled=//p' "$sample" 2> /dev/null)
  result=failed
  if [[ -n $stalled ]]; then result=stalled status=$admission_stall_exit
  elif (( status == 0 )); then result=ok
  elif [[ -n $oom1 && ${oom1:-0} != "${oom0:-0}" ]]; then result=oom
  elif (( status > 128 )); then result=killed
  fi
  if [[ $result == stalled ]]; then admission_stall_report "$id" "$sample" >&2; else cat "$sample.notice" >&2 2> /dev/null; fi
  admission_stall_observed "$id" "$sample" "$result" "$what"
  # A -t run ran only part of its set, so it adds nothing to the set's history.
  admission_test_set_key "$@" 2> /dev/null && [[ -z $set_filtered ]] || set_key=
  admission_record "$class" "$sample" "$result" "$(( SECONDS - start ))" "$id" "$what" "$set_key"
  rm -f "$sample" "$sample.tmp" "$sample.notice" "$sample.grow" "$sample.grow.tmp"
  return "$status"
}

# admission_watch <file> <id>: a small-class run's watcher (mq-s3), started
# by admission_run_sampled beside its sampler and stopped with TERM, which it
# takes only between steps, so it never stops inside a write. Every
# ADMISSION_GROW_INTERVAL (0.5) s it reads its scope's real use
# (admission_real_use, as admission_sample does) and notes it
# (admission_watch_note); once that passed admission_known_limit, a tick is
# one step of the run's grow (admission_outgrow) while one is due
# (admission_grow_due); it ends with the run or once its entry is gone. It
# never touches the command: nothing stops or slows it at 3 GiB, and its
# scope keeps its limits.
admission_watch() {
  local out=$1 id=$2 owner=$$ cg cur real fast=0 over= state= held_mib= grow_start=$SECONDS stop=0 admission_cancelled=0
  cg=$(admission_cgroup)
  [[ -r $cg/memory.stat ]] || return 0
  trap 'stop=1' TERM
  while (( ! stop )) && kill -0 "$owner" 2> /dev/null; do
    admission_real_use "$cg" || break
    admission_watch_note "$out"
    if admission_grow_due; then
      admission_outgrow "$id"
      [[ $state == done ]] && break
    fi
    sleep "${ADMISSION_GROW_INTERVAL:-0.5}" & wait $!
  done
}
# admission_watch_note <file>: one reading (admission_watch's real) noted:
# fast, the largest seen, and over, the first above admission_known_limit;
# <file> kept at fast_peak=<fast> and, once there is one, outgrown=<over>
# (an atomic rewrite).
admission_watch_note() {
  (( real > fast )) && fast=$real
  [[ -z $over ]] && (( real > admission_known_limit )) && over=$real
  printf 'fast_peak=%s\n%s' "$fast" "${over:+outgrown=$over$'\n'}" > "$1.tmp" && mv -f "$1.tmp" "$1"
}
# admission_grow_due: whether this tick steps the run's grow (on
# admission_watch's over, fast, state and held_mib): once its use passed
# admission_known_limit, until it holds its grown reservation, held_mib, and
# again once its largest use plus the margin, rounded up (admission_need), is
# above that.
admission_grow_due() {
  [[ -n $over ]] || return 1
  [[ $state != held ]] || (( $(admission_need "$fast") > held_mib ))
}

# admission_outgrow <id>: one step of a small-class run's grow (locked, after
# a sweep), on admission_watch's over, fast, state, held_mib and grow_start.
# state is "" until the first step records the run as outgrown
# (admission_outgrow_record); wait while its grow waits, for another's or to
# be asked; pending while it waits for room; at each of those steps the grow
# is asked afresh (admission_outgrow_ask); held once it holds its grown
# reservation, until its use rises past that (admission_outgrow_rise); done
# once its entry is gone (the run ended, or ran outside a reservation).
admission_outgrow() {
  local id=$1
  admission_lock || return 0
  admission_sweep
  if [[ -z $state ]] && ! admission_outgrow_record "$id"; then state=done
  elif [[ ! -f $admission_dir/entries/$id.entry ]]; then state=done
  elif [[ $state == held ]]; then admission_outgrow_rise "$id"
  fi
  [[ $state == wait || $state == pending ]] && admission_outgrow_ask "$id"
  admission_unlock
}
# admission_outgrow_target <id>: the reservation a grow takes now, in MiB
# (locked). It is never stored: every step that could grant or keep a grow
# works it out again here, from the state of the moment, so a grow never
# shrinks a reservation and a grant always covers the run's use, its largest
# real use when granted. The largest of admission_known_grow's seed (what
# the run would reserve without the small class; a run that outgrew it is no
# small test, so three small slow runs that lowered the class say nothing
# about it), admission_known_grow's reservation, the run's own and its
# largest real use plus the margin, rounded up (admission_need).
admission_outgrow_target() {
  local seed to own need
  seed=$(admission_seed_mib "$admission_known_grow") || return 64
  to=$(admission_mib "$admission_known_grow") || return 64
  own=$(admission_field "$1" mib); [[ $own =~ ^[0-9]+$ ]] || own=0
  need=$(admission_need "$fast")
  printf '%s\n' "$seed" "$to" "$own" "$need" | sort -n | tail -1
}
# admission_seed_mib <class>: the class's seed in the table, in MiB.
admission_seed_mib() { awk -v c="$1" '$1 == c { printf "%d\n", $2 * 1024; f = 1; exit } END { exit !f }' "$admission_table"; }
# admission_outgrow_record <id>: the first step: the run is recorded as
# admission_known_grow from now (classes/<id>, which admission_record reads)
# and an "outgrown" event says what it saw and what it grows to; then it
# waits (state wait). 1 when the class isn't in the table.
admission_outgrow_record() {
  local to=$admission_known_grow other target
  target=$(admission_outgrow_target "$1") || return 1
  mkdir -p "$admission_dir/classes" && echo "$to" > "$admission_dir/classes/$1"
  other=$(admission_known_pending "$1"); [[ -z $other ]] || other=", its grow waits for $other's"
  admission_event outgrown "$1" "real $(admission_gib_bytes "$over") GiB over $(admission_gib_bytes "$admission_known_limit") GiB: recorded as $to, grows to $to $(admission_show "$target") GiB$other"
  state=wait
}
# admission_outgrow_rise <id>: a run that holds its grown reservation and
# whose use plus the margin is now above it grows again by the same rule: an
# "outgrown" event, then it waits (state wait). Its class stays.
admission_outgrow_rise() {
  local held need target
  held=$(admission_field "$1" mib); need=$(admission_need "$fast")
  (( need > held )) || return 0
  target=$(admission_outgrow_target "$1") || return 0
  admission_event outgrown "$1" "real $(admission_gib_bytes "$fast") GiB needs $(admission_show "$need") GiB, over its $(admission_show "$held") GiB: grows to $admission_known_grow $(admission_show "$target") GiB"
  state=wait
}
# admission_outgrow_ask <id>: one ask of a waiting or pending grow, at the
# target worked out now (admission_outgrow_target). One that needs no more
# than the run holds takes the class at once (a "grown" event; state held).
# Otherwise at most one small-class grow is pending at a time (root decision
# 5): while another's is (admission_known_pending), the entry's grow field
# is wait:<class>:<MiB>, which holds back every queued entry as a pending
# grow does (admission_fits) and which status shows, but is never granted.
# Otherwise it is pending (admission_outgrow_pend) and takes its step
# (admission_outgrow_step) at that target.
admission_outgrow_ask() {
  local to=$admission_known_grow target
  target=$(admission_outgrow_target "$1") || { state=done; return; }
  if (( target <= $(admission_field "$1" mib) )); then
    admission_set "$1" class "$to" grow - || return
    admission_event grown "$1" "at its reservation"
    state=held held_mib=$(admission_field "$1" mib)
  elif [[ -n $(admission_known_pending "$1") ]]; then
    [[ $(admission_field "$1" grow) == "wait:$to:$target" ]] || admission_set "$1" grow "wait:$to:$target"
  else
    admission_outgrow_pend "$1" "$target" && admission_outgrow_step "$1" "$target"
  fi
}
# admission_outgrow_pend <id> <MiB>: the grow is pending at <MiB>, its grow
# field <class>:<MiB>, for status and admission_fits only (never read back
# as the amount to grant): an "escalating" event when it becomes pending
# (state pending), and one saying what it was when a later step's target
# differs.
admission_outgrow_pend() {
  local to=$admission_known_grow was
  was=$(admission_field "$1" grow)
  [[ $was == "$to:$2" ]] && return 0
  admission_set "$1" grow "$to:$2" || return
  if [[ $state == pending ]]; then
    admission_event escalating "$1" "to $to $(admission_show "$2"), was $(admission_show "${was##*:}")"
  else
    admission_event escalating "$1" "to $to $(admission_show "$2")"
    state=pending grow_start=$SECONDS
  fi
}
# admission_outgrow_step <id> <MiB>: a pending grow's admission_grow_step at
# <MiB>, with no timeout: granted, a "grown" event, once it fits beside the
# active jobs (they only end, since nothing is admitted meanwhile, so it
# can't deadlock); then state held; done when the entry is gone.
admission_outgrow_step() {
  BOUNDED_WAIT_TIMEOUT='' admission_grow_step "$1" "$admission_known_grow" "$2" "$(( SECONDS - grow_start ))"
  case $? in 0) state=held held_mib=$2 ;; 143) state=done ;; esac
}
# admission_known_pending <id>: the id of another active entry whose grow to
# admission_known_grow is pending (not waiting): a small-class run's first
# grow or a later one, or nothing (locked).
admission_known_pending() {
  admission_entries | awk -v me="$1" -v to="$admission_known_grow" '$1 != me && $2 == "active" && index($9, to ":") == 1 { print $1; exit }'
}
# admission_need <bytes>: what a run that uses <bytes> real needs, in MiB:
# plus the table's margin, rounded up to 0.5 GiB, as a reservation is
# (admission_up).
admission_need() { awk -v b="$1" "$admission_up"' $1 == "margin" { margin = $2 } END { print up(b) }' "$admission_table"; }
admission_gib_bytes() { awk -v b="$1" 'BEGIN { printf "%.2f", b / 2^30 }'; }

# admission_exit_peak <sample file> <cgroup>: adds exit_peak=<memory.peak> to
# the sample file, read once after the command and its sampler have ended,
# while this shell still holds the scope: the kernel's peak over the scope's
# whole life, cache included, which a run shorter than the sampler's interval
# ends before the sampler sees (mq-s1). A sample file that doesn't exist (the
# sampler never sampled), a cgroup that is gone, or a memory.peak that can't
# be read or holds no number adds nothing.
admission_exit_peak() {
  local peak=
  [[ -f $1 ]] || return 0
  read -r peak 2> /dev/null < "$2/memory.peak"
  [[ $peak =~ ^[0-9]+$ ]] || return 0
  printf 'exit_peak=%s\n' "$peak" >> "$1"
}

# admission_stall_observed <id> <sample file> <result> <what>: for a job that was a
# stall suspect, its stall-observed line in events.log: its longest stretch at
# the soft limit, that stretch's smallest gap to memory.high and full avg300 at
# that stretch's last sample, the number of suspect lines and how it ended (its result).
admission_stall_observed() {
  local suspects longest gap avg
  suspects=$(sed -n 's/^suspects=//p' "$2" 2> /dev/null)
  [[ -n $suspects ]] || return 0
  longest=$(sed -n 's/^longest=//p' "$2"); gap=$(sed -n 's/^min_gap=//p' "$2"); avg=$(sed -n 's/^full_avg300=//p' "$2")
  admission_event stall-observed "$1" "longest=${longest}s min_gap=${gap}KiB full_avg300=$avg suspects=$suspects ended=$3: $4"
}

# admission_stall_report <id> <sample file>: the one line a stalled command
# gets on stderr: the limit, the time stalled and the advice.
admission_stall_report() {
  local high stalled pressure
  high=$(sed -n 's/^high=//p' "$2"); stalled=$(sed -n 's/^stalled=//p' "$2"); pressure=$(sed -n 's/^pressure=//p' "$2")
  printf 'admission: %s stalled at its soft memory limit (memory.high %s GiB) for %s s: memory.current within %s GiB of it, its high events rising, full memory pressure %s%% (avg300); its process group was stopped with SIGKILL (exit %s). Run the heavy step as its own capped command, or raise its limit.\n' \
    "$1" "$(admission_show $(( high >> 20 )))" "$stalled" "$(awk -v m="$admission_stall_margin" 'BEGIN { printf "%.2f", m / 2^30 }')" "$pressure" "$admission_stall_exit"
}

# admission_sets [<command...>]: the test sets' histories (mq-s2), from
# which a set's runs reserve the small class (admission_known_set). With a command: its key and history
# file, or "no key: <why>" and 1 (admission_test_set_key); a line saying a -t
# run is never recorded; its stats (admission_set_stats) and its recorded
# runs, or "runs: none recorded"; a history file whose first line isn't the
# key is reported as not counted, and 1. Without: one summary line of the
# whole store, counting only files whose first line is the key their name
# hashes, and saying how many it left out. A key is worked out as capped.sh
# would, here, from this environment's CAPPED_KIND and BOUNDED_WORKERS.
admission_sets() {
  local set_key set_why set_filtered file f first foreign=0 files=()
  if (( ! $# )); then
    for f in "$admission_dir"/test-sets/*; do
      [[ -f $f && ${f##*/} =~ ^[0-9a-f]{64}$ ]] || continue
      first=; IFS= read -r first < "$f" 2> /dev/null
      if [[ -n $first && $(admission_set_file "$first") == "$f" ]]; then files+=("$f"); else foreign=$(( foreign + 1 )); fi
    done
    FOREIGN=$foreign admission_set_stats summary "${files[@]}"
    return
  fi
  admission_test_set_key "$@" || { echo "no key: $set_why"; return 1; }
  file=$(admission_set_file "$set_key") || { echo "can't hash the key: $set_key" >&2; return 1; }
  printf 'key: %s\nhistory: %s\n' "$set_key" "$file"
  [[ -n $set_filtered ]] && echo "a -t run: only part of its set runs, so it is never recorded"
  [[ -f $file ]] || { echo "runs: none recorded"; return 0; }
  first=; IFS= read -r first < "$file" 2> /dev/null
  if [[ $first != "$set_key" ]]; then
    if [[ -z $first ]]; then echo "not counted: its first line is empty"; else echo "not counted: its first line is another key: $first"; fi
    return 1
  fi
  admission_set_stats one "$file"; tail -n +2 "$file"
}
# admission_set_stats one|summary|check <file...>: from set history files,
# one line: for one, "runs: <n> (<ok> ok), largest memory.peak <GiB>;
# qualifies for curator-test-known ...: yes|no"; for summary, "test sets:
# <sets> sets, <runs> runs (<ok> ok); <q> qualify for curator-test-known ...",
# then "; <n> file(s) not counted: ..." when FOREIGN (the files the caller
# left out, their first line not their key) is set and not 0; for check,
# nothing, and 0 when the one file's set qualifies. The caller checks each
# file's first line. The rule, the one admission_class reserves the small
# class by (admission_known_set; root, 2026-11-13): at least two ok runs,
# every recorded run's memory.peak, whatever its result, at or under
# admission_known_limit (2.7 GiB, below 3 / 1.1), and no run that outgrew the small
# class (result outgrown-<result>: admission_watch). A failed, killed, OOM or
# stalled run under the limit neither counts nor keeps a set out. A line that
# isn't "<time> <id> <result> <seconds> <real> <memory.peak>" with numbers in
# the last three is counted as unreadable and keeps its set out.
admission_set_stats() {
  local mode=$1; shift
  awk -v mode="$mode" -v lim="$admission_known_limit" -v class="$admission_known_class" '
    BEGIN { rule = "for " class " (two ok runs, every recorded memory.peak at or under 2.7 GiB, none outgrown)" }
    function done() {
      if (!open) return
      q = ok >= 2 && !bad && !grown && max <= lim + 0
      sets++; all += runs; oks += ok; quals += q; open = 0
    }
    FNR == 1 { done(); open = 1; runs = ok = bad = grown = max = 0; next }
    NF == 6 && $4 ~ /^[0-9]+$/ && $5 ~ /^[0-9]+$/ && $6 ~ /^[0-9]+$/ {
      runs++; if ($3 == "ok") ok++; if ($3 ~ /^outgrown/) grown++; if ($6 + 0 > max) max = $6 + 0; next
    }
    { bad++ }
    END {
      done()
      if (mode == "check") exit !q
      if (mode == "one") {
        printf "runs: %d (%d ok)%s, largest memory.peak %.2f GiB; qualifies %s: %s\n", runs, ok, bad ? sprintf(", %d unreadable", bad) : "", max / 2^30, rule, q ? "yes" : "no"
        exit
      }
      foreign = ENVIRON["FOREIGN"] + 0
      if (foreign == 1) left = "; 1 file not counted: its first line isn\047t its key"
      else if (foreign) left = sprintf("; %d files not counted: their first line isn\047t their key", foreign)
      printf "test sets: %d sets, %d runs (%d ok); %d qualify %s%s\n", sets, all, oks, quals, rule, left
    }' "$@" /dev/null
}

# admission_reclassify [--write] [--declared <kind>] [<id>...]: relabels
# peaks.log lines recorded before their class was known: a curator line by its
# command (admission_class words: by its words alone, so never the small
# class, which a set's history at run time gave it; a line cut at the storage width,
# admission_cut_command, loses its last, partial, word first and never takes
# curator-inventory), and a prep-light-<n> line whose unit log
# ($state/logs/bounded-<id>.log) says "prep: full" as prep-full-<n>. A named
# id's capped.sh line (curator or curator-<kind>) is relabelled by its command
# as well, as if it had run without CAPPED_KIND (an id with no capped.sh line
# is refused with 64). --declared <kind> (lint, corpus, test or light;
# anything else is refused with 64) restricts the whole pass: it relabels by
# its command only each capped.sh line declared with that kind (its command
# starts "CAPPED_KIND=<kind>": admission_run_sampled), and the named ids, and
# no other line: no plain curator line, undeclared or otherwise declared line,
# or prep line. Lines recorded before that record change say nothing of a
# declared kind, so a run among them declared with the wrong kind is only
# told apart by naming it. Prints "<id> <old> -> <new>" for
# each line it would change. --write rewrites the log (locked;
# admission_record appends under the same lock, so drain capped.sh scopes
# that started with an older admission.sh first) only when something
# changes. It replaces just the class word of the changed lines (sed on their
# line numbers, in bytes), so every other byte stays as it was: lines that
# aren't records, blank lines, CRs, long lines, and a last line with no
# newline (kept without one). It writes peaks.log.tmp, proves that by undoing
# the changes and comparing the result with the log byte for byte, keeps the
# old log as peaks.log.bak-<stamp>-<random>, then renames. It refuses with 72,
# leaving the log as it was, when the log holds a NUL byte (bash can't read it
# exactly), when a line it would change can't be classified or isn't
# single-space separated (admission_relabel), and on any failed step.
admission_reclassify() {
  local ledger=$admission_dir/peaks.log write= declared= bak id changes status n old new fwd= rev=
  while [[ ${1:-} == --write || ${1:-} == --declared ]]; do
    if [[ $1 == --write ]]; then write=1; shift; continue; fi
    [[ ${2:-} =~ ^(lint|corpus|test|light)$ ]] \
      || { echo "--declared takes lint, corpus, test or light, not '${2:-}'; $ledger is unchanged" >&2; return 64; }
    declared=$2; shift 2
  done
  if [[ ! -r $ledger ]]; then
    (( $# )) && { echo "no capped.sh line $1 in $ledger; it is unchanged" >&2; return 64; }
    return 0
  fi
  admission_lock || return 72
  if [[ $(tr -d '\000' < "$ledger" | wc -c) != "$(wc -c < "$ledger")" ]]; then
    admission_unlock; echo "$ledger holds a NUL byte; it is unchanged" >&2; return 72
  fi
  for id; do
    awk -v id="$id" '$7 == id && $2 ~ /^curator(-[a-z]+)?$/ && $3 ~ /^[0-9]+$/ { found = 1 } END { exit !found }' "$ledger" \
      || { admission_unlock; echo "no capped.sh line $id in $ledger; it is unchanged" >&2; return 64; }
  done
  changes=$(admission_relabel "$(dirname "$admission_dir")/logs" "$declared" "$@" < "$ledger"); status=$?
  while read -r n old new id; do
    [[ -n $n ]] || continue
    echo "$id $old -> $new"
    fwd+="$n{"$'\n'"s/^\([^ ]*\) $old /\1 $new /"$'\n'"t"$'\n'"Q 3"$'\n'"}"$'\n'
    rev+="$n{"$'\n'"s/^\([^ ]*\) $new /\1 $old /"$'\n'"t"$'\n'"Q 3"$'\n'"}"$'\n'
  done <<< "$changes"
  if [[ -n $write && $status == 0 && -n $fwd ]]; then
    if ! LC_ALL=C sed "$fwd" "$ledger" > "$ledger.tmp" || ! LC_ALL=C sed "$rev" "$ledger.tmp" | cmp -s - "$ledger" \
      || ! bak=$(mktemp "$ledger.bak-$(date +%Y%m%d-%H%M%S)-XXXX") || ! cp -p "$ledger" "$bak" || ! mv -f "$ledger.tmp" "$ledger"; then
      rm -f "$ledger.tmp"; admission_unlock; echo "can't rewrite $ledger; it is unchanged" >&2; return 72
    fi
  fi
  admission_unlock
  (( status == 0 )) || return 72
}
# admission_cut_command <peaks.log line>: whether the record's command was cut
# at the storage width (admission_record keeps its first 100 characters with
# cut -c, which counts characters, or bytes where cut doesn't know multibyte
# characters), from the stored command as it is, before any trimming: read
# drops trailing spaces, and a line cut right after a word stores 100
# characters ending in its space. Measured in bytes (LC_ALL=C), so a line of
# 100 bytes counts as cut whichever way cut counted; one with multibyte
# characters may count as cut a little short of 100 characters, which only
# keeps its class. When it was cut, sets the caller's cmd to its command
# (after "<dir>: ") without its last, partial, word (or only that space).
admission_cut_command() {
  local LC_ALL=C stored fields=$'^[ \t]*([^ \t]+[ \t]+){7}(.*)$'
  [[ $1 =~ $fields ]] && (( ${#BASH_REMATCH[2]} >= 100 )) || return 1
  stored=${BASH_REMATCH[2]%$'\r'}; stored=${stored#*: }; cmd=${stored% *}
}
# admission_relabel <logs dir> <declared kind, or ''> [<id>...]:
# admission_reclassify's choice of changes, from peaks.log lines on stdin (a
# last line with no newline too): one "<line number> <old> <new> <id>" line on
# stdout for each line to relabel. A line that isn't a record (no id, no
# numeric peak) is never changed. Returns 1 when a line it would change can't be classified, or
# isn't "<time> <class> " followed by the rest (a tab, a leading or a doubled
# space), so a rewrite of its class word can't be exact; that line is reported
# on stderr and left out.
admission_relabel() {
  local logs=$1 declared=$2 line t class real peak result secs id what cmd cut new words n=0 bad=0 named=' '
  shift 2
  (( $# )) && named=" $* "
  while IFS= read -r line || [[ -n $line ]]; do
    n=$(( n + 1 ))
    read -r t class real peak result secs id what <<< "$line"
    [[ -n $id && $real =~ ^[0-9]+$ ]] || continue
    new=$class
    cmd=${what%$'\r'}; cmd=${cmd#*: }
    # A capped.sh line is chosen when it is named, when it was declared with
    # --declared's kind, or, with no --declared, when it is a plain curator
    # line. With --declared, nothing else is chosen: not a plain curator line,
    # an undeclared or otherwise declared line, a prep or other bounded line.
    if [[ $class =~ ^curator(-[a-z]+)?$ && ( $named == *" $id "* || ( -n $declared && "$cmd " == "CAPPED_KIND=$declared "* ) \
          || ( -z $declared && $class == curator ) ) ]]; then
      cut=; admission_cut_command "$line" && cut=1
      read -ra words <<< "$cmd"
      if ! new=$(CAPPED_KIND='' admission_class words 0 "${words[@]}") || [[ ! $new =~ ^curator(-[a-z]+)?$ ]]; then
        echo "can't classify $id: $what; it keeps $class" >&2
        bad=1; continue
      fi
      # A line the log cut (100 characters) may have lost arguments, and
      # curator-inventory's forms are exact (admission_inventory_command): any
      # further word makes a near miss, so its stored words don't prove it.
      [[ -n $cut ]] && [[ $new == curator-inventory ]] && new=$class
    elif [[ -z $declared && $class =~ ^prep-light-[0-9]+$ ]] && grep -q '^prep: full' "$logs/bounded-$id.log" 2> /dev/null; then
      new=prep-full-${class#prep-light-}
    fi
    [[ $new == "$class" ]] && continue
    if [[ $line != "$t $class $real "* ]]; then
      echo "can't relabel $id: its fields aren't single-space separated; it keeps $class" >&2
      bad=1; continue
    fi
    echo "$n $class $new $id"
  done
  return "$bad"
}

admission_lock() {
  mkdir -p "$admission_dir/entries" || return 72
  exec {admission_mutex}>> "$admission_dir/mutex" || return 72
  flock "$admission_mutex"
}
admission_unlock() { exec {admission_mutex}>&-; }

# admission_entries [<id>...]: one line per entry, oldest first, leaving out the named ids:
# <id> <state> <priority 0|1> <seq> <MiB> <class> <since> <locks> <grow> <claimed> <held> <what...>
# (locks: a pending intent's awaited locks, or the locks a command's owning
# job holds, comma-separated; grow: <class>:<MiB> an active job waits to grow
# to (admission_escalate, admission_outgrow), or wait:<class>:<MiB> for a
# small-class run whose grow waits for another's (admission_outgrow); claimed: 1 for an intent whose gate takes its locks
# now (admission_intent); held: 1 for a queued capped.sh command nothing more
# may start ahead of (admission_hold); - for none)
admission_entries() {
  local files=("$admission_dir"/entries/*.entry)
  [[ -f ${files[0]} ]] || return 0
  awk -F= -v skip=" $* " '
    function emit() { if (index(skip, " " e["id"] " ") == 0) print e["id"], e["state"], e["prio"], e["seq"], e["mib"], e["class"], e["since"], (e["locks"] == "" ? "-" : e["locks"]), (e["grow"] == "" ? "-" : e["grow"]), (e["claimed"] == "" ? "-" : e["claimed"]), (e["held"] == "" ? "-" : e["held"]), e["what"]; delete e }
    FNR == 1 && NR > 1 { emit() }
    { e[$1] = substr($0, length($1) + 2) }
    END { if (NR) emit() }' "${files[@]}" | sort -k4,4n
}

# admission_live <id>: whether a process still holds the entry's lock.
admission_live() {
  local c held=$admission_dir/entries/$1.held
  [[ -f $held ]] && exec {c}< "$held" || return 1
  if flock -n "$c"; then exec {c}<&-; return 1; fi
  exec {c}<&-
}

admission_event() {
  local f=$admission_dir/entries/$2.entry mib
  mib=$(sed -n 's/^mib=//p' "$f" 2> /dev/null)
  printf '%s %s %s %s %s%s\n' "$(date -u +%FT%TZ)" "$1" "$2" \
    "$(sed -n 's/^class=//p' "$f" 2> /dev/null)" "${mib:+$(admission_show "$mib")}" "${3:+ $3}" >> "$admission_dir/events.log"
}

# admission_sweep: removes the entries of jobs that are gone (locked), after
# admission_hold has seen them end.
admission_sweep() {
  local f id gone=()
  for f in "$admission_dir"/entries/*.entry; do
    [[ -f $f ]] || continue
    id=${f##*/}; id=${id%.entry}
    admission_live "$id" || gone+=("$id")
  done
  (( ${#gone[@]} )) || return 0
  admission_hold "${gone[@]}"
  for id in "${gone[@]}"; do
    admission_event ended "$id" "no process holds it"
    rm -f "$admission_dir/entries/$id.entry" "$admission_dir/entries/$id.held"
  done
}

# admission_age <since>: how long ago, <s>s or <m>m, from bash's own clock; 3 for a since that isn't a whole number.
admission_age() {
  local now s
  [[ $1 =~ ^[0-9]+$ ]] || return 3
  printf -v now '%(%s)T' -1
  s=$(( now - $1 )); (( s < 60 )) && echo "${s}s" || echo "$(( s / 60 ))m"
}

# admission_join <item>...: the items joined with ", ", or "none" for no items (builtins only).
admission_join() { local out= item; for item; do out+=${out:+, }$item; done; echo "${out:-none}"; }

# admission_line [<intent id>]: the status line (locked, after a sweep), as the intent sees it when one
# is named (admission_format); nothing and 3 when the budget, the entries or the formatting fail, never a
# line with a made-up budget or an empty ledger.
admission_line() {
  local - budget line
  set -o pipefail
  budget=$(admission_mib budget 2> /dev/null) && [[ $budget =~ ^[0-9]+$ ]] || { echo "admission: no memory budget" >&2; return 3; }
  line=$(admission_entries | admission_format "$budget" "${1:-}") || { echo "admission: can't read or format the ledger" >&2; return 3; }
  echo "$line"
}

# admission_show_checked <MiB>: admission_show, or 3 when it fails or prints no number.
admission_show_checked() { local g; g=$(admission_show "$1") && [[ $g =~ ^[0-9]+(\.[0-9])?$ ]] || return 3; echo "$g"; }

# admission_format <budget MiB> [<intent id>]: the status line from admission_entries lines on stdin; 3 and
# nothing when any part fails (a size, an age), so a failure never prints as an empty list. "none" means no
# entries. With the id of an intent that isn't admitted (a gate or prep's, priority high), the line is as
# that intent sees it: the intent and the entries waiting behind it (normal ones not yet admitted, and
# later intents) leave queued for a last "; behind <id>: ..." part. With any other id it is the plain line.
# A queued capped.sh command that others started past, or that is held, says so (admission_head_note).
admission_format() {
  local budget=$1 for=${2:-} reserved=0 id state prio seq mib class since locks grow claimed held what active=() queued=() behind=()
  local size age total cap kind item rows=() row after= suspect
  mapfile -t rows
  if [[ -n $for ]]; then
    for row in "${rows[@]}"; do
      read -r id state prio seq _ <<< "$row"
      [[ $id == "$for" && $state != active && $prio == 0 ]] && after=$seq
    done
  fi
  for row in "${rows[@]}"; do
    read -r id state prio seq mib class since locks grow claimed held what <<< "$row"
    age=$(admission_age "$since") || return 3
    if [[ $state == pending ]]; then size='waiting for its locks'; else size=$(admission_show_checked "$mib") || return 3; size+=G; fi
    if [[ $state == active ]]; then
      if [[ $grow == wait:* ]]; then
        total=$(admission_show_checked "${grow##*:}") || return 3
        grow=${grow#wait:}; grow="outgrown: its grow to ${grow%:*} ${total}G waits for another's, "
      elif [[ $grow != - ]]; then
        total=$(admission_show_checked "${grow#*:}") || return 3
        grow="growing to ${grow%:*} ${total}G, "
      else
        grow=
      fi
      suspect=$(admission_suspect "$id")
      reserved=$(( reserved + mib )); active+=("$id ($class $size, $age, $grow${suspect:+stalled? $suspect s at its soft limit, }$what)")
    else
      kind=; [[ $prio == 0 ]] && kind='gate/prep, '
      if [[ $state == queued && $prio == 1 ]]; then kind=$(admission_head_note "$seq" "$mib" "$held" "$budget" "${rows[@]}") || return 3; fi
      item="$id ($class $size, $age, $kind$what)"
      if [[ -n $after && $id == "$for" ]]; then continue
      elif [[ -n $after && ( $prio == 1 || ( $state == pending && seq -gt after ) ) ]]; then behind+=("$item")
      else queued+=("$item"); fi
    fi
  done
  total=$(admission_show_checked "$reserved") && cap=$(admission_show_checked "$budget") || return 3
  printf 'memory: %s/%s GiB reserved; active: %s; queued: %s%s\n' "$total" "$cap" "$(admission_join "${active[@]}")" "$(admission_join "${queued[@]}")" \
    "${after:+; behind $for: $(admission_join "${behind[@]}")}"
}

# admission_suspect <id>: the seconds a running job has been at its soft
# limit, from its sampler's file, while it is a stall suspect
# (admission_stalled); nothing otherwise. Builtins only, as admission_peek needs.
admission_suspect() {
  local k v f=$admission_dir/samples/$1
  [[ -r $f ]] || return 0
  while IFS='=' read -r k v; do [[ $k == suspect ]] && echo "$v"; done 2> /dev/null < "$f"
  return 0
}

# admission_status [--for <intent id>]: the status line, after a sweep; with --for, as that intent sees it.
admission_status() {
  local code for=
  if [[ ${1:-} == --for ]]; then
    [[ -n ${2:-} ]] || { echo "usage: admission.sh status [--for <intent id>]" >&2; return 64; }
    for=$2
  fi
  admission_lock || return 72
  admission_sweep
  admission_hold
  admission_line "$for"; code=$?
  admission_unlock
  return "$code"
}

# admission_lock_state <file>: prints held, free or missing, read from /proc/locks; it takes no lock
# and opens nothing. missing only when stat itself says the file does not exist (ENOENT); any read that
# fails (stat for another reason, findmnt, /proc/locks) prints the reason on stderr and returns 3, never
# free or missing. /proc/locks names the filesystem's device, which on btrfs is the mount's (findmnt),
# not the subvolume's st_dev, so both are tried; a waiter ("->") holds nothing.
admission_lock_state() {
  local file=$1 ino dev mount out locks=${ADMISSION_PROC_LOCKS:-/proc/locks}
  if ! out=$(LC_ALL=C stat -L -c '%i %Hd:%Ld' -- "$file" 2>&1); then
    [[ $out == *': No such file or directory' ]] && { echo missing; return 0; }
    echo "can't stat $file: $out" >&2; return 3
  fi
  read -r ino dev <<< "$out"
  [[ $ino =~ ^[0-9]+$ && $dev =~ ^[0-9]+:[0-9]+$ ]] || { echo "can't stat $file: $out" >&2; return 3; }
  mount=$(findmnt -no MAJ:MIN -T "$file") && mount=${mount// /} && [[ $mount =~ ^[0-9]+:[0-9]+$ ]] \
    || { echo "can't find the mount of $file" >&2; return 3; }
  [[ -r $locks ]] || { echo "can't read $locks" >&2; return 3; }
  out=$(awk -v ino="$ino" -v devs="$dev $mount" '
    BEGIN { n = split(devs, d, " "); for (i = 1; i <= n; i++) if (split(d[i], p, ":") == 2) want[sprintf("%02x:%02x:%s", p[1], p[2], ino)] = 1 }
    $2 == "FLOCK" && ($6 in want) { found = 1 }
    END { print found ? "held" : "free" }' "$locks") && [[ $out == held || $out == free ]] || { echo "can't read $locks" >&2; return 3; }
  echo "$out"
}

# admission_entry_valid <file>: the entry is readable and well formed: every line key=value, id its
# file's name, state active, queued or pending, prio 0 or 1, and mib, seq and since whole numbers.
admission_entry_valid() {
  local id=${1##*/}
  [[ -r $1 ]] || { echo "can't read $1" >&2; return 3; }
  awk -F= -v id="${id%.entry}" '
    !/^[a-z]+=/ { bad = 1 } { n[$1]++; v[$1] = substr($0, length($1) + 2) }
    END {
      for (k in n) if (n[k] > 1) bad = 1
      if (v["id"] != id || v["state"] !~ /^(active|queued|pending)$/ || v["prio"] !~ /^[01]$/) bad = 1
      if (v["mib"] !~ /^[0-9]+$/ || v["seq"] !~ /^[0-9]+$/ || v["since"] !~ /^[0-9]+$/ || !("class" in n) || !("what" in n)) bad = 1
      exit bad }' "$1" || { echo "malformed or unreadable entry $1" >&2; return 3; }
}

# admission_peek: the status line from the entries as they are, leaving out those no process holds,
# then "stale: <ids>" (the entries status would sweep) or "stale: none". No mutex, sweep or event:
# it reads the ledger, /proc/locks and the samplers' files (admission_suspect) and writes nothing,
# so an observation never changes the ledger.
# A ledger it cannot read whole (its directory, an entry, a lock state, the memory table) prints
# nothing on stdout and returns 3 with the reason on stderr, never an idle line.
# Every command it runs is checked, under pipefail: a non-zero exit, or output missing where some is
# required, is an error. It prints only once all of it succeeded. Its tools are stat, findmnt, awk and
# sort (admission.test.sh runs it with nothing else on PATH); the rest are bash builtins.
admission_peek() {
  local - ledger=$admission_dir/entries peaks=$admission_dir/peaks.log f id state stale=() live=0 budget entries rows=() line
  set -o pipefail
  [[ -r $admission_table ]] || { echo "can't read the memory table $admission_table" >&2; return 3; }
  [[ ! -e $peaks || -r $peaks ]] || { echo "can't read $peaks" >&2; return 3; }
  [[ -d $ledger && -r $ledger && -x $ledger ]] || { echo "can't read the ledger $ledger" >&2; return 3; }
  for f in "$ledger"/*.entry; do
    [[ -e $f || -L $f ]] || continue  # no entries (the unmatched pattern)
    admission_entry_valid "$f" || return 3
    state=$(admission_lock_state "${f%.entry}.held") || return 3
    id=${f##*/}; id=${id%.entry}
    if [[ $state == held ]]; then live=$(( live + 1 )); else stale+=("$id"); fi
  done
  budget=$(admission_mib budget) && [[ $budget =~ ^[0-9]+$ ]] || { echo "no memory budget" >&2; return 3; }
  entries=$(admission_entries "${stale[@]}") || { echo "can't read the entries in $ledger" >&2; return 3; }
  [[ -n $entries ]] && mapfile -t rows <<< "$entries"
  (( ${#rows[@]} == live )) || { echo "read ${#rows[@]} of the $live held entries in $ledger" >&2; return 3; }
  line=$(if (( live )); then printf '%s\n' "${rows[@]}"; fi | admission_format "$budget") && [[ $line == 'memory: '* ]] \
    || { echo "can't format the ledger" >&2; return 3; }
  printf '%s\nstale: %s\n' "$line" "${stale[*]:-none}"
}

# admission_held <file>...: "held|free|missing <file>" per file; "error <file>" for one it can't read,
# with the reason on stderr, and then 3.
# Its tools are stat, findmnt and awk, each checked in admission_lock_state.
admission_held() {
  local - f state code=0
  set -o pipefail
  for f in "$@"; do
    if state=$(admission_lock_state "$f") && [[ $state == held || $state == free || $state == missing ]]; then
      echo "$state $f"
    else
      echo "error $f"; code=3
    fi
  done
  return "$code"
}

# admission_table_report: one line per class: reservation and basis.
admission_table_report() {
  local class r
  for class in $(awk '$1 !~ /^#/ && NF && $1 != "margin" { print $1 }' "$admission_table"); do
    r=$(admission_class_reservation "$class") || continue
    printf '%-14s %5s GiB  %s\n' "$class" "$(admission_show "${r%% *}")" "${r#* }"
  done
}

# admission_fits <id> <MiB> <priority> <seq> <budget MiB> <locks>: nothing
# is queued ahead and the reservation fits beside the active ones, or nothing
# is active (locked). A pending intent (a gate or prep still waiting for its
# locks, or a gate driver's from before its prelaunch: admission_intent) is
# ahead of every normal entry, except where holding one back could deadlock
# (admission_intent_blocks). It is never ahead of a high one (that one may
# hold the lock). An entry whose job holds locks also passes earlier entries
# of its own priority where they may be waiting on an intent that waits on
# its job (admission_exempt). A normal entry (a capped.sh command) otherwise
# passes an earlier queued normal one only when that one may be passed
# (admission_passable: it doesn't fit, and isn't held); high entries keep
# their order among themselves, and no normal entry passes one. An active job
# waiting to grow (admission_escalate, admission_outgrow; a small-class run
# waiting for another's grow too) is ahead of every entry. What holds the
# entry back, an entry's id or "memory", is left in admission_blocker for
# admission_wait's report, and the ids of the entries it passes by
# admission_passable in admission_passed.
admission_fits() {
  local id state prio seq mib class since locks grow claimed held what sum=0 count=0 rows=() row passed=() exempt=0
  admission_blocker= admission_passed=
  mapfile -t rows < <(admission_entries)
  admission_exempt "$3" "$6" "${rows[@]}" && exempt=1
  for row in "${rows[@]}"; do
    read -r id state prio seq mib class since locks grow claimed held what <<< "$row"
    [[ $id == "$1" ]] && continue
    case $state in
      active) sum=$(( sum + mib )); count=$(( count + 1 )); [[ $grow == - ]] || { admission_blocker=$id; return 1; } ;;
      pending) (( prio < $3 )) && admission_intent_blocks "$locks" "$6" "$claimed" && { admission_blocker=$id; return 1; } ;;
      *)
        (( prio < $3 )) && { admission_blocker=$id; return 1; }
        (( prio == $3 && seq < $4 && ! exempt )) || continue
        (( $3 == 1 )) && admission_passable "$seq" "$mib" "$held" "$5" "${rows[@]}" || { admission_blocker=$id; return 1; }
        passed+=("$id") ;;
    esac
  done
  (( count == 0 || sum + $2 <= $5 )) || { admission_blocker=memory; return 1; }
  admission_passed=${passed[*]}
}

# admission_passable <seq> <MiB> <held> <budget MiB> <entry line>...:
# whether a later capped.sh command may start ahead of the queued capped.sh
# command (the head) of that seq, reservation and held field, from
# admission_entries lines: it isn't held, and it doesn't fit even without the
# commands already started past it (its passers: active, normal, a later seq;
# a normal entry is registered queued, so an active one with a later seq was
# admitted while the head waited). Once its passers alone keep it out
# (without them it fits, or nothing else is active), the head is held
# (admission_hold), and held it stays until it is admitted or cancelled: a
# reservation that grows or starts later never makes it passable again. The
# bound: once held, nothing more starts ahead of it, so it waits for its
# passers' runs to end and for what would have kept it out without passing; a
# stream of later commands never delays it further. Builtins only
# (admission_peek).
admission_passable() {
  local head=$1 need=$2 budget=$4 row id state prio seq mib rest sum=0 count=0
  [[ $3 == 1 ]] && return 1
  shift 4
  for row; do
    read -r id state prio seq mib rest <<< "$row"
    [[ $state == active ]] || continue
    (( prio == 1 && seq > head )) && continue
    sum=$(( sum + mib )); count=$(( count + 1 ))
  done
  (( count > 0 && sum + need > budget ))
}

# admission_passers <seq> <entry line>...: the ids of the commands that
# started past the queued capped.sh command of that seq (admission_passable),
# space-separated; nothing when none did. Builtins only.
admission_passers() {
  local head=$1 row id state prio seq rest out=
  shift
  for row; do
    read -r id state prio seq rest <<< "$row"
    [[ $state == active ]] && (( prio == 1 && seq > head )) && out+=${out:+ }$id
  done
  echo "$out"
}

# admission_hold [<ending id>...]: marks each queued capped.sh command that
# its passers alone now keep out (admission_passable) as held (held=1, and a
# "held" event naming them), so that nothing more starts ahead of it until it
# is admitted or cancelled, whatever the other reservations do meanwhile (a
# prep that grows, a job that starts or ends). Every look runs it after its
# sweep, before anything is admitted or grows (admission_step,
# admission_grow_step), status after its sweep, and the sweep and
# admission_release before they remove an ended job's entry, named as ending:
# an ending job no longer keeps the head out, but an ending passer still
# counts as one, since it ran past the head until its end, which no look may
# have seen (locked). So no change goes unseen, not even two jobs that end
# between two looks. A failed write leaves the command unmarked for the next
# look.
admission_hold() {
  local rows=() kept=() row id state prio seq mib class since locks grow claimed held what budget passers
  budget=$(admission_mib budget) || return 0
  mapfile -t rows < <(admission_entries)
  mapfile -t kept < <(admission_entries "$@")
  for row in "${kept[@]}"; do
    read -r id state prio seq mib class since locks grow claimed held what <<< "$row"
    [[ $state == queued && $prio == 1 && $held != 1 ]] || continue
    passers=$(admission_passers "$seq" "${rows[@]}")
    [[ -n $passers ]] && ! admission_passable "$seq" "$mib" "$held" "$budget" "${kept[@]}" || continue
    admission_set "$id" held 1 && admission_event held "$id" "by $passers"
  done
  return 0
}

# admission_head_note <seq> <MiB> <held> <budget MiB> <entry line>...: what
# status says of a queued capped.sh command, followed by ", ": while others
# started past it and may still (admission_passable), "passed by <ids>: it
# needs <n>G, <m>G free"; once it is held, "held: passed by <ids>, nothing
# more passes it", or "held: nothing more passes it" once they have ended;
# nothing otherwise. 3 when a size fails. Builtins only.
admission_head_note() {
  local seq=$1 mib=$2 held=$3 budget=$4 passers need have
  shift 4
  passers=$(admission_passers "$seq" "$@")
  if [[ $held == 1 ]]; then echo "held: ${passers:+passed by $passers, }nothing more passes it, "
  elif [[ -z $passers ]]; then return 0
  elif admission_passable "$seq" "$mib" "$held" "$budget" "$@"; then
    need=$(admission_show_checked "$mib") && have=$(admission_show_checked "$(admission_free "$budget" "$@")") || return 3
    echo "passed by $passers: it needs ${need}G, ${have}G free, "
  else echo "held: passed by $passers, nothing more passes it, "; fi
}

# admission_free <budget MiB> <entry line>...: the MiB the active entries
# leave of the budget, 0 at least. Builtins only.
admission_free() {
  local free=$1 row id state prio seq mib rest
  shift
  for row; do
    read -r id state prio seq mib rest <<< "$row"
    [[ $state == active ]] && free=$(( free - mib ))
  done
  echo $(( free > 0 ? free : 0 ))
}

# admission_exempt <priority> <held locks> <entry line>...: whether an entry
# whose job holds those locks passes every earlier queued entry of its own
# priority, whatever it is: a high one (a bounded job, which registers the
# locks it took) whenever it holds locks; a normal one (a capped.sh command
# with BOUNDED_HELD_LOCKS: a bounded role's worker, or gate_operator.py
# prepare's record verifier) only while a gate or prep intent (pending, high)
# awaits one of them, since then the earlier entry may wait on the intent,
# which waits on this command's job: holding it back would deadlock. Any
# other normal entry passes an earlier one only by admission_passable.
admission_exempt() {
  local prio=$1 have=$2 row id state p seq mib class since locks rest lock
  shift 2
  [[ -n $have ]] || return 1
  (( prio == 0 )) && return 0
  for row; do
    read -r id state p seq mib class since locks rest <<< "$row"
    [[ $state == pending && $p == 0 ]] || continue
    for lock in ${have//,/ }; do [[ ,$locks, == *",$lock,"* ]] && return 0; done
  done
  return 1
}

# admission_intent_blocks <awaited locks> <held locks> <claimed>: whether an
# intent waiting for the first holds back a command whose job holds the
# second. It doesn't when the job holds a lock the intent waits for
# (BOUNDED_HELD_LOCKS: a bounded role's worker, or the gate's own verifier),
# which would deadlock. Nor, until it is claimed, while a curator lock it
# waits for is held (read from /proc/locks; an unreadable state counts as
# held): a curator session's slot (hold-lock.sh, beside its commands) isn't
# inherited by its capped.sh commands, so its holder may be this command's
# own job. Once claimed (its gate takes or holds the locks itself; a gate
# unit's own intent from its registration, admission_unit_claims), a held
# curator lock is its own gate's, and it holds back every command but its
# gate's own.
admission_intent_blocks() {
  local lock state
  for lock in ${2//,/ }; do [[ ,$1, == *",$lock,"* ]] && return 1; done
  [[ $3 == 1 ]] && return 0
  for lock in ${1//,/ }; do
    [[ $lock == curator* ]] || continue
    state=$(admission_lock_state "${admission_dir%/*}/$lock.lock" 2> /dev/null)
    [[ $state == free || $state == missing ]] || return 1
  done
  return 0
}

# admission_register <id> <class> high|normal <what> pending|queued [locks]:
# adds the entry and takes its lock (admission_fd, inherited by every child).
# A queued entry records BOUNDED_GATE_UNIT, when set, as its gate unit.
# A pending entry is an intent: it reserves nothing yet (admission_request
# makes it queued); a gate unit's own is claimed from the start
# (admission_unit_claims, a "claiming" event). [locks]: an intent's awaited
# locks, or the locks the command's owning job holds (space- or
# comma-separated). Returns 0, 64 (bad id, class or priority, or the id
# exists) or 72 (no state directory).
admission_register() {
  local id=$1 class=$2 what=$4 state=$5 locks=${6:-} gate=${BOUNDED_GATE_UNIT:-} prio mib=0 seq entry held claimed=
  locks=$(printf '%s' "$locks" | tr -s ' ,' ',,'); locks=${locks#,}; locks=${locks%,}
  [[ $id =~ ^[A-Za-z0-9._-]{1,120}$ ]] || { echo "bad reservation id: $id" >&2; return 64; }
  [[ -z $gate || $gate =~ ^[A-Za-z0-9._-]{1,120}$ ]] || { echo "bad gate unit id (BOUNDED_GATE_UNIT): $gate" >&2; return 64; }
  case ${3:-} in high) prio=0 ;; normal) prio=1 ;; *) echo "priority must be high or normal" >&2; return 64 ;; esac
  admission_mib "$class" > /dev/null && admission_mib budget > /dev/null || return 64
  [[ $state == queued ]] && mib=$(admission_mib "$class")
  admission_unit_claims "$id" "$class" "$state" && claimed=1
  what=$(printf '%s' "$what" | tr '\n\t' '  ' | cut -c1-60)
  entry=$admission_dir/entries/$id.entry; held=$admission_dir/entries/$id.held
  admission_lock || return 72
  if [[ -e $entry || -e $held ]]; then admission_unlock; echo "reservation $id exists" >&2; return 64; fi
  exec {admission_fd}>> "$held" && flock -n "$admission_fd" || { admission_unlock; echo "can't lock $held" >&2; return 72; }
  seq=$(( $(cat "$admission_dir/seq" 2> /dev/null || echo 0) + 1 ))
  echo "$seq" > "$admission_dir/seq" \
    && printf 'id=%s\nclass=%s\nmib=%s\nprio=%s\nseq=%s\nstate=%s\npid=%s\nsince=%s\nlocks=%s\nwhat=%s\n' \
      "$id" "$class" "$mib" "$prio" "$seq" "$state" "$$" "$(date +%s)" "$locks" "$what" > "$entry.tmp" \
    && { [[ $state != queued || -z $gate ]] || printf 'gate=%s\n' "$gate" >> "$entry.tmp"; } \
    && { [[ -z $claimed ]] || printf 'claimed=1\n' >> "$entry.tmp"; } \
    && mv -f "$entry.tmp" "$entry" || { admission_unlock; admission_close "$id"; echo "can't write $entry" >&2; return 72; }
  [[ -z $claimed ]] || admission_event claiming "$id" "a gate unit's own intent: it takes its locks now"
  admission_unlock
}

# admission_unit_claims <id> <class> <state>: whether the entry is a gate
# unit's own intent, which is claimed from its registration: a pending entry
# of a gate class (gate-<n>, bounded.sh kind gate) registered under the unit's
# own BOUNDED_ID, as its wrapper registers it before its locks
# (run-bounded-command.sh, register_job_intent). The unit takes its locks now,
# so a curator lock held while it waits may be its own partial hold (curator
# taken, curator2 awaited), never a worker's slot to let commands past
# (admission_intent_blocks). A driver's intent (driver-<id>, admission_intent)
# and a prep unit's stay unclaimed until their owner claims them.
admission_unit_claims() {
  [[ $3 == pending && $2 == gate-* && -n ${BOUNDED_ID:-} && $1 == "$BOUNDED_ID" ]]
}

# admission_field <id> <key>: one value of the entry.
admission_field() { sed -n "s/^$2=//p" "$admission_dir/entries/$1.entry" 2> /dev/null; }

# admission_transition <id> <state> [MiB]: rewrites the entry's state (and
# reservation) and checks it took; fails when it didn't (locked).
admission_transition() {
  local entry=$admission_dir/entries/$1.entry
  awk -v st="$2" -v mib="${3:-}" -v now="$(date +%s)" -F= '
    $1 == "state" { $0 = "state=" st } $1 == "since" { $0 = "since=" now }
    $1 == "mib" && mib != "" { $0 = "mib=" mib } { print }' "$entry" > "$entry.tmp" \
    && mv -f "$entry.tmp" "$entry" && [[ $(admission_field "$1" state) == "$2" ]]
}

# admission_set <id> <key> <value> [<key> <value>...]: rewrites (or adds)
# fields of the entry (locked).
admission_set() {
  local entry=$admission_dir/entries/$1.entry
  shift
  awk -F= -v kv="$(printf '%s\n' "$@")" '
    BEGIN { n = split(kv, a, "\n"); for (i = 1; i < n; i += 2) { v[a[i]] = a[i + 1]; order[i] = a[i] } }
    $1 in v { print $1 "=" v[$1]; done[$1] = 1; next } { print }
    END { for (i = 1; i < n; i += 2) if (!(order[i] in done)) print order[i] "=" v[order[i]] }' "$entry" > "$entry.tmp" \
    && mv -f "$entry.tmp" "$entry"
}

# admission_escalate <id>: a light prep that turns full (cur-prep.sh, once its
# plan says full, before its tests): its active prep-light-<n> reservation
# grows to prep-full-<n>'s, and the run is recorded as prep-full-<n>
# (admission_record). It keeps running on the light reservation while the
# growth doesn't fit, ahead of every queued entry (the growing job waits only
# for active ones to end, so nothing can deadlock), and returns 0 once it
# holds the full one. Any other class, or a reservation that isn't active, is
# left alone (0): a landing queue's prep runs under its gate. 143 on TERM or
# INT, 73 after BOUNDED_WAIT_TIMEOUT seconds when that is set (the light
# reservation stays), 72 on a failed write, 64 for a class not in the table
# and for a remote-suite prep (prep-remote), which runs no tests and so never
# grows: its reservation stays as it is.
admission_escalate() {
  local id=$1 class full mib start=$SECONDS status said=0 old_traps
  admission_lock || return 72
  admission_sweep
  class=$(admission_field "$id" class)
  if [[ $class == prep-remote ]]; then admission_unlock; echo "$id: prep-remote runs no tests; it never escalates" >&2; return 64; fi
  if [[ ! $class =~ ^prep-light-[0-9]+$ || $(admission_field "$id" state) != active ]]; then admission_unlock; return 0; fi
  full=prep-full-${class#prep-light-}
  mib=$(admission_mib "$full") || { admission_unlock; return 64; }
  mkdir -p "$admission_dir/classes" && echo "$full" > "$admission_dir/classes/$id" && admission_set "$id" grow "$full:$mib" \
    || { admission_unlock; rm -f "$admission_dir/classes/$id"; return 72; }
  admission_event escalating "$id" "to $full $(admission_show "$mib")"
  admission_unlock
  old_traps=$(trap -p TERM INT)
  admission_cancelled=0
  trap 'admission_cancelled=1' TERM INT
  while :; do
    admission_lock || { status=72; break; }
    admission_grow_step "$id" "$full" "$mib" "$(( SECONDS - start ))"; status=$?
    if (( status == 1 && ! said )); then
      echo "waiting for memory: $id grows to $full ($(admission_show "$mib") GiB); $(admission_line)" >&2
      said=1
    fi
    admission_unlock
    (( status == 1 )) || break
    sleep "${ADMISSION_INTERVAL:-1}" & wait $!
  done
  trap - TERM INT; eval "$old_traps"
  (( status == 0 )) || rm -f "$admission_dir/classes/$id"
  (( status == 0 && said )) && echo "$id grew to $full after $(( SECONDS - start )) s" >&2
  return "$status"
}

# admission_grow_step <id> <class> <MiB> <waited seconds>: one look (locked):
# 0 grown, 1 keep waiting, 143, 73 or 72 (the light reservation stays).
admission_grow_step() {
  local id state prio seq mib class since locks grow claimed held what sum=0 count=0
  admission_sweep
  admission_hold
  [[ -f $admission_dir/entries/$1.entry ]] || return 143
  if (( admission_cancelled )); then admission_set "$1" grow - ; admission_event cancelled "$1" "growing, signal"; return 143; fi
  while read -r id state prio seq mib class since locks grow claimed held what; do
    [[ $id != "$1" && $state == active ]] && { sum=$(( sum + mib )); count=$(( count + 1 )); }
  done < <(admission_entries)
  if (( count == 0 || sum + $3 <= $(admission_mib budget) )); then
    admission_set "$1" class "$2" mib "$3" grow - || { admission_event failed "$1" "state write"; return 72; }
    admission_event grown "$1" "$( (( $4 )) && echo "after $4 s")"
    return 0
  fi
  if [[ -n ${BOUNDED_WAIT_TIMEOUT:-} ]] && (( $4 >= BOUNDED_WAIT_TIMEOUT )); then
    admission_set "$1" grow -; admission_event timeout "$1" "growing, after $BOUNDED_WAIT_TIMEOUT s"; return 73
  fi
  return 1
}

# admission_close <id>: drops this process's lock on the entry and its lock file.
admission_close() { exec {admission_fd}>&-; rm -f "$admission_dir/entries/$1.held" "$admission_dir/entries/$1.entry.tmp"; }

# admission_request <id>: a pending intent asks for its class's memory now
# (after its locks): it becomes queued at the reservation of the moment.
# Returns 143 when the intent was cancelled meanwhile (admission.sh cancel).
admission_request() {
  local mib class
  admission_lock || return 72
  class=$(admission_field "$1" class)
  if [[ -z $class ]]; then admission_unlock; admission_close "$1"; echo "stopped waiting for memory: $1" >&2; return 143; fi
  mib=$(admission_mib "$class") && admission_transition "$1" queued "$mib" \
    || { admission_event failed "$1" "state write"; rm -f "$admission_dir/entries/$1.entry"; admission_unlock; admission_close "$1"; echo "can't queue $1" >&2; return 72; }
  admission_unlock
}

# admission_step <id> <waited seconds>: one look (locked): 0 admitted, 1 keep
# waiting, 143 cancelled (the entry is gone, or a signal), 73 timed out, 74 a
# normal one below the disk floor (the entry is gone), 72 a failed write.
admission_step() {
  local id=$1 entry=$admission_dir/entries/$1.entry
  admission_sweep
  [[ -f $entry ]] || return 143                            # admission.sh cancel
  if (( admission_cancelled )); then admission_event cancelled "$id" signal; rm -f "$entry"; return 143; fi
  if [[ $(admission_field "$id" prio) == 1 ]] && ! admission_disk_floor "$id"; then
    admission_event refused "$id" "disk floor, queued"; rm -f "$entry"; return 74
  fi
  admission_hold
  if admission_gate_holds "$id"; then
    admission_transition "$id" active 0 || { admission_event failed "$id" "state write"; rm -f "$entry"; return 72; }
    admission_event admitted "$id" "$( (( $2 )) && echo "after $2 s ")inside gate unit $(admission_field "$id" gate)'s reservation"
    return 0
  fi
  if admission_fits "$id" "$(admission_field "$id" mib)" "$(admission_field "$id" prio)" "$(admission_field "$id" seq)" "$(admission_mib budget)" "$(admission_field "$id" locks)"; then
    admission_transition "$id" active || { admission_event failed "$id" "state write"; rm -f "$entry"; return 72; }
    admission_event admitted "$id" "$( (( $2 )) && echo "after $2 s")${admission_passed:+$( (( $2 )) && echo ' ')past $admission_passed}"
    return 0
  fi
  if [[ -n ${BOUNDED_WAIT_TIMEOUT:-} ]] && (( $2 >= BOUNDED_WAIT_TIMEOUT )); then
    admission_event timeout "$id" "after $BOUNDED_WAIT_TIMEOUT s"; rm -f "$entry"; return 73
  fi
  return 1
}

# admission_gate_holds <id>: whether the entry names a gate unit (its gate
# field, BOUNDED_GATE_UNIT) whose own entry is active and high, so the entry
# is part of that gate: admitted at once, inside the unit's reservation.
# After a sweep, so the unit's entry belongs to a live job.
admission_gate_holds() {
  local gate
  gate=$(admission_field "$1" gate)
  [[ -n $gate && $gate != "$1" && $(admission_field "$gate" state) == active && $(admission_field "$gate" prio) == 0 ]]
}

# admission_wait <id>: polls until the queued entry is admitted (0), cancelled
# by TERM, INT or admission.sh cancel (143), timed out (73), refused below the
# disk floor (74, a normal one) or a write failed (72); on anything but 0 the
# entry is gone and this process's lock dropped.
admission_wait() {
  local id=$1 start=$SECONDS old_traps status said=0
  old_traps=$(trap -p TERM INT)
  admission_cancelled=0
  trap 'admission_cancelled=1' TERM INT
  while :; do
    admission_lock || { status=72; break; }
    admission_step "$id" "$(( SECONDS - start ))"; status=$?
    if (( status == 1 && ! said )); then
      if [[ $admission_blocker != memory && $(admission_field "$admission_blocker" state) == pending ]]; then
        admission_event queued "$id" "behind $admission_blocker"
        echo "waiting for a gate or prep: $id ($(admission_field "$id" class), $(admission_show "$(admission_field "$id" mib)") GiB) waits behind $admission_blocker; $(admission_line)" >&2
      else
        admission_event queued "$id"
        echo "waiting for memory: $id needs $(admission_show "$(admission_field "$id" mib)") GiB ($(admission_field "$id" class)); $(admission_line)" >&2
      fi
      said=1
    fi
    admission_unlock
    (( status == 1 )) || break
    sleep "${ADMISSION_INTERVAL:-1}" & wait $!
  done
  trap - TERM INT; eval "$old_traps"
  case $status in
    0) (( said )) && echo "admitted $id after $(( SECONDS - start )) s" >&2; return 0 ;;
    143) echo "stopped waiting for memory: $id" >&2 ;;
    73) echo "gave up waiting for memory after $BOUNDED_WAIT_TIMEOUT s: $id" >&2 ;;
  esac
  admission_close "$id"
  return "$status"
}

# admission_reserve <id> <class> high|normal [what] [held locks]: registers a
# queued reservation and waits for it (admission_register, admission_wait).
# A normal one (a capped.sh command) is checked against the disk floor
# (admission_disk_floor) before it registers and on every pass of its wait
# (admission_step), and refused with 74 below it; a high one (a bounded job)
# is left to its own guard, a gate's prelaunch.
# Returns 0 (admitted; this process and its children hold it), 73, 74, 143,
# 64 or 72.
admission_reserve() {
  [[ $3 != normal ]] || admission_disk_floor "$1" || return
  admission_register "$1" "$2" "$3" "${4:-}" queued "${5:-}" || return
  admission_wait "$1"
}

# admission_disk_floor <id>: 74 when the volume holding the state directory
# or $PWD is below a disk floor (disk_guard.py: free data, and on btrfs the
# metadata headroom unless enough is unallocated), saying which floor and its
# values on stderr. A probe that cannot read a part only warns, and one that
# fails to run at all (no python3, a crash, 10 s without an answer) warns
# too: it never refuses on its own. It runs at entry and on every wait pass,
# so each warning is printed once per id (admission_disk_warn).
admission_disk_floor() {
  local out status
  out=$(timeout 10 python3 -B "$admission_here/disk_guard.py" check "${admission_dir%/*}" "$PWD" 2>&1); status=$?
  case $status in
    0) [[ -z $out ]] || admission_disk_warn "$1" "$out" ;;
    74) [[ $out != *$'\n'* ]] || admission_disk_warn "$1" "${out%$'\n'*}"
      printf 'admission: %s refused: %s; not started\n' "$1" "${out##*$'\n'}" >&2
      return 74 ;;
    124) admission_disk_warn "$1" 'disk floor: warning: probe timed out after 10 s; not checked' ;;
    *) admission_disk_warn "$1" "disk floor: warning: probe failed (exit $status: $out); not checked" ;;
  esac
}

# admission_disk_warn <id> <warning>: prints the warning on stderr unless this
# process already printed it for the id, so a reason that lasts across wait
# passes is said once and each new one is said when it appears.
admission_disk_warned=$'\n'
admission_disk_warn() {
  [[ $admission_disk_warned != *$'\n'"$1 $2"$'\n'* ]] || return 0
  admission_disk_warned+="$1 $2"$'\n'
  printf 'admission: %s: %s\n' "$1" "$2" >&2
}

# admission_yield [<seconds>]: a curator slot taker's check before it takes a
# slot (hold-lock.sh): returns 0 at once when no gate or prep intent waits,
# else waits while one does: a live pending entry of priority high, claimed or
# not (a driver's intent until its gate unit holds its locks, a gate unit's
# or prep's while it waits for its locks). A claimed intent counts too: from
# the claim until the unit holds its locks, a slot taken then is one the gate
# needs, and the command it guards would wait behind the claimed intent. It
# takes no entry and holds no lock, so it can't hold a gate back; it is a
# check before acquiring only, never for a caller that already holds a slot.
# A wait is reported as one "waiting for a gate or prep: yield-<pid> waits
# behind <intent>" line on stderr and a "queued yield-<pid> yield 0 behind
# <intent>" event, ending in "admitted ... after <n> s" (0), "timeout" after
# <seconds>, else BOUNDED_WAIT_TIMEOUT when set (73), or "cancelled ...
# signal" on TERM or INT (143). 64 for seconds that aren't whole.
admission_yield() {
  local limit id=yield-$$ start=$SECONDS said=0 status old_traps
  limit=$(admission_yield_limit "${1:-${BOUNDED_WAIT_TIMEOUT:-}}") || return 64
  old_traps=$(trap -p TERM INT)
  admission_cancelled=0
  trap 'admission_cancelled=1' TERM INT
  while :; do
    admission_lock || { status=72; break; }
    admission_yield_step "$id" "$limit" "$(( SECONDS - start ))" "$said"; status=$?
    admission_unlock
    (( status == 1 )) || break
    said=1
    sleep "${ADMISSION_INTERVAL:-1}" & wait $!
  done
  trap - TERM INT; eval "$old_traps"
  return "$status"
}

# admission_yield_limit <seconds or ''>: the limit, or '' for none; 64 for one that isn't whole seconds.
admission_yield_limit() {
  [[ -z $1 || $1 =~ ^[1-9][0-9]*$ ]] || { echo "yield: <seconds> must be whole seconds, not '$1'" >&2; return 64; }
  echo "$1"
}

# admission_yield_blocker: the first live pending intent of priority high (after a sweep; locked), or nothing.
admission_yield_blocker() {
  admission_sweep
  admission_entries | awk '$2 == "pending" && $3 == 0 { print $1; exit }'
}

# admission_yield_step <id> <limit or ''> <waited seconds> <said 0|1>: one look (locked): 0 no intent waits,
# 1 keep waiting (its first wait reported), 73 past the limit, 143 a signal; each end of a wait has its event.
admission_yield_step() {
  local id=$1 limit=$2 waited=$3 said=$4 blocker
  blocker=$(admission_yield_blocker)
  if [[ -z $blocker ]]; then
    (( said )) && admission_yield_event admitted "$id" "after $waited s"
    return 0
  fi
  if (( admission_cancelled )); then admission_yield_event cancelled "$id" signal; return 143; fi
  if [[ -n $limit ]] && (( waited >= limit )); then admission_yield_event timeout "$id" "after $limit s"; return 73; fi
  if (( ! said )); then
    admission_yield_event queued "$id" "behind $blocker"
    echo "waiting for a gate or prep: $id waits behind $blocker; $(admission_line)" >&2
  fi
  return 1
}

# admission_yield_event <event> <id> <why>: a yield's events.log line (it has no entry; class yield, 0 GiB).
admission_yield_event() { printf '%s %s %s yield 0 %s\n' "$(date -u +%FT%TZ)" "$1" "$2" "$3" >> "$admission_dir/events.log"; }

# admission_drop <id> [why] [event]: ends an entry that was never admitted (a
# pending intent or a queued wait whose owner gives up), as a "dropped" event
# (or the one named) saying why ("never admitted"). An active reservation is
# left to the sweep or the unit's stop hook, which end it only once its job's
# last process is gone.
admission_drop() {
  admission_lock || return 72
  if [[ -f $admission_dir/entries/$1.entry && $(admission_field "$1" state) != active ]]; then
    admission_event "${3:-dropped}" "$1" "${2:-never admitted}"
    rm -f "$admission_dir/entries/$1.entry"
  fi
  admission_unlock
}

# admission_intent <id> <class> <seconds> <what> [locks...]: a gate driver's
# intent (gate-run.py), from before its prelaunch's first lock probe until its
# gate unit claims its locks: a pending entry of priority high (no memory,
# awaiting [locks]), registered with an "intent" event, held while this
# process lives. It prints "intent <id>" once registered, then reads its
# stdin: "claim" marks it claimed (the gate takes its locks now: a held
# curator lock no longer lets curator commands past, admission_intent_blocks;
# a "claiming" event); "end <why>", or the end of its stdin (the owner closed
# it or died; why: "its owner ended it"), drops it with that reason and exits
# 0. It ends by itself after <seconds> (a "timeout" event, 73), on TERM, INT
# or HUP (dropped, "signal", 143) and when `admission.sh cancel` removed it
# (143). If this process is killed outright its lock goes, and the next sweep
# ends the entry like any other ("ended", "no process holds it"). 64 for
# seconds that aren't whole, or a bad id or class; 72 for no state.
admission_intent() {
  local id=$1 limit=$3 start=$SECONDS status
  admission_intent_limit "$limit" || return 64
  admission_intent_register "$@" || return
  trap 'admission_drop "$id" signal; admission_close "$id"; exit 143' TERM INT HUP
  echo "intent $id"
  while :; do
    admission_intent_step "$id" "$limit" "$(( SECONDS - start ))"; status=$?
    (( status == 1 )) || break
  done
  admission_close "$id"
  return "$status"
}

# admission_intent_limit <seconds>: 0 for whole seconds, else 64 with the reason on stderr.
admission_intent_limit() {
  [[ $1 =~ ^[1-9][0-9]*$ ]] || { echo "intent: <seconds> must be whole seconds, not '$1'" >&2; return 64; }
}

# admission_intent_register <id> <class> <seconds> <what> [locks...]: the pending entry and its "intent" event.
admission_intent_register() {
  local id=$1 class=$2 what=$4
  shift 4
  admission_register "$id" "$class" high "$what" pending "$*" || return
  admission_lock && admission_event intent "$id" "awaiting $(admission_field "$id" locks)"; admission_unlock
}

# admission_intent_step <id> <limit> <waited seconds>: one read of the owner's stdin (at most 5 s, so a
# cancel is seen): 1 keep holding, 0 ended by its owner ("end <why>" or the end of its stdin), 73 past the
# limit, 143 cancelled (`admission.sh cancel` removed the entry). Each end but a cancel drops the entry.
admission_intent_step() {
  local id=$1 limit=$2 left=$(( $2 - $3 )) line
  if (( left <= 0 )); then admission_drop "$id" "after its $limit s limit" timeout; return 73; fi
  (( left > 5 )) && left=5
  if IFS= read -r -t "$left" line; then
    admission_intent_command "$id" "$line" || return 0
  elif (( $? <= 128 )); then
    admission_drop "$id" "its owner ended it"; return 0
  fi
  [[ -f $admission_dir/entries/$id.entry ]] || { echo "intent $id was cancelled" >&2; return 143; }
  return 1
}

# admission_intent_command <id> <line>: an owner's line: "claim" marks the intent claimed (a "claiming"
# event) and returns 0; "end <why>" drops it with that reason and returns 1; anything else is ignored (0).
admission_intent_command() {
  case $2 in
    claim) admission_lock && admission_set "$1" claimed 1 && admission_event claiming "$1" "its gate takes its locks"; admission_unlock ;;
    'end '*) admission_drop "$1" "${2#end }"; return 1 ;;
  esac
  return 0
}

# admission_release <id> [why]: ends the reservation, if it still exists.
admission_release() {
  admission_lock || return 72
  if [[ -f $admission_dir/entries/$1.entry ]]; then
    admission_hold "$1"
    admission_event released "$1" "${2:-}"
    rm -f "$admission_dir/entries/$1.entry" "$admission_dir/entries/$1.held"
  fi
  admission_unlock
}

# admission_cancel <id>: ends a queued wait. 1 when the id isn't queued.
admission_cancel() {
  local state
  admission_lock || return 72
  admission_sweep
  state=$(sed -n 's/^state=//p' "$admission_dir/entries/$1.entry" 2> /dev/null)
  if [[ $state == queued || $state == pending ]]; then
    admission_event cancelled "$1" command
    rm -f "$admission_dir/entries/$1.entry"
    admission_unlock
    return 0
  fi
  admission_unlock
  if [[ $state == active ]]; then echo "$1 is admitted; stop its job instead" >&2; else echo "no queued reservation $1" >&2; fi
  return 1
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  set -uo pipefail
  case ${1:-} in
    status) shift; admission_status "$@" ;;
    peek) admission_peek ;;
    held) shift; admission_held "$@" ;;
    table) admission_table_report ;;
    cancel) admission_cancel "${2:?reservation id}" ;;
    gib) admission_gib "${2:?class}" ;;
    class) shift; admission_class "$@" ;;
    reclassify) shift; admission_reclassify "$@" ;;
    sets) shift; admission_sets "$@" ;;
    escalate) admission_escalate "${2:?reservation id}" ;;
    yield) shift; admission_yield "$@" ;;
    intent)
      (( $# >= 5 )) || { echo "usage: admission.sh intent <id> <class> <seconds> <what> [locks...]" >&2; exit 64; }
      shift; admission_intent "$@" ;;
    run)
      (( $# >= 5 )) || { echo "usage: admission.sh run <id> <class> high|normal <command...>" >&2; exit 64; }
      admission_reserve "$2" "$3" "$4" "${*:5}" "${BOUNDED_HELD_LOCKS:-}" || exit
      export BOUNDED_RESERVATION=$2
      shift 4; exec "$@" ;;
    *) sed -n '6,21p' "$0" >&2; exit 64 ;;
  esac
fi
