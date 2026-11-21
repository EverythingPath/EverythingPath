'use client';
import { ArrowRight, Pencil, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { useShellSlotHost } from '~/components/campaign-shell/shell-slots';
import { useBreakpoint } from '~/components/use-breakpoint';
import { Button } from '~/components/ui/button';
import {
  BOARD_ROLES,
  ROLE_LABELS,
  type OfficerRole,
  type RoleCard,
} from '~/lib/officer-board';
import { cn } from '~/lib/utils';
import { AssignPicker, type PickerLayout } from './assign-picker';
import { CharacterCards, CharacterTable } from './character-rows';
import { CorrectionBar, Feedback } from './correction-bar';
import { action, assignButtonId } from './parts';
import { RoleCardView, UnassignedRoleCard } from './role-card';
import type {
  CharacterCorrections,
  CorrectionMode,
  OpenCorrection,
} from './use-character-corrections';
import type { CharactersPage as Page } from './use-characters-page';

type Corrections = Extract<CharacterCorrections, { status: 'ready' }>;

const board = 'grid grid-cols-2 gap-3 md:grid-cols-3';
// The section a correction does not edit: visibly dimmed and inert.
const dimmed = 'opacity-50';

// The board while Correct officers is open: cards with Assign and holder
// menus, and the Assign picker for one role in the viewport's layout.
// Unmounted with the correction, so no picker outlives it.
function EditableBoard({
  cards,
  correction,
  layout,
}: {
  cards: RoleCard[];
  correction: OpenCorrection;
  layout: PickerLayout;
}) {
  const [assigning, setAssigning] = useState<OfficerRole | null>(null);
  // Once the picker has closed, focus returns to its role's Assign, found
  // by the role rather than held, so a remounted card's button still gets it.
  const returnTo = useRef<OfficerRole | null>(null);
  useEffect(() => {
    if (assigning !== null || returnTo.current === null) return;
    document.getElementById(assignButtonId(returnTo.current))?.focus();
    returnTo.current = null;
  }, [assigning]);
  const close = () => {
    returnTo.current = assigning;
    setAssigning(null);
  };
  const editing = { onAssign: setAssigning, holders: correction };
  const picker = assigning && (
    <AssignPicker
      key={assigning}
      layout={layout}
      label={ROLE_LABELS[assigning]}
      offer={correction.candidates(assigning)}
      onAssign={(characterId) => {
        correction.assign(assigning, characterId);
        close();
      }}
      onClose={close}
    />
  );
  return (
    <div className="relative space-y-3">
      <div className={board}>
        {cards.map((card) => (
          <RoleCardView key={card.role} card={card} editing={editing} />
        ))}
      </div>
      {picker}
    </div>
  );
}

function Officers({
  page,
  corrections,
  inert,
  children,
}: {
  page: Page;
  corrections: Corrections | null;
  inert: boolean;
  /** The save point, on the phone, directly under the board. */
  children?: ReactNode;
}) {
  const headingId = useId();
  const wide = useBreakpoint('wide');
  const desktop = useBreakpoint('desktop');
  const { officers } = page;
  const correction =
    corrections?.correction?.mode === 'officers'
      ? corrections.correction
      : null;
  const canOpen =
    corrections !== null && corrections.mode === null && officers !== null;
  return (
    <section
      aria-labelledby={headingId}
      inert={inert || undefined}
      className={cn('space-y-3', inert && dimmed)}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h2 id={headingId} className="font-sans text-2xl">
          Officers
        </h2>
        {officers?.focus && (
          <p className="text-muted-foreground text-sm">
            Focus: {officers.focus}
          </p>
        )}
        {officers === null && (
          <Button asChild variant="outline" className={`${action} ml-auto`}>
            <GuardedLink href={page.links.setup}>Set up militia</GuardedLink>
          </Button>
        )}
        {canOpen && (
          <Button
            type="button"
            variant="outline"
            className={`${action} ml-auto`}
            onClick={() => corrections.open('officers')}
          >
            <Pencil /> Correct officers
          </Button>
        )}
      </div>
      {officers === null ? (
        <div className={board}>
          {BOARD_ROLES.map((role) => (
            <UnassignedRoleCard key={role} label={ROLE_LABELS[role]} />
          ))}
        </div>
      ) : correction ? (
        <EditableBoard
          cards={officers.cards}
          correction={correction}
          layout={desktop ? 'floating' : wide ? 'sheet' : 'inline'}
        />
      ) : (
        <div className={board}>
          {officers.cards.map((card) => (
            <RoleCardView key={card.role} card={card} />
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

function PendingBar({ page }: { page: Page }) {
  if (page.pending.length === 0) return null;
  return (
    <div className="border-foreground/20 flex flex-col gap-x-3 gap-y-1 border p-3 sm:flex-row sm:flex-wrap sm:items-baseline">
      <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
        Pending this week
      </p>
      <ul className="min-w-0 flex-1 space-y-0.5 text-sm">
        {page.pending.map((change) => (
          <li key={change.key} className="[overflow-wrap:anywhere]">
            {change.text}
          </li>
        ))}
      </ul>
      <GuardedLink
        href={page.links.activity}
        className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4 md:min-h-0"
      >
        Go to Activity
        <ArrowRight aria-hidden className="size-4" />
      </GuardedLink>
    </div>
  );
}

function Characters({
  page,
  corrections,
  inert,
  children,
}: {
  page: Page;
  corrections: Corrections | null;
  inert: boolean;
  /** The save point, on the phone, directly under the rows. */
  children?: ReactNode;
}) {
  const headingId = useId();
  const showArchivedId = useId();
  const wide = useBreakpoint('wide');
  const correction =
    corrections?.correction?.mode === 'roster' ? corrections.correction : null;
  const canOpen =
    corrections !== null && corrections.mode === null && page.officers !== null;
  const rowProps = {
    rows: page.rows,
    hasBoard: page.officers !== null,
    teamsHref: page.links.teams,
    onEdit: page.dialog.openEdit,
    rosterRow: correction?.rosterRow ?? null,
    buildOut: page.buildOut,
  };
  const rows =
    page.rows.length > 0 &&
    (wide ? (
      <CharacterTable {...rowProps} />
    ) : (
      <CharacterCards {...rowProps} />
    ));
  return (
    <section
      aria-labelledby={headingId}
      inert={inert || undefined}
      className={cn('space-y-3', inert && dimmed)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id={headingId} className="font-sans text-2xl">
          Characters
        </h2>
        {page.officers !== null && (
          <p className="text-muted-foreground text-sm">
            {page.counts.onRoster} on the roster · {page.counts.notOnRoster} not
          </p>
        )}
        <label
          htmlFor={showArchivedId}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm select-none md:min-h-9"
        >
          <input
            id={showArchivedId}
            type="checkbox"
            className="accent-primary size-4"
            checked={page.showArchived}
            onChange={(event) => page.setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          {canOpen && (
            <Button
              type="button"
              variant="outline"
              className={action}
              onClick={() => corrections.open('roster')}
            >
              <Pencil /> Correct roster
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className={action}
            onClick={page.dialog.openAdd}
          >
            <Plus /> Add character
          </Button>
        </div>
      </div>
      <PendingBar page={page} />
      {correction ? (
        // Every row control follows the correction's state.
        <fieldset
          disabled={correction.view.kind !== 'editing'}
          className="min-w-0"
        >
          {rows}
        </fieldset>
      ) : (
        rows
      )}
      {page.emptyMessage !== null && (
        <p className="text-muted-foreground text-sm">{page.emptyMessage}</p>
      )}
      {children}
    </section>
  );
}

// Characters & officers: the officer board over the character rows, with
// the Correct officers and Correct roster corrections. While one is open,
// the other section is dimmed and inert, and the save point follows: from
// 768px after both sections, pinned to the viewport's bottom edge, on the
// phone under the edited section with the reason in the shell's strip.
export function CharactersOfficersView({
  page,
  corrections,
}: {
  page: Page;
  /** The two corrections; null before Setup or while loading. */
  corrections: Corrections | null;
}) {
  const wide = useBreakpoint('wide');
  const strip = useShellSlotHost('phone-status-strip');
  // Set when a correction opens: its save point's heading takes focus once.
  // A resize across 768px moves the save point and mounts it again (a
  // rotated tablet, a resized window); focus then stays on the control in
  // use, such as a holder's ⋯ menu or the Assign picker (#141).
  const focusHeading = useRef(false);
  const opening = corrections && {
    ...corrections,
    open: (mode: CorrectionMode) => {
      focusHeading.current = true;
      corrections.open(mode);
    },
  };
  const correction = corrections?.correction ?? null;
  const mode = correction?.mode ?? null;
  const savePoint = correction && (
    <CorrectionBar
      correction={correction}
      wide={wide}
      inStrip={!wide && strip}
      focusHeading={focusHeading}
    />
  );
  return (
    <div className="min-w-0 space-y-8">
      <Feedback feedback={corrections?.feedback ?? null} />
      <Officers page={page} corrections={opening} inert={mode === 'roster'}>
        {!wide && mode === 'officers' && savePoint}
      </Officers>
      <Characters page={page} corrections={opening} inert={mode === 'officers'}>
        {!wide && mode === 'roster' && savePoint}
      </Characters>
      {wide && savePoint}
    </div>
  );
}
