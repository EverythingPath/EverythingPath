import { z } from 'zod';
import { compareValues } from 'convex/values';
import data from './catalog/data/reviewed-conditions.json';
import type {
  CharacterSheetInput,
  SheetEntry,
  ModifierTarget,
} from './character-sheet';

export const conditionKeys = [
  'bleed',
  'blinded',
  'broken',
  'confused',
  'cowering',
  'dazed',
  'dazzled',
  'dead',
  'deafened',
  'disabled',
  'dying',
  'energy-drained',
  'entangled',
  'exhausted',
  'fascinated',
  'fatigued',
  'flat-footed',
  'frightened',
  'grappled',
  'helpless',
  'incorporeal',
  'invisible',
  'nauseated',
  'panicked',
  'paralyzed',
  'petrified',
  'pinned',
  'prone',
  'shaken',
  'sickened',
  'stable',
  'staggered',
  'stunned',
  'unconscious',
] as const;
export type ConditionKey = (typeof conditionKeys)[number];
const curatedTargets = [
  'ac',
  'skill.per',
  'attack',
  'init',
  'ability.dex',
  'ability.str',
  'skills',
  'saves',
  'cmb',
  'cmd',
  'attack.melee',
  'damage',
] as const satisfies readonly ModifierTarget[];
const conditionDefinitionSchema = z
  .object({
    key: z.enum(conditionKeys),
    name: z.string().min(1),
    ruleIdentity: z.string().min(1),
    modifiers: z.array(
      z
        .object({
          target: z.enum(curatedTargets),
          bonusType: z.enum(['untyped', 'circumstance']),
          value: z.number().finite(),
          condition: z.object({ situation: z.string() }).optional(),
        })
        .strict(),
    ),
    situationalNotes: z.array(
      z
        .object({
          text: z.string().min(1),
          situation: z.object({ local: z.string().min(1) }),
        })
        .strict(),
    ),
    unmodeled: z.array(z.string().min(1)),
    sources: z.array(
      z.object({ book: z.string(), pages: z.string().optional() }),
    ),
    citations: z.array(z.url()),
    sourceSections: z.array(z.string().min(1)),
    deniesDexterityBonus: z.boolean(),
  })
  .strict();
export type ConditionDefinition = z.infer<typeof conditionDefinitionSchema>;
export const conditionDefinitions: ConditionDefinition[] = z
  .array(conditionDefinitionSchema)
  .parse(data);
const definitionsByKey = new Map(
  conditionDefinitions.map((definition) => [definition.key, definition]),
);
export function getConditionDefinition(key: ConditionKey): ConditionDefinition {
  const definition = definitionsByKey.get(key);
  if (!definition) throw new Error('Condition definition is unavailable');
  return definition;
}

export const conditionEffectSchema = z.object({
  sheetEntryId: z.string(),
  conditionKey: z.enum(conditionKeys),
  name: z.string(),
  replacedBy: z.string().optional(),
  notes: z.array(z.string()),
  noteIndexes: z.array(z.number().int().min(0)),
  unmodeled: z.array(z.string()),
});
export type ConditionEffect = z.infer<typeof conditionEffectSchema>;

type ResolvedSheetCondition = {
  entry: Extract<SheetEntry, { kind: 'condition' }>;
  definition: ConditionDefinition;
  replacedBy?: string;
};

function collectSheetConditions({
  input,
  permanentOnly,
}: {
  input: CharacterSheetInput;
  permanentOnly: boolean;
}): ResolvedSheetCondition[] {
  if (permanentOnly) return [];
  const catalogById = new Map(
    input.catalogEntries.map((catalog) => [catalog._id, catalog]),
  );
  return input.entries.flatMap((entry) => {
    if (!entry.active || entry.kind !== 'condition') return [];
    const catalog = catalogById.get(entry.catalogEntryId);
    if (catalog?.detail?.kind !== 'condition' || !catalog.detail.conditionKey)
      return [];
    return [
      {
        entry,
        definition: getConditionDefinition(catalog.detail.conditionKey),
      },
    ];
  });
}

