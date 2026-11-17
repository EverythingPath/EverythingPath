// The SK-2 migration proof (stable-key design, section F, "Reviewing SK-2
// without reading it"): given the parent commit, whose scope files are
// positional (v3), and the migration commit, whose files are keyed (v4), it
// prints a transcript showing that the migration stores the same information.
//
//   pnpm -s catalog:stable-key-proof <parent> <commit>
//
// The conversion check rebuilds v4 from v3 here, without the encoder, so the
// encoder's output is compared with an independent derivation. Identities are
// computed by this checkout's readers over each revision's documents.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const v3 = 'campaign-inventory-records-v3';
const v4 = 'campaign-inventory-records-v4';
const scopes = 'scripts/catalog/scopes';
export const recordsFile = 'campaign-mvp-v1.records.json';
/** The writer's document order (scripts/catalog-launch-inventory.ts). */
export const scopeDocuments = [
  'advanced',
  'authority',
  'checkpoints',
  'companions',
  'core',
  '',
  'notices',
].map((name) => `campaign-mvp-v1${name ? `.${name}` : ''}.json`);
const projectionFile = 'campaign-mvp-v1.verification.json';
const pinFile = 'tests/catalog/launch-document.test.ts';

/** Scope file name to its text, for the 7 documents and the records dictionary. */
export type ScopeFiles = ReadonlyMap<string, string>;
export type Proof = { lines: string[]; failures: string[] };
type Reference = '$record' | '$r';

const positionalDocument = z.object({
  encoding: z.literal(v3),
  recordsSha256: z.string(),
  value: z.unknown(),
});
const positionalRecords = z.object({
  encoding: z.literal(v3),
  sha256: z.string(),
  records: z.array(z.unknown()),
});
const keyedDocument = z.object({ encoding: z.literal(v4), value: z.unknown() });
const keyedRecords = z.object({
  encoding: z.literal(v4),
  records: z.record(z.string(), z.unknown()),
});
const projectionSchema = z.looseObject({
  binding: z.looseObject({ inputs: z.record(z.string(), z.string()) }),
  rows: z.array(z.unknown()),
});

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256(text: string | Buffer) {
  return createHash('sha256').update(text).digest('hex');
}

function proof() {
  const result: Proof = { lines: [], failures: [] };
  const check = (holds: boolean, line: string) => {
    result.lines.push(`${holds ? 'ok  ' : 'FAIL'} ${line}`);
    if (!holds) result.failures.push(line);
  };
  return { result, check, note: (line: string) => result.lines.push(line) };
}

/** The target of a value that is exactly one reference under `name`, else undefined. */
function referenceOf(value: unknown, name: Reference) {
  if (!isObject(value)) return undefined;
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === name ? value[name] : undefined;
}

function mapReferences(
  value: unknown,
  name: Reference,
  replace: (target: unknown) => unknown,
): unknown {
  const target = referenceOf(value, name);
  if (target !== undefined) return replace(target);
  if (Array.isArray(value))
    return value.map((item) => mapReferences(item, name, replace));
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      mapReferences(item, name, replace),
    ]),
  );
}

function countReferences(value: unknown, name: Reference): number {
  if (referenceOf(value, name) !== undefined) return 1;
  const items = Array.isArray(value)
    ? value
    : isObject(value)
      ? Object.values(value)
      : [];
  let sum = 0;
  for (const item of items) sum += countReferences(item, name);
  return sum;
}

/** SHA-256 of `JSON.stringify` of a value, written in pieces so no expansion is held whole. */
export function streamedJsonSha256(
  value: unknown,
  expand: (item: unknown) => unknown = (item) => item,
) {
  const hash = createHash('sha256');
  let pending: string[] = [];
  let size = 0;
  const write = (text: string) => {
    pending.push(text);
    size += text.length;
    if (size < 1 << 20) return;
    hash.update(pending.join(''));
    pending = [];
    size = 0;
  };
  const walk = (raw: unknown, depth: number) => {
    if (depth > 1024) throw new Error('Expansion nesting exceeds 1024.');
    const item = expand(raw);
    if (Array.isArray(item)) {
      write('[');
      item.forEach((entry, index) => {
        if (index) write(',');
        walk(entry, depth + 1);
      });
      write(']');
    } else if (isObject(item)) {
      write('{');
      const entries = Object.entries(item).filter(([, e]) => e !== undefined);
      entries.forEach(([key, entry], index) => {
        write(`${index ? ',' : ''}${JSON.stringify(key)}:`);
        walk(entry, depth + 1);
      });
      write('}');
    } else {
      const text = JSON.stringify(item);
      if (text === undefined) throw new Error('Invalid JSON value.');
      write(text);
    }
  };
  walk(value, 0);
  hash.update(pending.join(''));
  return hash.digest('hex');
}

