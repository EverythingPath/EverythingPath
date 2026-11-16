import {
  animalCompanionAllowedFeats,
  animalCompanionAllowedSkills,
} from './catalog/representative-animal-companions';
import type { CharacterSheetInput, SheetWarning } from './character-sheet';
import {
  getCompanionAllocationRule,
  getCompanionIncreaseRule,
  type CompanionContribution,
} from './character-sheet-companion-sources';
import type {
  AnimalCompanionProgressionResolution,
  AnimalCompanionProgressionState,
  CompanionProgressionResolution,
} from './character-sheet-companion-progression';
import {
  companionRankWarnings,
  type CompanionWarn,
} from './character-sheet-companion-rank-warnings';
import { isEidolonState } from './character-sheet-eidolon-progression';
import { eidolonProgressionWarnings } from './character-sheet-eidolon-warnings';

export function companionProgressionWarnings(
  input: CharacterSheetInput,
  progression: CompanionProgressionResolution | null,
  intelligenceScore: number,
): SheetWarning[] {
  if (!progression || !input.companionProgression) return [];
  const state = input.companionProgression;
  const entry = input.entries.find((item) => item.kind === 'base');
  if (!entry) return [];
  const warnings: SheetWarning[] = [];
  const restrictionMessages: string[] = [];
  const restrictionFacts: unknown[] = [];
  const warn = (
    check: SheetWarning['check'],
    message: string,
    facts: unknown,
    kind: SheetWarning['kind'] = 'rules',
  ) => {
    if (check === 'companionSourceRestriction') {
      restrictionMessages.push(message);
      restrictionFacts.push(facts);
      return;
    }
    warnings.push({
      kind,
      check,
      subject: 'companionProgression',
      target: { kind: 'entry', entryId: entry._id },
      message,
      fingerprint: JSON.stringify(facts),
    });
  };
  if (isEidolonState(state)) {
    if (progression.kind === 'eidolon')
      eidolonProgressionWarnings({ input, state, progression, warn });
    return warnings;
  }
  if (progression.kind !== 'animal') return warnings;
  if (progression.status === 'unresolved')
    warn(
      'companionProgressionUnresolved',
      'Animal Companion advancement needs an available granting-class level within the curated level 1–20 table.',
      progression.contributions,
      'unresolved',
    );
  if (progression.status === 'dormant')
    warn(
      'companionProgressionDormant',
      'Animal Companion choices are retained while their advancement is inactive.',
      [state.species, state.keep],
    );
  companionRankWarnings({
    creature: 'Animal Companion',
    skillRanks: state.skillRanks,
    abilityIncreases: state.abilityIncreases,
    budgets: progression.budgets,
    hitDice: progression.hitDice,
    warn,
  });
  intelligenceRestrictions({ input, state, intelligenceScore, warn });
  sourceRestrictions({ state, progression, warn });
  allocationWarnings({ progression, warn });
  if (restrictionMessages.length)
    warnings.push({
      kind: 'rules',
      check: 'companionSourceRestriction',
      subject: 'companionProgression',
      target: { kind: 'entry', entryId: entry._id },
      message: restrictionMessages.join(' '),
      fingerprint: JSON.stringify(restrictionFacts),
    });
  return warnings;
}

type WarningContext = {
  state: AnimalCompanionProgressionState;
  progression: AnimalCompanionProgressionResolution;
  warn: CompanionWarn;
};

