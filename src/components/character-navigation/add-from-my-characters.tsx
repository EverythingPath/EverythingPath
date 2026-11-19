'use client';
import type { Id } from '@convex/_generated/dataModel';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogTrigger } from '~/components/ui/dialog';
import { AddFromMyCharactersDialog } from './add-from-my-characters-dialog';

// The campaign Characters page's Add from my characters, beside New
// character. Closing returns focus here; reopening starts with no choice.
export function AddFromMyCharacters(props: {
  campaignId: Id<'campaign'>;
  campaignName: string;
  organizationId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11 md:min-h-9">
          <UserPlus aria-hidden />
          Add from my characters
        </Button>
      </DialogTrigger>
      {isOpen ? <AddFromMyCharactersDialog {...props} /> : null}
    </Dialog>
  );
}
