"""The CI heavy-check driver (remote_ci.py) against the verifier (remote_checks.py).

Runs the driver on a fixture candidate with a stub pnpm, publishes its directory through
remote-fetch.sh with a fake gh, and verifies the manifest statically and against the local
host exactly as a gate would. No GitHub run, network or live gate.
"""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import remote_checks
import remote_ci
from workflow_evidence import digest

spec = importlib.util.spec_from_file_location('remote_checks_fixtures', HERE / 'remote-checks.test.py')
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)

PNPM_STUB = '''#!/bin/sh
# Stub pnpm: --version, then install/typecheck/lint/test:workflow/test with the exit codes baked in below.
printf '%%s\\n' "$*" >> %(calls)s
env > %(envs)s/"$2".env
case "$1" in
  --version) echo %(version)s; exit 0 ;;
  install) exit %(install)d ;;
  -s) [ "$2" = typecheck ] && exit %(typecheck)d; [ "$2" = test:workflow ] && exit %(workflow)d; exit %(lint)d ;;
  # A shard (--shard=i/N) copies report-<i>.json and writes its blob, exiting with exit-<i>'s code if that file exists;
  # the merge copies report.json.
  test) shard=
        for arg; do case "$arg" in --shard=*) shard=${arg#--shard=}; shard=${shard%%%%/*} ;; esac; done
        report=%(report)s; [ -n "$shard" ] && report=${report%%.json}-$shard.json
        for arg; do case "$arg" in
          --outputFile.json=*) cp "$report" "${arg#--outputFile.json=}" ;;
          --outputFile.blob=*) mkdir -p "$(dirname "${arg#--outputFile.blob=}")" && echo "fixture blob $shard" > "${arg#--outputFile.blob=}" ;;
        esac; done
        echo "fixture suite"
        [ -n "$shard" ] && [ -f %(root)s/exit-"$shard" ] && exit "$(cat %(root)s/exit-"$shard")"
        exit %(suite)d ;;
esac
exit 99
'''

GH_STUB = '''#!/bin/sh
# Fake gh: `gh run download --name <artifact> --dir <dir>` copies the artifact store's <artifact>/.
[ "$1 $2 $3" = "run download --name" ] && [ "$5" = --dir ] || exit 2
[ -d %(artifacts)s/"$4" ] || { echo "no artifact $4" >&2; exit 1; }
mkdir -p "$6" && cp -R %(artifacts)s/"$4"/. "$6"/
'''


def host_zone():
    probe = subprocess.run(['node', '-e', remote_checks.PROBE], capture_output=True, text=True, check=True, env={'PATH': os.environ['PATH']})
    return json.loads(probe.stdout)['timeZone']


# The GitHub run the fixture's jobs belong to, its attempt, and both producer jobs succeeding (fix r1 on split B).
RUN, ATTEMPT = '4242', 2
SUCCESS = {'remote-shard': 'success', 'remote-static': 'success'}


