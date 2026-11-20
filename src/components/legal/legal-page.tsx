'use client';

import { LegalFooter } from './legal-footer';
import { useActiveLegalPageData } from './use-active-legal-page-data';
import type { LegalPageData } from './legal-page-types';
import { LegalTopBar } from './legal-top-bar';
import { NoticeSection } from './notice-section';
import { OUTSTANDING_SECTION, OutstandingNotices } from './outstanding-notices';

// Public, signed out or in: the same top bar as the app (Keep icon, crumb),
// one readable text column, the shared footer. Headings and chrome keep the
// app's display face; the notices themselves are set in the plain text face.
export function LegalPage({ data: initialData }: { data: LegalPageData }) {
  const data = useActiveLegalPageData(initialData);
  const hasOutstanding = data.outstandingNotices.length > 0;
  const sectionLinks = [
    ...data.sections,
    ...(hasOutstanding ? [OUTSTANDING_SECTION] : []),
  ];
  return (
    <div className="flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <LegalTopBar title={data.title} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl md:text-3xl">{data.title}</h1>
        <p className="text-muted-foreground font-text mt-3 max-w-prose text-base leading-7">
          {data.introduction}
        </p>
        <nav aria-label="Legal sections" className="mt-5">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {sectionLinks.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="hover:text-foreground focus-visible:ring-ring/50 text-muted-foreground rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {data.sections.map((section) => (
          <NoticeSection key={section.id} section={section} />
        ))}
        {hasOutstanding ? (
          <OutstandingNotices notices={data.outstandingNotices} />
        ) : null}
      </main>
      <LegalFooter />
    </div>
  );
}
