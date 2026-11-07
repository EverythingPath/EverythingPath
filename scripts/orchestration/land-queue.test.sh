#!/usr/bin/env bash
# usage: land-queue.test.sh — checks land-queue.sh's prep reuse with dummy
# commands: a passed prep's receipt stands in for the queue's prep only while
# the commit, base, lockfile, prep scripts and check configuration are
# unchanged; under remote checks a curation item's stale receipt is refused,
# never prepped again. A throwaway repository under $repos/.ep-tmp, a pnpm stub that
# only logs, and a cur-land.sh stub that only records the gate.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/prep-test-lib.sh"
root=$(mktemp -d "${TMPDIR:?}/land-queue-test-XXXXXX") || exit 1
trap 'rm -rf "$root"' EXIT
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
d=$root/case
mkdir -p "$d"
(prep_fixture "$d") > /dev/null 2>&1 || { echo "FAIL  fixture"; exit 1; }
wt=$d/ep-cur-901
# The scripts under test, with cur-land.sh replaced by a stub.
mkdir -p "$d/scripts"
cp -p "$here"/*.sh "$d/scripts/"
cat > "$d/scripts/cur-land.sh" << 'STUB'
#!/usr/bin/env bash
echo "$1 $(git -C "$2" rev-parse HEAD)" >> "$EP_ORCH/gates"
STUB
chmod +x "$d/scripts/cur-land.sh"
export PNPM_LOG=$d/pnpm.log MAIN=$d/main EP_ORCH=$d/orch PATH=$d/bin:$PATH CI=true VITEST_MAX_WORKERS=1
export GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.test GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.test
prep() { bash "$d/scripts/cur-prep.sh" "$@" 901 "$d/orch/briefs/cur-901-msg.txt" > "$d/prep.out" 2>&1; }
# queue [args...]: runs the queue for #901; output in $d/out, and counts the
# `pnpm test` calls it made.
queue() {
  : > "$PNPM_LOG"
  bash "$d/scripts/land-queue.sh" "$@" 901 > "$d/out" 2>&1
}
tests_runs() { grep -c '^test ' "$PNPM_LOG"; }
gated() { tail -n 1 "$d/orch/gates" 2> /dev/null; }

prep; check "a standalone prep passes" "$?" 0
queue; status=$?
check "the queue reuses the passed prep and gates the same commit" \
  "$status $(tests_runs) $(grep -c '^prep 901 reused: receipt ' "$d/out") $(gated)" "0 0 1 cur/901 $(git -C "$wt" rev-parse HEAD)"
queue
check "it stays reusable while nothing changes" "$(tests_runs) $(grep -c '^prep 901 reused' "$d/out")" "0 1"
queue --dry-run
check "a dry run says it would reuse the prep" "$(grep -c 'would reuse the prep: receipt ' "$d/out") $(tests_runs)" "1 0"

# An edit (an amended commit) invalidates it.
echo "fixed" >> "$wt/docs/catalog-import/traits-901.md"
git -C "$wt" commit -qa --amend --no-edit
queue; status=$?
check "an edited commit runs prep again, saying why" "$status $(tests_runs) $(grep -c '^prep 901: not reusing the prep (commit changed since the prep' "$d/out")" "0 1 1"
queue
check "and the new prep's receipt is reused next time" "$(tests_runs) $(grep -c '^prep 901 reused' "$d/out")" "0 1"

# A moved feature head means a rebase: run prep again.
echo "v2" > "$d/main/tests/catalog/curation.test.ts"; git -C "$d/main" commit -qam "another landing"
queue; status=$?
check "a moved feature head runs prep again, which rebases" \
  "$status $(tests_runs) $(grep -c 'base changed since the prep' "$d/out") $(git -C "$wt" rev-parse HEAD^)" \
  "0 1 1 $(git -C "$d/main" rev-parse HEAD)"

# Uncommitted work: prep commits it, so it can't be reused.
echo "late note" >> "$wt/docs/catalog-import/traits-901.md"
queue
check "uncommitted changes run prep again" "$(tests_runs) $(grep -c 'the worktree has uncommitted changes' "$d/out") $(git -C "$wt" status --porcelain | wc -l)" "1 1 0"

# Changed prep scripts.
echo "# a comment" >> "$d/scripts/prep-lib.sh"
queue
check "changed prep scripts run prep again" "$(tests_runs) $(grep -c 'scripts changed since the prep' "$d/out")" "1 1"

# A changed check configuration (here: the receipt's, which its test log's
# header binds too, so the log is the first to disagree).
sed -i 's/^config=.*/config=0000/' "$d/orch/logs/cur-901-prep.receipt"
queue
check "a changed check configuration runs prep again" "$(tests_runs) $(grep -c 'not reusing the prep (the prep.s test log .* was written for another config)' "$d/out")" "1 1"

