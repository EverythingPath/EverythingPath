// pbl-catalog-digest (PRD #251): one committed line per entry the store
// import of a release scope emits, its key and the sha256 of its canonical
// form, and the one computation `pnpm catalog:digest` and
// `catalog-digest.test.ts` share.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { openReleaseScope } from '../../scripts/catalog/release-scopes';
import {
  emittedRowsByKey,
  importReleasedScope,
  repeatedKeys,
} from './released-entries';

/** The committed release scopes, each with its own digest file. */
export const digestScopes = ['campaign-party-v1', 'campaign-mvp-v1'] as const;
export type DigestScope = (typeof digestScopes)[number];

/** A scope's committed digest, beside the test. */
export const digestPath = (scope: DigestScope) =>
  `tests/catalog/catalog-digest-${scope}.txt`;

export const regenerateCommand = 'pnpm catalog:digest --write';

const kindLine = 'catalog-digest-v1';

/**
 * The entry as JSON, object keys sorted by UTF-16 code unit at every depth,
 * no insignificant whitespace; `JSON.stringify`'s values otherwise (an
 * undefined property left out, an undefined array item `null`).
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const fields = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${fields.join(',')}}`;
  }
  return JSON.stringify(value);
}

export const entryHash = (entry: unknown) =>
  createHash('sha256').update(canonicalJson(entry), 'utf8').digest('hex');

/** A row an import emits, as the digest reads it: its key and the rest of its form. */
export type DigestRow = { externalKey: string };
type DigestRows = readonly DigestRow[];

/** Every row the store import of the scope's selection emits, as emitted. */
export async function importScopeRows(scope: DigestScope): Promise<DigestRows> {
  return importReleasedScope(await openReleaseScope({ version: scope }));
}

const storeImport = (scope: DigestScope) => `The store import of ${scope}`;

/**
 * A scope's digest text: a kind line, the scope version, the entry count,
 * then one `<key> <sha256>` line per entry, sorted by key. It refuses rows
 * that repeat a key (`emittedRowsByKey`).
 */
export function formatDigest(scope: DigestScope, emitted: DigestRows) {
  const rows = emittedRowsByKey(emitted, storeImport(scope));
  const keys = [...rows.keys()].sort();
  for (const key of keys)
    if (!/^\S+$/.test(key))
      throw new Error(`An entry key holds a space: ${key}`);
  return [
    kindLine,
    `scope ${scope}`,
    `entries ${keys.length}`,
    ...keys.map((key) => `${key} ${entryHash(rows.get(key))}`),
    '',
  ].join('\n');
}

/**
 * A digest file's entry hashes by key, with a problem for each malformed,
 * unsorted or repeated line and each header that is not the scope's.
 */
export function parseDigest(scope: DigestScope, text: string) {
  const lines = text.split('\n');
  const ended = lines.at(-1) === '';
  if (ended) lines.pop();
  const [kind, scopeLine, countLine, ...entries] = lines;
  const { hashes, problems } = parseEntryLines(entries);
  return {
    hashes,
    problems: [
      ...(ended ? [] : ['it does not end with a newline']),
      ...(kind === kindLine ? [] : [`its first line is not ${kindLine}`]),
      ...(scopeLine === `scope ${scope}`
        ? []
        : [`its second line is not "scope ${scope}"`]),
      ...(countLine === `entries ${entries.length}`
        ? []
        : [
            `its third line is not "entries ${entries.length}", the count of its entry lines`,
          ]),
      ...problems,
    ],
  };
}

/** The `<key> <sha256>` lines' hashes by key, with a problem for each malformed, repeated or unsorted line. */
function parseEntryLines(entries: readonly string[]) {
  const problems: string[] = [];
  const hashes = new Map<string, string>();
  let previous: string | undefined;
  for (const [index, line] of entries.entries()) {
    const match = /^(\S+) ([0-9a-f]{64})$/.exec(line);
    if (!match) {
      problems.push(`line ${index + 4} is not "<key> <sha256>": ${line}`);
      continue;
    }
    const [, key = '', hash = ''] = match;
    if (hashes.has(key)) problems.push(`it lists ${key} twice`);
    else if (previous !== undefined && key < previous)
      problems.push(`it is not sorted by key: ${key} follows ${previous}`);
    hashes.set(key, hash);
    previous = key;
  }
  return { hashes, problems };
}

