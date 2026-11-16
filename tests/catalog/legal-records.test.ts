// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  encodeLegalRecordsIn,
  encodedLegalRecords,
  findLegalRecordProblems,
  legalRecordLabel,
  legalRecordNamesIn,
  legalRecordSha256,
  readLegalRecord,
  readLegalRecords,
  readLegalRecordsIn,
} from '../../scripts/catalog/legal-records';
import { launchVerificationClosure } from '../../scripts/catalog/launch-verification-inputs';
import { catalogCalculationV1Files } from '../../src/lib/catalog/runtime-compatibility';
import {
  encodeLegalRecord,
  legalRecordEncodingRefusal,
  parseLegalRecordText,
} from '../../src/lib/catalog/legal-record-codec';
import { catalogDataFiles } from '../../scripts/catalog/data-files';

const scratch = mkdtempSync(join(tmpdir(), 'legal-records-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const body = (topic: string) =>
  `${topic}: `.padEnd(
    160,
    'The spell body text repeats for each linked record. ',
  );
const record = {
  reviewedBy: 'curator',
  candidates: ['pf1/a', 'pf1/b'].map((externalKey) => ({
    externalKey,
    fullContentReview: { descriptionText: body('Description'), externalKey },
    auditNoticeReview: [{ book: 'Core Rulebook', evidence: body('Evidence') }],
  })),
};
const plainText = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

// This test is exempt from guard 3: it compares the loader with the stored
// bytes and builds scratch checkouts, so it names the directory itself.
const legalDirectory = 'scripts/catalog/legal';
/** A scratch checkout's legal directory. */
const legalDirectoryIn = (root: string) => join(root, legalDirectory);
/** A committed record's stored bytes. */
const storedBytes = (name: string) => readFileSync(join(legalDirectory, name));

/** A checkout with only a legal directory holding `files`. */
function legalRoot(name: string, files: Record<string, string>) {
  const root = join(scratch, name);
  mkdirSync(legalDirectoryIn(root), { recursive: true });
  for (const [file, text] of Object.entries(files))
    writeFileSync(join(legalDirectoryIn(root), file), text);
  return root;
}

describe('the legal record loader', () => {
  it('reads a plain record by its name exactly as a parse of its stored bytes does', () => {
    expect(JSON.stringify(readLegalRecord('monster-abilities-506.json'))).toBe(
      JSON.stringify(
        JSON.parse(storedBytes('monster-abilities-506.json').toString('utf8')),
      ),
    );
  });

  it("gives a record's stored bytes' SHA-256, as the notice authority pins it", () => {
    expect(legalRecordSha256('monster-abilities-506.json')).toBe(
      createHash('sha256')
        .update(storedBytes('monster-abilities-506.json'))
        .digest('hex'),
    );
  });

  it("gives the stored bytes' SHA-256 and the names of the records under another root", () => {
    const encoded = encodeLegalRecord(record);
    const root = legalRoot('names', {
      'spells-2.json': encoded,
      'spells-1.json': plainText(record),
      'README.md': 'not a record',
    });
    expect(legalRecordNamesIn(root)).toEqual([
      'spells-1.json',
      'spells-2.json',
    ]);
    expect(legalRecordSha256('spells-2.json', root)).toBe(
      createHash('sha256').update(encoded).digest('hex'),
    );
  });

  it('names a record by its file name, never by a path', () => {
    expect(legalRecordLabel('example-1.json')).toBe(
      'scripts/catalog/legal/example-1.json',
    );
    expect(legalRecordLabel()).toBe('scripts/catalog/legal/');
    for (const path of [
      'scripts/catalog/legal/example-1.json',
      '../legal/example-1.json',
      'example-1',
    ]) {
      expect(() => readLegalRecord(path)).toThrow(
        `A legal record is named by its file name in scripts/catalog/legal, not by a path: ${path}`,
      );
      expect(() => legalRecordSha256(path)).toThrow(/by its file name/);
      expect(() => legalRecordLabel(path)).toThrow(/by its file name/);
      expect(() => encodeLegalRecordsIn(scratch, [path])).toThrow(
        /by its file name/,
      );
    }
  });

  it('reads an encoded record as the record it replaced', () => {
    const root = legalRoot('read', {
      'spells-1.json': encodeLegalRecord(record),
    });
    const path = join(legalDirectoryIn(root), 'spells-1.json');
    expect(JSON.parse(readFileSync(path, 'utf8'))).toHaveProperty('encoding');
    const [read] = readLegalRecordsIn(root);
    expect(read?.name).toBe('spells-1.json');
    expect(JSON.stringify(read?.record)).toBe(JSON.stringify(record));
  });

  it("encodes the encoded set's records under a root for catalog:format, once", () => {
    const root = legalRoot('encode', {
      'spells-1.json': plainText(record),
      'spells-2.json': plainText(record),
    });
    const path = join(legalDirectoryIn(root), 'spells-1.json');
    const written = encodeLegalRecordsIn(root, ['spells-1.json']);
    expect(written).toEqual(['spells-1.json']);
    expect(readFileSync(path, 'utf8')).toBe(encodeLegalRecord(record));
    expect(
      readFileSync(join(legalDirectoryIn(root), 'spells-2.json'), 'utf8'),
    ).toBe(plainText(record));
    expect(encodeLegalRecordsIn(root, ['spells-1.json'])).toEqual([]);
  });

  it('names the records it encoded, never a path a caller could read', () => {
    const root = legalRoot('encode-names', {
      'spells-1.json': plainText(record),
      'spells-2.json': plainText(record),
    });
    const written = encodeLegalRecordsIn(root, [
      'spells-1.json',
      'spells-2.json',
    ]);
    expect(written).toHaveLength(2);
    for (const name of written) {
      expect(existsSync(name)).toBe(false);
      expect(existsSync(join(root, name))).toBe(false);
    }
  });

  it("names a record it cannot read or parse by its label, quoting neither the file's path nor its text", () => {
    const root = legalRoot('unreadable', {
      'broken.json': '{ "candidates": [ "quoted record text" ',
    });
    const failure = (read: () => unknown) => {
      try {
        read();
      } catch (error) {
        return error as Error & Record<string, unknown>;
      }
      throw new Error('expected a failure');
    };
    const failures = [
      failure(() => [...readLegalRecordsIn(root)]),
      failure(() => encodeLegalRecordsIn(root, ['broken.json'])),
      failure(() => encodeLegalRecordsIn(root, ['gone.json'])),
      failure(() => readLegalRecord('gone-example.json')),
      failure(() => legalRecordSha256('gone-example.json')),
    ];
    expect(failures.map(({ message }) => message)).toEqual([
      'scripts/catalog/legal/broken.json is not valid JSON.',
      'scripts/catalog/legal/broken.json is not valid JSON.',
      'scripts/catalog/legal/gone.json cannot be read (ENOENT).',
      'scripts/catalog/legal/gone-example.json cannot be read (ENOENT).',
      'scripts/catalog/legal/gone-example.json cannot be read (ENOENT).',
    ]);
    for (const error of failures) {
      const carried = JSON.stringify({ ...error, message: error.message });
      for (const quoted of [scratch, process.cwd(), 'quoted record text'])
        expect(carried).not.toContain(quoted);
    }
    expect(findLegalRecordProblems({ root, encoded: [] }).problems).toEqual([
      'scripts/catalog/legal/broken.json: not valid JSON.',
    ]);
  });

  it('reads a directory one record at a time, by name, the JSON files only', () => {
    const root = legalRoot('scan', {
      'spells-2.json': encodeLegalRecord(record),
      'held-notices.json': '[]\n',
      'spells-1.json': plainText({ candidates: [] }),
      'README.md': 'not a record',
    });
    const read = readLegalRecordsIn(root);
    expect(read.next().value).toMatchObject({
      name: 'held-notices.json',
      record: [],
    });
    expect(
      [...readLegalRecordsIn(root, (name) => name !== 'held-notices.json')].map(
        ({ name, record }) => [name, JSON.stringify(record)],
      ),
    ).toEqual([
      ['spells-1.json', JSON.stringify({ candidates: [] })],
      ['spells-2.json', JSON.stringify(record)],
    ]);
  });

  it('is in the verification projection, through the wired scanners, and outside the calculation identity', () => {
    const named = [
      'src/lib/catalog/legal-record-codec.ts',
      'scripts/catalog/legal-records.ts',
    ];
    expect(catalogCalculationV1Files).not.toEqual(
      expect.arrayContaining([named[0]]),
    );
    expect(catalogCalculationV1Files).not.toEqual(
      expect.arrayContaining([named[1]]),
    );
    const closure = launchVerificationClosure(process.cwd()).files;
    for (const path of named) expect(closure).toContain(path);
  });
});

// Check 2 of the design ("The proof"): every record in the encoded set is
// stored encoded and canonical, and decodes; no other record is encoded.
describe('the encoded legal records', () => {
  it(
    encodedLegalRecords.length
      ? 'are canonical, decode, and are exactly the encoded set'
      : 'are canonical, decode, and are exactly the encoded set (none is encoded yet, so this passes vacuously)',
    () => {
      const { checked, problems } = findLegalRecordProblems({
        root: process.cwd(),
      });
      expect(problems).toEqual([]);
      expect(checked).toEqual([...encodedLegalRecords].sort());
    },
  );

  it('pass when canonical and in the set', () => {
    const root = legalRoot('canonical', {
      'spells-1.json': encodeLegalRecord(record),
      'spells-2.json': plainText(record),
    });
    expect(
      findLegalRecordProblems({ root, encoded: ['spells-1.json'] }),
    ).toEqual({ checked: ['spells-1.json'], problems: [] });
  });

  it('fail when a stored entry is edited by hand, the layout is not canonical, or the set disagrees', () => {
    const encoded = encodeLegalRecord(record);
    const stored = JSON.parse(encoded) as { entries: Record<string, unknown> };
    const [entryId = ''] = Object.keys(stored.entries);
    stored.entries[entryId] = [{ book: 'Edited by hand' }];
    const root = legalRoot('broken', {
      'edited.json': plainText(stored),
      'layout.json': JSON.stringify(JSON.parse(encoded)),
      'unlisted.json': encoded,
      'plain.json': plainText(record),
    });
    expect(
      findLegalRecordProblems({
        root,
        encoded: ['edited.json', 'layout.json', 'plain.json', 'gone.json'],
      }).problems,
    ).toEqual([
      `scripts/catalog/legal/edited.json: Legal record entry ${entryId} does not match its hash.`,
      'scripts/catalog/legal/gone.json: in the encoded set but missing.',
      'scripts/catalog/legal/layout.json: not canonical; run pnpm catalog:format.',
      'scripts/catalog/legal/plain.json: in the encoded set but stored plain; run pnpm catalog:format.',
      'scripts/catalog/legal/unlisted.json: encoded but not in the encoded set (encodedLegalRecords).',
    ]);
  });
});

// Check 2 knows an encoded file by its parsed structure, the predicate decode
// uses, so an editor that reorders, re-indents or minifies the wrapper changes
// nothing: the file is still found when unlisted and still not canonical.
describe('an encoded file in another layout', () => {
  const canonical = encodeLegalRecord(record);
  const wrapper = JSON.parse(canonical) as Record<string, unknown>;
  const keys = ['encoding', 'entries', 'texts', 'value'];
  const orders = (rest: string[]): string[][] =>
    rest.length
      ? rest.flatMap((key) =>
          orders(rest.filter((other) => other !== key)).map((order) => [
            key,
            ...order,
          ]),
        )
      : [[]];
  const reordered = orders(keys)
    .filter((order) => order.join() !== keys.join())
    .map((order) => ({
      name: `order-${order.join('-')}.json`,
      text: plainText(
        Object.fromEntries(order.map((key) => [key, wrapper[key]])),
      ),
    }));
  const layouts = [
    ...reordered,
    { name: 'minified.json', text: JSON.stringify(wrapper) },
    { name: 'crlf.json', text: canonical.replaceAll('\n', '\r\n') },
    { name: 'tabs.json', text: `${JSON.stringify(wrapper, null, '\t')}\n` },
  ];

  it('covers every key order but the canonical one', () => {
    expect(reordered).toHaveLength(23);
    expect(reordered.map(({ name }) => name)).toContain(
      'order-value-entries-texts-encoding.json',
    );
  });

  it('is found when it is not in the encoded set', () => {
    const root = legalRoot(
      'layouts-unlisted',
      Object.fromEntries(layouts.map(({ name, text }) => [name, text])),
    );
    expect(findLegalRecordProblems({ root, encoded: [] }).problems).toEqual(
      layouts
        .map(({ name }) => name)
        .sort()
        .map(
          (name) =>
            `${legalRecordLabel(name)}: encoded but not in the encoded set (encodedLegalRecords).`,
        ),
    );
  });

  it('is not canonical when it is in the encoded set', () => {
    const root = legalRoot(
      'layouts-listed',
      Object.fromEntries(layouts.map(({ name, text }) => [name, text])),
    );
    const names = layouts.map(({ name }) => name).sort();
    expect(findLegalRecordProblems({ root, encoded: names })).toEqual({
      checked: names,
      problems: names.map(
        (name) =>
          `${legalRecordLabel(name)}: not canonical; run pnpm catalog:format.`,
      ),
    });
  });

  /**
   * A scratch checkout: the shared data files and the committed records of
   * the encoded set linked, the legal directory holding `files` besides.
   */
  function checkoutRoot(name: string, files: Record<string, string>) {
    const root = legalRoot(name, files);
    for (const record of encodedLegalRecords)
      symlinkSync(
        join(process.cwd(), legalDirectory, record),
        join(legalDirectoryIn(root), record),
      );
    for (const path of Object.values(catalogDataFiles)) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      symlinkSync(join(process.cwd(), path), join(root, path));
    }
    return root;
  }
  const formatCheck = (root: string) =>
    spawnSync(
      'node',
      [
        '--import',
        'tsx',
        'scripts/catalog-format.ts',
        '--check',
        '--root',
        root,
      ],
      { encoding: 'utf8' },
    );

  // Each layout alone is found in-process ("is found when it is not in the
  // encoded set" covers every layout, the three the reviews named among them),
  // so the CLI is spawned twice: once clean, once with every layout.
  it('makes catalog:format --check exit 1, for each layout the reviews named and for all of them', () => {
    const plain = checkoutRoot('cli-plain', {
      'plain.json': plainText(record),
    });
    expect(formatCheck(plain)).toMatchObject({
      status: 0,
      stdout: 'Catalog data files are canonical.\n',
    });
    expect(layouts.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'order-value-entries-texts-encoding.json',
        'minified.json',
        'crlf.json',
      ]),
    );
    const all = checkoutRoot(
      'cli-all',
      Object.fromEntries(layouts.map(({ name, text }) => [name, text])),
    );
    const result = formatCheck(all);
    expect(result.status).toBe(1);
    for (const { name } of layouts)
      expect(result.stderr).toContain(
        `${legalRecordLabel(name)}: encoded but not in the encoded set (encodedLegalRecords).`,
      );
  }, 60_000);
});

