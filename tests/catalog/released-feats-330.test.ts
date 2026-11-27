// @vitest-environment node
// pbl-released-feats-1 (PRD #251): the feat batch units' resolver blocks
// (feats-330 to feats-338), on entries imported from the pinned store. One
// import holds every key of the nine batches' key data (released-feat-keys.ts);
// each describe looks its feats up by name within its batch's named keys, and
// the one check of "every entry" checks that batch's preview key list, as the
// batch units did over their preview. Each case asserts what the importer
// emits for the named entries and what the resolver or the sheet computes
// from them; the batch reviews' records are not read, so the units' checks of
// those records stay with the units.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { upstreamRecord } from '../../scripts/catalog/records';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  calculateCharacterSheetProjections,
  resolveSheet,
  type InputSourcedModifier,
} from '../../src/lib/character-sheet';
import { pinnedRecordFile, pinnedStore } from './pinned-sources';
import { importReleasedEntries } from './released-entries';
import { featBatches, featBatchKeys } from './released-feat-keys';
import { featBatch } from './released-feat-sheet';
import {
  expectAutomaticSkillFocus,
  expectAutomaticSkillPair,
} from './skill-focus-assertions';

const { entries } = await importReleasedEntries(
  featBatchKeys([
    'feats-330',
    'feats-331',
    'feats-332',
    'feats-333',
    'feats-334',
    'feats-335',
    'feats-336',
    'feats-337',
    'feats-338',
  ]),
);

/** The status of a key's committed Attribution Assessment. */
const assessmentStatus = (key: string) =>
  reviewedAdmission.assessments.find((row) => row.externalKey === key)?.status;

/** The sheet with its feat entry switched off. */
function withFeatInactive(
  input: ReturnType<ReturnType<typeof featBatch>['featSheet']>,
) {
  return {
    ...input,
    entries: input.entries.map((row) =>
      row.kind === 'feat' ? { ...row, active: false } : row,
    ),
  };
}

describe('the feats-330 keys', () => {
  const { entry, modifiers, definition, featSheet } = featBatch(
    entries,
    'feats-330',
  );

  it('adds Lightning Reflexes +2 exactly once in current and permanent public projections', () => {
    // The batch adapter parsed this one Modifier strictly.
    expect(definition('Lightning Reflexes', 'numeric').modifiers).toEqual([
      { target: 'save.ref', bonusType: 'untyped', value: 2 },
    ]);
    const result = calculateCharacterSheetProjections(
      featSheet('Lightning Reflexes', 'numeric', { dexterity: 14 }),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.derivedStatistics.reflex.total).toBe(4); // Dex 14 (+2), feat +2.
      expect(projection.derivedStatistics.fortitude.total).toBe(0);
      expect(projection.derivedStatistics.will.total).toBe(0);
      expect(
        projection.resolvedEntries.filter(
          (row) => row.entry.kind === 'feat' && row.counting,
        ),
      ).toHaveLength(1);
      expect(projection.derivedStatistics.reflex.applied).toContainEqual(
        expect.objectContaining({ source: 'pf1/0bZf3SDkvVOe2ujH', value: 2 }),
      );
    }
  });

  it('keeps Point-Blank Shot ranged-only and conditional on the existing within30ft Situation', () => {
    const data = modifiers('Point-Blank Shot');
    expect(resolveSheet(data)['attack.ranged'].total).toBe(0);
    expect(resolveSheet(data)['damage.ranged'].total).toBe(0);
    const close = resolveSheet(data, { situations: ['within30ft'] });
    expect(close['attack.ranged'].total).toBe(1);
    expect(close['damage.ranged'].total).toBe(1);
    expect(close['attack.melee'].total).toBe(0);
    expect(close['damage.melee'].total).toBe(0);
  });

  it('stacks the +2 Improved and +2 Greater Disarm checks without confusing defensive CMD', () => {
    const data = [
      ...modifiers('Improved Disarm'),
      ...modifiers('Greater Disarm'),
    ];
    expect(resolveSheet(data).cmb.total).toBe(0);
    const attacking = resolveSheet(data, { situations: ['disarm'] });
    expect(attacking.cmb.total).toBe(4);
    expect(attacking.cmd.total).toBe(0);
    const defending = resolveSheet(data, {
      situations: [
        { local: 'vs. disarm', sheetEntryId: 'pf1/711B9WNFgpdDKKf2' },
      ],
    });
    expect(defending.cmd.total).toBe(2);
    expect(defending.cmb.total).toBe(0);
  });

  it('stacks Improved and Greater Reposition only in offensive reposition checks', () => {
    const data = [
      ...modifiers('Improved Reposition'),
      ...modifiers('Greater Reposition'),
    ];
    const result = resolveSheet(data, { situations: ['reposition'] });
    expect(result.cmb.total).toBe(4);
    expect(result.cmd.total).toBe(0);
    expect(resolveSheet(data).cmb.total).toBe(0);
  });

  it('limits Greater Spell Penetration to overcoming spell resistance rather than unconditional caster level', () => {
    const data = modifiers('Greater Spell Penetration');
    expect(resolveSheet(data).casterLevel.total).toBe(0);
    expect(
      resolveSheet(data, { situations: ['spellResistance'] }).casterLevel.total,
    ).toBe(2);
    expect(
      resolveSheet(data, { situations: ['spells'] }).casterLevel.total,
    ).toBe(0);
  });

  it.each([
    [0, 3],
    [1, 3],
    [3, 3],
    [4, 4],
    [8, 8],
  ])(
    'uses actual %i Hit Dice for Toughness +%i HP including zero class levels',
    (hitDice, hp) => {
      expect(
        resolveSheet(
          [
            ...modifiers('Toughness'),
            {
              target: 'ability.con',
              bonusType: 'base',
              value: 10,
              sheetEntryId: 'base',
              entryName: 'Base',
              source: 'base',
              builtIn: false,
            },
          ],
          { level: 0, hitDice },
        ).hp.total,
      ).toBe(hp);
    },
  );

  it('keeps arcane armor spell failure, equipment-dependent formulas and chosen skill gaps separate from valid statistics', () => {
    expect(modifiers('Arcane Armor Training')).toEqual([]);
    // stats-d2 fix r3: Fleet's armor test is a checked change replacement now,
    // +5 under armorAtMost light; load stays a Note.
    expect(modifiers('Fleet')).toEqual([
      expect.objectContaining({
        target: 'speed.land',
        bonusType: 'untyped',
        value: 5,
        condition: { armorAtMost: 'light' },
      }),
    ]);
    expect(modifiers('Shield Focus')).toEqual([]);
    expect(modifiers('Skill Focus')).toEqual([]);
    expect(entry('Arcane Armor Training').situationalNotes).toContainEqual({
      text: expect.stringContaining('10 percentage points'),
    });
    expect(resolveSheet(modifiers('Arcane Armor Training')).spellDC.total).toBe(
      0,
    );
  });

  it('applies the skill-pair feats +2, or +4 with 10 or more ranks, on each skill from its own recorded ranks (rank-modifiers slice 2, #777)', () => {
    expectAutomaticSkillPair({
      modifiers: modifiers('Magical Aptitude'),
      targets: ['skill.spl', 'skill.umd'],
    });
    // Self-Sufficient's .ranks changes import the formula through their
    // reviewed replacements (R5(a)); no raw change stays unsupported.
    expectAutomaticSkillPair({
      modifiers: modifiers('Self-Sufficient'),
      targets: ['skill.hea', 'skill.sur'],
    });
    expect(
      entry('Self-Sufficient').unsupported?.filter(
        ({ field }) => field === 'changes',
      ),
    ).toEqual([]);
  });
});

