import { describe, expect, it } from 'vitest';
import { buildLegalPageData } from './legal-page-data';
import { legalResources, section15Registry } from './section15-registry-data';
import type { LegalResources, Section15Registry } from './legal-types';

const resources: LegalResources = {
  ogl: {
    id: 'ogl',
    title: 'OGL',
    text: 'Full license text',
    provenance: ['fixture'],
  },
  upstreamNotices: [
    {
      id: 'upstream',
      title: 'Upstream',
      text: 'Inherited upstream notice\nThird-party line.',
      provenance: ['fixture'],
    },
  ],
  projectNotice: null,
  section8: {
    id: 'section8',
    title: 'Identification',
    text: 'Game rules are OGC.',
    provenance: ['fixture'],
  },
  paizo: {
    id: 'paizo',
    title: 'Paizo',
    text: 'Community Use notice',
    provenance: ['fixture'],
  },
  permanentNoticeSuperset: [],
};
const registry: Section15Registry = {
  PZO1: {
    title: 'Reviewed book',
    notice: 'Book copyright.\nInherited third-party notice.\n',
    checkedAgainst: 'prd',
    checkedOn: '2026-10-02',
    aliases: ['OLD-CODE'],
    reviewStatus: 'reviewed',
    provenance: ['https://example.com/book'],
  },
};

describe('legal page data', () => {
  it('publishes the license, verbatim notices, identification and Community Use in order', () => {
    const page = buildLegalPageData({
      permanentNoticeSuperset: [],
      registry,
      resources,
      requiredNotices: ['PZO1'],
    });
    expect(page.sections.map((section) => section.id)).toEqual([
      'ogl',
      'section15',
      'section8',
      'paizo',
    ]);
    expect(page.sections[1]?.notices.map((notice) => notice.text)).toEqual([
      'Inherited upstream notice\nThird-party line.',
      'Book copyright.\nInherited third-party notice.\n',
    ]);
  });
  it('keeps previously shipped notice versions when a book is corrected or removed', () => {
    const page = buildLegalPageData({
      requiredNotices: [],
      registry: {},
      resources,
      permanentNoticeSuperset: [
        {
          id: 'registry:PZO1',
          title: 'Old book',
          text: 'Previous copyright notice.',
          provenance: ['previous release'],
        },
      ],
    });
    expect(page.sections[1]?.notices.map((notice) => notice.text)).toContain(
      'Previous copyright notice.',
    );
    expect(page.permanentNoticeSuperset.map((notice) => notice.text)).toContain(
      'Previous copyright notice.',
    );
  });
  it('reports missing and unreviewed requirements without presenting them as supplied', () => {
    const page = buildLegalPageData({
      permanentNoticeSuperset: [],
      registry: {
        ...registry,
        PZO2: {
          checkedAgainst: 'unreviewed',
          checkedOn: '2026-10-02',
          aliases: [],
          provenance: [],
          title: 'Unreviewed seed',
          notice: 'Unverified text',
          reviewStatus: 'unreviewed',
        },
      },
      resources,
      requiredNotices: ['OLD-CODE', 'PZO2', 'PZO-MISSING'],
    });
    expect(page.outstandingNotices).toEqual([
      { code: 'PZO-MISSING', title: 'PZO-MISSING', reason: 'missing' },
      { code: 'PZO2', title: 'Unreviewed seed', reason: 'unreviewed' },
    ]);
    expect(
      page.sections[1]?.notices.map((notice) => notice.text),
    ).not.toContain('Unverified text');
  });
  it('provides the full committed license and an adapted Paizo notice without promoting seed notices', () => {
    const page = buildLegalPageData({
      registry: section15Registry,
      resources: legalResources,
      permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
      requiredNotices: [],
    });
    expect(page.sections[0]?.notices[0]?.text).toContain(
      '15. COPYRIGHT NOTICE',
    );
    expect(page.sections[3]?.notices[0]?.text).toContain(
      'Keepnet uses trademarks and/or copyrights owned by Paizo Inc.',
    );
    expect(page.sections[3]?.notices[0]?.text).not.toContain(
      '[website, character sheet, or whatever it is]',
    );
    expect(page.sections[1]?.notices.map((notice) => notice.id)).not.toContain(
      'registry:PZO1137',
    );
  });
  it('leaves held-only book notices out of the permanent published set', () => {
    const page = buildLegalPageData({
      permanentNoticeSuperset: [],
      registry,
      resources,
      requiredNotices: [],
    });
    expect(page.permanentNoticeSuperset.map((notice) => notice.id)).toEqual([
      'upstream',
    ]);
  });
  it('keeps an ambiguous alias outstanding instead of selecting a notice arbitrarily', () => {
    const page = buildLegalPageData({
      permanentNoticeSuperset: [],
      registry: {
        ...registry,
        PZO2: {
          title: 'Another book',
          notice: 'Other copyright notice.',
          checkedAgainst: 'prd',
          checkedOn: '2026-10-02',
          aliases: ['OLD-CODE'],
          reviewStatus: 'reviewed',
          provenance: ['fixture'],
        },
      },
      resources,
      requiredNotices: ['OLD-CODE'],
    });
    expect(page.outstandingNotices).toEqual([
      { code: 'OLD-CODE', title: 'OLD-CODE', reason: 'missing' },
    ]);
    expect(page.sections[1]?.notices.map((notice) => notice.id)).toEqual([
      'upstream',
    ]);
  });
});

