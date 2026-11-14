#!/usr/bin/env python3
"""Run one planned author check or verify its evidence after an exact-tree squash.

usage: validation.py run PLAN CHECK NEW_RESULT_DIR
       validation.py verify PLAN CHECK RECEIPT
Full queue validation is deliberately outside this reuse mechanism.
"""
import os
import json
import re
import secrets
from pathlib import Path
import subprocess
import sys
import time
from workflow_evidence import (command, create_json, digest, external_path, git, identity,
                               now, public_path, read_json, reference, require, verify_reference, execution_tools, CollectorContextMismatch)

ENVIRONMENT = ('CI', 'VITEST_MAX_WORKERS', 'VITEST_MIN_WORKERS', 'VITEST_POOL', 'TZ',
               'NODE_OPTIONS', 'PATH', 'LANG', 'LC_ALL', 'PLAYWRIGHT_BROWSERS_PATH')


def wrapper_controls():
    """Public recorder/reuse calls own their capped child, never an injected reservation."""
    allowed = {'BOUNDED_WORKERS':'2', 'BOUNDED_CPU':'600%'}
    bad = [key for key,value in os.environ.items() if key.startswith(('CAPPED_', 'BOUNDED_', 'ADMISSION_'))
           and (key not in allowed or value != allowed[key])]
    require(not bad, 'Unapproved wrapper override: ' + ', '.join(sorted(bad)))
    return dict(policy='canonical-only-v1', workers=2, cpu='600%')


def check_command(check):
    argv = check['argv']
    require(isinstance(argv, list) and argv and all(isinstance(x, str) and x for x in argv), 'Invalid check argv')
    fixed = [['pnpm', '-s', name] for name in ('typecheck', 'lint', 'check:initial-migration-writers', 'catalog:pin', 'test:workflow', 'test:artifacts')]
    tests = argv[:2] == ['pnpm', 'test'] and len(argv) > 2 and all(not x.startswith('-') for x in argv[2:])
    artifacts = argv[:4] == ['pnpm', '-s', 'check:artifacts', '--base'] and len(argv) == 5
    shell_test = len(argv) == 2 and argv[0] == 'bash' and re.fullmatch(r'scripts/orchestration/[a-z0-9-]+\.test\.sh', argv[1]) is not None
    local_codegen = argv == ['bash', 'scripts/orchestration/codegen.sh', '.']
    local_browser = (argv[:2] == ['bash', 'scripts/orchestration/e2e-branch.sh'] and
                     '--backend' in argv and argv[argv.index('--backend') + 1:] == ['local'] and '--reuse' not in argv)
    require(argv in fixed or tests or shell_test or artifacts or local_codegen or local_browser, 'Use a canonical planned local check')
    return argv


def shared_context(plan):
    wrapper_controls()
    root = plan['worktree']
    current = identity(root)
    require(not current['status'], 'Validation needs a clean committed checkout')
    require(git(root, 'rev-parse', plan['base']) == plan['base'], 'Validation base must be a full commit SHA')
    git(root, 'merge-base', '--is-ancestor', plan['base'], current['commit'])
    names = ['node', 'pnpm', 'git', 'bash', 'python3']
    if any(check_command(check)[:2] in (['bash', 'scripts/orchestration/codegen.sh'], ['bash', 'scripts/orchestration/e2e-branch.sh']) for check in plan['checks'].values()):
        names.append('docker')
    path, tools = execution_tools(names)
    for name, tool in tools.items():
        tool['version'] = command([name, '--version'], env={**os.environ, 'PATH':path})
    files = {'package.json', 'pnpm-lock.yaml', 'node_modules/.pnpm/lock.yaml'}
    for check in plan['checks'].values():
        require(isinstance(check['inputs'], list) and all(not Path(name).is_absolute() and '..' not in Path(name).parts for name in check['inputs']), 'Invalid dependency path')
        files.update(check['inputs'])
    dependencies = {name:digest(public_path(Path(root) / name)) for name in sorted(files)}
    return dict(identity=current, tools=tools, path=path, dependencies=dependencies)


