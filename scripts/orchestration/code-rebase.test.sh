#!/usr/bin/env bash
# code-rebase.sh against a synthetic repository whose generated launch artifacts a stub chain writes. The
# projection binds a.txt, b.txt and s.txt; its row pf1/a gains `y` only when both a.txt and b.txt say MARK; a.txt or
# b.txt that says ROW has its own row, its first word; when both say BOTH, row pf1/ab holds both first words. A
# curation fixture also holds the two keyed attribution files and the notice authority, authority, manifest,
# overview and pin, each derived from the files before it as the catalog's are (fixture contracts only: the real
# generator chain is the catalog's).
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
projection, notices, authority, manifest = (Path(S + 'campaign-mvp-v1' + name + '.json') for name in ('.verification', '.notices', '.authority', ''))
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
    text = {name: Path(name).read_text() if Path(name).exists() else '' for name in ('a.txt', 'b.txt')}
    rows = [dict(key='pf1/a', verified=['x', 'y'] if all('MARK' in value for value in text.values()) else ['x'])]
    rows += [dict(key='pf1/' + name, verified=value.split()[:1]) for name, value in text.items() if 'ROW' in value]
    if all('BOTH' in value for value in text.values()):
        rows.append(dict(key='pf1/ab', verified=[value.split()[0] for value in text.values()]))
    return json.dumps(dict(version=1, scopeVersion='campaign-mvp-v1', binding=dict(gate=gate, inputs=inputs),
                           rows=sorted(rows, key=lambda row: row['key'])), indent=2) + '\n'
def git_show(commit, path):
    return subprocess.run(['git', 'show', commit + ':' + path], capture_output=True, text=True, check=True).stdout.split('\n')
command = sys.argv[1]
# GENERATE_FAIL=write fails the projection's writer; GENERATE_KEEP=1 writes nothing and checks nothing;
# GENERATE_STRAY=write|inventory-check writes stray.txt from the projection's writer or from the chain's final check.
if os.environ.get('GENERATE_STRAY') == command:
    Path('stray.txt').write_text('stray\n')
if os.environ.get('GENERATE_FAIL') == command:
    sys.exit(1)
if os.environ.get('GENERATE_KEEP') or (not curation and command in ('notices', 'inventory', 'pin')):
    sys.exit(0)
if command == 'write':
    projection.parent.mkdir(parents=True, exist_ok=True)
    projection.write_text(projected())
    # GENERATE_LINK=FILE leaves the projection a symlink to FILE, which holds it (a generator that links a cached
    # copy); GENERATE_LINK_DIR=DIR moves the projection's directory to DIR and links it; GENERATE_DIR=1 leaves a
    # directory at the projection.
    if os.environ.get('GENERATE_LINK'):
        target = Path(os.environ['GENERATE_LINK'])
        target.write_text(projection.read_text()); projection.unlink(); projection.symlink_to(target)
    elif os.environ.get('GENERATE_LINK_DIR'):
        target = Path(os.environ['GENERATE_LINK_DIR'])
        projection.parent.rename(target); projection.parent.symlink_to(target)
    elif os.environ.get('GENERATE_DIR'):
        projection.unlink(); projection.mkdir(); (projection / 'rows.json').write_text('{}\n')
elif command == 'check':
    sys.exit(0 if projection.exists() and projection.read_text() == projected() else 1)
elif command == 'inventory-check':
    sys.exit(0)
elif command == 'notices':
    inputs = [dict(locator=name, sha256=sha(name)) for name in ('a.txt', 'b.txt', str(assessments)) if Path(name).exists()]
    dump(notices, dict(value=dict(scopeSha256='0' * 64, inputs=inputs, notices=['notice/PZO1110'])))
    dump(authority, dict(value=dict(roots=['pf1/a'], noticeAuthoritySha256=sha(notices))))
elif command == 'inventory':
    dump(manifest, dict(value=dict(roots=['pf1/a'], authoritySha256=sha(authority))))
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
elif command == 'record-verify':
    sys.exit(0)
