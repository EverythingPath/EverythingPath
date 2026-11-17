import type {
  Ability,
  CharacterSheetCatalogEntry,
  CharacterSheetInput,
  SheetEntry,
} from './character-sheet';
import { normalizeCharacterSheetChoiceName } from './character-sheet-archetype-helpers';
import { characterSheetClassFamily } from './character-sheet-grants';
import {
  canonicalSkillKey,
  skillDefinitions,
  sumRanksBySkill,
} from './character-sheet-skills';
import { classFamilyLevels } from './character-sheet-class-levels';
import {
  evaluateCastingPrerequisite,
  type CastingPrerequisiteInputs,
} from './character-sheet-spellcasting';
import { effectiveSpellListLevel } from './character-sheet-archetype-casting';
import {
  resolveCharacterSheetRacialFacts,
  satisfiesRacialPrerequisite,
} from './character-sheet-racial';
import {
  resolveProficiencies,
  meetsProficiencyPrerequisite,
  type ProficiencyGrant,
  type ManualProficiency,
} from './character-sheet-proficiencies';
import {
  definitionFor,
  canCheckProficiency,
  relevantProficiencyFacts,
} from './character-sheet-proficiency-prerequisites';
import {
  normalize,
  normalizePrerequisiteAtom,
  alignmentNames,
  type Prerequisite,
  type NormalizedPrerequisiteAtom,
} from './character-sheet-prerequisite-schema';
import {
  evaluateCompanionLinkedInputPrerequisite,
  linkedInputKey,
} from './character-sheet-linked-input-evaluation';
import type {
  CompanionLinkedInput,
  CompanionLinkedInputResolution,
} from './character-sheet-linked-inputs';

export type PrerequisiteFacts = {
  abilities: Record<Ability, { score: number }>;
  bab: number | null;
  unresolvedAbilities?: readonly Ability[];
  skillRanks?: Readonly<Record<string, number>> | null;
  companionLinkedInputs?: readonly CompanionLinkedInputResolution[];
  proficiencies?: ReturnType<typeof resolveProficiencies>;
  casting: CastingPrerequisiteInputs;
};
type Evaluation = { met: boolean | null; facts: unknown };
type EvaluationContext = {
  facts: PrerequisiteFacts;
  input: CharacterSheetInput;
  entry: SheetEntry;
  classFeatureAssociations: ClassFeatureAssociations;
};
const unresolved: Evaluation = { met: null, facts: null };
const numeric = (value: number, minimum: number): Evaluation => ({
  met: value >= minimum,
  facts: value,
});
const possession = (held: boolean): Evaluation => ({ met: held, facts: held });
const prerequisiteMet = (
  result: 'met' | 'unmet' | 'unresolved',
): boolean | null => (result === 'unresolved' ? null : result === 'met');
function linkedNumeric(
  input: CompanionLinkedInput,
  minimum: number,
  facts: PrerequisiteFacts,
): Evaluation | undefined {
  const matching =
    facts.companionLinkedInputs?.filter(
      (resolution) =>
        linkedInputKey(resolution.input) === linkedInputKey(input),
    ) ?? [];
  const resolution = matching[0];
  if (!resolution) return undefined;
  if (matching.length !== 1) return unresolved;
  const status = evaluateCompanionLinkedInputPrerequisite({
    resolution,
    evaluate: (value) => (value >= minimum ? 'met' : 'unmet'),
  });
  return {
    met: prerequisiteMet(status),
    facts: resolution.value,
  };
}
type ClassFeatureAssociation = { classIdentity: string; family: string };
type ClassFeatureAssociations = {
  byFeature: ReadonlyMap<string, readonly ClassFeatureAssociation[]>;
  familyByClass: ReadonlyMap<string, string>;
};

