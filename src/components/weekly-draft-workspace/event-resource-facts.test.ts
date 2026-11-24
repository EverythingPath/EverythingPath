import { renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { activityFixture } from '../../../tests/rules/activity-fixture';
import { occurrence, pair } from '../../../tests/rules/event-selection-fixture';
import { resourceEventFixture } from '../../../tests/rules/resource-event-fixture';
import { threatEventFixture } from '../../../tests/rules/threat-event-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { eventView } from './event-facts';
import { resourcePanelMessage } from './event-resource-facts';
import { rewardFormSchema, rewardFormValues } from './event-reward-values';
import { derivePhaseReadiness } from './phase-readiness';
import type { EventPanel, EventView } from './types';
import { useEventEdits } from './use-event-edits';

type Resource = Extract<EventPanel, { family: 'resource' }>;

function facts(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'c', militiaId: 'm', draftId: draft.draftId },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [
      { characterId: 'pc', name: 'Wren Ashby' },
      { characterId: 'second', name: 'Nora Vell' },
    ],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  const view = eventView(draft, source, preview, {
    acceptedEventIds: null,
    preparationFailed: false,
  });
  const { phases } = derivePhaseReadiness(draft, source, preview);
  const phase = phases.find((entry) => entry.phase === 'event')!;
  return { view, phase };
}
function panel(view: EventView, eventId: string) {
  const found = view.occurrences.find(
    (entry) => entry.occurrence.eventId === eventId,
  )?.panel;
  expect(found?.family).toBe('resource');
  return found as Resource;
}
const messages = (phase: ReturnType<typeof facts>['phase']) =>
  phase.requirements.map((entry) => entry.message);
function lastOccurrence(edit: ReturnType<typeof vi.fn>) {
  return edit.mock.lastCall![0].occurrence;
}
// A second, identified item and a second active PC.
function withSecondPc(snapshot: UpkeepSnapshot) {
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'second',
  });
  snapshot.roster.people.push({
    ...snapshot.roster.people[0]!,
    characterId: 'second',
  });
}

test('[EVT-07.broke-the-code] Broke the Code identifies one item from the snapshot and keeps a missing one visible', () => {
  const { draft, snapshot } = resourceEventFixture(18);
  snapshot.economy!.items.push({
    itemId: 'known',
    name: 'Known ring',
    valueCopper: 200000,
    weight: 0,
    location: 'held',
    identified: true,
    ownerCharacterId: 'pc',
  });
  let { view } = facts(draft, snapshot);
  let code = panel(view, 'event');
  expect(code.eventType).toBe('broke_the_code');
  // Unidentified items first.
  expect(code.item).toMatchObject({
    label: 'Item the PCs identify',
    selected: 'mystery',
    required: false,
    retained: [],
  });
  expect(code.item!.choices.map((card) => card.description)).toEqual([
    'Unidentified · held · 1,000 gp',
    'Already identified · held by Wren Ashby · 2,000 gp',
  ]);
  expect(code.whatHappened?.required).toBe(true);
  expect(code.outcomes).toEqual([
    'This week (week 40): PCs gain +2 on Knowledge (local).',
    'Unknown relic is identified.',
  ]);

  // A recorded item no longer in the campaign stays, named as missing.
  draft.event.occurrences[0]!.targets = [{ kind: 'item', itemId: 'gone' }];
  const missing = facts(draft, snapshot);
  code = panel(missing.view, 'event');
  expect(code.item).toMatchObject({ selected: null, required: true });
  expect(code.item!.retained).toEqual([
    {
      value: 'gone',
      label: 'An item no longer recorded',
      reason:
        'This item is no longer recorded. Restore it in Militia corrections, clear it or choose another.',
    },
  ]);
  expect(code.partial).toBe(true);
  expect(messages(missing.phase)).toContain(
    'Event 1 · Broke the Code: choose the item the PCs identify.',
  );

  // Twice raises the bonus under the first and asks for no item of its own.
  ({ view } = facts(
    ...(Object.values(resourceEventFixture(18, true)) as [
      WeeklyDraft,
      UpkeepSnapshot,
    ]),
  ));
  const first = panel(view, 'first');
  const twice = panel(view, 'second');
  expect(first.outcomes).toEqual([
    'Unknown relic is identified.',
    'This week (week 40): PCs gain +5 on Knowledge (local).',
  ]);
  expect(first.notes).toEqual([
    'Twice in Event 1.2 · Broke the Code: the Knowledge (local) bonus increases, listed here.',
  ]);
  expect(twice.item).toBeNull();
  expect(twice.notes).toEqual([
    'Twice with Event 1.1 · Broke the Code: the Knowledge (local) bonus increases, listed there.',
  ]);
  expect(twice.whatHappened?.required).toBe(true);
  // The Twice's own recorded item is kept, unused, until cleared.
  expect(twice.retained).toEqual([
    { field: 'targets', label: 'Targets', value: 'An item' },
  ]);
});

