import { hasCompanionCalculationDependencies } from './lib/companionRelationshipGraph';
import { ConvexError, v, type Infer } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import {
  backfillReceipt,
  requireClosedBackfillRun,
  requireCapturedBackfillRun,
  findBackfillRunProblem,
  abortInitialMigrationRun,
} from './lib/initialCharacterBackfill';
import { backfillStateValidator } from './schema';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import type { CharacterSheetInput } from '../src/lib/character-sheet';
import {
  mapLegacyCharacter,
  compareLegacyCharacterCandidate,
  maxLegacyCharacterCandidateBytes,
} from '../src/lib/initial-character-backfill';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import { calculateMilitiaCharacterFacts } from './lib/militiaCharacterFacts';
import { readCharacterSheetData } from './lib/characterSheetData';
import {
  weeklySourceKey,
  militiaSnapshotSchema,
} from '../src/lib/canonical-weekly-source';
import {
  militiaSnapshotCharacterReferences,
  weeklyDraftCharacterReferences,
} from '../src/lib/militia-character-references';
import { internal } from './_generated/api';
import { jsonBytes } from '../src/lib/json-bytes';
import { parseGrantKeyId } from '../src/lib/character-sheet-grants';
import { sha256 } from '../src/lib/catalog/release-sha256';
import { requireCatalogDefinitionScope } from './lib/catalogCopies';

type BackfillState = NonNullable<Doc<'initialMigrationRun'>['backfill']>;
type Receipt = Infer<typeof backfillReceipt>;
const batchArgs = { ...backfillReceipt.fields, expectedBatch: v.number() };
const nextPhase = {
  characters: 'candidates',
  candidates: 'sources',
  sources: 'relationships',
  relationships: 'sheetEntries',
  sheetEntries: 'catalogEntries',
  catalogEntries: 'warnings',
  warnings: 'spells',
  spells: 'drafts',
  drafts: 'done',
  done: 'done',
} satisfies Record<
  BackfillState['validationPhase'],
  BackfillState['validationPhase']
>;
// Source capture shares a document with the candidate; never attempt a >1MiB insert.

const sheetReadLimits = {
  resourceLimits: {
    maximumTotalBytesRead: maxLegacyCharacterCandidateBytes,
    maximumReferences: 1024,
  },
  includeAcceptedWarnings: false,
};
const maxReferenceReadBytes = 2 * 1024 * 1024;
function requireBatch(expected: number, next: number) {
  if (!Number.isSafeInteger(expected) || expected < 0 || expected > next)
    throw new ConvexError('Batch sequence changed; inspect status');
  return expected < next;
}
async function candidateFor(
  ctx: Pick<MutationCtx, 'db'>,
  runId: Id<'initialMigrationRun'>,
  characterId: Id<'character'>,
) {
  return ctx.db
    .query('initialMigrationCandidate')
    .withIndex('by_runId_and_characterId', (q) =>
      q.eq('runId', runId).eq('characterId', characterId),
    )
    .unique();
}
async function buildBatch(
  ctx: MutationCtx,
  args: Receipt & { expectedBatch: number },
  state: BackfillState,
) {
  if (
    requireBatch(args.expectedBatch, state.nextBatch) ||
    state.isInventoryDone
  )
    return state;
  const page = await ctx.db
    .query('character')
    .withIndex('by_creation_time')
    .paginate({
      cursor: state.cursor,
      numItems: 2,
      maximumRowsRead: 2,
      maximumBytesRead: 1024 * 1024,
    });
  for (const character of page.page) {
    if (await candidateFor(ctx, args.runId, character._id))
      throw new ConvexError('Duplicate input capture');
    let input: string | null = null;
    let error: string | null = null;
    let mode = character.sheetMode ?? 'full';
    try {
      if (character.sheetMode) {
        if (await hasCompanionCalculationDependencies(ctx, character))
          throw new ConvexError(
            'Initial backfill linked Companion calculations require the companion capture adapter',
          );
        const sheet = await readCharacterSheetData(
          ctx,
          character,
          sheetReadLimits,
        );
        input = JSON.stringify({
          entries: sheet.entries,
          catalogEntries: sheet.catalogEntries,
          characterKind: character.kind,
          sheetMode: character.sheetMode,
        } satisfies CharacterSheetInput);
      } else {
        const existing = await ctx.db
          .query('characterSheetEntry')
          .withIndex('by_characterId', (q) =>
            q.eq('characterId', character._id),
          )
          .take(1);
        const definitions = await ctx.db
          .query('catalogEntry')
          .withIndex('by_characterId_and_browseOnly', (q) =>
            q.eq('characterId', character._id).eq('browseOnly', undefined),
          )
          .take(1);
        if (existing.length || definitions.length)
          throw new Error(
            'Uninitialized Character has recorded sheet data; preserve and reconcile it explicitly',
          );
        const campaignId = character.campaignId;
        const militia = campaignId
          ? await ctx.db
              .query('militia')
              .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
              .take(2)
          : [];
        if (militia.length > 1)
          throw new Error('Campaign has multiple militias');
        const mapped = mapLegacyCharacter({
          character,
          hasMilitia: militia.length === 1,
        });
        mode = mapped.sheetMode;
        input = JSON.stringify(mapped.input);
      }
      if (
        new TextEncoder().encode(input).byteLength >
        maxLegacyCharacterCandidateBytes
      )
        throw new Error('Candidate exceeds the 768KiB resource limit');
    } catch (failure) {
      input = null;
      error = failure instanceof Error ? failure.message : String(failure);
    }
    await ctx.db.insert('initialMigrationCandidate', {
      ...argsWithoutBatch(args),
      characterId: character._id,
      characterHash: await sha256(
        new TextEncoder().encode(weeklySourceKey(character)),
      ),
      input,
      sheetMode: mode,
      isInitialized: Boolean(character.sheetMode),
      error,
    });
  }
  const next = {
    ...state,
    cursor: page.continueCursor,
    isInventoryDone: page.isDone,
    captured: state.captured + page.page.length,
    nextBatch: state.nextBatch + 1,
  };
  await ctx.db.patch('initialMigrationRun', args.runId, { backfill: next });
  return next;
}
function argsWithoutBatch(args: Receipt): Receipt {
  return { runId: args.runId, epoch: args.epoch, captureId: args.captureId };
}

