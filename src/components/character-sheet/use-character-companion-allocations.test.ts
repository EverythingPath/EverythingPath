import { act, renderHook } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { getFunctionName } from 'convex/server';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildSheet } from './character-sheet-test-fixture';
import type { CompanionAllocationPoolRow } from './character-companion-allocations-view-model';
import { useCharacterCompanionAllocations } from './use-character-companion-allocations';

const server = vi.hoisted(() => ({
  pools: [] as unknown[] | undefined,
  write: vi.fn(),
  readOnly: false,
}));
vi.mock('convex/react', () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (args === 'skip') return undefined;
    const name = getFunctionName(reference);
    if (name === 'companionRelationships:listAllocationPools')
      return server.pools;
    throw new Error(`Unexpected query: ${name}`);
  },
  useMutation:
    (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) =>
      server.write(getFunctionName(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({ readOnly: server.readOnly }),
}));

const member = {
  relationshipId: 'fang' as Id<'companionRelationship'>,
  sourceKey: 'beast-master',
  levels: null as number | null,
  counting: true,
  companion: { characterId: 'wolf' as Id<'character'>, name: 'Fang' },
  lastOperationId: 'seed',
};
const pool = {
  kind: 'allocation',
  ruleKind: 'beastMasterCompanion',
  label: 'Beast Master',
  classRuleIdentity: 'ranger',
  classLevels: 7,
  budget: 4,
  allocated: 1,
  remaining: 3,
  overBudget: false,
  restriction: 'Beast Master divides its effective druid level.',
  sources: [],
  members: [
    member,
    {
      ...member,
      relationshipId: 'claw' as Id<'companionRelationship'>,
      levels: 1,
      companion: { characterId: 'claw' as Id<'character'>, name: 'Claw' },
    },
  ],
} satisfies CompanionAllocationPoolRow;

function render() {
  const snapshot = buildSheet();
  return renderHook(() =>
    useCharacterCompanionAllocations({
      scope: { characterId: snapshot.character._id },
      snapshot,
    }),
  );
}

/** The listed share at this position of the one divided budget. */
function share(
  controller: ReturnType<typeof useCharacterCompanionAllocations>,
  index: number,
) {
  const listed = controller.pools?.[0];
  const found =
    listed?.kind === 'allocation' ? listed.members[index] : undefined;
  if (!found) throw new Error(`Missing share ${index}`);
  return found;
}

beforeEach(() => {
  server.pools = [pool];
  server.readOnly = false;
  server.write.mockReset().mockResolvedValue(null);
});

test('an unallocated share is prefilled with the budget left over and saved as a whole number', async () => {
  const { result } = render();
  expect(result.current.pools).toMatchObject([
    { label: 'Beast Master', remainingLabel: '3 unallocated' },
  ]);
  const fang = share(result.current, 0);
  act(() => result.current.openEditor(fang));
  expect(result.current.editor).toMatchObject({ key: 'fang/beast-master' });
  expect(result.current.form.getValues('levels')).toBe('3');
  act(() => result.current.form.setValue('levels', '2'));
  await act(async () => {
    expect(await result.current.submit()).toBe(true);
  });
  expect(server.write).toHaveBeenCalledWith(
    'companionRelationships:setSourceAllocation',
    expect.objectContaining({
      relationshipId: 'fang',
      sourceKey: 'beast-master',
      levels: 2,
      operationId: expect.any(String),
    }),
  );
  expect(result.current.editor).toBeNull();
  expect(result.current.statusFor('fang/beast-master')).toEqual({
    kind: 'saved',
  });
});

test('empty and malformed shares are refused with distinct messages', async () => {
  const { result } = render();
  act(() => result.current.openEditor(share(result.current, 1)));
  expect(result.current.form.getValues('levels')).toBe('1');
  for (const [value, message] of [
    ['', 'Enter the effective levels to allocate.'],
    ['two', 'Enter a whole number from 0 to 20.'],
    ['1.5', 'Enter a whole number from 0 to 20.'],
    ['21', 'Enter a whole number from 0 to 20.'],
  ] as const) {
    act(() => result.current.form.setValue('levels', value));
    await act(async () => {
      expect(await result.current.submit()).toBe(false);
    });
    expect(result.current.fieldErrors.levels?.message).toBe(message);
  }
  expect(server.write).not.toHaveBeenCalled();
});

