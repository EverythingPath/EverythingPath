import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  encodeAttributionEvidence,
  parseAttributionEvidenceText,
  readAttributionEvidence,
} from '../../src/lib/catalog/attribution-evidence-codec.ts';
import { bindingKey } from './curation.ts';
import { structureBindingKey } from './structure-curation.ts';

/**
 * The shared catalog data files every curation batch edits. Each is written in
 * one canonical form so parallel batches touch only the lines of their own
 * entries: top-level collections sorted by stable identity, fields in schema
 * order, identity-keyed maps sorted, nested arrays as authored, two-space
 * indentation and a trailing newline.
 */
export const catalogDataFiles = {
  curation: 'scripts/catalog/reviewed-curation.json',
  assessments: 'src/lib/catalog/data/attribution-assessments.json',
  evidence: 'src/lib/catalog/data/attribution-evidence.json',
  registry: 'src/lib/catalog/data/section15-registry.json',
  heldNotices: 'scripts/catalog/legal/held-notices.json',
} as const;
export type CatalogDataFile = keyof typeof catalogDataFiles;
export const catalogDataFileNames: CatalogDataFile[] = [
  'curation',
  'assessments',
  'evidence',
  'registry',
  'heldNotices',
];

type Entry = Record<string, unknown>;
/** A top-level collection: its entries keyed by stable identity. */
export type CatalogCollections = Map<string, Map<string, unknown>>;

type FileSpec = {
  /** Escape every non-ASCII character as `\uXXXX`, as the overlay always has. */
  escapeNonAscii: boolean;
  /** Field order for schema objects at any depth; other fields follow sorted. */
  fields: string[];
  /** Fields whose objects are identity-keyed maps, written with sorted keys. */
  maps: string[];
  rootIsMap: boolean;
  /** Write an object whose only field is `ref` on one line. */
  inlineRefs?: boolean;
  /** Collection name and per-entry identity, for each top-level collection. */
  collections: Record<string, (entry: Entry) => string>;
  describe: (collection: string, identity: string) => string;
};

const curationFields = [
  'records',
  'situations',
  'structures',
  'externalKey',
  'sourceSha256',
  'fields',
  'noMechanics',
  'resolves',
  'key',
  'label',
  'aliases',
  'kind',
  'bonusEquivalent',
  'sourceKey',
  'doublesThreat',
  'weaponDamageTypes',
  'choice',
  'damageDice',
  'on',
  'dice',
  'damageType',
  'target',
  'bonusType',
  'value',
  'formula',
  'situation',
  'whileActive',
  'weapon',
  'option',
  'castingClass',
  'school',
  'local',
  'text',
  'textSha256',
  'actionId',
  'conditionalId',
  'condition',
  'stacksWithinEntry',
  'status',
  'outputs',
  'rationale',
  'diagnostics',
  'reviewedBy',
  'reviewedOn',
  'seedBindings',
];

const specs: Record<CatalogDataFile, FileSpec> = {
  curation: {
    escapeNonAscii: true,
    fields: curationFields,
    // A structure record's reviewed values, keyed by the field they replace.
    maps: ['fields'],
    rootIsMap: false,
    collections: {
      records: (entry) => bindingKey(entry),
      situations: (entry) => String(entry.key),
      structures: (entry) => structureBindingKey(entry),
    },
    describe: (collection, identity) => {
      if (collection === 'structures') {
        const [externalKey, fields, sha] = z
          .tuple([z.string(), z.array(z.string()), z.string()])
          .parse(JSON.parse(identity));
        return `${collection} ${externalKey} [${fields.join(', ')}] sha256:${sha.slice(0, 12)}`;
      }
      if (collection !== 'records') return `${collection} ${identity}`;
      const [externalKey, kind, target, actionId, conditionalId, sha] = z
        .array(z.string().nullable())
        .parse(JSON.parse(identity));
      return [
        collection,
        externalKey,
        kind,
        target,
        ...(actionId || conditionalId ? [`${actionId}/${conditionalId}`] : []),
        `sha256:${sha?.slice(0, 12)}`,
      ].join(' ');
    },
  },
  assessments: {
    escapeNonAscii: false,
    fields: [
      'externalKey',
      'status',
      'contentFingerprint',
      'mappingFingerprint',
      'evidenceFingerprints',
      'noticeFingerprints',
      'requiredNotices',
      'rationale',
      'reviewedBy',
      'reviewedOn',
    ],
    maps: ['evidenceFingerprints', 'noticeFingerprints'],
    rootIsMap: false,
    collections: { assessments: (entry) => String(entry.externalKey) },
    describe: (collection, identity) => `${collection} ${identity}`,
  },
  // The decoded evidence map; the file itself is written encoded, below.
  evidence: {
    escapeNonAscii: false,
    fields: ['content', 'revoked'],
    maps: [],
    rootIsMap: true,
    collections: { evidence: () => '' },
    describe: (collection, identity) => `${collection} ${identity}`,
  },
  registry: {
    escapeNonAscii: false,
    fields: [
      'title',
      'notice',
      'checkedAgainst',
      'checkedOn',
      'aliases',
      'reviewStatus',
      'provenance',
    ],
    maps: [],
    rootIsMap: true,
    collections: { registry: () => '' },
    describe: (_, identity) => `Registry ${identity}`,
  },
  heldNotices: {
    escapeNonAscii: false,
    fields: ['id', 'notices', 'evidence'],
    maps: [],
    rootIsMap: false,
    collections: { 'held notices': (entry) => String(entry.id) },
    describe: (collection, identity) => `${collection} ${identity}`,
  },
};

