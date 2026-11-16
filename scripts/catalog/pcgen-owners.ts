import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CurationData } from './curation.ts';
import ledgerData from './everythingpath-identities.json' with { type: 'json' };
import {
  locatorKeyOf,
  parseIdentityLedger,
} from './everythingpath-identities.ts';
import { pcgenPin } from './inventory.ts';
import type { PreviewEntry } from './map.ts';
import { pcgenBooks } from './pcgen-books.ts';
import {
  archetypeClassContext,
  mapArchetype,
  mapArchetypeFeature,
  stackingConflicts,
  type ArchetypeClassContext,
  type ArchetypeMapping,
} from './pcgen/archetypes.ts';
import {
  buildEffectiveView,
  type PcgenEffectiveView,
} from './pcgen/effective.ts';
import { assignPcgenIdentities } from './pcgen/identities.ts';
import { inventoryPcgen, type PcgenInventory } from './pcgen/inventory.ts';
import {
  readPcgenTree,
  type PcgenRecord,
  type PcgenTree,
} from './pcgen/lst.ts';
import { mapPrestigeClass } from './pcgen/prestige.ts';
import {
  prestigeFeatureRows,
  reviewedPrestigeSchedule,
} from './pcgen/prestige-schedules.ts';
import type { PrestigeReferences } from './pcgen/requirements.ts';
import type { ScheduleClassName } from './pcgen/schedule-model.ts';
import { allIncrementKeys, reviewedSchedule } from './pcgen/schedules.ts';
import {
  applyStructureCuration,
  type OwnedFeature,
  type StructureReviewItem,
  type StructureSubject,
} from './structure-curation.ts';

/**
 * #716 E1 (design archetype-emission §E): the importer's PCGen owners. Only
 * the owners an explicit selector names are emitted, never the whole corpus
 * (its 1,123 archetypes would pass the inventory budget, design §F): an
 * archetype mapped onto its base class's reviewed schedule (`mapArchetype`),
 * with the features it grants directly (`mapArchetypeFeature`); a prestige
 * class (#716 D1) mapped by `mapPrestigeClass`, with every feature it owns
 * and its features by level from its reviewed schedule
 * (`prestige-schedules.ts`).
 *
 * - Keys come from the identity ledger only: an owner or feature without a
 *   frozen identity is refused, and one the ledger holds is held.
 * - `sources[].book` is the book's crosswalk code (`pcgen-books.json`), the
 *   code the #227 declared-book path reads; a book outside it is refused.
 * - Each emitted record has an admitted comparison record under its upstream
 *   key, as a Foundry record has, so admission accounts for it.
 * - The structure gate (`applyStructureCuration`) applies checked structure
 *   records; an entry with an unsettled item or owned feature is held as hand
 *   review, never guessed.
 */

/**
 * A chosen owner by its file and KEY: an archetype record, on its base
 * class's reviewed schedule, or a prestige class block, on its own reviewed
 * schedule (`reviewedPrestigeSchedule`).
 */
export type PcgenOwnerSelector =
  | {
      kind: 'archetype';
      className: ScheduleClassName;
      file: string;
      key: string;
    }
  | { kind: 'prestige'; file: string; key: string };
type NonEmpty<T> = readonly [T, ...T[]];

/**
 * The party's archetypes (design §A; party-scope A, "Structural findings")
 * and prestige class (#716 D1: Dragon Disciple, research party-code §1). A
 * second prestige class needs a reviewed schedule, its frozen identities and
 * a selector here.
 */
export const pcgenOwnerSelection: NonEmpty<PcgenOwnerSelector> = [
  {
    kind: 'archetype',
    className: 'Wizard',
    file: 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst',
    key: 'Wizard Archetype ~ Exploiter Wizard',
  },
  {
    kind: 'archetype',
    className: 'Cleric',
    file: 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst',
    key: 'Cleric Archetype ~ Ecclesitheurge',
  },
  {
    kind: 'archetype',
    className: 'Magus',
    file: 'roleplaying_game/ultimate_magic/um_abilities_class.lst',
    key: 'Magus Archetype ~ Bladebound',
  },
  {
    kind: 'archetype',
    className: 'Barbarian',
    file: 'player_companion/animal_archive/anar_abilities_class.lst',
    key: 'Barbarian Archetype ~ Mad Dog',
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'player_companion/legacy_of_dragons/lod_abilities_class.lst',
    key: 'Monk Archetype ~ Scaled Fist',
  },
  {
    kind: 'prestige',
    file: 'roleplaying_game/core_rulebook/cr_classes.lst',
    key: 'Dragon Disciple',
  },
];

