import type { ReturningOrganization } from './character-list-model';

/** When the player is no longer a member, the client may not know the name. */
const unnamedOrganization = 'an organization you left';

/** The line for one organization: on the way back, or some not back yet. */
export function returningCharactersText({
  organizationName,
  setAside,
}: ReturningOrganization) {
  const from = organizationName ?? unnamedOrganization;
  if (setAside === 1)
    return `One character from ${from} couldn’t be returned yet. It’ll appear under No campaign once it’s back.`;
  if (setAside > 1)
    return `${setAside} characters from ${from} couldn’t be returned yet. They’ll appear under No campaign once they’re back.`;
  return `Your characters from ${from} are on their way back. They’ll appear under No campaign.`;
}

// One quiet line per organization the player left while their Characters
// are still on the way back: no names or control, as the return finishes
// without them.
export function ReturningCharactersNotice({
  organizations,
}: {
  organizations: ReturningOrganization[];
}) {
  if (!organizations.length) return null;
  return (
    <div className="flex flex-col gap-1">
      {organizations.map((organization) => (
        <p
          key={organization.organizationId}
          role="status"
          className="text-muted-foreground text-sm"
        >
          {returningCharactersText(organization)}
        </p>
      ))}
    </div>
  );
}
