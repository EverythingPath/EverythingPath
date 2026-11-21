import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * A batch legal record (`scripts/catalog/legal/<batch>.json`) stores each
 * repeated entry, then each repeated text, once inside its own file (owner
 * decision 2026-11-15, option b). Only the review subtrees of `candidates[]`
 * are encoded: every field a production reader reads (`legalRecordLiteralFields`)
 * and everything outside the candidates stay literal. An entry is an object
 * or array of at least `entryMinBytes` compact JSON bytes and `entryMinLines`
 * lines that occurs twice or more, kept under `entries` and named by the
 * SHA-256 of its compact JSON (24 hex digits, as the evidence codec names its
 * blobs); the outermost repeat wins and entries nest. Then each string of at
 * least `textMinBytes` JSON bytes that still occurs twice or more is kept under
 * `texts`, named by the SHA-256 of the string's JSON form (`JSON.stringify`,
 * which keeps lone surrogates apart where UTF-8 would not). Encoding refuses by
 * name two different contents that would share an id, and decoding refuses a
 * stored value whose id is not its content's hash. Decoding restores the parsed
 * value, every value and key order; whitespace layout and `\u` escaping are
 * not kept, and no reader sees them. A file is self-contained, so its hash
 * still pins its whole content.
 *
 * The contract is narrow, not total over JSON (`legalRecordEncodingRefusal`):
 * `encodeLegalRecord` refuses by name a record that has the encoded form's
 * top-level key `encoding: "legal-record-v1"`, and a single-key `$text` or
 * `$entry` object anywhere in it, since neither would round-trip. The encoded
 * form is known by the whole wrapper (`isEncodedLegalRecord`: exactly the keys
 * `encoding`, `entries`, `texts` and `value`, each of its type, in any order),
 * never by one key, so dual read returns any other value as given.
 */
export const textMinBytes = 128;
export const entryMinBytes = 64;
export const entryMinLines = 3;
const encoding = 'legal-record-v1';

/** Candidate fields that always stay literal: production readers read them. */
export const legalRecordLiteralFields = [
  'externalKey',
  'name',
  'kind',
  'disposition',
  'assessmentStatus',
  'requiredNotices',
  'holdIds',
  'noticeHoldIds',
  'evidenceId',
  'missingEvidence',
  'comparison',
  'descriptionSha256',
  'inheritedRuleNotices',
  'source',
  'noticeRequirementsComplete',
] as const;
const literalFields = new Set<string>(legalRecordLiteralFields);

const idSchema = z.string().regex(/^[a-f0-9]{24}$/);
const encodedFileSchema = z.strictObject({
  encoding: z.literal(encoding),
  entries: z.record(idSchema, z.unknown()),
  texts: z.record(idSchema, z.string()),
  value: z.unknown(),
});
type EncodedLegalRecord = z.infer<typeof encodedFileSchema>;
type Json = unknown;
type JsonObject = Record<string, Json>;

