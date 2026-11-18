#!/usr/bin/env bash
# usage: cur-prep.test.sh — checks cur-prep.sh with dummy commands: the light
# test plan (the whole diff's batch tests, older batches' tests, the guards,
# the tests test:affected reaches), the launch inventory and conditions report
# checks, automatic and explicit --full, the shared-store count it writes into
# the report, and its receipt; --remote-suite (every check but Vitest, a
# tests=remote receipt) and which receipts prep_reusable lets stand in, with
# and without remote checks. A throwaway repository under $repos/.ep-tmp; a pnpm
# stub that only logs.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-test-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/cur-prep-test-XXXXXX") || exit 1
trap 'rm -rf "$root"' EXIT
# The fixtures' commits in this shell need an identity of their own (a CI runner has none; prep_fixture's exports
# stay in its subshell), and the receipt records TZ, which CI's static job sets (gate-ci-workflow).
export GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.test GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.test
unset TZ
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
case_no=0
# fresh: a new fixture in its own directory; sets d and wt.
fresh() {
  d=$root/case$(( ++case_no )); mkdir -p "$d"
  (prep_fixture "$d") > /dev/null 2>&1 || { echo "FAIL  fixture"; exit 1; }
  wt=$d/ep-cur-901
}
# prep [args...]: runs cur-prep.sh for #901 in the current fixture; output in $d/out.
prep() {
  (
    export PNPM_LOG=$d/pnpm.log MAIN=$d/main EP_ORCH=$d/orch PATH=$d/bin:$PATH CI=true VITEST_MAX_WORKERS=1
    export GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.test GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.test
    bash "$here/cur-prep.sh" "$@" 901 "$d/orch/briefs/cur-901-msg.txt"
  ) > "$d/out" 2>&1
}
tests_run() { PNPM_LOG=$d/pnpm.log prep_tests_run | tr '\n' ' '; }
feature() { git -C "$d/main" rev-parse feature/pf1-character-builder; }
receipt() { sed -n "s/^$1=//p" "$d/orch/logs/cur-901-prep.receipt"; }

# --- Light prep ---
fresh
prep; status=$?
check "light prep passes" "$status" 0
check "light prep runs the whole diff's batch tests, the older batch's tests and the guards, not tests/catalog" "$(tests_run)" \
  "tests/catalog/batch-ownership-sweep.test.ts tests/catalog/batch-ownership.test.ts tests/catalog/cross-batch-bindings.test.ts tests/catalog/notice-holds.test.ts tests/catalog/pinned-sources.test.ts tests/catalog/review-receipts.test.ts tests/catalog/traits-370.test.ts tests/catalog/traits-901.test.ts tests/catalog/traits370.integration.test.ts tests/catalog/traits901.integration.test.ts "
check "it still runs the format check and notice-deps" "$(grep -c -e '^-s catalog:format --check$' -e '^-s catalog:notice-deps$' "$d/pnpm.log")" 2
check "the batch is one commit on the feature head" "$(git -C "$wt" rev-list --count "$(feature)..HEAD") $(git -C "$wt" rev-parse HEAD^)" "1 $(feature)"
check "prep writes the post-rebase shared-store count into the report" \
  "$(git -C "$wt" show HEAD:docs/catalog-import/traits-901.md | sed -n '/^<!-- prep:shared-store-count -->$/,/^<!-- \/prep/p')" \
  "<!-- prep:shared-store-count -->
