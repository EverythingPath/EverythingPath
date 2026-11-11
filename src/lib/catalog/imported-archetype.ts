import type { z } from 'zod';
import { classFeatureMetadata } from '../character-sheet-archetype-helpers.ts';
import type { importedArchetypeDetailSchema } from './imported-entry-schema.ts';

type ImportedArchetypeDetail = z.infer<typeof importedArchetypeDetailSchema>;

/**
 * A stable key's prepared definition: its ID, its rule identity and, for a
 * class feature, its durable parent and part (#305).
 */
export type PreparedFeatureReference<Id> = {
  id: Id;
  ruleIdentity: string;
  parentFeature?: string;
  part?: string;
};

/** Every stable key an imported archetype names, once each. */
export function importedArchetypeKeys(detail: ImportedArchetypeDetail) {
  return [
    ...new Set([
      ...detail.classKeys,
      ...detail.replaces.map(({ externalKey }) => externalKey),
      ...detail.adds.map(({ externalKey }) => externalKey),
      ...(detail.featureChanges ?? []).map(({ externalKey }) => externalKey),
    ]),
  ];
}

/**
 * #716 P5: an imported archetype as the prepared #305 detail. Keys become
 * IDs. A feature change names its feature's durable identity, the parent
 * feature or else its rule identity, and a part change its part, the
 * feature's own or else `<classLevel>:<rule identity>`: the identity and part
 * the sheet gives that feature row (`classFeatureMetadata`), so a change and
 * a replacement of the same row compare equal.
 */
export function preparedArchetypeDetail<Id>(
  detail: ImportedArchetypeDetail,
  resolve: (externalKey: string) => PreparedFeatureReference<Id>,
) {
  /** The sheet's identity and part of a feature row (`classFeatureMetadata`). */
  const metadataOf = (externalKey: string, classLevel: number) => {
    const { ruleIdentity, parentFeature, part } = resolve(externalKey);
    return classFeatureMetadata({
      definition: {
        ruleIdentity,
        detail: { kind: 'classFeature', parentFeature, part },
      },
      classLevel,
    });
  };
  return {
    kind: 'archetype' as const,
    classEntryIds: detail.classKeys.map((key) => resolve(key).id),
    replaces: detail.replaces.map(({ classLevel, externalKey, scope }) => ({
      classLevel,
      catalogEntryId: resolve(externalKey).id,
      scope,
    })),
    adds: detail.adds.map(({ classLevel, externalKey }) => ({
      classLevel,
      catalogEntryId: resolve(externalKey).id,
    })),
    ...(detail.featureChanges
      ? {
          featureChanges: detail.featureChanges.map((change) =>
            change.scope === 'whole'
              ? {
                  featureIdentity: metadataOf(change.externalKey, 1)
                    .featureIdentity,
                  scope: 'whole' as const,
                }
              : {
                  ...metadataOf(change.externalKey, change.classLevel),
                  scope: 'part' as const,
                },
          ),
        }
      : {}),
    ...(detail.classSkillsAdded
      ? { classSkillsAdded: detail.classSkillsAdded }
      : {}),
    ...(detail.classSkillsRemoved
      ? { classSkillsRemoved: detail.classSkillsRemoved }
      : {}),
    ...(detail.skillRanksPerLevel === undefined
      ? {}
      : { skillRanksPerLevel: detail.skillRanksPerLevel }),
    ...(detail.casting ? { casting: detail.casting } : {}),
  };
}
