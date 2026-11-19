import { parseReviewReceipts } from './review-receipts.ts';

/** The review receipts' path, which catalog:merge merges by runId. */
export const reviewReceiptsPath = 'scripts/catalog/review-receipts.json';

/**
 * The union's text (`merged`), or the conflicts that keep it from being
 * written (`conflicts`), at least one.
 */
export type ReviewReceiptsMerge =
  | { kind: 'merged'; text: string }
  | { kind: 'conflicts'; conflicts: readonly [string, ...string[]] };

/**
 * The review receipts' three-way union (regen-carry, code-regen-v3), as
 * `code-rebase.sh` runs it with `catalog:merge FILE --base OLD --ours NEW
 * --theirs ACC`: OURS' list, then each receipt only THEIRS holds, in its
 * order. The receipts are append-only: a receipt BASE holds that a side
 * lacks or holds differently in any byte once formatted (the same edit on
 * both sides included), and a runId both sides added with different content,
 * are conflicts, and nothing is written. Each
 * side is checked against the receipts' schema; the receipts are written as
 * the sides hold them, byte for byte once formatted.
 * `gate_core.receipts_union` proves the same rule from Git objects.
 */
export function mergeReviewReceipts({
  base,
  ours,
  theirs,
}: {
  base?: string;
  ours: string;
  theirs: string;
}): ReviewReceiptsMerge {
  const read = (side: string, text: string) => {
    try {
      const value: unknown = JSON.parse(text);
      const { receipts } = parseReviewReceipts(value);
      // The receipts as the side holds them (the parsed ones follow the
      // schema's key order), in the parsed list's order.
      const raw: unknown[] =
        typeof value === 'object' &&
        value !== null &&
        'receipts' in value &&
        Array.isArray(value.receipts)
          ? value.receipts
          : [];
      const byRunId = new Map(
        receipts.map(({ runId }, index): [string, unknown] => [
          runId,
          raw[index],
        ]),
      );
      if (byRunId.size !== receipts.length)
        throw new Error('a runId is recorded twice');
      return byRunId;
    } catch (error) {
      throw new Error(
        `${reviewReceiptsPath} ${side}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  const before =
    base === undefined ? new Map<string, unknown>() : read('base', base);
  const mine = read('ours', ours);
  const other = read('theirs', theirs);
  const same = (one: unknown, other: unknown) =>
    JSON.stringify(one) === JSON.stringify(other);
  const conflicts = [
    ...[...before]
      .filter(([runId]) => !mine.has(runId) || !other.has(runId))
      .map(([runId]) => `review receipt ${runId} is removed by one side`),
    ...[...before]
      .filter(
        ([runId, receipt]) =>
          mine.has(runId) &&
          other.has(runId) &&
          (!same(mine.get(runId), receipt) || !same(other.get(runId), receipt)),
      )
      .map(([runId]) => `review receipt ${runId} is changed by a side`),
    ...[...mine]
      .filter(
        ([runId, receipt]) =>
          !before.has(runId) &&
          other.has(runId) &&
          !same(other.get(runId), receipt),
      )
      .map(
        ([runId]) =>
          `review receipt ${runId} is held differently on the two sides`,
      ),
  ];
  const [conflict, ...more] = conflicts;
  if (conflict !== undefined)
    return { kind: 'conflicts', conflicts: [conflict, ...more] };
  const receipts = [
    ...mine.values(),
    ...[...other]
      .filter(([runId]) => !mine.has(runId))
      .map(([, receipt]) => receipt),
  ];
  return { kind: 'merged', text: `${JSON.stringify({ receipts }, null, 2)}\n` };
}
