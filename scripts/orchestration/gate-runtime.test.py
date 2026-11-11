"""Actual wrapper/entry regressions; disposable state, no live unit/backend/gate."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
SHARED = Path(os.environ['EP_ORCH'])
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location('operator_fixtures', HERE / 'gate-operator.test.py')
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)


class ActualAdmissionTest(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.orch = self.root / 'ep-orch'
        self.base = self.orch / 'run/nested/attempt/base-runtime'
        self.base.mkdir(parents=True)
        for name in ('admission.sh','memory-reservations.tsv','bounded-outcome.sh'):
            shutil.copy2(HERE / name, self.base / name)
        self.operator = fixtures.module('gate-operator')
        self.values = dict(ORCH=str(self.orch),E=str(self.base.parent),MAIN=str(self.root / 'main'),WT=str(self.root / 'worker'),FEATURE='feature')

    def test_frozen_library_resolves_shared_ledger_before_payload_environment(self):
        generated = self.operator.child_environment(self.values)
        # These are the existing bounded.sh library/state exports, not payload EP_ORCH.
        unit = {key: generated[key] for key in ('BOUNDED_ADMISSION_LIB','BOUNDED_OUTCOME_LIB','BOUNDED_STATE_DIR') if key in generated}
        result = subprocess.run(['bash','-c','. "$1"; printf "%s\\n" "$admission_dir"','unit-entry',str(self.base / 'admission.sh')],env={'PATH':os.environ['PATH'],**unit},capture_output=True,text=True,check=True)
        self.assertEqual(result.stdout.strip(), str(self.orch / 'admission'))

    def test_actual_shared_wrappers_reserve_before_payload_and_release_at_stop(self):
        # Copy exact current shared bytes; intercept only the systemd launcher.
        wrappers = ('bounded.sh', 'bounded-lock.sh', 'bounded-resources.sh', 'run-bounded-command.sh', 'bounded-receipt.sh')
        missing = [name for name in wrappers if not (SHARED / name).is_file()]
        if missing:
            # The shared wrappers live only in the gate host's $EP_ORCH, never in a checkout (CI's static job, gate-ci-workflow).
            print('SKIP (host-only: needs the shared wrappers %s in %s) %s' % (', '.join(missing), SHARED, self.id()), file=sys.stderr, flush=True)
            self.skipTest('host-only: shared wrappers missing from ' + str(SHARED))
        for name in wrappers:
            shutil.copy2(SHARED / name, self.orch / name)
            self.assertEqual((SHARED / name).read_bytes(), (self.orch / name).read_bytes())
        generated = self.operator.child_environment(self.values)
        self.assertEqual(generated.get('BOUNDED_STATE_DIR'), str(self.orch))
        binary = self.root / 'bin'; binary.mkdir()
        launcher = binary / 'systemd-run'
        launcher.write_text('#!' + sys.executable + '\n' + '''
import json,os,pathlib,subprocess,sys
args=sys.argv[1:]; env={}; props={}; i=0
while i<len(args):
    arg=args[i]
    if arg=='/bin/bash': break
    if arg.startswith('--setenv='):
        key,value=arg.removeprefix('--setenv=').split('=',1);env[key]=value
    if arg=='-p':
        key,value=args[i+1].split('=',1);props[key]=value;i+=1
    i+=1
state=pathlib.Path(env['BOUNDED_STATE_DIR'])
assert 'EP_ORCH' not in env
assert pathlib.Path(env['BOUNDED_ADMISSION_LIB']).is_relative_to(state)
(state/'unit-environment.json').write_text(json.dumps(env))
with pathlib.Path(props['StandardOutput'].removeprefix('append:')).open('w') as log:
    code=subprocess.run(args[i:],env=env,stdout=log,stderr=subprocess.STDOUT).returncode
stop=props['ExecStopPost'].split()
assert stop[:2]==['/bin/bash',str(state/'bounded-receipt.sh')]
subprocess.run(stop,env={**env,'SERVICE_RESULT':'success' if code==0 else 'exit-code',
    'EXIT_CODE':'exited','EXIT_STATUS':str(code)},check=True)
sys.exit(code)
''')
        launcher.chmod(0o755)
        payload = self.root / 'payload.sh'
        payload.write_text('''#!/bin/bash
set -eu
# These run in the payload after the actual wrapper has taken locks/admission.
. "$BOUNDED_ADMISSION_LIB"
[[ $admission_dir == "$EP_ORCH/admission" ]]
[[ $(admission_field "$BOUNDED_ID" state) == active ]]
[[ $(admission_field "$BOUNDED_ID" class) == gate-2 ]]
[[ $BOUNDED_RESERVATION == "$BOUNDED_ID" ]]
admission_status > "$EP_ORCH/payload-ledger.txt"
''')
        payload.chmod(0o755)
        # Preserve the interception in the explicit PATH passed through bounded.sh.
        environment = {**generated, 'PATH':str(binary)+os.pathsep+generated['PATH'],
                       'BOUNDED_WAIT_TIMEOUT':'10', 'BOUNDED_LOCKS':'resource curator curator2'}
        result = subprocess.run(['bash', str(self.orch / 'bounded.sh'), '--detach', 'ledger', 'gate',
            '/usr/bin/env', 'EP_ORCH='+str(self.orch), 'bash', str(payload)],
            env=environment, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        unit = json.loads((self.orch / 'unit-environment.json').read_text())
        invocation = unit['BOUNDED_ID']
        self.assertIn(invocation, (self.orch / 'payload-ledger.txt').read_text())
        receipt = json.loads((self.orch / 'bounded' / invocation / 'receipt.json').read_text())
        self.assertEqual((receipt['outcome'], receipt['exitCode']), ('ok', 0))
        events = (self.orch / 'admission/events.log').read_text()
        self.assertIn('admitted '+invocation, events)
        self.assertIn('released '+invocation, events)
        status = subprocess.check_output(['bash',str(self.base / 'admission.sh'),'status'],env=generated,text=True)
        self.assertIn('active: none; queued: none',status)
        self.assertFalse((self.orch / 'run/ep-orch/admission').exists())


class ActualEntryTest(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.GateTransitionTest()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)

    def frozen_main(self, delete_entry=False, fresh=False):
        f = self.fixture
        directory = f.main / 'scripts/orchestration'
        for name in ('gate-operator.py','gate_operator.py','gate_core.py','gate_monitor.py','validation.py','workflow_evidence.py','remote_checks.py'):
            shutil.copy2(HERE / name, directory / name)
        if fresh:
            # A finite observation fixture avoids host/Docker instrumentation. The
            # real bootstrap, engine, preparation, freeze and exec remain unchanged.
            (directory / 'gate_monitor.py').write_text('''import json
from pathlib import Path
def observe(v, invocation):
    config=json.loads(Path(v['CONFIG']).read_text())
    path=Path(config['control']);value=json.loads(path.read_text())
    value.update(state='finish-current',phase='prepare');path.write_text(json.dumps(value))
    return dict(slice={'memory.events':'max 0\\noom 0\\n'},observerSource=__file__)
''')
        f.git(f.main,'add','.')
        f.git(f.main,'commit','-qm','actual MAIN entry and modules')
        f.base = f.git(f.main,'rev-parse','HEAD')
        f.git(f.worker,'rebase',f.base)
        if not fresh:
            f.git(f.worker,'rm','scripts/orchestration/gate_monitor.py')
        if delete_entry:
            for name in ('gate-operator.py', 'gate_operator.py', 'gate_core.py', 'validation.py', 'workflow_evidence.py', 'remote_checks.py'):
                f.git(f.worker, 'rm', 'scripts/orchestration/' + name)
        if not fresh:
            f.git(f.worker,'commit','-qm','delete mutable MAIN operator modules')
        f.reviewed = f.git(f.worker,'rev-parse','HEAD')
        f.tree = f.git(f.worker,'rev-parse','HEAD^{tree}')
        f.v.update(BASE=f.base,REVIEWED=f.reviewed,TREE=f.tree)
        if not fresh:
            prepared = f.prepare_commit()
        f.authorize_fixture(prepared=not fresh)
        if not fresh:
            frozen = Path(f.v['SNAP']);(frozen / 'queue.log').unlink();frozen.rmdir()
            (f.run / 'snapshot.json').unlink()
        installed = f.worker / 'node_modules/.pnpm/lock.yaml'
        installed.parent.mkdir(parents=True);installed.write_text('installed fixture\n')
        for name in ('bounded.sh','capped.sh','bounded-resources.sh','bounded-receipt.sh','slice-sampler.sh'):
            (f.orch / name).write_text('# fixture dependency, not a launched wrapper\n')
        if fresh:
            f.run.rmdir()
            return
        f.operator.freeze(f.v)
        from workflow_evidence import reference
        prior = json.loads((f.run / 'prepared.json').read_text())
        prior['bindings'] = [reference(f.run / name) for name in ('mapping.json','snapshot.json')]
        (f.run / 'prepared.json').write_text(json.dumps(prior))
        refs = dict(line.split(' ', 1)[::-1] for line in f.git(f.main, 'for-each-ref', '--format=%(objectname) %(refname)').splitlines())
        from workflow_evidence import create_json
        create_json(f.run / 'protected-refs.json', refs)
        return prepared

    def fresh_run_fixture(self):
        from workflow_evidence import reference
        self.frozen_main(fresh=True)
        f = self.fixture
        binary = f.root / 'bin';binary.mkdir()
        trace = f.orch / 'operator-entry-trace.jsonl'
        real_node = shutil.which('node')
        node = binary / 'node'
        node.write_text('#!'+sys.executable+'\n'+'''import json,os
from pathlib import Path
parent=os.getppid()
with Path('''+repr(str(trace))+''').open('a') as output:
    output.write(json.dumps(dict(pid=parent,argv=Path('/proc/'+str(parent)+'/cmdline').read_bytes().decode().split('\\0')[:-1]))+'\\n')
os.execv('''+repr(real_node)+''', ['''+repr(real_node)+''', *__import__('sys').argv[1:]])
''')
        node.chmod(0o755)
        previous = os.environ['PATH']
        os.environ['PATH']=str(binary)+os.pathsep+previous
        self.addCleanup(os.environ.__setitem__, 'PATH', previous)
        capped = f.orch / 'capped.sh'
        capped.write_text('''#!/bin/bash
if [[ ${4:-} == scripts/catalog-record-review.ts ]]; then
  echo 'Synthetic record-verification dependency; not promotion qualification.'
  exit 0
fi
exec "$@"
''')
        capped.chmod(0o755)
        config = json.loads(f.config.read_text())
        plan = Path(config['validation']['plan']['path'])
        value = json.loads(plan.read_text())
        value['checks'] = dict(types=dict(argv=['pnpm','-s','typecheck'],inputs=[],impact='Fresh-entry fixture author check'))
        plan.write_text(json.dumps(value))
        receipt = f.orch / 'author-check'
        with fixtures.recorder_session():
            fixtures.module('validation').run(str(plan),'types',str(receipt))
        config['validation']=dict(plan=reference(plan),receipts=dict(types=reference(receipt / 'receipt.json')))
        f.config.write_text(json.dumps(config))
        return f.main / 'scripts/orchestration/gate-operator.py', trace

    def test_fresh_initial_run_prepares_then_executes_frozen_entry_before_submission_pause(self):
        entry, trace = self.fresh_run_fixture()
        f = self.fixture
        result = self.command(entry, 'run')
        self.assertEqual(result.returncode, 0, result.stderr+result.stdout)
        self.assertEqual(json.loads(result.stdout), dict(paused=True,nextPhase='submit'))
        self.assertTrue((f.run / 'prepared.json').is_file())
        self.assertFalse((f.run / 'submission-claim.json').exists())
        self.assertFalse((f.run / 'prepare-failed.json').exists())
        rows = [json.loads(line) for line in trace.read_text().splitlines()]
        frozen = str(f.run / 'operator-runtime/gate-operator.py')
        initial = {row['pid'] for row in rows if str(entry) in row['argv'] and row['argv'][-1]=='run'}
        executed = {row['pid'] for row in rows if frozen in row['argv'] and row['argv'][-1]=='resume'}
        self.assertTrue(initial & executed, rows)  # Actual same-PID exec, not a cached import.
        baseline = json.loads((f.run / 'resource-baseline.json').read_text())
        self.assertEqual(baseline['observerSource'], str(entry.with_name('gate_monitor.py')))

    def test_fresh_initial_run_pause_before_preparation_names_prepare_and_launches_nothing(self):
        entry, _ = self.fresh_run_fixture()
        f = self.fixture
        control = f.orch / 'control.json'
        value = json.loads(control.read_text());value.update(state='finish-current',phase='observe')
        control.write_text(json.dumps(value))
        result = self.command(entry, 'run')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), dict(paused=True,nextPhase='prepare'))
        self.assertFalse(f.run.exists())
        self.assertEqual(subprocess.run(['git','-C',str(f.main),'show-ref','--verify','--quiet',f.archive]).returncode, 1)

    def test_fresh_initial_run_rejects_failed_review_prerequisite_before_preparation_or_submit(self):
        entry, _ = self.fresh_run_fixture()
        f = self.fixture
        (f.orch / 'spec.md').write_text('Changed review evidence\n')
        result = self.command(entry, 'run')
        self.assertEqual(result.returncode, 1)
        self.assertIn('Evidence/input changed', result.stderr)
        self.assertFalse(f.run.exists())
        self.assertEqual(subprocess.run(['git','-C',str(f.main),'show-ref','--verify','--quiet',f.archive]).returncode, 1)

    def command(self, entry, phase, remove=()):
        # Model the public operator session, rather than injecting this test's outer capped controls.
        from gate_core import OVERRIDE_PREFIXES
        environment = {key:value for key,value in os.environ.items() if not key.startswith(OVERRIDE_PREFIXES) and key not in ('NODE_OPTIONS', 'PYTHONPATH', 'PYTHONHOME')}
        environment['PATH'] = str(self.fixture.root / 'unused-new-session') + os.pathsep + environment['PATH']
        for key in remove:
            environment.pop(key, None)
        return subprocess.run([sys.executable, '-B', str(entry), phase], env=environment, capture_output=True, text=True)

    def land(self, prepared):
        f = self.fixture
        ref = json.loads((f.run / 'prepared.json').read_text())['landingLock']
        subprocess.run(['bash', str(HERE / 'land.sh'), prepared['SQUASHED'], str(f.worker)], check=True, capture_output=True,
            env={**os.environ, 'MAIN':str(f.main), 'EP_ORCH':str(f.orch), 'FEATURE':'feature', 'LAND_EXPECTED_BASE':f.base,
                 'LAND_OBSERVATION_LOCK':ref['path'], 'LAND_OBSERVATION_LOCK_ID':str(ref['device'])+':'+str(ref['inode'])})

    def terminal(self, prepared):
        f = self.fixture
        child = subprocess.run([sys.executable,'-B',str(f.run / 'operator-runtime/gate_monitor.py'),'--integrity-worker'],capture_output=True,text=True,check=True)
        integrity = json.loads(child.stdout)
        self.assertTrue(integrity['passed'],integrity)
        f.terminal_fixture(prepared, integrity)

    def test_fresh_actual_MAIN_collect_after_module_deletion_uses_frozen_runtime(self):
        f = self.fixture
        prepared = self.frozen_main()
        entry = f.main / 'scripts/orchestration/gate-operator.py'
        handle = self.command(entry, 'runtime')
        self.assertEqual(handle.returncode, 0, handle.stderr)
        self.land(prepared)
        self.terminal(prepared)
        # Existing MAIN bootstrap must select the immutable closure before imports.
        result = self.command(entry, 'collect')
        self.assertEqual(result.returncode,0,result.stderr+result.stdout)
        self.assertTrue(json.loads(result.stdout)['passed'])
        # All later operational re-entries use the documented stable handle.
        for phase in ('complete', 'run', 'resume', 'collect', 'complete', 'cancel'):
            result = self.command(handle.stdout.strip(), phase)
            self.assertEqual(result.returncode, 0, (phase, result.stderr, result.stdout))
        self.assertFalse((f.run / 'stop-reason.json').exists())

    def test_stable_MAIN_launch_handle_survives_deletion_of_entire_MAIN_runtime(self):
        f = self.fixture
        prepared = self.frozen_main(delete_entry=True)
        entry = f.main / 'scripts/orchestration/gate-operator.py'
        handle = self.command(entry, 'runtime')
        self.assertEqual(handle.returncode, 0, handle.stderr)
        self.land(prepared)
        self.assertFalse(entry.exists())
        self.terminal(prepared)
        for phase in ('collect', 'resume', 'cancel', 'complete', 'run'):
            result = self.command(handle.stdout.strip(), phase)
            self.assertEqual(result.returncode, 0, (phase, result.stderr, result.stdout))
            self.assertNotIn('stop-reason.json', {p.name for p in f.run.iterdir()})

    def test_frozen_runtime_tamper_refuses_before_operational_import(self):
        f = self.fixture
        self.frozen_main()
        entry = f.main / 'scripts/orchestration/gate-operator.py'
        frozen = f.run / 'operator-runtime/gate_operator.py'
        frozen.chmod(0o644)
        frozen.write_text('raise RuntimeError("UNFROZEN EXECUTION")\n')
        result = self.command(entry, 'cancel')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Frozen runtime binding changed', result.stderr)
        self.assertNotIn('UNFROZEN EXECUTION', result.stderr)

    def test_frozen_closure_includes_the_remote_verifier_and_keeps_earlier_attempts_selectable(self):
        f = self.fixture
        self.frozen_main()
        entry = f.main / 'scripts/orchestration/gate-operator.py'
        runtime = f.run / 'operator-runtime'
        manifest = json.loads((f.run / 'snapshot.json').read_text())
        self.assertIn('remote_checks.py', manifest['operatorRuntime'])
        self.assertTrue((runtime / 'remote_checks.py').is_file())
        self.assertEqual(self.command(entry, 'runtime').returncode, 0)
        def closure(names):
            from workflow_evidence import reference
            runtime.chmod(0o755)
            for path in runtime.iterdir():
                if path.name not in names:
                    path.unlink()
            runtime.chmod(0o555)
            value = json.loads((f.run / 'snapshot.json').read_text())
            value['operatorRuntime'] = {name: item for name, item in value['operatorRuntime'].items() if name in names}
            (f.run / 'snapshot.json').write_text(json.dumps(value))
            prepared = json.loads((f.run / 'prepared.json').read_text())
            prepared['bindings'] = [reference(f.run / name) for name in ('mapping.json', 'snapshot.json')]
            (f.run / 'prepared.json').write_text(json.dumps(prepared))
        # An attempt frozen before this module existed selects its own six-file closure.
        earlier = set(manifest['operatorRuntime']) - {'remote_checks.py'}
        closure(earlier)
        result = self.command(entry, 'runtime')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), str(runtime / 'gate-operator.py'))
        closure(earlier - {'validation.py'})
        result = self.command(entry, 'runtime')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Incomplete frozen operator import closure', result.stderr)

    def test_observation_pause_retains_terminal_success_then_resumes(self):
        f = self.fixture
        prepared = self.frozen_main()
        handle = self.command(f.main / 'scripts/orchestration/gate-operator.py', 'runtime').stdout.strip()
        self.land(prepared)
        control = f.orch / 'control.json'
        value = json.loads(control.read_text());value.update(state='finish-current', phase='observe');control.write_text(json.dumps(value))
        self.terminal(prepared)
        # Collection is part of finishing observation, not an unauthorized new gate.
        result = self.command(handle, 'collect')
        self.assertEqual(result.returncode, 0, result.stderr+result.stdout)
        collected = (f.run / 'result.json').read_bytes()
        self.assertTrue(json.loads(collected)['passed'])
        result = self.command(handle, 'resume')
        self.assertEqual(result.returncode, 0, result.stderr+result.stdout)
        self.assertTrue(json.loads(result.stdout)['paused'])
        self.assertFalse((f.run / 'stop-reason.json').exists())

        self.assertFalse((f.run / 'completion.json').exists())
        value['state']='active';control.write_text(json.dumps(value))
        result = self.command(handle, 'resume')
        self.assertEqual(result.returncode, 0, result.stderr+result.stdout)
        self.assertTrue(json.loads(result.stdout)['passed'])
        before = (f.run / 'completion.json').read_bytes()
        value['state']='stopped';control.write_text(json.dumps(value))
        for phase in ('run', 'collect', 'complete', 'resume'):
            result = self.command(handle, phase)
            self.assertEqual(result.returncode, 0, (phase, result.stderr, result.stdout))
        self.assertEqual((f.run / 'result.json').read_bytes(), collected)
        self.assertEqual((f.run / 'completion.json').read_bytes(), before)
        self.assertFalse((f.run / 'stop-reason.json').exists())


    def assert_uncollected_success_defers(self, phase, state, current=None, locale=False):
        from workflow_evidence import create_json
        f = self.fixture
        prepared = self.frozen_main()
        handle = self.command(f.main / 'scripts/orchestration/gate-operator.py', 'runtime').stdout.strip()
        self.land(prepared)
        self.terminal(prepared)
        create_json(f.run / 'submit-result.json', dict(exitCode=0, identities=1))
        control = f.orch / 'control.json'
        value = json.loads(control.read_text());value.update(state=state, phase=current)
        control.write_text(json.dumps(value))
        result = self.command(handle, phase, remove=('LC_ALL',) if locale else ())
        self.assertFalse((f.run / 'result.json').exists(), result.stdout+result.stderr)
        self.assertFalse((f.run / 'stop-reason.json').exists(), result.stdout+result.stderr)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['nextPhase'], 'collect')
        self.assertTrue(json.loads(result.stdout)['deferred'])
        value['state']='active';control.write_text(json.dumps(value))
        for next_phase in ('collect', 'complete'):
            resumed = self.command(handle, next_phase)
            self.assertEqual(resumed.returncode, 0, resumed.stderr+resumed.stdout)
            self.assertTrue(json.loads(resumed.stdout)['passed'])

    def test_terminal_success_cancel_under_stopped_defers_without_failed_result(self):
        self.assert_uncollected_success_defers('cancel', 'stopped')

    def test_terminal_success_resume_under_stopped_defers_without_failed_result(self):
        self.assert_uncollected_success_defers('resume', 'stopped')

    def test_terminal_success_collect_under_another_phase_defers_without_failed_result(self):
        self.assert_uncollected_success_defers('collect', 'finish-current', 'complete')

    def test_terminal_success_collection_from_unset_LC_ALL_defers_then_matching_session_finishes(self):
        original = os.environ.get('LC_ALL')
        os.environ['LC_ALL']='C.UTF-8'
        try:
            self.assert_uncollected_success_defers('collect', 'active', locale=True)
        finally:
            if original is None:
                os.environ.pop('LC_ALL', None)
            else:
                os.environ['LC_ALL']=original

    def assert_genuine_terminal_failure(self, failure):
        f = self.fixture
        prepared = self.frozen_main()
        handle = self.command(f.main / 'scripts/orchestration/gate-operator.py', 'runtime').stdout.strip()
        self.land(prepared)
        self.terminal(prepared)
        if failure == 'observer':
            (f.run / 'observer-failure.json').write_text('{"exitCode":1}')
        elif failure == 'identity':
            (f.worker / 'value').write_text('dirty candidate\n')
        else:
            receipt = next((f.orch / 'bounded').glob('*/receipt.json'))
            value = json.loads(receipt.read_text());value.update(outcome='failed',exitCode=7)
            receipt.write_text(json.dumps(value))
        result = self.command(handle, 'collect', remove=('LC_ALL',))
        self.assertEqual(result.returncode, 1, result.stdout+result.stderr)
        failed = (f.run / 'result.json').read_bytes()
        self.assertFalse(json.loads(failed)['passed'])
        self.assertNotEqual(self.command(handle, 'complete').returncode, 0)
        self.assertEqual((f.run / 'result.json').read_bytes(), failed)

    def test_collector_mismatch_never_hides_failed_canonical_receipt(self):
        self.assert_genuine_terminal_failure('receipt')

    def test_collector_mismatch_never_hides_recorded_observer_failure(self):
        self.assert_genuine_terminal_failure('observer')

    def test_collector_mismatch_never_hides_candidate_identity_tamper(self):
        self.assert_genuine_terminal_failure('identity')


if __name__ == '__main__':
    unittest.main()