function replaceConditionGroup({
  conditions,
  keys,
  key,
}: {
  conditions: ResolvedSheetCondition[];
  keys: readonly ConditionKey[];
  key: ConditionKey;
}): ResolvedSheetCondition[] {
  const members = conditions.filter(({ definition }) =>
    keys.includes(definition.key),
  );
  const winner =
    members.find(({ definition }) => definition.key === key) ?? members[0];
  if (!winner) return conditions;
  return conditions.map((condition) => {
    if (condition === winner)
      return { ...condition, definition: getConditionDefinition(key) };
    return members.includes(condition)
      ? { ...condition, replacedBy: winner.entry._id }
      : condition;
  });
}

function applyConditionReplacements({
  conditions,
}: {
  conditions: ResolvedSheetCondition[];
}) {
  const fearRanks: Partial<Record<ConditionKey, number>> = {
    shaken: 1,
    frightened: 2,
    panicked: 3,
  };
  const fear = conditions.filter(
    ({ definition }) => definition.key in fearRanks,
  );
  const fearRank = fear.reduce(
    (sum, { definition }) => sum + (fearRanks[definition.key] ?? 0),
    0,
  );
  const afterFear =
    fear.length > 1
      ? replaceConditionGroup({
          conditions,
          keys: ['shaken', 'frightened', 'panicked'],
          key: fearRank >= 3 ? 'panicked' : 'frightened',
        })
      : conditions;
  const fatigue = conditions.filter(({ definition }) =>
    ['fatigued', 'exhausted'].includes(definition.key),
  );
  const afterFatigue =
    fatigue.length > 1
      ? replaceConditionGroup({
          conditions: afterFear,
          keys: ['fatigued', 'exhausted'],
          key: 'exhausted',
        })
      : afterFear;
  return conditions.some(({ definition }) => definition.key === 'pinned')
    ? replaceConditionGroup({
        conditions: afterFatigue,
        keys: ['grappled', 'pinned'],
        key: 'pinned',
      })
    : afterFatigue;
}

function projectConditionInput({
  input,
  conditions,
}: {
  input: CharacterSheetInput;
  conditions: ResolvedSheetCondition[];
}): CharacterSheetInput {
  const definitionsByCatalogId = new Map<string, ConditionDefinition>();
  for (const { entry, definition, replacedBy } of conditions)
    if (!replacedBy || !definitionsByCatalogId.has(entry.catalogEntryId))
      definitionsByCatalogId.set(entry.catalogEntryId, definition);
  return {
    ...input,
    catalogEntries: input.catalogEntries.map((catalog) => {
      const definition = definitionsByCatalogId.get(catalog._id);
      return definition
        ? {
            ...catalog,
            name: definition.name,
            ruleIdentity: definition.ruleIdentity,
            sourceKey: definition.ruleIdentity,
            modifiers: definition.modifiers,
            situationalNotes: [
              ...definition.situationalNotes,
              ...(catalog.situationalNotes ?? []).filter(
                (note) =>
                  !definition.situationalNotes.some(
                    (canonical) => compareValues(canonical, note) === 0,
                  ),
              ),
            ],
            detail: {
              kind: 'condition' as const,
              conditionKey: definition.key,
            },
          }
        : catalog;
    }),
  };
}

export function resolveSheetConditions({
  input,
  permanentOnly = false,
}: {
  input: CharacterSheetInput;
  permanentOnly?: boolean;
}) {
  const conditions = applyConditionReplacements({
    conditions: collectSheetConditions({ input, permanentOnly }),
  });
  const effects: ConditionEffect[] = conditions.map(
    ({ entry, definition, replacedBy }) => ({
      sheetEntryId: entry._id,
      conditionKey: definition.key,
      name: definition.name,
      ...(replacedBy ? { replacedBy } : {}),
      notes: definition.situationalNotes.map((note) => note.text),
      noteIndexes: definition.situationalNotes.map((_, index) => index),
      unmodeled: definition.unmodeled,
    }),
  );
  return {
    input: projectConditionInput({ input, conditions }),
    effects,
    deniedDexterityBy: conditions.find(
      ({ definition, replacedBy }) =>
        !replacedBy && definition.deniesDexterityBonus,
    )?.entry._id,
  };
}
