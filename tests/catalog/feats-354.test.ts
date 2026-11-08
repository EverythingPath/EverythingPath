// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  recordedPrerequisiteFacts,
  readPrerequisiteRepair739,
} from './prerequisite-audit-739';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  preview,
  provenance,
  originals,
} from '../fixtures/feats-354/data';
import {
  findCommittedBatchOwnershipProblems,
  bindSnapshotToCurrentNotices,
} from './batch-ownership';
import { reviewedFeatSheet } from '../fixtures/feats-354/sheet';

it('resolves published values with exact scopes and recipient isolation', () => {
  expect(
    resolveSheet(modifiers('Breadth of Experience'))['skill.kdu'].total,
  ).toBe(2);
  expect(resolveSheet(modifiers('Noble Impostor'))['skill.blf'].total).toBe(2);
  const eidolon = modifiers('Vigilant Eidolon');
  expect(resolveSheet(eidolon)['skill.per'].total).toBe(0);
  expect(
    resolveSheet(eidolon, { situations: [situation('Vigilant Eidolon')] })[
      'skill.per'
    ].total,
  ).toBe(4);
  expect(
    resolveSheet(eidolon, {
      situations: [
        { ...situation('Vigilant Eidolon', 1), sheetEntryId: 'another-holder' },
      ],
    })['skill.per'].total,
  ).toBe(0);
  const copy = eidolon.map((row) => ({
    ...row,
    sheetEntryId: 'copy',
    catalogEntryId: 'copy',
  }));
  expect(
    resolveSheet([...eidolon, ...copy], {
      situations: [
        situation('Vigilant Eidolon'),
        { ...situation('Vigilant Eidolon', 1), sheetEntryId: 'copy' },
      ],
    })['skill.per'].total,
  ).toBe(8);
  const delver = modifiers('Master Delver');
  expect(resolveSheet(delver)['skill.kdu'].total).toBe(2);
  expect(resolveSheet(delver)['skill.per'].total).toBe(0);
  expect(
    resolveSheet(delver, { situations: [situation('Master Delver', 1)] })[
      'skill.per'
    ].total,
  ).toBe(2);
  for (const name of [
    "Summoner's Call",
    'Coven Caster',
    'Protective Strike',
    'Shared Quarry',
    'Combat Advice',
  ])
    expect(modifiers(name)).toEqual([]);
  expect(
    calculateCharacterSheetProjections(
      reviewedFeatSheet('Breadth of Experience'),
    ).current.breakdowns['skill.kdu'].total,
  ).toBe(2);
});

it('keeps wrong-owner leads separate and records actual source overrides', () => {
  const caster = candidate(
    'Deceptive Exchange',
  ).inheritedRuleSourceEvidence.find((row) => row.name === 'Bomb');
  expect(caster?.sourceIdentity.associations).toEqual({
    present: true,
    value: { classes: ['Alchemist'] },
  });
  const song = candidate('Recovered Rage').inheritedRuleSourceEvidence.find(
    (row) => row.name === 'Raging Song',
  );
  expect(song?.sourceIdentity.associations).toEqual({
    present: true,
    value: { classes: ['Skald'] },
  });
  for (const [root, wrong] of [
    ['Marked for Glory', 'Surge'],
    ['Dervish Dance', 'Precise Strike'],
    ['Ferocious Summons', 'Ferocity'],
  ]) {
    const lead = candidate(root!).auditOnlySourceEvidence.find(
      (row) => row.name === wrong,
    );
    expect(lead?.bodyRole).toBe('rejected-lead');
    expect(lead?.completeGoverningBody).toBe(false);
  }
  expect(candidate("Treant's Call").mechanicsReview.descriptionText).toContain(
    'duration is only 10 minutes',
  );
  expect(
    candidate('Deafening Explosion').mechanicsReview.descriptionText,
  ).toContain('saving throw against the bomb');
  expect(
    candidate('Expanded Summon Monster').mechanicsReview.descriptionText,
  ).toContain('Bestiary 4 257');
});