New shared-store files (\`tests/fixtures/pinned/\`), counted by prep after the rebase onto \`$(feature | cut -c1-8)\`: **2** (pf1-content 2).
<!-- /prep:shared-store-count -->"
check "the rest of the report is untouched" "$(git -C "$wt" show HEAD:docs/catalog-import/traits-901.md | grep -c -e '^## Preservation and gates$' -e '^The end.$')" 2
check "the worktree is clean" "$(git -C "$wt" status --porcelain)" ""
check "the receipt binds the commit, its tree, the base and the mode" "$(receipt result) $(receipt commit) $(receipt tree) $(receipt base) $(receipt mode)" \
  "ok $(git -C "$wt" rev-parse HEAD) $(git -C "$wt" rev-parse 'HEAD^{tree}') $(feature) light"
check "the receipt records the test environment" "$(receipt env)" "CI=true VITEST_MAX_WORKERS=1 VITEST_MIN_WORKERS=- VITEST_POOL=- TZ=-"
check "the receipt records the lockfile, the scripts and the check configuration" \
  "$(receipt lockfile | grep -cE '^[0-9a-f]{40} [0-9a-f]{40}$') $(receipt scripts | grep -cE '^[0-9a-f]{64}$') $(receipt config | grep -cE '^[0-9a-f]{64}$')" "1 1 1"
check "a local prep's receipt says its tests ran here, and records the toolchain" "$(receipt tests) $(receipt toolchain)" "local node $(node --version) pnpm 10.0.0-stub"
head=$(git -C "$wt" rev-parse HEAD)
prep; status=$?
check "a second prep finds the count current and leaves the commit alone" "$status $(git -C "$wt" rev-parse HEAD) $(grep -c 'the count in docs/catalog-import/traits-901.md is current' "$d/out")" "0 $head 1"

# --- Artifact rejection stops expensive preparation and leaves no receipt ---
: > "$d/pnpm.log"
PNPM_FAIL_ARTIFACT=1 prep; status=$?
check "artifact rejection stops before install, formatting or tests" \
  "$(( status != 0 )) $(grep -c -E '^(install |test |.*catalog:format)' "$d/pnpm.log") $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none)" "1 0 none"
check "artifact check pins the frozen integration base" "$(grep -c "^-s check:artifacts --base $(feature)$" "$d/pnpm.log")" 1
prep; check "a passing guard allows preparation and a new receipt" "$? $(receipt result)" "0 ok"

# --- Failure leaves no receipt ---
PNPM_FAIL_TEST=1 prep; status=$?
check "a failing test fails prep and removes the receipt" "$(( status != 0 )) $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none)" "1 none"
check "the failure summary is shown with the log's path" "$(grep -c 'FAIL  tests/catalog/traits-901.test.ts' "$d/out") $(grep -c '^full test output: .*/orch/logs/cur-901-prep-[0-9]\{8\}-[0-9]\{6\}-[A-Za-z0-9]\{6\}-vitest.log$' "$d/out")" "1 1"
raw=$(sed -n 's/^full test output: //p' "$d/out")
check "the full output keeps the startup error, the assertion diff and the stack" \
  "$(grep -c -e '^Error: Cannot find module ./missing-helper (startup)$' -e '^AssertionError: expected 2 to be 1$' -e '^- Expected$' -e '^+ Received$' -e '^- 1$' -e '^+ 2$' -e '❯ tests/catalog/traits-901.test.ts:12:5$' "$raw")" 7

# --- An edit while any check runs gets no receipt ---
amend="echo late >> '$wt/docs/catalog-import/traits-901.md'; git -C '$wt' commit -qa --amend --no-edit"
for step in check:artifacts install; do
  : > "$d/pnpm.log"
  PNPM_HOOK_ON=$step PNPM_HOOK=$amend prep; status=$?
  check "a commit amended during $step stops before later checks with no receipt" \
    "$status $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none) $(grep -c 'changed while the checks ran; no receipt' "$d/out") $(grep -c -E '^(test |.*catalog:format)' "$d/pnpm.log")" "5 none 1 0"
  if [[ $step == check:artifacts ]]; then
    check "movement during the guard prevents install" "$(grep -c '^install ' "$d/pnpm.log")" 0
  fi
done
for step in catalog:format catalog:notice-deps plan test; do
  if [[ $step == plan ]]; then GIT_HOOK=$amend prep; status=$?
  else PNPM_HOOK_ON=$step PNPM_HOOK=$amend prep; status=$?
  fi
  check "a commit amended during $step gets no receipt" \
    "$status $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none) $(grep -c 'changed while the checks ran; no receipt' "$d/out")" "5 none 1"
done
prep; check "the amended commit gets its own prep" "$? $(receipt commit)" "0 $(git -C "$wt" rev-parse HEAD)"

# --- A light prep in a bounded unit keeps its light reservation ---
fresh
printf '#!/usr/bin/env bash\necho "$*" >> "%s/admission.log"\n' "$d" > "$d/admission-stub.sh"
BOUNDED_RESERVATION=prep901-y BOUNDED_ADMISSION_LIB=$d/admission-stub.sh prep; status=$?
check "a light prep doesn't escalate" "$status $(cat "$d/admission.log" 2> /dev/null)" "0 "

# --- --full keeps the old behaviour ---
prep --full; status=$?
check "--full runs tests/catalog and the batch's tests" "$status $(tests_run | cut -d' ' -f1) $(tests_run | grep -c 'traits-901.test.ts')" "0 tests/catalog 1"
check "--full is recorded in the receipt" "$(receipt mode)" full

# --- Automatic --full ---
fresh
echo "#901 tooling fix" >> "$wt/scripts/catalog/import.ts"
prep; status=$?
check "a shared tooling change makes prep full" "$status $(tests_run | cut -d' ' -f1) $(grep -c '^reason scripts/catalog/import.ts$' "$d/out")" "0 tests/catalog 1"
# In a bounded unit (BOUNDED_RESERVATION) a prep that turns full grows its
# light memory reservation to full before its tests (admission.sh escalate).
printf '#!/usr/bin/env bash\necho "$*" >> "%s/admission.log"\nexit "${ADMISSION_STUB_STATUS:-0}"\n' "$d" > "$d/admission-stub.sh"
reserved() { BOUNDED_RESERVATION=prep901-x BOUNDED_ADMISSION_LIB=$d/admission-stub.sh prep "$@"; }
reserved; status=$?
check "a prep that turns full asks for the full reservation before its tests" "$status $(cat "$d/admission.log")" "0 escalate prep901-x"
rm -f "$d/admission.log"
runs=$(grep -c '^test ' "$d/pnpm.log")
ADMISSION_STUB_STATUS=143 reserved; status=$?
check "and stops, before its tests, when it can't get it" "$status $(grep -c '^test ' "$d/pnpm.log")" "143 $runs"
fresh
echo "edited" >> "$wt/tests/fixtures/pinned/pf1/packs/existing.yaml"
prep
check "an edited shared-store file makes prep full" "$(tests_run | cut -d' ' -f1) $(grep -c '^reason shared-store file tests/fixtures/pinned/pf1/packs/existing.yaml changed (M)$' "$d/out")" "tests/catalog 1"
fresh
mkdir -p "$wt/tests/fixtures/cross-batch-999"; echo x > "$wt/tests/fixtures/cross-batch-999/x.json"
prep
check "a fixture of no batch inventory is uncertain: full" "$(tests_run | cut -d' ' -f1)" tests/catalog
fresh
git -C "$d/main" rm -q tests/catalog/batch-ownership-sweep.test.ts && git -C "$d/main" commit -qm "drop a guard"
prep
check "a missing guard makes prep full" "$(tests_run | cut -d' ' -f1) $(grep -c '^reason guard tests/catalog/batch-ownership-sweep.test.ts missing$' "$d/out")" "tests/catalog 1"

# --- Shared validators in test files escalate ---
fresh
echo "// a new schema rule" >> "$wt/tests/catalog/notice-holds.test.ts"
prep
check "a changed guard (notice-holds) makes prep full" "$(tests_run | cut -d' ' -f1) $(grep -c '^reason shared validator tests/catalog/notice-holds.test.ts changed$' "$d/out")" "tests/catalog 1"
fresh
echo "// receipts" >> "$wt/tests/catalog/review-receipts.test.ts"
prep
check "a changed receipt validator makes prep full" "$(tests_run | cut -d' ' -f1)" tests/catalog
fresh
echo "export const helper = 1;" > "$wt/tests/catalog/shared-helper.test.ts"
prep
check "a test file that exports helpers makes prep full" "$(tests_run | cut -d' ' -f1) $(grep -c '^reason shared validator tests/catalog/shared-helper.test.ts changed$' "$d/out")" "tests/catalog 1"

# --- Other tests in the diff ---
fresh
mkdir -p "$wt/convex"; echo x > "$wt/convex/catalogTraits901.integration.test.ts"
prep
check "a changed test outside tests/catalog is run, light" \
  "$(tests_run | tr ' ' '\n' | grep -c '^convex/catalogTraits901.integration.test.ts$') $(grep -c '^mode light$' "$d/out")" "1 1"

# --- Tests the change reaches (test:affected) ---
fresh
PNPM_AFFECTED=$'tests/catalog/curation.test.ts\nsrc/lib/reached.test.ts' prep
check "light prep adds the tests test:affected reaches from the base" \
  "$(tests_run | tr ' ' '\n' | grep -c -e '^tests/catalog/curation.test.ts$' -e '^src/lib/reached.test.ts$') $(grep -c '^mode light$' "$d/out") $(grep -c "^-s test:affected --base $(feature)$" "$d/pnpm.log")" "2 1 1"
fresh
PNPM_AFFECTED_STATUS=3 prep
check "a test:affected failure (or exit 3, every test) makes prep full" \
  "$(tests_run | cut -d' ' -f1) $(grep -c '^reason test:affected exited 3$' "$d/out")" "tests/catalog 1"
fresh
git -C "$d/main" rm -q scripts/affected-tests.ts
git -C "$d/main" -c user.name=Test -c user.email=test@example.test commit -qm "no affected-tests"
prep
check "a head without scripts/affected-tests.ts plans without it" \
  "$(grep -c 'test:affected' "$d/pnpm.log") $(grep -c '^mode light$' "$d/out")" "0 1"

# --- Generated expectations ---
fresh
PNPM_FAIL_INVENTORY=1 prep; status=$?
check "a failed launch inventory check stops prep before its tests" \
  "$(( status != 0 )) $(grep -c '^test ' "$d/pnpm.log") $(grep -c '^-s catalog:launch-inventory --check$' "$d/pnpm.log")" "1 0 1"
fresh
PNPM_CONDITIONS_DRIFT=1 prep; status=$?
check "catalog:conditions output unlike the committed report stops prep before its tests" \
  "$(( status != 0 )) $(grep -c '^test ' "$d/pnpm.log") $(grep -c 'docs/catalog-import/conditions-admission.json' "$d/out")" "1 0 1"
fresh
prep
check "matching generated expectations pass" "$(grep -c -e '^-s catalog:launch-inventory --check$' -e '^-s catalog:conditions$' "$d/pnpm.log") $(grep -c '^test ' "$d/pnpm.log")" "2 1"

# --- A report without the marker ---
fresh
sed -i '/prep:shared-store-count/d' "$wt/docs/catalog-import/traits-901.md"
prep; status=$?
check "a report without the marker gets a printed count and a warning, not a failure" \
  "$status $(grep -c '^shared-store files added against [0-9a-f]\{12\}: 2 (pf1-content 2)$' "$d/out") $(grep -c 'no <!-- prep:shared-store-count --> marker block' "$d/out")" "0 1 1"
# marked <name> <report body>: a fresh batch whose report has these markers;
# prep must warn and leave the report as the curator wrote it.
marked() {
  fresh
  printf '%s' "$2" > "$wt/docs/catalog-import/traits-901.md"
  prep; status=$?
  check "$1: a warning, a printed count, no edit" \
    "$status $(grep -c "warning: docs/catalog-import/traits-901.md: $3" "$d/out") $(grep -c '^shared-store files added against' "$d/out") $(git -C "$wt" show HEAD:docs/catalog-import/traits-901.md | sha256sum | cut -c1-12)" \
    "0 1 1 $(printf '%s' "$2" | sha256sum | cut -c1-12)"
}
marked "reversed markers" $'# R\n\n<!-- /prep:shared-store-count -->\nkept\n<!-- prep:shared-store-count -->\nkept too\n' "the count markers are reversed"
marked "duplicate markers" $'# R\n<!-- prep:shared-store-count -->\nx\n<!-- /prep:shared-store-count -->\nkept\n<!-- prep:shared-store-count -->\ny\n<!-- /prep:shared-store-count -->\n' "more than one count marker pair"
# --- Two batch reports ending in -901.md ---
# The batch's own is the one of them that carries the marker block; the other is left as it is.
fresh
printf '# Feats #901\n\nAnother family, same issue number.\n' > "$wt/docs/catalog-import/feats-901.md"
prep; status=$?
check "with two reports for #901, prep writes the count into the one with the marker block" \
  "$status $(git -C "$wt" show HEAD:docs/catalog-import/traits-901.md | grep -c '^New shared-store files .*: \*\*2\*\* (pf1-content 2)\.$') $(grep -c 'wrote the count into docs/catalog-import/traits-901.md' "$d/out")" "0 1 1"
check "and leaves the other report as written" "$(git -C "$wt" show HEAD:docs/catalog-import/feats-901.md | sha256sum | cut -c1-12)" \
  "$(printf '# Feats #901\n\nAnother family, same issue number.\n' | sha256sum | cut -c1-12)"
# Both carry the marker block: ambiguous, so prep fails naming both and writes no receipt.
fresh
printf '# Feats #901\n\n<!-- prep:shared-store-count -->\nold\n<!-- /prep:shared-store-count -->\n' > "$wt/docs/catalog-import/feats-901.md"
prep; status=$?
check "two reports for #901 that both carry the marker block fail prep, naming both, with no receipt" \
  "$(( status != 0 )) $(grep -c '^prep: more than one batch report for #901 carries the count marker block: docs/catalog-import/feats-901.md docs/catalog-import/traits-901.md' "$d/out") $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none)" "1 1 none"
check "and edits neither report" "$(git -C "$wt" show HEAD:docs/catalog-import/traits-901.md | grep -c 'The curator counted 3 new files.') $(git -C "$wt" show HEAD:docs/catalog-import/feats-901.md | grep -cx old)" "1 1"
# --- Conflicts in the append-only tables go to catalog:merge ---
fresh
table=tests/catalog/cross-batch-bindings.ts
printf 'feature row\n' > "$d/main/$table"
git -C "$d/main" add -A && git -C "$d/main" commit -qm "another batch appends a row"
printf 'batch row\n' > "$wt/$table"
PNPM_MERGE="printf 'feature row\\nbatch row\\n' > $table" prep; status=$?
check "a conflict in an append-only table is merged by catalog:merge and the rebase goes on" \
  "$status $(git -C "$wt" show "HEAD:$table" | paste -sd ' ') $(git -C "$wt" rev-parse HEAD^)" "0 feature row batch row $(feature)"
fresh
printf 'feature row\n' > "$d/main/$table"
git -C "$d/main" add -A && git -C "$d/main" commit -qm "another batch appends a row"
printf 'batch row\n' > "$wt/$table"
PNPM_MERGE="echo '$table:' >&2; exit 1" prep; status=$?
check "a table conflict catalog:merge leaves unresolved stops prep, naming the file" \
  "$(( status != 0 )) $(grep -c "^$table:$" "$d/out") $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none)" "1 1 none"

# --- Conflicts in the generated launch artifacts are regenerated ---
# The pnpm stub's generator (PNPM_GENERATE) writes every path in
# prep_regen_files from one input, the shared data file below, as the
# regeneration chain writes the generated launch artifacts from a batch's
# inputs; catalog:merge takes that file's union.
scopes=scripts/catalog/scopes
gen_input=scripts/catalog/reviewed-curation.json
# generated_from <path> <checkout>: what the generator writes for <path> from that checkout's input.
generated_from() { echo "$1 of $(paste -sd ' ' "$2/$gen_input")"; }
# merged_of <path>: what it writes from the input at the batch's HEAD.
merged_of() { echo "$1 of $(git -C "$wt" show "HEAD:$gen_input" | paste -sd ' ')"; }
# regen_conflict [--hand] <path>...: a fresh fixture whose feature head and
# batch both change these files and the input, so the rebase conflicts in
# them. The batch regenerated them from its own input (#901's row), or, with
# --hand, edited them by hand: its change then does not follow from its input.
regen_conflict() {
  local f hand=
  [[ $1 == --hand ]] && { hand=1; shift; }
  fresh
  echo "base row" >> "$d/main/$gen_input"
  for f in "$@"; do
    echo "$f base side" > "$d/main/$f"
    if [[ -n $hand ]]; then echo "$f batch side" > "$wt/$f"; else generated_from "$f" "$wt" > "$wt/$f"; fi
  done
  git -C "$d/main" add -A && git -C "$d/main" commit -qm "a proof-family landing regenerates the launch artifacts"
}
# regen_prep [args...]: prep with the generator, and a catalog:merge that takes the input's union.
regen_prep() {
  PNPM_GENERATE=$gen_input PNPM_GENERATED="${prep_regen_files[*]}" \
    PNPM_MERGE="if git ls-files -u -- $gen_input | grep -q .; then { git show :2:$gen_input; git show :3:$gen_input; } | awk '!seen[\$0]++' > $gen_input.union && mv $gen_input.union $gen_input; fi" \
    prep "$@"
}
receipt_file() { [[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none; }
generated=("$scopes/campaign-mvp-v1.json" "$scopes/campaign-mvp-v1.verification.json" tests/catalog/launch-document.test.ts)
# The batch also regenerated the records dictionary, which the feature head
# left alone: git takes the batch side there without a conflict.
regen_conflict "${generated[@]}"
generated_from "$scopes/campaign-mvp-v1.records.json" "$wt" > "$wt/$scopes/campaign-mvp-v1.records.json"
wave_content=$(cat "$wt/${generated[0]}")
regen_prep; status=$?
check "a rebase with conflicts only in generated launch artifacts resolves and passes" \
  "$status $(git -C "$wt" rev-list --count "$(feature)..HEAD") $(git -C "$wt" rev-parse HEAD^) $(git -C "$wt" status --porcelain | wc -l)" "0 1 $(feature) 0"
check "the batch's own files stay" "$(git -C "$wt" show HEAD:scripts/catalog/legal/traits-901.json)" "scripts/catalog/legal/traits-901.json"
check "the merged input holds both sides' rows" "$(git -C "$wt" show "HEAD:$gen_input" | tail -n 2 | paste -sd ' ')" "base row #901 records"
check "every generated artifact is regenerated from the merged input, the dictionary included, never merged" \
  "$(for f in "${prep_regen_files[@]}"; do [[ $(git -C "$wt" show "HEAD:$f") == "$(merged_of "$f")" ]] || echo "$f"; done)" ""
# The batch's commit before the rebase, and the commit it was made on.
wave=$(sed -n 's#^-s exec tsx [^ ]*/prep-regen.ts check [0-9a-f]\{40\} \([0-9a-f]\{40\}\)$#\1#p' "$d/pnpm.log")
wave_base=$(git -C "$d/main" rev-list --max-parents=0 HEAD)
check "the wave check gets the batch's commit before the rebase and the commit it was made on" \
  "$(git -C "$wt" rev-parse "$wave^") $(git -C "$wt" show "$wave:${generated[0]}")" "$wave_base $wave_content"
# regen_log: the wave check, the chain's commands and the inventory checks
# prep ran, in order; the pin's summary is SUMMARY on the merged inputs and
# WAVE-SUMMARY on the batch's own commit.
regen_log() {
  grep -E 'prep-regen.ts|catalog:(launch-|attribution-227-matches|party-scope)' "$d/pnpm.log" \
    | sed -E 's#^-s exec tsx [^ ]*/prep-regen.ts#prep-regen.ts#; s#(pin) [^ ]*/launch-summary.json#\1 SUMMARY#; s#(pin) [^ ]*/wave-summary.json#\1 WAVE-SUMMARY#' | paste -sd '|'
}
# chain_log <summary>: prep_regen_steps as regen_log shows them.
chain_log() {
  local step
  for step in "${prep_regen_steps[@]}"; do if [[ $step == 'launch-document pin'* ]]; then echo "prep-regen.ts pin $1 $wave_base $wave"; else echo "-s $step"; fi; done | paste -sd '|'
}
check "prep_regen_steps is the documented chain" "$(printf '%s|' "${prep_regen_steps[@]}")" \
  "catalog:launch-legal-authority --write|catalog:attribution-227-matches --write|catalog:launch-inventory --write|catalog:party-scope --write|catalog:launch-inventory --verify --write|launch-document pin (prep-regen.ts pin)|"
check "the wave check, then the chain on the batch's own commit, then on the merged inputs, then the normal checks with --verify --check" "$(regen_log)" \
  "prep-regen.ts check $wave_base $wave|$(chain_log WAVE-SUMMARY)|$(chain_log SUMMARY)|-s catalog:launch-inventory --check|-s catalog:launch-inventory --verify --check"
# curation.md documents the chain from the same list: its numbered steps under "Regenerate" are prep_regen_steps.
check "curation.md lists prep_regen_steps, in order" \
  "$(sed -n '/^4\. \*\*Regenerate\*\*/,/^5\. /p' "$here/../../docs/catalog-import/curation.md" \
    | sed -nE 's/^   [0-9]\. `pnpm -s ([^`]*)`.*/\1/p; s/^   [0-9]\. the pin \(`prep-regen\.ts pin`\).*/launch-document pin (prep-regen.ts pin)/p')" \
  "$(printf '%s\n' "${prep_regen_steps[@]}")"
check "the receipt names the regeneration: the conflicted artifacts and the chain" "$(receipt regenerated)" \
  "${generated[0]} ${generated[1]} ${generated[2]} by $prep_regen_chain"
check "the prep log names it too" "$(grep -c '^prep: generated launch artifacts in conflict: ' "$d/out") $(grep -c '^prep: regenerated the generated launch artifacts and amended HEAD$' "$d/out")" "1 1"
fresh
prep
check "a prep without a regeneration says so in its receipt" "$(receipt regenerated)" "-"
regen_conflict "${generated[@]}" tests/catalog/curation.test.ts
regen_prep; status=$?
check "a generated conflict beside another non-data conflict still stops, naming only that one, before any generator" \
  "$status $(grep 'non-data conflicts, resolve by hand' "$d/out") $(grep -c 'prep-regen.ts' "$d/pnpm.log") $([[ -d $(git -C "$wt" rev-parse --git-path rebase-merge) ]] && echo rebasing) $(receipt_file)" \
  "2 non-data conflicts, resolve by hand: tests/catalog/curation.test.ts 0 rebasing none"
# Every path in prep_regen_files, in turn: a conflict in it regenerates (the
# notices document stopped the CL8 prep on 2026-11-10, gate-slim-a), and a
# batch that edited it by hand, its input unchanged, is refused naming it
# (prep-regen-chain r1: the scripted match and the party scope lost such edits
# silently), so a path added to the list is covered too. The batch's
# regeneration also rewrites the twelve paths the batch left: those are never
# refused.
for f in "${prep_regen_files[@]}"; do
  regen_conflict "$f"
  regen_prep; status=$?
  check "a conflict in $f that follows from the batch's input is regenerated from the merged input and passes" \
    "$status $(git -C "$wt" show "HEAD:$f") $(receipt regenerated)" "0 $(merged_of "$f") $f by $prep_regen_chain"
  regen_conflict --hand "$f"
  regen_prep; status=$?
  check "a batch that edited $f by hand is refused, naming it, before the base side is taken" \
    "$status $(grep -cF "the batch changed $f in a way its own inputs do not produce" "$d/out") $(grep -c '^-s catalog:launch-legal-authority --write$' "$d/pnpm.log") $(git -C "$wt" status --porcelain | wc -l) $(git -C "$wt" show "HEAD:$f") $(receipt_file)" \
    "2 1 1 0 $f base side none"
done
check "prep resolves a conflict in every generated launch artifact it regenerates" "${prep_regen_conflicts[*]}" "${prep_regen_files[*]}"
regen_conflict --hand "${generated[@]}"
regen_prep; status=$?
check "a refusal names every hand-edited path" "$status $(grep -cF "the batch changed ${generated[0]} ${generated[1]} ${generated[2]} in a way" "$d/out")" "2 1"
regen_conflict "${generated[@]}"
generated_from "$scopes/campaign-mvp-v1.records.json" "$wt" > "$wt/$scopes/campaign-mvp-v1.records.json"
PNPM_FAIL_INVENTORY=1 regen_prep; status=$?
check "a generator that fails on the batch's own commit stops prep with the worktree untouched, unamended and without a receipt" \
  "$status $(grep -c "^catalog:launch-inventory --write failed on the batch's own commit$" "$d/out") $(grep -c '^-s catalog:launch-inventory --verify' "$d/pnpm.log") $(grep -c '^test ' "$d/pnpm.log") $(git -C "$wt" rev-parse HEAD^) $(git -C "$wt" status --porcelain | wc -l) $(receipt_file)" \
  "1 1 0 0 $(feature) 0 none"
regen_conflict "${generated[@]}"
generated_from "$scopes/campaign-mvp-v1.records.json" "$wt" > "$wt/$scopes/campaign-mvp-v1.records.json"
records_wave=$(generated_from "$scopes/campaign-mvp-v1.records.json" "$wt")
PNPM_FAIL_INVENTORY=$(realpath "$wt") regen_prep; status=$?
check "a generator that fails on the merged inputs stops prep with the worktree left as it is, unamended and without a receipt" \
  "$status $(grep -c '^catalog:launch-inventory --write failed; the worktree is left for inspection$' "$d/out") $(grep -c '^-s catalog:launch-inventory --verify' "$d/pnpm.log") $(grep -c '^test ' "$d/pnpm.log") $(git -C "$wt" rev-parse HEAD^) $(git -C "$wt" show "HEAD:$scopes/campaign-mvp-v1.records.json") $(receipt_file)" \
  "1 1 1 0 $(feature) $records_wave none"
regen_conflict "${generated[@]}"
PNPM_FAIL_ON=exec regen_prep; status=$?
check "a batch change the wave check refuses stops prep before its own commit is regenerated or the base side is taken" \
  "$status $(grep -c 'not regenerable; generated launch artifacts are never hand-merged: repair the inputs or the generator and regenerate them' "$d/out") $(grep -c 'catalog:launch-' "$d/pnpm.log") $(git -C "$wt" status --porcelain | wc -l) $(receipt_file)" \
  "2 1 0 0 none"

# Two notice batches each add a Registry notice, which moves the notice
# authority and the authority's Registry binding; the second is rebased over
# the first (notice-ownline-1 over notice-alias-1, 2026-11-17: prep's chain
# had no catalog:launch-legal-authority step, the wave check refused the
# binding, and a curator regenerated by hand). The wave check is the real
# prep-regen.ts; catalog:merge takes the Registry's union and the legal
# authority's stub derives both documents from the merged Registry, as
# catalog:launch-legal-authority --write does from a fresh build.
registry=src/lib/catalog/data/section15-registry.json
authority=$scopes/campaign-mvp-v1.authority.json
real_tsx=$(cd "$here/../.." && pwd)/node_modules/tsx/dist/loader.mjs
# authority_json <registry sha256>: an authority document binding a Registry of that hash.
authority_json() {
  printf '{"noticeAuthoritySha256":"%s","resourceBindings":[{"key":"resource/section15-registry","source":{"repository":"everythingpath","pin":"%s","locator":"%s","rawSha256":"%s","effectiveSha256":"%s"}}]}\n' \
    "notices-of-$1" "$(printf '0%.0s' {1..40})" "$registry" "$1" "$1"
}
# notice_batches <binding of the second batch>: a fresh fixture whose feature
# head holds JSON scope documents, a CLI pin and a package.json Node reads
# (the commit the batch is made
# on), then lands a first notice batch (Registry line A); the batch, #901,
# adds Registry line B, binds the authority as <binding> (its own Registry's
# sha256 by default) and moves the notices document. Sets wave_base.
notice_batches() {
  local m f batch
  fresh; m=$d/main
  for f in advanced checkpoints companions core records; do echo '{"rows":[]}' > "$m/$scopes/campaign-mvp-v1.$f.json"; done
  authority_json "$(sha256sum < "$m/$registry" | cut -c1-64)" > "$m/$authority"
  printf '%s\n' "it('pins', () => {" "  const output = '';" '  expect(JSON.parse(output)).toEqual({' "    identity: 'a'," '  });' '});' > "$m/tests/catalog/launch-document.test.ts"
  echo '{"private": true}' > "$m/package.json"
  mkdir -p "$m/scripts/catalog"; ln -s "$here/../catalog/launch-inventory-document.ts" "$m/scripts/catalog/launch-inventory-document.ts"
  git -C "$m" add -A && git -C "$m" commit -qm "scope documents" && wave_base=$(git -C "$m" rev-parse HEAD)
  git -C "$wt" add -A && git -C "$wt" commit -qm "batch #901" && batch=$(git -C "$wt" rev-parse HEAD) \
    && git -C "$wt" reset -q --hard "$wave_base" && git -C "$wt" cherry-pick "$batch" > /dev/null || return 1
  echo B >> "$wt/$registry"; echo "\"notices of $(paste -sd ' ' "$wt/$registry")\"" > "$wt/$scopes/campaign-mvp-v1.notices.json"
  authority_json "${1:-$(sha256sum < "$wt/$registry" | cut -c1-64)}" > "$wt/$authority"
  git -C "$wt" commit -qa --amend --no-edit
  echo A >> "$m/$registry"; echo "\"notices of $(paste -sd ' ' "$m/$registry")\"" > "$m/$scopes/campaign-mvp-v1.notices.json"
  authority_json "$(sha256sum < "$m/$registry" | cut -c1-64)" > "$m/$authority"
  git -C "$m" commit -qam "the first notice batch lands"
}
union="{ git show :2:$registry; git show :3:$registry; } | awk '!seen[\$0]++' > $registry"
legal="h=\$(sha256sum < $registry | cut -c1-64); echo \"\\\"notices of \$(paste -sd ' ' $registry)\\\"\" > $scopes/campaign-mvp-v1.notices.json; registry=$registry; $(declare -f authority_json); authority_json \$h > $authority"
notice_batches || echo "FAIL  notice batches fixture"
PNPM_REAL_TSX=$real_tsx PNPM_MERGE=$union PNPM_HOOK_ON=catalog:launch-legal-authority PNPM_HOOK=$legal prep; status=$?
check "a notice batch rebased over another regenerates the authority from the merged Registry and passes, with no hand step" \
  "$status $(git -C "$wt" rev-parse HEAD^) $(git -C "$wt" status --porcelain | wc -l) $(receipt regenerated)" \
  "0 $(feature) 0 $scopes/campaign-mvp-v1.authority.json $scopes/campaign-mvp-v1.notices.json by $prep_regen_chain"
check "the Registry holds both batches' notices, and the authority binds it and its notices" \
  "$(git -C "$wt" show "HEAD:$registry" | tail -n 2 | paste -sd ' ') $(git -C "$wt" show "HEAD:$scopes/campaign-mvp-v1.notices.json")" \
  "A B \"notices of $registry v1 A B\""
check "the authority is the union's: its binding is the merged Registry's sha256" \
  "$(git -C "$wt" show "HEAD:$authority")" "$(authority_json "$(git -C "$wt" show "HEAD:$registry" | sha256sum | cut -c1-64)")"
check "the real wave check ran and passed, then the whole chain on the batch's own commit and on the merged inputs" \
  "$(regen_log | cut -d'|' -f1-13 | sed 's/ [0-9a-f]\{40\}//g')" \
  "prep-regen.ts check|$(chain_log WAVE-SUMMARY | sed 's/ [0-9a-f]\{40\}//g')|$(chain_log SUMMARY | sed 's/ [0-9a-f]\{40\}//g')"
notice_batches "$(printf 'f%.0s' {1..64})" || echo "FAIL  notice batches fixture"
PNPM_REAL_TSX=$real_tsx PNPM_MERGE=$union PNPM_HOOK_ON=catalog:launch-legal-authority PNPM_HOOK=$legal prep; status=$?
check "a batch whose Registry binding does not follow from its Registry is still refused, before the base side is taken" \
  "$status $(grep -c "binding in campaign-mvp-v1.authority.json to a hash its section15-registry.json does not have" "$d/out") $(grep -c 'not regenerable' "$d/out") $(grep -c 'catalog:launch-' "$d/pnpm.log") $(git -C "$wt" status --porcelain | wc -l) $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none)" \
  "2 1 1 0 0 none"
notice_batches || echo "FAIL  notice batches fixture"
echo '{"rows":[{"key":"by hand"}]}' > "$wt/$scopes/campaign-mvp-v1.core.json"; git -C "$wt" commit -qa --amend --no-edit
PNPM_REAL_TSX=$real_tsx PNPM_MERGE=$union PNPM_HOOK_ON=catalog:launch-legal-authority PNPM_HOOK=$legal prep; status=$?
check "a batch that changed an authored scope document is still refused by the real wave check, before its own commit is regenerated" \
  "$status $(grep -c "The wave changed the content of campaign-mvp-v1.core.json, which regeneration would drop" "$d/out") $(grep -c 'catalog:launch-' "$d/pnpm.log") $(git -C "$wt" status --porcelain | wc -l) $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none)" \
  "2 1 0 0 none"

# --- Remote-suite prep: every local check but Vitest ---
# The remote full suite runs on the exact tree (remote_checks.py), so
# --remote-suite records the plan without running it. It writes only its own
# receipt file, cur-<n>-prep.remote.receipt, never cur-<n>-prep.receipt.
local_receipt() { echo "$d/orch/logs/cur-901-prep.receipt"; }
remote_receipt() { echo "$d/orch/logs/cur-901-prep.remote.receipt"; }
rreceipt() { sed -n "s/^$1=//p" "$(remote_receipt)"; }
receipts() { echo "$([[ -e $(local_receipt) ]] && echo local || echo -) $([[ -e $(remote_receipt) ]] && echo remote || echo -)"; }
fresh
amend="echo late >> '$wt/docs/catalog-import/traits-901.md'; git -C '$wt' commit -qa --amend --no-edit"
prep; check "a local prep writes only the local receipt" "$? $(receipts)" "0 local -"
: > "$d/pnpm.log"
prep --remote-suite; status=$?
check "a remote-suite prep passes without calling pnpm test" "$status $(grep -c '^test' "$d/pnpm.log")" "0 0"
check "it removes the stale local receipt and writes only the remote one" "$(receipts)" "- remote"
check "it still runs the artifact check, the generated-expectation checks, format and notice-deps" \
  "$(grep -c -e "^-s check:artifacts --base $(feature)$" -e '^-s catalog:launch-inventory --check$' -e '^-s catalog:conditions$' -e '^-s catalog:format --check$' -e '^-s catalog:notice-deps$' -e '^install --offline$' "$d/pnpm.log")" 6
check "it plans, says the plan isn't run here, and records it" \
  "$(grep -c "^-s test:affected --base $(feature)$" "$d/pnpm.log") $(grep -c '^prep: remote suite, light plan recorded; the tests run on the exact tree remotely$' "$d/out") $(grep -c '^test tests/catalog/traits-901.test.ts$' "$d/out") $(grep -c '^prep: \(full\|light\)' "$d/out")" "1 1 1 0"
check "its receipt says tests=remote, with no test log, and binds the commit, tree and base" \
  "$(rreceipt result) $(rreceipt tests) $(rreceipt testLog) $(rreceipt testLogSha256) $(rreceipt mode) $(rreceipt commit) $(rreceipt tree) $(rreceipt base)" \
  "ok remote - - light $(git -C "$wt" rev-parse HEAD) $(git -C "$wt" rev-parse 'HEAD^{tree}') $(feature)"
check "it records the toolchain" "$(rreceipt toolchain)" "node $(node --version) pnpm 10.0.0-stub"
check "it writes the post-rebase count as a local prep does" "$(rreceipt sharedStoreCount) $(git -C "$wt" rev-parse HEAD^)" "2 (pf1-content 2) $(feature)"
remote_config=$(rreceipt config)
prep; check "a local prep of the same commit is configured differently and removes the remote receipt" \
  "$? $(receipt tests) $([[ $(receipt config) != "$remote_config" ]] && echo differs) $(receipts)" "0 local differs local -"
prep --remote-suite
for failure in launch-inventory conditions format notice-deps artifacts; do
  : > "$d/pnpm.log"
  case $failure in
    launch-inventory) PNPM_FAIL_INVENTORY=1 prep --remote-suite; status=$? ;;
    conditions) PNPM_CONDITIONS_DRIFT=1 prep --remote-suite; status=$? ;;
    format) PNPM_FAIL_ON=catalog:format prep --remote-suite; status=$? ;;
    notice-deps) PNPM_FAIL_ON=catalog:notice-deps prep --remote-suite; status=$? ;;
    artifacts) PNPM_FAIL_ARTIFACT=1 prep --remote-suite; status=$? ;;
  esac
  check "a remote-suite prep whose $failure check fails stops with neither receipt" \
    "$(( status != 0 )) $(receipts) $(grep -c '^test' "$d/pnpm.log")" "1 - - 0"
  prep --remote-suite