function hashId(text: string) {
  return createHash('sha256').update(text).digest('hex').slice(0, 24);
}
/** A text's id: the hash of its JSON form, so lone surrogates stay distinct. */
const textHashId = (text: string) => hashId(JSON.stringify(text));
function isObject(value: Json): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** The kind and id of a `{"$entry": id}` or `{"$text": id}` reference. */
function referenceOf(value: Json) {
  if (!isObject(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length !== 1) return undefined;
  const [key] = keys;
  if (key === '$entry') return { kind: 'entry' as const, id: value[key] };
  if (key === '$text') return { kind: 'text' as const, id: value[key] };
  return undefined;
}
const childPath = (path: string, key: string | number) =>
  typeof key === 'number' ? `${path}[${key}]` : path ? `${path}.${key}` : key;

/**
 * Calls `region` for each encodable field of each candidate, and `literal` for
 * every other member of the record, with its path.
 */
function forEachRegion(
  value: Json,
  region: (candidate: JsonObject, key: string, path: string) => void,
  literal: (member: Json, path: string) => void,
) {
  if (!isObject(value)) return literal(value, '');
  for (const [key, member] of Object.entries(value)) {
    if (key !== 'candidates' || !Array.isArray(member)) {
      literal(member, key);
      continue;
    }
    member.forEach((candidate: Json, index) => {
      const path = `candidates[${index}]`;
      if (!isObject(candidate)) return literal(candidate, path);
      for (const field of Object.keys(candidate))
        if (literalFields.has(field))
          literal(candidate[field], childPath(path, field));
        else region(candidate, field, childPath(path, field));
    });
  }
}

const wrapperKeys = ['encoding', 'entries', 'texts', 'value'];

/**
 * Whether a parsed value is the stored, encoded form of a legal record: the
 * whole wrapper, whatever its key order or layout. The one predicate dual read
 * and check 2 use.
 */
export function isEncodedLegalRecord(value: Json): value is JsonObject {
  return (
    isObject(value) &&
    Object.keys(value).length === wrapperKeys.length &&
    wrapperKeys.every((key) => Object.hasOwn(value, key)) &&
    value.encoding === encoding &&
    isObject(value.entries) &&
    isObject(value.texts) &&
    Object.values(value.texts).every((text) => typeof text === 'string')
  );
}

/**
 * Decodes a legal record in either form: the encoded file, or the plain record
 * it replaces, which is returned as given (dual read). Refuses a malformed
 * file and a missing, mismatched, unreferenced or cyclic entry or text, and a
 * reference in a field that stays literal, each by name.
 */
export function decodeLegalRecord(value: Json): Json {
  if (!isEncodedLegalRecord(value)) return value;
  const file = encodedFileSchema.parse(value);
  return decodeFile(file);
}

function decodeFile(file: EncodedLegalRecord): Json {
  const verified = new Set<string>();
  const resolving = new Set<string>();
  const usedEntries = new Set<string>();
  const usedTexts = new Set<string>();
  const resolveText = (textId: string, owner: string) => {
    usedTexts.add(textId);
    const text = file.texts[textId];
    if (text === undefined)
      throw new Error(
        `Legal record text ${textId} referenced by ${owner} is missing.`,
      );
    if (!verified.has(`text:${textId}`)) {
      if (textHashId(text) !== textId)
        throw new Error(`Legal record text ${textId} does not match its hash.`);
      verified.add(`text:${textId}`);
    }
    return text;
  };
  // Every reference decodes to a fresh value, as a parse would give.
  const decode = (value: Json, path: string): Json => {
    const reference = referenceOf(value);
    if (reference) {
      const refId = idSchema.safeParse(reference.id);
      if (!refId.success)
        throw new Error(`Legal record reference at ${path} is malformed.`);
      if (reference.kind === 'text') return resolveText(refId.data, path);
      return resolveEntry(refId.data, path);
    }
    if (Array.isArray(value))
      return value.map((item: Json, index) =>
        decode(item, childPath(path, index)),
      );
    if (isObject(value))
      return Object.fromEntries(
        Object.entries(value).map(([key, member]) => [
          key,
          decode(member, childPath(path, key)),
        ]),
      );
    return value;
  };
  const resolveEntry = (entryId: string, owner: string): Json => {
    usedEntries.add(entryId);
    if (!Object.hasOwn(file.entries, entryId))
      throw new Error(
        `Legal record entry ${entryId} referenced by ${owner} is missing.`,
      );
    if (resolving.has(entryId))
      throw new Error(`Legal record entry ${entryId} refers to itself.`);
    resolving.add(entryId);
    const decoded = decode(file.entries[entryId], `entries.${entryId}`);
    resolving.delete(entryId);
    if (!verified.has(`entry:${entryId}`)) {
      if (hashId(JSON.stringify(decoded)) !== entryId)
        throw new Error(
          `Legal record entry ${entryId} does not match its hash.`,
        );
      verified.add(`entry:${entryId}`);
    }
    return decoded;
  };
  const refuseReferences = (value: Json, path: string) => {
    if (referenceOf(value))
      throw new Error(
        `Legal record reference at ${path} is in a field that stays literal.`,
      );
    if (Array.isArray(value))
      value.forEach((item: Json, index) =>
        refuseReferences(item, childPath(path, index)),
      );
    else if (isObject(value))
      for (const [key, member] of Object.entries(value))
        refuseReferences(member, childPath(path, key));
  };
  const record = structuredClone(file.value);
  forEachRegion(
    record,
    (candidate, key, path) => {
      candidate[key] = decode(candidate[key], path);
    },
    refuseReferences,
  );
  const unusedEntry = Object.keys(file.entries).find(
    (entryId) => !usedEntries.has(entryId),
  );
  if (unusedEntry)
    throw new Error(`Legal record entry ${unusedEntry} is not referenced.`);
  const unusedText = Object.keys(file.texts).find(
    (textId) => !usedTexts.has(textId),
  );
  if (unusedText)
    throw new Error(`Legal record text ${unusedText} is not referenced.`);
  return record;
}

/** Parses a legal record file's text in either form and decodes it. */
export function parseLegalRecordText(text: string): Json {
  return decodeLegalRecord(JSON.parse(text));
}

/** Compact JSON, pretty-printed line count and id of each counted node. */
type Measure = { compact: string; lines: number };

function measure(value: Json, seen: Map<Json, Measure>): Measure {
  const known = seen.get(value);
  if (known) return known;
  let result: Measure;
  if (Array.isArray(value)) {
    const members = value.map((item: Json) => measure(item, seen));
    result = {
      compact: `[${members.map((member) => member.compact).join(',')}]`,
      lines: members.length
        ? 2 + members.reduce((sum, member) => sum + member.lines, 0)
        : 1,
    };
  } else if (isObject(value)) {
    const members = Object.entries(value).map(
      ([key, member]) => [key, measure(member, seen)] as const,
    );
    result = {
      compact: `{${members.map(([key, member]) => `${JSON.stringify(key)}:${member.compact}`).join(',')}}`,
      lines: members.length
        ? 2 + members.reduce((sum, [, member]) => sum + member.lines, 0)
        : 1,
    };
  } else result = { compact: JSON.stringify(value), lines: 1 };
  if (typeof value === 'object' && value !== null) seen.set(value, result);
  return result;
}

/** Each container under `node`, at any depth. */
function* containers(node: Json): Generator<object> {
  if (typeof node !== 'object' || node === null) return;
  yield node;
  for (const member of Array.isArray(node) ? node : Object.values(node))
    yield* containers(member);
}
/** Each string under `node`, at any depth. */
function* strings(node: Json): Generator<string> {
  if (typeof node === 'string') yield node;
  else if (typeof node === 'object' && node !== null)
    for (const member of Array.isArray(node) ? node : Object.values(node))
      yield* strings(member);
}
const increment = <K>(counts: Map<K, number>, key: K) =>
  counts.set(key, (counts.get(key) ?? 0) + 1);

/** Counts each occurrence of an entry-sized node under `value`, by id. */
function countEntries(
  value: Json,
  counts: Map<string, number>,
  ids: Map<Json, string | null>,
) {
  for (const node of containers(value)) {
    const entryId = ids.get(node);
    if (entryId) increment(counts, entryId);
  }
}
/** Counts each occurrence of a text-sized string under `value`. */
function countTexts(value: Json, counts: Map<string, number>) {
  for (const text of strings(value))
    if (Buffer.byteLength(JSON.stringify(text)) >= textMinBytes)
      increment(counts, text);
}

/** The id of each node large enough to be an entry; null for the others. */
function entryIds(
  value: Json,
  ids: Map<Json, string | null>,
  claim: (claimId: string, content: string) => void,
) {
  const measures = new Map<Json, Measure>();
  const visit = (node: Json) => {
    if (typeof node !== 'object' || node === null || ids.has(node)) return;
    const { compact, lines } = measure(node, measures);
    const large =
      Buffer.byteLength(compact) >= entryMinBytes && lines >= entryMinLines;
    const nodeId = large ? hashId(compact) : null;
    if (nodeId) claim(nodeId, compact);
    ids.set(node, nodeId);
    for (const member of Array.isArray(node) ? node : Object.values(node))
      visit(member);
  };
  visit(value);
}

/** The path of the first value shaped like a reference, depth first. */
function referenceShapePath(value: Json, path: string): string | undefined {
  if (referenceOf(value)) return path;
  const members: [string | number, Json][] = Array.isArray(value)
    ? value.map((item: Json, index) => [index, item])
    : isObject(value)
      ? Object.entries(value)
      : [];
  for (const [key, member] of members) {
    const found = referenceShapePath(member, childPath(path, key));
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Why a plain record is outside the codec's contract, if it is: it has the
 * encoded form's top-level key, or a value shaped like a reference.
 * `encodeLegalRecord` refuses such a record with this message.
 */
export function legalRecordEncodingRefusal(record: Json): string | undefined {
  if (isObject(record) && record.encoding === encoding)
    return `Legal record has the encoded form's top-level key encoding: "${encoding}"; it cannot be encoded.`;
  const path = referenceShapePath(record, '');
  return path === undefined
    ? undefined
    : `Legal record value at ${path} is shaped like a reference; it cannot be encoded.`;
}

/** Remembers each id's content, refusing a second, different content for it. */
function idClaims(store: string) {
  const claimed = new Map<string, string>();
  return (claimId: string, content: string) => {
    const held = claimed.get(claimId);
    if (held === undefined) claimed.set(claimId, content);
    else if (held !== content)
      throw new Error(
        `Legal record ${store} collide on id ${claimId}; it cannot be encoded.`,
      );
  };
}

const sortedById = <T>(store: Map<string, T>) =>
  Object.fromEntries(
    [...store].sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );

/** A reference object pretty-printed over three lines, put back on one. */
const referenceLines = /\{\n\s*"\$(text|entry)": "([0-9a-f]{24})"\n\s*\}/g;

type Region = { candidate: JsonObject; key: string };

/** Entries: the outermost repeat of each node is stored once, by id. */
function storeEntries(regions: Region[]) {
  const ids = new Map<Json, string | null>();
  const entryCounts = new Map<string, number>();
  const claimEntry = idClaims('entries');
  for (const { candidate, key } of regions) {
    entryIds(candidate[key], ids, claimEntry);
    countEntries(candidate[key], entryCounts, ids);
  }
  const entries = new Map<string, Json>();
  const replaceEntries = (node: Json): Json => {
    if (typeof node !== 'object' || node === null) return node;
    const entryId = ids.get(node);
    if (!entryId || (entryCounts.get(entryId) ?? 0) < 2)
      return replaceMembers(node);
    if (!entries.has(entryId)) {
      entries.set(entryId, null);
      entries.set(entryId, replaceMembers(node));
    }
    return { $entry: entryId };
  };
  const replaceMembers = (node: object): Json =>
    Array.isArray(node)
      ? node.map(replaceEntries)
      : Object.fromEntries(
          Object.entries(node).map(([key, member]) => [
            key,
            replaceEntries(member),
          ]),
        );
  for (const { candidate, key } of regions)
    candidate[key] = replaceEntries(candidate[key]);
  return entries;
}

/** Texts: each string still repeated, in the regions and the stored entries. */
function storeTexts(regions: Region[], entries: Map<string, Json>) {
  const textCounts = new Map<string, number>();
  for (const { candidate, key } of regions)
    countTexts(candidate[key], textCounts);
  for (const entry of entries.values()) countTexts(entry, textCounts);
  const claimText = idClaims('texts');
  for (const [text, count] of textCounts)
    if (count > 1) claimText(textHashId(text), text);
  const texts = new Map<string, string>();
  const replaceTexts = (node: Json): Json => {
    if (typeof node === 'string') {
      if ((textCounts.get(node) ?? 0) < 2) return node;
      const textId = textHashId(node);
      texts.set(textId, node);
      return { $text: textId };
    }
    if (typeof node !== 'object' || node === null || referenceOf(node))
      return node;
    return Array.isArray(node)
      ? node.map(replaceTexts)
      : Object.fromEntries(
          Object.entries(node).map(([key, member]) => [
            key,
            replaceTexts(member),
          ]),
        );
  };
  for (const { candidate, key } of regions)
    candidate[key] = replaceTexts(candidate[key]);
  for (const [entryId, entry] of entries)
    entries.set(entryId, replaceTexts(entry));
  return texts;
}

/**
 * The stored text of a legal record given in either form: the encoded file
 * when anything repeats, else the plain record, each as
 * `JSON.stringify(value, null, 2)` with a final newline and every reference on
 * one line. Deterministic: ids are content hashes and both stores are sorted.
 * Refuses a record outside the contract (`legalRecordEncodingRefusal`) and two
 * contents that would share an id, each by name.
 */
export function encodeLegalRecord(value: Json): string {
  const record = structuredClone(decodeLegalRecord(value));
  const refusal = legalRecordEncodingRefusal(record);
  if (refusal) throw new Error(refusal);
  const regions: Region[] = [];
  forEachRegion(
    record,
    (candidate, key) => regions.push({ candidate, key }),
    () => undefined,
  );
  const entries = storeEntries(regions);
  const texts = storeTexts(regions, entries);
  const stored =
    entries.size || texts.size
      ? {
          encoding,
          entries: sortedById(entries),
          texts: sortedById(texts),
          value: record,
        }
      : record;
  return `${JSON.stringify(stored, null, 2).replace(referenceLines, (_, kind: string, refId: string) => `{"$${kind}": "${refId}"}`)}\n`;
}
