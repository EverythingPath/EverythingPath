#!/usr/bin/env bash
# usage: remote-fetch.test.sh — checks remote-fetch.sh with a fake gh on PATH that holds GitHub runs (each a
# databaseId, headBranch, headSha and attempt) and their artifacts, so a download names the run it comes from. Covers
# the published directory, read-only files, the provenance record and printed sha256, create-only refusal, usage, a
# failed download, artifacts without a manifest or for another runId or directory, and (speed-wip-ci §4, fix r1: no
# WIP artifact, run or ref is landing evidence) the producing run: none or two on gate/<label> at the runId's commit
# (a gate-shaped artifact served only from a WIP run among them), a run whose own branch is not gate/<label>, a
# manifest naming another run, attempt, ref or commit, and an artifact that brings its own provenance. Uses a scratch
# EP_ORCH under $TMPDIR; no GitHub call.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
dir=$(mktemp -d "${TMPDIR:?TMPDIR}/remote-fetch-test-XXXXXX") || exit 1
trap 'chmod -R u+w "$dir" 2> /dev/null; rm -rf "$dir"' EXIT
mkdir -p "$dir/orch" "$dir/bin" "$dir/runs" "$dir/artifacts"
# Fake gh, every call logged:
# - `run list --branch <b> --workflow ci.yaml --event push --json databaseId,headSha --limit <n>`: the runs whose
#   branch is <b> (runs/<id>.json's listBranch when set, else its headBranch, as GitHub's index might disagree);
# - `run view <id> --json databaseId,headBranch,headSha,attempt`: runs/<id>.json without listBranch;
# - `run download <id> --name <artifact> --dir <dir>`: copies artifacts/<id>/<artifact>/, so only that run's own.
# Any other call, an unknown run or an artifact of another run fails.
cat > "$dir/bin/gh" << STUB
#!/usr/bin/env python3
import json, pathlib, shutil, sys
args = sys.argv[1:]
with open('$dir/gh.log', 'a') as log:
    log.write(' '.join(args) + '\n')
runs = pathlib.Path('$dir/runs')
if args[:2] == ['run', 'list'] and args[2::2] == ['--branch', '--workflow', '--event', '--json', '--limit'] \
        and args[5] == 'ci.yaml' and args[7] == 'push' and args[9] == 'databaseId,headSha':
    found = [json.loads(path.read_text()) for path in sorted(runs.glob('*.json'))]
    print(json.dumps([dict(databaseId=run['databaseId'], headSha=run['headSha']) for run in found
                      if run.get('listBranch', run['headBranch']) == args[3]]))
elif args[:2] == ['run', 'view'] and args[3:] == ['--json', 'databaseId,headBranch,headSha,attempt']:
    path = runs / (args[2] + '.json')
    if not path.is_file():
        sys.exit('no run ' + args[2])
    run = json.loads(path.read_text())
    run.pop('listBranch', None)
    print(json.dumps(run))
elif args[:2] == ['run', 'download'] and len(args) == 7 and args[3] == '--name' and args[5] == '--dir':
    source = pathlib.Path('$dir/artifacts') / args[2] / args[4]
    if not source.is_dir():
        sys.exit('no artifact %s in run %s' % (args[4], args[2]))
    shutil.copytree(source, args[6], dirs_exist_ok=True)
else:
    sys.exit(2)
