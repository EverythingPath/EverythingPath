"""Remote heavy-check manifest contracts. Synthetic fixtures; no Boat run or live gate.

`python3 -B remote-checks.test.py fixture ORCH WT BASE [mutation]` publishes a passing
fixture manifest for cur-land.test.sh and prints `<path> <sha256>`; `report ROOT [key=n...]
[files=FILE,...] [skipped=FILE,...] [failed=FILE,...]` prints a matching local suite report (failed
marks a file failed under green counters); `audit-list` prints
the fixture's host-audit list.
"""
import hashlib
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
import remote_checks
from workflow_evidence import digest

ROOT = '/remote/checkout'
FILES = ('tests/a.test.ts', 'tests/b.test.ts')
# The fixture's host-audit list: b's test needs the gate host's sources (it may skip remotely).
AUDITED = ('tests/b.test.ts', 'suite tests/b.test.ts works')
AUDIT_LIST = dict(kind='host-audits-v1', sources=['~/repos/everythingpath/sources/fixture'],
                  tests=[dict(file=AUDITED[0], fullName=AUDITED[1])])
VITEST_STUB = '''import { writeFileSync } from 'node:fs';
const out = process.argv.find((arg) => arg.startsWith('--json=')).slice(7);
writeFileSync(out, process.env.FIXTURE_VITEST_LIST ?? JSON.stringify(%s.map((file) => ({ file: process.cwd() + '/' + file }))));
''' % json.dumps(list(FILES))


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()


def blob_sha(root, tree, name):
    blob = subprocess.run(['git', '-C', str(root), 'cat-file', 'blob', tree + ':' + name], capture_output=True)
    return hashlib.sha256(blob.stdout).hexdigest() if blob.returncode == 0 else None


def report(files=FILES, root=ROOT, skipped=(), beside=(), **changes):
    """A passing report in Vitest 4's JSON shape: each file is a module suite holding one describe
    `suite <file>` with the test `works`; in skipped files `works` skips, as a missing host source makes
    it; files in beside also hold a passing `stays`. As in the real reporter (the empty-HOME reports of
    retro W1 fix r1), a skip moves only the test counters: a file of skipped tests is still `passed`
    and its suites count as passed, never pending."""
    def test(name, title, status):
        return dict(ancestorTitles=['suite ' + name], fullName='suite ' + name + ' ' + title, status=status, title=title,
                    failureMessages=[], meta={})
    results = [dict(name=root + '/' + name, status='passed', message='', startTime=0, endTime=1, assertionResults=[
        test(name, 'works', 'skipped' if name in skipped else 'passed'), *([test(name, 'stays', 'passed')] if name in beside else [])])
        for name in files]
    tests = [test['status'] for item in results for test in item['assertionResults']]
    value = dict(numTotalTestSuites=2 * len(files), numPassedTestSuites=2 * len(files), numFailedTestSuites=0, numPendingTestSuites=0,
                 numTotalTests=len(tests), numPassedTests=tests.count('passed'), numFailedTests=0, numPendingTests=tests.count('skipped'),
                 numTodoTests=0, snapshot=dict(added=0, updated=0, filesAdded=0, unmatched=0, matched=0, total=0, filesUpdated=0),
                 startTime=0, success=True, testResults=results)
    value.update(changes)
    return value


def failed_file(value, index=-1):
    """The fail-open shape: one file marked failed (an afterAll hook threw, say) under green counters."""
    value['testResults'][index].update(status='failed', message='Error: hook failed')
    return value


def failed_suite(value):
    """The other fail-open shape: a failed suite counted while success and every test stay green."""
    value.update(numFailedTestSuites=1, numPassedTestSuites=value['numPassedTestSuites'] - 1)
    return value


def gate_message(trailers, body='Tree-only CI commit of REVIEWED for the heavy checks; no history.'):
    """gate-push.sh's message shape: subject, body, then one `Key: value` line per [key, value] pair."""
    return 'gate: fixture\n\n%s\n\n%s' % (body, ''.join('%s: %s\n' % tuple(pair) for pair in trailers))


def gate_commit(root, reviewed, base, trailers=None, message=None):
    """A parentless commit of reviewed's tree whose raw message is message, or gate_message of trailers (a dict
    or [key, value] pairs; by default gate-push.sh's three). Returns the commit, the pairs and the message."""
    tree = git(root, 'rev-parse', reviewed + '^{tree}')
    trailers = {'Gate-Reviewed': reviewed, 'Gate-Base': base, 'Gate-Tree': tree} if trailers is None else trailers
    pairs = [list(pair) for pair in (trailers.items() if isinstance(trailers, dict) else trailers)]
    message = gate_message(pairs) if message is None else message
    # The shell fixtures' repositories (cur-land.test.sh, host-audits.test.sh) may have no identity, and a CI runner
    # has no global one (gate-ci-workflow): then a fixture identity, else the repository's own.
    configured = subprocess.run(['git', '-C', str(root), 'config', 'user.email'], capture_output=True).returncode == 0
    identity = [] if configured else ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test']
    commit = subprocess.run(['git', *identity, '-C', str(root), 'commit-tree', tree], input=message, capture_output=True, text=True, check=True)
    return commit.stdout.strip(), pairs, message


def bad_gate_messages(three):
    """The pinned corpus of gate commit messages that are not gate-push.sh's, given its three [key, value] trailer
    pairs: every way a message can carry a trailer or gate key beyond those three, each once and a full SHA.
    (name, message, the refusal both the CI probe and the verifier give)."""
    reviewed, base, tree = (value for _, value in three)
    block = ''.join('%s: %s\n' % tuple(pair) for pair in three)
    with_base = lambda value: [three[0], ['Gate-Base', value], three[2]]
    return [
        ('an extra Gate-Other trailer', gate_message(three + [['Gate-Other', base]]), 'Unexpected gate commit trailer: Gate-Other'),
        ('a lower-case gate key', gate_message(three + [['gate-reviewed', reviewed]]), 'Unexpected gate commit trailer: gate-reviewed'),
        ('a misspelt gate key', gate_message(three + [['Gate-Reviewd', reviewed]]), 'Unexpected gate commit trailer: Gate-Reviewd'),
        ('a non-gate trailer', gate_message(three + [['Co-Authored-By', 'Fixture <fixture@example.test>']]),
         'Unexpected gate commit trailer: Co-Authored-By'),
        ('a repeated key, same value', gate_message(three + [three[0]]), 'Gate commit trailer repeated: Gate-Reviewed'),
        ('a repeated key, another value', gate_message(three + [['Gate-Base', reviewed]]), 'Gate commit trailer repeated: Gate-Base'),
        ('an abbreviated SHA', gate_message(with_base(base[:12])), 'Gate commit trailer not a full SHA: Gate-Base'),
        ('an upper-case SHA', gate_message(with_base(base.upper())), 'Gate commit trailer not a full SHA: Gate-Base'),
        ('a SHA with a suffix', gate_message(with_base(base + ' extra')), 'Gate commit trailer not a full SHA: Gate-Base'),
        ('an empty value', gate_message(with_base('')), 'Gate commit trailer not a full SHA: Gate-Base'),
        ('a missing trailer', gate_message(three[:2]), 'Gate commit trailer missing: Gate-Tree'),
        ('no trailer block', 'gate: fixture\n', 'Gate commit trailer missing: Gate-Reviewed'),
        ('a gate key in the body', gate_message(three, body='Gate-Other: ' + base), 'Gate commit names a gate key outside its trailers'),
        ('an indented gate key in the body', gate_message(three, body='  gate-base: ' + base), 'Gate commit names a gate key outside its trailers'),
        ('the trailers in the subject paragraph', block, 'Gate commit names a gate key outside its trailers'),
        ('another separator', gate_message(three) + 'Gate-Other = ' + base + '\n', 'Gate commit trailer block has a non-trailer line'),
        ('a folded value', gate_message(three) + ' ' + tree + '\n', 'Gate commit trailer block has a non-trailer line'),
        ('a paragraph after the trailers', gate_message(three) + '\nlast words\n', 'Gate commit trailer block has a non-trailer line'),
    ]


def retrail(source, **changes):
    """Changes some trailer values of a manifest source, in its message and its recorded trailers alike."""
    pairs = [[key, changes.get(key, value)] for key, value in source['trailers']]
    source.update(trailers=pairs, message=gate_message(pairs))


def recorded_trailers(message):
    """Every trailer Git parses from message as [key, value] pairs, as remote_ci.py records them."""
    parsed = subprocess.run(['git', 'interpret-trailers', '--parse'], input=message, capture_output=True, text=True, check=True).stdout
    return [list(line.partition(': ')[::2]) for line in parsed.splitlines()]


def manifest_value(directory, run_id, wt, base, facts, total=2):
    """A passing manifest of the sharded shape (speed-ci-shards): install, typecheck and lint from the static job, the
    assemble job's merge as the suite row, the static job's facts and one row per shard, every job on the manifest's
    checkout, toolchain, environment and installed lock."""
    tree, reviewed = git(wt, 'rev-parse', 'HEAD^{tree}'), git(wt, 'rev-parse', 'HEAD')
    commit, trailers, message = gate_commit(wt, reviewed, base)
    commands = []
    for name, argv in (('install', ['pnpm', 'install', '--offline', '--frozen-lockfile']), ('typecheck', ['pnpm', '-s', 'typecheck']),
                       ('lint', ['pnpm', '-s', 'lint']), ('suite', MERGE_ARGV)):
        commands.append(dict(name=name, argv=argv, exitCode=0, startedAt='2026-10-30T10:00:00Z', endedAt='2026-10-30T10:01:00Z',
                             elapsedSeconds=60, log=dict(file=name + '.log')))
    commands[-1]['report'] = dict(file='full.json')
    value = {'kind': 'remote-heavy-checks-v1', 'runId': run_id, 'directory': str(directory),
             'runner': dict(RUNNER),
             'source': dict(commit=commit, tree=tree, parents=[], trailers=trailers, message=message, status='', root=ROOT),
             'lockfile': {'pnpm-lock.yaml': blob_sha(wt, tree, 'pnpm-lock.yaml'), 'package.json': blob_sha(wt, tree, 'package.json'),
                          'installedLock': digest(Path(wt) / 'node_modules/.pnpm/lock.yaml')},
             'toolchain': {key: facts[key] for key in ('node', 'pnpm', 'platform', 'arch')},
             'environment': dict(CI='true', LC_ALL='C.UTF-8', VITEST_MAX_WORKERS='2', TZ=facts['timeZone'], timeZone=facts['timeZone']),
             'environmentKeys': ['CI', 'HOME', 'LC_ALL', 'PATH', 'TZ', 'VITEST_MAX_WORKERS'], 'resourceOverrides': dict(GOMEMLIMIT='9GiB'),
             'commands': commands, 'completed': True, 'createdAt': '2026-10-30T10:05:00Z',
             'hostAudits': dict(file=remote_checks.AUDITS, sha256=blob_sha(wt, tree, remote_checks.AUDITS)),
             'producers': {name: 'success' for name in remote_checks.PRODUCERS},
             # The static job's test:workflow row (gate-ci-workflow), beside the four command rows.
             'workflow': dict(name='workflow', argv=list(remote_checks.WORKFLOW_ARGV), exitCode=0, startedAt='2026-10-30T10:01:00Z',
                              endedAt='2026-10-30T10:03:00Z', elapsedSeconds=120, log=dict(file='workflow.log'))}
    job = dict(source={key: value['source'][key] for key in remote_checks.JOB_SOURCE}, toolchain=dict(value['toolchain']),
               environment=dict(value['environment']), environmentKeys=list(value['environmentKeys']),
               installedLock=value['lockfile']['installedLock'], runner=dict(RUNNER, job='fixture-job'))
    value['static'] = json.loads(json.dumps(job))
    value['shards'] = [dict(index=index, argv=shard_argv(index, total), exitCode=0, startedAt='2026-10-30T10:00:00Z',
                            endedAt='2026-10-30T10:01:00Z', elapsedSeconds=60, log=dict(file='shards/shard-%d.log' % index),
                            report=dict(file='shards/shard-%d.json' % index), blob=dict(file='blobs/blob-%d.json' % index),
                            job=json.loads(json.dumps(job)))
                       for index in range(1, total + 1)]
    return value


