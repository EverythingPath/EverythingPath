/// <reference types="vite/client" />
// @vitest-environment edge-runtime
// pbl-released-traits (PRD #251): the trait batches' integration tests
// (traits367 to traits386), on entries imported from the pinned store. Each
// row selects four traits of one batch on a Convex-backed saved sheet: two
// general traits, a third that replaces one of them, and a drawback. The
// shared steps check that the client preview equals the saved sheet after
// the first selection, the replacement (staged against saved) and the
// drawback, as the batch tests did (none checked it after the second
// selection); that a replacement keeps the other trait; that a drawback adds
// one trait to the budget; and that the campaign refuses others. Each row's
// body checks its traits' own numbers, as literals.
import { convexTest } from 'convex-test';
import { makeFunctionReference, type FunctionReturnType } from 'convex/server';
import { describe, expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { importCatalog } from '../../scripts/catalog/import';
import { computeFingerprint } from '../../scripts/catalog/admission';
import { serializeCatalogRelease } from '../../scripts/catalog/release';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { releaseLegalInputsSchema } from '../../src/lib/catalog/release-legal-inputs';
import { validateCatalogReleaseArtifact } from '../../src/lib/catalog/release-schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import {
  legalResources,
  reviewedAdmission,
} from '../../src/lib/catalog/reviewed-data';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import { withSheetCatalog } from '../character-sheet-catalog';
import { createBatchRelease } from './batch-admission';
import { materializePinnedTree } from './pinned-sources';
import { importReleasedEntries, releasedRecordFiles } from './released-entries';
import { traitBatches, type TraitBatch } from './released-trait-keys';
import { traitDefinition, type TraitDefinition } from './released-trait-sheet';

const modules = import.meta.glob('../../convex/**/*.ts');

function local(scope: unknown) {
  if (typeof scope !== 'object' || scope === null || !('local' in scope))
    throw new Error('Expected a local Situation');
  return scope as { local: string };
}

/**
 * The status of a key's committed Attribution Assessment, in the batch
 * reviews' words: a confirmed assessment reads `admitted`, an unresolved one
 * `held`. It is the assessment's status only, not whether a release admits
 * the entry: a release may still admit an unresolved entry on its declared
 * books.
 */
function disposition(key: string) {
  const status = reviewedAdmission.assessments.find(
    (row) => row.externalKey === key,
  )?.status;
  return status === 'confirmed'
    ? 'admitted'
    : status === 'unresolved'
      ? 'held'
      : status;
}

type Role = 'first' | 'second' | 'replacement' | 'drawback';
type SavedSheet = NonNullable<
  FunctionReturnType<typeof api.characterSheet.read>
>;
type EntryId = FunctionReturnType<typeof api.characterSheet.fillSelectionSlot>;

/**
 * The steps of one row, in order: select the first and the second general
 * trait, replace one of them with the replacement, select the drawback.
 */
type TraitSteps = {
  definitions: Record<Role, TraitDefinition>;
  /** Reads the saved sheet, at any step. */
  read(): Promise<SavedSheet>;
  /** Selects the first trait; the preview equals the saved sheet. */
  selectFirst(): Promise<{ sheet: SavedSheet; entryId: EntryId }>;
  /** Selects the second trait beside it. */
  selectSecond(): Promise<{ sheet: SavedSheet; entryId: EntryId }>;
  /**
   * Replaces the first or the second selection with the replacement: the
   * staged preview equals the saved replacement, and the other selection
   * keeps its trait.
   */
  replace(slot: 'first' | 'second'): Promise<SavedSheet>;
  /**
   * Selects the drawback: it adds one trait to the budget (3), and the
   * preview equals the saved sheet.
   */
  selectDrawback(): Promise<{ sheet: SavedSheet; entryId: EntryId }>;
};

type TraitRow = {
  batch: TraitBatch;
  /** The traits' names, as the batch preview names them. */
  traits: Record<Role, string>;
  /**
   * The two traits whose trait bonuses on one statistic the row checks do
   * not stack, after the step that puts them side by side.
   */
  stacking: readonly [Role, Role];
  /** What the row's own test asserts about its traits, around the steps. */
  check(steps: TraitSteps): Promise<void>;
};

