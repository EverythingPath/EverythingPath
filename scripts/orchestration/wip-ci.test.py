"""The WIP CI driver (wip_ci.py) and ci.yaml's wip-* jobs (speed-wip-ci W2).

plan on fixture checkouts and commits, shard and static with a stub pnpm, summarize on two real Vitest shard reports
(fixtures/wip-ci, one shard failing) and on reports built from them past the output caps. No GitHub run or network.
"""
import contextlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import wip_ci

FIXTURES = HERE / 'fixtures' / 'wip-ci'
# The checkout the fixture reports name: a GitHub runner's.
RUNNER_ROOT = '/home/runner/work/everythingpath/everythingpath'
# A commit with no author or committer configured: CI's static job has no git identity.
IDENTITY = dict(GIT_AUTHOR_NAME='fixture', GIT_AUTHOR_EMAIL='fixture@example.invalid', GIT_COMMITTER_NAME='fixture',
                GIT_COMMITTER_EMAIL='fixture@example.invalid')

PNPM_STUB = '''#!/bin/sh
# Stub pnpm: records its argv and environment; `test` copies report-<i>.json for --shard=i/N to --outputFile.json and
# exits with exit-<i>'s code (0 without it); `-s typecheck` and `-s lint` print lines and exit with their baked-in codes.
printf '%%s\\n' "$*" >> %(root)s/calls.log
env > %(root)s/env-"$1".log
case "$1" in
  test) shard=
        for arg; do case "$arg" in --shard=*) shard=${arg#--shard=}; shard=${shard%%%%/*} ;; esac; done
        for arg; do case "$arg" in
          --outputFile.json=*) [ -f %(root)s/report-"$shard".json ] && cp %(root)s/report-"$shard".json "${arg#--outputFile.json=}" ;;
        esac; done
        echo "fixture shard $shard"
        [ -f %(root)s/exit-"$shard" ] && exit "$(cat %(root)s/exit-"$shard")"
        exit 0 ;;
  -s) i=1; while [ $i -le %(lines)d ]; do echo "$2 line $i"; i=$((i + 1)); done
      [ "$2" = typecheck ] && exit %(typecheck)d
      [ "$2" = lint ] && exit %(lint)d ;;
esac
exit 99
'''


def fixture_report(index):
    return json.loads((FIXTURES / ('shard-%d.json' % index)).read_text())


def scratch(test):
    directory = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'))
    test.addCleanup(directory.cleanup)
    return Path(directory.name)


def checkout(root, browser=()):
    """A checkout's test layout: test directories, a fixtures directory with no tests, a symlinked directory, a test
    file directly under tests/ and the shard weights' browser files."""
    root.mkdir()
    for path in ('tests/catalog/a.test.ts', 'tests/rules/sub/b.test.ts', 'tests/rules/c.test.tsx', 'tests/fixtures/data.json',
                 'tests/top.test.ts', 'src/x.test.ts', 'tests/.hidden/d.test.ts'):
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_text('')
    (root / 'tests/link').symlink_to('catalog')
    (root / 'tests/shard-weights.json').write_text(json.dumps(dict(kind='shard-weights-v1', browserFiles=list(browser))))
    return root


def git(root, *argv):
    return subprocess.run(['git', *argv], cwd=root, capture_output=True, text=True, check=True,
                          env={**os.environ, **IDENTITY}).stdout.strip()


def commit(root, message):
    """The checkout as one parentless commit with this message, as wip-ci.sh pushes it."""
    git(root, 'init', '-q')
    git(root, 'add', '-A')
    git(root, 'commit', '-q', '--allow-empty', '-m', message)
    return git(root, 'rev-parse', 'HEAD')


