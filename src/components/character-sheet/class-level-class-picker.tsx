'use client';
import type { Id } from '@convex/_generated/dataModel';
import { ChevronDown, TriangleAlert } from 'lucide-react';
import {
  Fragment,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';
import { useBreakpoint } from '~/components/use-breakpoint';
import { cn } from '~/lib/utils';
import {
  listEntryRequirementGroups,
  PrerequisiteGroups,
} from './prerequisite-groups';
import { PrerequisiteProse } from './prerequisite-status';
import { chip, missingChoice } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Classes = ReturnType<typeof useCharacterSheet>['classes'];
type Choice = Classes['choices'][number];
type EntryRequirements = NonNullable<Choice['entryRequirements']>;

// A playing card (approved prototype): it lifts on hover and focus unless
// motion is reduced, and the chosen one is outlined and tinted. The class
// version chooser deals the same cards.
export const cardFrame =
  'bg-card border-foreground/25 hover:border-primary/60 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/15 flex min-w-0 flex-col border-2 transition-transform motion-safe:hover:-translate-y-0.5 motion-safe:has-[:focus-visible]:-translate-y-0.5 motion-reduce:transform-none';
export const cardChoice =
  'focus-visible:ring-ring/50 flex min-h-11 w-full min-w-0 cursor-pointer touch-manipulation flex-col items-start gap-1 px-2.5 py-2 text-left outline-none select-none focus-visible:ring-[3px] focus-visible:ring-inset';

const arrowSteps: Record<string, number> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

// Arrows, Home and End move between the cards without choosing one: a
// choice on a Class Level saves, so only Enter, Space or a tap chooses.
export function moveBetweenCards(event: KeyboardEvent<HTMLElement>) {
  const cards = [
    ...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'),
  ];
  if (!(event.target instanceof HTMLElement)) return;
  const index = cards.indexOf(event.target);
  if (index < 0) return;
  const step = arrowSteps[event.key];
  let next: number | null = null;
  if (step !== undefined) next = (index + step + cards.length) % cards.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = cards.length - 1;
  if (next === null) return;
  event.preventDefault();
  cards[next]?.focus();
}

function hasRequirementDetail(requirements: EntryRequirements | null) {
  return (
    requirements !== null &&
    (requirements.prerequisiteText.trim() !== '' ||
      requirements.checks.length > 0 ||
      requirements.currentStatus !== null)
  );
}

/** "Entry requirements met" or "…not met"; nothing while it is unresolved. */
function EntryStatus({ requirements }: { requirements: EntryRequirements }) {
  if (requirements.label === null) return null;
  const isUnmet = requirements.status === 'unmet';
  return (
    <span
      className={cn(
        chip,
        'gap-1',
        isUnmet
          ? 'border-amber-300/60 text-amber-300'
          : 'text-muted-foreground',
      )}
    >
      {isUnmet ? <TriangleAlert aria-hidden className="size-3" /> : null}
      {requirements.label}
    </span>
  );
}

/**
 * One class as a card: its name, hit die, Prestige Class or Unchained
 * marker and entry status, and, behind its own toggle, the requirement's
 * wording and the clauses checked at the level it would be entered. An
 * unmet requirement warns; the card can still be chosen.
 */
function ClassCard({
  name,
  choice,
  requirements,
  isChecked,
  isTabStop,
  onChoose,
}: {
  name: string;
  choice: Choice | null;
  requirements: EntryRequirements | null;
  isChecked: boolean;
  isTabStop: boolean;
  onChoose: () => void;
}) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const hitDie = choice?.hitDie ?? null;
  const isUnchained = choice?.isUnchained ?? false;
  const hasDetail = hasRequirementDetail(requirements);
  const facts = [
    hitDie !== null && {
      key: 'hitDie',
      node: <span className="text-muted-foreground font-mono">d{hitDie}</span>,
    },
    choice?.classKind === 'prestige' && {
      key: 'prestige',
      node: <span className={chip}>Prestige Class</span>,
    },
    isUnchained && {
      key: 'unchained',
      node: <span className={chip}>Unchained</span>,
    },
    requirements?.label && {
      key: 'entry',
      node: <EntryStatus requirements={requirements} />,
    },
    choice?.unavailableReason && {
      key: 'retired',
      node: (
        <span className="text-muted-foreground">
          {choice.unavailableReason}
        </span>
      ),
    },
  ].filter((fact) => typeof fact === 'object' && fact !== null);
  const isUnavailable = Boolean(choice?.unavailableReason);
  return (
    <div className={cardFrame}>
      <button
        type="button"
        role="radio"
        aria-checked={isChecked}
        aria-labelledby={`${id}-name`}
        aria-describedby={facts.length > 0 ? `${id}-facts` : undefined}
        tabIndex={isTabStop ? 0 : -1}
        disabled={isUnavailable}
        aria-disabled={isUnavailable || undefined}
        className={cn(
          cardChoice,
          isUnavailable && 'cursor-not-allowed opacity-60',
        )}
        onClick={onChoose}
      >
        <span
          id={`${id}-name`}
          className={cn(
            'font-sans text-base leading-tight [overflow-wrap:anywhere]',
            choice === null && 'text-muted-foreground',
          )}
        >
          {name}
        </span>
        <span
          id={`${id}-facts`}
          className="flex min-w-0 flex-wrap items-center gap-1 text-xs"
        >
          {facts.map((fact, index) => (
            // Spaced, so the description reads as separate facts.
            <Fragment key={fact.key}>
              {index > 0 ? ' ' : null}
              {fact.node}
            </Fragment>
          ))}
        </span>
      </button>
      {requirements && hasDetail ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={isOpen}
            aria-controls={`${id}-detail`}
            className="text-muted-foreground min-h-10 justify-start rounded-none px-2.5 text-xs font-normal md:min-h-8"
            onClick={() => setIsOpen((open) => !open)}
          >
            <ChevronDown
              aria-hidden
              className={cn(
                'size-3.5 transition-transform motion-reduce:transition-none',
                isOpen && 'rotate-180',
              )}
            />
            Entry requirements <span className="sr-only">for {name}</span>
          </Button>
          <div
            id={`${id}-detail`}
            hidden={!isOpen}
            className="border-foreground/10 flex min-w-0 flex-col gap-1.5 border-t px-2.5 py-2"
          >
            <PrerequisiteProse text={requirements.prerequisiteText} />
            <PrerequisiteGroups
              groups={listEntryRequirementGroups(requirements)}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * The cards inside the open picker: Unspecified, then every class the
 * Character can take, original and Unchained apart. The next level's cards
 * carry their appended entry status; a Class Level's cards preview entry at
 * that level. Nothing here writes or changes the sheet.
 */
function ClassPickerPanel({
  label,
  value,
  classes,
  entryId,
  onChoose,
}: {
  label: string;
  value: Id<'catalogEntry'> | null;
  classes: Classes;
  entryId?: Id<'characterSheetEntry'>;
  onChoose: (classEntryId: Id<'catalogEntry'> | null) => void;
}) {
  const isWide = useBreakpoint('wide');
  const cards = useRef<HTMLDivElement>(null);
  const checked = classes.choices.some(
    (choice) => choice.classEntryId === value,
  )
    ? value
    : null;
  const side = isWide ? 'right' : 'bottom';
  const isEmpty =
    !classes.isLoading &&
    !classes.isUnavailable &&
    classes.choices.length === 0;
  return (
    <SheetContent
      side={side}
      data-side={side}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        cards.current
          ?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
          ?.focus();
      }}
      className={cn(
        'gap-0',
        isWide
          ? 'w-full sm:max-w-md'
          : 'max-h-[85dvh] pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <SheetHeader className="pr-12">
        <SheetTitle className="font-sans text-xl font-normal">
          {label}
        </SheetTitle>
        <SheetDescription>
          Entry requirements are advice: every class can be chosen.
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 overflow-y-auto px-4 pb-6">
        {isEmpty ? (
          <p className="text-muted-foreground mb-2 text-sm">
            No classes available.
          </p>
        ) : null}
        <div
          ref={cards}
          role="radiogroup"
          aria-label={label}
          className="grid grid-cols-2 items-start gap-2 p-1"
          onKeyDown={moveBetweenCards}
        >
          <ClassCard
            name="Unspecified"
            choice={null}
            requirements={null}
            isChecked={checked === null}
            isTabStop={checked === null}
            onChoose={() => onChoose(null)}
          />
          {classes.choices.map((choice) => (
            <ClassCard
              key={choice.classEntryId}
              name={choice.name}
              choice={choice}
              requirements={
                entryId && choice.classKind === 'prestige'
                  ? classes.preview(choice.classEntryId, entryId)
                  : choice.entryRequirements
              }
              isChecked={checked === choice.classEntryId}
              isTabStop={checked === choice.classEntryId}
              onChoose={() => onChoose(choice.classEntryId)}
            />
          ))}
        </div>
      </div>
    </SheetContent>
  );
}

/**
 * A class chooser that keeps the row's compact footprint: the field shows
 * the chosen class and opens its cards in the side panel (a bottom sheet on
 * the phone). Choosing a card closes the panel and hands the class to the
 * caller, which stages the next level's class or saves a Class Level's.
 * Unspecified stays a choice.
 */
export function ClassPicker({
  label,
  value,
  classes,
  entryId,
  disabled,
  isMissing = false,
  className,
  onValueChange,
  renderTrigger = (trigger) => trigger,
}: {
  label: string;
  value: Id<'catalogEntry'> | null;
  classes: Classes;
  /** The Class Level being edited; omitted for the next level. */
  entryId?: Id<'characterSheetEntry'>;
  disabled: boolean;
  isMissing?: boolean;
  className?: string;
  onValueChange: (classEntryId: Id<'catalogEntry'> | null) => void;
  /** Wraps the trigger, for a form's control slot. */
  renderTrigger?: (trigger: ReactNode) => ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = classes.choices.find(
    (choice) => choice.classEntryId === value,
  );
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {renderTrigger(
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label={label}
            disabled={disabled}
            className={cn(
              'h-10 w-full min-w-0 justify-between gap-1 rounded-none px-3 font-mono text-sm font-normal md:h-8',
              isMissing && missingChoice,
              !selected && 'text-muted-foreground',
              className,
            )}
          >
            <span className="min-w-0 truncate">
              {selected?.name ?? 'Unspecified'}
            </span>
            <ChevronDown aria-hidden className="size-4 opacity-50" />
          </Button>
        </SheetTrigger>,
      )}
      {isOpen ? (
        <ClassPickerPanel
          label={label}
          value={value}
          classes={classes}
          entryId={entryId}
          onChoose={(classEntryId) => {
            setIsOpen(false);
            onValueChange(classEntryId);
          }}
        />
      ) : null}
    </Sheet>
  );
}
