// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/feats-331.json';
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
import preview from '../fixtures/feats-331/preview.json';
import { featFixtureSheet } from '../fixtures/feats-331/sheet';

const fixtureRoot = resolve('tests/fixtures/feats-331');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation,
};
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

it('reviews exactly the 100 pinned ticket keys, with content-bound individual comparison and named holds', async () => {
  const keys = review.candidates.map((candidate) => candidate.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    'b00077e36bc98091d3cface3df347295cc24ddf81598c5fb36785ccffae8d64a',
  );
  expect(
    review.candidates.filter((row) => row.disposition === 'supported/admitted'),
  ).toHaveLength(18);
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(82);
  for (const candidate of review.candidates) {
    const raw = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const record = upstreamRecord.parse(parse(raw));
    expect(`pf1/${record._id}`).toBe(candidate.externalKey);
    expect(sha256(sourceDescription(record))).toBe(candidate.descriptionSha256);
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    // #720 re-bound Intimidating Prowess after its skill-key fix, and #726
    // after its Strength formula replacement; its rationale keeps Sol's
    // original review.
    const rebound = candidate.externalKey === 'pf1/O0jbkTJcIji9BNiF';
    expect(assessment).toMatchObject({
      status: candidate.assessmentStatus,
      reviewedBy: rebound
        ? 'Opus (AI coder) for the owner'
        : 'Sol (AI curator) for the owner',
      reviewedOn: rebound ? '2026-10-14' : '2026-10-07',
      requiredNotices: candidate.requiredNotices,
    });
    if (rebound) {
      expect(assessment?.rationale).toContain(
        'Sol (AI curator) for the owner reviewed and confirmed this on 2026-10-07.',
      );
      expect(assessment?.rationale).toContain(
        're-bound it on 2026-10-14 for #726',
      );
      // The evidence records the reviewed replacement, not the old clamp.
      const current = reviewedAdmission.evidence[candidate.evidenceId]?.content;
      expect(current).not.toContain('long skill target');
      expect(current).not.toContain('Append-only overlay cannot replace it');
      expect(current).toContain('Strength modifier with no floor');
      expect(
        candidate.mechanicsReview.outstandingMechanics.join(' '),
      ).not.toContain('max(0');
    }
    expect(assessment?.evidenceFingerprints).toHaveProperty(
      candidate.evidenceId,
    );
    const evidence = reviewedAdmission.evidence[candidate.evidenceId]?.content;
    expect(evidence).toContain(candidate.source.sha256);
    expect(evidence).toContain(candidate.source.location);
    if (candidate.externalKey === 'pf1/JUBqOpBA3agQwNvu') {
      // #739 reopens Natural Spell's generic Wild Shape qualification;
      // the original complete CRB attribution evidence is unchanged.
      expect(candidate.assessmentStatus).toBe('unresolved');
      expect(candidate.disposition).toBe('held');
      expect(candidate.holdIds).toEqual([]);
      expect(candidate.missingEvidence).toBe('');
      expect(candidate.noticeRequirementsComplete).toBe(true);
      expect(assessment?.rationale).toContain('#739 fix r1 draft');
      expect(
        preview.entries.find((row) => row.externalKey === candidate.externalKey)
          ?.prerequisites,
      ).toContainEqual({
        kind: 'unchecked',
        unchecked: 'wild shape class feature',
      });
    } else if (candidate.disposition === 'held') {
      expect(candidate.holdIds.length).toBeGreaterThan(0);
      expect(candidate.missingEvidence.length).toBeGreaterThan(0);
      expect(candidate.noticeRequirementsComplete).toBe(false);
    } else {
      expect(candidate.requiredNotices).toEqual(['PZO1110']);
      expect(evidence).toContain('PCGen');
      expect(evidence).toContain(candidate.comparison?.comparisonLineSha256);
    }
    // Admission does not certify the importer's omitted choice facts.
    expect(
      preview.entries.find((row) => row.externalKey === candidate.externalKey)
        ?.detail.repeatable,
    ).toBe('unreviewed');
    expect(candidate.mechanicsReview.sourceEvidence.sha256).toBe(
      candidate.source.sha256,
    );
    expect(candidate.mechanicsReview.completeCalculation).toBe(false);
    expect(
      candidate.mechanicsReview.outstandingMechanics.length,
    ).toBeGreaterThan(0);
  }
});

