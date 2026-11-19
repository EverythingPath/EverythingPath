import { ConvexError } from 'convex/values';
import type { WithoutSystemFields } from 'convex/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { updateSpellCatalogSummary } from './spellCatalogSummary';
import { releaseByteCount } from '../../src/lib/catalog/release-schema';

type SpellIndexRow = WithoutSystemFields<Doc<'spellCatalogIndex'>>;
type MoveSpellInputs = {
  characterId: Id<'character'>;
  destinationCampaignId?: Id<'campaign'>;
  entries: readonly Doc<'characterSheetEntry'>[];
  definitions: readonly Doc<'catalogEntry'>[];
  destinationDefinitions: readonly Doc<'catalogEntry'>[];
};

function readCastingClasses(definitions: readonly Doc<'catalogEntry'>[]) {
  const classes = definitions.flatMap((row) =>
    row.detail.kind === 'class' && 'casting' in row.detail && row.detail.casting
      ? [{ definition: row, casting: row.detail.casting }]
      : [],
  );
  if (classes.length > 64)
    throw new ConvexError('Character has too many casting lists');
  return classes;
}
type CastingClass = ReturnType<typeof readCastingClasses>[number];

function requireSpellScopes({
  characterId,
  destinationCampaignId,
  definitions,
  destinationDefinitions,
}: MoveSpellInputs) {
  for (const row of definitions)
    if (
      (row.scope === 'character' && row.characterId !== characterId) ||
      (row.scope === 'campaign' && row.campaignId !== destinationCampaignId)
    )
      throw new ConvexError('Spell catalog does not belong to this Character');
  if (
    destinationDefinitions.some(
      (row) =>
        row.scope !== 'campaign' || row.campaignId !== destinationCampaignId,
    )
  )
    throw new ConvexError('Destination spell does not belong to this campaign');
}

function selectCastingSpells({
  castingClass,
  entries,
  candidates,
  byId,
}: {
  castingClass: CastingClass;
  entries: MoveSpellInputs['entries'];
  candidates: readonly Doc<'catalogEntry'>[];
  byId: ReadonlyMap<Id<'catalogEntry'>, Doc<'catalogEntry'>>;
}) {
  const selections = new Map<string, Doc<'catalogEntry'>>();
  for (const row of candidates)
    if (
      row.detail.kind === 'spell' &&
      Object.hasOwn(row.detail.levels ?? {}, castingClass.casting.classTag)
    ) {
      const previous = selections.get(row.ruleIdentity);
      if (
        !previous ||
        (row.scope === 'character' && previous.scope !== 'character')
      )
        selections.set(row.ruleIdentity, row);
    }
  for (const entry of entries)
    if (
      entry.kind === 'spell' &&
      !entry.grantKey &&
      entry.state.castingClassId === castingClass.definition._id
    ) {
      const recorded = byId.get(entry.catalogEntryId);
      if (recorded?.detail.kind === 'spell')
        selections.set(recorded.ruleIdentity, recorded);
    }
  return selections;
}

function spellIndexAddition({
  characterId,
  castingClass,
  spell,
  entries,
}: {
  characterId: Id<'character'>;
  castingClass: CastingClass;
  spell: Doc<'catalogEntry'>;
  entries: MoveSpellInputs['entries'];
}): SpellIndexRow | null {
  if (spell.detail.kind !== 'spell') return null;
  const recorded = entries.find(
    (entry) =>
      entry.kind === 'spell' &&
      !entry.grantKey &&
      entry.state.castingClassId === castingClass.definition._id &&
      entry.catalogEntryId === spell._id,
  );
  const levels = spell.detail.levels ?? {};
  const onList = Object.hasOwn(levels, castingClass.casting.classTag);
  const lowest = Object.values(levels).length
    ? Math.min(...Object.values(levels))
    : null;
  let level = lowest;
  if (onList) level = levels[castingClass.casting.classTag] ?? null;
  else if (recorded?.kind === 'spell') level = recorded.state.level ?? lowest;
  return {
    characterId,
    castingClassId: castingClass.definition._id,
    catalogEntryId: spell._id,
    ruleIdentity: spell.ruleIdentity,
    levels,
    name: spell.name,
    school: spell.detail.school ?? '',
    level,
    available: onList || Boolean(recorded),
    recorded: Boolean(recorded),
  };
}

function calculateSpellIndexAdditions(
  inputs: MoveSpellInputs,
  existing: readonly Doc<'spellCatalogIndex'>[],
) {
  const candidates = [...inputs.definitions, ...inputs.destinationDefinitions];
  const byId = new Map(candidates.map((row) => [row._id, row]));
  const additions: SpellIndexRow[] = [];
  for (const castingClass of readCastingClasses(inputs.definitions))
    for (const [ruleIdentity, spell] of selectCastingSpells({
      castingClass,
      entries: inputs.entries,
      candidates,
      byId,
    })) {
      if (
        existing.some(
          (row) =>
            row.castingClassId === castingClass.definition._id &&
            (row.ruleIdentity === ruleIdentity ||
              byId.get(row.catalogEntryId)?.ruleIdentity === ruleIdentity),
        )
      )
        continue;
      const addition = spellIndexAddition({
        characterId: inputs.characterId,
        castingClass,
        spell,
        entries: inputs.entries,
      });
      if (addition) additions.push(addition);
    }
  return additions;
}

async function requireSpellPublicationCapacity(
  ctx: MutationCtx,
  additions: readonly SpellIndexRow[],
) {
  // Each addition writes the index and at most two summary groups.
  const metrics = await ctx.meta.getTransactionMetrics();
  if (
    additions.length * 3 + 1024 >
      Math.min(8192, metrics.documentsWritten.remaining) ||
    releaseByteCount(additions) * 3 + 512 * 1024 >
      Math.min(16 * 1024 * 1024, metrics.bytesWritten.remaining)
  )
    throw new ConvexError(
      'Destination spell expansion exceeds atomic publication limits; the Character remains in its current campaign',
    );
}

async function writeSpellIndexAdditions(
  ctx: MutationCtx,
  additions: readonly SpellIndexRow[],
) {
  for (const row of additions) {
    await ctx.db.insert('spellCatalogIndex', row);
    await updateSpellCatalogSummary({ ctx, row, delta: 1 });
  }
}

/** Add newly accessible list members; preserve existing browser and recording choices. */
export async function publishCharacterMoveSpellIndex(
  ctx: MutationCtx,
  inputs: MoveSpellInputs,
) {
  requireSpellScopes(inputs);
  const existing = await ctx.db
    .query('spellCatalogIndex')
    .withIndex('by_characterId_and_catalogEntryId', (q) =>
      q.eq('characterId', inputs.characterId),
    )
    .take(8193);
  if (existing.length > 8192)
    throw new ConvexError('Character spell catalog exceeds the prepared limit');
  const additions = calculateSpellIndexAdditions(inputs, existing);
  await requireSpellPublicationCapacity(ctx, additions);
  await writeSpellIndexAdditions(ctx, additions);
}
