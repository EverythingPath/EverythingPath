// @vitest-environment node
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { reuseFingerprint, sourceFingerprint } from './source-evidence';
import { listSourceFiles } from './source-files';

test('unstaged and staged deletions fingerprint the same working source', () => {
  const root = mkdtempSync(join(tmpdir(), 'source-evidence-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    writeFileSync(join(root, 'app.ts'), 'export const value = 1;');
    writeFileSync(join(root, 'removed.ts'), 'export const unused = 2;');
    execFileSync('git', ['add', '.'], { cwd: root });
    const initial = sourceFingerprint(root);
    rmSync(join(root, 'removed.ts'));
    const deleted = sourceFingerprint(root);
    expect(deleted).not.toBe(initial);
    execFileSync('git', ['add', '-u'], { cwd: root });
    expect(sourceFingerprint(root)).toBe(deleted);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('evidence follows working source, new tests, rules and configuration while ignoring private credentials and reports', () => {
  const root = mkdtempSync(join(tmpdir(), 'source-evidence-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    writeFileSync(join(root, '.gitignore'), '.private/\n');
    mkdirSync(join(root, '.private'));
    mkdirSync(join(root, 'docs/ai/ironfang-militia'), { recursive: true });
    mkdirSync(join(root, 'public'));
    writeFileSync(join(root, 'app.ts'), 'export const value = 1;');
    execFileSync('git', ['add', '.'], { cwd: root });
    const initial = sourceFingerprint(root);
    writeFileSync(join(root, '.private/credentials.json'), '{"private":true}');
    writeFileSync(join(root, 'docs/review.md'), 'Human report');
    expect(sourceFingerprint(root)).toBe(initial);
    mkdirSync(join(root, '.claude'));
    symlinkSync('../.private', join(root, '.claude/skills'));
    writeFileSync(join(root, 'CLAUDE.md'), 'Agent-only guidance');
    expect(sourceFingerprint(root)).toBe(initial);
    for (const [file, content] of [
      ['app.ts', 'export const value = 2;'],
      ['new.test.ts', 'New test'],
      ['docs/ai/ironfang-militia/militia-rules.md', 'Changed rule'],
      ['tsconfig.json', '{}'],
      ['globals.css', 'body { display: none; }'],
      ['public/banner.svg', '<svg />'],
    ]) {
      const before = sourceFingerprint(root);
      writeFileSync(join(root, file!), content!);
      expect(sourceFingerprint(root)).not.toBe(before);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// #754: reuse matches on the reuse fingerprint; the full fingerprint above is
// evidence only.
function gitRoot() {
  const root = mkdtempSync(join(tmpdir(), 'reuse-fingerprint-'));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  mkdirSync(join(root, 'e2e/support'), { recursive: true });
  mkdirSync(join(root, 'node_modules/.pnpm/next@16.0.0'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  writeFileSync(join(root, 'app.ts'), 'export const value = 1;');
  writeFileSync(join(root, 'e2e/journey.spec.ts'), 'test("journey");');
  writeFileSync(join(root, 'e2e/support/helper.ts'), 'export {};');
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
  writeFileSync(join(root, 'node_modules/.modules.yaml'), 'layout: 5');
  writeFileSync(join(root, 'node_modules/.pnpm/lock.yaml'), 'next: 16.0.0');
  return root;
}
const environment = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3210',
  CLERK_SECRET_KEY: 'sk_test_secret',
  TMPDIR: '/run/one',
  E2E_RUN_TOKEN: 'one',
  PATH: '/usr/bin',
};
const toolchain = { node: 'v24.0.0', pnpm: '10.0.0' };

test('a spec edit, deletion or rename keeps the reuse fingerprint and changes the full one', () => {
  const root = gitRoot();
  try {
    const reuse = () => reuseFingerprint({ root, environment, toolchain });
    const initial = reuse();
    const full = sourceFingerprint(root);
    writeFileSync(join(root, 'e2e/journey.spec.ts'), 'test("changed");');
    expect(reuse()).toEqual(initial);
    expect(sourceFingerprint(root)).not.toBe(full);
    rmSync(join(root, 'e2e/journey.spec.ts'));
    writeFileSync(join(root, 'e2e/renamed.spec.ts'), 'test("journey");');
    expect(reuse()).toEqual(initial);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the reuse fingerprint follows sources, build environment, toolchain and installed dependencies', () => {
  const root = gitRoot();
  try {
    const reuse = (
      overrides: {
        environment?: Record<string, string>;
        toolchain?: typeof toolchain;
      } = {},
    ) =>
      reuseFingerprint({
        root,
        environment: overrides.environment ?? environment,
        toolchain: overrides.toolchain ?? toolchain,
      });
    const initial = reuse();
    // Per-run values and secret values never change it.
    expect(
      reuse({
        environment: {
          ...environment,
          TMPDIR: '/run/two',
          E2E_RUN_TOKEN: 'two',
          CLERK_SECRET_KEY: 'sk_test_other',
        },
      }),
    ).toEqual(initial);
    const changes: [string, () => ReturnType<typeof reuse>][] = [
      [
        'buildEnvironment',
        () =>
          reuse({
            environment: { ...environment, NEXT_PUBLIC_CONVEX_URL: 'x' },
          }),
      ],
      [
        'buildEnvironment',
        () =>
          reuse({ environment: { ...environment, E2E_FORCE_FAILURE: '1' } }),
      ],
      ['node', () => reuse({ toolchain: { ...toolchain, node: 'v24.1.0' } })],
      ['pnpm', () => reuse({ toolchain: { ...toolchain, pnpm: '10.1.0' } })],
    ];
    for (const [part, changed] of changes) {
      const next = changed();
      expect(next.parts[part as keyof typeof next.parts], part).not.toBe(
        initial.parts[part as keyof typeof initial.parts],
      );
      expect(next.reuseFingerprint).not.toBe(initial.reuseFingerprint);
    }
    for (const [file, content, part] of [
      ['e2e/support/helper.ts', 'export const x = 1;', 'sources'],
      ['pnpm-lock.yaml', 'lockfileVersion: 10', 'sources'],
      ['node_modules/.pnpm/lock.yaml', 'next: 16.0.1', 'dependencies'],
      ['node_modules/.modules.yaml', 'layout: 6', 'dependencies'],
    ] as const) {
      const before = reuse();
      writeFileSync(join(root, file), content);
      const after = reuse();
      expect(after.parts[part], file).not.toBe(before.parts[part]);
      expect(after.reuseFingerprint).not.toBe(before.reuseFingerprint);
    }
    const before = reuse();
    mkdirSync(join(root, 'node_modules/.pnpm/next@16.0.1'));
    expect(reuse().parts.dependencies).not.toBe(before.parts.dependencies);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// The invariant that makes excluding specs safe: nothing built or deployed
// imports a spec, so a spec cannot change the prepared backend or build.
test('no fingerprinted file imports an e2e spec', () => {
  const root = process.cwd();
  const sources = listSourceFiles(root).filter(
    (file) =>
      /\.(?:[cm]?[jt]sx?)$/.test(file) &&
      !/^e2e\/[^/]+\.spec\.ts$/.test(file) &&
      existsSync(join(root, file)),
  );
  const importers: string[] = [];
  for (const file of sources) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const [, specifier] of text.matchAll(
      /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"]+)['"]/g,
    )) {
      if (!specifier!.startsWith('.')) continue;
      const target = relative(root, resolve(root, dirname(file), specifier!));
      if (/^e2e\/[^/]+\.spec(?:\.ts)?$/.test(target))
        importers.push(`${file} -> ${specifier}`);
    }
  }
  expect(importers).toEqual([]);
});
