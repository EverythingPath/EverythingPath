import {
  characterSheetClassFamily,
  normalizeCharacterSheetChoiceName,
} from './character-sheet-archetype-helpers';
export {
  characterSheetClassFamily,
  isUnchainedClass,
  normalizeCharacterSheetChoiceName,
} from './character-sheet-archetype-helpers';
import {
  resolveCharacterSheetArchetypes,
  type ResolvedCharacterSheetArchetypes,
} from './character-sheet-archetypes';
import { isTemporaryEffect } from './character-sheet';
import { racialReplacementDuplicateWarning } from './character-sheet-racial';
import { spellEffectDefaultCasterLevel } from './character-sheet-spell-effects';
import {
  createCatalogSheetEntryState,
  isSelectableCatalogSheetEntryKind,
} from './character-sheet-entries';
import type {
  CharacterSheetCatalogEntry,
  CharacterSheetInput,
  SheetEntry,
  SheetWarning,
} from './character-sheet';

export type GrantKey = { source: string; classLevel?: number; entry: string };
export type SelectionReference =
  | { kind: 'entry'; entryId: string }
  | { kind: 'grant'; grantKey: GrantKey };
export type DormantReason =
  | { kind: 'sourceMissing' }
  | { kind: 'replaced'; byEntryIds: string[] }
  | { kind: 'retired' };
export type ResolvedSheetEntry = {
  entry: SheetEntry;
  origin: 'grant' | 'selection';
  recorded: boolean;
  storedEntryId?: string;
  dormant: boolean;
  counting: boolean;
  reason?: DormantReason;
};

/**
 * #411: a Grant row whose target a Catalog Release retired. The resolver and
 * the server's record of existing Grants share this one test.
 */
export function isRetiredTargetGrant(
  row: Pick<ResolvedSheetEntry, 'origin' | 'entry'>,
  ruleIdentityOf: (catalogEntryId: string) => string | undefined,
  retiredIdentities: ReadonlySet<string>,
) {
  return (
    row.origin === 'grant' &&
    'catalogEntryId' in row.entry &&
    retiredIdentities.has(ruleIdentityOf(row.entry.catalogEntryId) ?? '')
  );
}

export function formatGrantKeyId(key: GrantKey) {
  return `grant:${key.source.length}:${key.source}:${key.classLevel ?? ''}:${key.entry.length}:${key.entry}`;
}

/** Warning subjects may append a field after the canonical Grant id. */
export function parseGrantKeyId(
  id: string,
  { requireComplete = false }: { requireComplete?: boolean } = {},
): GrantKey | null {
  const prefix = /^grant:(\d+):/.exec(id);
  if (!prefix) return null;
  const sourceLength = Number(prefix[1]);
  if (!Number.isSafeInteger(sourceLength)) return null;
  const sourceEnd = prefix[0].length + sourceLength;
  const suffix = /^:(\d*):(\d+):/.exec(id.slice(sourceEnd));
  if (!suffix) return null;
  const entryLength = Number(suffix[2]);
  if (!Number.isSafeInteger(entryLength)) return null;
  const entryStart = sourceEnd + suffix[0].length;
  const end = entryStart + entryLength;
  if (end > id.length || (end < id.length && id[end] !== ':')) return null;
  if (
    requireComplete &&
    (end !== id.length ||
      sourceLength <= 0 ||
      entryLength <= 0 ||
      (suffix[1] && !Number.isSafeInteger(Number(suffix[1]))))
  )
    return null;
  return {
    source: id.slice(prefix[0].length, sourceEnd),
    ...(suffix[1] ? { classLevel: Number(suffix[1]) } : {}),
    entry: id.slice(entryStart, end),
  };
}

export function hasGrantAncestor(id: string, ancestorId: string): boolean {
  let source = id;
  while (source !== ancestorId) {
    const key = parseGrantKeyId(source);
    if (!key) return false;
    source = key.source;
  }
  return true;
}

