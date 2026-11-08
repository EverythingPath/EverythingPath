// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import {
  review,
  preview,
  bindingPreview,
  provenance,
} from '../fixtures/spells-527/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-527/sheet';
import { assessWithUnclearedHolds } from './uncleared-holds';

const root = resolve('tests/fixtures/spells-527');
const keys = review.candidates.map((row) => row.externalKey);
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const inputs = {
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: bindingPreview.remaps,
  curation: reviewedCuration,
};
let bounded: Awaited<ReturnType<typeof importCatalog>>;
let complete: Awaited<ReturnType<typeof importCatalog>>;
beforeAll(async () => {
  bounded = await importCatalog({ ...inputs, candidateKeys: keys });
  complete = await importCatalog({
    ...inputs,
    candidateKeys: bindingPreview.entries.map((row) => row.externalKey),
  });
});

it('reconciles the exact 100 ticket keys and byte-identical roots/context without exclusions', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(hash(keys.join('\n'))).toBe(provenance.orderedTicketKeysSha256);
  expect(provenance.rawSources.map((row) => row.externalKey)).toEqual(keys);
  expect(review.summary).toMatchObject({
    rawCandidates: 100,
    admitted: 0,
    held: 100,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  for (const row of [
    ...provenance.rawSources,
    ...provenance.dependencies,
    ...provenance.namedRuleContext,
  ]) {
    expect(
      hash(await readFile(join(inputs.systemPath, row.path))),
      row.path,
    ).toBe(row.sha256);
  }
  for (const row of provenance.manifests) {
    expect(
      hash(
        await readFile(
          join(
            row.repo === 'pf1' ? inputs.systemPath : inputs.contentPath,
            row.path,
          ),
        ),
      ),
    ).toBe(row.sha256);
  }
  for (const row of provenance.comparisonFiles) {
    expect(hash(await readFile(join(root, row.path))), row.path).toBe(
      row.sha256,
    );
  }
});

it('pins complete description, source, learnedAt and all action evidence separately from running mechanics', async () => {
  for (const row of review.candidates) {
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    );
    expect(raw.type).toBe('spell');
    expect(hash(sourceDescription(raw))).toBe(row.descriptionSha256);
    expect(row.citedSources).toEqual(raw.system.sources);
    expect(row.learnedAt).toEqual(raw.system.learnedAt);
    expect(row.mechanicsReview.metadata.actions).toEqual(raw.system.actions);
    const record = reviewedCuration.records.find(
      (item) =>
        item.externalKey === row.externalKey && item.kind === 'description',
    );
    expect(record).toMatchObject({
      status: 'checked',
      text: sourceDescription(raw),
      textSha256: row.descriptionSha256,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-09',
    });
    expect(record?.outputs.every((item) => item.kind === 'note')).toBe(true);
    expect(
      record?.diagnostics
        .filter((item) => item.kind === 'unresolved')
        .map((item) => item.text),
    ).toEqual(row.mechanicsReview.descriptionRecord.unresolved);
    expect(row.holdIds).toContain(`spells-527-whole-content-${raw._id}`);
    expect(row.noticeRequirementsComplete).toBe(false);
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
      row.source.sha256,
    );
  }
});

it('reproduces bounded extraction and reports 18 missing selected links without admitting them', () => {
  expect(bounded.catalog.entries).toEqual(preview.entries);
  expect(bounded.curation.passed).toBe(true);
  expect(bounded.curation.summary).toMatchObject({
    required: 0,
    missing: 0,
    descriptions: { candidates: 100, checked: 100, drafted: 0 },
  });
  expect(bounded.curation.unresolvedMechanics).toEqual([]);
  expect(bounded.curation.unresolvedDescriptions).toHaveLength(59);
  const gate = assessWithUnclearedHolds({
    artifact: bounded,
    ...reviewedAdmission,
  });
  expect(gate.admitted).toEqual([]);
  expect(gate.held).toHaveLength(82);
  expect(gate.failures).toHaveLength(18);
  expect(
    gate.failures.every((row) =>
      row.reason.startsWith('Broken structure or reference:'),
    ),
  ).toBe(true);
});

