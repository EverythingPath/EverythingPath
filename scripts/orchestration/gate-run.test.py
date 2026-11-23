"""Script gate operator fixtures: gate-run.py, gate_config.py and the script operator identity in gate_core.

Every test runs on a scratch repository and run root with stubbed bounded.sh, admission.sh, systemctl,
journalctl and btrfs and a stub gate-operator.py whose prepare/resume run the real gate_core authorization.
No test launches an agent, a bounded unit or a gate.
"""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import gate_config  # noqa: E402
import gate_core  # noqa: E402
import gate_time  # noqa: E402
from workflow_evidence import create_json, digest, reference  # noqa: E402

GiB = 1024 ** 3
REAL = ('gate-run.py', 'gate_config.py', 'gate_core.py', 'gate_monitor.py', 'workflow_evidence.py',
        'validation.py', 'remote_checks.py', 'light_lane.py', 'gate_time.py', 'disk_guard.py')
SOL = [{'id': 'reasoningEffort', 'value': 'xhigh'}, {'id': 'serviceTier', 'value': 'default'}]
OPUS = [{'id': 'effort', 'value': 'high'}, {'id': 'fastMode', 'value': False}]

# The stub gate operator: prepare and resume run the real gate_core checks on the generated gate.json,
# then do only what a fixture needs (a squash, a mapping, a recorded bounded.sh call, a checked FF).
STUB_OPERATOR = r'''#!/usr/bin/env python3
import json, os, shutil, subprocess, sys
from pathlib import Path
config = json.loads(Path(os.environ['GATE_CONFIG']).read_text())
sys.path.insert(0, config['main'] + '/scripts/orchestration')
import gate_core
from workflow_evidence import create_json, reference
import time
from datetime import datetime, timezone
v = gate_core.env(); E = Path(v['E']); O = Path(v['ORCH']); mode = sys.argv[1]
def git(root, *args): return subprocess.check_output(['git', '-C', root, *args], text=True).strip()
def flag(name): return (O / ('flag-' + name)).exists()
if mode == 'prepare':
    gate_core.reject_overrides()
    gate_core.authorization(v, full_validation=True)
    gate_core.execution_control(v, step='prepare')
    if flag('prepare-fail'):
        sys.exit('fixture prepare refusal')
    E.mkdir()
    if config['preparation']['mode'] == 'prepared':
        mapping = json.loads(Path(config['preparation']['mapping']['path']).read_text())
    else:
        git(v['WT'], 'update-ref', v['ARCHIVE'], v['REVIEWED'], '0' * 40)
        candidate = git(v['WT'], 'commit-tree', v['TREE'], '-p', v['BASE'], '-F', config['preparation']['message']['path'])
        git(v['WT'], 'update-ref', 'refs/heads/' + v['BR'], candidate, v['REVIEWED'])
        mapping = {key: v[key] for key in ('BASE', 'REVIEWED', 'TREE', 'WT', 'BR', 'ARCHIVE')}
        mapping['SQUASHED'] = candidate
    create_json(E / 'mapping.json', mapping)
    runtime = E / 'operator-runtime'; runtime.mkdir(); shutil.copyfile(__file__, runtime / 'gate-operator.py')
    create_json(E / 'prepared.json', dict(config=reference(v['CONFIG']), bindings=[reference(E / 'mapping.json')]))
    if flag('busy-after-prepare'): (O / 'admission-busy').touch()
    if flag('storage-event-after-prepare'): (O / 'storage-event').touch()
    print(json.dumps(mapping))
elif mode == 'runtime':
    print(E / 'operator-runtime/gate-operator.py')
elif mode == 'resume':
    if 'gateTime' in config and not Path(config['gateTime']['path']).is_file():
        sys.exit('fixture queue: no gate-time file when the queue starts')
    if flag('resume-slow'):  # a stop signal reaches the driver while this short resume is starting
        time.sleep(1.5)
    gate_core.reject_overrides()
    gate_core.authorization(v, full_validation=True)
    gate_core.execution_control(v, step='submit')
    candidate = json.loads((E / 'mapping.json').read_text())['SQUASHED']
    claimed = time.time()
    create_json(E / 'submission-claim.json', dict(at=datetime.fromtimestamp(claimed, timezone.utc).isoformat(), candidate=candidate, label=v['LABEL'], attempt=v['E']))
    if 'gateTime' in config:  # the queue's wait ledger (land-queue.sh, paths.sh gate_wait)
        launch, waits = (600.0, 'wait\theavy.lock\t100.0\n') if flag('resume-waited') else (0.0, '')
        Path(config['gateTime']['waits']).write_text('started\t%.6f\n%s' % (claimed + launch, waits))
    out = subprocess.run([str(O / 'bounded.sh'), '--detach', v['LABEL'], 'gate', 'land-queue.sh'], capture_output=True, text=True, check=True).stdout
    invocation = out.split('id: ')[1].strip()
    create_json(E / 'submission.json', dict(id=invocation, unit='ep-fresh-' + invocation, log=str(O / 'logs' / ('bounded-' + invocation + '.log')), candidate=candidate))
    if flag('unit-ends-late'):  # the queue's triage checkout, recorded before it exists (paths.sh); the stopped unit is still ending
        scratch = Path(v['MAIN']).parent / ('ep-gate-' + Path(v['WT']).name + '-20261110-010203-AbCdEf')
        (E / 'scratch-worktrees.txt').open('a').write(str(scratch) + '\n')
        git(v['WT'], 'worktree', 'add', '-q', '--detach', str(scratch), candidate)
        sys.exit('fixture observer failed')
    receipt = O / 'bounded' / invocation; receipt.mkdir(parents=True)
    create_json(receipt / 'receipt.json', dict(id=invocation, outcome='ok', exitCode=0, startedAt='s', endedAt='e', realPeakBytes=5023182848))
    (receipt / 'memory').write_text('real_peak=5023182848\npeak=5922676736\nsamples=30\n')
    # The canonical unit's log names the queue's stage logs (cur-land.sh), as a real gate's does.
    Path(O / 'logs' / ('bounded-' + invocation + '.log')).write_text('took resource.lock\nlogs: logs/fixture-20261105-170001-*.log\nall green\n')
    (O / 'logs/fixture-20261105-170001-codegen.log').write_text('Target: disposable local Convex for code generation.\n')
    (O / 'logs/fixture-20261105-170001-e2e.log').write_text('e2e: skipped (no app changes)\n')
    if flag('gate-time-refused'):  # cur-land.sh's total check just before land.sh refused
        (O / 'logs/fixture-20261105-170001-gate-time.log').write_text('gate-time refused: gate time 2000 s is 100.0% over the 1000 s median of replace\n')
        sys.exit('fixture queue: gate time refused (see logs/fixture-20261105-170001-gate-time.log); not landing')
    if flag('resume-stopped'):  # root's --stop while the operator observes
        control = json.loads(Path(config['control']).read_text()); control['state'] = 'stopped'
        Path(config['control']).write_text(json.dumps(control))
        gate_core.execution_control(v, step='observe')
    (E / 'triage-evidence').mkdir()
    if flag('truncated-suite'):  # the suite was interrupted while it wrote its report
        (E / 'triage-evidence/full.json').write_text('{"numTotalTests": 7, "numPass')
        sys.exit('fixture interrupted suite')
    if flag('malformed-host-audits'):
        (E / 'remote-evidence').mkdir()
        (E / 'remote-evidence/host-audits.json').write_text('{broken')
        sys.exit('fixture malformed host audits')
    create_json(E / 'triage-evidence/full.json', dict(success=True, numTotalTests=7, numPassedTests=7, numFailedTests=0, numPendingTests=0,
                numTodoTests=0, numTotalTestSuites=2, numPassedTestSuites=2, numFailedTestSuites=0,
                testResults=[dict(name='/gate/fixture.test.ts', status='passed', assertionResults=[])]))
    git(v['MAIN'], 'merge', '-q', '--ff-only', candidate)
    if flag('floor-stop-after-land'):  # the monitor's floor stop after land.sh moved MAIN; collect fails, run raises
        create_json(E / 'stop-reason.json', dict(at='fixture', violations=[dict(hostBelow6GiBSeconds=5.0)], invocation={}))
        create_json(E / 'result.json', dict(passed=False, checks=dict(canonicalReceipt=True, checkedLanding=True, noStoppedAttempt=False),
                                            errors=[], evidence=[]))
        sys.exit('Failed gate collected; no successful completion or retry')
    create_json(E / 'result.json', dict(passed=True, checks=dict(canonicalReceipt=True, checkedLanding=True), errors=[], evidence=[]))
    create_json(E / 'completion.json', dict(passed=True, result=reference(E / 'result.json'), scope='fixture scope'))
    print(json.dumps(dict(passed=True)))
elif mode == 'cancel':
    (O / 'cancel.log').open('a').write('cancel\n')
    owned = json.loads((E / 'submission.json').read_text()) if (E / 'submission.json').is_file() else None
    record = E / 'scratch-worktrees.txt'
    if owned and (O / 'bounded' / owned['id'] / 'receipt.json').is_file() and record.is_file():
        # Terminal: the recorded scratch goes, as gate_operator.cancel removes it (gate-operator.test.py ScratchCleanupTest).
        recorded = record.read_text().splitlines()
        for path in recorded:
            git(v['MAIN'], 'worktree', 'remove', '--force', '--force', path)
        (E / 'scratch-cleanup.jsonl').open('a').write(json.dumps(dict(at='fixture', recorded=recorded,
                                                      paths=[dict(path=path, state='removed') for path in recorded])) + '\n')
    print(json.dumps(dict(cancelled=True)))
'''


# Every malformed `message_body` value: gate_config refuses each, and brief.py passes each through for it to refuse.
MALFORMED_BODIES = (3, 0, 0.0, False, True, None, '', ' ', '  \n', [], ['A body'], {}, {'text': 'A body'})


class FakeTime:
    def __init__(self, hook=None):
        self.now, self.hook, self.calls = 0.0, hook, 0

    def clock(self):
        return self.now

    def sleep(self, seconds):
        self.calls += 1
        self.now += seconds
        if self.hook:
            self.hook(self.calls)