class ScopeTest(unittest.TestCase):
    def setUp(self):
        self.root = checkout(scratch(self) / 'checkout', browser=['tests/rules/sub/b.test.ts'])

    def scope(self, value):
        return wip_ci.parse_scope(value, self.root)

    def test_suite_alone_with_or_without_static(self):
        self.assertEqual(self.scope('suite'), dict(scope='suite', static=False, chromium=True))
        self.assertEqual(self.scope('suite static=yes'), dict(scope='suite', static=True, chromium=True))
        self.assertEqual(self.scope('  static=no   suite '), dict(scope='suite', static=False, chromium=True))

    def test_test_directories_that_exist(self):
        self.assertEqual(self.scope('tests/catalog static=yes'), dict(scope=['tests/catalog'], static=True, chromium=False))
        # A trailing slash names the same directory; the browser file under tests/rules/sub needs Chromium.
        self.assertEqual(self.scope('tests/catalog/ tests/rules/sub'),
                         dict(scope=['tests/catalog', 'tests/rules/sub'], static=False, chromium=True))
        self.assertEqual(self.scope('tests/rules')['scope'], ['tests/rules'])

    def test_each_bad_scope_is_refused(self):
        refusals = {
            '': 'empty',
            'static=yes': 'empty',
            'suite tests/catalog': 'suite stands alone',
            'suite suite': 'suite stands alone',
            'tests/catalog tests/catalog/': 'named twice',
            'tests/rules tests/rules/sub': 'inside tests/rules',
            'tests/rules/sub tests/rules': 'inside tests/rules',
            'suite static=maybe': 'static=yes or static=no',
            'suite static=yes static=no': 'static named twice',
            'catalog': 'not an allowlisted',
            'src': 'not an allowlisted',
            'tests': 'not an allowlisted',
            'tests/': 'not an allowlisted',
            '/tmp/tests/catalog': 'not an allowlisted',
            'tests/../src': 'not an allowlisted',
            'tests/./catalog': 'not an allowlisted',
            'tests/.hidden': 'not an allowlisted',
            'tests//catalog': 'not an allowlisted',
            '--config=evil.ts': 'not an allowlisted',
            'tests/catalog;true': 'not an allowlisted',
            'tests/catalog$(id)': 'not an allowlisted',
            'tests/missing': 'does not exist',
            'tests/top.test.ts': 'not a directory',
            'tests/link': 'symlink',
            'tests/fixtures': 'holds no test files',
        }
        for value, reason in refusals.items():
            with self.subTest(scope=value):
                with self.assertRaises(wip_ci.ScopeRefused) as refused:
                    self.scope(value)
                self.assertIn(reason, str(refused.exception))

    def test_a_directory_reached_through_a_symlinked_parent_is_refused(self):
        (self.root / 'tests/outside').symlink_to(self.root / 'src')
        with self.assertRaises(wip_ci.ScopeRefused) as refused:
            self.scope('tests/outside')
        self.assertIn('symlink', str(refused.exception))
        (self.root / 'tests/via').symlink_to(self.root / 'tests/rules')
        with self.assertRaises(wip_ci.ScopeRefused) as refused:
            self.scope('tests/via/sub')
        self.assertIn('symlink', str(refused.exception))

    def test_the_vitest_argv_names_each_directory_with_a_trailing_slash(self):
        # Vitest's filters are substrings of the file path: tests/catalog alone would also run tests/catalogX.test.ts.
        report = '/run/part/report.json'
        self.assertEqual(wip_ci.vitest_argv(['tests/catalog', 'tests/rules/sub'], 3, 8, report),
                         ['pnpm', 'test', 'tests/catalog/', 'tests/rules/sub/', '--shard=3/8', '--reporter=dot', '--reporter=json',
                          '--outputFile.json=' + report, '--passWithNoTests'])
        self.assertEqual(wip_ci.vitest_argv('suite', 1, 8, report)[:3], ['pnpm', 'test', '--shard=1/8'])


class PlanTest(unittest.TestCase):
    def setUp(self):
        self.base = scratch(self)
        self.root = checkout(self.base / 'checkout')
        self.out = self.base / 'plan'
        self.output = self.base / 'github-output'

    def plan(self, message):
        self.commit = commit(self.root, message)
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()) as self.stderr:
            ok = wip_ci.plan(self.root, self.out, github_output=self.output)
        part = json.loads((self.out / 'plan.json').read_text())
        outputs = dict(line.split('=', 1) for line in self.output.read_text().splitlines())
        return ok, part, outputs

    def test_the_commit_trailers_give_the_plan_and_the_job_outputs(self):
        ok, part, outputs = self.plan('wip: task\n\nWip-Task: wip-ci-w2\nWip-Base: %s\nWip-Scope: tests/catalog static=yes\n' % ('a' * 40))
        self.assertTrue(ok)
        self.assertEqual(part['kind'], wip_ci.PLAN_KIND)
        self.assertEqual(part['plan'], dict(scope=['tests/catalog'], static=True, chromium=False))
        self.assertNotIn('refused', part)
        self.assertEqual(part['source']['commit'], self.commit)
        self.assertEqual(part['source']['tree'], git(self.root, 'rev-parse', 'HEAD^{tree}'))
        self.assertEqual(part['source']['trailers'], [['Wip-Task', 'wip-ci-w2'], ['Wip-Base', 'a' * 40],
                                                      ['Wip-Scope', 'tests/catalog static=yes']])
        self.assertEqual(outputs, dict(ok='true', static='true', chromium='false'))

    def test_a_missing_or_repeated_scope_trailer_is_refused_and_recorded(self):
        for message, reason in (('wip: task\n\nWip-Task: x\n', 'no Wip-Scope trailer'),
                                ('wip: task\n\nWip-Scope: suite\nWip-Scope: tests/catalog\n', 'more than one Wip-Scope'),
                                ('wip: task\n\nWip-Scope: tests/nowhere\n', 'does not exist')):
            with self.subTest(reason=reason):
                shutil.rmtree(self.out, ignore_errors=True)
                self.output.unlink(missing_ok=True)
                ok, part, outputs = self.plan(message)
                self.assertFalse(ok)
                self.assertIn(reason, part['refused'])
                self.assertIsNone(part['plan'])
                self.assertIn(reason, self.stderr.getvalue())
                self.assertEqual(outputs, dict(ok='false', static='false', chromium='false'))