export const batch = internalMutation({
  args: batchArgs,
  returns: backfillStateValidator,
  handler: async (ctx, args) => {
    const { state } = await requireCapturedBackfillRun(ctx, args);
    if (state.driver?.isRunning)
      throw new ConvexError('Stop the driver before manual continuation');
    return buildBatch(ctx, args, state);
  },
});
// Operator synonym; retries share the same idempotent implementation.
export const resume = batch;

async function checkReferences(
  ctx: MutationCtx,
  campaignId: Id<'campaign'>,
  references: string[],
  messages: string[],
) {
  const characters = new Map<string, Doc<'character'>>();
  if (references.length > 1024) {
    messages.push(
      'Character references exceed the 1024-reference resource limit',
    );
    return characters;
  }
  let bytes = 0;
  for (const reference of references) {
    const id = ctx.db.normalizeId('character', reference);
    const character = id && (await ctx.db.get('character', id));
    bytes += jsonBytes(character);
    if (bytes > maxReferenceReadBytes) {
      messages.push('Character references exceed the 2MiB read resource limit');
      return characters;
    }
    if (character?.campaignId !== campaignId)
      messages.push(
        `Character reference ${reference} is missing or belongs to another campaign`,
      );
    else characters.set(reference, character);
  }
  return characters;
}
async function checkCharacterAccess(
  ctx: MutationCtx,
  character: Doc<'character'>,
  sheetMode: Doc<'initialMigrationCandidate'>['sheetMode'],
  messages: string[],
) {
  const campaignId = character.campaignId;
  const ownerId = character.ownerId;
  const campaign = campaignId ? await ctx.db.get('campaign', campaignId) : null;
  if (character.campaignId && !campaign?.organizationId.trim())
    messages.push('Character campaign or organization scope is missing');
  if (!character.campaignId) {
    const owner = ownerId
      ? await ctx.db
          .query('user')
          .withIndex('by_tokenIdentifier', (q) =>
            q.eq('tokenIdentifier', ownerId),
          )
          .unique()
      : null;
    if (!owner)
      messages.push('Private Character has no surviving owner access');
  }
  const militias = campaignId
    ? await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
        .take(2)
    : [];
  if (militias.length > 1) messages.push('Campaign has multiple militias');
  if (sheetMode === 'militiaOnly' && (!campaign || militias.length !== 1))
    messages.push('Militia-only presentation requires a campaign militia');
  return { campaign, militias };
}

async function checkCharacter(
  ctx: MutationCtx,
  args: Receipt,
  character: Doc<'character'>,
  messages: string[],
) {
  const candidate = await candidateFor(ctx, args.runId, character._id);
  if (
    candidate?.epoch !== args.epoch ||
    candidate.captureId !== args.captureId
  ) {
    messages.push('Character has no candidate for this input capture');
    return;
  }
  if (candidate.error) messages.push(candidate.error);
  if (
    candidate.characterHash !==
    (await sha256(new TextEncoder().encode(weeklySourceKey(character))))
  )
    messages.push('Recorded Character changed after input capture');
  const { campaign, militias } = await checkCharacterAccess(
    ctx,
    character,
    candidate.sheetMode,
    messages,
  );
  if (!candidate.input) {
    messages.push('Character candidate has no sheet input');
    return;
  }
  await checkCandidateInput(
    ctx,
    character,
    candidate,
    campaign,
    militias,
    messages,
  );
}