test('[EVT-08.cache-per-target] Cache Discovered gives each cache its own Attempt it / Let it happen and Secrecy check', () => {
  const { draft, snapshot } = threatEventFixture(62);
  let { view, phase } = facts(draft, snapshot);
  let cache = panel(view, 'event');
  expect(cache.cache).toMatchObject({
    label: 'Cache that is discovered',
    selected: 'cache',
  });
  expect(cache.cache!.choices).toEqual([
    {
      value: 'cache',
      label: 'Minor cache at Bridge',
      description: 'Hidden · Supplies',
    },
    {
      value: 'returning',
      label: 'Minor cache at Road',
      description: 'Planned for retrieval · Other supplies',
    },
  ]);
  // Unattempted by default: it does not block, and the cache is lost.
  expect(cache.caches).toHaveLength(1);
  expect(cache.caches[0]).toMatchObject({
    cacheId: 'cache',
    name: 'Minor cache at Bridge',
    mitigation: 'unattempted',
    explicit: false,
  });
  expect(cache.caches[0]!.check.dc).toBe(10 + snapshot.rank);
  expect(cache.caches[0]!.check.label).toBe(
    'Secrecy check for Minor cache at Bridge',
  );
  // Nothing to record, though a recorded account stays editable.
  expect(cache.whatHappened?.required).toBe(false);
  expect(cache.outcomes).toEqual([
    'Minor cache at Bridge: discovered and lost.',
    'Supplies: lost with the cache.',
  ]);
  expect(messages(phase)).toEqual([]);

  // Attempted without a roll: one worded requirement, listed once.
  draft.event.occurrences[0]!.targetChecks = [
    { target: { kind: 'cache', cacheId: 'cache' }, mitigation: 'attempted' },
  ];
  ({ view, phase } = facts(draft, snapshot));
  cache = panel(view, 'event');
  expect(cache.caches[0]).toMatchObject({
    mitigation: 'attempted',
    explicit: true,
  });
  expect(cache.caches[0]!.check.required).toBe(true);
  expect(cache.outcomes).toEqual([]);
  expect(messages(phase)).toEqual([
    'Event 1 · Cache Discovered: enter the Secrecy check for the minor cache at Bridge (d20).',
  ]);

  // A success retrieves the cache and its contents.
  draft.event.occurrences[0]!.targetChecks[0]!.rolls = { check: roll(20, 20) };
  ({ view } = facts(draft, snapshot));
  cache = panel(view, 'event');
  expect(cache.caches[0]!.check.succeeded).toBe(true);
  expect(cache.outcomes).toEqual([
    'Minor cache at Bridge: retrieved by the PCs.',
    'Supplies: back in the PCs’ hands.',
  ]);
});

test('[EVT-13.cache-twice] Cache Discovered Twice discovers every cache left, each checked independently, and says so when none is left', () => {
  const { draft, snapshot } = threatEventFixture(62, true);
  // The Twice also discovers the one planned for retrieval; it keeps its
  // own mitigation apart from the first's.
  draft.event.occurrences[2]!.targetChecks = [
    {
      target: { kind: 'cache', cacheId: 'returning' },
      mitigation: 'attempted',
      rolls: { check: roll(20, 20) },
    },
  ];
  let { view } = facts(draft, snapshot);
  const first = panel(view, 'first');
  const twice = panel(view, 'second');
  expect(first.caches.map((cache) => cache.cacheId)).toEqual(['cache']);
  expect(twice.cache).toBeNull();
  expect(
    twice.caches.map((cache) => [cache.cacheId, cache.mitigation]),
  ).toEqual([['returning', 'attempted']]);
  expect(twice.outcomes).toEqual([
    'Minor cache at Road: retrieved by the PCs.',
    'Other supplies: back in the PCs’ hands.',
  ]);
  expect(first.notes).toEqual([
    'Twice in Event 1.2 · Cache Discovered: every other cache still hidden or planned is discovered there.',
  ]);
  // The Twice's own recorded cache target is not used.
  expect(twice.retained.map((entry) => entry.field)).toEqual(['targets']);

  // Nothing left for the Twice: no additional effect.
  snapshot.economy!.caches.pop();
  ({ view } = facts(draft, snapshot));
  expect(panel(view, 'second').notes).toContain(
    'No additional effect: no cache is left hidden or planned.',
  );
  expect(panel(view, 'second').retainedCacheChecks).toEqual([
    {
      index: 0,
      value: 'returning',
      label: 'A cache no longer recorded',
      reason: 'This event does not discover it. Remove this recorded check.',
    },
  ]);
});

