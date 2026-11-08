import { Children, isValidElement, type ReactNode } from 'react';

// Module shapes for the shell tests' `vi.mock` factories. A factory is
// hoisted above the test file's own declarations, so every control is passed
// as a getter (`() => auth()`), read at render time rather than when the
// factory runs.

export type AuthState = { isLoaded: boolean; isSignedIn?: boolean };
export type ConvexAuthState = { isLoading: boolean; isAuthenticated: boolean };
export type Organization = { id: string; name: string };

export const thursdayTable: Organization = {
  id: 'org',
  name: 'Thursday table',
};

/** `next/link` as a plain anchor. */
export function linkModule() {
  return {
    default: ({
      href,
      children,
      ...props
    }: React.ComponentProps<'a'> & { href: string }) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  };
}

/**
 * Convex's auth gates and hooks, read from `convexAuth` on each render. The
 * shells' own reads (an organization's access status, a deletion's progress)
 * stay loading unless a test passes `useQuery`; writes are never sent.
 */
export function convexReactModule(
  convexAuth: () => ConvexAuthState,
  useQuery: (...args: unknown[]) => unknown = () => undefined,
) {
  const convex = {};
  return {
    useConvex: () => convex,
    useConvexAuth: () => convexAuth(),
    useQuery,
    useMutation: () => () => Promise.resolve(null),
    Authenticated: ({ children }: { children: ReactNode }) =>
      convexAuth().isAuthenticated ? children : null,
    Unauthenticated: ({ children }: { children: ReactNode }) =>
      !convexAuth().isLoading && !convexAuth().isAuthenticated
        ? children
        : null,
    AuthLoading: ({ children }: { children: ReactNode }) =>
      convexAuth().isLoading ? children : null,
  };
}

/** The organization list Clerk returns for the given memberships. */
export function organizationList({
  organizations,
  setActive = () => Promise.resolve(),
}: {
  organizations: Organization[];
  setActive?: () => Promise<void>;
}) {
  return {
    isLoaded: true,
    setActive,
    userMemberships: {
      data: organizations.map((organization) => ({ organization })),
      hasNextPage: false,
      isFetching: false,
      fetchNext: () => Promise.resolve(),
    },
  };
}

/**
 * Clerk's hooks and buttons. `UserButton` defaults to a ready avatar button;
 * pass one to stand in for Clerk's `fallback` behavior.
 */
export function clerkModule({
  auth,
  organization,
  clerk,
  organizations,
  user,
  UserButton = () => <button>Account</button>,
}: {
  auth: () => AuthState;
  organization: () => { isLoaded: boolean; organization?: Organization };
  clerk: () => Record<string, unknown>;
  organizations: () => ReturnType<typeof organizationList>;
  user?: () => Record<string, unknown>;
  UserButton?: (props: { fallback?: ReactNode }) => ReactNode;
}) {
  return {
    useAuth: () => auth(),
    useOrganization: () => organization(),
    useClerk: () => clerk(),
    useUser: () => user?.(),
    useOrganizationList: () => organizations(),
    SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
    UserButton,
  };
}

/**
 * `~/components/ui/select` as a native select that keeps the trigger's
 * accessible name and title and lists its items as options.
 */
export function selectModule() {
  const SelectTrigger = () => null;
  return {
    Select: ({
      value,
      onValueChange,
      disabled,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      disabled?: boolean;
      children: ReactNode;
    }) => {
      const trigger = Children.toArray(children).find(
        (child) => isValidElement(child) && child.type === SelectTrigger,
      );
      const { 'aria-label': label, title } = isValidElement<{
        'aria-label'?: string;
        title?: string;
      }>(trigger)
        ? trigger.props
        : {};
      return (
        <select
          aria-label={label}
          title={title}
          value={value}
          disabled={disabled}
          onChange={(event) => onValueChange?.(event.target.value)}
        >
          {children}
        </select>
      );
    },
    SelectTrigger,
    SelectValue: () => null,
    SelectSeparator: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: ReactNode;
    }) => <option value={value}>{children}</option>,
  };
}

/** `next/navigation`'s router and pathname, read on each call. */
export function navigationModule({
  push = () => undefined,
  pathname,
}: {
  push?: (href: string) => void;
  pathname: () => string;
}) {
  return {
    useRouter: () => ({ push, replace: () => undefined }),
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    usePathname: () => pathname(),
  };
}
