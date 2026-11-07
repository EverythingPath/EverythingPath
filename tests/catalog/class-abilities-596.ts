import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
  collectReferences,
} from '../../scripts/catalog/admission';
import { curationSchema } from '../../scripts/catalog/curation';
import { importCatalog } from '../../scripts/catalog/import';
import type { PreviewEntry } from '../../scripts/catalog/map';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  evaluateFormula,
  parseFormula,
} from '../../src/lib/character-sheet-formulas';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  bindSnapshotToCurrentNotices,
  findCommittedBatchOwnershipProblems,
} from './batch-ownership';
import { materializePinnedTree, readPinned } from './pinned-sources';

/**
 * Shared checks for the class-feature launch subsets: one or more class
 * features from each class-ability batch, each batch with its own inventory
 * (`scripts/catalog/legal/class-abilities-<n>.json`), fixtures and test.
 *
 * - #596, the Fighter: run A curated #608, #621, #622, #625, #636 and #637;
 *   run B added #613 (Bonus Feats) and the Fighter itself
 *   (`classes-596.test.ts`, which reuses these schemas).
 * - #631 wave A, the increment parents: ten features of other classes in
 *   #607, #613, #616, #620, #622, #631, #639 and #643, each fixture holding
 *   the parent and the schedule increments that take its assessment.
 * - #617 wave B, the same checks for eleven more parents in #617, #624,
 *   #628, #629 and #637, by the same reviewer on the same date.
 * - #615 wave D, nine more in #604, #615, #626, #636, #640 and #647, by the
 *   same reviewer on its own date; Mercy is held, its increments with it.
 * - #619 wave E, three parents with Foundry contextNotes in #606, #613 and
 *   #619: each note has a checked record whose Modifiers the entry applies.
 *
 * A batch may hold several candidates, each with its own reviewer, date,
 * granting classes, books and PRD pages; the run A and B rows keep the
 * inventory's.
 */

export const REVIEWER = 'Sol (AI curator) for the owner';
export const REVIEWED_ON = '2026-10-31';
/** Run B's review date (#613 and the Fighter). */
export const RUN_B_REVIEWED_ON = '2026-11-01';
/** #631 wave A's reviewer and date (the increment parents). */
export const WAVE_A_REVIEWER = 'Opus (AI curator) for the owner';
export const WAVE_A_REVIEWED_ON = '2026-11-04';
/** #615 wave D's date (same reviewer). */
export const WAVE_D_REVIEWED_ON = '2026-11-05';
/** #619 wave E's date (same reviewer). */
export const WAVE_E_REVIEWED_ON = '2026-11-06';
export const FIGHTER = 'pf1/WLqBCT5DqmGAx8Wd';
const reviewers = z.enum([REVIEWER, WAVE_A_REVIEWER]);

