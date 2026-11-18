import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import type { SetupCharacter } from './roster';
import {
  SetupField as Field,
  SetupEntry,
  SetupSection,
  SetupSelection,
  choices,
  useSettlementOptions,
  yesNo,
} from './fields';

export function SetupCharacterConditions({
  characters,
}: {
  characters: SetupCharacter[];
}) {
  const { control, watch, setValue } = useFormContext<MilitiaSetup>();
  const people = useFieldArray({
    control,
    name: 'state.militiaSnapshot.characterActions.people',
  });
  const values = watch();
  const snapshot = values.state.militiaSnapshot;
  const characterOptions = characters
    .filter((character) =>
      snapshot.characters.some((x) => x.characterId === character.characterId),
    )
    .map((character) => ({
      value: character.characterId,
      label: character.name,
    }));
  return (
    <SetupSection
      title="Character conditions"
      add="Add character condition"
      onAdd={() =>
        people.append({
          characterId: '',
          status: 'available',
          location: { kind: 'headquarters' },
          directRescueRequired: false,
          capture: null,
        })
      }
    >
      {people.fields.map((row, i) => {
        const person = snapshot.characterActions?.people[i];
        return (
          <SetupEntry
            key={row.id}
            label={`Character condition ${i + 1}`}
            onRemove={() => people.remove(i)}
          >
            <Field
              name={`state.militiaSnapshot.characterActions.people.${i}.characterId`}
              label="Character"
              options={characterOptions}
            />
            <Field
              name={`state.militiaSnapshot.characterActions.people.${i}.status`}
              label="Condition"
              options={choices([
                'available',
                'hidden',
                'captured',
                'recovering',
                'dead',
              ])}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">Location</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { kind: 'headquarters' },
                    { kind: 'refuge', settlementId: '' },
                    { kind: 'elsewhere', location: '' },
                  ] as const
                ).map((location) => (
                  <Button
                    key={location.kind}
                    type="button"
                    variant={
                      person?.location.kind === location.kind
                        ? 'default'
                        : 'outline'
                    }
                    aria-pressed={person?.location.kind === location.kind}
                    onClick={() => {
                      if (person?.location.kind !== location.kind)
                        setValue(
                          `state.militiaSnapshot.characterActions.people.${i}.location`,
                          location,
                        );
                    }}
                  >
                    {location.kind}
                  </Button>
                ))}
              </div>
            </div>
            {person?.location.kind === 'refuge' && (
              <Field
                name={`state.militiaSnapshot.characterActions.people.${i}.location.settlementId`}
                label="Refuge settlement"
                options={snapshot.settlements.map((town) => ({
                  value: town.settlementId,
                  label: town.name,
                }))}
              />
            )}
            {person?.location.kind === 'elsewhere' && (
              <Field
                name={`state.militiaSnapshot.characterActions.people.${i}.location.location`}
                label="Location description"
              />
            )}
            <Field
              name={`state.militiaSnapshot.characterActions.people.${i}.directRescueRequired`}
              label="PCs must perform rescue"
              options={yesNo}
            />
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setValue(
                    `state.militiaSnapshot.characterActions.people.${i}.capture`,
                    person?.capture
                      ? null
                      : { source: 'ordinary', week: values.state.week },
                  )
                }
              >
                {person?.capture ? 'Remove capture record' : 'Record capture'}
              </Button>
              {person?.capture && (
                <>
                  <Field
                    name={`state.militiaSnapshot.characterActions.people.${i}.capture.source`}
                    label="Capture source"
                    options={choices(['ordinary', 'raid'])}
                  />
                  <Field
                    name={`state.militiaSnapshot.characterActions.people.${i}.capture.week`}
                    label="Captured week"
                    numeric
                  />
                </>
              )}
            </div>
            <Field
              name={`state.militiaSnapshot.characterActions.people.${i}.rescuedWeek`}
              label="Rescued week (optional)"
              numeric
              omitEmpty
            />
            <Field
              name={`state.militiaSnapshot.characterActions.people.${i}.restoredWeek`}
              label="Restored week (optional)"
              numeric
              omitEmpty
            />
          </SetupEntry>
        );
      })}
    </SetupSection>
  );
}
export function SetupSkillBenefits({
  characters,
}: {
  characters: SetupCharacter[];
}) {
  const { control, watch } = useFormContext<MilitiaSetup>();
  const skills = useFieldArray({
    control,
    name: 'state.militiaSnapshot.eventBenefits.skills',
  });
  const values = watch();
  const snapshot = values.state.militiaSnapshot;
  const towns = useSettlementOptions();
  const people = characters
    .filter((character) =>
      snapshot.characters.some((x) => x.characterId === character.characterId),
    )
    .map((character) => ({
      value: character.characterId,
      label: character.name,
    }));
  return (
    <SetupSection
      title="Carried skill benefits"
      add="Add skill benefit"
      onAdd={() =>
        skills.append({
          benefitId: crypto.randomUUID(),
          sourceEventIds: [crypto.randomUUID()],
          characterIds: [],
          skills: [],
          bonusType: 'untyped',
          value: 0,
          settlementId: null,
          afterDark: false,
          startsWeek: values.state.week,
          endsWeek: values.state.week,
        })
      }
    >
      {skills.fields.map((row, i) => (
        <SetupEntry
          key={row.id}
          label={`Skill benefit ${i + 1}`}
          onRemove={() => skills.remove(i)}
        >
          <SetupSelection
            name={`state.militiaSnapshot.eventBenefits.skills.${i}.characterIds`}
            label="Benefiting characters"
            options={people}
          />
          <SetupSelection
            name={`state.militiaSnapshot.eventBenefits.skills.${i}.skills`}
            label="Affected skills"
            options={choices([
              'knowledge_local',
              'bluff',
              'diplomacy',
              'intimidate',
              'stealth',
            ])}
          />
          <Field
            name={`state.militiaSnapshot.eventBenefits.skills.${i}.bonusType`}
            label="Bonus type"
            options={choices(['untyped', 'morale', 'circumstance'])}
          />
          <Field
            name={`state.militiaSnapshot.eventBenefits.skills.${i}.value`}
            label="Skill bonus"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.eventBenefits.skills.${i}.settlementId`}
            label="Benefit settlement"
            options={[{ value: null, label: 'All settlements' }, ...towns]}
          />
          <Field
            name={`state.militiaSnapshot.eventBenefits.skills.${i}.afterDark`}
            label="Only after dark"
            options={yesNo}
          />
          <Field
            name={`state.militiaSnapshot.eventBenefits.skills.${i}.startsWeek`}
            label="Skill benefit starts week"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.eventBenefits.skills.${i}.endsWeek`}
            label="Skill benefit ends week"
            numeric
          />
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
export function SetupMarketDayBenefits() {
  const { control, watch } = useFormContext<MilitiaSetup>();
  const markets = useFieldArray({
    control,
    name: 'state.militiaSnapshot.eventBenefits.markets',
  });
  const week = watch('state.week');
  const towns = useSettlementOptions();
  return (
    <SetupSection
      title="Carried Market Day benefits"
      add="Add Market Day benefit"
      onAdd={() =>
        markets.append({
          benefitId: crypto.randomUUID(),
          sourceEventIds: [crypto.randomUUID()],
          settlementIds: [],
          discountPercent: 5,
          startsWeek: week,
          endsWeek: week,
        })
      }
    >
      {markets.fields.map((row, i) => (
        <SetupEntry
          key={row.id}
          label={`Market Day benefit ${i + 1}`}
          onRemove={() => markets.remove(i)}
        >
          <SetupSelection
            name={`state.militiaSnapshot.eventBenefits.markets.${i}.settlementIds`}
            label="Discount settlements"
            options={towns}
          />
          <Field
            name={`state.militiaSnapshot.eventBenefits.markets.${i}.startsWeek`}
            label="Market Day starts week"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.eventBenefits.markets.${i}.endsWeek`}
            label="Market Day ends week"
            numeric
          />
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
