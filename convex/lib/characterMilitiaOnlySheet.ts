import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import {
  abilityKeys,
  abilityTargets,
  type AbilityScores,
} from '../../src/lib/character-sheet';
import {
  maxCharacterChildRows,
  requireAbilityScore,
} from './characterSheetData';
import { applyCompanionToSheet } from './characterSheetCompanion';
import { calculateMilitiaCharacterFacts } from './militiaCharacterFacts';
import {
  calculateActiveCharacterSheet,
  requireCompatibleActiveRelease,
} from './catalogReleaseCompatibility';
import {
  loadCharacterSheet,
  insertClassLevel,
  requireCharacterLevel,
  type LoadedCharacterSheet,
} from './characterSheet';

type MilitiaOnlyEdit = {
  organizationId: string;
  characterId: Id<'character'>;
  patch: Partial<AbilityScores> & { level?: number };
  confirmedRemovedLevelIds?: Id<'characterSheetEntry'>[];
  expectedSheetRevision?: number;
};

async function resizeClassLevels(
  ctx: MutationCtx,
  args: MilitiaOnlyEdit,
  sheet: LoadedCharacterSheet,
) {
  const level = args.patch.level;
  if (level === undefined) return false;
  requireCharacterLevel(level);
  const levels = sheet.entries.filter((entry) => entry.kind === 'classLevel');
  if (level === levels.length) return false;
  if (level < levels.length) {
    const removed = levels.slice(level);
    if (
      args.expectedSheetRevision !== sheet.revision ||
      args.confirmedRemovedLevelIds?.length !== removed.length ||
      removed.some(
        (row, index) => row._id !== args.confirmedRemovedLevelIds?.[index],
      )
    )
      throw new ConvexError(
        'Review and confirm the current trailing Class Levels before removing them',
      );
    for (const row of removed)
      await ctx.db.delete('characterSheetEntry', row._id);
    sheet.entries = sheet.entries.filter(
      (entry) => !removed.some((row) => row._id === entry._id),
    );
  } else {
    if (sheet.entries.length + level - levels.length > maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large');
    for (let position = levels.length + 1; position <= level; position++)
      sheet.entries.push(
        await insertClassLevel(ctx, args.characterId, position),
      );
  }
  return true;
}

async function shiftBaseScores(
  ctx: MutationCtx,
  args: MilitiaOnlyEdit,
  sheet: LoadedCharacterSheet,
) {
  const facts = await calculateMilitiaCharacterFacts(
    ctx,
    sheet.character,
    await applyCompanionToSheet(ctx, sheet, { trustedLinkedInputs: true }),
    { trustedLinkedInputs: true },
  );
  const modifiers = sheet.baseScoresEntry.modifiers.map((modifier) => {
    const ability = abilityKeys.find(
      (key) => abilityTargets[key] === modifier.target,
    );
    if (!ability || args.patch[ability] === undefined) return modifier;
    const score = args.patch[ability];
    requireAbilityScore(score);
    const difference = BigInt(score) - BigInt(facts[ability]);
    const value = Number(BigInt(modifier.value) + difference);
    requireAbilityScore(value);
    return difference === 0n ? modifier : { ...modifier, value };
  });
  const changed = modifiers.some(
    (modifier, index) =>
      modifier.value !== sheet.baseScoresEntry.modifiers[index]?.value,
  );
  if (!changed) return false;
  await ctx.db.patch('catalogEntry', sheet.baseScoresEntry._id, { modifiers });
  sheet.baseScoresEntry = { ...sheet.baseScoresEntry, modifiers };
  sheet.catalogEntries = sheet.catalogEntries.map((entry) =>
    entry._id === sheet.baseScoresEntry._id ? sheet.baseScoresEntry : entry,
  );
  return true;
}

export async function editMilitiaOnlySheet(
  ctx: MutationCtx,
  args: MilitiaOnlyEdit,
  character: Doc<'character'>,
) {
  if (!character.sheetMode || !character.campaignId) return null;
  const campaign = await ctx.db.get('campaign', character.campaignId);
  if (!campaign?.e2eFixture) return null;
  const sheet = await loadCharacterSheet(ctx, args, { isWritable: true });
  if (!sheet) return null;
  const hasStatistics =
    args.patch.level !== undefined ||
    abilityKeys.some((ability) => args.patch[ability] !== undefined);
  if (character.sheetMode === 'full' && hasStatistics)
    throw new ConvexError(
      'Edit level and ability scores on the Character Sheet',
    );
  const levelsChanged = await resizeClassLevels(ctx, args, sheet);
  if (levelsChanged) {
    const calculationIdentity = await requireCompatibleActiveRelease(ctx);
    const projections = calculateActiveCharacterSheet(
      {
        entries: sheet.entries,
        catalogEntries: sheet.catalogEntries,
        characterKind: sheet.character.kind,
        sheetMode: sheet.character.sheetMode,
        companionProgression: sheet.entries.find(
          (entry) => entry.kind === 'base',
        )?.state.companionProgression,
        familiarBaseCreatureKey: sheet.character.familiarBaseCreatureKey,
        resources: sheet.resources,
        retired: sheet.retired,
      },
      calculationIdentity,
    );
    sheet.calculated = projections.current;
    sheet.permanentCalculated = projections.permanent;
  }
  const scoresChanged = await shiftBaseScores(ctx, args, sheet);
  return { sheet, changed: levelsChanged || scoresChanged };
}
