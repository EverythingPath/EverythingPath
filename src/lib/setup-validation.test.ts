import { expect, test } from 'vitest';
import {
  militiaSetupSchema,
  newMilitiaSetup,
  prepareMilitiaSetup,
  type MilitiaSetup,
} from './canonical-setup';
import {
  militiaCorrectionSchema,
  setupErrorDescriptors,
  setupFieldErrorMessage,
  setupWarningDescriptors,
} from './setup-validation';
import { setupLocationForPath } from './setup-sections';

const team = (teamId: string, managerCharacterId: string | null = null) => ({
  teamId,
  name: teamId,
  teamType: 'defenders' as const,
  status: 'active' as const,
  rewardCapExempt: false,
  managerCharacterId,
  notes: '',
});
const character = (characterId: string, level: number) => ({
  characterId,
  level,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  isActive: true,
});

test('[setup.sections.paths] every field path family routes to its step and subsection', () => {
  const cases: [PropertyKey[], unknown][] = [
    [['mode'], { section: 'startingPoint' }],
    [['state', 'militiaSnapshot', 'focus'], { section: 'startingPoint' }],
    [['state', 'militiaSnapshot', 'rank'], { section: 'startingPoint' }],
    [
      ['state', 'militiaSnapshot', 'treasuryCopper'],
      { section: 'startingPoint' },
    ],
    [['state', 'week'], { section: 'week' }],
    [['phase'], { section: 'week' }],
    [['state', 'context', 'startDay'], { section: 'week' }],
    [['state', 'context', 'lastBuyoffWeek'], { section: 'week' }],
    [
      ['state', 'militiaSnapshot', 'roster', 'people', 0, 'hitDice'],
      { section: 'people' },
    ],
    [
      ['state', 'militiaSnapshot', 'roster', 'officers', 2],
      { section: 'people' },
    ],
    [['state', 'militiaSnapshot', 'characters'], { section: 'people' }],
    [
      ['state', 'militiaSnapshot', 'roster', 'teams', 0, 'managerCharacterId'],
      { section: 'teams' },
    ],
    [
      ['state', 'militiaSnapshot', 'settlements', 1, 'name'],
      { section: 'settlements' },
    ],
    [
      ['state', 'militiaSnapshot', 'characterActions', 'people', 0, 'status'],
      { section: 'characterConditions' },
    ],
    [
      ['state', 'militiaSnapshot', 'economy', 'items', 0, 'weight'],
      { section: 'assets', subsection: 'items' },
    ],
    [
      ['state', 'militiaSnapshot', 'economy', 'caches', 0],
      { section: 'assets', subsection: 'caches' },
    ],
    [
      ['state', 'militiaSnapshot', 'economy', 'orders', 0, 'dueDay'],
      { section: 'assets', subsection: 'orders' },
    ],
    [
      ['state', 'militiaSnapshot', 'economy', 'markets', 0, 'salePercent'],
      { section: 'assets', subsection: 'marketplaces' },
    ],
    [['state', 'militiaSnapshot', 'economy'], { section: 'assets' }],
    [
      ['state', 'context', 'orders', 0],
      { section: 'assets', subsection: 'orders' },
    ],
    [
      ['state', 'context', 'carriedEvents', 1, 'targets'],
      { section: 'carriedEffects', subsection: 'events' },
    ],
    [
      ['state', 'context', 'queuedEffects', 0, 'effect', 'teamId'],
      { section: 'carriedEffects', subsection: 'queuedEffects' },
    ],
    [
      ['state', 'militiaSnapshot', 'bonuses', 0, 'teamId'],
      { section: 'carriedEffects', subsection: 'bonuses' },
    ],
    [
      ['state', 'militiaSnapshot', 'eventBenefits', 'skills', 0, 'value'],
      { section: 'carriedEffects', subsection: 'skillBenefits' },
    ],
    [
      ['state', 'militiaSnapshot', 'eventBenefits', 'markets', 0],
      { section: 'carriedEffects', subsection: 'marketDayBenefits' },
    ],
    [['notes'], { section: 'review' }],
  ];
  for (const [path, location] of cases)
    expect(setupLocationForPath(path), path.join('.')).toEqual(location);
  // Root and cross-section paths have no single step of their own.
  for (const path of [
    [],
    ['state'],
    ['state', 'context'],
    ['state', 'militiaSnapshot'],
    ['unknown'],
  ])
    expect(setupLocationForPath(path), path.join('.')).toBeUndefined();
});

