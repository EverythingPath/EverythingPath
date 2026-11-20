#!/usr/bin/env bash
# Public pair CLI: published artifact checker and candidate identity before checks.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-test-lib.sh"
. "$here/pair-test-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/pair-artifacts-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
original_path=$PATH
fixture combined-growth
cp "$here/../check-artifacts.mjs" "$MAIN/scripts/check-artifacts.mjs"
cp "$here/../artifact-budgets.json" "$MAIN/scripts/artifact-budgets.json"
node -e 'require("fs").writeFileSync(process.argv[1],Buffer.alloc(1000000,65))' "$MAIN/deleted-baseline.dat"
git -C "$MAIN" add -A; git -C "$MAIN" commit -qm 'fixture artifact policy and deletion baseline'
base=$(git -C "$MAIN" rev-parse HEAD)
old_a=$before_a
git -C "$a" rebase "$base" > /dev/null 2>&1
node - "$a" <<'JS'
const fs=require('fs'),wt=process.argv[2];
for(let i=0;i<7;i++) fs.writeFileSync(`${wt}/a-${i}.dat`,Buffer.alloc(400000,65));
fs.unlinkSync(`${wt}/deleted-baseline.dat`);
JS
git -C "$a" add -A; git -C "$a" commit -q --amend --no-edit
git -C "$b" rebase --onto "$(git -C "$a" rev-parse HEAD)" "$old_a" > /dev/null 2>&1
node - "$b" <<'JS'
const fs=require('fs'),wt=process.argv[2];
for(let i=0;i<7;i++) fs.writeFileSync(`${wt}/b-${i}.dat`,Buffer.alloc(400000,66));
JS
git -C "$b" add -A; git -C "$b" commit -q --amend --no-edit
before_a=$(git -C "$a" rev-parse HEAD); before_b=$(git -C "$b" rev-parse HEAD)
refresh_plan
mv "$d/bin/pnpm" "$d/bin/pnpm-heavy-stub"
cat > "$d/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
if [[ $1 == -s && $2 == check:artifacts ]]; then
  echo "$*" >> "$PNPM_LOG"
  exec node scripts/check-artifacts.mjs --base "$4"
fi
exec "$(dirname "$0")/pnpm-heavy-stub" "$@"
STUB
chmod +x "$d/bin/pnpm"
queue
[[ $rc != 0 && ! -e $EP_ORCH/full-gates && -n $(find "$EP_ORCH/logs" -name gate-started.json) ]] && preserved || { cat "$d/out"; exit 1; }
[[ $(grep -c '^-s check:artifacts --base ' "$PNPM_LOG") == 3 ]]
[[ $(grep '^-s check:artifacts --base ' "$PNPM_LOG" | paste -sd '|') == "-s check:artifacts --base $base|-s check:artifacts --base $before_a|-s check:artifacts --base $base" ]]
artifact_log=$(find "$EP_ORCH/logs" -name '*-artifacts.log')
grep -q 'Unbudgeted positive growth: 5600004 > 5000000 bytes' "$artifact_log" || { cat "$artifact_log"; exit 1; }
[[ -z $(find "$EP_ORCH/logs" -name '*-codegen.log') ]]
echo 'ok    per-item 2.8MB passes cannot replace complete combined 5.6MB guard; deletion does not offset growth; no codegen or landing'

for phase in check:artifacts install test exec; do
  fixture "identity-${phase//:/-}"
  export PNPM_HOOK_ON=$phase PNPM_HOOK='echo changed > changed.txt; git add changed.txt; git commit -q --amend --no-edit'
  queue
  unset PNPM_HOOK_ON PNPM_HOOK
  [[ $rc != 0 && -z $(find "$EP_ORCH/logs" -name assembly.json) && ! -e $EP_ORCH/full-gates ]] && preserved || { cat "$d/out"; echo "FAIL staged identity changed during $phase but acquired completed evidence"; exit 1; }
  echo "ok    staged HEAD movement during $phase refuses before completed assembly, preserving originals"
done