it('reproduces all full-source content closures and validates 100 individual assessment bindings', () => {
  const sorted = (rows: { externalKey: string }[]) =>
    [...rows].sort((a, b) => a.externalKey.localeCompare(b.externalKey));
  expect(sorted(complete.catalog.entries)).toEqual(
    sorted(bindingPreview.entries),
  );
  expect(complete.catalog.resources).toEqual(bindingPreview.resources);
  for (const row of review.candidates) {
    const entry = complete.catalog.entries.find(
      (item) => item.externalKey === row.externalKey,
    );
    const assessment = reviewedAdmission.assessments.find(
      (item) => item.externalKey === row.externalKey,
    );
    if (!entry || !assessment) throw new Error(`Missing ${row.externalKey}`);
    expect(assessment).toMatchObject({
      status: 'unresolved',
      requiredNotices: row.requiredNotices,
      reviewedOn: '2026-10-09',
      reviewedBy: 'Sol (AI curator) for the owner',
    });
    expect(assessment).toMatchObject(
      buildAssessmentBinding({
        entry,
        artifact: complete,
        ...reviewedAdmission,
        requiredNotices: row.requiredNotices,
        evidenceIds: [row.evidenceId],
      }),
    );
  }
  const gate = assessWithUnclearedHolds({
    artifact: complete,
    ...reviewedAdmission,
  });
  expect(gate.failures).toEqual([]);
  expect(
    gate.held.filter((row) => keys.includes(row.externalKey)),
  ).toHaveLength(100);
  expect(gate.admitted).toEqual([]);
});

it('enforces all 43 newly recorded minimum notice-chain holds and preserves CRB identity', () => {
  expect(review.noticeRequirements).toHaveLength(44);
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.holdId).toBeNull();
      expect(row.registryKeys).toEqual(['CRB']);
    } else {
      const hold = heldNotices.find((item) => item.id === row.holdId);
      expect(hold?.notices).toEqual([row.book, ...row.registryKeys]);
      expect(hold?.evidence).toEqual(['scripts/catalog/legal/spells-527.json']);
    }
  }
  for (const row of review.candidates) {
    for (const inherited of row.inheritedRuleNotices)
      expect(row.requiredNotices).toContain(inherited.book);
    for (const evidence of row.inheritedNoticeReview)
      expect(hash(evidence.evidence)).toBe(evidence.evidenceSha256);
  }
});

it.each([
  ['Earsend', 'PZO1117'],
  ['Shared Suffering', 'PZO1115'],
  ['Shadow Invasion', 'PZO1120'],
  ['Changestaff', 'PZO1112'],
  ['Polymorph', 'PZO1112'],
  ['Summon Greater Demon', 'PZO1116'],
  ['Vile Dog Transformation', 'PZO1123'],
  ['Crime Wave', 'PZO1115'],
] as const)(
  '%s retains its inherited %s dependency and whole-content hold',
  (name, book) => {
    const row = review.candidates.find((item) => item.name === name);
    expect(row?.requiredNotices).toContain(book);
    expect(row?.inheritedRuleNotices).toContainEqual(
      expect.objectContaining({ book }),
    );
    expect(row?.disposition).toBe('held');
  },
);

it.each([
  ['Boneshaker', 'attacks of opportunity'],
  ['Bereave', 'flanking'],
  ['Animal Purpose Training', 'Handle Animal'],
  ['Allied Cloak', 'aid another'],
  ['Soul Bind', 'wish'],
  ['Poisonous Balm', 'Detect poison'],
] as const)('%s records explicit inherited CRB %s wording', (name, phrase) => {
  const row = review.candidates.find((item) => item.name === name);
  expect(
    row?.inheritedNoticeReview.some(
      (item) => item.book === 'PZO1110' && item.evidence.includes(phrase),
    ),
  ).toBe(true);
  expect(row?.requiredNotices).toContain('PZO1110');
});

