#!/usr/bin/env bash
# code-rebase.sh against a synthetic repository whose generated launch artifacts a stub chain writes. The
# projection binds a.txt, b.txt and s.txt; its one row gains `y` only when both a.txt and b.txt say MARK. A
# curation fixture also holds the two keyed attribution files and the manifest, overview and pin, each derived from
# the files before it (the manifest's one binding from a.txt, b.txt and the assessments, a stand-in for what the
# catalog's binds), with no notice authority and no authority among them (fixture contracts only: the real generator
# chain is the catalog's).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/code-rebase-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
projection=scripts/catalog/scopes/campaign-mvp-v1.verification.json
assessments=src/lib/catalog/data/attribution-assessments.json
evidence=src/lib/catalog/data/attribution-evidence.json
pin=tests/catalog/launch-document.test.ts
regen_message='Regenerate the generated launch artifacts on the new base (code-regen-v2)'
mkdir "$root/bin"
cat > "$root/bin/generate.py" << 'PY'
import hashlib, json, os, subprocess, sys
from pathlib import Path
S = 'scripts/catalog/scopes/'
projection, manifest = (Path(S + 'campaign-mvp-v1' + name + '.json') for name in ('.verification', ''))
assessments, evidence = Path('src/lib/catalog/data/attribution-assessments.json'), Path('src/lib/catalog/data/attribution-evidence.json')
overview, pin = Path('docs/catalog-import/campaign-mvp-inventory.md'), Path('tests/catalog/launch-document.test.ts')
START, END = '  expect(JSON.parse(output)).toEqual({', '  });'
curation = assessments.exists()
def sha(*paths): return hashlib.sha256(b''.join(Path(path).read_bytes() for path in paths)).hexdigest()
def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')
def projected():
    names = ['a.txt', 'b.txt', 's.txt'] + ([str(assessments), str(evidence)] if curation else [])
    inputs = {name: sha(name) for name in names if Path(name).exists()}
    gate = dict(extractionFingerprint='e' * 64, **(dict(reviewedInputsFingerprint=sha(assessments, evidence)) if curation else {}))
    both = all('MARK' in Path(name).read_text() for name in ('a.txt', 'b.txt'))
    return json.dumps(dict(version=1, scopeVersion='campaign-mvp-v1', binding=dict(gate=gate, inputs=inputs),
                           rows=[dict(key='pf1/a', verified=['x', 'y'] if both else ['x'])]), indent=2) + '\n'
def git_show(commit, path):
    return subprocess.run(['git', 'show', commit + ':' + path], capture_output=True, text=True, check=True).stdout.split('\n')
command = sys.argv[1]
# GENERATE_FAIL=write fails the projection's writer; GENERATE_KEEP=1 writes nothing and checks nothing;
# GENERATE_STRAY=write|inventory-check|matches-check writes stray.txt from the projection's writer or from one of the chain's
# final checks.
if os.environ.get('GENERATE_STRAY') == command:
    Path('stray.txt').write_text('stray\n')
if os.environ.get('GENERATE_FAIL') == command:
    sys.exit(1)
if os.environ.get('GENERATE_KEEP') or (not curation and command in ('inventory', 'pin')):
    sys.exit(0)
if command == 'write':
    projection.parent.mkdir(parents=True, exist_ok=True)
    projection.write_text(projected())
elif command == 'check':
    sys.exit(0 if projection.exists() and projection.read_text() == projected() else 1)
elif command in ('inventory-check', 'matches-check'):
    sys.exit(0)
elif command == 'inventory':
    dump(manifest, dict(value=dict(roots=['pf1/a'], authoritySha256=sha('a.txt', 'b.txt', assessments))))
    overview.parent.mkdir(parents=True, exist_ok=True)
    overview.write_text('# Campaign MVP inventory\n\nScope: campaign-mvp-v1; identity: sha256:%s.\nRows: 1.\n' % sha(manifest))
    print(json.dumps(dict(version='campaign-mvp-v1', identity='sha256:' + sha(manifest), rows=1)))
elif command == 'pin':
    # pin SUMMARY [OLD ACC]: the worktree's pin file, with ACC's comment lines over OLD's added above the pin once.
    summary = json.loads(Path(sys.argv[2]).read_text())
    lines = pin.read_text().split('\n')
    start = lines.index(START); end = lines.index(END, start)
    head = lines[:start]
    if len(sys.argv) == 5:
        before, after = (git_show(commit, str(pin)) for commit in sys.argv[3:])
        added = after[:after.index(START)][before.index(START):]
        head = head if not added or head[-len(added):] == added else head + added
    values = ['    version: %s,' % json.dumps(summary['version']), '    identity:', '      %s,' % json.dumps(summary['identity']),
              '    rows: %d,' % summary['rows']]
    pin.write_text('\n'.join(head + [START] + values + lines[end:]))
elif command == 'merge':
    # merge PATH BASE OURS THEIRS: catalog:merge's keyed three-way union; a key both sides changed differently fails.
    target, sides = Path(sys.argv[2]), [json.loads(Path(path).read_text()) for path in sys.argv[3:]]
    listed = target == assessments
    keyed = [{entry['externalKey']: entry for entry in side} if listed else side['evidence'] for side in sides]
    union = {}
    for key in sorted(set().union(*keyed)):
        before, ours, theirs = (side.get(key) for side in keyed)
        if theirs == before: value = ours
        elif ours in (before, theirs): value = theirs
        else: sys.exit('conflict ' + key)
        if value is not None: union[key] = value
    dump(target, list(union.values()) if listed else dict(evidence=union, shared={}))
PY
cat > "$root/bin/pnpm" << STUB
#!/usr/bin/env bash
echo "\$*" | sed -E 's#^-s exec tsx [^ ]*/prep-regen.ts#prep-regen.ts#' >> "$root/pnpm.log"
generate() { exec python3 -B "$root/bin/generate.py" "\$@"; }
case "\$*" in
  'install --offline') [[ -z \${PNPM_INSTALL_FAIL:-} ]] || exit 1; exit 0 ;;
  '-s catalog:launch-inventory --check') generate inventory-check ;;
  '-s catalog:attribution-227-matches --check') generate matches-check ;;
  '-s catalog:launch-inventory --write') generate inventory ;;
  '-s catalog:launch-inventory --verify --write') generate write ;;
  '-s exec tsx '*'/prep-regen.ts pin '*) generate pin "\$6" "\$7" "\$8" ;;
  '-s catalog:merge '*) generate merge "\$3" "\$5" "\$7" "\$9" ;;
esac
echo "unexpected pnpm \$*" >&2; exit 1
STUB
chmod +x "$root/bin/pnpm"
# The record step's --verify, as the launcher runs it, is stubbed by its report-copy check (findReceiptProblems'): each
# receipt's copy in review-reports/ has its reportSha256 and no runId is recorded twice; VERIFY_FAIL=1 fails it. Every
# other node call (gate_core's run of the record step's writer) goes to the real node.
cat > "$root/bin/verify.py" << 'VERIFY'
import hashlib, json, sys
from pathlib import Path
root = Path(sys.argv[1])
receipts = json.loads((root / 'scripts/catalog/review-receipts.json').read_text())['receipts']
ids = [entry['runId'] for entry in receipts]
problems = ['Review %s is recorded twice.' % run for run in sorted(set(ids)) if ids.count(run) > 1]
for entry in receipts:
    copy = root / 'scripts/catalog/review-reports' / (entry['runId'] + '.md')
    if not copy.is_file() or hashlib.sha256(copy.read_bytes()).hexdigest() != entry['reportSha256']:
        problems.append('Review %s has no matching report copy.' % entry['runId'])
