// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { readCommittedReleaseVerification } from '../../scripts/catalog/release-verification-committed';

// #227 slice 4: the labels' source a release built from this checkout reads.
it('reads the committed projection over the committed inventory, and a stale one as stale', async () => {
  const committed: {
    binding: Record<string, unknown>;
    rows: { key: string; verified: string[] }[];
  } = JSON.parse(
    await readFile(
      'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
      'utf8',
    ),
  );
  const current = await readCommittedReleaseVerification();
  if (current.kind !== 'current')
    throw new Error(`The committed projection is ${current.kind}.`);
  const structured = committed.rows.find(({ verified }) =>
    verified.includes('structure'),
  );
  if (!structured) throw new Error('No row with verified structure.');
  expect(current.rows.get(structured.key)).toMatchObject({
    structure: 'verified',
    entrySha256: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  // A projection written under another calculation identity verifies nothing.
  const stale = await readCommittedReleaseVerification({
    ...committed,
    binding: {
      ...committed.binding,
      calculationIdentity: `sha256:${'0'.repeat(64)}`,
    },
  });
  expect(stale).toEqual({
    kind: 'stale',
    reasons: ['the calculation identity changed'],
  });
}, 120_000);
