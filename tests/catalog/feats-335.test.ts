// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/feats-335.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
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
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  calculateCharacterSheetProjections,
  modifierTargets,
  resolveSheet,
} from '../../src/lib/character-sheet';
import provenance from '../fixtures/feats-335/provenance.json';
import preview from '../fixtures/feats-335/preview.json';
import { heldFeatSheet } from '../fixtures/feats-335/sheet';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const fixtureRoot = resolve('tests/fixtures/feats-335');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation,
};
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

function entry(name: string) {
  const result = preview.entries.find((row) => row.name === name);
  if (!result) throw new Error(`Missing feat: ${name}`);
  return result;
}

function modifiers(name: string) {
  const feat = entry(name);
  return feat.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: feat.externalKey,
    catalogEntryId: feat.externalKey,
    entryName: feat.name,
    source: feat.externalKey,
    builtIn: false,
  }));
}

function localSituation(name: string, target: string) {
  const situation = modifiers(name).find((row) => row.target === target)
    ?.condition?.situation;
  if (typeof situation !== 'object' || !('local' in situation))
    throw new Error(`Missing local Situation: ${name}, ${target}`);
  return { ...situation, sheetEntryId: entry(name).externalKey };
}

it('preserves exactly the 100 ticket keys and byte-for-byte pinned pf1-content evidence', async () => {
  const keys = provenance.candidates.map((candidate) => candidate.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    'e43d6e81b35591793a9b72ff71777e1953e39b5c2cd465b89c239cd7debca9c3',
  );
  expect(review.candidates.map((candidate) => candidate.externalKey)).toEqual(
    keys,
  );
  expect(
    review.candidates.filter((row) => row.disposition === 'held').length === 99,
  ).toBe(true);
  for (const candidate of review.candidates) {
    const source = provenance.candidates.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(candidate.source.repo).toBe('pf1-content');
    expect(candidate.source.path).toBe(source?.source.path);
    expect(candidate.source.sha256).toBe(source?.source.sha256);
    expect(candidate.descriptionSha256).toBe(source?.descriptionSha256);
    const raw = await readFile(
      join(inputs.contentPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const record = upstreamRecord.parse(parse(raw));
    expect(`pf1-content/${record._id}`).toBe(candidate.externalKey);
    expect(sha256(sourceDescription(record))).toBe(candidate.descriptionSha256);
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    // #724 re-bound the admitted Skill Focus assessment.
    const isSkillFocus = candidate.name.startsWith('Skill Focus (');
    expect(assessment).toMatchObject({
      status: candidate.assessmentStatus,
      reviewedBy: isSkillFocus
        ? 'Opus (AI curator) for the owner'
        : 'Sol (AI curator) for the owner',
      reviewedOn: isSkillFocus ? '2026-10-14' : '2026-10-07',
      requiredNotices: candidate.requiredNotices,
    });
    expect(assessment?.evidenceFingerprints).toHaveProperty(
      candidate.evidenceId,
    );
    const evidence = reviewedAdmission.evidence[candidate.evidenceId]?.content;
    expect(evidence).toContain(candidate.source.sha256);
    expect(evidence).toContain(candidate.source.location);
    if (candidate.disposition === 'held') {
      expect(candidate.holdIds.length).toBeGreaterThan(0);
      expect(candidate.missingEvidence.length).toBeGreaterThan(0);
      expect(candidate.noticeRequirementsComplete).toBe(false);
    } else {
      expect(candidate.disposition).toBe('supported/admitted');
      expect(candidate.requiredNotices).toEqual(['PZO1110']);
      expect(candidate.noticeRequirementsComplete).toBe(true);
    }
    expect(entry(candidate.name).detail.repeatable).toBe('unreviewed');
    expect(candidate.mechanicsReview.sourceEvidence.sha256).toBe(
      candidate.source.sha256,
    );
  }
});

it('reproduces the reviewed numeric and note output with no missing required records from reduced fixtures', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toHaveLength(100);
  const demonstrated = (row: {
    externalKey: string;
    name: string;
    modifiers: unknown;
    sources?: unknown;
    situationalNotes?: unknown;
    grantsSlots?: unknown;
  }) => ({
    externalKey: row.externalKey,
    name: row.name,
    modifiers: row.modifiers,
    sources: row.sources,
    situationalNotes: row.situationalNotes,
    grantsSlots: row.grantsSlots,
  });
  // Complete-checkout link and prerequisite resolution is preserved in the
  // preview; absent dependencies in reduced evidence are not filled in.
  expect(preview.entries.map(demonstrated)).toEqual(
    artifact.catalog.entries.map(demonstrated),
  );
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 0,
    checked: 0,
    drafted: 0,
    missing: 0,
  });
  expect(artifact.curation.summary.descriptions.drafted).toBe(0);
  expect(artifact.curation.summary.descriptions.checked).toBe(
    artifact.curation.summary.descriptions.candidates,
  );
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  for (const record of curation.records.filter((row) =>
    provenance.candidates.some(
      (candidate) => candidate.externalKey === row.externalKey,
    ),
  )) {
    expect(record.status).toBe('checked');
    expect(record.outputs).not.toContainEqual(
      expect.objectContaining({
        text: 'Review required: replace this placeholder with readable rules text or structured outputs.',
      }),
    );
  }
});

