# Characters are owned by a user and move between campaigns

A Character can exist in no campaign, so a player can build one before joining a game. Outside a campaign its current Character Owner, initially its creator, is the only one who can see or edit it. Inside a campaign everyone in the campaign can edit it, as before. Adding it to a campaign moves that same Character, so it is in at most one campaign at a time. Leaving takes it off the militia roster through a Militia Correction and detaches campaign homebrew from its sheet. This keeps one identity per person (ADR 0001), and history is unaffected because finished weeks read only their frozen snapshots.

[Decide Character ownership when campaign access changes](https://github.com/AndreasUnunger/EverythingPath/issues/245) amends the original decision in [Decide how Characters exist outside a campaign, and the app's home](https://github.com/AndreasUnunger/EverythingPath/issues/212): ownership supplies departure authority, while any current campaign member may reassign it to any current member without either person's approval. Taking ownership and then leaving is deliberately allowed by the shared editing model. Losing organization access returns Characters to a surviving owner; deleting an account instead preserves campaign Characters for reassignment and removes private Characters. This preserves the player's Characters when access ends and the campaign's Characters when their owner no longer exists.

## Considered Options

- **Copy into the campaign**: rejected because the same person would then have two Characters whose sheets drift apart.
- **One Character shared by several campaigns at once**: rejected because levelling up or a militia week in one campaign would change the others.
- **Characters with no campaign owned by an organization**: rejected because a Character belongs to the person who plays or prepares it, not to whichever group is active. Such an organization would also be little more than a campaign without a militia.

## Consequences

`character.campaignId` becomes optional, and ownership grants access outside a campaign. `ownerId` is also optional for retained Characters whose owner's account was deleted. Sheet entries no longer carry a `campaignId`, because their Character can move. The app gets top-level Campaigns and Characters areas.

App-controlled campaign or organization deletion first returns surviving-owner Characters and requires ownerless Characters to be assigned. External organization deletion instead retains ownerless Characters and their sheet dependencies, inaccessible to users, for app-operator recovery. Frozen history, including superseded records, is retained: deleted-campaign history is read-only for current members of its surviving organization, while deleted-organization history is inaccessible to users. The [ownership and lifecycle contract](../pf-character-sheet-data-model.md#ownership-and-campaigns) specifies the departure, access and retry requirements.

[Decide how campaign homebrew moves with a Character](https://github.com/AndreasUnunger/EverythingPath/issues/244) supplies the [homebrew departure contract](../character-sheet/catalog-scopes.md#campaign-homebrew-moving-with-a-character): carried definitions and saved state survive, complete future homebrew progression remains available subject to attribution holds, and joining never replaces choices. Each class uses one explicitly chosen definition across all its levels. Departure preparation may be resumable, but publication selects the complete remapped sheet and campaign transition with its militia changes together; ownership and deletion policy are unchanged.