done
for step in check:artifacts install catalog:format catalog:notice-deps plan; do
  if [[ $step == plan ]]; then GIT_HOOK=$amend prep --remote-suite; status=$?
  else PNPM_HOOK_ON=$step PNPM_HOOK=$amend prep --remote-suite; status=$?
  fi
  check "a remote-suite prep whose commit is amended during $step exits 5 with neither receipt" \
    "$status $(receipts) $(grep -c 'changed while the checks ran; no receipt' "$d/out")" "5 - - 1"
  prep --remote-suite
done
# --full with --remote-suite: the plan is recorded as full, and in a bounded
# unit the reservation never escalates, since no tests run.
fresh
echo "#901 tooling fix" >> "$wt/scripts/catalog/import.ts"
printf '#!/usr/bin/env bash\necho "$*" >> "%s/admission.log"\n' "$d" > "$d/admission-stub.sh"
BOUNDED_RESERVATION=prep901-r BOUNDED_ADMISSION_LIB=$d/admission-stub.sh prep --remote-suite; status=$?
check "a remote-suite prep whose plan turns full records it full, runs no tests and never escalates" \
  "$status $(rreceipt mode) $(rreceipt tests) $(grep -c '^test' "$d/pnpm.log") $(cat "$d/admission.log" 2> /dev/null | wc -l) $(grep -c '^prep: remote suite, full plan recorded' "$d/out") $(grep -c '^reason scripts/catalog/import.ts$' "$d/out")" \
  "0 full remote 0 0 1 1"
