import { randomBytes, randomUUID } from 'node:crypto';
import {
  FIXTURE_VERSION,
  fixtureConfigMaxBytes,
  type DeploymentFixture,
  type Resources,
} from '../fixtures/catalog';

/**
 * The fixture config bound for one run (#754): a fresh session ID and one
 * fresh capability for each cohort the run's `workers` use, 32 random bytes
 * in base64url. A reused environment gets new ones too, so an earlier run's
 * credentials are refused once this config is bound. Explicit case,
 * namespace, deployment and ownership checks take the place of the per-case
 * capabilities this replaced.
 */
export function createDeploymentFixture({
  resources,
  convexUrl,
  workers,
}: {
  resources: Resources;
  convexUrl: string;
  workers: number;
}): DeploymentFixture {
  return {
    version: FIXTURE_VERSION,
    namespace: resources.previewName,
    convexUrl,
    clerkHost: resources.clerkHost,
    productionConvexUrls: resources.production.convexUrls,
    session: randomUUID(),
    workers: resources.workers.slice(0, workers).map((worker) => ({
      ...worker,
      capability: randomBytes(32).toString('base64url'),
    })),
  };
}

/**
 * The config as the single `E2E_FIXTURE_CONFIG` value. Convex refuses a value
 * over 8 KiB, so a config that would not fit stops the run before binding.
 */
export function serializeFixtureConfig(fixture: DeploymentFixture) {
  const config = JSON.stringify(fixture);
  if (Buffer.byteLength(config) > fixtureConfigMaxBytes)
    throw new Error(
      'E2E fixture config exceeds the 8 KiB Convex environment variable limit',
    );
  return config;
}
