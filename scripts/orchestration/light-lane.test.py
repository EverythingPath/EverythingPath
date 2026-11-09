"""light-lane-v1 rule fixtures (docs/agents/orchestration/operations.md, "Light landing lane").

Temporary Git repositories only; no live gate. `python3 -B light-lane.test.py fixture REPO` writes the
pinned reader files into REPO for the shell fixtures (cur-land.test.sh)."""
import contextlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import light_lane  # noqa: E402

RUNBOOK = 'docs/agents/orchestration/runbook.md'
ROLE = 'docs/agents/orchestration/roles/implementer.md'


def git(root, *args, **kwargs):
    return subprocess.run(['git', '-C', str(root), *args], check=True, capture_output=True, text=True, **kwargs).stdout.strip()


def has_pinned_commit():
    """Whether light_lane.PINNED_AT is in this repository's objects: on the gate host, but not in CI's depth-1 gate
    checkout, a parentless commit of the candidate's tree alone (gate-ci-workflow)."""
    return subprocess.run(['git', '-C', str(HERE), 'cat-file', '-e', light_lane.PINNED_AT + '^{commit}'], capture_output=True).returncode == 0


def host_only(test, reason):
    """Skips test with a visible marker naming the missing gate-host source (never a silent pass)."""
    print('SKIP (host-only: %s) %s' % (reason, test.id()), file=sys.stderr, flush=True)
    test.skipTest('host-only: ' + reason)


def pinned_source(name, digest, pin):
    """name as it was at light_lane.PINNED_AT. Without that commit (CI's depth-1 checkout), HEAD's, only when its
    digest(text) is the pin, so the pinned parts the fixtures copy are the same; a stale pin still fails here."""
    if has_pinned_commit():
        return git(HERE, 'show', light_lane.PINNED_AT + ':' + name)
    text = git(HERE, 'show', 'HEAD:' + name)
    if digest(text) != pin:
        raise AssertionError('reader pin changed: %s differs from its pin at HEAD, and %s is not here' % (name, light_lane.PINNED_AT))
    return text


def globals_digest(text):
    return light_lane.sha256(''.join(line + '\n' for line in text.splitlines() if light_lane.GLOBALS_LINE.match(line)).encode())


def pinned_manifest():
    """package.json at light_lane.PINNED_AT (or HEAD's, when its pinned scripts are the pin's)."""
    return pinned_source('package.json', light_lane.scripts_digest, light_lane.SCRIPTS_PIN)


def pinned_files():
    """The reader files the pins name, as they were at light_lane.PINNED_AT in this repository's objects (blob pins by
    id, which HEAD's tree holds while every pin matches it; globals.css and package.json via pinned_source())."""
    files = {name: subprocess.check_output(['git', '-C', str(HERE), 'cat-file', 'blob', blob])
             for name, blob in light_lane.BLOB_PINS.items()}
    css = pinned_source(light_lane.GLOBALS_CSS, globals_digest, light_lane.GLOBALS_PIN).splitlines()
    files[light_lane.GLOBALS_CSS] = ''.join(line + '\n' for line in css if light_lane.GLOBALS_LINE.match(line)).encode()
    scripts = json.loads(pinned_manifest())['scripts']
    files['package.json'] = (json.dumps(dict(name='fixture', scripts={key: scripts[key] for key in light_lane.SCRIPT_KEYS}), indent=2) + '\n').encode()
    return files


def install(repo):
    for name, content in pinned_files().items():
        path = Path(repo) / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