BOUNDED_RESERVATION=prep901-r BOUNDED_ADMISSION_LIB=$d/admission-stub.sh prep --remote-suite --full; status=$?
check "--remote-suite --full is allowed: full plan recorded, no tests, no escalation" \
  "$status $(rreceipt mode) $(rreceipt tests) $(grep -c '^test' "$d/pnpm.log") $(cat "$d/admission.log" 2> /dev/null | wc -l)" "0 full remote 0 0"

# --- prep_reusable: a remote receipt stands in only for a remote-checks landing ---
# reusable [remote] [scripts dir]: prep_reusable for #901 in $wt on the feature head; output in $d/reuse.out.
reusable() {
  (
    export PNPM_LOG=$d/pnpm.log MAIN=$d/main EP_ORCH=$d/orch PATH=$d/bin:$PATH CI=true VITEST_MAX_WORKERS=${REUSE_WORKERS:-1}
    cd "$wt" && here=${2:-$here} && . "$here/paths.sh" && . "$here/prep-lib.sh" && prep_reusable 901 "$wt" "${REUSE_BASE:-$(feature)}" ${1:+"$1"}
  ) > "$d/reuse.out" 2>&1
}
said() { grep -c -- "$1" "$d/reuse.out"; }
fresh
prep --remote-suite
cp "$(remote_receipt)" "$d/remote.receipt"
restore() { cp "$d/remote.receipt" "$(remote_receipt)"; }
reusable; check "without remote checks only the local receipt is read, and there is none" "$? $(said '^no prep receipt$')" "1 1"
reusable remote; check "under remote checks the remote receipt is reusable" "$? $(said "^receipt $(remote_receipt): light prep (remote suite) of ")" "0 1"
reusable bogus; check "an unknown reuse mode is refused" "$? $(said "unknown prep reuse mode 'bogus'")" "1 1"
PNPM_VERSION=10.1.0 reusable remote; check "another toolchain refuses it" "$? $(said 'toolchain changed since the prep')" "1 1"
REUSE_WORKERS=3 reusable remote; check "another test environment refuses it" "$? $(said 'env changed since the prep')" "1 1"
REUSE_BASE=$(git -C "$d/main" rev-parse HEAD^) reusable remote; check "another base refuses it" "$? $(said 'base changed since the prep')" "1 1"
mkdir -p "$d/scripts"; cp -p "$here"/*.sh "$here/prep-regen.ts" "$d/scripts/"; echo "# a comment" >> "$d/scripts/prep-lib.sh"
reusable remote "$d/scripts"; check "changed prep scripts refuse it" "$? $(said 'scripts changed since the prep')" "1 1"
for field in tree lockfile; do
  sed -i "s/^$field=.*/$field=0000/" "$(remote_receipt)"
  reusable remote; check "a receipt whose $field differs is refused" "$? $(said "$field changed since the prep")" "1 1"
  restore
