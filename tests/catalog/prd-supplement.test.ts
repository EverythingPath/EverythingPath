// @vitest-environment node
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prdPin } from '../../scripts/catalog/inventory';
import {
  completeManifestSchema,
  supplementManifestSchema,
} from '../../scripts/catalog/prd-manifest';
import { verifyPrdCapture } from '../../scripts/catalog/prd-pin';
import {
  prdSupplementPin,
  verifyPrdSupplement,
} from '../../scripts/catalog/prd-supplement';
import { pinnedPath, pinnedStore } from './pinned-sources';

// The PRD supplement (owner, 2026-10-31): the ARG age, height and weight
// page, captured once beside the PRD capture under its own pin, as race
// age-table evidence only. The PRD capture and its pin stay as they were.
const store = join(pinnedStore, 'prd-supplement');
const page = 'pages/advancedRaceGuide/ageHeightWeight.html';
const sha256 = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex');

const copies: string[] = [];
afterEach(async () => {
  await Promise.all(
    copies.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function copyOfStore() {
  const root = await mkdtemp(join(tmpdir(), 'prd-supplement-'));
  copies.push(root);
  await cp(store, root, { recursive: true });
  return root;
}

describe('the PRD supplement pin', () => {
  it('validates the committed supplement: its manifest and its one page', async () => {
    await expect(verifyPrdSupplement(store)).resolves.toEqual({
      files: 1,
      contentSha256: prdSupplementPin.contentSha256,
    });
  });

  it('records the one Wayback fetch of the age page, as the capture fetched it', async () => {
    const manifest = supplementManifestSchema.parse(
      JSON.parse(await readFile(join(store, 'manifest.json'), 'utf8')),
    );
    expect(manifest).toMatchObject({
      capture: 'prd-supplement-2026-10-31',
      supplements: 'prd-2026-10-20',
      retiredBy: '20180913',
      totals: { pages: 1, bytes: 41725 },
    });
    expect(manifest.pages).toEqual([
      {
        path: 'advancedRaceGuide/ageHeightWeight.html',
        file: page,
        book: 'ARG',
        role: 'ageTables',
        originalUrl:
          'http://paizo.com/pathfinderRPG/prd/advancedRaceGuide/ageHeightWeight.html',
        captureUrl:
          'https://web.archive.org/web/20180911005508id_/http://paizo.com:80/pathfinderRPG/prd/advancedRaceGuide/ageHeightWeight.html',
        captureTimestamp: '20180911005508',
        bytes: 41725,
        sha256:
          'e257433ddb45b1a69fde4768c5b90ee0fdcc87e24976c3b0a81c67e973562d46',
        fetchedAt: '2026-10-31T08:29:17.916Z',
        httpStatus: 200,
      },
    ]);
    const bytes = await readFile(join(store, page));
    expect(bytes.length).toBe(41725);
    expect(sha256(bytes)).toBe(manifest.pages[0]?.sha256);
    // The page prints the races' random starting ages by class group.
    expect(bytes.toString('utf8')).toContain('Random Starting Ages');
  });

  it('fails a changed page, a missing page or a changed manifest', async () => {
    const changed = await copyOfStore();
    await writeFile(join(changed, page), 'changed');
    await expect(verifyPrdSupplement(changed)).rejects.toThrow(
      `The PRD supplement's ${page} changed.`,
    );
    const missing = await copyOfStore();
    await rm(join(missing, page));
    await expect(verifyPrdSupplement(missing)).rejects.toThrow(
      `The PRD supplement lacks ${page}.`,
    );
    const manifest = await copyOfStore();
    await writeFile(join(manifest, 'manifest.json'), '{}\n');
    await expect(verifyPrdSupplement(manifest)).rejects.toThrow(
      'The PRD supplement manifest changed',
    );
  });

  it('gives the age-table role to the supplement only', () => {
    const supplement = {
      status: 'complete',
      capture: 'prd-supplement-test',
      source: 'A labelled test manifest.',
      retiredBy: '20180913',
      supplements: 'prd-2026-10-20',
      purpose: 'Test only.',
      totals: { pages: 1, bytes: 1 },
    };
    const agePage = {
      path: 'advancedRaceGuide/ageHeightWeight.html',
      file: page,
      book: 'ARG',
      originalUrl: 'http://paizo.com/pathfinderRPG/prd/x.html',
      captureUrl: 'https://web.archive.org/web/20180911005508id_/x',
      captureTimestamp: '20180911005508',
      bytes: 1,
      sha256: 'a'.repeat(64),
    };
    const withPage = (row: object) => ({
      ...supplement,
      pages: [
        {
          ...agePage,
          fetchedAt: '2026-10-31T08:29:17.916Z',
          httpStatus: 200,
          ...row,
        },
      ],
    });
    expect(
      supplementManifestSchema.safeParse(withPage({ role: 'ageTables' }))
        .success,
    ).toBe(true);
    for (const row of [
      { role: 'archetypes' },
      { role: 'ageTables', httpStatus: 302 },
      { role: 'ageTables', fetchedAt: undefined },
    ])
      expect(supplementManifestSchema.safeParse(withPage(row)).success).toBe(
        false,
      );
    // The PRD capture's manifest has no age-table role.
    expect(
      completeManifestSchema.shape.pages.element.shape.role.safeParse(
        'ageTables',
      ).success,
    ).toBe(false);
  });
});

describe('the PRD capture beside it', () => {
  it('keeps its pin, its manifest and its pages', async () => {
    expect(prdPin).toEqual({
      capture: 'prd-2026-10-20',
      manifestSha256:
        'ab85f25ffd5cf0f0e7d365011a9e98e6095918ad7abacb91fa9acbc5ee3d181e',
      contentSha256:
        'becac42cc3e99f48b5aa1900c9bc11b1413a073646c193817bd048d58b2f27f6',
    });
    await expect(
      verifyPrdCapture(join(pinnedStore, 'prd'), {
        files: ['pages/openGameLicense.html'],
      }),
    ).resolves.toMatchObject({ files: 1 });
    // The age page isn't in the capture: only the supplement holds it.
    const manifest = JSON.parse(
      await readFile(pinnedPath('prd', 'manifest.json'), 'utf8'),
    );
    expect(
      manifest.pages.some(
        ({ path }: { path: string }) =>
          path === 'advancedRaceGuide/ageHeightWeight.html',
      ),
    ).toBe(false);
  });
});
