// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
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
} from '../fixtures/feats-351/data';
import {
  findCommittedBatchOwnershipProblems,
  bindSnapshotToCurrentNotices,
} from './batch-ownership';
import { reviewedFeatSheet } from '../fixtures/feats-351/sheet';

import { preview as previousPreview } from '../fixtures/feats-349/data';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const fixtureRoot = resolve('tests/fixtures/feats-351');
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
function supportingRule(name: string, externalKey: string) {
  const row = candidate(name).inheritedRuleSourceEvidence.find(
    (row) => row.externalKey === externalKey,
  );
  if (!row) throw new Error(`Missing governing source ${externalKey}`);
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
    throw new Error('Missing exact local Situation');
  return { ...scope, sheetEntryId: entry(name).externalKey };
}

it('reconciles the exact 100-key inventory with byte-exact full descriptions, current inventory bindings and reviewed facts', async () => {
  const keys = provenance.candidates.map((row) => row.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(provenance.candidateKeysSha256);
  expect(review.candidates.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.entries.map((row) => row.externalKey)).toEqual(keys);
  expect(review.counts).toEqual({
    total: 100,
    admitted: 3,
    held: 97,
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
    expect(c.mechanicsReview.outstandingCalculations).not.toEqual([]);
    const admitted = c.disposition === 'admitted';
    expect(c.holdIds).toEqual(
      admitted ? [] : [`feats-351-whole-content-${raw._id}`],
    );
    expect(c.noticeRequirementsComplete).toBe(admitted);
    expect(
      reviewedAdmission.assessments.find(
        (row) => row.externalKey === c.externalKey,
      ),
    ).toMatchObject({
      status: admitted ? 'confirmed' : 'unresolved',
      requiredNotices: c.requiredNotices,
      // #724 re-bound the admitted Skill Focus assessments.
      reviewedBy: c.name.startsWith('Skill Focus (')
        ? 'Opus (AI curator) for the owner'
        : 'Sol (AI curator) for the owner',
      reviewedOn: c.name.startsWith('Skill Focus (')
        ? '2026-10-14'
        : '2026-10-10',
    });
  }
});

it('reproduces reviewed outputs and binds admission to whole imported bodies', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary.required).toBe(0);
  expect(artifact.curation.summary.descriptions.checked).toBe(100);
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  // #724 resolved the admitted Skill Focus records' rank diagnostics.
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(95);
  for (const row of artifact.catalog.entries) {
    expect(row.modifiers).toEqual(entry(row.name).modifiers);
    expect(row.situationalNotes).toEqual(entry(row.name).situationalNotes);
  }
  // The bounded fixture has no unrelated lookup records. Freeze the complete-source
  // prerequisite identities; fixture-only absence is not an attribution decision.
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
  expect(gate.admitted.map((row) => row.externalKey)).toEqual([
    ...review.candidates
      .filter((c) => c.disposition === 'admitted')
      .map((c) => c.externalKey),
  ]);
  expect(gate.held).toHaveLength(97);
  expect(gate.dependentOmissions).toEqual([]);
  for (const row of bound.catalog.entries) {
    const c = review.candidates.find((c) => c.externalKey === row.externalKey);
    if (!c) throw new Error('Missing review');
    const context = {
      entry: row,
      artifact: bound,
      ...reviewedAdmission,
      evidence: { [c.evidenceId]: reviewedAdmission.evidence[c.evidenceId]! },
      requiredNotices: c.requiredNotices,
      evidenceIds: [c.evidenceId],
    };
    const binding = buildAssessmentBinding(context);
    expect(binding, c.name).toEqual(
      bindSnapshotToCurrentNotices(c.currentBinding),
    );
    const live = reviewedAdmission.assessments.find(
      (row) => row.externalKey === c.externalKey,
    );
    expect(live, c.name).toMatchObject(binding);
    expect(live?.requiredNotices, c.name).toEqual(c.requiredNotices);
    expect(
      reviewedAdmission.assessments.find(
        (c) => c.externalKey === row.externalKey,
      ),
    ).toMatchObject(binding);
    expect(
      buildAssessmentBinding({
        ...context,
        entry: { ...row, description: row.description + ' changed' },
      }).contentFingerprint,
    ).not.toBe(binding.contentFingerprint);
  }
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-351.json'),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(originals.assessments).toHaveLength(3731);
});

