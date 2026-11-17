import type { FieldPath } from 'react-hook-form';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import type {
  MilitiaEntryKey,
  MilitiaSectionKey,
} from '~/lib/militia-correction-sections';

// The controls of each correction by form path, for the linked error
// summary: the nine sections.

type Snapshot = CanonicalWeekState['militiaSnapshot'];
/** A Militia page entry with a correction: all but the read-only week. */
export type CorrectableEntry = Exclude<MilitiaEntryKey, 'weekCarried'>;
export type FieldLabel = {
  label: string;
  numeric?: boolean;
  decimal?: boolean;
};
export type FieldLabels = Record<string, FieldLabel>;

const snapshotPath = 'state.militiaSnapshot';

function rowFields(
  path: string,
  count: number,
  row: (position: number) => string,
  fields: FieldLabels,
): FieldLabels {
  const labels: FieldLabels = {};
  for (let index = 0; index < count; index++)
    for (const [field, { label, ...format }] of Object.entries(fields))
      labels[`${path}.${index}.${field}`] = {
        label: `${row(index + 1)} ${label}`,
        ...format,
      };
  return labels;
}

const economyPath = `${snapshotPath}.economy`;
const economyRows = (
  snapshot: Snapshot,
  list: 'items' | 'caches' | 'orders' | 'markets',
) => snapshot.economy?.[list].length ?? 0;

const snapshotRows = (
  path: string,
  count: number,
  row: string,
  fields: FieldLabels,
) =>
  rowFields(`${snapshotPath}.${path}`, count, (at) => `${row} ${at}`, fields);

const sectionFields: Record<
  CorrectableEntry,
  (snapshot: Snapshot) => FieldLabels
