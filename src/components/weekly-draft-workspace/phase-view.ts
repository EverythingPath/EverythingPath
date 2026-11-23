import { summaryView } from './summary-facts';
import { persistentView } from './persistent-facts';
import { eventView, type EventPreparationContext } from './event-facts';
import { activityView } from './activity-facts';
import { activityCandidateSets } from './activity-candidate-facts';
import { upkeepInputFacts } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import type { Phase, PhaseView } from './types';
import { rollReadFacts } from './roll-facts';
import { upkeepSections } from './upkeep-sections';
export function phaseView(
  phase: Phase,
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
  event?: EventPreparationContext,
): PhaseView {
  if (phase === 'summary') {
    const upkeep = phaseView('upkeep', draft, source, preview);
    if (upkeep.phase !== 'upkeep') throw new Error('Expected Upkeep facts');
    return summaryView(draft, source, preview, upkeep, event);
  }
  if (phase === 'activity')
    return {
      ...activityView(draft, source, preview),
      candidateSets: activityCandidateSets(draft, source, preview, event),
    };
  if (phase === 'event') return eventView(draft, source, preview, event);
  if (phase === 'persistent') return persistentView(draft, source, preview);
  const { projection, fields, minimumTreasuryCopper } = upkeepInputFacts(
    draft,
    source.snapshot,
  );
  const values = (state: WorkspaceSource['snapshot']) => ({
    rank: state.rank,
    training: state.training,
    treasuryCopper: state.treasuryCopper,
    notoriety: state.notoriety,
  });
  const rolls = fields.map((fact) => {
    const raw =
      fact.field === 'notorietyCheck'
        ? draft.upkeep.notorietyCheck
        : draft.upkeep.rolls[fact.field];
    const spec = { count: fact.count, sides: fact.sides };
    return {
      field: fact.field,
      ...spec,
      ...rollReadFacts(raw, spec),
      modifier: fact.check?.modifier ?? null,
      total: fact.check?.total ?? null,
      dc: fact.dc,
      modifiers: fact.check?.modifiers ?? [],
    };
  });
  const officers = source.snapshot.roster.people.map((person) => ({
    characterId: person.characterId,
    name:
      source.people.find((entry) => entry.characterId === person.characterId)
        ?.name ?? null,
    roles: source.snapshot.roster.officers
      .filter((officer) => officer.characterId === person.characterId)
      .map((officer) => officer.role),
  }));
  const transfers = structuredClone(draft.upkeep.treasuryTransfers);
  return {
    phase,
    skipped: projection.skipped,
    ready: projection.ready,
    before: values(source.snapshot),
    after: values(projection.outcome),
    minimumTreasuryCopper,
    rolls,
    officers,
    transfers,
    exceptions: [
      ...source.snapshot.roster.teams.flatMap((team) => [
        {
          subjectId: team.teamId,
          ruleId: 'upkeep-recovery-funds',
          requirement: `team:${team.teamId}:recovery-funds-exception`,
          name: team.name,
        },
      ]),
      ...draft.upkeep.treasuryTransfers.flatMap((transfer) =>
        (['funds'] as const).map((kind) => ({
          subjectId: transfer.transferId,
          ruleId: `upkeep-transfer-${kind}`,
          requirement: `transfer:${transfer.transferId}:${kind}-exception`,
          name:
            transfer.direction === 'deposit'
              ? 'Treasury deposit'
              : 'Treasury withdrawal',
        })),
      ),
    ].flatMap((candidate) => {
      const existing = draft.rulesExceptions.find(
        (exception) =>
          exception.subjectId === candidate.subjectId &&
          exception.ruleId === candidate.ruleId,
      );
      return projection.requirements.includes(candidate.requirement) || existing
        ? [
            {
              subjectId: candidate.subjectId,
              ruleId: candidate.ruleId,
              name: candidate.name,
              exceptionId:
                existing?.exceptionId ??
                `upkeep:${candidate.ruleId}:${candidate.subjectId}`,
              reason: existing?.reason ?? '',
            },
          ]
        : [];
    }),
    requirements: projection.requirements,
    warnings: projection.warnings,
    sections: projection.skipped
      ? null
      : upkeepSections({
          draft,
          source,
          projection,
          rolls,
          minimumTreasuryCopper,
          transfers,
          officers,
        }),
  };
}