describe('the feats-331 keys', () => {
  const { modifiers, definition, featSheet } = featBatch(entries, 'feats-331');

  it('adds Improved Initiative +4 once in both public projections without affecting saves', () => {
    // The batch adapter parsed this one Modifier strictly.
    expect(definition('Improved Initiative', 'numeric').modifiers).toEqual([
      { target: 'init', bonusType: 'untyped', value: 4 },
    ]);
    const result = calculateCharacterSheetProjections(
      featSheet('Improved Initiative', 'numeric', { dexterity: 14 }),
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
      // The batch adapter parsed this one Modifier strictly.
      expect(definition('Intimidating Prowess', 'numeric').modifiers).toEqual([
        {
          target: 'skill.int',
          bonusType: 'untyped',
          value: { formula: '@ability.str.mod' },
        },
      ]);
      const result = calculateCharacterSheetProjections(
        featSheet('Intimidating Prowess', 'numeric', { strength }),
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
    const data = [
      ...modifiers('Improved Steal'),
      ...modifiers('Greater Steal'),
    ];
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

  it("imports no Critical Focus Modifier, and applies the skill-pair feats +2, or +4 with 10 or more ranks, from each skill's recorded ranks (rank-modifiers slice 2, #777)", () => {
    expect(modifiers('Critical Focus')).toEqual([]);
    for (const [name, targets] of [
      ['Alertness', ['skill.sen', 'skill.per']],
      ['Persuasive', ['skill.dip', 'skill.int']],
      ['Deceitful', ['skill.blf', 'skill.dis']],
      ['Deft Hands', ['skill.dev', 'skill.slt']],
    ] as const)
      expectAutomaticSkillPair({ modifiers: modifiers(name), targets });
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
});

describe('the feats-332 keys', () => {
  const { key, entry, modifiers, definition, featSheet } = featBatch(
    entries,
    'feats-332',
  );

  it('adds Great Fortitude +2 once to both public projections and leaves Reflex and Will alone', () => {
    // The batch adapter parsed this one Modifier strictly.
    expect(definition('Great Fortitude', 'numeric').modifiers).toEqual([
      { target: 'save.fort', bonusType: 'untyped', value: 2 },
    ]);
    const result = calculateCharacterSheetProjections(
      featSheet('Great Fortitude', 'numeric', { constitution: 14 }),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.derivedStatistics.fortitude.total).toBe(4); // Constitution 14 contributes +2; the feat contributes +2.
      expect(projection.derivedStatistics.reflex.total).toBe(0);
      expect(projection.derivedStatistics.will.total).toBe(0);
      expect(projection.derivedStatistics.fortitude.applied).toContainEqual(
        expect.objectContaining({ source: 'pf1/fVRnBIHR4Jq6btvm', value: 2 }),
      );
    }
    const data = modifiers('Great Fortitude');
    const copied = data.map((row) => ({
      ...row,
      sheetEntryId: 'catalog-copy',
      catalogEntryId: 'catalog-copy',
    }));
    expect(resolveSheet([...data, ...copied])['save.fort'].total).toBe(2);
    expect(
      resolveSheet([...data, ...modifiers('Iron Will')])['save.will'].total,
    ).toBe(2);
  });

  it.each([
    ['Grapple', 'grapple'],
    ['Trip', 'trip'],
    ['Overrun', 'overrun'],
    ['Sunder', 'sunder'],
  ])(
    'stacks Improved and Greater %s offense separately from its defensive Situation',
    (maneuver, offensive) => {
      const data = [
        ...modifiers(`Improved ${maneuver}`),
        ...modifiers(`Greater ${maneuver}`),
      ];
      expect(resolveSheet(data).cmb.total).toBe(0);
      expect(resolveSheet(data).cmd.total).toBe(0);
      const attacking = resolveSheet(data, { situations: [offensive] });
      expect(attacking.cmb.total).toBe(4);
      expect(attacking.cmd.total).toBe(0);
      const defensive = {
        local: `against a ${offensive} combat maneuver`,
        sheetEntryId: key(`Improved ${maneuver}`),
      };
      const defending = resolveSheet(data, { situations: [defensive] });
      expect(defending.cmb.total).toBe(0);
      expect(defending.cmd.total).toBe(2);
      const combined = resolveSheet(data, {
        situations: [offensive, defensive],
      });
      expect(combined.cmb.total).toBe(4);
      expect(combined.cmd.total).toBe(2);
    },
  );

  it('applies Combat Casting +4 only to its entry-local concentration Situation', () => {
    const data = modifiers('Combat Casting');
    const situation = data.find((row) => row.target === 'concentration')
      ?.condition?.situation;
    if (typeof situation !== 'object' || !('local' in situation))
      throw new Error('Missing local Combat Casting Situation');
    expect(resolveSheet(data).concentration.total).toBe(0);
    const selected = { ...situation, sheetEntryId: key('Combat Casting') };
    expect(
      resolveSheet(data, { situations: [selected] }).concentration.total,
    ).toBe(4);
    expect(
      resolveSheet(data, {
        situations: [{ ...selected, sheetEntryId: 'unrelated-row' }],
      }).concentration.total,
    ).toBe(0);
    expect(
      resolveSheet(data, { situations: [situation.local] }).concentration.total,
    ).toBe(0);
    expect(
      resolveSheet(data, { situations: [selected] })['save.fort'].total,
    ).toBe(0);
  });

  it('limits Run +4 to a running jump and Spell Penetration +2 to overcoming spell resistance', () => {
    const run = modifiers('Run');
    const situation = run.find((row) => row.target === 'skill.acr')?.condition
      ?.situation;
    if (typeof situation !== 'object' || !('local' in situation))
      throw new Error('Missing local running-jump Situation');
    expect(resolveSheet(run)['skill.acr'].total).toBe(0);
    expect(
      resolveSheet(run, {
        situations: [{ ...situation, sheetEntryId: key('Run') }],
      })['skill.acr'].total,
    ).toBe(4);
    expect(
      resolveSheet(run, { situations: ['charging'] })['skill.acr'].total,
    ).toBe(0);
    const penetration = modifiers('Spell Penetration');
    expect(resolveSheet(penetration).casterLevel.total).toBe(0);
    expect(
      resolveSheet(penetration, { situations: ['spellResistance'] }).casterLevel
        .total,
    ).toBe(2);
    expect(
      resolveSheet(penetration, { situations: ['spells'] }).casterLevel.total,
    ).toBe(0);
  });

  it('preserves typed prerequisites and proficiency requirements without inventing missing grants', () => {
    const cleave = importedCatalogEntrySchema.parse(entry('Cleave'));
    expect(cleave.prerequisites).toEqual([
      { ability: 'strength', min: 13, kind: 'ability' },
      { feat: 'pf1/FUW5mIXHNBBIQ1Sq', kind: 'feat' },
      { bab: 1, kind: 'bab' },
    ]);
    const deadlyStroke = importedCatalogEntrySchema.parse(
      entry('Deadly Stroke'),
    );
    expect(deadlyStroke.prerequisites).toContainEqual({
      proficiency: { choice: true },
      kind: 'proficiency',
    });
    expect(deadlyStroke.prerequisites).toContainEqual({
      bab: 11,
      kind: 'bab',
    });
    const medium = importedCatalogEntrySchema.parse(
      entry('Armor Proficiency, Medium'),
    );
    expect(medium.prerequisites).toEqual([
      { proficiency: { category: 'light' }, kind: 'proficiency' },
    ]);
    expect(entry('Armor Proficiency, Medium')).not.toHaveProperty(
      'proficiencies',
    );
    const result = calculateCharacterSheetProjections(
      featSheet('Armor Proficiency, Medium', 'resolver', { constitution: 14 }),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.proficiencies.grants).toEqual([]);
      expect(projection.prerequisites).toContainEqual(
        expect.objectContaining({
          view: 'current',
          clause: { proficiency: { category: 'light' }, kind: 'proficiency' },
          met: false,
        }),
      );
      expect(projection.resolvedEntries).toContainEqual(
        expect.objectContaining({
          counting: true,
          entry: expect.objectContaining({ kind: 'feat' }),
        }),
      );
    }
  });

  it("applies the skill-pair feats +2, or +4 with 10 or more ranks, from each skill's recorded ranks (rank-modifiers slice 2, #777)", () => {
    for (const [name, targets] of [
      ['Animal Affinity', ['skill.han', 'skill.rid']],
      ['Stealthy', ['skill.ste', 'skill.esc']],
      ['Acrobatic', ['skill.acr', 'skill.fly']],
      ['Athletic', ['skill.clm', 'skill.swm']],
    ] as const)
      expectAutomaticSkillPair({ modifiers: modifiers(name), targets });
    expect(
      modifiers('Combat Reflexes').filter((row) =>
        row.target.startsWith('attack'),
      ),
    ).toEqual([]);
    expect(resolveSheet(modifiers('Arcane Armor Mastery')).spellDC.total).toBe(
      0,
    );
  });

  const agileSituations = [
    {
      local: 'Small or larger (baseline CMB uses Strength)',
      sheetEntryId: 'feat-row',
    },
  ];

  // The old test computed the ordinary CMB as floor((Strength - 10) / 2) and
  // the Small CMB as the selected one less 1; both are literals here.
  it.each([
    { strength: 18, dexterity: 10, ordinary: 4, selected: 0, small: -1 },
    { strength: 14, dexterity: 14, ordinary: 2, selected: 2, small: 1 },
    { strength: 10, dexterity: 18, ordinary: 0, selected: 4, small: 3 },
  ])(
    'replaces Strength $strength with Dexterity $dexterity for Agile Maneuvers CMB $selected only in its selected size Situation',
    ({ strength, dexterity, ordinary, selected, small }) => {
      const input = featSheet('Agile Maneuvers', 'resolver', {
        strength,
        dexterity,
      });
      expect(
        calculateCharacterSheetProjections(input).current.derivedStatistics.cmb
          .total,
      ).toBe(ordinary);
      const result = calculateCharacterSheetProjections(input, {
        situations: agileSituations,
      });
      for (const projection of [result.current, result.permanent])
        expect(projection.derivedStatistics.cmb.total).toBe(selected);
      const sized = calculateCharacterSheetProjections(input, {
        size: 'small',
        situations: agileSituations,
      });
      for (const projection of [sized.current, sized.permanent])
        expect(projection.derivedStatistics.cmb.total).toBe(small);
    },
  );

  it.each([
    ['tiny', 0],
    ['diminutive', -2],
    ['fine', -6],
  ] as const)(
    'does not add Agile Maneuvers substitution twice at %s size',
    (size, expected) => {
      const input = featSheet('Agile Maneuvers', 'resolver', { dexterity: 14 });
      const baseline = calculateCharacterSheetProjections(
        withFeatInactive(input),
        { size },
      );
      const selected = calculateCharacterSheetProjections(input, { size });
      for (const projection of [
        baseline.current,
        baseline.permanent,
        selected.current,
        selected.permanent,
      ])
        expect(projection.derivedStatistics.cmb.total).toBe(expected);
    },
  );
});

describe('the feats-333 keys', () => {
  const { key, entry, modifiers, definition, featSheet } = featBatch(
    entries,
    'feats-333',
  );

  it('keeps Lunge AC unchanged ordinarily and applies exactly −2 in its Routine Option Situation in both projections', () => {
    // The batch adapter parsed Lunge's Modifier, Notes and prerequisites
    // strictly: one −2 untyped AC Modifier behind its option, text-only Notes
    // and a BAB clause.
    const lunge = definition('Lunge', 'option');
    expect(lunge.modifiers).toEqual([
      {
        target: 'ac',
        bonusType: 'untyped',
        value: -2,
        condition: { option: true },
      },
    ]);
    expect(lunge.situationalNotes?.map((note) => Object.keys(note))).toEqual([
      ['text'],
    ]);
    expect(lunge.prerequisites).toEqual([{ bab: 6, kind: 'bab' }]);
    const input = featSheet('Lunge', 'option', { dexterity: 14 });
    const ordinary = calculateCharacterSheetProjections(input);
    const selected = calculateCharacterSheetProjections(input, {
      situations: [{ option: 'feat' }],
    });
    for (const projection of [ordinary.current, ordinary.permanent]) {
      expect(projection.derivedStatistics.ac.total).toBe(12);
      expect(projection.derivedStatistics.ac.conditional).toContainEqual(
        expect.objectContaining({ source: 'pf1/xq2TFr7bsYBBHOi5', value: -2 }),
      );
    }
    for (const projection of [selected.current, selected.permanent]) {
      expect(projection.derivedStatistics.ac.total).toBe(10);
      expect(
        projection.derivedStatistics.ac.applied.filter(
          (r) => r.source === 'pf1/xq2TFr7bsYBBHOi5',
        ),
      ).toHaveLength(1);
      expect(projection.derivedStatistics.touchAc.total).toBe(10);
      expect(projection.derivedStatistics.flatFootedAc.total).toBe(8);
      expect(projection.derivedStatistics.cmb.total).toBe(0);
    }
    const copied = {
      ...input,
      entries: [
        ...input.entries,
        {
          _id: 'copy-row',
          kind: 'feat' as const,
          active: true,
          catalogEntryId: 'copy',
          state: { kind: 'feat' as const },
        },
      ],
      catalogEntries: [
        ...input.catalogEntries,
        { ...input.catalogEntries[1]!, _id: 'copy' },
      ],
    };
    const result = calculateCharacterSheetProjections(copied, {
      situations: [{ option: 'feat' }, { option: 'copy' }],
    });
    expect(result.current.derivedStatistics.ac.total).toBe(10);
    const inactive = calculateCharacterSheetProjections(
      withFeatInactive(input),
      { situations: [{ option: 'feat' }] },
    );
    expect(inactive.current.derivedStatistics.ac.total).toBe(12);
  });

  it('applies Paired Opportunists +4 circumstance only in its exact entry-scoped attack-of-opportunity Situation', () => {
    const rows = modifiers('Paired Opportunists');
    const situation = rows[0]?.condition?.situation;
    if (typeof situation !== 'object' || !('local' in situation))
      throw new Error('Missing precise local circumstance');
    expect(situation.local).toContain('both you and an adjacent ally');
    expect(resolveSheet(rows)['attack.melee'].total).toBe(0);
    expect(resolveSheet(rows)['attack.ranged'].total).toBe(0);
    const options = {
      situations: [{ ...situation, sheetEntryId: key('Paired Opportunists') }],
    };
    const selected = resolveSheet(rows, options);
    expect(selected['attack.melee'].total).toBe(4);
    expect(selected['attack.ranged'].total).toBe(4);
    expect(selected['damage.melee'].total).toBe(0);
    expect(
      resolveSheet(rows, {
        situations: [{ ...situation, sheetEntryId: 'other' }],
      })['attack.melee'].total,
    ).toBe(0);
    expect(
      resolveSheet(
        [
          ...rows,
          ...rows.map((r) => ({
            ...r,
            sheetEntryId: 'copy',
            catalogEntryId: 'copy',
          })),
        ],
        {
          situations: [
            ...options.situations,
            { ...situation, sheetEntryId: 'copy' },
          ],
        },
      )['attack.melee'].total,
    ).toBe(4);
  });

  it('retains real prerequisites, imports no simple proficiency grant and no Modifier for the prose-only rules', () => {
    expect(
      importedCatalogEntrySchema.parse(entry('Lunge')).prerequisites,
    ).toEqual([{ bab: 6, kind: 'bab' }]);
    expect(
      importedCatalogEntrySchema.parse(entry('Shield Master')).prerequisites,
    ).toContainEqual({
      proficiency: { category: 'shield' },
      kind: 'proficiency',
    });
    expect(
      importedCatalogEntrySchema.parse(entry('Spellbreaker')).prerequisites,
    ).toContainEqual({
      classLevel: 'pf1/WLqBCT5DqmGAx8Wd',
      min: 10,
      kind: 'classLevel',
    });
    expect(
      importedCatalogEntrySchema.parse(entry('Improvised Weapon Mastery'))
        .prerequisites,
    ).toContainEqual({
      anyOf: [
        { feat: 'pf1/bZ1YdzkT8NtRIEJ4', kind: 'feat' },
        { feat: 'pf1/gGfXQq0IZrxdcZDx', kind: 'feat' },
      ],
    });
    expect(entry('Simple Weapon Proficiency')).not.toHaveProperty(
      'proficiencies',
    );
    for (const name of [
      'Signature Skill',
      'Signature Skill (Perception)',
      'Signature Skill (Craft)',
      'Pinpoint Targeting',
      'Improvised Weapon Mastery',
    ])
      expect(modifiers(name), name).toEqual([]);
    expect(assessmentStatus('pf1/DorPGQ2mifJbMKH8')).toBe('unresolved');
  });
});

describe('the feats-334 keys', () => {
  const { key, entry, modifiers, localSituation, featSheet } = featBatch(
    entries,
    'feats-334',
  );

  it('limits Storm-Lashed +2 saves to electricity descriptor or damage and keeps weather replacement penalties out of additive totals', () => {
    const data = modifiers('Storm-Lashed');
    const situation = localSituation('Storm-Lashed', 'saves');
    expect(situation.local).toMatch(/electricity/i);
    expect(situation.local).toMatch(/descriptor|damage/i);
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(
        resolveSheet(data, { situations: [situation] })[target].total,
      ).toBe(2);
      expect(
        resolveSheet(data, {
          situations: [{ ...situation, sheetEntryId: 'other-entry' }],
        })[target].total,
      ).toBe(0);
      expect(resolveSheet(data, { situations: ['spells'] })[target].total).toBe(
        0,
      );
    }
    expect(resolveSheet(data)['skill.per'].total).toBe(0);
    expect(entry('Storm-Lashed').situationalNotes).toContainEqual(
      expect.objectContaining({
        text: expect.stringMatching(/[-−]2.*Perception/i),
      }),
    );
    const input = featSheet('Storm-Lashed', 'localSituation', {
      constitution: 14,
    });
    const ordinary = calculateCharacterSheetProjections(input);
    const conditional = calculateCharacterSheetProjections(input, {
      situations: [{ ...situation, sheetEntryId: 'feat-row' }],
    });
    for (const projection of [ordinary.current, ordinary.permanent])
      expect(projection.derivedStatistics.fortitude.total).toBe(2);
    for (const projection of [conditional.current, conditional.permanent]) {
      expect(projection.derivedStatistics.fortitude.total).toBe(4);
      expect(projection.derivedStatistics.reflex.total).toBe(2);
      expect(projection.derivedStatistics.will.total).toBe(2);
    }
    const copied = data.map((row) => ({
      ...row,
      sheetEntryId: 'copy-row',
      catalogEntryId: 'copy',
    }));
    expect(
      resolveSheet([...data, ...copied], {
        situations: [situation, { ...situation, sheetEntryId: 'copy-row' }],
      })['save.fort'].total,
    ).toBe(2);
  });

  it.each(['bull rush', 'grapple', 'overrun', 'reposition', 'trip'])(
    'uses Feline Grace +2 CMD only against %s and never for the offensive maneuver',
    (maneuver) => {
      const data = modifiers('Feline Grace');
      const situation = {
        local: `vs. ${maneuver}`,
        sheetEntryId: key('Feline Grace'),
      };
      expect(resolveSheet(data).cmd.total).toBe(0);
      expect(resolveSheet(data, { situations: [situation] }).cmd.total).toBe(2);
      expect(resolveSheet(data, { situations: [situation] }).cmb.total).toBe(0);
      const shared = maneuver === 'bull rush' ? 'bullRush' : maneuver;
      expect(resolveSheet(data, { situations: [shared] }).cmd.total).toBe(0);
      expect(
        resolveSheet(data, {
          situations: [{ ...situation, sheetEntryId: 'another-feat' }],
        }).cmd.total,
      ).toBe(0);
      expect(
        resolveSheet(data, {
          situations: [
            situation,
            { local: 'vs. grapple', sheetEntryId: situation.sheetEntryId },
          ],
        }).cmd.total,
      ).toBe(2);
    },
  );

  it('limits Flame Heart caster level and Elemental Focus DC to their chosen Situations without inventing unconditional levels or energy choices', () => {
    const fire = modifiers('Flame Heart');
    const fireSituation = localSituation('Flame Heart', 'casterLevel');
    expect(fireSituation.local).toBe(
      'when casting spells with the fire descriptor',
    );
    expect(resolveSheet(fire).casterLevel.total).toBe(0);
    expect(
      resolveSheet(fire, { situations: [fireSituation] }).casterLevel.total,
    ).toBe(1);
    expect(
      resolveSheet(fire, { situations: ['spells'] }).casterLevel.total,
    ).toBe(0);
    expect(entry('Flame Heart').situationalNotes).toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining('fire resistance 5'),
      }),
    );
    const elemental = modifiers('Elemental Focus');
    const chosenEnergy = localSituation('Elemental Focus', 'spellDC');
    expect(chosenEnergy.local).toBe(
      'for damaging spells of your chosen energy type: acid, cold, electricity, or fire',
    );
    expect(resolveSheet(elemental).spellDC.total).toBe(0);
    expect(
      resolveSheet(elemental, { situations: [chosenEnergy] }).spellDC.total,
    ).toBe(1);
    const copy = elemental.map((row) => ({
      ...row,
      sheetEntryId: 'elemental-copy',
      catalogEntryId: 'elemental-copy',
    }));
    expect(
      resolveSheet([...elemental, ...copy], {
        situations: [
          chosenEnergy,
          { ...chosenEnergy, sheetEntryId: 'elemental-copy' },
        ],
      }).spellDC.total,
    ).toBe(1);
    expect(
      resolveSheet(elemental, { situations: ['spells'] }).spellDC.total,
    ).toBe(0);
    expect(
      importedCatalogEntrySchema.parse(entry('Elemental Focus')).detail,
    ).toMatchObject({ repeatable: 'unreviewed' });
    expect(entry('Elemental Focus').situationalNotes).toContainEqual(
      expect.objectContaining({ text: expect.stringMatching(/do not stack/) }),
    );
  });

  it('grants the actual Additional Traits two-slot allowance in both projections while its assessment stays unresolved', () => {
    const additional = importedCatalogEntrySchema.parse(
      entry('Additional Traits'),
    );
    expect(additional.detail).toMatchObject({ additionalTraits: true });
    expect(additional.grantsSlots).toEqual([{ kind: 'trait', count: 2 }]);
    const input = featSheet('Additional Traits', 'localSituation', {
      constitution: 14,
    });
    const selected = calculateCharacterSheetProjections(input);
    for (const projection of [selected.current, selected.permanent])
      expect(projection.selectionRules.slots).toContainEqual(
        expect.objectContaining({
          kind: 'trait',
          count: 2,
          grantedBy: { kind: 'entry', entryId: 'feat-row' },
        }),
      );
    const inactive = calculateCharacterSheetProjections(
      withFeatInactive(input),
    );
    for (const projection of [inactive.current, inactive.permanent])
      expect(
        projection.selectionRules.slots.filter((slot) => slot.grantedBy),
      ).toEqual([]);
    expect(assessmentStatus(key('Additional Traits'))).toBe('unresolved');
  });

  it('preserves real feat prerequisites and imports no Explorer Modifier for its rank-dependent bonuses', () => {
    const feline = importedCatalogEntrySchema.parse(entry('Feline Grace'));
    expect(feline.prerequisites).toContainEqual({
      ability: 'dexterity',
      min: 13,
      kind: 'ability',
    });
    expect(feline.prerequisiteText).toMatch(/catfolk/i);
    const abeyance = importedCatalogEntrySchema.parse(entry('Abeyance'));
    expect(abeyance.prerequisites).toContainEqual({
      ability: 'intelligence',
      min: 13,
      kind: 'ability',
    });
    expect(abeyance.prerequisites).toContainEqual({
      skillRanks: 'skill.spl',
      min: 5,
      kind: 'skillRanks',
    });
    expect(modifiers('Explorer')).toEqual([]);
    expect(entry('Explorer').description).toMatch(/\+2/);
    expect(entry('Explorer').description).toMatch(/\+4/);
    const jumper = importedCatalogEntrySchema.parse(entry('Jumper'));
    expect(jumper.prerequisites).toContainEqual({
      skillRanks: 'skill.acr',
      min: 1,
      kind: 'skillRanks',
    });
    expect(jumper.prerequisites).toContainEqual({
      unchecked: 'creature type other than humanoid or outsider',
      kind: 'unchecked',
    });
    // The source excludes both creature types despite its Human tag. Keep the
    // unresolved exclusion together so neither fragment can qualify alone.
    expect(jumper.description).toMatch(
      /creature type other than humanoid or outsider/,
    );
  });

  it('binds the #334 follow-up +5, +2 and +4 only to their exact source conditions', () => {
    const wary = modifiers('Wary Smuggler');
    const conceal = localSituation('Wary Smuggler', 'skill.slt');
    expect(conceal.local).toMatch(/small, non-weapon/);
    expect(conceal.local).toMatch(/animal or vehicle/);
    expect(resolveSheet(wary)['skill.slt'].total).toBe(0);
    expect(
      resolveSheet(wary, { situations: [conceal] })['skill.slt'].total,
    ).toBe(5);
    expect(
      resolveSheet(wary, {
        situations: [{ ...conceal, sheetEntryId: 'other' }],
      })['skill.slt'].total,
    ).toBe(0);
    expect(
      resolveSheet(wary, { situations: [conceal] })['skill.ste'].total,
    ).toBe(0);
    expect(entry('Wary Smuggler').situationalNotes).toContainEqual(
      expect.objectContaining({
        text: expect.stringMatching(/urban.*take 10/),
      }),
    );
    const oath = modifiers('Oath of the Unbound');
    const escape = localSituation('Oath of the Unbound', 'cmb');
    const entangle = localSituation('Oath of the Unbound', 'saves');
    expect(escape.local).toBe('to break free of a grapple or pin');
    expect(entangle.local).toMatch(/entangle or slow/);
    expect(resolveSheet(oath).cmb.total).toBe(0);
    expect(resolveSheet(oath, { situations: [escape] }).cmb.total).toBe(2);
    expect(resolveSheet(oath, { situations: ['grapple'] }).cmb.total).toBe(0);
    expect(resolveSheet(oath, { situations: [entangle] }).cmb.total).toBe(0);
    expect(resolveSheet(oath)['ability.str'].total).toBe(0);
    const desert = modifiers('Desert Dweller');
    const glare = localSituation('Desert Dweller', 'saves');
    expect(glare.local).toMatch(/blinded or dazzled by glare/);
    expect(glare.local).toMatch(/desert mirage/);
    expect(resolveSheet(desert)['ability.con'].total).toBe(0);
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
      expect(resolveSheet(oath)[target].total).toBe(0);
      expect(resolveSheet(oath, { situations: [entangle] })[target].total).toBe(
        2,
      );
      expect(resolveSheet(oath, { situations: ['spells'] })[target].total).toBe(
        0,
      );
      expect(resolveSheet(desert)[target].total).toBe(0);
      expect(resolveSheet(desert, { situations: [glare] })[target].total).toBe(
        4,
      );
      expect(
        resolveSheet(desert, { situations: ['illusions'] })[target].total,
      ).toBe(0);
      expect(
        resolveSheet(desert, {
          situations: [{ ...glare, sheetEntryId: 'other' }],
        })[target].total,
      ).toBe(0);
    }
  });
});