# The GitHub run every fixture job belongs to (fix r1 on split B binds each part's run id and attempt to it).
RUNNER = dict(provider='github-actions', runId='4242', attempt='2')
MERGE_ARGV = remote_checks.ARGV['suite'] + ['--merge-reports=' + ROOT + '/blobs', '--outputFile.json=' + ROOT + '/full.json']


def shard_files(total, files=FILES):
    """files split over total shards: every file in exactly one shard (empty shards when total exceeds them)."""
    return [files[index::total] for index in range(total)]


def suite_reports(total, files=FILES, **options):
    """The merged report and the shards' reports, consistent by construction: report(**options) over all files,
    and the same over each shard's files."""
    return report(files=files, **options), [report(files=part, **options) for part in shard_files(total, files)]


def split_report(value, total):
    """A valid merged report's shards, consistent with it: its test files dealt as shard_files() deals them, each
    later shard's counters counted from its own assertions (two suites per file, as report() counts them) and the
    first shard's the remainder, so every counter sums to the merged one."""
    parts = [dict(value, testResults=value['testResults'][index::total]) for index in range(total)]
    for part in parts[1:]:
        statuses = [test['status'] for item in part['testResults'] for test in item['assertionResults']]
        failed = sum(item['status'] == 'failed' for item in part['testResults'])
        part.update(numTotalTestSuites=2 * len(part['testResults']), numPassedTestSuites=2 * (len(part['testResults']) - failed),
                    numFailedTestSuites=2 * failed, numPendingTestSuites=0, numTotalTests=len(statuses),
                    numPassedTests=statuses.count('passed'), numFailedTests=statuses.count('failed'),
                    numPendingTests=statuses.count('skipped') + statuses.count('pending'), numTodoTests=statuses.count('todo'),
                    success=not failed and 'failed' not in statuses)
    parts[0].update({key: value[key] - sum(part[key] for part in parts[1:]) for key in remote_checks.COUNTERS})
    return parts


def everywhere(**changes):
    """A mutation of the manifest's facts and every job's alike: toolchain/environment dicts update, installedLock replaces."""
    def mutate(value, directory):
        for facts in [value['static']] + [row['job'] for row in value['shards']] + [None]:
            for key, change in changes.items():
                if facts is None:
                    target = value['lockfile'] if key == 'installedLock' else value
                else:
                    target = facts
                if isinstance(change, dict):
                    target[key].update(change)
                else:
                    target[key] = change
    return mutate


def write_suite(value, directory, merged=None, shards=None, **options):
    """A mutation: write the merged report and the shards' reports (default suite_reports(**options)) and rehash them."""
    default = suite_reports(len(value['shards']), **options)
    merged = default[0] if merged is None else merged
    shards = default[1] if shards is None else shards
    (directory / 'full.json').write_text(json.dumps(merged))
    value['commands'][3]['report']['sha256'] = digest(directory / 'full.json')
    for row, shard in zip(value['shards'], shards):
        (directory / row['report']['file']).write_text(json.dumps(shard))
        row['report']['sha256'] = digest(directory / row['report']['file'])


def shard_argv(index, total, root=ROOT):
    return remote_checks.ARGV['suite'] + [remote_checks.SHARD_REPORTER, '--shard=%d/%d' % (index, total),
                                          '--outputFile.json=%s/shard-%d.json' % (root, index), '--outputFile.blob=%s/blobs/blob-%d.json' % (root, index)]


def publish(orch, wt, base, run_id, mutate=None, files=None, raw=None, readonly=True, shards=2):
    """The assemble job's publication order: logs and reports, manifest last, then everything read-only (as
    remote-fetch.sh leaves it). files replaces contents by path before hashing; mutate(value, directory) runs after."""
    directory = Path(orch) / 'remote-checks' / run_id
    directory.mkdir(parents=True)
    value = manifest_value(directory, run_id, wt, base, remote_checks.local_facts(wt), shards)
    merged, parts = suite_reports(shards)
    rows = value['commands'] + [value['workflow']]
    contents = {command['name'] + '.log': 'fixture ' + command['name'] + ' output\n' for command in rows}
    contents['full.json'] = json.dumps(merged)
    for index, part in enumerate(parts, 1):
        contents['shards/shard-%d.log' % index] = 'fixture shard %d output\n' % index
        contents['shards/shard-%d.json' % index] = json.dumps(part)
        contents['blobs/blob-%d.json' % index] = '["4.0.18", "fixture blob %d"]' % index
    contents.update(files or {})
    for name, content in contents.items():
        (directory / name).parent.mkdir(parents=True, exist_ok=True)
        (directory / name).write_text(content)
    for command in rows + value['shards']:
        for key in ('log', 'report', 'blob'):
            if key in command and (directory / command[key]['file']).is_file():
                command[key]['sha256'] = digest(directory / command[key]['file'])
    if mutate:
        mutate(value, directory)
    path = directory / 'manifest.json'
    path.write_text(raw(value) if raw else json.dumps(value, indent=2))
    if readonly:
        for item in directory.rglob('*'):
            if not item.is_symlink():
                item.chmod(0o444 if item.is_file() else 0o555)
        directory.chmod(0o555)
    return path, digest(path)


def fixture_repository(root):
    """A main checkout whose implementation worktree holds one candidate on top of BASE."""
    main, wt = Path(root) / 'main', Path(root) / 'wt'
    main.mkdir(parents=True)
    git(main, 'init', '-q', '-b', 'feature')
    git(main, 'config', 'user.name', 'Fixture')
    git(main, 'config', 'user.email', 'fixture@example.test')
    (main / 'package.json').write_text('{"name":"fixture"}\n')
    (main / 'pnpm-lock.yaml').write_text('lockfileVersion: fixture\n')
    (main / '.gitignore').write_text('node_modules/\n')
    (main / 'tests').mkdir()
    for name in FILES:
        (main / name).write_text('// fixture test\n')
    (main / remote_checks.AUDITS).parent.mkdir(parents=True)
    (main / remote_checks.AUDITS).write_text(json.dumps(AUDIT_LIST, indent=2) + '\n')
    git(main, 'add', '.')
    git(main, 'commit', '-qm', 'base')
    git(main, 'worktree', 'add', '-qb', 'implementation', str(wt))
    (wt / 'source.txt').write_text('candidate\n')
    git(wt, 'add', '.')
    git(wt, 'commit', '-qm', 'candidate')
    install(wt)
    return main, wt


def install(wt):
    (Path(wt) / 'node_modules/.pnpm').mkdir(parents=True, exist_ok=True)
    (Path(wt) / 'node_modules/.pnpm/lock.yaml').write_text('installed fixture\n')
    (Path(wt) / 'node_modules/vitest').mkdir(parents=True, exist_ok=True)
    (Path(wt) / 'node_modules/vitest/vitest.mjs').write_text(VITEST_STUB)


def fixture_tools(root):
    """A pnpm stub on PATH; node is the real one (the stub vitest runs in it)."""
    binary = Path(root) / 'bin'
    binary.mkdir(exist_ok=True)
    (binary / 'pnpm').write_text('#!/bin/sh\n[ "$1" = --version ] && echo 10.29.1\nexit 0\n')
    (binary / 'pnpm').chmod(0o755)
    return binary


def writable(root):
    for path in Path(root).rglob('*'):
        if not path.is_symlink():
            path.chmod(0o755 if path.is_dir() else 0o644)


