import {
  catalogKeySchema,
  reviewedRemapSchema,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  applyCuration,
  collectCurationInputs,
  collectDescriptionInputs,
  bindingKey,
  parseCuration,
  draftCurationRecord,
  type CurationData,
} from './curation.ts';
import { reviewedScheduleEntries } from './class-schedules.ts';
import { withGrantedSpells } from './granted-spells.ts';
import {
  pins,
  itemAbilityHelperId,
  type ImportKind,
  type Repository,
} from './inventory.ts';
import {
  classify,
  isResource,
  mapChangesDiscardingUnsupported,
  mapEntry,
  mapRaceAbilityTrait,
  upstreamRecord,
  toExternalKey,
  type LoadedRecord,
} from './map.ts';
import {
  planRacialTraits,
  racialOutputHome,
  reportRacialTraits,
  type RacialTraitPlan,
} from './racial-traits.ts';
import { findRacialTraitRules } from './racial-trait-rules.ts';

const manifestSchema = z.object({
  version: z.string(),
  packs: z.array(z.object({ name: z.string().regex(/^[\w-]+$/) })),
});
type InventoryRecord = {
  repo: Repository;
  pack: string;
  path: string;
  externalKey: string;
  name: string;
  status: 'admitted' | 'excluded' | 'unassigned';
  reason: string;
};
type PackComparison = {
  repo: Repository;
  pack: string;
  declared: boolean;
  present: boolean;
  admitted: number;
  excluded: number;
  unassigned: number;
};

const remapSchema = z.array(reviewedRemapSchema);

type Candidate = { source: LoadedRecord; kind: ImportKind };
type ReviewedRemap = z.infer<typeof remapSchema>[number];

type CatalogImportOptions = {
  systemPath: string;
  contentPath: string;
  remaps: unknown;
  curation?: unknown;
  candidateKeys?: string[];
  /**
   * #770: a versioned release scope's resolved import set. It isn't a
   * curation batch, so the three-class cap doesn't apply, and coverage still
   * counts every upstream record rather than only the selected ones.
   */
  scopeKeys?: string[];
};
type DraftOptions = CatalogImportOptions & { descriptions?: boolean };

/** The most keys one curation batch selects. */
const candidateLimit = 100;

export function parseCandidateKeys(value: unknown) {
  return z.array(catalogKeySchema).min(1).max(candidateLimit).parse(value);
}

/** A #716 batch ticket's "Import selector" (#659–#702, #551–#576). */
const importSelectorSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    source: z.literal('#716 PRD/PCGen import'),
    kind: z.literal('archetype'),
    base_class: z.string().min(1),
    max_candidates: z.number().int().min(1).max(candidateLimit),
  }),
  z.strictObject({
    source: z.literal('#716 PRD/PCGen import'),
    kind: z.literal('prestige'),
    name_initial: z.string().regex(/^[A-Z]$/),
    max_candidates: z.number().int().min(1).max(candidateLimit),
  }),
]);
/**
 * An archetype or prestige class in the #716 import, with the upstream keys
 * (`pcgen:<file>#<KEY>`) of the feature records it grants directly. Nested
 * grants are reviewed with their owner but aren't listed.
 */
type OwnerRecord = {
  name: string;
  locator: string;
  ownedFeatures: readonly string[];
};
export type ImportOwner =
  | (OwnerRecord & {
      kind: 'archetype';
      /** As PCGen's `Archetype Base Class` names it. */
      baseClass: string;
    })
  | (OwnerRecord & { kind: 'prestige' });
type ImportSelector = z.infer<typeof importSelectorSchema>;

const nameInitial = (name: string) =>
  name.normalize('NFD').charAt(0).toUpperCase();
const compare = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

