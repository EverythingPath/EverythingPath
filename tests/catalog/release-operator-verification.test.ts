// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import {
  alertness,
  createScopedReleaseBuilder,
  readCommittedManifest,
  roundTripRows,
} from './release-scope-round-trip';

// #227 slice 4: the operator labels what it releases from the committed
// verification projection. A stale one, here the committed projection
// under another calculation identity, verifies nothing.
const projection = vi.hoisted(() => ({ stale: false }));
vi.mock(
  '../../scripts/catalog/release-verification-committed',
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import('../../scripts/catalog/release-verification-committed')
      >();
    return {
      async readCommittedReleaseVerification() {
        if (!projection.stale)
          return original.readCommittedReleaseVerification();
        const committed: { binding: object } = JSON.parse(
          await readFile(
            'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
            'utf8',
          ),
        );
        return original.readCommittedReleaseVerification({
          ...committed,
          binding: {
            ...committed.binding,
            calculationIdentity: `sha256:${'0'.repeat(64)}`,
          },
        });
      },
    };
  },
);
// The committed reviewed attribution data (93 MB of encoded evidence) loads
// only for a build without --attribution; these builds supply their own.
vi.mock('../../scripts/catalog/reviewed-data-files', () => ({
  readCommittedReviewedAdmission: () =>
    Promise.reject(new Error('The reviewed attribution data was loaded.')),
}));

const slow = 240_000;
let builder: Awaited<ReturnType<typeof createScopedReleaseBuilder>>;
let manifestPath: string;
beforeAll(async () => {
  // The round-trip rows reach Alertness (CRB p. 117) from the Exploiter
  // root; its structure is verified, its Modifiers are proven, and it has a
  // curation record.
  builder = await createScopedReleaseBuilder({
    committed: await readCommittedManifest(),
    rows: roundTripRows,
  });
  manifestPath = await builder.manifest('round-trip', roundTripRows);
}, slow);
afterAll(() => builder?.dispose());

async function labelOf(name: string) {
  const { artifact } = await builder.build({ name, manifestPath });
  const row = artifact?.batches
    .flat()
    .find((row) => row.kind === 'definition' && row.key === alertness);
  if (!row) throw new Error(`The ${name} release does not carry Alertness.`);
  return (row.payload as { verification?: unknown }).verification;
}

it(
  'an operator-built release labels a verified entry verified, and unverified under a stale projection',
  async () => {
    expect(await labelOf('current')).toEqual({ state: 'verified' });
    projection.stale = true;
    expect(await labelOf('stale')).toEqual({
      state: 'unverified',
      reasons: ['verification projection stale'],
    });
  },
  slow,
);
