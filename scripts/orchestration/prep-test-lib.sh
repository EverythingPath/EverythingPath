# shellcheck shell=bash
# Sourced by cur-prep.test.sh and land-queue.test.sh: a throwaway main
# checkout with a curation batch in it, and a pnpm stub, for prep tests with
# dummy commands. Defines functions only.

# prep_fixture <dir>: <dir>/main on feature/pf1-character-builder (an older
# batch traits-370, the guards, one tooling file, the shared data files and
# one shared-store file, scripts/affected-tests.ts and the conditions
# admission report), and the batch worktree <dir>/ep-cur-901 on cur/901
# with batch #901 uncommitted: its report (with the count marker), inventory,
# tests and fixture, three new shared-store files, a shared data change and a
# re-bind in traits-370's inventory. The feature head then gains one of the
# three shared-store files, byte for byte, so the rebase leaves two to count.
# Also writes <dir>/bin/pnpm (logs to <dir>/pnpm.log; PNPM_FAIL_TEST=1 fails
# `pnpm test` with multiline diagnostics; `pnpm -s test:affected` prints
# PNPM_AFFECTED and exits PNPM_AFFECTED_STATUS (default 0);
# PNPM_FAIL_INVENTORY=1 fails `pnpm -s catalog:launch-inventory`;
# PNPM_FAIL_ON=<script> fails `pnpm -s <script>`; `pnpm --version` prints
# PNPM_VERSION (default 10.0.0-stub); `pnpm -s catalog:conditions` prints the committed
# docs/catalog-import/conditions-admission.json, plus a line when
# PNPM_CONDITIONS_DRIFT is set; `pnpm -s catalog:merge` fails unless
# PNPM_MERGE is a command, which it then runs in its place; PNPM_HOOK is a command a pnpm call
# whose arguments include the word PNPM_HOOK_ON runs first), <dir>/bin/git
# (runs GIT_HOOK once before the plan's `git diff --name-status`) and
# <dir>/orch/briefs/cur-901-msg.txt, and exports MAIN, EP_ORCH, PATH and a git
# identity.
prep_fixture() {
  local d=$1 m=$1/main f
  mkdir -p "$d/bin" "$d/orch/briefs" "$d/orch/logs" "$m"
  cat > "$d/bin/pnpm" << 'STUB'
#!/usr/bin/env bash
echo "$*" >> "$PNPM_LOG"
[[ -n ${PNPM_HOOK_ON:-} && " $* " == *" $PNPM_HOOK_ON "* ]] && bash -c "$PNPM_HOOK"
case $1 in
  --version) echo "${PNPM_VERSION:-10.0.0-stub}" ;;
  test)
    shift
    if [[ -n ${PNPM_FAIL_TEST:-} ]]; then
      echo 'Error: Cannot find module ./missing-helper (startup)' >&2
      printf ' FAIL  tests/catalog/traits-901.test.ts > Poverty-Stricken\nAssertionError: expected 2 to be 1\n- Expected\n+ Received\n\n- 1\n+ 2\n\n ❯ tests/catalog/traits-901.test.ts:12:5\n'
      echo " Test Files  1 failed | $(( $# - 1 )) passed ($#)"; exit 1
    fi
    echo " Test Files  $# passed ($#)" ;;
  -s) [[ -n ${PNPM_FAIL_ON:-} && $2 == "$PNPM_FAIL_ON" ]] && exit 1
      [[ $2 == check:artifacts && ${PNPM_FAIL_ARTIFACT:-} == 1 ]] && exit 1
      [[ $2 == test:affected ]] && { [[ -n ${PNPM_AFFECTED:-} ]] && printf '%s\n' "$PNPM_AFFECTED"; exit "${PNPM_AFFECTED_STATUS:-0}"; }
      [[ $2 == catalog:launch-inventory && ${PNPM_FAIL_INVENTORY:-} == 1 ]] && exit 1
      [[ $2 == catalog:conditions ]] && { cat docs/catalog-import/conditions-admission.json; [[ -n ${PNPM_CONDITIONS_DRIFT:-} ]] && echo drift; exit 0; }
      [[ $2 == catalog:merge ]] && { [[ -n ${PNPM_MERGE:-} ]] && { bash -c "$PNPM_MERGE"; exit; }; exit 1; } ;;
