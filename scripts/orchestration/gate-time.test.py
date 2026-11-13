"""Gate time fixtures (gate_time.py; owner rule 2026-11-08, gate-time-check).

The CI part comes from a run's job list as `gh run view <id> --attempt <n> --json jobs` prints it; every test
passes that list in, so none reads GitHub. The job lists are the shape of run 42437482488 (host-audits-receipt r1).
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import gate_time  # noqa: E402

RUNNER = dict(provider='github-actions', repository='EverythingPath/EverythingPath', runId=42437482488, attempt=1,
              workflow='CI', job='remote-checks', url='https://github.com/EverythingPath/EverythingPath/actions/runs/42437482488')


def job(name, started, completed, conclusion='success'):
    return dict(name=name, status='completed', conclusion=conclusion, startedAt=started, completedAt=completed)


# Run 42437482488's jobs, abridged: the longest gate job is remote-shard (2) at 620 s; the assembly ran 40 s after it.
JOBS = [job('remote-static (workflow)', '2026-11-08T02:11:51Z', '2026-11-08T02:17:48Z'),
        job('remote-static (checks)', '2026-11-08T02:11:51Z', '2026-11-08T02:17:31Z'),
        job('remote-shard (2)', '2026-11-08T02:11:51Z', '2026-11-08T02:22:11Z'),
        job('remote-shard (1)', '2026-11-08T02:11:51Z', '2026-11-08T02:12:53Z'),
        job('wip-static', '2026-11-08T02:11:50Z', '2026-11-08T02:11:49Z', 'skipped'),
        job('remote-checks', '2026-11-08T02:11:51Z', '2026-11-08T02:22:53Z')]
STAGES = [dict(name='identity', seconds=0.2), dict(name='mode-prechecks', seconds=0.4), dict(name='gate-time', seconds=3.0),
          dict(name='prelaunch', seconds=92.0), dict(name='prepare', seconds=6.0), dict(name='admission-probe', seconds=1.0),
          dict(name='preclaim', seconds=1.0), dict(name='resume', seconds=364.4)]


class CiPartTest(unittest.TestCase):
    def test_the_ci_part_is_the_longest_job_without_the_assembly_or_skipped_jobs(self):
        part = gate_time.ci_part(RUNNER, JOBS)
        self.assertEqual((part['seconds'], part['job'], part['runId'], part['attempt']), (620, 'remote-shard (2)', 42437482488, 1))
        self.assertEqual(part['assemblyExcluded'], 'remote-checks')
        self.assertEqual(part['url'], RUNNER['url'])

    def test_the_assembly_is_excluded_even_when_it_would_be_the_longest(self):
        jobs = [job('remote-shard (1)', '2026-11-08T02:00:00Z', '2026-11-08T02:05:00Z'),
                job('remote-checks', '2026-11-08T02:00:00Z', '2026-11-08T02:30:00Z')]
        self.assertEqual(gate_time.ci_part(RUNNER, jobs)['seconds'], 300)

    def test_a_run_whose_only_job_is_the_assembly_counts_it(self):
        # Before the shards (run 42205929901, cur619e r1) remote-checks ran the whole suite itself.
        jobs = [job('remote-checks', '2026-11-06T10:52:20Z', '2026-11-06T12:06:52Z'), job('checks', '2026-11-06T10:52:12Z', '2026-11-06T10:52:12Z', 'skipped')]
        part = gate_time.ci_part(RUNNER, jobs)
        self.assertEqual((part['seconds'], part['job'], part['assemblyExcluded']), (4472, 'remote-checks', None))

    def test_a_run_with_an_unfinished_or_untimed_job_is_unmeasurable(self):
        for jobs in ([dict(JOBS[0], status='in_progress')], [dict(JOBS[0], completedAt=None)], [JOBS[4]], []):
            with self.subTest(jobs=jobs), self.assertRaises(gate_time.Unmeasured):
                gate_time.ci_part(RUNNER, jobs)

    def test_the_github_read_names_the_run_attempt_and_repository(self):
        seen = []

        def run(argv, **options):
            seen.append(argv)
            return subprocess.CompletedProcess(argv, 0, json.dumps(dict(jobs=JOBS)), '')
        self.assertEqual(gate_time.github_jobs(RUNNER, gh='/usr/local/bin/gh', run=run), JOBS)
        self.assertEqual(seen, [['/usr/local/bin/gh', 'run', 'view', '42437482488', '--attempt', '1', '-R', 'EverythingPath/EverythingPath',
                                 '--json', 'jobs']])

    def test_a_failed_github_read_is_unmeasured(self):
        run = lambda argv, **options: subprocess.CompletedProcess(argv, 1, '', 'HTTP 502')
        with self.assertRaisesRegex(gate_time.Unmeasured, 'HTTP 502'):
            gate_time.github_jobs(RUNNER, gh='/usr/local/bin/gh', run=run)


class HostPartTest(unittest.TestCase):
    def test_the_host_part_leaves_out_prelaunch_the_admission_probe_and_the_measurement(self):
        self.assertEqual(gate_time.host_seconds(STAGES), 372.0)

    def test_a_stage_still_running_has_no_seconds_yet(self):
        self.assertEqual(gate_time.host_seconds([dict(name='prepare', seconds=6.0), dict(name='resume')]), 6.0)


class Results(unittest.TestCase):
    """A run directory of published gate results, written as gate-run.py writes them."""

    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'))
        self.r = Path(self.scratch.name)
        self.read, self.ci = [], {}

    def tearDown(self):
        self.scratch.cleanup()

    def jobs(self, runner):
        self.read.append(runner['runId'])
        seconds = self.ci[runner['runId']]
        return [job('remote-shard (1)', '2026-11-08T02:00:00Z', '2026-11-08T02:%02d:%02dZ' % divmod(seconds, 60)),
                job('remote-checks', '2026-11-08T02:00:00Z', '2026-11-08T02:59:00Z')]

    def old(self, name, ended, host, ci=None, kind='code', source='remote+host-audits', verdict='landed', unit_wait=None, stage_wait=None):
        """A result from before gate-time-check: stage seconds and, under remote checks, its gate.json and manifest, plus
        the gate unit's log and the queue's stage logs it names (cur-land.sh), with an optional wait line in either."""
        logs = self.r / 'logs'
        logs.mkdir(exist_ok=True)
        unit = logs / ('bounded-%s-gate-r1-20261107-100000-abcdef.log' % name)
        unit.write_text('took resource.lock\n%slogs: logs/%s-20261107-100001-*.log\nall green\n' % (unit_wait + '\n' if unit_wait else '', name))
        (logs / ('%s-20261107-100001-host-audits.log' % name)).write_text('host-audits: clean checkout\n%s' % (stage_wait + '\n' if stage_wait else ''))
        config = self.r / (name + '-inputs/gate.json')
        config.parent.mkdir()
        body = dict(kind=kind)
        if ci is not None:
            run = 40000000000 + len(self.ci)
            self.ci[run] = ci
            manifest = self.r / (name + '-manifest.json')
            manifest.write_text(json.dumps(dict(runner=dict(RUNNER, runId=run))))
            body['remoteChecks'] = dict(path=str(manifest), sha256='0' * 64, mode='replace')
        config.write_text(json.dumps(body))
        self.write(name, dict(verdict=verdict, kind=kind, label=name, endedAt=ended, suite=dict(source=source),
                              gateConfig=dict(path=str(config), sha256='0' * 64), invocation=dict(log=str(unit)),
                              stages=[dict(name='prelaunch', seconds=500.0), dict(name='prepare', seconds=10.0), dict(name='resume', seconds=host - 10.0)]))

    def new(self, name, ended, total, mode='replace', ci=600, verdict='landed', **fields):
        """A result with gate-time-check's own fields, as gate-run.py records them: no wait in its resume stage."""
        host = dict(seconds=total - (ci or 0), excludedStages=list(gate_time.EXCLUDED_STAGES), waits=[], waitSeconds=0)
        self.write(name, dict(verdict=verdict, kind='code', label=name, endedAt=ended, suite=dict(source='remote+host-audits'), stages=[],
                              gateTime=dict(dict(mode=mode, ci=dict(seconds=ci) if ci is not None else None, host=host, total=total,
                                                 totalLowerBound=False), **fields)))

    def lower(self, name, ended, host, ci, waits=()):
        """A gate whose CI part was unreadable: its host part alone, marked totalLowerBound, plus its gate.json and manifest."""
        self.old(name, ended, host=host + sum(seconds for _, seconds in waits), ci=ci)
        result = json.loads((self.r / (name + '-gate-r1-result.json')).read_text())
        rows = [dict(label=label, seconds=seconds) for label, seconds in waits]
        result['gateTime'] = dict(mode='replace', ci=dict(unavailable='HTTP 502'), total=host, totalLowerBound=True,
                                  host=dict(seconds=host, excludedStages=list(gate_time.EXCLUDED_STAGES), waits=rows,
                                            waitSeconds=sum(row['seconds'] for row in rows)))
        self.write(name, result)

    def write(self, name, value):
        (self.r / (name + '-gate-r1-result.json')).write_text(value if isinstance(value, str) else json.dumps(value))

    def edit(self, name, change):
        path = self.r / (name + '-gate-r1-result.json')
        value = json.loads(path.read_text())
        change(value)
        path.write_text(json.dumps(value))

    def land(self, base):
        """The total check just before land.sh on this baseline, for a gate of 600 s CI and 90319 s host."""
        path, claim, ledger = self.r / 'gate-time.json', self.r / 'submission-claim.json', self.r / 'gate-waits.tsv'
        claim.write_text(json.dumps(dict(at='1970-01-01T00:00:05+00:00')))
        ledger.write_text('started\t5.0\n')
        path.write_text(json.dumps(dict(version=2, mode='replace', ci=dict(seconds=600), hostBefore=20.0, resumeStartedAt=9700.0,
                                        claim=str(claim), waits=str(ledger), exempt=None,
                                        baseline={key: base.get(key) for key in ('median', 'trigger', 'reason')})))
        return gate_time.land_check(path, now=lambda: 99999.0)