/** The owners a selector picks out, by name and then locator. */
function selectOwners({
  selector,
  owners,
}: {
  selector: ImportSelector;
  owners: readonly ImportOwner[];
}) {
  return owners
    .filter((owner) =>
      selector.kind === 'archetype'
        ? owner.kind === 'archetype' &&
          owner.baseClass.toLowerCase() === selector.base_class.toLowerCase()
        : owner.kind === 'prestige' &&
          nameInitial(owner.name) === selector.name_initial,
    )
    .sort(
      (left, right) =>
        compare(left.name.toLowerCase(), right.name.toLowerCase()) ||
        compare(left.locator, right.locator),
    );
}

/** The most class definitions one curation batch selects (`selectCandidates`). */
const classDefinitionLimit = 3;

type OwnerBatch = { owners: string[]; features: Set<string> };

/** Whether owners fit a batch: at most `limit` keys and, for prestige owners, three class definitions. */
function fitsBatch({
  batch,
  owners,
  limit,
}: {
  batch: OwnerBatch;
  owners: readonly ImportOwner[];
  limit: number;
}) {
  const features = new Set(batch.features);
  for (const owner of owners)
    for (const feature of owner.ownedFeatures) features.add(feature);
  const classes = [...batch.owners, ...owners].length;
  return (
    batch.owners.length + owners.length + features.size <= limit &&
    (owners[0]?.kind !== 'prestige' || classes <= classDefinitionLimit)
  );
}

function addToBatch(batch: OwnerBatch, owners: readonly ImportOwner[]) {
  for (const owner of owners) {
    batch.owners.push(owner.locator);
    for (const feature of owner.ownedFeatures) batch.features.add(feature);
  }
}

/**
 * Packs owners in order, each with its features, into batches of at most
 * `limit` keys. A prestige class is a class definition, so a prestige batch
 * also holds at most three, as `--candidates` allows; same-name prestige
 * variants share a batch where they fit.
 */
function packOwners({
  owners,
  limit,
}: {
  owners: readonly ImportOwner[];
  limit: number;
}) {
  const batches: OwnerBatch[] = [];
  const empty = (): OwnerBatch => ({ owners: [], features: new Set() });
  for (const owner of owners) {
    const size = new Set(owner.ownedFeatures).size + 1;
    if (size > limit)
      throw new Error(
        `${owner.name} owns ${size - 1} features directly; with it that is ${size} keys, over the ${limit}-key limit.`,
      );
  }
  for (const group of groupVariants(owners)) {
    const current = batches.at(-1);
    if (current && fitsBatch({ batch: current, owners: group, limit })) {
      addToBatch(current, group);
      continue;
    }
    if (fitsBatch({ batch: empty(), owners: group, limit })) {
      const batch = empty();
      addToBatch(batch, group);
      batches.push(batch);
      continue;
    }
    for (const owner of group) {
      const last = batches.at(-1);
      if (last && fitsBatch({ batch: last, owners: [owner], limit })) {
        addToBatch(last, [owner]);
        continue;
      }
      const batch = empty();
      addToBatch(batch, [owner]);
      batches.push(batch);
    }
  }
  return batches.map((batch) => ({
    owners: batch.owners,
    features: [...batch.features],
  }));
}

/** Consecutive same-name prestige owners as one group; every other owner alone. */
function groupVariants(owners: readonly ImportOwner[]) {
  const groups: ImportOwner[][] = [];
  for (const owner of owners) {
    const last = groups.at(-1);
    const previous = last?.[0];
    if (
      last &&
      previous?.kind === 'prestige' &&
      owner.kind === 'prestige' &&
      previous.name.toLowerCase() === owner.name.toLowerCase()
    )
      last.push(owner);
    else groups.push([owner]);
  }
  return groups;
}

/**
 * Plan §6: the owners a batch's Import selector picks out, packed into
 * ordered sub-batches of at most `max_candidates` keys. A sub-batch counts
 * each owner and each distinct feature record its owners grant directly, by
 * upstream key, so a same-key variant in another book counts separately and a
 * feature two owners share counts once. An owner and its features always
 * share a sub-batch. A prestige sub-batch holds at most three prestige
 * records (#716 P4), counted by record, so variants count separately.
 */
