import { convexTest } from 'convex-test';
import { TransactionMetricsTracker } from 'convex-test/dist/transactionMetrics.js';
import type { SchemaDefinition, GenericSchema } from 'convex/server';

/** The refusal a Convex deployment reports for a second paginated query. */
export const repeatedPaginatedQueryRefusal =
  'This query or mutation function ran multiple paginated queries. Convex only supports a single paginated query in each function.';

type ConvexSyscalls = {
  syscall: unknown;
  jsSyscall: unknown;
  asyncSyscall: (op: string, args: string) => Promise<string>;
};

let isInstalled = false;
let isPaginating = false;
const paginatedQueries = new WeakMap<TransactionMetricsTracker, number>();

/**
 * Make convex-test refuse a second `.paginate` in one transaction, as a Convex
 * deployment does; convex-test otherwise runs any number of them. Install it
 * once per test file, before any test runs; it then applies to every
 * convex-test instance in that file. A nested `ctx.runMutation` shares its
 * caller's transaction here, so its paginated queries count with the caller's.
 */
export function refuseRepeatedPaginatedQueries(
  schema: SchemaDefinition<GenericSchema, boolean>,
  modules: Record<string, () => Promise<unknown>>,
) {
  if (isInstalled) return;
  isInstalled = true;
  // The first instance installs convex-test's global syscall proxy, which it
  // never replaces; every paginated query reaches this syscall.
  convexTest(schema, modules);
  const convex = (globalThis as { Convex?: ConvexSyscalls }).Convex;
  if (!convex) throw new Error('convex-test installed no Convex syscalls');
  (globalThis as { Convex?: ConvexSyscalls }).Convex = {
    get syscall() {
      return convex.syscall;
    },
    get jsSyscall() {
      return convex.jsSyscall;
    },
    get asyncSyscall() {
      const asyncSyscall = convex.asyncSyscall;
      return (op: string, args: string) => {
        // The syscall reaches the transaction's tracker synchronously.
        isPaginating = op === '1.0/queryPage';
        try {
          return asyncSyscall(op, args);
        } finally {
          isPaginating = false;
        }
      };
    },
  };
  // Each transaction's tracker counts its index ranges, paginated or not.
  const { value: trackIndexRange } = Object.getOwnPropertyDescriptor(
    TransactionMetricsTracker.prototype,
    'trackIndexRange',
  ) as { value: (this: TransactionMetricsTracker) => void };
  TransactionMetricsTracker.prototype.trackIndexRange = function (
    this: TransactionMetricsTracker,
  ) {
    if (isPaginating) {
      isPaginating = false;
      const count = (paginatedQueries.get(this) ?? 0) + 1;
      paginatedQueries.set(this, count);
      if (count > 1) throw new Error(repeatedPaginatedQueryRefusal);
    }
    return trackIndexRange.call(this);
  };
}