/**
 * No prestige requirement references a catalog key yet: each feat, class
 * feature, race, spell or class clause stays a readable `unchecked` clause,
 * held as an `uncheckedRequirement` item until a structure record binds the
 * class's `prerequisites` (#716 D1).
 */
const unresolvedReferences: PrestigeReferences = {
  feat: () => undefined,
  classFeature: () => undefined,
  race: () => undefined,
  spell: () => undefined,
  className: () => undefined,
};

/** What one owner emits: its subject, its features, its items and its owned features. */
type OwnerEmission = {
  subject: StructureSubject;
  features: StructureSubject[];
  items: StructureReviewItem[];
  ownedFeatures: OwnedFeature[];
};

/** The PCGen data folder's tree and its fingerprint, as the Foundry inputs have one. */
export async function readPcgenOwnerInputs(path: string) {
  const hash = createHash('sha256');
  const files = (await readdir(path, { recursive: true }))
    .filter((file) => /\.(?:pcc|lst)$/.test(file))
    .map((file) => file.replaceAll('\\', '/'))
    .sort();
  for (const file of files)
    hash
      .update(file)
      .update('\0')
      .update(await readFile(join(path, file), 'utf8'))
      .update('\0');
  return {
    tree: await readPcgenTree(path),
    fingerprint: {
      repo: 'pcgen' as const,
      tag: pcgenPin.commit,
      version: pcgenPin.directory,
      contentSha256: hash.digest('hex'),
    },
  };
}

/** The crosswalk code of a PCGen book title. */
function bookCodeOf(book: string) {
  const row = pcgenBooks.books.find((candidate) => candidate.book === book);
  if (!row) throw new Error(`PCGen book ${book} is not in pcgen-books.json.`);
  return row.code.id;
}

/** A mapped entry's sources with each book as its crosswalk code. */
function declareBookCodes(entry: PreviewEntry) {
  entry.sources = entry.sources.map((source) => ({
    ...source,
    book: bookCodeOf(source.book),
  }));
}

/** Each ledger identity's key, by folded locator, and why a held one is held. */
function frozenIdentities(tree: PcgenTree) {
  const reservedKeys = allIncrementKeys();
  const ledger = parseIdentityLedger(ledgerData, { reservedKeys });
  const frozen = new Set(
    ledger.identities.flatMap(({ sources }) => sources.map(locatorKeyOf)),
  );
  const view = buildEffectiveView(tree);
  const inventory = inventoryPcgen(tree);
  const assigned = assignPcgenIdentities({
    inventory,
    view,
    ledger,
    // Book dates only order proposals, and an unfrozen key is refused.
    books: new Map(),
    reservedKeys,
  });
  const lookup = (scope: 'owners' | 'features', record: PcgenRecord) => {
    const locator = locatorKeyOf({ source: 'pcgen', locator: record.locator });
    const key = assigned[scope].keys.get(locator);
    if (!key || !frozen.has(locator))
      throw new Error(
        `${record.locator.key} (${record.locator.file}) has no frozen identity in everythingpath-identities.json.`,
      );
    return { key, hold: assigned[scope].holds.get(locator) };
  };
  return { ledger, view, inventory, lookup };
}

/** Why the structure gate holds an entry, by key. */
function structureHoldReasons(
  report: ReturnType<typeof applyStructureCuration>,
) {
  const reasons = new Map<string, string[]>();
  const add = (key: string, reason: string) =>
    reasons.set(key, [...(reasons.get(key) ?? []), reason]);
  for (const item of report.handReview)
    add(item.externalKey, `${item.kind} ${item.id}`);
  for (const feature of report.unreviewedFeatures)
    add(feature.externalKey, `owned feature ${feature.locator}`);
  for (const problem of report.invalid)
    add(problem.externalKey, `invalid ${problem.field}`);
  for (const conflict of report.conflicts)
    add(conflict.externalKey, `competing ${conflict.field}`);
  return reasons;
}

