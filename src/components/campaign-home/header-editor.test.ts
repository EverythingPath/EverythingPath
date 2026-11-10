import { describe, expect, test } from 'vitest';
import type { CampaignHeaderValues } from '~/lib/campaign-fields';
import {
  closedHeaderEditor,
  fieldFeedback,
  fieldView,
  headerEditorReducer as reduce,
  planHeaderSave,
  type HeaderAction,
  type HeaderEditor,
} from './header-editor';

const saved: CampaignHeaderValues = {
  description: 'Book 2.',
  inGameDate: '2026-03-22',
};

function run(start: HeaderEditor, ...actions: HeaderAction[]) {
  return actions.reduce(reduce, start);
}
const opened = () => run(closedHeaderEditor(saved), { type: 'open', saved });

function submit(state: HeaderEditor, observed = saved) {
  const plan = planHeaderSave(state, observed);
  if (plan.kind !== 'send')
    throw new Error(`expected writes, got ${plan.kind}`);
  return {
    plan,
    state: reduce(state, { type: 'submit', writes: plan.writes }),
  };
}

describe('planning a header Save', () => {
  test('sends both changed fields, or only the one that changed', () => {
    const both = run(
      opened(),
      { type: 'change', field: 'description', value: 'Book 3.' },
      { type: 'change', field: 'inGameDate', value: '2026-04-01' },
    );
    expect(planHeaderSave(both, saved)).toEqual({
      kind: 'send',
      writes: [
        { field: 'description', value: 'Book 3.' },
        { field: 'inGameDate', value: '2026-04-01' },
      ],
    });
    const one = run(opened(), {
      type: 'change',
      field: 'inGameDate',
      value: '',
    });
    expect(planHeaderSave(one, saved)).toEqual({
      kind: 'send',
      writes: [{ field: 'inGameDate', value: '' }],
    });
  });

  test('nothing is sent when no input differs from the saved values', () => {
    expect(planHeaderSave(opened(), saved)).toEqual({ kind: 'nothing' });
    const retyped = run(opened(), {
      type: 'change',
      field: 'description',
      value: 'Book 2.',
    });
    expect(planHeaderSave(retyped, saved)).toEqual({ kind: 'nothing' });
  });

  test('validates every field before sending any of them', () => {
    const state = run(
      opened(),
      { type: 'change', field: 'description', value: 'Book 3.' },
      { type: 'change', field: 'inGameDate', value: '2026-02-31' },
    );
    expect(planHeaderSave(state, saved)).toEqual({
      kind: 'invalid',
      errors: { inGameDate: 'Choose a valid in-game date.' },
    });
  });

  test('an unreadable stored date does not block saving the description', () => {
    const stored = { ...saved, inGameDate: '12 Pharast 4717' };
    const state = run(
      closedHeaderEditor(stored),
      { type: 'open', saved: stored },
      { type: 'change', field: 'description', value: 'Book 3.' },
    );
    expect(planHeaderSave(state, stored)).toEqual({
      kind: 'send',
      writes: [{ field: 'description', value: 'Book 3.' }],
    });
  });

  test('a Save while writes are pending sends nothing more', () => {
    const { state } = submit(
      run(opened(), { type: 'change', field: 'description', value: 'x' }),
    );
    expect(planHeaderSave(state, saved)).toEqual({ kind: 'busy' });
    expect(
      fieldFeedback(fieldView(state, saved, 'description'), 'description'),
    ).toBe('Saving description…');
    // Input is locked while its own write is pending.
    expect(
      reduce(state, { type: 'change', field: 'description', value: 'y' }),
    ).toBe(state);
  });
});

