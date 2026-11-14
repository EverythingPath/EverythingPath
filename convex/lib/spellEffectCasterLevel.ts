import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { spellEffectDefaultCasterLevel } from '../../src/lib/character-sheet-spell-effects';
import type { CharacterScope } from './characterAccess';
import {
  loadCharacterSheet,
  type LoadedCharacterSheet,
} from './characterSheet';

type SpellEffectDetail = Extract<
  Doc<'catalogEntry'>['detail'],
  { kind: 'spellEffect' }
>;

/**
 * #236 "Spell Effects": a new or cleared Spell Effect's caster level, the
 * lowest legal one for its Spell, or its defined default when unlinked.
 */
export function defaultSpellEffectCasterLevel(
  sheet: Pick<LoadedCharacterSheet, 'catalogEntries' | 'resources'>,
  detail: SpellEffectDetail,
) {
  return spellEffectDefaultCasterLevel(
    detail,
    sheet.catalogEntries,
    sheet.resources?.castingTables,
  );
}

/**
 * The default for a Spell Effect whose Character-owned definition was just
 * written. The sheet loaded before it has no Spell its `spellKey` names, so
 * it loads again and finds that Spell by rule identity, as every read does.
 */
export async function readNewSpellEffectCasterLevel(
  ctx: ReadCtx,
  args: CharacterScope,
  sheet: Pick<LoadedCharacterSheet, 'catalogEntries' | 'resources'>,
  detail: SpellEffectDetail,
) {
  if (!detail.spellKey) return defaultSpellEffectCasterLevel(sheet, detail);
  const loaded = await loadCharacterSheet(ctx, args, { isWritable: true });
  if (!loaded) throw new ConvexError('Character Sheet is unavailable');
  return defaultSpellEffectCasterLevel(loaded, detail);
}
