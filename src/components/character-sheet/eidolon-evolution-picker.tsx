'use client';
import type { ComponentProps } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { useBreakpoint } from '~/components/use-breakpoint';
import { EidolonEvolutionPickerBody } from './eidolon-evolution-picker-body';

/**
 * The evolution picker: a dialog from 768px and a bottom sheet on the
 * phone, with the curated evolutions as cards grouped by cost. Every card
 * stays selectable; an unmet stated requirement is only noted on it, and
 * the resolver's own issues stay authoritative once saved. Mounted while
 * open only, so a reopened picker starts afresh.
 */
export function EidolonEvolutionPicker({
  isOpen,
  onOpenChange,
  onCloseAutoFocus,
  ...body
}: Omit<
  ComponentProps<typeof EidolonEvolutionPickerBody>,
  'title' | 'onClose'
> & {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const isWide = useBreakpoint('wide');
  const title = 'Add an evolution';
  const description =
    'Requirements are advisory: every evolution stays available, and the sheet warns about what it does not meet.';
  const content = (
    <EidolonEvolutionPickerBody
      {...body}
      title={title}
      onClose={() => onOpenChange(false)}
    />
  );
  if (isWide)
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent
          className="bg-card flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-3xl"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <DialogHeader>
            <DialogTitle className="font-sans">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">{content}</div>
        </DialogContent>
      </Dialog>
    );
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card max-h-[85dvh] gap-0 rounded-t-lg pb-[env(safe-area-inset-bottom)]"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="font-sans">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto px-4 pt-1 pb-6">{content}</div>
      </SheetContent>
    </Sheet>
  );
}