it('reconstructs the fixture from reviewable files with portable temporary storage', async () => {
  const { mkdtemp, mkdir, copyFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const isolated = await mkdtemp(join(tmpdir(), 'feats-351-tracked-only-'));
  try {
    for (const file of [
      'pf1/public/system.json',
      'pf1/packs/.gitkeep',

      'pf1-content/module.json',
      ...review.candidates.map((row) => `pf1-content/${row.source.path}`),
    ]) {
      await mkdir(dirname(join(isolated, file)), { recursive: true });
      await copyFile(join(fixtureRoot, file), join(isolated, file));
    }
    const artifact = await importCatalog({
      ...inputs,
      systemPath: join(isolated, 'pf1'),
      contentPath: join(isolated, 'pf1-content'),
    });
    expect(artifact.catalog.entries.map((row) => row.externalKey)).toEqual(
      provenance.candidates.map((row) => row.externalKey),
    );
    expect(artifact.curation.summary.descriptions.checked).toBe(100);
    expect(artifact.curation.passed).toBe(true);
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});

it('pins literal partial comparisons and the complete CRB Skill Focus benefit/choice bound', async () => {
  let matched = 0;
  for (const c of review.candidates) {
    if (c.comparison) matched++;
    for (const lead of [c.comparison, ...c.additionalComparisonLeads]) {
      if (!lead) continue;
      const bytes = await readFile(
        join(fixtureRoot, 'comparison-sources', lead.path),
        'utf8',
      );
      const line = bytes.split('\n')[lead.line - 1];
      expect(sha256(bytes), c.name).toBe(lead.comparisonFileSha256);
      expect(line, c.name).toBe(lead.literalRow);
      expect(sha256(lead.literalRow)).toBe(lead.comparisonLineSha256);
      expect(lead.completeDirectComparison).toBe(
        c.disposition === 'admitted' && lead.path.includes('/core_rulebook/'),
      );
    }
    for (const support of c.inheritedRuleSourceEvidence) {
      const bytes = await readFile(
        join(fixtureRoot, support.fixturePath),
        'utf8',
      );
      expect(sha256(bytes)).toBe(support.sha256);
      expect(sourceDescription(upstreamRecord.parse(parse(bytes)))).toBe(
        support.description,
      );
    }
    for (const dep of c.inheritedRuleNotices)
      expect(c.requiredNotices, c.name).toContain(dep.book);
    for (const id of c.noticeHoldIds) {
      const hold = heldNotices.find((row) => row.id === id);
      expect(hold?.evidence).toContain('scripts/catalog/legal/feats-351.json');
    }
  }
  expect(matched).toBe(76);
  const focus = review.candidates.find(
    (row) => row.name === 'Skill Focus (Bluff)',
  );
  if (!focus?.comparison) throw new Error('Missing Skill Focus');
  const benefit = /<strong>Benefits<\/strong>:\s*([^<]+)/.exec(
    focus.mechanicsReview.descriptionText,
  )?.[1];
  const comparison = focus.comparison.literalRow
    .split('\t')
    .find((row) => row.startsWith('BENEFIT:'))
    ?.slice(8);
  // Independently recompute the direct positive body equality, not its stored flag.
  expect(benefit).toBe(comparison);
  expect(benefit).toBe(
    'You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6.',
  );
  expect(focus.comparison.literalRow.split('\t')).toEqual(
    expect.arrayContaining(['CHOOSE:SKILL|TYPE=Base', 'MULT:YES', 'STACK:NO']),
  );
  const skills = await readFile(
    join(
      fixtureRoot,
      'comparison-sources/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_skills.lst',
    ),
    'utf8',
  );
  const base = skills
    .split('\n')
    .find(
      (line) =>
        line.startsWith('Bluff\t') && line.includes('TYPE:Charisma.Base'),
    );
  expect(base).toContain('KEYSTAT:CHA');
  expect(focus.requiredNotices).toEqual(['PZO1110']);
});

it('uses the Improved Trip feat and its literal Unchained appendix rather than the Druid feat-grant collision', async () => {
  const cornugon = candidate('Cornugon Trip');
  const feat = supportingRule('Cornugon Trip', 'pf1/gTrGPxzN054GfpkM');
  const raw = upstreamRecord.parse(
    parse(await readFile(join(fixtureRoot, feat.fixturePath), 'utf8')),
  );
  expect(raw._id).toBe('gTrGPxzN054GfpkM');
  expect(feat.path).toBe('packs/feats/improved-trip.gTrGPxzN054GfpkM.yaml');
  expect(feat.sourceIdentity.type).toBe('feat');
  expect(feat.sourceIdentity.subType).toEqual({ present: false });
  expect(feat.bodyRole).toBe('complete-governing-body');
  expect(sourceDescription(raw)).toContain(
    'receive a +2 bonus on checks made to trip a foe',
  );
  expect(sourceDescription(raw)).toContain('<h3>Combat Trick</h3>');
  expect(feat.sourceFields).toEqual([
    { id: 'PZO1110', pages: '128' },
    { id: 'PZO1131', pages: '124' },
  ]);
  expect(cornugon.requiredNotices).toContain('PZO1131');
  expect(cornugon.mechanicsReview.mappedFacts.prerequisites).toContainEqual({
    kind: 'feat',
    feat: 'pf1/gTrGPxzN054GfpkM',
  });
  const rejected = cornugon.auditOnlySourceEvidence.find(
    (row) => row.externalKey === 'pf1-content/eMAPmGJ0X5DPWB7U',
  );
  expect(rejected?.bodyRole).toBe('rejected-lead');
  expect(rejected?.description).toContain('Druid Domain Power');
  expect(rejected?.completeGoverningBody).toBe(false);
  expect(
    entry('Cornugon Trip')
      .situationalNotes?.map((note) =>
        typeof note === 'string' ? note : note.text,
      )
      .join(' ') ?? '',
  ).not.toContain('Druid Domain Power');
});

it('distinguishes a Druid animal-companion grant, partial generic companion rules and the rejected Sorcerer power', () => {
  const falconry = candidate('Andoren Falconry');
  const grant = supportingRule('Andoren Falconry', 'pf1/wZ40bxNVn95BbLBV');
  const generic = supportingRule(
    'Andoren Falconry',
    'pf1-content/oczJR5oLDOOxV8mk',
  );
  expect(grant.name).toBe('Nature Bond');
  expect(grant.sourceIdentity.associations).toEqual({
    present: true,
    value: { classes: ['Druid'] },
  });
  expect(grant.description).toContain(
    'The second option is to form a close bond with an <em>animal companion</em>',
  );
  expect(grant.sourceFields).toEqual([{ id: 'PZO1110', pages: '50' }]);
  expect(generic.sourceIdentity.type).toBe('class');
  expect(generic.bodyRole).toBe('partial-governing-body');
  expect(generic.completeGoverningBody).toBe(false);
  expect(generic.description).toContain('Animal Skills');
  expect(falconry.missingGoverningRules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        role: 'missing-governing-body',
        holdId: 'feats-351-whole-content-VplA81mNUHFCs2ar',
      }),
    ]),
  );
  expect(falconry.missingGoverningRules[0]?.reason).toContain('Animal Domain');
  const rejected = falconry.auditOnlySourceEvidence.find(
    (row) => row.externalKey === 'pf1-content/IErF4V2cFhdugpgq',
  );
  expect(rejected?.description).toContain('Sorcerer Bloodline Power');
  expect(rejected?.bodyRole).toBe('rejected-lead');
  expect(falconry.disposition).toBe('held');
  expect(falconry.noticeRequirementsComplete).toBe(false);
  expect(
    entry('Andoren Falconry')
      .situationalNotes?.map((note) =>
        typeof note === 'string' ? note : note.text,
      )
      .join(' ') ?? '',
  ).not.toContain('Sorcerer Bloodline Power');
});

