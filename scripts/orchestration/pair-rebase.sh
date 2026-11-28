#!/usr/bin/env bash
# Replay exactly one frozen item onto its staged predecessor. Preserve conflicts.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/prep-lib.sh"
parent=${1:?new parent}; original=${2:?original parent}
git rebase --onto "$parent" "$original" && exit 0
stops=0
while [[ -d $(git rev-parse --git-path rebase-merge) || -d $(git rev-parse --git-path rebase-apply) ]]; do
  (( ++stops <= 20 )) || { echo 'rebase stopped 20 times; retaining assembly'; exit 2; }
  mapfile -t conflicts < <(git diff --name-only --diff-filter=U)
  (( ${#conflicts[@]} )) || { echo 'empty replay or non-conflict rebase failure; retaining assembly'; exit 2; }
  for file in "${conflicts[@]}"; do
    [[ $file =~ $prep_merge_re ]] || { echo "non-data conflict: $file; retaining assembly"; exit 2; }
  done
  pnpm install --offline && pnpm -s catalog:merge || exit 2
  git add -- "${conflicts[@]}" || exit 2
  GIT_EDITOR=true git rebase --continue && exit 0
done
exit 2
