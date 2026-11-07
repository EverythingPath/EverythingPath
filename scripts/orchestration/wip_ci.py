#!/usr/bin/env python3
"""WIP CI for a worker's wip/<task>-<stamp> push: ci.yaml's wip-* jobs (speed-wip-ci W2, owner 2026-11-06).

Information for the worker only, never landing evidence: nothing here writes a manifest, calls remote_ci.py or
uploads a remote-* artifact, and the gate's verifier knows none of these kinds. The pushed commit is wip-ci.sh's
parentless snapshot; its Wip-Scope trailer names what runs:

    Wip-Scope: suite [static=yes|no]
    Wip-Scope: tests/<dir> [tests/<dir> ...] [static=yes|no]

`suite` stands alone; each tests/<dir> must be a directory of the checkout, reached through no symlink, that holds a
test file. static defaults to no.

python3 -B wip_ci.py plan --out PART           (wip-plan: PART/plan.json, the job outputs ok, static and chromium)
python3 -B wip_ci.py shard --index I --total N --out PART    (wip-shard: Vitest's --shard=I/N of the scope)
python3 -B wip_ci.py static --out PART         (wip-static: typecheck and lint, both run)
python3 -B wip_ci.py summarize --parts PARTS --out OUT --attempt A --total N
        --plan-result R --shard-result R --static-result R
    (wip-summary: OUT/wip-summary.json, kind wip-ci-summary-v1, and OUT/wip-summary.md, at most 200 lines and 16 KB,
    from this attempt's downloaded parts wip-plan-<A>/, wip-shard-<A>-<i>/ and wip-static-<A>/; the results are the
    jobs' needs results)
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
from workflow_evidence import create_json, require

KIND = 'wip-ci-summary-v1'
PLAN_KIND, SHARD_KIND, STATIC_KIND = 'wip-plan-part-v1', 'wip-shard-part-v1', 'wip-static-part-v1'
# ci.yaml's wip-shard matrix.
TOTAL = 8
# The gate's pinned values (remote_checks.ENVIRONMENT and ci.yaml's GATE_TZ), so a WIP result predicts the gate's.
ENVIRONMENT = dict(CI='true', LC_ALL='C.UTF-8', VITEST_MAX_WORKERS='2', TZ='Europe/Stockholm')
# Runner variables a command needs to find node, pnpm and its store; nothing else is passed.
INHERITED = ('HOME', 'PATH', 'PNPM_HOME')
STATIC_ARGV = dict(typecheck=['pnpm', '-s', 'typecheck'], lint=['pnpm', '-s', 'lint'])
# A scope directory: tests/ and one or more segments, none starting with a dot.
SCOPE_PATH = re.compile(r'tests(?:/[A-Za-z0-9_][A-Za-z0-9_.-]*)+')
TEST_FILE = re.compile(r'\.test\.tsx?$')
# The summary's caps: the first 30 lines of a failure's message, the 20 slowest files, a failed static command's last
# 40 lines, each JSON line at most 500 characters; the markdown at most 200 lines of 200 characters and 16 KB.
MESSAGE_LINES, SLOWEST, STATIC_LINES, JSON_LINE = 30, 20, 40, 500
MARKDOWN_LINES, MARKDOWN_BYTES, MARKDOWN_LINE = 200, 16 * 1024, 200
ANSI = re.compile(r'\x1b\[[0-9;?]*[A-Za-z]')
# Every character str.splitlines breaks a line on, with the spaces and tabs around a run of them.
LINE_BREAKS = re.compile('[ \t]*[\n\r\v\f\x1c\x1d\x1e\x85  ]+[ \t]*')


class ScopeRefused(ValueError):
    """A Wip-Scope this driver will not run."""


def refuse(condition, message):
    if not condition:
        raise ScopeRefused(message)


def scope_directory(token, root):
    """tests/<dir> as the checkout holds it: allowlisted, a real directory reached through no symlink, with a test file."""
    path = token[:-1] if token.endswith('/') else token
    refuse(SCOPE_PATH.fullmatch(path), '%s is not an allowlisted test directory (tests/<dir>)' % token)
    current = Path(root)
    for part in path.split('/'):
        current = current / part
        refuse(not current.is_symlink(), '%s passes through a symlink' % token)
        refuse(current.exists(), '%s does not exist' % token)
    refuse(current.is_dir(), '%s is not a directory' % token)
    refuse(any(TEST_FILE.search(name) for _, _, files in os.walk(current) for name in files), '%s holds no test files' % token)
    return path


def browser_files(root):
    path = Path(root) / 'tests' / 'shard-weights.json'
    return json.loads(path.read_text()).get('browserFiles', []) if path.is_file() else []


def static_flag(tokens):
    """The static=yes|no tokens of a scope: at most one, default no."""
    refuse(len(tokens) <= 1, 'static named twice')
    for token in tokens:
        refuse(token in ('static=yes', 'static=no'), 'static=yes or static=no, not %s' % token)
    return tokens == ['static=yes']


def scope_paths(tokens, root):
    """The scope's test directories: each allowlisted and in the checkout, none named twice or inside another."""
    paths = []
    for token in tokens:
        path = scope_directory(token, root)
        refuse(path not in paths, '%s named twice' % path)
        for other in paths:
            inner, outer = sorted((path, other), key=len, reverse=True)
            refuse(not inner.startswith(outer + '/'), '%s is inside %s' % (inner, outer))
        paths.append(path)
    return paths


