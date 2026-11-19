import { ConvexError, v } from 'convex/values';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { requireCharacterAccess } from './lib/characterAccess';
import {
  loadCharacterSheet,
  loadCharacterSheetFromAccess,
} from './lib/characterSheet';
import { applyCompanionToSheet } from './lib/characterSheetCompanion';
import { buildCharacterSheetInput } from './lib/characterSheetData';
import { readCompanionGraph } from './lib/companionRelationshipGraph';
import { calculateCharacterSheetForRelease } from '../src/lib/catalog/calculation-dispatch';
import { companionCalculationOptions } from '../src/lib/character-sheet-companion-calculation-inputs';
import {
  combinedFormSchema,
  findSynthesist,
  resolveCombinedForm,
  type EidolonInput,
} from '../src/lib/character-sheet-combined-form';

// The Synthesist's Combined Form (#421) is a read-only view on the
// summoner's sheet. It is calculated on each read from the two separate
// Character builds and never stored, so viewing it declares no current
// fusion and changes no combat state, roster, officer or Militia Character
// Fact.

type FusedEidolon =
  | { kind: 'unavailable'; reason: UnavailableEidolonReason }
  | {
      kind: 'calculated';
      character: Doc<'character'>;
      calculated: Awaited<
        ReturnType<typeof applyCompanionToSheet>
      >['calculated'];
    };
type UnavailableEidolonReason = Extract<
  EidolonInput,
  { kind: 'unavailable' }
>['reason'];
const eidolonKinds = new Set<Doc<'companionRelationship'>['kind']>([
  'eidolon',
  'unchainedEidolon',
]);

export const read = query({
  args: { characterId: v.id('character') },
  returns: v.union(
    v.null(),
    zodOutputToConvex(combinedFormSchema).extend({
      /** The fused eidolon's sheet, disclosed only with access to it. */
      eidolon: v.union(
        v.null(),
        v.object({ characterId: v.id('character'), name: v.string() }),
      ),
    }),
  ),
  async handler(ctx, args) {
    // The summoner's sheet read authorizes the viewer first.
    const baseline = await loadCharacterSheet(ctx, args, {
      isCompanionInputSkipped: true,
    });
    if (!baseline) return null;
    const summoner = await applyCompanionToSheet(ctx, baseline, {
      readBudget: baseline.companionReadBudget,
    });
    const input = buildCharacterSheetInput(summoner);
    if (!findSynthesist({ input, calculated: summoner.calculated }))
      return null;
    const eidolon = await readFusedEidolon(ctx, args.characterId);
    const form = resolveCombinedForm({
      summoner: { input, calculated: summoner.calculated },
      eidolon,
      calculateFused: (options) =>
        calculateCharacterSheetForRelease(summoner.calculationIdentity, input, {
          ...companionCalculationOptions(summoner.companionCalculationInputs),
          ...options,
        }),
    });
    if (!form) return null;
    return {
      ...form,
      eidolon:
        eidolon.kind === 'calculated'
          ? { characterId: eidolon.character._id, name: eidolon.character.name }
          : null,
    };
  },
});

/**
 * The one active eidolon fused with the summoner, read as the viewer may
 * read it. An inaccessible eidolon discloses nothing about itself; a
 * failure to calculate an accessible one is not hidden.
 */
async function readFusedEidolon(
  ctx: QueryCtx,
  summonerId: Id<'character'>,
): Promise<FusedEidolon> {
  const graph = await readCompanionGraph(ctx, summonerId);
  const eidolons = [...graph.relationships.values()].filter(
    (row) =>
      row.associatedCharacterId === summonerId && eidolonKinds.has(row.kind),
  );
  const active = eidolons.filter(
    (row) => graph.active.get(row.companionCharacterId)?._id === row._id,
  );
  const [only] = active;
  if (active.length > 1)
    return { kind: 'unavailable', reason: 'multipleEidolons' };
  if (!only)
    return {
      kind: 'unavailable',
      reason: eidolons.length ? 'eidolonUnavailable' : 'noEidolon',
    };
  let access: Awaited<ReturnType<typeof requireCharacterAccess>>;
  try {
    access = await requireCharacterAccess(ctx, {
      characterId: only.companionCharacterId,
    });
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    return { kind: 'unavailable', reason: 'eidolonUnavailable' };
  }
  const baseline = await loadCharacterSheetFromAccess(ctx, access, {
    isCompanionInputSkipped: true,
  });
  if (!baseline) return { kind: 'unavailable', reason: 'eidolonUnavailable' };
  const sheet = await applyCompanionToSheet(ctx, baseline, {
    readBudget: baseline.companionReadBudget,
  });
  return {
    kind: 'calculated',
    character: sheet.character,
    calculated: sheet.calculated,
  };
}
