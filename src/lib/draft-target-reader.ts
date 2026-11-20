import type { PaginationOptions } from 'convex/server';
import {
  DraftTransportFailure,
  draftTargetPageSchema,
  type DraftObservation,
  type DraftTargetPage,
} from './weekly-draft-persistence-contract';

type PageRequest = {
  afterRevision: number;
  observedRevision: number;
  observedStatus: 'open' | 'closed';
  paginationOpts: PaginationOptions;
};
// Page heads must describe the same committed revision. A concurrent edit makes
// us discard the partial merge and restart; no mixed snapshot reaches a client.
export function createDraftTargetReader(
  fetchPage: (request: PageRequest) => Promise<DraftTargetPage>,
  pageOptions: Omit<PaginationOptions, 'cursor'> = { numItems: 16 },
) {
  let cached: DraftObservation | null = null;
  let chain = Promise.resolve();
  async function read(observed: DraftObservation): Promise<DraftObservation> {
    if (cached && cached.draftId !== observed.draftId)
      throw new Error('Inconsistent target page identity');
    if (
      cached &&
      (cached.status === 'closed' ||
        cached.revision > observed.revision ||
        (cached.revision === observed.revision &&
          cached.status === observed.status))
    )
      return structuredClone(cached);
    let expected = observed;
    for (let attempt = 0; attempt < 4; attempt++) {
      const merged = new Map(
        cached?.targetRevisions.map((row) => [row.target, row.revision]) ?? [],
      );
      let cursor: string | null = null;
      let first = true;
      for (;;) {
        const result = draftTargetPageSchema.parse(
          await fetchPage({
            afterRevision: cached?.revision ?? 0,
            observedRevision: expected.revision,
            observedStatus: expected.status,
            paginationOpts: { ...pageOptions, cursor },
          }),
        );
        if (
          result.observation.draftId !== observed.draftId ||
          result.observation.revision < observed.revision
        )
          throw new Error('Inconsistent target page identity');
        if (result.restart) {
          expected = result.observation;
          break;
        }
        if (!result.pagination) throw new Error('Missing native target page');
        const pagination = result.pagination;
        if (first) expected = result.observation;
        else if (
          result.observation.revision !== expected.revision ||
          result.observation.status !== expected.status
        ) {
          expected = result.observation;
          break;
        }
        first = false;
        for (const row of pagination.page) merged.set(row.target, row.revision);
        if (pagination.isDone) {
          cached = {
            ...expected,
            targetRevisions: [...merged].map(([target, revision]) => ({
              target,
              revision,
            })),
          };
          return structuredClone(cached);
        }
        if (cursor === pagination.continueCursor)
          throw new Error('Repeated target page cursor');
        cursor = pagination.continueCursor;
      }
    }
    throw new DraftTransportFailure('Draft changed during target hydration');
  }
  return (observation: DraftObservation) => {
    const task = chain.then(() => read(observation));
    chain = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };
}
