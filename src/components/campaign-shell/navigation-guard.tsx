'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useWorkspaceController } from '~/components/weekly-draft-workspace/use-weekly-draft-workspace';
import { registerTraversalGuard } from './browser-history';

// One departure decision for links, the campaign switcher, organization
// changes and browser Back/Forward. Pending work is read from the shared
// Workspace store at the moment of the request, never from a copied flag. A
// blocked operation runs once on Leave and never on Stay; a delayed save
// stays bound to the editor's own campaign and draft either way.
// A commit that throws or rejects (for example a sign-out the identity
// service refused) is reported by this provider, which stays mounted after
// the requesting control (the phone More sheet) has closed, with Try again.
export type Departure = {
  commit: () => void | Promise<void>;
  /** Shown if the commit fails; keep it about the user-visible outcome. */
  failureMessage?: string;
};
const DEFAULT_FAILURE = 'That could not be completed. Please try again.';
type Guard = {
  requestDeparture: (departure: Departure) => void;
  navigate: (href: string) => void;
  hasPendingWork: () => boolean;
};
const GuardContext = createContext<Guard | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const controller = useWorkspaceController();
  const store = controller?.store;
  const [blocked, setBlocked] = useState<Departure | null>(null);
  const [failed, setFailed] = useState<Departure | null>(null);
  const committing = useRef(false);
  const hasPendingWork = useCallback(
    () => store?.getPendingWork() ?? false,
    [store],
  );
  // Runs a commit synchronously (links and modal openers stay synchronous)
  // and reports a throw or a later rejection. `latch` holds off further
  // departures until an asynchronous Leave has settled.
  const run = useCallback((departure: Departure, latch: boolean) => {
    if (latch) committing.current = true;
    const release = () => {
      if (latch) committing.current = false;
    };
    let result: void | Promise<void>;
    try {
      result = departure.commit();
    } catch {
      release();
      setFailed(departure);
      return;
    }
    Promise.resolve(result).then(release, () => {
      release();
      setFailed(departure);
    });
  }, []);
  const requestDeparture = useCallback(
    (departure: Departure) => {
      if (committing.current) return;
      if (hasPendingWork()) setBlocked((open) => open ?? departure);
      else run(departure, false);
    },
    [hasPendingWork, run],
  );
  const navigate = useCallback(
    (href: string) => requestDeparture({ commit: () => router.push(href) }),
    [requestDeparture, router],
  );
  useEffect(
    () =>
      registerTraversalGuard({
        shouldBlock: () => committing.current || hasPendingWork(),
        onBlocked: (intent) =>
          setBlocked((open) => open ?? { commit: intent.commit }),
      }),
    [hasPendingWork],
  );
  const guard = useMemo(
    () => ({ requestDeparture, navigate, hasPendingWork }),
    [requestDeparture, navigate, hasPendingWork],
  );
  return (
    <GuardContext.Provider value={guard}>
      {children}
      <Dialog
        open={blocked !== null}
        onOpenChange={(open) => {
          if (!open) setBlocked(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changes are still saving</DialogTitle>
            <DialogDescription>
              Leaving now may lose changes that have not finished saving. Wait a
              moment, or leave anyway.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlocked(null)}>
              Stay
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const departure = blocked;
                setBlocked(null);
                if (departure) run(departure, true);
              }}
            >
              Leave anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={failed !== null}
        onOpenChange={(open) => {
          if (!open) setFailed(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>That didn't finish</DialogTitle>
            <DialogDescription role="alert">
              {failed?.failureMessage ?? DEFAULT_FAILURE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFailed(null)}>
              Dismiss
            </Button>
            <Button
              onClick={() => {
                const departure = failed;
                setFailed(null);
                // A fresh request: work started while the first attempt was
                // in flight gets its Stay/Leave decision before any retry.
                if (departure) requestDeparture(departure);
              }}
            >
              Try again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GuardContext.Provider>
  );
}

const passthrough: Guard = {
  requestDeparture: (departure) => void departure.commit(),
  navigate: () => undefined,
  hasPendingWork: () => false,
};

export function useNavigationGuard(): Guard {
  return useContext(GuardContext) ?? passthrough;
}

// Runs `onCommit` right before any departure requested inside commits: a
// container (the phone More sheet) closes itself once its choice actually
// leaves, and stays open while the player still decides Stay or Leave.
export function BeforeDeparture({
  onCommit,
  children,
}: {
  onCommit: () => void;
  children: ReactNode;
}) {
  const guard = useNavigationGuard();
  const router = useRouter();
  const wrapped = useMemo<Guard>(() => {
    const requestDeparture = (departure: Departure) =>
      guard.requestDeparture({
        ...departure,
        commit: () => {
          onCommit();
          return departure.commit();
        },
      });
    return {
      requestDeparture,
      navigate: (href) => requestDeparture({ commit: () => router.push(href) }),
      hasPendingWork: guard.hasPendingWork,
    };
  }, [guard, onCommit, router]);
  return (
    <GuardContext.Provider value={wrapped}>{children}</GuardContext.Provider>
  );
}

export function plainClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

// An ordinary link that consults the guard on a plain left click.
export function GuardedLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const guard = useNavigationGuard();
  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !plainClick(event)) return;
        if (guard.hasPendingWork()) {
          event.preventDefault();
          guard.navigate(href);
        }
      }}
      {...props}
    />
  );
}
