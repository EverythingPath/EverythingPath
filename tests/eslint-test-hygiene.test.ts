// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
// The hygiene rules need no type information, so the project's own config
// runs without its TypeScript program, limited to the rules they live in.
const eslint = new ESLint({
  cwd: root,
  overrideConfig: {
    languageOptions: { parserOptions: { projectService: false } },
  },
  ruleFilter: ({ ruleId }) =>
    ruleId === 'no-restricted-syntax' || ruleId === 'local/test-hygiene',
});

function readHygieneFixture(name: string) {
  return readFileSync(
    path.join(root, 'tests/fixtures/eslint-test-hygiene', name),
    'utf8',
  );
}

function findMarkedLines(source: string) {
  return source
    .split('\n')
    .flatMap((line, index) =>
      line.trimEnd().endsWith('// flagged') ? [index + 1] : [],
    );
}

async function findFlaggedLines(source: string, filePath: string) {
  const [result] = await eslint.lintText(source, {
    filePath: path.join(root, filePath),
  });
  const fatal = result?.messages.find((message) => message.fatal);
  if (fatal) throw new Error(`${filePath}: ${fatal.message}`);
  return [...new Set(result?.messages.map((message) => message.line))].sort(
    (a, b) => a - b,
  );
}

// One file of each kind the hygiene block covers.
const testFiles = [
  'tests/hygiene-probe.test.ts',
  'src/hygiene-probe.test.tsx',
  'scripts/hygiene-probe.test.mjs',
];
const fixtures = [
  'home-directory.txt',
  'home-process-module.txt',
  'home-defaults.txt',
  'home-default-scope.txt',
  'home-reassigned.txt',
  'host-paths.txt',
  'platform-guards.txt',
];

describe('the test-hygiene lint rules', () => {
  it.each(
    fixtures.flatMap((fixture) => testFiles.map((file) => [fixture, file])),
  )(
    'flag exactly the marked lines of %s in %s',
    async (fixture, file) => {
      const source = readHygieneFixture(fixture);
      expect(await findFlaggedLines(source, file)).toEqual(
        findMarkedLines(source),
      );
    },
    30_000,
  );
});
