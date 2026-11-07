#!/usr/bin/env bash
# usage: land.sh <branch> [worktree] — fast-forward the feature branch in $MAIN to <branch>; exit 2 if it would touch the owner's dirty files.
# Never stashes, resets, checks out or moves the owner's files.
set -euo pipefail
branch=${1:?usage: land.sh <branch> [worktree]}; wt=${2:-}
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
feature=${FEATURE:-feature/pf1-character-builder}
die() { echo "refusing: $*" >&2; exit 1; }

[[ $(git -C "$main" symbolic-ref --short -q HEAD || true) == "$feature" ]] || die "$main is not on $feature"
git -C "$main" rev-parse -q --verify "$branch^{commit}" >/dev/null || die "no such branch: $branch"
git -C "$main" merge-base --is-ancestor HEAD "$branch" || die "$branch is not a fast-forward of $feature"

if [[ -n $wt ]]; then
  [[ -z $(git -C "$wt" status --porcelain) ]] || die "$wt has uncommitted changes"
  junk=$(find "$wt" \( -name node_modules -o -name .git \) -prune -o \
    \( -name '.env*' ! -name .env.example -o -name .next -type d -o -path "${wt%/}/e2e/.private" \) -print)
  [[ -z $junk ]] || die "$wt contains forbidden files:"$'\n'"$junk"
fi

# Owner's dirty files: path -> porcelain status, both sides of renames/copies.
declare -A dirty
while IFS= read -r -d '' entry; do
  xy=${entry:0:2}; dirty[${entry:3}]=$xy
  [[ $xy == [RC]* ]] && IFS= read -r -d '' orig && dirty[$orig]=$xy
done < <(git -C "$main" status --porcelain=v1 -z --untracked-files=all)

overlap=0
while IFS= read -r -d '' f; do
  [[ -n ${dirty[$f]+x} ]] && { printf '%s %s\n' "${dirty[$f]}" "$f"; overlap=1; }
done < <(git -C "$main" diff --name-only --no-renames -z HEAD "$branch")
(( overlap == 0 )) || { echo "not landing $branch: it changes the owner's dirty files above" >&2; exit 2; }

if [[ -n ${LAND_PAIR_MANIFEST:-} ]]; then
  node "$here/pair-queue.mjs" --guard "$LAND_PAIR_MANIFEST" "$LAND_PAIR_PLAN_HASH" || exit 1
fi
# The operator's observer shares this lock only around MAIN identity reads.
# Hold the writer lock across Git's index/worktree/ref transition, including hooks.
if [[ -n ${LAND_OBSERVATION_LOCK:-} ]]; then
  [[ $LAND_OBSERVATION_LOCK == /* && -n ${LAND_OBSERVATION_LOCK_ID:-} ]] || die "invalid landing observation lock"
  exec 6>>"$LAND_OBSERVATION_LOCK"
  [[ $(stat -Lc '%d:%i' "/proc/$$/fd/6") == "$LAND_OBSERVATION_LOCK_ID" ]] || die "landing observation lock changed"
  flock 6
fi
[[ $(git -C "$main" symbolic-ref --short -q HEAD || true) == "$feature" ]] || die "integration branch moved at landing boundary"
[[ -z ${LAND_EXPECTED_BASE:-} || $(git -C "$main" rev-parse HEAD) == "$LAND_EXPECTED_BASE" ]] || die "integration base moved at landing boundary"
git -C "$main" merge --ff-only "$branch" 6>&-
git -C "$main" log -1 --oneline
