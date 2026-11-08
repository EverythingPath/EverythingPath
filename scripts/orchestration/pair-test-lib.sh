# shellcheck shell=bash
# Dummy-command pair CLI fixtures; source after prep-test-lib.sh. Defines functions only.
fixture() {
  local label=$1
  export PATH=$original_path
  d=$root/$label
  prep_fixture "$d" > /dev/null 2>&1
  mkdir -p "$d/scripts"
  cp -p "$here"/*.sh "$here"/*.mjs "$d/scripts/"
  export MAIN=$d/main EP_ORCH=$d/orch PNPM_LOG=$d/pnpm.log
  mv "$d/bin/pnpm" "$d/bin/pnpm-original"
  cat > "$d/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
case "${FAIL_STAGE:-}:$*" in
  'pin:catalog:pin'|'typecheck:-s typecheck'|'lint:-s lint') exit 1 ;;
  'semantic:test '*|'receipt:exec node '*|'install:install --offline'|'writer:-s check:initial-migration-writers') exit 1 ;;
esac
exec "$(dirname "$0")/pnpm-original" "$@"
STUB
  chmod +x "$d/bin/pnpm"
  base=$(git -C "$MAIN" rev-parse HEAD)
  a=$d/app-a; b=$d/app-b
  git -C "$MAIN" worktree add -qb t3/code-a "$a" "$base"
  echo a > "$a/a.txt"; git -C "$a" add a.txt; git -C "$a" commit -qm 'A (#902)'
  git -C "$MAIN" worktree add -qb t3/code-b "$b" t3/code-a
  echo b > "$b/b.txt"; git -C "$b" add b.txt; git -C "$b" commit -qm 'B (#903)'
  before_a=$(git -C "$a" rev-parse HEAD); before_b=$(git -C "$b" rev-parse HEAD)
  cat > "$d/scripts/codegen.sh" <<'STUB'
#!/usr/bin/env bash
[[ ${FAIL_STAGE:-} != codegen ]]
STUB
  cat > "$d/scripts/triage-failures.sh" <<'STUB'
#!/usr/bin/env bash
echo "$(git -C "$1" rev-parse HEAD)" >> "$EP_ORCH/full-gates"
[[ -z ${GATE_HOOK:-} ]] || bash -c "$GATE_HOOK"
echo "${VERDICT-all green}"
[[ ${FAIL_STAGE:-} != suite ]]
STUB
  cat > "$d/scripts/e2e-branch.sh" <<'STUB'
#!/usr/bin/env bash
echo "$*" >> "$EP_ORCH/preflights"
[[ -z ${BOUNDARY_HOOK:-} ]] || bash -c "$BOUNDARY_HOOK"
[[ ${FAIL_STAGE:-} != preflight ]]
STUB
  chmod +x "$d/scripts/"*.sh
  create_plan "$a" "$b"
}
queue() {
  rc=0
  bash "$d/scripts/land-queue.sh" --pair "$d/plan.json" > "$d/out" 2>&1 || rc=$?
}
preserved() {
  [[ $(git -C "$MAIN" rev-parse HEAD) == "$base" && $(git -C "$a" rev-parse HEAD) == "$before_a" && $(git -C "$b" rev-parse HEAD) == "$before_b" && -z $(git -C "$a" status --porcelain) && -z $(git -C "$b" status --porcelain) ]]
}

create_plan() {
  node "$here/pair-plan-fixture.mjs" create "$d/plan.json" "$base" "$1" "$2"
}

refresh_plan() {
  base=$(git -C "$MAIN" rev-parse HEAD)
  before_a=$(git -C "$a" rev-parse HEAD); before_b=$(git -C "$b" rev-parse HEAD)
  node "$here/pair-plan-fixture.mjs" refresh "$d/plan.json" "$base" "$a" "$b"
}

renew_plan() {
  node "$here/pair-plan-fixture.mjs" renew "$d/plan.json" "$manifest"
}
