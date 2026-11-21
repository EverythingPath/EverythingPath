import type * as NodeFs from 'node:fs';
import type * as NodeFsPromises from 'node:fs/promises';
import type * as NodeCrypto from 'node:crypto';
import type * as ReviewedRecordsModule from '../../scripts/catalog/reviewed-pcgen-records';
import type * as MatchesModule from '../../scripts/catalog/legal/attribution-227-matches';
import type * as PartyBuildsModule from '../../scripts/catalog/party/party-builds';
import type * as VerificationBuildModule from '../../scripts/catalog/launch-verification-build';
import type * as ReviewedDataFilesModule from '../../scripts/catalog/reviewed-data-files';
import type * as ConditionsModule from '../../scripts/catalog/conditions';
import type * as PinnedCatalogCheckoutsModule from '../../scripts/catalog/party/pinned-catalog-checkouts';
import { join } from 'node:path';
import { vi } from 'vitest';

// The probes, stand-ins and mock factories the
// `reviewed-line-unverified-*.test.ts` files share. It imports what they mock
// as types only, so it loads before the mocks without loading those modules.

type ImportOriginal = <T>() => Promise<T>;

export const absent = { paths: new Set<string>() };
const isAbsent = (path: unknown) =>
  [...absent.paths].some((suffix) => String(path).endsWith(suffix));
export const replaced = { files: new Map<string, string>() };
const replacementOf = (path: unknown, rest: unknown[]) => {
  const text = [...replaced.files].find(([suffix]) =>
    String(path).endsWith(suffix),
  )?.[1];
  if (text === undefined) return undefined;
  const [options] = rest;
  const encoded =
    typeof options === 'string' ||
    (typeof options === 'object' &&
      options !== null &&
      'encoding' in options &&
      options.encoding);
  return encoded ? text : Buffer.from(text);
};
export const reads = { paths: [] as string[] };
const enoent = (path: unknown) =>
  Object.assign(
    new Error(`ENOENT: no such file or directory, open '${String(path)}'`),
    { code: 'ENOENT' },
  );
export const nodeFs = async (importOriginal: ImportOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();
  const readFileSync = ((path: unknown, ...rest: unknown[]) => {
    reads.paths.push(String(path));
    if (isAbsent(path)) throw enoent(path);
    const replacement = replacementOf(path, rest);
    if (replacement !== undefined) return replacement;
    return (actual.readFileSync as (...args: unknown[]) => unknown)(
      path,
      ...rest,
    );
  }) as typeof actual.readFileSync;
  return { ...actual, default: { ...actual, readFileSync }, readFileSync };
};
export const standIn = {
  files: new Map<string, string>(),
  written: new Map<string, string>(),
};
export const nodeFsPromises = async (importOriginal: ImportOriginal) => {
  const actual = await importOriginal<typeof NodeFsPromises>();
  const readFile = ((path: unknown, ...rest: unknown[]) => {
    reads.paths.push(String(path));
    const text = standIn.files.get(String(path));
    if (text !== undefined) return Promise.resolve(text);
    const replacement = replacementOf(path, rest);
    if (replacement !== undefined) return Promise.resolve(replacement);
    return isAbsent(path)
      ? Promise.reject(enoent(path))
      : (actual.readFile as (...args: unknown[]) => Promise<unknown>)(
          path,
          ...rest,
        );
  }) as typeof actual.readFile;
  const writeFile = ((path: unknown, data: unknown, ...rest: unknown[]) => {
    if (!standIn.files.has(String(path)))
      return (actual.writeFile as (...args: unknown[]) => Promise<void>)(
        path,
        data,
        ...rest,
      );
    standIn.written.set(String(path), String(data));
    return Promise.resolve();
  }) as typeof actual.writeFile;
  return {
    ...actual,
    default: { ...actual, readFile, writeFile },
    readFile,
    writeFile,
  };
};

export const standInBuilds = { bytes: undefined as string | undefined };
export const partyBuilds = async (importOriginal: ImportOriginal) => {
  const actual = await importOriginal<typeof PartyBuildsModule>();
  return {
    ...actual,
    readPartyBuilds: (path?: string) => {
      const bytes = standInBuilds.bytes;
      return bytes === undefined
        ? actual.readPartyBuilds(path)
        : Promise.resolve({
            bytes,
            builds: actual.parsePartyBuilds(JSON.parse(bytes)),
          });
    },
  };
};

export const standInReviewed = { text: undefined as string | undefined };
export const reviewedDataFiles = async (importOriginal: ImportOriginal) => {
  const actual = await importOriginal<typeof ReviewedDataFilesModule>();
  const [{ reviewedAdmissionSchema }, { parseReviewedAdmissionInput }] =
    await Promise.all([
      import('../../src/lib/catalog/admission-schema'),
      import('../../src/lib/catalog/attribution-evidence-codec'),
    ]);
  return {
    ...actual,
    readCommittedReviewedAdmission: () => {
      const text = standInReviewed.text;
      return text === undefined
        ? actual.readCommittedReviewedAdmission()
        : Promise.resolve(
            reviewedAdmissionSchema.parse(parseReviewedAdmissionInput(text)),
          );
    },
  };
};

