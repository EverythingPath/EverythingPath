'use client';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '~/components/ui/button';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { chip, fieldLabel, missingChoice } from './sheet-parts';
import {
  decodeTargetChoice,
  encodeTargetChoice,
  noTarget,
  type TargetChoice,
  type TargetOption,
} from './spell-effect-target-choice';

const card = 'min-h-11 justify-start px-3 py-2 text-left font-sans text-base';

/**
 * The phone's Target picker (#416): a button in the row that reads the
 * current target, and a bottom sheet listing every item part and the unarmed
 * strike as touch-sized cards, suitable ones first and the rest under "Other
 * items". Choosing saves at once and closes the sheet; Escape closes it.
 */
export function SpellEffectTargetSheet({
  name,
  display,
  value,
  isMissing,
  isDisabled,
  describedBy,
  suitable,
  unsuitable,
  onChoose,
}: {
  /** The Spell Effect's name, for the sheet's title. */
  name: string;
  /** What the field reads: the target's name, or what it waits for. */
  display: string;
  value: TargetChoice;
  isMissing: boolean;
  isDisabled: boolean;
  describedBy?: string;
  suitable: readonly TargetOption[];
  unsuitable: readonly TargetOption[];
  onChoose: (choice: TargetChoice) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const otherLabelId = useId();
  const choose = (next: string) => {
    const choice = decodeTargetChoice(next);
    if (!choice) return;
    setIsOpen(false);
    onChoose(choice);
  };
  const item = (option: TargetOption) => {
    const optionValue = encodeTargetChoice({ kind: 'part', ...option });
    return (
      <RadioGroupItem key={optionValue} value={optionValue} className={card}>
        <span className="flex w-full flex-wrap items-baseline gap-x-2">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {option.name}
          </span>
          {option.active ? null : (
            <span className={cn(chip, 'text-muted-foreground')}>
              not equipped
            </span>
          )}
        </span>
      </RadioGroupItem>
    );
  };
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <Button
        type="button"
        variant="outline"
        aria-label="Target"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-describedby={describedBy}
        disabled={isDisabled}
        className={cn(
          'h-11 w-full justify-between rounded-none font-mono text-sm',
          isMissing && missingChoice,
          isMissing && 'text-muted-foreground',
        )}
        onClick={() => setIsOpen(true)}
      >
        <span className="min-w-0 truncate">{display}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 opacity-50" />
      </Button>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-none p-4 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="p-0 pr-10">
          <SheetTitle className="font-sans text-xl font-normal">
            Target for {name}
          </SheetTitle>
          <SheetDescription>
            The item part the Spell Effect enhances; its numbers show on that
            part&apos;s lines.
          </SheetDescription>
        </SheetHeader>
        <RadioGroup
          aria-label="Target"
          value={encodeTargetChoice(value)}
          onValueChange={choose}
          className="grid-cols-1 gap-1 pb-4"
        >
          <RadioGroupItem value={encodeTargetChoice(noTarget)} className={card}>
            No target
          </RadioGroupItem>
          {suitable.map(item)}
          {unsuitable.length > 0 ? (
            <>
              <span id={otherLabelId} className={cn(fieldLabel, 'pt-2')}>
                Other items
              </span>
              <div
                role="group"
                aria-labelledby={otherLabelId}
                className="contents"
              >
                {unsuitable.map(item)}
              </div>
            </>
          ) : null}
        </RadioGroup>
      </SheetContent>
    </Sheet>
  );
}
