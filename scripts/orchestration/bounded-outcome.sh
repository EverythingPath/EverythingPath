# shellcheck shell=bash
# Sourced by await.sh and by the run directory's bounded-receipt.sh (each
# bounded.sh unit's ExecStopPost): the one classifier for how a bounded run
# ended, so a receipt and await.sh's systemd fallback always agree.

# bounded_outcome <result> <code> <status> [hint]: prints "<exit code> <outcome>".
#   result  systemd's SERVICE_RESULT or Result (success, exit-code, signal,
#           oom-kill, ...), or submit-failed when systemd-run never started it
#   code    exited, killed or dumped (EXIT_CODE, or ExecMainCode 1/2/3)
#   status  the exit status, or the signal by name or number
#   hint    what the inner wrapper recorded: lockRefused or killed
# The exit code is 128+signal for a signal and null when unknown. Outcomes, the
# first match: submitFailed, oom, lockRefused, killed (a stop, a signal, a
# timeout; an orderly SIGTERM stop is never ok), ok (exit 0), failed.
bounded_outcome() {
  local result=$1 code=$2 status=$3 hint=${4:-} exit_code=null signal
  if [[ $code == exited && $status =~ ^[0-9]+$ ]]; then
    exit_code=$status
  elif [[ $code == killed || $code == dumped ]] && signal=$(bounded_signal_number "$status"); then
    exit_code=$(( 128 + signal ))
  fi
  local outcome=failed
  if [[ $result == submit-failed ]]; then outcome=submitFailed
  elif [[ $result == oom-kill ]]; then outcome=oom
  elif [[ $hint == lockRefused ]]; then outcome=lockRefused
  elif [[ $hint == killed || $code == killed || $code == dumped ]]; then outcome=killed
  elif [[ $result =~ ^(signal|core-dump|timeout|watchdog)$ ]]; then outcome=killed
  elif [[ $exit_code == 0 ]]; then outcome=ok
  fi
  echo "$exit_code $outcome"
}

# bounded_signal_number <name or number>: TERM, SIGTERM or 15 -> 15.
bounded_signal_number() {
  [[ $1 =~ ^[0-9]+$ ]] && { echo "$1"; return; }
  [[ -n $1 ]] && kill -l "${1#SIG}" 2> /dev/null
}
