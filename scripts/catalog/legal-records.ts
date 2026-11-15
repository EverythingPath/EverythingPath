import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encodeLegalRecord,
  isEncodedLegalRecord,
  parseLegalRecordText,
} from '../../src/lib/catalog/legal-record-codec.ts';

/**
 * The one way code reads a batch legal record (`legal-record-codec.ts`), by
 * its file name, never by a path the caller built: `readLegalRecord(name)` for
 * one record, `readLegalRecords()` for a scan of the directory, one record at
 * a time. Both return the plain record from either stored form, plain or
 * encoded; a reader that parsed a record itself would see an encoded file's
 * stores instead of its candidates. No function here returns, yields or
 * throws a record's file path, bytes or text: `legalRecordLabel(name)` is the
 * reference text for a message or a hold's evidence (relative to the checkout
 * root, so a reference, not a secret), `legalRecordSha256(name)` the stored
 * bytes' digest, `encodeLegalRecordsIn` the names it rewrote, and a failure
 * names the record by its label. Guard 3 (`legal-record-guard.ts`) lets a
 * literal name a record only as the argument of these functions and limits
 * where a label may stand.
 */
const legalRecordDirectory = 'scripts/catalog/legal';
/**
 * This checkout's root: from the module's own URL, or the working directory
 * where that is not a file (a test in a browser-like environment).
 */
const checkout = () =>
  import.meta.url.startsWith('file:')
    ? fileURLToPath(new URL('../../', import.meta.url))
    : process.cwd();

/**
 * The legal records stored encoded, by file name.
 * `pnpm catalog:format` encodes exactly these and `--check` (with the test
 * `legal-records.test.ts`) fails when the set and the stored files disagree.
 * L2 of the legal-record design adds the seven Spells records 530 to 536.
 *
 * Before any file enters this set, every scanner in
 * `unwiredLegalRecordScanners` must be wired to this loader:
 * `legal-record-guard.test.ts` fails while the set is non-empty and one of them
 * is still listed.
 */
export const encodedLegalRecords: readonly string[] = [];

/**
 * Directory scanners that still read every legal record with a bare parse or
 * as bytes. Each is a bound input of the verification projection (and the
 * first also of the notice authority), so wiring one moves those hashes: L2
 * wires them, when it regenerates the authority chain anyway. They must be
 * wired before any file enters `encodedLegalRecords`.
 */
export const unwiredLegalRecordScanners = [
  'scripts/catalog/attribution-227-matcher.ts',
  'scripts/catalog/launch-inventory-sources.ts',
  'scripts/catalog/launch-notice-authority.ts',
  'scripts/catalog/notice-dependencies.ts',
] as const;

/** A record's file name, refused when it is a path. */
function recordName(name: string) {
  if (!/^[^/\\]+\.json$/.test(name))
    throw new Error(
      `A legal record is named by its file name in ${legalRecordDirectory}, not by a path: ${name}`,
    );
  return name;
}

/**
 * A record's reference (`scripts/catalog/legal/<name>`), the text a message, a
 * report or a hold's evidence names it by. It is not for reading (read the
 * record with `readLegalRecord`): guard 3 lets it stand only in an array or
 * object literal, a comparison, a message's text or an assertion.
 */
export function legalRecordLabel(name: string) {
  return `${legalRecordDirectory}/${recordName(name)}`;
}

/** A file failure, by the record's label: no path, no file text. */
function fileFailure(name: string, error: unknown) {
  if (error instanceof SyntaxError)
    return new Error(`${legalRecordLabel(name)} is not valid JSON.`);
  return error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string'
    ? new Error(`${legalRecordLabel(name)} cannot be read (${error.code}).`)
    : error;
}

/** `use()`, its file failure rethrown by the record's label. */
function byLabel<T>(name: string, use: () => T): T {
  try {
    return use();
  } catch (error) {
    throw fileFailure(name, error);
  }
}

/** A record's stored bytes under `root`. */
const storedBytes = (root: string, name: string) =>
  byLabel(name, () =>
    readFileSync(join(root, legalRecordDirectory, recordName(name))),
  );