class Fixture(unittest.TestCase):
    """A base commit with the pinned readers, a runbook, a role file, a README and a source file."""

    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'))
        self.repo = Path(self.scratch.name) / 'repo'
        self.repo.mkdir()
        git(self.repo, 'init', '-q', '-b', 'main')
        git(self.repo, 'config', 'user.name', 'Fixture')
        git(self.repo, 'config', 'user.email', 'fixture@example.test')
        install(self.repo)
        self.write({RUNBOOK: '# Runbook\n\nSee [roles](roles/implementer.md).\n', ROLE: '# Implementer\n',
                    'README.md': '# Fixture\n', 'src/a.ts': 'export const a = 1;\n', '.gitignore': 'node_modules/\n',
                    'AGENTS.md': '# Agents\n'})
        self.base = self.commit('base')

    def tearDown(self):
        self.scratch.cleanup()

    def write(self, files):
        for name, content in files.items():
            path = self.repo / name
            if content is None:
                path.unlink()
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content if isinstance(content, bytes) else content.encode())

    def commit(self, message='change'):
        git(self.repo, 'add', '-A')
        git(self.repo, 'commit', '-q', '--allow-empty', '-m', message)
        return git(self.repo, 'rev-parse', 'HEAD')

    def change(self, files, message='change'):
        self.write(files)
        return self.commit(message)

    def verify(self, commit, base=None):
        return light_lane.verify(str(self.repo), base or self.base, commit)

    def refuses(self, commit, message, base=None):
        with self.assertRaises(RuntimeError) as caught:
            self.verify(commit, base)
        self.assertEqual(str(caught.exception), 'Light lane refused: ' + message)

    def light_fails(self, commit, message):
        with self.assertRaises(RuntimeError) as caught:
            light_lane.light_checks(str(self.repo), self.base, commit)
        self.assertEqual(str(caught.exception), 'Light check failed: ' + message)

    def cli(self, *args):
        result = subprocess.run([sys.executable, '-B', str(HERE / 'light_lane.py'), *map(str, args)], capture_output=True, text=True,
                                env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})
        return result


class PassTest(Fixture):
    def test_a_docs_only_delta_passes_with_sorted_paths(self):
        commit = self.change({RUNBOOK: '# Runbook v2\n', 'AGENTS.md': '# Agents v2\n', 'docs/product/plan/a.md': 'x\n',
                              '.claude/agents/coder.md': 'x\n', '.claude/settings.json': '{"permissions": {}}\n',
                              '.agents/skills/tool/SKILL.md': 'x\n', 'CLAUDE.md': 'x\n', 'docs/standards.md': 'x\n'})
        result = self.verify(commit)
        self.assertEqual(result['rule'], 'light-lane-v1')
        self.assertEqual((result['base'], result['commit'], result['tree']), (self.base, commit, git(self.repo, 'rev-parse', commit + '^{tree}')))
        self.assertEqual([row['path'] for row in result['paths']], sorted(['.agents/skills/tool/SKILL.md', '.claude/agents/coder.md',
                         '.claude/settings.json', 'AGENTS.md', 'CLAUDE.md', 'docs/product/plan/a.md', 'docs/standards.md', RUNBOOK]))
        self.assertEqual(result['paths'][0], dict(path='.agents/skills/tool/SKILL.md', status='A', oldMode='000000', newMode='100644'))
        self.assertIn(dict(path=RUNBOOK, status='M', oldMode='100644', newMode='100644'), result['paths'])
        self.assertTrue(all(row['file'] in pinned_files() for row in result['references']), result['references'])
        self.assertEqual(set(result['pins']), set(light_lane.BLOB_PINS) | {light_lane.GLOBALS_CSS, 'package.json scripts'})

    def test_short_revisions_resolve_to_full_identities(self):
        commit = self.change({RUNBOOK: '# Runbook v2\n'})
        result = self.verify(commit[:10], base=self.base[:10])
        self.assertEqual((result['base'], result['commit']), (self.base, commit))


class ShapeTest(Fixture):
    """R1: a non-empty delta of A or M entries with mode 100644 on each present side."""

    def test_an_empty_delta_refuses(self):
        self.refuses(self.commit('empty'), 'empty delta')

    def test_a_deletion_refuses(self):
        self.refuses(self.change({ROLE: None}), ROLE + ' D mode 100644->000000')

    def test_a_rename_refuses_as_its_deletion(self):
        self.write({ROLE: None, 'docs/agents/orchestration/roles/coder.md': '# Implementer\n'})
        self.refuses(self.commit(), ROLE + ' D mode 100644->000000')

    def test_a_symlink_refuses(self):
        os.symlink('runbook.md', self.repo / 'docs/agents/orchestration/link.md')
        self.refuses(self.commit(), 'docs/agents/orchestration/link.md A mode 000000->120000')

    def test_an_executable_refuses(self):
        (self.repo / ROLE).chmod(0o755)
        self.refuses(self.commit(), ROLE + ' M mode 100644->100755')


