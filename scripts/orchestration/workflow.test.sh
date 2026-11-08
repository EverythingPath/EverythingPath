#!/usr/bin/env bash
# Fixture contracts only: no live gate, Cloud operation or resource qualification.
# Also the CI static job's workflow leg (gate-ci-workflow, speed-ci-static-split; remote_ci.py static --leg workflow), so
# every test here runs on a GitHub runner from a depth-1 gate checkout: no $EP_ORCH, no gate-host sources, no git
# identity, no user systemd.
# The files run in 2 parallel lanes (lanes.sh: each with its own TMPDIR, every one to the end; speed-ci-static-split),
# listed longest first by their time in one serial run (11 min here; 11.5 min on CI's 4-vCPU runner, run 42424429379).
# Its shell queue, prep, pair, admission and triage fixtures run on dummy commands (gate-ci-workflow triage).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/lanes.sh"
run_tmp workflow-test
trap 'kill $(jobs -p) 2> /dev/null || true; rm -rf "$run_tmp"' EXIT
LANES=2
tests=(
  gate-operator.test.py
  pair-handoff.test.sh
  pair-failures.test.sh
  cur-prep.test.sh
  pair-queue.test.sh
  admission.test.sh
  e2e-branch.test.sh
  wip-ci.test.sh
  gate-run.test.py
  land-queue.test.sh
  remote-checks.test.py
  pair-boundary.test.sh
  gate-runtime.test.py
  remote-ci.test.py
  lane-lock.test.sh
  await.test.sh
  pair-resume.test.sh
  pair-preservation.test.sh
  light-lane.test.py
  pair-artifacts.test.sh
  cur-land.test.sh
  gate-monitor.test.py
  gate-push.test.sh
  agent-launch-guard.test.py
  push-guard.test.sh
  env-guard.test.sh
  driver-argv.test.sh
  push-scan.test.sh
  host-audits.test.sh
  wip-sweep.test.sh
  lanes.test.sh
  pipefail.test.sh
  wip-ci.test.py
  queue-target.test.sh
  remote-fetch.test.sh
  triage-evidence.test.sh
  triage.test.sh
  bounded-outcome.test.sh
  codegen.test.sh
  gate-time.test.py
)
run_lanes "$LANES" "$here" "$run_tmp" "${tests[@]}"