class CiFixture(unittest.TestCase):
    """A fixture candidate, its depth-1 gate checkout, a stub pnpm and a fake gh."""
    def setUp(self):
        # The gate host's TZ is unset (its zone is /etc/localtime's; see ci.yaml's GATE_TZ), and verify_local probes the
        # zone this process resolves, while host_zone() probes with TZ unset. So the gate side runs with TZ unset here,
        # whatever TZ the test runs under (CI's static job sets one: gate-ci-workflow tz).
        zone = os.environ.pop('TZ', None)
        if zone is not None:
            self.addCleanup(os.environ.__setitem__, 'TZ', zone)
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.addCleanup(self.scratch.cleanup)
        self.addCleanup(fixtures.writable, self.scratch.name)
        self.root = Path(self.scratch.name)
        self.orch = self.root / 'orch'
        self.orch.mkdir()
        self.main, self.wt = fixtures.fixture_repository(self.root)
        self.base = fixtures.git(self.main, 'rev-parse', 'HEAD')
        self.tree = fixtures.git(self.wt, 'rev-parse', 'HEAD^{tree}')
        self.commit = fixtures.git(self.wt, 'rev-parse', 'HEAD')
        # CI's checkout: gate-push.sh's tree-only commit of the candidate, cloned at depth 1 as ci.yaml does.
        self.gate_commit, self.pairs, self.message = fixtures.gate_commit(self.wt, self.commit, self.base)
        self.trailers = dict(self.pairs)
        self.ci = self.clone(self.gate_commit, 'ci')
        fixtures.install(self.ci)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.envs = self.root / 'envs'
        self.envs.mkdir()
        self.artifacts = self.root / 'artifacts'
        self.artifacts.mkdir()
        self.reports()
        self.parts = self.root / 'parts'
        self.stub()
        (self.bin / 'gh').write_text(GH_STUB % dict(artifacts=self.artifacts))
        (self.bin / 'gh').chmod(0o755)
        previous = os.environ['PATH']
        os.environ['PATH'] = str(self.bin) + os.pathsep + previous
        self.addCleanup(os.environ.__setitem__, 'PATH', previous)

    def clone(self, commit, name):
        """actions/checkout with fetch-depth 1: a shallow clone of one pushed commit (via a scratch bare origin)."""
        origin = self.root / (name + '-origin.git')
        fixtures.git(self.root, 'init', '-q', '--bare', str(origin))
        fixtures.git(self.wt, 'push', '-q', str(origin), commit + ':refs/heads/gate/' + name)
        subprocess.run(['git', 'clone', '-q', '--depth', '1', '--branch', 'gate/' + name, 'file://' + str(origin), str(self.root / name)], check=True)
        return self.root / name

    def stub(self, version='10.29.1', **exits):
        codes = {**dict(install=0, typecheck=0, lint=0, workflow=0, suite=0), **exits}
        (self.bin / 'pnpm').write_text(PNPM_STUB % dict(calls=self.root / 'calls.log', envs=self.envs, report=self.root / 'report.json',
                                                        root=self.root, version=version, **codes))
        (self.bin / 'pnpm').chmod(0o755)

    def reports(self, **options):
        """The stub's suite reports, consistent by construction: report.json (the merge) and report-<i>.json (shard i)."""
        merged, shards = fixtures.suite_reports(2, root=str(self.ci), **options)
        (self.root / 'report.json').write_text(json.dumps(merged))
        for index, value in enumerate(shards, 1):
            (self.root / ('report-%d.json' % index)).write_text(json.dumps(value))

    def runner(self, attempt=ATTEMPT):
        """github_runner() as a job of GitHub run RUN in attempt `attempt` sees it."""
        return remote_ci.github_runner({'GITHUB_RUN_ID': RUN, 'GITHUB_RUN_ATTEMPT': str(attempt), 'GITHUB_REPOSITORY': 'fixture/everythingpath'})

    def part(self, index=None, attempt=ATTEMPT):
        """Where the assemble job finds a part: its attempt-scoped artifact name under the downloads."""
        return self.parts / remote_ci.part_name(str(attempt), index)

    def assemble(self, out=None, label='w1-fixture', tz=None, total=2, producers=None, attempt=ATTEMPT, parent=None, output=None):
        tz = host_zone() if tz is None else tz
        return remote_ci.assemble(self.ci, out or self.root / 'out', self.orch, label, tz, self.parts, total, producers or dict(SUCCESS),
                                  parent=parent, runner=self.runner(attempt), github_output=output)

    def jobs(self, total=2, tz=None, shard_zone=None, drop=(), parent=None, label='w1-fixture', attempt=ATTEMPT, producers=None, skip=()):
        """Every job in turn, as ci.yaml runs them in one run attempt: (static passed, [shard passed], assemble passed,
        runId, directory). skip names producers ('static', or a shard index) that fail before writing a part."""
        tz = host_zone() if tz is None else tz
        with contextlib.redirect_stdout(io.StringIO()):
            static = 'static' not in skip and remote_ci.static(self.ci, self.part(attempt=attempt), tz, parent=parent, runner=self.runner(attempt))
            shards = [index not in skip and remote_ci.shard(self.ci, self.part(index, attempt), index, total,
                                                            shard_zone if shard_zone and index == total else tz, parent=parent,
                                                            runner=self.runner(attempt))
                      for index in range(1, total + 1)]
        for index in drop:
            shutil.rmtree(self.part(index, attempt))
        output = self.root / 'github-output'
        if output.exists():
            output.unlink()
        with contextlib.redirect_stdout(io.StringIO()) as log:
            out = self.root / ('out' if attempt == ATTEMPT else 'out-%s' % attempt)
            assembled = self.assemble(out, label, tz, total, producers, attempt, parent, output)
        self.log = log.getvalue()
        values = dict(line.split('=', 1) for line in output.read_text().splitlines())
        return static, shards, assembled, values['run-id'], Path(values['directory'])

    def drive(self, tz=None, label='w1-fixture', parent=None):
        """Every job as the workflow runs it, with the runner's environment plus leaked overrides: (passed, runId, directory)."""
        parent = parent if parent is not None else {**os.environ, 'NODE_OPTIONS': '--max-old-space-size=1', 'VITEST_POOL': 'threads',
                                                    'GOMEMLIMIT': '1GiB', 'GITHUB_TOKEN': 'secret', 'TZ': 'Pacific/Chatham'}
        _, _, passed, run_id, directory = self.jobs(tz=tz, parent=parent, label=label)
        return passed, run_id, directory

    def publish(self, run_id, directory):
        """The artifact upload, then remote-fetch.sh as root runs it."""
        subprocess.run(['cp', '-R', str(directory), str(self.artifacts / ('remote-checks-' + run_id))], check=True)
        fetched = subprocess.run(['bash', str(HERE / 'remote-fetch.sh'), run_id], capture_output=True, text=True,
                                 env={**os.environ, 'EP_ORCH': str(self.orch)})
        self.assertEqual(fetched.returncode, 0, fetched.stdout + fetched.stderr)
        path = self.orch / 'remote-checks' / run_id / 'manifest.json'
        self.assertEqual(fetched.stdout.strip(), digest(path))
        return path, fetched.stdout.strip()

    def gate(self, path, sha256):
        manifest = remote_checks.verify_manifest(path, sha256, self.tree, self.base, self.wt, self.orch, {self.commit})
        evidence = self.root / ('evidence-' + path.parent.name)
        evidence.mkdir()
        return manifest, remote_checks.verify_local(manifest, path, self.wt, evidence)


