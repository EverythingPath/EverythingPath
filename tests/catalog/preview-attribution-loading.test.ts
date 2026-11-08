// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod';
import { runCapturedProcess } from '../../scripts/catalog/process';

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

type DefaultDataMode = 'unavailable' | 'invalid' | 'duplicate';

/**
 * An unavailable, malformed or duplicated default data file at the CLI's file
 * I/O boundary: the child's `fs/promises` `readFile` answers for the committed
 * evidence and assessments. The real CLI, raw fixtures, schemas and admission
 * rules still execute unchanged.
 */
async function defaultDataStub(root: string, mode: DefaultDataMode) {
  const evidence = resolve('src/lib/catalog/data/attribution-evidence.json');
  const assessments = resolve(
    'src/lib/catalog/data/attribution-assessments.json',
  );
  const replies: Record<string, string> =
    mode === 'invalid'
      ? { [evidence]: '{}', [assessments]: '{}' }
      : mode === 'duplicate'
        ? {
            [evidence]:
              '{"evidence":{"twice":{"content":"a"},"twice":{"content":"b"}},"shared":{}}',
          }
        : {};
  const stub = join(root, 'default-data.mjs');
  await writeFile(
    stub,
    `
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    import { fileURLToPath } from 'node:url';
    const read = fs.promises.readFile;
    const replies = ${JSON.stringify(replies)};
    fs.promises.readFile = async function (path, ...rest) {
      const file = path instanceof URL ? fileURLToPath(path) : String(path);
      if (${JSON.stringify(mode)} === 'unavailable' && file === ${JSON.stringify(evidence)})
        throw new Error('Default attribution data is unavailable');
      if (Object.hasOwn(replies, file)) return replies[file];
      return read.call(this, path, ...rest);
    };
    syncBuiltinESMExports();
  `,
  );
  return pathToFileURL(stub).href;
}

async function runWithDefaultData(mode: DefaultDataMode, args: string[]) {
  const root = await mkdtemp(join(tmpdir(), 'default-attribution-data-'));
  temporary.push(root);
  const attribution = join(root, 'attribution.json');
  await writeFile(
    attribution,
    JSON.stringify({ assessments: [], evidence: {}, registry: {} }),
  );
  const result = runCapturedProcess({
    command: process.execPath,
    args: [
      '--import',
      await defaultDataStub(root, mode),
      '--import',
      fileURLToPath(import.meta.resolve('tsx')),
      ...args.map((arg) =>
        arg.replaceAll('$ROOT', root).replace('$ATTRIBUTION', attribution),
      ),
    ],
  });
  return { result, root };
}

const fixtures = [
  '--system',
  resolve('tests/fixtures/catalog/pf1'),
  '--content',
  resolve('tests/fixtures/catalog/pf1-content'),
  '--allow-unverified-checkouts',
];
function preview(mode: DefaultDataMode, explicitAttribution: boolean) {
  return runWithDefaultData(mode, [
    resolve('scripts/catalog-preview.ts'),
    ...fixtures,
    ...(explicitAttribution ? ['--attribution', '$ATTRIBUTION'] : []),
    '--out',
    '$ROOT/output',
  ]);
}
function releaseBuild(mode: DefaultDataMode) {
  return runWithDefaultData(mode, [
    resolve('scripts/catalog-release.ts'),
    'build',
    '--number',
    '1',
    '--schema',
    'character-sheet-v1',
    '--calculation',
    'facts-v1',
    ...fixtures,
    '--artifact',
    '$ROOT/output/release.json',
  ]);
}

it('uses explicit empty attribution when unused default data is unavailable', async () => {
  const { result, root } = await preview('unavailable', true);
  const output = join(root, 'output');
  expect(result.status).toBe(1);
  expect(result.stderr).toBe(
    'Catalog admission failed; inspect admission.json for individually reported failures.\n',
  );
  // S3: the Fighter's reviewed schedule adds its four Bravery increments.
  expect(result.stdout).toContain('Wrote 45 catalog entries and 20 resources');
  expect(await readdir(output)).toEqual([
    'admission.json',
    'catalog.json',
    'comparison.json',
    'curation.json',
    'unsupported.json',
  ]);
  const admission = z
    .object({
      passed: z.boolean(),
      admitted: z.array(z.unknown()),
      held: z.array(z.object({ externalKey: z.string(), reason: z.string() })),
    })
    .parse(JSON.parse(await readFile(join(output, 'admission.json'), 'utf8')));
  expect(admission.passed).toBe(false);
  expect(admission.admitted).toEqual([]);
  expect(admission.held).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/e6IaBxKgMxy1yKlr',
      reason: 'missing Attribution Assessment',
    }),
  );
});

it('refuses unavailable default data when no attribution override is selected', async () => {
  const { result, root } = await preview('unavailable', false);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Default attribution data is unavailable');
  expect(result.stdout).toBe('');
  await expect(readdir(join(root, 'output'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('validates selected default attribution and refuses malformed assessments before writing', async () => {
  const { result, root } = await preview('invalid', false);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('expected array');
  expect(result.stdout).toBe('');
  await expect(readdir(join(root, 'output'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('refuses default evidence that names an ID twice, by name, before writing', async () => {
  const { result, root } = await preview('duplicate', false);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'Duplicate attribution evidence key "twice" at evidence.',
  );
  await expect(readdir(join(root, 'output'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it.each([
  ['unavailable', 'Default attribution data is unavailable'],
  ['invalid', 'expected array'],
  ['duplicate', 'Duplicate attribution evidence key "twice" at evidence.'],
] as const)(
  'release build reads its default attribution from the committed files and refuses %s data before writing',
  async (mode, message) => {
    const { result, root } = await releaseBuild(mode);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(result.stdout).toBe('');
    await expect(readdir(join(root, 'output'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  },
);
