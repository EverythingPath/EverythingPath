import { requireAbilityScore } from './characterSheetData';
import type { Doc } from '../_generated/dataModel';
import type { CanonicalWeekState } from '../../src/lib/canonical-weekly-source';
import type { ReadCtx } from '../types';
import { ConvexError } from 'convex/values';
import {
  abilityKeys,
  abilityTargets,
  type Ability,
} from '../../src/lib/character-sheet';
import { loadPreparedCharacterSheet } from './preparedCharacterSheet';

export function requireWholeCharacterStatistics(
  statistics: Partial<Pick<Doc<'character'>, 'level' | Ability>>,
) {
  if (statistics.level !== undefined && !Number.isSafeInteger(statistics.level))
    throw new ConvexError('Enter a whole level');
  for (const ability of abilityKeys) {
    const score = statistics[ability];
    if (score !== undefined) requireAbilityScore(score);
  }
}

export async function calculateMilitiaCharacterFacts(
  ctx: ReadCtx,
  character: Doc<'character'>,
  preparedSheet:
    | {
        permanentCalculated: Pick<
          NonNullable<
            Awaited<ReturnType<typeof loadPreparedCharacterSheet>>
          >['permanentCalculated'],
          | 'abilities'
          | 'level'
          | 'racialHitDice'
          | 'companionProgression'
          | 'hitDice'
          | 'affectedStatisticTargets'
        >;
      }
    | null
    | undefined = undefined,
  options: { trustedLinkedInputs?: boolean } = { trustedLinkedInputs: true },
): Promise<CanonicalWeekState['militiaSnapshot']['characters'][number]> {
  const sheet =
    preparedSheet === undefined
      ? await loadPreparedCharacterSheet(ctx, character, undefined, options)
      : preparedSheet;
  const calculated = sheet?.permanentCalculated ?? null;
  const racialHitDice = calculated?.racialHitDice ?? 0;
  // A score the sheet can't calculate yet, such as a dormant companion's
  // advanced Strength, stays a partial total that the week's rules require.
  const unresolvedAbilities = abilityKeys.filter((ability) =>
    calculated?.affectedStatisticTargets.includes(abilityTargets[ability]),
  );
  const facts = {
    characterId: character._id,
    level: calculated?.level ?? character.level,
    // Preserve the legacy facts shape for zero racial HD and frozen snapshots.
    ...(racialHitDice ? { racialHitDice } : {}),
    ...(calculated &&
    (calculated.companionProgression || calculated.hitDice === null)
      ? { actualHitDice: calculated.hitDice }
      : {}),
    strength: calculated?.abilities.strength.score ?? character.strength,
    dexterity: calculated?.abilities.dexterity.score ?? character.dexterity,
    constitution:
      calculated?.abilities.constitution.score ?? character.constitution,
    intelligence:
      calculated?.abilities.intelligence.score ?? character.intelligence,
    wisdom: calculated?.abilities.wisdom.score ?? character.wisdom,
    charisma: calculated?.abilities.charisma.score ?? character.charisma,
    // Absent when every score is known, preserving the established facts.
    ...(unresolvedAbilities.length ? { unresolvedAbilities } : {}),
    isActive: character.isActive,
  };
  requireWholeCharacterStatistics(facts);
  return facts;
}