class AllowlistTest(Fixture):
    """R2: default deny."""

    def test_paths_outside_the_allowlist_refuse(self):
        for path in ('docs/catalog-import/x.md', 'docs/ai/x.md', 'README.md', 'src/a.ts', '.claude/settings.local.json',
                     '.claude/agents/sub/x.md', 'docs/agents/x.txt', 'docs/x.md', '.agents/skills/tool/run.sh', 'GLOSSARY.md'):
            with self.subTest(path):
                git(self.repo, 'reset', '-q', '--hard', self.base)
                self.refuses(self.change({path: 'changed\n'}), path + ' is outside light-lane-v1')

    def test_the_allowlist_refusal_names_the_first_path_outside_it(self):
        self.refuses(self.change({RUNBOOK: 'x\n', 'src/a.ts': 'export const a = 2;\n'}), 'src/a.ts is outside light-lane-v1')


class CensusTest(Fixture):
    """R3: every non-Markdown file naming a changed path must be a reviewed table entry."""

    def reader(self, name, text):
        self.write({name: text})
        self.base = self.commit('reader')

    def test_a_full_path_in_a_typescript_file_refuses(self):
        self.reader('src/r.ts', "export const runbook = 'docs/agents/orchestration/runbook.md';\n")
        self.refuses(self.change({RUNBOOK: 'x\n'}), RUNBOOK + ' is referenced by src/r.ts:1 (' + RUNBOOK + ')')

    def test_an_ancestor_after_a_slash_in_a_shell_file_refuses(self):
        self.reader('scripts/s.sh', '#!/bin/sh\ncat "$repo/docs/agents/orchestration/roles/$role.md"\n')
        self.refuses(self.change({ROLE: 'x\n'}), ROLE + ' is referenced by scripts/s.sh:2 (docs/agents/orchestration/roles/)')

    def test_a_bare_nested_ancestor_refuses(self):
        self.reader('scripts/t.sh', 'roles=$repo/docs/agents/orchestration/roles\n')
        self.refuses(self.change({ROLE: 'x\n'}), ROLE + ' is referenced by scripts/t.sh:1 (docs/agents/orchestration/roles)')

    def test_a_quoted_ancestor_refuses(self):
        self.reader('scripts/j.py', "path = join('docs', 'agents')\n")
        self.refuses(self.change({RUNBOOK: 'x\n'}), RUNBOOK + " is referenced by scripts/j.py:1 ('docs')")

    def test_a_brace_list_ancestor_refuses(self):
        self.reader('src/g.css', "@source not '../../{tests,docs}';\n")
        self.refuses(self.change({RUNBOOK: 'x\n'}), RUNBOOK + ' is referenced by src/g.css:1 ({docs})')

    def test_a_quoted_basename_after_a_slash_refuses(self):
        self.reader('scripts/b.py', "name = base + '/runbook.md'\n")
        self.refuses(self.change({RUNBOOK: 'x\n'}), RUNBOOK + " is referenced by scripts/b.py:1 ('runbook.md')")

    def test_a_name_continuing_the_path_is_not_a_hit(self):
        self.reader('scripts/n.sh', 'echo docs/agents/orchestration/runbook.md.bak xdocs/agents/orchestration/runbook.md\n')
        files = {row['file'] for row in self.verify(self.change({RUNBOOK: 'x\n'}))['references']}
        self.assertNotIn('scripts/n.sh', files)

    def test_a_table_entry_passes_and_is_reported(self):
        self.reader('src/r.ts', "export const runbook = 'docs/agents/orchestration/runbook.md';\n")
        commit = self.change({RUNBOOK: 'x\n'})
        table = lambda entries: mock.patch.object(light_lane, 'REFERENCES', {**light_lane.REFERENCES, **entries})
        with table({('src/r.ts', RUNBOOK): 'Fixture reader', ('src/r.ts', "'runbook.md'"): 'Fixture reader'}):
            result = self.verify(commit)
        self.assertEqual([row for row in result['references'] if row['file'] == 'src/r.ts'],
                         [dict(file='src/r.ts', line=1, needle=RUNBOOK), dict(file='src/r.ts', line=1, needle="'runbook.md'")])
        with table({('src/r.ts', '*'): 'Fixture rule file'}):
            self.assertIn(dict(file='src/r.ts', line=1, needle=RUNBOOK), self.verify(commit)['references'])
        with table({('src/other.ts', RUNBOOK): 'Another file', ('src/r.ts', "'runbook.md'"): 'Another needle'}):
            with self.assertRaisesRegex(RuntimeError, 'is referenced by src/r.ts:1'):
                self.verify(commit)

    def test_a_hit_in_markdown_is_ignored(self):
        self.reader('docs/notes.md', 'See docs/agents/orchestration/runbook.md.\n')
        self.write({'docs/page.mdx': "import x from 'docs/agents/orchestration/runbook.md'\n"})
        self.base = self.commit()
        files = {row['file'] for row in self.verify(self.change({RUNBOOK: 'x\n'}))['references']}
        self.assertFalse(files & {'docs/notes.md', 'docs/page.mdx'})

    def test_the_grep_keeps_only_minimal_literals(self):
        self.assertEqual(light_lane.minimal_literals(['docs/agents/orchestration', 'docs', 'runbook.md', 'docs/x.md', '.claude']),
                         ['docs', '.claude', 'runbook.md'])
        table = light_lane.needle_table([RUNBOOK, ROLE])
        self.assertEqual(sorted(light_lane.minimal_literals(table)), ['docs', 'implementer.md', 'runbook.md'])
        self.assertEqual(len({label for group in table.values() for label, _, _ in group}),
                         len({label for path in (RUNBOOK, ROLE) for label, _, _ in light_lane.needles(path)}))

    def test_the_reviewed_table_is_keyed_by_file_and_needle_with_reasons(self):
        self.assertTrue(light_lane.REFERENCES)
        for (file, needle), reason in light_lane.REFERENCES.items():
            self.assertTrue(file and needle and isinstance(reason, str) and reason.strip(), (file, needle))
        self.assertIn(('scripts/orchestration/light_lane.py', '*'), light_lane.REFERENCES)
        self.assertIn(('scripts/orchestration/light-lane.test.py', '*'), light_lane.REFERENCES)
        stars = sorted(file for file, needle in light_lane.REFERENCES if needle == '*')
        self.assertEqual(stars, sorted(['scripts/orchestration/light_lane.py', 'scripts/orchestration/light-lane.test.py',
                                        'tests/fixtures/spells-535/preserved.json', 'tests/fixtures/spells-536/preserved.json',
                                        'tests/light-lane-reader-guard.ts', 'tests/light-lane-reader-guard.test.ts',
                                        'scripts/orchestration/lane-lock.test.sh']))


