'use client';

import { useCallback, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { AccountActions } from './account-actions';
import {
  phoneTabClass,
  phoneTabIdleClass,
} from './app-navigation-presentation';
import { MoreGroup } from './more-group';
import { BeforeDeparture } from './navigation-guard';
import { OrganizationControl } from './shell-frame';

// Organization and account, the same in every place. Any choice that
// commits a departure closes the sheet first; focus returns to More.
export function MoreTab() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={cn(phoneTabClass, phoneTabIdleClass)}>
        <MoreHorizontal className="size-5" aria-hidden />
        More
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
          <SheetDescription>Organization and account.</SheetDescription>
        </SheetHeader>
        <BeforeDeparture onCommit={close}>
          <div className="flex flex-col px-4 pb-4">
            <MoreGroup label="Organization">
              <OrganizationControl fill />
            </MoreGroup>
            <MoreGroup label="Account">
              <AccountActions />
            </MoreGroup>
          </div>
        </BeforeDeparture>
      </SheetContent>
    </Sheet>
  );
}
