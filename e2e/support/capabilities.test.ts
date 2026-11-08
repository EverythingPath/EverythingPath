// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  deploymentFixtureSchema,
  fixtureConfigMaxBytes,
  resourceSchema,
} from '../fixtures/catalog';
import {
  createDeploymentFixture,
  serializeFixtureConfig,
} from './capabilities';
import { deploymentFixture } from './test-data';

// The checked-in CI declaration has the real cohort count and provider ID
// lengths; a preview URL is at most this long.
const declared = resourceSchema.parse(
  JSON.parse(
    readFileSync(join(process.cwd(), 'e2e', 'resources.ci.json'), 'utf8'),
  ),
);
const convexUrl = 'https://considerate-hedgehog-9999.eu-west-1.convex.cloud';

it('mints one fresh 256-bit capability per used cohort and a fresh session every run', () => {
  const first = createDeploymentFixture({
    resources: declared,
    convexUrl,
    workers: 2,
  });
  const second = createDeploymentFixture({
    resources: declared,
    convexUrl,
    workers: 2,
  });
  expect(deploymentFixtureSchema.parse(first)).toEqual(first);
  // Only the cohorts the run's workers use get a capability (#754).
  expect(first.workers.map((worker) => worker.key)).toEqual([
    'worker-0',
    'worker-1',
  ]);
  for (const [index, worker] of first.workers.entries()) {
    expect(Buffer.from(worker.capability, 'base64url')).toHaveLength(32);
    expect(worker.capability).not.toBe(second.workers[index]!.capability);
  }
  expect(first.workers[0]!.capability).not.toBe(first.workers[1]!.capability);
  expect(first.session).not.toBe(second.session);
});

it('keeps the fixture config the same size however many cases the catalog has', () => {
  const fixture = createDeploymentFixture({
    resources: declared,
    convexUrl,
    workers: declared.workers.length,
  });
  const config = serializeFixtureConfig(fixture);
  // No per-case entry: three cohorts take about 1.7 KiB of the 8 KiB cap.
  expect(config).not.toContain('"cases"');
  expect(Buffer.byteLength(config)).toBeLessThan(2_048);
  expect(Buffer.byteLength(config)).toBeLessThanOrEqual(fixtureConfigMaxBytes);
});

it('refuses a config Convex would not store, before any binding', () => {
  const oversized = {
    ...deploymentFixture,
    workers: Array.from({ length: 40 }, (_, index) => ({
      ...deploymentFixture.workers[0]!,
      key: `worker-${index}`,
    })),
  };
  expect(() => serializeFixtureConfig(oversized)).toThrow(
    'E2E fixture config exceeds the 8 KiB Convex environment variable limit',
  );
});

it('refuses per-case configs and capabilities that are not 43-character base64url', () => {
  expect(deploymentFixtureSchema.parse(deploymentFixture)).toEqual(
    deploymentFixture,
  );
  for (const capability of [
    'a'.repeat(64),
    'g'.repeat(42),
    `${'a'.repeat(42)}=`,
  ]) {
    const malformed = structuredClone(deploymentFixture);
    malformed.workers[0]!.capability = capability;
    expect(() => deploymentFixtureSchema.parse(malformed)).toThrow();
  }
  const perCase = {
    ...deploymentFixture,
    workers: deploymentFixture.workers.map(({ capability, ...worker }) => ({
      ...worker,
      cases: { smoke: capability },
    })),
  };
  expect(() => deploymentFixtureSchema.parse(perCase)).toThrow();
});