STUB
chmod +x "$dir/bin/gh"
export EP_ORCH=$dir/orch PATH=$dir/bin:$PATH
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
# sha <runId>: the gate commit a runId names, its short SHA (the runId's last part) padded to 40.
sha() { printf '%s%034d' "${1##*-}" 0; }
# run <id> <headBranch> <headSha> [attempt] [listBranch]: a GitHub run.
run() {
  printf '{"databaseId": %s, "headBranch": "%s", "headSha": "%s", "attempt": %s%s}\n' "$1" "$2" "$3" "${4:-2}" \
    "${5:+, \"listBranch\": \"$5\"}" > "$dir/runs/$1.json"
}
# artifact <runId> <GitHub run id> [key=JSON ...]: remote-checks-<runId> uploaded by that run, with logs, a report and
# a manifest whose runner and source are that run's at the runId's commit; key=JSON replaces a manifest field (a
# dotted key one inside it).
artifact() {
  local id=$1 github=$2; shift 2
  local a=$dir/artifacts/$github/remote-checks-$id
  mkdir -p "$a"
  printf 'log\n' > "$a/install.log"; printf '{}\n' > "$a/full.json"
  python3 -B -I -c '
import json, sys
run_id, github, directory, commit, label = sys.argv[1:6]
manifest = dict(kind="remote-heavy-checks-v1", runId=run_id, directory=directory, source=dict(commit=commit),
                runner=dict(provider="github-actions", runId=github, attempt="2", ref="refs/heads/gate/" + label, sha=commit))
for change in sys.argv[6:]:
    key, _, value = change.partition("=")
    *path, last = key.split(".")
    target = manifest
    for part in path:
        target = target[part]
    target[last] = json.loads(value)
print(json.dumps(manifest))
' "$id" "$github" "$EP_ORCH/remote-checks/$id" "$(sha "$id")" "${id%-*-*-*}" "$@" > "$a/manifest.json"
}
fetch() { : > "$dir/gh.log"; bash "$here/remote-fetch.sh" "$@" 2> "$dir/err"; }
published() { ls -A "$EP_ORCH/remote-checks" | tr '\n' ' '; }

id=w1-20261102-101500-abc123
run 7001 gate/w1 "$(sha "$id")"
artifact "$id" 7001
out=$(fetch "$id"); status=$?
check "a fetch exits 0" "$status" 0
check "it prints the manifest sha256" "$out" "$(sha256sum "$EP_ORCH/remote-checks/$id/manifest.json" | cut -d' ' -f1)"
check "it publishes every artifact file and its provenance" "$(cd "$EP_ORCH/remote-checks/$id" && ls | tr '\n' ' ')" \
  "full.json install.log manifest.json provenance.json "
check "nothing in it is writable" "$(find "$EP_ORCH/remote-checks/$id" -perm /222 | wc -l)" 0
check "gh finds the push run on gate/<label>, reads it, then downloads from it alone" "$(cut -d' ' -f1-4 "$dir/gh.log" | paste -sd '|')" \
  "run list --branch gate/w1|run view 7001 --json|run download 7001 --name"
check "the download names the runId's artifact" "$(tail -1 "$dir/gh.log" | cut -d' ' -f5)" "remote-checks-$id"
check "the provenance records the producing run as GitHub reports it" \
  "$(python3 -c 'import json, sys; print(json.dumps(json.load(open(sys.argv[1])), sort_keys=True))' "$EP_ORCH/remote-checks/$id/provenance.json")" \
  "{\"artifact\": \"remote-checks-$id\", \"attempt\": \"2\", \"githubRunId\": \"7001\", \"headBranch\": \"gate/w1\", \"headSha\": \"$(sha "$id")\", \"kind\": \"remote-fetch-provenance-v1\", \"runId\": \"$id\"}"
check "no staging directory is left" "$(find "$EP_ORCH/remote-checks" -maxdepth 1 -name '.fetch-*' | wc -l)" 0

before=$(sha256sum "$EP_ORCH/remote-checks/$id/manifest.json")
fetch "$id" > /dev/null; status=$?
check "a second fetch of a runId is refused" "$status $(grep -c create-only "$dir/err")" "1 1"
check "and leaves the published manifest alone" "$(sha256sum "$EP_ORCH/remote-checks/$id/manifest.json")" "$before"

for bad in "" "W1-20261102-101500-abc123" "w1-20261102-101500-abc12" "w1-20261102-101500-abc123 extra" "../w1-20261102-101500-abc123"; do
  # shellcheck disable=SC2086
  fetch $bad > /dev/null; status=$?
  check "usage refusal: '$bad'" "$status" 64
done

