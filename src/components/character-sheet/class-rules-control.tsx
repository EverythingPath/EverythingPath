'use client';
import type { Id } from '@convex/_generated/dataModel';
import { ChevronDown } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
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
  cardChoice,
  cardFrame,
  moveBetweenCards,
} from './class-level-class-picker';
import { ClassSwitchPreview } from './class-switch-preview';
import type { SaveStatus } from './save-status';
import { action, chip, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Classes = ReturnType<typeof useCharacterSheet>['classes'];
type RulesChoice = ReturnType<Classes['rulesChoicesFor']>[number];

const idle: SaveStatus = { kind: 'idle' };

/** The class casts, or its levels advance another class's casting. */
function hasCastingLinks(classes: Classes, classEntryId: Id<'catalogEntry'>) {
  const detail = classes.choices.find(
    (choice) => choice.classEntryId === classEntryId,
  )?.definition.detail;
  if (!detail) return false;
  return (
    ('casting' in detail && detail.casting !== undefined) ||
    ('castingAdvances' in detail && detail.castingAdvances !== undefined)
  );
}

/**
 * One definition as a card: its label, where it lives, Unchained where its
 * label does not already say so, and whether it is the one in use.
 */
function RulesCard({
  choice,
  isChecked,
  isTabStop,
  onChoose,
}: {
  choice: RulesChoice;
  isChecked: boolean;
  isTabStop: boolean;
  onChoose: () => void;
}) {
  const id = useId();
  const isUnchainedUnsaid =
    choice.version === 'unchained' && !choice.label.includes('Unchained');
  return (
    <div className={cardFrame}>
      <button
        type="button"
        role="radio"
        aria-checked={isChecked}
        aria-label={choice.label}
        aria-describedby={`${id}-facts`}
        tabIndex={isTabStop ? 0 : -1}
        className={cardChoice}
        onClick={onChoose}
      >
        <span className="font-sans text-base leading-tight [overflow-wrap:anywhere]">
          {choice.label}
        </span>
        <span
          id={`${id}-facts`}
          className="flex min-w-0 flex-wrap items-center gap-1 text-xs"
        >
          {/* The spaces keep the facts apart in the description; the flex
              row ignores them. */}
          <span className="text-muted-foreground">{choice.origin}</span>
          {isUnchainedUnsaid ? (
            <>
              {' '}
              <span className={chip}>Unchained</span>
            </>
          ) : null}
          {choice.inUse ? (
            <>
              {' '}
              <span className={chip}>In use</span>
            </>
          ) : null}
        </span>
      </button>
    </div>
  );
}

/**
 * The open chooser: every version and every Catalog Copy of the class as
 * cards, and once another is chosen the preview of what the switch keeps
 * and recalculates with Switch all and Cancel. Choosing a card never saves.
 */
function RulesPanel({
  entryId,
  className,
  choices,
  classes,
  warnings,
  onSwitch,
  onCancel,
}: {
  entryId: Id<'characterSheetEntry'>;
  className: string;
  choices: RulesChoice[];
  classes: Classes;
  warnings: readonly SheetWarningView[];
  onSwitch: (classEntryId: Id<'catalogEntry'>) => void;
  onCancel: () => void;
}) {
  const isWide = useBreakpoint('wide');
  const cards = useRef<HTMLDivElement>(null);
  const previewId = useId();
  const [candidate, setCandidate] = useState<Id<'catalogEntry'> | null>(null);
  const inUseId = choices.find((choice) => choice.inUse)?.classEntryId;
  const checked = candidate ?? inUseId ?? null;
  const preview = candidate
    ? classes.previewRulesSwitch(entryId, candidate)
    : null;
  const side = isWide ? 'right' : 'bottom';
  const title = `Rules of ${className}`;
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
          {title}
        </SheetTitle>
        <SheetDescription>
          Every {className} level follows the same version and the same copy of
          it. Nothing changes until you switch.
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-6">
        <div
          ref={cards}
          role="radiogroup"
          aria-label={title}
          className="grid gap-2 p-1"
          onKeyDown={moveBetweenCards}
        >
          {choices.map((choice) => (
            <RulesCard
              key={choice.classEntryId}
              choice={choice}
              isChecked={checked === choice.classEntryId}
              isTabStop={checked === choice.classEntryId}
              onChoose={() =>
                setCandidate(choice.inUse ? null : choice.classEntryId)
              }
            />
          ))}
        </div>
        {candidate && preview ? (
          <div className="flex flex-col gap-3">
            <ClassSwitchPreview
              id={previewId}
              description={preview}
              className={className}
              warnings={warnings}
              hasCasting={hasCastingLinks(classes, candidate)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className={action}
                aria-describedby={previewId}
                onClick={() => onSwitch(candidate)}
              >
                Switch all {className} levels
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={action}
                onClick={onCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SheetContent>
  );
}

/**
 * The rules every Class Level of a class follows (#583): one version of the
 * class, original or Unchained, and one Catalog Copy of it, the campaign's,
 * the Character's own or the shared one, switched in one write and never
 * by editing each level. It sits once per class, on its first level. The
 * compact button opens the chooser in the side panel (a bottom sheet on the
 * phone); only Switch all saves. While the class is switching the control
 * waits, reports Saving…, the saved rules or the refusal with Retry, and
 * keeps its focus. The displayed rules are the saved ones until then.
 */
export function ClassRulesControl({
  entryId,
  className,
  classes,
  warnings,
  disabled,
}: {
  entryId: Id<'characterSheetEntry'>;
  /** The class's name, for "Rules of Fighter" and "Change all Fighter levels". */
  className: string;
  classes: Classes;
  /** The sheet's warnings, which name the ones a switch reopens or clears. */
  warnings: readonly SheetWarningView[];
  /** Maintenance, or a change to the Class Levels in flight. */
  disabled: boolean;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  // The definition this control last asked for: its feedback and its Retry.
  const [attempt, setAttempt] = useState<Id<'catalogEntry'> | null>(null);
  const choices = classes.rulesChoicesFor(entryId);
  const inUse = choices.find((choice) => choice.inUse);
  if (choices.length < 2 || !inUse) return null;
  const status = classes.statusFor(entryId);
  const isSaving = status.kind === 'saving';
  const isDisabled = disabled || maintenance.readOnly;
  const describedBy = [descriptionId, reasonId].filter(Boolean).join(' ');

  function switchTo(classEntryId: Id<'catalogEntry'>) {
    if (isDisabled || isSaving) return;
    setAttempt(classEntryId);
    void classes.switchRules(entryId, classEntryId);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (open && (isDisabled || isSaving)) return;
          setIsOpen(open);
        }}
      >
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-describedby={describedBy}
            // Saving keeps focus here: aria-disabled, not disabled.
            aria-disabled={isSaving || undefined}
            disabled={isDisabled}
            className={cn(
              'h-auto min-h-11 w-full min-w-0 justify-between gap-1 rounded-none px-2 text-xs font-normal whitespace-normal md:min-h-7',
              'aria-disabled:cursor-wait aria-disabled:opacity-60',
            )}
          >
            <span className="min-w-0 text-left [overflow-wrap:anywhere]">
              Rules used: {inUse.label}
            </span>
            <ChevronDown aria-hidden className="size-3.5 shrink-0 opacity-50" />
          </Button>
        </SheetTrigger>
        {isOpen ? (
          <RulesPanel
            entryId={entryId}
            className={className}
            choices={choices}
            classes={classes}
            warnings={warnings}
            onSwitch={(classEntryId) => {
              setIsOpen(false);
              switchTo(classEntryId);
            }}
            onCancel={() => setIsOpen(false)}
          />
        ) : null}
      </Sheet>
      <p id={descriptionId} className="text-muted-foreground text-xs">
        Change all {className} levels
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <SaveFeedback
          status={attempt ? status : idle}
          savedText="Class version saved."
          savingText="Saving…"
          shouldHideWhenIdle
        />
        {attempt && status.kind === 'error' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs md:h-6"
            aria-describedby={reasonId}
            disabled={isDisabled}
            onClick={() => switchTo(attempt)}
          >
            Retry <span className="sr-only">rules of {className}</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
