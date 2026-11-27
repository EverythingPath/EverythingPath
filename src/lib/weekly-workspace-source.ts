import { z } from 'zod';
import { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import { militiaSnapshotSchema } from './canonical-weekly-source';
import { weeklyDraftSchema } from './weekly-draft-contract';
export const workspaceSourceSchema = z.strictObject({
  key: draftKeySchema,
  // The open draft's week, so a campaign list row can show "Week N"
  // without observing the whole draft.
  week: weeklyDraftSchema.shape.week,
  setupNotes: z.string().optional(),
  sourceRevision: z.number().int().nonnegative(),
  snapshot: militiaSnapshotSchema,
  people: z.array(
    z.strictObject({ characterId: z.string(), name: z.string().nullable() }),
  ),
});
export type WorkspaceSource = z.infer<typeof workspaceSourceSchema>;
