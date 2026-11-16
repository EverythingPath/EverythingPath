// The migration proof of the legal-record encoding (legal-record design, "The
// proof", check 1; the model is `stable-key-proof.ts`): given the commit before
// the encoding, it shows that the working tree's legal records store the same
// information.
//
//   node --import tsx scripts/catalog/legal-record-proof.ts --base <BASE> [--root DIR]
//
// For each of the notice authority's legal locators at BASE (every JSON file
// of the legal record directory but the two #227 files), one file at a time:
// a record in the encoded set must decode to the value BASE's bytes parse to,
// the two serialised in key order with no sorting (`JSON.stringify` of
// `JSON.parse` of the old bytes against `JSON.stringify` of the decoded new
// bytes); every other locator must be byte-identical; no JSON file may be
// added to or removed from the directory. The #227 files are the gate's, not
// records, and have their own drift check; the proof reports whether each
// changed and does not compare them. It is
// checked against the previous representation, read from Git, never against
// what the encoder expects. The proof reads stored bytes at two revisions, so
// guard 3 exempts it (`legal-record-guard.ts`).
//
// It assumes BASE stores every record of the encoded set plain: it compares
// BASE's parsed bytes with the decoded working tree, so an encoded BASE would
// read as a changed value. Such a record is refused by name
// (`LegalRecordProofRefusal`, exit 2), never reported as a pass or a changed
// value; a slice whose BASE already holds encoded records (L4) extends the
// proof to decode BASE too.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  isEncodedLegalRecord,
  parseLegalRecordText,
} from '../../src/lib/catalog/legal-record-codec.ts';
import { encodedLegalRecords } from './legal-records.ts';

const directory = 'scripts/catalog/legal';
const noticesPath = 'scripts/catalog/scopes/campaign-mvp-v1.notices.json';

export type LegalRecordProof = { lines: string[]; failures: string[] };

/** The proof refuses a base it cannot compare: a record of the set stored encoded there. */
export class LegalRecordProofRefusal extends Error {}

/** Bytes and LF-separated lines (a nonempty last line counts) of a text. */
function size(bytes: Buffer) {
  let lines = 0;
  for (const byte of bytes) if (byte === 10) lines += 1;
  if (bytes.length && bytes[bytes.length - 1] !== 10) lines += 1;
  return { bytes: bytes.length, lines };
}

const figure = (value: number) => value.toLocaleString('en-US');

type Git = (args: string[], input?: string) => Buffer;
type Check = (holds: boolean, line: string) => void;
type Size = { bytes: number; lines: number };

const noticesSchema = z.object({
  value: z.object({ inputs: z.array(z.object({ locator: z.string() })) }),
});

const sizeLine = (from: Size, to: Size) =>
  `${figure(from.bytes)} B / ${figure(from.lines)} lines -> ${figure(to.bytes)} B / ${figure(to.lines)} lines`;

/** BASE's JSON files, name to blob id, read from the tree, not from any reader. */
function baseBlobsOf(git: Git, commit: string) {
  const blobs = new Map<string, string>();
  for (const entry of git(['ls-tree', '-z', `${commit}:${directory}`])
    .toString()
    .split('\0')) {
    const match = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(entry);
    if (match?.[1] && match[2]?.endsWith('.json'))
      blobs.set(match[2], match[1]);
  }
  return blobs;
}

/** The notice authority's legal locators at BASE, by file name. */
function locatorsOf(git: Git, commit: string) {
  const notices = noticesSchema.parse(
    JSON.parse(
      git(['cat-file', 'blob', `${commit}:${noticesPath}`]).toString('utf8'),
    ),
  );
  return notices.value.inputs
    .map(({ locator }) => locator)
    .filter((locator) => locator.startsWith(`${directory}/`))
    .map((locator) => locator.slice(directory.length + 1));
}

