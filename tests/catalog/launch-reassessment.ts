import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { z } from 'zod';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';

// The in-place launch re-assessment of a spell batch's launch rows (#735
// S-03), recorded first by #536 whole-content wave 1 and reused by wave 2
// (#544 and #533).
const strings = z.array(z.string());

export const launchReviewSchema = z.object({
  run: z.string(),
  reviewedBy: z.string(),
  reviewedOn: z.string(),
  outcome: z.string(),
  pcgen: z.object({
    path: z.string(),
    line: z.number(),
    literalRow: z.string(),
    lineSha256: z.string(),
    fileSha256: z.string(),
    wordDifferences: z.array(
      z.object({ pinned: z.string(), pcgen: z.string() }),
    ),
    textMatches: z.boolean(),
    baseRow: z.object({
      line: z.number(),
      literalRow: z.string(),
      lineSha256: z.string(),
    }),
  }),
  notes: strings,
  metadata: z.object({
    differences: strings,
    levelsDecidedOnOwnEvidence: strings,
    // #516 whole-content wave 3, fix round 1: each granted-level mapping
    // outside learnedAt.class that the PCGen base row does not list, bounded
    // by pinned PCGen rows or left unbounded on a named hold.
    grantedLevelEvidence: z
      .array(
        z.object({
          mapping: z.string(),
          status: z.enum(['bounded', 'unbounded']),
          book: z.string().optional(),
          page: z.string().optional(),
          pcgen: z
            .array(
              z.object({
                path: z.string(),
                line: z.number(),
                literalRow: z.string(),
                lineSha256: z.string(),
                fileSha256: z.string(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
  }),
  books: z.record(z.string(), z.string()),
  outstanding: strings,
  noticeChain: z.record(z.string(), z.string()),
  // The whole-content waves 1-2 correction (2026-11-06).
  corrections: z
    .array(
      z.object({
        run: z.string(),
        reviewedBy: z.string(),
        reviewedOn: z.string(),
      }),
    )
    .optional(),
});

export const launchReassessmentSchema = z.object({
  run: z.string(),
  admittedKeys: strings,
  dependentlyOmittedKeys: strings,
  // Confirmed rows the gate still holds on a missing Registry notice (#516
  // whole-content wave 3: Disfiguring Touch on PZO1139).
  noticeHeldKeys: z.record(z.string(), z.string()).default({}),
  namedHolds: z.record(z.string(), z.string()),
});

// The whole-content waves 1-2 correction (2026-11-06) keeps each corrected
// row's landed, confirmed assessment after its earlier unresolved one.
export const assessmentHistorySchema = z.array(
  z.object({
    status: z.enum(['unresolved', 'confirmed']),
    requiredNotices: strings.optional(),
    contentFingerprint: z.string(),
    holdIds: strings,
    noticeHoldIds: strings,
    rationale: z.string(),
    reviewedOn: z.string(),
  }),
);

type LaunchRow = {
  name: string;
  externalKey: string;
  citedSources: unknown[];
  disposition: string;
  assessmentStatus: string;
  holdIds: string[];
  noticeHoldIds: string[];
  requiredNotices?: string[];
  learnedAt?: Record<string, unknown>;
  assessmentHistory?: z.infer<typeof assessmentHistorySchema>;
};
type LaunchReview = z.infer<typeof launchReviewSchema>;
type LaunchReassessment = z.infer<typeof launchReassessmentSchema>;

const hash = (s: string | Buffer) =>
  createHash('sha256').update(s).digest('hex');

type PinnedFile = { sha256: string; lines: readonly string[] };
const pinnedFiles = new Map<string, Promise<PinnedFile>>();

/**
 * A pinned PCGen file's hash and lines, read once per test file: the pinned
 * store is committed and never written, and many launch rows cite the same
 * file (#536's 41 rows cite four). Each row still checks the recorded hash.
 * A failed read is not kept: the next row reads again. A file missing from
 * the store fails every row that cites it either way; a transient read error
 * fails only the rows that met it.
 */
function readPinnedPcgen(path: string) {
  let file = pinnedFiles.get(path);
  if (!file) {
    file = readFile(join('tests/fixtures/pinned/pcgen', path)).then(
      (bytes) => ({
        sha256: hash(bytes),
        lines: Object.freeze(bytes.toString().split('\n')),
      }),
      (error: unknown) => {
        pinnedFiles.delete(path);
        throw error;
      },
    );
    pinnedFiles.set(path, file);
  }
  return file;
}

/**
 * Each launch row cites the literal pinned PCGen rows and its book pages. The
 * PCGen base row carries the page of every cited book, or of the books named
 * in `pcgenBooks` when Foundry also cites a reprint PCGen's file doesn't list.
 */
export async function expectPinnedPcgenRows(
  row: LaunchRow,
  launchReview: LaunchReview,
  { pcgenBooks }: { pcgenBooks?: string[] } = {},
) {
  const { pcgen } = launchReview;
  const { sha256, lines } = await readPinnedPcgen(pcgen.path);
  expect(sha256, row.name).toBe(pcgen.fileSha256);
  expect(lines[pcgen.line - 1], row.name).toBe(pcgen.literalRow);
  expect(hash(pcgen.literalRow), row.name).toBe(pcgen.lineSha256);
  expect(lines[pcgen.baseRow.line - 1], row.name).toBe(
    pcgen.baseRow.literalRow,
  );
  expect(hash(pcgen.baseRow.literalRow), row.name).toBe(
    pcgen.baseRow.lineSha256,
  );
  expect(pcgen.textMatches, row.name).toBe(pcgen.wordDifferences.length === 0);
  const cited = z
    .array(z.object({ id: z.string(), pages: z.string() }))
    .parse(row.citedSources);
  expect(launchReview.books, row.name).toEqual(
    Object.fromEntries(cited.map((source) => [source.id, source.pages])),
  );
  for (const source of cited.filter(
    (source) => !pcgenBooks || pcgenBooks.includes(source.id),
  ))
    expect(pcgen.baseRow.literalRow, row.name).toContain(
      `SOURCEPAGE:p.${source.pages}`,
    );
}

/** The recorded shape and rationale mark a launch row's outcome implies. */
function expectedOutcome(
  key: string,
  whole: string,
  launch: LaunchReassessment,
) {
  const named = launch.namedHolds[key];
  if (named)
    return {
      record: {
        disposition: 'held',
        assessmentStatus: 'unresolved',
        holdIds: [named],
      },
      cites: named,
    };
  // Confirmed, but held by the gate on its missing notice; its cleared
  // notice holds stay recorded and hold nothing.
  if (launch.noticeHeldKeys[key])
    return {
      record: {
        disposition: 'held',
        assessmentStatus: 'confirmed',
        holdIds: [],
      },
      cites: whole,
    };
  return {
    record: {
      disposition: launch.admittedKeys.includes(key)
        ? 'admitted'
        : 'dependently-omitted',
      assessmentStatus: 'confirmed',
      holdIds: [],
      noticeHoldIds: [],
    },
    cites: whole,
  };
}

/**
 * A named hold keeps the row held; every other launch row is confirmed and
 * its rationale supersedes the batch's whole-content hold.
 */
export function expectLaunchOutcome(
  row: LaunchRow,
  { batch, launch }: { batch: number; launch: LaunchReassessment },
) {
  const id = row.externalKey.split('/')[1];
  const whole = `spells-${batch}-whole-content-${id}`;
  expect(row.assessmentHistory?.[0]?.holdIds, row.name).toEqual([whole]);
  const assessment = reviewedAdmission.assessments.find(
    (r) => r.externalKey === row.externalKey,
  );
  const { record, cites } = expectedOutcome(row.externalKey, whole, launch);
  expect(row, row.name).toMatchObject(record);
  expect(assessment?.status, row.name).toBe(record.assessmentStatus);
  expect(assessment?.rationale, row.name).toContain(cites);
}

/** The granted levels the PCGen base row lists, as `<group>.<Name> <level>`. */
function baseRowGrants(literalRow: string) {
  const token = literalRow
    .split('\t')
    .find((cell) => cell.startsWith('DOMAINS:'));
  return (token?.slice('DOMAINS:'.length).split('|') ?? []).flatMap((group) => {
    const [names = '', level = ''] = group.split('=');
    return names.split(',').map((name) => `domain.${name.trim()} ${level}`);
  });
}

/**
 * #735 S-03 covers learnedAt.class only (#516 wave 3 fix round 1; the waves
 * 1-2 correction): every other granted-level mapping is listed by the PCGen
 * base row or bounded by literal pinned PCGen rows whose book the record
 * requires; an unbounded one keeps the record on a named hold.
 */
export async function expectGrantedLevelsBounded(
  row: LaunchRow,
  launchReview: LaunchReview,
  batch: number,
) {
  const listed = new Set(baseRowGrants(launchReview.pcgen.baseRow.literalRow));
  const evidence = launchReview.metadata.grantedLevelEvidence ?? [];
  const learnedAt = z
    .record(z.string(), z.record(z.string(), z.number()))
    .parse(row.learnedAt ?? {});
  const grants = Object.entries(learnedAt)
    .filter(([group]) => group !== 'class')
    .flatMap(([group, rows]) =>
      Object.entries(rows).map(([name, level]) => `${group}.${name} ${level}`),
    )
    .filter((grant) => !listed.has(grant));
  expect(evidence.map((entry) => entry.mapping).sort(), row.name).toEqual(
    grants.sort(),
  );
  expect(
    launchReview.metadata.levelsDecidedOnOwnEvidence.every((level) =>
      level.startsWith('class.'),
    ),
    row.name,
  ).toBe(true);
  for (const entry of evidence) {
    if (entry.status === 'unbounded') {
      expect(row.assessmentStatus, row.name).toBe('unresolved');
      expect(row.holdIds, row.name).toEqual([
        `spells-${batch}-unbounded-mapping-${row.externalKey.split('/')[1]}`,
      ]);
      continue;
    }
    expect(row.requiredNotices, entry.mapping).toContain(entry.book);
    expect(entry.pcgen?.length, entry.mapping).toBeGreaterThan(0);
    for (const cited of entry.pcgen ?? []) {
      const { sha256, lines } = await readPinnedPcgen(cited.path);
      expect(sha256, entry.mapping).toBe(cited.fileSha256);
      expect(lines[cited.line - 1], entry.mapping).toBe(cited.literalRow);
      expect(hash(cited.literalRow), entry.mapping).toBe(cited.lineSha256);
    }
  }
  expect(Object.keys(launchReview.noticeChain).sort(), row.name).toEqual(
    [...(row.requiredNotices ?? [])].sort(),
  );
}
