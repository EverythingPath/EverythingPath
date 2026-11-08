#!/usr/bin/env python3
"""The light landing lane's rule (light-lane-v1): a candidate whose every changed path lies outside
everything the full queue reads. docs/agents/orchestration/operations.md, "Light landing lane".

verify() proves it from Git objects alone (no working-tree read, GIT_OPTIONAL_LOCKS=0); any path it
cannot prove refuses with RuntimeError('Light lane refused: ...') and never falls back. light_checks()
finds defects the full gate would accept too (RuntimeError('Light check failed: ...')): a fix round.

python3 -B light_lane.py check ROOT BASE COMMIT                  one JSON object; writes nothing
python3 -B light_lane.py verify WT BASE COMMIT EVIDENCE_DIR      cur-land.sh: create-only EVIDENCE_DIR/light-verification.json
python3 -B light_lane.py lockable ROOT                          lane-lock.sh: the tracked files it locks, NUL-separated
python3 -B light_lane.py eligible < PATHS                       affected-tests.ts: the NUL-separated PATHS allowed() admits
Exit 0 on a pass, 1 on a refusal, 2 on a light-check failure.
"""
import difflib
import hashlib
import json
import os
from pathlib import Path
import posixpath
import re
import subprocess
import sys

RULE = 'light-lane-v1'

# R2. Allowlist (default deny).
EXACT = ('AGENTS.md', 'CLAUDE.md', 'docs/standards.md', '.claude/settings.json', '.gitignore')
MARKDOWN_PREFIXES = ('docs/agents/', 'docs/product/', '.agents/skills/')

# R4. Readers that enumerate files without naming one, pinned at PINNED_AT. A change refuses until a
# reviewed re-pin (its own workflow slice) states why the changed reader still ignores the allowlist.
PINNED_AT = '4134d8011bdf6a17e8fdc6b0d2bf14fe92efefb9'  # re-pinned after granted-levels S1a (calculation-identities.ts)
BLOB_PINS = {
    'tsconfig.json': 'd9586c5773591dc433787f118f8b2df32087f3a0',
    'convex/tsconfig.json': 'b81f73d8beee201d7a7389b09442f40d52fa8616',
    # re-pinned with ci-shards fix r1: its only change is `sequence.sequencer` (tests/shard-plan.ts), which reads one named
    # file (tests/shard-weights.json) and only subsets and orders the files `include` already lists, under --shard alone.
    'vitest.config.ts': '10469f9c354633ff2385846c5b47de090dacfe76',
    'knip.jsonc': 'd31a69d100d48d7b415fc0cebaa017bf6a068d06',  # re-pinned after gate-import-scan (comment-ranges.mjs entry)
    'eslint.config.mjs': 'a5bc27e7d0d9a37184072ef4316cf18de08a4720',  # re-pinned after retro W3
    'e2e/support/source-files.ts': 'c0574152e6c890cc977f495d46be951bb93a48f6',
    'e2e/support/source-evidence.ts': '9b5227a803555e0d7c2e767197d2437186df41fb',
    'e2e/support/workspace.ts': '660c1c0dff78fdfffbcae776ebdd34b1cf68b980',
}
# The implementations of skipped stages beyond their configs: the catalog:pin script and its direct
# imports, the codegen entry (review r3), and the lint stage's helpers since retro W3 (the local rule
# eslint.config.mjs imports, and the lint:suppressions script and its import). A change to one forces
# a full gate until a reviewed re-pin.
STAGE_IMPLEMENTATIONS = ('scripts/catalog-pin.ts', 'src/lib/catalog/calculation-identities.ts',
                         'src/lib/catalog/runtime-compatibility.ts', 'scripts/orchestration/codegen.sh',
                         'scripts/local-convex/codegen.ts', 'scripts/lib/eslint-test-hygiene.mjs',
                         'scripts/check-eslint-suppressions.ts', 'scripts/lib/eslint-suppressions.ts')
