import { z } from 'zod';
import {
  calculateCharacterSheet,
  type CharacterSheetInput,
  type SheetWarning,
} from './character-sheet';
import { classFamilyLevels } from './character-sheet-class-levels';
import { skillDefinitions } from './character-sheet-skills';
import {
  abilityKeys,
  companionUnresolvedAbilities,
} from './character-sheet-abilities';
import type { CompanionSourceRuleKind } from './catalog/representative-companion-rules';
export {
  linkedInputKey,
  evaluateCompanionLinkedInputPrerequisite,
} from './character-sheet-linked-input-evaluation';

export const companionLinkedInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('characterLevel') }),
  z.object({ kind: z.literal('actualHitDice') }),
  z.object({ kind: z.literal('familiarProgressionLevels') }),
  z.object({
    kind: z.literal('classLevels'),
    classRuleIdentity: z.string().trim().min(1),
  }),
  z.object({ kind: z.literal('baseAttackBonus') }),
  z.object({
    kind: z.literal('baseSave'),
    save: z.enum(['fort', 'ref', 'will']),
  }),
  z.object({
    kind: z.literal('skillRanks'),
    skill: z.enum(skillDefinitions.map(({ key }) => key)),
  }),
  z.object({ kind: z.literal('maximumHp') }),
  z.object({
    kind: z.literal('abilityModifier'),
    ability: z.enum(abilityKeys),
  }),
]);
export type CompanionLinkedInput = z.infer<typeof companionLinkedInputSchema>;
export const linkedInputProjectionSchema = z.enum(['current', 'permanent']);
export type LinkedInputProjection = z.infer<typeof linkedInputProjectionSchema>;
export const linkedInputRoleSchema = z.enum(['addition', 'alternative']);
export const linkedInputUnavailableReasonSchema = z.enum([
  'inaccessible',
  'missingInput',
  'interrupted',
]);
export type LinkedInputUnavailableReason = z.infer<
  typeof linkedInputUnavailableReasonSchema
>;
const linkedInputValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('available'), value: z.number() }),
  z.object({
    kind: z.literal('unavailable'),
    reason: linkedInputUnavailableReasonSchema,
  }),
]);
export type CompanionLinkedInputValue = z.infer<typeof linkedInputValueSchema>;
const linkedInputCandidateSchema = z.discriminatedUnion('kind', [
  linkedInputValueSchema.options[0].extend({
    sourceKey: z.string(),
    role: linkedInputRoleSchema.optional(),
  }),
  linkedInputValueSchema.options[1].extend({
    sourceKey: z.string(),
    role: linkedInputRoleSchema.optional(),
  }),
]);
export type CompanionLinkedInputCandidate = z.infer<
  typeof linkedInputCandidateSchema
>;

export function isLinkedInputInterpretationCandidate(
  candidate: CompanionLinkedInputCandidate,
): candidate is Extract<CompanionLinkedInputCandidate, { kind: 'available' }> {
  return candidate.kind === 'available' && candidate.role !== 'addition';
}

const contributionSchema = z.object({
  sourceKey: z.string(),
  value: z.number(),
});
const interpretationSchema = z.object({ sourceKey: z.string() });
export const companionLinkedInputResolutionSchema = z.object({
  input: companionLinkedInputSchema,
  candidates: z.array(linkedInputCandidateSchema),
  status: z.enum(['available', 'unavailable', 'conflicting']),
  resolution: z.enum([
    'calculated',
    'interpretation',
    'precedence',
    'fallback',
    'unresolved',
  ]),
  value: z.number().nullable(),
  fallback: z.number().nullable(),
  interpretation: interpretationSchema.nullable(),
  fallbackState: z.enum(['none', 'applied', 'suspended']),
  contributions: z.array(contributionSchema),
  prerequisiteStatus: z.enum(['resolved', 'unresolved']),
});
export type CompanionLinkedInputResolution = z.infer<
  typeof companionLinkedInputResolutionSchema
