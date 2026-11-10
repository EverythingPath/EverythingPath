import type { WithoutSystemFields } from 'convex/server';
import type { Doc, Id } from '../_generated/dataModel';
import { ConvexError } from 'convex/values';
import {
  listCatalogReferences,
  remapCatalogReferences,
  listCatalogKeyedListMemberships,
  listCatalogDependencyKeys,
  remapCatalogDependencyKeys,
} from '../../src/lib/catalog-copy-references';
import { calculateDefinitionFingerprint } from './catalogCopies';

type CatalogDefinition = WithoutSystemFields<Doc<'catalogEntry'>>;

type CatalogCopy = {
  sourceId: Id<'catalogEntry'>;
  id: Id<'catalogEntry'>;
  definition: CatalogDefinition;
};
type CatalogUpdate = { id: Id<'catalogEntry'>; definition: CatalogDefinition };
type MovePlanBase<Sheet> = {
  requiredDefinitionIds: Id<'catalogEntry'>[];
  copySourceIds: Id<'catalogEntry'>[];
  remapping: Record<string, Id<'catalogEntry'>>;
  sheet: Sheet;
};
export type CharacterMovePlan<Sheet> = MovePlanBase<Sheet> &
  (
    | { complete: false; copies: []; updates: [] }
    | { complete: true; copies: CatalogCopy[]; updates: CatalogUpdate[] }
  );

/** Strip shared scope while retaining identity and source provenance. */
export async function characterCopyDefinition(
  source: Doc<'catalogEntry'>,
  characterId: Id<'character'>,
  fingerprint?: string,
): Promise<CatalogDefinition> {
  const {
    _id,
    _creationTime,
    campaignId: _campaignId,
    campaignPreference: _campaignPreference,
    ...definition
  } = source;
  return {
    ...definition,
    scope: 'character',
    characterId,
    copiedFrom: _id,
    copiedFromFingerprint:
      fingerprint ?? (await calculateDefinitionFingerprint(source)),
  };
}

/** Every string and object key in a value. */
function listValueTokens(value: unknown, tokens = new Set<string>()) {
  if (typeof value === 'string') tokens.add(value);
  else if (Array.isArray(value))
    for (const child of value) listValueTokens(child, tokens);
  else if (value && typeof value === 'object')
    for (const [key, child] of Object.entries(value)) {
      tokens.add(key);
      listValueTokens(child, tokens);
    }
  return tokens;
}

function requiredMoveDefinitions<Sheet>({
  characterId,
  sourceCampaignId,
  sheet,
  definitions,
  retainedDefinitionIds,
  heldDefinitionIds,
  byId,
}: {
  characterId: Id<'character'>;
  sourceCampaignId?: Id<'campaign'>;
  sheet: Sheet;
  definitions: readonly Doc<'catalogEntry'>[];
  retainedDefinitionIds: readonly Id<'catalogEntry'>[];
  heldDefinitionIds: ReadonlySet<string>;
  byId: ReadonlyMap<string, Doc<'catalogEntry'>>;
}) {
  const pending = listCatalogReferences(sheet);
  pending.push(
    ...retainedDefinitionIds.map((id) => ({
      id,
      kind: 'definition' as const,
    })),
    ...definitions
      .filter(
        (row) => row.scope === 'character' && row.characterId === characterId,
      )
      .map((row) => ({ id: row._id, kind: 'definition' as const })),
  );
  // Definition positions by the list keys they are members of, so each visited
  // row finds its keyed members without scanning every definition.
  const positionsByListKey = new Map<string, number[]>();
  definitions.forEach((row, index) => {
    for (const key of listCatalogKeyedListMemberships(row)) {
      const positions = positionsByListKey.get(key);
      if (positions) positions.push(index);
      else positionsByListKey.set(key, [index]);
    }
  });
  function addKeyedDependencies(value: unknown) {
    const found = new Set<number>();
    for (const key of listCatalogDependencyKeys(value))
      for (const index of positionsByListKey.get(key) ?? []) found.add(index);
    for (const index of [...found].sort((a, b) => a - b)) {
      const row = definitions[index];
      // #411: list membership alone is no existing use of held content.
      if (row && !heldDefinitionIds.has(row._id))
        pending.push({ id: row._id, kind: 'definition' });
    }
  }
  addKeyedDependencies(sheet);
  const visited = new Set<string>();
  const required: Doc<'catalogEntry'>[] = [];
  while (pending.length) {
    const reference = pending.pop();
    if (!reference) break;
    if (visited.has(reference.id)) {
      if (reference.kind === 'definition' && !byId.has(reference.id))
        throw new ConvexError(
          'Catalog dependency does not belong to this Character',
        );
      continue;
    }
    visited.add(reference.id);
    if (visited.size > 8192)
      throw new ConvexError('Character has too many catalog dependencies');
    const row = byId.get(reference.id);
    if (!row) {
      if (reference.kind === 'definition')
        throw new ConvexError(
          'Catalog dependency does not belong to this Character',
        );
      continue;
    }
    if (
      (row.scope === 'character' && row.characterId !== characterId) ||
      (row.scope === 'campaign' &&
        (!sourceCampaignId || row.campaignId !== sourceCampaignId))
    )
      throw new ConvexError(
        'Catalog dependency does not belong to this Character',
      );
    required.push(row);
    pending.push(...listCatalogReferences(row));
    addKeyedDependencies(row);
  }
  return required;
}

