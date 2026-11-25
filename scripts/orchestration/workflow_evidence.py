"""Small file/Git contracts shared by validation receipts and the local gate operator."""
import contextlib
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


class CollectorContextMismatch(RuntimeError):
    """This caller cannot validate in the frozen public environment."""


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    path = Path(path)
    require(path.is_file() and not path.is_symlink(), 'Missing/nonregular input: ' + str(path))
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def parse_json(text):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'Duplicate JSON field: ' + key)
            result[key] = value
        return result
    return json.loads(text, object_pairs_hook=unique)


def read_json(path):
    return parse_json(public_path(path).read_text())


def create_json(path, value):
    """Create-only publication: a partial write cannot appear as a completed receipt."""
    path = Path(path)
    temporary = path.with_name(path.name + '.pending')
    with temporary.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    os.link(temporary, path)
    temporary.unlink()


def command(argv, **kwargs):
    return subprocess.check_output(list(map(str, argv)), text=True, **kwargs).strip()


def git(root, *args):
    return command(['git', '-C', root, *args], env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})


def identity(root):
    return dict(commit=git(root, 'rev-parse', 'HEAD'), tree=git(root, 'rev-parse', 'HEAD^{tree}'),
                branch=git(root, 'symbolic-ref', '--short', 'HEAD'),
                worktree=str(Path(root).resolve()), status=git(root, 'status', '--porcelain=v1', '--untracked-files=all'))


def reference(path):
    return dict(path=str(Path(path).resolve()), sha256=digest(path))


def verify_reference(value):
    public_path(value['path'])
    require(digest(value['path']) == value['sha256'], 'Evidence/input changed: ' + value['path'])


def public_path(path):
    require(not any(part == '.private' or part.startswith('.env') and part != '.env.example'
                    for part in Path(path).parts), 'Private input refused: ' + str(path))
    return Path(path)


def external_path(path, main, orch):
    path = Path(path)
    require(path.is_absolute() and path.resolve() == path, 'Use canonical absolute external path: ' + str(path))
    roots = [Path(orch).resolve(), Path(main).resolve().parent / '.ep-tmp']
    require(any(root in path.parents for root in roots), 'Path outside shared run/scratch: ' + str(path))
    checkouts = [Path(line[9:]).resolve() for line in git(main, 'worktree', 'list', '--porcelain').splitlines()
                 if line.startswith('worktree ')]
    require(not any(path == root or root in path.parents for root in checkouts), 'Evidence inside checkout')
    require(Path('/tmp') not in path.parents, 'Use the external run TMPDIR')
    return public_path(path)


@contextlib.contextmanager
def lock(path):
    with Path(path).open('a+') as stream:
        fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def receipt_ok(receipt, invocation):
    require(receipt.get('id') == invocation['id'] and receipt.get('unit') == invocation['unit']
            and receipt.get('log') == invocation['log'], 'Canonical receipt identity mismatch')
    return receipt.get('outcome') == 'ok' and type(receipt.get('exitCode')) is int and receipt['exitCode'] == 0


@contextlib.contextmanager
def landing_read(values):
    """Observe a coherent MAIN while the queue's checked fast-forward holds the writer lock.

    Ten seconds is the existing observation-loss boundary, not a waiver for a slow merge.
    The foreground observer still fails closed if it cannot obtain a coherent observation.
    """
    attempt = Path(values['E'])
    if not attempt.is_dir():
        yield
        return
    path = attempt / 'landing.lock'
    with path.open('a+') as stream:
        prepared_path = attempt / 'prepared.json'
        if prepared_path.is_file():
            expected = read_json(prepared_path)['landingLock']
            actual = os.fstat(stream.fileno())
            require(expected == dict(path=str(path), device=actual.st_dev, inode=actual.st_ino), 'Landing observation lock changed')
        deadline = time.monotonic() + 10
        while True:
            try:
                fcntl.flock(stream, fcntl.LOCK_SH | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                require(time.monotonic() < deadline, 'Landing observation unavailable for 10 seconds')
                time.sleep(0.01)
        yield


def landing_lock_reference(attempt):
    path = Path(attempt) / 'landing.lock'
    path.touch(exist_ok=True)
    value = path.stat()
    return dict(path=str(path), device=value.st_dev, inode=value.st_ino)


def execution_tools(names, hashes=True):
    """Pin effective tools and execute with their directories plus standard utilities.

    Unused session PATH entries carry no execution meaning. A shadowed required tool
    changes its resolved path/hash (and is rejected), rather than being ignored.
    """
    import shutil
    selected = {}
    directories = []
    for name in names:
        found = shutil.which(name)
        require(found is not None, 'Missing runtime tool: ' + name)
        entry = Path(found).absolute()
        selected[name] = entry.resolve()
        directories.append(str(entry.parent))
    selected_dirs = set(directories)
    ordered = [str(Path(part or '.').absolute()) for part in os.environ.get('PATH', os.defpath).split(os.pathsep)]
    path = os.pathsep.join(dict.fromkeys([*(part for part in ordered if part in selected_dirs), *os.defpath.split(os.pathsep)]))
    for name, expected in selected.items():
        actual = shutil.which(name, path=path)
        require(actual is not None and Path(actual).resolve() == expected, 'Canonical PATH changes resolution: ' + name)
    return path, {name: dict(path=str(tool), sha256=digest(tool) if hashes else None) for name, tool in selected.items()}