# A changed lockfile in the receipt (the dependencies).
sed -i 's/^lockfile=.*/lockfile=0000/' "$d/orch/logs/cur-901-prep.receipt"
queue
check "changed dependencies run prep again" "$(tests_runs) $(grep -c 'lockfile changed since the prep' "$d/out")" "1 1"

# Another test environment.
VITEST_MAX_WORKERS=3 queue
check "another worker count runs prep again" "$(tests_runs) $(grep -c 'env changed since the prep' "$d/out")" "1 1"
CI= queue
check "another CI setting (the test timeout) runs prep again" "$(tests_runs) $(grep -c 'env changed since the prep' "$d/out")" "1 1"
queue

# A failed prep leaves nothing to reuse.
echo "v3" > "$d/main/tests/catalog/curation.test.ts"; git -C "$d/main" commit -qam "a third landing"
PNPM_FAIL_TEST=1 queue; status=$?
check "a failed prep fails the queue before the gate" "$(( status != 0 )) $(grep -c '^prep 901 failed' "$d/out") $([[ -e $d/orch/logs/cur-901-prep.receipt ]] && echo receipt || echo none)" "1 1 none"
queue
check "after a failed prep the queue runs prep" "$(tests_runs) $(grep -c 'no prep receipt' "$d/out")" "1 1"

# A full prep's receipt covers the light one.
prep --full
queue
check "a --full prep is reused" "$(tests_runs) $(grep -c '^prep 901 reused: receipt .*: full prep' "$d/out")" "0 1"
VITEST_MAX_WORKERS=3 queue
check "a --full prep isn't reused under another test environment" "$(tests_runs) $(grep -c 'env changed since the prep' "$d/out")" "1 1"

# An implementation branch whose rebase stops on an append-only table.
table=tests/catalog/cross-batch-bindings.ts
iwt=$d/ep-impl-table
git -C "$d/main" worktree add -q "$iwt" -b impl/table feature/pf1-character-builder
printf 'batch row\n' > "$iwt/$table"; git -C "$iwt" add -A; git -C "$iwt" commit -qm "impl appends a row"
printf 'feature row\n' > "$d/main/$table"; git -C "$d/main" add -A; git -C "$d/main" commit -qm "a batch appends a row"
PNPM_MERGE="echo '$table:' >&2; exit 1" bash "$d/scripts/land-queue.sh" "impl/table:$iwt" > "$d/out" 2>&1; status=$?
check "a table conflict catalog:merge leaves unresolved aborts the rebase" \
  "$(( status != 0 )) $(grep -c '^catalog:merge failed on impl/table; rebase aborted$' "$d/out") $(git -C "$iwt" status --porcelain | wc -l)" "1 1 0"
PNPM_MERGE="printf 'feature row\\nbatch row\\n' > $table" bash "$d/scripts/land-queue.sh" "impl/table:$iwt" > "$d/out" 2>&1; status=$?
check "a table conflict catalog:merge resolves continues the rebase to the gate" \
  "$status $(git -C "$iwt" show "HEAD:$table" | paste -sd ' ') $(git -C "$iwt" rev-parse HEAD^) $(gated)" \
  "0 feature row batch row $(git -C "$d/main" rev-parse HEAD) impl/table $(git -C "$iwt" rev-parse HEAD)"