BLOB_PINS.update({
    'scripts/catalog-pin.ts': '785ebdd4789441ae70d628bd07ece6a65d33d637',
    # re-pinned after granted-levels S1a: its only change rotates the three identity literals (current, retained prior,
    # superseded). It still imports and reads nothing; the closure it is checked against is runtime-compatibility.ts's
    # catalogCalculationV1Files (pinned, unchanged), which names no lane-eligible path, so a light change still cannot move the pin.
    'src/lib/catalog/calculation-identities.ts': '56234076232b7105a9060c76ec18732a0cef757e',
    'src/lib/catalog/runtime-compatibility.ts': '1d89b6970b9b6c12247ee8a39b1e6d0fe74ac660',
    'scripts/orchestration/codegen.sh': 'b5c660a68c79c9808ab7a8f4dd224ed7ac862268',
    'scripts/local-convex/codegen.ts': 'fc9e4cb8f2be3ba3f7c71b926c2b7a51d3d3edfe',
    'scripts/lib/eslint-test-hygiene.mjs': '0711bc78edc9a04ea942cbac99e383d39db0ff5c',
    'scripts/check-eslint-suppressions.ts': '6a02c35efd5f3e8a8b2cfbc681d94e51ebf2f1b7',
    'scripts/lib/eslint-suppressions.ts': 'f9c41a0ce386fa61f9c402bbbd594038344131af',
})
# The Vitest reader guard: a test that reads a lane-eligible file fails the full suite, so tests never
# read one. Pinned with the config that loads it (vitest.config.ts, re-pinned with it), so changing
# or disabling the guard forces a full gate.
READER_GUARD = ('vitest.setup.ts', 'tests/light-lane-reader-guard.ts', 'tests/light-lane-reader-guard.test.ts')
# The full gate's read lock: triage-failures.sh runs every Vitest process of the suite (the full run
# and the reruns in its checkout) under lane-lock.sh, which makes every tracked lane-eligible file
# except UNLOCKED unreadable, so any reader, in-process or a child process, fails the full gate that
# adds it. .gitignore stays readable because git must read it; R5 is its proof.
READ_LOCK = ('scripts/orchestration/triage-failures.sh', 'scripts/orchestration/lane-lock.sh', 'scripts/orchestration/lane-lock.test.sh')
UNLOCKED = ('.gitignore',)
BLOB_PINS.update({
    # Re-pinned after gate-hold-scope fix r3: one added line records the scratch checkout's own path in the
    # attempt's record before `git worktree add`; it reads no file, so the read lock and its file set are unchanged.
    'scripts/orchestration/triage-failures.sh': '3a212a47618ec464bfacffeb2bcb1055190aa8d4',
    'scripts/orchestration/lane-lock.sh': '16274088ef6743d875fb42077f4b61e7f5700f9f',
    'scripts/orchestration/lane-lock.test.sh': '1a8cdc2e393627340b429380f19577bbeb2a2ac8',
    'vitest.setup.ts': '9e9b09eae071d81f5be8b5911d5aef7173fcc41d',
    'tests/light-lane-reader-guard.ts': '0f3b0ee6b257689e777885abed37dd2ad250bf1b',
    'tests/light-lane-reader-guard.test.ts': 'c3511bfcca4dd09bf58d9789fb398cac8dc07c0a',
})
GLOBALS_CSS = 'src/styles/globals.css'
GLOBALS_LINE = re.compile(r"^@(source|import 'tailwindcss')")
GLOBALS_PIN = '98214fbdc34efcc657d981f9543bf00e9ff0c4778f4fb2a1c63de19a0140db8d'
SCRIPT_KEYS = ('typecheck', 'lint', 'lint:suppressions', 'lint:eslint', 'lint:eslint:app', 'lint:eslint:convex',
               'lint:unused', 'test', 'check:artifacts', 'catalog:pin', 'check:initial-migration-writers')
SCRIPTS_PIN = 'faa7127e10d25062de93522029b108a59805247cee8a646c4ea96ecfcbdf86c5'  # re-pinned after retro W3 (lint:suppressions pinned too)

