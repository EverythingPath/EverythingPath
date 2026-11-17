import type { PcgenEffectiveRecord, PcgenEffectiveView } from './effective';
import { at, type At } from './schedule-model';

/**
 * Reviewed grants: a feature the printed archetype gives that its pinned
 * PCGen record has but doesn't grant, by the archetype's and the feature's
 * file and KEY. The archetype mapper adds it as one of the archetype's
 * grants, at its class level (`mapArchetype`), and the identity assignment
 * keys it as a feature the archetype owns (`featureSubjects`); the PCGen
 * inventory stays PCGen's own.
 *
 * A grant is refused, not skipped, when the tree holds the archetype but not
 * the feature's record, or holds it elsewhere than the reviewed line, or when
 * the archetype's own grants already name the feature, so the correction
 * can't silently stand for a missing or moved record or double a grant PCGen
 * starts making.
 */
export type ReviewedGrant = {
  /** Stable, such as `ecclesitheurge-blessing-of-the-faithful`. */
  id: string;
  /** The archetype record's file and KEY. */
  archetype: { file: string; key: string };
  /** The granted feature's record: its file and KEY, and where it stands. */
  feature: { file: string; key: string; at: At };
  /** The ability category the archetype's own grants of its features use. */
  category: string;
  classLevel: number;
  /** Where the PRD prints the feature as the archetype's, under the capture's `pages/`. */
  printed: At;
  decision: string;
};

const acgAbilities =
  'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const clericOptions = 'advancedClassGuide/classOptions/cleric.html';

export const reviewedGrants: readonly ReviewedGrant[] = [
  {
    id: 'ecclesitheurge-blessing-of-the-faithful',
    archetype: { file: acgAbilities, key: 'Cleric Archetype ~ Ecclesitheurge' },
    feature: {
      file: acgAbilities,
      key: 'Ecclesitheurge ~ Blessing of the Faithful',
      at: at(acgAbilities, 3018),
    },
    category: 'Cleric Class Feature',
    classLevel: 1,
    printed: at(clericOptions, 353),
    decision: `The PRD prints Blessing of the Faithful among the Ecclesitheurge's features (${at(clericOptions, 353)}), between the 1st-level vow that already names "his blessing of the faithful ability" (${at(clericOptions, 352)}) and the 1st-level Domain Mastery (:354), its range scaling from 1st level (25 ft. + 5 ft./2 levels), and replacing nothing. PCGen has its record (${at(acgAbilities, 3018)}) but the archetype's ABILITY list grants only the other four features (${at(acgAbilities, 3014)}), so it is granted here at cleric level 1, in the category of the archetype's other grants.`,
  },
];

const fold = (text: string) => text.toLowerCase();

/** The reviewed grants of one effective archetype, each with its feature's effective record. */
export function reviewedGrantsOf(
  archetype: PcgenEffectiveRecord,
  view: PcgenEffectiveView,
) {
  const { file, key } = archetype.record.locator;
  return reviewedGrants
    .filter(
      (grant) =>
        grant.archetype.file === file &&
        fold(grant.archetype.key) === fold(key),
    )
    .map((grant) => {
      const named = fold(grant.feature.key);
      if (
        archetype.grants.some(({ keys }) =>
          keys.some((granted) => fold(granted) === named),
        )
      )
        throw new Error(
          `${key} (${file}) grants ${grant.feature.key} itself; remove the reviewed grant ${grant.id}.`,
        );
      const features = [...view.records.values()].filter(
        ({ record }) =>
          record.locator.file === grant.feature.file &&
          fold(record.locator.key) === named,
      );
      const [feature] = features;
      if (!feature)
        throw new Error(
          `The reviewed grant ${grant.id} names ${grant.feature.key} (${grant.feature.file}), which the PCGen tree does not hold.`,
        );
      const found = features.map(({ record }) =>
        at(record.locator.file, record.locator.line),
      );
      if (found.length > 1 || found[0] !== grant.feature.at)
        throw new Error(
          `The reviewed grant ${grant.id} names ${grant.feature.key} at ${grant.feature.at}, but the PCGen tree holds it at ${found.join(', ')}; review the grant again.`,
        );
      return { grant, feature };
    });
}