function buildGrantedEntry(
  definition: CharacterSheetCatalogEntry,
  grantKey: GrantKey,
  input: CharacterSheetInput,
): SheetEntry | undefined {
  const kind = definition.detail?.kind;
  if (
    !kind ||
    !isSelectableCatalogSheetEntryKind(kind) ||
    kind === 'race' ||
    kind === 'archetype'
  )
    return undefined;
  const casterLevel =
    definition.detail?.kind === 'spellEffect'
      ? spellEffectDefaultCasterLevel(
          definition.detail,
          input.catalogEntries,
          input.resources?.castingTables,
        )
      : undefined;
  return {
    _id: formatGrantKeyId(grantKey),
    active: true,
    catalogEntryId: definition._id,
    grantKey,
    ...createCatalogSheetEntryState({
      kind,
      casterLevel,
      itemMagic:
        definition.detail?.kind === 'item'
          ? definition.detail.magic
          : undefined,
    }),
  };
}

type GrantNode = {
  row: ResolvedSheetEntry;
  sourcePresent: boolean;
  parents: string[];
  replacedBy: string[];
  ancestry: Set<string>;
  projectionExcluded: boolean;
  /** A retired target's Grant the Character didn't have before (#411). */
  retired?: boolean;
};

type GrantGraph = {
  input: CharacterSheetInput;
  catalog: Map<string, CharacterSheetCatalogEntry>;
  nodes: Map<string, GrantNode>;
  classCounts: Map<string, number>;
  selectedClasses: Map<string, CharacterSheetCatalogEntry>;
};

function getCatalogRuleIdentity(graph: GrantGraph, id: string) {
  return graph.catalog.get(id)?.ruleIdentity ?? id;
}

function getClassFamily(
  graph: GrantGraph,
  definition: CharacterSheetCatalogEntry,
) {
  return characterSheetClassFamily(definition, graph.input.catalogEntries);
}

function getFeatureName(definition: CharacterSheetCatalogEntry | undefined) {
  return definition?.name
    ? normalizeCharacterSheetChoiceName(definition.name)
    : undefined;
}

function buildGrantGraph(input: CharacterSheetInput): GrantGraph {
  const catalog = new Map(
    input.catalogEntries.map((entry) => [entry._id, entry]),
  );
  const nodes = new Map<string, GrantNode>();
  for (const entry of input.entries) {
    const grantKey = 'grantKey' in entry ? entry.grantKey : undefined;
    const id = grantKey ? formatGrantKeyId(grantKey) : entry._id;
    nodes.set(id, {
      row: {
        entry: { ...entry, _id: id },
        origin: grantKey ? 'grant' : 'selection',
        recorded: true,
        storedEntryId: entry._id,
        dormant: false,
        counting: false,
      },
      sourcePresent: !grantKey,
      parents: [],
      replacedBy: [],
      ancestry: new Set(
        'catalogEntryId' in entry
          ? [
              catalog.get(entry.catalogEntryId)?.ruleIdentity ??
                entry.catalogEntryId,
            ]
          : [],
      ),
      projectionExcluded: false,
    });
  }
  return {
    input,
    catalog,
    nodes,
    classCounts: new Map(),
    selectedClasses: new Map(),
  };
}

function getClassFeatureRuleIdentity(
  graph: GrantGraph,
  source: CharacterSheetCatalogEntry,
  definition: CharacterSheetCatalogEntry,
  classLevel: number,
) {
  const { catalog } = graph;
  if (
    source.detail?.kind !== 'class' ||
    !('counterpartOf' in source.detail) ||
    !source.detail.counterpartOf
  )
    return definition.ruleIdentity;
  const original = catalog.get(source.detail.counterpartOf);
  const features =
    original?.detail?.kind === 'class' && 'featuresByLevel' in original.detail
      ? original.detail.featuresByLevel
      : [];
  const match = features?.find(
    (feature) =>
      feature.classLevel === classLevel &&
      getFeatureName(catalog.get(feature.catalogEntryId)) !== undefined &&
      getFeatureName(catalog.get(feature.catalogEntryId)) ===
        getFeatureName(definition),
  );
  return match
    ? getCatalogRuleIdentity(graph, match.catalogEntryId)
    : definition.ruleIdentity;
}