# R3. Reviewed references: a (file, needle) hit that names an allowlisted path but is no gate input.
# Keyed by file and needle, never by line; '*' admits every needle in that file.
REFERENCES = {
    ('scripts/orchestration/light_lane.py', '*'):
        'The rule itself: its allowlist, pins and this table name the paths it governs.',
    ('scripts/orchestration/light-lane.test.py', '*'):
        "The rule's fixtures write these paths into temporary repositories.",
    ('tests/fixtures/spells-535/preserved.json', '*'):
        'A frozen whole-history hash manifest kept on disk until the #744 cleanup: no check reads it or the paths it lists (#749).',
    ('tests/fixtures/spells-536/preserved.json', '*'):
        'A frozen whole-history hash manifest kept on disk until the #744 cleanup: no check reads it or the paths it lists (#749).',
    ('tests/light-lane-reader-guard.ts', '*'):
        'The Vitest reader guard mirrors the allowlist; pinned by R4.',
    ('tests/light-lane-reader-guard.test.ts', '*'):
        "The reader guard's tests name lane-eligible files and read them only in guarded child processes; pinned by R4.",
    ('scripts/orchestration/lane-lock.test.sh', '*'):
        "The read lock's fixtures write lane files into temporary repositories and read them only inside the lock; pinned by R4.",
    ('scripts/orchestration/lane-lock.sh', '.gitignore'):
        'Comment: the lock leaves it readable; pinned by R4.',
    ('e2e/support/source-evidence.test.ts', "'.claude'"):
        'Fixture for the source fingerprint exclusions, in a temporary repository.',
    ('e2e/support/source-evidence.test.ts', "'CLAUDE.md'"):
        'Fixture for the source fingerprint exclusions, in a temporary repository.',
    ('e2e/support/source-evidence.test.ts', 'CLAUDE.md'):
        'Fixture for the source fingerprint exclusions, in a temporary repository.',
    ('e2e/support/source-evidence.test.ts', "'.gitignore'"):
        'A temporary-repository fixture that writes its own files of this name.',
    ('e2e/support/source-evidence.test.ts', '.gitignore'):
        'A temporary-repository fixture that writes its own files of this name.',
    ('e2e/support/source-evidence.ts', '.agents/'):
        'Source fingerprint exclusion list (run evidence only); blob pinned by R4.',
    ('e2e/support/source-evidence.ts', '.claude/'):
        'Source fingerprint exclusion list (run evidence only); blob pinned by R4.',
    ('e2e/support/source-evidence.ts', "'CLAUDE.md'"):
        'Source fingerprint exclusion list (run evidence only); blob pinned by R4.',
    ('e2e/support/source-evidence.ts', 'CLAUDE.md'):
        'Source fingerprint exclusion list (run evidence only); blob pinned by R4.',
    ('e2e/support/source-evidence.ts', 'docs/'):
        'Source fingerprint exclusion list (run evidence only); blob pinned by R4.',
    ('eslint.config.mjs', '.claude/'):
        'ESLint ignores .claude/**; blob pinned by R4.',
    ('scripts/catalog-record-review.ts', 'docs/agents/orchestration/t3-reviews.md'):
        'Help text pointing at the doc; never read.',
    ('scripts/check-artifacts.test.mjs', "'.gitignore'"):
        'A temporary-repository fixture that writes its own files of this name.',
    ('scripts/check-artifacts.test.mjs', '.gitignore'):
        'A temporary-repository fixture that writes its own files of this name.',
    ('scripts/orchestration/cur-land.sh', 'docs/agents/orchestration/operations.md'):
        'Header comment; never read.',
    ('scripts/orchestration/cur-land.test.sh', "'.gitignore'"):
        'A temporary-repository fixture that writes its own files of this name.',
    ('scripts/orchestration/cur-land.test.sh', '.gitignore'):
        'A temporary-repository fixture that writes its own files of this name.',
    ('scripts/orchestration/e2e-branch.sh', 'docs/'):
        'The preflight skip filter: a docs/* change only makes the preflight skip.',
    ('scripts/orchestration/gate-operator.test.py', "'.gitignore'"):
        'A temporary-repository fixture that writes its own files of this name.',
    ('scripts/orchestration/gate-operator.test.py', '.gitignore'):
        'A temporary-repository fixture that writes its own files of this name.',
    ('scripts/orchestration/gate_monitor.py', 'docs/agents/orchestration/operations.md'):
        'Module docstring; never read.',
    ('scripts/orchestration/host-audits.test.sh', "'.gitignore'"):
        'A temporary-repository fixture that writes its own files of this name.',
    ('scripts/orchestration/host-audits.test.sh', '.gitignore'):
        'A temporary-repository fixture that writes its own files of this name.',
    ('scripts/orchestration/land-queue.sh', 'docs/agents/orchestration/paired-gates.md'):
        'Header comment; never read.',
    ('scripts/orchestration/remote-checks.test.py', "'.gitignore'"):
        'A temporary-repository fixture that writes its own files of this name.',
    ('scripts/orchestration/remote-checks.test.py', '.gitignore'):
        'A temporary-repository fixture that writes its own files of this name.',
    ('skills-lock.json', "'SKILL.md'"):
        'The skill install lockfile names upstream skill paths and hashes; no gate stage reads it.',
    ('src/styles/globals.css', '{.agents}'):
        'Tailwind @source exclusion; lines pinned by R4.',
    ('src/styles/globals.css', '{.claude}'):
        'Tailwind @source exclusion; lines pinned by R4.',
    ('src/styles/globals.css', '{docs}'):
        'Tailwind @source exclusion; lines pinned by R4.',
    ('tsconfig.json', "'.agents'"):
        'TypeScript exclude; blob pinned by R4.',
}

