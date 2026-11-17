import { expect, test } from 'vitest';
import { loadLegalPageData } from './legal-page-loader';
import { legalResources, section15Registry } from './section15-registry-data';

test('legal notices remain available when the backend legal query is unavailable', async () => {
  const page = await loadLegalPageData(async () => {
    throw new Error(
      'Could not find public function catalogRelease:legalInputs',
    );
  });

  expect(page.title).toBe('Legal notices');
  expect(page.sections.map((section) => section.id)).toEqual([
    'ogl',
    'section15',
    'section8',
    'paizo',
    'contact',
  ]);
  expect(page.sections[0]?.notices[0]?.text).toContain('OPEN GAME LICENSE');
  expect(page.sections[3]?.notices[0]?.text).toContain('Paizo');
});

test('legal notices use committed defaults before a prepared release is active', async () => {
  const page = await loadLegalPageData(async () => null);

  expect(page.sections[0]?.notices).toEqual([legalResources.ogl]);
  expect(page.sections[2]?.notices).toEqual([legalResources.section8]);
  expect(page.sections[3]?.notices).toEqual([legalResources.paizo]);
  expect(page.sections[1]?.notices.map((notice) => notice.title)).toContain(
    'Pathfinder RPG Core Rulebook',
  );
});

test('legal notices publish the prepared active release inputs when available', async () => {
  const page = await loadLegalPageData(async () => ({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: [
      {
        id: 'retained-release-notice',
        title: 'Retained notice',
        text: 'Notice from the active release.',
        provenance: ['release fixture'],
      },
    ],
    requiredNotices: [],
  }));

  expect(page.sections[1]?.notices).toContainEqual({
    id: 'retained-release-notice',
    title: 'Retained notice',
    text: 'Notice from the active release.',
    provenance: ['release fixture'],
  });
});
