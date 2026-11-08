#!/usr/bin/env python3
"""One authorized local operation, using canonical queue/receipts rather than copied issue runners.

GATE_CONFIG=/absolute/config.json python3 -B scripts/orchestration/gate-operator.py prepare|run|resume|collect|complete|cancel
No operation in this file bypasses land-queue.sh or starts Cloud/GitHub work.
"""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from gate_core import (all_refs, authorization, check_identity, command, env, execution_control,
                       git, load, mapping, now, preflight, reject_overrides, require, save,
                       sha, snapshot, submission, owned_invocation, PauseRequested, SCRATCH_RECORD)
from workflow_evidence import external_path, lock, receipt_ok, reference, verify_reference, landing_lock_reference, execution_tools, CollectorContextMismatch
from remote_checks import original_suite

HERE = Path(__file__).resolve().parent


def child_environment(v):
    path, _ = execution_tools(('bash', 'git', 'node', 'pnpm', 'python3', 'systemctl', 'docker', 'flock'), hashes=False)
    return {**os.environ, 'PATH':path, 'MAIN': v['MAIN'], 'EP_ORCH': v['ORCH'], 'EP_REPO': v['WT'],
            'FEATURE': v['FEATURE'], 'BOUNDED_WORKERS': '2', 'BOUNDED_CPU': '600%',
            'PYTHONDONTWRITEBYTECODE': '1', 'CI': 'true', 'VITEST_MAX_WORKERS': '2', **runtime_controls(v)}


def runtime_controls(v):
    base = Path(v['E']) / 'base-runtime'
    controls = dict(BOUNDED_STATE_DIR=v['ORCH'])
    if base.is_dir():
        controls.update(BOUNDED_ADMISSION_LIB=str(base / 'admission.sh'), BOUNDED_OUTCOME_LIB=str(base / 'bounded-outcome.sh'))
    return controls


@contextlib.contextmanager
def preparation_locks(v):
    with contextlib.ExitStack() as held:
        for name in ('resource', 'curator', 'curator2', 'land', 'heavy'):
            held.enter_context(lock(Path(v['ORCH']) / (name + '.lock')))
        yield


def verify_history(config):
    """Full historical preservation runs at boundaries, never on every polling tick."""
    for item in config.get('preservedEvidence', []):
        verify_reference(item)
        if item.get('kind') == 'index':
            index = load(item['path'])
            for path, expected in index['files'].items():
                source = Path(item['path']).parent / path
                require(sha(source) == expected['sha256'], 'Historical evidence changed: ' + str(source))


def admission_idle(v):
    source = str(Path(v['E']) / 'base-runtime') if (Path(v['E']) / 'base-runtime').is_dir() else v['S']
    status = command([source + '/admission.sh', 'status'], env=child_environment(v))
    ledger = command(['bash', '-c', '. "$1"; echo "$admission_dir"', 'ledger', source + '/admission.sh'], env=child_environment(v))
    require(ledger == v['ORCH'] + '/admission', 'Admission ledger differs from shared state')
    require('active: none; queued: none' in status, 'Admission not idle')
    values = {name: float(command([source + '/admission.sh', 'gib', name], env=child_environment(v)))
              for name in ('gate-2', 'curator-light', 'budget')}
    require(values['budget'] == 18 and values['gate-2'] + values['curator-light'] <= 18, 'Gate/observer admission would exceed existing budget')
    return dict(status=status, ledger=ledger, reservations=values)


def history(v):
    rows = []
    for line in git(v['WT'], 'log', '--reverse', '--format=%H %T %P', v['BASE'] + '..' + v['REVIEWED']).splitlines():
        commit, tree, *parents = line.split()
        rows.append(dict(commit=commit, tree=tree, parents=parents))
    require(rows and rows[-1]['commit'] == v['REVIEWED'], 'Empty/invalid reviewed history')
    require(all(row['parents'] == [v['BASE'] if index == 0 else rows[index - 1]['commit']]
                for index, row in enumerate(rows)), 'Prepare a linear bounded history first')
    return rows


def prepare_commit(v, config):
    plan = config['preparation']
    reviewed = v['REVIEWED']
    rows = history(v)
    require(v['ARCHIVE'].startswith('refs/archive/'), 'Use an explicit archive ref')
    if plan['mode'] == 'prepared':
        verify_reference(plan['mapping'])
        prior = load(plan['mapping']['path'])
        candidate = plan['candidate']
        # Imported historical formats remain unchanged; only exact identities are consumed.
        for key in ('BASE', 'REVIEWED', 'TREE', 'WT', 'BR', 'ARCHIVE'):
            require(prior.get(key) == v[key], 'Prior prepared mapping mismatch: ' + key)
        require(prior.get('SQUASHED') == candidate, 'Prior candidate mapping mismatch')
        check_identity(v, candidate)
    else:
        require(plan['mode'] == 'squash', 'Unknown preparation mode')
        check_identity(v, reviewed)
        verify_reference(plan['message'])
        require(subprocess.run(['git', '-C', v['WT'], 'show-ref', '--verify', '--quiet', v['ARCHIVE']]).returncode == 1,
                'Archive ref already exists; resume prepared state or diagnose')
        if config.get('kind') == 'curation':
            require(len(rows) == 1, 'Curation must finish specialized prep/review before freezing')
        git(v['WT'], 'update-ref', v['ARCHIVE'], reviewed, '0' * 40)
        if config.get('kind') == 'curation':
            candidate = reviewed  # Its existing exact-context prep receipt remains authoritative.
        else:
            candidate = git(v['WT'], 'commit-tree', v['TREE'], '-p', v['BASE'], '-F', plan['message']['path'])
            save(Path(v['E']) / 'generated-candidate.json', dict(candidate=candidate, at=now()))
            git(v['WT'], 'update-ref', 'refs/heads/' + v['BR'], candidate, reviewed)
        check_identity(v, candidate)
    value = {key: v[key] for key in ('BASE', 'REVIEWED', 'TREE', 'WT', 'BR', 'ARCHIVE')}
    value.update(SQUASHED=candidate, history=rows, mode=plan['mode'], at=now())
    save(Path(v['E']) / 'mapping.json', value)
    mapping(v)
    return value