NAME = 'A-Za-z0-9_.-'
QUOTE = '[\'"`]'
GITIGNORE_LINE = re.compile(r'\.claude/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*/?')
LINK = re.compile(r'\]\(\s*([^)\s]+)[^)]*\)')
SKIPPED_LINKS = ('http:', 'https:', 'mailto:', '#', '/', '$', '<')


def refuse(message):
    raise RuntimeError('Light lane refused: ' + message)


def fail(message):
    raise RuntimeError('Light check failed: ' + message)


def git(root, *args, check=True):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True,
                            env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})
    if check and result.returncode != 0:
        refuse('git ' + ' '.join(args[:2]) + ' failed: ' + result.stderr.decode(errors='replace').strip())
    return result


def resolve(root, revision):
    return git(root, 'rev-parse', '--verify', '--quiet', revision + '^{commit}').stdout.decode().strip()


def blob(root, commit, path):
    """A path's blob at COMMIT, or None when absent or not a blob."""
    result = git(root, 'cat-file', '-p', commit + ':' + path, check=False)
    kind = git(root, 'cat-file', '-t', commit + ':' + path, check=False).stdout.decode().strip()
    return result.stdout if result.returncode == 0 and kind == 'blob' else None


def delta(root, base, commit):
    """R1. The raw, rename-free delta as [{path, status, oldMode, newMode}], sorted by path."""
    raw = git(root, 'diff-tree', '-r', '--no-renames', '--raw', '--no-abbrev', '-z', base, commit).stdout.split(b'\0')
    rows = []
    for meta, path in zip(raw[0::2], raw[1::2]):
        old_mode, new_mode, _, _, status = meta.decode().lstrip(':').split(' ')
        rows.append(dict(path=path.decode(), status=status, oldMode=old_mode, newMode=new_mode))
    if not rows:
        refuse('empty delta')
    rows.sort(key=lambda row: row['path'])
    for row in rows:
        present = [mode for mode in (row['oldMode'], row['newMode']) if mode != '000000']
        if row['status'] not in ('A', 'M') or any(mode != '100644' for mode in present):
            refuse('%s %s mode %s->%s' % (row['path'], row['status'], row['oldMode'], row['newMode']))
    return rows


def allowed(path):
    """R2."""
    if path in EXACT:
        return True
    if path.endswith('.md') and path.startswith(MARKDOWN_PREFIXES):
        return True
    return re.fullmatch(r'\.claude/agents/[^/]+\.md', path) is not None