function addGrantNode(
  graph: GrantGraph,
  {
    source,
    catalogEntryId,
    classLevel,
    parentId,
    canonicalEntry,
  }: {
    source: CharacterSheetCatalogEntry;
    catalogEntryId: string;
    classLevel?: number;
    parentId?: string;
    canonicalEntry?: string;
  },
) {
  const { catalog, nodes } = graph;
  const definition = catalog.get(catalogEntryId);
  if (!definition) return;
  const parentNode = parentId ? nodes.get(parentId) : undefined;
  if (parentNode?.ancestry.has(definition.ruleIdentity)) return;
  const key = {
    source:
      source.detail?.kind === 'class'
        ? getClassFamily(graph, source)
        : source.ruleIdentity,
    ...(classLevel === undefined ? {} : { classLevel }),
    entry: canonicalEntry ?? definition.ruleIdentity,
  };
  const grantId = formatGrantKeyId(key);
  let node = nodes.get(grantId);
  if (!node) {
    const entry = buildGrantedEntry(definition, key, graph.input);
    if (!entry) return;
    node = {
      row: {
        entry,
        origin: 'grant',
        recorded: false,
        dormant: false,
        counting: false,
      },
      sourcePresent: false,
      parents: [],
      replacedBy: [],
      ancestry: new Set([
        ...(parentNode?.ancestry ?? []),
        definition.ruleIdentity,
      ]),
      projectionExcluded: false,
    };
    nodes.set(grantId, node);
  }
  if (parentNode)
    node.ancestry = new Set([...parentNode.ancestry, definition.ruleIdentity]);
  if (
    node.row.recorded &&
    'catalogEntryId' in node.row.entry &&
    !('catalogOverride' in node.row.entry && node.row.entry.catalogOverride)
  )
    node.row.entry = { ...node.row.entry, catalogEntryId: definition._id };
  if (parentId) {
    if (!node.parents.includes(parentId)) node.parents.push(parentId);
  } else node.sourcePresent = true;
  return node;
}

function addClassGrants(graph: GrantGraph) {
  const { input, catalog, classCounts, selectedClasses } = graph;
  for (const row of input.entries
    .filter((entry) => entry.kind === 'classLevel')
    .sort((a, b) => a.state.position - b.state.position)) {
    const definition = catalog.get(row.state.classEntryId ?? '');
    if (definition?.detail?.kind !== 'class') continue;
    const count = (classCounts.get(getClassFamily(graph, definition)) ?? 0) + 1;
    classCounts.set(getClassFamily(graph, definition), count);
    selectedClasses.set(definition._id, definition);
    const features =
      'featuresByLevel' in definition.detail
        ? (definition.detail.featuresByLevel ?? [])
        : [];
    for (const feature of features) {
      if (feature.classLevel === count) {
        const featureDefinition = catalog.get(feature.catalogEntryId);
        if (featureDefinition)
          addGrantNode(graph, {
            source: definition,
            catalogEntryId: feature.catalogEntryId,
            classLevel: count,
            canonicalEntry: getClassFeatureRuleIdentity(
              graph,
              definition,
              featureDefinition,
              count,
            ),
          });
      }
    }
  }
}

function addRaceGrants(graph: GrantGraph) {
  const { catalog, nodes } = graph;
  for (const node of nodes.values()) {
    const entry = node.row.entry;
    if (entry.kind !== 'race') continue;
    const definition = catalog.get(entry.catalogEntryId);
    if (definition?.detail?.kind !== 'race') continue;
    for (const id of definition.detail.racialTraits)
      addGrantNode(graph, {
        source: definition,
        catalogEntryId: id,
        parentId: entry._id,
      });
  }
}

