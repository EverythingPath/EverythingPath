import { createContext, useContext, useId } from 'react';
import { UserPlus } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { OFFICER_ROLES } from '~/lib/canonical-roster';
import { formatCharacterKind } from '~/lib/character-kind';
import {
  MISSING_CHARACTER_MESSAGE,
  setupCharacterFacts,
  type SetupCharacter,
} from '~/lib/setup-characters';
import { TEAM_IDS, TEAM_STATUSES } from '~/lib/militia-domain';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import {
  SetupField as Field,
  SetupEntry,
  SetupSection,
  choices,
  yesNo,
} from './fields';
export type { SetupCharacter };
// The campaign characters that are on this roster.
function useRosterCharacters(characters: SetupCharacter[]) {
  const { watch } = useFormContext<MilitiaSetup>();
  const people = watch('state.militiaSnapshot.roster.people');
  return characters.filter((character) =>
    people.some((person) => person.characterId === character.characterId),
  );
}
// Opens character creation. Guided Setup supplies it; the dialog lives above
// the step layouts so a breakpoint or step change never closes it. Roster
// inclusion stays a separate choice.
export const SetupAddCharacter = createContext<(() => void) | null>(null);
export function SetupPeople({ characters }: { characters: SetupCharacter[] }) {
  const addCharacter = useContext(SetupAddCharacter);
  const { control, watch, setValue } = useFormContext<MilitiaSetup>();
  const people = useFieldArray({
    control,
    name: 'state.militiaSnapshot.roster.people',
  });
  const roster = watch('state.militiaSnapshot.roster');
  const selected = useRosterCharacters(characters);
  return (
    <SetupSection title="Characters and officers">
      {addCharacter ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCharacter}
          >
            <UserPlus aria-hidden />
            Add character
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {characters
          .filter((character) => !selected.includes(character))
          .map((character) => (
            <Button
              type="button"
              key={character.characterId}
              variant="outline"
              className="h-auto min-h-16 border-2 transition-transform hover:-translate-y-1"
              onClick={() => {
                // Joining takes the record's kind; only the record sets it.
                people.append({
                  characterId: character.characterId,
                  kind: character.kind,
                  hitDice: null,
                });
                setValue('state.militiaSnapshot.characters', [
                  ...watch('state.militiaSnapshot.characters'),
                  setupCharacterFacts(character),
                ]);
              }}
            >
              Add {character.name}
            </Button>
          ))}
      </div>
      {people.fields.map((person, index) => (
        <SetupEntry
          key={person.id}
          label={
            characters.find(
              (character) => character.characterId === person.characterId,
            )?.name ?? `Person ${index + 1}`
          }
          onRemove={() => {
            people.remove(index);
            setValue(
              'state.militiaSnapshot.characters',
              watch('state.militiaSnapshot.characters').filter(
                (character) => character.characterId !== person.characterId,
              ),
            );
            setValue(
              'state.militiaSnapshot.roster.officers',
              roster.officers.filter(
                (officer) => officer.characterId !== person.characterId,
              ),
            );
            setValue(
              'state.militiaSnapshot.roster.teams',
              roster.teams.map((team) =>
                team.managerCharacterId === person.characterId
                  ? { ...team, managerCharacterId: null }
                  : team,
              ),
            );
          }}
        >
          <SetupPersonKind
            index={index}
            character={characters.find(
              (character) => character.characterId === person.characterId,
            )}
          />
          <Field
            name={`state.militiaSnapshot.roster.people.${index}.hitDice`}
            label="Hit Dice"
            numeric
          />
          <div className="space-y-2 md:col-span-2">
            <p className="text-sm font-medium">Officer roles</p>
            <div className="flex flex-wrap gap-2">
              {OFFICER_ROLES.map((role) => {
                const assigned = roster.officers.some(
                  (officer) =>
                    officer.characterId === person.characterId &&
                    officer.role === role,
                );
                return (
                  <Button
                    key={role}
                    type="button"
                    variant={assigned ? 'default' : 'outline'}
                    aria-pressed={assigned}
                    onClick={() =>
                      setValue(
                        'state.militiaSnapshot.roster.officers',
                        assigned
                          ? roster.officers.filter(
                              (officer) =>
                                officer.characterId !== person.characterId ||
                                officer.role !== role,
                            )
                          : [
                              ...roster.officers,
                              { role, characterId: person.characterId },
                            ],
                      )
                    }
                  >
                    {role}
                  </Button>
                );
              })}
            </div>
          </div>
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
// The kind a roster person's record owns, shown read-only: it changes only
// in the character dialog. A person whose record is not in this campaign
// shows why they must be removed.
function SetupPersonKind({
  index,
  character,
}: {
  index: number;
  character: SetupCharacter | undefined;
}) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      data-setup-path={`state.militiaSnapshot.roster.people.${index}.characterId`}
      className="min-w-0 space-y-1"
    >
      <p id={`${id}-label`} className="text-sm font-medium">
        Kind
      </p>
      {character ? (
        <p className="border-input text-muted-foreground flex min-h-9 items-center border border-dashed px-3 py-1 text-base md:text-sm">
          {formatCharacterKind(character.kind)}
        </p>
      ) : (
        <p
          role="alert"
          className="text-destructive flex min-h-9 items-center text-sm [overflow-wrap:anywhere]"
        >
          {MISSING_CHARACTER_MESSAGE}
        </p>
      )}
    </div>
  );
}
export function SetupTeams({
  characters,
  rowNotes,
}: {
  characters: SetupCharacter[];
  /** A note under a team's title, by its identity. */
  rowNotes?: ReadonlyMap<string, string>;
}) {
  const { control } = useFormContext<MilitiaSetup>();
  const teams = useFieldArray({
    control,
    name: 'state.militiaSnapshot.roster.teams',
  });
  const selected = useRosterCharacters(characters);
  return (
    <SetupSection
      title="Teams"
      add="Add team"
      onAdd={() =>
        teams.append({
          teamId: crypto.randomUUID(),
          name: '',
          teamType: 'defenders',
          status: 'active',
          rewardCapExempt: false,
          managerCharacterId: null,
          notes: '',
        })
      }
    >
      {teams.fields.map((team, index) => (
        <SetupEntry
          key={team.id}
          label={`Team ${index + 1}`}
          note={rowNotes?.get(team.teamId)}
          onRemove={() => teams.remove(index)}
        >
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.name`}
            label="Team name"
          />
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.teamType`}
            label="Team type"
            options={choices(TEAM_IDS)}
          />
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.status`}
            label="Team condition"
            options={choices(TEAM_STATUSES)}
          />
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.rewardCapExempt`}
            label="Reward team exempt from limit"
            options={yesNo}
          />
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.managerCharacterId`}
            label="Manager"
            options={[
              { value: null, label: 'Unassigned' },
              ...selected.map((character) => ({
                value: character.characterId,
                label: character.name,
              })),
            ]}
          />
          <Field
            name={`state.militiaSnapshot.roster.teams.${index}.notes`}
            label="Team notes"
          />
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