// All recorded prefixes share the catalog, so association discovery runs once.
export function buildClassFeatureAssociations(
  catalogEntries: CharacterSheetInput['catalogEntries'],
): ClassFeatureAssociations {
  const definitions = new Map(
    catalogEntries.map((entry) => [entry._id, entry]),
  );
  const byFeature = new Map<string, ClassFeatureAssociation[]>();
  const familyByClass = new Map<string, string>();
  for (const definition of catalogEntries) {
    if (
      definition.detail?.kind !== 'class' ||
      !('featuresByLevel' in definition.detail)
    )
      continue;
    const association = {
      classIdentity: definition.ruleIdentity,
      family: characterSheetClassFamily(definition, catalogEntries),
    };
    familyByClass.set(definition.ruleIdentity, association.family);
    for (const row of definition.detail.featuresByLevel ?? []) {
      const feature = definitions.get(row.catalogEntryId);
      if (!feature) continue;
      const owners = byFeature.get(feature.ruleIdentity) ?? [];
      if (
        !owners.some(
          (owner) => owner.classIdentity === association.classIdentity,
        )
      )
        owners.push(association);
      byFeature.set(feature.ruleIdentity, owners);
    }
  }
  return { byFeature, familyByClass };
}

function equivalentClassFeature({
  requiredIdentity,
  requiredName,
  retainedClassIdentity,
  held,
  associations,
}: {
  requiredIdentity: string;
  requiredName: string | undefined;
  retainedClassIdentity: string | undefined;
  held: CharacterSheetCatalogEntry | undefined;
  associations: ClassFeatureAssociations;
}) {
  if (
    !requiredName ||
    !held?.name ||
    normalizeCharacterSheetChoiceName(requiredName) !==
      normalizeCharacterSheetChoiceName(held.name)
  )
    return false;
  const requiredClasses = associations.byFeature.get(requiredIdentity) ?? [];
  const heldClasses = associations.byFeature.get(held.ruleIdentity) ?? [];
  if (requiredClasses.length)
    return requiredClasses.some((requiredClass) =>
      heldClasses.some(
        (heldClass) =>
          requiredClass.classIdentity !== heldClass.classIdentity &&
          requiredClass.family === heldClass.family,
      ),
    );
  // An inaccessible original keeps its authored class identity beside its name.
  if (!retainedClassIdentity) return false;
  const requiredFamily =
    associations.familyByClass.get(retainedClassIdentity) ??
    retainedClassIdentity;
  return heldClasses.some(
    (heldClass) =>
      heldClass.classIdentity !== retainedClassIdentity &&
      heldClass.family === requiredFamily,
  );
}

function castingSpells(
  input: CharacterSheetInput,
  facts: PrerequisiteFacts,
  requiredIdentity: string,
) {
  const recorded = input.entries.flatMap((entry) => {
    if (!entry.active || entry.kind !== 'spell') return [];
    const casting = facts.casting.spellcastings.find(
      (candidate) => candidate.classEntryId === entry.state.castingClassId,
    );
    const definition = definitionFor(entry, input);
    if (!casting || !definition) return [];
    const listLevel =
      definition.detail?.kind === 'spell'
        ? effectiveSpellListLevel(casting.spellList, {
            ruleIdentity: definition.ruleIdentity,
            levels: definition.detail.levels,
          })
        : undefined;
    // A level a pending Archetype choice decides stays unresolved.
    const level = listLevel === null ? null : (listLevel ?? entry.state.level);
    return [
      {
        ruleIdentity: definition.ruleIdentity,
        classEntryId: casting.classEntryId,
        spellLevel: level,
        source: entry.grantKey ? ('granted' as const) : ('recorded' as const),
      },
    ];
  });
  const unresolvedLevel = recorded.some(
    (spell) =>
      spell.ruleIdentity === requiredIdentity &&
      typeof spell.spellLevel !== 'number',
  );
  const classLists = facts.casting.spellcastings.flatMap((casting) =>
    casting.record !== 'none'
      ? []
      : input.catalogEntries.flatMap((definition) => {
          const level =
            definition.detail?.kind === 'spell'
              ? effectiveSpellListLevel(casting.spellList, {
                  ruleIdentity: definition.ruleIdentity,
                  levels: definition.detail.levels,
                })
              : undefined;
          return level === undefined || level === null
            ? []
            : [
                {
                  ruleIdentity: definition.ruleIdentity,
                  classEntryId: casting.classEntryId,
                  spellLevel: level,
                  source: 'classList' as const,
                },
              ];
        }),
  );
  const granted = facts.casting.spellcastings.flatMap((casting) =>
    (casting.grantedSpells ?? []).map((spell) => ({
      ruleIdentity: spell.ruleIdentity,
      classEntryId: casting.classEntryId,
      spellLevel: spell.spellLevel,
      source: 'granted' as const,
    })),
  );
  return {
    spells: [
      ...recorded.flatMap((spell) =>
        typeof spell.spellLevel === 'number'
          ? [{ ...spell, spellLevel: spell.spellLevel }]
          : [],
      ),
      ...granted,
      ...classLists,
    ],
    unresolvedLevel,
  };
}
function assertNever(value: never): never {
  throw new Error(`Unsupported prerequisite: ${JSON.stringify(value)}`);
}