export function planImportBatches({
  selector: value,
  owners,
}: {
  selector: unknown;
  owners: readonly ImportOwner[];
}) {
  const selector = importSelectorSchema.parse(value);
  return {
    batches: packOwners({
      owners: selectOwners({ selector, owners }),
      limit: selector.max_candidates,
    }),
  };
}

export async function importCatalog({
  curation = { records: [] },
  ...options
}: CatalogImportOptions) {
  const prepared = await prepareCatalog(options);
  return importPreparedCatalog({ prepared, data: parseCuration(curation) });
}

async function prepareCatalog({
  systemPath,
  contentPath,
  remaps: reviewedRemaps,
  candidateKeys,
  scopeKeys,
}: Omit<CatalogImportOptions, 'curation'>) {
  if (candidateKeys !== undefined && scopeKeys !== undefined)
    throw new Error(
      'A release scope and curation candidate keys are exclusive.',
    );
  const remaps = remapSchema.parse(reviewedRemaps);
  const loaded = await loadCatalogInputs({ systemPath, contentPath });
  const classified = classifyRecords(loaded);
  const resolved = resolveRemaps({ candidates: classified.candidates, remaps });
  const seeds = collectHelperSeeds(loaded.loaded);
  const scoped = selectCandidates({
    ...classified,
    packs: loaded.packs,
    candidateKeys: candidateKeys ?? scopeKeys,
    isCurationBatch: scopeKeys === undefined,
  });
  return {
    ...loaded,
    ...scoped,
    ...resolved,
    remaps,
    seeds,
    candidateKeys,
    ...(scopeKeys && {
      coverageComplete: isCoverageComplete(classified.records, loaded.packs),
    }),
  };
}

function isCoverageComplete(
  records: InventoryRecord[],
  packs: PackComparison[],
) {
  return (
    records.every((record) => record.status !== 'unassigned') &&
    packs.every((pack) => pack.present && pack.declared)
  );
}

function selectCandidates({
  records,
  candidates,
  packs,
  candidateKeys,
  isCurationBatch,
}: ReturnType<typeof classifyRecords> & {
  packs: PackComparison[];
  candidateKeys?: string[];
  isCurationBatch: boolean;
}) {
  if (candidateKeys === undefined) return { records, candidates, packs };
  const selected = new Set(candidateKeys);
  if (selected.size !== candidateKeys.length)
    throw new Error('Candidate keys must be unique.');
  const known = new Set(records.map((record) => record.externalKey));
  for (const key of selected)
    if (!known.has(key)) throw new Error(`Unknown candidate key: ${key}`);
  const selectedRecords = records.filter((record) =>
    selected.has(record.externalKey),
  );
  const selectedCandidates = candidates.filter(({ source }) =>
    selected.has(toExternalKey(source)),
  );
  if (
    isCurationBatch &&
    selectedCandidates.filter(({ kind }) => kind === 'class').length > 3
  )
    throw new Error(
      'A curation batch may contain at most three class definitions.',
    );
  return {
    records: selectedRecords,
    candidates: selectedCandidates,
    packs: packs
      .filter((pack) =>
        selectedRecords.some(
          (record) => record.repo === pack.repo && record.pack === pack.pack,
        ),
      )
      .map((pack) => {
        const rows = selectedRecords.filter(
          (record) => record.repo === pack.repo && record.pack === pack.pack,
        );
        return {
          ...pack,
          admitted: rows.filter((row) => row.status === 'admitted').length,
          excluded: rows.filter((row) => row.status === 'excluded').length,
          unassigned: rows.filter((row) => row.status === 'unassigned').length,
        };
      }),
  };
}

type PreparedCatalog = Awaited<ReturnType<typeof prepareCatalog>>;

