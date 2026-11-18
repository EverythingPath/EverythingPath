import { expect, test } from 'vitest';
import { newMilitiaSetup, type MilitiaSetup } from './canonical-setup';
import {
  setupErrorDescriptors,
  setupWarningDescriptors,
} from './setup-validation';
import {
  SETUP_STEP_KEYS,
  setupStepPreview,
  setupSteps,
  setupSummaryMessage,
  type SetupStepKey,
} from './setup-steps';

const steps = (
  values: MilitiaSetup,
  { visited = ['startingPoint'], attempted = false } = {} as {
    visited?: SetupStepKey[];
    attempted?: boolean;
  },
) =>
  setupSteps({
    values,
    errors: setupErrorDescriptors(values),
    warnings: setupWarningDescriptors(values),
    visited: new Set(visited),
    attempted,
  });
const summary = (values: MilitiaSetup, options?: Parameters<typeof steps>[1]) =>
  steps(values, options).map(({ key, state, caption }) => [
    key,
    state,
    caption,
  ]);

test('[setup.steps.order] the nine steps keep their order, labels and numbers', () => {
  expect(SETUP_STEP_KEYS).toEqual([
    'startingPoint',
    'week',
    'people',
    'teams',
    'settlements',
    'characterConditions',
    'assets',
    'carriedEffects',
    'review',
  ]);
  expect(
    steps(newMilitiaSetup('Loyalty')).map(
      ({ number, label }) => `${number}. ${label}`,
    ),
  ).toEqual([
    '1. Starting point',
    '2. Week',
    '3. People & officers',
    '4. Teams',
    '5. Settlements',
    '6. Character conditions',
    '7. Assets',
    '8. Carried effects',
    '9. Review & start',
  ]);
});

test('[setup.steps.optional] a new militia marks its empty optional steps skipped; an existing one does not', () => {
  const setup = newMilitiaSetup('Loyalty');
  expect(summary(setup)).toEqual([
    ['startingPoint', 'done', 'Done'],
    ['week', 'none', ''],
    ['people', 'none', ''],
    ['teams', 'none', ''],
    ['settlements', 'none', ''],
    ['characterConditions', 'skipped', 'Optional · skipped'],
    ['assets', 'skipped', 'Optional · skipped'],
    ['carriedEffects', 'skipped', 'Optional · skipped'],
    ['review', 'ready', 'Ready to start'],
  ]);
  expect(
    steps(setup)
      .filter((step) => step.optional)
      .map((step) => step.key),
  ).toEqual(['characterConditions', 'assets', 'carriedEffects']);
  // Entered values end the skip without being cleared.
  setup.state.militiaSnapshot.bonuses = [
    {
      bonusId: 'bonus',
      source: 'Prior mission',
      check: 'loyalty',
      value: 1,
      availableWeek: 1,
      consumedWeek: null,
    },
  ];
  setup.state.militiaSnapshot.economy!.items = [
    {
      itemId: 'sword',
      name: 'Sword',
      valueCopper: 10,
      weight: 1,
      location: 'held',
    },
  ];
  expect(
    summary(setup, { visited: ['startingPoint', 'assets'] }).slice(5, 8),
  ).toEqual([
    ['characterConditions', 'skipped', 'Optional · skipped'],
    ['assets', 'done', 'Done'],
    ['carriedEffects', 'none', ''],
  ]);
  setup.mode = 'existing';
  expect(steps(setup).some((step) => step.optional)).toBe(false);
  expect(summary(setup)[5]).toEqual(['characterConditions', 'none', '']);
});

test('[setup.steps.priority] errors outrank warnings, and errors show once a step is opened or a start was attempted', () => {
  const setup = newMilitiaSetup('Loyalty');
  setup.state.militiaSnapshot.notoriety = 101;
  // Warnings show without a visit.
  expect(summary(setup)[0]).toEqual(['startingPoint', 'warning', '1 warning']);
  setup.state.militiaSnapshot.training = -1;
  expect(summary(setup)[0]).toEqual(['startingPoint', 'warning', '3 warnings']);
  // Malformed input is an error; while it stands, warnings cannot be derived.
  const broken = structuredClone(setup);
  (broken.state.militiaSnapshot as { rank: unknown }).rank = 'oops';
  (broken.state.context as { startDay: unknown }).startDay = '';
  expect(summary(broken)).toEqual(
    expect.arrayContaining([
      ['startingPoint', 'error', '1 to fix'],
      // Week was never opened, so its error waits for a visit or a start.
      ['week', 'none', ''],
      ['review', 'error', '2 to fix'],
    ]),
  );
  expect(summary(broken, { attempted: true })[1]).toEqual([
    'week',
    'error',
    '1 to fix',
  ]);
  expect(summary(broken, { visited: ['week'] })[1]).toEqual([
    'week',
    'error',
    '1 to fix',
  ]);
  // An optional step with an error is not reported as skipped.
  const orphan = newMilitiaSetup('Loyalty');
  orphan.state.context.carriedEvents = [
    {
      eventId: 'event',
      eventType: 'sickness',
      startedWeek: 1,
      order: 0,
      targets: [{ kind: 'team', teamId: 'gone' }],
    },
  ];
  const carried = steps(orphan, { attempted: true })[7]!;
  expect([carried.state, carried.caption]).toEqual(['error', '1 to fix']);
  expect(carried.errors[0]).toMatchObject({
    section: 'carriedEffects',
    field: 'state.context.carriedEvents.0',
  });
});