it('selects actual feat, paladin and generic empathy rules for the other observed collisions', () => {
  const endurance = supportingRule(
    'Endurance (Mythic)',
    'pf1/ehqx8txNRGMaNOPt',
  );
  expect(endurance.path).toBe('packs/feats/endurance.ehqx8txNRGMaNOPt.yaml');
  expect(endurance.description).toContain('You gain a +4 bonus');
  expect(endurance.description).toContain('sleep in light or medium armor');
  expect(
    supportingRule('Touched by Sacred Fire', endurance.externalKey),
  ).toEqual(expect.objectContaining({ bodyRole: 'complete-governing-body' }));
  const expertise = supportingRule(
    'Combat Expertise (Mythic)',
    'pf1/NFxHebU1XhEs5WJh',
  );
  expect(expertise.description).toContain(
    '<strong>Prerequisites</strong>: Int 13',
  );
  const lunge = supportingRule('Lunge (Mythic)', 'pf1/xq2TFr7bsYBBHOi5');
  expect(lunge.description).toContain(
    'increase the reach of your melee attacks by 5 feet',
  );
  const cleave = supportingRule('All-Consuming Swing', 'pf1/Zeq6RWYv5otvg8q7');
  expect(cleave.description).toContain('one additional attack per round');
  const great = supportingRule('All-Consuming Swing', 'pf1/6HSMdwX1VS6nZ6Zf');
  expect(great.description).toContain(
    'cannot attack an individual foe more than once',
  );
  const smite = supportingRule("Protector's Strike", 'pf1/2TsDfK0SKC8IGVx4');
  expect(smite.sourceIdentity.associations).toEqual({
    present: true,
    value: { classes: ['Paladin'] },
  });
  const empathy = supportingRule(
    'Fast Empathy (Mythic)',
    'pf1/Yr8dfM2d8JEWoYkr',
  );
  expect(empathy.sourceIdentity.associations).toEqual({
    present: true,
    value: { classes: ['Druid', 'Hunter', 'Ranger', 'Shifter'] },
  });
  expect(empathy.description).toContain(
    'class level and her <em>Charisma</em> modifier',
  );
  expect(candidate('Fast Empathy (Mythic)').requiredNotices).toEqual(
    expect.arrayContaining(['PZO1110', 'PZO1129', 'PZO1140']),
  );
  const taskmaster = supportingRule(
    'Terrorizing Display',
    'pf1-content/89GcUu0pefcNfiYd',
  );
  expect(taskmaster.path).toBe('src/pf-feats/Taskmaster_89GcUu0pefcNfiYd.yaml');
  expect(taskmaster.description).toContain(
    'the ally gains a +1 morale bonus on attack rolls',
  );
  expect(taskmaster.description).toContain('10 or more ranks in Intimidate');
  expect(candidate('Terrorizing Display').requiredNotices).not.toContain(
    'PZO9482',
  );
  for (const name of [
    'Combat Expertise (Mythic)',
    'Lunge (Mythic)',
    'All-Consuming Swing',
    "Protector's Strike",
  ]) {
    for (const summary of candidate(name).auditOnlySourceEvidence) {
      expect(summary.bodyRole).toBe('partial-summary');
      expect(summary.completeGoverningBody).toBe(false);
      expect(summary.path).toContain('pf-buffs/');
    }
  }
});

