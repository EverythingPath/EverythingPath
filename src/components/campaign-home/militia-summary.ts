import { OFFICER_ROLES } from '~/lib/canonical-roster';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import { count } from '~/components/week-review/review-text';
import { teamStatusLabels } from '~/components/weekly-draft-workspace/week-frame/reference-copy';

type Snapshot = WorkspaceSource['snapshot'];

function teamsText(teams: Snapshot['roster']['teams']) {
  if (teams.length === 0) return 'No teams';
  // Every condition other than active, in the shared label order.
  const conditions = (['disabled', 'missing', 'blocked'] as const).flatMap(
    (status) => {
      const total = teams.filter((team) => team.status === status).length;
      return total
        ? [`${total} ${teamStatusLabels[status].toLowerCase()}`]
        : [];
    },
  );
  const base = count(teams.length, 'team', 'teams');
  return conditions.length ? `${base} (${conditions.join(', ')})` : base;
}

/**
 * The home's one-line militia facts from the current stored snapshot: rank,
 * focus, team conditions, occupied officer role categories out of six and
 * each settlement's stored attitude. Nothing is projected.
 */
export function militiaSummaryParts(snapshot: Snapshot): string[] {
  // Role categories, not holders: two commandants still fill one role.
  const roles = new Set(
    snapshot.roster.officers.map((officer) => officer.role),
  );
  const settlements = snapshot.settlements.length
    ? snapshot.settlements
        .map(
          (settlement) =>
            `${settlement.name} ${settlement.reputation ?? 'attitude unknown'}`,
        )
        .join(', ')
    : 'No settlements';
  return [
    `Rank ${snapshot.rank}`,
    snapshot.focus ?? 'Focus not set',
    teamsText(snapshot.roster.teams),
    `${roles.size} of ${OFFICER_ROLES.length} officer roles`,
    settlements,
  ];
}
