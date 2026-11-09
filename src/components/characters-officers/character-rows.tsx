import {
  Check,
  ChevronRight,
  CircleAlert,
  Info,
  Minus,
  Pencil,
} from 'lucide-react';
import { useId } from 'react';
import {
  GuardedLink,
  useNavigationGuard,
} from '~/components/campaign-shell/navigation-guard';
import { NeedsOwnerBadge } from '~/components/character-navigation/character-state-badge';
import { CharacterOwnerControl } from '~/components/character-sheet/character-owner-control';
import { useCharacterOwnership } from '~/components/character-sheet/use-character-ownership';
import { BuildOutControl } from '~/components/character-sheet/build-out-control';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { abilityLabels, type Ability } from '~/lib/character-sheet-abilities';
import {
  managesText,
  ROLE_LABELS,
  type OfficerRole,
} from '~/lib/officer-board';
import { cn } from '~/lib/utils';
import { action, ArchivedBadge, chip, roleCardId, Warnings } from './parts';
import type { RosterRowControl } from './use-character-corrections';
import type {
  CharactersPage,
  MilitiaCharacterRow,
} from './use-characters-page';

export type RowsProps = {
  rows: MilitiaCharacterRow[];
  /**
   * Whether the militia exists: without it there is no roster to be on and
   * no role card for a chip to reach.
   */
  hasBoard: boolean;
  teamsHref: string;
  onEdit: (characterId: string) => void;
  /** A row's controls while Correct roster is open; null otherwise. */
  rosterRow: ((characterId: string) => RosterRowControl | null) | null;
  buildOut: CharactersPage['buildOut'];
};

/** The six permanent scores in sheet order, with their short labels. */
const SCORES = [
  ['strength', 'STR'],
  ['dexterity', 'DEX'],
  ['constitution', 'CON'],
  ['intelligence', 'INT'],
  ['wisdom', 'WIS'],
  ['charisma', 'CHA'],
] as const satisfies readonly (readonly [Ability, string])[];

const dash = <span className="text-muted-foreground">—</span>;

// A value the Character's sheet cannot calculate yet. Muted, never amber: it
// is not a rules warning, and it blocks nothing by itself.
function Unresolved({ label }: { label: string }) {
  return (
    <span
      aria-label={`${label} unresolved`}
      className="text-muted-foreground font-mono text-xs"
    >
      Unresolved
    </span>
  );
}

// One permanent score: the number, or Unresolved in its place. The number
// the row still carries for an unresolved score is a partial total, never
// the score.
function ScoreValue({
  row,
  ability,
}: {
  row: MilitiaCharacterRow;
  ability: Ability;
}) {
  if (row.unresolvedAbilities.includes(ability))
    return <Unresolved label={abilityLabels[ability]} />;
  return row.scores[ability];
}

// "5 HD", "0 HD" for an explicit roster override, or Unresolved when the
// sheet cannot calculate the Hit Dice yet and no override stands in.
function HitDiceValue({ hitDice }: { hitDice: number | null }) {
  if (hitDice === null) return <Unresolved label="Hit Dice" />;
  return <span className="font-mono whitespace-nowrap">{hitDice} HD</span>;
}

// Why a row reads Unresolved somewhere, with the way to the sheet where
// the value is supplied.
function CalculationNote({ row }: { row: MilitiaCharacterRow }) {
  if (row.unresolvedAbilities.length === 0 && row.hitDice !== null) return null;
  return (
    <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        Some values can’t be calculated from this sheet yet.
        {row.sheetHref && (
          <>
            {' '}
            <GuardedLink
              href={row.sheetHref}
              aria-label={`Open sheet for ${row.name}`}
              className="hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-sm underline underline-offset-4 outline-none focus-visible:ring-[3px] md:min-h-0"
            >
              Open sheet
            </GuardedLink>
          </>
        )}
      </span>
    </p>
  );
}
const switchControl =
  'border-foreground/40 bg-foreground/10 before:bg-foreground checked:border-primary checked:bg-primary checked:before:bg-primary-foreground focus-visible:ring-ring/50 relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full border outline-none transition-colors before:absolute before:top-0.5 before:left-0.5 before:size-4.5 before:rounded-full before:transition-transform checked:before:translate-x-4 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50';

