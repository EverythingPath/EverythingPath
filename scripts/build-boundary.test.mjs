import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'build-boundary-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'bin'));
  for (const name of ['deploy-convex.sh', 'check-convex-generated.sh']) {
    copyFileSync(resolve('scripts', name), join(root, 'scripts', name));
  }
  const env = { ...process.env, PATH: `${root}/bin:${process.env.PATH}` };
  const run = (command, args = []) =>
    spawnSync(command, args, { cwd: root, env, encoding: 'utf8' });
  const executable = (name, body) =>
    writeFileSync(
      join(root, 'bin', name),
      `#!/usr/bin/env bash\nset -eu\n${body}\n`,
      { mode: 0o755 },
    );
  return { root, run, executable };
}

test('deploy wrapper invokes one deploy and binds the web build URL before checking drift', (t) => {
  const { root, run, executable } = fixture(t);
  executable('convex', `printf '%s\\n' "$@" > arguments\necho deploy >> calls`);
  executable('pnpm', 'echo "$*" >> calls');
  const result = run('bash', [
    'scripts/deploy-convex.sh',
    '--',
    '--preview-create',
    'disposable',
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    readFileSync(join(root, 'arguments'), 'utf8').trim().split('\n'),
    [
      'deploy',
      '--preview-create',
      'disposable',
      '--cmd',
      'pnpm build:web',
      '--cmd-url-env-var-name',
      'NEXT_PUBLIC_CONVEX_URL',
    ],
  );
  assert.equal(
    readFileSync(join(root, 'calls'), 'utf8'),
    'deploy\ncheck:convex-generated\n',
  );
});

test('deploy failure is propagated without running the drift check', (t) => {
  const { run, executable } = fixture(t);
  executable('convex', 'exit 23');
  executable('pnpm', 'exit 99');
  assert.equal(run('bash', ['scripts/deploy-convex.sh']).status, 23);
});

test('generated guard rejects modified, staged, deleted, and new generated files', (t) => {
  const { root, run } = fixture(t);
  mkdirSync(join(root, 'convex/_generated'), { recursive: true });
  const generated = join(root, 'convex/_generated/api.js');
  writeFileSync(generated, 'original\n');
  for (const args of [
    ['init', '-q'],
    ['add', '.'],
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-qm',
      'fixture',
    ],
  ])
    assert.equal(run('git', args).status, 0);
  const check = () => run('bash', ['scripts/check-convex-generated.sh']);
  assert.equal(check().status, 0);
  writeFileSync(generated, 'changed\n');
  assert.equal(check().status, 1);
  run('git', ['add', '.']);
  assert.equal(check().status, 1);
  run('git', ['restore', '--source=HEAD', '--staged', '--worktree', '.']);
  rmSync(generated);
  assert.equal(check().status, 1);
  run('git', ['restore', '.']);
  writeFileSync(join(root, 'convex/_generated/new.js'), 'new\n');
  assert.equal(check().status, 1);
});
