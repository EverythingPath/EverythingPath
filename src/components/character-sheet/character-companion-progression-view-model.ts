import {
  alternativeAnimalCompanionAdvancement,
  representativeAnimalCompanions,
} from '~/lib/catalog/representative-animal-companions';
import {
  animalCompanionProgressionStateSchema,
  type AnimalCompanionProgressionResolution,
  type CompanionProgressionResolution,
} from '~/lib/character-sheet-companion-progression';
import { isEidolonState } from '~/lib/character-sheet-eidolon-progression';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { buildSheetWarningViews } from './character-sheet-warning-view-model';
import { formatModifier } from './sheet-parts';
import {
  contributionFamilyLabel,
  describeCompanionAllocation,
} from './character-companion-allocations-view-model';

const sourceLabels: Record<
  CompanionProgressionResolution['contributions'][number]['ruleKind'],
  string
> = {
  animalCompanion: 'Animal companion',
  druidCompanion: 'Nature bond',
  rangerCompanion: 'Hunter’s bond',
  cavalierMount: 'Mount',
  eidolon: 'Eidolon',
  unchainedEidolon: 'Unchained eidolon',
  beastMasterCompanion: 'Beast Master',
  packLordCompanion: 'Pack Lord',
  packmasterCompanion: 'Packmaster',
  boonCompanion: 'Boon Companion',
  broodmasterEidolon: 'Eidolon brood',
  masterSummonerEidolon: 'Lesser eidolon',
  synthesistEidolon: 'Fused eidolon',
};
const valueLabels: Record<
  CompanionProgressionResolution['contributions'][number]['resolution'],
  string
> = {
  calculated: 'Calculated',
  interpretation: 'Chosen interpretation',
  precedence: 'Published precedence',
  fallback: 'Using saved fallback',
  unresolved: 'Unresolved',
};
const statusLabels: Record<CompanionProgressionResolution['status'], string> = {
  active: 'Active',
  dormant: 'Not counting now',
  unresolved: 'Unresolved',
};

export const companionSpeciesChoices =
  animalCompanionProgressionStateSchema.shape.species.options.map((value) => ({
    value,
    label: representativeAnimalCompanions[value].name,
  }));

function projectionView(
  calculated: Pick<
    CharacterSheetSnapshot['calculated'],
    | 'companionProgression'
    | 'level'
    | 'hitDice'
    | 'hp'
    | 'derivedStatistics'
    | 'warnings'
  >,
  acceptedWarnings: CharacterSheetSnapshot['acceptedWarnings'],
) {
  const progression: AnimalCompanionProgressionResolution | null =
    calculated.companionProgression?.kind === 'animal'
      ? calculated.companionProgression
      : null;
  if (!progression) return null;
  const hasResolvedProgression = progression.hitDice !== null;
  const resolvedValue = (value: number | null) =>
    hasResolvedProgression ? value : null;
  return {
    ...progression,
    statusLabel: statusLabels[progression.status],
    sizeLabel: !hasResolvedProgression
      ? 'Unresolved'
      : progression.size === 'large'
        ? 'Large'
        : 'Medium',
    classLevels: calculated.level,
    actualHitDice: resolvedValue(calculated.hitDice),
    hp: calculated.hp,
    bab: resolvedValue(calculated.derivedStatistics.bab.total),
    saves: {
      fortitude: resolvedValue(calculated.derivedStatistics.fortitude.total),
      reflex: resolvedValue(calculated.derivedStatistics.reflex.total),
      will: resolvedValue(calculated.derivedStatistics.will.total),
    },
    contributions: progression.contributions.map((source) => ({
      ...source,
      sourceLabel: sourceLabels[source.ruleKind],
      /** Only an eidolon has summoner levels of another version (#418). */
      isOtherVersion: false,
      valueLabel: source.counting
        ? valueLabels[source.resolution]
        : 'Not contributing',
      hasSavedFallback: source.fallbackState !== 'none',
      allocationSummary: describeCompanionAllocation(source),
      familyLabel: contributionFamilyLabel(source),
    })),
    warnings: buildSheetWarningViews(
      calculated.warnings.filter(
        (warning) => warning.subject === 'companionProgression',
      ),
      acceptedWarnings,
    ),
  };
}

export function buildCompanionProgressionView(
  snapshot: CharacterSheetSnapshot,
) {
  const ordinary = projectionView(
    snapshot.calculated,
    snapshot.acceptedWarnings,
  );
  const permanent = projectionView(
    snapshot.permanentCalculated,
    snapshot.acceptedWarnings,
  );
  if (!ordinary || !permanent) return null;
  const base = snapshot.entries.find((entry) => entry.kind === 'base');
  const recorded = base?.state.companionProgression;
  return {
    speciesName: representativeAnimalCompanions[ordinary.species].name,
    alternativeAdvancementLabel: Object.entries(
      alternativeAnimalCompanionAdvancement,
    )
      .map(
        ([ability, value]) =>
          `${ability === 'dexterity' ? 'Dex' : 'Con'} ${formatModifier(value)}`,
      )
      .join(', '),
    choices: recorded && !isEidolonState(recorded) ? recorded : null,
    speciesChoices: companionSpeciesChoices,
    ordinary,
    permanent,
  };
}

export type CompanionProgressionView = NonNullable<
  ReturnType<typeof buildCompanionProgressionView>
>;