class RemoteCiTest(CiFixture):
    def test_driver_manifest_passes_the_verifier(self):
        ok, run_id, directory = self.drive(tz=host_zone())
        self.assertTrue(ok)
        self.assertRegex(run_id, '^' + remote_checks.RUN_ID + '$')
        self.assertTrue(run_id.startswith('w1-fixture-') and run_id.endswith('-' + self.gate_commit[:6]))
        self.assertEqual(directory, self.root / 'out' / run_id)
        manifest, local = self.gate(*self.publish(run_id, directory))
        self.assertEqual(local['files'], len(fixtures.FILES))
        self.assertEqual(manifest['directory'], str(self.orch / 'remote-checks' / run_id))
        self.assertEqual(manifest['source'], dict(commit=self.gate_commit, tree=self.tree, parents=[], trailers=self.pairs,
                                                  message=self.message, status='', root=str(self.ci)))
        self.assertEqual(self.trailers, {'Gate-Reviewed': self.commit, 'Gate-Base': self.base, 'Gate-Tree': self.tree})
        self.assertEqual([row['argv'][:4] for row in manifest['commands']][:3], [remote_checks.ARGV[name] for name in ('install', 'typecheck', 'lint')])
        self.assertEqual(manifest['commands'][3]['argv'], remote_checks.ARGV['suite'] + [
            '--merge-reports=' + str(directory / 'blobs'), '--outputFile.json=' + str(directory / 'full.json')])
        # gate-ci-workflow: the static job's test:workflow row, beside the four command rows, with its own log.
        workflow = manifest['workflow']
        self.assertEqual((workflow['name'], workflow['argv'], workflow['exitCode']), ('workflow', remote_checks.WORKFLOW_ARGV, 0))
        self.assertEqual(workflow['log'], dict(file='workflow.log', sha256=digest(directory / 'workflow.log')))
        self.assertEqual(manifest['environment']['TZ'], host_zone())

    def test_commands_get_only_the_pinned_environment(self):
        ok, run_id, directory = self.drive(tz='Europe/Stockholm')
        self.assertTrue(ok)
        manifest = json.loads((directory / 'manifest.json').read_text())
        self.assertEqual(manifest['environment'], dict(CI='true', LC_ALL='C.UTF-8', VITEST_MAX_WORKERS='2', TZ='Europe/Stockholm',
                                                       timeZone='Europe/Stockholm'))
        self.assertEqual(manifest['resourceOverrides'], {})
        # typecheck, lint and test:workflow (the static job) and the suite (a shard and the merge: the stub's --reporter=default).
        for name in ('typecheck', 'lint', 'test:workflow', '--reporter=default'):
            seen = dict(line.split('=', 1) for line in (self.envs / (name + '.env')).read_text().splitlines() if '=' in line)
            self.assertEqual(sorted(set(seen) - {'PWD', 'SHLVL', '_', 'OLDPWD'}), manifest['environmentKeys'])
            for leaked in ('NODE_OPTIONS', 'VITEST_POOL', 'GOMEMLIMIT', 'GITHUB_TOKEN', 'LANG'):
                self.assertNotIn(leaked, seen)
            self.assertEqual(seen['TZ'], 'Europe/Stockholm')

    def test_unset_zone_records_the_resolved_zone_without_tz(self):
        ok, run_id, directory = self.drive(tz='')
        self.assertTrue(ok)
        manifest, _ = self.gate(*self.publish(run_id, directory))
        self.assertNotIn('TZ', manifest['environment'])
        self.assertNotIn('TZ', manifest['environmentKeys'])
        self.assertEqual(manifest['environment']['timeZone'], host_zone())

    def test_another_zone_than_the_gate_hosts_is_refused(self):
        zone = 'Pacific/Chatham' if host_zone() != 'Pacific/Chatham' else 'Pacific/Honolulu'
        ok, run_id, directory = self.drive(tz=zone)
        self.assertTrue(ok)
        with self.assertRaisesRegex(RuntimeError, 'Remote timeZone mismatch'):
            self.gate(*self.publish(run_id, directory))

    def test_a_failed_command_stops_the_run_and_is_refused(self):
        self.stub(typecheck=2)
        ok, run_id, directory = self.drive(tz=host_zone())
        self.assertFalse(ok)
        manifest = json.loads((directory / 'manifest.json').read_text())
        self.assertEqual([(row['name'], row['exitCode']) for row in manifest['commands']], [('install', 0), ('typecheck', 2), ('suite', 0)])
        self.assertIs(manifest['completed'], False)
        self.assertNotIn('lint', (self.root / 'calls.log').read_text().split())
        with self.assertRaisesRegex(RuntimeError, 'Remote commands missing or out of order'):
            self.gate(*self.publish(run_id, directory))

    def test_a_failed_suite_is_complete_and_refused(self):
        self.stub(suite=1)
        ok, run_id, directory = self.drive(tz=host_zone())
        self.assertFalse(ok)
        manifest = json.loads((directory / 'manifest.json').read_text())
        self.assertIs(manifest['completed'], True)
        with self.assertRaisesRegex(RuntimeError, 'Remote command failed: suite'):
            self.gate(*self.publish(run_id, directory))


    def test_the_manifest_binds_the_candidates_host_audit_list_and_a_listed_skip_passes(self):
        self.reports(skipped=(fixtures.AUDITED[0],))
        ok, run_id, directory = self.drive(tz=host_zone())
        self.assertTrue(ok)
        manifest, local = self.gate(*self.publish(run_id, directory))
        self.assertEqual(manifest['hostAudits'], dict(file=remote_checks.AUDITS, sha256=digest(self.wt / remote_checks.AUDITS)))
        self.assertEqual(local['files'], len(fixtures.FILES))

    def test_an_unlisted_skip_is_refused(self):
        self.reports(skipped=fixtures.FILES[:1])
        ok, run_id, directory = self.drive(tz=host_zone())
        self.assertTrue(ok)
        with self.assertRaisesRegex(RuntimeError, 'Remote shard 1 suite has pending or todo tests: not in the host-audit list: tests/a.test.ts'):
            self.gate(*self.publish(run_id, directory))

    def test_label_and_candidate_refusals(self):
        for label in ('', 'Gate-R1', 'a/b', 'w1 fixture', 'w1_fixture'):
            with self.assertRaisesRegex(RuntimeError, 'Invalid gate label'):
                remote_ci.run_id(label, self.commit)
        self.assertTrue(re.fullmatch(remote_checks.RUN_ID, remote_ci.run_id('retro-w1-q1', self.commit)))
        (self.ci / 'source.txt').write_text('dirty\n')
        with self.assertRaisesRegex(RuntimeError, 'Candidate checkout not clean'):
            self.drive(tz='')
        self.assertFalse((self.root / 'out').exists() or self.parts.exists())

    def test_only_a_tree_only_gate_commit_is_checked(self):
        """CI stops before any command on a checkout that is not gate-push.sh's commit; even at depth 1,
        where Git hides a shallow commit's parents, the raw commit object still names them."""
        trailers = lambda **changes: {**self.trailers, **changes}
        cases = [(self.commit, 'Gate commit has parents'),
                 (fixtures.gate_commit(self.wt, self.commit, self.base, trailers(**{'Gate-Base': self.base[:12]}))[0], 'Gate commit trailer not a full SHA: Gate-Base'),
                 (fixtures.gate_commit(self.wt, self.commit, self.base, {k: v for k, v in self.trailers.items() if k != 'Gate-Tree'})[0],
                  'Gate commit trailer missing: Gate-Tree'),
                 (fixtures.gate_commit(self.wt, self.commit, self.base, trailers(**{'Gate-Tree': self.base}))[0], 'Gate commit tree is not its Gate-Tree')]
        repeated = fixtures.git(self.wt, 'commit-tree', self.tree, '-m', 'gate: fixture\n\n' + ''.join('%s: %s\n' % item for item in self.trailers.items())
                                + 'Gate-Reviewed: ' + self.base + '\n')
        cases.append((repeated, 'Gate commit trailer repeated: Gate-Reviewed'))
        for index, (commit, reason) in enumerate(cases):
            with self.subTest(reason=reason):
                checkout = self.clone(commit, 'bad%d' % index)
                self.assertEqual(fixtures.git(checkout, 'rev-parse', '--is-shallow-repository'), 'true')
                with self.assertRaisesRegex(RuntimeError, reason):
                    remote_ci.source(checkout)
                self.ci = checkout
                with self.assertRaisesRegex(RuntimeError, reason):
                    self.drive(tz='')
                self.assertFalse((self.root / 'out').exists())
                self.assertFalse((self.root / 'calls.log').exists())

    def refused_everywhere(self, checkout, reason):
        """CI refuses checkout before any command: remote_ci.source, `remote_ci.py probe` and the run."""
        with self.assertRaisesRegex(RuntimeError, reason):
            remote_ci.source(checkout)
        probe = subprocess.run([sys.executable, '-B', str(HERE / 'remote_ci.py'), 'probe'], cwd=checkout, capture_output=True, text=True)
        self.assertEqual((probe.returncode, probe.stdout), (1, ''))
        self.assertRegex(probe.stderr, '^remote_ci probe refused: .*' + reason)
        self.ci = checkout
        with self.assertRaisesRegex(RuntimeError, reason):
            self.drive(tz='')
        self.assertFalse((self.root / 'out').exists())
        self.assertFalse((self.root / 'calls.log').exists())

    def test_every_message_beyond_the_three_trailers_is_refused_by_the_probe_and_the_verifier(self):
        """The pinned corpus as raw parentless commits cloned at depth 1: CI refuses each before any command, and the
        verifier refuses the facts CI would record for it (remote_ci.read_source), so neither path accepts one."""
        gate = remote_ci.read_source(self.ci)
        self.assertEqual(remote_checks.gate_source(gate, self.tree, self.base, self.wt, {self.commit}), self.commit)
        for index, (name, message, reason) in enumerate(fixtures.bad_gate_messages(self.pairs)):
            with self.subTest(name=name):
                commit = fixtures.gate_commit(self.wt, self.commit, self.base, message=message)[0]
                checkout = self.clone(commit, 'message%d' % index)
                facts = remote_ci.read_source(checkout)
                self.assertEqual((facts['commit'], facts['parents'], facts['message']), (commit, [], message))
                self.assertEqual(facts['trailers'], fixtures.recorded_trailers(message))
                with self.assertRaisesRegex(RuntimeError, reason):
                    remote_checks.gate_source(facts, self.tree, self.base, self.wt, None)
                self.refused_everywhere(checkout, reason)

    def test_a_checkout_that_hides_changes_from_status_is_not_clean(self):
        """The clean check holds whatever the checkout's configuration or index says."""
        cases = [('untracked with status.showUntrackedFiles=no', 'Candidate checkout not clean',
                  lambda c: (fixtures.git(c, 'config', 'status.showUntrackedFiles', 'no'), (c / 'new.txt').write_text('new\n'))),
                 ('assume-unchanged', 'Candidate checkout index hides worktree changes',
                  lambda c: (fixtures.git(c, 'update-index', '--assume-unchanged', 'source.txt'), (c / 'source.txt').write_text('hidden\n'))),
                 ('skip-worktree', 'Candidate checkout index hides worktree changes',
                  lambda c: (fixtures.git(c, 'update-index', '--skip-worktree', 'source.txt'), (c / 'source.txt').write_text('hidden\n'))),
                 ('a corrupt index', 'Candidate checkout status failed', lambda c: (c / '.git/index').write_text('not an index\n'))]
        for index, (name, reason, spoil) in enumerate(cases):
            with self.subTest(name=name):
                checkout = self.clone(self.gate_commit, 'spoilt%d' % index)
                spoil(checkout)
                self.refused_everywhere(checkout, reason)

    def test_probe_prints_the_gate_commit_facts(self):
        """`remote_ci.py probe`, ci.yaml's first step after checkout: the commit, its tree, parents and trailers."""
        probe = subprocess.run([sys.executable, '-B', str(HERE / 'remote_ci.py'), 'probe'], cwd=self.ci, capture_output=True, text=True)
        self.assertEqual(probe.returncode, 0, probe.stderr)
        self.assertEqual(json.loads(probe.stdout), dict(commit=self.gate_commit, tree=self.tree, parents=[], trailers=self.pairs,
                                                        message=self.message, status='', root=str(self.ci)))
        refused = subprocess.run([sys.executable, '-B', str(HERE / 'remote_ci.py'), 'probe'], cwd=self.wt, capture_output=True, text=True)
        self.assertEqual((refused.returncode, refused.stdout), (1, ''))
        self.assertIn('Gate commit has parents', refused.stderr)


