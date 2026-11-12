import { abilityKeys } from './character-sheet';
import { skillDefinitions, sumRanksBySkill } from './character-sheet-skills';
import type {
  CharacterSheetInput,
  ProficiencyGrant,
  SheetWarning,
} from './character-sheet';
import type { ResolvedSheetEntry } from './character-sheet-grants';

export function racialReplacementDuplicateWarning(
  entry: ResolvedSheetEntry['entry'],
  definition: CharacterSheetInput['catalogEntries'][number],
  byEntryIds: readonly string[],
): SheetWarning {
  return {
    kind: 'rules',
    check: 'racialReplacementDuplicate',
    target: { kind: 'entry', entryId: entry._id },
    subject: entry._id,
    fingerprint: JSON.stringify([
      definition.ruleIdentity,
      [...byEntryIds].sort(),
    ]),
    message: `${definition.name ?? 'This standard trait'} is replaced by more than one alternate.`,
  };
}

function racialEntryWarnings(
  input: CharacterSheetInput,
  rows: readonly ResolvedSheetEntry[],
): SheetWarning[] {
  const catalog = new Map(
    input.catalogEntries.map((entry) => [entry._id, entry]),
  );
  const racial = resolveCharacterSheetRacialFacts({
    ...input,
    entries: rows.filter((row) => row.counting).map((row) => row.entry),
  });
  return rows.flatMap((row): SheetWarning[] => {
    const entry = row.entry;
    if (entry.kind !== 'racialTrait') return [];
    const definition = catalog.get(entry.catalogEntryId);
    const detail = definition?.detail;
    if (!definition || detail?.kind !== 'racialTrait') return [];
    if (
      row.origin === 'selection' &&
      row.counting &&
      !isRacialTraitApplicable(racial, definition, input.catalogEntries)
    )
      return [
        {
          kind: 'rules',
          check: 'racialTraitRace',
          target: { kind: 'entry', entryId: entry._id },
          subject: entry._id,
          fingerprint: JSON.stringify([
            definition.ruleIdentity,
            racial.countsAsRaces,
            detail.raceEntryIds
              .map((id) => catalog.get(id)?.ruleIdentity ?? id)
              .sort(),
          ]),
          message: `${definition.name ?? 'This alternate'} belongs to another race.`,
        },
      ];
    if (
      row.counting &&
      detail.unresolvedReplacements?.length &&
      entry.state.replaces === undefined
    )
      return [
        {
          kind: 'unresolved',
          check: 'racialReplacementUnresolved',
          target: { kind: 'entry', entryId: entry._id },
          subject: entry._id,
          fingerprint: JSON.stringify([
            definition.ruleIdentity,
            [...detail.unresolvedReplacements].sort(),
          ]),
          message: `Choose the standard traits replaced by ${definition.name ?? 'this alternate'}: ${detail.unresolvedReplacements.join(', ')}.`,
        },
      ];
    if (row.reason?.kind === 'replaced' && row.reason.byEntryIds.length > 1)
      return [
        racialReplacementDuplicateWarning(
          entry,
          definition,
          row.reason.byEntryIds,
        ),
      ];
    return [];
  });
}