it('pins 22 direct PCGen full descriptions and 20 presentation-normalized matches', () => {
  const compared = review.candidates.flatMap((row) =>
    row.fullContentReview.directComparison
      ? [row.fullContentReview.directComparison]
      : [],
  );
  expect(compared).toHaveLength(22);
  expect(
    compared.filter(
      (row) => row.descriptionMatchesAfterPresentationNormalization,
    ),
  ).toHaveLength(20);
  for (const row of compared) {
    expect(hash(row.text)).toBe(row.lineSha256);
    expect(hash(row.baseText)).toBe(row.baseLineSha256);
    expect(row.text).toContain('|PRERULE:1,DisplayFullSpell');
  }
});

it('retains inherited identity evidence at the exact fixed PCGen file and line', async () => {
  for (const row of review.inheritedRuleIdentityEvidence.pcgenRows) {
    const filename = new URL(row.source).pathname.split('/').at(-1);
    if (!filename) throw new Error(`Missing filename: ${row.source}`);
    const file = await readFile(join(root, 'comparison', filename));
    expect(hash(file)).toBe(row.fileSha256);
    expect(file.toString('utf8').split(/\r?\n/)[row.line - 1]).toBe(row.text);
    expect(hash(row.text)).toBe(row.textSha256);
  }
});

it.each([
  ['Thundering Drums', ['PZO1110'], 'is knocked prone'],
  ['Hydrophobia', ['PZO1110'], '1d6 points of nonlethal damage'],
  ['Earsend', ['PZO1110', 'PZO1112', 'PZO1116'], 'Fly checks'],
  ['Dirge of the Victorious Knights', ['PZO1110', 'PZO1112'], 'incorporeal'],
  ['Fumbletongue', ['PZO1110'], 'verbal components'],
  ['Mad Hallucination', ['PZO1110'], 'caster level checks'],
  ['Veil of Heaven', ['PZO1110', 'PZO1112'], 'swift action'],
  ['Vile Dog Transformation', ['PZO1110'], 'summon monster'],
  ['Fiendish Wrath', ['PZO1110'], 'unarmed strikes'],
  ['Shadow Step', ['PZO1110'], 'dim light or darkness'],
  ['Human Potential', ['PZO1110'], 'bonus spells or skill ranks'],
  ['Beacon of Luck', ['PZO1110'], 'immediate action'],
  ['Siege of Trees', ['PZO1110'], 'standard action'],
  ['Scripted Hallucination', ['PZO1110'], 'while you concentrate'],
  ['Apathy', ['PZO1110'], 'holding its breath underwater'],
  ['Ectoplasmic Snare', ['PZO1112'], 'incorporeal'],
  ['Detect Fiendish Presence', ['PZO1112'], 'evil subtype'],
] as const)(
  '%s requires its published inherited-rule minima',
  (name, books, phrase) => {
    const row = review.candidates.find((item) => item.name === name);
    if (!row) throw new Error(`Missing ${name}`);
    for (const book of books) {
      expect(row.requiredNotices).toContain(book);
      expect(row.inheritedRuleNotices).toContainEqual({ book });
    }
    expect(
      row.inheritedNoticeReview.some((item) => item.evidence === phrase),
    ).toBe(true);
    expect(row.disposition).toBe('held');
    expect(row.noticeRequirementsComplete).toBe(false);
  },
);

