#!/usr/bin/env bash
# usage: code-rebase.sh WT OLD ACC NEW   (full SHAs; run by root, through capped.sh with CAPPED_KIND=corpus)
# Rebases a reviewed code slice whose overlap with the base movement Git merges cleanly outside the regenerated launch
# artifacts (gate_core.REGEN_PATHS: the keyed attribution files, the notice authority, the authority, the manifest, the
# overview, the verification projection and the launch-document pin) and is regenerable inside them, so its reviews
# carry without a worker rebase or a new review round (code-regen, rebase-patch-equal). WT is the slice's clean
# worktree, on its branch at ACC, the reviewed head, which was made on OLD; NEW is the integration head to move onto.
# The overlap is the paths both OLD..ACC and OLD..NEW change. Its part inside the regenerated artifacts decides
# whether they are regenerated: with none there, the chain of step 3 does not run.
# 1. Refuses, leaving WT as it was: a short SHA, a dirty WT or one with env files, HEAD not ACC, an unmoved or
#    unrelated base, a non-linear chain, no overlap (exit 3: rebase linearly and use rebase-proof.py), and, with an
#    overlap in the regenerated artifacts or a slice that changes one outside it, every refusal of
#    gate_core.regen_precheck: a slice that changes rows of a regenerated artifact (its pin beyond comment lines above
#    it), or a keyed file both sides changed differently (exit 2). Without an overlap in them, a regenerated artifact
#    the slice changes (bindings only) is replayed as it is, and the chain does not run.
# 2. Replays each commit of OLD..ACC onto NEW (git cherry-pick, no rename detection), keeping its message and author.
#    With an overlap in the regenerated artifacts they are set aside (the base side kept, a conflict in them
#    included) and a commit that changes nothing else is dropped; without one, every commit is replayed whole. With
#    an overlap outside them, a commit empty in the slice is replayed as an empty commit, since the patch-equal proof
#    compares the whole chain. Any other commit left empty refuses, as does a conflict in any other path (exit 2).
# 3. With an overlap in the regenerated artifacts only: regenerates them with the reviewed inputs on NEW
#    (gate_core.REGEN_CHAIN, prep-regen's order: each keyed file as the keyed union of OLD, NEW and ACC, then the
#    notice authority, the inventory, the projection and the pin, then the inventory check) and commits the result
#    alone as the regeneration commit (gate_core.REGEN_MESSAGE). A command that fails, or a chain after which the
#    worktree holds a change outside the regenerated artifacts or none in them, refuses.
# 4. Proves the result with `rebase-proof.py --patch-equal` when the overlap reaches outside the regenerated
#    artifacts (each replayed commit has its reviewed commit's patch-id and message, REVIEWED is Git's clean merge
#    there, and the regenerated proof covers the artifacts when the chain ran), else with `--regenerated`; either
#    refuses everything the gate's own re-proof refuses. Only on PASS does the branch move; the PASS JSON (its
#    `rebaseProof` goes into the gate spec as is; `verifyCheck`, present when the chain ran, records the projection's
#    one builder run, --verify --write, whose projection the regeneration commit holds, for root only) is the last
#    line on stdout.
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
# listed LINES EMPTY: LINES on one line, or EMPTY when there are none.
listed() { if [[ -n $1 ]]; then paste -sd ' ' <<< "$1"; else echo "$2"; fi; }
# outside_regenerated: the lines of stdin that aren't regenerated artifacts.
outside_regenerated() { grep -vE "$regen_re" | grep . || true; }

