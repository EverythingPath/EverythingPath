'use client';
import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '~/lib/utils';
import { CombinedFormDetail } from './combined-form-detail';
import { CombinedFormFact } from './combined-form-fact';
import { CombinedFormMessages } from './combined-form-messages';
import { CompanionName } from './companion-name';
import type { CompanionsController } from './companion-props';
import {
  action,
  blockHeading,
  chip,
  fieldLabel,
  isUnresolvedValue,
  noteText,
} from './sheet-parts';

/**
 * The Synthesist's Combined Form (#421) on the summoner's sheet: a static
 * view of the summoner fused with its separately built eidolon, named
 * after the eidolon with a link to its sheet, each value saying which build
 * it comes from. Nothing here is edited or saved, and viewing it fuses
 * nothing. The glance shows size and the four combat numbers; one
 * disclosure opens the abilities, every statistic with its breakdown, the
 * skills, evolutions, linked values, features and the rules it follows.
 * An unresolved form says why, informationally, and reads Unresolved where
 * it cannot state a value; an inaccessible eidolon is named nowhere. A rule
 * the two builds break, such as an eidolon smaller than the synthesist, is
 * an amber advisory. Nothing renders for a sheet that is not a
 * Synthesist's, or while loading.
 */
export function CharacterCombinedForm({
  controller,
}: {
  controller: CompanionsController['combinedForm'];
}) {
  const { view } = controller;
  const headingId = useId();
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  if (!view) return null;
  const glance = view.statistics.filter((statistic) => statistic.isAtAGlance);
  return (
    <section
      aria-labelledby={headingId}
      className="border-foreground/10 mt-3 flex flex-col gap-3 border-t pt-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 id={headingId} className={blockHeading}>
            {view.title}
          </h3>
          <span
            className={cn(
              chip,
              isUnresolvedValue(view.size) && 'text-muted-foreground',
            )}
          >
            Size {view.size}
          </span>
        </div>
        {view.eidolon ? (
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={fieldLabel}>Eidolon</span>
            <CompanionName row={view.eidolon} />
          </span>
        ) : null}
      </header>
      <p className={noteText}>{view.readOnlyNotice}</p>
      <CombinedFormMessages messages={view.unresolved} />
      <CombinedFormMessages messages={view.advisories} tone="advisory" />
      {isOpen ? null : (
        <dl
          aria-label="Combined Form at a glance"
          className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4"
        >
          {glance.map((statistic) => (
            <CombinedFormFact
              key={statistic.key}
              label={statistic.label}
              value={statistic.value}
            >
              <CombinedFormMessages
                messages={statistic.messages}
                className="mt-1"
              />
            </CombinedFormFact>
          ))}
        </dl>
      )}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          action,
          'text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start font-mono text-xs',
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')}
        />
        All combined statistics
      </button>
      <div
        id={panelId}
        className={cn('flex flex-col gap-3', !isOpen && 'hidden')}
      >
        {isOpen ? <CombinedFormDetail view={view} /> : null}
      </div>
    </section>
  );
}