describe('the feats-335 keys', () => {
  const { key, entry, modifiers, localSituation, featSheet } = featBatch(
    entries,
    'feats-335',
  );

  it.each([
    { wisdom: 14, charisma: 18, ordinary: 2, conditional: 4 },
    { wisdom: 8, charisma: 18, ordinary: -1, conditional: 3 },
    { wisdom: 14, charisma: 8, ordinary: 2, conditional: -1 },
  ])(
    'preserves Steadfast Personality Wisdom replacement and penalty for $wisdom/$charisma',
    ({ wisdom, charisma, ordinary, conditional }) => {
      const input = featSheet('Steadfast Personality', 'situation', {
        wisdom,
        charisma,
      });
      for (const projection of Object.values(
        calculateCharacterSheetProjections(input),
      ))
        expect(projection.derivedStatistics.will.total).toBe(ordinary);
      for (const projection of Object.values(
        calculateCharacterSheetProjections(input, {
          situations: ['mindAffecting'],
        }),
      ))
        expect(projection.derivedStatistics.will.total).toBe(conditional);
      expect(modifiers('Steadfast Personality')).toContainEqual(
        expect.objectContaining({
          target: 'save.will',
          condition: { situation: 'mindAffecting' },
        }),
      );
    },
  );

  // The old test compared each selected feint total with its own Modifier's
  // value, which also required that value to be that number: the two raw
  // values and the two totals, in the entry's order, are literals here.
  it('limits Out of the Sun +2/+4 to the feat feint and does not add both in natural sunlight', () => {
    const data = modifiers('Out of the Sun');
    expect(
      data.filter((row) => row.target === 'skill.blf').map((row) => row.value),
    ).toEqual([2, 4]);
    const situations = data
      .filter((row) => row.target === 'skill.blf')
      .map((row) => {
        const situation = row.condition?.situation;
        if (typeof situation !== 'object' || !('local' in situation))
          throw new Error('Missing feint Situation');
        return { ...situation, sheetEntryId: key('Out of the Sun') };
      });
    expect(situations).toHaveLength(2);
    for (const [index, value] of [2, 4].entries()) {
      const situation = situations[index]!;
      expect(situation.local).toMatch(/feint|Out of the Sun/);
      expect(
        resolveSheet(data, { situations: [situation] })['skill.blf'].total,
      ).toBe(value);
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
    expect(resolveSheet(data, { situations: [reach] })['ac.other'].total).toBe(
      4,
    );
    expect(
      resolveSheet(data, {
        situations: [{ ...reach, sheetEntryId: 'other' }],
      })['ac.other'].total,
    ).toBe(0);
  });

  // #724: the rank threshold is automatic, read from Stealth's recorded ranks.
  it('gives Skill Focus (Stealth) +3, or +6 at 10 Stealth ranks, with no Situation and no stacking copy', () => {
    const data = modifiers('Skill Focus (Stealth)');
    expectAutomaticSkillFocus({ modifiers: data, target: 'skill.ste' });
    expect(
      resolveSheet(data, { skillRanks: { 'skill.ste': 10 } })['skill.per']
        .total,
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
            : { ...situation, sheetEntryId: key('Empath') },
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

  it('imports the eight source prerequisite clauses with their typed atoms as the batch reviewed them', () => {
    const cases = [
      {
        name: "Nature's Weapons",
        sourceClause: 'Knowledge (nature) or Survival 2 ranks',
        atoms: [
          { feat: 'pf1/bZ1YdzkT8NtRIEJ4', kind: 'feat' },
          { bab: 2, kind: 'bab' },
          {
            anyOf: [
              { skillRanks: 'skill.kna', min: 2, kind: 'skillRanks' },
              { skillRanks: 'skill.sur', min: 2, kind: 'skillRanks' },
            ],
          },
        ],
      },
      {
        name: 'Conceal Aura',
        sourceClause: 'Chaotic, evil, good, or lawful alignment',
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
        atoms: [
          { feat: 'pf1-content/eQhruyN2Z7cfXCjL', kind: 'feat' },
          { characterLevel: 7, kind: 'characterLevel' },
        ],
      },
      {
        name: 'Unyielding Ferocity',
        sourceClause: 'Con 19, ferocity',
        atoms: [
          { ability: 'constitution', min: 19, kind: 'ability' },
          { unchecked: 'ferocity', kind: 'unchecked' },
        ],
      },
      {
        name: 'Pummeling Bully',
        sourceClause:
          'base attack bonus +9, brawler level 5th, or monk level 5th',
        atoms: [
          { feat: 'pf1/CYHloH6aEnfgdxAV', kind: 'feat' },
          { feat: 'pf1/gTrGPxzN054GfpkM', kind: 'feat' },
          { feat: 'pf1/2aTFNMs3pW6nUBlr', kind: 'feat' },
          { feat: 'pf1-content/cfMjSNPlWH9pwL55', kind: 'feat' },
          {
            anyOf: [
              { bab: 9, kind: 'bab' },
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
        atoms: [
          { feat: 'pf1-content/SfA1sbq09qa3S1GF', kind: 'feat' },
          { feat: 'pf1/ZmQkRk93nbHxsQSt', kind: 'feat' },
          {
            anyOf: [
              { bab: 8, kind: 'bab' },
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
        atoms: [
          { ability: 'strength', min: 15, kind: 'ability' },
          { ability: 'dexterity', min: 13, kind: 'ability' },
          { feat: 'pf1/rMR6ahXEfYqASE7D', kind: 'feat' },
          { feat: 'pf1-content/smJnIdniC0at6osM', kind: 'feat' },
          { bab: 9, kind: 'bab' },
          {
            kind: 'unchecked',
            unchecked:
              'no barbarian totem rage powers except those chosen with this feat or Totemic Initiate',
          },
          { unchecked: 'nonlawful alignment', kind: 'unchecked' },
        ],
      },
      {
        name: 'Totemic Master',
        sourceClause:
          'no barbarian totem rage powers except those chosen with this feat, Totemic Disciple, or Totemic Initiate',
        atoms: [
          { ability: 'strength', min: 17, kind: 'ability' },
          { ability: 'dexterity', min: 13, kind: 'ability' },
          { ability: 'wisdom', min: 13, kind: 'ability' },
          { feat: 'pf1/rMR6ahXEfYqASE7D', kind: 'feat' },
          { feat: 'pf1-content/23vl8taZ6srdVZQL', kind: 'feat' },
          { feat: 'pf1-content/smJnIdniC0at6osM', kind: 'feat' },
          { bab: 13, kind: 'bab' },
          {
            kind: 'unchecked',
            unchecked:
              'no barbarian totem rage powers except those chosen with this feat, Totemic Disciple, or Totemic Initiate',
          },
          { unchecked: 'nonlawful alignment', kind: 'unchecked' },
        ],
      },
    ];
    for (const example of cases) {
      const imported = importedCatalogEntrySchema.parse(entry(example.name));
      expect(imported.prerequisiteText, example.name).toContain(
        example.sourceClause,
      );
      expect(imported.prerequisites, example.name).toEqual(example.atoms);
    }
    const master = importedCatalogEntrySchema.parse(entry('Totemic Master'));
    expect(
      master.prerequisites?.filter(
        (atom) =>
          'feat' in atom && atom.feat === 'pf1-content/23vl8taZ6srdVZQL',
      ),
    ).toHaveLength(1);
  });
});

describe('the feats-336 keys', () => {
  const { key, entry, modifiers, localSituation, featSheet } = featBatch(
    entries,
    'feats-336',
  );

  it('applies Sea Legs +2 to all three named skills once in both public projections', () => {
    expect(entry('Sea Legs').description).toContain(
      'You gain a +2 bonus on Acrobatics, Climb, and Swim checks.',
    );
    const input = featSheet('Sea Legs', 'situation');
    for (const projection of Object.values(
      calculateCharacterSheetProjections(input),
    )) {
      for (const target of ['skill.acr', 'skill.clm', 'skill.swm'] as const)
        expect(projection.breakdowns[target].total).toBe(2);
      expect(projection.breakdowns['skill.ste'].total).toBe(0);
    }
    const data = modifiers('Sea Legs');
    const copy = data.map((row) => ({
      ...row,
      sheetEntryId: 'sea-legs-copy',
      catalogEntryId: 'sea-legs-copy',
    }));
    for (const target of ['skill.acr', 'skill.clm', 'skill.swm'] as const)
      expect(resolveSheet([...data, ...copy])[target].total).toBe(2);
    const inactive = calculateCharacterSheetProjections(
      withFeatInactive(input),
    );
    for (const projection of Object.values(inactive))
      expect(projection.breakdowns['skill.acr'].total).toBe(0);
  });

  it('keeps Advanced Defensive Combat Training +4 on defensive CMD only', () => {
    expect(entry('Advanced Defensive Combat Training').description).toContain(
      'You gain a +4 bonus to your CMD.',
    );
    const data = modifiers('Advanced Defensive Combat Training');
    expect(resolveSheet(data).cmd.total).toBe(4);
    expect(resolveSheet(data).cmb.total).toBe(0);
    expect(resolveSheet(data)['ac.other'].total).toBe(0);
    for (const projection of Object.values(
      calculateCharacterSheetProjections(
        featSheet('Advanced Defensive Combat Training', 'situation'),
      ),
    )) {
      expect(projection.derivedStatistics.cmd.total).toBe(14);
      expect(projection.derivedStatistics.cmb.total).toBe(0);
    }
  });

  it('limits Greater Uncivilized Tactics +2 to its offensive custom maneuver', () => {
    const name = 'Greater Uncivilized Tactics';
    const feat = entry(name);
    expect(feat.description).toContain(
      'You gain a +2 bonus on checks to use Uncivilized Tactics.',
    );
    expect(feat.description).toContain(
      'stacks with the bonus granted by Improved Uncivilized Tactics',
    );
    const data = modifiers(name);
    const situation = localSituation(name, 'cmb');
    expect(situation.local).toMatch(
      /Uncivilized Tactics combat maneuver checks/i,
    );
    expect(resolveSheet(data).cmb.total).toBe(0);
    expect(resolveSheet(data, { situations: [situation] }).cmb.total).toBe(2);
    expect(resolveSheet(data, { situations: [situation] }).cmd.total).toBe(0);
    expect(resolveSheet(data, { situations: ['grapple'] }).cmb.total).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [{ ...situation, sheetEntryId: 'another-feat' }],
      }).cmb.total,
    ).toBe(0);
  });

  it('limits Reach Defense +2 dodge to attacks of opportunity from nonadjacent opponents', () => {
    expect(entry('Reach Defense').description).toContain(
      '+2 dodge bonus to Armor Class against attacks of opportunity from opponents that are not adjacent to you',
    );
    const data = modifiers('Reach Defense');
    const situation = localSituation('Reach Defense', 'ac');
    expect(situation.local).toMatch(/attacks of opportunity/i);
    expect(situation.local).toMatch(/nonadjacent/i);
    expect(resolveSheet(data)['ac.other'].total).toBe(0);
    expect(
      resolveSheet(data, { situations: [situation] })['ac.other'].total,
    ).toBe(2);
    expect(
      resolveSheet(data, { situations: ['within30ft'] })['ac.other'].total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [{ ...situation, sheetEntryId: 'another-feat' }],
      })['ac.other'].total,
    ).toBe(0);
    const copied = data.map((row) => ({
      ...row,
      sheetEntryId: 'reach-defense-copy',
      catalogEntryId: 'reach-defense-copy',
    }));
    expect(
      resolveSheet([...data, ...copied], {
        situations: [
          situation,
          { ...situation, sheetEntryId: 'reach-defense-copy' },
        ],
      })['ac.other'].total,
    ).toBe(2);
    const projections = calculateCharacterSheetProjections(
      featSheet('Reach Defense', 'situation'),
      { situations: [{ ...situation, sheetEntryId: 'feat-row' }] },
    );
    for (const projection of Object.values(projections)) {
      expect(projection.derivedStatistics.ac.total).toBe(12);
      expect(projection.derivedStatistics.touchAc.total).toBe(12);
      expect(projection.derivedStatistics.flatFootedAc.total).toBe(10);
    }
  });

  it('applies Focused Phantom +4 concentration once for its adjacent-or-consciousness condition', () => {
    expect(entry('Focused Phantom').description).toContain(
      'adjacent to your phantom or your phantom is within your consciousness',
    );
    expect(entry('Focused Phantom').description).toContain(
      '+4 bonus on concentration checks',
    );
    const data = modifiers('Focused Phantom');
    const situation = localSituation('Focused Phantom', 'concentration');
    expect(situation.local).toMatch(/adjacent.*or.*consciousness/i);
    expect(data.filter((row) => row.target === 'concentration')).toHaveLength(
      1,
    );
    expect(resolveSheet(data).concentration.total).toBe(0);
    expect(
      resolveSheet(data, { situations: [situation, situation] }).concentration
        .total,
    ).toBe(4);
    expect(
      resolveSheet(data, { situations: ['spells'] }).concentration.total,
    ).toBe(0);
    expect(
      resolveSheet(data, { situations: [situation] }).casterLevel.total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [{ ...situation, sheetEntryId: 'another-feat' }],
      }).concentration.total,
    ).toBe(0);
  });

  it.each([
    [0, 2],
    [9, 2],
    [10, 4],
    [19, 4],
    [20, 4],
  ])(
    'uses Casual Illusionist level %i bonus +%i only while gnome magic remains unused',
    (level, bonus) => {
      expect(entry('Casual Illusionist').description).toContain(
        'At 10th level, these bonuses increase to +4.',
      );
      const data = modifiers('Casual Illusionist');
      const situation = localSituation('Casual Illusionist', 'skill.blf');
      expect(situation.local).toMatch(/gnome magic.*unused/i);
      for (const target of ['skill.blf', 'skill.dis', 'skill.slt'] as const) {
        expect(resolveSheet(data, { level })[target].total).toBe(0);
        expect(
          resolveSheet(data, { level, situations: [situation] })[target].total,
        ).toBe(bonus);
        expect(
          resolveSheet(data, {
            level,
            situations: [{ ...situation, sheetEntryId: 'another-feat' }],
          })[target].total,
        ).toBe(0);
        expect(
          resolveSheet(data, { level, situations: ['spells'] })[target].total,
        ).toBe(0);
      }
      expect(
        resolveSheet(data, { level, situations: [situation] })['skill.ste']
          .total,
      ).toBe(0);
      const copy = data.map((row) => ({
        ...row,
        sheetEntryId: 'illusionist-copy',
        catalogEntryId: 'illusionist-copy',
      }));
      expect(
        resolveSheet([...data, ...copy], {
          level,
          situations: [
            situation,
            { ...situation, sheetEntryId: 'illusionist-copy' },
          ],
        })['skill.blf'].total,
      ).toBe(bonus);
    },
  );

  it('applies Persuasive Bribery +2 Diplomacy once to bribery or conjured-creature bargaining', () => {
    const data = modifiers('Persuasive Bribery');
    const situation = localSituation('Persuasive Bribery', 'skill.dip');
    expect(situation.local).toMatch(/brib.*or.*conjured/i);
    expect(data.filter((row) => row.target === 'skill.dip')).toHaveLength(1);
    expect(resolveSheet(data)['skill.dip'].total).toBe(0);
    expect(
      resolveSheet(data, { situations: [situation, situation] })['skill.dip']
        .total,
    ).toBe(2);
    expect(
      resolveSheet(data, { situations: [situation] })['ability.cha'].total,
    ).toBe(0);
    expect(
      resolveSheet(data, { situations: ['spells'] })['skill.dip'].total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [{ ...situation, sheetEntryId: 'another-feat' }],
      })['skill.dip'].total,
    ).toBe(0);
    expect(entry('Persuasive Bribery').situationalNotes).toContainEqual(
      expect.objectContaining({
        text: expect.stringMatching(/Charisma checks/i),
      }),
    );
  });

  it('imports the source prerequisite clauses with their unsupported and grouped atoms', () => {
    const counter = importedCatalogEntrySchema.parse(entry('Counter Reflexes'));
    expect(counter.prerequisiteText).toContain(
      'base attack bonus +9, brawler level 6th, or monk level 6th',
    );
    expect(counter.prerequisites).toContainEqual({
      anyOf: [
        { bab: 9, kind: 'bab' },
        { classLevel: 'pf1/iDlGMIezGuqqt8Us', min: 6, kind: 'classLevel' },
        { classLevel: 'pf1/W8dxwZ1CZiwLKsqr', min: 6, kind: 'classLevel' },
      ],
    });
    const silent = importedCatalogEntrySchema.parse(entry('Silent Kill'));
    expect(silent.prerequisiteText).toContain(
      'assassinate advanced slayer talent or ninja master trick',
    );
    expect(silent.prerequisites).toContainEqual({
      unchecked: 'assassinate advanced slayer talent or ninja master trick',
      kind: 'unchecked',
    });
    const warleader = importedCatalogEntrySchema.parse(
      entry("Warleader's Rage"),
    );
    expect(warleader.prerequisiteText).toContain('non-lawful');
    expect(warleader.prerequisites).toContainEqual({
      unchecked: 'non-lawful',
      kind: 'unchecked',
    });
    const seaLegs = importedCatalogEntrySchema.parse(entry('Sea Legs'));
    expect(seaLegs.prerequisites).toContainEqual({
      unchecked: 'Profession (sailor) 5 ranks',
      kind: 'unchecked',
    });
  });

  it('keeps the three Mythic definitions prose-only, with unresolved assessments, without activating their mechanics', () => {
    for (const name of [
      'Elemental Channel (Mythic)',
      'Combat Reflexes (Mythic)',
      'Deceitful (Mythic)',
    ]) {
      const feat = entry(name);
      expect(feat.modifiers).toEqual([]);
      expect(feat.description).toMatch(/mythic power/i);
      expect(assessmentStatus(key(name)), name).toBe('unresolved');
    }
  });

  it('imports no Aberration-Bane Caster Modifier for its favored-enemy calculations despite two checked required Notes', () => {
    const name = 'Aberration-Bane Caster';
    const feat = entry(name);
    expect(feat.description).toMatch(
      /half of your favored enemy bonus against aberrations/i,
    );
    expect(modifiers(name)).toEqual([]);
    expect(resolveSheet(modifiers(name)).spellDC.total).toBe(0);
    expect(
      resolveSheet(modifiers(name), { situations: ['spellResistance'] })
        .casterLevel.total,
    ).toBe(0);
    expect(feat.situationalNotes).toContainEqual(
      expect.objectContaining({
        text: expect.stringMatching(/aberrations.*favored[- ]enemy/i),
      }),
    );
    const required = curation.records.filter(
      (row) => row.externalKey === key(name) && row.kind === 'note',
    );
    expect(required).toHaveLength(2);
    expect(required.every((row) => row.status === 'checked')).toBe(true);
  });

  it("preserves first-attack timing for Sword's Shadow and target-turn timing for Raking Claws", () => {
    const sword = entry("Sword's Shadow");
    expect(sword.description).toContain(
      'successfully damage an enemy with the first attack of a full attack',
    );
    const swordNotes = sword.situationalNotes?.map((row) => row.text).join(' ');
    expect(swordNotes).toMatch(/first attack.*full attack/i);
    expect(swordNotes).not.toMatch(/first hit/i);
    expect(swordNotes).toMatch(/immediate[- ]action/i);
    expect(swordNotes).toMatch(/next attack/i);
    const claws = entry('Raking Claws');
    expect(claws.description).toContain('at the start of his turn each round');
    const clawNotes = claws.situationalNotes?.map((row) => row.text).join(' ');
    expect(clawNotes).toMatch(/1d6.*bleed/i);
    expect(clawNotes).toMatch(
      /start of (?:the |its |his )?(?:target|opponent)[’']s turn/i,
    );
    expect(clawNotes).toMatch(/DC 15.*Heal.*magical healing/i);
    expect(claws.modifiers).toEqual([]);
  });

  it("imports Saddle Shrieker's capped mount bonus as Notes and its rider penalty on attack and CMB", () => {
    const saddle = entry('Saddle Shrieker');
    expect(saddle.description).toContain(
      "this penalty increases by -1 and the bonus to your mount's attack and damage increases by +1 to a maximum of +5",
    );
    const notes = saddle.situationalNotes?.map((row) => row.text).join(' ');
    expect(notes).toMatch(/your penalty increases by [-−]1/i);
    expect(notes).toMatch(/only the mount[’']s bonus capped at \+5/i);
    expect(notes).toMatch(/BAB \+4.*each \+4/i);
    expect(
      modifiers(saddle.name)
        .map((row) => row.target)
        .sort(),
    ).toEqual(['attack', 'cmb']);
  });

  it.each([
    [0, -1],
    [3, -1],
    [4, -2],
    [16, -5],
    [19, -5],
    [20, -6],
    [24, -7],
  ])(
    'applies Saddle Shrieker rider penalty %i BAB → %i without capping at the mount bonus',
    (bab, penalty) => {
      const data = modifiers('Saddle Shrieker');
      const situation = localSituation('Saddle Shrieker', 'attack');
      expect(situation.local).toMatch(
        /choosing Saddle Shrieker before attacking/i,
      );
      const rider = [
        ...data,
        {
          target: 'bab' as const,
          bonusType: 'base' as const,
          value: bab,
          sheetEntryId: 'fixture-bab',
          catalogEntryId: 'fixture-bab',
          entryName: 'Fixture BAB',
          source: 'fixture-bab',
          builtIn: false,
        },
      ];
      for (const target of ['attack.melee', 'attack.ranged', 'cmb'] as const) {
        expect(resolveSheet(rider)[target].total).toBe(0);
        expect(
          resolveSheet(rider, { situations: [situation] })[target].total,
        ).toBe(penalty);
        expect(
          resolveSheet(rider, { situations: ['mounted'] })[target].total,
        ).toBe(0);
        expect(
          resolveSheet(rider, {
            situations: [{ ...situation, sheetEntryId: 'another-feat' }],
          })[target].total,
        ).toBe(0);
      }
      expect(
        resolveSheet(rider, { situations: [situation] })['damage.melee'].total,
      ).toBe(0);
      expect(
        resolveSheet(rider, { situations: [situation] })['damage.ranged'].total,
      ).toBe(0);
    },
  );
});

describe('the feats-337 keys', () => {
  const { key, entry, modifiers, localSituation, featSheet } = featBatch(
    entries,
    'feats-337',
  );

  it('applies Scarred Legion Intimidate +2 ordinarily while restricting morale Will +2 to its adjacent ally or charge circumstance', () => {
    const data = modifiers('Scarred Legion');
    const adjacent = localSituation('Scarred Legion', 'save.will');
    expect(adjacent.local).toMatch(/adjacent.*ally/i);
    expect(adjacent.local).toMatch(/charg/i);
    expect(resolveSheet(data)['skill.int'].total).toBe(2);
    expect(resolveSheet(data)['save.will'].total).toBe(0);
    expect(
      resolveSheet(data, { situations: [adjacent] })['save.will'].total,
    ).toBe(2);
    expect(
      resolveSheet(data, { situations: ['charging'] })['save.will'].total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [{ ...adjacent, sheetEntryId: 'other' }],
      })['save.will'].total,
    ).toBe(0);
    const input = featSheet('Scarred Legion', 'situation', { wisdom: 14 });
    for (const projection of Object.values(
      calculateCharacterSheetProjections(input),
    )) {
      expect(projection.breakdowns['skill.int'].total).toBe(2);
      expect(projection.derivedStatistics.will.total).toBe(2);
    }
    for (const projection of Object.values(
      calculateCharacterSheetProjections(input, {
        situations: [{ ...adjacent, sheetEntryId: 'feat-row' }],
      }),
    ))
      expect(projection.derivedStatistics.will.total).toBe(4);
  });

  it('keeps Snake Sidewind defensive trip CMD +4 distinct from offensive trip and avoiding prone', () => {
    const data = modifiers('Snake Sidewind');
    const prone = localSituation('Snake Sidewind', 'skill.acr');
    expect(prone.local).toMatch(/avoid.*knocked prone/i);
    const defensiveTrip = localSituation('Snake Sidewind', 'cmd');
    expect(defensiveTrip.local).toMatch(/against trip combat maneuvers/i);
    expect(resolveSheet(data).cmd.total).toBe(0);
    expect(resolveSheet(data, { situations: [defensiveTrip] }).cmd.total).toBe(
      4,
    );
    expect(resolveSheet(data, { situations: ['trip'] }).cmd.total).toBe(0);
    expect(
      resolveSheet(data, { situations: ['bullRush', 'spells'] }).cmd.total,
    ).toBe(0);
    expect(resolveSheet(data)['skill.acr'].total).toBe(0);
    expect(resolveSheet(data, { situations: [prone] })['skill.acr'].total).toBe(
      4,
    );
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(resolveSheet(data, { situations: ['trip'] })[target].total).toBe(
        0,
      );
      expect(resolveSheet(data, { situations: [prone] })[target].total).toBe(4);
    }
    expect(
      resolveSheet(data, {
        situations: [{ ...prone, sheetEntryId: 'other' }],
      })['skill.acr'].total,
    ).toBe(0);
  });

  it('limits Shadow Dodge +3 dodge AC to movement, lighting and sight conditions without claiming automatic detection', () => {
    const data = modifiers('Shadow Dodge');
    const shadow = localSituation('Shadow Dodge', 'ac.other');
    expect(shadow.local).toMatch(/speed/i);
    expect(shadow.local).toMatch(/normal.*dim|dim.*normal/i);
    expect(shadow.local).toMatch(/sight/i);
    expect(shadow.local).toMatch(/true seeing/i);
    expect(resolveSheet(data)['ac.other'].total).toBe(0);
    expect(resolveSheet(data, { situations: [shadow] })['ac.other'].total).toBe(
      3,
    );
    expect(
      resolveSheet(data, { situations: ['charging'] })['ac.other'].total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [{ ...shadow, sheetEntryId: 'other' }],
      })['ac.other'].total,
    ).toBe(0);
  });

  it('preserves Drunken Brawler one-hour Reflex -2 after its Fortitude and Will +2 bonuses can end', () => {
    const data = modifiers('Drunken Brawler');
    const bonuses = localSituation('Drunken Brawler', 'save.fort');
    const penalty = localSituation('Drunken Brawler', 'save.ref');
    expect(bonuses.local).toMatch(
      /hour.*temporary hit points|temporary hit points.*hour/i,
    );
    expect(penalty.local).toMatch(/hour/i);
    expect(penalty.local).not.toMatch(/until.*temporary hit points/i);
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const)
      expect(resolveSheet(data)[target].total).toBe(0);
    const drinking = resolveSheet(data, { situations: [bonuses, penalty] });
    expect(drinking['save.fort'].total).toBe(2);
    expect(drinking['save.will'].total).toBe(2);
    expect(drinking['save.ref'].total).toBe(-2);
    const lostTemporaryHp = resolveSheet(data, { situations: [penalty] });
    expect(lostTemporaryHp['save.fort'].total).toBe(0);
    expect(lostTemporaryHp['save.will'].total).toBe(0);
    expect(lostTemporaryHp['save.ref'].total).toBe(-2);
    const copy = data.map((row) => ({
      ...row,
      sheetEntryId: 'copied-brawler',
      catalogEntryId: 'copied-brawler',
    }));
    const copied = resolveSheet([...data, ...copy], {
      situations: [
        bonuses,
        penalty,
        { ...bonuses, sheetEntryId: 'copied-brawler' },
        { ...penalty, sheetEntryId: 'copied-brawler' },
      ],
    });
    expect(copied['save.fort'].total).toBe(2);
    expect(copied['save.will'].total).toBe(2);
    expect(copied['save.ref'].total).toBe(-2);
  });

  it.each([
    {
      name: 'Marid Coldsnap',
      bab: 13,
      classLevel: 'pf1/W8dxwZ1CZiwLKsqr',
      min: 11,
    },
    {
      name: 'Linnorm Wrath',
      bab: 9,
      classLevel: 'pf1/W8dxwZ1CZiwLKsqr',
      min: 9,
    },
    {
      name: 'Guarded Charge',
      bab: 6,
      classLevel: 'pf1/WLqBCT5DqmGAx8Wd',
      min: 4,
    },
  ])(
    'preserves the source BAB-or-class-level prerequisite alternatives for $name',
    ({ name, bab, classLevel, min }) => {
      const feat = importedCatalogEntrySchema.parse(entry(name));
      expect(feat.prerequisites).toContainEqual({
        anyOf: [
          { bab, kind: 'bab' },
          { classLevel, min, kind: 'classLevel' },
        ],
      });
      expect(feat.prerequisiteText).toContain(`base attack bonus +${bab} or`);
    },
  );

  it('imports the source-evidenced armor and divine-class prerequisite clauses', () => {
    for (const { name, clause } of [
      {
        name: 'Poised Bearing',
        clause: 'proficiency with medium or heavy armor',
      },
      { name: 'Divine Expression', clause: 'cleric or oracle level 1st' },
    ])
      expect(
        importedCatalogEntrySchema.parse(entry(name)).prerequisiteText,
        name,
      ).toContain(clause);
    expect(entry('Poised Bearing').prerequisites).toContainEqual({
      unchecked: 'proficiency with medium or heavy armor',
      kind: 'unchecked',
    });
    expect(entry('Divine Expression').prerequisites).toContainEqual({
      anyOf: [
        { classLevel: 'pf1/SjFqQceVeVBzBwgn', min: 1, kind: 'classLevel' },
        { classLevel: 'pf1/5S0u8yFcP861wgd1', min: 1, kind: 'classLevel' },
      ],
    });
  });

  it("keeps Cockatrice Strike's source BAB +16 and imports no Modifier for Skill Focus (Lore)'s rank and subskill formula", async () => {
    const cockatrice = importedCatalogEntrySchema.parse(
      entry('Cockatrice Strike'),
    );
    expect(cockatrice.prerequisiteText).toContain('base attack bonus +16');
    expect(cockatrice.prerequisites).toContainEqual({ bab: 16, kind: 'bab' });
    expect(cockatrice.prerequisites).not.toContainEqual({
      bab: 14,
      kind: 'bab',
    });
    const lore = importedCatalogEntrySchema.parse(entry('Skill Focus (Lore)'));
    // The store record the import read, found by its key, as the old test read
    // the batch tree's copy of it.
    const raw = upstreamRecord.parse(
      parse(
        await readFile(
          `${pinnedStore}/${await pinnedRecordFile(key('Skill Focus (Lore)'))}`,
          'utf8',
        ),
      ),
    );
    expect(raw.system.changes).toEqual([
      {
        _id: 't1ujoxfe',
        formula: 'ifelse(gte(@skills.lor.subskills.lor1.rank,10),6,3)',
        target: 'skill.lor',
        type: 'untyped',
      },
    ]);
    expect(lore.modifiers).toEqual([]);
  });

  it('adds Champion of Destruction damage against lawful and good creatures within one entry while suppressing same-Source copies', () => {
    const data = modifiers('Champion of Destruction');
    const good = localSituation('Champion of Destruction', 'damage');
    expect(good.local).toMatch(/against good creatures/i);
    expect(data.filter((row) => row.target === 'damage')).toHaveLength(2);
    for (const modifier of data.filter((row) => row.target === 'damage'))
      expect(modifier).toMatchObject({
        value: 2,
        bonusType: 'untyped',
        stacksWithinEntry: true,
      });
    expect(resolveSheet(data)['damage.melee'].total).toBe(0);
    expect(
      resolveSheet(data, { situations: ['lawfulCreatures'] })['damage.melee']
        .total,
    ).toBe(2);
    expect(
      resolveSheet(data, { situations: [good] })['damage.melee'].total,
    ).toBe(2);
    expect(
      resolveSheet(data, { situations: ['lawfulCreatures', good] })[
        'damage.melee'
      ].total,
    ).toBe(4);
    const copy = data.map((row) => ({
      ...row,
      sheetEntryId: 'copied-champion',
      catalogEntryId: 'copied-champion',
    }));
    expect(
      resolveSheet([...data, ...copy], {
        situations: [
          'lawfulCreatures',
          good,
          { ...good, sheetEntryId: 'copied-champion' },
        ],
      })['damage.melee'].total,
    ).toBe(4);
  });

  // The old test compared each tier's selected total with its own Modifier's
  // value, which also required that value to be that number: the two raw
  // values and the two totals, in the entry's order, are literals here.
  it('keeps Deny the Reaper Heal rank tiers at +2 or +4 and does not add both when selected together', () => {
    const data = modifiers('Deny the Reaper');
    const tiers = data.filter((row) => row.target === 'skill.hea');
    expect(tiers.map((row) => row.value).sort()).toEqual([2, 4]);
    expect(tiers.map((row) => row.value)).toEqual([2, 4]);
    const situations = tiers.map((row) => {
      const situation = row.condition?.situation;
      if (typeof situation !== 'object' || !('local' in situation))
        throw new Error('Missing Heal rank Situation');
      expect(row.stacksWithinEntry).not.toBe(true);
      expect(situation.local).toMatch(/10.*ranks.*Heal/i);
      return { ...situation, sheetEntryId: key('Deny the Reaper') };
    });
    expect(resolveSheet(data)['skill.hea'].total).toBe(0);
    for (const [index, value] of [2, 4].entries())
      expect(
        resolveSheet(data, { situations: [situations[index]!] })['skill.hea']
          .total,
      ).toBe(value);
    expect(resolveSheet(data, { situations })['skill.hea'].total).toBe(4);
  });
});

