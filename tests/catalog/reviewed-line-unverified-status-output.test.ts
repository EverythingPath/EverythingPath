// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  checkedProjection,
  slow,
  useFixture,
  useStatusFixture,
} from './reviewed-line-unverified-fixture';

// The property (`reviewed-line-unverified-fixture.ts`) on
// `catalog:party-scope --status`: what it prints for the inputs as they are,
// that it takes no saved preview, and that it refuses a scope drift.

const probes = await vi.hoisted(
  () => import('./reviewed-line-unverified-probes'),
);
vi.mock('node:fs', probes.nodeFs);
vi.mock('node:fs/promises', probes.nodeFsPromises);
vi.mock('../../scripts/catalog/party/party-builds.ts', probes.partyBuilds);
vi.mock(
  '../../scripts/catalog/reviewed-data-files.ts',
  probes.reviewedDataFiles,
);
vi.mock('../../scripts/catalog/conditions.ts', probes.conditions);
vi.mock(
  '../../scripts/catalog/launch-verification-build.ts',
  probes.launchVerificationBuild,
);
vi.mock(
  '../../scripts/catalog/party/pinned-catalog-checkouts.ts',
  probes.pinnedCatalogCheckouts,
);
vi.mock(
  '../../scripts/catalog/reviewed-pcgen-records',
  probes.reviewedPcgenRecords,
);
vi.mock(
  '../../scripts/catalog/legal/attribution-227-matches.ts',
  probes.attribution227Matches,
);

const fixture = useFixture();

describe('catalog:party-scope --status', () => {
  const { builds, status, savedAdmittingPreview } = useStatusFixture(fixture);

  // Recorded at 0c003c6f from a current preview.
  const recordedJson = String.raw`{
  "scopeVersion": "campaign-party-v1",
  "total": {
    "needed": 3,
    "admitted": 1,
    "verified": 0,
    "unverified": 1,
    "held": 0,
    "omitted": 0,
    "failed": 1,
    "absent": 0,
    "unmatched": 1,
    "heldBy": [],
    "failedBy": [
      {
        "reason": "Broken structure or reference: unresolved imported reference.",
        "rows": [
          "Cavalier"
        ]
      }
    ]
  },
  "characters": [
    {
      "id": "3",
      "needed": 3,
      "admitted": 1,
      "verified": 0,
      "unverified": 1,
      "held": 0,
      "omitted": 0,
      "failed": 1,
      "absent": 0,
      "unmatched": 1,
      "heldBy": [],
      "failedBy": [
        {
          "reason": "Broken structure or reference: unresolved imported reference.",
          "rows": [
            "Cavalier"
          ]
        }
      ],
      "ready": false,
      "firstStop": "race not written (Fixture.)"
    }
  ],
  "omitted": [
    {
      "key": "pf1/u1ed3H9xtYQXTP5v",
      "kind": "class",
      "name": "Cavalier",
      "characters": [
        "3"
      ],
      "state": "failed",
      "on": [
        "Cavalier fails (Broken structure or reference: unresolved imported reference.)"
      ]
    }
  ],
  "upstream": [],
  "labels": "the committed verification projection, current"
}
`;
  const recordedText = String.raw`Party status of campaign-party-v1, the launch measure (owner, 2026-11-10): the admission gate, run now on the whole import at the pins ; labels from the committed verification projection, current.
Needed: the scope rows a character reaches from its builds keys, plus its unmatched entries and open race. Omitted: dependent omission. A character is ready when every row it needs is admitted.
Total (each row once): 3 needed, 1 admitted (0 verified, 1 unverified), 0 held, 0 omitted, 1 failed, 1 unmatched
  failed, Broken structure or reference: unresolved imported reference.: Cavalier
Classes and races not admitted:
  Cavalier (class; 3): failed Cavalier fails (Broken structure or reference: unresolved imported reference.)
Characters:
  3: 3 needed, 1 admitted (0 verified, 1 unverified), 0 held, 0 omitted, 1 failed, 1 unmatched
    failed, Broken structure or reference: unresolved imported reference.: Cavalier
Ready (every row admitted):
  3: not ready: race not written (Fixture.)
`;

  it(
    'prints, for the inputs as they are, what this head printed from a current preview (JSON byte for byte; the text but for its first line)',
    async () => {
      const json = await status(checkedProjection());
      expect(json.error).toBeUndefined();
      expect(json.printed).toBe(recordedJson);
      const text = await status(checkedProjection(), { json: false });
      expect(text.error).toBeUndefined();
      expect(text.printed).toBe(recordedText);
    },
    slow,
  );

  it(
    'takes no saved preview: --preview DIR is refused',
    async () => {
      const saved = await savedAdmittingPreview();
      const { error, printed } = await status(checkedProjection(), {
        args: ['--preview', saved],
      });
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/Unknown option '--preview'/);
      expect(printed).toBe('');
    },
    slow,
  );

  it(
    'refuses scope drift with no status printed (stdout empty), its progress line already on stderr',
    async () => {
      const { error, printed, progress } = await status(checkedProjection(), {
        buildsBytes: `${builds}\n`,
      });
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(
        /^The committed party scope is not this checkout's \(the builds file changed\): run pnpm -s catalog:party-scope --write\.$/,
      );
      expect(printed).toBe('');
      expect(progress).toMatch(
        /^Importing the whole catalog at the pinned checkouts and running the admission gate on it/,
      );
    },
    slow,
  );
});