function applyArchetypeReplacements({
  graph,
  archetypes,
}: {
  graph: GrantGraph;
  archetypes: ResolvedCharacterSheetArchetypes;
}) {
  for (const node of graph.nodes.values())
    if (node.row.origin === 'selection' && node.row.entry.kind === 'archetype')
      node.sourcePresent = false;
  const processedSelections = new Set<string>();
  for (const classEffects of archetypes.classes) {
    const count = graph.classCounts.get(classEffects.classIdentity) ?? 0;
    for (const archetype of classEffects.archetypes) {
      if (!archetype.applicable) continue;
      const node = graph.nodes.get(archetype.entryId);
      const definition = graph.catalog.get(archetype.catalogEntryId);
      if (!node || !definition) continue;
      node.sourcePresent = true;
      const selectionKey = JSON.stringify([
        classEffects.classIdentity,
        archetype.entryId,
      ]);
      if (!processedSelections.has(selectionKey))
        for (const added of archetype.additions) {
          if (added.classLevel <= count)
            addGrantNode(graph, {
              source: definition,
              catalogEntryId: added.catalogEntryId,
              classLevel: added.classLevel,
              parentId: archetype.entryId,
            });
        }
      processedSelections.add(selectionKey);
      for (const replaced of graph.nodes.values()) {
        const entry = replaced.row.entry;
        const key = 'grantKey' in entry ? entry.grantKey : undefined;
        if (
          key?.source !== classEffects.classIdentity ||
          !('catalogEntryId' in entry)
        )
          continue;
        if (
          archetype.replacements.some(
            (replacement) =>
              replacement.classLevel === key.classLevel &&
              getCatalogRuleIdentity(graph, replacement.catalogEntryId) ===
                getCatalogRuleIdentity(graph, entry.catalogEntryId),
          )
        )
          if (!replaced.replacedBy.includes(archetype.entryId))
            replaced.replacedBy.push(archetype.entryId);
      }
    }
  }
}

function getGrantAncestry(
  graph: GrantGraph,
  id: string,
  visited = new Set<string>(),
): Set<string> {
  const node = graph.nodes.get(id);
  if (!node || visited.has(id)) return new Set();
  visited.add(id);
  const parent =
    'grantKey' in node.row.entry ? node.row.entry.grantKey?.source : undefined;
  return new Set([
    ...node.ancestry,
    ...(parent ? getGrantAncestry(graph, parent, visited) : []),
  ]);
}

function addNestedGrants(graph: GrantGraph) {
  const { catalog, nodes } = graph;
  // Map iteration visits newly added nodes, deriving the full reachable Grant graph.
  for (const node of nodes.values()) {
    const entry = node.row.entry;
    if (!('catalogEntryId' in entry)) continue;
    const definition = catalog.get(entry.catalogEntryId);
    if (!definition) continue;
    node.ancestry = getGrantAncestry(graph, entry._id);
    for (const child of definition.grants ?? [])
      addGrantNode(graph, {
        source: { ...definition, ruleIdentity: entry._id },
        catalogEntryId: child.catalogEntryId,
        classLevel:
          'grantKey' in entry ? entry.grantKey?.classLevel : undefined,
        parentId: entry._id,
      });
  }
}

function collectEquivalenceParents(
  graph: GrantGraph,
  candidateId: string,
  eligibleIdentities: readonly string[],
) {
  return [...graph.nodes.values()].flatMap(({ row }): string[] => {
    const entry = row.entry;
    if (entry._id === candidateId) return [];
    const catalogId =
      'catalogEntryId' in entry
        ? entry.catalogEntryId
        : entry.kind === 'classLevel'
          ? entry.state.classEntryId
          : undefined;
    const equivalent = catalogId
      ? graph.catalog.get(catalogId)?.countsAsRaces
      : undefined;
    const choice = 'choice' in entry.state ? entry.state.choice : undefined;
    const identities =
      equivalent && 'oneOf' in equivalent
        ? choice && equivalent.oneOf.includes(choice)
          ? [choice]
          : []
        : (equivalent ?? []);
    return identities.some((identity) => eligibleIdentities.includes(identity))
      ? [entry._id]
      : [];
  });
}

