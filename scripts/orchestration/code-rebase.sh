#!/usr/bin/env bash
# usage: code-rebase.sh WT OLD ACC NEW   (full SHAs; run by root, through capped.sh with CAPPED_KIND=corpus)
# Rebases a reviewed code slice whose overlap with the base movement Git merges cleanly outside the regenerated launch
# artifacts (gate_core.REGEN_PATHS: the keyed attribution files, the manifest, the overview, the verification
# projection and the launch-document pin) and is regenerable inside them, so its reviews carry without a worker
# rebase or a new review round (code-regen, rebase-patch-equal). WT is the slice's clean
# worktree, on its branch at ACC, the reviewed head, which was made on OLD; NEW is the integration head to move onto.
# The overlap is every path any commit of OLD..ACC changes (the union of the per-commit paths, not the net diff, so a
# path one commit changes and a later one restores is in it) that OLD..NEW changes: gate_core.slice_overlap. Its part
# inside the regenerated artifacts decides whether they are regenerated: with none there, the chain of step 3 does not
# run.
# 1. Refuses, leaving WT as it was: a short SHA, a dirty WT or one with env files, HEAD not ACC, an unmoved or
#    unrelated base, a non-linear chain, no overlap (exit 3: rebase linearly and use rebase-proof.py), and, with an
#    overlap in the regenerated artifacts or a slice that changes one outside it, every refusal of
#    gate_core.regen_precheck: a slice whose net change, OLD..ACC, changes rows of a regenerated artifact (its pin
#    beyond comment lines above it), or a keyed file both sides changed differently (exit 2). Without an overlap in
#    them, a regenerated artifact the slice changes (bindings only) is replayed as it is, and the chain does not run.
# 2. Replays each commit of OLD..ACC onto NEW (git cherry-pick, no rename detection), keeping its message and author.
#    With an overlap in the regenerated artifacts they are set aside (the base side kept, a conflict in them
#    included) and a commit that changes nothing else is dropped; without one, every commit is replayed whole. With
#    an overlap outside them, a commit empty in the slice is replayed as an empty commit, since the patch-equal proof
#    compares the whole chain. Any other commit left empty refuses, as does a conflict in any other path (exit 2),
#    unless review-receipts.json is that path alone: gate_core.receipts_union resolves it, as step 4's last item says.
# 3. With an overlap in the regenerated artifacts (with or without one outside them): regenerates them with the
#    reviewed inputs on NEW (gate_core.REGEN_CHAIN, prep-regen's order: each keyed file as the keyed union of OLD, NEW
#    and ACC, then the inventory, the projection and the pin, then the inventory check and the
#    scripted match's check against a fresh generation) and commits the result alone as the regeneration commit
#    (gate_core.REGEN_MESSAGE). A command that fails, or a chain after which the worktree holds a change outside the
#    regenerated artifacts or none in them, refuses.
# 4. Proves the result with `rebase-proof.py --patch-equal` when the overlap holds a path outside the regenerated
#    artifacts, else with `--regenerated`. The patch-equal proof (gate_core.patch_equal_proof) checks, over every path
#    or, when the chain ran, every path outside the regenerated artifacts:
#    - each replayed commit changes the paths its reviewed commit changes, with the same modes, status, patch-id and
#      message;
#    - REVIEWED's tree is Git's clean three-way merge of ACC onto NEW with OLD as the merge base;
#    - each replayed commit's tree is Git's clean three-way replay of its reviewed commit onto the replayed commit
#      before it (the reviewed commit's parent as the merge base, no rename detection), so a hunk that lands
#      anywhere other than where Git's replay places it is reported; a clean `git apply` offset that Git's replay
#      also produces is not a difference;
#    - receipts-union-v1 (gate_core.receipts_union_holds), when Git's replay of a commit conflicts in review-receipts.json:
#      that file leaves the paths above, and each replayed commit and REVIEWED hold, in the record step's writer's
#      bytes, the base's receipts unchanged and in order, then those the slice added, provided each reviewed commit
#      leaves the file's mode as OLD has it and OLD's receipts an unchanged prefix (what follows is the slice's own,
#      carried as that commit holds it) and adds no runId the base holds, else the proof refuses; after the proof,
#      `pnpm install --offline` (unless the chain ran it) and the record step's --verify must pass on the rebased tree.
#    The regenerated proof (gate_core.regen_proof) checks that each replayed commit's delta equals its reviewed
#    commit's delta outside the regenerated artifacts, with its message, and changes no regenerated artifact. When the
#    chain ran, both then check the regeneration commit (gate_core.regen_commit): an artifact whose decoded content
#    (JSON parsed, the pin's identity whatever its quotes, the overview by its text) is NEW's has NEW's bytes, and
#    some artifact's decoded content differs from NEW's, else there is nothing to regenerate; then each artifact's
#    mode is NEW's and its rows and bindings are checked (gate_core.regen_artifacts). The form of an artifact whose
#    content changed is not this proof's concern: the suite checks the keyed files' (data-files.test.ts) and the
#    projection's (launch-artifact-bytes.test.ts); no test checks the manifest's. Each rebase-proof command
#    (rebase-proof.py, the gate's re-proof, this script's gate_core runner) has one top-level catch
#    (gate_core.proof_refusal): an exception that is not one of the proof's named refusals becomes
#    a refusal with the original error, naming the commit and path a step marked (gate_core.proof_context) when one is
#    set, else the step. The gate re-proves with the same functions, so it
#    accepts exactly what this proof accepts. Only on PASS does the branch move; the PASS JSON (its `rebaseProof`
#    goes into the gate spec as is; `verifyCheck`, present when the chain ran, records the projection's one builder
#    run, --verify --write, whose projection the regeneration commit holds, for root only) is the last line on
#    stdout, written only when the run exits 0.
# The branch moves only at the end, after the proof passed and the scratch files are gone. Before WT first changes,
# usage or a short SHA exits 64, an unmet precondition 1, no overlap 3, and a refusal (a failing Git call or
# gate_core runner call included) 2, each with nothing changed. After it, unless the branch is at the rebased head,
# restoration is attempted, two ways: the switch back to the branch, then symbolic-ref with a reset, each failing step
# reported; the report then says where WT ended. conclude reports the run's last status first, reads the end state and
# takes the exit code from it (reports go to stderr; the result line, only on exit 0, to stdout last):
#   end state, as read                                                  message (stderr)                    exit
#   WT on the branch, tip ACC                                           "<branch> is unchanged at <ACC>"    2
#   WT on the branch, tip the rebased head, the result line written,    "<branch> moved to <head>"          0
#     the run's last status 0 and no command in conclude failed
#   anything else: a failure after the move (a post-checkout hook, a    what it read, e.g. "moved to        5
#     read or restore step in conclude, even one a retry made good),      <head>, but ...", "WT is detached
#     the result not written; WT's HEAD unreadable, detached or on        at ...", "<branch> is at <tip>"
#     another ref; the tip unreadable or at neither commit
# The script promises nothing after a kill signal or a machine failure mid-run: those can leave any state, including
# scratch files under the Git directory that no precondition inspects.
# Keep ACC reachable (an archive ref) for the gate's re-proof. Writes in WT and its Git directory (the replayed commits; scratch files, the keyed
# files' sides and the inventory summary, removed on every exit) and, through the proof, Git objects of its merges in
# a scratch object directory under TMPDIR (gate_core.scratch_objects), removed when the proof ends.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
# refuse MESSAGE [STATUS]: the refusal, on the script's own stderr (fd 3) whatever the caller redirected.
exec 3>&2
refuse() { echo "code-rebase: $1" >&3; exit "${2:-2}"; }
# Every Git call goes through one of these two. git_read ARG...: git ARG..., its output printed; any non-zero status
# refuses (exit 2) naming the command. git_test ARG...: git ARG... as a question, status 0 yes and 1 no; any other
# status refuses (exit 2). Used in a command substitution, a refusal ends that subshell with 2, which set -e (or the
# caller's check) carries to the script.
git_read() { local status=0; command git "$@" || status=$?; (( status == 0 )) || refuse "git $* failed (exit $status)"; }
git_test() { local status=0; command git "$@" || status=$?; (( status <= 1 )) || refuse "git $* failed (exit $status)"; return "$status"; }
# paths.sh's two Git reads (the main checkout, the repository), made here through git_read, so a failing one refuses;
# with MAIN and EP_REPO set, paths.sh, unchanged for its other callers, reads neither.
if [[ -z ${MAIN:-} ]]; then
  MAIN=$(git_read -C "$here" rev-parse --path-format=absolute --git-common-dir)
  MAIN=$(dirname "$MAIN")
  export MAIN