class PinTest(Fixture):
    """R4: the readers that enumerate files without naming one stay at their pinned values."""

    def moved_base(self, files):
        self.base = self.change(files, 'base movement')
        return self.change({RUNBOOK: (self.repo / RUNBOOK).read_text() + 'x\n'})

    def test_a_changed_pinned_blob_refuses_naming_it(self):
        for name in light_lane.BLOB_PINS:
            with self.subTest(name):
                git(self.repo, 'reset', '-q', '--hard', self.base)
                saved = self.base
                commit = self.moved_base({name: (self.repo / name).read_bytes() + b'\n'})
                self.refuses(commit, 'reader pin changed: ' + name)
                self.base = saved

    def test_a_missing_pinned_file_refuses(self):
        self.refuses(self.moved_base({'knip.jsonc': None}), 'reader pin changed: knip.jsonc')

    def test_globals_css_outside_the_source_lines_passes_and_a_source_edit_refuses(self):
        css = (self.repo / light_lane.GLOBALS_CSS).read_text()
        self.verify(self.moved_base({light_lane.GLOBALS_CSS: css + '.x { color: red; }\n'}))
        self.refuses(self.moved_base({light_lane.GLOBALS_CSS: css.replace("'../../**/*.md'", "'../../**/*.mdx'")}),
                     'reader pin changed: ' + light_lane.GLOBALS_CSS)

    def test_a_dependency_edit_passes_and_a_script_edit_refuses(self):
        manifest = json.loads((self.repo / 'package.json').read_text())
        manifest['dependencies'] = dict(left='1.0.0')
        self.verify(self.moved_base({'package.json': json.dumps(manifest)}))
        manifest['scripts']['lint'] += ' && markdownlint .'
        self.refuses(self.moved_base({'package.json': json.dumps(manifest)}), 'reader pin changed: package.json scripts')

    def test_the_skipped_stage_implementations_are_pinned(self):
        # Review r3: an AGENTS-only edit passed the lane while a changed catalog:pin script read the file.
        self.assertEqual(light_lane.STAGE_IMPLEMENTATIONS, ('scripts/catalog-pin.ts', 'src/lib/catalog/calculation-identities.ts',
                                                            'src/lib/catalog/runtime-compatibility.ts', 'scripts/orchestration/codegen.sh',
                                                            'scripts/local-convex/codegen.ts', 'scripts/lib/eslint-test-hygiene.mjs',
                                                            'scripts/check-eslint-suppressions.ts', 'scripts/lib/eslint-suppressions.ts'))
        for name in light_lane.STAGE_IMPLEMENTATIONS:
            self.assertIn(name, light_lane.BLOB_PINS)
        script = (self.repo / 'scripts/catalog-pin.ts').read_bytes()
        self.refuses(self.moved_base({'scripts/catalog-pin.ts': script + b"readFileSync(['AGENTS', 'md'].join('.'));\n"}),
                     'reader pin changed: scripts/catalog-pin.ts')

    def test_a_changed_pinned_lint_helper_refuses(self):
        # Retro W3 moved part of the lint stage into these: a full-gated change could make one read lane files.
        for name in ('scripts/lib/eslint-test-hygiene.mjs', 'scripts/check-eslint-suppressions.ts', 'scripts/lib/eslint-suppressions.ts'):
            with self.subTest(name):
                git(self.repo, 'reset', '-q', '--hard', self.base)
                saved = self.base
                helper = (self.repo / name).read_bytes()
                self.refuses(self.moved_base({name: helper + b"readFileSync(['AGENTS', 'md'].join('.'));\n"}),
                             'reader pin changed: ' + name)
                self.base = saved
        git(self.repo, 'reset', '-q', '--hard', self.base)
        manifest = json.loads((self.repo / 'package.json').read_text())
        manifest['scripts']['lint:suppressions'] += ' AGENTS.md'
        self.refuses(self.moved_base({'package.json': json.dumps(manifest)}), 'reader pin changed: package.json scripts')

    def test_the_pins_are_full_identities_at_the_pinned_commit(self):
        self.assertRegex(light_lane.PINNED_AT, '^[0-9a-f]{40}$')
        if not has_pinned_commit():
            host_only(self, 'needs history: the pinned commit %s' % light_lane.PINNED_AT)
        for name, blob in light_lane.BLOB_PINS.items():
            self.assertRegex(blob, '^[0-9a-f]{40}$')
            self.assertEqual(git(HERE, 'cat-file', '-t', blob), 'blob', name)
        for name in light_lane.READER_GUARD + light_lane.READ_LOCK:
            self.assertIn(name, light_lane.BLOB_PINS)
        unchanged = set(light_lane.BLOB_PINS) - set(light_lane.READER_GUARD) - set(light_lane.READ_LOCK) - {'vitest.config.ts'}
        for name in unchanged:
            self.assertEqual(git(HERE, 'rev-parse', light_lane.PINNED_AT + ':' + name), light_lane.BLOB_PINS[name])
        manifest = git(HERE, 'show', light_lane.PINNED_AT + ':package.json')
        self.assertEqual(light_lane.scripts_digest(manifest), light_lane.SCRIPTS_PIN)

    def test_every_pin_matches_head(self):
        # light-lane-pins: gate-import-scan changed knip.jsonc through a full gate without a re-pin, so every
        # light candidate refused. A pinned reader changes only with its reviewed re-pin in the same commit.
        head = git(HERE, 'rev-parse', 'HEAD')
        actual = {name: light_lane.git(HERE, 'rev-parse', '--verify', '--quiet', head + ':' + name, check=False).stdout.decode().strip()
                  for name in light_lane.BLOB_PINS}
        css = (light_lane.blob(HERE, head, light_lane.GLOBALS_CSS) or b'').decode(errors='surrogateescape').splitlines()
        actual[light_lane.GLOBALS_CSS] = light_lane.sha256(''.join(line + '\n' for line in css if light_lane.GLOBALS_LINE.match(line))
                                                           .encode(errors='surrogateescape'))
        actual['package.json scripts'] = light_lane.scripts_digest(light_lane.blob(HERE, head, 'package.json'))
        expected = dict(light_lane.BLOB_PINS, **{light_lane.GLOBALS_CSS: light_lane.GLOBALS_PIN,
                                                 'package.json scripts': light_lane.SCRIPTS_PIN})
        self.assertEqual({name: dict(pin=expected[name], head=value) for name, value in actual.items() if value != expected[name]}, {})

    def test_every_script_a_pinned_script_runs_is_pinned(self):
        # Retro W3's lint ran lint:suppressions, which SCRIPT_KEYS did not name.
        scripts = json.loads(pinned_manifest())['scripts']
        for key in light_lane.SCRIPT_KEYS:
            for called in re.findall(r'\bpnpm -s ([\w:-]+)', scripts[key]):
                self.assertIn(called, light_lane.SCRIPT_KEYS, key)


