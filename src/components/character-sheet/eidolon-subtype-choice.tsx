'use client';
import { useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { useBreakpoint } from '~/components/use-breakpoint';
import {
  EidolonSubtypeCard,
  type UnchainedSubtypeChoice,
} from './eidolon-subtype-card';
import type { SaveStatus } from './save-status';
import { action, SaveFeedback } from './sheet-parts';

const prompt = 'text-xs text-sky-300 [overflow-wrap:anywhere]';

function SubtypeCards({
  subtypes,
  isDisabled,
  reasonId,
  isSingleColumn,
  onChoose,
}: {
  subtypes: readonly UnchainedSubtypeChoice[];
  isDisabled: boolean;
  reasonId: string | undefined;
  isSingleColumn: boolean;
  onChoose: (subtype: UnchainedSubtypeChoice['value']) => void;
}) {
  return (
    <ul
      aria-label="Subtypes"
      className={
        isSingleColumn
          ? 'grid grid-cols-1 gap-2'
          : 'grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3'
      }
    >
      {subtypes.map((subtype) => (
        <li key={subtype.value} className="flex">
          <EidolonSubtypeCard
            subtype={subtype}
            isDisabled={isDisabled}
            reasonId={reasonId}
            onChoose={() => onChoose(subtype.value)}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The Unchained eidolon's subtype, asked for once it has a base form and
 * before anything counts from it: a prompt in the sheet's blue, then the
 * twelve subtypes as cards. From 768px the cards sit in a grid beneath the
 * prompt; on the phone a control opens them as a single column in a bottom
 * sheet, and focus returns to that control when it closes. Choosing a card
 * saves the whole record with the subtype; every other choice is kept.
 */
export function EidolonSubtypeChoice({
  subtypes,
  isDisabled,
  reasonId,
  status,
  onChoose,
}: {
  subtypes: readonly UnchainedSubtypeChoice[];
  isDisabled: boolean;
  reasonId: string | undefined;
  status: SaveStatus;
  onChoose: (subtype: UnchainedSubtypeChoice['value']) => Promise<boolean>;
}) {
  const isWide = useBreakpoint('wide');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const title = 'Choose a subtype';
  const description =
    'The subtype decides the eidolon’s alignment, the base forms it may take and the evolutions it gains by summoner level.';
  async function choose(subtype: UnchainedSubtypeChoice['value']) {
    if (await onChoose(subtype)) setIsSheetOpen(false);
  }
  return (
    <div className="flex flex-col gap-2">
      <p className={prompt}>Choose the eidolon’s subtype.</p>
      {isWide ? (
        <SubtypeCards
          subtypes={subtypes}
          isDisabled={isDisabled}
          reasonId={reasonId}
          isSingleColumn={false}
          onChoose={(subtype) => void choose(subtype)}
        />
      ) : (
        <>
          <Button
            ref={opener}
            type="button"
            size="sm"
            variant="outline"
            className={action}
            aria-describedby={reasonId}
            disabled={isDisabled}
            onClick={() => setIsSheetOpen(true)}
          >
            {title}
          </Button>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetContent
              side="bottom"
              className="bg-card max-h-[85dvh] gap-0 rounded-t-lg pb-[env(safe-area-inset-bottom)]"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                opener.current?.focus();
              }}
            >
              <SheetHeader className="pr-12">
                <SheetTitle className="font-sans">{title}</SheetTitle>
                <SheetDescription>{description}</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 overflow-y-auto px-4 pt-1 pb-6">
                <SubtypeCards
                  subtypes={subtypes}
                  isDisabled={isDisabled}
                  reasonId={reasonId}
                  isSingleColumn
                  onChoose={(subtype) => void choose(subtype)}
                />
                <SaveFeedback
                  status={status}
                  savedText="Saved"
                  savingText="Saving…"
                  shouldHideWhenIdle
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
      <SaveFeedback
        status={isSheetOpen ? { kind: 'idle' } : status}
        savedText="Saved"
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </div>
  );
}