class ShardedCiTest(CiFixture):
    """The sharded jobs (speed-ci-shards): static, N shards and the assemble job, whose parts reach it as the
    downloaded artifacts remote-static/ and remote-shard-<i>/, all on one checkout path as on GitHub's runners."""
    def manifest(self, directory):
        return json.loads((directory / 'manifest.json').read_text())

    def test_the_jobs_assemble_a_manifest_the_verifier_accepts(self):
        static, shards, assembled, run_id, directory = self.jobs()
        self.assertEqual((static, shards, assembled), (True, [True, True], True))
        self.assertRegex(run_id, '^' + remote_checks.RUN_ID + '$')
        manifest, local = self.gate(*self.publish(run_id, directory))
        self.assertEqual(local['files'], len(fixtures.FILES))
        self.assertEqual([row['name'] for row in manifest['commands']], list(remote_checks.ARGV))
        self.assertEqual(manifest['commands'][3]['argv'], remote_checks.ARGV['suite'] + [
            '--merge-reports=' + str(directory / 'blobs'), '--outputFile.json=' + str(directory / 'full.json')])
        part = self.part(2)
        self.assertEqual(manifest['shards'][1]['argv'], remote_checks.ARGV['suite'] + [
            '--reporter=blob', '--shard=2/2', '--outputFile.json=' + str(part / 'shard-2.json'), '--outputFile.blob=' + str(part / 'blobs/blob-2.json')])
        self.assertEqual(manifest['static']['source'], dict(commit=self.gate_commit, tree=self.tree, root=str(self.ci), status=''))
        self.assertEqual(manifest['completed'], True)
        files = sorted(str(path.relative_to(directory)) for path in directory.rglob('*') if path.is_file())
        self.assertEqual(files, ['blobs/blob-1.json', 'blobs/blob-2.json', 'full.json', 'install.log', 'lint.log', 'manifest.json',
                                 'shards/shard-1.json', 'shards/shard-1.log', 'shards/shard-2.json', 'shards/shard-2.log',
                                 'suite.log', 'typecheck.log', 'workflow.log'])
        written = sorted(directory.rglob('*'), key=lambda path: path.stat().st_mtime_ns)
        self.assertEqual(written[-1].name, 'manifest.json')

    def test_a_failed_shard_is_recorded_and_refused(self):
        (self.root / 'exit-2').write_text('1')
        static, shards, assembled, run_id, directory = self.jobs()
        self.assertEqual((static, shards, assembled), (True, [True, False], False))
        self.assertEqual([row['exitCode'] for row in self.manifest(directory)['shards']], [0, 1])
        with self.assertRaisesRegex(RuntimeError, 'Remote shard failed: 2'):
            self.gate(*self.publish(run_id, directory))

    def test_a_missing_shard_part_is_recorded_and_refused(self):
        static, shards, assembled, run_id, directory = self.jobs(drop=(2,))
        self.assertFalse(assembled)
        self.assertIn('no remote-shard-part-v1 part at', self.log)
        manifest = self.manifest(directory)
        self.assertEqual(([row['index'] for row in manifest['shards']], manifest['completed']), ([1], False))
        with self.assertRaisesRegex(RuntimeError, 'Remote shards incomplete: 1 of 2'):
            self.gate(*self.publish(run_id, directory))

    def test_a_missing_static_part_is_refused(self):
        static, shards, assembled, run_id, directory = self.jobs()
        shutil.rmtree(self.part())
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertFalse(self.assemble(self.root / 'out-static', 'w1-static', output=self.root / 'github-output-static'))
        directory = next((self.root / 'out-static').iterdir())
        with self.assertRaisesRegex(RuntimeError, 'Remote commands missing or out of order'):
            self.gate(*self.publish(directory.name, directory))

    def test_a_failed_static_job_is_recorded_and_refused(self):
        self.stub(typecheck=2)
        static, shards, assembled, run_id, directory = self.jobs()
        self.assertEqual((static, assembled), (False, False))
        self.assertEqual([(row['name'], row['exitCode']) for row in self.manifest(directory)['commands']],
                         [('install', 0), ('typecheck', 2), ('suite', 0)])
        with self.assertRaisesRegex(RuntimeError, 'Remote commands missing or out of order'):
            self.gate(*self.publish(run_id, directory))

    def test_a_failed_workflow_suite_fails_the_static_job_and_is_refused(self):
        """gate-ci-workflow: test:workflow runs after lint; its failure fails the static job (so GitHub's remote-static
        result, which even a verifier that ignores the row binds), leaves the run incomplete and is refused."""
        self.stub(workflow=1)
        static, shards, assembled, run_id, directory = self.jobs(producers=dict(SUCCESS, **{'remote-static': 'failure'}))
        self.assertEqual((static, shards, assembled), (False, [True, True], False))
        manifest = self.manifest(directory)
        self.assertEqual([row['name'] for row in manifest['commands']], list(remote_checks.ARGV))
        self.assertEqual((manifest['workflow']['exitCode'], manifest['completed']), (1, True))
        with self.assertRaisesRegex(RuntimeError, 'Remote producer job did not succeed: remote-static failure'):
            self.gate(*self.publish(run_id, directory))
        # With the producer result forged to success, the row itself still refuses.
        static, shards, assembled, run_id, directory = self.jobs(attempt=3, label='w1-forged')
        self.assertEqual((static, assembled), (False, False))
        with self.assertRaisesRegex(RuntimeError, 'Remote command failed: workflow'):
            self.gate(*self.publish(run_id, directory))

    def test_a_static_job_stopped_before_the_workflow_suite_records_no_row(self):
        self.stub(lint=2)
        static, shards, assembled, run_id, directory = self.jobs()
        self.assertEqual((static, assembled), (False, False))
        manifest = self.manifest(directory)
        self.assertNotIn('workflow', manifest)
        self.assertIs(manifest['completed'], False)
        self.assertNotIn('test:workflow', (self.root / 'calls.log').read_text().split())

    def test_a_shard_with_another_zone_or_toolchain_is_refused(self):
        zone = 'Pacific/Chatham' if host_zone() != 'Pacific/Chatham' else 'Pacific/Honolulu'
        static, shards, assembled, run_id, directory = self.jobs(shard_zone=zone)
        self.assertEqual((shards, assembled), ([True, True], False))
        self.assertIn('not passing: shard 2', self.log)
        with self.assertRaisesRegex(RuntimeError, 'Remote shard 2 environment mismatch'):
            self.gate(*self.publish(run_id, directory))
        shutil.rmtree(self.parts)
        with contextlib.redirect_stdout(io.StringIO()):
            remote_ci.static(self.ci, self.part(), host_zone(), runner=self.runner())
            remote_ci.shard(self.ci, self.part(1), 1, 2, host_zone(), runner=self.runner())
            self.stub(version='10.0.0')
            remote_ci.shard(self.ci, self.part(2), 2, 2, host_zone(), runner=self.runner())
            self.stub()
            self.assemble(self.root / 'out2', 'w1-other')
        directory = next((self.root / 'out2').iterdir())
        with self.assertRaisesRegex(RuntimeError, 'Remote shard 2 toolchain mismatch'):
            self.gate(*self.publish(directory.name, directory))

    def test_a_failed_rerun_never_passes_on_an_earlier_attempts_part(self):
        """Spec r1 #1, the reviewer's probe: attempt 1 left green parts; in attempt 2 shard 2 fails in setup and uploads
        nothing. Attempt 2's assemble job reads only attempt 2's parts and GitHub's needs results, so it records the
        gap and the failure, and the verifier refuses."""
        static, shards, assembled, _, _ = self.jobs(attempt=1)
        self.assertEqual((static, shards, assembled), (True, [True, True], True))
        self.assertTrue((self.part(2, 1) / 'shard.json').is_file())
        static, shards, assembled, run_id, directory = self.jobs(attempt=2, skip=(2,), producers=dict(SUCCESS, **{'remote-shard': 'failure'}))
        self.assertFalse(assembled)
        manifest = self.manifest(directory)
        self.assertEqual(([row['index'] for row in manifest['shards']], manifest['producers']['remote-shard']), ([1], 'failure'))
        self.assertIn('not passing: remote-shard failure', self.log)
        with self.assertRaisesRegex(RuntimeError, 'Remote producer job did not succeed: remote-shard failure'):
            self.gate(*self.publish(run_id, directory))

    def test_an_earlier_attempts_part_is_refused_even_under_this_attempts_name(self):
        """The third layer: had attempt 1's shard-2 part reached attempt 2's downloads, its own runner names attempt 1."""
        self.jobs(attempt=1)
        self.jobs(attempt=2, skip=(2,), producers=dict(SUCCESS, **{'remote-shard': 'failure'}))
        shutil.copytree(self.part(2, 1), self.part(2, 2))
        output = self.root / 'github-output-stale'
        with contextlib.redirect_stdout(io.StringIO()) as log:
            self.assertFalse(self.assemble(self.root / 'out-stale', 'w1-stale', output=output))
        self.assertIn('not passing: shard 2', log.getvalue())
        values = dict(line.split('=', 1) for line in output.read_text().splitlines())
        with self.assertRaisesRegex(RuntimeError, 'Remote shard 2 is from another run or attempt'):
            self.gate(*self.publish(values['run-id'], Path(values['directory'])))

    def test_a_failed_producer_result_refuses_whatever_parts_were_found(self):
        for producer in remote_checks.PRODUCERS:
            for result in ('failure', 'cancelled', 'skipped'):
                with self.subTest(producer=producer, result=result):
                    static, shards, assembled, run_id, directory = self.jobs(
                        attempt='%s-%s' % (producer, result), label='w1-%s-%s' % (producer, result), producers=dict(SUCCESS, **{producer: result}))
                    self.assertEqual((static, shards, assembled), (True, [True, True], False))
                    with self.assertRaisesRegex(RuntimeError, 'Remote producer job did not succeed: %s %s' % (producer, result)):
                        self.gate(*self.publish(run_id, directory))

    def test_a_job_refuses_a_bad_shard_or_a_non_gate_checkout_before_running(self):
        for index, total in ((0, 2), (3, 2), (1, 0)):
            with self.assertRaisesRegex(RuntimeError, 'Invalid shard'):
                remote_ci.shard(self.ci, self.parts / 'bad', index, total, '')
        (self.ci / 'source.txt').write_text('dirty\n')
        for run in (lambda: remote_ci.static(self.ci, self.parts / 'remote-static', ''),
                    lambda: remote_ci.shard(self.ci, self.parts / 'remote-shard-1', 1, 2, ''),
                    lambda: self.assemble(self.root / 'out', tz='')):
            with self.assertRaisesRegex(RuntimeError, 'Candidate checkout not clean'):
                run()
        self.assertFalse(self.parts.exists() or (self.root / 'out').exists() or (self.root / 'calls.log').exists())

    def test_the_command_lines_ci_yaml_runs(self):
        """static, shard and assemble through main(), each in the checkout as its job runs it."""
        zone = host_zone()
        def cli(*args):
            return subprocess.run([sys.executable, '-B', str(HERE / 'remote_ci.py'), *args], cwd=self.ci, capture_output=True, text=True,
                                  env={**os.environ, 'GITHUB_OUTPUT': str(self.root / 'github-output'), 'GITHUB_RUN_ID': RUN,
                                       'GITHUB_RUN_ATTEMPT': str(ATTEMPT)})
        for args in (('static', '--tz', zone, '--out', str(self.part())),
                     *(('shard', '--index', str(index), '--total', '2', '--tz', zone, '--out', str(self.part(index)))
                       for index in (1, 2)),
                     ('assemble', '--label', 'w1-fixture', '--orch', str(self.orch), '--tz', zone, '--out', str(self.root / 'out'),
                      '--parts', str(self.parts), '--total', '2', '--shard-result', 'success', '--static-result', 'success')):
            ran = cli(*args)
            self.assertEqual(ran.returncode, 0, ran.stdout + ran.stderr)
        values = dict(line.split('=', 1) for line in (self.root / 'github-output').read_text().splitlines())
        manifest, local = self.gate(*self.publish(values['run-id'], Path(values['directory'])))
        self.assertEqual((manifest['runner']['provider'], manifest['runner']['runId'], manifest['runner']['attempt']), ('github-actions', RUN, str(ATTEMPT)))
        self.assertEqual(manifest['producers'], SUCCESS)
        self.assertEqual(cli('shard', '--index', '1', '--out', str(self.parts / 'x')).returncode, 2)
        self.assertEqual(cli('assemble', '--label', 'w1-fixture', '--orch', str(self.orch), '--out', str(self.root / 'out3'), '--parts', str(self.parts),
                             '--total', '2').returncode, 2)
        # The single-job run is gone (fix r1): its command line is a usage error, and nothing else can write its shape.
        legacy = cli('--label', 'w1-fixture', '--orch', str(self.orch), '--out', str(self.root / 'legacy'))
        self.assertEqual(legacy.returncode, 64, legacy.stderr)
        self.assertFalse(hasattr(remote_ci, 'run') or hasattr(remote_ci, 'stages'))