function collectAllowedRaceParents(
  graph: GrantGraph,
  eligibleIdentities: readonly string[],
) {
  return [...graph.nodes.values()].flatMap(({ row }): string[] => {
    const entry = row.entry;
    if (entry.kind !== 'race') return [];
    const race = graph.catalog.get(entry.catalogEntryId);
    return eligibleIdentities.includes(
      race?.ruleIdentity ?? entry.catalogEntryId,
    ) ||
      (race?.detail?.kind === 'race' &&
        race.detail.allowedAlternateRaces?.some((identity) =>
          eligibleIdentities.includes(identity),
        ))
      ? [entry._id]
      : [];
  });
}

function matchesReplacement(
  graph: GrantGraph,
  replaced: GrantNode,
  replacementIds: readonly string[],
) {
  const entry = replaced.row.entry;
  if (
    replaced.row.origin !== 'grant' ||
    !('catalogEntryId' in entry) ||
    !('grantKey' in entry) ||
    !entry.grantKey
  )
    return false;
  const source = entry.grantKey.source;
  const raceSource = [...graph.nodes.values()].some(
    ({ row }) =>
      row.entry.kind === 'race' &&
      getCatalogRuleIdentity(graph, row.entry.catalogEntryId) === source,
  );
  // The importer/curation resolves replacement names. Runtime uses identities,
  // including a Catalog Copy's preserved identity, without guessing across races.
  return (
    raceSource &&
    replacementIds.some(
      (id) =>
        getCatalogRuleIdentity(graph, id) ===
        getCatalogRuleIdentity(graph, entry.catalogEntryId),
    )
  );
}

function applyRacialTraitReplacements(graph: GrantGraph) {
  const { catalog, nodes } = graph;
  for (const node of nodes.values()) {
    const entry = node.row.entry;
    if (node.row.origin !== 'selection' || entry.kind !== 'racialTrait')
      continue;
    const detail = catalog.get(entry.catalogEntryId)?.detail;
    if (detail?.kind !== 'racialTrait') continue;
    node.sourcePresent = false;
    const eligibleIdentities = detail.raceEntryIds.map((id) =>
      getCatalogRuleIdentity(graph, id),
    );
    node.parents = [
      ...collectAllowedRaceParents(graph, eligibleIdentities),
      ...collectEquivalenceParents(graph, entry._id, eligibleIdentities),
    ];
    for (const replaced of nodes.values()) {
      if (
        matchesReplacement(
          graph,
          replaced,
          entry.state.replaces ?? detail.replaces,
        )
      )
        replaced.replacedBy.push(entry._id);
    }
  }
  function dependsOn(
    sourceId: string,
    candidateId: string,
    visited = new Set<string>(),
  ): boolean {
    if (sourceId === candidateId) return true;
    if (visited.has(sourceId)) return false;
    visited.add(sourceId);
    const source = nodes.get(sourceId);
    if (
      source?.row.entry.active &&
      'kept' in source.row.entry &&
      source.row.entry.kept
    )
      return false;
    return [...(source?.parents ?? []), ...(source?.replacedBy ?? [])].some(
      (id) => dependsOn(id, candidateId, visited),
    );
  }
  // An alternate cannot grant, preserve, or replace the equivalence it needs
  // to make itself eligible. Removing those edges keeps evaluation acyclic.
  const eligibleParents = new Map(
    [...nodes.values()]
      .filter(
        (node) =>
          node.row.origin === 'selection' &&
          node.row.entry.kind === 'racialTrait',
      )
      .map((node) => [
        node.row.entry._id,
        node.parents.filter((id) => !dependsOn(id, node.row.entry._id)),
      ]),
  );
  for (const [id, parents] of eligibleParents) {
    const node = nodes.get(id);
    if (node) node.parents = parents;
  }
}

