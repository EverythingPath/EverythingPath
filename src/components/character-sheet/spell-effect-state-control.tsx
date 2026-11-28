'use client';
import type { Id } from '@convex/_generated/dataModel';
import { Gauge, RotateCcw } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { describeClass, ordinal } from '~/lib/character-sheet-spell-labels';
import { useBreakdownResolver } from './breakdown-resolver';
import type { SaveStatus } from './save-status';
import { SaveFeedback } from './sheet-parts';
import { SpellEffectStateEditor } from './spell-effect-state-editor';
import type { SpellEffectView } from './spell-effect-target-chips';
import type { SheetEntryStateInput } from './use-character-sheet-entries';

const compact =
  'text-muted-foreground hover:text-foreground h-11 gap-1 px-1.5 font-mono text-xs md:h-7';

// Duration class (data model, "Temporary Effects"), with what it means for
// the totals as the title.
const durationText = {
  temporary: 'Lasts one day or less',
  permanent: 'Lasts more than one day',
} as const;
const durationTitle = {
  temporary:
    'Counts in current totals only; militia facts, skill budgets and bonus spells leave it out',
  permanent: 'Counts in current and permanent totals',
} as const;

/**
 * Why a Spell Effect's caster level reads what it does (approved
 * spellcasting prototype's CL title): "Pre-filled 4: Summoner 4 casts
 * 2nd-level spells", or "Default CL 7" for an effect with no linked Spell.
 */
export function describeCasterLevelDefault(
  effect: Pick<SpellEffectView, 'defaultCasterLevel' | 'defaultSource'>,
  findCastingClassName: (classTag: string) => string | null,
) {
  const source = effect.defaultSource;
  if (!source) return `Default CL ${effect.defaultCasterLevel}`;
  const className = describeClass(source.classTag, findCastingClassName);
  return `Pre-filled ${effect.defaultCasterLevel}: ${className} ${source.classLevel} casts ${ordinal(source.spellLevel)}-level spells`;
}

/**
 * A Spell Effect row's caster level and duration (#308, #416): where its
 * default comes from, how long it lasts, Reset to the default once the
 * recorded level differs, and, for a shared definition, Edit caster level in
 * place. A Character-owned effect edits its level in the row's own editor.
 * Nothing here reads the caster's sheet: the level is a number cast at.
 */
export function SpellEffectStateControl({
  entryId,
  name,
  effect,
  hasOwnEditor,
  isDisabled,
  editState,
}: {
  entryId: Id<'characterSheetEntry'>;
  name: string;
  effect: SpellEffectView;
  /** The row's Edit covers the caster level, so no editor opens here. */
  hasOwnEditor: boolean;
  isDisabled: boolean;
  editState: (
    entryId: Id<'characterSheetEntry'>,
    input: SheetEntryStateInput,
  ) => Promise<unknown>;
}) {
  const { findCastingClassName } = useBreakdownResolver();
  const [isOpen, setIsOpen] = useState(false);
  const [reset, setReset] = useState<SaveStatus>({ kind: 'idle' });
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const isDefault = effect.casterLevel === effect.defaultCasterLevel;
  async function restoreDefault() {
    setReset({ kind: 'saving' });
    try {
      await editState(entryId, { casterLevel: null });
      setReset({ kind: 'saved' });
    } catch (error) {
      setReset({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'The reset was not saved.',
      });
    }
  }
  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-muted-foreground font-mono text-xs">
          {describeCasterLevelDefault(effect, findCastingClassName)} ·{' '}
          <span title={durationTitle[effect.duration]}>
            {durationText[effect.duration]}
          </span>
        </p>
        {isDefault ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={compact}
            disabled={isDisabled || reset.kind === 'saving'}
            onClick={() => void restoreDefault()}
          >
            <RotateCcw aria-hidden className="size-3.5" />
            Reset to {effect.defaultCasterLevel}
            <span className="sr-only">, caster level of {name}</span>
          </Button>
        )}
        {hasOwnEditor ? null : (
          <Button
            ref={toggle}
            type="button"
            variant={isOpen ? 'secondary' : 'ghost'}
            size="sm"
            className={compact}
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => setIsOpen(!isOpen)}
          >
            <Gauge aria-hidden className="size-3.5" />
            Edit caster level <span className="sr-only">{name}</span>
          </Button>
        )}
        <SaveFeedback
          status={reset}
          savedText="Caster level reset."
          shouldHideWhenIdle
        />
      </div>
      <div id={panelId}>
        {isOpen ? (
          <SpellEffectStateEditor
            key={entryId}
            entryId={entryId}
            name={name}
            casterLevel={effect.casterLevel}
            defaultCasterLevel={effect.defaultCasterLevel}
            editState={editState}
            onClose={() => {
              setIsOpen(false);
              toggle.current?.focus();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