describe('acknowledgements', () => {
  const both = () =>
    submit(
      run(
        opened(),
        { type: 'change', field: 'description', value: 'Book 3.' },
        { type: 'change', field: 'inGameDate', value: '2026-04-01' },
      ),
    ).state;

  test('closes and reports Saved only after every intended change is accepted', () => {
    const first = reduce(both(), {
      type: 'accepted',
      field: 'inGameDate',
      value: '2026-04-01',
    });
    expect(first.open).toBe(true);
    expect(first.saved).toBe(false);
    const done = reduce(first, {
      type: 'accepted',
      field: 'description',
      value: 'Book 3.',
    });
    expect(done).toMatchObject({ open: false, saved: true, edits: {} });
  });

  test.each([
    [
      'description accepted, then the date rejected',
      ['description', 'inGameDate'],
    ],
    [
      'the date rejected, then description accepted',
      ['inGameDate', 'description'],
    ],
  ] as const)(
    '%s: reports each field and retries only the date',
    (_, order) => {
      let state = both();
      for (const field of order)
        state =
          field === 'description'
            ? reduce(state, { type: 'accepted', field, value: 'Book 3.' })
            : reduce(state, {
                type: 'rejected',
                field,
                value: '2026-04-01',
                message:
                  'Editing is paused for maintenance. Saved information remains available.',
              });
      // The description is now saved on the server.
      const observed = { ...saved, description: 'Book 3.' };
      expect(state.open).toBe(true);
      const description = fieldView(state, observed, 'description');
      const date = fieldView(state, observed, 'inGameDate');
      expect(fieldFeedback(description, 'description')).toBe(
        'Description saved.',
      );
      expect(date).toMatchObject({ value: '2026-04-01', dirty: true });
      expect(fieldFeedback(date, 'inGameDate')).toBe(
        "In-game date wasn't saved: Editing is paused for maintenance. Saved information remains available. Your date is kept. Save to try again.",
      );
      expect(planHeaderSave(state, observed)).toEqual({
        kind: 'send',
        writes: [{ field: 'inGameDate', value: '2026-04-01' }],
      });
    },
  );

  test.each([
    [
      'the date accepted, then description rejected',
      ['inGameDate', 'description'],
    ],
    [
      'description rejected, then the date accepted',
      ['description', 'inGameDate'],
    ],
  ] as const)('%s: retries only the description', (_, order) => {
    let state = both();
    for (const field of order)
      state =
        field === 'inGameDate'
          ? reduce(state, { type: 'accepted', field, value: '2026-04-01' })
          : reduce(state, {
              type: 'rejected',
              field,
              value: 'Book 3.',
              message: null,
            });
    const observed = { ...saved, inGameDate: '2026-04-01' };
    expect(
      fieldFeedback(fieldView(state, observed, 'description'), 'description'),
    ).toBe("Description wasn't saved. Your text is kept. Save to try again.");
    expect(planHeaderSave(state, observed)).toEqual({
      kind: 'send',
      writes: [{ field: 'description', value: 'Book 3.' }],
    });
    const retried = submit(state, observed).state;
    expect(
      reduce(retried, {
        type: 'accepted',
        field: 'description',
        value: 'Book 3.',
      }),
    ).toMatchObject({ open: false, saved: true });
  });

  test('a newer remote edit of the accepted field is never overwritten by the retry', () => {
    const state = run(
      both(),
      { type: 'accepted', field: 'description', value: 'Book 3.' },
      {
        type: 'rejected',
        field: 'inGameDate',
        value: '2026-04-01',
        message: null,
      },
    );
    // Another player changes the description after it was accepted.
    const observed = { ...saved, description: 'Book 4, from the GM.' };
    expect(fieldView(state, observed, 'description')).toMatchObject({
      value: 'Book 4, from the GM.',
      dirty: false,
      changedElsewhere: true,
    });
    expect(planHeaderSave(state, observed)).toEqual({
      kind: 'send',
      writes: [{ field: 'inGameDate', value: '2026-04-01' }],
    });
  });

  test('an unconfirmed write is reported honestly and settles against the observed value', () => {
    const state = run(
      opened(),
      { type: 'change', field: 'description', value: 'Book 3.' },
      { type: 'submit', writes: [{ field: 'description', value: 'Book 3.' }] },
      { type: 'unknown', field: 'description', value: 'Book 3.' },
    );
    const unconfirmed = fieldView(state, saved, 'description');
    expect(fieldFeedback(unconfirmed, 'description')).toBe(
      'Description may not have been saved. Your text is kept. Check it, then Save to try again.',
    );
    expect(state.open).toBe(true);
    const observed = { ...saved, description: 'Book 3.' };
    const matched = fieldView(state, observed, 'description');
    expect(matched.dirty).toBe(false);
    expect(fieldFeedback(matched, 'description')).toBe('Description saved.');
    expect(planHeaderSave(state, observed)).toEqual({ kind: 'nothing' });
  });

  test('Cancel after a partial save discards only unsaved input and undoes nothing', () => {
    const state = run(
      both(),
      { type: 'accepted', field: 'description', value: 'Book 3.' },
      {
        type: 'rejected',
        field: 'inGameDate',
        value: '2026-04-01',
        message: null,
      },
      { type: 'close' },
    );
    const observed = { ...saved, description: 'Book 3.' };
    expect(state).toMatchObject({ open: false, saved: false, edits: {} });
    expect(fieldView(state, observed, 'inGameDate').value).toBe('2026-03-22');
    const reopened = reduce(state, { type: 'open', saved: observed });
    expect(fieldView(reopened, observed, 'description').value).toBe('Book 3.');
    expect(planHeaderSave(reopened, observed)).toEqual({ kind: 'nothing' });
  });
});

describe('remote edits while the editor is open', () => {
  test('untouched fields follow the saved value and announce the change', () => {
    const state = opened();
    const observed = { ...saved, inGameDate: '2026-05-05' };
    const view = fieldView(state, observed, 'inGameDate');
    expect(view).toMatchObject({ value: '2026-05-05', dirty: false });
    expect(fieldFeedback(view, 'inGameDate')).toBe(
      'In-game date was updated on another device.',
    );
    expect(planHeaderSave(state, observed)).toEqual({ kind: 'nothing' });
  });

  test('unsaved input is kept and the saved change is announced', () => {
    const state = run(opened(), {
      type: 'change',
      field: 'description',
      value: 'Mine.',
    });
    const observed = { ...saved, description: 'Theirs.' };
    const view = fieldView(state, observed, 'description');
    expect(view).toMatchObject({ value: 'Mine.', dirty: true });
    expect(fieldFeedback(view, 'description')).toBe(
      'Description was changed on another device. Your unsaved change is kept.',
    );
  });

  test('clearing a description or date is an ordinary change', () => {
    const state = run(
      opened(),
      { type: 'change', field: 'description', value: '' },
      { type: 'change', field: 'inGameDate', value: '' },
    );
    expect(planHeaderSave(state, saved)).toEqual({
      kind: 'send',
      writes: [
        { field: 'description', value: '' },
        { field: 'inGameDate', value: '' },
      ],
    });
  });
});