class Fixture(unittest.TestCase):
    # A class may run the real admission.sh (committed in MAIN's base) or a stub with another intent case.
    real_admission = False
    intent_case = 'intent) echo "intent $2"; cat > /dev/null;;'

    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'))
        self.root = Path(self.scratch.name).resolve()
        self.main, self.worker, self.orch = self.root / 'main', self.root / 'worker', self.root / 'orch'
        self.r = self.orch / 'run'
        for path in (self.main / 'scripts/orchestration', self.r / 'fixture-review-r1', self.orch / 'logs', self.orch / 'runs', self.root / 'bin'):
            path.mkdir(parents=True)
        scripts = self.main / 'scripts/orchestration'
        for name in REAL:
            shutil.copyfile(HERE / name, scripts / name)
        (scripts / 'gate-operator.py').write_text(STUB_OPERATOR)
        # status and peek print the ledger line (peek adds its stale line); held tells held, free and missing files
        # apart (with flock -n, a stub's shortcut; the real one reads /proc/locks); intent
        # registers (each call is logged in admission-calls.log) and holds until its stdin ends.
        # TerminalProbeTest and AdmissionIntentTest run the real admission.sh instead.
        self.stub(scripts / 'admission.sh', '#!/bin/sh\necho "$*" >> "$BOUNDED_STATE_DIR/admission-calls.log"\n'
                  'case "$1" in status|peek) if [ -e "$BOUNDED_STATE_DIR/admission-busy" ]; then '
                  'echo "memory: 12/18 GiB reserved; active: gate-x; queued: none"; else echo "memory: 0/18 GiB reserved; active: none; queued: none"; fi; '
                  'if [ "$1" = peek ]; then echo "stale: none"; fi;; held) shift; for f; do if [ ! -e "$f" ]; then echo "missing $f"; '
                  'elif flock -n "$f" true; then echo "free $f"; else echo "held $f"; fi; done;; '
                  + self.intent_case + ' esac\n')
        if self.real_admission:
            for name in ('admission.sh', 'memory-reservations.tsv'):
                shutil.copyfile(HERE / name, scripts / name)
            (scripts / 'admission.sh').chmod(0o755)
        (self.main / '.gitignore').write_text('node_modules/\n')
        self.git(self.main, 'init', '-q', '-b', 'feature/pf1-character-builder')
        self.git(self.main, 'config', 'user.name', 'Fixture')
        self.git(self.main, 'config', 'user.email', 'fixture@example.test')
        # A gate needs automatic Git maintenance off in MAIN (operations.md#protected-refs).
        self.git(self.main, 'config', 'gc.auto', '0')
        self.git(self.main, 'config', 'maintenance.auto', 'false')
        self.git(self.main, 'add', '.')
        self.git(self.main, 'commit', '-qm', 'base')
        self.base, self.basetree = self.git(self.main, 'rev-parse', 'HEAD'), self.git(self.main, 'rev-parse', 'HEAD^{tree}')
        self.git(self.main, 'worktree', 'add', '-qb', 'implementation', str(self.worker))
        for index in range(2):
            (self.worker / 'value').write_text(str(index) + '\n')
            self.git(self.worker, 'add', '.')
            self.git(self.worker, 'commit', '-qm', 'author step')
        self.reviewed, self.tree = self.git(self.worker, 'rev-parse', 'HEAD'), self.git(self.worker, 'rev-parse', 'HEAD^{tree}')
        # Shared run state, the stubbed wrappers and host tools.
        (self.orch / 'resource-policy.md').write_text('Synthetic fixture policy\n')
        self.stub(self.orch / 'bounded.sh', '#!/bin/sh\necho "$*" >> "%s/launches.log"\n'
                  'echo "unit: ep-fresh-$2-20261105-170000-abcdef; log: %s/logs/bounded-$2-20261105-170000-abcdef.log; id: $2-20261105-170000-abcdef"\n'
                  % (self.orch, self.orch))
        bin_dir = self.root / 'bin'
        self.stub(bin_dir / 'systemctl', '#!/bin/sh\nexit 0\n')
        self.stub(bin_dir / 'journalctl', '#!/bin/sh\ncase "$*" in *--after-cursor*) if [ -e "%s/storage-event" ]; then '
                  'echo "2026-11-05T17:00:00 kernel: ata9: hard resetting link"; exit 0; fi; echo "-- No entries --"; exit 1;; esac\n'
                  'printf -- "-- No entries --\\n-- cursor: s=fixture;i=1\\n"\n' % self.orch)
        self.stub(bin_dir / 'btrfs', '#!/bin/sh\necho "[/dev/sda2].write_io_errs    0"\n')
        for tool in ('node', 'pnpm', 'docker'):
            self.stub(bin_dir / tool, '#!/bin/sh\nexit 0\n')
        reviews = {}
        folder = self.r / 'fixture-review-r1'
        self.terminal(folder / 'author-terminal.json', 'author', 'claudeAgent', 'claude-opus-5-5', OPUS)
        for axis in ('standards', 'spec'):
            self.terminal(folder / (axis + '-terminal.json'), 'review-' + axis, 'codex', 'gpt-6.1-sol', SOL)
            (folder / (axis + '.md')).write_text('Synthetic fixture review, not authentic qualification.\n')
            reviews[axis] = dict(terminal='R/fixture-review-r1/' + axis + '-terminal.json', report='R/fixture-review-r1/' + axis + '.md')
        (folder / 'parent-acceptance.md').write_text('Fixture acceptance\n')
        self.spec = dict(title='Fixture gate', kind='code', base=self.base, basetree=self.basetree, reviewed=self.reviewed,
                         tree=self.tree, wt=str(self.worker), branch='implementation', label='fixture-r1',
                         archive='refs/archive/fixture/reviewed-final-r1', inputs_dir='R/fixture-gate-r1-inputs',
                         evidence_dir='R/fixture-gate-r1-evidence', result='R/fixture-gate-r1-result.md',
                         done_marker='EP_ORCH/runs/fixture-final-gate-r1.done', acceptance='R/fixture-review-r1/parent-acceptance.md',
                         author_terminal='R/fixture-review-r1/author-terminal.json', reviews=reviews,
                         message='Land the fixture', browser='Fixture only.', notes=[])
        self.spec_path = self.r / 'fixture-gate-spec-r1.json'
        self.write_spec()
        self.inputs, self.attempt = self.r / 'fixture-gate-r1-inputs', self.r / 'fixture-gate-r1-evidence'
        # The disk floor (disk_guard.py) reads a healthy fixture volume, never this host's or a CI runner's disk.
        (self.root / 'mountinfo').write_text('20 1 259:2 / / rw - ext4 /dev/fixture1 rw\n')
        self.environment = mock.patch.dict(os.environ, {'PATH': str(bin_dir) + ':' + os.environ['PATH'],
                                                        'BOUNDED_LOCKS': 'resource curator', 'VITEST_MAX_WORKERS': '4',
                                                        'CAPPED_KIND': 'light', 'LANG': 'en_US.UTF-8',
                                                        'DISK_GUARD_SYSFS': str(self.root / 'no-sys'),
                                                        'DISK_GUARD_MOUNTINFO': str(self.root / 'mountinfo'),
                                                        'DISK_GUARD_FREE_BYTES': str(100 * GiB)})
        self.environment.start()
        os.environ.pop('BOUNDED_ID', None)
        os.environ.pop('GATE_CONFIG', None)

    def tearDown(self):
        self.environment.stop()
        self.scratch.cleanup()

    def git(self, root, *args):
        return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()

    def stub(self, path, text):
        path.write_text(text)
        path.chmod(0o755)

    def terminal(self, path, name, provider, model, options):
        path.write_text(json.dumps(dict(taskId='task-' + name, childRunId='run-' + name, latestTerminalRunId='run-' + name,
                                        status='completed', latestTerminalStatus='completed', hasPendingChildRuns=False,
                                        providerInstanceId=provider, model=model, options=options)))

    def write_spec(self):
        self.spec_path.write_text(json.dumps(self.spec, indent=2) + '\n')

    def flag(self, name):
        (self.orch / ('flag-' + name)).touch()

    def driver_module(self):
        spec = importlib.util.spec_from_file_location('gate_run_fixture', self.main / 'scripts/orchestration/gate-run.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.read_jobs = self.read_jobs  # no fixture reads GitHub
        return module

    def read_jobs(self, runner):
        jobs = getattr(self, 'jobs', None)
        if jobs is None:
            raise gate_time.Unmeasured('fixture: GitHub is not read')
        return jobs

    def driver(self, available=30 * GiB, hook=None):
        module = self.driver_module()
        # Ten samples, not 180 (or 60 when only memory blocks); test_prelaunch_constants_are_the_operator_rules pins 90 and 30 minutes.
        module.PRELAUNCH_DEADLINE = module.PRELAUNCH_MEMORY_DEADLINE = 300
        clock = FakeTime(hook)
        value = available if callable(available) else (lambda: available)
        driver = module.Driver(self.spec_path, orch=self.orch, main=self.main, sleep=clock.sleep, clock=clock.clock, available=value)
        return module, driver, clock

    def run_gate(self, **options):
        module, driver, clock = self.driver(**options)
        code = driver.run()
        result_path = self.r / 'fixture-gate-r1-result.json'
        result = json.loads(result_path.read_text()) if result_path.is_file() else None
        return code, result, driver

    def launches(self):
        path = self.orch / 'launches.log'
        return path.read_text().splitlines() if path.is_file() else []

    def assert_stopped(self, code, result, reason):
        self.assertEqual(code, 1)
        self.assertEqual(result['verdict'], 'stopped')
        self.assertFalse(result['passed'])
        self.assertIn(reason, result['stopReason'])
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').is_file())
        self.assertTrue((self.r / 'fixture-gate-r1-result.md').is_file())
        self.assertEqual(self.git(self.main, 'rev-parse', 'HEAD'), self.base)


class ScriptOperatorRunTest(Fixture):
    def test_end_to_end_dry_run_lands_through_the_stubbed_queue(self):
        code, result, driver = self.run_gate()
        self.assertEqual(code, 0, result and result['stopReason'])
        self.assertEqual(result['verdict'], 'landed')
        candidate = json.loads((self.attempt / 'mapping.json').read_text())['SQUASHED']
        self.assertEqual(result['identities']['candidate'], candidate)
        self.assertEqual(self.git(self.main, 'rev-parse', 'HEAD'), candidate)
        self.assertEqual(self.git(self.main, 'rev-parse', 'HEAD^{tree}'), self.tree)
        self.assertEqual(len(self.launches()), 1, 'exactly one submission')
        self.assertEqual((result['suite']['source'], result['suite']['local']['numPassedTests']), ('local', 7))
        self.assertEqual([row['name'] for row in result['stages']],
                         ['identity', 'worktree', 'mode-prechecks', 'gate-time', 'prelaunch', 'storage-baseline', 'environment-precheck',
                          'prepare', 'runtime', 'admission-probe', 'preclaim', 'resume'])
        self.assertEqual({row['name']: row.get('exitCode') for row in result['stages'] if 'exitCode' in row}, dict(prepare=0, resume=0))
        operator = json.loads((self.inputs / 'operator.json').read_text())
        committed = self.git(self.main, 'rev-parse', self.base + ':scripts/orchestration/gate-run.py')
        self.assertEqual(operator, dict(kind='script', path=str(self.main / 'scripts/orchestration/gate-run.py'), commit=self.base,
                                        blob=committed, taskId='script:scripts/orchestration/gate-run.py@' + committed, runId=operator['runId']))
        self.assertEqual(result['driver']['blob'], committed)
        config = json.loads((self.inputs / 'gate.json').read_text())
        self.assertEqual(config['operator'], reference(self.inputs / 'operator.json'))
        self.assertEqual(config['phases'], ['prepare', 'submit', 'observe', 'collect', 'complete', 'checked-land'])
        self.assertEqual([item['path'] for item in config['preservedEvidence']],
                         [str(self.r / 'fixture-review-r1/parent-acceptance.md')] +
                         [str(self.inputs / name) for name in ('environment-precheck.json', 'mode-precheck.json', 'gate-time-precheck.json',
                                                               'prelaunch-probes.jsonl')])
        self.assertEqual((self.inputs / 'commit-message.txt').read_text(),
                         'Land the fixture\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n')
        self.assertEqual(self.git(self.main, 'log', '-1', '--format=%B', candidate) + '\n',
                         'Land the fixture\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n', 'no body: title and trailer only')
        precheck = json.loads((self.inputs / 'environment-precheck.json').read_text())
        self.assertEqual(precheck['publicEnvironment'], dict(LANG=None, LC_ALL='C.UTF-8', TZ=None, CI=None, VITEST_MAX_WORKERS=None,
                                                             BOUNDED_WORKERS='2', BOUNDED_CPU='600%'))
        self.assertEqual(len((self.inputs / 'prelaunch-probes.jsonl').read_text().splitlines()), 3)
        self.assertIn('LANDED', (self.r / 'fixture-gate-r1-result.md').read_text())
        self.assertIn('- **MAIN:** at the candidate `%s`\n' % candidate, (self.r / 'fixture-gate-r1-result.md').read_text())
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').read_text().startswith('landed fixture-r1 '))

    def test_the_result_records_its_gate_time_and_the_queue_gets_the_file(self):
        code, result, driver = self.run_gate()
        self.assertEqual(code, 0, result and result['stopReason'])
        stages = {row['name']: row['seconds'] for row in result['stages']}
        self.assertEqual(stages['prelaunch'], 60)
        timed = result['gateTime']
        self.assertEqual((timed['mode'], timed['ci'], timed['total'], timed['verdict']), ('local', None, 0.0, 'no baseline'))
        self.assertEqual(timed['host'], dict(seconds=0.0, excludedStages=['prelaunch', 'admission-probe', 'gate-time'],
                                             waits=[dict(label=gate_time.LAUNCH, seconds=timed['host']['waits'][0]['seconds'])], waitSeconds=timed['host']['waitSeconds']))
        self.assertLess(timed['host']['waitSeconds'], 1)
        self.assertEqual(timed['baseline']['reason'], 'no baseline: 0 landed local gates, 5 needed')
        handed = json.loads((self.inputs / 'gate-time.json').read_text())
        self.assertEqual(set(handed), {'version', 'mode', 'ci', 'hostBefore', 'resumeStartedAt', 'claim', 'waits', 'baseline', 'exempt'})
        attempt = Path(json.loads((self.inputs / 'gate.json').read_text())['attempt'])
        self.assertEqual((handed['version'], handed['claim'], handed['waits']),
                         (2, str(attempt / 'submission-claim.json'), str(attempt / 'gate-waits.tsv')))
        self.assertEqual(json.loads((self.inputs / 'gate.json').read_text())['gateTime'],
                         dict(path=str(self.inputs / 'gate-time.json'), waits=str(attempt / 'gate-waits.tsv')))
        self.assertIn('- **Gate time:** 0 s: CI none (no remote checks) + host 0 s (waits 0 s left out); no baseline: 0 landed local gates, 5 needed; verdict no baseline\n',
                      (self.r / 'fixture-gate-r1-result.md').read_text())

    def test_the_specs_message_body_is_in_the_candidate_commit(self):
        """brief.py copies the item spec's message_body into the gate spec; no --extra is needed."""
        self.spec['message_body'] = 'Keep the fixture boundary.\n\nA second paragraph.'
        self.write_spec()
        code, result, _ = self.run_gate()
        self.assertEqual(code, 0, result and result['stopReason'])
        expected = ('Land the fixture\n\nKeep the fixture boundary.\n\nA second paragraph.\n\n'
                    'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n')
        self.assertEqual((self.inputs / 'commit-message.txt').read_text(), expected)
        config = json.loads((self.inputs / 'gate.json').read_text())
        self.assertEqual(config['preparation']['message'], reference(self.inputs / 'commit-message.txt'))
        self.assertEqual(self.git(self.main, 'log', '-1', '--format=%B', result['identities']['candidate']) + '\n', expected)

    def test_the_operational_summary_reads_the_attempt_evidence(self):
        code, result, _ = self.run_gate()
        self.assertEqual(code, 0, result and result['stopReason'])
        ops, logs = result['ops'], self.orch / 'logs/fixture-20261105-170001-'
        self.assertEqual(ops['codegen'], dict(state='ran', log=str(logs) + 'codegen.log', last='Target: disposable local Convex for code generation.'))
        self.assertEqual(ops['preflight'], dict(state='skipped', log=str(logs) + 'e2e.log', last='e2e: skipped (no app changes)'))
        receipt = self.orch / 'bounded/fixture-r1-20261105-170000-abcdef'
        self.assertEqual(ops['peaks'], dict(realBytes=5023182848, realSource=str(receipt / 'receipt.json'), kernelBytes=5922676736,
                                            kernelSamples=30, kernelSource=str(receipt / 'memory')))
        first = json.loads((self.inputs / 'prelaunch-probes.jsonl').read_text().splitlines()[0])
        terminal = json.loads((self.inputs / 'terminal-probe.json').read_text())
        self.assertEqual(ops['load'], dict(start=dict(loadAverage=first['loadAverage'], at=first['at'], source=str(self.inputs / 'prelaunch-probes.jsonl')),
                                           end=dict(loadAverage=terminal['loadAverage'], at=terminal['at'], source=str(self.inputs / 'terminal-probe.json'))))
        self.assertEqual(ops['timeouts'], dict(fired=[], limits=dict(prelaunchSeconds=300, prelaunchMemorySeconds=300, admissionProbeSeconds=120, instrumentationSeconds=60)))
        self.assertEqual(ops['terminal'], dict(at=terminal['at'], idle=True, locks={name: True for name in ('resource', 'curator', 'curator2', 'land', 'heavy')},
                                               admission='memory: 0/18 GiB reserved; active: none; queued: none', stale=[], foreignActiveUnits=[],
                                               source=str(self.inputs / 'terminal-probe.json')))
        self.assertEqual(ops['wall'], dict(seconds=result['wallSeconds'], startedAt=result['startedAt'], endedAt=result['endedAt']))
        text = (self.r / 'fixture-gate-r1-result.md').read_text()
        for line in ('- **Codegen:** ran (`%scodegen.log`: Target: disposable local Convex for code generation.)' % logs,
                     '- **E2E preflight:** skipped (`%se2e.log`: e2e: skipped (no app changes))' % logs,
                     '- **Peaks:** real 4.68 GiB (5023182848 B, receipt), kernel 5.52 GiB (5922676736 B, 30 samples)',
                     '- **Load:** start `%s` (%s), end `%s` (%s)' % (first['loadAverage'], first['at'], terminal['loadAverage'], terminal['at']),
                     '- **Timeouts:** none fired (limits: prelaunch 300 s, 300 s when only memory or only disk blocks, admission probe 120 s, '
                     'instrumentation 60 s per command)',
                     '- **Terminal state:** idle: all locks free, admission `memory: 0/18 GiB reserved; active: none; queued: none`, '
                     'no foreign heavy unit (%s)' % terminal['at'],
                     '- **Wall time:** %s s (%s to %s)' % (result['wallSeconds'], result['startedAt'], result['endedAt'])):
            self.assertIn(line + '\n', text)

    def test_an_operational_value_without_evidence_is_unavailable(self):
        code, result, _ = self.run_gate(available=17 * GiB)
        self.assert_stopped(code, result, 'Memory guard')
        ops = result['ops']
        for key in ('codegen', 'preflight'):
            self.assertEqual(ops[key], dict(unavailable='no canonical invocation: the gate never submitted'))
        self.assertEqual(ops['peaks'], dict(unavailable='no canonical receipt: the gate never submitted'))
        prelaunch = next(row for row in result['stages'] if row['name'] == 'prelaunch')
        fired = ops['timeouts']['fired']
        self.assertEqual(fired, [dict(stage='prelaunch', deadline='prelaunch', seconds=300, at=fired[0]['at'], reason=result['stopReason'])])
        self.assertTrue(prelaunch['startedAt'] <= fired[0]['at'] <= prelaunch['endedAt'])
        self.assertTrue(ops['terminal']['idle'])
        text = (self.r / 'fixture-gate-r1-result.md').read_text()
        self.assertIn('- **Codegen:** unavailable (no canonical invocation: the gate never submitted)\n', text)
        self.assertIn('- **Peaks:** unavailable (no canonical receipt: the gate never submitted)\n', text)
        self.assertIn('- **Timeouts:** fired: prelaunch: prelaunch deadline (300 s) at %s: Memory guard' % fired[0]['at'], text)
        # Damaged evidence is reported, never filled in.
        module, driver, _ = self.driver()
        driver.inputs = self.r / 'missing-inputs'
        self.assertIn('unavailable', driver.load_window(dict(unavailable='terminal probe failed: x'))['start'])
        self.assertEqual(driver.load_window(dict(unavailable='terminal probe failed: x'))['end'], dict(unavailable='terminal probe failed: x'))

    def test_every_driver_deadline_that_fires_is_reported_with_its_name_and_time(self):
        """Each deadline the driver has: prelaunch (memory guard, or admission or locks busy), the post-preparation
        admission probe, and the per-command instrumentation limit. A stop on any other reason fires none."""
        def fired(result):
            return [(row['stage'], row['deadline'], row['seconds']) for row in result['ops']['timeouts']['fired']]
        def fresh():
            self.tearDown()
            self.setUp()
        cases = [('memory guard', lambda: None, dict(available=17 * GiB), [('prelaunch', 'prelaunch', 300)]),
                 ('admission busy', lambda: (self.orch / 'admission-busy').touch(), {}, [('prelaunch', 'prelaunch', 300)]),
                 ('reap', lambda: self.flag('busy-after-prepare'), {}, [('admission-probe', 'admission-probe', 120)]),
                 ('storage event, no deadline', lambda: self.flag('storage-event-after-prepare'), {}, [])]
        for name, arrange, options, want in cases:
            with self.subTest(name):
                fresh()
                arrange()
                code, result, _ = self.run_gate(**options)
                self.assertEqual(code, 1)
                self.assertEqual(fired(result), want)
                for row in result['ops']['timeouts']['fired']:
                    self.assertEqual(row['reason'], result['stopReason'])
                    stage = next(item for item in result['stages'] if item['name'] == row['stage'])
                    self.assertTrue(stage['startedAt'] <= row['at'] <= stage['endedAt'], 'it fired inside its stage')
                text = (self.r / 'fixture-gate-r1-result.md').read_text()
                self.assertIn('- **Timeouts:** ' + ('fired: %s: %s deadline (%s s) at ' % want[0] if want else 'none fired'), text)
        with self.subTest('instrumentation'):
            fresh()
            self.stub(self.root / 'bin/systemctl', '#!/bin/sh\nsleep 5\n')
            module, driver, _ = self.driver()
            module.COMMAND_TIMEOUT = 0.5
            # The identity stage's scheduled-maintenance read has its own limit and refuses a hung systemctl
            # (gate-monitor.test.py SchedulerReaderTest); this case is the driver's instrumentation deadline.
            with mock.patch.object(gate_core, 'maintenance_timers', return_value=[]):
                self.assertEqual(driver.run(), 1)
            result = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())
            self.assertIn('Instrumentation timed out after 0.5 s: systemctl', result['stopReason'])
            self.assertEqual(fired(result)[0], ('prelaunch', 'instrumentation', 0.5))
            self.assertEqual(fired(result)[-1], ('terminal-probe', 'instrumentation', 0.5), 'the terminal probe times out too')
            terminal = result['ops']['terminal']
            self.assertIn('Instrumentation timed out', terminal['foreignActiveUnits']['unavailable'])
            self.assertIn('Instrumentation timed out', terminal['idle']['unavailable'], 'a read that timed out never reads as idle')

    def test_a_queue_that_ran_its_preflight_and_retry_reports_both(self):
        module, driver, _ = self.driver()
        logs = self.orch / 'logs'
        (logs / 'canonical.log').write_text('logs: logs/q-20261106-010203-*.log\n')
        (logs / 'q-20261106-010203-codegen.log').write_text('Target: disposable local Convex for code generation.\n')
        (logs / 'q-20261106-010203-e2e.log').write_text('E2E preflight passed.\ne2e: exit 1, no Playwright report\n')
        (logs / 'q-20261106-010203-e2e-retry.log').write_text('e2e: passed: 7 journeys passed, 0 failed\ntrailing note\n')
        invocation = dict(id='q', log=str(logs / 'canonical.log'))
        self.assertEqual(driver.stage_run(invocation, 'e2e', None),
                         dict(state='ran', log=str(logs / 'q-20261106-010203-e2e.log'), last='e2e: exit 1, no Playwright report',
                              retry=dict(log=str(logs / 'q-20261106-010203-e2e-retry.log'), last='e2e: passed: 7 journeys passed, 0 failed')))
        (logs / 'q-20261106-010203-codegen.log').unlink()
        self.assertEqual(driver.stage_run(invocation, 'codegen', None), dict(state='not run', reason='no q-20261106-010203-codegen.log: the queue stopped before it'))
        self.assertEqual(driver.stage_run(invocation, 'codegen', dict(mode='light')), dict(state='skipped', reason='light lane'))
        (logs / 'canonical.log').write_text('logs: logs/a-*.log\nlogs: logs/b-*.log\n')
        with self.assertRaisesRegex(ValueError, '2 stage-log sets'):
            driver.stage_run(invocation, 'codegen', None)

    def test_a_conditional_land_lands_with_its_precheck_record(self):
        """Spec reviewed REVIEWED^ and answered LAND once the value is fixed; REVIEWED is the repair."""
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        tree = self.git(self.worker, 'rev-parse', first + '^{tree}')
        (self.r / 'fixture-review-r1/spec.md').write_text('Synthetic review of ' + self.base + '..' + first + ': LAND once value is fixed.\n')
        conditional = self.r / 'fixture-review-r1/spec-conditional.json'
        conditional.write_text(json.dumps(dict(version=1, verdict='land-once-fixed', reviewed=first, paths=['value'], message=False,
                                               check='cat value')))
        self.spec['reviews']['spec']['conditional'] = 'R/fixture-review-r1/spec-conditional.json'
        attestation = self.r / 'conditional.json'
        attestation.write_text(json.dumps(dict(version=1, kind='conditional-land', axes=['spec'], commit=first, head=self.reviewed,
                                               relation='descendant', paths=['value'], message=False,
                                               check=dict(command='cat value', output='1', commit=self.reviewed),
                                               statement='Fixture: the repair is X.', attestedBy='fixture-root')))
        self.spec['conditional_land'] = dict(axes=['spec'], commit=first, tree=tree, paths=['value'], message=False,
                                             attestation='R/conditional.json', attestation_sha256=digest(attestation))
        self.write_spec()
        code, result, _ = self.run_gate()
        self.assertEqual(code, 0, result and result['stopReason'])
        record = json.loads((self.inputs / 'mode-precheck.json').read_text())
        self.assertEqual(record['conditionalLand'], dict(passed=True, scope=[['spec'], first, tree]))
        config = json.loads((self.inputs / 'gate.json').read_text())
        self.assertEqual((config['reviews']['spec']['commit'], config['reviews']['standards']['commit']), (first, self.reviewed))
        self.assertEqual(config['reviews']['spec']['conditional'], reference(conditional))
        self.assertNotIn('conditional', config['reviews']['standards'])

    def test_a_second_run_never_overwrites_an_attempt(self):
        self.assertEqual(self.run_gate()[0], 0)
        before = (self.r / 'fixture-gate-r1-result.json').read_bytes()
        module, driver, _ = self.driver()
        self.assertEqual(driver.run(), 2)
        self.assertEqual((self.r / 'fixture-gate-r1-result.json').read_bytes(), before)
        self.assertEqual(len(self.launches()), 1)

    def test_memory_guard_stops_before_preparation(self):
        code, result, _ = self.run_gate(available=17 * GiB)
        self.assert_stopped(code, result, 'Memory guard')
        self.assertFalse(self.attempt.exists())
        self.assertEqual(self.launches(), [])
        rows = (self.inputs / 'prelaunch-probes.jsonl').read_text().splitlines()
        self.assertEqual(json.loads(rows[0])['thresholdBytes'], 18 * GiB)

    def test_memory_between_the_new_and_the_old_guard_launches(self):
        """20 GiB: above the 18.0 GiB prelaunch sample and the 17.5 GiB guard, below the old 21.5 and 21 GiB."""
        code, result, _ = self.run_gate(available=20 * GiB)
        self.assertEqual((code, result['verdict']), (0, 'landed'), result and result['stopReason'])
        self.assertEqual(len(self.launches()), 1)
        rows = [json.loads(row) for row in (self.inputs / 'prelaunch-probes.jsonl').read_text().splitlines()]
        self.assertEqual([(row['thresholdBytes'], row['consecutive']) for row in rows], [(18 * GiB, 1), (18 * GiB, 2), (18 * GiB, 3)])

    def test_post_preparation_memory_between_the_new_and_the_old_guard_launches(self):
        samples = iter([30 * GiB] * 3 + [int(17.6 * GiB)] * 10)
        code, result, _ = self.run_gate(available=lambda: next(samples))
        self.assertEqual((code, result['verdict']), (0, 'landed'), result and result['stopReason'])
        self.assertEqual(json.loads((self.inputs / 'preclaim.json').read_text())['hostAvailableBytes'], int(17.6 * GiB))

    def test_replace_mode_samples_at_its_own_launch_guard(self):
        """Owner 2026-11-11 (gate-slim-a): 13.0 GiB, and 12.0 GiB with a host-audits receipt (both 14.5 GiB before);
        root's sample stays the guard plus 0.5 GiB."""
        module = self.driver_module()  # the real 30-minute memory-only deadline
        probe = lambda available: dict(locks={}, admission=dict(stdout='memory: 0/18 GiB reserved; active: none; queued: none\n'),
                                       foreignActiveUnits=[], hostAvailableBytes=available, disk=dict(blockers=[], unavailable=[]))
        receipt = dict(receipt='R/host-audits-receipt.json', sha256='c' * 64)
        for extra, launch, sample in (({}, 13, '13.50'), (dict(host_audits_receipt=receipt), 12, '12.50')):
            with self.subTest(receipt=bool(extra)):
                guard = module.launch_minimum_bytes(module.gate_config.mode_config({**self.spec, 'remote': dict(mode='replace'), **extra}))
                self.assertEqual((guard, guard + module.PRECHECK_MARGIN), (launch * GiB, int((launch + 0.5) * GiB)))
                # 0.2 GiB above the sample, and below the old 15.0 GiB one, so it counts.
                self.assertEqual(module.prelaunch_blockers(probe(int((launch + 0.7) * GiB)), guard + module.PRECHECK_MARGIN), [])
                below = probe(int((launch + 0.4) * GiB))
                blockers = module.prelaunch_blockers(below, guard + module.PRECHECK_MARGIN)
                shown = '%.2f' % (launch + 0.4)
                self.assertEqual(blockers, [('memory', 'MemAvailable %s GiB < %s GiB' % (shown, sample))])
                self.assertIsNone(module.prelaunch_stop(module.PRELAUNCH_MEMORY_DEADLINE - 1, blockers, below, guard + module.PRECHECK_MARGIN))
                self.assertEqual(module.prelaunch_stop(module.PRELAUNCH_MEMORY_DEADLINE, blockers, below, guard + module.PRECHECK_MARGIN),
                                 (1800, 'Memory guard: MemAvailable %s GiB is below %s GiB (launch guard plus 0.5 GiB) after 30 minutes; '
                                        'only memory blocked' % (shown, sample)))

    def test_post_preparation_memory_below_the_launch_guard_stops_before_submission(self):
        samples = iter([30 * GiB] * 3 + [17 * GiB] * 10)
        code, result, _ = self.run_gate(available=lambda: next(samples))
        self.assert_stopped(code, result, 'Memory guard: MemAvailable 17.00 GiB is below the 17.5 GiB launch guard after preparation')
        self.assertEqual(self.launches(), [])
        self.assertTrue((self.attempt / 'mapping.json').is_file(), 'a stopped gate keeps its mapping for prepared mode')
        mapping = self.attempt / 'mapping.json'
        self.assertEqual(result['preparedRetry'], dict(candidate=json.loads(mapping.read_text())['SQUASHED'], mapping=str(mapping),
                                                      mapping_sha256=digest(mapping)), 'exactly the prepared field gate_config takes')
        self.assertEqual(result['control'], 'stopped', 'a stopped run leaves no submission authority')

    def test_storage_event_after_the_baseline_stops_before_submission(self):
        self.flag('storage-event-after-prepare')
        code, result, _ = self.run_gate()
        self.assert_stopped(code, result, 'Storage event since the baseline')
        self.assertEqual(self.launches(), [])
        self.assertIsNotNone(result['preparedRetry'])

    def test_admission_not_idle_after_preparation_stops_before_submission(self):
        self.flag('busy-after-prepare')
        code, result, _ = self.run_gate()
        self.assert_stopped(code, result, 'Admission not idle 120 s after preparation')
        self.assertEqual(self.launches(), [])
        self.assertGreaterEqual(len((self.inputs / 'admission-reap.jsonl').read_text().splitlines()), 24)

    def test_admission_not_idle_before_preparation_waits_then_stops(self):
        (self.orch / 'admission-busy').touch()
        code, result, _ = self.run_gate()
        self.assert_stopped(code, result, 'Admission not idle')
        self.assertFalse(self.attempt.exists())

    def test_held_lock_is_not_idle(self):
        import fcntl
        with (self.orch / 'curator2.lock').open('a+') as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            code, result, _ = self.run_gate()
        self.assert_stopped(code, result, 'Admission not idle')
        self.assertFalse(self.attempt.exists())

    def test_moved_base_stops_before_any_input(self):
        (self.main / 'later.txt').write_text('moved\n')
        self.git(self.main, 'add', '.')
        self.git(self.main, 'commit', '-qm', 'later landing')
        code, result, _ = self.run_gate()
        self.assertEqual(code, 1)
        self.assertIn('Moved base', result['stopReason'])
        self.assertFalse(self.inputs.exists())
        self.assertFalse(self.attempt.exists())

    def test_automatic_git_maintenance_left_on_in_main_stops_before_any_input(self):
        """Each setting unset or enabled refuses at the identity stage, naming it and root's two commands."""
        for key, value, shown in (('gc.auto', None, 'gc.auto is unset'), ('gc.auto', '6700', "gc.auto is '6700'"),
                                  ('maintenance.auto', None, 'maintenance.auto is unset'),
                                  ('maintenance.auto', 'true', "maintenance.auto is 'true'")):
            with self.subTest(key=key, value=value):
                saved = self.git(self.main, 'config', '--get', key)
                self.git(self.main, 'config', *(('--unset', key) if value is None else (key, value)))
                try:
                    code, result, driver = self.run_gate()
                finally:
                    self.git(self.main, 'config', key, saved)
                self.assert_maintenance_stop(code, result, driver, '%s: %s' % (os.path.realpath(self.main), shown))

    def test_a_worker_worktree_override_of_automatic_maintenance_stops_before_any_input(self):
        """MAIN's own settings are off; a worker worktree's config.worktree turns maintenance.auto back on (fix r2)."""
        self.git(self.main, 'config', 'extensions.worktreeConfig', 'true')
        self.git(self.worker, 'config', '--worktree', 'maintenance.auto', 'true')
        code, result, driver = self.run_gate()
        self.assert_maintenance_stop(code, result, driver, "%s: maintenance.auto is 'true'" % os.path.realpath(self.worker))
        self.assertNotIn(os.path.realpath(self.main) + ':', result['stopReason'])

    def assert_maintenance_stop(self, code, result, driver, shown):
        self.assertEqual(code, 1)
        self.assertIn("Automatic Git maintenance can run on MAIN's object store: ", result['stopReason'])
        self.assertIn(shown, result['stopReason'])
        self.assertIn('git -C MAIN config gc.auto 0; git -C MAIN config maintenance.auto false', result['stopReason'])
        self.assertFalse(self.inputs.exists())
        self.assertFalse(self.attempt.exists())
        for published in (driver.result_md, driver.result_json, driver.done):
            published.unlink()

    def test_changed_candidate_is_an_identity_mismatch(self):
        (self.worker / 'untracked').write_text('dirty\n')
        code, result, _ = self.run_gate()
        self.assertEqual(code, 1)
        self.assertIn('Identity mismatch: WT', result['stopReason'])
        self.assertFalse(self.inputs.exists())

    def test_driver_other_than_the_committed_one_at_base_is_an_identity_mismatch(self):
        path = self.main / 'scripts/orchestration/gate-run.py'
        path.write_text(path.read_text() + '# a later driver\n')
        self.git(self.main, 'commit', '-qam', 'later driver')
        module, driver, _ = self.driver()
        driver.spec = self.spec
        with self.assertRaisesRegex(module.Stop, 'Identity mismatch: the running driver'):
            driver.check_driver()

    def test_prepared_mapping_mismatch_stops_before_any_wait(self):
        prior = self.r / 'prior-mapping.json'
        prior.write_text(json.dumps(dict(BASE=self.base, REVIEWED=self.reviewed, TREE=self.tree, WT=str(self.worker),
                                         BR='other-branch', ARCHIVE=self.spec['archive'], SQUASHED=self.reviewed)))
        self.spec['prepared'] = dict(candidate=self.reviewed, mapping=str(prior), mapping_sha256=digest(prior))
        self.write_spec()
        code, result, _ = self.run_gate()
        self.assertEqual(code, 1)
        self.assertIn('Prepared mapping mismatch: BR', result['stopReason'])
        self.assertFalse(self.inputs.exists())
        self.spec['prepared']['mapping_sha256'] = '0' * 64
        self.write_spec()
        for name in ('fixture-gate-r1-result.json', 'fixture-gate-r1-result.md'):
            (self.r / name).unlink()
        (self.orch / 'runs/fixture-final-gate-r1.done').unlink()
        code, result, _ = self.run_gate()
        self.assertIn('Prepared mapping mismatch', result['stopReason'])
        self.assertIn('pinned sha256', result['stopReason'])

    def test_refused_mode_proofs_stop_before_any_wait(self):
        cases = [(dict(rebase_proof=dict(oldBase=self.base, accepted=self.reviewed, acceptedTree=self.tree, cli_output='x')), 'needs a moved base'),
                 (dict(rebase_proof=dict(oldBase=self.base, accepted=self.reviewed, acceptedTree=self.tree, cli_output='x',
                                         patchEqual=dict(rule='patch-equal-v1', paths=['value']))), 'needs a moved base'),
                 (dict(remote=dict(manifest='R/missing/manifest.json', sha256='0' * 64, mode='replace')), 'Mode precheck refused'),
                 (dict(conditional_land=dict(axes=['spec'], commit=self.base, tree=self.basetree, paths=['value'], message=False,
                                             attestation='R/missing.json', attestation_sha256='0' * 64)), 'Conditional LAND')]
        for change, message in cases:
            with self.subTest(mode=next(iter(change))):
                self.spec_path.write_text(json.dumps({**self.spec, **change}))
                for path in (self.r / 'fixture-gate-r1-result.json', self.r / 'fixture-gate-r1-result.md', self.orch / 'runs/fixture-final-gate-r1.done'):
                    path.unlink(missing_ok=True)
                code, result, _ = self.run_gate()
                self.assertEqual(code, 1)
                self.assertIn('Mode precheck refused', result['stopReason'])
                self.assertIn(message, result['stopReason'])
                self.assertFalse(self.inputs.exists())

    def test_a_host_audits_receipt_outside_replace_or_unverified_stops_before_any_wait(self):
        receipt = dict(receipt='EP_ORCH/host-audits-receipts/fixture/receipt.json', sha256='0' * 64)
        cases = [(dict(host_audits_receipt=receipt), 'host_audits_receipt needs remote checks in replace mode'),
                 (dict(host_audits_receipt=receipt, remote=dict(manifest='/abs/manifest.json', sha256='b' * 64, mode='compare')),
                  'host_audits_receipt needs remote checks in replace mode'),
                 (dict(host_audits_receipt=receipt, remote=dict(manifest='R/missing/manifest.json', sha256='0' * 64, mode='replace')),
                  'Mode precheck refused')]
        for change, message in cases:
            with self.subTest(message=message, mode=change.get('remote', {}).get('mode')):
                self.spec_path.write_text(json.dumps({**self.spec, **change}))
                for path in (self.r / 'fixture-gate-r1-result.json', self.r / 'fixture-gate-r1-result.md', self.orch / 'runs/fixture-final-gate-r1.done'):
                    path.unlink(missing_ok=True)
                code, result, _ = self.run_gate()
                self.assertEqual(code, 1)
                self.assertIn(message, result['stopReason'])
                self.assertFalse(self.inputs.exists())

    def test_control_stop_before_preparation_stops_without_preparing(self):
        module = self.driver_module()
        code, result, _ = self.run_gate(hook=lambda calls: calls == 1 and module.set_control_state(self.inputs / 'control.json', 'stopped'))
        self.assert_stopped(code, result, 'Execution stopped by control')
        self.assertFalse(self.attempt.exists())

    def test_stop_signal_before_preparation_cancels_without_preparing(self):
        holder = {}
        def hook(calls):
            holder['driver'].cancel_requested = True
        module, driver, clock = self.driver(hook=hook)
        holder['driver'] = driver
        self.assertEqual(driver.run(), 1)
        result = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())
        self.assertIn('Cancelled', result['stopReason'])
        self.assertFalse(self.attempt.exists())

    def test_stopped_control_after_the_claim_goes_to_the_retained_cancel(self):
        self.flag('resume-stopped')
        code, result, _ = self.run_gate()
        self.assertEqual(code, 1)
        self.assertIn('resume exited 1', result['stopReason'])
        self.assertEqual(len(self.launches()), 1)
        self.assertEqual((self.orch / 'cancel.log').read_text(), 'cancel\n', 'a claimed, uncollected attempt goes to the retained cancel')
        self.assertEqual(result['stages'][-1]['name'], 'cancel')

    def test_the_driver_kinds_isolated_interpreter_runs_the_stop_command(self):
        code, result, _ = self.run_gate(available=17 * GiB)
        self.assertEqual(code, 1)
        control = self.inputs / 'control.json'
        value = json.loads(control.read_text())
        value['state'] = 'active'
        control.write_text(json.dumps(value))
        run = subprocess.run([sys.executable, '-I', '-B', str(self.main / 'scripts/orchestration/gate-run.py'), '--stop', str(self.spec_path),
                              '--orch', str(self.orch)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(run.stdout.strip(), 'already finished: stopped', 'a published attempt is reported, not changed')
        self.assertEqual(json.loads(control.read_text())['state'], 'active')

    def test_prelaunch_constants_are_the_operator_rules(self):
        module = self.driver_module()
        self.assertEqual((module.PRELAUNCH_SAMPLES, module.PRELAUNCH_INTERVAL, module.PRELAUNCH_DEADLINE), (3, 30, 5400))
        self.assertEqual((module.PRELAUNCH_MEMORY_DEADLINE, module.PRELAUNCH_REPORT), (1800, 600))
        self.assertEqual((module.REAP_INTERVAL, module.REAP_DEADLINE), (5, 120))

    def test_invalid_spec_refuses_with_usage_exit(self):
        self.spec['remote_checks'] = dict(mode='replace')
        self.write_spec()
        module, driver, _ = self.driver()
        self.assertEqual(driver.run(), 2)
        self.assertFalse(self.inputs.exists())


STAGES = ['identity', 'worktree', 'mode-prechecks', 'prelaunch', 'storage-baseline', 'environment-precheck',
          'prepare', 'runtime', 'admission-probe', 'preclaim', 'resume']


RUNNER = dict(provider='github-actions', repository='EverythingPath/EverythingPath', runId=42437482488, attempt=1, job='remote-checks',
              url='https://github.com/EverythingPath/EverythingPath/actions/runs/42437482488')


def ci_jobs(seconds):
    """One shard job of `seconds` and the assembly, as `gh run view --json jobs` lists them."""
    return [dict(name='remote-shard (2)', status='completed', conclusion='success', startedAt='2026-11-08T02:00:00Z',
                 completedAt='2026-11-08T02:%02d:%02dZ' % divmod(seconds, 60)),
            dict(name='remote-checks', status='completed', conclusion='success', startedAt='2026-11-08T02:00:00Z', completedAt='2026-11-08T02:59:00Z')]


class GateTimeTest(Fixture):
    """A replace gate's own time against five landed replace gates of 600 s CI and 1000 s in all."""

    def setUp(self):
        super().setUp()
        manifest = self.r / 'fixture-manifest.json'
        manifest.write_text(json.dumps(dict(runner=RUNNER)))
        self.spec['remote'] = dict(manifest='R/fixture-manifest.json', sha256=reference(manifest)['sha256'], mode='replace')
        self.write_spec()

    def priors(self, count=5):
        for index in range(count):
            (self.r / ('prior%d-gate-r1-result.json' % index)).write_text(json.dumps(dict(
                verdict='landed', kind='code', label='prior%d-r1' % index, endedAt='2026-11-07T1%d:00:00+00:00' % index,
                suite=dict(source='remote+host-audits'), stages=[],
                gateTime=dict(mode='replace', ci=dict(seconds=600), host=dict(seconds=400, waits=[], waitSeconds=0), total=1000, totalLowerBound=False))))

    def run_gate(self, **options):
        module, driver, clock = self.driver(**options)
        # The manifest's own verification is the mode precheck's and the queue's (tested elsewhere): here the precheck
        # passes and gate.json carries no remoteChecks, so the stub operator's real authorization needs no published run.
        build = module.gate_config.gate_config
        local = lambda spec, *args: build({key: value for key, value in spec.items() if key != 'remote'}, *args)
        with mock.patch.object(module.Driver, 'check_modes', lambda driver: {}), mock.patch.object(module.gate_config, 'gate_config', local):
            code = driver.run()
        result = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())
        return code, result, driver

    def test_a_ci_part_under_the_trigger_lands_and_records_the_baseline(self):
        self.priors()
        self.jobs = ci_jobs(620)
        code, result, _ = self.run_gate()
        self.assertEqual(code, 0, result['stopReason'])
        timed = result['gateTime']
        self.assertEqual((timed['mode'], timed['ci']['seconds'], timed['ci']['job'], timed['total'], timed['percent'], timed['verdict']),
                         ('replace', 620, 'remote-shard (2)', 620.0, -38.0, 'pass'))
        # The fail-fast check is the CI part against the total trigger; against its own median it is information only.
        self.assertEqual(timed['ciCheck'], dict(seconds=620, median=1000, percent=-38.0, trigger=False))
        self.assertEqual(timed['ciInformation'], dict(seconds=620, median=600, percent=3.3, trigger=False))
        self.assertFalse(timed['totalLowerBound'])
        self.assertEqual([gate['label'] for gate in timed['baseline']['gates']], ['prior4-r1', 'prior3-r1', 'prior2-r1', 'prior1-r1', 'prior0-r1'])
        self.assertEqual((timed['baseline']['median'], timed['baseline']['trigger']), (dict(total=1000, ci=600, host=400), 1300))
        self.assertIn('- **Gate time:** 620 s: CI 620 s (remote-shard (2), run 42437482488 attempt 1) + host 0 s (waits 0 s left out); 38.0% under the 1000 s median '
                      'of replace (trigger 1300 s; gates prior4-r1, prior3-r1, prior2-r1, prior1-r1, prior0-r1); '
                      'CI part 3.3% over its own 600 s median (information); verdict pass\n',
                      (self.r / 'fixture-gate-r1-result.md').read_text())

    def test_a_long_launch_and_lock_wait_is_left_out_of_the_host_part(self):
        # Resume takes 1000 s: the unit waited 600 s for its locks and memory, the suite 100 s for heavy.lock.
        self.priors()
        self.jobs = ci_jobs(620)
        self.flag('resume-waited')
        module, driver, clock = self.driver()
        run_child = driver.run_child

        def resumed(name, argv):
            outcome = run_child(name, argv)
            if name == 'resume':
                clock.now += 1000
            return outcome
        driver.run_child = resumed
        build = module.gate_config.gate_config
        local = lambda spec, *args: build({key: value for key, value in spec.items() if key != 'remote'}, *args)
        with mock.patch.object(module.Driver, 'check_modes', lambda driver: {}), mock.patch.object(module.gate_config, 'gate_config', local):
            code = driver.run()
        result = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())
        self.assertEqual(code, 0, result['stopReason'])
        timed = result['gateTime']
        self.assertEqual([row['seconds'] for row in result['stages'] if row['name'] == 'resume'], [1000])
        self.assertEqual([row['label'] for row in timed['host']['waits']], [gate_time.LAUNCH, 'heavy.lock'])
        self.assertAlmostEqual(timed['host']['waitSeconds'], 700, delta=1)
        self.assertAlmostEqual(timed['host']['seconds'], 300, delta=1)
        self.assertAlmostEqual(timed['total'], 920, delta=1)
        self.assertEqual(timed['verdict'], 'pass')
        self.assertRegex((self.r / 'fixture-gate-r1-result.md').read_text(), r'\+ host 30\d s \(waits 70\d s left out\);')

    def test_unrecorded_waits_are_named_in_the_result(self):
        self.priors()
        self.jobs = ci_jobs(620)
        module, driver, clock = self.driver()
        run_child = driver.run_child

        def resumed(name, argv):
            outcome = run_child(name, argv)
            if name == 'resume':
                Path(json.loads((self.inputs / 'gate.json').read_text())['gateTime']['waits']).unlink()
            return outcome
        driver.run_child = resumed
        build = module.gate_config.gate_config
        local = lambda spec, *args: build({key: value for key, value in spec.items() if key != 'remote'}, *args)
        with mock.patch.object(module.Driver, 'check_modes', lambda driver: {}), mock.patch.object(module.gate_config, 'gate_config', local):
            driver.run()
        timed = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())['gateTime']
        self.assertIn('no wait ledger', timed['host']['waits']['unavailable'])
        self.assertIn('host 0 s (waits unavailable: no wait ledger', (self.r / 'fixture-gate-r1-result.md').read_text())

    def test_a_ci_part_over_its_own_median_but_under_the_total_trigger_lands(self):
        self.priors()
        self.jobs = ci_jobs(900)  # 50% over the 600 s CI median, under the 1300 s total trigger
        code, result, _ = self.run_gate()
        self.assertEqual(code, 0, result['stopReason'])
        timed = result['gateTime']
        self.assertEqual((timed['verdict'], timed['ciCheck']['trigger'], timed['ciInformation']['percent']), ('pass', False, 50.0))
        self.assertIn('prelaunch', [row['name'] for row in result['stages']])

    def test_a_ci_part_alone_over_the_total_trigger_stops_before_prelaunch(self):
        self.priors()
        self.jobs = ci_jobs(1400)
        code, result, _ = self.run_gate()
        self.assert_stopped(code, result, 'Gate time refused: gate time (CI part) 1400 s is 40.0% over the 1000 s median of replace')
        self.assertEqual([row['name'] for row in result['stages']][-1], 'gate-time')
        self.assertEqual(self.launches(), [])
        self.assertFalse((self.inputs / 'gate.json').exists())
        self.assertEqual((result['gateTime']['verdict'], result['gateTime']['ciCheck']['trigger']), ('refused', True))

    def test_an_outside_cause_records_the_trigger_and_lands(self):
        self.priors()
        self.jobs = ci_jobs(1400)
        self.spec['gate_time_exempt'] = dict(reason='GitHub incident: shard runners throttled')
        self.write_spec()
        code, result, _ = self.run_gate()
        self.assertEqual(code, 0, result['stopReason'])
        timed = result['gateTime']
        self.assertEqual((timed['verdict'], timed['ciCheck']['trigger'], timed['exempt']),
                         ('exempt', True, dict(reason='GitHub incident: shard runners throttled')))
        self.assertIn('outside cause (root): GitHub incident: shard runners throttled', (self.r / 'fixture-gate-r1-result.md').read_text())
        self.assertEqual(json.loads((self.inputs / 'gate-time.json').read_text())['exempt'], dict(reason='GitHub incident: shard runners throttled'))

    def test_an_unreadable_ci_part_never_refuses_and_the_host_part_is_a_lower_bound(self):
        for priors in (False, True):
            with self.subTest(baseline=priors):
                if priors:
                    self.tearDown(); self.setUp(); self.priors()
                code, result, _ = self.run_gate()  # the fixture reader fails, as gh does in an outage
                self.assertEqual(code, 0, result['stopReason'])
                timed = result['gateTime']
                self.assertEqual(timed['ci'], dict(unavailable='fixture: GitHub is not read'))
                self.assertEqual((timed['total'], timed['totalLowerBound'], timed['ciCheck']), (0.0, True, None))
                self.assertEqual(timed['verdict'], 'pass' if priors else 'no baseline')
                self.assertIn('prelaunch', [row['name'] for row in result['stages']])
                self.assertIn('- **Gate time:** at least 0 s: CI unavailable (fixture: GitHub is not read) + host 0 s (waits 0 s left out); ',
                              (self.r / 'fixture-gate-r1-result.md').read_text())

    def test_the_queues_land_check_refusal_is_the_stop_reason(self):
        self.priors()
        self.jobs = ci_jobs(620)
        self.flag('gate-time-refused')
        code, result, _ = self.run_gate()
        self.assert_stopped(code, result, 'Gate time refused: gate time 2000 s is 100.0% over the 1000 s median of replace')
        self.assertEqual(result['gateTime']['verdict'], 'refused')
        self.assertEqual(result['gateTime']['landCheck'], 'gate-time refused: gate time 2000 s is 100.0% over the 1000 s median of replace')