class ShardWeightsTest(unittest.TestCase):
    """shard_weights.py: tests/shard-weights.json from a fetched run's shard reports (fix r1 tuning)."""
    def test_weights_come_from_the_shard_reports(self):
        import shard_weights
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as scratch:
            run = Path(scratch) / 'gate-20261106-120000-abcdef'
            (run / 'shards').mkdir(parents=True)
            def item(name, start, end):
                return dict(name='/runner/checkout/' + name, startTime=start, endTime=end)
            reports = [[item('tests/heavy.test.ts', 0, 120000), item('tests/a.test.ts', 0, 400)],
                       [item('tests/b.test.ts', 0, 600), item('tests/mid.test.ts', 0, 5000), item('tests/c.test.ts', 0, 1000)]]
            shards = []
            for index, results in enumerate(reports, 1):
                (run / 'shards' / ('shard-%d.json' % index)).write_text(json.dumps(dict(testResults=results)))
                shards.append(dict(index=index, elapsedSeconds=100.0 * index, report=dict(file='shards/shard-%d.json' % index)))
            (run / 'manifest.json').write_text(json.dumps(dict(source=dict(root='/runner/checkout'), runner=dict(runId='42'), shards=shards)))
            value = shard_weights.weights(run)
        # Overhead: 2 x (100 - 120.4 / 2) / 2 files = 39.8, 2 x (200 - 6.6 / 2) / 3 files = 131.13; their mean 85.47.
        self.assertEqual(value, dict(kind='shard-weights-v1', source="gate run 42 (gate-20261106-120000-abcdef): each shard report's per-file durations",
                                     fileOverheadSeconds=85.5, defaultSeconds=0.6, browserFiles=['e2e/support/control-geometry.test.ts'],
                                     seconds={'tests/heavy.test.ts': 120.0, 'tests/mid.test.ts': 5.0}))

    def test_the_committed_weights_are_the_generators_shape(self):
        import shard_weights
        value = json.loads((HERE.parent.parent / 'tests/shard-weights.json').read_text())
        self.assertEqual(sorted(value), ['browserFiles', 'defaultSeconds', 'fileOverheadSeconds', 'kind', 'seconds', 'source'])
        self.assertEqual((value['kind'], value['browserFiles']), (shard_weights.KIND, list(shard_weights.BROWSER_FILES)))
        self.assertEqual(list(value['seconds']), sorted(value['seconds']))
        self.assertTrue(all(seconds >= shard_weights.THRESHOLD for seconds in value['seconds'].values()))