class StubFixture(unittest.TestCase):
    """A checkout and a stub pnpm on PATH."""
    def setUp(self):
        self.base = scratch(self)
        self.root = checkout(self.base / 'checkout')
        self.bin = self.base / 'bin'
        self.bin.mkdir()
        self.stub()
        previous = os.environ['PATH']
        os.environ['PATH'] = str(self.bin) + os.pathsep + previous
        self.addCleanup(os.environ.__setitem__, 'PATH', previous)

    def stub(self, typecheck=0, lint=0, lines=3):
        (self.bin / 'pnpm').write_text(PNPM_STUB % dict(root=self.root, typecheck=typecheck, lint=lint, lines=lines))
        (self.bin / 'pnpm').chmod(0o755)

    def calls(self):
        return (self.root / 'calls.log').read_text().splitlines()

    def quietly(self, call, *args, **kwargs):
        with contextlib.redirect_stdout(io.StringIO()):
            return call(*args, **kwargs)


class ShardTest(StubFixture):
    def test_a_shard_runs_its_scope_and_records_its_exit_duration_and_report(self):
        commit(self.root, 'wip: task\n\nWip-Scope: tests/catalog\n')
        (self.root / 'report-2.json').write_text(json.dumps(fixture_report(2)))
        (self.root / 'exit-2').write_text('1')
        out = self.base / 'part-2'
        self.assertFalse(self.quietly(wip_ci.shard, self.root, out, 2, 8, parent={'PATH': os.environ['PATH'], 'HOME': '/home/x',
                                                                                    'GITHUB_TOKEN': 'leak', 'NODE_OPTIONS': '--x'}))
        part = json.loads((out / 'shard.json').read_text())
        self.assertEqual({key: part[key] for key in ('kind', 'index', 'total', 'exitCode', 'report', 'log', 'root')},
                         dict(kind=wip_ci.SHARD_KIND, index=2, total=8, exitCode=1, report='report.json', log='shard.log', root=str(self.root)))
        self.assertGreaterEqual(part['durationSeconds'], 0)
        self.assertEqual(part['argv'], wip_ci.vitest_argv(['tests/catalog'], 2, 8, str(out / 'report.json')))
        self.assertEqual(json.loads((out / 'report.json').read_text()), fixture_report(2))
        self.assertIn('fixture shard 2', (out / 'shard.log').read_text())
        env = dict(line.split('=', 1) for line in (self.root / 'env-test.log').read_text().splitlines() if '=' in line)
        self.assertEqual((env['CI'], env['VITEST_MAX_WORKERS'], env['TZ'], env['HOME']), ('true', '2', 'Europe/Stockholm', '/home/x'))
        self.assertNotIn('GITHUB_TOKEN', env)
        self.assertNotIn('NODE_OPTIONS', env)

    def test_the_commands_get_the_gates_pinned_environment(self):
        # The gate's values (remote_checks.ENVIRONMENT, ci.yaml's GATE_TZ), so a WIP result predicts the gate's.
        import remote_checks
        self.assertEqual(wip_ci.ENVIRONMENT, dict(remote_checks.ENVIRONMENT, TZ=load_yaml('.github/workflows/ci.yaml')['jobs']
                                                  ['remote-shard']['env']['GATE_TZ']))

    def test_a_green_shard_without_a_report_records_none(self):
        commit(self.root, 'wip: task\n\nWip-Scope: suite\n')
        out = self.base / 'part-1'
        self.assertTrue(self.quietly(wip_ci.shard, self.root, out, 1, 8))
        part = json.loads((out / 'shard.json').read_text())
        self.assertEqual((part['exitCode'], part['report']), (0, None))
        self.assertEqual(self.calls()[-1].split()[:2], ['test', '--shard=1/8'])

    def test_a_shard_refuses_a_bad_index_or_scope_before_running(self):
        commit(self.root, 'wip: task\n\nWip-Scope: tests/nowhere\n')
        with self.assertRaises(wip_ci.ScopeRefused):
            self.quietly(wip_ci.shard, self.root, self.base / 'part-x', 1, 8)
        with self.assertRaises(RuntimeError):
            self.quietly(wip_ci.shard, self.root, self.base / 'part-y', 9, 8)
        self.assertFalse((self.root / 'calls.log').exists())


