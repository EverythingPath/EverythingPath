#!/usr/bin/env bash
# host-audits.sh against a fixture candidate: a stub pnpm writes the Vitest JSON report for the
# selection it is given and notes its checkout and heavy.lock; the real remote_checks.py judges the run.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
run_tmp host-audits-test
dir=$run_tmp
trap 'chmod -R u+w "$dir"; rm -rf "$dir"' EXIT
fails=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: got '$2', want '$3'"; fails=1; fi; }

mkdir -p "$dir/scripts" "$dir/bin" "$dir/orch/logs"
cp "$here/host-audits.sh" "$here/paths.sh" "$here/remote_checks.py" "$here/workflow_evidence.py" "$dir/scripts/"
cat > "$dir/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
[[ $1 == --version ]] && { echo 10.29.1; exit 0; }
[[ $1 == install ]] && exit 0
[[ $1 == test ]] || exit 99
printf '%s\n' "$*" > "$EP_ORCH/pnpm-test-argv"
flock -n "$EP_ORCH/heavy.lock" true && held=no || held=yes
printf '%s %s\n' "$held" "$PWD" > "$EP_ORCH/pnpm-test-context"
for arg; do [[ $arg == --outputFile.json=* ]] && out=${arg#--outputFile.json=}; done
python3 -B "$FIXTURES" report "$PWD" files=tests/b.test.ts ${HOST_REPORT_OPTIONS:-} > "$out"
[[ -z ${SOURCE_EDIT:-} ]] || printf 'changed while the audits ran\n' >> "$SOURCE_EDIT"
exit "${PNPM_TEST_STATUS:-0}"
STUB
chmod +x "$dir/scripts/"*.sh "$dir/bin/pnpm"

main=$dir/main wt=$dir/wt
git init -q -b feature "$main"
printf '{"name":"fixture"}\n' > "$main/package.json"
printf 'lockfileVersion: fixture\n' > "$main/pnpm-lock.yaml"
printf 'node_modules/\n' > "$main/.gitignore"
mkdir -p "$main/scripts/orchestration" "$main/tests"
python3 -B "$here/remote-checks.test.py" audit-list > "$main/scripts/orchestration/host-audits.json"
printf '// fixture\n' > "$main/tests/a.test.ts"; printf '// fixture\n' > "$main/tests/b.test.ts"
git -C "$main" add -A
git -C "$main" -c user.name=Test -c user.email=test@example.test commit -qm base
git -C "$main" worktree add -q -b implementation "$wt"
git -C "$wt" -c user.name=Test -c user.email=test@example.test commit --allow-empty -qm candidate
base=$(git -C "$main" rev-parse HEAD)
read -r manifest sha < <(PATH="$dir/bin:$PATH" python3 -B "$here/remote-checks.test.py" fixture "$dir/orch" "$wt" "$base")

# audit <name> [VAR=value...]: one host-audits.sh run into a fresh evidence directory $dir/orch/<name>.
audit() {
  local name=$1; shift
  mkdir "$dir/orch/$name"; rm -f "$dir/orch/pnpm-test-argv"
  rc=0
  env MAIN="$main" EP_ORCH="$dir/orch" PATH="$dir/bin:$PATH" FIXTURES="$here/remote-checks.test.py" "$@" \
    bash "$dir/scripts/host-audits.sh" "$wt" "$manifest" "${AUDIT_SHA:-$sha}" "$dir/orch/$name" > "$dir/out" 2>&1 || rc=$?
}
field() { python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])' "$@"; }

audit pass
check 'listed tests passing on the gate host pass' "$rc $(grep -c '^host-audits passed: 1 listed tests in 1 files$' "$dir/out")" '0 1'
check 'the verdict is recorded' "$(field "$dir/orch/pass/host-audits.json" passed)" 'True'
check 'Vitest gets exactly the listed files and one anchored pattern' "$(cat "$dir/orch/pnpm-test-argv")" \
  "test tests/b.test.ts --testNamePattern=^(?:suite tests/b\\.test\\.ts works)\$ --reporter=default --reporter=json --outputFile.json=$dir/orch/pass/host-audits-report.json"
check 'the run is in a clean ep-gate-audits checkout under heavy.lock' \
  "$(grep -c "^yes $dir/ep-gate-audits-wt-" "$dir/orch/pnpm-test-context")" '1'
check 'the clean checkout is removed and the list kept' \
  "$(find "$dir" -maxdepth 1 -name 'ep-gate-audits-*' | wc -l) $(cmp -s "$dir/orch/pass/host-audits-list.json" "$wt/scripts/orchestration/host-audits.json" && echo same)" '0 same'

audit skipped HOST_REPORT_OPTIONS=skipped=tests/b.test.ts
check 'a listed test skipped on the gate host fails' \
  "$rc $(grep -c '^host-audits refused: Host-audit test not passed on the gate host: skipped: tests/b.test.ts > suite tests/b.test.ts works$' "$dir/out")" '1 1'
audit exited PNPM_TEST_STATUS=1
check 'a non-zero Vitest exit fails even with a green report' "$rc $(grep -c '^host-audits refused: Host-audit run exited 1$' "$dir/out")" '1 1'
AUDIT_SHA=$(printf '0%.0s' {1..64}) audit hash
check 'another manifest hash is refused' "$rc $(grep -c '^host-audits refused: Remote manifest hash mismatch$' "$dir/out")" '1 1'