export async function planCharacterMove<Sheet>({
  characterId,
  sourceCampaignId,
  sheet,
  definitions,
  allocatedIds = {},
  allocateId,
  sourceFingerprints = {},
  retainedDefinitionIds = [],
  heldDefinitionIds = new Set(),
}: {
  characterId: Id<'character'>;
  sourceCampaignId?: Id<'campaign'>;
  sheet: Sheet;
  definitions: readonly Doc<'catalogEntry'>[];
  allocatedIds?: Readonly<Record<string, Id<'catalogEntry'>>>;
  allocateId?: (definition: Doc<'catalogEntry'>) => Promise<Id<'catalogEntry'>>;
  sourceFingerprints?: Readonly<Record<string, string>>;
  retainedDefinitionIds?: readonly Id<'catalogEntry'>[];
  /** Retired content a move carries only where the Character uses it. */
  heldDefinitionIds?: ReadonlySet<string>;
}): Promise<CharacterMovePlan<Sheet>> {
  const byId = new Map<string, Doc<'catalogEntry'>>(
    definitions.map((row) => [row._id, row]),
  );
  const required = requiredMoveDefinitions({
    characterId,
    sourceCampaignId,
    sheet,
    definitions,
    retainedDefinitionIds,
    heldDefinitionIds,
    byId,
  });
  required.sort((a, b) => a._id.localeCompare(b._id));
  const remapping: CharacterMovePlan<Sheet>['remapping'] = {};
  const ownDefinitions = required.filter((row) => row.scope === 'character');
  const fingerprints = new Map<string, string>();
  async function fingerprint(row: Doc<'catalogEntry'>) {
    let value = fingerprints.get(row._id);
    if (!value) {
      value = await calculateDefinitionFingerprint(row);
      fingerprints.set(row._id, value);
    }
    return value;
  }
  async function matchCarriedGraph(
    source: Doc<'catalogEntry'>,
    candidate: Doc<'catalogEntry'>,
    proposed: Map<string, Id<'catalogEntry'>>,
  ): Promise<boolean> {
    const previous = proposed.get(source._id) ?? remapping[source._id];
    if (previous) return previous === candidate._id;
    if (
      candidate.scope !== 'character' ||
      candidate.characterId !== characterId ||
      candidate.copiedFrom !== source._id ||
      candidate.racialStatisticsCopy !== source.racialStatisticsCopy
    )
      return false;
    let normalized = candidate;
    for (const own of ownDefinitions)
      if (own.copiedFrom && byId.has(own.copiedFrom)) {
        normalized = remapCatalogReferences(
          normalized,
          own._id,
          own.copiedFrom,
        );
        normalized = remapCatalogDependencyKeys(
          normalized,
          own._id,
          own.copiedFrom,
        );
      }
    if (
      (await calculateDefinitionFingerprint(normalized)) !==
      (await fingerprint(source))
    )
      return false;
    proposed.set(source._id, candidate._id);
    for (const reference of listCatalogReferences(candidate)) {
      const child = byId.get(reference.id);
      const origin = child?.copiedFrom ? byId.get(child.copiedFrom) : undefined;
      if (child?.scope === 'character' && origin?.scope === 'campaign')
        if (!(await matchCarriedGraph(origin, child, proposed))) return false;
    }
    return true;
  }
  const copySources: Doc<'catalogEntry'>[] = [];
  for (const source of required.filter((row) => row.scope === 'campaign')) {
    if (remapping[source._id]) continue;
    for (const candidate of ownDefinitions) {
      const proposed = new Map<string, Id<'catalogEntry'>>();
      if (await matchCarriedGraph(source, candidate, proposed)) {
        for (const [id, ownId] of proposed) remapping[id] = ownId;
        break;
      }
    }
    if (!remapping[source._id]) copySources.push(source);
  }
  for (const row of copySources) {
    const allocatedId = allocatedIds[row._id] ?? (await allocateId?.(row));
    if (allocatedId) remapping[row._id] = allocatedId;
  }
  const complete = copySources.every((row) => remapping[row._id]);
  // A remapping whose source ID appears nowhere in the value leaves it
  // unchanged, so only the others copy it. One token set serves every
  // remapping: the sources are shared definitions, and every target is this
  // Character's own definition, so no target is another remapping's source.
  // An unchanged value comes back as itself.
  function remap<Value>(value: Value): Value {
    let result = value;
    const tokens = listValueTokens(value);
    for (const [source, id] of Object.entries(remapping)) {
      if (!tokens.has(source)) continue;
      result = remapCatalogReferences(result, source, id);
      result = remapCatalogDependencyKeys(result, source, id);
    }
    return result;
  }
  // The plan never shares the caller's sheet or definitions.
  function remapCopy<Value>(value: Value): Value {
    const result = remap(value);
    return result === value ? structuredClone(value) : result;
  }
  const remappedSheet = complete ? remapCopy(sheet) : structuredClone(sheet);
  const copies: CatalogCopy[] = [];
  const updates: CatalogUpdate[] = [];
  if (complete)
    for (const row of copySources) {
      const id = remapping[row._id];
      if (!id) throw new ConvexError('Catalog copy mapping is incomplete');
      copies.push({
        sourceId: row._id,
        id,
        definition: remapCopy(
          await characterCopyDefinition(
            row,
            characterId,
            sourceFingerprints[row._id],
          ),
        ),
      });
    }
  if (complete)
    for (const row of required.filter((row) => row.scope === 'character')) {
      const { _id, _creationTime: _time, ...body } = row;
      const definition = remap(body);
      if (JSON.stringify(definition) !== JSON.stringify(body))
        updates.push({ id: _id, definition });
    }
  const base = {
    requiredDefinitionIds: required.map((row) => row._id),
    copySourceIds: copySources.map((row) => row._id),
    remapping,
    sheet: remappedSheet,
  };
  return complete
    ? { ...base, complete: true, copies, updates }
    : { ...base, complete: false, copies: [], updates: [] };
}
