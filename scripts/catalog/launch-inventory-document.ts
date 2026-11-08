import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  launchManifestSchema,
  launchRowSchema,
  semanticContractSchema,
  type LaunchManifest,
} from './launch-inventory-schema.ts';

const tablesSchema = z.record(z.string(), z.record(z.string(), z.unknown()));
const referenceRowSchema = z
  .object({
    sources: z.array(z.string()),
    inventoryOwner: z.string(),
    implementationOwner: z.string(),
    publicTestOwner: z.string(),
    mechanisms: z.array(z.string()),
    admission: z.string(),
    structure: z.string(),
    contentEvidence: z.string(),
    noticeEvidence: z.string(),
    holds: z.array(z.object({ owner: z.string(), reason: z.string() })),
    research: z.array(z.object({ owner: z.string(), question: z.string() })),
  })
  .passthrough();
const documentSchema = z
  .object({
    encoding: z.literal('campaign-inventory-tables-v1'),
    contractTables: tablesSchema,
    rows: z.array(referenceRowSchema),
    edges: z.array(
      z
        .object({ evidence: z.union([z.string(), z.array(z.string())]) })
        .passthrough(),
    ),
  })
  .passthrough();
const textDocumentSchema = z
  .object({
    encoding: z.literal('campaign-inventory-tables-v2'),
    textTable: z.record(z.string(), z.string()),
  })
  .passthrough();

function mapDocument(
  value: unknown,
  text: (value: string) => unknown,
): unknown {
  if (typeof value === 'string') return text(value);
  if (Array.isArray(value)) return value.map((item) => mapDocument(item, text));
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        mapDocument(item, text),
      ]),
    );
  return value;
}

function expandText(value: unknown, table: Record<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => expandText(item, table));
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 1 && entries[0]?.[0] === '$inventoryText') {
      const id = z.string().parse(entries[0][1]);
      const text = table[id];
      if (text === undefined) throw new Error(`Missing inventory text ${id}.`);
      return text;
    }
    return Object.fromEntries(
      entries.map(([key, item]) => [key, expandText(item, table)]),
    );
  }
  return value;
}

function shareText(document: Record<string, unknown>) {
  const counts = new Map<string, number>();
  mapDocument(document, (text) => {
    if (text.length >= 128) counts.set(text, (counts.get(text) ?? 0) + 1);
    return text;
  });
  const textTable: Record<string, string> = {};
  const encoded = mapDocument(document, (text) => {
    if ((counts.get(text) ?? 0) < 2) return text;
    const id = createHash('sha256').update(text).digest('hex').slice(0, 24);
    if (textTable[id] !== undefined && textTable[id] !== text)
      throw new Error(`Inventory text hash collision ${id}.`);
    textTable[id] = text;
    return { $inventoryText: id };
  });
  if (!encoded || typeof encoded !== 'object')
    throw new Error('Invalid inventory document.');
  return { ...encoded, encoding: 'campaign-inventory-tables-v2', textTable };
}

/** Resolve the explicit contract tables; every returned row is a complete, validated row. */
export function parseLaunchInventory(value: unknown): LaunchManifest {
  value = expandLaunchInventoryDocument({ value, shouldShareRecords: true });
  if (!value || typeof value !== 'object' || !('encoding' in value))
    return launchManifestSchema.parse(value);
  if (value.encoding === 'campaign-inventory-tables-v2') {
    const { textTable, ...document } = textDocumentSchema.parse(value);
    return parseLaunchInventory(
      expandText(
        { ...document, encoding: 'campaign-inventory-tables-v1' },
        textTable,
      ),
    );
  }
  const {
    encoding: _encoding,
    contractTables,
    rows,
    edges,
    ...rest
  } = documentSchema.parse(value);
  const read = (table: string, id: string) => {
    const entry = contractTables[table]?.[id];
    if (entry === undefined)
      throw new Error(`Missing inventory contract ${table}/${id}.`);
    return entry;
  };
  return launchManifestSchema.parse({
    ...rest,
    edges: edges.map((edge) => ({
      ...edge,
      evidence:
        typeof edge.evidence === 'string'
          ? read('edgeEvidence', edge.evidence)
          : edge.evidence,
    })),
    rows: rows.map((row) => ({
      ...row,
      sources: row.sources.map((id) => read('sources', id)),
      inventoryOwner: read('owners', row.inventoryOwner),
      implementationOwner: read('owners', row.implementationOwner),
      publicTestOwner: read('owners', row.publicTestOwner),
      mechanisms: row.mechanisms.map((id) => read('mechanisms', id)),
      admission: read('observations', row.admission),
      structure: read('observations', row.structure),
      contentEvidence: read('observations', row.contentEvidence),
      noticeEvidence: read('observations', row.noticeEvidence),
      holds: row.holds.map((hold) => ({
        ...hold,
        owner: read('owners', hold.owner),
      })),
      research: row.research.map((research) => ({
        ...research,
        owner: read('owners', research.owner),
      })),
    })),
  });
}

