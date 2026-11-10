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
# (a capped.sh command's what is "<dir>: <command>", or "<dir>:
# CAPPED_KIND=<kind> <command>" when its kind was declared; cut to 100
# characters).
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
# entry. A bounded job registers its intent before it waits for its locks
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
# write), seq and the mutex. Entries are pending (a gate's or prep's intent
# while it waits for its locks: no memory, but ahead of every new capped.sh
# command), queued or active.
# Tests only: ADMISSION_PROC_LOCKS (another /proc/locks, for peek and held),
# ADMISSION_TABLE (another table), ADMISSION_INTERVAL (the queue
# poll, default 1 s), ADMISSION_SAMPLE_INTERVAL (the sampler's, default 5 s).

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
# killed runs can only raise a reservation, never lower it.
admission_reservation() {
  local ledger=$admission_dir/peaks.log out
  [[ -r $admission_table ]] || { echo "no memory table at $admission_table" >&2; return 64; }
  [[ -r $ledger ]] || ledger=/dev/null
  out=$(awk -v c="$1" -v min="${ADMISSION_MIN_SECONDS:-60}" '
    function up(bytes,  h, r) { h = bytes * (1 + margin / 100) / 2^29; r = int(h); if (r < h) r++; return r * 512 }
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
      if (all / 2^20 > mib) { mib = up(all); basis = sprintf("raised: a recorded real peak %.2f GiB + %s%%", all / 2^30, margin) }
      printf "%d %s\n", mib, basis
    }' "$admission_table" "$ledger") || { echo "unknown memory class: $1 (see $admission_table)" >&2; return 64; }
  echo "$out"
}
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
# corpus, test or light; anything else is refused with 64).
admission_class() {
  local kind=$1 workers=$2 arg k
  shift 2
  [[ $kind == role ]] && { echo role; return; }
  if [[ $kind == capped ]]; then
    k=${CAPPED_KIND:-$(admission_command_kind "$@")}
    case $k in
      lint|corpus|test|light) echo "curator-$k" ;;
      '') echo curator ;;
      *) echo "CAPPED_KIND must be lint, corpus, test or light, not $k" >&2; return 64 ;;
    esac
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