async function checkCandidateInput(
  ctx: MutationCtx,
  character: Doc<'character'>,
  candidate: Doc<'initialMigrationCandidate'>,
  campaign: Doc<'campaign'> | null,
  militias: Doc<'militia'>[],
  messages: string[],
) {
  if (!candidate.input) return;
  try {
    // Compare serialized capture to typed current inputs before resolving it.
    const recorded: unknown = JSON.parse(candidate.input);
    const sheet = candidate.isInitialized
      ? await readCharacterSheetData(ctx, character, sheetReadLimits)
      : null;
    const input: CharacterSheetInput = sheet
      ? {
          entries: sheet.entries,
          catalogEntries: sheet.catalogEntries,
          characterKind: character.kind,
          sheetMode: character.sheetMode,
        }
      : mapLegacyCharacter({ character, hasMilitia: militias.length === 1 })
          .input;
    if (
      input.sheetMode !== candidate.sheetMode ||
      (character.sheetMode && candidate.sheetMode !== character.sheetMode)
    )
      messages.push('Candidate presentation differs from recorded sheet mode');
    if (weeklySourceKey(recorded) !== weeklySourceKey(input)) {
      messages.push(
        candidate.isInitialized
          ? 'Recorded sheet input changed after capture'
          : 'Candidate structure differs from the recorded legacy mapping',
      );
      return;
    }
    const facts = [
      await calculateMilitiaCharacterFacts(
        ctx,
        character,
        campaign?.e2eFixture ? sheet : null,
        { trustedLinkedInputs: true },
      ),
    ];
    for (const militia of militias) {
      const source = await ctx.db
        .query('canonicalMilitiaState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
        .unique();
      facts.push(
        ...(source?.snapshot.characters.filter(
          (fact) => fact.characterId === character._id,
        ) ?? []),
      );
    }
    for (const mismatch of compareLegacyCharacterCandidate({
      character,
      input,
      facts,
    }).mismatches)
      messages.push(
        `${mismatch.source}.${mismatch.field}: expected ${JSON.stringify(mismatch.expected)}, received ${JSON.stringify(mismatch.actual)}`,
      );
  } catch (failure) {
    messages.push(failure instanceof Error ? failure.message : String(failure));
  }
}

function companionSourceReferences(
  row: Doc<'companionRelationship'>,
  messages: string[],
) {
  if (!row.sources.length) {
    messages.push(
      'Companion supporting sources require at least one contribution',
    );
    return null;
  }
  if (row.sources.length > 128) {
    messages.push(
      'Companion supporting sources exceed the 1–128 source resource limit',
    );
    return null;
  }
  const keys = new Set<string>();
  const references = new Set<string>();
  let depth = 0;
  for (const source of row.sources) {
    if (!source.key.trim() || !source.label.trim() || keys.has(source.key))
      messages.push(
        'Companion supporting sources require unique keys and names',
      );
    keys.add(source.key);
    if (source.sheetEntryId && source.grantKey)
      messages.push('Companion supporting source has conflicting references');
    if (source.grantKey) references.add(source.grantKey.entry);
    // Unavailable historical Grants are retained. Decode every intermediate
    // identity so an existing foreign entry cannot hide inside a nested key.
    let reference = source.sheetEntryId ?? source.grantKey?.source;
    while (reference?.startsWith('grant:')) {
      if (++depth > 1024) {
        messages.push(
          'Companion supporting sources exceed the 1024-reference resource limit',
        );
        return null;
      }
      const parsed = parseGrantKeyId(reference, { requireComplete: true });
      if (!parsed) {
        messages.push('Companion supporting Grant has an invalid source key');
        reference = undefined;
        break;
      }
      references.add(parsed.entry);
      reference = parsed.source;
    }
    if (reference) references.add(reference);
    if (references.size > 1024) {
      messages.push(
        'Companion supporting sources exceed the 1024-reference resource limit',
      );
      return null;
    }
  }
  return references;
}

async function checkCompanionSources(
  ctx: MutationCtx,
  row: Doc<'companionRelationship'>,
  associatedCharacter: Doc<'character'> | null,
  messages: string[],
) {
  const references = companionSourceReferences(row, messages);
  if (!references) return;
  let bytes = 0;
  for (const reference of references) {
    const entryId = ctx.db.normalizeId('characterSheetEntry', reference);
    if (entryId) {
      const entry = await ctx.db.get('characterSheetEntry', entryId);
      bytes += jsonBytes(entry);
      if (entry && entry.characterId !== row.associatedCharacterId)
        messages.push(
          'Companion supporting source belongs to another Character',
        );
      if (
        entry &&
        ['base', 'abilityDamage', 'abilityDrain'].includes(entry.kind)
      )
        messages.push(
          'Companion supporting source is not a Class Level, Grant or Selection',
        );
    }
    const definitionId = ctx.db.normalizeId('catalogEntry', reference);
    if (definitionId) {
      const definition = await ctx.db.get('catalogEntry', definitionId);
      bytes += jsonBytes(definition);
      if (
        definition &&
        definition.scope !== 'global' &&
        !(
          definition.scope === 'campaign' &&
          associatedCharacter?.campaignId &&
          definition.campaignId === associatedCharacter.campaignId
        ) &&
        !(
          definition.scope === 'character' &&
          definition.characterId === row.associatedCharacterId
        )
      )
        messages.push(
          'Companion supporting source belongs to another Character',
        );
    }
    if (bytes > maxReferenceReadBytes) {
      messages.push(
        'Companion supporting sources exceed the 2MiB read resource limit',
      );
      return;
    }
  }
}

type ValidationState = Exclude<BackfillState, { stage: 'building' }>;
type ValidationPhase = BackfillState['validationPhase'];
type Diagnostic = { scope: string; message: string };
type PhaseResult = {
  isDone: boolean;
  cursor: string;
  rows: number;
  diagnostics: Diagnostic[];
};
type PhaseHandler = (
  ctx: MutationCtx,
  receipt: Receipt,
  state: ValidationState,
) => Promise<PhaseResult>;
const phaseTables = {
  characters: 'character',
  candidates: 'initialMigrationCandidate',
  sources: 'canonicalMilitiaState',
  relationships: 'companionRelationship',
  sheetEntries: 'characterSheetEntry',
  catalogEntries: 'catalogEntry',
  warnings: 'acceptedWarning',
  spells: 'characterSpell',
  drafts: 'canonicalWeeklyDraft',
} as const;
const costlyPhases = new Set<ValidationPhase>([
  'characters',
  'sources',
  'relationships',
  'drafts',
]);
function phasePagination(state: BackfillState) {
  return {
    cursor: state.validationCursor,
    // At most two 2MiB reference sets or two 768KiB sheets. Simple scans
    // reserve space for up to eight 1MiB Characters (four with Spell reads).
    numItems: costlyPhases.has(state.validationPhase)
      ? 2
      : state.validationPhase === 'spells'
        ? 4
        : 8,
    maximumRowsRead: costlyPhases.has(state.validationPhase)
      ? 2
      : state.validationPhase === 'spells'
        ? 4
        : 8,
    maximumBytesRead: 1024 * 1024,
  };
}
function phaseResult<T extends { _id: string }>(
  page: { page: T[]; isDone: boolean; continueCursor: string },
  diagnostics: Diagnostic[],
): PhaseResult {
  return {
    isDone: page.isDone,
    cursor: page.continueCursor,
    rows: page.page.length,
    diagnostics,
  };
}
async function inspectRows<T extends { _id: string }>(
  rows: T[],
  inspect: (row: T, messages: string[]) => Promise<void>,
) {
  const diagnostics: Diagnostic[] = [];
  for (const row of rows) {
    const messages: string[] = [];
    await inspect(row, messages);
    diagnostics.push(
      ...messages.map((message) => ({ scope: row._id, message })),
    );
  }
  return diagnostics;
}
const checkCharacters: PhaseHandler = async (ctx, receipt, state) => {
  const page = await ctx.db
    .query('character')
    .withIndex('by_creation_time')
    .paginate(phasePagination(state));
  return phaseResult(
    page,
    await inspectRows(page.page, (row, messages) =>
      checkCharacter(ctx, receipt, row, messages),
    ),
  );
};
const checkCandidates: PhaseHandler = async (ctx, receipt, state) => {
  const page = await ctx.db
    .query('initialMigrationCandidate')
    .withIndex('by_runId_and_characterId', (q) => q.eq('runId', receipt.runId))
    .paginate(phasePagination(state));
  const diagnostics = await inspectRows(page.page, async (row, messages) => {
    if (
      row.epoch !== receipt.epoch ||
      row.captureId !== receipt.captureId ||
      !(await ctx.db.get('character', row.characterId))
    )
      messages.push(
        'Candidate input capture is foreign or its Character is missing',
      );
  });
  if (
    page.isDone &&
    (state.validatedCharacters !== state.captured ||
      state.validatedCandidates + page.page.length !== state.captured)
  )
    diagnostics.push({
      scope: 'candidates',
      message:
        'Character and candidate coverage does not match the captured inventory',
    });
  return phaseResult(page, diagnostics);
};
const checkSources: PhaseHandler = async (ctx, _receipt, state) => {
  const page = await ctx.db
    .query('canonicalMilitiaState')
    .withIndex('by_creation_time')
    .paginate(phasePagination(state));
  return phaseResult(
    page,
    await inspectRows(page.page, async (row, messages) => {
      const parsed = militiaSnapshotSchema.safeParse(row.snapshot);
      if (!parsed.success)
        messages.push(
          ...parsed.error.issues.map(
            (issue) =>
              `Militia snapshot ${issue.path.join('.')}: ${issue.message}`,
          ),
        );
      const militia = await ctx.db.get('militia', row.militiaId);
      if (militia?.campaignId !== row.campaignId)
        messages.push('Militia source scope is missing or inconsistent');
      const campaign = await ctx.db.get('campaign', row.campaignId);
      if (!campaign?.organizationId.trim())
        messages.push(
          'Militia source campaign or organization scope is missing',
        );
      const characters = await checkReferences(
        ctx,
        row.campaignId,
        militiaSnapshotCharacterReferences(row.snapshot),
        messages,
      );
      for (const person of row.snapshot.roster.people) {
        const character = characters.get(person.characterId);
        if (character && character.kind !== person.kind)
          messages.push(
            `Roster kind for ${person.characterId} differs from the Character`,
          );
      }
    }),
  );
};
const checkRelationships: PhaseHandler = async (ctx, _receipt, state) => {
  const page = await ctx.db
    .query('companionRelationship')
    .withIndex('by_creation_time')
    .paginate(phasePagination(state));
  return phaseResult(
    page,
    await inspectRows(page.page, async (row, messages) => {
      const first = await ctx.db.get('character', row.associatedCharacterId);
      const second = await ctx.db.get('character', row.companionCharacterId);
      if (!first || !second)
        messages.push('Companion Relationship has a missing endpoint');
      if (
        row.status === 'active' &&
        first &&
        second &&
        (first.campaignId !== second.campaignId ||
          (!first.campaignId && first.ownerId !== second.ownerId))
      )
        messages.push(
          'Active Companion Relationship crosses campaign or owner access scope',
        );
      await checkCompanionSources(ctx, row, first, messages);
    }),
  );
};
const checkSheetReferences: PhaseHandler = async (ctx, _receipt, state) => {
  const phase = state.validationPhase;
  if (
    phase !== 'sheetEntries' &&
    phase !== 'catalogEntries' &&
    phase !== 'warnings' &&
    phase !== 'spells'
  )
    throw new Error('Invalid sheet reference phase');
  const page = await ctx.db
    .query(phaseTables[phase])
    .withIndex('by_creation_time')
    .paginate(phasePagination(state));
  return phaseResult(
    page,
    await inspectRows(page.page, async (row, messages) => {
      if ('scope' in row) {
        try {
          requireCatalogDefinitionScope(row);
        } catch (failure) {
          messages.push(
            failure instanceof Error ? failure.message : String(failure),
          );
          return;
        }
        if (row.scope === 'global') return;
        if (row.scope === 'campaign') {
          if (
            !row.campaignId ||
            !(await ctx.db.get('campaign', row.campaignId))
          )
            messages.push('Catalog Entry campaign scope is missing');
          return;
        }
      }
      if (!row.characterId) {
        messages.push('Recorded sheet or spell reference has no Character');
        return;
      }
      if (!(await ctx.db.get('character', row.characterId)))
        messages.push('Recorded sheet or spell reference has no Character');
      if ('spellId' in row && !(await ctx.db.get('spell', row.spellId)))
        messages.push('Legacy spell reference has no Spell');
    }),
  );
};
const checkDrafts: PhaseHandler = async (ctx, _receipt, state) => {
  const page = await ctx.db
    .query('canonicalWeeklyDraft')
    .withIndex('by_creation_time')
    .paginate(phasePagination(state));
  return phaseResult(
    page,
    await inspectRows(page.page, async (row, messages) => {
      if (row.status !== 'open') return;
      const militia = await ctx.db.get('militia', row.militiaId);
      if (militia?.campaignId !== row.campaignId)
        messages.push(
          'Open Weekly Draft has inconsistent militia access scope',
        );
      const campaign = await ctx.db.get('campaign', row.campaignId);
      if (!campaign?.organizationId.trim())
        messages.push(
          'Open Weekly Draft campaign or organization scope is missing',
        );
      await checkReferences(
        ctx,
        row.campaignId,
        weeklyDraftCharacterReferences(row.draft),
        messages,
      );
    }),
  );
};
const phaseHandlers: Record<ValidationPhase, PhaseHandler> = {
  characters: checkCharacters,
  candidates: checkCandidates,
  sources: checkSources,
  relationships: checkRelationships,
  sheetEntries: checkSheetReferences,
  catalogEntries: checkSheetReferences,
  warnings: checkSheetReferences,
  spells: checkSheetReferences,
  drafts: checkDrafts,
  done: async () => ({ isDone: true, cursor: '', rows: 0, diagnostics: [] }),
};

function beginValidation(
  state: BackfillState,
  validationId: string,
  expectedValidationId: string | null,
): ValidationState {
  if (!state.isInventoryDone)
    throw new ConvexError('Finish the input capture before validation');
  if (!validationId.trim())
    throw new ConvexError('Supply a validation identity');
  if (state.validationId === validationId) return state;
  if (state.validationId !== expectedValidationId)
    throw new ConvexError(
      'Validation identity changed; inspect status before starting a sweep',
    );
  return {
    ...state,
    stage: 'validating',
    validationId,
    validationPhase: 'characters',
    validationCursor: null,
    nextValidationBatch: 0,
    validatedCharacters: 0,
    validatedCandidates: 0,
    errors: 0,
    completion: null,
    validationRows: {},
  };
}
export const startValidation = internalMutation({
  args: {
    ...backfillReceipt.fields,
    validationId: v.string(),
    expectedValidationId: v.union(v.string(), v.null()),
  },
  returns: backfillStateValidator,
  handler: async (ctx, args) => {
    const { state } = await requireCapturedBackfillRun(ctx, args);
    const next = beginValidation(
      state,
      args.validationId,
      args.expectedValidationId,
    );
    if (next.validationId !== state.validationId && next.driver?.isRunning) {
      next.driver = {
        ...next.driver,
        isRunning: false,
        stoppedBecause: 'operator',
      };
      next.driverGeneration += 1;
    }
    await ctx.db.patch('initialMigrationRun', args.runId, { backfill: next });
    return next;
  },
});
async function validateBatch(
  ctx: MutationCtx,
  args: Receipt & { validationId: string; expectedBatch: number },
  run: Doc<'initialMigrationRun'>,
  state: BackfillState,
) {
  if (state.stage === 'building')
    throw new ConvexError('Start validation explicitly before continuing');
  if (state.validationId !== args.validationId)
    throw new ConvexError('Validation sweep is no longer current');
  if (
    requireBatch(args.expectedBatch, state.nextValidationBatch) ||
    state.validationPhase === 'done'
  )
    return state;
  const result = await phaseHandlers[state.validationPhase](ctx, args, state);
  const diagnostics = result.diagnostics.slice(0, 128);
  if (result.diagnostics.length > diagnostics.length)
    diagnostics.push({
      scope: state.validationPhase,
      message: `${result.diagnostics.length - diagnostics.length} additional discrepancies exceed this batch's diagnostic limit; validation failed`,
    });
  for (const diagnostic of diagnostics)
    await ctx.db.insert('initialMigrationReport', {
      runId: args.runId,
      captureId: args.captureId,
      validationId: args.validationId,
      ...diagnostic,
    });
  const phase = result.isDone
    ? nextPhase[state.validationPhase]
    : state.validationPhase;
  const errors = state.errors + result.diagnostics.length;
  const progress = {
    ...state,
    validationPhase: phase,
    validationCursor: result.isDone ? null : result.cursor,
    nextValidationBatch: state.nextValidationBatch + 1,
    errors,
    validatedCharacters:
      state.validatedCharacters +
      (state.validationPhase === 'characters' ? result.rows : 0),
    validatedCandidates:
      state.validatedCandidates +
      (state.validationPhase === 'candidates' ? result.rows : 0),
    validationRows: {
      ...state.validationRows,
      [state.validationPhase]:
        (state.validationRows[state.validationPhase] ?? 0) + result.rows,
    },
  };
  const next: BackfillState =
    phase === 'done' && errors === 0
      ? {
          ...progress,
          stage: 'complete',
          completion: {
            ...argsWithoutBatch(args),
            validationId: args.validationId,
            schemaIdentity: catalogRuntimeCompatibility.schema,
            calculationIdentity: catalogRuntimeCompatibility.calculation,
            catalogManifest: run.catalogManifest,
          },
        }
      : {
          ...progress,
          stage: phase === 'done' ? 'failed' : 'validating',
          completion: null,
        };
  await ctx.db.patch('initialMigrationRun', args.runId, { backfill: next });
  return next;
}
export const validate = internalMutation({
  args: { ...batchArgs, validationId: v.string() },
  returns: backfillStateValidator,
  handler: async (ctx, args) => {
    const { run, state } = await requireCapturedBackfillRun(ctx, args);
    if (state.driver?.isRunning)
      throw new ConvexError('Stop the driver before manual continuation');
    return validateBatch(ctx, args, run, state);
  },
});

function remainingEstimate(state: BackfillState | null) {
  if (!state?.isCensusDone) return null;
  const characters = state.censusRows.characters ?? 0;
  let rowsRemaining = state.isInventoryDone
    ? 0
    : Math.max(0, characters - state.captured);
  let batchesRemaining = state.isInventoryDone ? 0 : rowsRemaining + 1;
  // Safe cast: phaseTables is keyed by exactly the phases before 'done'.
  const phases = Object.keys(phaseTables) as Exclude<ValidationPhase, 'done'>[];
  const currentPhase =
    state.validationPhase === 'done'
      ? phases.length
      : phases.indexOf(state.validationPhase);
  for (const [index, phase] of phases.entries()) {
    const total =
      phase === 'candidates' ? characters : (state.censusRows[phase] ?? 0);
    if (index < currentPhase) continue;
    const rows = Math.max(0, total - (state.validationRows[phase] ?? 0));
    rowsRemaining += rows;
    // Empty phases still need one bounded scan to certify their end.
    batchesRemaining += rows + 1;
  }
  return { rowsRemaining, batchesRemaining };
}
export const status = internalQuery({
  args: {
    ...backfillReceipt.fields,
    cursor: v.optional(v.union(v.string(), v.null())),
    now: v.optional(v.number()),
  },
  returns: v.object({
    isReceiptValid: v.boolean(),
    isActivationReady: v.boolean(),
    progress: v.union(backfillStateValidator, v.null()),
    estimate: v.union(
      v.null(),
      v.object({
        rowsRemaining: v.number(),
        batchesRemaining: v.number(),
        estimatedRemainingMs: v.union(v.number(), v.null()),
        remainingBudgetMs: v.union(v.number(), v.null()),
        isWithinBudget: v.union(v.boolean(), v.null()),
      }),
    ),
    reports: v.array(v.object({ scope: v.string(), message: v.string() })),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const { run, problem } = await findBackfillRunProblem(ctx, args);
    const progress = run?.backfill ?? null;
    const marker = progress?.completion;
    let isReceiptValid = problem === null;
    if (
      marker &&
      (marker.runId !== args.runId ||
        marker.epoch !== args.epoch ||
        marker.captureId !== args.captureId ||
        marker.validationId !== progress?.validationId ||
        progress?.stage !== 'complete' ||
        progress.errors !== 0 ||
        !progress.isInventoryDone ||
        progress.validationPhase !== 'done' ||
        marker.schemaIdentity !== catalogRuntimeCompatibility.schema ||
        marker.calculationIdentity !==
          catalogRuntimeCompatibility.calculation ||
        marker.catalogManifest !== run?.catalogManifest)
    )
      isReceiptValid = false;
    const isActivationReady =
      isReceiptValid &&
      progress?.stage === 'complete' &&
      marker !== null &&
      marker !== undefined &&
      (args.now === undefined || !run || args.now < run.deadline);
    const remaining = remainingEstimate(progress);
    const driver = progress?.driver;
    const estimatedRemainingMs =
      remaining &&
      driver?.isRunning &&
      driver.workSampleCount > 0 &&
      driver.workDurationMs > 0
        ? Math.ceil(
            (remaining.batchesRemaining * driver.workDurationMs) /
              driver.workSampleCount,
          )
        : remaining?.batchesRemaining === 0
          ? 0
          : null;
    const remainingBudgetMs =
      args.now !== undefined && run
        ? Math.max(0, run.deadline - args.now)
        : null;
    const estimate = remaining
      ? {
          ...remaining,
          estimatedRemainingMs,
          remainingBudgetMs,
          isWithinBudget:
            estimatedRemainingMs !== null && remainingBudgetMs !== null
              ? estimatedRemainingMs < remainingBudgetMs
              : null,
        }
      : null;
    const page = await ctx.db
      .query('initialMigrationReport')
      .withIndex('by_runId_and_validationId', (q) =>
        q
          .eq('runId', args.runId)
          .eq('validationId', progress?.validationId ?? ''),
      )
      .paginate({
        cursor: args.cursor ?? null,
        numItems: 20,
        maximumRowsRead: 20,
      });
    return {
      isReceiptValid,
      isActivationReady,
      progress,
      estimate,
      reports: page.page.map((row) => ({
        scope: row.scope,
        message: row.message,
      })),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const abortBeforeActivation = internalMutation({
  args: backfillReceipt.fields,
  returns: v.object({ epoch: v.number() }),
  handler: async (ctx, args): Promise<{ epoch: number }> => {
    const run = await ctx.db.get('initialMigrationRun', args.runId);
    if (run?.backfill?.captureId !== args.captureId)
      throw new ConvexError('Backfill input capture is no longer current');
    // The gate owner increments the epoch atomically, fencing every worker.
    // Recovery must remain possible when compatibility no longer matches.
    return abortInitialMigrationRun(ctx, args);
  },
});

async function startCapture(
  ctx: MutationCtx,
  args: Receipt,
): Promise<BackfillState> {
  const run = await requireClosedBackfillRun(ctx, args, {
    requireCapture: false,
  });
  if (!args.captureId.trim())
    throw new ConvexError('Supply an input capture identity');
  if (run.backfill) {
    if (run.backfill.captureId !== args.captureId)
      throw new ConvexError('This run already has an input capture');
    await requireClosedBackfillRun(ctx, args);
    return run.backfill;
  }
  const backfill = {
    captureId: args.captureId,
    stage: 'building' as const,
    cursor: null,
    schemaIdentity: catalogRuntimeCompatibility.schema,
    calculationIdentity: catalogRuntimeCompatibility.calculation,
    catalogManifest: run.catalogManifest,
    frontendBuild: run.frontendBuild,
    validatedCharacters: 0,
    validatedCandidates: 0,
    isInventoryDone: false,
    captured: 0,
    nextBatch: 0,
    validationId: null,
    nextValidationBatch: 0,
    validationPhase: 'characters' as const,
    validationCursor: null,
    errors: 0,
    validationRows: {},
    censusPhase: 'characters' as const,
    censusCursor: null,
    censusRows: {},
    isCensusDone: false,
    driverGeneration: 0,
    driver: null,
    completion: null,
  };
  await ctx.db.patch('initialMigrationRun', run._id, { backfill });
  return backfill;
}
export const start = internalMutation({
  args: backfillReceipt.fields,
  returns: backfillStateValidator,
  handler: startCapture,
});

const driverArgs = {
  ...backfillReceipt.fields,
  driverId: v.string(),
  generation: v.number(),
  tick: v.number(),
  expectedCaptureBatch: v.number(),
  expectedValidationBatch: v.number(),
  validationId: v.string(),
};
async function scheduleDriver(
  ctx: MutationCtx,
  receipt: Receipt,
  state: BackfillState,
): Promise<void> {
  const driver = state.driver;
  if (!driver?.isRunning) return;
  await ctx.scheduler.runAfter(0, internal.initialCharacterBackfill.drive, {
    ...argsWithoutBatch(receipt),
    driverId: driver.id,
    generation: driver.generation,
    tick: driver.nextTick,
    expectedCaptureBatch: state.nextBatch,
    expectedValidationBatch: state.nextValidationBatch,
    validationId: driver.validationId,
  });
}
async function censusBatch(
  ctx: MutationCtx,
  state: BackfillState,
): Promise<BackfillState> {
  const phase = state.censusPhase;
  if (phase === 'done') return state;
  if (phase === 'candidates')
    return {
      ...state,
      censusPhase: nextPhase[phase],
      censusCursor: null,
      censusRows: {
        ...state.censusRows,
        candidates: state.censusRows.characters ?? 0,
      },
    };
  const page = await ctx.db
    .query(phaseTables[phase])
    .withIndex('by_creation_time')
    .paginate({
      cursor: state.censusCursor,
      numItems: 128,
      maximumRowsRead: 128,
      maximumBytesRead: 1024 * 1024,
    });
  const next = page.isDone ? nextPhase[phase] : phase;
  return {
    ...state,
    censusPhase: next,
    censusCursor: page.isDone ? null : page.continueCursor,
    isCensusDone: next === 'done',
    censusRows: {
      ...state.censusRows,
      [phase]: (state.censusRows[phase] ?? 0) + page.page.length,
    },
  };
}

export const startDriver = internalMutation({
  args: {
    ...backfillReceipt.fields,
    driverId: v.string(),
    validationId: v.string(),
    expectedValidationId: v.union(v.string(), v.null()),
    expectedDriverGeneration: v.number(),
  },
  returns: backfillStateValidator,
  handler: async (ctx, args): Promise<BackfillState> => {
    await startCapture(ctx, args);
    const { run, state } = await requireCapturedBackfillRun(ctx, args);
    if (!args.driverId.trim() || !args.validationId.trim())
      throw new ConvexError('Supply driver and validation identities');
    if (state.driver?.id === args.driverId) {
      if (state.driver.validationId !== args.validationId)
        throw new ConvexError(
          'Driver identity already used for another validation',
        );
      return state;
    }
    if (
      state.driverGeneration !== args.expectedDriverGeneration ||
      state.driver?.isRunning
    )
      throw new ConvexError('Driver changed; inspect status before starting');
    if (Date.now() >= run.deadline)
      throw new ConvexError(
        'Maintenance budget exceeded; abort before activation',
      );
    let next = state;
    if (state.isInventoryDone)
      next = beginValidation(
        state,
        args.validationId,
        args.expectedValidationId,
      );
    else if (args.expectedValidationId !== null)
      throw new ConvexError('Validation has not started');
    const generation = next.driverGeneration + 1;
    next = {
      ...next,
      driverGeneration: generation,
      driver: {
        id: args.driverId,
        validationId: args.validationId,
        generation,
        nextTick: 0,
        isRunning: true,
        startedAt: Date.now(),
        batches: 0,
        workDurationMs: 0,
        workSampleCount: 0,
        lastBatchStartedAt: null,
        stoppedBecause: null,
      },
    };
    await ctx.db.patch('initialMigrationRun', args.runId, { backfill: next });
    await scheduleDriver(ctx, args, next);
    return next;
  },
});

export const drive = internalMutation({
  args: driverArgs,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { run, problem } = await findBackfillRunProblem(ctx, args);
    const state = run?.backfill;
    const driver = state?.driver;
    // A stopped, superseded, duplicated or obsolete tick cannot write or enqueue.
    if (
      problem ||
      !run ||
      !state ||
      !driver?.isRunning ||
      driver.id !== args.driverId ||
      driver.generation !== args.generation ||
      state.driverGeneration !== args.generation ||
      driver.nextTick !== args.tick ||
      driver.validationId !== args.validationId ||
      state.nextBatch !== args.expectedCaptureBatch ||
      state.nextValidationBatch !== args.expectedValidationBatch ||
      (state.validationId !== null && state.validationId !== args.validationId)
    )
      return null;
    if (Date.now() >= run.deadline) {
      await ctx.db.patch('initialMigrationRun', args.runId, {
        backfill: {
          ...state,
          driverGeneration: state.driverGeneration + 1,
          driver: { ...driver, isRunning: false, stoppedBecause: 'budget' },
        },
      });
      return null;
    }
    const workStartedAt = Date.now();
    let next: BackfillState;
    if (!state.isCensusDone) next = await censusBatch(ctx, state);
    else if (!state.isInventoryDone)
      next = await buildBatch(
        ctx,
        { ...args, expectedBatch: state.nextBatch },
        state,
      );
    else if (state.stage === 'building')
      next = beginValidation(state, args.validationId, null);
    else
      next = await validateBatch(
        ctx,
        { ...args, expectedBatch: state.nextValidationBatch },
        run,
        state,
      );
    const hasFinished = next.stage === 'complete' || next.stage === 'failed';
    next = {
      ...next,
      driver: {
        ...driver,
        nextTick: driver.nextTick + 1,
        batches: driver.batches + (state.isCensusDone ? 1 : 0),
        workDurationMs:
          driver.workDurationMs +
          (state.isCensusDone && driver.lastBatchStartedAt !== null
            ? Math.max(0, workStartedAt - driver.lastBatchStartedAt)
            : 0),
        workSampleCount:
          driver.workSampleCount +
          (state.isCensusDone && driver.lastBatchStartedAt !== null ? 1 : 0),
        lastBatchStartedAt: state.isCensusDone ? workStartedAt : null,
        isRunning: !hasFinished,
        stoppedBecause: hasFinished ? 'finished' : null,
      },
    };
    await ctx.db.patch('initialMigrationRun', args.runId, { backfill: next });
    await scheduleDriver(ctx, args, next);
    return null;
  },
});

export const stopDriver = internalMutation({
  args: {
    ...backfillReceipt.fields,
    driverId: v.string(),
    generation: v.number(),
  },
  returns: backfillStateValidator,
  handler: async (ctx, args) => {
    const { state } = await requireCapturedBackfillRun(ctx, args);
    const driver = state.driver;
    if (driver?.id !== args.driverId || driver.generation !== args.generation)
      throw new ConvexError('Driver is no longer current');
    if (!driver.isRunning) return state;
    const next: BackfillState = {
      ...state,
      driverGeneration: state.driverGeneration + 1,
      driver: { ...driver, isRunning: false, stoppedBecause: 'operator' },
    };
    await ctx.db.patch('initialMigrationRun', args.runId, { backfill: next });
    return next;
  },
});
