import { z } from 'zod';
import { catalogReleaseLimits } from '../../src/lib/catalog/release-limits.ts';

export const catalogActivationStatusSchema = z.object({
  releaseNumber: z.number().int().positive(),
  artifactFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  impactRunId: z.string().min(1),
  activationId: z
    .string()
    .min(1)
    .max(catalogReleaseLimits.activationIdentityLength),
  schemaIdentity: z.string().min(1),
  calculationIdentity: z.string().min(1),
  isFixtureOnly: z.boolean(),
});
export type CatalogReleaseActivationCommandAdapter = {
  activate(args: {
    releaseNumber: number;
    runId: string;
    activationId: string;
    schemaIdentity: string;
    calculationIdentity: string;
    isFixtureOnly: boolean;
    writeEpoch: number;
  }): Promise<unknown>;
  status(args: Record<string, never>): Promise<unknown>;
};

/** An uncertain response is inspected explicitly; gameplay requests are never replayed. */
export async function runCatalogReleaseActivationCommand({
  command,
  adapter,
}: {
  command:
    | { kind: 'status' }
    | ({ kind: 'activate' } & Parameters<
        CatalogReleaseActivationCommandAdapter['activate']
      >[0]);
  adapter: CatalogReleaseActivationCommandAdapter;
}) {
  if (command.kind === 'status') {
    const selected = await adapter.status({});
    return selected === null
      ? null
      : catalogActivationStatusSchema.parse(selected);
  }
  const { kind: _kind, ...args } = command;
  if (
    !Number.isSafeInteger(args.releaseNumber) ||
    args.releaseNumber < 1 ||
    !Number.isSafeInteger(args.writeEpoch) ||
    args.writeEpoch < 0 ||
    !args.runId.trim() ||
    !args.activationId.trim() ||
    args.activationId.length > catalogReleaseLimits.activationIdentityLength ||
    !args.isFixtureOnly
  )
    throw new Error('Invalid catalog activation identity or write epoch.');
  return catalogActivationStatusSchema.parse(await adapter.activate(args));
}