done
for bad in duplicate bogus missing toolchain local log; do
  case $bad in
    duplicate) echo tests=remote >> "$(remote_receipt)"; want='malformed prep receipt' ;;
    bogus) sed -i 's/^tests=.*/tests=skipped/' "$(remote_receipt)"; want='malformed prep receipt' ;;
    missing) sed -i '/^tests=/d' "$(remote_receipt)"; want='malformed prep receipt' ;;
    toolchain) echo "toolchain=node v0 pnpm 0" >> "$(remote_receipt)"; want='malformed prep receipt' ;;
    local) sed -i 's/^tests=.*/tests=local/' "$(remote_receipt)"; want='tests=local in the remote prep receipt: a receipt in the wrong file' ;;
    log) sed -i "s|^testLog=.*|testLog=$d/orch/logs/cur-901-prep-20261106-000000-abcdef-vitest.log|" "$(remote_receipt)"; want='tests=remote names a test log; malformed prep receipt' ;;
  esac
  reusable remote; check "a remote receipt with a $bad tests, toolchain or test log field is refused" "$? $(said "$want")" "1 1"
  restore
done
reusable remote; check "the restored receipt is reusable again" "$?" 0
echo "fixed" >> "$wt/docs/catalog-import/traits-901.md"; git -C "$wt" commit -qa --amend --no-edit
reusable remote; check "an amended commit refuses it" "$? $(said 'commit changed since the prep')" "1 1"
prep; reusable; check "a local prep's receipt stands in without remote checks" "$? $(said "^receipt $(local_receipt): light prep (local) of ")" "0 1"
reusable remote; check "but never under them: only the remote receipt is read there, and the local prep removed it" "$? $(said '^no remote-suite prep receipt$')" "1 1"
cp "$(local_receipt)" "$(remote_receipt)"
reusable remote; check "a local receipt copied to the remote name is refused" "$? $(said 'tests=local in the remote prep receipt: a receipt in the wrong file')" "1 1"
rm -f "$(remote_receipt)"

