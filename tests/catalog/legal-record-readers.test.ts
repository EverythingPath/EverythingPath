// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { heldNotices } from '../../scripts/catalog/legal/held-notices';
import {
  legalRecordNamesIn,
  readLegalRecord,
} from '../../scripts/catalog/legal-records';
import { readLegalInventory } from './legal-inventory';
import { findLegalRecordGuardProblems } from './legal-record-guard';
import { trackedModules } from './tracked-modules';

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

// The readers of plain records. Guard 3 run with every legal record assumed
// encoded names each module that still reads one other than through the
// loader; encoded records it names nowhere (the guard test). This list pins
// what it names, each with what keeps it, so a new bare reader fails here
// before its record could be encoded. Since legal-l4 every batch record is
// encoded but those listed in the legal-record docs (curation.md, "Reading a
// legal record"), so each module below reads a plain one.

const nonBatchReader =
  'hash-bound (campaign-mvp-v1.verification.json binding.inputs); imports or names only shared legal files that are not batch records and stay plain (held notices, the #227 files, notice clearances and known holds, Section 15 files, waivers)';
const perRecordTypes =
  'imports a batch record as a JSON module and reads fields only its own inferred type has, so that record stays plain (legal-l4 scope decision)';
const scratch =
  'writes, copies or reads as bytes a plain legal file in a scratch checkout: the loader has no write or copy by name';
const nonBatch =
  'writes, formats or selects by name a shared legal file that is not a batch record, or a plain record';

const group = (reason: string, modules: string[]) =>
  modules.map((module) => [module, reason] as const);
const numbered = (prefix: string, from: number, to: number) =>
  Array.from(
    { length: to - from + 1 },
    (_, index) => `tests/catalog/${prefix}-${from + index}.test.ts`,
  );

/** The modules that read a plain legal record, each with what keeps it. */
const plainRecordReaders = new Map([
  ...group(nonBatchReader, [
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
    'tests/catalog/review-receipts-harness.ts',
    'tests/catalog/review-receipts.test.ts',
    'tests/catalog/section15-match.test.ts',
  ]),
  ...group(nonBatch, [
    'scripts/catalog/data-files.ts',
    'scripts/catalog/legal/section15-match.ts',
    'tests/catalog/cross-batch-bindings.ts',
  ]),
]);

it('with every legal record assumed encoded, guard 3 names only the readers of plain records', () => {
  const root = process.cwd();
  const problems = findLegalRecordGuardProblems({
    files: trackedModules(root).files,
    encoded: legalRecordNamesIn(root),
    unwired: [],
  });
  const modules = [
    ...new Set(
      problems.map((problem) => problem.slice(0, problem.indexOf(':'))),
    ),
  ].sort();
  expect(modules).toEqual([...plainRecordReaders.keys()].sort());
});