GATE = "${{ github.event_name == 'push' && startsWith(github.ref, 'refs/heads/gate/') }}"


def load_yaml(relative):
    """A repository YAML file parsed by the lockfile-pinned `yaml` package (tests/shard-plan.test.ts's parser), so this
    test needs no PyYAML: the CI static job runs it (gate-ci-workflow) on the runner's system Python after its install."""
    script = "console.log(JSON.stringify(require('yaml').parse(require('fs').readFileSync(process.argv[1], 'utf8'))))"
    return json.loads(subprocess.run(['node', '-e', script, relative], cwd=HERE.parent.parent, capture_output=True, text=True,
                                     check=True).stdout)


class WorkflowTest(unittest.TestCase):
    """ci.yaml's gate jobs (remote-shard, remote-static, remote-checks), read as GitHub reads them."""
    def setUp(self):
        self.workflow = load_yaml('.github/workflows/ci.yaml')
        self.jobs = {name: self.workflow['jobs'][name] for name in ('remote-shard', 'remote-static', 'remote-checks')}
        self.shard, self.static, self.assemble = self.jobs.values()
        self.setup = load_yaml('.github/actions/ep-setup/action.yml')

    def step(self, job, id):
        steps = [step for step in job['steps'] if step.get('id') == id]
        self.assertEqual(len(steps), 1, id)
        return steps[0]

    def test_each_gate_job_checks_out_the_pushed_commit_alone_and_probes_it_first(self):
        # gate-push.sh pushes a parentless commit; the tests that need history are host audits (owner 2026-11-02).
        # The probe is the shared setup's first step (.github/actions/ep-setup, fix r1), right after the checkout.
        for name, job in self.jobs.items():
            with self.subTest(job=name):
                self.assertEqual(job['if'], GATE if job is not self.assemble else GATE.replace('${{ ', '${{ always() && '))
                self.assertEqual(job['permissions'], dict(contents='read'))
                steps = job['steps']
                checkout = [index for index, step in enumerate(steps) if str(step.get('uses', '')).startswith('actions/checkout@')]
                self.assertEqual(checkout, [0])
                self.assertEqual(steps[0]['with']['fetch-depth'], 1)
                self.assertIs(steps[0]['with']['persist-credentials'], False)
                self.assertEqual((steps[1].get('id'), steps[1].get('uses')), ('setup', './.github/actions/ep-setup'))
                self.assertNotIn('gate-probe', steps[1]['with'])
        probe = self.setup['runs']['steps'][0]
        self.assertEqual(self.setup['inputs']['gate-probe']['default'], 'true')
        self.assertEqual(probe['if'], "${{ inputs.gate-probe == 'true' }}")
        self.assertIn('python3 -B scripts/orchestration/remote_ci.py probe', probe['run'])
        self.assertIn('GITHUB_STEP_SUMMARY', probe['run'])

    def test_the_jobs_share_one_setup(self):
        """Standards r1 #5: the probe, pnpm, Node.js, the store fetch and the hardware log live once, in the composite."""
        names = [step['name'] for step in self.setup['runs']['steps']]
        self.assertEqual(names, ['Gate commit', 'Install pnpm', 'Set up Node.js', 'Fill the pnpm store for the offline install', 'Runner hardware'])
        self.assertEqual(self.setup['runs']['using'], 'composite')
        for name, job in self.jobs.items():
            with self.subTest(job=name):
                text = json.dumps(job['steps'])
                for shared in ('pnpm/action-setup', 'actions/setup-node', 'pnpm fetch', 'lscpu', 'remote_ci.py probe'):
                    self.assertNotIn(shared, text)

    def test_every_gate_job_runs_on_githubs_free_runner_and_logs_its_hardware(self):
        # Owner 2026-11-06: GitHub's standard runners are free for this public repository (4 vCPU, 16 GB).
        self.assertEqual(self.workflow['jobs']['checks']['runs-on'], 'ubuntu-latest')
        self.assertNotIn('blacksmith', (HERE.parent.parent / '.github/workflows/ci.yaml').read_text())
        hardware = self.setup['runs']['steps'][-1]
        for command in ('nproc', 'lscpu', 'free -g', 'RUNNER_NAME', 'echo "runner label: $RUNNER_LABEL"'):
            self.assertIn(command, hardware['run'])
        self.assertEqual(hardware['env']['RUNNER_LABEL'], '${{ inputs.runner-label }}')
        for name, work in (('remote-shard', 'shard'), ('remote-static', 'static'), ('remote-checks', 'assemble')):
            with self.subTest(job=name):
                job = self.jobs[name]
                self.assertEqual(job['runs-on'], 'ubuntu-latest')
                ids = [step.get('id') for step in job['steps']]
                self.assertLess(ids.index('setup'), ids.index(work))
                self.assertEqual(self.step(job, 'setup')['with']['runner-label'], job['runs-on'])

    def test_the_shard_matrix_is_one_to_n_and_every_job_agrees_on_n(self):
        strategy = self.shard['strategy']
        self.assertIs(strategy['fail-fast'], False)
        indexes = strategy['matrix']['index']
        self.assertEqual(indexes, list(range(1, len(indexes) + 1)))
        # Fix r1: 11 duration-balanced shards (10 plus Chromium's), N+1 jobs beside WIP CI's 8 within the Free plan's 20.
        self.assertEqual(len(indexes), 11)
        self.assertLessEqual(len(indexes) + 1 + 8, 20)
        total = '--total %d' % len(indexes)
        self.assertIn(total, self.step(self.shard, 'shard')['run'])
        self.assertIn('--index ${{ matrix.index }}', self.step(self.shard, 'shard')['run'])
        self.assertIn(total, self.step(self.assemble, 'assemble')['run'])

    def test_each_job_runs_its_part_through_the_driver_and_uploads_it_even_on_failure(self):
        for job, mode in ((self.shard, 'shard'), (self.static, 'static')):
            with self.subTest(job=mode):
                self.assertIn('python3 -B scripts/orchestration/remote_ci.py %s ' % mode, self.step(job, mode)['run'])
                self.assertIn('--tz "$GATE_TZ"', self.step(job, mode)['run'])
                upload = self.step(job, 'upload')
                self.assertTrue(upload['uses'].startswith('actions/upload-artifact@'))
                self.assertEqual(upload['if'], '${{ always() }}')
                self.assertNotIn('overwrite', upload['with'])
        # Attempt-scoped (fix r1 on split B): the names remote_ci.part_name gives, with the run attempt.
        attempt = '${{ github.run_attempt }}'
        self.assertEqual(self.step(self.shard, 'upload')['with']['name'], remote_ci.part_name(attempt, 1).replace('-1', '-${{ matrix.index }}'))
        self.assertEqual(self.step(self.shard, 'upload')['with']['name'], 'remote-shard-${{ github.run_attempt }}-${{ matrix.index }}')
        self.assertEqual(self.step(self.static, 'upload')['with']['name'], remote_ci.part_name(attempt))
        for job in self.jobs.values():
            self.assertEqual(job['env']['GATE_TZ'], 'Europe/Stockholm')

    def test_the_assemble_job_waits_for_every_part_runs_anyway_and_publishes_the_one_artifact(self):
        self.assertEqual(sorted(self.assemble['needs']), ['remote-shard', 'remote-static'])
        downloads = [step for step in self.assemble['steps'] if str(step.get('uses', '')).startswith('actions/download-artifact@')]
        self.assertEqual(sorted((step['with'].get('pattern') or step['with'].get('name')) for step in downloads),
                         ['remote-shard-${{ github.run_attempt }}-*', 'remote-static-${{ github.run_attempt }}'])
        static = [step for step in downloads if 'name' in step['with']][0]
        self.assertEqual(static['with']['path'], '${{ runner.temp }}/parts/remote-static-${{ github.run_attempt }}')
        # GitHub's producer results reach the manifest (remote_checks.producers).
        assemble = self.step(self.assemble, 'assemble')
        self.assertEqual(assemble['env'], dict(SHARD_RESULT='${{ needs.remote-shard.result }}', STATIC_RESULT='${{ needs.remote-static.result }}'))
        self.assertIn('--shard-result "$SHARD_RESULT" --static-result "$STATIC_RESULT"', assemble['run'])
        for step in downloads:
            self.assertIs(step.get('continue-on-error'), True)
        run = self.step(self.assemble, 'assemble')['run']
        for argument in ('python3 -B scripts/orchestration/remote_ci.py assemble', '--orch "$GATE_EP_ORCH"', '--tz "$GATE_TZ"', '--parts'):
            self.assertIn(argument, run)
        upload = self.step(self.assemble, 'upload')
        self.assertEqual(upload['with']['name'], 'remote-checks-${{ steps.assemble.outputs.run-id }}')
        self.assertEqual(upload['with']['path'], '${{ steps.assemble.outputs.directory }}')
        self.assertEqual(upload['with']['if-no-files-found'], 'error')
        self.assertEqual(self.assemble['env']['GATE_EP_ORCH'], '/home/andreas/repos/everythingpath/ep-orch')

    def test_the_static_job_runs_install_typecheck_lint_and_test_workflow(self):
        """gate-ci-workflow: the static step's driver runs the orchestration suite after lint, by its package script."""
        self.assertEqual(remote_ci.static_plan(), [(name, remote_checks.ARGV[name]) for name in ('install', 'typecheck', 'lint')]
                         + [('workflow', ['pnpm', '-s', 'test:workflow'])])
        scripts = json.loads((HERE.parent.parent / 'package.json').read_text())['scripts']
        self.assertEqual(scripts['test:workflow'], 'bash scripts/orchestration/workflow.test.sh')
        self.assertEqual(self.step(self.static, 'static')['name'], 'Install, typecheck, lint and test:workflow')

    def test_the_pinned_environment_holds_in_every_gate_job(self):
        """The pinned argv and environment come from remote_checks.py; no job sets a Vitest or Node override."""
        for name, job in self.jobs.items():
            with self.subTest(job=name):
                text = json.dumps(job)
                for override in ('VITEST_', 'NODE_OPTIONS', '--shard='):
                    self.assertNotIn(override, text)
        self.assertEqual(remote_checks.ENVIRONMENT['VITEST_MAX_WORKERS'], '2')


if __name__ == '__main__':
    unittest.main()