elif command == 'merge' and sys.argv[2] == 'scripts/catalog/review-receipts.json':
    # The review receipts' union (receipts-merge.ts): ours, then theirs' additions; append-only (an existing receipt
    # the same on every side), an addition alike on both sides.
    before, ours, theirs = ({entry['runId']: entry for entry in json.loads(Path(path).read_text())['receipts']} for path in sys.argv[3:])
    if any(key not in ours or key not in theirs or ours[key] != value or theirs[key] != value for key, value in before.items()) \
            or any(theirs.get(key, value) != value for key, value in ours.items()):
        sys.exit('receipts conflict')
    dump(Path(sys.argv[2]), dict(receipts=list(ours.values()) + [value for key, value in theirs.items() if key not in ours]))
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
echo "\$*" | sed -E 's#^-s exec tsx [^ ]*/(prep-regen|catalog-merge).ts#\1.ts#' >> "$root/pnpm.log"
generate() { exec python3 -B "$root/bin/generate.py" "\$@"; }
case "\$*" in
  'install --offline') exit 0 ;;
  '-s catalog:launch-inventory --check') generate inventory-check ;;
  '-s catalog:launch-inventory --write') generate inventory ;;
  '-s catalog:launch-inventory --verify --write') generate write ;;
  '-s exec tsx '*'/prep-regen.ts notices') generate notices ;;
  '-s exec tsx '*'/prep-regen.ts pin '*) generate pin "\$6" "\$7" "\$8" ;;
  '-s catalog:merge '*) generate merge "\$3" "\$5" "\$7" "\$9" ;;
  '-s exec tsx '*'/catalog-merge.ts '*) generate merge "\$5" "\$7" "\$9" "\${11}" ;;
  '-s exec tsx scripts/catalog-record-review.ts --verify') generate record-verify ;;