# App-owned curation keeps its issue discriminator separate from its branch.
prep; check "refresh prep after the code branch changes integration" "$?" 0
appwt=$d/app-owned-curation
git -C "$d/main" worktree move "$wt" "$appwt"
bash "$d/scripts/land-queue.sh" --dry-run "cur/901:$appwt" > "$d/out" 2>&1; status=$?
check "numbered curation accepts an explicit moved path and invalidates its receipt" "$status $(grep -c 'would run: .*cur-prep.sh --branch cur/901 --worktree' "$d/out") $(grep -c 'worktree changed since the prep' "$d/out")" "0 1 1"
git -C "$appwt" branch -m t3/curation901
: > "$PNPM_LOG"
bash "$d/scripts/land-queue.sh" "cur/901@t3/curation901:$appwt" > "$d/out" 2>&1; status=$?
check "explicit app curation uses specialized prep and the full gate" "$status $(tests_runs) $(gated)" "0 1 t3/curation901 $(git -C "$appwt" rev-parse HEAD)"
: > "$PNPM_LOG"
bash "$d/scripts/land-queue.sh" "cur/901@t3/curation901:$appwt" > "$d/out" 2>&1; status=$?
check "explicit app curation reuses only its matching receipt" "$status $(tests_runs) $(grep -c 'reused: receipt' "$d/out")" "0 0 1"
for bad in "cur/901@t3/curation901:$d/main" "cur/901@cur/901:$appwt" "cur/901@t3/curation901:$appwt/docs" "cur/901@t3/curation901:$iwt"; do
  before=$(wc -l < "$d/orch/gates")
  bash "$d/scripts/land-queue.sh" "$bad" > "$d/out" 2>&1; status=$?
  check "mismatched explicit target refuses before prep/gate: $bad" "$((status != 0)) $(wc -l < "$d/orch/gates")" "1 $before"
done
# An unrelated Git repository with an identically named branch is not owned.
git init -q "$d/foreign"; git -C "$d/foreign" checkout -qb t3/curation901
printf x > "$d/foreign/x"; git -C "$d/foreign" add x; git -C "$d/foreign" commit -qm unrelated
bash "$d/scripts/land-queue.sh" "cur/901@t3/curation901:$d/foreign" > "$d/out" 2>&1; status=$?
check "foreign repository cannot impersonate an app worktree" "$((status != 0)) $(grep -c 'different repository' "$d/out")" "1 1"
# Guard dependencies are part of prep identity, including the cached queue path.
for dependency in scripts/check-artifacts.mjs scripts/artifact-budgets.json; do
  (cd "$appwt" && here=$d/scripts && . "$d/scripts/paths.sh" && . "$d/scripts/prep-lib.sh" && prep_reusable 901 "$appwt" "$(git -C "$d/main" rev-parse HEAD)") > "$d/reuse.out"
  check "unchanged guard dependency permits cached reuse" "$?" 0
  echo ' ' >> "$appwt/$dependency"
  (cd "$appwt" && here=$d/scripts && . "$d/scripts/paths.sh" && . "$d/scripts/prep-lib.sh" && prep_reusable 901 "$appwt" "$(git -C "$d/main" rev-parse HEAD)") > "$d/reuse.out"
  check "edited guard dependency invalidates cached reuse" "$?" 1
  git -C "$appwt" add "$dependency"; git -C "$appwt" commit -qm "update artifact dependency"
  before=$(wc -l < "$d/orch/gates")
  : > "$PNPM_LOG"
  PNPM_FAIL_ARTIFACT=1 bash "$d/scripts/land-queue.sh" "cur/901@t3/curation901:$appwt" > "$d/out" 2>&1; status=$?
  check "rejected changed policy cannot reach gate through cached prep" "$(( status != 0 )) $(tests_runs) $(wc -l < "$d/orch/gates")" "1 0 $before"
  : > "$PNPM_LOG"
  bash "$d/scripts/land-queue.sh" "cur/901@t3/curation901:$appwt" > "$d/out" 2>&1
  check "passing updated policy refreshes receipt" "$? $(tests_runs)" "0 1"
  : > "$PNPM_LOG"
  bash "$d/scripts/land-queue.sh" "cur/901@t3/curation901:$appwt" > "$d/out" 2>&1
  check "updated policy receipt can be reused" "$? $(tests_runs)" "0 0"