def parse_scope(value, root):
    """A Wip-Scope value: {scope: 'suite' or [tests/<dir>, ...], static, chromium}, chromium when a browser file of
    tests/shard-weights.json may run (Vitest's shard 1 holds them)."""
    statics, rest = [], []
    for token in value.split():
        (statics if token.startswith('static=') else rest).append(token)
    static = static_flag(statics)
    if 'suite' in rest:
        refuse(rest == ['suite'], 'suite stands alone')
        return dict(scope='suite', static=static, chromium=True)
    paths = scope_paths(rest, root)
    refuse(paths, 'Wip-Scope is empty: name suite or test directories')
    return dict(scope=paths, static=static, chromium=holds_browser_files(paths, root))


def holds_browser_files(paths, root):
    return any(file.startswith(path + '/') for file in browser_files(root) for path in paths)


def capture(root, argv, stdin=None):
    return subprocess.run(argv, cwd=root, input=stdin, capture_output=True, text=True, check=True).stdout


def read_source(root):
    """The checkout's commit, tree and every trailer of its message as [key, value] pairs."""
    commit = capture(root, ['git', 'rev-parse', 'HEAD']).strip()
    message = capture(root, ['git', 'cat-file', 'commit', commit]).partition('\n\n')[2]
    parsed = capture(root, ['git', 'interpret-trailers', '--parse'], message)
    return dict(commit=commit, tree=capture(root, ['git', 'rev-parse', 'HEAD^{tree}']).strip(),
                trailers=[list(line.partition(': ')[::2]) for line in parsed.splitlines()])


def plan_source(source, root):
    """The plan from the source's one Wip-Scope trailer."""
    scopes = [value for key, value in source['trailers'] if key == 'Wip-Scope']
    refuse(scopes, 'the commit has no Wip-Scope trailer')
    refuse(len(scopes) == 1, 'the commit has more than one Wip-Scope trailer')
    return parse_scope(scopes[0], root)


def plan(root, out, github_output=None):
    """wip-plan: OUT/plan.json (the source, and the plan or why it was refused) and the job outputs. True when planned."""
    out = Path(out)
    out.mkdir(parents=True)
    source = read_source(root)
    try:
        value, refused = plan_source(source, root), None
    except ScopeRefused as exc:
        value, refused = None, 'Wip-Scope refused: %s' % exc
        print(refused, file=sys.stderr)
    create_json(out / 'plan.json', dict(kind=PLAN_KIND, source=source, plan=value, **({'refused': refused} if refused else {})))
    flag = lambda key: 'true' if value and value[key] else 'false'
    if github_output:
        with open(github_output, 'a') as stream:
            stream.write('ok=%s\nstatic=%s\nchromium=%s\n' % ('true' if value else 'false', flag('static'), flag('chromium')))
    print(json.dumps(dict(plan=value, refused=refused)))
    return value is not None


