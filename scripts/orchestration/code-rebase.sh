#!/usr/bin/env bash
# usage: code-rebase.sh WT OLD ACC NEW   (full SHAs; run by root, through capped.sh with CAPPED_KIND=corpus)
# Rebases a reviewed code slice whose only overlap with the base movement is the regenerated launch artifacts
# (gate_core.REGEN_PATHS: the keyed attribution files, the notice authority, the authority, the manifest, the
# overview, the verification projection and the launch-document pin), so its reviews carry without a worker rebase
# or a new review round (code-regen). WT is the slice's clean worktree, on its branch at ACC, the reviewed head,
# which was made on OLD; NEW is the integration head to move onto.
# 1. Refuses, leaving WT as it was: a short SHA, a dirty WT or one with env files, HEAD not ACC, an unmoved or
#    unrelated base, a non-linear chain, no overlap (exit 3: rebase linearly and use rebase-proof.py), any overlap
#    outside the regenerated artifacts, and every refusal of gate_core.regen_precheck: a slice that changes rows of a
#    regenerated artifact (its pin beyond comment lines above it), or a keyed file both sides changed differently
#    (exit 2).
# 2. Replays each commit of OLD..ACC onto NEW with the regenerated artifacts set aside (the base side kept, a
#    conflict in them included), keeping its message and author; a commit left empty is dropped. A conflict in any
#    other path refuses (exit 2).
# 3. Regenerates them with the reviewed inputs on NEW (gate_core.REGEN_CHAIN, prep-regen's order: each keyed file
#    as the keyed union of OLD, NEW and ACC, then the notice authority, the inventory, the projection and the pin)
#    and commits the result alone as the regeneration commit (gate_core.REGEN_MESSAGE). A command that fails, or a
#    chain after which the worktree holds a change outside the regenerated artifacts or none in them, refuses.
# 4. Proves the result with `rebase-proof.py --regenerated`, which refuses a regeneration that changes rows, not
#    only bindings, and every refusal of the gate's own re-proof. Only on PASS does the branch move; the PASS JSON
#    (its `rebaseProof` goes into the gate spec as is; `verifyCheck` records the --verify --check this run passed
#    at the regeneration commit, for root only) is the last line on stdout.
# On any refusal after step 1 the branch stays at ACC and WT is put back on it. Keep ACC reachable (an archive
# ref) for the gate's re-proof. Writes no files outside WT; its scratch files (the keyed files' sides, the
# inventory summary) are in WT's Git directory and removed on every exit.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
(( $# == 4 )) || { echo "usage: code-rebase.sh WT OLD ACC NEW" >&2; exit 64; }
wt=$1 old=$2 acc=$3 new=$4
for sha in "$old" "$acc" "$new"; do
  [[ $sha =~ ^[0-9a-f]{40}$ ]] || { echo "full Git SHA required: $sha" >&2; exit 64; }
done
cd "$wt"
refuse() { echo "code-rebase: $1" >&2; exit "${2:-2}"; }
# gate_core CODE [ARG]...: run CODE with gate_core imported and the ARGs as sys.argv[2:]; a refusal's message
# goes to stderr and exits 2.
gate_core() {
  local code=$1; shift
  python3 -B -c "import sys; sys.path.insert(0, sys.argv[1]); import gate_core
try:
    $code
except RuntimeError as error:
    sys.exit(str(error))" "$here" "$@" || return 2
}
mapfile -t regenerated < <(gate_core "print('\n'.join(sorted(gate_core.REGEN_PATHS)))")
mapfile -t keyed < <(gate_core "print('\n'.join(path for path, kind in gate_core.REGEN_PATHS.items() if isinstance(kind, gate_core.Keyed)))")
regen_re=$(printf '^%s$|' "${regenerated[@]}" | sed 's/\./\\./g; s/|$//')
# outside_regenerated: the lines of stdin that aren't regenerated artifacts.
outside_regenerated() { grep -vE "$regen_re" | grep . || true; }

# Step 1: everything that refuses before WT changes.
preconditions() {
  local overlap outside
  branch=$(git symbolic-ref --short -q HEAD) || refuse "WT is not on a branch" 1
  [[ $(git rev-parse HEAD) == "$acc" ]] || refuse "WT's HEAD is not ACC $acc" 1
  [[ -z $(git status --porcelain=v1 --untracked-files=all) ]] || refuse "WT must be a clean worktree" 1
  ! has_env_files . || refuse "env file present in WT" 1
  [[ $old != "$new" ]] || refuse "the base has not moved" 1
  git merge-base --is-ancestor "$old" "$new" || refuse "OLD is not an ancestor of NEW" 1
  git merge-base --is-ancestor "$old" "$acc" || refuse "OLD is not an ancestor of ACC" 1
  [[ -z $(git rev-list --merges "$old..$acc") ]] || refuse "the slice's chain $old..$acc is not linear" 1
  overlap=$(LC_ALL=C comm -12 <(git diff --no-renames --name-only "$old" "$acc" | LC_ALL=C sort) <(git diff --no-renames --name-only "$old" "$new" | LC_ALL=C sort))
  [[ -n $overlap ]] || refuse "no overlap with the base movement: rebase linearly and prove it with rebase-proof.py" 3
  outside=$(outside_regenerated <<< "$overlap")
  [[ -z $outside ]] || refuse "overlap outside the regenerated artifacts, so a worker rebase and a review: $(paste -sd ' ' <<< "$outside")"
  gate_core "gate_core.regen_precheck(*sys.argv[2:])" "$wt" "$old" "$acc" "$new" || refuse "the slice's change to the regenerated artifacts is not regenerable"
}

# Step 2, one commit: replay it with the regenerated artifacts at the base side, or drop it when that leaves nothing.
replay() {
  local commit=$1 picked=0 conflicts other path
  git cherry-pick --no-commit "$commit" > /dev/null 2>&1 || picked=$?
  conflicts=$(git diff --name-only --diff-filter=U)
  other=$(outside_regenerated <<< "$conflicts")
  [[ -z $other ]] || refuse "replaying $commit conflicts outside the regenerated artifacts: $(paste -sd ' ' <<< "$other")"
  (( picked == 0 )) || [[ -n $conflicts ]] || refuse "git cherry-pick $commit failed"
  for path in "${regenerated[@]}"; do
    if git cat-file -e "HEAD:$path" 2> /dev/null; then git checkout -q HEAD -- "$path"
    else git rm -q --cached --ignore-unmatch -- "$path"; rm -f -- "$path"
    fi
  done
  if git diff --cached --quiet HEAD; then
    git reset -q --hard HEAD
    echo "code-rebase: dropped ${commit:0:12}, which changes only regenerated artifacts" >&2
  else
    git -c core.hooksPath=/dev/null commit -q --cleanup=verbatim -C "$commit"
  fi
}

# Step 3's first command: each keyed file OLD holds becomes the keyed union of OLD, NEW (ours) and ACC (theirs).
merge_keyed() {
  local path
  for path in "${keyed[@]}"; do
    git cat-file -e "$old:$path" 2> /dev/null || continue
    git show "$old:$path" > "$scratch/base"; git show "$new:$path" > "$scratch/ours"; git show "$acc:$path" > "$scratch/theirs"
    pnpm -s catalog:merge "$path" --base "$scratch/base" --ours "$scratch/ours" --theirs "$scratch/theirs" >&2 \
      || refuse "catalog:merge of $path (the keyed union of OLD, NEW and ACC) failed"
  done
}

# Step 3: the generator chain, then the worktree it left, judged after its last command.
regenerate() {
  local changed stray tool=$here/prep-regen.ts
  echo "code-rebase: regenerating $(paste -sd ' ' <<< "${regenerated[*]}") on ${new:0:12}: $(gate_core "print(gate_core.REGEN_CHAIN)")" >&2
  pnpm install --offline > /dev/null 2>&1 || refuse "pnpm install --offline failed" 4
  mkdir -p "$scratch"
  merge_keyed
  pnpm -s exec tsx "$tool" notices >&2 || refuse "regenerating the notice authority (prep-regen.ts notices) failed"
  pnpm -s catalog:launch-inventory --write > "$scratch/launch-summary.json" || refuse "catalog:launch-inventory --write failed"
  pnpm -s catalog:launch-inventory --verify --write >&2 || refuse "catalog:launch-inventory --verify --write failed"
  pnpm -s exec tsx "$tool" pin "$scratch/launch-summary.json" "$old" "$acc" >&2 || refuse "regenerating the launch-document pin (prep-regen.ts pin) failed"
  pnpm -s catalog:launch-inventory --check >&2 || refuse "catalog:launch-inventory --check failed after --write"
  pnpm -s catalog:launch-inventory --verify --check >&2 || refuse "catalog:launch-inventory --verify --check failed after --verify --write"
  changed=$(git status --porcelain=v1 --untracked-files=all | cut -c4-)
  stray=$(outside_regenerated <<< "$changed")
  [[ -z $stray ]] || refuse "the generator changed other paths: $(paste -sd ' ' <<< "$stray")"
  [[ -n $changed ]] || refuse "the regeneration left the base's artifacts unchanged, so the slice's own change to them would be lost"
  mapfile -t changed_paths <<< "$changed"
  git add -- "${changed_paths[@]}"
  gate_core "sys.stdout.buffer.write(gate_core.REGEN_MESSAGE)" | git -c core.hooksPath=/dev/null commit -q --cleanup=verbatim -F -
}

restore() {
  rm -rf -- "$scratch"
  git cherry-pick --abort > /dev/null 2>&1 || true
  git reset -q --hard
  # WT was clean at the start, untracked files included, so every untracked file is this run's.
  git clean -fdq
  git switch -q -f "$branch"
  echo "code-rebase: $branch is unchanged at $acc" >&2
}

preconditions
scratch=$(cd "$(git rev-parse --git-dir)" && pwd)/code-rebase
trap 'status=$?; (( status == 0 )) || restore' EXIT
git switch -q --detach "$new"
for commit in $(git rev-list --reverse "$old..$acc"); do replay "$commit"; done
[[ -z $(git status --porcelain=v1 --untracked-files=all) ]] || refuse "the replay left uncommitted changes"
regenerate
head=$(git rev-parse HEAD)
proof=$(python3 -B "$here/rebase-proof.py" --regenerated --head "$head" "$wt" "$old" "$acc" "$new") \
  || refuse "the regenerated rebase proof failed: $proof"
git switch -q -C "$branch"
trap - EXIT
rm -rf -- "$scratch"
echo "code-rebase: $branch moved to $head; keep $acc reachable with an archive ref for the gate's re-proof" >&2
# verifyCheck is this run's record for root; the gate re-proves rebaseProof and runs its own suite, and never reads it.
python3 -B -c 'import json, sys; result = json.loads(sys.argv[1]); result["verifyCheck"] = dict(command="pnpm -s catalog:launch-inventory --verify --check", commit=sys.argv[2], passed=True); print(json.dumps(result))' "$proof" "$head"
