"""Gate memory cap and host guards in the monitor. Fixture rows only; no live unit/backend/gate."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location('gate_monitor', HERE / 'gate_monitor.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)
import gate_core  # noqa: E402  (the module the monitor reads maintenance through)
SCHEDULER_READERS = dict(timers=gate_core.maintenance_timers, cron=gate_core.maintenance_cron)

GiB = 1024**3
# The gate unit's MemoryMax per gate mode, and the launch guard as that cap
# plus the unchanged 6 GiB in-run host floor. Option 1 (owner, 2026-10-30):
# 15 GiB for gates that run the local full suite (local, compare). The owner's
# 2026-11-03 decision: a measured, smaller cap for replace gates.
FULL_CAP = 15 * GiB
REPLACE_CAP = 10 * GiB
FLOOR = 6 * GiB
CAPS = dict(local=FULL_CAP, compare=FULL_CAP, replace=REPLACE_CAP)
# An automatic-maintenance reading with everything off, as gate_core.maintenance_reading records it, for a MAIN
# with no other worktree.
MAINTENANCE_OFF = dict(main='/fixture/main', worktrees=[{'path': '/fixture/main', 'gc.auto': dict(exitCode=0, value='0'),
                                                         'maintenance.auto': dict(exitCode=0, value='false')}],
                       scheduled=dict(repos=[], timers=[], cron=[], unread=[]))


def scope(real=0, **systemd):
    return {'systemctlExit': 0, 'systemd': dict(ActiveState='active', **systemd),
            'memory.events': 'max 0\noom 0\noom_kill 0\noom_group_kill 0\n',
            'memory.current': str(real), 'memory.stat': 'file 0\nshmem 0\n'}


def gate_config(mode):
    config = dict(version=1, kind='code')
    if mode != 'local':
        config['remoteChecks'] = dict(path='/manifest.json', sha256='0' * 64, mode=mode)
    return config


class GateMemoryCapTest(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.addCleanup(scratch.cleanup)
        self.e = Path(scratch.name)
        (self.e / 'protected-refs.json').write_text('{}')
        self.v = dict(E=str(self.e), ORCH=str(self.e), BASE='b' * 40, TREE='t' * 40, REVIEWED='r' * 40,
                      ARCHIVE='refs/archive', BR='branch', FEATURE='feature', CONFIG=str(self.e / 'gate.json'), MAIN=str(self.e))
        self.d = dict(SQUASHED='s' * 40)
        self.base = dict(slice=scope())
        self.mode('local')

    def mode(self, mode):
        Path(self.v['CONFIG']).write_text(json.dumps(gate_config(mode)))
        return CAPS[mode]

    def row(self, cap, unit_real=0, slice_real=0, bounded_peak=0, unit_props=None):
        unit = dict(MemoryMax=str(cap), MemoryHigh='infinity', MemorySwapMax='0', CPUQuotaPerSecUSec='6s', TasksMax='1024',
                    CPUWeight='20', Nice='10', Restart='no', LimitCORE='0', TimeoutStopUSec='5min')
        unit.update(unit_props or {})
        sliced = dict(MemoryMax=str(20 * GiB), MemoryHigh=str(18 * GiB), MemorySwapMax='0', CPUQuotaPerSecUSec='8s', TasksMax='2048')
        return dict(unit=scope(unit_real, **unit), slice=scope(slice_real, **sliced), boundedSample='real_peak=%d\n' % bounded_peak,
                    integrationStatus='', candidateStatus='', candidateHead=self.d['SQUASHED'], integrationHead=self.v['BASE'],
                    candidateTree=self.v['TREE'], archiveSHA=self.v['REVIEWED'], refs={}, guard={}, maintenance=MAINTENANCE_OFF)

    def violations(self, row):
        with patch.object(monitor, 'guard_violations', return_value=[]):
            return monitor.violations(self.v, None, self.d, self.base, row, monitor.ArchiveLedger())

    def test_each_mode_has_one_named_cap_and_a_launch_guard_of_cap_plus_the_unchanged_floor(self):
        self.assertEqual(monitor.GATE_MEMORY_MAX_BYTES, CAPS)
        self.assertEqual(monitor.HOST_FLOOR_BYTES, FLOOR)
        for mode, cap in CAPS.items():
            with self.subTest(mode=mode):
                config = gate_config(mode)
                self.assertEqual(monitor.gate_mode(config), mode)
                self.assertEqual(monitor.gate_memory_max_bytes(config), cap)
                self.assertEqual(monitor.launch_minimum_bytes(config), cap + FLOOR)
        self.assertEqual([monitor.launch_minimum_bytes(gate_config(m)) // GiB for m in ('local', 'compare', 'replace')], [21, 21, 16])

    def test_the_bounded_launch_value_is_the_mode_cap_in_systemd_units(self):
        self.assertEqual(monitor.bounded_gate_memory_max(gate_config('local')), '15G')
        self.assertEqual(monitor.bounded_gate_memory_max(gate_config('compare')), '15G')
        self.assertEqual(monitor.bounded_gate_memory_max(gate_config('replace')), '10G')
        self.assertEqual(sorted(monitor.BOUNDED_GATE_MEMORY_MAX_VALUES), ['10G', '15G'])

    def test_an_unknown_remote_mode_selects_no_cap(self):
        config = gate_config('local')
        config['remoteChecks'] = dict(path='/manifest.json', sha256='0' * 64, mode='skip')
        for select in (monitor.gate_mode, monitor.gate_memory_max_bytes, monitor.launch_minimum_bytes, monitor.bounded_gate_memory_max):
            with self.subTest(select=select.__name__), self.assertRaisesRegex(RuntimeError, 'Unknown remoteChecks mode'):
                select(config)

    def test_unit_at_the_mode_cap_and_none_other_is_accepted(self):
        for mode in CAPS:
            with self.subTest(mode=mode):
                cap = self.mode(mode)
                self.assertEqual(self.violations(self.row(cap)), [])
                # 11 GiB: the replace cap before fix round 1's measurements.
                for other in {FULL_CAP, REPLACE_CAP, 11 * GiB, 16 * GiB} - {cap}:
                    bad = self.violations(self.row(cap, unit_props=dict(MemoryMax=str(other))))
                    self.assertEqual(bad, [dict(scope='unit', capMismatch=dict(MemoryMax=dict(expected=str(cap), actual=str(other))))])

    def test_unit_real_memory_stops_at_the_mode_cap(self):
        for mode in CAPS:
            with self.subTest(mode=mode):
                cap = self.mode(mode)
                self.assertEqual(self.violations(self.row(cap, unit_real=cap - 1)), [])
                self.assertEqual(self.violations(self.row(cap, unit_real=cap)), [dict(scope='unit', realBytes=cap)])

    def test_slice_real_memory_stop_stays_at_the_full_suite_cap_in_every_mode(self):
        # The slice holds other admitted jobs as well; a replace gate does not
        # tighten their shared stop.
        for mode in CAPS:
            with self.subTest(mode=mode):
                cap = self.mode(mode)
                self.assertEqual(self.violations(self.row(cap, slice_real=FULL_CAP - 1)), [])
                self.assertEqual(self.violations(self.row(cap, slice_real=FULL_CAP)), [dict(scope='slice', realBytes=FULL_CAP)])

    def test_bounded_real_peak_stops_at_the_mode_cap(self):
        for mode in CAPS:
            with self.subTest(mode=mode):
                cap = self.mode(mode)
                self.assertEqual(self.violations(self.row(cap, bounded_peak=cap - 1)), [])
                self.assertEqual(self.violations(self.row(cap, bounded_peak=cap)), [dict(realPeak=str(cap))])

    def prelaunch(self, available):
        shown = subprocess.CompletedProcess([], 0, 'ControlGroup=\nActiveState=active\n', '')
        guard = dict(hostAvailableBytes=available, hostLowSeconds=0, observationGapSeconds=0)
        with patch.object(monitor.subprocess, 'run', return_value=shown), \
             patch.object(monitor, 'guard_observation', return_value=guard), \
             patch.object(monitor, 'guard_violations', return_value=[]), \
             patch.object(monitor, 'maintenance_reading', return_value=MAINTENANCE_OFF):
            return monitor.observe(self.v, None)

    def test_launch_needs_the_mode_cap_plus_the_host_floor(self):
        progress = self.e / 'resource-progress.jsonl'
        for mode, shown in (('local', 21), ('compare', 21), ('replace', 16)):
            with self.subTest(mode=mode):
                launch = self.mode(mode) + FLOOR
                progress.unlink(missing_ok=True)
                with self.assertRaisesRegex(RuntimeError, 'Host below %d GiB launch threshold' % shown):
                    self.prelaunch(launch - 1)
                self.assertFalse(progress.exists())
                self.assertEqual(self.prelaunch(launch)['guard']['hostAvailableBytes'], launch)
                rows = progress.read_text().splitlines()
                self.assertEqual([json.loads(r)['guard']['hostAvailableBytes'] for r in rows], [launch])

    def test_in_run_host_floor_stays_six_gib_for_five_seconds(self):
        def guard(available, seconds):
            return dict(guard=dict(hostAvailableBytes=available, hostLowSeconds=seconds, observationGapSeconds=0, docker=[],
                                   storage=dict(journal=dict(exitCode=1), counters=dict(stdout='same')), expectedStorageCounters='same'))
        self.assertEqual(monitor.guard_violations(guard(FLOOR, 60)), [])
        self.assertEqual(monitor.guard_violations(guard(FLOOR - 1, 4)), [])
        self.assertEqual(monitor.guard_violations(guard(FLOOR - 1, 5)), [dict(hostBelow6GiBSeconds=5)])


# The r4 sequence (mvp-20261023/admission-light-peaks-gate-r4-result.md, 2026-11-05): after a clean exit and the
# canonical receipt, the unit deactivated with its cgroup files gone, then systemd collected it; the observer
# flagged observerMissingCounters and its stop request met an unloaded unit.
INVOCATION_ID = 'fixture-20261105-152810-abcdef'
CLEAN_EXIT = dict(Result='success', ExecMainStatus='0', MainPID='0')
NOT_LOADED = 'Failed to stop ep-fresh-%s.service: Unit ep-fresh-%s.service not loaded.\n' % (INVOCATION_ID, INVOCATION_ID)


class TerminalDeactivationTest(unittest.TestCase):
    setUp, mode, row = GateMemoryCapTest.setUp, GateMemoryCapTest.mode, GateMemoryCapTest.row

    def invocation(self):
        return dict(id=INVOCATION_ID, invocationId=INVOCATION_ID, unit='ep-fresh-' + INVOCATION_ID,
                    log=str(self.e / ('bounded-' + INVOCATION_ID + '.log')), candidate=self.d['SQUASHED'])

    def receipt(self, outcome='ok', exit_code=0):
        s = self.invocation()
        path = self.e / 'bounded' / INVOCATION_ID / 'receipt.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(dict(id=s['id'], unit=s['unit'], log=s['log'], outcome=outcome, exitCode=exit_code)))

    def terminal_row(self, state='deactivating', counters=False, **props):
        """A unit row in STATE whose cgroup counters are gone (unless COUNTERS) after the main process ended."""
        row = self.row(15 * GiB, unit_props={**CLEAN_EXIT, **props})
        row['unit']['systemd']['ActiveState'] = state
        if not counters:
            for name in monitor.CGFILES:
                row['unit'].pop(name, None)
            row['unit']['unavailable'] = list(monitor.CGFILES)
        return row

    def violations(self, row):
        with patch.object(monitor, 'guard_violations', return_value=[]):
            return monitor.violations(self.v, self.invocation(), self.d, self.base, row, monitor.ArchiveLedger())

    def test_a_deactivating_unit_after_a_clean_exit_and_an_ok_receipt_is_terminal(self):
        self.receipt()
        self.assertEqual(self.violations(self.terminal_row()), [])

    def test_a_deactivating_unit_before_its_receipt_is_written_is_still_terminal(self):
        self.assertEqual(self.violations(self.terminal_row()), [])

    def test_genuine_counter_loss_still_stops(self):
        self.receipt()
        missing = [dict(observerMissingCounters='unit')]
        cases = [('active unit', self.terminal_row('active')), ('activating unit', self.terminal_row('activating')),
                 ('main process still running', self.terminal_row(MainPID='4242')),
                 ('no main PID recorded (r4 rows)', self.terminal_row(MainPID=None)),
                 ('failed result', self.terminal_row(Result='exit-code')), ('non-zero status', self.terminal_row(ExecMainStatus='1'))]
        for name, row in cases:
            with self.subTest(name):
                if row['unit']['systemd'].get('MainPID') is None:
                    row['unit']['systemd'].pop('MainPID', None)
                self.assertEqual(self.violations(row), missing)
        row = self.row(15 * GiB)
        for name in monitor.CGFILES:
            row['slice'].pop(name, None)
        self.assertEqual(self.violations(row), [dict(observerMissingCounters='slice')])

    def test_a_failed_receipt_keeps_the_missing_counters_a_violation(self):
        for outcome, code in (('failed', 1), ('ok', 1)):
            with self.subTest(outcome=outcome, code=code):
                self.receipt(outcome, code)
                self.assertEqual(self.violations(self.terminal_row()), [dict(observerMissingCounters='unit')])

    def test_missing_counters_are_recorded_unavailable_never_zero(self):
        shown = subprocess.CompletedProcess([], 0, 'ControlGroup=/ep-heavy.slice/gone.service\nActiveState=deactivating\n'
                                                   'Result=success\nExecMainStatus=0\nMainPID=0\n', '')
        with patch.object(monitor.subprocess, 'run', return_value=shown) as run, patch.object(monitor, 'CGROUP_ROOT', self.e / 'cgroup'):
            scope = monitor.observe_scope('ep-fresh-' + INVOCATION_ID)
        self.assertIn('MainPID', run.call_args.args[0])
        self.assertEqual(scope['unavailable'], list(monitor.CGFILES))
        self.assertFalse(set(monitor.CGFILES) & set(scope))
        self.assertIsNone(monitor.real(scope))
        cgroup = self.e / 'cgroup/ep-heavy.slice/gone.service'
        cgroup.mkdir(parents=True)
        (cgroup / 'memory.current').write_text('0\n')
        with patch.object(monitor.subprocess, 'run', return_value=shown), patch.object(monitor, 'CGROUP_ROOT', self.e / 'cgroup'):
            scope = monitor.observe_scope('ep-fresh-' + INVOCATION_ID)
        self.assertEqual((scope['memory.current'], scope['unavailable']), ('0\n', [name for name in monitor.CGFILES if name != 'memory.current']))

    def systemctl(self, load_state='not-found', stop_code=1, calls=None):
        def run(argv, **kwargs):
            (calls if calls is not None else []).append(argv)
            if argv[:3] == ['systemctl', '--user', 'stop']:
                return subprocess.CompletedProcess(argv, stop_code, '', NOT_LOADED if stop_code else '')
            if argv[:3] == ['systemctl', '--user', 'show'] and argv[-3:] == ['-p', 'LoadState', '--value']:
                return subprocess.CompletedProcess(argv, 0, load_state + '\n', '')
            raise AssertionError('unexpected command in a fixture: ' + str(argv))
        return run

    def test_a_stop_request_to_an_unloaded_unit_is_not_a_failure(self):
        with patch.object(monitor.subprocess, 'run', self.systemctl()):
            self.assertEqual(monitor.stop_unit('ep-fresh-' + INVOCATION_ID)['unloaded'], True)
        with patch.object(monitor.subprocess, 'run', self.systemctl(stop_code=0)):
            self.assertEqual(monitor.stop_unit('ep-fresh-' + INVOCATION_ID)['unloaded'], False)
        with patch.object(monitor.subprocess, 'run', self.systemctl(load_state='loaded')):
            with self.assertRaisesRegex(RuntimeError, '^Guard instrumentation failed: .*not loaded'):
                monitor.stop_unit('ep-fresh-' + INVOCATION_ID)

    def loop(self, rows, receipt_at=1):
        """run_monitor_loop over fixture ROWS (the receipt appears with row RECEIPT_AT), with an integrity worker
        that passes at once and systemctl answering as it did in r4. Returns the systemctl calls."""
        self.v.update(BUNDLE=str(self.e), LABEL='fixture', WT=str(self.e))
        sequence, calls, seen = iter(rows), [], []

        def observe(v, s):
            row = {**next(sequence), 'at': '2026-11-05T15:28:%02dZ' % len(seen)}
            seen.append(row)
            if len(seen) - 1 == receipt_at:
                self.receipt()
            with (self.e / 'resource-progress.jsonl').open('a') as f:
                f.write(json.dumps(row) + '\n')
            return row

        class Worker:
            returncode, pid = 0, None
            def poll(self):
                return 0
            def communicate(self, timeout=None):
                return json.dumps(dict(passed=True, binding=monitor.integrity_binding(outer.v), phases=[])), None
        outer = self
        with patch.object(monitor, 'observe', observe), patch.object(monitor, 'guard_violations', return_value=[]), \
             patch.object(monitor, 'stop_integrity', lambda process: None), patch.object(monitor.time, 'sleep', lambda seconds: None), \
             patch.object(monitor.subprocess, 'run', self.systemctl(calls=calls)), patch('builtins.print'):
            monitor.run_monitor_loop(self.v, self.invocation(), self.d, self.base, launch_integrity=lambda v: Worker())
        return calls

    def test_the_r4_sequence_reaches_terminal_integrity_without_a_stop(self):
        active = self.row(15 * GiB, unit_props=dict(Result='success', ExecMainStatus='0', MainPID='4242'))
        unloaded = self.terminal_row('inactive', LoadState='not-found')
        calls = self.loop([active, self.terminal_row(), unloaded])
        self.assertEqual(calls, [])
        self.assertFalse((self.e / 'stop-reason.json').exists())
        self.assertFalse((self.e / 'observer-failure.json').exists())
        integrity = [json.loads(line) for line in (self.e / 'integrity-progress.jsonl').read_text().splitlines()]
        self.assertEqual((integrity[-1]['stage'], integrity[-1]['passed']), ('terminal', True))

    def test_active_counter_loss_still_stops_and_an_unloaded_stop_target_is_not_the_failure(self):
        active = self.row(15 * GiB, unit_props=dict(Result='success', ExecMainStatus='0', MainPID='4242'))
        lost = self.terminal_row('active', MainPID='4242')
        unloaded = self.terminal_row('inactive', LoadState='not-found')
        calls = self.loop([active, lost, unloaded], receipt_at=2)
        self.assertEqual([argv[:3] for argv in calls if argv[2] == 'stop'], [['systemctl', '--user', 'stop']])
        reason = json.loads((self.e / 'stop-reason.json').read_text())
        self.assertEqual(reason['violations'], [dict(observerMissingCounters='unit')])
        self.assertFalse((self.e / 'observer-failure.json').exists())

    def test_a_restarted_monitor_keeps_the_archives_its_earlier_rows_observed(self):
        """The live loop replays this invocation's rows already written before its first observation."""
        added = 'refs/archive/run/new/accepted'
        for value, stops in (('a' * 40, False), ('b' * 40, True)):
            with self.subTest(value=value):
                for name in ('stop-reason.json', 'resource-progress.jsonl', 'integrity-progress.jsonl'):
                    (self.e / name).unlink(missing_ok=True)
                (self.e / 'bounded' / INVOCATION_ID / 'receipt.json').unlink(missing_ok=True)
                earlier = {**self.row(15 * GiB), 'invocationId': INVOCATION_ID, 'refs': {added: 'a' * 40}}
                (self.e / 'resource-progress.jsonl').write_text(json.dumps(earlier) + '\n')
                active = self.row(15 * GiB, unit_props=dict(Result='success', ExecMainStatus='0', MainPID='4242'))
                rows = [{**row, 'refs': {added: value}} for row in (active, self.terminal_row(), self.terminal_row('inactive', LoadState='not-found'))]
                calls = self.loop(rows, receipt_at=1)
                stopped = (self.e / 'stop-reason.json').exists()
                self.assertEqual(stopped, stops)
                if stops:
                    self.assertEqual(json.loads((self.e / 'stop-reason.json').read_text())['violations'],
                                     [dict(protectedRef=added, before='a' * 40, after=value)])
                    self.assertEqual([argv[:3] for argv in calls if argv[2] == 'stop'], [['systemctl', '--user', 'stop']])


