// Association of warnings, exceptions and outcomes with their consequence by
// the existing code/subject conventions: a subject owns a code only when it
// appears as whole `:`-separated segments of that code. The longest subject
// wins; there is no fuzzy or message-text matching.

export type OwnedItem = { key: string; subjects: readonly string[] };

export function ownsCode(subject: string, code: string) {
  return subject !== '' && `:${code}:`.includes(`:${subject}:`);
}

export function findOwner<T extends OwnedItem>(
  code: string,
  items: readonly T[],
): T | null {
  let best: { item: T; length: number } | null = null;
  for (const item of items)
    for (const subject of item.subjects)
      if (ownsCode(subject, code) && subject.length > (best?.length ?? -1))
        best = { item, length: subject.length };
  return best?.item ?? null;
}

/**
 * The resolver records every applied Table Adjustment as a warning coded
 * `adjustment:<id>:<reason>`. That is the table's own decision, already shown
 * with its reason on the adjustment's row, not a rules warning: live and
 * frozen reviews neither list nor count it. Its overflow and unavailable
 * target codes are requirements and stay.
 */
export function isAppliedAdjustment(
  code: string,
  adjustments: readonly { adjustmentId: string; reason: string }[],
) {
  return adjustments.some(
    (adjustment) =>
      code === `adjustment:${adjustment.adjustmentId}:${adjustment.reason}`,
  );
}