describe('the feats-338 keys', () => {
  const { entry, modifiers, localSituation, featSheet } = featBatch(
    entries,
    'feats-338',
  );

  it('uses registered shared Situations on every entry of the batch preview and keeps distinct compound circumstances local', () => {
    const registered = new Set(curation.situations.map((row) => row.key));
    for (const key of featBatches['feats-338'].every) {
      const parsed = importedCatalogEntrySchema.parse(entries.get(key));
      for (const situation of [
        ...parsed.modifiers.map((row) => row.condition?.situation),
        ...(parsed.situationalNotes ?? []).flatMap((row) => [
          row.situation,
          row.condition?.situation,
        ]),
      ]) {
        if (typeof situation === 'string')
          expect(registered.has(situation), parsed.name).toBe(true);
      }
    }
    for (const modifier of modifiers('Pure Faith'))
      expect(modifier.condition?.situation).toBe('poison');
    expect(localSituation('Shrouded in Mystery', 'save.will').local).toMatch(
      /humanoid.*mind.affecting|mind.affecting.*humanoid/i,
    );
  });

  it('applies Rubble Skirmisher CMB and CMD +2 only in naturally occurring difficult terrain', () => {
    const data = modifiers('Rubble Skirmisher');
    const terrain = localSituation('Rubble Skirmisher', 'cmb');
    expect(terrain.local).toMatch(/naturally occurring difficult terrain/i);
    for (const target of ['cmb', 'cmd'] as const) {
      expect(data.find((row) => row.target === target)).toMatchObject({
        bonusType: 'circumstance',
        value: 2,
      });
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(resolveSheet(data, { situations: [terrain] })[target].total).toBe(
        2,
      );
      expect(
        resolveSheet(data, { situations: ['difficultTerrain'] })[target].total,
      ).toBe(0);
      expect(
        resolveSheet(data, {
          situations: [{ ...terrain, sheetEntryId: 'other' }],
        })[target].total,
      ).toBe(0);
    }
    const copy = data.map((row) => ({
      ...row,
      sheetEntryId: 'copied-rubble',
      catalogEntryId: 'copied-rubble',
    }));
    const result = resolveSheet([...data, ...copy], {
      situations: [terrain, { ...terrain, sheetEntryId: 'copied-rubble' }],
    });
    expect(result.cmb.total).toBe(2);
    expect(result.cmd.total).toBe(2);
  });

  it('applies Pure Faith sacred +4 to poison saves through the shared Situation and suppresses same-Source copies', () => {
    const data = modifiers('Pure Faith');
    const copy = data.map((row) => ({
      ...row,
      sheetEntryId: 'copied-pure-faith',
      catalogEntryId: 'copied-pure-faith',
    }));
    expect(data).toContainEqual(
      expect.objectContaining({
        target: 'saves',
        bonusType: 'sacred',
        value: 4,
        condition: { situation: 'poison' },
      }),
    );
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(resolveSheet(data, { situations: ['poison'] })[target].total).toBe(
        4,
      );
      expect(
        resolveSheet(data, { situations: ['disease', 'fear'] })[target].total,
      ).toBe(0);
      expect(
        resolveSheet([...data, ...copy], { situations: ['poison'] })[target]
          .total,
      ).toBe(4);
    }
  });

  it('applies Blood Frenzy Style Strength and Constitution +2 and AC -2 only in its entered stance', () => {
    const data = modifiers('Blood Frenzy Style');
    const stance = localSituation('Blood Frenzy Style', 'ability.str');
    expect(stance.local).toMatch(
      /immediate action.*damage|damage.*immediate action/i,
    );
    for (const [target, value] of [
      ['ability.str', 2],
      ['ability.con', 2],
      ['ac.other', -2],
    ] as const) {
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(resolveSheet(data, { situations: [stance] })[target].total).toBe(
        value,
      );
      expect(
        resolveSheet(data, { situations: ['charging'] })[target].total,
      ).toBe(0);
      expect(
        resolveSheet(data, {
          situations: [{ ...stance, sheetEntryId: 'other' }],
        })[target].total,
      ).toBe(0);
    }
  });

  it('keeps Shrouded in Mystery Bluff +3 and mind-affecting Will +2 restricted to other-race humanoids', () => {
    const data = modifiers('Shrouded in Mystery');
    const bluff = localSituation('Shrouded in Mystery', 'skill.blf');
    const will = localSituation('Shrouded in Mystery', 'save.will');
    for (const situation of [bluff, will]) {
      expect(situation.local).toMatch(/humanoid/i);
      expect(situation.local).toMatch(/race.*other|other.*race/i);
    }
    expect(will.local).toMatch(/mind.affecting/i);
    expect(resolveSheet(data)['skill.blf'].total).toBe(0);
    expect(resolveSheet(data)['save.will'].total).toBe(0);
    expect(resolveSheet(data, { situations: [bluff] })['skill.blf'].total).toBe(
      3,
    );
    expect(resolveSheet(data, { situations: [bluff] })['save.will'].total).toBe(
      0,
    );
    expect(resolveSheet(data, { situations: [will] })['save.will'].total).toBe(
      2,
    );
    expect(
      resolveSheet(data, { situations: ['mindAffecting'] })['save.will'].total,
    ).toBe(0);
  });

  // #724: the rank threshold is automatic, read from Intimidate's recorded ranks.
  it('gives Skill Focus Intimidate +3, or +6 at 10 Intimidate ranks, without a Situation or a stacking same-Source copy', () => {
    const data = modifiers('Skill Focus (Intimidate)');
    expectAutomaticSkillFocus({ modifiers: data, target: 'skill.int' });
    // No ranks and Charisma 10: Skill Focus's +3 alone.
    for (const projection of Object.values(
      calculateCharacterSheetProjections(
        featSheet('Skill Focus (Intimidate)', 'situation', { wisdom: 14 }),
      ),
    ))
      expect(projection.breakdowns['skill.int'].total).toBe(3);
  });

  it('uses Snapping Turtle Shell shield AC +2 while keeping enemy critical confirmation penalties off the owner attacks', () => {
    const data = modifiers('Snapping Turtle Shell');
    const style = localSituation('Snapping Turtle Shell', 'ac.shield');
    expect(style.local).toMatch(/Snapping Turtle Style/i);
    expect(resolveSheet(data)['ac.shield'].total).toBe(0);
    expect(resolveSheet(data, { situations: [style] })['ac.shield'].total).toBe(
      2,
    );
    expect(data.some((row) => row.target.startsWith('attack'))).toBe(false);
    expect(
      entry('Snapping Turtle Shell')
        .situationalNotes?.map((row) => row.text)
        .join(' '),
    ).toMatch(/enemies.*-4.*critical/i);
  });

  it('preserves Snapping Turtle Shell BAB-or-monk prerequisites as alternatives rather than requiring both', () => {
    const feat = importedCatalogEntrySchema.parse(
      entry('Snapping Turtle Shell'),
    );
    expect(feat.prerequisiteText).toContain(
      'base attack bonus +5 or monk level 5th',
    );
    expect(feat.prerequisites).toContainEqual({
      anyOf: [
        { kind: 'bab', bab: 5 },
        { kind: 'classLevel', classLevel: 'pf1/W8dxwZ1CZiwLKsqr', min: 5 },
      ],
    });
  });

  it.each([
    { hitDice: 0, bonus: 1 },
    { hitDice: 4, bonus: 1 },
    { hitDice: 5, bonus: 2 },
    { hitDice: 20, bonus: 5 },
  ])(
    'calculates Mindful Meditation Will +$bonus at $hitDice Hit Dice only within its 24-hour effect circumstance',
    ({ hitDice, bonus }) => {
      const data = modifiers('Mindful Meditation');
      const meditation = localSituation('Mindful Meditation', 'save.will');
      expect(meditation.local).toMatch(/24 hours/i);
      for (const effect of ['charm', 'compulsion', 'emotion', 'fear'])
        expect(meditation.local).toContain(effect);
      expect(resolveSheet(data, { hitDice })['save.will'].total).toBe(0);
      expect(
        resolveSheet(data, { hitDice, situations: [meditation] })['save.will']
          .total,
      ).toBe(bonus);
      expect(
        resolveSheet(data, { hitDice, situations: ['fear'] })['save.will']
          .total,
      ).toBe(0);
      expect(
        resolveSheet(data, {
          hitDice,
          situations: [{ ...meditation, sheetEntryId: 'other' }],
        })['save.will'].total,
      ).toBe(0);
    },
  );

  it('keeps confirmation-only and primary/off-hand mechanics out of broad attack targets', () => {
    for (const name of ['Greater Beast Hunter', 'Multiweapon Fighting'])
      expect(
        modifiers(name).some((row) => row.target.startsWith('attack')),
        name,
      ).toBe(false);
  });

  it('replaces Hardy +2 with Living Fortress +4 only for its defensive spell circumstance and leaves poison at +2', () => {
    const data = modifiers('Living Fortress');
    const fortress = localSituation('Living Fortress', 'saves');
    expect(fortress.local).toMatch(/fighting defensively/i);
    expect(fortress.local).toMatch(/adjacent.*ally/i);
    expect(fortress.local).toMatch(/spells.*spell.like/i);
    const hardy: InputSourcedModifier[] = ['spells', 'poison'].map(
      (situation) => ({
        target: 'saves',
        bonusType: 'racial',
        value: 2,
        condition: { situation },
        sheetEntryId: 'hardy-row',
        catalogEntryId: 'pf1/nEltI9y37rKJTeWo',
        entryName: 'Hardy source example',
        source: 'pf1/nEltI9y37rKJTeWo',
        builtIn: false,
      }),
    );
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
      expect(
        resolveSheet([...hardy, ...data], { situations: ['spells'] })[target]
          .total,
      ).toBe(2);
      expect(
        resolveSheet([...hardy, ...data], {
          situations: ['spells', fortress],
        })[target].total,
      ).toBe(4);
      expect(
        resolveSheet([...hardy, ...data], {
          situations: ['poison', 'fightingDefensively'],
        })[target].total,
      ).toBe(2);
    }
  });

  it('adds Mobility Mythic +2 to the pinned ordinary Mobility +4 without making its final bonus +10', () => {
    const data = modifiers('Mobility (Mythic)');
    const movement = localSituation('Mobility (Mythic)', 'ac');
    expect(movement.local).toMatch(/attacks of opportunity.*movement/i);
    const ordinary: InputSourcedModifier = {
      target: 'ac',
      bonusType: 'dodge',
      value: 4,
      sheetEntryId: 'ordinary-mobility-row',
      catalogEntryId: 'pf1/R7L4SlGRlnThqFrP',
      entryName: 'Ordinary Mobility source example',
      source: 'pf1/R7L4SlGRlnThqFrP',
      builtIn: false,
    };
    expect(resolveSheet([ordinary, ...data])['ac.other'].total).toBe(4);
    expect(
      resolveSheet([ordinary, ...data], { situations: [movement] })['ac.other']
        .total,
    ).toBe(6);
  });

  it('increases Sisterhood Style Reflex and Will +1 to +2 without adding a Fortitude benefit', () => {
    const data = modifiers('Sisterhood Dedication');
    const style = localSituation('Sisterhood Dedication', 'save.ref');
    expect(style.local).toMatch(/longsword.*light or heavy shield/i);
    const ordinary: InputSourcedModifier[] = (
      ['save.ref', 'save.will'] as const
    ).map((target) => ({
      target,
      bonusType: 'untyped',
      value: 1,
      sheetEntryId: 'sisterhood-style-row',
      catalogEntryId: 'pf1-content/Zu2Gk9aejJSM5oPY',
      entryName: 'Sisterhood Style source example',
      source: 'pf1-content/Zu2Gk9aejJSM5oPY',
      builtIn: false,
    }));
    for (const target of ['save.ref', 'save.will'] as const) {
      expect(resolveSheet([...ordinary, ...data])[target].total).toBe(1);
      expect(
        resolveSheet([...ordinary, ...data], { situations: [style] })[target]
          .total,
      ).toBe(2);
    }
    expect(
      resolveSheet([...ordinary, ...data], { situations: [style] })['save.fort']
        .total,
    ).toBe(0);
  });
});