print('\n'.join('FAIL ' + problem for problem in problems) if problems else '%d receipts verified.' % len(receipts))
sys.exit(1 if problems else 0)
VERIFY
cat > "$root/bin/node" << STUB
#!/usr/bin/env bash
if [[ "\$1 \$2 \$3 \$4" == 'scripts/catalog/start-without-tsx-cache.mjs scripts/catalog-record-review.ts --verify --root' && \$# == 5 ]]; then
  echo "verify \$5 in \$PWD" >> "$root/verify.log"
  [[ -z \${VERIFY_FAIL:-} ]] || { echo 'FAIL stubbed'; exit 1; }
  exec python3 -B "$root/bin/verify.py" "\$5"
fi
exec "$(command -v node)" "\$@"
STUB
chmod +x "$root/bin/node"
export PATH=$root/bin:$PATH
pass() { echo "ok    $1"; }
fail() { echo "FAIL  $1" >&2; exit 1; }
put() { local repo=$1; shift; while (( $# )); do mkdir -p "$(dirname "$repo/$1")"; printf '%s\n' "$2" > "$repo/$1"; git -C "$repo" add -- "$1"; shift 2; done; }
# regen <repo>: the slice's or the base's own regeneration, as a worker runs it (the pin keeps the file's comments).
regen() {
  (cd "$1" && for step in inventory write; do python3 -B "$root/bin/generate.py" "$step" > "$root/summary.json"
                                                     [[ $step != inventory ]] || cp "$root/summary.json" "$root/inventory.json"; done
           [[ ! -e $pin ]] || python3 -B "$root/bin/generate.py" pin "$root/inventory.json")
  local path
  for path in "$projection" scripts/catalog/scopes/campaign-mvp-v1.json docs/catalog-import/campaign-mvp-inventory.md "$pin"; do
    [[ ! -e $1/$path ]] || git -C "$1" add -- "$path"
  done
}
commit() { git -C "$1" commit -qm "$2"; }
assess() { printf '[\n  {"externalKey": "k/base", "rationale": "%s"},\n  {"externalKey": "k/slice", "rationale": "%s"}\n]\n' "$1" "$2"; }
evidence_of() { printf '{"evidence": {"e/base": {"content": "%s"}, "e/slice": {"content": "%s"}}, "shared": {}}\n' "$1" "$2"; }
pin_file() {
  printf '%s\n' "it('pins the CLI', () => {" '  // The old base pins the inventory.' '  expect(JSON.parse(output)).toEqual({' \
    "    version: \"campaign-mvp-v1\"," '    identity:' "      \"sha256:$(printf '0%.0s' {1..64})\"," '    rows: 1,' '  });' '});'
}

# fixture <name> <slice's a.txt> [upstream path text]...: main on feature at the old base (a.txt, b.txt, the
# old_extra files and the projection); the slice's worktree wt on t3/slice with four commits (a.txt and the
# slice_extra files; s.txt with the projection; a.txt again; the projection alone), accepted; then feature moves
# b.txt (and the upstream files) and regenerates.
old_extra=() slice_extra=()
fixture() {
  local d=$root/$1 slice_a=$2; shift 2
  m=$d/main wt=$d/wt
  mkdir -p "$m"
  git -C "$m" init -qb feature
  git -C "$m" config user.name Fixture; git -C "$m" config user.email fixture@example.test
  put "$m" a.txt a1 b.txt b1 "${old_extra[@]}"; regen "$m"; commit "$m" 'old base with a projection'
  old=$(git -C "$m" rev-parse HEAD)
  git -C "$m" worktree add -qb t3/slice "$wt"
  put "$wt" a.txt "$slice_a" "${slice_extra[@]}"; commit "$wt" 'slice edits a'
  put "$wt" s.txt slice; regen "$wt"; commit "$wt" 'add s and regenerate'
  put "$wt" a.txt "$slice_a again"; commit "$wt" 'slice edits a again'
  regen "$wt"; commit "$wt" 'regenerate the projection'
  acc=$(git -C "$wt" rev-parse HEAD)
  put "$m" b.txt "${upstream_b:-b2}" "$@"; regen "$m"; commit "$m" 'upstream edits b'
  new=$(git -C "$m" rev-parse HEAD)
}

upstream_extra=()
# curation_fixture <name> <base's k/base rationale>: as readings-fix had it (with old_extra, slice_extra and
# upstream_extra added to the old base, the slice and the base movement). The old base holds both keyed files and
# every generated artifact; the slice rewords k/slice and e/slice and adds a comment above the pin; the base moves
# b.txt, rewords k/base (as given) and e/base and adds its own comment above the pin. Each regenerates its own.
curation_fixture() {
  local d=$root/$1 base_rationale=$2
  m=$d/main wt=$d/wt
  mkdir -p "$m"
  git -C "$m" init -qb feature
  git -C "$m" config user.name Fixture; git -C "$m" config user.email fixture@example.test
  put "$m" a.txt a1 b.txt b1 "$assessments" "$(assess r1 s1)" "$evidence" "$(evidence_of eb1 es1)" "$pin" "$(pin_file)" "${old_extra[@]}"
  regen "$m"; commit "$m" 'old base with every generated artifact'
  old=$(git -C "$m" rev-parse HEAD)
  git -C "$m" worktree add -qb t3/slice "$wt"
  put "$wt" a.txt a2 "$assessments" "$(assess r1 s2)" "$evidence" "$(evidence_of eb1 es2)" "${slice_extra[@]}"
  sed -i 's#^  // The old base pins the inventory.$#&\n  // The slice rewords k/slice.#' "$wt/$pin"
  regen "$wt"; commit "$wt" 'slice rewords k/slice and regenerates'
  acc=$(git -C "$wt" rev-parse HEAD)
  put "$m" b.txt b2 "$assessments" "$(assess "$base_rationale" s1)" "$evidence" "$(evidence_of eb2 es1)" "${upstream_extra[@]}"
  sed -i 's#^  // The old base pins the inventory.$#&\n  // The base rewords k/base.#' "$m/$pin"
  regen "$m"; commit "$m" 'upstream rewords k/base and regenerates'
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
assert result['verifyCheck'] == dict(command='pnpm -s catalog:launch-inventory --verify --write', commit=head, passed=True), result
assert 'patchEqual' not in proof, proof
assert proof['regen'] == dict(rule=gate_core.REGEN_RULE, paths=['scripts/catalog/scopes/campaign-mvp-v1.verification.json'],
                              chain=gate_core.REGEN_CHAIN), proof
scope = gate_core.rebase_scope(dict(WT=wt, BASE=new, REVIEWED=head), dict(kind='code', rebaseProof=proof))
assert scope == (acc, proof['acceptedTree']), scope
PY
pass "the printed rebaseProof (regen: rule, paths, chain) passes the gate's re-proof"
chain() { sed -E "s#[^ ]*/launch-summary.json#SUMMARY#; s#$old#OLD#; s#$acc#ACC#; s#$new#NEW#g; s#[^ ]*/code-rebase/#SCRATCH/#g" "$root/pnpm.log" | paste -sd '|'; }
[[ $(chain) == 'install --offline|-s catalog:launch-inventory --write|-s catalog:launch-inventory --verify --write|prep-regen.ts pin SUMMARY OLD ACC|-s catalog:launch-inventory --check|-s catalog:attribution-227-matches --check' ]] \
  || fail "the generator chain differs: $(chain)"
pass "the generator chain runs prep-regen's order: install, --write, --verify --write, pin, --check, the scripted match's --check, and the builder once"

# A curation-generated overlap, as readings-fix had: both sides change the keyed attribution files (other keys), and
# so every generated artifact. It rebases, the keyed files are the union, the pin keeps both sides' comments, and the
# gate accepts the proof.
curation_fixture curation r2
: > "$root/pnpm.log"
run
(( status == 0 )) || { cat "$root/err" >&2; fail "a curation-generated overlap exited $status"; }
head=$(git -C "$wt" rev-parse HEAD)
[[ $(git -C "$wt" log --format=%s "$new..HEAD" | paste -sd '|') == "$regen_message|slice rewords k/slice and regenerates" ]] \
  || fail "the curation replay or its regeneration commit differ"
[[ $(chain) == "install --offline|-s catalog:merge $assessments --base SCRATCH/base --ours SCRATCH/ours --theirs SCRATCH/theirs|-s catalog:merge $evidence --base SCRATCH/base --ours SCRATCH/ours --theirs SCRATCH/theirs|-s catalog:launch-inventory --write|-s catalog:launch-inventory --verify --write|prep-regen.ts pin SUMMARY OLD ACC|-s catalog:launch-inventory --check|-s catalog:attribution-227-matches --check" ]] \
  || fail "the curation chain differs: $(chain)"
[[ $(git -C "$wt" show "HEAD:$assessments" | python3 -B -c 'import json, sys; print(" ".join(e["rationale"] for e in json.load(sys.stdin)))') == 'r2 s2' \
   && $(git -C "$wt" show "HEAD:$evidence" | python3 -B -c 'import json, sys; print(" ".join(e["content"] for e in json.load(sys.stdin)["evidence"].values()))') == 'eb2 es2' ]] \
  || fail "the keyed files are not the union of both sides"
[[ $(git -C "$wt" show "HEAD:$pin" | grep '^  //' | paste -sd '|') == '  // The old base pins the inventory.|  // The base rewords k/base.|  // The slice rewords k/slice.' ]] \
  || fail "the pin does not keep the base's comment and add the slice's: $(git -C "$wt" show "HEAD:$pin")"
[[ -z $(git -C "$wt" status --porcelain=v1 --untracked-files=all) && ! -e $(git -C "$wt" rev-parse --git-dir)/code-rebase ]] || fail "the curation run left scratch files"
python3 -B - "$here" "$wt" "$old" "$acc" "$new" "$head" "$root/out" << 'PY' || fail "the gate refuses the printed curation proof"
import json, sys
sys.path.insert(0, sys.argv[1])
import gate_core
wt, old, acc, new, head, out = sys.argv[2:]
proof = json.loads(open(out).read().splitlines()[-1])['rebaseProof']
assert proof['regen']['paths'] == sorted(gate_core.REGEN_PATHS), proof
assert gate_core.rebase_scope(dict(WT=wt, BASE=new, REVIEWED=head), dict(kind='code', rebaseProof=proof)) == (acc, proof['acceptedTree'])
PY
pass "a curation-generated overlap rebases with the keyed union and every artifact regenerated, and the gate accepts its proof"

# A keyed file both sides changed differently refuses before anything moves.
curation_fixture keyed r3
git -C "$wt" reset -q --hard "$old"
put "$wt" a.txt a2 "$assessments" "$(assess r9 s2)"; regen "$wt"; commit "$wt" 'slice rewords k/base too'; acc=$(git -C "$wt" rev-parse HEAD)
: > "$root/pnpm.log"
run
(( status == 2 )) && grep -qF "the reviewed slice and the base movement change $assessments entries differently: k/base" "$root/err" \
  && grep -q "^code-rebase: the slice's change to the regenerated artifacts is not regenerable$" "$root/err" && [[ ! -s $root/pnpm.log ]] \
  || fail "a keyed-file conflict was not refused before the chain ($status): $(cat "$root/err")"
unchanged "a keyed-file conflict"
pass "a keyed-file conflict refuses before anything moves"

# A slice that changes the pin beyond comment lines above it refuses before anything moves.
curation_fixture pinned r2
git -C "$wt" reset -q --hard "$old"
put "$wt" a.txt a2; regen "$wt"; sed -i 's#^    rows: 1,$#    rows: 2,#' "$wt/$pin"; git -C "$wt" add -- "$pin"; commit "$wt" 'slice repins rows'
acc=$(git -C "$wt" rev-parse HEAD)
run
(( status == 2 )) && grep -qF "the reviewed slice changes $pin beyond its pinned identity" "$root/err" || fail "a repinned value was not refused ($status): $(cat "$root/err")"
unchanged "a repinned value"
pass "a slice that changes a pinned value other than the identity refuses"

# An overlap outside the regenerated artifacts that Git does not merge (both sides add s.txt) refuses.
fixture other a2 s.txt upstream
run
(( status == 2 )) && grep -q "^code-rebase: replaying $(git -C "$wt" rev-parse "$acc~2") conflicts outside the regenerated artifacts: s.txt$" "$root/err" \
  || fail "a conflicting non-generated overlap was not refused ($status): $(cat "$root/err")"
unchanged "a conflicting non-generated overlap"
pass "an overlap outside the regenerated artifacts that Git conflicts on refuses and leaves the slice as it was"

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
for when in write inventory-check matches-check; do
  fixture "stray-$when" a2
  GENERATE_STRAY=$when run
  (( status == 2 )) && grep -q 'the generator changed other paths: stray.txt' "$root/err" || fail "a stray write from the $when step was not refused ($status)"
  unchanged "a stray write from the $when step"
done
pass "a generator that changes another path refuses, the chain's final check included"

# A failing generator, and one that leaves the base's projection as it was, refuse.
fixture failing a2
GENERATE_FAIL=write run
(( status == 2 )) && grep -q '^code-rebase: catalog:launch-inventory --verify --write failed$' "$root/err" || fail "a failing generator was not refused ($status)"
unchanged "a failing generator"
# A scripted match that a fresh generation does not reproduce (a hand repair whose binding.matchesSha256 was
# refreshed) refuses, though the projection's own check passed.
fixture stale-matches a2
GENERATE_FAIL=matches-check run
(( status == 2 )) && grep -q '^code-rebase: catalog:attribution-227-matches --check failed: the scripted match differs from a fresh generation$' "$root/err" \
  || fail "a scripted match unlike a fresh generation was not refused ($status)"
unchanged "a scripted match unlike a fresh generation"
fixture kept a2
GENERATE_KEEP=1 run
(( status == 2 )) && grep -q "the regeneration left the base's artifacts unchanged" "$root/err" || fail "an unchanged regeneration was not refused ($status)"
unchanged "an unchanged regeneration"
pass "a failing generator and an unchanged regeneration refuse"

# A failing keyed union refuses at the first keyed file, before the rest of the chain.
curation_fixture merge-fails r2
: > "$root/pnpm.log"
GENERATE_FAIL=merge run
(( status == 2 )) && grep -qF "code-rebase: catalog:merge of $assessments (the keyed union of OLD, NEW and ACC) failed" "$root/err" \
  && [[ $(chain) == "install --offline|-s catalog:merge $assessments --base SCRATCH/base --ours SCRATCH/ours --theirs SCRATCH/theirs" ]] \
  || fail "a failing keyed union was not refused at the first keyed file ($status): $(cat "$root/err"); chain $(chain)"
unchanged "a failing keyed union"
[[ ! -e $(git -C "$wt" rev-parse --git-dir)/code-rebase ]] || fail "a failing keyed union left scratch files"
pass "a failing keyed union refuses at the first keyed file and leaves the slice as it was"

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

# rebase-patch-equal: an overlap outside the regenerated artifacts that Git merges cleanly is replayed and proven
# patch-equal. doc=releases.md, the companion slice against the operator on 2026-11-13.
doc=docs/catalog-import/releases.md
numbered() { seq -f 'entry %g' 1 20 | sed -e '' "$@"; }
scripts_json() {
  python3 -B -c 'import sys
added = dict(arg.split("=") for arg in sys.argv[1:])
rows = []
for number in range(1, 13):
    rows.append("    \"s%d\": \"run %d\"" % (number, number))
    rows += ["    \"%s\": \"%s\"" % (name, name) for name, after in added.items() if after == str(number)]
print("{\n  \"scripts\": {\n" + ",\n".join(rows) + "\n  }\n}")' "$@"
}
# plain_fixture <name> <path> <old> <slice> <upstream>: no generated artifact anywhere. The old base holds PATH; the
# slice edits it, then adds x.txt; the base edits it and adds c.txt.
plain_fixture() {
  local d=$root/$1 path=$2
  m=$d/main wt=$d/wt
  mkdir -p "$m"
  git -C "$m" init -qb feature
  git -C "$m" config user.name Fixture; git -C "$m" config user.email fixture@example.test
  put "$m" "$path" "$3"; commit "$m" 'old base'; old=$(git -C "$m" rev-parse HEAD)
  git -C "$m" worktree add -qb t3/slice "$wt"
  put "$wt" "$path" "$4"; commit "$wt" "slice edits $path"
  put "$wt" x.txt slice; commit "$wt" 'slice adds x'
  acc=$(git -C "$wt" rev-parse HEAD)
  put "$m" "$path" "$5" c.txt upstream; commit "$m" "upstream edits $path"
  new=$(git -C "$m" rev-parse HEAD)
}
# patch_equal_passes <label> <paths> <regen paths>: exit 0, the branch moved, and the gate accepts the printed proof,
# patchEqual naming PATHS and regen REGEN_PATHS ('' for none: no chain ran and no verifyCheck).
patch_equal_passes() {
  (( status == 0 )) || { cat "$root/err" >&2; fail "$1 exited $status"; }
  [[ $(git -C "$wt" symbolic-ref --short HEAD) == t3/slice && $(git -C "$wt" rev-parse HEAD) != "$acc" ]] || fail "$1: the branch did not move"
  python3 -B - "$here" "$wt" "$old" "$acc" "$new" "$(git -C "$wt" rev-parse HEAD)" "$root/out" "$2" "$3" << 'PY' || fail "$1: the gate refuses the printed proof"
import json, sys
sys.path.insert(0, sys.argv[1])
import gate_core
wt, old, acc, new, head, out, paths, regen = sys.argv[2:]
result = json.loads(open(out).read().splitlines()[-1])
proof = result['rebaseProof']
assert result['verdict'] == 'PASS' and proof['patchEqual'] == dict(rule=gate_core.PATCH_RULE, paths=paths.split()), result
assert (proof.get('regen') or {}).get('paths', []) == regen.split() and ('verifyCheck' in result) == bool(regen), result
assert gate_core.rebase_scope(dict(WT=wt, BASE=new, REVIEWED=head), dict(kind='code', rebaseProof=proof)) == (acc, proof['acceptedTree'])
PY
}

plain_fixture document document "$(numbered)" "$(numbered -e '3a slice entry')" "$(numbered -e '15a base entry')"
: > "$root/pnpm.log"
run
patch_equal_passes "a document both sides added to" document ''
[[ $(git -C "$wt" show HEAD~1:document) == "$(numbered -e '3a slice entry' -e '15a base entry')" ]] || fail "the document is not both sides' entries"
[[ $(git -C "$wt" log --format=%s "$new..HEAD" | paste -sd '|') == 'slice adds x|slice edits document' ]] || fail "the replayed messages differ"
[[ ! -s $root/pnpm.log ]] && grep -q 'inside them: none, so no regeneration' "$root/err" || fail "the chain ran without an overlap in the regenerated artifacts"
pass "a document both sides added to (label-reasons, the companion slice) replays, proves patch-equal and runs no chain"

plain_fixture package package.json "$(scripts_json)" "$(scripts_json slice:op=2)" "$(scripts_json party:scope=10)"
run
patch_equal_passes "package.json scripts both sides added" package.json ''
[[ $(git -C "$wt" show HEAD:package.json) == "$(scripts_json slice:op=2 party:scope=10)" ]] || fail "package.json does not hold both scripts"
pass "package.json scripts both sides added (the cutover operator) replay and prove patch-equal"

old_extra=("$doc" "$(numbered)") slice_extra=("$doc" "$(numbered -e '3a slice entry')")
fixture doc-projection a2 "$doc" "$(numbered -e '15a base entry')"
old_extra=() slice_extra=()
: > "$root/pnpm.log"
run
patch_equal_passes "a document overlap plus the projection's bindings" "$doc" "$projection"
[[ $(git -C "$wt" log --format=%s "$new..HEAD" | paste -sd '|') == "$regen_message|slice edits a again|add s and regenerate|slice edits a" ]] \
  || fail "the replay with a document overlap or its regeneration commit differ"
[[ $(git -C "$wt" show "HEAD:$doc") == "$(numbered -e '3a slice entry' -e '15a base entry')" && -s $root/pnpm.log ]] \
  || fail "the document is not both sides' entries, or the chain did not run"
pass "a document overlap plus the projection's bindings replays, regenerates and proves patch-equal with regen"

plain_fixture adjacent document "$(numbered)" "$(numbered -e '10a slice entry')" "$(numbered -e '10a base entry')"
run
(( status == 2 )) && grep -q "^code-rebase: replaying $(git -C "$wt" rev-parse "$acc^") conflicts outside the regenerated artifacts: document$" "$root/err" \
  || fail "adjacent additions were not refused ($status): $(cat "$root/err")"
unchanged "adjacent additions"
pass "adjacent additions, which Git conflicts on, refuse and leave the slice as it was"

plain_fixture context document "$(numbered)" "$(numbered -e '5a slice entry')" "$(numbered -e 's/^entry 7$/entry 7, amended/')"
run
(( status == 2 )) && grep -qE "^code-rebase: the rebase proof \(--patch-equal\) failed: .*Patch-equal rebase proof: $(git -C "$wt" rev-parse "$acc^") replayed as [0-9a-f]{40} changes document differently \(patch-id\)" "$root/err" \
  || fail "a replayed commit whose context changed was not refused ($status): $(cat "$root/err")"
unchanged "a changed context"
pass "a commit whose patch changed in replay (Git merged it, but its context moved) refuses by its patch-id"

plain_fixture empty document "$(numbered)" "$(numbered -e '3a slice entry')" "$(numbered -e '3a slice entry' -e '15a base entry')"
run
(( status == 2 )) && grep -q "^code-rebase: replaying $(git -C "$wt" rev-parse "$acc^") leaves it empty: the base movement already holds its change$" "$root/err" \
  || fail "a commit the base already holds was not refused ($status): $(cat "$root/err")"
unchanged "a commit left empty"
pass "a commit the base movement already holds refuses rather than being dropped"

plain_fixture nonlinear document "$(numbered)" "$(numbered -e '3a slice entry')" "$(numbered -e '15a base entry')"
git -C "$wt" switch -qc side "$old"; put "$wt" y.txt side; commit "$wt" 'side branch'
git -C "$wt" switch -q t3/slice; git -C "$wt" merge -q --no-ff -m 'merge side' side; acc=$(git -C "$wt" rev-parse HEAD)
run
(( status == 1 )) && grep -q "is not linear" "$root/err" || fail "a non-linear chain was not refused ($status): $(cat "$root/err")"
unchanged "a non-linear chain"
pass "a non-linear chain refuses"

plain_fixture dirty document "$(numbered)" "$(numbered -e '3a slice entry')" "$(numbered -e '15a base entry')"
echo dirty >> "$wt/document"
run
(( status == 1 )) && grep -q 'clean worktree' "$root/err" || fail "a dirty worktree with a patch-equal overlap was not refused ($status)"
git -C "$wt" checkout -q -- document
unchanged "a dirty worktree"
pass "a dirty worktree refuses with an overlap outside the regenerated artifacts"

old_extra=("$doc" "$(numbered)") slice_extra=("$doc" "$(numbered -e '3a slice entry')") upstream_extra=("$doc" "$(numbered -e '15a base entry')")
curation_fixture keyed-doc r3
git -C "$wt" reset -q --hard "$old"
put "$wt" a.txt a2 "$assessments" "$(assess r9 s2)" "${slice_extra[@]}"; regen "$wt"; commit "$wt" 'slice rewords k/base too'; acc=$(git -C "$wt" rev-parse HEAD)
: > "$root/pnpm.log"
run
(( status == 2 )) && grep -qF "the reviewed slice and the base movement change $assessments entries differently: k/base" "$root/err" && [[ ! -s $root/pnpm.log ]] \
  || fail "a keyed-file conflict beside a document overlap was not refused before the chain ($status): $(cat "$root/err")"
unchanged "a keyed-file conflict beside a document overlap"
curation_fixture pinned-doc r2
git -C "$wt" reset -q --hard "$old"
put "$wt" a.txt a2 "${slice_extra[@]}"; regen "$wt"; sed -i 's#^    rows: 1,$#    rows: 2,#' "$wt/$pin"; git -C "$wt" add -- "$pin"; commit "$wt" 'slice repins rows'
acc=$(git -C "$wt" rev-parse HEAD)
run
(( status == 2 )) && grep -qF "the reviewed slice changes $pin beyond its pinned identity" "$root/err" \
  || fail "a slice changing a regenerated artifact's rows beside a document overlap was not refused ($status): $(cat "$root/err")"
unchanged "a row change beside a document overlap"
old_extra=() slice_extra=() upstream_extra=()
pass "beside a document overlap, a keyed file both sides changed differently and a slice that changes rows still refuse"

# moved_doc_only: the base movement is the old base plus a distant document entry, leaving the regenerated artifacts
# and their inputs alone, so the overlap is the document only.
moved_doc_only() { git -C "$m" reset -q --hard "$old"; put "$m" "$doc" "$(numbered -e '15a base entry')"; commit "$m" 'upstream adds a distant entry'; new=$(git -C "$m" rev-parse HEAD); }
# A slice that changes the projection's rows refuses though the base movement leaves the projection alone (spec r1 #1).
old_extra=(b.txt 'b1 MARK' "$doc" "$(numbered)") slice_extra=("$doc" "$(numbered -e '3a slice entry')")
fixture rows-outside 'a2 MARK'
moved_doc_only
: > "$root/pnpm.log"
run
(( status == 2 )) && grep -qF "the reviewed slice changes rows of $projection" "$root/err" \
  && grep -q "^code-rebase: the slice's change to the regenerated artifacts is not regenerable$" "$root/err" && [[ ! -s $root/pnpm.log ]] \
  || fail "a slice changing rows outside the overlap was not refused before anything moved ($status): $(cat "$root/err")"
unchanged "a row change outside the overlap"
pass "a slice that changes a regenerated artifact's rows refuses even when the overlap holds no regenerated artifact"

# A slice that changes only the projection's bindings, outside the overlap, is carried byte for byte: no chain runs.
old_extra=("$doc" "$(numbered)")
fixture bindings-outside a2
old_extra=() slice_extra=()
moved_doc_only
: > "$root/pnpm.log"
run
patch_equal_passes "a bindings-only change outside the overlap" "$doc" ''
[[ ! -s $root/pnpm.log && $(git -C "$wt" rev-parse "HEAD:$projection") == $(git -C "$wt" rev-parse "$acc:$projection") ]] \
  || fail "the slice's projection was not carried as it is, or the chain ran"
[[ $(git -C "$wt" log --format=%s "$new..HEAD" | paste -sd '|') == 'regenerate the projection|slice edits a again|add s and regenerate|slice edits a' ]] \
  || fail "the bindings-only replay dropped or reordered a commit"
grep -qF "the slice changes regenerated artifacts outside the overlap: $projection" "$root/err" || fail "the run did not say it checked the slice's regenerated artifacts"
pass "a slice that changes only a regenerated artifact's bindings outside the overlap is replayed byte for byte, with no chain"

# An empty reviewed commit is replayed as one, and a replay that loses it refuses by the count (spec r1 #2).
plain_fixture checkpoint document "$(numbered)" "$(numbered -e '3a slice entry')" "$(numbered -e '15a base entry')"
git -C "$wt" commit -q --allow-empty -m checkpoint; acc=$(git -C "$wt" rev-parse HEAD)
run
patch_equal_passes "a slice with an empty reviewed commit" document ''
[[ $(git -C "$wt" log --format=%s "$new..HEAD" | paste -sd '|') == 'checkpoint|slice adds x|slice edits document' ]] || fail "the empty reviewed commit was not replayed"
git -C "$wt" reset -q --hard "$acc"; git -C "$wt" rebase -q --no-keep-empty "$new"
status=0; python3 -B "$here/rebase-proof.py" --patch-equal "$wt" "$old" "$acc" "$new" > "$root/out" || status=$?
(( status == 1 )) && grep -qF 'Patch-equal rebase proof commit count differs: 3 kept vs 2 replayed' "$root/out" \
  || fail "a replay that lost the empty reviewed commit was not refused ($status): $(cat "$root/out")"
pass "an empty reviewed commit is replayed, and a rebase that drops it (git rebase --no-keep-empty) fails the proof"

# With regeneration, the commit whose only change is set aside is dropped, and an empty reviewed commit is kept.
old_extra=("$doc" "$(numbered)") slice_extra=("$doc" "$(numbered -e '3a slice entry')")
fixture checkpoint-regen a2 "$doc" "$(numbered -e '15a base entry')"
old_extra=() slice_extra=()
git -C "$wt" commit -q --allow-empty -m checkpoint; acc=$(git -C "$wt" rev-parse HEAD)
run
patch_equal_passes "a regenerating replay with an empty reviewed commit" "$doc" "$projection"
[[ $(git -C "$wt" log --format=%s "$new..HEAD" | paste -sd '|') == "$regen_message|checkpoint|slice edits a again|add s and regenerate|slice edits a" ]] \
  || fail "the regenerating replay did not keep exactly the empty reviewed commit and drop the projection-only one"
pass "with regeneration, only a commit that changes regenerated artifacts alone is dropped; an empty reviewed commit is kept"

# code-rebase-overlap: the overlap is every path any commit of OLD..ACC changes that OLD..NEW changes, so a path one
# commit changes and a later one restores is in it, though the slice's net diff leaves it alone (maxima-promote-1,
# 2026-11-21: host-audits.json, whose replay the regenerated proof refused by its commit delta).
# slice_sets <path> <text> [message]: one more slice commit setting PATH to TEXT, accepted.
slice_sets() { put "$wt" "$1" "$2"; commit "$wt" "${3:-slice restores $1}"; acc=$(git -C "$wt" rev-parse HEAD); }
old_extra=("$doc" "$(numbered)") slice_extra=("$doc" "$(numbered -e '3a slice entry')")
fixture restored-doc a2 "$doc" "$(numbered -e '15a base entry')"
old_extra=() slice_extra=()
slice_sets "$doc" "$(numbered)"
[[ -z $(git -C "$wt" diff --name-only "$old" "$acc" -- "$doc") ]] || fail "the restored document is in the slice's net diff"
run
patch_equal_passes "a document a commit changes and a later one restores, beside the projection" "$doc" "$projection"
grep -qF "overlap outside the regenerated artifacts: $doc; inside them: $projection" "$root/err" || fail "the run did not name the restored document as overlap"
[[ $(git -C "$wt" rev-parse "HEAD:$doc") == $(git -C "$wt" rev-parse "$new:$doc") ]] || fail "the result's document is not the base's"
[[ $(git -C "$wt" log --format=%s "$new..HEAD" | paste -sd '|') == "$regen_message|slice restores $doc|slice edits a again|add s and regenerate|slice edits a" ]] \
  || fail "the replay of the restored document or its regeneration commit differ"
pass "a file a commit changes and a later one restores, which the base changes, is overlap: patch-equal with regen, the base's file kept"

plain_fixture restored document "$(numbered)" "$(numbered -e '3a slice entry')" "$(numbered -e '15a base entry')"
slice_sets document "$(numbered)"
: > "$root/pnpm.log"
run
patch_equal_passes "a document a commit changes and a later one restores" document ''
[[ $(git -C "$wt" rev-parse HEAD:document) == $(git -C "$wt" rev-parse "$new:document") && ! -s $root/pnpm.log ]] \
  || fail "the result's document is not the base's, or the chain ran"
pass "without the projection, a restored file the base changes is overlap: patch-equal, no chain, the base's file kept"

plain_fixture kept-change document "$(numbered)" "$(numbered -e '3a slice entry')" "$(numbered -e '15a base entry')"
slice_sets document "$(numbered -e '3a slice entry, kept')" 'slice edits document again'
run
patch_equal_passes "a document a later commit changes again" document ''
[[ $(git -C "$wt" show HEAD:document) == "$(numbered -e '3a slice entry, kept' -e '15a base entry')" ]] || fail "the document is not both sides' entries"
pass "a file a later commit changes again without restoring it is net overlap, proven patch-equal as before"

plain_fixture restored-conflict document "$(numbered)" "$(numbered -e '3a slice entry')" "$(numbered -e '3a base entry')"
slice_sets document "$(numbered)"
run
(( status == 2 )) && grep -q "^code-rebase: replaying $(git -C "$wt" rev-parse "$acc~2") conflicts outside the regenerated artifacts: document$" "$root/err" \
  || fail "a restored file whose change conflicts with the base's was not refused ($status): $(cat "$root/err")"
unchanged "a restored file that conflicts"
pass "a restored file whose change Git conflicts on with the base's refuses and leaves the slice as it was"

# Standards and Spec r1 #1: the proof replays each commit. f holds two matching windows; the base edits the first,
# the slice edits it and later restores it. The script's cherry-pick refuses, with the projection and without; a hand
# replay (git rebase --apply) puts both patches on the second window, where they cancel, so every patch-id matches
# and f is the base's, but the proof refuses Git's replay of the first commit by name.
two_windows() { local w; for w in "$1" "$2"; do printf 'm\nc1\nc2\nc3\nx=%s\nc4\nc5\nc6\n' "$w"; done; printf 't'; }
old_extra=(f "$(two_windows 1 1)") slice_extra=(f "$(two_windows 2 1)")
fixture cancel-projection a2 f "$(two_windows 3 1)"
old_extra=() slice_extra=()
slice_sets f "$(two_windows 1 1)"
run
(( status == 2 )) && grep -q "^code-rebase: replaying $(git -C "$wt" rev-parse "$acc~4") conflicts outside the regenerated artifacts: f$" "$root/err" \
  || fail "the cancelling offset beside the projection was not refused ($status): $(cat "$root/err")"
unchanged "the cancelling offset beside the projection"
plain_fixture cancel f "$(two_windows 1 1)" "$(two_windows 2 1)" "$(two_windows 3 1)"
slice_sets f "$(two_windows 1 1)"
run
(( status == 2 )) && grep -q "^code-rebase: replaying $(git -C "$wt" rev-parse "$acc~2") conflicts outside the regenerated artifacts: f$" "$root/err" \
  || fail "the cancelling offset was not refused ($status): $(cat "$root/err")"
unchanged "the cancelling offset"
git -C "$wt" rebase -q --apply "$new"
[[ $(git -C "$wt" rev-parse HEAD:f) == $(git -C "$wt" rev-parse "$new:f") ]] || fail "the hand replay's f is not the base's"
status=0; python3 -B "$here/rebase-proof.py" --patch-equal "$wt" "$old" "$acc" "$new" > "$root/out" || status=$?
(( status == 1 )) && grep -qF "$(git -C "$wt" rev-parse "$acc~2") replayed as $(git -C "$wt" rev-parse HEAD~2): Git's replay of it conflicts at f" "$root/out" \
  || fail "the hand replay with cancelling offsets was not refused ($status): $(cat "$root/out")"
git -C "$wt" reset -q --hard "$acc"
pass "a slice edit and its restore that a hand replay puts at an offset, where they cancel, refuse: the proof replays each commit"

# A regenerated artifact a commit changes and a later one restores is overlap inside them: it is set aside in every
# commit and regenerated with the reviewed inputs on NEW, and the commits that change only it are dropped. Its
# replay cannot be carried byte for byte onto the base's moved artifact (the same cause), and only REVIEWED's
# artifacts are proven, never their state between commits. Before, this was no overlap (exit 3), and the mechanical
# proof then refused the commit delta. restored_projection <a.txt at the end>: the slice edits a.txt (and adds
# x.txt) and regenerates, then sets a.txt as given and restores the old base's projection.
restored_projection() {
  git -C "$wt" reset -q --hard "$old"
  put "$wt" a.txt a2 x.txt slice; regen "$wt"; commit "$wt" 'slice edits a and x and regenerates'
  put "$wt" a.txt "$1"; git -C "$wt" show "$old:$projection" > "$wt/$projection"; git -C "$wt" add -- "$projection"
  commit "$wt" 'slice restores the projection'; acc=$(git -C "$wt" rev-parse HEAD)
  [[ -z $(git -C "$wt" diff --name-only "$old" "$acc" -- "$projection") ]] || fail "the restored projection is in the slice's net diff"
}
fixture restored-projection a2
restored_projection a3
: > "$root/pnpm.log"
run
(( status == 0 )) || { cat "$root/err" >&2; fail "a restored projection exited $status"; }
[[ $(git -C "$wt" log --format=%s "$new..HEAD" | paste -sd '|') == "$regen_message|slice restores the projection|slice edits a and x and regenerates" && -s $root/pnpm.log ]] \
  || fail "the restored projection was not set aside and regenerated"
python3 -B - "$here" "$wt" "$acc" "$new" "$(git -C "$wt" rev-parse HEAD)" "$root/out" << 'PY' || fail "the gate refuses the restored projection's proof"
import json, sys
sys.path.insert(0, sys.argv[1])
import gate_core
wt, acc, new, head, out = sys.argv[2:]
proof = json.loads(open(out).read().splitlines()[-1])['rebaseProof']
assert 'patchEqual' not in proof and proof['regen']['paths'] == ['scripts/catalog/scopes/campaign-mvp-v1.verification.json'], proof
assert gate_core.rebase_scope(dict(WT=wt, BASE=new, REVIEWED=head), dict(kind='code', rebaseProof=proof)) == (acc, proof['acceptedTree'])
PY
pass "a regenerated artifact a commit changes and a later one restores is set aside and regenerated, and the gate accepts the proof"
# When the slice also restores every input the artifact binds, the regeneration leaves the base's artifacts as they
# are, and the regenerated proof needs a regeneration commit: it refuses, as any unchanged regeneration does, and
# the slice goes to a worker rebase.
fixture restored-unchanged a2
restored_projection a1
run
(( status == 2 )) && grep -q "the regeneration left the base's artifacts unchanged" "$root/err" || fail "a restored projection with nothing to regenerate was not refused ($status): $(cat "$root/err")"
unchanged "a restored projection with nothing to regenerate"
pass "a restored regenerated artifact whose regeneration changes nothing refuses and leaves the slice as it was"

# The other step 1 refusals the header lists: an env file in WT, an unmoved base and an unrelated base.
fixture preconditions a2
printf '.env.local\n' >> "$(git -C "$wt" rev-parse --git-common-dir)/info/exclude"; : > "$wt/.env.local"
run
(( status == 1 )) && grep -q 'env file present in WT' "$root/err" || fail "an env file in WT was not refused ($status): $(cat "$root/err")"
rm "$wt/.env.local"
status=0; bash "$here/code-rebase.sh" "$wt" "$old" "$acc" "$old" 2> "$root/err" || status=$?
(( status == 1 )) && grep -q 'the base has not moved' "$root/err" || fail "an unmoved base was not refused ($status)"
orphan=$(git -C "$m" commit-tree -m unrelated "$(git -C "$m" mktree < /dev/null)")
status=0; bash "$here/code-rebase.sh" "$wt" "$old" "$acc" "$orphan" 2> "$root/err" || status=$?
(( status == 1 )) && grep -q 'OLD is not an ancestor of NEW' "$root/err" || fail "an unrelated NEW was not refused ($status)"
put "$m" c.txt later; commit "$m" 'a later base'
status=0; bash "$here/code-rebase.sh" "$wt" "$new" "$acc" "$(git -C "$m" rev-parse HEAD)" 2> "$root/err" || status=$?
(( status == 1 )) && grep -q 'OLD is not an ancestor of ACC' "$root/err" || fail "an OLD the slice is not on was not refused ($status)"
unchanged "a precondition refusal"
pass "an env file in WT, an unmoved base and an unrelated base refuse before anything moves"

# The regenerated artifacts are generated launch artifacts prep regenerates, or data files it merges, and the chain
# runs prep's steps in prep's order after the keyed union. It runs the ones that write REGEN_PATHS: not prep's
# catalog:launch-legal-authority --write, the authority's Registry binding, which a code slice may not move (the
# authority's rows), nor prep's #227 scripted match and party scope, which are not REGEN_PATHS.
python3 -B -c "import sys; sys.path.insert(0, sys.argv[1]); import gate_core; print('\n'.join(gate_core.REGEN_PATHS))" "$here" | while read -r path; do
  [[ " ${prep_regen_files[*]} ${prep_data_files[*]} " == *" $path "* ]] || fail "$path is not in prep-lib.sh's prep_regen_files or prep_data_files"
done
python3 -B - "$here" "${prep_regen_steps[@]}" << 'PY' || fail "gate_core.REGEN_CHAIN does not run prep_regen_steps' launch steps in their order after the keyed union"
import sys
sys.path.insert(0, sys.argv[1])
import gate_core
prep = sys.argv[2:]
steps = gate_core.REGEN_CHAIN.split('; ')
start = next(i for i, step in enumerate(steps) if step.startswith('keyed union')) + 1
assert steps[-2:] == ['catalog:launch-inventory --check', 'catalog:attribution-227-matches --check'], steps
ours = steps[start:-2]
assert ours == ['catalog:launch-inventory --write', 'catalog:launch-inventory --verify --write',
                'launch-document pin (prep-regen.ts pin)'], ours
assert ours == [step for step in prep if step in ours] and set(ours) <= set(prep), (ours, prep)
assert ours[-1] == prep[-1] and 'catalog:launch-legal-authority --write' not in ours, (ours, prep)
keyed = [path for path, kind in gate_core.REGEN_PATHS.items() if isinstance(kind, gate_core.Keyed)]
assert list(gate_core.REGEN_PATHS)[:len(keyed)] == keyed, gate_core.REGEN_PATHS
PY
pass "gate_core.REGEN_PATHS is a subset of prep_regen_files and prep_data_files, and REGEN_CHAIN runs prep's launch steps in prep's order after the keyed union"

# Standards r10 #2: every call of the script's Python runner is checked before its output is used. A sitecustomize on
# PYTHONPATH breaks the one gate_core attribute a given runner call reads (CODE_REBASE_FAIL_CODE picks the call by its
# code, CODE_REBASE_FAIL_ATTR the attribute), so the runner refuses there; the script stops with exit 2, the branch
# unchanged.
mkdir -p "$root/inject"
cat > "$root/inject/sitecustomize.py" << 'PY'
import os, sys
picked = os.environ.get('CODE_REBASE_FAIL_CODE')
argv = getattr(sys, 'orig_argv', [])
if picked and '-c' in argv and picked in argv[argv.index('-c') + 1]:
    sys.path.insert(0, os.environ['CODE_REBASE_HERE'])
    import gate_core
    class Failing:
        def __iter__(self): raise RuntimeError('injected')
        def __str__(self): raise RuntimeError('injected')
    setattr(gate_core, os.environ['CODE_REBASE_FAIL_ATTR'], Failing())
PY
for site in 'sorted(gate_core.REGEN_PATHS)|REGEN_PATHS|the regenerated artifacts could not be listed' \
            'gate_core.Keyed|Keyed|the keyed files could not be listed' \
            'print(gate_core.REGEN_CHAIN)|REGEN_CHAIN|the regeneration chain could not be read' \
            'gate_core.REGEN_MESSAGE|REGEN_MESSAGE|the regeneration message could not be read'; do
  IFS='|' read -r code attr name <<< "$site"
  fixture "runner-${attr,,}" a2
  status=0
  PYTHONPATH=$root/inject CODE_REBASE_HERE=$here CODE_REBASE_FAIL_CODE=$code CODE_REBASE_FAIL_ATTR=$attr \
    bash "$here/code-rebase.sh" "$wt" "$old" "$acc" "$new" > "$root/out" 2> "$root/err" || status=$?
  (( status == 2 )) && grep -qF "code-rebase: $name" "$root/err" && grep -q '^Regenerated rebase proof: failed while' "$root/err" \
    || { cat "$root/err" >&2; fail "a runner refusal where $name exited $status"; }
  unchanged "a runner refusal where $name"
done
pass "a runner refusal at the artifact lists, the regeneration banner or the regeneration message stops the script with exit 2, the branch unchanged"

# Standards and Spec r11: every Git call of code-rebase.sh goes through git_read or git_test. A git shim on PATH fails
# the call whose arguments hold GIT_SHIM_MATCH with GIT_SHIM_STATUS (128 by default): a read helper's and a
# predicate's failure in each phase (precheck, replay, regeneration, proof) refuses with exit 2, the branch
# unchanged, and a predicate's 1 is still "no".
mkdir -p "$root/shim"
GIT_SHIM_REAL=$(command -v git)
export GIT_SHIM_REAL
# GIT_SHIM_MATCH holds one pattern, or several joined by '::'; a call matching any of them fails. With GIT_SHIM_ONCE
# naming a file, only the first matching call fails (it creates the file); later ones run.
cat > "$root/shim/git" << 'SHIM'
#!/usr/bin/env bash
if [[ -n ${GIT_SHIM_MATCH:-} && ! ( -n ${GIT_SHIM_ONCE:-} && -e $GIT_SHIM_ONCE ) ]]; then
  while IFS= read -r pattern; do
    if [[ -n $pattern && " $* " == *"$pattern"* ]]; then
      [[ -z ${GIT_SHIM_ONCE:-} ]] || : > "$GIT_SHIM_ONCE"
      echo "git shim: failing $*" >&2; exit "${GIT_SHIM_STATUS:-128}"
    fi
  done <<< "${GIT_SHIM_MATCH//::/$'\n'}"
fi
exec "$GIT_SHIM_REAL" "$@"
SHIM
chmod +x "$root/shim/git"
shimmed() { status=0; PATH=$root/shim:$PATH GIT_SHIM_MATCH=$1 GIT_SHIM_STATUS=${2:-128} bash "$here/code-rebase.sh" "$wt" "$old" "$acc" "$new" > "$root/out" 2> "$root/err" || status=$?; }
fixture shim a2
for site in "precheck read|rev-list --merges $old..$acc" "precheck predicate|merge-base --is-ancestor $old $new" \
            'replay read|diff --name-only --diff-filter=U' 'replay predicate|diff --cached --quiet HEAD' \
            'regeneration read| add -- ' "the final switch|switch -q -C t3/slice" \
            "proof predicate|merge-base --is-ancestor $new|HEAD does not descend from NEW_BASE"; do
  # The proof's own predicate (rebase-proof.py, git_holds) hides Git's stderr and refuses by name.
  IFS='|' read -r name match said <<< "$site"
  shimmed "$match"
  (( status == 2 )) && grep -q "${said:-git shim: failing}" "$root/err" || { cat "$root/err" >&2; fail "a failing Git call ($name) exited $status"; }
  unchanged "a failing Git call ($name)"
done
shimmed "merge-base --is-ancestor $old $new" 1
(( status == 1 )) && grep -q 'OLD is not an ancestor of NEW' "$root/err" || fail "a predicate's 1 is not its no ($status)"
unchanged "a predicate's no"
pass "a failing Git read or predicate in the precheck, the replay, the regeneration or the proof exits 2, the branch unchanged, and a predicate's 1 is its no"

# Standards and Spec r12 #2: an artifact lookup tells a path the tree lacks (an answer) from a tree it cannot read
# (exit 2): the replay's, and the keyed merge's on a curation overlap.
shimmed 'ls-tree --full-tree --name-only HEAD'
(( status == 2 )) && grep -q 'git shim: failing' "$root/err" || { cat "$root/err" >&2; fail "an unreadable tree in the replay's lookup exited $status"; }
unchanged "an unreadable tree in the replay's lookup"
curation_fixture shim-curation r2
shimmed "ls-tree --full-tree --name-only $old"
(( status == 2 )) && grep -q 'git shim: failing' "$root/err" || { cat "$root/err" >&2; fail "an unreadable tree in the keyed merge's lookup exited $status"; }
unchanged "an unreadable tree in the keyed merge's lookup"
pass "an artifact lookup that cannot read its tree refuses with exit 2 in the replay and the keyed merge, the branch unchanged"

# Standards and Spec r12 #1: with MAIN and EP_REPO unset, code-rebase.sh finds them through git_read before it
# sources paths.sh: a failing read refuses with exit 2; found, the run goes on.
fixture shim-sourced a2
for match in 'rev-parse --path-format=absolute --git-common-dir' 'rev-parse --show-toplevel' "rev-list --merges $old..$acc"; do
  status=0
  env -u MAIN -u EP_REPO PATH="$root/shim:$PATH" GIT_SHIM_MATCH="$match" bash "$here/code-rebase.sh" "$wt" "$old" "$acc" "$new" \
    > "$root/out" 2> "$root/err" || status=$?
  (( status == 2 )) && grep -q "git shim: failing.*$match" "$root/err" || { cat "$root/err" >&2; fail "with MAIN and EP_REPO unset, failing $match exited $status"; }
  unchanged "with MAIN and EP_REPO unset, failing $match"
done
pass "with MAIN and EP_REPO unset, a failing read of either refuses with exit 2, and found, the run goes on"

# Standards 2 and Spec r12 #3: a restore whose probe fails still puts WT back on the branch; a post-checkout hook
# that fails once the branch has moved leaves WT on the moved branch and exits 5, with no result line on stdout.
shimmed 'diff --name-only --diff-filter=U::rev-parse --verify -q CHERRY_PICK_HEAD'
(( status == 2 )) || { cat "$root/err" >&2; fail "a refusal whose restore probe fails exited $status"; }
unchanged "a refusal whose restore probe fails"
hooks=$(git -C "$m" rev-parse --path-format=absolute --git-common-dir)/hooks
mkdir -p "$hooks"
printf '#!/usr/bin/env bash
! git symbolic-ref -q HEAD > /dev/null
' > "$hooks/post-checkout"
chmod +x "$hooks/post-checkout"
run
rm -f "$hooks/post-checkout"
(( status == 5 )) || { cat "$root/err" >&2; fail "a post-checkout hook failing after the move exited $status"; }
[[ $(git -C "$wt" symbolic-ref --short HEAD) == t3/slice && $(git -C "$wt" rev-parse HEAD) != "$acc" ]] \
  && git -C "$wt" merge-base --is-ancestor "$new" HEAD && [[ -z $(git -C "$wt" status --porcelain=v1 --untracked-files=all) ]] \
  || fail "after a failing post-checkout hook WT is not on the moved branch"
# Root r16: the switch's failure is a failure after the move, so no result line is written.
[[ ! -s $root/out ]] || fail "the moved run whose switch failed wrote a result line"
grep -q 'moved to .*, but' "$root/err" || fail "the moved run did not say a step after the move failed"
pass "a failing restore probe still restores the branch, and a post-checkout hook failing after the move exits 5 with WT on the moved branch"

# Standards and Spec r12 #4: a failed offline install refuses with exit 2, as the header and the guide say.
fixture install-fails a2
status=0; PNPM_INSTALL_FAIL=1 bash "$here/code-rebase.sh" "$wt" "$old" "$acc" "$new" > "$root/out" 2> "$root/err" || status=$?
(( status == 2 )) && grep -q 'pnpm install --offline failed' "$root/err" || { cat "$root/err" >&2; fail "a failed offline install exited $status"; }
unchanged "a failed offline install"
pass "a failed offline install refuses with exit 2, the branch unchanged"

# Root r13: the script reports the branch only as it has read it. After a move, a tip read that fails, or a result
# line it cannot write, exits 5 and never says "unchanged"; a restore whose switch and symbolic-ref both fail says
# WT is detached, and where, and exits 5.
fixture conclude-tip a2
shimmed "rev-parse refs/heads/t3/slice"
(( status == 5 )) && grep -q "t3/slice's tip could not be read" "$root/err" && ! grep -q 'unchanged' "$root/err" \
  || { cat "$root/err" >&2; fail "a tip read failing after the move exited $status"; }
[[ $(git -C "$wt" rev-parse HEAD) != "$acc" && $(git -C "$wt" rev-parse t3/slice) == $(git -C "$wt" rev-parse HEAD) ]] \
  || fail "the run whose tip read failed did not move the branch"
pass "a tip read failing after the move exits 5 and reports the branch as unknown, not unchanged"
fixture conclude-write a2
status=0; bash "$here/code-rebase.sh" "$wt" "$old" "$acc" "$new" > /dev/full 2> "$root/err" || status=$?
(( status == 5 )) && grep -q 'the result could not be written' "$root/err" || { cat "$root/err" >&2; fail "a result write failing after the move exited $status"; }
[[ $(git -C "$wt" symbolic-ref --short HEAD) == t3/slice && $(git -C "$wt" rev-parse HEAD) != "$acc" ]] || fail "the run whose result write failed is not on the moved branch"
pass "a result write failing after the move exits 5 with WT on the moved branch"
fixture conclude-detached a2
shimmed 'diff --name-only --diff-filter=U::switch -q -f t3/slice::symbolic-ref HEAD refs/heads/t3/slice'
(( status == 5 )) && grep -q 'WT is detached at [0-9a-f]\{40\}' "$root/err" && grep -q "t3/slice is at $acc" "$root/err" \
  && grep -q "the run's last status before concluding was 2" "$root/err" \
  && ! grep -q 'unchanged' "$root/err" || { cat "$root/err" >&2; fail "a restore that cannot reattach WT exited $status"; }
[[ $(git -C "$wt" rev-parse t3/slice) == "$acc" ]] && ! git -C "$wt" symbolic-ref -q HEAD > /dev/null || fail "the failed restore's state is not as reported"
git -C "$wt" switch -q -f t3/slice
pass "a restore whose switch and symbolic-ref both fail says WT is detached, and where, and exits 5"

# Root r14: conclude decides by the end state it reads. WT's attachment unreadable is said as such (never "detached")
# and exits 5; after a refusal, WT on the branch at ACC is exit 2 however many restore attempts failed, WT unreadable
# exit 5; a closed stdout pipe after the move still exits 5, the report on stderr.
fixture conclude-unread a2
shimmed 'symbolic-ref --quiet HEAD'
(( status == 5 )) && grep -q "WT's state could not be read" "$root/err" && ! grep -q 'detached' "$root/err" \
  || { cat "$root/err" >&2; fail "an unreadable HEAD after the move exited $status"; }
[[ $(git -C "$wt" symbolic-ref --short HEAD) == t3/slice && $(git -C "$wt" rev-parse HEAD) != "$acc" ]] || fail "the run whose HEAD read failed did not move the branch"
pass "an unreadable HEAD after the move is reported as unreadable, not detached, and exits 5"
fixture conclude-attached a2
hooks=$(git -C "$m" rev-parse --path-format=absolute --git-common-dir)/hooks
mkdir -p "$hooks"
printf '#!/usr/bin/env bash\n! git symbolic-ref -q HEAD > /dev/null\n' > "$hooks/post-checkout"
chmod +x "$hooks/post-checkout"
shimmed 'diff --name-only --diff-filter=U::reset -q --hard'
rm -f "$hooks/post-checkout"
(( status == 2 )) && grep -q "t3/slice is unchanged at $acc" "$root/err" && grep -q 'switching back to t3/slice' "$root/err" \
  && grep -q 'attaching HEAD to t3/slice' "$root/err" || { cat "$root/err" >&2; fail "both restore attempts failing with WT on the branch at ACC exited $status"; }
unchanged "both restore attempts failing with WT on the branch at ACC"
shimmed 'diff --name-only --diff-filter=U::symbolic-ref --quiet HEAD'
(( status == 5 )) && grep -q "WT's state could not be read" "$root/err" && ! grep -q 'unchanged' "$root/err" \
  || { cat "$root/err" >&2; fail "a refusal whose end state cannot be read exited $status"; }
unchanged "a refusal whose end state cannot be read"
pass "after a refusal, WT on the branch at ACC exits 2 though both restore attempts failed, and an unreadable end state exits 5"
fixture conclude-pipe a2
{ status=0; bash "$here/code-rebase.sh" "$wt" "$old" "$acc" "$new" 2> "$root/err" || status=$?; echo "$status" > "$root/status"; } | true
(( $(cat "$root/status") == 5 )) && grep -q 'the result could not be written' "$root/err" && grep -q 't3/slice moved to' "$root/err" \
  || { cat "$root/err" >&2; fail "a closed stdout pipe after the move exited $(cat "$root/status")"; }
[[ $(git -C "$wt" symbolic-ref --short HEAD) == t3/slice && $(git -C "$wt" rev-parse HEAD) != "$acc" ]] || fail "the closed-pipe run is not on the moved branch"
pass "a closed stdout pipe after the move exits 5, the report on stderr"

# Root r15: conclude's exit is a constant per end state: WT on the branch at ACC is 2 whatever the run's last status
# (a stale file at the scratch path, status 1; a post-checkout hook that puts the tip back at ACC and succeeds,
# status 0, no result line); a clean move is 0; anything else 5, a tip at a third commit and HEAD on another ref
# included.
hooked() {
  local hooks
  hooks=$(git -C "$m" rev-parse --path-format=absolute --git-common-dir)/hooks
  mkdir -p "$hooks"
  printf '#!/usr/bin/env bash\n[[ $(git symbolic-ref -q HEAD) == refs/heads/t3/slice ]] || exit 0\n%s\n' "$1" > "$hooks/post-checkout"
  chmod +x "$hooks/post-checkout"
  shift
  "$@"
  rm -f "$hooks/post-checkout"
}
fixture end-scratch a2
printf 'stale\n' > "$(git -C "$wt" rev-parse --path-format=absolute --git-dir)/code-rebase"
run
(( status == 2 )) && grep -q "t3/slice is unchanged at $acc" "$root/err" || { cat "$root/err" >&2; fail "a stale file at the scratch path exited $status"; }
unchanged "a stale file at the scratch path"
fixture end-tip-back a2
hooked "git update-ref refs/heads/t3/slice $acc" run
(( status == 2 )) && grep -q "t3/slice is unchanged at $acc" "$root/err" && [[ ! -s $root/out ]] \
  || { cat "$root/err" >&2; fail "a hook that puts the tip back at ACC exited $status"; }
unchanged "a hook that puts the tip back at ACC"
fixture end-third a2
hooked "git update-ref refs/heads/t3/slice $new" run
(( status == 5 )) && grep -q "t3/slice is at $new, neither ACC" "$root/err" && grep -q "the run's last status before concluding was 0" "$root/err" \
  || { cat "$root/err" >&2; fail "a tip at a third commit exited $status"; }
pass "WT on the branch at ACC exits 2 after a stale scratch path and after a hook that puts the tip back, and a tip at a third commit exits 5"
fixture end-other-ref a2
git -C "$m" branch other "$acc"
hooked 'git symbolic-ref HEAD refs/heads/other' shimmed 'symbolic-ref HEAD refs/heads/t3/slice'
(( status == 5 )) && grep -q 'WT is on refs/heads/other, not t3/slice' "$root/err" || { cat "$root/err" >&2; fail "HEAD on another ref exited $status"; }
pass "HEAD attached to another ref at the end exits 5, naming the ref"

# Root r16: any failed command after the move, conclude's own reads included, rules out exit 0 even when a retry reads
# the rebased head with HEAD attached: the first tip read, and the first HEAD read in the moved arm, each failing once.
for match in 'rev-parse refs/heads/t3/slice' 'symbolic-ref --quiet HEAD'; do
  fixture "faltered-${match%% *}" a2
  rm -f "$root/once"
  status=0
  PATH=$root/shim:$PATH GIT_SHIM_MATCH=$match GIT_SHIM_ONCE=$root/once bash "$here/code-rebase.sh" "$wt" "$old" "$acc" "$new" \
    > "$root/out" 2> "$root/err" || status=$?
  [[ -e $root/once ]] && (( status == 5 )) && [[ ! -s $root/out ]] && grep -q 't3/slice moved to .*, but' "$root/err" \
    || { cat "$root/err" >&2; fail "a $match that failed once after the move exited $status"; }
  [[ $(git -C "$wt" symbolic-ref --short HEAD) == t3/slice && $(git -C "$wt" rev-parse HEAD) != "$acc" ]] || fail "the run whose $match failed once is not on the moved branch"
done
pass "a tip read or a HEAD read that fails once after the move exits 5 with no result line, though the retry reads the rebased head"

# Root r17: no report write ends conclude. stderr is a FIFO whose reader the post-checkout hook kills during the final
# switch, so every write after the move fails (EPIPE): a moved run still exits 5, and one whose hook also puts the
# tip back at ACC still exits 2. (A stderr closed at launch, 2>&-, stops the script at its first line that duplicates
# it, before anything changes.)
broken_stderr() {
  rm -f "$root/errfifo" "$root/reader-stopped"; mkfifo "$root/errfifo"
  cat "$root/errfifo" > "$root/err" & echo $! > "$root/reader"
  # The reader is signalled once: a later hook run (the restore's switch) finds it stopped and leaves the PID alone.
  hooked "[[ -e $root/reader-stopped ]] || { : > $root/reader-stopped; kill \$(cat $root/reader) 2> /dev/null; sleep 0.3; }; $1; true" run_broken
  wait "$(cat "$root/reader")" 2> /dev/null || true
}
run_broken() { status=0; bash "$here/code-rebase.sh" "$wt" "$old" "$acc" "$new" > "$root/out" 2> "$root/errfifo" || status=$?; }
fixture stderr-moved a2
broken_stderr ':'
(( status == 5 )) && [[ ! -s $root/out ]] || fail "an unwritable stderr after the move exited $status"
[[ $(git -C "$wt" symbolic-ref --short HEAD) == t3/slice && $(git -C "$wt" rev-parse HEAD) != "$acc" ]] || fail "the run with an unwritable stderr is not on the moved branch"
fixture stderr-acc a2
broken_stderr "git update-ref refs/heads/t3/slice $acc"
(( status == 2 )) || fail "an unwritable stderr with the tip back at ACC exited $status"
unchanged "an unwritable stderr with the tip back at ACC"
pass "an unwritable stderr after the move still exits 5, and 2 with the tip back at ACC"

# receipts-union-rebase: a slice that added a review receipt, rebased over a base that gained another, conflicts at
# the tail of review-receipts.json; the replay resolves the file as the base's receipts followed by the slice's, in
# the record step's writer's bytes, the proof checks it again, and the record step's --verify (stubbed above) runs
# on the rebased tree. receipts_json SPEC...: the file as the writer gives it, one receipt per SPEC, NAME[:COVERS],
# its hashes derived from NAME (NAME+ is NAME's receipt with one more cover, the record step's edit of a recorded
# run); report_of NAME: its report copy's path and bytes, as put takes them.
receipts=scripts/catalog/review-receipts.json
cat > "$root/bin/receipts.py" << 'RECEIPTS'
import hashlib, json, sys
def hashed(*parts): return hashlib.sha256('/'.join(map(str, parts)).encode()).hexdigest()
def report(name): return '# Review of the %s batch\n\nAccepted.\n' % name
def receipt(spec):
    name, _, covers = spec.partition(':')
    count = int(covers or 1) + name.endswith('+')
    name = name.rstrip('+')
    return dict(runId='t3-review-' + hashed(name, 'run'), reportSha256=hashlib.sha256(report(name).encode()).hexdigest(),
                covers=[dict(id='structure everythingpath/%s-%d [description] sha256:%s' % (name, number, hashed(name, 'source', number)),
                             sources=[dict(subject='everythingpath/%s-%d' % (name, number), sourceSha256=hashed(name, 'source', number))],
                             payloadSha256=hashed(name, 'payload', number)) for number in range(1, count + 1)],
                evidence=dict(kind='t3', sha256=hashed(name, 'evidence'), reviewedCommit=hashed(name, 'commit')[:40]))
if sys.argv[1] == 'report':
    print('scripts/catalog/review-reports/%s.md' % receipt(sys.argv[2])['runId'])
    print(report(sys.argv[2]), end='')
else:
    print(json.dumps(dict(receipts=[receipt(spec) for spec in sys.argv[2:]]), indent=2))
RECEIPTS
receipts_json() { python3 -B "$root/bin/receipts.py" file "$@"; }
report_of() { local listing; listing=$(python3 -B "$root/bin/receipts.py" report "$1"); printf '%s\n%s' "${listing%%$'\n'*}" "${listing#*$'\n'}"; }
# report_put REPO NAME: put NAME's report copy in REPO.
report_put() { local listing; listing=$(report_of "$2"); put "$1" "${listing%%$'\n'*}" "${listing#*$'\n'}"; }
# receipts_fixture <name> <old specs> <slice specs> <upstream specs> [slice report] [upstream report]: no generated
# artifact. The old base holds the receipts (with a report copy each); the slice sets them and adds its report copy,
# then adds x.txt; the base sets them, adds its report copy and c.txt.
receipts_fixture() {
  local d=$root/$1 spec
  m=$d/main wt=$d/wt
  mkdir -p "$m"
  git -C "$m" init -qb feature
  git -C "$m" config user.name Fixture; git -C "$m" config user.email fixture@example.test
  put "$m" "$receipts" "$(receipts_json $2)"; for spec in $2; do report_put "$m" "$spec"; done; commit "$m" 'old base'
  old=$(git -C "$m" rev-parse HEAD)
  git -C "$m" worktree add -qb t3/slice "$wt"
  put "$wt" "$receipts" "$(receipts_json $3)"; [[ -z ${5:-} ]] || report_put "$wt" "$5"; commit "$wt" 'slice records its review'
  put "$wt" x.txt slice; commit "$wt" 'slice adds x'
  acc=$(git -C "$wt" rev-parse HEAD)
  put "$m" "$receipts" "$(receipts_json $4)" c.txt upstream; [[ -z ${6:-} ]] || report_put "$m" "$6"; commit "$m" 'upstream records its review'
  new=$(git -C "$m" rev-parse HEAD)
}
# union_passes <label> <paths> <regen paths> <receipt specs held>: patch_equal_passes, the rebased file is the writer's
# bytes for SPECS, the printed proof names the rule, and --verify ran once on WT.
union_passes() {
  patch_equal_passes "$1" "$2" "$3"
  [[ $(git -C "$wt" show "HEAD:$receipts") == "$(receipts_json $4)" ]] || fail "$1: the receipts are not the union: $(git -C "$wt" show "HEAD:$receipts")"
  python3 -B -c 'import json, sys; proof = json.loads(open(sys.argv[1]).read().splitlines()[-1])["rebaseProof"]
assert proof["receiptsUnion"] == dict(rule="receipts-union-v1", paths=[sys.argv[2]]), proof' "$root/out" "$receipts" \
    || fail "$1: the printed proof does not name the receipts-union rule"
  [[ $(cat "$root/verify.log") == "verify $wt in $wt" ]] || fail "$1: --verify did not run once on the rebased tree: $(cat "$root/verify.log")"
  grep -q "conflicts in $receipts, the only conflict outside the regenerated artifacts: resolved by the receipts-union rule" "$root/err" \
    || fail "$1: the run did not report the union"
}

receipts_fixture receipts old 'old slice' 'old base' slice base
: > "$root/verify.log"; : > "$root/pnpm.log"
run
union_passes "a receipt added on each side" "$receipts" '' 'old base slice'
grep -q "^code-rebase: overlap outside the regenerated artifacts: $receipts; inside them: none, so no regeneration$" "$root/err" \
  || fail "the report copies are in the overlap: $(grep overlap "$root/err")"
for spec in old base slice; do
  listing=$(report_of "$spec"); [[ $(git -C "$wt" show "HEAD:${listing%%$'\n'*}") == "${listing#*$'\n'}" ]] || fail "the report copy of $spec is missing"
done
[[ $(cat "$root/pnpm.log") == 'install --offline' ]] || fail "the union without regeneration did not install once: $(cat "$root/pnpm.log")"
pass "a receipt added on each side rebases as the base's receipts followed by the slice's, the report copies (new files, outside the overlap) carried, --verify passes, and the gate accepts the proof"

# Refusals, each with the branch unchanged.
receipts_fixture edited old 'old+ slice' 'old base' slice base
run
(( status == 2 )) && grep -qF "changes, removes or moves receipts OLD_BASE holds in $receipts" "$root/err" \
  && grep -q "^code-rebase: replaying $(git -C "$wt" rev-parse "$acc^") conflicts in $receipts, which the receipts-union rule does not carry$" "$root/err" \
  || fail "a slice that edits a receipt was not refused ($status): $(cat "$root/err")"
unchanged "a slice that edits a receipt"
# The slice removes a receipt the base keeps: Git replays it without a conflict, so the rule does not apply and the
# patch-equal proof refuses it as before.
receipts_fixture removed 'old gone' 'old slice' 'old gone base' slice base
run
(( status == 2 )) && grep -qF "changes $receipts differently (patch-id)" "$root/err" \
  || fail "a slice that removes a receipt was not refused ($status): $(cat "$root/err")"
unchanged "a slice that removes a receipt"
receipts_fixture both old 'old slice' 'old slice base' slice slice
run
(( status == 2 )) && grep -qF "adds a receipt BASE holds too, with the runId $(receipts_json slice | python3 -B -c 'import json, sys; print(json.load(sys.stdin)["receipts"][0]["runId"])')" "$root/err" \
  || fail "one runId on both sides was not refused ($status): $(cat "$root/err")"
unchanged "one runId on both sides"
receipts_fixture undecodable old 'old slice' 'old base' slice base
git -C "$m" reset -q --hard HEAD^; put "$m" "$receipts" "$(receipts_json old base)
garbage"; commit "$m" 'upstream breaks the receipts'; new=$(git -C "$m" rev-parse HEAD)
run
(( status == 2 )) && grep -qF "$receipts at BASE ($new) does not decode as review receipts" "$root/err" \
  || fail "a base whose receipts do not decode was not refused ($status): $(cat "$root/err")"
unchanged "a base whose receipts do not decode"
receipts_fixture elsewhere old 'old slice' 'old base' slice base
git -C "$wt" reset -q --hard HEAD^; put "$wt" s.txt slice; git -C "$wt" commit -q --amend --no-edit; put "$wt" x.txt slice; commit "$wt" 'slice adds x'
acc=$(git -C "$wt" rev-parse HEAD)
put "$m" s.txt upstream; commit "$m" 'upstream adds s'; new=$(git -C "$m" rev-parse HEAD)
run
(( status == 2 )) && grep -q "^code-rebase: replaying $(git -C "$wt" rev-parse "$acc^") conflicts outside the regenerated artifacts: s.txt $receipts$" "$root/err" \
  || fail "a commit that also conflicts in another file was not refused ($status): $(cat "$root/err")"
unchanged "a commit that also conflicts in another file"
receipts_fixture verify-fails old 'old slice' 'old base' slice base
VERIFY_FAIL=1 run
(( status == 2 )) && grep -q "^code-rebase: the record step's --verify failed on the rebased tree$" "$root/err" \
  || fail "a failing --verify was not refused ($status): $(cat "$root/err")"
unchanged "a failing --verify"
pass "an edited receipt, a removed one, one runId on both sides, an undecodable base, a conflict in another file too and a failing --verify refuse, the branch unchanged"

# The real case, 2026-11-22 (archetype-alchemist-1-rebase-1.log): the Alchemist slice recorded its review (one receipt,
# its report copy and reviewed-curation.json) and regenerated the projection; the Ranger batch landed meanwhile with
# its own. The receipts have the shapes of those two (a seven-cover and a twelve-cover T3 receipt); the curation
# records each side changed are far apart, so Git merges that file; the projection is regenerated.
curation=scripts/catalog/reviewed-curation.json
curation_json() { python3 -B -c 'import json, sys
records = [dict(id="record-%d" % number, status="drafted") for number in range(1, 21)]
for number in map(int, sys.argv[1:]): records[number - 1].update(status="checked", receipt="t3-review")
print(json.dumps(dict(records=records), indent=2))' "$@"; }
old_extra=("$receipts" "$(receipts_json old)" "$curation" "$(curation_json)" "$(report_of old | head -1)" "$(report_of old | tail -n +2)")
slice_extra=("$receipts" "$(receipts_json old alchemist:7)" "$curation" "$(curation_json 3)" "$(report_of alchemist | head -1)" "$(report_of alchemist | tail -n +2)")
fixture alchemist a2 "$receipts" "$(receipts_json old ranger:12)" "$curation" "$(curation_json 15)" "$(report_of ranger | head -1)" "$(report_of ranger | tail -n +2)"
old_extra=() slice_extra=()
: > "$root/verify.log"; : > "$root/pnpm.log"
run
union_passes "the Alchemist slice over the Ranger batch" "$receipts $curation" "$projection" 'old ranger:12 alchemist:7'
[[ $(git -C "$wt" show "HEAD:$curation") == "$(curation_json 3 15)" ]] || fail "reviewed-curation.json does not hold both sides' records"
[[ $(grep -c 'install --offline' "$root/pnpm.log") == 1 ]] || fail "the union with regeneration installed more than once"
pass "the real case's shapes (the Alchemist slice over the Ranger batch, with reviewed-curation.json merged by Git and the projection regenerated) rebase, prove and verify"

# Fix r1 (Standards 2 / Spec 1): a slice that also changes the receipts file's mode is not the union rule's: a
# resolution at BASE's mode would drop the reviewed mode change, so the conflict refuses.
receipts_fixture mode old 'old slice' 'old base' slice base
git -C "$wt" reset -q --hard HEAD^; chmod +x "$wt/$receipts"; git -C "$wt" add -- "$receipts"; git -C "$wt" commit -q --amend --no-edit
put "$wt" x.txt slice; commit "$wt" 'slice adds x'; acc=$(git -C "$wt" rev-parse HEAD)
: > "$root/verify.log"
run
(( status == 2 )) && grep -qF "changes the mode of $receipts, which this rule carries only when the slice leaves it as OLD_BASE has it" "$root/err" \
  && [[ ! -s $root/verify.log ]] || fail "a slice that also changes the receipts file's mode was not refused ($status): $(cat "$root/err")"
unchanged "a slice that also changes the receipts file's mode"
pass "a slice that also changes the receipts file's mode refuses, the branch unchanged"

# Fix r1 (Standards 3 / Spec 3): a reviewed removal whose hunk lies well before the base's append replays without a
# conflict, so the patch-equal proof carries it as any reviewed change; no union, no --verify.
receipts_fixture clean-removal 'gone k0 k1 k2 k3' 'k0 k1 k2 k3' 'gone k0 k1 k2 k3 base' '' base
: > "$root/verify.log"
run
patch_equal_passes "a reviewed removal Git replays cleanly" "$receipts" ''
[[ $(git -C "$wt" show "HEAD:$receipts") == "$(receipts_json k0 k1 k2 k3 base)" && ! -s $root/verify.log ]] \
  && ! grep -q 'receipts-union' "$root/err" && ! grep -q receiptsUnion "$root/out" \
  || fail "a cleanly replayed removal was not carried by the patch-equal proof alone: $(cat "$root/err")"
pass "a reviewed removal Git replays cleanly is carried by the patch-equal proof, with no union and no --verify"

# Fix r3: one slice commit conflicting in the receipts file and in a regenerated artifact (the projection, which both
# sides regenerated): the projection's conflict is set aside for the regeneration rule, the receipts file is carried
# by the union, and the proof names both rules.
old_extra=("$receipts" "$(receipts_json old)" "$(report_of old | head -1)" "$(report_of old | tail -n +2)")
fixture both-rules a2 "$receipts" "$(receipts_json old base)" "$(report_of base | head -1)" "$(report_of base | tail -n +2)"
old_extra=()
git -C "$wt" reset -q --hard "$old"
put "$wt" a.txt a2 "$receipts" "$(receipts_json old slice)"; report_put "$wt" slice; regen "$wt"; commit "$wt" 'slice records its review and regenerates'
acc=$(git -C "$wt" rev-parse HEAD)
conflicted=$(git -C "$wt" merge-tree --write-tree --name-only --no-messages -X no-renames --merge-base="$old" "$new" "$acc" | tail -n +2 | sort | paste -sd ' ') || true
[[ $conflicted == "$receipts $projection" ]] || fail "the fixture's commit does not conflict in the receipts file and the projection: $conflicted"
: > "$root/verify.log"; : > "$root/pnpm.log"
run
union_passes "a receipts conflict beside a regenerated artifact's" "$receipts" "$projection" 'old base slice'
pass "a commit conflicting in the receipts file and in the projection carries the receipts by the union and regenerates the projection, the proof naming both rules"