# --- Remote and local receipts stay apart, and a local one needs this commit's passing log ---
# For a light, an explicit --full and an automatic full plan: a local prep of
# commit A; the batch changes to B; a local prep of B, then a failed local
# prep of B, then a remote-suite prep of B. With the remote receipt (or a
# copy of it, edited) at the local name, nothing is locally reusable: not the
# copy, not any single field taken from B's local receipt, and not A's or the
# failed run's retained log transplanted with its receipt fields (the r2
# finding). Only B's own local receipt, with its passing log, is.
# with_fields <source receipt> <field>...: the remote receipt with those
# fields' values taken from the source receipt, written at the local name.
with_fields() {
  local src=$1 f
  shift
  cp "$d/remote.receipt" "$(local_receipt)"
  for f; do
    awk -F= -v f="$f" -v v="$(sed -n "s/^$f=//p" "$src")" '$1 == f { print f "=" v; next } { print }' "$(local_receipt)" > "$d/edit.receipt" \
      && mv "$d/edit.receipt" "$(local_receipt)"
  done
}
evidence=(tests checks testLog testLogSha256 config)
for plan in light explicit automatic; do
  fresh
  args=(); [[ $plan == explicit ]] && args=(--full)
  [[ $plan == automatic ]] && echo "#901 tooling fix" >> "$wt/scripts/catalog/import.ts"
  prep "${args[@]}"; cp "$(local_receipt)" "$d/old.receipt"
  echo "// a later fix" >> "$wt/tests/catalog/traits-901.test.ts"
  [[ $plan == light ]] || echo "#901 another tooling fix" >> "$wt/scripts/catalog/import.ts"
  git -C "$wt" commit -qa --amend --no-edit
  prep "${args[@]}"; cp "$(local_receipt)" "$d/local.receipt"
  PNPM_FAIL_TEST=1 prep "${args[@]}"; failed_log=$(sed -n 's/^full test output: //p' "$d/out")
  cp "$d/local.receipt" "$d/failed.receipt"
  sed -i "s|^testLog=.*|testLog=$failed_log|; s|^testLogSha256=.*|testLogSha256=$(sha256sum < "$failed_log" | cut -c1-64)|" "$d/failed.receipt"
  prep --remote-suite "${args[@]}"; cp "$(remote_receipt)" "$d/remote.receipt"
  check "$plan plan: A and B differ; B's local and remote preps share commit and plan" \
    "$([[ $(sed -n 's/^commit=//p' "$d/old.receipt") != "$(rreceipt commit)" ]] && echo differ) $(sed -n 's/^commit=//p' "$d/local.receipt") $(sed -n 's/^mode=//p' "$d/local.receipt") $(receipts)" \
    "differ $(rreceipt commit) $([[ $plan == light ]] && echo light || echo full) - remote"
  reusable; check "$plan plan: after the remote prep there is no local receipt" "$? $(said '^no prep receipt$')" "1 1"
  reusable remote; check "$plan plan: the remote receipt is reusable under remote checks" "$?" 0
  cp "$d/remote.receipt" "$(local_receipt)"
  reusable; check "$plan plan: the remote receipt copied to the local name is refused" "$? $(said 'tests=remote in the local prep receipt: a receipt in the wrong file')" "1 1"
  accepted=
  while IFS='=' read -r field _; do
    with_fields "$d/local.receipt" "$field"
    if reusable < /dev/null; then accepted+=" $field"; fi
  done < "$d/remote.receipt"
  check "$plan plan: no single field of B's local receipt makes the remote one locally reusable" "${accepted:-none}" none
  with_fields "$d/local.receipt" tests checks config
  reusable; check "$plan plan: tests, checks and config together still lack the test log" "$? $(said 'tests=local without its test log evidence (testLog=-)')" "1 1"
  with_fields "$d/old.receipt" "${evidence[@]}"
  reusable; check "$plan plan: A's retained log, transplanted with its receipt fields, is refused" "$? $(said 'was written for another commit')" "1 1"
  with_fields "$d/old.receipt" "${evidence[@]}"; cp "$(local_receipt)" "$(remote_receipt)"
  reusable remote; check "$plan plan: and so under remote checks" "$? $(said 'tests=local in the remote prep receipt')" "1 1"
  cp "$d/remote.receipt" "$(remote_receipt)"
  with_fields "$d/failed.receipt" "${evidence[@]}"
  reusable; check "$plan plan: B's failed run's log, transplanted, is refused" "$? $(said "doesn't record a passing run")" "1 1"
  cp "$d/local.receipt" "$(local_receipt)"
  reusable; check "$plan plan: B's own local receipt, with its passing log, is reusable" "$?" 0
  rm -f "$(local_receipt)"