class SchedulerReaderTest(unittest.TestCase):
    """The two scheduler readers the maintenance reading uses, over fixture command output."""

    def run_returning(self, code, stdout='', stderr=''):
        return patch.object(gate_core.subprocess, 'run', return_value=subprocess.CompletedProcess([], code, stdout, stderr))

    def test_active_maintenance_timers_are_listed_and_a_failed_listing_is_unread(self):
        with self.run_returning(0, 'git-maintenance@hourly.timer loaded active waiting Hourly\n\n') as run:
            self.assertEqual(SCHEDULER_READERS['timers'](), ['git-maintenance@hourly.timer'])
        self.assertEqual(run.call_args.args[0][:6], ['systemctl', '--user', 'list-units', '--type=timer', '--state=active', '--plain'])
        self.assertEqual(run.call_args.args[0][-1], 'git-maintenance@*')
        with self.run_returning(0, ''):
            self.assertEqual(SCHEDULER_READERS['timers'](), [])
        with self.run_returning(1, '', 'Failed to connect to bus'):
            self.assertEqual(SCHEDULER_READERS['timers'](), 'systemd user timers: Failed to connect to bus')
        with patch.object(gate_core.subprocess, 'run', side_effect=FileNotFoundError('systemctl')):
            self.assertEqual(SCHEDULER_READERS['timers'](), 'systemd user timers: systemctl')

    def test_crontab_lines_that_run_maintenance_are_listed(self):
        crontab = ('# 0 * * * * git maintenance run\n0 * * * * "/usr/bin/git" --exec-path=/usr/lib/git-core for-each-repo '
                   '--config=maintenance.repo maintenance run --schedule=hourly\n5 4 * * * backup.sh\n@daily git maintenance run --task=gc\n')
        with patch.object(shutil, 'which', return_value='/usr/bin/crontab'), self.run_returning(0, crontab):
            self.assertEqual(SCHEDULER_READERS['cron'](), crontab.splitlines()[1::2])
        with patch.object(shutil, 'which', return_value='/usr/bin/crontab'):
            with self.run_returning(1, '', 'no crontab for andreas\n'):
                self.assertEqual(SCHEDULER_READERS['cron'](), [])
            with self.run_returning(1, '', 'permission denied\n'):
                self.assertEqual(SCHEDULER_READERS['cron'](), 'crontab: permission denied')
        with patch.object(shutil, 'which', return_value=None):
            self.assertEqual(SCHEDULER_READERS['cron'](), [])