const rows: TraitRow[] = [
  {
    batch: 'traits-367',
    traits: {
      first: 'pf1-content/18qw3EpSd7gS0Ck6', // Goblin Watcher (Rise of the Runelords)
      second: 'pf1-content/1v8lH1UJqYMaf2Lr', // Bastard
      replacement: 'pf1-content/1ALI2ug0pdesx8oA', // Honor-Driven (Human; Ulfen)
      drawback: 'pf1-content/1CC39I0AlWvyEDJ5', // Scarred
    },
    stacking: ['second', 'replacement'],
    async check(steps) {
      const { first: watcher } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect([
        saved.calculated.breakdowns['skill.per'].total,
        saved.calculated.breakdowns['skill.apr'].total,
      ]).toEqual([1, 1]);
      // The treasure-hoard +5 replaces the +1: trait bonuses do not stack.
      const hoard = watcher.modifiers.find((row) => row.condition?.situation);
      expect(
        calculateCharacterSheetPreview(
          saved,
          {},
          {
            situations: [
              { ...local(hoard?.condition?.situation), sheetEntryId: first },
            ],
          },
        ).breakdowns['skill.apr'].total,
      ).toBe(5);
      const { sheet: current } = await steps.selectSecond();
      // Staged replacement equals the saved replacement: Honor-Driven for Goblin
      // Watcher, beside Bastard. Both give +1 trait on Sense Motive; they don't stack.
      expect(current.calculated.breakdowns['skill.sen'].total).toBe(1);
      const replaced = await steps.replace('first');
      expect([
        replaced.calculated.breakdowns['skill.sen'].total,
        replaced.calculated.breakdowns['skill.per'].total,
        replaced.calculated.breakdowns['skill.apr'].total,
      ]).toEqual([1, 0, 0]);
      // The drawback slot takes the drawback, whose penalties apply as written,
      // and adds one trait to the budget.
      const { sheet: scarredSheet } = await steps.selectDrawback();
      expect([
        scarredSheet.calculated.breakdowns['skill.dis'].total,
        scarredSheet.calculated.breakdowns['skill.blf'].total,
      ]).toEqual([-5, -2]);
    },
  },
  {
    batch: 'traits-368',
    traits: {
      first: 'pf1-content/4NpZyHUnJPjtAAv7', // Excitable (Gnome)
      second: 'pf1-content/4efQjXZcdmlfmEt2', // Wary of Danger (Human; Kellid)
      replacement: 'pf1-content/55VbucpexWzN4fls', // Varki Landspeaker (Human; Varki)
      drawback: 'pf1-content/5FRmxTq0x7Zj55Am', // Impatient
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: varki, drawback: impatient } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns.init.total).toBe(2);
      const { sheet: current } = await steps.selectSecond();
      // Two traits' +2 trait bonuses on initiative don't stack.
      expect(current.calculated.breakdowns.init.total).toBe(2);
      // Staged replacement equals the saved replacement: Varki Landspeaker for
      // Excitable, beside Wary of Danger.
      const replaced = await steps.replace('first');
      expect([
        replaced.calculated.breakdowns.init.total,
        replaced.calculated.breakdowns['skill.sur'].total,
      ]).toEqual([2, 0]);
      // The cold-terrain +1 and the spirit query's +5 are trait bonuses: with
      // both Situations selected the Survival total is +5, not +6.
      const situations = varki.modifiers.map((row) => ({
        ...local(row.condition?.situation),
        sheetEntryId: first,
      }));
      expect(
        calculateCharacterSheetPreview(replaced, {}, { situations }).breakdowns[
          'skill.sur'
        ].total,
      ).toBe(5);
      expect(
        calculateCharacterSheetPreview(
          replaced,
          {},
          { situations: situations.slice(0, 1) },
        ).breakdowns['skill.sur'].total,
      ).toBe(1);
      // The drawback slot takes the drawback, whose penalties wait for their
      // Situation, and adds one trait to the budget.
      const { sheet: impatientSheet, entryId: drawback } =
        await steps.selectDrawback();
      expect(impatientSheet.calculated.breakdowns['save.will'].total).toBe(0);
      const lastToAct = calculateCharacterSheetPreview(
        impatientSheet,
        {},
        {
          situations: [
            {
              ...local(impatient.modifiers[0]?.condition?.situation),
              sheetEntryId: drawback,
            },
          ],
        },
      ).breakdowns;
      expect([
        lastToAct['save.will'].total,
        lastToAct['skill.per'].total,
      ]).toEqual([-1, -1]);
    },
  },
  {
    batch: 'traits-369',
    traits: {
      first: 'pf1-content/6RU2RaFqSBeYXkAc', // Silvertongued Eunuch (Quain)
      second: 'pf1-content/7XNHi2A0YQLAGIvU', // Shadow Diplomat (Shadow Lodge)
      replacement: 'pf1-content/6RzGTgsbj5ZYCG1B', // Betrayal of Trust
      drawback: 'pf1-content/8sDez4MAo8J3Qhm7', // Misbegotten
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: betrayal } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect([
        saved.calculated.breakdowns['skill.dip'].total,
        saved.calculated.breakdowns['skill.kno'].total,
      ]).toEqual([1, 1]);
      const { sheet: current } = await steps.selectSecond();
      // Two traits' +1 trait bonuses on Diplomacy don't stack.
      expect(current.calculated.breakdowns['skill.dip'].total).toBe(1);
      // Staged replacement equals the saved replacement: Betrayal of Trust for
      // Silvertongued Eunuch, beside Shadow Diplomat.
      const replaced = await steps.replace('first');
      expect([
        replaced.calculated.breakdowns['skill.dip'].total,
        replaced.calculated.breakdowns['skill.kno'].total,
        replaced.calculated.breakdowns['skill.blf'].total,
      ]).toEqual([1, 0, 2]);
      // The +2 on Bluff and the +4 to conceal infidelity are trait bonuses: with
      // the Situation selected the Bluff total is +4, not +6.
      const situations = betrayal.modifiers.flatMap((row) =>
        row.condition?.situation
          ? [{ ...local(row.condition.situation), sheetEntryId: first }]
          : [],
      );
      expect(situations).toHaveLength(1);
      expect(
        calculateCharacterSheetPreview(replaced, {}, { situations }).breakdowns[
          'skill.blf'
        ].total,
      ).toBe(4);
      // The drawback slot takes the drawback, whose -2 applies to every
      // Dexterity-based skill, and adds one trait to the budget.
      const { sheet: drawbackSheet } = await steps.selectDrawback();
      expect([
        drawbackSheet.calculated.breakdowns['skill.acr'].total,
        drawbackSheet.calculated.breakdowns['skill.ste'].total,
        drawbackSheet.calculated.breakdowns['skill.swm'].total,
      ]).toEqual([-2, -2, 0]);
    },
  },
  {
    batch: 'traits-370',
    traits: {
      first: 'pf1-content/AfhqTewIL99Uy6Op', // Rapscallion
      second: 'pf1-content/AnTglJGgRVJKSqRE', // Giant Ambivalence (Temperate Highlands)
      replacement: 'pf1-content/BRGbvqKWCw3NSLmC', // Proxy of Many
      drawback: 'pf1-content/A20xwmcXQiEPk7ph', // Fey-Taken
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: proxy, drawback: feyTaken } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect([
        saved.calculated.breakdowns.init.total,
        saved.calculated.breakdowns['skill.esc'].total,
      ]).toEqual([1, 1]);
      const { sheet: current } = await steps.selectSecond();
      // Two traits' +1 trait bonuses on initiative don't stack.
      expect([
        current.calculated.breakdowns.init.total,
        current.calculated.breakdowns['skill.sen'].total,
      ]).toEqual([1, 1]);
      // Staged replacement equals the saved replacement: Proxy of Many for
      // Rapscallion, beside Giant Ambivalence.
      const replaced = await steps.replace('first');
      expect([
        replaced.calculated.breakdowns.init.total,
        replaced.calculated.breakdowns['skill.esc'].total,
        replaced.calculated.breakdowns['skill.dip'].total,
      ]).toEqual([1, 0, 0]);
      // The +2 and +4 favor bonuses are trait bonuses: with both Situations
      // selected the Diplomacy total is +4, not +6.
      const situations = proxy.modifiers.flatMap((row) =>
        row.condition?.situation
          ? [{ ...local(row.condition.situation), sheetEntryId: first }]
          : [],
      );
      expect(situations).toHaveLength(2);
      expect(
        calculateCharacterSheetPreview(replaced, {}, { situations }).breakdowns[
          'skill.dip'
        ].total,
      ).toBe(4);
      // The drawback slot takes the drawback and adds one trait to the budget.
      // Its -2 save penalties apply only under their Situations.
      const { sheet: drawbackSheet, entryId: drawbackEntry } =
        await steps.selectDrawback();
      const feySituations = feyTaken.modifiers.flatMap((row) =>
        row.condition?.situation
          ? [{ ...local(row.condition.situation), sheetEntryId: drawbackEntry }]
          : [],
      );
      expect(feySituations).toHaveLength(2);
      const penalized = calculateCharacterSheetPreview(
        drawbackSheet,
        {},
        { situations: feySituations },
      ).breakdowns;
      // Without a class the save totals have no base; compare the difference.
      for (const save of ['save.fort', 'save.ref', 'save.will'] as const)
        expect(
          penalized[save].total -
            drawbackSheet.calculated.breakdowns[save].total,
          save,
        ).toBe(-2);
    },
  },
  {
    batch: 'traits-371',
    traits: {
      first: 'pf1-content/CcPTQN8nBjXib6xQ', // Rostlander (Kingmaker)
      second: 'pf1-content/C36gPFjWdVvBubNm', // The Word (Tyrant's Grasp)
      replacement: 'pf1-content/CKj2F6l8JVggrva1', // Friends in High Places
      drawback: 'pf1-content/Cj6A6Oxf8cX6QlU8', // Loner
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: friends, drawback: loner } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      const fort = saved.calculated.breakdowns['save.fort'].total;
      expect(fort).toBe(1);
      const { sheet: current } = await steps.selectSecond();
      // Two traits' +1 trait bonuses on Fortitude don't stack.
      expect(current.calculated.breakdowns['save.fort'].total).toBe(1);
      // Staged replacement equals the saved replacement: Friends in High Places
      // for Rostlander, beside The Word, which keeps the Fortitude bonus.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['skill.dip'].total).toBe(0);
      expect(replaced.calculated.breakdowns['save.fort'].total).toBe(1);
      // The +1 where you gathered information and the +2 with officials are
      // trait bonuses: with both Situations selected Diplomacy rises by 2, not 3.
      const situations = friends.modifiers
        .filter((row) => row.target === 'skill.dip')
        .map((row) => ({
          ...local(row.condition?.situation),
          sheetEntryId: first,
        }));
      expect(situations).toHaveLength(2);
      expect(
        calculateCharacterSheetPreview(replaced, {}, { situations }).breakdowns[
          'skill.dip'
        ].total,
      ).toBe(2);
      expect(
        calculateCharacterSheetPreview(
          replaced,
          {},
          { situations: situations.slice(0, 1) },
        ).breakdowns['skill.dip'].total,
      ).toBe(1);
      // The drawback slot takes the drawback, whose penalties wait for their
      // Situation, and adds one trait to the budget.
      const { sheet: lonerSheet, entryId: drawback } =
        await steps.selectDrawback();
      const before = lonerSheet.calculated.breakdowns;
      const adjacent = calculateCharacterSheetPreview(
        lonerSheet,
        {},
        {
          situations: [
            {
              ...local(loner.modifiers[0]?.condition?.situation),
              sheetEntryId: drawback,
            },
          ],
        },
      ).breakdowns;
      expect([
        adjacent['attack.melee'].total - before['attack.melee'].total,
        adjacent['ac.other'].total - before['ac.other'].total,
      ]).toEqual([-1, -1]);
    },
  },
  {
    batch: 'traits-372',
    traits: {
      first: 'pf1-content/IDneMfUjWZVEoMPk', // Hermean Paragon (the Steaming Sea)
      second: 'pf1-content/GHAlKlq17bbM6Qek', // Gruff Watcher (Human; Ulfen)
      replacement: 'pf1-content/HTp8gTJgYP17qh21', // Vigilant Battler
      drawback: 'pf1-content/HMQbKZ3BgWAJ0oPq', // Righteous Indignation
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: vigilant, drawback: indignation } =
        steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns.init.total).toBe(2);
      expect(saved.calculated.breakdowns['skill.per'].total).toBe(0);
      expect(saved.calculated.breakdowns['skill.sen'].total).toBe(0);
      const { sheet: current } = await steps.selectSecond();
      // Gruff Watcher's +1 trait bonus on initiative doesn't stack with Hermean
      // Paragon's +2; its Perception bonus applies.
      expect(current.calculated.breakdowns.init.total).toBe(2);
      expect(current.calculated.breakdowns['skill.per'].total).toBe(1);
      // Staged replacement equals the saved replacement: Vigilant Battler for
      // Hermean Paragon, beside Gruff Watcher, whose +1 is now the initiative
      // bonus.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns.init.total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.sen'].total).toBe(1);
      // Against a feint the +1 trait bonus becomes +2, not +3.
      const feint = vigilant.modifiers.findIndex(
        (row) => row.target === 'skill.sen' && row.condition?.situation,
      );
      expect(
        calculateCharacterSheetPreview(
          replaced,
          {},
          {
            situations: [
              {
                ...local(vigilant.modifiers[feint]?.condition?.situation),
                sheetEntryId: first,
              },
            ],
          },
        ).breakdowns['skill.sen'].total,
      ).toBe(2);
      // The drawback slot takes the drawback, whose Will penalty waits for its
      // Situation, and adds one trait to the budget.
      const { sheet: drawbackSheet, entryId: drawback } =
        await steps.selectDrawback();
      const before = drawbackSheet.calculated.breakdowns;
      expect(replaced.calculated.breakdowns['save.will'].total).toBe(0);
      expect(before['save.will'].total).toBe(0);
      const emotion = calculateCharacterSheetPreview(
        drawbackSheet,
        {},
        {
          situations: [
            {
              ...local(indignation.modifiers[0]?.condition?.situation),
              sheetEntryId: drawback,
            },
          ],
        },
      ).breakdowns;
      expect(emotion['save.will'].total - before['save.will'].total).toBe(-1);
    },
  },
  {
    batch: 'traits-373',
    traits: {
      first: 'pf1-content/KQtPocPHi0X5nizE', // Traditionalist (Divine Anthology)
      second: 'pf1-content/K0MJg1va6kwSGclx', // Crusader Tactician (Lastwall)
      replacement: 'pf1-content/KakUVlrrmzxYCrIj', // Creative Reality (Ganzi)
      drawback: 'pf1-content/KrFtj5k6jm8XnrIZ', // Guilty Fraud
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: creative, drawback: fraud } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['skill.kno'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.ken'].total).toBe(0);
      expect(saved.calculated.breakdowns['skill.blf'].total).toBe(0);
      const { sheet: current } = await steps.selectSecond();
      // Crusader Tactician's +1 trait bonus on Knowledge (nobility) doesn't stack
      // with Traditionalist's; its Knowledge (engineering) bonus applies.
      expect(current.calculated.breakdowns['skill.kno'].total).toBe(1);
      expect(current.calculated.breakdowns['skill.ken'].total).toBe(1);
      // Staged replacement equals the saved replacement: Creative Reality for
      // Traditionalist, beside Crusader Tactician, whose +1 is now the
      // Knowledge (nobility) bonus.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['skill.kno'].total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.blf'].total).toBe(1);
      // Convincing someone an honest answer is a falsehood: the +1 trait bonus
      // becomes +5, not +6.
      const falsehood = creative.modifiers.findIndex(
        (row) => row.target === 'skill.blf' && row.condition?.situation,
      );
      expect(
        calculateCharacterSheetPreview(
          replaced,
          {},
          {
            situations: [
              {
                ...local(creative.modifiers[falsehood]?.condition?.situation),
                sheetEntryId: first,
              },
            ],
          },
        ).breakdowns['skill.blf'].total,
      ).toBe(5);
      // The drawback slot takes the drawback, whose Bluff penalty waits for its
      // Situation, and adds one trait to the budget.
      const { sheet: drawbackSheet, entryId: drawback } =
        await steps.selectDrawback();
      const before = drawbackSheet.calculated.breakdowns;
      expect(replaced.calculated.breakdowns['skill.blf'].total).toBe(1);
      expect(before['skill.blf'].total).toBe(1);
      const indifferent = calculateCharacterSheetPreview(
        drawbackSheet,
        {},
        {
          situations: [
            {
              ...local(fraud.modifiers[0]?.condition?.situation),
              sheetEntryId: drawback,
            },
          ],
        },
      ).breakdowns;
      expect(indifferent['skill.blf'].total - before['skill.blf'].total).toBe(
        -4,
      );
    },
  },
  {
    batch: 'traits-374',
    traits: {
      first: 'pf1-content/M2CVmyEbiCMIGQwI', // Devotee of the Green
      second: 'pf1-content/OXI5uX5zrwOcsloX', // Nomadic (Human; Bas'o)
      replacement: 'pf1-content/NfDhIUhdw1dCfrgg', // Vexing Defender (Giantslayer)
      drawback: 'pf1-content/OBludjC1F1ETLalq', // Mark of Slavery
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: vexing, drawback: mark } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['skill.kge'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.sur'].total).toBe(0);
      expect(saved.calculated.breakdowns['skill.acr'].total).toBe(0);
      const { sheet: current } = await steps.selectSecond();
      // Nomadic's +1 trait bonus on Knowledge (geography) doesn't stack with
      // Devotee of the Green's; its Survival bonus applies.
      expect(current.calculated.breakdowns['skill.kge'].total).toBe(1);
      expect(current.calculated.breakdowns['skill.sur'].total).toBe(1);
      // Staged replacement equals the saved replacement: Vexing Defender for
      // Devotee of the Green, beside Nomadic, whose +1 is now the Knowledge
      // (geography) bonus.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['skill.kge'].total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.acr'].total).toBe(1);
      // Moving through a larger enemy's space: the +1 trait bonus becomes +4,
      // not +5.
      const larger = vexing.modifiers.findIndex(
        (row) => row.target === 'skill.acr' && row.condition?.situation,
      );
      expect(
        calculateCharacterSheetPreview(
          replaced,
          {},
          {
            situations: [
              {
                ...local(vexing.modifiers[larger]?.condition?.situation),
                sheetEntryId: first,
              },
            ],
          },
        ).breakdowns['skill.acr'].total,
      ).toBe(4);
      // The drawback slot takes the drawback, whose skill penalty waits for its
      // Situation, and adds one trait to the budget.
      const { sheet: drawbackSheet, entryId: drawback } =
        await steps.selectDrawback();
      const before = drawbackSheet.calculated.breakdowns;
      expect(replaced.calculated.breakdowns['skill.acr'].total).toBe(1);
      expect(before['skill.acr'].total).toBe(1);
      const failed = mark.modifiers.findIndex((row) => row.target === 'skills');
      const penalized = calculateCharacterSheetPreview(
        drawbackSheet,
        {},
        {
          situations: [
            {
              ...local(mark.modifiers[failed]?.condition?.situation),
              sheetEntryId: drawback,
            },
          ],
        },
      ).breakdowns;
      expect(penalized['skill.acr'].total - before['skill.acr'].total).toBe(-2);
      expect(penalized['skill.sur'].total - before['skill.sur'].total).toBe(-2);
    },
  },
  {
    batch: 'traits-375',
    traits: {
      first: 'pf1-content/OomGJd9P9riLYVN4', // Talented Organizer (Milani)
      second: 'pf1-content/RXU65Zi47jY6EDXB', // Outcast's Intuition
      replacement: 'pf1-content/RngusGRzTJDM7pR4', // For the Money
      drawback: 'pf1-content/PwaxJMNPEpiy5Q8v', // Pride
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: money, drawback: pride } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['skill.sen'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.apr'].total).toBe(0);
      expect(saved.calculated.breakdowns['skill.dip'].total).toBe(0);
      const { sheet: current } = await steps.selectSecond();
      // Outcast's Intuition's +1 trait bonus on Sense Motive doesn't stack with
      // Talented Organizer's.
      expect(current.calculated.breakdowns['skill.sen'].total).toBe(1);
      // Staged replacement equals the saved replacement: For the Money for
      // Talented Organizer, beside Outcast's Intuition, whose +1 is now the
      // Sense Motive bonus.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['skill.sen'].total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.apr'].total).toBe(1);
      // Haggling from a position of power: the +1 trait bonus on Appraise
      // becomes +4, not +5.
      const power = money.modifiers.findIndex(
        (row) =>
          row.target === 'skills' &&
          JSON.stringify(row.condition?.situation).includes('position of'),
      );
      expect(
        calculateCharacterSheetPreview(
          replaced,
          {},
          {
            situations: [
              {
                ...local(money.modifiers[power]?.condition?.situation),
                sheetEntryId: first,
              },
            ],
          },
        ).breakdowns['skill.apr'].total,
      ).toBe(4);
      // The drawback slot takes the drawback, whose penalties wait for their
      // Situation, and adds one trait to the budget.
      const { sheet: drawbackSheet, entryId: drawback } =
        await steps.selectDrawback();
      const before = drawbackSheet.calculated.breakdowns;
      expect(before['skill.dip'].total).toBe(0);
      const challenged = pride.modifiers.findIndex(
        (row) => row.target === 'skill.dip',
      );
      const penalized = calculateCharacterSheetPreview(
        drawbackSheet,
        {},
        {
          situations: [
            {
              ...local(pride.modifiers[challenged]?.condition?.situation),
              sheetEntryId: drawback,
            },
          ],
        },
      ).breakdowns;
      expect(penalized['skill.dip'].total - before['skill.dip'].total).toBe(-2);
      expect(penalized['skill.sen'].total - before['skill.sen'].total).toBe(-2);
    },
  },
  {
    batch: 'traits-376',
    traits: {
      first: 'pf1-content/TIJWhs8OCFC0A1Fs', // Indomitable Faith
      second: 'pf1-content/TGZ3ZYXDsj2RpOFA', // Purity of Faith (Iomedae)
      replacement: 'pf1-content/SIerTSOcJrPjPh3q', // Courageous
      drawback: 'pf1-content/UbZb0kh5hb9qXl2j', // Self-Doubting
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { second: purity, drawback: doubting } = steps.definitions;
      const { sheet: saved } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['save.will'].total).toBe(1);
      expect(saved.calculated.breakdowns['save.fort'].total).toBe(0);
      const { sheet: current, entryId: second } = await steps.selectSecond();
      // Purity of Faith's +1 trait bonus on Will saves doesn't stack with
      // Indomitable Faith's; against an evil outsider its +1 applies to
      // Fortitude, and Will still gets only +1.
      expect(current.calculated.breakdowns['save.will'].total).toBe(1);
      const evilIndex = purity.modifiers.findIndex(
        (row) => row.target === 'saves' && row.condition?.situation,
      );
      const evil = calculateCharacterSheetPreview(
        current,
        {},
        {
          situations: [
            {
              ...local(purity.modifiers[evilIndex]?.condition?.situation),
              sheetEntryId: second,
            },
          ],
        },
      ).breakdowns;
      expect([evil['save.fort'].total, evil['save.will'].total]).toEqual([
        1, 1,
      ]);
      // Staged replacement equals the saved replacement: Courageous for
      // Indomitable Faith, beside Purity of Faith, whose +1 is now the Will bonus.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['save.will'].total).toBe(1);
      // Against fear, Courageous's +2 trait bonus replaces Purity's +1 on Will
      // (+2, not +3) and applies to Fortitude.
      const fear = calculateCharacterSheetPreview(
        replaced,
        {},
        { situations: ['fear'] },
      ).breakdowns;
      expect([fear['save.fort'].total, fear['save.will'].total]).toEqual([
        2, 2,
      ]);
      // The drawback slot takes the drawback, whose Will penalty waits for its
      // Situation, and adds one trait to the budget.
      const { sheet: drawbackSheet, entryId: drawback } =
        await steps.selectDrawback();
      const before = drawbackSheet.calculated.breakdowns;
      expect(replaced.calculated.breakdowns['save.will'].total).toBe(1);
      expect(before['save.will'].total).toBe(1);
      const willIndex = doubting.modifiers.findIndex(
        (row) => row.target === 'save.will',
      );
      const failed = calculateCharacterSheetPreview(
        drawbackSheet,
        {},
        {
          situations: [
            {
              ...local(doubting.modifiers[willIndex]?.condition?.situation),
              sheetEntryId: drawback,
            },
          ],
        },
      ).breakdowns;
      expect(failed['save.will'].total - before['save.will'].total).toBe(-2);
    },
  },
  {
    batch: 'traits-377',
    traits: {
      first: 'pf1-content/VBKJIIclH81wPQmB', // Sky Quester (Dwarf)
      second: 'pf1-content/XFg1cch3sgX8Dbwl', // Azlanti Inheritor (Human; Azlanti)
      replacement: 'pf1-content/V9hfdnC0g2SYxxlE', // Sky Spirit Worshiper (Shanguang)
      drawback: 'pf1-content/VfRZTTymfnMnsJzD', // Vain
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { second: inheritor, drawback: vain } = steps.definitions;
      const { sheet: saved } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['skill.khi'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.apr'].total).toBe(0);
      expect(saved.calculated.breakdowns['save.will'].total).toBe(0);
      expect(saved.calculated.breakdowns['save.fort'].total).toBe(0);
      const { sheet: current, entryId: second } = await steps.selectSecond();
      // Azlanti Inheritor's +1 trait bonus on Knowledge (history) doesn't stack
      // with Sky Quester's; for an Azlanti object its +2 applies to Appraise.
      expect(current.calculated.breakdowns['skill.khi'].total).toBe(1);
      const azlantiIndex = inheritor.modifiers.findIndex(
        (row) => row.target === 'skill.apr' && row.condition?.situation,
      );
      const azlanti = calculateCharacterSheetPreview(
        current,
        {},
        {
          situations: [
            {
              ...local(inheritor.modifiers[azlantiIndex]?.condition?.situation),
              sheetEntryId: second,
            },
          ],
        },
      ).breakdowns;
      expect([azlanti['skill.apr'].total, azlanti['skill.khi'].total]).toEqual([
        2, 1,
      ]);
      // Staged replacement equals the saved replacement: Sky Spirit Worshiper
      // for Sky Quester, beside Azlanti Inheritor, whose +1 is now the Knowledge
      // (history) bonus.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['skill.khi'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.kge'].total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.kge'].total).toBe(0);
      // Against fear, Sky Spirit Worshiper's +2 trait bonus applies to every save.
      const fear = calculateCharacterSheetPreview(
        replaced,
        {},
        { situations: ['fear'] },
      ).breakdowns;
      expect([fear['save.fort'].total, fear['save.will'].total]).toEqual([
        2, 2,
      ]);
      // The drawback slot takes the drawback, whose Charisma-based skill penalty
      // waits for its Situation, and adds one trait to the budget.
      const { sheet: drawbackSheet, entryId: drawback } =
        await steps.selectDrawback();
      const before = drawbackSheet.calculated.breakdowns;
      expect(replaced.calculated.breakdowns['skill.blf'].total).toBe(0);
      expect(before['skill.blf'].total).toBe(0);
      const failed = calculateCharacterSheetPreview(
        drawbackSheet,
        {},
        {
          situations: [
            {
              ...local(vain.modifiers[0]?.condition?.situation),
              sheetEntryId: drawback,
            },
          ],
        },
      ).breakdowns;
      expect(failed['skill.blf'].total - before['skill.blf'].total).toBe(-2);
      expect(failed['skill.dip'].total - before['skill.dip'].total).toBe(-2);
    },
  },
  {
    batch: 'traits-378',
    traits: {
      first: 'pf1-content/YD5T6kLoG8XrgvkG', // Poverty-Stricken
      second: 'pf1-content/ZsJJmpWUKxM9QO4j', // Deep Marker (Dwarf)
      replacement: 'pf1-content/aw6y7Js3wl9RojGt', // Wati Native (Mummy's Mask)
      drawback: 'pf1-content/ZfMlN4uVzoZ37gZq', // Condescending
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { drawback: condescending } = steps.definitions;
      const { sheet: saved } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['skill.sur'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.klo'].total).toBe(0);
      expect(saved.calculated.breakdowns['save.will'].total).toBe(0);
      expect(saved.calculated.breakdowns['save.fort'].total).toBe(0);
      const { sheet: current } = await steps.selectSecond();
      // Deep Marker's +1 trait bonus on Survival doesn't stack with
      // Poverty-Stricken's; against fear its +1 trait bonus applies to every save.
      expect(current.calculated.breakdowns['skill.sur'].total).toBe(1);
      const afraid = calculateCharacterSheetPreview(
        current,
        {},
        { situations: ['fear'] },
      ).breakdowns;
      expect([afraid['save.fort'].total, afraid['save.will'].total]).toEqual([
        1, 1,
      ]);
      // Staged replacement equals the saved replacement: Wati Native for
      // Poverty-Stricken, beside Deep Marker, whose +1 is now the Survival bonus.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['skill.sur'].total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.klo'].total).toBe(1);
      // Against fear, Wati Native's +2 trait bonus and Deep Marker's +1 don't
      // stack: every save is +2.
      const fear = calculateCharacterSheetPreview(
        replaced,
        {},
        { situations: ['fear'] },
      ).breakdowns;
      expect([fear['save.fort'].total, fear['save.will'].total]).toEqual([
        2, 2,
      ]);
      // The drawback slot takes the drawback, whose Diplomacy and Intimidate
      // penalty waits for its Situation, and adds one trait to the budget.
      const { sheet: drawbackSheet, entryId: drawback } =
        await steps.selectDrawback();
      const before = drawbackSheet.calculated.breakdowns;
      expect(replaced.calculated.breakdowns['skill.dip'].total).toBe(0);
      expect(before['skill.dip'].total).toBe(0);
      const attitude = calculateCharacterSheetPreview(
        drawbackSheet,
        {},
        {
          situations: [
            {
              ...local(condescending.modifiers[0]?.condition?.situation),
              sheetEntryId: drawback,
            },
          ],
        },
      ).breakdowns;
      expect(attitude['skill.dip'].total - before['skill.dip'].total).toBe(-5);
      expect(attitude['skill.int'].total - before['skill.int'].total).toBe(-5);
      expect(attitude['skill.blf'].total - before['skill.blf'].total).toBe(0);
    },
  },
  {
    batch: 'traits-379',
    traits: {
      first: 'pf1-content/cBzZkpApuRto4FNW', // Holy Schemer (Calistria)
      second: 'pf1-content/dWM8HEnuLjIsOclB', // Self-Aware (Vampire; Vetala)
      replacement: 'pf1-content/cOxDy2lPhsdGpJ0n', // Practiced Gambler (Human; Varisian)
      drawback: 'pf1-content/bgvlRIuwpfOG1nFS', // Meticulous
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: gambler } = steps.definitions;
      const { sheet: saved } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['skill.sen'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.blf'].total).toBe(0);
      expect(saved.calculated.breakdowns['skill.acr'].total).toBe(0);
      const { sheet: current, entryId: second } = await steps.selectSecond();
      // Self-Aware's +1 trait bonus on Sense Motive doesn't stack with Holy
      // Schemer's.
      expect(current.calculated.breakdowns['skill.sen'].total).toBe(1);
      // Staged replacement equals the saved replacement: Practiced Gambler for
      // Self-Aware, beside Holy Schemer, which keeps the Sense Motive bonus.
      const replaced = await steps.replace('second');
      expect(replaced.calculated.breakdowns['skill.sen'].total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.blf'].total).toBe(1);
      // Gambling: the +1 trait bonus becomes +2, not +3.
      const gambling = gambler.modifiers.findIndex(
        (row) => row.target === 'skill.blf' && row.condition?.situation,
      );
      expect(
        calculateCharacterSheetPreview(
          replaced,
          {},
          {
            situations: [
              {
                ...local(gambler.modifiers[gambling]?.condition?.situation),
                sheetEntryId: second,
              },
            ],
          },
        ).breakdowns['skill.blf'].total,
      ).toBe(2);
      // The drawback slot takes the drawback, which adds one trait to the
      // budget; its -2 applies to every Dexterity-based skill.
      const { sheet: drawbackSheet } = await steps.selectDrawback();
      const after = drawbackSheet.calculated.breakdowns;
      expect(after['skill.acr'].total).toBe(-2);
      expect(replaced.calculated.breakdowns['skill.slt'].total).toBe(1);
      expect(after['skill.slt'].total).toBe(-1);
      expect(after['skill.sen'].total).toBe(1);
    },
  },
  {
    batch: 'traits-380',
    traits: {
      first: 'pf1-content/eAz8JKyPHmUdBTmM', // Devotee of the Old Gods (Mummy's Mask)
      second: 'pf1-content/e2SYdeyrK1u78lKn', // Traditionalist (Faiths and Philosophies)
      replacement: 'pf1-content/eAIRTJ7gb78REiYK', // Faithful Arodenite (Aroden)
      drawback: 'pf1-content/exrGFR1WytCYBP9t', // Oblivious
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: arodenite, drawback: oblivious } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['skill.khi'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.klo'].total).toBe(0);
      expect(saved.calculated.breakdowns['skill.dip'].total).toBe(0);
      const { sheet: current } = await steps.selectSecond();
      // Traditionalist's +1 trait bonus on Knowledge (history) doesn't stack with
      // Devotee of the Old Gods'; its Knowledge (local) bonus applies.
      expect(current.calculated.breakdowns['skill.khi'].total).toBe(1);
      expect(current.calculated.breakdowns['skill.klo'].total).toBe(1);
      // Staged replacement equals the saved replacement: Faithful Arodenite for
      // Devotee of the Old Gods, beside Traditionalist, whose +1 is now the
      // Knowledge (history) bonus.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['skill.khi'].total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.dip'].total).toBe(1);
      // Dealing with a follower of Aroden or Iomedae: the +1 trait bonus becomes
      // +3, not +4.
      const follower = arodenite.modifiers.findIndex(
        (row) => row.target === 'skill.dip' && row.condition?.situation,
      );
      expect(
        calculateCharacterSheetPreview(
          replaced,
          {},
          {
            situations: [
              {
                ...local(arodenite.modifiers[follower]?.condition?.situation),
                sheetEntryId: first,
              },
            ],
          },
        ).breakdowns['skill.dip'].total,
      ).toBe(3);
      // The drawback slot takes the drawback, whose Sense Motive penalty always
      // applies and whose sight-based Perception penalty waits for its
      // Situation, and adds one trait to the budget.
      const { sheet: drawbackSheet, entryId: drawback } =
        await steps.selectDrawback();
      const before = drawbackSheet.calculated.breakdowns;
      expect(replaced.calculated.breakdowns['skill.sen'].total).toBe(0);
      expect(before['skill.sen'].total).toBe(-2);
      expect(replaced.calculated.breakdowns['skill.per'].total).toBe(0);
      expect(before['skill.per'].total).toBe(0);
      const sight = oblivious.modifiers.findIndex(
        (row) => row.target === 'skill.per',
      );
      const penalized = calculateCharacterSheetPreview(
        drawbackSheet,
        {},
        {
          situations: [
            {
              ...local(oblivious.modifiers[sight]?.condition?.situation),
              sheetEntryId: drawback,
            },
          ],
        },
      ).breakdowns;
      expect(penalized['skill.per'].total - before['skill.per'].total).toBe(-2);
      expect(penalized['skill.sen'].total - before['skill.sen'].total).toBe(0);
    },
  },
  {
    batch: 'traits-381',
    traits: {
      first: 'pf1-content/hFPZTW74AF3mC16p', // Bloody-Minded
      second: 'pf1-content/h13NR5ehJSQcbRRX', // Local Tough (Hell's Vengeance)
      replacement: 'pf1-content/k1yuWxuzWIn03iHu', // Soul-Searcher's Strength (Rivethun)
      drawback: 'pf1-content/j85VYhjNWD2Eeq8D', // Too Many Secrets
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: soul } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['skill.int'].total).toBe(1);
      expect(saved.calculated.breakdowns.init.total).toBe(1);
      expect(saved.calculated.breakdowns['save.fort'].total).toBe(0);
      expect(saved.calculated.breakdowns['save.will'].total).toBe(0);
      expect(saved.calculated.breakdowns['skill.blf'].total).toBe(0);
      const { sheet: current } = await steps.selectSecond();
      // Local Tough's +1 trait bonus on Intimidate doesn't stack with
      // Bloody-Minded's.
      expect(current.calculated.breakdowns['skill.int'].total).toBe(1);
      // Staged replacement equals the saved replacement: Soul-Searcher's
      // Strength for Bloody-Minded, beside Local Tough, whose +1 is now the
      // Intimidate bonus. The reviewed change replacement leaves Fortitude alone.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['skill.int'].total).toBe(1);
      expect(replaced.calculated.breakdowns.init.total).toBe(0);
      expect(replaced.calculated.breakdowns['save.fort'].total).toBe(0);
      // Choosing Will puts the +1 on Will saves only.
      const chosen = soul.modifiers.findIndex(
        (row) =>
          row.target === 'save.will' &&
          JSON.stringify(row.condition?.situation).includes('chose Will'),
      );
      const willChosen = calculateCharacterSheetPreview(
        replaced,
        {},
        {
          situations: [
            {
              ...local(soul.modifiers[chosen]?.condition?.situation),
              sheetEntryId: first,
            },
          ],
        },
      ).breakdowns;
      expect(willChosen['save.will'].total).toBe(1);
      expect(willChosen['save.fort'].total).toBe(0);
      // The drawback slot takes the drawback, whose Bluff penalty always applies
      // and whose illusion penalty waits for the shared Situation, and adds one
      // trait to the budget.
      const { sheet: drawbackSheet } = await steps.selectDrawback();
      const before = drawbackSheet.calculated.breakdowns;
      expect(before['skill.blf'].total).toBe(-2);
      expect(before['save.will'].total).toBe(0);
      const illusion = calculateCharacterSheetPreview(
        drawbackSheet,
        {},
        { situations: ['illusions'] },
      ).breakdowns;
      expect(illusion['save.will'].total - before['save.will'].total).toBe(-2);
      expect(illusion['save.ref'].total - before['save.ref'].total).toBe(-2);
    },
  },
  {
    batch: 'traits-382',
    traits: {
      first: 'pf1-content/mwszWXBi6MMLx7g6', // Chance Savior (Carrion Crown)
      second: 'pf1-content/mU2dsFHjvP7jzFZo', // Westcrown Firebrand (Council of Thieves)
      replacement: 'pf1-content/k7h0NFW82vjRpYh0', // Black Eagle Recruit (Lambreth)
      drawback: 'pf1-content/n4W9KpXF4uuzZn0l', // Dependent
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: eagle, drawback: dependent } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns.init.total).toBe(2);
      expect(saved.calculated.breakdowns['save.will'].total).toBe(0);
      expect(saved.calculated.breakdowns['skill.dip'].total).toBe(0);
      const { sheet: current } = await steps.selectSecond();
      // Westcrown Firebrand's +1 trait bonus on initiative doesn't stack with
      // Chance Savior's +2.
      expect(current.calculated.breakdowns.init.total).toBe(2);
      // Staged replacement equals the saved replacement: Black Eagle Recruit for
      // Chance Savior, beside Westcrown Firebrand, whose +1 is now the initiative
      // bonus.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns.init.total).toBe(1);
      expect(replaced.calculated.breakdowns['save.will'].total).toBe(0);
      // Black Eagle Recruit's +1 against fear uses the shared Situation; an evil
      // outsider's fear effect raises it to +3, its new total.
      const fear = calculateCharacterSheetPreview(
        replaced,
        {},
        { situations: ['fear'] },
      ).breakdowns;
      expect(fear['save.will'].total).toBe(1);
      const evilOutsider = eagle.modifiers.findIndex((row) =>
        JSON.stringify(row.condition?.situation).includes('evil outsider'),
      );
      const evil = calculateCharacterSheetPreview(
        replaced,
        {},
        {
          situations: [
            'fear',
            {
              ...local(eagle.modifiers[evilOutsider]?.condition?.situation),
              sheetEntryId: first,
            },
          ],
        },
      ).breakdowns;
      expect(evil['save.will'].total).toBe(3);
      expect(evil['save.fort'].total - fear['save.fort'].total).toBe(2);
      // The drawback slot takes the drawback, whose shaken rule stays a readable
      // Note on Diplomacy, and adds one trait to the budget.
      const { sheet: drawbackSheet } = await steps.selectDrawback();
      expect(drawbackSheet.calculated.breakdowns['skill.dip'].total).toBe(0);
      expect(dependent.situationalNotes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: 'skill.dip',
            text: 'Whenever you fail a Diplomacy check, you become shaken for 1 hour.',
          }),
        ]),
      );
    },
  },
  {
    batch: 'traits-383',
    traits: {
      first: 'pf1-content/nGesVw4QOtYU4dYx', // Instigator of Rebellion (Minkai)
      second: 'pf1-content/qBC50IaidUJSlE10', // Friend in Every Town
      replacement: 'pf1-content/nyVCTqoBKJquHrJT', // Open-Minded Explorer (Averaka)
      drawback: 'pf1-content/q3BC9DduZdySR839', // Vainglory
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: explorer } = steps.definitions;
      const before = await steps.read();
      expect(before.calculated.breakdowns['skill.dip'].total).toBe(0);
      expect(before.calculated.breakdowns['skill.int'].total).toBe(0);
      expect(before.calculated.breakdowns['skill.klo'].total).toBe(0);
      expect(before.calculated.breakdowns['skill.blf'].total).toBe(0);
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['skill.dip'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.int'].total).toBe(1);
      const { sheet: current } = await steps.selectSecond();
      // Friend in Every Town's +1 trait bonus on Diplomacy doesn't stack with
      // Instigator of Rebellion's; its Knowledge (local) bonus applies.
      expect(current.calculated.breakdowns['skill.dip'].total).toBe(1);
      expect(current.calculated.breakdowns['skill.klo'].total).toBe(1);
      // Staged replacement equals the saved replacement: Open-Minded Explorer
      // for Instigator of Rebellion, beside Friend in Every Town.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['skill.dip'].total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.int'].total).toBe(0);
      // Speaking the target's racial or ethnic language raises Open-Minded
      // Explorer's bonus to +2, its new total; Friend in Every Town's +1 doesn't
      // add to it.
      const language = explorer.modifiers.findIndex((row) =>
        JSON.stringify(row.condition?.situation ?? '').includes(
          'racial or ethnic',
        ),
      );
      const speaking = calculateCharacterSheetPreview(
        replaced,
        {},
        {
          situations: [
            {
              ...local(explorer.modifiers[language]?.condition?.situation),
              sheetEntryId: first,
            },
          ],
        },
      ).breakdowns;
      expect(speaking['skill.dip'].total).toBe(2);
      // The drawback slot takes Vainglory, whose untyped -1 on Bluff applies,
      // and adds one trait to the budget.
      const { sheet: drawbackSheet } = await steps.selectDrawback();
      expect(drawbackSheet.calculated.breakdowns['skill.blf'].total).toBe(-1);
    },
  },
  {
    batch: 'traits-384',
    traits: {
      first: 'pf1-content/qbbEmqo9XpncoDIv', // Absalom Hotspur (Absalom)
      second: 'pf1-content/qxxGzzh6bRTc8KFo', // Reactionary
      replacement: 'pf1-content/sPsB67DupYlnX932', // Heretic's Caution
      drawback: 'pf1-content/t4L3d69bDFFx76IW', // Anxious
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: heretic } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns.init.total).toBe(1);
      expect(saved.calculated.breakdowns['skill.klo'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.blf'].total).toBe(0);
      expect(saved.calculated.breakdowns['skill.dip'].total).toBe(0);
      const { sheet: current } = await steps.selectSecond();
      // Reactionary's +2 trait bonus on initiative doesn't stack with Absalom
      // Hotspur's +1: the higher one applies.
      expect(current.calculated.breakdowns.init.total).toBe(2);
      // Staged replacement equals the saved replacement: Heretic's Caution for
      // Absalom Hotspur, beside Reactionary. Knowledge (local) loses its +1 and
      // Bluff gains the imported +1.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns.init.total).toBe(2);
      expect(replaced.calculated.breakdowns['skill.klo'].total).toBe(0);
      expect(replaced.calculated.breakdowns['skill.blf'].total).toBe(1);
      // Against religious authorities the Bluff bonus is +3 in all, never +4.
      const authorities = heretic.modifiers.findIndex((row) =>
        JSON.stringify(row.condition?.situation ?? '').includes(
          'religious authorities',
        ),
      );
      const opposed = calculateCharacterSheetPreview(
        replaced,
        {},
        {
          situations: [
            {
              ...local(heretic.modifiers[authorities]?.condition?.situation),
              sheetEntryId: first,
            },
          ],
        },
      ).breakdowns;
      expect(opposed['skill.blf'].total).toBe(3);
      // The drawback slot takes the drawback, whose Diplomacy penalty always
      // applies, and adds one trait to the budget.
      const { sheet: drawbackSheet } = await steps.selectDrawback();
      expect(drawbackSheet.calculated.breakdowns['skill.dip'].total).toBe(-2);
    },
  },
  {
    batch: 'traits-385',
    traits: {
      first: 'pf1-content/uhahix6rvZjyKQrD', // Undermarket Smuggler (Goka)
      second: 'pf1-content/uKcGyEuuKCwnXUoA', // Minkai Advocate (Minkai)
      replacement: 'pf1-content/vTqnBVOkGvSYagq7', // Loner of the Rocks (Oread)
      drawback: 'pf1-content/u9yI8vdwJEbgqovd', // Attached
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: loner, drawback: attached } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['skill.blf'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.slt'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.sur'].total).toBe(0);
      expect(saved.calculated.breakdowns['skill.hea'].total).toBe(0);
      expect(saved.calculated.breakdowns['save.will'].total).toBe(0);
      const { sheet: current } = await steps.selectSecond();
      // Minkai Advocate's +1 trait bonus on Bluff doesn't stack with Undermarket
      // Smuggler's +1.
      expect(current.calculated.breakdowns['skill.blf'].total).toBe(1);
      // Staged replacement equals the saved replacement: Loner of the Rocks for
      // Undermarket Smuggler, beside Minkai Advocate. Sleight of Hand loses its
      // +1; Heal and Survival gain the imported +1; Bluff keeps Minkai's +1.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['skill.blf'].total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.slt'].total).toBe(0);
      expect(replaced.calculated.breakdowns['skill.sur'].total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.hea'].total).toBe(1);
      // In underground or mountain environments the Survival bonus is +2 in all,
      // never +3.
      const mountains = loner.modifiers.findIndex((row) =>
        JSON.stringify(row.condition?.situation ?? '').includes('mountain'),
      );
      const outdoors = calculateCharacterSheetPreview(
        replaced,
        {},
        {
          situations: [
            {
              ...local(loner.modifiers[mountains]?.condition?.situation),
              sheetEntryId: first,
            },
          ],
        },
      ).breakdowns;
      expect(outdoors['skill.sur'].total).toBe(2);
      // The drawback slot takes the drawback, whose Will penalty applies only in
      // its Situation, and adds one trait to the budget.
      const { sheet: drawbackSheet, entryId: drawback } =
        await steps.selectDrawback();
      expect(drawbackSheet.calculated.breakdowns['save.will'].total).toBe(0);
      const threatened = attached.modifiers.findIndex(
        (row) => row.target === 'save.will',
      );
      expect(
        calculateCharacterSheetPreview(
          drawbackSheet,
          {},
          {
            situations: [
              {
                ...local(attached.modifiers[threatened]?.condition?.situation),
                sheetEntryId: drawback,
              },
            ],
          },
        ).breakdowns['save.will'].total,
      ).toBe(-1);
    },
  },
  {
    batch: 'traits-386',
    traits: {
      first: 'pf1-content/yqAnb7AjNHpk7ND8', // Shenmen Prospector (Shenmen)
      second: 'pf1-content/wpsm59oj4Pgw4DnT', // Magic Crafter
      replacement: 'pf1-content/yyndu1qwOHp2g5y2', // Local Ties (Iron Gods)
      drawback: 'pf1-content/xOsdjcGvpdfQK1Yt', // Lonely
    },
    stacking: ['first', 'second'],
    async check(steps) {
      const { replacement: ties } = steps.definitions;
      const { sheet: saved, entryId: first } = await steps.selectFirst();
      expect(saved.calculated.breakdowns['skill.apr'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.kdu'].total).toBe(1);
      expect(saved.calculated.breakdowns['skill.dev'].total).toBe(0);
      expect(saved.calculated.breakdowns['skill.sen'].total).toBe(0);
      const { sheet: current } = await steps.selectSecond();
      // Magic Crafter's +1 trait bonus on Appraise doesn't stack with Shenmen
      // Prospector's +1.
      expect(current.calculated.breakdowns['skill.apr'].total).toBe(1);
      // Staged replacement equals the saved replacement: Local Ties for Shenmen
      // Prospector, beside Magic Crafter. Knowledge (dungeoneering) loses its +1,
      // Appraise keeps Magic Crafter's +1 and the reviewed change replacements
      // keep Disable Device unchanged until the choice Situation is selected.
      const replaced = await steps.replace('first');
      expect(replaced.calculated.breakdowns['skill.apr'].total).toBe(1);
      expect(replaced.calculated.breakdowns['skill.kdu'].total).toBe(0);
      expect(replaced.calculated.breakdowns['skill.dev'].total).toBe(0);
      // With the Technologist feat the chosen Disable Device bonus is +3 in all.
      const technologist = ties.modifiers.findIndex((row) =>
        JSON.stringify(row.condition?.situation ?? '').includes(
          'Disable Device and possess the Technologist feat',
        ),
      );
      const chosen = calculateCharacterSheetPreview(
        replaced,
        {},
        {
          situations: [
            {
              ...local(ties.modifiers[technologist]?.condition?.situation),
              sheetEntryId: first,
            },
          ],
        },
      ).breakdowns;
      expect(chosen['skill.dev'].total).toBe(3);
      // The drawback slot takes the drawback, whose Sense Motive penalty always
      // applies, and adds one trait to the budget.
      const { sheet: drawbackSheet } = await steps.selectDrawback();
      expect(drawbackSheet.calculated.breakdowns['skill.sen'].total).toBe(-2);
    },
  },
];

// One import holds the four traits of every row. The definitions leave
// prerequisite atoms out and no assertion reads a reference to another
// entry, so no other record is imported. The release below imports its own
// records (see there).
const { entries } = await importReleasedEntries(
  rows.flatMap((row) => Object.values(row.traits)),
);

/**
 * Runs one row on a fresh convex-test database: an owner and a member of the
 * campaign's organization and an outsider; a character with ability scores
 * of 10; the row's four held traits as character-scoped Catalog Entries and
 * a copy of the first in another campaign. The row's check drives the steps;
 * then the member cannot select the other campaign's copy or read through
 * the other campaign, an anonymous caller and the outsider can neither read
 * nor edit, the first selection is unchanged by the refused edits, and no
 * release is active.
 */
async function selectTraits(row: TraitRow) {
  for (const key of Object.values(row.traits))
    if (!(traitBatches[row.batch] as readonly string[]).includes(key))
      throw new Error(`${row.batch} lists no ${key}`);
  const user = (name: string) => `${row.batch}|${name}`;
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const) {
      await ctx.db.insert('user', {
        tokenIdentifier: user(name),
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: `Isolated released traits (${row.batch})`,
      description: '',
      organizationId: 'org',
      ownerId: user('owner'),
      e2eFixture: {
        namespace: row.batch,
        version: 1,
        workerKey: '0',
        caseKey: 'released',
        campaignKey: 'released',
      },
    });
    const otherCampaignId = await ctx.db.insert('campaign', {
      name: 'Other isolated campaign',
      description: '',
      organizationId: 'org',
      ownerId: user('owner'),
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: user('owner') });
  const member = t.withIdentity({ tokenIdentifier: user('member') });
  const outsider = t.withIdentity({ tokenIdentifier: user('outsider') });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Released trait preview',
    kind: 'pc',
    operationId: `create-${row.batch}`,
  });
  const scope = { organizationId: 'org', campaignId, characterId };
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
    operationId: 'base-scores',
  });
  const definitions = {
    first: traitDefinition(entries, row.traits.first),
    second: traitDefinition(entries, row.traits.second),
    replacement: traitDefinition(entries, row.traits.replacement),
    drawback: traitDefinition(entries, row.traits.drawback),
  };
  for (const definition of Object.values(definitions))
    expect(disposition(definition.ruleIdentity), definition.name).toBe('held');
  // Character-scoped entries exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: TraitDefinition) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      first: await insert(definitions.first),
      second: await insert(definitions.second),
      replacement: await insert(definitions.replacement),
      drawback: await insert(definitions.drawback),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...definitions.first,
        stacksWithItself: false,
      }),
    };
  });
  async function read() {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing saved sheet');
    return sheet;
  }
  const select = (
    slotId: 'trait:general' | 'trait:drawback',
    position: number,
    role: Role,
  ) =>
    member.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId,
      position,
      catalogEntryId: ids[role],
      operationId: `select-${role}`,
    });
  // The steps run once each, in order.
  let done = 0;
  function step(index: number) {
    if (done !== index) throw new Error(`Step ${index} out of order`);
    done = index + 1;
  }
  let first: EntryId | undefined;
  let second: { sheet: SavedSheet; entryId: EntryId } | undefined;
  let replacedSlot: 'first' | 'second' | undefined;
  await row.check({
    definitions,
    read,
    async selectFirst() {
      step(0);
      first = await select('trait:general', 0, 'first');
      const sheet = await read();
      expect(calculateCharacterSheetPreview(sheet).derivedStatistics).toEqual(
        sheet.calculated.derivedStatistics,
      );
      return { sheet, entryId: first };
    },
    async selectSecond() {
      step(1);
      const entryId = await select('trait:general', 1, 'second');
      second = { sheet: await read(), entryId };
      return second;
    },
    async replace(slot) {
      step(2);
      replacedSlot = slot;
      const current = second!.sheet;
      const [replaced, kept] =
        slot === 'first'
          ? [first!, { entryId: second!.entryId, role: 'second' as const }]
          : [second!.entryId, { entryId: first!, role: 'first' as const }];
      const staged = calculateCharacterSheetPreview(current, {
        entries: current.entries.map((entry) =>
          entry._id === replaced
            ? { ...entry, catalogEntryId: ids.replacement }
            : entry,
        ),
      });
      await member.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId: replaced,
        catalogEntryId: ids.replacement,
        operationId: 'replace',
      });
      const sheet = await read();
      expect(staged.derivedStatistics).toEqual(
        sheet.calculated.derivedStatistics,
      );
      expect(
        sheet.entries.find((entry) => entry._id === kept.entryId),
      ).toMatchObject({ catalogEntryId: ids[kept.role] });
      return sheet;
    },
    async selectDrawback() {
      step(3);
      const entryId = await select('trait:drawback', 0, 'drawback');
      const sheet = await read();
      expect(sheet.calculated.selectionRules.budgets.traits).toBe(3);
      expect(calculateCharacterSheetPreview(sheet).derivedStatistics).toEqual(
        sheet.calculated.derivedStatistics,
      );
      return { sheet, entryId };
    },
  });
  if (done !== 4) throw new Error(`${row.batch} ran ${done} of the 4 steps`);
  await expect(
    member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: first!,
      catalogEntryId: ids.foreign,
      operationId: 'foreign-entry',
    }),
  ).rejects.toThrow('Catalog Entry does not belong to this Character');
  await expect(
    member.query(api.characterSheet.read, {
      ...scope,
      campaignId: otherCampaignId,
    }),
  ).rejects.toThrow('Character not found');
  // An anonymous caller and the outsider are refused alike.
  const noAccess = 'You do not have access to this org';
  for (const actor of [t, outsider]) {
    await expect(actor.query(api.characterSheet.read, scope)).rejects.toThrow(
      noAccess,
    );
    await expect(actor.query(api.catalogCopies.list, scope)).rejects.toThrow(
      noAccess,
    );
    await expect(
      actor.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId: first!,
        active: false,
        operationId: 'denied-edit',
      }),
    ).rejects.toThrow(noAccess);
  }
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (entry) => entry._id === first,
    ),
  ).toMatchObject({
    active: true,
    catalogEntryId: replacedSlot === 'first' ? ids.replacement : ids.first,
  });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
}