class GitignoreTest(Fixture):
    """R5: .gitignore may only gain blank lines, comments and literal .claude/ paths."""

    def test_literal_claude_paths_comments_and_blank_lines_pass(self):
        commit = self.change({'.gitignore': 'node_modules/\n\n# Claude Code\n.claude/settings.local.json\n.claude/worktrees/x/\n'})
        self.assertEqual([row['path'] for row in self.verify(commit)['paths']], ['.gitignore'])

    def test_globs_negations_and_other_paths_refuse(self):
        for line in ('*.log', '!x', '.claude/*.json', 'build/', '.claude/a b', '.claude', '/.claude/x', '.claude/x\\y'):
            with self.subTest(line):
                git(self.repo, 'reset', '-q', '--hard', self.base)
                self.refuses(self.change({'.gitignore': 'node_modules/\n' + line + '\n'}), '.gitignore line is not a literal .claude/ path: ' + line)

    def test_a_binary_or_non_utf8_gitignore_refuses(self):
        # Review r1: Git prints only a binary notice for this blob, which once passed R5.
        for content in (b'node_modules/\nsrc/\n# marker\x00\n', b'node_modules/\n*\n#\x00\n', b'node_modules/\n.claude/\xff\n'):
            with self.subTest(content):
                git(self.repo, 'reset', '-q', '--hard', self.base)
                self.refuses(self.change({'.gitignore': content}), '.gitignore is binary or not UTF-8 text')

    def test_an_added_line_starting_with_plus_plus_refuses(self):
        # Review r1: its patch line starts '+++', which the patch reader took for a header.
        self.refuses(self.change({'.gitignore': 'node_modules/\n++*.ts\n'}), '.gitignore line is not a literal .claude/ path: ++*.ts')

    def test_reordered_lines_refuse(self):
        self.base = self.change({'.gitignore': 'node_modules/\n!keep\n'})
        self.refuses(self.change({'.gitignore': '!keep\nnode_modules/\n'}), '.gitignore removes or changes lines')

    def test_a_removed_or_changed_line_refuses(self):
        self.refuses(self.change({'.gitignore': ''}), '.gitignore removes or changes lines')
        git(self.repo, 'reset', '-q', '--hard', self.base)
        self.refuses(self.change({'.gitignore': 'node_modules\n'}), '.gitignore removes or changes lines')