class Fixture(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.addCleanup(self.scratch.cleanup)
        self.addCleanup(writable, self.scratch.name)
        self.root = Path(self.scratch.name)
        self.orch = self.root / 'orch'
        self.orch.mkdir()
        self.main, self.wt = fixture_repository(self.root)
        self.base = git(self.main, 'rev-parse', 'HEAD')
        self.tree = git(self.wt, 'rev-parse', 'HEAD^{tree}')
        self.commit = git(self.wt, 'rev-parse', 'HEAD')
        previous = os.environ['PATH']
        os.environ['PATH'] = str(fixture_tools(self.root)) + os.pathsep + previous
        self.addCleanup(os.environ.__setitem__, 'PATH', previous)
        self.runs = 0

    def publish(self, mutate=None, **options):
        self.runs += 1
        return publish(self.orch, self.wt, self.base, 'fixture-20261030-120000-%06x' % self.runs, mutate, **options)

    def verify(self, path, sha256, commits=None, tree=None, base=None):
        return remote_checks.verify_manifest(path, sha256, tree or self.tree, base or self.base, self.wt, self.orch, commits)

    def full(self, path, sha256):
        evidence = self.root / ('evidence-%d' % self.runs)
        evidence.mkdir()
        manifest = self.verify(path, sha256)
        return remote_checks.verify_local(manifest, path, self.wt, evidence)

    def paths(self, path, sha256):
        """Every path that judges a remote suite: verify (verify_manifest, then verify_local), replace's original
        suite (remote_suite) and compare (compare_reports against a green local suite)."""
        local = self.root / ('local-%d.json' % self.runs)
        local.write_text(json.dumps(report(root='/gate')))
        return dict(verify=lambda: self.full(path, sha256),
                    replace=lambda: remote_checks.remote_suite(remote_checks.load(path, sha256, self.orch), path, self.wt),
                    compare=lambda: remote_checks.compare_reports(path, sha256, self.orch, local, self.wt / remote_checks.AUDITS))

    def refuses(self, reason, mutate=None, local=False, **options):
        path, sha256 = self.publish(mutate, **options)
        with self.assertRaisesRegex(RuntimeError, reason):
            self.full(path, sha256) if local else self.verify(path, sha256)


class RemoteManifestTest(Fixture):
    def test_passing_fixture_is_accepted_statically_and_locally(self):
        path, sha256 = self.publish()
        manifest = self.verify(path, sha256, commits={self.commit})
        self.assertEqual(manifest['source']['tree'], self.tree)
        local = self.full(path, sha256)
        self.assertEqual(local['files'], len(FILES))

    def retrailed(self, **changes):
        """A mutation giving the manifest source gate-push.sh's message with some trailer values changed, recorded alike."""
        return lambda m, d: retrail(m['source'], **changes)

    def three(self):
        return [['Gate-Reviewed', self.commit], ['Gate-Base', self.base], ['Gate-Tree', self.tree]]

    def test_identity_refusals(self):
        self.refuses('Remote tree mismatch', lambda m, d: m['source'].update(tree='0' * 40))
        self.refuses('Remote base mismatch', self.retrailed(**{'Gate-Base': self.commit}))
        path, sha256 = self.publish()
        with self.assertRaisesRegex(RuntimeError, 'Remote Gate-Reviewed is not the reviewed or prepared commit'):
            self.verify(path, sha256, commits={self.base})
        orphan = git(self.wt, 'commit-tree', self.tree, '-m', 'unrelated history with the same tree')
        self.refuses('Remote Gate-Reviewed does not descend from base', self.retrailed(**{'Gate-Reviewed': orphan}))
        self.refuses('Remote Gate-Reviewed tree mismatch', self.retrailed(**{'Gate-Reviewed': self.base}))
        self.refuses('Remote Gate-Reviewed unknown', self.retrailed(**{'Gate-Reviewed': '1' * 40}))
        self.refuses('Remote commit unknown', lambda m, d: m['source'].update(commit=self.commit[:12]))
        self.refuses('Remote source status not clean', lambda m, d: m['source'].update(status=' M source.txt'))

    def test_an_amended_sibling_with_the_same_tree_and_parent_is_not_the_reviewed_commit(self):
        """A curation candidate is its prep commit (curation-remote slice B): CI of a message-only amend of it, same
        tree and parent, never stands in for it; v1 re-preps and re-pushes."""
        sibling = git(self.wt, 'commit-tree', self.tree, '-p', self.base, '-m', 'the prep commit with another message')
        path, sha256 = self.publish(self.retrailed(**{'Gate-Reviewed': sibling}))
        self.assertEqual(self.verify(path, sha256)['source']['tree'], self.tree, 'unrestricted, the sibling is a valid gate source')
        with self.assertRaisesRegex(RuntimeError, 'Remote Gate-Reviewed is not the reviewed or prepared commit'):
            self.verify(path, sha256, commits={self.commit})

    def test_tree_only_gate_commit_refusals(self):
        """The remote commit is gate-push.sh's: parentless, Gate-Tree its tree, and its message's trailers recorded."""
        path, sha256 = self.publish()
        source = self.verify(path, sha256, commits={self.commit})['source']
        self.assertEqual(source['trailers'], self.three())
        self.assertEqual(source['trailers'], recorded_trailers(source['message']))
        self.assertEqual(git(self.wt, 'cat-file', '-p', source['commit']).count('\nparent '), 0)
        self.refuses('Gate commit has parents', lambda m, d: m['source'].update(parents=[self.base]))
        self.refuses('Gate commit parents missing', lambda m, d: m['source'].pop('parents'))
        self.refuses('Gate commit parents missing', lambda m, d: m['source'].update(parents=None))
        self.refuses('Gate commit tree is not its Gate-Tree', self.retrailed(**{'Gate-Tree': self.base}))
        self.refuses('Gate commit message missing', lambda m, d: m['source'].pop('message'))
        self.refuses('Gate commit message missing', lambda m, d: m['source'].update(message=None))
        # The recorded trailers are the message's, every one of them.
        for trailers in (None, [], {'Gate-Reviewed': self.commit}, self.three()[:2], self.three() + [['Gate-Other', self.base]],
                         self.three() + [self.three()[0]], [[key.lower(), value] for key, value in self.three()]):
            self.refuses("Gate commit trailers are not its message's", lambda m, d, trailers=trailers: m['source'].update(trailers=trailers))
        self.refuses("Gate commit trailers are not its message's", lambda m, d: m['source'].pop('trailers'))

    def test_every_message_beyond_the_three_trailers_is_refused(self):
        """The pinned corpus, as remote_ci.py records each message (Git's parse of its trailers)."""
        for name, message, reason in bad_gate_messages(self.three()):
            with self.subTest(name=name):
                self.refuses(reason, lambda m, d, message=message: m['source'].update(trailers=recorded_trailers(message), message=message))
        # A manifest of the W1 shape (the full-history candidate and its base) is refused, not reinterpreted.
        self.refuses('Unexpected remote source field: base', lambda m, d: m['source'].update(base=self.base))
        path, sha256 = self.publish()
        with self.assertRaisesRegex(RuntimeError, 'Remote tree mismatch'):
            self.verify(path, sha256, tree='2' * 40)
        with self.assertRaisesRegex(RuntimeError, 'Remote base mismatch'):
            self.verify(path, sha256, base=self.commit)

    def test_install_and_toolchain_refusals(self):
        self.refuses('Remote lockfile mismatch: pnpm-lock.yaml', lambda m, d: m['lockfile'].update({'pnpm-lock.yaml': '0' * 64}))
        self.refuses('Remote lockfile mismatch: package.json', lambda m, d: m['lockfile'].update({'package.json': '0' * 64}))
        # Every job's facts move together here (one remote host, another toolchain): the gate host refuses them.
        self.refuses('Remote installed lock mismatch', everywhere(installedLock='0' * 64), local=True)
        for key, value in (('node', 'v20.0.0'), ('pnpm', '9.0.0'), ('platform', 'darwin'), ('arch', 'arm64')):
            self.refuses('Remote toolchain mismatch: ' + key, everywhere(toolchain={key: value}), local=True)
        self.refuses('Remote timeZone mismatch', everywhere(environment=dict(TZ='Pacific/Chatham', timeZone='Pacific/Chatham')), local=True)
        path, sha256 = self.publish()
        (self.wt / 'node_modules/.pnpm/lock.yaml').write_text('another installation\n')
        with self.assertRaisesRegex(RuntimeError, 'Remote installed lock mismatch'):
            self.full(path, sha256)

    def test_environment_and_override_refusals(self):
        self.refuses('Remote environment mismatch: CI', lambda m, d: m['environment'].update(CI='false'))
        self.refuses('Remote environment mismatch: LC_ALL', lambda m, d: m['environment'].update(LC_ALL='en_US.UTF-8'))
        self.refuses('Remote environment mismatch: VITEST_MAX_WORKERS', lambda m, d: m['environment'].update(VITEST_MAX_WORKERS='4'))
        self.refuses('Remote environment mismatch: CI', lambda m, d: m['environmentKeys'].remove('CI'))
        for key in ('VITEST_POOL', 'NODE_OPTIONS', 'GOMEMLIMIT'):
            self.refuses('Remote environment override: ' + key, lambda m, d, key=key: m['environmentKeys'].append(key))
        self.refuses('Unexpected remote environment value: HOME', lambda m, d: m['environment'].update(HOME='/root'))
        self.refuses('Remote timeZone missing', lambda m, d: m['environment'].pop('timeZone'))
        self.refuses('Remote resource override not allowed: NODE_OPTIONS',
                     lambda m, d: m['resourceOverrides'].update(NODE_OPTIONS='--max-old-space-size=99999'))
        path, sha256 = self.publish(lambda m, d: m.pop('resourceOverrides'))
        self.verify(path, sha256)

    def test_argv_refusals(self):
        def change(index, argv):
            return lambda m, d: m['commands'][index].update(argv=argv)
        self.refuses('Remote argv not canonical: install', change(0, ['pnpm', 'install', '--offline']))
        self.refuses('Remote argv not canonical: typecheck', change(1, ['pnpm', 'typecheck']))
        self.refuses('Remote argv not canonical: lint', change(2, ['pnpm', '-s', 'lint', '--fix']))
        suite = ['pnpm', 'test', '--reporter=default', '--reporter=json']
        for drift in (suite + ['--outputFile.json=/out.json', 'tests/a.test.ts'], suite + ['--outputFile.json=/out.json', '--shard=1/2'],
                      suite + ['-t', 'works', '--outputFile.json=/out.json'], suite + ['--outputFile.json=relative.json'],
                      ['pnpm', 'test', '--reporter=json', '--reporter=default', '--outputFile.json=/out.json']):
            self.refuses('Remote argv not canonical: suite', change(3, drift))

    def test_completion_refusals(self):
        self.refuses('Remote commands missing or out of order', lambda m, d: m['commands'].pop(2))
        self.refuses('Remote commands missing or out of order', lambda m, d: m['commands'].insert(1, m['commands'].pop(2)))
        for value in ('0', True, 0.0, None):
            self.refuses('Remote exit code not an integer: lint', lambda m, d, value=value: m['commands'][2].update(exitCode=value))
        self.refuses('Remote command failed: typecheck', lambda m, d: m['commands'][1].update(exitCode=2))
        self.refuses('Remote run not completed', lambda m, d: m.update(completed=False))
        self.refuses('Remote timing missing: install', lambda m, d: m['commands'][0].pop('startedAt'))

    def test_the_workflow_row_is_a_canonical_passing_command(self):
        """gate-ci-workflow: the static job's test:workflow row, checked like typecheck's and lint's whenever present."""
        self.refuses('Remote argv not canonical: workflow', lambda m, d: m['workflow'].update(argv=['pnpm', 'test:workflow']))
        self.refuses('Remote argv not canonical: workflow', lambda m, d: m['workflow'].update(argv=['pnpm', '-s', 'test:workflow', '--quick']))
        for value in ('0', True, None):
            self.refuses('Remote exit code not an integer: workflow', lambda m, d, value=value: m['workflow'].update(exitCode=value))
        self.refuses('Remote command failed: workflow', lambda m, d: m['workflow'].update(exitCode=1))
        self.refuses('Remote timing missing: workflow', lambda m, d: m['workflow'].update(endedAt=None))
        self.refuses('Invalid remote workflow row', lambda m, d: m['workflow'].pop('endedAt'))
        self.refuses('Remote evidence hash mismatch: workflow log', lambda m, d: m['workflow']['log'].update(sha256='0' * 64))
        self.refuses('Remote evidence escapes directory: workflow log', lambda m, d: m['workflow']['log'].update(file='../workflow.log'))
        self.refuses('Invalid remote workflow row', lambda m, d: m['workflow'].update(report=dict(m['workflow']['log'])))
        self.refuses('Invalid remote workflow row', lambda m, d: m['workflow'].update(name='lint'))
        self.refuses('Remote workflow row missing', lambda m, d: m.update(workflow=None))
        self.refuses('Remote workflow row missing', lambda m, d: m.update(workflow=[m['workflow']]))

    def test_the_workflow_row_is_optional_until_required(self):
        """Widen then narrow: without REQUIRE_WORKFLOW a manifest without the row still passes (the shape MAIN's verifier
        before gate-ci-workflow accepts); with it, the row is required. Both settings are checked, so the one-line flip
        on t3/gate-ci-workflow-require changes no test."""
        without = lambda m, d: m.pop('workflow')
        with mock.patch.object(remote_checks, 'REQUIRE_WORKFLOW', False):
            self.verify(*self.publish())
            self.verify(*self.publish(without))
        with mock.patch.object(remote_checks, 'REQUIRE_WORKFLOW', True):
            self.verify(*self.publish())
            self.refuses('Remote workflow row missing', without)

    def test_suite_refusals(self):
        def suite(**changes):
            return {'full.json': json.dumps(report(**changes))}
        self.refuses('Remote suite was not all green', files=suite(success=False, numFailedTests=1, numPassedTests=1))
        self.refuses('Remote assertions do not reconcile with numPendingTests', files=suite(numPendingTests=1))
        self.refuses('Remote suite has pending or todo tests: not in the host-audit list: tests/a.test.ts > suite tests/a.test.ts works',
                     files=suite(skipped=FILES[:1]))
        self.refuses('Remote suite was not all green', files=suite(numTodoTests=1))
        self.refuses('Remote suite file not passed: tests/b.test.ts', files={'full.json': json.dumps(failed_file(report()))})
        self.refuses('Remote suite was not all green', files={'full.json': json.dumps(failed_suite(report()))})
        # Vitest 4 counts a skipped suite as passed; a pending suite is an unfinished run or a todo suite.
        self.refuses('Remote suite was not all green', files=suite(numPassedTestSuites=3, numPendingTestSuites=1))
        # Vitest 4 never writes a skipped file (JsonReporter: failed or passed), so none is accepted.
        skipped_file = report(skipped=(AUDITED[0],))
        skipped_file['testResults'][1]['status'] = 'skipped'
        self.refuses('Remote suite file not passed: tests/b.test.ts', files={'full.json': json.dumps(skipped_file)})
        for key in ('added', 'updated', 'filesAdded', 'unmatched'):
            self.refuses('Remote suite wrote snapshots', files=suite(snapshot={**report()['snapshot'], key: 1}))
        outside = report()
        outside['testResults'][0]['name'] = '/elsewhere/tests/a.test.ts'
        self.refuses('Remote test file outside its root', files={'full.json': json.dumps(outside)})
        path, sha256 = self.publish()
        os.environ['FIXTURE_VITEST_LIST'] = json.dumps([dict(file=str(self.wt / name)) for name in (*FILES, 'tests/c.test.ts')])
        try:
            with self.assertRaisesRegex(RuntimeError, 'Remote test file set differs: .*tests/c.test.ts'):
                self.full(path, sha256)
        finally:
            os.environ.pop('FIXTURE_VITEST_LIST')

    def test_a_listed_host_audit_may_skip_remotely(self):
        path, sha256 = self.publish(lambda m, d: write_suite(m, d, skipped=(AUDITED[0],)))
        self.assertEqual(self.full(path, sha256)['files'], len(FILES))
        path, sha256 = self.publish(lambda m, d: write_suite(m, d, skipped=(AUDITED[0],), beside=FILES))
        self.assertEqual(self.full(path, sha256)['files'], len(FILES))
        path, sha256 = self.publish()
        self.assertEqual(self.full(path, sha256)['files'], len(FILES))

    def test_host_audit_refusals(self):
        missing = report()
        missing['testResults'][1]['assertionResults'][0].update(title='renamed', fullName='suite tests/b.test.ts renamed')
        self.refuses('Remote suite lacks a host-audit test: tests/b.test.ts > suite tests/b.test.ts works',
                     files={'full.json': json.dumps(missing)})
        self.refuses('Remote host-audit list hash mismatch', lambda m, d: m['hostAudits'].update(sha256='0' * 64))
        self.refuses('Remote host-audit list missing', lambda m, d: m.pop('hostAudits'))
        self.refuses('Remote host-audit list missing', lambda m, d: m['hostAudits'].update(file='host-audits.json'))
        todo = report(skipped=(AUDITED[0],), numPendingTests=0, numTodoTests=1)
        todo['testResults'][1]['assertionResults'][0]['status'] = 'todo'
        self.refuses('Remote suite was not all green', files={'full.json': json.dumps(todo)})
        failed = report(success=False, numPassedTests=1, numFailedTests=1, numPassedTestSuites=2, numFailedTestSuites=2)
        failed['testResults'][1].update(status='failed')
        failed['testResults'][1]['assertionResults'][0]['status'] = 'failed'
        self.refuses('Remote suite was not all green', files={'full.json': json.dumps(failed)})

    def test_the_candidate_must_carry_a_well_formed_list(self):
        for value, reason in ((dict(AUDIT_LIST, kind='other'), 'Invalid host-audit list'),
                              (dict(AUDIT_LIST, tests=[]), 'Invalid host-audit list'),
                              (dict(AUDIT_LIST, tests=AUDIT_LIST['tests'] * 2), 'Host-audit list not sorted and unique'),
                              (dict(AUDIT_LIST, tests=[dict(file='../b.test.ts', fullName='x')]), 'Invalid host-audit list'),
                              (dict(AUDIT_LIST, extra=1), 'Invalid host-audit list')):
            with self.subTest(reason=reason, value=value):
                (self.wt / remote_checks.AUDITS).write_text(json.dumps(value))
                git(self.wt, 'commit', '-qam', 'list')
                self.tree = git(self.wt, 'rev-parse', 'HEAD^{tree}')
                self.refuses(reason)
        git(self.wt, 'rm', '-q', remote_checks.AUDITS)
        git(self.wt, 'commit', '-qm', 'no list')
        self.tree = git(self.wt, 'rev-parse', 'HEAD^{tree}')
        self.refuses('Host-audit list missing from the candidate', lambda m, d: m['hostAudits'].update(sha256='0' * 64))

    def test_assertion_evidence_must_reconcile_with_the_counters(self):
        def suite(value):
            return {'full.json': json.dumps(value)}
        vacuous = report()
        for item in vacuous['testResults']:
            item['assertionResults'] = []
        self.refuses('Remote test file has no assertions: tests/a.test.ts', files=suite(vacuous))
        one = report()
        one['testResults'][1]['assertionResults'] = []
        self.refuses('Remote test file has no assertions: tests/b.test.ts', files=suite(one))
        extra = report()
        extra['testResults'][0]['assertionResults'].append(dict(extra['testResults'][0]['assertionResults'][0], title='again',
                                                                fullName='suite tests/a.test.ts again'))
        self.refuses('Remote assertions do not reconcile with numTotalTests', files=suite(extra))
        self.refuses('Remote assertions do not reconcile with numTotalTests', files=suite(report(numTotalTests=3, numPassedTests=3)))
        for change in (dict(fullName=''), dict(title=''), dict(fullName='another name'), dict(ancestorTitles='suite tests/a.test.ts'),
                       dict(title=None)):
            bad = report()
            bad['testResults'][0]['assertionResults'][0].update(change)
            self.refuses('Remote assertion identity invalid in tests/a.test.ts', files=suite(bad))
        # Real parameterised titles can repeat within a file (770b2a: 15 such names): counted, never collapsed.
        repeated = report(numTotalTests=3, numPassedTests=3)
        repeated['testResults'][0]['assertionResults'].append(dict(repeated['testResults'][0]['assertionResults'][0]))
        path, sha256 = self.publish(lambda m, d: write_suite(m, d, repeated, split_report(repeated, 2)))
        self.assertEqual(self.full(path, sha256)['files'], len(FILES))

    def test_evidence_integrity_refusals(self):
        path, sha256 = self.publish()
        outside = self.root / 'outside.json'
        outside.write_text('{}')
        self.refuses('Remote report not allowed: typecheck',
                     lambda m, d: m['commands'][1].update(report=dict(file=str(outside), sha256='0' * 64)))
        self.refuses('Remote report not allowed: lint',
                     lambda m, d: m['commands'][2].update(report=dict(m['commands'][2]['log'])))
        with self.assertRaisesRegex(RuntimeError, 'Remote manifest hash mismatch'):
            self.verify(path, '0' * 64)
        self.refuses('Remote evidence hash mismatch: lint log', lambda m, d: (d / 'lint.log').write_text('rewritten after hashing\n'))
        self.refuses('Remote evidence hash mismatch: suite report', lambda m, d: m['commands'][3]['report'].update(sha256='0' * 64))
        def symlink(m, d):
            (d / 'lint.log').unlink()
            (d / 'lint.log').symlink_to(d / 'install.log')
            m['commands'][2]['log']['sha256'] = digest(d / 'install.log')
        self.refuses('Remote evidence symlink: lint log', symlink)
        self.refuses('Remote evidence escapes directory: lint log', lambda m, d: m['commands'][2]['log'].update(file='../lint.log'))
        self.refuses('Remote evidence escapes directory: lint log', lambda m, d: m['commands'][2]['log'].update(file=str(d / 'lint.log')))
        self.refuses('Remote directory is not the manifest parent', lambda m, d: m.update(directory=str(self.orch / 'elsewhere')))
        self.refuses('Remote evidence writable', readonly=False)
        self.refuses('Duplicate JSON field: completed', raw=lambda m: json.dumps(m)[:-1] + ', "completed": true}')
        self.refuses('Invalid remote runId', lambda m, d: m.update(runId='Fixture_bad'))
        moved = self.root / 'moved'
        shutil.copytree(path.parent, moved / 'remote-checks' / path.parent.name)
        with self.assertRaisesRegex(RuntimeError, 'Remote manifest outside ORCH/remote-checks'):
            self.verify(moved / 'remote-checks' / path.parent.name / 'manifest.json', sha256)
        linked = self.orch / 'remote-checks' / 'fixture-20261030-120000-ffffff'
        linked.symlink_to(path.parent)
        with self.assertRaisesRegex(RuntimeError, 'Remote manifest path not canonical'):
            self.verify(linked / 'manifest.json', sha256)

    def test_config_refusals(self):
        path, sha256 = self.publish()
        self.assertEqual(remote_checks.config(dict(path=str(path), sha256=sha256, mode='replace'))['mode'], 'replace')
        for value in (dict(path=str(path), sha256=sha256, mode='skip'), dict(path=str(path), sha256=sha256),
                      dict(path=str(path), sha256=sha256, mode='compare', fallback='local'), 'replace'):
            with self.assertRaisesRegex(RuntimeError, 'remoteChecks'):
                remote_checks.config(value)


class ShardedManifestTest(Fixture):
    """The sharded shape (speed-ci-shards): N shard jobs, a static job and the assemble job's merged suite."""
    def shard(self, number, **changes):
        return lambda m, d: m['shards'][number - 1].update(changes)

    def facts(self, index, key, value):
        """A mutation of one job's facts: shard <index>, or the static job when index is 0."""
        def mutate(m, d):
            facts = m['static'] if index == 0 else m['shards'][index - 1]['job']
            if isinstance(facts[key], dict) and isinstance(value, dict):
                facts[key].update(value)
            else:
                facts[key] = value
        return mutate

    def test_a_sharded_manifest_passes_on_every_path(self):
        for shards in (2, 1):
            path, sha256 = self.publish(shards=shards)
            manifest = self.verify(path, sha256, commits={self.commit})
            self.assertEqual([row['index'] for row in manifest['shards']], list(range(1, shards + 1)))
            for name, run in self.paths(path, sha256).items():
                with self.subTest(shards=shards, path=name):
                    run()

    def test_a_listed_host_audit_skip_in_a_shard_passes(self):
        path, sha256 = self.publish(lambda m, d: write_suite(m, d, skipped=(AUDITED[0],)))
        self.assertEqual(self.full(path, sha256)['files'], len(FILES))

    def test_the_shard_evidence_corpus_is_refused_on_every_path(self):
        """Root's fix r1 ruling, one rule: each shard report stands alone (non-empty, the remote verdict with the
        host-audit allowance, no snapshot write, counters reconciled) and the merged report is exactly their
        composition (files pairwise disjoint and the same, each file's status and assertions its shard's, counters
        the sums). The pinned corpus covers every way a shard report or the merge can break it, the reviewers'
        probes included, and each is refused by verify, replace and compare alike."""
        for name, options, mutate, reason in shard_corpus():
            path, sha256 = self.publish(mutate, **options)
            for route, run in self.paths(path, sha256).items():
                with self.subTest(case=name, path=route), self.assertRaisesRegex(RuntimeError, reason):
                    run()

    def test_the_single_job_shape_is_refused_however_it_is_reached(self):
        """No legacy downgrade (fix r1): a manifest without both `shards` and `static` is refused before anything
        it carries is read, so stripping them cannot discard refused shard evidence (the standards probe)."""
        legacy = remote_checks.ARGV['suite'] + ['--outputFile.json=' + ROOT + '/full.json']
        def strip(*keys, argv=None):
            def mutate(m, d):
                write_suite(m, d, shards=[report(files=part, snapshot={**report()['snapshot'], 'added': 1}) for part in shard_files(2)])
                for key in keys:
                    m.pop(key)
                if argv:
                    m['commands'][3]['argv'] = argv
            return mutate
        for keys in (('shards', 'static'), ('shards',), ('static',)):
            for argv in (legacy, None):
                with self.subTest(keys=keys, argv=argv):
                    self.refuses('Remote manifest is not sharded: the single-job shape is refused', strip(*keys, argv=argv))
        self.refuses('Remote shard 1 suite wrote snapshots', strip())
        self.refuses('Remote argv not canonical: suite', lambda m, d: m['commands'][3].update(argv=legacy))

    def test_the_shard_set_must_be_exactly_one_to_n(self):
        self.refuses('Remote shards incomplete: 1 of 2', lambda m, d: m['shards'].pop())
        self.refuses('Remote shards incomplete: 1 of 2', lambda m, d: m['shards'].pop(0))
        self.refuses('Remote shard index repeated: 1', lambda m, d: m['shards'].__setitem__(1, json.loads(json.dumps(m['shards'][0]))))
        self.refuses('Remote shards out of order', lambda m, d: m['shards'].reverse())
        self.refuses('Remote shards disagree on their count', self.shard(2, argv=shard_argv(2, 3)))
        self.refuses('Remote shards missing', lambda m, d: m.update(shards=[]))
        self.refuses('Remote shards missing', lambda m, d: m.update(shards=None))
        self.refuses('Invalid remote shard row: shard 1', self.shard(1, index='1'))
        self.refuses('Invalid remote shard row: shard 1', self.shard(1, extra=True))

    def test_a_failed_shard_is_refused(self):
        self.refuses('Remote shard failed: 2', self.shard(2, exitCode=1))
        self.refuses('Remote exit code not an integer: shard 2', self.shard(2, exitCode='0'))
        self.refuses('Remote shard failed: 2', self.shard(2, exitCode=143))
        self.refuses('Remote timing missing: shard 1', lambda m, d: m['shards'][0].pop('elapsedSeconds'))

    def test_shard_evidence_must_be_hashed_present_and_in_place(self):
        self.refuses('Remote evidence hash mismatch: shard 2 blob', lambda m, d: m['shards'][1]['blob'].update(sha256='0' * 64))
        self.refuses('Remote evidence hash mismatch: shard 1 log', lambda m, d: (d / 'shards/shard-1.log').write_text('rewritten\n'))
        self.refuses('Remote evidence hash mismatch: shard 1 report', lambda m, d: m['shards'][0]['report'].update(sha256='0' * 64))
        self.refuses('Missing remote evidence: shard 2 blob', lambda m, d: (d / 'blobs/blob-2.json').unlink())
        self.refuses('Missing remote evidence: shard 2 report', lambda m, d: (d / 'shards/shard-2.json').unlink())
        self.refuses('Invalid remote evidence reference: shard 2 log', lambda m, d: m['shards'][1].pop('log'))
        self.refuses('Invalid remote evidence reference: shard 2 report', lambda m, d: m['shards'][1].pop('report'))
        self.refuses('Remote shard blob misplaced: shard 2', lambda m, d: m['shards'][1].pop('blob'))
        self.refuses('Remote shard blob misplaced: shard 2', lambda m, d: m['shards'][1]['blob'].update(file='shards/shard-2.log'))
        # --merge-reports reads every file in blobs/, so nothing else may sit there.
        self.refuses('Remote blobs are not exactly the shards', files={'blobs/blob-3.json': '["4.0.18"]'})
        self.refuses('Remote evidence escapes directory: shard 1 log', lambda m, d: m['shards'][0]['log'].update(file='../install.log'))

    def test_every_job_must_be_the_manifests_toolchain_environment_and_checkout(self):
        for index, name in ((2, 'shard 2'), (0, 'static job')):
            with self.subTest(job=name):
                self.refuses('Remote %s toolchain mismatch' % name, self.facts(index, 'toolchain', dict(node='v20.0.0')))
                self.refuses('Remote %s toolchain mismatch' % name, self.facts(index, 'toolchain', dict(arch='arm64')))
                self.refuses('Remote %s environment mismatch' % name, self.facts(index, 'environment', dict(VITEST_MAX_WORKERS='4')))
                self.refuses('Remote %s environment mismatch' % name, self.facts(index, 'environment', dict(timeZone='Pacific/Chatham')))
                self.refuses('Remote %s environment mismatch' % name, self.facts(index, 'environmentKeys', ['CI', 'HOME', 'LC_ALL', 'NODE_OPTIONS', 'PATH']))
                self.refuses('Remote %s installed lock mismatch' % name, self.facts(index, 'installedLock', '0' * 64))
                self.refuses('Remote %s source mismatch' % name, self.facts(index, 'source', dict(tree='0' * 40)))
                self.refuses('Remote %s source mismatch' % name, self.facts(index, 'source', dict(status=' M source.txt')))
                self.refuses('Remote %s source mismatch' % name, self.facts(index, 'source', dict(root='/elsewhere')))
                self.refuses('Invalid remote job facts: ' + name, self.facts(index, 'runner', None))
        self.refuses('Remote shard 1 missing', self.shard(1, job=None))
        self.refuses('Remote static job missing', lambda m, d: m.update(static=None))

    def test_argv_must_be_the_canonical_shard_and_merge(self):
        suite = remote_checks.ARGV['suite']
        for argv in (shard_argv(2, 2), shard_argv(1, 2)[:-1], shard_argv(1, 2) + ['tests/a.test.ts'], shard_argv(3, 2),
                     [*suite, '--reporter=json', *shard_argv(1, 2)[5:]], [*shard_argv(1, 2)[:6], '--outputFile.json=relative.json', shard_argv(1, 2)[7]],
                     [*shard_argv(1, 2)[:5], '-t', 'works', *shard_argv(1, 2)[5:]], [*shard_argv(1, 2)[:5], '--shard=01/2', *shard_argv(1, 2)[6:]]):
            with self.subTest(argv=argv):
                self.refuses('Remote argv not canonical: shard 1', self.shard(1, argv=argv))
        merge = lambda *tail: lambda m, d: m['commands'][3].update(argv=[*suite, *tail])
        self.refuses('Remote argv not canonical: suite', merge('--outputFile.json=/out.json'))
        self.refuses('Remote argv not canonical: suite', merge('--merge-reports=/run/other', '--outputFile.json=/out.json'))
        self.refuses('Remote argv not canonical: suite', merge('--outputFile.json=/out.json', '--merge-reports=/run/blobs'))
        self.refuses('Remote argv not canonical: suite', merge('--merge-reports=/run/blobs', '--outputFile.json=/out.json', 'tests/a.test.ts'))

    def test_the_gate_hosts_file_list_still_binds_a_sharded_suite(self):
        path, sha256 = self.publish()
        os.environ['FIXTURE_VITEST_LIST'] = json.dumps([dict(file=str(self.wt / name)) for name in (*FILES, 'tests/c.test.ts')])
        try:
            with self.assertRaisesRegex(RuntimeError, 'Remote test file set differs: .*tests/c.test.ts'):
                self.full(path, sha256)
        finally:
            os.environ.pop('FIXTURE_VITEST_LIST')


class AttemptTest(Fixture):
    """Fix r1 on split B: a failed rerun must never pass on an earlier attempt's parts. Every part (the static job and
    each shard) must name the manifest's own GitHub run id and attempt, and both producer jobs' needs results must be
    success. The pinned corpus covers every part and every way its run binding or a producer result can differ, and
    each is refused by verify, replace and compare alike."""
    def test_the_attempt_and_producer_corpus_is_refused_on_every_path(self):
        for name, mutate, reason in attempt_corpus():
            path, sha256 = self.publish(mutate)
            for route, run in self.paths(path, sha256).items():
                with self.subTest(case=name, path=route), self.assertRaisesRegex(RuntimeError, reason):
                    run()

    def test_the_reviewers_rerun_probe_is_refused(self):
        """Spec r1 #1: attempt 1 left a green shard-2 part; attempt 2's shard 2 failed in setup and uploaded nothing, so the
        assemble job of attempt 2 (needs.remote-shard failure) found attempt 1's part. Whatever it records, it refuses."""
        def rerun(m, d):
            m['shards'][1]['job']['runner'].update(attempt='1')
            m['producers']['remote-shard'] = 'failure'
        path, sha256 = self.publish(rerun)
        for route, run in self.paths(path, sha256).items():
            with self.subTest(path=route), self.assertRaisesRegex(RuntimeError, 'Remote producer job did not succeed: remote-shard failure'):
                run()
        # Even had the producers' results been lost or rewritten, the stale part is bound to its own attempt.
        path, sha256 = self.publish(lambda m, d: m['shards'][1]['job']['runner'].update(attempt='1'))
        with self.assertRaisesRegex(RuntimeError, 'Remote shard 2 is from another run or attempt'):
            self.full(path, sha256)

    def test_the_matching_run_and_attempt_pass(self):
        path, sha256 = self.publish()
        self.assertEqual(self.full(path, sha256)['files'], len(FILES))


def attempt_corpus():
    """(name, mutation, refusal) for every part's run binding and every producer result (fix r1 on split B)."""
    def part(index, **changes):
        def mutate(m, d):
            runner = (m['static'] if index == 0 else m['shards'][index - 1]['job'])['runner']
            for key, value in changes.items():
                if value is None:
                    runner.pop(key)
                else:
                    runner[key] = value
        return mutate
    def manifest_runner(**changes):
        return lambda m, d: [m['runner'].pop(key) if value is None else m['runner'].update({key: value}) for key, value in changes.items()]
    def producer(**changes):
        return lambda m, d: [m['producers'].pop(key) if value is None else m['producers'].update({key: value}) for key, value in changes.items()]
    cases = []
    for index, label in ((0, 'static job'), (1, 'shard 1'), (2, 'shard 2')):
        for name, change in (('an earlier attempt', dict(attempt='1')), ('a later attempt', dict(attempt='3')),
                             ('another run', dict(runId='4241')), ('no attempt', dict(attempt=None)), ('no run id', dict(runId=None)),
                             ('an integer attempt', dict(attempt=2)), ('an empty attempt', dict(attempt=''))):
            cases.append(('%s from %s' % (label, name), part(index, **change), 'Remote %s is from another run or attempt' % label))
    for name, change in (('no run id', dict(runId=None)), ('no attempt', dict(attempt=None)), ('an empty attempt', dict(attempt='')),
                         ('a local runner', dict(provider='local'))):
        cases.append(('a manifest runner with ' + name, manifest_runner(**change), 'Remote run id or attempt missing'))
    for producer_name in remote_checks.PRODUCERS:
        for result in ('failure', 'cancelled', 'skipped', '', 'Success'):
            cases.append(('%s %r' % (producer_name, result), producer(**{producer_name: result}),
                          'Remote producer job did not succeed: %s %s' % (producer_name, result)))
        cases.append(('%s result missing' % producer_name, producer(**{producer_name: None}), 'Remote producer results missing'))
    cases.append(('an extra producer', producer(**{'remote-other': 'success'}), 'Remote producer results missing'))
    cases.append(('no producer results', lambda m, d: m.pop('producers'), 'Remote producer results missing'))
    return cases


def failed_report(files):
    """A shard report whose last file failed, counted and reconciled as Vitest counts it (the file and its two suites failed)."""
    value = report(files=files, success=False, numPassedTests=len(files) - 1, numFailedTests=1,
                   numPassedTestSuites=2 * len(files) - 2, numFailedTestSuites=2)
    value['testResults'][-1]['status'] = 'failed'
    value['testResults'][-1]['assertionResults'][0]['status'] = 'failed'
    return value


def shard_corpus():
    """(name, publish options, mutation, refusal) for every way shard evidence can break the one rule (root, fix r1):
    each shard report standing alone, the merge exactly their composition. Two shards over FILES unless the options say."""
    a, b = FILES
    c = 'tests/c.test.ts'
    def reports(merged=None, **shards):
        """write_suite with the fixture's green shards, but shard<i>=value."""
        return lambda m, d: write_suite(m, d, merged, [shards.get('shard%d' % index, report(files=part))
                                                       for index, part in enumerate(shard_files(len(m['shards'])), 1)])
    todo = report(files=(b,), skipped=(b,), numPendingTests=0, numTodoTests=1)
    todo['testResults'][0]['assertionResults'][0]['status'] = 'todo'
    bare = report(files=(a,))
    bare['testResults'][0]['assertionResults'] = []
    snapshot = lambda key: report(files=(b,), snapshot={**report()['snapshot'], key: 1})
    return [
        # Each shard report stands alone.
        ('an empty shard: three shards over two files', dict(shards=3), None, 'Remote shard 3 is empty'),
        ('a shard report with no test files', {}, reports(shard2=report(files=())), 'Remote shard 2 is empty'),
        ('a shard report without testResults', {}, reports(shard1=dict(report(files=(a,)), testResults=None)), 'Remote shard 1 is empty'),
        ('a failed shard beside a green merge', {}, reports(shard2=failed_report((b,))), 'Remote shard 2 suite was not all green'),
        ('a failed file under green shard counters', {}, reports(shard2=failed_file(report(files=(b,)))),
         'Remote shard 2 suite file not passed: tests/b.test.ts'),
        ('a failed suite counted in a shard', {}, reports(shard2=failed_suite(report(files=(b,)))), 'Remote shard 2 suite was not all green'),
        ('an unsuccessful shard', {}, reports(shard1=report(files=(a,), success=False)), 'Remote shard 1 suite was not all green'),
        ('an unlisted skip in a shard', {}, reports(shard1=report(files=(a,), skipped=(a,))),
         'Remote shard 1 suite has pending or todo tests: not in the host-audit list: tests/a.test.ts'),
        ('a todo test in a shard', {}, reports(shard2=todo), 'Remote shard 2 suite was not all green'),
        ('shard counters that do not reconcile', {}, reports(shard1=report(files=(a,), numTotalTests=2, numPassedTests=2)),
         'Remote shard 1 assertions do not reconcile with numTotalTests'),
        ('a shard file without assertions', {}, reports(shard1=bare), 'Remote shard 1 test file has no assertions: tests/a.test.ts'),
        *(('a shard snapshot write: ' + key, {}, reports(shard2=snapshot(key)), 'Remote shard 2 suite wrote snapshots')
          for key in remote_checks.SNAPSHOT_WRITES),
        ('a shard file outside its root', {}, reports(shard1=report(files=(a,), root='/elsewhere')), 'Remote shard 1 test file outside its root'),
        ('a file twice within one shard', {}, reports(shard1=report(files=(a, a))), 'Remote shard 1 suite lists a test file more than once: tests/a.test.ts'),
        # The merge is exactly the shards' composition.
        ('overlapping shards with the merge repeating the file (spec probe)', {}, reports(report(files=(a, b, b)), shard1=report(files=(a, b))),
         'Remote suite lists a test file more than once: tests/b.test.ts'),
        ('overlapping shards with the merge listing each file once', {}, reports(report(files=(a, b)), shard1=report(files=(a, b))),
         'Remote test file in two shards: tests/b.test.ts'),
        ('a merged file no shard ran', {}, reports(report(files=(a, b, c))), "Remote merged files are not the shards' files: only merged tests/c.test.ts"),
        ('a shard file the merge dropped', {}, reports(report(files=(b,))), "Remote merged files are not the shards' files: only merged -; only in shards tests/a.test.ts"),
        ("a merged file whose statuses are not its shard's", {}, reports(report(skipped=(b,))), "Remote merged file is not its shard's: tests/b.test.ts"),
        ("a merged file with assertions its shard lacks", {}, reports(report(beside=(a,))), "Remote merged file is not its shard's: tests/a.test.ts"),
        ('merged counters that are not the shard sums', {}, reports(report(numTotalTestSuites=5, numPassedTestSuites=5)),
         'Remote merged counters are not the shard sums: numTotalTestSuites, numPassedTestSuites'),
        # The rows that carry them.
        ('a missing shard', {}, lambda m, d: m['shards'].pop(), 'Remote shards incomplete: 1 of 2'),
        ('a repeated shard index', {}, lambda m, d: m['shards'].__setitem__(1, json.loads(json.dumps(m['shards'][0]))), 'Remote shard index repeated: 1'),
        ('a failed shard exit', {}, lambda m, d: m['shards'][1].update(exitCode=1), 'Remote shard failed: 2'),
        ('a shard report hash mismatch', {}, lambda m, d: m['shards'][1]['report'].update(sha256='0' * 64), 'Remote evidence hash mismatch: shard 2 report'),
        ('a shard on another toolchain', {}, lambda m, d: m['shards'][1]['job']['toolchain'].update(node='v20.0.0'), 'Remote shard 2 toolchain mismatch'),
        ('the single-job shape (standards probe)', {}, lambda m, d: [m.pop('shards'), m.pop('static')], 'Remote manifest is not sharded'),
    ]


FIXTURE_TEST = '''import { describe, expect, it } from 'vitest';
describe('suite %(name)s', () => {
  it('works', () => { expect(%(value)s).toBe(1); });
  it('matches', () => { expect({ name: '%(name)s' }).toMatchInlineSnapshot(`
    {
      "name": "%(name)s",
    }
  `); });
  %(extra)s
});
'''


class MergedReportTest(unittest.TestCase):
    """Vitest's merged JSON report (--merge-reports of blob shards) has the shape the verifier reads: a real
    two-shard run of a four-file fixture project with the repository's Vitest, its merge, and one unsharded run."""
    NAMES = ('a', 'b', 'c', 'd')

    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name) / 'project'
        (self.root / 'tests').mkdir(parents=True)
        (self.root / 'node_modules').symlink_to(HERE.parent.parent / 'node_modules')
        (self.root / 'vitest.config.mjs').write_text("export default { test: { include: ['tests/**/*.test.ts'] } };\n")
        # b's `skips` is the fixture's host audit: a listed test that skips remotely.
        self.listed = frozenset({('tests/b.test.ts', 'suite b skips')})
        self.write()

    def write(self, failing=()):
        for name in self.NAMES:
            (self.root / 'tests' / (name + '.test.ts')).write_text(FIXTURE_TEST % dict(
                name=name, value=2 if name in failing else 1, extra="it.skip('skips', () => {});" if name == 'b' else ''))

    def vitest(self, *args):
        """`pnpm test`'s Vitest with the pinned environment, as remote_ci.py runs it."""
        env = {'PATH': os.environ['PATH'], 'HOME': os.environ.get('HOME', ''), **remote_checks.ENVIRONMENT}
        return subprocess.run(['node', './node_modules/vitest/vitest.mjs', 'run', *args], cwd=self.root, env=env, capture_output=True, text=True)

    def sharded(self):
        """Two shards with remote_ci.py's shard reporters, then the canonical merge; the merged and shard reports."""
        out = Path(self.scratch.name) / 'run'
        if out.exists():
            shutil.rmtree(out)
        (out / 'blobs').mkdir(parents=True)
        codes = []
        for index in (1, 2):
            ran = self.vitest(*shard_argv(index, 2, str(out))[2:])
            codes.append(ran.returncode)
            self.assertTrue((out / ('blobs/blob-%d.json' % index)).is_file(), ran.stdout + ran.stderr)
        merged = self.vitest('--merge-reports=' + str(out / 'blobs'), *remote_checks.ARGV['suite'][2:], '--outputFile.json=' + str(out / 'full.json'))
        codes.append(merged.returncode)
        reports = [json.loads((out / name).read_text()) for name in ('full.json', 'shard-1.json', 'shard-2.json')]
        return codes, reports

    def test_the_merged_report_is_the_unsharded_report_for_the_verdict(self):
        codes, (merged, *shards) = self.sharded()
        self.assertEqual(codes, [0, 0, 0])
        single = self.vitest(*remote_checks.ARGV['suite'][2:], '--outputFile.json=' + str(Path(self.scratch.name) / 'single.json'))
        self.assertEqual(single.returncode, 0, single.stdout + single.stderr)
        single = json.loads((Path(self.scratch.name) / 'single.json').read_text())
        self.assertEqual(sorted(merged), sorted(single))
        self.assertEqual({key: merged[key] for key in remote_checks.COUNTERS}, {key: single[key] for key in remote_checks.COUNTERS})
        self.assertIs(merged['success'], True)
        # The remote verdict, on the real merged report, equals the one on the unsharded run.
        root = str(self.root.resolve())
        tests = remote_checks.judged(merged, root, 'Remote', self.listed)
        self.assertEqual(tests, remote_checks.assertions(single, root, 'Local'))
        self.assertEqual(sum(tests.values()), 4 * 2 + 1)
        # Each real shard report stands alone, and the real merge is exactly their composition: files disjoint and
        # the same, each file's status and assertions its shard's, every counter the shards' sum.
        for index, shard in enumerate(shards, 1):
            self.assertTrue(shard['testResults'])
            remote_checks.judged(shard, root, 'Remote shard %d' % index, self.listed)
        remote_checks.composition(merged, shards, root)
        names = lambda value: sorted(item['name'] for item in value['testResults'])
        self.assertEqual(sorted(names(shards[0]) + names(shards[1])), names(merged))
        self.assertEqual({key: sum(value[key] for value in shards) for key in remote_checks.COUNTERS},
                         {key: merged[key] for key in remote_checks.COUNTERS})
        # The merge never sees snapshot state, so its summary is empty; each shard's own report counts its snapshots.
        self.assertEqual((merged['snapshot']['matched'], merged['snapshot']['total']), (0, 0))
        self.assertEqual(single['snapshot']['matched'], 4)
        self.assertEqual(sum(value['snapshot']['matched'] for value in shards), 4)
        for value in (merged, *shards):
            self.assertTrue(all(value['snapshot'][key] == 0 for key in remote_checks.SNAPSHOT_WRITES))

    def test_a_failure_in_one_shard_fails_the_merge_and_the_verdict(self):
        self.write(failing=('c',))
        codes, (merged, *shards) = self.sharded()
        self.assertEqual(sorted(codes[:2]), [0, 1])
        self.assertEqual(codes[2], 1)
        self.assertIs(merged['success'], False)
        root = str(self.root.resolve())
        remote_checks.composition(merged, shards, root)
        failed = [index for index, shard in enumerate(shards, 1) if shard['success'] is False]
        self.assertEqual(len(failed), 1)
        with self.assertRaisesRegex(RuntimeError, 'Remote shard %d suite was not all green' % failed[0]):
            remote_checks.judged(shards[failed[0] - 1], root, 'Remote shard %d' % failed[0], self.listed)
        with self.assertRaisesRegex(RuntimeError, 'Remote suite was not all green'):
            remote_checks.judged(merged, root, 'Remote', self.listed)


