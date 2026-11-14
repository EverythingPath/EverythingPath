import { Plus } from 'lucide-react';
import { useId, useRef } from 'react';
import { Button } from '~/components/ui/button';
import type { OfficerRole, RoleCard } from '~/lib/officer-board';
import { cn } from '~/lib/utils';
import { HolderMenu, type HolderActions } from './holder-menu';
import { ArchivedBadge, assignButtonId, roleCardId, Warnings } from './parts';

const card = 'border-foreground/20 bg-card min-w-0 border p-3';

/** Correct officers' controls on a card: Assign, and each holder's menu. */
export type RoleCardEditing = {
  /** Opens the Assign picker; the role's Assign gets focus back after. */
  onAssign: (role: OfficerRole) => void;
  holders: HolderActions;
};

// A role before the militia exists: its name and nothing to show yet.
export function UnassignedRoleCard({ label }: { label: string }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn(card, 'border-dashed')}>
      <h3 id={headingId} className="font-sans text-lg leading-tight">
        {label}
      </h3>
      <p className="text-muted-foreground mt-2 text-sm">
        Set up militia to assign officers.
      </p>
    </section>
  );
}

// One role on the board: its rule, who holds it, what the rules take from
// them, and the open week's staged changes to it. Focusable so a role chip
// in the table can bring it into view, and so focus has somewhere to land
// when a holder's menu removes them.
export function RoleCardView({
  card: role,
  editing = null,
}: {
  card: RoleCard;
  editing?: RoleCardEditing | null;
}) {
  const headingId = useId();
  const section = useRef<HTMLElement>(null);
  return (
    <section
      ref={section}
      id={roleCardId(role.role)}
      tabIndex={-1}
      aria-labelledby={headingId}
      className={cn(
        card,
        'focus-visible:ring-ring/50 flex flex-col gap-2 outline-none focus-visible:ring-[3px]',
        role.vacant && 'border-dashed',
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-[7.5rem] flex-1">
          <h3
            id={headingId}
            className="font-sans text-base leading-tight [overflow-wrap:anywhere] md:text-lg"
          >
            {role.label}
          </h3>
          <p className="text-muted-foreground text-xs">{role.rule}</p>
        </div>
        {editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="-mt-0.5 -mr-0.5 min-h-11 shrink-0 max-sm:size-11 max-sm:px-0 md:min-h-8"
            id={assignButtonId(role.role)}
            aria-label={`Assign ${role.label}`}
            onClick={() => editing.onAssign(role.role)}
          >
            <Plus aria-hidden />
            <span className="max-sm:sr-only">Assign</span>
          </Button>
        )}
      </div>
      {role.holders.length > 0 && (
        <ul className="space-y-1">
          {role.holders.map((holder) => (
            <li
              key={holder.characterId}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
            >
              <span
                className={cn(
                  'font-sans [overflow-wrap:anywhere]',
                  holder.archived && 'text-muted-foreground line-through',
                )}
              >
                {holder.name}
              </span>
              {holder.contribution !== null && (
                <span className="text-muted-foreground text-sm">
                  {holder.contribution}
                </span>
              )}
              {!holder.counts && holder.nonStacking !== null && (
                <span className="text-muted-foreground text-sm">
                  {holder.nonStacking}
                </span>
              )}
              {holder.archived && <ArchivedBadge />}
              {editing && (
                <HolderMenu
                  holder={holder}
                  role={role.role}
                  roleLabel={role.label}
                  actions={editing.holders}
                  onDone={() => section.current?.focus()}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <p
        className={cn(
          'mt-auto font-mono text-xs [overflow-wrap:anywhere]',
          role.vacant && 'text-muted-foreground italic',
        )}
      >
        {role.effect}
        {role.source !== null && ` (${role.source})`}
      </p>
      <Warnings warnings={role.warnings} />
      {role.pending.map((change) => (
        <p
          key={change.key}
          className="text-primary text-sm [overflow-wrap:anywhere]"
        >
          Pending this week: {change.text}
        </p>
      ))}
    </section>
  );
}
