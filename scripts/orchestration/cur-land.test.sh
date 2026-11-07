#!/usr/bin/env bash
# Exercise both preflight attempts and the landing boundary with stubbed gates.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
run_tmp cur-land-test
dir=$run_tmp
trap 'rm -rf "$dir"' EXIT
mkdir -p "$dir/scripts" "$dir/main" "$dir/bin" "$dir/orch/logs"
cp "$here/cur-land.sh" "$here/paths.sh" "$dir/scripts/"
git -C "$dir/main" init -q -b feature/pf1-character-builder
git -C "$dir/main" -c user.name=Test -c user.email=test@example.test commit --allow-empty -qm base
git -C "$dir/main" worktree add -q -b implementation "$dir/wt"
git -C "$dir/wt" -c user.name=Test -c user.email=test@example.test commit --allow-empty -qm candidate
cat > "$dir/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
echo "pnpm $*" >> "$EP_ORCH/stages"
[[ $* == '-s check:artifacts '* && ${ARTIFACT_FAIL:-} == 1 ]] && exit 1
[[ $* == '-s check:artifacts '* && ${MUTATE_STAGE:-} == artifacts ]] && bash -c "$MUTATE_COMMAND"
exit 0
STUB
cat > "$dir/scripts/codegen.sh" <<'STUB'
#!/usr/bin/env bash
echo codegen >> "$EP_ORCH/stages"
[[ ${MUTATE_STAGE:-} == codegen ]] && bash -c "$MUTATE_COMMAND"
exit 0
STUB
cat > "$dir/scripts/triage-failures.sh" <<'STUB'
#!/usr/bin/env bash
echo triage >> "$EP_ORCH/stages"
[[ -z ${TRIAGE_EVIDENCE:-} ]] || { mkdir "$TRIAGE_EVIDENCE" && printf '%s\n' "$TRIAGE_REPORT" > "$TRIAGE_EVIDENCE/full.json"; }
printf '%s\n' "${VERDICT-all green}"
exit "${TRIAGE_STATUS:-0}"
STUB
cat > "$dir/scripts/e2e-branch.sh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$EP_ORCH/attempts"
[[ $* == "$EXPECTED_WT --preflight --backend local" ]] || exit 2
[[ $MODE == retry && $(wc -l < "$EP_ORCH/attempts") == 2 ]]
STUB
cat > "$dir/scripts/land.sh" <<'STUB'
#!/usr/bin/env bash
touch "$EP_ORCH/landed"
STUB
chmod +x "$dir/bin/pnpm" "$dir/scripts/"*.sh
ARTIFACT_FAIL=1 MAIN="$dir/main" EP_ORCH="$dir/orch" PATH="$dir/bin:$PATH" \
  bash "$dir/scripts/cur-land.sh" implementation "$dir/wt" rejected > "$dir/out" 2>&1 && { cat "$dir/out"; exit 1; }
[[ ! -e $dir/orch/landed && ! -e $dir/orch/attempts ]] || exit 1
[[ $(cat "$dir/orch/stages") == "pnpm -s check:artifacts --base $(git -C "$dir/main" rev-parse HEAD)" ]] || { cat "$dir/out"; exit 1; }
grep -q 'artifact budget failed (see .*artifacts.log)' "$dir/out" || { cat "$dir/out"; exit 1; }
echo 'ok    artifact rejection logs its stage and prevents codegen, tests and landing'
: > "$dir/orch/stages"
rc=0
LAND_EXPECTED_BASE="$(git -C "$dir/wt" rev-parse HEAD)" MAIN="$dir/main" EP_ORCH="$dir/orch" PATH="$dir/bin:$PATH" \
  bash "$dir/scripts/cur-land.sh" implementation "$dir/wt" frozen > "$dir/out" 2>&1 || rc=$?