class StaticTest(StubFixture):
    def test_typecheck_and_lint_both_run_and_a_failure_keeps_its_last_forty_lines(self):
        self.stub(lint=1, lines=60)
        out = self.base / 'static'
        self.assertFalse(self.quietly(wip_ci.static, self.root, out))
        self.assertEqual(self.calls(), ['-s typecheck', '-s lint'])
        part = json.loads((out / 'static.json').read_text())
        self.assertEqual(part['kind'], wip_ci.STATIC_KIND)
        typecheck, lint = part['commands']
        self.assertEqual((typecheck['name'], typecheck['exitCode'], typecheck['lines']), ('typecheck', 0, []))
        self.assertEqual((lint['name'], lint['argv'], lint['exitCode']), ('lint', ['pnpm', '-s', 'lint'], 1))
        self.assertEqual(lint['lines'], ['lint line %d' % index for index in range(21, 61)])
        self.assertEqual(len((out / 'lint.log').read_text().splitlines()), 60)

    def test_both_passing_is_green(self):
        self.assertTrue(self.quietly(wip_ci.static, self.root, self.base / 'static'))


SUCCESS = dict(plan='success', shard='success', static='skipped')
SOURCE = dict(commit='c' * 40, tree='d' * 40, trailers=[['Wip-Task', 'wip-ci-w2'], ['Wip-Base', 'b' * 40], ['Wip-Scope', 'suite']])
RUN = dict(repository='fixture/everythingpath', runId='4242', attempt='1', ref='refs/heads/wip/wip-ci-w2-20261107',
           url='https://github.com/fixture/everythingpath/actions/runs/4242')


