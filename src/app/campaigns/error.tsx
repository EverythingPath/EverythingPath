'use client';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';

export default function CampaignsError({ reset }: { reset: () => void }) {
  const { reset: resetQueries } = useQueryErrorResetBoundary();
  return (
    <main className="mx-auto w-full max-w-2xl p-4 md:p-6">
      <FailedLoadCard
        noun="Campaigns"
        retry={() => {
          resetQueries();
          reset();
        }}
      />
    </main>
  );
}