class StopAuthorityTest(Fixture):
    """A stop signal persists as the stopped control at once; nothing launches after it and a stopped run never lands."""

    def patched_child(self, module, before=None, after=None):
        original = module.Driver.run_child

        def run_child(driver, name, argv):
            if before == name:
                driver.request_stop()
            result = original(driver, name, argv)
            if after == name:
                driver.request_stop()
            return result
        return mock.patch.object(module.Driver, 'run_child', run_child)

    def run_with(self, module, available=30 * GiB):
        clock = FakeTime()
        module.PRELAUNCH_DEADLINE = module.PRELAUNCH_MEMORY_DEADLINE = 300
        driver = module.Driver(self.spec_path, orch=self.orch, main=self.main, sleep=clock.sleep, clock=clock.clock, available=lambda: available)
        code = driver.run()
        return code, json.loads((self.r / 'fixture-gate-r1-result.json').read_text())

    def control(self):
        return json.loads((self.inputs / 'control.json').read_text())['state']

    def test_stop_during_prepare_leaves_no_submission_authority(self):
        module = self.driver_module()
        with self.patched_child(module, after='prepare'):
            code, result = self.run_with(module)
        self.assertEqual((code, result['verdict'], result['control']), (1, 'stopped', 'stopped'))
        self.assertEqual(self.control(), 'stopped')
        self.assertIn('Cancelled', result['stopReason'])
        self.assertEqual(self.launches(), [])
        self.assertIsNotNone(result['preparedRetry'])

    def test_stop_just_before_a_short_resume_launches_nothing(self):
        module = self.driver_module()
        with self.patched_child(module, before='resume'):
            code, result = self.run_with(module)
        self.assertEqual((code, result['verdict']), (1, 'stopped'))
        self.assertFalse((self.inputs / 'resume-output.log').exists(), 'resume never started')
        self.assertFalse((self.attempt / 'submission-claim.json').exists())
        self.assertEqual(self.launches(), [])

    def test_stop_while_a_short_resume_starts_is_honoured_by_the_operator(self):
        import threading
        self.flag('resume-slow')
        module = self.driver_module()
        original = module.Driver.run_child

        def run_child(driver, name, argv):
            if name == 'resume':
                threading.Timer(0.3, driver.request_stop).start()
            return original(driver, name, argv)
        with mock.patch.object(module.Driver, 'run_child', run_child):
            code, result = self.run_with(module)
        self.assertEqual((code, result['verdict']), (1, 'stopped'))
        self.assertFalse((self.attempt / 'submission-claim.json').exists(), 'the stopped control refused submission')
        self.assertEqual(self.launches(), [])

    def test_a_stop_that_arrives_after_landing_never_reports_landed(self):
        module = self.driver_module()
        with self.patched_child(module, after='resume'):
            code, result = self.run_with(module)
        self.assertEqual((code, result['verdict'], result['passed']), (1, 'stopped', False))
        self.assertTrue(result['identities']['mainAtCandidate'], 'the record says what Git shows')
        self.assertIn('Cancelled', result['stopReason'])

    def test_a_floor_stop_after_landing_reports_stopped_with_main_at_the_candidate(self):
        """The in-run floor stop can fire after land.sh moved MAIN (gate-monitor.test.py
        test_the_floor_stop_still_fires_on_the_row_that_first_sees_the_receipt). The result never says landed, and
        both records say what Git shows: MAIN is at the candidate."""
        self.flag('floor-stop-after-land')
        module = self.driver_module()
        code, result = self.run_with(module)
        self.assertEqual((code, result['verdict'], result['passed']), (1, 'stopped', False))
        self.assertIn('resume exited 1', result['stopReason'])
        candidate = result['identities']['candidate']
        self.assertEqual(self.git(self.main, 'rev-parse', 'HEAD'), candidate)
        self.assertEqual((result['identities']['mainHead'], result['identities']['mainAtCandidate']), (candidate, True))
        self.assertEqual(result['operatorResult']['failedChecks'], ['noStoppedAttempt'])
        text = (self.r / 'fixture-gate-r1-result.md').read_text()
        self.assertIn('- **Verdict:** STOPPED (exit 1)\n', text)
        self.assertIn('- **MAIN:** at the candidate `%s`: the integration branch moved before the stop\n' % candidate, text)
        self.assertNotIn('LANDED', text)
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').read_text().startswith('stopped '))
        # MAIN already holds the candidate, so the result offers no retry: a retry would gate it again. The JSON
        # keeps the attempt's mapping, which gate_config.py retry checks against it.
        self.assertIsNotNone(result['preparedRetry'])
        self.assertIn('- **Next attempt:** none: MAIN moved to the candidate `%s` before the stop, so the gate needs root '
                      'recovery, not a retry\n' % candidate, text)
        self.assertNotIn('`prepared` with', text)
        self.assertNotIn('a retry squashes', text)

    def test_a_stopped_gate_before_submission_says_main_did_not_move(self):
        code, result, _ = self.run_gate(available=17 * GiB)
        self.assertEqual((code, result['identities']['mainAtCandidate']), (1, False))
        self.assertIn('- **MAIN:** not at the candidate: `%s` (BASE)\n' % self.base, (self.r / 'fixture-gate-r1-result.md').read_text())

    def assert_finalization_stop(self, code, result):
        self.assertEqual((code, result['verdict'], result['passed']), (1, 'stopped', False))
        self.assertEqual(result['control'], self.control(), 'the recorded control is the actual control')
        self.assertEqual(self.control(), 'stopped')
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').read_text().startswith('stopped '))
        self.assertIn('Cancelled', result['stopReason'])

    def test_a_stop_at_the_submission_read_in_finish_reports_stopped(self):
        module = self.driver_module()
        original = module.Driver.load

        def load(driver, path):
            if Path(path).name == 'submission.json':
                driver.request_stop()
            return original(driver, path)
        with mock.patch.object(module.Driver, 'load', load):
            self.assert_finalization_stop(*self.run_with(module))

    def test_a_stop_while_finish_reads_the_suite_reports_stopped(self):
        module = self.driver_module()
        original = module.Driver.suite

        def suite(driver):
            driver.request_stop()
            return original(driver)
        with mock.patch.object(module.Driver, 'suite', suite):
            self.assert_finalization_stop(*self.run_with(module))

    def test_a_stop_anywhere_before_publication_reports_stopped(self):
        module = self.driver_module()
        original = module.Driver.receipt

        def receipt(driver, invocation):
            driver.request_stop()
            return original(driver, invocation)
        with mock.patch.object(module.Driver, 'receipt', receipt):
            self.assert_finalization_stop(*self.run_with(module))

    def stop_process(self):
        return subprocess.Popen([sys.executable, '-I', '-B', str(self.main / 'scripts/orchestration/gate-run.py'), '--stop',
                                 str(self.spec_path), '--orch', str(self.orch)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    def test_a_file_stop_that_wins_the_publication_lock_reports_stopped(self):
        module = self.driver_module()
        original = module.Driver.suite
        stops = []

        def suite(driver):  # just before the boundary: the separate --stop process takes the lock first
            process = self.stop_process()
            stops.append(process.communicate(timeout=30))
            self.assertEqual(process.returncode, 0, stops[-1][1])
            return original(driver)
        with mock.patch.object(module.Driver, 'suite', suite):
            code, result = self.run_with(module)
        self.assertEqual((code, result['verdict'], result['passed']), (1, 'stopped', False))
        self.assertEqual((result['control'], self.control()), ('stopped', 'stopped'))
        self.assertIn('"state": "stopped"', stops[0][0])
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').read_text().startswith('stopped '))

    def test_a_file_stop_that_loses_the_publication_lock_reports_already_finished(self):
        module = self.driver_module()
        original = module.Driver.publish
        processes = []

        def publish(driver, value):  # inside the boundary, with the lock held: the --stop process must wait
            import time
            processes.append(self.stop_process())
            time.sleep(1)
            self.assertIsNone(processes[0].poll(), '--stop waits on the publication lock')
            return original(driver, value)
        with mock.patch.object(module.Driver, 'publish', publish):
            code, result = self.run_with(module)
        out, err = processes[0].communicate(timeout=30)
        self.assertEqual((processes[0].returncode, out.strip()), (0, 'already finished: landed'), err)
        self.assertEqual((code, result['verdict'], result['control'], self.control()), (0, 'landed', 'active', 'active'))

    def test_a_stop_after_publication_changes_nothing(self):
        module = self.driver_module()
        clock = FakeTime()
        driver = module.Driver(self.spec_path, orch=self.orch, main=self.main, sleep=clock.sleep, clock=clock.clock, available=lambda: 30 * GiB)
        self.assertEqual(driver.run(), 0)
        driver.request_stop()
        result = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())
        self.assertEqual((result['verdict'], result['control'], self.control()), ('landed', 'active', 'active'))

    def test_a_stop_at_every_boundary_starts_nothing_after_it(self):
        for boundary in STAGES:
            with self.subTest(boundary=boundary):
                self.tearDown()
                self.setUp()
                module = self.driver_module()
                original = module.Driver.stage

                def stage(driver, name, operation, boundary=boundary):
                    if name == boundary:
                        driver.request_stop()
                    return original(driver, name, operation)
                with mock.patch.object(module.Driver, 'stage', stage):
                    code, result = self.run_with(module)
                self.assertEqual((code, result['verdict']), (1, 'stopped'))
                self.assertIn('Cancelled', result['stopReason'])
                self.assertEqual(self.launches(), [])
                names = [row['name'] for row in result['stages']]
                self.assertEqual(names[-1], boundary)
                self.assertEqual(result['stages'][-1]['outcome'], 'stopped')
                if (self.inputs / 'control.json').is_file():
                    self.assertEqual(self.control(), 'stopped')
                self.assertEqual(self.attempt.exists(), STAGES.index(boundary) > STAGES.index('prepare'))


class TerminalProbeTest(Fixture):
    """The terminal probe over the real admission.sh: stale entries, a held lock and a missing lock file stay
    exactly as they were; the prelaunch and reap probe keeps its sweep."""
    def setUp(self):
        super().setUp()
        scripts = self.main / 'scripts/orchestration'
        for name in ('admission.sh', 'memory-reservations.tsv'):
            shutil.copyfile(HERE / name, scripts / name)
        (scripts / 'admission.sh').chmod(0o755)
        self.entries = self.orch / 'admission/entries'
        self.entries.mkdir(parents=True)
        for index, (name, state) in enumerate((('t-ghost', 'active'), ('t-orphan', 'queued'))):
            (self.entries / (name + '.entry')).write_text('id=%s\nclass=gate-2\nmib=11776\nprio=0\nseq=%d\nstate=%s\npid=999999\nsince=1793945323\n'
                                                          'locks=\nwhat=crashed job\n' % (name, 7 + index, state))
        (self.entries / 't-ghost.held').write_text('')  # t-orphan has no held file at all
        (self.orch / 'admission/events.log').write_text('2026-11-06T06:00:00Z admitted t-ghost gate-2 11.5\n')
        for name in ('resource', 'curator', 'land', 'heavy'):  # curator2.lock is missing
            (self.orch / (name + '.lock')).write_text('')

    def snapshot(self):
        """Every path under ORCH: mode, size, mtime and content hash, read as far as permissions allow (a
        failure case may make a directory unsearchable or a file unreadable while it runs)."""
        out = {}
        def visit(path):
            key = str(path.relative_to(self.orch))
            try:
                info = os.lstat(path)
            except OSError as exc:
                out[key] = 'unstattable: ' + exc.strerror
                return
            out[key] = (info.st_mode, info.st_size, info.st_mtime_ns)
            if path.is_dir() and not path.is_symlink():
                try:
                    children = sorted(os.listdir(path))
                except OSError as exc:
                    out[key] += ('unlistable: ' + exc.strerror,)
                    return
                for child in children:
                    visit(path / child)
            else:
                try:
                    out[key] += (digest(path),)
                except (OSError, RuntimeError) as exc:
                    out[key] += ('unreadable',)
        visit(self.orch)
        return out

    def driver_with_environment(self):
        module, driver, _ = self.driver()
        driver.env, driver.inputs = driver.canonical_environment(), self.r / 'no-inputs-yet'
        return module, driver

    def test_the_terminal_probe_changes_nothing(self):
        import fcntl
        module, driver = self.driver_with_environment()
        with (self.orch / 'land.lock').open('r') as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            before = self.snapshot()
            probe = driver.terminal_probe()
            self.assertEqual(self.snapshot(), before, 'no file, byte, mtime or event changed, and no lock file was created')
        self.assertFalse((self.orch / 'curator2.lock').exists())
        self.assertEqual([row['argv'][1:2] for row in probe['commands']], [['held'], ['peek'], ['--user']])
        state = module.terminal_state(probe)
        self.assertEqual(state['locks'], dict(resource=True, curator=True, curator2=True, land=False, heavy=True))
        self.assertEqual((state['admission'], state['stale'], state['idle']),
                         ('memory: 0/18 GiB reserved; active: none; queued: none', ['t-ghost', 't-orphan'], False))
        probe = driver.terminal_probe()
        self.assertTrue(module.terminal_state(probe)['idle'], 'idle once the lock is free; stale entries hold nothing')
        self.assertTrue((self.entries / 't-ghost.entry').is_file())

    def live_reservation(self):
        """A live 11.5 GiB gate reservation (its .held file flocked by this test) and a held land.lock: with
        every read intact the terminal state is busy, so a read failure that fell open would show as idle."""
        import contextlib, fcntl
        stack = contextlib.ExitStack()
        (self.entries / 't-live.entry').write_text('id=t-live\nclass=gate-2\nmib=11776\nprio=0\nseq=9\nstate=active\npid=4242\n'
                                                  'since=1793945323\nlocks=\nwhat=live gate\n')
        (self.entries / 't-queued.entry').write_text('id=t-queued\nclass=gate-2\nmib=11776\nprio=0\nseq=10\nstate=queued\npid=4243\n'
                                                    'since=1793945323\nlocks=\nwhat=queued gate\n')
        for path in (self.entries / 't-live.held', self.entries / 't-queued.held', self.orch / 'land.lock'):
            stream = stack.enter_context(path.open('a'))
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return stack

    def failing(self, tool, silent=False):
        """A directory whose `tool` fails (or, silent, exits 0 printing nothing), for the front of the driver's PATH."""
        shim = self.root / ('shim-%s-%s' % (tool, 'silent' if silent else 'fails'))
        shim.mkdir()
        self.stub(shim / tool, '#!/bin/sh\nexit 0\n' if silent else '#!/bin/sh\necho "%s: injected failure" >&2\nexit 2\n' % tool)
        return shim

    def test_every_read_that_fails_is_unavailable_never_free_or_idle(self):
        """Each read the terminal probe makes, failing in turn: the stat, findmnt and /proc/locks reads behind
        `held` and `peek`, the ledger directory, an entry, the memory table, systemctl, /proc/meminfo and
        /proc/loadavg. Each failure is unavailable with its reason, idle is unavailable, nothing changes."""
        module, driver = self.driver_with_environment()
        proc_locks = self.root / 'unreadable-proc-locks'
        proc_locks.write_text('')
        proc_locks.chmod(0)
        entry = self.entries / 't-live.entry'
        table = self.main / 'scripts/orchestration/memory-reservations.tsv'
        def environment(**values):
            return lambda: driver.env.update(values)
        def chmod(path, mode):
            return lambda: path.chmod(mode)
        saved = {}
        def malformed():
            saved['text'] = entry.read_text()
            entry.write_text(saved['text'].replace('mib=11776', 'mib=abc'))
        cases = [  # (name, arrange, restore, the parts that must be unavailable)
            ('stat fails', environment(PATH=str(self.failing('stat')) + ':' + driver.env['PATH']), None, {'locks', 'admission'}),
            ('findmnt fails', environment(PATH=str(self.failing('findmnt')) + ':' + driver.env['PATH']), None, {'locks', 'admission'}),
            # Every stage of held and peek: awk (lock states, entry checks, the entry reader, sizes) and sort (the entry reader),
            # failing or printing nothing; sed no longer runs in either, so its failure changes nothing.
            ('awk fails', environment(PATH=str(self.failing('awk')) + ':' + driver.env['PATH']), None, {'locks', 'admission'}),
            ('awk prints nothing', environment(PATH=str(self.failing('awk', silent=True)) + ':' + driver.env['PATH']), None, {'locks', 'admission'}),
            ('sort fails', environment(PATH=str(self.failing('sort')) + ':' + driver.env['PATH']), None, {'admission'}),
            ('sort prints nothing', environment(PATH=str(self.failing('sort', silent=True)) + ':' + driver.env['PATH']), None, {'admission'}),
            ('sed fails', environment(PATH=str(self.failing('sed')) + ':' + driver.env['PATH']), None, set()),
            ('/proc/locks unreadable', environment(ADMISSION_PROC_LOCKS=str(proc_locks)), None, {'locks', 'admission'}),
            ('/proc/locks missing', environment(ADMISSION_PROC_LOCKS=str(self.root / 'no-proc-locks')), None, {'locks', 'admission'}),
            ('lock directory unsearchable', chmod(self.orch, 0o600), chmod(self.orch, 0o755), {'locks', 'admission'}),
            ('state directory missing', lambda: (self.orch / 'admission').rename(self.root / 'admission-away'),
             lambda: (self.root / 'admission-away').rename(self.orch / 'admission'), {'admission'}),
            ('ledger directory unreadable', chmod(self.entries, 0), chmod(self.entries, 0o755), {'admission'}),
            ('entry unreadable', chmod(entry, 0), chmod(entry, 0o644), {'admission'}),
            ('entry malformed', malformed, lambda: entry.write_text(saved['text']), {'admission'}),
            ('memory table missing', lambda: table.rename(self.root / 'table-away'), lambda: (self.root / 'table-away').rename(table), {'admission'}),
            ('systemctl fails', lambda: self.stub(self.root / 'bin/systemctl', '#!/bin/sh\necho down >&2\nexit 1\n'),
             lambda: self.stub(self.root / 'bin/systemctl', '#!/bin/sh\nexit 0\n'), {'foreignActiveUnits'}),
            ('/proc/meminfo unreadable', lambda: setattr(driver, 'available', lambda: Path('/proc/no-meminfo').read_text()),
             lambda: setattr(driver, 'available', lambda: 30 * GiB), {'hostAvailableBytes'}),
            ('/proc/loadavg unreadable', lambda: setattr(module, 'LOADAVG', Path('/proc/no-loadavg')),
             lambda: setattr(module, 'LOADAVG', Path('/proc/loadavg')), {'loadAverage'})]
        clean_env = dict(driver.env)
        with self.live_reservation():
            whole = module.terminal_state(driver.terminal_probe())
            self.assertEqual((whole['idle'], whole['locks']['land'], whole['admission'][:28]), (False, False, 'memory: 11.5/18 GiB reserved'))
            self.assertIn('queued: t-queued (gate-2 11.5G, ', whole['admission'])
            for name, arrange, restore, parts in cases:
                with self.subTest(name):
                    driver.env = dict(clean_env)
                    arrange()
                    try:
                        before = self.snapshot()
                        probe = driver.terminal_probe()
                        after = self.snapshot()
                    finally:
                        if restore:
                            restore()
                    self.assertEqual(after, before, 'nothing changed on the failure path')
                    state = module.terminal_state(probe)
                    failed = {key for key in ('admission', 'foreignActiveUnits') if isinstance(state[key], dict)}
                    failed |= {'locks'} if any(isinstance(value, dict) for value in state['locks'].values()) else set()
                    failed |= {key for key in ('hostAvailableBytes', 'loadAverage') if isinstance(probe[key], dict)}
                    self.assertEqual(failed, parts)
                    text = module.terminal_text(state)
                    if parts & {'locks', 'admission', 'foreignActiveUnits'}:  # the reads idle rests on
                        self.assertIsInstance(state['idle'], dict, 'idle is unavailable, never true or false, when a read failed')
                        self.assertTrue(state['idle']['unavailable'])
                        self.assertIn('idle unavailable (', text)
                    else:  # memory and load are reported, not judged: idle stands, their own value is unavailable
                        self.assertIs(state['idle'], False)
                        if 'loadAverage' in parts:
                            self.assertEqual(driver.load_window(probe)['end'], probe['loadAverage'], 'the end load prints as unavailable')
                    if 'locks' in parts:
                        for name, value in state['locks'].items():
                            if name != 'curator2':  # curator2.lock does not exist: stat's ENOENT reads it as missing, unless stat failed
                                self.assertIsInstance(value, dict, name + ' read free on a failed read')
                        self.assertNotIn('all locks free', text)
                    if 'admission' in parts:
                        self.assertEqual(state['stale'], state['admission'], 'no stale list from a failed peek')
                        self.assertIn('admission unavailable (', text)
            driver.env = dict(clean_env)
            self.assertEqual(module.terminal_state(driver.terminal_probe())['idle'], False, 'every read restored')

    def test_the_prelaunch_probe_still_sweeps_stale_entries(self):
        module, driver = self.driver_with_environment()
        probe = driver.probe()
        self.assertTrue(driver.idle(probe))
        self.assertEqual(sorted(path.name for path in self.entries.iterdir()), [])
        self.assertEqual((self.orch / 'admission/events.log').read_text().count(' ended '), 2)


class AdmissionIntentTest(Fixture):
    """The driver's admission intent over the real admission.sh (admission.sh intent): registered before the
    prelaunch's first lock probe, ahead of every new capped.sh command, ended when the gate unit claims its locks
    or the driver stops."""
    real_admission = True

    def setUp(self):
        super().setUp()
        for name in ('resource', 'curator', 'curator2', 'land', 'heavy'):
            (self.orch / (name + '.lock')).write_text('')
        self.entries, self.events = self.orch / 'admission/entries', self.orch / 'admission/events.log'
        self.capped = []

    def tearDown(self):
        for process in self.capped:
            if process.poll() is None:
                process.kill()
            process.wait()
        super().tearDown()

    def entry(self, name):
        path = self.entries / (name + '.entry')
        return dict(line.split('=', 1) for line in path.read_text().splitlines()) if path.is_file() else None

    def event_lines(self):
        return self.events.read_text().splitlines() if self.events.is_file() else []

    def intent_id(self):
        return json.loads((self.inputs / 'admission-intent.json').read_text())['id']

    def capped_command(self, name):
        """A capped.sh-style command (normal priority) through the real admission.sh: it reserves, then writes <name>.ran."""
        process = subprocess.Popen([str(self.main / 'scripts/orchestration/admission.sh'), 'run', name, 'curator-test', 'normal',
                                    'sh', '-c', 'echo ran > "$0"', str(self.orch / (name + '.ran'))],
                                   env={**os.environ, 'BOUNDED_STATE_DIR': str(self.orch), 'ADMISSION_INTERVAL': '0.1'},
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.capped.append(process)
        return process

    def until(self, predicate, seconds=10):
        import time
        for _ in range(int(seconds * 10)):
            if predicate():
                return True
            time.sleep(0.1)
        return False

    def test_the_prelaunch_registers_its_intent_before_its_first_lock_probe(self):
        module, driver, _ = self.driver()
        seen, probe = [], driver.try_locks
        def first_probe():
            if not seen:
                seen.append({path.name: path.read_text() for path in self.entries.glob('*.entry')} if self.entries.is_dir() else {})
            return probe()
        driver.try_locks = first_probe
        code = driver.run()
        self.assertEqual(code, 0, (self.r / 'fixture-gate-r1-result.md').read_text())
        ident = self.intent_id()
        self.assertEqual(ident, 'driver-fixture-r1-%d' % os.getpid())
        self.assertEqual(list(seen[0]), [ident + '.entry'], 'the intent is in the ledger at the first lock probe')
        entry = dict(line.split('=', 1) for line in seen[0][ident + '.entry'].splitlines())
        self.assertEqual((entry['state'], entry['prio'], entry['class'], entry['mib'], entry['locks']),
                         ('pending', '0', 'gate-2', '0', 'resource,curator,curator2,land,heavy'))
        rows = [json.loads(line) for line in (self.inputs / 'prelaunch-probes.jsonl').read_text().splitlines()]
        self.assertTrue(all(row['admission']['argv'][-3:] == ['status', '--for', ident] for row in rows))
        self.assertEqual([row['consecutive'] for row in rows], [1, 2, 3])
        names = [line.split()[1] for line in self.event_lines() if ident in line]
        self.assertEqual(names, ['intent', 'claiming', 'dropped'])
        dropped = next(line for line in self.event_lines() if ' dropped ' + ident in line)
        self.assertRegex(dropped, r' dropped %s gate-2 0 (the gate unit fixture-r1-20261105-170000-abcdef ended|resume ended)$' % ident)
        self.assertEqual(sorted(self.entries.glob('*.entry')), [], 'nothing is left in the ledger')

    def test_the_gates_lock_probe_takes_no_lock_so_admission_admits_nothing_during_it(self):
        """Spec r1 #2: a probe that took the curator locks made admission read them as a worker's slot. Paused in
        the middle of the first prelaunch probe's lock read, a new slotless capped command stays queued and every
        lock is free to anyone else."""
        import fcntl
        import time
        module, driver, _ = self.driver()
        seen, real = [], driver.command
        def paused(argv, *args, **options):
            if len(argv) > 1 and str(argv[1]) == 'held' and not seen:
                self.capped_command('cap-p')
                queued = self.until(lambda: (self.entry('cap-p') or {}).get('state') == 'queued')
                time.sleep(1.5)  # many admission passes (ADMISSION_INTERVAL 0.1 s)
                free = []
                for name in module.LOCKS:
                    with (self.orch / (name + '.lock')).open('a+') as stream:
                        try:
                            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
                            free.append(name)
                        except BlockingIOError:
                            pass
                seen.append(dict(queued=queued, state=(self.entry('cap-p') or {}).get('state'), ran=(self.orch / 'cap-p.ran').is_file(), free=free))
            return real(argv, *args, **options)
        driver.command = paused
        code = driver.run()
        self.assertEqual(code, 0, (self.r / 'fixture-gate-r1-result.md').read_text())
        self.assertEqual(seen, [dict(queued=True, state='queued', ran=False, free=list(module.LOCKS))])
        self.assertTrue(self.until(lambda: (self.orch / 'cap-p.ran').is_file()), 'it runs once the intent ends')

    def test_a_capped_command_started_in_prelaunch_waits_until_the_gate_unit_claims(self):
        def start_capped(calls):
            if calls == 1:  # the prelaunch's first wait: the intent is registered
                self.capped_command('cap-x')
                self.assertTrue(self.until(lambda: (self.entry('cap-x') or {}).get('state') == 'queued'))
        module, driver, clock = self.driver(hook=start_capped)
        code = driver.run()
        self.assertEqual(code, 0, (self.r / 'fixture-gate-r1-result.md').read_text())
        ident = self.intent_id()
        rows = [json.loads(line) for line in (self.inputs / 'prelaunch-probes.jsonl').read_text().splitlines()]
        self.assertEqual([row['consecutive'] for row in rows], [1, 2, 3], 'a command waiting behind the intent never blocks the prelaunch')
        self.assertRegex(rows[-1]['admission']['stdout'], r'; queued: none; behind %s: cap-x \(curator-test ' % ident)
        self.assertTrue(self.until(lambda: (self.orch / 'cap-x.ran').is_file()), 'once the intent ends the command runs')
        order = [line.split()[1] for line in self.event_lines() if ' cap-x ' in line or ' %s ' % ident in line]
        self.assertEqual(order[:5], ['intent', 'queued', 'claiming', 'dropped', 'admitted'])
        self.assertIn(' queued cap-x curator-test %s behind %s' % (driver.command([self.main / 'scripts/orchestration/admission.sh', 'gib', 'curator-test'])['stdout'].strip(), ident),
                      self.events.read_text())

    def test_the_intent_ends_when_the_prelaunch_stops(self):
        import fcntl
        with (self.orch / 'curator2.lock').open('a+') as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            code, result, _ = self.run_gate()
        self.assert_stopped(code, result, 'Admission not idle')
        ident = self.intent_id()
        dropped = [line for line in self.event_lines() if ' dropped ' + ident in line]
        self.assertEqual(len(dropped), 1)
        self.assertIn(' the driver stopped: Admission not idle: prelaunch blocked', dropped[0])
        self.assertEqual(sorted(self.entries.glob('*.entry')), [])
        self.assertNotIn(ident, json.dumps(result), 'the terminal probe ran after the intent ended')

    def test_a_stale_intent_whose_process_is_gone_is_swept_and_the_prelaunch_goes_on(self):
        def kill_intent(calls):
            if calls == 1:
                driver.intent['process'].kill()
                driver.intent['process'].wait()
        module, driver, clock = self.driver(hook=kill_intent)
        code = driver.run()
        self.assertEqual(code, 0, (self.r / 'fixture-gate-r1-result.md').read_text())
        ident = self.intent_id()
        self.assertIn(' ended %s gate-2 0 no process holds it' % ident, self.events.read_text())
        rows = [json.loads(line) for line in (self.inputs / 'prelaunch-probes.jsonl').read_text().splitlines()]
        self.assertEqual(rows[-1]['admission']['argv'][-1], 'status', 'with its intent gone the driver reads the plain line')

    def test_the_gate_unit_claims_once_its_entry_is_queued_or_active_or_it_ended(self):
        module, driver, _ = self.driver()
        driver.attempt = self.attempt
        self.assertIsNone(driver.unit_claimed(), 'no submission yet')
        self.attempt.mkdir()
        create_json(self.attempt / 'submission.json', dict(id='fixture-unit'))
        self.assertIsNone(driver.unit_claimed(), 'no entry yet')
        self.entries.mkdir(parents=True)
        for state, claimed in (('pending', False), ('queued', True), ('active', True)):
            (self.entries / 'fixture-unit.entry').write_text('id=fixture-unit\nstate=%s\n' % state)
            self.assertEqual(driver.unit_claimed() == 'the gate unit fixture-unit claimed its locks', claimed, state)
        (self.entries / 'fixture-unit.entry').unlink()
        (self.orch / 'bounded/fixture-unit').mkdir(parents=True)
        (self.orch / 'bounded/fixture-unit/receipt.json').write_text('{}')
        self.assertEqual(driver.unit_claimed(), 'the gate unit fixture-unit ended')


class AdmissionIntentStubTest(Fixture):
    def test_the_intent_reaches_the_gate_operator_and_ends_before_the_terminal_probe(self):
        code, result, driver = self.run_gate()
        self.assertEqual(code, 0)
        calls = (self.orch / 'admission-calls.log').read_text().splitlines()
        ident = 'driver-fixture-r1-%d' % os.getpid()
        self.assertEqual(calls[0].split()[:5], ['intent', ident, 'gate-2', str(driver_deadline(self) + 30 * 60), 'gate-run'])
        self.assertEqual(calls[0].split()[-5:], ['resource', 'curator', 'curator2', 'land', 'heavy'])
        self.assertEqual((calls[1].split()[0], calls[2]), ('held', 'status --for ' + ident), 'registered before the first probe')
        self.assertEqual(driver.env['GATE_ADMISSION_INTENT'], ident)
        self.assertTrue(driver.intent['ended'])
        self.assertEqual(calls[-1], 'peek')

    def test_every_probe_reads_the_locks_without_opening_them(self):
        """The class behind spec r1 #2: every probe the driver takes before the gate unit holds its locks (prelaunch,
        the post-preparation admission probe, preclaim) reads the five locks from /proc/locks (`admission.sh held`,
        as the terminal probe does); none opens or takes a lock file, so none can pass for a worker's slot."""
        code, result, driver = self.run_gate()
        self.assertEqual(code, 0)
        calls = (self.orch / 'admission-calls.log').read_text().splitlines()
        probes = (len((self.inputs / 'prelaunch-probes.jsonl').read_text().splitlines())
                  + len((self.inputs / 'admission-reap.jsonl').read_text().splitlines()) + 1)  # + preclaim
        self.assertEqual(len([call for call in calls if call.startswith('held ')]), probes)
        self.assertEqual(sorted(path.name for path in self.orch.glob('*.lock')), [], 'no probe opened (and so created) a lock file')


class AdmissionIntentRefusedTest(Fixture):
    intent_case = 'intent) echo refused >&2; exit 64;;'

    def test_a_failed_registration_never_stops_the_gate(self):
        code, result, driver = self.run_gate()
        self.assertEqual(code, 0)
        self.assertEqual(json.loads((self.inputs / 'admission-intent.json').read_text())['registered'], False)
        self.assertNotIn('GATE_ADMISSION_INTENT', driver.env)
        self.assertIn('refused', (self.inputs / 'admission-intent.log').read_text())


def driver_deadline(fixture):
    """The prelaunch deadline the fixtures' driver runs with (Fixture.driver)."""
    return 300


class SuiteCountsTest(Fixture):
    def report(self, name, total, passed, pending=0, files=2):
        """A Vitest JSON report with `files` test files and 3 suites: nested describe blocks count as suites, never as files."""
        path = self.r / name
        path.write_text(json.dumps(dict(success=True, numTotalTests=total, numPassedTests=passed, numFailedTests=0, numPendingTests=pending,
                                        numTodoTests=0, numTotalTestSuites=3, numPassedTestSuites=3, numFailedTestSuites=0,
                                        testResults=[dict(name='/gate/f%d.test.ts' % index, status='passed') for index in range(files)])))
        return path

    def suite(self, config, remote_report=None):
        module, driver, _ = self.driver()
        driver.attempt, driver.config_path = self.attempt, self.r / 'gate.json'
        driver.config_path.write_text(json.dumps(config))
        with mock.patch.object(module.Driver, 'remote_report', lambda driver, remote: remote_report):
            return module, driver.suite()

    def test_replace_reports_the_remote_suite_and_the_host_audits(self):
        remote = self.report('remote-full.json', 11521, 11519, pending=2)
        audits = self.report('host-audits-report.json', 2, 2)
        (self.attempt / 'remote-evidence').mkdir(parents=True)
        (self.attempt / 'remote-evidence/host-audits.json').write_text(json.dumps(dict(exitCode=0, report=reference(audits))))
        module, suite = self.suite(dict(remoteChecks=dict(path='/m', sha256='0' * 64, mode='replace')), remote)
        self.assertEqual(suite['source'], 'remote+host-audits')
        self.assertNotIn('local', suite)
        self.assertEqual((suite['remote']['numTotalTests'], suite['remote']['numPassedTests'], suite['remote']['numPendingTests']), (11521, 11519, 2))
        self.assertEqual((suite['hostAudits']['numPassedTests'], suite['hostAudits']['exitCode']), (2, 0))
        lines = module.markdown(dict(title='t', label='l', verdict='landed', passed=True, stopReason=None, receipt=None, operatorResult=None,
                                     completion=None, preparedRetry=None, stages=[], suite=suite, inputs='i', attempt='a', spec=dict(path='s'),
                                     driver=dict(path='p', blob='b', runId='r'),
                                     identities=dict(base='b', basetree='bt', reviewed='r', tree='t', candidate='c', mainHead='c', mainAtCandidate=True)))
        self.assertEqual((suite['remote']['numTotalTestFiles'], suite['remote']['numPassedTestFiles'], suite['remote']['numFailedTestFiles']), (2, 2, 0))
        self.assertEqual((suite['remote']['numTotalTestSuites'], suite['remote']['numPassedTestSuites']), (3, 3))
        self.assertIn('**Remote suite:** 11519/11521 tests passed, 0 failed, 2 pending; 2/2 files passed; 3/3 suites passed (`%s`)' % remote, lines)
        self.assertIn('**Host audits:** 2/2 tests passed, 0 failed, 0 pending; 2/2 files passed; 3/3 suites passed (`%s`)' % audits, lines)

    def test_main_line_says_unavailable_when_head_could_not_be_read(self):
        module = self.driver_module()
        ids = dict(base='b', basetree='bt', reviewed='r', tree='t', candidate='c', mainHead=None, mainAtCandidate=False)
        self.assertEqual(module.main_line(dict(identities=ids, passed=False)),
                         '- **MAIN:** unavailable (HEAD could not be read); the candidate is `c`')
        self.assertNotIn('not at the candidate', module.main_line(dict(identities=ids, passed=False)))

    def test_file_counts_come_from_the_reports_test_results_and_suites_stay_suites(self):
        module = self.driver_module()
        row = module.counts(self.report('remote.json', 11516, 11498, pending=18, files=941))
        self.assertEqual((row['numTotalTestFiles'], row['numPassedTestFiles'], row['numTotalTestSuites']), (941, 941, 3))
        self.assertIn('; 941/941 files passed; 3/3 suites passed', module.count_line(row))
        report = self.r / 'mixed.json'
        report.write_text(json.dumps(dict(json.loads((self.r / 'remote.json').read_text()),
                                          testResults=[dict(status='passed'), dict(status='failed'), dict(status='passed')])))
        self.assertEqual((module.counts(report)['numPassedTestFiles'], module.counts(report)['numFailedTestFiles']), (2, 1))
        bare = self.r / 'bare.json'
        bare.write_text(json.dumps(dict(numTotalTests=1, numPassedTests=1, numFailedTests=0, numPendingTests=0, numTotalTestSuites=4, numPassedTestSuites=4)))
        row = module.counts(bare)
        self.assertEqual(row['filesUnavailable'], 'the report has no testResults list')
        self.assertNotIn('numTotalTestFiles', row)
        self.assertIn('; files unavailable (the report has no testResults list); 4/4 suites passed', module.count_line(row))

    def test_compare_reports_both_suites_and_local_reports_one(self):
        (self.attempt / 'triage-evidence').mkdir(parents=True)
        shutil.copyfile(self.report('local.json', 20, 20), self.attempt / 'triage-evidence/full.json')
        _, suite = self.suite(dict(remoteChecks=dict(path='/m', sha256='0' * 64, mode='compare')), self.report('remote.json', 20, 18, pending=2))
        self.assertEqual(suite['source'], 'local+remote-compare')
        self.assertEqual((suite['local']['numPassedTests'], suite['remote']['numPassedTests']), (20, 18))
        _, suite = self.suite({})
        self.assertEqual((suite['source'], suite['local']['numTotalTests']), ('local', 20))
        self.assertNotIn('remote', suite)

    def test_an_interrupted_suite_still_publishes_the_stopped_result(self):
        self.flag('truncated-suite')
        code, result, _ = self.run_gate()
        self.assertEqual((code, result['verdict']), (1, 'stopped'))
        self.assertIn('unavailable', result['suite']['local'])
        self.assertIn('unavailable', (self.r / 'fixture-gate-r1-result.md').read_text())
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').is_file())

    def test_a_malformed_host_audit_record_still_publishes_the_stopped_result(self):
        self.flag('malformed-host-audits')
        code, result, _ = self.run_gate()
        self.assertEqual((code, result['verdict']), (1, 'stopped'))
        self.assertIn('unavailable', result['suite']['hostAudits'])
        self.assertTrue((self.orch / 'runs/fixture-final-gate-r1.done').is_file())

    def test_replace_with_a_receipt_reports_the_receipts_run_as_the_host_audits(self):
        remote = self.report('remote-full.json', 30, 28, pending=2)
        audits = self.report('host-audits-report.json', 2, 2)
        (self.attempt / 'remote-evidence').mkdir(parents=True)
        (self.attempt / 'remote-evidence/host-audits-receipt.json').write_text(json.dumps(dict(
            passed=True, verdict=dict(passed=True, exitCode=0, tests=2, files=1), report=reference(audits))))
        _, suite = self.suite(dict(remoteChecks=dict(path='/m', sha256='0' * 64, mode='replace'),
                                   hostAuditsReceipt=dict(path='/r/receipt.json', sha256='1' * 64)), remote)
        self.assertEqual(suite['source'], 'remote+host-audits-receipt')
        self.assertEqual(suite['hostAuditsReceipt'], dict(path='/r/receipt.json', sha256='1' * 64))
        self.assertEqual((suite['hostAudits']['numPassedTests'], suite['hostAudits']['exitCode']), (2, 0))

    def test_missing_or_malformed_host_audit_reports_are_unavailable(self):
        (self.attempt / 'remote-evidence').mkdir(parents=True)
        record = self.attempt / 'remote-evidence/host-audits.json'
        broken = self.r / 'broken-report.json'
        broken.write_text('[1, 2')
        for report in (dict(path=str(self.r / 'missing.json'), sha256='0' * 64), reference(broken)):
            record.write_text(json.dumps(dict(exitCode=0, report=report)))
            _, suite = self.suite(dict(remoteChecks=dict(path='/m', sha256='0' * 64, mode='replace')), self.report('remote.json', 3, 3))
            self.assertIn('unavailable', suite['hostAudits'])
        record.write_text(json.dumps(dict(exitCode=0)))
        _, suite = self.suite(dict(remoteChecks=dict(path='/m', sha256='0' * 64, mode='replace')), self.report('remote.json', 3, 3))
        self.assertIn('without a report', suite['hostAudits']['unavailable'])

    def test_an_unreadable_remote_report_is_recorded_not_hidden(self):
        module, driver, _ = self.driver()
        driver.attempt, driver.config_path = self.attempt, self.r / 'gate.json'
        driver.config_path.write_text(json.dumps(dict(remoteChecks=dict(path=str(self.r / 'missing.json'), sha256='0' * 64, mode='replace'))))
        self.assertIn('unavailable', driver.suite()['remote'])


class ScratchCleanupDriverTest(Fixture):
    """After a stop with a submission claim, the driver waits for the stopped gate unit to end (its canonical
    receipt) and runs the retained cancel again, which removes the attempt's recorded scratch checkouts; the
    result names every recorded checkout still left and why (debt-9)."""
    def scratch_path(self):
        return str(self.root / 'ep-gate-worker-20261110-010203-AbCdEf')

    def listed(self):
        return {line.split(' ', 1)[1] for line in self.git(self.main, 'worktree', 'list', '--porcelain').splitlines() if line.startswith('worktree ')}

    def end_unit(self):
        invocation = json.loads((self.attempt / 'submission.json').read_text())['id']
        receipt = self.orch / 'bounded' / invocation
        receipt.mkdir(parents=True, exist_ok=True)
        create_json(receipt / 'receipt.json', dict(id=invocation, outcome='killed', exitCode=143, startedAt='s', endedAt='e'))

    def run_late_stop(self, ends_after=None):
        """A stop after the claim whose unit ends ENDS_AFTER seconds into the driver's wait (None: never)."""
        self.flag('unit-ends-late')
        holder = dict(waited=0)
        def hook(calls):
            driver = holder['driver']
            if driver.active_stage == 'terminal-wait':
                holder['waited'] += 1
                if ends_after is not None and holder['waited'] == ends_after:
                    self.end_unit()
        module, driver, clock = self.driver(hook=hook)
        holder['driver'] = driver
        code = driver.run()
        result = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())
        return code, result, (self.r / 'fixture-gate-r1-result.md').read_text()

    def test_a_stop_whose_unit_ends_later_waits_for_it_then_removes_the_scratch(self):
        code, result, text = self.run_late_stop(ends_after=3)
        self.assertEqual(code, 1)
        self.assertIn('resume exited 1', result['stopReason'])
        self.assertEqual((self.orch / 'cancel.log').read_text(), 'cancel\ncancel\n', 'the retained cancel again once the unit ended')
        self.assertEqual([row['name'] for row in result['stages'][-3:]], ['cancel', 'terminal-wait', 'cancel'])
        self.assertEqual(result['stages'][-2]['outcome'], 'ok')
        self.assertFalse(os.path.lexists(self.scratch_path()))
        self.assertNotIn(self.scratch_path(), self.listed())
        self.assertEqual(result['scratch']['recorded'], [self.scratch_path()])
        self.assertEqual(result['scratch']['remaining'], [])
        self.assertEqual(result['scratch']['removal']['paths'], [dict(path=self.scratch_path(), state='removed')])
        self.assertIn('- **Scratch checkouts:** 1 recorded, none left\n', text)

    def test_a_unit_that_outlives_the_wait_keeps_its_scratch_and_the_result_names_it(self):
        code, result, text = self.run_late_stop()
        self.assertEqual(code, 1)
        self.assertEqual((self.orch / 'cancel.log').read_text(), 'cancel\n')
        wait = result['stages'][-1]
        self.assertEqual((wait['name'], wait['outcome']), ('terminal-wait', 'stopped'))
        self.assertIn('did not end within 420 s', wait['reason'])
        self.assertTrue(os.path.isdir(self.scratch_path()))
        reason = 'the gate unit did not end within 420 s of the stop; remove it once its receipt exists'
        self.assertEqual(result['scratch']['remaining'], [dict(path=self.scratch_path(), onDisk=True, listed=True, reason=reason)])
        self.assertIn('- **Scratch checkouts:** 1 recorded; left: `%s` (%s)\n' % (self.scratch_path(), reason), text)

    def test_the_wait_limit_covers_the_gate_units_stop_timeout(self):
        module = self.driver_module()
        self.assertEqual(module.TERMINAL_WAIT, 420, "bounded.sh's TimeoutStopSec=300 for a gate unit, then its ExecStopPost receipt")

    def test_a_retry_after_the_stop_lands(self):
        self.run_late_stop(ends_after=3)
        retry = gate_config.retry_spec(self.spec_path, self.r / 'fixture-gate-spec-r2.json', 'fixture-r2', self.orch)
        (self.orch / 'flag-unit-ends-late').unlink()
        module = self.driver_module()
        clock = FakeTime()
        self.assertEqual(module.Driver(retry, orch=self.orch, main=self.main, sleep=clock.sleep, clock=clock.clock,
                                       available=lambda: 30 * GiB).run(), 0)
        second = json.loads((self.r / 'fixture-gate-r2-result.json').read_text())
        self.assertEqual(second['verdict'], 'landed')
        self.assertEqual(second['scratch'], dict(recorded=[], remaining=[], removal=None))

    def test_a_failed_removal_is_the_reason_a_checkout_is_left(self):
        module, driver, _ = self.driver()
        driver.attempt = self.attempt
        self.attempt.mkdir()
        path = self.root / 'ep-gate-worker-20261110-010203-AbCdEf'
        path.mkdir()
        (self.attempt / 'scratch-worktrees.txt').write_text(str(path) + '\n')
        (self.attempt / 'scratch-cleanup.jsonl').write_text(json.dumps(dict(at='fixture', error='fixture removal failure')) + '\n')
        self.assertEqual(driver.scratch()['remaining'],
                         [dict(path=str(path), onDisk=True, listed=False, reason='removal failed: fixture removal failure')])

    def test_a_landed_gate_records_no_scratch_left(self):
        code, result, _ = self.run_gate()
        self.assertEqual(code, 0)
        self.assertEqual(result['scratch'], dict(recorded=[], remaining=[], removal=None))
        self.assertNotIn('terminal-wait', [row['name'] for row in result['stages']])


class PreparedRetryTest(Fixture):
    def run_spec(self, path, available=lambda: 30 * GiB):
        module = self.driver_module()
        module.PRELAUNCH_DEADLINE = module.PRELAUNCH_MEMORY_DEADLINE = 300
        clock = FakeTime()
        return module.Driver(path, orch=self.orch, main=self.main, sleep=clock.sleep, clock=clock.clock, available=available).run()

    def test_a_stopped_prepared_attempt_retries_in_prepared_mode_on_the_original_frame(self):
        samples = iter([30 * GiB] * 3 + [17 * GiB] * 10)
        self.assertEqual(self.run_spec(self.spec_path, lambda: next(samples)), 1)
        first = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())
        retry = gate_config.retry_spec(self.spec_path, self.r / 'fixture-gate-spec-r2.json', 'fixture-r2', self.orch)
        spec = json.loads(retry.read_text())
        self.assertEqual(spec['prepared'], first['preparedRetry'])
        for key in ('base', 'basetree', 'reviewed', 'tree', 'branch', 'archive', 'reviews', 'author_terminal', 'acceptance', 'message'):
            self.assertEqual(spec[key], self.spec[key], key)
        self.assertEqual((spec['label'], spec['inputs_dir'], spec['done_marker']),
                         ('fixture-r2', 'R/fixture-gate-r2-inputs', 'EP_ORCH/runs/run-fixture-final-gate-r2.done'))
        self.assertEqual(self.run_spec(retry), 0)
        second = json.loads((self.r / 'fixture-gate-r2-result.json').read_text())
        self.assertEqual(second['verdict'], 'landed')
        config = json.loads((self.r / 'fixture-gate-r2-inputs/gate.json').read_text())
        self.assertEqual(config['preparation'], dict(mode='prepared', archive=self.spec['archive'], candidate=first['identities']['candidate'],
                                                     mapping=dict(path=first['preparedRetry']['mapping'], sha256=first['preparedRetry']['mapping_sha256'])))
        self.assertEqual({axis: review['commit'] for axis, review in config['reviews'].items()}, dict(standards=self.reviewed, spec=self.reviewed))
        self.assertEqual(self.git(self.main, 'rev-parse', 'HEAD'), first['identities']['candidate'])
        self.assertEqual(len(self.launches()), 1)

    def test_an_attempt_stopped_before_preparation_retries_as_the_same_squash(self):
        self.spec['gate_time_exempt'] = dict(reason='GitHub incident')
        self.write_spec()
        self.assertEqual(self.run_spec(self.spec_path, lambda: 17 * GiB), 1)
        self.assertIsNone(json.loads((self.r / 'fixture-gate-r1-result.json').read_text())['preparedRetry'])
        spec = json.loads(gate_config.retry_spec(self.spec_path, self.r / 'fixture-gate-spec-r2.json', 'fixture-r2', self.orch).read_text())
        self.assertNotIn('prepared', spec)
        self.assertEqual((spec['reviewed'], spec['message']), (self.reviewed, self.spec['message']))
        self.assertEqual(spec['gate_time_exempt'], dict(reason='GitHub incident'), "root's outside cause stays with the retry")
        self.assertEqual(self.run_spec(self.r / 'fixture-gate-spec-r2.json'), 0)

    def test_retry_refusals(self):
        with self.assertRaisesRegex(RuntimeError, 'no result'):
            gate_config.retry_spec(self.spec_path, self.r / 'fixture-gate-spec-r2.json', 'fixture-r2', self.orch)
        self.assertEqual(self.run_spec(self.spec_path), 0)
        with self.assertRaisesRegex(RuntimeError, 'Only a stopped attempt'):
            gate_config.retry_spec(self.spec_path, self.r / 'fixture-gate-spec-r2.json', 'fixture-r2', self.orch)


    def test_a_retry_takes_a_new_or_changed_outside_cause(self):
        """Root records an outside cause after a gate-time stop: `gate_config.py retry ... --extra` sets only
        gate_time_exempt, and the retry spec's notes say so."""
        self.assertEqual(self.run_spec(self.spec_path, lambda: 17 * GiB), 1)
        r2, r3 = self.r / 'fixture-gate-spec-r2.json', self.r / 'fixture-gate-spec-r3.json'
        spec = json.loads(gate_config.retry_spec(self.spec_path, r2, 'fixture-r2', self.orch,
                                                 extra=dict(gate_time_exempt=dict(reason='GitHub incident'))).read_text())
        self.assertEqual(spec['gate_time_exempt'], dict(reason='GitHub incident'))
        self.assertEqual(spec['notes'][-1], "gate_time_exempt set on this retry (root's outside cause): GitHub incident")
        prior = json.loads(self.spec_path.read_text())
        kept = [key for key in prior if key not in gate_config.ATTEMPT_KEYS + ('notes', 'gate_time_exempt')]
        self.assertEqual({key: spec[key] for key in kept}, {key: prior[key] for key in kept}, 'every other binding stays')
        # A changed reason, through the CLI root runs.
        self.assertEqual(self.run_spec(r2, lambda: 17 * GiB), 1)
        run = subprocess.run([sys.executable, '-B', str(self.main / 'scripts/orchestration/gate_config.py'), 'retry', str(r2), str(r3),
                              '--label', 'fixture-r3', '--orch', str(self.orch), '--extra', json.dumps(dict(gate_time_exempt=dict(reason='Runner outage')))],
                             capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        spec = json.loads(r3.read_text())
        self.assertEqual(spec['gate_time_exempt'], dict(reason='Runner outage'))
        self.assertEqual(spec['notes'][-1], "gate_time_exempt set on this retry (root's outside cause): Runner outage")

    def test_a_retry_refuses_every_other_extra_key_and_shape(self):
        # The full pinned corpus of spec keys: a retry keeps every other binding, so --extra sets none of them.
        self.assertEqual(self.run_spec(self.spec_path, lambda: 17 * GiB), 1)
        new = self.r / 'fixture-gate-spec-r2.json'
        keys = [key for key in gate_config.REQUIRED + gate_config.OPTIONAL if key != 'gate_time_exempt'] + ['paths', 'unknown']
        self.assertGreater(len(keys), 30)
        cases = [{key: self.spec.get(key, 'x')} for key in keys]
        cases += [dict(gate_time_exempt=dict(reason='x'), reviewed=self.reviewed), [], 'x', {}]
        for value in cases:
            with self.subTest(extra=value):
                with self.assertRaisesRegex(RuntimeError, 'A retry takes only gate_time_exempt from --extra'):
                    gate_config.retry_spec(self.spec_path, new, 'fixture-r2', self.orch, extra=value)
                self.assertFalse(new.exists())
        for value in ('slow runner', {}, dict(reason=''), dict(reason='  '), dict(reason=3), dict(reason='x', by='root'), None):
            with self.subTest(exempt=value):
                with self.assertRaisesRegex(RuntimeError, 'gate_time_exempt takes exactly a non-empty reason'):
                    gate_config.retry_spec(self.spec_path, new, 'fixture-r2', self.orch, extra=dict(gate_time_exempt=value))
                self.assertFalse(new.exists())


class PrelaunchBlockerTest(Fixture):
    """The prelaunch heartbeat every 10 minutes, and its stops: 30 minutes when only memory or only disk blocks, else 90."""

    DISK = '/: btrfs metadata headroom 0.25 GiB < 1.00 GiB and unallocated 0.00 GiB < 2.00 GiB'

    def full_disk(self, sysfs=True):
        """The incident's btrfs volume (disk-guard.test.py): 20 GiB free data, but metadata at its 0.5 GiB reserve
        (0.25 GiB headroom) and nothing unallocated; without `sysfs`, a btrfs mount whose sysfs tree is missing."""
        fs = self.root / 'sys/fs/btrfs/fixture-fsid'
        values = {'allocation/data/disk_total': 440 * GiB, 'allocation/metadata/disk_total': 12 * GiB, 'allocation/system/disk_total': 64 << 20,
                  'allocation/metadata/total_bytes': 6 * GiB, 'allocation/metadata/bytes_used': 21 << 28, 'allocation/global_rsv_size': GiB // 2,
                  'devices/fixture0/size': (452 * GiB + (64 << 20)) // 512}
        for name, value in values.items() if sysfs else ():
            (fs / name).parent.mkdir(parents=True, exist_ok=True)
            (fs / name).write_text('%d\n' % value)
        (self.root / 'btrfs-mountinfo').write_text('20 1 0:46 / / rw - btrfs /dev/fixture0 rw\n')
        os.environ.update(DISK_GUARD_SYSFS=str(self.root / 'sys'), DISK_GUARD_MOUNTINFO=str(self.root / 'btrfs-mountinfo'),
                          DISK_GUARD_FREE_BYTES=str(20 * GiB))

    def run_prelaunch(self, available):
        module = self.driver_module()
        module.PRELAUNCH_INTERVAL = 300  # fewer probes; the deadlines and the report interval are the real ones
        clock = FakeTime()
        driver = module.Driver(self.spec_path, orch=self.orch, main=self.main, sleep=clock.sleep, clock=clock.clock, available=lambda: available)
        printed = io.StringIO()
        with contextlib.redirect_stdout(printed):
            code = driver.run()
        result = json.loads((self.r / 'fixture-gate-r1-result.json').read_text())
        rows = [json.loads(line) for line in (self.inputs / 'prelaunch-probes.jsonl').read_text().splitlines()]
        return code, result, rows, [line for line in printed.getvalue().splitlines() if line.startswith('prelaunch ')]

    def fired(self, result):
        return [(row['deadline'], row['seconds']) for row in result['ops']['timeouts']['fired']]

    def test_only_memory_blocking_stops_at_30_minutes(self):
        code, result, rows, printed = self.run_prelaunch(17 * GiB)
        self.assert_stopped(code, result, 'Memory guard: MemAvailable 17.00 GiB is below 18.00 GiB (launch guard plus 0.5 GiB) '
                                          'after 30 minutes; only memory blocked')
        self.assertEqual(self.fired(result), [('prelaunch', 1800)])
        line = 'blocked by memory: MemAvailable 17.00 GiB < 18.00 GiB'
        self.assertEqual(printed, ['prelaunch %d min: %s' % (minutes, line) for minutes in (10, 20, 30)])
        self.assertEqual([row.get('blocker') for row in rows if 'blocker' in row], printed, 'each printed line is recorded in its probe row')
        self.assertEqual(len(rows), 7)

    def test_any_other_blocker_keeps_90_minutes_and_is_named(self):
        import fcntl
        with (self.orch / 'curator2.lock').open('a+') as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            code, result, rows, printed = self.run_prelaunch(17 * GiB)
        reason = ('Admission not idle: prelaunch blocked for 90 minutes before preparation by locks, memory: '
                  'held curator2 (all 5 must be free); MemAvailable 17.00 GiB < 18.00 GiB')
        self.assert_stopped(code, result, reason)
        self.assertEqual(self.fired(result), [('prelaunch', 5400)])
        self.assertEqual(len(printed), 9)
        self.assertEqual(printed[-1], 'prelaunch 90 min: blocked by locks: held curator2 (all 5 must be free); '
                                      'memory: MemAvailable 17.00 GiB < 18.00 GiB')
        self.assertEqual(len(rows), 19)

    def test_only_disk_blocking_stops_at_30_minutes(self):
        self.full_disk()
        code, result, rows, printed = self.run_prelaunch(30 * GiB)
        self.assert_stopped(code, result, 'Disk guard: %s after 30 minutes; only disk blocked' % self.DISK)
        self.assertEqual(self.fired(result), [('prelaunch', 1800)])
        self.assertEqual(printed, ['prelaunch %d min: blocked by disk: %s' % (minutes, self.DISK) for minutes in (10, 20, 30)])
        self.assertEqual(len(rows), 7)
        self.assertEqual(rows[0]['disk']['volumes'][0]['btrfs']['metadataHeadroomBytes'], GiB // 4, 'each probe row keeps the reading')
        self.assertFalse(self.attempt.exists())
        self.assertEqual(self.launches(), [])

    def test_disk_beside_memory_keeps_90_minutes(self):
        self.full_disk()
        code, result, _, printed = self.run_prelaunch(17 * GiB)
        self.assert_stopped(code, result, 'Admission not idle: prelaunch blocked for 90 minutes before preparation by memory, disk: '
                                          'MemAvailable 17.00 GiB < 18.00 GiB; ' + self.DISK)
        self.assertEqual(self.fired(result), [('prelaunch', 5400)])
        self.assertEqual(printed[0], 'prelaunch 10 min: blocked by memory: MemAvailable 17.00 GiB < 18.00 GiB; disk: ' + self.DISK)

    def test_an_unreadable_disk_probe_warns_once_and_never_blocks(self):
        self.full_disk(sysfs=False)
        code, result, rows, printed = self.run_prelaunch(30 * GiB)
        self.assertEqual((code, result['verdict']), (0, 'landed'), result['stopReason'])
        self.assertEqual(printed, ['prelaunch 0 min: disk floor: warning: probe unavailable (/: btrfs allocation: no %s/fs/btrfs/*/devices/fixture0); '
                                   'not checked' % (self.root / 'sys')])
        self.assertEqual([row['consecutive'] for row in rows], [1, 2, 3])

    def test_busy_admission_alone_keeps_90_minutes(self):
        (self.orch / 'admission-busy').touch()
        code, result, _, printed = self.run_prelaunch(30 * GiB)
        self.assert_stopped(code, result, 'by admission: memory: 12/18 GiB reserved; active: gate-x; queued: none (must be idle)')
        self.assertEqual(self.fired(result), [('prelaunch', 5400)])
        self.assertEqual(printed[0], 'prelaunch 10 min: blocked by admission: memory: 12/18 GiB reserved; active: gate-x; queued: none (must be idle)')


class GateConfigTest(Fixture):
    def refs(self):
        for name in ('operator.json', 'validation-plan.json', 'storage-baseline.json', 'environment-precheck.json', 'commit-message.txt'):
            (self.r / name).write_text('{}\n')
        return dict(operator=reference(self.r / 'operator.json'), plan=reference(self.r / 'validation-plan.json'),
                    storageBaseline=reference(self.r / 'storage-baseline.json'), precheck=reference(self.r / 'environment-precheck.json'),
                    message=reference(self.r / 'commit-message.txt'), control=str(self.r / 'control.json'))

    def build(self):
        spec = gate_config.load_spec(self.spec_path, self.orch)
        return gate_config.gate_config(spec, self.main, self.orch, self.refs())

    def test_generation_is_deterministic_and_binds_reviewed_scope(self):
        first, second = self.build(), self.build()
        self.assertEqual(first, second)
        for axis in ('standards', 'spec'):
            review = first['reviews'][axis]
            self.assertEqual((review['commit'], review['tree']), (self.reviewed, self.tree))
            self.assertEqual(review['target'], dict(providerInstanceId='codex', model='gpt-6.1-sol', options=dict(reasoningEffort='xhigh', serviceTier='default')))
            self.assertEqual((review['taskId'], review['runId'], review['disposition'], review['unresolved']), ('task-review-' + axis, 'run-review-' + axis, 'accepted', []))
        self.assertEqual(first['preparation']['mode'], 'squash')
        self.assertEqual(first['validation']['receipts'], {})
        self.assertEqual([item['path'] for item in first['preservedEvidence']],
                         [str(self.r / 'fixture-review-r1/parent-acceptance.md'), str(self.r / 'environment-precheck.json')])
        for key in ('rebaseProof', 'carriedReview', 'remoteChecks', 'lane', 'issue'):
            self.assertNotIn(key, first)

    def test_a_host_audits_receipt_rides_a_replace_gate_only(self):
        self.spec.update(remote=dict(manifest='/abs/manifest.json', sha256='b' * 64, mode='replace'),
                         host_audits_receipt=dict(receipt='EP_ORCH/host-audits-receipts/fixture/receipt.json', sha256='c' * 64))
        self.write_spec()
        config = self.build()
        self.assertEqual(config['hostAuditsReceipt'], dict(path=str(self.orch / 'host-audits-receipts/fixture/receipt.json'), sha256='c' * 64))
        self.assertEqual(config['remoteChecks'], dict(path='/abs/manifest.json', sha256='b' * 64, mode='replace'))
        for remote in (dict(manifest='/abs/manifest.json', sha256='b' * 64, mode='compare'), None):
            with self.subTest(remote=remote):
                self.spec.pop('remote', None)
                if remote:
                    self.spec['remote'] = remote
                self.write_spec()
                with self.assertRaisesRegex(RuntimeError, 'host_audits_receipt needs remote checks in replace mode'):
                    self.build()
        self.spec['remote'] = dict(manifest='/abs/manifest.json', sha256='b' * 64, mode='replace')
        self.spec['host_audits_receipt'] = dict(receipt='EP_ORCH/x.json')
        self.write_spec()
        with self.assertRaisesRegex(RuntimeError, 'host_audits_receipt takes exactly receipt and sha256'):
            self.build()

    def test_gate_json_names_the_gate_time_file_the_queue_checks_before_land(self):
        config = self.build()
        self.assertEqual(config['gateTime'], dict(path=str(self.inputs / 'gate-time.json'), waits=config['attempt'] + '/gate-waits.tsv'))

    def test_an_outside_cause_is_one_reason_root_records(self):
        self.spec['gate_time_exempt'] = dict(reason='GitHub incident: runners queued 20 min')
        self.write_spec()
        spec = gate_config.load_spec(self.spec_path, self.orch)
        self.assertEqual(gate_config.gate_time_exempt(spec), dict(reason='GitHub incident: runners queued 20 min'))
        self.assertIsNone(gate_config.gate_time_exempt({key: value for key, value in spec.items() if key != 'gate_time_exempt'}))
        for value in ('slow runner', {}, dict(reason=''), dict(reason='  '), dict(reason=3), dict(reason='x', by='root')):
            with self.subTest(value=value):
                self.spec['gate_time_exempt'] = value
                self.write_spec()
                with self.assertRaisesRegex(RuntimeError, 'gate_time_exempt takes exactly a non-empty reason'):
                    gate_config.load_spec(self.spec_path, self.orch)

    def test_mode_fields_follow_the_spec(self):
        attestation = self.r / 'attestation.json'
        attestation.write_text('{}')
        lane = self.r / 'lane.json'
        lane.write_text(json.dumps(dict(verdict='PASS', lane=dict(mode='light', rule='light-lane-v1', paths=['docs/x.md']))))
        old, accepted, tree, carried, ctree = ('1' * 40, '2' * 40, '3' * 40, '4' * 40, '5' * 40)
        self.spec.update(rebase_proof=dict(oldBase=old, accepted=accepted, acceptedTree=tree, cli_output='x', q1='R/fixture-review-r1/parent-acceptance.md'),
                         carried_review=dict(axis='standards', commit=carried, tree=ctree, attestation='R/attestation.json', attestation_sha256='a' * 64),
                         remote=dict(manifest='/abs/manifest.json', sha256='b' * 64, mode='compare'), lane=dict(cli_output='R/lane.json'))
        self.write_spec()
        config = self.build()
        self.assertEqual(config['rebaseProof'], dict(oldBase=old, accepted=accepted, acceptedTree=tree))
        self.assertEqual(config['carriedReview'], dict(axis='standards', commit=carried, tree=ctree, attestation=dict(path=str(attestation), sha256='a' * 64)))
        self.assertEqual(config['remoteChecks'], dict(path='/abs/manifest.json', sha256='b' * 64, mode='compare'))
        self.assertEqual(config['lane'], dict(mode='light', rule='light-lane-v1', paths=['docs/x.md']))
        self.assertEqual((config['reviews']['standards']['commit'], config['reviews']['standards']['tree']), (carried, ctree))
        self.assertEqual((config['reviews']['spec']['commit'], config['reviews']['spec']['tree']), (accepted, tree))
        self.assertIn(str(lane), [item['path'] for item in config['preservedEvidence']])

    def test_a_regenerated_rebase_proof_carries_its_regen_field_and_the_mechanical_one_stays_as_it_was(self):
        old, accepted, tree = '1' * 40, '2' * 40, '3' * 40
        regen = dict(rule='code-regen-v1', paths=['scripts/catalog/scopes/campaign-mvp-v1.verification.json'], chain='x')
        for proof, expected in ((dict(oldBase=old, accepted=accepted, acceptedTree=tree, regen=regen),
                                 dict(oldBase=old, accepted=accepted, acceptedTree=tree, regen=regen)),
                                (dict(oldBase=old, accepted=accepted, acceptedTree=tree), dict(oldBase=old, accepted=accepted, acceptedTree=tree))):
            with self.subTest(regen='regen' in proof):
                self.spec.update(rebase_proof=dict(proof, cli_output='x'))
                self.write_spec()
                self.assertEqual(self.build()['rebaseProof'], expected)

    def test_a_patch_equal_rebase_proof_carries_its_field_with_or_without_regen(self):
        # rebase-patch-equal: pasted from `rebase-proof.py --patch-equal`; gate_core checks the shape and re-proves it.
        old, accepted, tree = '1' * 40, '2' * 40, '3' * 40
        equal = dict(rule='patch-equal-v1', paths=['docs/catalog-import/releases.md'])
        regen = dict(rule='code-regen-v2', paths=['scripts/catalog/scopes/campaign-mvp-v1.verification.json'], chain='x')
        for fields in (dict(patchEqual=equal), dict(patchEqual=equal, regen=regen)):
            with self.subTest(regen='regen' in fields):
                proof = dict(oldBase=old, accepted=accepted, acceptedTree=tree, **fields)
                self.spec.update(rebase_proof=dict(proof, cli_output='x'))
                self.write_spec()
                self.assertEqual(self.build()['rebaseProof'], proof)

    def test_conditional_land_follows_the_spec_for_code_and_curation(self):
        attestation = self.r / 'conditional.json'
        attestation.write_text('{}')
        commit, tree = '4' * 40, '5' * 40
        self.spec['conditional_land'] = dict(axes=['spec'], commit=commit, tree=tree, paths=['value'], message=False,
                                             attestation='R/conditional.json', attestation_sha256='a' * 64)
        self.write_spec()
        config = self.build()
        self.assertEqual(config['conditionalLand'], dict(axes=['spec'], commit=commit, tree=tree, paths=['value'], message=False,
                                                         attestation=dict(path=str(attestation), sha256='a' * 64)))
        self.assertEqual((config['reviews']['spec']['commit'], config['reviews']['spec']['tree']), (commit, tree))
        self.assertEqual((config['reviews']['standards']['commit'], config['reviews']['standards']['tree']), (self.reviewed, self.tree))
        message = self.r / 'cur-message.txt'
        message.write_text('Curate fixtures (#7)\n')
        self.spec.update(kind='curation', issue=7, message_file='R/cur-message.txt', message_sha256=digest(message),
                         reviews=dict(curation=self.spec['reviews']['standards']))
        self.spec['conditional_land'] = dict(axes=['curation'], commit=commit, tree=tree, paths=[], message=True,
                                             attestation='R/conditional.json', attestation_sha256='a' * 64)
        self.write_spec()
        config = self.build()
        self.assertEqual((config['conditionalLand']['axes'], config['conditionalLand']['message']), (['curation'], True))
        self.assertEqual((config['reviews']['curation']['commit'], config['reviews']['curation']['tree']), (commit, tree))
        self.spec['conditional_land']['axes'] = ['spec']
        self.write_spec()
        with self.assertRaisesRegex(RuntimeError, "Conditional LAND axes must be the gate kind's review axes"):
            self.build()

    def test_prepared_and_curation_preparations(self):
        mapping = self.r / 'mapping.json'
        mapping.write_text('{}')
        self.spec['prepared'] = dict(candidate=self.reviewed, mapping='R/mapping.json', mapping_sha256='c' * 64)
        self.write_spec()
        self.assertEqual(self.build()['preparation'], dict(mode='prepared', archive=self.spec['archive'], candidate=self.reviewed,
                                                           mapping=dict(path=str(mapping), sha256='c' * 64)))
        del self.spec['prepared']
        message = self.r / 'cur-message.txt'
        message.write_text('Curate fixtures (#7)\n')
        terminal = self.spec['reviews']['standards']
        self.spec.update(kind='curation', issue=7, message_file='R/cur-message.txt', message_sha256=digest(message),
                         reviews=dict(curation=terminal))
        self.write_spec()
        receipt = self.orch / 'logs/cur-7-prep.receipt'
        receipt.write_text('fixture prep receipt\n')
        config = self.build()
        self.assertIn(reference(receipt), config['preservedEvidence'], "the batch's prep receipt is preserved, as operators did")
        self.assertEqual((config['kind'], config['issue']), ('curation', 7))
        self.assertEqual(config['preparation'], dict(mode='squash', archive=self.spec['archive'], message=reference(message)))
        self.assertEqual(set(config['reviews']), {'curation'})
        spec = gate_config.load_spec(self.spec_path, self.orch)
        self.assertIsNone(gate_config.commit_message(spec))

    def curation_remote_spec(self, **remote):
        message = self.r / 'cur-message.txt'
        message.write_text('Curate fixtures (#7)\n')
        self.spec.update(kind='curation', issue=7, message_file='R/cur-message.txt', message_sha256=digest(message),
                         reviews=dict(curation=self.spec['reviews']['standards']),
                         remote=dict(dict(manifest='/abs/manifest.json', sha256='b' * 64, mode='replace'), **remote))
        self.write_spec()

    def test_curation_with_remote_checks_binds_the_remote_suite_prep_receipt_only(self):
        self.curation_remote_spec()
        local, remote = self.orch / 'logs/cur-7-prep.receipt', self.orch / 'logs/cur-7-prep.remote.receipt'
        local.write_text('local prep receipt\n')
        remote.write_text('remote-suite prep receipt\n')
        config = self.build()
        self.assertEqual(config['remoteChecks'], dict(path='/abs/manifest.json', sha256='b' * 64, mode='replace'))
        paths = [item['path'] for item in config['preservedEvidence']]
        self.assertIn(reference(remote), config['preservedEvidence'])
        self.assertNotIn(str(local), paths, 'a landing under remote checks reads only the remote-suite receipt')
        self.assertEqual(gate_config.mode_config(gate_config.load_spec(self.spec_path, self.orch)), {'remoteChecks': {'mode': 'replace'}})
        self.spec['remote']['mode'] = 'compare'
        self.write_spec()
        self.assertEqual(self.build()['remoteChecks']['mode'], 'compare')

    def test_curation_with_remote_checks_and_no_remote_suite_receipt_refuses(self):
        self.curation_remote_spec()
        (self.orch / 'logs/cur-7-prep.receipt').write_text('local prep receipt\n')
        with self.assertRaisesRegex(RuntimeError, 'Curation with remote checks needs its remote-suite prep receipt: ' +
                                    str(self.orch / 'logs/cur-7-prep.remote.receipt')):
            self.build()

    def test_spec_refusals(self):
        cases = [(dict(lane_typo=1), 'Unknown gate spec keys'), (dict(kind='pair'), 'kind'), (dict(base='abc'), 'Full Git identity'),
                 (dict(reviews=dict(standards={})), 'reviews must be exactly'),
                 (dict(reviews=dict(standards=dict(terminal='R/t', report='R/r', scope='R/s'), spec=dict(terminal='R/t', report='R/r'))),
                  'review entries take terminal, report and an optional conditional'), (dict(inputs_dir='relative/x'), 'absolute or start with R/'),
                 (dict(kind='curation', issue=3, reviews=dict(curation={}), message_file='/m', message_sha256='0', lane={}), 'code gates only')]
        remote = dict(manifest='/abs/manifest.json', sha256='b' * 64, mode='replace')
        curation = dict(kind='curation', issue=3, reviews=dict(curation={}), message_file='/m', message_sha256='0', remote=remote)
        cases += [({**curation, key: value}, key + ' is supported for code gates only')
                  for key, value in (('lane', {}), ('rebase_proof', {}), ('carried_review', {}), ('message_body', 'A body'))]
        # Every malformed body, falsey ones included, refuses: brief.py passes a present key through unchanged.
        cases += [(dict(message_body=value), 'message_body must be a non-empty string')
                  for value in MALFORMED_BODIES]
        cases += [({**curation, 'message_body': value}, 'message_body is supported for code gates only') for value in MALFORMED_BODIES]
        original = dict(self.spec)
        for change, message in cases:
            self.spec = {**original, **change}
            self.write_spec()
            with self.assertRaisesRegex(RuntimeError, message):
                spec = gate_config.load_spec(self.spec_path, self.orch)
                gate_config.gate_config(spec, self.main, self.orch, self.refs())


class ScriptOperatorIdentityTest(Fixture):
    def values(self):
        return dict(MAIN=str(self.main), BASE=self.base, E=str(self.attempt), CONFIG=str(self.r / 'gate.json'))

    def script(self, **changes):
        identity = gate_config.script_operator(self.main, self.base, 'gate-run:fixture-r1:1')
        identity.update(changes)
        return identity

    def test_committed_driver_at_base_is_the_operator(self):
        self.assertEqual(gate_core.operator_identity(self.values(), self.script()), 'script')

    def test_script_identity_mismatches_refuse(self):
        cases = [(dict(blob='0' * 40), 'blob'), (dict(commit=self.reviewed), 'commit is not BASE'),
                 (dict(path='/elsewhere/gate-run.py'), 'path'), (dict(taskId='script:other'), 'taskId'),
                 (dict(runId=''), 'runId'), (dict(extra=1), 'keys')]
        for change, message in cases:
            with self.assertRaisesRegex(RuntimeError, 'Script operator identity mismatch: ' + message):
                gate_core.operator_identity(self.values(), self.script(**change))

    def test_codex_operator_only_for_an_attempt_already_prepared_under_it(self):
        codex = dict(taskId='t', childRunId='r', providerInstanceId='codex', model='gpt-6.1-sol',
                     options=[{'id': 'reasoningEffort', 'value': 'high'}, {'id': 'serviceTier', 'value': 'default'}])
        config = self.r / 'gate.json'
        config.write_text('{"fixture": true}\n')
        with self.assertRaisesRegex(RuntimeError, 'accepted only for an attempt already prepared under it'):
            gate_core.operator_identity(self.values(), codex)
        self.attempt.mkdir()
        create_json(self.attempt / 'prepared.json', dict(config=reference(config)))
        self.assertEqual(gate_core.operator_identity(self.values(), codex), 'codex')
        config.write_text('{"fixture": "changed"}\n')
        with self.assertRaisesRegex(RuntimeError, 'accepted only'):
            gate_core.operator_identity(self.values(), codex)

    def test_control_bound_to_another_run_refuses(self):
        code, result, _ = self.run_gate()
        self.assertEqual(code, 0)
        control = json.loads((self.inputs / 'control.json').read_text())
        control['runId'] = 'gate-run:fixture-r1:someone-else'
        (self.inputs / 'control.json').write_text(json.dumps(control))
        with mock.patch.dict(os.environ, {'GATE_CONFIG': str(self.inputs / 'gate.json')}):
            values = gate_core.env()
        with self.assertRaisesRegex(RuntimeError, 'Execution control identity mismatch'):
            gate_core.execution_control(values, step='collect')


if __name__ == '__main__':
    unittest.main()
