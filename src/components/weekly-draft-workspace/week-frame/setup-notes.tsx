'use client';
import { StickyNote } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';

/**
 * The notes recorded at setup, opened from a button beside the status. The
 * button exists only when notes exist; the dialog traps focus, closes on
 * Escape and returns focus to the button (Radix). Long notes scroll inside
 * the dialog at every size, so they no longer crowd the editor.
 */
export function SetupNotesButton({ notes }: { notes: string | undefined }) {
  if (!notes) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="short:h-7">
          <StickyNote aria-hidden />
          <span className="max-sm:sr-only">Setup notes</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup notes</DialogTitle>
          <DialogDescription>
            Recorded when the militia was set up.
          </DialogDescription>
        </DialogHeader>
        <p className="min-w-0 text-sm wrap-anywhere whitespace-pre-wrap">
          {notes}
        </p>
      </DialogContent>
    </Dialog>
  );
}
