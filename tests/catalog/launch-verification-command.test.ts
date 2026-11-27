// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { launchVerificationSchema } from '../../scripts/catalog/launch-verification';
import { runLaunchVerification } from '../../scripts/catalog/launch-verification-command';

const committed = launchVerificationSchema.parse(
  JSON.parse(
    readFileSync(
      new URL(
        '../../scripts/catalog/scopes/campaign-mvp-v1.verification.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ),
);

// pbl-notice-rows: a row has three observations since its notice observation
// left the inventory, so the summary counts a row with all three as fully
// verified.
it('counts a row with admission, structure and content evidence verified as all observations verified', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'launch-verification-'));
  try {
    const row = { mechanisms: [], prose: [], evidence: [] };
    const document = {
      ...committed,
      rows: [
        {
          ...row,
          key: 'pf1/a',
          verified: ['admission', 'structure', 'contentEvidence'] as const,
        },
        { ...row, key: 'pf1/b', verified: ['admission', 'structure'] as const },
      ].map((entry) => ({ ...entry, verified: [...entry.verified] })),
    };
    let printed = '';
    await runLaunchVerification({
      write: true,
      build: () => Promise.resolve(document),
      projection: join(directory, 'campaign-mvp-v1.verification.json'),
      print: (text) => {
        printed += text;
      },
    });
    expect(JSON.parse(printed)).toMatchObject({
      projectedRows: 2,
      allObservationsVerified: 1,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
