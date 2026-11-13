#!/usr/bin/env bash
# Complete triage CLI with dummy suite/diagnostics: retain original JSON after TMPDIR cleanup.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(mktemp -d "${TMPDIR:?}/triage-evidence-test-XXXXXX")
trap 'rm -rf "$root"' EXIT
mkdir -p "$root/main" "$root/bin" "$root/orch/logs"
git -C "$root/main" init -qb feature/pf1-character-builder
git -C "$root/main" -c user.name=Test -c user.email=test@example.test commit --allow-empty -qm base
echo sample > "$root/main/sample.test.ts"
git -C "$root/main" add -A
git -C "$root/main" -c user.name=Test -c user.email=test@example.test commit -qm sample
cat > "$root/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
[[ $1 != install ]] || exit 0
for arg in "$@"; do
  case $arg in --outputFile.json=*|--outputFile=*) out=${arg#*=} ;; esac
done
if [[ $1 == test ]]; then
  printf '{"success":false,"numFailedTests":1,"numFailedTestSuites":1,"testResults":[{"name":"%s/sample.test.ts","status":"failed","assertionResults":[{"fullName":"a works","status":"failed","duration":100}]}]}' "$PWD" > "$out"
  exit 1
fi
printf '{"testResults":[{"assertionResults":[{"fullName":"a works","status":"passed","duration":100}]}]}' > "$out"
STUB
chmod +x "$root/bin/pnpm"
MAIN="$root/main" EP_ORCH="$root/orch" PATH="$root/bin:$PATH" TRIAGE_EVIDENCE="$root/evidence" \
  bash "$here/triage-failures.sh" "$root/main" > "$root/out" 2>&1 || { cat "$root/out"; exit 1; }
grep -q '^LOAD' "$root/out"
for report in full b1 h1; do [[ -s $root/evidence/$report.json ]] || { cat "$root/out"; echo "FAIL original $report.json was discarded"; exit 1; }; done
echo 'ok    original failed suite and both diagnostic reports survive triage cleanup; legacy LOAD diagnostics preserved'