it('passes required-note coverage, retains checked prose gaps and admits the 17 currently confirmed in-batch comparisons in an isolated catalog', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toHaveLength(100);
  const demonstrated = (entry: {
    externalKey: string;
    name: string;
    modifiers: unknown;
    sources?: unknown;
    situationalNotes?: unknown;
  }) => ({
    externalKey: entry.externalKey,
    name: entry.name,
    modifiers: entry.modifiers,
    sources: entry.sources,
    situationalNotes: entry.situationalNotes,
  });
  // Reduced fixtures lack the full checkout's out-of-batch link/prerequisite
  // lookup. Numerical outputs, source identities and curated Notes still match.
  expect(preview.entries.map(demonstrated)).toEqual(
    artifact.catalog.entries.map(demonstrated),
  );
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 9,
    checked: 9,
    drafted: 0,
    missing: 0,
    descriptions: { candidates: 54, checked: 54, drafted: 0 },
  });
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(19);
  for (const gap of artifact.curation.unresolvedDescriptions) {
    expect(gap.status).toBe('checked');
    expect(
      gap.diagnostics.some((diagnostic) => diagnostic.kind === 'unresolved'),
    ).toBe(true);
    expect(gap.outputs).not.toContainEqual(
      expect.objectContaining({
        text: 'Review required: replace this placeholder with readable rules text or structured outputs.',
      }),
    );
  }
  // Admission uses the tracked normalized bodies extracted with the verified
  // complete checkout's lookup. These are published-source definitions, while
  // the selected catalog still lacks out-of-batch dependency bodies.
  const catalogArtifact = {
    ...artifact,
    catalog: {
      ...artifact.catalog,
      entries: preview.entries.map((raw) => {
        const entry = importedCatalogEntrySchema.parse(raw);
        if (entry.detail.kind !== 'feat')
          throw new Error(`Unexpected batch definition: ${entry.externalKey}`);
        return { ...entry, detail: entry.detail };
      }),
    },
  };
  const gate = assessCatalogAdmission({
    artifact: catalogArtifact,
    ...reviewedAdmission,
  });
  const boundedAdmitted = review.candidates.filter(
    (row) =>
      row.disposition === 'supported/admitted' &&
      row.externalKey !== 'pf1/PrthT5jZl4t3znqR',
  );
  // Improved Lightning Reflexes references the reviewed #330 Lightning Reflexes
  // definition outside this exact selection; the full gate owns its admission.
  expect(gate.failures).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1/PrthT5jZl4t3znqR' }),
  );
  expect(gate.admitted.map((row) => row.externalKey).sort()).toEqual(
    boundedAdmitted.map((row) => row.externalKey).sort(),
  );
  expect(gate.admitted).toHaveLength(17);
  expect(gate.held).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1/JUBqOpBA3agQwNvu' }),
  );
  for (const candidate of boundedAdmitted) {
    const entry = catalogArtifact.catalog.entries.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    if (!entry || !assessment) throw new Error('Missing reviewed feat');
    expect(assessment).toMatchObject(
      buildAssessmentBinding({
        entry,
        artifact: catalogArtifact,
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }),
    );
    const changed = {
      ...entry,
      description: `${entry.description}<p>Changed benefit.</p>`,
    };
    expect(
      buildAssessmentBinding({
        entry: changed,
        artifact: {
          ...catalogArtifact,
          catalog: {
            ...catalogArtifact.catalog,
            entries: catalogArtifact.catalog.entries.map((row) =>
              row.externalKey === entry.externalKey ? changed : row,
            ),
          },
        },
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }).contentFingerprint,
    ).not.toBe(assessment.contentFingerprint);
  }
});

function modifiers(name: string) {
  const entry = preview.entries.find((row) => row.name === name);
  if (!entry) throw new Error(`Missing feat: ${name}`);
  return entry.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: entry.externalKey,
    catalogEntryId: entry.externalKey,
    entryName: entry.name,
    source: entry.externalKey,
    builtIn: false,
  }));
}

it('adds Improved Initiative +4 once in both public projections without affecting saves', () => {
  const result = calculateCharacterSheetProjections(
    featFixtureSheet({ name: 'Improved Initiative' }),
  );
  for (const projection of [result.current, result.permanent]) {
    expect(projection.derivedStatistics.initiative.total).toBe(6); // Dex 14 (+2), feat +4.
    expect(projection.derivedStatistics.reflex.total).toBe(2);
    expect(projection.derivedStatistics.fortitude.total).toBe(0);
    expect(projection.derivedStatistics.will.total).toBe(0);
    expect(
      projection.resolvedEntries.filter(
        (row) => row.entry.kind === 'feat' && row.counting,
      ),
    ).toHaveLength(1);
    expect(projection.derivedStatistics.initiative.applied).toContainEqual(
      expect.objectContaining({ source: 'pf1/Uuiu3p982omhMEPj', value: 4 }),
    );
  }
});

// CRB p. 128: "Add your Strength modifier to Intimidate skill checks in
// addition to your Charisma modifier." No floor (PCGen cr_feats.lst:112,
// BONUS:SKILL|Intimidate|STR), so a Strength penalty applies (#726).
it.each([
  [8, -1],
  [10, 0],
  [14, 2],
  [16, 3],
])(
  'adds the Strength modifier with no floor to Intimidate: Strength %i gives %i',
  (strength, modifier) => {
    const result = calculateCharacterSheetProjections(
      featFixtureSheet({ name: 'Intimidating Prowess', scores: { strength } }),
    );
    for (const projection of [result.current, result.permanent]) {
      const intimidate = projection.breakdowns['skill.int'];
      // Charisma 10 and no ranks: the feat's Strength modifier is the total.
      expect(intimidate.total).toBe(modifier);
      expect(intimidate.applied).toContainEqual(
        expect.objectContaining({
          source: 'pf1/O0jbkTJcIji9BNiF',
          value: modifier,
        }),
      );
    }
  },
);

