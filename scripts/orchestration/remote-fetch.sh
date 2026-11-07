#!/usr/bin/env bash
# usage: remote-fetch.sh <runId>
# Publishes the CI heavy checks of a gate/<label> push (ci.yaml remote-checks job, artifact
# remote-checks-<runId>) as $EP_ORCH/remote-checks/<runId>/: create-only, every file but the
# manifest first and manifest.json last, then the directory read-only (chmod -R a-w). Prints
# the manifest's sha256 for gate.json remoteChecks; remote_checks.py verifies the rest.
# Refuses an existing directory or an artifact whose manifest names another runId or directory.
# gh runs from this checkout (its origin); GH_REPO overrides that. Exit 64 is a usage error.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
fail() { echo "remote-fetch: $*" >&2; exit 1; }
[[ $# -eq 1 && $1 =~ ^[a-z0-9-]+-[0-9]{8}-[0-9]{6}-[0-9a-f]{6}$ ]] || { echo "usage: remote-fetch.sh <runId>" >&2; exit 64; }
run_id=$1
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
(cd "$repo" && gh run download --name "remote-checks-$run_id" --dir "$stage/$run_id") || fail "gh run download failed for remote-checks-$run_id"
manifest=$stage/$run_id/manifest.json
[[ -f $manifest && ! -L $manifest ]] || fail "artifact remote-checks-$run_id has no manifest.json"
python3 -B -I -c '
import json, sys
manifest = json.load(open(sys.argv[1]))
for key, want in (("kind", "remote-heavy-checks-v1"), ("runId", sys.argv[2]), ("directory", sys.argv[3])):
    if manifest.get(key) != want:
        sys.exit("manifest %s is %r, not %r" % (key, manifest.get(key), want))
' "$manifest" "$run_id" "$dest" || fail "artifact remote-checks-$run_id does not belong at $dest"
mkdir "$dest" || fail "$dest appeared during the fetch"
claimed=1
find "$stage/$run_id" -mindepth 1 -maxdepth 1 ! -name manifest.json -exec mv -t "$dest" {} +
mv "$manifest" "$dest/manifest.json"
chmod -R a-w "$dest"
claimed=0
sha256sum "$dest/manifest.json" | cut -d' ' -f1