describe('held trait selections on a saved sheet', () => {
  for (const row of rows) {
    const name = (role: Role) => entries.get(row.traits[role])?.name;
    const [a, b] = row.stacking;
    test(`${row.batch}: ${name('first')} and ${name('second')}, then ${name('replacement')} in place of one and the drawback ${name('drawback')}; ${name(a)} and ${name(b)} do not stack their trait bonuses on one statistic, the preview matches the saved sheet, and the campaign refuses others`, async () => {
      await selectTraits(row);
    });
  }
});

// The one release boundary of the trait and racial-trait batches (#367 to
// #401): a held-only release of three held traits through import,
// serialization, staging, finalization, fixture-only activation and legal
// readback. The keys, the candidate count, the files' digests and the notices
// are literals, none
// derived from the admission the release reads.
const HELD_RELEASE = {
  releaseNumber: 367,
  held: [
    'pf1-content/18qw3EpSd7gS0Ck6', // Goblin Watcher (Rise of the Runelords)
    'pf1-content/1CC39I0AlWvyEDJ5', // Scarred
    'pf1-content/1v8lH1UJqYMaf2Lr', // Bastard
  ],
  /**
   * The held traits' store files with the SHA-256 the batch review recorded
   * for each: an edit to a record fails the materialisation.
   */
  files: {
    'pf1-content/src/pf-traits/Goblin_Watcher__Rise_of_the_Runelords__18qw3EpSd7gS0Ck6.yaml':
      'be5d53f7b0f02a032f4c82b9d21d063df929362dfad812f173f2d829e4910c8a',
    'pf1-content/src/pf-traits/Scarred_1CC39I0AlWvyEDJ5.yaml':
      'ca7bb21dbfc0c5ef5e4e7f65450a903512af45cd17eef66aa8f95b7608eb1f3b',
    'pf1-content/src/pf-traits/Bastard_1v8lH1UJqYMaf2Lr.yaml':
      'f08231cf0b5fa623697ee5a3048cc84098a2d9fe5d20101a81b0c4f2db42e193',
  },
  /** The notices the held traits' records name, other than the Core Rulebook's. */
  heldNotices: {
    'pf1-content/18qw3EpSd7gS0Ck6': ['PZO1002-PGE', 'PZO1115'],
    'pf1-content/1CC39I0AlWvyEDJ5': ['PZO9484', 'PZO1115', 'PZO1125'],
    'pf1-content/1v8lH1UJqYMaf2Lr': ['PZO1125', 'PZO1115'],
  },
} as const;