def environment(parent):
    values = {key: parent[key] for key in INHERITED if key in parent}
    values.update(ENVIRONMENT)
    return values


def execute(argv, root, env, log):
    """One command, its output streamed to the job log and to log: (exit code, seconds)."""
    clock = time.monotonic()
    print('::group::%s' % ' '.join(argv), flush=True)
    with open(log, 'w') as sink, subprocess.Popen(argv, cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                                 text=True, errors='replace') as process:
        for line in process.stdout:
            sink.write(line)
            sys.stdout.write(line)
    print('::endgroup::\nexited %d' % process.returncode, flush=True)
    return process.returncode, round(time.monotonic() - clock, 3)


def vitest_argv(scope, index, total, report):
    """The shard's suite command. Vitest's filters are substrings of a file's path, so each directory ends in a slash;
    a shard the plan leaves without files passes."""
    paths = [] if scope == 'suite' else [path + '/' for path in scope]
    return ['pnpm', 'test', *paths, '--shard=%d/%d' % (index, total), '--reporter=dot', '--reporter=json',
            '--outputFile.json=' + str(report), '--passWithNoTests']


def shard(root, out, index, total, parent=None):
    """wip-shard: Vitest's --shard=index/total of the commit's scope, then OUT/shard.json (exit code, duration, the
    JSON report when Vitest wrote one). True for a zero exit."""
    require(isinstance(index, int) and isinstance(total, int) and 1 <= index <= total, 'Invalid shard %r of %r' % (index, total))
    root = Path(root).resolve()
    value = plan_source(read_source(root), root)
    out = Path(out)
    out.mkdir(parents=True)
    report = out / 'report.json'
    argv = vitest_argv(value['scope'], index, total, report)
    code, seconds = execute(argv, root, environment(os.environ if parent is None else parent), out / 'shard.log')
    create_json(out / 'shard.json', dict(kind=SHARD_KIND, index=index, total=total, root=str(root), argv=argv, exitCode=code,
                                         durationSeconds=seconds, log='shard.log', report=report.name if report.is_file() else None))
    return code == 0


def one_line(text):
    """text without ANSI codes, its line breaks (any str.splitlines splits on) collapsed to one space each run."""
    return LINE_BREAKS.sub(' ', ANSI.sub('', str(text))).rstrip()


def clip(line, width):
    line = one_line(line)
    return line if len(line) <= width else line[:width - 1] + '…'


def static(root, out, parent=None):
    """wip-static: typecheck and lint, both run, then OUT/static.json with a failed command's last 40 lines. True when
    both pass."""
    out = Path(out)
    out.mkdir(parents=True)
    env = environment(os.environ if parent is None else parent)
    commands = []
    for name, argv in STATIC_ARGV.items():
        code, seconds = execute(argv, root, env, out / (name + '.log'))
        lines = [clip(line, JSON_LINE) for line in (out / (name + '.log')).read_text(errors='replace').splitlines()]
        while lines and not lines[-1]:
            lines.pop()
        commands.append(dict(name=name, argv=argv, exitCode=code, durationSeconds=seconds, log=name + '.log',
                             lines=lines[-STATIC_LINES:] if code else []))
    create_json(out / 'static.json', dict(kind=STATIC_KIND, commands=commands))
    return all(command['exitCode'] == 0 for command in commands)


def part_name(kind, attempt, index=None):
    """A part's artifact name, scoped to the run attempt: wip-plan-<a>, wip-shard-<a>-<i> and wip-static-<a>. Never a
    gate name (remote-*)."""
    return 'wip-%s-%s' % (kind, attempt) + ('' if index is None else '-%d' % index)


def read_part(path, kind):
    """A downloaded part, or None when it is missing or not of its kind."""
    try:
        value = json.loads(Path(path).read_text())
        return value if isinstance(value, dict) and value.get('kind') == kind else None
    except (OSError, ValueError):
        return None


def message(text):
    lines = text.splitlines()
    return dict(message='\n'.join(clip(line, JSON_LINE) for line in lines[:MESSAGE_LINES]), messageLines=len(lines))


def relative(name, root):
    return name[len(root) + 1:] if root and name.startswith(root.rstrip('/') + '/') else name


