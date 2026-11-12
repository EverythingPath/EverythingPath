// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { CurationRecord } from '../../scripts/catalog/curation';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
} from '../../src/lib/character-sheet';

// Armor, shield and natural armor bonuses each have their own AC leaf
// (`ac.armor`, `ac.shield`, `ac.natural`); an equipped shield adds its bonus
// to `ac.shield` (src/lib/character-sheet-equipment.ts). Bonuses of the same
// type don't stack (CRB p. 12), but AC adds its leaves together without
// comparing types across them, so one of these bonuses on `ac.other` stacks
// with the real armor, shield or natural armor. Curate them on `ac`, which
// routes each to its own leaf, or on that leaf.
const leafBonusTypes: readonly string[] = ['armor', 'shield', 'naturalArmor'];

type Allowlist = Record<string, { name: string; modifiers: number }>;

// The held violations #734 (CD-01) retargets before their holds clear, found
// by scanning the overlay: each key and how many such Modifiers it has. Remove
// an entry in the change that retargets its Modifiers.
const heldViolations: Allowlist = {
  // #351
  'pf1-content/WogqX5Ng7J59zsR8': {
    name: 'Swordplay Deflection',
    modifiers: 1,
  },
  // #352
  'pf1-content/XQcrcD7X40hr5CQ5': {
    name: 'Shield Gauntlet Style',
    modifiers: 1,
  },
  // #353
  'pf1-content/afvoCOidKNy23teW': { name: 'Improvised Defenses', modifiers: 1 },
  // #356
  'pf1-content/g4NJK0LglC0s5zy8': { name: 'Cornugon Shield', modifiers: 2 },
  // #356
  'pf1-content/gKsH7B12x0Rhlqb3': { name: 'Cooperative Swarmer', modifiers: 1 },
};

function isAcOtherLeafBonus(output: CurationRecord['outputs'][number]) {
  return (
    output.kind === 'modifier' &&
    output.target === 'ac.other' &&
    leafBonusTypes.includes(output.bonusType)
  );
}

function countAcOtherLeafBonuses(records: readonly CurationRecord[]) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const count = record.outputs.filter(isAcOtherLeafBonus).length;
    if (count)
      counts.set(
        record.externalKey,
        (counts.get(record.externalKey) ?? 0) + count,
      );
  }
  return counts;
}

function compareWithAllowlist({
  counts,
  allowlist,
}: {
  counts: ReadonlyMap<string, number>;
  allowlist: Allowlist;
}) {
  const problems: string[] = [];
  for (const [key, count] of counts)
    if (count > (allowlist[key]?.modifiers ?? 0))
      problems.push(
        `${key}: ${count} armor, shield or natural armor bonus(es) on ac.other; target ac or its own AC leaf`,
      );
  for (const [key, { name, modifiers }] of Object.entries(allowlist))
    if ((counts.get(key) ?? 0) < modifiers)
      problems.push(
        `${key} (${name}): stale #734 allowlist entry; remove it with the retarget`,
      );
  return problems;
}

function findAcOtherLeafBonusProblems({
  records,
  allowlist = heldViolations,
}: {
  records: readonly CurationRecord[];
  allowlist?: Allowlist;
}) {
  return compareWithAllowlist({
    counts: countAcOtherLeafBonuses(records),
    allowlist,
  });
}

function getReviewedDescription(externalKey: string) {
  const found = reviewedCuration.records.find(
    (row) => row.externalKey === externalKey && row.kind === 'description',
  );
  if (!found) throw new Error(`Missing reviewed record ${externalKey}`);
  return found;
}

// A curator's slip: a real record's bonus, typed correctly but put on
// `ac.other`.
function appendAcOtherBonus({
  externalKey,
  bonus,
}: {
  externalKey: string;
  bonus: { bonusType: 'armor' | 'shield' | 'naturalArmor'; value: number };
}): CurationRecord {
  const row = getReviewedDescription(externalKey);
  return {
    ...row,
    outputs: [
      ...row.outputs,
      { kind: 'modifier', target: 'ac.other', ...bonus },
    ],
  };
}

