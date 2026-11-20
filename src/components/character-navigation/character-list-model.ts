import type { Id } from '@convex/_generated/dataModel';
import type { CharacterSheetOrigin } from '~/lib/campaign-routes';
import type { CharacterOwner } from '~/lib/character-ownership';

/** Where a row's Companion Relationships are read, and the sheet links' Back. */
export type CompanionLinksSource = {
  characterId: Id<'character'>;
  origin: CharacterSheetOrigin;
};

export type OwnedCharacterListRow = {
  id: string;
  name: string;
  level: number;
  kind: string;
  active: boolean;
  href: string;
  /** Present while the Character has a sheet to relate Companions to. */
  companions?: CompanionLinksSource;
};

export type CampaignCharacterListRow = Omit<
  OwnedCharacterListRow,
  'href' | 'id'
> & {
  id: Id<'character'>;
  owner: CharacterOwner | null;
  ownershipAvailable: boolean;
  ownerLastOperationId?: string;
  href?: string;
  ownerName: string | null;
  /** The owner's account survives, but they left this organization (#706). */
  ownerDeparted?: boolean;
  /** Nobody owns it (#708); any member may take or assign it. */
  needsOwner: boolean;
  isOnRoster: boolean;
};

export type CharacterListGroup = {
  key: string;
  title: string;
  organizationName?: string;
  characters: OwnedCharacterListRow[];
};

/** An organization the player left whose Characters are still on the way back. */
export type ReturningOrganization = {
  organizationId: string;
  /** Absent once the player is no longer a member, which is the usual case. */
  organizationName?: string;
  /** Characters that couldn't be returned yet; they keep being tried. */
  setAside: number;
};
