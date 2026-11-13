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
  stackingConflicts,
  type ArchetypeClassContext,
  type ArchetypeMapping,
} from './pcgen/archetypes.ts';
import { buildEffectiveView } from './pcgen/effective.ts';
import { assignPcgenIdentities } from './pcgen/identities.ts';
import { inventoryPcgen } from './pcgen/inventory.ts';
import {
  readPcgenTree,
  type PcgenRecord,
  type PcgenTree,
} from './pcgen/lst.ts';
import type { ScheduleClassName } from './pcgen/schedule-model.ts';
import { allIncrementKeys, reviewedSchedule } from './pcgen/schedules.ts';
import {
  applyStructureCuration,
  type StructureSubject,
} from './structure-curation.ts';

/**
 * #716 E1 (design archetype-emission §E): the importer's PCGen owners. Only
 * the owners an explicit selector names are emitted, never the whole corpus
 * (its 1,123 archetypes would pass the inventory budget, design §F): each
 * mapped onto its base class's reviewed schedule (`mapArchetype`), with the
 * features it grants directly (`mapArchetypeFeature`).
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

/** A chosen owner: an archetype record by its file and KEY, on its base class's reviewed schedule. */
export type PcgenOwnerSelector = {
  kind: 'archetype';
  className: ScheduleClassName;
  file: string;
  key: string;
};
type NonEmpty<T> = readonly [T, ...T[]];

/**
 * The party's archetypes (design §A; party-scope A, "Structural findings").
 * Prestige classes (Dragon Disciple) are E4's.
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
];

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
  const assigned = assignPcgenIdentities({
    inventory: inventoryPcgen(tree),
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
  return { ledger, view, lookup };
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

/**
 * Emits the selected owners and their features from a PCGen tree: entries,
 * their comparison records, the structure report and the rows the gate holds
 * (`reviewHolds`, which admission holds on, unlike a curation gap's label).
 */
export function emitPcgenOwners({
  tree,
  data,
  selection = pcgenOwnerSelection,
}: {
  tree: PcgenTree;
  data: CurationData;
  selection?: readonly PcgenOwnerSelector[];
}) {
  const { ledger, view, lookup } = frozenIdentities(tree);
  const identityHolds = new Map<string, string>();
  const keyOf = (scope: 'owners' | 'features', record: PcgenRecord) => {
    const { key, hold } = lookup(scope, record);
    if (hold) identityHolds.set(key, hold);
    return key;
  };
  const contexts = new Map<ScheduleClassName, ArchetypeClassContext>();
  const contextOf = (className: ScheduleClassName) => {
    const schedule = reviewedSchedule(className);
    if (!schedule) throw new Error(`No reviewed ${className} schedule.`);
    const context =
      contexts.get(className) ??
      archetypeClassContext({ tree, view, schedule });
    contexts.set(className, context);
    return context;
  };
  const mappings: ArchetypeMapping[] = selection.map((selector) => {
    const record = tree.archetypes.find(
      ({ locator }) =>
        locator.file === selector.file && locator.key === selector.key,
    );
    if (!record)
      throw new Error(
        `Selected owner ${selector.key} (${selector.file}) is not in the PCGen tree.`,
      );
    return mapArchetype({
      context: contextOf(selector.className),
      record,
      externalKey: keyOf('owners', record),
      featureKeyOf: (feature) => keyOf('features', feature),
    });
  });
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
  for (const { entry } of subjects) declareBookCodes(entry);
  const structure = applyStructureCuration({
    subjects,
    items: [
      ...mappings.flatMap(({ items }) => items),
      ...stackingConflicts(mappings).items,
    ],
    ownedFeatures: mappings.flatMap(({ ownedFeatures }) => ownedFeatures),
    data,
    variantDecisions: ledger.variantDecisions,
  });
  const reasons = structureHoldReasons(structure);
  const reviewHolds = subjects.flatMap(({ entry: { externalKey } }) => {
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