it('pins the corrected quotes to actual YAML lines, raw body hashes and fixed PCGen identities', async () => {
  expect(
    review.candidates.reduce(
      (total, row) => total + row.inheritedRuleNotices.length,
      0,
    ),
  ).toBe(121);
  for (const row of review.candidates) {
    for (const evidence of row.inheritedNoticeReview) {
      if (evidence.sourceLine === undefined) continue;
      const sourcePath = new URL(evidence.sourceLocation).pathname.split(
        '/packs/',
      )[1];
      if (!sourcePath) throw new Error(`Missing source path for ${row.name}`);
      const bytes = await readFile(
        join(inputs.systemPath, 'packs', sourcePath),
      );
      const raw = upstreamRecord.parse(parse(bytes.toString('utf8')));
      expect(hash(bytes)).toBe(evidence.sourceFileSha256);
      expect(hash(sourceDescription(raw))).toBe(
        evidence.sourceDescriptionSha256,
      );
      expect(sourceDescription(raw)).toContain(evidence.evidence);
      const lines = bytes.toString('utf8').split('\n');
      expect(
        lines.slice(evidence.sourceLine - 1, evidence.sourceEndLine).join('\n'),
      ).toBe(evidence.sourceLineText);
      expect(hash(evidence.sourceLineText ?? '')).toBe(
        evidence.sourceLineSha256,
      );
      for (const comparator of evidence.comparisonEvidence ?? []) {
        const identity = review.inheritedRuleIdentityEvidence.pcgenRows.find(
          (item) =>
            item.source === comparator.source.split('#')[0] &&
            item.line === comparator.line,
        );
        expect(identity?.textSha256).toBe(comparator.textSha256);
        expect(identity?.fileSha256).toBe(comparator.fileSha256);
      }
    }
  }
});

it('retains Earsend’s complete inherited Skinsend body and literal Bestiary 2 page', () => {
  const row = review.candidates.find((item) => item.name === 'Earsend');
  const skinsend = row?.fullContentReview.linkedContentReview.find(
    (item) => item.name === 'Skinsend',
  );
  expect(skinsend?.descriptionText).toContain('<i>Bestiary</i> 2 295');
  for (const phrase of [
    'helpless',
    'DR 10/piercing or slashing',
    '<i>regenerate</i>',
    '<i>heal</i>',
    '<i>gentle repose</i>',
    '<i>resurrection</i>',
  ])
    expect(skinsend?.descriptionText).toContain(phrase);
  expect(row?.inheritedNoticeReview).toContainEqual(
    expect.objectContaining({
      book: 'PZO1116',
      evidence: '<i>Bestiary</i> 2 295',
      sourceLine: 38,
      sourceFileSha256:
        '45dd458645587e6a3e73e5a629686cbdb990cdaf99fc21af16b0e217ae653bcb',
    }),
  );
});

it('bounds Bestiary subtype origins with the comparator’s actual publication declaration', async () => {
  const lines = (
    await readFile(join(root, 'comparison/ce_templates.lst'), 'utf8')
  ).split('\n');
  expect(lines[1068]).toMatch(/^SOURCELONG:Bestiary\tSOURCESHORT:B1/);
  expect(lines[1101]).toContain('SOURCEPAGE:p.311');
  expect(lines[1101]).toContain('RACESUBTYPE:Evil');
  expect(lines[1111]).toContain('SOURCEPAGE:p.312');
  expect(lines[1111]).toContain('RACESUBTYPE:Incorporeal');
});