[[ $rc != 0 && ! -s $dir/orch/stages && ! -e $dir/orch/landed ]] || { cat "$dir/out"; echo 'FAIL pinned integration base was recaptured before artifact guard'; exit 1; }
echo 'ok    changed integration cannot substitute a new artifact comparison base'
mutation_fail=0
for stage in artifacts codegen; do
  : > "$dir/orch/stages"
  rm -f "$dir/orch/attempts" "$dir/orch/landed"
  rc=0
  MUTATE_STAGE=$stage MUTATE_COMMAND="git -C '$dir/wt' -c user.name=Test -c user.email=test@example.test commit --allow-empty -qm 'moved during $stage'" \
    MAIN="$dir/main" EP_ORCH="$dir/orch" PATH="$dir/bin:$PATH" MODE=retry EXPECTED_WT="$dir/wt" \
    bash "$dir/scripts/cur-land.sh" implementation "$dir/wt" mutation > "$dir/out" 2>&1 || rc=$?
  if [[ $rc == 0 || -e $dir/orch/landed || -e $dir/orch/attempts ]]; then
    echo "FAIL  candidate movement during $stage reached later stages or landing"
    cat "$dir/out"
    mutation_fail=1
    continue
  fi
  ! grep -qE 'catalog:pin|typecheck|lint|triage' "$dir/orch/stages" || { cat "$dir/out"; exit 1; }
  if [[ $stage == artifacts ]]; then
    ! grep -q '^codegen$' "$dir/orch/stages" || { cat "$dir/out"; exit 1; }
  fi
  grep -q 'moved during the gate; not landing' "$dir/out" || { cat "$dir/out"; exit 1; }
  echo "ok    candidate movement during $stage prevents later stages and landing"
done
for change in dirty branch base; do
  : > "$dir/orch/stages"
  rm -f "$dir/orch/attempts" "$dir/orch/landed"
  case $change in
    dirty) mutation="touch '$dir/wt/late-file'" ;;
    branch) mutation="git -C '$dir/wt' checkout -qb other-candidate" ;;
    base) mutation="git -C '$dir/main' -c user.name=Test -c user.email=test@example.test commit --allow-empty -qm 'integration moved'" ;;
  esac
  rc=0
  MUTATE_STAGE=artifacts MUTATE_COMMAND=$mutation MAIN="$dir/main" EP_ORCH="$dir/orch" PATH="$dir/bin:$PATH" \
    bash "$dir/scripts/cur-land.sh" implementation "$dir/wt" identity > "$dir/out" 2>&1 || rc=$?
  [[ $rc != 0 && ! -e $dir/orch/landed && ! -e $dir/orch/attempts ]] || { cat "$dir/out"; exit 1; }
  ! grep -q '^codegen$' "$dir/orch/stages" || { cat "$dir/out"; exit 1; }
  echo "ok    $change identity change during artifacts prevents codegen and landing"
  [[ $change == dirty ]] && rm "$dir/wt/late-file"
  [[ $change == branch ]] && git -C "$dir/wt" checkout -q implementation
done
[[ $mutation_fail == 0 ]] || exit 1
for mode in retry fail; do
  : > "$dir/orch/stages"
  rm -f "$dir/orch/attempts" "$dir/orch/landed"
  rc=0
  MAIN="$dir/main" EP_ORCH="$dir/orch" PATH="$dir/bin:$PATH" MODE=$mode EXPECTED_WT="$dir/wt" \
    bash "$dir/scripts/cur-land.sh" implementation "$dir/wt" check > "$dir/out" 2>&1 || rc=$?
  [[ $(wc -l < "$dir/orch/attempts") == 2 ]] || { cat "$dir/out"; exit 1; }
  if [[ $mode == retry ]]; then
    [[ $rc == 0 && -e $dir/orch/landed ]] || { cat "$dir/out"; exit 1; }
    [[ $(head -2 "$dir/orch/stages" | tail -1) == codegen ]] || exit 1
    echo 'ok    artifacts pass before codegen and both local preflight attempts before landing'
    # A qualifying entry point never reuses a prepared environment (#754).
    ! grep -q -- '--reuse' "$dir/orch/attempts" || { cat "$dir/orch/attempts"; exit 1; }
    echo 'ok    the queue preflight never passes --reuse'
  else
    [[ $rc != 0 && ! -e $dir/orch/landed ]] || { cat "$dir/out"; exit 1; }
    echo 'ok    two failed local preflights prevent landing'
  fi