done
# A remote heavy-check manifest binds one exact tree: no pair, no second item,
# a known mode, and compare needs the local suite's evidence; the dry run says so.
remote=(LAND_REMOTE_CHECKS=/fixture/remote-checks/run/manifest.json LAND_REMOTE_CHECKS_SHA256=0)
# The queue's output goes through an asynchronous tee; reading through a pipe
# returns only once tee has closed it, so the whole output is in $d/out.
captured() { "$@" 2>&1 | cat > "$d/out"; return "${PIPESTATUS[0]}"; }
app="cur/901@t3/curation901:$appwt"
for refusal in pair items mode triage; do
  case $refusal in
    pair) args=(--pair "$d/plan.json"); env=("${remote[@]}" LAND_REMOTE_CHECKS_MODE=replace); want='remote checks do not apply to pairs' ;;
    items) args=("$app" "impl/table:$iwt"); env=("${remote[@]}" LAND_REMOTE_CHECKS_MODE=replace); want='remote checks bind one item; got 2' ;;
    mode) args=("$app"); env=("${remote[@]}" LAND_REMOTE_CHECKS_MODE=skip); want="unknown remote checks mode 'skip'" ;;
    triage) args=("$app"); env=("${remote[@]}" LAND_REMOTE_CHECKS_MODE=compare); want='compare mode needs TRIAGE_EVIDENCE' ;;
  esac
  before=$(wc -l < "$d/orch/gates")
  : > "$PNPM_LOG"
  captured env "${env[@]}" bash "$d/scripts/land-queue.sh" "${args[@]}"; status=$?
  check "remote checks refuse ($refusal) before prep or gate" "$(( status != 0 )) $(grep -cF "$want" "$d/out") $(wc -l < "$d/orch/gates") $(wc -l < "$PNPM_LOG")" "1 1 $before 0"
done
# Under remote checks only the remote-suite receipt (cur-901-prep.remote.receipt)
# stands in; a local one doesn't, and a stale one is refused, never re-prepped
# locally inside the gate.
rq=(env "${remote[@]}" LAND_REMOTE_CHECKS_MODE=replace bash "$d/scripts/land-queue.sh")
remote_prep() { bash "$d/scripts/cur-prep.sh" --remote-suite "$@" --branch t3/curation901 --worktree "$appwt" 901 "$d/orch/briefs/cur-901-msg.txt" > "$d/prep.out" 2>&1; }
prep_ran() { grep -c 'check:artifacts' "$PNPM_LOG"; }
local_receipt=$d/orch/logs/cur-901-prep.receipt remote_receipt=$d/orch/logs/cur-901-prep.remote.receipt
receipts() { echo "$([[ -e $local_receipt ]] && echo local || echo -) $([[ -e $remote_receipt ]] && echo remote || echo -)"; }
: > "$PNPM_LOG"
captured "${rq[@]}" --dry-run "$app"; status=$?
check "under remote checks a fresh local receipt doesn't stand in: the dry run would refuse" \
  "$(receipts) $(( status != 0 )) $(grep -c '^   would refuse: remote checks need a reusable remote-mode prep receipt (no remote-suite prep receipt)' "$d/out") $(prep_ran)" "local - 1 1 0"