fi
if [[ -z ${EP_REPO:-} ]]; then
  EP_REPO=$(git_read -C "$here" rev-parse --show-toplevel)
  export EP_REPO
fi
. "$here/paths.sh"
(( $# == 4 )) || { echo "usage: code-rebase.sh WT OLD ACC NEW" >&2; exit 64; }
wt=$1 old=$2 acc=$3 new=$4
for sha in "$old" "$acc" "$new"; do
  [[ $sha =~ ^[0-9a-f]{40}$ ]] || { echo "full Git SHA required: $sha" >&2; exit 64; }
done
cd "$wt"
# in_tree COMMIT PATH: whether COMMIT's tree holds PATH, an answer; a tree that cannot be read refuses (exit 2).
in_tree() { local listed; listed=$(git_read ls-tree --full-tree --name-only "$1" -- "$2") || exit 2; [[ $listed == "$2" ]]; }
# gate_core CODE [ARG]...: run CODE with gate_core imported and the ARGs as sys.argv[2:]; a refusal's message
# goes to stderr and exits 2. Every call's status is checked before its output is used (never inside echo, mapfile or
# a pipeline).
gate_core() {
  local code=$1; shift
  python3 -B -c "import sys; sys.path.insert(0, sys.argv[1]); import gate_core
try:
    $code
except Exception as error:
    sys.exit(str(gate_core.proof_refusal('Regenerated rebase proof', 'running a code-rebase.sh check', error)))" "$here" "$@" || return 2
}
listing=$(gate_core "print('\n'.join(sorted(gate_core.REGEN_PATHS)))") || refuse "the regenerated artifacts could not be listed"
mapfile -t regenerated <<< "$listing"
listing=$(gate_core "print('\n'.join(path for path, kind in gate_core.REGEN_PATHS.items() if isinstance(kind, gate_core.Keyed)))") \
  || refuse "the keyed files could not be listed"
mapfile -t keyed <<< "$listing"
receipts=$(gate_core "print(gate_core.RECEIPTS)") || refuse "the receipts file could not be named"
regen_re=$(printf '^%s$|' "${regenerated[@]}" | sed 's/\./\\./g; s/|$//')
# listed LINES EMPTY: LINES on one line, or EMPTY when there are none.
listed() { if [[ -n $1 ]]; then paste -sd ' ' <<< "$1"; else echo "$2"; fi; }
# outside_regenerated: the lines of stdin that aren't regenerated artifacts.
outside_regenerated() { grep -vE "$regen_re" | grep . || true; }

# Step 1: everything that refuses before WT changes. Sets outside (the overlap outside the regenerated artifacts)
# and regen (1 when the overlap reaches into them, so they are set aside and regenerated).
preconditions() {
  local overlap inside carried= found
  git_test symbolic-ref -q HEAD > /dev/null || refuse "WT is not on a branch" 1
  branch=$(git_read symbolic-ref --short -q HEAD)
  found=$(git_read rev-parse HEAD)
  [[ $found == "$acc" ]] || refuse "WT's HEAD is not ACC $acc" 1
  found=$(git_read status --porcelain=v1 --untracked-files=all)
  [[ -z $found ]] || refuse "WT must be a clean worktree" 1
  ! has_env_files . || refuse "env file present in WT" 1
  [[ $old != "$new" ]] || refuse "the base has not moved" 1
  git_test merge-base --is-ancestor "$old" "$new" || refuse "OLD is not an ancestor of NEW" 1
  git_test merge-base --is-ancestor "$old" "$acc" || refuse "OLD is not an ancestor of ACC" 1
  found=$(git_read rev-list --merges "$old..$acc")
  [[ -z $found ]] || refuse "the slice's chain $old..$acc is not linear" 1
  overlap=$(gate_core "print('\n'.join(sorted(gate_core.slice_overlap(*sys.argv[2:]))))" "$wt" "$old" "$acc" "$new") \
    || refuse "the overlap could not be computed"
  [[ -n $overlap ]] || refuse "no overlap with the base movement: rebase linearly and prove it with rebase-proof.py" 3
  outside=$(outside_regenerated <<< "$overlap")
  inside=$(grep -E "$regen_re" <<< "$overlap" || true)
  regen=0
  [[ -z $inside ]] || regen=1
  echo "code-rebase: overlap outside the regenerated artifacts: $(listed "$outside" none); inside them: $(listed "$inside" 'none, so no regeneration')" >&2
  # Without regeneration, a regenerated artifact the slice changes is replayed as it is: bindings only, as with it.
  if (( regen == 0 )); then
    found=$(git_read diff --no-renames --name-only "$old" "$acc")
    carried=$(grep -E "$regen_re" <<< "$found" || true)
  fi
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
  git_test cherry-pick --no-commit --strategy-option=no-renames "$commit" > /dev/null 2>&1 || picked=$?
  conflicts=$(git_read diff --name-only --diff-filter=U)
  other=$conflicts
  (( regen == 0 )) || other=$(outside_regenerated <<< "$conflicts")
  if [[ $other == "$receipts" ]]; then resolve_receipts "$commit"; other=; fi
  [[ -z $other ]] || refuse "replaying $commit conflicts outside the regenerated artifacts: $(paste -sd ' ' <<< "$other")"
  (( picked == 0 )) || [[ -n $conflicts ]] || refuse "cherry-picking $commit failed"
  for path in "${regenerated[@]}"; do
    (( regen == 1 )) || break
    if in_tree HEAD "$path"; then git_read checkout -q HEAD -- "$path"
    else git_read rm -q --cached --ignore-unmatch -- "$path"; rm -f -- "$path"
    fi
  done
  changed=$(git_read diff --no-renames --name-only "$commit^" "$commit")
  if ! git_test diff --cached --quiet HEAD || [[ -z $changed && -n $outside ]]; then
    git_read -c core.hooksPath=/dev/null commit -q --allow-empty --cleanup=verbatim -C "$commit"
    return
  fi
  # Left empty: with regeneration, a commit that changes regenerated artifacts only (any commit, for the regenerated
  # proof alone, which compares the commits that change other paths) is dropped; any other refuses.
  (( regen == 1 )) && [[ -z $outside || -z $(outside_regenerated <<< "$changed") ]] \
    || refuse "replaying $commit leaves it empty: the base movement already holds its change"
  git_read reset -q --hard HEAD
  echo "code-rebase: dropped ${commit:0:12}, which changes only regenerated artifacts" >&2
}

# The receipts-union rule, for a commit whose replay conflicts in the receipts file and in no other path outside the
# regenerated artifacts: the file as gate_core.receipts_union gives it (the base's receipts, then the ones the commit
# adds, in the record step's writer's bytes), which the proof checks again. It refuses, and the run with it, unless
# the commit leaves the receipts the old base holds an unchanged prefix (a receipt the slice itself added may differ
# from an earlier commit's) and the file's mode as the old base has it, adds no runId the base holds, and every side's
# file decodes as receipts.
resolve_receipts() {
  mkdir -p "$scratch"
  gate_core "sys.stdout.buffer.write(gate_core.receipts_union(*sys.argv[2:]))" "$wt" "$old" "$1" "$new" > "$scratch/receipts" \
    || refuse "replaying $1 conflicts in $receipts, which the receipts-union rule does not carry"
  cp -- "$scratch/receipts" "$receipts" || refuse "the receipts union could not be written"
  git_read add -- "$receipts"
  union=1
  echo "code-rebase: replaying ${1:0:12} conflicts in $receipts, the only conflict outside the regenerated artifacts: resolved by the receipts-union rule as the base's receipts followed by the slice's" >&2
}

# Step 3's first command: each keyed file OLD holds becomes the keyed union of OLD, NEW (ours) and ACC (theirs).
merge_keyed() {
  local path
  for path in "${keyed[@]}"; do
    in_tree "$old" "$path" || continue
    git_read show "$old:$path" > "$scratch/base"; git_read show "$new:$path" > "$scratch/ours"; git_read show "$acc:$path" > "$scratch/theirs"
    pnpm -s catalog:merge "$path" --base "$scratch/base" --ours "$scratch/ours" --theirs "$scratch/theirs" >&2 \
      || refuse "catalog:merge of $path (the keyed union of OLD, NEW and ACC) failed"
  done
}

# Step 3: the generator chain, then the worktree it left, judged after its last command.
regenerate() {
  local changed stray chain tool=$here/prep-regen.ts
  chain=$(gate_core "print(gate_core.REGEN_CHAIN)") || refuse "the regeneration chain could not be read"
  echo "code-rebase: regenerating ${regenerated[*]} on ${new:0:12}: $chain" >&2
  pnpm install --offline > /dev/null 2>&1 || refuse "pnpm install --offline failed"
  mkdir -p "$scratch"
  merge_keyed
  pnpm -s catalog:launch-inventory --write > "$scratch/launch-summary.json" || refuse "catalog:launch-inventory --write failed"
  pnpm -s catalog:launch-inventory --verify --write >&2 || refuse "catalog:launch-inventory --verify --write failed"
  pnpm -s exec tsx "$tool" pin "$scratch/launch-summary.json" "$old" "$acc" >&2 || refuse "regenerating the launch-document pin (prep-regen.ts pin) failed"
  # No --verify --check after --verify --write: nothing since writes a bound input, and the proof re-hashes each one.
  pnpm -s catalog:launch-inventory --check >&2 || refuse "catalog:launch-inventory --check failed after --write"
  # The scripted match the projection binds authorizes admission: a fresh generation must equal it.
  pnpm -s catalog:attribution-227-matches --check >&2 || refuse "catalog:attribution-227-matches --check failed: the scripted match differs from a fresh generation"
  changed=$(git_read status --porcelain=v1 --untracked-files=all)
  changed=$(cut -c4- <<< "$changed")
  stray=$(outside_regenerated <<< "$changed")
  [[ -z $stray ]] || refuse "the generator changed other paths: $(paste -sd ' ' <<< "$stray")"
  [[ -n $changed ]] || refuse "the regeneration left the base's artifacts unchanged, so the slice's own change to them would be lost"
  mapfile -t changed_paths <<< "$changed"
  git_read add -- "${changed_paths[@]}"
  gate_core "sys.stdout.buffer.write(gate_core.REGEN_MESSAGE)" > "$scratch/message" || refuse "the regeneration message could not be read"
  git_read -c core.hooksPath=/dev/null commit -q --cleanup=verbatim -F "$scratch/message"
}

# say MESSAGE: a report from conclude or restore on stderr; a write that fails (stderr closed or a broken pipe) sets
# failed_after_move instead of ending the script.
say() { echo "code-rebase: $*" 1>&2 2> /dev/null || failed_after_move=1; }

# restore: attempts to put WT back on the branch, whenever conclude finds the branch not at the rebased head (after a
# refusal, or a tip it could not read). Each step runs on whatever an earlier one left, each in a subshell so that its
# refusal is noted, not the end of the restore: the switch back, and if it fails, symbolic-ref with a reset; both can
# fail and leave WT detached. It reports the steps that failed; conclude reports where WT and the branch ended.
restore() {
  local failed=() probe=0
  rm -rf -- "$scratch" || failed+=('removing the scratch files')
  ( git_test rev-parse --verify -q CHERRY_PICK_HEAD > /dev/null ) || probe=$?
  (( probe <= 1 )) || failed+=('finding a cherry-pick in progress')
  (( probe != 0 )) || ( git_read cherry-pick --abort > /dev/null 2>&1 ) || failed+=('aborting the cherry-pick')
  ( git_read reset -q --hard ) || failed+=('resetting WT')
  # WT was clean at the start, untracked files included, so every untracked file is this run's.
  ( git_read clean -fdq ) || failed+=('cleaning WT')
  if ! ( git_read switch -q -f "$branch" ); then
    failed+=("switching back to $branch")
    { ( git_read symbolic-ref HEAD "refs/heads/$branch" ) && ( git_read reset -q --hard ); } || failed+=("attaching HEAD to $branch")
  fi
  (( ${#failed[@]} == 0 )) || { failed_after_move=1; say "restoring WT failed at: $(IFS=';'; echo "${failed[*]}")"; }
}

# conclude STATUS: the run's report and exit code, decided from the end state as read here, never assumed (the header's
# table); every exit after the script first changes WT comes here (the EXIT trap). Unless the branch is at the rebased
# head, restoration is attempted first, then the branch tip and WT's HEAD are read. Each arm's exit code is a constant:
# STATUS, the run's last status, is reported once, first, never returned. failed_after_move is set by STATUS other than 0 and
# by any failed command here (a read, a restore step, a reattachment), so the moved arm exits 0 only when nothing
# after the move failed, even when a retry read the rebased head.
conclude() {
  local status=$1 tip on read=0 where failed_after_move=0
  trap - EXIT
  # A closed stdout must not end the run by SIGPIPE: the result line's write fails instead, and is reported.
  trap '' PIPE
  say "the run's last status before concluding was $status"
  (( status == 0 )) || failed_after_move=1
  tip=$(git_read rev-parse "refs/heads/$branch") || { tip=; failed_after_move=1; }
  if [[ -z $head || $tip != "$head" ]]; then
    restore
    tip=$(git_read rev-parse "refs/heads/$branch") || { tip=; failed_after_move=1; }
  elif [[ -n $tip && $tip == "$head" ]]; then
    on=$(git_test symbolic-ref --quiet HEAD) || { (( $? == 1 )) || failed_after_move=1; on=; }
    [[ $on == "refs/heads/$branch" ]] || ( git_read symbolic-ref HEAD "refs/heads/$branch" ) || failed_after_move=1
  fi
  on=$(git_test symbolic-ref --quiet HEAD) || read=$?
  if (( read > 1 )); then
    say "WT's state could not be read (whether HEAD is on $branch is unknown); $branch is at ${tip:-an unknown commit (its tip could not be read)}"
    exit 5
  fi
  if (( read == 1 )); then
    where=$(git_read rev-parse HEAD) || where='a commit that could not be read'
    say "WT is detached at $where; $branch is at ${tip:-an unknown commit (its tip could not be read)}"
    exit 5
  fi
  if [[ $on != "refs/heads/$branch" ]]; then
    say "WT is on $on, not $branch; $branch is at ${tip:-an unknown commit (its tip could not be read)}"
    exit 5
  fi
  if [[ -z $tip ]]; then
    say "$branch's tip could not be read, so whether it moved is unknown; WT is on it"
    exit 5
  fi
  if [[ $tip == "$acc" ]]; then
    say "$branch is unchanged at $acc"
    exit 2
  fi
  if [[ -n $head && $tip == "$head" ]]; then
    if (( failed_after_move )); then
      say "$branch moved to $head, but a step after the move failed (see above), so no result line is written; keep $acc reachable with an archive ref for the gate's re-proof"
      exit 5
    fi
    say "$branch moved to $head; keep $acc reachable with an archive ref for the gate's re-proof"
    (( ! failed_after_move )) || exit 5
    printf '%s\n' "$result" 2> /dev/null || { say "$branch moved to $head, but the result could not be written"; exit 5; }
    exit 0
  fi
  say "$branch is at $tip, neither ACC $acc nor the rebased head ${head:-(none yet)}"
  exit 5
}

preconditions
gitdir=$(git_read rev-parse --git-dir)
scratch=$(cd "$gitdir" && pwd)/code-rebase
commits=$(git_read rev-list --reverse "$old..$acc")
head= result= union=0
trap 'conclude $?' EXIT
git_read switch -q --detach "$new"
for commit in $commits; do replay "$commit"; done
left=$(git_read status --porcelain=v1 --untracked-files=all)
[[ -z $left ]] || refuse "the replay left uncommitted changes"
# Called outside a || list, so that set -e holds inside it.
if (( regen == 1 )); then regenerate; fi
head=$(git_read rev-parse HEAD)
rule=--regenerated
[[ -z $outside ]] || rule=--patch-equal
proof=$(python3 -B "$here/rebase-proof.py" "$rule" --head "$head" "$wt" "$old" "$acc" "$new") \
  || refuse "the rebase proof ($rule) failed: $proof"
# With the receipts union, the record step's --verify on the rebased tree, through the launcher t3-reviews.md gives.
if (( union == 1 )); then
  (( regen == 1 )) || pnpm install --offline > /dev/null 2>&1 || refuse "pnpm install --offline failed"
  node scripts/catalog/start-without-tsx-cache.mjs scripts/catalog-record-review.ts --verify --root "$wt" >&2 \
    || refuse "the record step's --verify failed on the rebased tree"
fi
# verifyCheck is this run's record for root when the chain ran; the gate re-proves rebaseProof and runs its own suite,
# and never reads it.
result=$(python3 -B -c 'import json, sys; result = json.loads(sys.argv[1])
if sys.argv[3] == "1": result["verifyCheck"] = dict(command="pnpm -s catalog:launch-inventory --verify --write", commit=sys.argv[2], passed=True)
print(json.dumps(result))' "$proof" "$head" "$regen") || refuse "the run's result could not be assembled"
rm -rf -- "$scratch" || refuse "the scratch files could not be removed"
# The last state-changing step: the branch moves to HEAD and WT goes back onto it. conclude reads where the branch
# is: a switch that failed before moving it is a refusal, one that failed after (a post-checkout hook) exits 5.
( git_read switch -q -C "$branch" ) || exit 2
exit 0