const fixtureRoot = resolve('tests/fixtures/feats-354');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation: reviewedCuration,
  candidateKeys: provenance.candidates.map((row) => row.externalKey),
};
const sha256 = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review for ${name}`);
  return row;
}
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  return row;
}
function modifiers(name: string) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: row.externalKey,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
function situation(name: string, index = 0) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (typeof scope !== 'object' || !('local' in scope))
    throw new Error('Missing local Situation');
  return { ...scope, sheetEntryId: entry(name).externalKey };
}

it('accounts for the exact 100 pinned feats with whole descriptions, independent mechanics gaps and current content bindings', async () => {
  const keys = inputs.candidateKeys;
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(provenance.candidateKeysSha256);
  expect(review.candidates.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.entries.map((row) => row.externalKey)).toEqual(keys);
  expect(review.counts).toEqual({
    total: 100,
    admitted: 0,
    held: 100,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  for (const c of review.candidates) {
    const bytes = await readFile(
      join(inputs.contentPath, c.source.path),
      'utf8',
    );
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw.type, c.name).toBe('feat');
    expect(sha256(bytes), c.name).toBe(c.source.sha256);
    expect(`pf1-content/${raw._id}`).toBe(c.externalKey);
    expect(sourceDescription(raw)).toBe(c.mechanicsReview.descriptionText);
    expect(sha256(sourceDescription(raw))).toBe(c.descriptionSha256);
    expect(c.mechanicsReview.mappedFacts).toMatchObject({
      modifiers: entry(c.name).modifiers,
      sources: entry(c.name).sources,
      prerequisites: entry(c.name).prerequisites ?? [],
      proficiencies: [],
    });
    expect(c.mechanicsReview.curationRecords).toEqual(
      reviewedCuration.records.filter(
        (row) => row.externalKey === c.externalKey,
      ),
    );
    expect(c.mechanicsReview.outstandingCalculations.length).toBeGreaterThan(0);
    const admitted = c.disposition === 'admitted';
    expect(c.holdIds).toEqual(
      admitted ? [] : [`feats-354-whole-content-${raw._id}`],
    );
    expect(c.noticeRequirementsComplete).toBe(admitted);
    expect(
      reviewedAdmission.assessments.find(
        (row) => row.externalKey === c.externalKey,
      ),
    ).toMatchObject({
      status: admitted ? 'confirmed' : 'unresolved',
      requiredNotices: c.requiredNotices,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-11',
    });
  }
});

it('replays every reviewed output and all selected admission bindings through the public importer', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary.required).toBe(0);
  expect(artifact.curation.summary.descriptions.checked).toBe(100);
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(91);
  for (const row of artifact.catalog.entries) {
    expect(row.modifiers).toEqual(entry(row.name).modifiers);
    expect(row.situationalNotes).toEqual(entry(row.name).situationalNotes);
  }
  // The raw roots are portable. Their complete-source prerequisite identities
  // are frozen separately, because unrelated lookup records are not in this fixture.
  const bound = {
    ...artifact,
    catalog: {
      ...artifact.catalog,
      entries: preview.entries.map((raw) => {
        const row = importedCatalogEntrySchema.parse(raw);
        if (row.detail.kind !== 'feat') throw new Error('Expected feat');
        return { ...row, detail: row.detail };
      }),
    },
  };
  const gate = assessCatalogAdmission({
    artifact: bound,
    ...reviewedAdmission,
  });
  expect(gate.failures).toEqual([]);
  expect(gate.admitted.map((row) => row.externalKey)).toEqual(
    review.candidates
      .filter((c) => c.disposition === 'admitted')
      .map((c) => c.externalKey),
  );
  expect(gate.held).toHaveLength(100);
  expect(gate.dependentOmissions).toEqual([]);
  for (const row of bound.catalog.entries) {
    const c = candidate(row.name);
    const binding = buildAssessmentBinding({
      entry: row,
      artifact: bound,
      ...reviewedAdmission,
      evidence: { [c.evidenceId]: reviewedAdmission.evidence[c.evidenceId]! },
      requiredNotices: c.requiredNotices,
      evidenceIds: [c.evidenceId],
    });
    expect(binding, c.name).toEqual(
      bindSnapshotToCurrentNotices(c.currentBinding),
    );
    expect(
      reviewedAdmission.assessments.find(
        (c) => c.externalKey === row.externalKey,
      ),
    ).toMatchObject(binding);
  }
});

it('pins permitted PCGen rows and enforces each recorded complete-chain hold without adding aliases', async () => {
  for (const c of review.candidates) {
    for (const lead of [c.comparison, ...c.additionalComparisonLeads].filter(
      (row) => row !== null,
    )) {
      const bytes = await readFile(
        join(fixtureRoot, 'comparison-sources', lead.path),
        'utf8',
      );
      expect(sha256(bytes)).toBe(lead.comparisonFileSha256);
      expect(bytes.split('\n')[lead.line - 1]).toBe(lead.literalRow);
      expect(sha256(lead.literalRow)).toBe(lead.comparisonLineSha256);
    }
    for (const dependency of c.inheritedRuleNotices)
      expect(c.requiredNotices).toContain(dependency.book);
  }
  for (const notice of review.noticeRequirements) {
    if (notice.holdId) {
      const hold = heldNotices.find((row) => row.id === notice.holdId);
      expect(hold).toBeDefined();
      expect(hold?.notices).toEqual(
        expect.arrayContaining([notice.book, ...notice.registryKeys]),
      );
    }
  }
});

it('verifies full literal source identity and distinguishes governing, forward-pointer and audit-only bodies', async () => {
  for (const c of review.candidates) {
    for (const body of [
      ...c.inheritedRuleSourceEvidence,
      ...c.auditOnlySourceEvidence,
    ]) {
      const bytes = await readFile(join(fixtureRoot, body.fixturePath), 'utf8');
      const raw = upstreamRecord.parse(parse(bytes));
      expect(sha256(bytes)).toBe(body.sha256);
      expect(raw._id).toBe(body.sourceIdentity.id);
      expect(raw.name).toBe(body.sourceIdentity.name);
      expect(raw.type).toBe(body.sourceIdentity.type);
      expect(sourceDescription(raw)).toBe(body.description);
      expect(sha256(body.description)).toBe(body.descriptionSha256);
      expect(body.relationship.root).toBe(c.externalKey);
      expect(body.relationship.rule).toBe(body.externalKey);
      if (body.rawSystem) expect(raw.system).toEqual(body.rawSystem);
      if (body.metadataAudit) {
        for (const field of [
          'learnedAt',
          'actions',
          'duration',
          'changes',
          'contextNotes',
          'associations',
        ] as const) {
          const recorded = body.metadataAudit[field];
          expect(Object.hasOwn(raw.system, field)).toBe(recorded.present);
          if (recorded.present)
            expect(raw.system[field]).toEqual(recorded.value);
        }
        const learnedAt = z
          .record(z.string(), z.unknown())
          .safeParse(raw.system.learnedAt);
        const recorded = body.metadataAudit.learnedAtClass;
        expect(
          learnedAt.success && Object.hasOwn(learnedAt.data, 'class'),
        ).toBe(recorded.present);
        if (recorded.present && learnedAt.success)
          expect(learnedAt.data.class).toEqual(recorded.value);
      }
      for (const [field, recorded] of Object.entries(
        body.sourceIdentity,
      ).filter(([field]) =>
        [
          'subType',
          'associations',
          'tags',
          'description',
          'sources',
          'source',
        ].includes(field),
      )) {
        const expected = z
          .object({ present: z.boolean(), value: z.unknown().optional() })
          .parse(recorded);
        const values = raw.system;
        expect(Object.hasOwn(values, field)).toBe(expected.present);
        if (expected.present) expect(values[field]).toEqual(expected.value);
      }
    }
  }
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-354.json'),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(originals.assessments).toHaveLength(4331);
});

it('checks its candidates against the protected historical context it recorded', async () => {
  const read = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(path, 'utf8'));
  const protectedContext = z.object({
    seedKeys: z.array(z.string()),
    closureKeys: z.array(z.string()),
    definitions: z.record(z.string(), z.string()),
  });
  const currentProtection = protectedContext.parse(
    await read('tests/fixtures/feats-354/protected-context.json'),
  );
  const protectedCandidates = review.candidates.filter((row) =>
    currentProtection.closureKeys.includes(row.externalKey),
  );
  expect(protectedCandidates.map((row) => row.externalKey).sort()).toEqual(
    [
      'pf1-content/bnLLI4NPEl1jn4x6',
      'pf1-content/bvEtkDEGQkGXymCL',
      'pf1-content/c4cwES7OyxgAk6eM',
      'pf1-content/cAKU5yW6r3pBZ28g',
      'pf1-content/cGwJqj8CXTWD8QUM',
      'pf1-content/cKTRogbjMedE2Dk5',
      'pf1-content/cfMjSNPlWH9pwL55',
      'pf1-content/cyEu5hSYT23ccIYH',
      'pf1-content/dIqbQQQEANSVPlsX',
    ].sort(),
  );
  for (const row of protectedCandidates) {
    expect(row.mechanicsReview.curationRecords).toMatchObject([
      { outputs: [], diagnostics: [] },
    ]);
    expect(row.mechanicsReview.outstandingCalculations).not.toEqual([]);
  }
});

it('scopes Dilettante ranks separately to the Knowledge skill being checked', () => {
  const values = modifiers('Dilettante');
  const selected = situation('Dilettante');
  const resolved = resolveSheet(values, { situations: [selected] });
  expect(resolved['skill.kar'].total).toBe(2);
  expect(resolved['skill.kdu'].total).toBe(0);
});

it('compares all published prerequisite clauses without treating text review as executable completeness', () => {
  const statusCounts: Record<string, number> = {};
  for (const c of review.candidates) {
    const pr = c.mechanicsReview.prerequisiteReview;
    const audit = pr.parserAudit;
    expect(audit.comparedAllPublishedClauses, c.name).toBe(true);
    expect(audit.publishedClauseCount).toBe(pr.publishedClauses.length);
    expect(
      readPrerequisiteRepair739({
        batch: 'feats-354',
        externalKey: c.externalKey,
      })?.normalizedAtomsSha256 ?? audit.normalizedAtomsSha256,
    ).toBe(sha256(JSON.stringify(pr.normalizedAtoms)));
    expect(pr.normalizedAtoms).toEqual(entry(c.name).prerequisites ?? []);
    expect(pr.review).toContain('does not establish accurate parsing');
    expect(audit.boundary).toContain(
      'not repaired executable prerequisite facts',
    );
    for (const clause of pr.publishedClauses) {
      expect(clause.sourceLocation).toContain(c.source.path);
      expect(clause.sourceSha256).toBe(c.source.sha256);
      expect(clause.descriptionSha256).toBe(c.descriptionSha256);
      const stripHeading = (text: string) =>
        text
          .replace(/^Prerequisites?\s*:\s*/i, '')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/\.$/, '')
          .trim();
      expect(stripHeading(clause.text)).toBe(stripHeading(pr.authoredText));
    }
    const unchecked: string[] = [];
    const collect = (clauses: unknown[]): void => {
      for (const value of clauses) {
        const atom = z
          .object({
            unchecked: z.string().optional(),
            anyOf: z.array(z.unknown()).optional(),
          })
          .parse(value);
        if (atom.unchecked) unchecked.push(atom.unchecked);
        if (atom.anyOf) collect(atom.anyOf);
      }
    };
    collect(pr.normalizedAtoms);
    expect(pr.uncheckedAtoms).toEqual(unchecked);
    expect(c.sourceIdentityAudit.uncheckedPrerequisites).toEqual(unchecked);
    for (const clause of unchecked)
      expect(pr.outstandingFacts).toContain(
        `Uncheckable authored prerequisite: ${clause}`,
      );
    statusCounts[audit.status] = (statusCounts[audit.status] ?? 0) + 1;
  }
  expect(statusCounts).toEqual({
    misparsed: 15,
    'partially-modeled': 37,
    'fully-modeled-clause': 39,
    'no-published-prerequisites': 9,
  });
});

it('preserves original parser diagnoses and verifies their current source-backed clauses', () => {
  const cases = [
    {
      name: 'Marked for Glory',
      kind: 'false-conjunction',
      fragment: 'Great Fortitude, Iron Will, or Lightning Reflexes',
      index: 1,
      currentIndex: 0,
      atom: {
        anyOf: [
          { feat: 'pf1/fVRnBIHR4Jq6btvm' },
          { feat: 'pf1/iAbIGhm7T2OK9Brt' },
          { feat: 'pf1/0bZf3SDkvVOe2ujH' },
        ],
      },
    },
    {
      name: 'Breadth of Experience',
      kind: 'false-conjunction',
      fragment: 'Dwarf, elf, or gnome',
      index: 1,
      currentIndex: 0,
      atom: {
        anyOf: [
          { race: ['pf1/nEltI9y37rKJTeWo'] },
          { race: ['pf1/NgIhxRI0axrf3fcO'] },
          { race: ['pf1/efwHEwjvL9Z94MJI'] },
        ],
      },
    },
    {
      name: 'Pummeling Style',
      kind: 'false-conjunction',
      fragment:
        "base attack bonus +6, brawler's flurry class feature, or flurry of blows class feature",
      index: 1,
      currentIndex: 1,
      atom: {
        unchecked:
          "base attack bonus +6, brawler's flurry class feature, or flurry of blows class feature",
      },
    },
    {
      name: 'Two-Weapon Grace',
      kind: 'false-conjunction',
      fragment: 'Fencing Grace, Slashing Grace, or Starry Grace',
      index: 2,
      currentIndex: 1,
      atom: {
        anyOf: [
          { feat: 'pf1-content/VKiygqYNaKA9BkbE' },
          { feat: 'pf1-content/lHpkh9WRLYgOP5kA' },
          { feat: 'pf1-content/Gux7KiSpRLj6nKxW' },
        ],
      },
    },
    {
      name: 'Twin Thunders Flurry',
      kind: 'false-conjunction',
      fragment:
        'Improved Two-Weapon Fighting and Two-Weapon Fighting, or flurry of blows class feature',
      index: 3,
      currentIndex: 2,
      atom: {
        unchecked:
          'Improved Two-Weapon Fighting and Two-Weapon Fighting, or flurry of blows class feature',
      },
    },
    {
      name: 'Liberator',
      kind: 'false-conjunction',
      fragment:
        'You must have been enslaved for at least 6 months, or have the Imprisoned or Kidnapped background (see Ultimate Campaign)',
      index: 0,
      currentIndex: 0,
      atom: {
        unchecked:
          'You must have been enslaved for at least 6 months, or have the Imprisoned or Kidnapped background (see Ultimate Campaign)',
      },
    },
    {
      name: 'Noble Impostor',
      kind: 'lost-negation',
      fragment:
        'Must not be a member of an established family or a member of nobility',
      index: 0,
      currentIndex: 0,
      atom: {
        unchecked:
          'Must not be a member of an established family or a member of nobility',
      },
    },
    {
      name: 'Multiweapon Defense',
      kind: 'split-token',
      fragment: 'Three or more arms',
      index: 0,
      currentIndex: 0,
      atom: { unchecked: 'Three or more arms' },
    },
    {
      name: 'Consecrate Spell',
      kind: 'lost-shared-qualifier',
      fragment: 'able to prepare or cast consecrate',
      index: 1,
      currentIndex: 1,
      atom: { unchecked: 'able to prepare or cast consecrate' },
    },
    {
      name: 'Gruesome Butcher',
      kind: 'lost-shared-qualifier',
      fragment: 'or have the Child Soldier or Drafted background',
      index: 0,
      currentIndex: 0,
      atom: {
        unchecked:
          'You must have been rendered unconscious and left for dead on a battlefield between warring factions or have the Child Soldier or Drafted background',
      },
    },
    {
      name: 'Eagle Knight Candidate',
      kind: 'lost-shared-qualifier',
      fragment:
        "convince four different Eagle Knights and either a member of the People's Council or an Andoran town mayor to write letters of commendation on your behalf",
      index: 1,
      currentIndex: 1,
      atom: {
        unchecked:
          "convince four different Eagle Knights and either a member of the People's Council or an Andoran town mayor to write letters of commendation on your behalf",
      },
    },
    {
      name: 'Curse of Vengeance',
      kind: 'lost-shared-qualifier',
      fragment:
        'Ability to cast at least one spell or spell-like ability with the curse descriptor',
      index: 0,
      currentIndex: 0,
      atom: {
        unchecked:
          'Ability to cast at least one spell or spell-like ability with the curse descriptor, worshiper of Calistria',
      },
    },
    {
      name: 'Master of Knowledge',
      kind: 'wrong-choice-selector',
      fragment: 'Skill Focus (Knowledge [any])',
      index: 1,
      currentIndex: 1,
      atom: { unchecked: 'Skill Focus (Knowledge [any])' },
    },
    {
      name: 'Improved Second Chance',
      kind: 'wrong-rule-identity',
      fragment: 'Second Chance',
      index: 2,
      currentIndex: 2,
      atom: { feat: 'pf1-content/qfC7oCO4ISFFJ2Pq' },
    },
  ];
  cases.push({
    name: 'Dampen Presence',
    kind: 'wrong-rule-identity',
    fragment: 'Skill Focus (Stealth)',
    index: 0,
    currentIndex: 0,
    atom: { feat: 'pf1-content/2JWwVMFeqHnFDFSv' },
  });
  expect(cases).toHaveLength(review.correctionReview.misparsedRoots);
  for (const expected of cases) {
    const c = candidate(expected.name);
    const pr = c.mechanicsReview.prerequisiteReview;
    expect(pr.publishedClauses[0]?.text, c.name).toContain(expected.fragment);
    expect(pr.normalizedAtoms[expected.currentIndex], c.name).toMatchObject(
      expected.atom,
    );
    const finding = pr.parserAudit.findings.find(
      (row) => row.kind === expected.kind,
    );
    expect(finding, c.name).toBeDefined();
    if (!finding) throw new Error(`Missing prerequisite diagnosis: ${c.name}`);
    expect(finding.publishedFragment).toBe(expected.fragment);
    expect(finding.affectedAtomPaths).toContain(
      `normalizedAtoms[${expected.index}]`,
    );
    expect(finding.sourceLocation).toContain(c.source.path);
    expect(finding.explanation.length).toBeGreaterThan(80);
    const gap = `${finding.id}: ${finding.explanation}`;
    expect(
      recordedPrerequisiteFacts({ batch: 'feats-354', candidate: c }),
    ).toContain(gap);
    expect(
      readPrerequisiteRepair739({
        batch: 'feats-354',
        externalKey: c.externalKey,
      })?.recordedParserCalculations ??
        c.mechanicsReview.outstandingCalculations,
    ).toContain(gap);
    const record = reviewedCuration.records.find(
      (row) => row.externalKey === c.externalKey && row.kind === 'description',
    );
    if (!record) throw new Error(`Missing reviewed description: ${c.name}`);
    if (pr.parserAudit.protectedRoot) {
      expect(c.name).toBe('Pummeling Style');
      expect(record.outputs).toEqual([]);
      expect(record.diagnostics).toEqual([]);
      expect(pr.parserAudit.diagnosticLocation).toContain('inventory-only');
    } else {
      expect(record.diagnostics).toContainEqual({
        kind: 'unresolved',
        text: gap,
      });
    }
    expect(c.disposition).toBe('held');
  }
});

it('distinguishes literal governing dependencies from qualification and partial surge output evidence', () => {
  for (const [root, body] of [
    ['Dervish Dance', 'Weapon Finesse'],
    ['Marked for Glory', 'Great Fortitude'],
    ['Marked for Glory', 'Iron Will'],
    ['Planar Wanderer', 'Cartogramancer'],
    ['Focused Inspiration', 'Keen Recollection'],
    ['Improved Flexible Wizardry', 'Spell Mastery'],
    ['Two-Weapon Grace', 'Double Slice'],
    ['Two-Weapon Grace', 'Two-Weapon Rend'],
    ["Treant's Call", 'Speak with Plants'],
  ]) {
    const source = candidate(root!).inheritedRuleSourceEvidence.find(
      (row) => row.name === body,
    );
    expect(source?.bodyRole).toBe('comparison-only');
    expect(source?.completeGoverningBody).toBe(false);
    expect(source?.relationshipAudit.literalBenefitWitness).toBeNull();
  }
  const dervish = candidate('Dervish Dance');
  expect(dervish.mechanicsReview.descriptionText).toContain(
    'you can use your Dexterity modifier instead of your Strength modifier on melee attack and damage rolls',
  );
  for (const source of [
    ...candidate('Tattoo Conversion').inheritedRuleSourceEvidence,
    ...candidate('Tattoo Conversion').auditOnlySourceEvidence,
  ].filter((row) => row.name === 'Tattoo Attunement')) {
    expect(source.bodyRole).toBe('complete-governing-body');
    expect(source.relationshipAudit.literalBenefitWitness).toBe(
      'as per Tattoo Attunement',
    );
    expect(source.sourceIdentity.type).toBe('feat');
  }
  const wrong = candidate(
    'Improved Second Chance',
  ).auditOnlySourceEvidence.find(
    (row) => row.externalKey === 'pf1/mMzCbplH8uWbU5XR',
  );
  expect(wrong?.bodyRole).toBe('rejected-lead');
  expect(wrong?.sourceIdentity.associations).toEqual({
    present: true,
    value: { classes: ['Inquisitor'] },
  });
  expect(wrong?.description).toContain('Atonement');
  const right = candidate(
    'Improved Second Chance',
  ).inheritedRuleSourceEvidence.find((row) => row.name === 'Second Chance');
  expect(right?.externalKey).toBe('pf1-content/qfC7oCO4ISFFJ2Pq');
  expect(right?.sourceIdentity.associations).toEqual({ present: false });
  const marked = candidate('Marked for Glory');
  const surge = marked.additionalComparisonLeads.find((row) =>
    row.literalRow.includes('KEY:Marked for Glory Output'),
  );
  expect(surge?.path).toBe(marked.comparison?.path);
  expect(marked.comparison?.literalRow).toContain(
    'AUTOMATIC|Marked for Glory Output',
  );
  expect(surge?.literalRow).toContain('CATEGORY:Special Ability');
  expect(surge?.evidenceRole).toBe('partial-root-surge-output-comparison');
  expect(surge?.appliesToRootBody).toBe(true);
  expect(surge?.completeDirectComparison).toBe(false);
  expect(surge?.remainingBoundary).toContain('whole-content hold remains');
  expect(
    candidate('Ephemeral Tread').mechanicsReview.prerequisiteReview
      .authoredText,
  ).toContain('Lucid Dreamer');
  expect(
    candidate('Reflexive Caster').mechanicsReview.prerequisiteReview
      .authoredText,
  ).toBe('Combat Reflexes, caster level 5th');
  const roles = (auditOnly: boolean) => {
    const result: Record<string, number> = {};
    for (const c of review.candidates)
      for (const source of auditOnly
        ? c.auditOnlySourceEvidence
        : c.inheritedRuleSourceEvidence) {
        const audit = source.relationshipAudit;
        expect(audit.actualKind).toBe(source.sourceIdentity.type);
        expect(audit.actualSubType).toEqual(source.sourceIdentity.subType);
        expect(audit.actualOwnerAssociations).toEqual(
          source.sourceIdentity.associations,
        );
        expect(audit.pinnedVersion).toEqual(source.sourceIdentity.version);
        expect(audit.bodyRole).toBe(source.bodyRole);
        expect(audit.notesInstalled).toBe(0);
        if (source.bodyRole.includes('governing'))
          expect(audit.literalBenefitWitness).not.toBeNull();
        result[source.bodyRole] = (result[source.bodyRole] ?? 0) + 1;
      }
    return result;
  };
  expect(roles(false)).toEqual(review.correctionReview.supportingBodyRoles);
  expect(roles(true)).toEqual(review.correctionReview.auditOnlyBodyRoles);
  expect(review.correctionReview.supportingOccurrencesReviewed).toBe(209);
});