const listed = (label: string, keys: readonly string[]) =>
  keys.length === 0
    ? []
    : [
        `  ${label} (${keys.length}): ${keys.slice(0, 20).join(', ')}${keys.length > 20 ? `, and ${keys.length - 20} more` : ''}`,
      ];

/**
 * Why the committed digest text is not the digest of the rows, or none.
 * Rows that repeat a key have no digest: that is the one problem, named with
 * each key and its count before the rows are indexed. Otherwise: the text's
 * format problems, then the keys whose hash changed, the keys it lists that
 * are no longer emitted and the emitted keys it lacks (the first twenty of
 * each, then a count), and the command that regenerates it.
 */
export function checkDigest(
  scope: DigestScope,
  committed: string,
  emitted: DigestRows,
) {
  const repeated = repeatedKeys(emitted);
  if (repeated.length > 0)
    return [
      `${storeImport(scope)} emits a key more than once, so it has no digest:`,
      ...listed('emitted more than once', repeated),
    ];
  const rows = emittedRowsByKey(emitted, storeImport(scope));
  const expected = formatDigest(scope, emitted);
  if (committed === expected) return [];
  const { hashes, problems } = parseDigest(scope, committed);
  const changed: string[] = [];
  const missing: string[] = [];
  for (const [key, hash] of hashes) {
    const row = rows.get(key);
    if (row === undefined) missing.push(key);
    else if (entryHash(row) !== hash) changed.push(key);
  }
  const extra = [...rows.keys()].filter((key) => !hashes.has(key)).sort();
  const lines = [
    ...problems.map((problem) => `  ${problem}`),
    ...listed('changed', changed),
    ...listed('listed but no longer emitted', missing),
    ...listed('emitted but not listed', extra),
  ];
  return [
    `${digestPath(scope)} is not the digest of the store import of ${scope}:`,
    ...(lines.length > 0
      ? lines
      : ['  its bytes differ from the regenerated digest']),
    `Regenerate it with ${regenerateCommand} and review the changed keys.`,
  ];
}

type DigestIo = {
  rows: (scope: DigestScope) => Promise<DigestRows>;
  read: (path: string) => Promise<string>;
  write: (path: string, text: string) => Promise<void>;
  print: (text: string) => void;
};

const fileIo: DigestIo = {
  rows: importScopeRows,
  read: (path) => readFile(path, 'utf8').catch(() => ''),
  write: (path, text) => writeFile(path, text),
  print: (text) => process.stdout.write(`${text}\n`),
};

/**
 * `pnpm catalog:digest --write | --check`: writes each scope's digest, or
 * checks the committed ones and exits 1 naming every difference.
 */
export async function runCatalogDigest(
  argv: readonly string[],
  io: DigestIo = fileIo,
) {
  const mode = argv.length === 1 ? argv[0] : undefined;
  if (mode !== '--write' && mode !== '--check') {
    io.print('usage: pnpm catalog:digest --write | --check');
    return 64;
  }
  let failed = false;
  for (const scope of digestScopes) {
    const rows = await io.rows(scope);
    if (mode === '--write') {
      await io.write(digestPath(scope), formatDigest(scope, rows));
      io.print(`${digestPath(scope)}: ${rows.length} entries`);
      continue;
    }
    const problems = checkDigest(scope, await io.read(digestPath(scope)), rows);
    if (problems.length > 0) failed = true;
    io.print(
      problems.length > 0
        ? problems.join('\n')
        : `${digestPath(scope)}: ${rows.length} entries, unchanged`,
    );
  }
  return failed ? 1 : 0;
}