it('admits only Skill Focus (Stealth), preserves all other holds and binds its actual reviewed body', async () => {
  const artifact = await importCatalog(inputs);
  const catalogArtifact = {
    ...artifact,
    catalog: {
      ...artifact.catalog,
      entries: preview.entries.map((raw) => {
        const row = importedCatalogEntrySchema.parse(raw);
        if (row.detail.kind !== 'feat')
          throw new Error(`Unexpected definition: ${row.externalKey}`);
        return { ...row, detail: row.detail };
      }),
    },
  };
  const gate = assessCatalogAdmission({
    artifact: catalogArtifact,
    ...reviewedAdmission,
  });
  expect(gate.admitted.map((row) => row.externalKey)).toEqual([
    entry('Skill Focus (Stealth)').externalKey,
  ]);
  const reported = new Set(
    [
      ...gate.admitted,
      ...gate.held,
      ...gate.failures,
      ...gate.dependentOmissions,
    ].map((row) => row.externalKey),
  );
  for (const candidate of provenance.candidates)
    expect(reported.has(candidate.externalKey), candidate.externalKey).toBe(
      true,
    );
  const bound = catalogArtifact.catalog.entries.find(
    (row) => row.name === 'Skill Focus (Stealth)',
  );
  if (!bound) throw new Error('Missing Skill Focus (Stealth) body');
  expect(gate.admitted).toContainEqual(
    expect.objectContaining({ externalKey: bound.externalKey }),
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === bound.externalKey,
  );
  if (!assessment) throw new Error('Missing Skill Focus (Stealth) assessment');
  const binding = buildAssessmentBinding({
    entry: bound,
    artifact: catalogArtifact,
    ...reviewedAdmission,
    requiredNotices: assessment.requiredNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  });
  expect(assessment).toMatchObject(binding);
  const changedBinding = buildAssessmentBinding({
    entry: {
      ...bound,
      // #724: the rank Modifier is a formula; changing it changes the body.
      modifiers: bound.modifiers.map((row) => ({
        ...row,
        bonusType: 'competence' as const,
      })),
    },
    artifact: catalogArtifact,
    ...reviewedAdmission,
    requiredNotices: assessment.requiredNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  });
  expect(changedBinding.contentFingerprint).not.toBe(
    binding.contentFingerprint,
  );
});