/** One JSON value per line inside the top level's arrays and maps, as both encodings store them. */
function formatScopeFile(value: Record<string, unknown>) {
  const lines = (brackets: '[]' | '{}', items: string[], indent: string) =>
    items.length === 0
      ? brackets
      : `${brackets[0]}\n${items.map((item) => `${indent}  ${item}`).join(',\n')}\n${indent}${brackets[1]}`;
  const format = (item: unknown, indent: string, records: boolean): string => {
    if (Array.isArray(item))
      return lines(
        '[]',
        item.map((entry) => JSON.stringify(entry)),
        indent,
      );
    if (!isObject(item)) return JSON.stringify(item);
    const entries = Object.entries(item);
    // Only the keyed dictionary's `records` map is one record per line.
    if (records)
      return lines(
        '{}',
        entries.map(
          ([key, e]) => `${JSON.stringify(key)}: ${JSON.stringify(e)}`,
        ),
        indent,
      );
    return `{\n${entries
      .map(
        ([key, e]) =>
          `${indent}  ${JSON.stringify(key)}: ${format(e, `${indent}  `, false)}`,
      )
      .join(',\n')}\n${indent}}`;
  };
  return `{\n${Object.entries(value)
    .map(
      ([key, entry]) =>
        `  ${JSON.stringify(key)}: ${format(entry, '  ', key === 'records' && isObject(entry))}`,
    )
    .join(',\n')}\n}\n`;
}

function read(files: ScopeFiles, name: string): unknown {
  const text = files.get(name);
  if (text === undefined) throw new Error(`Missing scope file ${name}.`);
  return JSON.parse(text);
}

function positional(files: ScopeFiles) {
  return {
    table: positionalRecords.parse(read(files, recordsFile)),
    documents: new Map(
      scopeDocuments.map((name) => [
        name,
        positionalDocument.parse(read(files, name)),
      ]),
    ),
  };
}
type Positional = ReturnType<typeof positional>;

function keyed(files: ScopeFiles) {
  return {
    table: keyedRecords.parse(read(files, recordsFile)),
    documents: new Map(
      scopeDocuments.map((name) => [
        name,
        keyedDocument.parse(read(files, name)),
      ]),
    ),
  };
}
type Keyed = ReturnType<typeof keyed>;

function position(records: unknown[], reference: unknown) {
  if (
    typeof reference !== 'number' ||
    !Number.isInteger(reference) ||
    reference < 0 ||
    reference >= records.length
  )
    throw new Error(`Dangling v3 reference ${JSON.stringify(reference)}.`);
  return reference;
}

/** Rebuild each v3 record's 24-hex content id bottom-up, as the encoder assigned them before numbering. */
function contentIds(records: unknown[]) {
  const ids: string[] = [];
  const resolving = new Set<number>();
  const idOf = (index: number): string => {
    const known = ids[index];
    if (known !== undefined) return known;
    if (resolving.has(index)) throw new Error(`Cyclic v3 record ${index}.`);
    resolving.add(index);
    const placeholder = mapReferences(records[index], '$record', (target) => ({
      $inventoryRecord: idOf(position(records, target)),
    }));
    resolving.delete(index);
    const id = sha256(JSON.stringify(placeholder)).slice(0, 24);
    ids[index] = id;
    return id;
  };
  records.forEach((_, index) => idOf(index));
  return ids;
}

/** 1. The dictionary hash binds, and the content ids are the stored order. */
function orderProof({ table, documents }: Positional) {
  const { result, check, note } = proof();
  note('1. v3 order');
  check(
    sha256(JSON.stringify(table.records)) === table.sha256 &&
      [...documents.values()].every(
        ({ recordsSha256 }) => recordsSha256 === table.sha256,
      ),
    `v3 dictionary hash ${table.sha256} matches its records and every document's recordsSha256`,
  );
  const ids = contentIds(table.records);
  check(
    ids.every((id, index) => index === 0 || (ids[index - 1] ?? '') < id),
    `rebuilding v3's ${ids.length} content ids reproduces its order exactly (strictly increasing)`,
  );
  return result;
}