done
for verdict in 'all green' LOAD NEW REAL REGRESSION '' 'all green extra' $'all green\nLOAD'; do
  rm -f "$dir/orch/attempts" "$dir/orch/landed"
  rc=0
  MAIN="$dir/main" EP_ORCH="$dir/orch" PATH="$dir/bin:$PATH" MODE=retry EXPECTED_WT="$dir/wt" \
    VERDICT="$verdict" bash "$dir/scripts/cur-land.sh" implementation "$dir/wt" strict > "$dir/out" 2>&1 || rc=$?
  if [[ $verdict == 'all green' ]]; then
    [[ $rc == 0 && -e $dir/orch/landed ]] || { cat "$dir/out"; exit 1; }
  else
    [[ $rc != 0 && ! -e $dir/orch/landed && ! -e $dir/orch/attempts ]] || { cat "$dir/out"; exit 1; }
  fi
  echo "ok    strict queue verdict boundary: '$verdict'"
done

# Remote heavy checks: a fixture with a lockfile, an installed lock and a stub
# Vitest file list, so the real remote_checks.py verifies real manifests.
cp "$here/remote_checks.py" "$here/workflow_evidence.py" "$dir/scripts/"
r=$dir/remote
mkdir -p "$r/bin" "$r/orch/logs"
git init -q -b feature/pf1-character-builder "$r/main"
printf '{"name":"fixture"}\n' > "$r/main/package.json"
printf 'lockfileVersion: fixture\n' > "$r/main/pnpm-lock.yaml"
printf 'node_modules/\n' > "$r/main/.gitignore"
mkdir -p "$r/main/scripts/orchestration"
python3 -B "$here/remote-checks.test.py" audit-list > "$r/main/scripts/orchestration/host-audits.json"
git -C "$r/main" add -A
git -C "$r/main" -c user.name=Test -c user.email=test@example.test commit -qm base
git -C "$r/main" worktree add -q -b implementation "$r/wt"
git -C "$r/wt" -c user.name=Test -c user.email=test@example.test commit --allow-empty -qm candidate
rbase=$(git -C "$r/main" rev-parse HEAD)
cat > "$r/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
[[ $1 == --version ]] && { echo 10.29.1; exit 0; }
echo "pnpm $*" >> "$EP_ORCH/stages"
exit 0
STUB
chmod +x "$r/bin/pnpm"
manifest() { PATH="$r/bin:$PATH" python3 -B "$here/remote-checks.test.py" fixture "$r/orch" "$r/wt" "$rbase" "$@"; }
read -r good good_sha < <(manifest) || exit 1
read -r failed failed_sha < <(manifest failed) || exit 1
read -r stale stale_sha < <(manifest stale-base) || exit 1
read -r wrong wrong_sha < <(manifest wrong-tree) || exit 1
read -r parented parented_sha < <(manifest with-parents) || exit 1
read -r listed listed_sha < <(manifest listed-skip) || exit 1
read -r unlisted unlisted_sha < <(manifest unlisted-skip) || exit 1
green=$(python3 -B "$here/remote-checks.test.py" report /gate)
# The host-audit stage (host-audits.sh has its own test): records its call, passes unless HOST_AUDITS_FAIL.
cat > "$dir/scripts/host-audits.sh" <<'STUB'
#!/usr/bin/env bash
echo "host-audits $*" >> "$EP_ORCH/stages"
[[ -z ${HOST_AUDITS_FAIL:-} ]] || { echo "host-audits refused: $HOST_AUDITS_FAIL"; exit 1; }
echo 'host-audits passed: 1 listed tests in 1 files'
STUB
chmod +x "$dir/scripts/host-audits.sh"
trap 'chmod -R u+w "$dir"; rm -rf "$dir"' EXIT
# rland <name> [VAR=value...]: one gate of the remote fixture; output in $r/out.
rland() {
  local name=$1; shift
  : > "$r/orch/stages"; rm -f "$r/orch/attempts" "$r/orch/landed"
  rc=0
  env MAIN="$r/main" EP_ORCH="$r/orch" PATH="$r/bin:$PATH" MODE=retry EXPECTED_WT="$r/wt" "$@" \
    bash "$dir/scripts/cur-land.sh" implementation "$r/wt" "$name" > "$r/out" 2>&1 || rc=$?
}
stage_logs() { (cd "$r/orch/logs" && ls "$1"-*.log | sed -E "s/^$1-[0-9]{8}-[0-9]{6}-//" | LC_ALL=C sort | paste -sd ' '); }
local_stages="pnpm -s check:artifacts --base $rbase
codegen
pnpm catalog:pin
pnpm -s typecheck
pnpm -s lint
triage"
rland default
[[ $rc == 0 && -e $r/orch/landed && $(cat "$r/orch/stages") == "$local_stages" && $(wc -l < "$r/orch/attempts") == 2 ]] || { cat "$r/out"; exit 1; }
[[ $(stage_logs default) == 'artifacts.log codegen.log e2e-retry.log e2e.log full.log land.log lint.log pin.log typecheck.log' ]] || { stage_logs default; exit 1; }
! grep -q remote "$r/out" || { cat "$r/out"; exit 1; }
echo 'ok    without LAND_REMOTE_CHECKS the stage order, logs and output are the local gate'
remote=(LAND_REMOTE_CHECKS="$good" LAND_REMOTE_CHECKS_SHA256="$good_sha")
for manifest_case in good listed; do
  if [[ $manifest_case == good ]]; then args=("${remote[@]}"); else args=(LAND_REMOTE_CHECKS="$listed" LAND_REMOTE_CHECKS_SHA256="$listed_sha"); fi
  rland "replace-$manifest_case" "${args[@]}" LAND_REMOTE_CHECKS_MODE=replace LAND_REMOTE_EVIDENCE="$r/orch/evidence-replace-$manifest_case"
  [[ $rc == 0 && -e $r/orch/landed && $(wc -l < "$r/orch/attempts") == 2 ]] || { cat "$r/out"; exit 1; }
  [[ $(cat "$r/orch/stages") == "$(head -3 <<<"$local_stages")"$'\n'"host-audits $r/wt ${args[0]#*=} ${args[1]#*=} $r/orch/evidence-replace-$manifest_case" ]] \
    || { cat "$r/orch/stages"; exit 1; }
  [[ $(stage_logs "replace-$manifest_case") == 'artifacts.log codegen.log e2e-retry.log e2e.log host-audits.log land.log pin.log remote.log' ]] \
    || { stage_logs "replace-$manifest_case"; exit 1; }
  grep -q "^remote verified ${args[0]#*=}: " "$r/out" && grep -q '^host-audits passed' "$r/out" \
    && grep -q '"passed": true' "$r/orch/evidence-replace-$manifest_case/remote-verification.json" || { cat "$r/out"; exit 1; }
  echo "ok    replace mode ($manifest_case) lands on a verified manifest and the host audits without local typecheck, lint or suite"