class LightCheckTest(Fixture):
    """Defects the full gate would also accept: failures (exit 2), not refusals."""

    def test_invalid_json_and_a_duplicate_key_fail_with_exit_2(self):
        for text, reason in (('{"a": 1,}', 'invalid JSON'), ('{"a": 1, "a": 2}', 'invalid JSON (duplicate key: a)'), ('{"a": NaN}', 'invalid JSON')):
            with self.subTest(text):
                git(self.repo, 'reset', '-q', '--hard', self.base)
                commit = self.change({'.claude/settings.json': text})
                self.verify(commit)
                with self.assertRaisesRegex(RuntimeError, '^Light check failed: .claude/settings.json: ' + reason.replace('(', r'\(').replace(')', r'\)')):
                    light_lane.light_checks(str(self.repo), self.base, commit)
                result = self.cli('check', self.repo, self.base, commit)
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                self.assertEqual(set(json.loads(result.stdout)), {'verdict', 'reason'})

    def test_valid_json_passes(self):
        light_lane.light_checks(str(self.repo), self.base, self.change({'.claude/settings.json': '{"permissions": {"allow": ["Read"]}}\n'}))

    def test_a_broken_relative_link_on_an_added_line_fails(self):
        commit = self.change({RUNBOOK: '# Runbook\n\nSee [roles](roles/implementer.md).\nAnd [gone](roles/missing.md#top).\n'})
        self.light_fails(commit, RUNBOOK + ':4: link target missing: roles/missing.md#top')

    def test_unchanged_lines_external_anchor_and_variable_links_pass(self):
        self.write({RUNBOOK: '# Runbook\n\nSee [old](roles/old-missing.md).\n'})
        self.base = self.commit()
        commit = self.change({RUNBOOK: '# Runbook\n\nSee [old](roles/old-missing.md).\n'
                              '[web](https://example.test/x) [plain](http://example.test) [mail](mailto:a@example.test)\n'
                              '[here](#runbook) [orch]($EP_ORCH/resource-policy.md) [abs](/etc/hosts) [angle](<roles/x y.md>)\n'
                              '[role](roles/implementer.md#implementer) [dir](roles/) [up](../orchestration/runbook.md "Title")\n'})
        light_lane.light_checks(str(self.repo), self.base, commit)

    def test_an_added_line_starting_with_plus_plus_is_checked_with_its_line_number(self):
        # Review r1: '+++' patch lines were skipped and later added lines were misnumbered.
        base = '# Runbook\n\nSee [roles](roles/implementer.md).\n'
        self.light_fails(self.change({RUNBOOK: base + '++[bad](missing.md)\n'}), RUNBOOK + ':4: link target missing: missing.md')
        git(self.repo, 'reset', '-q', '--hard', self.base)
        self.light_fails(self.change({RUNBOOK: base + '++ plain\n[gone](gone.md)\n'}), RUNBOOK + ':5: link target missing: gone.md')

    def test_a_link_on_a_changed_line_inside_unchanged_text_is_checked(self):
        commit = self.change({RUNBOOK: '# Runbook\n\nSee [roles](roles/missing.md).\n'})
        self.light_fails(commit, RUNBOOK + ':3: link target missing: roles/missing.md')

    def test_binary_or_non_utf8_markdown_fails(self):
        for content in (b'# Runbook\n[gone](gone.md)\x00\n', b'# Runbook \xff\n'):
            with self.subTest(content):
                git(self.repo, 'reset', '-q', '--hard', self.base)
                self.light_fails(self.change({RUNBOOK: content}), RUNBOOK + ': binary or non-UTF-8 Markdown')

    def test_a_link_above_the_repository_root_fails(self):
        self.light_fails(self.change({'AGENTS.md': '[x](../outside.md)\n'}), 'AGENTS.md:1: link target missing: ../outside.md')


