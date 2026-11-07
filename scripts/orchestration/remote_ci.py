#!/usr/bin/env python3
"""Heavy checks for a gate/<label> candidate in CI, published as remote-heavy-checks-v1.

ci.yaml's gate jobs (owner 2026-11-06, speed-ci-shards) run this in the candidate checkout, under only the
pinned environment and remote_checks.py's pinned argv. The `static` job runs install, typecheck, lint and the
orchestration suite (`pnpm -s test:workflow`, gate-ci-workflow), stopping at the first failure; each of N `shard` jobs runs the suite's --shard=i/N with the blob reporter
beside the JSON one; the `assemble` job gathers their parts (each job's rows and facts: checkout,
toolchain, environment, installed lock), merges the blobs with `vitest --merge-reports` into full.json and
writes OUT/<runId>/manifest.json last, binding the committed host-audit list (tests that skip here for want
of the gate host's sources). It records what each job did; remote_checks.py judges it (a missing, failed or
mismatched part is recorded and refused there, never dropped). The manifest names its directory as the gate
host's ORCH/remote-checks/<runId>, where remote-fetch.sh publishes the uploaded artifact read-only.

The checkout is gate-push.sh's tree-only commit (owner 2026-11-02), cloned at depth 1: parentless,
its message trailers naming the reviewed commit, the base and the tree, and no other. Anything else
stops every job before any command (remote_checks.gate_commit, which the gate host applies alike); the
manifest records the commit, its tree, parents, message and every trailer, and the gate host binds
them (remote_checks.gate_source).

python3 -B remote_ci.py static --tz ZONE --out PART
python3 -B remote_ci.py shard --index I --total N --tz ZONE --out PART
python3 -B remote_ci.py assemble --label LABEL --orch GATE_EP_ORCH --tz ZONE --out OUT --parts PARTS --total N
        --shard-result RESULT --static-result RESULT
    (PARTS holds this run attempt's downloaded artifacts remote-static-<attempt>/ and remote-shard-<attempt>-<i>/;
    the results are the producer jobs' needs results, which must both be success for a passing manifest)
python3 -B remote_ci.py probe   (the checkout's source facts as JSON; refuses a non-gate commit)
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
from remote_checks import ARGV, AUDITS, ENVIRONMENT, JOB_SOURCE, KIND, PROBE, RUN, RUN_ID, SHARD_REPORTER, WORKFLOW_ARGV, gate_commit
from workflow_evidence import create_json, digest, read_json, require

LABEL = r'[a-z0-9-]+'
# Runner variables a command needs to find node, pnpm and its store; nothing else is passed.
INHERITED = ('HOME', 'PATH', 'PNPM_HOME')
# The parts a static or shard job uploads for the assemble job.
STATIC_KIND, SHARD_KIND = 'remote-static-part-v1', 'remote-shard-part-v1'


def stamp(moment=None):
    return (moment or datetime.now(timezone.utc)).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


def run_id(label, commit, moment=None):
    """<label>-<UTC yyyymmdd-hhmmss>-<commit[:6]>, the runId remote_checks.py accepts."""
    require(isinstance(label, str) and re.fullmatch(LABEL, label), 'Invalid gate label: %r' % label)
    value = '%s-%s-%s' % (label, (moment or datetime.now(timezone.utc)).strftime('%Y%m%d-%H%M%S'), commit[:6])
    require(re.fullmatch(RUN_ID, value), 'Invalid runId: ' + value)
    return value


def environment(parent, tz):
    """The commands' whole environment: the runner's PATH/HOME/PNPM_HOME, the pinned values, TZ if set."""
    values = {key: parent[key] for key in INHERITED if key in parent}
    values.update(ENVIRONMENT)
    if tz:
        values['TZ'] = tz
    return values


def capture(root, argv, env):
    return subprocess.run(argv, cwd=root, env=env, capture_output=True, text=True, check=True).stdout.strip()


def read_source(root):
    """The checkout's facts as the manifest records them, refusing nothing: its status (every untracked file, whatever
    the configuration), commit, tree, parents from the raw commit object (which still names them in a shallow clone,
    where rev-parse HEAD^ would not), message, and every trailer Git parses from it as [key, value] pairs."""
    status = capture(root, ['git', '-c', 'core.fsmonitor=false', 'status', '--porcelain=v1', '--untracked-files=all',
                            '--ignore-submodules=none'], None)
    commit = capture(root, ['git', 'rev-parse', 'HEAD'], None)
    raw = subprocess.run(['git', 'cat-file', 'commit', commit], cwd=root, capture_output=True, text=True, check=True).stdout
    headers, _, message = raw.partition('\n\n')
    parents = [line.split(' ', 1)[1] for line in headers.splitlines() if line.startswith('parent ')]
    tree = capture(root, ['git', 'rev-parse', 'HEAD^{tree}'], None)
    parsed = subprocess.run(['git', 'interpret-trailers', '--parse'], cwd=root, input=message, capture_output=True, text=True,
                            check=True).stdout
    trailers = [list(line.partition(': ')[::2]) for line in parsed.splitlines()]
    return dict(commit=commit, tree=tree, parents=parents, trailers=trailers, message=message, status=status, root=str(root))


def source(root):
    """The candidate: a clean checkout of gate-push.sh's commit (remote_checks.gate_commit, as the gate host checks it).
    Clean means a status that succeeded and listed nothing, and no index entry marked assume-unchanged or
    skip-worktree (ls-files -v: a lowercase tag or S), which hides its worktree change from status."""
    try:
        facts = read_source(root)
        index = capture(root, ['git', 'ls-files', '-v'], None)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError('Candidate checkout status failed: %s' % ' '.join(exc.cmd)) from exc
    require(facts['status'] == '', 'Candidate checkout not clean: ' + facts['status'].partition('\n')[0])
    require(not re.search(r'^([a-z]|S) ', index, re.M), 'Candidate checkout index hides worktree changes')
    gate_commit(facts)
    return facts


def execute(name, argv, root, env, directory):
    """One command, its output streamed to the job log and to <name>.log."""
    log = directory / (name + '.log')
    started, clock = stamp(), time.monotonic()
    print('::group::%s: %s' % (name, ' '.join(argv)), flush=True)
    with log.open('w') as sink:
        with subprocess.Popen(argv, cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors='replace') as process:
            for line in process.stdout:
                sink.write(line)
                sys.stdout.write(line)
        code = process.returncode
    print('::endgroup::\n%s exited %d' % (name, code), flush=True)
    return dict(name=name, argv=argv, exitCode=code, startedAt=started, endedAt=stamp(),
                elapsedSeconds=round(time.monotonic() - clock, 3), log=dict(file=log.name, sha256=digest(log)))


def probe(root, env):
    """The toolchain and effective zone the commands see; the verifier compares them with the gate host's."""
    facts = json.loads(capture(root, ['node', '-e', PROBE], env))
    toolchain = dict(node=facts['node'], pnpm=capture(root, ['pnpm', '--version'], env), platform=facts['platform'], arch=facts['arch'])
    return toolchain, facts['timeZone']