export const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
export const strings = z.array(z.string());
export const pcgenRow = z.object({
  path: z.string(),
  line: z.number(),
  literalRow: z.string(),
  comparisonLineSha256: z.string(),
  comparisonFileSha256: z.string(),
  publicationTitle: z.string(),
  publicationAnchor: z.object({
    path: z.string(),
    line: z.number(),
    text: z.string(),
    sha256: z.string(),
  }),
  book: z.string(),
  completeDirectComparison: z.boolean(),
});
export const binding = z.object({
  contentFingerprint: z.string(),
  mappingFingerprint: z.string(),
  evidenceFingerprints: z.record(z.string(), z.string()),
  noticeFingerprints: z.record(z.string(), z.string()),
});
const prdComparison = z.object({
  path: z.string(),
  pageSha256: z.string(),
  lines: z.array(
    z.object({ line: z.number(), text: z.string(), sha256: z.string() }),
  ),
});
const foundryGrant = z.object({ path: z.string(), lines: z.array(z.number()) });
const dispositions = z.enum(['admitted', 'held', 'dependently-omitted']);
const candidateSchema = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.enum(['classFeature']),
  grantingClass: z.string(),
  /** Every class whose record grants the body (wave A); else grantingClass. */
  grantingClasses: strings.optional(),
  disposition: dispositions,
  assessmentStatus: z.enum(['confirmed', 'unresolved']),
  /** The row's own review, where it differs from the inventory's (wave A). */
  reviewedBy: reviewers.optional(),
  reviewedOn: z.string().optional(),
  source: z.object({
    repo: z.literal('pf1'),
    path: z.string(),
    sha256: z.string(),
  }),
  descriptionSha256: z.string(),
  citedSources: z.array(z.object({ book: z.string(), pages: z.string() })),
  requiredNotices: strings,
  evidenceId: z.string(),
  holdIds: strings,
  noticeHoldIds: strings,
  missingEvidence: z
    .record(
      z.string(),
      z.object({
        book: z.string().nullable(),
        reason: z.string(),
        items: strings,
      }),
    )
    .nullable(),
  comparison: pcgenRow,
  additionalComparisonLeads: z.array(pcgenRow),
  prdComparison,
  /** A shared body's other book's page (wave A: the Unchained Monk's). */
  additionalPrdComparisons: z.array(prdComparison).optional(),
  grantEvidence: z.object({
    pcgen: z.array(
      z.object({
        path: z.string(),
        line: z.number(),
        literalRow: z.string(),
        sha256: z.string(),
      }),
    ),
    foundry: foundryGrant.nullable(),
    additionalFoundry: z.array(foundryGrant).optional(),
  }),
  inheritedRuleNotices: z.array(z.object({ book: z.string() })),
  sourceFields: z.record(z.string(), z.unknown()),
  currentBinding: binding,
  mechanicsReview: z.object({
    descriptionText: z.string(),
    curationRecords: curationSchema.shape.records,
    classFeatureReview: z.object({
      level: z.number(),
      schedule: z.array(
        z.object({
          level: z.number(),
          value: z.union([z.number(), z.boolean()]),
        }),
      ),
      validatedThrough: z.literal(20),
    }),
    /** The schedule increments that take the parent's assessment (wave A). */
    incrementReview: z
      .object({
        increments: strings,
        labels: z.array(
          z.object({
            externalKey: z.string(),
            name: z.string(),
            level: z.number(),
            prdTable: z.object({
              path: z.string(),
              line: z.number(),
              column: z.number(),
              cell: z.string(),
              token: z.string(),
            }),
          }),
        ),
      })
      .optional(),
    outstandingCalculations: z.array(
      z.object({ calculation: z.string(), owner: z.string() }),
    ),
  }),
});
const prdSource = z.object({ path: z.string(), sha256: z.string() });
const inventorySchema = z.object({
  ticket: z.string(),
  launchSubset: z.object({
    statement: z.string(),
    curatedKeys: strings,
    remainingAcceptance: strings,
  }),
  reviewedBy: reviewers,
  reviewedOn: z.enum([
    REVIEWED_ON,
    RUN_B_REVIEWED_ON,
    WAVE_A_REVIEWED_ON,
    WAVE_D_REVIEWED_ON,
    WAVE_E_REVIEWED_ON,
  ]),
  comparisonSources: z.object({
    pcgenFiles: z.array(z.object({ path: z.string(), sha256: z.string() })),
    prd: prdSource,
    additionalPrd: z.array(prdSource).optional(),
  }),
  noticeRequirements: z.array(
    z.object({
      book: z.string(),
      holdId: z.null(),
      candidates: strings,
    }),
  ),
  counts: z.record(z.string(), z.number()),
  candidates: z.array(candidateSchema).min(1),
});
const previewSchema = z.object({
  entries: z.tuple([importedCatalogEntrySchema]),
  closure: z.tuple([]),
});
/**
 * Wave A's `binding-preview.json`: the batch's increment parents, each its
 * own closure, and their schedule increments, from the full-corpus preview.
 */
const bindingPreviewSchema = z.object({
  entries: z.array(importedCatalogEntrySchema).min(1),
  closure: z.tuple([]),
  increments: z.array(importedCatalogEntrySchema),
});

/**
 * One batch's candidate: its inventory, the candidate (the first, or the
 * given key) and its fixture entry. Runs A and B keep `preview.json`; wave A
 * keeps its parents and their increments in `binding-preview.json`, which
 * cross-batch-bindings.ts also reads.
 */
