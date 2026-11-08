// @vitest-environment node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
  collectReferences,
} from '../../scripts/catalog/admission';
import { curationSchema } from '../../scripts/catalog/curation';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { readPinned } from './pinned-sources';

// #404, MVP launch subset (#328 S4-A, extended by S4-B): Darkvision (Half-Orc),
// Adaptability and Slow Speed (Halfling), standard racial traits of the core
// races, admitted. The ticket's other keys stay remaining acceptance.
const BATCH = 404;
const REVIEWER = 'Sol (AI curator) for the owner';
const REVIEWED_ON = '2026-11-01';
const inventoryPath = `scripts/catalog/legal/racial-traits-${BATCH}.json`;
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const strings = z.array(z.string());
const pcgenRow = z.object({
  path: z.string(),
  line: z.number(),
  literalRow: z.string(),
  comparisonLineSha256: z.string(),
  comparisonFileSha256: z.string(),
});
const binding = z.object({
  contentFingerprint: z.string(),
  mappingFingerprint: z.string(),
  evidenceFingerprints: z.record(z.string(), z.string()),
  noticeFingerprints: z.record(z.string(), z.string()),
});
const candidateSchema = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('racialTrait'),
  racialTraitKind: z.literal('std'),
  disposition: z.literal('admitted'),
  assessmentStatus: z.literal('confirmed'),
  source: z.object({
    repo: z.literal('pf1-content'),
    path: z.string(),
    sha256: z.string(),
  }),
  descriptionSha256: z.string(),
  citedSources: z.array(z.object({ book: z.string(), pages: z.string() })),
  importedSources: z.array(z.object({ book: z.string(), pages: z.string() })),
  requiredNotices: strings,
  noticeRequirementsComplete: z.literal(true),
  evidenceId: z.string(),
  holdIds: z.tuple([]),
  noticeHoldIds: z.tuple([]),
  prdComparison: z.object({
    path: z.string(),
    pageSha256: z.string(),
    heading: z.string(),
    literalParagraph: z.string(),
    paragraphText: z.string(),
    paragraphSha256: z.string(),
    wordDifferences: z.array(z.object({ pinned: z.string(), prd: z.string() })),
    textMatches: z.boolean(),
  }),
  additionalComparisonLeads: z.tuple([pcgenRow]),
  inheritedRuleNotices: z.array(
    z.object({ book: z.string(), location: z.string() }),
  ),
  sourceFields: z.record(z.string(), z.unknown()),
  rationale: z.string(),
  currentBinding: binding,
  mechanicsReview: z.object({
    descriptionText: z.string(),
    curationRecords: curationSchema.shape.records,
    outstandingCalculations: strings,
    proficiencyReview: z.object({ outstandingFacts: strings }),
  }),
});
const inventory = z
  .object({
    ticket: z.string(),
    launchSubset: z.object({
      statement: z.string(),
      curatedKeys: strings,
      remainingAcceptance: strings,
      s4bKeys: strings,
      runCRequiredAlternates: strings,
    }),
    reviewedBy: z.literal(REVIEWER),
    reviewedOn: z.literal(REVIEWED_ON),
    comparisonSources: z.object({
      pcgenFiles: z.array(z.object({ path: z.string(), sha256: z.string() })),
    }),
    noticeRequirements: z.array(
      z.object({ book: z.string(), holdId: z.null(), candidates: strings }),
    ),
    counts: z.record(z.string(), z.number()),
    candidates: z.array(candidateSchema),
  })
  .parse(JSON.parse(readFileSync(inventoryPath, 'utf8')));
// The full-corpus preview's entries for these traits and the rest of their
// content closures (Adaptability's Skill Focus), with its import record.
const preview = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    closure: z.array(importedCatalogEntrySchema),
    closureRecords: z.array(z.record(z.string(), z.unknown())).default([]),
  })
  .parse(
    JSON.parse(
      readFileSync(
        `tests/fixtures/racial-traits-${BATCH}/preview.json`,
        'utf8',
      ),
    ),
  );
const candidateOf = (name: string) => {
  const row = inventory.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing candidate ${name}`);
  return row;
};
const entryOf = (name: string) => {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing entry ${name}`);
  return row;
};

