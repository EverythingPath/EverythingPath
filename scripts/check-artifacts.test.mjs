import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  chmodSync,
  readFileSync,
  symlinkSync,
  existsSync,
  realpathSync,
} from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cli = fileURLToPath(new URL('./check-artifacts.mjs', import.meta.url));
const tempRoot = process.env.TMPDIR;
assert.ok(
  tempRoot && isAbsolute(tempRoot),
  'Set TMPDIR to an absolute external task temp directory',
);
const realTempRoot = realpathSync(tempRoot);
const checkout = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
assert.ok(
  realTempRoot !== '/tmp' &&
    !realTempRoot.startsWith('/tmp/') &&
    realTempRoot !== checkout &&
    !realTempRoot.startsWith(`${checkout}/`),
  'TMPDIR must be outside the checkout and /tmp',
);

function fixture(t) {
  const root = mkdtempSync(join(tempRoot, 'artifact-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const write = (path, value) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), value);
  };
  const config = {
    version: 1,
    unbudgeted: {
      maxNewFileBytes: 1000,
      maxPositiveGrowthBytes: 2000,
      maxAddedLines: 100,
    },
    families: [
      {
        id: 'inventory',
        paths: ['data/inventory*', 'reports/inventory*'],
        maxBytes: 10,
        maxLines: 3,
        reason: 'Independent test data',
        issue: 768,
      },
    ],
  };
  const budget = () =>
    write('scripts/artifact-budgets.json', JSON.stringify(config));
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Artifact test');
  git('config', 'user.email', 'artifact@example.test');
  budget();
  const commit = () => {
    git('add', '-A');
    git('commit', '-qm', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  const base = commit();
  const run = (args = ['--base', base], env = {}) =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
  return { root, git, write, config, budget, commit, base, run };
}

test('counts the complete family at the inclusive boundary, including untracked extensions', (t) => {
  const f = fixture(t);
  f.write('data/inventory.json', 'abc\n');
  f.commit();
  f.write('reports/inventory notes.dump', 'def\ngh');
  const pass = f.run();
  assert.equal(pass.status, 0, pass.stderr + pass.stdout);
  assert.match(pass.stdout, /inventory: 0 -> 10 bytes; 0 -> 3 lines/);
  f.write('data/inventory.split', 'x');
  const fail = f.run();
  assert.equal(fail.status, 1, fail.stderr + fail.stdout);
  assert.match(fail.stdout, /inventory.*11.*10/);
});

test('unbudgeted limits are inclusive and deletions cannot offset positive growth', (t) => {
  const f = fixture(t);
  f.config.unbudgeted = {
    maxNewFileBytes: 5,
    maxPositiveGrowthBytes: 7,
    maxAddedLines: 4,
  };
  f.budget();
  f.write('legacy', '01234567890123456789');
  f.write('delete-me', 'a'.repeat(50));
  const base = f.commit();
  assert.equal(f.run(['--base', base]).status, 0);
  f.write('legacy', '01234567890123456789xx');
  f.write('new file', 'a\nb\nc');
  rmSync(join(f.root, 'delete-me'));
  const pass = f.run(['--base', base]);
  assert.equal(pass.status, 0, pass.stdout + pass.stderr);
  assert.match(pass.stdout, /Unbudgeted: \+7 bytes.*4 added lines/);
  f.write('legacy', '01234567890123456789xxx');
  const fail = f.run(['--base', base]);
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /positive growth: 8 > 7/);
});

test('counts replacements as added lines, and mode-only edits as zero added lines', (t) => {
  const f = fixture(t);
  f.config.unbudgeted.maxAddedLines = 1;
  f.budget();
  f.write('existing', 'a\nb\n');
  const base = f.commit();
  f.git('update-index', '--chmod=+x', 'existing');
  // A real chmod keeps the index and worktree in agreement.
  chmodSync(join(f.root, 'existing'), 0o755);
  const pass = f.run(['--base', base]);
  assert.equal(pass.status, 0, pass.stdout + pass.stderr);
  assert.match(pass.stdout, /0 added lines/);
  f.write('existing', 'c\nd\n');
  const fail = f.run(['--base', base]);
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /added lines: 2 > 1/);
});

test('rejects each new-file and line allowance independently', (t) => {
  const f = fixture(t);
  f.config.unbudgeted = {
    maxNewFileBytes: 5,
    maxPositiveGrowthBytes: 100,
    maxAddedLines: 2,
  };
  f.budget();
  const base = f.commit();
  f.write('six-bytes', 'abcdef');
  assert.match(
    f.run(['--base', base]).stdout,
    /New unbudgeted file "six-bytes": 6 > 5/,
  );
  rmSync(join(f.root, 'six-bytes'));
  f.write('lines', 'a\nb\nc');
  const fail = f.run(['--base', base]);
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /added lines: 3 > 2/);
});