// Brings the role's card into view and moves focus to it.
function showRoleCard(role: OfficerRole) {
  const card = document.getElementById(roleCardId(role));
  if (!card) return;
  card.scrollIntoView({ block: 'center' });
  card.focus({ preventScroll: true });
}

function OwnerCell({
  row,
  isLabelled = false,
}: {
  row: MilitiaCharacterRow;
  isLabelled?: boolean;
}) {
  const ownership = useCharacterOwnership(
    row.ownershipScope,
    row.owner,
    row.ownerLastOperationId,
    row.ownershipAvailable,
  );
  return (
    <CharacterOwnerControl
      characterName={row.name}
      ownership={ownership}
      isLabelled={isLabelled}
      needsOwnerLabel={<NeedsOwnerBadge />}
    />
  );
}

function KindChip({ kind }: { kind: MilitiaCharacterRow['kind'] }) {
  return (
    <span className={cn(chip, kind === 'pc' && 'border-primary text-primary')}>
      {kind === 'pc' ? 'PC' : 'NPC'}
    </span>
  );
}

function OnRoster({ onRoster }: { onRoster: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {onRoster ? (
        <Check aria-hidden className="size-4 shrink-0" />
      ) : (
        <Minus aria-hidden className="text-muted-foreground size-4 shrink-0" />
      )}
      {onRoster ? 'On roster' : 'Not on roster'}
    </span>
  );
}

// Correct roster: the membership switch, with why a record cannot join yet.
function RosterSwitch({
  name,
  control,
}: {
  name: string;
  control: RosterRowControl;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const blocked = control.cannotJoin !== null;
  return (
    <div className="grid gap-1">
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm select-none md:min-h-0">
        <input
          type="checkbox"
          role="switch"
          className={switchControl}
          aria-label={`${name} on roster`}
          checked={control.onRoster}
          disabled={blocked}
          aria-describedby={blocked ? noteId : undefined}
          onChange={(event) => control.setOnRoster(event.target.checked)}
        />
        {control.onRoster ? 'On roster' : 'Not on roster'}
      </label>
      {blocked && (
        <p
          id={noteId}
          className="text-muted-foreground max-w-56 text-xs [overflow-wrap:anywhere] whitespace-normal"
        >
          {control.cannotJoin}
        </p>
      )}
    </div>
  );
}

// Correct roster: the Hit Dice override, its error kept within the cell.
function HitDiceField({
  field,
}: {
  field: NonNullable<RosterRowControl['hitDice']>;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1">
      <span className="inline-flex items-center gap-1.5">
        <Input
          {...field.register}
          id={id}
          inputMode="numeric"
          placeholder={field.placeholder}
          aria-label={field.label}
          aria-invalid={field.error ? true : undefined}
          aria-describedby={field.error ? errorId : undefined}
          className="h-11 w-16 font-mono md:h-9"
        />
        <span className="font-mono text-sm">HD</span>
      </span>
      {field.error && (
        <p
          id={errorId}
          className="text-destructive flex max-w-48 items-start gap-1 text-xs [overflow-wrap:anywhere] whitespace-normal"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{field.error}</span>
        </p>
      )}
    </div>
  );
}

function HitDice({
  row,
  control,
}: {
  row: MilitiaCharacterRow;
  control: RosterRowControl | null;
}) {
  if (control?.hitDice) return <HitDiceField field={control.hitDice} />;
  return <HitDiceValue hitDice={row.hitDice} />;
}

function RoleChips({
  roles,
  hasBoard,
}: {
  roles: OfficerRole[];
  hasBoard: boolean;
}) {
  if (!hasBoard || roles.length === 0) return dash;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {roles.map((role) => (
        <button
          key={role}
          type="button"
          title={`Show the ${ROLE_LABELS[role]} card`}
          className={cn(
            chip,
            'focus-visible:ring-ring/50 hover:bg-foreground/5 min-h-11 outline-none focus-visible:ring-[3px] md:min-h-0',
          )}
          onClick={() => showRoleCard(role)}
        >
          {ROLE_LABELS[role]}
        </button>
      ))}
    </span>
  );
}

