# shellcheck shell=bash
# Sourced by every orchestration script after it sets $here (its own directory).
# Sets main (the main checkout), repos (its parent), orch (the run directory)
# and repo (the checkout these scripts and their docs come from), and exports
# MAIN, EP_ORCH and EP_REPO so child scripts and snapshot copies inherit them.
# main comes from `git rev-parse --git-common-dir` in $here, so a snapshot copy
# outside the repo needs MAIN in its environment. EP_ORCH defaults to
# ep-orch/ beside the main checkout.
if [[ -z ${MAIN:-} ]]; then
  MAIN=$(git -C "$here" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) \
    || { echo "can't find the main checkout from $here; set MAIN" >&2; exit 1; }
  MAIN=$(dirname "$MAIN")
fi
main=$MAIN
repos=$(dirname "$main")
orch=${EP_ORCH:-$repos/ep-orch}
repo=${EP_REPO:-$(git -C "$here" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$main")}
export MAIN EP_ORCH=$orch EP_REPO=$repo

# run_tmp <name>: makes a fresh TMPDIR for this run outside every checkout,
# $repos/.ep-tmp/<name>-XXXXXX (never /tmp: tests that write scripts into
# TMPDIR break inside a "type": "module" checkout), and exports it as TMPDIR.
# The caller removes "$run_tmp" when it exits.
run_tmp() {
  mkdir -p "$repos/.ep-tmp" && run_tmp=$(mktemp -d "$repos/.ep-tmp/$1-XXXXXX") || { echo "can't create a TMPDIR under $repos/.ep-tmp" >&2; return 1; }
  export TMPDIR=$run_tmp
}

# record_scratch_worktree <path>: inside a gate, whose operator sets GATE_SCRATCH_WORKTREES to the attempt's
# record, appends the exact path of a scratch checkout before `git worktree add` creates it. The gate's
# automatic-maintenance check accepts an unresolved worktree entry (prunable, vanished or mid-creation) only
# at a path recorded there (gate-modes.md#protected-refs). Outside a gate it does nothing.
record_scratch_worktree() {
  [[ -n ${GATE_SCRATCH_WORKTREES:-} ]] || return 0
  [[ $GATE_SCRATCH_WORKTREES == /* && $1 == /* && $1 != *$'\n'* ]] \
    || { echo "invalid scratch worktree record: $GATE_SCRATCH_WORKTREES <- $1" >&2; return 1; }
  printf '%s\n' "$1" >> "$GATE_SCRATCH_WORKTREES" \
    || { echo "can't record scratch worktree $1 in $GATE_SCRATCH_WORKTREES" >&2; return 1; }
}

# env_files <dir>: prints each entry at the top of <dir> (file, directory or
# symlink, dangling or not) whose name starts with .env, other than
# .env.example, one per line; fails when <dir> can't be listed. A glob, not
# `ls | grep -q`: under pipefail an early-exit consumer of a long listing dies
# of SIGPIPE (141), which a guard reads as "none" and so lets env files through.
env_files() {
  local f
  [[ -d $1 && -r $1 && -x $1 ]] || { echo "can't list $1" >&2; return 1; }
  for f in "$1"/.env*; do
    [[ -e $f || -L $f ]] || continue
    f=${f##*/}
    [[ $f == .env.example ]] || printf '%s\n' "$f"
  done
}
# has_env_files <dir>: true when <dir> holds env files or can't be listed.
has_env_files() {
  local found
  found=$(env_files "$1") || return 0
  [[ -n $found ]]
}