function evaluateGrantGraph(
  graph: GrantGraph,
  options: { permanentOnly?: boolean },
) {
  const { catalog, nodes, classCounts, selectedClasses } = graph;
  const referenceId = (reference: SelectionReference) =>
    reference.kind === 'entry'
      ? reference.entryId
      : formatGrantKeyId(reference.grantKey);
  const evaluated = new Set<string>();
  const visiting = new Set<string>();
  const retiredIdentities = new Set(graph.input.retired?.ruleIdentities);
  const retainedGrantIds = new Set(graph.input.retired?.retainedGrantIds);
  const isNewRetiredGrant = ({ row }: GrantNode) =>
    isRetiredTargetGrant(
      row,
      (id) => catalog.get(id)?.ruleIdentity,
      retiredIdentities,
    ) && !retainedGrantIds.has(row.entry._id);
  function dormantReason(
    available: boolean,
    replacements: string[],
    isRetired: boolean,
  ): DormantReason | undefined {
    if (replacements.length)
      return { kind: 'replaced', byEntryIds: replacements };
    if (!available) return { kind: 'sourceMissing' };
    if (isRetired) return { kind: 'retired' };
    return undefined;
  }
  function countsNow(id: string): boolean {
    const node = nodes.get(id);
    if (!node) return false;
    if (evaluated.has(id)) return node.row.counting;
    if (visiting.has(id)) return false;
    visiting.add(id);
    const entry = node.row.entry;
    const parentAvailability = node.parents.map(countsNow);
    const sourcePresent =
      node.sourcePresent || parentAvailability.some(Boolean);
    node.projectionExcluded =
      options.permanentOnly === true &&
      (isTemporaryEffect(
        entry,
        'catalogEntryId' in entry
          ? catalog.get(entry.catalogEntryId)?.detail
          : undefined,
      ) ||
        (node.parents.length > 0 &&
          node.parents.every(
            (parent) => nodes.get(parent)?.projectionExcluded,
          )));
    const dependency =
      ('selectionSource' in entry ? entry.selectionSource : undefined) ??
      (entry.kind === 'feat' &&
      entry.state.slot &&
      entry.state.slot !== 'general'
        ? {
            kind: 'slot' as const,
            grantedBy: entry.state.slot.grantedBy,
            slotIndex: entry.state.slot.slotIndex,
          }
        : undefined);
    const dependencyPresent = (() => {
      if (dependency?.kind === 'classPrompt') {
        return (
          (classCounts.get(dependency.source) ?? 0) >= dependency.classLevel &&
          [...selectedClasses.values()].some((definition) => {
            const detail = definition.detail;
            return (
              getClassFamily(graph, definition) === dependency.source &&
              detail?.kind === 'class' &&
              'picksByLevel' in detail &&
              Boolean(
                detail.picksByLevel?.some(
                  (prompt) =>
                    prompt.classLevel === dependency.classLevel &&
                    normalizeCharacterSheetChoiceName(prompt.list) ===
                      normalizeCharacterSheetChoiceName(dependency.list) &&
                    prompt.count > 0,
                ),
              )
            );
          })
        );
      }
      if (dependency) {
        const parentId = referenceId(
          dependency.kind === 'slot' ? dependency.grantedBy : dependency.source,
        );
        const parent = nodes.get(parentId)?.row.entry;
        const parentCatalog =
          parent && 'catalogEntryId' in parent
            ? catalog.get(parent.catalogEntryId)
            : parent?.kind === 'classLevel' && parent.state.classEntryId
              ? catalog.get(parent.state.classEntryId)
              : undefined;
        const hasEntitlement =
          dependency.kind === 'slot'
            ? parentCatalog?.grantsSlots?.some(
                (slot, index) =>
                  slot.kind === entry.kind &&
                  slot.count > 0 &&
                  index === (dependency.slotIndex ?? 0),
              )
            : parentCatalog?.detail &&
              'picksByLevel' in parentCatalog.detail &&
              parentCatalog.detail.picksByLevel?.some(
                (prompt) =>
                  normalizeCharacterSheetChoiceName(prompt.list) ===
                    normalizeCharacterSheetChoiceName(dependency.list) &&
                  prompt.count > 0 &&
                  (dependency.classLevel === undefined ||
                    prompt.classLevel === dependency.classLevel),
              );
        const parentCounting = countsNow(parentId);
        node.projectionExcluded ||=
          nodes.get(parentId)?.projectionExcluded === true;
        return parentCounting && Boolean(hasEntitlement);
      }
      return true;
    })();
    const available = sourcePresent && dependencyPresent;
    const replacements = available ? node.replacedBy.filter(countsNow) : [];
    // Keep cannot bring in a retired target the Character never had.
    node.retired = isNewRetiredGrant(node);
    node.row.dormant = !available || replacements.length > 0 || node.retired;
    node.row.reason = dormantReason(available, replacements, node.retired);
    node.row.counting =
      entry.active &&
      !node.projectionExcluded &&
      (!node.row.dormant ||
        (!node.retired && 'kept' in entry && entry.kept === true));
    visiting.delete(id);
    evaluated.add(id);
    return node.row.counting;
  }
  for (const id of nodes.keys()) countsNow(id);
}