class CliTest(Fixture):
    def tree_state(self):
        return sorted((str(path.relative_to(self.repo)), path.stat().st_mtime_ns) for path in self.repo.rglob('*'))

    def test_check_prints_the_gate_field_on_pass_and_writes_nothing(self):
        commit = self.change({RUNBOOK: 'x\n', '.claude/settings.json': '{}\n'})
        before = self.tree_state()
        result = self.cli('check', self.repo, self.base[:12], commit[:12])
        self.assertEqual(self.tree_state(), before)
        self.assertEqual((result.returncode, result.stderr, result.stdout.count('\n')), (0, '', 1), result.stdout + result.stderr)
        value = json.loads(result.stdout)
        self.assertEqual(value, dict(verdict='PASS', **self.verify(commit),
                                     lane=dict(mode='light', rule='light-lane-v1', paths=['.claude/settings.json', RUNBOOK])))

    def test_check_prints_the_reason_on_a_refusal(self):
        result = self.cli('check', self.repo, self.base, self.change({'src/a.ts': 'x\n'}))
        self.assertEqual((result.returncode, json.loads(result.stdout)), (1, dict(verdict='FAIL', reason='Light lane refused: src/a.ts is outside light-lane-v1')))
        result = self.cli('check', self.repo, self.base, 'no-such-revision')
        self.assertEqual((result.returncode, json.loads(result.stdout)['verdict']), (1, 'FAIL'))
        result = self.cli('check', self.repo)
        self.assertEqual((result.returncode, json.loads(result.stdout)['verdict']), (1, 'FAIL'))

    def test_lockable_lists_the_tracked_lane_files_except_gitignore_and_symlinks(self):
        os.symlink('runbook.md', self.repo / 'docs/agents/orchestration/link.md')
        self.write({'docs/agents/untracked.md': 'x\n'})
        git(self.repo, 'add', 'docs/agents/orchestration/link.md')
        git(self.repo, 'commit', '-qm', 'symlink')
        result = self.cli('lockable', self.repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.split('\0'), ['AGENTS.md', ROLE, RUNBOOK, ''])
        self.assertEqual(light_lane.UNLOCKED, ('.gitignore',))

    def test_eligible_echoes_the_allowlisted_paths_from_stdin_and_reads_no_repository(self):
        paths = ['AGENTS.md', 'src/a.ts', RUNBOOK, 'docs/notes.md', '.claude/agents/x.md', 'a\nb.md']
        result = subprocess.run([sys.executable, '-B', str(HERE / 'light_lane.py'), 'eligible'], capture_output=True,
                                input=''.join(path + '\0' for path in paths), text=True, cwd=self.scratch.name,
                                env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})
        self.assertEqual((result.returncode, result.stderr), (0, ''))
        self.assertEqual(result.stdout.split('\0'), ['AGENTS.md', RUNBOOK, '.claude/agents/x.md', ''])

    def test_verify_writes_a_create_only_record(self):
        commit = self.change({RUNBOOK: 'x\n'})
        evidence = Path(self.scratch.name) / 'light-evidence'
        result = self.cli('verify', self.repo, self.base, commit, evidence)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(all(line.startswith('light ') for line in result.stdout.splitlines()), result.stdout)
        self.assertEqual(json.loads((evidence / 'light-verification.json').read_text()), dict(**self.verify(commit), passed=True))
        again = self.cli('verify', self.repo, self.base, commit, evidence)
        self.assertEqual(again.returncode, 1, again.stdout)
        self.assertIn('light refused: evidence exists: ' + str(evidence), again.stdout)
        afile = Path(self.scratch.name) / 'a-file'
        afile.write_text('x')
        self.assertEqual(self.cli('verify', self.repo, self.base, commit, afile).returncode, 1)
        self.assertEqual(afile.read_text(), 'x')

    def test_verify_exits_1_on_a_refusal_and_2_on_a_light_check_failure_without_a_record(self):
        for files, code, prefix in (({'src/a.ts': 'x\n'}, 1, 'light refused: '), ({'.claude/settings.json': '{'}, 2, 'light check failed: ')):
            with self.subTest(code):
                git(self.repo, 'reset', '-q', '--hard', self.base)
                evidence = Path(self.scratch.name) / ('evidence-%d' % code)
                result = self.cli('verify', self.repo, self.base, self.change(files), evidence)
                self.assertEqual(result.returncode, code, result.stdout + result.stderr)
                self.assertTrue(result.stdout.startswith(prefix), result.stdout)
                self.assertFalse(evidence.exists())



