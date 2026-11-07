import type { CharacterSheetInput, SheetEntry } from './character-sheet';
import { characterSheetClassFamily } from './character-sheet-grants';
import { ruleKeyMatches } from './character-sheet-rule-keys';

type ClassLevel = Extract<SheetEntry, { kind: 'classLevel' }>;

export function compareClassLevelPosition(a: SheetEntry, b: SheetEntry) {
  const position = (entry: SheetEntry) =>
    entry.kind === 'classLevel' ? entry.state.position : 0;
  return position(a) - position(b);
}

export function classFamilyLevels(
  input: CharacterSheetInput,
  classIdentity: string,
) {
  return input.entries
    .filter((entry): entry is ClassLevel => {
      if (entry.kind !== 'classLevel') return false;
      const definition = input.catalogEntries.find(
        (candidate) => candidate._id === entry.state.classEntryId,
      );
      return (
        definition?.detail?.kind === 'class' &&
        (ruleKeyMatches(definition.ruleIdentity, classIdentity) ||
          ruleKeyMatches(
            characterSheetClassFamily(definition, input.catalogEntries),
            classIdentity,
          ))
      );
    })
    .sort(compareClassLevelPosition);
}

/**
 * The sheet entry identity of a class's built-in progression rows (its BAB,
 * saves and the like). Substitutions such as the Combined Form's and the
 * core flurry's replace a class's BAB row by this identity.
 */
export function classProgressionEntryId(classRuleIdentity: string) {
  return `builtin:class:${classRuleIdentity}`;
}
