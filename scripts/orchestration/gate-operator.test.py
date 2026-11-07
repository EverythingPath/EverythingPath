"""Operational contract fixtures. No fixture is live T3/resource qualification."""
import importlib.util
import contextlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from workflow_evidence import create_json, digest, receipt_ok


def remote_fixtures():
    spec = importlib.util.spec_from_file_location('remote_check_fixtures', HERE / 'remote-checks.test.py')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def module(name):
    spec = importlib.util.spec_from_file_location(name, HERE / (('gate_operator' if name == 'gate-operator' else name) + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


@contextlib.contextmanager
def recorder_session():
    # The recorder owns its capped child. Tests model a public caller, outside
    # this suite's outer reservation/classification rather than nesting them.
    saved = {key:value for key,value in os.environ.items() if key.startswith(('CAPPED_', 'BOUNDED_', 'ADMISSION_'))}
    for key in saved:
        os.environ.pop(key)
    try:
        yield
    finally:
        for key in list(os.environ):
            if key.startswith(('CAPPED_', 'BOUNDED_', 'ADMISSION_')):
                os.environ.pop(key)
        os.environ.update(saved)


class CanonicalReceiptTest(unittest.TestCase):
    def test_receipts_cannot_turn_failed_outcomes_into_success(self):
        invocation = dict(id='run-1', unit='ep-fresh-run-1', log='/owned/run.log')
        for outcome in ('failed', 'oom', 'killed', 'lockRefused', 'submitFailed'):
            self.assertFalse(receipt_ok(dict(**invocation, outcome=outcome, exitCode=0), invocation))
        self.assertFalse(receipt_ok(dict(**invocation, outcome='ok', exitCode=True), invocation))
        self.assertTrue(receipt_ok(dict(**invocation, outcome='ok', exitCode=0), invocation))
        with self.assertRaisesRegex(RuntimeError, 'identity'):
            receipt_ok(dict(**invocation, outcome='ok', exitCode=0), {**invocation, 'id': 'other'})

    def test_completed_evidence_is_create_only(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as root:
            path = Path(root) / 'receipt.json'
            create_json(path, dict(result='failed'))
            before = path.read_bytes()
            with self.assertRaises(FileExistsError):
                create_json(path, dict(result='ok'))
            self.assertEqual(path.read_bytes(), before)


class ValidationReuseTest(unittest.TestCase):
    def setUp(self):
        self.session = recorder_session()
        self.session.__enter__()
        self.addCleanup(self.session.__exit__, None, None, None)
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.root = Path(self.scratch.name)
        self.repo = self.root / 'main'
        self.repo.mkdir()
        self.orch = self.root / 'orch'
        self.orch.mkdir()
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.prior_path = os.environ['PATH']
        os.environ['PATH'] = str(self.bin) + ':' + self.prior_path
        for tool in ('node', 'pnpm'):
            path = self.bin / tool
            path.write_text('#!/bin/sh\necho fixture-tool-1\n')
            path.chmod(0o755)
        (self.orch / 'capped.sh').write_text('#!/bin/sh\nexec "$@"\n')
        (self.orch / 'capped.sh').chmod(0o755)
        self.git('init', '-q', '-b', 'work')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.test')
        for name in ('package.json', 'pnpm-lock.yaml', 'check-config.json'):
            (self.repo / name).write_text('{}\n')
        (self.repo / '.gitignore').write_text('node_modules/\n')
        (self.repo / 'node_modules/.pnpm').mkdir(parents=True)
        (self.repo / 'node_modules/.pnpm/lock.yaml').write_text('installed-fixture\n')
        self.commit('base')
        self.base = self.git('rev-parse', 'HEAD')
        (self.repo / 'source').write_text('one\n')
        self.commit('first')
        (self.repo / 'source').write_text('two\n')
        self.commit('second')
        self.plan = self.orch / 'plan.json'
        self.plan.write_text(json.dumps(dict(version=1, main=str(self.repo), orch=str(self.orch),
            worktree=str(self.repo), base=self.base, fullQueueRequired=True,
            checks=dict(types=dict(argv=['pnpm', '-s', 'typecheck'], inputs=['check-config.json'], impact='Type contracts')))))
        self.validation = module('validation')

    def tearDown(self):
        os.environ['PATH'] = self.prior_path
        self.scratch.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', '-C', self.repo, *args], text=True).strip()

    def commit(self, message):
        self.git('add', '.')
        self.git('commit', '-qm', message)

    def run_check(self):
        target = self.orch / 'check-1'
        self.validation.run(str(self.plan), 'types', str(target))
        return target / 'receipt.json'

    def test_same_tree_squash_reuses_actual_check_without_running_again(self):
        receipt = self.run_check()
        tested = self.git('rev-parse', 'HEAD')
        self.git('reset', '--soft', self.base)
        self.git('commit', '-qm', 'squashed')
        result = self.validation.verify(str(self.plan), 'types', str(receipt))
        self.assertEqual(result['result'], 'reused')
        self.assertEqual(result['testedCommit'], tested)
        self.assertNotEqual(result['targetCommit'], tested)

    def test_unused_session_PATH_is_portable_but_effective_tool_changes_refuse(self):
        original = os.environ['PATH']
        os.environ['PATH'] = str(self.root / 'session-one') + ':' + original
        receipt = self.run_check()
        try:
            os.environ['PATH'] = str(self.root / 'session-two') + ':' + original
            self.assertEqual(self.validation.verify(str(self.plan), 'types', str(receipt))['result'], 'reused')
            shadow = self.root / 'shadow';shadow.mkdir()
            tool = shadow / 'node';tool.write_text('#!/bin/sh\necho changed-effective-node\n');tool.chmod(0o755)
            os.environ['PATH'] = str(shadow) + ':' + original
            with self.assertRaisesRegex(RuntimeError, 'invalidated:.*tools'):
                self.validation.verify(str(self.plan), 'types', str(receipt))
        finally:
            os.environ['PATH'] = original

    def test_unapproved_wrapper_overrides_refuse_recording_and_reuse(self):
        receipt = self.run_check()
        original = receipt.read_bytes()
        shared = self.validation.shared_context(json.loads(self.plan.read_text()))
        for key,value in (('CAPPED_KIND','test'), ('BOUNDED_WORKERS','1'),
                          ('BOUNDED_CPU','200%'), ('BOUNDED_STATE_DIR',str(self.root)),
                          ('BOUNDED_RESERVATION','unproven'), ('ADMISSION_INTERVAL','0.2')):
            with self.subTest(override=key):
                os.environ[key]=value
                try:
                    target = self.orch / ('refused-'+key)
                    with self.assertRaisesRegex(RuntimeError, 'wrapper override'):
                        self.validation.run(str(self.plan), 'types', str(target))
                    self.assertFalse(target.exists(), 'Rejected override launched a check')
                    with self.assertRaisesRegex(RuntimeError, 'wrapper override'):
                        self.validation.verify(str(self.plan), 'types', str(receipt), shared=shared)
                finally:
                    os.environ.pop(key)
        self.assertEqual(receipt.read_bytes(), original)

    def test_canonical_worker_and_cpu_settings_bind_their_effective_defaults(self):
        receipt = self.run_check()
        os.environ.update(BOUNDED_WORKERS='2', BOUNDED_CPU='600%')
        self.assertEqual(self.validation.verify(str(self.plan), 'types', str(receipt))['result'], 'reused')
        self.assertEqual(json.loads(receipt.read_text())['context']['wrapperControls'],
                         dict(policy='canonical-only-v1',workers=2,cpu='600%'))

    def test_content_environment_dependency_and_output_tamper_invalidate(self):
        receipt = self.run_check()
        before = receipt.read_bytes()
        config = self.repo / 'check-config.json'
        config.write_text('{"changed":true}\n')
        self.commit('config change')
        with self.assertRaisesRegex(RuntimeError, 'invalidated'):
            self.validation.verify(str(self.plan), 'types', str(receipt))
        self.git('reset', '--hard', 'HEAD^')
        installed = self.repo / 'node_modules/.pnpm/lock.yaml'
        installed.write_text('other installation\n')
        with self.assertRaisesRegex(RuntimeError, 'dependencies'):
            self.validation.verify(str(self.plan), 'types', str(receipt))
        installed.write_text('installed-fixture\n')
        os.environ['VITEST_POOL'] = 'fixture-changed'
        try:
            with self.assertRaisesRegex(RuntimeError, 'environment'):
                self.validation.verify(str(self.plan), 'types', str(receipt))
        finally:
            os.environ.pop('VITEST_POOL')
        (receipt.parent / 'output.log').write_text('rewritten green\n')
        with self.assertRaisesRegex(RuntimeError, 'changed'):
            self.validation.verify(str(self.plan), 'types', str(receipt))
        self.assertEqual(receipt.read_bytes(), before)

    def test_failed_check_cannot_be_reused_or_reexecuted_in_same_attempt(self):
        (self.bin / 'pnpm').write_text('#!/bin/sh\n[ "$1" = --version ] && echo fixture-1 && exit 0\nexit 7\n')
        target = self.orch / 'check-1'
        with self.assertRaisesRegex(RuntimeError, 'Validation failed'):
            self.validation.run(str(self.plan), 'types', str(target))
        receipt = target / 'receipt.json'
        self.assertEqual(json.loads(receipt.read_text())['exitCode'], 7)
        with self.assertRaisesRegex(RuntimeError, 'Failed validation'):
            self.validation.verify(str(self.plan), 'types', str(receipt))
        with self.assertRaises(FileExistsError):
            self.validation.run(str(self.plan), 'types', str(target))

    def test_original_attempt_and_location_are_required_for_reuse(self):
        import shutil
        receipt = self.run_check()
        copied = self.orch / 'copied'
        shutil.copytree(receipt.parent, copied)
        with self.assertRaisesRegex(RuntimeError, 'attempt|location|Moved'):
            self.validation.verify(str(self.plan), 'types', str(copied / 'receipt.json'))
        (receipt.parent / 'attempt.json').unlink()
        with self.assertRaisesRegex(RuntimeError, 'Missing/nonregular'):
            self.validation.verify(str(self.plan), 'types', str(receipt))

    def test_receipt_cannot_rewrite_context_or_fabricate_execution(self):
        from workflow_evidence import reference
        receipt = self.run_check()
        value = json.loads(receipt.read_text())
        original = receipt.read_bytes()
        value['context']['impact'] = 'fabricated context'
        receipt.write_text(json.dumps(value))
        with self.assertRaisesRegex(RuntimeError, 'original attempt'):
            self.validation.verify(str(self.plan), 'types', str(receipt))
        receipt.write_bytes(original)
        execution = receipt.parent / 'execution.json'
        result = json.loads(execution.read_text());result['launched'] = False
        execution.write_text(json.dumps(result))
        value = json.loads(receipt.read_text());value['execution'] = reference(execution)
        receipt.write_text(json.dumps(value))
        with self.assertRaisesRegex(RuntimeError, 'recorded command execution'):
            self.validation.verify(str(self.plan), 'types', str(receipt))


class GateTransitionTest(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.root = Path(self.scratch.name)
        self.main = self.root / 'main'
        self.main.mkdir()
        self.orch = self.root / 'orch'
        (self.orch / 'logs').mkdir(parents=True)
        self.worker = self.root / 'worker'
        self.run = self.orch / 'attempt'
        self.run.mkdir()
        self.old_config = os.environ.get('GATE_CONFIG')
        self.git(self.main, 'init', '-q', '-b', 'feature')
        self.git(self.main, 'config', 'user.name', 'Fixture')
        self.git(self.main, 'config', 'user.email', 'fixture@example.test')
        scripts = self.main / 'scripts/orchestration'
        scripts.mkdir(parents=True)
        for name in ('land-queue.sh', 'cur-land.sh', 'codegen.sh', 'e2e-branch.sh', 'triage-failures.sh', 'land.sh', 'bounded-outcome.sh'):
            path = scripts / name
            path.write_text('#!/bin/sh\nexit 0\n')
            path.chmod(0o755)
        (scripts / 'gate-run.py').write_text('# fixture script operator; gate_core binds its blob at BASE\n')
        admission = scripts / 'admission.sh'
        admission.write_text('#!/bin/sh\nadmission_dir=$BOUNDED_STATE_DIR/admission\ncase "${1:-}:${2:-}" in status:*) echo "active: none; queued: none";; gib:budget) echo 18;; gib:gate-2) echo 11.5;; gib:*) echo 1;; esac\n')
        admission.chmod(0o755)
        (scripts / 'declarations.d.ts').write_text('export interface Fixture {}\n')
        (scripts / 'host-audits.json').write_text(json.dumps(remote_fixtures().AUDIT_LIST, indent=2) + '\n')
        (self.main / 'package.json').write_text(json.dumps(dict(scripts=dict(typecheck='node -e \"process.exit(0)\"')))+'\n')
        (self.main / 'pnpm-lock.yaml').write_text('fixture-lock\n')
        (self.main / '.gitignore').write_text('node_modules/\n')
        self.git(self.main, 'add', '.')
        self.git(self.main, 'commit', '-qm', 'base')
        self.base = self.git(self.main, 'rev-parse', 'HEAD')
        self.git(self.main, 'worktree', 'add', '-qb', 'implementation', str(self.worker))
        for index in range(2):
            (self.worker / 'value').write_text(str(index) + '\n')
            self.git(self.worker, 'add', '.')
            self.git(self.worker, 'commit', '-qm', 'author step')
        self.reviewed = self.git(self.worker, 'rev-parse', 'HEAD')
        self.tree = self.git(self.worker, 'rev-parse', 'HEAD^{tree}')
        self.archive = 'refs/archive/fixture/reviewed'
        self.message = self.orch / 'message.txt'
        self.message.write_text('Fixture consolidated commit\n')
        self.config = self.orch / 'config.json'
        self.config.write_text('{}')
        self.v = dict(MAIN=str(self.main), ORCH=str(self.orch), WT=str(self.worker), BR='implementation',
            FEATURE='feature', BASE=self.base, REVIEWED=self.reviewed, TREE=self.tree,
            E=str(self.run), SNAP=str(self.run / 'queue-snapshot'), ARCHIVE=self.archive,
            CONFIG=str(self.config), LABEL='fixture', S=str(self.worker / 'scripts/orchestration'))
        self.operator = module('gate-operator')
        self.core = module('gate_core')

    def tearDown(self):
        if self.old_config is None:
            os.environ.pop('GATE_CONFIG', None)
        else:
            os.environ['GATE_CONFIG'] = self.old_config
        self.scratch.cleanup()

    def git(self, root, *args):
        return subprocess.check_output(['git', '-C', root, *args], text=True).strip()

    def prepare_commit(self):
        return self.operator.prepare_commit(self.v, dict(preparation=dict(mode='squash',
            archive=self.archive, message=dict(path=str(self.message), sha256=digest(self.message)))))

    def authorize_fixture(self, prepared=True):
        from workflow_evidence import reference
        # The script operator (gate-run.py committed at BASE) and a separate actual author task.
        script = 'scripts/orchestration/gate-run.py'
        blob = self.git(self.main, 'rev-parse', self.base + ':' + script)
        operator = self.orch / 'operator.json'
        operator.write_text(json.dumps(dict(kind='script', path=str(self.main / script), commit=self.base, blob=blob,
            taskId='script:' + script + '@' + blob, runId='gate-run:fixture:1')))
        author = self.orch / 'author.json'
        author.write_text(json.dumps(dict(taskId='fixture-author', childRunId='fixture-author-run',
            providerInstanceId='codex', model='gpt-6.1-sol', options=dict(reasoningEffort='high', serviceTier='default'))))
        control = self.orch / 'control.json'
        control.write_text(json.dumps(dict(state='active', taskId='script:' + script + '@' + blob, runId='gate-run:fixture:1',
            reviewed=self.reviewed, tree=self.tree, base=self.base)))
        reviews = {}
        for axis in ('standards', 'spec'):
            task = self.orch / (axis + '.json')
            target = dict(providerInstanceId='claudeAgent', model='claude-opus-5-5', options=dict(effort='xhigh', fastMode=False))
            task.write_text(json.dumps(dict(taskId='fixture-' + axis, childRunId='fixture-' + axis + '-run',
                latestTerminalRunId='fixture-' + axis + '-run', status='completed', latestTerminalStatus='completed',
                hasPendingChildRuns=False, **target)))
            report = self.orch / (axis + '.md')
            report.write_text('Synthetic infrastructure fixture, not authentic review qualification.\n')
            reviews[axis] = dict(commit=self.reviewed, tree=self.tree, taskId='fixture-' + axis, runId='fixture-' + axis + '-run',
                target=target, task=reference(task), report=reference(report), disposition='accepted', unresolved=[])
        policy = self.orch / 'resource-policy.md'
        policy.write_text('Synthetic fixture policy\n')
        plan = self.orch / 'validation-plan.json'
        plan.write_text(json.dumps(dict(version=1, main=str(self.main), orch=str(self.orch), worktree=str(self.worker), base=self.base, fullQueueRequired=True, checks={})))
        config = dict(version=1, kind='code', main=str(self.main), orch=str(self.orch), worktree=str(self.worker),
            branch='implementation', feature='feature', base=self.base, reviewed=self.reviewed, tree=self.tree,
            attempt=str(self.run), label='fixture', operator=reference(operator), author=reference(author), control=str(control), reviews=reviews,
            validation=dict(plan=reference(plan), receipts={}),
            resourcePolicy=reference(policy), storageBaseline=reference(policy),
            phases=['prepare', 'submit', 'observe', 'collect', 'complete', 'checked-land'],
            preparation=dict(mode='squash', archive=self.archive, message=reference(self.message)))
        self.config.write_text(json.dumps(config))
        os.environ['GATE_CONFIG'] = str(self.config)
        if not prepared:
            return
        Path(self.v['SNAP']).mkdir()
        (Path(self.v['SNAP']) / 'queue.log').touch()
        create_json(self.run / 'snapshot.json', dict(files={}, external=[], tools={},
            environment={key: os.environ.get(key) for key in ('PATH', 'LANG', 'LC_ALL', 'TZ')}))
        from workflow_evidence import landing_lock_reference
        create_json(self.run / 'prepared.json', dict(config=reference(self.config), landingLock=landing_lock_reference(self.run),
            bindings=[reference(self.run / 'mapping.json'), reference(self.run / 'snapshot.json')]))

    def record_owned_fixture(self, invocation):
        from workflow_evidence import reference
        create_json(self.run / 'submission-claim.json', dict(attempt=str(self.run), label='fixture',
            main=str(self.main), orch=str(self.orch), candidate=invocation['candidate']))
        create_json(self.run / 'owned-invocation.json', dict(**invocation, claim=reference(self.run / 'submission-claim.json')))

    def test_exact_mapping_keeps_history_and_resumes_without_another_squash(self):
        mapping = self.prepare_commit()
        self.assertEqual(mapping['TREE'], self.tree)
        self.assertEqual(self.git(self.worker, 'rev-parse', self.archive), self.reviewed)
        self.assertEqual(self.git(self.worker, 'rev-list', '--count', self.base + '..HEAD'), '1')
        self.assertEqual(self.git(self.worker, 'diff', self.reviewed, 'HEAD', '--'), '')
        self.assertEqual(len(mapping['history']), 2)
        original = self.run / 'mapping.json'
        old_bytes = original.read_bytes()
        new_attempt = self.orch / 'resumed'
        new_attempt.mkdir()
        resumed = {**self.v, 'E': str(new_attempt)}
        result = self.operator.prepare_commit(resumed, dict(preparation=dict(mode='prepared', archive=self.archive,
            candidate=mapping['SQUASHED'], mapping=dict(path=str(original), sha256=digest(original)))))
        self.assertEqual(result['SQUASHED'], mapping['SQUASHED'])
        self.assertEqual(original.read_bytes(), old_bytes)

    def test_specialized_curation_commit_is_preserved_instead_of_resquashed(self):
        self.git(self.worker, 'reset', '--soft', self.base)
        self.git(self.worker, 'commit', '-qm', 'specialized curation preparation')
        self.reviewed = self.git(self.worker, 'rev-parse', 'HEAD')
        self.v['REVIEWED'] = self.reviewed
        value = self.operator.prepare_commit(self.v, dict(kind='curation', preparation=dict(mode='squash',
            archive=self.archive, message=dict(path=str(self.message), sha256=digest(self.message)))))
        self.assertEqual(value['SQUASHED'], self.reviewed)
        self.assertEqual(self.git(self.worker, 'rev-parse', 'HEAD'), self.reviewed)
        self.assertFalse((self.run / 'generated-candidate.json').exists())

    def test_tree_or_archive_tamper_rejects_prepared_mapping(self):
        self.prepare_commit()
        self.git(self.worker, 'update-ref', self.archive, self.base)
        with self.assertRaisesRegex(RuntimeError, 'archive moved'):
            self.core.mapping(self.v)

    def test_submission_claim_blocks_second_launch_even_after_lost_response(self):
        self.prepare_commit()
        self.authorize_fixture()
        launches = []
        def lost_response(*args, **kwargs):
            launches.append(args)
            raise OSError('fixture lost submit response')
        with self.assertRaisesRegex(OSError, 'lost submit response'):
            self.operator.submit(self.v, launch=lost_response)
        before = (self.run / 'submission-claim.json').read_bytes()
        with self.assertRaises(FileExistsError):
            self.operator.submit(self.v, launch=lost_response)
        self.assertEqual(len(launches), 1)
        self.assertEqual((self.run / 'submission-claim.json').read_bytes(), before)
        self.assertFalse((self.run / 'completion.json').exists())

    def test_successful_submission_keeps_one_canonical_invocation(self):
        import io
        self.prepare_commit()
        self.authorize_fixture()
        invocation_id = 'fixture-20261027-010203-abcdef'
        log = str(self.orch / 'logs' / ('bounded-' + invocation_id + '.log'))
        class ReturnedLaunch:
            stdout = io.StringIO('unit: ep-fresh-' + invocation_id + '; log: ' + log + '; id: ' + invocation_id + '\n')
            def wait(self):
                return 0
        launched = []
        def launch(argv, **kwargs):
            launched.append(argv)
            return ReturnedLaunch()
        result = self.operator.submit(self.v, launch=launch)
        self.assertEqual(result['id'], invocation_id)
        self.assertEqual(result['unit'], 'ep-fresh-' + invocation_id)
        with self.assertRaises(FileExistsError):
            self.operator.submit(self.v, launch=launch)
        self.assertEqual(len(launched), 1)

    def test_runtime_freeze_preserves_executable_and_readable_declaration_modes(self):
        self.prepare_commit()
        installed = self.worker / 'node_modules/.pnpm/lock.yaml'
        installed.parent.mkdir(parents=True)
        installed.write_text('installed fixture\n')
        for name in ('bounded.sh', 'capped.sh', 'bounded-resources.sh', 'bounded-receipt.sh', 'slice-sampler.sh', 'resource-policy.md'):
            (self.orch / name).write_text('# fixture wrapper\n')
        self.operator.freeze(self.v)
        frozen = Path(self.v['SNAP'])
        self.assertTrue((frozen / 'land-queue.sh').stat().st_mode & 0o111)
        self.assertFalse((frozen / 'declarations.d.ts').stat().st_mode & 0o111)
        self.assertTrue(self.core.snapshot(self.v))
        script = frozen / 'land-queue.sh'
        script.chmod(0o755)
        script.write_text('#!/bin/sh\nexit 7\n')
        with self.assertRaisesRegex(RuntimeError, 'Snapshot changed'):
            self.core.snapshot(self.v)

    def test_failed_result_cannot_finalize_even_with_a_landed_tip(self):
        mapping = self.prepare_commit()
        self.authorize_fixture()
        self.git(self.main, 'merge', '--ff-only', mapping['SQUASHED'])
        create_json(self.run / 'result.json', dict(passed=False, checks=dict(canonicalReceipt=False), errors=[]))
        with self.assertRaisesRegex(RuntimeError, 'Failed result'):
            self.operator.complete(self.v)
        self.assertFalse((self.run / 'completion.json').exists())

    def test_failed_canonical_receipt_blocks_finalization_despite_a_green_summary(self):
        mapping = self.prepare_commit()
        self.authorize_fixture()
        self.git(self.main, 'merge', '--ff-only', mapping['SQUASHED'])
        invocation_id = 'fixture-20261027-010203-abcdef'
        invocation = dict(id=invocation_id, unit='ep-fresh-' + invocation_id,
            log=str(self.orch / 'logs' / ('bounded-' + invocation_id + '.log')), candidate=mapping['SQUASHED'])
        create_json(self.run / 'submission.json', invocation)
        self.record_owned_fixture(invocation)
        bounded = self.orch / 'bounded' / invocation_id
        bounded.mkdir(parents=True)
        create_json(bounded / 'receipt.json', dict(**{key: invocation[key] for key in ('id', 'unit', 'log')}, outcome='failed', exitCode=0))
        create_json(self.run / 'result.json', dict(passed=True, checks=dict(fixture=True), errors=[], evidence=[]))
        with self.assertRaisesRegex(RuntimeError, 'Canonical receipt no longer qualifies'):
            self.operator.complete(self.v)
        self.assertFalse((self.run / 'completion.json').exists())

    def test_original_suite_rejects_incomplete_failed_or_boolean_counts(self):
        report = self.run / 'full.json'
        good = dict(success=True, numTotalTests=5, numPassedTests=5, numFailedTests=0, numFailedTestSuites=0)
        report.write_text(json.dumps(good))
        self.assertTrue(self.operator.original_suite(report))
        for changed in (dict(success=False), dict(numFailedTests=1), dict(numPassedTests=4), dict(numTotalTests=True)):
            report.write_text(json.dumps({**good, **changed}))
            with self.assertRaises(RuntimeError):
                self.operator.original_suite(report)

    def test_adapted_monitor_imports_and_checks_in_a_real_supervised_child(self):
        self.prepare_commit()
        self.authorize_fixture()
        monitor = module('gate_monitor')
        values = self.core.env()
        child = monitor.start_integrity(values)
        try:
            child.wait(timeout=30)
            result = monitor.read_integrity(child, values)
            self.assertTrue(result['passed'])
            self.assertEqual([row['phase'] for row in result['phases']], ['preflight', 'authorization', 'control', 'snapshot'])
        finally:
            monitor.stop_integrity(child)
            monitor.stop_integrity(child)
        self.assertIsNotNone(child.returncode)

    def handoff_fixture(self, state, corrupt=False, bad_return_id=False):
        self.prepare_commit()
        binary = self.root / 'bin';binary.mkdir()
        stop_log = self.orch / 'stops.log'
        systemctl = binary / 'systemctl'
        systemctl.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "' + str(stop_log) + '"\n')
        systemctl.chmod(0o755)
        os.environ['PATH'] = str(binary) + ':' + os.environ['PATH']
        self.authorize_fixture()
        bounded = self.orch / 'bounded.sh'
        bounded.write_text('#!/usr/bin/env python3\n' +
            'import os,json,pathlib,time\n' +
            "config=json.loads(pathlib.Path(os.environ['GATE_CONFIG']).read_text())\n" +
            "control=pathlib.Path(config['control']);value=json.loads(control.read_text());value.update(state=" + repr(state) + ",phase='submit');control.write_text(json.dumps(value))\n" +
            "path=pathlib.Path(config['orch']);(path/'launches.log').open('a').write('launch\\n')\n" +
            "print('unit: ep-fresh-fixture-20261027-010203-abcdef; log: '+str(path/'logs/bounded-fixture-20261027-010203-abcdef.log')+'; id: "+('malformed-return-id' if bad_return_id else 'fixture-20261027-010203-abcdef')+"',flush=True)\n" +
            ("target=pathlib.Path(config['attempt'])/'submission.json'\nwhile not target.exists():time.sleep(0.01)\ntarget.write_text('{broken');raise SystemExit(7)\n" if corrupt else ''))
        bounded.chmod(0o755)
        return stop_log

    def assert_handoff_stops(self, state, corrupt=False, bad_return_id=False):
        previous_path = os.environ['PATH']
        try:
            stop_log = self.handoff_fixture(state, corrupt, bad_return_id)
            with self.assertRaises(RuntimeError):
                self.operator.run(self.v, resume=True)
            self.assertTrue(stop_log.is_file(), 'detached invocation was left without observation or cancellation')
            self.assertEqual(set(stop_log.read_text().splitlines()), {'--user stop --no-block ep-fresh-fixture-20261027-010203-abcdef'})
            self.assertFalse((self.run / 'completion.json').exists())
            known = self.core.owned_invocation(self.v)
            self.assertEqual(known['unit'], 'ep-fresh-fixture-20261027-010203-abcdef')
            (self.run / 'submission.json').write_text('{malformed failed-submit evidence')
            bounded = self.orch / 'bounded' / known['id'];bounded.mkdir(parents=True)
            create_json(bounded / 'receipt.json', dict(**{key:known[key] for key in ('id','unit','log')},outcome='killed',exitCode=143))
            # Terminal collection must survive stopped/finish-current control and corrupt submission JSON.
            result = self.operator.collect(self.v)
            self.assertFalse(result['passed'])
            self.assertFalse(result['checks']['submissionBinding'])
            with self.assertRaises(RuntimeError):
                self.operator.run(self.v, resume=True)
            self.assertEqual((self.orch / 'launches.log').read_text().splitlines(), ['launch'])
            self.assertFalse((self.run / 'completion.json').exists())
        finally:
            os.environ['PATH'] = previous_path

    def test_control_stop_at_real_submit_observe_handoff_stops_only_owned_unit(self):
        self.assert_handoff_stops('stopped')

    def test_finish_submit_at_actual_handoff_cancels_and_allows_failed_collection(self):
        self.assert_handoff_stops('finish-current')

    def test_failed_submit_with_malformed_evidence_still_cancels_proven_owner(self):
        self.assert_handoff_stops('active', corrupt=True)

    def test_malformed_return_id_does_not_prevent_cancelling_proven_returned_unit(self):
        self.assert_handoff_stops('active', bad_return_id=True)

    def test_explicit_cancel_is_available_while_forward_operator_lock_is_held(self):
        from workflow_evidence import lock
        previous_path = os.environ['PATH']
        try:
            stop_log = self.handoff_fixture('stopped')
            with self.assertRaises(RuntimeError):
                self.operator.run(self.v, resume=True)
            # This synthetic handoff fixture still needs a complete immutable CLI closure.
            import shutil
            from workflow_evidence import reference
            runtime = self.run / 'operator-runtime';runtime.mkdir()
            manifest = json.loads((self.run / 'snapshot.json').read_text())
            manifest['operatorRuntime'] = {}
            for name in ('gate-operator.py', 'gate_operator.py', 'gate_core.py', 'gate_monitor.py', 'validation.py', 'workflow_evidence.py', 'remote_checks.py'):
                path = runtime / name;shutil.copyfile(HERE / name, path);path.chmod(0o444)
                manifest['operatorRuntime'][name] = dict(sha256=digest(path), mode=0o444)
            (self.run / 'snapshot.json').write_text(json.dumps(manifest))
            prepared = json.loads((self.run / 'prepared.json').read_text())
            prepared['bindings'] = [reference(self.run / name) for name in ('mapping.json', 'snapshot.json')]
            (self.run / 'prepared.json').write_text(json.dumps(prepared))
            with lock(str(self.run.parent / (self.run.name + '.operator.lock'))):
                result = subprocess.run([sys.executable,'-B',str(HERE / 'gate-operator.py'),'cancel'],capture_output=True,text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(set(stop_log.read_text().splitlines()), {'--user stop --no-block ep-fresh-fixture-20261027-010203-abcdef'})
            self.assertFalse((self.run / 'completion.json').exists())
        finally:
            os.environ['PATH'] = previous_path

    def test_cancel_refuses_a_returned_unit_outside_the_bound_owner_scope(self):
        previous_path = os.environ['PATH']
        try:
            stop_log = self.handoff_fixture('stopped')
            with self.assertRaises(RuntimeError):
                self.operator.run(self.v, resume=True)
            before = stop_log.read_bytes()
            path = self.run / 'owned-invocation.json'
            value = json.loads(path.read_text());value['unit'] = 'ep-fresh-another-task'
            path.write_text(json.dumps(value))
            with self.assertRaisesRegex(RuntimeError, 'Owned invocation mapping mismatch'):
                self.operator.stop_owned(self.v, 'refuse foreign unit')
            self.assertEqual(stop_log.read_bytes(), before)
        finally:
            os.environ['PATH'] = previous_path

    def test_replaced_landing_lock_is_rejected(self):
        self.prepare_commit();self.authorize_fixture()
        replacement = self.run / 'replacement.lock';replacement.touch()
        replacement.replace(self.run / 'landing.lock')
        with self.assertRaisesRegex(RuntimeError, 'Landing observation lock changed'):
            self.core.preflight('monitor', values=self.v)

    def tooling_fixture(self):
        script = self.worker / 'scripts/orchestration/cur-land.sh'
        script.write_text('#!/bin/sh\n# reviewed replacement\nexit 0\n')
        self.git(self.worker, 'rm', 'scripts/orchestration/declarations.d.ts')
        self.git(self.worker, 'add', '.')
        self.git(self.worker, 'commit', '-qm', 'reviewed tooling changes')
        self.reviewed = self.git(self.worker, 'rev-parse', 'HEAD')
        self.tree = self.git(self.worker, 'rev-parse', 'HEAD^{tree}')
        self.v.update(REVIEWED=self.reviewed, TREE=self.tree)
        prepared = self.prepare_commit()
        self.authorize_fixture()
        frozen = Path(self.v['SNAP'])
        (frozen / 'queue.log').unlink();frozen.rmdir()
        (self.run / 'snapshot.json').unlink()
        installed = self.worker / 'node_modules/.pnpm/lock.yaml'
        installed.parent.mkdir(parents=True);installed.write_text('installed fixture\n')
        for name in ('bounded.sh', 'capped.sh', 'bounded-resources.sh', 'bounded-receipt.sh', 'slice-sampler.sh'):
            (self.orch / name).write_text('# fixture wrapper\n')
        self.operator.freeze(self.v)
        from workflow_evidence import reference
        prior = json.loads((self.run / 'prepared.json').read_text())
        prior['bindings'] = [reference(self.run / name) for name in ('mapping.json', 'snapshot.json')]
        (self.run / 'prepared.json').write_text(json.dumps(prior))
        self.assertTrue(json.loads((self.run / 'snapshot.json').read_text())['external'])
        refs = dict(line.split(' ', 1)[::-1] for line in self.git(self.main, 'for-each-ref', '--format=%(objectname) %(refname)').splitlines())
        create_json(self.run / 'protected-refs.json', refs)
        return prepared

    def terminal_fixture(self, prepared, integrity):
        from workflow_evidence import now
        invocation_id = 'fixture-20261027-010203-abcdef'
        invocation = dict(id=invocation_id, unit='ep-fresh-' + invocation_id,
            log=str(self.orch / 'logs' / ('bounded-' + invocation_id + '.log')), candidate=prepared['SQUASHED'])
        create_json(self.run / 'submission.json', invocation)
        self.record_owned_fixture(invocation)
        bounded = self.orch / 'bounded' / invocation_id
        bounded.mkdir(parents=True)
        create_json(bounded / 'receipt.json', dict(**{key: invocation[key] for key in ('id', 'unit', 'log')}, outcome='ok', exitCode=0))
        Path(invocation['log']).write_text('Synthetic queue-result fixture; no application gate ran.\n')
        scope = dict(systemctlExit=0, systemd=dict(ActiveState='inactive'), **{'memory.events':'max 0\noom 0\noom_kill 0\noom_group_kill 0\n', 'memory.current':'0', 'memory.stat':'file 0\nshmem 0\n'})
        create_json(self.run / 'resource-baseline.json', dict(slice=scope))
        row = dict(at=now(), invocationId=invocation_id, unit=scope, slice=scope,
            candidateHead=self.git(self.worker, 'rev-parse', 'HEAD'), candidateTree=self.tree, candidateStatus='',
            integrationHead=self.git(self.main, 'rev-parse', 'HEAD'), integrationTree=self.git(self.main, 'rev-parse', 'HEAD^{tree}'), integrationStatus='',
            archiveSHA=self.reviewed, refs=dict(line.split(' ', 1)[::-1] for line in self.git(self.main, 'for-each-ref', '--format=%(objectname) %(refname)').splitlines()),
            maintenance=dict(main=os.path.realpath(self.main), worktrees=[
                {'path': os.path.realpath(path), 'gc.auto': dict(exitCode=0, value='0'), 'maintenance.auto': dict(exitCode=0, value='false')}
                for path in (self.main, self.worker)], scheduled=dict(repos=[], timers=[], cron=[], unread=[])),
            guard=dict(hostAvailableBytes=24*1024**3, hostLowSeconds=0, observationGapSeconds=0,
                storage=dict(journal=dict(exitCode=1), counters=dict(stdout='fixture')), expectedStorageCounters='fixture', docker=[], ownedScratch=[]))
        (self.run / 'resource-progress.jsonl').write_text(json.dumps(row)+'\n')
        (self.run / 'integrity-progress.jsonl').write_text(json.dumps(dict(stage='terminal', **integrity))+'\n')
        (self.run / 'triage-evidence').mkdir()
        create_json(self.run / 'triage-evidence/full.json', dict(success=True, numTotalTests=5, numPassedTests=5, numFailedTests=0, numFailedTestSuites=0))
        return invocation

    def test_real_script_fast_forward_keeps_nonempty_frozen_provenance_valid(self):
        import time
        from concurrent.futures import ThreadPoolExecutor
        prepared = self.tooling_fixture()
        marker, release = self.root / 'merge-prepared', self.root / 'merge-release'
        hook = self.main / '.git/hooks/reference-transaction'
        hook.write_text('#!/bin/sh\nif [ "$1" = prepared ]; then while read -r old new ref; do if [ "$ref" = refs/heads/feature ]; then touch "' + str(marker) + '"; while [ ! -f "' + str(release) + '" ]; do sleep 0.01; done; fi; done; fi\n')
        hook.chmod(0o755)
        lock = json.loads((self.run / 'prepared.json').read_text())['landingLock']
        environment = {**os.environ, 'MAIN':str(self.main), 'EP_ORCH':str(self.orch), 'FEATURE':'feature', 'LAND_EXPECTED_BASE':self.base,
            'LAND_OBSERVATION_LOCK':lock['path'], 'LAND_OBSERVATION_LOCK_ID':str(lock['device'])+':'+str(lock['inode'])}
        monitor = module('gate_monitor')
        process = subprocess.Popen(['bash', str(HERE / 'land.sh'), prepared['SQUASHED'], str(self.worker)], env=environment, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        child, communicated = None, False
        try:
            deadline = time.monotonic()+10
            while not marker.exists() and process.poll() is None and time.monotonic()<deadline:
                time.sleep(0.01)
            self.assertTrue(marker.exists(), 'real Git reference transaction never reached the controlled FF')
            self.assertNotEqual(self.git(self.main, 'status', '--porcelain'), '', 'fixture must expose Git’s non-atomic worktree/index transition')
            with ThreadPoolExecutor(max_workers=1) as pool:
                reading = pool.submit(self.core.preflight, 'monitor', values=self.v)
                time.sleep(0.1)
                self.assertFalse(reading.done(), 'observer read the partial Git transition without the shared lock')
                child = subprocess.Popen([sys.executable, '-B', str(self.run / 'operator-runtime/gate_monitor.py'), '--integrity-worker'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
                release.touch()
                output = process.communicate(timeout=15)[0]
                communicated = True
                self.assertEqual(process.returncode, 0, output)
                self.assertTrue(reading.result(timeout=15))
            child.wait(timeout=30)
            integrity = monitor.read_integrity(child, {**self.core.env(), 'BUNDLE':str(self.run / 'operator-runtime')})
            self.assertTrue(integrity['passed'])
            self.assertEqual([row['phase'] for row in integrity['phases']], ['preflight','authorization','control','snapshot'])
            self.terminal_fixture(prepared, integrity)
            result = self.operator.collect(self.v)
            self.assertTrue(result['passed'], result)
            self.assertTrue(self.operator.complete(self.v)['passed'])
            self.assertFalse((self.main / 'scripts/orchestration/declarations.d.ts').exists())
        finally:
            release.touch(exist_ok=True)
            if process.poll() is None:
                process.terminate()
            if not communicated:
                process.communicate(timeout=10)
            monitor.stop_integrity(child)

    def test_real_landing_rejects_external_tamper_and_unreviewed_tree(self):
        prepared = self.tooling_fixture()
        self.git(self.main, 'merge', '--ff-only', prepared['SQUASHED'])
        wrapper = self.orch / 'bounded.sh'
        before = wrapper.read_bytes();wrapper.write_text('# tampered wrapper\n')
        with self.assertRaisesRegex(RuntimeError, 'changed'):
            self.core.snapshot(self.v)
        wrapper.write_bytes(before)
        frozen = self.run / 'base-runtime/admission.sh'
        original_mode = frozen.stat().st_mode & 0o777
        frozen.chmod(0o755)
        with self.assertRaisesRegex(RuntimeError, 'Frozen base runtime mode changed'):
            self.core.snapshot(self.v)
        frozen.chmod(original_mode)
        (self.main / 'unreviewed').write_text('wrong tree\n')
        self.git(self.main, 'add', '.')
        self.git(self.main, 'commit', '-qm', 'unreviewed tree')
        integrity = module('gate_monitor').run_integrity_checks(self.core.env())
        self.assertFalse(integrity['passed'])
        self.assertIn('Integration changed', integrity['error'])

    def test_one_periodic_integrity_pass_runs_each_complete_authority_once(self):
        from unittest.mock import patch
        self.prepare_commit();self.authorize_fixture()
        monitor = module('gate_monitor')
        with patch('gate_core.authorization', wraps=__import__('gate_core').authorization) as auth, \
             patch.object(monitor, 'execution_control', wraps=monitor.execution_control) as control, \
             patch.object(monitor, 'snapshot', wraps=monitor.snapshot) as frozen:
            self.assertTrue(monitor.run_integrity_checks(self.core.env())['passed'])
        self.assertEqual((auth.call_count, control.call_count, frozen.call_count), (1,1,1))

    def update_fixture_config(self, config):
        from workflow_evidence import reference
        self.config.write_text(json.dumps(config))
        prepared_path = self.run / 'prepared.json'
        prepared = json.loads(prepared_path.read_text());prepared['config'] = reference(self.config)
        prepared_path.write_text(json.dumps(prepared))

    @recorder_session()
    def test_operator_verifies_applicable_original_validation_receipts(self):
        from workflow_evidence import reference
        self.prepare_commit();self.authorize_fixture()
        installed = self.worker / 'node_modules/.pnpm/lock.yaml'
        installed.parent.mkdir(parents=True);installed.write_text('installed fixture\n')
        cap = self.orch / 'capped.sh';cap.write_text('#!/bin/sh\nexec "$@"\n');cap.chmod(0o755)
        config = json.loads(self.config.read_text())
        plan_path = Path(config['validation']['plan']['path'])
        plan = json.loads(plan_path.read_text());plan['checks'] = {name:dict(argv=['pnpm','-s','typecheck'],inputs=[],impact='Fixture type contract') for name in ('types', 'types-again')}
        plan_path.write_text(json.dumps(plan))
        config['validation']['plan'] = reference(plan_path)
        self.update_fixture_config(config)
        with self.assertRaisesRegex(RuntimeError, 'Every planned reuse check'):
            self.core.preflight('submit', values=self.v)
        result = self.orch / 'actual-check'
        module('validation').run(str(plan_path), 'types', str(result))
        config['validation']['receipts']['types'] = reference(result / 'receipt.json')
        second = self.orch / 'second-check'
        module('validation').run(str(plan_path), 'types-again', str(second))
        config['validation']['receipts']['types-again'] = reference(second / 'receipt.json')
        self.update_fixture_config(config)
        from unittest.mock import patch
        import validation
        with patch('validation.shared_context', wraps=validation.shared_context) as contexts:
            self.assertTrue(self.core.authorization(self.v, full_validation=True))
            self.assertTrue(self.core.preflight('submit', values=self.v))
            self.assertTrue(self.core.preflight('complete', values=self.v))
            self.assertEqual(contexts.call_count, 3, 'one shared context per full boundary, not per receipt')
        with patch('validation.shared_context', wraps=validation.shared_context) as contexts:
            self.assertTrue(module('gate_monitor').run_integrity_checks(self.core.env())['passed'])
            self.assertEqual(contexts.call_count, 0, 'periodic proof must not reconstruct author contexts')
        installed.write_text('changed dependency\n')
        with self.assertRaisesRegex(RuntimeError, 'dependencies'):
            self.core.preflight('complete', values=self.v)
        installed.write_text('installed fixture\n')
        frozen = self.orch / 'frozen-verifier';frozen.mkdir()
        import shutil
        for name in ('validation.py','workflow_evidence.py'):
            shutil.copyfile(HERE / name, frozen / name)
        verified = subprocess.run([sys.executable,'-B',str(frozen / 'validation.py'),'verify',str(plan_path),'types',str(result / 'receipt.json')],capture_output=True,text=True)
        self.assertEqual(verified.returncode, 0, verified.stderr)
        receipt = result / 'receipt.json'
        altered = json.loads(receipt.read_text());altered['context']['impact'] = 'invented pass'
        receipt.write_text(json.dumps(altered))
        config['validation']['receipts']['types'] = reference(receipt)
        self.update_fixture_config(config)
        with self.assertRaisesRegex(RuntimeError, 'original attempt'):
            self.core.preflight('submit', values=self.v)
        self.assertFalse(module('gate_monitor').run_integrity_checks(self.core.env())['passed'])
        self.assertFalse((self.run / 'submission-claim.json').exists())

    def test_review_must_cross_declared_author_rather_than_operator_identity(self):
        from workflow_evidence import reference
        self.prepare_commit();self.authorize_fixture()
        config = json.loads(self.config.read_text())
        author = self.orch / 'actual-author.json'
        author.write_text(json.dumps(dict(taskId='different-author-task',childRunId='different-author-run',providerInstanceId='claudeAgent',model='claude-opus-5-5',options=dict(effort='xhigh',fastMode=False))))
        config['author'] = reference(author)
        self.update_fixture_config(config)
        with self.assertRaisesRegex(RuntimeError, 'actual author model'):
            self.core.authorization(self.v)

    def test_missing_observation_or_collection_refuses_before_actual_launch(self):
        for phase in ('observe','collect','checked-land'):
            with self.subTest(phase=phase):
                if not (self.run / 'mapping.json').exists():
                    self.prepare_commit();self.authorize_fixture()
                config = json.loads(self.config.read_text())
                config['phases'] = ['prepare','submit','observe','collect','complete','checked-land']
                config['phases'].remove(phase)
                self.update_fixture_config(config)
                with self.assertRaisesRegex(RuntimeError, 'Submission requires'):
                    self.operator.run(self.v, resume=True)
                self.assertFalse((self.run / 'submission-claim.json').exists())

    def test_review_report_tamper_and_relabelled_model_are_rejected(self):
        from workflow_evidence import reference
        self.prepare_commit()
        self.authorize_fixture()
        self.assertTrue(self.core.authorization(self.v))
        config = json.loads(self.config.read_text())
        report = Path(config['reviews']['standards']['report']['path'])
        report.write_text('Changed report\n')
        with self.assertRaisesRegex(RuntimeError, 'changed'):
            self.core.authorization(self.v)
        config['reviews']['standards']['report'] = reference(report)
        task = Path(config['reviews']['standards']['task']['path'])
        actual = json.loads(task.read_text())
        actual['model'] = 'gpt-6-astra'
        task.write_text(json.dumps(actual))
        config['reviews']['standards']['task'] = reference(task)
        self.config.write_text(json.dumps(config))
        with self.assertRaisesRegex(RuntimeError, 'Reviewer identity/options mismatch'):
            self.core.authorization(self.v)

    def submitted_argv(self):
        import io
        invocation_id = 'fixture-20261027-010203-abcdef'
        log = str(self.orch / 'logs' / ('bounded-' + invocation_id + '.log'))
        class ReturnedLaunch:
            stdout = io.StringIO('unit: ep-fresh-' + invocation_id + '; log: ' + log + '; id: ' + invocation_id + '\n')
            def wait(self):
                return 0
        launched = []
        self.operator.submit(self.v, launch=lambda argv, **kwargs: launched.append(argv) or ReturnedLaunch())
        claim = json.loads((self.run / 'submission-claim.json').read_text())
        self.assertEqual(claim['argv'], launched[0])
        return claim

    def todays_argv(self):
        lock = json.loads((self.run / 'prepared.json').read_text())['landingLock']
        return [str(self.orch / 'bounded.sh'), '--detach', 'fixture', 'gate', '/usr/bin/env',
                'MAIN=' + str(self.main), 'EP_ORCH=' + str(self.orch), 'EP_REPO=' + str(self.worker), 'FEATURE=feature',
                'LAND_QUEUE_SNAPSHOT=' + self.v['SNAP'], 'LAND_OBSERVATION_LOCK=' + str(self.run / 'landing.lock'),
                'LAND_OBSERVATION_LOCK_ID=%d:%d' % (lock['device'], lock['inode']),
                'TRIAGE_EVIDENCE=' + str(self.run) + '/triage-evidence', 'GATE_SCRATCH_WORKTREES=' + str(self.run) + '/scratch-worktrees.txt',
                self.v['SNAP'] + '/land-queue.sh', 'implementation:' + str(self.worker)]

    def remote_config(self, mode='replace', mutate=None):
        rc = remote_fixtures()
        rc.install(self.worker)
        self.addCleanup(rc.writable, self.root)
        self.remote_runs = getattr(self, 'remote_runs', 0) + 1
        path, sha256 = rc.publish(self.orch, self.worker, self.base, 'fixture-20261030-120000-%06x' % self.remote_runs, mutate)
        config = json.loads(self.config.read_text())
        config['remoteChecks'] = dict(path=str(path), sha256=sha256, mode=mode)
        self.update_fixture_config(config)
        return config['remoteChecks']

    def test_claim_argv_without_remote_checks_is_byte_identical_to_today(self):
        self.prepare_commit()
        self.authorize_fixture()
        claim = self.submitted_argv()
        self.assertEqual(claim['argv'], self.todays_argv())
        self.assertEqual(set(claim), {'at', 'argv', 'controls', 'candidate', 'label', 'attempt', 'main', 'orch'})

    def test_claim_argv_with_remote_checks_adds_exactly_the_four_bindings(self):
        self.prepare_commit()
        self.authorize_fixture()
        for mode in ('replace', 'compare'):
            remote = self.remote_config(mode)
            self.assertTrue(self.core.authorization(self.v))
        expected = self.todays_argv()
        expected[-2:-2] = ['LAND_REMOTE_CHECKS=' + remote['path'], 'LAND_REMOTE_CHECKS_SHA256=' + remote['sha256'],
                           'LAND_REMOTE_CHECKS_MODE=compare', 'LAND_REMOTE_EVIDENCE=' + str(self.run) + '/remote-evidence']
        self.assertEqual(self.submitted_argv()['argv'], expected)

    def submitted_gate_cap(self, mode):
        """The gate cap the claim records and the launch hands bounded.sh, for one gate mode."""
        import io
        self.prepare_commit()
        self.authorize_fixture()
        if mode != 'local':
            self.remote_config(mode)
            self.assertTrue(self.core.authorization(self.v))
        invocation_id = 'fixture-20261027-010203-abcdef'
        log = str(self.orch / 'logs' / ('bounded-' + invocation_id + '.log'))
        class ReturnedLaunch:
            stdout = io.StringIO('unit: ep-fresh-' + invocation_id + '; log: ' + log + '; id: ' + invocation_id + '\n')
            def wait(self):
                return 0
        environments = []
        self.operator.submit(self.v, launch=lambda argv, **kwargs: environments.append(kwargs['env']) or ReturnedLaunch())
        claim = json.loads((self.run / 'submission-claim.json').read_text())
        self.assertEqual(environments[0]['BOUNDED_GATE_MEMORY_MAX'], claim['controls']['BOUNDED_GATE_MEMORY_MAX'])
        return claim['controls']['BOUNDED_GATE_MEMORY_MAX']

    def test_a_local_gate_launches_at_the_full_suite_cap(self):
        self.assertEqual(self.submitted_gate_cap('local'), '15G')

    def test_a_compare_gate_launches_at_the_full_suite_cap(self):
        self.assertEqual(self.submitted_gate_cap('compare'), '15G')

    def test_a_replace_gate_launches_at_the_replace_cap(self):
        self.assertEqual(self.submitted_gate_cap('replace'), '10G')

    def test_an_ambient_gate_cap_is_an_injected_override(self):
        os.environ['BOUNDED_GATE_MEMORY_MAX'] = '10G'
        self.addCleanup(os.environ.pop, 'BOUNDED_GATE_MEMORY_MAX', None)
        with self.assertRaisesRegex(RuntimeError, 'Injected resource/runtime override: BOUNDED_GATE_MEMORY_MAX'):
            self.core.reject_overrides()

    def test_stale_or_invalid_remote_checks_refuse_at_prepare_and_submit(self):
        self.prepare_commit()
        self.authorize_fixture()
        for reason, mutate, mode in (('Remote tree mismatch', lambda m, d: m['source'].update(tree='0' * 40), 'replace'),
                                     ('Remote base mismatch', lambda m, d: remote_fixtures().retrail(m['source'], **{'Gate-Base': m['source']['tree']}), 'replace'),
                                     ('Gate commit has parents', lambda m, d: m['source'].update(parents=[self.base]), 'replace'),
                                     ('Remote command failed: suite', lambda m, d: m['commands'][3].update(exitCode=1), 'replace'),
                                     ('Unknown remoteChecks mode', None, 'skip')):
            with self.subTest(reason=reason):
                self.remote_config(mode, mutate)
                with self.assertRaisesRegex(RuntimeError, reason):
                    self.core.authorization(self.v, full_validation=True)
                with self.assertRaisesRegex(RuntimeError, reason):
                    self.operator.prepare(self.v)
                with self.assertRaisesRegex(RuntimeError, reason):
                    self.operator.submit(self.v, launch=lambda *args, **kwargs: self.fail('launched'))
                self.assertFalse((self.run / 'submission-claim.json').exists())
        remote = self.remote_config('replace')
        config = json.loads(self.config.read_text())
        config['remoteChecks']['sha256'] = '0' * 64
        self.update_fixture_config(config)
        with self.assertRaisesRegex(RuntimeError, 'Remote manifest hash mismatch'):
            self.core.authorization(self.v)
        self.assertTrue(remote)

    def remote_terminal(self, mode, verify=True, compare=True, audit='passed'):
        """A landed candidate whose queue verified the remote manifest and then compared it (compare)
        or ran the host audits (replace; audit is the listed test's status there, None for no run)."""
        import shutil
        prepared = self.tooling_fixture()
        remote = self.remote_config(mode) if mode else None
        self.git(self.main, 'merge', '--ff-only', prepared['SQUASHED'])
        integrity = module('gate_monitor').run_integrity_checks(self.core.env())
        self.assertTrue(integrity['passed'], integrity)
        self.terminal_fixture(prepared, integrity)
        if not mode:
            return prepared, remote
        shutil.rmtree(self.run / 'triage-evidence')
        environment = {**os.environ, 'EP_ORCH': str(self.orch)}
        if verify:
            subprocess.run([sys.executable, '-B', str(HERE / 'remote_checks.py'), 'verify', remote['path'], remote['sha256'],
                            str(self.worker), self.base, str(self.run / 'remote-evidence')], check=True, env=environment, capture_output=True)
        if mode == 'compare':
            (self.run / 'triage-evidence').mkdir()
            local = self.run / 'triage-evidence/full.json'
            create_json(local, remote_fixtures().report(root='/gate'))
            if compare:
                subprocess.run([sys.executable, '-B', str(HERE / 'remote_checks.py'), 'compare', remote['path'], remote['sha256'],
                                str(local), str(self.worker / 'scripts/orchestration/host-audits.json'), str(self.run / 'remote-evidence')],
                               check=True, env=environment, capture_output=True)
        if mode == 'replace' and verify and audit:
            self.host_audit(remote, audit, environment)
        return prepared, remote

    def host_audit(self, remote, status, environment):
        """What host-audits.sh leaves in remote-evidence: the list, the host run's report and the verdict."""
        rc = remote_fixtures()
        evidence = self.run / 'remote-evidence'
        listed = evidence / 'host-audits-list.json'
        listed.write_bytes((self.worker / 'scripts/orchestration/host-audits.json').read_bytes())
        value = rc.report(files=(rc.AUDITED[0],), root='/gate/ep-gate-audits', skipped=(rc.AUDITED[0],) if status == 'skipped' else ())
        create_json(evidence / 'host-audits-report.json', value)
        subprocess.run([sys.executable, '-B', str(HERE / 'remote_checks.py'), 'audit', remote['path'], remote['sha256'], str(listed),
                        str(evidence / 'host-audits-report.json'), '/gate/ep-gate-audits', '0', str(evidence)],
                       env=environment, capture_output=True)

    def test_collect_without_remote_checks_keeps_todays_result_fields_and_scope(self):
        self.remote_terminal(None)
        result = self.operator.collect(self.v)
        self.assertTrue(result['passed'], result)
        self.assertEqual(set(result), {'at', 'passed', 'checks', 'errors', 'invocation', 'evidence', 'cleanup', 'timing'})
        self.assertFalse([name for name in result['checks'] if name.startswith('remote')])
        self.operator.complete(self.v)
        self.assertEqual(json.loads((self.run / 'completion.json').read_text())['scope'],
                         'Authorized strict local queue and checked completion only; no Cloud/GitHub/promotion qualification')

    def test_collect_in_replace_mode_takes_the_suite_from_the_verified_manifest(self):
        _, remote = self.remote_terminal('replace')
        result = self.operator.collect(self.v)
        self.assertTrue(result['passed'], result)
        self.assertTrue(result['checks']['remoteChecks'] and result['checks']['originalSuite'] and result['checks']['hostAudits'])
        self.assertNotIn('remoteComparison', result['checks'])
        record = self.run / 'remote-evidence/host-audits.json'
        self.assertEqual(result['suite'], dict(source='remote+host-audits', manifest=dict(path=remote['path'], sha256=remote['sha256']),
                                               hostAudits=dict(path=str(record), sha256=digest(record))))
        referenced = {Path(item['path']).name for item in result['evidence']}
        manifest = json.loads(Path(remote['path']).read_text())
        self.assertIn(dict(path=str(Path(remote['path']).parent / 'lint.log'), sha256=manifest['commands'][2]['log']['sha256']), result['evidence'])
        self.assertTrue({'manifest.json', 'full.json', 'install.log', 'typecheck.log', 'lint.log', 'suite.log',
                         'remote-verification.json', 'local-files.json', 'host-audits.json', 'host-audits-list.json',
                         'host-audits-report.json'} <= referenced, referenced)
        self.assertTrue(self.operator.complete(self.v)['passed'])
        scope = json.loads((self.run / 'completion.json').read_text())['scope']
        self.assertIn('remote heavy-check suite ' + remote['path'] + " (replace) plus the gate host's host audits", scope)

    def test_collect_in_replace_mode_accepts_a_listed_remote_skip(self):
        rc = remote_fixtures()
        def skip(m, d):
            rc.write_suite(m, d, skipped=(rc.AUDITED[0],))
        original = self.remote_config
        self.remote_config = lambda mode='replace', mutate=None: original(mode, skip)
        self.remote_terminal('replace')
        result = self.operator.collect(self.v)
        self.assertTrue(result['passed'], result)
        self.assertTrue(result['checks']['originalSuite'] and result['checks']['hostAudits'])

    def refused_host_audits(self, audit, reason):
        self.remote_terminal('replace', audit=audit)
        result = self.operator.collect(self.v)
        self.assertFalse(result['passed'])
        self.assertFalse(result['checks']['hostAudits'])
        self.assertIn(reason, json.dumps(result['errors']))
        with self.assertRaisesRegex(RuntimeError, 'Failed result'):
            self.operator.complete(self.v)

    def test_collect_in_replace_mode_fails_without_the_host_audit_record(self):
        self.refused_host_audits(None, 'host-audits.json')

    def test_collect_in_replace_mode_fails_on_a_host_audit_skip(self):
        self.refused_host_audits('skipped', 'Remote host-audits.json did not pass for the configured manifest')
        record = json.loads((self.run / 'remote-evidence/host-audits.json').read_text())
        self.assertTrue(record['error'].startswith('Host-audit test not passed on the gate host: skipped'), record)

    def rejudged_host_audit(self, value):
        """Collection's errors after a passed host-audits.json is re-pointed at the report value."""
        self.remote_terminal('replace')
        evidence = self.run / 'remote-evidence'
        forged = evidence / 'forged-report.json'
        create_json(forged, value)
        record = json.loads((evidence / 'host-audits.json').read_text())
        self.assertIs(record['passed'], True)
        record['report'] = dict(path=str(forged), sha256=digest(forged))
        (evidence / 'host-audits.json').write_text(json.dumps(record))
        result = self.operator.collect(self.v)
        self.assertFalse(result['passed'])
        self.assertFalse(result['checks']['hostAudits'])
        return json.dumps(result['errors'])

    def host_audit_report(self, **options):
        rc = remote_fixtures()
        return rc.report(files=(rc.AUDITED[0],), root='/gate/ep-gate-audits', **options)

    def test_collect_rejudges_a_passed_host_audit_record(self):
        rc = remote_fixtures()
        self.assertIn('Host-audit test not passed on the gate host: skipped',
                      self.rejudged_host_audit(self.host_audit_report(skipped=(rc.AUDITED[0],))))

    def test_collect_in_replace_mode_refuses_a_failed_host_audit_file_under_green_counters(self):
        self.assertIn('Host audit suite file not passed: tests/b.test.ts',
                      self.rejudged_host_audit(remote_fixtures().failed_file(self.host_audit_report())))

    def test_collect_in_replace_mode_refuses_failed_host_audit_suites(self):
        self.assertIn('Host audit suite was not all green', self.rejudged_host_audit(remote_fixtures().failed_suite(self.host_audit_report())))

    def rejudged_comparison(self, value):
        """Collection's errors after a passed remote-comparison.json is re-pointed at the local report value."""
        self.remote_terminal('compare')
        local = self.run / 'triage-evidence/full.json'
        local.write_text(json.dumps(value))
        path = self.run / 'remote-evidence/remote-comparison.json'
        record = json.loads(path.read_text())
        self.assertIs(record['passed'], True)
        record['local'] = dict(path=str(local), sha256=digest(local))
        path.write_text(json.dumps(record))
        result = self.operator.collect(self.v)
        self.assertFalse(result['passed'])
        self.assertFalse(result['checks']['remoteComparison'])
        return json.dumps(result['errors'])

    def test_collect_in_compare_mode_refuses_a_failed_local_file_under_green_counters(self):
        rc = remote_fixtures()
        self.assertIn('Local suite file not passed: tests/b.test.ts', self.rejudged_comparison(rc.failed_file(rc.report(root='/gate'))))

    def test_collect_in_compare_mode_refuses_failed_local_suites(self):
        rc = remote_fixtures()
        self.assertIn('Local suite was not all green', self.rejudged_comparison(rc.failed_suite(rc.report(root='/gate'))))

    def test_collect_in_compare_mode_requires_the_local_suite_and_the_comparison(self):
        _, remote = self.remote_terminal('compare')
        result = self.operator.collect(self.v)
        self.assertTrue(result['passed'], result)
        self.assertTrue(result['checks']['remoteChecks'] and result['checks']['remoteComparison'])
        self.assertNotIn('hostAudits', result['checks'])
        self.assertEqual(result['suite']['source'], 'local+remote-compare')
        self.assertIn('remote-comparison.json', {Path(item['path']).name for item in result['evidence']})

    def test_collect_references_the_declared_remote_digests(self):
        _, remote = self.remote_terminal('replace')
        lint = Path(remote['path']).parent / 'lint.log'
        lint.chmod(0o644)
        lint.write_text('rewritten after the queue verified it\n')
        lint.chmod(0o444)
        result = self.operator.collect(self.v)
        self.assertFalse(result['passed'])
        self.assertFalse(result['checks']['remoteEvidence'])
        self.assertNotIn(str(lint), {item['path'] for item in result['evidence']})

    def test_collect_fails_without_the_comparison_record(self):
        self.remote_terminal('compare', compare=False)
        result = self.operator.collect(self.v)
        self.assertFalse(result['passed'])
        self.assertFalse(result['checks']['remoteComparison'])

    def test_collect_fails_without_the_queue_verification_record(self):
        self.remote_terminal('replace', verify=False)
        result = self.operator.collect(self.v)
        self.assertFalse(result['passed'])
        self.assertFalse(result['checks']['remoteChecks'])
        with self.assertRaisesRegex(RuntimeError, 'Failed result'):
            self.operator.complete(self.v)

    def test_collect_fails_with_a_mismatched_verification_record(self):
        self.remote_terminal('replace', verify=False)
        (self.run / 'remote-evidence').mkdir()
        config = json.loads(self.config.read_text())
        create_json(self.run / 'remote-evidence/remote-verification.json', dict(passed=True,
            manifest=dict(path=config['remoteChecks']['path'], sha256=config['remoteChecks']['sha256']),
            candidate=self.reviewed, tree=self.tree, base=self.base))
        result = self.operator.collect(self.v)
        self.assertFalse(result['passed'])
        self.assertFalse(result['checks']['remoteChecks'])
        self.assertIn('does not bind this candidate', json.dumps(result['errors']))

    def test_phase_authorization_chains_once_and_stop_or_wrong_task_refuses(self):
        task = self.orch / 'task.json'
        task.write_text(json.dumps(dict(taskId='fixture-task', childRunId='fixture-run')))
        control = self.orch / 'control.json'
        value = dict(state='active', taskId='fixture-task', runId='fixture-run', reviewed=self.reviewed, tree=self.tree, base=self.base)
        control.write_text(json.dumps(value))
        self.config.write_text(json.dumps(dict(operator=dict(path=str(task)), control=str(control),
            phases=['prepare', 'submit', 'observe', 'collect', 'complete', 'checked-land'])))
        for phase in ('prepare', 'submit', 'observe', 'collect', 'complete'):
            self.assertEqual(self.core.execution_control(self.v, step=phase)['state'], 'active')
        for change in (dict(state='stopped'), dict(taskId='other'), dict(tree='0' * 40)):
            control.write_text(json.dumps({**value, **change}))
            with self.assertRaises(RuntimeError):
                self.core.execution_control(self.v, step='submit')
        control.write_text(json.dumps(value))
        config = json.loads(self.config.read_text())
        config['phases'].remove('checked-land')
        self.config.write_text(json.dumps(config))
        with self.assertRaisesRegex(RuntimeError, 'checked-land'):
            self.core.execution_control(self.v, step='submit')


TODAYS_SCOPE = 'Authorized strict local queue and checked completion only; no Cloud/GitHub/promotion qualification'


def two_windows(first, second):
    """The research note's file: two identical six-line windows that differ only in x."""
    window = 'c1\nc2\nc3\nx={}\nc4\nc5\nc6\n'
    return 'm\n' + window.format(first) + 'm\n' + window.format(second) + 't\n'


class RebaseProofTest(unittest.TestCase):
    """Reviews bound to an accepted commit carried to REVIEWED by a mechanical-rebase proof
    (owner decision 2026-10-31, item 1). Synthetic Git fixtures prove the contract only."""
    setUp, tearDown, git = GateTransitionTest.setUp, GateTransitionTest.tearDown, GateTransitionTest.git
    prepare_commit, authorize_fixture = GateTransitionTest.prepare_commit, GateTransitionTest.authorize_fixture
    update_fixture_config, record_owned_fixture = GateTransitionTest.update_fixture_config, GateTransitionTest.record_owned_fixture
    terminal_fixture, remote_config, remote_terminal = (GateTransitionTest.terminal_fixture, GateTransitionTest.remote_config,
                                                        GateTransitionTest.remote_terminal)
    host_audit = GateTransitionTest.host_audit

    def commit(self, root, files, message):
        for name, text in files.items():
            (Path(root) / name).write_text(text)
            self.git(root, 'add', name)
        self.git(root, 'commit', '-qm', message)

    def accept(self):
        """The reviewed chain on today's base becomes the accepted commit."""
        self.old_base, self.accepted, self.accepted_tree = self.base, self.reviewed, self.tree

    def rebind(self, prepared=False):
        """Point BASE/REVIEWED/TREE, control and config at the current integration and worker heads."""
        self.base = self.git(self.main, 'rev-parse', 'HEAD')
        self.reviewed = self.git(self.worker, 'rev-parse', 'HEAD')
        self.tree = self.git(self.worker, 'rev-parse', 'HEAD^{tree}')
        self.v.update(BASE=self.base, REVIEWED=self.reviewed, TREE=self.tree)
        if prepared:
            self.prepare_commit()
        self.authorize_fixture(prepared)

    def rebase_fixture(self, prepared=False):
        """Accept the chain, advance feature with an unrelated file and rebase the worker onto it."""
        self.accept()
        self.commit(self.main, {'upstream': 'base movement\n'}, 'unrelated upstream change')
        self.git(self.worker, 'rebase', '-q', 'feature')
        self.rebind(prepared)

    def replay(self, onto, revisions):
        """Cherry-pick revisions onto an older commit in a throwaway detached worktree."""
        scratch = self.root / 'replay'
        self.git(self.main, 'worktree', 'add', '-q', '--detach', str(scratch), onto)
        try:
            self.git(scratch, 'cherry-pick', revisions)
            return self.git(scratch, 'rev-parse', 'HEAD')
        finally:
            self.git(self.main, 'worktree', 'remove', '--force', str(scratch))

    def tooling_fixture(self):
        """GateTransitionTest's prepared tooling candidate, rebased over an unrelated base movement and
        carried by a proof from the same commits on the old base. The spec review stays at REVIEWED."""
        old_base = self.base
        self.commit(self.main, {'upstream': 'base movement\n'}, 'unrelated upstream change')
        self.git(self.worker, 'rebase', '-q', 'feature')
        self.base = self.git(self.main, 'rev-parse', 'HEAD')
        self.v.update(BASE=self.base)
        prepared = GateTransitionTest.tooling_fixture(self)
        self.old_base = old_base
        self.accepted = self.replay(old_base, self.base + '..' + self.reviewed)
        self.accepted_tree = self.git(self.main, 'rev-parse', self.accepted + '^{tree}')
        self.prove(spec='reviewed')
        return prepared

    def prove(self, standards='accepted', spec='accepted', drop=(), **fields):
        config = json.loads(self.config.read_text())
        proof = {**dict(oldBase=self.old_base, accepted=self.accepted, acceptedTree=self.accepted_tree), **fields}
        config['rebaseProof'] = {key: value for key, value in proof.items() if key not in drop}
        for axis, scope in (('standards', standards), ('spec', spec)):
            bound = dict(accepted=(self.accepted, self.accepted_tree), reviewed=(self.reviewed, self.tree)).get(scope, scope)
            config['reviews'][axis].update(commit=bound[0], tree=bound[1])
        self.write_config(config)
        return config

    def write_config(self, config):
        if (self.run / 'prepared.json').exists():
            self.update_fixture_config(config)
        else:
            self.config.write_text(json.dumps(config))

    def refuses(self, pattern):
        with self.assertRaisesRegex(RuntimeError, pattern):
            self.core.authorization(self.v)

    def cli(self, *args):
        result = subprocess.run([sys.executable, '-B', str(HERE / 'rebase-proof.py'), *map(str, args)], capture_output=True, text=True)
        self.assertEqual(result.stdout.count('\n'), 1, result.stdout + result.stderr)
        return result.returncode, json.loads(result.stdout)

    # (a) pass cases
    def test_reviews_at_the_accepted_commit_pass_with_a_mechanical_rebase(self):
        self.rebase_fixture()
        self.assertNotEqual((self.old_base, self.accepted), (self.base, self.reviewed))
        for standards, spec in (('accepted', 'accepted'), ('reviewed', 'accepted'), ('accepted', 'reviewed')):
            with self.subTest(standards=standards, spec=spec):
                self.prove(standards, spec)
                self.assertEqual(self.core.authorization(self.v)['rebaseProof']['accepted'], self.accepted)

    def test_proof_summary_names_both_chains(self):
        self.rebase_fixture()
        self.assertEqual(self.core.rebase_proof(str(self.worker), self.old_base, self.accepted, self.base, self.reviewed),
                         dict(oldBase=self.old_base, accepted=self.accepted, base=self.base, reviewed=self.reviewed, commits=2, paths=1))

    def test_every_periodic_integrity_pass_reverifies_the_proof(self):
        from unittest.mock import patch
        self.rebase_fixture(prepared=True)
        self.prove()
        monitor = module('gate_monitor')
        with patch('gate_core.rebase_proof', wraps=__import__('gate_core').rebase_proof) as proof:
            integrity = monitor.run_integrity_checks(self.core.env())
        self.assertTrue(integrity['passed'], integrity)
        self.assertEqual(proof.call_count, 1)
        self.prove(acceptedTree=self.tree)
        integrity = monitor.run_integrity_checks(self.core.env())
        self.assertEqual((integrity['passed'], integrity['phase']), (False, 'authorization'))
        self.assertIn('accepted tree mismatch', integrity['error'])

    # (b) unchanged default
    def test_without_a_proof_an_older_commit_review_keeps_todays_refusal(self):
        self.rebase_fixture()
        config = self.prove(spec='reviewed')
        del config['rebaseProof']
        self.write_config(config)
        with self.assertRaises(RuntimeError) as caught:
            self.core.authorization(self.v)
        self.assertEqual(str(caught.exception), 'Wrong reviewed scope: standards')

    def test_with_a_proof_a_review_at_any_other_commit_keeps_todays_refusal(self):
        self.rebase_fixture()
        other = self.git(self.worker, 'rev-parse', 'HEAD^')
        self.prove(spec=(other, self.git(self.worker, 'rev-parse', 'HEAD^^{tree}')))
        with self.assertRaises(RuntimeError) as caught:
            self.core.authorization(self.v)
        self.assertEqual(str(caught.exception), 'Wrong reviewed scope: spec')

    # (c) overlap with the base movement
    def test_a_slice_hunk_replayed_at_an_offset_refuses(self):
        self.commit(self.main, {'f': two_windows(1, 1)}, 'old base with two identical windows')
        self.git(self.worker, 'reset', '-q', '--hard', 'feature')
        self.commit(self.worker, {'f': two_windows(2, 1)}, 'fix the first window')
        self.commit(self.worker, {'s.txt': 'slice\n'}, 'add s')
        self.rebind()
        self.accept()
        self.commit(self.main, {'f': two_windows(2, 1)}, 'the same fix lands upstream')
        self.git(self.worker, 'reset', '-q', '--hard', 'feature')
        for commit in self.git(self.worker, 'rev-list', '--reverse', self.old_base + '..' + self.accepted).split():
            patch = subprocess.check_output(['git', '-C', self.worker, 'diff', '--no-ext-diff', '--no-textconv', commit + '^', commit])
            subprocess.run(['git', '-C', self.worker, 'apply', '--index'], input=patch, check=True, capture_output=True)
            self.git(self.worker, 'commit', '-q', '-C', commit)
        self.assertEqual((self.worker / 'f').read_text(), two_windows(2, 2), 'the replay must change the unreviewed second window')
        self.rebind()
        self.prove()
        self.refuses('Rebase proof commit delta differs')

    def test_a_clean_overlapping_rebase_refuses(self):
        lines = ['line %d\n' % number for number in range(1, 21)]
        self.commit(self.main, {'f': ''.join(lines)}, 'old base')
        self.git(self.worker, 'reset', '-q', '--hard', 'feature')
        self.commit(self.worker, {'f': ''.join(lines[:1] + ['slice\n'] + lines[2:])}, 'slice edits the top')
        self.rebind()
        self.accept()
        self.commit(self.main, {'f': ''.join(lines[:18] + ['upstream\n'] + lines[19:])}, 'upstream edits the bottom')
        self.git(self.worker, 'rebase', '-q', 'feature')
        self.rebind()
        self.assertEqual((self.worker / 'f').read_text().count('\n'), 20)
        self.prove()
        self.refuses('Rebase proof commit delta differs')

    # (d) commit changes
    def test_changed_added_or_dropped_commits_refuse(self):
        self.rebase_fixture()
        rebased = self.reviewed

        def amend_content():
            (self.worker / 'value').write_text('2\n')
            self.git(self.worker, 'commit', '-qa', '--amend', '--no-edit')
        cases = [('reworded', 'Rebase proof commit message differs', lambda: self.git(self.worker, 'commit', '-q', '--amend', '-m', 'reworded')),
                 ('amended', 'Rebase proof commit delta differs', amend_content),
                 ('added empty', 'Rebase proof commit count differs: 2 vs 3',
                  lambda: self.git(self.worker, 'commit', '-q', '--allow-empty', '-m', 'empty')),
                 ('dropped', 'Rebase proof commit count differs: 2 vs 1', lambda: self.git(self.worker, 'reset', '-q', '--hard', 'HEAD^'))]
        for name, pattern, change in cases:
            with self.subTest(name):
                self.git(self.worker, 'reset', '-q', '--hard', rebased)
                change()
                self.rebind()
                self.prove()
                self.refuses(pattern)

    # (e) base and chain shape
    def test_unmoved_or_unrelated_bases_and_nonlinear_chains_refuse(self):
        self.rebase_fixture()
        self.prove(oldBase=self.base)
        self.refuses('Rebase proof needs a moved base')
        side = self.git(self.main, 'commit-tree', self.old_base + '^{tree}', '-p', self.old_base, '-m', 'side branch')
        self.prove(oldBase=side)
        self.refuses('Rebase proof old base is not an ancestor of BASE')
        merge = self.git(self.worker, 'commit-tree', self.tree, '-p', self.reviewed, '-p', self.old_base, '-m', 'merge')
        self.git(self.worker, 'reset', '-q', '--hard', merge)
        self.rebind()
        self.prove()
        self.refuses('Rebase proof chain is empty or non-linear: ' + self.base + '..' + merge)
        self.git(self.worker, 'reset', '-q', '--hard', 'HEAD^1')
        self.rebind()
        self.accepted = self.git(self.worker, 'commit-tree', self.accepted_tree, '-p', self.accepted, '-p', self.old_base, '-m', 'merge')
        self.prove()
        self.refuses('Rebase proof chain is empty or non-linear: ' + self.old_base + '..' + self.accepted)
        self.accepted, self.accepted_tree = self.old_base, self.git(self.main, 'rev-parse', self.old_base + '^{tree}')
        self.prove()
        self.refuses('Rebase proof chain is empty or non-linear')

    # (f) bad proof fields
    def test_malformed_mismatched_missing_wrong_kind_or_unused_proofs_refuse(self):
        self.rebase_fixture()
        missing = 'deadbeef' * 5
        cases = [('tree mismatch', 'Rebase proof accepted tree mismatch', dict(acceptedTree=self.tree)),
                 ('missing accepted', 'Rebase proof object missing: ' + missing, dict(accepted=missing)),
                 ('missing old base', 'Rebase proof object missing: ' + missing, dict(oldBase=missing)),
                 ('short SHA', 'Invalid rebase proof', dict(accepted=self.accepted[:12])),
                 ('extra key', 'Invalid rebase proof', dict(newBase=self.base)),
                 ('missing key', 'Invalid rebase proof', dict(drop=('acceptedTree',))),
                 ('unused', 'Unused rebase proof', dict(standards='reviewed', spec='reviewed'))]
        for name, pattern, change in cases:
            with self.subTest(name):
                self.prove(**change)
                self.refuses(pattern)
        config = self.prove()
        config['rebaseProof'] = [config['rebaseProof']]
        self.write_config(config)
        self.refuses('Invalid rebase proof')
        config = self.prove()
        config['kind'] = 'curation'
        self.write_config(config)
        self.refuses('Rebase proof is supported for code gates only')

    # (g) completion scope
    def test_completion_scope_names_the_carried_reviews_only_with_a_proof(self):
        self.remote_terminal(None)
        self.assertTrue(self.operator.collect(self.v)['passed'])
        self.assertTrue(self.operator.complete(self.v)['passed'])
        self.assertEqual(json.loads((self.run / 'completion.json').read_text())['scope'], TODAYS_SCOPE + '; reviews accepted at ' +
                         self.accepted + ' on ' + self.old_base + ' carried by the mechanical-rebase proof')

    def test_completion_scope_composes_the_proof_with_remote_checks(self):
        _, remote = self.remote_terminal('replace')
        self.assertTrue(self.operator.collect(self.v)['passed'])
        self.assertTrue(self.operator.complete(self.v)['passed'])
        self.assertEqual(json.loads((self.run / 'completion.json').read_text())['scope'],
                         'Authorized strict local queue with the verified remote heavy-check suite ' + remote['path'] +
                         " (replace) plus the gate host's host audits and checked completion only; no Cloud/GitHub/promotion "
                         'qualification; reviews accepted at ' +
                         self.accepted + ' on ' + self.old_base + ' carried by the mechanical-rebase proof')

    # (h) CLI
    def test_cli_prints_the_gate_field_on_pass_and_the_reason_on_failure(self):
        self.rebase_fixture()
        self.assertTrue(os.access(HERE / 'rebase-proof.py', os.X_OK))
        code, result = self.cli(self.worker, self.old_base, self.accepted, self.base)
        proof = dict(oldBase=self.old_base, accepted=self.accepted, acceptedTree=self.accepted_tree)
        self.assertEqual((code, result), (0, dict(verdict='PASS', oldBase=self.old_base, accepted=self.accepted, base=self.base,
                                                  reviewed=self.reviewed, commits=2, paths=1, tree=self.tree, rebaseProof=proof)))
        self.assertEqual(self.git(self.worker, 'status', '--porcelain=v1', '--untracked-files=all'), '')
        config = self.prove()
        config['rebaseProof'] = result['rebaseProof']
        self.write_config(config)
        self.core.authorization(self.v)
        self.git(self.worker, 'commit', '-q', '--allow-empty', '-m', 'empty')
        code, result = self.cli(self.worker, self.old_base, self.accepted, self.base)
        self.assertEqual((code, result), (1, dict(verdict='FAIL', reason='Rebase proof commit count differs: 2 vs 3')))
        code, result = self.cli('--head', self.reviewed, self.worker, self.old_base, self.accepted, self.base)
        self.assertEqual((code, result['verdict'], result['reviewed']), (0, 'PASS', self.reviewed))

    def test_cli_refuses_a_dirty_worktree_short_shas_and_an_unrelated_head(self):
        self.rebase_fixture()
        (self.worker / 'untracked').write_text('not part of the reviewed head\n')
        code, result = self.cli(self.worker, self.old_base, self.accepted, self.base)
        self.assertEqual((code, result['verdict']), (1, 'FAIL'))
        self.assertIn('clean worktree', result['reason'])
        (self.worker / 'untracked').unlink()
        code, result = self.cli(self.worker, self.old_base[:12], self.accepted, self.base)
        self.assertEqual((code, result['verdict']), (1, 'FAIL'))
        self.assertIn('Full Git SHA required', result['reason'])
        side = self.git(self.main, 'commit-tree', self.base + '^{tree}', '-p', self.base, '-m', 'side')
        code, result = self.cli(self.worker, self.old_base, self.accepted, side)
        self.assertEqual((code, result), (1, dict(verdict='FAIL', reason='HEAD does not descend from NEW_BASE')))



class SingleAxisReviewTest(unittest.TestCase):
    """One axis's LAND at an earlier commit E carried over the other axis's fix review of E..H by root's
    attestation (owner decision 2026-10-31, item 2). Synthetic Git fixtures prove the contract only."""
    setUp, tearDown, git = GateTransitionTest.setUp, GateTransitionTest.tearDown, GateTransitionTest.git
    prepare_commit, authorize_fixture = GateTransitionTest.prepare_commit, GateTransitionTest.authorize_fixture
    update_fixture_config, record_owned_fixture = GateTransitionTest.update_fixture_config, GateTransitionTest.record_owned_fixture
    terminal_fixture, remote_config, remote_terminal = (GateTransitionTest.terminal_fixture, GateTransitionTest.remote_config,
                                                        GateTransitionTest.remote_terminal)
    host_audit = GateTransitionTest.host_audit
    commit, accept, rebind, rebase_fixture, replay = (RebaseProofTest.commit, RebaseProofTest.accept, RebaseProofTest.rebind,
                                                      RebaseProofTest.rebase_fixture, RebaseProofTest.replay)
    prove, write_config, refuses, rebase_tooling_fixture = (RebaseProofTest.prove, RebaseProofTest.write_config,
                                                            RebaseProofTest.refuses, RebaseProofTest.tooling_fixture)
    STATEMENT = 'Synthetic fixture: the delta stays within the findings and touches nothing the carried axis judged.'

    def carry(self, axis='spec', carried=None, head=None, report=None, attest=None, drop=()):
        """B (axis) binds E, by default the first author commit; A binds H (REVIEWED); A's report names E..H
        and root's attestation records the real delta."""
        from workflow_evidence import reference
        fixer = 'standards' if axis == 'spec' else 'spec'
        head = head or self.reviewed
        carried = carried or self.git(self.worker, 'rev-parse', head + '^')
        config = json.loads(self.config.read_text())
        config['reviews'][fixer].update(commit=head, tree=self.git(self.worker, 'rev-parse', head + '^{tree}'))
        config['reviews'][axis].update(commit=carried, tree=self.git(self.worker, 'rev-parse', carried + '^{tree}'))
        delta = carried + '..' + head
        report_path = self.orch / (fixer + '.md')
        report_path.write_text(('Synthetic fix review of ' + delta + '; not authentic review qualification.\n') if report is None else report)
        config['reviews'][fixer]['report'] = reference(report_path)
        paths = sorted(self.git(self.worker, 'diff-tree', '-r', '--no-renames', '--name-only', carried, head).splitlines())
        attestation = {**dict(version=1, axis=axis, carried=carried, head=head, paths=paths, statement=self.STATEMENT,
                              attestedBy='fixture-root'), **(attest or {})}
        self.attestation = self.orch / 'carried-attestation.json'
        self.attestation.write_text(json.dumps({key: value for key, value in attestation.items() if key not in drop}))
        config['carriedReview'] = dict(axis=axis, commit=carried, tree=self.git(self.worker, 'rev-parse', carried + '^{tree}'),
                                       attestation=reference(self.attestation))
        self.write_config(config)
        return config

    def change(self, mutate):
        config = json.loads(self.config.read_text())
        mutate(config)
        self.write_config(config)

    def tooling_fixture(self):
        """GateTransitionTest's prepared tooling candidate with spec carried from REVIEWED^; with compose, the
        rebased candidate whose standards fix review binds the accepted commit on the old base."""
        if getattr(self, 'compose', False):
            prepared = self.rebase_tooling_fixture()
            self.prove()
            self.carry(head=self.accepted)
            return prepared
        prepared = GateTransitionTest.tooling_fixture(self)
        if getattr(self, 'carrying', True):
            self.carry()
        return prepared

    def assert_refusal(self, message):
        with self.assertRaises(RuntimeError) as caught:
            self.core.authorization(self.v)
        self.assertEqual(str(caught.exception), message)

    # (a) pass cases
    def test_a_carried_review_passes_in_both_directions(self):
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        for axis in ('spec', 'standards'):
            with self.subTest(axis=axis):
                self.carry(axis)
                self.assertEqual(self.core.authorization(self.v)['carriedReview']['axis'], axis)
        self.assertEqual(self.core.carry_proof(str(self.worker), self.base, first, self.git(self.worker, 'rev-parse', first + '^{tree}'),
                                               self.reviewed), dict(base=self.base, carried=first, head=self.reviewed, paths=['value']))

    def test_every_periodic_integrity_pass_reverifies_the_carry(self):
        from unittest.mock import patch
        self.prepare_commit()
        self.authorize_fixture()
        self.carry()
        monitor = module('gate_monitor')
        with patch('gate_core.carry_proof', wraps=__import__('gate_core').carry_proof) as proof:
            integrity = monitor.run_integrity_checks(self.core.env())
        self.assertTrue(integrity['passed'], integrity)
        self.assertEqual(proof.call_count, 1)
        self.attestation.write_text(self.attestation.read_text().replace('fixture-root', 'someone-else'))
        integrity = monitor.run_integrity_checks(self.core.env())
        self.assertEqual((integrity['passed'], integrity['phase']), (False, 'authorization'))
        self.assertIn('Evidence/input changed: ' + str(self.attestation), integrity['error'])

    # (b) unchanged default
    def test_without_the_field_an_older_commit_review_keeps_todays_refusal(self):
        self.authorize_fixture(prepared=False)
        self.carry()
        self.change(lambda config: config.pop('carriedReview'))
        self.assert_refusal('Wrong reviewed scope: spec')

    # (c) composition with a rebase proof
    def test_fix_then_rebase_passes(self):
        self.rebase_fixture()
        for axis in ('spec', 'standards'):
            with self.subTest(axis=axis):
                self.prove()
                self.carry(axis, head=self.accepted)
                self.assertEqual(self.core.authorization(self.v)['carriedReview']['commit'],
                                 self.git(self.worker, 'rev-parse', self.accepted + '^'))

    def test_rebase_then_fix_refuses_on_the_chain_before_the_unused_proof(self):
        self.rebase_fixture()
        old = self.git(self.worker, 'rev-parse', self.accepted + '^')
        self.prove()
        self.carry(carried=old)
        self.assert_refusal("Carried commit is not in the fix review's chain: " + self.base + '..' + self.reviewed)
        self.change(lambda config: config.pop('rebaseProof'))
        self.assert_refusal("Carried commit is not in the fix review's chain: " + self.base + '..' + self.reviewed)

    # (d) Git stops
    def test_carried_commit_outside_the_linear_chain_refuses(self):
        self.authorize_fixture(prepared=False)
        side = self.git(self.main, 'commit-tree', self.git(self.worker, 'rev-parse', 'HEAD^^{tree}'), '-p', self.base, '-m', 'side')
        outside = "Carried commit is not in the fix review's chain: " + self.base + '..' + self.reviewed
        for name, carried in (('E is H', self.reviewed), ('E is BASE', self.base), ('side commit', side)):
            with self.subTest(name):
                self.carry(carried=carried)
                self.assert_refusal(outside)
        missing = 'deadbeef' * 5
        self.carry()
        self.change(lambda config: config['carriedReview'].update(commit=missing))
        self.assert_refusal('Carried review object missing: ' + missing)
        self.carry()
        self.change(lambda config: config['carriedReview'].update(tree=self.tree))
        self.assert_refusal('Carried review tree mismatch')
        merge = self.git(self.worker, 'commit-tree', self.tree, '-p', self.reviewed, '-p', self.base, '-m', 'merge')
        self.git(self.worker, 'reset', '-q', '--hard', merge)
        self.rebind()
        self.carry()
        self.assert_refusal('Carried review chain is empty or non-linear: ' + self.base + '..' + merge)

    # (e) report stops
    def test_a_fix_report_that_does_not_name_the_full_delta_refuses(self):
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        for name, report in (('no delta', 'Synthetic fix review without a range.\n'),
                             ('short SHAs', 'Synthetic fix review of ' + first[:12] + '..' + self.reviewed[:12] + '.\n')):
            with self.subTest(name):
                self.carry(report=report)
                self.assert_refusal('Fix review report does not name the delta ' + first + '..' + self.reviewed)

    # (f) attestation stops
    def test_an_attestation_that_disagrees_with_git_or_the_config_refuses(self):
        self.authorize_fixture(prepared=False)
        cases = [('axis', dict(attest=dict(axis='standards'))), ('carried', dict(attest=dict(carried=self.base))),
                 ('head', dict(attest=dict(head=self.base))), ('version', dict(attest=dict(version=2))),
                 ('version', dict(attest=dict(version=True))),
                 ('paths', dict(attest=dict(paths=['other', 'value']))), ('paths', dict(attest=dict(paths=[]))),
                 ('statement', dict(attest=dict(statement=''))), ('attestedBy', dict(attest=dict(attestedBy=''))),
                 ('keys', dict(attest=dict(extra='unexpected'))), ('keys', dict(drop=('attestedBy',)))]
        for key, change in cases:
            with self.subTest(key=key, change=change):
                self.carry(**change)
                self.assert_refusal('Carried review attestation mismatch: ' + key)
        self.carry()
        self.attestation.write_text(self.attestation.read_text() + '\n')
        self.assert_refusal('Evidence/input changed: ' + str(self.attestation))

    # (g) shape stops
    def test_malformed_curation_or_unused_carried_reviews_refuse(self):
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        cases = [('extra key', lambda field: field.update(head=self.reviewed)),
                 ('missing key', lambda field: field.pop('tree')),
                 ('short SHA', lambda field: field.update(commit=first[:12])),
                 ('axis curation', lambda field: field.update(axis='curation')),
                 ('attestation shape', lambda field: field['attestation'].update(mode='replace'))]
        for name, mutate in cases:
            with self.subTest(name):
                self.carry()
                self.change(lambda config: mutate(config['carriedReview']))
                self.assertRaisesRegex(RuntimeError, '^Invalid carried review', self.core.authorization, self.v)
        self.carry()
        self.change(lambda config: config.update(carriedReview=[config['carriedReview']]))
        self.assertRaisesRegex(RuntimeError, '^Invalid carried review', self.core.authorization, self.v)
        self.carry()
        self.change(lambda config: config['reviews']['spec'].update(commit=self.reviewed, tree=self.tree))
        self.assert_refusal('Wrong carried scope: spec')
        self.carry()
        self.change(lambda config: config['reviews']['standards'].update(commit=first, tree=self.git(self.worker, 'rev-parse', first + '^{tree}')))
        self.assert_refusal('Wrong reviewed scope: standards')
        self.carry()
        self.change(lambda config: config.update(kind='curation'))
        self.assert_refusal('Carried review is supported for code gates only')

    # (h) completion scope
    def carried_suffix(self, head):
        first = self.git(self.worker, 'rev-parse', head + '^')
        return ('; spec review accepted at ' + first + ' carried over the standards review of ' + first + '..' + head +
                ' by attestation ' + str(self.attestation))

    def completion_scope(self):
        self.remote_terminal(None)
        self.assertTrue(self.operator.collect(self.v)['passed'])
        self.assertTrue(self.operator.complete(self.v)['passed'])
        return json.loads((self.run / 'completion.json').read_text())['scope']

    def test_completion_scope_names_the_carried_review_only_with_the_field(self):
        self.assertEqual(self.completion_scope(), TODAYS_SCOPE + self.carried_suffix(self.reviewed))

    def test_completion_scope_is_unchanged_without_the_field(self):
        self.carrying = False
        self.assertEqual(self.completion_scope(), TODAYS_SCOPE)

    def test_completion_scope_puts_the_rebase_suffix_before_the_carried_one(self):
        self.compose = True
        self.assertEqual(self.completion_scope(), TODAYS_SCOPE + '; reviews accepted at ' + self.accepted + ' on ' + self.old_base +
                         ' carried by the mechanical-rebase proof' + self.carried_suffix(self.accepted))


class ConditionalLandTest(unittest.TestCase):
    """A review's "LAND once X is fixed" at commit E, bound together with the repaired head H: the repair E..H
    touches exactly the named paths (or the commit message), and root's attestation records the mechanical
    check (speed-conditional-land-binding, owner 2026-11-04). Synthetic Git fixtures prove the contract only."""
    setUp, tearDown, git = GateTransitionTest.setUp, GateTransitionTest.tearDown, GateTransitionTest.git
    prepare_commit, authorize_fixture = GateTransitionTest.prepare_commit, GateTransitionTest.authorize_fixture
    update_fixture_config, record_owned_fixture = GateTransitionTest.update_fixture_config, GateTransitionTest.record_owned_fixture
    terminal_fixture, remote_config, remote_terminal = (GateTransitionTest.terminal_fixture, GateTransitionTest.remote_config,
                                                        GateTransitionTest.remote_terminal)
    host_audit = GateTransitionTest.host_audit
    commit, accept, rebind, rebase_fixture, replay = (RebaseProofTest.commit, RebaseProofTest.accept, RebaseProofTest.rebind,
                                                      RebaseProofTest.rebase_fixture, RebaseProofTest.replay)
    prove, write_config = RebaseProofTest.prove, RebaseProofTest.write_config
    change, assert_refusal = SingleAxisReviewTest.change, SingleAxisReviewTest.assert_refusal
    STATEMENT = 'Synthetic fixture: the repair is exactly the conditional X, verified by the recorded check.'

    def bind(self, axes=('spec',), commit=None, head=None, paths=None, message=None, reports=None, conditionals=None,
             attest=None, drop=(), check=None):
        """AXES review E (by default H^) and answer "LAND once X is fixed" in a conditional file each; H (REVIEWED,
        or HEAD for a rebase composition) is the repair. CONDITIONALS maps an axis to its file's value (a dict, raw
        text, or None for no file); REPORTS maps an axis to its report Markdown, which never grants scope. Paths,
        message, the conditional files and the attestation default to what Git shows for E..H."""
        from workflow_evidence import reference
        head = head or self.reviewed
        commit = commit or self.git(self.worker, 'rev-parse', head + '^')
        tree = self.git(self.worker, 'rev-parse', commit + '^{tree}')
        config = json.loads(self.config.read_text())
        names = sorted(self.git(self.worker, 'diff-tree', '-r', '--no-renames', '--name-only', commit, head).splitlines())
        descendant = subprocess.run(['git', '-C', str(self.worker), 'merge-base', '--is-ancestor', commit, head]).returncode == 0
        body = lambda sha: self.git(self.worker, 'cat-file', 'commit', sha).partition('\n\n')[2]
        changed = not descendant and body(commit) != body(head)
        for review in config['reviews'].values():
            review.pop('conditional', None)
        for axis in axes:
            config['reviews'][axis].update(commit=commit, tree=tree)
            report = self.orch / (axis + '.md')
            report.write_text((reports or {}).get(axis, 'Synthetic review of ' + commit + '; not authentic review qualification.\n'))
            config['reviews'][axis]['report'] = reference(report)
            value = (conditionals or {}).get(axis, self.conditional(commit, names, changed))
            if value is not None:
                path = self.orch / (axis + '-conditional.json')
                path.write_text(value if isinstance(value, str) else json.dumps(value))
                config['reviews'][axis]['conditional'] = reference(path)
        attestation = {**dict(version=1, kind='conditional-land', axes=sorted(axes), commit=commit, head=head,
                              relation='descendant' if descendant else 'amend', paths=names, message=changed,
                              check=check or dict(command='git -C WT log -1 --format=%B ' + self.reviewed, output='fixture check output',
                                                  commit=self.reviewed),
                              statement=self.STATEMENT, attestedBy='fixture-root'), **(attest or {})}
        self.attestation = self.orch / 'conditional-attestation.json'
        self.attestation.write_text(json.dumps({key: value for key, value in attestation.items() if key not in drop}))
        config['conditionalLand'] = dict(axes=sorted(axes), commit=commit, tree=tree, paths=names if paths is None else paths,
                                         message=changed if message is None else message, attestation=reference(self.attestation))
        self.write_config(config)
        return config

    def conditional(self, commit, paths, message, **override):
        """A reviewer's conditional file at COMMIT permitting exactly PATHS and, if MESSAGE, a message change."""
        return {**dict(version=1, verdict='land-once-fixed', reviewed=commit, paths=sorted(paths), message=message, check='cat value'),
                **override}

    def amended(self, tree=None, message='author step'):
        """E as the commit H amended: H's parent, with TREE (default H's) and MESSAGE (default H's)."""
        return self.git(self.worker, 'commit-tree', tree or self.tree, '-p', self.reviewed + '^', '-m', message)

    def refusal(self, message):
        with self.assertRaises(RuntimeError) as caught:
            self.core.authorization(self.v)
        self.assertEqual(str(caught.exception), message)

    # (a) pass cases
    def test_a_repair_after_the_reviewed_commit_passes_for_either_or_both_axes(self):
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        for axes in (('spec',), ('standards',), ('spec', 'standards')):
            with self.subTest(axes=axes):
                self.authorize_fixture(prepared=False)
                self.bind(axes)
                self.assertEqual(self.core.authorization(self.v)['conditionalLand']['axes'], sorted(axes))
        self.assertEqual(self.core.conditional_proof(str(self.worker), self.base, first, self.git(self.worker, 'rev-parse', first + '^{tree}'),
                                                     self.reviewed),
                         dict(base=self.base, commit=first, head=self.reviewed, relation='descendant', paths=['value'], message=False))

    def test_an_amended_message_count_or_both_passes(self):
        self.authorize_fixture(prepared=False)
        before = self.git(self.worker, 'rev-parse', 'HEAD^^{tree}')
        cases = [('message', self.amended(message='stale message'), [], True),
                 ('count', self.amended(tree=before), ['value'], False),
                 ('both', self.amended(tree=before, message='stale message'), ['value'], True)]
        for name, commit, paths, message in cases:
            with self.subTest(name):
                self.bind(commit=commit)
                land = self.core.authorization(self.v)['conditionalLand']
                self.assertEqual((land['paths'], land['message']), (paths, message))
                proof = self.core.conditional_proof(str(self.worker), self.base, commit, land['tree'], self.reviewed)
                self.assertEqual((proof['relation'], proof['paths'], proof['message']), ('amend', paths, message))

    def curation_fixture(self):
        """One specialized-prepared curation commit H on BASE and the reviewed E it amends with a repaired message."""
        from workflow_evidence import reference
        self.authorize_fixture(prepared=False)
        self.git(self.worker, 'reset', '-q', '--soft', self.base)
        self.git(self.worker, 'commit', '-qm', 'Curate fixtures (#7)')
        self.rebind()
        config = json.loads(self.config.read_text())
        review = config['reviews'].pop('standards')
        config['reviews'].pop('spec')
        config.update(kind='curation', issue=7, reviews=dict(curation=review))
        self.write_config(config)
        return self.git(self.worker, 'commit-tree', self.tree, '-p', self.base, '-m', 'Curate fixtures (stale count)')

    def test_a_curation_prep_message_repair_passes(self):
        stale = self.curation_fixture()
        self.bind(('curation',), commit=stale)
        land = self.core.authorization(self.v)['conditionalLand']
        self.assertEqual((land['axes'], land['commit'], land['paths'], land['message']), (['curation'], stale, [], True))

    def test_fix_then_rebase_passes_with_one_or_every_axis_at_the_conditional_commit(self):
        self.rebase_fixture()
        for axes in (('spec',), ('spec', 'standards')):
            with self.subTest(axes=axes):
                self.prove()
                self.bind(axes, head=self.accepted)
                self.assertEqual(self.core.authorization(self.v)['conditionalLand']['commit'],
                                 self.git(self.worker, 'rev-parse', self.accepted + '^'))

    def test_every_periodic_integrity_pass_reverifies_the_binding(self):
        from unittest.mock import patch
        self.prepare_commit()
        self.authorize_fixture()
        self.bind()
        monitor = module('gate_monitor')
        with patch('gate_core.conditional_proof', wraps=__import__('gate_core').conditional_proof) as proof:
            integrity = monitor.run_integrity_checks(self.core.env())
        self.assertTrue(integrity['passed'], integrity)
        self.assertEqual(proof.call_count, 1)
        self.attestation.write_text(self.attestation.read_text().replace('fixture-root', 'someone-else'))
        integrity = monitor.run_integrity_checks(self.core.env())
        self.assertEqual((integrity['passed'], integrity['phase']), (False, 'authorization'))
        self.assertIn('Evidence/input changed: ' + str(self.attestation), integrity['error'])

    # (b) unchanged default
    def test_without_the_field_a_repaired_review_keeps_todays_refusal(self):
        self.authorize_fixture(prepared=False)
        self.bind()
        self.change(lambda config: (config.pop('conditionalLand'), config['reviews']['spec'].pop('conditional')))
        self.refusal('Wrong reviewed scope: spec')

    # (c) delta stops: broader, outside the named set, narrower, message not named or absent
    def test_a_broader_delta_or_a_path_outside_the_named_set_refuses(self):
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        self.commit(self.worker, {'value': '2\n', 'other': 'unrelated\n'}, 'repair and more')
        self.rebind()
        mismatch = lambda changed, named: ('Conditional LAND path mismatch: the repair ' + first + '..' + self.reviewed + ' changes ' +
                                           str(changed) + ', not the named ' + str(named))
        cases = [('broader', dict(commit=first, paths=['value']), ['other', 'value'], ['value']),
                 ('outside', dict(commit=first, paths=['count.txt']), ['other', 'value'], ['count.txt']),
                 ('narrower', dict(commit=first, paths=['other', 'shared', 'value']), ['other', 'value'], ['other', 'shared', 'value'])]
        for name, change, changed, named in cases:
            with self.subTest(name):
                self.bind(**change)
                self.refusal(mismatch(changed, named))

    def test_a_message_the_conditional_did_not_name_or_a_named_message_left_unchanged_refuses(self):
        self.authorize_fixture(prepared=False)
        before = self.git(self.worker, 'rev-parse', 'HEAD^^{tree}')
        self.bind(commit=self.amended(tree=before, message='stale message'), message=False)
        self.refusal('Conditional LAND message mismatch: the repair changes the commit message, which the conditional did not name')
        self.bind(commit=self.amended(tree=before), message=True)
        self.refusal('Conditional LAND message mismatch: the named message repair is absent')
        self.bind(message=True)
        self.refusal('Conditional LAND message mismatch: the named message repair is absent')

    # (d) Git stops
    def test_a_conditional_commit_outside_the_chain_refuses(self):
        self.authorize_fixture(prepared=False)
        side = self.git(self.main, 'commit-tree', self.git(self.worker, 'rev-parse', 'HEAD^^{tree}'), '-p', self.base, '-m', 'side')
        outside = 'Conditional LAND commit is neither in the chain nor amended at its tip: ' + self.base + '..' + self.reviewed
        for name, commit in (('E is BASE', self.base), ('side commit', side)):
            with self.subTest(name):
                self.bind(commit=commit)
                self.refusal(outside)
        self.bind(commit=self.reviewed, paths=['value'])
        self.refusal('Conditional LAND needs a repair: its commit is the head ' + self.reviewed)
        missing = 'deadbeef' * 5
        self.bind()
        self.change(lambda config: config['conditionalLand'].update(commit=missing))
        self.refusal('Conditional LAND object missing: ' + missing)
        self.bind()
        self.change(lambda config: config['conditionalLand'].update(tree=self.tree))
        self.refusal('Conditional LAND tree mismatch')

    def test_a_merge_in_the_chain_or_an_amended_merge_refuses(self):
        self.authorize_fixture(prepared=False)
        merged = self.git(self.worker, 'commit-tree', self.tree, '-p', self.reviewed + '^', '-p', self.base, '-m', 'author step')
        self.bind(commit=merged, paths=['value'])
        self.refusal('Conditional LAND commit is neither in the chain nor amended at its tip: ' + self.base + '..' + self.reviewed)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        merge = self.git(self.worker, 'commit-tree', self.tree, '-p', self.reviewed, '-p', self.base, '-m', 'merge')
        self.git(self.worker, 'reset', '-q', '--hard', merge)
        self.rebind()
        self.bind(commit=first)
        self.refusal('Conditional LAND chain is empty or non-linear: ' + self.base + '..' + merge)

    # (e) attestation stops
    def test_a_missing_edited_or_disagreeing_attestation_refuses(self):
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        cases = [('version', dict(attest=dict(version=2))), ('version', dict(attest=dict(version=True))),
                 ('kind', dict(attest=dict(kind='carried-review'))), ('axes', dict(attest=dict(axes=['spec', 'standards']))),
                 ('commit', dict(attest=dict(commit=self.base))), ('head', dict(attest=dict(head=first))),
                 ('relation', dict(attest=dict(relation='amend'))), ('paths', dict(attest=dict(paths=[]))),
                 ('message', dict(attest=dict(message=True))), ('message', dict(attest=dict(message=0))),
                 ('check', dict(check=dict(command='git log -1', output='x', commit=first))),
                 ('check', dict(check=dict(command='', output='x', commit=self.reviewed))),
                 ('check', dict(check=dict(command='git log -1', output='', commit=self.reviewed))),
                 ('check', dict(check=dict(command='git log -1', output='x', commit=self.reviewed, extra=1))),
                 ('statement', dict(attest=dict(statement=' '))), ('attestedBy', dict(attest=dict(attestedBy=''))),
                 ('keys', dict(attest=dict(extra='unexpected'))), ('keys', dict(drop=('check',)))]
        for key, change in cases:
            with self.subTest(key=key, change=change):
                self.bind(**change)
                self.refusal('Conditional LAND attestation mismatch: ' + key)
        self.bind()
        self.attestation.write_text(self.attestation.read_text() + '\n')
        self.refusal('Evidence/input changed: ' + str(self.attestation))
        self.bind()
        self.attestation.unlink()
        self.refusal('Conditional LAND attestation missing: ' + str(self.attestation))

    # (f) reviewer-scope stops: only the bound conditional files grant scope; config and attestation can only narrow it
    def test_a_broadened_config_and_attestation_cannot_widen_the_reviewed_scope(self):
        """Spec r1's counterexample: the file permits value; the repair, config and attestation say [other, value]."""
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        self.commit(self.worker, {'value': '2\n', 'other': 'unrelated\n'}, 'repair and more')
        self.rebind()
        self.bind(commit=first, conditionals=dict(spec=self.conditional(first, ['value'], False)))
        self.refusal(self.exceeds(first))
        self.bind(commit=first, conditionals=dict(spec=self.conditional(first, ['other', 'value'], False)))
        self.assertEqual(self.core.authorization(self.v)['conditionalLand']['paths'], ['other', 'value'])

    def exceeds(self, first, allowed="['value']"):
        return ("Conditional LAND exceeds the reviewed scope: the repair " + first + '..' + self.reviewed +
                " changes ['other'] beyond the conditional files' " + allowed)

    def test_a_message_change_no_file_permits_refuses_for_code_and_curation(self):
        self.authorize_fixture(prepared=False)
        before = self.git(self.worker, 'rev-parse', 'HEAD^^{tree}')
        commit = self.amended(tree=before, message='stale message')
        self.bind(commit=commit, conditionals=dict(spec=self.conditional(commit, ['value'], False)))
        self.refusal('Conditional LAND exceeds the reviewed scope: no conditional file permits a message change')
        stale = self.curation_fixture()
        self.bind(('curation',), commit=stale, conditionals=dict(curation=self.conditional(stale, ['value'], False)))
        self.refusal('Conditional LAND exceeds the reviewed scope: no conditional file permits a message change')

    def test_two_files_grant_the_union_and_a_listed_review_without_one_grants_nothing(self):
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        self.commit(self.worker, {'value': '2\n', 'other': 'unrelated\n'}, 'repair and more')
        self.rebind()
        both = ('spec', 'standards')
        self.bind(both, commit=first, conditionals=dict(spec=self.conditional(first, ['value'], False),
                                                        standards=self.conditional(first, ['other'], False)))
        self.assertEqual(self.core.authorization(self.v)['conditionalLand']['axes'], ['spec', 'standards'])
        self.bind(both, commit=first, conditionals=dict(spec=self.conditional(first, ['value'], False), standards=None))
        self.refusal(self.exceeds(first))
        self.bind(both, commit=first, conditionals=dict(spec=self.conditional(first, ['other', 'value'], False), standards=None))
        self.assertEqual(self.core.authorization(self.v)['conditionalLand']['axes'], ['spec', 'standards'])
        self.bind(both, commit=first, conditionals=dict(spec=None, standards=None))
        self.refusal('Conditional LAND scope missing: no listed review binds a conditional file (spec, standards)')

    def test_a_conditional_file_on_an_unlisted_review_refuses(self):
        from workflow_evidence import reference
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        self.bind()
        stray = self.orch / 'standards-conditional.json'
        stray.write_text(json.dumps(self.conditional(first, ['value'], False)))
        self.change(lambda config: config['reviews']['standards'].update(conditional=reference(stray)))
        self.refusal('Conditional file bound to a review conditionalLand does not list: standards')
        self.change(lambda config: config.pop('conditionalLand'))
        self.refusal('Conditional file bound to a review conditionalLand does not list: spec, standards')

    REPORT_ROUTES = {
        'header and last line (r2 format)': 'LAND once fixed\nReviewed: {E}\n\nBody.\n\nLAND once fixed: paths=other,value; message=yes; check=x\n',
        'fence open at EOF': 'LAND once fixed\nReviewed: {E}\n\nExample only:\n```\nLAND once fixed: paths=other,value; message=yes; check=x\n',
        'tilde fence open at EOF': 'LAND once fixed\nReviewed: {E}\n\n~~~\nLAND once fixed: paths=other,value; message=yes; check=x\n',
        'longer opener, short closer': 'LAND once fixed\nReviewed: {E}\n\n````\nx\n```\nLAND once fixed: paths=other,value; message=yes; check=x\n',
        'lazy blockquote': 'LAND once fixed\nReviewed: {E}\n\n> Scope example:\nLAND once fixed: paths=other,value; message=yes; check=x\n',
        'open HTML comment': 'LAND once fixed\nReviewed: {E}\n\n<!-- example\nLAND once fixed: paths=other,value; message=yes; check=x\n',
        'FIX FIRST with a scope line': 'FIX FIRST\nReviewed: {E}\n\nLAND once fixed: paths=other,value; message=yes; check=x\n',
        'another commit naming E': 'LAND once fixed\nReviewed: {S}\n\nPrior accepted commit: {E}\n\nLAND once fixed: paths=other,value; message=yes; check=x\n',
        'JSON in the report': '{{"version": 1, "verdict": "land-once-fixed", "reviewed": "{E}", "paths": ["other", "value"], "message": true, "check": "x"}}\n'}

    def test_report_text_never_grants_scope_for_code_or_curation(self):
        """Every report-text route from rounds 2 and 3 is inert: with no conditional file the scope is missing, and
        with a narrow file the wide report text does not widen it."""
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        self.commit(self.worker, {'value': '2\n', 'other': 'unrelated\n'}, 'repair and more')
        self.rebind()
        for axis in ('spec', 'standards'):
            for name, text in self.REPORT_ROUTES.items():
                with self.subTest(axis=axis, route=name):
                    report = text.format(E=first, S=self.reviewed)
                    self.bind((axis,), commit=first, reports={axis: report}, conditionals={axis: None})
                    self.refusal('Conditional LAND scope missing: no listed review binds a conditional file (' + axis + ')')
                    self.bind((axis,), commit=first, reports={axis: report}, conditionals={axis: self.conditional(first, ['value'], False)})
                    self.refusal(self.exceeds(first))
        stale = self.curation_fixture()
        for name, text in self.REPORT_ROUTES.items():
            with self.subTest(axis='curation', route=name):
                report = text.format(E=stale, S=self.reviewed)
                self.bind(('curation',), commit=stale, reports=dict(curation=report), conditionals=dict(curation=None))
                self.refusal('Conditional LAND scope missing: no listed review binds a conditional file (curation)')
                self.bind(('curation',), commit=stale, reports=dict(curation=report),
                          conditionals=dict(curation=self.conditional(stale, ['value'], False)))
                self.refusal('Conditional LAND exceeds the reviewed scope: no conditional file permits a message change')

    def test_a_missing_changed_or_malformed_conditional_file_refuses(self):
        self.authorize_fixture(prepared=False)
        path = self.orch / 'spec-conditional.json'
        self.bind()
        path.unlink()
        self.refusal('Conditional file missing for spec: ' + str(path))
        self.bind()
        path.write_text(path.read_text() + ' ')
        self.refusal('Evidence/input changed: ' + str(path))
        invalid = 'Invalid conditional file for spec: '
        for name, text in (('not JSON', '{"version": 1,'), ('repeated key', '{"version": 1, "version": 1}'), ('empty', '')):
            with self.subTest(name):
                self.bind(conditionals=dict(spec=text))
                self.assertRaisesRegex(RuntimeError, '^' + invalid + 'not one JSON object', self.core.authorization, self.v)
        self.bind()
        self.change(lambda config: config['reviews']['spec']['conditional'].pop('sha256'))
        self.refusal(invalid + 'the review binds it as {path, sha256}')
        stale = self.curation_fixture()
        self.bind(('curation',), commit=stale)
        (self.orch / 'curation-conditional.json').unlink()
        self.refusal('Conditional file missing for curation: ' + str(self.orch / 'curation-conditional.json'))

    def test_wrong_extra_or_unknown_keys_and_values_refuse(self):
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        invalid = 'Invalid conditional file for spec: '
        keys = invalid + 'exactly version, verdict, reviewed, paths, message and check'
        good = self.conditional(first, ['value'], False)
        cases = [('extra key', {**good, 'scope': 'all'}, keys), ('unknown key instead', {**{k: v for k, v in good.items() if k != 'check'}, 'command': 'x'}, keys),
                 ('missing key', {k: v for k, v in good.items() if k != 'message'}, keys), ('a list', [good], keys),
                 ('version 2', {**good, 'version': 2}, invalid + 'version must be 1'), ('version true', {**good, 'version': True}, invalid + 'version must be 1'),
                 ('verdict land', {**good, 'verdict': 'land'}, invalid + 'verdict must be "land-once-fixed"'),
                 ('verdict text', {**good, 'verdict': 'LAND once fixed'}, invalid + 'verdict must be "land-once-fixed"'),
                 ('short SHA', {**good, 'reviewed': first[:12]}, invalid + 'reviewed must be a full SHA'),
                 ('paths string', {**good, 'paths': 'value'}, invalid + 'paths must be a sorted list of unique repo paths'),
                 ('paths unsorted', {**good, 'paths': ['value', 'other']}, invalid + 'paths must be a sorted list of unique repo paths'),
                 ('paths repeated', {**good, 'paths': ['value', 'value']}, invalid + 'paths must be a sorted list of unique repo paths'),
                 ('empty path', {**good, 'paths': ['']}, invalid + 'paths must be a sorted list of unique repo paths'),
                 ('message string', {**good, 'message': 'no'}, invalid + 'message must be true or false'),
                 ('permits nothing', {**good, 'paths': [], 'message': False}, invalid + 'it permits nothing (no paths and message false)'),
                 ('empty check', {**good, 'check': ' '}, invalid + 'check must be a non-empty string'),
                 ('check list', {**good, 'check': ['x']}, invalid + 'check must be a non-empty string')]
        for name, value, message in cases:
            with self.subTest(name):
                self.bind(conditionals=dict(spec=value))
                self.refusal(message)

    def test_a_reviewed_commit_other_than_the_bound_commit_and_E_refuses(self):
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        self.bind(conditionals=dict(spec=self.conditional(self.reviewed, ['value'], False)))
        self.refusal('Conditional file for spec reviewed ' + self.reviewed + ', not the bound commit ' + first + ' and E ' + first)
        self.bind()
        self.change(lambda config: config['reviews']['spec'].update(commit=self.reviewed, tree=self.tree))
        self.refusal('Conditional file for spec reviewed ' + first + ', not the bound commit ' + self.reviewed + ' and E ' + first)
        stale = self.curation_fixture()
        self.bind(('curation',), commit=stale, conditionals=dict(curation=self.conditional(self.base, [], True)))
        self.refusal('Conditional file for curation reviewed ' + self.base + ', not the bound commit ' + stale + ' and E ' + stale)

    # (g) shape and scope stops
    def test_malformed_combined_or_unbound_conditionals_refuse(self):
        self.authorize_fixture(prepared=False)
        first = self.git(self.worker, 'rev-parse', 'HEAD^')
        cases = [('extra key', lambda field: field.update(head=self.reviewed)), ('missing key', lambda field: field.pop('message')),
                 ('short SHA', lambda field: field.update(commit=first[:12])), ('no axes', lambda field: field.update(axes=[])),
                 ('curation axis', lambda field: field.update(axes=['curation'])), ('repeated axis', lambda field: field.update(axes=['spec', 'spec'])),
                 ('unsorted axes', lambda field: field.update(axes=['standards', 'spec'])),
                 ('unsorted paths', lambda field: field.update(paths=['value', 'other'])), ('empty path', lambda field: field.update(paths=[''])),
                 ('message type', lambda field: field.update(message='yes')), ('nothing named', lambda field: field.update(paths=[], message=False)),
                 ('attestation shape', lambda field: field['attestation'].update(mode='replace'))]
        for name, mutate in cases:
            with self.subTest(name):
                self.bind()
                self.change(lambda config: mutate(config['conditionalLand']))
                self.assertRaisesRegex(RuntimeError, '^Invalid conditional LAND', self.core.authorization, self.v)
        self.bind()
        self.change(lambda config: config.update(conditionalLand=[config['conditionalLand']]))
        self.assertRaisesRegex(RuntimeError, '^Invalid conditional LAND', self.core.authorization, self.v)
        self.bind()
        self.change(lambda config: config.update(carriedReview=dict(axis='standards', commit=first, tree=self.tree,
                                                                    attestation=config['conditionalLand']['attestation'])))
        self.refusal('Conditional LAND does not combine with a carried review')
        self.change(lambda config: config.pop('carriedReview'))
        self.bind(('spec', 'standards'), conditionals=dict(standards=None))
        self.change(lambda config: config['reviews']['standards'].update(commit=self.reviewed, tree=self.tree))
        self.refusal('Wrong conditional LAND scope: standards')
        self.bind()
        self.change(lambda config: config['reviews']['standards'].update(commit=first, tree=self.git(self.worker, 'rev-parse', first + '^{tree}')))
        self.refusal('Wrong reviewed scope: standards')

    # (h) completion scope
    def test_completion_scope_names_the_conditional_binding(self):
        self.remote_terminal(None)
        self.bind()
        self.assertTrue(self.operator.collect(self.v)['passed'])
        self.assertTrue(self.operator.complete(self.v)['passed'])
        first = self.git(self.worker, 'rev-parse', self.reviewed + '^')
        self.assertEqual(json.loads((self.run / 'completion.json').read_text())['scope'],
                         TODAYS_SCOPE + '; spec review accepted at ' + first + ' with a conditional LAND, repaired to ' + self.reviewed +
                         " (paths ['scripts/orchestration/cur-land.sh', 'scripts/orchestration/declarations.d.ts']) by attestation " +
                         str(self.attestation))

    def tooling_fixture(self):
        return GateTransitionTest.tooling_fixture(self)


class CurationRemoteTest(unittest.TestCase):
    """A curation gate with remote checks (curation-remote slice B): its candidate is the prep commit itself, the CI
    manifest binds that commit, and gate.json pins the remote-suite prep receipt cur-<n>-prep.remote.receipt, whose
    issue, commit, tree, base and integration head gate_core joins with REVIEWED, TREE and BASE at every authorization.
    Synthetic Git fixtures prove the contract only; nothing here launches an agent or a gate unit."""
    setUp, tearDown, git = GateTransitionTest.setUp, GateTransitionTest.tearDown, GateTransitionTest.git
    authorize_fixture, update_fixture_config = GateTransitionTest.authorize_fixture, GateTransitionTest.update_fixture_config
    rebind, write_config = RebaseProofTest.rebind, RebaseProofTest.write_config
    bind, conditional = ConditionalLandTest.bind, ConditionalLandTest.conditional
    STATEMENT = ConditionalLandTest.STATEMENT

    def curation(self, mode='replace', prepared=False):
        """One specialized-prepared curation commit (#7) on BASE, reviewed on the curation axis, with a remote manifest
        of it and its pinned remote-suite prep receipt."""
        from workflow_evidence import reference
        self.authorize_fixture(prepared=False)
        self.git(self.worker, 'reset', '-q', '--soft', self.base)
        self.git(self.worker, 'commit', '-qm', 'Curate fixtures (#7)')
        self.rebind()
        if prepared:
            self.operator.prepare_commit(self.v, dict(kind='curation', preparation=dict(mode='squash', archive=self.archive,
                                         message=dict(path=str(self.message), sha256=digest(self.message)))))
            self.authorize_fixture()
        config = json.loads(self.config.read_text())
        review = config['reviews'].pop('standards')
        config['reviews'].pop('spec')
        config.update(kind='curation', issue=7, reviews=dict(curation=review))
        self.rc = remote_fixtures()
        self.rc.install(self.worker)
        self.addCleanup(self.rc.writable, self.root)
        self.receipt = self.orch / 'logs/cur-7-prep.remote.receipt'
        self.write_receipt()
        config['preservedEvidence'] = [reference(self.receipt)]
        self.write_config(config)
        if mode:
            self.publish(mode)
        return json.loads(self.config.read_text())

    def publish(self, mode='replace', mutate=None):
        self.remote_runs = getattr(self, 'remote_runs', 0) + 1
        path, sha256 = self.rc.publish(self.orch, self.worker, self.base, 'fixture-20261106-120000-%06x' % self.remote_runs, mutate)
        config = json.loads(self.config.read_text())
        config['remoteChecks'] = dict(path=str(path), sha256=sha256, mode=mode)
        self.write_config(config)
        return config['remoteChecks']

    def receipt_text(self, extra=(), **changes):
        """cur-prep.sh --remote-suite's receipt for REVIEWED on BASE; CHANGES replace a field's value (None drops it),
        EXTRA appends raw lines."""
        fields = dict(issue='7', result='ok', branch='implementation', worktree=str(self.worker), commit=self.reviewed, tree=self.tree,
                      base=self.base, integrationBase=self.base, lockfile='1' * 40 + ' ' + '2' * 40, scripts='3' * 64,
                      env='CI=true VITEST_MAX_WORKERS=2 VITEST_MIN_WORKERS=- VITEST_POOL=- TZ=-', mode='full', config='4' * 64,
                      identity='fixture', log='-', toolchain='node v22.0.0 pnpm 10.29.1', tests='remote', checks='5' * 64,
                      testLog='-', testLogSha256='-', sharedStoreCount='2 (pf1 2)', finishedAt='2026-11-06T10:00:00Z')
        fields.update(changes)
        return ''.join('%s=%s\n' % item for item in fields.items() if item[1] is not None) + ''.join(line + '\n' for line in extra)

    def write_receipt(self, extra=(), **changes):
        self.receipt.write_text(self.receipt_text(extra, **changes))

    def repin(self):
        """Pin the receipt as it now stands, as a gate.json written after it would."""
        from workflow_evidence import reference
        config = json.loads(self.config.read_text())
        config['preservedEvidence'] = [item for item in config['preservedEvidence'] if item['path'] != str(self.receipt)] + [reference(self.receipt)]
        self.write_config(config)

    def refusal(self, pattern):
        with self.assertRaisesRegex(RuntimeError, pattern):
            self.core.authorization(self.v, full_validation=True)

    # -- pass
    def test_a_curation_gate_with_remote_checks_authorizes_on_its_pinned_remote_receipt(self):
        self.curation(mode=None)
        for mode in ('replace', 'compare'):
            with self.subTest(mode=mode):
                self.publish(mode)
                config = self.core.authorization(self.v, full_validation=True)
                self.assertEqual((config['kind'], config['remoteChecks']['mode']), ('curation', mode))
                self.assertEqual(self.core.curation_remote_scope(self.v, config),
                                 dict(receipt=str(self.receipt), issue=7, commit=self.reviewed, tree=self.tree, base=self.base))

    def test_a_curation_gate_without_remote_checks_needs_no_remote_receipt(self):
        config = self.curation(mode=None)
        config['preservedEvidence'] = []
        self.write_config(config)
        self.assertIsNone(self.core.curation_remote_scope(self.v, self.core.authorization(self.v, full_validation=True)))

    def test_a_code_gate_with_remote_checks_is_unchanged(self):
        self.authorize_fixture(prepared=False)
        self.rc = remote_fixtures()
        self.rc.install(self.worker)
        self.addCleanup(self.rc.writable, self.root)
        self.publish('replace')
        config = self.core.authorization(self.v, full_validation=True)
        self.assertIsNone(self.core.curation_remote_scope(self.v, config))

    # -- refusals, each named
    def test_no_pinned_or_present_remote_receipt_refuses(self):
        from workflow_evidence import reference
        config = self.curation()
        local = self.orch / 'logs/cur-7-prep.receipt'
        local.write_text(self.receipt_text(tests='local'))
        for name, pinned in (('nothing pinned', []), ('only the local receipt pinned', [reference(local)]),
                             ('the receipt pinned twice', [reference(self.receipt), reference(self.receipt)])):
            with self.subTest(name):
                config['preservedEvidence'] = pinned
                self.write_config(config)
                self.refusal('Curation remote checks need the remote-suite prep receipt pinned once in preservedEvidence: ' + str(self.receipt))
        config['preservedEvidence'] = [reference(self.receipt)]
        self.write_config(config)
        self.receipt.unlink()
        self.refusal('Curation remote-suite prep receipt missing: ' + str(self.receipt))

    def test_a_receipt_edited_after_gate_json_was_written_refuses(self):
        self.curation()
        self.write_receipt(finishedAt='2026-11-06T11:00:00Z')
        self.refusal('Evidence/input changed: ' + str(self.receipt))

    def test_a_receipt_for_another_commit_tree_base_or_issue_refuses(self):
        self.curation()
        sibling = self.git(self.worker, 'commit-tree', self.tree, '-p', self.base, '-m', 'Curate fixtures (#7, amended)')
        for field, value in (('commit', sibling), ('commit', self.base), ('tree', self.git(self.main, 'rev-parse', 'HEAD^{tree}')),
                             ('base', self.reviewed), ('integrationBase', self.reviewed), ('issue', '8')):
            with self.subTest(field=field, value=value):
                self.write_receipt(**{field: value})
                self.repin()
                self.refusal('Curation remote-suite prep receipt mismatch: ' + field + ' ')

    def test_a_malformed_failed_or_local_mode_receipt_refuses(self):
        self.curation()
        cases = [('a repeated key, same value', dict(extra=['commit=' + self.reviewed]), 'repeated key commit'),
                 ('a repeated key, another value', dict(extra=['tests=local']), 'repeated key tests'),
                 ('a line without a key', dict(extra=['stray text']), 'line 23 is not key=value'),
                 ('an empty key', dict(extra=['=value']), 'line 23 is not key=value'),
                 ('a missing field', dict(integrationBase=None), 'missing integrationBase'),
                 ('a failed prep', dict(result='failed'), 'result is not ok'),
                 ('a local-mode receipt', dict(tests='local'), 'tests is not remote'),
                 ('a named test log', dict(testLog='/x/cur-7-prep-vitest.log'), 'tests=remote names a test log'),
                 ('a named test log hash', dict(testLogSha256='6' * 64), 'tests=remote names a test log')]
        for name, change, reason in cases:
            with self.subTest(name):
                self.write_receipt(**change)
                self.repin()
                self.refusal('Malformed curation remote-suite prep receipt ' + str(self.receipt) + ': ' + reason)
        self.receipt.write_bytes(b'issue=7\n\xff\n')
        self.repin()
        self.refusal('Malformed curation remote-suite prep receipt ' + str(self.receipt) + ': not UTF-8 text')

    def test_a_manifest_of_an_amended_sibling_with_the_same_tree_refuses(self):
        self.curation(mode=None)
        sibling = self.git(self.worker, 'commit-tree', self.tree, '-p', self.base, '-m', 'Curate fixtures (#7, amended)')
        self.publish('replace', lambda m, d: self.rc.retrail(m['source'], **{'Gate-Reviewed': sibling}))
        self.refusal('Remote Gate-Reviewed is not the reviewed or prepared commit')
        # A curation candidate is REVIEWED itself: a mapping that names the sibling never widens what CI may bind.
        create_json(self.run / 'mapping.json', dict(SQUASHED=sibling))
        self.refusal('Remote Gate-Reviewed is not the reviewed or prepared commit')

    def test_curation_with_remote_checks_keeps_refusing_lane_rebase_proof_and_carried_review(self):
        config = self.curation()
        lane = dict(mode='light', rule=module('light_lane').RULE, paths=['value'])
        proof = dict(oldBase=self.base, accepted=self.reviewed, acceptedTree=self.tree)
        carry = dict(axis='standards', commit=self.reviewed, tree=self.tree, attestation=dict(path=str(self.receipt), sha256='0' * 64))
        for key, value, reason in (('lane', lane, 'Light lane is supported for code gates only'),
                                   ('rebaseProof', proof, 'Rebase proof is supported for code gates only'),
                                   ('carriedReview', carry, 'Carried review is supported for code gates only')):
            with self.subTest(key):
                self.write_config({**config, key: value})
                self.refusal(reason)

    # -- conditional LAND (gate-repairs) under remote checks
    def test_a_conditional_land_message_repair_authorizes_on_the_repaired_prep_commit(self):
        self.curation()
        stale = self.git(self.worker, 'commit-tree', self.tree, '-p', self.base, '-m', 'Curate fixtures (stale count)')
        self.bind(('curation',), commit=stale)
        land = self.core.authorization(self.v, full_validation=True)['conditionalLand']
        self.assertEqual((land['commit'], land['message']), (stale, True))
        # The receipt and the CI run bind the repaired head; ones of the reviewed E are stale (v1: re-prep and re-push).
        self.write_receipt(commit=stale)
        self.repin()
        self.refusal('Curation remote-suite prep receipt mismatch: commit ')
        self.write_receipt()
        self.repin()
        self.publish('replace', lambda m, d: self.rc.retrail(m['source'], **{'Gate-Reviewed': stale}))
        self.refusal('Remote Gate-Reviewed is not the reviewed or prepared commit')

    # -- submit: the prep reuse mode follows remoteChecks
    def reuse_stub(self):
        """A paths.sh and prep-lib.sh pair whose prep_reusable records its arguments and accepts only remote mode."""
        stub = self.root / 'reuse-stub'
        stub.mkdir()
        (stub / 'paths.sh').write_text('')
        (stub / 'prep-lib.sh').write_text('prep_reusable() { printf "%s\\n" "$*" >> "$here/reuse.log"; '
                                          '[ "${4:-}" = remote ] && echo "receipt: remote suite" || { echo "no prep receipt"; return 1; }; }\n')
        return stub

    def submit_with(self, here):
        """Submit, running the operator's prep-reuse check against HERE's paths.sh and prep-lib.sh."""
        import io
        real = subprocess.run

        def run(argv, *args, **kwargs):
            if isinstance(argv, list) and argv[:2] == ['bash', '-c'] and 'prep_reusable' in argv[2]:
                argv = [*argv[:4], str(here), *argv[5:]]
            return real(argv, *args, **kwargs)
        invocation_id = 'fixture-20261106-010203-abcdef'
        log = str(self.orch / 'logs' / ('bounded-' + invocation_id + '.log'))

        class ReturnedLaunch:
            stdout = io.StringIO('unit: ep-fresh-' + invocation_id + '; log: ' + log + '; id: ' + invocation_id + '\n')

            def wait(self):
                return 0
        launched = []
        with mock.patch.object(self.operator.subprocess, 'run', run):
            self.operator.submit(self.v, launch=lambda argv, **kwargs: launched.append(argv) or ReturnedLaunch())
        return launched

    def test_submit_reuses_the_remote_receipt_only_under_remote_checks(self):
        self.curation(prepared=True)
        stub = self.reuse_stub()
        launched = self.submit_with(stub)
        self.assertEqual((stub / 'reuse.log').read_text().splitlines(), ['7 %s %s remote' % (self.worker, self.base)])
        self.assertEqual(len(launched), 1)
        self.assertIn('LAND_REMOTE_CHECKS_MODE=replace', launched[0])
        self.assertTrue(launched[0][-1].startswith('cur/7@implementation:'))

    def test_a_local_curation_gate_never_reuses_a_remote_receipt(self):
        import shutil
        config = self.curation(mode=None, prepared=True)
        # Only the remote-suite receipt exists, as a remote-mode prep leaves it.
        self.assertFalse((self.orch / 'logs/cur-7-prep.receipt').exists())
        config['preservedEvidence'] = []
        self.write_config(config)
        stub = self.reuse_stub()
        real = self.root / 'real-prep-lib'
        real.mkdir()
        for name in ('paths.sh', 'prep-lib.sh'):
            shutil.copyfile(HERE / name, real / name)
        for here, why in ((stub, 'no prep receipt'), (real, 'no prep receipt')):
            with self.subTest(here=here.name):
                with self.assertRaisesRegex(RuntimeError, 'Curation needs fresh specialized prep/review: ' + why):
                    self.submit_with(here)
                self.assertFalse((self.run / 'submission-claim.json').exists())
        self.assertEqual((stub / 'reuse.log').read_text().splitlines(), ['7 %s %s' % (self.worker, self.base)])


class ObserverDeactivationTest(unittest.TestCase):
    """Collection after the r4 sequence (observer-deactivation-race): the landed unit deactivated with its
    counters gone, then systemd unloaded it. Synthetic rows; no live unit."""
    setUp, tearDown, git = GateTransitionTest.setUp, GateTransitionTest.tearDown, GateTransitionTest.git
    prepare_commit, authorize_fixture = GateTransitionTest.prepare_commit, GateTransitionTest.authorize_fixture
    update_fixture_config, record_owned_fixture = GateTransitionTest.update_fixture_config, GateTransitionTest.record_owned_fixture
    terminal_fixture, remote_config, remote_terminal, tooling_fixture = (GateTransitionTest.terminal_fixture, GateTransitionTest.remote_config,
                                                                         GateTransitionTest.remote_terminal, GateTransitionTest.tooling_fixture)
    host_audit = GateTransitionTest.host_audit

    def terminal_rows(self, **deactivating):
        """The fixture's counted row, then the unit deactivating without counters, then the unloaded unit."""
        progress = self.run / 'resource-progress.jsonl'
        counted = json.loads(progress.read_text().splitlines()[0])
        caps = dict(MemoryMax=str(15 * 1024**3), MemoryHigh='infinity', MemorySwapMax='0', CPUQuotaPerSecUSec='6s', TasksMax='1024',
                    CPUWeight='20', Nice='10', Restart='no', LimitCORE='0', TimeoutStopUSec='5min')
        counted['unit'] = {**counted['unit'], 'systemd': dict(ActiveState='active', Result='success', ExecMainStatus='0', MainPID='4242', **caps)}
        gone = dict(systemctlExit=0, error='', unavailable=['memory.events', 'memory.current', 'memory.stat'])
        systemd = {**caps, **dict(ActiveState='deactivating', Result='success', ExecMainStatus='0', MainPID='0'), **deactivating}
        rows = [counted, {**counted, 'unit': {**gone, 'systemd': {key: value for key, value in systemd.items() if value is not None}}},
                {**counted, 'unit': {**gone, 'systemd': dict(ActiveState='inactive', LoadState='not-found')}}]
        progress.write_text(''.join(json.dumps(row) + '\n' for row in rows))
        return rows

    def violations(self, row):
        invocation = self.operator.owned_invocation(self.v)
        monitor = module('gate_monitor')
        return monitor.violations(self.v, invocation, self.operator.mapping(self.v),
                                  json.loads((self.run / 'resource-baseline.json').read_text()), row, monitor.ArchiveLedger())

    def test_a_landed_gate_collects_and_completes_after_the_r4_sequence(self):
        self.remote_terminal(None)
        self.assertEqual([self.violations(row) for row in self.terminal_rows()], [[], [], []])
        result = self.operator.collect(self.v)
        self.assertTrue(result['passed'], result)
        self.assertTrue(result['checks']['resources'])
        self.assertTrue(self.operator.complete(self.v)['passed'])

    def test_counters_lost_while_the_main_process_runs_still_fail_collection(self):
        for name, props in (('active', dict(ActiveState='active')), ('main process', dict(MainPID='4242')),
                            ('r4 row without MainPID', dict(MainPID=None))):
            with self.subTest(name):
                self.remote_terminal(None) if not (self.run / 'resource-progress.jsonl').exists() else None
                (self.run / 'result.json').unlink(missing_ok=True)
                (self.run / 'cleanup.json').unlink(missing_ok=True)
                rows = self.terminal_rows(**props)
                self.assertEqual(self.violations(rows[1]), [dict(observerMissingCounters='unit')])
                result = self.operator.collect(self.v)
                self.assertEqual((result['passed'], result['checks']['resources']), (False, False))


class CollectionMemoryTest(unittest.TestCase):
    """Collection streams resource-progress.jsonl: every observer row carries every protected ref (about 1 MB
    on the real repository), so a long local suite's file runs to gigabytes (2.59 GB for the waves 1-2
    correction gate) and never fits the 2 GiB driver unit whole. Synthetic rows; no live unit."""
    setUp, tearDown, git = GateTransitionTest.setUp, GateTransitionTest.tearDown, GateTransitionTest.git
    prepare_commit, authorize_fixture = GateTransitionTest.prepare_commit, GateTransitionTest.authorize_fixture
    update_fixture_config, record_owned_fixture = GateTransitionTest.update_fixture_config, GateTransitionTest.record_owned_fixture
    terminal_fixture, remote_config, remote_terminal, tooling_fixture = (GateTransitionTest.terminal_fixture, GateTransitionTest.remote_config,
                                                                         GateTransitionTest.remote_terminal, GateTransitionTest.tooling_fixture)
    host_audit = GateTransitionTest.host_audit
    ROWS, PAD = 24, 1024 * 1024

    def large_row(self):
        """The terminal fixture's observer row grown to about 1 MB, like the real ones before 2026-11-07, whose bulk was
        T3 checkpoints: the extra refs are unprotected, so it passes."""
        self.remote_terminal(None)
        row = json.loads((self.run / 'resource-progress.jsonl').read_text().splitlines()[0])
        row['refs'] = {**row['refs'], **{'refs/t3/pad/%06d' % index: '0' * 40 for index in range(self.PAD // 64)}}
        return row

    def large_progress(self, row, last=None):
        """ROWS copies of the row; `last` replaces the final one."""
        progress = self.run / 'resource-progress.jsonl'
        with progress.open('w') as stream:
            for index in range(self.ROWS):
                stream.write(json.dumps(last if last is not None and index == self.ROWS - 1 else row) + '\n')
        self.assertGreater(progress.stat().st_size, self.ROWS * self.PAD)

    def collect_peak(self):
        import tracemalloc
        tracemalloc.start()
        try:
            result = self.operator.collect(self.v)
            return result, tracemalloc.get_traced_memory()[1]
        finally:
            tracemalloc.stop()

    def test_collection_holds_one_observer_row_at_a_time(self):
        self.large_progress(self.large_row())
        result, peak = self.collect_peak()
        self.assertTrue(result['passed'], result)
        self.assertTrue(result['checks']['resources'])
        self.assertTrue(result['checks']['observedCleanup'])
        self.assertLess(peak, 8 * self.PAD, 'peak %.1f MiB: collection held the whole %d-row file' % (peak / 2**20, self.ROWS))

    def test_a_violation_in_a_late_row_still_fails_and_a_malformed_row_is_reported(self):
        row = self.large_row()
        protected = next(iter(json.loads((self.run / 'protected-refs.json').read_text())))
        self.large_progress(row, last={**row, 'refs': {**row['refs'], protected: '1' * 40}})
        result = self.operator.collect(self.v)
        self.assertEqual((result['passed'], result['checks']['resources']), (False, False))
        (self.run / 'result.json').unlink()
        (self.run / 'cleanup.json').unlink()
        with (self.run / 'resource-progress.jsonl').open('a') as stream:
            stream.write('{"truncated": \n')
        result = self.operator.collect(self.v)
        self.assertEqual((result['checks']['resources'], result['checks']['observedCleanup']), (False, True))
        self.assertEqual([error['check'] for error in result['errors'] if error['check'] == 'resourceObservations'], ['resourceObservations'])


def whole_file_scan(operator, v, invocation, target):
    """Test-only reference: collection's resource scan before streaming (175a3f5b), the whole file read and every
    row parsed and kept, in scan_resources' shape: the `resources` check and the rows guard_cleanup reads."""
    from gate_monitor import ArchiveLedger, violations
    rows = [operator.load_line(line) for line in (target / 'resource-progress.jsonl').read_text().splitlines()]
    ledger = ArchiveLedger()  # one ledger over the rows in order, as the monitor judges them (fix r1)
    return (lambda: all(not violations(v, invocation, operator.mapping(v), operator.load(target / 'resource-baseline.json'), row, ledger)
                        for row in rows if row.get('invocationId')) and any('memory.events' in row.get('unit', {}) for row in rows)), rows


class CollectionEquivalenceTest(unittest.TestCase):
    """The streamed scan returns what the whole-file read did: the same checks, errors and cleanup record over
    normal rows, every input that changes a verdict and every unreadable shape (fix r1, Spec #4). The observer
    writes json.dumps rows, one per line, so the readers agree on line boundaries."""
    setUp, tearDown, git = GateTransitionTest.setUp, GateTransitionTest.tearDown, GateTransitionTest.git
    prepare_commit, authorize_fixture = GateTransitionTest.prepare_commit, GateTransitionTest.authorize_fixture
    update_fixture_config, record_owned_fixture = GateTransitionTest.update_fixture_config, GateTransitionTest.record_owned_fixture
    terminal_fixture, remote_config, remote_terminal, tooling_fixture = (GateTransitionTest.terminal_fixture, GateTransitionTest.remote_config,
                                                                         GateTransitionTest.remote_terminal, GateTransitionTest.tooling_fixture)
    host_audit = GateTransitionTest.host_audit

    def cases(self, row):
        protected = next(iter(json.loads((self.run / 'protected-refs.json').read_text())))
        moved = {**row, 'refs': {**row['refs'], protected: '1' * 40}}
        uncounted = {**row, 'unit': {key: value for key, value in row['unit'].items() if key != 'memory.events'}}
        foreign = {key: value for key, value in row.items() if key != 'invocationId'}
        scratch = self.root / 'left-scratch'
        scratch.mkdir()
        left = {**row, 'guard': {**row['guard'], 'ownedScratch': [str(scratch), str(self.root / 'gone-scratch')]}}
        unguarded = {key: value for key, value in row.items() if key != 'guard'}
        archive = 'refs/archive/fixture/added-during-the-gate'
        added = lambda value: {**row, 'refs': {**row['refs'], archive: value}} if value else row
        reading = row['maintenance']
        worker = {**reading['worktrees'][1], 'maintenance.auto': dict(exitCode=0, value='true')}  # a worker worktree's override
        maintained = {**row, 'maintenance': {**reading, 'worktrees': [reading['worktrees'][0], worker]}}
        line = lambda value: json.dumps(value) + '\n'
        return {'normal rows': line(row) * 3, 'a protected ref moved in a later row': line(row) + line(moved) + line(row),
                'an archive added during the gate and kept': line(row) + line(added('2' * 40)) * 2,
                'an archive added during the gate, then rewritten': line(row) + line(added('2' * 40)) + line(added('3' * 40)),
                'an archive added during the gate, then deleted': line(row) + line(added('2' * 40)) + line(added(None)),
                'automatic maintenance turned on in a later row': line(row) + line(maintained),
                'no row counted memory events': line(uncounted) * 2, 'only rows of another invocation': line(foreign) * 2,
                'a counted row of another invocation beside an uncounted own row': line(foreign) + line(uncounted),
                'scratch left behind': line(row) + line(left), 'a row without its guard record': line(unguarded) + line(row),
                'a malformed row': line(row) + '{"broken": [1, 2\n' + line(row), 'an empty file': '',
                'a blank line': line(row) + '\n' + line(row), 'a truncated last line': line(row) + '{"truncated": ',
                'a last line without its newline': line(row) + json.dumps(row), 'a row that is not an object': line(row) + '[1, 2]\n',
                'no file': None, 'no resource baseline (a judging error)': line(row) * 2}

    def collected(self, scan):
        for name in ('result.json', 'cleanup.json'):
            (self.run / name).unlink(missing_ok=True)
        original = self.operator.scan_resources
        self.operator.scan_resources = scan
        try:
            result = self.operator.collect(self.v)
        finally:
            self.operator.scan_resources = original
        cleanup = self.run / 'cleanup.json'
        return dict(checks=result['checks'], errors=result['errors'], passed=result['passed'],
                    cleanup=json.loads(cleanup.read_text()) if cleanup.is_file() else None)

    def test_the_streamed_scan_matches_the_whole_file_read(self):
        self.remote_terminal(None)
        progress, baseline = self.run / 'resource-progress.jsonl', self.run / 'resource-baseline.json'
        row = json.loads(progress.read_text().splitlines()[0])
        saved = baseline.read_bytes()
        verdicts = {}
        for name, text in self.cases(row).items():
            with self.subTest(name):
                progress.unlink(missing_ok=True)
                if text is not None:
                    progress.write_text(text)
                baseline.write_bytes(saved)
                if name.startswith('no resource baseline'):
                    baseline.unlink()
                reference = self.collected(lambda v, invocation, target: whole_file_scan(self.operator, v, invocation, target))
                streamed = self.collected(self.operator.scan_resources)
                self.assertEqual(streamed, reference)
                verdicts[name] = (reference['checks']['resources'], reference['checks']['observedCleanup'],
                                  sorted({error['check'] for error in reference['errors']} & {'resources', 'resourceObservations'}))
        # The corpus reaches every outcome: passing, each failing check, and both error kinds.
        self.assertEqual(verdicts['normal rows'], (True, True, []))
        self.assertEqual(verdicts['a protected ref moved in a later row'], (False, True, []))
        self.assertEqual(verdicts['an archive added during the gate and kept'], (True, True, []))
        self.assertEqual(verdicts['an archive added during the gate, then rewritten'], (False, True, []))
        self.assertEqual(verdicts['an archive added during the gate, then deleted'], (False, True, []))
        self.assertEqual(verdicts['automatic maintenance turned on in a later row'], (False, True, []))
        self.assertEqual(verdicts['no row counted memory events'], (False, True, []))
        self.assertEqual(verdicts['scratch left behind'], (True, False, []))
        self.assertEqual(verdicts['a malformed row'], (False, True, ['resourceObservations']))
        self.assertEqual(verdicts['a truncated last line'], (False, True, ['resourceObservations']))
        self.assertEqual(verdicts['an empty file'], (False, True, []))
        self.assertEqual(verdicts['no resource baseline (a judging error)'], (False, True, ['resources']))


def light_fixtures():
    spec = importlib.util.spec_from_file_location('light_lane_fixtures', HERE / 'light-lane.test.py')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


LIGHT_SCOPE = ("Authorized light landing lane (every changed path is outside the full queue's pinned inputs under rule light-lane-v1, "
               'bounded risk, owner 2026-11-01; codegen, pin, typecheck, lint, the full suite and the e2e preflight not run) '
               'and checked completion only; no Cloud/GitHub/promotion qualification')


class LightLaneTest(unittest.TestCase):
    """The optional gate field lane (light-lane-v1, owner decision 2026-11-01). Synthetic Git fixtures:
    a base with the pinned readers and a candidate that changes one orchestration doc."""
    git, prepare_commit, authorize_fixture = GateTransitionTest.git, GateTransitionTest.prepare_commit, GateTransitionTest.authorize_fixture
    update_fixture_config, record_owned_fixture = GateTransitionTest.update_fixture_config, GateTransitionTest.record_owned_fixture
    terminal_fixture, submitted_argv, todays_argv = GateTransitionTest.terminal_fixture, GateTransitionTest.submitted_argv, GateTransitionTest.todays_argv
    tearDown, commit, rebind, write_config = GateTransitionTest.tearDown, RebaseProofTest.commit, RebaseProofTest.rebind, RebaseProofTest.write_config
    PATH = 'docs/agents/lane-fixture.md'

    def setUp(self):
        GateTransitionTest.setUp(self)
        light_fixtures().install(self.main)
        # The pinned workspace.ts imports it; the frozen runtime resolves every local import.
        (self.main / 'e2e/support/diagnostics.ts').write_text('export class HarnessFailure extends Error {}\n')
        # The pinned triage-failures.sh sources these; the freeze loads every sourced helper.
        for helper in ('paths.sh', 'triage-lib.sh'):
            (self.main / 'scripts/orchestration' / helper).write_text('# fixture helper\n')
        # The pinned codegen entry imports it; the freeze resolves every local import.
        (self.main / 'scripts/local-convex/generate.ts').write_text('export {};\n')
        # The pinned vitest.config.ts imports its shard sequencer (speed-ci-shards fix r1).
        (self.main / 'tests/shard-plan.ts').write_text('export class WeightedSequencer {}\n')
        self.git(self.main, 'add', '-A')
        self.git(self.main, 'commit', '-qm', 'pinned readers')
        self.git(self.worker, 'reset', '-q', '--hard', 'feature')
        (self.worker / self.PATH).parent.mkdir(parents=True)
        self.commit(self.worker, {self.PATH: '# Lane fixture\n'}, 'author step')
        self.commit(self.worker, {self.PATH: '# Lane fixture\n\nReviewed.\n'}, 'author step')

    def lane(self, **change):
        config = json.loads(self.config.read_text())
        config['lane'] = {**dict(mode='light', rule='light-lane-v1', paths=[self.PATH]), **change}
        self.write_config(config)
        return config

    def test_claim_argv_with_a_lane_adds_exactly_the_two_bindings(self):
        self.rebind(prepared=True)
        self.lane()
        self.assertTrue(self.core.authorization(self.v, full_validation=True))
        expected = self.todays_argv()
        expected[-2:-2] = ['LAND_LANE=light', 'LAND_LIGHT_EVIDENCE=' + str(self.run) + '/light-evidence']
        self.assertEqual(self.submitted_argv()['argv'], expected)

    def test_each_lane_refusal_comes_before_the_attempt_directory(self):
        self.rebind()
        self.run.rmdir()
        original = self.config.read_text()
        cases = [('shape', 'Invalid lane: exactly mode "light", rule and paths', lambda c: c['lane'].pop('paths')),
                 ('mode', 'Invalid lane', lambda c: c['lane'].update(mode='heavy')),
                 ('extra key', 'Invalid lane', lambda c: c['lane'].update(commit=self.reviewed)),
                 ('paths type', 'Invalid lane', lambda c: c['lane'].update(paths=self.PATH)),
                 ('rule', 'Light lane rule mismatch: light-lane-v0', lambda c: c['lane'].update(rule='light-lane-v0')),
                 ('curation', 'Light lane is supported for code gates only', lambda c: c.update(kind='curation')),
                 ('remote checks', 'Light lane does not combine with remote checks',
                  lambda c: c.update(remoteChecks=dict(path=str(self.orch / 'manifest.json'), sha256='0' * 64, mode='replace'))),
                 ('path list', 'Light lane path list mismatch', lambda c: c['lane'].update(paths=[self.PATH, self.PATH]))]
        for name, message, mutate in cases:
            with self.subTest(name):
                self.config.write_text(original)
                config = self.lane()
                mutate(config)
                self.write_config(config)
                with self.assertRaisesRegex(RuntimeError, '^' + message.replace('(', r'\(')):
                    self.core.authorization(self.v)
                with self.assertRaisesRegex(RuntimeError, '^' + message.replace('(', r'\(')):
                    self.operator.prepare(self.v)
                self.assertFalse(self.run.exists())
        self.commit(self.worker, {'value': 'code\n'}, 'a code path')
        self.rebind()
        self.lane(paths=[self.PATH, 'value'])
        for operation in (self.core.authorization, self.operator.prepare):
            with self.assertRaisesRegex(RuntimeError, '^Light lane refused: value is outside light-lane-v1$'):
                operation(self.v)
        self.assertFalse(self.run.exists())

    def light_terminal(self, record=True, proof=False):
        """A landed light candidate on the frozen runtime, optionally carried by a rebase proof;
        with record, the queue's light verification of the squashed candidate."""
        if proof:
            self.old_base, self.accepted = self.git(self.main, 'rev-parse', 'HEAD'), self.git(self.worker, 'rev-parse', 'HEAD')
            self.accepted_tree = self.git(self.worker, 'rev-parse', 'HEAD^{tree}')
            self.commit(self.main, {'upstream': 'base movement\n'}, 'unrelated upstream change')
            self.git(self.worker, 'rebase', '-q', 'feature')
        self.rebind(prepared=True)
        prepared = json.loads((self.run / 'mapping.json').read_text())
        frozen = Path(self.v['SNAP'])
        (frozen / 'queue.log').unlink();frozen.rmdir()
        (self.run / 'snapshot.json').unlink()
        installed = self.worker / 'node_modules/.pnpm/lock.yaml'
        installed.parent.mkdir(parents=True);installed.write_text('installed fixture\n')
        for name in ('bounded.sh', 'capped.sh', 'bounded-resources.sh', 'bounded-receipt.sh', 'slice-sampler.sh'):
            (self.orch / name).write_text('# fixture wrapper\n')
        config = self.lane()
        self.operator.freeze(self.v)
        self.assertIn('light_lane.py', json.loads((self.run / 'snapshot.json').read_text())['operatorRuntime'])
        from workflow_evidence import reference
        prior = json.loads((self.run / 'prepared.json').read_text())
        prior['bindings'] = [reference(self.run / name) for name in ('mapping.json', 'snapshot.json')]
        (self.run / 'prepared.json').write_text(json.dumps(prior))
        refs = dict(line.split(' ', 1)[::-1] for line in self.git(self.main, 'for-each-ref', '--format=%(objectname) %(refname)').splitlines())
        create_json(self.run / 'protected-refs.json', refs)
        if proof:
            config['rebaseProof'] = dict(oldBase=self.old_base, accepted=self.accepted, acceptedTree=self.accepted_tree)
            config['reviews']['standards'].update(commit=self.accepted, tree=self.accepted_tree)
            self.write_config(config)
        self.git(self.main, 'merge', '--ff-only', prepared['SQUASHED'])
        integrity = module('gate_monitor').run_integrity_checks(self.core.env())
        self.assertTrue(integrity['passed'], integrity)
        self.terminal_fixture(prepared, integrity)
        import shutil
        shutil.rmtree(self.run / 'triage-evidence')
        if record:
            subprocess.run([sys.executable, '-B', str(HERE / 'light_lane.py'), 'verify', str(self.worker), self.base, prepared['SQUASHED'],
                            str(self.run / 'light-evidence')], check=True, capture_output=True)
        return prepared

    def test_without_a_lane_the_frozen_operator_runtime_is_todays(self):
        self.base = self.git(self.main, 'rev-parse', 'HEAD')
        self.v.update(BASE=self.base)
        GateTransitionTest.tooling_fixture(self)
        self.assertEqual(set(json.loads((self.run / 'snapshot.json').read_text())['operatorRuntime']),
                         {'gate-operator.py', 'gate_operator.py', 'gate_core.py', 'gate_monitor.py', 'validation.py',
                          'workflow_evidence.py', 'remote_checks.py'})

    def test_collect_with_a_lane_checks_the_light_record_instead_of_the_suite(self):
        self.light_terminal()
        result = self.operator.collect(self.v)
        self.assertTrue(result['passed'], result)
        self.assertTrue(result['checks']['lightLane'])
        self.assertNotIn('originalSuite', result['checks'])
        self.assertEqual(result['suite'], dict(source='none', lane='light', rule='light-lane-v1'))
        self.assertIn(str(self.run / 'light-evidence/light-verification.json'), {item['path'] for item in result['evidence']})
        self.assertTrue(self.operator.complete(self.v)['passed'])
        self.assertEqual(json.loads((self.run / 'completion.json').read_text())['scope'], LIGHT_SCOPE)

    def test_collect_fails_without_or_with_a_mismatched_light_record(self):
        import shutil
        prepared = self.light_terminal(record=False)
        record = self.run / 'light-evidence/light-verification.json'
        good = None
        cases = [('missing', None, 'No such file'),
                 ('candidate', dict(commit=self.reviewed), 'does not bind this candidate'),
                 ('failed', dict(passed=False), 'does not bind this candidate'),
                 ('rule', dict(rule='light-lane-v0'), 'does not bind this candidate'),
                 ('paths', dict(paths=[]), 'Light verification path list mismatch')]
        for name, change, error in cases:
            with self.subTest(name):
                (self.run / 'result.json').unlink(missing_ok=True)
                shutil.rmtree(self.run / 'light-evidence', ignore_errors=True)
                if change is not None:
                    if good is None:
                        subprocess.run([sys.executable, '-B', str(HERE / 'light_lane.py'), 'verify', str(self.worker), self.base,
                                        prepared['SQUASHED'], str(self.run / 'light-evidence')], check=True, capture_output=True)
                        good = json.loads(record.read_text())
                        shutil.rmtree(self.run / 'light-evidence')
                    (self.run / 'light-evidence').mkdir()
                    create_json(record, {**good, **change})
                result = self.operator.collect(self.v)
                self.assertFalse(result['passed'])
                self.assertFalse(result['checks']['lightLane'])
                self.assertNotIn('originalSuite', result['checks'])
                self.assertEqual(result['suite'], dict(source='none', lane='light', rule='light-lane-v1'))
                self.assertIn(error, json.dumps(result['errors']))
        with self.assertRaisesRegex(RuntimeError, 'Failed result'):
            self.operator.complete(self.v)

    def test_completion_scope_composes_the_lane_with_the_rebase_proof(self):
        self.light_terminal(proof=True)
        self.assertTrue(self.operator.collect(self.v)['passed'])
        self.assertTrue(self.operator.complete(self.v)['passed'])
        self.assertEqual(json.loads((self.run / 'completion.json').read_text())['scope'], LIGHT_SCOPE + '; reviews accepted at ' +
                         self.accepted + ' on ' + self.old_base + ' carried by the mechanical-rebase proof')


MISSING = "import('./missing')"
CODE_IMPORT = 'export {};\n' + MISSING + ';\n'  # The import is at UTF-16 [11, 30]; the text is 32 long.
# Malformed comment ranges for one file, each built around a well-formed lie [start, length] that
# would cover a code import ending the file. Any fault untrusts that file, so the import is refused.
RANGE_FAULTS = {
    'float bounds': lambda start, length: [[float(start), float(length)]],
    'fractional bounds': lambda start, length: [[start - 0.5, length + 0.5]],
    'string bounds': lambda start, length: [[str(start), str(length)]],
    'boolean start': lambda start, length: [[False, length]],
    'negative start': lambda start, length: [[-1, length]],
    'end beyond the text': lambda start, length: [[start, length + 1]],
    'start equal to end': lambda start, length: [[start, length], [length, length]],
    'start after end': lambda start, length: [[1, 0], [start, length]],
    'overlapping': lambda start, length: [[start, length - 1], [start + 1, length]],
    'duplicate range': lambda start, length: [[start, length], [start, length]],
    'unsorted': lambda start, length: [[start, length], [0, start]],
    'three bounds': lambda start, length: [[start, length, length]],
    'a flat pair': lambda start, length: [start, length],
}


def _duplicated(payload, victim):
    text = json.dumps(payload)
    return text[:-1] + ', ' + json.dumps(victim) + ': ' + json.dumps(payload[victim]) + '}'


# Malformed payloads, as helper stdout, from a well-formed `payload` and one `victim` path in it.
# Any fault untrusts every file, so even the files whose own ranges are well formed refuse.
PAYLOAD_FAULTS = {
    'missing path': lambda payload, victim: json.dumps({name: spans for name, spans in payload.items() if name != victim}),
    'extra path': lambda payload, victim: json.dumps({**payload, 'scripts/ghost.ts': []}),
    'duplicate path': _duplicated,
    'string value': lambda payload, victim: json.dumps({**payload, victim: '01'}),
    'object value': lambda payload, victim: json.dumps({**payload, victim: {'01': None}}),
    'number value': lambda payload, victim: json.dumps({**payload, victim: 1}),
    'not an object': lambda payload, victim: json.dumps(list(payload.values())),
}
# The comment that stopped retro W2's gate r1 (candidate scripts/affected-tests/scan.ts:125).
W2_COMMENT = "  // `vi.mock(import('./x'))`: the inner import is its own call.\n"


def old_bound_files(root):
    """The scanner before gate-import-scan, binding only: every resolving match, refusals skipped."""
    import re
    tracked = set(subprocess.run(['git', '-C', str(root), 'ls-files'], check=True, capture_output=True, text=True).stdout.splitlines())
    roots = {name for name in tracked if (name.startswith(('scripts/', 'e2e/')) or
             '/' not in name and Path(name).suffix in ('.json', '.js', '.mjs', '.ts', '.yaml', '.yml'))
             and not any(part == '.private' or part.startswith('.env') for part in Path(name).parts)}
    pending, seen, refused = list(roots), set(), []
    while pending:
        name = pending.pop()
        if name in seen:
            continue
        seen.add(name)
        source = Path(root) / name
        if source.suffix not in ('.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'):
            continue
        for imported in re.findall(r"(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s*)['\"]([^'\"]+)['\"]", source.read_text()):
            if imported.startswith('.'):
                target = os.path.normpath(str(Path(name).parent / imported))
            elif imported.startswith('~/'):
                target = 'src/' + imported[2:]
            else:
                continue
            variants = [target] + [target + suffix for suffix in ('.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '.json')]
            variants += [target + '/index' + suffix for suffix in ('.ts', '.tsx', '.js')]
            if target.endswith('.js'):
                variants += [target[:-3] + suffix for suffix in ('.ts', '.tsx', '.d.ts')]
            found = set(variants) & tracked
            if not found:
                refused.append(name + ' -> ' + imported)
            pending.extend(found)
    return seen, refused


class ImportScanTest(unittest.TestCase):
    """The freeze's local-import scan: every resolving match binds; only an unresolved one in code refuses."""

    def setUp(self):
        self.operator = module('gate-operator')
        self.root = Path(tempfile.mkdtemp(prefix='import-scan-', dir=os.environ.get('TMPDIR')))
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        self.addCleanup(lambda: __import__('shutil').rmtree(self.root))
        # The scanned tree's own committed helper and installed typescript, as in a gate worktree.
        helper = self.root / 'scripts/orchestration/comment-ranges.mjs'
        helper.parent.mkdir(parents=True)
        helper.write_bytes((HERE / 'comment-ranges.mjs').read_bytes())
        (self.root / 'node_modules').symlink_to(HERE.parent.parent / 'node_modules')
        (self.root / '.git/info/exclude').write_text('node_modules\n')

    def scan(self, source, name='scripts/entry.ts', extra=None):
        for path, text in {name: source, **(extra or {})}.items():
            (self.root / path).parent.mkdir(parents=True, exist_ok=True)
            (self.root / path).write_text(text)
        subprocess.run(['git', '-C', str(self.root), 'add', '-A'], check=True)
        return self.operator.local_runtime_files(str(self.root))

    def assert_ignored(self, source, **options):
        self.assertIn(options.get('name', 'scripts/entry.ts'), self.scan(source, **options))

    def assert_refused(self, source, **options):
        with self.assertRaisesRegex(RuntimeError, r"Unresolved local import: (.*; )?scripts/entry\.[a-z]+ -> \./missing(;|$)"):
            self.scan(source, **options)

    def assert_batch(self, cases, refused, suffix='.ts'):
        """Every case, each its own file, through one run of the real helper (`code_imports`), with the
        unresolved matches the scan would collect: refused, its `./missing` import is still code; otherwise
        none of its imports is."""
        files = {'scripts/case-%d%s' % (index, suffix): (label, source)
                 for index, (label, source) in enumerate(cases.items())}
        unresolved = [(name, source, match) for name, (_, source) in files.items()
                      for match in self.operator.LOCAL_IMPORT.finditer(source) if match.group(1).startswith(('.', '~/'))]
        code = {(name, match.group(1)) for name, _, match in self.operator.code_imports(str(self.root), unresolved)}
        for name, (label, _) in files.items():
            with self.subTest(label):
                if refused:
                    self.assertIn((name, './missing'), code)
                else:
                    self.assertEqual({item for item in code if item[0] == name}, set())

    def test_an_unresolved_import_in_a_comment_is_ignored(self):
        cases = {
            'line comment': 'export {};\n// see ' + MISSING + '\n',
            'trailing line comment': 'export const half = total / 2; // ' + MISSING + '\n',
            'block comment': 'export {};\n/* ' + MISSING + ' */\n',
            'multi-line block comment': '/**\n * Loads it like `' + MISSING + '`.\n */\nexport {};\n',
            'after a regex literal': "if (ok) /x\\//.test(s); // " + MISSING + '\n',
            'after a string holding a quote': "const s = 'it\\'s'; // " + MISSING + '\n',
            'after a template with nesting': 'const t = `a${ {b: `c${1}`}.b }d`; // ' + MISSING + '\n',
            'after a keyword before a regex': 'function f(s) { return /\'/.test(s); } // ' + MISSING + '\n',
            'second comment of a run': 'export {};\n// first\n// ' + MISSING + '\n',
            'second comment on one line': 'export {}; /* first */ // ' + MISSING + '\n',
            'after a shebang': '#!/usr/bin/env node\n// ' + MISSING + '\n',
            'end of file without a newline': 'export {};\n// ' + MISSING,
            'W2 comment': 'export function f() {\n' + W2_COMMENT.replace("'./x'", "'./missing'") + '}\n',
        }
        self.assert_batch(cases, refused=False)

    def test_the_w2_comment_itself_no_longer_refuses(self):
        # It still binds what a resolving import in a comment names, and the helper as a runtime file.
        bound = self.scan('export function loadedModule() {\n' + W2_COMMENT + '  return undefined;\n}\n' +
                          "// import('../../lib/x')\n", name='scripts/affected-tests/scan.ts',
                          extra={'lib/x.ts': 'export {};\n'})
        self.assertLessEqual({'scripts/affected-tests/scan.ts', 'lib/x.ts', 'scripts/orchestration/comment-ranges.mjs'},
                             bound)

    def test_the_same_text_in_code_is_still_refused(self):
        cases = {
            'code': 'export {};\n' + MISSING + ';\n',
            'static import': "import { a } from './missing';\n",
            'a string after real code': 'const a = 1; const s = "see ' + MISSING + '";\n',
            'a template after real code': 'const a = 1; const s = `see ' + MISSING + '`;\n',
            'after // inside a string': "const url = 'http://host'; " + MISSING + ';\n',
            'after // inside a template': 'const url = `http://${host}//`; ' + MISSING + ';\n',
            'after // inside a regex literal': 'const re = /[//]/; ' + MISSING + ';\n',
            'after an escaped // inside a regex literal': 'const re = /https:\\/\\//; ' + MISSING + ';\n',
            'after /* inside a string': "const glob = 'src/*'; " + MISSING + ";\n",
            'after a comment closes': '/* note */ ' + MISSING + ';\n',
            'next line after a line comment': '// note\n' + MISSING + ';\n',
            'inside a template expression': 'const t = `${' + MISSING + '}`;\n',
            'division after an object literal': 'x = {} / 2 + "a/b // ' + MISSING + '";\n',
            'syntax error: unterminated block comment': 'export {};\n/* ' + MISSING + '\n',
        }
        self.assert_batch(cases, refused=True)
        # The same refusal end to end: Git, the scan and the helper.
        self.assert_refused(cases['static import'])

    def test_the_review_reproductions_are_refused(self):
        # Review r1: Unicode line terminators, TypeScript generic closers, division read as a regex,
        # and statement-position regexes (after `for await (…)`, `debugger`, a block, `else`).
        cases = {
            'U+2028 ends a line comment': '// note ' + MISSING + ';\n',
            'U+2029 ends a line comment': '// note ' + MISSING + ';\n',
            'U+2028 after a shebang line comment': '#!/usr/bin/env node\n// note ' + MISSING + ';\n',
            'generic closer then division': 'type N<T> = number; const n = 1 as N<unknown> / 2 + "a/b //"; ' + MISSING + ';\n',
            'instantiation expression then division': 'const x = foo<T> / 2 + "a/b // ' + MISSING + '";\n',
            'division after a trailing decimal point': 'const n = 1. / 2 + "a/b //"; ' + MISSING + ';\n',
            'regex after for await (…)': ('async function f(xs) {\n  for await (const x of xs) /[//]/.test(x); ' + MISSING +
                                         '; const a = [\n  ];\n}\n'),
            'regex after debugger': 'function f(x) {\n  debugger\n  /[//]/.test(x); ' + MISSING + '; const a = [\n  ];\n}\n',
            'regex after a block': 'if (x) {}\n/[//]/.test(s); ' + MISSING + '; const a = [\n];\n',
            'regex after else': 'if (x) f(); else /[//]/.test(s); ' + MISSING + '; const a = [\n];\n',
        }
        self.assert_batch(cases, refused=True)

    def test_jsx_text_is_code_and_jsx_comments_are_comments(self):
        # The extension picks the script kind, so each case keeps its own.
        self.assert_batch({'.tsx text': 'export const A = () => <p>// ' + MISSING + '</p>;\n'}, refused=True, suffix='.tsx')
        self.assert_batch({'.jsx expression': 'export const A = () => <a href="//x">{' + MISSING + '}</a>;\n'},
                          refused=True, suffix='.jsx')
        self.assert_batch({'.js comments': 'export const A = () => <p>{/* ' + MISSING + ' */}x</p>;\n// ' + MISSING + '\n'},
                          refused=False, suffix='.js')

    def test_without_trusted_comment_ranges_every_match_is_code(self):
        comment = 'export {};\n// ' + MISSING + '\n'
        helper = self.root / 'scripts/orchestration/comment-ranges.mjs'
        working = helper.read_bytes()
        cases = {
            'helper fails': lambda: helper.write_text('process.exit(1);\n'),
            'helper prints malformed ranges': lambda: helper.write_text('console.log(JSON.stringify({"scripts/entry.ts": [["a"]]}));\n'),
            'helper omits the file': lambda: helper.write_text('console.log("{}");\n'),
            'helper missing': helper.unlink,
            'typescript missing': (self.root / 'node_modules').unlink,
        }
        for label, breaks in cases.items():
            with self.subTest(label):
                helper.write_bytes(working)
                breaks()
                self.assert_refused(comment)
        with self.subTest('node missing'), mock.patch.object(self.operator, 'execution_tools',
                                                             side_effect=RuntimeError('Missing runtime tool: node')):
            self.assert_refused(comment)

    def test_malformed_comment_ranges_are_untrusted(self):
        # The helper's lie [11, 32] covers the code import in entry.ts; each fault must untrust it.
        entry, other = 'scripts/entry.ts', 'scripts/other.ts'
        files = {other: '// ' + MISSING + '\n'}
        sources = {entry: CODE_IMPORT, **files}
        valid = {entry: [[11, 32]], other: [[0, 22]]}

        def trusted(output):
            # `code_imports` trusts no file when reading the output raises, as on a repeated key.
            try:
                return self.operator.trusted_ranges(sources, output)
            except ValueError:
                return {}
        with self.subTest('control: well-formed ranges are trusted'):
            self.assertEqual(trusted(json.dumps(valid)), {entry: [(11, 32)], other: [(0, 22)]})
        for label, fault in RANGE_FAULTS.items():
            with self.subTest(label):
                self.assertEqual(trusted(json.dumps({**valid, entry: fault(11, 32)})), {other: [(0, 22)]})
        for label, fault in PAYLOAD_FAULTS.items():
            with self.subTest(label):
                self.assertEqual(trusted(fault(valid, other)), {})
        # End to end through the scan, with a helper that prints the output: the lie is trusted when well
        # formed, and a malformed range or payload leaves the import refused.
        helper = self.root / 'scripts/orchestration/comment-ranges.mjs'

        def prints(output):
            helper.write_text('process.stdout.write(' + json.dumps(output) + ');\n')
        prints(json.dumps(valid))
        self.assert_ignored(CODE_IMPORT, extra=files)
        prints(json.dumps({**valid, entry: RANGE_FAULTS['end beyond the text'](11, 32)}))
        self.assert_refused(CODE_IMPORT, extra=files)
        prints(PAYLOAD_FAULTS['duplicate path'](valid, other))
        self.assert_refused(CODE_IMPORT, extra=files)

    def test_one_helper_run_serves_every_file(self):
        files = {'scripts/a.ts': '// ' + MISSING + '\n', 'scripts/b.ts': '/* ' + MISSING + ' */\n'}
        with mock.patch.object(self.operator.subprocess, 'run', wraps=subprocess.run) as run:
            self.scan('// ' + MISSING + '\n', extra=files)
        self.assertEqual(len([call for call in run.call_args_list if call.args[0][0] == 'node']), 1)

    def test_a_resolving_import_inside_a_comment_is_still_bound(self):
        # Targets outside the root families bind only by following imports, including through a comment.
        bound = self.scan("export {};\n// import('../lib/helper')\n/* require('../lib/other.js') */\n",
                          extra={'lib/helper.ts': "export {};\n// see import('./deeper')\n",
                                 'lib/other.ts': 'export {};\n', 'lib/deeper.ts': 'export {};\n'})
        self.assertLessEqual({'scripts/entry.ts', 'lib/helper.ts', 'lib/other.ts', 'lib/deeper.ts'}, bound)

    def test_corpus_bound_set_equals_the_old_scanner(self):
        repository = HERE.parent.parent
        old, refused = old_bound_files(repository)
        new = self.operator.local_runtime_files(str(repository))
        self.assertEqual(refused, [])
        self.assertEqual(old - new, set())
        self.assertEqual(new - old, set(), 'extras over the old scanner')

    def test_corpus_an_import_appended_in_code_is_refused_for_every_file(self):
        # Fail-open probe over every bound JS/TS file: the same import after its text is code, inside a fresh
        # line comment it is a comment, so no file's text leaves the scan in a comment or untrusted state.
        repository = HERE.parent.parent
        names = sorted(name for name in self.operator.local_runtime_files(str(repository))
                       if Path(name).suffix in ('.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'))
        self.assertGreater(len(names), 600)
        for label, probe, expected in (('code', '\n;' + MISSING + ';\n', set(names)), ('comment', '\n// ' + MISSING + '\n', set())):
            unresolved = []
            for name in names:
                text = (repository / name).read_text() + probe
                unresolved.append((name, text, self.operator.LOCAL_IMPORT.search(text, len(text) - len(probe))))
            with self.subTest(label):
                self.assertEqual({name for name, _, _ in self.operator.code_imports(str(repository), unresolved)}, expected)


if __name__ == '__main__':
    unittest.main()
