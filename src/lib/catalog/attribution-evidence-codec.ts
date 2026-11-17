import { createHash } from 'node:crypto';
import { z } from 'zod';
import { reviewedAdmissionSchema } from './admission-schema.ts';

/**
 * The committed attribution evidence stores repeated immutable text once
 * (#744). Every JSON value of at least `blobBytes` inside an entry's content
 * becomes a blob named by its hash, and blobs nest, so an entry is a rope of
 * literal text and blob references. Decoding only concatenates the stored text,
 * so every byte (including literals such as `1.0`) is exactly as reviewed.
 * Each entry's encoding depends only on its own content: parallel batches
 * still merge entries by identity, and shared blobs are a union.
 */
const blobBytes = 512;

const blobIdSchema = z.string().regex(/^[a-f0-9]{24}$/);
const partSchema = z.union([z.string(), z.strictObject({ ref: blobIdSchema })]);
const encodedEntrySchema = z.strictObject({
  content: z.string().optional(),
  parts: z.array(partSchema).min(1).optional(),
  revoked: z.boolean().optional(),
  conclusion: z.unknown().optional(),
});
const encodedFileSchema = z.strictObject({
  evidence: z.record(z.string(), encodedEntrySchema),
  shared: z.record(blobIdSchema, z.array(partSchema).min(1)),
});
const plainEntrySchema = z.strictObject({
  content: z.string(),
  revoked: z.boolean().optional(),
  conclusion: z.unknown().optional(),
});

type Part = z.infer<typeof partSchema>;
type EncodedEntry = z.infer<typeof encodedEntrySchema>;
type EncodedAttributionEvidence = z.infer<typeof encodedFileSchema>;
type AttributionEvidenceEntry = z.infer<typeof plainEntrySchema>;
export type AttributionEvidenceEntries = Record<
  string,
  AttributionEvidenceEntry
>;

function blobId(text: string) {
  return createHash('sha256').update(text).digest('hex').slice(0, 24);
}
function compare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
/** The entry's fields in their committed order. */
function entryOf(
  content: string,
  { revoked, conclusion }: Pick<EncodedEntry, 'revoked' | 'conclusion'>,
): AttributionEvidenceEntry {
  return {
    content,
    ...(revoked === undefined ? {} : { revoked }),
    ...(conclusion === undefined ? {} : { conclusion }),
  };
}

/** Joins an entry's or blob's parts, verifying every blob it reaches. */
function createResolver(shared: Record<string, Part[]>) {
  const resolved = new Map<string, string>();
  const resolving = new Set<string>();
  const resolve = (parts: Part[], owner: string): string =>
    parts
      .map((part) => {
        if (typeof part === 'string') return part;
        const known = resolved.get(part.ref);
        if (known !== undefined) return known;
        const blob = shared[part.ref];
        if (!blob)
          throw new Error(
            `Attribution evidence blob ${part.ref} referenced by ${owner} is missing.`,
          );
        if (resolving.has(part.ref))
          throw new Error(
            `Attribution evidence blob ${part.ref} refers to itself.`,
          );
        resolving.add(part.ref);
        const text = resolve(blob, part.ref);
        resolving.delete(part.ref);
        if (blobId(text) !== part.ref)
          throw new Error(
            `Attribution evidence blob ${part.ref} does not match its hash.`,
          );
        resolved.set(part.ref, text);
        return text;
      })
      .join('');
  return { resolve, resolved };
}

/**
 * Decodes the committed encoded file into the plain evidence map every reader
 * uses. Refuses a malformed file, a missing, cyclic, mismatched or orphaned
 * blob, and an entry with both or neither of `content` and `parts`. Only the
 * formatter, which drops them, accepts orphaned blobs.
 */
export function decodeAttributionEvidence(
  value: unknown,
  options?: { allowOrphans?: boolean },
): AttributionEvidenceEntries {
  return decodeFile(encodedFileSchema.parse(value), options);
}

/** The committed file as a schema field: validated, then decoded. */
export const attributionEvidenceFileSchema = encodedFileSchema.transform(
  (file) => decodeFile(file),
);

/**
 * The committed reviewed-admission files, with the evidence encoded. They are
 * checked together, so every malformed file is reported, then the decoded
 * evidence is checked with the rest.
 */
export const reviewedAdmissionFilesSchema = z
  .object({
    ...reviewedAdmissionSchema.shape,
    evidence: attributionEvidenceFileSchema,
  })
  .transform((files) => reviewedAdmissionSchema.parse(files));

