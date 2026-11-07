#!/usr/bin/env bash
# Fixture contracts only: no live gate, Cloud operation or resource qualification.
# Also the CI static job's fifth command (gate-ci-workflow; remote_ci.py static), so every test here runs on a
# GitHub runner from a depth-1 gate checkout: no $EP_ORCH, no gate-host sources, no git identity, no user systemd.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
run_tmp workflow-test
trap 'rm -rf "$run_tmp"' EXIT
python3 -B "$here/gate-operator.test.py"
python3 -B "$here/gate-runtime.test.py"
python3 -B "$here/gate-run.test.py"
bash "$here/driver-argv.test.sh"
python3 -B "$here/remote-checks.test.py"
python3 -B "$here/remote-ci.test.py"
python3 -B "$here/wip-ci.test.py"
bash "$here/remote-fetch.test.sh"
bash "$here/gate-push.test.sh"
bash "$here/push-guard.test.sh"
bash "$here/host-audits.test.sh"
python3 -B "$here/light-lane.test.py"
python3 -B "$here/gate-monitor.test.py"
bash "$here/lane-lock.test.sh"
bash "$here/pipefail.test.sh"
bash "$here/env-guard.test.sh"
python3 -B "$here/agent-launch-guard.test.py"
# Shell queue, prep, pair, admission and triage fixtures (gate-ci-workflow triage: each runs on dummy commands).
bash "$here/admission.test.sh"
bash "$here/await.test.sh"
bash "$here/bounded-outcome.test.sh"
bash "$here/codegen.test.sh"
bash "$here/triage.test.sh"
bash "$here/triage-evidence.test.sh"
bash "$here/queue-target.test.sh"
bash "$here/cur-prep.test.sh"
bash "$here/cur-land.test.sh"
bash "$here/land-queue.test.sh"
bash "$here/e2e-branch.test.sh"
bash "$here/pair-artifacts.test.sh"
bash "$here/pair-boundary.test.sh"
bash "$here/pair-failures.test.sh"
bash "$here/pair-handoff.test.sh"
bash "$here/pair-preservation.test.sh"
bash "$here/pair-queue.test.sh"
bash "$here/pair-resume.test.sh"