def load_report(directory, part):
    """The shard's Vitest JSON report, or {} when it wrote none or it does not parse."""
    try:
        report = json.loads((directory / part['report']).read_text()) if part.get('report') else {}
    except (OSError, ValueError):
        report = {}
    return report if isinstance(report, dict) else {}


def report_counts(report):
    results = report.get('testResults') or []
    return dict(files=len(results), tests=report.get('numTotalTests', 0), passed=report.get('numPassedTests', 0),
                failed=report.get('numFailedTests', 0), skipped=report.get('numPendingTests', 0) + report.get('numTodoTests', 0),
                failedFiles=sum(1 for result in results if result.get('status') == 'failed'))


def file_failures(index, file, result):
    """A file's failures: its file-level error (a load or hook failure, fullName empty) whenever it has one or failed with
    no failed test, then each failed test."""
    failed = [assertion for assertion in result.get('assertionResults', []) if assertion.get('status') == 'failed']
    errors = []
    if result.get('message') or (result.get('status') == 'failed' and not failed):
        errors.append(dict(shard=index, file=file, fullName='', **message(result.get('message') or '')))
    return errors + [dict(shard=index, file=file, fullName=assertion.get('fullName', ''),
                          **message('\n'.join(assertion.get('failureMessages') or []))) for assertion in failed]


def file_seconds(index, file, result):
    """The file's duration from its startTime and endTime, or None without both."""
    start, end = result.get('startTime'), result.get('endTime')
    if isinstance(start, (int, float)) and isinstance(end, (int, float)):
        return dict(file=file, seconds=round((end - start) / 1000, 3), shard=index)
    return None


def shard_row(index, part, directory):
    """A shard's row (exit code, duration, counts) and its report's failures and file durations."""
    report = load_report(directory, part)
    row = dict(index=index, exitCode=part.get('exitCode'), durationSeconds=part.get('durationSeconds'), **report_counts(report))
    failures, files = [], []
    for result in report.get('testResults') or []:
        file = relative(result.get('name', ''), part.get('root', ''))
        failures += file_failures(index, file, result)
        files += [timed for timed in (file_seconds(index, file, result),) if timed]
    return row, failures, files


def gather_shards(parts, attempt, total):
    """Every shard's row, failures and file durations, and the problems: a missing part or a nonzero exit."""
    shards, failures, files, problems = [], [], [], []
    for index in range(1, total + 1):
        directory = parts / part_name('shard', attempt, index)
        part = read_part(directory / 'shard.json', SHARD_KIND)
        if not part:
            problems.append('shard %d missing' % index)
            continue
        row, found, timed = shard_row(index, part, directory)
        shards.append(row)
        failures += found
        files += timed
        if row['exitCode'] != 0:
            problems.append('shard %d exited %s' % (index, row['exitCode']))
    return shards, failures, files, problems


def gather_static(parts, attempt):
    """The static part's command rows and the problems: a missing part or a nonzero exit."""
    part = read_part(parts / part_name('static', attempt) / 'static.json', STATIC_KIND)
    if not part:
        return None, ['static part missing']
    rows = [{key: row[key] for key in ('name', 'exitCode', 'durationSeconds', 'lines')} for row in part['commands']]
    return rows, ['static %s exited %s' % (row['name'], row['exitCode']) for row in rows if row['exitCode'] != 0]


def gather(parts, attempt, total):
    """This attempt's parts: the plan part, the shards and, when the plan asked for it, the static part, each with its
    problems. Nothing past the plan when the plan is missing or refused."""
    planned = read_part(parts / part_name('plan', attempt) / 'plan.json', PLAN_KIND)
    value = (planned or {}).get('plan')
    found = dict(planned=planned, plan=value, shards=[], failures=[], files=[], static=None, problems=[])
    if not planned:
        found['problems'].append('plan part missing')
    elif not value:
        found['problems'].append('plan refused: %s' % planned.get('refused'))
    else:
        found['shards'], found['failures'], found['files'], found['problems'] = gather_shards(parts, attempt, total)
        if value.get('static'):
            found['static'], problems = gather_static(parts, attempt)
            found['problems'] += problems
    return found


