// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { z } from 'zod';
import {
  launchInventoryDocuments,
  launchInventoryRecordsBinding,
  parseLaunchInventoryDocument,
  type LaunchInventoryRecords,
  type LaunchInventoryStoredDocument,
  serializeLaunchInventoryDocument,
} from '../../scripts/catalog/launch-inventory-document';

// SK-1 (stable-key design, ep-orch research/stable-keys-design.md, section B):
// the scope documents' v4 form refers to shared records by content key, and
// every reader accepts v3 and v4. The writer stays v3 until SK-2.

const v4 = { encoding: 'campaign-inventory-records-v4' } as const;

function read(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../../scripts/catalog/scopes/${name}`, import.meta.url),
      'utf8',
    ),
  );
}

const checkpoints = parseLaunchInventoryDocument(
  read('campaign-mvp-v1.checkpoints.json'),
);

// The writer's document order (scripts/catalog-launch-inventory.ts): the
// manifest's and notices' views reuse projections the earlier documents record.
const scopeDocuments = [
  'advanced',
  'authority',
  'checkpoints',
  'companions',
  'core',
  '',
  'notices',
].map((name) => `campaign-mvp-v1${name ? `.${name}` : ''}.json`);

function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function keyedCheckpoints() {
  const encoded = launchInventoryDocuments(
    [
      ['checkpoints', checkpoints],
      ['independent-expectations', checkpoints],
    ],
    v4,
  );
  if (encoded.records.encoding !== v4.encoding)
    throw new Error('Expected a v4 records table.');
  return { documents: encoded.documents, records: encoded.records };
}

it('round-trips every committed scope document through the keyed form with an equal expansion', () => {
  const expanded = scopeDocuments.map(
    (name) => [name, parseLaunchInventoryDocument(read(name))] as const,
  );
  const before = new Map(
    expanded.map(([name, value]) => [name, digest(value)]),
  );
  const keyed = launchInventoryDocuments(expanded, v4);
  expanded.length = 0;
  expect(keyed.records.encoding).toBe(v4.encoding);
  for (const name of scopeDocuments) {
    const document = keyed.documents[name];
    expect(document).toMatchObject({
      ...v4,
      records: 'campaign-mvp-v1.records.json',
    });
    expect(document).not.toHaveProperty('recordsSha256');
    expect(digest(parseLaunchInventoryDocument(document, keyed.records))).toBe(
      before.get(name),
    );
  }
}, 600_000);

it('stores shared records by sorted 64-bit base64url content keys and refers to them by key', () => {
  const { documents, records } = keyedCheckpoints();
  const keys = Object.keys(records.records);
  expect(keys.length).toBeGreaterThan(0);
  expect(keys).toEqual([...keys].sort());
  for (const [key, record] of Object.entries(records.records))
    expect(key).toBe(
      createHash('sha256')
        .update(JSON.stringify(record))
        .digest()
        .subarray(0, 8)
        .toString('base64url'),
    );
  expect(records).not.toHaveProperty('sha256');
  const text = JSON.stringify(documents);
  expect(text).toMatch(/\{"\$r":"[A-Za-z0-9_-]{11}"\}/);
  expect(text).not.toContain('$record');
  expect(parseLaunchInventoryDocument(documents.checkpoints, records)).toEqual(
    checkpoints,
  );
  expect(
    parseLaunchInventoryDocument(
      documents['independent-expectations'],
      records,
    ),
  ).toEqual(checkpoints);
});

it('writes one keyed record per line, in key order', () => {
  const { records } = keyedCheckpoints();
  const lines = serializeLaunchInventoryDocument(records).split('\n');
  const entries = Object.entries(records.records);
  expect(lines).toEqual([
    '{',
    '  "encoding": "campaign-inventory-records-v4",',
    '  "records": {',
    ...entries.map(
      ([key, record], index) =>
        `    ${JSON.stringify(key)}: ${JSON.stringify(record)}${index < entries.length - 1 ? ',' : ''}`,
    ),
    '  }',
    '}',
    '',
  ]);
});

it('keeps the committed writer at v3 unless v4 is asked for', () => {
  const { documents, records } = launchInventoryDocuments([
    ['checkpoints', checkpoints],
    ['independent-expectations', checkpoints],
  ]);
  expect(records.encoding).toBe('campaign-inventory-records-v3');
  expect(documents.checkpoints).toHaveProperty('recordsSha256', records.sha256);
  // The committed v3 files' field order, so their bytes don't move.
  const committed = z
    .record(z.string(), z.unknown())
    .parse(read('campaign-mvp-v1.checkpoints.json'));
  expect(Object.keys(documents.checkpoints ?? {})).toEqual(
    Object.keys(committed),
  );
});

it('refuses a reference to a key the records table does not hold', () => {
  const { records } = keyedCheckpoints();
  expect(() =>
    parseLaunchInventoryDocument(
      {
        ...v4,
        records: 'campaign-mvp-v1.records.json',
        value: { $r: 'AAAAAAAAAAA' },
      },
      records,
    ),
  ).toThrow(/Missing inventory record AAAAAAAAAAA/);
});

it('refuses a record changed under its key', () => {
  const { documents, records } = keyedCheckpoints();
  const [key, record] = Object.entries(records.records).at(-1) ?? [];
  if (key === undefined) throw new Error('Expected a shared record.');
  const tampered = {
    ...records,
    records: { ...records.records, [key]: [record, 'changed'] },
  };
  expect(() =>
    parseLaunchInventoryDocument(documents.checkpoints, tampered),
  ).toThrow(new RegExp(`Changed inventory record ${key}`));
});

it('refuses malformed keys, extra fields and a dictionary in another encoding', () => {
  const { documents, records } = keyedCheckpoints();
  const document = { ...v4, records: 'campaign-mvp-v1.records.json' };
  for (const reference of ['short', 1, 'AAAAAAAAAA=', 'AAAAAAAAAA+'])
    expect(() =>
      parseLaunchInventoryDocument(
        { ...document, value: { $r: reference } },
        records,
      ),
    ).toThrow(z.ZodError);
  expect(() =>
    parseLaunchInventoryDocument(
      { ...document, recordsSha256: '0'.repeat(64), value: 1 },
      records,
    ),
  ).toThrow(z.ZodError);
  expect(() =>
    parseLaunchInventoryDocument(
      { ...document, value: { $record: 0 } },
      records,
    ),
  ).toThrow(/Foreign inventory reference \$record/);
  const v3 = launchInventoryDocuments([
    ['checkpoints', checkpoints],
    ['independent-expectations', checkpoints],
  ]);
  expect(() =>
    parseLaunchInventoryDocument(documents.checkpoints, v3.records),
  ).toThrow(/records encoding/);
  expect(() =>
    parseLaunchInventoryDocument(v3.documents.checkpoints, records),
  ).toThrow(/records encoding/);
  // The committed dictionary is v3 until SK-2: a keyed document can't borrow it.
  expect(() => parseLaunchInventoryDocument(documents.checkpoints)).toThrow(
    /records encoding/,
  );
});

it('refuses to write two different records under one key', () => {
  // 300 distinct shared records cannot fit in the 256 one-byte keys.
  const texts = Array.from(
    { length: 300 },
    (_, index) =>
      `${'A shared inventory text long enough to be stored once. '.repeat(3)}${index}`,
  );
  const entries: [string, unknown][] = [
    ['first', texts],
    ['second', texts],
  ];
  expect(() =>
    launchInventoryDocuments(entries, { ...v4, keyBytes: 1 }),
  ).toThrow(/Inventory record key collision/);
  const keyed = launchInventoryDocuments(entries, v4);
  expect(
    parseLaunchInventoryDocument(keyed.documents.second, keyed.records),
  ).toEqual(texts);
});

it('names the dictionary hash a release binds: v3 binds one, a keyed document and a plain manifest none', () => {
  const positional = read('campaign-mvp-v1.json');
  expect(launchInventoryRecordsBinding(positional)).toBe(
    z.object({ recordsSha256: z.string() }).parse(positional).recordsSha256,
  );
  expect(
    launchInventoryRecordsBinding(keyedCheckpoints().documents.checkpoints),
  ).toBeNull();
  expect(launchInventoryRecordsBinding({ schemaVersion: 1 })).toBeNull();
  expect(() =>
    launchInventoryRecordsBinding({
      encoding: 'campaign-inventory-records-v3',
      records: 'campaign-mvp-v1.records.json',
      value: null,
    }),
  ).toThrow(z.ZodError);
});

it('types the two encodings as a discriminated union', () => {
  const v3Document: LaunchInventoryStoredDocument = {
    encoding: 'campaign-inventory-records-v3',
    records: 'campaign-mvp-v1.records.json',
    recordsSha256: '0'.repeat(64),
    value: null,
  };
  const v4Document: LaunchInventoryStoredDocument = {
    encoding: 'campaign-inventory-records-v4',
    records: 'campaign-mvp-v1.records.json',
    value: null,
  };
  const v3Records: LaunchInventoryRecords = {
    encoding: 'campaign-inventory-records-v3',
    sha256: '0'.repeat(64),
    records: [],
  };
  const v4Records: LaunchInventoryRecords = {
    encoding: 'campaign-inventory-records-v4',
    records: {},
  };
  const illegal: LaunchInventoryStoredDocument[] = [
    {
      encoding: 'campaign-inventory-records-v4',
      records: 'campaign-mvp-v1.records.json',
      // @ts-expect-error A keyed document binds no dictionary hash.
      recordsSha256: '0'.repeat(64),
      value: null,
    },
    // @ts-expect-error A positional document binds its dictionary hash.
    {
      encoding: 'campaign-inventory-records-v3',
      records: 'campaign-mvp-v1.records.json',
      value: null,
    },
  ];
  const illegalRecords: LaunchInventoryRecords[] = [
    // @ts-expect-error Keyed records are a map, not a list.
    { encoding: 'campaign-inventory-records-v4', records: [] },
    {
      encoding: 'campaign-inventory-records-v4',
      // @ts-expect-error A keyed dictionary has no whole-table hash.
      sha256: '0'.repeat(64),
      records: {},
    },
    // @ts-expect-error Positional records are a list.
    {
      encoding: 'campaign-inventory-records-v3',
      sha256: '0'.repeat(64),
      records: {},
    },
  ];
  expect([v3Document, v4Document, v3Records, v4Records]).toHaveLength(4);
  expect(illegal.length + illegalRecords.length).toBe(5);
});