# admission_command_kind <command...>: what a capped.sh command runs, from its
# words: lint (lint, typecheck, eslint, tsc, knip), corpus (the whole catalog:
# catalog:preview, catalog:curate, catalog:release, catalog:conditions,
# catalog:notice-deps (5.26 GiB real in 9 s, 2026-10-20), or a test run of the
# whole suite or of a directory or filter), test (a test run of named test
# files only) or light (the small package scripts: catalog:pin,
# catalog:format, catalog:merge, the check:, format: and rules: scripts,
# acceptance:check, prettier). Nothing for anything else: a
# shell (bash -c, sh -c), a script, node or tsx on a file, a package script
# it doesn't know.
admission_command_kind() {
  local script
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

# admission_sample <file>: samples this process's cgroup every
# ADMISSION_SAMPLE_INTERVAL (5) s until the shell that started it exits (run
# it in the background; kill it to stop it sooner), and keeps <file> at
# real_peak=<bytes>, peak=<memory.peak bytes>, samples=<n> (atomic rewrites).
admission_sample() {
  local out=$1 owner=$$ cg cur file shmem real rpeak=0 peak=0 n=0
  cg=/sys/fs/cgroup$(sed -n 's/^0:://p' /proc/self/cgroup)
  [[ -r $cg/memory.stat ]] || return 0
  while kill -0 "$owner" 2> /dev/null; do
    read -r cur < "$cg/memory.current" || break
    read -r file shmem < <(awk '$1 == "file" { f = $2 } $1 == "shmem" { s = $2 } END { print f + 0, s + 0 }' "$cg/memory.stat")
    real=$(( cur - file + shmem )); (( real > rpeak )) && rpeak=$real
    [[ -r $cg/memory.peak ]] && read -r peak < "$cg/memory.peak"
    n=$(( n + 1 ))
    printf 'real_peak=%s\npeak=%s\nsamples=%s\n' "$rpeak" "$peak" "$n" > "$out.tmp" && mv -f "$out.tmp" "$out"
    sleep "${ADMISSION_SAMPLE_INTERVAL:-5}" & wait $!
  done
}

# admission_record <class> <sample file> <result> <seconds> <id> [what]:
# appends the job's line to peaks.log: <time> <class> <real peak>
# <memory.peak> <result> <seconds> <id> <what>, result ok, failed, oom or
# killed (admission_reservation says which count). A role isn't recorded. A
# job whose class changed while it ran (admission_escalate) is recorded under
# the new one.
admission_record() {
  local real peak class=
  [[ $1 == role ]] && return 0
  real=$(sed -n 's/^real_peak=//p' "$2" 2> /dev/null); peak=$(sed -n 's/^peak=//p' "$2" 2> /dev/null)
  [[ $real =~ ^[0-9]+$ && $real -gt 0 ]] || return 0
  mkdir -p "$admission_dir" || return 0
  [[ $4 =~ ^[0-9]+$ ]] || return 0
  [[ -f $admission_dir/classes/$5 ]] && class=$(cat "$admission_dir/classes/$5")
  admission_lock || return 0
  printf '%s %s %s %s %s %s %s %s\n' "$(date -u +%FT%TZ)" "${class:-$1}" "$real" "${peak:-0}" "$3" "$4" "$5" \
    "$(printf '%s' "${6:-}" | tr '\n\t' '  ' | cut -c1-100)" >> "$admission_dir/peaks.log"
  admission_unlock
  rm -f "$admission_dir/classes/$5"
}

# admission_run_sampled <class> <id> <command...>: runs the command (in a
# capped.sh scope) under a sampler, forwarding TERM, INT and HUP to it, then
# records its line and exits with its status. A command whose kind was
# declared is recorded as "<dir>: CAPPED_KIND=<kind> <command>", so its line
# says so (reclassify --declared); classifying by its words skips that word.
# The command runs as a job of its own (set -m, as run-bounded-command.sh
# does), so it doesn't inherit an ignored SIGINT and a forwarded INT stops it.
admission_run_sampled() {
  local class=$1 id=$2 sample sampler child status result oom0 oom1 cg start=$SECONDS
  shift 2
  mkdir -p "$admission_dir/samples"
  sample=$admission_dir/samples/$id
  cg=/sys/fs/cgroup$(sed -n 's/^0:://p' /proc/self/cgroup)
  oom0=$(sed -n 's/^oom_kill //p' "$cg/memory.events" 2> /dev/null)
  admission_sample "$sample" & sampler=$!
  set -m; "$@" <&0 & child=$!; set +m
  trap 'kill -TERM "$child" 2> /dev/null' TERM
  trap 'kill -INT "$child" 2> /dev/null' INT
  trap 'kill -HUP "$child" 2> /dev/null' HUP
  while :; do
    wait "$child"; status=$?
    kill -0 "$child" 2> /dev/null || break
  done
  trap - TERM INT HUP
  kill "$sampler" 2> /dev/null; wait "$sampler" 2> /dev/null
  oom1=$(sed -n 's/^oom_kill //p' "$cg/memory.events" 2> /dev/null)
  result=failed
  if (( status == 0 )); then result=ok
  elif [[ -n $oom1 && ${oom1:-0} != "${oom0:-0}" ]]; then result=oom
  elif (( status > 128 )); then result=killed
  fi
  admission_record "$class" "$sample" "$result" "$(( SECONDS - start ))" "$id" "$(basename "$PWD"): ${CAPPED_KIND:+CAPPED_KIND=$CAPPED_KIND }$*"
  rm -f "$sample" "$sample.tmp"
  return "$status"
}

# admission_reclassify [--write] [--declared <kind>] [<id>...]: relabels
# peaks.log lines recorded before their class was known: a curator line by its
# command (admission_class capped; a line cut at 100 characters loses its
# last, partial, word first), and a prep-light-<n> line whose unit log
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
# admission_relabel <logs dir> <declared kind, or ''> [<id>...]:
# admission_reclassify's choice of changes, from peaks.log lines on stdin (a
# last line with no newline too): one "<line number> <old> <new> <id>" line on
# stdout for each line to relabel. A line that isn't a record (no id, no
# numeric peak) is never changed. Returns 1 when a line it would change can't be classified, or
# isn't "<time> <class> " followed by the rest (a tab, a leading or a doubled
# space), so a rewrite of its class word can't be exact; that line is reported
# on stderr and left out.
admission_relabel() {
  local logs=$1 declared=$2 line t class real peak result secs id what cmd new words n=0 bad=0 named=' '
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
      (( ${#what} >= 100 )) && cmd=${cmd% *}
      read -ra words <<< "$cmd"
      if ! new=$(CAPPED_KIND='' admission_class capped 0 "${words[@]}") || [[ ! $new =~ ^curator(-[a-z]+)?$ ]]; then
        echo "can't classify $id: $what; it keeps $class" >&2
        bad=1; continue
      fi
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
# <id> <state> <priority 0|1> <seq> <MiB> <class> <since> <locks> <grow> <claimed> <what...>
# (locks: a pending intent's awaited locks, or the locks a command's owning
# job holds, comma-separated; grow: <class>:<MiB> an active job waits to grow
# to (admission_escalate); claimed: 1 for an intent whose gate takes its locks
# now (admission_intent); - for none)
admission_entries() {
  local files=("$admission_dir"/entries/*.entry)
  [[ -f ${files[0]} ]] || return 0
  awk -F= -v skip=" $* " '
    function emit() { if (index(skip, " " e["id"] " ") == 0) print e["id"], e["state"], e["prio"], e["seq"], e["mib"], e["class"], e["since"], (e["locks"] == "" ? "-" : e["locks"]), (e["grow"] == "" ? "-" : e["grow"]), (e["claimed"] == "" ? "-" : e["claimed"]), e["what"]; delete e }
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

# admission_sweep: removes the entries of jobs that are gone (locked).
admission_sweep() {
  local f id
  for f in "$admission_dir"/entries/*.entry; do
    [[ -f $f ]] || continue
    id=${f##*/}; id=${id%.entry}
    admission_live "$id" && continue
    admission_event ended "$id" "no process holds it"
    rm -f "$f" "${f%.entry}.held"
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
admission_format() {
  local budget=$1 for=${2:-} reserved=0 id state prio seq mib class since locks grow claimed what active=() queued=() behind=()
  local size age total cap kind item rows=() row after=
  mapfile -t rows
  if [[ -n $for ]]; then
    for row in "${rows[@]}"; do
      read -r id state prio seq _ <<< "$row"
      [[ $id == "$for" && $state != active && $prio == 0 ]] && after=$seq
    done
  fi
  for row in "${rows[@]}"; do
    read -r id state prio seq mib class since locks grow claimed what <<< "$row"
    age=$(admission_age "$since") || return 3
    if [[ $state == pending ]]; then size='waiting for its locks'; else size=$(admission_show_checked "$mib") || return 3; size+=G; fi
    if [[ $state == active ]]; then
      if [[ $grow != - ]]; then
        total=$(admission_show_checked "${grow#*:}") || return 3
        grow="growing to ${grow%:*} ${total}G, "
      else
        grow=
      fi
      reserved=$(( reserved + mib )); active+=("$id ($class $size, $age, $grow$what)")
    else
      kind=; [[ $prio == 0 ]] && kind='gate/prep, '
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

# admission_status [--for <intent id>]: the status line, after a sweep; with --for, as that intent sees it.
admission_status() {
  local code for=
  if [[ ${1:-} == --for ]]; then
    [[ -n ${2:-} ]] || { echo "usage: admission.sh status [--for <intent id>]" >&2; return 64; }
    for=$2
  fi
  admission_lock || return 72
  admission_sweep
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
# it reads the ledger and /proc/locks and writes nothing, so an observation never changes the ledger.
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
# hold the lock). A command whose job holds locks also passes earlier entries
# of its own priority: they may be waiting on an intent that waits on its job.
# An active job waiting to grow (admission_escalate) is ahead of every entry.
# What holds the entry back, an entry's id or "memory", is left in
# admission_blocker for admission_wait's report.
admission_fits() {
  local id state prio seq mib class since locks grow claimed what sum=0 count=0
  admission_blocker=
  while read -r id state prio seq mib class since locks grow claimed what; do
    [[ $id == "$1" ]] && continue
    case $state in
      active) sum=$(( sum + mib )); count=$(( count + 1 )); [[ $grow == - ]] || { admission_blocker=$id; return 1; } ;;
      pending) (( prio < $3 )) && admission_intent_blocks "$locks" "$6" "$claimed" && { admission_blocker=$id; return 1; } ;;
      *) (( prio < $3 || (prio == $3 && seq < $4 && ${#6} == 0) )) && { admission_blocker=$id; return 1; } ;;
    esac
  done < <(admission_entries)
  (( count == 0 || sum + $2 <= $5 )) || { admission_blocker=memory; return 1; }
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
  local id state prio seq mib class since locks grow claimed what sum=0 count=0
  admission_sweep
  [[ -f $admission_dir/entries/$1.entry ]] || return 143
  if (( admission_cancelled )); then admission_set "$1" grow - ; admission_event cancelled "$1" "growing, signal"; return 143; fi
  while read -r id state prio seq mib class since locks grow claimed what; do
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
  if admission_gate_holds "$id"; then
    admission_transition "$id" active 0 || { admission_event failed "$id" "state write"; rm -f "$entry"; return 72; }
    admission_event admitted "$id" "$( (( $2 )) && echo "after $2 s ")inside gate unit $(admission_field "$id" gate)'s reservation"
    return 0
  fi
  if admission_fits "$id" "$(admission_field "$id" mib)" "$(admission_field "$id" prio)" "$(admission_field "$id" seq)" "$(admission_mib budget)" "$(admission_field "$id" locks)"; then
    admission_transition "$id" active || { admission_event failed "$id" "state write"; rm -f "$entry"; return 72; }
    admission_event admitted "$id" "$( (( $2 )) && echo "after $2 s")"
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
    *) sed -n '6,20p' "$0" >&2; exit 64 ;;
  esac
fi