def sequence(plan, root, env, directory):
    """The planned (name, argv) commands in order, stopping at the first non-zero exit."""
    rows = []
    for name, argv in plan:
        rows.append(execute(name, argv, root, env, directory))
        if rows[-1]['exitCode'] != 0:
            break
    return rows


def static_plan():
    """install, typecheck, lint, then the orchestration suite, whose row the manifest records as `workflow`."""
    return [(name, ARGV[name]) for name in ('install', 'typecheck', 'lint')] + [('workflow', WORKFLOW_ARGV)]


def installed_lock(root):
    lock = root / 'node_modules/.pnpm/lock.yaml'
    return digest(lock) if lock.is_file() else None


def recorded_environment(env, zone):
    """The manifest's environment: the pinned values, TZ when set, and the effective zone."""
    return {**{key: env[key] for key in ENVIRONMENT}, **({'TZ': env['TZ']} if 'TZ' in env else {}), 'timeZone': zone}


def job_facts(root, facts, env, toolchain, zone, runner):
    """One CI job's facts, which remote_checks.job requires to equal the manifest's (the assemble job's)."""
    return dict(source={key: facts[key] for key in JOB_SOURCE}, toolchain=toolchain, environment=recorded_environment(env, zone),
                environmentKeys=sorted(env), installedLock=installed_lock(root), runner=runner or dict(provider='local'))