describe('the committed legal records', () => {
  it('are each inside the codec contract: none is refused when encoded', () => {
    let read = 0;
    const refused: string[] = [];
    for (const { name, record } of readLegalRecords()) {
      read += 1;
      const refusal = legalRecordEncodingRefusal(record);
      if (refusal) refused.push(`${name}: ${refusal}`);
    }
    expect(refused).toEqual([]);
    expect(read).toBe(201);
  });
});

describe('pnpm catalog:format --encode and --expand', () => {
  const format = (...args: string[]) =>
    execFileSync(
      'node',
      ['--import', 'tsx', 'scripts/catalog-format.ts', ...args],
      {
        encoding: 'utf8',
      },
    );

  it('encode temporary copies of committed records in place and expand them back to the same value', () => {
    const sources = ['spells-528.json', 'monster-abilities-506.json'];
    const copies = sources.map((source, index) => {
      const copy = join(scratch, `copy-${index}.json`);
      writeFileSync(copy, storedBytes(source));
      return copy;
    });
    expect(format('--encode', ...copies)).toBe(
      copies.map((copy) => `Encoded ${copy}\n`).join(''),
    );
    sources.forEach((source, index) => {
      const original = readLegalRecord(source);
      const stored = readFileSync(copies[index] ?? '', 'utf8');
      expect(JSON.parse(stored)).toHaveProperty('encoding', 'legal-record-v1');
      expect(JSON.stringify(parseLegalRecordText(stored))).toBe(
        JSON.stringify(original),
      );
    });
    // Encoding again changes nothing.
    expect(format('--encode', ...copies)).toBe('');
    expect(format('--expand', ...copies)).toBe(
      copies.map((copy) => `Expanded ${copy}\n`).join(''),
    );
    sources.forEach((source, index) => {
      const original = readLegalRecord(source);
      expect(readFileSync(copies[index] ?? '', 'utf8')).toBe(
        plainText(original),
      );
    });
  }, 60_000);
});