test('reports budget additions and revisions for explicit review without ratcheting', (t) => {
  const f = fixture(t);
  f.config.families[0].maxBytes = 11;
  f.budget();
  f.write('data/inventory.extra', '12345678901');
  const pass = f.run();
  assert.equal(pass.status, 0, pass.stderr + pass.stdout);
  assert.match(
    pass.stdout,
    /Budget changes \(explicit Standards disposition required\)/,
  );
  assert.match(pass.stdout, /"maxBytes":10/);
  assert.match(pass.stdout, /"maxBytes":11/);
  f.write('data/inventory.extra', '123456789012');
  assert.equal(f.run().status, 1);
  assert.equal(
    JSON.parse(readFileSync(join(f.root, 'scripts/artifact-budgets.json')))
      .families[0].maxBytes,
    11,
  );
  f.git('rm', '-f', 'scripts/artifact-budgets.json');
  f.commit();
  f.budget();
  assert.match(f.run([]).stdout, /NEW budget configuration/);
});

test('renames within a family count fully and moves outside it become unbudgeted', (t) => {
  const f = fixture(t);
  f.config.unbudgeted.maxNewFileBytes = 5;
  f.budget();
  f.write('data/inventory.json', '123456');
  const base = f.commit();
  f.git('mv', 'data/inventory.json', 'data/inventory.other');
  assert.equal(f.run(['--base', base]).status, 0);
  f.git('mv', 'data/inventory.other', 'outside');
  const fail = f.run(['--base', base]);
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /New unbudgeted file "outside": 6 > 5/);
});

test('counts binary bytes, missing final newline, and symlink targets without following them', (t) => {
  const f = fixture(t);
  f.write('data/inventory.bin', Buffer.from([0, 10, 255]));
  const secret = join(tempRoot, `artifact-outside-${process.pid}`);
  writeFileSync(secret, 'outside contents must never count');
  t.after(() => rmSync(secret, { force: true }));
  // Symlink target bytes are counted, with no read of the target.
  symlinkSync(secret, join(f.root, 'link'));
  f.config.unbudgeted.maxNewFileBytes = Buffer.byteLength(secret);
  f.budget();
  const pass = f.run();
  assert.equal(pass.status, 0, pass.stdout + pass.stderr);
  assert.match(pass.stdout, /inventory: 0 -> 3 bytes; 0 -> 0 lines/);
  assert.match(pass.stdout, /binary files 1/);
  assert.match(pass.stdout, /symlink target only/);
  f.write('.gitignore', 'ignored/\n');
  mkdirSync(join(f.root, 'ignored'));
  symlinkSync('/unreadable/private/input', join(f.root, 'ignored', 'private'));
  assert.equal(f.run().status, 0);
});

test('does not traverse a symlink directory or gitlink', (t) => {
  const f = fixture(t);
  f.write('data/inventory/x', 'abc');
  const base = f.commit();
  rmSync(join(f.root, 'data'), { recursive: true });
  symlinkSync(tempRoot, join(f.root, 'data'));
  const unsafe = f.run(['--base', base]);
  assert.equal(unsafe.status, 1);
  assert.match(unsafe.stderr, /Unsafe artifact parent/);
  rmSync(join(f.root, 'data'));
  f.git('update-index', '--add', '--cacheinfo', `160000,${base},submodule`);
  mkdirSync(join(f.root, 'submodule'));
  const gitlink = f.run(['--base', base]);
  assert.equal(gitlink.status, 1);
  assert.match(gitlink.stderr, /gitlink|special file/);
});