LOCAL_IMPORT = re.compile(r"(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s*)['\"]([^'\"]+)['\"]")
COMMENT_RANGES = 'scripts/orchestration/comment-ranges.mjs'


def utf16_length(text):
    """The length of `text` in UTF-16 code units, TypeScript's offsets."""
    return len(text.encode('utf-16-le')) // 2


def unique_keys(pairs):
    """A JSON object hook that refuses a repeated key instead of keeping the last value."""
    keys = [key for key, _ in pairs]
    if len(set(keys)) != len(keys):
        raise ValueError('Repeated key in comment ranges')
    return dict(pairs)


def well_formed_ranges(spans, length):
    """Whether `spans` is a list of `[start, end]` int pairs (no bools) with `0 <= start < end <= length`,
    sorted by start and not overlapping (one may start where the previous ends)."""
    previous = 0
    for span in spans:
        if not (isinstance(span, list) and len(span) == 2 and all(type(bound) is int for bound in span)):
            return False
        start, end = span
        if not previous <= start < end <= length:
            return False
        previous = end
    return True


def trusted_ranges(sources, output):
    """The comment ranges in the helper's stdout `output` that the scan may trust, by path.

    The whole payload is untrusted, so no file has ranges, unless it is a JSON object (no repeated
    key) whose keys are exactly `sources`' paths, each mapping to a list or null. Then a file's
    ranges are trusted only if its value is a list that `well_formed_ranges` accepts against the
    file's UTF-16 length; null (a syntax error) or a malformed list leaves that file without ranges.
    """
    payload = json.loads(output, object_pairs_hook=unique_keys)
    if not (isinstance(payload, dict) and set(payload) == set(sources) and
            all(spans is None or isinstance(spans, list) for spans in payload.values())):
        return {}
    return {name: [tuple(span) for span in spans] for name, spans in payload.items()
            if spans is not None and well_formed_ranges(spans, utf16_length(sources[name]))}


def code_imports(root, unresolved):
    """The unresolved import matches, as `(name, text, match)`, not wholly inside one comment.

    Comment ranges come from the TypeScript parser: one `node` run (canonical PATH) of `root`'s
    committed COMMENT_RANGES helper, with `root`'s node_modules/typescript, for every file here.
    The helper is under `scripts/`, so `local_runtime_files` binds it like any runtime file.
    Its stdout is the only input that waives a refusal, and only `trusted_ranges` reads it.
    Fail safe: if node, the helper or typescript is missing, the helper fails, or `trusted_ranges`
    gives a file no ranges (malformed output, the file absent, or null for a syntax error), every
    match in that file is code, so an unresolved import there is still refused.
    """
    sources = {name: text for name, text, _ in unresolved}
    ranges = {}
    if sources:
        try:
            path, _ = execution_tools(('node',), hashes=False)
            result = subprocess.run(['node', COMMENT_RANGES], cwd=root, env={**os.environ, 'PATH': path},
                                    input=json.dumps(sources), capture_output=True, text=True, check=True)
            ranges = trusted_ranges(sources, result.stdout)
        except (RuntimeError, OSError, subprocess.SubprocessError, ValueError, TypeError, AttributeError):
            ranges = {}

    def inside(name, text, match):
        start, end = (utf16_length(text[:index]) for index in match.span())
        return any(low <= start and end <= high for low, high in ranges.get(name, ()))
    return [item for item in unresolved if not inside(*item)]


def local_runtime_files(root):
    """Tracked public runtime/config families and their transitive local imports, including declarations."""
    tracked = set(git(root, 'ls-files').splitlines())
    roots = {name for name in tracked if (name.startswith(('scripts/', 'e2e/')) or
             '/' not in name and Path(name).suffix in ('.json', '.js', '.mjs', '.ts', '.yaml', '.yml'))
             and not any(part == '.private' or part.startswith('.env') for part in Path(name).parts)}
    pending, seen, unresolved = list(roots), set(), []
    while pending:
        name = pending.pop()
        if name in seen:
            continue
        seen.add(name)
        source = Path(root) / name
        require(source.is_file() and not source.is_symlink(), 'Unsafe runtime dependency: ' + name)
        if source.suffix not in ('.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'):
            continue
        text = source.read_text()
        for match in LOCAL_IMPORT.finditer(text):
            imported = match.group(1)
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
                unresolved.append((name, text, match))
            pending.extend(found)
    # Every resolving match binds, comments included; only an unresolved one in code refuses.
    refused = [name + ' -> ' + match.group(1) for name, _, match in code_imports(root, unresolved)]
    require(not refused, 'Unresolved local import: ' + '; '.join(refused))
    return seen


