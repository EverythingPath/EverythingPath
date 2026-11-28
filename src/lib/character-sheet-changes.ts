type SheetStates<Value> = Readonly<Record<string, Value>> | null;

export function detectRemoteSheetChange<Value extends boolean | string>({
  previous,
  next,
  expectedOperations,
  isOwnOperation,
}: {
  previous: SheetStates<Value>;
  next: SheetStates<Value>;
  expectedOperations: ReadonlyMap<string, { value: Value }>;
  isOwnOperation: boolean;
}) {
  const previousKeys = Object.keys(previous ?? {});
  const nextEntries = Object.entries(next ?? {});
  const changedFacts =
    previousKeys.length !== nextEntries.length ||
    previousKeys.some((key) => !Object.hasOwn(next ?? {}, key));
  const changedValues = nextEntries.filter(
    ([key, value]) => value !== previous?.[key],
  );
  const acknowledged = changedValues
    .filter(([key, value]) => expectedOperations.get(key)?.value === value)
    .map(([key]) => key);
  const unexpectedValue = changedValues.some(
    ([key, value]) =>
      expectedOperations.get(key)?.value !== value &&
      (typeof value === 'boolean'
        ? value || previous?.[key] === true
        : !isOwnOperation),
  );
  return {
    changed:
      (previous === null) !== (next === null) ||
      changedFacts ||
      changedValues.length > 0,
    hasRemoteChange:
      previous !== null &&
      next !== null &&
      (unexpectedValue || (changedFacts && !isOwnOperation)),
    acknowledged,
  };
}