function decodeFile(
  file: EncodedAttributionEvidence,
  { allowOrphans = false }: { allowOrphans?: boolean } = {},
): AttributionEvidenceEntries {
  const { resolve, resolved } = createResolver(file.shared);
  const entries: AttributionEvidenceEntries = {};
  for (const [id, entry] of Object.entries(file.evidence)) {
    if (entry.content !== undefined && entry.parts)
      throw new Error(`Attribution evidence ${id} has both content and parts.`);
    if (entry.content === undefined && !entry.parts)
      throw new Error(
        `Attribution evidence ${id} has neither content nor parts.`,
      );
    entries[id] = entryOf(
      entry.content ?? resolve(entry.parts ?? [], id),
      entry,
    );
  }
  const orphan = Object.keys(file.shared).find((id) => !resolved.has(id));
  if (orphan && !allowOrphans)
    throw new Error(`Attribution evidence blob ${orphan} is not referenced.`);
  return entries;
}

function isEncodedFile(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join() === 'evidence,shared'
  );
}

/**
 * Reads evidence in either committed form: the encoded file, or the plain map
 * it replaced (earlier branches, reviewed-admission inputs and hand-authored
 * fixtures). Plain maps are returned as given, for the caller's schema.
 */
export function readAttributionEvidence(
  value: unknown,
  options?: { allowOrphans?: boolean },
): unknown {
  return isEncodedFile(value)
    ? decodeAttributionEvidence(value, options)
    : value;
}

/** A reviewed-admission input whose `evidence` is decoded from either form. */
function readReviewedAdmissionInput(value: unknown): unknown {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('evidence' in value)
  )
    return value;
  return { ...value, evidence: readAttributionEvidence(value.evidence) };
}

/**
 * A JSON value's text span, the spans of its member values and, for an
 * object, the spans of its member names.
 */
type Span = { start: number; end: number; children: Span[]; keys: Span[] };
/** A position in the JSON text being scanned. */
type Cursor = { text: string; at: number };

const jsonLiteral =
  /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;

function skipWhitespace(cursor: Cursor) {
  while (/[ \t\n\r]/.test(cursor.text[cursor.at] ?? '')) cursor.at += 1;
}
function leaf(start: number, end: number): Span {
  return { start, end, children: [], keys: [] };
}

function scanString(cursor: Cursor): Span {
  const start = cursor.at;
  cursor.at += 1;
  while (cursor.text[cursor.at] !== '"') {
    if (cursor.at >= cursor.text.length)
      throw new SyntaxError('Unterminated string');
    cursor.at += cursor.text[cursor.at] === '\\' ? 2 : 1;
  }
  cursor.at += 1;
  return leaf(start, cursor.at);
}

function scanLiteral(cursor: Cursor): Span {
  jsonLiteral.lastIndex = cursor.at;
  const literal = jsonLiteral.exec(cursor.text);
  if (!literal) throw new SyntaxError('Expected a JSON value');
  const start = cursor.at;
  cursor.at += literal[0].length;
  return leaf(start, cursor.at);
}

/** An object member's name, through its colon. */
function scanKey(cursor: Cursor): Span {
  skipWhitespace(cursor);
  if (cursor.text[cursor.at] !== '"') throw new SyntaxError('Expected a key');
  const key = scanString(cursor);
  skipWhitespace(cursor);
  if (cursor.text[cursor.at] !== ':') throw new SyntaxError('Expected ":"');
  cursor.at += 1;
  return key;
}

/** An object or array and its comma-separated members. */
function scanContainer(cursor: Cursor): Span {
  const span = leaf(cursor.at, cursor.at);
  const isObject = cursor.text[cursor.at] === '{';
  const close = isObject ? '}' : ']';
  cursor.at += 1;
  skipWhitespace(cursor);
  if (cursor.text[cursor.at] !== close)
    for (;;) {
      if (isObject) span.keys.push(scanKey(cursor));
      span.children.push(scanValue(cursor));
      skipWhitespace(cursor);
      if (cursor.text[cursor.at] !== ',') break;
      cursor.at += 1;
    }
  if (cursor.text[cursor.at] !== close)
    throw new SyntaxError(`Expected "${close}"`);
  cursor.at += 1;
  span.end = cursor.at;
  return span;
}

function scanValue(cursor: Cursor): Span {
  skipWhitespace(cursor);
  const character = cursor.text[cursor.at];
  if (character === '"') return scanString(cursor);
  if (character === '{' || character === '[') return scanContainer(cursor);
  return scanLiteral(cursor);
}

