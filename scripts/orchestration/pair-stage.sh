#!/usr/bin/env bash
# Queue-owned staged item checks. Called only after its explicit-parent rebase.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-lib.sh"
wt=${1:?worktree}; parent=${2:?parent}; kind=${3:?kind}; issue=${4:?issue}; evidence=${5:?checked evidence path}
cd "$wt"
[[ $(git rev-parse HEAD^) == "$parent" && -z $(git status --porcelain) ]]
check_identity() {
  [[ $(prep_identity "$parent") == "$identity" ]] || { echo 'item identity moved during checks; retaining scratch'; exit 5; }
}
if [[ $kind == cur ]]; then
  "$here/cur-prep.sh" --branch "$(git branch --show-current)" --worktree "$wt" \
    --staged-parent "$parent" --receipt-directory "$(dirname "$wt")/prep-$issue" \
    "$issue" "$orch/briefs/cur-$issue-msg.txt"
  export PREP_RECEIPT_DIRECTORY="$(dirname "$wt")/prep-$issue"
  receipt=$(prep_receipt_path "$issue")
  prep_reusable "$issue" "$wt" "$parent"
  [[ $(grep -c '^identity=' "$receipt") == 1 ]] || { echo 'missing or malformed checked prep identity'; exit 5; }
  identity=$(prep_field "$receipt" identity)
  check_identity
  prep_receipt_matches "$receipt" "$(prep_key "$parent" "$(prep_plan "$parent")")"
  [[ $(grep -c '^sharedStoreCount=' "$receipt") == 1 && $(prep_field "$receipt" sharedStoreCount) == "$(prep_shared_count "$parent")" ]] || { echo 'missing or mismatched prep count'; exit 5; }
  key=$(prep_receipt_key "$receipt")
  receipt_hash=$(sha256sum "$receipt" | cut -c1-64)
  check_identity
else
  identity=$(prep_identity "$parent")
  key=$(prep_key "$parent" "$(prep_plan "$parent")")
  pnpm -s check:artifacts --base "$parent"
  check_identity
  pnpm install --offline
  check_identity
fi
pnpm -s check:initial-migration-writers
check_identity
if [[ $kind != cur ]]; then pnpm test "${prep_guards[@]}"; check_identity; fi
pnpm exec node --import tsx scripts/catalog-record-review.ts --verify --root "$wt" --runs "$orch/runs"
check_identity
# Publish the identity that actually passed checks, without observing a new HEAD.
node --input-type=module - "$evidence" "$identity" "$key" "${receipt_hash:-}" <<'JS'
import {writeFileSync} from 'node:fs';
const [file,identity,key,prepReceiptSha256]=process.argv.slice(2);
writeFileSync(file,JSON.stringify({identity,key,prepReceiptSha256:prepReceiptSha256 || null}),{flag:'wx'});
JS