const sharedDocumentSchema = z
  .strictObject({
    encoding: z.literal('campaign-inventory-records-v3'),
    records: z.literal('campaign-mvp-v1.records.json'),
    recordsSha256: z.string().regex(/^[a-f0-9]{64}$/),
    value: z.unknown(),
  })
  .refine(
    (document) =>
      Object.hasOwn(document, 'value') && document.value !== undefined,
    'Missing inventory document value.',
  );
const sharedRecordsSchema = z.strictObject({
  encoding: z.literal('campaign-inventory-records-v3'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  records: z.array(z.unknown()),
});
type SharedRecords = z.infer<typeof sharedRecordsSchema>;
let committedRecords: SharedRecords | undefined;
const expandedCommittedRecords = new Map<number, unknown>();
const recordReferenceSchema = z.strictObject({
  $record: z.number().int().nonnegative(),
});
const edgeLayoutSchema = z.strictObject({
  $inventoryEdge: z.tuple([z.unknown(), z.unknown(), z.unknown()]),
});
const edgeBodySchema = z.record(z.string(), z.unknown());
const projectionSchema = z.strictObject({
  $inventoryView: z.enum([
    'contract',
    'accounting',
    'checkpoint',
    'edge',
    'row-core',
    'row-advanced',
    'path-edge',
    'vertex',
  ]),
  value: z.unknown(),
});
type Projection = z.infer<typeof projectionSchema>['$inventoryView'];
const vertexSchema = launchRowSchema.pick({ key: true, kind: true }).strip();

// Preserve the existing inventory identity's array semantics, including predicate operands.
export function canonicalLaunchInventory(
  value: unknown,
  field?: string,
): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalLaunchInventory(item));
    return ['items', 'prerequisites', 'nativeRequirements'].includes(
      field ?? '',
    )
      ? items
      : items
          .map((item) => ({ item, key: JSON.stringify(item) }))
          .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
          .map(({ item }) => item);
  }
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonicalLaunchInventory(item, key)]),
    );
  return value;
}

export function auditMechanism({
  contract,
}: {
  contract: LaunchManifest['semanticContracts'][number];
}) {
  return {
    name: contract.name,
    disposition: contract.disposition,
    status: 'outstanding' as const,
    contract: contract.contract,
    evidence: contract.sources.map(
      ({ locator, rawSha256 }) => `${locator} sha256:${rawSha256}`,
    ),
  };
}

export function createLaunchAuditRow({
  contract,
  family,
}: {
  contract: LaunchManifest['semanticContracts'][number];
  family: 'core' | 'advanced';
}): LaunchManifest['rows'][number] {
  const evidence = auditMechanism({ contract }).evidence;
  const observation = { state: 'unreviewed' as const, evidence };
  const discrepancyOwner = {
    issue: 736,
    responsibility: 'Source correspondence must be resolved before reliance',
    evidence,
  };
  return {
    key: contract.id,
    catalogKey: null,
    kind: 'rule',
    name: contract.name,
    requirement: contract.scope === 'required' ? 'required' : 'optional',
    sources: contract.sources,
    inventoryOwner: {
      issue: 768,
      responsibility: `Source-owned ${family} semantic requirement; separate from playable identity`,
      evidence,
    },
    implementationOwner: contract.implementationOwner,
    publicTestOwner: contract.publicTestOwner,
    mechanisms: [auditMechanism({ contract })],
    admission: observation,
    structure: observation,
    contentEvidence: observation,
    noticeEvidence: observation,
    holds: [
      {
        owner:
          contract.qualification === 'held discrepancy'
            ? discrepancyOwner
            : contract.implementationOwner,
        reason:
          contract.qualification === 'held discrepancy'
            ? `Unresolved source discrepancy: ${contract.contract}`
            : 'Source-derived contract requires downstream implementation and public saved-sheet proof; inventory does not admit playable content.',
      },
    ],
    research: [],
  };
}

