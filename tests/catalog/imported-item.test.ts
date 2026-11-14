import { expect, test } from 'vitest';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  importedWeaponSchema,
  preparedItemWeapon,
} from '../../src/lib/catalog/imported-item';
import {
  collectReferences,
  buildAssessmentBinding,
  assessCatalogAdmission,
} from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { preview } from '../fixtures/weapons-and-ammo-425/data';

const longsword =
  preview.closure.find((row) => row.externalKey === 'pf1/zWRlna42PMJVX6un') ??
  preview.entries.find((row) => row.externalKey === 'pf1/zWRlna42PMJVX6un');
const legacy = {
  baseTypes: ['Longsword'],
  proficiency: 'martial',
  groups: ['bladesHeavy'],
  handedness: '1h',
  dice: '1d8',
  damageTypes: ['slashing'],
  threat: 19,
  mult: 2,
  finesse: false,
  thrown: false,
};

test('unsupported old imported profiles refuse rather than acquiring guessed semantics', () => {
  expect(() => preparedItemWeapon({ weapon: legacy })).toThrow(
    'unsupported or incomplete imported profile (legacy weapon shape)',
  );
});

for (const weapon of [
  { ...legacy, handedness: 'ranged' },
  { ...legacy, baseTypes: ['Longsword', 'Dagger'] },
  { ...legacy, dice: null },
  { ...legacy, dice: '1d8 + @str' },
  { ...legacy, proficiency: 'siege' },
])
  test(`old unsupported weapon shape refuses explicitly: ${JSON.stringify(weapon)}`, () => {
    expect(() => preparedItemWeapon({ weapon })).toThrow(
      new Error(
        'unsupported or incomplete imported profile (legacy weapon shape)',
      ),
    );
  });

test('a Base Item participates in admission closure fingerprints and missing-dependency accounting', () => {
  const base: PreviewEntry = {
    externalKey: 'pf1/oyUApQSVsAqzyjdz',
    upstreamKey: 'pf1/oyUApQSVsAqzyjdz',
    pack: 'weapons-and-ammo',
    name: 'Greatsword',
    description: '',
    modifiers: [],
    sources: [],
    unsupported: [],
    detail: { kind: 'item', consumable: false, price: 50, weight: 8 },
  };
  const frost: PreviewEntry = {
    ...base,
    externalKey: 'pf1/TXd09UXUUNBWPk4Q',
    upstreamKey: 'pf1/TXd09UXUUNBWPk4Q',
    name: 'Frost Brand',
    detail: {
      ...base.detail,
      kind: 'item',
      consumable: false,
      price: 54475,
      weight: 8,
      baseItemKey: base.externalKey,
    },
  };
  expect(collectReferences(frost)).toEqual([base.externalKey]);
  const binding = (entries: PreviewEntry[]) =>
    buildAssessmentBinding({
      entry: frost,
      artifact: {
        catalog: { entries },
        comparison: { records: [], packs: [] },
      },
      evidence: {},
      registry: {},
      requiredNotices: [],
      evidenceIds: [],
    }).contentFingerprint;
  const original = binding([frost, base]);
  expect(binding([frost])).not.toBe(original);
  const missing = assessCatalogAdmission({
    artifact: {
      catalog: { entries: [frost] },
      comparison: { records: [], packs: [] },
    },
    assessments: [],
    evidence: {},
    registry: {},
  });
  expect(missing.passed).toBe(false);
  expect(missing.failures).toContainEqual({
    externalKey: frost.externalKey,
    reason: `Broken structure or reference: ${base.externalKey}.`,
  });
  expect(binding([frost, { ...base, name: 'Changed Greatsword' }])).not.toBe(
    original,
  );
});

test('malformed weapon enum/formula/reference and unknown properties cannot be silently dropped', () => {
  // Published Longsword body is only the envelope; the negative shapes are
  // corrupt operator payloads, not invented game rules.
  const envelope = longsword ?? preview.entries[0];
  if (!envelope) throw new Error('Missing published fixture');
  for (const detail of [
    {
      kind: 'item',
      consumable: false,
      price: 15,
      weight: 4,
      baseItemKey: '../Greatsword',
    },
    {
      kind: 'item',
      consumable: false,
      price: 15,
      weight: 4,
      weapon: { ...legacy, unknownMechanic: true },
    },
    {
      kind: 'item',
      consumable: false,
      price: 15,
      weight: 4,
      discardedMechanic: true,
    },
  ])
    expect(
      importedCatalogEntrySchema.safeParse({ ...envelope, detail }).success,
    ).toBe(false);
});

test('validated canonical homebrew needs no importer diagnostics', () => {
  const weapon = {
    baseType: 'Longsword',
    proficiency: 'martial',
    groups: ['bladesHeavy'],
    handedness: 'oneHanded',
    attackType: 'melee',
    dice: '1d8',
    damageTypes: ['slashing'],
    threat: 19,
    mult: 2,
    finesse: false,
    monk: false,
    thrown: false,
    strengthDamage: 'melee',
  } as const;
  const parsed = importedWeaponSchema.parse(weapon);
  expect(preparedItemWeapon({ weapon: parsed })).toBe(parsed);
});