>;

export function readCompanionLinkedInput({
  input,
  sheet,
  projection = 'current',
  calculated: loadedCalculation,
  contributingClassRuleIdentities = ['wizard', 'sorcerer', 'witch'],
  companionKind = 'familiar',
}: {
  input: CompanionLinkedInput;
  sheet: CharacterSheetInput | null;
  projection?: LinkedInputProjection;
  calculated?: Omit<
    ReturnType<typeof calculateCharacterSheet>,
    'resolvedEntries'
  > & {
    resolvedEntries?: ReturnType<
      typeof calculateCharacterSheet
    >['resolvedEntries'];
  };
  contributingClassRuleIdentities?: readonly string[];
  companionKind?: CompanionSourceRuleKind;
}): CompanionLinkedInputValue {
  if (!sheet) return { kind: 'unavailable', reason: 'inaccessible' };
  const calculated =
    loadedCalculation ??
    calculateCharacterSheet(sheet, {
      permanentOnly: projection === 'permanent',
    });
  const available = (
    value: number | null | undefined,
  ): CompanionLinkedInputValue =>
    value == null || !Number.isFinite(value)
      ? { kind: 'unavailable', reason: 'missingInput' }
      : { kind: 'available', value };
  const classProgressionAvailable = calculated.classLevels.every(
    (row) => row.classLevel !== null,
  );
  switch (input.kind) {
    case 'characterLevel':
      return available(calculated.level);
    case 'actualHitDice':
      return available(calculated.hitDice);
    case 'familiarProgressionLevels':
      return available(
        classProgressionAvailable && contributingClassRuleIdentities.length > 0
          ? [...new Set(contributingClassRuleIdentities)].reduce(
              (sum, identity) =>
                sum + classFamilyLevels(sheet, identity).length,
              0,
            )
          : null,
      );
    case 'classLevels':
      return available(
        classProgressionAvailable
          ? classFamilyLevels(sheet, input.classRuleIdentity).length
          : null,
      );
    case 'baseAttackBonus':
    case 'baseSave': {
      if (!classProgressionAvailable) return available(null);
      const bases =
        companionKind === 'familiar'
          ? calculated.ownProgression.classBases
          : calculated.ownProgression.totalBases;
      return available(
        input.kind === 'baseAttackBonus' ? bases.bab : bases.saves[input.save],
      );
    }
    case 'skillRanks': {
      if (
        calculated.companionProgression &&
        calculated.companionProgression.status !== 'active' &&
        !calculated.companionProgression.retained
      )
        return available(null);
      const skill = calculated.skills.find(({ key }) => key === input.skill);
      return available(
        companionKind === 'familiar' ? skill?.ownRanks : skill?.recordedRanks,
      );
    }
    case 'abilityModifier': {
      // Unresolved Companion Progression leaves its physical scores unknown.
      const unresolved =
        calculated.hitDice === null &&
        companionUnresolvedAbilities.some(
          (ability) => ability === input.ability,
        );
      return available(
        unresolved ? null : calculated.abilities[input.ability].modifier,
      );
    }
    case 'maximumHp': {
      const missingModifier = calculated.calculationWarnings.some((warning) =>
        isMissingMaximumHpModifier({ warning, sheet, calculated }),
      );
      return available(missingModifier ? null : calculated.hp);
    }
  }
}