def context(plan, check, shared=None):
    controls = wrapper_controls()  # Recheck even when a boundary supplies a shared capture.
    root = plan['worktree']
    shared = shared if shared is not None else shared_context(plan)
    current, tools = shared['identity'], shared['tools']
    files = ['package.json', 'pnpm-lock.yaml', 'node_modules/.pnpm/lock.yaml']
    files += check['inputs']
    runtime = runtime_context(root, check_command(check))
    if check_command(check) == ['pnpm', '-s', 'test:workflow']:
        runtime['sharedWrappers'] = [reference(Path(plan['orch']) / name) for name in
            ('bounded.sh', 'bounded-lock.sh', 'bounded-resources.sh', 'run-bounded-command.sh', 'bounded-receipt.sh')]
    dependencies = {name: shared['dependencies'][name] for name in sorted(set(files))}
    return dict(tree=current['tree'], base=plan['base'], branch=current['branch'], worktree=current['worktree'],
                dependencies=dependencies, tools=tools, environment={**{key: os.environ.get(key) for key in ENVIRONMENT}, 'CI':'true', 'VITEST_MAX_WORKERS':os.environ.get('BOUNDED_WORKERS','2'), 'PATH':shared['path']},
                argv=check_command(check), impact=check['impact'], runtime=runtime,
                recorderSha256=digest(__file__), sharedHelperSha256=digest(Path(__file__).with_name('workflow_evidence.py')),
                wrapper=reference(Path(plan['orch']) / 'capped.sh'), wrapperControls=controls)


def runtime_context(root, argv):
    if argv[:2] != ['bash', 'scripts/orchestration/codegen.sh'] and argv[:2] != ['bash', 'scripts/orchestration/e2e-branch.sh']:
        return {}
    backend = Path(root) / 'scripts/local-convex/backend.ts'
    image = re.search(r"ghcr.io/convex/convex-backend@sha256:[0-9a-f]{64}", backend.read_text())
    require(image is not None, 'Pinned local backend image missing')
    value = dict(backendSource=reference(backend), image=image[0],
                 actualImage=command(['docker', 'image', 'inspect', '--format', '{{.Id}}', image[0]]),
                 dockerVersion=command(['docker', '--version']))
    if argv[1].endswith('e2e-branch.sh') and '--preflight' not in argv:
        script = "const p=require('@playwright/test');console.log(JSON.stringify(Object.fromEntries(['chromium','firefox','webkit'].map(n=>[n,p[n].executablePath()]))))"
        browsers = json.loads(command(['node', '-e', script], cwd=root))
        value['browsers'] = {name: reference(path) for name, path in browsers.items()}
    return value


def select(plan_path, name):
    plan = read_json(plan_path)
    require(plan.get('version') == 1 and isinstance(plan.get('checks'), dict), 'Invalid validation plan')
    check = plan['checks'][name]
    require(isinstance(check['impact'], str) and check['impact'] and isinstance(check['inputs'], list), 'Check needs impact/inputs')
    require(all(not Path(x).is_absolute() and '..' not in Path(x).parts for x in check['inputs']), 'Invalid dependency path')
    require(plan.get('fullQueueRequired') is True, 'Full queue validation remains mandatory')
    return plan, check


