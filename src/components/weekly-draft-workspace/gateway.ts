import type { Phase } from './types';
import type { ConvexReactClient } from 'convex/react';
import type { Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import {
  createConvexDraftTransport,
  type ConvexDraftClient,
} from '~/lib/convex-draft-persistence';
import {
  workspaceSourceSchema,
  type WorkspaceSource,
} from '~/lib/weekly-workspace-source';
import type { DraftTransport } from '~/lib/weekly-draft-persistence-contract';
import type { ConfirmationTransport } from '~/lib/weekly-confirmation-contract';
export type WorkspaceGateway = {
  initialPhase?: Phase;
  subscribe(
    next: (source: WorkspaceSource | null) => void,
    failed: () => void,
  ): () => void;
  transport(source: WorkspaceSource): DraftTransport & ConfirmationTransport;
};
export function createConvexWorkspaceGateway(
  react: ConvexReactClient,
  campaignId: Id<'campaign'>,
  initialPhase?: Phase,
): WorkspaceGateway {
  const client: ConvexDraftClient = {
    query: react.query.bind(react),
    mutation: react.mutation.bind(react),
    onUpdate(query, args, next, failed) {
      const watch = react.watchQuery(query, args);
      const update = () => {
        try {
          const result = watch.localQueryResult();
          if (result !== undefined) next(result);
        } catch (error) {
          failed?.(error instanceof Error ? error : new Error('Read failed'));
        }
      };
      const stop = watch.onUpdate(update);
      update();
      return stop;
    },
  };
  return {
    initialPhase,
    subscribe(next, failed) {
      return client.onUpdate(
        api.canonicalDraftPersistence.workspace,
        { campaignId },
        (value) =>
          next(value === null ? null : workspaceSourceSchema.parse(value)),
        failed,
      );
    },
    transport(source) {
      return createConvexDraftTransport(client, source.key);
    },
  };
}
