import { readSelectedCanonicalMilitiaState } from './selectedCanonicalMilitiaState';
import { draftReviewRequirement } from '../../src/lib/weekly-draft-review';
import { compareValues } from 'convex/values';
import { actionChoiceEvents } from '../../src/lib/weekly-draft-facts';
import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { weeklyDraftDataSchema } from '../../src/lib/weekly-draft-contract';
import {
  projectRosterWeek,
  rosterChoiceIssues,
} from '../../src/lib/roster-week-impact';
import { writeDraftTargets } from './canonicalDraftTargets';

type Draft = ReturnType<typeof weeklyDraftDataSchema.parse>;
type Event = Draft['event']['occurrences'][number];
type Decision = Draft['persistent']['decisions'][number];

function clearDecisionCharacter(
  decision: Decision | undefined,
  characterId: string,
) {
  if (decision?.kind !== 'mitigate') return false;
  let changed = false;
  if (decision.officerCheck?.characterId === characterId) {
    delete decision.officerCheck;
    changed = true;
  }
  if (decision.overseerCharacterId === characterId) {
    delete decision.overseerCharacterId;
    changed = true;
  }
  if (changed) decision.reviewRequired = true;
  return changed;
}

function clearEventCharacter(event: Event, characterId: string) {
  const before = structuredClone(event);
  if (event.officerCheck?.characterId === characterId)
    delete event.officerCheck;
  if (event.overseerCharacterId === characterId)
    delete event.overseerCharacterId;
  if (event.targets)
    event.targets = event.targets.filter(
      (target) =>
        target.kind !== 'character' || target.characterId !== characterId,
    );
  if (event.targetChecks)
    event.targetChecks = event.targetChecks.filter(
      ({ target }) =>
        target.kind !== 'character' || target.characterId !== characterId,
    );
  if (event.rewards)
    event.rewards = event.rewards.filter(
      (reward) => reward.characterId !== characterId,
    );
  clearDecisionCharacter(event.persistentDecision, characterId);
  const changed = compareValues(before, event) !== 0;
  if (changed) event.reviewRequired = true;
  return changed;
}

function clearDraftEventCharacters(draft: Draft, characterId: string) {
  const targets: string[] = [];
  const reviewedSubjects = new Set<string>();
  const reopenReview = (eventId: string) =>
    reviewedSubjects.add(draftReviewRequirement({ kind: 'event', eventId }));
  for (const event of draft.context.carriedEvents) {
    const retained = event.targets.filter(
      (target) =>
        target.kind !== 'character' || target.characterId !== characterId,
    );
    if (retained.length !== event.targets.length) {
      event.targets = retained;
      event.reviewRequired = true;
      reopenReview(event.eventId);
      targets.push(JSON.stringify(['context', 'carriedEvents', event.eventId]));
      targets.push(JSON.stringify(['persistent', event.eventId]));
    }
  }
  for (const event of draft.event.occurrences)
    if (clearEventCharacter(event, characterId)) {
      reopenReview(event.eventId);
      targets.push(JSON.stringify(['event', 'tree', event.eventId]));
    }
  for (const decision of draft.persistent.decisions)
    if (clearDecisionCharacter(decision, characterId)) {
      reopenReview(decision.eventId);
      targets.push(JSON.stringify(['persistent', decision.eventId]));
    }
  for (const slot of draft.activity.slots) {
    let changed = false;
    for (const event of actionChoiceEvents(slot.choice))
      if (clearEventCharacter(event, characterId)) {
        reopenReview(event.eventId);
        changed = true;
      }
    if (changed && slot.choice) {
      slot.choice.reviewRequired = true;
      targets.push(JSON.stringify(['slot', slot.slotId]));
    }
  }
  draft.acknowledgements = draft.acknowledgements.filter((entry) => {
    if (!reviewedSubjects.has(entry.subjectId)) return true;
    targets.push(JSON.stringify(['acknowledgement', entry.acknowledgementId]));
    return false;
  });
  return targets;
}

