// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { z } from 'zod';
import review from '../../scripts/catalog/legal/inherited-notices-296.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import knownNoticeHolds from '../../scripts/catalog/legal/known-notice-holds.json';
import {
  buildAssessmentBinding,
  computeFingerprint,
  type AdmissionSource,
} from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data';
import type { Section15Registry } from '../../src/lib/catalog/legal-types';
import {
  legalResources,
  reviewedAdmission,
} from '../../src/lib/catalog/reviewed-data';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { materializePinnedTree } from './pinned-sources';
import { assessWithUnclearedHolds } from './uncleared-holds';

const REVIEWER = 'Opus (AI curator) for the owner';
const REVIEWED_ON = '2026-10-13';
const EVIDENCE = 'scripts/catalog/legal/inherited-notices-296.json';
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

const strings = z.array(z.string());
const correctionSchema = z
  .object({
    id: z.string(),
    book: z.string(),
    applied: z.boolean(),
    correctedNotice: z.string().optional(),
    registryKeys: strings.default([]),
    defectiveRegistryKeys: strings.default([]),
    proposedRegistryRecord: z.object({
      key: z.string(),
      record: z.object({
        title: z.string(),
        notice: z.string(),
        checkedAgainst: z.string(),
        checkedOn: z.string(),
        aliases: strings,
        reviewStatus: z.string(),
        provenance: strings,
      }),
    }),
    contentImpact: z
      .object({
        assessments: z.number(),
        statuses: z.record(z.string(), z.number()),
        externalKeys: strings,
        heldNoticeRegistrations: strings,
        contentHoldsClearedNow: z.number(),
      })
      .passthrough(),
  })
  .passthrough();
const [ultimateCombat, occultMysteries] = z
  .tuple([correctionSchema, correctionSchema])
  .parse(review.corrections);
const defectHold = 'notice-296-ultimate-combat-author-defect';
const freePdfCodes = ['PZO9000-6E', 'PZO9000-7E', 'PZO9500-5', 'PZOPSS0000E'];

const rebinding = z
  .object({
    from: z.string(),
    to: z.string(),
    assessments: z.number(),
    otherNoticeFingerprintsChanged: z.number(),
    byBatch: z.record(z.string(), strings),
  })
  .parse(ultimateCombat.rebinding);
/** The current Registry with the unapplied Occult Mysteries promotion in memory. */
const promoted: Section15Registry = reviewedAdmissionSchema.parse({
  assessments: [],
  evidence: {},
  registry: {
    ...section15Registry,
    [occultMysteries.proposedRegistryRecord.key]:
      occultMysteries.proposedRegistryRecord.record,
  },
}).registry;

function compilationLine(line: number) {
  const row = review.sources['pf1-content'].lines.find(
    (item) => item.line === line,
  );
  if (!row) throw new Error(`Missing pf1-content line ${line}`);
  return row;
}
const authors = (notice: string) =>
  notice
    .split('Authors: ')[1]!
    .replace(/\.$/, '')
    .replace(', and ', ', ')
    .split(', ');

// Published CRB Alertness and its landed confirmed assessment probe the gate;
// the extra requirements are test-only, never attribution for these books.
const externalKey = 'pf1/Q1cY8r0Pvb66pMG0';
let artifact: AdmissionSource;
let dispose: (() => Promise<void>) | undefined;
beforeAll(async () => {
  const tree = await materializePinnedTree([
    'pf1/packs/feats/alertness.Q1cY8r0Pvb66pMG0.yaml',
  ]);
  dispose = tree.dispose;
  const imported = await importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps: [],
    curation: reviewedCuration,
  });
  artifact = {
    catalog: {
      entries: imported.catalog.entries.filter(
        (entry) => entry.externalKey === externalKey,
      ),
    },
    comparison: {
      packs: [],
      records: imported.comparison.records.filter(
        (record) => record.externalKey === externalKey,
      ),
    },
  };
  expect(artifact.catalog.entries).toHaveLength(1);
});
afterAll(() => dispose?.());

function gate(requiredNotices: string[], registry = section15Registry) {
  const existing = reviewedAdmission.assessments.find(
    (assessment) => assessment.externalKey === externalKey,
  )!;
  expect(existing).toMatchObject({
    status: 'confirmed',
    requiredNotices: ['PZO1110'],
  });
  const notices = ['PZO1110', ...requiredNotices];
  const assessment = {
    ...existing,
    requiredNotices: notices,
    ...buildAssessmentBinding({
      entry: artifact.catalog.entries[0]!,
      artifact,
      ...reviewedAdmission,
      registry,
      requiredNotices: notices,
      evidenceIds: Object.keys(existing.evidenceFingerprints),
    }),
  };
  return assessWithUnclearedHolds({
    ...reviewedAdmission,
    registry,
    artifact,
    assessments: [assessment],
  });
}

