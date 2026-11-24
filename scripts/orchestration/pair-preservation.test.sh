#!/usr/bin/env bash
# Conflict, interruption and unrelated-worktree preservation at the pair CLI.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-test-lib.sh"
. "$here/pair-test-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/pair-preservation-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
original_path=$PATH
for mode in text-conflict data-conflict empty-replay; do
  fixture "$mode"
  git -C "$b" rebase --onto "$base" "$before_a" > /dev/null 2>&1
  case $mode in
    text-conflict) file=shared.txt ;;
    data-conflict) file=tests/catalog/cross-batch-bindings.ts ;;
    empty-replay) file=a.txt; git -C "$b" rm -q b.txt ;;
  esac
  if [[ $mode == empty-replay ]]; then echo a > "$b/$file"
  else echo ours > "$a/$file"; echo theirs > "$b/$file"; fi
  git -C "$a" add -A; git -C "$a" commit -q --amend --no-edit
  git -C "$b" add -A; git -C "$b" commit -q --amend --no-edit
  refresh_plan
  queue
  [[ $rc != 0 && ! -e $EP_ORCH/full-gates && -z $(find "$EP_ORCH/logs" -name assembly.json) ]] && preserved || { cat "$d/out"; exit 1; }
  if [[ $mode != empty-replay ]]; then
    wt=$(find "$EP_ORCH/logs" -type d -name assembly)
    [[ -n $(git -C "$wt" diff --name-only --diff-filter=U) ]] || { echo 'FAIL conflict scratch was not retained'; exit 1; }
  fi
  echo "ok    $mode stops before gate, retains failed scratch and preserves original commits/index/files"
done

fixture unrelated-worktrees
git -C "$MAIN" worktree add -qb unrelated "$d/unrelated" "$base"
git -C "$MAIN" worktree add -q --detach "$d/detached" "$base"
for wt in "$d/unrelated" "$d/detached"; do
  echo staged > "$wt/owner-staged"; git -C "$wt" add owner-staged
  echo working >> "$wt/owner-staged"; echo untracked > "$wt/owner-untracked"
done
echo original-receipt > "$EP_ORCH/logs/cur-901-prep.receipt"
snapshot_state() {
  for wt in "$a" "$b" "$d/unrelated" "$d/detached" "$d/ep-cur-901"; do
    git -C "$wt" rev-parse HEAD
    git -C "$wt" status --porcelain=v1 --untracked-files=all
    git -C "$wt" diff --binary | sha256sum
    git -C "$wt" diff --cached --binary | sha256sum
  done
  sha256sum "$d/unrelated/owner-untracked" "$d/detached/owner-untracked" "$EP_ORCH/logs/cur-901-prep.receipt"
}
before=$(snapshot_state)
export FAIL_STAGE=suite
queue
unset FAIL_STAGE
[[ $rc != 0 && $(snapshot_state) == "$before" ]] && preserved || { cat "$d/out"; exit 1; }
echo 'ok    suite failure preserves originals, unrelated attached/detached refs/index/dirt/untracked files and original curation receipt'

for phase in rebase check:artifacts test; do
  fixture "cancel-${phase//:/-}"
  if [[ $phase == rebase ]]; then
    mv "$d/bin/git" "$d/bin/git-normal"
    cat > "$d/bin/git" <<'STUB'
#!/usr/bin/env bash
[[ $1 != rebase ]] || kill -TERM "${PAIR_QUEUE_PID:?}"
exec "$(dirname "$0")/git-normal" "$@"
STUB
    chmod +x "$d/bin/git"
  else
    export PNPM_HOOK_ON=$phase PNPM_HOOK='kill -TERM "${PAIR_QUEUE_PID:?}"'
  fi
  queue
  unset PNPM_HOOK_ON PNPM_HOOK
  [[ $rc == 143 && ! -e $EP_ORCH/full-gates && -n $(find "$EP_ORCH/logs" -name ownership.json) ]] && preserved || { cat "$d/out"; echo "FAIL cancel during $phase"; exit 1; }
  echo "ok    cancellation during $phase waits for command exit and retains original/scratch evidence"
done

fixture foreign-input
git init -qb t3/code-a "$d/foreign"
echo foreign > "$d/foreign/file"; git -C "$d/foreign" add -A; git -C "$d/foreign" commit -qm foreign
node --input-type=module - "$d/plan.json" "$d/foreign" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const [file,foreign]=process.argv.slice(2),plan=JSON.parse(readFileSync(file));
plan.items[0].item=`t3/code-a:${foreign}`;writeFileSync(file,JSON.stringify(plan));
JS
queue
[[ $rc != 0 && ! -e $PNPM_LOG && ! -e $EP_ORCH/full-gates ]] && preserved || { cat "$d/out"; exit 1; }
echo 'ok    foreign repository cannot substitute an original app worktree'