def needles(path):
    """R3. (label, literal, regex) triples that name PATH: the full path; its basename quoted or after
    '/', closed by a quote; each ancestor directory followed by '/' and a non-name character (*, a
    quote, $, whitespace or the end); each ancestor quoted alone or as a {a,b} member; and each
    ancestor of two or more components as a bare path not continued by a name character or '/'
    (the retired curate.sh's 'templates=$repo/docs/agents/orchestration/templates'). '/' is a boundary, so
    '$repo/docs/...' is a hit. Every regex contains its literal."""
    edge = '(?<![%s])' % NAME
    name = posixpath.basename(path)
    found = [(path, path, edge + re.escape(path) + '(?![%s])' % NAME),
             ("'%s'" % name, name, '(?:%s|/)%s%s' % (QUOTE, re.escape(name), QUOTE))]
    parts = path.split('/')[:-1]
    for depth in range(1, len(parts) + 1):
        ancestor = '/'.join(parts[:depth])
        found += [(ancestor + '/', ancestor, edge + re.escape(ancestor) + '/(?=[*\'"`$\\s]|$)'),
                  ("'%s'" % ancestor, ancestor, QUOTE + re.escape(ancestor) + QUOTE),
                  ('{%s}' % ancestor, ancestor, '[{,]\\s*' + re.escape(ancestor) + '\\s*[,}]')]
        if depth > 1:
            found.append((ancestor, ancestor, edge + re.escape(ancestor) + '(?![%s/])' % NAME))
    return found


def needle_table(paths):
    """PATHS' needles grouped by literal: {literal: [(label, compiled regex, path)]}, each needle once."""
    table, seen = {}, set()
    for path in paths:
        for label, literal, pattern in needles(path):
            if (label, pattern) not in seen:
                seen.add((label, pattern))
                table.setdefault(literal, []).append((label, re.compile(pattern), path))
    return table


def minimal_literals(literals):
    """LITERALS without any that contain a shorter kept one: a line holding a dropped literal also
    holds the kept one, so grepping the kept ones selects the same lines."""
    kept = []
    for literal in sorted(literals, key=lambda value: (len(value), value)):
        if not any(shorter in literal for shorter in kept):
            kept.append(literal)
    return kept


def grep_lines(root, commit, literals):
    """(file, line number, text) of every line at COMMIT, outside *.md, *.mdx and binary files, that
    contains one of LITERALS: one combined git grep -P over their escaped alternation."""
    combined = '|'.join(re.escape(literal) for literal in literals)
    result = git(root, 'grep', '-n', '-P', '-I', '-z', '-e', combined, commit, '--', '.', ':!*.md', ':!*.mdx', check=False)
    if result.returncode not in (0, 1):
        refuse('census git grep failed: ' + result.stderr.decode(errors='replace').strip())
    prefix = commit + ':'
    for record in result.stdout.decode(errors='surrogateescape').split('\n'):
        if record:
            file, number, text = record.split('\0', 2)
            yield file[len(prefix):] if file.startswith(prefix) else file, int(number), text


def census(root, commit, paths):
    """R3. Every hit of PATHS' needles at COMMIT as [(file, line, needle label, path)], in Git's
    order: grep_lines selects the candidate lines (a superset, since each needle contains its
    literal), and each needle's regex decides on the lines that contain its literal."""
    table = needle_table(paths)
    hits = []
    for file, number, text in grep_lines(root, commit, minimal_literals(table)):
        for literal, group in table.items():
            if literal in text:
                hits += [(file, number, label, path) for label, pattern, path in group if pattern.search(text)]
    return hits


def references(root, commit, paths):
    rows = []
    for file, number, label, path in census(root, commit, paths):
        if (file, label) not in REFERENCES and (file, '*') not in REFERENCES:
            refuse('%s is referenced by %s:%d (%s)' % (path, file, number, label))
        rows.append(dict(file=file, line=number, needle=label))
    return rows


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def pins(root, commit):
    """R4. Values at COMMIT; any mismatch with the pins refuses."""
    values = {}
    for path, expected in BLOB_PINS.items():
        actual = git(root, 'rev-parse', '--verify', '--quiet', commit + ':' + path, check=False).stdout.decode().strip()
        if actual != expected or blob(root, commit, path) is None:
            refuse('reader pin changed: ' + path)
        values[path] = actual
    css = blob(root, commit, GLOBALS_CSS)
    lines = [line for line in (css or b'').decode(errors='surrogateescape').splitlines() if GLOBALS_LINE.match(line)]
    values[GLOBALS_CSS] = sha256(''.join(line + '\n' for line in lines).encode(errors='surrogateescape'))
    if css is None or values[GLOBALS_CSS] != GLOBALS_PIN:
        refuse('reader pin changed: ' + GLOBALS_CSS)
    values['package.json scripts'] = scripts_digest(blob(root, commit, 'package.json'))
    if values['package.json scripts'] != SCRIPTS_PIN:
        refuse('reader pin changed: package.json scripts')
    return values


