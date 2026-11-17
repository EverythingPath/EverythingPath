import { createHash } from 'node:crypto';
import { canonicalReleaseJson } from '../../../src/lib/catalog/release-schema.ts';
import { classifyGate, type LaunchGate } from '../launch-verification.ts';
import { parsePartyBuilds } from './party-builds.ts';
import type { PartyException } from './party-exceptions.ts';
import {
  qualifyPartyScope,
  type PartyBuildState,
  type PartyScopeFinding,
} from './party-qualification.ts';
import { decodePartyScope } from './party-scope.ts';

/**
 * `campaign-party-v1` as a release scope (`release-scope.ts` registers it):
 * the committed party scope bound into a scoped build, its import set and
 * its qualification (`party-qualification.ts`) over the build's gate.
 */

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const upstreamKey = /^(?:pf1|pf1-content)\/[A-Za-z0-9]+$/;

/**
 * Reads a party scope document (`text`), the builds file it was generated
 * from and the recorded exceptions. `committedIdentity` is set only when
 * `text` is a supplied copy, which then must have the committed identity.
 */
export function resolvePartyReleaseScope({
  text,
  committedIdentity,
  buildsBytes,
  exceptions,
}: {
  text: string;
  committedIdentity?: string;
  buildsBytes: string;
  exceptions: readonly PartyException[];
}) {
  const scope = decodePartyScope(JSON.parse(text));
  const builds = parsePartyBuilds(JSON.parse(buildsBytes));
  const version = scope.scopeVersion;
  const identity = partyScopeIdentity(text);
  const findings: PartyScopeFinding[] = [];
  if (committedIdentity !== undefined && identity !== committedIdentity)
    findings.push({
      code: 'drift',
      key: version,
      reason: `The supplied scope's identity ${identity} differs from the committed ${version} identity ${committedIdentity}.`,
    });
  if (sha256(buildsBytes) !== scope.binding.builds.sha256)
    findings.push({
      code: 'builds-drift',
      key: scope.binding.builds.path,
      reason: `The builds file is not the one ${version} was generated from; regenerate it with pnpm -s catalog:party-scope --write.`,
    });
  const keys = scope.rows.map(({ key }) => key).sort();
  return {
    version,
    binding: {
      version,
      launchScopeIdentity: identity,
      documentSha256: sha256(text),
      roots: scope.roots.map(({ key }) => key).sort(),
      closureFingerprint: sha256(
        canonicalReleaseJson(scope.rows.map(({ key, kind }) => [key, kind])),
      ),
    },
    scope,
    builds,
    exceptions,
    findings,
    /** The upstream rows the import selects; everything else is emitted from them or by PCGen. */
    importKeys: keys.filter((key) => upstreamKey.test(key)),
    /** Every row's key: a `--pcgen` selection emits only owners and features named here. */
    keys,
  };
}
export type PartyReleaseScope = ReturnType<typeof resolvePartyReleaseScope>;

/** The scope as decoded, independent of its stored encoding: what a release binds. */
export function partyScopeIdentity(text: string) {
  return `sha256:${sha256(canonicalReleaseJson(decodePartyScope(JSON.parse(text))))}`;
}

/** The gate's view of the scope's rows, from a scoped build's import and gate. */
type PartyArtifact = {
  catalog: {
    entries: readonly { externalKey: string }[];
    resources: readonly { externalKey: string }[];
    remaps: readonly { from: string; to: string; applied: boolean }[];
  };
};

/**
 * The scope's report for a build that assessed its gates: `refusal` is set
 * when the release was then refused. `prior` is the comparison base's scope
 * binding, which must not bind this version with another identity.
 */
export function accountPartyReleaseScope({
  scope,
  artifact,
  gate,
  prior,
  refusal,
}: {
  scope: PartyReleaseScope;
  artifact: PartyArtifact;
  gate: LaunchGate;
  prior?: Record<string, unknown>;
  refusal?: string;
}) {
  const view = {
    classes: classifyGate(gate),
    missingNotices: new Map(
      gate.admitted.map(({ externalKey, missingNotices = [] }) => [
        externalKey,
        missingNotices,
      ]),
    ),
    imported: new Set(
      [...artifact.catalog.entries, ...artifact.catalog.resources].map(
        ({ externalKey }) => externalKey,
      ),
    ),
    remapped: new Map(
      artifact.catalog.remaps
        .filter(({ applied }) => applied)
        .map(({ from, to }) => [from, to]),
    ),
  };
  return partyReport(
    scope,
    refusal === undefined
      ? { stage: 'built', gate: view }
      : { stage: 'refused', reason: refusal, gate: view },
    prior,
  );
}

/** The scope's report when the build's inputs were refused before any gate. */
export function accountRefusedPartyInputs({
  scope,
  reason,
}: {
  scope: PartyReleaseScope;
  reason: string;
}) {
  return partyReport(scope, { stage: 'inputs-refused', reason });
}

function partyReport(
  scope: PartyReleaseScope,
  build: PartyBuildState,
  prior?: Record<string, unknown>,
) {
  const drift: PartyScopeFinding[] =
    prior?.version === scope.version &&
    prior.launchScopeIdentity !== scope.binding.launchScopeIdentity
      ? [
          {
            code: 'previous-drift',
            key: scope.version,
            reason: `The comparison base binds ${scope.version} as ${typeof prior.launchScopeIdentity === 'string' ? prior.launchScopeIdentity : 'another identity'}, not ${scope.binding.launchScopeIdentity}; a changed scope needs a new scope version.`,
          },
        ]
      : [];
  return {
    binding: scope.binding,
    ...qualifyPartyScope({
      scope: scope.scope,
      builds: scope.builds,
      exceptions: scope.exceptions,
      build,
      findings: [...scope.findings, ...drift],
    }),
  };
}
export type PartyScopeReport = ReturnType<typeof partyReport>;

/** The qualification's findings and the characters it doesn't serve, for the operator's error. */
export function describePartyScopeFailure(report: PartyScopeReport, limit = 5) {
  const { findings, counts, characters } = report.qualification;
  return [
    ...findings
      .slice(0, limit)
      .map(({ code, key, reason }) => `${code} ${key}: ${reason}`),
    ...characters
      .filter(({ served }) => !served)
      .map(
        ({ id, failing, unreleased }) =>
          `character ${id}: ${[...failing.map(({ name, cause }) => `${name} (${cause})`), ...(unreleased ? [`${unreleased} rows not released`] : [])].join(', ')}`,
      ),
    `${findings.length} scope findings; ${counts.failed} of ${counts.rows + counts.gaps} rows and names fail.`,
  ].join('\n');
}
