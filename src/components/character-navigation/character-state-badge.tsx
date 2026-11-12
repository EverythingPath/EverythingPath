import { Badge } from '~/components/ui/badge';

/** The owner's membership here ended; their Character is still theirs. */
export function ownerDepartedText(ownerName: string | null) {
  return `${ownerName ?? 'Owner'} left the organization`;
}

// Active or Archived in the Status column.
export function CharacterStateBadge({ active }: { active: boolean }) {
  return <Badge variant="outline">{active ? 'Active' : 'Archived'}</Badge>;
}

const ownerStateBadge = 'text-muted-foreground font-normal whitespace-normal';

// In the owner's place, that nobody owns the Character (#708): any member
// may take or assign it meanwhile. Never beside OwnerDepartedBadge, whose
// owner still exists.
export function NeedsOwnerBadge() {
  return (
    <Badge variant="outline" className={ownerStateBadge}>
      Needs an owner
    </Badge>
  );
}

// Beside the owner's name, that the owner left the organization (#706): the
// Character stays editable here meanwhile, and a new owner from the campaign
// clears it.
export function OwnerDepartedBadge({
  ownerName,
}: {
  ownerName: string | null;
}) {
  return (
    <Badge variant="outline" className={ownerStateBadge}>
      {ownerDepartedText(ownerName)}
    </Badge>
  );
}