test('handles NUL-delimited paths with whitespace, quotes, tabs, newlines and shell syntax', (t) => {
  const f = fixture(t);
  const name = 'data/inventory $(`touch SHOULD_NOT_EXIST`)\n\t".dump';
  f.write(name, '12345678901');
  const fail = f.run();
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /11 > 10 bytes/);
  assert.equal(existsSync(join(f.root, 'SHOULD_NOT_EXIST')), false);
  f.git('add', '-A');
  assert.equal(f.run().status, 1);
});

test('supports detached registered worktrees and local HEAD comparisons', (t) => {
  const f = fixture(t);
  const worktree = join(f.root, '..', `${f.root.split('/').at(-1)}-worktree`);
  t.after(() => rmSync(worktree, { recursive: true, force: true }));
  f.git('worktree', 'add', '--detach', worktree, f.base);
  writeFileSync(join(worktree, 'new'), 'x');
  const result = spawnSync(process.execPath, [cli], {
    cwd: worktree,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /HEAD \(local changes\).*worktree edits present/);
  assert.match(result.stdout, /Unbudgeted: \+1 bytes.*1 added lines/);
});

for (const [name, mutate] of [
  [
    'unknown schema',
    (c) => {
      c.skip = true;
    },
  ],
  [
    'unknown version',
    (c) => {
      c.version = 2;
    },
  ],
  [
    'negative',
    (c) => {
      c.unbudgeted.maxAddedLines = -1;
    },
  ],
  [
    'fractional',
    (c) => {
      c.families[0].maxBytes = 1.5;
    },
  ],
  [
    'nonfinite',
    (c) => {
      c.families[0].maxBytes = Infinity;
    },
  ],
  [
    'duplicate ids',
    (c) => {
      c.families.push({ ...c.families[0] });
    },
  ],
  [
    'invalid path',
    (c) => {
      c.families[0].paths = ['../outside*'];
    },
  ],
  [
    'unsupported glob',
    (c) => {
      c.families[0].paths = ['data/**/x'];
    },
  ],
  [
    'overlap without files',
    (c) => {
      c.families.push({
        ...c.families[0],
        id: 'other',
        paths: ['data/inventory/sub*'],
      });
    },
  ],
]) {
  test(`rejects invalid config: ${name}`, (t) => {
    const f = fixture(t);
    mutate(f.config);
    f.budget();
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid|Unsupported|overlapping/);
  });
}

test('fails absent or invalid bases and malformed CLI instead of assuming an empty diff', (t) => {
  const f = fixture(t);
  for (const args of [
    ['--base', 'not-a-commit'],
    ['--base', '--all'],
    ['--base'],
    ['--skip'],
    ['--base', f.git('rev-parse', 'HEAD:scripts/artifact-budgets.json')],
  ]) {
    const result = f.run(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Comparison commit unavailable|Usage:/);
  }
});

function ci(f, eventName, event) {
  // Keep the event outside the checked tree, as Actions does.
  const path = join(tempRoot, `artifact-event-${process.pid}.json`);
  writeFileSync(path, JSON.stringify(event));
  try {
    return f.run(['--ci'], {
      GITHUB_EVENT_NAME: eventName,
      GITHUB_EVENT_PATH: path,
    });
  } finally {
    rmSync(path);
  }
}