esac
echo "unexpected pnpm \$*" >&2; exit 1
STUB
chmod +x "$root/bin/pnpm"
export PATH=$root/bin:$PATH
pass() { echo "ok    $1"; }
fail() { echo "FAIL  $1" >&2; exit 1; }
put() { local repo=$1; shift; while (( $# )); do mkdir -p "$(dirname "$repo/$1")"; printf '%s\n' "$2" > "$repo/$1"; git -C "$repo" add -- "$1"; shift 2; done; }
# regen <repo>: the slice's or the base's own regeneration, as a worker runs it (the pin keeps the file's comments).
regen() {
  (cd "$1" && for step in notices inventory write; do python3 -B "$root/bin/generate.py" "$step" > "$root/summary.json"
                                                     [[ $step != inventory ]] || cp "$root/summary.json" "$root/inventory.json"; done
           [[ ! -e $pin ]] || python3 -B "$root/bin/generate.py" pin "$root/inventory.json")
  local path
  for path in "$projection" scripts/catalog/scopes/campaign-mvp-v1{.notices,.authority,}.json docs/catalog-import/campaign-mvp-inventory.md "$pin"; do
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
[[ $(chain) == 'install --offline|prep-regen.ts notices|-s catalog:launch-inventory --write|-s catalog:launch-inventory --verify --write|prep-regen.ts pin SUMMARY OLD ACC|-s catalog:launch-inventory --check' ]] \
  || fail "the generator chain differs: $(chain)"
pass "the generator chain runs prep-regen's order: install, notices, --write, --verify --write, pin, --check, and the builder once"

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
[[ $(chain) == "install --offline|-s catalog:merge $assessments --base SCRATCH/base --ours SCRATCH/ours --theirs SCRATCH/theirs|-s catalog:merge $evidence --base SCRATCH/base --ours SCRATCH/ours --theirs SCRATCH/theirs|prep-regen.ts notices|-s catalog:launch-inventory --write|-s catalog:launch-inventory --verify --write|prep-regen.ts pin SUMMARY OLD ACC|-s catalog:launch-inventory --check" ]] \
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
for when in write inventory-check; do
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

# regen-carry (code-regen-v3): a slice that changes the projection's rows where the base movement changed the
# projection too, or whose review receipts both sides appended to, is carried by the regeneration on NEW when it gives
# BASE's rows with the slice's changes and the receipts' union.
receipts_path=scripts/catalog/review-receipts.json
carry_message='Regenerate the generated launch artifacts on the new base (code-regen-v3)'
# rcpt RUN...: review-receipts.json with a receipt per run, in order; a run ending in + covers a second record.
rcpt() { python3 -B -c 'import json, sys; print(json.dumps(dict(receipts=[dict(runId=run.rstrip("+"), covers=[run.rstrip("+")] + (["+"] if run.endswith("+") else [])) for run in sys.argv[1:]]), indent=2))' "$@"; }
# carry_passes <label> <regen paths>: exit 0, the branch moved, the regeneration commit is v3's, and the gate accepts the
# printed code-regen-v3 proof with REGEN_PATHS and no derived fingerprint.
carry_passes() {
  (( status == 0 )) || { cat "$root/err" >&2; fail "$1 exited $status"; }
  [[ $(git -C "$wt" symbolic-ref --short HEAD) == t3/slice && $(git -C "$wt" log -1 --format=%s) == "$carry_message" ]] || fail "$1: no v3 regeneration commit"
  grep -q '^code-rebase: rule code-regen-v3$' "$root/err" || fail "$1: the run did not name its rule"
  python3 -B -c '
import json, sys
sys.path.insert(0, sys.argv[1])
import gate_core
wt, old, acc, new, head, out, paths = sys.argv[2:]
proof = json.loads(open(out).read().splitlines()[-1])["rebaseProof"]
assert proof["regen"] == dict(rule=gate_core.CARRY_RULE, paths=paths.split(), chain=gate_core.CARRY_CHAIN, derived=[]), proof
assert gate_core.rebase_scope(dict(WT=wt, BASE=new, REVIEWED=head), dict(kind="code", rebaseProof=proof)) == (acc, proof["acceptedTree"])
' "$here" "$wt" "$old" "$acc" "$new" "$(git -C "$wt" rev-parse HEAD)" "$root/out" "$2" || fail "$1: the gate refuses the printed proof"
}
rows_at() { git -C "$wt" show "$1:$projection" | python3 -B -c 'import json, sys; print(" ".join(r["key"] + "=" + ",".join(r["verified"]) for r in json.load(sys.stdin)["rows"]))'; }

# The slice alone changes rows (stats-d1 r2, shield-bash r3): the base movement only rebinds the projection.
fixture carry-slice 'a2 ROW'
: > "$root/pnpm.log"
run
carry_passes "a slice-only row change" "$projection"
[[ $(rows_at HEAD) == 'pf1/a=x pf1/a.txt=a2' && $(rows_at HEAD) == $(rows_at "$acc") ]] || fail "the slice's rows are not carried: $(rows_at HEAD)"
[[ $(chain) == 'install --offline|prep-regen.ts notices|-s catalog:launch-inventory --write|-s catalog:launch-inventory --verify --write|prep-regen.ts pin SUMMARY OLD ACC|-s catalog:launch-inventory --check|-s exec tsx scripts/catalog-record-review.ts --verify' ]] \
  || fail "the v3 chain differs: $(chain)"
pass "a slice that changes the projection's rows where the base rebinds it is carried by code-regen-v3, the chain ending in catalog-record-review --verify"

# Both sides change rows, on different keys (shield-bash r2).
upstream_b='b2 ROW' fixture carry-disjoint 'a2 ROW'
run
carry_passes "rows both sides changed on different keys" "$projection"
[[ $(rows_at HEAD) == 'pf1/a=x pf1/a.txt=a2 pf1/b.txt=b2' ]] || fail "the rows are not both sides' changes: $(rows_at HEAD)"
pass "rows both sides changed on different keys are carried, each side's change by key"

# Both sides change one row differently: refused before the chain.
old_extra=(a.txt 'a1 BOTH' b.txt 'b1 BOTH')
upstream_b='b2 BOTH' fixture carry-conflict 'a2 BOTH'
old_extra=()
: > "$root/pnpm.log"
run
(( status == 2 )) && grep -qF "the reviewed slice and the base movement change rows of $projection differently: row pf1/ab" "$root/err" && [[ ! -s $root/pnpm.log ]] \
  || fail "a row both sides changed differently was not refused before the chain ($status): $(cat "$root/err")"
unchanged "a row both sides changed differently"
pass "a row both sides changed differently refuses before the chain runs"

# The slice's and the base's changes interact: regenerated together they move a row neither side changed.
upstream_b='b2 MARK' fixture carry-interaction 'a2 MARK ROW'
run
(( status == 2 )) && grep -qF "rows of $projection neither side changed moved at" "$root/err" && grep -qF ': row pf1/a"}' "$root/err" \
  || fail "an interacting change was not refused ($status): $(cat "$root/err")"
unchanged "an interacting change"
pass "an interaction that moves a row neither side changed refuses, naming the row"

# A row the slice hand-edited, which the regeneration does not reproduce, refuses naming it (prep-regen-chain's lesson).
fixture carry-hand 'a2 ROW'
sed -i 's/"a2"/"hand edit"/' "$wt/$projection"; git -C "$wt" commit -qam 'slice hand-edits a row'; acc=$(git -C "$wt" rev-parse HEAD)
run
(( status == 2 )) && grep -qF "rows of $projection the reviewed slice changed are not at REVIEWED as ACCEPTED has them at" "$root/err" \
  && grep -qF ': row pf1/a.txt"}' "$root/err" || fail "a hand-edited row was not refused by name ($status): $(cat "$root/err")"
unchanged "a hand-edited row"
pass "a hand-edited row the regeneration does not reproduce refuses, naming the row"

# A file mode the slice changed on a regenerated artifact is at REVIEWED (review r2 spec #1): the replay sets the
# artifact aside, and the regeneration commit takes the three-way merge of the modes, the slice's change over the
# base's. The projection made executable alongside a row change, then the receipts alongside an appended receipt; a
# symlink refuses before the chain.
# mode_commit <path> <mode>: the slice's last commit makes PATH executable (+x) or a symlink (link); ACC moves to it.
mode_commit() {
  if [[ $2 == link ]]; then
    mv "$wt/$1" "$wt/$1.target"; ln -s "$(basename "$1").target" "$wt/$1"; git -C "$wt" add -A
  else
    chmod "$2" "$wt/$1"; git -C "$wt" update-index --chmod="$2" -- "$1"
  fi
  git -C "$wt" commit -qm "slice changes the mode of $1"; acc=$(git -C "$wt" rev-parse HEAD)
}
mode_of() { git -C "$wt" ls-tree HEAD -- "$1" | cut -d' ' -f1; }
fixture carry-mode 'a2 ROW'
mode_commit "$projection" +x
run
carry_passes "a projection the slice made executable" "$projection"
[[ $(mode_of "$projection") == 100755 && -x $wt/$projection && -z $(git -C "$wt" status --porcelain=v1) ]] \
  || fail "the slice's executable bit on the projection is lost: $(mode_of "$projection")"
old_extra=("$receipts_path" "$(rcpt r1)") slice_extra=("$receipts_path" "$(rcpt r1 s1)")
fixture carry-mode-receipts a2 "$receipts_path" "$(rcpt r1 b1)"
old_extra=() slice_extra=()
mode_commit "$receipts_path" +x
run
carry_passes "receipts the slice made executable" "$receipts_path $projection"
[[ $(mode_of "$receipts_path") == 100755 && $(mode_of "$projection") == 100644 ]] \
  || fail "the receipts' mode is not the slice's, or the projection's not the base's: $(mode_of "$receipts_path") $(mode_of "$projection")"
fixture carry-mode-link 'a2 ROW'
mode_commit "$projection" link
: > "$root/pnpm.log"
run
# The rule's pick reads the projection's rows first, and a symlink's blob is not JSON (gate_core.regen_modes refuses
# the type change itself where the rows are not read first: RowCarryProofTest).
(( status == 2 )) && grep -qF "$projection is missing or not JSON at $acc" "$root/err" \
  && [[ ! -s $root/pnpm.log ]] || fail "a projection the slice made a symlink was not refused before the chain ($status): $(cat "$root/err")"
unchanged "a projection made a symlink"
pass "a file mode the slice changed on a regenerated artifact is at REVIEWED, and a type change refuses before the chain"

# The chain leaves something other than a regular file in WT at a regenerated artifact (review r3 spec #1): a
# symlink, to a file outside WT or inside it, a directory, or a path reached through a linked directory. It refuses
# naming the path before any mode is applied or anything staged, so no file outside WT changes, its mode included.
# regen_refuses <label> <message>: exit 2 with MESSAGE on stderr, the branch and worktree unchanged.
regen_refuses() {
  (( status == 2 )) && grep -qF "code-rebase: $2" "$root/err" || fail "$1 was not refused ($status): $(cat "$root/err")"
  unchanged "$1"
}
mode_at() { stat -c %a "$1"; }
fixture carry-link-sibling 'a2 ROW'
sibling=$root/carry-link-sibling/cache.json
printf 'cached\n' > "$sibling"; chmod 0755 "$sibling"
GENERATE_LINK=$sibling run
regen_refuses "a projection the chain linked to a sibling outside WT" "the chain left a symlink at the regenerated artifact $projection"
[[ $(mode_at "$sibling") == 755 ]] || fail "the sibling outside WT changed mode: $(mode_at "$sibling")"
fixture carry-link-inside 'a2 ROW'
GENERATE_LINK=$wt/cache.json run
regen_refuses "a projection the chain linked to a file inside WT" "the chain left a symlink at the regenerated artifact $projection"
[[ ! -e $wt/cache.json ]] || fail "the linked file inside WT was left behind"
fixture carry-directory 'a2 ROW'
GENERATE_DIR=1 run
regen_refuses "a directory the chain left at the projection" "the chain left a directory, not a regular file, at the regenerated artifact $projection"
fixture carry-link-dir 'a2 ROW'
mode_commit "$projection" +x
linked=$(cd "$root/carry-link-dir" && pwd -P)/scopes
GENERATE_LINK_DIR=$linked run
regen_refuses "a projection the chain reached through a linked directory" "the regenerated artifact $projection resolves to $linked/"
[[ $(mode_at "$linked/$(basename "$projection")") == 644 ]] || fail "the projection outside WT changed mode: $(mode_at "$linked/$(basename "$projection")")"
pass "a symlink (to a file outside WT or inside it), a directory or a linked directory the chain leaves at a regenerated artifact refuses naming it, before any mode is applied"

# A mode change that is the regeneration's only change carries with core.fileMode false as with true (review r3 spec
# #2): both sides append the same receipt and regeneration reproduces BASE's bytes, so the worktree status shows
# nothing either way; the emptiness is judged from the staged delta, the modes included. The review's receipts made
# executable; then the receipts' bit removed, and the projection made executable.
# mode_only_fixture <name> <old receipts mode> <path> <mode>: the old base holds the receipts (r1) executable (+x) or not (-x); the
# slice appends x1 and makes PATH executable (+x) or not (-x); the base appends x1 alike and edits b.txt.
mode_only_fixture() {
  local d=$root/$1
  m=$d/main wt=$d/wt
  mkdir -p "$m"
  git -C "$m" init -qb feature
  git -C "$m" config user.name Fixture; git -C "$m" config user.email fixture@example.test
  put "$m" a.txt a1 b.txt b1 "$receipts_path" "$(rcpt r1)"; regen "$m"
  chmod "$2" "$m/$receipts_path"; git -C "$m" update-index --chmod="$2" -- "$receipts_path"; commit "$m" 'old base with receipts'
  old=$(git -C "$m" rev-parse HEAD)
  git -C "$m" worktree add -qb t3/slice "$wt"
  put "$wt" "$receipts_path" "$(rcpt r1 x1)"; chmod "$4" "$wt/$3"; git -C "$wt" update-index --chmod="$4" -- "$3"
  commit "$wt" "slice appends x1 and changes the mode of $3"
  acc=$(git -C "$wt" rev-parse HEAD)
  put "$m" b.txt b2 "$receipts_path" "$(rcpt r1 x1)"; regen "$m"; commit "$m" 'upstream edits b and appends x1'
  new=$(git -C "$m" rev-parse HEAD)
}
# mode_only <label> <old receipts mode> <path> <mode> <expected tree mode>: with core.fileMode true and false, the run
# passes, PATH is at the expected mode in a regeneration commit that changes its mode only, and both trees are one.
mode_only() {
  local setting trees=()
  for setting in true false; do
    mode_only_fixture "mode-only-${#trees[@]}-$RANDOM" "$2" "$3" "$4"
    git -C "$m" config core.fileMode "$setting"
    run
    carry_passes "$1 (core.fileMode $setting)" "$3"
    [[ $(mode_of "$3") == "$5" && $(git -C "$wt" diff-tree -r --no-commit-id HEAD | awk '{print $3 == $4}') == 1 \
       && -z $(git -C "$wt" status --porcelain=v1 --untracked-files=all) ]] \
      || fail "$1 (core.fileMode $setting): $3 is $(mode_of "$3"), not $5 by a mode-only change, or WT is dirty"
    trees+=("$(git -C "$wt" rev-parse 'HEAD^{tree}')")
  done
  [[ ${trees[0]} == "${trees[1]}" ]] || fail "$1: core.fileMode true and false give different trees: ${trees[*]}"
}
mode_only "receipts the slice made executable, the only change" -x "$receipts_path" +x 100755
mode_only "receipts the slice made non-executable, the only change" +x "$receipts_path" -x 100644
mode_only "a projection the slice made executable, the only change" -x "$projection" +x 100755
pass "a mode change that is the regeneration's only change carries alike with core.fileMode true and false"

# Review receipts both sides appended to are their union, the base's first (stats-d1 r2's conflict).
old_extra=("$receipts_path" "$(rcpt r1)") slice_extra=("$receipts_path" "$(rcpt r1 s1)")
fixture carry-receipts a2 "$receipts_path" "$(rcpt r1 b1)"
: > "$root/pnpm.log"
run
carry_passes "review receipts both sides appended to" "$receipts_path $projection"
[[ $(git -C "$wt" show "HEAD:$receipts_path" | python3 -B -c 'import json, sys; print(" ".join(r["runId"] for r in json.load(sys.stdin)["receipts"]))') == 'r1 b1 s1' ]] \
  || fail "the receipts are not the union in order"
grep -qF -- "catalog-merge.ts $receipts_path --base" "$root/pnpm.log" || fail "the receipts were not merged by this checkout's catalog-merge.ts"
pass "review receipts both sides appended to are their union (the base's, then the slice's additions), merged by this checkout's catalog-merge.ts"
# An existing receipt a side changes, and one both sides added differently, refuse before the chain; a failing
# catalog-record-review --verify refuses.
slice_extra=("$receipts_path" "$(rcpt r1+ s1)")
fixture carry-receipts-conflict a2 "$receipts_path" "$(rcpt r1 b1)"
: > "$root/pnpm.log"
run
(( status == 2 )) && grep -qF "$receipts_path is append-only, but a side changes the review receipt r1" "$root/err" \
  && [[ ! -s $root/pnpm.log ]] || fail "an existing receipt the slice changed was not refused before the chain ($status): $(cat "$root/err")"
unchanged "an existing receipt the slice changed"
slice_extra=("$receipts_path" "$(rcpt r1 x1+)")
fixture carry-receipts-conflict2 a2 "$receipts_path" "$(rcpt r1 x1)"
: > "$root/pnpm.log"
run
(( status == 2 )) && grep -qF "the reviewed slice and the base movement hold the review receipt x1 differently in $receipts_path" "$root/err" \
  && [[ ! -s $root/pnpm.log ]] || fail "a receipt both sides added differently was not refused before the chain ($status): $(cat "$root/err")"
unchanged "a receipt held differently"
slice_extra=("$receipts_path" "$(rcpt r1 s1)")
fixture carry-receipts-verify a2 "$receipts_path" "$(rcpt r1 b1)"
old_extra=() slice_extra=()
GENERATE_FAIL=record-verify run
(( status == 2 )) && grep -q "^code-rebase: catalog-record-review --verify failed over the review receipts' union$" "$root/err" \
  || fail "a failing catalog-record-review --verify was not refused ($status): $(cat "$root/err")"
unchanged "a failing catalog-record-review --verify"
pass "an existing receipt a side changed or one both sides added differently refuses before the chain, and a union catalog-record-review --verify fails refuses"

# The regenerated artifacts are generated launch artifacts prep regenerates, or data files it merges, and the chain
# runs prep's steps in prep's order after the keyed union. It runs the ones that write REGEN_PATHS: its notice step,
# prep-regen.ts notices, stands for prep's catalog:launch-legal-authority --write, less the Registry binding, which
# a code slice may not move (the authority's rows); prep's #227 scripted match and party scope are not REGEN_PATHS.
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
assert steps[-1] == 'catalog:launch-inventory --check', steps
ours = ['catalog:launch-legal-authority --write' if step == 'notice authority (prep-regen.ts notices)' else step
        for step in steps[start:-1]]
assert ours == [step for step in prep if step in ours] and set(ours) <= set(prep), (ours, prep)
assert ours[0] == prep[0] and ours[-1] == prep[-1], (ours, prep)
keyed = [path for path, kind in gate_core.REGEN_PATHS.items() if isinstance(kind, gate_core.Keyed)]
assert list(gate_core.REGEN_PATHS)[:len(keyed)] == keyed, gate_core.REGEN_PATHS
PY
pass "gate_core.REGEN_PATHS is a subset of prep_regen_files and prep_data_files, and REGEN_CHAIN runs prep's launch steps in prep's order after the keyed union"
