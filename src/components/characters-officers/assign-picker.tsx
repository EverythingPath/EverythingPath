'use client';
import { X } from 'lucide-react';
import { useId, type KeyboardEvent } from 'react';
import { useFocusOnMount } from '~/components/militia-corrections/section-correction';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { ROLE_LABELS } from '~/lib/officer-board';
import type { AssignCandidate } from '~/lib/roster-corrections';
import { cn } from '~/lib/utils';
import { ArchivedBadge, NoteBadge } from './parts';
import type { AssignOffer } from './use-character-corrections';

/** Where the picker shows: floating beside the board, a sheet, or inline. */
export type PickerLayout = 'floating' | 'sheet' | 'inline';

export type AssignPickerProps = {
  /** The role's label: the picker is "Assign <Role>". */
  label: string;
  offer: AssignOffer;
  onAssign: (characterId: string) => void;
  onClose: () => void;
};

const candidate =
  'border-foreground/20 hover:bg-foreground/5 focus-visible:ring-ring/50 flex min-h-11 w-full flex-col items-start gap-0.5 border px-3 py-2 text-left outline-none focus-visible:ring-[3px]';

function Candidate({
  person,
  onAssign,
}: {
  person: AssignCandidate;
  onAssign: (characterId: string) => void;
}) {
  return (
    <button
      type="button"
      className={candidate}
      onClick={() => onAssign(person.characterId)}
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            'font-sans text-base [overflow-wrap:anywhere]',
            person.archived && 'text-muted-foreground line-through',
          )}
        >
          {person.name}
        </span>
        {person.archived && <ArchivedBadge />}
        {person.holds.length > 0 && (
          <NoteBadge>
            already {person.holds.map((role) => ROLE_LABELS[role]).join(', ')}
          </NoteBadge>
        )}
      </span>
      <span className="text-muted-foreground font-mono text-xs [overflow-wrap:anywhere]">
        {person.detail}
      </span>
    </button>
  );
}

function Group({
  title,
  people,
  onAssign,
  heading: Heading,
}: {
  title: string;
  people: AssignCandidate[];
  onAssign: (characterId: string) => void;
  heading: 'h3' | 'h4';
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-1.5">
      <Heading
        id={id}
        className="text-muted-foreground font-mono text-xs font-normal tracking-wide uppercase"
      >
        {title}
      </Heading>
      {people.length === 0 ? (
        <p className="text-muted-foreground text-sm">None available.</p>
      ) : (
        <ul role="list" className="space-y-1">
          {people.map((person) => (
            <li key={person.characterId}>
              <Candidate person={person} onAssign={onAssign} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// The two groups of people the role can take.
function Groups({
  offer,
  onAssign,
  heading,
}: Pick<AssignPickerProps, 'offer' | 'onAssign'> & { heading: 'h3' | 'h4' }) {
  return (
    <div className="space-y-4">
      <Group
        title="Player characters"
        people={offer.pcs}
        onAssign={onAssign}
        heading={heading}
      />
      <Group
        title="NPCs"
        people={offer.npcs}
        onAssign={onAssign}
        heading={heading}
      />
    </div>
  );
}

// Tablet: a right-hand sheet, a modal dialog named "Assign <Role>". Radix
// returns focus to the Assign button on close.
function AssignSheet({ label, offer, onAssign, onClose }: AssignPickerProps) {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="font-sans text-xl font-normal">
            Assign {label}
          </SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          <Groups offer={offer} onAssign={onAssign} heading="h3" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Phone: a panel below the board. Desktop: the same panel floating over the
// board's right side as a non-modal dialog. Both take focus on open and
// close on Escape or Close.
function AssignPanel({
  label,
  offer,
  onAssign,
  onClose,
  floating,
}: AssignPickerProps & { floating: boolean }) {
  const id = useId();
  const heading = useFocusOnMount<HTMLHeadingElement>();
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onClose();
  }
  // One element for both, so a resize across 1280px keeps the panel, and
  // the focus inside it, while its role and placement change (#141).
  return (
    <section
      role={floating ? 'dialog' : undefined}
      aria-labelledby={id}
      onKeyDown={onKeyDown}
      className={
        floating
          ? 'border-foreground/30 bg-popover text-popover-foreground absolute top-0 right-0 z-30 max-h-[80vh] w-96 space-y-3 overflow-y-auto border p-4 shadow-lg'
          : 'border-foreground/20 bg-card min-w-0 space-y-3 border p-3'
      }
    >
      <div className="flex items-start gap-2">
        <h3
          ref={heading}
          id={id}
          tabIndex={-1}
          className="min-w-0 flex-1 font-sans text-lg leading-tight [overflow-wrap:anywhere] outline-none"
        >
          Assign {label}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mt-1.5 -mr-1.5 size-11 md:size-9"
          onClick={onClose}
        >
          <X aria-hidden />
          <span className="sr-only">Close</span>
        </Button>
      </div>
      <Groups offer={offer} onAssign={onAssign} heading="h4" />
    </section>
  );
}

/** The Assign picker for one role, in the layout for the viewport. */
export function AssignPicker({
  layout,
  ...props
}: AssignPickerProps & { layout: PickerLayout }) {
  if (layout === 'sheet') return <AssignSheet {...props} />;
  return <AssignPanel {...props} floating={layout === 'floating'} />;
}
