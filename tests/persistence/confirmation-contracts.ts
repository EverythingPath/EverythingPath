import type { DraftTransport } from '../../src/lib/weekly-draft-persistence-contract';
import type {
  ConfirmationTransport,
  ConfirmationInspection,
} from '../../src/lib/weekly-confirmation-contract';

export type ConfirmationContractHarness = {
  first: DraftTransport & ConfirmationTransport;
  second: DraftTransport & ConfirmationTransport;
  changeSource(
    this: void,
    change: 'revision' | 'treasury' | 'invalid_reference',
  ): Promise<void>;
  blockSuccessor(this: void, operationId: string): Promise<void>;
  inspect(this: void): Promise<ConfirmationInspection>;
  dispose(this: void): Promise<void>;
};
export type ConfirmationContractFactory =
  () => Promise<ConfirmationContractHarness>;

import { createDraftPersistence } from '../../src/lib/weekly-draft-persistence';
import { DraftTransportFailure } from '../../src/lib/weekly-draft-persistence-contract';
import { weeklySourceKey } from '../../src/lib/canonical-weekly-source';
import type { WeeklyDraftEdit } from '../../src/lib/weekly-draft-contract';
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string) {
  check(
    weeklySourceKey(actual) === weeklySourceKey(expected),
    `${message}: ${JSON.stringify(actual)}`,
  );
}
async function rejected(action: Promise<unknown>, message: string) {
  let failed = false;
  try {
    await action;
  } catch {
    failed = true;
  }
  check(failed, message);
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const chance: WeeklyDraftEdit = {
  kind: 'event_chance',
  roll: {
    diceTotal: 100,
    diceCount: 1,
    sides: 100,
    provenance: { kind: 'table' },
    modifiers: [],
  },
};
export async function runConfirmationContract(
  createHarness: ConfirmationContractFactory,
) {
  let operationNumber = 0;
  async function scenario(
    run: (
      h: ConfirmationContractHarness,
      edit: (edit: WeeklyDraftEdit) => Promise<void>,
    ) => Promise<void>,
  ) {
    const h = await createHarness();
    try {
      const edit = async (edit: WeeklyDraftEdit) => {
        const current = await h.first.read();
        await h.first.send({
          draftId: current.draftId,
          operationId: `confirmation-edit-${++operationNumber}`,
          baseRevision: current.revision,
          edit,
        });
      };
      await run(h, edit);
    } finally {
      await h.dispose();
    }
  }
  await scenario(async (h, edit) => {
    const training = {
      diceTotal: 3,
      diceCount: 1,
      sides: 6,
      provenance: { kind: 'table' as const },
      modifiers: [],
    };
    await edit({ kind: 'upkeep_roll', field: 'training', roll: training });
    await edit(chance);
    const oldReview = await h.first.preview();
    check(oldReview.status === 'ready', 'First-week source is ready');
    // The same total with different provenance: an equal outcome from a
    // changed raw source.
    const total = {
      diceTotal: 100,
      diceCount: 1,
      sides: 100,
      provenance: { kind: 'generated' as const, sourceId: 'table-dice' },
      modifiers: [],
    };
    await edit({ kind: 'event_chance', roll: total });
    const before = await h.inspect();
    await rejected(
      h.second.confirm({
        operationId: 'stale-roll-review',
        reviewed: oldReview.reviewed,
      }),
      'Equivalent numeric outcome cannot authorize a changed raw source',
    );
    equal(
      await h.inspect(),
      before,
      'Rejected stale review does not mutate history or successor',
    );
    const review = await h.second.preview();
    check(review.status === 'ready', 'Changed raw source is ready');
    check(
      review.reviewed.sourceKey !== oldReview.reviewed.sourceKey,
      'Reviewed source identity includes the raw roll',
    );
    equal(
      review.outcome,
      oldReview.outcome,
      'Both raw sources give equivalent outcomes',
    );
    const accepted = await h.first.read();
    check(accepted.draft, 'Reviewed draft exists');
    check(
      chance.kind === 'event_chance',
      'Original fixture is an Event chance',
    );
    check(
      weeklySourceKey(accepted.draft) !==
        weeklySourceKey({
          ...accepted.draft,
          event: { ...accepted.draft.event, chanceRoll: chance.roll },
        }),
      'Same-revision fingerprint distinguishes raw rolls',
    );

    const operation = {
      operationId: 'changed-raw-week',
      reviewed: review.reviewed,
    };
    const receipt = await h.first.confirm(operation);
    equal(
      receipt.record.source,
      accepted.draft,
      'Confirmation retains exact reviewed source',
    );
    equal(
      receipt.record.source.event.chanceRoll,
      total,
      'Receipt retains the reviewed chance roll',
    );
    equal(
      receipt.record.source.upkeep.rolls.training,
      training,
      'Receipt retains the training roll',
    );
    equal(
      await h.second.confirm(operation),
      receipt,
      'Confirmation receipt retries exactly',
    );
    const state = await h.inspect();
    check(
      state.records.length === 1 && state.openDrafts.length === 1,
      'Confirmation commits once',
    );
    check(
      receipt.successor.event.chanceRoll === undefined &&
        receipt.successor.upkeep.rolls.training === undefined,
      'Successor does not inherit either recorded roll',
    );
  });
  await scenario(async (h, edit) => {
    await edit(chance);
    const review = await h.first.preview();
    check(review.status === 'ready', 'accepted source is ready');
    const reviewedDraft = await h.first.read();
    const operation = { operationId: 'exact-week', reviewed: review.reviewed };
    const receipt = await h.first.confirm(operation);
    const state = await h.inspect();
    equal(
      state.snapshot,
      review.outcome?.militiaSnapshot,
      'entire committed snapshot equals the reviewed outcome',
    );
    equal(
      receipt.record.source,
      reviewedDraft.draft,
      'complete reviewed draft retained',
    );
    equal(
      receipt.record.finalOutcome.data,
      review.outcome,
      'entire recorded outcome equals preview',
    );
    equal(
      receipt.record.finalPlan.data.after,
      review.outcome,
      'final plan equals committed outcome',
    );
    equal(
      receipt.record.baselinePlan.data.after,
      review.baseline,
      'recorded baseline equals reviewed baseline',
    );
    equal(
      receipt.successor.context,
      { ...review.outcome?.context, persistentPhaseEligible: false },
      'successor retains all preview context and fixes eligibility for its empty carried events',
    );
    equal(
      state.snapshot,
      {
        rank: 1,
        training: 0,
        treasuryCopper: 100,
        notoriety: 0,
        focus: 'Loyalty',
        roster: { people: [], teams: [], officers: [] },
        characters: [],
        settlements: [],
        bonuses: [],
        eventBenefits: { skills: [], markets: [] },
      },
      'complete stored no-event first week outcome',
    );
    check(
      state.records.length === 1 &&
        state.openDrafts.length === 1 &&
        state.source.status === 'closed',
      'one immutable outcome and one successor',
    );
    equal(
      state.records[0],
      receipt.record,
      'stored immutable record matches receipt',
    );
    equal(
      state.openDrafts[0],
      receipt.successor,
      'stored successor matches receipt',
    );
    const successor = state.openDrafts[0]!;
    check(
      successor.week === 2 &&
        successor.revision === 0 &&
        successor.context.startDay === 7 &&
        !successor.context.firstMilitiaWeek &&
        !successor.context.uneventfulCarry,
      'fixed successor context',
    );
    check(
      successor.activity.slots.every((slot) => slot.choice === null) &&
        successor.tableAdjustments.length === 0 &&
        successor.acknowledgements.length === 0 &&
        successor.rulesExceptions.length === 0 &&
        successor.event.chanceRoll === undefined,
      'empty successor',
    );
    equal(
      await h.first.confirm(operation),
      receipt,
      'lost response retry deduplicates exact confirmation',
    );
    await rejected(
      h.second.confirm({ ...operation, operationId: 'competing-late' }),
      'new old-week confirmation fails',
    );
    await rejected(
      h.first.send({
        draftId: state.source.draftId,
        operationId: 'delayed-old-edit',
        baseRevision: state.source.revision,
        edit: chance,
      }),
      'delayed old edit rejected',
    );
    equal(
      await h.inspect(),
      state,
      'delayed operations cannot affect record or successor',
    );
  });
  await scenario(async (h, edit) => {
    await edit(chance);
    await edit({
      kind: 'stage',
      slotId: 'right',
      choice: {
        choiceId: 'extra-work',
        actionId: 'special',
        instruction: 'Scout road',
        costCopper: 0,
      },
    });
    await edit({
      kind: 'acknowledge',
      acknowledgement: {
        acknowledgementId: 'scouted',
        subjectId: 'special:extra-work',
        outcome: 'Road scouted',
      },
    });
    await edit({
      kind: 'rules_exception',
      exception: {
        exceptionId: 'extra',
        subjectId: 'extra-work',
        ruleId: 'action-capacity',
        reason: 'Extra action requested',
      },
    });
    const blocked = await h.first.preview();
    check(
      blocked.status === 'incomplete' &&
        blocked.requirements.includes('extra-work:action-capacity'),
      'An occupied unavailable slot blocks Confirmation even with a reasoned exception',
    );
    const before = await h.inspect();
    await rejected(
      h.first.confirm({
        operationId: 'blocked-extra',
        reviewed: blocked.reviewed,
      }),
      'Server refuses unavailable-slot Confirmation',
    );
    equal(
      await h.inspect(),
      before,
      'Refused Confirmation preserves the entire staged week',
    );
    await edit({
      kind: 'move',
      fromSlotId: 'right',
      toSlotId: 'left',
      choiceId: 'extra-work',
    });
    const ready = await h.first.preview();
    check(
      ready.status === 'ready',
      'Moving into an allowed empty slot restores readiness',
    );
    await h.first.confirm({
      operationId: 'moved-extra',
      reviewed: ready.reviewed,
    });
    check(
      (await h.inspect()).records.length === 1,
      'The corrected week commits once',
    );
  });
  await scenario(async (h, edit) => {
    await edit(chance);
    const review = await h.first.preview();
    const results = await Promise.allSettled([
      h.first.confirm({ operationId: 'race-a', reviewed: review.reviewed }),
      h.second.confirm({ operationId: 'race-b', reviewed: review.reviewed }),
    ]);
    check(
      results.filter((result) => result.status === 'fulfilled').length === 1,
      'simultaneous confirmations advance once',
    );
    const state = await h.inspect();
    check(
      state.records.length === 1 &&
        state.openDrafts.length === 1 &&
        state.sourceRevision === 1,
      'race leaves one complete outcome',
    );
  });
  await scenario(async (h, edit) => {
    await edit(chance);
    const review = await h.first.preview();
    await h.changeSource('revision');
    const unchanged = await h.inspect();
    await rejected(
      h.first.confirm({
        operationId: 'external-revision',
        reviewed: review.reviewed,
      }),
      'numerically identical external source invalidates review',
    );
    equal(await h.inspect(), unchanged, 'stale revision changes nothing');
    const secondReview = await h.first.preview();
    await h.changeSource('treasury');
    const changed = await h.inspect();
    await rejected(
      h.first.confirm({
        operationId: 'external-treasury',
        reviewed: secondReview.reviewed,
      }),
      'external treasury invalidates review',
    );
    equal(await h.inspect(), changed, 'stale snapshot changes nothing');
    const fresh = await h.first.preview();
    const receipt = await h.first.confirm({
      operationId: 'external-fresh',
      reviewed: fresh.reviewed,
    });
    check(
      receipt.record.sourceMilitiaSnapshot?.treasuryCopper === 107,
      'explicit fresh review retains external change',
    );
  });
  await scenario(async (h, edit) => {
    await edit({
      kind: 'stage',
      slotId: 'left',
      choice: { choiceId: 'partial', actionId: 'special' },
    });
    const incomplete = await h.first.preview();
    check(
      incomplete.status === 'incomplete',
      'partial choice preview incomplete',
    );
    const before = await h.inspect();
    await rejected(
      h.first.confirm({
        operationId: 'incomplete',
        reviewed: incomplete.reviewed,
      }),
      'incomplete cannot confirm',
    );
    equal(await h.inspect(), before, 'incomplete retains all source');
  });
  await scenario(async (h, edit) => {
    await edit(chance);
    const started = deferred(),
      release = deferred();
    const workspace = createDraftPersistence({
      ...h.first,
      async send(operation) {
        started.resolve();
        await release.promise;
        return h.first.send(operation);
      },
    });
    await workspace.ready;
    const review = (await workspace.preview())!;
    const pending = workspace.edit({
      kind: 'event_chance',
      roll: {
        diceTotal: 99,
        diceCount: 1,
        sides: 100,
        provenance: { kind: 'table' },
        modifiers: [],
      },
    });
    await started.promise;
    check(
      (await workspace.preview()) === null,
      'pending forecast cannot provide accepted review',
    );
    const confirming = workspace.confirm(review);
    check(workspace.getSnapshot().confirming, 'barrier visible immediately');
    check(
      (await workspace.edit(chance)) === 'failed',
      'new local edits paused',
    );
    release.resolve();
    check((await pending) === 'accepted', 'earlier edit finishes');
    check(
      (await confirming) === 'failed',
      'barrier never substitutes just-flushed review',
    );
    check(
      (await h.inspect()).records.length === 0,
      'failed review commits nothing',
    );
    check(
      (await workspace.confirm((await workspace.preview())!)) === 'accepted',
      'fresh review and explicit attempt succeeds',
    );
    workspace.dispose();
  });
  await scenario(async (h, edit) => {
    await edit(chance);
    const review = await h.first.preview();
    await h.blockSuccessor('write-failure');
    const before = await h.inspect();
    await rejected(
      h.first.confirm({
        operationId: 'write-failure',
        reviewed: review.reviewed,
      }),
      'final successor write fails',
    );
    equal(
      await h.inspect(),
      before,
      'snapshot record and closure roll back after final write failure',
    );
    const fresh = await h.first.preview();
    await h.first.confirm({
      operationId: 'explicit-retry',
      reviewed: fresh.reviewed,
    });
    check(
      (await h.inspect()).records.length === 1,
      'explicit attempt succeeds after rollback',
    );
  });
  await scenario(async (h, edit) => {
    await edit(chance);
    let calls = 0;
    const workspace = createDraftPersistence({
      ...h.first,
      async confirm(operation) {
        const result = await h.first.confirm(operation);
        if (++calls === 1)
          throw new DraftTransportFailure('Acknowledgement dropped');
        return result;
      },
    });
    await workspace.ready;
    check(
      (await workspace.confirm((await workspace.preview())!)) === 'accepted',
      'lost confirmation acknowledgement retried',
    );
    check(
      calls === 2 && (await h.inspect()).records.length === 1,
      'retry uses same operation identity and advances once',
    );
    workspace.dispose();
  });
  await scenario(async (h, edit) => {
    await edit(chance);
    const review = await h.first.preview();
    const current = await h.second.read();
    const results = await Promise.allSettled([
      h.first.confirm({
        operationId: 'edit-confirm-race',
        reviewed: review.reviewed,
      }),
      h.second.send({
        draftId: current.draftId,
        operationId: 'racing-edit',
        baseRevision: current.revision,
        edit: {
          kind: 'event_chance',
          roll: {
            diceTotal: 99,
            diceCount: 1,
            sides: 100,
            provenance: { kind: 'table' },
            modifiers: [],
          },
        },
      }),
    ]);
    check(
      results.filter((result) => result.status === 'fulfilled').length === 1,
      'edit and confirmation cannot both commit reviewed revision',
    );
    const state = await h.inspect();
    if (results[0].status === 'fulfilled')
      check(
        state.source.status === 'closed' && state.records.length === 1,
        'confirmation race winner complete',
      );
    else
      check(
        state.source.status === 'open' &&
          state.records.length === 0 &&
          state.source.revision === current.revision + 1,
        'edit race winner stays open',
      );
  });
}