def runtime_dependencies(v):
    """Bind public runtime/config families and transitive local imports, including declarations.

    Declarations are readable dependencies, never executable entry points. Git tree identity
    binds all app/data files. Package resolution is separately bound to the installed lock.
    """
    paths = [Path(v['WT']) / name for name in sorted(local_runtime_files(v['WT']))]
    paths += [Path(v['WT']) / 'node_modules/.pnpm/lock.yaml']

    pending = [Path(v['ORCH']) / name for name in ('bounded.sh', 'capped.sh', 'bounded-resources.sh',
               'bounded-receipt.sh', 'slice-sampler.sh', 'resource-policy.md')]
    external = set()
    while pending:
        path = pending.pop()
        if path in external:
            continue
        external.add(path)
        text = path.read_text()
        if path.suffix == '.sh':
            pending += [Path(v['ORCH']) / name for name in re.findall(r'(?:\$here/|\$ORCH/|\$EP_ORCH/)([a-z][a-z0-9-]*\.sh)', text)]
    return [reference(path) for path in sorted(set(paths) | external)]


def freeze(v):
    root = Path(v['SNAP'])
    root.mkdir()
    entries = git(v['WT'], 'ls-tree', '-r', mapping(v)['SQUASHED'], '--', 'scripts/orchestration').splitlines()
    files = {}
    for line in entries:
        meta, path = line.split('\t')
        mode, kind, blob = meta.split()
        require(kind == 'blob' and mode in ('100644', '100755'), 'Nonregular orchestration file: ' + path)
        target = root / path.removeprefix('scripts/orchestration/')
        target.parent.mkdir(parents=True, exist_ok=True)
        content = subprocess.check_output(['git', '-C', v['WT'], 'cat-file', 'blob', blob])
        with target.open('xb') as output:
            output.write(content)
        target.chmod(int(mode, 8) & 0o777 & ~0o222)
        require(sha(Path(v['WT']) / path) == sha(target), 'Uncommitted script content')
        files[str(target.relative_to(root))] = dict(blob=blob, sourceMode=mode, mode=target.stat().st_mode & 0o777, sha256=sha(target))
    required_executables = ('land-queue.sh', 'cur-land.sh', 'codegen.sh', 'e2e-branch.sh', 'triage-failures.sh', 'land.sh')
    for name in required_executables:
        require(name in files and files[name]['mode'] & 0o111, 'Nonexecutable queue entry: ' + name)
    # Syntax-check every shell file; source only declared shell-library imports.
    for path in root.rglob('*.sh'):
        subprocess.run(['bash', '-n', str(path)], check=True)
        for name in re.findall(r'^\s*(?:\.|source) "\$here/([A-Za-z0-9_.-]+)"', path.read_text(), re.M):
            require(name in files and files[name]['mode'] & 0o444, 'Missing/unreadable sourced helper: ' + name)
            subprocess.run(['bash', '-c', 'here=$1; . "$1/$2"', 'source-check', str(root), name],
                           check=True, capture_output=True, text=True, env=child_environment(v))
    (root / 'queue.log').touch(exist_ok=False)
    path, tools = execution_tools(('bash', 'git', 'node', 'pnpm', 'python3', 'systemctl', 'docker', 'flock'))
    base_entries = git(v['MAIN'], 'ls-tree', '-r', v['BASE'], '--', 'scripts/orchestration').splitlines()
    base_files = []
    base_runtime = Path(v['E']) / 'base-runtime'
    base_runtime.mkdir()
    for line in base_entries:
        meta, name = line.split('\t');mode, kind, blob = meta.split()
        require(kind == 'blob' and mode in ('100644', '100755'), 'Unsafe base runtime file')
        raw = subprocess.check_output(['git', '-C', v['MAIN'], 'cat-file', 'blob', blob])
        require(sha(Path(v['MAIN']) / name) == hashlib.sha256(raw).hexdigest(), 'Base runtime dirty before freeze')
        destination = base_runtime / name.removeprefix('scripts/orchestration/')
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(raw);destination.chmod(int(mode, 8) & 0o777 & ~0o222)
        base_files.append(dict(path=name, blob=blob, mode=mode, frozenMode=destination.stat().st_mode & 0o777, sha256=hashlib.sha256(raw).hexdigest()))
    base_runtime.chmod(0o555)
    runtime = Path(v['E']) / 'operator-runtime'
    runtime.mkdir()
    runtime_files = {}
    # Only a lane gate imports light_lane.py; without lane the frozen closure is today's.
    lane = ('light_lane.py',) if 'lane' in load(v['CONFIG']) else ()
    for name in ('gate-operator.py', 'gate_operator.py', 'gate_core.py', 'gate_monitor.py', 'validation.py', 'workflow_evidence.py', 'remote_checks.py', *lane):
        source = HERE / name;destination = runtime / name
        if (root / name).is_file() and sha(root / name) == sha(source):
            os.link(root / name, destination)
        else:
            shutil.copyfile(source, destination);destination.chmod(0o444)
        runtime_files[name] = dict(sha256=sha(destination), mode=destination.stat().st_mode & 0o777)
    runtime.chmod(0o555)
    save(Path(v['E']) / 'snapshot.json', dict(files=files, external=runtime_dependencies(v), tools=tools,
         baseRuntime=dict(commit=v['BASE'], tree=git(v['MAIN'], 'rev-parse', v['BASE'] + '^{tree}'), entries=base_entries, files=base_files),
         operatorRuntime=runtime_files,
         environment={**{key: os.environ.get(key) for key in ('LANG', 'LC_ALL', 'TZ')}, 'PATH':path}))
    root.chmod(0o555)
    snapshot(v)


def verify_records(v, held=False):
    child = child_environment(v)
    if held:
        child['BOUNDED_HELD_LOCKS'] = 'resource curator curator2'
    with (Path(v['E']) / 'record-verification.log').open('x') as output:
        result = subprocess.run([v['ORCH'] + '/capped.sh', 'node', '--import', 'tsx', 'scripts/catalog-record-review.ts',
                                 '--verify', '--root', v['WT'], '--runs', v['ORCH'] + '/runs'],
                                cwd=v['WT'], env=child, stdout=output, stderr=subprocess.STDOUT)
    require(result.returncode == 0, 'Record receipts failed; retain actual verification output')


