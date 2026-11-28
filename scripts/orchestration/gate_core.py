"""Bindings for one parameterized local queue attempt; historical bundles are read-only."""
import collections
import contextlib
import functools
import json
import os
from pathlib import Path
import re
import hashlib
import shutil
import subprocess
import tempfile
from typing import NamedTuple
from workflow_evidence import (command, create_json as save, digest as sha, external_path,
                               git, identity, now, public_path, read_json as load,
                               reference, verify_reference, landing_read, execution_tools, CollectorContextMismatch)

PHASES = ('prepare', 'submit', 'observe', 'collect', 'complete', 'checked-land')
OVERRIDE_PREFIXES = ('BOUNDED_', 'ADMISSION_', 'CAPPED_', 'PAIR_', 'LAND_', 'TRIAGE_', 'VITEST_', 'TEST_', 'OPS_')


def reject_overrides():
    allowed = {'BOUNDED_WORKERS': '2', 'BOUNDED_CPU': '600%'}
    bad = [key for key in os.environ if (key.startswith(OVERRIDE_PREFIXES) and
           (key not in allowed or os.environ[key] != allowed[key])) or
           key in ('NODE_OPTIONS', 'PYTHONPATH', 'PYTHONHOME', 'CONVEX_DEPLOYMENT', 'CONVEX_DEPLOY_KEY', 'CONVEX_DEPLOYMENT_TOKEN')]
    require(not bad, 'Injected resource/runtime override: ' + ', '.join(sorted(bad)))


def env():
    config_path = Path(os.environ['GATE_CONFIG'])
    require(config_path.is_absolute(), 'GATE_CONFIG must be absolute')
    config = load(config_path)
    require(config.get('version') == 1 and config.get('kind') in ('code', 'curation'), 'Unsupported gate config')
    mapping = dict(MAIN='main', ORCH='orch', WT='worktree', BR='branch', FEATURE='feature',
                   BASE='base', REVIEWED='reviewed', TREE='tree', E='attempt', LABEL='label')
    values = {key: config[name] for key, name in mapping.items()}
    require(all(isinstance(value, str) and value for value in values.values()), 'Incomplete gate config')
    for key in ('BASE', 'REVIEWED', 'TREE'):
        require(re.fullmatch('[0-9a-f]{40}', values[key]), 'Full Git identity required: ' + key)
    require(re.fullmatch('[a-z0-9-]+', values['LABEL']), 'Unsafe invocation label')
    external_path(config_path, values['MAIN'], values['ORCH'])
    external_path(values['E'], values['MAIN'], values['ORCH'])
    for key in ('MAIN', 'ORCH', 'WT'):
        require(str(Path(values[key]).resolve()) == values[key], 'Canonical absolute path required: ' + key)
    values.update(CONFIG=str(config_path), SNAP=values['E'] + '/queue-snapshot',
                  ARCHIVE=config['preparation']['archive'],
                  S=values['WT'] + '/scripts/orchestration',
                  STORAGE_BASELINE=config['storageBaseline']['path'], BUNDLE=str(Path(__file__).resolve().parent))
    return values


def task_options(task):
    options = task.get('options')
    if isinstance(options, list):
        require(len({item['id'] for item in options}) == len(options), 'Duplicate task option')
        options = {item['id']: item['value'] for item in options}
    require(isinstance(options, dict), 'Actual task options missing')
    return options



class ProofRefusal(RuntimeError):
    """One of this module's own named refusals (require), which regen_file passes through with its text."""


def require(condition, message):
    """workflow_evidence.require's contract (a RuntimeError with MESSAGE), as a ProofRefusal."""
    if not condition:
        raise ProofRefusal(message)

class PauseRequested(RuntimeError):
    """A valid phase boundary waits for continuing authority without failing evidence."""

    def __init__(self, phase, message='Paused after authorized current phase'):
        super().__init__(message)
        self.phase = phase


def git_bytes(root, *args):
    """Exact Git output for byte comparison (`git()` decodes and strips), in the same lock-free environment."""
    return subprocess.check_output(['git', '-C', str(root), *args], env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})