done
# The pair queue's staged prep (pair-stage.sh): its receipt and log sit in
# its own receipt directory, and its reuse call reads the local receipt there.
staged() { (export PREP_RECEIPT_DIRECTORY=$d/stage; "$@"); }
prep; stage_parent=$(feature)
prep --staged-parent "$stage_parent" --receipt-directory "$d/stage"
check "a staged prep writes its local receipt and log in its receipt directory" \
  "$([[ -e $d/stage/cur-901-prep.receipt ]] && echo receipt) $(dirname "$(sed -n 's/^testLog=//p' "$d/stage/cur-901-prep.receipt")")" "receipt $d/stage"
staged reusable; check "pair-stage's reuse call accepts it" "$?" 0
old_log=$(sed -n 's/^testLog=//p' "$d/old.receipt")
moved_log=$d/stage/cur-901-prep-20261106-000000-abcdef-vitest.log
cp "$old_log" "$moved_log"
sed "s|^testLog=.*|testLog=$moved_log|; s|^testLogSha256=.*|testLogSha256=$(sha256sum < "$moved_log" | cut -c1-64)|" \
  "$d/stage/cur-901-prep.receipt" > "$d/staged.receipt" && mv "$d/staged.receipt" "$d/stage/cur-901-prep.receipt"
staged reusable; check "commit A's passing log, copied into the stage under a valid name, is refused" "$? $(said 'was written for another commit')" "1 1"
prep --remote-suite --staged-parent "$stage_parent" --receipt-directory "$d/stage"
check "a staged remote-suite prep leaves no local receipt in the stage" \
  "$([[ -e $d/stage/cur-901-prep.receipt ]] && echo local || echo -) $([[ -e $d/stage/cur-901-prep.remote.receipt ]] && echo remote || echo -)" "- remote"