class GateRefScopeTest(unittest.TestCase):
    """The refs a gate protects, on a real repository (operations.md#protected-refs): the gate's branch, the
    integration branch, its reviewed archive, `main` and every `refs/archive/**` (added, never rewritten or
    deleted). Any other ref, a worker's `t3/*` branch, a T3 checkpoint or a fetched remote-tracking ref, is
    recorded and never stops the gate. Only the systemd, cgroup and host guard readings are fixtures."""

    def git(self, root, *args):
        return subprocess.run(['git', '-C', str(root), *args], check=True, capture_output=True, text=True).stdout.strip()

    def commit(self, root, name):
        (Path(root) / name).write_text(name + '\n')
        self.git(root, 'add', name)
        self.git(root, 'commit', '-qm', name)
        return self.git(root, 'rev-parse', 'HEAD')

    def setUp(self):
        scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.addCleanup(scratch.cleanup)
        root = Path(scratch.name).resolve()
        self.root, self.e, self.main, self.wt, self.other = root, root / 'attempt', root / 'main', root / 'gate', root / 'other'
        self.e.mkdir()
        for key, value in dict(GIT_AUTHOR_NAME='Fixture', GIT_AUTHOR_EMAIL='fixture@example.invalid', GIT_COMMITTER_NAME='Fixture',
                               GIT_COMMITTER_EMAIL='fixture@example.invalid', GIT_CONFIG_NOSYSTEM='1', HOME=str(root)).items():
            patcher = patch.dict(os.environ, {key: value})
            patcher.start()
            self.addCleanup(patcher.stop)
        # The host's systemd user timers and crontab are fixtures here; their readers have their own tests.
        self.timers, self.cron = [], []
        for name in ('timers', 'cron'):
            patcher = patch.object(gate_core, 'maintenance_' + name, lambda name=name: getattr(self, name))
            patcher.start()
            self.addCleanup(patcher.stop)
        self.git(root, 'init', '-q', '-b', 'feature', str(self.main))
        self.git(self.main, 'config', 'gc.auto', '0')
        self.git(self.main, 'config', 'maintenance.auto', 'false')
        self.base = self.commit(self.main, 'base')
        self.git(self.main, 'branch', 'main')
        self.git(self.main, 'worktree', 'add', '-q', '-b', 't3/gate', str(self.wt), self.base)
        reviewed = self.commit(self.wt, 'reviewed')
        tree = self.git(self.wt, 'rev-parse', 'HEAD^{tree}')
        squashed = self.git(self.wt, 'commit-tree', tree, '-p', self.base, '-m', 'squashed')
        self.git(self.wt, 'reset', '-q', '--hard', squashed)
        self.archive = 'refs/archive/run/gate/reviewed'
        self.older = 'refs/archive/run/older/reviewed'
        self.git(self.main, 'update-ref', self.archive, reviewed)
        self.git(self.main, 'update-ref', self.older, self.base)
        self.git(self.main, 'update-ref', 'refs/t3/checkpoints/turn-1', self.base)
        self.git(self.main, 'worktree', 'add', '-q', '-b', 't3/other', str(self.other), self.base)
        self.git(root, 'init', '-q', '--bare', str(root / 'origin.git'))
        self.git(self.main, 'remote', 'add', 'origin', str(root / 'origin.git'))
        self.git(self.main, 'push', '-q', 'origin', 'feature')
        self.v = dict(E=str(self.e), ORCH=str(root), MAIN=str(self.main), WT=str(self.wt), BASE=self.base, REVIEWED=reviewed,
                      TREE=tree, ARCHIVE=self.archive, BR='t3/gate', FEATURE='feature', CONFIG=str(self.e / 'gate.json'))
        Path(self.v['CONFIG']).write_text(json.dumps(gate_config('local')))
        self.d = dict(SQUASHED=squashed)
        self.s = dict(invocationId=INVOCATION_ID, unit='ep-fresh-' + INVOCATION_ID)
        self.scopes = {key: value for key, value in GateMemoryCapTest.row(self, FULL_CAP).items() if key in ('unit', 'slice')}
        self.base_row = dict(slice=scope())
        # What preparation stores once: every ref in MAIN before the run.
        (self.e / 'protected-refs.json').write_text(json.dumps(monitor.all_refs(self.main)))
        monitor._other_refs = None
        self.ledger = monitor.ArchiveLedger()

    def observed(self, ledger=None):
        """One observer row and its violations, judged in order with the attempt's other rows (one ledger)."""
        with patch.object(monitor, 'observe_scope', lambda unit: self.scopes['unit' if unit == self.s['unit'] else 'slice']), \
             patch.object(monitor, 'guard_observation', return_value={}), patch.object(monitor, 'guard_violations', return_value=[]):
            row = monitor.observe(self.v, self.s)
            return row, monitor.violations(self.v, self.s, self.d, self.base_row, row, ledger or self.ledger)

    def ref_stops(self, bad):
        return [item for item in bad if 'protectedRef' in item]

    def test_rows_carry_the_protected_refs_and_a_digest_of_the_rest(self):
        row, bad = self.observed()
        self.assertEqual(bad, [])
        refs = monitor.all_refs(self.main)
        protected = ['refs/heads/t3/gate', 'refs/heads/feature', self.archive, 'refs/heads/main', self.older]
        self.assertEqual(row['refs'], {ref: refs[ref] for ref in protected})
        rest = {ref: value for ref, value in refs.items() if ref not in protected}
        self.assertIn('refs/heads/t3/other', rest)
        self.assertEqual(row['otherRefs'], monitor.ref_digest(rest))
        self.assertEqual(row['otherRefs']['count'], len(rest))
        self.assertNotIn('otherRefMoves', row)

    def test_a_commit_on_an_unrelated_worker_branch_is_recorded_and_does_not_stop_the_gate(self):
        self.observed()
        moved = self.commit(self.other, 'worker')
        self.git(self.main, 'update-ref', 'refs/t3/checkpoints/turn-1', moved)
        self.git(self.main, 'update-ref', 'refs/t3/checkpoints/turn-2', moved)
        row, bad = self.observed()
        self.assertEqual(bad, [])
        self.assertEqual(row['otherRefMoves'], [dict(ref='refs/heads/t3/other', before=self.base, after=moved),
                                                dict(ref='refs/t3/checkpoints/turn-1', before=self.base, after=moved),
                                                dict(ref='refs/t3/checkpoints/turn-2', before=None, after=moved)])
        self.assertNotIn('refs/heads/t3/other', row['refs'])
        row, bad = self.observed()
        self.assertEqual((bad, 'otherRefMoves' in row), ([], False))

    def test_a_fetch_moving_remote_tracking_refs_is_recorded_only(self):
        upstream = self.root / 'upstream'
        self.git(self.root, 'clone', '-q', '-b', 'feature', str(self.root / 'origin.git'), str(upstream))
        fetched = self.commit(upstream, 'upstream')
        self.git(upstream, 'push', '-q', 'origin', 'feature', 'feature:refs/heads/elsewhere')
        before = self.git(self.main, 'rev-parse', 'refs/remotes/origin/feature')
        self.git(self.main, 'fetch', '-q', 'origin')
        row, bad = self.observed()
        self.assertEqual(bad, [])
        self.assertEqual(row['otherRefMoves'], [dict(ref='refs/remotes/origin/elsewhere', before=None, after=fetched),
                                                dict(ref='refs/remotes/origin/feature', before=before, after=fetched)])

    def test_a_move_on_the_gates_branch_the_integration_branch_its_archive_or_main_stops_the_gate(self):
        elsewhere = self.commit(self.other, 'elsewhere')
        for ref in ('refs/heads/t3/gate', 'refs/heads/feature', self.archive, 'refs/heads/main'):
            with self.subTest(ref=ref):
                before = self.git(self.main, 'rev-parse', ref)
                self.git(self.main, 'update-ref', ref, elsewhere)
                try:
                    row, bad = self.observed()
                finally:
                    self.git(self.main, 'update-ref', ref, before)
                expected = json.loads((self.e / 'protected-refs.json').read_text()).get(ref)
                self.assertEqual(self.ref_stops(bad), [dict(protectedRef=ref, before=expected, after=elsewhere)])

    def test_the_landing_fast_forward_of_the_integration_branch_is_allowed(self):
        self.git(self.main, 'merge', '-q', '--ff-only', self.d['SQUASHED'])
        row, bad = self.observed()
        self.assertEqual(bad, [])
        self.assertEqual(row['refs']['refs/heads/feature'], self.d['SQUASHED'])

    def test_every_archive_once_observed_keeps_its_value_wherever_its_rows_are_judged(self):
        """The refused set (Spec #1, Standards #1, fix r1): a rewrite or a delete of any archive the attempt has
        observed, whether in the snapshot, added during the gate or the gate's own, judged live or by a monitor
        restarted after the first row (it replays the rows already written, a stop among them included). An
        added archive left alone passes. Collection's judging is CollectionEquivalenceTest's archive cases."""
        added = 'refs/archive/run/new/accepted'
        values = {self.older: self.base, added: self.base, self.archive: self.v['REVIEWED']}
        for ref in values:
            for change in ('rewrite', 'delete', None):
                for judge in ('live', 'restarted'):
                    with self.subTest(ref=ref, change=change, judge=judge):
                        (self.e / 'resource-progress.jsonl').unlink(missing_ok=True)
                        for name, value in values.items():
                            self.git(self.main, 'update-ref', name, value)
                        if ref != added:
                            subprocess.run(['git', '-C', str(self.main), 'update-ref', '-d', added], check=False, capture_output=True)
                        ledger = monitor.ArchiveLedger()
                        row, bad = self.observed(ledger)
                        self.assertEqual(bad, [])
                        if change == 'rewrite':
                            self.git(self.main, 'update-ref', ref, self.d['SQUASHED'])
                        elif change == 'delete':
                            self.git(self.main, 'update-ref', '-d', ref)
                        if judge == 'restarted':
                            ledger = monitor.ArchiveLedger()
                            self.assertEqual(ledger.replay(self.v, self.s, self.d), [])
                        if ref == self.archive and change == 'delete':
                            # The row's archiveSHA read fails, which the loop records as an observer failure and stops on.
                            with self.assertRaises(subprocess.CalledProcessError):
                                self.observed(ledger)
                            continue
                        row, bad = self.observed(ledger)
                        after = dict(rewrite=self.d['SQUASHED'], delete=None).get(change)
                        expected = [dict(protectedRef=ref, before=values[ref], after=after)] if change else []
                        self.assertEqual(self.ref_stops(bad), expected)
                        self.assertEqual(self.ref_stops(monitor.ArchiveLedger().replay(self.v, self.s, self.d)), expected)

    def test_an_archive_may_be_added_and_one_in_the_snapshot_never_rewritten_or_deleted(self):
        added = 'refs/archive/run/new/accepted'
        self.git(self.main, 'update-ref', added, self.base)
        row, bad = self.observed()
        self.assertEqual(bad, [])
        self.assertEqual(row['refs'][added], self.base)
        self.git(self.main, 'update-ref', self.older, self.d['SQUASHED'])
        row, bad = self.observed()
        self.assertEqual(self.ref_stops(bad), [dict(protectedRef=self.older, before=self.base, after=self.d['SQUASHED'])])
        self.git(self.main, 'update-ref', '-d', self.older)
        row, bad = self.observed()
        self.assertEqual(self.ref_stops(bad), [dict(protectedRef=self.older, before=self.base, after=None)])

    def test_rows_that_carry_every_ref_are_judged_on_the_protected_set(self):
        """A row in the shape before this change (every ref under `refs`) is judged by the same rule."""
        row, _ = self.observed()
        moved = self.commit(self.other, 'worker')
        every = {**monitor.all_refs(self.main)}
        judge = lambda refs: monitor.violations(self.v, self.s, self.d, self.base_row, {**row, 'refs': refs}, monitor.ArchiveLedger())
        with patch.object(monitor, 'guard_violations', return_value=[]):
            self.assertEqual(judge(every), [])
            every[self.older] = moved
            self.assertEqual(self.ref_stops(judge(every)), [dict(protectedRef=self.older, before=self.base, after=moved)])

    # Each way automatic maintenance stays on, with the reason the gate names. --type=int and --type=bool
    # normalise what Git reads, so `yes` and `1` are `true`; an unparsable value is exit 128.
    MAINTENANCE_ON = (('gc.auto', None, 'gc.auto is unset, not 0'), ('gc.auto', '6700', "gc.auto is '6700', not 0"),
                      ('gc.auto', '1', "gc.auto is '1', not 0"), ('gc.auto', '-1', "gc.auto is '-1', not 0"),
                      ('gc.auto', 'often', 'gc.auto is not a valid value, not 0'),
                      ('maintenance.auto', None, 'maintenance.auto is unset, not false'),
                      ('maintenance.auto', 'true', "maintenance.auto is 'true', not false"),
                      ('maintenance.auto', 'yes', "maintenance.auto is 'true', not false"),
                      ('maintenance.auto', '1', "maintenance.auto is 'true', not false"),
                      ('maintenance.auto', 'sometimes', 'maintenance.auto is not a valid value, not false'))

    def prelaunch(self):
        guard = dict(hostAvailableBytes=1024 * GiB, hostLowSeconds=0, observationGapSeconds=0)
        with patch.object(monitor, 'observe_scope', lambda unit: self.scopes['slice']), \
             patch.object(monitor, 'guard_observation', return_value=guard), patch.object(monitor, 'guard_violations', return_value=[]):
            return monitor.observe(self.v, None)

    def worktrees(self):
        """MAIN and its worktrees as Git lists them (realpaths), MAIN first."""
        return [str(self.main), str(self.wt), str(self.other)]

    def assert_stops(self, expected):
        """EXPECTED automatic-maintenance reasons refuse the prelaunch row and stop the next observer row, exactly."""
        with self.assertRaises(RuntimeError) as refused:
            self.prelaunch()
        message = str(refused.exception)
        self.assertIn("Prelaunch refused: automatic Git maintenance can run on MAIN's object store: ", message)
        for reason in expected:
            self.assertIn(reason, message)
        row, bad = self.observed()
        self.assertEqual(sorted(item['automaticMaintenance'] for item in bad), sorted(expected), bad)
        self.assertEqual([next(iter(item)) for item in bad], ['automaticMaintenance'] * len(expected))
        return row

    def assert_passes(self):
        self.assertEqual(gate_core.maintenance_refusals(self.prelaunch()['maintenance']), [])
        self.assertEqual(self.observed()[1], [])

    def configure(self, *argv, root=None):
        """`git config ARGV` in ROOT (MAIN by default), undone after the subtest by the returned callable."""
        root = root or self.main
        self.git(root, 'config', *argv)
        scope = [arg for arg in argv if arg.startswith('--')]
        key = [arg for arg in argv if not arg.startswith('--')][0]
        return lambda: self.git(root, 'config', *scope, '--unset-all', key)

    def test_automatic_maintenance_on_in_any_context_git_resolves_stops_the_gate(self):
        """The refused set over the full corpus (Spec r2 #1, Standards r2 #2; root ruling, fix r2): every value
        Git reads as on, in every config layer and include that can turn it on, read as Git resolves it in each
        worktree, at both monitor seams (the prelaunch row and every observer row). gate-run's identity stage
        refuses the same reading (gate-run.test.py). Each reason names the worktree whose Git would run it."""
        self.assert_passes()
        main, gate, other = self.worktrees()
        unshared = self.root / 'onbranch.gitconfig'
        unshared.write_text('[gc]\n\tauto = 1\n')
        cases = [('value %s=%s in the shared repository config' % (key, value), key, value, shown, [main, gate, other])
                 for key, value, shown in self.MAINTENANCE_ON]
        cases += [('user (global) config, with the repository layer unset', 'gc.auto', '1', "gc.auto is '1', not 0", [main, gate, other], 'global-only'),
                  ('per-worktree config.worktree of a worker', 'maintenance.auto', 'true', "maintenance.auto is 'true', not false", [other], 'worktree'),
                  ('includeIf onbranch:t3/** turning gc.auto on', 'includeIf.onbranch:t3/**.path', str(unshared), "gc.auto is '1', not 0", [gate, other]),
                  # A linked worktree's gitdir is its admin directory; a trailing slash would mean "below it".
                  ('includeIf gitdir: of one worktree', 'includeIf.gitdir:%s/.git/worktrees/other.path' % main, str(unshared), "gc.auto is '1', not 0", [other])]
        for name, key, value, shown, affected, *scope in cases:
            with self.subTest(name):
                undo = []
                if scope == ['worktree']:
                    undo.append(self.configure('extensions.worktreeConfig', 'true'))
                    undo.insert(0, self.configure('--worktree', key, value, root=self.other))
                elif scope == ['global-only']:
                    self.git(self.main, 'config', '--unset-all', key)
                    undo.append(lambda key=key: self.git(self.main, 'config', key, '0'))
                    undo.insert(0, self.configure('--global', key, value))
                elif value is None:
                    saved = self.git(self.main, 'config', '--get', key)
                    self.git(self.main, 'config', '--unset-all', key)
                    undo.append(lambda key=key, saved=saved: self.git(self.main, 'config', key, saved))
                elif key in ('gc.auto', 'maintenance.auto') and not scope:
                    saved = self.git(self.main, 'config', '--get', key)
                    self.git(self.main, 'config', key, value)
                    undo.append(lambda key=key, saved=saved: self.git(self.main, 'config', key, saved))
                else:
                    undo.append(self.configure(*scope, key, value))
                try:
                    self.assert_stops(['%s: %s' % (path, shown) for path in affected])
                finally:
                    for step in undo:
                        step()
                self.assert_passes()

    def test_scheduled_maintenance_that_can_reach_main_stops_the_gate(self):
        """A `maintenance.repo` entry Git expands (`--path`, so `~/` too: Standards r2 #1) to MAIN, a worktree, a
        directory inside one or a symlink to one, in the user layer the scheduler reads or the repository layer;
        an active `git-maintenance@*` timer; a crontab line that runs maintenance; and either reader failing."""
        self.assert_passes()
        (self.other / 'sub').mkdir()
        (self.root / 'link').symlink_to(self.main)
        home = str(self.root)
        entries = [(str(self.main), '--global'), ('~/main', '--global'), ('~/other', '--global'), (str(self.wt) + '/', '--global'),
                   (str(self.other / 'sub'), '--global'), (str(self.root / 'link'), '--global'), (str(self.main), '--local')]
        for entry, scope in entries:
            with self.subTest(entry=entry, scope=scope):
                undo = self.configure(scope, 'maintenance.repo', entry)
                try:
                    self.assert_stops(['scheduled maintenance (maintenance.repo) runs on ' + entry.replace('~', home, 1)])
                finally:
                    undo()
        for name, value, reason in (('timers', ['git-maintenance@hourly.timer'], 'scheduled maintenance timer is active: git-maintenance@hourly.timer'),
                                    ('timers', 'systemd user timers: Failed to connect to bus', 'scheduled maintenance unread: systemd user timers: Failed to connect to bus'),
                                    ('cron', ['0 * * * * git for-each-repo --config=maintenance.repo maintenance run --schedule=hourly'],
                                     'scheduled maintenance in the crontab: 0 * * * * git for-each-repo --config=maintenance.repo maintenance run --schedule=hourly'),
                                    ('cron', 'crontab: permission denied', 'scheduled maintenance unread: crontab: permission denied')):
            with self.subTest(name=name, value=value):
                setattr(self, name, value)
                try:
                    self.assert_stops([reason])
                finally:
                    setattr(self, name, [])
        unrelated = self.root / 'unrelated'
        self.git(self.root, 'init', '-q', str(unrelated))
        for entry in (str(unrelated), '~/unrelated', str(self.root / 'gone')):
            with self.subTest(accepted=entry):
                undo = self.configure('--global', 'maintenance.repo', entry)
                try:
                    self.assert_passes()
                finally:
                    undo()

    def test_maintenance_off_in_any_spelling_or_layer_git_reads_as_off_passes(self):
        for key, value in (('maintenance.auto', 'no'), ('maintenance.auto', 'off'), ('maintenance.auto', '0'), ('gc.auto', '00')):
            with self.subTest(key=key, value=value):
                self.git(self.main, 'config', key, value)
                self.assert_passes()
        # The user layer alone turns it off too, and a user-layer value under the repository's 0 is overridden.
        self.git(self.main, 'config', '--unset-all', 'gc.auto')
        self.git(self.main, 'config', '--global', 'gc.auto', '0')
        self.assert_passes()
        self.git(self.main, 'config', 'gc.auto', '0')
        self.git(self.main, 'config', '--global', 'gc.auto', '1')
        self.assert_passes()

    def test_a_worktree_added_mid_gate_is_read_from_its_first_row(self):
        self.observed()
        late = self.root / 'late'
        self.git(self.main, 'worktree', 'add', '-q', '-b', 't3/late', str(late), self.base)
        row, bad = self.observed()
        self.assertEqual(bad, [])
        self.assertIn(str(late), [item['path'] for item in row['maintenance']['worktrees']])
        self.git(self.main, 'config', 'extensions.worktreeConfig', 'true')
        self.git(late, 'config', '--worktree', 'gc.auto', '6700')
        self.assert_stops(["%s: gc.auto is '6700', not 0" % late])

    def record_scratch(self, path):
        """The queue's own record of a scratch checkout, through paths.sh as triage-failures.sh and host-audits.sh call it."""
        subprocess.run(['bash', '-c', 'here=$1; export MAIN=$2 GATE_SCRATCH_WORKTREES=$3; . "$here/paths.sh"; record_scratch_worktree "$4"',
                        'record', str(HERE), str(self.main), str(self.e / gate_core.SCRATCH_RECORD), str(path)], check=True)

    def unresolve(self, kind, path):
        """Leave the worktree at PATH unresolved as KIND; returns the reason the reading gives it."""
        if kind == 'prunable':
            shutil.rmtree(path)
            return 'prunable: gitdir file points to non-existent location'
        if kind == 'unlocked manual move':
            path.rename(path.with_name(path.name + '-moved'))
            moved = path.with_name(path.name + '-moved')
            self.assertEqual(gate_core.common_dir(moved), gate_core.common_dir(self.main), 'the moved worktree still runs Git on MAIN')
            return 'prunable: gitdir file points to non-existent location'
        if kind == 'locked manual move':
            self.git(self.main, 'worktree', 'lock', str(path))
            path.rename(path.with_name(path.name + '-moved'))
            return 'directory gone'
        self.git(self.main, 'worktree', 'lock', '--reason', 'initializing', str(path))  # mid-creation
        (path / '.git').write_text('gitdir: %s/not-yet\n' % self.root)
        return 'locked and not yet a worktree of MAIN: initializing'

    def test_an_unresolved_worktree_entry_passes_only_at_the_attempts_own_recorded_scratch_path(self):
        """The refused set (Spec r3, Standards r3; root ruling, fix r3): an entry Git cannot resolve (prunable,
        vanished, or locked and not yet a worktree of MAIN) refuses at prelaunch and stops a running gate, unless
        its exact path is in the attempt's scratch record. A worker worktree moved by hand, unlocked or locked,
        and an entry mid-creation that is not the gate's own refuse; so does an `ep-gate-*` name nobody recorded.
        The gate's own recorded scratch checkout passes while it is prunable or mid-creation."""
        self.assert_passes()
        kinds = ('prunable', 'unlocked manual move', 'locked manual move', 'mid-creation')
        cases = [(kind, 'worker', False) for kind in kinds] + [('mid-creation', 'ep-gate-unrecorded', False)]
        cases += [('prunable', 'ep-gate-own', True), ('mid-creation', 'ep-gate-own', True)]
        for index, (kind, name, recorded) in enumerate(cases):
            with self.subTest(kind=kind, worktree=name, recorded=recorded):
                path = self.root / ('%s-%d' % (name, index))
                if recorded:
                    self.record_scratch(path)
                self.git(self.main, 'worktree', 'add', '-q', '--detach', str(path), self.base)
                self.assert_passes()
                reason = self.unresolve(kind, path)
                try:
                    if recorded:
                        row = self.prelaunch()
                        self.assertEqual(gate_core.maintenance_refusals(row['maintenance']), [])
                        self.assertEqual(self.observed()[1], [])
                        self.assertIn(dict(path=str(path), absent=reason), row['maintenance']['worktrees'])
                    else:
                        self.assert_stops(['%s: unreadable (%s)' % (path, reason)])
                finally:
                    subprocess.run(['git', '-C', str(self.main), 'worktree', 'unlock', str(path)], capture_output=True)
                    for leftover in (path, path.with_name(path.name + '-moved')):
                        shutil.rmtree(leftover, ignore_errors=True)
                    self.git(self.main, 'worktree', 'prune')
                self.assert_passes()
        self.assertEqual(gate_core.scratch_worktrees(self.e), sorted(str(self.root / ('ep-gate-own-%d' % index)) for index in (5, 6)))

    def test_a_vanished_directory_is_absent_only_at_a_recorded_scratch_path_and_the_judge_rechecks_it(self):
        common, vanished = gate_core.common_dir(self.main), str(self.root / 'vanished')
        self.assertEqual(gate_core.worktree_maintenance(dict(worktree=vanished), common), dict(path=vanished, unreadable='directory gone'))
        self.assertEqual(gate_core.worktree_maintenance(dict(worktree=vanished), common, [vanished]), dict(path=vanished, absent='directory gone'))
        row, _ = self.observed()
        claimed = {**row['maintenance'], 'worktrees': [*row['maintenance']['worktrees'], dict(path=vanished, absent='directory gone')]}
        self.assertEqual(gate_core.maintenance_refusals(claimed), ['%s: unreadable (directory gone)' % vanished])
        self.assertEqual(gate_core.maintenance_refusals({**claimed, 'scratch': [vanished]}), [])

    def test_the_scratch_record_is_read_as_absolute_realpaths(self):
        self.assertEqual(gate_core.scratch_worktrees(self.e), [])
        (self.root / 'link').symlink_to(self.root)
        (self.e / gate_core.SCRATCH_RECORD).write_text('%s/link/ep-gate-a\nrelative/ep-gate-b\n\n%s/ep-gate-c\n' % (self.root, self.root))
        self.assertEqual(gate_core.scratch_worktrees(self.e), [str(self.root / 'ep-gate-a'), str(self.root / 'ep-gate-c')])
        with self.assertRaises(subprocess.CalledProcessError):
            subprocess.run(['bash', '-c', 'here=$1; export MAIN=$2 GATE_SCRATCH_WORKTREES=$3; . "$here/paths.sh"; record_scratch_worktree relative/x',
                            'record', str(HERE), str(self.main), str(self.e / gate_core.SCRATCH_RECORD)], check=True, capture_output=True)

    def test_a_scratch_checkout_recorded_and_created_during_an_observation_is_still_the_gates_own(self):
        """Spec r4: the queue records its scratch path and starts `git worktree add` while an observation runs,
        between the moments the old code read the record and listed the worktrees. The record is now read after
        the list, so the entry, still mid-creation, is recognised. A foreign entry created the same way refuses."""
        real = gate_core.git_run
        for name, recorded in (('ep-gate-own-interleaved', True), ('worker-interleaved', False)):
            with self.subTest(worktree=name):
                path = self.root / name
                def git_run(root, *args, path=path, recorded=recorded):
                    if args[:2] == ('worktree', 'list') and not path.exists():
                        if recorded:
                            self.record_scratch(path)
                        self.git(self.main, 'worktree', 'add', '-q', '--detach', str(path), self.base)
                        self.git(self.main, 'worktree', 'lock', '--reason', 'initializing', str(path))
                        (path / '.git').write_text('gitdir: %s/not-yet\n' % self.root)
                    return real(root, *args)
                with patch.object(gate_core, 'git_run', git_run):
                    row, bad = self.observed()
                reason = 'locked and not yet a worktree of MAIN: initializing'
                if recorded:
                    self.assertEqual(bad, [])
                    self.assertIn(dict(path=str(path), absent=reason), row['maintenance']['worktrees'])
                    self.assertIn(str(path), row['maintenance']['scratch'])
                else:
                    self.assertEqual(bad, [dict(automaticMaintenance='%s: unreadable (%s)' % (path, reason))])
                self.git(self.main, 'worktree', 'unlock', str(path))
                shutil.rmtree(path)
                self.git(self.main, 'worktree', 'prune')

    def test_both_queue_scripts_record_their_scratch_checkout_before_creating_it(self):
        for name in ('triage-failures.sh', 'host-audits.sh'):
            with self.subTest(name):
                lines = (HERE / name).read_text().splitlines()
                reserved = next(index for index, line in enumerate(lines) if line.startswith('gate=$(mktemp -d '))
                recorded = lines.index('record_scratch_worktree "$gate" || exit 1')
                created = next(index for index, line in enumerate(lines) if 'worktree add' in line and '"$gate"' in line)
                self.assertLess(reserved, recorded)
                self.assertLess(recorded, created)
                self.assertFalse([line for line in lines[recorded + 1:created] if line.strip()], 'nothing runs between them')

    def test_a_missing_or_malformed_maintenance_reading_is_a_stop(self):
        row, _ = self.observed()
        good = row['maintenance']
        first = good['worktrees'][0]
        for reading in (None, 'off', {}, {**good, 'worktrees': None}, {**good, 'worktrees': []}, {**good, 'worktrees': ['main']},
                        {k: v for k, v in good.items() if k != 'main'}, {**good, 'main': '/elsewhere'},
                        {**good, 'worktrees': [{**first, 'gc.auto': '0'}, *good['worktrees'][1:]]},
                        {**good, 'worktrees': [{k: v for k, v in first.items() if k != 'maintenance.auto'}, *good['worktrees'][1:]]},
                        {**good, 'worktreeListError': 'fatal: not a git repository'},
                        {**good, 'scheduled': None}, {**good, 'scheduled': {**good['scheduled'], 'timers': None}},
                        {k: v for k, v in good.items() if k != 'scheduled'}):
            with self.subTest(reading=reading), patch.object(monitor, 'guard_violations', return_value=[]):
                shaped = {**row, 'maintenance': reading} if reading is not None else {k: v for k, v in row.items() if k != 'maintenance'}
                bad = monitor.violations(self.v, self.s, self.d, self.base_row, shaped, monitor.ArchiveLedger())
                self.assertTrue(bad and all('automaticMaintenance' in item for item in bad), bad)

    def test_another_session_in_the_gates_worktree_still_stops_the_gate(self):
        """The ci-shards r2 identity stop: the observer row and the integrity worker's identity check."""
        import gate_core
        gate_core.check_identity(self.v, self.d['SQUASHED'], allow_landed=True)
        (self.wt / 'scratch.txt').write_text('another session\n')
        row, bad = self.observed()
        self.assertEqual([next(iter(item)) for item in bad], ['unexpectedIdentity'])
        with self.assertRaisesRegex(RuntimeError, 'Candidate changed/dirty'):
            gate_core.check_identity(self.v, self.d['SQUASHED'], allow_landed=True)
        (self.wt / 'scratch.txt').unlink()
        self.git(self.wt, 'checkout', '-q', '--detach', self.d['SQUASHED'])
        row, bad = self.observed()
        self.assertEqual(bad, [], 'a detached checkout of the same commit leaves the row unchanged')
        # The integrity worker's identity read fails on a detached HEAD (no branch), so the pass fails closed.
        with self.assertRaises(subprocess.CalledProcessError):
            gate_core.check_identity(self.v, self.d['SQUASHED'], allow_landed=True)
        self.git(self.wt, 'checkout', '-q', 't3/gate')
        moved = self.commit(self.wt, 'another-session')
        row, bad = self.observed()
        self.assertEqual(sorted(next(iter(item)) for item in bad), ['protectedRef', 'unexpectedIdentity'])
        self.assertIn(dict(protectedRef='refs/heads/t3/gate', before=self.d['SQUASHED'], after=moved), bad)


if __name__ == '__main__':
    unittest.main()