def write_manifest(directory, root, identity, orch, runner, facts, env, toolchain, zone, rows, completed, extra=None):
    """remote-heavy-checks-v1, create-only and last; its sha256. extra adds a sharded run's static, shards, producers
    and the static job's workflow row."""
    manifest = dict(
        kind=KIND, runId=identity, directory=str(Path(orch) / 'remote-checks' / identity),
        runner=runner or dict(provider='local'), source=facts,
        lockfile={'pnpm-lock.yaml': digest(root / 'pnpm-lock.yaml'), 'package.json': digest(root / 'package.json'),
                  'installedLock': installed_lock(root)},
        toolchain=toolchain, environment=recorded_environment(env, zone),
        environmentKeys=sorted(env), resourceOverrides={},
        commands=rows, completed=completed, createdAt=stamp(),
        # The committed list of tests that may skip here for want of the gate host's sources.
        hostAudits=dict(file=AUDITS, sha256=digest(root / AUDITS) if (root / AUDITS).is_file() else None), **(extra or {}))
    with (directory / 'manifest.json').open('x') as stream:
        json.dump(manifest, stream, indent=2)
        stream.write('\n')
    return digest(directory / 'manifest.json')


def job_start(root, out, tz, parent):
    """A job's checkout (refusing a non-gate or unclean one before anything runs), its new part directory,
    environment, toolchain and zone."""
    root, out = Path(root).resolve(), Path(out)
    facts = source(root)
    out.mkdir(parents=True)
    env = environment(os.environ if parent is None else parent, tz)
    toolchain, zone = probe(root, env)
    return root, out, facts, env, toolchain, zone


def static(root, out, tz, parent=None, runner=None):
    """The static job: install, typecheck, lint and test:workflow, stopping at the first failure, then OUT/static.json
    (its rows and facts) last. True only for four zero exits."""
    root, out, facts, env, toolchain, zone = job_start(root, out, tz, parent)
    rows = sequence(static_plan(), root, env, out)
    create_json(out / 'static.json', dict(kind=STATIC_KIND, job=job_facts(root, facts, env, toolchain, zone, runner), commands=rows))
    return len(rows) == len(static_plan()) and all(row['exitCode'] == 0 for row in rows)


def shard(root, out, index, total, tz, parent=None, runner=None):
    """Shard index of total: the suite with --shard=index/total, its JSON report and blob beside its log, then
    OUT/shard.json (its row and facts) last. True for a zero exit."""
    require(isinstance(index, int) and isinstance(total, int) and 1 <= index <= total, 'Invalid shard %r of %r' % (index, total))
    root, out, facts, env, toolchain, zone = job_start(root, out, tz, parent)
    report, blob = out / ('shard-%d.json' % index), out / 'blobs' / ('blob-%d.json' % index)
    argv = ARGV['suite'] + [SHARD_REPORTER, '--shard=%d/%d' % (index, total), '--outputFile.json=' + str(report), '--outputFile.blob=' + str(blob)]
    row = execute('shard-%d' % index, argv, root, env, out)
    row = dict(index=index, **{key: value for key, value in row.items() if key != 'name'})
    for key, path in (('report', report), ('blob', blob)):
        if path.is_file():
            row[key] = dict(file=str(path.relative_to(out)), sha256=digest(path))
    row['job'] = job_facts(root, facts, env, toolchain, zone, runner)
    create_json(out / 'shard.json', dict(kind=SHARD_KIND, total=total, shard=row))
    return row['exitCode'] == 0


def read_part(path, kind):
    """A downloaded part, or None (with the reason in the job log) when it is missing or not of its kind."""
    try:
        value = read_json(path)
        require(isinstance(value, dict) and value.get('kind') == kind, 'not a %s part' % kind)
        return value
    except Exception as exc:
        print('assemble: no %s part at %s: %s' % (kind, path, exc), flush=True)
        return None


def place(part, reference, directory, target):
    """Copies a part's referenced file to directory/target, keeping its recorded sha256 (the verifier rehashes)."""
    source_path = (part / reference['file']).resolve()
    require(source_path.is_relative_to(part.resolve()) and source_path.is_file(), 'Part file outside its part: ' + reference['file'])
    destination = directory / target
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source_path, destination)
    return dict(reference, file=target)


def same_job(value, own):
    """The job facts remote_checks.job compares: all but the runner, whose run id and attempt must be own's."""
    return (isinstance(value, dict) and all(value.get(key) == own[key] for key in own if key != 'runner')
            and isinstance(value.get('runner'), dict) and all(value['runner'].get(key) == own['runner'].get(key) for key in RUN))