test('[EVT-07.cache-retained] a recorded cache already lost stays visible, and an event-level roll is no cache’s attempt but an unused input to clear', () => {
  const { draft, snapshot } = threatEventFixture(62, true);
  snapshot.economy!.caches[0]!.status = 'lost';
  // Ruleset Version 9: an event-level roll no longer stands in for any cache.
  draft.event.occurrences[1]!.rolls = { check: roll(20, 5) };
  draft.event.occurrences[2]!.rolls = { check: roll(20, 5) };
  const { view } = facts(draft, snapshot);
  const first = panel(view, 'first');
  expect(first.cache).toMatchObject({ selected: null, required: true });
  expect(first.cache!.retained).toEqual([
    {
      value: 'cache',
      label: 'Minor cache at Bridge',
      reason:
        'Already retrieved or lost, so it cannot be discovered. Clear it or choose another cache.',
    },
  ]);
  const twice = panel(view, 'second');
  expect(twice.caches[0]).toMatchObject({
    cacheId: 'returning',
    mitigation: 'unattempted',
  });
  expect(twice.caches[0]!.check.required).toBe(false);
  for (const cache of [first, twice])
    expect(cache.retained).toContainEqual({
      field: 'rolls',
      label: 'Rolls',
      value: 'check roll',
    });
});

test('[EVT-07.cache-contents] a cache holding an item no longer recorded asks for its restoration', () => {
  // The snapshot never holds such a cache; the rules still name the case.
  const { draft, snapshot } = threatEventFixture(62);
  const cache = panel(facts(draft, snapshot).view, 'event');
  expect(resourcePanelMessage(cache, 'cache:cache:items', false)).toBe(
    'Minor cache at Bridge holds an item no longer recorded. Restore it in Militia corrections before the cache resolves.',
  );
  expect(resourcePanelMessage(cache, 'cache:mitigation:roll', false)).toBe(
    'enter the Secrecy check for the minor cache at Bridge (d20).',
  );
});

test('[EVT-07.festival] Festival chooses an operated town with its source; a town not operated asks for a reasoned exception', () => {
  const { draft, snapshot } = resourceEventFixture(34);
  snapshot.settlements.push({
    ...snapshot.settlements[0]!,
    settlementId: 'far',
    name: 'Far Hamlet',
  });
  let { view, phase } = facts(draft, snapshot);
  let festival = panel(view, 'event');
  expect(festival.settlement).toMatchObject({
    label: 'Town that celebrates',
    selected: 'town',
  });
  expect(festival.settlement!.choices).toEqual([
    { value: 'town', label: 'Town', description: 'Operating from this week' },
    {
      value: 'far',
      label: 'Far Hamlet',
      description: 'Not operated recently · needs a Rules Exception',
    },
  ]);
  expect(festival.outcomes).toEqual([
    'Next week (week 41): PCs gain +2 morale on Bluff, Diplomacy, Intimidate in Town.',
  ]);
  expect(messages(phase)).toEqual([]);

  draft.event.occurrences[0]!.targets = [
    { kind: 'settlement', settlementId: 'far' },
  ];
  ({ view, phase } = facts(draft, snapshot));
  festival = panel(view, 'event');
  expect(festival.settlement!.selected).toBe('far');
  expect(messages(phase)).toEqual([
    'Event 1 · Festival: the town is not one the militia operated from recently. Record a reasoned Rules Exception or choose another town.',
  ]);
  expect(
    view.occurrences[0]!.exceptionChoices.map((entry) => entry.ruleId),
  ).toEqual(['event-settlement']);
});

