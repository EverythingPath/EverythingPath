import type { OutstandingNotice } from './legal-page-types';
import { SectionFrame } from './section-frame';

export const OUTSTANDING_SECTION = {
  id: 'outstanding',
  title: 'Outstanding notices',
};
const OUTSTANDING_STATUS: Record<OutstandingNotice['reason'], string> = {
  missing: 'Notice not available.',
  unreviewed: 'Notice review pending.',
};

// Required notices the published set does not yet carry. Each row names the
// source and why its text is absent; no text is substituted for it.
export function OutstandingNotices({
  notices,
}: {
  notices: OutstandingNotice[];
}) {
  return (
    <SectionFrame {...OUTSTANDING_SECTION}>
      <ul className="font-text mt-4 flex flex-col gap-2 text-base">
        {notices.map((notice) => (
          <li key={notice.code} className="flex flex-wrap gap-x-3">
            <span>{notice.title}</span>
            <span className="text-muted-foreground">
              {OUTSTANDING_STATUS[notice.reason]}
            </span>
          </li>
        ))}
      </ul>
    </SectionFrame>
  );
}