it('preserves missing-body evidence and uses race identities rather than racial subtype summaries', async () => {
  const worg = supportingRule(
    'Dog Killer, Horse Hunter',
    'pf1-content/lcFDUyu832CP1iQh',
  );
  const raw = z
    .object({ system: z.record(z.string(), z.unknown()) })
    .parse(parse(await readFile(join(fixtureRoot, worg.fixturePath), 'utf8')));
  expect(Object.hasOwn(raw.system, 'description')).toBe(false);
  expect(worg.sourceIdentity.description).toEqual({ present: false });
  expect(worg.bodyRole).toBe('missing-body');
  expect(worg.description).toBe('');
  expect(worg.descriptionSha256).toBe(sha256(''));
  expect(worg.completePinnedRecordBody).toBe(false);
  expect(worg.completeGoverningBody).toBe(false);
  for (const [root, race] of [
    ['Toxic Secretions', 'pf1/MSLlV9YnompTd6xp'],
    ['Vampiric Companion', 'pf1/puKk997wHX3kIRkR'],
    ['Realistic Likeness', 'pf1/GAoJIy6ycj3OovQT'],
    ['Catfolk Exemplar', 'pf1/VE4d35yiptv2eyxm'],
  ] as const) {
    const body = supportingRule(root, race);
    expect(body.sourceIdentity.type).toBe('race');
    expect(body.path).toContain('packs/races/');
    expect(candidate(root).auditOnlySourceEvidence[0]?.bodyRole).toBe(
      'partial-summary',
    );
  }
  const removed = review.sourceIdentityReview.removedUnusedFixture.path;
  await expect(readFile(join(fixtureRoot, removed))).rejects.toMatchObject({
    code: 'ENOENT',
  });
  expect(JSON.stringify(review.candidates)).not.toContain(removed);
});