test('[EVT-13.festival-twice] Festival Twice keeps its first’s town and names a different recorded one', () => {
  const { draft, snapshot } = resourceEventFixture(34, true);
  let { view } = facts(draft, snapshot);
  expect(panel(view, 'first').outcomes).toEqual([
    'Next week (week 41): PCs gain +5 morale on Bluff, Diplomacy, Intimidate in Town.',
  ]);
  expect(panel(view, 'second').settlement).toBeNull();
  expect(panel(view, 'second').notes).toEqual([
    'Twice with Event 1.1 · Festival: the morale bonus increases in the same town, listed there.',
  ]);
  snapshot.settlements.push({
    ...snapshot.settlements[0]!,
    settlementId: 'far',
    name: 'Far Hamlet',
  });
  draft.event.occurrences[2]!.targets = [
    { kind: 'settlement', settlementId: 'far' },
  ];
  const changed = facts(draft, snapshot);
  view = changed.view;
  expect(messages(changed.phase)).toEqual([
    'Event 1.2 · Festival: a different town is recorded here than with the first Festival. Clear it.',
  ]);
  expect(panel(view, 'second').retained).toEqual([
    { field: 'targets', label: 'Targets', value: 'Far Hamlet' },
  ]);
});

test('[EVT-07.market-day] Market Day discounts one operated town; its Twice reaches every operated town', () => {
  const { draft, snapshot } = resourceEventFixture(38);
  let { view } = facts(draft, snapshot);
  const market = panel(view, 'event');
  expect(market.settlement).toMatchObject({
    label: 'Town with the Market Day',
    selected: 'town',
  });
  expect(market.towns).toBeNull();
  expect(market.outcomes).toEqual([
    'This week (week 40): items and services bought in Town cost an extra 5% less.',
  ]);

  const twice = resourceEventFixture(38, true);
  ({ view } = facts(twice.draft, twice.snapshot));
  expect(panel(view, 'second').settlement).toBeNull();
  expect(panel(view, 'second').towns).toEqual([
    { value: 'town', label: 'Town', description: 'Operating from this week' },
  ]);
  expect(panel(view, 'first').outcomes).toEqual([
    'This week (week 40): items and services bought in Town cost an extra 5% less.',
  ]);
});

test('[EVT-07.found-fire] Found Fire lists each PC’s reward in gp to the copper, and a reward outside the rules needs its own exception', () => {
  const { draft, snapshot } = resourceEventFixture(22);
  withSecondPc(snapshot);
  draft.event.occurrences[0]!.rewards!.push({
    itemId: 'poison',
    characterId: 'second',
    name: 'Drow poison',
    valueCopper: 7507,
    weight: 0.25,
    alchemical: true,
    poison: true,
  });
  let { view, phase } = facts(draft, snapshot);
  let fire = panel(view, 'event');
  expect(fire.rewards!.choices).toEqual([
    { value: 'pc', label: 'Wren Ashby' },
    { value: 'second', label: 'Nora Vell' },
  ]);
  const [wren, nora] = fire.rewards!.recipients;
  expect(wren).toMatchObject({ name: 'Wren Ashby', required: false });
  expect(wren!.rewards[0]).toMatchObject({
    itemId: 'reward:event',
    description: '100 gp · 1 lb · alchemical',
    permitted: true,
    exception: null,
  });
  expect(nora!.rewards[0]).toMatchObject({
    description: '75.07 gp · 0.25 lb · alchemical · poison',
    permitted: false,
    exceptionRequired: true,
    exception: {
      exceptionId: 'event:poison:alchemical-reward',
      subjectId: 'poison',
      ruleId: 'alchemical-reward',
      reason: '',
    },
  });
  expect(messages(phase)).toEqual([
    'Event 1 · Found Fire: Drow poison is not a non-poison alchemical item worth 100 gp or less. Record a reasoned Rules Exception beside it or change it.',
  ]);

  // The exception is recorded: the reward is received as entered.
  draft.rulesExceptions.push({
    exceptionId: 'event:poison:alchemical-reward',
    subjectId: 'poison',
    ruleId: 'alchemical-reward',
    reason: 'The table allowed it',
  });
  ({ view, phase } = facts(draft, snapshot));
  fire = panel(view, 'event');
  expect(fire.rewards!.recipients[1]!.rewards[0]!.exceptionRequired).toBe(
    false,
  );
  expect(messages(phase)).toEqual([]);
  expect(fire.outcomes).toEqual([
    'Wren Ashby receives Alchemist fire (100 gp, 1 lb).',
    'Nora Vell receives Drow poison (75.07 gp, 0.25 lb).',
    'Next week (week 41): Security checks +2.',
  ]);

  // Without a reward the PC is asked for one; a reward for someone who is
  // not an active PC stays listed apart.
  draft.event.occurrences[0]!.rewards = [
    { ...draft.event.occurrences[0]!.rewards![0]!, characterId: 'gone' },
  ];
  ({ view, phase } = facts(draft, snapshot));
  fire = panel(view, 'event');
  expect(fire.rewards!.recipients.map((entry) => entry.required)).toEqual([
    true,
    true,
  ]);
  expect(fire.rewards!.others[0]!.recipient).toBe(
    'A character (not an active PC)',
  );
  expect(messages(phase)).toEqual(
    expect.arrayContaining([
      'Event 1 · Found Fire: record the reward for Wren Ashby.',
      'Event 1 · Found Fire: record the reward for Nora Vell.',
      'Event 1 · Found Fire: a reward goes to someone who is not an active PC. Give it to a PC or remove it.',
    ]),
  );
});