export async function removeCharacterDepartureAssignments(
  ctx: MutationCtx,
  args: {
    sourceCampaignId?: Id<'campaign'>;
    characterId: Id<'character'>;
    characterName: string;
    actor: string;
  },
) {
  const sourceCampaignId = args.sourceCampaignId;
  if (!sourceCampaignId) return;
  const militia = await ctx.db
    .query('militia')
    .withIndex('by_campaign', (q) => q.eq('campaignId', sourceCampaignId))
    .unique();
  if (!militia) return;
  const source = await readSelectedCanonicalMilitiaState(ctx, militia._id);
  if (!source) return;
  const before = source.snapshot;
  const characterId = args.characterId;
  const snapshot = {
    ...before,
    characters: before.characters.filter(
      (row) => row.characterId !== characterId,
    ),
    ...(before.economy
      ? {
          economy: {
            ...before.economy,
            items: before.economy.items.map((item) => {
              if (item.ownerCharacterId !== characterId) return item;
              const { ownerCharacterId: _owner, ...retained } = item;
              return retained;
            }),
          },
        }
      : {}),
    ...(before.characterActions
      ? {
          characterActions: {
            ...before.characterActions,
            people: before.characterActions.people.filter(
              (person) => person.characterId !== characterId,
            ),
          },
        }
      : {}),
    ...(before.eventBenefits
      ? {
          eventBenefits: {
            ...before.eventBenefits,
            skills: before.eventBenefits.skills.map((benefit) => ({
              ...benefit,
              characterIds: benefit.characterIds.filter(
                (id) => id !== characterId,
              ),
            })),
          },
        }
      : {}),
    roster: {
      ...before.roster,
      people: before.roster.people.filter(
        (row) => row.characterId !== characterId,
      ),
      officers: before.roster.officers.filter(
        (row) => row.characterId !== characterId,
      ),
      teams: before.roster.teams.map((row) =>
        row.managerCharacterId === characterId
          ? { ...row, managerCharacterId: null }
          : row,
      ),
    },
  };
  const draftRow = await ctx.db
    .query('canonicalWeeklyDraft')
    .withIndex('by_campaignId_and_status', (q) =>
      q.eq('campaignId', sourceCampaignId).eq('status', 'open'),
    )
    .unique();
  if (draftRow?.draft) {
    const draft = weeklyDraftDataSchema.parse(draftRow.draft);
    const issues = rosterChoiceIssues(
      draft,
      projectRosterWeek(before, draft),
      projectRosterWeek(snapshot, draft),
    );
    const affectedSlots = new Set(
      issues.flatMap((issue) =>
        issue.location.kind === 'activitySlot' ? [issue.location.slotId] : [],
      ),
    );
    const changedManagers = new Set(
      before.roster.teams
        .filter((row) => row.managerCharacterId === characterId)
        .map((row) => row.teamId),
    );
    const officerChanged = before.roster.officers.some(
      (row) => row.characterId === characterId,
    );
    const targets = clearDraftEventCharacters(draft, characterId);
    for (const slot of draft.activity.slots) {
      const choice = slot.choice;
      if (!choice) continue;
      if (
        affectedSlots.has(slot.slotId) ||
        ('characterId' in choice && choice.characterId === characterId) ||
        (choice.teamId && changedManagers.has(choice.teamId)) ||
        (officerChanged && 'rolls' in choice)
      ) {
        slot.choice = { ...choice, reviewRequired: true };
        targets.push(JSON.stringify(['slot', slot.slotId]));
      }
    }
    if (compareValues(draft, draftRow.draft) !== 0) {
      draft.revision += 1;
      await ctx.db.patch('canonicalWeeklyDraft', draftRow._id, {
        draft: weeklyDraftDataSchema.parse(draft),
        revision: draft.revision,
      });
      await ctx.db.insert('canonicalDraftSourceReview', {
        campaignId: sourceCampaignId,
        militiaId: militia._id,
        draftId: draft.draftId,
        revision: draft.revision,
        acceptedDraft: weeklyDraftDataSchema.parse(draft),
      });
      await writeDraftTargets(
        ctx,
        {
          campaignId: sourceCampaignId,
          militiaId: militia._id,
          draftId: draft.draftId,
        },
        targets,
        draft.revision,
      );
    }
  }
  if (compareValues(before, snapshot) === 0) return;
  const storedRevision = source.storedRevision + 1;
  const effectiveRevision = source.revision + 1;
  await ctx.db.patch('canonicalMilitiaState', source._id, {
    snapshot,
    revision: storedRevision,
  });
  await ctx.db.insert('canonicalSourceCorrection', {
    campaignId: sourceCampaignId,
    militiaId: militia._id,
    expectedRevision: source.revision,
    revision: effectiveRevision,
    reason: `Automatic Character departure: ${args.characterName}`,
    actor: args.actor,
    createdAt: Date.now(),
  });
}
