// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { readPartyExceptions } from '../../scripts/catalog/party/party-exceptions';
import {
  accountPartyReleaseScope,
  resolvePartyReleaseScope,
} from '../../scripts/catalog/party/party-release-scope';
import { scopeContent } from '../../scripts/catalog/release-scope';
import { openReleaseScope } from '../../scripts/catalog/release-scopes';
import { releaseRowBoundViolations } from './convex-value-bounds';

const text = await readFile(
  'scripts/catalog/scopes/campaign-party-v1.json',
  'utf8',
);
const buildsBytes = await readFile(
  'scripts/catalog/party/party-builds.json',
  'utf8',
);
const exceptions = await readPartyExceptions();
const resolved = resolvePartyReleaseScope({ text, buildsBytes, exceptions });
const noGate = {
  admitted: [],
  held: [],
  dependentOmissions: [],
  retainedExceptions: [],
  failures: [],
};
const noImport = { catalog: { entries: [], resources: [], remaps: [] } };

describe('campaign-party-v1 as a release scope', () => {
  it('binds the committed scope and imports its upstream rows; a --pcgen selection may emit only its rows', async () => {
    const scope = await openReleaseScope({ version: 'campaign-party-v1' });
    const { report } = scope.refuse('Release inputs refused: test');
    expect(report.binding).toEqual({
      version: 'campaign-party-v1',
      launchScopeIdentity: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      documentSha256: createHash('sha256').update(text).digest('hex'),
      roots: resolved.scope.roots.map(({ key }) => key).sort(),
      closureFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(report.binding.roots).toHaveLength(335);
    expect(report.qualification.findings).toEqual([]);
    expect(scope.pcgenKeys).toHaveLength(954);
    expect(scope.importKeys).toEqual(
      scope.pcgenKeys?.filter((key) => /^pf1(?:-content)?\//.test(key)),
    );
    expect(scope.importKeys).toHaveLength(728);
    // Refused inputs fail every row; nothing is served.
    expect(report.qualification).toMatchObject({
      status: 'FAILED',
      counts: { rows: 954, failedByCause: { unreleased: 954 } },
    });
  });

  it('finds a changed builds file and a comparison base binding another identity', () => {
    const changed = resolvePartyReleaseScope({
      text,
      buildsBytes: `${buildsBytes}\n`,
      exceptions,
    });
    expect(changed.findings).toEqual([
      expect.objectContaining({
        code: 'builds-drift',
        key: 'scripts/catalog/party/party-builds.json',
      }),
    ]);
    const report = accountPartyReleaseScope({
      scope: resolved,
      artifact: noImport,
      gate: noGate,
      prior: {
        version: 'campaign-party-v1',
        launchScopeIdentity: 'sha256:old',
      },
    });
    expect(report.qualification.findings).toEqual([
      expect.objectContaining({ code: 'previous-drift' }),
    ]);
    expect(
      accountPartyReleaseScope({
        scope: resolved,
        artifact: noImport,
        gate: noGate,
        prior: { version: 'campaign-mvp-v1', launchScopeIdentity: 'other' },
      }).qualification.findings,
    ).toEqual([]);
  });

  it('keeps every content:scope row inside the Convex value bounds, every row held with a long reason', () => {
    const reason = `Structure hand review (#716 plan §6): ${'item x; '.repeat(60)}`;
    const keys = resolved.scope.rows.map(({ key }) => key);
    const report = accountPartyReleaseScope({
      scope: resolved,
      artifact: {
        catalog: {
          entries: keys.map((externalKey) => ({ externalKey })),
          resources: [],
          remaps: [],
        },
      },
      gate: {
        ...noGate,
        held: keys.map((externalKey) => ({ externalKey, reason })),
      },
    });
    const { summary, chunks } = scopeContent(report);
    expect(chunks.length).toBeGreaterThan(1);
    const rows = [
      { kind: 'report', key: 'content:scope', payload: summary },
      ...chunks.map((payload, index) => ({
        kind: 'report',
        key: `content:scope:${index}`,
        payload,
      })),
    ];
    expect(rows.flatMap(releaseRowBoundViolations)).toEqual([]);
  });
});
