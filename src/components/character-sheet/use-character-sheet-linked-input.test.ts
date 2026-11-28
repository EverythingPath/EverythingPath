import { act, renderHook, waitFor } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { getFunctionName } from 'convex/server';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  useCharacterSheetLinkedInput,
  type LinkedInputSnapshot,
} from './use-character-sheet-linked-input';
import type { CompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';

const server = vi.hoisted(() => ({
  result: undefined as LinkedInputSnapshot | undefined,
  write: vi.fn(),
  readOnly: false,
}));
vi.mock('convex/react', () => ({
  useQuery: (_reference: unknown, args: unknown) =>
    args === 'skip' ? undefined : server.result,
  useMutation:
    (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) =>
      server.write(getFunctionName(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({ readOnly: server.readOnly }),
}));

const scope = {
  characterId: 'companion' as Id<'character'>,
  relationshipId: 'bond' as Id<'companionRelationship'>,
  input: { kind: 'characterLevel' as const },
};
const unavailable = {
  input: scope.input,
  status: 'unavailable',
  resolution: 'unresolved',
  value: null,
  fallback: null,
  fallbackState: 'none',
  candidates: [],
  contributions: [],
  prerequisiteStatus: 'unresolved',
  interpretation: null,
  revision: 1,
  lastOperationId: 'seed',
  updatedBy: null,
  sources: [],
  unavailableReason: 'interrupted',
} satisfies LinkedInputSnapshot;

beforeEach(() => {
  server.result = unavailable;
  server.readOnly = false;
  server.write.mockReset().mockResolvedValue(null);
});

test('remote restoration suspends a saved fallback without overwriting the open draft', async () => {
  server.result = {
    ...unavailable,
    fallback: 7,
    fallbackState: 'applied',
    value: 7,
  };
  const { result, rerender } = renderHook(() =>
    useCharacterSheetLinkedInput({ scope, snapshot: server.result }),
  );
  act(() => result.current.openFallback());
  expect(result.current.form.getValues('value')).toBe('7');
  act(() => result.current.form.setValue('value', '9'));
  server.result = {
    ...unavailable,
    status: 'available',
    resolution: 'calculated',
    value: 3,
    fallback: 7,
    fallbackState: 'suspended',
    prerequisiteStatus: 'resolved',
    lastOperationId: 'other-player',
    revision: 2,
  };
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
  expect(result.current.form.getValues('value')).toBe('9');
  expect(result.current.editor).toBe('fallback');
  act(() => result.current.dismissRemoteChange());
  expect(result.current.hasRemoteChange).toBe(false);
  await act(async () => expect(await result.current.submit()).toBe(true));
  const operationId = server.write.mock.calls[0]![1].operationId;
  server.result = {
    ...unavailable,
    fallback: 9,
    fallbackState: 'applied',
    value: 9,
    lastOperationId: operationId,
    revision: 3,
  };
  rerender();
  expect(result.current.hasRemoteChange).toBe(false);
  server.result = {
    ...unavailable,
    status: 'available',
    resolution: 'calculated',
    value: 4,
    fallback: 9,
    fallbackState: 'suspended',
    prerequisiteStatus: 'resolved',
    lastOperationId: operationId,
    revision: 3,
  };
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
  expect(result.current.view?.fallbackExplanation).toBe(
    'Saved fallback 9 is suspended while Character level can be calculated. Saved for when the value is unavailable.',
  );
});

test('conflicting inputs show named choices and refuse interpretations lost while editing', async () => {
  const conflict = {
    ...unavailable,
    status: 'conflicting',
    unavailableReason: null,
    candidates: [
      { sourceKey: 'bond', kind: 'available', value: 3 },
      { sourceKey: 'archetype', kind: 'available', value: 5 },
    ],
    sources: [
      { key: 'bond', label: 'Arcane Bond' },
      { key: 'archetype', label: 'Archetype' },
    ],
  } satisfies LinkedInputSnapshot;
  server.result = conflict;
  const { result, rerender } = renderHook(() =>
    useCharacterSheetLinkedInput({ scope, snapshot: server.result }),
  );
  expect(result.current.view).toMatchObject({
    label: 'Character level',
    valueLabel: 'Unresolved',
    explanation:
      'Character level has conflicting rules. Choose an interpretation or enter a fallback for this value.',
    canChooseInterpretation: true,
    options: [
      { sourceKey: 'bond', label: 'Arcane Bond', value: 3 },
      { sourceKey: 'archetype', label: 'Archetype', value: 5 },
    ],
  });
  act(() => result.current.openInterpretation());
  await act(async () => expect(await result.current.submit()).toBe(false));
  expect(result.current.fieldErrors.sourceKey?.message).toBe(
    'Choose an interpretation.',
  );
  act(() => result.current.form.setValue('sourceKey', 'bond'));
  const remainingCandidate = conflict.candidates[1];
  const remainingSource = conflict.sources[1];
  if (!remainingCandidate || !remainingSource)
    throw new Error('Fixture interpretation missing');
  server.result = {
    ...conflict,
    candidates: [remainingCandidate],
    sources: [remainingSource],
  };
  rerender();
  await act(async () => expect(await result.current.submit()).toBe(false));
  expect(result.current.fieldErrors.sourceKey?.message).toBe(
    'Choose an available interpretation.',
  );
  expect(server.write).not.toHaveBeenCalled();
  act(() => result.current.form.setValue('sourceKey', 'archetype'));
  await act(async () => expect(await result.current.submit()).toBe(true));
  expect(server.write).toHaveBeenLastCalledWith(
    'characterSheetLinkedInputs:saveInterpretation',
    { ...scope, sourceKey: 'archetype', operationId: expect.any(String) },
  );
});

test('clearing a fallback or interpretation uses its exact scope and preserves zero values', async () => {
  server.result = {
    ...unavailable,
    value: 0,
    fallback: 0,
    fallbackState: 'applied',
    interpretation: { sourceKey: 'bond' },
  };
  const { result, rerender } = renderHook(() =>
    useCharacterSheetLinkedInput({
      scope: { ...scope, projection: 'permanent' },
      snapshot: server.result,
    }),
  );
  expect(result.current.view).toMatchObject({
    valueLabel: '0',
    hasFallback: true,
    hasInterpretation: true,
  });
  act(() => result.current.openFallback());
  expect(result.current.form.getValues('value')).toBe('0');
  await act(async () =>
    expect(await result.current.clearFallback()).toBe(true),
  );
  expect(server.write).toHaveBeenLastCalledWith(
    'characterSheetLinkedInputs:clearFallback',
    { ...scope, operationId: expect.any(String) },
  );
  await act(async () =>
    expect(await result.current.clearInterpretation()).toBe(true),
  );
  expect(server.write).toHaveBeenLastCalledWith(
    'characterSheetLinkedInputs:clearInterpretation',
    { ...scope, operationId: expect.any(String) },
  );
  server.result = {
    ...unavailable,
    unavailableReason: 'inaccessible',
    sources: [],
  };
  rerender();
  expect(result.current.view).toMatchObject({
    explanation:
      'Character level is unavailable because the linked Character cannot be accessed.',
    options: [],
    canChooseInterpretation: false,
  });
});

test('loading or unavailable sheets cannot open editors or issue writes', async () => {
  server.result = undefined;
  const { result, rerender } = renderHook(
    ({ available }) =>
      useCharacterSheetLinkedInput({
        scope,
        snapshot: available ? server.result : undefined,
        isAvailable: available,
      }),
    { initialProps: { available: true } },
  );
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isDisabled).toBe(true);
  act(() => result.current.openFallback());
  expect(result.current.editor).toBe(null);
  await act(async () =>
    expect(await result.current.clearFallback()).toBe(false),
  );
  rerender({ available: false });
  expect(result.current.isLoading).toBe(false);
  expect(result.current.view).toBe(null);
  expect(server.write).not.toHaveBeenCalled();
});

test('saved interpretations explain the resolved value and additions never become interpretation choices', async () => {
  const input = {
    kind: 'classLevels',
    classRuleIdentity: 'internal-wizard-key',
  } as const;
  server.result = {
    ...unavailable,
    input,
    status: 'conflicting',
    resolution: 'interpretation',
    value: 4,
    fallback: 9,
    fallbackState: 'suspended',
    interpretation: { sourceKey: 'bond' },
    candidates: [
      { sourceKey: 'bond', kind: 'available', value: 3 },
      { sourceKey: 'addition', kind: 'available', value: 1, role: 'addition' },
    ],
    sources: [
      { key: 'bond', label: 'Arcane Bond' },
      { key: 'addition', label: 'Extra training' },
    ],
  };
  const { result } = renderHook(() =>
    useCharacterSheetLinkedInput({
      scope: { ...scope, input },
      snapshot: server.result,
      classLabel: 'Wizard',
    }),
  );
  expect(result.current.view).toMatchObject({
    label: 'Wizard class levels',
    valueLabel: '4',
    explanation: 'Wizard class levels uses the saved interpretation.',
    options: [{ sourceKey: 'bond', label: 'Arcane Bond', value: 3 }],
    fallbackExplanation:
      'Saved fallback 9 is suspended while Wizard class levels can be calculated. Saved for when the value is unavailable.',
  });
  act(() => result.current.openInterpretation());
  act(() => result.current.form.setValue('sourceKey', 'addition'));
  await act(async () => expect(await result.current.submit()).toBe(false));
  expect(result.current.fieldErrors.sourceKey?.message).toBe(
    'Choose an available interpretation.',
  );
  expect(server.write).not.toHaveBeenCalled();
});

test('an available alternative can resolve an input when the other alternative is missing', async () => {
  server.result = {
    ...unavailable,
    unavailableReason: 'missingInput',
    candidates: [
      { sourceKey: 'bond', kind: 'available', value: 3 },
      { sourceKey: 'missing', kind: 'unavailable', reason: 'missingInput' },
    ],
    sources: [{ key: 'bond', label: 'Arcane Bond' }],
  };
  const { result } = renderHook(() =>
    useCharacterSheetLinkedInput({ scope, snapshot: server.result }),
  );
  expect(result.current.view?.canChooseInterpretation).toBe(true);
  act(() => result.current.openInterpretation());
  act(() => result.current.form.setValue('sourceKey', 'bond'));
  let saving: Promise<boolean> | undefined;
  let cleared: Promise<boolean> | undefined;
  act(() => {
    saving = result.current.submit();
    cleared = result.current.clearFallback();
  });
  await act(async () => {
    expect(await saving).toBe(true);
    expect(await cleared).toBe(false);
  });
  expect(server.write).toHaveBeenCalledOnce();
  expect(server.write).toHaveBeenCalledWith(
    'characterSheetLinkedInputs:saveInterpretation',
    { ...scope, sourceKey: 'bond', operationId: expect.any(String) },
  );
});

test('maintenance fences old handlers and old saves cannot close an editor for a different input', async () => {
  const { result, rerender } = renderHook<
    ReturnType<typeof useCharacterSheetLinkedInput>,
    { input: CompanionLinkedInput }
  >(
    ({ input }: { input: CompanionLinkedInput }) =>
      useCharacterSheetLinkedInput({
        scope: { ...scope, input },
        snapshot: server.result,
      }),
    { initialProps: { input: scope.input } },
  );
  act(() => result.current.openFallback());
  act(() => result.current.form.setValue('value', '8'));
  const oldSubmit = result.current.submit;
  const oldClear = result.current.clearFallback;
  server.readOnly = true;
  rerender({ input: scope.input });
  await act(async () => {
    expect(await oldSubmit()).toBe(false);
    expect(await oldClear()).toBe(false);
  });
  expect(server.write).not.toHaveBeenCalled();
  expect(result.current.form.getValues('value')).toBe('8');
  server.readOnly = false;
  rerender({ input: scope.input });
  let finish: (() => void) | undefined;
  server.write.mockReturnValueOnce(
    new Promise<null>((resolve) => {
      finish = () => resolve(null);
    }),
  );
  let saving: Promise<boolean> | undefined;
  act(() => {
    saving = result.current.submit();
  });
  await waitFor(() => expect(result.current.status.kind).toBe('saving'));
  await act(async () => expect(await result.current.submit()).toBe(false));
  rerender({ input: { kind: 'actualHitDice' } });
  expect(result.current.editor).toBe(null);
  act(() => result.current.openFallback());
  act(() => result.current.form.setValue('value', '11'));
  await act(async () => {
    finish?.();
    await saving;
  });
  expect(result.current.editor).toBe('fallback');
  expect(result.current.form.getValues('value')).toBe('11');
  expect(result.current.status.kind).toBe('idle');
  await act(async () => expect(await oldClear()).toBe(false));
});

test('equivalent named inputs retain the open fallback draft when their property order changes', () => {
  const input = {
    kind: 'classLevels',
    classRuleIdentity: 'class:wizard',
  } as const;
  server.result = { ...unavailable, input };
  const { result, rerender } = renderHook(
    ({ input }: { input: CompanionLinkedInput }) =>
      useCharacterSheetLinkedInput({
        scope: { ...scope, input },
        snapshot: server.result,
      }),
    { initialProps: { input } },
  );
  act(() => result.current.openFallback());
  act(() => result.current.form.setValue('value', '-4'));

  rerender({
    input: { classRuleIdentity: 'class:wizard', kind: 'classLevels' },
  });

  expect(result.current.editor).toBe('fallback');
  expect(result.current.form.getValues('value')).toBe('-4');
});

test('fallback editing distinguishes an empty value from invalid numeric text and retains refused input', async () => {
  const { result } = renderHook(() =>
    useCharacterSheetLinkedInput({ scope, snapshot: server.result }),
  );
  act(() => result.current.openFallback());
  await act(async () => expect(await result.current.submit()).toBe(false));
  expect(result.current.fieldErrors.value?.message).toBe(
    'Enter a fallback value.',
  );
  act(() => result.current.form.setValue('value', 'not a number'));
  await act(async () => expect(await result.current.submit()).toBe(false));
  expect(result.current.fieldErrors.value?.message).toBe(
    'Enter a finite whole number.',
  );
  act(() => result.current.form.setValue('value', '2.5'));
  await act(async () => expect(await result.current.submit()).toBe(false));
  expect(result.current.fieldErrors.value?.message).toBe(
    'Enter a finite whole number.',
  );
  expect(server.write).not.toHaveBeenCalled();
  act(() => result.current.form.setValue('value', ' 7 '));
  server.write.mockRejectedValueOnce(new Error('Connection lost'));
  await act(async () => expect(await result.current.submit()).toBe(false));
  expect(result.current.editor).toBe('fallback');
  expect(result.current.form.getValues('value')).toBe(' 7 ');
  expect(result.current.status).toEqual({
    kind: 'error',
    message:
      'Linked input may not have been saved. Check it before trying again.',
  });
  await act(async () => expect(await result.current.submit()).toBe(true));
  expect(server.write).toHaveBeenLastCalledWith(
    'characterSheetLinkedInputs:saveFallback',
    { ...scope, value: 7, operationId: expect.any(String) },
  );
  expect(result.current.editor).toBe(null);
});

test.each(['1e3', '0x10'])(
  'fallback editing rejects non-decimal integer syntax %s',
  async (value) => {
    const { result } = renderHook(() =>
      useCharacterSheetLinkedInput({ scope, snapshot: server.result }),
    );
    act(() => result.current.openFallback());
    act(() => result.current.form.setValue('value', value));
    await act(async () => expect(await result.current.submit()).toBe(false));
    expect(result.current.fieldErrors.value?.message).toBe(
      'Enter a finite whole number.',
    );
    expect(server.write).not.toHaveBeenCalled();
  },
);