/** BASE's parsed value, or why it does not parse. */
function baseValue(old: Buffer): { value: unknown } | { error: string } {
  try {
    return { value: JSON.parse(old.toString('utf8')) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Why one encoded record's decoded value is not its base value, if it is not. */
function valueDifference(old: unknown, next: Buffer) {
  try {
    return JSON.stringify(old) ===
      JSON.stringify(parseLegalRecordText(next.toString('utf8')))
      ? undefined
      : 'the decoded value differs';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** 1: each encoded record, one at a time, against its base value. */
function encodedSection(
  {
    git,
    check,
    root,
    commit,
  }: { git: Git; check: Check; root: string; commit: string },
  names: readonly string[],
) {
  const before = { bytes: 0, lines: 0 };
  const after = { bytes: 0, lines: 0 };
  const encodedAtBase: string[] = [];
  for (const name of names) {
    const old = git(['cat-file', 'blob', `${commit}:${directory}/${name}`]);
    const parsed = baseValue(old);
    if ('value' in parsed && isEncodedLegalRecord(parsed.value)) {
      encodedAtBase.push(name);
      continue;
    }
    const next = readFileSync(join(root, directory, name));
    const was = size(old);
    const is = size(next);
    before.bytes += was.bytes;
    before.lines += was.lines;
    after.bytes += is.bytes;
    after.lines += is.lines;
    const difference =
      'value' in parsed ? valueDifference(parsed.value, next) : parsed.error;
    check(
      difference === undefined,
      `${name}: ${sizeLine(was, is)}${difference === undefined ? '' : `; ${difference}`}`,
    );
  }
  if (encodedAtBase.length)
    throw new LegalRecordProofRefusal(
      `${encodedAtBase.join(', ')} ${encodedAtBase.length === 1 ? 'is' : 'are'} already stored encoded at base ${commit}: the proof compares a plain base only, so it refuses rather than report a changed value; extend it to decode the base (L4).`,
    );
  return `     encoded set: ${sizeLine(before, after)}`;
}

/** The working files of `names` whose bytes differ from their base blob. */
function changedFiles(
  git: Git,
  names: readonly string[],
  baseBlobs: ReadonlyMap<string, string>,
) {
  if (!names.length) return new Set<string>();
  const hashes = git(
    ['hash-object', '--no-filters', '--stdin-paths'],
    names.map((name) => `${directory}/${name}\n`).join(''),
  )
    .toString()
    .trim()
    .split('\n');
  return new Set(
    names.filter((name, index) => hashes[index] !== baseBlobs.get(name)),
  );
}

/**
 * 2: every other locator byte-identical; the two #227 files (not locators)
 * reported, not compared. Returns the report lines.
 */
function otherSection(
  { git, check }: { git: Git; check: Check },
  {
    baseBlobs,
    located,
  }: { baseBlobs: ReadonlyMap<string, string>; located: ReadonlySet<string> },
  others: readonly string[],
) {
  const changed = changedFiles(git, others, baseBlobs);
  const compared = others.filter((name) => located.has(name));
  for (const name of compared)
    if (changed.has(name)) check(false, `${name}: changed bytes`);
  if (!compared.some((name) => changed.has(name)))
    check(true, `${figure(compared.length)} locators byte-identical`);
  return others
    .filter((name) => !located.has(name))
    .map(
      (name) =>
        `     not a locator, not compared: ${name} (${changed.has(name) ? 'changed' : 'unchanged'})`,
    );
}

/** The file-set check's line, naming each added and removed file. */
function fileSetLine(added: readonly string[], removed: readonly string[]) {
  return ['the same files in the working tree']
    .concat(added.length ? [`added ${added.join(', ')}`] : [])
    .concat(removed.length ? [`removed ${removed.join(', ')}`] : [])
    .join('; ');
}

/**
 * The proof over the checkout at `root` against the commit `base`: a
 * transcript (`lines`) and the checks that failed, each naming its file.
 */
export function legalRecordProof({
  root,
  base,
  encoded = encodedLegalRecords,
}: {
  root: string;
  base: string;
  encoded?: readonly string[];
}): LegalRecordProof {
  const git: Git = (args, input) =>
    execFileSync('git', args, {
      cwd: root,
      maxBuffer: 1 << 30,
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  const lines: string[] = [];
  const failures: string[] = [];
  const check: Check = (holds, line) => {
    lines.push(`${holds ? 'ok  ' : 'FAIL'} ${line}`);
    if (!holds) failures.push(line);
  };
  const commit = git(['rev-parse', '--verify', `${base}^{commit}`])
    .toString()
    .trim();
  lines.push('legal-record migration proof', `base ${commit}`);

  const baseBlobs = baseBlobsOf(git, commit);
  const baseNames = [...baseBlobs.keys()].sort();
  const working = readdirSync(join(root, directory))
    .filter((name) => name.endsWith('.json'))
    .sort();
  const locators = locatorsOf(git, commit);
  const located = new Set(locators);
  lines.push(
    `${figure(baseNames.length)} JSON files at base, ${figure(locators.length)} of them notice-authority locators (${noticesPath})`,
  );
  check(
    locators.every((name) => baseBlobs.has(name)),
    'every notice-authority locator is a file at base',
  );
  const added = working.filter((name) => !baseBlobs.has(name));
  const removed = baseNames.filter((name) => !working.includes(name));
  check(!added.length && !removed.length, fileSetLine(added, removed));
  const listed = new Set(encoded);
  for (const name of listed)
    if (!located.has(name))
      check(false, `${name}: in the encoded set but not a locator at base`);

  lines.push('1. encoded records: the decoded value equals the base value');
  lines.push(
    encodedSection(
      { git, check, root, commit },
      baseNames.filter(
        (name) =>
          listed.has(name) && located.has(name) && working.includes(name),
      ),
    ),
  );

  lines.push('2. every other locator is byte-identical');
  lines.push(
    ...otherSection(
      { git, check },
      { baseBlobs, located },
      baseNames.filter((name) => !listed.has(name) && working.includes(name)),
    ),
  );

  lines.push(
    failures.length ? `FAILED: ${failures.length} checks` : 'all checks passed',
  );
  return { lines, failures };
}

function main() {
  const args = process.argv.slice(2);
  const option = (flag: string) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  const base = option('--base');
  if (!base)
    throw new Error(
      'Usage: node --import tsx scripts/catalog/legal-record-proof.ts --base <BASE> [--root DIR]',
    );
  try {
    const { lines, failures } = legalRecordProof({
      root: option('--root') ?? process.cwd(),
      base,
    });
    process.stdout.write(`${lines.join('\n')}\n`);
    if (failures.length) process.exitCode = 1;
  } catch (error) {
    if (!(error instanceof LegalRecordProofRefusal)) throw error;
    process.stderr.write(
      `legal-record migration proof refused: ${error.message}\n`,
    );
    process.exitCode = 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