function buildGrantWarnings(graph: GrantGraph) {
  const { catalog, nodes } = graph;
  return [...nodes.values()]
    .filter((node) => !node.retired)
    .map(({ row }) => row)
    .filter((row) => row.dormant && 'kept' in row.entry && row.entry.kept)
    .map((row) => {
      const name =
        'catalogEntryId' in row.entry
          ? catalog.get(row.entry.catalogEntryId)?.name
          : undefined;
      const replacers =
        row.reason?.kind === 'replaced'
          ? row.reason.byEntryIds.flatMap((id) => {
              const entry = nodes.get(id)?.row.entry;
              const name =
                entry && 'catalogEntryId' in entry
                  ? catalog.get(entry.catalogEntryId)?.name
                  : undefined;
              return name ? [name] : [];
            })
          : [];
      return {
        kind: 'rules',
        check: 'keptDormant',
        target: { kind: 'entry', entryId: row.entry._id },
        subject: row.entry._id,
        fingerprint: JSON.stringify([
          ('grantKey' in row.entry ? row.entry.grantKey : undefined) ??
            row.entry._id,
          row.reason,
        ]),
        message: `${name ?? 'Entry'}: kept, although ${replacers.length ? `${replacers.join(' and ')} ${replacers.length === 1 ? 'replaces' : 'replace'} it` : 'its source is unavailable'}.`,
      } satisfies SheetWarning;
    });
}

function buildUpgradeWarnings(graph: GrantGraph): SheetWarning[] {
  const counting = [...graph.nodes.values()].filter(
    (node) => node.row.counting,
  );
  const groups = new Map<string, GrantNode[]>();
  for (const node of counting) {
    const entry = node.row.entry;
    if (!('catalogEntryId' in entry) || node.row.origin !== 'grant') continue;
    const definition = graph.catalog.get(entry.catalogEntryId);
    if (
      definition?.detail?.kind !== 'classFeature' ||
      !definition.detail.duplicateUpgrade
    )
      continue;
    const group = groups.get(definition.ruleIdentity) ?? [];
    group.push(node);
    groups.set(definition.ruleIdentity, group);
  }
  return [...groups.values()].flatMap((group) => {
    const first = [...group].sort((left, right) =>
      left.row.entry._id.localeCompare(right.row.entry._id),
    )[0];
    if (!first || !('catalogEntryId' in first.row.entry)) return [];
    const definition = graph.catalog.get(first.row.entry.catalogEntryId);
    if (
      definition?.detail?.kind !== 'classFeature' ||
      !definition.detail.duplicateUpgrade
    )
      return [];
    const upgrade = graph.catalog.get(definition.detail.duplicateUpgrade);
    const sources = [
      ...new Set(
        group.flatMap((node) =>
          'grantKey' in node.row.entry && node.row.entry.grantKey
            ? [node.row.entry.grantKey.source]
            : [],
        ),
      ),
    ].sort();
    if (
      sources.length < 2 ||
      !upgrade ||
      counting.some(
        (node) =>
          'catalogEntryId' in node.row.entry &&
          getCatalogRuleIdentity(graph, node.row.entry.catalogEntryId) ===
            upgrade.ruleIdentity,
      )
    )
      return [];
    return [
      {
        kind: 'rules',
        check: 'archetypeFeatureUpgrade',
        target: { kind: 'entry', entryId: first.row.entry._id },
        subject: first.row.entry._id,
        fingerprint: JSON.stringify([
          definition.ruleIdentity,
          upgrade.ruleIdentity,
          sources,
        ]),
        message: `${definition.name ?? 'Class feature'} is granted by more than one source. Add ${upgrade.name ?? 'the upgraded feature'} if appropriate; the original features remain recorded.`,
      } satisfies SheetWarning,
    ];
  });
}

