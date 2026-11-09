'use client';

import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import type { MilitiaExplanation } from './app-navigation-presentation';
import { GuardedLink } from './navigation-guard';

// Why the Militia tab is dimmed, in the model's words, and the way on.
export function MilitiaUnavailableSheet({
  explanation,
  onClose,
}: {
  explanation: MilitiaExplanation | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={explanation !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {explanation ? (
        <SheetContent
          side="bottom"
          className="pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <SheetHeader>
            <SheetTitle>{explanation.title}</SheetTitle>
            <SheetDescription>{explanation.message}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <Button asChild variant="outline" className="min-h-11 w-full">
              <GuardedLink href={explanation.switchHref} onClick={onClose}>
                Switch campaign
              </GuardedLink>
            </Button>
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