test('[EVT-13.found-fire-twice] Found Fire Twice asks each PC for one more item on its own list', () => {
  const { draft, snapshot } = resourceEventFixture(22, true);
  const { view } = facts(draft, snapshot);
  const first = panel(view, 'first');
  const twice = panel(view, 'second');
  expect(twice.rewards!.recipients[0]!.rewards[0]!.itemId).toBe(
    'reward:second',
  );
  expect(twice.notes).toEqual([
    'Twice with Event 1.1 · Found Fire: each PC chooses one more item here.',
  ]);
  expect(first.outcomes).toContain('Next week (week 41): Security checks +2.');
  expect(twice.outcomes).toEqual([
    'Wren Ashby receives Alchemist fire (100 gp, 1 lb).',
  ]);
});

function hiddenAgendaFixture(die: number, twice = false) {
  const { draft, snapshot } = activityFixture('drill_militia');
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: roll(20, die) },
  };
  draft.event.chanceRoll = roll(100, 1);
  draft.event.occurrences = twice ? pair(42) : [occurrence('agenda', 42)];
  return { draft, snapshot };
}

test('[EVT-12.hidden-agenda] Hidden Agenda recalculates Activity checks and links the newly required roll back to its choice', () => {
  const { draft, snapshot } = hiddenAgendaFixture(8);
  const { view, phase } = facts(draft, snapshot);
  const agenda = panel(view, 'agenda');
  expect(agenda.whatHappened).toBeNull();
  expect(agenda.outcomes).toEqual(['This week’s Activity checks gain +2.']);
  expect(agenda.activity).toMatchObject({ bonus: 2, pending: true });
  expect(agenda.activity!.checks).toEqual([
    {
      slotId: 'one',
      label: 'Action Slot 1 · Drill Militia',
      result: 'Loyalty check 13 vs DC 13 (includes Hidden Agenda +2): success.',
      decided: true,
      issues: ['Required roll: enter 2d6.'],
    },
  ]);
  // The newly required Activity roll is listed once, under its choice.
  expect(phase.requirements).toEqual([
    {
      id: 'drill:training:2d6',
      message: 'Drill Militia · Slot 1: Required roll: enter 2d6.',
    },
  ]);

  const twice = hiddenAgendaFixture(8, true);
  const both = facts(twice.draft, twice.snapshot).view;
  expect(panel(both, 'first').activity?.bonus).toBe(5);
  expect(panel(both, 'second').activity).toBeNull();
  expect(panel(both, 'second').notes).toEqual([
    'Twice with Event 1.1 · Hidden Agenda: the Activity bonus increases, listed there.',
  ]);
});

