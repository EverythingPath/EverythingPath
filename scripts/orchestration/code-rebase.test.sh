#!/usr/bin/env bash
# code-rebase.sh against a synthetic repository whose verification projection a stub generator writes (bound
# inputs a.txt, b.txt and s.txt; one row, which gains `y` only when both a.txt and b.txt say MARK). Fixture
# contracts only: the real generator chain is the catalog's.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/code-rebase-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
projection=scripts/catalog/scopes/campaign-mvp-v1.verification.json
regen_message='Regenerate the verification projection on the new base (code-regen-v1)'
mkdir "$root/bin"
cat > "$root/bin/generate.py" << 'PY'
import hashlib, json, os, sys
from pathlib import Path
path = Path('scripts/catalog/scopes/campaign-mvp-v1.verification.json')
inputs = {name: hashlib.sha256(Path(name).read_bytes()).hexdigest() for name in ('a.txt', 'b.txt', 's.txt') if Path(name).exists()}
both = all('MARK' in Path(name).read_text() for name in ('a.txt', 'b.txt'))
text = json.dumps(dict(version=1, scopeVersion='campaign-mvp-v1', binding=dict(inputs=inputs),
                       rows=[dict(key='pf1/a', verified=['x', 'y'] if both else ['x'])]), indent=2) + '\n'
# GENERATE_FAIL=write fails the writer; GENERATE_KEEP=1 writes nothing and checks nothing; GENERATE_STRAY=write|check
# writes stray.txt from the writer or from the final checker.
if os.environ.get('GENERATE_STRAY') == sys.argv[1]:
    Path('stray.txt').write_text('stray\n')
if os.environ.get('GENERATE_FAIL') == sys.argv[1]:
    sys.exit(1)
if os.environ.get('GENERATE_KEEP'):
    sys.exit(0)
if sys.argv[1] == 'write':
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
else:
    sys.exit(0 if path.exists() and path.read_text() == text else 1)
PY
cat > "$root/bin/pnpm" << STUB
#!/usr/bin/env bash
echo "\$*" >> "$root/pnpm.log"
case "\$*" in
  'install --offline') exit 0 ;;
  '-s catalog:launch-inventory --check') exit 0 ;;
  '-s catalog:launch-inventory --verify --write') exec python3 -B "$root/bin/generate.py" write ;;
  '-s catalog:launch-inventory --verify --check') exec python3 -B "$root/bin/generate.py" check ;;