export function resolvedPrerequisiteProficiency(
  proficiency: ProficiencyGrant,
  entry: SheetEntry,
): ManualProficiency | undefined {
  if (!('choice' in proficiency)) return proficiency;
  const choice =
    'choice' in entry.state ? entry.state.choice?.trim() : undefined;
  return choice ? { baseType: choice } : undefined;
}

// Current facts and the eligible recorded build share inclusive, nonrecursive checks.
export function evaluatePrerequisite(
  requirement: Prerequisite,
  context: EvaluationContext,
): Evaluation {
  if ('anyOf' in requirement) {
    const branches = requirement.anyOf.map((branch) =>
      evaluatePrerequisite(branch, context),
    );
    return {
      met: branches.some(({ met }) => met === true)
        ? true
        : !branches.length || branches.some(({ met }) => met === null)
          ? null
          : false,
      facts: branches.map(({ facts }) => facts),
    };
  }
  const clause: NormalizedPrerequisiteAtom =
    normalizePrerequisiteAtom(requirement);
  const { facts, input, entry } = context;
  switch (clause.kind) {
    case 'ability':
      if (facts.unresolvedAbilities?.includes(clause.ability))
        return unresolved;
      return numeric(facts.abilities[clause.ability].score, clause.min);
    case 'bab':
      return (
        linkedNumeric({ kind: 'baseAttackBonus' }, clause.bab, facts) ??
        (facts.bab === null ? unresolved : numeric(facts.bab, clause.bab))
      );
    case 'skillRanks': {
      const key = canonicalSkillKey(clause.skillRanks);
      if (!key) return unresolved;
      const linked = linkedNumeric(
        { kind: 'skillRanks', skill: key },
        clause.min,
        facts,
      );
      if (linked) return linked;
      if (facts.skillRanks === null) return unresolved;
      if (facts.skillRanks !== undefined)
        return numeric(facts.skillRanks[key] ?? 0, clause.min);
      const ranks = input.entries
        .filter((row) => row.active)
        .reduce((sum, row) => {
          const values =
            row.kind === 'classLevel'
              ? row.state.skillRanks
              : row.kind === 'race'
                ? row.state.racialSkillRanks
                : undefined;
          return sum + (sumRanksBySkill(values ?? {})[key] ?? 0);
        }, 0);
      return numeric(ranks, clause.min);
    }
    case 'feat': {
      const held = input.entries.filter(
        (row) =>
          row.active &&
          row.kind === 'feat' &&
          definitionFor(row, input)?.ruleIdentity === clause.feat,
      );
      if (!clause.choice) return possession(held.length > 0);
      const choices = [
        ...new Set(
          held.map((row) =>
            'choice' in row.state ? normalize(row.state.choice ?? '') : '',
          ),
        ),
      ].sort();
      return {
        met: choices.includes(normalize(clause.choice)),
        facts: choices,
      };
    }
    case 'classFeature': {
      const named = input.catalogEntries.find(
        (definition) => definition.ruleIdentity === clause.classFeature,
      );
      return possession(
        input.entries.some((row) => {
          if (!row.active || row.kind !== 'classFeature') return false;
          const definition = definitionFor(row, input);
          const requiredName = clause.classFeatureName ?? named?.name;
          return (
            definition?.ruleIdentity === clause.classFeature ||
            equivalentClassFeature({
              requiredIdentity: clause.classFeature,
              requiredName,
              retainedClassIdentity: !named
                ? clause.classFeatureClass
                : undefined,
              held: definition,
              associations: context.classFeatureAssociations,
            })
          );
        }),
      );
    }
    case 'race': {
      if (!input.entries.some((row) => row.active && row.kind === 'race'))
        return unresolved;
      const racial = resolveCharacterSheetRacialFacts(input);
      return {
        met: satisfiesRacialPrerequisite(racial, clause),
        facts: racial.countsAsRaces,
      };
    }
    case 'racialTrait': {
      if (!input.entries.some((row) => row.active && row.kind === 'race'))
        return unresolved;
      const racial = resolveCharacterSheetRacialFacts(input);
      return {
        met: satisfiesRacialPrerequisite(racial, clause),
        facts: racial.racialTraitIdentities.filter(
          (identity) => identity === clause.racialTrait,
        ),
      };
    }
    case 'classLevel':
      return (
        linkedNumeric(
          { kind: 'classLevels', classRuleIdentity: clause.classLevel },
          clause.min,
          facts,
        ) ??
        numeric(
          classFamilyLevels(input, clause.classLevel).filter(
            (row) => row.active,
          ).length,
          clause.min,
        )
      );
    case 'characterLevel':
      return (
        linkedNumeric(
          { kind: 'characterLevel' },
          clause.characterLevel,
          facts,
        ) ??
        numeric(
          input.entries.filter((row) => row.active && row.kind === 'classLevel')
            .length,
          clause.characterLevel,
        )
      );
    case 'alignment': {
      const base = input.entries.find((row) => row.kind === 'base');
      const value = base?.kind === 'base' ? base.state.alignment : undefined;
      return value
        ? {
            met: clause.alignment.some(
              (alignment) => normalize(alignment) === normalize(value),
            ),
            facts: normalize(value),
          }
        : unresolved;
    }
    case 'deity': {
      const base = input.entries.find((row) => row.kind === 'base');
      const value = base?.kind === 'base' ? base.state.deity : undefined;
      return value?.trim()
        ? {
            met: normalize(value) === normalize(clause.deity),
            facts: normalize(value),
          }
        : unresolved;
    }
    case 'proficiency': {
      const proficiency = resolvedPrerequisiteProficiency(
        clause.proficiency,
        entry,
      );
      if (!proficiency) return unresolved;
      const resolved = facts.proficiencies ?? resolveProficiencies(input);
      if (!canCheckProficiency(proficiency, resolved, input)) return unresolved;
      return {
        met: meetsProficiencyPrerequisite(
          resolved,
          { kind: 'proficiency', proficiency },
          input,
        ),
        facts: relevantProficiencyFacts(proficiency, resolved, input),
      };
    }
    case 'casterLevel': {
      const result = evaluateCastingPrerequisite(clause, facts.casting);
      const levels = facts.casting.spellcastings.filter(
        (casting) => !casting.unresolved.includes('casterLevel'),
      );
      return {
        met: prerequisiteMet(result),
        facts: Math.max(
          0,
          ...levels.map((casting) => casting.casterLevel?.total ?? 0),
        ),
      };
    }
    case 'canCast': {
      const result = evaluateCastingPrerequisite(clause, facts.casting);
      return {
        met: prerequisiteMet(result),
        facts: [
          ...new Set(
            facts.casting.spellcastings
              .filter(
                (casting) =>
                  !clause.canCast.kind ||
                  casting.spellKind === clause.canCast.kind,
              )
              .flatMap((casting) =>
                casting.castableSpellLevels.filter(
                  (level) => level <= clause.canCast.spellLevel,
                ),
              ),
          ),
        ].sort((left, right) => left - right),
      };
    }
    case 'castsSpell': {
      const spells = castingSpells(input, facts, clause.castsSpell);
      const requiredSpell = input.catalogEntries.find(
        (definition) => definition.ruleIdentity === clause.castsSpell,
      );
      const unavailableList =
        facts.casting.spellcastings.some(
          (casting) => casting.record === 'none',
        ) &&
        (requiredSpell?.detail?.kind !== 'spell' ||
          !requiredSpell.detail.levels);
      const result = evaluateCastingPrerequisite(clause, {
        ...facts.casting,
        spellcastingUnresolved: [
          ...(facts.casting.spellcastingUnresolved ?? []),
          ...(unavailableList ? ['spellList'] : []),
          ...(spells.unresolvedLevel ? ['spellLevel'] : []),
        ],
        spells: spells.spells,
      });
      return {
        met: prerequisiteMet(result),
        facts: [
          ...new Set(
            spells.spells
              .filter((spell) => spell.ruleIdentity === clause.castsSpell)
              .map((spell) =>
                JSON.stringify({
                  spellLevel: spell.spellLevel,
                  castableSpellLevels: facts.casting.spellcastings
                    .find(
                      (casting) => casting.classEntryId === spell.classEntryId,
                    )
                    ?.castableSpellLevels.filter(
                      (level) => level <= spell.spellLevel,
                    ),
                }),
              ),
          ),
        ].sort(),
      };
    }
    case 'unchecked':
      return unresolved;
    default:
      return assertNever(clause);
  }
}