def job_problems(results):
    return ['wip-%s %s' % (job, result) for job, result in (results or {}).items() if result not in (None, 'success', 'skipped')]


def summarize(parts, out, attempt, total, results, run):
    """wip-summary: OUT/wip-summary.json and the capped OUT/wip-summary.md from this attempt's parts. Green only when the
    plan was accepted, every shard (and the static job, when asked for) exited zero and no job failed or was cancelled."""
    found = gather(Path(parts), attempt, total)
    problems = found['problems'] + job_problems(results)
    keys = ('files', 'tests', 'passed', 'failed', 'skipped', 'failedFiles')
    summary = dict(kind=KIND, outcome='red' if problems else 'green', problems=problems,
                   source=dict((found['planned'] or {}).get('source') or {}, run=run), plan=found['plan'] or None, jobs=results,
                   shards=found['shards'], totals={key: sum(row[key] for row in found['shards']) for key in keys},
                   static=found['static'], failures=found['failures'],
                   slowest=sorted(found['files'], key=lambda row: (-row['seconds'], row['file']))[:SLOWEST])
    out = Path(out)
    out.mkdir(parents=True)
    create_json(out / 'wip-summary.json', summary)
    (out / 'wip-summary.md').write_text(render(summary))
    return summary


def cell(text):
    return one_line(text).replace('|', '\\|')


def title(summary):
    totals = summary['totals']
    if summary['outcome'] == 'green':
        return '%d tests in %d files' % (totals['tests'], totals['files'])
    if totals['failed'] or totals['failedFiles']:
        return '%d failed tests in %d files' % (totals['failed'], totals['failedFiles'])
    return summary['problems'][0]


def source_lines(summary):
    source, plan_value = summary['source'], summary['plan'] or {}
    trailers = dict(source.get('trailers') or [])
    run = source.get('run') or {}
    scope = plan_value.get('scope')
    return ['# WIP CI %s: %s' % (summary['outcome'], title(summary)), '',
            'WIP CI is information only, never landing evidence.', '',
            '- commit `%s`, tree `%s`' % (source.get('commit'), source.get('tree')),
            '- task `%s`, base `%s`' % (trailers.get('Wip-Task'), trailers.get('Wip-Base')),
            '- scope `%s`, static %s' % (' '.join(scope) if isinstance(scope, list) else scope, 'yes' if plan_value.get('static') else 'no'),
            '- run %s (attempt %s)' % (run.get('url') or run.get('runId'), run.get('attempt'))]


def problem_lines(problems):
    if not problems:
        return []
    more = ['- and %d more' % (len(problems) - 10)] if len(problems) > 10 else []
    return ['', '## Problems', ''] + ['- ' + problem for problem in problems[:10]] + more


def shard_lines(shards):
    if not shards:
        return []
    return ['', '## Shards', '', '| shard | exit | seconds | files | tests | passed | failed | skipped |', '|---|---|---|---|---|---|---|---|'] \
        + ['| %(index)s | %(exitCode)s | %(durationSeconds)s | %(files)s | %(tests)s | %(passed)s | %(failed)s | %(skipped)s |' % row
           for row in shards]


def head_lines(summary):
    """What the markdown always shows: outcome, source, problems, the shard table and the static and failure headings."""
    static = ['', '## Static', ''] + ['- %(name)s: exit %(exitCode)s, %(durationSeconds)s s' % row
                                      for row in summary['static']] if summary['static'] is not None else []
    failures = ['', '## Failures (%d)' % len(summary['failures'])] if summary['failures'] else []
    return source_lines(summary) + problem_lines(summary['problems']) + shard_lines(summary['shards']) + static + failures


def failure_block(row):
    name = ' › ' + row['fullName'] if row['fullName'] else ''
    return ['', '### `%s`%s (shard %s)' % (row['file'], name, row['shard']), ''] + ['    ' + line for line in row['message'].splitlines()]


