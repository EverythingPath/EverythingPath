// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { listCurationFormulaIssues } from '../../scripts/catalog/curation';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheetProjections,
  modifierTargets,
  resolveSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type InputSourcedModifier,
  type ModifierTarget,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import type { SkillTarget } from '../../src/lib/character-sheet-skills';
import { findRacialProgression } from '../../src/lib/character-sheet-creature-types';
import { representativeClassCatalog } from '../fixtures/catalog/representative-class-progressions';
import {
  expectAutomaticSkillFocus,
  getSkillFocusFormula,
} from './skill-focus-assertions';

// CRB p. 134, Skill Focus: "You get a +3 bonus on all checks involving the
// chosen skill. If you have 10 or more ranks in that skill, this bonus
// increases to +6. ... Its effects do not stack." Every admitted Skill Focus
// (<skill>) record on the feature head, by its pinned pf1-content file
// (src/pf-feats/Skill_Focus__<skill>__<id>.yaml) and the skill it names (#724).
const admittedSkillFocus = [
  ['xgRstzkd1nDznrjH', 'Acrobatics', 'skill.acr'],
  ['vkie3lLGq6LgYp8D', 'Appraise', 'skill.apr'],
  ['Vi8Fh4JceKVHZ7jK', 'Bluff', 'skill.blf'],
  ['eLQUV5Hswm8vNLfE', 'Climb', 'skill.clm'],
  ['pslODOJK0u0wOxqL', 'Craft', 'skill.crf'],
  ['sQi2KLYCUMUZ1zj3', 'Diplomacy', 'skill.dip'],
  ['GkcekdZwcwMwI6ss', 'Disable Device', 'skill.dev'],
  ['qWcruct7zqZyKtbX', 'Disguise', 'skill.dis'],
  ['vdQNZjiXvUQiwmvk', 'Escape Artist', 'skill.esc'],
  ['G3yPmoVa0D7uIbEF', 'Handle Animal', 'skill.han'],
  ['MMZxRlkELezwGDlL', 'Heal', 'skill.hea'],
  ['7mcNePI93Co2JbPF', 'Intimidate', 'skill.int'],
  ['Vvz4wGmyxEdAaJa0', 'Knowledge [Arcana]', 'skill.kar'],
  ['LmV6WT0Dv5FZO4Qy', 'Knowledge [Dungeoneering]', 'skill.kdu'],
  ['UHGTb3NPHxp6v7yl', 'Knowledge [Engineering]', 'skill.ken'],
  ['r9XAvlQ9lvVRl5LA', 'Knowledge [Geography]', 'skill.kge'],
  ['zes8vxX3D6CKoYC2', 'Knowledge [History]', 'skill.khi'],
  ['CT5OvOkf7Z2KxPxa', 'Knowledge [Local]', 'skill.klo'],
  ['WMfe0yuef5IYgE7i', 'Knowledge [Nature]', 'skill.kna'],
  ['IGlL6mwZTu6RScYr', 'Knowledge [Nobility]', 'skill.kno'],
  ['sUwMFZMDtVqqLswV', 'Knowledge [Planes]', 'skill.kpl'],
  ['weePoRFNXCKBgP1S', 'Knowledge [Religion]', 'skill.kre'],
  ['TA7qGwyL5uXk7dfP', 'Linguistics', 'skill.lin'],
  ['9yua5ZlomvDj1c7D', 'Perception', 'skill.per'],
  ['kSI3WpP2rsR2VRH5', 'Perform', 'skill.prf'],
  ['lXmRbAWO1KhZuBuh', 'Profession', 'skill.pro'],
  ['Z7kvSCJd3aMgwXrn', 'Ride', 'skill.rid'],
  ['kNe3aEHS1byqAX50', 'Sense Motive', 'skill.sen'],
  ['zWybSUTo0L3ti0Ve', 'Sleight of Hand', 'skill.slt'],
  ['iuyQGv9f6vdPC1Nj', 'Spellcraft', 'skill.spl'],
  ['2JWwVMFeqHnFDFSv', 'Stealth', 'skill.ste'],
  ['XnJjz7As3jJkS4iF', 'Survival', 'skill.sur'],
  ['ZRkknePy6wjAgoVH', 'Swim', 'skill.swm'],
  ['s6Sy6KxxYSXDOmJa', 'Use Magic Device', 'skill.umd'],
] as const;
type SkillRanks = Partial<Record<SkillTarget, number>>;

const isModifierTarget = (target: string): target is ModifierTarget =>
  modifierTargets.some((item) => item === target);

function getSkillFocus({ skill }: { skill: string }) {
  const row = admittedSkillFocus.find(([, name]) => name === skill);
  if (!row) throw new Error(`No admitted Skill Focus (${skill})`);
  const [id, name, target] = row;
  const externalKey = `pf1-content/${id}`;
  const record = reviewedCuration.records.find(
    (item) => item.externalKey === externalKey && item.kind === 'description',
  );
  if (!record) throw new Error(`Missing record for ${externalKey}`);
  const modifiers = record.outputs.flatMap((output) => {
    if (output.kind !== 'modifier' || !isModifierTarget(output.target))
      return [];
    const { kind: _kind, ...modifier } = output;
    return [{ ...modifier, target: output.target }];
  });
  return {
    externalKey,
    entryName: `Skill Focus (${name})`,
    target,
    record,
    modifiers,
  };
}

