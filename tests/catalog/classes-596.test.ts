// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
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
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  bindSnapshotToCurrentNotices,
  findCommittedBatchOwnershipProblems,
} from './batch-ownership';
import {
  binding,
  FIGHTER,
  pcgenRow,
  REVIEWER,
  RUN_B_REVIEWED_ON,
  sha,
  strings,
} from './class-abilities-596';
import { materializePinnedTree, readPinned } from './pinned-sources';

// #596 run B: the Fighter class root. Its assessment is confirmed, and the
// gate omits it as a dependent of Weapon Training (#625) and that feature's
// 9th, 13th and 17th level increments, which stay held on owner-owed
// evidence. Bonus Feats is #613's (`class-abilities-613.test.ts`).

const inventoryPath = 'scripts/catalog/legal/classes-596.json';
const featureRow = z.object({
  classLevel: z.number(),
  externalKey: z.string(),
  name: z.string(),
  owner: z.string(),
  fullPreviewAdmission: z.enum(['admitted', 'held']),
});
const candidateSchema = z.object({
  externalKey: z.literal(FIGHTER),
  name: z.literal('Fighter'),
  kind: z.literal('class'),
  disposition: z.literal('dependently-omitted'),
  assessmentStatus: z.literal('confirmed'),
  source: z.object({
    repo: z.literal('pf1'),
    path: z.string(),
    sha256: z.string(),
  }),
  descriptionSha256: z.string(),
  citedSources: z.array(z.object({ book: z.string(), pages: z.string() })),
  requiredNotices: strings,
  evidenceId: z.literal('classes-596-WLqBCT5DqmGAx8Wd'),
  holdIds: z.tuple([]),
  noticeHoldIds: z.tuple([]),
  missingEvidence: z.null(),
  dependentOmission: z.object({
    expectedReason: z.string(),
    heldDependencies: strings,
  }),
  comparison: pcgenRow,
  additionalComparisonLeads: z.array(pcgenRow),
  prdComparison: z.object({
    path: z.string(),
    pageSha256: z.string(),
    lines: z.array(
      z.object({ line: z.number(), text: z.string(), sha256: z.string() }),
    ),
  }),
  classReview: z.object({
    table: z.array(
      z.object({
        level: z.number(),
        bab: z.string(),
        fort: z.string(),
        ref: z.string(),
        will: z.string(),
        special: z.string(),
      }),
    ),
    featuresByLevel: z.array(featureRow),
    validatedThrough: z.literal(20),
  }),
  inheritedRuleNotices: z.array(z.object({ book: z.string() })),
  sourceFields: z.record(z.string(), z.unknown()),
  currentBinding: binding,
  mechanicsReview: z.object({
    descriptionText: z.string(),
    curationRecords: curationSchema.shape.records,
    outstandingCalculations: z.array(
      z.object({ calculation: z.string(), owner: z.string() }),
    ),
  }),
});
const inventory = z
  .object({
    ticket: z.literal(
      'https://github.com/AndreasUnunger/EverythingPath/issues/596',
    ),
    launchSubset: z.object({
      statement: z.string(),
      curatedKeys: strings,
      remainingAcceptance: strings,
    }),
    reviewedBy: z.literal(REVIEWER),
    reviewedOn: z.literal(RUN_B_REVIEWED_ON),
    comparisonSources: z.object({
      pcgenFiles: z.array(z.object({ path: z.string(), sha256: z.string() })),
      prd: z.object({ path: z.string(), sha256: z.string() }),
    }),
    noticeRequirements: z.array(
      z.object({ book: z.string(), holdId: z.null(), candidates: strings }),
    ),
    counts: z.record(z.string(), z.number()),
    candidates: z.tuple([candidateSchema]),
  })
  .parse(JSON.parse(readFileSync(inventoryPath, 'utf8')));
const [candidate] = inventory.candidates;
const preview = z
  .object({
    entries: z.tuple([importedCatalogEntrySchema]),
    closure: z.array(importedCatalogEntrySchema).length(27),
  })
  .parse(
    JSON.parse(readFileSync('tests/fixtures/classes-596/preview.json', 'utf8')),
  );
// The committed rows are the full-corpus preview's own output.
const [fighter] = preview.entries as unknown as [PreviewEntry];
const closure = preview.closure as unknown as PreviewEntry[];
const features =
  fighter.detail.kind === 'class' ? fighter.detail.featuresByLevel : [];

