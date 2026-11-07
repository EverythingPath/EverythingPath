// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { importCatalog } from '../../scripts/catalog/import';
import {
  computeFingerprint,
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import {
  review,
  spells,
  preview,
  bindingPreview,
  provenance,
} from '../fixtures/spells-535/data';
import { spellFixture, recordedSpellSheet } from '../fixtures/spells-535/sheet';
import {
  findCommittedBatchOwnershipProblems,
  findRecordedBindingProblems,
} from './batch-ownership';
const root = resolve('tests/fixtures/spells-535');
const keys = spells.map((r) => r.externalKey);
const hash = (s: string | Buffer) =>
  createHash('sha256').update(s).digest('hex');
const inputs = {
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: bindingPreview.remaps,
  curation: reviewedCuration,
};
it('retains independently reviewed manual effects even for protected historical roots', () => {
  expect(review.mechanicsSummary.protectedRoots).toBe(31);
  for (const row of spells) {
    const record = reviewedCuration.records.find(
      (r) => r.externalKey === row.externalKey && r.kind === 'description',
    );
    expect(record).toMatchObject({
      text: row.fullContentReview.descriptionText,
      status: 'checked',
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-11',
    });
    expect(record?.outputs).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.reviewedOptionalOutputs,
    );
    expect(record?.diagnostics.map((d) => d.text)).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.outstanding,
    );
    expect(row.mechanicsReview.outstanding).toHaveLength(1);
    expect(row.mechanicsReview.governingNoteCount).toBe(0);
    for (const output of row.mechanicsReview.reviewedOptionalOutputs) {
      expect(output.kind).toBe('note');
      if (output.kind === 'note')
        expect(output.text.length).toBeLessThanOrEqual(4096);
    }
  }
});
it.each([
  ['Sensory Amplifier', 'additional 2d6 points of damage'],
  ['Shield Other', '+1 deflection bonus to AC'],
  ['Charnel House', 'DC 10 Acrobatics check'],
  ['Sanctify Armor', 'maximum +5 at 20th level'],
  ['Decollate', 'head has AC 7, hardness 5, and 10 hit points'],
  ['Gift of the Deep', 'swim speed increases by 20 feet'],
  ['Fire Shield', 'maximum +15'],
  ['Ant Haul', 'carrying capacity triples'],
  ['Sirocco', '4d6 fire damage +1 point per caster level'],
])(
  'preserves %s literal quantities without making a recorded Spell a running effect',
  (name, value) => {
    expect(
      spells.find((r) => r.name === name)?.mechanicsReview.manualRule,
    ).toContain(value);
    const spell = spellFixture(name);
    const tag = Object.keys(spell.detail.levels)[0];
    if (!tag) throw new Error(name);
    const projections = calculateCharacterSheetProjections(
      recordedSpellSheet(name, tag),
    );
    for (const result of [projections.current, projections.permanent]) {
      expect(result.abilities.strength.score).toBe(10);
      expect(result.abilities.dexterity.score).toBe(10);
      expect(result.spellEffects).toEqual([]);
    }
  },
);
it('retains real action/body contradictions and manually scopes the weapon CMD and opportunity bonus', () => {
  expect(
    spells
      .find((r) => r.name === 'Scamper')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('end of companion turn');
  expect(
    spells
      .find((r) => r.name === 'Caustic Eruption')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('types=[untyped]');
  expect(
    spells
      .find((r) => r.name === 'Shapechange')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('beast form IV');
  const blade = spells.find((r) => r.name === 'Blade of Dark Triumph');
  expect(blade?.mechanicsReview.sharedSituations).toEqual(['disarm', 'sunder']);
  expect(
    blade?.mechanicsReview.reviewedOptionalOutputs
      .filter((n) => n.kind === 'note' && n.situation)
      .map((n) => (n.kind === 'note' ? n.text : '')),
  ).toEqual([
    'For the caster’s CMD against attacks directed at the fiendish boon weapon only: You gain a profane bonus to your CMD against disarm and sunder attacks directed at your boon weapon; this bonus is equal to half your caster level.',
    'For the caster’s CMD against attacks directed at the fiendish boon weapon only: You gain a profane bonus to your CMD against disarm and sunder attacks directed at your boon weapon; this bonus is equal to half your caster level.',
  ]);
  expect(
    spells.find((r) => r.name === 'Perfect Placement')?.mechanicsReview
      .localSituations,
  ).toEqual(['against attacks of opportunity']);
});
it('checks literal governing chains and consistent direct/indirect roles against the actual intermediate owner body', async () => {
  for (const row of spells)
    for (const body of row.mechanicsReview.governingSpellBodies) {
      expect(body.relationship.reason).toBe(
        body.relationshipAudit.relationshipBasis,
      );
      expect(body.relationshipAudit.path[0]?.externalKey).toBe(row.externalKey);
      const path = body.relationshipAudit.path;
      expect(path[path.length - 1]?.externalKey).toBe(body.externalKey);
      expect(body.relationship.kind).toBe(
        path.length > 2 ? 'indirect-governing-spell' : 'direct-governing-spell',
      );
      const raw = upstreamRecord.parse(
        parse((await readFile(join(root, body.fixturePath))).toString()),
      );
      expect(sourceDescription(raw)).toBe(body.descriptionText);
      expect(raw.name).toBe(body.name);
      const owner = [...provenance.rawSources, ...provenance.dependencies].find(
        (r) => r.externalKey === body.rootEvidenceOwner,
      );
      if (!owner) throw new Error(body.rootEvidenceOwner);
      const ownerRaw = upstreamRecord.parse(
        parse((await readFile(join(root, 'pf1', owner.path))).toString()),
      );
      expect(
        sourceDescription(ownerRaw).slice(
          body.rootEvidenceStart,
          body.rootEvidenceEnd,
        ),
      ).toBe(body.rootEvidence);
      expect(body.noteCount).toBe(0);
    }
  const object = spells.find((r) => r.name === 'Object Possession, Greater');
  expect(
    object?.mechanicsReview.governingSpellBodies
      .find((r) => r.name === 'Possession')
      ?.relationshipAudit.path.map((r) => r.name),
  ).toEqual([
    'Object Possession, Greater',
    'Object Possession',
    'Object Possession, Lesser',
    'Possession',
  ]);
  const id = spells.find((r) => r.name === 'Id Insinuation III');
  expect(id?.mechanicsReview.governingSpellBodies.map((r) => r.name)).toEqual([
    'Id Insinuation I',
  ]);
});
it('pins standard feat and owned class identities and keeps the fiendish weapon excerpt partial', async () => {
  const bodies = spells.flatMap((r) => r.inheritedRuleSourceEvidence);
  expect(bodies).toHaveLength(22);
  for (const body of bodies) {
    const bytes = await readFile(join(root, body.fixturePath));
    expect(hash(bytes)).toBe(body.sha256);
    const raw = upstreamRecord.parse(parse(bytes.toString()));
    expect(raw.name).toBe(body.name);
    expect(raw._id).toBe(body.externalKey.split('/')[1]);
    if (body.ruleKind === 'class-feature') {
      expect(raw.type).toBe('feat');
      const system = z
        .object({
          subType: z.string(),
          associations: z.object({ classes: z.array(z.string()) }),
        })
        .parse(raw.system);
      expect(system.subType).toBe('classFeat');
      expect(system.associations.classes).toContain(body.owningClassOrRace);
    } else if (body.ruleKind === 'feat') {
      expect(raw.type).toBe('feat');
      expect(Object.hasOwn(raw.system, 'subType')).toBe(false);
      const standardFeatIds: Record<string, string> = {
        Multiattack: 'pf1/RmhtvELGu73iR8yh',
        'Multiweapon Fighting': 'pf1-content/9KPpZm9saA3MAlfX',
        'Blind-Fight': 'pf1/pmAO1Sni8xx71pLF',
        'Improved Grapple': 'pf1/ZmQkRk93nbHxsQSt',
      };
      expect(body.externalKey).toBe(standardFeatIds[body.name]);
    }
    expect(body.relationship.reason).toBe(
      body.relationshipAudit.relationshipBasis,
    );
    expect(hash(body.descriptionText)).toBe(body.descriptionSha256);
    if (body.completeGoverningBody)
      expect(sourceDescription(raw)).toBe(body.descriptionText);
    else {
      expect(body.role).toBe('partial-governing-body');
      expect(sourceDescription(raw)).toContain(body.descriptionText);
    }
  }
  const gift = spells.find((r) => r.name === 'Gift of the Deep');
  expect(
    gift?.inheritedRuleSourceEvidence.map((r) => [
      r.name,
      r.ruleKind,
      r.owningClassOrRace,
    ]),
  ).toEqual([
    ['Multiattack', 'feat', null],
    ['Multiweapon Fighting', 'feat', null],
    ['Blind-Fight', 'feat', null],
    ['Improved Grapple', 'feat', null],
  ]);
  for (const name of ['Blind-Fight', 'Improved Grapple']) {
    const feat = gift?.inheritedRuleSourceEvidence.find((r) => r.name === name);
    if (name === 'Blind-Fight') {
      expect(feat?.descriptionText).not.toContain('Prerequisites');
      expect(feat?.descriptionText).toContain(
        'reroll your miss chance percentile roll one time',
      );
      expect(feat?.descriptionText).toContain('spend 2 stamina points');
    } else {
      expect(feat?.descriptionText).toContain('Dex 13');
      expect(feat?.descriptionText).toContain('Improved Unarmed Strike');
      expect(feat?.descriptionText).toContain(
        '+2 bonus to your Combat Maneuver Defense',
      );
    }

    expect(feat?.descriptionText).toContain('Combat Trick');
    expect(gift?.requiredNotices).toContain('PZO1131');
  }
  const blade = spells.find((r) => r.name === 'Blade of Dark Triumph');
  const boon = blade?.inheritedRuleSourceEvidence.find(
    (r) => r.name === 'Fiendish Boon',
  );
  expect(boon).toMatchObject({
    ruleKind: 'class-feature',
    owningClassOrRace: 'Antipaladin',
    role: 'partial-governing-body',
    completeGoverningBody: false,
  });
  expect(boon?.descriptionText).toContain('maximum of +6 at 20th level');
  expect(boon?.descriptionText).not.toContain('second type');
  expect(
    blade?.inheritedRuleSourceEvidence.find((r) => r.name === 'Ghost Touch')
      ?.ruleKind,
  ).toBe('weapon-item-ability');
  const auras =
    spells.find((r) => r.name === 'Widen Auras')?.inheritedRuleSourceEvidence ??
    [];
  expect(auras).toHaveLength(12);
  expect(new Set(auras.map((r) => r.owningClassOrRace))).toEqual(
    new Set(['Paladin', 'Antipaladin']),
  );
  expect(auras.every((r) => r.ruleKind === 'class-feature')).toBe(true);
});
let selected: Awaited<ReturnType<typeof importCatalog>>,
  context: Awaited<ReturnType<typeof importCatalog>>;
beforeAll(async () => {
  selected = await importCatalog({ ...inputs, candidateKeys: keys });
  context = await importCatalog({
    ...inputs,
    candidateKeys: bindingPreview.candidateKeys,
  });
});
it('reviews exactly the ordered100 Spell keys and keeps literal source identities intact', async () => {
  expect(review.ticket).toBe(535);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(hash(keys.join('\n'))).toBe(provenance.orderedTicketKeysSha256);
  expect(review.summary).toEqual({
    rawCandidates: 100,
    spellDefinitions: 100,
    held: 100,
    admitted: 0,
    excluded: 0,
    dependentOmissions: 0,
    unsupportedProseOnly: 0,
    recordLevel35Holds: 0,
  });
  const tagged: string[] = [];
  const domainOnly: string[] = [];
  for (const row of spells) {
    const bytes = await readFile(join(inputs.systemPath, row.source.path));
    const raw = upstreamRecord.parse(parse(bytes.toString()));
    expect(hash(bytes)).toBe(row.source.sha256);
    expect(raw._key).toBe('!items!' + row.externalKey.split('/')[1]);
    expect(raw.type).toBe('spell');
    expect(sourceDescription(raw)).toBe(row.fullContentReview.descriptionText);
    expect(hash(sourceDescription(raw))).toBe(row.descriptionSha256);
    expect(raw.system).toEqual(row.fullContentReview.completeRawSystem);
    expect(raw.system.sources).toEqual(row.citedSources);
    const entry = selected.catalog.entries.find(
      (e) => e.externalKey === row.externalKey,
    );
    if (entry?.detail.kind !== 'spell') throw new Error(row.name);
    expect(entry.detail.levels).toEqual(
      z
        .object({ class: z.record(z.string(), z.number()).optional() })
        .parse(raw.system.learnedAt).class ?? {},
    );
    if (
      !Object.hasOwn(
        z.record(z.string(), z.unknown()).parse(raw.system.learnedAt),
        'class',
      )
    ) {
      domainOnly.push(row.name);
      expect(entry.detail.levels).toEqual({});
    }
    expect(entry.modifiers).toEqual([]);
    expect(row.mechanicsReview.outstanding.length).toBeGreaterThan(0);
    if (
      z
        .array(z.string())
        .parse(raw.system.tags ?? [])
        .includes('3.5')
    ) {
      tagged.push(row.name);
      expect(row.holdIds).toContain(
        'spells-535-' + raw._id + '-record-level3.5tag',
      );
    }
  }
  expect(tagged).toEqual([]);
  expect(domainOnly).toEqual([]);
});
it('enforces every inherited notice minimum and preserves current source-bound assessments', () => {
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.registryKeys).toEqual(['CRB']);
      expect(requirement.holdId).toBeNull();
    } else
      expect(
        heldNotices.find((r) => r.id === requirement.holdId),
      ).toMatchObject({
        notices: expect.arrayContaining([
          requirement.book,
          ...requirement.registryKeys,
        ]),
        evidence: ['scripts/catalog/legal/spells-535.json'],
      });
  }
  for (const row of spells) {
    for (const dep of row.inheritedNoticeReview) {
      expect(row.requiredNotices).toContain(dep.book);
      expect(hash(dep.evidence)).toBe(dep.evidenceSha256);
    }
    expect(row.requiredNotices).toContain('PZO1131');
    const entry = context.catalog.entries.find(
      (e) => e.externalKey === row.externalKey,
    );
    if (!entry) throw new Error(row.name);
    const binding = buildAssessmentBinding({
      entry,
      artifact: context,
      ...reviewedAdmission,
      requiredNotices: row.requiredNotices,
      evidenceIds: [row.evidenceId],
    });
    expect(
      reviewedAdmission.assessments.find(
        (r) => r.externalKey === row.externalKey,
      ),
    ).toMatchObject({
      ...binding,
      status: 'unresolved',
      requiredNotices: row.requiredNotices,
    });
    expect(
      findRecordedBindingProblems({
        recorded: row.binding,
        current: binding,
        evidenceId: row.evidenceId,
      }),
      row.name,
    ).toEqual([]);
  }
  const gate = assessCatalogAdmission({
    artifact: context,
    ...reviewedAdmission,
  });
  expect(gate.admitted.filter((r) => keys.includes(r.externalKey))).toEqual([]);
  expect(computeFingerprint(selected.catalog.entries)).toBe(
    computeFingerprint(preview.entries),
  );
  expect(computeFingerprint(context.catalog.entries)).toBe(
    computeFingerprint(bindingPreview.entries),
  );
  expect(selected.curation.passed).toBe(true);
  expect(selected.curation.summary.required).toBe(0);
  expect(selected.curation.summary.descriptions.checked).toBe(100);
});
it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/spells-535.json',
    ),
  ).toEqual([]);
});
it('independently checks whole PCGen positive DisplayFullSpell branches and their textual comparisons', async () => {
  let count = 0,
    matches = 0;
  const normalized = (s: string) =>
    s
      .replace(/&amp;/g, '&')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  for (const row of spells) {
    const comparison = row.fullContentReview.directComparison;
    if (!comparison) continue;
    const bytes = await readFile(join(root, comparison.source)),
      lines = bytes.toString().split('\n');
    expect(hash(bytes)).toBe(comparison.fileSha256);
    expect(lines[comparison.line - 1]).toBe(comparison.text);
    expect(hash(comparison.text)).toBe(comparison.lineSha256);
    const full = comparison.fullDescription;
    if (!full) throw new Error(row.name);
    expect(lines[full.line - 1]).toBe(full.text);
    expect(hash(full.text)).toBe(full.lineSha256);
    expect(full.text).toContain('|PRERULE:1,DisplayFullSpell');
    expect(full.text).not.toContain('|!PRERULE:1,DisplayFullSpell');
    const body = full.text.split('DESC:')[1]?.split('|PRERULE:')[0];
    if (!body) throw new Error(row.name);
    const equal =
      normalized(row.mechanicsReview.manualRule) === normalized(body);
    expect(full.normalizedEqual, row.name).toBe(equal);
    count++;
    if (equal) matches++;
  }
  expect(count).toBe(25);
  expect(matches).toBe(20);
});
