"""Bindings for one parameterized local queue attempt; historical bundles are read-only."""
import json
import os
from pathlib import Path
import re
import hashlib
import shutil
import subprocess
from workflow_evidence import (command, create_json as save, digest as sha, external_path,
                               git, identity, now, public_path, read_json as load,
                               reference, require, verify_reference, landing_read, execution_tools, CollectorContextMismatch)

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


def rebase_scope(v, config):
    """The accepted review scope a configured mechanical-rebase proof carries to REVIEWED, else None."""
    if 'rebaseProof' not in config:
        return None
    proof = config['rebaseProof']
    require(isinstance(proof, dict) and set(proof) == {'oldBase', 'accepted', 'acceptedTree'}
            and all(isinstance(value, str) and re.fullmatch('[0-9a-f]{40}', value) for value in proof.values()),
            'Invalid rebase proof: exactly oldBase, accepted and acceptedTree as full SHAs')
    require(config['kind'] == 'code', 'Rebase proof is supported for code gates only')
    require_objects(v['WT'], proof['accepted'])
    require(git(v['WT'], 'rev-parse', proof['accepted'] + '^{tree}') == proof['acceptedTree'], 'Rebase proof accepted tree mismatch')
    rebase_proof(v['WT'], proof['oldBase'], proof['accepted'], v['BASE'], v['REVIEWED'])
    return proof['accepted'], proof['acceptedTree']


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
