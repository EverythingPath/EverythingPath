export const leaveText =
  'Leaving removes this character from the militia roster and officer and manager assignments. Its sheet and homebrew stay with it.';

export const privateDepartureText =
  'Only you can see it afterwards, until you add it to a campaign.';

export function departureText(
  isMilitiaOnly: boolean,
  departureRoles?: readonly string[],
) {
  const changes = departureRoles
    ? [
        ...departureRoles.map(
          (role) =>
            `${role} assignment removed. Finished weeks keep it as it was.`,
        ),
        'Campaign homebrew is kept as its own copy; the sheet doesn’t change.',
      ].join(' ')
    : leaveText;
  return `${changes}${
    isMilitiaOnly
      ? ' As a Militia-only character it becomes a Full character, which can’t be undone.'
      : ''
  }`;
}

/** How many Characters a group move carries: the requested one and its Companions. */
export function moveGroupSize(progress: { groupSize?: number } | null) {
  return progress?.groupSize ?? 1;
}

/** Names a group departure: every member is corrected, not only the requested Character. */
export function groupDepartureText(companions: number) {
  const who =
    companions === 1
      ? 'The Companion moving with it is'
      : `The ${companions} Companions moving with it are`;
  return `${who} removed from the militia roster and officer and manager assignments too; saved Activity choices that used them need review.`;
}

/** What each staying Character's reason means to the player. */
export const stayingReasonText = {
  inactive: 'Its Companion Relationship isn’t active, so it stays.',
  differentOwner: 'Another player owns it, so it stays.',
  associated: 'Moving a Companion never moves its associated Character.',
  unavailable: 'It can’t move because it’s unavailable.',
} as const;

export function moveGroupRefusalText({
  groupSize,
  maxGroupSize,
}: {
  groupSize: number;
  maxGroupSize: number;
}) {
  return `These ${groupSize} Characters can’t move together. Up to ${maxGroupSize} Characters move together. To move fewer, interrupt a Companion Relationship first.`;
}

/** The Companions the preview says move with the requested Character. */
export function movingCompanionCount(
  preview: { moving: readonly unknown[] } | null,
) {
  return preview ? Math.max(0, preview.moving.length - 1) : 0;
}

/** "Vessa", or "Vessa and its 2 Companions" when a group moves. */
export function moveGroupSubject(characterName: string, companions: number) {
  if (companions === 0) return characterName;
  return `${characterName} and its ${companions === 1 ? 'Companion' : `${companions} Companions`}`;
}

/** Private afterwards: the Character alone, or every member of its group. */
export function privateDepartureNote(companions: number) {
  return companions
    ? 'Only you can see them afterwards, until you add them to a campaign.'
    : privateDepartureText;
}

/** What leaving takes away, from the requested Character and from its group. */
export function departureNote(isMilitiaOnly: boolean, companions: number) {
  return `${departureText(isMilitiaOnly)}${companions ? ` ${groupDepartureText(companions)}` : ''}`;
}

/** The picker's and arrival's departure sentence, with the group's correction. */
export function departureSentence({
  characterName,
  campaignName,
  isMilitiaOnly,
  companions,
}: {
  characterName: string;
  campaignName: string;
  isMilitiaOnly: boolean;
  companions: number;
}) {
  return `${moveGroupSubject(characterName, companions)} ${companions ? 'leave' : 'leaves'} ${campaignName} when the move completes. ${departureNote(isMilitiaOnly, companions)}`;
}

/** The picker's and arrival's join sentence: shared editing, no roster place. */
export function arrivalSentence(
  characterName: string,
  campaignName: string,
  companions: number,
) {
  return `Everyone in ${campaignName} can see and edit ${moveGroupSubject(characterName, companions)}. ${companions ? 'None of them is' : 'It isn’t'} added to a militia roster.`;
}
