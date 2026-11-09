#!/usr/bin/env python3
"""The agent-launch guard: no tracked code names an agent CLI.

Agents run as T3 delegated tasks (.agents/skills/orchestrate-spec/RUNTIMES.md) and gates through the
script operator. The retired spawn.sh was a fail-open CLI route: a test once started three real
Codex workers through it (incident-real-codex-spawn, 2026-11-04).

The claim: any tracked occurrence of an agent name as a token is refused unless allowlisted line by
line, so no ordinary launch can pass. Only names constructed at run time escape (built from pieces,
read from an environment variable or a config file), and that is deliberate obfuscation, out of
scope by the threat model: accidental launches in ordinary tracked code, whatever its formatting.

The rule: a scanned line is refused when one of AGENTS appears in its raw text as a whole token
(TOKEN), whatever surrounds it: a string, a comment, an identifier or shell text alike. Nothing is
parsed. A whole token has
- before it: not [A-Za-z0-9_.], and not a '-' that itself follows [A-Za-z0-9_.]; or else a
  control escape (\\n, \\t, \\r, \\v, \\f, \\0), whose letter would otherwise hide the name in
  'set -e\\nNAME exec';
- after it: not [A-Za-z0-9_-].
So /bin/codex, "codex, @claude, a Makefile recipe's '\\t  -codex' and a JSON-escaped \\"codex\\" all
count, while .claude, codex_limit, claudeResume, monsterCodex and foo-codex do not.

Scanned by default: every tracked text file, whatever its type (code, shell, YAML, TOML, JSON config,
ini, Dockerfile, .env, patches, a file type nobody has listed). Not scanned:
- binary content, as git judges it (a NUL in the first 8,000 bytes), symlinks, submodules and
  untracked files: none is tracked text a program runs from;
- the light lane's eligible paths (light_lane.allowed: AGENTS.md, CLAUDE.md, docs/standards.md, the
  agent docs and skills prose, .claude/agents/*.md, .claude/settings.json, .gitignore). The full
  queue never reads them, so reading one here would let a light landing change this check's result;
  their coverage is the light lane's rule, not this guard's. Named among them:
  .claude/settings.json can hold hook commands, and it stays unscanned here because it is
  light-lane eligible (root ruling, 2026-11-06); a follow-up has the light lane's own checks refuse
  agent-name tokens in it;
- EXCLUSIONS, each a path glob with its reason. A file type that can run commands is never excluded
  by type alone: only prose, pages and the lockfile are, and the data exclusions name their trees.
Measured over this repository (2026-11-06, capped, three runs): 3,672 text files in 1.8 s wall.

Allowlist: a legitimate occurrence (a provider id, a test's stub binaries) is listed in ALLOWLIST by
repo path and the exact stripped text of its line, with a one-line reason; it covers that text on
any line of that file. Only the guard's own two files may be listed whole (ALLOWED_FILES), so they
can name the binaries freely. An entry that no longer matches a refused line, or a listed file with
no refused line, fails the guard, so the list can't go stale. Prefer fixing a line over listing it.

python3 -B agent_launch_guard.py [ROOT]: prints each refused line and each stale entry; exit 1 if any.
"""
from pathlib import Path
import re
import subprocess
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import light_lane  # noqa: E402

AGENTS = ('codex', 'claude', 'gemini', 'opencode', 'cursor-agent', 'aider')

PROSE = 'Prose: rendered or read, never executed; a doc may name a command without running it.'
PAGES = 'Static pages and styles: served or rendered, with no command field anything here runs.'
SOURCE_DATA = ('Pinned upstream source data (Foundry YAML, PCGen LST/PCC) and captured text: tests '
               'read it as data, nothing runs it; the code in the same tree stays scanned.')
RECORDED = ('Recorded fixture data (captured tool responses, release snapshots, expected outputs): '
            'tests parse it, nothing runs it; the code in the same tree stays scanned.')
CATALOG = ('Catalog data records (scopes, notices, reviewed legal records, registries): parsed by '
           'the catalog code, never run; their reviewer labels may name a model.')
EXCLUSIONS = {
    '**/*.md': PROSE,
    '**/*.mdx': PROSE,
    '**/*.html': PAGES,
    '**/*.css': PAGES,
    'pnpm-lock.yaml': 'The lockfile: resolved package names and hashes that pnpm reads; it holds no scripts.',
    'tests/fixtures/**/*.yaml': SOURCE_DATA,
    'tests/fixtures/**/*.lst': SOURCE_DATA,
    'tests/fixtures/**/*.pcc': SOURCE_DATA,
    'tests/fixtures/**/*.txt': SOURCE_DATA,
    'tests/fixtures/**/*.json': RECORDED,
    'scripts/catalog/legal/**/*.json': CATALOG,
    'scripts/catalog/scopes/**/*.json': CATALOG,
    'src/lib/catalog/data/**/*.json': CATALOG,
}


def glob_pattern(glob):
    """A path glob as a regex: '**/' is any directories (or none), '*' a run within one segment."""
    out, i = [], 0
    while i < len(glob):
        if glob.startswith('**/', i):
            out.append('(?:.*/)?')
            i += 3
        elif glob[i] == '*':
            out.append('[^/]*')
            i += 1
        else:
            out.append(re.escape(glob[i]))
            i += 1
    return re.compile(''.join(out) + r'\Z')


EXCLUDED = [(glob, glob_pattern(glob)) for glob in EXCLUSIONS]

TOKEN = re.compile(r'(?:(?<![A-Za-z0-9_.])(?<![A-Za-z0-9_.]-)|(?<=\\[ntrvf0]))(?:%s)(?![A-Za-z0-9_-])'
                   % '|'.join(re.escape(agent) for agent in AGENTS))

