#!/usr/bin/env bash
# Mutations at the public gate/land boundary must retain originals and refuse FF.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-test-lib.sh"
. "$here/pair-test-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/pair-boundary-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
original_path=$PATH
fixture late-input
mv "$d/scripts/land.sh" "$d/scripts/land-actual.sh"
cat > "$d/scripts/land.sh" <<'STUB'
#!/usr/bin/env bash
bash -c "$LAND_ENTRY_HOOK"
bash "$(dirname "$0")/land-actual.sh" "$@"
STUB
chmod +x "$d/scripts/land.sh"
export LAND_ENTRY_HOOK="git -C '$a' commit --allow-empty -qm concurrent-at-land"
queue
unset LAND_ENTRY_HOOK
[[ $rc != 0 && $(git -C "$MAIN" rev-parse HEAD) == "$base" && $(git -C "$a" rev-parse HEAD) != "$before_a" ]] || { cat "$d/out"; echo 'FAIL input moved after cur-land guard but FF proceeded'; exit 1; }
echo 'ok    final land entry rechecks original input after outer guard without reverting concurrent edit'

for change in integration assembly-tip assembly-dirt report overlap unrelated; do
  fixture "boundary-$change"
  case $change in
    integration) export BOUNDARY_HOOK="git -C '$MAIN' commit --allow-empty -qm concurrent-integration" ;;
    assembly-tip) export BOUNDARY_HOOK='wt=$(find "$EP_ORCH/logs" -type d -name assembly); git -C "$wt" commit --allow-empty -qm concurrent-assembly' ;;
    assembly-dirt) export BOUNDARY_HOOK='wt=$(find "$EP_ORCH/logs" -type d -name assembly); echo changed > "$wt/untracked"' ;;
    report) export BOUNDARY_HOOK="echo changed >> '$d/1-spec.md'" ;;
    overlap) export BOUNDARY_HOOK="echo owner > '$MAIN/a.txt'" ;;
    unrelated) export BOUNDARY_HOOK="echo owner > '$MAIN/unrelated-owner-file'" ;;
  esac
  queue
  unset BOUNDARY_HOOK
  if [[ $change == unrelated ]]; then
    [[ $rc == 0 && $(git -C "$MAIN" rev-parse HEAD) == "$before_b" && $(cat "$MAIN/unrelated-owner-file") == owner ]] || { cat "$d/out"; exit 1; }
  else
    [[ $rc != 0 && $(git -C "$MAIN" rev-parse HEAD) != "$before_b" && $(git -C "$a" rev-parse HEAD) == "$before_a" && $(git -C "$b" rev-parse HEAD) == "$before_b" ]] || { cat "$d/out"; exit 1; }
    [[ $change != overlap || $(cat "$MAIN/a.txt") == owner ]]
  fi
  echo "ok    $change at landing boundary preserves authoritative state and never lands a prefix"
done
