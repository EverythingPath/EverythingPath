#!/usr/bin/env bash
# Failure and final landing boundaries, using real Git and dummy heavy commands.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-test-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/pair-failures-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
original_path=$PATH
. "$here/pair-test-lib.sh"
fixture moving-input
export BOUNDARY_HOOK="git -C '$a' commit --allow-empty -qm concurrent-input"
queue
unset BOUNDARY_HOOK
[[ $rc != 0 && $(git -C "$MAIN" rev-parse HEAD) == "$base" && $(git -C "$a" rev-parse HEAD) != "$before_a" ]] || { cat "$d/out"; echo 'FAIL moved input landed'; exit 1; }
[[ -n $(find "$EP_ORCH/logs" -name split-plan.json) ]] || { cat "$d/out"; echo 'FAIL split plan missing'; exit 1; }
echo 'ok    changed input at final boundary refuses combined FF and preserves concurrent edit and split plan'

for stage in codegen pin typecheck lint suite preflight; do
  fixture "fail-$stage"
  export FAIL_STAGE=$stage
  if [[ $stage == pin || $stage == typecheck || $stage == lint ]]; then
    export PNPM_HOOK_ON=$stage PNPM_HOOK='exit 1'
    [[ $stage != pin ]] || export PNPM_HOOK_ON=catalog:pin
  fi
  queue
  unset FAIL_STAGE PNPM_HOOK_ON PNPM_HOOK
  [[ $rc != 0 ]] && preserved || { cat "$d/out"; exit 1; }
  [[ -n $(find "$EP_ORCH/logs" -name gate-started.json) && -n $(find "$EP_ORCH/logs" -name split-plan.json) ]]
  if [[ $stage == preflight ]]; then [[ $(wc -l < "$EP_ORCH/preflights") == 2 ]]; fi
  echo "ok    $stage failure preserves originals and lands no prefix"
done

fixture stage-artifact-first
export PNPM_FAIL_ARTIFACT=1
queue
unset PNPM_FAIL_ARTIFACT
[[ $rc != 0 && ! -e $EP_ORCH/full-gates && -z $(find "$EP_ORCH/logs" -name assembly.json) ]] && preserved || { cat "$d/out"; echo 'FAIL item artifact rejection reached completed assembly'; exit 1; }
# The plan's read-only test:affected may come first (the prep key); no install may.
[[ $(grep -v '^-s test:affected ' "$PNPM_LOG" | head -1) == "-s check:artifacts --base $base" ]] || { cat "$PNPM_LOG"; echo 'FAIL item artifact guard did not precede install'; exit 1; }
echo 'ok    item artifact guard runs before install/semantic validation and refuses aggregate preparation on failure'

# The supported data conflict resolver must use A's staged parent, not live feature.
fixture data-merge
table=tests/catalog/cross-batch-bindings.ts
git -C "$b" rebase --onto "$base" "$before_a" > /dev/null 2>&1
echo a-row > "$a/$table"; git -C "$a" add -A; git -C "$a" commit -q --amend --no-edit
echo b-row > "$b/$table"; git -C "$b" add -A; git -C "$b" commit -q --amend --no-edit
refresh_plan
export PNPM_MERGE="printf 'a-row\\nb-row\\n' > '$table'"
queue
unset PNPM_MERGE
[[ $rc != 0 && ! -e $EP_ORCH/full-gates && -n $(find "$EP_ORCH/logs" -name assembly.json) ]] || { cat "$d/out"; echo 'FAIL data conflict did not reach review stop'; exit 1; }
echo 'ok    allowed table conflict resolves on queue scratch and stops for changed staged review'

for stage in install writer semantic receipt; do
  fixture "prep-$stage"
  export FAIL_STAGE=$stage
  queue
  unset FAIL_STAGE
  [[ $rc != 0 && ! -e $EP_ORCH/full-gates ]] && preserved || { cat "$d/out"; exit 1; }
  [[ $(git -C "$MAIN" for-each-ref --format='%(refname)' refs/archive/queue-pair | wc -l) == 2 ]] || { echo 'FAIL both original inputs were not pinned before prep'; exit 1; }
  echo "ok    staged $stage failure stops before combined gate; originals preserved"
done

fixture cancellation
export GATE_HOOK='kill -TERM "${PAIR_QUEUE_PID:?}"'
queue
unset GATE_HOOK
[[ $rc == 143 ]] && preserved || { cat "$d/out"; echo "FAIL cancellation status $rc"; exit 1; }
echo 'ok    cancellation during full gate waits for children and preserves originals'

fixture loss-before-ff
mv "$d/scripts/land.sh" "$d/scripts/land-actual.sh"
cat > "$d/scripts/land.sh" <<'STUB'
#!/usr/bin/env bash
kill -KILL "${PAIR_QUEUE_PID:?}"
touch "$EP_ORCH/child-finished"
exit 143
STUB
chmod +x "$d/scripts/land.sh"
queue
for ((i=0;i<100;i++)); do [[ ! -e $EP_ORCH/child-finished ]] || break; sleep 0.01; done
[[ $rc != 0 && -e $EP_ORCH/child-finished ]] && preserved || { cat "$d/out"; exit 1; }
echo 'ok    lost process immediately before FF retains exact assembly and no landing without cleanup trap'

