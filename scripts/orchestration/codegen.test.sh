#!/usr/bin/env bash
# Stub only Node: verify delegation, status propagation and that Cloud env
# files are never sourced. The runner's lifecycle is tested in Vitest.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
run_tmp codegen-test || exit 1
dir=$run_tmp
trap 'rm -rf "$dir"' EXIT
mkdir -p "$dir/main" "$dir/wt" "$dir/bin"
cat > "$dir/bin/node" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$PWD" "$TMPDIR" "$@" > "$STUB_DIR/invocation"
exit "${STUB_STATUS:-0}"
STUB
chmod +x "$dir/bin/node"
# These must never execute, even though the former wrapper sourced main's file.
printf 'touch "%s/sourced"\n' "$dir" > "$dir/main/.env.local"
printf 'owner data\n' > "$dir/wt/.env.local"
fail=0
check() { if eval "$2"; then echo "ok    $1"; else echo "FAIL  $1"; cat "$dir/out"; fail=1; fi; }
run() { MAIN=$dir/main PATH=$dir/bin:$PATH STUB_DIR=$dir STUB_STATUS=$1 "$here/codegen.sh" "$dir/wt" > "$dir/out" 2>&1; }
run 0; rc=$?
expected_args=$'--import\ntsx\nscripts/local-convex/codegen.ts'
check 'uses the local runner from the requested checkout' '(( rc == 0 )) && [[ $(head -1 "$dir/invocation") == "$dir/wt" ]] && [[ $(tail -3 "$dir/invocation") == "$expected_args" ]]'
check 'scratch is outside the checkout and Cloud env files are untouched' '[[ $(sed -n "2p" "$dir/invocation") == "$dir/.ep-tmp" && ! -e $dir/sourced && $(cat "$dir/wt/.env.local") == "owner data" ]]'
rm "$dir/main/.env.local"
run 0; rc=$?
check 'does not require a Cloud env file' '(( rc == 0 ))'
run 42; rc=$?
check 'propagates a failed local runner without a Cloud fallback' '(( rc == 42 ))'
exit "$fail"