esac
exit 0
STUB
  chmod +x "$d/bin/pnpm"
  cat > "$d/bin/git" << STUB
#!/usr/bin/env bash
[[ -n \${GIT_HOOK:-} && " \$* " == *" --name-status "* ]] && { h=\$GIT_HOOK; unset GIT_HOOK; bash -c "\$h"; }
exec $(command -v git) "\$@"
STUB
  chmod +x "$d/bin/git"
  export PNPM_LOG=$d/pnpm.log MAIN=$m EP_ORCH=$d/orch PATH=$d/bin:$PATH CI=true VITEST_MAX_WORKERS=1
  export GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.test GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.test
  git -C "$m" init -q -b feature/pf1-character-builder
  for f in package.json pnpm-lock.yaml scripts/catalog/import.ts scripts/affected-tests.ts \
    docs/catalog-import/conditions-admission.json \
    scripts/catalog/reviewed-curation.json scripts/catalog/legal/held-notices.json \
    src/lib/catalog/data/attribution-assessments.json src/lib/catalog/data/attribution-evidence.json \
    src/lib/catalog/data/section15-registry.json \
    scripts/catalog/legal/traits-370.json docs/catalog-import/traits-370.md \
    tests/catalog/traits-370.test.ts tests/catalog/traits370.integration.test.ts \
    tests/fixtures/traits-370/preview.json tests/catalog/curation.test.ts \
    tests/catalog/cross-batch-bindings.test.ts tests/catalog/notice-holds.test.ts \
    tests/catalog/pinned-sources.test.ts tests/catalog/batch-ownership.test.ts \
    tests/catalog/batch-ownership-sweep.test.ts tests/catalog/review-receipts.test.ts \
    tests/fixtures/pinned/pf1/packs/existing.yaml; do
    mkdir -p "$m/$(dirname "$f")"; echo "$f v1" > "$m/$f"
  done
  cp "$here/../check-artifacts.mjs" "$here/../artifact-budgets.json" "$m/scripts/"
  git -C "$m" add -A && git -C "$m" commit -qm base
  git -C "$m" worktree add -q "$d/ep-cur-901" -b cur/901 feature/pf1-character-builder
  prep_batch_changes "$d/ep-cur-901"
  printf 'Curate dummy traits, batch 1 (#901)\n\nA dummy batch.\n' > "$d/orch/briefs/cur-901-msg.txt"
  mkdir -p "$m/tests/fixtures/pinned/pf1/packs"
  echo linked > "$m/tests/fixtures/pinned/pf1/packs/linked.yaml"
  git -C "$m" add -A && git -C "$m" commit -qm "another batch lands linked.yaml"
}

# prep_batch_changes <worktree>: batch #901's files, uncommitted.
prep_batch_changes() {
  local w=$1 f
  mkdir -p "$w/docs/catalog-import" "$w/tests/fixtures/traits-901" "$w/tests/fixtures/pinned/pf1-content/src/pf-traits" "$w/tests/fixtures/pinned/pf1/packs"
  printf '# Traits #901\n\n## Preservation and gates\n\n<!-- prep:shared-store-count -->\nThe curator counted 3 new files.\n<!-- /prep:shared-store-count -->\n\nThe end.\n' > "$w/docs/catalog-import/traits-901.md"
  for f in scripts/catalog/legal/traits-901.json tests/catalog/traits-901.test.ts tests/catalog/traits901.integration.test.ts tests/fixtures/traits-901/data.ts; do
    echo "$f" > "$w/$f"
  done
  echo a > "$w/tests/fixtures/pinned/pf1-content/src/pf-traits/a.yaml"
  echo b > "$w/tests/fixtures/pinned/pf1-content/src/pf-traits/b.yaml"
  echo linked > "$w/tests/fixtures/pinned/pf1/packs/linked.yaml"
  echo "#901 records" >> "$w/scripts/catalog/reviewed-curation.json"
  echo "re-bound by #901" >> "$w/scripts/catalog/legal/traits-370.json"
}

# prep_tests_run: the test files of the last `pnpm test` call, one per line.
prep_tests_run() { grep '^test ' "$PNPM_LOG" | tail -n 1 | cut -d' ' -f2- | tr ' ' '\n'; }
