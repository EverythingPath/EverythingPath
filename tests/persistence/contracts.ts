import type { RawRoll } from '../../src/lib/weekly-draft-facts';
import { weeklySourceKey } from '../../src/lib/canonical-weekly-source';
import type {
  DraftTransport,
  DraftOperation,
  DraftObservation,
} from '../../src/lib/weekly-draft-persistence-contract';
import { DraftTransportFailure } from '../../src/lib/weekly-draft-persistence-contract';
import { createDraftPersistence } from '../../src/lib/weekly-draft-persistence';
import type { WeeklyDraftEdit } from '../../src/lib/weekly-draft-contract';

export type PersistenceContractHarness = {
  first: DraftTransport;
  second: DraftTransport;
  close(this: void): Promise<void>;
  dispose(this: void): Promise<void>;
};
export type PersistenceContractFactory =
  () => Promise<PersistenceContractHarness>;
const roll = (value: number) => ({
  diceTotal: value,
  diceCount: 1,
  sides: 100,
  provenance: { kind: 'table' as const },
  modifiers: [],
});
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function recordedTotal(raw: RawRoll | undefined) {
  check(raw, 'The roll is recorded');
  return raw.diceTotal;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function rejects(action: Promise<unknown>, message: string) {
  let rejected = false;
  try {
    await action;
  } catch {
    rejected = true;
  }
  check(rejected, message);
}
function observationAt(transport: DraftTransport, revision: number) {
  const result = deferred<DraftObservation>();
  const stop = transport.subscribe(
    (value) => {
      if (value.revision >= revision) result.resolve(value);
    },
    (error) => {
      throw error;
    },
  );
  return { promise: result.promise, stop };
}

export async function runPersistenceContract(
  createHarness: PersistenceContractFactory,
) {
  async function scenario(
    run: (
      harness: PersistenceContractHarness,
      operation: (
        baseRevision: number,
        edit: WeeklyDraftEdit,
      ) => DraftOperation,
    ) => Promise<void>,
  ) {
    const harness = await createHarness();
    try {
      const initial = await harness.first.read();
      check(
        initial.status === 'open' &&
          initial.revision === 0 &&
          initial.draft?.activity.slots.length === 3,
        'Shared fixture must start at revision zero with three empty slots',
      );
      let id = 0;
      await run(harness, (baseRevision, edit) => ({
        draftId: initial.draftId,
        operationId: `contract-${++id}`,
        baseRevision,
        edit,
      }));
    } finally {
      await harness.dispose();
    }
  }
  await scenario(async ({ first, second }, op) => {
    const staged = { ...roll(12), sides: 20 };
    await first.send(
      op(0, {
        kind: 'stage',
        slotId: 'left',
        choice: {
          choiceId: 'staged-check',
          actionId: 'earn_gold',
          rolls: { check: staged },
        },
      }),
    );
    const total = {
      diceTotal: 100,
      diceCount: 1,
      sides: 100,
      provenance: { kind: 'generated' as const, sourceId: 'table-dice' },
      modifiers: [{ sourceId: 'weather', value: -2, reason: 'Rain' }],
    };
    const sent: DraftOperation[] = [];
    const adapter = createDraftPersistence({
      ...first,
      async send(operation) {
        sent.push(structuredClone(operation));
        const receipt = await first.send(operation);
        if (sent.length === 1)
          throw new DraftTransportFailure('Acknowledgement dropped');
        return receipt;
      },
    });
    try {
      await adapter.ready;
      check(
        (await adapter.edit({ kind: 'event_chance', roll: total })) ===
          'accepted',
        'Total-form dropped acknowledgement recovers',
      );
      check(
        sent.length === 2 &&
          weeklySourceKey(sent[0]) === weeklySourceKey(sent[1]),
        'Total retry keeps exact identity and payload',
      );
      const accepted = await second.read();
      check(accepted.revision === 2, 'Both writes advance exactly once each');
      check(
        weeklySourceKey(accepted.draft?.event.chanceRoll) ===
          weeklySourceKey(total),
        'Other player reads original total metadata',
      );
      check(
        weeklySourceKey(
          accepted.draft?.activity.slots[0]?.choice?.actionId === 'earn_gold'
            ? accepted.draft.activity.slots[0].choice.rolls?.check
            : undefined,
        ) === weeklySourceKey(staged),
        'Other player retains the staged check roll',
      );
      const reloaded = createDraftPersistence(second);
      try {
        await reloaded.ready;
        check(
          weeklySourceKey(reloaded.getSnapshot().observation?.draft) ===
            weeklySourceKey(accepted.draft),
          'Reload preserves both rolls without a write',
        );
      } finally {
        reloaded.dispose();
      }
      check(
        (await first.read()).revision === 2,
        'Reading the rolls does not advance revision',
      );
      check(
        (await adapter.edit({ kind: 'event_chance', roll: null })) ===
          'accepted',
        'Existing clear accepts a total-form field',
      );
      const cleared = await second.read();
      check(
        cleared.draft?.event.chanceRoll === undefined,
        'Clear deletes the total instead of inventing zero or dice',
      );
      check(
        weeklySourceKey(
          cleared.draft?.activity.slots[0]?.choice?.actionId === 'earn_gold'
            ? cleared.draft.activity.slots[0].choice.rolls?.check
            : undefined,
        ) === weeklySourceKey(staged),
        'Clearing total preserves unrelated staged roll',
      );
    } finally {
      adapter.dispose();
    }
  });
  await scenario(async ({ first, second, close }, op) => {
    const watcher = observationAt(second, 2);
    try {
      const left = op(0, {
        kind: 'stage',
        slotId: 'left',
        choice: { choiceId: 'a', actionId: 'earn_gold' },
      });
      check(
        (await first.send(left)).acceptedRevision === 1,
        'First edit increments once',
      );
      const right = op(0, {
        kind: 'stage',
        slotId: 'right',
        choice: { choiceId: 'b', actionId: 'earn_gold' },
      });
      check(
        (await second.send(right)).acceptedRevision === 2,
        'Disjoint stale target accepts',
      );
      const shared = await watcher.promise;
      check(
        shared.draft?.activity.slots[0]?.choice?.choiceId === 'a' &&
          shared.draft.activity.slots[1]?.choice?.choiceId === 'b',
        'Both players observe shared accepted state',
      );
      check(
        (await first.send(left)).acceptedRevision === 1 &&
          (await first.read()).revision === 2,
        'Duplicate identity cannot increment again',
      );
      await rejects(
        first.send({
          ...left,
          edit: { kind: 'clear', slotId: 'left', choiceId: 'a' },
        }),
        'Identity reuse with another intent must fail',
      );
      const before = await first.read();
      await rejects(
        second.send(
          op(1, {
            kind: 'swap',
            fromSlotId: 'left',
            toSlotId: 'right',
            choiceId: 'a',
            otherChoiceId: 'b',
          }),
        ),
        'Swap must reject if either target changed',
      );
      check(
        JSON.stringify(await first.read()) === JSON.stringify(before),
        'Rejected atomic operation cannot change either target',
      );
      await close();
      check(
        (await first.send(left)).acceptedRevision === 1,
        'Lost acknowledgement retry remains deduplicated after close',
      );
      await rejects(
        first.send(op(2, { kind: 'clear', slotId: 'left', choiceId: 'a' })),
        'Closed draft cannot accept a new edit',
      );
    } finally {
      watcher.stop();
    }
  });
  await scenario(async ({ first, second }, op) => {
    const choice = { choiceId: 'a', actionId: 'earn_gold' as const };
    await first.send(op(0, { kind: 'stage', slotId: 'left', choice }));
    await first.send(
      op(1, {
        kind: 'detail',
        slotId: 'left',
        choiceId: 'a',
        choice: { ...choice, costCopper: 12 },
      }),
    );
    await second.send(
      op(1, {
        kind: 'detail',
        slotId: 'left',
        choiceId: 'a',
        choice: { ...choice, rolls: { check: roll(10) } },
      }),
    );
    const result = (await first.read()).draft?.activity.slots[0]?.choice;
    check(
      result?.actionId === 'earn_gold' &&
        result.costCopper === 12 &&
        recordedTotal(result.rolls?.check) === 10,
      'Disjoint detail fields merge without dropping accepted changes',
    );
    const before = await first.read();
    await rejects(
      second.send(
        op(1, {
          kind: 'detail',
          slotId: 'left',
          choiceId: 'a',
          choice: { ...choice, costCopper: 18 },
        }),
      ),
      'Same detail conflicts',
    );
    await rejects(
      second.send(
        op(1, {
          kind: 'replace',
          slotId: 'left',
          choiceId: 'a',
          choice: { choiceId: 'replacement', actionId: 'earn_gold' },
        }),
      ),
      'Whole choice conflicts with changed detail',
    );
    check(
      JSON.stringify(await first.read()) === JSON.stringify(before),
      'Failed details leave accepted state intact',
    );
    await first.send(
      op(3, {
        kind: 'replace',
        slotId: 'left',
        choiceId: 'a',
        choice: { choiceId: 'replacement', actionId: 'earn_gold' },
      }),
    );
    await rejects(
      second.send(
        op(3, {
          kind: 'detail',
          slotId: 'left',
          choiceId: 'a',
          choice: { ...choice, costCopper: 20 },
        }),
      ),
      'Same-action replacement invalidates old choice identity',
    );
  });
  await scenario(async ({ first }) => {
    let attempts = 0;
    const sent: DraftOperation[] = [];
    const controlled: DraftTransport = {
      ...first,
      async send(operation) {
        attempts++;
        sent.push(structuredClone(operation));
        const receipt = await first.send(operation);
        if (attempts === 1)
          throw new DraftTransportFailure('Acknowledgement dropped');
        return receipt;
      },
    };
    const adapter = createDraftPersistence(controlled);
    try {
      await adapter.ready;
      check(
        (await adapter.edit({ kind: 'event_chance', roll: roll(24) })) ===
          'accepted',
        'Dropped acknowledgement recovers',
      );
      check(
        attempts === 2 && JSON.stringify(sent[0]) === JSON.stringify(sent[1]),
        'Retry preserves exact operation identity and payload',
      );
      check(
        (await first.read()).revision === 1,
        'Dropped response increments once',
      );
      check(
        (await adapter.edit({
          kind: 'clear',
          slotId: 'left',
          choiceId: 'missing',
        })) === 'failed',
        'Server rejection surfaces failure',
      );
      check(Number(attempts) === 3, 'Server rejection must not retry');
    } finally {
      adapter.dispose();
    }
  });
  await scenario(async ({ first, second }, op) => {
    const entered = deferred<void>();
    const release = deferred<void>();
    let calls = 0;
    const acknowledgements: number[] = [];
    const controlled: DraftTransport = {
      ...first,
      async send(operation) {
        calls++;
        if (calls === 1) {
          entered.resolve();
          await release.promise;
        }
        return await first.send(operation);
      },
    };
    const adapter = createDraftPersistence(controlled);
    try {
      await adapter.ready;
      const one = adapter
        .edit({ kind: 'event_chance', roll: roll(15) })
        .then((result) => {
          acknowledgements.push(1);
          return result;
        });
      const two = adapter
        .edit({ kind: 'event_chance', roll: roll(25) })
        .then((result) => {
          acknowledgements.push(2);
          return result;
        });
      await entered.promise;
      check(
        adapter.getSnapshot().pending === 2 && calls === 1,
        'Pending acknowledgement is immediate and dispatch ordered',
      );
      release.resolve();
      check(
        (await one) === 'accepted' && (await two) === 'accepted',
        'Rapid same-field local edits process as sequential intents',
      );
      check(
        acknowledgements.join(',') === '1,2' &&
          recordedTotal((await first.read()).draft?.event.chanceRoll) === 25,
        'Acknowledgements and final outcome follow submission order',
      );
      const remote = await second.send(
        op(2, { kind: 'event_chance', roll: roll(35) }),
      );
      check(
        remote.acceptedRevision === 3,
        'Second player can continue editing',
      );
    } finally {
      release.resolve();
      adapter.dispose();
    }
  });
  await scenario(async ({ first, second }, op) => {
    const committed = deferred<void>();
    const release = deferred<void>();
    let calls = 0;
    const controlled: DraftTransport = {
      ...first,
      async send(operation) {
        calls++;
        const receipt = await first.send(operation);
        if (calls === 1) {
          committed.resolve();
          await release.promise;
        }
        return receipt;
      },
    };
    const adapter = createDraftPersistence(controlled);
    try {
      await adapter.ready;
      const initial = adapter.getSnapshot().observation!;
      const firstEdit = adapter.edit({ kind: 'event_chance', roll: roll(15) });
      const queued = adapter.edit({ kind: 'event_chance', roll: roll(25) });
      await committed.promise;
      const remoteObserved = observationAt(first, 2);
      try {
        await second.send(op(1, { kind: 'event_chance', roll: roll(35) }));
        await remoteObserved.promise;
      } finally {
        remoteObserved.stop();
      }
      release.resolve();
      check(
        (await firstEdit) === 'accepted' && (await queued) === 'failed',
        'Queued remote conflict must fail instead of overwriting',
      );
      check(
        adapter.getSnapshot().observation?.revision === 2 &&
          recordedTotal((await first.read()).draft?.event.chanceRoll) === 35,
        'Old acknowledgement must not regress remote observation',
      );
      check(
        initial.revision === 0,
        'Published observations are immutable values',
      );
    } finally {
      release.resolve();
      adapter.dispose();
    }
  });
  await scenario(async ({ first, second }, op) => {
    await first.send(
      op(0, {
        kind: 'event_tree',
        occurrences: [
          {
            eventId: 'buyoff-target',
            origin: { kind: 'rolled' },
            eventType: 'theft',
            persistent: true,
          },
        ],
      }),
    );
    await first.send(
      op(1, {
        kind: 'persistent_decision',
        decision: { kind: 'buyoff', eventId: 'buyoff-target' },
      }),
    );
    await rejects(
      second.send(
        op(1, {
          kind: 'persistent_decision',
          decision: { kind: 'unattempted', eventId: 'buyoff-target' },
        }),
      ),
      'Stale same-event decision cannot overwrite staged buyoff',
    );
    const accepted = await second.read();
    check(
      accepted.revision === 2 &&
        accepted.draft?.event.occurrences[0]?.persistentDecision?.kind ===
          'buyoff',
      'Both players retain the accepted buyoff without a second revision',
    );
  });

  await scenario(async ({ first, second }, op) => {
    const event = {
      eventId: 'persistent',
      origin: { kind: 'rolled' as const },
      eventType: 'theft' as const,
      persistent: true,
    };
    await first.send(op(0, { kind: 'event_tree', occurrences: [event] }));
    await first.send(
      op(1, {
        kind: 'persistent_decision',
        decision: { kind: 'unattempted', eventId: event.eventId },
      }),
    );
    await rejects(
      second.send(op(1, { kind: 'event_tree', occurrences: [event] })),
      'Whole event tree conflicts with nested decision',
    );
    await first.send(op(2, { kind: 'event_tree', occurrences: [event] }));
    await rejects(
      second.send(
        op(2, {
          kind: 'persistent_decision',
          decision: { kind: 'mitigate', eventId: event.eventId },
        }),
      ),
      'Nested decision conflicts with replaced event tree',
    );
    const choice = {
      choiceId: 'guarantee',
      actionId: 'guarantee_event' as const,
      selectedEventId: 'candidate',
      candidates: [{ ...event, eventId: 'candidate' }],
    };
    await first.send(op(3, { kind: 'stage', slotId: 'left', choice }));
    await second.send(
      op(4, {
        kind: 'persistent_decision',
        decision: { kind: 'mitigate', eventId: 'candidate' },
      }),
    );
    await rejects(
      first.send(
        op(4, {
          kind: 'move',
          fromSlotId: 'left',
          toSlotId: 'right',
          choiceId: choice.choiceId,
        }),
      ),
      'Atomic move conflicts with nested candidate decision',
    );
    check(
      (await first.read()).draft?.activity.slots[1]?.choice === null,
      'Failed move leaves destination empty',
    );
    await first.send(
      op(5, {
        kind: 'move',
        fromSlotId: 'left',
        toSlotId: 'right',
        choiceId: choice.choiceId,
      }),
    );
    await rejects(
      second.send(
        op(5, {
          kind: 'persistent_decision',
          decision: { kind: 'unattempted', eventId: 'candidate' },
        }),
      ),
      'Candidate decision cannot follow an obsolete owner slot',
    );
  });

  await scenario(async ({ first }, op) => {
    const before = await first.read();
    await rejects(
      first.send(
        op(0, {
          kind: 'stage',
          slotId: 'left',
          choice: {
            choiceId: 'foreign',
            actionId: 'rescue_character',
            characterId: 'outside-campaign',
          },
        }),
      ),
      'Foreign entity cannot enter shared source',
    );
    check(
      JSON.stringify(await first.read()) === JSON.stringify(before),
      'Rejected references do not advance revision',
    );
    await first.send(
      op(0, {
        kind: 'stage',
        slotId: 'left',
        choice: { choiceId: 'a', actionId: 'earn_gold' },
      }),
    );
    await first.send(
      op(1, {
        kind: 'stage',
        slotId: 'right',
        choice: { choiceId: 'b', actionId: 'lie_low' },
      }),
    );
    await first.send(
      op(2, {
        kind: 'swap',
        fromSlotId: 'left',
        toSlotId: 'right',
        choiceId: 'a',
        otherChoiceId: 'b',
      }),
    );
    const swapped = await first.read();
    check(
      swapped.revision === 3 &&
        swapped.draft?.activity.slots[0]?.choice?.choiceId === 'b' &&
        swapped.draft.activity.slots[1]?.choice?.choiceId === 'a',
      'Swap commits both slots in exactly one revision',
    );
    await first.send(op(3, { kind: 'clear', slotId: 'left', choiceId: 'b' }));
    await first.send(
      op(4, {
        kind: 'move',
        fromSlotId: 'right',
        toSlotId: 'left',
        choiceId: 'a',
      }),
    );
    const moved = await first.read();
    check(
      moved.revision === 5 &&
        moved.draft?.activity.slots[0]?.choice?.choiceId === 'a' &&
        moved.draft.activity.slots[1]?.choice === null,
      'Move atomically preserves choice identity',
    );
  });
  await scenario(async ({ first }) => {
    const entered = deferred<void>();
    const release = deferred<void>();
    let calls = 0;
    const controlled: DraftTransport = {
      ...first,
      async send(operation) {
        if (++calls === 1) {
          entered.resolve();
          await release.promise;
        }
        return await first.send(operation);
      },
    };
    const adapter = createDraftPersistence(controlled);
    try {
      await adapter.ready;
      const staged = { choiceId: 'scout', actionId: 'special' as const };
      const replacement = {
        choiceId: 'new-scout',
        actionId: 'special' as const,
      };
      const edits = [
        adapter.edit({ kind: 'stage', slotId: 'left', choice: staged }),
        adapter.edit({
          kind: 'detail',
          slotId: 'left',
          choiceId: staged.choiceId,
          choice: { ...staged, instruction: 'Scout ruins', costCopper: 0 },
        }),
        adapter.edit({
          kind: 'replace',
          slotId: 'left',
          choiceId: staged.choiceId,
          choice: replacement,
        }),
        adapter.edit({
          kind: 'detail',
          slotId: 'left',
          choiceId: replacement.choiceId,
          choice: { ...replacement, instruction: 'Scout road', costCopper: 10 },
        }),
        adapter.edit({
          kind: 'move',
          fromSlotId: 'left',
          toSlotId: 'right',
          choiceId: replacement.choiceId,
        }),
        adapter.edit({
          kind: 'detail',
          slotId: 'right',
          choiceId: replacement.choiceId,
          choice: { ...replacement, instruction: 'Scout road', costCopper: 0 },
        }),
        adapter.edit({
          kind: 'detail',
          slotId: 'right',
          choiceId: replacement.choiceId,
          choice: { ...replacement, instruction: 'Scout ruins' },
        }),
      ];
      await entered.promise;
      release.resolve();
      check(
        (await Promise.all(edits)).every((result) => result === 'accepted'),
        'Queued stage/replace/move details and clearing a pending field must all accept in order',
      );
      const result = await first.read();
      const choice = result.draft?.activity.slots[1]?.choice;
      check(
        result.revision === 7 &&
          result.draft?.activity.slots[0]?.choice === null &&
          choice?.actionId === 'special' &&
          choice.instruction === 'Scout ruins' &&
          choice.costCopper === undefined,
        'Pending local choices preserve the final entered detail values',
      );
    } finally {
      release.resolve();
      adapter.dispose();
    }
  });
  await scenario(async ({ first }, op) => {
    await first.send(
      op(0, {
        kind: 'stage',
        slotId: 'left',
        choice: {
          choiceId: 'recruit',
          actionId: 'recruit_team',
          teamType: 'informants',
        },
      }),
    );
    await first.send(
      op(1, {
        kind: 'table_adjustments',
        adjustments: [
          {
            kind: 'team_status',
            adjustmentId: 'injured',
            teamId: 'recruit:recruit',
            status: 'disabled',
            reason: 'New team arrived injured',
          },
        ],
      }),
    );
    await first.send(
      op(2, {
        kind: 'stage',
        slotId: 'right',
        choice: {
          choiceId: 'dismiss',
          actionId: 'dismiss_team',
          targetTeamId: 'recruit:recruit',
        },
      }),
    );
    await rejects(
      first.send(
        op(3, {
          kind: 'swap',
          fromSlotId: 'left',
          toSlotId: 'right',
          choiceId: 'recruit',
          otherChoiceId: 'dismiss',
        }),
      ),
      'A reference cannot precede the Activity choice creating its identity',
    );
    check(
      (await first.read()).revision === 3,
      'Partial ordered draft-created references stage without allowing future references',
    );
  });
  await scenario(async ({ first, second }, op) => {
    let revision = 0;
    const acknowledge = (id: string): WeeklyDraftEdit => ({
      kind: 'acknowledge',
      acknowledgement: {
        acknowledgementId: id,
        subjectId: 'table',
        outcome: 'Recorded at table',
      },
    });
    const exception = (id: string): WeeklyDraftEdit => ({
      kind: 'rules_exception',
      exception: {
        exceptionId: id,
        subjectId: 'table',
        ruleId: 'homebrew',
        reason: 'Agreed at table',
      },
    });
    const staleAck = op(0, acknowledge('original-ack'));
    const staleException = op(0, exception('original-exception'));
    for (let index = 0; index < 9; index++) {
      const ackId = index === 0 ? 'original-ack' : `later-ack-${index}`;
      const exceptionId =
        index === 0 ? 'original-exception' : `later-exception-${index}`;
      for (const edit of [
        acknowledge(ackId),
        { kind: 'clear_acknowledgement' as const, acknowledgementId: ackId },
        exception(exceptionId),
        { kind: 'clear_rules_exception' as const, exceptionId },
      ]) {
        await first.send(op(revision++, edit));
      }
    }
    const before = await second.read();
    check(
      before.revision === 36 &&
        before.draft?.acknowledgements.length === 0 &&
        before.draft.rulesExceptions.length === 0,
      'Repeated create/clear leaves empty current input collections',
    );
    check(
      before.targetRevisions.length >= 18,
      'Transport hydrates conflict tombstones across multiple target pages',
    );
    await rejects(
      second.send(staleAck),
      'Cleared acknowledgement tombstone prevents stale recreation',
    );
    await rejects(
      second.send(staleException),
      'Cleared exception tombstone prevents stale recreation',
    );
    check(
      JSON.stringify(await second.read()) === JSON.stringify(before),
      'Stale recreation must not change accepted source',
    );
  });
  await scenario(async ({ first, second }, op) => {
    await first.send(
      op(0, {
        kind: 'upkeep_roll',
        field: 'check',
        roll: {
          diceTotal: 0,
          diceCount: 1,
          sides: 20,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      }),
    );
    await second.send(
      op(0, {
        kind: 'upkeep_roll',
        field: 'training',
        roll: {
          diceTotal: 3,
          diceCount: 1,
          sides: 6,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      }),
    );
    let current = await first.read();
    check(
      recordedTotal(current.draft?.upkeep.rolls.check) === 0 &&
        recordedTotal(current.draft?.upkeep.rolls.training) === 3,
      'Disjoint focused Upkeep rolls coexist and zero remains entered',
    );
    await rejects(
      second.send(op(0, { kind: 'upkeep_roll', field: 'check', roll: null })),
      'Stale focused clear cannot erase another player roll',
    );
    await first.send(
      op(2, { kind: 'upkeep_roll', field: 'check', roll: null }),
    );
    current = await second.read();
    check(
      current.draft?.upkeep.rolls.check === undefined &&
        recordedTotal(current.draft?.upkeep.rolls.training) === 3,
      'Explicit clear removes only its roll',
    );
  });
  await scenario(async ({ first, second }, op) => {
    const firstEvent = {
      eventId: 'first-event',
      origin: { kind: 'rolled' as const },
    };
    const secondEvent = {
      eventId: 'second-event',
      origin: { kind: 'replacement' as const, parentEventId: 'first-event' },
    };
    await first.send(
      op(0, { kind: 'event_tree', occurrences: [firstEvent, secondEvent] }),
    );
    await first.send(
      op(1, {
        kind: 'event_occurrence',
        occurrence: { ...firstEvent, tableRoll: roll(50) },
      }),
    );
    await second.send(
      op(1, {
        kind: 'event_occurrence',
        occurrence: { ...secondEvent, tableRoll: roll(45) },
      }),
    );
    const observed = await first.read();
    check(
      recordedTotal(observed.draft?.event.occurrences[0]?.tableRoll) === 50 &&
        recordedTotal(observed.draft?.event.occurrences[1]?.tableRoll) === 45,
      'Disjoint stale occurrence inputs coexist',
    );
    await rejects(
      second.send(
        op(1, {
          kind: 'event_occurrence',
          occurrence: { ...firstEvent, tableRoll: roll(46) },
        }),
      ),
      'Same occurrence rejects stale inputs',
    );
    await rejects(
      second.send(op(1, { kind: 'event_tree', occurrences: [] })),
      'Stale tree removal cannot erase accepted occurrence inputs',
    );
    await first.send(op(3, { kind: 'event_tree', occurrences: [] }));
    await rejects(
      second.send(
        op(3, {
          kind: 'event_occurrence',
          occurrence: { ...secondEvent, tableRoll: roll(47) },
        }),
      ),
      'A removed occurrence cannot be resurrected',
    );
    await first.send(
      op(4, {
        kind: 'stage',
        slotId: 'left',
        choice: {
          choiceId: 'event-choice',
          actionId: 'guarantee_event',
          candidates: [firstEvent],
        },
      }),
    );
    await first.send(
      op(5, {
        kind: 'event_occurrence',
        occurrence: { ...firstEvent, tableRoll: roll(45) },
      }),
    );
    const choice = (await second.read()).draft?.activity.slots[0]?.choice;
    check(
      choice?.actionId === 'guarantee_event' &&
        recordedTotal(choice.candidates?.[0]?.tableRoll) === 45,
      'Occurrence edits retain Activity ownership',
    );
    await rejects(
      second.send(
        op(5, {
          kind: 'detail',
          slotId: 'left',
          choiceId: 'event-choice',
          choice: {
            choiceId: 'event-choice',
            actionId: 'guarantee_event',
            candidates: [],
          },
        }),
      ),
      'Candidate replacement conflicts with edited occurrences',
    );
    await first.send(
      op(6, {
        kind: 'move',
        fromSlotId: 'left',
        toSlotId: 'right',
        choiceId: 'event-choice',
      }),
    );
    await rejects(
      second.send(
        op(6, {
          kind: 'event_occurrence',
          occurrence: { ...firstEvent, tableRoll: roll(46) },
        }),
      ),
      'Delayed occurrence edits conflict with owner movement',
    );
  });
  await transferScenarios(scenario);
  await removeSlotScenarios(scenario);
}

type Scenario = (
  run: (
    harness: PersistenceContractHarness,
    operation: (baseRevision: number, edit: WeeklyDraftEdit) => DraftOperation,
  ) => Promise<void>,
) => Promise<void>;
const slotIds = (observation: DraftObservation) =>
  observation.draft?.activity.slots.map((slot) => slot.slotId).join(',');
// The shared fixture is a first militia week at rank 1: one action, so
// 'left' is within the allowance and 'right' and 'extra' are beyond it.
async function removeSlotScenarios(scenario: Scenario) {
  await scenario(async ({ first, second }, op) => {
    const removal = op(0, { kind: 'remove_slot', slotId: 'right' });
    const receipt = await first.send(removal);
    const removed = await second.read();
    check(
      receipt.acceptedRevision === 1 &&
        removed.revision === 1 &&
        slotIds(removed) === 'left,extra',
      'An empty slot beyond the allowance is removed by identity',
    );
    const replay = await second.send(structuredClone(removal));
    check(
      replay.acceptedRevision === 1 && (await first.read()).revision === 1,
      'A repeated removal operation returns its original revision',
    );
    await rejects(
      second.send(op(1, { kind: 'remove_slot', slotId: 'right' })),
      'A second removal of the same slot is rejected',
    );
    await rejects(
      first.send(op(1, { kind: 'remove_slot', slotId: 'left' })),
      'A slot within the allowance cannot be removed',
    );
    await rejects(
      first.send(op(1, { kind: 'remove_slot', slotId: 'unknown' })),
      'An unknown slot cannot be removed',
    );
    await first.send(
      op(1, {
        kind: 'stage',
        slotId: 'extra',
        choice: { choiceId: 'later', actionId: 'lie_low' },
      }),
    );
    await rejects(
      second.send(op(2, { kind: 'remove_slot', slotId: 'extra' })),
      'An occupied extra slot cannot be removed',
    );
    const after = await first.read();
    check(
      after.revision === 2 &&
        slotIds(after) === 'left,extra' &&
        after.draft?.activity.slots[1]?.choice?.choiceId === 'later',
      'Later slots keep their identities and choices after a removal',
    );
  });
  // Concurrent fill and removal of the same slot: whichever is accepted
  // first wins and the delayed operation is rejected, in both orders.
  await scenario(async ({ first, second }, op) => {
    await first.send(
      op(0, {
        kind: 'stage',
        slotId: 'extra',
        choice: { choiceId: 'filled', actionId: 'lie_low' },
      }),
    );
    await rejects(
      second.send(op(0, { kind: 'remove_slot', slotId: 'extra' })),
      'A removal based on the empty slot loses to a concurrent fill',
    );
    await first.send(op(1, { kind: 'remove_slot', slotId: 'right' }));
    await rejects(
      second.send(
        op(1, {
          kind: 'stage',
          slotId: 'right',
          choice: { choiceId: 'late', actionId: 'lie_low' },
        }),
      ),
      'A delayed fill of a removed slot is rejected',
    );
    const after = await second.read();
    check(
      after.revision === 2 &&
        slotIds(after) === 'left,extra' &&
        after.draft?.activity.slots[1]?.choice?.choiceId === 'filled',
      'Rejected concurrent edits never redirect to another slot',
    );
  });
  // Optimistic removal: a rejected removal restores the accepted slots, and
  // an accepted one keeps the following slot identities stable.
  await scenario(async ({ first }) => {
    const adapter = createDraftPersistence(first);
    try {
      await adapter.ready;
      const optimistic = adapter.edit({ kind: 'remove_slot', slotId: 'left' });
      check(
        (await optimistic) === 'failed' &&
          slotIds(adapter.getSnapshot().observation!) === 'left,right,extra',
        'A rejected optimistic removal restores the accepted slots',
      );
      check(
        (await adapter.edit({ kind: 'remove_slot', slotId: 'right' })) ===
          'accepted' &&
          (await adapter.edit({
            kind: 'stage',
            slotId: 'extra',
            choice: { choiceId: 'after', actionId: 'lie_low' },
          })) === 'accepted',
        'Edits continue to address surviving slots by identity',
      );
      const accepted = adapter.getSnapshot().observation!;
      check(
        slotIds(accepted) === 'left,extra' &&
          accepted.draft?.activity.slots[1]?.choice?.choiceId === 'after',
        'Accepted removal keeps subsequent slot identities',
      );
    } finally {
      adapter.dispose();
    }
  });
}

// Treasury transfers carry no character (#158). A transfer that names one is
// refused without changing the draft.
async function transferScenarios(scenario: Scenario) {
  await scenario(async ({ first, second }, op) => {
    const deposit = {
      transferId: 'deposit',
      direction: 'deposit' as const,
      copper: 7,
    };
    const add = op(0, { kind: 'upkeep_transfer', transfer: deposit });
    check(
      (await first.send(add)).acceptedRevision === 1,
      'An actorless transfer is accepted',
    );
    check(
      (await second.send(structuredClone(add))).acceptedRevision === 1,
      'A repeated transfer operation returns its original revision',
    );
    await rejects(
      second.send(
        op(1, {
          kind: 'upkeep_transfer',
          transfer: {
            ...deposit,
            transferId: 'actor',
            characterId: 'pc',
          } as typeof deposit,
        }),
      ),
      'A transfer that names a character is refused',
    );
    const after = await first.read();
    check(
      after.revision === 1 &&
        weeklySourceKey(after.draft?.upkeep.treasuryTransfers) ===
          weeklySourceKey([deposit]),
      'Only the actorless transfer is stored, exactly as sent',
    );
  });
}