class RemoteComparisonTest(Fixture):
    def compare(self, local, remote=None, merged_only=False):
        """compare_reports against local; remote replaces the merged report, its shards split from it (split_report)
        or, merged_only, the fixture's green shards (so the merged report alone is judged)."""
        mutate = remote and (lambda m, d: write_suite(m, d, remote, None if merged_only else split_report(remote, 2)))
        path, sha256 = self.publish(mutate or None)
        local_path = self.root / ('local-%d.json' % self.runs)
        local_path.write_text(json.dumps(local))
        return remote_checks.compare_reports(path, sha256, self.orch, local_path, self.wt / remote_checks.AUDITS)

    def test_equal_reports_compare_from_another_root(self):
        result = self.compare(report(root='/home/fixture/ep-gate-wt-20261030-120000-abc123'))
        self.assertEqual((result['tests'], result['hostAudits']), (len(FILES), dict(listed=1, passedLocally=1, skippedRemotely=0)))

    def test_a_listed_remote_skip_compares_equal_when_it_passes_locally(self):
        result = self.compare(report(root='/gate'), remote=report(skipped=(AUDITED[0],)))
        self.assertEqual(result['hostAudits'], dict(listed=1, passedLocally=1, skippedRemotely=1))

    def test_listed_skips_inside_passed_files_compare_equal_with_equal_suite_totals(self):
        # The real CI shape (empty-HOME shard 1: six listed skips, 426 passed suites, none pending): the
        # listed skip sits beside passed tests in a passed file and only the test counters move.
        remote, local = report(skipped=(AUDITED[0],), beside=FILES), report(root='/gate', beside=FILES)
        self.assertEqual({key: remote[key] for key in remote if key.endswith('TestSuites')},
                         {key: local[key] for key in local if key.endswith('TestSuites')})
        result = self.compare(local, remote=remote)
        self.assertEqual((result['tests'], result['hostAudits']), (4, dict(listed=1, passedLocally=1, skippedRemotely=1)))
        self.assertEqual((result['totals']['numPassedTests'], result['totals']['numPendingTests']), (3, 1))

    def test_a_failed_local_file_or_suite_never_compares_equal(self):
        cases = (('failed b', lambda: failed_file(report(root='/gate')), 'Local suite file not passed: tests/b.test.ts'),
                 ('failed a', lambda: failed_file(report(root='/gate'), 0), 'Local suite file not passed: tests/a.test.ts'),
                 ('failed suite', lambda: failed_suite(report(root='/gate')), 'Local suite was not all green'),
                 ('unsuccessful', lambda: report(root='/gate', success=False), 'Local suite was not all green'),
                 ('pending suite', lambda: report(root='/gate', numPassedTestSuites=3, numPendingTestSuites=1), 'Local suite was not all green'))
        for remote in (None, report(skipped=(AUDITED[0],))):
            for name, local, reason in cases:
                with self.subTest(name, remote='listed skip' if remote else 'green'), self.assertRaisesRegex(RuntimeError, reason):
                    self.compare(local(), remote=remote)

    def test_the_remote_report_is_judged_as_verify_judges_it(self):
        for remote, reason in ((failed_file(report()), 'Remote suite file not passed: tests/b.test.ts'),
                               (failed_suite(report()), 'Remote suite was not all green'),
                               (report(skipped=FILES[:1]), 'Remote suite has pending or todo tests: not in the host-audit list')):
            with self.subTest(reason=reason), self.assertRaisesRegex(RuntimeError, reason):
                self.compare(report(root='/gate'), remote=remote, merged_only=True)

    def test_host_audits_must_pass_locally(self):
        for status in ('skipped', 'failed'):
            local = report(root='/gate', skipped=(AUDITED[0],))
            local['testResults'][1]['assertionResults'][0]['status'] = status
            if status == 'failed':
                local.update(success=False, numPendingTests=0, numFailedTests=1, numPassedTestSuites=2, numFailedTestSuites=2)
                local['testResults'][1]['status'] = 'failed'
            with self.subTest(status=status), self.assertRaisesRegex(
                    RuntimeError, 'Host-audit test not passed locally: %s: tests/b.test.ts > suite tests/b.test.ts works' % status):
                self.compare(local, remote=report(skipped=(AUDITED[0],)))

    def test_the_list_must_be_the_manifests(self):
        path, sha256 = self.publish()
        local = self.root / 'local.json'
        local.write_text(json.dumps(report(root='/gate')))
        other = self.root / 'other-list.json'
        other.write_text(json.dumps(dict(AUDIT_LIST, sources=['elsewhere'])))
        with self.assertRaisesRegex(RuntimeError, 'Host-audit list hash mismatch'):
            remote_checks.compare_reports(path, sha256, self.orch, local, other)

    def test_missing_extra_status_and_total_differences_refuse(self):
        def with_extra(value):
            value['testResults'][0]['assertionResults'].append(dict(ancestorTitles=[], title='extra', fullName='extra', status='passed'))
            return value
        differ = 'Remote and local suites differ outside the host-audit list: '
        with self.assertRaisesRegex(RuntimeError, differ + '1 only remote, 0 only local'):
            self.compare(report(root='/gate'), remote=with_extra(report(numTotalTests=3, numPassedTests=3)))
        with self.assertRaisesRegex(RuntimeError, differ + '0 only remote, 1 only local'):
            self.compare(with_extra(report(root='/gate', numTotalTests=3, numPassedTests=3)))
        with self.assertRaisesRegex(RuntimeError, differ + '1 only remote, 1 only local'):
            self.compare(report(root='/gate', skipped=FILES[:1]))
        with self.assertRaisesRegex(RuntimeError, differ + '1 only remote, 1 only local'):
            self.compare(report(root='/gate', skipped=FILES[:1]), remote=report(skipped=(AUDITED[0],)))
        with self.assertRaisesRegex(RuntimeError, 'Remote and local totals differ: numPassedTestSuites, numTotalTestSuites'):
            self.compare(report(root='/gate', numTotalTestSuites=5, numPassedTestSuites=5))
        # A listed remote skip moves test counters only: suite totals stay equal (Vitest 4 counts skipped suites as passed).
        with self.assertRaisesRegex(RuntimeError, 'Remote and local totals differ: numPassedTestSuites, numTotalTestSuites'):
            self.compare(report(root='/gate'), remote=report(skipped=(AUDITED[0],), numTotalTestSuites=3, numPassedTestSuites=3))
        with self.assertRaisesRegex(RuntimeError, 'Host-audit test not passed locally: missing: tests/b.test.ts > suite tests/b.test.ts works'):
            self.compare(report(files=FILES[:1], root='/gate', numTotalTestSuites=4, numPassedTestSuites=4))
        with self.assertRaisesRegex(RuntimeError, differ + '1 only remote, 0 only local'):
            self.compare(report(files=FILES[1:], root='/gate', numTotalTestSuites=4, numPassedTestSuites=4))

    def test_vacuous_or_unreconciled_reports_never_compare_equal(self):
        def vacuous(value):
            for item in value['testResults']:
                item['assertionResults'] = []
            return value
        with self.assertRaisesRegex(RuntimeError, 'Local test file has no assertions: tests/a.test.ts'):
            self.compare(vacuous(report(root='/gate')))
        with self.assertRaisesRegex(RuntimeError, 'Remote test file has no assertions: tests/a.test.ts'):
            self.compare(report(root='/gate'), remote=vacuous(report()), merged_only=True)
        with self.assertRaisesRegex(RuntimeError, 'Remote test file has no assertions: tests/a.test.ts'):
            self.compare(vacuous(report(root='/gate')), remote=vacuous(report()), merged_only=True)
        with self.assertRaisesRegex(RuntimeError, 'Local assertions do not reconcile with numTotalTests'):
            self.compare(report(root='/gate', numTotalTests=3, numPassedTests=3))
        local = report(root='/gate')
        local['testResults'][1]['assertionResults'][0]['status'] = 'skipped'
        with self.assertRaisesRegex(RuntimeError, 'Local assertions do not reconcile with numPassedTests'):
            self.compare(local)
        local = report(root='/gate')
        local['testResults'][0]['assertionResults'][0]['fullName'] = ''
        with self.assertRaisesRegex(RuntimeError, 'Local assertion identity invalid in tests/a.test.ts'):
            self.compare(local)