it('retains an identity audit for every original supporting occurrence and every resolved prerequisite', async () => {
  const audit = review.sourceIdentityReview.originalSupportingOccurrenceAudit;
  expect(audit).toHaveLength(133);
  expect(
    new Set(audit.map((row) => `${row.root}/${row.originalIndex}`)).size,
  ).toBe(133);
  for (const c of review.candidates) {
    expect(c.sourceIdentityAudit.rootKind).toBe('feat');
    expect(c.sourceIdentityAudit.sourceIdentity.id).toBe(
      c.externalKey.split('/')[1],
    );
    for (const prerequisite of c.sourceIdentityAudit.resolvedPrerequisites) {
      expect(prerequisite.observedKind).toBe(prerequisite.expectedKind);
      expect(prerequisite.sourceIdentity.id).toBe(
        prerequisite.externalKey.split('/')[1],
      );
    }
    for (const source of [
      ...c.inheritedRuleSourceEvidence,
      ...c.auditOnlySourceEvidence,
    ]) {
      const bytes = await readFile(
        join(fixtureRoot, source.fixturePath),
        'utf8',
      );
      const raw = upstreamRecord.parse(parse(bytes));
      expect(sha256(bytes)).toBe(source.sha256);
      expect(raw._id).toBe(source.sourceIdentity.id);
      expect(raw.name).toBe(source.sourceIdentity.name);
      expect(raw.type).toBe(source.sourceIdentity.type);
      for (const field of [
        'subType',
        'associations',
        'tags',
        'description',
        'sources',
        'source',
      ] as const) {
        expect(source.sourceIdentity[field]).toEqual(
          Object.hasOwn(raw.system, field)
            ? { present: true, value: raw.system[field] }
            : { present: false },
        );
      }
      expect(sourceDescription(raw)).toBe(source.description);
      expect(source.completeGoverningBody).toBe(
        source.bodyRole === 'complete-governing-body',
      );
    }
  }
});