esac
echo "unexpected pnpm \$*" >&2; exit 1
STUB
chmod +x "$root/bin/pnpm"
export PATH=$root/bin:$PATH
pass() { echo "ok    $1"; }
fail() { echo "FAIL  $1" >&2; exit 1; }
put() { local repo=$1; shift; while (( $# )); do printf '%s\n' "$2" > "$repo/$1"; git -C "$repo" add -- "$1"; shift 2; done; }
regen() { (cd "$1" && python3 -B "$root/bin/generate.py" write) && git -C "$1" add -- "$projection"; }
commit() { git -C "$1" commit -qm "$2"; }

# fixture <name> <slice's a.txt> [upstream path text]...: main on feature at the old base (a.txt, b.txt and the
# projection); the slice's worktree wt on t3/slice with four commits (a.txt; s.txt with the projection; a.txt
# again; the projection alone), accepted; then feature moves b.txt (and the upstream files) and regenerates.
fixture() {
  local d=$root/$1 slice_a=$2; shift 2
  m=$d/main wt=$d/wt
  mkdir -p "$m"
  git -C "$m" init -qb feature
  git -C "$m" config user.name Fixture; git -C "$m" config user.email fixture@example.test
  put "$m" a.txt a1 b.txt b1; regen "$m"; commit "$m" 'old base with a projection'
  old=$(git -C "$m" rev-parse HEAD)
  git -C "$m" worktree add -qb t3/slice "$wt"
  put "$wt" a.txt "$slice_a"; commit "$wt" 'slice edits a'
  put "$wt" s.txt slice; regen "$wt"; commit "$wt" 'add s and regenerate'
  put "$wt" a.txt "$slice_a again"; commit "$wt" 'slice edits a again'
  regen "$wt"; commit "$wt" 'regenerate the projection'
  acc=$(git -C "$wt" rev-parse HEAD)
  put "$m" b.txt "${upstream_b:-b2}" "$@"; regen "$m"; commit "$m" 'upstream edits b'
  new=$(git -C "$m" rev-parse HEAD)
}
run() { status=0; bash "$here/code-rebase.sh" "$wt" "$old" "$acc" "$new" > "$root/out" 2> "$root/err" || status=$?; }
unchanged() {
  [[ $(git -C "$wt" symbolic-ref --short HEAD) == t3/slice && $(git -C "$wt" rev-parse HEAD) == "$acc" \
     && -z $(git -C "$wt" status --porcelain=v1 --untracked-files=all) ]] || fail "$1: the branch or worktree moved"
}

# A projection-only overlap rebases, regenerates and proves, and the gate accepts the proof.
fixture pass a2
run
(( status == 0 )) || { cat "$root/err" >&2; fail "projection-only overlap exited $status"; }
head=$(git -C "$wt" rev-parse HEAD)
[[ $(git -C "$wt" symbolic-ref --short HEAD) == t3/slice && $(git -C "$wt" rev-parse HEAD^^^^) == "$new" ]] || fail "the branch is not the replay on NEW"
[[ $(git -C "$wt" log --format=%s "$new..HEAD" | paste -sd '|') == "$regen_message|slice edits a again|add s and regenerate|slice edits a" ]] \
  || fail "the replayed messages or the regeneration commit differ"
[[ $(git -C "$wt" diff-tree -r --name-only --no-commit-id HEAD) == "$projection" ]] || fail "the regeneration commit changes more than the projection"
grep -q "dropped ${acc:0:12}, which changes only regenerated artifacts" "$root/err" || fail "the projection-only commit was not dropped"
pass "a projection-only overlap rebases with the projection set aside and regenerates it as one final commit"
python3 -B - "$here" "$wt" "$old" "$acc" "$new" "$head" "$root/out" << 'PY' || fail "the gate refuses the printed proof"
import json, sys
sys.path.insert(0, sys.argv[1])
import gate_core
wt, old, acc, new, head, out = sys.argv[2:]
result = json.loads(open(out).read().splitlines()[-1])
proof = result['rebaseProof']
assert result['verdict'] == 'PASS' and proof['oldBase'] == old and proof['accepted'] == acc, result
assert result['verifyCheck'] == dict(command='pnpm -s catalog:launch-inventory --verify --check', commit=head, passed=True), result
assert proof['regen'] == dict(rule=gate_core.REGEN_RULE, paths=sorted(gate_core.REGEN_PATHS),
                              chain=gate_core.REGEN_CHAIN), proof
scope = gate_core.rebase_scope(dict(WT=wt, BASE=new, REVIEWED=head), dict(kind='code', rebaseProof=proof))
assert scope == (acc, proof['acceptedTree']), scope
PY
pass "the printed rebaseProof (regen: rule, paths, chain) passes the gate's re-proof"
[[ $(grep -c . "$root/pnpm.log") == 4 && $(tail -n 4 "$root/pnpm.log" | paste -sd '|') == 'install --offline|-s catalog:launch-inventory --check|-s catalog:launch-inventory --verify --write|-s catalog:launch-inventory --verify --check' ]] \
  || fail "the generator chain differs: $(paste -sd '|' "$root/pnpm.log")"
pass "the generator chain runs install, --check, --verify --write and --verify --check"

# Any overlap outside the regenerated artifacts refuses before anything moves.
fixture other a2 s.txt upstream
run
(( status == 2 )) && grep -q '^code-rebase: overlap outside the regenerated artifacts, so a worker rebase and a review: s.txt$' "$root/err" \
  || fail "a non-generated overlap was not refused ($status): $(cat "$root/err")"
unchanged "a non-generated overlap"
pass "an overlap outside the regenerated artifacts refuses and leaves the slice as it was"

# A regeneration that changes rows, not only bindings, refuses: each side alone keeps the row, together they change it.
upstream_b='b2 MARK' fixture rows 'a2 MARK'
run
(( status == 2 )) && grep -qF 'the regeneration changes rows of '"$projection"' (or its fixed bindings), not only bindings' "$root/err" \
  || fail "a row-changing regeneration was not refused ($status): $(cat "$root/err")"
unchanged "a row-changing regeneration"
pass "a regeneration that changes rows refuses, so a reviewer sees it, and leaves the slice as it was"

# No overlap: the mechanical proof's case.
fixture none a2
git -C "$m" reset -q --hard "$old"; put "$m" c.txt unrelated; commit "$m" 'unrelated upstream change'; new=$(git -C "$m" rev-parse HEAD)
run
(( status == 3 )) && grep -q 'no overlap with the base movement: rebase linearly and prove it with rebase-proof.py' "$root/err" || fail "no overlap exited $status"
unchanged "no overlap"
pass "no overlap leaves the rebase to git rebase and rebase-proof.py (exit 3)"

# A generator that writes another path refuses.
# A generator that writes another path refuses, whichever command of the chain writes it.
for when in write check; do
  fixture "stray-$when" a2
  GENERATE_STRAY=$when run
  (( status == 2 )) && grep -q 'the generator changed other paths: stray.txt' "$root/err" || fail "a stray write from the $when step was not refused ($status)"
  unchanged "a stray write from the $when step"
done
pass "a generator that changes another path refuses, the final --verify --check included"

# A failing generator, and one that leaves the base's projection as it was, refuse.
fixture failing a2
GENERATE_FAIL=write run
(( status == 2 )) && grep -q '^code-rebase: catalog:launch-inventory --verify --write failed$' "$root/err" || fail "a failing generator was not refused ($status)"
unchanged "a failing generator"
fixture kept a2
GENERATE_KEEP=1 run
(( status == 2 )) && grep -q "the regeneration left the base's artifacts unchanged" "$root/err" || fail "an unchanged regeneration was not refused ($status)"
unchanged "an unchanged regeneration"
pass "a failing generator and an unchanged regeneration refuse"

# A replay conflict outside the projection refuses: the slice edits x.txt and reverts it, so x.txt is outside the
# net overlap, but the base edits x.txt too, so replaying the edit conflicts.
fixture conflict a2 x.txt upstream
git -C "$m" reset -q --hard "$old"; put "$m" x.txt x1; regen "$m"; commit "$m" 'old base with x'; old=$(git -C "$m" rev-parse HEAD)
git -C "$wt" reset -q --hard "$old"
put "$wt" x.txt slice-x; commit "$wt" 'slice edits x'
put "$wt" x.txt x1; put "$wt" a.txt a2; regen "$wt"; commit "$wt" 'slice reverts x and edits a'
acc=$(git -C "$wt" rev-parse HEAD)
put "$m" x.txt upstream-x b.txt b2; regen "$m"; commit "$m" 'upstream edits x and b'; new=$(git -C "$m" rev-parse HEAD)
run
(( status == 2 )) && grep -q "^code-rebase: replaying $(git -C "$wt" rev-parse HEAD^) conflicts outside the regenerated artifacts: x.txt$" "$root/err" \
  || fail "a replay conflict outside the projection was not refused ($status): $(cat "$root/err")"
unchanged "a replay conflict outside the projection"
pass "a replay conflict outside the projection refuses and leaves the slice as it was"

# Input refusals.
fixture inputs a2
echo dirty > "$wt/untracked"
run
(( status == 1 )) && grep -q 'clean worktree' "$root/err" || fail "a dirty worktree was not refused"
rm "$wt/untracked"
status=0; bash "$here/code-rebase.sh" "$wt" "${old:0:12}" "$acc" "$new" 2> "$root/err" || status=$?
(( status == 64 )) || fail "a short SHA was not refused"
status=0; bash "$here/code-rebase.sh" "$wt" "$old" "$new" "$new" 2> "$root/err" || status=$?
(( status == 1 )) && grep -q "HEAD is not ACC" "$root/err" || fail "a HEAD other than ACC was not refused"
unchanged "an input refusal"
pass "a dirty worktree, a short SHA and a HEAD other than ACC refuse"

# The regenerated artifacts are generated launch artifacts prep regenerates.
python3 -B -c "import sys; sys.path.insert(0, sys.argv[1]); import gate_core; print('\n'.join(gate_core.REGEN_PATHS))" "$here" | while read -r path; do
  [[ " ${prep_regen_files[*]} " == *" $path "* ]] || fail "$path is not in prep-lib.sh's prep_regen_files"
done
pass "gate_core.REGEN_PATHS is a subset of prep_regen_files"
