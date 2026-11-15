// @vitest-environment node
import { expect, it } from 'vitest';
import { buildCatalogRelease } from '../../scripts/catalog/release';
import { reconstructReleaseRegistry } from '../../src/lib/catalog/release-registry';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import {
  MAX_RELEASE_BATCH_BYTES,
  MAX_RELEASE_BATCH_ROWS,
  releaseByteCount,
  type ReleaseRow,
} from '../../src/lib/catalog/release-schema';

it('keeps legacy encoding below the byte boundary and losslessly splits at the next complete published notice', async () => {
  const entries = Object.entries(section15Registry);
  let crossing = 1;
  while (
    crossing <= entries.length &&
    releaseByteCount([
      {
        kind: 'legal',
        key: 'registry',
        payload: Object.fromEntries(entries.slice(0, crossing)),
      },
    ]) <= MAX_RELEASE_BATCH_BYTES
  )
    crossing++;
  expect(crossing).toBeLessThanOrEqual(entries.length);
  for (const count of [crossing - 1, crossing]) {
    const registry = Object.fromEntries(entries.slice(0, count));
    const row: ReleaseRow = {
      kind: 'legal',
      key: 'registry',
      payload: registry,
    };
    const release = await buildCatalogRelease({
      releaseNumber: 1,
      compatibility: { schema: 'test', calculation: 'test' },
      inputs: {
        upstream: [],
        remaps: [],
        curation: [],
        localData: [],
        parsers: [],
        sanitizers: [],
        ruleResources: [],
        legal: [],
        attribution: [],
      },
      rows: [row],
    });
    for (const batch of release.batches) {
      expect(releaseByteCount(batch)).toBeLessThanOrEqual(
        MAX_RELEASE_BATCH_BYTES,
      );
      expect(batch.length).toBeLessThanOrEqual(MAX_RELEASE_BATCH_ROWS);
    }
    if (count < crossing) expect(release.batches).toEqual([[row]]);
    else expect(release.batches.length).toBeGreaterThan(1);
    expect(await reconstructReleaseRegistry(release.batches.flat())).toEqual(
      registry,
    );
  }
});
