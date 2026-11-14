import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '~/components/ui/badge';
import type { OfficerRole } from '~/lib/officer-board';

/** The DOM id of a role card, so a role chip can move focus to it. */
export function roleCardId(role: OfficerRole) {
  return `role-${role}`;
}

/** The role card's Assign button, found again after its picker closes. */
export function assignButtonId(role: OfficerRole) {
  return `${roleCardId(role)}-assign`;
}

/** Touch-sized on the phone, compact from 768px; every button here. */
export const action = 'min-h-11 md:min-h-9';

/** A small monospace chip: kinds, roles and quick reasons. */
export const chip =
  'border-foreground/40 inline-flex items-center border px-1.5 py-0.5 font-mono text-xs leading-tight';

/** An amber note on a name: "archived", "already Marshal". */
export function NoteBadge({ children }: { children: ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="border-amber-500/60 font-mono text-[11px] font-normal whitespace-normal text-amber-300"
    >
      {children}
    </Badge>
  );
}

export function ArchivedBadge() {
  return <NoteBadge>archived</NoteBadge>;
}

/** Advisory warnings, one line each. */
export function Warnings({ warnings }: { warnings: string[] }) {
  return warnings.map((warning) => (
    <p
      key={warning}
      className="flex items-start gap-1.5 text-sm text-amber-300"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{warning}</span>
    </p>
  ));
}