def body_blocks(summary):
    """The (kind, lines) blocks shown while they fit, in order: failed static output, failures, the slowest files."""
    blocks = [('static', ['', '### %s output' % row['name'], ''] + ['    ' + line for line in row['lines']])
              for row in summary['static'] or [] if row['lines']]
    blocks += [('failure', failure_block(row)) for row in summary['failures']]
    if summary['slowest']:
        blocks.append(('slowest', ['', '## Slowest files', '', '| seconds | shard | file |', '|---|---|---|']
                       + ['| %s | %s | `%s` |' % (row['seconds'], row['shard'], cell(row['file'])) for row in summary['slowest']]))
    return blocks


def text(lines):
    """The markdown for these entries, each clipped to one physical line."""
    return ''.join(clip(line, MARKDOWN_LINE) + '\n' for line in lines)


def within(rendered, lines=MARKDOWN_LINES, size=MARKDOWN_BYTES):
    """Whether the rendered text keeps to the caps, counting physical lines (str.splitlines) and UTF-8 bytes."""
    return len(rendered.splitlines()) <= lines and len(rendered.encode()) <= size


def omission_note(blocks, left, failures):
    """The closing line naming what the cap left out."""
    count = lambda kind, rows: sum(1 for item, _ in rows if item == kind)
    named = (['%d of %d static outputs' % (count('static', left), count('static', blocks))] if count('static', left) else []) \
        + (['%d of %d failures' % (count('failure', left), failures)] if count('failure', left) else []) \
        + (['the slowest files'] if count('slowest', left) else [])
    return ['', '_Cut at 200 lines or 16 KB: %s left out; wip-summary.json has them all._' % ' and '.join(named)]


def render(summary):
    """The summary as markdown within the caps: the head always, then whole blocks in order while the rendered text,
    with room for the closing note (two lines, 400 bytes), stays within 200 physical lines and 16 KB; then the note."""
    lines, blocks = head_lines(summary), body_blocks(summary)
    for position, (_, block) in enumerate(blocks):
        if not within(text(lines + block), MARKDOWN_LINES - 2, MARKDOWN_BYTES - 400):
            lines += omission_note(blocks, blocks[position:], len(summary['failures']))
            break
        lines += block
    rendered = text(lines)
    require(within(rendered), 'wip-summary.md over its cap')
    return rendered


def github_run(env):
    keys = dict(repository='GITHUB_REPOSITORY', runId='GITHUB_RUN_ID', attempt='GITHUB_RUN_ATTEMPT', ref='GITHUB_REF')
    value = {key: env.get(name) for key, name in keys.items()}
    value['url'] = ('%s/%s/actions/runs/%s' % (env['GITHUB_SERVER_URL'], env.get('GITHUB_REPOSITORY'), env['GITHUB_RUN_ID'])
                    if env.get('GITHUB_SERVER_URL') and env.get('GITHUB_RUN_ID') else None)
    return value


def parser(mode):
    value = argparse.ArgumentParser(prog='wip_ci.py ' + mode, description=__doc__.splitlines()[0])
    value.add_argument('--out', required=True)
    if mode == 'shard':
        value.add_argument('--index', type=int, required=True)
        value.add_argument('--total', type=int, required=True)
    if mode == 'summarize':
        for name in ('parts', 'attempt', 'plan-result', 'shard-result', 'static-result'):
            value.add_argument('--' + name, required=True)
        value.add_argument('--total', type=int, required=True)
    return value


def main(argv):
    runs = dict(plan=lambda args: plan(Path.cwd(), args.out, os.environ.get('GITHUB_OUTPUT')),
                shard=lambda args: shard(Path.cwd(), args.out, args.index, args.total),
                static=lambda args: static(Path.cwd(), args.out),
                # The summary job passes when it wrote the summary; its outcome is inside.
                summarize=lambda args: summarize(args.parts, args.out, args.attempt, args.total,
                                                 dict(plan=args.plan_result, shard=args.shard_result, static=args.static_result),
                                                 github_run(os.environ)) is not None)
    if not argv or argv[0] not in runs:
        print('usage: wip_ci.py ' + ' | '.join(runs) + ' [options]', file=sys.stderr)
        return 64
    try:
        return 0 if runs[argv[0]](parser(argv[0]).parse_args(argv[1:])) else 1
    except ScopeRefused as exc:
        print('Wip-Scope refused: %s' % exc, file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
