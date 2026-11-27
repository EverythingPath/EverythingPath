import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import {
  readSelectedCatalogBoundary,
  readSelectedChoiceStates,
  type SelectedChoiceState,
} from './catalogReleaseBoundary';
import { findPreferredCampaignCopy } from './catalogCopies';
import type { ResolvedSheetEntry } from '../../src/lib/character-sheet-grants';

/**
 * sheet-write-release-check (PRD #251): the catalog references a sheet's
 * stored rows hold, and the end-of-write check that refuses a reference new
 * to the sheet that the selected Catalog Release puts outside it.
 */

type SheetRows = {
  character: Doc<'character'>;
  entries: readonly Doc<'characterSheetEntry'>[];
};

export const releaseReferenceRefusal =
  'Catalog Entry is not in the catalog; keep existing selections or choose another entry';

const recordedKinds = [
  'race',
  'racialTrait',
  'archetype',
  'classFeature',
  'feat',
  'trait',
  'spellEffect',
  'condition',
  'item',
  'spell',
  'manual',
] as const;

/**
 * The stored row fields the check reads, as `<entry kind> <path>`, where
 * `[]` marks an array's items. `sheetWriteReleaseCheck.integration.test.ts`
 * walks `characterSheetEntryValidator`, record keys included, and fails on a
 * `v.id('catalogEntry')` field in neither this list nor
 * `notReferenceFields`, and on a listed field `listSheetReferences` does not
 * read in its stored shape.
 */
export const sheetReferenceFields: readonly string[] = [
  ...recordedKinds.map((kind) => `${kind} catalogEntryId`),
  'attackRoutine state.options[]',
  'racialTrait state.replaces[]',
  'archetype state.classEntryId',
  'archetype state.replaces[].catalogEntryId',
  'spell state.castingClassId',
  'classLevel state.classEntryId',
  'classLevel state.castingAdvances[].classEntryId',
];

const countedUse =
  'an added use of a definition: release-membership-counted-uses';
/** Stored fields with Catalog Entry IDs the check does not read, and why. */
export const notReferenceFields: Readonly<Record<string, string>> = {
  'base catalogEntryId': "the sheet's own base definition, written with it",
  'base state.favoredClassIds[]': countedUse,
  'item state.abilities[].catalogEntryId': countedUse,
  'item state.otherEnd.abilities[].catalogEntryId': countedUse,
  'item state.bash.abilities[].catalogEntryId': countedUse,
};

const pathsByKind = new Map<string, string[][]>();
for (const field of sheetReferenceFields) {
  const [kind = '', path = ''] = field.split(' ');
  pathsByKind.set(kind, [...(pathsByKind.get(kind) ?? []), path.split('.')]);
}

/** The strings at a path in a stored value; `[]` reads every item. */
function readPath(value: unknown, segments: readonly string[]): string[] {
  const [head, ...rest] = segments;
  if (head === undefined) return typeof value === 'string' ? [value] : [];
  if (!value || typeof value !== 'object') return [];
  const isArray = head.endsWith('[]');
  const field: unknown = Reflect.get(value, isArray ? head.slice(0, -2) : head);
  if (!isArray) return readPath(field, rest);
  return Array.isArray(field)
    ? field.flatMap((item: unknown) => readPath(item, rest))
    : [];
}

/**
 * The references a sheet's rows hold in `sheetReferenceFields`, as sorted,
 * distinct `catalog:<id>` keys. With `grantTargets`, the definitions the
 * sheet's Grants name join them, so a Grant row recording its own target
 * is not new.
 */
export function listSheetReferences(
  entries: readonly Doc<'characterSheetEntry'>[],
  grantTargets: readonly ResolvedSheetEntry[] = [],
) {
  const ids = new Set<string>();
  for (const entry of entries)
    for (const path of pathsByKind.get(entry.kind) ?? [])
      for (const id of readPath(entry, path)) ids.add(id);
  for (const { entry, origin } of grantTargets)
    if (origin === 'grant' && 'catalogEntryId' in entry)
      ids.add(entry.catalogEntryId);
  return [...ids].sort().map((id) => `catalog:${id}`);
}

/**
 * Whether the check lets a sheet newly reference this stored definition. A
 * Spell (its kind or an imported Spell) is accepted in any state, preferred
 * copy or not. Any other definition is refused when its state is
 * `outside`; a global definition that is not a Catalog Copy is refused when
 * the campaign has a preferred copy of it, whether its state is `offered`
 * or `held`; everything else is accepted, so a `held` definition is left
 * to the retirement checks the write itself makes (#411).
 */
async function isAcceptedReference(
  ctx: ReadCtx,
  character: Doc<'character'>,
  {
    definition,
    state,
  }: { definition: Doc<'catalogEntry'>; state: SelectedChoiceState },
) {
  if (definition.detail.kind === 'spell' || definition.importedSpell)
    return true;
  if (state === 'outside') return false;
  if (definition.scope !== 'global' || definition.copiedFrom) return true;
  return !(await findPreferredCampaignCopy(ctx, {
    campaignId: character.campaignId,
    originalId: definition._id,
  }));
}

/** The stored definitions behind these Catalog Entry IDs, where they exist. */
async function readStoredDefinitions(ctx: ReadCtx, ids: readonly string[]) {
  const rows = await Promise.all(
    ids.map(async (id) => {
      const normalized = ctx.db.normalizeId('catalogEntry', id);
      return normalized ? await ctx.db.get('catalogEntry', normalized) : null;
    }),
  );
  return rows.filter((row): row is Doc<'catalogEntry'> => row !== null);
}

/**
 * The end-of-write check: the keys `listSheetReferences` finds in the
 * sheet's rows now and not in `before` must each pass
 * `isAcceptedReference`, or the write is refused. Nothing new reads nothing.
 */
export async function requireAcceptedNewReferences(
  ctx: ReadCtx,
  sheet: SheetRows,
  before: readonly string[],
) {
  const known = new Set(before);
  const added = listSheetReferences(sheet.entries).filter(
    (key) => !known.has(key),
  );
  if (!added.length) return;
  const boundary = await readSelectedCatalogBoundary(ctx);
  const states = await readSelectedChoiceStates(
    ctx,
    await readStoredDefinitions(
      ctx,
      added.map((key) => key.slice('catalog:'.length)),
    ),
    boundary,
  );
  for (const choice of states)
    if (!(await isAcceptedReference(ctx, sheet.character, choice)))
      throw new ConvexError(releaseReferenceRefusal);
}