it.each([
  { wisdom: 14, charisma: 18, ordinary: 2, conditional: 4 },
  { wisdom: 8, charisma: 18, ordinary: -1, conditional: 3 },
  { wisdom: 14, charisma: 8, ordinary: 2, conditional: -1 },
])(
  'preserves Steadfast Personality Wisdom replacement and penalty for $wisdom/$charisma',
  ({ wisdom, charisma, ordinary, conditional }) => {
    const input = heldFeatSheet('Steadfast Personality');
    const updated = {
      ...input,
      catalogEntries: input.catalogEntries.map((row) =>
        row._id === 'base'
          ? {
              ...row,
              modifiers: row.modifiers?.map((modifier) =>
                modifier.target === 'ability.wis'
                  ? { ...modifier, value: wisdom }
                  : modifier.target === 'ability.cha'
                    ? { ...modifier, value: charisma }
                    : modifier,
              ),
            }
          : row,
      ),
    };
    for (const projection of Object.values(
      calculateCharacterSheetProjections(updated),
    ))
      expect(projection.derivedStatistics.will.total).toBe(ordinary);
    for (const projection of Object.values(
      calculateCharacterSheetProjections(updated, {
        situations: ['mindAffecting'],
      }),
    ))
      expect(projection.derivedStatistics.will.total).toBe(conditional);
    const data = modifiers('Steadfast Personality');
    expect(data).toContainEqual(
      expect.objectContaining({
        target: 'save.will',
        condition: { situation: 'mindAffecting' },
      }),
    );
  },
);

it('limits Out of the Sun +2/+4 to the feat feint and does not add both in natural sunlight', () => {
  const data = modifiers('Out of the Sun');
  const situations = data
    .filter((row) => row.target === 'skill.blf')
    .map((row) => {
      const situation = row.condition?.situation;
      if (typeof situation !== 'object' || !('local' in situation))
        throw new Error('Missing feint Situation');
      return {
        ...situation,
        sheetEntryId: entry('Out of the Sun').externalKey,
        value: row.value,
      };
    });
  expect(situations).toHaveLength(2);
  for (const situation of situations) {
    expect(situation.local).toMatch(/feint|Out of the Sun/);
    expect(
      resolveSheet(data, { situations: [situation] })['skill.blf'].total,
    ).toBe(situation.value);
    expect(
      resolveSheet(data, {
        situations: [{ ...situation, sheetEntryId: 'other' }],
      })['skill.blf'].total,
    ).toBe(0);
  }
  expect(resolveSheet(data)['skill.blf'].total).toBe(0);
  expect(resolveSheet(data, { situations })['skill.blf'].total).toBe(4);
});

it('keeps Edge Runner +4 falling checks and saves out of ordinary totals and CMD', () => {
  const data = modifiers('Edge Runner');
  const climb = localSituation('Edge Runner', 'skill.clm');
  const pit = localSituation('Edge Runner', 'saves');
  expect(climb.local).toMatch(/catch.*fall/i);
  expect(pit.local).toMatch(/pit/i);
  expect(resolveSheet(data)['skill.clm'].total).toBe(0);
  expect(resolveSheet(data, { situations: [climb] })['skill.clm'].total).toBe(
    4,
  );
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [pit] })[target].total).toBe(4);
    expect(
      resolveSheet(data, { situations: ['traps', 'spells'] })[target].total,
    ).toBe(0);
  }
  expect(
    resolveSheet(data, { situations: [pit, 'bullRush', 'trip'] }).cmd.total,
  ).toBe(0);
});

it('limits Just Out of Reach +4 dodge to reach melee from more than 5 feet away', () => {
  const data = modifiers('Just Out of Reach');
  const reach = localSituation('Just Out of Reach', 'ac');
  expect(reach.local).toMatch(/more than 5|>5/);
  expect(reach.local).toMatch(/melee.*reach|reach.*melee/);
  expect(resolveSheet(data)['ac.other'].total).toBe(0);
  expect(resolveSheet(data, { situations: [reach] })['ac.other'].total).toBe(4);
  expect(
    resolveSheet(data, { situations: [{ ...reach, sheetEntryId: 'other' }] })[
      'ac.other'
    ].total,
  ).toBe(0);
});

// #724: the rank threshold is automatic, read from Stealth's recorded ranks.
it('gives the admitted Skill Focus (Stealth) +3, or +6 at 10 Stealth ranks, with no Situation and no stacking copy', () => {
  const data = modifiers('Skill Focus (Stealth)');
  expectAutomaticSkillFocus({ modifiers: data, target: 'skill.ste' });
  expect(
    resolveSheet(data, { skillRanks: { 'skill.ste': 10 } })['skill.per'].total,
  ).toBe(0);
});