/** The spans of the one JSON value `text` holds from `start`, or undefined. */
function scanJson(text: string, start: number): Span | undefined {
  const cursor = { text, at: start };
  try {
    const span = scanValue(cursor);
    skipWhitespace(cursor);
    return cursor.at === text.length ? span : undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function keyName(text: string, key: Span) {
  const raw = text.slice(key.start + 1, key.end - 1);
  return raw.includes('\\') ? String(JSON.parse(`"${raw}"`)) : raw;
}

/** Refuses a member name repeated in one object, which JSON.parse would drop. */
function refuseDuplicateKeys(text: string, span: Span, path: string[]) {
  const names = span.keys.map((key) => keyName(text, key));
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name))
      throw new Error(
        `Duplicate attribution evidence key ${JSON.stringify(name)} at ${path.join('.') || 'the root'}.`,
      );
    seen.add(name);
  }
  span.children.forEach((child, index) =>
    refuseDuplicateKeys(text, child, [
      ...path,
      span.keys.length ? (names[index] ?? '') : String(index),
    ]),
  );
}

/** The spans of JSON text that `JSON.parse` already accepted. */
function scanParsed(text: string) {
  const span = scanJson(text, 0);
  if (!span) throw new Error('Attribution evidence JSON could not be scanned.');
  return span;
}

/**
 * Parses an evidence file's text in either form, refusing an evidence ID or
 * blob named twice: `JSON.parse` would silently keep only the last one.
 */
export function parseAttributionEvidenceText(text: string): unknown {
  const value: unknown = JSON.parse(text);
  refuseDuplicateKeys(text, scanParsed(text), []);
  return value;
}

/**
 * Parses a reviewed-admission input (`--attribution PATH`), whose `evidence`
 * may be in either committed form, refusing evidence named twice, and decodes
 * that evidence for its schema.
 */
export function parseReviewedAdmissionInput(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const root = scanParsed(text);
  const names = root.keys.map((key) => keyName(text, key));
  if (names.filter((name) => name === 'evidence').length > 1)
    throw new Error(
      'Duplicate attribution evidence key "evidence" at the root.',
    );
  const evidence = root.children[names.indexOf('evidence')];
  if (evidence) refuseDuplicateKeys(text, evidence, ['evidence']);
  return readReviewedAdmissionInput(value);
}

function utf8Length(text: string) {
  let length = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) length += 1;
    else if (code < 0x800) length += 2;
    else if (code >= 0xd800 && code < 0xdc00) {
      length += 4;
      index += 1;
    } else length += 3;
  }
  return length;
}

/** The JSON value in an entry's content: all of it, or what follows its header line. */
function jsonSpanOf(content: string) {
  const newline = content.indexOf('\n');
  return (
    scanJson(content, 0) ??
    (newline === -1 ? undefined : scanJson(content, newline + 1))
  );
}

/** Encodes one entry, adding the blobs it uses to `shared`. */
function encodeEntry(
  { content, revoked, conclusion }: AttributionEvidenceEntry,
  shared: Map<string, Part[]>,
): EncodedEntry {
  // A span as literal text around its large member values' blob references;
  // the entry's own span keeps everything before and after it.
  const partsOf = (span: Span, prefix = '', suffix = ''): Part[] => {
    const parts: Part[] = [];
    let literal = prefix;
    let at = span.start;
    for (const child of span.children) {
      const text = content.slice(child.start, child.end);
      if (utf8Length(text) < blobBytes) continue;
      literal += content.slice(at, child.start);
      if (literal) parts.push(literal);
      literal = '';
      const id = blobId(text);
      if (!shared.has(id)) shared.set(id, partsOf(child));
      parts.push({ ref: id });
      at = child.end;
    }
    literal += content.slice(at, span.end) + suffix;
    if (literal) parts.push(literal);
    return parts;
  };
  const span = jsonSpanOf(content);
  const parts = span
    ? partsOf(span, content.slice(0, span.start), content.slice(span.end))
    : [content];
  return {
    ...(parts.length === 1 && typeof parts[0] === 'string'
      ? { content }
      : { parts }),
    ...(revoked === undefined ? {} : { revoked }),
    ...(conclusion === undefined ? {} : { conclusion }),
  };
}

/** Encodes a plain evidence map, entries and blobs sorted by identity. */
export function encodeAttributionEvidence(
  entries: Record<string, unknown>,
): EncodedAttributionEvidence {
  const shared = new Map<string, Part[]>();
  const evidence: Record<string, EncodedEntry> = {};
  for (const [id, entry] of Object.entries(entries).sort(([left], [right]) =>
    compare(left, right),
  )) {
    const parsed = plainEntrySchema.safeParse(entry);
    if (!parsed.success)
      throw new Error(
        `Attribution evidence ${id} is invalid: ${parsed.error.message}`,
      );
    evidence[id] = encodeEntry(parsed.data, shared);
  }
  return {
    evidence,
    shared: Object.fromEntries(
      [...shared].sort(([left], [right]) => compare(left, right)),
    ),
  };
}
