#!/usr/bin/env bash
# Public queue boundary in real throwaway Git worktrees, with heavy commands stubbed.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-test-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/pair-queue-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
# An explicitly empty TZ follows the existing prep environment defaults.
export TZ=
original_path=$PATH
. "$here/pair-test-lib.sh"
fixture stacked
bash "$d/scripts/land-queue.sh" --dry-run --pair "$d/plan.json" > "$d/out" 2>&1 || { cat "$d/out"; exit 1; }
[[ ! -e $EP_ORCH/full-gates && ! -e $PNPM_LOG && $(git -C "$MAIN" rev-parse HEAD) == "$base" ]]
echo 'ok    pair dry-run validates all snapshot helpers/bindings and runs no prep or gate'
bash "$d/scripts/land-queue.sh" --pair "$d/plan.json" > "$d/out" 2>&1 || { cat "$d/out"; exit 1; }
[[ $(wc -l < "$EP_ORCH/full-gates") == 1 && $(git -C "$MAIN" rev-parse HEAD) == "$before_b" ]]
[[ $(git -C "$MAIN" rev-list --count "$base..HEAD") == 2 ]]
[[ $(git -C "$a" rev-parse HEAD) == "$before_a" && $(git -C "$b" rev-parse HEAD) == "$before_b" ]]
[[ -z $(git -C "$a" status --porcelain) && -z $(git -C "$b" status --porcelain) ]]
echo 'ok    stacked reviewed code pair has one combined full gate and two commits; originals preserved'
landed=$(find "$EP_ORCH/logs" -name landed.json)
for issue in 902 903; do
  [[ -s $(dirname "$landed")/comment-$issue.md ]] || { echo "FAIL missing per-issue shared gate draft"; exit 1; }
done

# Independent B changes its commit/parent on assembly, requiring ordinary review.
git -C "$MAIN" reset --hard -q "$base" # fixture integration only
git -C "$b" rebase --onto "$base" "$before_a" > /dev/null 2>&1
create_plan "$a" "$b"
rm "$EP_ORCH/full-gates"
rc=0
bash "$d/scripts/land-queue.sh" --pair "$d/plan.json" > "$d/out" 2>&1 || rc=$?
[[ $rc != 0 && ! -e $EP_ORCH/full-gates && $(git -C "$MAIN" rev-parse HEAD) == "$base" ]]
manifest=$(find "$EP_ORCH/logs" -name assembly.json | sort | tail -1)
[[ -n $manifest ]] || { cat "$d/out"; echo 'FAIL missing exact retained assembly'; exit 1; }
renew_plan
bash "$d/scripts/land-queue.sh" --pair "$d/plan.json" > "$d/out" 2>&1 || { cat "$d/out"; exit 1; }
[[ $(wc -l < "$EP_ORCH/full-gates") == 1 && $(git -C "$MAIN" rev-parse HEAD) == $(tail -1 "$EP_ORCH/full-gates") ]]
echo 'ok    independent pair stops before gate, then resumes only retained assembly with renewed exact reviews'

# A reviewed curation uses its own parent for prep/count and never overwrites its receipt.
git -C "$MAIN" reset --hard -q "$base"
cur=$d/ep-cur-901
bash "$d/scripts/cur-prep.sh" 901 "$EP_ORCH/briefs/cur-901-msg.txt" > "$d/prep.out" 2>&1
receipt_before=$(sha256sum "$EP_ORCH/logs/cur-901-prep.receipt")
cur_before=$(git -C "$cur" rev-parse HEAD)
create_plan "$a" "$cur"
node --input-type=module - "$d/plan.json" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const file=process.argv[2], plan=JSON.parse(readFileSync(file));
plan.items[1].issue=901;
plan.items[1].review.reports=plan.items[1].review.reports.slice(0,1).map(report=>({...report,axis:'curation'}));
writeFileSync(file,JSON.stringify(plan));
JS
rm "$EP_ORCH/full-gates"
rc=0
bash "$d/scripts/land-queue.sh" --pair "$d/plan.json" > "$d/out" 2>&1 || rc=$?
[[ $rc != 0 && ! -e $EP_ORCH/full-gates ]]
manifest=$(find "$EP_ORCH/logs" -name assembly.json | sort | tail -1)
assembly=$(dirname "$manifest")/assembly
[[ -n $(find "$(dirname "$manifest")" -name '*prep.receipt') ]] || { cat "$d/out"; echo 'FAIL missing isolated staged curation receipt'; exit 1; }
[[ $(sha256sum "$EP_ORCH/logs/cur-901-prep.receipt") == "$receipt_before" && $(git -C "$cur" rev-parse HEAD) == "$cur_before" ]]
parent=$(git -C "$assembly" rev-parse HEAD^)
grep -q "${parent:0:8}" "$assembly/docs/catalog-import/traits-901.md"
receipt=$(dirname "$manifest")/prep-901/cur-901-prep.receipt
cp "$receipt" "$d/staged-receipt.saved"
echo altered >> "$receipt"
renew_plan
rc=0
bash "$d/scripts/land-queue.sh" --pair "$d/plan.json" > "$d/out" 2>&1 || rc=$?
[[ $rc != 0 && ! -e $EP_ORCH/full-gates ]] || { cat "$d/out"; echo 'FAIL changed staged prep receipt resumed'; exit 1; }
cp "$d/staged-receipt.saved" "$receipt"
echo 'ok    changed staged curation receipt cannot certify retained assembly'
renew_plan
bash "$d/scripts/land-queue.sh" --pair "$d/plan.json" > "$d/out" 2>&1 || { cat "$d/out"; exit 1; }
[[ $(wc -l < "$EP_ORCH/full-gates") == 1 ]]
grep -q -- '--verify --root .*assembly --runs .*/orch/runs' "$PNPM_LOG"
echo 'ok    mixed app code/curation gets item-parent prep/count, real-root receipt command and isolated receipts'

