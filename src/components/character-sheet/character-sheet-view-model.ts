import { parseCharacterSheetBreakdowns } from '~/lib/character-sheet-breakdowns';
import { abilityTargets, type Ability } from '~/lib/character-sheet';
import { characterLedgerDetails } from '~/lib/character-ledger';
import { listSpellNames } from './archetype-casting-view-model';
import {
  isCatalogSheetEntry,
  isCatalogSheetDefinition,
} from '~/lib/character-sheet-entries';
import { buildCharacterSheetGrantsView } from './character-sheet-grants-view-model';
import {
  buildCharacterSheetSelectionsView,
  buildEntryPrerequisiteView,
} from './character-sheet-selections-view-model';
import {
  buildCharacterSheetRacesView,
  buildRaceStatisticsView,
  listRaceNames,
} from './character-sheet-races-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { buildSheetWarningViews } from './character-sheet-warning-view-model';

export function buildCharacterSheetView(
  snapshot: CharacterSheetSnapshot,
  /** Undefined while the read's catalog choices are loading. */
  catalogChoices?: CharacterSheetSnapshot['catalogEntries'],
) {
  const calculated = {
    ...snapshot.calculated,
    breakdowns: parseCharacterSheetBreakdowns(snapshot.calculated.breakdowns),
  };
  const selections = buildCharacterSheetSelectionsView(
    snapshot,
    catalogChoices,
  );
  const selectionsById = new Map(
    selections.allRows.map((row) => [row.rowId, row]),
  );
  const resolvedByStoredId = new Map(
    calculated.resolvedEntries.map((resolved) => [
      resolved.storedEntryId,
      resolved,
    ]),
  );
  const classLevelIds = new Set(
    snapshot.entries
      .filter((entry) => entry.kind === 'classLevel')
      .map((entry) => entry._id),
  );
  const currentEntries = snapshot.entries.filter((entry) => {
    const resolved = resolvedByStoredId.get(entry._id);
    return !resolved || (!resolved.dormant && resolved.origin !== 'grant');
  });
  function baseScore(ability: Ability) {
    const modifier = snapshot.baseScoresEntry.modifiers.find(
      (item) =>
        item.target === abilityTargets[ability] && item.bonusType === 'base',
    );
    if (!modifier) throw new Error('Base score is unavailable.');
    return modifier.value;
  }

  const classChoices = snapshot.catalogEntries.filter(
    (entry) => entry.detail.kind === 'class' && 'hitDie' in entry.detail,
  );
  const { canBuildOut } = characterLedgerDetails(snapshot.character);
  const minimal = canBuildOut;
  const warning = minimal
    ? (calculated.warnings.find((warning) => warning.check === 'levelZero')
        ?.message ?? null)
    : null;
  return {
    catalogView: snapshot.catalogView,
    character: snapshot.character,
    owner: snapshot.owner,
    campaign: snapshot.campaign,
    canBuildOut,
    calculated,
    permanentCalculated: {
      ...snapshot.permanentCalculated,
      breakdowns: parseCharacterSheetBreakdowns(
        snapshot.permanentCalculated.breakdowns,
      ),
    },
    grants: buildCharacterSheetGrantsView({
      entries: calculated.resolvedEntries,
      catalogEntries: snapshot.catalogEntries,
      classLevelIds,
      selectionRows: selections.allRows,
    }),
    races: buildCharacterSheetRacesView(
      snapshot,
      catalogChoices ?? [],
      selections.allRows,
    ),
    selections,
    raceStatistics: buildRaceStatisticsView(snapshot),
    raceNames: listRaceNames(snapshot),
    classFeatureNames: Object.fromEntries(
      snapshot.catalogEntries
        .filter((entry) => entry.detail.kind === 'classFeature')
        .map((entry) => [entry._id, entry.name]),
    ),
    spellNames: listSpellNames(snapshot.catalogEntries),
    abilityChanges: currentEntries.filter(
      (entry) =>
        entry.kind === 'abilityDamage' || entry.kind === 'abilityDrain',
    ),
    sheetEntries: currentEntries.filter(isCatalogSheetEntry).map((entry) => {
      const catalog = snapshot.catalogEntries.find(
        (row) => row._id === entry.catalogEntryId,
      );
      if (!isCatalogSheetDefinition(catalog))
        throw new Error('Character Sheet Entry is unavailable.');
      return {
        entryId: entry._id,
        selection: selectionsById.get(entry._id),
        active: entry.active,
        name: catalog.name,
        modifiers: catalog.modifiers,
        detail: catalog.detail,
        state: entry.state,
        // A Spell Effect's caster level default, duration and item target.
        spellEffect:
          calculated.spellEffects.find(
            (effect) => effect.entryId === entry._id,
          ) ?? null,
      };
    }),
    baseScores: {
      strength: baseScore('strength'),
      dexterity: baseScore('dexterity'),
      constitution: baseScore('constitution'),
      intelligence: baseScore('intelligence'),
      wisdom: baseScore('wisdom'),
      charisma: baseScore('charisma'),
    },
    adjustments: currentEntries
      .filter((entry) => entry.kind === 'manual')
      .map((entry) => {
        const catalogEntry = snapshot.catalogEntries.find(
          (
            item,
          ): item is Extract<typeof item, { detail: { kind: 'manual' } }> =>
            item._id === entry.catalogEntryId && item.detail.kind === 'manual',
        );
        if (!catalogEntry)
          throw new Error('Personal adjustment is unavailable.');
        return {
          entryId: entry._id,
          selection: selectionsById.get(entry._id),
          catalogEntryId: catalogEntry._id,
          active: entry.active,
          name: catalogEntry.name,
          modifiers: catalogEntry.modifiers,
        };
      }),
    classChoices,
    favoredClassIds:
      snapshot.entries.find((entry) => entry.kind === 'base')?.state
        .favoredClassIds ?? [],
    unplacedSelections: currentEntries
      .filter(
        (entry) =>
          'gainedAtClassLevel' in entry &&
          entry.gainedAtClassLevel !== undefined &&
          resolvedByStoredId.get(entry._id)?.origin === 'selection' &&
          resolvedByStoredId.get(entry._id)?.counting &&
          !classLevelIds.has(entry.gainedAtClassLevel),
      )
      .map((entry) => ({
        ...entry,
        name:
          snapshot.catalogEntries.find(
            (catalog) =>
              'catalogEntryId' in entry && catalog._id === entry.catalogEntryId,
          )?.name ?? 'Unavailable entry',
      })),
    levels: snapshot.entries
      .filter((entry) => entry.kind === 'classLevel')
      .map((entry) => {
        const selected = classChoices.find(
          (choice) => choice._id === entry.state.classEntryId,
        );
        return {
          ...entry,
          prerequisites: buildEntryPrerequisiteView({
            snapshot,
            entryId: entry._id,
            recordedLevelPosition: snapshot.calculated.prerequisites.some(
              (check) =>
                check.entryId === entry._id && check.view === 'recorded',
            )
              ? entry.state.position
              : null,
          }),
          className: selected?.name ?? 'Unspecified',
          isUnspecified: selected === undefined,
        };
      }),
    warning,
    warnings: buildSheetWarningViews(
      calculated.warnings,
      snapshot.acceptedWarnings,
    ),
    permanentWarnings: buildSheetWarningViews(
      snapshot.permanentCalculated.warnings,
      snapshot.acceptedWarnings,
    ),
    showMissingChoices: !minimal,
  };
}
