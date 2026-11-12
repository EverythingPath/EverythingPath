import { describe, expect, test } from 'vitest';
import type { Doc } from '@convex/_generated/dataModel';
import { classifyList, resolveSelection, type Opening } from './home-state';

const organization = { id: 'org', name: 'Thursday table' };
const campaign = (id: string, name = id) =>
  ({ _id: id, name, description: '', organizationId: 'org' }) as unknown as Doc<'campaign'>;
const alpha = campaign('alpha', 'Same name');
const beta = campaign('beta', 'Same name');

describe('the campaign list', () => {
  const member = { kind: 'member' as const, organization };

  test('is read only for a settled member session', () => {
    expect(classifyList({ kind: 'resolving' }, {})).toEqual({
      kind: 'resolving',
    });
    expect(classifyList({ kind: 'signed_out' }, {})).toEqual({
      kind: 'signed_out',
    });
    expect(classifyList({ kind: 'no_organization' }, {})).toEqual({
      kind: 'no_organization',
    });
  });

  test('distinguishes loading, failure, no access and an empty organization', () => {
    expect(classifyList(member, {})).toEqual({ kind: 'resolving' });
    expect(
      classifyList(member, {
        error: new Error('down'),
        data: { state: 'ready', campaigns: [] },
      }),
    ).toEqual({ kind: 'failed', organization });
    expect(classifyList(member, { data: { state: 'no_access' } })).toEqual({
      kind: 'no_access',
      organization,
    });
    expect(
      classifyList(member, { data: { state: 'ready', campaigns: [] } }),
    ).toEqual({ kind: 'ready', organization, campaigns: [] });
  });
});

describe('selection', () => {
  const base = {
    campaigns: [alpha, beta],
    organization,
    requested: null,
    creating: false,
    opening: null,
  };

  test('the bare list selects the first campaign in query order', () => {
    expect(resolveSelection(base)).toMatchObject({
      pane: { kind: 'campaign', campaign: alpha },
      selectedId: 'alpha',
      ghost: null,
    });
  });

  test('an explicit id selects that campaign, even with a duplicate name', () => {
    expect(resolveSelection({ ...base, requested: 'beta' })).toMatchObject({
      pane: { kind: 'campaign', campaign: beta },
      selectedId: 'beta',
    });
  });

  test('an unknown, deleted or foreign id is unavailable and never falls back', () => {
    expect(resolveSelection({ ...base, requested: 'foreign' })).toEqual({
      pane: { kind: 'unavailable', organization },
      selectedId: null,
      ghost: null,
      openingSettled: false,
    });
  });

  test('an empty organization offers the create entry, not a fake row', () => {
    expect(resolveSelection({ ...base, campaigns: [] })).toEqual({
      pane: { kind: 'create', entry: 'empty' },
      selectedId: null,
      ghost: null,
      openingSettled: false,
    });
  });

  test('New campaign shows the ghost row and form; leaving it restores the selection', () => {
    expect(
      resolveSelection({ ...base, requested: 'beta', creating: true }),
    ).toMatchObject({
      pane: { kind: 'create', entry: 'new' },
      selectedId: null,
      ghost: { kind: 'new' },
    });
    expect(
      resolveSelection({ ...base, campaigns: [], creating: true }).pane,
    ).toEqual({ kind: 'create', entry: 'new' });
  });

  describe('after a create is acknowledged', () => {
    const opening: Opening = {
      campaignId: 'created',
      name: 'Same name',
      from: 'beta',
    };

    test('waits for the address and the list instead of flashing another state', () => {
      const beforeNavigation = resolveSelection({
        ...base,
        requested: 'beta',
        opening,
      });
      expect(beforeNavigation).toEqual({
        pane: { kind: 'opening', name: 'Same name' },
        selectedId: null,
        ghost: { kind: 'opening', name: 'Same name' },
        openingSettled: false,
      });
      const beforeObservation = resolveSelection({
        ...base,
        requested: 'created',
        opening,
      });
      expect(beforeObservation.pane).toEqual({
        kind: 'opening',
        name: 'Same name',
      });
      expect(beforeObservation.openingSettled).toBe(false);
    });

    test('selects the returned id once observed, never a same-named campaign', () => {
      const created = campaign('created', 'Same name');
      expect(
        resolveSelection({
          ...base,
          campaigns: [alpha, beta, created],
          requested: 'created',
          opening,
        }),
      ).toEqual({
        pane: { kind: 'campaign', campaign: created },
        selectedId: 'created',
        ghost: null,
        openingSettled: true,
      });
    });

    test('moving to another campaign abandons the wait', () => {
      expect(
        resolveSelection({ ...base, requested: 'alpha', opening }),
      ).toMatchObject({
        pane: { kind: 'campaign', campaign: alpha },
        openingSettled: true,
      });
    });
  });
});
