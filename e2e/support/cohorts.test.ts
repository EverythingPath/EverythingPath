// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resourceSchema } from '../fixtures/catalog';
import { cohortWorkers } from './cohorts';
import { validateE2ETargets } from './preflight';
import { resources, safeEnvironment, threeCohortResources } from './test-data';

describe('one Playwright worker per declared cohort', () => {
  it('keeps a single-cohort declaration exactly serial', () => {
    expect(cohortWorkers(resources)).toBe(1);
    expect(() => cohortWorkers(resources, 2)).toThrow(
      'between 1 and the 1 declared cohorts',
    );
  });

  it('accepts a validated three-cohort declaration and runs three workers', () => {
    const { resources: validated } = validateE2ETargets(
      safeEnvironment,
      threeCohortResources,
    );
    expect(cohortWorkers(validated, undefined, 16)).toBe(3);
    // A serial baseline on the same declaration uses only worker-0.
    expect(cohortWorkers(validated, 1)).toBe(1);
  });

  it.each(['resources.ci.json', 'resources.example.json'])(
    'declares three disjoint cohorts in %s',
    (file) => {
      const declaration = resourceSchema.parse(
        JSON.parse(readFileSync(join(process.cwd(), 'e2e', file), 'utf8')),
      );
      expect(cohortWorkers(declaration, undefined, 16)).toBe(3);
    },
  );

  it('caps the default at three workers and never exceeds the cohorts', () => {
    const extra = {
      ...threeCohortResources.workers[2]!,
      key: 'worker-3',
      organizationId: 'org_members3',
      outsiderOrganizationId: 'org_outsiders3',
      gm: { userId: 'user_gm3', email: 'gm3+clerk_test@example.test' },
      player: {
        userId: 'user_player3',
        email: 'player3+clerk_test@example.test',
      },
      outsider: {
        userId: 'user_outsider3',
        email: 'outsider3+clerk_test@example.test',
      },
    };
    const four = {
      ...threeCohortResources,
      workers: [...threeCohortResources.workers, extra],
    };
    expect(cohortWorkers(four, undefined, 16)).toBe(3);
    expect(cohortWorkers(four, 4)).toBe(4);
    for (const requested of [0, 5, 1.5, Number.NaN])
      expect(() => cohortWorkers(four, requested)).toThrow('E2E workers');
  });

  it('runs at most one worker per two available CPUs unless workers are requested', () => {
    // Three workers on a 4-vCPU runner time out journeys (#198).
    expect(cohortWorkers(threeCohortResources, undefined, 4)).toBe(2);
    expect(cohortWorkers(threeCohortResources, undefined, 5)).toBe(2);
    expect(cohortWorkers(threeCohortResources, undefined, 6)).toBe(3);
    expect(cohortWorkers(threeCohortResources, undefined, 3)).toBe(1);
    expect(cohortWorkers(threeCohortResources, undefined, 2)).toBe(1);
    expect(cohortWorkers(threeCohortResources, undefined, 1)).toBe(1);
    expect(cohortWorkers(threeCohortResources, undefined, 0)).toBe(1);
    expect(cohortWorkers(threeCohortResources, 3, 2)).toBe(3);
  });

  it('refuses shared cohorts and keys that do not follow worker order', () => {
    const [first, second, third] = threeCohortResources.workers;
    for (const workers of [
      [first!, { ...second!, organizationId: first!.organizationId }, third!],
      [first!, { ...second!, player: first!.player }, third!],
      [first!, third!, second!],
      [{ ...first!, key: 'worker-1' }],
    ])
      expect(() => cohortWorkers({ ...threeCohortResources, workers })).toThrow(
        /E2E worker cohorts/,
      );
  });
});
