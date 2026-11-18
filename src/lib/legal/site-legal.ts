import { z } from 'zod';
import {
  isPublishableNotice,
  reviewedNoticeSources,
} from '../catalog/admission-schema.ts';
import type { buildLegalPageData } from '../catalog/legal-page-data.ts';
import type { LegalNotice } from '../catalog/legal-types.ts';
import { siteContact } from './site-contact.ts';

// The site layer of the public legal page. Catalog Releases decide which
// catalog notices /legal requires; the site itself shows content that no
// release carries (the militia rules) and must always show the current
// Paizo Community Use notice and its contact. This module imports no JSON,
// so Playwright's loader can apply it too.

/** Notices the site always requires, whatever release is active. */
export const siteNoticeRequirements = [
  {
    code: 'PZO92101',
    title: 'Pathfinder Campaign Setting: Lands of Conflict',
    usedBy: 'Ironfang Invasion militia rules',
  },
] as const;

const text = z.string().trim().min(1);
// The Section 15 record shape (`admission-schema.ts`), for site notices.
const siteNoticeSchema = z.object({
  title: text,
  notice: z.string(),
  checkedAgainst: z.enum([
    ...reviewedNoticeSources,
    'pcgen',
    'owner-transcription',
    'unreviewed',
  ]),
  checkedOn: z.iso.date(),
  aliases: z.array(text),
  reviewStatus: z.enum(['reviewed', 'unreviewed']),
  provenance: z.array(text),
});
export const siteNoticesSchema = z.record(text, siteNoticeSchema);
export type SiteNotices = z.infer<typeof siteNoticesSchema>;

/** Part of a notice's own text that links to `href`. */
export type NoticeLink = { text: string; href: string };
type CatalogLegalPage = ReturnType<typeof buildLegalPageData>;
type CatalogLegalSection = CatalogLegalPage['sections'][number];
export type LegalPageData = Omit<CatalogLegalPage, 'sections'> & {
  sections: (CatalogLegalSection & { link?: NoticeLink })[];
};

const paizoPolicyLink = {
  text: 'paizo.com/licenses/communityuse',
  href: 'https://paizo.com/licenses/communityuse',
};
// Author credit for the Golarion month and weekday names the militia
// calendar shows (owner decision 2026-10-31), shown under the CUP notice.
const calendarCredit =
  'Golarion calendar names from "Time on Golarion—Days of the Week" by Mike McArtor, Paizo Blog (2007).';
const contactNotice: LegalNotice = {
  id: 'contact',
  title: siteContact.title,
  text: siteContact.href,
  provenance: [
    'Owner decision, 2026-10-31: the repository GitHub Issues page is the published contact.',
  ],
};

/**
 * The catalog legal page with the site layer applied: the committed Paizo
 * notice replaces whatever the inputs carried (an older active release
 * cannot serve stale wording) and carries the calendar credit, each site
 * requirement is published in Section 15 or listed as outstanding, and the
 * Contact section closes the page. Nothing else changes.
 */
export function withSiteLegal(
  page: CatalogLegalPage,
  { paizo, siteNotices }: { paizo: LegalNotice; siteNotices: SiteNotices },
): LegalPageData {
  const published: LegalNotice[] = [];
  const outstanding: CatalogLegalPage['outstandingNotices'] = [];
  for (const { code, title } of siteNoticeRequirements) {
    const record = siteNotices[code];
    if (record && isPublishableNotice(record))
      published.push({
        id: `site:${code}`,
        title: record.title,
        text: record.notice,
        provenance: record.provenance,
      });
    else
      outstanding.push({
        code,
        title: record?.title ?? title,
        reason: record?.notice.trim() ? 'unreviewed' : 'missing',
      });
  }
  const sections = page.sections.map((section) => {
    if (section.id === 'paizo')
      return {
        ...section,
        notices: [paizo],
        notes: [...section.notes, calendarCredit],
        link: paizoPolicyLink,
      };
    if (section.id !== 'section15') return section;
    const versions = new Set(
      section.notices.map((notice) => JSON.stringify([notice.id, notice.text])),
    );
    const added = published.filter(
      (notice) => !versions.has(JSON.stringify([notice.id, notice.text])),
    );
    return { ...section, notices: [...section.notices, ...added] };
  });
  return {
    ...page,
    outstandingNotices: [...page.outstandingNotices, ...outstanding].sort(
      (left, right) => left.code.localeCompare(right.code),
    ),
    sections: [
      ...sections,
      {
        id: 'contact',
        title: siteContact.title,
        notices: [contactNotice],
        notes: [],
        link: { text: siteContact.href, href: siteContact.href },
      },
    ],
  };
}