/** The pinned Foundry bodies of the Fighter's closure: the class and its seven features. */
const FEATURE_KEYS = [
  'pf1/CV8BsY3ciUb9TA1Y',
  'pf1/h0Brxw6khcjlEf1T',
  'pf1/5JFfSqLMCpbRmERa',
  'pf1/RzEzudurxQFirFoF',
  'pf1/iqeyCQIIVnNt0p3h',
  'pf1/NwTe1Q2utlsmOAqK',
  'pf1/McXAM1BoPHZLO1n4',
];
const HELD = [
  'everythingpath/fighter-weapon-training-13',
  'everythingpath/fighter-weapon-training-17',
  'everythingpath/fighter-weapon-training-9',
  'pf1/RzEzudurxQFirFoF',
];

it('records the Fighter as the MVP launch subset of #596, dependently omitted, the rest remaining acceptance', () => {
  expect(inventory.launchSubset.statement).toMatch(
    /^MVP launch subset of #596:/,
  );
  expect(inventory.launchSubset.curatedKeys).toEqual([FIGHTER]);
  expect(inventory.launchSubset.remainingAcceptance).toEqual([
    'pf1/W3EjUgYLJ1D9qDKw',
    'pf1/W8dxwZ1CZiwLKsqr',
  ]);
  expect(inventory.counts).toMatchObject({
    total: 1,
    admitted: 0,
    held: 0,
    dependentlyOmitted: 1,
    excluded: 0,
  });
  expect(candidate.requiredNotices).toEqual(['PZO1110', 'PZO1131']);
  expect(inventory.noticeRequirements.map((row) => row.book)).toEqual(
    candidate.requiredNotices,
  );
  for (const { book } of candidate.inheritedRuleNotices)
    expect(candidate.requiredNotices).toContain(book);
  // Both notices are reviewed: CRB (alias PZO1110) and Pathfinder Unchained.
  expect(reviewedAdmission.registry.CRB?.aliases).toContain('PZO1110');
  expect(reviewedAdmission.registry.CRB?.reviewStatus).toBe('reviewed');
  expect(reviewedAdmission.registry.PZO1131?.reviewStatus).toBe('reviewed');
  expect(candidate.dependentOmission).toMatchObject({
    expectedReason: `Dependent omission: ${HELD.join(', ')}.`,
    heldDependencies: HELD,
  });
  expect(
    candidate.mechanicsReview.outstandingCalculations.map((row) => row.owner),
  ).toEqual(['#716', '#716', '#313', '#716']);
});

it("pins the Fighter's body, checked record, PRD lines and PCGen rows in the shared store", async () => {
  const bytes = await readPinned('pf1', candidate.source.path);
  expect(sha(bytes)).toBe(candidate.source.sha256);
  const raw = upstreamRecord.parse(parse(bytes));
  expect(`pf1/${raw._id}`).toBe(FIGHTER);
  expect(raw.system).toEqual(candidate.sourceFields);
  const description = sourceDescription(raw);
  expect(sha(description)).toBe(candidate.descriptionSha256);
  expect(description).toBe(candidate.mechanicsReview.descriptionText);
  const [record] = candidate.mechanicsReview.curationRecords;
  expect(candidate.mechanicsReview.curationRecords).toHaveLength(1);
  // Covered, no output: Role is flavour and the class skills are detail.
  expect(record).toMatchObject({
    kind: 'description',
    target: 'description',
    text: description,
    textSha256: sha(description),
    status: 'checked',
    outputs: [],
    diagnostics: [],
    reviewedBy: REVIEWER,
    reviewedOn: RUN_B_REVIEWED_ON,
  });
  expect(
    reviewedCuration.records.filter(
      (row) => row.externalKey === FIGHTER && row.kind === 'description',
    ),
  ).toEqual([record]);
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
  }
  expect(candidate.comparison.literalRow).toMatch(
    /^CLASS:Fighter\tHD:10\t.*BONUS:COMBAT\|BASEAB\|classlevel\("APPLIEDAS=NONEPIC"\).*BONUS:SAVE\|BASE\.Fortitude\|classlevel\("APPLIEDAS=NONEPIC"\)\/2\+2.*BONUS:SAVE\|BASE\.Reflex,BASE\.Will\|classlevel\("APPLIEDAS=NONEPIC"\)\/3/,
  );
  expect(
    candidate.additionalComparisonLeads.map((row) => [
      row.book,
      row.literalRow.split('\t')[0],
    ]),
  ).toEqual([
    ['PZO1110', 'CLASS:Fighter'],
    ['PZO1110', 'Fighter Core Class Skills'],
    ['PZO1110', 'Weapon and Armor Proficiency'],
    ['PZO1131', 'Artistry'],
    ['PZO1131', 'Lore (_______________________)'],
  ]);
  const page = await readPinned('prd', candidate.prdComparison.path);
  expect(sha(page)).toBe(candidate.prdComparison.pageSha256);
  expect(sha(page)).toBe(inventory.comparisonSources.prd.sha256);
  const lines = page.split('\n');
  for (const row of candidate.prdComparison.lines) {
    expect(lines[row.line - 1]).toBe(row.text);
    expect(sha(row.text)).toBe(row.sha256);
  }
  expect(lines[349]).toContain('<b>Hit Die</b>: d10.');
  expect(lines[352]).toContain('<b>Skill Ranks per Level</b>: 2 + ');
});

