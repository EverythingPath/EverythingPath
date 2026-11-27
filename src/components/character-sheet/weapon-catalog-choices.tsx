'use client';
import { useId, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Input } from '~/components/ui/input';
import { describeWeapon } from './attack-routine-view-model';
import { fieldLabel, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';
import { WeaponChoiceCard } from './weapon-choice-card';

type Controller = ReturnType<typeof useCharacterSheet>;
type Attacks = Controller['attacks'];
type Kind = 'weapon' | 'ammunition';
type Choice =
  | Attacks['weaponCatalog'][number]
  | Attacks['ammunitionCatalog'][number];

// Past this many cards they get a filter, so a full catalog stays usable
// on a phone.
const filterThreshold = 12;

const copy = {
  weapon: {
    heading: 'Add weapon',
    filter: 'Find a weapon',
    empty: 'No weapons to add.',
    noMatch: 'No weapon matches.',
  },
  ammunition: {
    heading: 'Add ammunition',
    filter: 'Find ammunition',
    empty: 'No ammunition to add.',
    noMatch: 'No ammunition matches.',
  },
} as const;

/**
 * The weapons, or the ammunition, the Character can add under Gear, as
 * cards. Picking a weapon adds it with its default attack routine; picking
 * ammunition adds only the Gear for a ranged routine to fire. The card's
 * save is acknowledged beneath the cards, which stay open for another pick.
 */
export function WeaponCatalogChoices({
  id,
  attacks,
  kind = 'weapon',
}: {
  id?: string;
  attacks: Attacks;
  kind?: Kind;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const headingId = useId();
  const filterId = useId();
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const text = copy[kind];
  const choices: Choice[] =
    kind === 'weapon' ? attacks.weaponCatalog : attacks.ammunitionCatalog;
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? choices.filter((choice) => choice.label.toLowerCase().includes(needle))
    : choices;
  const picked = choices.find((choice) => choice.catalogEntryId === pickedId);
  const statusKey = (catalogEntryId: string) => `${kind}:${catalogEntryId}`;
  const status = pickedId
    ? attacks.statusFor(statusKey(pickedId))
    : ({ kind: 'idle' } as const);
  const add = kind === 'weapon' ? attacks.addWeapon : attacks.addAmmunition;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="border-foreground/20 mt-2 space-y-2 border p-2"
    >
      <h3 id={headingId} className={fieldLabel}>
        {text.heading}
      </h3>
      {choices.length > filterThreshold ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={filterId} className={fieldLabel}>
            {text.filter}
          </label>
          <Input
            id={filterId}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 md:h-9"
          />
        </div>
      ) : null}
      {choices.length === 0 ? (
        <p className="text-muted-foreground text-sm">{text.empty}</p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">{text.noMatch}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((choice) => (
            <li key={choice.catalogEntryId} className="min-w-0">
              <WeaponChoiceCard
                label={choice.label}
                facts={
                  'weapon' in choice
                    ? describeWeapon(choice.weapon)
                    : 'Ammunition'
                }
                isDisabled={
                  maintenance.readOnly ||
                  attacks.statusFor(statusKey(choice.catalogEntryId)).kind ===
                    'saving'
                }
                describedBy={reasonId}
                onPick={() => {
                  setPickedId(choice.catalogEntryId);
                  void add(choice.catalogEntryId);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <SaveFeedback
        status={status}
        savedText={picked ? `${picked.label} added under Gear.` : 'Added.'}
        savingText={picked ? `Adding ${picked.label}…` : 'Adding…'}
        shouldHideWhenIdle
      />
    </section>
  );
}