test('an isolated release of three held traits publishes none of them and requires none of their notices other than the Core Rulebook’s', async () => {
  const { releaseNumber, held } = HELD_RELEASE;
  const files = await releasedRecordFiles(held);
  expect(files).toHaveLength(3);
  const tree = await materializePinnedTree(files, {
    sha256: HELD_RELEASE.files,
  });
  try {
    // The release is built from the whole artifact it is given, so it
    // imports its three records alone, not with the sheet rows' traits.
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: [...held],
      wholeCorpus: false,
    });
    expect(artifact.curation.passed).toBe(true);
    const release = await createBatchRelease({
      artifact,
      attribution: reviewedAdmission,
      legalResources,
      releaseNumber,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-traits-367-proof',
        sanitizers: 'isolated-traits-367-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    expect(computeFingerprint(transported)).toBe(computeFingerprint(release));
    const rows = transported.batches.flat();
    for (const key of held)
      expect(
        rows.some(
          (published) =>
            published.kind === 'definition' && published.key === key,
        ),
        key,
      ).toBe(false);
    const t = convexTest(schema, modules);
    const writeBatch = makeFunctionReference<
      'mutation',
      { releaseNumber: number; batchIndex: number; rows: unknown },
      CatalogReleaseStatus
    >('catalogRelease:writeBatch');
    await t.mutation(internal.catalogRelease.begin, {
      manifest: transported.manifest,
    });
    for (const [batchIndex, batch] of transported.batches.entries())
      await t.mutation(writeBatch, { releaseNumber, batchIndex, rows: batch });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber });
    expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
    // This control exists only in convex-test's isolated database. No
    // deployment, production catalog or held body is published by the test.
    await t.run(async (ctx) => {
      const releaseId = (
        await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) =>
            q.eq('releaseNumber', releaseNumber),
          )
          .unique()
      )?._id;
      if (!releaseId) throw new Error('Missing isolated prepared release');
      await ctx.db.insert('catalogReleaseControl', {
        key: 'global',
        releaseNumber,
        releaseId,
        schemaIdentity: catalogRuntimeCompatibility.schema,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
        isFixtureOnly: true,
      });
    });
    const legal = releaseLegalInputsSchema.parse(
      await t.query(api.catalogRelease.legalInputs, {}),
    );
    // No held trait's notices become required by a release that admits none.
    for (const [key, codes] of Object.entries(HELD_RELEASE.heldNotices))
      for (const code of codes)
        expect(legal.requiredNotices, `${key} ${code}`).not.toContain(code);
    expect(computeFingerprint(legal.registry)).toBe(
      computeFingerprint(reviewedAdmission.registry),
    );
    expect(computeFingerprint(legal.resources)).toBe(
      computeFingerprint(legalResources),
    );
  } finally {
    await tree.dispose();
  }
}, 90_000);