# Step 1: everything that refuses before WT changes. Sets outside (the overlap outside the regenerated artifacts)
# and regen (1 when the overlap reaches into them, so they are set aside and regenerated).
preconditions() {
  local overlap inside carried=
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
  inside=$(grep -E "$regen_re" <<< "$overlap" || true)
  regen=0
  [[ -z $inside ]] || regen=1
  echo "code-rebase: overlap outside the regenerated artifacts: $(listed "$outside" none); inside them: $(listed "$inside" 'none, so no regeneration')" >&2
  # Without regeneration, a regenerated artifact the slice changes is replayed as it is: bindings only, as with it.
  (( regen == 1 )) || carried=$(git diff --no-renames --name-only "$old" "$acc" | grep -E "$regen_re" || true)
  [[ -z $carried ]] || echo "code-rebase: the slice changes regenerated artifacts outside the overlap: $(listed "$carried" none); they may change bindings only, and are replayed as they are" >&2
  [[ -z $inside && -z $carried ]] || gate_core "gate_core.regen_precheck(*sys.argv[2:])" "$wt" "$old" "$acc" "$new" \
    || refuse "the slice's change to the regenerated artifacts is not regenerable"
}

# Step 2, one commit: replay it, with an overlap in the regenerated artifacts with them at the base side, or drop it
# when it changes nothing else; without one, whole. With an overlap outside the regenerated artifacts (the
# patch-equal proof, which compares the whole chain) a commit empty in the slice is replayed empty; any other commit
# left empty refuses.
replay() {
  local commit=$1 picked=0 conflicts other path changed
  git cherry-pick --no-commit --strategy-option=no-renames "$commit" > /dev/null 2>&1 || picked=$?
  conflicts=$(git diff --name-only --diff-filter=U)
  other=$conflicts
  (( regen == 0 )) || other=$(outside_regenerated <<< "$conflicts")
  [[ -z $other ]] || refuse "replaying $commit conflicts outside the regenerated artifacts: $(paste -sd ' ' <<< "$other")"
  (( picked == 0 )) || [[ -n $conflicts ]] || refuse "git cherry-pick $commit failed"
  for path in "${regenerated[@]}"; do
    (( regen == 1 )) || break
    if git cat-file -e "HEAD:$path" 2> /dev/null; then git checkout -q HEAD -- "$path"
    else git rm -q --cached --ignore-unmatch -- "$path"; rm -f -- "$path"
    fi
  done
  changed=$(git diff --no-renames --name-only "$commit^" "$commit")
  if ! git diff --cached --quiet HEAD || [[ -z $changed && -n $outside ]]; then
    git -c core.hooksPath=/dev/null commit -q --allow-empty --cleanup=verbatim -C "$commit"
    return
  fi
  # Left empty: with regeneration, a commit that changes regenerated artifacts only (any commit, for the regenerated
  # proof alone, which compares the commits that change other paths) is dropped; any other refuses.
  (( regen == 1 )) && [[ -z $outside || -z $(outside_regenerated <<< "$changed") ]] \
    || refuse "replaying $commit leaves it empty: the base movement already holds its change"
  git reset -q --hard HEAD
  echo "code-rebase: dropped ${commit:0:12}, which changes only regenerated artifacts" >&2
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
  # No --verify --check after --verify --write: nothing since writes a bound input, and the proof re-hashes each one.
  pnpm -s catalog:launch-inventory --check >&2 || refuse "catalog:launch-inventory --check failed after --write"
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
(( regen == 0 )) || regenerate
head=$(git rev-parse HEAD)
rule=--regenerated
[[ -z $outside ]] || rule=--patch-equal
proof=$(python3 -B "$here/rebase-proof.py" "$rule" --head "$head" "$wt" "$old" "$acc" "$new") \
  || refuse "the rebase proof ($rule) failed: $proof"
git switch -q -C "$branch"
trap - EXIT
rm -rf -- "$scratch"
echo "code-rebase: $branch moved to $head; keep $acc reachable with an archive ref for the gate's re-proof" >&2
# verifyCheck is this run's record for root when the chain ran; the gate re-proves rebaseProof and runs its own suite,
# and never reads it.
python3 -B -c 'import json, sys; result = json.loads(sys.argv[1])
if sys.argv[3] == "1": result["verifyCheck"] = dict(command="pnpm -s catalog:launch-inventory --verify --write", commit=sys.argv[2], passed=True)
print(json.dumps(result))' "$proof" "$head" "$regen"