done
rland replace-audits-fail "${remote[@]}" LAND_REMOTE_CHECKS_MODE=replace LAND_REMOTE_EVIDENCE="$r/orch/evidence-audits-fail" \
  HOST_AUDITS_FAIL='Host-audit test not passed on the gate host: skipped: tests/b.test.ts > suite tests/b.test.ts works'
[[ $rc != 0 && ! -e $r/orch/landed && ! -e $r/orch/attempts ]] && grep -q '^host-audits refused: Host-audit test not passed on the gate host' "$r/out" \
  && grep -q 'host audits failed (see .*host-audits.log); not landing' "$r/out" || { cat "$r/out"; exit 1; }
! grep -qE 'typecheck|lint|triage' "$r/orch/stages" || { cat "$r/orch/stages"; exit 1; }
echo 'ok    replace mode: a failed host audit blocks preflight and landing'
for manifest_case in good listed; do
  if [[ $manifest_case == good ]]; then args=("${remote[@]}"); else args=(LAND_REMOTE_CHECKS="$listed" LAND_REMOTE_CHECKS_SHA256="$listed_sha"); fi
  rland "compare-$manifest_case" "${args[@]}" LAND_REMOTE_CHECKS_MODE=compare LAND_REMOTE_EVIDENCE="$r/orch/evidence-compare-$manifest_case" \
    TRIAGE_EVIDENCE="$r/orch/triage-compare-$manifest_case" TRIAGE_REPORT="$green"
  [[ $rc == 0 && -e $r/orch/landed && $(cat "$r/orch/stages") == "$local_stages" ]] || { cat "$r/out"; exit 1; }
  grep -q '^remote compare: equal' "$r/out" && [[ -f $r/orch/evidence-compare-$manifest_case/remote-comparison.json ]] || { cat "$r/out"; exit 1; }
  echo "ok    compare mode ($manifest_case) runs the local gate too, not the host-audit stage, and lands only on an equal comparison"
