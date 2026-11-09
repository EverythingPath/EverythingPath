import { v, type Validator } from 'convex/values';
import { validate } from 'convex-helpers/validators';
import { catalogImpactEvaluationValidator } from '../../convex/schema.ts';
import type { CatalogReleaseImpactCommandAdapter } from './release-impact-command.ts';

const statusValidator = v.object({
  isDiscoveryComplete: v.boolean(),
  pendingCount: v.number(),
  failedCount: v.number(),
  isReady: v.boolean(),
  discoveryError: v.optional(v.string()),
  hasTruncatedCounts: v.optional(v.boolean()),
  missingIdentityCount: v.optional(v.number()),
  identityCoverageComplete: v.optional(v.boolean()),
});
const pageValidator = v.object({
  page: v.array(v.object({ characterId: v.id('character') })),
  isDone: v.boolean(),
  continueCursor: v.string(),
});

function parseResponse<T>(
  validator: Validator<T, 'required', string>,
  value: unknown,
  allowUnknownFields = false,
): T {
  if (!validate(validator, value, { allowUnknownFields }))
    throw new Error('Invalid remote release reconciliation response.');
  return value;
}

export function createCatalogReleaseImpactRemoteAdapter(
  invoke: (endpoint: string, args: unknown) => Promise<unknown>,
): CatalogReleaseImpactCommandAdapter {
  return {
    start: async (args) =>
      parseResponse(v.id('catalogImpactRun'), await invoke('start', args)),
    discover: async (args) =>
      parseResponse(v.boolean(), await invoke('discover', args)),
    status: async (args) =>
      parseResponse(statusValidator, await invoke('status', args), true),
    inspectWork: async (args) =>
      parseResponse(pageValidator, await invoke('inspectWork', args), true),
    evaluate: async (args) =>
      parseResponse(
        catalogImpactEvaluationValidator,
        await invoke('evaluate', args),
      ),
    complete: async (args) =>
      parseResponse(v.boolean(), await invoke('complete', args)),
    finish: async (args) =>
      parseResponse(v.boolean(), await invoke('finish', args)),
    retry: async (args) => parseResponse(v.null(), await invoke('retry', args)),
    retryDiscovery: async (args) =>
      parseResponse(v.null(), await invoke('retryDiscovery', args)),
  };
}