remote_prep; check "a remote-suite prep of the app curation passes, leaving only its own receipt" "$? $(receipts) $(sed -n 's/^tests=//p' "$remote_receipt")" "0 - remote remote"
captured env "${remote[@]}" LAND_REMOTE_CHECKS_MODE=replace bash "$d/scripts/land-queue.sh" --dry-run "$app"; status=$?
check "a replace dry run names the remote checks instead of the local heavy stages" \
  "$status $(grep -c '^   would verify remote checks /fixture/remote-checks/run/manifest.json (replace) and run its host audits instead of typecheck, lint and the full suite$' "$d/out")" "0 1"
captured env "${remote[@]}" LAND_REMOTE_CHECKS_MODE=compare TRIAGE_EVIDENCE="$d/triage" bash "$d/scripts/land-queue.sh" --dry-run "$app"; status=$?
check "a compare dry run names the comparison with the full suite" \
  "$status $(grep -c '^   would verify remote checks /fixture/remote-checks/run/manifest.json (compare) and compare them with the full suite$' "$d/out")" "0 1"
captured bash "$d/scripts/land-queue.sh" --dry-run "$app"
check "without remote checks the dry run has no remote line, and would prep: there is no local receipt" \
  "$? $(grep -c "would verify remote" "$d/out") $(grep -c 'would run: .*cur-prep.sh .*(no prep receipt)' "$d/out")" "0 0 1"
before=$(wc -l < "$d/orch/gates")
: > "$PNPM_LOG"
captured "${rq[@]}" "$app"; status=$?
check "under remote checks the queue reuses the remote receipt and gates the same commit" \
  "$status $(tests_runs) $(prep_ran) $(grep -c '^prep cur/901@t3/curation901:.* reused: receipt .*(remote suite)' "$d/out") $(gated)" \
  "0 0 0 1 t3/curation901 $(git -C "$appwt" rev-parse HEAD)"
echo "fixed" >> "$appwt/docs/catalog-import/traits-901.md"; git -C "$appwt" commit -qa --amend --no-edit
head=$(git -C "$appwt" rev-parse HEAD); receipt_sum=$(sha256sum < "$remote_receipt")
before=$(wc -l < "$d/orch/gates")
: > "$PNPM_LOG"
captured "${rq[@]}" "$app"; status=$?
check "under remote checks a stale receipt is refused, never re-prepped, and nothing is gated" \
  "$(( status != 0 )) $(grep -c 'remote checks need a reusable remote-mode prep receipt (commit changed since the prep' "$d/out") $(grep -c 'fresh prep, push and review' "$d/out") $(prep_ran) $(tests_runs) $(wc -l < "$d/orch/gates") $(git -C "$appwt" rev-parse HEAD) $(sha256sum < "$remote_receipt")" \
  "1 1 1 0 0 $before $head $receipt_sum"
: > "$PNPM_LOG"
captured "${rq[@]}" --dry-run "$app"; status=$?
check "the dry run says the same and would not prep" \
  "$(( status != 0 )) $(grep -c '^   would refuse: remote checks need a reusable remote-mode prep receipt (commit changed since the prep' "$d/out") $(grep -c 'would run: .*cur-prep.sh' "$d/out") $(prep_ran)" "1 1 0 0"
: > "$PNPM_LOG"
captured env LAND_REMOTE_CHECKS= bash "$d/scripts/land-queue.sh" "$app"; status=$?
check "without remote checks the queue reads only the local receipt, finds none and preps locally" \
  "$status $(tests_runs) $(prep_ran) $(grep -c 'not reusing the prep (no prep receipt)' "$d/out") $(receipts) $(sed -n 's/^tests=//p' "$local_receipt")" "0 1 1 1 local - local"
: > "$PNPM_LOG"
captured "${rq[@]}" "$app"; status=$?
check "under remote checks that fresh local receipt is refused, with no prep and no gate" \
  "$(( status != 0 )) $(grep -c 'remote checks need a reusable remote-mode prep receipt (no remote-suite prep receipt)' "$d/out") $(prep_ran) $(tests_runs)" "1 1 0 0"
