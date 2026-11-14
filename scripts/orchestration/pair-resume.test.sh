#!/usr/bin/env bash
# Exact retained review resumption and evidence invalidation via the public CLI.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-test-lib.sh"
. "$here/pair-test-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/pair-resume-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
# The env case below sets TZ and then unsets it, so it starts unset (CI's static job sets TZ; gate-ci-workflow).
unset TZ
original_path=$PATH
fixture retained-code
git -C "$b" rebase --onto "$base" "$before_a" > /dev/null 2>&1
refresh_plan
queue
[[ $rc != 0 && ! -e $EP_ORCH/full-gates ]] && preserved
manifest=$(find "$EP_ORCH/logs" -name assembly.json)
renew_plan
cp "$d/plan.json" "$d/accepted-plan.json"
cp "$d/1-spec.md" "$d/accepted-report.md"
for change in env report scope hash snapshot; do
  cp "$d/accepted-plan.json" "$d/plan.json"
  case $change in
    env) export TZ=Pacific/Honolulu ;;
    report) echo altered >> "$d/1-spec.md" ;;
    scope|hash) node --input-type=module - "$d/plan.json" "$change" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const [file,change]=process.argv.slice(2),plan=JSON.parse(readFileSync(file));
if(change==='scope')plan.items[1].review.parent=plan.base;else plan.resume.sha256='0'.repeat(64);
writeFileSync(file,JSON.stringify(plan));
JS
      ;;
    snapshot) echo '# changed snapshot' >> "$(dirname "$(dirname "$manifest")")/pair-stage.sh" ;;
  esac
  installs=$(grep -c '^install --offline' "$PNPM_LOG")
  queue
  [[ $rc != 0 && ! -e $EP_ORCH/full-gates && $(grep -c '^install --offline' "$PNPM_LOG") == "$installs" ]] && preserved || { cat "$d/out"; echo "FAIL retained $change evidence was accepted/rebuilt"; exit 1; }
  case $change in
    env) unset TZ ;;
    report) cp "$d/accepted-report.md" "$d/1-spec.md" ;;
    snapshot) cp "$d/scripts/pair-stage.sh" "$(dirname "$(dirname "$manifest")")/pair-stage.sh" ;;
  esac
  echo "ok    retained $change change refuses before gate without rebuilding or changing originals"
done
cp "$d/accepted-plan.json" "$d/plan.json"
queue
[[ $rc == 0 && $(wc -l < "$EP_ORCH/full-gates") == 1 ]] || { cat "$d/out"; exit 1; }
echo 'ok    exact renewed assembly resumes once after failed binding attempts'

fixture failed-attempt
export VERDICT=NEW
queue
unset VERDICT
[[ $rc != 0 && $(wc -l < "$EP_ORCH/full-gates") == 1 ]] && preserved
manifest=$(find "$EP_ORCH/logs" -name assembly.json)
renew_plan
queue
[[ $rc != 0 && $(wc -l < "$EP_ORCH/full-gates") == 1 ]] && preserved || { cat "$d/out"; exit 1; }
echo 'ok    failed strict pair emits ordered split plan but retained resume cannot rerun a failed gate'

fixture replaced-scratch
git -C "$b" rebase --onto "$base" "$before_a" > /dev/null 2>&1
refresh_plan
queue
manifest=$(find "$EP_ORCH/logs" -name assembly.json)
renew_plan
wt=$(dirname "$manifest")/assembly
branch=$(git -C "$wt" branch --show-current); tip=$(git -C "$wt" rev-parse HEAD)
git -C "$MAIN" worktree remove "$wt"
git clone -q --shared "$MAIN" "$wt"
git -C "$wt" checkout -qb "$branch" "$tip"
queue
[[ $rc != 0 && ! -e $EP_ORCH/full-gates ]] && preserved || { cat "$d/out"; echo 'FAIL replacement clone was accepted as queue-owned assembly'; exit 1; }
echo 'ok    retained assembly cannot be replaced by an unregistered checkout with matching branch/commit/tree'
