import type { CharacterSheetInput, SheetWarning } from './character-sheet';
import type {
  ResolvedCollectionSpell,
  ResolvedSpellCollection,
} from './character-sheet-spell-collections';
import type { ResolvedSpellcasting } from './character-sheet-spellcasting';

type SpellWarningFacts = {
  spell: ResolvedCollectionSpell;
  casting: ResolvedSpellcasting;
  classIdentity: string | undefined;
  listIdentity: string;
};

function spellListIdentity(input: CharacterSheetInput, classTag: string) {
  return (
    input.catalogEntries.find((definition) => definition._id === classTag)
      ?.ruleIdentity ?? classTag
  );
}

function spellWithoutSpellcastingWarning({
  spell,
  casting,
  classIdentity,
}: {
  spell: ResolvedCollectionSpell;
  casting?: ResolvedSpellcasting;
  classIdentity: string | undefined;
}): SheetWarning {
  return {
    kind: 'rules',
    check: 'spellOrphaned',
    subject: spell.entryId,
    target: { kind: 'entry', entryId: spell.entryId },
    fingerprint: JSON.stringify([
      spell.ruleIdentity,
      classIdentity ?? null,
      casting?.record ?? null,
    ]),
    message: `${spell.name} is not under any Spellcasting.`,
  };
}

function spellOffListWarning({
  spell,
  casting,
  classIdentity,
  listIdentity,
}: SpellWarningFacts): SheetWarning {
  return {
    kind: 'rules',
    check: 'spellOffList',
    subject: spell.entryId,
    target: { kind: 'entry', entryId: spell.entryId },
    fingerprint: JSON.stringify([
      spell.ruleIdentity,
      classIdentity,
      listIdentity,
      spell.spellLevel,
    ]),
    message: `${spell.name} is not on the ${casting.name} spell list.`,
  };
}

function spellLevelWarning({
  spell,
  casting,
  classIdentity,
}: SpellWarningFacts): SheetWarning | null {
  const target = { kind: 'entry', entryId: spell.entryId } as const;
  // A pending Archetype choice leaves the level and castable levels open (#238).
  if (
    casting.unresolved.includes('presence') ||
    casting.unresolved.includes('table') ||
    casting.spellList.classTag === null ||
    casting.spellList.unresolved.includes(spell.ruleIdentity)
  )
    return null;
  if (spell.spellLevel === null)
    return {
      kind: 'incomplete',
      check: 'spellLevel',
      subject: spell.entryId,
      target,
      fingerprint: JSON.stringify([spell.ruleIdentity, classIdentity, null]),
      message: `Choose a level for ${spell.name}.`,
    };
  if (casting.castableSpellLevels.includes(spell.spellLevel)) return null;
  return {
    kind: 'rules',
    check: 'spellLevel',
    subject: spell.entryId,
    target,
    fingerprint: JSON.stringify([
      spell.ruleIdentity,
      classIdentity,
      spell.spellLevel,
      casting.castableSpellLevels.length
        ? Math.max(...casting.castableSpellLevels)
        : null,
    ]),
    message: `${casting.name} cannot cast level ${spell.spellLevel} spells yet.`,
  };
}

export function spellCollectionWarnings({
  input,
  spell,
  casting,
}: {
  input: CharacterSheetInput;
  spell: ResolvedCollectionSpell;
  casting: ResolvedSpellcasting | undefined;
}): SheetWarning[] {
  const classIdentity = input.catalogEntries.find(
    (definition) => definition._id === spell.classEntryId,
  )?.ruleIdentity;
  if (!casting || casting.record === 'none')
    return [spellWithoutSpellcastingWarning({ spell, casting, classIdentity })];
  const facts = {
    spell,
    casting,
    classIdentity,
    listIdentity: spellListIdentity(input, casting.classTag),
  };
  const levelWarning = spellLevelWarning(facts);
  return [
    ...(spell.offList ? [spellOffListWarning(facts)] : []),
    ...(levelWarning ? [levelWarning] : []),
  ];
}

export function spellCountWarnings({
  input,
  collection,
}: {
  input: CharacterSheetInput;
  collection: ResolvedSpellCollection;
}): SheetWarning[] {
  const classIdentity = input.catalogEntries.find(
    (definition) => definition._id === collection.classEntryId,
  )?.ruleIdentity;
  return collection.levels.flatMap((level): SheetWarning[] => {
    if (level.allowance === null || level.count <= level.allowance) return [];
    return [
      {
        kind: 'rules',
        check: 'spellCount',
        subject: `spellcasting:${classIdentity ?? collection.classTag}:${level.spellLevel}`,
        target: {
          kind: 'spellcasting',
          classEntryId: collection.classEntryId,
          spellLevel: level.spellLevel,
        },
        fingerprint: JSON.stringify([
          classIdentity,
          spellListIdentity(input, collection.classTag),
          level.spellLevel,
          level.count,
          level.allowance,
        ]),
        message: `${level.count} level ${level.spellLevel} spells known exceeds the allowance of ${level.allowance}.`,
      },
    ];
  });
}
