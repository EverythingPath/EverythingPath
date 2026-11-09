'use client';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Button } from '~/components/ui/button';
import type { OfficerRole, RoleHolder } from '~/lib/officer-board';
import { cn } from '~/lib/utils';
import type { OpenCorrection } from './use-character-corrections';

/** What Correct officers offers a holder: Move to… and Remove. */
export type HolderActions = Pick<
  OpenCorrection,
  'moveTargets' | 'move' | 'remove'
>;

type Open = 'closed' | 'menu' | 'move';

const item =
  'focus-visible:ring-ring/50 hover:bg-foreground/10 flex min-h-11 w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset md:min-h-9';

// A holder's "⋯" options: a disclosure whose list offers Move to… (which
// swaps the list for the roles they do not hold) and Remove. Escape closes
// it and returns focus to ⋯; a press outside or tabbing away closes it; a
// choice closes it and hands focus to the card.
export function HolderMenu({
  holder,
  role,
  roleLabel,
  actions,
  onDone,
}: {
  holder: RoleHolder;
  role: OfficerRole;
  roleLabel: string;
  actions: HolderActions;
  /** After Move or Remove, when this holder leaves the card. */
  onDone: () => void;
}) {
  const id = useId();
  const menuId = `${id}-menu`;
  const [open, setOpen] = useState<Open>('closed');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const expanded = open !== 'closed';

  // The list hangs from the right of ⋯, unless it would then cross the
  // viewport's left edge (a holder in the phone board's left column, whose
  // ⋯ sits nearer the edge than the list is wide): then it opens rightwards.
  const [opensRight, setOpensRight] = useState(false);
  useLayoutEffect(() => {
    if (!expanded || !list.current || !trigger.current) return;
    const { right } = trigger.current.getBoundingClientRect();
    setOpensRight(right - list.current.offsetWidth < 0);
  }, [expanded]);

  // Set by Escape: ⋯ takes focus back once the list has closed.
  const shouldReturnFocus = useRef(false);
  const close = (refocus: boolean) => {
    shouldReturnFocus.current = refocus;
    setOpen('closed');
  };

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      // Safe cast: pointer events dispatched to the document always target a
      // Node.
      if (!root.current?.contains(event.target as Node)) setOpen('closed');
    };
    // Escape from inside is handled below. This catches it when focus has
    // dropped to the page, as when the focused role stops being offered;
    // never while another control has it.
    const onPageEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.activeElement !== document.body) return;
      event.preventDefault();
      close(true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onPageEscape);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onPageEscape);
    };
  }, [expanded]);

  // The first item takes focus when the list opens or shows the targets
  // (the list itself when there are none).
  useEffect(() => {
    if (open === 'closed') return;
    (
      root.current?.querySelector<HTMLElement>('[data-menu-item]') ??
      list.current
    )?.focus();
  }, [open]);

  // Once the list has closed, ⋯ takes focus back if Escape closed it.
  useEffect(() => {
    if (open !== 'closed' || !shouldReturnFocus.current) return;
    shouldReturnFocus.current = false;
    trigger.current?.focus();
  }, [open]);
  const choose = (act: () => void) => {
    setOpen('closed');
    act();
    onDone();
  };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!expanded) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(
      root.current?.querySelectorAll<HTMLElement>('[data-menu-item]') ?? [],
    );
    if (items.length === 0) return;
    event.preventDefault();
    const focusable: readonly (Element | null)[] = items;
    const index = focusable.indexOf(document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  }

  const targets =
    open === 'move' ? actions.moveTargets(holder.characterId, role) : [];
  return (
    <div
      ref={root}
      className="relative ml-auto self-center"
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        // Tabbing away closes; a pointer press is handled above.
        if (
          expanded &&
          event.relatedTarget instanceof Node &&
          !root.current?.contains(event.relatedTarget)
        )
          setOpen('closed');
      }}
    >
      <Button
        ref={trigger}
        type="button"
        variant="ghost"
        size="icon"
        className="-my-2 size-11 md:-my-1 md:size-8"
        aria-label={`Options for ${holder.name}`}
        aria-expanded={expanded}
        aria-controls={expanded ? menuId : undefined}
        onClick={() => (expanded ? close(false) : setOpen('menu'))}
      >
        <MoreHorizontal aria-hidden />
      </Button>
      {expanded && (
        <div
          ref={list}
          id={menuId}
          tabIndex={-1}
          className={cn(
            'border-foreground/30 bg-popover text-popover-foreground absolute top-full z-30 mt-1 w-44 border py-1 shadow-lg outline-none',
            opensRight ? 'left-0' : 'right-0',
          )}
        >
          {open === 'menu' ? (
            <ul role="list">
              <li>
                <button
                  type="button"
                  data-menu-item
                  className={item}
                  aria-expanded={false}
                  onClick={() => setOpen('move')}
                >
                  Move to…
                  <ChevronRight aria-hidden className="size-4 shrink-0" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  data-menu-item
                  className={item}
                  aria-label={`Remove ${holder.name} as ${roleLabel}`}
                  onClick={() =>
                    choose(() => actions.remove(role, holder.characterId))
                  }
                >
                  Remove
                </button>
              </li>
            </ul>
          ) : (
            <>
              <p className="text-muted-foreground px-3 pt-1 pb-1.5 font-mono text-xs tracking-wide uppercase">
                Move to
              </p>
              {targets.length === 0 ? (
                <p className="text-muted-foreground px-3 pb-1.5 text-sm">
                  None available.
                </p>
              ) : (
                <ul role="list">
                  {targets.map((target) => (
                    <li key={target.role}>
                      <button
                        type="button"
                        data-menu-item
                        className={cn(item, 'font-sans')}
                        aria-label={`Move to ${target.label}`}
                        onClick={() =>
                          choose(() =>
                            actions.move(holder.characterId, role, target.role),
                          )
                        }
                      >
                        {target.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