it('records the complete historical context union before optional outputs are added', async () => {
  const context = z
    .object({
      base: z.string(),
      sources: z.array(
        z.object({
          path: z.string(),
          sha256: z.string(),
          keys: z.array(z.string()),
        }),
      ),
      seedKeys: z.array(z.string()),
      closureKeys: z.array(z.string()),
      definitions: z.record(z.string(), z.string()),
      protectedRoots: z.array(z.string()),
    })
    .parse(
      JSON.parse(
        await readFile(join(fixtureRoot, 'protected-context.json'), 'utf8'),
      ),
    );
  expect(context.base).toBe('d0a692275c273537822d1eaa7df0856e307c7aa3');
  expect(
    [...new Set(context.sources.flatMap((row) => row.keys))].sort(),
  ).toEqual(context.seedKeys);
  expect(context.sources).toHaveLength(170);
  expect(context.seedKeys).toHaveLength(4175);
  expect(context.closureKeys).toHaveLength(5278);
  expect(Object.keys(context.definitions)).toHaveLength(5228);
  expect(context.protectedRoots).toEqual([
    'pf1-content/WOLneWCsXr7DBS1S',
    'pf1-content/XA3XqqTrqfRppfCF',
  ]);
  // The sources are other batches' inventories and fixtures and the shared
  // hold file; those are theirs to change, so only the recorded union is
  // checked here (#749).
  for (const key of context.protectedRoots) {
    const row = reviewedCuration.records.find((r) => r.externalKey === key);
    expect(row?.outputs).toEqual([]);
    expect(row?.diagnostics).toEqual([]);
    expect(
      review.candidates.find((c) => c.externalKey === key)?.mechanicsReview
        .outstandingCalculations.length,
    ).toBeGreaterThan(0);
  }
});

it.each([
  ['Skill Focus (Bluff)', 'skill.blf', 'Bluff', 'CHA'],
  [
    'Skill Focus (Knowledge [Arcana])',
    'skill.kar',
    'Knowledge (Arcana)',
    'INT',
  ],
  [
    'Skill Focus (Knowledge [Nature])',
    'skill.kna',
    'Knowledge (Nature)',
    'INT',
  ],
] as const)(
  // #724: the rank threshold is automatic, read from each skill's own ranks.
  'resolves %s from its own ranks, with nonstacking copies and exact CRB skill identity',
  async (name, target, skill, ability) => {
    const rows = modifiers(name);
    expectAutomaticSkillFocus({ modifiers: rows, target });
    const other = previousPreview.entries.find(
      (row) => row.name === 'Skill Focus (Linguistics)',
    );
    if (!other) throw new Error('Missing published Linguistics fixture');
    const otherRows = other.modifiers.map((raw) => ({
      ...outputSchema.options[0]
        .omit({ kind: true })
        .extend({ target: z.enum(modifierTargets) })
        .parse(raw),
      sheetEntryId: 'other',
      catalogEntryId: other.externalKey,
      source: other.externalKey,
      entryName: other.name,
      builtIn: false,
    }));
    const result = resolveSheet([...rows, ...otherRows], {
      skillRanks: { 'skill.lin': 10 },
    });
    expect(result[target].total).toBe(3);
    expect(result['skill.lin'].total).toBe(6);
    // No ranks and the skill's ability at 10: Skill Focus's +3 alone.
    expect(
      calculateCharacterSheetProjections(reviewedFeatSheet(name)).current
        .breakdowns[target].total,
    ).toBe(3);
    const candidate = review.candidates.find((c) => c.name === name);
    if (!candidate?.comparison) throw new Error('Missing complete comparison');
    const benefit = /<strong>Benefits<\/strong>:\s*([^<]+)/.exec(
      candidate.mechanicsReview.descriptionText,
    )?.[1];
    expect(benefit).toBe(
      candidate.comparison.literalRow
        .split('\t')
        .find((row) => row.startsWith('BENEFIT:'))
        ?.slice(8),
    );
    expect(candidate.comparison.literalRow.split('\t')).toEqual(
      expect.arrayContaining([
        'CHOOSE:SKILL|TYPE=Base',
        'MULT:YES',
        'STACK:NO',
      ]),
    );
    const text = await readFile(
      join(
        fixtureRoot,
        'comparison-sources/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_skills.lst',
      ),
      'utf8',
    );
    const skillRow = text
      .split('\n')
      .find((line) => line.startsWith(skill + '\t') && line.includes('.Base'));
    expect(skillRow).toContain('KEYSTAT:' + ability);
    expect(candidate.requiredNotices).toEqual(['PZO1110']);
  },
);