it('keeps Mobility local to movement-provoked attacks of opportunity and stacks its dodge bonus with Dodge', () => {
  const data = [...modifiers('Dodge'), ...modifiers('Mobility')];
  expect(resolveSheet(data)['ac.other'].total).toBe(1);
  const situation = {
    local:
      'against attacks of opportunity caused by movement within or out of a threatened area',
    sheetEntryId: 'pf1/R7L4SlGRlnThqFrP',
  };
  expect(
    resolveSheet(data, { situations: [situation] })['ac.other'].total,
  ).toBe(5);
  expect(
    resolveSheet(data, {
      situations: [{ ...situation, sheetEntryId: 'unrelated-row' }],
    })['ac.other'].total,
  ).toBe(1);
  expect(
    resolveSheet(data, { situations: ['attackOfOpportunity'] })['ac.other']
      .total,
  ).toBe(1);
});

it('stacks Improved and Greater Steal only on offensive steal checks and keeps the defensive bonus separate', () => {
  const data = [...modifiers('Improved Steal'), ...modifiers('Greater Steal')];
  expect(resolveSheet(data).cmb.total).toBe(0);
  expect(resolveSheet(data).cmd.total).toBe(0);
  const offensive = resolveSheet(data, { situations: ['steal'] });
  expect(offensive.cmb.total).toBe(4);
  expect(offensive.cmd.total).toBe(0);
  const defensive = resolveSheet(data, {
    situations: [
      {
        local: 'against a steal combat maneuver',
        sheetEntryId: 'pf1/Kbuy0bkPlOYz5yaO',
      },
    ],
  });
  expect(defensive.cmb.total).toBe(0);
  expect(defensive.cmd.total).toBe(2);
});

it.each([
  [0, 1],
  [3, 1],
  [4, 2],
  [7, 2],
  [8, 3],
  [20, 6],
])(
  'uses actual BAB %i for Combat Expertise step %i only when its Routine Option is selected',
  (bab, step) => {
    const data = [
      ...modifiers('Combat Expertise'),
      {
        target: 'bab' as const,
        bonusType: 'base' as const,
        value: bab,
        sheetEntryId: 'class-baseline',
        entryName: 'Class BAB',
        source: 'class-baseline',
        builtIn: false,
      },
    ];
    const ordinary = resolveSheet(data);
    expect(ordinary['ac.other'].total).toBe(0);
    expect(ordinary['attack.melee'].total).toBe(0);
    expect(ordinary.cmb.total).toBe(0);
    const selected = resolveSheet(data, {
      routineOptions: ['pf1/NFxHebU1XhEs5WJh'],
    });
    expect(selected['ac.other'].total).toBe(step);
    expect(selected['attack.melee'].total).toBe(-step);
    expect(selected.cmb.total).toBe(-step);
    expect(selected['attack.ranged'].total).toBe(0);
  },
);

it('exposes unsupported critical-confirmation and rank-dependent skill formulas without applying substitute bonuses', () => {
  expect(modifiers('Critical Focus')).toEqual([]);
  const critical = review.candidates.find(
    (row) => row.name === 'Critical Focus',
  );
  expect(critical?.mechanicsReview.outstandingMechanics.join(' ')).toContain(
    'critConfirm',
  );
  for (const [name, targets] of [
    ['Alertness', ['skill.per', 'skill.sen']],
    ['Persuasive', ['skill.dip', 'skill.int']],
    ['Deceitful', ['skill.blf', 'skill.dis']],
    ['Deft Hands', ['skill.dev', 'skill.slt']],
  ] as const) {
    const data = modifiers(name);
    const result = resolveSheet(data);
    for (const target of targets) expect(result[target].total, name).toBe(0);
    const reviewed = review.candidates.find((row) => row.name === name);
    expect(
      reviewed?.mechanicsReview.outstandingMechanics.length,
      name,
    ).toBeGreaterThan(0);
  }
  expect(modifiers('Arcane Strike')).toEqual([]);
  expect(resolveSheet(modifiers('Arcane Strike'))['damage.melee'].total).toBe(
    0,
  );
});

it('uses Two-Weapon Defense shield AC +1 or +2 without adding both conditional states together', () => {
  const data = modifiers('Two-Weapon Defense');
  const ordinary = {
    local:
      'while wielding a double weapon or two weapons, excluding natural weapons and unarmed strikes',
    sheetEntryId: 'pf1/YDqp3yrAsuXh103W',
  };
  const defensive = {
    local:
      'while wielding a double weapon or two weapons, excluding natural weapons and unarmed strikes and fighting defensively or using total defense',
    sheetEntryId: ordinary.sheetEntryId,
  };
  expect(resolveSheet(data)['ac.shield'].total).toBe(0);
  expect(
    resolveSheet(data, { situations: [ordinary] })['ac.shield'].total,
  ).toBe(1);
  expect(
    resolveSheet(data, { situations: [defensive] })['ac.shield'].total,
  ).toBe(2);
  expect(
    resolveSheet(data, { situations: [ordinary, defensive] })['ac.shield']
      .total,
  ).toBe(2);
});