done
rland mismatch "${remote[@]}" LAND_REMOTE_CHECKS_MODE=compare LAND_REMOTE_EVIDENCE="$r/orch/evidence-mismatch" \
  TRIAGE_EVIDENCE="$r/orch/triage-mismatch" TRIAGE_REPORT="$(python3 -B "$here/remote-checks.test.py" report /gate numTotalTestSuites=9 numPassedTestSuites=9)"
[[ $rc != 0 && ! -e $r/orch/landed && ! -e $r/orch/attempts ]] && grep -q 'remote compare refused: Remote and local totals differ' "$r/out" || { cat "$r/out"; exit 1; }
echo 'ok    a compare mismatch blocks preflight and landing'
rland compare-failed-file "${remote[@]}" LAND_REMOTE_CHECKS_MODE=compare LAND_REMOTE_EVIDENCE="$r/orch/evidence-failed-file" \
  TRIAGE_EVIDENCE="$r/orch/triage-failed-file" TRIAGE_REPORT="$(python3 -B "$here/remote-checks.test.py" report /gate failed=tests/a.test.ts)"
[[ $rc != 0 && ! -e $r/orch/landed && ! -e $r/orch/attempts ]] && grep -qF 'remote compare refused: Local suite file not passed: tests/a.test.ts' "$r/out" \
  || { cat "$r/out"; exit 1; }
echo 'ok    compare refuses a failed local file under green counters'
for case in 'tests/a.test.ts:Remote and local suites differ outside the host-audit list: 1 only remote, 1 only local' \
            'tests/b.test.ts:Host-audit test not passed locally: skipped: tests/b.test.ts > suite tests/b.test.ts works'; do
  skip=$(basename "${case%%.*}")
  rland "compare-skip-$skip" LAND_REMOTE_CHECKS="$listed" LAND_REMOTE_CHECKS_SHA256="$listed_sha" LAND_REMOTE_CHECKS_MODE=compare \
    LAND_REMOTE_EVIDENCE="$r/orch/evidence-skip-$skip" TRIAGE_EVIDENCE="$r/orch/triage-skip-$skip" \
    TRIAGE_REPORT="$(python3 -B "$here/remote-checks.test.py" report /gate "skipped=${case%%:*}")"
  [[ $rc != 0 && ! -e $r/orch/landed && ! -e $r/orch/attempts ]] && grep -qF "remote compare refused: ${case#*:}" "$r/out" || { cat "$r/out"; exit 1; }
  echo "ok    compare refuses a local skip of ${case%%:*}: ${case#*:}"