function loadLaunchFeatureBatch(batch: number, key?: string) {
  const inventoryPath = `scripts/catalog/legal/class-abilities-${batch}.json`;
  const inventory = inventorySchema.parse(
    JSON.parse(readFileSync(inventoryPath, 'utf8')),
  );
  const candidate = key
    ? inventory.candidates.find((row) => row.externalKey === key)
    : inventory.candidates[0];
  if (!candidate) throw new Error(`#${batch} has no candidate ${key}`);
  const read = (name: string): unknown =>
    JSON.parse(
      readFileSync(`tests/fixtures/class-abilities-${batch}/${name}`, 'utf8'),
    );
  // The committed rows are the full-corpus preview's own output; the binding
  // code reads them as imported, as cross-batch-bindings.ts does.
  if (!key) {
    const preview = previewSchema.parse(read('preview.json'));
    const [entry] = preview.entries as unknown as [PreviewEntry];
    return {
      batch,
      inventoryPath,
      inventory,
      candidate,
      entry,
      increments: [],
    };
  }
  const preview = bindingPreviewSchema.parse(read('binding-preview.json'));
  const entries = preview.entries as unknown as PreviewEntry[];
  const entry = entries.find((row) => row.externalKey === key);
  if (!entry) throw new Error(`#${batch}'s binding preview lacks ${key}`);
  const increments = (preview.increments as unknown as PreviewEntry[]).filter(
    (row) => row.attributionFrom === key,
  );
  return { batch, inventoryPath, inventory, candidate, entry, increments };
}

/**
 * The checks every run A batch shares: its inventory and launch-subset
 * statement, its pinned body against the PRD and PCGen rows it cites, a
 * re-extraction from the shared store, its gate outcome and binding, and its
 * own rows in the shared data.
 */