it('resolves published conditional values and keeps recipient/replacement mechanics separate', () => {
  for (const [name, target, value] of [
    ['Azata Style', 'ac.other', 1],
    ['Careful Flyer', 'skill.acr', 2],
    ['Warmonger', 'skill.blf', 4],
    ['Cry Challenge', 'ac.other', 4],
    ['Realistic Likeness', 'skill.dis', 10],
    ['Bullseye Shot', 'attack.ranged', 4],
    ['Swordplay Deflection', 'ac.other', 4],
    ['Demonologist', 'skill.kar', 2],
  ] as const) {
    expect(resolveSheet(modifiers(name))[target].total).toBe(0);
    expect(
      resolveSheet(modifiers(name), { situations: [situation(name)] })[target]
        .total,
    ).toBe(value);
  }
  for (const name of [
    "Protector's Strike",
    'Tenacious Transmutation',
    'Mobile Fortress',
    'Phantom Ally',
    'Tandem Evasion',
    'Improved Armor Focus',
    'All-Consuming Swing',
  ])
    expect(entry(name).modifiers, name).toEqual([]);
  expect(
    resolveSheet(modifiers('Mark of the Devoted'))['save.will'].total,
  ).toBe(1);
});

it('preserves exact literal mechanics, conflicts and inherited notice minima', () => {
  const required = (name: string) =>
    review.candidates.find((c) => c.name === name)?.requiredNotices;
  expect(required('Powerful Shape (Mythic)')).toEqual(
    expect.arrayContaining(['PZO1112', 'PZO1126']),
  );
  expect(required('Mark of the Devoted')).toContain('PZO1116');
  expect(required('Occult Conduit')).toContain('PZO1132');
  expect(required('Close-Quarters Thrower')).toContain('PZO1115');
  expect(required('Pure Legion Assault')).toContain('PZO9441');
  expect(required('Noble Scion')).toContain('PZO9272');
  expect(entry('Extreme Mood Swings').description).toContain("xˆ'1");
  expect(
    resolveSheet(modifiers('Extreme Mood Swings'), {
      situations: [situation('Extreme Mood Swings')],
    })['save.will'].total,
  ).toBe(-1);
  expect(
    resolveSheet(modifiers('Extreme Mood Swings'), {
      situations: [situation('Extreme Mood Swings', 2)],
    })['save.will'].total,
  ).toBe(-2);
  expect(entry("Winter's Strike").description).toContain('minimum 1');
  const winter = review.candidates.find((c) => c.name === "Winter's Strike");
  expect(winter?.mechanicsReview.outstandingCalculations.join(' ')).toContain(
    'Raw action uses HD rather than characterlevel',
  );
  expect(entry('Close-Quarters Thrower').description).toContain(
    '#Combat Stamina',
  );
  for (const candidate of review.candidates) {
    const body = candidate.mechanicsReview.descriptionText;
    if (body.includes('Combat Trick'))
      expect(candidate.requiredNotices).toContain('PZO1131');
    if (body.includes('Completion Benefit'))
      expect(candidate.requiredNotices).toContain('PZO1125');
    for (const inherited of candidate.inheritedRuleNotices)
      expect(candidate.requiredNotices).toContain(inherited.book);
  }
  for (const [name, text] of [
    ['Verdant Step', 'Tree stride governing rule.'],
    ['Shapeless Familiar', 'Beast shape II governing rule.'],
  ] as const) {
    expect(
      entry(name).situationalNotes?.some((note) => note.text.startsWith(text)),
    ).toBe(true);
    for (const note of entry(name).situationalNotes ?? [])
      expect(note.text.length).toBeLessThanOrEqual(4096);
  }
});