class ReaderGuardParityTest(unittest.TestCase):
    """The Vitest reader guard (tests/light-lane-reader-guard.ts) refuses exactly what R2 allows."""

    def test_the_guard_matcher_agrees_with_the_allowlist(self):
        paths = git(HERE.parent.parent, 'ls-files').splitlines() + [
            'AGENTS.md', 'CLAUDE.md', 'docs/standards.md', '.claude/settings.json', '.gitignore', 'docs/agents/a/b.md',
            'docs/product/x.md', '.agents/skills/x/y.md', '.claude/agents/x.md', '.claude/agents/sub/x.md',
            '.claude/settings.local.json', 'docs/agents/x.txt', 'docs/ai/x.md', 'docs/x.md', 'README.md', 'GLOSSARY.md',
            '.agents/skills/x/run.sh', 'docs/agentsx/a.md', 'xdocs/agents/a.md', 'docs/agents/.md', '.claude/agents/.md']
        guard = (HERE.parent.parent / 'tests/light-lane-reader-guard.ts').as_uri()
        script = ('const { isLaneEligible } = await import(%s); const paths = JSON.parse(await new Promise((done) => {'
                  ' let text = ""; process.stdin.on("data", (chunk) => (text += chunk)); process.stdin.on("end", () => done(text)); }));'
                  ' console.log(JSON.stringify(paths.map((path) => isLaneEligible(path))));') % json.dumps(guard)
        result = subprocess.run(['node', '--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--input-type=module',
                                 '-e', script], input=json.dumps(paths), capture_output=True, text=True, check=True)
        verdicts = json.loads(result.stdout)
        self.assertEqual([path for path, verdict in zip(paths, verdicts) if verdict != light_lane.allowed(path)], [])
        self.assertTrue(any(verdicts) and not all(verdicts))


def main():
    if sys.argv[1:2] == ['fixture']:
        install(sys.argv[2])
        return
    unittest.main()


if __name__ == '__main__':
    main()