done
for refusal in failed stale wrong parented sha unlisted pair mode triage; do
  case $refusal in
    failed) args=(LAND_REMOTE_CHECKS="$failed" LAND_REMOTE_CHECKS_SHA256="$failed_sha" LAND_REMOTE_CHECKS_MODE=replace) want='Remote command failed: suite' ;;
    stale) args=(LAND_REMOTE_CHECKS="$stale" LAND_REMOTE_CHECKS_SHA256="$stale_sha" LAND_REMOTE_CHECKS_MODE=replace) want='Remote base mismatch' ;;
    wrong) args=(LAND_REMOTE_CHECKS="$wrong" LAND_REMOTE_CHECKS_SHA256="$wrong_sha" LAND_REMOTE_CHECKS_MODE=replace) want='Remote tree mismatch' ;;
    parented) args=(LAND_REMOTE_CHECKS="$parented" LAND_REMOTE_CHECKS_SHA256="$parented_sha" LAND_REMOTE_CHECKS_MODE=replace) want='Gate commit has parents' ;;
    sha) args=("${remote[@]/%$good_sha/${good_sha//?/0}}" LAND_REMOTE_CHECKS_MODE=replace) want='Remote manifest hash mismatch' ;;
    unlisted) args=(LAND_REMOTE_CHECKS="$unlisted" LAND_REMOTE_CHECKS_SHA256="$unlisted_sha" LAND_REMOTE_CHECKS_MODE=replace)
      want='Remote suite has pending or todo tests: not in the host-audit list: tests/a.test.ts' ;;
    pair) args=("${remote[@]}" LAND_REMOTE_CHECKS_MODE=replace LAND_PAIR_MANIFEST="$r/plan.json" LAND_PAIR_PLAN_HASH=0) want='remote checks do not apply to pairs' ;;
    mode) args=("${remote[@]}" LAND_REMOTE_CHECKS_MODE=skip) want="unknown remote checks mode 'skip'" ;;
    triage) args=("${remote[@]}" LAND_REMOTE_CHECKS_MODE=compare) want='compare mode needs TRIAGE_EVIDENCE' ;;
  esac
  rland "refused-$refusal" "${args[@]}" LAND_REMOTE_EVIDENCE="$r/orch/evidence-$refusal"
  [[ $rc != 0 && ! -e $r/orch/landed && ! -e $r/orch/attempts ]] && grep -qF "$want" "$r/out" || { echo "FAIL  remote refusal $refusal"; cat "$r/out"; exit 1; }
  ! grep -qE 'typecheck|lint|triage' "$r/orch/stages" || { cat "$r/orch/stages"; exit 1; }
  case $refusal in pair|mode|triage) [[ ! -s $r/orch/stages ]] || { cat "$r/orch/stages"; exit 1; } ;; esac
  echo "ok    remote refusal ($refusal) gives no local heavy stage, preflight or landing"
done

