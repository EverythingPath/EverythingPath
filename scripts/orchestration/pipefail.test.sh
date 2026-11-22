#!/usr/bin/env bash
# Under pipefail, a check whose producer writes more than one chunk must read
# its whole stream: an early-exit consumer (grep -q) closes the pipe on the
# first match, the producer's next write dies of SIGPIPE (141) and pipefail
# turns a match into a refusal. Each producer here writes far more than a pipe
# buffer, with the match near the start.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(mktemp -d "${TMPDIR:?}/pipefail-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
real_git=$(command -v git)
export GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.test GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.test
. "$here/prep-lib.sh"
. "$here/worktree-lib.sh"
fail=0

main=$root/main
git init -q -b integration "$main"
mkdir -p "$main/tests/catalog"
{ echo 'export const helper = 1;'; for ((i = 0; i < 40000; i++)); do echo "// padding line $i"; done; } > "$main/tests/catalog/big-helper.test.ts"
{ for ((i = 0; i < 40000; i++)); do echo "// padding line $i"; done; } > "$main/tests/catalog/big-plain.test.ts"
git -C "$main" add -A
git -C "$main" -c commit.gpgsign=false commit -qm base
git -C "$main" worktree add -q -b work "$root/wt"

# A git that pads `worktree list --porcelain` after the real list with 1.7 MB
# of other worktrees, so the target sits in the first chunk. Each padding line
# is its own write; a failed write exits 141 even where SIGPIPE is ignored.
mkdir "$root/bin"
cat > "$root/bin/git" << STUB
#!/usr/bin/env bash
if [[ " \$* " == *" worktree list --porcelain "* ]]; then
  "$real_git" "\$@" || exit
  for ((i = 0; i < 20000; i++)); do
    printf 'worktree /nonexistent/padding-%05d\nHEAD 0000000000000000000000000000000000000000\ndetached\n\n' "\$i" 2> /dev/null || exit 141
  done
  exit 0
fi
exec "$real_git" "\$@"
STUB
chmod +x "$root/bin/git"

check() {
  if "${@:2}"; then echo "ok    $1"; else echo "FAIL  $1"; fail=1; fi
}
refuses() { ! "$@"; }

(( $(PATH=$root/bin:$PATH git -C "$main" worktree list --porcelain | wc -c) > 65536 ))
PATH=$root/bin:$PATH check "worktree_target accepts a registered worktree early in a list over 64 KiB" \
  worktree_target work "$root/wt" integration
PATH=$root/bin:$PATH check "worktree_target still refuses an unregistered directory of the repository" \
  refuses worktree_target work "$main/tests" integration

cd "$main"
check "prep_shared_test finds an export at the start of a test over 64 KiB" \
  prep_shared_test tests/catalog/big-helper.test.ts
check "prep_shared_test still rejects a test over 64 KiB with no export" \
  refuses prep_shared_test tests/catalog/big-plain.test.ts
check "prep_shared_test still rejects a path missing at HEAD" \
  refuses prep_shared_test tests/catalog/missing.test.ts

# The one-field readers: a key repeated past one pipe buffer (a malformed
# receipt) still reads its first value, with status 0. await.sh runs at the
# top level, so its two readers are taken from it by name.
eval "$(grep -E '^(meta|receipt_field)\(\) ' "$here/await.sh")"
first_value() { local v; v=$("${@:2}") && [[ $v == "$1" ]]; }
{ echo result=ok; for ((i = 0; i < 100000; i++)); do echo "commit=abc$i"; done; } > "$root/dup.receipt"
{ echo '{'; for ((i = 0; i < 100000; i++)); do echo "  \"exitCode\": $i,"; done; echo '}'; } > "$root/dup.json"
printf '{\n  "exitCode": 3,\n  "outcome": "failed"\n}\n' > "$root/one.json"
check "prep_field reads the first of a key repeated past 64 KiB" first_value abc0 prep_field "$root/dup.receipt" commit
check "await.sh meta reads the first of a key repeated past 64 KiB" first_value abc0 meta "$root/dup.receipt" commit
check "await.sh receipt_field reads the first of a key repeated past 64 KiB" first_value 0 receipt_field "$root/dup.json" exitCode
check "receipt_field still reads a quoted and an unquoted value" first_value "3 failed" \
  eval 'echo "$(receipt_field "$root/one.json" exitCode) $(receipt_field "$root/one.json" outcome)"'
check "prep_field still reads nothing for a missing key" first_value "" prep_field "$root/dup.receipt" mode
exit "$fail"