def drop(*keys):
    def change(value):
        target = value
        for key in keys[:-1]:
            target = target[key]
        del target[keys[-1]]
    return change


def put(value, *keys):
    def change(result):
        target = result
        for key in keys[:-1]:
            target = target[key]
        target[keys[-1]] = value
    return change


class BaselineTest(Results):
    def test_five_new_format_results_give_the_baseline(self):
        self.new('c', '2026-11-07T12:00:00+00:00', total=1400)
        self.new('d', '2026-11-07T13:00:00+00:00', total=900)
        self.new('e', '2026-11-07T14:00:00+00:00', total=1000)
        self.new('f', '2026-11-07T15:00:00+00:00', total=1200)
        self.new('g', '2026-11-07T16:00:00+00:00', total=1600, ci=1100)
        # Not among the last five landed replace gates: never read, whatever they hold.
        self.old('sixth', '2026-11-07T10:00:00+00:00', host=400, ci=1000, unit_wait='waiting for heavy.lock')
        (self.r / 'sixth-manifest.json').unlink()
        self.old('stopped', '2026-11-07T17:30:00+00:00', host=10, ci=10, verdict='stopped')
        self.write('preflight', dict(verdict='stopped', kind=None, endedAt=None))  # the real stopped-before-identity shape
        self.old('light', '2026-11-07T17:40:00+00:00', host=20, source='light lane: no suite')
        self.old('curation', '2026-11-07T17:50:00+00:00', host=30, ci=30, kind='curation')
        self.new('local', 'not a time', total=50, mode='local')
        base = gate_time.baseline(self.r, 'replace', self.jobs)
        self.assertEqual([gate['label'] for gate in base['gates']], ['g', 'f', 'e', 'd', 'c'])
        self.assertEqual([gate['total'] for gate in base['gates']], [1600, 1200, 1000, 900, 1400])
        self.assertEqual((base['median'], base['trigger'], base['unreadable']), (dict(total=1200, ci=600, host=500), 1560, []))
        self.assertEqual(self.read, [], 'recorded totals read no GitHub run')
        self.assertEqual(self.land(base), (1, 'gate-time refused: gate time 90919 s is 7476.6% over the 1200 s median of replace'))

    def test_a_lower_bound_total_is_its_recorded_host_part_plus_its_github_run(self):
        # A gate whose CI part was unreadable recorded its host part alone (without its 700 s launch wait); a later
        # baseline reads its run again.
        for index in range(4):
            self.new('g%d' % index, '2026-11-07T1%d:00:00+00:00' % index, total=1000)
        self.lower('outage', '2026-11-07T20:00:00+00:00', host=400, ci=900, waits=[(gate_time.LAUNCH, 700.0)])
        base = gate_time.baseline(self.r, 'replace', self.jobs)
        self.assertEqual((base['gates'][0]['label'], base['gates'][0]['total'], base['gates'][0]['ci'], base['gates'][0]['host']),
                         ('outage', 1300, 900, 400))
        self.assertEqual(base['gates'][0]['source'], 'gateTime host part + GitHub run 40000000000')
        self.assertEqual(base['median']['total'], 1000)

    def test_every_past_result_the_rule_cannot_read_makes_the_baseline_unavailable_and_never_refuses(self):
        """The full input family: each way one of the last five landed results, or a result whose mode or landing
        order cannot be told, fails to give a wait-free gate time. Four 2000 s gates and an older 1000 s sixth sit
        beside it; the sixth never takes its place, and no case refuses a 90919 s gate."""
        def broken_github(runner):
            raise gate_time.Unmeasured('gh run view %s exited 1: HTTP 502' % runner['runId'])

        def legacy(**waits):
            return lambda: self.old('newest', NEWEST, host=400, ci=1000, **waits)

        def legacy_without_logs(*names):
            def write():
                self.old('newest', NEWEST, host=400, ci=1000)
                for path in (self.r / 'logs').glob('*newest*'):
                    if not names or any(name in path.name for name in names):
                        path.unlink()
            return write

        def edited(*changes):
            def write():
                self.new('newest', NEWEST, total=1000)
                for change in changes:
                    self.edit('newest', change)
            return write

        def lower(*changes):
            def write():
                self.lower('newest', NEWEST, host=400, ci=900)
                for change in changes:
                    self.edit('newest', change)
            return write

        NEWEST = '2026-11-07T20:00:00+00:00'
        cases = [
            # discovery: a result whose verdict, mode or landing order cannot be read could be any of the last five
            ('truncated', lambda: self.write('newest', '{"verdict": "landed", "kind"'), 'unreadable: '),
            ('not utf-8', lambda: (self.r / 'newest-gate-r1-result.json').write_bytes(b'\xff\xfe{}'), 'unreadable: '),
            ('not an object', lambda: self.write('newest', '[]'), 'not a JSON object'),
            ('no verdict', edited(drop('verdict')), 'no verdict'),
            ('no known mode', edited(drop('gateTime'), put('unavailable', 'suite', 'source')), 'landed, of no known mode'),
            ('a suite that is not an object', edited(drop('gateTime'), put('remote', 'suite')), 'landed, of no known mode'),
            ('no endedAt', edited(drop('endedAt')), 'landed with no landing time'),
            ('malformed endedAt', edited(put('yesterday', 'endedAt')), 'landed with no landing time'),
            ('endedAt without a zone', edited(put('2026-11-07T20:00:00', 'endedAt')), 'landed with no landing time'),
            ('endedAt not a string', edited(put(20261107, 'endedAt')), 'landed with no landing time'),
            # gate-time fields
            ('gate time not recorded', edited(put(dict(unavailable='gate-time record failed'), 'gateTime')), 'its gate time was not recorded: gate-time record failed'),
            ('gateTime not an object', edited(put('1000', 'gateTime')), 'it has no gate-time fields'),
            ('no total', edited(drop('gateTime', 'total')), 'its gateTime lacks total'),
            ('total not a number', edited(put('1000', 'gateTime', 'total')), 'its total is not a number of seconds'),
            ('negative total', edited(put(-1, 'gateTime', 'total')), 'its total is not a number of seconds'),
            ('infinite total', edited(put(float('inf'), 'gateTime', 'total')), 'its total is not a number of seconds'),
            ('no totalLowerBound', edited(drop('gateTime', 'totalLowerBound')), 'its gateTime lacks totalLowerBound'),
            ('no host part', edited(drop('gateTime', 'host')), 'its gateTime lacks host'),
            ('host seconds missing', edited(drop('gateTime', 'host', 'seconds')), 'its host part has no seconds'),
            ('no ci field', edited(drop('gateTime', 'ci')), 'its gateTime lacks ci'),
            ('ci without seconds', edited(put(dict(job='remote-shard (1)'), 'gateTime', 'ci')), 'its CI part has no seconds'),
            ('unavailable ci without the lower-bound mark', edited(put(dict(unavailable='HTTP 502'), 'gateTime', 'ci')), 'its CI part has no seconds'),
            # wait evidence
            ('waits not recorded', edited(put(dict(unavailable='no wait ledger'), 'gateTime', 'host', 'waits')), 'its waits were not recorded: no wait ledger'),
            ('no wait record', edited(drop('gateTime', 'host', 'waits')), 'its host part has no wait record'),
            ('a wait without seconds', edited(put([dict(label='heavy.lock')], 'gateTime', 'host', 'waits')), 'its host part has an unreadable wait'),
            ('a negative wait', edited(put([dict(label='heavy.lock', seconds=-5)], 'gateTime', 'host', 'waits')), 'its host part has an unreadable wait'),
            # legacy results: stage seconds with untimed waits, whatever their logs show or lack
            ('legacy with clean logs', legacy(), 'it has no gate-time fields (a result from before gate-time-check)'),
            ('legacy with a unit wait', legacy(unit_wait='waiting for resource.lock (BOUNDED_WAIT=1)'), 'it has no gate-time fields (a result from before gate-time-check)'),
            ('legacy with a stage wait', legacy(stage_wait='host-audits: waiting for heavy.lock'), 'it has no gate-time fields (a result from before gate-time-check)'),
            ('legacy without its stage logs', legacy_without_logs('host-audits'), 'it has no gate-time fields (a result from before gate-time-check)'),
            ('legacy without any log', legacy_without_logs(), 'it has no gate-time fields (a result from before gate-time-check)'),
            # a lower-bound total whose CI part cannot be read again
            ('lower bound without its manifest', lower(), 'newest-manifest.json'),
            ('lower bound without its gate.json', lower(put(dict(path=os.devnull + '/gone.json'), 'gateConfig')), 'gone.json'),
            ('lower bound without remote checks', lower(), "its lower-bound total's gate.json names no remote checks"),
            ('lower bound whose run GitHub cannot read', lower(), 'HTTP 502'),
        ]
        for name, write, why in cases:
            with self.subTest(case=name):
                self.tearDown(); self.setUp()
                self.new('sixth', '2026-11-07T09:00:00+00:00', total=1000)
                for index in range(4):
                    self.new('g%d' % index, '2026-11-07T1%d:00:00+00:00' % index, total=2000)
                write()
                if name == 'lower bound without its manifest':
                    (self.r / 'newest-manifest.json').unlink()
                if name == 'lower bound without remote checks':
                    (self.r / 'newest-inputs/gate.json').write_text(json.dumps(dict(kind='code')))
                read = broken_github if 'GitHub' in name else self.jobs
                base = gate_time.baseline(self.r, 'replace', read)
                path = str(self.r / 'newest-gate-r1-result.json')
                self.assertIsNone(base['median'])
                self.assertIsNone(base['trigger'])
                self.assertTrue(base['reason'].startswith('baseline unavailable (%s: ' % path), base['reason'])
                self.assertIn(why, base['unreadable'][0]['reason'])
                self.assertEqual([row['result'] for row in base['unreadable']], [path])
                self.assertNotIn('sixth', [gate['label'] for gate in base['gates']])
                code, line = self.land(base)
                self.assertEqual(code, 0, line)
                self.assertEqual(line, 'gate-time no baseline: 90919 s (CI 600 s + host 90319 s, waits 0 s left out); ' + base['reason'])
        with self.subTest(case='fewer than five'):
            self.tearDown(); self.setUp()
            for index in range(4):
                self.new('g%d' % index, '2026-11-07T1%d:00:00+00:00' % index, total=2000)
            base = gate_time.baseline(self.r, 'replace', self.jobs)
            self.assertEqual((base['median'], base['trigger'], base['unreadable']), (None, None, []))
            self.assertEqual(base['reason'], 'no baseline: 4 landed replace gates, 5 needed')
            self.assertEqual(self.land(base), (0, 'gate-time no baseline: 90919 s (CI 600 s + host 90319 s, waits 0 s left out); '
                                                  'no baseline: 4 landed replace gates, 5 needed'))

    def test_a_baseline_that_cannot_be_built_is_unavailable_and_never_raises(self):
        # Whatever goes wrong while building it, the gate still runs: the baseline is unavailable with the reason.
        for index in range(5):
            self.new('g%d' % index, '2026-11-07T1%d:00:00+00:00' % index, total=1000)

        def failing(runner):
            raise RuntimeError('reader crashed')
        self.lower('outage', '2026-11-07T20:00:00+00:00', host=400, ci=900)
        base = gate_time.baseline(self.r, 'replace', failing)
        self.assertIsNone(base['median'])
        self.assertIn('reader crashed', base['reason'])
        with mock.patch.object(gate_time, 'landed', side_effect=MemoryError('no memory')):
            base = gate_time.baseline(self.r, 'replace', self.jobs)
        self.assertEqual((base['median'], base['reason']), (None, 'baseline unavailable (%s: no memory)' % self.r))

    def test_modes_come_from_the_new_field_or_the_suite_source_and_kind(self):
        cases = [(dict(gateTime=dict(mode='light')), 'light'), (dict(kind='curation', suite=dict(source='remote+host-audits')), 'curation'),
                 (dict(kind='code', suite=dict(source='remote+host-audits-receipt')), 'replace'),
                 (dict(kind='code', suite=dict(source='local+remote-compare')), 'local'), (dict(kind='code', suite=dict(source='local')), 'local'),
                 (dict(kind='code', suite=dict(source='light lane: no suite')), 'light'), (dict(kind='code', suite=dict(source='unavailable')), None)]
        for result, mode in cases:
            with self.subTest(result=result):
                self.assertEqual(gate_time.result_mode(result), mode)

    def test_a_mode_without_remote_checks_has_no_ci_median(self):
        for index in range(5):
            self.new('l%d' % index, '2026-11-07T1%d:00:00+00:00' % index, total=100 + index, mode='light', ci=None)
        base = gate_time.baseline(self.r, 'light', self.jobs)
        self.assertEqual(base['median'], dict(total=102, ci=None, host=102))