export function racialTraitWarnings(
  input: CharacterSheetInput,
  rows: readonly ResolvedSheetEntry[],
  racialSkillRankBudget: number | null,
): SheetWarning[] {
  const warnings = racialEntryWarnings(input, rows);
  const counting = rows.filter((row) => row.counting).map((row) => row.entry);
  const race = counting.find((entry) => entry.kind === 'race');
  const definition = race
    ? input.catalogEntries.find((item) => item._id === race.catalogEntryId)
    : undefined;
  const detail =
    definition?.detail?.kind === 'race' ? definition.detail : undefined;
  if (race) {
    const hitDice = detail?.racialHitDice ?? 0;
    const ranks = Object.entries(
      sumRanksBySkill(hitDice > 0 ? (race.state.racialSkillRanks ?? {}) : {}),
    ).sort(([a], [b]) => a.localeCompare(b));
    for (const [skill, count] of ranks) {
      if (count <= hitDice) continue;
      warnings.push({
        kind: 'rules',
        check: 'racialSkillRankCap',
        target: { kind: 'entry', entryId: race._id },
        subject: `${race._id}:${skill}`,
        fingerprint: JSON.stringify([skill, count, hitDice]),
        message: `Racial ${skillDefinitions.find((definition) => definition.key === skill)?.name ?? 'skill'} ranks exceed ${hitDice} racial Hit Dice.`,
      });
    }
    if (
      racialSkillRankBudget !== null &&
      ranks.reduce((sum, [, count]) => sum + count, 0) > racialSkillRankBudget
    )
      warnings.push({
        kind: 'rules',
        check: 'racialSkillRankBudget',
        target: { kind: 'entry', entryId: race._id },
        subject: race._id,
        fingerprint: JSON.stringify([racialSkillRankBudget, ranks]),
        message: `Recorded racial ranks exceed the ${racialSkillRankBudget}-rank budget.`,
      });
    if (detail && hitDice > 0 && !detail.racialProgression)
      warnings.push({
        kind: 'unresolved',
        check: 'racialProgressionMissing',
        target: { kind: 'entry', entryId: race._id },
        subject: race._id,
        fingerprint: JSON.stringify([definition?.ruleIdentity, hitDice]),
        message:
          'Set the racial Hit Dice progression to calculate its attack bonus, saves and skill rank budget.',
      });
  }
  for (const entry of counting) {
    if (entry.kind !== 'racialTrait') continue;
    const definition = input.catalogEntries.find(
      (item) => item._id === entry.catalogEntryId,
    );
    if (
      definition?.detail?.kind === 'racialTrait' &&
      definition.detail.abilityChoiceCount === 2
    ) {
      const choices = [entry.state.choice, entry.state.secondChoice];
      const missing = choices.some(
        (choice) => !abilityKeys.some((ability) => ability === choice),
      );
      const duplicate = !missing && choices[0] === choices[1];
      if (missing || duplicate)
        warnings.push({
          kind: missing ? 'incomplete' : 'rules',
          check: duplicate
            ? 'racialAbilityScoreDistinct'
            : 'racialAbilityScoreChoice',
          target: { kind: 'entry', entryId: entry._id },
          subject: entry._id,
          fingerprint: JSON.stringify([definition.ruleIdentity, choices]),
          message: duplicate
            ? 'Choose two different ability scores for these racial adjustments.'
            : 'Choose two ability scores for these racial adjustments.',
        });
      continue;
    }
    if (
      !definition?.modifiers.some(
        (modifier) => modifier.target === 'ability.$choice',
      ) ||
      abilityKeys.some((ability) => ability === entry.state.choice)
    )
      continue;
    warnings.push({
      kind: 'incomplete',
      check: 'racialAbilityScoreChoice',
      target: { kind: 'entry', entryId: entry._id },
      subject: entry._id,
      fingerprint: JSON.stringify([
        definition.ruleIdentity,
        entry.state.choice ?? null,
      ]),
      message: 'Choose an ability score for this racial adjustment.',
    });
  }
  return warnings;
}

