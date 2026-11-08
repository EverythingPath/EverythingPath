import type { Doc } from '../../convex/_generated/dataModel';
import type { CanonicalWeekState } from './canonical-weekly-source';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheetProjections,
  type Ability,
  type BaseModifier,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';

export type LegacyCharacter = Omit<
  Pick<
    Doc<'character'>,
    | '_id'
    | 'name'
    | 'description'
    | 'ownerId'
    | 'campaignId'
    | 'kind'
    | 'isActive'
    | 'level'
    | Ability
  >,
  '_id' | 'campaignId'
> & { _id: string; campaignId?: string };

export type LegacyCharacterCandidate = {
  sheetMode: 'militiaOnly' | 'full';
  input: CharacterSheetInput;
};

export const maxLegacyCharacterLevels = 4095;
export const maxLegacyCharacterCandidateBytes = 768 * 1024;

export type MilitiaCharacterFacts =
  CanonicalWeekState['militiaSnapshot']['characters'][number];

export type CandidateMismatch = {
  source: 'legacy' | 'facts';
  field: string;
  expected: string | number | boolean | null;
  actual: string | number | boolean | null;
};

export function mapLegacyCharacter({
  character,
  hasMilitia,
}: {
  character: LegacyCharacter;
  hasMilitia: boolean;
}): LegacyCharacterCandidate {
  if (
    !Number.isSafeInteger(character.level) ||
    character.level < 0 ||
    character.level > maxLegacyCharacterLevels
  )
    throw new Error(
      `Recorded level must be a whole number between 0 and ${maxLegacyCharacterLevels}`,
    );
  for (const ability of abilityKeys) {
    if (!Number.isSafeInteger(character[ability]))
      throw new Error(`Recorded ${ability} must be a finite safe whole number`);
  }
  const sheetMode = character.campaignId && hasMilitia ? 'militiaOnly' : 'full';
  const baseId = `base:${character._id}`;
  const modifiers: BaseModifier[] = abilityKeys.map((ability) => ({
    target: abilityTargets[ability],
    bonusType: 'base',
    value: character[ability],
  }));
  const candidate: LegacyCharacterCandidate = {
    sheetMode,
    input: {
      sheetMode,
      characterKind: character.kind,
      catalogEntries: [
        {
          _id: baseId,
          name: 'Base scores',
          ruleIdentity: baseId,
          stacksWithItself: false,
          detail: { kind: 'base' },
          modifiers,
        },
      ],
      entries: [
        {
          _id: `legacy:base:${character._id}`,
          kind: 'base',
          active: true,
          catalogEntryId: baseId,
          state: {
            kind: 'base',
            abilityMethod: { kind: 'rolled' },
            traitCount: 2,
            campaignTraitRequired: false,
          },
        },
        ...Array.from(
          { length: character.level },
          (_, index) =>
            ({
              _id: `legacy:level:${character._id}:${index + 1}`,
              kind: 'classLevel',
              active: true,
              state: {
                kind: 'classLevel',
                classEntryId: null,
                position: index + 1,
                hpGained: null,
              },
            }) satisfies SheetEntry,
        ),
      ],
    },
  };
  return candidate;
}

export function compareLegacyCharacterCandidate({
  character,
  input,
  facts = [],
}: {
  character: LegacyCharacter;
  input: CharacterSheetInput;
  facts?: readonly MilitiaCharacterFacts[];
}) {
  const calculated = calculateCharacterSheetProjections(input).permanent;
  const flat = {
    level: calculated.level,
    strength: calculated.abilities.strength.score,
    dexterity: calculated.abilities.dexterity.score,
    constitution: calculated.abilities.constitution.score,
    intelligence: calculated.abilities.intelligence.score,
    wisdom: calculated.abilities.wisdom.score,
    charisma: calculated.abilities.charisma.score,
  };
  // Mirror calculateMilitiaCharacterFacts: zero racial Hit Dice stay absent.
  const candidateFacts: MilitiaCharacterFacts = {
    characterId: character._id,
    ...flat,
    ...(calculated.racialHitDice
      ? { racialHitDice: calculated.racialHitDice }
      : {}),
    isActive: character.isActive,
  };
  const mismatches: CandidateMismatch[] = [];
  for (const field of ['level', ...abilityKeys] as const) {
    if (character[field] !== flat[field])
      mismatches.push({
        source: 'legacy',
        field,
        expected: character[field],
        actual: flat[field],
      });
  }
  if (character.kind !== input.characterKind)
    mismatches.push({
      source: 'legacy',
      field: 'kind',
      expected: character.kind,
      actual: input.characterKind,
    });
  for (const [index, mirror] of facts.entries()) {
    for (const field of [
      'characterId',
      'level',
      'racialHitDice',
      ...abilityKeys,
      'isActive',
    ] as const) {
      // Effective Hit Dice add racial Hit Dice, so absent compares as zero.
      const expected =
        field === 'racialHitDice' ? (mirror[field] ?? 0) : mirror[field];
      const actual =
        field === 'racialHitDice'
          ? (candidateFacts[field] ?? 0)
          : candidateFacts[field];
      if (expected !== actual)
        mismatches.push({
          source: 'facts',
          field: `facts[${index}].${field}`,
          expected,
          actual,
        });
    }
  }
  return {
    equal: mismatches.length === 0,
    mismatches,
    flat,
    facts: candidateFacts,
  };
}