class SummarizeTest(unittest.TestCase):
    """This attempt's downloaded parts as the wip-summary job sees them, from the real fixture shard reports."""
    def setUp(self):
        self.root = scratch(self)
        self.parts = self.root / 'parts'
        self.attempt = '1'

    def plan_part(self, plan=None, refused=None):
        part = self.parts / wip_ci.part_name('plan', self.attempt)
        part.mkdir(parents=True)
        (part / 'plan.json').write_text(json.dumps(dict(kind=wip_ci.PLAN_KIND, source=SOURCE,
                                                        plan=None if refused else plan or dict(scope='suite', static=False, chromium=True),
                                                        **({'refused': refused} if refused else {}))))

    def shard_part(self, index, report, exit_code=None, seconds=12.5, total=2):
        part = self.parts / wip_ci.part_name('shard', self.attempt, index)
        part.mkdir(parents=True)
        if report is not None:
            (part / 'report.json').write_text(json.dumps(report))
        code = exit_code if exit_code is not None else (0 if report is None or report['success'] else 1)
        (part / 'shard.json').write_text(json.dumps(dict(kind=wip_ci.SHARD_KIND, index=index, total=total, root=RUNNER_ROOT, argv=[],
                                                         exitCode=code, durationSeconds=seconds, log='shard.log',
                                                         report=None if report is None else 'report.json')))

    def static_part(self, lint=0):
        part = self.parts / wip_ci.part_name('static', self.attempt)
        part.mkdir(parents=True)
        commands = [dict(name='typecheck', argv=['pnpm', '-s', 'typecheck'], exitCode=0, durationSeconds=50.0, lines=[]),
                    dict(name='lint', argv=['pnpm', '-s', 'lint'], exitCode=lint, durationSeconds=30.0,
                         lines=['src/a.ts:%d:1 error no-unused-vars' % index for index in range(1, 41)] if lint else [])]
        (part / 'static.json').write_text(json.dumps(dict(kind=wip_ci.STATIC_KIND, commands=commands)))

    def summarize(self, total=2, results=None):
        out = self.parts.parent / (self.parts.name + '-summary')
        summary = wip_ci.summarize(self.parts, out, self.attempt, total, results or dict(SUCCESS), RUN)
        self.markdown = (out / 'wip-summary.md').read_text()
        self.assertEqual(json.loads((out / 'wip-summary.json').read_text()), summary)
        return summary

    def test_two_real_shards_one_failing(self):
        self.plan_part()
        self.shard_part(1, fixture_report(1), seconds=10.25)
        self.shard_part(2, fixture_report(2), seconds=14.5)
        summary = self.summarize(results=dict(SUCCESS, shard='failure'))
        self.assertEqual(summary['kind'], 'wip-ci-summary-v1')
        self.assertEqual(summary['outcome'], 'red')
        self.assertEqual(summary['problems'], ['shard 2 exited 1', 'wip-shard failure'])
        self.assertEqual(summary['source'], dict(SOURCE, run=RUN))
        self.assertEqual(summary['plan'], dict(scope='suite', static=False, chromium=True))
        self.assertEqual(summary['shards'], [
            dict(index=1, exitCode=0, durationSeconds=10.25, files=3, tests=5, passed=4, failed=0, skipped=1, failedFiles=0),
            dict(index=2, exitCode=1, durationSeconds=14.5, files=2, tests=3, passed=1, failed=2, skipped=0, failedFiles=2)])
        self.assertEqual(summary['totals'], dict(files=5, tests=8, passed=5, failed=2, skipped=1, failedFiles=2))
        self.assertIsNone(summary['static'])
        failures = summary['failures']
        self.assertEqual([(row['shard'], row['file'], row['fullName']) for row in failures], [
            (2, 'tests/wip-fixture/broken-b.test.ts', ''),
            (2, 'tests/wip-fixture/catalog-rows.test.ts', 'catalog rows names every missing row'),
            (2, 'tests/wip-fixture/catalog-rows.test.ts', 'catalog rows counts rows')])
        self.assertTrue(failures[0]['message'].startswith('module b failed to load'))
        # The first 30 lines of a 56-line message, its length recorded.
        long = failures[1]
        self.assertEqual(long['message'].splitlines(), ['Error: 45 rows missing:'] + ['missing row %d' % index for index in range(1, 30)])
        self.assertEqual(long['messageLines'], 56)
        self.assertTrue(failures[2]['message'].startswith('AssertionError: expected 3 to be 4'))
        # The slowest files across both shards, from each file's startTime and endTime.
        slowest = summary['slowest']
        self.assertEqual(len(slowest), 5)
        expected = sorted(((result['endTime'] - result['startTime']) / 1000, result['name'][len(RUNNER_ROOT) + 1:])
                          for index in (1, 2) for result in fixture_report(index)['testResults'])
        self.assertEqual([(row['seconds'], row['file']) for row in slowest],
                         [(round(seconds, 3), file) for seconds, file in sorted(expected, key=lambda item: (-item[0], item[1]))])
        lines = self.markdown.splitlines()
        self.assertEqual(lines[0], '# WIP CI red: 2 failed tests in 2 files')
        self.assertIn('information only, never landing evidence', self.markdown)
        self.assertIn('| 2 | 1 | 14.5 | 2 | 3 | 1 | 2 | 0 |', lines)
        self.assertIn('### `tests/wip-fixture/catalog-rows.test.ts` › catalog rows counts rows (shard 2)', lines)
        self.assertIn('    missing row 29', lines)
        self.assertNotIn('    missing row 30', lines)
        self.assertIn('## Slowest files', lines)

    def test_every_shard_green_is_green(self):
        self.plan_part(plan=dict(scope=['tests/catalog'], static=True, chromium=False))
        self.shard_part(1, fixture_report(1), total=1)
        self.static_part()
        summary = self.summarize(total=1, results=dict(SUCCESS, static='success'))
        self.assertEqual((summary['outcome'], summary['problems'], summary['failures']), ('green', [], []))
        self.assertEqual([row['name'] for row in summary['static']], ['typecheck', 'lint'])
        self.assertTrue(self.markdown.startswith('# WIP CI green: 5 tests in 3 files\n'))

    def test_an_empty_shard_is_green(self):
        # A small scope leaves some of the 8 shards without files; Vitest writes no report then.
        self.plan_part()
        self.shard_part(1, fixture_report(1))
        self.shard_part(2, None)
        summary = self.summarize()
        self.assertEqual(summary['outcome'], 'green')
        self.assertEqual(summary['shards'][1], dict(index=2, exitCode=0, durationSeconds=12.5, files=0, tests=0, passed=0, failed=0,
                                                    skipped=0, failedFiles=0))

    def test_what_is_missing_or_failed_turns_it_red(self):
        cases = {
            'a missing shard': (lambda: (self.plan_part(), self.shard_part(1, fixture_report(1))), SUCCESS, ['shard 2 missing']),
            'a failed shard without a report': (lambda: (self.plan_part(), self.shard_part(1, fixture_report(1)), self.shard_part(2, None, 1)),
                                                SUCCESS, ['shard 2 exited 1']),
            'a refused plan': (lambda: self.plan_part(refused='Wip-Scope: tests/nowhere does not exist'),
                               dict(plan='failure', shard='skipped', static='skipped'),
                               ['plan refused: Wip-Scope: tests/nowhere does not exist', 'wip-plan failure']),
            'no plan part': (lambda: None, dict(plan='failure', shard='skipped', static='skipped'),
                             ['plan part missing', 'wip-plan failure']),
            'a requested static part missing': (lambda: (self.plan_part(plan=dict(scope='suite', static=True, chromium=True)),
                                                         self.shard_part(1, fixture_report(1)), self.shard_part(2, None)),
                                                dict(SUCCESS, static='failure'), ['static part missing', 'wip-static failure']),
            'a failed lint': (lambda: (self.plan_part(plan=dict(scope='suite', static=True, chromium=True)), self.shard_part(1, fixture_report(1)),
                                       self.shard_part(2, None), self.static_part(lint=1)),
                              dict(SUCCESS, static='failure'), ['static lint exited 1', 'wip-static failure']),
            'a cancelled shard job': (lambda: (self.plan_part(), self.shard_part(1, fixture_report(1)), self.shard_part(2, None)),
                                      dict(SUCCESS, shard='cancelled'), ['wip-shard cancelled']),
        }
        for name, (build, results, problems) in cases.items():
            with self.subTest(case=name):
                self.parts = self.root / name.replace(' ', '-')
                build()
                summary = self.summarize(results=results)
                self.assertEqual((summary['outcome'], summary['problems']), ('red', problems))
                self.assertTrue(self.markdown.startswith('# WIP CI red'))
                for problem in problems:
                    self.assertIn(problem, self.markdown)

    def test_a_failed_lints_lines_reach_the_markdown(self):
        self.plan_part(plan=dict(scope='suite', static=True, chromium=True))
        self.shard_part(1, fixture_report(1))
        self.shard_part(2, None)
        self.static_part(lint=1)
        summary = self.summarize(results=dict(SUCCESS, static='failure'))
        self.assertEqual(len(summary['static'][1]['lines']), 40)
        lines = self.markdown.splitlines()
        self.assertIn('- lint: exit 1, 30.0 s', lines)
        self.assertIn('    src/a.ts:40:1 error no-unused-vars', lines)

    def many_failures(self, count, width=0):
        """Shard 2's real report with its failing file repeated count times, each test renamed (and its message lines padded
        to width characters)."""
        report = fixture_report(2)
        failing = next(result for result in report['testResults'] if result['name'].endswith('catalog-rows.test.ts'))
        results = []
        for index in range(count):
            result = json.loads(json.dumps(failing))
            result['name'] = result['name'].replace('catalog-rows', 'catalog-rows-%03d' % index)
            for assertion in result['assertionResults']:
                assertion['fullName'] += ' %03d' % index
                if width:
                    assertion['failureMessages'] = ['\n'.join(line.ljust(width, '.') for line in message.splitlines())
                                                    for message in assertion['failureMessages']]
            results.append(result)
        report['testResults'] = results
        return report

    def assert_capped(self, markdown):
        self.assertLessEqual(len(markdown.splitlines()), wip_ci.MARKDOWN_LINES)
        self.assertLessEqual(len(markdown.encode()), wip_ci.MARKDOWN_BYTES)

    def test_the_markdown_stops_at_200_lines_and_says_what_it_left_out(self):
        self.plan_part()
        self.shard_part(1, fixture_report(1))
        self.shard_part(2, self.many_failures(150))
        summary = self.summarize()
        self.assertEqual(len(summary['failures']), 300)
        self.assert_capped(self.markdown)
        # Whole failures only: the last one shown ends within one failure's length of the cap.
        self.assertGreater(len(self.markdown.splitlines()), wip_ci.MARKDOWN_LINES - 40)
        shown = self.markdown.count('\n### ')
        self.assertGreater(shown, 0)
        last = self.markdown.splitlines()[-1]
        self.assertEqual(last, '_Cut at 200 lines or 16 KB: %d of 300 failures and the slowest files left out; '
                               'wip-summary.json has them all._' % (300 - shown))

    def test_the_markdown_stops_at_16_kb_and_clips_long_lines(self):
        self.plan_part()
        self.shard_part(1, fixture_report(1))
        self.shard_part(2, self.many_failures(40, width=5000))
        summary = self.summarize()
        # The JSON keeps each message line to 500 characters; the markdown clips each line to 200.
        self.assertEqual(max(len(line) for row in summary['failures'] for line in row['message'].splitlines()), wip_ci.JSON_LINE)
        self.assert_capped(self.markdown)
        self.assertLess(len(self.markdown.splitlines()), wip_ci.MARKDOWN_LINES)
        self.assertLessEqual(max(len(line) for line in self.markdown.splitlines()), wip_ci.MARKDOWN_LINE)
        self.assertTrue(self.markdown.splitlines()[-1].startswith('_Cut at 200 lines or 16 KB: '))

    def test_multiline_test_names_stay_one_line_within_the_cap(self):
        """Review r1: Vitest keeps newlines in test names; three with 80 each must not break the 200-line cap."""
        report = fixture_report(2)
        failing = next(result for result in report['testResults'] if result['name'].endswith('catalog-rows.test.ts'))
        failing['assertionResults'].append(json.loads(json.dumps(failing['assertionResults'][1])))
        for assertion in failing['assertionResults']:
            if assertion['status'] == 'failed':
                assertion['fullName'] = 'a' + '\n' * 80 + 'b'
                assertion['failureMessages'] = ['Error: short']
        self.plan_part()
        self.shard_part(1, fixture_report(1))
        self.shard_part(2, report)
        summary = self.summarize()
        self.assertEqual(sum(1 for row in summary['failures'] if row['fullName'] == 'a' + '\n' * 80 + 'b'), 3)
        self.assert_capped(self.markdown)
        self.assertEqual(self.markdown.count('### `tests/wip-fixture/catalog-rows.test.ts` › a b (shard 2)'), 3)
        # A line break of any kind str.splitlines knows, in any field, cannot start a line of its own.
        failing['assertionResults'][0]['fullName'] = 'x\r\n## Fake heading y'
        failing['name'] = failing['name'].replace('catalog-rows', 'catalog\nrows')
        self.parts = self.root / 'breaks'
        self.plan_part()
        self.shard_part(1, fixture_report(1))
        self.shard_part(2, report)
        self.summarize()
        self.assert_capped(self.markdown)
        self.assertNotIn('\n## Fake heading', self.markdown)
        self.assertIn('› x ## Fake heading y (shard 2)', self.markdown)
        self.assertIn('`tests/wip-fixture/catalog rows.test.ts`', self.markdown)

    def test_a_file_level_error_is_kept_beside_its_failed_tests(self):
        """Review r1: a failing afterAll is the file's message while its tests' failures stay on the tests."""
        report = fixture_report(2)
        failing = next(result for result in report['testResults'] if result['name'].endswith('catalog-rows.test.ts'))
        failing['message'] = 'Error: afterAll teardown failed\n    at catalog-rows.test.ts:12:9'
        self.plan_part()
        self.shard_part(1, fixture_report(1))
        self.shard_part(2, report)
        summary = self.summarize()
        rows = [(row['fullName'], row['message'].splitlines()[0]) for row in summary['failures']
                if row['file'] == 'tests/wip-fixture/catalog-rows.test.ts']
        self.assertEqual(rows, [('', 'Error: afterAll teardown failed'), ('catalog rows names every missing row', 'Error: 45 rows missing:'),
                                ('catalog rows counts rows', 'AssertionError: expected 3 to be 4 // Object.is equality')])
        lines = self.markdown.splitlines()
        self.assertIn('### `tests/wip-fixture/catalog-rows.test.ts` (shard 2)', lines)
        self.assertIn('    Error: afterAll teardown failed', lines)

    def test_the_command_line_writes_both_files(self):
        self.plan_part()
        self.shard_part(1, fixture_report(1), total=8)
        out = self.root / 'cli'
        with contextlib.redirect_stdout(io.StringIO()):
            code = wip_ci.main(['summarize', '--parts', str(self.parts), '--out', str(out), '--attempt', '1', '--total', '8',
                                '--plan-result', 'success', '--shard-result', 'failure', '--static-result', 'skipped'])
        self.assertEqual(code, 0)
        summary = json.loads((out / 'wip-summary.json').read_text())
        self.assertEqual(summary['problems'][:2], ['shard 2 missing', 'shard 3 missing'])
        self.assertTrue((out / 'wip-summary.md').read_text().startswith('# WIP CI red'))