test('a refused write keeps the draft open and another device’s change raises a notice without replacing it', async () => {
  const { result, rerender } = render();
  act(() => result.current.openEditor(share(result.current, 0)));
  act(() => result.current.form.setValue('levels', '4'));
  server.write.mockRejectedValueOnce(new Error('Network'));
  await act(async () => {
    expect(await result.current.submit()).toBe(false);
  });
  expect(result.current.editor).not.toBeNull();
  expect(result.current.form.getValues('levels')).toBe('4');
  expect(result.current.statusFor('fang/beast-master')).toMatchObject({
    kind: 'error',
  });
  server.pools = [
    {
      ...pool,
      allocated: 3,
      remaining: 1,
      members: [
        { ...member, levels: 2, lastOperationId: 'other-device' },
        pool.members[1],
      ],
    },
  ];
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
  expect(result.current.form.getValues('levels')).toBe('4');
  act(() => result.current.dismissRemoteChange());
  expect(result.current.hasRemoteChange).toBe(false);
});

test('a share that left the budget is not written, clearing records no share and maintenance disables writes', async () => {
  const { result, rerender } = render();
  act(() => result.current.openEditor(share(result.current, 0)));
  server.pools = [{ ...pool, members: [pool.members[1]] }];
  rerender();
  await act(async () => {
    expect(await result.current.submit()).toBe(false);
  });
  expect(result.current.fieldErrors.levels?.message).toBe(
    'This companion no longer shares this budget.',
  );
  act(() => result.current.closeEditor());
  await act(async () => {
    expect(await result.current.clear(share(result.current, 0))).toBe(true);
  });
  expect(server.write).toHaveBeenCalledWith(
    'companionRelationships:setSourceAllocation',
    expect.objectContaining({ relationshipId: 'claw', levels: null }),
  );
  server.readOnly = true;
  rerender();
  expect(result.current.isDisabled).toBe(true);
  act(() => result.current.openEditor(share(result.current, 0)));
  expect(result.current.editor).toBeNull();
});

// UM p. 78, Broodmaster: a brood divides one summoner level's components.
const broodMember = {
  relationshipId: 'brute' as Id<'companionRelationship'>,
  sourceKey: 'brood',
  components: null as Record<string, number> | null,
  counting: true,
  companion: { characterId: 'brute' as Id<'character'>, name: 'Brute' },
  lastOperationId: 'seed',
};
const whole = {
  hitDice: 2,
  skillRanks: 8,
  feats: 1,
  armorBonus: 2,
  strengthBonus: 1,
  dexterityBonus: 1,
  evolutionPoints: 4,
  maxAttacks: 3,
};
const recorded = {
  hitDice: 1,
  skillRanks: 4,
  feats: 0,
  armorBonus: 1,
  strengthBonus: 0,
  dexterityBonus: 1,
  evolutionPoints: 2,
  maxAttacks: 1,
};
const broodPool = {
  kind: 'component',
  ruleKind: 'broodmasterEidolon',
  label: 'Broodmaster',
  classRuleIdentity: 'summoner',
  classLevels: 2,
  budget: whole,
  allocated: recorded,
  remaining: {
    hitDice: 1,
    skillRanks: 4,
    feats: 1,
    armorBonus: 1,
    strengthBonus: 1,
    dexterityBonus: 0,
    evolutionPoints: 2,
    maxAttacks: 2,
  },
  overBudget: false,
  overBudgetComponents: [],
  groupPurchases: [],
  capacity: { allowed: 2, used: 2 },
  restriction: 'Broodmaster eidolons share BAB and saves.',
  sources: [],
  members: [
    broodMember,
    {
      ...broodMember,
      relationshipId: 'skitter' as Id<'companionRelationship'>,
      components: recorded,
      companion: { characterId: 'skitter' as Id<'character'>, name: 'Skitter' },
    },
  ],
} satisfies CompanionAllocationPoolRow;