test('[setup.steps.routing] each step carries its own warnings and errors; unlocatable errors stay with Review', () => {
  const setup = newMilitiaSetup('Loyalty');
  setup.mode = 'existing';
  setup.phase = 'persistent';
  setup.state.militiaSnapshot.treasuryCopper = 0;
  const [starting, week] = steps(setup);
  expect(starting!.warnings.map((warning) => warning.field)).toEqual([
    'state.militiaSnapshot.treasuryCopper',
  ]);
  expect(week!.warnings).toEqual([
    {
      section: 'week',
      field: 'phase',
      message:
        'There are no carried persistent events. The week will open in Upkeep.',
    },
  ]);
  const long = newMilitiaSetup('Loyalty');
  long.notes = 'x'.repeat(2001);
  const review = steps(long, { attempted: true })[8]!;
  expect(review.errors).toEqual([
    expect.objectContaining({ section: 'review', field: 'notes' }),
  ]);
  expect([review.state, review.caption]).toEqual(['error', '1 to fix']);
  // An error without a step is still counted at Review.
  const rootless = setupSteps({
    values: newMilitiaSetup('Loyalty'),
    errors: [{ message: 'Something is wrong.', kind: 'refinement' }],
    warnings: [],
    visited: new Set(),
    attempted: true,
  });
  expect(rootless[8]!.caption).toBe('1 to fix');
  expect(rootless.slice(0, 8).every((step) => step.errors.length === 0)).toBe(
    true,
  );
});

test('[setup.steps.preview] previews summarize entered values, including raw invalid input', () => {
  const setup = newMilitiaSetup('Security');
  const hero = { characterId: 'hero', name: 'Hero' };
  expect(
    SETUP_STEP_KEYS.map((key) => setupStepPreview(key, setup, [hero])),
  ).toEqual([
    'Security · rank 1 · training 0 · 1000 copper',
    'Week 1 · day 0 · opens in Upkeep',
    'No people',
    'No teams',
    'No settlements',
    null,
    null,
    null,
    null,
  ]);
  setup.mode = 'existing';
  (setup.state.militiaSnapshot as { rank: unknown }).rank = 'oops';
  (setup.state.militiaSnapshot as { training: unknown }).training = null;
  setup.state.militiaSnapshot.treasuryCopper = 1234;
  setup.state.week = 12;
  setup.phase = 'event';
  setup.state.militiaSnapshot.roster.people = [
    { characterId: 'hero', kind: 'pc', hitDice: 3 },
  ];
  setup.state.militiaSnapshot.roster.officers = [
    { role: 'commandant', characterId: 'hero' },
  ];
  setup.state.militiaSnapshot.settlements = [
    {
      settlementId: 'home',
      name: 'Home',
      reputation: 'Friendly',
      secured: false,
      occupied: false,
      temporaryReputationShift: 0,
      refugeActivatedWeek: null,
      refugeActiveUntilWeek: null,
    },
  ];
  setup.state.militiaSnapshot.economy!.items = [
    { itemId: 'a', name: 'A', valueCopper: 1, weight: 0, location: 'held' },
    { itemId: 'b', name: 'B', valueCopper: 1, weight: 0, location: 'held' },
  ];
  setup.state.context.carriedEvents = [
    {
      eventId: 'e',
      eventType: 'rivalry',
      startedWeek: 1,
      order: 0,
      targets: [],
    },
  ];
  expect(
    SETUP_STEP_KEYS.map((key) => setupStepPreview(key, setup, [hero])),
  ).toEqual([
    'Security · rank oops · training — · 1234 copper',
    'Week 12 · day 0 · opens in Event',
    'Hero · 1 officer',
    'No teams',
    'Home',
    'None',
    '2 items',
    '1 persistent event',
    null,
  ]);
});

test('[setup.steps.summary-message] summary lines name the field and tell empty from malformed input', () => {
  const setup = newMilitiaSetup('Loyalty');
  (setup.state.militiaSnapshot as { rank: unknown }).rank = '';
  (setup.state.context as { startDay: unknown }).startDay = 'soon';
  setup.state.militiaSnapshot.roster.teams = [
    {
      teamId: 'scouts',
      name: '',
      teamType: 'defenders',
      status: 'active',
      rewardCapExempt: false,
      managerCharacterId: null,
      notes: '',
    },
  ];
  setup.state.militiaSnapshot.eventBenefits!.markets = [
    {
      benefitId: 'market',
      sourceEventIds: ['source'],
      settlementIds: [],
      discountPercent: 5,
      startsWeek: 1,
      endsWeek: -1,
    },
  ];
  expect(
    setupErrorDescriptors(setup).map((error) =>
      setupSummaryMessage(error, setup),
    ),
  ).toEqual([
    'Rank is required.',
    'Team 1: name is required.',
    'Enter a valid value for Market Day benefit 1: ends week.',
    'Enter a valid value for Week start day.',
  ]);
  const reference = {
    section: 'carriedEffects' as const,
    field: 'state.context.carriedEvents.0',
    message: 'A carried event refers to an entity missing from this setup.',
    kind: 'refinement' as const,
  };
  expect(setupSummaryMessage(reference, setup)).toBe(reference.message);
});
