#!/usr/bin/env bash
# usage: remote-fetch.sh <runId>
# Publishes the CI heavy checks of a gate/<label> push (ci.yaml remote-checks job, artifact
# remote-checks-<runId>) as $EP_ORCH/remote-checks/<runId>/: create-only, every file but the
# manifest first and manifest.json last, then the directory read-only (chmod -R a-w). Prints
# the manifest's sha256 for gate.json remoteChecks; remote_checks.py verifies the rest.
# Refuses an existing directory or an artifact whose manifest names another runId or directory.
# Landing evidence comes only from a gate/<label> push (speed-wip-ci §4, fix r1: no WIP artifact, run or ref is
# accepted as gate evidence): the producing run is found from GitHub, never from the artifact. It is the one ci.yaml
# push run on gate/<label> (the runId's label) at a commit starting with the runId's short SHA; `gh run view` must
# report that branch, and the artifact is downloaded from that run alone (`gh run download <id>`). The manifest's
# runner (run id, attempt, ref refs/heads/gate/<label>, sha) and source commit must be that run's, and the facts
# GitHub reported are published as provenance.json (remote-fetch-provenance-v1), before the manifest; an artifact
# that brings its own is refused. remote_checks.py requires that record. Tests: remote-fetch.test.sh.
# gh runs from this checkout (its origin); GH_REPO overrides that. Exit 64 is a usage error.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
fail() { echo "remote-fetch: $*" >&2; exit 1; }
[[ $# -eq 1 && $1 =~ ^[a-z0-9-]+-[0-9]{8}-[0-9]{6}-[0-9a-f]{6}$ ]] || { echo "usage: remote-fetch.sh <runId>" >&2; exit 64; }
run_id=$1
label=${run_id%-*-*-*} short=${run_id##*-}
branch=gate/$label artifact=remote-checks-$run_id
root=$orch/remote-checks
dest=$root/$run_id
[[ ! -e $dest ]] || fail "$dest exists; remote evidence is create-only"
mkdir -p "$root"
stage=$(mktemp -d "$root/.fetch-$run_id-XXXXXX")
claimed=0
cleanup() {
  rm -rf "$stage"
  if [[ $claimed == 1 ]]; then chmod -R u+w "$dest" 2> /dev/null; rm -rf "$dest"; fi
}
trap cleanup EXIT
# 1. The producing run, from GitHub: the one ci.yaml push run on gate/<label> at the runId's commit.
(cd "$repo" && gh run list --branch "$branch" --workflow ci.yaml --event push --json databaseId,headSha --limit 100) \
  > "$stage/runs.json" || fail "gh run list failed for $branch"
github_run=$(python3 -B -I -c '
import json, re, sys
runs = [run for run in json.load(open(sys.argv[1])) if isinstance(run, dict) and str(run.get("headSha")).startswith(sys.argv[2])]
if len(runs) != 1:
    sys.exit("remote-fetch: %s ci.yaml push run%s on %s at %s…; the producing run must be exactly one"
             % (len(runs) or "no", "" if len(runs) == 1 else "s", sys.argv[3], sys.argv[2]))
run = runs[0].get("databaseId")
if type(run) is not int or run <= 0:
    sys.exit("remote-fetch: the run on %s has no databaseId" % sys.argv[3])
print(run)
' "$stage/runs.json" "$short" "$branch") || exit 1
(cd "$repo" && gh run view "$github_run" --json databaseId,headBranch,headSha,attempt) > "$stage/run.json" \
  || fail "cannot read GitHub run $github_run (gh run view failed)"
# 2. The artifact, from that run alone.
(cd "$repo" && gh run download "$github_run" --name "$artifact" --dir "$stage/$run_id") || fail "gh run download failed for $artifact"
manifest=$stage/$run_id/manifest.json
[[ -f $manifest && ! -L $manifest ]] || fail "artifact $artifact has no manifest.json"
python3 -B -I -c '
import json, sys
manifest = json.load(open(sys.argv[1]))
for key, want in (("kind", "remote-heavy-checks-v1"), ("runId", sys.argv[2]), ("directory", sys.argv[3])):
    if manifest.get(key) != want:
        sys.exit("manifest %s is %r, not %r" % (key, manifest.get(key), want))
' "$manifest" "$run_id" "$dest" || fail "artifact $artifact does not belong at $dest"
[[ ! -e $stage/$run_id/provenance.json && ! -L $stage/$run_id/provenance.json ]] \
  || fail "artifact $artifact brings its own provenance.json; only remote-fetch.sh writes it"
# 3. The run as GitHub reports it, and the manifest bound to it; then its provenance record.
python3 -B -I -c '
import json, re, sys
manifest_path, run_path, github_run, branch, short, run_id, artifact, out = sys.argv[1:]
run = json.load(open(run_path))
def refuse(message):
    sys.exit("remote-fetch: " + message)
if not isinstance(run, dict) or run.get("databaseId") != int(github_run):
    refuse("gh run view %s answered for another run" % github_run)
if run.get("headBranch") != branch:
    refuse("GitHub run %s is on %r, not %s; only a gate/<label> push is landing evidence" % (github_run, run.get("headBranch"), branch))
head, attempt = run.get("headSha"), run.get("attempt")
if not (isinstance(head, str) and re.fullmatch("[0-9a-f]{40}", head) and head.startswith(short)):
    refuse("GitHub run %s reports no head at %s…" % (github_run, short))
if type(attempt) is not int or attempt < 1:
    refuse("GitHub run %s reports no attempt" % github_run)
manifest = json.load(open(manifest_path))
runner, source = manifest.get("runner"), manifest.get("source")
if not isinstance(runner, dict) or not isinstance(source, dict):
    refuse("manifest names no GitHub runner or source")
for key, value, want in (("runner.provider", runner.get("provider"), "github-actions"), ("runner.runId", runner.get("runId"), github_run),
                         ("runner.attempt", runner.get("attempt"), str(attempt)), ("runner.ref", runner.get("ref"), "refs/heads/" + branch),
                         ("runner.sha", runner.get("sha"), head), ("source.commit", source.get("commit"), head)):
    if value != want:
        refuse("manifest %s is %r, not GitHub run %s%s %r" % (key, value, github_run, chr(39) + "s", want))
with open(out, "x") as stream:
    json.dump(dict(kind="remote-fetch-provenance-v1", runId=run_id, artifact=artifact, githubRunId=github_run,
                   attempt=str(attempt), headBranch=branch, headSha=head), stream, indent=2)
    stream.write("\n")
' "$manifest" "$stage/run.json" "$github_run" "$branch" "$short" "$run_id" "$artifact" "$stage/$run_id/provenance.json" || exit 1
mkdir "$dest" || fail "$dest appeared during the fetch"
claimed=1
find "$stage/$run_id" -mindepth 1 -maxdepth 1 ! -name manifest.json -exec mv -t "$dest" {} +
mv "$manifest" "$dest/manifest.json"
chmod -R a-w "$dest"
claimed=0
sha256sum "$dest/manifest.json" | cut -d' ' -f1