class JudgeTest(unittest.TestCase):
    def test_more_than_thirty_percent_over_the_median_triggers(self):
        self.assertEqual(gate_time.judge(1300, 1000), dict(seconds=1300, median=1000, percent=30.0, trigger=False))
        self.assertEqual(gate_time.judge(1301, 1000), dict(seconds=1301, median=1000, percent=30.1, trigger=True))
        self.assertEqual(gate_time.judge(700, 1000)['percent'], -30.0)

    def test_the_named_reason(self):
        self.assertEqual(gate_time.reason('replace', gate_time.judge(1950, 1496)),
                         'gate time 1950 s is 30.3% over the 1496 s median of replace')
        self.assertEqual(gate_time.reason('replace', gate_time.judge(1400, 1000), part='CI part'),
                         'gate time (CI part) 1400 s is 40.0% over the 1000 s median of replace')


class LandCheckTest(unittest.TestCase):
    """`gate_time.py land FILE`: the total check cur-land.sh runs just before land.sh."""

    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'))
        root = Path(self.scratch.name)
        self.path, self.claim, self.ledger = root / 'gate-time.json', root / 'submission-claim.json', root / 'gate-waits.tsv'

    def tearDown(self):
        self.scratch.cleanup()

    def check(self, now=10000.0, launch=0.0, waits=(), ledger=None, **fields):
        """Resume started at 9700; the submission claim 5 s later; the queue started `launch` s after the claim."""
        value = dict(version=2, mode='replace', ci=dict(seconds=600), hostBefore=20.0, resumeStartedAt=9700.0,
                     claim=str(self.claim), waits=str(self.ledger),
                     baseline=dict(median=dict(total=1000, ci=600, host=400), trigger=1300), exempt=None)
        value.update(fields)
        self.path.write_text(json.dumps(value))
        self.claim.write_text(json.dumps(dict(at=datetime.fromtimestamp(9705.0, timezone.utc).isoformat(), argv=[])))
        if ledger is None:
            ledger = 'started\t%.6f\n' % (9705.0 + launch) + ''.join('wait\t%s\t%.6f\n' % row for row in waits)
        self.ledger.write_text(ledger)
        return gate_time.land_check(self.path, now=lambda: now)

    def test_a_total_under_the_trigger_passes(self):
        code, line = self.check()
        self.assertEqual(code, 0)
        self.assertEqual(line, 'gate-time pass: 920 s (CI 600 s + host 320 s, waits 0 s left out) is 8.0% under the 1000 s median of replace')

    def test_a_total_over_the_trigger_refuses_with_the_named_reason(self):
        code, line = self.check(now=10400.0)
        self.assertEqual(code, 1)
        self.assertEqual(line, 'gate-time refused: gate time 1320 s is 32.0% over the 1000 s median of replace')

    def test_an_outside_cause_records_the_trigger_and_lands(self):
        code, line = self.check(now=10400.0, exempt=dict(reason='GitHub incident 2026-11-08'))
        self.assertEqual(code, 0)
        self.assertEqual(line, 'gate-time exempt: gate time 1320 s is 32.0% over the 1000 s median of replace; '
                               'outside cause (root): GitHub incident 2026-11-08')

    def test_an_unreadable_ci_part_judges_the_host_part_alone_as_a_lower_bound(self):
        code, line = self.check(ci=dict(unavailable='gh run view 1 exited 1: HTTP 502'))
        self.assertEqual((code, line), (0, 'gate-time pass: at least 320 s (CI unavailable + host 320 s, waits 0 s left out) is 68.0% under the 1000 s median of replace'))
        code, line = self.check(now=11100.0, ci=dict(unavailable='gh run view 1 exited 1: HTTP 502'))
        self.assertEqual((code, line), (1, 'gate-time refused: gate time 1420 s is 42.0% over the 1000 s median of replace'))

    def test_no_baseline_never_refuses(self):
        code, line = self.check(now=99999.0, baseline=dict(median=None, reason='no baseline: 2 landed replace gates, 5 needed'))
        self.assertEqual(code, 0)
        self.assertEqual(line, 'gate-time no baseline: 90919 s (CI 600 s + host 90319 s, waits 0 s left out); no baseline: 2 landed replace gates, 5 needed')

    def test_a_long_launch_or_lock_wait_is_left_out_and_does_not_refuse(self):
        # 1680 s since resume started: for 900 s of it the unit waited for its locks and memory, for 100 s the suite for heavy.lock.
        code, line = self.check(now=11380.0, launch=900.0, waits=[('heavy.lock', 100.0)])
        self.assertEqual((code, line), (0, 'gate-time pass: 1300 s (CI 600 s + host 700 s, waits 1000 s left out) is 30.0% over the 1000 s median of replace'))
        code, line = self.check(now=11380.0, launch=0.0, waits=[('heavy.lock', 100.0)])
        self.assertEqual((code, line), (1, 'gate-time refused: gate time 2200 s is 120.0% over the 1000 s median of replace'))

    def test_an_unreadable_wait_ledger_refuses(self):
        for ledger in ('', 'wait\theavy.lock\t1.0\n', 'started\t9705\nstarted\t9706\n', 'started\t9705\nwait\theavy.lock\n',
                       'started\t9705\nwait\theavy.lock\t-1\n', 'started\t9705\nslept\t1\n', 'started\tsoon\n', 'started\t9600\n'):
            with self.subTest(ledger=ledger):
                code, line = self.check(ledger=ledger)
                self.assertEqual(code, 1)
                self.assertTrue(line.startswith('gate-time refused: unreadable '), line)
        self.ledger.unlink()
        self.assertEqual(gate_time.land_check(self.path)[0], 1)

    def test_an_unreadable_file_refuses(self):
        self.path.write_text('{broken')
        code, line = gate_time.land_check(self.path)
        self.assertEqual(code, 1)
        self.assertTrue(line.startswith('gate-time refused: unreadable '), line)

    def test_the_cli_prints_the_line_and_exits_with_the_code(self):
        self.check(now=10400.0)
        run = subprocess.run([sys.executable, '-B', str(HERE / 'gate_time.py'), 'land', str(self.path)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 1)
        self.assertTrue(run.stdout.startswith('gate-time refused: gate time '), run.stdout)



class GateWaitTest(unittest.TestCase):
    """paths.sh `gate_wait <label> <command...>`: a blocking wait, recorded in the gate's wait ledger (LAND_GATE_WAITS)."""

    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'))
        self.ledger = Path(self.scratch.name) / 'gate-waits.tsv'

    def tearDown(self):
        self.scratch.cleanup()

    def gate_wait(self, *argv, ledger=True):
        env = {key: value for key, value in os.environ.items() if key != 'LAND_GATE_WAITS'}
        env.update(MAIN=str(HERE.parent.parent), EP_ORCH=self.scratch.name, **({'LAND_GATE_WAITS': str(self.ledger)} if ledger else {}))
        return subprocess.run(['bash', '-c', 'here=$1; . "$here/paths.sh"; gate_wait "${@:2}"', 'gate-wait', str(HERE), *argv],
                              env=env, capture_output=True, text=True)

    def test_a_wait_is_recorded_with_its_label_and_seconds_and_keeps_its_status(self):
        run = self.gate_wait('heavy.lock', 'bash', '-c', 'sleep 0.3; exit 3')
        self.assertEqual(run.returncode, 3, run.stderr)
        kind, label, seconds = self.ledger.read_text().strip().split('\t')
        self.assertEqual((kind, label), ('wait', 'heavy.lock'))
        self.assertGreaterEqual(float(seconds), 0.3)
        self.assertLess(float(seconds), 5)

    def test_outside_a_gate_it_only_runs_the_command(self):
        run = self.gate_wait('heavy.lock', 'true', ledger=False)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertFalse(self.ledger.exists())

    def test_a_wait_it_cannot_record_stops_the_script(self):
        self.ledger.mkdir()
        run = self.gate_wait('heavy.lock', 'true')
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("can't record the heavy.lock wait in " + str(self.ledger), run.stderr)


# Every blocking wait in the orchestration scripts, by file: the ones a gate's queue can reach go through gate_wait
# (paths.sh), so the gate's own time leaves them out. The rest never run inside a gate's queue, or are not waits.
QUEUE_WAITS = {'land-queue.sh': ['land.lock'], 'cur-land.sh': ['land.lock'], 'host-audits.sh': ['heavy.lock'],
               'triage-failures.sh': ['heavy.lock'], 'cur-prep.sh': ['memory'], 'land.sh': ['landing observation lock']}
NOT_QUEUE_WAITS = {
    'admission.sh': "the ledger's mutex, held for one read or write; escalate's own loop is timed by its caller (cur-prep.sh)",
    'wip-ci.sh': 'the WIP CI run slot: a worker command, never inside a gate',
    'gate-run.py': "the attempt's publication lock, taken after every stage when the driver publishes its result",
}
GATE_WAIT = re.compile(r'\bgate_wait (?:"([^"]+)"|\'([^\']+)\'|(\S+)) ')


def gate_wait_label(line):
    """The label of the gate_wait call on a line, or None when the wait does not go through gate_wait."""
    match = GATE_WAIT.search(line)
    return next(group for group in match.groups() if group) if match else None


SHELL_WAIT = re.compile(r'\bflock\s+(?!-n\b|-u\b)|\badmission\.sh\}?"?\s+escalate\b')
PYTHON_WAIT = re.compile(r'fcntl\.flock\((?![^)]*LOCK_NB)')


class QueueWaitCorpusTest(unittest.TestCase):
    """The full corpus of orchestration scripts (every *.sh and *.py here but the tests): no blocking wait a gate's
    queue reaches is left untimed. A new one fails here until it goes through gate_wait or is named as no queue wait."""

    def waits(self):
        found = {}
        for path in sorted(HERE.glob('*.sh')) + sorted(HERE.glob('*.py')):
            if '.test.' in path.name:
                continue
            pattern = SHELL_WAIT if path.suffix == '.sh' else PYTHON_WAIT
            for line in path.read_text().splitlines():
                if not line.lstrip().startswith('#') and pattern.search(line):
                    found.setdefault(path.name, []).append(line.strip())
        return found

    def test_every_queue_wait_goes_through_gate_wait_and_no_other_script_waits(self):
        found = self.waits()
        self.assertEqual(set(found), set(QUEUE_WAITS) | set(NOT_QUEUE_WAITS))
        for name, labels in QUEUE_WAITS.items():
            with self.subTest(script=name):
                self.assertEqual([gate_wait_label(line) for line in found[name]], labels, found[name])

    def test_the_corpus_scan_sees_each_form_of_wait(self):
        for line in ('flock 9', 'flock "$admission_mutex"', 'flock -w 5 9', 'bash "${BOUNDED_ADMISSION_LIB:-$here/admission.sh}" escalate "$id"'):
            with self.subTest(line=line):
                self.assertTrue(SHELL_WAIT.search(line))
        for line in ('flock -n 9', 'flock -u 9'):
            with self.subTest(line=line):
                self.assertFalse(SHELL_WAIT.search(line))
        self.assertTrue(PYTHON_WAIT.search('fcntl.flock(stream, fcntl.LOCK_EX)'))
        self.assertFalse(PYTHON_WAIT.search('fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)'))

if __name__ == '__main__':
    unittest.main()
