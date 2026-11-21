#!/usr/bin/env bash
# The documented round commands (t3-direct-dispatch fix r8, r9): every line of the repository's Markdown that names
# the bridge or the record step (scripts/catalog/t3-review-bridge.* or scripts/catalog-record-review.*, by path or
# file name), however it is launched, is read by the runner, which classifies each name by the code around it (the
# code before the name is its launcher): a round command is required to be the launcher's form and is run, as
# documented, with TMPDIR at the round it operates on, and declines leaving the round unchanged; a command with no
# round action and a name nothing starts are listed. The runner is the Vitest case "runs every round command of the
# record step help, and of the documents ..." in tests/catalog/t3-review-evidence.test.ts; no test of the full suite
# may read a lane-eligible file (operations.md, "Light landing lane"), so there it runs the help's commands alone,
# and this test, which may read them, hands it copies of the documents (EP_T3_DOCUMENTS). The runbook
# (docs/agents/orchestration/t3-reviews.md) and its reference (docs/agents/orchestration-reference/t3-review-evidence.md)
# are named here, so the light lane refuses a change to either (its census). A grep finds every line naming either
# entry point, so a line the runner did not read fails here.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
dir=$(mktemp -d "${TMPDIR:?}/t3-review-commands-test-XXXXXX")
trap 'rm -rf "$dir"' EXIT
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }

# The runner's entryName: either entry point's path or file name, .ts, .mjs, .js and the rest.
names='(catalog-record-review|t3-review-bridge)\.[cm]?[jt]s\b'
mkdir "$dir/documents"
git -C "$root" ls-files -z -- '*.md' ':!scripts/catalog/review-reports/*' | while IFS= read -r -d '' file; do
  grep -qE "$names" "$root/$file" || continue
  mkdir -p "$dir/documents/$(dirname "$file")"
  cp "$root/$file" "$dir/documents/$file"
done
for file in docs/agents/orchestration/t3-reviews.md docs/agents/orchestration-reference/t3-review-evidence.md; do
  check "$file is handed over" "$([[ -f $dir/documents/$file ]] && echo yes)" yes
done
(cd "$dir/documents" && grep -rnE "$names" --include='*.md' . | cut -d: -f1,2 | sed 's|^\./||' | sort -u) > "$dir/expected"
check "the documents name the bridge or the record step" "$([[ -s $dir/expected ]] && echo yes)" yes

if (cd "$root" && EP_T3_DOCUMENTS=$dir/documents EP_T3_EXERCISED=$dir/exercised CI=true \
  pnpm -s vitest run tests/catalog/t3-review-evidence.test.ts -t 'runs every round command of the record step help, and of the documents' > "$dir/vitest.log" 2>&1); then
  vitest=passed
else
  vitest=failed; cat "$dir/vitest.log"
fi
check "the runner passes" "$vitest" passed
check "the runner read every line naming either entry point, and only those" \
  "$(cut -d' ' -f1 "$dir/exercised" 2> /dev/null | sort -u | paste -sd ' ')" "$(paste -sd ' ' "$dir/expected")"
runbook=$(grep -c '^docs/agents/orchestration/t3-reviews.md:[0-9]* command$' "$dir/exercised" 2> /dev/null || true)
check "the runbook gives round commands (its loader, --t3-run and --verify at least)" "$(( ${runbook:-0} >= 3 ))" 1
exit $fail