class RemoteCommandTest(Fixture):
    def command(self, *args):
        return subprocess.run([sys.executable, '-B', str(HERE / 'remote_checks.py'), *map(str, args)],
                              capture_output=True, text=True, env={**os.environ, 'EP_ORCH': str(self.orch)})

    def test_verify_records_a_create_only_verdict(self):
        path, sha256 = self.publish()
        evidence = self.root / 'remote-evidence'
        result = self.command('verify', path, sha256, self.wt, self.base, evidence)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('remote verified ' + str(path), result.stdout)
        record = json.loads((evidence / 'remote-verification.json').read_text())
        self.assertEqual((record['passed'], record['manifest'], record['candidate'], record['tree'], record['base']),
                         (True, dict(path=str(path), sha256=sha256), self.commit, self.tree, self.base))
        self.assertTrue((evidence / 'local-files.json').is_file())
        again = self.command('verify', path, sha256, self.wt, self.base, evidence)
        self.assertNotEqual(again.returncode, 0)
        self.assertEqual(json.loads((evidence / 'remote-verification.json').read_text()), record)

    def test_refused_verify_records_its_reason_and_fails(self):
        path, sha256 = self.publish(lambda m, d: m['commands'][3].update(exitCode=1))
        evidence = self.root / 'refused-evidence'
        result = self.command('verify', path, sha256, self.wt, self.base, evidence)
        self.assertEqual(result.returncode, 1)
        self.assertIn('remote refused: Remote command failed: suite', result.stdout)
        record = json.loads((evidence / 'remote-verification.json').read_text())
        self.assertEqual((record['passed'], record['error']), (False, 'Remote command failed: suite'))

    def test_compare_records_its_verdict(self):
        path, sha256 = self.publish()
        evidence = self.root / 'compare-evidence'
        evidence.mkdir()
        local = self.root / 'full.json'
        local.write_text(json.dumps(report(root='/gate')))
        audits = self.wt / remote_checks.AUDITS
        result = self.command('compare', path, sha256, local, audits, evidence)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('remote compare: equal', result.stdout)
        record = json.loads((evidence / 'remote-comparison.json').read_text())
        self.assertEqual((record['passed'], record['local'], record['hostAudits']),
                         (True, dict(path=str(local), sha256=digest(local)), dict(path=str(audits), sha256=digest(audits))))
        self.assertEqual(record['comparison']['hostAudits'], dict(listed=1, passedLocally=1, skippedRemotely=0))
        other = self.root / 'other-evidence'
        other.mkdir()
        local.write_text(json.dumps(report(root='/gate', numTotalTests=9)))
        result = self.command('compare', path, sha256, local, audits, other)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(json.loads((other / 'remote-comparison.json').read_text())['passed'])