test('CI uses push before and exact checked commit, excluding worktree-only files', (t) => {
  const f = fixture(t);
  f.write('data/inventory', '12345678901');
  const head = f.commit();
  const result = ci(f, 'push', {
    before: f.base,
    after: head,
    ref: 'refs/heads/main',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /push before; committed tree/);
  assert.match(result.stdout, /inventory: 11 > 10 bytes/);
  rmSync(join(f.root, 'data/inventory'));
  assert.equal(
    ci(f, 'push', { before: f.base, after: head, ref: 'refs/heads/main' })
      .status,
    1,
  );
});

test('CI validates pull request head and synthetic merge, measuring the checked merge tree', (t) => {
  const f = fixture(t);
  f.git('checkout', '-qb', 'feature');
  f.write('data/inventory.feature', '123456');
  const feature = f.commit();
  f.git('checkout', 'main');
  f.write('reports/inventory.base', '123456');
  const base = f.commit();
  const event = {
    pull_request: { base: { sha: base }, head: { sha: feature } },
  };
  f.git('checkout', '--detach', feature);
  const direct = ci(f, 'pull_request', event);
  assert.equal(direct.status, 0, direct.stderr + direct.stdout);
  assert.match(direct.stdout, new RegExp(`base ${base}; head ${feature}`));
  f.git('checkout', 'main');
  f.git('merge', '--no-ff', '-qm', 'synthetic merge', feature);
  const merged = ci(f, 'pull_request', event);
  assert.equal(merged.status, 1);
  assert.match(merged.stdout, /inventory: 6 -> 12 bytes/);
});

test('CI new branches use default-branch history; new default/root counts the whole tree', (t) => {
  const f = fixture(t);
  f.git('update-ref', 'refs/remotes/origin/main', f.base);
  f.git('checkout', '-qb', 'feature');
  f.write('data/inventory', '12345678901');
  const head = f.commit();
  const event = {
    before: '0'.repeat(40),
    after: head,
    ref: 'refs/heads/feature',
    repository: { default_branch: 'main' },
  };
  const branch = ci(f, 'push', event);
  assert.equal(branch.status, 1);
  assert.match(branch.stdout, /new branch: merge base with origin\/main/);
  assert.match(branch.stdout, new RegExp(`base ${f.base}`));
  const initialDefault = ci(f, 'push', { ...event, ref: 'refs/heads/main' });
  assert.equal(initialDefault.status, 1);
  assert.match(initialDefault.stdout, /base empty tree/);
  f.git('checkout', '--detach', f.base);
  const root = ci(f, 'push', {
    ...event,
    after: f.base,
    ref: 'refs/heads/main',
  });
  assert.equal(root.status, 0, root.stdout + root.stderr);
  assert.match(root.stdout, /new default branch: empty tree/);
});

test('CI fails missing required history and malformed or mismatched events', (t) => {
  const f = fixture(t);
  for (const [name, event] of [
    ['push', { before: 'a'.repeat(40), after: f.base, ref: 'refs/heads/main' }],
    [
      'push',
      {
        before: '0'.repeat(40),
        after: f.base,
        ref: 'refs/heads/feature',
        repository: { default_branch: 'missing' },
      },
    ],
    ['push', { before: 'bad', after: f.base, ref: 'refs/heads/main' }],
    ['push', { before: f.base, after: f.base }],
    ['pull_request', {}],
    ['schedule', {}],
  ]) {
    const result = ci(f, name, event);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /Artifact check error:/);
  }
  f.write('other', 'x');
  const after = f.commit();
  const mismatch = ci(f, 'pull_request', {
    pull_request: { base: { sha: f.base }, head: { sha: f.base } },
  });
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /does not match/);
  assert.equal(
    ci(f, 'push', { before: f.base, after: f.base, ref: 'refs/heads/main' })
      .status,
    1,
  );
  assert.equal(f.run(['--ci'], { GITHUB_EVENT_PATH: '' }).status, 1);
  const badEvent = join(tempRoot, `artifact-bad-event-${process.pid}`);
  writeFileSync(badEvent, '{');
  t.after(() => rmSync(badEvent));
  assert.equal(
    f.run(['--ci'], { GITHUB_EVENT_PATH: badEvent, GITHUB_EVENT_NAME: 'push' })
      .status,
    1,
  );
  assert.notEqual(after, f.base);
});

test('family limits apply to unchanged members and count text line boundaries', (t) => {
  const f = fixture(t);
  f.write('data/inventory.text', 'a\nb\nc');
  const base = f.commit();
  const boundary = f.run([]);
  assert.equal(boundary.status, 0, boundary.stdout + boundary.stderr);
  assert.match(boundary.stdout, /inventory: 5 -> 5 bytes; 3 -> 3 lines/);
  f.write('reports/inventory.addition', 'd');
  const overflow = f.run(['--base', base]);
  assert.equal(overflow.status, 1);
  assert.match(overflow.stdout, /inventory: 4 > 3 lines/);
  f.commit();
  const unchanged = f.run([]);
  assert.equal(unchanged.status, 1);
  assert.match(unchanged.stdout, /inventory: 4 > 3 lines/);
});

