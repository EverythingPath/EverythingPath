import { parsePartyBuilds } from '../../scripts/catalog/party/party-builds';
import {
  accountPartyReleaseScope,
  resolvePartyReleaseScope,
} from '../../scripts/catalog/party/party-release-scope';
import {
  buildPartyScope,
  partyScopeBytes,
  type PartyCatalogEntry,
} from '../../scripts/catalog/party/party-scope';
import type { RuleValueStatus } from '../../scripts/catalog/rule-value-status';
import type { ReleaseRow } from '../../src/lib/catalog/release-schema';

/**
 * A small fixture party scope (one character: Human and Fighter) qualified
 * by the party rule (`party-qualification.ts`): both rows admitted give
 * QUALIFIED, Fighter held gives FAILED. Returned as the `content:scope`
 * summary row a scoped build stages (`releaseScopeContent`: its binding and
 * qualification).
 */
export function partyScopeSummary(status: 'QUALIFIED' | 'FAILED'): ReleaseRow {
  const report = partyScopeReport({
    fighterAdmitted: status === 'QUALIFIED',
  });
  if (report.qualification.status !== status)
    throw new Error(
      `The fixture party scope is ${report.qualification.status}.`,
    );
  return summaryRow(report);
}

/**
 * stats-d1 fix r2: the QUALIFIED fixture (both rows admitted) built with
 * `ruleValues` as its curation report's rule-value statuses, as the summary
 * row a scoped build stages.
 */
export function partyScopeSummaryWithRuleValues(
  ruleValues: RuleValueStatus[],
): ReleaseRow {
  return summaryRow(partyScopeReport({ fighterAdmitted: true, ruleValues }));
}

function summaryRow(report: ReturnType<typeof partyScopeReport>): ReleaseRow {
  return {
    kind: 'report',
    key: 'content:scope',
    payload: { binding: report.binding, qualification: report.qualification },
  };
}

function partyScopeReport({
  fighterAdmitted,
  ruleValues,
}: {
  fighterAdmitted: boolean;
  ruleValues?: RuleValueStatus[];
}) {
  const buildsBytes = JSON.stringify({
    schemaVersion: 1,
    scopeVersion: 'campaign-party-v1',
    note: 'Fixture.',
    characters: [
      {
        id: '1',
        kind: 'character',
        race: { kind: 'matched', key: 'pf1/human', name: 'Human' },
        levels: {
          kind: 'written',
          build: {
            now: [{ class: 'Fighter', level: 1 }],
            next: { kind: 'known', classes: [{ class: 'Fighter', level: 2 }] },
          },
        },
        keys: {
          classes: [{ kind: 'matched', key: 'pf1/fighter', name: 'Fighter' }],
        },
      },
    ],
  });
  const entry = (externalKey: string, name: string, kind: string) =>
    ({
      externalKey,
      name,
      description: '',
      detail: { kind },
    }) as PartyCatalogEntry;
  const text = partyScopeBytes(
    buildPartyScope({
      builds: parsePartyBuilds(JSON.parse(buildsBytes)),
      buildsBytes,
      catalog: {
        entries: [
          entry('pf1/human', 'Human', 'race'),
          entry('pf1/fighter', 'Fighter', 'class'),
        ],
        upstream: [],
      },
    }),
  );
  const scope = resolvePartyReleaseScope({ text, buildsBytes, exceptions: [] });
  const human = { externalKey: 'pf1/human', reason: 'Admitted.' };
  const fighter = { externalKey: 'pf1/fighter', reason: 'Admitted.' };
  return accountPartyReleaseScope({
    scope,
    artifact: {
      catalog: { entries: [human, fighter], resources: [], remaps: [] },
      ...(ruleValues && { curation: { ruleValues } }),
    },
    gate: {
      admitted: fighterAdmitted ? [human, fighter] : [human],
      held: fighterAdmitted
        ? []
        : [{ ...fighter, reason: 'Held under #227: notice holds PZO1110.' }],
      dependentOmissions: [],
      retainedExceptions: [],
      failures: [],
    },
  });
}