def load_yaml(relative):
    """A repository YAML file parsed by the lockfile-pinned `yaml` package, as remote-ci.test.py reads ci.yaml."""
    script = "console.log(JSON.stringify(require('yaml').parse(require('fs').readFileSync(process.argv[1], 'utf8'))))"
    return json.loads(subprocess.run(['node', '-e', script, relative], cwd=HERE.parent.parent, capture_output=True, text=True,
                                     check=True).stdout)


WIP = "github.event_name == 'push' && startsWith(github.ref, 'refs/heads/wip/')"


class WorkflowTest(unittest.TestCase):
    """ci.yaml's wip-* jobs, read as GitHub reads them."""
    def setUp(self):
        self.workflow = load_yaml('.github/workflows/ci.yaml')
        self.jobs = {name: job for name, job in self.workflow['jobs'].items() if name.startswith('wip-')}

    def step(self, job, id):
        steps = [step for step in self.jobs[job]['steps'] if step.get('id') == id]
        self.assertEqual(len(steps), 1, id)
        return steps[0]

    def test_the_wip_jobs_run_on_wip_pushes_alone_and_checks_skips_them(self):
        self.assertEqual(sorted(self.jobs), ['wip-plan', 'wip-shard', 'wip-static', 'wip-summary'])
        self.assertEqual(self.jobs['wip-plan']['if'], '${{ %s }}' % WIP)
        self.assertEqual(self.jobs['wip-shard']['if'], '${{ %s }}' % WIP)
        self.assertEqual(self.jobs['wip-static']['if'], "${{ %s && needs.wip-plan.outputs.static == 'true' }}" % WIP)
        self.assertEqual(self.jobs['wip-summary']['if'], '${{ always() && %s }}' % WIP)
        self.assertEqual(self.workflow['jobs']['checks']['if'],
                         "${{ !startsWith(github.ref, 'refs/heads/gate/') && !startsWith(github.ref, 'refs/heads/wip/') }}")
        self.assertEqual(self.jobs['wip-shard']['needs'], 'wip-plan')
        self.assertEqual(self.jobs['wip-static']['needs'], 'wip-plan')
        self.assertEqual(sorted(self.jobs['wip-summary']['needs']), ['wip-plan', 'wip-shard', 'wip-static'])

    def test_every_wip_job_reads_only_with_no_secrets_and_a_40_minute_timeout(self):
        for name, job in self.jobs.items():
            with self.subTest(job=name):
                self.assertEqual(job['permissions'], dict(contents='read'))
                self.assertEqual(job['timeout-minutes'], 40)
                self.assertEqual(job['runs-on'], 'ubuntu-latest')
                self.assertNotIn('secrets.', json.dumps(job))
                self.assertNotIn('GITHUB_TOKEN', json.dumps(job))
                checkout = job['steps'][0]
                self.assertTrue(checkout['uses'].startswith('actions/checkout@'))
                self.assertEqual(checkout['with'], {'fetch-depth': 1, 'persist-credentials': False})

    def test_the_test_jobs_share_the_setup_without_the_gate_probe(self):
        for name in ('wip-shard', 'wip-static'):
            with self.subTest(job=name):
                setup = self.step(name, 'setup')
                self.assertEqual(setup['uses'], './.github/actions/ep-setup')
                self.assertEqual(setup['with'], {'runner-label': 'ubuntu-latest', 'gate-probe': 'false'})
                install = self.jobs[name]['steps'][2]
                self.assertIn('pnpm install --offline --frozen-lockfile', install['run'])

    def test_the_shard_matrix_is_eight_six_at_a_time_and_never_fails_fast(self):
        strategy = self.jobs['wip-shard']['strategy']
        self.assertEqual(strategy, {'fail-fast': False, 'max-parallel': 6, 'matrix': {'index': list(range(1, 9))}})
        self.assertEqual(wip_ci.TOTAL, 8)
        self.assertIn('python3 -B scripts/orchestration/wip_ci.py shard --index ${{ matrix.index }} --total 8',
                      self.step('wip-shard', 'shard')['run'])
        self.assertIn('python3 -B scripts/orchestration/wip_ci.py summarize', self.step('wip-summary', 'summarize')['run'])
        self.assertIn('--total 8', self.step('wip-summary', 'summarize')['run'])
        # Chromium only where its tests run: shard 1 (tests/shard-plan.ts), when the scope holds a browser file.
        chromium = [step for step in self.jobs['wip-shard']['steps'] if 'playwright install' in step.get('run', '')]
        self.assertEqual(len(chromium), 1)
        self.assertEqual(chromium[0]['if'], "${{ matrix.index == 1 && needs.wip-plan.outputs.chromium == 'true' }}")
        self.assertEqual(self.jobs['wip-plan']['outputs'], {'static': '${{ steps.plan.outputs.static }}',
                                                            'chromium': '${{ steps.plan.outputs.chromium }}'})

    def test_each_part_is_uploaded_under_its_wip_name_and_the_summary_reads_them_all(self):
        attempt = '${{ github.run_attempt }}'
        for job, id, name in (('wip-plan', 'plan', wip_ci.part_name('plan', attempt)),
                              ('wip-shard', 'shard', wip_ci.part_name('shard', attempt, 1).replace('-1', '-${{ matrix.index }}')),
                              ('wip-static', 'static', wip_ci.part_name('static', attempt))):
            with self.subTest(job=job):
                upload = self.step(job, 'upload')
                self.assertTrue(upload['uses'].startswith('actions/upload-artifact@'))
                self.assertEqual(upload['if'], '${{ always() }}')
                self.assertEqual(upload['with']['name'], name)
                self.assertEqual(upload['with']['retention-days'], 3)
                self.assertIn('python3 -B scripts/orchestration/wip_ci.py %s ' % id, self.step(job, id)['run'])
        self.assertEqual(self.step('wip-shard', 'upload')['with']['name'], 'wip-shard-${{ github.run_attempt }}-${{ matrix.index }}')
        downloads = [step for step in self.jobs['wip-summary']['steps'] if str(step.get('uses', '')).startswith('actions/download-artifact@')]
        self.assertEqual(sorted((step['with'].get('pattern') or step['with'].get('name')) for step in downloads),
                         ['wip-plan-' + attempt, 'wip-shard-%s-*' % attempt, 'wip-static-' + attempt])
        for step in downloads:
            self.assertIs(step.get('continue-on-error'), True)
            if 'name' in step['with']:
                self.assertEqual(step['with']['path'], '${{ runner.temp }}/parts/' + step['with']['name'])
        summarize = self.step('wip-summary', 'summarize')
        self.assertEqual(summarize['env'], dict(PLAN_RESULT='${{ needs.wip-plan.result }}', SHARD_RESULT='${{ needs.wip-shard.result }}',
                                                STATIC_RESULT='${{ needs.wip-static.result }}'))
        for argument in ('--attempt "$GITHUB_RUN_ATTEMPT"', '--plan-result "$PLAN_RESULT"', '--shard-result "$SHARD_RESULT"',
                         '--static-result "$STATIC_RESULT"'):
            self.assertIn(argument, summarize['run'])
        self.assertIn('wip-summary.md" >> "$GITHUB_STEP_SUMMARY"', self.step('wip-summary', 'step-summary')['run'])
        upload = self.step('wip-summary', 'upload')
        self.assertEqual(upload['with']['name'], 'wip-summary-${{ github.run_id }}')
        self.assertEqual(upload['with']['retention-days'], 3)
        self.assertIs(upload['with']['overwrite'], True)


if __name__ == '__main__':
    unittest.main()