/**
 * The committed evidence file (#744): entries as literal `content` or `parts`
 * of text and blob references, and the shared blobs, one part per line.
 */
const encodedEvidenceSpec: FileSpec = {
  escapeNonAscii: false,
  fields: ['evidence', 'shared', 'content', 'parts', 'revoked'],
  maps: ['evidence', 'shared'],
  rootIsMap: false,
  inlineRefs: true,
  collections: {},
  describe: (collection, identity) => `${collection} ${identity}`,
};

export function isEntry(value: unknown): value is Entry {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function compare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function entriesOf({
  file,
  collection,
  value,
}: {
  file: CatalogDataFile;
  collection: string;
  value: unknown;
}): [string, unknown][] {
  const spec = specs[file];
  if (spec.rootIsMap) {
    if (!isEntry(value))
      throw new Error(`${catalogDataFiles[file]} must be a JSON object.`);
    return Object.entries(value);
  }
  if (!Array.isArray(value))
    throw new Error(
      `${catalogDataFiles[file]} ${collection} must be an array.`,
    );
  const identify = spec.collections[collection];
  return value.map((entry: unknown) => {
    if (!isEntry(entry) || !identify)
      throw new Error(
        `${catalogDataFiles[file]} ${collection} entries must be objects.`,
      );
    return [identify(entry), entry];
  });
}

/** The value of each top-level collection; only the overlay has several. */
function collectionValues(file: CatalogDataFile, value: unknown) {
  const names = Object.keys(specs[file].collections);
  if (file !== 'curation') return names.map((name) => [name, value] as const);
  if (!isEntry(value))
    throw new Error(`${catalogDataFiles[file]} must be a JSON object.`);
  const unknown = Object.keys(value).filter((key) => !names.includes(key));
  if (unknown.length)
    throw new Error(
      `${catalogDataFiles[file]} has unknown fields: ${unknown.join(', ')}.`,
    );
  return names.map((name) => [name, value[name] ?? []] as const);
}

/** Splits a parsed data file into its top-level collections by identity. */
export function splitCatalogData(
  file: CatalogDataFile,
  value: unknown,
): CatalogCollections {
  const collections: CatalogCollections = new Map();
  // Evidence arrives encoded, or as the plain map earlier branches committed;
  // the formatter drops any blob no entry uses.
  const decoded =
    file === 'evidence'
      ? readAttributionEvidence(value, { allowOrphans: true })
      : value;
  for (const [name, collection] of collectionValues(file, decoded)) {
    const entries = new Map<string, unknown>();
    for (const [identity, entry] of entriesOf({
      file,
      collection: name,
      value: collection,
    })) {
      if (entries.has(identity))
        throw new Error(
          `Duplicate identity: ${specs[file].describe(name, identity)}.`,
        );
      entries.set(identity, entry);
    }
    collections.set(name, entries);
  }
  return collections;
}

/** Rebuilds a data file from its collections, sorted by identity. */
export function joinCatalogData(
  file: CatalogDataFile,
  collections: CatalogCollections,
): unknown {
  const sorted = [...collections].map(
    ([name, entries]) =>
      [
        name,
        [...entries].sort(([left], [right]) => compare(left, right)),
      ] as const,
  );
  if (specs[file].rootIsMap) return Object.fromEntries(sorted[0]?.[1] ?? []);
  const arrays = sorted.map(
    ([name, entries]) => [name, entries.map(([, entry]) => entry)] as const,
  );
  // #716's structure records are written only once there are some.
  return file === 'curation'
    ? Object.fromEntries(
        arrays.filter(
          ([name, entries]) => name !== 'structures' || entries.length > 0,
        ),
      )
    : (arrays[0]?.[1] ?? []);
}

/** Describes an identity for an operator-facing report. */
export function describeCatalogIdentity({
  file,
  collection,
  identity,
}: {
  file: CatalogDataFile;
  collection: string;
  identity: string;
}) {
  return specs[file].describe(collection, identity);
}

function writeJson({
  value,
  spec,
  field,
  indent,
}: {
  value: unknown;
  spec: FileSpec;
  field: string | undefined;
  indent: string;
}): string {
  if (value === null || typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error('Catalog data must be finite JSON.');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    const text = JSON.stringify(value);
    return spec.escapeNonAscii
      ? text.replace(
          /[\u007f-￿]/g,
          (character) =>
            `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
        )
      : text;
  }
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    const items = value.map(
      (item: unknown) =>
        inner + writeJson({ value: item, spec, field, indent: inner }),
    );
    return `[\n${items.join(',\n')}\n${indent}]`;
  }
  if (!isEntry(value)) throw new Error('Catalog data must be JSON.');
  if (
    spec.inlineRefs &&
    Object.keys(value).length === 1 &&
    typeof value.ref === 'string'
  )
    return `{ "ref": ${JSON.stringify(value.ref)} }`;
  const isMap =
    field === undefined ? spec.rootIsMap : spec.maps.includes(field);
  const rank = (key: string) => {
    const index = isMap ? -1 : spec.fields.indexOf(key);
    return index === -1 ? spec.fields.length : index;
  };
  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort((left, right) => rank(left) - rank(right) || compare(left, right));
  if (!keys.length) return '{}';
  const members = keys.map(
    (key) =>
      `${inner}${writeJson({ value: key, spec, field: undefined, indent })}: ${writeJson(
        { value: value[key], spec, field: key, indent: inner },
      )}`,
  );
  return `{\n${members.join(',\n')}\n${indent}}`;
}

function checkSituationAliases(collections: CatalogCollections) {
  const claimed = new Map<string, string>();
  const problems: string[] = [];
  for (const [key, entry] of collections.get('situations') ?? [])
    for (const alias of isEntry(entry) && Array.isArray(entry.aliases)
      ? entry.aliases
      : []) {
      const normal = String(alias).toLowerCase();
      const owner = claimed.get(normal);
      if (owner !== undefined && owner !== key)
        problems.push(
          `Situation alias "${normal}" is claimed by both ${[owner, key].sort(compare).join(' and ')}.`,
        );
      claimed.set(normal, key);
    }
  return problems;
}

/**
 * Problems that make canonical order meaningful: the drafter maps wording to
 * the first Situation whose alias matches, so two keys must never share one.
 */
export function checkCatalogDataInvariants(
  file: CatalogDataFile,
  collections: CatalogCollections,
) {
  return file === 'curation' ? checkSituationAliases(collections) : [];
}

/** Writes a value as the canonical text of the named data file. */
export function formatCatalogData(file: CatalogDataFile, value: unknown) {
  const collections = splitCatalogData(file, value);
  const [problem] = checkCatalogDataInvariants(file, collections);
  if (problem) throw new Error(problem);
  return writeCatalogData(file, joinCatalogData(file, collections));
}

/**
 * Writes already-sorted data with the file's field order and escaping. Evidence
 * is written as the plain map its readers see; `writeCatalogData` encodes it.
 */
export function serializeCatalogData(file: CatalogDataFile, value: unknown) {
  return (
    writeJson({ value, spec: specs[file], field: undefined, indent: '' }) + '\n'
  );
}

/** Writes already-sorted data as the committed text of the named file. */
export function writeCatalogData(file: CatalogDataFile, value: unknown) {
  if (file !== 'evidence') return serializeCatalogData(file, value);
  if (!isEntry(value))
    throw new Error(`${catalogDataFiles.evidence} must be a JSON object.`);
  const encoded = encodeAttributionEvidence(value);
  return (
    writeJson({
      value: encoded,
      spec: encodedEvidenceSpec,
      field: undefined,
      indent: '',
    }) + '\n'
  );
}

/**
 * Parses a data file's text. Evidence refuses an ID or blob named twice, which
 * `JSON.parse` would silently drop.
 */
export function parseCatalogDataText(
  file: CatalogDataFile,
  text: string,
): unknown {
  return file === 'evidence'
    ? parseAttributionEvidenceText(text)
    : JSON.parse(text);
}

/** Lists the data files under `root` whose text is not canonical. */
export async function checkCatalogDataFiles(root: string) {
  const stale: string[] = [];
  for (const file of catalogDataFileNames) {
    const path = catalogDataFiles[file];
    const text = await readFile(join(root, path), 'utf8');
    if (formatCatalogData(file, parseCatalogDataText(file, text)) !== text)
      stale.push(path);
  }
  return stale;
}