/**
 * #411: a retired class the Character already has keeps its levels and can
 * gain more; one advisory per class, on its first Class Level.
 */
function buildRetiredClassWarnings(input: CharacterSheetInput): SheetWarning[] {
  const retired = new Set(input.retired?.ruleIdentities);
  if (!retired.size) return [];
  const first = new Map<string, { entryId: string; name: string }>();
  for (const row of [...input.entries].sort(
    (left, right) =>
      (left.kind === 'classLevel' ? left.state.position : 0) -
      (right.kind === 'classLevel' ? right.state.position : 0),
  )) {
    if (row.kind !== 'classLevel' || !row.active) continue;
    const definition = input.catalogEntries.find(
      (entry) => entry._id === row.state.classEntryId,
    );
    if (
      !definition ||
      !retired.has(definition.ruleIdentity) ||
      first.has(definition.ruleIdentity)
    )
      continue;
    first.set(definition.ruleIdentity, {
      entryId: row._id,
      name: definition.name ?? 'This class',
    });
  }
  return [...first].map(([identity, { entryId, name }]) => ({
    kind: 'rules',
    check: 'retiredClassInUse',
    subject: `class:${identity}`,
    target: { kind: 'classLevel', entryId, field: 'class' },
    message: `${name} is no longer offered for new Characters. This Character keeps its levels and can add more.`,
    fingerprint: JSON.stringify([identity, 'retired']),
  }));
}

export function resolveCharacterSheetGrants(
  input: CharacterSheetInput,
  options: {
    permanentOnly?: boolean;
    archetypes?: ResolvedCharacterSheetArchetypes;
  } = {},
) {
  const graph = buildGrantGraph(input);
  addClassGrants(graph);
  addRaceGrants(graph);
  applyArchetypeReplacements({
    graph,
    archetypes: options.archetypes ?? resolveCharacterSheetArchetypes(input),
  });
  addNestedGrants(graph);
  applyRacialTraitReplacements(graph);
  evaluateGrantGraph(graph, options);
  const allEntries = [...graph.nodes.values()].map(({ row }) => row);
  const entries = allEntries.filter(
    (row) => row.recorded || !row.dormant || row.reason?.kind === 'replaced',
  );
  return {
    entries,
    allEntries,
    countingEntries: entries
      .filter((row) => row.counting)
      .map(({ entry }) => entry),
    warnings: [
      ...buildGrantWarnings(graph),
      ...buildUpgradeWarnings(graph),
      ...buildRetiredClassWarnings(input),
    ],
    warningsForAcceptance: [...graph.nodes.values()].flatMap(
      (node): SheetWarning[] => {
        const entry = node.row.entry;
        if (
          entry.kind !== 'racialTrait' ||
          !node.row.dormant ||
          node.row.reason?.kind !== 'sourceMissing'
        )
          return [];
        const definition = graph.catalog.get(entry.catalogEntryId);
        const replacements = node.replacedBy.filter(
          (id) => graph.nodes.get(id)?.row.entry.active,
        );
        return definition && replacements.length > 1
          ? [racialReplacementDuplicateWarning(entry, definition, replacements)]
          : [];
      },
    ),
  };
}
