'use client';
import { ChevronRight, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { isCombatSituation } from '~/lib/character-sheet-situations';
import { cn } from '~/lib/utils';
import { SituationChoiceLabel } from './situation-choice-label';
import { fieldLabel } from './sheet-parts';
import type { SituationGroup } from './stat-breakdown-groups';
import type { useSituationSelection } from './use-situation-selection';

type Selection = ReturnType<typeof useSituationSelection>;

// Touch-sized on the phone, compact from 768px; a long circumstance wraps.
const choiceClass =
  'h-auto min-h-11 max-w-full justify-start rounded-none px-2 py-1 text-left font-mono text-sm leading-tight whitespace-normal md:min-h-9';
const pressedClass =
  'border-sky-400 bg-sky-400/15 text-sky-200 hover:bg-sky-400/25 hover:text-sky-100';

function SituationChoices({
  groups,
  selection,
  findPrerequisiteName,
}: {
  groups: readonly SituationGroup[];
  selection: Selection;
  findPrerequisiteName: (catalogEntryId: string) => string | null;
}) {
  return groups.map((group) => {
    const isPressed = selection.isSelected(group.key);
    return (
      <Button
        key={group.key}
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={isPressed}
        onClick={() => selection.toggle(group.key)}
        className={cn(choiceClass, isPressed && pressedClass)}
      >
        <span className="[overflow-wrap:anywhere]">
          <SituationChoiceLabel
            group={group}
            findPrerequisiteName={findPrerequisiteName}
          />
        </span>
      </Button>
    );
  });
}

/**
 * The sheet's Situation picker (approved prototype's toggle strip, with
 * several choices at once): each choice is a toggle; the numbers they
 * change show what they become, together, beside their normal number. The
 * built-in Combat situations are collapsed after the Character's own.
 * Picking never saves anything and nothing is implied by another choice.
 */
export function SituationPicker({
  groups,
  selection,
  findPrerequisiteName,
}: {
  groups: readonly SituationGroup[];
  selection: Selection;
  findPrerequisiteName: (catalogEntryId: string) => string | null;
}) {
  const [isCombatOpen, setIsCombatOpen] = useState(false);
  const combatId = useId();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  if (groups.length === 0) return null;
  const ordinary = groups.filter(
    (group) => !isCombatSituation(group.selection),
  );
  const combat = groups.filter((group) => isCombatSituation(group.selection));
  const hasSelection = selection.selectedKeys.length > 0;
  return (
    <section
      aria-labelledby={headingId}
      data-sheet-situations
      className="border-foreground/15 mb-3 space-y-1.5 border px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          ref={heading}
          id={headingId}
          tabIndex={-1}
          className={cn(fieldLabel, 'shrink-0 outline-none')}
        >
          See the sheet
        </h2>
        <SituationChoices
          groups={ordinary}
          selection={selection}
          findPrerequisiteName={findPrerequisiteName}
        />
        {combat.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={isCombatOpen}
            aria-controls={combatId}
            onClick={() => setIsCombatOpen(!isCombatOpen)}
            className={cn(fieldLabel, 'min-h-11 rounded-none px-1 md:min-h-9')}
          >
            <ChevronRight
              aria-hidden
              className={cn(
                'size-3.5 transition-transform',
                isCombatOpen && 'rotate-90',
              )}
            />
            Combat situations
          </Button>
        ) : null}
      </div>
      {combat.length > 0 ? (
        <div
          id={combatId}
          hidden={!isCombatOpen}
          className="flex flex-wrap items-center gap-2"
        >
          <SituationChoices
            groups={combat}
            selection={selection}
            findPrerequisiteName={findPrerequisiteName}
          />
        </div>
      ) : null}
      <div
        aria-live="polite"
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-300',
          !hasSelection && 'sr-only',
        )}
      >
        {hasSelection ? (
          <>
            <span className="[overflow-wrap:anywhere]">
              Numbers these Situations change show their result beside the
              normal number.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                selection.clear();
                heading.current?.focus();
              }}
              className="min-h-11 rounded-none border-sky-400/60 px-2 md:min-h-8"
            >
              <X aria-hidden className="size-3" />
              Clear Situations
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}