def verify(plan_path, name, receipt_path, full=True, shared=None):
    plan, check = select(plan_path, name)
    path = Path(receipt_path)
    require(path.is_absolute() and path.resolve() == path and path.name == 'receipt.json', 'Use the original canonical receipt location')
    directory = external_path(str(path.parent), plan['main'], plan['orch'])
    receipt = read_json(path)
    require(receipt.get('kind') == 'author-validation-v2' and receipt.get('check') == name, 'Wrong validation receipt')
    require(receipt.get('exitCode') == 0 and type(receipt.get('exitCode')) is int and receipt.get('result') == 'ok', 'Failed validation is never reusable')
    require(receipt['attempt']['path'] == str(directory / 'attempt.json'), 'Original attempt location mismatch')
    verify_reference(receipt['attempt'])
    attempt = read_json(receipt['attempt']['path'])
    require(attempt.get('kind') == 'author-validation-attempt-v2' and attempt.get('directory') == str(directory), 'Moved or invalid validation attempt')
    require(re.fullmatch('[0-9a-f]{32}', attempt.get('nonce', '')), 'Invalid validation attempt nonce')
    for field in ('plan', 'check', 'context', 'testedCommit', 'startedAt'):
        require(attempt[field] == receipt[field], 'Receipt differs from original attempt: ' + field)
    require(receipt['execution']['path'] == str(directory / 'execution.json'), 'Original execution location mismatch')
    verify_reference(receipt['execution'])
    execution = read_json(receipt['execution']['path'])
    require(execution['attempt'] == receipt['attempt'] and execution['output'] == receipt['output'], 'Execution/attempt/output binding mismatch')
    require(execution.get('launched') is True and type(execution.get('pid')) is int and execution['pid'] > 0
            and type(execution.get('exitCode')) is int and execution['exitCode'] == 0 and execution.get('error') is None, 'No successful recorded command execution')
    require(execution['argv'] == [str(Path(plan['orch']) / 'capped.sh'), *attempt['context']['argv']]
            and execution['cwd'] == plan['worktree'], 'Recorded execution command differs')
    require(all(execution[field] == receipt[field] for field in ('exitCode', 'endedAt', 'elapsedSeconds')), 'Execution completion differs')
    require(receipt['output']['path'] == str(directory / 'output.log'), 'Original output location mismatch')
    verify_reference(receipt['plan'])
    require(receipt['plan'] == reference(plan_path), 'Validation plan changed; select affected checks again')
    verify_reference(receipt['output'])
    require(attempt['context'].get('wrapperControls') == dict(policy='canonical-only-v1', workers=2, cpu='600%'),
            'Original receipt does not prove approved wrapper controls; record a fresh check')
    if not full:
        return dict(result='bound', check=name, evidence=reference(receipt_path))
    current = context(plan, check, shared=shared)
    prior = attempt['context']
    changed = [key for key in current if current[key] != prior.get(key)]
    if changed == ['environment']:
        raise CollectorContextMismatch('Validation invalidated: environment; use the recorded operator environment')
    require(not changed, 'Validation invalidated: ' + ', '.join(changed))
    require(git(plan['worktree'], 'rev-parse', receipt['testedCommit'] + '^{tree}') == prior['tree'], 'Tested tree missing/mismatched')
    require(not git(plan['worktree'], 'diff', '--no-ext-diff', '--no-textconv', receipt['testedCommit'], 'HEAD', '--'), 'Squash content differs')
    return dict(result='reused', check=name, testedCommit=receipt['testedCommit'],
                targetCommit=git(plan['worktree'], 'rev-parse', 'HEAD'), tree=current['tree'], evidence=reference(receipt_path))


def run(plan_path, name, result_dir):
    plan, check = select(plan_path, name)
    target = external_path(result_dir, plan['main'], plan['orch'])
    plan_reference = reference(plan_path)
    before = context(plan, check)
    tested = identity(plan['worktree'])
    target.mkdir()  # A failed or interrupted check consumes this evidence location.
    started, clock = now(), time.monotonic()
    create_json(target / 'attempt.json', dict(kind='author-validation-attempt-v2', directory=str(target), nonce=secrets.token_hex(16),
                 plan=plan_reference, check=name, context=before, testedCommit=tested['commit'], startedAt=started))
    attempt_reference = reference(target / 'attempt.json')
    code, error, process = None, None, None
    argv = [str(Path(plan['orch']) / 'capped.sh'), *before['argv']]
    with (target / 'output.log').open('x') as output:
        try:
            process = subprocess.Popen(argv, cwd=plan['worktree'], stdout=output, stderr=subprocess.STDOUT,
                                       env={**os.environ, 'PATH':before['environment']['PATH'], 'CI':before['environment']['CI'], 'VITEST_MAX_WORKERS':before['environment']['VITEST_MAX_WORKERS']})
            code = process.wait()
            require(identity(plan['worktree']) == tested and context(plan, check) == before
                    and reference(plan_path) == plan_reference, 'Identity/environment/plan changed during validation')
        except Exception as exc:
            error = str(exc)
    ended, elapsed = now(), time.monotonic() - clock
    output_reference = reference(target / 'output.log')
    create_json(target / 'execution.json', dict(attempt=attempt_reference, argv=argv, cwd=plan['worktree'],
                 launched=process is not None, pid=process.pid if process is not None else None,
                 exitCode=code, error=error, endedAt=ended, elapsedSeconds=elapsed, output=output_reference))
    value = dict(kind='author-validation-v2', check=name, plan=plan_reference, context=before,
                 testedCommit=tested['commit'], startedAt=started, endedAt=ended, elapsedSeconds=elapsed,
                 exitCode=code, result='ok' if code == 0 and error is None else 'failed', error=error,
                 attempt=attempt_reference, execution=reference(target / 'execution.json'), output=output_reference)
    create_json(target / 'receipt.json', value)
    require(value['result'] == 'ok', 'Validation failed; retain receipt: ' + str(target / 'receipt.json'))
    return value


if __name__ == '__main__':
    try:
        operation, plan, name, path = sys.argv[1:]
        require(operation in ('run', 'verify'), 'Use run or verify')
        print(json.dumps(run(plan, name, path) if operation == 'run' else verify(plan, name, path)))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
