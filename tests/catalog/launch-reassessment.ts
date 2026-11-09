import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { z } from 'zod';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { pinnedPath } from './pinned-sources';
import type { WaveBindingContext } from './wave-binding-context';
import { waveCl1BindingContext } from './wave-cl1-binding-context';
import { waveCl2BindingContext } from './wave-cl2-binding-context';

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
          // #628 wave F2: a PRD line bounds a mapping whose PCGen row is in
          // error (Beast Shape III's Animal domain level).
          prd: z
            .array(
              z.object({
                path: z.string(),
                pageSha256: z.string(),
                line: z.number(),
                text: z.string(),
                sha256: z.string(),
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
  // Wave CL1 (#527 and #542): further literal PCGen rows that bound part of
  // the body (Detect Magic's Aura Strength table), and the cited books the
  // PCGen base row carries when Foundry also cites a reprint.
  additionalPcgen: z
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
  pcgenBooks: strings.optional(),
  // Inherited-rule citations of a record shape with no field for them.
  inheritedRuleCitations: z
    .array(
      z.object({
        name: z.string(),
        repo: z.enum(['pf1', 'pcgen']),
        sha256: z.string(),
        path: z.string(),
        line: z.number(),
        literalQuote: z.string(),
        book: z.string(),
      }),
    )
    .optional(),
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
  // A confirmed row a later wave's admission frees moves to admitted (root
  // option B): wave CL1 in #544, wave CL2 in #516.
  laterMoves: z
    .array(z.object({ run: z.string(), externalKey: z.string() }))
    .optional(),
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
  // Some records cite a numeric page (Invisibility, #537).
  const cited = z
    .array(
      z.object({
        id: z.string(),
        pages: z.union([z.string(), z.number()]).transform(String),
      }),
    )
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

type GrantedLevelEvidence = NonNullable<
  LaunchReview['metadata']['grantedLevelEvidence']
>[number];

/** A bounded mapping's literal pinned PCGen rows and PRD lines (#628 wave F2 adds the PRD). */
async function expectMappingBound(entry: GrantedLevelEvidence) {
  expect(
    (entry.pcgen?.length ?? 0) + (entry.prd?.length ?? 0),
    entry.mapping,
  ).toBeGreaterThan(0);
  for (const cited of entry.pcgen ?? []) {
    const { sha256, lines } = await readPinnedPcgen(cited.path);
    expect(sha256, entry.mapping).toBe(cited.fileSha256);
    expect(lines[cited.line - 1], entry.mapping).toBe(cited.literalRow);
    expect(hash(cited.literalRow), entry.mapping).toBe(cited.lineSha256);
  }
  for (const line of entry.prd ?? []) {
    const page = await readFile(join('tests/fixtures/pinned/prd', line.path));
    expect(hash(page), entry.mapping).toBe(line.pageSha256);
    expect(page.toString().split('\n')[line.line - 1], entry.mapping).toBe(
      line.text,
    );
    expect(hash(line.text), entry.mapping).toBe(line.sha256);
  }
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
    await expectMappingBound(entry);
  }
  expect(Object.keys(launchReview.noticeChain).sort(), row.name).toEqual(
    [...(row.requiredNotices ?? [])].sort(),
  );
}

/** #631 wave F1's in-place launch re-assessments (feats, Spells, weapons). */
export const WAVE_F1_REVIEW = {
  reviewedBy: 'Opus (AI curator) for the owner',
  reviewedOn: '2026-11-07',
} as const;

/** A row re-assessed by #631 wave F1 (its launchReview names the run). */
export function isWaveF1Row(row: object) {
  const review = (row as { launchReview?: { run?: unknown } }).launchReview;
  return typeof review?.run === 'string' && review.run.startsWith('Wave F1');
}

/**
 * A row re-assessed by #628 wave F2 (the linked entries of Bonus Feat (MNK)
 * and Wild Shape), reviewed by the same reviewer on the same day as wave F1.
 */
export function isWaveF2Row(row: object) {
  const review = (row as { launchReview?: { run?: unknown } }).launchReview;
  return typeof review?.run === 'string' && review.run.startsWith('Wave F2');
}

/** A row re-assessed in place by wave F1 or F2. */
export function isWaveFRow(row: object) {
  return isWaveF1Row(row) || isWaveF2Row(row);
}

const pinnedRow = z.object({
  path: z.string(),
  line: z.number(),
  literalRow: z.string(),
  lineSha256: z.string(),
  fileSha256: z.string(),
});
const featLaunchRowSchema = z.object({
  externalKey: z.string(),
  name: z.string(),
  disposition: z.literal('supported/admitted'),
  assessmentStatus: z.literal('confirmed'),
  holdIds: z.tuple([]),
  noticeHoldIds: z.tuple([]),
  requiredNotices: strings,
  assessmentHistory: assessmentHistorySchema,
  launchReview: z.object({
    run: z.string(),
    reviewedBy: z.literal(WAVE_F1_REVIEW.reviewedBy),
    reviewedOn: z.literal(WAVE_F1_REVIEW.reviewedOn),
    outcome: z.literal('confirmed; admitted'),
    policy: z.string(),
    pcgen: pinnedRow.extend({ benefit: z.string() }),
    additionalPcgen: z.array(pinnedRow),
    prd: z.array(
      z.object({
        path: z.string(),
        pageSha256: z.string(),
        line: z.number(),
        text: z.string(),
        sha256: z.string(),
      }),
    ),
    sections: z.array(z.object({ section: z.string(), reading: z.string() })),
    noticeChain: z.record(z.string(), z.string()),
  }),
});

/**
 * #631 wave F1: a Core Rulebook feat re-assessed in place under #735 S-04.
 * Its PCGen feat row (and any trick or proficiency rows) and PRD lines are the
 * literal pinned text, its Benefit is the row's BENEFIT, each body section has
 * a recorded reading, and its assessment supersedes the whole-content hold.
 */
export async function expectFeatLaunchReview(row: unknown, batch: number) {
  const feat = featLaunchRowSchema.parse(row);
  const review = feat.launchReview;
  for (const cited of [review.pcgen, ...review.additionalPcgen]) {
    const { sha256, lines } = await readPinnedPcgen(cited.path);
    expect(sha256, feat.name).toBe(cited.fileSha256);
    expect(lines[cited.line - 1], feat.name).toBe(cited.literalRow);
    expect(hash(cited.literalRow), feat.name).toBe(cited.lineSha256);
  }
  expect(review.pcgen.literalRow.split('\t')[0], feat.name).toBe(feat.name);
  expect(review.pcgen.literalRow, feat.name).toContain(
    `BENEFIT:${review.pcgen.benefit}`,
  );
  for (const line of review.prd) {
    const page = await readFile(join('tests/fixtures/pinned/prd', line.path));
    expect(hash(page), feat.name).toBe(line.pageSha256);
    expect(page.toString().split('\n')[line.line - 1], feat.name).toBe(
      line.text,
    );
    expect(hash(line.text), feat.name).toBe(line.sha256);
  }
  expect(review.sections.length, feat.name).toBeGreaterThan(1);
  expect(Object.keys(review.noticeChain).sort(), feat.name).toEqual(
    [...feat.requiredNotices].sort(),
  );
  const whole = `feats-${batch}-whole-content-${feat.externalKey.split('/')[1]}`;
  expect(feat.assessmentHistory[0]?.holdIds, feat.name).toEqual([whole]);
  const assessment = reviewedAdmission.assessments.find(
    (r) => r.externalKey === feat.externalKey,
  );
  expect(assessment, feat.name).toMatchObject({
    status: 'confirmed',
    requiredNotices: feat.requiredNotices,
    ...WAVE_F1_REVIEW,
  });
  expect(assessment?.rationale, feat.name).toContain(whole);
  expect(assessment?.rationale, feat.name).toContain('S-04');
}

/**
 * #628 wave F2: a Spell that Wild Shape functions as, re-assessed in place.
 * Its PCGen rows are the literal pinned text, its outcome supersedes the
 * batch's whole-content hold, every granted-level mapping outside
 * learnedAt.class is bounded, and it requires exactly the given notices
 * (the monster-ability books of its forms and of the spells it functions as).
 */
export async function expectWaveF2Spell(
  row: LaunchRow & { launchReview?: LaunchReview },
  {
    batch,
    launch,
    requiredNotices,
  }: {
    batch: number;
    launch: LaunchReassessment;
    requiredNotices: string[];
  },
) {
  const review = row.launchReview;
  if (!review) throw new Error(`${row.name} has no launchReview`);
  expect(isWaveF2Row(row), row.name).toBe(true);
  await expectPinnedPcgenRows(row, review);
  expectLaunchOutcome(row, { batch, launch });
  await expectGrantedLevelsBounded(row, review, batch);
  expect(row.requiredNotices, row.name).toEqual(requiredNotices);
}

/** Wave CL1's in-place launch re-assessments (#527 and #542, class-list Spells). */
export const WAVE_CL1_REVIEW = {
  reviewedBy: 'Opus (AI curator) for the owner',
  reviewedOn: '2026-11-08',
} as const;

type ClassListWave = {
  /** The run name's prefix in each re-assessed row's launchReview. */
  run: string;
  review: { reviewedBy: string; reviewedOn: string };
  bindingContext: WaveBindingContext['bindingContext'];
};

const CLASS_LIST_WAVES = {
  CL1: {
    run: 'Class-list Spell wave CL1',
    review: WAVE_CL1_REVIEW,
    bindingContext: waveCl1BindingContext,
  },
  // Wave CL2 (#525 and #537): the same reviewer, on the same day.
  CL2: {
    run: 'Class-list Spell wave CL2',
    review: WAVE_CL1_REVIEW,
    bindingContext: waveCl2BindingContext,
  },
} as const satisfies Record<string, ClassListWave>;

function isWaveRow(row: object, { run }: ClassListWave) {
  const review = (row as { launchReview?: { run?: unknown } }).launchReview;
  return typeof review?.run === 'string' && review.run.startsWith(run);
}

/** A row re-assessed by wave CL1 (its launchReview names the run). */
export function isWaveCl1Row(row: object) {
  return isWaveRow(row, CLASS_LIST_WAVES.CL1);
}

/** A row re-assessed by wave CL2 (its launchReview names the run). */
export function isWaveCl2Row(row: object) {
  return isWaveRow(row, CLASS_LIST_WAVES.CL2);
}

/**
 * A row re-assessed by either class-list Spell wave: both confirm in place
 * with the same reviewer and date (WAVE_CL1_REVIEW).
 */
export function isClassListWaveRow(row: object) {
  return isWaveCl1Row(row) || isWaveCl2Row(row);
}

/**
 * Each inherited-rule citation in a row's launchReview (a class record's
 * `- id:` line, a monster ability's or the Universal Monster Rules' source)
 * is the literal pinned line of a file with the recorded hash, and its book
 * is required.
 */
async function expectRuleCitations(
  row: LaunchRow,
  review: LaunchReview,
  requiredNotices: string[],
) {
  for (const cited of review.inheritedRuleCitations ?? []) {
    const bytes = await readFile(pinnedPath(cited.repo, cited.path));
    expect(hash(bytes), `${row.name}: ${cited.name}`).toBe(cited.sha256);
    expect(
      bytes.toString().split('\n')[cited.line - 1],
      `${row.name}: ${cited.name}`,
    ).toContain(cited.literalQuote);
    expect(requiredNotices, `${row.name}: ${cited.name}`).toContain(cited.book);
  }
}

type ClassListSpellOptions = {
  batch: number;
  launch: LaunchReassessment;
  requiredNotices: string[];
};

/**
 * A class-list Spell wave's row: a class-list-only Spell, or a Spell its gate
 * closure reaches, re-assessed in place. Its PCGen rows (and any further row
 * bounding part of its body) are the literal pinned text, its outcome
 * supersedes the batch's whole-content hold (or a named hold replaces it),
 * every granted-level mapping outside learnedAt.class is bounded, and it
 * requires exactly the given notices.
 */
async function expectClassListWaveSpell(
  row: LaunchRow & { launchReview?: LaunchReview },
  { batch, launch, requiredNotices }: ClassListSpellOptions,
  wave: ClassListWave,
) {
  const review = row.launchReview;
  if (!review) throw new Error(`${row.name} has no launchReview`);
  expect(isWaveRow(row, wave), row.name).toBe(true);
  expect(review, row.name).toMatchObject(wave.review);
  await expectPinnedPcgenRows(row, review, { pcgenBooks: review.pcgenBooks });
  for (const cited of review.additionalPcgen ?? []) {
    const { sha256, lines } = await readPinnedPcgen(cited.path);
    expect(sha256, row.name).toBe(cited.fileSha256);
    expect(lines[cited.line - 1], row.name).toBe(cited.literalRow);
    expect(hash(cited.literalRow), row.name).toBe(cited.lineSha256);
  }
  await expectRuleCitations(row, review, requiredNotices);
  expectLaunchOutcome(row, { batch, launch });
  await expectGrantedLevelsBounded(row, review, batch);
  expect(row.requiredNotices, row.name).toEqual(requiredNotices);
  const assessment = reviewedAdmission.assessments.find(
    (r) => r.externalKey === row.externalKey,
  );
  expect(assessment, row.name).toMatchObject({
    requiredNotices,
    ...wave.review,
  });
  // Bound over its full-corpus closure, as the gate binds it.
  const evidenceId = (row as { evidenceId?: string }).evidenceId;
  if (!evidenceId) throw new Error(`${row.name} has no evidenceId`);
  expect(assessment, row.name).toMatchObject(
    buildAssessmentBinding({
      ...wave.bindingContext(row.externalKey),
      requiredNotices,
      evidenceIds: [evidenceId],
      ...reviewedAdmission,
    }),
  );
}

/** Wave CL1 (#527 and #542): a row re-assessed in place. */
export function expectWaveCl1Spell(
  row: LaunchRow & { launchReview?: LaunchReview },
  options: ClassListSpellOptions,
) {
  return expectClassListWaveSpell(row, options, CLASS_LIST_WAVES.CL1);
}

/**
 * Wave CL2 (#525 and #537): a row re-assessed in place, admitted or kept
 * held on a named owner content hold (the launch's namedHolds).
 */
export function expectWaveCl2Spell(
  row: LaunchRow & { launchReview?: LaunchReview },
  options: ClassListSpellOptions,
) {
  return expectClassListWaveSpell(row, options, CLASS_LIST_WAVES.CL2);
}

/**
 * Wave CL2 for a row read straight from its inventory JSON: the launch
 * schemas parse its launchReview, history and the batch's launchReassessment.
 */
export function expectWaveCl2InventoryRow(
  row: Omit<LaunchRow, 'assessmentHistory'> & {
    launchReview?: unknown;
    assessmentHistory?: unknown;
  },
  {
    launch,
    ...options
  }: Omit<ClassListSpellOptions, 'launch'> & { launch: unknown },
) {
  return expectWaveCl2Spell(
    {
      ...row,
      launchReview: launchReviewSchema.parse(row.launchReview),
      assessmentHistory: assessmentHistorySchema.parse(row.assessmentHistory),
    },
    { ...options, launch: launchReassessmentSchema.parse(launch) },
  );
}

/**
 * The current assessment a batch test expects of one of its rows: a
 * class-list wave's row carries the wave's review and its record's status
 * (confirmed, or unresolved on a named hold); every other row keeps its
 * batch's earlier unresolved review.
 */
export function classListAssessment(
  row: { assessmentStatus?: string; launchReview?: unknown },
  earlier: { reviewedBy: string; reviewedOn: string },
) {
  return isClassListWaveRow(row)
    ? { status: row.assessmentStatus, ...WAVE_CL1_REVIEW }
    : { status: 'unresolved', ...earlier };
}
