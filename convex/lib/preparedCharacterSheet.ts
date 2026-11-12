import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { characterSheetSubject } from '../../src/lib/character-sheet-availability';
import { isCharacterSheetAvailable } from './characterSheetAvailability';
import { applyCompanionToSheet } from './characterSheetCompanion';
import {
  createReadBudget,
  readCharacterSheetDataWithBudget,
  maxPreparedCharacters,
  type CharacterSheetReadOptions,
} from './characterSheetData';

export async function loadPreparedCharacterSheet(
  ctx: ReadCtx,
  character: Doc<'character'>,
  campaign?: Doc<'campaign'>,
  options: CharacterSheetReadOptions = {},
  readBudget = createReadBudget(options.resourceLimits),
) {
  if (!character.sheetMode) return null;
  const currentCampaign =
    campaign ??
    (character.campaignId
      ? await ctx.db.get('campaign', character.campaignId)
      : null);
  // Under sheet authority every sheet holds its Character's statistics; under
  // legacy authority only fixture and demo sheets do (#413).
  if (
    !(await isCharacterSheetAvailable(
      ctx,
      characterSheetSubject(character, currentCampaign),
    ))
  )
    return null;
  if (!campaign) readBudget.accountRead(currentCampaign);
  const sheet = await readCharacterSheetDataWithBudget(
    ctx,
    character,
    [],
    options,
    readBudget,
  );
  return await applyCompanionToSheet(ctx, sheet, {
    ...options,
    readBudget,
    readSheet: (endpoint) =>
      readCharacterSheetDataWithBudget(ctx, endpoint, [], options, readBudget),
  });
}

export async function loadPreparedCharacterSheets(
  ctx: ReadCtx,
  characters: readonly Doc<'character'>[],
  campaign: Doc<'campaign'>,
  options: CharacterSheetReadOptions = {},
) {
  const sheetsAvailable = await isCharacterSheetAvailable(ctx, {
    kind: 'campaign',
    campaign,
  });
  const prepared = characters.filter(
    (character) => character.sheetMode && sheetsAvailable,
  );
  if (prepared.length > maxPreparedCharacters)
    throw new ConvexError('This campaign exceeds the prepared Character limit');
  return await Promise.all(
    characters.map((character) =>
      loadPreparedCharacterSheet(ctx, character, campaign, options),
    ),
  );
}