it('pins each complete body, its checked description record, PRD paragraph and PCGen row', async () => {
  const files = new Map(
    inventory.comparisonSources.pcgenFiles.map((row) => [row.path, row.sha256]),
  );
  const manifest = z
    .object({
      pages: z.array(z.object({ file: z.string(), sha256: z.string() })),
    })
    .parse(JSON.parse(await readPinned('prd', 'manifest.json')));
  const differences: Record<string, unknown> = {
    'Darkvision (Half-Orc)': [],
    Adaptability: [],
    'Slow Speed (Halfling)': [],
  };
  // Elven Immunities carries the race's re-homed magic sleep Note.
  const notes: Record<string, unknown> = {};
  for (const row of inventory.candidates) {
    const body = String(
      (row.sourceFields.description as { value: string }).value,
    );
    expect(sha(body), row.name).toBe(row.descriptionSha256);
    expect(row.mechanicsReview.descriptionText).toBe(body);
    // The description pass adds no Note: the body stays the readable rule,
    // so the imported entry (and every binding over it) is unchanged.
    const [record] = row.mechanicsReview.curationRecords;
    expect(row.mechanicsReview.curationRecords).toHaveLength(1);
    expect(record).toMatchObject({
      externalKey: row.externalKey,
      kind: 'description',
      target: 'description',
      text: body,
      textSha256: row.descriptionSha256,
      status: 'checked',
      outputs: [],
      diagnostics: [],
      reviewedBy: REVIEWER,
      reviewedOn: REVIEWED_ON,
    });
    expect(
      reviewedCuration.records.find(
        (current) =>
          current.externalKey === row.externalKey &&
          current.kind === 'description',
      ),
    ).toEqual(record);
    const entry = entryOf(row.name);
    expect(entry.externalKey).toBe(row.externalKey);
    expect(entry.sources).toEqual(row.importedSources);
    expect(entry.situationalNotes ?? []).toEqual(notes[row.name] ?? []);
    // The PRD Advanced Race Guide paragraph, literally on the pinned page.
    const prd = row.prdComparison;
    const page = await readPinned('prd', prd.path);
    expect(sha(page)).toBe(prd.pageSha256);
    expect(manifest.pages.find((file) => file.file === prd.path)?.sha256).toBe(
      prd.pageSha256,
    );
    expect(page).toContain(prd.literalParagraph);
    expect(sha(prd.literalParagraph)).toBe(prd.paragraphSha256);
    expect(prd.literalParagraph).toContain(`<b>${prd.heading}</b>`);
    expect(prd.wordDifferences, row.name).toEqual(differences[row.name]);
    expect(prd.textMatches).toBe(prd.wordDifferences.length === 0);
    // PCGen's Core Essentials row for the same body.
    const [lead] = row.additionalComparisonLeads;
    const text = await readPinned('pcgen', lead.path);
    expect(sha(text)).toBe(files.get(lead.path));
    expect(sha(text)).toBe(lead.comparisonFileSha256);
    expect(text.split(/\r?\n/)[lead.line - 1]).toBe(lead.literalRow);
    expect(sha(lead.literalRow)).toBe(lead.comparisonLineSha256);
    // The row is the ability of the same name; its DESC wording is compared
    // in the launch review.
    expect(lead.literalRow.startsWith(`${prd.heading}\t`), row.name).toBe(true);
  }
});

// The trait records are not in the shared store (S4-A adds only the PCGen
// biosettings files there), so their bytes are checked against the pinned
// pf1-content checkout when it is present.
const checkout = join(homedir(), 'repos/everythingpath/sources/pf1-content');
it.skipIf(!existsSync(join(checkout, 'module.json')))(
  'matches each recorded body to its pinned pf1-content record',
  () => {
    for (const row of inventory.candidates) {
      const bytes = readFileSync(join(checkout, row.source.path));
      expect(sha(bytes), row.name).toBe(row.source.sha256);
      const raw = upstreamRecord.parse(parse(bytes.toString('utf8')));
      expect(`pf1-content/${raw._id}`).toBe(row.externalKey);
      expect(raw.name).toBe(row.name);
      expect(raw.system).toEqual(row.sourceFields);
      expect(sha(sourceDescription(raw))).toBe(row.descriptionSha256);
    }
  },
);

