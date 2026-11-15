import { describeRetiredChoice } from './retired-catalog-choices';
import { isRacialTraitApplicable } from '~/lib/character-sheet-racial';
import { creatureTypeProgressionSeeds } from '~/lib/character-sheet-creature-types';
import {
  buildCharacterSheetSelectionsView,
  type CharacterSheetSelectionRow,
} from './character-sheet-selections-view-model';
import { buildCharacterSheetGrantsView } from './character-sheet-grants-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';

/** Catalog options and resolver rows keep presentation independent of persistence. */
export function buildCharacterSheetRacesView(
  snapshot: CharacterSheetSnapshot,
  choices: CharacterSheetSnapshot['catalogEntries'] = [],
  selectionRows: readonly CharacterSheetSelectionRow[] = buildCharacterSheetSelectionsView(
    snapshot,
  ).allRows,
) {
  const catalogEntries = [
    ...new Map(
      [...choices, ...snapshot.catalogEntries].map((entry) => [
        entry._id,
        entry,
      ]),
    ).values(),
  ];
  const statisticsCopyIds = new Set(
    snapshot.entries.flatMap((entry) =>
      entry.kind === 'race' &&
      entry.catalogOverride &&
      !catalogEntries.find(
        (definition) => definition._id === entry.catalogEntryId,
      )?.copiedFrom
        ? [entry.catalogEntryId]
        : [],
    ),
  );
  const raceOptions = catalogEntries.flatMap((entry) =>
    entry.detail.kind === 'race' &&
    !entry.racialStatisticsCopy &&
    !statisticsCopyIds.has(entry._id)
      ? [
          {
            catalogEntryId: entry._id,
            name: entry.name,
            unavailableReason: describeRetiredChoice(snapshot, entry),
            size: entry.detail.size ?? null,
            creatureTypes: entry.detail.creatureTypes ?? [],
          },
        ]
      : [],
  );
  const currentRace = snapshot.entries.find(
    (entry) => entry.kind === 'race' && entry.active,
  );
  const currentRaceId =
    currentRace?.kind === 'race' ? currentRace.catalogEntryId : null;
  const currentDefinition = catalogEntries.find(
    (entry) => entry._id === currentRaceId,
  );
  const selectedRaceId = raceOptions.some(
    (option) => option.catalogEntryId === currentRaceId,
  )
    ? currentRaceId
    : (catalogEntries.find(
        (entry) =>
          entry.ruleIdentity === currentDefinition?.ruleIdentity &&
          raceOptions.some((option) => option.catalogEntryId === entry._id),
      )?._id ?? currentRaceId);
  const standards =
    currentDefinition?.detail.kind === 'race'
      ? currentDefinition.detail.racialTraits
      : [];
  const allStandardIdentities = new Set(
    catalogEntries.flatMap((race) =>
      race.detail.kind === 'race'
        ? race.detail.racialTraits.map(
            (id) =>
              catalogEntries.find((entry) => entry._id === id)?.ruleIdentity ??
              id,
          )
        : [],
    ),
  );
  const traitOptions = catalogEntries.flatMap((definition) => {
    if (
      definition.detail.kind !== 'racialTrait' ||
      allStandardIdentities.has(definition.ruleIdentity)
    )
      return [];
    const selected = snapshot.entries.find(
      (entry) =>
        entry.kind === 'racialTrait' &&
        !entry.grantKey &&
        entry.catalogEntryId === definition._id,
    );
    const resolved =
      selected &&
      snapshot.calculated.resolvedEntries.find(
        (row) => row.storedEntryId === selected?._id,
      );
    const replacementIds =
      selected?.kind === 'racialTrait'
        ? (selected.state.replaces ?? definition.detail.replaces)
        : definition.detail.replaces;
    return [
      {
        catalogEntryId: definition._id,
        name: definition.name,
        subrace: definition.detail.subrace ?? null,
        entryId: selected?._id ?? null,
        selected: selected?.active ?? false,
        dormant: resolved?.dormant ?? false,
        applicable: isRacialTraitApplicable(
          snapshot.calculated.racial,
          definition,
          catalogEntries,
        ),
        replacementIds,
        replacementNames: replacementIds.map(
          (id) =>
            catalogEntries.find((entry) => entry._id === id)?.name ??
            'Unavailable trait',
        ),
        unresolvedReplacements: definition.detail.unresolvedReplacements ?? [],
        hasManualReplacements:
          selected?.kind === 'racialTrait' &&
          selected.state.replaces !== undefined,
      },
    ];
  });
  const selectionsById = new Map(selectionRows.map((row) => [row.rowId, row]));
  const sections = buildCharacterSheetGrantsView({
    entries: snapshot.calculated.resolvedEntries,
    catalogEntries: snapshot.catalogEntries,
    classLevelIds: new Set(
      snapshot.entries
        .filter((entry) => entry.kind === 'classLevel' && entry.active)
        .map((entry) => entry._id),
    ),
    selectionRows,
  });
  const racialSection = sections.find(
    (section) => section.kind === 'racialTrait',
  );
  const choiceRows = snapshot.calculated.resolvedEntries.flatMap(
    ({ entry, counting }) => {
      if (!('catalogEntryId' in entry) || entry.kind === 'base') return [];
      const definition = snapshot.catalogEntries.find(
        (definition) => definition._id === entry.catalogEntryId,
      );
      if (!definition) return [];
      const abilityScoreChoice =
        entry.kind === 'racialTrait' &&
        definition.modifiers.some(
          (modifier) => modifier.target === 'ability.$choice',
        );
      const raceChoices =
        definition.countsAsRaces &&
        !Array.isArray(definition.countsAsRaces) &&
        'oneOf' in definition.countsAsRaces
          ? definition.countsAsRaces.oneOf
          : [];
      if (!abilityScoreChoice && !raceChoices.length) return [];
      return [
        {
          rowId: entry._id,
          selection: selectionsById.get(entry._id),
          name: definition.name,
          target: entry.grantKey
            ? { grantKey: entry.grantKey }
            : { entryId: entry._id },
          counting,
          abilityScoreChoice,
          abilityChoiceCount:
            definition.detail.kind === 'racialTrait'
              ? definition.detail.abilityChoiceCount
              : undefined,
          secondChoice:
            entry.kind === 'racialTrait'
              ? (entry.state.secondChoice ?? null)
              : null,
          raceChoices,
          choice: 'choice' in entry.state ? (entry.state.choice ?? null) : null,
        },
      ];
    },
  );
  return {
    raceOptions,
    selectedRaceId: selectedRaceId ?? null,
    traitOptions,
    standardOptions: standards.map((catalogEntryId) => ({
      catalogEntryId,
      name:
        catalogEntries.find((entry) => entry._id === catalogEntryId)?.name ??
        'Unavailable trait',
    })),
    choiceRows,
    rows: racialSection?.rows ?? [],
    dormantRows: racialSection?.dormantRows ?? [],
  };
}