it('applies Empath -4 once when fear and mind-affecting both hold, only after opening defenses', () => {
  const data = modifiers('Empath');
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    const situations = data
      .map((row) => row.condition?.situation)
      .filter(
        (situation): situation is string | { local: string } =>
          typeof situation === 'string' ||
          (typeof situation === 'object' && 'local' in situation),
      )
      .map((situation) =>
        typeof situation === 'string'
          ? situation
          : { ...situation, sheetEntryId: entry('Empath').externalKey },
      );
    expect(situations).toHaveLength(1);
    expect(situations[0]).toMatchObject({
      local: expect.stringMatching(/fear or mind-affecting.*minute.*Empath/),
    });
    expect(
      resolveSheet(data, { situations: ['fear', 'mindAffecting'] })[target]
        .total,
    ).toBe(0);
    for (const situation of situations)
      expect(
        resolveSheet(data, { situations: [situation] })[target].total,
      ).toBe(-4);
    expect(
      resolveSheet(data, {
        situations: [...situations, ...situations, 'fear', 'mindAffecting'],
      })[target].total,
    ).toBe(-4);
  }
});

it('retains eight original source diagnoses and verifies repaired or intact advisory clauses', () => {
  const cases = [
    {
      name: "Nature's Weapons",
      sourceClause: 'Knowledge (nature) or Survival 2 ranks',
      gap: /Knowledge.*skill.rank alternative.*2.rank requirement is missing/i,
      atoms: [
        {
          feat: 'pf1/bZ1YdzkT8NtRIEJ4',
          kind: 'feat',
        },
        {
          bab: 2,
          kind: 'bab',
        },
        {
          anyOf: [
            {
              skillRanks: 'skill.kna',
              min: 2,
              kind: 'skillRanks',
            },
            {
              skillRanks: 'skill.sur',
              min: 2,
              kind: 'skillRanks',
            },
          ],
        },
      ],
    },
    {
      name: 'Conceal Aura',
      sourceClause: 'Chaotic, evil, good, or lawful alignment',
      gap: /alignment alternatives.*AND.*class features/i,
      atoms: [
        {
          kind: 'alignment',
          alignment: ['CG', 'CN', 'CE', 'LE', 'NE', 'LG', 'NG', 'LN'],
        },
      ],
    },
    {
      name: 'Improved Planar Infusion',
      sourceClause: 'Planar Infusion, character level 7th',
      gap: /oracle|revelation/i,
      atoms: [
        {
          feat: 'pf1-content/eQhruyN2Z7cfXCjL',
          kind: 'feat',
        },
        {
          characterLevel: 7,
          kind: 'characterLevel',
        },
      ],
    },
    {
      name: 'Unyielding Ferocity',
      sourceClause: 'Con 19, ferocity',
      gap: /psychic/i,
      atoms: [
        {
          ability: 'constitution',
          min: 19,
          kind: 'ability',
        },
        {
          unchecked: 'ferocity',
          kind: 'unchecked',
        },
      ],
    },
    {
      name: 'Pummeling Bully',
      sourceClause:
        'base attack bonus +9, brawler level 5th, or monk level 5th',
      gap: /mandatory|required|AND/i,
      atoms: [
        {
          feat: 'pf1/CYHloH6aEnfgdxAV',
          kind: 'feat',
        },
        {
          feat: 'pf1/gTrGPxzN054GfpkM',
          kind: 'feat',
        },
        {
          feat: 'pf1/2aTFNMs3pW6nUBlr',
          kind: 'feat',
        },
        {
          feat: 'pf1-content/cfMjSNPlWH9pwL55',
          kind: 'feat',
        },
        {
          anyOf: [
            {
              bab: 9,
              kind: 'bab',
            },
            {
              classLevel: 'pf1/iDlGMIezGuqqt8Us',
              min: 5,
              kind: 'classLevel',
            },
            {
              classLevel: 'pf1/W8dxwZ1CZiwLKsqr',
              min: 5,
              kind: 'classLevel',
            },
          ],
        },
      ],
    },
    {
      name: 'Grabbing Drag',
      sourceClause:
        'base attack bonus +8, brawler level 4th, or monk level 4th',
      gap: /mandatory|required|AND/i,
      atoms: [
        {
          feat: 'pf1-content/SfA1sbq09qa3S1GF',
          kind: 'feat',
        },
        {
          feat: 'pf1/ZmQkRk93nbHxsQSt',
          kind: 'feat',
        },
        {
          anyOf: [
            {
              bab: 8,
              kind: 'bab',
            },
            {
              classLevel: 'pf1/iDlGMIezGuqqt8Us',
              min: 4,
              kind: 'classLevel',
            },
            {
              classLevel: 'pf1/W8dxwZ1CZiwLKsqr',
              min: 4,
              kind: 'classLevel',
            },
          ],
        },
      ],
    },
    {
      name: 'Totemic Disciple',
      sourceClause:
        'no barbarian totem rage powers except those chosen with this feat or Totemic Initiate',
      gap: /already|required|bypass/i,
      atoms: [
        {
          ability: 'strength',
          min: 15,
          kind: 'ability',
        },
        {
          ability: 'dexterity',
          min: 13,
          kind: 'ability',
        },
        {
          feat: 'pf1/rMR6ahXEfYqASE7D',
          kind: 'feat',
        },
        {
          feat: 'pf1-content/smJnIdniC0at6osM',
          kind: 'feat',
        },
        {
          bab: 9,
          kind: 'bab',
        },
        {
          kind: 'unchecked',
          unchecked:
            'no barbarian totem rage powers except those chosen with this feat or Totemic Initiate',
        },
        {
          unchecked: 'nonlawful alignment',
          kind: 'unchecked',
        },
      ],
    },
    {
      name: 'Totemic Master',
      sourceClause:
        'no barbarian totem rage powers except those chosen with this feat, Totemic Disciple, or Totemic Initiate',
      gap: /fragment|duplicat/i,
      atoms: [
        {
          ability: 'strength',
          min: 17,
          kind: 'ability',
        },
        {
          ability: 'dexterity',
          min: 13,
          kind: 'ability',
        },
        {
          ability: 'wisdom',
          min: 13,
          kind: 'ability',
        },
        {
          feat: 'pf1/rMR6ahXEfYqASE7D',
          kind: 'feat',
        },
        {
          feat: 'pf1-content/23vl8taZ6srdVZQL',
          kind: 'feat',
        },
        {
          feat: 'pf1-content/smJnIdniC0at6osM',
          kind: 'feat',
        },
        {
          bab: 13,
          kind: 'bab',
        },
        {
          kind: 'unchecked',
          unchecked:
            'no barbarian totem rage powers except those chosen with this feat, Totemic Disciple, or Totemic Initiate',
        },
        {
          unchecked: 'nonlawful alignment',
          kind: 'unchecked',
        },
      ],
    },
  ];
  for (const example of cases) {
    const imported = importedCatalogEntrySchema.parse(entry(example.name));
    const candidate = review.candidates.find(
      (row) => row.name === example.name,
    );
    if (!candidate)
      throw new Error(`Missing prerequisite review: ${example.name}`);
    expect(imported.prerequisiteText, example.name).toContain(
      example.sourceClause,
    );
    expect(candidate.mechanicsReview.mappedFacts.prerequisiteText).toBe(
      imported.prerequisiteText,
    );
    expect(candidate.mechanicsReview.mappedFacts.prerequisites).toEqual(
      imported.prerequisites,
    );
    expect(imported.prerequisites, example.name).toEqual(example.atoms);
    const gap = candidate.mechanicsReview.outstandingMechanics.find((text) =>
      /^Typed prerequisite.*misparse:/.test(text),
    );
    expect(gap, example.name).toBeDefined();
    expect(gap, example.name).toMatch(example.gap);
    expect(gap, example.name).toContain(example.sourceClause);
    expect(candidate.mechanicsReview.completeCalculation, example.name).toBe(
      false,
    );
    expect(candidate.mechanicsReview.sourceEvidence.sha256).toBe(
      candidate.source.sha256,
    );
  }
  const master = importedCatalogEntrySchema.parse(entry('Totemic Master'));
  expect(
    master.prerequisites?.filter(
      (atom) => 'feat' in atom && atom.feat === 'pf1-content/23vl8taZ6srdVZQL',
    ),
  ).toHaveLength(1);
});
