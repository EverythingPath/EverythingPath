import { characterNotFound } from '../../src/lib/character-not-found';
import { isCatalogFixtureCampaign } from './catalogFixturePolicy';
import {
  readSelectedCatalogBoundary,
  readSelectedCharacterFacts,
} from './catalogReleaseBoundary';
import { readSelectedCanonicalMilitiaState } from './selectedCanonicalMilitiaState';
import { ConvexError, v } from 'convex/values';
import { markCatalogImpactDirty } from './catalogReleaseImpact';
import { calculateMilitiaCharacterFacts } from './militiaCharacterFacts';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import type { MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { militiaSetupSchema } from '../../src/lib/canonical-setup';
import {
  militiaSnapshotSchema,
  weeklySourceKey,
} from '../../src/lib/canonical-weekly-source';
import {
  mirrorRosterKinds,
  normalizeCharacterKind,
  type CharacterKind,
  type SubmittedKind,
} from '../../src/lib/character-kind';

export async function updateCanonicalCharacter(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  preparedSheet?: Parameters<typeof calculateMilitiaCharacterFacts>[2],
) {
  const character = await ctx.db.get('character', characterId);
  if (!character) throw new ConvexError(characterNotFound);
  if (character.sheetMode) await markCatalogImpactDirty(ctx, characterId);
  const facts = await calculateMilitiaCharacterFacts(
    ctx,
    character,
    preparedSheet,
    { trustedLinkedInputs: true },
  );
  if (character.sheetMode) {
    const {
      characterId: _characterId,
      isActive: _isActive,
      ...permanentFacts
    } = facts;
    const sheetPermanentFacts = {
      ...permanentFacts,
      racialHitDice: facts.racialHitDice ?? 0,
    };
    if (
      weeklySourceKey(character.sheetPermanentFacts ?? null) !==
      weeklySourceKey(sheetPermanentFacts)
    )
      await ctx.db.patch('character', characterId, { sheetPermanentFacts });
  }
  const campaignId = character.campaignId;
  const militia = campaignId
    ? await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
        .unique()
    : null;
  const source = militia
    ? await readSelectedCanonicalMilitiaState(ctx, militia._id)
    : null;
  const previousFacts = await publishLiveCharacterFacts(ctx, character, facts);
  if (!source) return;
  const characters = source.snapshot.characters.some(
    (c) => c.characterId === characterId,
  )
    ? source.snapshot.characters.map((c) =>
        c.characterId === characterId ? facts : c,
      )
    : [...source.snapshot.characters, facts];
  // The record owns the kind: its roster mirror follows in the same write.
  const kind = character.kind;
  const roster = {
    ...source.snapshot.roster,
    people: source.snapshot.roster.people.map((p) =>
      p.characterId === characterId ? { ...p, kind } : p,
    ),
  };
  const priorCharacters = source.snapshot.characters.map((row) =>
    row.characterId === characterId && previousFacts
      ? previousFacts.facts
      : row,
  );
  if (
    weeklySourceKey(characters) === weeklySourceKey(priorCharacters) &&
    weeklySourceKey(roster) === weeklySourceKey(source.snapshot.roster)
  )
    return;
  await ctx.db.patch('canonicalMilitiaState', source._id, {
    revision: source.storedRevision + 1,
    snapshot: {
      ...source.snapshot,
      characters,
      roster,
    },
  });
}

async function publishLiveCharacterFacts(
  ctx: MutationCtx,
  character: Doc<'character'>,
  facts: Awaited<ReturnType<typeof calculateMilitiaCharacterFacts>>,
) {
  if (!character.sheetMode) return null;
  const campaign = character.campaignId
    ? await ctx.db.get('campaign', character.campaignId)
    : null;
  const isPrepared = campaign
    ? isCatalogFixtureCampaign(campaign)
    : character.sheetDemo;
  if (!isPrepared) return null;
  const boundary = await readSelectedCatalogBoundary(ctx);
  const previousFacts = await readSelectedCharacterFacts(
    ctx,
    character._id,
    boundary,
  );
  const existingFacts = await ctx.db
    .query('catalogCharacterFacts')
    .withIndex('by_characterId', (q) => q.eq('characterId', character._id))
    .unique();
  const record = {
    characterId: character._id,
    facts: { ...facts, characterId: character._id },
    generation: previousFacts?.generation ?? 0,
    releaseNumber: boundary.control?.releaseNumber ?? null,
  };
  if (existingFacts) {
    const { _id, _creationTime, ...stored } = existingFacts;
    // Equal facts leave the live projection, and every reader, untouched.
    if (weeklySourceKey(stored) !== weeklySourceKey(record))
      await ctx.db.replace('catalogCharacterFacts', _id, record);
  } else await ctx.db.insert('catalogCharacterFacts', record);
  return previousFacts;
}

// A live source about to be written, with every roster kind resolved against
// the campaign's current records, so a stale or old-client payload can never
// restore an earlier kind. People without a record in this campaign keep their
// own kind; reference checks decide whether they may stay.
export async function withCurrentRecordKinds<
  Snapshot extends {
    roster: { people: { characterId: string; kind: CharacterKind }[] };
  },
>(
  ctx: MutationCtx,
  campaignId: Id<'campaign'>,
  snapshot: Snapshot,
): Promise<Snapshot> {
  const records = [];
  for (const { characterId } of snapshot.roster.people) {
    const id = ctx.db.normalizeId('character', characterId);
    const record = id && (await ctx.db.get('character', id));
    if (record?.campaignId === campaignId)
      records.push({ characterId, kind: record.kind });
  }
  return {
    ...snapshot,
    roster: mirrorRosterKinds(snapshot.roster, records),
  };
}

// B3: a browser still on a bundle from before #180 may submit the legacy
// roster labels officer_npc and other_npc with a Setup or Militia correction.
// Storage takes only PC or NPC, so these argument validators accept the old
// labels and `withSubmittedKindsNormalized` maps them before parsing. Remove
// them with B3 and use the stored validators directly.
const submittedKindValidator = v.union(
  v.literal('pc'),
  v.literal('officer_npc'),
  v.literal('other_npc'),
  v.literal('npc'),
);
const snapshotValidator = zodOutputToConvex(militiaSnapshotSchema);
const { roster } = snapshotValidator.fields;
export const submittedSnapshotValidator = v.object({
  ...snapshotValidator.fields,
  roster: v.object({
    ...roster.fields,
    people: v.array(
      v.object({
        ...roster.fields.people.element.fields,
        kind: submittedKindValidator,
      }),
    ),
  }),
});
const setupValidator = zodOutputToConvex(militiaSetupSchema);
export const submittedSetupValidator = v.object({
  ...setupValidator.fields,
  state: v.object({
    ...setupValidator.fields.state.fields,
    militiaSnapshot: submittedSnapshotValidator,
  }),
});

export function withSubmittedKindsNormalized<
  Snapshot extends {
    roster: { people: { characterId: string; kind: SubmittedKind }[] };
  },
>(snapshot: Snapshot) {
  return {
    ...snapshot,
    roster: {
      ...snapshot.roster,
      people: snapshot.roster.people.map((person) => ({
        ...person,
        kind: normalizeCharacterKind(person.kind),
      })),
    },
  };
}