function intelligenceRestrictions({
  input,
  state,
  intelligenceScore,
  warn,
}: {
  input: CharacterSheetInput;
  state: AnimalCompanionProgressionState;
  intelligenceScore: number;
  warn: CompanionWarn;
}) {
  if (intelligenceScore < 3) {
    const unsupportedSkills = Object.keys(state.skillRanks).filter(
      (skill) =>
        !animalCompanionAllowedSkills.some(
          (allowed) => skill === allowed || skill === `skill.${allowed}`,
        ),
    );
    if (unsupportedSkills.length)
      warn(
        'companionSourceRestriction',
        'Animal Companions with Intelligence below 3 normally choose ranks from the Animal Skills list; recorded ranks are retained.',
        [intelligenceScore, unsupportedSkills],
      );
    const unsupportedFeats = input.entries
      .filter((row) => row.kind === 'feat')
      .flatMap((row) => {
        if (!('catalogEntryId' in row)) return [];
        const name = input.catalogEntries.find(
          (catalog) => catalog._id === row.catalogEntryId,
        )?.name;
        return name &&
          !animalCompanionAllowedFeats.some(
            (allowed) => name === allowed || name.startsWith(`${allowed} (`),
          )
          ? [name]
          : [];
      });
    if (unsupportedFeats.length)
      warn(
        'companionSourceRestriction',
        'Animal Companions with Intelligence below 3 normally choose feats from the Animal Feats list; recorded feats are retained.',
        [intelligenceScore, unsupportedFeats],
      );
  }
}

function sourceRestrictions({ state, progression, warn }: WarningContext) {
  if (
    progression.contributions.some(
      (source) =>
        source.counting &&
        source.classRuleIdentity === 'ranger' &&
        source.kind !== 'allocation' &&
        source.classLevels !== null &&
        source.classLevels < 4,
    )
  )
    warn(
      'companionSourceRestriction',
      'Hunter’s bond grants an Animal Companion from Ranger level 4.',
      progression.contributions.filter(
        (source) => source.classRuleIdentity === 'ranger',
      ),
    );
  const mount = progression.contributions.find(
    (source) => source.counting && source.ruleKind === 'cavalierMount',
  );
  if (
    (mount?.associatedSize === 'medium' && state.species === 'wolf') ||
    (mount?.associatedSize === 'small' && state.species === 'horse')
  )
    warn(
      'companionSourceRestriction',
      'This species is outside the cavalier’s usual mount choices for their size; the recorded choice is retained.',
      [state.species, mount?.associatedSize],
    );
}

// Divided budgets and one-companion increases warn; recorded allocations and
// sources are never trimmed or moved to another companion.
function allocationWarnings({
  progression,
  warn,
}: Omit<WarningContext, 'state'>) {
  for (const source of progression.contributions) {
    if (!source.counting) continue;
    if (source.kind === 'allocation') warnAllocation(source, warn);
    if (source.kind === 'increase') warnIncrease(source, warn);
  }
}

function warnAllocation(
  source: Extract<CompanionContribution, { kind: 'allocation' }>,
  warn: WarningContext['warn'],
) {
  const { label } = getCompanionAllocationRule(source.ruleKind);
  const { levels, budget, pool } = source.allocation;
  if (levels === null)
    warn(
      'companionAllocationMissing',
      `Allocate ${label} effective levels to this companion.`,
      [source.ruleKind, budget, pool?.allocated ?? null],
      'unresolved',
    );
  if (budget !== null && pool && pool.allocated > budget)
    warn(
      'companionAllocationBudget',
      `${label} allocations total ${pool.allocated} effective levels across ${pool.companions} companions, above its budget of ${budget}. Recorded allocations are kept.`,
      [source.ruleKind, budget, pool.allocated, levels],
    );
}

// Each Boon Companion Selection applies to a different companion (UW p. 217).
function warnIncrease(
  source: Extract<CompanionContribution, { kind: 'increase' }>,
  warn: WarningContext['warn'],
) {
  const { label } = getCompanionIncreaseRule(source.ruleKind);
  const { pool } = source.increase;
  if (pool && pool.companions > pool.selections)
    warn(
      'companionAllocationBudget',
      `${label} applies to one companion per selection, but ${pool.companions} companions draw on ${pool.selections}. Each keeps the benefit until a source is removed.`,
      [source.ruleKind, pool.companions, pool.selections],
    );
}