# Each a remote full-plan receipt (--full, and without it: this diff, which
# changed the artifact checker, plans full by itself) at the local name: as
# copied, edited to tests=local, and with an older commit's passing log
# transplanted with its receipt fields (the r2 finding). The local queue
# preps locally every time, saying why.
old=$d/old.receipt
cp "$local_receipt" "$old"
echo "fixed again" >> "$appwt/docs/catalog-import/traits-901.md"; git -C "$appwt" commit -qa --amend --no-edit
for args in --full ""; do
  for edit in copy tests transplant; do
    remote_prep $args
    cp "$remote_receipt" "$d/remote.receipt"
    case $edit in
      copy) cp "$d/remote.receipt" "$local_receipt"; want='tests=remote in the local prep receipt: a receipt in the wrong file' ;;
      tests) sed 's/^tests=remote$/tests=local/' "$d/remote.receipt" > "$local_receipt"; want='tests=local without its test log evidence (testLog=-)' ;;
      transplant)
        awk -F= -v old="$old" 'BEGIN { while ((getline line < old) > 0) { split(line, kv, "="); k = kv[1]; v[k] = substr(line, length(k) + 2) } }
          $1 ~ /^(tests|checks|testLog|testLogSha256|config)$/ { print $1 "=" v[$1]; next } { print }' "$d/remote.receipt" > "$local_receipt"
        want='was written for another commit' ;;
    esac
    : > "$PNPM_LOG"
    captured env LAND_REMOTE_CHECKS= bash "$d/scripts/land-queue.sh" "$app"; status=$?
    check "the local queue preps despite a remote ${args:-automatic} full-plan receipt at the local name ($edit), saying why" \
      "$(sed -n 's/^mode=//p' "$d/remote.receipt") $status $(tests_runs) $(prep_ran) $(grep -c "not reusing the prep (.*$want" "$d/out") $(sed -n 's/^tests=//p' "$local_receipt")" \
      "full 0 1 1 1 local"
  done
done
# The light lane (cur-land.sh) binds one code item: no pair, no second item,
# no curation item, no remote checks; the dry run says what it replaces.
for refusal in unknown pair items cur remote; do
  case $refusal in
    unknown) args=("impl/table:$iwt"); env=(LAND_LANE=heavy); want="unknown lane 'heavy'" ;;
    pair) args=(--pair "$d/plan.json"); env=(LAND_LANE=light); want='light lane does not apply to pairs' ;;
    items) args=("impl/table:$iwt" "$app"); env=(LAND_LANE=light); want='light lane binds one item; got 2' ;;
    cur) args=("$app"); env=(LAND_LANE=light); want='light lane is for code items only' ;;
    remote) args=("impl/table:$iwt"); env=(LAND_LANE=light "${remote[@]}" LAND_REMOTE_CHECKS_MODE=replace); want='light lane does not combine with remote checks' ;;
  esac
  before=$(wc -l < "$d/orch/gates")
  : > "$PNPM_LOG"
  captured env "${env[@]}" bash "$d/scripts/land-queue.sh" "${args[@]}"; status=$?
  check "the light lane refuses ($refusal) before prep or gate" "$(( status != 0 )) $(grep -cF "$want" "$d/out") $(wc -l < "$d/orch/gates") $(wc -l < "$PNPM_LOG")" "1 1 $before 0"
done
captured env LAND_LANE=light bash "$d/scripts/land-queue.sh" --dry-run "impl/table:$iwt"; status=$?
check "a light dry run names the light verification instead of the heavy stages" \
  "$status $(grep -c '^   would verify the light lane (light-lane-v1) instead of codegen, pin, typecheck, lint, the full suite and the e2e preflight$' "$d/out")" "0 1"
captured bash "$d/scripts/land-queue.sh" --dry-run "impl/table:$iwt"
check "without the lane the dry run has no light line" "$? $(grep -c 'light lane' "$d/out")" "0 0"
exit $fail
