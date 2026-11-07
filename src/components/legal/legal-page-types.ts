import type { LegalPageData } from '~/lib/legal/site-legal';

export type { LegalPageData };
export type LegalSection = LegalPageData['sections'][number];
export type OutstandingNotice = LegalPageData['outstandingNotices'][number];