function createHolderModifiers({
  skill,
  sheetEntryId = 'feat-row',
}: {
  skill: string;
  sheetEntryId?: string;
}): InputSourcedModifier[] {
  const { externalKey, entryName, modifiers } = getSkillFocus({ skill });
  return modifiers.map((modifier, modifierIndex) => ({
    ...modifier,
    modifierIndex,
    sheetEntryId,
    catalogEntryId: externalKey,
    source: externalKey,
    entryName,
    builtIn: false,
  }));
}

describe('Skill Focus at the resolver', () => {
  it('gives Skill Focus (Spellcraft) +3 at 0 and 9 ranks and +6 at 10, with nothing selected', () => {
    const rows = createHolderModifiers({ skill: 'Spellcraft' });
    const resolveAt = (ranks: number) =>
      resolveSheet(rows, { skillRanks: { 'skill.spl': ranks } })['skill.spl']
        .total;
    expect([0, 9, 10, 23].map(resolveAt)).toEqual([3, 3, 6, 6]);
  });

  it('reads the category skill Perform from skill.prf', () => {
    const rows = createHolderModifiers({ skill: 'Perform' });
    expectAutomaticSkillFocus({ modifiers: rows, target: 'skill.prf' });
    // Another skill's ranks don't count toward Perform's threshold.
    expect(
      resolveSheet(rows, { skillRanks: { 'skill.pro': 10 } })['skill.prf']
        .total,
    ).toBe(3);
  });

  it("doesn't stack two copies for one skill and adds nothing to another skill", () => {
    const both = [
      ...createHolderModifiers({ skill: 'Spellcraft' }),
      ...createHolderModifiers({
        skill: 'Spellcraft',
        sheetEntryId: 'feat-row-2',
      }),
    ];
    const resolved = resolveSheet(both, { skillRanks: { 'skill.spl': 10 } });
    expect(resolved['skill.spl'].total).toBe(6);
    expect(resolved['skill.spl'].suppressed).toHaveLength(1);
    expect(resolved['skill.clm'].total).toBe(0);
  });

  it('applies every admitted Skill Focus (<skill>) record to its own skill alone, with no Situation', () => {
    expect(admittedSkillFocus).toHaveLength(34);
    for (const [id, name, target] of admittedSkillFocus) {
      const { record, modifiers } = getSkillFocus({ skill: name });
      expect(
        reviewedAdmission.assessments.find(
          (row) => row.externalKey === `pf1-content/${id}`,
        )?.status,
        name,
      ).toBe('confirmed');
      expect(modifiers, name).toEqual([
        {
          target,
          bonusType: 'untyped',
          value: { formula: getSkillFocusFormula(target) },
        },
      ]);
      expect(listCurationFormulaIssues({ record }), name).toEqual([]);
      const rows = createHolderModifiers({ skill: name });
      expectAutomaticSkillFocus({ modifiers: rows, target });
      const others = admittedSkillFocus
        .map(([, , other]) => other)
        .filter((other) => other !== target);
      for (const ranks of [0, 9, 10]) {
        const resolved = resolveSheet(rows, {
          skillRanks: { [target]: ranks },
        });
        expect(resolved[target].conditional, name).toEqual([]);
        expect(
          others.filter((other) => resolved[other].total !== 0),
          name,
        ).toEqual([]);
      }
    }
  });
});

// A wizard (CRB p. 80; representative progression) records one rank per
// level in each listed skill, up to that skill's count.
function createWizardLevels({
  levels,
  ranks,
}: {
  levels: number;
  ranks: SkillRanks;
}): SheetEntry[] {
  return Array.from({ length: levels }, (_, index) => ({
    _id: `level-${index + 1}`,
    kind: 'classLevel',
    active: true,
    state: {
      kind: 'classLevel',
      position: index + 1,
      classEntryId: 'wizard',
      hpGained: 4,
      skillRanks: Object.fromEntries(
        Object.entries(ranks).map(([skill, count]) => [
          skill,
          index < (count ?? 0) ? 1 : 0,
        ]),
      ),
    },
  }));
}

// A custom race a player can create, with 10 racial Hit Dice of the
// aberration seed and the given racial skill ranks.
function createCustomRace({ racialRanks }: { racialRanks: SkillRanks }): {
  entry: SheetEntry;
  definition: CharacterSheetCatalogEntry;
} {
  const progression = findRacialProgression('aberration');
  if (!progression) throw new Error('Missing aberration progression');
  return {
    entry: {
      _id: 'race-row',
      kind: 'race',
      active: true,
      catalogEntryId: 'custom-race',
      state: {
        kind: 'race',
        racialHpGained: 45,
        racialSkillRanks: racialRanks,
      },
    },
    definition: {
      _id: 'custom-race',
      ruleIdentity: 'fixture-custom-race',
      modifiers: [],
      detail: {
        kind: 'race',
        racialTraits: [],
        racialHitDice: 10,
        racialProgression: progression,
      },
    },
  };
}

