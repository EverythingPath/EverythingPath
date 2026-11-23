#!/usr/bin/env bash
# usage: lanes.test.sh — checks run_lanes (lanes.sh), which runs workflow.test.sh's test files in parallel lanes
# (speed-ci-static-split), on dummy test files.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/lanes.sh"
root=$(mktemp -d "${TMPDIR:?}/lanes-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
fail=0
check() { if eval "$2"; then echo "ok    $1"; else echo "FAIL  $1"; fail=1; fi; }

tests=$root/tests
mkdir "$tests"
# Each dummy records, in one line, its name, when it ran (start and end, in ns) and what it saw, then says hello.
for name in a b c d e; do
  printf '%s\n' '#!/usr/bin/env bash' \
    'start=$(date +%s%N)' \
    'sleep 0.4' \
    "printf '%s %s %s %s %s %s\n' $name \"\$start\" \"\$(date +%s%N)\" \"\$TMPDIR\" \"\$PWD\" \"\$(cat 2>&1 | wc -c)\" >> $root/spans" \
    "echo \"hello from $name\"" > "$tests/$name.test.sh"
done
# p reports whether SIGINT and SIGQUIT reach it: bash starts a background job with both ignored unless reset.
printf '%s\n' 'import signal' 'print("hello from p")' \
  'print("signals", *("ignored" if signal.getsignal(name) == signal.SIG_IGN else "default" for name in (signal.SIGINT, signal.SIGQUIT)))' \
  > "$tests/p.test.py"
printf '%s\n' '#!/usr/bin/env bash' 'echo "f went wrong" >&2' 'exit 3' > "$tests/f.test.sh"

# run <name> <lanes> <file>...: run_lanes from $root, with stdin it must not pass on, into $root/out.
run() {
  local tmp=$root/run-$1 lanes=$2
  shift 2
  mkdir "$tmp"
  echo "some stdin" | (cd "$root" && run_lanes "$lanes" "$tests" "$tmp" "$@" > "$root/out" 2>&1)
}

run passing 2 a.test.sh b.test.sh c.test.sh d.test.sh e.test.sh p.test.py
check 'every file passes: exit 0' "[[ $? == 0 ]]"
for name in a b c d e p; do
  check "$name's output once, under its header" \
    "[[ \$(grep -c 'hello from $name' '$root/out') == 1 && \$(grep -A1 '^== $name.test.' '$root/out' | tail -1) == 'hello from $name' ]]"
done
check 'SIGINT and SIGQUIT reach each file, as in a serial run (tests that stop a child with INT rely on it)' \
  "grep -qx 'signals default default' '$root/out'"
check '.py files run with python3 and .sh files with bash' "grep -q '^== p.test.py: ok' '$root/out' && grep -q '^== a.test.sh: ok' '$root/out'"
check 'the closing line counts them' "[[ \$(tail -1 '$root/out') == 'lanes: 6 test files passed in 2 lanes' ]]"
# At most 2 ran at once, and 2 did: the most spans that overlap any start.
overlap=$(awk '{ s[NR] = $2; e[NR] = $3 } END { m = 0; for (i in s) { n = 0; for (j in s) if (s[j] <= s[i] && s[i] < e[j]) n++; if (n > m) m = n }; print m }' "$root/spans")
check 'at most 2 at once, and 2 at once' "[[ $overlap == 2 ]]"
check "each file has its own TMPDIR under the run's" \
  "[[ \$(awk '{ print \$4 }' '$root/spans' | sort -u | wc -l) == 5 ]] && ! awk '{ print \$4 }' '$root/spans' | grep -qv '^$root/run-passing/.'"
check 'each file runs in the caller directory with no stdin' "! awk '{ print \$5, \$6 }' '$root/spans' | grep -qv '^$root 0\$'"

: > "$root/spans"
run failing 3 f.test.sh a.test.sh b.test.sh
check 'a failed file fails the run: exit 1' "[[ $? == 1 ]]"
check 'the others still run to the end' "[[ \$(wc -l < '$root/spans') == 2 ]] && grep -q 'hello from b' '$root/out'"
check 'the failed file is named with its exit and output' "grep -A1 '^== f.test.sh: FAILED (exit 3' '$root/out' | grep -q 'f went wrong'"
check 'the closing line names the failures' "[[ \$(tail -1 '$root/out') == 'lanes: 1 of 3 test files failed: f.test.sh' ]]"

run refused 0 a.test.sh
check 'a lane count below 1 is refused: exit 64' "[[ $? == 64 ]]"
run unknown 2 a.test.sh other.txt
check 'a file that is not .py or .sh is refused before any runs: exit 64' "[[ $? == 64 ]] && ! grep -q 'hello' '$root/out'"
exit $fail
