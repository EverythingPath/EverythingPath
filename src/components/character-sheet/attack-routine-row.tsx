'use client';
import { SquarePen, X } from 'lucide-react';
import { useId } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { AttackFlurryLine, AttackLine, AttackRendLine } from './attack-line';
import { AttackRateNotes } from './attack-rate-notes';
import {
  handsLabels,
  listAttackRoutineWarnings,
  modeLabels,
} from './attack-routine-view-model';
import { InlineWarnings } from './inline-warning';
import { action, chip, fieldLabel, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Attacks = Controller['attacks'];
type Row = Attacks['rows'][number];

const iconButton = 'size-11 shrink-0 md:size-8';

/**
 * The routine's switched-on Routine Options beside its name (approved
 * prototype's routine card): primary when in effect, muted with an amber dot
 * when a warning or note explains why it changes nothing.
 */
function OptionChips({ chips }: { chips: Row['optionChips'] }) {
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Routine Options" className="flex flex-wrap gap-1">
      {chips.map((option) => (
        <li
          key={option.catalogEntryId}
          className={cn(
            chip,
            'gap-1',
            option.isInEffect
              ? 'border-primary/60 text-primary'
              : 'text-muted-foreground border-dashed',
          )}
        >
          {option.isInEffect ? null : (
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-amber-300"
            />
          )}
          {option.label}
          {option.isInEffect ? null : (
            <span className="sr-only">, no effect</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * One sequence of attacks under its heading. A full attack shaped by a
 * flurry of blows (#414) says so in the heading, "Full attack · Flurry of
 * Blows", and the flurry's own line heads the numbered attacks.
 */
function AttackList({
  title,
  lines,
  row,
  sequence,
  flurry = null,
}: {
  title: string;
  lines: Row['singleView'];
  row: Row;
  sequence: 'single' | 'full';
  flurry?: Row['flurry'];
}) {
  const id = useId();
  const hasOffHand = lines.some((line) => line.hand === 'off');
  return (
    <div>
      <p id={id} className={fieldLabel}>
        {flurry ? `${title} · ${flurry.name}` : title}
      </p>
      {flurry ? (
        <AttackFlurryLine
          flurry={flurry}
          routineName={row.name}
          entryId={row.entryId}
        />
      ) : null}
      <ol aria-labelledby={id} className="divide-foreground/10 divide-y">
        {lines.map((line) => (
          <AttackLine
            key={line.position ?? 0}
            line={line}
            routineName={row.name}
            sequence={sequence}
            count={lines.length}
            isHandShown={hasOffHand}
          />
        ))}
      </ol>
    </div>
  );
}

/**
 * One saved Attack Routine (approved prototype's routine card): its name,
 * weapon and how it is held, its ammunition, off hand, natural attacks and
 * range, Edit and Remove, its warnings and the resolver's reload or
 * throw-rate notes, then its single attack and its full attack in order:
 * the main hand's, the off hand's, then the natural attacks, and a Two-Weapon
 * Rend after the full attack. Its switched-on Routine Options are chips
 * beside the name, and the resolver's option notes follow the rate notes
 * (#407). With a flurry of blows switched on (#414) the single attack stays
 * the ordinary one and the full attack is the flurry, headed by its line.
 * A routine whose weapon is gone keeps its card with the warning and
 * a way to choose another weapon, and shows no attacks.
 */
export function AttackRoutineRow({
  row,
  attacks,
  warnings,
  warningController,
  onEdit,
  onRemoved,
}: {
  row: Row;
  attacks: Attacks;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  onEdit: () => void;
  /** After an acknowledged removal, when this card's controls are gone. */
  onRemoved?: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const status = attacks.statusFor(row.entryId);
  const isRemoving = status.kind === 'saving';
  const weapon = attacks.weapons.find(
    (candidate) => candidate.entryId === row.weaponEntryId,
  );
  const hasAttacks = row.singleView.length > 0;
  const offHandReference = row.offHand;
  const offHand = offHandReference
    ? offHandReference.kind === 'otherEnd'
      ? 'Other end'
      : (attacks.weapons.find(
          (candidate) => candidate.entryId === offHandReference.weaponEntryId,
        )?.label ?? 'No weapon')
    : null;
  // The ranged routine's ammunition, by its Gear row; a recorded row that is gone says so.
  const ammunition = row.ammunitionEntryId
    ? (attacks.ammunition.find(
        (candidate) => candidate.entryId === row.ammunitionEntryId,
      )?.label ?? 'No ammunition')
    : null;
  const naturals = row.naturalAttackEntryIds.map(
    (entryId) =>
      attacks.naturalAttacks.find((choice) => choice.entryId === entryId)
        ?.label ?? 'Unavailable natural attack',
  );
  const facts = [
    weapon?.label ?? 'No weapon',
    handsLabels[row.hands],
    modeLabels[row.mode],
    ...(ammunition ? [ammunition] : []),
    ...(offHand ? [`Off hand: ${offHand}`] : []),
    ...(naturals.length > 0 ? [`Natural: ${naturals.join(', ')}`] : []),
    ...(row.rangeIncrements > 1
      ? [`${row.rangeIncrements} range increments`]
      : []),
  ].join(' · ');

  async function remove() {
    if (await attacks.remove(row.entryId)) onRemoved?.();
  }

  return (
    <div className="border-foreground/15 border px-2 py-1">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 py-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-sans text-base leading-tight [overflow-wrap:anywhere]">
              {row.name}
            </h3>
            <OptionChips chips={row.optionChips} />
          </div>
          <p className="text-muted-foreground font-mono text-xs [overflow-wrap:anywhere]">
            {facts}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={iconButton}
          data-routine-edit={row.entryId}
          onClick={onEdit}
        >
          <SquarePen aria-hidden className="size-4" />
          <span className="sr-only">Edit {row.name}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`${iconButton} hover:text-destructive`}
          aria-describedby={reasonId}
          disabled={isRemoving || maintenance.readOnly}
          onClick={() => void remove()}
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">Remove {row.name}</span>
        </Button>
      </div>
      <InlineWarnings
        warnings={listAttackRoutineWarnings(warnings, row)}
        controller={warningController}
        className="pb-1"
      />
      <AttackRateNotes
        notes={row.attackRateNotes}
        label={`${row.name} attack rate`}
        className="pb-1"
      />
      <AttackRateNotes
        notes={row.optionNotes}
        label={`${row.name} options`}
        className="pb-1"
      />
      {hasAttacks ? (
        <div className="space-y-1 pb-1">
          <AttackList
            title="Single attack"
            lines={row.singleView}
            row={row}
            sequence="single"
          />
          <AttackList
            title="Full attack"
            lines={row.fullView}
            row={row}
            sequence="full"
            flurry={row.flurry}
          />
          {row.rendView ? (
            <AttackRendLine rend={row.rendView} routineName={row.name} />
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`${action} mb-1`}
          onClick={onEdit}
        >
          Choose a weapon <span className="sr-only">for {row.name}</span>
        </Button>
      )}
      <SaveFeedback
        status={status}
        savedText="Removed."
        savingText="Removing…"
        shouldHideWhenIdle
      />
    </div>
  );
}
