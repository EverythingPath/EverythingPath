import type {
  ResolvedStatistic,
  SourcedSituationalNote,
  calculateCharacterSheet,
} from '~/lib/character-sheet';
import {
  identifySituation,
  isCombatSituation,
  serializeSituationIdentity,
  situationMatches,
  situationSelection,
  type RequestedSituation,
} from '~/lib/character-sheet-situations';
import {
  findCharacterSheetStatistic,
  type CharacterSheetBreakdownTarget,
} from '~/lib/character-sheet-breakdowns';
import { describeSituation } from './modifier-labels';
import { describeSituationOption } from './situation-copy';
import {
  diffSituation,
  hasSituationalContributions,
  listSituationGroups,
  listSituationalNoteGroups,
  listSituationNotes,
  listPrerequisiteContributions,
} from './stat-breakdown-groups';

type Preview = (
  situations: readonly RequestedSituation[],
) => Parameters<typeof findCharacterSheetStatistic>[0] | null;

/** All alternate totals come from a fresh resolver result, including combinations. */
export function buildSituationBreakdownView({
  ordinary,
  target,
  previewSituation,
  selected = [],
  findPrerequisiteName = () => null,
}: {
  ordinary: ResolvedStatistic;
  target: CharacterSheetBreakdownTarget;
  previewSituation: Preview;
  selected?: readonly RequestedSituation[];
  findPrerequisiteName?: (catalogEntryId: string) => string | null;
}) {
  function resolve(situations: readonly RequestedSituation[]) {
    const calculated = previewSituation(situations);
    return calculated ? findCharacterSheetStatistic(calculated, target) : null;
  }
  const groups = listSituationGroups(ordinary).map((group) => {
    const statistic = resolve([group.selection]);
    return {
      ...group,
      text:
        typeof group.selection !== 'string' && 'option' in group.selection
          ? describeSituationOption(
              group.selection.option,
              findPrerequisiteName,
            )
          : group.text,
      combat: isCombatSituation(group.selection),
      notes: listSituationNotes(statistic ?? ordinary, group),
      statistic,
      change: statistic
        ? diffSituation({ group, ordinary, inSituation: statistic })
        : null,
    };
  });
  const selectedStatistic = selected.length > 0 ? resolve(selected) : null;
  return {
    ordinary,
    hasMarker: hasSituationalContributions(ordinary),
    groups: groups.filter((group) => !group.combat),
    combatGroups: groups.filter((group) => group.combat),
    notes: (ordinary.notes ?? []).filter(
      (note) =>
        note.situation === undefined && note.condition?.situation === undefined,
    ),
    waiting: listPrerequisiteContributions(ordinary),
    excluded: ordinary.excluded ?? [],
    selected: selectedStatistic
      ? {
          selections: selected,
          statistic: selectedStatistic,
          changed: selectedStatistic.total !== ordinary.total,
          waiting: selectedStatistic.conditional.filter((row) => {
            const situation = row.condition?.situation;
            return (
              situation === undefined ||
              situationMatches(situation, row.sheetEntryId, selected)
            );
          }),
          notes: (selectedStatistic.notes ?? []).filter((note) => {
            const situation = note.situation ?? note.condition?.situation;
            return (
              situation === undefined ||
              situationMatches(situation, note.sheetEntryId, selected)
            );
          }),
        }
      : null,
  };
}

/** Entry-level rules never migrate to a statistic or affect its total. */
export function findEntrySituationNotes(
  notes: readonly SourcedSituationalNote[],
  entryId: string,
) {
  return notes.filter(
    (note) => note.sheetEntryId === entryId && note.target === undefined,
  );
}

/** Includes conditions only visible inside a casting, school or routine line. */
export function listCharacterSituationGroups(
  calculated: ReturnType<typeof calculateCharacterSheet>,
) {
  const statistics: (ResolvedStatistic | null)[] = [
    ...Object.values(calculated.breakdowns),
    ...Object.values(calculated.derivedStatistics),
    ...calculated.spellcastings.flatMap((casting) => [
      casting.casterLevel,
      casting.concentration,
      ...casting.slots.flatMap((slot) => [
        slot.dc,
        ...slot.schoolDCs.map((school) => school.breakdown),
      ]),
    ]),
    ...calculated.attackRoutines.flatMap((routine) => [
      ...[...routine.single, ...routine.full].flatMap((line) => [
        line.attackBonus,
        line.damageBonus,
        line.criticalThreat,
        line.criticalMultiplier,
        line.rangeIncrement,
      ]),
      routine.twoWeaponRend?.damageBonus ?? null,
      routine.flurry?.baseAttackBonus ?? null,
    ]),
  ];
  const groups = new Map<
    string,
    ReturnType<typeof listSituationGroups>[number]
  >();
  for (const statistic of statistics) {
    if (!statistic) continue;
    for (const group of listSituationGroups(statistic))
      groups.set(group.key, group);
  }
  for (const group of listSituationalNoteGroups(calculated.entryNotes))
    groups.set(group.key, group);
  // Item Ability dice with a Situation of their own (holy's evil, bane's
  // foe, huntsman's tracked quarry, local to its item) are previewed like
  // any other, though they change no total (#408).
  for (const routine of calculated.attackRoutines)
    for (const line of [...routine.single, ...routine.full])
      for (const part of line.extraDamage) {
        if (part.situation === null) continue;
        const key = serializeSituationIdentity(
          identifySituation(part.situation, part.sheetEntryId),
        );
        if (!groups.has(key))
          groups.set(key, {
            key,
            text: describeSituation(part.situation),
            selection: situationSelection(part.situation, part.sheetEntryId),
          });
      }
  return [...groups.values()];
}