test('[setup.sections.warnings] warning descriptors keep the exact warning strings and add their step and field', () => {
  const setup = newMilitiaSetup('Loyalty');
  const snapshot = setup.state.militiaSnapshot;
  setup.phase = 'persistent';
  snapshot.rank = 5;
  snapshot.training = -1;
  snapshot.treasuryCopper = 0;
  snapshot.notoriety = 101;
  snapshot.characters = [character('hero', 2)];
  snapshot.roster = {
    people: [{ characterId: 'hero', kind: 'pc', hitDice: null }],
    officers: [
      { role: 'strategist', characterId: 'hero' },
      { role: 'marshal', characterId: 'hero' },
    ],
    teams: [
      team('a', 'hero'),
      team('b', 'hero'),
      team('c'),
      team('d'),
      team('e'),
    ],
  };
  const descriptors = setupWarningDescriptors(setup);
  expect(descriptors.map((warning) => warning.message)).toEqual(
    prepareMilitiaSetup(setup, 'review').warnings,
  );
  expect(descriptors).toEqual([
    {
      section: 'teams',
      message: '5 teams count toward the normal limit of 4.',
    },
    {
      section: 'teams',
      field: 'state.militiaSnapshot.roster.teams.1.managerCharacterId',
      message: 'Character 1 manages 2 teams; the normal limit is 1.',
    },
    {
      section: 'people',
      message: 'Character 1 holds more than one officer role.',
    },
    {
      section: 'startingPoint',
      field: 'state.militiaSnapshot.training',
      message: expect.stringContaining('Training is below the rank 5'),
    },
    {
      section: 'startingPoint',
      field: 'state.militiaSnapshot.rank',
      message: 'Rank exceeds the highest active PC level.',
    },
    {
      section: 'startingPoint',
      field: 'state.militiaSnapshot.training',
      message: 'Training is below zero.',
    },
    {
      section: 'startingPoint',
      field: 'state.militiaSnapshot.treasuryCopper',
      message: expect.stringContaining('Treasury is below the normal minimum'),
    },
    {
      section: 'startingPoint',
      field: 'state.militiaSnapshot.notoriety',
      message: 'Notoriety is outside the normal range of 0–100.',
    },
    {
      section: 'week',
      field: 'phase',
      message:
        'There are no carried persistent events. The week will open in Upkeep.',
    },
  ]);
  snapshot.rank = 30;
  expect(setupWarningDescriptors(setup)).toContainEqual({
    section: 'startingPoint',
    field: 'state.militiaSnapshot.rank',
    message: 'Rank is outside the standard advancement table (1–20).',
  });
  // Unfinished values produce no warnings and never throw.
  expect(setupWarningDescriptors({ mode: 'new' })).toEqual([]);
  expect(setupWarningDescriptors(undefined)).toEqual([]);
});

function withEvent(setup: MilitiaSetup, teamId: string) {
  setup.state.context.carriedEvents = [
    {
      eventId: 'older',
      eventType: 'rivalry',
      startedWeek: 0,
      order: 0,
      targets: [],
    },
    {
      eventId: 'sickness',
      eventType: 'sickness',
      startedWeek: 0,
      order: 1,
      targets: [{ kind: 'team', teamId }],
    },
  ];
  return setup;
}