fixture loss-after-ff
mv "$d/scripts/land.sh" "$d/scripts/land-actual.sh"
cat > "$d/scripts/land.sh" <<'STUB'
#!/usr/bin/env bash
bash "$(dirname "$0")/land-actual.sh" "$@" || exit
kill -KILL "${PAIR_QUEUE_PID:?}"
touch "$2/after-ff-untracked"
touch "$EP_ORCH/child-finished"
STUB
chmod +x "$d/scripts/land.sh"
queue
for ((i=0;i<100;i++)); do [[ ! -e $EP_ORCH/child-finished ]] || break; sleep 0.01; done
[[ $rc != 0 && -e $EP_ORCH/child-finished && $(git -C "$MAIN" rev-parse HEAD) == "$before_b" ]]
manifest=$(find "$EP_ORCH/logs" -name assembly.json)
node --input-type=module - "$d/plan.json" "$manifest" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [file,manifest]=process.argv.slice(2),plan=JSON.parse(readFileSync(file));
plan.resume={manifest,sha256:createHash('sha256').update(readFileSync(manifest)).digest('hex')};
writeFileSync(file,JSON.stringify(plan));
JS
queue
[[ $rc == 0 && $(wc -l < "$EP_ORCH/full-gates") == 1 ]] || { cat "$d/out"; echo 'FAIL lost FF response was not recovered by authoritative observation'; exit 1; }
grep -q 'already landed' "$d/out"
echo 'ok    lost process after FF observes exact landed tip and never repeats gate/landing'

fixture loss-during-gate
mv "$d/scripts/cur-land.sh" "$d/scripts/cur-land-actual.sh"
cat > "$d/scripts/cur-land.sh" <<'STUB'
#!/usr/bin/env bash
trap 'touch "$EP_ORCH/child-finished"' EXIT
bash "$(dirname "$0")/cur-land-actual.sh" "$@"
STUB
export GATE_HOOK='kill -KILL "${PAIR_QUEUE_PID:?}"'
queue
unset GATE_HOOK
for ((i=0;i<100;i++)); do [[ ! -e $EP_ORCH/child-finished ]] || break; sleep 0.01; done
[[ $rc != 0 && -e $EP_ORCH/child-finished ]] && preserved || { cat "$d/out"; echo 'FAIL orphaned gate landed after queue loss'; exit 1; }
echo 'ok    queue loss during gate prevents orphan landing; originals safe without parent trap'

for invalid in count duplicate-issue duplicate-input missing-issue wrong-commit wrong-tree main branch subdirectory dirty multiple empty discriminator pending-review; do
  fixture "invalid-$invalid"
  case $invalid in
    dirty) echo untracked > "$a/untracked" ;;
    multiple) echo extra > "$a/extra"; git -C "$a" add -A; git -C "$a" commit -qm extra ;;
    empty) git -C "$a" reset --hard -q "$base"; git -C "$a" commit --allow-empty -qm empty ;;
  esac
  state_before="$(git -C "$a" rev-parse HEAD) $(git -C "$a" status --porcelain) $(git -C "$b" rev-parse HEAD)"
  node --input-type=module - "$d/plan.json" "$invalid" "$MAIN" "$a" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const [file,mode,main,a]=process.argv.slice(2),plan=JSON.parse(readFileSync(file));
const item=plan.items[0];
switch(mode){
case 'count':plan.items.push(plan.items[1]);break;
case 'duplicate-issue':plan.items[1].issue=item.issue;break;
case 'duplicate-input':plan.items[1]={...item};break;
case 'missing-issue':delete item.issue;break;
case 'wrong-commit':item.commit='0'.repeat(40);break;
case 'wrong-tree':item.tree=plan.items[1].tree;break;
case 'main':item.item=`t3/code-a:${main}`;break;
case 'branch':item.item=`t3/code-b:${a}`;break;
case 'subdirectory':item.item=`t3/code-a:${a}/docs`;break;
case 'multiple':case 'empty':
item.commit=execFileSync('git',['-C',a,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
item.tree=execFileSync('git',['-C',a,'rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();break;
case 'discriminator':item.item=`cur/901@${item.item}`;break;
case 'pending-review':item.review.status='pending';item.review.disposition='fix';item.review.unresolved=['blocking finding'];break;
}
writeFileSync(file,JSON.stringify(plan));
JS
  queue
  [[ $rc != 0 && ! -e $EP_ORCH/full-gates && ! -e $PNPM_LOG && $(git -C "$MAIN" rev-parse HEAD) == "$base" && "$(git -C "$a" rev-parse HEAD) $(git -C "$a" status --porcelain) $(git -C "$b" rev-parse HEAD)" == "$state_before" ]] || { cat "$d/out"; echo "FAIL invalid $invalid"; exit 1; }
  echo "ok    $invalid plan/input refuses before checks and preserves original states"
done