def git_holds(root, *args):
    """A Git predicate's exit status, without raising."""
    return subprocess.run(['git', '-C', str(root), *args], env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'},
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def all_refs(root):
    """Every ref in the repository, {refname: object}."""
    return dict(line.split(' ', 1)[::-1] for line in git(root, 'for-each-ref', '--format=%(objectname) %(refname)').splitlines())


# Automatic Git maintenance (operations.md#protected-refs). Workers commit and fetch while a gate runs, so the
# object-store maintenance that could start without anyone choosing it is automatic: `git maintenance run --auto`
# after a commit, merge, fetch or rebase (maintenance.auto), `git gc --auto` and its heuristics, receive.autogc
# included (gc.auto=0 turns them all off), and scheduled maintenance (`git maintenance start`: a systemd user
# timer or a crontab line runs `git for-each-repo --config=maintenance.repo`; maintenance.auto does not cover
# it). Git resolves both settings per worktree (config.worktree, includeIf gitdir and onbranch, the user and
# system layers), so a gate reads the effective values in MAIN and in every one of its worktrees, on every row
# (gate-modes.md#protected-refs, root ruling, fix r2).
MAINTENANCE_OFF = (('gc.auto', 'int', '0'), ('maintenance.auto', 'bool', 'false'))
MAINTENANCE_FIX = ('git -C MAIN config gc.auto 0; git -C MAIN config maintenance.auto false; '
                   'and remove any override in the worktree named')
TIMER_PATTERN = 'git-maintenance@*'


def git_run(root, *args):
    return subprocess.run(['git', '-C', str(root), *args], env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'},
                          capture_output=True, text=True)


# The attempt's own scratch checkouts (triage-failures.sh, host-audits.sh) append their exact paths to this file
# in the attempt directory before `git worktree add` creates them (paths.sh record_scratch_worktree; the operator
# names it in GATE_SCRATCH_WORKTREES). Only those paths may be unresolved worktree entries (root ruling, fix r3).
SCRATCH_RECORD = 'scratch-worktrees.txt'


def scratch_worktrees(attempt):
    """The realpaths the attempt recorded for its own scratch checkouts; none before the queue records one."""
    path = Path(attempt) / SCRATCH_RECORD
    if not path.is_file():
        return []
    return sorted({os.path.realpath(line) for line in path.read_text().splitlines() if line.startswith('/')})


def maintenance_reading(root, attempt=None):
    """MAIN's automatic-maintenance reading: each worktree's effective settings and every scheduled run. The
    attempt's recorded scratch checkouts (scratch_worktrees of ATTEMPT; none without one) are the only worktrees
    that may be unresolved. The record is read after the worktree list: a scratch checkout is recorded before
    `git worktree add` creates its entry, so every own entry the list shows is already in the record then (Spec
    r4: read before the list, a checkout created between the two reads looked foreign and stopped the gate)."""
    common = common_dir(root)
    require(common is not None, 'MAIN is not a Git repository: ' + str(root))
    listed = git_run(root, 'worktree', 'list', '--porcelain', '-z')
    entries = worktree_entries(listed.stdout) if listed.returncode == 0 else []
    scratch = scratch_worktrees(attempt) if attempt is not None else []
    reading = dict(main=os.path.realpath(root), scratch=scratch,
                   worktrees=[worktree_maintenance(entry, common, scratch) for entry in entries])
    if listed.returncode != 0:
        reading['worktreeListError'] = listed.stderr.strip() or 'exit %d' % listed.returncode
    readable = [item['path'] for item in reading['worktrees'] if 'absent' not in item and 'unreadable' not in item]
    reading['scheduled'] = scheduled_maintenance(common, readable, [item['path'] for item in reading['worktrees']])
    return reading


def worktree_paths(root):
    """The realpath of every worktree `git worktree list` shows for ROOT's repository; raises when Git can't list them."""
    listed = git_run(root, 'worktree', 'list', '--porcelain', '-z')
    require(listed.returncode == 0, 'git worktree list failed: ' + (listed.stderr.strip() or 'exit %d' % listed.returncode))
    return {os.path.realpath(entry['worktree']) for entry in worktree_entries(listed.stdout) if 'worktree' in entry}


def worktree_entries(text):
    """`git worktree list --porcelain -z` records: [{'worktree': path, 'prunable': reason, 'locked': reason, ...}]."""
    entries, entry = [], {}
    for field in text.split('\0'):
        if not field:
            if entry:
                entries.append(entry)
            entry = {}
            continue
        key, _, value = field.partition(' ')
        entry[key] = value
    return entries + ([entry] if entry else [])


def worktree_maintenance(entry, common, scratch=()):
    """One worktree's effective settings as `git -C <worktree> config --get --type=<kind>` reads them there (exit 1:
    unset; 128: not a valid value). An entry Git cannot resolve there (one Git lists as prunable, one whose
    directory went before or while it was read, a locked one that is not yet a worktree of MAIN) is `absent`
    only at a path in SCRATCH, the attempt's own recorded scratch checkouts, which its cleanup removes or `git
    worktree add` is creating. Anywhere else it is `unreadable`, a refusal: a worktree moved by hand leaves such
    an entry while it still runs Git on MAIN's object store at a path nothing lists (root ruling, fix r3)."""
    path = entry.get('worktree', '')
    unresolved = lambda reason: dict(path=path, **{'absent' if os.path.realpath(path) in scratch else 'unreadable': reason})
    if 'prunable' in entry:
        return unresolved('prunable: ' + entry['prunable'])
    if common_dir(path) != common:
        if not os.path.isdir(path):
            return unresolved('directory gone')
        if 'locked' in entry:
            return unresolved('locked and not yet a worktree of MAIN: ' + entry['locked'])
        return unresolved('not a worktree of MAIN')
    reading = dict(path=path)
    for key, kind, _ in MAINTENANCE_OFF:
        result = git_run(path, 'config', '--get', '--type=' + kind, key)
        reading[key] = dict(exitCode=result.returncode, value=result.stdout.strip())
    if not os.path.isdir(path):
        return unresolved('directory gone')
    return reading


def scheduled_maintenance(common, readable, paths):
    """Every scheduled run that can reach MAIN's object store: a `maintenance.repo` entry, read with `--path` (so
    `~/` expands as `git for-each-repo` expands it) outside any repository (the scheduler's system and user
    layers) and in every READABLE worktree (every layer and include there), that names one of PATHS, MAIN and
    its worktrees (by realpath), or a directory inside one (by object store); an active `git-maintenance@*`
    systemd user timer; and a crontab line that runs `git maintenance` or `git for-each-repo`. A layer that
    cannot be read is `unread`."""
    scheduled = dict(repos=[], timers=[], cron=[], unread=[])
    targets = {os.path.realpath(path) for path in paths}
    home = os.path.expanduser('~')
    for context in ['/', *readable]:
        result = git_run(context, 'config', '--get-all', '--path', 'maintenance.repo')
        if result.returncode not in (0, 1):
            scheduled['unread'].append('maintenance.repo in %s: %s' % (context, result.stderr.strip() or 'exit %d' % result.returncode))
            continue
        for entry in result.stdout.splitlines():
            target = os.path.realpath(os.path.join(home, entry))
            if (target in targets or (os.path.isdir(target) and common_dir(target) == common)) and entry not in scheduled['repos']:
                scheduled['repos'].append(entry)
    timers = maintenance_timers()
    scheduled['timers' if isinstance(timers, list) else 'unread'] += timers if isinstance(timers, list) else [timers]
    cron = maintenance_cron()
    scheduled['cron' if isinstance(cron, list) else 'unread'] += cron if isinstance(cron, list) else [cron]
    return scheduled


def maintenance_timers():
    """Active `git-maintenance@*` systemd user timers, or why they could not be listed."""
    try:
        result = subprocess.run(['systemctl', '--user', 'list-units', '--type=timer', '--state=active', '--plain',
                                 '--no-legend', '--no-pager', TIMER_PATTERN], capture_output=True, text=True, timeout=4)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return 'systemd user timers: ' + str(exc)
    if result.returncode != 0:
        return 'systemd user timers: ' + (result.stderr.strip() or 'exit %d' % result.returncode)
    return [line.split()[0] for line in result.stdout.splitlines() if line.strip()]


def maintenance_cron():
    """The user's crontab lines that run Git maintenance, or why the crontab could not be read. No `crontab`
    binary, or no crontab for the user, is an empty list: nothing cron runs for this user."""
    if shutil.which('crontab') is None:
        return []
    try:
        result = subprocess.run(['crontab', '-l'], capture_output=True, text=True, timeout=4)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return 'crontab: ' + str(exc)
    if result.returncode != 0:
        return [] if 'no crontab' in result.stderr.lower() else 'crontab: ' + (result.stderr.strip() or 'exit %d' % result.returncode)
    return [line for line in result.stdout.splitlines()
            if not line.lstrip().startswith('#') and re.search(r'\bgit\b.*\b(maintenance|for-each-repo)\b', line)]


def common_dir(root):
    """The repository's absolute object-store directory, or None when ROOT is not in a repository."""
    result = git_run(root, 'rev-parse', '--path-format=absolute', '--git-common-dir')
    return result.stdout.strip() if result.returncode == 0 else None


def maintenance_refusals(reading):
    """Each way automatic maintenance could still run, from a maintenance_reading; empty when none can. A
    missing or malformed reading is a refusal, never a pass; so is a reading whose worktrees lack MAIN."""
    if not isinstance(reading, dict) or not isinstance(reading.get('worktrees'), list):
        return ['no automatic-maintenance reading']
    bad = ['worktree list unreadable: ' + str(reading['worktreeListError'])] if 'worktreeListError' in reading else []
    worktrees = [item for item in reading['worktrees'] if isinstance(item, dict)]
    if len(worktrees) != len(reading['worktrees']) or reading.get('main') not in {os.path.realpath(item.get('path', '')) for item in worktrees}:
        bad.append('no reading for MAIN %s' % reading.get('main'))
    scratch = reading.get('scratch', [])
    if not isinstance(scratch, list):
        bad.append('scratch record unread')
        scratch = []
    for item in worktrees:
        bad += worktree_refusals(item, scratch)
    scheduled = reading.get('scheduled')
    if not isinstance(scheduled, dict) or not all(isinstance(scheduled.get(key), list) for key in ('repos', 'timers', 'cron', 'unread')):
        return bad + ['scheduled maintenance unread']
    bad += ['scheduled maintenance unread: ' + str(item) for item in scheduled['unread']]
    bad += ['scheduled maintenance (maintenance.repo) runs on ' + str(item) for item in scheduled['repos']]
    bad += ['scheduled maintenance timer is active: ' + str(item) for item in scheduled['timers']]
    bad += ['scheduled maintenance in the crontab: ' + str(item) for item in scheduled['cron']]
    return bad


def worktree_refusals(item, scratch):
    """An `absent` entry passes only at a recorded scratch path, so a row judged at collection keeps the rule."""
    path = item.get('path')
    if isinstance(item.get('absent'), str):
        return [] if os.path.realpath(str(path)) in scratch else ['%s: unreadable (%s)' % (path, item['absent'])]
    if 'unreadable' in item:
        return ['%s: unreadable (%s)' % (path, item['unreadable'])]
    bad = []
    for key, _, off in MAINTENANCE_OFF:
        value = item.get(key)
        code, shown = (value.get('exitCode'), value.get('value')) if isinstance(value, dict) else (None, None)
        if code != 0 or shown != off:
            shown = {0: repr(shown), 1: 'unset', 128: 'not a valid value'}.get(code, 'unreadable')
            bad.append('%s: %s is %s, not %s' % (path, key, shown, off))
    return bad


def require_objects(root, *commits):
    for commit in commits:
        require(git_holds(root, 'cat-file', '-e', commit + '^{commit}'), 'Rebase proof object missing: ' + commit)


class proof_context:
    """What a rebase proof is handling: one file or path, PATH at COMMIT, or a STEP with no single file. It catches
    nothing: an exception leaving it is tagged with it unless an inner context tagged it first, so the innermost
    context at the failure is the one a command's top-level catch (proof_refusal) names."""

    def __init__(self, path=None, commit=None, step=None):
        self.path, self.commit, self.step = path, commit, step

    def __enter__(self):
        return self

    def __exit__(self, kind, error, trace):
        if error is not None and not hasattr(error, 'proof_context'):
            error.proof_context = self
        return False


def regen_file(path, commit):
    """The context of a step that reads, decodes, converts or compares one file or path, PATH at COMMIT."""
    return proof_context(path=path, commit=commit)


def proof_refusal(label, step, error):
    """ERROR as a rebase-proof command reports it at its one top-level catch (rebase-proof.py's main, the gate's
    rebase_scope, code-rebase.sh's gate_core runner): a named refusal (ProofRefusal) as it is; any other
    exception a refusal with its type and message, naming the innermost proof_context's file and commit when one is
    set (`Regenerated rebase proof: <path> at <commit> could not be read`, `as <kind>` for a regenerated artifact), else
    `LABEL: failed while <step>`, the innermost context's step or, with none set, STEP."""
    return error if isinstance(error, ProofRefusal) else ProofRefusal(proof_failure(label, step, error))


def proof_failure(label, step, error):
    context, why = getattr(error, 'proof_context', None), ' (' + type(error).__name__ + ': ' + str(error) + ')'
    if context is not None and context.path is not None:
        kind = REGEN_PATHS.get(context.path)
        name = None if kind is None else 'Markdown' if isinstance(kind, Overview) else 'the CLI pin' if isinstance(kind, Pin) else 'JSON'
        return ('Regenerated rebase proof: ' + context.path + ' at ' + context.commit + ' could not be read' +
                (' as ' + name if name else '') + why)
    return label + ': failed while ' + (context.step if context is not None else step) + why


def canonical_json(value):
    """VALUE as canonical JSON, so key order is not content, and true and 1 (equal in Python) still differ."""
    return json.dumps(value, sort_keys=True)


def rebase_chain(root, base, tip, label='Rebase proof'):
    rows = [line.split() for line in git(root, 'rev-list', '--reverse', '--topo-order', '--parents', base + '..' + tip).splitlines()]
    previous = base
    for row in rows:
        require(len(row) == 2 and row[1] == previous, label + ' chain is empty or non-linear: ' + base + '..' + tip)
        previous = row[0]
    require(rows and previous == tip, label + ' chain is empty or non-linear: ' + base + '..' + tip)
    return [row[0] for row in rows]


def rebase_proof(root, old_base, accepted, base, reviewed):
    """Prove from Git objects alone that REVIEWED on BASE is a mechanical rebase of ACCEPTED on OLD_BASE.

    Plumbing raw tree deltas, compared byte for byte with no normalisation: each commit pair's delta and
    message, then the net delta, which differs whenever the slice overlaps the base movement."""
    def delta(old, new):
        return git_bytes(root, 'diff-tree', '-r', '--no-renames', '--no-abbrev', '-z', old, new)

    def message(commit):
        return git_bytes(root, 'cat-file', 'commit', commit).partition(b'\n\n')[2]
    require(old_base != base, 'Rebase proof needs a moved base')
    require_objects(root, accepted, old_base, base, reviewed)
    require(git_holds(root, 'merge-base', '--is-ancestor', old_base, base), 'Rebase proof old base is not an ancestor of BASE')
    before, after = rebase_chain(root, old_base, accepted), rebase_chain(root, base, reviewed)
    require(len(before) == len(after), 'Rebase proof commit count differs: %d vs %d' % (len(before), len(after)))
    for old, new in zip(before, after):
        require(delta(old + '^', old) == delta(new + '^', new), 'Rebase proof commit delta differs: ' + old + ' vs ' + new)
        require(message(old) == message(new), 'Rebase proof commit message differs: ' + old + ' vs ' + new)
    net = delta(old_base, accepted)
    require(net == delta(base, reviewed), 'Rebase proof net delta differs: overlap with the base movement or changed content')
    return dict(oldBase=old_base, accepted=accepted, base=base, reviewed=reviewed, commits=len(after), paths=net.count(b'\0') // 2)


# The regenerated rebase proof (code-regen): the generated launch artifacts a code slice's rebase may regenerate
# instead of carrying, in the order prep-regen's chain writes them. They are prep-lib.sh's prep_regen_files less the
# records dictionary and the authored scope documents, the authority among them, whose content is rows (the
# authority's one generated fact, its Registry binding, is never a code slice's to move), plus the two keyed attribution files
# prep merges (code-rebase.test.sh holds the subset). Each path's kind splits it into rows, which neither the slice
# nor the regeneration may change, and bindings, each checked here or by a named full-suite test (operations.md,
# "Regenerated rebase").
class Keyed(NamedTuple):
    """A shared catalog data file merged by entry identity: REVIEWED holds exactly the keyed union of the slice's and
    the base movement's entries. FORM is 'assessments' (a list keyed by externalKey) or 'evidence' (the encoded map
    of #744, decoded by concatenating its parts). Canonical bytes are data-files.test.ts's to check."""
    form: str


class Bound(NamedTuple):
    """A projection bound to its inputs: everything but the object at BINDINGS is rows, as are its FIXED keys, less
    the DERIVED key paths under them, which a named suite test re-derives; the inputs at INPUTS, a {path: sha256} map,
    are each their blob's sha256 at REVIEWED."""
    bindings: tuple
    inputs: tuple
    fixed: tuple
    derived: tuple


class Derived(NamedTuple):
    """A document whose one binding is the sha256 at FIELD, derived from other regenerated artifacts; everything else
    is rows. The suite checks the hash: a stale one is an inventory error, and the pin holds BASE's count of them."""
    field: tuple


class Overview(NamedTuple):
    """The rendered overview: every byte is rows but the identity LINE's one group, which must be PIN's identity."""
    line: str
    pin: str


class Pin(NamedTuple):
    """The CLI pin: the literal values between the START and END lines are rows but DERIVED, which the test itself
    checks against the CLI; the file outside them is BASE's with the slice's comment lines added just above START."""
    start: str
    end: str
    derived: str


PIN_PATH = 'tests/catalog/launch-document.test.ts'
REGEN_RULE = 'code-regen-v2'
REGEN_PATHS = {
    'src/lib/catalog/data/attribution-assessments.json': Keyed('assessments'),
    'src/lib/catalog/data/attribution-evidence.json': Keyed('evidence'),
    'scripts/catalog/scopes/campaign-mvp-v1.json': Derived(field=('value', 'authoritySha256')),
    'docs/catalog-import/campaign-mvp-inventory.md': Overview(line=r'^Scope: [^;\n]*; identity: (sha256:[0-9a-f]{64})\.$', pin=PIN_PATH),
    'scripts/catalog/scopes/campaign-mvp-v1.verification.json': Bound(
        bindings=('binding',), inputs=('binding', 'inputs'), fixed=('gate',),
        derived=(('gate', 'reviewedInputsFingerprint'),)),
    PIN_PATH: Pin(start='  expect(JSON.parse(output)).toEqual({', end='  });', derived='identity'),
}
# The projection's builder runs once, at --verify --write: nothing after it writes a projection input (the pin and the
# overview are not inputs), and the proof re-hashes every bound input at the regeneration commit (regen_inputs).
_REGEN_STEPS = ('pnpm install --offline; keyed union (catalog:merge FILE --base OLD --ours NEW --theirs ACC); '
                'catalog:launch-inventory --write; catalog:launch-inventory --verify --write; '
                'launch-document pin (prep-regen.ts pin); catalog:launch-inventory --check')
# Its checks end with the scripted match's against a fresh generation (cavalier-master-tactician fix r4): the
# projection binds the matches, which authorize admission.
REGEN_CHAIN = _REGEN_STEPS + '; catalog:attribution-227-matches --check'
# The steps before the launch inventory's notice side was removed (pbl-notice-rows), which regenerated it after the
# keyed union.
_NOTICE_REGEN_STEPS = ('pnpm install --offline; keyed union (catalog:merge FILE --base OLD --ours NEW --theirs ACC); '
                       'notice authority (prep-regen.ts notices); catalog:launch-inventory --write; '
                       'catalog:launch-inventory --verify --write; launch-document pin (prep-regen.ts pin); '
                       'catalog:launch-inventory --check')
# Every chain a code-regen-v2 proof may name: today's, then the ones before it (with the notice side's step, then also
# without the scripted match's check, and before rebase-patch-equal, which repeated the builder with a final
# --verify --check). require_regen_field accepts them in shape only: a re-proof runs with today's REGEN_PATHS, so one
# whose overlap names the deleted notice authority or the authority's notice hash is refused and needs a worker rebase.
REGEN_CHAINS = (REGEN_CHAIN, _NOTICE_REGEN_STEPS + '; catalog:attribution-227-matches --check', _NOTICE_REGEN_STEPS,
                _NOTICE_REGEN_STEPS + '; catalog:launch-inventory --verify --check')
REGEN_MESSAGE = b'Regenerate the generated launch artifacts on the new base (code-regen-v2)\n'


def regen_proof(root, old_base, accepted, base, reviewed):
    """Prove from Git objects that REVIEWED on BASE is ACCEPTED on OLD_BASE rebased with the regenerated artifacts
    (REGEN_PATHS) set aside, plus one final commit that regenerates them, changing only their bindings.

    The slice and the base movement overlap (slice_overlap) in regenerated artifacts only. The slice's commits, each with the
    regenerated artifacts left out and those left empty dropped, are replayed byte for byte with their messages;
    REVIEWED is the regeneration commit (REGEN_MESSAGE), touching regenerated artifacts only (regen_commit): an
    artifact whose decoded content is BASE's has BASE's bytes, and some artifact's content differs from BASE's. Per
    path, by its kind: rows are unchanged by the slice on OLD_BASE and by the regeneration on BASE; a bound input set is
    BASE's with the slice's own additions and removals, and every bound sha256 its blob's at REVIEWED; a keyed file
    holds the keyed union of both sides, and a key both sides changed differently refuses; the pin keeps the slice's
    comment lines; the overview's identity is the pin's. What a kind leaves to the full suite (the derived hashes, the
    pin's identity, the projection's derived identities and exact input set, the bytes of a changed keyed file or
    projection) is why this proof needs it: launch-document.test.ts, launch-verification-inputs.test.ts,
    mvp-status.test.ts, data-files.test.ts and launch-artifact-bytes.test.ts. No test checks the bytes of the manifest
    when its content changes."""
    regenerated = sorted(REGEN_PATHS)
    excluded = [':(top,exclude,literal)' + path for path in regenerated]

    def delta(old, new, outside=False):
        return git_bytes(root, 'diff-tree', '-r', '--no-renames', '--no-abbrev', '-z', old, new,
                         *(['--', ':(top)', *excluded] if outside else []))

    def names(old, new):
        return set(git_bytes(root, 'diff-tree', '-r', '--no-renames', '--name-only', '-z', old, new).decode().split('\0')) - {''}

    def message(commit):
        return git_bytes(root, 'cat-file', 'commit', commit).partition(b'\n\n')[2]
    require(old_base != base, 'Rebase proof needs a moved base')
    require_objects(root, accepted, old_base, base, reviewed)
    require(git_holds(root, 'merge-base', '--is-ancestor', old_base, base), 'Rebase proof old base is not an ancestor of BASE')
    with proof_context(step='finding the overlap'):
        overlap = slice_overlap(root, old_base, accepted, base)
    require(overlap, 'Regenerated rebase proof needs an overlap in the regenerated artifacts; use the mechanical proof')
    require(overlap <= set(regenerated), 'Regenerated rebase proof: overlap outside the regenerated artifacts: ' +
            ', '.join(sorted(overlap - set(regenerated))))
    before, after = rebase_chain(root, old_base, accepted), rebase_chain(root, base, reviewed)
    kept = [commit for commit in before if delta(commit + '^', commit, outside=True)]
    replayed, tip = after[:-1], after[-1]
    require(len(kept) == len(replayed), 'Regenerated rebase proof commit count differs: %d kept vs %d replayed' % (len(kept), len(replayed)))
    for old, new in zip(kept, replayed):
        kept_delta, replayed_delta = raw_delta(root, old + '^', old, [':(top)', *excluded]), raw_delta(root, new + '^', new, [':(top)'])
        differ = sorted(path for path in set(kept_delta) | set(replayed_delta) if kept_delta.get(path) != replayed_delta.get(path))
        inside, outside = [path for path in differ if path in REGEN_PATHS], [path for path in differ if path not in REGEN_PATHS]
        aside = new + ' changes the regenerated artifact ' + ', '.join(inside) + ', which the replay sets aside'
        require(outside == [], 'Regenerated rebase proof commit delta differs outside the regenerated artifacts: ' + old + ' vs ' + new +
                ' at ' + ', '.join(outside) + ('; ' + aside if inside else ''))
        require(inside == [], 'Regenerated rebase proof: ' + old + ' replayed as ' + new +
                ': no commit delta differs outside the regenerated artifacts, but ' + aside)
        require(message(old) == message(new), 'Rebase proof commit message differs: ' + old + ' vs ' + new)
    # No net delta check: equal per-commit raw deltas outside the regenerated artifacts (blob ids and modes on both
    # sides), the dropped commits empty there and a tip that changes regenerated artifacts only give equal net deltas.
    with proof_context(step='checking the regeneration commit'):
        changed = regen_commit(root, base, tip)
    with proof_context(step='checking the regenerated artifacts'):
        regen_artifacts(root, old_base, accepted, base, reviewed)
    return dict(oldBase=old_base, accepted=accepted, base=base, reviewed=reviewed, commits=len(after), paths=len(names(base, reviewed)),
                regen=dict(rule=REGEN_RULE, paths=changed, chain=REGEN_CHAIN))


def changed_names(root, old, new):
    return set(git_bytes(root, 'diff-tree', '-r', '--no-renames', '--name-only', '-z', old, new).decode().split('\0')) - {''}


def slice_overlap(root, old_base, accepted, base):
    """The overlap of a slice with the base movement (code-rebase-overlap): every path any commit of OLD_BASE..ACCEPTED
    changes, the union of the per-commit paths, that OLD_BASE..BASE changes. A path one commit changes and a later one
    restores is in it though the slice's net diff leaves it alone: its replay sits on the base's blob, so the commit's
    delta differs there as it does for a path the net diff holds. code-rebase.sh computes the same set."""
    touched = set()
    for commit in git(root, 'rev-list', old_base + '..' + accepted).split():
        touched |= changed_names(root, commit + '^', commit)
    return touched & changed_names(root, old_base, base)


def regen_commit(root, base, tip):
    """TIP is the regeneration commit: REGEN_MESSAGE, not empty, changing regenerated artifacts only. Every
    regenerated artifact whose decoded content (regen_content) at TIP is BASE's has BASE's blob (regen_mode checks
    the mode), and at least one artifact's decoded content differs from BASE's, else there is nothing to regenerate.
    Blob ids come first, so an artifact TIP holds as BASE does is never read. Returns the changed paths, sorted."""
    require(commit_message(root, tip) == REGEN_MESSAGE,
            'Regenerated rebase proof: the last commit is not the regeneration commit: ' + tip + "'s message is not REGEN_MESSAGE")
    changed = sorted(changed_names(root, tip + '^', tip))
    require(changed, 'Regenerated rebase proof: the regeneration commit ' + tip + ' is empty, so there is nothing to regenerate')
    require(set(changed) <= set(REGEN_PATHS), 'Regenerated rebase proof: in ' + tip +
            ' against its parent, the regeneration commit changes other paths: ' + ', '.join(sorted(set(changed) - set(REGEN_PATHS))))
    rewritten = [path for path in REGEN_PATHS if blob_id(root, base, path) != blob_id(root, tip, path)]
    unchanged = [path for path in rewritten if regen_content(root, path, base) == regen_content(root, path, tip)]
    require(len(unchanged) < len(rewritten), 'Regenerated rebase proof: the regeneration commit ' + tip + " changes no regenerated "
            "artifact's decoded content against BASE, so there is nothing to regenerate: it changes only the bytes or mode of " +
            ', '.join(changed))
    require(not unchanged, 'Regenerated rebase proof: ' + ', '.join(unchanged) + ' at ' + tip +
            " has BASE's decoded content but not BASE's bytes")
    return changed


def regen_file_step(step):
    """STEP(root, path, commit, ...) run inside regen_file(path, commit), its proof_context."""
    @functools.wraps(step)
    def run(root, path, commit, *args, **kwargs):
        with regen_file(path, commit):
            return step(root, path, commit, *args, **kwargs)
    return run


@regen_file_step
def regen_content(root, path, commit):
    """A regenerated artifact's decoded content at COMMIT (regen_decoded), or None when it has none: a keyed file's
    decoded entries; the pin's lines above and below its block and its pinned values, a string by its text whatever
    its quotes (pin_value); any other JSON document parsed, as canonical JSON (so key order is not content, and true
    and 1 still differ); the overview, a Markdown file, by its text, compared as its bytes. Bytes that are not JSON
    are their own content; the checks after refuse them."""
    kind = REGEN_PATHS[path]
    if isinstance(kind, Overview):
        return blob(root, commit, path)
    decoded = regen_decoded(root, path, commit, values=True)
    if isinstance(kind, Keyed):
        return None if blob_id(root, commit, path) is None else keyed_decoded(decoded, path, commit)
    if isinstance(kind, Pin):
        return decoded and (decoded.head, decoded.values, decoded.tail)
    return blob(root, commit, path) if decoded is None else canonical_json(decoded)


@regen_file_step
def regen_decoded(root, path, commit, values=False):
    """PATH at COMMIT decoded as its kind, or None when it has no blob there: a JSON artifact parsed, or None when it
    is not JSON (json_or_none), which its checks refuse by name; the pin's text split at its block (PinParts), with
    VALUES each pinned literal decoded (pin_value); the overview's text."""
    kind, content = REGEN_PATHS[path], blob(root, commit, path)
    if content is None:
        return None
    if isinstance(kind, Overview):
        return content.decode()
    if isinstance(kind, Pin):
        head, literals, tail = pin_split(path, content.decode(), commit)
        return PinParts(head, literals, [(key, pin_value(literal)) for key, literal in literals] if values else None, tail)
    return json_or_none(content)


@regen_file_step
def regen_read(root, path, commit):
    """PATH at COMMIT decoded as its kind (regen_decoded), refusing when it is missing."""
    decoded = regen_decoded(root, path, commit)
    require(decoded is not None, 'Regenerated rebase proof: ' + path + ' is missing at ' + commit)
    return decoded


def pin_value(literal):
    """A pinned literal's value: a string's text between its quotes (PIN_VALUE admits no escape), else its JSON
    (PIN_VALUE admits only JSON's numbers, so a padded one such as 01 is not a literal)."""
    return ('string', literal[1:-1]) if literal[0] in '\'"' else ('json', json.dumps(json.loads(literal)))


def regen_mode(root, path, base, reviewed):
    """A regenerated artifact has BASE's mode at REVIEWED: the chain writes bytes, never a mode. The slice cannot add
    one, since regen_present refuses an artifact that OLD_BASE, ACCEPTED, BASE or REVIEWED lacks."""
    with regen_file(path, reviewed):
        row = raw_delta(root, base, reviewed, [':(top,literal)' + path]).get(path)
    require(row is None or row[0] == row[1],
            'Regenerated rebase proof: %s has mode %s at %s, not %s as at BASE' % (path, row and row[1], reviewed, row and row[0]))


def regen_artifacts(root, old_base, accepted, base, reviewed):
    """Each regenerated artifact's mode, rows and bindings at REVIEWED, after regen_precheck's checks of the slice."""
    expected = regen_precheck(root, old_base, accepted, base)
    for path in regen_present(root, (old_base, accepted, base, reviewed)):
        regen_mode(root, path, base, reviewed)
        regen_artifact_rows(root, path, base, reviewed, expected.get(path))
        regen_artifact_bindings(root, path, old_base, accepted, base, reviewed)


# The patch-equal rebase proof (rebase-patch-equal): a slice whose overlap with the base movement outside the
# regenerated artifacts Git merges cleanly, replayed commit by commit as a rebase-only review reads it with
# `git range-diff`. It does not show that the slice and the base movement still work together where they meet in one
# file: the gate's own checks find that, as they do for the other proofs (operations.md, "Rebasing a reviewed slice").
PATCH_RULE = 'patch-equal-v1'
PATCH_LABEL = 'Patch-equal rebase proof'


def patch_equal_proof(root, old_base, accepted, base, reviewed):
    """Prove from Git objects that REVIEWED on BASE replays ACCEPTED on OLD_BASE where the two overlap outside the
    regenerated artifacts (REGEN_PATHS), the overlap Git merged cleanly.

    The overlap (slice_overlap) is the paths any commit of OLD_BASE..ACCEPTED changes that OLD_BASE..BASE changes; some
    must lie outside the regenerated artifacts. With none inside them, every commit is replayed whole, so the whole
    accepted chain is compared, an empty commit included; a regenerated artifact the slice changes is carried as it is
    and may change bindings only (regen_precheck), never rows. With some inside them, the regenerated artifacts are
    set aside in each replayed commit, an accepted commit that changes regenerated artifacts only is the one commit
    that may be dropped, and REVIEWED is the regeneration commit, proven as regen_proof proves it. Over the compared
    paths (all, or those outside the regenerated artifacts), each pair has the same changed paths with the same modes
    and status, the same `git patch-id --verbatim` and the same message. Then, over the same paths, REVIEWED's tree is
    Git's clean three-way merge of ACCEPTED onto BASE with OLD_BASE as the merge base (clean_merge), and each replayed
    commit's tree is Git's own clean replay of its accepted commit onto the replayed commit before it (replay_commit,
    what code-rebase.sh's cherry-pick gives). A per-commit refusal names the commit and path; clean_merge's names the
    paths. When the overlap holds the receipts file and Git's replay of a reviewed commit conflicts there, the
    receipts-union rule (receipts_union_holds) carries it instead: it leaves the compared paths, Git's replay and merge
    may conflict there, and each replayed commit and REVIEWED must hold the union receipts_union gives."""
    plan = patch_equal_plan(root, old_base, accepted, base, reviewed)
    regenerated = set(REGEN_PATHS) if plan.regen else set()
    # The paths Git's replay and merge may conflict in: the regenerated artifacts it sets aside, and the receipts file
    # when the receipts-union rule carries it.
    aside = regenerated | ({RECEIPTS} if plan.union else set())
    for old, new in plan.pairs:
        if plan.regen:
            touched = sorted(changed_names(root, new + '^', new) & set(REGEN_PATHS))
            require(not touched, PATCH_LABEL + ': ' + new + ' changes the regenerated artifact ' + ', '.join(touched) + ', which the replay sets aside')
        patch_equal_commit(root, old, new, plan.compared)
        require(commit_message(root, old) == commit_message(root, new), 'Rebase proof commit message differs: ' + old + ' vs ' + new)
    regen_paths = regen_commit(root, base, plan.tip) if plan.regen else None
    if plan.union:
        receipts_union_holds(root, old_base, base, [*plan.pairs, (accepted, reviewed)])
    with scratch_objects(root) as run:
        clean_merge(run, old_base, accepted, base, reviewed, plan.compared, aside)
        for old, new in plan.pairs:
            replay_commit(run, old, new, plan.compared, aside)
    summary = dict(oldBase=old_base, accepted=accepted, base=base, reviewed=reviewed, commits=plan.commits,
                   paths=len(changed_names(root, base, reviewed)), patchEqual=dict(rule=PATCH_RULE, paths=plan.outside))
    if plan.union:
        summary['receiptsUnion'] = dict(rule=RECEIPTS_RULE, paths=[RECEIPTS])
    if plan.regen:
        regen_artifacts(root, old_base, accepted, base, reviewed)
        summary['regen'] = dict(rule=REGEN_RULE, paths=regen_paths, chain=REGEN_CHAIN)
    return summary


class ReplayPlan(NamedTuple):
    """What patch_equal_proof compares: the overlap OUTSIDE the regenerated artifacts, whether REGEN sets them aside,
    the COMPARED pathspec, the (accepted, replayed) commit PAIRS, the regeneration commit TIP (None without REGEN) and
    the replayed chain's length, COMMITS, and whether the receipts-union rule carries the receipts file, UNION."""
    outside: list
    regen: bool
    compared: list
    pairs: list
    tip: object
    commits: int
    union: bool


def patch_equal_plan(root, old_base, accepted, base, reviewed):
    """The replay patch_equal_proof compares, after the checks that need no pairing: a moved base, the objects, an
    overlap outside the regenerated artifacts, the slice's regenerated rows (regen_precheck) when the slice changes
    a regenerated artifact the overlap does not hold, linear chains, and the same count of kept and replayed commits.
    Without REGEN every accepted commit is kept; with it, every one but those whose only change is to regenerated
    artifacts, which the replay empties by setting them aside. A commit that was empty in ACCEPTED is kept either way,
    so a replay that loses it, or one the base movement already held, refuses by the count."""
    require(old_base != base, 'Rebase proof needs a moved base')
    require_objects(root, accepted, old_base, base, reviewed)
    require(git_holds(root, 'merge-base', '--is-ancestor', old_base, base), 'Rebase proof old base is not an ancestor of BASE')
    regenerated = set(REGEN_PATHS)
    with proof_context(step='finding the overlap'):
        overlap = slice_overlap(root, old_base, accepted, base)
    outside = sorted(overlap - regenerated)
    require(outside, PATCH_LABEL + ': no overlap outside the regenerated artifacts; use the mechanical or the regenerated proof')
    regen = bool(overlap & regenerated)
    if not regen and changed_names(root, old_base, accepted) & regenerated:
        regen_precheck(root, old_base, accepted, base)
    compared = [':(top)', *(':(top,exclude,literal)' + path for path in sorted(regenerated))] if regen else [':(top)']
    before, after = rebase_chain(root, old_base, accepted), rebase_chain(root, base, reviewed)
    kept = [commit for commit in before if not (regen and regenerated_only(root, commit))]
    replayed, tip = (after[:-1], after[-1]) if regen else (after, None)
    require(len(kept) == len(replayed), PATCH_LABEL + ' commit count differs: %d kept vs %d replayed' % (len(kept), len(replayed)))
    pairs = list(zip(kept, replayed))
    union = RECEIPTS in outside and receipts_conflict(root, pairs)
    if union:
        compared = [*compared, ':(top,exclude,literal)' + RECEIPTS]
    return ReplayPlan(outside, regen, compared, pairs, tip, len(after), union)


def regenerated_only(root, commit):
    """COMMIT changes something, and only regenerated artifacts: the one commit a regenerating replay leaves empty."""
    changed = changed_names(root, commit + '^', commit)
    return bool(changed) and changed <= set(REGEN_PATHS)


def raw_delta(root, old, new, pathspec):
    """OLD..NEW's raw tree delta over PATHSPEC: {path: (old mode, new mode, old blob, new blob, status)}."""
    fields = git_bytes(root, 'diff-tree', '-r', '--no-renames', '--no-abbrev', '-z', old, new, '--', *pathspec).split(b'\0')
    return {path.decode(): tuple(meta.lstrip(b':').decode().split(' ')) for meta, path in zip(fields[0:-1:2], fields[1::2])}


def patch_id(root, old, new, pathspec):
    """`git patch-id --verbatim` of OLD..NEW's patch over PATHSPEC, binary content included; empty for no patch."""
    patch = git_bytes(root, 'diff-tree', '-p', '--binary', '--no-renames', '--no-ext-diff', '--no-textconv', '--no-color', '-U3',
                      old, new, '--', *pathspec)
    result = subprocess.run(['git', '-C', str(root), 'patch-id', '--verbatim'], input=patch, check=True,
                            env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'}, stdout=subprocess.PIPE)
    return result.stdout.split()[0] if result.stdout.strip() else b''


def patch_equal_commit(root, old, new, pathspec):
    """NEW replays OLD over PATHSPEC: the same paths, modes and status, and the same patch-id; the first path that
    differs is named. That a path the base movement left alone has OLD's blobs follows from replay_commit."""
    before, after = raw_delta(root, old + '^', old, pathspec), raw_delta(root, new + '^', new, pathspec)

    def differs(path, why):
        return PATCH_LABEL + ': ' + old + ' replayed as ' + new + ' changes ' + path + ' differently (' + why + ')'
    for path in sorted(set(before) | set(after)):
        mine, theirs = before.get(path), after.get(path)
        require(mine is not None and theirs is not None and (mine[0], mine[1], mine[4]) == (theirs[0], theirs[1], theirs[4]),
                differs(path, 'mode or status'))
    if patch_id(root, old + '^', old, pathspec) != patch_id(root, new + '^', new, pathspec):
        for path in sorted(before):
            literal = [':(top,literal)' + path]
            require(patch_id(root, old + '^', old, literal) == patch_id(root, new + '^', new, literal), differs(path, 'patch-id'))
        require(False, differs(', '.join(sorted(before)), 'patch-id'))


@contextlib.contextmanager
def scratch_objects(root):
    """A Git runner for ROOT whose new objects go to a scratch object directory that borrows the repository's, so a
    proof's merges write nothing into the repository."""
    objects = git(root, 'rev-parse', '--path-format=absolute', '--git-path', 'objects')
    with tempfile.TemporaryDirectory(prefix='patch-equal-') as scratch:
        (Path(scratch) / 'info').mkdir()
        (Path(scratch) / 'info' / 'alternates').write_text(objects + '\n')
        environment = {**os.environ, 'GIT_OPTIONAL_LOCKS': '0', 'GIT_OBJECT_DIRECTORY': scratch}

        def run(*args):
            return subprocess.run(['git', '-C', str(root), *args], env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        yield run


def merge_tree(run, merge_base, ours, theirs):
    """Git's three-way merge of THEIRS onto OURS with MERGE_BASE as the merge base, no rename detection (the
    replay's): its tree and the conflicted paths."""
    merge = run('merge-tree', '--write-tree', '-z', '--name-only', '--no-messages', '-X', 'no-renames',
                '--merge-base=' + merge_base, ours, theirs)
    require(merge.returncode in (0, 1), PATCH_LABEL + ': git merge-tree failed: ' + merge.stderr.decode(errors='replace').strip())
    tree, *conflicted = [field.decode() for field in merge.stdout.split(b'\0') if field]
    return tree, set(conflicted)


def differing_paths(run, tree, commit, pathspec):
    """The paths over PATHSPEC where TREE and COMMIT's tree differ, in content or mode, sorted."""
    differ = run('diff-tree', '-r', '--no-renames', '--name-only', '-z', tree, commit, '--', *pathspec)
    require(differ.returncode == 0, PATCH_LABEL + ': git diff-tree failed: ' + differ.stderr.decode(errors='replace').strip())
    return sorted(field.decode() for field in differ.stdout.split(b'\0') if field)


def replay_commit(run, old, new, pathspec, regenerated):
    """Over PATHSPEC, NEW's tree is Git's own replay of OLD onto NEW's parent, the three-way merge with OLD's parent
    as the merge base (git cherry-pick's, no rename detection), and that replay conflicts only in REGENERATED, which
    the regenerating replay sets aside (with the receipts file when the receipts-union rule carries it)."""
    tree, conflicted = merge_tree(run, old + '^', new + '^', old)
    conflicts = sorted(conflicted - regenerated)
    label = PATCH_LABEL + ': ' + old + ' replayed as ' + new
    require(not conflicts, label + ": Git's replay of it conflicts at " + ', '.join(conflicts))
    paths = differing_paths(run, tree, new, pathspec)
    require(not paths, label + " differs from Git's replay of it at " + ', '.join(paths))


def clean_merge(run, old_base, accepted, base, reviewed, pathspec, regenerated):
    """Over PATHSPEC, REVIEWED's tree is `git merge-tree` of ACCEPTED onto BASE with OLD_BASE as the merge base, and
    that merge conflicts only in REGENERATED. The replay of each commit (replay_commit), checked after it, does not
    imply it: Git can align a chain of merges differently from one merge of their sum. REGENERATED holds the receipts
    file too when the receipts-union rule carries it."""
    tree, conflicted = merge_tree(run, old_base, base, accepted)
    conflicts = sorted(conflicted - regenerated)
    require(not conflicts, PATCH_LABEL + ': Git does not merge the slice onto BASE cleanly: ' + ', '.join(conflicts))
    paths = differing_paths(run, tree, reviewed, pathspec)
    require(not paths, PATCH_LABEL + ": REVIEWED is not Git's clean merge of the slice onto BASE: " + ', '.join(paths))


# The receipts-union rule (receipts-union-rebase): review-receipts.json, to which the record step appends each new
# receipt after the ones there (recordReviewReceipt in scripts/catalog/review-receipts.ts), so a slice that adds a
# receipt conflicts with a base that gained another at the file's tail. Only this file: a conflict in another path
# outside the regenerated artifacts refuses the union, while one inside a regenerated artifact is set aside for the
# regeneration rule and can come with a carried receipts file.
RECEIPTS = 'scripts/catalog/review-receipts.json'
RECEIPTS_RULE = 'receipts-union-v1'
RECEIPTS_LABEL = 'Receipts-union rebase proof'
# The record step's JSON writer (scripts/catalog/format-json.mjs, which scripts/catalog-record-review.ts imports): in a
# checkout, that file; in a gate attempt's frozen operator runtime, the copy freeze() puts beside this module there.
_RUNTIME = Path(__file__).resolve().parent
JSON_WRITER = (_RUNTIME / 'format-json.mjs' if (_RUNTIME / 'format-json.mjs').is_file()
               else _RUNTIME.parent / 'catalog' / 'format-json.mjs')


def receipts_conflict(root, pairs):
    """Whether Git's replay of some reviewed commit of PAIRS onto its replayed commit's parent (replay_commit's merge,
    code-rebase.sh's cherry-pick) conflicts in the receipts file."""
    with scratch_objects(root) as run:
        return any(RECEIPTS in merge_tree(run, old + '^', new + '^', old)[1] for old, new in pairs)


def receipts_at(root, commit, side):
    """The receipts COMMIT (SIDE, as a refusal names it) holds in the receipts file: an object whose only key, receipts,
    is a list of objects, each with a non-empty string runId, no two alike. Anything else refuses."""
    return receipts_read(str(root), commit, side)[0]


@functools.lru_cache(maxsize=32)
def receipts_read(root, commit, side):
    """receipts_at's receipts and each one's canonical JSON, decoded once per commit (a full SHA, so the cache cannot go
    stale); a refusal is not cached."""
    with regen_file(RECEIPTS, commit):
        data = blob_read(root, commit, RECEIPTS)
        document = json_or_none(data) if data is not None else None
        receipts = document['receipts'] if isinstance(document, dict) and set(document) == {'receipts'} else None
        ids = [entry.get('runId') for entry in receipts] if isinstance(receipts, list) and all(isinstance(entry, dict) for entry in receipts) else None
        require(ids is not None and all(isinstance(run_id, str) and run_id for run_id in ids),
                RECEIPTS_LABEL + ': ' + RECEIPTS + ' at ' + side + ' (' + commit + ') does not decode as review receipts')
        twice = sorted(run_id for run_id, count in collections.Counter(ids).items() if count > 1)
        require(not twice, RECEIPTS_LABEL + ': ' + RECEIPTS + ' at ' + side + ' (' + commit + ') holds two receipts with the runId ' + ', '.join(twice))
        return tuple(receipts), tuple(canonical_json(entry) for entry in receipts)


def receipts_written(value):
    """VALUE in the bytes the record step's writer gives (formatJson of JSON_WRITER, run with node)."""
    script = ('import { formatJson } from ' + json.dumps(JSON_WRITER.as_uri()) + '; const chunks = [];'
              ' for await (const chunk of process.stdin) chunks.push(chunk);'
              ' process.stdout.write(formatJson(JSON.parse(Buffer.concat(chunks).toString("utf8"))));')
    result = subprocess.run(['node', '--input-type=module', '-e', script], input=json.dumps(value).encode(),
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    require(result.returncode == 0, RECEIPTS_LABEL + ": the record step's JSON writer failed: " + result.stderr.decode(errors='replace').strip())
    return result.stdout


def receipts_union(root, old_base, commit, base):
    """The receipts file the replay of the reviewed COMMIT holds under receipts-union-v1, in the bytes the record
    step's writer gives (receipts_written): BASE's receipts, unchanged and in BASE's order, followed by those COMMIT
    adds to OLD_BASE's, in COMMIT's order, as the record step appends them. The rule's preconditions, each a refusal
    when unmet: every side's file decodes as receipts (receipts_at); COMMIT leaves the file's mode as OLD_BASE has it;
    COMMIT's receipts start with OLD_BASE's, unchanged and in order (what follows is the slice's own, carried as COMMIT
    holds it); and no receipt COMMIT adds has the runId of one of BASE's. code-rebase.sh writes these bytes for a
    commit whose replay conflicts in the file alone."""
    return receipts_written(dict(receipts=list(receipts_expected(root, old_base, commit, base)[0])))


def receipts_expected(root, old_base, commit, base):
    """receipts_union's receipts, checked, and their canonical JSON."""
    before, before_canonical = receipts_read(str(root), old_base, 'OLD_BASE')
    theirs, theirs_canonical = receipts_read(str(root), commit, 'the reviewed commit')
    ours, ours_canonical = receipts_read(str(root), base, 'BASE')
    require(receipts_mode(root, commit) == receipts_mode(root, old_base), RECEIPTS_LABEL + ': ' + commit + ' changes the mode of ' +
            RECEIPTS + ', which this rule carries only when the slice leaves it as OLD_BASE has it')
    changed = [entry['runId'] for number, entry in enumerate(before)
               if number >= len(theirs) or theirs_canonical[number] != before_canonical[number]]
    require(not changed, RECEIPTS_LABEL + ': ' + commit + ' changes, removes or moves receipts OLD_BASE holds in ' + RECEIPTS +
            ', which this rule carries only when the slice adds receipts: ' + ', '.join(changed))
    added = theirs[len(before):]
    both = sorted({entry['runId'] for entry in added} & {entry['runId'] for entry in ours})
    require(not both, RECEIPTS_LABEL + ': ' + commit + ' adds a receipt BASE holds too, with the runId ' + ', '.join(both))
    return ours + added, ours_canonical + theirs_canonical[len(before):]


def receipts_union_holds(root, old_base, base, pairs):
    """For each (reviewed, replayed) commit of PAIRS, the replayed commit's receipts file is receipts_union's for the
    reviewed one: the same receipts, each deep-equal to its source (canonical JSON), then the same bytes, and BASE's
    mode, which receipts_union requires the slice to leave as OLD_BASE has it."""
    mode = receipts_mode(root, base)
    for old, new in pairs:
        wanted, wanted_canonical = receipts_expected(root, old_base, old, base)
        held, held_canonical = receipts_read(str(root), new, 'the replayed commit')
        require(held_canonical == wanted_canonical,
                RECEIPTS_LABEL + ': ' + new + " (the replay of " + old + ") does not hold BASE's receipts followed by those the slice added, "
                'each unchanged, in order: it differs at ' + (receipts_differ(wanted, wanted_canonical, held, held_canonical) or 'their order'))
        require(blob(root, new, RECEIPTS) == receipts_written(dict(receipts=list(wanted))), RECEIPTS_LABEL + ': ' + new +
                ' holds the receipts in ' + RECEIPTS + " in other bytes than the record step's writer gives")
        require(receipts_mode(root, new) == mode, RECEIPTS_LABEL + ': ' + new + " gives " + RECEIPTS + " another mode than BASE's")


def receipts_differ(wanted, wanted_canonical, held, held_canonical):
    """The runIds of the receipts one side holds and the other does not hold unchanged, for a refusal."""
    on_both = set(wanted_canonical) & set(held_canonical)
    return ', '.join(sorted({entry['runId'] for side in ((wanted, wanted_canonical), (held, held_canonical))
                             for entry, canonical in zip(*side) if canonical not in on_both}))


def receipts_mode(root, commit):
    with regen_file(RECEIPTS, commit):
        return git(root, 'ls-tree', '--full-tree', commit, '--', RECEIPTS).partition(' ')[0]


def regen_artifact_rows(root, path, base, reviewed, expected):
    """A regenerated artifact's rows at REVIEWED, by its kind: a keyed file is the EXPECTED union, the pin is BASE's
    with the EXPECTED comment lines, and any other artifact holds BASE's rows."""
    kind = REGEN_PATHS[path]
    if isinstance(kind, Keyed):
        keyed_holds(root, path, reviewed, expected)
    elif isinstance(kind, Pin):
        pin_regenerated(root, path, base, reviewed, expected)
    else:
        regen_rows(root, path, base, reviewed, 'the regeneration')


def regen_artifact_bindings(root, path, old_base, accepted, base, reviewed):
    """A regenerated artifact's bindings at REVIEWED, by its kind: a bound projection binds current inputs, BASE's set
    with the slice's own changes; a derived document holds a sha256; the overview's identity is the pin's."""
    kind = REGEN_PATHS[path]
    if isinstance(kind, Bound):
        regen_inputs(root, path, reviewed)
        regen_input_set(root, path, old_base, accepted, base, reviewed)
    elif isinstance(kind, Derived):
        with regen_file(path, reviewed):
            require(re.fullmatch('[0-9a-f]{64}', str(json_at(regen_document(root, path, reviewed), kind.field))),
                    'Regenerated rebase proof: ' + path + ' has no sha256 at ' + '.'.join(kind.field) + ' at ' + reviewed)
    elif isinstance(kind, Overview):
        require(overview_identity(root, path, reviewed) == pin_identity(root, kind.pin, reviewed),
                'Regenerated rebase proof: the identity of ' + path + ' is not the pin\'s in ' + kind.pin + ' at ' + reviewed)


def regen_precheck(root, old_base, accepted, base):
    """The checks of regen_proof that need no REVIEWED, so code-rebase.sh makes them before it regenerates: the
    reviewed slice changes no rows of a regenerated artifact (the pin only by comment lines above it), and every
    keyed file's union has no conflict. Returns what the regeneration must hold: each keyed file's union and the
    pin's added comment lines, by path."""
    expected = {}
    for path in regen_present(root, (old_base, accepted, base)):
        kind = REGEN_PATHS[path]
        if isinstance(kind, Keyed):
            expected[path] = keyed_union(root, path, old_base, accepted, base)
        elif isinstance(kind, Pin):
            expected[path] = pin_comment(root, path, old_base, accepted)
        else:
            regen_rows(root, path, old_base, accepted, 'the reviewed slice')
    return expected


def regen_present(root, commits):
    """The regenerated artifacts every one of COMMITS holds; one that only some of them hold refuses, and one that
    none holds has nothing to prove."""
    present = []
    for path in REGEN_PATHS:
        held = [blob_id(root, commit, path) is not None for commit in commits]
        require(all(held) or not any(held), 'Regenerated rebase proof: ' + path + ' is missing at ' +
                ', '.join(commit for commit, has in zip(commits, held) if not has))
        if all(held):
            present.append(path)
    return present


def blob(root, commit, path):
    """PATH's bytes at COMMIT, or None when it has none."""
    with regen_file(path, commit):
        return blob_read(root, commit, path)


def blob_read(root, commit, path):
    result = subprocess.run(['git', '-C', str(root), 'cat-file', 'blob', commit + ':' + path], env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'},
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    return result.stdout if result.returncode == 0 else None


def blob_id(root, commit, path):
    """PATH's Git blob id at COMMIT, or None when it holds no blob there: equal ids are equal bytes, compared without
    reading them (regen-proof-memory)."""
    with regen_file(path, commit):
        return blob_lookup(root, commit, path)


def blob_lookup(root, commit, path):
    result = subprocess.run(['git', '-C', str(root), 'ls-tree', '-z', '--full-tree', commit, '--', path],
                            env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'}, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    mode, _, rest = result.stdout.partition(b' ')
    kind, _, rest = rest.partition(b' ')
    name, _, entry = rest.partition(b'\t')
    return name.decode() if result.returncode == 0 and kind == b'blob' and entry == path.encode() + b'\0' else None


def json_at(document, keys):
    """The value at the key path KEYS, or None."""
    for key in keys:
        document = document.get(key) if isinstance(document, dict) else None
    return document


def json_without(document, keys):
    """DOCUMENT without the value at the key path KEYS."""
    first, rest = keys[0], keys[1:]
    return {key: json_without(value, rest) if rest and key == first else value
            for key, value in document.items() if rest or key != first}


def json_or_none(text):
    """TEXT parsed as JSON, or None when it is not JSON."""
    try:
        return json.loads(text)
    except ValueError:
        return None


@regen_file_step
def regen_document(root, path, commit):
    document = regen_decoded(root, path, commit)
    require(document is not None, 'Regenerated rebase proof: ' + path + ' is missing or not JSON at ' + commit)
    kind = REGEN_PATHS[path]
    keys = kind.bindings if isinstance(kind, Bound) else kind.field
    require(isinstance(document, dict) and json_at(document, keys) is not None,
            'Regenerated rebase proof: ' + path + ' has no ' + '.'.join(keys) + ' at ' + commit)
    return document


def regen_rows(root, path, old, new, change):
    """A regenerated artifact's rows, everything but its bindings, equal on both commits: a row change is semantic.
    Equal stored rows are equal expanded rows: a v3 records-encoded document's rows include its recordsSha256, and a v4
    document refers to records by content key, which its decoder checks against each record."""
    kind = REGEN_PATHS[path]

    def held(commit):
        with regen_file(path, commit):
            return rows_of(commit)

    def rows_of(commit):
        if isinstance(kind, Overview):
            text = regen_read(root, path, commit)
            match = overview_match(path, text, commit)
            return text[:match.start(1)] + text[match.end(1):]
        document = regen_document(root, path, commit)
        keys = kind.bindings if isinstance(kind, Bound) else kind.field
        view = json_without(document, keys)
        if isinstance(kind, Bound):
            for key in kind.fixed:
                value = json_at(document, keys + (key,))
                for derived in kind.derived:
                    if derived[0] == key and isinstance(value, dict) and len(derived) > 1:
                        value = json_without(value, derived[1:])
                view['.'.join(keys + (key,))] = value
        return canonical_json(view)
    require(held(old) == held(new), 'Regenerated rebase proof: ' + change + ' changes rows of ' + path +
            ' (or its fixed bindings), not only bindings: ' + old + '..' + new)


@regen_file_step
def bound_inputs(root, path, commit):
    kind = REGEN_PATHS[path]
    inputs = json_at(regen_document(root, path, commit), kind.inputs)
    require(isinstance(inputs, dict) and inputs, 'Regenerated rebase proof: ' + path + ' binds no inputs at ' + commit)
    # Inside regen_file: the input sets of several commits are compared and sorted after this step.
    bad = [name for name in inputs if not isinstance(name, str)]
    if bad:
        raise TypeError('a bound input is not named by a string: ' + repr(bad[0]))
    return inputs


def regen_input_set(root, path, old_base, accepted, base, reviewed):
    """The regenerated artifact binds exactly BASE's inputs with the slice's own binding additions and removals
    (OLD_BASE..ACCEPTED), so a regeneration that drops a bound input, or binds one neither side added, refuses."""
    old, slice_, moved, regenerated = (input_names(root, path, commit) for commit in (old_base, accepted, base, reviewed))
    expected = (moved - (old - slice_)) | (slice_ - old)
    missing, extra = sorted(expected - regenerated), sorted(regenerated - expected)
    require(not missing and not extra, 'Regenerated rebase proof: ' + path + ' at ' + reviewed + " does not bind the base's inputs "
            "with the slice's own changes: " + '; '.join(label + ' ' + ', '.join(names)
                                                         for label, names in (('missing', missing), ('extra', extra)) if names))


@regen_file_step
def input_names(root, path, commit):
    return set(bound_inputs(root, path, commit))


def regen_inputs(root, path, commit):
    """Each bound input's sha256 in the artifact is its blob's at COMMIT."""
    with regen_file(path, commit):
        regen_input_hashes(root, path, commit)


def regen_input_hashes(root, path, commit):
    for name, expected in sorted(bound_inputs(root, path, commit).items()):
        with regen_file(name, commit):
            content = blob(root, commit, name)
            require(content is not None and hashlib.sha256(content).hexdigest() == expected,
                    'Regenerated rebase proof: ' + path + ' binds a stale input ' + name + ' at ' + commit)


@regen_file_step
def keyed_entries(root, path, commit):
    """A keyed file's entries at COMMIT, each its canonical JSON's sha256 by identity: the parsed file is dropped once
    its entries are digested, so a comparison holds one parsed copy at a time (regen-proof-memory)."""
    return keyed_decoded(regen_decoded(root, path, commit), path, commit)


def keyed_decoded(document, path, commit):
    """A keyed file's parsed DOCUMENT (None when missing or not JSON) as its entries (keyed_entries)."""
    decode = assessment_entries if REGEN_PATHS[path].form == 'assessments' else evidence_entries
    return decode(document, path, commit)


def entry_digest(entry):
    return hashlib.sha256(canonical_json(entry).encode()).digest()


def keyed_malformed(path, commit):
    return 'Regenerated rebase proof: ' + path + ' is missing or malformed at ' + commit


def assessment_entries(document, path, commit):
    """An assessments list's entries by externalKey, each key once."""
    require(isinstance(document, list) and all(isinstance(entry, dict) and isinstance(entry.get('externalKey'), str)
                                               for entry in document), keyed_malformed(path, commit))
    entries = {entry['externalKey']: entry_digest(entry) for entry in document}
    require(len(entries) == len(document), 'Regenerated rebase proof: ' + path + ' repeats an externalKey at ' + commit)
    return entries


def evidence_entries(document, path, commit):
    """An evidence file's entries by name, each with its content decoded: inline, or its parts joined with the shared
    blobs they reference (#744), entry by entry in file order."""
    malformed = keyed_malformed(path, commit)
    require(isinstance(document, dict) and set(document) == {'evidence', 'shared'} and isinstance(document['evidence'], dict)
            and isinstance(document['shared'], dict), malformed)
    resolve = evidence_resolver(document['shared'], malformed)
    return {name: evidence_entry(name, entry, resolve, malformed) for name, entry in document['evidence'].items()}


def evidence_entry(name, entry, resolve, malformed):
    """One evidence entry's digest, with exactly one of content and parts, its parts RESOLVEd into content."""
    require(isinstance(entry, dict) and ('content' in entry) != ('parts' in entry), malformed + ': evidence ' + name)
    decoded = {key: value for key, value in entry.items() if key != 'parts'}
    decoded['content'] = entry['content'] if 'content' in entry else resolve(entry['parts'])
    return entry_digest(decoded)


def evidence_resolver(shared, malformed):
    """Joins a parts list into text: a string as is, a {ref} as the SHARED blob it names, resolved once and checked
    against its hash (the first 24 hex digits of its text's sha256), nesting at most 256 deep."""
    resolved = {}

    def resolve(parts, depth=0):
        require(isinstance(parts, list) and depth < 256, malformed + ': an unresolvable evidence part')
        text = []
        for part in parts:
            if isinstance(part, str):
                text.append(part)
                continue
            ref = part.get('ref') if isinstance(part, dict) and set(part) == {'ref'} else None
            require(ref in shared, malformed + ': a missing evidence blob ' + str(ref))
            if ref not in resolved:
                resolved[ref] = resolve(shared[ref], depth + 1)
                require(hashlib.sha256(resolved[ref].encode()).hexdigest()[:24] == ref, malformed + ': evidence blob ' + ref + ' does not match its hash')
            text.append(resolved[ref])
        return ''.join(text)
    return resolve


class KeyedUnion(NamedTuple):
    """The keyed union a regeneration must hold: the entries of the file at SIDE, a commit, when one side left the
    file as OLD_BASE had it or both sides made it the same; else ENTRIES, merged key by key."""
    side: str | None
    entries: dict | None


def keyed_union(root, path, old_base, accepted, base):
    """The keyed union of the slice's (OLD_BASE..ACCEPTED) and the base movement's (OLD_BASE..BASE) entries: a key
    one side changed, added or removed takes that side; a key both sides changed takes their change only if it is
    the same, else it refuses, a removal against a change included (catalog:merge's rule). Blob ids come first: when
    one side left the file as it was, or both made it the same, the union is the other side's file, unread."""
    old_id, slice_id, moved_id = (blob_id(root, commit, path) for commit in (old_base, accepted, base))
    if slice_id in (old_id, moved_id):
        return KeyedUnion(base, None)
    if moved_id == old_id:
        return KeyedUnion(accepted, None)
    before_entries, slice_entries = keyed_entries(root, path, old_base), keyed_entries(root, path, accepted)
    moved = keyed_entries(root, path, base)
    union, conflicts = {}, []
    for key in sorted(set(before_entries) | set(slice_entries) | set(moved)):
        before, ours, theirs = before_entries.get(key), slice_entries.get(key), moved.get(key)
        if ours == before:
            value = theirs
        elif theirs in (before, ours):
            value = ours
        else:
            conflicts.append(key)
            continue
        if value is not None:
            union[key] = value
    require(not conflicts, 'Regenerated rebase proof: the reviewed slice and the base movement change ' + path + ' entries differently: ' +
            ', '.join(conflicts[:5]) + (' and %d more' % (len(conflicts) - 5) if len(conflicts) > 5 else ''))
    return KeyedUnion(None, union)


def keyed_holds(root, path, reviewed, union):
    """REVIEWED's file holds UNION: the same blob as its side, unread, or the same entries."""
    if union.side is not None and blob_id(root, reviewed, path) == blob_id(root, union.side, path):
        return
    expected = union.entries if union.side is None else keyed_entries(root, path, union.side)
    entries = keyed_entries(root, path, reviewed)
    wrong = sorted(key for key in set(entries) | set(expected) if entries.get(key) != expected.get(key))
    require(not wrong, 'Regenerated rebase proof: ' + path + ' at ' + reviewed + ' is not the keyed union of both sides: ' +
            ', '.join(wrong[:5]) + (' and %d more' % (len(wrong) - 5) if len(wrong) > 5 else ''))


PIN_VALUE = re.compile(r'\s*([A-Za-z_$][\w$]*):\s*(\'[^\'\\\n]*\'|"[^"\\\n]*"|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?|true|false|null),')


class PinParts(NamedTuple):
    """The pin file as the lines above START (HEAD), its pinned (key, literal) pairs (LITERALS) with, when asked for,
    each pair's (key, value) (VALUES, pin_value; else None) and the lines from END on (TAIL)."""
    head: list
    literals: list
    values: list | None
    tail: list


@regen_file_step
def pin_parts(root, path, commit):
    """The pin file at COMMIT as its PinParts (regen_decoded), refusing when it is missing."""
    return regen_read(root, path, commit)


def pin_split(path, text, commit):
    """The pin's TEXT as the lines above START, its pinned (key, literal) pairs and the lines from END on."""
    kind, lines = REGEN_PATHS[path], text.split('\n')
    starts = [index for index, line in enumerate(lines) if line == kind.start]
    ends = [index for index, line in enumerate(lines) if starts and index > starts[0] and line == kind.end]
    require(len(starts) == 1 and ends, 'Regenerated rebase proof: ' + path + ' does not hold one CLI pin at ' + commit)
    block, values, at = '\n'.join(lines[starts[0] + 1:ends[0]]), [], 0
    while block[at:].strip():
        match = PIN_VALUE.match(block, at)
        require(match, 'Regenerated rebase proof: ' + path + ' pins a value that is not a literal at ' + commit)
        values.append((match[1], match[2]))
        at = match.end()
    require(len(dict(values)) == len(values) and kind.derived in dict(values),
            'Regenerated rebase proof: ' + path + ' repeats a pinned key or pins no ' + kind.derived + ' at ' + commit)
    return lines[:starts[0]], values, lines[ends[0]:]


class PinHeld(NamedTuple):
    """What the pin comparison holds of one commit's pin: the lines above its block (HEAD), its ROWS (pin_rows), the
    lines from its end on (TAIL) and its derived literal (IDENTITY)."""
    head: list
    rows: list
    tail: list
    identity: str


@regen_file_step
def pin_held(root, path, commit):
    """The pin at COMMIT as its PinHeld, from one read."""
    parts, derived = pin_parts(root, path, commit), REGEN_PATHS[path].derived
    return PinHeld(parts.head, pin_rows(parts.literals, derived), parts.tail, dict(parts.literals)[derived])


def pin_rows(values, derived):
    return [(key, None if key == derived else value) for key, value in values]


def pin_comment(root, path, old_base, accepted):
    """The comment lines the reviewed slice added just above the pin, refusing any other change to the file but the
    derived value (prep-regen.ts pinComment)."""
    derived = REGEN_PATHS[path].derived
    before, after = (pin_held(root, path, commit) for commit in (old_base, accepted))
    added = after.head[len(before.head):]
    require(after.tail == before.tail and after.head[:len(before.head)] == before.head
            and all(re.fullmatch(r'\s*//.*', line) for line in added) and after.rows == before.rows,
            'Regenerated rebase proof: the reviewed slice changes ' + path + ' beyond its pinned ' + derived +
            ' and comment lines above the pin: ' + old_base + '..' + accepted)
    return added


def pin_regenerated(root, path, base, reviewed, added):
    """REVIEWED's pin file is BASE's with the slice's added comment lines (once) and only the derived value changed."""
    derived = REGEN_PATHS[path].derived
    held, regenerated = (pin_held(root, path, commit) for commit in (base, reviewed))
    expected = held.head if not added or held.head[-len(added):] == added else held.head + added
    require(regenerated.head == expected and regenerated.tail == held.tail and regenerated.rows == held.rows,
            'Regenerated rebase proof: the regeneration changes ' + path + ' beyond its pinned ' + derived +
            " and the slice's comment lines: " + base + '..' + reviewed)
    with regen_file(path, reviewed):
        require(re.fullmatch(r"""(['"])sha256:[0-9a-f]{64}\1""", regenerated.identity),
                'Regenerated rebase proof: ' + path + ' pins no sha256 ' + derived + ' at ' + reviewed)


@regen_file_step
def pin_identity(root, path, commit):
    return dict(pin_parts(root, path, commit).literals)[REGEN_PATHS[path].derived].strip('\'"')


def overview_match(path, text, commit):
    matches = list(re.finditer(REGEN_PATHS[path].line, text, re.M))
    require(len(matches) == 1, 'Regenerated rebase proof: ' + path + ' has no single identity line at ' + commit)
    return matches[0]


@regen_file_step
def overview_identity(root, path, commit):
    return overview_match(path, regen_read(root, path, commit), commit)[1]


def rebase_scope(v, config):
    """The accepted review scope a configured rebase proof, mechanical or regenerated, carries to REVIEWED, else None:
    the gate's re-proof, whose one catch (proof_refusal) is around everything it does after finding the proof in the
    parsed CONFIG."""
    if 'rebaseProof' not in config:
        return None
    try:
        return rebase_reproof(v, config, config['rebaseProof'])
    except Exception as error:
        proof = config['rebaseProof'] if isinstance(config['rebaseProof'], dict) else {}
        label = PATCH_LABEL if 'patchEqual' in proof else 'Regenerated rebase proof' if 'regen' in proof else 'Rebase proof'
        refusal = proof_refusal(label, 're-proving the configured rebase', error)
        if refusal is error:
            raise
        raise refusal from error


def rebase_reproof(v, config, proof):
    require_rebase_shape(proof)
    require(config['kind'] == 'code', 'Rebase proof is supported for code gates only')
    with proof_context(step='checking the accepted commit'):
        require_objects(v['WT'], proof['accepted'])
        require(git(v['WT'], 'rev-parse', proof['accepted'] + '^{tree}') == proof['acceptedTree'], 'Rebase proof accepted tree mismatch')
    if 'regen' in proof:
        require('lane' not in config, 'Regenerated rebase proof needs the full suite: it does not combine with the light lane')
    if 'patchEqual' in proof:
        patch_equal_scope(v, proof)
    elif 'regen' in proof:
        summary = regen_proof(v['WT'], proof['oldBase'], proof['accepted'], v['BASE'], v['REVIEWED'])
        require(summary['regen']['paths'] == proof['regen']['paths'], 'Regenerated rebase proof path list mismatch')
    else:
        rebase_proof(v['WT'], proof['oldBase'], proof['accepted'], v['BASE'], v['REVIEWED'])
    return proof['accepted'], proof['acceptedTree']


def patch_equal_scope(v, proof):
    """Re-prove a configured patch-equal proof at REVIEWED: its paths, and its regen field exactly when the overlap
    holds regenerated artifacts, with their paths."""
    summary = patch_equal_proof(v['WT'], proof['oldBase'], proof['accepted'], v['BASE'], v['REVIEWED'])
    require(summary['patchEqual']['paths'] == proof['patchEqual']['paths'], 'Patch-equal rebase proof path list mismatch')
    require('regen' in summary or 'regen' not in proof,
            'Patch-equal rebase proof: the overlap has no regenerated artifact, so the proof takes no regen field')
    require('regen' in proof or 'regen' not in summary, 'Patch-equal rebase proof: the overlap includes the regenerated artifacts ' +
            ', '.join((summary.get('regen') or {}).get('paths', ())) + ', so the proof needs its regen field')
    require('regen' not in proof or summary['regen']['paths'] == proof['regen']['paths'], 'Regenerated rebase proof path list mismatch')
    require('receiptsUnion' in summary or 'receiptsUnion' not in proof,
            "Patch-equal rebase proof: Git's replay does not conflict in the receipts file, so the proof takes no receiptsUnion field")
    require('receiptsUnion' in proof or 'receiptsUnion' not in summary,
            'Patch-equal rebase proof: the receipts file was carried by ' + RECEIPTS_RULE + ', so the proof needs its receiptsUnion field')


def require_rebase_shape(proof):
    """The mechanical form, exactly oldBase, accepted and acceptedTree as full SHAs, optionally with regen
    (require_regen_field), optionally with patchEqual (require_patch_equal_field) and, with patchEqual only,
    optionally with receiptsUnion (exactly rule RECEIPTS_RULE and paths [RECEIPTS])."""
    shas = ('oldBase', 'accepted', 'acceptedTree')
    require(isinstance(proof, dict) and set(proof) - {'regen', 'patchEqual', 'receiptsUnion'} == {*shas}
            and all(isinstance(proof[key], str) and re.fullmatch('[0-9a-f]{40}', proof[key]) for key in shas),
            'Invalid rebase proof: exactly oldBase, accepted and acceptedTree as full SHAs, and optionally patchEqual and regen')
    if 'regen' in proof:
        require_regen_field(proof['regen'])
    if 'patchEqual' in proof:
        require_patch_equal_field(proof['patchEqual'])
    if 'receiptsUnion' in proof:
        require('patchEqual' in proof and proof['receiptsUnion'] == dict(rule=RECEIPTS_RULE, paths=[RECEIPTS]),
                'Invalid receipts-union rebase proof: exactly rule ' + RECEIPTS_RULE + ' and paths [' + RECEIPTS + '], beside patchEqual')


def require_regen_field(regen):
    """Exactly rule REGEN_RULE, a list of paths and a chain of REGEN_CHAINS."""
    require(isinstance(regen, dict) and set(regen) == {'rule', 'paths', 'chain'} and regen['rule'] == REGEN_RULE
            and regen['chain'] in REGEN_CHAINS and isinstance(regen['paths'], list),
            'Invalid regenerated rebase proof: exactly rule ' + REGEN_RULE + ', paths and its chain')


def require_patch_equal_field(equal):
    """Exactly rule PATCH_RULE and paths, a non-empty sorted list of distinct non-empty strings."""
    paths = equal.get('paths') if isinstance(equal, dict) else None
    require(isinstance(equal, dict) and set(equal) == {'rule', 'paths'} and equal['rule'] == PATCH_RULE
            and isinstance(paths, list) and paths and all(isinstance(path, str) and path for path in paths) and paths == sorted(set(paths)),
            'Invalid patch-equal rebase proof: exactly rule ' + PATCH_RULE + ' and paths, a non-empty sorted list')


def rebase_suffix(proof):
    """The completion scope's account of a configured rebase proof."""
    scope = '; reviews accepted at ' + proof['accepted'] + ' on ' + proof['oldBase'] + ' carried by the mechanical-rebase proof'
    union = proof.get('receiptsUnion', {}).get('paths', [])
    merged = [path for path in proof.get('patchEqual', {}).get('paths', []) if path not in union]
    if merged:
        scope += (' with ' + ', '.join(merged) + ' merged by Git (' + proof['patchEqual']['rule'] +
                  ": each replayed commit has its reviewed patch-id and message, and REVIEWED is Git's clean merge there)")
    if union:
        scope += ((' and ' if merged else ' with ') + ', '.join(union) + ' carried by ' + proof['receiptsUnion']['rule'] +
                  " (the base's receipts followed by the slice's, in the record step's writer's bytes)")
    if 'regen' in proof:
        scope += ((' and ' if merged or union else ' with ') + ', '.join(proof['regen']['paths']) + ' regenerated (' +
                  proof['regen']['rule'] + ': ' + proof['regen']['chain'] + '; rows unchanged, keyed files the union of both sides)')
    return scope


def carry_proof(root, frame_base, carried, carried_tree, head):
    """Prove from Git objects that CARRIED lies strictly inside the fix review's linear chain FRAME_BASE..HEAD,
    and name the paths of the delta CARRIED..HEAD the fix review covers."""
    for commit in (carried, frame_base, head):
        require(git_holds(root, 'cat-file', '-e', commit + '^{commit}'), 'Carried review object missing: ' + commit)
    require(git(root, 'rev-parse', carried + '^{tree}') == carried_tree, 'Carried review tree mismatch')
    chain = rebase_chain(root, frame_base, head, label='Carried review')
    require(carried in chain and carried != head, "Carried commit is not in the fix review's chain: " + frame_base + '..' + head)
    names = git_bytes(root, 'diff-tree', '-r', '--no-renames', '--name-only', '-z', carried, head).split(b'\0')
    return dict(base=frame_base, carried=carried, head=head, paths=sorted(name.decode() for name in names if name))


def carried_review(config):
    """The configured single-axis carried review, validated, else None."""
    if 'carriedReview' not in config:
        return None
    carry = config['carriedReview']
    full = lambda value: isinstance(value, str) and re.fullmatch('[0-9a-f]{40}', value)
    require(isinstance(carry, dict) and set(carry) == {'axis', 'commit', 'tree', 'attestation'}
            and carry['axis'] in ('standards', 'spec') and full(carry['commit']) and full(carry['tree'])
            and isinstance(carry['attestation'], dict) and set(carry['attestation']) == {'path', 'sha256'}
            and all(isinstance(value, str) and value for value in carry['attestation'].values()),
            'Invalid carried review: exactly axis (standards or spec), commit and tree as full SHAs, and attestation {path, sha256}')
    require(config['kind'] == 'code', 'Carried review is supported for code gates only')
    return carry


def commit_message(root, commit):
    return git_bytes(root, 'cat-file', 'commit', commit).partition(b'\n\n')[2]


def conditional_proof(root, frame_base, commit, tree, head):
    """Prove from Git objects that HEAD repairs the conditionally landed commit E (COMMIT) in the linear chain
    FRAME_BASE..HEAD, and name what the repair E..HEAD changes. E lies strictly inside the chain ('descendant':
    later commits make the repair), or E is the chain's tip before an amend ('amend': E and HEAD share their sole
    parent, as when a count or a curation prep commit's message is repaired in place)."""
    for sha in (commit, frame_base, head):
        require(git_holds(root, 'cat-file', '-e', sha + '^{commit}'), 'Conditional LAND object missing: ' + sha)
    require(git(root, 'rev-parse', commit + '^{tree}') == tree, 'Conditional LAND tree mismatch')
    require(commit != head, 'Conditional LAND needs a repair: its commit is the head ' + head)
    chain = rebase_chain(root, frame_base, head, label='Conditional LAND')
    if commit in chain:
        relation, message = 'descendant', False
    else:
        tip_parent = chain[-2] if len(chain) > 1 else frame_base
        require(git(root, 'rev-list', '--parents', '-1', commit).split() == [commit, tip_parent],
                'Conditional LAND commit is neither in the chain nor amended at its tip: ' + frame_base + '..' + head)
        relation, message = 'amend', commit_message(root, commit) != commit_message(root, head)
    names = git_bytes(root, 'diff-tree', '-r', '--no-renames', '--name-only', '-z', commit, head).split(b'\0')
    return dict(base=frame_base, commit=commit, head=head, relation=relation,
                paths=sorted(name.decode() for name in names if name), message=message)


CONDITIONAL_KEYS = {'axes', 'commit', 'tree', 'paths', 'message', 'attestation'}
CONDITIONAL_ATTESTATION_KEYS = {'version', 'kind', 'axes', 'commit', 'head', 'relation', 'paths', 'message', 'check',
                                'statement', 'attestedBy'}


def sorted_names(value):
    """A sorted list of unique non-empty strings."""
    return isinstance(value, list) and all(isinstance(item, str) and item for item in value) and value == sorted(set(value))


def full_sha(value):
    return isinstance(value, str) and re.fullmatch('[0-9a-f]{40}', value) is not None


def reference_shape(value):
    return isinstance(value, dict) and set(value) == {'path', 'sha256'} and all(isinstance(item, str) and item for item in value.values())


def conditional_land(config):
    """The configured conditional-LAND binding, validated, else None."""
    if 'conditionalLand' not in config:
        return None
    land = config['conditionalLand']
    axes = ('standards', 'spec') if config['kind'] == 'code' else ('curation',)
    require(isinstance(land, dict) and set(land) == CONDITIONAL_KEYS
            and sorted_names(land['axes']) and land['axes'] and set(land['axes']) <= set(axes)
            and full_sha(land['commit']) and full_sha(land['tree']) and sorted_names(land['paths'])
            and type(land['message']) is bool and (land['paths'] or land['message']) and reference_shape(land['attestation']),
            "Invalid conditional LAND: exactly axes (sorted, the gate kind's review axes), commit and tree as full SHAs, "
            'paths (sorted, unique), message (true or false), at least one named repair, and attestation {path, sha256}')
    require('carriedReview' not in config, 'Conditional LAND does not combine with a carried review')
    return land


# A conditional LAND's scope is a separate JSON file the reviewer writes next to the report
# (`<axis>-conditional.json`), bound by {path, sha256} as the review record's `conditional`:
#   {"version": 1, "verdict": "land-once-fixed", "reviewed": "<full E SHA>", "paths": [...], "message": false, "check": "..."}
# Only these files grant scope. Report Markdown is never read for scope (root, fix round 3).
CONDITIONAL_FILE_KEYS = {'version', 'verdict', 'reviewed', 'paths', 'message', 'check'}


def strict_json(path):
    """One JSON document, refusing a repeated key instead of keeping the last value."""
    def unique(pairs):
        keys = [key for key, _ in pairs]
        if len(set(keys)) != len(keys):
            raise ValueError('repeated key')
        return dict(pairs)
    return json.loads(Path(path).read_text(), object_pairs_hook=unique)


def conditional_file(review, axis, commit):
    """The scope one review's bound conditional file grants: (paths, message)."""
    invalid = 'Invalid conditional file for ' + axis + ': '
    bound = review['conditional']
    require(reference_shape(bound), invalid + 'the review binds it as {path, sha256}')
    require(Path(bound['path']).is_file(), 'Conditional file missing for ' + axis + ': ' + bound['path'])
    verify_reference(bound)
    try:
        value = strict_json(bound['path'])
    except ValueError as exc:
        raise RuntimeError(invalid + 'not one JSON object (' + str(exc) + ')') from None
    require(isinstance(value, dict) and set(value) == CONDITIONAL_FILE_KEYS,
            invalid + 'exactly version, verdict, reviewed, paths, message and check')
    require(type(value['version']) is int and value['version'] == 1, invalid + 'version must be 1')
    require(value['verdict'] == 'land-once-fixed', invalid + 'verdict must be "land-once-fixed"')
    require(full_sha(value['reviewed']), invalid + 'reviewed must be a full SHA')
    require(value['reviewed'] == review.get('commit') == commit, 'Conditional file for ' + axis + ' reviewed ' + value['reviewed'] +
            ', not the bound commit ' + str(review.get('commit')) + ' and E ' + commit)
    require(sorted_names(value['paths']), invalid + 'paths must be a sorted list of unique repo paths')
    require(type(value['message']) is bool, invalid + 'message must be true or false')
    require(value['paths'] or value['message'], invalid + 'it permits nothing (no paths and message false)')
    require(isinstance(value['check'], str) and value['check'].strip(), invalid + 'check must be a non-empty string')
    return set(value['paths']), value['message']


def reviewed_scope(config, land):
    """The union of the scopes the listed reviews' bound conditional files grant at E. A listed review without
    one is an ordinary LAND at E and grants nothing; at least one must grant. The configuration and the
    attestation can only narrow the union."""
    paths, message, granted = set(), False, []
    for axis in land['axes']:
        review = config['reviews'][axis]
        if 'conditional' in review:
            more, allowed = conditional_file(review, axis, land['commit'])
            paths, message = paths | more, message or allowed
            granted.append(axis)
    require(granted, 'Conditional LAND scope missing: no listed review binds a conditional file (' + ', '.join(land['axes']) + ')')
    return paths, message


def require_listed_conditional_files(config, land):
    """Only a review conditionalLand lists may bind a conditional file."""
    listed = land['axes'] if land is not None else []
    stray = sorted(axis for axis, review in config['reviews'].items() if 'conditional' in review and axis not in listed)
    require(not stray, 'Conditional file bound to a review conditionalLand does not list: ' + ', '.join(stray))


def require_within(proof, scope, land):
    """The repair is inside the reviewed scope, and the configuration names it exactly."""
    commit, head = land['commit'], proof['head']
    beyond = sorted(set(proof['paths']) - scope[0])
    require(not beyond, 'Conditional LAND exceeds the reviewed scope: the repair ' + commit + '..' + head + ' changes ' + str(beyond) +
            ' beyond the conditional files\' ' + str(sorted(scope[0])))
    require(not proof['message'] or scope[1], 'Conditional LAND exceeds the reviewed scope: no conditional file permits a message change')
    require(proof['paths'] == land['paths'], 'Conditional LAND path mismatch: the repair ' + commit + '..' + head + ' changes ' +
            str(proof['paths']) + ', not the named ' + str(land['paths']))
    if proof['message'] != land['message']:
        raise RuntimeError('Conditional LAND message mismatch: ' + ('the repair changes the commit message, which the conditional did not name'
                                                                    if proof['message'] else 'the named message repair is absent'))


def require_attestation(v, land, proof):
    """Root's attestation of the mechanical check agrees with Git and the configuration."""
    path = land['attestation']['path']
    require(Path(path).is_file(), 'Conditional LAND attestation missing: ' + path)
    verify_reference(land['attestation'])
    attestation = load(path)
    mismatch = lambda key: 'Conditional LAND attestation mismatch: ' + key
    require(isinstance(attestation, dict) and set(attestation) == CONDITIONAL_ATTESTATION_KEYS, mismatch('keys'))
    for key, expected in (('version', 1), ('kind', 'conditional-land'), ('axes', land['axes']), ('commit', land['commit']),
                          ('head', proof['head']), ('relation', proof['relation']), ('paths', proof['paths']), ('message', proof['message'])):
        require(type(attestation[key]) is type(expected) and attestation[key] == expected, mismatch(key))
    check = attestation['check']
    require(isinstance(check, dict) and set(check) == {'command', 'output', 'commit'}
            and all(isinstance(check[key], str) and check[key].strip() for key in ('command', 'output'))
            and check['commit'] == v['REVIEWED'], mismatch('check'))
    for key in ('statement', 'attestedBy'):
        require(isinstance(attestation[key], str) and attestation[key].strip(), mismatch(key))


def conditional_scope(v, config, land, rebase):
    """Verify the conditional LAND against Git, the scope its reviews' bound conditional files grant and root's attestation
    of the mechanical check; return the (axes, commit, tree) those reviews must bind. The repaired head is REVIEWED,
    or with a mechanical-rebase proof the accepted commit on the old base (fix first, rebase last)."""
    frame_base, head = (v['BASE'], v['REVIEWED']) if rebase is None else (config['rebaseProof']['oldBase'], rebase[0])
    proof = conditional_proof(v['WT'], frame_base, land['commit'], land['tree'], head)
    require_within(proof, reviewed_scope(config, land), land)
    require_attestation(v, land, proof)
    return land['axes'], land['commit'], land['tree']


def light_lane_scope(v, config):
    """The configured light landing lane, re-proved from Git objects for REVIEWED on BASE, else None.
    Any refusal raises before the attempt directory exists; nothing falls back."""
    if 'lane' not in config:
        return None
    lane = config['lane']
    require(isinstance(lane, dict) and set(lane) == {'mode', 'rule', 'paths'} and lane['mode'] == 'light'
            and isinstance(lane['paths'], list) and all(isinstance(path, str) for path in lane['paths']),
            'Invalid lane: exactly mode "light", rule and paths')
    import light_lane
    require(lane['rule'] == light_lane.RULE, 'Light lane rule mismatch: ' + str(lane['rule']))
    require(config['kind'] == 'code', 'Light lane is supported for code gates only')
    require('remoteChecks' not in config, 'Light lane does not combine with remote checks')
    proof = light_lane.verify(v['WT'], v['BASE'], v['REVIEWED'])
    require(proof['tree'] == v['TREE'] and [row['path'] for row in proof['paths']] == lane['paths'], 'Light lane path list mismatch')
    return proof


def carry_scope(v, config, carry, rebase):
    """Verify the carried review against the fix review's frame, its report and root's attestation;
    return the (axis, commit, tree) the carried axis must bind."""
    axis, carried = carry['axis'], carry['commit']
    fixer = 'standards' if axis == 'spec' else 'spec'
    fix = config['reviews'][fixer]
    frames = {(v['REVIEWED'], v['TREE']): (v['BASE'], v['REVIEWED'])}
    if rebase is not None:
        frames[rebase] = (config['rebaseProof']['oldBase'], rebase[0])
    bound = (fix.get('commit'), fix.get('tree'))
    require(bound in frames, 'Wrong reviewed scope: ' + fixer)
    frame_base, head = frames[bound]
    proof = carry_proof(v['WT'], frame_base, carried, carry['tree'], head)
    verify_reference(fix['report'])
    require((carried + '..' + head).encode() in Path(fix['report']['path']).read_bytes(),
            'Fix review report does not name the delta ' + carried + '..' + head)
    verify_reference(carry['attestation'])
    attestation = load(carry['attestation']['path'])
    require(isinstance(attestation, dict) and set(attestation) == {'version', 'axis', 'carried', 'head', 'paths', 'statement', 'attestedBy'},
            'Carried review attestation mismatch: keys')
    for key, expected in (('version', 1), ('axis', axis), ('carried', carried), ('head', head), ('paths', proof['paths'])):
        require(type(attestation[key]) is type(expected) and attestation[key] == expected, 'Carried review attestation mismatch: ' + key)
    for key in ('statement', 'attestedBy'):
        require(isinstance(attestation[key], str) and attestation[key].strip(), 'Carried review attestation mismatch: ' + key)
    return axis, carried, carry['tree']


SCRIPT_OPERATOR = 'scripts/orchestration/gate-run.py'
SCRIPT_OPERATOR_KEYS = {'kind', 'path', 'commit', 'blob', 'taskId', 'runId'}


def script_operator_task_id(blob):
    return 'script:' + SCRIPT_OPERATOR + '@' + blob


def prepared_under_config(v):
    """Whether this attempt already completed preparation under exactly this configuration."""
    prepared = Path(v['E']) / 'prepared.json'
    return prepared.is_file() and not prepared.is_symlink() and load(prepared).get('config') == reference(v['CONFIG'])


def operator_identity(v, task):
    """The gate operator: MAIN's committed driver script at BASE (path and blob), or, for an attempt
    already prepared under it, the earlier codex operator task. Returns 'script' or 'codex'."""
    if task.get('kind') == 'script':
        require(set(task) == SCRIPT_OPERATOR_KEYS, 'Script operator identity mismatch: keys')
        require(task['path'] == v['MAIN'] + '/' + SCRIPT_OPERATOR, 'Script operator identity mismatch: path')
        require(task['commit'] == v['BASE'], 'Script operator identity mismatch: commit is not BASE')
        require(isinstance(task['blob'], str) and re.fullmatch('[0-9a-f]{40}', task['blob'])
                and git_holds(v['MAIN'], 'cat-file', '-e', v['BASE'] + ':' + SCRIPT_OPERATOR)
                and git(v['MAIN'], 'rev-parse', v['BASE'] + ':' + SCRIPT_OPERATOR) == task['blob'],
                'Script operator identity mismatch: blob is not the committed driver at BASE')
        require(task['taskId'] == script_operator_task_id(task['blob']), 'Script operator identity mismatch: taskId')
        require(isinstance(task['runId'], str) and task['runId'], 'Script operator identity mismatch: runId')
        return 'script'
    require(prepared_under_config(v), 'Codex operator identity is accepted only for an attempt already prepared under it; '
            'new gates use the script operator (' + SCRIPT_OPERATOR + ')')
    require(task.get('taskId') and (task.get('childRunId') or task.get('runId')), 'Actual operator task/run required')
    require(task.get('providerInstanceId') == 'codex' and task.get('model') == 'gpt-6.1-sol'
            and task_options(task) == dict(reasoningEffort='high', serviceTier='default'), 'Wrong operator model/options')
    return 'codex'


def authorization(v, full_validation=False):
    config = load(v['CONFIG'])
    verify_reference(config['resourcePolicy'])
    verify_reference(config['storageBaseline'])
    for name in ('message', 'mapping'):
        if name in config['preparation']:
            verify_reference(config['preparation'][name])
    require(config['resourcePolicy']['path'] == v['ORCH'] + '/resource-policy.md', 'Shared resource policy required')
    require(config.get('phases') and len(set(config['phases'])) == len(config['phases'])
            and set(config['phases']) <= set(PHASES), 'Invalid authorized phases')
    carried = rebase_scope(v, config)
    carry = carried_review(config)
    land = conditional_land(config)
    require_listed_conditional_files(config, land)
    light_lane_scope(v, config)
    verify_validation(v, config, full=full_validation)
    if 'remoteChecks' in config:
        verify_remote_checks(v, config)
        curation_remote_scope(v, config)
    host_audits_receipt(v, config)
    author = config['author']
    verify_reference(author)
    authorship = load(author['path'])
    require(authorship.get('taskId') and authorship.get('providerInstanceId') and authorship.get('model'), 'Actual author identity required')
    require(authorship.get('childRunId') or authorship.get('runId'), 'Actual author run identity required')
    task_options(authorship)
    operator = config['operator']
    verify_reference(operator)
    task = load(operator['path'])
    operator_identity(v, task)
    axes = ('standards', 'spec') if config['kind'] == 'code' else ('curation',)
    require(set(config['reviews']) == set(axes), 'Missing/extra review axis')
    if 'submit' in config['phases']:
        require({'observe', 'collect', 'checked-land'} <= set(config['phases']), 'Submission requires observe, collect and checked-land authorization')
    if carry is not None:
        carry = carry_scope(v, config, carry, carried)
    if land is not None:
        land = conditional_scope(v, config, land, carried)
    tasks, carried_axes = [], []
    for axis in axes:
        review = config['reviews'][axis]
        verify_reference(review['task'])
        verify_reference(review['report'])
        actual = load(review['task']['path'])
        expected = review['target']
        require(review.get('disposition') == 'accepted' and review.get('unresolved') == [], 'Unresolved review: ' + axis)
        if carry is not None and axis == carry[0]:
            require((review.get('commit'), review.get('tree')) == carry[1:], 'Wrong carried scope: ' + axis)
        elif land is not None and axis in land[0]:
            require((review.get('commit'), review.get('tree')) == land[1:], 'Wrong conditional LAND scope: ' + axis)
        elif carried is not None and (review.get('commit'), review.get('tree')) == carried:
            carried_axes.append(axis)
        else:
            require(review.get('commit') == v['REVIEWED'] and review.get('tree') == v['TREE'], 'Wrong reviewed scope: ' + axis)
        require(actual.get('taskId') == review['taskId'] and actual.get('childRunId') == review['runId']
                and actual.get('latestTerminalRunId') == review['runId'], 'Review task/run mismatch: ' + axis)
        require(actual.get('status') == 'completed' and actual.get('latestTerminalStatus') == 'completed'
                and actual.get('hasPendingChildRuns') is False, 'Review not terminal: ' + axis)
        require(actual.get('providerInstanceId') == expected['providerInstanceId']
                and actual.get('model') == expected['model'] and task_options(actual) == expected['options'], 'Reviewer identity/options mismatch')
        require(actual.get('model') != authorship['model'], 'Review must cross the actual author model')
        tasks.append(actual['taskId'])
    # A conditional LAND repaired before the rebase uses the proof for its repaired head.
    require(carried is None or carried_axes or land is not None, 'Unused rebase proof: no review binds the accepted commit')
    require(len(set(tasks)) == len(tasks) and task['taskId'] not in tasks and authorship['taskId'] not in tasks, 'Independent review tasks required')
    return config


def execution_control(v, step=None):
    config = load(v['CONFIG'])
    phase = {'monitor': 'observe', 'finalize': 'complete'}.get(step, step)
    require(phase in config['phases'], 'Phase not authorized: ' + str(phase))
    if phase == 'submit':
        require({'observe', 'collect', 'checked-land'} <= set(config['phases']), 'Submission requires observe, collect and checked-land authorization')
    operator = load(config['operator']['path'])
    external_path(config['control'], v['MAIN'], v['ORCH'])
    require(Path(config['control']).is_file() and not Path(config['control']).is_symlink(), 'Unsafe execution control')
    control = load(config['control'])
    require(control.get('state') in ('active', 'finish-current', 'stopped'), 'Invalid execution state')
    require(control.get('taskId') == operator['taskId']
            and control.get('runId') == (operator.get('childRunId') or operator.get('runId')), 'Execution control identity mismatch')
    require(control.get('reviewed') == v['REVIEWED'] and control.get('tree') == v['TREE']
            and control.get('base') == v['BASE'], 'Execution control scope mismatch')
    if control['state'] == 'stopped':
        raise PauseRequested(phase, 'Execution stopped')
    if phase == 'submit':
        if control['state'] != 'active':
            raise PauseRequested(phase, 'Detached submission requires continuing observation authority')
    if control['state'] == 'finish-current':
        allowed = control.get('phase') == phase or (control.get('phase') == 'observe' and phase == 'collect')
        if not allowed:
            raise PauseRequested(phase)
    return control


def check_identity(v, candidate, allow_landed=False):
    worker = identity(v['WT'])
    with landing_read(v):
        main = identity(v['MAIN'])
    require(worker == dict(commit=candidate, tree=v['TREE'], branch=v['BR'], worktree=v['WT'], status=''), 'Candidate changed/dirty')
    allowed = (v['BASE'], candidate) if allow_landed else (v['BASE'],)
    require(main['commit'] in allowed and main['branch'] == v['FEATURE'] and not main['status'], 'Integration changed/dirty')
    require(git(v['WT'], 'rev-parse', '--path-format=absolute', '--git-common-dir') ==
            git(v['MAIN'], 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'Different repository')
    require('worktree ' + v['WT'] in git(v['MAIN'], 'worktree', 'list', '--porcelain').splitlines(), 'Unregistered worktree')
    require(git(v['WT'], 'merge-base', v['BASE'], v['REVIEWED']) == v['BASE'], 'Reviewed base ancestry mismatch')
    return dict(candidate=worker, main=main)


def mapping(v):
    saved = load(Path(v['E']) / 'mapping.json')
    for key in ('BASE', 'REVIEWED', 'TREE', 'BR', 'WT', 'ARCHIVE'):
        require(saved.get(key) == v[key], 'Prepared mapping mismatch: ' + key)
    candidate = saved['SQUASHED']
    require(re.fullmatch('[0-9a-f]{40}', candidate), 'Invalid prepared commit')
    require(git(v['WT'], 'rev-parse', candidate + '^{tree}') == v['TREE'], 'Prepared tree mismatch')
    require(git(v['WT'], 'rev-list', '--parents', '-1', candidate) == candidate + ' ' + v['BASE'], 'Prepared parent mismatch')
    require(git(v['WT'], 'rev-parse', v['REVIEWED'] + '^{tree}') == v['TREE'], 'Reviewed tree mismatch')
    require(not git(v['WT'], 'diff', '--no-ext-diff', '--no-textconv', v['REVIEWED'], candidate, '--'), 'Prepared content changed')
    require(git(v['WT'], 'rev-parse', v['ARCHIVE']) == v['REVIEWED'], 'Reviewed archive moved')
    return saved


def snapshot(v):
    manifest = load(Path(v['E']) / 'snapshot.json')
    root = Path(v['SNAP'])
    files = {str(path.relative_to(root)) for path in root.rglob('*') if path.is_file()}
    require(files == set(manifest['files']) | {'queue.log'}, 'Snapshot file set changed')
    for name, expected in manifest['files'].items():
        path = root / name
        require(not path.is_symlink() and sha(path) == expected['sha256']
                and path.stat().st_mode & 0o777 == expected['mode'], 'Snapshot changed: ' + name)
    for item in manifest['external']:
        verify_reference(item)
    base = manifest.get('baseRuntime')
    if base:
        require(base['commit'] == v['BASE'] and git(v['MAIN'], 'rev-parse', v['BASE'] + '^{tree}') == base['tree'], 'Base runtime identity changed')
        entries = git(v['MAIN'], 'ls-tree', '-r', v['BASE'], '--', 'scripts/orchestration').splitlines()
        require(entries == base['entries'], 'Base runtime Git provenance changed')
        for item in base['files']:
            path = Path(v['E']) / 'base-runtime' / item['path'].removeprefix('scripts/orchestration/')
            require(not path.is_symlink() and path.stat().st_mode & 0o777 == item['frozenMode'], 'Frozen base runtime mode changed')
            raw = path.read_bytes()
            require(hashlib.sha256(raw).hexdigest() == item['sha256']
                    and hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == item['blob'], 'Frozen base object changed')
    for name, expected in manifest.get('operatorRuntime', {}).items():
        path = Path(v['E']) / 'operator-runtime' / name
        require(sha(path) == expected['sha256'] and path.stat().st_mode & 0o777 == expected['mode'], 'Frozen operator runtime changed: ' + name)
    path, tools = execution_tools(tuple(manifest['tools'])) if manifest['tools'] else (os.environ.get('PATH'), {})
    require(tools == manifest['tools'], 'Executable changed')
    if manifest['environment'] != {**{key: os.environ.get(key) for key in ('LANG', 'LC_ALL', 'TZ')}, 'PATH':path}:
        raise CollectorContextMismatch('Public environment changed; use the frozen operator environment')
    return manifest


def verify_validation(v, config, full=False):
    from validation import verify, shared_context
    contract = config['validation']
    verify_reference(contract['plan'])
    plan_path = contract['plan']['path']
    plan = load(plan_path)
    require(plan.get('version') == 1 and plan.get('fullQueueRequired') is True and isinstance(plan.get('checks'), dict), 'Invalid validation plan contract')
    require(all(plan[name] == v[key] for name, key in [('main', 'MAIN'), ('orch', 'ORCH'), ('worktree', 'WT'), ('base', 'BASE')]), 'Validation plan scope mismatch')
    require(set(contract['receipts']) == set(plan['checks']), 'Every planned reuse check needs its original receipt')
    shared = shared_context(plan) if full and contract['receipts'] else None
    for name, item in contract['receipts'].items():
        verify_reference(item)
        verify(plan_path, name, item['path'], full=full, shared=shared)


def verify_remote_checks(v, config):
    """A configured remote heavy-check manifest binds the exact reviewed or prepared candidate. A curation
    candidate is REVIEWED itself (the prep commit is kept, never squashed), so only REVIEWED binds there."""
    from remote_checks import config as remote_config, verify_manifest
    remote = remote_config(config['remoteChecks'])
    commits = {v['REVIEWED']}
    if config['kind'] != 'curation' and (Path(v['E']) / 'mapping.json').is_file():
        commits.add(load(Path(v['E']) / 'mapping.json')['SQUASHED'])
    verify_manifest(remote['path'], remote['sha256'], v['TREE'], v['BASE'], v['WT'], v['ORCH'], commits)
    return remote


def host_audits_receipt(v, config, live=False):
    """gate.json hostAuditsReceipt {path, sha256} (speed-host-audits-parallel; owner 2026-11-07, item 3): the receipt root's
    host-audits.sh --receipt wrote while CI ran, verified for the exact candidate (remote_checks.verify_receipt) against the
    configured manifest's list. Only a replace gate takes one. Static at every authorization; live (this host's toolchain
    and sources) where the driver prechecks it and the queue uses it. None without the field."""
    if 'hostAuditsReceipt' not in config:
        return None
    receipt = config['hostAuditsReceipt']
    require(isinstance(receipt, dict) and set(receipt) == {'path', 'sha256'} and all(isinstance(receipt[key], str) for key in receipt),
            'Invalid hostAuditsReceipt config')
    remote = config.get('remoteChecks')
    require(isinstance(remote, dict) and remote.get('mode') == 'replace', 'A host-audits receipt needs remote checks in replace mode')
    from remote_checks import load as load_manifest, verify_receipt
    manifest = load_manifest(remote['path'], remote['sha256'], v['ORCH'])
    return verify_receipt(receipt['path'], receipt['sha256'], v['TREE'], v['BASE'], v['WT'], v['ORCH'], manifest['hostAudits']['sha256'],
                          v['MAIN'], live=live)


def prep_receipt_path(orch, issue, remote=False):
    """prep-lib.sh's prep_receipt_path: the local prep's receipt, or the remote-suite prep's."""
    return str(Path(orch) / 'logs' / ('cur-%d-prep%s.receipt' % (issue, '.remote' if remote else '')))


# The fields the gate reads from a remote-suite prep receipt; each must appear exactly once, as must every other key.
REMOTE_RECEIPT_FIELDS = ('issue', 'result', 'commit', 'tree', 'base', 'integrationBase', 'tests', 'testLog', 'testLogSha256')


def remote_prep_receipt(path):
    """A remote-suite prep receipt's key=value lines, refusing a repeated key, a line that is not key=value, a missing
    field, a failed prep, a local-mode receipt or a named test log. Values are never evaluated."""
    malformed = 'Malformed curation remote-suite prep receipt ' + path + ': '
    try:
        lines = Path(path).read_bytes().decode('utf-8').splitlines()
    except UnicodeDecodeError:
        raise RuntimeError(malformed + 'not UTF-8 text') from None
    fields = {}
    for number, line in enumerate(lines, 1):
        key, separator, value = line.partition('=')
        require(separator and re.fullmatch('[A-Za-z][A-Za-z0-9]*', key), malformed + 'line %d is not key=value' % number)
        require(key not in fields, malformed + 'repeated key ' + key)
        fields[key] = value
    missing = [key for key in REMOTE_RECEIPT_FIELDS if key not in fields]
    require(not missing, malformed + 'missing ' + ', '.join(missing))
    require(fields['result'] == 'ok', malformed + 'result is not ok')
    require(fields['tests'] == 'remote', malformed + 'tests is not remote')
    require(fields['testLog'] == '-' and fields['testLogSha256'] == '-', malformed + 'tests=remote names a test log')
    return fields


def curation_remote_scope(v, config):
    """For a curation gate with remote checks, the remote-suite prep receipt gate.json pins (preservedEvidence, by path
    and sha256) joined with the gate: its issue is the gate's, its commit REVIEWED (the candidate and the manifest's
    Gate-Reviewed), its tree TREE and its base and integration head BASE. None for any other gate. Every refusal
    raises; nothing falls back to a local prep."""
    if config['kind'] != 'curation' or 'remoteChecks' not in config:
        return None
    issue = config.get('issue')
    require(type(issue) is int and issue > 0, 'Curation issue required')
    path = prep_receipt_path(v['ORCH'], issue, remote=True)
    pinned = [item for item in config.get('preservedEvidence', []) if isinstance(item, dict) and item.get('path') == path]
    require(len(pinned) == 1 and reference_shape(pinned[0]),
            'Curation remote checks need the remote-suite prep receipt pinned once in preservedEvidence: ' + path)
    require(Path(path).is_file() and not Path(path).is_symlink(), 'Curation remote-suite prep receipt missing: ' + path)
    verify_reference(pinned[0])
    receipt = remote_prep_receipt(path)
    for key, expected in (('issue', str(issue)), ('commit', v['REVIEWED']), ('tree', v['TREE']), ('base', v['BASE']),
                          ('integrationBase', v['BASE'])):
        require(receipt[key] == expected, 'Curation remote-suite prep receipt mismatch: %s %s, not %s' % (key, receipt[key], expected))
    return dict(receipt=path, issue=issue, commit=v['REVIEWED'], tree=v['TREE'], base=v['BASE'])


def owned_invocation(v):
    """Cancellation/collection proof independent of mutable controls and failed validation."""
    root = Path(v['E'])
    value = load(root / 'owned-invocation.json')
    require(value['claim']['path'] == str(root / 'submission-claim.json'), 'Wrong invocation claim path')
    verify_reference(value['claim'])
    claim = load(value['claim']['path'])
    require(all(claim[name] == v[key] for name, key in [('attempt', 'E'), ('label', 'LABEL'), ('main', 'MAIN'), ('orch', 'ORCH')]), 'Wrong invocation owner scope')
    require(re.fullmatch(re.escape(claim['label']) + r'-\d{8}-\d{6}-[0-9a-f]{6}', value['id']), 'Invalid owned invocation ID')
    require(value['unit'] == 'ep-fresh-' + value['id'] and value['log'] == claim['orch'] + '/logs/bounded-' + value['id'] + '.log', 'Owned invocation mapping mismatch')
    require(value['candidate'] == claim['candidate'], 'Owned candidate mismatch')
    return {**value, 'invocationId': value['id']}


def submission(v):
    result = load(Path(v['E']) / 'submission.json')
    owned = owned_invocation(v)
    require(all(result[key] == owned[key] for key in ('id', 'unit', 'log', 'candidate')), 'Submission differs from owned invocation')
    require(re.fullmatch(re.escape(v['LABEL']) + r'-\d{8}-\d{6}-[0-9a-f]{6}', result['id']), 'Invalid canonical invocation ID')
    require(result['unit'] == 'ep-fresh-' + result['id']
            and result['log'] == v['ORCH'] + '/logs/bounded-' + result['id'] + '.log', 'Canonical invocation mapping mismatch')
    require(result['candidate'] == mapping(v)['SQUASHED'], 'Invocation candidate mismatch')
    return {**result, 'invocationId': result['id']}


def preflight(mode, values=None):
    # The qualified monitor calls authorization/control/snapshot as separate complete phases.
    # Its preflight owns only frozen preparation and coherent identity, avoiding duplicate work.
    v = values or env()
    if mode != 'monitor':
        authorization(v, full_validation=mode in ('prepare', 'submit', 'complete') or (mode == 'collect' and 'complete' not in load(v['CONFIG'])['phases']))
        if mode != 'collect':
            execution_control(v, step={'finalize': 'complete'}.get(mode, mode))
    if (Path(v['E']) / 'prepared.json').exists():
        prepared = load(Path(v['E']) / 'prepared.json')
        require(prepared['config'] == reference(v['CONFIG']), 'Frozen config changed')
        for item in prepared['bindings']:
            verify_reference(item)
        candidate = mapping(v)['SQUASHED']
        check_identity(v, candidate, allow_landed=mode in ('monitor', 'observe', 'collect', 'complete'))
        if mode != 'monitor':
            snapshot(v)
    if mode == 'collect':
        # Diagnose identity/frozen-input tampering before classifying a caller pause.
        execution_control(v, step='collect')
    return v
