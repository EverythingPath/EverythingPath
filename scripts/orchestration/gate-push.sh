#!/usr/bin/env bash
# usage: gate-push.sh <REVIEWED> <BASE> <label>
# Root's push of a frozen landing candidate for the CI heavy checks (owner 2026-11-02, tree-only
# CI commits): a parentless commit of REVIEWED's tree, whose message carries Gate-Reviewed,
# Gate-Base and Gate-Tree (full SHAs), pushed to origin as refs/heads/gate/<label> and nothing
# else, so only the candidate's current files are published and never the integration history.
# Run it from the checkout whose origin is GitHub (root's main checkout). It refuses, pushing
# nothing, unless REVIEWED and BASE are full commit SHAs with REVIEWED descending from BASE, the
# worktree is clean (untracked files included), GIT_CONFIG is unset, origin has exactly one
# well-formed push URL that no url.<base>.insteadOf rewrite or remote named by it can redirect (the
# push names that URL), and every file in the tree is under 100 MB (GitHub's per-file limit),
# naming each at or over it.
# The commit's dates are REVIEWED's committer date, so the same inputs give the same commit.
# Prints the commit; remote_checks.py binds the CI manifest to it. Exit 64 is a usage error.
# The origin checks, the commit and the push are push-lib.sh's, in gate mode (push-guard.test.sh).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/push-lib.sh"
push_lib_init gate-push gate
fail() { push_fail "$@"; }
# Before any read (push-lib.sh: GIT_CONFIG changes only what git config reads).
push_require_no_git_config
sha='^[0-9a-f]{40}$'
[[ $# -eq 3 && $1 =~ $sha && $2 =~ $sha && $3 =~ ^[a-z0-9-]+$ ]] \
  || { echo "usage: gate-push.sh <REVIEWED> <BASE> <label>  (full SHAs; label [a-z0-9-]+)" >&2; exit 64; }
reviewed=$1 base=$2 label=$3
[[ $(git rev-parse -q --verify "$reviewed^{commit}") == "$reviewed" ]] || fail "REVIEWED $reviewed is not a commit"
[[ $(git rev-parse -q --verify "$base^{commit}") == "$base" ]] || fail "BASE $base is not a commit"
git merge-base --is-ancestor "$base" "$reviewed" || fail "REVIEWED $reviewed does not descend from BASE $base"
# Clean means a status that succeeded and listed nothing: every untracked file whatever
# status.showUntrackedFiles says, submodules whatever their ignore setting, and no index entry
# marked assume-unchanged or skip-worktree (ls-files -v: a lowercase tag or S), which hides its
# worktree change from status.
status=$(git -c core.fsmonitor=false status --porcelain=v1 --untracked-files=all --ignore-submodules=none) \
  || fail "git status failed, so the worktree is not known to be clean"
[[ -z $status ]] || fail "the worktree is not clean"
index=$(git ls-files -v) || fail "git ls-files failed, so the worktree is not known to be clean"
! grep -qE '^([a-z]|S) ' <<< "$index" || fail "the index hides worktree changes (assume-unchanged or skip-worktree entries)"
# Exactly one well-formed push URL that no rewrite or remote named by it can redirect.
push_origin_url
tree=$(git rev-parse "$reviewed^{tree}")
push_check_file_sizes "$tree"
date=$(git show -s --format=%cI "$reviewed")
commit=$(printf 'gate: %s\n\nTree-only CI commit of REVIEWED for the heavy checks; no history.\n\nGate-Reviewed: %s\nGate-Base: %s\nGate-Tree: %s\n' \
  "$label" "$reviewed" "$base" "$tree" | push_tree_commit "$tree" "$date")
push_ref "$commit" "refs/heads/gate/$label"
echo "$commit"
