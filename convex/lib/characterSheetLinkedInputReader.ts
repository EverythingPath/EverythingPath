import { representativeCompanionRules } from '../../src/lib/catalog/representative-companion-rules';
import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import type { readCharacterSheetData } from './characterSheetData';

import {
  getCompanionSupportingEntryKeys,
  isSupportingSourceAvailable,
  readCompanionGraph,
  listRelationshipLinkedInputs,
  resolveCuratedCompanionSources,
  findCuratedCompanionBinding,
} from './companionRelationshipGraph';
import {
  readCompanionLinkedInput,
  resolveCompanionLinkedInput,
  companionLinkedInputSchema,
  linkedInputKey,
  type CompanionLinkedInput,
  type CompanionLinkedInputResolution,
  type CompanionLinkedInputValue,
  type LinkedInputProjection,
  type LinkedInputUnavailableReason,
} from '../../src/lib/character-sheet-linked-inputs';

export type RelationshipScope = {
  characterId: Doc<'character'>['_id'];
  relationshipId: Doc<'companionRelationship'>['_id'];
};
export type InputScope = RelationshipScope & { input: CompanionLinkedInput };
export type LinkedSheet = Awaited<ReturnType<typeof readCharacterSheetData>>;
export type LinkedScope = {
  sheet: LinkedSheet;
  relationship: Doc<'companionRelationship'>;
  saved: Doc<'characterLinkedInput'>[];
};
export type LinkedEndpointReader = (
  characterId: Doc<'character'>['_id'],
) => Promise<{ accessible: boolean; sheet: LinkedSheet | null }>;
function requireValidLinkedInput(input: CompanionLinkedInput) {
  const parsed = companionLinkedInputSchema.safeParse(input);
  if (
    !parsed.success ||
    (input.kind === 'classLevels' &&
      input.classRuleIdentity !== input.classRuleIdentity.trim())
  )
    throw new ConvexError('Provide a valid named linked input');
}
export type LinkedInputRead = CompanionLinkedInputResolution & {
  sources: { key: string; label: string }[];
  unavailableReason: LinkedInputUnavailableReason | null;
  revision: number;
  lastOperationId: string | null;
  updatedBy: string | null;
};
export async function loadLinkedInputContext(
  ctx: ReadCtx,
  {
    scope,
    projection,
    readEndpoint,
    graph: loadedGraph,
  }: {
    scope: LinkedScope;
    projection: LinkedInputProjection;
    readEndpoint: LinkedEndpointReader;
    graph?: Awaited<ReturnType<typeof readCompanionGraph>>;
  },
) {
  const { sheet, relationship } = scope;
  const endpointId =
    relationship.associatedCharacterId === sheet.character._id
      ? relationship.companionCharacterId
      : relationship.associatedCharacterId;
  const resolvedEndpoint = await readEndpoint(endpointId);
  const endpointAccess = resolvedEndpoint.accessible;
  const endpoint = resolvedEndpoint.sheet;
  const graph =
    loadedGraph ??
    (endpoint
      ? await readCompanionGraph(ctx, sheet.character._id, [sheet, endpoint])
      : null);
  const isActive = graph?.states.get(relationship._id)?.status === 'active';
  const rawAssociated =
    relationship.associatedCharacterId === sheet.character._id
      ? sheet
      : endpoint;
  const associated = rawAssociated;
  const calculated = associated
    ? projection === 'permanent'
      ? associated.permanentCalculated
      : associated.calculated
    : null;
  const supportingSheet =
    associated && projection === 'permanent'
      ? {
          ...associated,
          calculated: {
            ...associated.permanentCalculated,
            resolvedEntries: associated.permanentResolvedEntries,
          },
        }
      : associated;
  const countingEntries = getCompanionSupportingEntryKeys(supportingSheet);
  const sources = resolveCuratedCompanionSources({
    relationship,
    sheet: associated,
  });
  return {
    ...scope,
    associated,
    calculated,
    sources,
    countingEntries,
    isActive,
    endpointAccess,
    endpoint,
  };
}
export function requireCuratedLinkedInput(
  relationship: Pick<Doc<'companionRelationship'>, 'kind' | 'sources'>,
  input: CompanionLinkedInput,
) {
  requireValidLinkedInput(input);
  const inputKey = linkedInputKey(input);
  if (
    !listRelationshipLinkedInputs(relationship).some(
      (row) => linkedInputKey(row.input) === inputKey,
    )
  )
    throw new ConvexError(
      'Choose a named input supplied by this Companion Relationship',
    );
  return inputKey;
}
function readUnavailableReason(
  context: Awaited<ReturnType<typeof loadLinkedInputContext>>,
): LinkedInputUnavailableReason {
  if (!context.endpointAccess) return 'inaccessible';
  if (!context.endpoint) return 'missingInput';
  return context.isActive ? 'missingInput' : 'interrupted';
}
export function resolveLinkedInput(
  context: Awaited<ReturnType<typeof loadLinkedInputContext>>,
  input: CompanionLinkedInput,
  values: Map<string, CompanionLinkedInputValue>,
): LinkedInputRead {
  const {
    sheet,
    relationship,
    saved,
    associated,
    calculated,
    sources,
    countingEntries,
    isActive,
    endpointAccess,
  } = context;
  const inputKey = requireCuratedLinkedInput(
    { ...relationship, sources },
    input,
  );
  const recorded = saved.find((row) => row.inputKey === inputKey);
  const declaredSources = sources.flatMap((source) => {
    const binding = findCuratedCompanionBinding(
      source,
      relationship.kind,
      input,
    );
    return binding ? [{ source, binding }] : [];
  });
  const availableSources = declaredSources.filter(
    ({ source }) =>
      source.enabled &&
      isSupportingSourceAvailable(source, countingEntries) &&
      !(source.ruleKind === 'animalCompanion' && input.kind === 'classLevels'),
  );
  const supportedFamilies = [
    ...new Set(
      sources
        .filter(
          (source) =>
            source.enabled &&
            isSupportingSourceAvailable(source, countingEntries),
        )
        .flatMap((source) => {
          const identity =
            representativeCompanionRules[source.ruleKind]
              .contributingClassRuleIdentity;
          return identity ? [identity] : [];
        }),
    ),
  ];
  const candidates =
    endpointAccess && isActive && associated && calculated
      ? availableSources.map(({ source, binding }) => {
          const valueKey = linkedInputKey(binding.sourceInput);
          const value =
            values.get(valueKey) ??
            readCompanionLinkedInput({
              input: binding.sourceInput,
              sheet: {
                entries: associated.entries,
                catalogEntries: associated.catalogEntries,
                characterKind: associated.character.kind,
                sheetMode: associated.character.sheetMode,
                resources: associated.resources,
                familiarBaseCreatureKey:
                  associated.character.familiarBaseCreatureKey,
              },
              calculated,
              contributingClassRuleIdentities: supportedFamilies,
              companionKind: relationship.kind,
            });
          values.set(valueKey, value);
          return {
            sourceKey: source.key,
            ...(binding.role ? { role: binding.role } : {}),
            ...value,
          };
        })
      : [];
  const precedence = declaredSources
    .filter(({ binding }) => binding.precedence !== undefined)
    .sort(
      (left, right) =>
        (left.binding.precedence ?? 0) - (right.binding.precedence ?? 0),
    )
    .map(({ source }) => source.key);
  const resolution = resolveCompanionLinkedInput({
    input,
    candidates,
    fallback: recorded?.fallback,
    interpretation: recorded?.interpretation,
    ...(precedence.length ? { precedence } : {}),
  });
  return {
    ...resolution,
    sources:
      endpointAccess && isActive
        ? declaredSources.map(({ source }) => ({
            key: source.key,
            label: source.label,
          }))
        : [],
    unavailableReason:
      resolution.status === 'unavailable'
        ? readUnavailableReason(context)
        : null,
    interpretation: recorded?.interpretation
      ? endpointAccess
        ? recorded.interpretation
        : {
            sourceKey: `rule:${
              relationship.sources.find(
                (source) => source.key === recorded.interpretation?.sourceKey,
              )?.ruleKind ?? relationship.kind
            }`,
          }
      : null,
    revision: sheet.revision,
    lastOperationId: sheet.lastOperationId,
    updatedBy: sheet.updatedBy,
  };
}
export async function loadSavedLinkedInputs(
  ctx: ReadCtx,
  args: RelationshipScope,
) {
  const saved = await ctx.db
    .query('characterLinkedInput')
    .withIndex('by_characterId_and_relationshipId', (q) =>
      q
        .eq('characterId', args.characterId)
        .eq('relationshipId', args.relationshipId),
    )
    .take(129);
  if (saved.length > 128) throw new ConvexError('Too many named linked inputs');
  return saved;
}
// Calculated endpoints are supplied by the acyclic sheet projection reader.
// Public named-input reads keep the ordinary access-checked loading path above.
export async function listLinkedInputsForSheet(
  ctx: ReadCtx,
  {
    sheet,
    relationship,
    projection,
    readEndpoint,
    graph,
    readBudget,
    saved: providedSaved,
  }: {
    sheet: LinkedSheet;
    saved?: Doc<'characterLinkedInput'>[];
    relationship: Doc<'companionRelationship'>;
    projection: LinkedInputProjection;
    readEndpoint: LinkedEndpointReader;
    graph?: Awaited<ReturnType<typeof readCompanionGraph>>;
    readBudget?: {
      accountRead(value: unknown): void;
      accountReference(id: string): void;
    };
  },
): Promise<LinkedInputRead[]> {
  const saved =
    providedSaved ??
    (await loadSavedLinkedInputs(ctx, {
      characterId: sheet.character._id,
      relationshipId: relationship._id,
    }));
  for (const row of saved) {
    readBudget?.accountRead(row);
    readBudget?.accountReference(row._id);
  }
  const context = await loadLinkedInputContext(ctx, {
    scope: { sheet, relationship, saved },
    projection,
    readEndpoint,
    graph,
  });
  const values = new Map<string, CompanionLinkedInputValue>();
  return listRelationshipLinkedInputs({
    ...relationship,
    sources: context.sources,
  }).map(({ input }) => resolveLinkedInput(context, input, values));
}