function Teams({
  manages,
  href,
}: {
  manages: MilitiaCharacterRow['manages'];
  href: string;
}) {
  if (manages === null) return dash;
  return (
    <GuardedLink
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center text-sm underline underline-offset-4 md:min-h-0',
        manages.count > manages.limit && 'text-amber-300',
      )}
    >
      {managesText(manages)}
    </GuardedLink>
  );
}

// The phone card's Level and six scores, the same facts as the table's
// columns, labelled above each number.
function ScoresGrid({ row }: { row: MilitiaCharacterRow }) {
  return (
    <dl className="grid grid-cols-7 gap-1 text-center">
      {[
        ['Level', 'Level', row.level] as const,
        ...SCORES.map(
          ([ability, text]) =>
            [
              ability,
              text,
              <ScoreValue row={row} ability={ability} />,
            ] as const,
        ),
      ].map(([key, text, value]) => (
        <div key={key} className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground font-mono text-[11px] uppercase">
            {text}
          </dt>
          <dd className="font-mono text-base">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Build out, one way, from the row: an accepted change opens the sheet it
// made; a refusal stays here beside the button that asked.
function BuildOutButton({
  row,
  buildOut,
}: {
  row: MilitiaCharacterRow;
  buildOut: RowsProps['buildOut'];
}) {
  const guard = useNavigationGuard();
  return (
    <BuildOutControl
      name={row.name}
      isMine={buildOut.characterId === row.characterId}
      buildOut={{
        ...buildOut,
        run: () =>
          buildOut.run(row.characterId).then((characterId) => {
            if (characterId && row.sheetHref) guard.navigate(row.sheetHref);
          }),
      }}
    />
  );
}

function SheetLink({ name, href }: { name: string; href: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className={action}>
      <GuardedLink href={href} aria-label={`Sheet for ${name}`}>
        Sheet
        <ChevronRight aria-hidden />
      </GuardedLink>
    </Button>
  );
}

// A minimal Character builds out from here; a full one opens its sheet.
function SheetAction({
  row,
  buildOut,
}: {
  row: MilitiaCharacterRow;
  buildOut: RowsProps['buildOut'];
}) {
  if (row.canBuildOut) return <BuildOutButton row={row} buildOut={buildOut} />;
  if (row.sheetHref) return <SheetLink name={row.name} href={row.sheetHref} />;
  return null;
}

function RowActions({
  row,
  buildOut,
  onEdit,
  className,
}: {
  row: MilitiaCharacterRow;
  buildOut: RowsProps['buildOut'];
  onEdit: RowsProps['onEdit'];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      <SheetAction row={row} buildOut={buildOut} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 md:size-9"
        aria-label={`Edit ${row.name}`}
        onClick={() => onEdit(row.characterId)}
      >
        <Pencil />
      </Button>
    </div>
  );
}

const th =
  'text-muted-foreground px-2 py-2 text-left font-mono text-xs font-normal tracking-wide uppercase';
const td = 'px-2 py-2 align-top';
const scoreTh = 'px-1 text-center';
const scoreTd = 'px-1 text-center font-mono';

// From 768px: one row per character. The scores are the narrowest columns,
// so Level and the six numbers read beside the roles on a tablet; any
// overflow scrolls within the table, never the page.
export function CharacterTable({
  rows,
  hasBoard,
  teamsHref,
  onEdit,
  rosterRow,
  buildOut,
}: RowsProps) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-foreground/20 border-b">
            {hasBoard && (
              <th scope="col" className={th}>
                On roster
              </th>
            )}
            <th scope="col" className={cn(th, 'w-full')}>
              Character
            </th>
            <th scope="col" className={th}>
              Owner
            </th>
            <th scope="col" className={th}>
              Kind
            </th>
            <th scope="col" className={cn(th, scoreTh)}>
              Level
            </th>
            {SCORES.map(([ability, text]) => (
              <th key={ability} scope="col" className={cn(th, scoreTh)}>
                {text}
              </th>
            ))}
            <th scope="col" className={cn(th, 'whitespace-nowrap')}>
              Hit Dice
            </th>
            <th scope="col" className={cn(th, 'whitespace-nowrap')}>
              Officer roles
            </th>
            <th scope="col" className={th}>
              Teams
            </th>
            <th scope="col" className={th}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const control = rosterRow?.(row.characterId) ?? null;
            return (
              <tr
                key={row.characterId}
                className={cn(
                  'border-foreground/10 border-b',
                  row.archived && 'opacity-60',
                )}
              >
                {hasBoard && (
                  <td className={cn(td, 'whitespace-nowrap')}>
                    {control ? (
                      <RosterSwitch name={row.name} control={control} />
                    ) : (
                      <OnRoster onRoster={row.onRoster} />
                    )}
                  </td>
                )}
                <th scope="row" className={cn(td, 'text-left font-normal')}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-sans text-base font-semibold [overflow-wrap:anywhere]">
                      {row.name}
                    </span>
                    {row.archived && <ArchivedBadge />}
                  </span>
                  <Warnings warnings={row.warnings} />
                  <CalculationNote row={row} />
                </th>
                <td className={td}>
                  <OwnerCell row={row} />
                </td>
                <td className={td}>
                  <KindChip kind={row.kind} />
                </td>
                <td className={cn(td, scoreTd)}>{row.level}</td>
                {SCORES.map(([ability]) => (
                  <td key={ability} className={cn(td, scoreTd)}>
                    <ScoreValue row={row} ability={ability} />
                  </td>
                ))}
                <td className={td}>
                  <HitDice row={row} control={control} />
                </td>
                <td className={td}>
                  <RoleChips roles={row.roles} hasBoard={hasBoard} />
                </td>
                <td className={td}>
                  <Teams manages={row.manages} href={teamsHref} />
                </td>
                <td className={cn(td, 'py-1')}>
                  <RowActions
                    row={row}
                    buildOut={buildOut}
                    onEdit={onEdit}
                    className="justify-end"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CharacterCard({
  row,
  hasBoard,
  teamsHref,
  onEdit,
  rosterRow,
  buildOut,
}: { row: MilitiaCharacterRow } & Omit<RowsProps, 'rows'>) {
  const headingId = useId();
  const control = rosterRow?.(row.characterId) ?? null;
  return (
    <li
      aria-labelledby={headingId}
      className={cn(
        'border-foreground/20 bg-card min-w-0 space-y-2 border p-3',
        row.archived && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <h3
          id={headingId}
          className="min-w-0 flex-1 font-sans text-lg leading-tight [overflow-wrap:anywhere]"
        >
          {row.name}
        </h3>
        <KindChip kind={row.kind} />
        {!control && (
          <span className="text-sm">
            <HitDiceValue hitDice={row.hitDice} />
          </span>
        )}
      </div>
      {control && (
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <RosterSwitch name={row.name} control={control} />
          <HitDice row={row} control={control} />
        </div>
      )}
      <OwnerCell row={row} isLabelled />
      <ScoresGrid row={row} />
      <CalculationNote row={row} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {row.archived && <ArchivedBadge />}
        {hasBoard && !control && <OnRoster onRoster={row.onRoster} />}
        <RoleChips roles={row.roles} hasBoard={hasBoard} />
        <Teams manages={row.manages} href={teamsHref} />
      </div>
      <Warnings warnings={row.warnings} />
      <RowActions
        row={row}
        buildOut={buildOut}
        onEdit={onEdit}
        className="-mr-2 justify-end"
      />
    </li>
  );
}

// Below 768px: one card per character with the same facts as a table row,
// the scores in a row of their own and the actions last, touch-sized.
export function CharacterCards({ rows, ...props }: RowsProps) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <CharacterCard key={row.characterId} row={row} {...props} />
      ))}
    </ul>
  );
}
