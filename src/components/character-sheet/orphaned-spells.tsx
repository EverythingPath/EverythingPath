'use client';
import { TriangleAlert, X } from 'lucide-react';
import { useId, useState } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
  useMaintenanceReasonId,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import type { ResolvedCollectionSpell } from '~/lib/character-sheet-spell-collections';
import { cn } from '~/lib/utils';
import { InlineWarnings } from './inline-warning';
import type { SaveStatus } from './save-status';
import { blockHeading, SaveFeedback } from './sheet-parts';
import { SpellName } from './spell-name';
import { useFocusAfterSpellRemoval } from './use-focus-after-spell-removal';
import { schoolChoice } from './use-character-spells-page';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type OrphanedSpellRow = ResolvedCollectionSpell & {
  warnings: SheetWarningView[];
  status: SaveStatus;
};

const orphanedSpellsTitle = 'Not under any Spellcasting';

function OrphanedSpell({
  spell,
  writes,
  warningController,
  remove,
}: {
  spell: OrphanedSpellRow;
  writes: Controller['spells'];
  warningController: Controller['warnings'];
  remove: (entryId: string, write: () => Promise<boolean>) => Promise<boolean>;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const panelId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const school = spell.school ? schoolChoice(spell.school) : null;
  const isDisabled = spell.status.kind === 'saving' || maintenance.readOnly;
  return (
    <li
      data-spell-entry={spell.entryId}
      className="border-foreground/10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b py-1 last:border-b-0"
    >
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <SpellName
          name={spell.name}
          panelId={panelId}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
        {spell.castingClassName ? (
          <span className="text-muted-foreground text-xs">
            recorded for {spell.castingClassName}
          </span>
        ) : null}
        {spell.description ? (
          <span
            className="text-muted-foreground hidden min-w-0 basis-full truncate text-sm md:block"
            title={spell.description}
          >
            {spell.description}
          </span>
        ) : null}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-11 gap-1 px-2 text-xs md:min-h-7"
        aria-describedby={reasonId}
        data-removal-focus
        disabled={isDisabled}
        onClick={() =>
          void remove(spell.entryId, () =>
            writes.remove({ entryId: spell.entryId, name: spell.name }),
          )
        }
      >
        <X aria-hidden className="size-3" />
        Remove <span className="sr-only">{spell.name}</span>
      </Button>
      {isExpanded ? (
        <p
          id={panelId}
          className="text-muted-foreground col-span-full pb-1 text-xs [overflow-wrap:anywhere] md:hidden"
        >
          {[school?.label, spell.description].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      <div className="col-span-full">
        <SaveFeedback
          status={spell.status}
          savedText="Saved."
          shouldHideWhenIdle
        />
      </div>
      <InlineWarnings
        warnings={spell.warnings}
        controller={warningController}
        className="col-span-full pb-1"
      />
    </li>
  );
}

/**
 * The one home of recorded Spells whose Spellcasting is gone or no longer
 * records them, identical on the sheet and on the Spells page: each with the
 * class it was recorded for, its warning and Remove. Nothing here is ever
 * removed by a class or list change. Framed, it is a block of its own (the
 * Spells page); otherwise a part of the sheet's Spellcasting block.
 */
export function OrphanedSpells({
  spells,
  writes,
  warningController,
  isFramed = false,
  className,
}: {
  spells: OrphanedSpellRow[];
  writes: Controller['spells'];
  warningController: Controller['warnings'];
  isFramed?: boolean;
  className?: string;
}) {
  const headingId = useId();
  const reasonId = useId();
  const maintenance = useInitialMigrationMaintenance();
  const focus = useFocusAfterSpellRemoval(spells.map((spell) => spell.entryId));
  if (spells.length === 0) return null;
  const Heading = isFramed ? 'h2' : 'h3';
  const group = (
    <section
      aria-labelledby={headingId}
      className={cn(
        isFramed && 'bg-card border border-amber-500/60 p-3',
        className,
      )}
    >
      <div ref={focus.container}>
        <Heading
          id={headingId}
          className={cn(
            blockHeading,
            'mb-1 flex items-center gap-1.5 text-amber-300',
          )}
        >
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          {orphanedSpellsTitle}
        </Heading>
        <ul>
          {spells.map((spell) => (
            <OrphanedSpell
              key={spell.entryId}
              spell={spell}
              writes={writes}
              warningController={warningController}
              remove={focus.remove}
            />
          ))}
        </ul>
      </div>
      {isFramed ? null : (
        <MaintenanceReason
          id={reasonId}
          notice={maintenance}
          className="mt-1 text-xs"
        />
      )}
    </section>
  );
  // The page states the maintenance reason once for every control on it;
  // on the sheet this group states its own.
  if (isFramed) return group;
  return <MaintenanceReasonScope id={reasonId}>{group}</MaintenanceReasonScope>;
}
