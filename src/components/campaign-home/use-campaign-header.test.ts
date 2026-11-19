import { act, renderHook } from '@testing-library/react';
import type { FunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Doc } from '@convex/_generated/dataModel';
import { useCampaignHeader } from './use-campaign-header';
import { convexNames } from '../../../tests/convex-names';
import { api } from '@convex/_generated/api';

type Deferred = {
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
const sent: Record<'description' | 'date', Deferred[]> = {
  description: [],
  date: [],
};
function mutation(kind: 'description' | 'date') {
  return (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      sent[kind].push({ args, resolve, reject });
    });
}
const nameOf = convexNames({
  description: api.campaign.updateCampaignDescription,
  date: api.campaign.updateCampaignInGameDate,
});
vi.mock('convex/react', () => ({
  useMutation: (reference: FunctionReference<'mutation'>) => {
    const name = nameOf(reference);
    if (name !== 'description' && name !== 'date')
      throw new Error(`Unexpected mutation ${name}`);
    return mutation(name);
  },
}));

const campaign = (patch: Partial<Doc<'campaign'>> = {}) =>
  ({
    _id: 'alpha',
    name: 'Ironfang Invasion',
    description: 'Book 2.',
    inGameDate: '2026-03-22',
    organizationId: 'org',
    ...patch,
  }) as Doc<'campaign'>;

beforeEach(() => {
  sent.description = [];
  sent.date = [];
});

function render(initial = campaign()) {
  return renderHook(({ doc }) => useCampaignHeader(doc, 'org'), {
    initialProps: { doc: initial },
  });
}

test('Save sends only changed fields, each to its own mutation for the original scope', () => {
  const view = render();
  act(() => view.result.current.edit());
  act(() => view.result.current.fields.inGameDate.change(''));
  act(() => view.result.current.save());
  expect(sent.description).toEqual([]);
  // Clearing sends no date, which the existing mutation stores as no date.
  expect(sent.date.map((call) => call.args)).toEqual([
    { campaignId: 'alpha', organizationId: 'org' },
  ]);
  expect(view.result.current.pending).toBe(true);
});

test('with nothing changed, Save closes without writing', () => {
  const view = render();
  act(() => view.result.current.edit());
  act(() => view.result.current.save());
  expect(sent.description.length + sent.date.length).toBe(0);
  expect(view.result.current.editing).toBe(false);
  expect(view.result.current.saved).toBe(false);
});

test('a partial save keeps the editor open, reports each field and retries only the failed one', async () => {
  const view = render();
  act(() => view.result.current.edit());
  act(() => view.result.current.fields.description.change('Book 3.'));
  act(() => view.result.current.fields.inGameDate.change('2026-04-01'));
  act(() => view.result.current.save());
  expect(sent.description[0]?.args).toEqual({
    campaignId: 'alpha',
    organizationId: 'org',
    description: 'Book 3.',
  });
  expect(sent.date[0]?.args).toEqual({
    campaignId: 'alpha',
    organizationId: 'org',
    inGameDate: '2026-04-01',
  });
  // The date is refused first, then the description is accepted.
  await act(async () => {
    sent.date[0]!.reject(new ConvexError('Campaign editing is paused'));
    sent.description[0]!.resolve(campaign({ description: 'Book 3.' }));
  });
  view.rerender({ doc: campaign({ description: 'Book 3.' }) });
  const { fields } = view.result.current;
  expect(view.result.current.editing).toBe(true);
  expect(fields.description.feedback).toBe('Description saved.');
  expect(fields.inGameDate.feedback).toBe(
    "In-game date wasn't saved: Campaign editing is paused. Your date is kept. Save to try again.",
  );
  expect(fields.inGameDate.value).toBe('2026-04-01');

  act(() => view.result.current.save());
  expect(sent.description).toHaveLength(1);
  expect(sent.date).toHaveLength(2);
  await act(async () => {
    sent.date[1]!.resolve(campaign({ inGameDate: '2026-04-01' }));
  });
  expect(view.result.current.editing).toBe(false);
  expect(view.result.current.saved).toBe(true);
});

test('an unconfirmed write is not claimed as failed and is not resent once observed', async () => {
  const view = render();
  act(() => view.result.current.edit());
  act(() => view.result.current.fields.description.change('Book 3.'));
  act(() => view.result.current.save());
  await act(async () => {
    sent.description[0]!.reject(
      new Error('ConvexClient has already been closed.'),
    );
  });
  expect(view.result.current.fields.description.feedback).toBe(
    'Description may not have been saved. Your text is kept. Check it, then Save to try again.',
  );
  view.rerender({ doc: campaign({ description: 'Book 3.' }) });
  expect(view.result.current.fields.description.feedback).toBe(
    'Description saved.',
  );
  act(() => view.result.current.save());
  expect(sent.description).toHaveLength(1);
  expect(view.result.current.editing).toBe(false);
});

test('a remote edit refreshes the closed header and is acknowledged', () => {
  const view = render();
  view.rerender({ doc: campaign({ description: 'From the GM.' }) });
  expect(view.result.current.fields.description.value).toBe('From the GM.');
  expect(view.result.current.updated).toBe(true);
});