it('pins the reviewed compilation lines to the shipped pf1-content block', () => {
  expect(review).toMatchObject({
    issue: 296,
    reviewedBy: REVIEWER,
    reviewedOn: REVIEWED_ON,
    candidates: [],
    retainedExceptions: [],
  });
  const source = review.sources['pf1-content'];
  const upstream = legalResources.upstreamNotices.find(
    (notice) => notice.id === source.legalResourceId,
  )!;
  const original = legalResources.ogl.text + upstream.text;
  expect(sha256(original)).toBe(source.fileSha256);
  const lines = original.split('\n');
  expect(source.lines.map((row) => row.line)).toEqual([
    477, 478, 479, 484, 288, 290,
  ]);
  for (const row of source.lines) {
    const raw = lines[row.line - 1]!;
    expect(sha256(raw), `line ${row.line}`).toBe(row.textSha256);
    expect(raw.trim()).toBe(row.text);
    expect(sha256(row.text)).toBe(row.keySha256);
    if (row.registryKey) {
      expect(row.registryKey).toBe(`pf1-content/notice/${row.keySha256}`);
      expect(section15Registry[row.registryKey]!.notice).toBe(row.text);
    }
  }
});

it("records Ultimate Combat's defect and its corrected PRD line", () => {
  const prd = review.comparisonSources[0]!;
  expect(prd).toMatchObject({
    source: 'Paizo PRD',
    location: 'https://paizo.com/pathfinderRPG/prd/openGameLicense.html',
    // The same bytes #294 and #295 recorded.
    fileSha256:
      '9997bcddc3063d6c624e26cdb46c15fb3541ee0599d991728e20e92809a4a6c3',
  });
  const [magic, combat] = prd.copyrightLines;
  for (const line of prd.copyrightLines) {
    expect(sha256(line.text)).toBe(line.rawHtmlSha256);
    expect(sha256(line.decodedText)).toBe(line.decodedSha256);
    expect(
      line.text
        .replace(/<[^>]+>/g, '')
        .replace('&copy;', '©')
        .trim(),
    ).toBe(line.decodedText);
  }
  expect(magic!.line).toBe(385);
  expect(combat!.line).toBe(387);
  // pf1-content repeats Ultimate Magic's authors for Ultimate Combat.
  const magicAuthors = authors(compilationLine(484).text);
  expect(authors(magic!.decodedText)).toEqual(magicAuthors);
  expect(authors(compilationLine(478).text)).toEqual(magicAuthors);
  expect(authors(compilationLine(479).text)).toEqual(magicAuthors);
  expect(authors(combat!.decodedText)).not.toEqual(magicAuthors);
  expect(authors(combat!.decodedText)).toHaveLength(14);

  expect(ultimateCombat).toMatchObject({
    book: 'PZO1118',
    correctedNotice: combat!.decodedText,
    correctedNoticeSha256: combat!.decodedSha256,
    defectiveRegistryKeys: [
      compilationLine(478).registryKey,
      compilationLine(479).registryKey,
    ],
    defectiveRecordsChanged: false,
  });
  expect(ultimateCombat.proposedRegistryRecord).toMatchObject({
    key: 'PZO1118',
    record: {
      notice: combat!.decodedText,
      checkedAgainst: 'prd',
      checkedOn: REVIEWED_ON,
      reviewStatus: 'reviewed',
      aliases: [],
    },
  });
  expect(ultimateCombat.proposedRegistryRecord.record.provenance).toEqual(
    expect.arrayContaining([
      prd.location,
      `Reviewed by ${REVIEWER} on ${REVIEWED_ON}.`,
      EVIDENCE,
    ]),
  );
  // The defective compilation records keep their #293 review unchanged.
  for (const key of ultimateCombat.defectiveRegistryKeys)
    expect(section15Registry[key]).toMatchObject({
      checkedOn: '2026-10-09',
      reviewStatus: 'reviewed',
    });
  // Applied after #749: the Registry carries exactly the reviewed record.
  expect(ultimateCombat.applied).toBe(true);
  expect(section15Registry.PZO1118).toEqual(
    ultimateCombat.proposedRegistryRecord.record,
  );
});