export function resolveCharacterSheetRacialFacts(input: CharacterSheetInput) {
  const catalog = new Map(
    input.catalogEntries.map((entry) => [entry._id, entry]),
  );
  const race = input.entries.find(
    (entry) => entry.active && entry.kind === 'race',
  );
  const definition =
    race && 'catalogEntryId' in race
      ? catalog.get(race.catalogEntryId)
      : undefined;
  const detail =
    definition?.detail?.kind === 'race' ? definition.detail : undefined;
  const identities = new Set<string>(
    definition ? [definition.ruleIdentity] : [],
  );
  const racialTraitIdentities = new Set<string>();
  const proficiencies: Exclude<ProficiencyGrant, { choice: true }>[] = [];
  let favoredClassCount = 1;
  let bonusSkillRanksPerLevel = 0;
  const skillSources = new Set<string>();
  const classSources = new Set<string>();
  let size = detail?.size ?? null;
  for (const entry of input.entries) {
    if (!entry.active) continue;
    const catalogEntryId =
      'catalogEntryId' in entry
        ? entry.catalogEntryId
        : entry.kind === 'classLevel'
          ? entry.state.classEntryId
          : undefined;
    const source = catalogEntryId ? catalog.get(catalogEntryId) : undefined;
    if (!source) continue;
    if (entry.kind === 'classLevel') {
      const identity = source.sourceKey ?? source.ruleIdentity;
      if (classSources.has(identity)) continue;
      classSources.add(identity);
    }
    const choice = 'choice' in entry.state ? entry.state.choice : undefined;
    const equivalents = source.countsAsRaces;
    if (equivalents && 'oneOf' in equivalents) {
      if (choice && equivalents.oneOf.includes(choice)) identities.add(choice);
    } else {
      for (const identity of equivalents ?? []) identities.add(identity);
    }
    for (const proficiency of source.proficiencies ?? []) {
      if ('choice' in proficiency) {
        if (choice) proficiencies.push({ baseType: choice });
      } else proficiencies.push(proficiency);
    }
    if (source.detail?.kind !== 'racialTrait') continue;
    if (source.detail.size) size = source.detail.size;
    racialTraitIdentities.add(source.ruleIdentity);
    favoredClassCount = Math.max(
      favoredClassCount,
      source.detail.favoredClassCount ?? 1,
    );
    if (!skillSources.has(source.sourceKey ?? source.ruleIdentity)) {
      bonusSkillRanksPerLevel += source.detail.bonusSkillRanksPerLevel ?? 0;
      skillSources.add(source.sourceKey ?? source.ruleIdentity);
    }
  }
  return {
    raceEntryId: race?._id ?? null,
    size,
    creatureTypes: [...(detail?.creatureTypes ?? [])],
    creatureSubtypes: [...(detail?.creatureSubtypes ?? [])],
    countsAsRaces: [...identities].sort(),
    racialTraitIdentities: [...racialTraitIdentities].sort(),
    favoredClassCount,
    bonusSkillRanksPerLevel,
    proficiencies: [
      ...new Map(
        proficiencies.map((grant) => [JSON.stringify(grant), grant]),
      ).values(),
    ],
  };
}

export function satisfiesRacialPrerequisite(
  racial: Pick<
    ReturnType<typeof resolveCharacterSheetRacialFacts>,
    'countsAsRaces' | 'racialTraitIdentities'
  >,
  clause: { race: readonly string[] } | { racialTrait: string },
) {
  return 'race' in clause
    ? clause.race.some((race) => racial.countsAsRaces.includes(race))
    : racial.racialTraitIdentities.includes(clause.racialTrait);
}

export function isRacialTraitApplicable(
  racial: Pick<
    ReturnType<typeof resolveCharacterSheetRacialFacts>,
    'countsAsRaces'
  >,
  trait: CharacterSheetInput['catalogEntries'][number],
  catalogEntries: CharacterSheetInput['catalogEntries'],
) {
  if (trait.detail?.kind !== 'racialTrait') return false;
  return trait.detail.raceEntryIds.some((id) => {
    const identity =
      catalogEntries.find((entry) => entry._id === id)?.ruleIdentity ?? id;
    return (
      racial.countsAsRaces.includes(identity) ||
      catalogEntries.some(
        (race) =>
          race.detail?.kind === 'race' &&
          racial.countsAsRaces.includes(race.ruleIdentity) &&
          race.detail.allowedAlternateRaces?.includes(identity),
      )
    );
  });
}