function createSkillFocusDefinition({
  skill,
}: {
  skill: string;
}): CharacterSheetCatalogEntry {
  const { externalKey, entryName, modifiers } = getSkillFocus({ skill });
  return {
    _id: externalKey,
    name: entryName,
    ruleIdentity: externalKey,
    modifiers,
    detail: { kind: 'feat' },
  };
}

function createSheet({
  feats,
  levels = 0,
  ranks = {},
  racialRanks,
}: {
  feats: readonly string[];
  levels?: number;
  ranks?: SkillRanks;
  racialRanks?: SkillRanks;
}): CharacterSheetInput {
  const race = racialRanks ? createCustomRace({ racialRanks }) : null;
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
      ...(race ? [race.entry] : []),
      ...createWizardLevels({ levels, ranks }),
      ...feats.map(
        (skill, index): SheetEntry => ({
          _id: `feat-row-${index + 1}`,
          kind: 'feat',
          active: true,
          catalogEntryId: getSkillFocus({ skill }).externalKey,
          state: { kind: 'feat' },
        }),
      ),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'fixture-base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
      ...representativeClassCatalog,
      ...(race ? [race.definition] : []),
      ...[...new Set(feats)].map((skill) =>
        createSkillFocusDefinition({ skill }),
      ),
    ],
  };
}

function calculateSkillFocusBreakdown({
  input,
  target,
}: {
  input: CharacterSheetInput;
  target: SkillTarget;
}) {
  const statistic =
    calculateCharacterSheetProjections(input).current.breakdowns[target];
  return {
    total: statistic.total,
    applied: statistic.applied
      .filter((row) => row.entryName.startsWith('Skill Focus'))
      .map((row) => [row.entryName, row.value]),
    suppressed: statistic.suppressed.map((row) => [row.entryName, row.value]),
  };
}

describe('Skill Focus on a persisted sheet', () => {
  it('gives Skill Focus (Spellcraft) +3 at 0 and 9 recorded ranks and +6 at 10', () => {
    for (const [levels, total, bonus] of [
      [1, 3, 3],
      [9, 12, 3],
      [10, 16, 6],
    ] as const) {
      const ranks = levels === 1 ? 0 : levels;
      expect(
        calculateSkillFocusBreakdown({
          input: createSheet({
            feats: ['Spellcraft'],
            levels,
            ranks: { 'skill.spl': ranks },
          }),
          target: 'skill.spl',
        }),
        `${ranks} ranks`,
      ).toEqual({
        total,
        applied: [['Skill Focus (Spellcraft)', bonus]],
        suppressed: [],
      });
    }
  });

  it('gives Skill Focus (Perform) +3 at 0 and 9 Perform ranks and +6 at 10', () => {
    for (const [ranks, bonus] of [
      [0, 3],
      [9, 3],
      [10, 6],
    ] as const)
      expect(
        calculateSkillFocusBreakdown({
          input: createSheet({
            feats: ['Perform'],
            levels: 10,
            ranks: { 'skill.prf': ranks },
          }),
          target: 'skill.prf',
        }).applied,
        `${ranks} ranks`,
      ).toEqual([['Skill Focus (Perform)', bonus]]);
  });

  it('keeps two copies for one skill at +6 and adds nothing to another skill', () => {
    const input = createSheet({
      feats: ['Spellcraft', 'Spellcraft'],
      levels: 10,
      ranks: { 'skill.spl': 10, 'skill.clm': 10 },
    });
    expect(
      calculateSkillFocusBreakdown({ input, target: 'skill.spl' }),
    ).toEqual({
      total: 16,
      applied: [['Skill Focus (Spellcraft)', 6]],
      suppressed: [['Skill Focus (Spellcraft)', 6]],
    });
    expect(
      calculateSkillFocusBreakdown({ input, target: 'skill.clm' }),
    ).toEqual({ total: 10, applied: [], suppressed: [] });
  });

  it('counts racial Hit Dice ranks toward the threshold', () => {
    expect(
      calculateSkillFocusBreakdown({
        input: createSheet({
          feats: ['Spellcraft'],
          racialRanks: { 'skill.spl': 10 },
        }),
        target: 'skill.spl',
      }),
      // 10 ranks, +3 as a class skill of the aberration seed (pf1/WiROthmRgcwDncDM), +6.
    ).toMatchObject({ total: 19, applied: [['Skill Focus (Spellcraft)', 6]] });
    expect(
      calculateSkillFocusBreakdown({
        input: createSheet({
          feats: ['Spellcraft'],
          levels: 1,
          ranks: { 'skill.spl': 1 },
          racialRanks: { 'skill.spl': 9 },
        }),
        target: 'skill.spl',
      }).applied,
    ).toEqual([['Skill Focus (Spellcraft)', 6]]);
  });
});
