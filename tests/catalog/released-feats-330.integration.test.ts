/// <reference types="vite/client" />
// @vitest-environment edge-runtime
// pbl-released-feats-1 (PRD #251): the feat batches' integration tests
// (catalogFeats330 to catalogFeats333, feats334 to feats338), on entries
// imported from the pinned store. Each row installs one or two imported feat
// definitions (featDefinition) on a Character of an isolated campaign of a
// fresh Convex test database, with the shared setup of
// released-feat-integration.ts, and runs its batch test's steps against the
// saved sheet: selections, switching a selection off
// and on or replacing its feat, the client preview against the saved sheet
// where the batch test compared them, and each total as a literal. Each
// inserted definition's fields are pinned as literals (`expectPinned`) beside
// the round-trip assertions. Every row ends with the shared refusals
// (`expectRefusals`): the selection cannot be read or edited through another
// campaign or by an outsider, its catalog copies cannot be listed there or by
// an outsider, and an anonymous caller cannot read the sheet.
import { describe, expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { importReleasedEntries } from './released-entries';
import { featBatchKeys } from './released-feat-keys';
import {
  localOn,
  pinnedFieldsCheck,
  replace,
  setUp,
  toggle,
  type FeatRow,
} from './released-feat-integration';
import { assessmentStatus, featBatch } from './released-feat-sheet';

// One import for every row: the nine batches' keys, their references included.
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

/**
 * The rule-bearing fields of each inserted definition the batch tests
 * exercised, as literals: its Modifiers with their conditions (an option, a
 * Situation), its Situational Notes with their Situations and conditions, its
 * prerequisites, its slot grants and the Additional Traits flag. Incidental
 * fields (rule identity, sources and pages, prerequisite text, description,
 * feat types) are left to the catalog digest. The batch tests compared the
 * saved and listed definitions with one built from the batch's committed
 * preview; a round-trip assertion here compares with the inserted
 * definition, so these pins keep a wrongly imported rule failing.
 */
const pinnedFields = {
  'Lightning Reflexes': {
    modifiers: [
      {
        target: 'save.ref',
        bonusType: 'untyped',
        value: 2,
      },
    ],
  },
  'Improved Initiative': {
    modifiers: [
      {
        target: 'init',
        bonusType: 'untyped',
        value: 4,
      },
    ],
  },
  'Intimidating Prowess': {
    modifiers: [
      {
        target: 'skill.int',
        bonusType: 'untyped',
        value: {
          formula: '@ability.str.mod',
        },
      },
    ],
  },
  'Great Fortitude': {
    modifiers: [
      {
        target: 'save.fort',
        bonusType: 'untyped',
        value: 2,
      },
    ],
  },
  Lunge: {
    modifiers: [
      {
        target: 'ac',
        bonusType: 'untyped',
        value: -2,
        condition: {
          option: true,
        },
      },
    ],
    situationalNotes: [
      {
        text: 'Decide to use Lunge before making any attacks. Melee reach increases by 5 feet until the end of your turn; the AC penalty lasts until your next turn.',
      },
    ],
    prerequisites: [
      {
        bab: 6,
        kind: 'bab',
      },
    ],
  },
  'Storm-Lashed': {
    modifiers: [
      {
        target: 'saves',
        bonusType: 'untyped',
        value: 2,
        condition: {
          situation: {
            local:
              'vs. effects with the electricity descriptor or that deal electricity damage',
          },
        },
      },
    ],
    situationalNotes: [
      {
        text: 'Rain reduces visibility by one-quarter and imposes only a −2 Perception penalty. Treat your size as one category larger for wind effects, and halve high-wind Perception penalties. These replace weather effects rather than adding independent penalties.',
      },
    ],
  },
  'Additional Traits': {
    modifiers: [],
    grantsSlots: [
      {
        kind: 'trait',
        count: 2,
      },
    ],
    additionalTraits: true,
  },
  'Steadfast Personality': {
    modifiers: [
      {
        target: 'save.will',
        bonusType: 'untyped',
        value: {
          formula: '@ability.cha.mod - max(0, @ability.wis.mod)',
        },
        condition: {
          situation: 'mindAffecting',
        },
      },
    ],
    situationalNotes: [
      {
        target: 'save.will',
        situation: 'mindAffecting',
        text: 'On Will saves against mind-affecting effects, add Charisma instead of a positive Wisdom bonus. A Wisdom penalty remains in addition to Charisma.',
      },
    ],
  },
  'Skill Focus (Stealth)': {
    modifiers: [
      {
        target: 'skill.ste',
        bonusType: 'untyped',
        value: {
          formula: '3 + 3 * min(1, floor(@skillRanks.ste / 10))',
        },
      },
    ],
    situationalNotes: [
      {
        text: 'Skill Focus (Stealth) grants +3 Stealth, rising to +6 with 10 Stealth ranks. Multiple selections must choose different skills and do not stack.',
      },
    ],
  },
  'Sea Legs': {
    modifiers: [
      {
        target: 'skill.acr',
        bonusType: 'untyped',
        value: 2,
      },
      {
        target: 'skill.clm',
        bonusType: 'untyped',
        value: 2,
      },
      {
        target: 'skill.swm',
        bonusType: 'untyped',
        value: 2,
      },
    ],
    situationalNotes: [
      {
        text: 'Gain +2 Acrobatics, Climb, and Swim.',
      },
    ],
    prerequisites: [
      {
        unchecked: 'Profession (sailor) 5 ranks',
        kind: 'unchecked',
      },
    ],
  },
  'Reach Defense': {
    modifiers: [
      {
        target: 'ac',
        bonusType: 'dodge',
        value: 2,
        condition: {
          situation: {
            local: 'against attacks of opportunity from nonadjacent opponents',
          },
        },
      },
    ],
    situationalNotes: [
      {
        text: 'This feat counts as Dodge only for Mobility and Spring Attack prerequisites. Its +2 dodge AC bonus applies only to attacks of opportunity from nonadjacent opponents.',
      },
      {
        text: 'The appended Combat Trick belongs to the explicitly excluded Unchained stamina subsystem; no baseline modifier or prerequisite is derived from it.',
      },
    ],
    prerequisites: [
      {
        ability: 'dexterity',
        min: 15,
        kind: 'ability',
      },
    ],
  },
  'Scarred Legion': {
    modifiers: [
      {
        target: 'skill.int',
        bonusType: 'untyped',
        value: 2,
      },
      {
        target: 'save.will',
        bonusType: 'morale',
        value: 2,
        condition: {
          situation: {
            local:
              'while adjacent to an ally with Scarred Legion, or until your next turn after a charge begun adjacent to that ally',
          },
        },
      },
    ],
  },
  'Snake Sidewind': {
    modifiers: [
      {
        target: 'cmd',
        bonusType: 'untyped',
        value: 4,
        condition: {
          situation: {
            local: 'against trip combat maneuvers',
          },
        },
      },
      {
        target: 'skill.acr',
        bonusType: 'untyped',
        value: 4,
        condition: {
          situation: {
            local: 'to avoid being knocked prone',
          },
        },
      },
      {
        target: 'saves',
        bonusType: 'untyped',
        value: 4,
        condition: {
          situation: {
            local: 'to avoid being knocked prone',
          },
        },
      },
    ],
    situationalNotes: [
      {
        text: 'While using Snake Style, a critical threat with an unarmed strike lets you replace the confirmation attack roll with a Sense Motive check. On a critical hit with an unarmed strike, spend an immediate action to take a 5-foot step even if you have moved this round. Combat Trick: When replacing confirmation with Sense Motive, spend up to 5 stamina points for an equal bonus on that check.',
      },
    ],
    prerequisites: [
      {
        feat: 'pf1/2aTFNMs3pW6nUBlr',
        kind: 'feat',
      },
      {
        feat: 'pf1-content/FzsUZbC5NBUHzbkV',
        kind: 'feat',
      },
      {
        skillRanks: 'skill.acr',
        min: 3,
        kind: 'skillRanks',
      },
      {
        skillRanks: 'skill.sen',
        min: 6,
        kind: 'skillRanks',
      },
    ],
  },
  'Skill Focus (Intimidate)': {
    modifiers: [
      {
        target: 'skill.int',
        bonusType: 'untyped',
        value: {
          formula: '3 + 3 * min(1, floor(@skillRanks.int / 10))',
        },
      },
    ],
    situationalNotes: [
      {
        text: 'You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6. Special: You can gain this feat multiple times. Its effects do not stack. Each time you take the feat, it applies to a new skill.',
      },
    ],
  },
  'Rubble Skirmisher': {
    modifiers: [
      {
        target: 'cmb',
        bonusType: 'circumstance',
        value: 2,
        condition: {
          situation: {
            local: 'while in a square of naturally occurring difficult terrain',
          },
        },
      },
      {
        target: 'cmd',
        bonusType: 'circumstance',
        value: 2,
        condition: {
          situation: {
            local: 'while in a square of naturally occurring difficult terrain',
          },
        },
      },
    ],
    situationalNotes: [
      {
        text: 'When you are in a square that has naturally occurring difficult terrain (bushes, rubble, undergrowth, and so forth), you gain a +2 circumstance bonus on combat maneuver checks and to your CMD.',
      },
    ],
    prerequisites: [
      {
        ability: 'dexterity',
        min: 13,
        kind: 'ability',
      },
      {
        feat: 'pf1/VMVAqGze4cs3naya',
        kind: 'feat',
      },
      {
        bab: 2,
        kind: 'bab',
      },
    ],
  },
} as const;

const expectPinned = pinnedFieldsCheck(pinnedFields);

const rows: FeatRow[] = [
  {
    batch: 'feats-330',
    title:
      'an installed Lightning Reflexes definition adds +2 Reflex on the shared saved sheet, switched off and on again, and its selection refuses others',
    async check(setup) {
      const { member, scope, insert, fighterLevel, select } = setup;
      const definition = featBatch(entries, 'feats-330').definition(
        'Lightning Reflexes',
        'numeric',
      );
      expectPinned('Lightning Reflexes', definition);
      // The batch adapter parsed this one Modifier strictly.
      expect(definition.modifiers).toEqual([
        { target: 'save.ref', bonusType: 'untyped', value: 2 },
      ]);
      const featId = await insert(definition);
      await fighterLevel();
      await member.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { dexterity: 14 },
        operationId: 'dex-14',
      });
      const before = await setup.readSaved();
      expect(before.calculated.derivedStatistics.reflex.total).toBe(2); // Fighter 1 +0, Dex +2.
      const selectionId = await select(featId);
      const selected = await setup.readSaved();
      expect(
        selected.entries.find((entry) => entry._id === selectionId),
      ).toMatchObject({ active: true, kind: 'feat', catalogEntryId: featId });
      for (const projection of [
        selected.calculated,
        selected.permanentCalculated,
      ]) {
        expect(projection.derivedStatistics.reflex.total).toBe(4);
        expect(projection.derivedStatistics.reflex.applied).toContainEqual(
          expect.objectContaining({
            sheetEntryId: selectionId,
            source: 'pf1/0bZf3SDkvVOe2ujH',
            value: 2,
          }),
        );
      }
      const observed = await setup.readSaved(member);
      expect(observed.calculated.derivedStatistics.reflex.total).toBe(4);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readSaved();
      expect(inactive.calculated.derivedStatistics.reflex.total).toBe(2);
      expect(inactive.permanentCalculated.derivedStatistics.reflex.total).toBe(
        2,
      );
      expect(
        inactive.entries.find((entry) => entry._id === selectionId),
      ).toMatchObject({ active: false, catalogEntryId: featId });
      await toggle(setup, selectionId, true);
      expect(
        (await setup.readSaved()).calculated.derivedStatistics.reflex.total,
      ).toBe(4);
      await setup.expectRefusals(selectionId, false);
      expect(
        (await setup.readSaved()).calculated.derivedStatistics.reflex.total,
      ).toBe(4);
    },
  },
  {
    batch: 'feats-331',
    title:
      'an installed Improved Initiative definition is stored as installed and adds +4 initiative on the shared saved sheet, switched off and on again, and its selection refuses others',
    async check(setup) {
      const { member, scope, insert, fighterLevel, select } = setup;
      const definition = featBatch(entries, 'feats-331').definition(
        'Improved Initiative',
        'numeric',
      );
      expectPinned('Improved Initiative', definition);
      // The batch adapter parsed this one Modifier strictly.
      expect(definition.modifiers).toEqual([
        { target: 'init', bonusType: 'untyped', value: 4 },
      ]);
      const featId = await insert(definition);
      await fighterLevel();
      await member.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { dexterity: 14 },
        operationId: 'dex-14',
      });
      const before = await setup.readSaved();
      expect(before.calculated.derivedStatistics.initiative.total).toBe(2); // Dex 14 contributes +2 before the +4 feat.
      const selectionId = await select(featId);
      const selected = await setup.readSaved();
      // The stored definition is the one installed.
      expect(
        selected.catalogEntries.find((entry) => entry._id === featId),
      ).toMatchObject(definition);
      expect(
        selected.entries.find((entry) => entry._id === selectionId),
      ).toMatchObject({ active: true, kind: 'feat', catalogEntryId: featId });
      for (const projection of [
        selected.calculated,
        selected.permanentCalculated,
      ]) {
        expect(projection.derivedStatistics.initiative.total).toBe(6);
        expect(projection.derivedStatistics.initiative.applied).toContainEqual(
          expect.objectContaining({
            sheetEntryId: selectionId,
            source: 'pf1/Uuiu3p982omhMEPj',
            value: 4,
          }),
        );
      }
      const observed = await setup.readSaved(member);
      expect(observed.calculated.derivedStatistics.initiative.total).toBe(6);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readSaved();
      expect(inactive.calculated.derivedStatistics.initiative.total).toBe(2);
      expect(
        inactive.permanentCalculated.derivedStatistics.initiative.total,
      ).toBe(2);
      expect(
        inactive.entries.find((entry) => entry._id === selectionId),
      ).toMatchObject({ active: false, catalogEntryId: featId });
      await toggle(setup, selectionId, true);
      expect(
        (await setup.readSaved()).calculated.derivedStatistics.initiative.total,
      ).toBe(6);
      await setup.expectRefusals(selectionId, false);
      expect(
        (await setup.readSaved()).calculated.derivedStatistics.initiative.total,
      ).toBe(6);
    },
  },
  {
    batch: 'feats-331',
    title:
      'a saved sheet adds Intimidating Prowess Strength 8 as -1 and Strength 16 as +3 on Intimidate, and its selection refuses others',
    // CRB p. 128: Intimidating Prowess adds the Strength modifier to
    // Intimidate, with no floor (#726), so a saved sheet follows Strength
    // edits both ways.
    async check(setup) {
      const { owner, scope, insert, fighterLevel } = setup;
      const definition = featBatch(entries, 'feats-331').definition(
        'Intimidating Prowess',
        'numeric',
      );
      expectPinned('Intimidating Prowess', definition);
      // The batch adapter parsed this one Modifier strictly.
      expect(definition.modifiers).toEqual([
        {
          target: 'skill.int',
          bonusType: 'untyped',
          value: { formula: '@ability.str.mod' },
        },
      ]);
      const featId = await insert(definition);
      await fighterLevel();
      await owner.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { strength: 8, charisma: 10 },
        operationId: 'strength-8',
      });
      const selectionId = await owner.mutation(
        api.characterSheet.fillSelectionSlot,
        {
          ...scope,
          slotId: 'feat:general',
          position: 0,
          catalogEntryId: featId,
          operationId: 'choose-intimidating-prowess',
        },
      );
      const intimidate = async () => {
        const sheet = await setup.readSaved();
        return [sheet.calculated, sheet.permanentCalculated].map(
          (projection) => projection.breakdowns['skill.int'],
        );
      };
      // Charisma 10 and no ranks: the feat's Strength modifier is the total.
      for (const [strength, value] of [
        [8, -1],
        [16, 3],
      ] as const) {
        if (strength === 16)
          await owner.mutation(api.characterSheet.editBaseScores, {
            ...scope,
            scores: { strength: 16 },
            operationId: 'strength-16',
          });
        const statistics = await intimidate();
        expect(statistics, `Strength ${strength}`).toHaveLength(2);
        for (const statistic of statistics) {
          expect(statistic.total, `Strength ${strength}`).toBe(value);
          expect(statistic.applied, `Strength ${strength}`).toContainEqual(
            expect.objectContaining({
              sheetEntryId: selectionId,
              source: 'pf1/O0jbkTJcIji9BNiF',
              value,
            }),
          );
        }
      }
      await setup.expectRefusals(selectionId, false);
    },
  },
  {
    batch: 'feats-332',
    title:
      'an installed Great Fortitude definition with a confirmed assessment is stored as installed and adds +2 Fortitude on the shared saved sheet, switched off and on again, and its selection refuses others',
    async check(setup) {
      const { member, scope, insert, fighterLevel, select } = setup;
      const definition = featBatch(entries, 'feats-332').definition(
        'Great Fortitude',
        'numeric',
      );
      expectPinned('Great Fortitude', definition);
      // The batch adapter parsed this one Modifier strictly.
      expect(definition.modifiers).toEqual([
        { target: 'save.fort', bonusType: 'untyped', value: 2 },
      ]);
      expect(assessmentStatus(definition.ruleIdentity)).toBe('confirmed');
      const featId = await insert(definition);
      await fighterLevel();
      await member.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { constitution: 14 },
        operationId: 'con-14',
      });
      const before = await setup.readSaved();
      expect(before.calculated.derivedStatistics.fortitude.total).toBe(4); // Fighter 1 grants +2; Constitution 14 adds +2 before the feat.
      const selectionId = await select(featId);
      const selected = await setup.readSaved();
      // The stored definition is the one installed.
      expect(
        selected.catalogEntries.find((entry) => entry._id === featId),
      ).toMatchObject(definition);
      expect(
        selected.entries.find((entry) => entry._id === selectionId),
      ).toMatchObject({ active: true, kind: 'feat', catalogEntryId: featId });
      for (const projection of [
        selected.calculated,
        selected.permanentCalculated,
      ]) {
        expect(projection.derivedStatistics.fortitude.total).toBe(6);
        expect(projection.derivedStatistics.fortitude.applied).toContainEqual(
          expect.objectContaining({
            sheetEntryId: selectionId,
            source: 'pf1/fVRnBIHR4Jq6btvm',
            value: 2,
          }),
        );
      }
      const observed = await setup.readSaved(member);
      expect(observed.calculated.derivedStatistics.fortitude.total).toBe(6);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readSaved();
      expect(inactive.calculated.derivedStatistics.fortitude.total).toBe(4);
      expect(
        inactive.permanentCalculated.derivedStatistics.fortitude.total,
      ).toBe(4);
      expect(
        inactive.entries.find((entry) => entry._id === selectionId),
      ).toMatchObject({ active: false, catalogEntryId: featId });
      await toggle(setup, selectionId, true);
      expect(
        (await setup.readSaved()).calculated.derivedStatistics.fortitude.total,
      ).toBe(6);
      await setup.expectRefusals(selectionId, false);
      expect(
        (await setup.readSaved()).calculated.derivedStatistics.fortitude.total,
      ).toBe(6);
    },
  },
  {
    batch: 'feats-333',
    title:
      'an installed Lunge definition with a confirmed assessment is stored as installed and keeps its −2 AC conditional on its option on the shared saved sheet, switched off and on again, and its selection refuses others',
    async check(setup) {
      const { member, scope, insert, select } = setup;
      const definition = featBatch(entries, 'feats-333').definition(
        'Lunge',
        'option',
      );
      expectPinned('Lunge', definition);
      // The batch adapter parsed Lunge's Modifier, Notes and prerequisites
      // strictly.
      expect(definition.modifiers).toEqual([
        {
          target: 'ac',
          bonusType: 'untyped',
          value: -2,
          condition: { option: true },
        },
      ]);
      expect(
        definition.situationalNotes?.map((note) => Object.keys(note)),
      ).toEqual([['text']]);
      expect(definition.prerequisites).toEqual([{ bab: 6, kind: 'bab' }]);
      expect(assessmentStatus(definition.ruleIdentity)).toBe('confirmed');
      const featId = await insert(definition);
      // The batch test set no Fighter level here.
      await member.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { dexterity: 14 },
        operationId: 'dex-14',
      });
      const before = await setup.readSaved();
      expect(before.calculated.derivedStatistics.ac.total).toBe(12);
      const selectionId = await select(featId);
      const selected = await setup.readSaved();
      // The stored definition is the one installed.
      expect(
        selected.catalogEntries.find((entry) => entry._id === featId),
      ).toMatchObject(definition);
      expect(
        selected.entries.find((entry) => entry._id === selectionId),
      ).toMatchObject({ active: true, kind: 'feat', catalogEntryId: featId });
      for (const projection of [
        selected.calculated,
        selected.permanentCalculated,
      ]) {
        expect(projection.derivedStatistics.ac.total).toBe(12);
        expect(projection.derivedStatistics.ac.conditional).toContainEqual(
          expect.objectContaining({
            sheetEntryId: selectionId,
            source: 'pf1/xq2TFr7bsYBBHOi5',
            value: -2,
            condition: { situation: { option: featId } },
          }),
        );
      }
      // Imported identity stays intact; only the AC Situation is demonstrated.
      expect(definition.ruleIdentity).toBe('pf1/xq2TFr7bsYBBHOi5');
      const observed = await setup.readSaved(member);
      expect(observed.calculated.derivedStatistics.ac.total).toBe(12);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readSaved();
      expect(inactive.calculated.derivedStatistics.ac.total).toBe(12);
      expect(inactive.permanentCalculated.derivedStatistics.ac.total).toBe(12);
      expect(
        inactive.calculated.derivedStatistics.ac.conditional,
      ).not.toContainEqual(
        expect.objectContaining({ source: 'pf1/xq2TFr7bsYBBHOi5' }),
      );
      expect(
        inactive.entries.find((entry) => entry._id === selectionId),
      ).toMatchObject({ active: false, catalogEntryId: featId });
      await toggle(setup, selectionId, true);
      expect(
        (await setup.readSaved()).calculated.derivedStatistics.ac.conditional,
      ).toContainEqual(
        expect.objectContaining({
          source: 'pf1/xq2TFr7bsYBBHOi5',
          value: -2,
        }),
      );
      await setup.expectRefusals(selectionId, false);
      expect(
        (await setup.readSaved()).calculated.derivedStatistics.ac.total,
      ).toBe(12);
    },
  },
  {
    batch: 'feats-334',
    title:
      'Storm-Lashed, then Additional Traits in its place, both with unresolved assessments: stored as installed, the client preview equals the saved sheet, the electricity Situation and the two trait slots follow the selection, and others are refused',
    async check(setup) {
      const { owner, member, scope, insert, fighterLevel, select } = setup;
      const feats = featBatch(entries, 'feats-334');
      const storm = feats.definition('Storm-Lashed', 'localSituation');
      const additional = feats.definition(
        'Additional Traits',
        'localSituation',
      );
      expectPinned('Storm-Lashed', storm);
      expectPinned('Additional Traits', additional);
      for (const definition of [storm, additional])
        expect(assessmentStatus(definition.ruleIdentity), definition.name).toBe(
          'unresolved',
        );
      const stormId = await insert(storm);
      const additionalId = await insert(additional);
      await fighterLevel();
      await member.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: {
          strength: 10,
          dexterity: 10,
          constitution: 14,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        operationId: 'scores-baseline',
      });
      const selectionId = await select(stormId);
      const saved = await setup.readClient();
      // The stored definition is the one installed.
      expect(
        saved.catalogEntries.find((row) => row._id === stormId),
      ).toMatchObject(storm);
      for (const projection of [saved.calculated, saved.permanentCalculated]) {
        expect(projection.derivedStatistics.fortitude.total).toBe(4);
        expect(projection.derivedStatistics.reflex.total).toBe(0);
        expect(projection.derivedStatistics.will.total).toBe(0);
      }
      expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
        saved.calculated.derivedStatistics,
      );
      const options = {
        situations: [{ ...localOn(storm, 'saves'), sheetEntryId: selectionId }],
      };
      const conditional = calculateCharacterSheetPreview(saved, {}, options);
      expect(conditional.derivedStatistics.fortitude.total).toBe(6);
      expect(conditional.derivedStatistics.reflex.total).toBe(2);
      expect(conditional.derivedStatistics.will.total).toBe(2);
      expect(
        (await member.query(api.catalogCopies.list, scope)).find(
          (row) => row._id === stormId,
        ),
      ).toMatchObject(storm);
      expect(
        (await member.query(api.characterSheet.read, scope))?.calculated
          .derivedStatistics.fortitude.total,
      ).toBe(4);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(inactive, {}, options).derivedStatistics
          .fortitude.total,
      ).toBe(4);
      await replace(setup, selectionId, additionalId);
      const traits = await setup.readClient();
      for (const projection of [traits.calculated, traits.permanentCalculated])
        expect(projection.selectionRules.slots).toContainEqual(
          expect.objectContaining({
            kind: 'trait',
            count: 2,
            grantedBy: { kind: 'entry', entryId: selectionId },
          }),
        );
      expect(calculateCharacterSheetPreview(traits).selectionRules).toEqual(
        traits.calculated.selectionRules,
      );
      await toggle(setup, selectionId, false);
      expect(
        (
          await owner.query(api.characterSheet.read, scope)
        )?.calculated.selectionRules.slots.filter(
          (slot) => slot.kind === 'trait' && slot.grantedBy,
        ),
      ).toEqual([]);
      await setup.expectRefusals(selectionId, true);
      expect(
        (await owner.query(api.characterSheet.read, scope))?.entries.find(
          (row) => row._id === selectionId,
        ),
      ).toMatchObject({ active: false, catalogEntryId: additionalId });
    },
  },
  {
    batch: 'feats-335',
    title:
      'Steadfast Personality (unresolved), then Skill Focus (Stealth) (confirmed) in its place: listed as installed, the client preview equals the saved sheet, the mind-affecting Will total and the +3 Stealth follow the selection, and others are refused',
    async check(setup) {
      const { member, scope, insert, fighterLevel, select } = setup;
      const feats = featBatch(entries, 'feats-335');
      const steadfast = feats.definition('Steadfast Personality', 'situation');
      const skillFocus = feats.definition('Skill Focus (Stealth)', 'situation');
      expectPinned('Steadfast Personality', steadfast);
      expectPinned('Skill Focus (Stealth)', skillFocus);
      expect(assessmentStatus(steadfast.ruleIdentity)).toBe('unresolved');
      expect(assessmentStatus(skillFocus.ruleIdentity)).toBe('confirmed');
      const steadfastId = await insert(steadfast);
      const skillId = await insert(skillFocus);
      await fighterLevel();
      await member.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 14,
          charisma: 18,
        },
        operationId: 'steadfast-scores',
      });
      const selectionId = await select(steadfastId);
      const saved = await setup.readClient();
      for (const projection of [saved.calculated, saved.permanentCalculated])
        expect(projection.derivedStatistics.will.total).toBe(2);
      expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
        saved.calculated.derivedStatistics,
      );
      expect(
        calculateCharacterSheetPreview(
          saved,
          {},
          { situations: ['mindAffecting'] },
        ).derivedStatistics.will.total,
      ).toBe(4);
      // The stored definition is the one installed.
      expect(
        (await member.query(api.catalogCopies.list, scope)).find(
          (row) => row._id === steadfastId,
        ),
      ).toMatchObject(steadfast);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(
          inactive,
          {},
          { situations: ['mindAffecting'] },
        ).derivedStatistics.will.total,
      ).toBe(2);
      await replace(setup, selectionId, skillId);
      const skillSaved = await setup.readClient();
      expect(calculateCharacterSheetPreview(skillSaved).skills).toEqual(
        skillSaved.calculated.skills,
      );
      // #724: the closed formula grammar reads skill ranks, so Skill Focus
      // applies its +3 (no Stealth ranks, Dexterity 10) with nothing selected.
      expect(skillFocus.modifiers).toEqual([
        {
          target: 'skill.ste',
          bonusType: 'untyped',
          value: { formula: '3 + 3 * min(1, floor(@skillRanks.ste / 10))' },
        },
      ]);
      expect(skillSaved.calculated.breakdowns['skill.ste'].total).toBe(3);
      expect(
        calculateCharacterSheetPreview(skillSaved).breakdowns['skill.ste']
          .total,
      ).toBe(3);
      await toggle(setup, selectionId, false);
      const skillInactive = await setup.readClient();
      expect(skillInactive.calculated.breakdowns['skill.ste'].total).toBe(0);
      expect(
        calculateCharacterSheetPreview(skillInactive).breakdowns['skill.ste']
          .total,
      ).toBe(0);
      expect(
        (await member.query(api.characterSheet.read, scope))?.calculated
          .breakdowns['skill.ste'].total,
      ).toBe(0);
      await setup.expectRefusals(selectionId, true);
      expect(
        (await setup.owner.query(api.characterSheet.read, scope))?.entries.find(
          (row) => row._id === selectionId,
        ),
      ).toMatchObject({ active: false, catalogEntryId: skillId });
    },
  },
  {
    batch: 'feats-336',
    title:
      'Sea Legs, then Reach Defense in its place, both with unresolved assessments: stored as installed, the client preview equals the saved sheet, the skill and AC totals follow the selection, another Character cannot use them, and others are refused',
    async check(setup) {
      const { owner, member, scope, insert, fighterLevel, select } = setup;
      const feats = featBatch(entries, 'feats-336');
      const seaLegs = feats.definition('Sea Legs', 'situation');
      const reachDefense = feats.definition('Reach Defense', 'situation');
      expectPinned('Sea Legs', seaLegs);
      expectPinned('Reach Defense', reachDefense);
      for (const definition of [seaLegs, reachDefense])
        expect(assessmentStatus(definition.ruleIdentity), definition.name).toBe(
          'unresolved',
        );
      const seaLegsId = await insert(seaLegs);
      const reachDefenseId = await insert(reachDefense);
      await fighterLevel();
      await member.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        operationId: 'scores-baseline',
      });
      const selectionId = await select(seaLegsId);
      const saved = await setup.readClient();
      // The stored definition is the one installed.
      expect(
        saved.catalogEntries.find((row) => row._id === seaLegsId),
      ).toMatchObject(seaLegs);
      for (const projection of [saved.calculated, saved.permanentCalculated])
        for (const target of ['skill.acr', 'skill.clm', 'skill.swm'] as const)
          expect(projection.breakdowns[target].total).toBe(2);
      expect(calculateCharacterSheetPreview(saved).skills).toEqual(
        saved.calculated.skills,
      );
      expect(
        (await member.query(api.catalogCopies.list, scope)).find(
          (row) => row._id === seaLegsId,
        ),
      ).toMatchObject(seaLegs);
      await toggle(setup, selectionId, false);
      const inactive = await owner.query(api.characterSheet.read, scope);
      for (const target of ['skill.acr', 'skill.clm', 'skill.swm'] as const)
        expect(inactive?.calculated.breakdowns[target].total).toBe(0);
      await replace(setup, selectionId, reachDefenseId);
      const reachSaved = await setup.readClient();
      for (const projection of [
        reachSaved.calculated,
        reachSaved.permanentCalculated,
      ])
        expect(projection.derivedStatistics.ac.total).toBe(10);
      expect(
        calculateCharacterSheetPreview(reachSaved).derivedStatistics,
      ).toEqual(reachSaved.calculated.derivedStatistics);
      const situation = localOn(reachDefense, 'ac');
      const options = {
        situations: [{ ...situation, sheetEntryId: selectionId }],
      };
      const preview = calculateCharacterSheetPreview(reachSaved, {}, options);
      expect(preview.derivedStatistics.ac.total).toBe(12);
      expect(preview.derivedStatistics.touchAc.total).toBe(12);
      expect(preview.derivedStatistics.flatFootedAc.total).toBe(10);
      expect(
        calculateCharacterSheetPreview(
          reachSaved,
          {},
          { situations: [{ ...situation, sheetEntryId: 'another-entry' }] },
        ).derivedStatistics.ac.total,
      ).toBe(10);
      expect(
        (await member.query(api.characterSheet.read, scope))?.calculated
          .derivedStatistics.ac.total,
      ).toBe(10);
      await toggle(setup, selectionId, false);
      const reachInactive = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(reachInactive, {}, options)
          .derivedStatistics.ac.total,
      ).toBe(10);
      const otherCharacterId = await member.mutation(
        api.characterSheet.create,
        {
          organizationId: 'org',
          campaignId: scope.campaignId,
          name: 'Other isolated Character',
          kind: 'pc',
          operationId: 'create-other-character',
        },
      );
      const otherScope = { ...scope, characterId: otherCharacterId };
      expect(
        (await member.query(api.catalogCopies.list, otherScope)).some(
          (row) => row._id === seaLegsId || row._id === reachDefenseId,
        ),
      ).toBe(false);
      await expect(
        member.mutation(api.characterSheet.fillSelectionSlot, {
          ...otherScope,
          slotId: 'feat:general',
          position: 0,
          catalogEntryId: reachDefenseId,
          operationId: 'other-character-definition-refused',
        }),
      ).rejects.toThrow('Catalog Entry does not belong to this Character');
      await setup.expectRefusals(selectionId, true);
      expect(
        (await owner.query(api.characterSheet.read, scope))?.entries.find(
          (row) => row._id === selectionId,
        ),
      ).toMatchObject({ active: false, catalogEntryId: reachDefenseId });
    },
  },
  {
    batch: 'feats-337',
    title:
      'Scarred Legion, then Snake Sidewind in its place, both with unresolved assessments: listed as installed, the client preview equals the saved sheet, the adjacent-ally Will and defensive-trip CMD follow the selection, and others are refused',
    async check(setup) {
      const { owner, member, scope, insert, fighterLevel, select } = setup;
      const feats = featBatch(entries, 'feats-337');
      const scarred = feats.definition('Scarred Legion', 'situation');
      const snake = feats.definition('Snake Sidewind', 'situation');
      expectPinned('Scarred Legion', scarred);
      expectPinned('Snake Sidewind', snake);
      for (const definition of [scarred, snake])
        expect(assessmentStatus(definition.ruleIdentity), definition.name).toBe(
          'unresolved',
        );
      const scarredId = await insert(scarred);
      const snakeId = await insert(snake);
      await fighterLevel();
      await member.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 14,
          charisma: 10,
        },
        operationId: 'scarred-scores',
      });
      const selectionId = await select(scarredId);
      const saved = await setup.readClient();
      for (const projection of [saved.calculated, saved.permanentCalculated]) {
        expect(projection.derivedStatistics.will.total).toBe(2);
        expect(projection.breakdowns['skill.int'].total).toBe(2);
      }
      const adjacent = localOn(scarred, 'save.will');
      expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
        saved.calculated.derivedStatistics,
      );
      expect(
        calculateCharacterSheetPreview(
          saved,
          {},
          { situations: [{ ...adjacent, sheetEntryId: selectionId }] },
        ).derivedStatistics.will.total,
      ).toBe(4);
      expect(
        calculateCharacterSheetPreview(saved, {}, { situations: ['charging'] })
          .derivedStatistics.will.total,
      ).toBe(2);
      // The stored definition is the one installed.
      expect(
        (await member.query(api.catalogCopies.list, scope)).find(
          (row) => row._id === scarredId,
        ),
      ).toMatchObject(scarred);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readClient();
      expect(inactive.calculated.breakdowns['skill.int'].total).toBe(0);
      expect(
        calculateCharacterSheetPreview(
          inactive,
          {},
          { situations: [{ ...adjacent, sheetEntryId: selectionId }] },
        ).derivedStatistics.will.total,
      ).toBe(2);
      await replace(setup, selectionId, snakeId);
      const snakeSaved = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(snakeSaved).derivedStatistics,
      ).toEqual(snakeSaved.calculated.derivedStatistics);
      // The old test read the ordinary CMD here and compared the later totals
      // with it (+4, +0): it is asserted as a literal at this stage, and each
      // later total as its own literal.
      expect(snakeSaved.calculated.derivedStatistics.cmd.total).toBe(11);
      const tripSituation = {
        ...localOn(snake, 'cmd'),
        sheetEntryId: selectionId,
      };
      expect(
        calculateCharacterSheetPreview(
          snakeSaved,
          {},
          { situations: [tripSituation] },
        ).derivedStatistics.cmd.total,
      ).toBe(15);
      expect(
        calculateCharacterSheetPreview(
          snakeSaved,
          {},
          { situations: ['bullRush'] },
        ).derivedStatistics.cmd.total,
      ).toBe(11);
      expect(
        calculateCharacterSheetPreview(snakeSaved, {}, { situations: ['trip'] })
          .derivedStatistics.cmd.total,
      ).toBe(11);
      await toggle(setup, selectionId, false);
      const snakeInactive = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(
          snakeInactive,
          {},
          { situations: [tripSituation] },
        ).derivedStatistics.cmd.total,
      ).toBe(11);
      await setup.expectRefusals(selectionId, true);
      expect(
        (await owner.query(api.characterSheet.read, scope))?.entries.find(
          (row) => row._id === selectionId,
        ),
      ).toMatchObject({ active: false, catalogEntryId: snakeId });
    },
  },
  {
    batch: 'feats-338',
    title:
      'Skill Focus (Intimidate) (confirmed), then Rubble Skirmisher (unresolved) in its place: listed as installed, the client preview equals the saved sheet, the +3 Intimidate and difficult-terrain CMD follow the selection, and others are refused',
    async check(setup) {
      const { owner, member, scope, insert, fighterLevel, select } = setup;
      const feats = featBatch(entries, 'feats-338');
      const focus = feats.definition('Skill Focus (Intimidate)', 'situation');
      const rubble = feats.definition('Rubble Skirmisher', 'situation');
      expectPinned('Skill Focus (Intimidate)', focus);
      expectPinned('Rubble Skirmisher', rubble);
      expect(assessmentStatus(focus.ruleIdentity)).toBe('confirmed');
      expect(assessmentStatus(rubble.ruleIdentity)).toBe('unresolved');
      const focusId = await insert(focus);
      const rubbleId = await insert(rubble);
      await fighterLevel();
      await member.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 14,
          charisma: 10,
        },
        operationId: 'focus-scores',
      });
      const selectionId = await select(focusId);
      const saved = await setup.readClient();
      for (const projection of [saved.calculated, saved.permanentCalculated]) {
        expect(projection.derivedStatistics.will.total).toBe(2);
        // #724: no Intimidate ranks, so Skill Focus adds +3 with nothing selected.
        expect(projection.breakdowns['skill.int'].total).toBe(3);
      }
      expect(focus.modifiers).toEqual([
        {
          target: 'skill.int',
          bonusType: 'untyped',
          value: { formula: '3 + 3 * min(1, floor(@skillRanks.int / 10))' },
        },
      ]);
      expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
        saved.calculated.derivedStatistics,
      );
      expect(
        calculateCharacterSheetPreview(saved).breakdowns['skill.int'].total,
      ).toBe(3);
      // The stored definition is the one installed.
      expect(
        (await member.query(api.catalogCopies.list, scope)).find(
          (row) => row._id === focusId,
        ),
      ).toMatchObject(focus);
      await toggle(setup, selectionId, false);
      const inactive = await setup.readClient();
      expect(inactive.calculated.breakdowns['skill.int'].total).toBe(0);
      expect(
        calculateCharacterSheetPreview(inactive).breakdowns['skill.int'].total,
      ).toBe(0);
      await replace(setup, selectionId, rubbleId);
      const rubbleSaved = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(rubbleSaved).derivedStatistics,
      ).toEqual(rubbleSaved.calculated.derivedStatistics);
      expect(rubbleSaved.calculated.derivedStatistics.cmd.total).toBe(11);
      const terrainSituation = {
        ...localOn(rubble, 'cmb'),
        sheetEntryId: selectionId,
      };
      expect(
        calculateCharacterSheetPreview(
          rubbleSaved,
          {},
          { situations: [terrainSituation] },
        ).derivedStatistics.cmd.total,
      ).toBe(13);
      // The old test compared these with the ordinary CMD read above (11).
      expect(
        calculateCharacterSheetPreview(
          rubbleSaved,
          {},
          { situations: ['bullRush'] },
        ).derivedStatistics.cmd.total,
      ).toBe(11);
      expect(
        calculateCharacterSheetPreview(
          rubbleSaved,
          {},
          { situations: ['trip'] },
        ).derivedStatistics.cmd.total,
      ).toBe(11);
      await toggle(setup, selectionId, false);
      const rubbleInactive = await setup.readClient();
      expect(
        calculateCharacterSheetPreview(
          rubbleInactive,
          {},
          { situations: [terrainSituation] },
        ).derivedStatistics.cmd.total,
      ).toBe(11);
      await setup.expectRefusals(selectionId, true);
      expect(
        (await owner.query(api.characterSheet.read, scope))?.entries.find(
          (row) => row._id === selectionId,
        ),
      ).toMatchObject({ active: false, catalogEntryId: rubbleId });
    },
  },
];

describe('the released feat integration rows', () => {
  for (const row of rows)
    test(`${row.batch}: ${row.title}`, async () =>
      row.check(await setUp(row.batch)));
});
