#!/usr/bin/env bash
# Real queue/stage/prep paths; wrappers amend only after the real process returns.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-test-lib.sh"
. "$here/pair-test-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/pair-handoff-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
original_path=$PATH
for boundary in prep stage cur-stage; do
  for amendment in tree same-tree; do
    fixture "$boundary-$amendment"
    if [[ $boundary != stage ]]; then
      # Use the existing unprepared curation so real prep must amend its count.
      git -C "$b" rebase --onto "$base" "$before_a" > /dev/null 2>&1
      a=$d/ep-cur-901
      git -C "$a" add -A; git -C "$a" commit -qm 'Curation (#901)'
      node --input-type=module - "$d/plan.json" "$a" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const [file,a]=process.argv.slice(2),plan=JSON.parse(readFileSync(file));
plan.items[0].issue=901;plan.items[0].item=`cur/901:${a}`;
plan.items[0].review.reports=plan.items[0].review.reports.slice(0,1).map(report=>({...report,axis:'curation'}));
writeFileSync(file,JSON.stringify(plan));
JS
      refresh_plan
      if [[ $boundary == prep ]]; then script=cur-prep.sh; else script=pair-stage.sh; fi
    else script=pair-stage.sh
    fi
    original_receipt=$EP_ORCH/logs/cur-901-prep.receipt
    echo 'original receipt preserved' > "$original_receipt"
    receipt_before=$(sha256sum "$original_receipt")
    mv "$d/scripts/$script" "$d/scripts/actual-$script"
    cat > "$d/scripts/$script" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/actual-$(basename "$0")" "$@"
checked=$(git rev-parse HEAD)
if [[ $AMENDMENT == tree ]]; then
  echo 'unchecked boundary change' > boundary-change.txt
  git add boundary-change.txt
fi
git commit -q --amend -m "unchecked return boundary amendment $checked"
printf '%s %s\n' "$checked" "$(git rev-parse HEAD)" > "$EP_ORCH/amended-boundary"
WRAPPER
    chmod +x "$d/scripts/$script"
    export AMENDMENT=$amendment
    queue
    unset AMENDMENT
    [[ -s $EP_ORCH/amended-boundary ]] || { cat "$d/out"; echo 'FAIL amendment boundary not reached'; exit 1; }
    read -r checked amended < "$EP_ORCH/amended-boundary"
    [[ $checked != "$amended" ]]
    if [[ $amendment == same-tree ]]; then
      [[ $(git -C "$MAIN" rev-parse "$checked^{tree}") == $(git -C "$MAIN" rev-parse "$amended^{tree}") ]]
    fi
    [[ $rc != 0 && -z $(find "$EP_ORCH/logs" -name assembly.json -o -name gate-started.json) && ! -e $EP_ORCH/full-gates ]] && preserved \
      && [[ $(sha256sum "$original_receipt") == "$receipt_before" ]] \
      || { cat "$d/out"; echo "FAIL $boundary $amendment adopted unchecked identity"; exit 1; }
    echo "ok    $boundary return $amendment amendment refuses before manifest/gate/landing; originals preserved"
  done
done

# Corrupt actual successful prep receipts at the same real return boundary.
for field in commit tree base integrationBase worktree branch lockfile scripts env config mode identity sharedStoreCount issue result missing malformed duplicate; do
  fixture "receipt-$field"
  git -C "$b" rebase --onto "$base" "$before_a" > /dev/null 2>&1
  a=$d/ep-cur-901
  git -C "$a" add -A; git -C "$a" commit -qm 'Curation (#901)'
  node --input-type=module - "$d/plan.json" "$a" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const [file,a]=process.argv.slice(2),plan=JSON.parse(readFileSync(file));
plan.items[0].issue=901;plan.items[0].item=`cur/901:${a}`;
plan.items[0].review.reports=plan.items[0].review.reports.slice(0,1).map(report=>({...report,axis:'curation'}));
writeFileSync(file,JSON.stringify(plan));
JS
  refresh_plan
  mv "$d/scripts/cur-prep.sh" "$d/scripts/actual-cur-prep.sh"
  cat > "$d/scripts/cur-prep.sh" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/actual-cur-prep.sh" "$@"
receipt=$(dirname "$PWD")/prep-901/cur-901-prep.receipt
case $RECEIPT_FIELD in
  missing) rm "$receipt" ;;
  malformed) printf 'not a receipt\n' > "$receipt" ;;
  duplicate) echo "commit=$(git rev-parse HEAD)" >> "$receipt" ;;
  *) sed -i "s/^$RECEIPT_FIELD=.*/$RECEIPT_FIELD=wrong/" "$receipt" ;;
esac
touch "$EP_ORCH/receipt-mutated"
WRAPPER
  chmod +x "$d/scripts/cur-prep.sh"
  export RECEIPT_FIELD=$field
  queue
  unset RECEIPT_FIELD
  [[ -e $EP_ORCH/receipt-mutated && $rc != 0 && -z $(find "$EP_ORCH/logs" -name assembly.json -o -name gate-started.json) && ! -e $EP_ORCH/full-gates ]] && preserved || { cat "$d/out"; echo "FAIL corrupt receipt $field accepted"; exit 1; }
  echo "ok    actual prep receipt $field corruption refuses before manifest/gate/landing"
done

for corruption in missing malformed wrong-base duplicate-key; do
  fixture "stage-evidence-$corruption"
  mv "$d/scripts/pair-stage.sh" "$d/scripts/actual-pair-stage.sh"
  cat > "$d/scripts/pair-stage.sh" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/actual-pair-stage.sh" "$@"
node --input-type=module - "$5" "$EVIDENCE_CORRUPTION" <<'JS'
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
const [file,mode]=process.argv.slice(2);
if(mode==='missing') unlinkSync(file);
else if(mode==='malformed') writeFileSync(file,'not json');
else {
  const evidence=JSON.parse(readFileSync(file));
  if(mode==='wrong-base') evidence.key=evidence.key.replace(/^base=.*$/m,`base=${'0'.repeat(40)}`);
  else evidence.key+='commit=duplicate\n';
  writeFileSync(file,JSON.stringify(evidence));
}
JS
touch "$EP_ORCH/evidence-mutated"
WRAPPER
  export EVIDENCE_CORRUPTION=$corruption
  queue
  unset EVIDENCE_CORRUPTION
  [[ -e $EP_ORCH/evidence-mutated && $rc != 0 && -z $(find "$EP_ORCH/logs" -name assembly.json -o -name gate-started.json) && ! -e $EP_ORCH/full-gates ]] && preserved || { cat "$d/out"; echo "FAIL $corruption checked evidence accepted"; exit 1; }
  echo "ok    $corruption checked stage evidence refuses before manifest/gate/landing"
done