export const conditionsTree = {
  paths: undefined as { systemPath: string; contentPath: string } | undefined,
};
export const conditions = async (importOriginal: ImportOriginal) => {
  const actual = await importOriginal<typeof ConditionsModule>();
  return {
    ...actual,
    buildConditionCatalogArtifact: async () => {
      const paths = conditionsTree.paths;
      if (paths === undefined) return actual.buildConditionCatalogArtifact();
      const { importCatalog } = await import('../../scripts/catalog/import');
      return actual.appendConditionResources(
        await importCatalog({ ...paths, remaps: [], wholeCorpus: false }),
      );
    },
  };
};

// The real build reads the pinned upstream checkouts, which remote CI lacks.
export const verificationBuild = {
  calls: 0,
  document: undefined as (() => unknown) | undefined,
};
export const launchVerificationBuild = async (
  importOriginal: ImportOriginal,
) => {
  const actual = await importOriginal<typeof VerificationBuildModule>();
  return {
    ...actual,
    buildLaunchVerification: (
      ...args: Parameters<typeof actual.buildLaunchVerification>
    ) => {
      verificationBuild.calls += 1;
      const document = verificationBuild.document;
      return document === undefined
        ? actual.buildLaunchVerification(...args)
        : Promise.resolve(document());
    },
  };
};

// Remote CI has no pinned checkouts.
export const checkouts = {
  tree: undefined as { systemPath: string; contentPath: string } | undefined,
};
export const pinnedCatalogCheckouts = async (
  importOriginal: ImportOriginal,
) => {
  const actual = await importOriginal<typeof PinnedCatalogCheckoutsModule>();
  const { verifyInputs } = await import('../../scripts/catalog/operator');
  return {
    ...actual,
    pinnedCatalogCheckouts: async () => {
      const tree = checkouts.tree;
      if (tree === undefined) return actual.pinnedCatalogCheckouts();
      const [system, content] = [tree.systemPath, tree.contentPath];
      return {
        system,
        content,
        verification: await verifyInputs({
          system,
          content,
          allowUnverified: true,
        }),
      };
    },
  };
};

// The record checked in memory, and the committed matches with the row's
// match as the checked record gives it, which
// `reviewed-line-unverified-builds.test.ts` compares with the matcher's.
export const checkedReview = {
  status: 'checked' as const,
  reviewedBy: 'Fixture reviewer',
  reviewedOn: '2026-11-20',
  receipt: `t3-review-${'a'.repeat(64)}`,
};
export const inMemory = { checked: true };
export const reviewedPcgenRecords = async (importOriginal: ImportOriginal) => {
  const actual = await importOriginal<typeof ReviewedRecordsModule>();
  const checked = actual.committedReviewedPcgenRecords.map((record) => ({
    ...record,
    ...checkedReview,
  }));
  return {
    ...actual,
    get committedReviewedPcgenRecords() {
      return inMemory.checked ? checked : actual.committedReviewedPcgenRecords;
    },
  };
};
export const attribution227Matches = async (importOriginal: ImportOriginal) => {
  const actual = await importOriginal<typeof MatchesModule>();
  const records = await import('../../scripts/catalog/reviewed-pcgen-records');
  const { readFileSync } = await vi.importActual<typeof NodeFs>('node:fs');
  const { createHash } =
    await vi.importActual<typeof NodeCrypto>('node:crypto');
  const [record] = records.committedReviewedPcgenRecords;
  if (!record) throw new Error('No reviewed PCGen record.');
  const { pinnedPcgenRoot } =
    await import('../../scripts/catalog/pinned-pcgen-store');
  const lines = readFileSync(
    join(pinnedPcgenRoot, record.pcgen.file),
    'utf8',
  ).split(/\r\n|\r|\n/);
  const index = lines.findIndex((text) =>
    text.split('\t').includes(`KEY:${record.pcgen.key}`),
  );
  const document = actual.committedAttribution227Matches;
  const twin = document.matches.find(
    ({ externalKey }) => externalKey === 'pf1/mvyIXBt01WtR0lM1',
  );
  if (twin?.status !== 'matched') throw new Error('No matched twin.');
  const matches = document.matches.map((match) =>
    match.externalKey === record.externalKey
      ? {
          externalKey: match.externalKey,
          name: match.name,
          kind: match.kind,
          status: 'matched' as const,
          evidence: [
            {
              kind: 'pcgen-fallback' as const,
              rule: 'reviewed-record' as const,
              book: 'PZO1115',
              file: record.pcgen.file,
              line: index + 1,
              key: record.pcgen.key,
              lineSha256: createHash('sha256')
                .update(lines[index] ?? '')
                .digest('hex'),
              record: records.reviewedPcgenRecordIdentity(record),
            },
          ] as const,
          classes: twin.classes,
        }
      : match,
  );
  const checked = {
    ...document,
    matches,
    binding: {
      ...document.binding,
      matchesSha256: actual.matchesSha256(matches),
    },
  };
  return {
    ...actual,
    get committedAttribution227Matches() {
      return inMemory.checked ? checked : document;
    },
  };
};

/**
 * Leaves `reads` and `verificationBuild.calls` alone: the command helpers
 * reset those before each run.
 */
export function resetProbes() {
  inMemory.checked = true;
  checkouts.tree = undefined;
  absent.paths.clear();
  replaced.files.clear();
  standInReviewed.text = undefined;
  conditionsTree.paths = undefined;
  standIn.files.clear();
  standIn.written.clear();
  standInBuilds.bytes = undefined;
  verificationBuild.document = undefined;
}