def part_name(attempt, index=None):
    """A part's artifact name, scoped to the run attempt that produced it (fix r1): remote-static-<attempt> and
    remote-shard-<attempt>-<i>, as ci.yaml uploads them. The assemble job reads only its own attempt's names, so a
    failed rerun can never leave an earlier attempt's part standing in for it."""
    return 'remote-static-%s' % attempt if index is None else 'remote-shard-%s-%d' % (attempt, index)


def gather_static(parts, directory, attempt):
    """This attempt's static part: its command rows, their logs copied to the run directory's top, split into the
    manifest's `commands` rows and its `workflow` row, and its job facts (None if absent; no workflow row when the job
    stopped before it)."""
    base = parts / part_name(attempt)
    part = read_part(base / 'static.json', STATIC_KIND)
    if not part:
        return [], None, None
    rows = [dict(row, log=place(base, row['log'], directory, row['name'] + '.log')) for row in part['commands']]
    workflow = next((row for row in rows if row['name'] == 'workflow'), None)
    return [row for row in rows if row['name'] != 'workflow'], part['job'], workflow


def gather_shard(part, row, directory, index):
    """A shard part's row with its log and report copied to shards/ and its blob to blobs/blob-<i>.json."""
    row = dict(row)
    for key, target in (('log', 'shards/shard-%d.log'), ('report', 'shards/shard-%d.json'), ('blob', 'blobs/blob-%d.json')):
        if isinstance(row.get(key), dict):
            row[key] = place(part, row[key], directory, target % index)
    return row


def gather_shards(parts, directory, total, attempt):
    """This attempt's shard parts present, 1..total, as recorded (a missing one is left out and the verifier refuses
    the gap)."""
    shards = []
    for index in range(1, total + 1):
        base = parts / part_name(attempt, index)
        part = read_part(base / 'shard.json', SHARD_KIND)
        if part:
            shards.append(gather_shard(base, part['shard'], directory, index))
    return shards


def merge(root, env, directory):
    """`vitest --merge-reports` of blobs/ into full.json: the suite row, its report referenced when written."""
    report = directory / 'full.json'
    row = execute('suite', ARGV['suite'] + ['--merge-reports=' + str(directory / 'blobs'), '--outputFile.json=' + str(report)],
                  root, env, directory)
    if report.is_file():
        row['report'] = dict(file=report.name, sha256=digest(report))
    return row


def assembly_problems(static_job, shards, own, producers):
    """The jobs whose facts are not own's (run attempt included) and the producers whose needs result is not success."""
    jobs = [('static job', static_job)] + [('shard %s' % row.get('index'), row.get('job')) for row in shards]
    return [name for name, job in jobs if not same_job(job, own)] + ['%s %s' % item for item in sorted(producers.items()) if item[1] != 'success']


def complete(rows, workflow, shards, total):
    """Every command ran: the four rows in order, the workflow row and all total shards."""
    return [row['name'] for row in rows] == list(ARGV) and workflow is not None and len(shards) == total


def assembly_passed(rows, workflow, static_job, shards, total, own, producers):
    """True only when both producer jobs succeeded (GitHub's needs results), for the static job's four rows, all total
    shards and the merge, all zero exits, every job on own's facts."""
    problems = assembly_problems(static_job, shards, own, producers)
    if problems:
        print("assemble: not passing: " + ', '.join(problems), flush=True)
    return complete(rows, workflow, shards, total) and not problems and all(row['exitCode'] == 0 for row in rows + [workflow] + shards)


