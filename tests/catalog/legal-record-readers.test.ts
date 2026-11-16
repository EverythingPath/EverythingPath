// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { heldNotices } from '../../scripts/catalog/legal/held-notices';
import {
  legalRecordNamesIn,
  readLegalRecord,
} from '../../scripts/catalog/legal-records';
import { readLegalInventory } from './legal-inventory';
import { findLegalRecordGuardProblems } from './legal-record-guard';

describe('the typed readers beside the loader', () => {
  it('reads every held notice as stored, in its whole shape', () => {
    expect(heldNotices.length).toBeGreaterThan(5000);
    expect(heldNotices).toEqual(readLegalRecord('held-notices.json'));
  });

  it('reads a batch inventory with every field it records', () => {
    expect(readLegalInventory('feats-347.json')).toEqual(
      readLegalRecord('feats-347.json'),
    );
  });

  it('refuses a legal record without candidates', () => {
    expect(() => readLegalInventory('held-notices.json')).toThrow(
      'expected object, received array',
    );
    expect(() => readLegalInventory('inherited-notices-264.json')).toThrow(
      /"candidates"[\s\S]*expected array, received undefined/,
    );
  });
});

// legal-l3: before the other legal records are encoded (L4), every reader of
// one reads it through the loader. Guard 3 run with every legal record
// assumed encoded names what still does not; this list pins it, so a new bare
// reader fails here now instead of at L4. Each entry names what keeps it.

const bound =
  'hash-bound (campaign-mvp-v1.verification.json binding.inputs): rewired by L4, which regenerates that chain';
const perRecordTypes =
  'imports a batch record as a JSON module and reads fields only its own inferred type has: needs per-record types (decision)';
const scratch =
  'writes, copies or reads as bytes a legal file in a scratch checkout: the loader has no write or copy by name (decision)';
const nonBatch =
  'writes, formats or selects by name a shared legal file that is not a batch record (decision)';
const codecBytes =
  "the codec's test: encodes two plain records' stored bytes and compares sizes (decision: exempt it with the codec, or keep them plain)";

const group = (reason: string, modules: string[]) =>
  modules.map((module) => [module, reason] as const);
const numbered = (prefix: string, from: number, to: number) =>
  Array.from(
    { length: to - from + 1 },
    (_, index) => `tests/catalog/${prefix}-${from + index}.test.ts`,
  );

/** The modules L4 must still wire, each with why it is not wired yet. */
const notYetThroughTheLoader = new Map([
  ...group(bound, [
    'scripts/catalog/admission.ts',
    'scripts/catalog/attribution-227-matcher.ts',
    'scripts/catalog/launch-inventory-build.ts',
    'scripts/catalog/launch-inventory-coverage.ts',
    'scripts/catalog/launch-notice-authority.ts',
    'scripts/catalog/legal/attribution-227-matches.ts',
    'scripts/catalog/legal/attribution-227.ts',
    'scripts/catalog/legal/notice-clearances.ts',
    'scripts/catalog/legal/section15-confirmations.ts',
    'scripts/catalog/map.ts',
    'scripts/catalog/notice-dependencies.ts',
  ]),
  ...group(perRecordTypes, [
    ...numbered('feats', 330, 343),
    ...numbered('inherited-notices', 264, 296),
    'tests/catalog/pinned-sources.test.ts',
    'tests/catalog/race-import-740-conclusions.test.ts',
    'tests/catalog/races-328.test.ts',
    'tests/catalog/racial-hd-329.test.ts',
    ...numbered('spells', 517, 526),
  ]),
  ...group(scratch, [
    'tests/catalog/conditions.test.ts',
    'tests/catalog/cross-batch-bindings.test.ts',
    'tests/catalog/review-receipts.test.ts',
    'tests/catalog/section15-match.test.ts',
  ]),
  ...group(nonBatch, [
    'scripts/catalog/data-files.ts',
    'scripts/catalog/legal/section15-match.ts',
    'tests/catalog/cross-batch-bindings.ts',
  ]),
  ...group(codecBytes, ['tests/catalog/legal-record-codec.test.ts']),
]);

const moduleFile = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/** Every JS or TS module Git tracks or would track, path to source text. */
function trackedModules(root: string) {
  const files = new Map<string, string>();
  const paths = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 },
  )
    .split('\0')
    .filter((path) => moduleFile.test(path));
  for (const path of paths)
    if (lstatSync(join(root, path), { throwIfNoEntry: false })?.isFile())
      files.set(path, readFileSync(join(root, path), 'utf8'));
  return files;
}

it('with every legal record assumed encoded, guard 3 names only the modules L4 must still wire', () => {
  const root = process.cwd();
  const problems = findLegalRecordGuardProblems({
    files: trackedModules(root),
    encoded: legalRecordNamesIn(root),
    unwired: [],
  });
  const modules = [
    ...new Set(
      problems.map((problem) => problem.slice(0, problem.indexOf(':'))),
    ),
  ].sort();
  expect(modules).toEqual([...notYetThroughTheLoader.keys()].sort());
});