export function describeLaunchFeature({
  batch,
  name,
  disposition,
  reviewedOn = REVIEWED_ON,
  reviewer = REVIEWER,
  key,
  books = ['PZO1110'],
  classes = [FIGHTER],
}: {
  batch: number;
  name: string;
  disposition: 'admitted' | 'held';
  /** The row's review date: run A's, unless given (run B, wave A). */
  reviewedOn?: string;
  /** The row's reviewer: Sol (runs A and B), unless given (wave A). */
  reviewer?: string;
  /** The candidate's key, where the batch holds several (wave A). */
  key?: string;
  /** The books the row cites: the Core Rulebook, unless given. */
  books?: string[];
  /** The classes whose records grant the body: the Fighter, unless given. */
  classes?: string[];
}) {
  const data = loadLaunchFeatureBatch(batch, key);
  const { inventory, candidate, entry, increments, inventoryPath } = data;
  const keys = inventory.candidates.map((row) => row.externalKey);

  it(`records ${name} as the MVP launch subset of #${batch}, the rest remaining acceptance`, () => {
    expect(candidate.name).toBe(name);
    expect(candidate.reviewedOn ?? inventory.reviewedOn).toBe(reviewedOn);
    expect(candidate.reviewedBy ?? inventory.reviewedBy).toBe(reviewer);
    expect(candidate.disposition).toBe(disposition);
    expect(candidate.grantingClasses ?? [candidate.grantingClass]).toEqual(
      classes,
    );
    expect(candidate.grantingClass).toBe(classes[0]);
    expect(inventory.ticket).toBe(
      `https://github.com/AndreasUnunger/EverythingPath/issues/${batch}`,
    );
    expect(inventory.launchSubset.statement).toMatch(
      new RegExp(`^MVP launch subset of #${batch}:`),
    );
    expect(inventory.launchSubset.curatedKeys).toEqual(keys);
    expect(inventory.launchSubset.remainingAcceptance).toHaveLength(
      100 - keys.length,
    );
    for (const curated of keys)
      expect(inventory.launchSubset.remainingAcceptance).not.toContain(curated);
    const count = (state: string) =>
      inventory.candidates.filter((row) => row.disposition === state).length;
    expect(inventory.counts).toMatchObject({
      total: keys.length,
      admitted: count('admitted'),
      held: count('held'),
      excluded: 0,
    });
    expect(candidate.evidenceId).toBe(
      `class-abilities-${batch}-${candidate.externalKey.split('/')[1]}`,
    );
    expect(candidate.noticeHoldIds).toEqual([]);
    for (const requirement of inventory.noticeRequirements)
      for (const listed of requirement.candidates)
        expect(keys).toContain(listed);
    expect(
      inventory.noticeRequirements
        .filter((row) => row.candidates.includes(candidate.externalKey))
        .map((row) => row.book),
    ).toEqual(candidate.requiredNotices);
    expect(candidate.mechanicsReview.classFeatureReview.schedule).toHaveLength(
      20,
    );
  });

  it(`pins ${name}'s complete body, checked records, PRD lines and PCGen rows in the shared store`, async () => {
    const bytes = await readPinned('pf1', candidate.source.path);
    expect(sha(bytes)).toBe(candidate.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(`pf1/${raw._id}`).toBe(candidate.externalKey);
    expect(raw.name).toBe(name);
    expect(raw.system).toEqual(candidate.sourceFields);
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(candidate.descriptionSha256);
    expect(description).toBe(candidate.mechanicsReview.descriptionText);
    expect(candidate.citedSources.map((row) => row.book)).toEqual(books);
    const records = candidate.mechanicsReview.curationRecords;
    expect(records[0]).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
    });
    for (const record of records) {
      expect(record).toMatchObject({
        status: 'checked',
        diagnostics: [],
        reviewedBy: reviewer,
        reviewedOn,
      });
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === record.externalKey &&
            current.kind === record.kind &&
            current.target === record.target &&
            current.textSha256 === record.textSha256,
        ),
      ).toEqual(record);
    }
    await expectPcgenRows({ inventory, candidate, books });
    await expectPrdPages({ inventory, candidate });
    await expectFoundryGrants(candidate);
    await expectIncrementLabels({ candidate, increments });
  });

  it(`reextracts ${name} from the shared store and binds its ${disposition} assessment to current data`, async () => {
    const file = `pf1/${candidate.source.path}`;
    const tree = await materializePinnedTree([file], {
      sha256: { [file]: candidate.source.sha256 },
    });
    try {
      const artifact = await importCatalog({
        ...tree,
        remaps,
        curation: reviewedCuration,
        candidateKeys: [candidate.externalKey],
      });
      expect(artifact.curation.missing).toEqual([]);
      expect(artifact.curation.stale).toEqual([]);
      const [extracted] = artifact.catalog.entries;
      expect(artifact.catalog.entries).toHaveLength(1);
      expect(extracted).toEqual(entry);
      // Its closure is the entry alone: no other assessed body reaches it.
      expect(collectReferences(entry)).toEqual([]);
      // Its schedule increments (wave A) take its assessment: each names the
      // parent as its attribution owner and reaches only the parent.
      const review = candidate.mechanicsReview.incrementReview;
      expect(increments.map((row) => row.externalKey)).toEqual(
        review?.increments ?? [],
      );
      for (const increment of increments) {
        expect(increment).toMatchObject({
          upstreamKey: candidate.externalKey,
          pack: 'everythingpath-schedules',
          attributionFrom: candidate.externalKey,
          detail: {
            kind: 'classFeature',
            parentFeature: candidate.externalKey,
          },
        });
        expect(collectReferences(increment)).toEqual([candidate.externalKey]);
      }
      const authoritative = {
        ...artifact,
        catalog: { ...artifact.catalog, entries: [entry, ...increments] },
      };
      const gate = assessCatalogAdmission({
        artifact: authoritative,
        ...reviewedAdmission,
      });
      const assessment = reviewedAdmission.assessments.find(
        (row) => row.externalKey === candidate.externalKey,
      );
      expect(assessment).toMatchObject({
        status: candidate.assessmentStatus,
        requiredNotices: candidate.requiredNotices,
        reviewedBy: reviewer,
        reviewedOn,
        ...bindSnapshotToCurrentNotices(candidate.currentBinding),
      });
      // No increment carries an assessment of its own.
      for (const increment of increments)
        expect(
          reviewedAdmission.assessments.some(
            (row) => row.externalKey === increment.externalKey,
          ),
        ).toBe(false);
      expect(
        buildAssessmentBinding({
          artifact: authoritative,
          entry,
          requiredNotices: candidate.requiredNotices,
          evidenceIds: [candidate.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(candidate.currentBinding));
      expect(gate.failures).toEqual([]);
      if (disposition === 'admitted') {
        expect(gate.admitted.map((row) => row.externalKey).sort()).toEqual(
          [candidate.externalKey, ...increments.map((row) => row.externalKey)]
            .slice()
            .sort(),
        );
        // A changed body invalidates the binding: neither it nor its
        // increments are admitted.
        const edited = assessCatalogAdmission({
          artifact: {
            ...authoritative,
            catalog: {
              ...authoritative.catalog,
              entries: [
                { ...entry, description: `${entry.description} ` },
                ...increments,
              ],
            },
          },
          ...reviewedAdmission,
        });
        expect(edited.admitted).toEqual([]);
      } else {
        // A held parent holds its increments with it (wave D's Mercy).
        expect(gate.admitted).toEqual([]);
        expect(gate.held.map((row) => row.externalKey).sort()).toEqual(
          [candidate.externalKey, ...increments.map((row) => row.externalKey)]
            .slice()
            .sort(),
        );
      }
    } finally {
      await tree.dispose();
    }
  });

  it(`keeps #${batch}'s own description record, assessment, evidence and holds as recorded`, () => {
    expect(findCommittedBatchOwnershipProblems(inventoryPath)).toEqual([]);
  });

  return data;
}

type Inventory = z.infer<typeof inventorySchema>;
type Candidate = z.infer<typeof candidateSchema>;

/** Each PCGen comparison and grant row against the file hash the inventory records. */
async function expectPcgenRows({
  inventory,
  candidate,
  books,
}: {
  inventory: Inventory;
  candidate: Candidate;
  books: string[];
}) {
  const files = new Map(
    inventory.comparisonSources.pcgenFiles.map((row) => [row.path, row.sha256]),
  );
  for (const row of [
    candidate.comparison,
    ...candidate.additionalComparisonLeads,
  ]) {
    const text = await readPinned('pcgen', row.path);
    expect(sha(text)).toBe(files.get(row.path));
    expect(sha(text)).toBe(row.comparisonFileSha256);
    expect(text.split('\n')[row.line - 1]).toBe(row.literalRow);
    expect(sha(row.literalRow)).toBe(row.comparisonLineSha256);
    const anchor = await readPinned('pcgen', row.publicationAnchor.path);
    expect(anchor.split('\n')[row.publicationAnchor.line - 1]).toMatch(
      new RegExp(`^${row.publicationAnchor.text}(\t|$)`),
    );
    expect(row.publicationAnchor.text).toBe(
      `SOURCELONG:${row.publicationTitle}`,
    );
  }
  expect(books).toContain(candidate.comparison.book);
  for (const row of candidate.grantEvidence.pcgen) {
    const text = await readPinned('pcgen', row.path);
    expect(sha(text)).toBe(files.get(row.path));
    expect(text.split('\n')[row.line - 1]).toBe(row.literalRow);
    expect(sha(row.literalRow)).toBe(row.sha256);
  }
}

/** The PRD capture's class pages and lines, by the manifest's hash. */
async function expectPrdPages({
  inventory,
  candidate,
}: {
  inventory: Inventory;
  candidate: Candidate;
}) {
  const manifest = z
    .object({
      pages: z.array(z.object({ file: z.string(), sha256: z.string() })),
    })
    .parse(JSON.parse(await readPinned('prd', 'manifest.json')));
  const { prd, additionalPrd = [] } = inventory.comparisonSources;
  const recordedPages = new Map(
    [prd, ...additionalPrd].map((row) => [row.path, row.sha256]),
  );
  const { prdComparison, additionalPrdComparisons = [] } = candidate;
  for (const comparison of [prdComparison, ...additionalPrdComparisons]) {
    const page = await readPinned('prd', comparison.path);
    expect(sha(page)).toBe(comparison.pageSha256);
    expect(sha(page)).toBe(recordedPages.get(comparison.path));
    expect(
      manifest.pages.find((row) => row.file === comparison.path)?.sha256,
    ).toBe(comparison.pageSha256);
    const lines = page.split('\n');
    for (const row of comparison.lines) {
      expect(lines[row.line - 1]).toBe(row.text);
      expect(sha(row.text)).toBe(row.sha256);
    }
  }
}

/** Each granting class's own association, where Foundry records one. */
async function expectFoundryGrants(candidate: Candidate) {
  const { foundry, additionalFoundry = [] } = candidate.grantEvidence;
  for (const grant of foundry ? [foundry, ...additionalFoundry] : []) {
    const lines = (await readPinned('pf1', grant.path)).split('\n');
    expect(lines[grant.lines[0]! - 1]?.trim()).toBe(
      `- level: ${candidate.mechanicsReview.classFeatureReview.level}`,
    );
    expect(lines[grant.lines[1]! - 1]?.trim()).toBe(
      `uuid: Compendium.pf1.class-abilities.Item.${candidate.externalKey.split('/')[1]}`,
    );
  }
}

/** Each increment's name against its class table's row (wave A). */
async function expectIncrementLabels({
  candidate,
  increments,
}: {
  candidate: Candidate;
  increments: PreviewEntry[];
}) {
  const labels = candidate.mechanicsReview.incrementReview?.labels ?? [];
  for (const label of labels) {
    const { path, line, column, cell, token } = label.prdTable;
    const row = (await readPinned('prd', path)).split('\n')[line - 1] ?? '';
    const cells = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(([, text]) =>
      tableCell(text ?? ''),
    );
    expect(cells[0]).toBe(ordinal(label.level));
    expect(cells[column]).toBe(cell);
    expect(cell.toLowerCase()).toContain(token.toLowerCase());
    expect(
      increments.find((entry) => entry.externalKey === label.externalKey)?.name,
    ).toBe(label.name);
  }
}

/** The rules text of a pinned body's paragraphs, as the reviewed Notes state it. */
export function bodyParagraphs(description: string) {
  return [...description.matchAll(/<p>(.*?)<\/p>/gs)].map(([, text]) =>
    (text ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/** The PRD line's rules text without its heading and markup. */
export function prdText(line: string) {
  return line
    .replace(/<[^>]+>/g, '')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&times;/g, '×')
    .replace(/\s+/g, ' ')
    .replace(/^[A-Za-z ()]+ \(Ex\): /, '')
    .trim();
}

const ENTITIES: Record<string, string> = {
  ndash: '–',
  mdash: '—',
  times: '×',
  amp: '&',
  nbsp: ' ',
  quot: '"',
};

/** A PRD table cell's text: markup stripped, entities read, spaces collapsed. */
function tableCell(html: string) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&(\w+);/g, (match, name: string) => ENTITIES[name] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

/** 1st, 2nd, 3rd, 4th ... 20th, as the PRD class tables print levels. */
function ordinal(level: number) {
  const suffix =
    level % 100 >= 11 && level % 100 <= 13
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[level % 10];
  return `${level}${suffix ?? 'th'}`;
}

/**
 * The rules text of a pinned body's paragraphs, tables apart, tolerating
 * Foundry's unclosed `<p>` (wave A's Hex, Mystery and Judgment), as the
 * reviewed Notes state it.
 */
export function ruleParagraphs(description: string) {
  return description
    .replace(/<table>.*?<\/table>/gs, '<p>')
    .split(/<\/?p>/)
    .map((text) =>
      text
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

/**
 * Wave A's shared facts for one parent: its Notes (every paragraph, the
 * first only, or none where other batches' closures reach the body), its
 * Foundry changes left unmapped, its Modifiers (none, or wave E's from its
 * checked note records), and every outstanding calculation with the launch
 * row's owner, the batch.
 */
export function expectIncrementParentFacts({
  batch,
  candidate,
  entry,
  notes,
  unmappedTargets = [],
  modifiers = [],
}: {
  batch: number;
  candidate: Candidate;
  entry: PreviewEntry;
  notes: 'all' | 'first' | 'none';
  unmappedTargets?: string[];
  /** The entry's Modifiers as its note and description records give them (wave E). */
  modifiers?: unknown[];
}) {
  const paragraphs = ruleParagraphs(candidate.mechanicsReview.descriptionText);
  const expected =
    notes === 'all'
      ? paragraphs
      : notes === 'first'
        ? paragraphs.slice(0, 1)
        : [];
  expect(entry.situationalNotes?.map((note) => note.text) ?? []).toEqual(
    expected,
  );
  expect(entry.modifiers).toEqual(modifiers);
  expect(
    entry.unsupported
      .filter((row) => row.field === 'changes')
      .map((row) => (row.value as { target: string }).target),
  ).toEqual(unmappedTargets);
  const outstanding = candidate.mechanicsReview.outstandingCalculations;
  expect(new Set(outstanding.map((row) => row.owner))).toEqual(
    new Set([`#${batch}`]),
  );
  expect(outstanding.at(-1)?.calculation).toMatch(
    /^Feature\/option grants and conditions/,
  );
  return paragraphs;
}

/** A body paragraph or PRD line as comparable text: markup, heading and typography aside. */
function comparable(html: string) {
  return tableCell(
    html.replace(/^\s*<p[^>]*>\s*<(b|strong)>.*?<\/\1>\s*:\s*/, ''),
  ).replace(/’/g, "'");
}

/**
 * Wave A: one increment parent, reviewed by Opus for the owner on
 * 2026-11-04 (or the wave's `reviewedOn`) and admitted with its schedule
 * increments. With `prdExact`, the body's paragraphs equal its primary PRD
 * lines word for word. Wave E's parents add a checked note record for each
 * Foundry contextNote (`noteRecords`), after the description record.
 */
export function describeIncrementParent({
  prdExact,
  reviewedOn = WAVE_A_REVIEWED_ON,
  noteRecords = 0,
  ...options
}: {
  batch: number;
  key: string;
  name: string;
  books: string[];
  classes: string[];
  prdExact: boolean;
  reviewedOn?: string;
  noteRecords?: number;
}) {
  const data = describeLaunchFeature({
    ...options,
    disposition: 'admitted',
    reviewer: WAVE_A_REVIEWER,
    reviewedOn,
  });
  const { candidate, increments } = data;
  it(`admits ${options.name}'s ${increments.length} increments with it${prdExact ? ', its body the PRD text word for word' : ''}`, () => {
    expect(increments.length).toBeGreaterThan(0);
    const records = candidate.mechanicsReview.curationRecords;
    expect(records).toHaveLength(1 + noteRecords);
    // One note record per contextNote, bound to its target and exact text.
    const notes = (candidate.sourceFields.contextNotes ?? []) as {
      target: string;
      text: string;
    }[];
    expect(
      records.slice(1).map(({ kind, target, text, textSha256 }) => ({
        kind,
        target,
        text,
        textSha256,
      })),
    ).toEqual(
      notes.map(({ target, text }) => ({
        kind: 'note',
        target,
        text,
        textSha256: sha(text),
      })),
    );
    if (!prdExact) return;
    const body = ruleParagraphs(candidate.mechanicsReview.descriptionText);
    expect(body.map(comparable).join(' ')).toBe(
      candidate.prdComparison.lines
        .map((row) => comparable(row.text))
        .join(' '),
    );
  });
  return data;
}

/** A parent's schedule values from 1st to 20th level. */
export function scheduleValues(candidate: Candidate) {
  return candidate.mechanicsReview.classFeatureReview.schedule.map(
    (row) => row.value,
  );
}

/** 1st to 20th. */
export const LEVELS = Array.from({ length: 20 }, (_, index) => index + 1);

/**
 * Wave E: a note record's formula at the given class levels, through the
 * sheet's own parser and evaluator; an absent class reads 0.
 */
export function formulaAt(
  formula: string,
  classLevels: Record<string, number>,
) {
  return evaluateFormula(parseFormula(formula), (name) => {
    if (!name.startsWith('@classLevel.'))
      throw new Error(`${name} is not a class level`);
    return classLevels[name.slice('@classLevel.'.length)] ?? 0;
  });
}

/** Wave E: an entry's Modifiers as its note records, then its description record, give them. */
export function recordModifiers(candidate: Candidate) {
  const [description, ...notes] = candidate.mechanicsReview.curationRecords;
  return [...notes, description]
    .flatMap((record) => record?.outputs ?? [])
    .map(({ kind: _kind, ...modifier }) => modifier);
}
