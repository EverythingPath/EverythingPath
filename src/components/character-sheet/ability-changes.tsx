'use client';
import type { Id } from '@convex/_generated/dataModel';
import { Check, Plus, SquarePen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { abilityLabels } from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { AbilityChangeEditor } from './ability-change-editor';
import { action, Block, chip, RemoteNotice, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';
import type { AbilityChangeInput } from './use-character-sheet-entries';
import { useCreateThenEdit } from './use-create-then-edit';

type Controller = ReturnType<typeof useCharacterSheet>;
type Row = NonNullable<Controller['sheet']>['abilityChanges'][number];
type EntryId = Id<'characterSheetEntry'>;
type OpenEditor = { kind: 'new' } | { kind: 'entry'; entryId: EntryId } | null;

/** "Strength damage", "Constitution drain": the row's name on the sheet. */
function describeRow(row: Row) {
  const noun = row.kind === 'abilityDamage' ? 'damage' : 'drain';
  return `${abilityLabels[row.state.ability]} ${noun}`;
}

function describePoints(row: Row) {
  return `${row.state.points} ${row.state.points === 1 ? 'point' : 'points'}`;
}

/** "Strength damage, 3 points": the row's name with its visible value. */
function describeRowWithPoints(row: Row) {
  return `${describeRow(row)}, ${describePoints(row)}`;
}

// What the points do, in the row: damage to the modifier, drain to the score.
function describeConsequence(row: Row) {
  const points = describePoints(row);
  if (row.kind === 'abilityDrain')
    return `${points} · score −${row.state.points}`;
  return `${points} · modifier −${Math.floor(row.state.points / 2)}`;
}

function toInput(row: Row): AbilityChangeInput {
  return {
    kind: row.kind,
    ability: row.state.ability,
    points: row.state.points,
  };
}

function AbilityChangeRow({
  row,
  isBusy,
  isOpen,
  actions,
  onEdit,
}: {
  row: Row;
  isBusy: boolean;
  isOpen: boolean;
  actions: Controller['abilityChanges'];
  onEdit: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const name = describeRow(row);
  const isDisabled = isBusy || maintenance.readOnly;
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
      <button
        type="button"
        role="switch"
        aria-checked={row.active}
        aria-label={`${name}: ${row.active ? 'active' : 'inactive'}`}
        disabled={isDisabled}
        onClick={() => void actions.setActive(row._id, !row.active)}
        className={cn(
          'mt-0.5 inline-flex size-11 shrink-0 items-center justify-center border md:size-7',
          row.active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-foreground/40 hover:border-foreground text-transparent',
          'disabled:opacity-50',
        )}
      >
        <Check aria-hidden className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3
            className={cn(
              'font-sans text-base',
              row.active ? '' : 'text-muted-foreground',
            )}
          >
            {name}
          </h3>
          <span className={cn(chip, row.active ? '' : 'text-muted-foreground')}>
            {row.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-muted-foreground font-mono text-xs">
          {describeConsequence(row)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant={isOpen ? 'secondary' : 'ghost'}
          size="icon"
          className="size-11 md:size-8"
          aria-pressed={isOpen}
          onClick={onEdit}
        >
          <SquarePen aria-hidden className="size-4" />
          <span className="sr-only">Edit {name}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 md:size-8"
          disabled={isDisabled}
          onClick={() => void actions.remove(row._id)}
        >
          <Trash2 aria-hidden className="size-4" />
          <span className="sr-only">Remove {name}</span>
        </Button>
      </div>
    </div>
  );
}

// An existing entry keeps its kind, so only the ability and points are sent.
function NewAbilityChangeEditor({
  actions,
  onClose,
}: {
  actions: Controller['abilityChanges'];
  onClose: () => void;
}) {
  const creation = useCreateThenEdit({
    create: actions.create,
    edit: (entryId, { ability, points }: AbilityChangeInput) =>
      actions.edit(entryId, { ability, points }),
  });
  return <AbilityChangeEditor save={creation.save} onClose={onClose} isNew />;
}

// The editor lives below the list so another player's removal cannot take
// a draft with it; a removed entry's draft is offered to be closed.
function EntryEditor({
  entryId,
  rows,
  actions,
  onClose,
}: {
  entryId: EntryId;
  rows: Row[];
  actions: Controller['abilityChanges'];
  onClose: () => void;
}) {
  const row = rows.find((item) => item._id === entryId);
  return (
    <AbilityChangeEditor
      value={row ? toInput(row) : undefined}
      save={({ ability, points }) => actions.edit(entryId, { ability, points })}
      onClose={onClose}
      isNew={false}
      isRemoved={!row}
    />
  );
}

/**
 * Ability damage and drain: each entry names its ability and points, is
 * switched off and on, edited and removed in place. Damage leaves the score
 * and lowers the modifier; drain lowers the score. One editor is open at a
 * time, keyed by its entry.
 */
export function AbilityChanges({
  rows,
  actions,
}: {
  rows: Row[];
  actions: Controller['abilityChanges'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const [open, setOpen] = useState<OpenEditor>(null);
  const isBusy = actions.status.kind === 'saving';
  const close = () => setOpen(null);
  const openEntryId = open?.kind === 'entry' ? open.entryId : null;
  return (
    <Block title="Ability damage and drain">
      <div className="space-y-2">
        <RemoteNotice
          isShown={actions.hasRemoteChange}
          message="Ability damage and drain changed."
          subject="ability damage and drain"
          onDismiss={actions.dismissRemoteChange}
        />
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No ability damage or drain.
          </p>
        ) : (
          <ul className="divide-foreground/10 divide-y">
            {rows.map((row) => (
              <li key={row._id} aria-label={describeRowWithPoints(row)}>
                <AbilityChangeRow
                  row={row}
                  isBusy={isBusy}
                  isOpen={openEntryId === row._id}
                  actions={actions}
                  onEdit={() =>
                    setOpen(
                      openEntryId === row._id
                        ? null
                        : { kind: 'entry', entryId: row._id },
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {openEntryId !== null ? (
          <EntryEditor
            key={openEntryId}
            entryId={openEntryId}
            rows={rows}
            actions={actions}
            onClose={close}
          />
        ) : null}
        {open?.kind === 'new' ? (
          <NewAbilityChangeEditor
            key="new-ability-change"
            actions={actions}
            onClose={close}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={action}
            disabled={maintenance.readOnly || open?.kind === 'new'}
            onClick={() => setOpen({ kind: 'new' })}
          >
            <Plus aria-hidden className="size-4" />
            Add ability damage or drain
          </Button>
          <SaveFeedback status={actions.status} savedText="Saved." />
          <MaintenanceReason notice={maintenance} />
        </div>
      </div>
    </Block>
  );
}