/** v4 from v3: a record's key is the first 64 bits of SHA-256 over its stored v4 JSON, assigned bottom-up. */
function convert({ table, documents }: Positional) {
  const keys: string[] = [];
  const stored = new Map<string, unknown>();
  const rekey = (value: unknown) =>
    mapReferences(value, '$record', (target) => ({
      $r: keyOf(position(table.records, target)),
    }));
  const keyOf = (index: number): string => {
    const known = keys[index];
    if (known !== undefined) return known;
    const record = rekey(table.records[index]);
    const key = createHash('sha256')
      .update(JSON.stringify(record))
      .digest()
      .subarray(0, 8)
      .toString('base64url');
    keys[index] = key;
    stored.set(key, record);
    return key;
  };
  table.records.forEach((_, index) => keyOf(index));
  const files = new Map<string, string>();
  files.set(
    recordsFile,
    formatScopeFile({
      encoding: v4,
      records: Object.fromEntries(
        [...stored].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    }),
  );
  for (const [name, { value }] of documents)
    files.set(
      name,
      formatScopeFile({
        encoding: v4,
        records: recordsFile,
        value: rekey(value),
      }),
    );
  return { files, keys: stored.size };
}

/** 2. The independent conversion gives the commit's bytes; counts are equal. */
function conversionProof(old: Positional, next: Keyed, after: ScopeFiles) {
  const { result, check, note } = proof();
  note('2. conversion and counts');
  const records = old.table.records.length;
  const converted = convert(old);
  check(
    converted.keys === records,
    `the ${records} v3 records take ${converted.keys} distinct 64-bit keys (no collision)`,
  );
  for (const name of [...scopeDocuments, recordsFile])
    check(
      converted.files.get(name) === after.get(name),
      `${name}: v3 converted independently equals the commit's bytes (sha256 ${sha256(after.get(name) ?? '')})`,
    );
  const keyedCount = Object.keys(next.table.records).length;
  check(
    keyedCount === records,
    `record count: v3 ${records}, v4 ${keyedCount}`,
  );
  const count = (
    table: unknown,
    documents: { value: unknown }[],
    name: Reference,
  ) =>
    documents.reduce(
      (sum, { value }) => sum + countReferences(value, name),
      countReferences(table, name),
    );
  const oldReferences = count(
    old.table.records,
    [...old.documents.values()],
    '$record',
  );
  const newReferences = count(
    Object.values(next.table.records),
    [...next.documents.values()],
    '$r',
  );
  check(
    oldReferences === newReferences,
    `reference count: v3 ${oldReferences} $record, v4 ${newReferences} $r`,
  );
  return result;
}

/** Follow a value's chain of references to the first value that is not one. */
function expander(name: Reference, lookup: (target: unknown) => unknown) {
  return (item: unknown) => {
    let current = item;
    for (let hops = 0; hops <= 256; hops++) {
      const target = referenceOf(current, name);
      if (target === undefined) return current;
      current = lookup(target);
    }
    throw new Error('Reference chain exceeds 256.');
  };
}

/** 3. Every document's references, expanded in place, hash the same in both forms. */
function expansionProof(old: Positional, next: Keyed) {
  const { result, check, note } = proof();
  note('3. reference expansion (independent of the decoder)');
  const expandOld = expander(
    '$record',
    (target) => old.table.records[position(old.table.records, target)],
  );
  const expandNew = expander('$r', (target) => {
    if (
      typeof target !== 'string' ||
      !Object.hasOwn(next.table.records, target)
    )
      throw new Error(`Dangling v4 reference ${JSON.stringify(target)}.`);
    return next.table.records[target];
  });
  for (const name of scopeDocuments) {
    const a = streamedJsonSha256(old.documents.get(name)?.value, expandOld);
    const b = streamedJsonSha256(next.documents.get(name)?.value, expandNew);
    check(a === b, `${name}: expansion sha256 v3 ${a}, v4 ${b}`);
  }
  return result;
}

function merge(sections: Proof[]): Proof {
  return {
    lines: sections.flatMap(({ lines }) => lines),
    failures: sections.flatMap(({ failures }) => failures),
  };
}

/**
 * Checks 1-3 of the transcript over the scope files alone: v3's content ids
 * give its order, an independent v3-to-v4 conversion gives the v4 bytes,
 * counts are equal and every document expands to the same JSON.
 */
export function encodingProof({
  before,
  after,
}: {
  before: ScopeFiles;
  after: ScopeFiles;
}): Proof {
  const old = positional(before);
  const next = keyed(after);
  return merge([
    orderProof(old),
    conversionProof(old, next, after),
    expansionProof(old, next),
  ]);
}

/**
 * Check 5: the projection moves only in `binding.inputs` hashes, each of which
 * is the changed file's blob hash at either revision; its rows are unchanged.
 */
export function projectionProof({
  before,
  after,
  blobSha256,
}: {
  before: string;
  after: string;
  blobSha256: (revision: 'before' | 'after', path: string) => string | null;
}): Proof {
  const { result, check } = proof();
  const a = projectionSchema.parse(JSON.parse(before));
  const b = projectionSchema.parse(JSON.parse(after));
  const withoutInputs = ({
    binding: { inputs: _, ...binding },
    ...rest
  }: z.infer<typeof projectionSchema>) => JSON.stringify({ ...rest, binding });
  check(
    withoutInputs(a) === withoutInputs(b),
    'everything outside binding.inputs is equal (identities, fingerprints, packages, proofs)',
  );
  check(
    JSON.stringify(a.rows) === JSON.stringify(b.rows),
    `the ${b.rows.length} rows are equal`,
  );
  const [oldInputs, newInputs] = [a.binding.inputs, b.binding.inputs];
  const names = Object.keys(newInputs);
  check(
    Object.keys(oldInputs).join('\n') === names.join('\n'),
    `the same ${names.length} inputs are bound, in the same order`,
  );
  const moved = names.filter((name) => oldInputs[name] !== newInputs[name]);
  for (const name of moved)
    check(
      oldInputs[name] === blobSha256('before', name) &&
        newInputs[name] === blobSha256('after', name),
      `input ${name} moves with its file: ${oldInputs[name]} -> ${newInputs[name]}`,
    );
  const oldLines = before.split('\n');
  const newLines = after.split('\n');
  const changed = newLines.filter((line, index) => line !== oldLines[index]);
  const inputLines = new Set(
    moved.map((name) => `      ${JSON.stringify(name)}: "${newInputs[name]}",`),
  );
  check(
    oldLines.length === newLines.length &&
      changed.length === moved.length &&
      changed.every(
        (line) => inputLines.has(line) || inputLines.has(`${line},`),
      ),
    `the text diff is ${changed.length} changed lines of ${newLines.length}, each a moved input-hash line`,
  );
  return result;
}

function git(args: string[]) {
  return execFileSync('git', args, { encoding: 'buffer', maxBuffer: 1 << 30 });
}

function blob(revision: string, path: string) {
  try {
    return git(['show', `${revision}:${path}`]);
  } catch {
    return null;
  }
}

function revisionFiles(revision: string): ScopeFiles {
  return new Map(
    [...scopeDocuments, recordsFile].map((name) => {
      const content = blob(revision, `${scopes}/${name}`);
      if (content === null) throw new Error(`${revision} has no ${name}.`);
      return [name, content.toString('utf8')];
    }),
  );
}

/** The CLI pin's literal summary in tests/catalog/launch-document.test.ts. */
function pinnedSummary(text: string): Record<string, unknown> {
  const start = text.lastIndexOf('expect(JSON.parse(output)).toEqual({');
  const end = text.indexOf('});', start);
  if (start < 0 || end < 0) throw new Error('No CLI pin.');
  const body = text.slice(start, end).replace(/\s+/g, '');
  const summary: Record<string, unknown> = {};
  for (const [, key = '', raw = ''] of body.matchAll(
    /(\w+):('[^']*'|[^,{}]+)/g,
  )) {
    const value: unknown = raw.startsWith("'")
      ? raw.slice(1, -1)
      : JSON.parse(raw);
    summary[key] = value;
  }
  return summary;
}

async function decoders() {
  const { parseLaunchInventoryDocument, launchInventoryRecordsBinding } =
    await import('./launch-inventory-document.ts');
  const { inspectLaunchInventory, launchScopeIdentity } =
    await import('./launch-inventory.ts');
  const { resolveReleaseScope } = await import('./release-scope.ts');
  return (files: ScopeFiles) => {
    const records = read(files, recordsFile);
    const decoded = new Map(
      scopeDocuments.map((name) => [
        name,
        streamedJsonSha256(
          parseLaunchInventoryDocument(read(files, name), records),
        ),
      ]),
    );
    const text = files.get('campaign-mvp-v1.json') ?? '';
    const stored: unknown = JSON.parse(text);
    const manifest = parseLaunchInventoryDocument(stored, records);
    const report = inspectLaunchInventory(manifest);
    const { binding } = resolveReleaseScope({
      version: 'campaign-mvp-v1',
      document: {
        manifest,
        documentSha256: sha256(text),
        recordsSha256: launchInventoryRecordsBinding(stored),
      },
    });
    // The CLI's summary (scripts/catalog-launch-inventory.ts).
    const summary = {
      version: report.scopeVersion,
      identity: report.identity,
      roots: report.roots.length,
      checkpoints: report.checkpoints.length,
      rows: report.rowCount,
      pools: report.poolCount,
      inventoryErrors: report.inventoryErrors.length,
      outstandingRequirements: report.launchFailures.length,
      genericComplete: report.genericComplete,
      launchQualified: report.launchQualified,
      party: report.party.status,
    };
    return {
      decoded,
      identity: launchScopeIdentity(manifest),
      binding,
      summary,
    };
  };
}

/** 3b and 4: this checkout's reader decodes both forms alike, and no identity moves. */
async function identityProof(
  files: { before: ScopeFiles; after: ScopeFiles },
  pins: { before: Buffer | null; after: Buffer | null },
) {
  const { result, check, note } = proof();
  const side = await decoders();
  note("3b. full decoding by this checkout's reader (views included)");
  const a = side(files.before);
  const b = side(files.after);
  for (const name of scopeDocuments)
    check(
      a.decoded.get(name) === b.decoded.get(name),
      `${name}: decoded sha256 v3 ${a.decoded.get(name)}, v4 ${b.decoded.get(name)}`,
    );
  note('4. identities');
  check(
    a.identity === b.identity,
    `launchScopeIdentity: v3 ${a.identity}, v4 ${b.identity}`,
  );
  check(
    a.binding.launchScopeIdentity === b.binding.launchScopeIdentity &&
      a.binding.closureFingerprint === b.binding.closureFingerprint &&
      a.binding.roots.join('\n') === b.binding.roots.join('\n'),
    `release binding: launchScopeIdentity ${b.binding.launchScopeIdentity}, closureFingerprint ${b.binding.closureFingerprint}, ${b.binding.roots.length} roots, unchanged`,
  );
  note(
    `     moves as designed: documentSha256 ${a.binding.documentSha256} -> ${b.binding.documentSha256}; recordsSha256 ${a.binding.recordsSha256} -> ${b.binding.recordsSha256}`,
  );
  check(
    JSON.stringify(a.summary) === JSON.stringify(b.summary),
    `CLI summary equal in both forms: ${JSON.stringify(b.summary)}`,
  );
  check(
    pins.before !== null &&
      pins.after !== null &&
      pins.before.equals(pins.after),
    `${pinFile} is byte-identical at both revisions (sha256 ${sha256(pins.after ?? '')})`,
  );
  const pin = pinnedSummary(pins.after?.toString('utf8') ?? '');
  check(
    JSON.stringify(pin) === JSON.stringify(b.summary),
    `the CLI pin equals the computed summary (identity ${b.summary.identity})`,
  );
  return result;
}

function projectionSection(from: string, to: string) {
  const projection = (revision: string) =>
    blob(revision, `${scopes}/${projectionFile}`)?.toString('utf8') ?? '';
  const section = projectionProof({
    before: projection(from),
    after: projection(to),
    blobSha256: (side, path) => {
      const content = blob(side === 'before' ? from : to, path);
      return content === null ? null : sha256(content);
    },
  });
  return {
    ...section,
    lines: ['5. verification projection', ...section.lines],
  };
}

function diffstat(from: string, to: string): Proof {
  const numstat = git(['diff', '--numstat', '--no-renames', from, to])
    .toString()
    .trim()
    .split('\n');
  return {
    lines: [
      '7. diffstat (added, deleted, path)',
      ...numstat.map((line) => `     ${line}`),
    ],
    failures: [],
  };
}

async function main() {
  const [parent, commit] = process.argv.slice(2);
  if (!parent || !commit)
    throw new Error(
      'Usage: pnpm -s catalog:stable-key-proof <parent> <commit>',
    );
  const resolve = (revision: string) =>
    git(['rev-parse', '--verify', `${revision}^{commit}`])
      .toString()
      .trim();
  const [from, to] = [resolve(parent), resolve(commit)];
  const files = { before: revisionFiles(from), after: revisionFiles(to) };
  const pins = { before: blob(from, pinFile), after: blob(to, pinFile) };
  const all = merge([
    {
      lines: [
        'stable-key migration proof (SK-2)',
        `parent ${from}`,
        `commit ${to}`,
      ],
      failures: [],
    },
    encodingProof(files),
    await identityProof(files, pins),
    projectionSection(from, to),
    diffstat(from, to),
  ]);
  const verdict = all.failures.length
    ? `FAILED: ${all.failures.length} checks`
    : 'all checks passed';
  process.stdout.write(`${[...all.lines, verdict].join('\n')}\n`);
  if (all.failures.length) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
