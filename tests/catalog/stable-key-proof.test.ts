// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  launchInventoryDocuments,
  parseLaunchInventoryDocument,
  serializeLaunchInventoryDocument,
} from '../../scripts/catalog/launch-inventory-document';
import {
  encodingProof,
  projectionProof,
  recordsFile,
  scopeDocuments,
  streamedJsonSha256,
} from '../../scripts/catalog/stable-key-proof';

const checkpoints = parseLaunchInventoryDocument(
  JSON.parse(
    readFileSync(
      new URL(
        '../../scripts/catalog/scopes/campaign-mvp-v1.checkpoints.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ),
);
const audit = { contracts: [], accounting: [], edges: [], citations: [] };

/** Seven small scope documents in the writer's order, sharing the printed checkpoints. */
function scope(changed?: string): [string, unknown][] {
  return scopeDocuments.map((name) => {
    if (name === changed) return [name, { changed: true }];
    if (name.endsWith('.core.json') || name.endsWith('.advanced.json'))
      return [name, audit];
    if (name === 'campaign-mvp-v1.json') return [name, { edges: [], rows: [] }];
    if (name === 'campaign-mvp-v1.checkpoints.json') return [name, checkpoints];
    return [name, { checkpoints }];
  });
}

function files(encoded: { documents: object; records: unknown }) {
  return new Map([
    ...Object.entries(encoded.documents).map(
      ([name, document]) =>
        [name, serializeLaunchInventoryDocument(document)] as const,
    ),
    [recordsFile, serializeLaunchInventoryDocument(encoded.records)] as const,
  ]);
}

const v4 = { encoding: 'campaign-inventory-records-v4' } as const;

it('accepts the encoder-written v4 form of v3 files: same order, bytes, counts and expansions', () => {
  const v3 = launchInventoryDocuments(scope());
  const proof = encodingProof({
    before: files(v3),
    after: files(launchInventoryDocuments(scope(), v4)),
  });
  expect(proof.failures).toEqual([]);
  const count = v3.records.records.length;
  expect(count).toBeGreaterThan(1);
  expect(proof.lines).toContain(`ok   record count: v3 ${count}, v4 ${count}`);
  expect(
    proof.lines.filter((line) => line.includes('expansion sha256')),
  ).toHaveLength(scopeDocuments.length);
});

it('refuses a v4 form whose document says something else', () => {
  const changed = 'campaign-mvp-v1.notices.json';
  const proof = encodingProof({
    before: files(launchInventoryDocuments(scope())),
    after: files(launchInventoryDocuments(scope(changed), v4)),
  });
  expect(proof.failures).toEqual(
    expect.arrayContaining([
      expect.stringMatching(new RegExp(`^${changed}: v3 converted`)),
      expect.stringMatching(new RegExp(`^${changed}: expansion sha256`)),
    ]),
  );
});

it('refuses a v4 dictionary missing a record', () => {
  const after = files(launchInventoryDocuments(scope(), v4));
  const table = JSON.parse(after.get(recordsFile) ?? '') as {
    records: Record<string, unknown>;
  };
  const [dropped] = Object.keys(table.records);
  if (dropped === undefined) throw new Error('Expected a shared record.');
  delete table.records[dropped];
  after.set(recordsFile, serializeLaunchInventoryDocument(table));
  expect(() =>
    encodingProof({
      before: files(launchInventoryDocuments(scope())),
      after,
    }),
  ).toThrow(/Dangling v4 reference/);
});

it('hashes a value as JSON.stringify writes it', () => {
  const value = { b: [1, 'two', null, { c: true }], a: 'é"' };
  expect(streamedJsonSha256(value)).toBe(
    createHash('sha256').update(JSON.stringify(value)).digest('hex'),
  );
});

function projection(inputs: Record<string, string>, rows: unknown[]) {
  return `${JSON.stringify({ version: 1, binding: { launchScopeIdentity: 'sha256:x', inputs }, rows }, null, 2)}\n`;
}

it('accepts a projection that moves only input hashes, each with its file', () => {
  const blobs = {
    before: { 'a.json': 'a1', 'b.ts': 'b' },
    after: { 'a.json': 'a2', 'b.ts': 'b' },
  };
  const proof = projectionProof({
    before: projection(blobs.before, [{ key: 'row' }]),
    after: projection(blobs.after, [{ key: 'row' }]),
    blobSha256: (side, path) =>
      blobs[side][path as keyof (typeof blobs)['before']] ?? null,
  });
  expect(proof.failures).toEqual([]);
  expect(proof.lines).toContain(
    'ok   the text diff is 1 changed lines of 16, each a moved input-hash line',
  );
});

it('refuses a projection whose rows move or whose input hash is not its file', () => {
  const proof = projectionProof({
    before: projection({ 'a.json': 'a1' }, [{ key: 'row' }]),
    after: projection({ 'a.json': 'other' }, [{ key: 'row', verified: [] }]),
    blobSha256: (side) => (side === 'before' ? 'a1' : 'a2'),
  });
  expect(proof.failures).toEqual([
    'everything outside binding.inputs is equal (identities, fingerprints, packages, proofs)',
    'the 1 rows are equal',
    'input a.json moves with its file: a1 -> other',
    expect.stringMatching(/^the text diff is \d+ changed lines of 16,/),
  ]);
});