class HostAuditTest(Fixture):
    """The gate host's run of exactly the listed tests (host-audits.sh runs it; remote_checks.py audit judges it)."""
    def host_report(self, status='passed', extra=(), root='/gate/ep-gate-audits'):
        """Vitest 4's report for `pnpm test tests/b.test.ts -t <listed>`: b's listed test plus filtered (skipped)
        others. As in the real dry run (retro W1 fix r1, host-audit-dryrun.json): the file and its two suites
        (module, describe) pass while the filter skips tests; a failed test fails the file and both suites."""
        tests = [dict(fullName=AUDITED[1], title='works', ancestorTitles=['suite tests/b.test.ts'], status=status, failureMessages=[], meta={})]
        tests += [dict(fullName='suite tests/b.test.ts ' + title, title=title, ancestorTitles=['suite tests/b.test.ts'], status=state,
                       failureMessages=[], meta={}) for title, state in extra]
        statuses = [test['status'] for test in tests]
        failed = 'failed' in statuses
        return dict(numTotalTestSuites=2, numPassedTestSuites=0 if failed else 2, numFailedTestSuites=2 if failed else 0,
                    numPendingTestSuites=0, numTotalTests=len(tests),
                    numPassedTests=statuses.count('passed'), numFailedTests=statuses.count('failed'),
                    numPendingTests=statuses.count('skipped'), numTodoTests=statuses.count('todo'),
                    snapshot=report()['snapshot'], startTime=0, success=not failed,
                    testResults=[dict(name=root + '/' + AUDITED[0], status='failed' if failed else 'passed', message='', startTime=0, endTime=1,
                                      assertionResults=tests)])

    def audit(self, value, exit_code=0, audits=None, root='/gate/ep-gate-audits'):
        path, sha256 = self.publish()
        report_path = self.root / ('host-%d.json' % self.runs)
        report_path.write_text(json.dumps(value))
        evidence = self.root / ('audit-evidence-%d' % self.runs)
        evidence.mkdir()
        result = subprocess.run([sys.executable, '-B', str(HERE / 'remote_checks.py'), 'audit', str(path), sha256,
                                 str(audits or self.wt / remote_checks.AUDITS), str(report_path), root, str(exit_code), str(evidence)],
                                capture_output=True, text=True, env={**os.environ, 'EP_ORCH': str(self.orch)})
        return result, json.loads((evidence / 'host-audits.json').read_text())

    def test_listed_tests_passing_with_the_rest_filtered_out_is_recorded(self):
        result, record = self.audit(self.host_report(extra=[('reads nothing', 'skipped')]))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('host-audits passed: 1 listed tests in 1 files', result.stdout)
        self.assertEqual((record['kind'], record['passed'], record['exitCode'], record['result']),
                         ('host-audits-verification-v1', True, 0, dict(tests=1, files=1)))
        self.assertEqual(record['list'], dict(path=str(self.wt / remote_checks.AUDITS), sha256=digest(self.wt / remote_checks.AUDITS)))

    def test_refusals(self):
        other = self.root / 'other-list.json'
        other.write_text(json.dumps(dict(AUDIT_LIST, sources=['elsewhere'])))
        for value, options, reason in (
                (self.host_report('skipped'), {}, 'Host-audit test not passed on the gate host: skipped: tests/b.test.ts > suite tests/b.test.ts works'),
                (self.host_report('failed'), dict(exit_code=1),
                 'Host-audit test not passed on the gate host: failed: tests/b.test.ts > suite tests/b.test.ts works'),
                (self.host_report(extra=[('reads nothing', 'passed')]), {},
                 'Host audits ran an unlisted test: tests/b.test.ts > suite tests/b.test.ts reads nothing'),
                (self.host_report(extra=[('later', 'todo')]), {}, 'Host audits ran an unlisted test: tests/b.test.ts > suite tests/b.test.ts later'),
                (dict(self.host_report(), testResults=[dict(self.host_report()['testResults'][0], assertionResults=[
                    dict(self.host_report()['testResults'][0]['assertionResults'][0], title='renamed', fullName='suite tests/b.test.ts renamed',
                         status='skipped')])], numPassedTests=0, numPendingTests=1), {},
                 'Host-audit test not passed on the gate host: missing: tests/b.test.ts > suite tests/b.test.ts works'),
                (self.host_report(), dict(audits=other), 'Host-audit list hash mismatch'),
                (self.host_report(), dict(exit_code=2), 'Host-audit run exited 2'),
                (self.host_report(), dict(root='/elsewhere'), 'Host audit test file outside its root'),
                # Every listed test passed, yet the report declares a failure: the verdict the remote suite() gives.
                (failed_file(self.host_report(extra=[('reads nothing', 'skipped')])), {}, 'Host audit suite file not passed: tests/b.test.ts'),
                (failed_suite(self.host_report()), {}, 'Host audit suite was not all green'),
                (dict(self.host_report(), success=False), {}, 'Host audit suite was not all green'),
                (dict(self.host_report(), numPassedTestSuites=1, numPendingTestSuites=1), {}, 'Host audit suite was not all green')):
            with self.subTest(reason=reason):
                result, record = self.audit(value, **options)
                self.assertEqual(result.returncode, 1)
                self.assertIn('host-audits refused: ' + reason, result.stdout)
                self.assertIs(record['passed'], False)
                self.assertTrue(record['error'].startswith(reason), record['error'])

    def test_selection_runs_exactly_the_listed_tests(self):
        selection = subprocess.run([sys.executable, '-B', str(HERE / 'remote_checks.py'), 'selection', str(self.wt / remote_checks.AUDITS)],
                                   capture_output=True, check=True).stdout.split(b'\0')
        self.assertEqual(selection, [b'--testNamePattern=^(?:suite tests/b\\.test\\.ts works)$', b'tests/b.test.ts', b''])
        listed = dict(AUDIT_LIST, tests=[dict(file='tests/a.test.ts', fullName='odd (name) [x] a|b $1 ^ * + ? {2} \\ .'),
                                         dict(file='tests/b.test.ts', fullName='plain'), dict(file='tests/c.test.ts', fullName='plain')])
        self.assertEqual(remote_checks.selection(remote_checks.audit_list(json.dumps(listed).encode())),
                         ['--testNamePattern=^(?:odd \\(name\\) \\[x\\] a\\|b \\$1 \\^ \\* \\+ \\? \\{2\\} \\\\ \\.|plain)$',
                          'tests/a.test.ts', 'tests/b.test.ts', 'tests/c.test.ts'])