it('matches the imported Fighter with the PRD table: d10, full BAB, good Fortitude, poor Reflex and Will, 2 + Int, ten class skills', async () => {
  expect(fighter.detail).toMatchObject({
    kind: 'class',
    hitDie: 10,
    bab: 'full',
    saves: { fort: 'good', ref: 'poor', will: 'poor' },
    skillRanksPerLevel: 2,
    classSkills: [
      'skill.clm',
      'skill.crf',
      'skill.han',
      'skill.int',
      'skill.kdu',
      'skill.ken',
      'skill.pro',
      'skill.rid',
      'skill.sur',
      'skill.swm',
    ],
  });
  // Artistry and Lore (Pathfinder Unchained) stay prose.
  expect(
    fighter.unsupported
      .filter((row) => row.field === 'classSkills')
      .map((row) => row.value),
  ).toEqual(['art', 'lor']);
  const page = (await readPinned('prd', candidate.prdComparison.path)).split(
    '\n',
  );
  const table = [...Array(20).keys()].map((index) => {
    const cells = [...page[356 + index]!.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(
      ([, text]) => (text ?? '').replace(/<[^>]+>/g, ''),
    );
    return {
      level: index + 1,
      bab: cells[1]!,
      fort: cells[2]!,
      ref: cells[3]!,
      will: cells[4]!,
      special: cells[5]!,
    };
  });
  expect(candidate.classReview.table).toEqual(table);
  for (const { level, bab, fort, ref, will } of table) {
    expect(bab.split('/')[0]).toBe(`+${level}`);
    expect(fort).toBe(`+${2 + Math.floor(level / 2)}`);
    expect(ref).toBe(`+${Math.floor(level / 3)}`);
    expect(will).toBe(`+${Math.floor(level / 3)}`);
  }
  const levelsOf = (pattern: RegExp) =>
    table.filter((row) => pattern.test(row.special)).map((row) => row.level);
  const rowsOf = (parent: string) =>
    features
      .filter(
        (row) =>
          row.externalKey === parent ||
          closure.find((entry) => entry.externalKey === row.externalKey)
            ?.attributionFrom === parent,
      )
      .map((row) => row.classLevel);
  expect(rowsOf('pf1/CV8BsY3ciUb9TA1Y')).toEqual(levelsOf(/Bonus feat/));
  expect(rowsOf('pf1/h0Brxw6khcjlEf1T')).toEqual(levelsOf(/bravery/));
  expect(rowsOf('pf1/5JFfSqLMCpbRmERa')).toEqual(levelsOf(/Armor training/));
  expect(rowsOf('pf1/RzEzudurxQFirFoF')).toEqual(levelsOf(/Weapon training/));
  expect(rowsOf('pf1/NwTe1Q2utlsmOAqK')).toEqual(levelsOf(/Armor mastery/));
  expect(rowsOf('pf1/McXAM1BoPHZLO1n4')).toEqual(levelsOf(/weapon mastery/));
  // Heavy Armor is the kept Foundry non-row at 7th (no table entry).
  expect(rowsOf('pf1/iqeyCQIIVnNt0p3h')).toEqual([7]);
  expect(features).toHaveLength(27);
  expect(levelsOf(/Bonus feat/)).toEqual([
    1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20,
  ]);
  expect(
    candidate.classReview.featuresByLevel.map(
      ({ classLevel, externalKey }) => ({
        classLevel,
        externalKey,
      }),
    ),
  ).toEqual(features);
  // The closure is the 27 rows' bodies, every one in the fixture.
  expect(closure.map((entry) => entry.externalKey).sort()).toEqual(
    features.map((row) => row.externalKey).sort(),
  );
});

it("re-extracts the Fighter's 28-body closure from the shared store, binds the confirmed assessment and omits the Fighter as a dependent of Weapon Training", async () => {
  const sources = await Promise.all(
    [FIGHTER, ...FEATURE_KEYS].map(async (key) => {
      const raw = JSON.parse(
        readFileSync(
          key === FIGHTER
            ? inventoryPath
            : `scripts/catalog/legal/${ownerInventory(key)}.json`,
          'utf8',
        ),
      ) as {
        candidates: {
          externalKey: string;
          source: { path: string; sha256: string };
        }[];
      };
      const row = raw.candidates.find((item) => item.externalKey === key)!;
      return [`pf1/${row.source.path}`, row.source.sha256] as const;
    }),
  );
  const tree = await materializePinnedTree(
    sources.map(([file]) => file),
    { sha256: Object.fromEntries(sources) },
  );
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: [FIGHTER, ...FEATURE_KEYS],
    });
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    const byKey = new Map(
      artifact.catalog.entries.map((entry) => [entry.externalKey, entry]),
    );
    expect(artifact.catalog.entries).toHaveLength(28);
    expect(byKey.get(FIGHTER)).toEqual(fighter);
    for (const entry of closure)
      expect(byKey.get(entry.externalKey), entry.externalKey).toEqual(entry);
    // The bounded binding over exactly the closure equals the full-corpus one.
    expect(
      buildAssessmentBinding({
        artifact,
        entry: fighter,
        requiredNotices: candidate.requiredNotices,
        evidenceIds: [candidate.evidenceId],
        ...reviewedAdmission,
      }),
    ).toEqual(bindSnapshotToCurrentNotices(candidate.currentBinding));
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === FIGHTER,
    );
    expect(assessment).toMatchObject({
      status: 'confirmed',
      requiredNotices: candidate.requiredNotices,
      rationale: expect.stringContaining('dependently omitted'),
      reviewedBy: REVIEWER,
      reviewedOn: RUN_B_REVIEWED_ON,
      ...bindSnapshotToCurrentNotices(candidate.currentBinding),
    });
    const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
    expect(gate.failures).toEqual([]);
    expect(
      gate.dependentOmissions.map((row) => [row.externalKey, row.reason]),
    ).toEqual([[FIGHTER, candidate.dependentOmission.expectedReason]]);
    expect(gate.held.map((row) => row.externalKey).sort()).toEqual(HELD);
    // Every other row is admitted: Bonus Feats and its ten increments among them.
    expect(gate.admitted.map((row) => row.externalKey).sort()).toEqual(
      [...byKey.keys()]
        .filter((key) => key !== FIGHTER && !HELD.includes(key))
        .sort(),
    );
    // A changed body invalidates the binding: the Fighter is held, not omitted.
    const edited = assessCatalogAdmission({
      artifact: {
        ...artifact,
        catalog: {
          ...artifact.catalog,
          entries: artifact.catalog.entries.map((entry) =>
            entry.externalKey === FIGHTER
              ? { ...entry, description: `${entry.description} ` }
              : entry,
          ),
        },
      },
      ...reviewedAdmission,
    });
    expect(edited.dependentOmissions).toEqual([]);
    expect(edited.held.map((row) => row.externalKey)).toContain(FIGHTER);
  } finally {
    await tree.dispose();
  }
});

it("keeps #596's own description record, assessment and evidence as recorded", () => {
  expect(findCommittedBatchOwnershipProblems(inventoryPath)).toEqual([]);
});

/** The run A or run B inventory that owns a Fighter feature. */
function ownerInventory(key: string) {
  const batches: Record<string, number> = {
    'pf1/CV8BsY3ciUb9TA1Y': 613,
    'pf1/h0Brxw6khcjlEf1T': 636,
    'pf1/5JFfSqLMCpbRmERa': 608,
    'pf1/RzEzudurxQFirFoF': 625,
    'pf1/iqeyCQIIVnNt0p3h': 637,
    'pf1/NwTe1Q2utlsmOAqK': 622,
    'pf1/McXAM1BoPHZLO1n4': 621,
  };
  return `class-abilities-${batches[key]}`;
}
