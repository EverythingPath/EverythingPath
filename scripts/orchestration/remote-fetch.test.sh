#!/usr/bin/env bash
# usage: remote-fetch.test.sh — checks remote-fetch.sh with a fake gh on PATH: the published
# directory, read-only files and printed sha256, create-only refusal, usage, a failed
# download, and artifacts without a manifest or for another runId or directory. Uses a
# scratch EP_ORCH under $TMPDIR; no GitHub call.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
dir=$(mktemp -d "${TMPDIR:?TMPDIR}/remote-fetch-test-XXXXXX") || exit 1
trap 'chmod -R u+w "$dir" 2> /dev/null; rm -rf "$dir"' EXIT
mkdir -p "$dir/orch" "$dir/bin" "$dir/artifacts"
# Fake gh: `gh run download --name <artifact> --dir <dir>` copies artifacts/<artifact>/ and
# logs its argv; any other call, or an unknown artifact, fails.
cat > "$dir/bin/gh" <<STUB
#!/usr/bin/env bash
printf '%s\n' "\$*" >> "$dir/gh.log"
[[ "\$1 \$2 \$3 \$5" == "run download --name --dir" && \$# -eq 6 ]] || exit 2
[[ -d $dir/artifacts/\$4 ]] || { echo "no artifact \$4" >&2; exit 1; }
mkdir -p "\$6" && cp -R "$dir/artifacts/\$4/." "\$6/"
STUB
chmod +x "$dir/bin/gh"
export EP_ORCH=$dir/orch PATH=$dir/bin:$PATH
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
# artifact <runId> [manifest runId] [manifest directory]: a CI artifact with logs, report and manifest.
artifact() {
  local a=$dir/artifacts/remote-checks-$1
  mkdir -p "$a"
  printf 'log\n' > "$a/install.log"; printf '{}\n' > "$a/full.json"
  printf '{"kind": "remote-heavy-checks-v1", "runId": "%s", "directory": "%s"}\n' "${2:-$1}" "${3:-$EP_ORCH/remote-checks/$1}" > "$a/manifest.json"
}
fetch() { bash "$here/remote-fetch.sh" "$@" 2> "$dir/err"; }

id=w1-20261102-101500-abc123
artifact "$id"
out=$(fetch "$id"); status=$?
check "a fetch exits 0" "$status" 0
check "it prints the manifest sha256" "$out" "$(sha256sum "$EP_ORCH/remote-checks/$id/manifest.json" | cut -d' ' -f1)"
check "it publishes every artifact file" "$(cd "$EP_ORCH/remote-checks/$id" && ls | tr '\n' ' ')" "full.json install.log manifest.json "
check "nothing in it is writable" "$(find "$EP_ORCH/remote-checks/$id" -perm /222 | wc -l)" 0
check "gh downloads the runId's artifact" "$(tail -1 "$dir/gh.log" | cut -d' ' -f1-4)" "run download --name remote-checks-$id"
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

missing=w1-20261102-101600-def456
fetch "$missing" > /dev/null; status=$?
check "a failed download is refused" "$status $(grep -c 'gh run download failed' "$dir/err")" "1 1"
check "and publishes nothing" "$(ls -A "$EP_ORCH/remote-checks" | tr '\n' ' ')" "$id "

empty=w1-20261102-101700-0a0b0c
artifact "$empty"; rm "$dir/artifacts/remote-checks-$empty/manifest.json"
fetch "$empty" > /dev/null; status=$?
check "an artifact without a manifest is refused" "$status $(grep -c 'no manifest.json' "$dir/err")" "1 1"

other=w1-20261102-101800-1a2b3c
artifact "$other" w1-20261102-101800-ffffff
fetch "$other" > /dev/null; status=$?
check "a manifest for another runId is refused" "$status $(grep -c 'does not belong' "$dir/err")" "1 1"
moved=w1-20261102-101900-4d5e6f
artifact "$moved" "$moved" "/elsewhere/remote-checks/$moved"
fetch "$moved" > /dev/null; status=$?
check "a manifest naming another directory is refused" "$status $(grep -c 'does not belong' "$dir/err")" "1 1"
check "refusals publish nothing" "$(ls -A "$EP_ORCH/remote-checks" | tr '\n' ' ')" "$id "
exit $fail