function projectInventoryRecord(kind: Projection, value: unknown): unknown {
  if (kind === 'path-edge') {
    const { evidence: _evidence, ...edge } =
      launchManifestSchema.shape.edges.element.parse(value);
    return edge;
  }
  if (kind === 'vertex') return vertexSchema.parse(value);
  if (kind === 'row-core' || kind === 'row-advanced')
    return launchRowSchema.parse(
      canonicalLaunchInventory(
        createLaunchAuditRow({
          contract: semanticContractSchema.parse(value),
          family: kind === 'row-core' ? 'core' : 'advanced',
        }),
      ),
    );
  const schema =
    kind === 'contract'
      ? semanticContractSchema
      : kind === 'accounting'
        ? launchManifestSchema.shape.sourceAccounting.unwrap().element
        : kind === 'checkpoint'
          ? launchManifestSchema.shape.checkpoints.element
          : launchManifestSchema.shape.edges.element;
  return schema.parse(canonicalLaunchInventory(schema.parse(value)));
}

function recordId(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 24);
}

function sharedRecordsHash(records: unknown[]) {
  return createHash('sha256').update(JSON.stringify(records)).digest('hex');
}

function parseSharedRecords(value: unknown) {
  const table = sharedRecordsSchema.parse(value);
  if (sharedRecordsHash(table.records) !== table.sha256)
    throw new Error('Changed inventory records dictionary.');
  return table;
}