/** An emitted owner as a list; refuses a selector the tree has no record for. */
function found<T>(selector: PcgenOwnerSelector, owner: T | null | undefined) {
  if (owner === null)
    throw new Error(
      `Selected owner ${selector.key} (${selector.file}) is not in the PCGen tree.`,
    );
  return owner === undefined ? [] : [owner];
}

/** The archetype mapping context of each class, built once per class. */
function archetypeContexts(tree: PcgenTree, view: PcgenEffectiveView) {
  const contexts = new Map<ScheduleClassName, ArchetypeClassContext>();
  return (className: ScheduleClassName) => {
    const schedule = reviewedSchedule(className);
    if (!schedule) throw new Error(`No reviewed ${className} schedule.`);
    const context =
      contexts.get(className) ??
      archetypeClassContext({ tree, view, schedule });
    contexts.set(className, context);
    return context;
  };
}

/**
 * A selected archetype on its base class's reviewed schedule. Null when the
 * tree has no such record; undefined when the release scope doesn't name it.
 */
function emitArchetype({
  tree,
  contextOf,
  selector,
  keyOf,
  inScope,
}: {
  tree: PcgenTree;
  contextOf: (className: ScheduleClassName) => ArchetypeClassContext;
  selector: Extract<PcgenOwnerSelector, { kind: 'archetype' }>;
  keyOf: (scope: 'owners' | 'features', record: PcgenRecord) => string;
  inScope: ReadonlySet<string> | undefined;
}): ArchetypeMapping | null | undefined {
  const record = tree.archetypes.find(
    ({ locator }) =>
      locator.file === selector.file && locator.key === selector.key,
  );
  if (!record) return null;
  const externalKey = keyOf('owners', record);
  if (inScope && !inScope.has(externalKey)) return undefined;
  return mapArchetype({
    context: contextOf(selector.className),
    record,
    externalKey,
    featureKeyOf: (feature) => keyOf('features', feature),
  });
}

/** Each emitted row's review holds: its identity's, then its structure gate's. */
function reviewHoldsOf({
  subjects,
  identityHolds,
  reasons,
}: {
  subjects: readonly StructureSubject[];
  identityHolds: ReadonlyMap<string, string>;
  reasons: ReadonlyMap<string, string[]>;
}) {
  return subjects.flatMap(({ entry: { externalKey } }) => {
    const identity = identityHolds.get(externalKey);
    const parts = reasons.get(externalKey) ?? [];
    return [
      ...(identity
        ? [
            {
              externalKey,
              reason: `Identity held (${identity}) in everythingpath-identities.json.`,
            },
          ]
        : []),
      ...(parts.length
        ? [
            {
              externalKey,
              reason: `Structure hand review (#716 plan §6): ${parts.join('; ')}.`,
            },
          ]
        : []),
    ];
  });
}

/**
 * A selected prestige class (#716 D1) with every feature it owns, the
 * inventory's depth-1 rows of the class, each through `mapArchetypeFeature`,
 * and its features by level from its reviewed schedule: the class's
 * `featuresByLevel` names every one, and the stored adapter refuses a missing
 * one. Null when the tree has no such block; undefined when the release scope
 * doesn't name it. A schedule PCGen's gates no longer match is refused.
 */
function emitPrestigeClass({
  tree,
  view,
  inventory,
  selector,
  keyOf,
  inScope,
}: {
  tree: PcgenTree;
  view: PcgenEffectiveView;
  inventory: PcgenInventory;
  selector: Extract<PcgenOwnerSelector, { kind: 'prestige' }>;
  keyOf: (scope: 'owners' | 'features', record: PcgenRecord) => string;
  inScope: ReadonlySet<string> | undefined;
}): OwnerEmission | null | undefined {
  const record = tree.prestigeClasses.find(
    ({ locator }) =>
      locator.file === selector.file && locator.key === selector.key,
  );
  const effective = record && view.records.get(record);
  if (!record || !effective) return null;
  const externalKey = keyOf('owners', record);
  if (inScope && !inScope.has(externalKey)) return undefined;
  const schedule = reviewedPrestigeSchedule(selector.key);
  if (!schedule)
    throw new Error(`No reviewed prestige schedule for ${selector.key}.`);
  const { rows, findings } = prestigeFeatureRows({
    tree,
    record,
    owned: inventory.rows.filter((row) => row.owner.record === record),
    schedule,
  });
  if (findings.length)
    throw new Error(
      `The reviewed ${selector.key} schedule no longer matches PCGen: ${findings.join(' ')}`,
    );
  const features = rows.map(({ classLevel, feature }) => {
    const owned = view.records.get(feature);
    if (!owned) throw new Error(`${feature.locator.key} is forgotten.`);
    return {
      classLevel,
      subject: mapArchetypeFeature({
        effective: owned,
        externalKey: keyOf('features', feature),
      }),
    };
  });
  const mapping = mapPrestigeClass({
    effective: { ...effective, record },
    externalKey,
    references: unresolvedReferences,
    featuresByLevel: features.map(({ classLevel, subject }) => ({
      classLevel,
      externalKey: subject.entry.externalKey,
    })),
  });
  return {
    subject: mapping.subject,
    features: features.map(({ subject }) => subject),
    items: mapping.items,
    ownedFeatures: features.map(({ subject }) => ({
      externalKey: subject.entry.externalKey,
      sourceSha256: subject.sourceSha256,
      owner: externalKey,
      locator: subject.locator,
    })),
  };
}