class CommittedListTest(unittest.TestCase):
    """The repository's own list: well formed, and every listed file has the source guard that skips it in CI."""
    def test_the_committed_list_names_guarded_tests(self):
        repo = HERE.parent.parent
        listed = remote_checks.audit_list((repo / remote_checks.AUDITS).read_bytes())
        self.assertTrue(listed)
        for name in sorted({file for file, _ in listed}):
            source = (repo / name).read_text()
            self.assertRegex(source, r'(describe|it)\.skipIf\(', name)


def fixture_main(orch, wt, base, mutation=''):
    """Publish one fixture manifest for the shell queue tests: a named mutation breaks it."""
    def mutate(m, d):
        if mutation == 'failed':
            m['commands'][3]['exitCode'] = 1
        elif mutation == 'stale-base':
            retrail(m['source'], **{'Gate-Base': dict(m['source']['trailers'])['Gate-Reviewed']})
        elif mutation == 'with-parents':
            m['source']['parents'] = [base]
        elif mutation == 'wrong-tree':
            m['source']['tree'] = '0' * 40
        elif mutation == 'unlisted-skip':
            (d / 'full.json').write_text(json.dumps(report(skipped=FILES[:1])))
            m['commands'][3]['report']['sha256'] = digest(d / 'full.json')
        elif mutation == 'listed-skip':
            write_suite(m, d, skipped=(AUDITED[0],))
        elif mutation:
            raise SystemExit('unknown fixture mutation: ' + mutation)
    install(wt)
    run_id = 'fixture-20261030-120000-' + hashlib.sha256((mutation or 'pass').encode()).hexdigest()[:6]
    path, sha256 = publish(orch, wt, base, run_id, mutate)
    print(path, sha256)


if __name__ == '__main__':
    if sys.argv[1:2] == ['fixture']:
        fixture_main(*sys.argv[2:])
    elif sys.argv[1:2] == ['report']:
        options = dict(item.split('=') for item in sys.argv[3:])
        skipped = tuple(filter(None, options.pop('skipped', '').split(',')))
        failed = tuple(filter(None, options.pop('failed', '').split(',')))
        files = tuple(filter(None, options.pop('files', ','.join(FILES)).split(',')))
        value = report(files=files, root=sys.argv[2], skipped=skipped, **{key: int(value) for key, value in options.items()})
        for name in failed:
            failed_file(value, files.index(name))
        print(json.dumps(value))
    elif sys.argv[1:2] == ['audit-list']:
        print(json.dumps(AUDIT_LIST, indent=2))
    else:
        unittest.main()