test('[EVT-07.reward-edits] reward edits save the latest occurrence whole and clear a removed reward’s exception first', () => {
  const { draft, snapshot } = resourceEventFixture(22);
  draft.rulesExceptions.push({
    exceptionId: 'event:reward:event:alchemical-reward',
    subjectId: 'reward:event',
    ruleId: 'alchemical-reward',
    reason: 'Kept',
  });
  const { view } = facts(draft, snapshot);
  const edit = vi.fn();
  const { result } = renderHook(() => useEventEdits(view, edit));
  const reward = {
    itemId: 'reward:new',
    characterId: 'pc',
    name: 'Tanglefoot bag',
    valueCopper: 5000,
    weight: 4,
    alchemical: true,
    poison: false,
  };
  expect(result.current.saveReward('event', reward)).toBeNull();
  const saved = lastOccurrence(edit);
  expect(saved.tableRoll).toEqual(draft.event.occurrences[0]!.tableRoll);
  expect(
    saved.rewards.map((entry: { itemId: string }) => entry.itemId),
  ).toEqual(['reward:event', 'reward:new']);
  // Editing keeps the identity and position.
  result.current.saveReward('event', {
    ...draft.event.occurrences[0]!.rewards![0]!,
    valueCopper: 9999,
  });
  expect(lastOccurrence(edit).rewards).toEqual([
    { ...draft.event.occurrences[0]!.rewards![0]!, valueCopper: 9999 },
  ]);
  edit.mockClear();
  expect(result.current.removeReward('event', 'reward:event')).toBeNull();
  expect(edit.mock.calls.map(([entry]) => entry.kind)).toEqual([
    'clear_rules_exception',
    'event_occurrence',
  ]);
  expect(lastOccurrence(edit).rewards).toBeUndefined();
  expect(result.current.removeReward('event', 'reward:gone')).toBe(
    'This reward is no longer recorded.',
  );
  // Targets of the item and cache kinds.
  result.current.setTargets('event', 'item', ['mystery']);
  expect(lastOccurrence(edit).targets).toEqual([
    { kind: 'item', itemId: 'mystery' },
  ]);
  result.current.setTargets('event', 'cache', ['cache']);
  expect(lastOccurrence(edit).targets).toEqual([
    { kind: 'cache', cacheId: 'cache' },
  ]);
  expect(
    result.current.saveException({
      exceptionId: 'x',
      subjectId: 'reward:event',
      ruleId: 'alchemical-reward',
      reason: '  ',
    }),
  ).toBe('A reason is required.');
});

test('[EVT-07.reward-form] reward values are entered in gp without losing copper; blank and malformed differ', () => {
  const schema = rewardFormSchema(['pc'], 'reward:x');
  const values = rewardFormValues(null, 'pc');
  expect(values).toEqual({
    recipient: 'pc',
    name: '',
    value: '',
    weight: '',
    alchemical: true,
    poison: false,
  });
  const errors = (input: typeof values) => {
    const parsed = schema.safeParse(input);
    return parsed.success
      ? {}
      : Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
        );
  };
  expect(errors(values)).toEqual({
    name: 'A name is required.',
    value: 'A value in gp is required.',
    weight: 'A weight is required.',
  });
  expect(
    errors({ ...values, name: 'Fire', value: '12.345', weight: 'heavy' }),
  ).toEqual({
    value: 'Use at most two decimal places (1 cp = 0.01 gp).',
    weight: 'Enter a weight in lb, such as 1 or 0.5.',
  });
  expect(
    errors({
      ...values,
      recipient: 'gone',
      name: 'Fire',
      value: '1',
      weight: '1',
    }),
  ).toEqual({
    recipient: 'This character is not in the militia. Choose a PC.',
  });
  expect(
    schema.parse({ ...values, name: ' Fire ', value: '0.07', weight: '0.5' }),
  ).toEqual({
    itemId: 'reward:x',
    characterId: 'pc',
    name: 'Fire',
    valueCopper: 7,
    weight: 0.5,
    alchemical: true,
    poison: false,
  });
  // A zero value is a value, not a blank.
  expect(
    schema.parse({ ...values, name: 'Fire', value: '0', weight: '0' }),
  ).toMatchObject({ valueCopper: 0, weight: 0 });
  // A saved reward round-trips exactly.
  expect(
    rewardFormValues(
      {
        characterId: 'pc',
        name: 'Fire',
        valueCopper: 10001,
        weight: 1.5,
        alchemical: true,
        poison: false,
      },
      'pc',
    ),
  ).toMatchObject({ value: '100.01', weight: '1.5' });
});