it('publishes the owner-approved Keepnet notice and public product name', () => {
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: [],
  });
  expect(page.sections[1]?.notices.map((notice) => notice.text)).toContain(
    'Keepnet © 2026 Andreas Ununger',
  );
  expect(page.introduction).toContain('Keepnet');
  expect(page.outstandingResources).toEqual([]);
  expect(page.sections[2]?.notices[0]?.text).toContain('Keepnet');
  expect(page.sections[3]?.notices[0]?.text).toContain('Keepnet');
});

it('identifies only reproduced contributor-designated Pathfinder content as Open Game Content', () => {
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: [],
  });
  expect(page.sections[2]?.notices[0]?.text).toBe(
    'The Open Game Content distributed by Keepnet consists only of the Pathfinder game rules, mechanics, and rules text identified as Open Game Content by their contributors and reproduced here. No other content of Keepnet is Open Game Content.',
  );
  expect(legalResources.section8.provenance).toContain(
    'Owner-approved identification wording, 2026-10-03.',
  );
});

it('merges the release notice superset with its required reviewed notices', () => {
  const page = buildLegalPageData({
    registry,
    resources,
    permanentNoticeSuperset: [
      {
        id: 'registry:PZO1',
        title: 'Earlier notice',
        text: 'Persisted earlier notice.',
        provenance: ['previous release'],
      },
    ],
    requiredNotices: ['OLD-CODE'],
  });
  expect(page.sections[1]?.notices.map((notice) => notice.text)).toEqual([
    'Persisted earlier notice.',
    'Inherited upstream notice\nThird-party line.',
    'Book copyright.\nInherited third-party notice.\n',
  ]);
});

// #716 P10a, plan §7 "Publication contract": PCGen's block for a book is
// published, byte for byte, when an admitted row requires it, and the page
// needs no candidate to decide that.
describe('a PCGen block', () => {
  const committed = section15Registry['pcgen:PZO9451'];
  if (!committed) throw new Error('No pcgen:PZO9451 record.');
  // As the implementer wrote it; the record step may since have reviewed it.
  const drafted = { ...committed, reviewStatus: 'unreviewed' as const };
  const reviewed = {
    ...committed,
    reviewStatus: 'reviewed' as const,
    checkedOn: '2026-10-20',
  };
  const withBlock: Section15Registry = { 'pcgen:PZO9451': reviewed };

  it('is published for a release with an Advanced Class Origins archetype', () => {
    const page = buildLegalPageData({
      registry: withBlock,
      resources,
      permanentNoticeSuperset: [],
      requiredNotices: ['pcgen:PZO9451'],
    });
    const published = page.sections[1]?.notices.find(
      (notice) => notice.id === 'registry:pcgen:PZO9451',
    );
    expect(published?.text).toBe(reviewed.notice);
    // player_companion/advanced_class_origins/OGL.txt:34 to the end of the file.
    expect(
      published?.text.startsWith('Open Game License v 1.0a Copyright 2000'),
    ).toBe(true);
    expect(published?.text.endsWith('and Gwen T.).\n')).toBe(true);
    expect(page.outstandingNotices).toEqual([]);
  });

  it('is not published for a release without one, nor while it is unreviewed', () => {
    const without = buildLegalPageData({
      registry: withBlock,
      resources,
      permanentNoticeSuperset: [],
      requiredNotices: [],
    });
    expect(
      without.sections[1]?.notices.map((notice) => notice.id),
    ).not.toContain('registry:pcgen:PZO9451');
    const unreviewed = buildLegalPageData({
      registry: { 'pcgen:PZO9451': drafted },
      resources,
      permanentNoticeSuperset: [],
      requiredNotices: ['pcgen:PZO9451'],
    });
    expect(
      unreviewed.sections[1]?.notices.map((notice) => notice.id),
    ).not.toContain('registry:pcgen:PZO9451');
    expect(unreviewed.outstandingNotices).toEqual([
      {
        code: 'pcgen:PZO9451',
        title: 'PCGen dataset: Advanced Class Origins',
        reason: 'unreviewed',
      },
    ]);
  });
});