def prepare(v):
    config = authorization(v, full_validation=True)
    execution_control(v, step='prepare')
    reject_overrides()
    target = Path(v['E'])
    require(not target.exists(), 'Existing attempt: resume prepared state or diagnose; never overwrite')
    with preparation_locks(v):
        admission = admission_idle(v)
        verify_history(config)
        # Setup checks happen before the create-only attempt; a missing prerequisite has launched nothing.
        for item in (config['operator'], config['resourcePolicy'], config['storageBaseline']):
            verify_reference(item)
        check_identity(v, config['preparation'].get('candidate', v['REVIEWED']))
        target.mkdir()
        save(target / 'attempt.json', dict(at=now(), config=reference(v['CONFIG']), admission=admission, childLaunched=False))
        started = time.monotonic()
        try:
            # Every ref, stored once: the monitor enforces its protected subset and records moves of the rest.
            save(target / 'protected-refs.json', all_refs(v['MAIN']))
            verify_records(v, held=True)
            prepared = prepare_commit(v, config)
            freeze(v)
            from gate_monitor import observe
            baseline = observe(v, None)
            require('memory.events' in baseline['slice'], 'Missing slice resource baseline')
            save(target / 'resource-baseline.json', baseline)
            bindings = [reference(target / name) for name in ('mapping.json', 'snapshot.json', 'protected-refs.json', 'record-verification.log')]
            save(target / 'prepared.json', dict(at=now(), config=reference(v['CONFIG']), bindings=bindings,
                 elapsedSeconds=time.monotonic() - started, candidate=prepared['SQUASHED'], landingLock=landing_lock_reference(target)))
        except Exception as exc:
            save(target / 'prepare-failed.json', dict(at=now(), error=str(exc), elapsedSeconds=time.monotonic() - started))
            raise
    return prepared