it('holds the exact APG Registry notice as well as its code without inventing an alias', () => {
  const key =
    'pf1-content/notice/7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2';
  const requirement = review.noticeRequirements.find(
    (item) => item.book === 'PZO1115',
  );
  expect(requirement?.registryKeys).toEqual([key]);
  expect(requirement?.registryIdentityEvidence[0]).toMatchObject({
    key,
    textSha256:
      '7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2',
  });
  // PZO1115 has no reviewed identity: only the notice-hold clearance's PRD
  // record (2026-10-30), counted once its review is recorded.
  expect([undefined, 'prd']).toContain(
    reviewedAdmission.registry.PZO1115?.checkedAgainst,
  );
  const notice = reviewedAdmission.registry[key];
  if (!notice) throw new Error('Missing APG notice');
  expect(hash(notice.notice)).toBe(key.split('/').at(-1));
  const entry = complete.catalog.entries.find(
    (item) => item.name === 'Magic Weapon',
  );
  const assessment = reviewedAdmission.assessments.find(
    (item) => item.externalKey === entry?.externalKey,
  );
  if (!entry || !assessment) throw new Error('Missing Magic Weapon');
  const requiredNotices = ['PZO1110', key];
  const bound = buildAssessmentBinding({
    entry,
    artifact: complete,
    ...reviewedAdmission,
    requiredNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  });
  const gate = assessWithUnclearedHolds({
    artifact: complete,
    ...reviewedAdmission,
    assessments: [
      { ...assessment, ...bound, status: 'confirmed', requiredNotices },
    ],
  });
  expect(gate.admitted).toEqual([]);
  expect(
    gate.held.find((item) => item.externalKey === entry.externalKey)?.reason,
  ).toContain('spells-527-notice-PZO1115-complete-chain');
});

it('retains the hill-giant lead as a minimum without approving all named giant origins', () => {
  const row = review.candidates.find(
    (item) => item.name === 'Summon Giant Ally I',
  );
  expect(row?.fullContentReview.unresolvedOrigins).toContainEqual(
    expect.stringContaining('hill-giant evidence is a supported minimum only'),
  );
  expect(row?.holdIds).toContain('spells-527-whole-content-d52bcya77s9kcoes');
  expect(row?.noticeHoldIds).toContain(
    'spells-527-notice-PZO1112-complete-chain',
  );
});

it('retains real metadata gaps and the incomplete Dirge without inventing values', () => {
  const dirge = review.candidates.find(
    (row) => row.name === 'Dirge of the Victorious Knights',
  );
  expect(dirge?.fullContentReview.descriptionText).toMatch(/ I<\/p>$/);
  expect(dirge?.holdIds).toContain('spells-527-dirge-truncated-description');
  expect(dirge?.mechanicsReview.outstanding).toContain(
    'Full description and any missing mechanics unavailable from permitted evidence.',
  );
  const drums = review.candidates.find(
    (row) => row.name === 'Thundering Drums',
  );
  expect(drums?.mechanicsReview.metadata.actions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        damage: { parts: [{ formula: '(min(5, @cl))d8', types: ['untyped'] }] },
      }),
    ]),
  );
  expect(drums?.fullContentReview.descriptionText).toContain('sonic damage');
  expect(drums?.mechanicsReview.discrepancies).toHaveLength(1);
  // #738 imports the descriptor the review recorded as lost.
  expect(spellFixture('Delayed Blast Fireball').detail.descriptors).toEqual([
    'fire',
  ]);
  expect(
    review.candidates.find((row) => row.name === 'Delayed Blast Fireball')
      ?.mechanicsReview.metadata.descriptors,
  ).toEqual(['fire']);
  expect(
    review.candidates
      .find((row) => row.name === 'Summon Giant Ally I')
      ?.fullContentReview.linkedContentReview.map((row) => row.name),
  ).toContain("Summon Nature's Ally VI");
});

it.each([
  ["Eagle's Splendor", 'wizard'],
  ['Human Potential', 'wizard'],
  ['Magic Weapon', 'wizard'],
  ['Beacon of Luck', 'cleric'],
] as const)(
  'recording %s preserves base statistics in both public projections',
  (name, classTag) => {
    const projected = calculateCharacterSheetProjections(
      recordedSpellSheet(name, classTag),
    );
    for (const sheet of [projected.current, projected.permanent]) {
      expect(sheet.abilities.strength.score).toBe(10);
      expect(sheet.abilities.charisma.score).toBe(10);
      expect(sheet.derivedStatistics.will.total).toBe(0);
    }
    expect(spellFixture(name).modifiers).toEqual([]);
  },
);
