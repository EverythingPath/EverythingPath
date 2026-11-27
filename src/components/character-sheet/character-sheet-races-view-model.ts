import type { ChoiceOption } from './choice-select';
import {
  describeRetiredChoice,
  unofferedChoiceReason,
} from './retired-catalog-choices';
import { isRacialTraitApplicable } from '~/lib/character-sheet-racial';
import { creatureTypeProgressionSeeds } from '~/lib/character-sheet-creature-types';
import {
  buildCharacterSheetSelectionsView,
  type CharacterSheetSelectionRow,
} from './character-sheet-selections-view-model';
import { buildCharacterSheetGrantsView } from './character-sheet-grants-view-model';
import {
  indexEntryRuleValues,
  type EntryRuleValueLookup,
} from './entry-rule-values';
import type { CharacterSheetSnapshot } from './use-character-sheet';

type CatalogDefinition = CharacterSheetSnapshot['catalogEntries'][number];

/** The read's catalog choices and the Character's own definitions, once each. */
function mergeRaceCatalog(
  snapshot: CharacterSheetSnapshot,
  choices: readonly CatalogDefinition[] = [],
) {
  return [
    ...new Map(
      [...choices, ...snapshot.catalogEntries].map((entry) => [
        entry._id,
        entry,
      ]),
    ).values(),
  ];
}

/**
 * The races the race picker lists: every race definition among the read's
 * catalog choices (the Character's own, the campaign's, and the selected
 * Catalog Release's shared races, a campaign's preferred copy in place of
 * its shared original) and the definitions the sheet references, except a
 * statistics copy, each with why it cannot be chosen now, if it cannot: a
 * retired race, or one whose own ID is not among the choices, which only the
 * sheet references (on an inactive race row, say). No definition stands in
 * for another: an offered preferred copy gives nothing to its original, nor
 * an offered original to a copy. Without the choices (while they load) only
 * retirement decides.
 */
export function listChoosableRaces(
  snapshot: CharacterSheetSnapshot,
  choices?: readonly CatalogDefinition[],
) {
  const catalogEntries = mergeRaceCatalog(snapshot, choices);
  const offeredIds = choices && new Set(choices.map((choice) => choice._id));
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
  return catalogEntries.flatMap((definition) =>
    definition.detail.kind === 'race' &&
    !definition.racialStatisticsCopy &&
    !statisticsCopyIds.has(definition._id)
      ? [
          {
            definition: { ...definition, detail: definition.detail },
            unavailableReason:
              describeRetiredChoice(snapshot, definition) ??
              (offeredIds && !offeredIds.has(definition._id)
                ? unofferedChoiceReason
                : null),
          },
        ]
      : [],
  );
}

/** Catalog options and resolver rows keep presentation independent of persistence. */
export function buildCharacterSheetRacesView(
  snapshot: CharacterSheetSnapshot,
  /** The read's catalog choices; undefined while they load. */
  choices?: readonly CatalogDefinition[],
  shared: {
    selectionRows?: readonly CharacterSheetSelectionRow[];
    /** The sheet view's one lookup of the read's numbers (rotation-6 fix r3). */
    ruleValuesOf?: EntryRuleValueLookup;
  } = {},
) {
  const ruleValuesOf =
    shared.ruleValuesOf ?? indexEntryRuleValues(snapshot.calculated);
  const selectionRows =
    shared.selectionRows ??
    buildCharacterSheetSelectionsView(snapshot, undefined, ruleValuesOf)
      .allRows;
  const catalogEntries = mergeRaceCatalog(snapshot, choices);
  const raceOptions = listChoosableRaces(snapshot, choices).map(
    ({ definition, unavailableReason }) => ({
      catalogEntryId: definition._id,
      name: definition.name,
      unavailableReason,
      size: definition.detail.size ?? null,
      creatureTypes: definition.detail.creatureTypes ?? [],
    }),
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
  // The racial traits' and the race's own dice and per-day maxima, as every
  // other row gets them (rotation-6 fix r2).
  const sections = buildCharacterSheetGrantsView({
    entries: snapshot.calculated.resolvedEntries,
    catalogEntries: snapshot.catalogEntries,
    classLevelIds: new Set(
      snapshot.entries
        .filter((entry) => entry.kind === 'classLevel' && entry.active)
        .map((entry) => entry._id),
    ),
    selectionRows,
    ruleValuesOf,
  });
  // Every active race's row, the selected one first: creating a one-off
  // race while a race is selected leaves both active, and the read counts
  // both (rotation-6 fix r3).
  const raceEntryId = snapshot.calculated.racial.raceEntryId;
  const raceRows = [
    ...(sections.find((section) => section.kind === 'race')?.rows ?? []),
  ].sort(
    (left, right) =>
      Number(right.rowId === raceEntryId) - Number(left.rowId === raceEntryId),
  );
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
    /** Each active race's own row: its name and its rule values. */
    raceRows,
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
/**
 * The name of each race the race picker lets the Character choose now
 * (`listChoosableRaces`), by Rule Identity, for equivalence choices.
 */
export function listRaceNames(
  snapshot: CharacterSheetSnapshot,
  choices?: readonly CatalogDefinition[],
) {
  const names = new Map<string, string>();
  for (const { definition, unavailableReason } of listChoosableRaces(
    snapshot,
    choices,
  ))
    if (unavailableReason === null && !names.has(definition.ruleIdentity))
      names.set(definition.ruleIdentity, definition.name);
  return Object.fromEntries(names);
}

/**
 * An equivalence choice's options: the races among `identities` that the
 * Character can choose (`raceNames`, from `listRaceNames`), each by its name.
 * A saved race that is not one stays the current value, unnamed and not
 * choosable.
 */
export function listRaceEquivalenceOptions(
  identities: readonly string[],
  raceNames: Readonly<Record<string, string>>,
  choice: string,
): ChoiceOption[] {
  return identities.flatMap((identity): ChoiceOption[] => {
    const label = raceNames[identity];
    if (label !== undefined) return [{ value: identity, label }];
    return identity === choice
      ? [{ value: identity, label: 'Unavailable race', disabled: true }]
      : [];
  });
}
export type RaceStatisticsView = NonNullable<
  ReturnType<typeof buildRaceStatisticsView>
>;