function readCommittedRecords() {
  committedRecords ??= parseSharedRecords(
    JSON.parse(
      readFileSync(
        new URL('./scopes/campaign-mvp-v1.records.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  return committedRecords;
}

/** Decode any inventory projection, separately from its domain/schema validation. */
export function parseLaunchInventoryDocument(
  value: unknown,
  suppliedRecords?: unknown,
): unknown {
  return expandLaunchInventoryDocument({ value, suppliedRecords });
}

function expandLaunchInventoryDocument({
  value,
  suppliedRecords,
  shouldShareRecords = false,
}: {
  value: unknown;
  suppliedRecords?: unknown;
  shouldShareRecords?: boolean;
}): unknown {
  if (
    !value ||
    typeof value !== 'object' ||
    !('encoding' in value) ||
    value.encoding !== 'campaign-inventory-records-v3'
  )
    return value;
  const document = sharedDocumentSchema.parse(value);
  const table =
    suppliedRecords === undefined
      ? readCommittedRecords()
      : parseSharedRecords(suppliedRecords);
  if (table.sha256 !== document.recordsSha256)
    throw new Error('Changed inventory records dictionary binding.');
  const { records } = table;
  // Only the private committed dictionary can share expanded records. The
  // manifest schema below copies every object before exposing it to a caller.
  const expandedRecords =
    shouldShareRecords && suppliedRecords === undefined
      ? expandedCommittedRecords
      : undefined;
  const active = new Set<number>();
  const expand = (item: unknown, depth: number): unknown => {
    if (depth > 256)
      throw new Error('Inventory reference nesting exceeds 256.');
    if (Array.isArray(item))
      return item.map((entry) => expand(entry, depth + 1));
    if (item === null || typeof item !== 'object') return item;
    if ('$inventoryView' in item) {
      const view = projectionSchema.parse(item);
      return projectInventoryRecord(
        view.$inventoryView,
        expand(view.value, depth + 1),
      );
    }
    if ('$inventoryEdge' in item) {
      const edge = edgeLayoutSchema.parse(item).$inventoryEdge;
      const body = edgeBodySchema.parse(expand(edge[2], depth + 1));
      if ('from' in body || 'to' in body)
        throw new Error('Invalid inventory edge contract.');
      return {
        from: expand(edge[0], depth + 1),
        to: expand(edge[1], depth + 1),
        ...body,
      };
    }
    if ('$record' in item) {
      const id = recordReferenceSchema.parse(item).$record;
      const record = records[id];
      if (record === undefined)
        throw new Error(`Missing inventory record ${id}.`);
      if (active.has(id)) throw new Error(`Cyclic inventory record ${id}.`);
      if (expandedRecords?.has(id)) return expandedRecords.get(id);
      active.add(id);
      const result = expand(record, depth + 1);
      active.delete(id);
      expandedRecords?.set(id, result);
      return result;
    }
    return Object.fromEntries(
      Object.entries(item).map(([key, entry]) => [
        key,
        expand(entry, depth + 1),
      ]),
    );
  };
  return expand(document.value, 0);
}

/** Share repeated records, collections and text across the seven inventory projections.
 * Independent authorities retain their own references; no expectation is read from a submitted manifest.
 */
export function launchInventoryDocuments(
  entries: Iterable<readonly [string, unknown]>,
) {
  const candidates = new Map<string, { value: unknown; count: number }>();
  const projections = new Map<string, { kind: Projection; value: unknown }>();
  const intern = (value: unknown): unknown => {
    const bytes = JSON.stringify(value);
    if (bytes.length < 128) return value;
    const id = recordId(value);
    const prior = candidates.get(id);
    if (prior && JSON.stringify(prior.value) !== bytes)
      throw new Error(`Inventory record hash collision ${id}.`);
    if (prior) prior.count++;
    else candidates.set(id, { value, count: 1 });
    return { $inventoryRecord: id };
  };
  const encode = (value: unknown, useProjections: boolean): unknown => {
    if (Array.isArray(value))
      return intern(value.map((item) => encode(item, useProjections)));
    if (value !== null && typeof value === 'object') {
      if (
        '$record' in value ||
        '$inventoryRecord' in value ||
        '$inventoryView' in value ||
        '$inventoryEdge' in value
      )
        throw new Error('Reserved inventory reference in expanded input.');
      const projection = useProjections
        ? projections.get(recordId(value))
        : undefined;
      if (
        projection &&
        JSON.stringify(
          projectInventoryRecord(projection.kind, projection.value),
        ) === JSON.stringify(value)
      )
        return intern({
          $inventoryView: projection.kind,
          value: encode(
            projection.value,
            projection.kind === 'path-edge' || projection.kind === 'vertex',
          ),
        });
      if (
        'from' in value &&
        'to' in value &&
        'reason' in value &&
        'condition' in value &&
        'kind' in value
      ) {
        const { from, to, ...body } = value;
        return intern({
          $inventoryEdge: [
            encode(from, false),
            encode(to, false),
            encode(body, false),
          ],
        });
      }
      const entries = Object.entries(value);
      return intern(
        Object.fromEntries(
          entries.map(([key, item]) => [key, encode(item, useProjections)]),
        ),
      );
    }
    return typeof value === 'string' ? intern(value) : value;
  };
  const encoded = new Map<string, unknown>();
  for (const [name, value] of entries) {
    if (encoded.has(name))
      throw new Error(`Duplicate inventory document ${name}.`);
    const family =
      name === 'campaign-mvp-v1.core.json'
        ? 'core'
        : name === 'campaign-mvp-v1.advanced.json'
          ? 'advanced'
          : null;
    if (family) {
      const audit = z
        .object({
          contracts: z.array(z.unknown()),
          accounting: z.array(z.unknown()),
          edges: z.array(z.unknown()),
          citations: z.array(z.unknown()),
        })
        .parse(value);
      const remember = (kind: Projection, value: unknown) =>
        projections.set(recordId(projectInventoryRecord(kind, value)), {
          kind,
          value,
        });
      for (const contract of audit.contracts) {
        remember('contract', contract);
        remember(family === 'core' ? 'row-core' : 'row-advanced', contract);
      }
      for (const entry of audit.accounting) remember('accounting', entry);
      for (const edge of [...audit.edges, ...audit.citations])
        remember('edge', edge);
    }
    if (name === 'campaign-mvp-v1.checkpoints.json')
      for (const checkpoint of z.array(z.unknown()).parse(value))
        projections.set(
          recordId(projectInventoryRecord('checkpoint', checkpoint)),
          { kind: 'checkpoint', value: checkpoint },
        );
    if (name === 'campaign-mvp-v1.json') {
      const manifest = z
        .object({ edges: z.array(z.unknown()), rows: z.array(z.unknown()) })
        .parse(value);
      for (const edge of manifest.edges)
        projections.set(recordId(projectInventoryRecord('path-edge', edge)), {
          kind: 'path-edge',
          value: edge,
        });
      for (const row of manifest.rows)
        projections.set(recordId(projectInventoryRecord('vertex', row)), {
          kind: 'vertex',
          value: row,
        });
    }
    encoded.set(
      name,
      encode(
        value,
        name === 'campaign-mvp-v1.json' ||
          name === 'campaign-mvp-v1.notices.json',
      ),
    );
  }
  const records: Record<string, unknown> = {};
  const rewritten = new Map<string, unknown>();
  const compact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(compact);
    if (value === null || typeof value !== 'object') return value;
    if ('$inventoryRecord' in value) {
      const id = z.string().parse(value.$inventoryRecord);
      if (rewritten.has(id)) return rewritten.get(id);
      const candidate = candidates.get(id);
      if (!candidate) throw new Error(`Missing inventory candidate ${id}.`);
      const result = compact(candidate.value);
      if (candidate.count < 2) {
        rewritten.set(id, result);
        return result;
      }
      const sharedId = recordId(result);
      if (
        records[sharedId] !== undefined &&
        JSON.stringify(records[sharedId]) !== JSON.stringify(result)
      )
        throw new Error(`Inventory compact record hash collision ${sharedId}.`);
      records[sharedId] = result;
      const reference = { $inventoryRecord: sharedId };
      rewritten.set(id, reference);
      return reference;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, compact(item)]),
    );
  };
  const documents = Object.fromEntries(
    [...encoded].map(([name, value]) => [
      name,
      {
        encoding: 'campaign-inventory-records-v3' as const,
        records: 'campaign-mvp-v1.records.json' as const,
        value: compact(value),
      },
    ]),
  );
  const ordered = Object.entries(records).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const indexes = new Map(ordered.map(([id], index) => [id, index]));
  const numberReferences = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(numberReferences);
    if (value === null || typeof value !== 'object') return value;
    if ('$inventoryRecord' in value) {
      const id = z.string().parse(value.$inventoryRecord);
      const index = indexes.get(id);
      if (index === undefined)
        throw new Error(`Missing compact inventory record ${id}.`);
      return { $record: index };
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, numberReferences(item)]),
    );
  };
  const shared = ordered.map(([, value]) => numberReferences(value));
  const sha256 = sharedRecordsHash(shared);
  return {
    documents: Object.fromEntries(
      Object.entries(documents).map(([name, document]) => [
        name,
        {
          ...document,
          recordsSha256: sha256,
          value: numberReferences(document.value),
        },
      ]),
    ),
    records: {
      encoding: 'campaign-inventory-records-v3' as const,
      sha256,
      records: shared,
    },
  };
}