git -C "$MAIN" reset --hard -q "$base"
create_plan "$cur" "$a"
node --input-type=module - "$d/plan.json" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const file=process.argv[2],plan=JSON.parse(readFileSync(file));
plan.items[0].issue=901;plan.items[0].item=`cur/901@${plan.items[0].item}`;
plan.items[0].review.reports=plan.items[0].review.reports.slice(0,1).map(report=>({...report,axis:'curation'}));
plan.items[1].issue=902;writeFileSync(file,JSON.stringify(plan));
JS
rm "$EP_ORCH/full-gates"
rc=0
bash "$d/scripts/land-queue.sh" --pair "$d/plan.json" > "$d/out" 2>&1 || rc=$?
[[ $rc != 0 && ! -e $EP_ORCH/full-gates ]]
manifest=$(find "$EP_ORCH/logs" -name assembly.json | sort | tail -1)
renew_plan
bash "$d/scripts/land-queue.sh" --pair "$d/plan.json" > "$d/out" 2>&1 || { cat "$d/out"; exit 1; }
[[ $(wc -l < "$EP_ORCH/full-gates") == 1 ]]
echo 'ok    mixed curation/code order retains explicit kind and performs one combined gate'

git -C "$MAIN" reset --hard -q "$base"
curb=$d/arbitrary-curation-b
git -C "$MAIN" worktree add -qb t3/curation-b "$curb" "$base"
mkdir -p "$curb/tests/fixtures/pinned/pf1-content/src/pf-traits"
printf '# Traits #904\n<!-- prep:shared-store-count -->\nold count\n<!-- /prep:shared-store-count -->\n' > "$curb/docs/catalog-import/traits-904.md"
echo inventory > "$curb/scripts/catalog/legal/traits-904.json"
echo tests > "$curb/tests/catalog/traits-904.test.ts"
echo a > "$curb/tests/fixtures/pinned/pf1-content/src/pf-traits/a.yaml"
echo c > "$curb/tests/fixtures/pinned/pf1-content/src/pf-traits/c.yaml"
git -C "$curb" add -A; git -C "$curb" commit -qm 'B (#904)'
bash "$d/scripts/cur-prep.sh" --branch t3/curation-b --worktree "$curb" 904 "$EP_ORCH/briefs/cur-904-msg.txt" > "$d/prep-b.out" 2>&1
create_plan "$cur" "$curb"
node --input-type=module - "$d/plan.json" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const file=process.argv[2],plan=JSON.parse(readFileSync(file));
plan.items.forEach((item,i)=>{item.issue=[901,904][i];item.item=`cur/${item.issue}@${item.item}`;
item.review.reports=item.review.reports.slice(0,1).map(report=>({...report,axis:'curation'}));});
writeFileSync(file,JSON.stringify(plan));
JS
rm "$EP_ORCH/full-gates"
rc=0
: > "$PNPM_LOG"
bash "$d/scripts/land-queue.sh" --pair "$d/plan.json" > "$d/out" 2>&1 || rc=$?
[[ $rc != 0 && ! -e $EP_ORCH/full-gates ]]
manifest=$(find "$EP_ORCH/logs" -name assembly.json | sort | tail -1)
prep_b=$(dirname "$manifest")/prep-904/cur-904-prep.receipt
[[ $(grep -c '^install --offline$' "$PNPM_LOG") == 2 ]] || { echo 'FAIL expected one offline reinstall per staged curation'; exit 1; }
grep -q '^sharedStoreCount=1 (pf1-content 1)$' "$prep_b" || { cat "$d/out"; cat "$prep_b"; exit 1; }
renew_plan
bash "$d/scripts/land-queue.sh" --pair "$d/plan.json" > "$d/out" 2>&1 || { cat "$d/out"; exit 1; }
[[ $(wc -l < "$EP_ORCH/full-gates") == 1 && $(git -C "$MAIN" rev-list --count "$base..HEAD") == 2 ]]
echo 'ok    two curations count B additions against staged A, amend inside B and share one full gate'
rm "$EP_ORCH/full-gates"
bash "$d/scripts/land-queue.sh" "t3/code-a:$a" "t3/code-b:$b" > "$d/out" 2>&1 || { cat "$d/out"; exit 1; }
[[ $(wc -l < "$EP_ORCH/full-gates") == 2 && $(git -C "$MAIN" rev-parse HEAD) == $(git -C "$b" rev-parse HEAD) ]]
echo 'ok    unflagged implementation list retains legacy serial two-gate behavior'