function eidolon(
  controller: ReturnType<typeof useCharacterCompanionAllocations>,
  index: number,
) {
  const listed = controller.pools?.[0];
  const found =
    listed?.kind === 'component' ? listed.members[index] : undefined;
  if (!found) throw new Error(`Missing eidolon ${index}`);
  return found;
}

test('a brood eidolon’s components are prefilled with what is left and saved together', async () => {
  server.pools = [broodPool];
  const { result } = render();
  expect(result.current.pools?.[0]).toMatchObject({
    kind: 'component',
    budgetSourceLabel: 'Summoner 2',
    budgetLabel: '2 Hit Dice to divide',
    members: [
      { name: 'Brute', componentsLabel: 'Not allocated' },
      { name: 'Skitter', missing: [] },
    ],
  });
  act(() => result.current.openComponentEditor(eidolon(result.current, 0)));
  expect(result.current.componentEditor).toMatchObject({ key: 'brute/brood' });
  expect(result.current.componentForm.getValues()).toMatchObject({
    hitDice: '1',
    feats: '1',
    dexterityBonus: '',
  });
  act(() => result.current.componentForm.setValue('dexterityBonus', 'x'));
  await act(async () => {
    expect(await result.current.submitComponents()).toBe(false);
  });
  expect(result.current.componentFieldErrors.dexterityBonus?.message).toBe(
    'Enter a whole number from 0 to 99.',
  );
  act(() => result.current.componentForm.setValue('dexterityBonus', ''));
  await act(async () => {
    expect(await result.current.submitComponents()).toBe(false);
  });
  expect(result.current.componentFieldErrors.dexterityBonus?.message).toBe(
    'Enter the Dexterity bonus to allocate.',
  );
  act(() => result.current.componentForm.setValue('dexterityBonus', '0'));
  await act(async () => {
    expect(await result.current.submitComponents()).toBe(true);
  });
  expect(server.write).toHaveBeenCalledWith(
    'companionRelationships:setSourceAllocation',
    expect.objectContaining({
      relationshipId: 'brute',
      sourceKey: 'brood',
      components: {
        hitDice: 1,
        skillRanks: 4,
        feats: 1,
        armorBonus: 1,
        strengthBonus: 1,
        dexterityBonus: 0,
        evolutionPoints: 2,
        maxAttacks: 2,
      },
    }),
  );
  expect(result.current.componentEditor).toBeNull();
});

test('a group purchase is recorded once for the brood and can be removed', async () => {
  server.pools = [broodPool];
  const { result, rerender } = render();
  await act(async () => {
    expect(
      await result.current.setGroupPurchase({
        ruleKind: 'broodmasterEidolon',
        key: 'large',
        purchased: true,
      }),
    ).toBe(true);
  });
  expect(server.write).toHaveBeenCalledWith(
    'companionRelationships:setGroupPurchases',
    expect.objectContaining({
      ruleKind: 'broodmasterEidolon',
      purchases: ['large'],
    }),
  );
  server.pools = [
    {
      ...broodPool,
      groupPurchases: [
        {
          key: 'large',
          label: 'Large evolution',
          cost: 4,
          minimumLevel: 8,
          issues: ['Requires summoner level 8.'],
        },
      ],
    },
  ];
  rerender();
  expect(result.current.pools?.[0]).toMatchObject({
    groupPurchases: [
      { key: 'large', purchased: true, issues: ['Requires summoner level 8.'] },
      { key: 'huge', purchased: false },
    ],
  });
  await act(async () => {
    await result.current.setGroupPurchase({
      ruleKind: 'broodmasterEidolon',
      key: 'large',
      purchased: false,
    });
  });
  expect(server.write).toHaveBeenLastCalledWith(
    'companionRelationships:setGroupPurchases',
    expect.objectContaining({ purchases: [] }),
  );
});
