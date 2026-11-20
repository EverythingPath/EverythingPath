#!/usr/bin/env python3
"""Select the immutable attempt runtime before importing any operational module.

Start prepare/run from MAIN; retain `runtime`'s absolute entry for later commands.
"""
import hashlib
import json
import os
from pathlib import Path
import sys

RUNTIME = ('gate-operator.py', 'gate_operator.py', 'gate_core.py', 'gate_monitor.py',
           'validation.py', 'workflow_evidence.py', 'remote_checks.py', 'light_lane.py')
# Attempts frozen before the light lane, or before remote heavy checks, keep their own complete closure.
CLOSURES = (set(RUNTIME), set(RUNTIME) - {'light_lane.py'}, set(RUNTIME) - {'light_lane.py', 'remote_checks.py'})


def read(path):
    if not path.is_file() or path.is_symlink():
        raise RuntimeError('Missing/nonregular runtime input: ' + str(path))
    return json.loads(path.read_text())


def binding(item, path):
    if item['path'] != str(path) or path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        raise RuntimeError('Frozen runtime binding changed: ' + str(path))


def select():
    config_path = Path(os.environ['GATE_CONFIG'])
    config = read(config_path)
    attempt = Path(config['attempt'])
    orch, main = Path(config['orch']).resolve(), Path(config['main']).resolve()
    if (not config_path.is_absolute() or config_path.resolve() != config_path
            or not config_path.is_relative_to(orch) or config_path.is_relative_to(main)
            or not attempt.is_absolute() or attempt.resolve() != attempt
            or not attempt.is_relative_to(orch) or attempt.is_relative_to(main)):
        raise RuntimeError('Use canonical external attempt/config paths')
    prepared_path = attempt / 'prepared.json'
    if not prepared_path.exists():
        if (attempt / 'operator-runtime').exists():
            raise RuntimeError('Incomplete preparation: diagnose retained attempt')
        return Path(__file__).resolve().parent
    prepared = read(prepared_path)
    binding(prepared['config'], config_path)
    snapshot = attempt / 'snapshot.json'
    matches = [item for item in prepared['bindings'] if item['path'] == str(snapshot)]
    if len(matches) != 1:
        raise RuntimeError('Missing frozen runtime manifest binding')
    binding(matches[0], snapshot)
    manifest = read(snapshot)['operatorRuntime']
    if set(manifest) not in CLOSURES:
        raise RuntimeError('Incomplete frozen operator import closure')
    runtime = attempt / 'operator-runtime'
    if runtime.is_symlink() or {path.name for path in runtime.iterdir()} != set(manifest):
        raise RuntimeError('Frozen operator runtime file set changed')
    for name, expected in manifest.items():
        path = runtime / name
        binding(dict(path=str(path), sha256=expected['sha256']), path)
        if path.stat().st_mode & 0o777 != expected['mode']:
            raise RuntimeError('Frozen operator runtime mode changed: ' + name)
    return runtime


if __name__ == '__main__':
    try:
        runtime = select()
        if sys.argv[1:] == ['runtime']:
            if runtime != Path(json.loads(Path(os.environ['GATE_CONFIG']).read_text())['attempt']) / 'operator-runtime':
                raise RuntimeError('Prepare before selecting the stable runtime entry')
            print(runtime / 'gate-operator.py')
        else:
            sys.path[0] = str(runtime)
            import gate_operator
            gate_operator.CLI_BOOTSTRAP = True
            gate_operator.main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
