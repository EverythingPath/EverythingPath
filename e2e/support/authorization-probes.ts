type Check = () => Promise<void>;

async function collectFailures(checks: readonly Check[]) {
  const failures: unknown[] = [];
  for (const check of checks) {
    try {
      await check();
    } catch (error) {
      failures.push(error);
    }
  }
  return failures;
}

// Roles are independent; checks within a role remain ordered. Collecting each
// failure prevents an unexpected authorization from starting fixture cleanup
// while another probe is still running, or skipping the fresh state check.
export async function verifyIndependentAuthorization(
  roles: readonly (readonly Check[])[],
  verifyUnchanged: Check,
) {
  const failures = (await Promise.all(roles.map(collectFailures))).flat();
  failures.push(...(await collectFailures([verifyUnchanged])));
  if (failures.length)
    throw new AggregateError(
      failures,
      [
        'Authorization probes or unchanged-state verification failed',
        ...failures.map((error) =>
          error instanceof Error ? error.message : 'Verification failed',
        ),
      ].join('\n'),
    );
}
