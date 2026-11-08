import { mirrorRosterKinds, type CharacterKind } from './character-kind';
import { militiaSetupSchema, type MilitiaSetup } from './canonical-setup';

type Snapshot = MilitiaSetup['state']['militiaSnapshot'];
export type SetupCharacterFacts = Snapshot['characters'][number];
// A campaign character as Setup and the roster editors offer it: its rules
// facts, name and the kind its record owns.
export type SetupCharacter = SetupCharacterFacts & {
  name: string;
  kind: CharacterKind;
};

// Setup's options carry names and facts but no kind; the authorized
// character read supplies each record's kind. A character whose record has
// not arrived yet is left out rather than given an invented kind.
export function composeSetupCharacters(
  options: readonly (SetupCharacterFacts & { name: string })[],
  records: readonly { _id: string; kind: CharacterKind }[],
): SetupCharacter[] {
  const kinds = new Map(records.map((record) => [record._id, record.kind]));
  return options.flatMap((character) => {
    const kind = kinds.get(character.characterId);
    return kind ? [{ ...character, kind }] : [];
  });
}

// The rules facts a snapshot stores for a character: never its name or kind.
export function setupCharacterFacts({
  name: _name,
  kind: _kind,
  ...facts
}: SetupCharacter): SetupCharacterFacts {
  return facts;
}

// Values whose roster kinds mirror the current records: what warnings read
// and what a start sends, so new writes carry only PC or NPC.
export function withRecordKinds(
  values: MilitiaSetup,
  characters: readonly SetupCharacter[],
): MilitiaSetup {
  const snapshot = values.state.militiaSnapshot;
  return {
    ...values,
    state: {
      ...values.state,
      militiaSnapshot: {
        ...snapshot,
        roster: mirrorRosterKinds(snapshot.roster, characters),
      },
    },
  };
}

// A restored roster takes each character's current ledger facts and kind, so
// a reload repairs a start that failed because a character changed since it
// was added. Characters no longer in the ledger stay, with their own
// normalized kind, for the player to remove.
export function withCurrentCharacters(
  values: MilitiaSetup,
  characters: readonly SetupCharacter[],
): MilitiaSetup {
  const current = new Map(
    characters.map((character) => [
      character.characterId,
      setupCharacterFacts(character),
    ]),
  );
  const refreshed = withRecordKinds(values, characters);
  const snapshot = refreshed.state.militiaSnapshot;
  return {
    ...refreshed,
    state: {
      ...refreshed.state,
      militiaSnapshot: {
        ...snapshot,
        characters: snapshot.characters.map(
          (character) => current.get(character.characterId) ?? character,
        ),
      },
    },
  };
}

export const MISSING_CHARACTER_MESSAGE =
  'This character is not in the campaign’s character list. Remove them from the roster.';
// Setup validation that also needs every roster person to have a record in
// this campaign. Like the other cross-reference checks, it reports once the
// values are structurally complete.
export function setupSchemaForCharacters(
  characters: readonly { characterId: string }[],
) {
  const known = new Set(characters.map((character) => character.characterId));
  return militiaSetupSchema.superRefine((setup, ctx) =>
    setup.state.militiaSnapshot.roster.people.forEach((person, index) => {
      if (!known.has(person.characterId))
        ctx.addIssue({
          code: 'custom',
          // The whole entry, so the error links to that person's row.
          path: ['state', 'militiaSnapshot', 'roster', 'people', index],
          message: MISSING_CHARACTER_MESSAGE,
        });
    }),
  );
}