# refused <name> <pattern> <runId>: the fetch exits 1 naming why, and publishes nothing new.
refused() {
  fetch "$3" > /dev/null; status=$?
  check "$1 is refused" "$status $(grep -cE -- "$2" "$dir/err")" "1 1"
  check "and publishes nothing ($1)" "$(published)" "$id "
}
n=0
next() { n=$((n + 1)); one=w1-20261102-10$(printf %04d "$n")-$(printf %06x "$n"); github=$((7100 + n)); }

next; run "$github" gate/w1 "$(sha "$one")"
refused "a failed download" 'gh run download failed' "$one"
next; run "$github" gate/w1 "$(sha "$one")"; artifact "$one" "$github"; rm "$dir/artifacts/$github/remote-checks-$one/manifest.json"
refused "an artifact without a manifest" 'no manifest\.json' "$one"
next; run "$github" gate/w1 "$(sha "$one")"; artifact "$one" "$github" runId='"w1-20261102-101800-ffffff"'
refused "a manifest for another runId" 'does not belong' "$one"
next; run "$github" gate/w1 "$(sha "$one")"; artifact "$one" "$github" directory="\"/elsewhere/remote-checks/$one\""
refused "a manifest naming another directory" 'does not belong' "$one"

# The producing run (fix r1): the one ci.yaml push run on gate/<label> at the runId's commit, as GitHub reports it.
next; run "$github" "wip/fixture-task-20261107-120000" "$(sha "$one")"; artifact "$one" "$github"
refused "a gate-shaped artifact served only from a WIP run" "no ci\.yaml push runs on gate/w1 at $(sha "$one" | cut -c1-6)" "$one"
check "and nothing is downloaded from that run" "$(grep -c '^run download' "$dir/gh.log")" 0
next; run "$github" gate/w1 "$(printf 'ffffff%034d' 0)"; artifact "$one" "$github"
refused "a gate run at another commit" "no ci\.yaml push runs on gate/w1 at $(sha "$one" | cut -c1-6)" "$one"
next; run "$github" gate/w1 "$(sha "$one")"; run 7999 gate/w1 "$(sha "$one")"; artifact "$one" "$github"
refused "two push runs at the runId's commit" "2 ci\.yaml push runs on gate/w1" "$one"
rm "$dir/runs/7999.json"
for branch in wip/fixture-task-20261107-120000 gate/w2 gate/w1/x main refs/heads/gate/w1 ''; do
  next; run "$github" "$branch" "$(sha "$one")" 2 gate/w1; artifact "$one" "$github"
  refused "a listed run whose own branch is '$branch'" "GitHub run $github is on .*, not gate/w1" "$one"
done
next; run "$github" gate/w1 "$(sha "$one" | cut -c1-6)$(printf '%034d' 1)" 2 gate/w1; artifact "$one" "$github"
check "the fixture's run differs from the runId's commit only after its short SHA" "$(cut -c1-6 <<< "$(sha "$one")")" "${one##*-}"
refused "a run whose head is not the manifest's commit" "manifest runner\.sha is .*, not GitHub run $github's" "$one"
# A WIP run's manifest, or a gate-shaped one naming another run, never passes for the producing run's.
for change in runner.runId='"4242"' runner.attempt='"1"' runner.ref='"refs/heads/wip/fixture-task-20261107-120000"' \
  runner.ref='"refs/heads/gate/w2"' runner.sha='"0000000000000000000000000000000000000000"' runner.provider='"local"' \
  source.commit='"0000000000000000000000000000000000000000"' runner='"4242"'; do
  next; run "$github" gate/w1 "$(sha "$one")"; artifact "$one" "$github" "$change"
  refused "a manifest with $change" "manifest .* is .*, not GitHub run $github's|names no GitHub runner" "$one"
done
next; run "$github" gate/w1 "$(sha "$one")"; artifact "$one" "$github"; printf '{}\n' > "$dir/artifacts/$github/remote-checks-$one/provenance.json"
refused "an artifact with its own provenance.json" 'brings its own provenance\.json' "$one"
next; run "$github" gate/w1 "$(sha "$one")" 0; artifact "$one" "$github"
refused "a run with no attempt" "GitHub run $github reports no" "$one"
exit $fail