def submit(v, launch=subprocess.Popen):
    """Persist the launch claim first. A lost response consumes the claim permanently."""
    preflight('submit', values=v)
    target = Path(v['E'])
    require(not (target / 'prepare-failed.json').exists(), 'Failed preparation blocks submission')
    require((target / 'prepared.json').is_file(), 'No completed preparation')
    candidate = mapping(v)['SQUASHED']
    with preparation_locks(v):
        admission_idle(v)
        check_identity(v, candidate)
        require((Path(v['SNAP']) / 'queue.log').stat().st_size == 0, 'Snapshot already executed')
        config = load(v['CONFIG'])
        if config['kind'] == 'curation':
            # Specialized prep must be reviewed and reusable; do not permit a post-review amendment. Under remote
            # checks only the remote-suite prep's receipt can be reused, otherwise only the local prep's (prep-lib.sh).
            issue = config['issue']
            require(type(issue) is int and issue > 0, 'Curation issue required')
            reuse = ['remote'] if 'remoteChecks' in config else []
            check = subprocess.run(['bash', '-c', 'here=$1; . "$here/paths.sh"; . "$here/prep-lib.sh"; prep_reusable "${@:2}"',
                                    'prep-reuse', v['SNAP'], str(issue), v['WT'], v['BASE'], *reuse], env=child_environment(v), capture_output=True, text=True)
            require(check.returncode == 0, 'Curation needs fresh specialized prep/review: ' + check.stdout + check.stderr)
        token = (f"cur/{config['issue']}@" if config['kind'] == 'curation' else '') + v['BR'] + ':' + v['WT']
        from gate_monitor import bounded_gate_memory_max
        # The unit's MemoryMax for this gate's mode; the monitor expects the same value.
        controls = dict(BOUNDED_WAIT='1', BOUNDED_WAIT_TIMEOUT='1800', BOUNDED_WORKERS='2',
                        BOUNDED_CPU='600%', BOUNDED_LOCKS='resource curator curator2',
                        BOUNDED_GATE_MEMORY_MAX=bounded_gate_memory_max(config), **runtime_controls(v))
        argv = [v['ORCH'] + '/bounded.sh', '--detach', v['LABEL'], 'gate', '/usr/bin/env',
                'MAIN=' + v['MAIN'], 'EP_ORCH=' + v['ORCH'], 'EP_REPO=' + v['WT'], 'FEATURE=' + v['FEATURE'],
                'LAND_QUEUE_SNAPSHOT=' + v['SNAP'],
                'LAND_OBSERVATION_LOCK=' + str(target / 'landing.lock'),
                'LAND_OBSERVATION_LOCK_ID=' + str(load(target / 'prepared.json')['landingLock']['device']) + ':' + str(load(target / 'prepared.json')['landingLock']['inode']),
                'TRIAGE_EVIDENCE=' + v['E'] + '/triage-evidence',
                # The queue's scratch checkouts record their paths here before they exist (paths.sh).
                'GATE_SCRATCH_WORKTREES=' + str(target / SCRATCH_RECORD),
                *remote_argv(v, config),
                *lane_argv(v, config),
                v['SNAP'] + '/land-queue.sh', token]
        save(target / 'submission-claim.json', dict(at=now(), argv=argv, controls=controls, candidate=candidate,
             label=v['LABEL'], attempt=v['E'], main=v['MAIN'], orch=v['ORCH']))
    started = time.monotonic()
    parsed = []
    try:
        with (target / 'submission.log').open('x') as output:
            process = launch(argv, env={**child_environment(v), **controls}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            with process.stdout as lines:
                for line in lines:
                    output.write(line)
                    output.flush()
                    match = re.search(r'unit: ([^;]+); log: ([^;]+); id: (\S+)', line)
                    if match:
                        unit, log, invocation_id = match.groups()
                        parsed.append(dict(unit=unit, log=log, id=invocation_id, candidate=candidate))
                        if len(parsed) == 1:
                            save(target / 'owned-invocation.json', dict(**{**parsed[0], 'id':unit.removeprefix('ep-fresh-')}, claim=reference(target / 'submission-claim.json')))
                            owned_invocation(v)
                            save(target / 'submission.json', parsed[0])
            code = process.wait()
        save(target / 'submit-result.json', dict(exitCode=code, at=now(), elapsedSeconds=time.monotonic() - started, identities=len(parsed)))
        require(code == 0 and len(parsed) == 1, 'Ambiguous/failed submit: inspect canonical state; never submit twice')
        return submission(v)
    except Exception as exc:
        save(target / 'submit-failed.json', dict(at=now(), error=str(exc), retry=False))
        stop_owned(v, 'Submission failed: ' + str(exc))
        raise


def remote_argv(v, config):
    """Queue inputs travel as argv (reject_overrides refuses ambient LAND_*); none without remoteChecks."""
    remote = config.get('remoteChecks')
    if remote is None:
        return []
    return ['LAND_REMOTE_CHECKS=' + remote['path'], 'LAND_REMOTE_CHECKS_SHA256=' + remote['sha256'],
            'LAND_REMOTE_CHECKS_MODE=' + remote['mode'], 'LAND_REMOTE_EVIDENCE=' + v['E'] + '/remote-evidence']


def lane_argv(v, config):
    """The light landing lane as queue argv; none without lane."""
    if 'lane' not in config:
        return []
    return ['LAND_LANE=light', 'LAND_LIGHT_EVIDENCE=' + v['E'] + '/light-evidence']


def light_verified(v, lane):
    """The queue verified the lane for the landed candidate before landing; re-prove it from Git objects."""
    from light_lane import RULE, verify
    candidate = mapping(v)['SQUASHED']
    record = load(Path(v['E']) / 'light-evidence/light-verification.json')
    paths = lambda value: [row.get('path') for row in value.get('paths', [])]
    require(record.get('passed') is True and record.get('rule') == RULE and record.get('base') == v['BASE']
            and record.get('commit') == candidate and record.get('tree') == v['TREE'], 'Light verification does not bind this candidate')
    require(paths(record) == lane['paths'], 'Light verification path list mismatch')
    require(paths(verify(v['WT'], v['BASE'], candidate)) == lane['paths'], 'Light lane re-verification path list mismatch')
    return True


def remote_record(v, remote, name):
    record = load(Path(v['E']) / 'remote-evidence' / name)
    require(record.get('passed') is True and record.get('manifest') == dict(path=remote['path'], sha256=remote['sha256']),
            'Remote ' + name + ' did not pass for the configured manifest')
    return record


def remote_verified(v, remote):
    """The queue verified this manifest against the landed candidate before landing."""
    record = remote_record(v, remote, 'remote-verification.json')
    require(record.get('candidate') == mapping(v)['SQUASHED'] and record.get('tree') == v['TREE']
            and record.get('base') == v['BASE'], 'Remote verification does not bind this candidate')
    return True


def remote_compared(v, remote):
    from remote_checks import AUDITS, compare_reports
    local, listed = Path(v['E']) / 'triage-evidence/full.json', Path(v['WT']) / AUDITS
    record = remote_record(v, remote, 'remote-comparison.json')
    require(record.get('local') == reference(local), 'Remote comparison does not bind the local suite')
    require(record.get('hostAudits') == reference(listed), "Remote comparison does not bind the candidate's host-audit list")
    compare_reports(remote['path'], remote['sha256'], v['ORCH'], local, listed)
    return True


def remote_original_suite(v, remote):
    """replace: the remote suite, all green but for listed host-audit skips (remote_checks.suite)."""
    from remote_checks import load as load_manifest, remote_suite
    remote_suite(load_manifest(remote['path'], remote['sha256'], v['ORCH']), remote['path'], v['WT'])
    return True


def host_audited(v, remote):
    """replace: the queue's host-audits.sh verdict, re-judged from its recorded list and report."""
    from remote_checks import bound_audits, host_audit_report, load as load_manifest
    record = remote_record(v, remote, 'host-audits.json')
    for key in ('list', 'report'):
        verify_reference(record.get(key))
    require(record.get('exitCode') == 0, 'Host-audit run did not exit 0')
    listed = bound_audits(record['list']['path'], load_manifest(remote['path'], remote['sha256'], v['ORCH']))
    host_audit_report(listed, record['report']['path'], record.get('root'))
    return True


def remote_references(v, remote):
    from remote_checks import load as load_manifest
    manifest = load_manifest(remote['path'], remote['sha256'], v['ORCH'])
    directory = Path(remote['path']).parent
    declared = [dict(path=remote['path'], sha256=remote['sha256'])]
    declared += [dict(path=str(directory / row[key]['file']), sha256=row[key]['sha256'])
                 for row in manifest['commands'] + ([manifest['workflow']] if 'workflow' in manifest else [])
                 for key in ('log', 'report') if key in row]
    for item in declared:
        verify_reference(item)  # The digest Boat declared and the queue verified, never a fresh re-hash.
    return [*declared, *(reference(path) for path in sorted((Path(v['E']) / 'remote-evidence').glob('*.json')))]


def canonical_receipt_path(v, invocation):
    return Path(v['ORCH']) / 'bounded' / invocation['id'] / 'receipt.json'


def stop_owned(v, reason):
    """Never rediscover ownership through the validation path that just failed."""
    target = Path(v['E'])
    ownership = target / 'owned-invocation.json'
    known = owned_invocation(v) if ownership.exists() else None
    if known and canonical_receipt_path(v, known).exists():
        return known
    if not (target / 'stop-reason.json').exists():
        save(target / 'stop-reason.json', dict(at=now(), error=reason, ownership=reference(ownership) if ownership.is_file() else None))
    if not ownership.exists():
        return None  # No proven returned identity; retain ambiguous claim for inspection.
    known = owned_invocation(v)
    if not canonical_receipt_path(v, known).exists():
        subprocess.run(['systemctl', '--user', 'stop', '--no-block', known['unit']], check=True)
    return known


def collect(v):
    """Reference canonical facts once. A failed receipt stays failed even if Git later moves."""
    target = Path(v['E'])
    invocation = owned_invocation(v)
    receipt_path = canonical_receipt_path(v, invocation)
    require(receipt_path.is_file(), 'Still active/missing receipt: observe the same invocation')
    if (target / 'result.json').exists():
        result = load(target / 'result.json')
        for item in result['evidence']:
            verify_reference(item)
        return result
    checks, errors = {}, []
    try:
        receipt = load(receipt_path)
    except Exception as exc:
        receipt = {}
        errors.append(dict(check='canonicalReceipt', error=str(exc)))
    def check(name, operation):
        try:
            checks[name] = operation() is not False
        except Exception as exc:
            checks[name] = False
            errors.append(dict(check=name, error=str(exc)))
    check('canonicalReceipt', lambda: receipt_ok(receipt, invocation))
    check('submissionBinding', lambda: submission(v))
    try:
        preflight('collect', values=v)
        checks['frozenInputs'] = True
    except (PauseRequested, CollectorContextMismatch) as exc:
        marked = any((target / name).exists() for name in ('stop-reason.json', 'observer-failure.json', 'submit-failed.json', 'prepare-failed.json'))
        if checks['canonicalReceipt'] and checks['submissionBinding'] and not marked:
            return dict(deferred=True, nextPhase='collect', reason=str(exc))
        checks['frozenInputs'] = False
        errors.append(dict(check='frozenInputs', error=str(exc)))
    except Exception as exc:
        checks['frozenInputs'] = False
        errors.append(dict(check='frozenInputs', error=str(exc)))
    check('historicalEvidence', lambda: verify_history(load(v['CONFIG'])))
    check('terminalIntegrity', lambda: terminal_integrity(target))
    try:
        remote = load(v['CONFIG']).get('remoteChecks')
        lane = load(v['CONFIG']).get('lane')
    except Exception:
        remote = lane = None  # frozenInputs and historicalEvidence already fail on an unreadable config.
    replace = remote is not None and remote.get('mode') == 'replace'
    if lane is not None:
        check('lightLane', lambda: light_verified(v, lane))
    else:
        check('originalSuite', lambda: remote_original_suite(v, remote) if replace else original_suite(target / 'triage-evidence/full.json'))
    if remote is not None:
        check('remoteChecks', lambda: remote_verified(v, remote))
        if replace:
            check('hostAudits', lambda: host_audited(v, remote))
        else:
            check('remoteComparison', lambda: remote_compared(v, remote))
    check('checkedLanding', lambda: git(v['MAIN'], 'rev-parse', 'HEAD') == mapping(v)['SQUASHED'])
    check('noStoppedAttempt', lambda: not any((target / name).exists() for name in ('stop-reason.json', 'observer-failure.json', 'submit-failed.json', 'prepare-failed.json')))
    from gate_monitor import guard_cleanup
    try:
        resources, guards = scan_resources(v, invocation, target)
    except Exception as exc:
        resources, guards = (lambda: False), []
        errors.append(dict(check='resourceObservations', error=str(exc)))
    check('resources', resources)
    cleanup = None
    try:
        cleanup = guard_cleanup(guards)
        checks['observedCleanup'] = cleanup['passed']
        save(target / 'cleanup.json', cleanup)
    except Exception as exc:
        checks['observedCleanup'] = False
        errors.append(dict(check='observedCleanup', error=str(exc)))
    references = [reference(receipt_path)]
    for path in (Path(invocation['log']), Path(v['SNAP']) / 'queue.log'):
        check('log:' + str(path), lambda path=path: references.append(reference(path)))
    for name in ('resource-progress.jsonl', 'integrity-progress.jsonl', 'resource-baseline.json', 'cleanup.json'):
        check('evidence:' + name, lambda name=name: references.append(reference(target / name)))
    for path in sorted((target / 'triage-evidence').glob('*.json')):
        check('triageEvidence:' + str(path), lambda path=path: references.append(reference(path)))
    if remote is not None:
        check('remoteEvidence', lambda: references.extend(remote_references(v, remote)))
    for path in sorted((target / 'light-evidence').glob('*.json')) if lane is not None else ():
        check('lightEvidence:' + str(path), lambda path=path: references.append(reference(path)))
    value = dict(at=now(), passed=all(checks.values()) and not errors, checks=checks, errors=errors,
                 invocation=reference(target / 'owned-invocation.json'), evidence=references,
                 cleanup=reference(target / 'cleanup.json') if cleanup is not None else None,
                 timing=dict(queueElapsedSeconds=receipt_elapsed(receipt)))
    if remote is not None:
        value['suite'] = dict(source='remote+host-audits' if replace else 'local+remote-compare',
                              manifest=dict(path=remote.get('path'), sha256=remote.get('sha256')))
        audits = target / 'remote-evidence/host-audits.json'
        if replace:
            value['suite']['hostAudits'] = reference(audits) if audits.is_file() else None
    if lane is not None:
        value['suite'] = dict(source='none', lane='light', rule=lane.get('rule'))
    save(target / 'result.json', value)
    return value


def receipt_elapsed(receipt):
    from datetime import datetime
    try:
        return (datetime.fromisoformat(receipt['endedAt'].replace('Z', '+00:00')) -
                datetime.fromisoformat(receipt['startedAt'].replace('Z', '+00:00'))).total_seconds()
    except (KeyError, TypeError, ValueError):
        return None


def load_line(line):
    import json
    return json.loads(line)


def scan_resources(v, invocation, target):
    """resource-progress.jsonl in one streamed pass, one row in memory at a time: observer rows carried every
    ref (about 1 MB on the real repository) until 2026-11-07, so a long local suite's file ran to gigabytes
    and never fit the 2 GiB driver unit whole (waves 1-2 correction gate, 2026-11-06). Returns the
    `resources` check and the guard records guard_cleanup reads, with the whole-file read's results
    (CollectionEquivalenceTest): no row of this invocation violates, judged in order up to the first
    violation, and some row counted the unit's memory events; the first error either part met is the
    check's error. A row that cannot be parsed raises here: the observations are unusable."""
    from gate_monitor import ArchiveLedger, violations
    judged = dict(verdict=True, failure=None, counted=False, count_failure=None)
    guards = []
    ledger = ArchiveLedger()  # rows are judged in order, so archives added during the gate stay protected
    with (target / 'resource-progress.jsonl').open() as stream:
        for line in stream:  # universal newlines, as splitlines read the file whole
            row = resource_row(line)
            guards.append(({'guard': row['guard']} if 'guard' in row else {}) if isinstance(row, dict) else row)
            judge_row(judged, row, lambda row: violations(v, invocation, mapping(v), load(target / 'resource-baseline.json'), row, ledger))
    def resources():
        if judged['failure'] is not None:
            raise judged['failure']
        if not judged['verdict']:
            return False
        if judged['count_failure'] is not None:
            raise judged['count_failure']
        return judged['counted']
    return resources, guards


def resource_row(line):
    """One observer row; a line that does not parse raises the error the line without its newline gives."""
    try:
        return load_line(line)
    except ValueError:
        return load_line(line[:-1] if line.endswith('\n') else line)


def judge_row(judged, row, violates):
    """One row into the running `resources` verdict, in the whole-file read's order: the violation check runs
    until the first violation or error; the memory-events count until the first counted row or error."""
    if judged['verdict'] and judged['failure'] is None:
        try:
            if row.get('invocationId') and violates(row):
                judged['verdict'] = False
        except Exception as exc:
            judged['failure'] = exc
    if not judged['counted'] and judged['count_failure'] is None:
        try:
            judged['counted'] = 'memory.events' in row.get('unit', {})
        except Exception as exc:
            judged['count_failure'] = exc


def terminal_integrity(target):
    rows = [load_line(line) for line in (target / 'integrity-progress.jsonl').read_text().splitlines()]
    require(rows and rows[-1].get('stage') == 'terminal' and rows[-1].get('passed') is True, 'Fresh terminal integrity missing')
    return True


def completed(v):
    target = Path(v['E'])
    prior = load(target / 'completion.json')
    verify_reference(prior['result'])
    result = load(prior['result']['path'])
    require(prior.get('passed') is True and result.get('passed') is True, 'Failed completion cannot resume')
    for item in result['evidence']:
        verify_reference(item)
    require(receipt_ok(load(canonical_receipt_path(v, owned_invocation(v))), submission(v)), 'Canonical receipt no longer qualifies')
    return dict(passed=True, alreadyCompleted=True, evidence=reference(target / 'completion.json'))


def complete(v):
    target = Path(v['E'])
    if (target / 'completion.json').exists():
        return completed(v)
    preflight('complete', values=v)
    result = load(target / 'result.json')
    require(result.get('passed') is True and all(result['checks'].values()) and not result['errors'], 'Failed result cannot finalize')
    require(not any((target / name).exists() for name in ('stop-reason.json', 'observer-failure.json', 'submit-failed.json', 'prepare-failed.json')), 'Stopped attempt cannot finalize')
    invocation = submission(v)
    receipt = load(Path(v['ORCH']) / 'bounded' / invocation['id'] / 'receipt.json')
    require(receipt_ok(receipt, invocation), 'Canonical receipt no longer qualifies')
    for item in result['evidence']:
        verify_reference(item)
    require(git(v['MAIN'], 'rev-parse', 'HEAD') == mapping(v)['SQUASHED'], 'Checked landing absent')
    config = load(v['CONFIG'])
    remote, proof = config.get('remoteChecks'), config.get('rebaseProof')
    scope = 'Authorized strict local queue and checked completion only; no Cloud/GitHub/promotion qualification'
    if remote is not None:
        audits = " plus the gate host's host audits" if remote['mode'] == 'replace' else ''
        scope = ('Authorized strict local queue with the verified remote heavy-check suite ' + remote['path'] + ' (' + remote['mode'] +
                 ')' + audits + ' and checked completion only; no Cloud/GitHub/promotion qualification')
    if config.get('lane') is not None:
        scope = ('Authorized light landing lane (every changed path is outside the full queue\'s pinned inputs under rule light-lane-v1, '
                 'bounded risk, owner 2026-11-01; codegen, pin, typecheck, lint, the full suite and the e2e preflight not run) '
                 'and checked completion only; no Cloud/GitHub/promotion qualification')
    if proof is not None:
        scope += '; reviews accepted at ' + proof['accepted'] + ' on ' + proof['oldBase'] + ' carried by the mechanical-rebase proof'
    carry = config.get('carriedReview')
    if carry is not None:
        fix = 'standards' if carry['axis'] == 'spec' else 'spec'
        scope += ('; ' + carry['axis'] + ' review accepted at ' + carry['commit'] + ' carried over the ' + fix + ' review of ' +
                  carry['commit'] + '..' + config['reviews'][fix]['commit'] + ' by attestation ' + carry['attestation']['path'])
    land = config.get('conditionalLand')
    if land is not None:
        repaired = ([] if not land['paths'] else ['paths ' + str(land['paths'])]) + (['the commit message'] if land['message'] else [])
        scope += ('; ' + ' and '.join(land['axes']) + ' review accepted at ' + land['commit'] + ' with a conditional LAND, repaired to ' +
                  (proof['accepted'] if proof is not None else v['REVIEWED']) + ' (' + ' and '.join(repaired) + ') by attestation ' +
                  land['attestation']['path'])
    save(target / 'completion.json', dict(at=now(), passed=True, result=reference(target / 'result.json'), scope=scope))
    return dict(passed=True, evidence=reference(target / 'completion.json'))


def run(v, resume=False):
    target = Path(v['E'])
    try:
        if (target / 'completion.json').exists():
            return completed(v)
        if not resume and not (target / 'prepared.json').exists():
            prepare(v)
        require((target / 'prepared.json').is_file(), 'No completed preparation; diagnose retained partial attempt')
        if globals().get('CLI_BOOTSTRAP') and HERE != target / 'operator-runtime':
            os.execv(sys.executable, [sys.executable, '-B', str(target / 'operator-runtime/gate-operator.py'), 'resume'])
        if (target / 'result.json').exists():
            prior = load(target / 'result.json')
            require(prior['passed'], 'Failed attempt cannot resume; retain diagnosis before a fresh attempt')
            return complete(v) if 'complete' in load(v['CONFIG'])['phases'] else prior
        if not (target / 'submission-claim.json').exists():
            submit(v)
        else:
            require((target / 'submission.json').is_file() and (target / 'submit-result.json').is_file()
                    and not (target / 'submit-failed.json').exists(), 'Unknown/failed submission; inspect the same invocation, never resubmit')
        invocation = submission(v)
        if canonical_receipt_path(v, invocation).is_file():
            # A fresh collector session must not turn its own context mismatch into
            # a new observer failure for an already terminal invocation.
            try:
                snapshot(v)
                execution_control(v, step='collect')
            except (PauseRequested, CollectorContextMismatch):
                return collect(v)
        execution_control(v, step='observe')
        require(not (target / 'stop-reason.json').exists(), 'Stopped attempt cannot resume')
        observed = subprocess.run([v['ORCH'] + '/capped.sh', sys.executable, '-B', str(target / 'operator-runtime' / 'gate_monitor.py')],
                                  env={**child_environment(v), 'CAPPED_KIND': 'light'})
        if observed.returncode != 0:
            if not (target / 'observer-failure.json').exists():
                save(target / 'observer-failure.json', dict(at=now(), exitCode=observed.returncode))
            raise RuntimeError('Observer failed; preserve same invocation and collected failure when terminal')
        result = load(target / 'result.json') if (target / 'result.json').exists() else collect(v)
        if result.get('deferred'):
            return result
        require(result['passed'], 'Failed gate collected; no successful completion or retry')
        if 'complete' in load(v['CONFIG'])['phases'] and not (target / 'completion.json').exists():
            return complete(v)
        return result
    except PauseRequested as pause:
        # A healthy terminal invocation is retained; continuation needs active authority.
        known = owned_invocation(v) if (target / 'owned-invocation.json').exists() else None
        if known and not canonical_receipt_path(v, known).exists():
            stop_owned(v, 'Phase authority ended before terminal observation')
            if canonical_receipt_path(v, known).exists() and not (target / 'result.json').exists():
                collect(v)
            raise RuntimeError('Pause cannot abandon an active invocation')
        if known and canonical_receipt_path(v, known).exists() and not (target / 'result.json').exists():
            return collect(v)
        return dict(paused=True, nextPhase=pause.phase)
    except BaseException as exc:
        if (target / 'submission-claim.json').exists():
            try:
                known = stop_owned(v, str(exc))
                if known and canonical_receipt_path(v, known).exists() and not (target / 'result.json').exists():
                    collect(v)
            except Exception as cleanup_error:
                if not (target / 'recovery-error.json').exists():
                    save(target / 'recovery-error.json', dict(at=now(), error=str(cleanup_error)))
        raise


def main():
    require(len(sys.argv) == 2, 'Use prepare|run|resume|collect|complete|cancel')
    mode = sys.argv[1]
    require(mode in ('prepare', 'run', 'resume', 'collect', 'complete', 'cancel'), 'Unknown operator phase')
    if mode not in ('collect', 'cancel'):
        reject_overrides()
    v = env()
    external_path(load(v['CONFIG'])['control'], v['MAIN'], v['ORCH'])
    if mode == 'cancel':
        known = stop_owned(v, 'Explicit cancellation')
        result = collect(v) if known and canonical_receipt_path(v, known).exists() and not (Path(v['E']) / 'result.json').exists() else dict(cancelled=True)
    else:
        # Sequence forward work once; safety cancellation does not wait for this lock.
        with lock(str(Path(v['E']).parent / (Path(v['E']).name + '.operator.lock'))):
            if mode in ('run', 'resume'):
                result = run(v, resume=mode == 'resume')
            else:
                result = {'prepare': prepare, 'collect': collect, 'complete': complete}[mode](v)
    import json
    print(json.dumps(result))
    if result.get('passed') is False:
        sys.exit(1)

