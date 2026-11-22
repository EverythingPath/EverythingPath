#!/usr/bin/env bash
# Shared CLI normalization/core ownership; policies stay with single/pair callers.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-test-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/queue-target-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
prep_fixture "$root" > /dev/null 2>&1
feature=feature/pf1-character-builder
cur=$root/ep-cur-901
check() {
  local token=$1 expected_kind=$2 expected_number=$3 expected_branch=$4 expected_wt=$5
  bash "$here/queue-target.sh" "$token" "$feature" > "$root/target"
  mapfile -d '' -t fields < "$root/target"
  [[ ${#fields[@]} == 7 && ${fields[0]} == "$expected_kind" && ${fields[1]} == "$expected_number" && ${fields[2]} == "$expected_branch" && ${fields[3]} == "$expected_wt" ]]
  echo "ok    shared target $token"
}
check 901 cur 901 cur/901 "$cur"
check cur/901 cur 901 cur/901 "$cur"
check "cur/901:$cur" cur 901 cur/901 "$cur"
# Literal shell metacharacters and spaces stay data through NUL output.
app="$root/app path;literal"
git -C "$MAIN" worktree add -qb t3/app "$app"
check "cur/901@t3/app:$app" cur 901 t3/app "$app"
check "t3/app:$app" impl '' t3/app "$app"
git -C "$MAIN" worktree add -qb impl/902 "$root/ep-impl-902"
check impl/902 impl '' impl/902 "$root/ep-impl-902"
check "impl/902:$root/ep-impl-902" impl '' impl/902 "$root/ep-impl-902"
git -C "$MAIN" worktree add -q --detach "$root/detached"
git init -qb t3/foreign "$root/foreign"
mkdir "$app/subdirectory"
for token in "cur/901@t3/app" "cur/901@:bad" "t3/app:$MAIN" "t3/app:$root/foreign" "t3/app:$root/detached" "wrong:$app" "t3/app:$app/subdirectory" 'bad..branch:nope'; do
  if bash "$here/queue-target.sh" "$token" "$feature" > "$root/target" 2> "$root/error"; then echo "FAIL invalid target accepted: $token"; exit 1; fi
  [[ ! -s $root/target ]]
  echo "ok    shared target rejects $token"
done