it('admits each trait on its own bound content under its confirmed assessment', () => {
  const inClosure = new Set(preview.closure.map((row) => row.externalKey));
  for (const entry of preview.entries)
    for (const key of collectReferences(entry as never))
      expect(inClosure.has(key), `${entry.name} -> ${key}`).toBe(true);
  const artifact = (entries: typeof preview.entries) =>
    ({
      catalog: { entries: [...entries, ...preview.closure] },
      comparison: {
        packs: [],
        records: [
          ...inventory.candidates.map((row) => ({
            repo: 'pf1-content',
            pack: 'pf-racial-traits',
            path: row.source.path,
            externalKey: row.externalKey,
            name: row.name,
            status: 'admitted',
            reason:
              'In scope for preview extraction; release admission remains pending.',
          })),
          ...preview.closureRecords,
        ],
      },
    }) as unknown as Parameters<typeof assessCatalogAdmission>[0]['artifact'];
  const authoritative = artifact(preview.entries);
  const gate = assessCatalogAdmission({
    artifact: authoritative,
    ...reviewedAdmission,
  });
  expect(gate.failures).toEqual([]);
  expect(gate.held).toEqual([]);
  expect(
    gate.admitted
      .map((row) => row.externalKey)
      .filter((key) => !inClosure.has(key)),
  ).toEqual(inventory.candidates.map((row) => row.externalKey));
  for (const row of inventory.candidates) {
    const assessment = reviewedAdmission.assessments.find(
      (current) => current.externalKey === row.externalKey,
    );
    expect(assessment).toMatchObject({
      status: 'confirmed',
      requiredNotices: row.requiredNotices,
      rationale: row.rationale,
      reviewedBy: REVIEWER,
      reviewedOn: REVIEWED_ON,
      ...bindSnapshotToCurrentNotices(row.currentBinding),
    });
    expect(
      buildAssessmentBinding({
        artifact: authoritative,
        entry: entryOf(row.name) as never,
        requiredNotices: row.requiredNotices,
        evidenceIds: [row.evidenceId],
        ...reviewedAdmission,
      }),
    ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
      row.source.sha256,
    );
  }
  // A changed body no longer matches its binding and is not admitted.
  const edited = assessCatalogAdmission({
    artifact: artifact(
      preview.entries.map((entry) => ({
        ...entry,
        description: `${entry.description} `,
      })),
    ),
    ...reviewedAdmission,
  });
  expect(
    edited.admitted.filter((row) => !inClosure.has(row.externalKey)),
  ).toEqual([]);
});

it('keeps darkvision readable and requires Bestiary 4 for the universal monster rule', () => {
  const entry = entryOf('Darkvision (Half-Orc)');
  expect(entry.modifiers).toEqual([]);
  expect(entry.unsupported).toContainEqual(
    expect.objectContaining({
      field: 'changes',
      value: {
        target: 'sensedv',
        formula: '60',
        type: 'base',
        operator: 'set',
      },
    }),
  );
  const candidate = candidateOf('Darkvision (Half-Orc)');
  expect(candidate.requiredNotices).toEqual([
    'PZO9280',
    'PZO1121',
    'PZO1127',
    'PZO1110',
  ]);
  expect(
    candidate.inheritedRuleNotices.find((row) => row.book === 'PZO1127')
      ?.location,
  ).toContain('universal-monster-rules-umr');
  // The pinned body writes Foundry's @Distance enricher; read as feet it is
  // the PRD ARG paragraph word for word.
  expect(candidate.sourceFields.description).toEqual({
    value:
      '<p><strong>Race</strong>: Half-Orc</p><hr /><p>Half-orcs can see in the dark up to @Distance[60 ft;dual].</p>',
  });
});

it('gives Adaptability a Skill Focus slot at 1st level and keeps the Halfling speed as prose', () => {
  const adaptability = entryOf('Adaptability');
  expect(adaptability.grantsSlots).toEqual([
    { kind: 'feat', count: 1, feats: ['pf1/7zJTztNW7hdaqjKc'] },
  ]);
  expect(adaptability.modifiers).toEqual([]);
  expect(preview.closure.map((row) => row.name)).toEqual(['Skill Focus']);
  const speed = entryOf('Slow Speed (Halfling)');
  expect(speed.modifiers).toEqual([]);
  expect(speed.unsupported).toContainEqual(
    expect.objectContaining({ field: 'changes' }),
  );
  expect(
    candidateOf('Slow Speed (Halfling)').mechanicsReview
      .outstandingCalculations,
  ).toEqual(['Speed: #740, owner 2026-10-31 "prose is fine for now".']);
});
