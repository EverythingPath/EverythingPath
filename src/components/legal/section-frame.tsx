import type { ReactNode } from 'react';

// A titled region with a stable id, so the in-page navigation can target it
// and the region takes its accessible name from the heading.
export function SectionFrame({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="mt-10 scroll-mt-4">
      <h2 id={headingId} className="border-foreground/15 border-b pb-2 text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}