/** A record's stored text under `root`, decoded from either stored form. */
const decodedRecord = (root: string, name: string): unknown => {
  const text = storedBytes(root, name).toString('utf8');
  return byLabel(name, () => parseLegalRecordText(text));
};

/** One legal record of this checkout, decoded from either stored form. */
export function readLegalRecord(name: string): unknown {
  return decodedRecord(checkout(), name);
}

/**
 * The SHA-256 (hex) of one legal record's stored bytes, as committed (encoded
 * or plain): what the notice authority pins for each record it reads.
 */
export function legalRecordSha256(name: string) {
  return createHash('sha256')
    .update(storedBytes(checkout(), name))
    .digest('hex');
}

/**
 * The legal records of this checkout, by file name, sorted, each read and
 * decoded only when the scan reaches it, so one record is held at a time.
 * `select` chooses by name before a file is read.
 */
export function readLegalRecords(select?: (name: string) => boolean) {
  return readLegalRecordsIn(checkout(), select);
}

/**
 * `readLegalRecords` for another checkout root, such as a test's scratch
 * directory holding `scripts/catalog/legal`.
 */
export function* readLegalRecordsIn(
  root: string,
  select: (name: string) => boolean = () => true,
): Generator<{ name: string; record: unknown }> {
  for (const name of readdirSync(join(root, legalRecordDirectory)).sort())
    if (name.endsWith('.json') && select(name))
      yield { name, record: decodedRecord(root, name) };
}

/**
 * `pnpm catalog:format`: stores each record of `encoded` under `root` in its
 * encoded form; the names of the records it rewrote, for the formatter to
 * name by `legalRecordLabel`.
 */
export function encodeLegalRecordsIn(
  root: string,
  encoded: readonly string[] = encodedLegalRecords,
) {
  const written: string[] = [];
  for (const name of encoded) {
    const text = storedBytes(root, name).toString('utf8');
    const next = encodeLegalRecord(
      byLabel(name, () => parseLegalRecordText(text)),
    );
    if (next === text) continue;
    byLabel(name, () =>
      writeFileSync(join(root, legalRecordDirectory, name), next),
    );
    written.push(name);
  }
  return written;
}

/**
 * What is wrong with one stored record, if anything, given whether it is in
 * the encoded set. Whether it is encoded is read from its parsed structure
 * (`isEncodedLegalRecord`, the predicate decoding uses), so key order and
 * whitespace do not matter. One file is parsed at a time.
 */
function storedRecordProblem(root: string, name: string, listed: boolean) {
  const text = storedBytes(root, name).toString('utf8');
  try {
    const value: unknown = JSON.parse(text);
    if (!listed)
      return isEncodedLegalRecord(value)
        ? 'encoded but not in the encoded set (encodedLegalRecords).'
        : undefined;
    if (!isEncodedLegalRecord(value))
      return 'in the encoded set but stored plain; run pnpm catalog:format.';
    if (encodeLegalRecord(value) !== text)
      return 'not canonical; run pnpm catalog:format.';
    return undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return 'not valid JSON.';
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Check 2 of the legal-record design, for `catalog:format --check` and its
 * test: each record in the encoded set is stored encoded, decodes (every
 * reference resolves, every id is its content's hash, nothing unreferenced or
 * cyclic, no reference in a literal field) and re-encodes to its own bytes;
 * no other record is stored encoded. Every JSON file in the directory is
 * parsed, one at a time.
 */
export function findLegalRecordProblems({
  root,
  encoded = encodedLegalRecords,
}: {
  root: string;
  encoded?: readonly string[];
}) {
  const directory = join(root, legalRecordDirectory);
  const listed = new Set(encoded);
  const stored = readdirSync(directory).filter((name) =>
    name.endsWith('.json'),
  );
  const problems = new Map<string, string>();
  for (const name of stored) {
    const problem = storedRecordProblem(root, name, listed.has(name));
    if (problem) problems.set(name, problem);
  }
  const checked = [...listed].filter((name) => stored.includes(name)).sort();
  for (const name of listed)
    if (!stored.includes(name))
      problems.set(name, 'in the encoded set but missing.');
  return {
    checked,
    problems: [...problems]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([name, problem]) => `${legalRecordDirectory}/${name}: ${problem}`),
  };
}