/**
 * Emits the selected owners and their features from a PCGen tree: entries,
 * their comparison records, the structure report and the rows the gate holds
 * (`reviewHolds`, which admission holds on, unlike a curation gap's label).
 */
export function emitPcgenOwners({
  tree,
  data,
  selection = pcgenOwnerSelection,
  scopeKeys,
}: {
  tree: PcgenTree;
  data: CurationData;
  selection?: readonly PcgenOwnerSelector[];
  /**
   * A release scope's keys: only the selected owners it names are emitted,
   * and every row they emit must be one of them.
   */
  scopeKeys?: readonly string[];
}) {
  const { ledger, view, inventory, lookup } = frozenIdentities(tree);
  const identityHolds = new Map<string, string>();
  const keyOf = (scope: 'owners' | 'features', record: PcgenRecord) => {
    const { key, hold } = lookup(scope, record);
    if (hold) identityHolds.set(key, hold);
    return key;
  };
  const contextOf = archetypeContexts(tree, view);
  const inScope = scopeKeys && new Set(scopeKeys);
  const archetypes = selection.flatMap((selector) =>
    selector.kind === 'archetype'
      ? found(
          selector,
          emitArchetype({ tree, contextOf, selector, keyOf, inScope }),
        )
      : [],
  );
  const prestige = selection.flatMap((selector) =>
    selector.kind === 'prestige'
      ? found(
          selector,
          emitPrestigeClass({
            tree,
            view,
            inventory,
            selector,
            keyOf,
            inScope,
          }),
        )
      : [],
  );
  const mappings: OwnerEmission[] = [...archetypes, ...prestige];
  if (inScope && !mappings.length)
    throw new Error(
      'The release scope names no selected PCGen owner; build it without --pcgen.',
    );
  const subjects = [
    ...new Map(
      mappings
        .flatMap(({ subject, features }) => [subject, ...features])
        .map((subject): [string, StructureSubject] => [
          subject.entry.externalKey,
          subject,
        ]),
    ).values(),
  ];
  const outside = subjects
    .map(({ entry }) => entry.externalKey)
    .filter((key) => inScope && !inScope.has(key));
  if (outside.length)
    throw new Error(
      `The selected PCGen owners emit rows the release scope does not name: ${outside.join(', ')}. Regenerate the scope.`,
    );
  for (const { entry } of subjects) declareBookCodes(entry);
  const structure = applyStructureCuration({
    subjects,
    items: [
      ...mappings.flatMap(({ items }) => items),
      ...stackingConflicts(archetypes).items,
    ],
    ownedFeatures: mappings.flatMap(({ ownedFeatures }) => ownedFeatures),
    data,
    variantDecisions: ledger.variantDecisions,
  });
  const reviewHolds = reviewHoldsOf({
    subjects,
    identityHolds,
    reasons: structureHoldReasons(structure),
  });
  return {
    entries: subjects.map(({ entry }) => entry),
    records: subjects.map(({ entry }) => ({
      repo: 'pcgen' as const,
      pack: entry.pack,
      path: entry.upstreamKey.slice('pcgen:'.length).split('#')[0] ?? '',
      externalKey: entry.upstreamKey,
      name: entry.name,
      status: 'admitted' as const,
      reason:
        'A chosen #716 owner or a feature it grants (pcgen-owners.ts); release admission remains pending.',
    })),
    structure,
    reviewHolds,
  };
}