# Light landing lane (operations.md, "Light landing lane"): the real
# light_lane.py on a base with the pinned readers and a docs-only candidate.
cp "$here/light_lane.py" "$dir/scripts/"
l=$dir/light
mkdir -p "$l/orch/logs"
git init -q -b feature/pf1-character-builder "$l/main"
python3 -B "$here/light-lane.test.py" fixture "$l/main"
doc=docs/agents/lane-fixture.md
mkdir -p "$(dirname "$l/main/$doc")" "$l/main/src"
printf '# Lane fixture\n' > "$l/main/$doc"
printf 'export const a = 1;\n' > "$l/main/src/a.ts"
git -C "$l/main" add -A
git -C "$l/main" -c user.name=Test -c user.email=test@example.test commit -qm base
lbase=$(git -C "$l/main" rev-parse HEAD)
git -C "$l/main" worktree add -q -b implementation "$l/wt"
printf '# Lane fixture\n\nReviewed.\n' > "$l/wt/$doc"
git -C "$l/wt" -c user.name=Test -c user.email=test@example.test commit -qam 'docs candidate'
git -C "$l/main" worktree add -q -b code "$l/code"
printf 'export const a = 2;\n' > "$l/code/src/a.ts"
printf '# Lane fixture\n\nReviewed.\n' > "$l/code/$doc"
git -C "$l/code" -c user.name=Test -c user.email=test@example.test commit -qam 'code candidate'
# lland <name> <branch> <worktree> [VAR=value...]: one gate of the light fixture; output in $l/out.
lland() {
  local name=$1 br=$2 tree=$3; shift 3
  : > "$l/orch/stages"; rm -f "$l/orch/attempts" "$l/orch/landed"
  rc=0
  env MAIN="$l/main" EP_ORCH="$l/orch" PATH="$r/bin:$PATH" MODE=retry EXPECTED_WT="$tree" "$@" \
    bash "$dir/scripts/cur-land.sh" "$br" "$tree" "$name" > "$l/out" 2>&1 || rc=$?
}
light_logs() { (cd "$l/orch/logs" && ls "$1"-*.log 2>/dev/null | sed -E "s/^$1-[0-9]{8}-[0-9]{6}-//" | LC_ALL=C sort | paste -sd ' '); }
lland light implementation "$l/wt" LAND_LANE=light LAND_LIGHT_EVIDENCE="$l/orch/evidence-light"
[[ $rc == 0 && -e $l/orch/landed && ! -e $l/orch/attempts ]] || { cat "$l/out"; exit 1; }
[[ $(cat "$l/orch/stages") == "pnpm -s check:artifacts --base $lbase" ]] || { cat "$l/orch/stages"; exit 1; }
[[ $(light_logs light) == 'artifacts.log land.log light.log' ]] || { light_logs light; exit 1; }
grep -q '^light verified light-lane-v1: 1 paths' "$l/out" && grep -q '"passed": true' "$l/orch/evidence-light/light-verification.json" || { cat "$l/out"; exit 1; }
echo 'ok    the light lane runs only artifacts and the light verification before landing'
lland light-code code "$l/code" LAND_LANE=light LAND_LIGHT_EVIDENCE="$l/orch/evidence-code"
[[ $rc != 0 && ! -e $l/orch/landed && ! -e $l/orch/attempts && ! -e $l/orch/evidence-code ]] || { cat "$l/out"; exit 1; }
[[ $(cat "$l/orch/stages") == "pnpm -s check:artifacts --base $lbase" ]] || { cat "$l/orch/stages"; exit 1; }
[[ $(light_logs light-code) == 'artifacts.log light.log' ]] || { light_logs light-code; exit 1; }
grep -q '^light refused: src/a.ts is outside light-lane-v1$' "$l/out" && grep -q '^light lane refused (see .*light.log); not landing$' "$l/out" || { cat "$l/out"; exit 1; }
echo 'ok    a light refusal stops before codegen, the full stages and landing'
# The lane-checked size limits are check:artifacts' budgets, which the light lane still runs first.
lland light-budget implementation "$l/wt" LAND_LANE=light LAND_LIGHT_EVIDENCE="$l/orch/evidence-budget" PATH="$dir/bin:$PATH" ARTIFACT_FAIL=1
[[ $rc != 0 && ! -e $l/orch/landed && ! -e $l/orch/evidence-budget && $(light_logs light-budget) == artifacts.log ]] \
  && grep -q 'artifact budget failed' "$l/out" || { cat "$l/out"; light_logs light-budget; exit 1; }
echo 'ok    an artifact budget failure stops the light lane before its verification and landing'
for refusal in unknown remote pair; do
  case $refusal in
    unknown) args=(LAND_LANE=heavy) want="unknown lane 'heavy'; not landing" ;;
    remote) args=(LAND_LANE=light LAND_REMOTE_CHECKS="$good" LAND_REMOTE_CHECKS_SHA256="$good_sha" LAND_REMOTE_CHECKS_MODE=replace) want='light lane does not combine with remote checks; not landing' ;;
    pair) args=(LAND_LANE=light LAND_PAIR_MANIFEST="$l/plan.json" LAND_PAIR_PLAN_HASH=0) want='light lane does not apply to pairs; not landing' ;;
  esac
  lland "light-$refusal" implementation "$l/wt" "${args[@]}"
  [[ $rc != 0 && ! -e $l/orch/landed && ! -s $l/orch/stages ]] && grep -qF "$want" "$l/out" || { echo "FAIL  light refusal $refusal"; cat "$l/out"; exit 1; }
  echo "ok    light refusal ($refusal) runs no stage"
done
