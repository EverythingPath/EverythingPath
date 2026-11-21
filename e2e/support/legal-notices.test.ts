// @vitest-environment node
import { expect, it } from 'vitest';
import { loadLegalPageData } from '../../src/lib/catalog/legal-page-loader';
import { loadCommittedLegalPageData } from './legal-notices';

it('expects what the legal page shows with no active Catalog Release', async () => {
  const shown = await loadLegalPageData(async () => null);
  expect(loadCommittedLegalPageData()).toEqual(shown);
  expect(
    shown.sections.find(({ id }) => id === 'section15')?.notices.length,
  ).toBeGreaterThan(0);
});