export type CharacterSheetRacesView = ReturnType<
  typeof buildCharacterSheetRacesView
>;
export type RaceOptionView = CharacterSheetRacesView['raceOptions'][number];
export type RacialTraitOptionView =
  CharacterSheetRacesView['traitOptions'][number];
export type RacialChoiceRowView = CharacterSheetRacesView['choiceRows'][number];

/**
 * The selected race's Hit Dice facts from its definition and the recorded
 * racial hit points and rank allocation from its sheet row. Null without a
 * race; HP starts unknown and is never filled in.
 */
export function buildRaceStatisticsView(snapshot: CharacterSheetSnapshot) {
  const race = snapshot.entries.find(
    (entry) => entry.kind === 'race' && entry.active,
  );
  if (race?.kind !== 'race') return null;
  const definition = snapshot.catalogEntries.find(
    (entry) => entry._id === race.catalogEntryId,
  );
  const detail = definition?.detail.kind === 'race' ? definition.detail : null;
  return {
    entryId: race._id,
    racialHitDice: detail?.racialHitDice ?? 0,
    hitDie: detail?.racialProgression?.hitDie ?? null,
    progression: detail?.racialProgression ?? null,
    creatureTypeOptions: creatureTypeProgressionSeeds.map((seed) => ({
      value: seed.creatureType,
      label: seed.name,
    })),
    characterLevel: snapshot.calculated.level,
    actualHitDice: snapshot.calculated.hitDice,
    featBudget: snapshot.calculated.affectedStatisticTargets.includes(
      'featBudget',
    )
      ? null
      : snapshot.calculated.budgets.generalFeats,
    racialHpGained: race.state.racialHpGained ?? null,
    racialSkillRanks: race.state.racialSkillRanks ?? {},
  };
}
/** Each race's display name by its Rule Identity, for equivalence choices. */
export function listRaceNames(snapshot: CharacterSheetSnapshot) {
  return Object.fromEntries(
    snapshot.catalogEntries
      .filter((entry) => entry.detail.kind === 'race')
      .map((entry) => [entry.ruleIdentity, entry.name]),
  );
}
export type RaceStatisticsView = NonNullable<
  ReturnType<typeof buildRaceStatisticsView>
>;