function isMissingMaximumHpModifier({
  warning,
  sheet,
  calculated,
}: {
  warning: SheetWarning;
  sheet: CharacterSheetInput;
  calculated: Omit<
    ReturnType<typeof calculateCharacterSheet>,
    'resolvedEntries'
  > & {
    resolvedEntries?: ReturnType<
      typeof calculateCharacterSheet
    >['resolvedEntries'];
  };
}) {
  if (
    (warning.check !== 'unsupportedFormula' &&
      warning.check !== 'formulaDependency') ||
    warning.target.kind !== 'modifier'
  )
    return false;
  const { entryId, modifierIndex } = warning.target;
  const entry =
    sheet.entries.find((candidate) => candidate._id === entryId) ??
    calculated.resolvedEntries?.find(({ entry }) => entry._id === entryId)
      ?.entry;
  const definition = sheet.catalogEntries.find((candidate) => {
    if (entry && 'catalogEntryId' in entry)
      return candidate._id === entry.catalogEntryId;
    if (entry?.kind === 'classLevel')
      return candidate._id === entry.state.classEntryId;
    return entryId === `class:${candidate.ruleIdentity}`;
  });
  const target = definition?.modifiers[modifierIndex]?.target;
  return (
    target === 'hp' ||
    target === 'ability.con' ||
    (target === 'ability.$choice' &&
      entry &&
      'choice' in entry.state &&
      entry.state.choice === 'constitution')
  );
}

export function resolveCompanionLinkedInput({
  input,
  candidates,
  fallback,
  interpretation,
  precedence,
}: {
  input: CompanionLinkedInput;
  candidates: readonly CompanionLinkedInputCandidate[];
  fallback?: number;
  interpretation?: z.infer<typeof interpretationSchema>;
  precedence?: readonly string[];
}): CompanionLinkedInputResolution {
  const contributions = candidates.flatMap((candidate) =>
    candidate.kind === 'available'
      ? [{ sourceKey: candidate.sourceKey, value: candidate.value }]
      : [],
  );
  const alternatives = candidates.filter(
    (candidate) => candidate.role !== 'addition',
  );
  const additions = candidates.filter(
    (candidate) => candidate.role === 'addition',
  );
  const first = alternatives.find(
    (candidate) => candidate.kind === 'available',
  );
  const allAvailable =
    candidates.length > 0 &&
    candidates.every((candidate) => candidate.kind === 'available');
  const conflicting = alternatives.some(
    (candidate) =>
      candidate.kind === 'available' &&
      candidate.value !==
        (first?.kind === 'available' ? first.value : undefined),
  );
  const status = !allAvailable
    ? 'unavailable'
    : conflicting
      ? 'conflicting'
      : 'available';
  const preferredKey = precedence?.[0];
  const preferred = alternatives.find(
    (candidate) =>
      candidate.sourceKey === preferredKey &&
      isLinkedInputInterpretationCandidate(candidate),
  );
  const interpreted = alternatives.find(
    (candidate) =>
      candidate.sourceKey === interpretation?.sourceKey &&
      isLinkedInputInterpretationCandidate(candidate),
  );
  const chosen = preferred ?? interpreted;
  const baseResolution =
    allAvailable && !conflicting && !preferred
      ? {
          resolution: 'calculated' as const,
          value: first?.kind === 'available' ? first.value : 0,
        }
      : chosen?.kind === 'available'
        ? {
            resolution: preferred
              ? ('precedence' as const)
              : ('interpretation' as const),
            value: chosen.value,
          }
        : { resolution: 'unresolved' as const, value: null };
  const calculatedValue =
    baseResolution.value === null ||
    additions.some((candidate) => candidate.kind === 'unavailable')
      ? null
      : baseResolution.value +
        additions.reduce(
          (sum, candidate) =>
            sum + (candidate.kind === 'available' ? candidate.value : 0),
          0,
        );
  const resolution =
    calculatedValue !== null
      ? baseResolution.resolution
      : fallback !== undefined
        ? 'fallback'
        : 'unresolved';
  const value = calculatedValue ?? fallback ?? null;
  return {
    input,
    candidates: [...candidates],
    status,
    resolution,
    value,
    fallback: fallback ?? null,
    interpretation: interpretation ?? null,
    fallbackState:
      fallback === undefined
        ? 'none'
        : resolution === 'fallback'
          ? 'applied'
          : 'suspended',
    contributions,
    prerequisiteStatus: value === null ? 'unresolved' : 'resolved',
  };
}
