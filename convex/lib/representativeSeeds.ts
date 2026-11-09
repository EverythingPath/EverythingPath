import type { WithoutSystemFields } from 'convex/server';
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import { cloneWeaponDetail } from '../../src/lib/character-sheet-natural-attacks';
import {
  materializeRepresentativeArchetypeCatalog,
  representativeArchetypeCatalog,
} from './representativeArchetypeCatalog';
import {
  materializeRepresentativeClassDetail,
  representativeClassCatalog,
} from './representativeClassCatalog';
import {
  materializeRepresentativeRaceCatalog,
  representativeRaceCatalog,
} from './representativeRaceCatalog';
import { representativeSelectionCatalog } from './representativeSelectionCatalog';
import { representativeGrantedSpellCatalog } from './representativeSpellcastingCatalog';
import {
  representativeSpellEffectCatalog,
  representativeSpellEffectSpellCatalog,
} from './representativeSpellEffectCatalog';
import { representativeWeaponCatalog } from './representativeWeaponCatalog';
import {
  materializeRepresentativeMagicItem,
  representativeEquipmentCatalog,
  representativeItemAbilityCatalog,
  representativeMagicItemCatalog,
  representativeWondrousItemCatalog,
} from './representativeItemCatalog';

type StoredDefinition = WithoutSystemFields<Doc<'catalogEntry'>>;
type SeedDefinition = StoredDefinition extends infer Definition
  ? Definition extends unknown
    ? Omit<Definition, 'scope' | 'characterId' | 'browseOnly'>
    : never
  : never;

/** The writes seeding needs, so a test can seed the same rows in memory. */
export type RepresentativeSeedWriter = {
  insert(definition: StoredDefinition): Promise<Id<'catalogEntry'>>;
  replace(id: Id<'catalogEntry'>, definition: StoredDefinition): Promise<void>;
  patch(
    id: Id<'catalogEntry'>,
    fields: Partial<StoredDefinition>,
  ): Promise<void>;
};

/**
 * Seed a prepared sheet's representative definitions. They are browse-only
 * for good: a sheet loads one only when something references it or a rule
 * needs it by rule identity.
 */
export async function seedRepresentativeCatalog(
  writer: RepresentativeSeedWriter,
  characterId: Id<'character'>,
) {
  const stored = (definition: SeedDefinition): StoredDefinition => ({
    ...definition,
    characterId,
    scope: 'character',
    browseOnly: true,
  });
  const selectionCatalogIds = new Map<string, Id<'catalogEntry'>>();
  for (const definition of representativeSelectionCatalog)
    selectionCatalogIds.set(
      definition.ruleIdentity,
      await writer.insert(stored(definition)),
    );
  const classCatalogIds = new Map<string, Id<'catalogEntry'>>();
  for (const definition of representativeClassCatalog)
    classCatalogIds.set(
      definition.ruleIdentity,
      await writer.insert(stored(definition)),
    );
  for (const definition of representativeGrantedSpellCatalog)
    classCatalogIds.set(
      definition.ruleIdentity,
      await writer.insert(
        stored({
          ...definition,
          modifiers: [],
          sources: definition.sources.map((source) => ({ ...source })),
          detail: {
            ...definition.detail,
            levels: { ...definition.detail.levels },
          },
        }),
      ),
    );
  // Spell Effects name their Spells by rule identity, never by ID.
  for (const definition of [
    ...representativeSpellEffectSpellCatalog,
    ...representativeSpellEffectCatalog,
  ])
    await writer.insert(stored(structuredClone(definition)));
  const archetypeCatalogIds = new Map([
    ...selectionCatalogIds,
    ...classCatalogIds,
  ]);
  for (const definition of representativeArchetypeCatalog)
    archetypeCatalogIds.set(
      definition._id,
      await writer.insert(
        stored({
          name: definition.name ?? definition._id,
          ruleIdentity: definition.ruleIdentity,
          sources: definition.sources,
          modifiers: [],
          stacksWithItself: false,
          detail: { kind: 'manual' },
        }),
      ),
    );
  const idForArchetypeKey = (key: string) => {
    const id = archetypeCatalogIds.get(key);
    if (!id)
      throw new ConvexError(
        'Representative archetype reference is unavailable',
      );
    return id;
  };
  for (const { key, definition } of materializeRepresentativeArchetypeCatalog(
    idForArchetypeKey,
  ))
    await writer.replace(idForArchetypeKey(key), stored(definition));
  for (const definition of representativeClassCatalog)
    await writer.patch(idForArchetypeKey(definition.ruleIdentity), {
      detail: materializeRepresentativeClassDetail(
        definition.ruleIdentity,
        idForArchetypeKey,
      ),
    });
  const itemCatalogIds = new Map<string, Id<'catalogEntry'>>();
  for (const definition of representativeWeaponCatalog) {
    const detail: Extract<Doc<'catalogEntry'>['detail'], { kind: 'item' }> =
      'weapon' in definition.detail
        ? {
            ...definition.detail,
            weapon: cloneWeaponDetail(definition.detail.weapon),
          }
        : { ...definition.detail };
    itemCatalogIds.set(
      definition.ruleIdentity,
      await writer.insert(
        stored({
          ...definition,
          sources: definition.sources.map((source) => ({ ...source })),
          modifiers: [...definition.modifiers],
          detail,
          stacksWithItself: false,
        }),
      ),
    );
  }
  for (const definition of [
    ...representativeEquipmentCatalog,
    ...representativeWondrousItemCatalog,
    ...representativeItemAbilityCatalog,
  ])
    itemCatalogIds.set(
      definition.ruleIdentity,
      await writer.insert(stored(structuredClone(definition))),
    );
  const idForItemKey = (ruleIdentity: string) => {
    const id = itemCatalogIds.get(ruleIdentity);
    if (!id)
      throw new ConvexError('Representative item reference is unavailable');
    return id;
  };
  for (const definition of representativeMagicItemCatalog)
    await writer.insert(
      stored(materializeRepresentativeMagicItem(definition, idForItemKey)),
    );
  const raceCatalogIds = new Map<string, Id<'catalogEntry'>>();
  for (const definition of representativeRaceCatalog) {
    const existing = selectionCatalogIds.get(definition.ruleIdentity);
    raceCatalogIds.set(
      definition._id,
      existing ??
        (await writer.insert(
          stored({
            name: definition.name ?? definition._id,
            ruleIdentity: definition.ruleIdentity,
            stacksWithItself: false,
            sources: definition.sources,
            modifiers: [],
            detail: { kind: 'manual' },
          }),
        )),
    );
  }
  const idForRaceKey = (key: string) => {
    const id = raceCatalogIds.get(key);
    if (!id)
      throw new ConvexError('Representative race reference is unavailable');
    return id;
  };
  for (const { key, definition } of materializeRepresentativeRaceCatalog(
    idForRaceKey,
  )) {
    if (selectionCatalogIds.has(definition.ruleIdentity)) continue;
    await writer.replace(idForRaceKey(key), stored(definition));
  }
}