/** One readable JSON record per line; layouts and shared values remain ordinary JSON. */
export function serializeLaunchInventoryDocument(value: unknown) {
  const format = (item: unknown, indent: string): string => {
    const nested = `${indent}  `;
    if (Array.isArray(item))
      return item.length === 0
        ? '[]'
        : `[\n${item.map((entry) => `${nested}${JSON.stringify(entry)}`).join(',\n')}\n${indent}]`;
    if (item !== null && typeof item === 'object')
      return `{\n${Object.entries(item)
        .map(
          ([key, entry]) =>
            `${nested}${JSON.stringify(key)}: ${format(entry, nested)}`,
        )
        .join(',\n')}\n${indent}}`;
    const bytes = JSON.stringify(item);
    if (bytes === undefined) throw new Error('Invalid inventory JSON value.');
    return bytes;
  };
  return `${format(value, '')}\n`;
}

/** Share repeated contracts without weakening the public per-record contract. No facts are discarded. */
export function launchInventoryDocument(manifest: LaunchManifest) {
  const tables: z.infer<typeof tablesSchema> = {
    owners: {},
    sources: {},
    mechanisms: {},
    observations: {},
    edgeEvidence: {},
  };
  const intern = (table: string, value: unknown) => {
    const bytes = JSON.stringify(value);
    const id = createHash('sha256').update(bytes).digest('hex').slice(0, 24);
    const entries = tables[table];
    if (!entries) throw new Error(`Unknown inventory contract table ${table}.`);
    if (entries[id] !== undefined && JSON.stringify(entries[id]) !== bytes)
      throw new Error(`Inventory contract hash collision ${table}/${id}.`);
    entries[id] = value;
    return id;
  };
  const rows = manifest.rows.map((row) => ({
    ...row,
    sources: row.sources.map((source) => intern('sources', source)),
    inventoryOwner: intern('owners', row.inventoryOwner),
    implementationOwner: intern('owners', row.implementationOwner),
    publicTestOwner: intern('owners', row.publicTestOwner),
    mechanisms: row.mechanisms.map((mechanism) =>
      intern('mechanisms', mechanism),
    ),
    admission: intern('observations', row.admission),
    structure: intern('observations', row.structure),
    contentEvidence: intern('observations', row.contentEvidence),
    noticeEvidence: intern('observations', row.noticeEvidence),
    holds: row.holds.map((hold) => ({
      ...hold,
      owner: intern('owners', hold.owner),
    })),
    research: row.research.map((research) => ({
      ...research,
      owner: intern('owners', research.owner),
    })),
  }));
  return shareText({
    ...manifest,
    encoding: 'campaign-inventory-tables-v1',
    contractTables: tables,
    rows,
    edges: manifest.edges.map((edge) => ({
      ...edge,
      evidence: intern('edgeEvidence', edge.evidence),
    })),
  });
}