it("keeps Occult Mysteries on the book's own line, never Numeria's", () => {
  const own = compilationLine(290);
  const numeria = compilationLine(288);
  expect(own.registryKey).toBe(occultMysteries.registryKeys[1]);
  expect(section15Registry.PZO9269!.notice).toBe(own.text);
  expect(section15Registry.PZO9269!.notice).not.toBe(numeria.text);
  expect(numeria.text).toContain('Numeria, Land of Fallen Stars');
  expect(occultMysteries.proposedRegistryRecord).toMatchObject({
    key: 'PZO9269',
    record: {
      notice: own.text,
      checkedAgainst: 'pf1-content',
      checkedOn: REVIEWED_ON,
      reviewStatus: 'reviewed',
      aliases: [],
    },
  });
  // The seed's earlier provenance is kept ahead of this review.
  expect(
    occultMysteries.proposedRegistryRecord.record.provenance.slice(0, 3),
  ).toEqual(section15Registry.PZO9269!.provenance.slice(0, 3));
  // Left unchanged on purpose; duplicate identities are reconciled in #737.
  expect(occultMysteries.applied).toBe(false);
  expect(section15Registry.PZO9269!.reviewStatus).toBe('unreviewed');
});

it('enforces each new hold and keeps the five named holds', () => {
  expect(review.holds.map((hold) => hold.id)).toEqual([
    defectHold,
    ...freePdfCodes.map((code) => `notice-296-free-pdf-untranscribed-${code}`),
  ]);
  for (const hold of review.holds)
    expect(heldNotices.find((item) => item.id === hold.id)).toEqual({
      id: hold.id,
      notices: [hold.noticeKey, ...hold.relatedNoticeKeys],
      evidence: [EVIDENCE],
    });
  expect(review.holds[0]).toMatchObject({
    noticeKey: ultimateCombat.defectiveRegistryKeys[0],
    relatedNoticeKeys: [ultimateCombat.defectiveRegistryKeys[1]],
  });
  expect(review.transcriptionGaps.map((gap) => gap.book)).toEqual(freePdfCodes);
  for (const code of freePdfCodes)
    expect(Object.hasOwn(section15Registry, code)).toBe(false);
  expect(review.preservedNamedHolds.map((hold) => hold.id)).toEqual(
    knownNoticeHolds.map((hold) => hold.id),
  );
  expect(knownNoticeHolds.map((hold) => hold.id)).toEqual([
    'dynamite-comics',
    'thornkeep',
    'refuge-of-time',
    'horror-realms',
    'shattered-star-4',
  ]);
  for (const named of review.preservedNamedHolds) {
    const group = knownNoticeHolds.find((hold) => hold.id === named.id)!;
    expect(named.productCodes).toEqual(group.productCodes);
    for (const id of named.enforcedHoldIds)
      expect(heldNotices.some((hold) => hold.id === id)).toBe(true);
  }
});

// Keys a later launch re-assessment confirmed after this audit: #516
// whole-content wave 3 (2026-11-04) confirms Unerring Weapon (PZO1118).
const laterConfirmed = new Set(['pf1/09juighnblqlqwro']);

it('accounts for the content that requires each corrected code', () => {
  for (const [code, correction] of [
    ['PZO1118', ultimateCombat],
    ['PZO9269', occultMysteries],
  ] as const) {
    const impact = correction.contentImpact;
    expect(impact.contentHoldsClearedNow).toBe(0);
    expect(impact.statuses).toEqual({ unresolved: impact.assessments });
    expect(impact.externalKeys).toHaveLength(impact.assessments);
    for (const key of impact.externalKeys)
      expect(
        reviewedAdmission.assessments.find((row) => row.externalKey === key),
        key,
      ).toMatchObject({
        status: laterConfirmed.has(key) ? 'confirmed' : 'unresolved',
        requiredNotices: expect.arrayContaining([code]),
      });
    for (const id of impact.heldNoticeRegistrations)
      expect(heldNotices.find((hold) => hold.id === id)?.notices, id).toContain(
        code,
      );
  }
  const current = computeFingerprint(section15Registry.PZO1118);
  expect(ultimateCombat.contentImpact).toMatchObject({
    assessments: 519,
    storedNoticeFingerprints: [current],
    heldNoticeRegistrationsByFamily: { feats: 35, spells: 31 },
    fullPreview: {
      heldCandidatesRequiring: 617,
      missingNoticeAfter: 0,
      newlyAdmitted: 0,
    },
  });
  expect(ultimateCombat.contentImpact.heldNoticeRegistrations).toHaveLength(66);
  // Every re-bound assessment, listed by the batch whose inventory owns it.
  expect(rebinding).toMatchObject({
    from: computeFingerprint(null),
    to: current,
    assessments: 519,
    otherNoticeFingerprintsChanged: 0,
  });
  const listed = Object.values(rebinding.byBatch).flat();
  expect([...listed].sort()).toEqual(ultimateCombat.contentImpact.externalKeys);
  expect(Object.keys(rebinding.byBatch)).toHaveLength(66);
  for (const key of listed)
    expect(
      reviewedAdmission.assessments.find((row) => row.externalKey === key)!
        .noticeFingerprints.PZO1118,
      key,
    ).toBe(current);
  for (const [batch, keys] of Object.entries(rebinding.byBatch)) {
    const inventory = z
      .object({
        candidates: z.array(
          z.union([
            z.string(),
            z.object({ externalKey: z.string() }).passthrough(),
          ]),
        ),
      })
      .parse(
        JSON.parse(readFileSync(`scripts/catalog/legal/${batch}.json`, 'utf8')),
      );
    const owned = new Set(
      inventory.candidates.map((row) =>
        typeof row === 'string' ? row : row.externalKey,
      ),
    );
    for (const key of keys)
      expect(owned.has(key), `${batch} ${key}`).toBe(true);
  }
  expect(occultMysteries.contentImpact).toMatchObject({ assessments: 9 });
  expect(occultMysteries.contentImpact.heldNoticeRegistrations).toHaveLength(8);
  expect(review.bindingChanges.assessmentsRebound).toBe(519);
  expect(review.counts).toMatchObject({
    registryRecordsBefore: 450,
    registryRecordsAfter: 451,
    newHolds: 5,
    clearedHolds: 0,
    newAdmissions: 0,
  });
});

