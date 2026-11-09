'use client';
import { usePathname } from 'next/navigation';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';

const nouns: [suffix: string, noun: string][] = [
  ['/week', 'The week'],
  ['/history', 'Finished weeks'],
  ['/militia', 'The militia'],
  ['/characters', 'Characters'],
  ['/setup', 'Militia setup'],
];

// A page that throws keeps the campaign shell and its section links; the
// retry re-renders only this page.
export default function CampaignPageError({ reset }: { reset: () => void }) {
  const { reset: resetQueries } = useQueryErrorResetBoundary();
  const pathname = usePathname();
  const noun =
    nouns.find(([suffix]) => pathname.endsWith(suffix))?.[1] ?? 'The campaign';
  return (
    <main className="mx-auto w-full max-w-2xl p-4 md:p-6">
      <FailedLoadCard
        noun={noun}
        retry={() => {
          resetQueries();
          reset();
        }}
      />
    </main>
  );
}
