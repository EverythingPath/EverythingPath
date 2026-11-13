# shellcheck shell=bash
# Sourced by workflow.test.sh (speed-ci-static-split). lanes.test.sh checks it.
#
# run_lanes <lanes> <dir> <tmp> <file>...: runs each test file in <dir> (python3 -B for .py, bash for .sh), at most
# <lanes> at a time, starting them in the order given (list the longest first). Each runs in the caller's directory
# with stdin from /dev/null, SIGINT and SIGQUIT at their defaults and its own TMPDIR, <tmp>/<n>, its output captured; as each ends, its header
# (== <file>: ok (<s> s), or FAILED (exit <code>, <s> s)) and output are printed. Every file runs to the end; the
# closing line counts them or names the failures. Returns 0 when all passed, 1 when any failed, 64 for bad arguments.
run_lanes() {
  local lanes=$1 dir=$2 tmp=$3 file
  shift 3
  [[ $lanes =~ ^[1-9][0-9]*$ ]] || { echo "run_lanes: lanes must be a positive integer, not '$lanes'" >&2; return 64; }
  for file; do
    [[ $file == *.py || $file == *.sh ]] || { echo "run_lanes: not a .py or .sh test file: $file" >&2; return 64; }
  done
  local -A names=() starts=()
  local -a failed=()
  local index=0 running=0 pid code
  _lanes_report() {
    local name=${names[$pid]} seconds=$(( SECONDS - starts[$pid] ))
    if (( code == 0 )); then
      echo "== $name: ok (${seconds} s)"
    else
      echo "== $name: FAILED (exit $code, ${seconds} s)"
      failed+=("$name")
    fi
    cat "$tmp/$name.log"
    unset "names[$pid]"
    running=$(( running - 1 ))
  }
  for file; do
    if (( running >= lanes )); then
      code=0; wait -n -p pid "${!names[@]}" || code=$?
      _lanes_report
    fi
    index=$(( index + 1 ))
    mkdir -p "$tmp/$index"
    # Without job control bash starts a background job with SIGINT and SIGQUIT ignored, which its children inherit; the
    # subshell resets both before exec, so the tests that stop a child with INT see what a serial run gives them.
    if [[ $file == *.py ]]; then
      (trap - INT QUIT; TMPDIR=$tmp/$index exec python3 -B "$dir/$file") < /dev/null > "$tmp/$file.log" 2>&1 &
    else
      (trap - INT QUIT; TMPDIR=$tmp/$index exec bash "$dir/$file") < /dev/null > "$tmp/$file.log" 2>&1 &
    fi
    names[$!]=$file
    starts[$!]=$SECONDS
    running=$(( running + 1 ))
  done
  while (( running > 0 )); do
    code=0; wait -n -p pid "${!names[@]}" || code=$?
    _lanes_report
  done
  unset -f _lanes_report
  if (( ${#failed[@]} )); then
    echo "lanes: ${#failed[@]} of $# test files failed: ${failed[*]}"
    return 1
  fi
  echo "lanes: $# test files passed in $lanes lanes"
}