const abilityNames: Record<Ability, string> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
};
export function prerequisiteLabel(
  requirement: Prerequisite,
  catalogEntries: CharacterSheetInput['catalogEntries'] = [],
): string {
  const name = (identity: string, fallback: string) =>
    catalogEntries.find((entry) => entry.ruleIdentity === identity)?.name ??
    fallback;
  if ('anyOf' in requirement)
    return requirement.anyOf
      .map((branch) => prerequisiteLabel(branch, catalogEntries))
      .join(' or ');
  const clause: NormalizedPrerequisiteAtom =
    normalizePrerequisiteAtom(requirement);
  switch (clause.kind) {
    case 'ability':
      return `${abilityNames[clause.ability]} ${clause.min}`;
    case 'bab':
      return `BAB +${clause.bab}`;
    case 'skillRanks':
      return `${skillDefinitions.find((skill) => skill.key === canonicalSkillKey(clause.skillRanks))?.name ?? 'Required skill'} ${clause.min} ranks`;
    case 'characterLevel':
      return `Character level ${clause.characterLevel}`;
    case 'classLevel':
      return `${name(clause.classLevel, 'Required class')} level ${clause.min}`;
    case 'alignment':
      return clause.alignment
        .map((alignment) => alignmentNames[alignment])
        .join(' or ');
    case 'deity':
      return `Deity: ${clause.deity}`;
    case 'unchecked':
      return clause.unchecked;
    case 'feat':
      return clause.choice
        ? `${name(clause.feat, 'Required feat')} (${clause.choice})`
        : name(clause.feat, 'Required feat');
    case 'classFeature':
      return (
        clause.classFeatureName ??
        name(clause.classFeature, 'Required class feature')
      );
    case 'racialTrait':
      return name(clause.racialTrait, 'Required racial trait');
    case 'race':
      return clause.race
        .map((identity) => name(identity, 'Required race'))
        .join(' or ');
    case 'proficiency':
      return 'choice' in clause.proficiency
        ? 'Proficiency with selected weapon'
        : `Proficiency: ${'category' in clause.proficiency ? clause.proficiency.category : 'baseType' in clause.proficiency ? clause.proficiency.baseType : clause.proficiency.group}`;
    case 'casterLevel':
      return `Caster level ${clause.casterLevel}`;
    case 'canCast':
      return `Cast level ${clause.canCast.spellLevel} ${clause.canCast.kind ?? ''} spells`.trim();
    case 'castsSpell':
      return name(clause.castsSpell, 'Required spell');
    default:
      return assertNever(clause);
  }
}