# --receipt: the same run for a commit in the main checkout, into a create-only, read-only receipt directory.
mkdir -p "$dir/sources/fixture"; printf 'pinned\n' > "$dir/sources/fixture/record.txt"
commit=$(git -C "$wt" rev-parse HEAD)
receipt() {
  local name=$1; shift
  rm -f "$dir/orch/pnpm-test-argv"
  rc=0
  env MAIN="$main" EP_ORCH="$dir/orch" PATH="$dir/bin:$PATH" FIXTURES="$here/remote-checks.test.py" "$@" \
    bash "$dir/scripts/host-audits.sh" --receipt "${RECEIPT_COMMIT:-$commit}" "$base" "${RECEIPT_DIR:-$dir/orch/host-audits-receipts/$name}" > "$dir/out" 2>&1 || rc=$?
}
modes() { stat -c %a "$1" "$1"/* | sort -u | tr '\n' ' '; }
verify_receipt() {
  env MAIN="$main" PATH="$dir/bin:$PATH" python3 -B -c 'import sys; sys.path.insert(0, sys.argv[1]); import remote_checks as r
r.verify_receipt(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6], sys.argv[7], sys.argv[8], sys.argv[9]); print("verified")' \
    "$here" "$1" "$2" "$(git -C "$wt" rev-parse 'HEAD^{tree}')" "$base" "$wt" "$dir/orch" \
    "$(sha256sum < "$wt/scripts/orchestration/host-audits.json" | cut -d' ' -f1)" "$main" 2>&1 | tail -1
}
receipt r1
path=$dir/orch/host-audits-receipts/r1/receipt.json
check 'a receipt run passes and names its receipt' \
  "$rc $(grep -c '^host-audits receipt passed: 1 listed tests in 1 files$' "$dir/out") $(grep -c "^host-audits receipt: $path [0-9a-f]\{64\}\$" "$dir/out")" '0 1 1'
check 'the receipt directory holds the receipt, list and report, all read-only' \
  "$(ls "$dir/orch/host-audits-receipts/r1" | tr '\n' ' ')$(modes "$dir/orch/host-audits-receipts/r1")" \
  'host-audits-list.json host-audits-report.json receipt.json 444 555 '
check 'the receipt run is the same selection in a clean checkout of the commit under heavy.lock, then removed' \
  "$(grep -c "^yes $dir/ep-gate-audits-receipt-r1-" "$dir/orch/pnpm-test-context") $(find "$dir" -maxdepth 1 -name 'ep-gate-audits-*' | wc -l) $(grep -c -- '--testNamePattern=^(?:suite tests/b\\.test\\.ts works)\$' "$dir/orch/pnpm-test-argv")" '1 0 1'
check 'the gate verifies the receipt for the candidate' "$(verify_receipt "$path" "$(grep -o '[0-9a-f]\{64\}$' "$dir/out")")" 'verified'
receipt r1
check 'an existing receipt directory is refused before anything runs (create-only)' \
  "$rc $(grep -c 'the receipt directory exists or cannot be created (create-only)' "$dir/out") $([[ -e $dir/orch/pnpm-test-argv ]] && echo ran || echo none)" '1 1 none'
RECEIPT_DIR=$dir/orch/elsewhere/r2 receipt r2
check 'a receipt directory outside ORCH/host-audits-receipts is refused' "$rc $(grep -c 'the receipt directory must be' "$dir/out")" '1 1'
RECEIPT_COMMIT=$(printf 'f%.0s' {1..40}) receipt r3
check 'an unknown commit is refused' "$rc $(grep -c 'no commit' "$dir/out") $([[ -e $dir/orch/host-audits-receipts/r3 ]] && echo made || echo none)" '1 1 none'
receipt r4 PNPM_TEST_STATUS=1
check 'a failed run still writes its read-only receipt, which records the refusal and fails' \
  "$rc $(grep -c '^host-audits receipt refused: Host-audit run exited 1$' "$dir/out") $(field "$dir/orch/host-audits-receipts/r4/receipt.json" verdict | grep -c "'passed': False") $(modes "$dir/orch/host-audits-receipts/r4")" \
  '1 1 1 444 555 '
receipt r5 SOURCE_EDIT="$dir/sources/fixture/record.txt"
check 'a source changed while the audits run refuses the receipt, which binds the inputs the run started from' \
  "$rc $(grep -c '^host-audits receipt refused: Host-audit inputs changed during the run: ~/repos/everythingpath/sources/fixture$' "$dir/out") $(field "$dir/orch/host-audits-receipts/r5/receipt.json" verdict | grep -c "'passed': False") $(ls "$dir/orch/host-audits-receipts/r5" | tr '\n' ' ')$(modes "$dir/orch/host-audits-receipts/r5")" \
  '1 1 1 host-audits-list.json host-audits-report.json receipt.json 444 555 '
printf 'pinned\n' > "$dir/sources/fixture/record.txt"
printf 'outside the source\n' > "$dir/outside.txt"; ln -s "$dir/outside.txt" "$dir/sources/fixture/linked.txt"
receipt r6
check 'a source holding a symlink is refused, naming the link, before anything runs (links are not followed)' \
  "$rc $(grep -cxF "remote refused: Host-audit source holds a symlink (links are not followed): $dir/sources/fixture/linked.txt" "$dir/out") $(grep -c "could not capture the run's inputs" "$dir/out") $([[ -e $dir/orch/pnpm-test-argv || -e $dir/orch/host-audits-receipts/r6/receipt.json ]] && echo ran || echo none)" '1 1 1 none'
rm "$dir/sources/fixture/linked.txt"

git -C "$wt" rm -q scripts/orchestration/host-audits.json
git -C "$wt" -c user.name=Test -c user.email=test@example.test commit -qm 'no list'
audit nolist
check 'a candidate without a list fails before Vitest' "$rc $(grep -c 'the candidate has no host-audit list' "$dir/out") $([[ -e $dir/orch/pnpm-test-argv ]] && echo ran || echo none)" '1 1 none'
exit $fails
