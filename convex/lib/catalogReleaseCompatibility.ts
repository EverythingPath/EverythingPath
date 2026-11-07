import { requireCatalogActivationAuthority } from './catalogFixturePolicy';
import { ConvexError } from 'convex/values';
import type { ReadCtx } from '../types';
import type { CharacterSheetInput } from '../../src/lib/character-sheet';
import {
  calculateCharacterSheetProjectionsForRelease,
  isSupportedCatalogCalculation,
} from '../../src/lib/catalog/calculation-dispatch';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';

export async function readCompatibleActiveRelease(
  ctx: ReadCtx,
  readBudget?: { accountRead(value: unknown): void },
) {
  const active = await ctx.db
    .query('catalogReleaseControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
  readBudget?.accountRead(active);
  if (active?.isFixtureOnly) await requireCatalogActivationAuthority(ctx, true);
  if (
    active &&
    (active.schemaIdentity !== catalogRuntimeCompatibility.schema ||
      !isSupportedCatalogCalculation(active.calculationIdentity))
  )
    throw new ConvexError(
      'Active Catalog Release requires unavailable schema or calculation behavior',
    );
  return {
    control: active,
    calculationIdentity:
      active?.calculationIdentity ?? catalogRuntimeCompatibility.calculation,
  };
}

export async function requireCompatibleActiveRelease(ctx: ReadCtx) {
  return (await readCompatibleActiveRelease(ctx)).calculationIdentity;
}

export function calculateActiveCharacterSheet(
  input: CharacterSheetInput,
  calculationIdentity: string,
  options?: Parameters<typeof calculateCharacterSheetProjectionsForRelease>[2],
) {
  return calculateCharacterSheetProjectionsForRelease(
    calculationIdentity,
    input,
    options,
  );
}