> = {
  values: () => ({
    [`${snapshotPath}.focus`]: { label: 'Focus' },
    [`${snapshotPath}.rank`]: { label: 'Rank', numeric: true },
    [`${snapshotPath}.training`]: { label: 'Training', numeric: true },
    [`${snapshotPath}.treasuryCopper`]: {
      label: 'Treasury (copper)',
      numeric: true,
    },
    [`${snapshotPath}.notoriety`]: { label: 'Notoriety', numeric: true },
  }),
  teams: (snapshot) =>
    rowFields(
      `${snapshotPath}.roster.teams`,
      snapshot.roster.teams.length,
      (position) => `Team ${position}`,
      {
        name: { label: 'name' },
        teamType: { label: 'type' },
        status: { label: 'condition' },
        rewardCapExempt: { label: 'reward limit exemption' },
        managerCharacterId: { label: 'manager' },
        notes: { label: 'notes' },
      },
    ),
  settlements: (snapshot) =>
    rowFields(
      `${snapshotPath}.settlements`,
      snapshot.settlements.length,
      (position) => `Settlement ${position}`,
      {
        name: { label: 'name' },
        reputation: { label: 'reputation' },
        secured: { label: 'secured' },
        occupied: { label: 'occupied' },
        temporaryReputationShift: {
          label: 'temporary reputation shift',
          numeric: true,
        },
        reduceDangerReputationShift: {
          label: 'Reduce Danger reputation shift',
          numeric: true,
        },
        reduceDangerUntilWeek: {
          label: 'Reduce Danger end week',
          numeric: true,
        },
        refugeActivatedWeek: {
          label: 'refuge activated week',
          numeric: true,
        },
        refugeActiveUntilWeek: { label: 'refuge end week', numeric: true },
      },
    ),
  items: (snapshot) =>
    rowFields(
      `${economyPath}.items`,
      economyRows(snapshot, 'items'),
      (position) => `Item ${position}`,
      {
        name: { label: 'name' },
        valueCopper: { label: 'value (copper)', numeric: true },
        ownerCharacterId: { label: 'owner' },
        identified: { label: 'identified' },
        weight: { label: 'weight', numeric: true, decimal: true },
        location: { label: 'location' },
      },
    ),
  caches: (snapshot) =>
    rowFields(
      `${economyPath}.caches`,
      economyRows(snapshot, 'caches'),
      (position) => `Cache ${position}`,
      {
        location: { label: 'location' },
        cacheClass: { label: 'class' },
        status: { label: 'status' },
        secure: { label: 'secure location' },
        extradimensional: { label: 'extradimensional' },
        returnActivityWeek: { label: 'return Activity week', numeric: true },
      },
    ),
  orders: (snapshot) =>
    rowFields(
      `${economyPath}.orders`,
      economyRows(snapshot, 'orders'),
      (position) => `Order ${position}`,
      {
        itemId: { label: 'item' },
        settlementId: { label: 'delivery settlement' },
        source: { label: 'source' },
        mode: { label: 'kind' },
        orderedWeek: { label: 'ordered week', numeric: true },
        orderedDay: { label: 'ordered day', numeric: true },
        dueDay: { label: 'due day', numeric: true, decimal: true },
        dueActivityWeek: { label: 'due Activity week', numeric: true },
        priceCopper: { label: 'price paid (copper)', numeric: true },
        deliveryDays: {
          label: 'delivery duration (days)',
          numeric: true,
          decimal: true,
        },
        enchantmentValueCopper: {
          label: 'enchantment value (copper)',
          numeric: true,
        },
        'receipt.receivedDay': { label: 'received day', numeric: true },
      },
    ),
  marketplaces: (snapshot) =>
    rowFields(
      `${economyPath}.markets`,
      economyRows(snapshot, 'markets'),
      (position) => `Marketplace ${position}`,
      {
        source: { label: 'source' },
        settlementId: { label: 'settlement' },
        availableWeek: { label: 'available week', numeric: true },
        expiresWeek: { label: 'expires week', numeric: true },
        availability: { label: 'availability' },
        availabilityPercent: { label: 'availability percent', numeric: true },
        salePercent: { label: 'sale percent', numeric: true },
        contraband: { label: 'contraband allowed' },
      },
    ),
  characterConditions: (snapshot) =>
    snapshotRows(
      'characterActions.people',
      snapshot.characterActions?.people.length ?? 0,
      'Character condition',
      {
        characterId: { label: 'character' },
        status: { label: 'condition' },
        location: { label: 'location' },
        'location.settlementId': { label: 'refuge settlement' },
        'location.location': { label: 'location description' },
        directRescueRequired: { label: 'PCs must perform rescue' },
        'capture.source': { label: 'capture source' },
        'capture.week': { label: 'captured week', numeric: true },
        rescuedWeek: { label: 'rescued week', numeric: true },
        restoredWeek: { label: 'restored week', numeric: true },
      },
    ),
  carriedBenefits: (snapshot) => ({
    ...snapshotRows(
      'eventBenefits.skills',
      snapshot.eventBenefits?.skills.length ?? 0,
      'Skill benefit',
      {
        characterIds: { label: 'benefiting characters' },
        skills: { label: 'affected skills' },
        bonusType: { label: 'bonus type' },
        value: { label: 'skill bonus', numeric: true },
        settlementId: { label: 'benefit settlement' },
        afterDark: { label: 'only after dark' },
        startsWeek: { label: 'starts week', numeric: true },
        endsWeek: { label: 'ends week', numeric: true },
      },
    ),
    ...snapshotRows(
      'eventBenefits.markets',
      snapshot.eventBenefits?.markets.length ?? 0,
      'Market Day benefit',
      {
        settlementIds: { label: 'discount settlements' },
        startsWeek: { label: 'starts week', numeric: true },
        endsWeek: { label: 'ends week', numeric: true },
      },
    ),
  }),
};

/** The correction's controls in the form, labelled for the error summary. */
export function sectionFieldLabels(
  entry: CorrectableEntry,
  snapshot: Snapshot,
): FieldLabels {
  return sectionFields[entry](snapshot);
}

/** The form path of a list section's rows. */
export const sectionRowsPath: Partial<
  Record<MilitiaSectionKey, FieldPath<MilitiaSetup>>
> = {
  teams: `${snapshotPath}.roster.teams`,
  settlements: `${snapshotPath}.settlements`,
  items: `${economyPath}.items`,
  caches: `${economyPath}.caches`,
};