test('[setup.sections.errors] field errors route by path and cross-reference errors reach the entry that needs repair', () => {
  const malformed = newMilitiaSetup('Loyalty') as unknown as {
    state: { militiaSnapshot: { rank: unknown } };
  };
  malformed.state.militiaSnapshot.rank = 'oops';
  expect(setupErrorDescriptors(malformed)).toEqual([
    {
      section: 'startingPoint',
      field: 'state.militiaSnapshot.rank',
      kind: 'field',
      message: expect.any(String),
    },
  ]);

  // The reference error keeps its root path and message, but is located.
  const missingTarget = withEvent(newMilitiaSetup('Loyalty'), 'gone');
  const issue = militiaSetupSchema.safeParse(missingTarget).error?.issues[0];
  expect(issue).toMatchObject({ path: ['state', 'context'] });
  expect(setupErrorDescriptors(missingTarget)).toEqual([
    {
      section: 'carriedEffects',
      subsection: 'events',
      field: 'state.context.carriedEvents.1',
      kind: 'refinement',
      message: issue?.message,
    },
  ]);

  const queued = newMilitiaSetup('Loyalty');
  queued.state.context.queuedEffects = [
    {
      effectId: 'queue',
      sourceId: 'raid',
      startsWeek: 2,
      endsWeek: 2,
      effect: { kind: 'team_unavailable', teamId: 'gone' },
    },
  ];
  expect(setupErrorDescriptors(queued)).toEqual([
    expect.objectContaining({
      section: 'carriedEffects',
      subsection: 'queuedEffects',
      field: 'state.context.queuedEffects.0',
      kind: 'refinement',
    }),
  ]);

  const commandant = newMilitiaSetup('Loyalty');
  commandant.state.militiaSnapshot.characters = [character('hero', 2)];
  commandant.state.militiaSnapshot.roster.people = [
    { characterId: 'hero', kind: 'pc', hitDice: null },
  ];
  commandant.state.militiaSnapshot.roster.officers = [
    { role: 'commandant', characterId: 'hero' },
  ];
  // A commandant's blank Hit Dice follow their level, but the character's
  // own facts stay required.
  expect(setupErrorDescriptors(commandant)).toEqual([]);
  commandant.state.militiaSnapshot.characters = [];
  expect(setupErrorDescriptors(commandant)).toEqual([
    expect.objectContaining({ section: 'people', kind: 'refinement' }),
  ]);

  expect(setupErrorDescriptors(newMilitiaSetup('Loyalty'))).toEqual([]);
});

test('[setup.sections.summary] unlocatable root errors fall back to the summary without crashing', () => {
  // The week draft reports duplicate identities for the whole draft.
  const duplicate = newMilitiaSetup('Loyalty');
  const event = {
    eventId: 'same',
    eventType: 'rivalry' as const,
    startedWeek: 0,
    order: 0,
    targets: [],
  };
  duplicate.state.context.carriedEvents = [event, event];
  expect(setupErrorDescriptors(duplicate)).toEqual([
    { kind: 'refinement', message: 'Duplicate event identity' },
  ]);
  for (const values of [
    undefined,
    'setup',
    { ...newMilitiaSetup('Loyalty'), extra: 1 },
  ]) {
    const errors = setupErrorDescriptors(values);
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) {
      expect(error.section).toBeUndefined();
      expect(error.field).toBeUndefined();
    }
  }
});

test('[setup.sections.correction] the correction validator requires a reason on the Review step', () => {
  const setup = newMilitiaSetup('Loyalty');
  expect(militiaCorrectionSchema.safeParse(setup).success).toBe(false);
  expect(setupErrorDescriptors(setup, militiaCorrectionSchema)).toEqual([
    {
      section: 'review',
      field: 'notes',
      kind: 'refinement',
      message: 'A reason is required for this correction.',
    },
  ]);
  setup.notes = '  ';
  expect(militiaCorrectionSchema.safeParse(setup).success).toBe(false);
  setup.notes = 'Recorded table reward';
  expect(militiaCorrectionSchema.safeParse(setup).success).toBe(true);
});

test('[setup.sections.field-messages] field messages distinguish empty from malformed input', () => {
  const error = 'Invalid input';
  for (const value of [null, undefined, ''])
    expect(setupFieldErrorMessage({ label: 'Rank', value, error })).toBe(
      'Rank is required.',
    );
  expect(
    setupFieldErrorMessage({
      label: 'Rank',
      value: 'oops',
      numeric: true,
      error,
    }),
  ).toBe('Enter a valid whole number for Rank.');
  expect(
    setupFieldErrorMessage({
      label: 'Item weight',
      value: 'x',
      numeric: true,
      decimal: true,
      error,
    }),
  ).toBe('Enter a valid number for Item weight.');
  expect(
    setupFieldErrorMessage({
      label: 'Team name',
      value: ' ',
      error: 'Team name is required',
    }),
  ).toBe('Team name is required');
});
