import { ConvexReactClient, type MutationOptions } from 'convex/react';
import type {
  ArgsAndOptions,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server';
import { api } from '@convex/_generated/api';
import { createMigrationSession } from './initial-migration-client';

export class MigrationConvexClient extends ConvexReactClient {
  readonly maintenance = createMigrationSession();
  private stopMaintenance?: () => void;

  override setAuth(...args: Parameters<ConvexReactClient['setAuth']>) {
    super.setAuth(...args);
    this.startMaintenance();
  }

  // The provider calls this after auth setup or once signed-out state is known.
  startMaintenance() {
    if (typeof window === 'undefined' || this.stopMaintenance) return;
    const watch = this.watchQuery(api.initialMigration.clientStatus, {});
    const update = () => {
      try {
        const status = watch.localQueryResult();
        if (status !== undefined) this.maintenance.observe(status);
      } catch {
        this.maintenance.unavailable();
      }
    };
    this.stopMaintenance = watch.onUpdate(update);
    update();
  }

  override mutation<Mutation extends FunctionReference<'mutation'>>(
    mutation: Mutation,
    ...argsAndOptions: ArgsAndOptions<
      Mutation,
      MutationOptions<FunctionArgs<Mutation>>
    >
  ): Promise<FunctionReturnType<Mutation>> {
    const [args, options] = argsAndOptions;
    return this.maintenance.write(
      (fencedArgs) => super.mutation(mutation, fencedArgs, options),
      args ?? {},
    );
  }

  override async close() {
    this.stopMaintenance?.();
    await super.close();
  }
}
