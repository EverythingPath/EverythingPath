# shellcheck shell=bash
# Shared target validation for numbered and app-owned worktrees. Call before
# committing, deleting a prep receipt or starting any check.
# worktree_target <branch> <worktree> <integration-ref>
worktree_target() {
  local branch=$1 target=$2 integration=$3 common expected top registered
  git check-ref-format --branch "$branch" >/dev/null 2>&1 || { echo "invalid branch: $branch" >&2; return 1; }
  [[ $branch != "$integration" ]] || { echo "worker branch must differ from integration" >&2; return 1; }
  [[ -d $target ]] || { echo "no worktree $target" >&2; return 1; }
  target=$(realpath "$target")
  [[ $target != "$(realpath "$main")" ]] || { echo "$target is the owner's main checkout" >&2; return 1; }
  common=$(git -C "$target" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || return 1
  expected=$(git -C "$main" rev-parse --path-format=absolute --git-common-dir) || return 1
  [[ $(realpath "$common") == "$(realpath "$expected")" ]] || { echo "$target belongs to a different repository" >&2; return 1; }
  # Capture the whole list first: piped into grep -q under pipefail, a list over
  # one write fails with SIGPIPE when the target is in its first chunk.
  registered=$(git -C "$main" worktree list --porcelain) || { echo "can't list the worktrees of $main" >&2; return 1; }
  grep -Fxq "worktree $target" <<< "$registered" || { echo "$target is not a registered worktree" >&2; return 1; }
  top=$(git -C "$target" rev-parse --show-toplevel) || return 1
  [[ $(realpath "$top") == "$target" ]] || { echo "$target is not a worktree root" >&2; return 1; }
  [[ $(git -C "$target" symbolic-ref --short -q HEAD) == "$branch" ]] || { echo "$target is not on $branch" >&2; return 1; }
  git -C "$main" rev-parse -q --verify "refs/heads/$branch" >/dev/null || { echo "no branch $branch" >&2; return 1; }
  git -C "$target" merge-base "$integration" HEAD >/dev/null || { echo "$branch has no integration base on $integration" >&2; return 1; }
}

# Normalize the queue's supported item tokens, then validate the core target.
# Sets kind, num, br, wt, name, msg and supplied_wt; dirty/frozen policy is caller-owned.
queue_target() {
  local item=$1 integration=$2 discriminator
  supplied_wt=
  kind=; num=; br=; wt=; name=; msg=
  if [[ $item =~ ^[0-9]+$ ]]; then item=cur/$item; fi
  br=${item%%:*}; [[ $item == *:* ]] && wt=${item#*:}
  discriminator=$br
  if [[ $discriminator =~ ^cur/([0-9]+)(@(.+))?$ ]]; then
    kind=cur; num=${BASH_REMATCH[1]}; br=${BASH_REMATCH[3]:-cur/$num}; msg=$orch/briefs/cur-$num-msg.txt
    if [[ $discriminator == *@* && -z $wt ]]; then echo "$item: app curation requires an explicit worktree"; return 1; fi
    supplied_wt=${wt:-$repos/ep-cur-$num}
    wt=$(realpath -m "$supplied_wt")
  else
    kind=impl
    if [[ -z $wt ]]; then
      [[ $br =~ ^impl/(.+)$ ]] || { echo "$item: give the worktree as <branch>:<worktree>"; return 1; }
      wt=$repos/ep-impl-${BASH_REMATCH[1]}
    fi
    supplied_wt=$wt
    wt=$(realpath -m "$wt")
  fi
  name=${br//\//-}
  worktree_target "$br" "$wt" "$integration" || return 1
}
