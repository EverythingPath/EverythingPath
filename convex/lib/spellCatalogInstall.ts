import { ConvexError } from 'convex/values';
import { validate } from 'convex-helpers/validators';
import { situationalNoteSchema } from '../../src/lib/character-sheet';
import { listCatalogReferences } from '../../src/lib/catalog-copy-references';
import { situationalNoteValidator } from '../schema';
import type { z } from 'zod';
import { extractCatalogDescriptionText } from '../../src/lib/catalog/description-text';
import type {
  importedCatalogEntrySchema,
  importedSpellDetailSchema,
} from '../../src/lib/catalog/imported-entry-schema';
import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import {
  reconcileSpellDefinition,
  type SpellCatalogSheet,
} from './spellCatalog';

type ImportedSpell = z.infer<typeof importedCatalogEntrySchema> & {
  detail: z.infer<typeof importedSpellDetailSchema>;
};
export async function installPreparedSpells({
  ctx,
  sheet,
  spells,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
  spells: readonly ImportedSpell[];
}) {
  if (spells.length > 64)
    throw new ConvexError('Import at most 64 Spells per batch');
  const ids: Id<'catalogEntry'>[] = [];
  for (const spell of spells) {
    if (spell.detail.kind !== 'spell')
      throw new ConvexError('Import only Spell definitions');
    const situationalNotes = spell.situationalNotes?.map((input) => {
      if (listCatalogReferences(input).length)
        throw new ConvexError(
          'Imported Spell Note catalog references are not supported',
        );
      const parsed = situationalNoteSchema.safeParse(input);
      if (!parsed.success) throw new ConvexError('Situational Note is invalid');
      const note: unknown = parsed.data;
      if (!validate(situationalNoteValidator, note, { db: ctx.db }))
        throw new ConvexError('Situational Note is invalid');
      return note;
    });
    if (
      Object.values(spell.detail.levels).some(
        (level) => !Number.isSafeInteger(level) || level < 0,
      )
    )
      throw new ConvexError('Enter whole nonnegative spell levels');
    const matches = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q
          .eq('characterId', sheet.character._id)
          .eq('ruleIdentity', spell.externalKey),
      )
      .take(65);
    if (matches.length > 64)
      throw new ConvexError('Spell has too many Catalog Copies');
    const previous =
      matches.find((row) => !row.copiedFrom && row.importedSpell) ??
      matches.find((row) => !row.copiedFrom);
    if (previous && previous.detail.kind !== 'spell')
      throw new ConvexError('Catalog identity already belongs to another kind');
    const fields = {
      scope: 'character' as const,
      characterId: sheet.character._id,
      importedSpell: true as const,
      name: spell.name,
      ruleIdentity: spell.externalKey,
      stacksWithItself: false,
      sources: spell.sources,
      modifiers: [],
      situationalNotes,
      detail: {
        kind: 'spell' as const,
        levels: spell.detail.levels,
        school: spell.detail.school,
        description: extractCatalogDescriptionText({ html: spell.description }),
      },
    };
    const catalogEntryId =
      previous?._id ??
      (await ctx.db.insert('catalogEntry', { ...fields, browseOnly: true }));
    if (previous) await ctx.db.patch('catalogEntry', catalogEntryId, fields);
    await reconcileSpellDefinition({ ctx, sheet, catalogEntryId });
    ids.push(catalogEntryId);
  }
  return ids;
}
