import { readFile } from 'node:fs/promises';
import { parsePartyExceptions } from './party/party-exceptions.ts';
import {
  accountPartyReleaseScope,
  accountRefusedPartyInputs,
  describePartyScopeFailure,
  partyScopeIdentity,
  resolvePartyReleaseScope,
  type PartyScopeReport,
} from './party/party-release-scope.ts';
import { partyScopeVersion } from './party/party-scope.ts';
import {
  accountRefusedScopeInputs,
  accountReleaseScope,
  describeScopeFailure,
  launchInventoryScopes,
  previousBinding,
  readReleaseScope,
  releaseScopeContent,
  scopeContent,
  type ReleaseScopeReport,
} from './release-scope.ts';

/**
 * Every release scope the operator builds against: the launch-inventory
 * scope (`release-scope.ts`, campaign-mvp-v1) and the party scope
 * (party-scope research E; `party/party-release-scope.ts`). Only
 * `release-operator.ts` imports this module, so the party's documents never
 * enter the launch verification projection's inputs, which trace
 * `release-scope.ts`.
 */
const partyDocuments = {
  scope: new URL('./scopes/campaign-party-v1.json', import.meta.url),
  builds: new URL('./party/party-builds.json', import.meta.url),
  exceptions: new URL('./party/party-exceptions.json', import.meta.url),
} as const;
/** What a scoped build gives a scope to account for its release. */
type ScopeBuildInput = Omit<Parameters<typeof accountReleaseScope>[0], 'scope'>;
/** A scope's report, its release rows and its failure text. */
export type ScopeOutcome = {
  report: ReleaseScopeReport | PartyScopeReport;
  content: {
    binding: unknown;
    summary: { binding: unknown; qualification: unknown };
    chunks: unknown[];
  };
  describe: () => string;
};
/**
 * A release scope as the operator builds against it, for any known version:
 * its import set, the keys a `--pcgen` selection may emit (none for a scope
 * without PCGen rows), and its accounting of a build or of refused inputs.
 */
export type OperatorScope = {
  version: string;
  importKeys: string[];
  pcgenKeys: string[] | undefined;
  account: (input: ScopeBuildInput) => ScopeOutcome;
  refuse: (reason: string) => ScopeOutcome;
};

/** Opens a known scope's committed document, or a supplied copy compared with it. */
export async function openReleaseScope({
  version,
  manifestPath,
}: {
  version: string;
  manifestPath?: string;
}): Promise<OperatorScope> {
  if (version === partyScopeVersion) return openPartyScope(manifestPath);
  if (!launchInventoryScopes.includes(version))
    throw new Error(
      `Unknown release scope ${version}; known scopes: ${[...launchInventoryScopes, partyScopeVersion].join(', ')}.`,
    );
  const scope = await readReleaseScope({ version, manifestPath });
  const outcome = (report: ReleaseScopeReport): ScopeOutcome => ({
    report,
    content: releaseScopeContent(report),
    describe: () => describeScopeFailure(report),
  });
  return {
    version: scope.version,
    importKeys: scope.importKeys,
    pcgenKeys: undefined,
    account: (input) => outcome(accountReleaseScope({ scope, ...input })),
    refuse: (reason) => outcome(accountRefusedScopeInputs({ scope, reason })),
  };
}

async function openPartyScope(
  manifestPath: string | undefined,
): Promise<OperatorScope> {
  const committed = await readFile(partyDocuments.scope, 'utf8');
  const scope = resolvePartyReleaseScope({
    text:
      manifestPath === undefined
        ? committed
        : await readFile(manifestPath, 'utf8'),
    ...(manifestPath !== undefined && {
      committedIdentity: partyScopeIdentity(committed),
    }),
    buildsBytes: await readFile(partyDocuments.builds, 'utf8'),
    exceptions: parsePartyExceptions(
      JSON.parse(await readFile(partyDocuments.exceptions, 'utf8')),
    ),
  });
  const outcome = (report: PartyScopeReport): ScopeOutcome => ({
    report,
    content: scopeContent(report),
    describe: () => describePartyScopeFailure(report),
  });
  return {
    version: scope.version,
    importKeys: scope.importKeys,
    pcgenKeys: scope.keys,
    account: ({ artifact, gate, previous, refusal }) =>
      outcome(
        accountPartyReleaseScope({
          scope,
          artifact,
          gate,
          prior: previousBinding(previous),
          refusal,
        }),
      ),
    refuse: (reason) => outcome(accountRefusedPartyInputs({ scope, reason })),
  };
}
