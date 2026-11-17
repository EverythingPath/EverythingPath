/** The authority over Character statistics a deployment is under (#413). */
export type CharacterAuthority = 'legacy' | 'sheet';

/**
 * What a Character Sheet gate decides for: a campaign's sheets, an existing
 * private Character's sheet, or creating a private Character.
 */
export type CharacterSheetSubject =
  | {
      kind: 'campaign';
      campaign: { e2eFixture?: unknown } | null | undefined;
    }
  | { kind: 'privateCharacter'; character: { sheetDemo?: true } }
  | {
      kind: 'privateCreation';
      user: { characterSheetDemo?: true } | null | undefined;
    };

/**
 * Whether the builder is open for a subject. Under sheet authority it is open
 * everywhere. Under legacy authority it stays as before activation: open only
 * in E2E fixture campaigns, for private Characters carrying the demo marker,
 * and for creation by users with the demo grant. Every server gate and every
 * client entry point decides through this one rule.
 */
export function areCharacterSheetsAvailable(
  authority: CharacterAuthority,
  subject: CharacterSheetSubject,
) {
  if (authority === 'sheet') return true;
  switch (subject.kind) {
    case 'campaign':
      return Boolean(subject.campaign?.e2eFixture);
    case 'privateCharacter':
      return Boolean(subject.character.sheetDemo);
    case 'privateCreation':
      return Boolean(subject.user?.characterSheetDemo);
  }
}

/** A Character's subject: its campaign, or the Character itself when private. */
export function characterSheetSubject(
  character: { sheetDemo?: true },
  campaign: { e2eFixture?: unknown } | null | undefined,
): CharacterSheetSubject {
  return campaign
    ? { kind: 'campaign', campaign }
    : { kind: 'privateCharacter', character };
}