function planPreparedRacialTraits({
  prepared,
  data,
}: {
  prepared: PreparedCatalog;
  data: CurationData;
}) {
  return planRacialTraits({
    loaded: prepared.loaded,
    resolveKey: prepared.resolveKey,
    data,
    hasAbilityChoice: (trait) =>
      findRacialTraitRules(trait).some(
        (rule) => rule.fact.kind === 'abilityChoice',
      ),
    mapsChange: ({ record, kind, change }) =>
      mapChangesDiscardingUnsupported({ record, kind, changes: [change] })
        .length > 0,
  });
}

/** Required note inputs, less the race and trait notes the plan retires. */
function collectRequiredInputs({
  source,
  kind,
  externalKey,
  racial,
}: Parameters<typeof collectCurationInputs>[0] & {
  racial: RacialTraitPlan;
}) {
  return collectCurationInputs({ source, kind, externalKey }).filter(
    (input) => !racial.notRequired.has(bindingKey(input)),
  );
}

function importPreparedCatalog({
  prepared,
  data,
}: {
  prepared: PreparedCatalog;
  data: CurationData;
}) {
  const racial = planPreparedRacialTraits({ prepared, data });
  const mapped = mapCandidates({ ...prepared, racial });
  const reviewedDescriptions = new Set(
    data.records
      .filter((record) => record.kind === 'description')
      .map((record) => record.externalKey),
  );
  const inputs = prepared.candidates.flatMap(({ source, kind }) => {
    const externalKey =
      prepared.resolveKey(toExternalKey(source)) ?? toExternalKey(source);
    return [
      ...collectRequiredInputs({ source, kind, externalKey, racial }),
      ...collectDescriptionInputs({
        source,
        kind,
        externalKey,
        explicitlyReviewed: reviewedDescriptions.has(externalKey),
      }),
    ];
  });
  const extracted = new Map(
    mapped.map((entry) => [entry.externalKey, entry.modifiers.length]),
  );
  const report = applyCuration({
    inputs,
    seeds: prepared.seeds,
    data,
    entries: mapped,
    outputHome: (record, output) => racialOutputHome(racial, record, output),
  });
  const summary = summariseImport({ ...prepared, mapped });
  // Optional because tests/catalog/release.test.ts builds reduced artifacts
  // without the report.
  const catalog: typeof summary.catalog & {
    racialTraits?: ReturnType<typeof reportRacialTraits>;
  } = {
    ...summary.catalog,
    racialTraits: reportRacialTraits({
      plan: racial,
      entries: mapped,
      extractedModifierCounts: extracted,
      mapRaceChanges: (race, changes) =>
        mapChangesDiscardingUnsupported({
          record: race.record,
          kind: 'race',
          changes,
          upstreamKey: toExternalKey(race),
        }),
    }),
  };
  return { ...summary, catalog, curation: report };
}

export async function draftCatalogCuration({
  curation = { records: [] },
  descriptions = false,
  ...options
}: DraftOptions) {
  const data = parseCuration(curation);
  const prepared = await prepareCatalog(options);
  return draftPreparedCuration({
    prepared,
    data,
    shouldCollectDescriptions: descriptions,
  });
}

export async function draftCatalogCurationWithReport({
  curation = { records: [] },
  descriptions = false,
  ...options
}: DraftOptions) {
  const data = parseCuration(curation);
  const prepared = await prepareCatalog(options);
  const draft = draftPreparedCuration({
    prepared,
    data,
    shouldCollectDescriptions: descriptions,
  });
  const artifact = importPreparedCatalog({
    prepared,
    data: parseCuration(draft),
  });
  return {
    draft,
    report: artifact.curation,
    inputs: artifact.catalog.inputs,
    candidateKeys: prepared.candidateKeys,
  };
}