staged reusable; check "and pair-stage's reuse call refuses it" "$? $(said '^no prep receipt$')" "1 1"

# --- A local receipt needs its own, unchanged, passing test log ---
fresh
echo "#901 tooling fix" >> "$wt/scripts/catalog/import.ts"
prep; cp "$(local_receipt)" "$d/local.receipt"
local_log=$(receipt testLog)
check "a local receipt names its Vitest log beside it and its sha256" \
  "$(dirname "$local_log") $(receipt testLogSha256)" "$d/orch/logs $(sha256sum < "$local_log" | cut -c1-64)"
check "the log opens with the prep's issue, commit, tree, base, config and argv, and closes on its result" \
  "$(head -n 6 "$local_log" | paste -sd ' ') $(sed -n 7p "$local_log" | cut -d' ' -f1-4) $(tail -n 1 "$local_log")" \
  "# cur-prep test log # issue=901 # commit=$(receipt commit) # tree=$(receipt tree) # base=$(receipt base) # config=$(receipt config) # argv=pnpm test tests/catalog # result=ok"
cp "$local_log" "$d/saved.log"
edited() { sed "$1" "$d/local.receipt" > "$(local_receipt)"; }
# log_edited <sed script>: the log rewritten, and the receipt's hash with it.
log_edited() {
  sed -i "$1" "$local_log"
  sed "s|^testLogSha256=.*|testLogSha256=$(sha256sum < "$local_log" | cut -c1-64)|" "$d/local.receipt" > "$(local_receipt)"
}
for bad in missing changed symlink dash sum-dash sum-missing elsewhere other-issue remote-log checks \
  log-issue log-commit log-tree log-base log-plan log-header log-result; do
  cp "$d/local.receipt" "$(local_receipt)"; cp "$d/saved.log" "$local_log"
  case $bad in
    missing) rm -f "$local_log"; want="the prep's test log $local_log is missing" ;;
    changed) echo late >> "$local_log"; want="the prep's test log $local_log changed since the prep" ;;
    symlink) mv "$local_log" "$d/moved.log"; ln -s "$d/moved.log" "$local_log"; want="the prep's test log $local_log is missing" ;;
    dash) edited 's/^testLog=.*/testLog=-/'; want='tests=local without its test log evidence (testLog=-)' ;;
    sum-dash) edited 's/^testLogSha256=.*/testLogSha256=-/'; want='tests=local without its test log evidence' ;;
    sum-missing) edited '/^testLogSha256=/d'; want='malformed prep receipt' ;;
    elsewhere) mkdir -p "$d/elsewhere"; cp "$d/saved.log" "$d/elsewhere/$(basename "$local_log")"
      edited "s|^testLog=.*|testLog=$d/elsewhere/$(basename "$local_log")|"; want="names a test log that isn't this prep's" ;;
    other-issue) other=$d/orch/logs/cur-902-prep-20261106-000000-abcdef-vitest.log; cp "$d/saved.log" "$other"
      edited "s|^testLog=.*|testLog=$other|"; want="names a test log that isn't this prep's" ;;
    remote-log) edited 's/^tests=.*/tests=remote/'; want='tests=remote in the local prep receipt: a receipt in the wrong file' ;;
    checks) edited 's/^checks=.*/checks=0000/'; want='checks changed since the prep' ;;
    log-issue) log_edited '2s/.*/# issue=902/'; want='was written for another issue' ;;
    log-commit) log_edited "3s/.*/# commit=$(receipt base)/"; want='was written for another commit' ;;
    log-tree) log_edited '4s/.*/# tree=0000/'; want='was written for another tree' ;;
    log-base) log_edited '5s/.*/# base=0000/'; want='was written for another base' ;;
    log-plan) log_edited '6s/.*/# config=0000/'; want='was written for another config' ;;
    log-header) log_edited '1,7d'; want='was written for another' ;;
    log-result) log_edited '$d'; want="doesn't record a passing run" ;;
  esac
  reusable; check "a local full receipt whose test log evidence is $bad is refused" "$? $(said "$want")" "1 1"
  [[ -L $local_log ]] && { rm -f "$local_log"; mv "$d/moved.log" "$local_log"; }
done
cp "$d/local.receipt" "$(local_receipt)"; cp "$d/saved.log" "$local_log"
reusable; check "restored, the local receipt and its log are reusable" "$?" 0
# Explicit targets validate before touching an existing receipt or any files.
fresh
prep; check "default numbered prep still succeeds" "$?" 0
saved=$(sha256sum "$d/orch/logs/cur-901-prep.receipt" | cut -c1-64)
prep --branch t3/wrong --worktree "$wt"; status=$?
check "wrong branch fails before receipt invalidation" "$((status != 0)) $(sha256sum "$d/orch/logs/cur-901-prep.receipt" | cut -c1-64)" "1 $saved"
prep --branch cur/901 --worktree "$d/main"; status=$?
check "main checkout fails before receipt invalidation" "$((status != 0)) $(sha256sum "$d/orch/logs/cur-901-prep.receipt" | cut -c1-64)" "1 $saved"
prep --worktree "$wt"; status=$?
check "partial explicit target fails closed" "$((status != 0))" 1
appwt=$d/app-owned
git -C "$d/main" worktree move "$wt" "$appwt"
git -C "$appwt" branch -m t3/curation901
prep --branch t3/curation901 --worktree "$appwt"; status=$?
check "standalone app prep retains count and receipt identity" "$status $(receipt branch) $(receipt worktree) $(receipt sharedStoreCount)" "0 t3/curation901 $appwt 2 (pf1-content 2)"
# Same repository and matching branch, but no integration history.
git -C "$d/main" worktree add -q --detach "$d/orphan" HEAD
git -C "$d/orphan" checkout -q --orphan t3/orphan
git -C "$d/orphan" rm -qrf .
printf orphan > "$d/orphan/orphan"; git -C "$d/orphan" add orphan
git -C "$d/orphan" -c user.name=Test -c user.email=test@example.test commit -qm orphan
prep --branch t3/orphan --worktree "$d/orphan"; status=$?
check "unrelated history cannot enter curation prep" "$((status != 0)) $(grep -c 'no integration base' "$d/out")" "1 1"
exit $fail