GUARD_FILES = ('scripts/orchestration/agent_launch_guard.py', 'scripts/orchestration/agent-launch-guard.test.py')
ALLOWED_FILES = {
    GUARD_FILES[0]: 'The guard: it lists the binaries and the allowlisted lines.',
    GUARD_FILES[1]: "The guard's fixtures: inert launches in scratch repositories, never run.",
}
ALLOWLIST = {
    ('scripts/orchestration/env-guard.test.sh',
     '''for stub in codex claude; do printf '#!/usr/bin/env bash\\nexit 1\\n' > "$d/bin/$stub"; done'''):
        'Stub binaries that fail, first on PATH, so a regression never reaches a real model.',
    ('scripts/orchestration/gate-operator.test.py',
     "providerInstanceId='codex', model='gpt-6.1-sol', options=dict(reasoningEffort='high', serviceTier='default'))))"):
        'A T3 provider id in a fixture.',
    ('scripts/orchestration/gate-run.test.py',
     "self.terminal(folder / (axis + '-terminal.json'), 'review-' + axis, 'codex', 'gpt-6.1-sol', SOL)"):
        'A T3 provider id in a fixture.',
    ('scripts/orchestration/gate-run.test.py',
     "self.assertEqual(review['target'], dict(providerInstanceId='codex', model='gpt-6.1-sol', "
     "options=dict(reasoningEffort='xhigh', serviceTier='default')))"):
        'A T3 provider id in an assertion.',
    ('scripts/orchestration/gate-run.test.py',
     "codex = dict(taskId='t', childRunId='r', providerInstanceId='codex', model='gpt-6.1-sol',"):
        'A T3 provider id in a fixture, held in a variable named after it.',
    ('scripts/orchestration/gate-run.test.py', 'gate_core.operator_identity(self.values(), codex)'):
        'That fixture variable passed to the operator identity check (two lines).',
    ('scripts/orchestration/gate-run.test.py',
     "self.assertEqual(gate_core.operator_identity(self.values(), codex), 'codex')"):
        'The operator identity gate_core returns for a provider id.',
    ('scripts/orchestration/gate_core.py',
     "already prepared under it, the earlier codex operator task. Returns 'script' or 'codex'.\"\"\""):
        'Docstring naming the operator identity.',
    ('scripts/orchestration/gate_core.py',
     "require(task.get('providerInstanceId') == 'codex' and task.get('model') == 'gpt-6.1-sol'"):
        'Checks a T3 task provider id.',
    ('scripts/orchestration/gate_core.py', "return 'codex'"):
        'The operator identity for that provider id.',
    ('tests/catalog/review-receipts.test.ts', "providerInstanceId: 'codex',"):
        'A T3 provider id in a fixture.',
    ('tests/catalog/t3-code-mode-fixture.ts', "providerInstanceId: 'codex',"):
        'A T3 provider id in a fixture.',
    ('tests/catalog/t3-review-evidence.test.ts', "providerInstanceId: 'codex',"):
        'T3 provider ids in fixtures (two lines).',
}


def tracked(root):
    """(mode, path) of every tracked regular file in ROOT."""
    listing = subprocess.run(['git', '-C', str(root), 'ls-files', '-s', '-z'], check=True,
                             capture_output=True).stdout.decode(errors='surrogateescape')
    for entry in filter(None, listing.split('\0')):
        meta, path = entry.split('\t', 1)
        mode = meta.split()[0]
        if mode in ('100644', '100755'):
            yield mode, path


def exclusion(path):
    """The EXCLUSIONS glob that covers PATH, or None."""
    return next((glob for glob, pattern in EXCLUDED if pattern.match(path)), None)


def candidates(root):
    """The tracked paths the guard reads unless their content is binary (module docstring)."""
    return [path for _, path in tracked(root) if not light_lane.allowed(path) and not exclusion(path)]


def text_of(root, path):
    """PATH's text, or None when git would judge it binary (a NUL in its first 8,000 bytes)."""
    try:
        data = (Path(root) / path).read_bytes()
    except OSError:
        return None
    return None if b'\0' in data[:8000] else data.decode(errors='surrogateescape')


def scanned(root):
    """The tracked text paths the guard reads."""
    return [path for path in candidates(root) if text_of(root, path) is not None]


def refused(root):
    """(path, line number, stripped line) of each line holding an agent name as a token."""
    lines = []
    for path in candidates(root):
        text = text_of(root, path)
        if text is None:
            continue
        for number, line in enumerate(text.split('\n'), 1):
            if TOKEN.search(line):
                lines.append((path, number, line.strip()))
    return lines


def check(root, allowlist=None, allowed_files=None):
    """(launches, stale): refused lines neither list covers, and the entries no refused line matches."""
    allowlist = ALLOWLIST if allowlist is None else allowlist
    allowed_files = ALLOWED_FILES if allowed_files is None else allowed_files
    found = refused(root)
    keys = {(path, line) for path, _, line in found}
    paths = {path for path, _, _ in found}
    launches = ['%s:%d: %s' % hit for hit in found
                if hit[0] not in allowed_files and (hit[0], hit[2]) not in allowlist]
    stale = (['%s: %s' % key for key in sorted(allowlist) if key not in keys]
             + ['%s (whole file)' % path for path in sorted(allowed_files) if path not in paths])
    return launches, stale


def main(argv):
    root = Path(argv[0]) if argv else Path(subprocess.run(['git', '-C', str(HERE), 'rev-parse', '--show-toplevel'],
                                                          check=True, capture_output=True, text=True).stdout.strip())
    launches, stale = check(root)
    for line in launches:
        print('agent CLI named: ' + line)
    for line in stale:
        print('stale allowlist entry: ' + line)
    return 1 if launches or stale else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