def assemble(root, out, orch, label, tz, parts, total, producers, parent=None, runner=None, github_output=None):
    """The assemble job: OUT/<runId>/ from this run attempt's static and shard parts in PARTS (logs at the top, shards/
    and blobs/), the merged suite (--merge-reports of blobs/) and the manifest last, recording producers (the
    remote-shard and remote-static needs results). Records every part as it came; True only when both producers
    succeeded, the static job and all total shards passed with this job's facts and the merge passed."""
    root, parts = Path(root).resolve(), Path(parts)
    facts = source(root)
    identity = run_id(label, facts['commit'])
    directory = Path(out) / identity
    (directory / 'blobs').mkdir(parents=True)
    if github_output:
        with open(github_output, 'a') as stream:
            stream.write('run-id=%s\ndirectory=%s\n' % (identity, directory))
    env = environment(os.environ if parent is None else parent, tz)
    toolchain, zone = probe(root, env)
    attempt = (runner or {}).get('attempt') or ''
    rows, static_job, workflow = gather_static(parts, directory, attempt)
    shards = gather_shards(parts, directory, total, attempt)
    if any('blob' in row for row in shards):
        rows.append(merge(root, env, directory))
    sha256 = write_manifest(directory, root, identity, orch, runner, facts, env, toolchain, zone, rows, complete(rows, workflow, shards, total),
                            dict(static=static_job, shards=shards, producers=producers, **({'workflow': workflow} if workflow else {})))
    passed = assembly_passed(rows, workflow, static_job, shards, total, job_facts(root, facts, env, toolchain, zone, runner), producers)
    print('remote checks %s: %s, %d of %d shards, manifest %s' % ('passed' if passed else 'FAILED', identity, len(shards), total, sha256))
    return passed


def github_runner(env):
    """Where the run came from; remote_checks.py binds runId and attempt (every part's equal to the manifest's)."""
    keys = dict(repository='GITHUB_REPOSITORY', runId='GITHUB_RUN_ID', attempt='GITHUB_RUN_ATTEMPT', workflow='GITHUB_WORKFLOW',
                job='GITHUB_JOB', ref='GITHUB_REF', sha='GITHUB_SHA', runnerName='RUNNER_NAME', image='ImageVersion')
    value = dict(provider='github-actions', **{key: env.get(name) for key, name in keys.items()})
    if env.get('GITHUB_SERVER_URL') and env.get('GITHUB_RUN_ID'):
        value['url'] = '%s/%s/actions/runs/%s' % (env['GITHUB_SERVER_URL'], env.get('GITHUB_REPOSITORY'), env['GITHUB_RUN_ID'])
    return value


def probe_command():
    try:
        print(json.dumps(source(Path.cwd()), indent=2))
        return True
    except (RuntimeError, subprocess.CalledProcessError) as exc:
        print('remote_ci probe refused: %s' % exc, file=sys.stderr)
        return False


def parser(mode):
    """A subcommand's arguments: --tz and --out always; shard adds --index and --total; assemble adds --total,
    --label, --orch, --parts and the producer jobs' needs results (--shard-result, --static-result)."""
    value = argparse.ArgumentParser(prog='remote_ci.py ' + mode, description=__doc__.splitlines()[0])
    value.add_argument('--tz', default='', help="the gate host's zone; empty leaves TZ unset")
    value.add_argument('--out', required=True, help='where the part (static, shard) or <runId>/ (assemble) is written')
    options = dict(index=dict(type=int, required=True), total=dict(type=int, required=True, help='the shard count N'),
                   label=dict(required=True, help='gate/<label> without the prefix'), orch=dict(required=True, help="the gate host's EP_ORCH"),
                   parts=dict(required=True, help="this attempt's downloaded remote-static-<attempt>/ and remote-shard-<attempt>-<i>/"),
                   **{'shard-result': dict(required=True, help='needs.remote-shard.result'),
                      'static-result': dict(required=True, help='needs.remote-static.result')})
    for name in dict(static=(), shard=('index', 'total'), assemble=('total', 'label', 'orch', 'parts', 'shard-result', 'static-result'))[mode]:
        value.add_argument('--' + name, **options[name])
    return value


def main(argv):
    if argv == ['probe']:
        return 0 if probe_command() else 1
    runs = dict(static=lambda args, runner: static(Path.cwd(), args.out, args.tz, runner=runner),
                shard=lambda args, runner: shard(Path.cwd(), args.out, args.index, args.total, args.tz, runner=runner),
                assemble=lambda args, runner: assemble(Path.cwd(), args.out, args.orch, args.label, args.tz, args.parts, args.total,
                                                       {'remote-shard': args.shard_result, 'remote-static': args.static_result},
                                                       runner=runner, github_output=os.environ.get('GITHUB_OUTPUT')))
    if not argv or argv[0] not in runs:
        print('usage: remote_ci.py probe | ' + ' | '.join(runs) + ' [options]', file=sys.stderr)
        return 64
    return 0 if runs[argv[0]](parser(argv[0]).parse_args(argv[1:]), github_runner(os.environ)) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
