'use client';
import { X } from 'lucide-react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import type { CompanionsController } from './companion-props';

/** The confirmed creation, with its sheet one navigation away. */
export function CreatedCompanionNotice({
  controller,
}: {
  controller: CompanionsController;
}) {
  const created = controller.createdCompanion;
  if (!created) return null;
  return (
    <p
      role="status"
      className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sky-300"
    >
      <span>Companion created.</span>
      <GuardedLink href={created.href} className="underline underline-offset-4">
        Open Companion Sheet
      </GuardedLink>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-1.5 text-xs md:h-6"
        onClick={controller.dismissCreatedCompanion}
      >
        <X aria-hidden className="size-3.5" />
        Dismiss <span className="sr-only">created Companion notice</span>
      </Button>
    </p>
  );
}
