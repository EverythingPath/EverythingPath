import { ConvexError } from 'convex/values';
import type { MutationCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';
import { weeklySourceKey } from '../../src/lib/canonical-weekly-source';
import { sha256 } from '../../src/lib/catalog/release-sha256';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import {
  legacyBaseState,
  legacyClassLevelState,
  mapLegacyCharacter,
  maxLegacyCharacterCandidateBytes,
} from '../../src/lib/initial-character-backfill';
import { abilityKeys, abilityTargets } from '../../src/lib/character-sheet';
import { loadPreparedCharacterSheet } from './preparedCharacterSheet';
import { calculateMilitiaCharacterFacts } from './militiaCharacterFacts';
import { readSelectedCatalogBoundary } from './catalogReleaseBoundary';

/** A Migration Run past activation, in each stage it can reach. */
export type SheetRun = Extract<
  Doc<'initialMigrationRun'>,
  { state: 'activated' | 'reopened' | 'repairing' }
>;
type ActivatedRun = Extract<SheetRun, { state: 'activated' }>;

/**
 * Candidates per publication page. A legacy candidate writes its Character's
 * base definition, base entry and at most 4,095 Class Levels, so a page writes
 * at most 8,197 documents (two Characters' 4,098 rows and the run) and makes
 * at most 9 document reads (the control row, the run, two candidates and two
 * Characters, the run and Characters again for their patches; an unpublished
 * Character's sheet probe finds nothing), whatever the deployment's size.
 */
export const publicationPageSize = 2;
/** Live Characters whose sheets `smoke` reads, in `character` order. */
export const smokeSampleSize = 4;
/**
 * The bytes `smoke` may read for one sampled sheet, the selected release's
 * rows it reads included: Convex's 16 MiB transaction read limit, less a
 * reserve for the check's own rows (the controls, the run, the selected
 * release and the sampled Characters), shared by the sample. The largest
 * sheet publish writes, a 4,095-level legacy Character, reads 4,098 rows,
 * about 1 MiB, so whatever publish admits, smoke reads, and four such sheets
 * stay within Convex's 32,000-document limit too.
 */
export const smokeSheetReadBytes =
  (16 * 1024 * 1024 - 4 * 1024 * 1024) / smokeSampleSize;
const maxSmokeProblems = 20;

/** The sheet operation identity a run's publication records on a Character. */
export function publicationOperationId(run: Pick<SheetRun, 'operationId'>) {
  return `initial-migration:${run.operationId}`;
}

async function characterHash(character: Doc<'character'>) {
  return await sha256(new TextEncoder().encode(weeklySourceKey(character)));
}

export function refusePublication(reason: string): never {
  throw new ConvexError(`Publication refused: ${reason}.`);
}

/**
 * Publishes one candidate: a legacy candidate becomes its Character's live
 * sheet, written from the same mapping validation compared it with; an
 * initialized candidate already is one. A Character this run already published
 * counts without a second write. Anything else refuses and never corrects: a
 * Character that changed since capture, a sheet this run did not write, or a
 * candidate that is not the mapping of its Character.
 */
async function publishCandidate(
  ctx: MutationCtx,
  run: ActivatedRun,
  candidate: Doc<'initialMigrationCandidate'>,
) {
  const character = await ctx.db.get('character', candidate.characterId);
  if (!character)
    refusePublication(`Character ${candidate.characterId} is missing`);
  const operationId = publicationOperationId(run);
  const isPublished =
    character.sheetMode && character.sheetLastOperationId === operationId;
  if (!candidate.isInitialized && isPublished) return;
  if ((await characterHash(character)) !== candidate.characterHash)
    refusePublication(
      `Character ${character._id} changed after capture; inspect it before publishing`,
    );
  if (!candidate.isInitialized) {
    await requireLegacyMapping(ctx, character, candidate);
    await writeLegacySheet(ctx, character, {
      sheetMode: candidate.sheetMode,
      operationId,
    });
  } else if (character.sheetMode !== candidate.sheetMode)
    refusePublication(`Character ${character._id} has another sheet mode`);
}

/** A legacy candidate publishes only onto no sheet, as its exact mapping. */
async function requireLegacyMapping(
  ctx: MutationCtx,
  character: Doc<'character'>,
  candidate: Doc<'initialMigrationCandidate'>,
) {
  const existing = await ctx.db
    .query('characterSheetEntry')
    .withIndex('by_characterId', (q) => q.eq('characterId', character._id))
    .first();
  if (character.sheetMode || existing || candidate.input === null)
    refusePublication(
      `Character ${character._id} has a sheet this run did not publish, or no candidate input`,
    );
  const mapped = mapLegacyCharacter({
    character,
    hasMilitia: candidate.sheetMode === 'militiaOnly',
  });
  if (
    mapped.sheetMode !== candidate.sheetMode ||
    weeklySourceKey(mapped.input) !==
      weeklySourceKey(JSON.parse(candidate.input))
  )
    refusePublication(
      `the candidate for Character ${character._id} is not its legacy mapping`,
    );
}

async function writeLegacySheet(
  ctx: MutationCtx,
  character: Doc<'character'>,
  sheet: {
    sheetMode: Doc<'initialMigrationCandidate'>['sheetMode'];
    operationId: string;
  },
) {
  // The rows are the mapping's, with database identities.
  const catalogEntryId = await ctx.db.insert('catalogEntry', {
    scope: 'character',
    characterId: character._id,
    name: 'Base scores',
    ruleIdentity: `base:${character._id}`,
    stacksWithItself: false,
    detail: { kind: 'base' },
    sources: [],
    modifiers: abilityKeys.map((ability) => ({
      target: abilityTargets[ability],
      bonusType: 'base' as const,
      value: character[ability],
    })),
  });
  await ctx.db.insert('characterSheetEntry', {
    characterId: character._id,
    kind: 'base',
    active: true,
    catalogEntryId,
    state: legacyBaseState(),
  });
  for (let position = 1; position <= character.level; position++)
    await ctx.db.insert('characterSheetEntry', {
      characterId: character._id,
      kind: 'classLevel',
      active: true,
      state: legacyClassLevelState(position),
    });
  await ctx.db.patch('character', character._id, {
    sheetMode: sheet.sheetMode,
    sheetRevision: 1,
    sheetLastOperationId: sheet.operationId,
    sheetUpdatedBy: 'initial-migration',
  });
}

/**
 * Publishes the next page of the run's candidates in Character key order and
 * returns the advanced progress. The last page refuses unless every captured
 * Character was published, so a page that skipped one never completes.
 */
export async function publishPage(ctx: MutationCtx, run: ActivatedRun) {
  const { publication } = run;
  const page = await ctx.db
    .query('initialMigrationCandidate')
    .withIndex('by_runId_and_characterId', (q) => q.eq('runId', run._id))
    .paginate({
      cursor: publication.cursor,
      numItems: publicationPageSize,
      maximumRowsRead: publicationPageSize,
      maximumBytesRead: publicationPageSize * maxLegacyCharacterCandidateBytes,
    });
  for (const candidate of page.page)
    await publishCandidate(ctx, run, candidate);
  const next = {
    cursor: page.continueCursor,
    nextPage: publication.nextPage + 1,
    published: publication.published + page.page.length,
    isDone: page.isDone,
  };
  const captured = run.backfill?.captured ?? 0;
  if (next.isDone && next.published !== captured)
    refusePublication(
      `${next.published} of ${captured} captured Characters were published; inspect the candidates`,
    );
  return next;
}

/**
 * What the smoke check finds wrong with a published deployment, reading a
 * fixed set of rows and the first four live Characters' sheets in `character`
 * order. Every check needs the publication to cover the capture and each
 * sampled Character to have a sheet that reads and computes militia facts.
 * The first check, before any reopening, also needs the running code's
 * compatibility and the selected Catalog Release to be the activation's, and
 * each sampled sheet's facts to equal the flat columns validation compared
 * them with: nothing has edited a sheet yet, and the live Characters are the
 * captured ones. A repair check instead needs the selected release, perhaps
 * a later one activated while open, to be readable by the running code, and
 * accepts the edits, new Characters and deletions made since reopening.
 */
export async function findSmokeProblems(
  ctx: MutationCtx,
  run: Extract<SheetRun, { state: 'activated' | 'repairing' }>,
) {
  const isFirst = run.state === 'activated';
  const problems = isFirst
    ? await findActivationProblems(ctx, run)
    : await findSelectionProblems(ctx);
  const captured = run.backfill?.captured ?? 0;
  if (run.publication.published !== captured)
    problems.push(
      `${run.publication.published} of ${captured} captured Characters are published`,
    );
  const sample = await ctx.db.query('character').take(smokeSampleSize);
  for (const character of sample) {
    const problem = await findSheetProblem(ctx, character, {
      isUnedited: isFirst,
    });
    if (problem) problems.push(`Character ${character._id} ${problem}`);
  }
  return problems.slice(0, maxSmokeProblems);
}

/** The first check's comparison of the running deployment with activation. */
async function findActivationProblems(
  ctx: MutationCtx,
  { activation }: SheetRun,
) {
  const problems: string[] = [];
  if (
    catalogRuntimeCompatibility.schema !== activation.schemaIdentity ||
    catalogRuntimeCompatibility.calculation !== activation.calculationIdentity
  )
    problems.push(
      'the deployed schema or calculation identity is not the activated one',
    );
  const selected = await readSelectedRelease(ctx);
  if (
    selected?.releaseNumber !== activation.releaseNumber ||
    selected.activationId !== activation.activationId ||
    selected.impactRunId !== activation.impactRunId
  )
    problems.push('the selected Catalog Release is not the activated one');
  return problems;
}

/**
 * A repair check's view of the selection: a release stays selected and the
 * running code reads it, whichever release the protocol selected since.
 */
async function findSelectionProblems(ctx: MutationCtx) {
  const selected = await readSelectedRelease(ctx);
  if (!selected) return ['no Catalog Release is selected'];
  try {
    await readSelectedCatalogBoundary(ctx);
  } catch {
    return [
      'the selected Catalog Release is not compatible with the deployed schema and calculation',
    ];
  }
  return [];
}

function readSelectedRelease(ctx: MutationCtx) {
  return ctx.db
    .query('catalogReleaseControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
}

/** Why a sampled Character's published sheet fails the check, if it does. */
async function findSheetProblem(
  ctx: MutationCtx,
  character: Doc<'character'>,
  { isUnedited }: { isUnedited: boolean },
) {
  if (!character.sheetMode) return 'has no published sheet';
  try {
    const sheet = await loadPreparedCharacterSheet(ctx, character, undefined, {
      resourceLimits: {
        maximumTotalBytesRead: smokeSheetReadBytes,
        maximumReferences: 1024,
      },
      includeAcceptedWarnings: false,
    });
    if (!sheet) return 'sheet is unavailable';
    const facts = await calculateMilitiaCharacterFacts(ctx, character, sheet);
    const differs =
      facts.level !== character.level ||
      abilityKeys.some((ability) => facts[ability] !== character[ability]);
    return isUnedited && differs
      ? 'sheet facts differ from its recorded statistics'
      : null;
  } catch (failure) {
    return `sheet fails: ${failure instanceof Error ? failure.message : String(failure)}`;
  }
}
