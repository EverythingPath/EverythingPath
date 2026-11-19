'use client';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { GuardedLink } from './navigation-guard';

/** A centred card for a page that can't show its content, with its actions. */
export function StateCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl p-4 md:p-6">
      <Card className="gap-4 p-6">
        <h1 className="text-xl [overflow-wrap:anywhere]">{title}</h1>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </Card>
    </main>
  );
}

export function BackToCampaigns() {
  return (
    <Button asChild variant="outline" className="min-h-11 md:min-h-9">
      <GuardedLink href="/campaigns">Back to campaigns</GuardedLink>
    </Button>
  );
}
