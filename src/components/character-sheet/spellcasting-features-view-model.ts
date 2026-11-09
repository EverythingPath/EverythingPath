import {
  spellSchoolKeys,
  type SpellSchoolKey,
} from '~/lib/character-sheet-casting-tables';
import { parseGrantKeyId, type GrantKey } from '~/lib/character-sheet-grants';
import { buildSheetWarningViews } from './character-sheet-warning-view-model';
import { schoolChoice, type SchoolChoice } from './spell-school-choice';
import type {
  CharacterSheetSnapshot,
  SheetWarningView,
} from './use-character-sheet';

type FeaturesSnapshot = Pick<
  CharacterSheetSnapshot,
  'calculated' | 'catalogEntries' | 'acceptedWarnings'
>;
type Spellcasting =
  CharacterSheetSnapshot['calculated']['spellcastings'][number];
type GrantedSpell = Spellcasting['grantedSpells'][number] & {
  key: string;
  /** "Fire Domain, Sun Domain": every feature granting the Spell. */
  sourceNames: string;
};

/** Where an opposition write points: a stored row or a Grant. */
export type FeatureTarget = { entryId: string } | { grantKey: GrantKey };

export type SpellcastingSchoolView = {
  entryId: string;
  target: FeatureTarget;
  name: string;
  school: SchoolChoice<SpellSchoolKey>;
  oppositionSchools: SchoolChoice<SpellSchoolKey>[];
  required: number;
  options: (SchoolChoice<SpellSchoolKey> & { selected: boolean })[];
  missing: boolean;
  warnings: SheetWarningView[];
};

export type SpellcastingFeaturesView = {
  classEntryId: string;
  /** "Wizard 3 +2 from Mystic Theurge": how the casting level adds up. */
  castingSum: string;
  pendingAdvances: number;
  extraSlots: Spellcasting['extraSlots'];
  grantedSpellsByLevel: { spellLevel: number; spells: GrantedSpell[] }[];
  school: SpellcastingSchoolView | null;
};

function warningsFor(
  snapshot: FeaturesSnapshot,
  subject: string,
): SheetWarningView[] {
  return buildSheetWarningViews(
    snapshot.calculated.warnings.filter(
      (warning) => warning.subject === subject,
    ),
    snapshot.acceptedWarnings,
  );
}

function targetFor(entryId: string): FeatureTarget {
  const grantKey = parseGrantKeyId(entryId, { requireComplete: true });
  return grantKey ? { grantKey } : { entryId };
}

function castingSum(casting: Spellcasting) {
  return [
    `${casting.name} ${casting.classLevels}`,
    ...casting.advances.map(
      (advance) => `+${advance.count} from ${advance.name}`,
    ),
  ].join(' ');
}

/**
 * Numbers, Granted Spells and specialist school of one Spellcasting for its
 * page and its Arcane School class feature row. Domain, school and bloodline
 * picks are ordinary prompt Selections on the class feature rows.
 */
export function buildSpellcastingFeaturesView(
  snapshot: FeaturesSnapshot,
  classEntryId: string,
): SpellcastingFeaturesView | null {
  const casting = snapshot.calculated.spellcastings.find(
    (row) => row.classEntryId === classEntryId,
  );
  if (!casting) return null;
  const levels = [
    ...new Set(casting.grantedSpells.map((spell) => spell.spellLevel)),
  ].sort((left, right) => left - right);
  const school = casting.school;
  return {
    classEntryId,
    castingSum: castingSum(casting),
    pendingAdvances: casting.pendingAdvances,
    extraSlots: casting.extraSlots,
    grantedSpellsByLevel: levels.map((spellLevel) => ({
      spellLevel,
      spells: casting.grantedSpells
        .filter((spell) => spell.spellLevel === spellLevel)
        .map((spell) => ({
          ...spell,
          key: `granted:${spell.spellLevel}:${spell.catalogEntryId}`,
          sourceNames: spell.sources.map((source) => source.name).join(', '),
        })),
    })),
    school: school
      ? {
          entryId: school.entryId,
          target: targetFor(school.entryId),
          name: school.name,
          school: schoolChoice(school.school),
          oppositionSchools: school.oppositionSchools.map(schoolChoice),
          required: school.oppositionSchoolCount,
          options: spellSchoolKeys
            .filter((key) => key !== school.school)
            .map((key) => ({
              ...schoolChoice(key),
              selected: school.oppositionSchools.includes(key),
            })),
          missing:
            school.oppositionSchools.length < school.oppositionSchoolCount,
          warnings: warningsFor(
            snapshot,
            `${school.entryId}:oppositionSchools`,
          ),
        }
      : null,
  };
}