test('fails closed on non-UTF-8 Git filenames instead of losing a matching artifact', (t) => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'data'));
  const name = Buffer.concat([
    Buffer.from(join(f.root, 'data/inventory')),
    Buffer.from([255]),
  ]);
  writeFileSync(name, '12345678901');
  const fail = f.run();
  assert.equal(fail.status, 1);
  assert.match(fail.stderr, /encoded data|UTF-8/);
});

test('binary files with a late NUL consume bytes but no text line allowance', (t) => {
  const f = fixture(t);
  f.config.unbudgeted = {
    maxNewFileBytes: 10000,
    maxPositiveGrowthBytes: 10000,
    maxAddedLines: 0,
  };
  f.budget();
  const base = f.commit();
  f.write(
    'late-binary',
    Buffer.concat([Buffer.from('a\n'.repeat(4096)), Buffer.from([0])]),
  );
  f.git('add', 'late-binary');
  const result = f.run(['--base', base]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Unbudgeted: \+8193 bytes.*0 added lines/);
  assert.match(result.stdout, /binary \(n\/a\)/);
});

for (const kind of [
  'binary-to-text',
  'staged -diff text',
  'committed -diff text',
]) {
  test(`enforces text additions for ${kind} below the byte allowance`, (t) => {
    const f = fixture(t);
    f.config.unbudgeted.maxAddedLines = 2;
    f.budget();
    if (kind === 'binary-to-text') f.write('existing', Buffer.from([0]));
    else f.write('.gitattributes', 'existing -diff\n');
    const base = f.commit();
    f.write('existing', 'a\nb\nc\n');
    if (kind === 'staged -diff text') f.git('add', 'existing');
    const head = kind === 'committed -diff text' ? f.commit() : null;
    const result = head
      ? ci(f, 'push', { before: base, after: head, ref: 'refs/heads/main' })
      : f.run(['--base', base]);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Unbudgeted: \+[56] bytes.*3 added lines/);
    assert.match(result.stdout, /added lines: 3 > 2/);
    assert.doesNotMatch(result.stdout, /FAIL .*bytes/);
  });
}

test('counts recreated untracked text even when its tracked deletion adds zero lines', (t) => {
  const f = fixture(t);
  f.config.unbudgeted.maxAddedLines = 2;
  f.budget();
  f.write('existing', 'abcdef');
  const base = f.commit();
  f.git('rm', '--cached', 'existing');
  f.write('existing', 'a\nb\nc\n');
  const result = f.run(['--base', base]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /Unbudgeted: \+0 bytes.*3 added lines/);
  assert.match(result.stdout, /added lines: 3 > 2/);
  assert.doesNotMatch(result.stdout, /FAIL .*bytes/);
});

test('does not charge unchanged -diff content and counts changed content conservatively', (t) => {
  const f = fixture(t);
  f.config.unbudgeted.maxAddedLines = 1;
  f.budget();
  f.write('.gitattributes', 'existing -diff\n');
  f.write('existing', 'a\nb\nc\n');
  const base = f.commit();
  const unchanged = f.run(['--base', base]);
  assert.equal(unchanged.status, 0, unchanged.stdout + unchanged.stderr);
  assert.match(unchanged.stdout, /0 added lines/);
  chmodSync(join(f.root, 'existing'), 0o755);
  f.git('add', 'existing');
  const modeOnly = f.run(['--base', base]);
  assert.equal(modeOnly.status, 0, modeOnly.stdout + modeOnly.stderr);
  assert.match(modeOnly.stdout, /0 added lines/);
  f.write('existing', 'a\nb\nd\n');
  const modified = f.run(['--base', base]);
  assert.equal(modified.status, 1, modified.stdout + modified.stderr);
  assert.match(modified.stdout, /Unbudgeted: \+0 bytes.*3 added lines/);
  assert.match(modified.stdout, /added lines: 3 > 1/);
});

test('ordinary text edits charge only additions, not unchanged lines', (t) => {
  const f = fixture(t);
  f.config.unbudgeted.maxAddedLines = 1;
  f.budget();
  f.write('existing', 'a\nb\nc\n');
  const base = f.commit();
  f.write('existing', 'a\nb\nd\n');
  const result = f.run(['--base', base]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Unbudgeted: \+0 bytes.*1 added lines/);
});