def scripts_digest(manifest):
    try:
        scripts = json.loads(manifest)['scripts']
        subset = {key: scripts.get(key) for key in SCRIPT_KEYS}
    except (TypeError, ValueError, KeyError, AttributeError):
        return None
    return sha256(json.dumps(subset, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode())


def text_lines(data):
    """The lines of a UTF-8 text blob (a final newline ends the last line; None, an absent blob, has
    none). ValueError for binary (a NUL byte) or non-UTF-8 content."""
    if data is None:
        return []
    if b'\0' in data:
        raise ValueError('binary')
    lines = data.decode('utf-8').split('\n')
    return lines[:-1] if lines[-1] == '' else lines


def inserted(old, new):
    """(line number, text) of the NEW lines that are not OLD's, when OLD is a subsequence of NEW (only
    insertions), else None. A greedy match finds the subsequence whenever one exists."""
    added, matched = [], 0
    for number, line in enumerate(new, 1):
        if matched < len(old) and line == old[matched]:
            matched += 1
        else:
            added.append((number, line))
    return added if matched == len(old) else None


def added_lines(old, new):
    """(line number, text) of each NEW line that a line diff of OLD to NEW inserts or replaces."""
    matcher = difflib.SequenceMatcher(None, old, new, autojunk=False)
    return [(number + 1, new[number]) for tag, _, _, start, stop in matcher.get_opcodes()
            if tag in ('insert', 'replace') for number in range(start, stop)]


def gitignore(root, base, commit):
    """R5. Compared as blob lines, never as patch text: the new .gitignore is the old one with only
    blank lines, comments and literal .claude/ paths inserted."""
    try:
        old, new = (text_lines(blob(root, revision, '.gitignore')) for revision in (base, commit))
    except ValueError:
        refuse('.gitignore is binary or not UTF-8 text')
    added = inserted(old, new)
    if added is None:
        refuse('.gitignore removes or changes lines')
    for _, line in added:
        if line.strip(' ') and not line.startswith('#') and not GITIGNORE_LINE.fullmatch(line):
            refuse('.gitignore line is not a literal .claude/ path: ' + line)


def verify(root, base, commit):
    """R1 to R5 from Git objects; the proof as a dict, or RuntimeError('Light lane refused: ...')."""
    full_base, full_commit = resolve(root, base), resolve(root, commit)
    if not full_base or not full_commit:
        refuse('unknown revision: ' + (base if not full_base else commit))
    rows = delta(root, full_base, full_commit)
    for row in rows:
        if not allowed(row['path']):
            refuse(row['path'] + ' is outside ' + RULE)
    paths = [row['path'] for row in rows]
    found = references(root, full_commit, paths)
    values = pins(root, full_commit)
    if '.gitignore' in paths:
        gitignore(root, full_base, full_commit)
    tree = git(root, 'rev-parse', full_commit + '^{tree}').stdout.decode().strip()
    return dict(rule=RULE, base=full_base, commit=full_commit, tree=tree, paths=rows, references=found, pins=values)


def strict_object(pairs):
    keys = [key for key, _ in pairs]
    duplicate = next((key for key in keys if keys.count(key) > 1), None)
    if duplicate is not None:
        raise ValueError('duplicate key: ' + duplicate)
    return dict(pairs)


def reject_constant(name):
    raise ValueError('non-standard constant: ' + name)


def link_resolves(root, commit, path, target):
    joined = posixpath.normpath(posixpath.join(posixpath.dirname(path), target))
    if joined == '..' or joined.startswith('../'):
        return False
    return git(root, 'cat-file', '-e', commit + ':' + joined, check=False).returncode == 0


def light_checks(root, base, commit):
    """Strict JSON for each changed .json, and relative links on added lines of each changed .md."""
    full_base, full_commit = resolve(root, base), resolve(root, commit)
    for row in delta(root, full_base, full_commit):
        path = row['path']
        if path.endswith('.json'):
            try:
                json.loads(blob(root, full_commit, path).decode('utf-8'), object_pairs_hook=strict_object, parse_constant=reject_constant)
            except ValueError as exc:
                fail('%s: invalid JSON (%s)' % (path, exc))
        if path.endswith('.md'):
            try:
                old, new = (text_lines(blob(root, revision, path)) for revision in (full_base, full_commit))
            except ValueError:
                fail(path + ': binary or non-UTF-8 Markdown')
            for number, text in added_lines(old, new):
                for target in LINK.findall(text):
                    local = target.split('#', 1)[0]
                    if target.startswith(SKIPPED_LINKS) or not local:
                        continue
                    if not link_resolves(root, full_commit, path, local):
                        fail('%s:%d: link target missing: %s' % (path, number, target))


def lockable_files(root):
    """The tracked regular files in ROOT's index that R2 allows, except UNLOCKED: what lane-lock.sh locks."""
    listing = git(root, 'ls-files', '-s', '-z').stdout.decode(errors='surrogateescape').split('\0')
    paths = [entry.split('\t', 1)[1] for entry in listing if entry.startswith('100')]
    return [path for path in paths if allowed(path) and path not in UNLOCKED]


def lane(result):
    return dict(mode='light', rule=RULE, paths=[row['path'] for row in result['paths']])


def outcome(operation):
    """(exit code, result or reason): 0 pass, 1 refusal, 2 light-check failure."""
    try:
        return 0, operation()
    except RuntimeError as exc:
        return (2 if str(exc).startswith('Light check failed: ') else 1), str(exc)


def check(root, base, commit):
    def run():
        result = verify(root, base, commit)
        light_checks(root, result['base'], result['commit'])
        return result
    code, value = outcome(run)
    print(json.dumps(dict(verdict='PASS', **value, lane=lane(value)) if code == 0 else dict(verdict='FAIL', reason=value)))
    return code


def verify_evidence(wt, base, commit, evidence):
    evidence = Path(evidence)
    if not evidence.is_absolute():
        print('light refused: evidence directory must be absolute: ' + str(evidence))
        return 1
    if os.path.lexists(evidence):
        print('light refused: evidence exists: ' + str(evidence))
        return 1

    def run():
        result = verify(wt, base, commit)
        light_checks(wt, result['base'], result['commit'])
        return result
    code, value = outcome(run)
    if code != 0:
        print(('light check failed: ' if code == 2 else 'light refused: ') + value.split(': ', 1)[1])
        return code
    evidence.mkdir()
    record = evidence / 'light-verification.json'
    with record.open('x') as stream:
        json.dump(dict(**value, passed=True), stream, indent=2)
        stream.write('\n')
    print('light verified %s: %d paths, base %s, commit %s, tree %s' % (RULE, len(value['paths']), value['base'], value['commit'], value['tree']))
    for row in value['paths']:
        print('light path %s %s' % (row['status'], row['path']))
    print('light references %d (reviewed); record %s' % (len(value['references']), record))
    return 0


def main(argv):
    if len(argv) == 4 and argv[0] == 'check':
        return check(*argv[1:])
    if len(argv) == 5 and argv[0] == 'verify':
        return verify_evidence(*argv[1:])
    if len(argv) == 2 and argv[0] == 'lockable':
        sys.stdout.write(''.join(path + '\0' for path in lockable_files(argv[1])))
        return 0
    if argv == ['eligible']:
        sys.stdout.write(''.join(path + '\0' for path in sys.stdin.read().split('\0') if path and allowed(path)))
        return 0
    if argv[:1] == ['verify']:
        print('light refused: usage: light_lane.py verify WT BASE COMMIT EVIDENCE_DIR')
    else:
        print(json.dumps(dict(verdict='FAIL', reason='usage: light_lane.py check ROOT BASE COMMIT | verify WT BASE COMMIT EVIDENCE_DIR')))
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