describe('armor, shield and natural armor bonuses on ac.other', () => {
  it('appear in the curated records only as the #734 held violations', () => {
    expect(
      findAcOtherLeafBonusProblems({ records: reviewedCuration.records }),
    ).toEqual([]);
  });

  it.each([
    // Two-Weapon Defense (CRB p. 136): a +1 shield bonus to AC.
    ['pf1/YDqp3yrAsuXh103W', { bonusType: 'shield', value: 1 }],
    // Mage Armor (CRB p. 306): a +4 armor bonus to AC.
    ['pf1/ucc0a31d1y86oleh', { bonusType: 'armor', value: 4 }],
    // Armor of the Pit: a +2 natural armor bonus.
    ['pf1-content/Cq2efVlJR8iB9OJv', { bonusType: 'naturalArmor', value: 2 }],
  ] as const)('reject a new one on %s', (externalKey, bonus) => {
    const records = reviewedCuration.records.map((row) =>
      row.externalKey === externalKey && row.kind === 'description'
        ? appendAcOtherBonus({ externalKey, bonus })
        : row,
    );
    expect(findAcOtherLeafBonusProblems({ records })).toEqual([
      expect.stringContaining(`${externalKey}: `),
    ]);
  });

  it('reject one more than an allowlist entry holds', () => {
    // Two-Weapon Defense (CRB p. 136): its +1 and +2 shield bonuses, both
    // slipped onto ac.other, against an entry allowing one.
    const externalKey = 'pf1/YDqp3yrAsuXh103W';
    const once = appendAcOtherBonus({
      externalKey,
      bonus: { bonusType: 'shield', value: 1 },
    });
    const twice: CurationRecord = {
      ...once,
      outputs: [
        ...once.outputs,
        { kind: 'modifier', target: 'ac.other', bonusType: 'shield', value: 2 },
      ],
    };
    expect(
      findAcOtherLeafBonusProblems({
        records: [twice],
        allowlist: {
          [externalKey]: { name: 'Two-Weapon Defense', modifiers: 1 },
        },
      }),
    ).toEqual([expect.stringContaining(`${externalKey}: 2 `)]);
  });

  it('fail on an allowlist entry whose Modifiers were retargeted', () => {
    // Two-Weapon Defense's reviewed shield bonus targets ac, so an allowlist
    // entry for it no longer matches anything.
    const externalKey = 'pf1/YDqp3yrAsuXh103W';
    expect(
      findAcOtherLeafBonusProblems({
        records: [getReviewedDescription(externalKey)],
        allowlist: {
          [externalKey]: { name: 'Two-Weapon Defense', modifiers: 1 },
        },
      }),
    ).toEqual([expect.stringContaining('stale #734 allowlist entry')]);
  });
});

// Cooperative Swarmer: "you gain a +2 shield bonus to AC while sharing a
// square with a larger ally". A character carrying a light steel shield (+1
// shield bonus, CRB Table 6-6, p. 151) keeps only the higher shield bonus
// (CRB p. 12), so its AC rises by 2, not 3. The cases set the target
// themselves, so they hold whether or not #734 has retargeted the record.
describe('an equipped shield with a shield bonus from a feat', () => {
  const swarmer = getReviewedDescription('pf1-content/gKsH7B12x0Rhlqb3');
  const reviewed = swarmer.outputs.flatMap(({ kind, ...output }) =>
    kind === 'modifier' && 'bonusType' in output ? [output] : [],
  );
  const situation = reviewed[0]?.condition?.situation;
  const retarget = (target: 'ac' | 'ac.other') =>
    reviewed.map((modifier) => ({ ...modifier, target }));

  function createSheetInput(
    modifiers: CharacterSheetCatalogEntry['modifiers'],
  ): CharacterSheetInput {
    return {
      characterKind: 'pc',
      entries: [
        {
          _id: 'base-row',
          kind: 'base',
          active: true,
          catalogEntryId: 'base',
          state: { kind: 'base' },
        },
        {
          _id: 'shield-row',
          kind: 'item',
          active: true,
          catalogEntryId: 'light-steel-shield',
          state: { kind: 'item' },
        },
        {
          _id: 'feat-row',
          kind: 'feat',
          active: true,
          catalogEntryId: 'cooperative-swarmer',
          state: { kind: 'feat' },
        },
      ],
      catalogEntries: [
        {
          _id: 'base',
          ruleIdentity: 'base',
          modifiers: abilityKeys.map((key) => ({
            target: abilityTargets[key],
            bonusType: 'base' as const,
            value: key === 'dexterity' ? 14 : 10,
          })),
        },
        {
          _id: 'light-steel-shield',
          name: 'Light steel shield',
          ruleIdentity: 'light-steel-shield',
          modifiers: [],
          detail: {
            kind: 'item',
            armor: {
              slot: 'shield',
              category: 'lightShield',
              bonus: 1,
              maxDex: null,
              armorCheckPenalty: 1,
              asf: 5,
            },
          },
        },
        {
          _id: 'cooperative-swarmer',
          name: 'Cooperative Swarmer',
          ruleIdentity: swarmer.externalKey,
          modifiers,
          detail: { kind: 'feat' },
        },
      ],
    };
  }
  const sharingASquare =
    typeof situation === 'object' && 'local' in situation
      ? [{ local: situation.local, sheetEntryId: 'feat-row' }]
      : [];

  it('stacks both shield bonuses when the feat targets ac.other', () => {
    expect(reviewed).toEqual([
      expect.objectContaining({ bonusType: 'shield', value: 2 }),
    ]);
    expect(sharingASquare).toHaveLength(1);
    const result = calculateCharacterSheet(
      createSheetInput(retarget('ac.other')),
      {
        situations: sharingASquare,
      },
    );
    expect(result.breakdowns['ac.shield'].total).toBe(1);
    expect(result.breakdowns['ac.other'].total).toBe(2);
    // 10 + Dex 2 + shield 1 + shield 2: the wrong total.
    expect(result.derivedStatistics.ac.total).toBe(15);
  });

  it('keeps only the higher shield bonus when the feat targets ac', () => {
    const result = calculateCharacterSheet(createSheetInput(retarget('ac')), {
      situations: sharingASquare,
    });
    expect(result.breakdowns['ac.shield'].total).toBe(2);
    expect(
      result.breakdowns['ac.shield'].suppressed.map((row) => row.value),
    ).toEqual([1]);
    expect(result.breakdowns['ac.other'].total).toBe(0);
    expect(result.derivedStatistics.ac.total).toBe(14);
    // Without the Situation, only the shield counts.
    expect(
      calculateCharacterSheet(createSheetInput(retarget('ac')))
        .derivedStatistics.ac.total,
    ).toBe(13);
  });
});
