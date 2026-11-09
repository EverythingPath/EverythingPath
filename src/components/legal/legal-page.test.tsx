import { render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { buildLegalPageData } from '~/lib/catalog/legal-page-data';
import {
  legalResources,
  section15Registry,
} from '~/lib/catalog/section15-registry-data';
import type {
  LegalResources,
  Section15Registry,
} from '~/lib/catalog/legal-types';
import { LegalPage } from './legal-page';
vi.mock('convex/react', () => ({ useQuery: () => undefined }));

vi.mock('next/link', async () =>
  (await import('~/components/campaign-shell/shell-test-helpers')).linkModule(),
);

const SECTION_TITLES = [
  'Open Game License 1.0a',
  'Section 15 — Copyright notices',
  'Section 8 — Open Game Content',
  'Paizo Community Use',
];

const fixture = (
  id: string,
  title: string,
  text: string,
): LegalResources['ogl'] => ({ id, title, text, provenance: ['fixture'] });
const resources: LegalResources = {
  ogl: fixture('ogl', 'OGL', 'Full license text'),
  upstreamNotices: [],
  projectNotice: null,
  section8: fixture('section8', 'Identification', 'Game rules are OGC.'),
  paizo: fixture('paizo', 'Paizo', 'Community Use notice'),
  permanentNoticeSuperset: [],
};
const reviewedNotice = 'Book copyright.\nInherited third-party notice.\n';
const historicNotice = 'Book copyright (earlier printing).';
const registry: Section15Registry = {
  PZO1: {
    title: 'Reviewed book',
    notice: reviewedNotice,
    checkedAgainst: 'prd',
    checkedOn: '2026-10-02',
    aliases: [],
    reviewStatus: 'reviewed',
    provenance: ['https://example.com/book'],
  },
  PZO2: {
    title: 'Unreviewed book',
    notice: 'Seeded, unreviewed copyright line.',
    checkedAgainst: 'unreviewed',
    checkedOn: '2026-10-02',
    aliases: [],
    reviewStatus: 'unreviewed',
    provenance: [],
  },
  PZO3: {
    title: 'Book without a notice',
    notice: '',
    checkedAgainst: 'unreviewed',
    checkedOn: '2026-10-02',
    aliases: [],
    reviewStatus: 'unreviewed',
    provenance: [],
  },
};

function headings(level: number) {
  return screen
    .getAllByRole('heading', { level })
    .map((heading) => heading.textContent);
}
function section(name: string) {
  return within(screen.getByRole('region', { name }));
}

test('the committed notices render as one h1, the four sections in order, their text and the owner-approved copyright notice', () => {
  render(
    <LegalPage
      data={buildLegalPageData({
        registry: section15Registry,
        resources: legalResources,
        permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
        requiredNotices: [],
      })}
    />,
  );
  expect(headings(1)).toEqual(['Legal notices']);
  expect(headings(2)).toEqual(SECTION_TITLES);
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(
    section('Open Game License 1.0a').getByText(
      /OPEN GAME LICENSE Version 1\.0a/,
    ),
  ).toBeVisible();
  expect(
    section('Paizo Community Use').getByText(
      /used under Paizo's Community Use Policy/,
    ),
  ).toBeVisible();
  expect(
    section('Section 15 — Copyright notices').getAllByRole('heading', {
      level: 3,
    }).length,
  ).toBeGreaterThan(0);
  expect(screen.getByText('Keepnet © 2026 Andreas Ununger')).toBeVisible();
  expect(
    section('Section 8 — Open Game Content').getByText(
      'The Open Game Content distributed by Keepnet consists only of the Pathfinder game rules, mechanics, and rules text identified as Open Game Content by their contributors and reproduced here. No other content of Keepnet is Open Game Content.',
    ),
  ).toBeVisible();
  // Every section is reachable from the in-page navigation by its id.
  const navigation = within(
    screen.getByRole('navigation', { name: 'Legal sections' }),
  );
  for (const title of SECTION_TITLES) {
    const link = navigation.getByRole('link', { name: title });
    const target = document.querySelector(link.getAttribute('href')!);
    expect(target).toHaveAccessibleName(title);
  }
  expect(
    screen.getByRole('contentinfo').querySelector('a[href="/legal"]'),
  ).toHaveTextContent('Legal notices');
});

test('a reviewed notice with an inherited third-party line and a historic version of the same identity both stay visible unchanged', () => {
  render(
    <LegalPage
      data={buildLegalPageData({
        registry,
        resources,
        permanentNoticeSuperset: [
          fixture('registry:PZO1', 'Reviewed book', historicNotice),
        ],
        requiredNotices: ['PZO1'],
      })}
    />,
  );
  const notices = section('Section 15 — Copyright notices');
  expect(notices.getByText(/Inherited third-party notice/).textContent).toBe(
    reviewedNotice,
  );
  expect(notices.getByText(historicNotice)).toBeVisible();
  expect(
    notices.getAllByRole('heading', { level: 3, name: 'Reviewed book' }),
  ).toHaveLength(2);
  expect(
    screen.queryByRole('heading', { name: 'Outstanding notices' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('No copyright notices are available.'),
  ).not.toBeInTheDocument();
});

test('missing and unreviewed requirements are listed as outstanding with their own status and never as supplied notices', () => {
  render(
    <LegalPage
      data={buildLegalPageData({
        permanentNoticeSuperset: [],
        registry,
        resources,
        requiredNotices: ['PZO2', 'PZO3'],
      })}
    />,
  );
  expect(headings(2)).toEqual([...SECTION_TITLES, 'Outstanding notices']);
  const outstanding = section('Outstanding notices');
  const rows = outstanding.getAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual([
    'Unreviewed bookNotice review pending.',
    'Book without a noticeNotice not available.',
  ]);
  const notices = section('Section 15 — Copyright notices');
  expect(notices.queryByText('Unreviewed book')).not.toBeInTheDocument();
  expect(
    screen.queryByText('Seeded, unreviewed copyright line.'),
  ).not.toBeInTheDocument();
  expect(
    notices.getByText('No copyright notices are available.'),
  ).toBeVisible();
  expect(
    within(
      screen.getByRole('navigation', { name: 'Legal sections' }),
    ).getByRole('link', { name: 'Outstanding notices' }),
  ).toHaveAttribute('href', '#outstanding');
});

test('an empty Section 15 says so without inventing a notice', () => {
  render(
    <LegalPage
      data={buildLegalPageData({
        registry: {},
        resources,
        permanentNoticeSuperset: [],
        requiredNotices: [],
      })}
    />,
  );
  const notices = section('Section 15 — Copyright notices');
  expect(
    notices.getByText('No copyright notices are available.'),
  ).toBeVisible();
  expect(notices.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  expect(
    screen.queryByRole('heading', { name: 'Outstanding notices' }),
  ).not.toBeInTheDocument();
});

test("a section's notes follow its notices inside that section only", () => {
  const note = 'Attribution for one resource is still being confirmed.';
  const data = buildLegalPageData({
    registry: {},
    resources,
    permanentNoticeSuperset: [],
    requiredNotices: [],
  });
  render(
    <LegalPage
      data={{
        ...data,
        sections: data.sections.map((section) =>
          section.id === 'ogl' ? { ...section, notes: [note] } : section,
        ),
      }}
    />,
  );
  const ogl = section('Open Game License 1.0a');
  expect(ogl.getByText('Full license text')).toBeVisible();
  expect(ogl.getByText(note)).toBeVisible();
  expect(
    section('Section 15 — Copyright notices').queryByText(note),
  ).not.toBeInTheDocument();
});