function draftPreparedCuration({
  prepared,
  data,
  shouldCollectDescriptions,
}: {
  prepared: PreparedCatalog;
  data: CurationData;
  shouldCollectDescriptions: boolean;
}) {
  const seedKeys = new Set(prepared.seeds.map(bindingKey));
  const validRecords = data.records.filter((record) =>
    record.seedBindings.every((seed) => seedKeys.has(bindingKey(seed))),
  );
  const validKeys = new Set(validRecords.map(bindingKey));
  const seen = new Set(validKeys);
  const racial = planPreparedRacialTraits({ prepared, data });
  const added = prepared.candidates.flatMap(({ source, kind }) => {
    const externalKey =
      prepared.resolveKey(toExternalKey(source)) ?? toExternalKey(source);
    return (
      shouldCollectDescriptions
        ? collectDescriptionInputs({ source, kind, externalKey })
        : collectRequiredInputs({ source, kind, externalKey, racial })
    )
      .filter((input) => {
        const key = bindingKey(input);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((input) =>
        draftCurationRecord({ input, source, data, seeds: prepared.seeds }),
      );
  });
  const addedKeys = new Set(added.map(bindingKey));
  const replaced = data.records.filter((record) => {
    const key = bindingKey(record);
    return !validKeys.has(key) && addedKeys.has(key);
  });
  const replacedKeys = new Set(replaced.map(bindingKey));
  return {
    ...data,
    records: [
      ...data.records.filter((record) => !replacedKeys.has(bindingKey(record))),
      ...added,
    ],
    added,
    replaced,
  };
}

function collectHelperSeeds(loaded: LoadedRecord[]) {
  return loaded
    .filter(
      (source) =>
        source.repo === 'pf1-content' &&
        source.record._id === itemAbilityHelperId,
    )
    .flatMap((source) =>
      collectCurationInputs({
        source,
        externalKey: toExternalKey(source),
        kind: 'helper',
      }),
    );
}

async function loadCatalogInputs({
  systemPath,
  contentPath,
}: {
  systemPath: string;
  contentPath: string;
}) {
  const inputs = await Promise.all(
    (
      [
        ['pf1', systemPath],
        ['pf1-content', contentPath],
      ] as const
    ).map(async ([repo, root]) => {
      const manifestText = await readFile(
        join(root, pins[repo].manifest),
        'utf8',
      );
      return {
        repo,
        root,
        manifest: manifestSchema.parse(JSON.parse(manifestText)),
        manifestText,
      };
    }),
  );
  if (
    new Set(inputs.map((input) => input.manifest.version.split('.')[0]))
      .size !== 1
  )
    throw new Error('Upstream major versions must match.');
  for (const input of inputs)
    if (input.manifest.version !== pins[input.repo].version)
      throw new Error(
        `Expected pinned ${input.repo} ${pins[input.repo].version}.`,
      );
  const loaded: LoadedRecord[] = [];
  const packs: PackComparison[] = [];
  const fingerprints = [];
  for (const { repo, root, manifest, manifestText } of inputs) {
    const hash = createHash('sha256').update(manifestText);
    const directory = pins[repo].directory;
    const onDisk = (
      await readdir(join(root, directory), { withFileTypes: true })
    )
      .filter((item) => item.isDirectory())
      .map((item) => item.name);
    const declared = manifest.packs.map((pack) => pack.name);
    for (const pack of [...new Set([...declared, ...onDisk])].sort()) {
      const comparison: PackComparison = {
        repo,
        pack,
        declared: declared.includes(pack),
        present: onDisk.includes(pack),
        admitted: 0,
        excluded: 0,
        unassigned: 0,
      };
      packs.push(comparison);
      if (!comparison.present) continue;
      for (const file of (
        await readdir(join(root, directory, pack), { recursive: true })
      ).sort()) {
        if (!/\.ya?ml$/.test(file)) continue;
        const path = `${directory}/${pack}/${file}`;
        const text = await readFile(join(root, path), 'utf8');
        hash.update(path).update('\0').update(text).update('\0');
        try {
          loaded.push({
            repo,
            pack,
            path,
            record: upstreamRecord.parse(parse(text)),
          });
        } catch (cause) {
          throw new Error(`Invalid upstream YAML record: ${repo}/${path}`, {
            cause,
          });
        }
      }
    }
    fingerprints.push({
      repo,
      tag: pins[repo].tag,
      version: manifest.version,
      contentSha256: hash.digest('hex'),
    });
  }
  return { loaded, packs, fingerprints };
}

function findRaceBuilderFolders(loaded: LoadedRecord[]) {
  const raceBuilderFolders = new Set(['DrDUkvfcwfcx6AP9']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const source of loaded)
      if (
        source.repo === 'pf1-content' &&
        source.pack === 'pf-racial-traits' &&
        source.record._key.startsWith('!folders!') &&
        source.record.folder &&
        raceBuilderFolders.has(source.record.folder) &&
        !raceBuilderFolders.has(source.record._id)
      ) {
        raceBuilderFolders.add(source.record._id);
        changed = true;
      }
  }
  return raceBuilderFolders;
}

function classifyRecords({
  loaded,
  packs,
}: Awaited<ReturnType<typeof loadCatalogInputs>>) {
  const raceBuilderFolders = findRaceBuilderFolders(loaded);
  const records: InventoryRecord[] = [];
  const candidates: Candidate[] = [];
  const keys = new Set<string>();
  for (const source of loaded) {
    const classification = classify({ source, raceBuilderFolders });
    const externalKey = toExternalKey(source);
    if (!source.record._key.startsWith('!folders!')) {
      if (keys.has(externalKey))
        throw new Error(`Duplicate upstream identity: ${externalKey}`);
      keys.add(externalKey);
    }
    const status = classification.kind;
    records.push({
      repo: source.repo,
      pack: source.pack,
      path: source.path,
      externalKey,
      name: source.record.name,
      status,
      reason:
        classification.kind === 'admitted'
          ? 'In scope for preview extraction; release admission remains pending.'
          : classification.reason,
    });
    const pack = packs.find(
      (pack) => pack.repo === source.repo && pack.pack === source.pack,
    );
    if (pack) pack[status]++;
    if (classification.kind === 'admitted')
      candidates.push({ source, kind: classification.entryKind });
  }
  return { records, candidates };
}

function resolveRemaps({
  candidates,
  remaps,
}: {
  candidates: Candidate[];
  remaps: ReviewedRemap[];
}) {
  const lookup = new Map(
    candidates.map((candidate) => [
      toExternalKey(candidate.source),
      candidate.source,
    ]),
  );
  const candidateKinds = new Map(
    candidates.map((candidate) => [
      toExternalKey(candidate.source),
      candidate.kind,
    ]),
  );
  const identities = new Map<string, string>();
  const remapOrigins = new Set<string>();
  const emittedIdentities = new Set<string>();
  for (const remap of remaps) {
    if (remapOrigins.has(remap.from))
      throw new Error(`Duplicate remap identity: ${remap.from}`);
    remapOrigins.add(remap.from);
    const fromKind = candidateKinds.get(remap.from);
    const toKind = candidateKinds.get(remap.to);
    if (
      (fromKind && fromKind !== remap.kind) ||
      (toKind && toKind !== remap.kind)
    )
      throw new Error(`Remap identity kind mismatch: ${remap.from}`);
    if (
      remap.from === remap.to ||
      (fromKind && toKind) ||
      remaps.some((other) => other.from === remap.to)
    )
      throw new Error(`Conflicting remap identity: ${remap.to}`);
    if (fromKind && emittedIdentities.has(remap.to))
      throw new Error(`Conflicting remap identity: ${remap.to}`);
    if (fromKind) emittedIdentities.add(remap.to);
    identities.set(remap.from, remap.to);
  }
  for (const [from, to] of identities) {
    const current = lookup.get(from);
    const retained = lookup.get(to);
    if (current) lookup.set(to, current);
    else if (retained) lookup.set(from, retained);
  }
  const resolveKey = (key: string) =>
    lookup.has(key) ? (identities.get(key) ?? key) : undefined;
  return { lookup, resolveKey };
}

function mapCandidates({
  candidates,
  lookup,
  resolveKey,
  racial,
}: {
  candidates: Candidate[];
  racial: RacialTraitPlan;
} & ReturnType<typeof resolveRemaps>) {
  const spellClassTags = new Set(
    [...lookup.values()]
      .filter(
        (source) => source.record.type === 'class' && source.pack === 'classes',
      )
      .map((source) => source.record.system.tag)
      .filter((tag): tag is string => typeof tag === 'string'),
  );
  return candidates
    .flatMap(({ source, kind }) => {
      try {
        const entry = mapEntry({
          source,
          kind,
          resolveKey,
          lookup,
          spellClassTags,
          racial,
        });
        // #721: a race's reviewed ability score trait has no source record.
        const abilityTrait =
          kind === 'race'
            ? mapRaceAbilityTrait({ source, racial, resolveKey, lookup })
            : undefined;
        if (abilityTrait) return [entry, abilityTrait];
        // S3: a reviewed class's rows and increments come from its schedule.
        // Granted-levels S1: a mapped class feature gains its Granted Spells.
        return reviewedScheduleEntries({
          entry: withGrantedSpells({
            entry,
            record: source.record,
            resolveKey,
          }),
          record: source.record,
          resolveKey,
        });
      } catch (cause) {
        throw new Error(
          `Cannot map ${toExternalKey(source)} (${source.path})`,
          { cause },
        );
      }
    })
    .sort((left, right) => {
      if (left.externalKey < right.externalKey) return -1;
      if (left.externalKey > right.externalKey) return 1;
      return 0;
    });
}

function summariseImport({
  records,
  candidates,
  packs,
  fingerprints,
  mapped,
  remaps,
  candidateKeys,
  coverageComplete = isCoverageComplete(records, packs),
}: Pick<
  Awaited<ReturnType<typeof loadCatalogInputs>>,
  'packs' | 'fingerprints'
> &
  ReturnType<typeof classifyRecords> & {
    mapped: ReturnType<typeof mapCandidates>;
    remaps: ReviewedRemap[];
    candidateKeys?: string[];
    /** A scope's coverage over every record, before selection (#770). */
    coverageComplete?: boolean;
  }) {
  const importedKeys = new Set(
    candidates.map(({ source }) => toExternalKey(source)),
  );
  const unsupportedEntries = mapped
    .filter((entry) => entry.unsupported.length)
    .map((entry) => ({
      externalKey: entry.externalKey,
      pack: entry.pack,
      issues: entry.unsupported,
    }));
  const byKind: Record<string, number> = {};
  for (const entry of mapped)
    byKind[entry.detail.kind] = (byKind[entry.detail.kind] ?? 0) + 1;
  const summary = {
    upstreamRecords: records.length,
    admitted: mapped.length,
    excluded: records.filter((row) => row.status === 'excluded').length,
    unassigned: records.filter((row) => row.status === 'unassigned').length,
    byKind,
  };
  return {
    catalog: {
      purpose: 'preview',
      ...(candidateKeys ? { candidateKeys } : {}),
      releaseAdmission: 'not-evaluated',
      remaps: remaps.map((remap) => ({
        ...remap,
        applied: importedKeys.has(remap.from) || importedKeys.has(remap.to),
      })),
      inputs: fingerprints,
      summary,
      entries: mapped.filter((entry) => !isResource(entry)),
      resources: mapped.filter(isResource),
    },
    unsupported: {
      purpose: 'preview',
      summary: {
        entries: unsupportedEntries.length,
        issues: unsupportedEntries.reduce(
          (sum, entry) => sum + entry.issues.length,
          0,
        ),
      },
      entries: unsupportedEntries,
    },
    comparison: {
      ...(candidateKeys ? { candidateKeys } : {}),
      coverageComplete,
      summary,
      packs,
      records,
    },
  };
}