it('publishes the corrected Ultimate Combat notice and never invents a missing one', () => {
  const requiredNotices = ['PZO1110', 'PZO1118', 'PZO9269', ...freePdfCodes];
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices,
  });
  expect(page.permanentNoticeSuperset).toContainEqual({
    id: 'registry:PZO1118',
    title: 'Pathfinder Roleplaying Game Ultimate Combat',
    text: ultimateCombat.correctedNotice,
    provenance: ultimateCombat.proposedRegistryRecord.record.provenance,
  });
  // The upstream block keeps pf1-content's defective line verbatim.
  expect(
    page.permanentNoticeSuperset.find((notice) => notice.id === 'pf1-content')!
      .text,
  ).toContain(compilationLine(479).text);
  expect(page.outstandingNotices).toHaveLength(5);
  expect(page.outstandingNotices).toEqual(
    expect.arrayContaining([
      {
        code: 'PZO9269',
        title: section15Registry.PZO9269!.title,
        reason: 'unreviewed',
      },
      ...freePdfCodes.map((code) => ({ code, title: code, reason: 'missing' })),
    ]),
  );
  const later = buildLegalPageData({
    registry: {},
    resources: legalResources,
    permanentNoticeSuperset: page.permanentNoticeSuperset,
    requiredNotices: [],
  });
  expect(later.permanentNoticeSuperset).toEqual(page.permanentNoticeSuperset);
  // The unapplied Occult Mysteries promotion would publish the book's own line.
  expect(
    buildLegalPageData({
      registry: promoted,
      resources: legalResources,
      permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
      requiredNotices: ['PZO9269'],
    }).permanentNoticeSuperset,
  ).toContainEqual(
    expect.objectContaining({
      id: 'registry:PZO9269',
      text: compilationLine(290).text,
    }),
  );
});

it('keeps every probe held while the chain, defect and free-PDF holds stand', () => {
  expect(gate([])).toMatchObject({
    admitted: [{ externalKey }],
    held: [],
  });
  const chained = gate(['PZO1118']).held[0]!;
  expect(chained.missingNotices).toEqual([]);
  expect(chained.reason).toMatch(/^Notice holds: PZO1118 \(/);
  for (const id of ultimateCombat.contentImpact.heldNoticeRegistrations)
    expect(chained.reason).toContain(id);
  expect(chained.reason).not.toContain(defectHold);

  for (const key of ultimateCombat.defectiveRegistryKeys)
    expect(gate([key]).held[0]!.reason).toContain(defectHold);

  const occult = gate(['PZO9269'], promoted).held[0]!;
  expect(occult.missingNotices).toEqual([]);
  for (const id of occultMysteries.contentImpact.heldNoticeRegistrations)
    expect(occult.reason).toContain(id);
  expect(gate(['PZO9269']).held[0]!.reason).toBe(
    'Missing or unreviewed required notices: PZO9269.',
  );

  // PZO9000-6E and PZO9000-7E have reviewed PCGen blocks since their
  // confirmations' review was recorded (2026-10-31), so their free-PDF
  // transcription holds hold them; the other two still have no identity.
  const pcgenReviewed = ['PZO9000-6E', 'PZO9000-7E'];
  for (const code of freePdfCodes) {
    const { reason } = gate([code]).held[0]!;
    if (pcgenReviewed.includes(code)) {
      expect(reason).toMatch(new RegExp(`^Notice holds: pcgen:${code} \\(`));
      expect(reason).toContain(`notice-296-free-pdf-untranscribed-${code}`);
    } else
      expect(reason).toBe(`Missing or unreviewed required notices: ${code}.`);
  }
});
