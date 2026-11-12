// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { selectCharacterAuthority } from '../tests/character-authority';
import type { CharacterAuthority } from '../src/lib/character-sheet-availability';

const modules = import.meta.glob('./**/*.ts');

const fixtureMarker = (key: string) => ({
  namespace: 'availability',
  version: 1,
  workerKey: '0',
  caseKey: key,
  campaignKey: key,
});

type Case = {
  authority: CharacterAuthority;
  isFixtureCampaign: boolean;
  hasDemoFlag: boolean;
};

/**
 * One deployment per case: a campaign with a militia (and a second campaign
 * in the same organization), fixture or ordinary, and a GM with or without
 * the private sheet demo grant. Its sheets are made under sheet authority, so
 * every gate has something to decide for; the case's authority is selected
 * afterwards. Today no public function sets either fixture marker, so the
 * legacy column is the behaviour before this slice.
 */
async function deployment({ authority, isFixtureCampaign, hasDemoFlag }: Case) {
  const t = convexTest(schema, modules);
  const gm = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await gm.run((ctx) => seedAcceptedCampaign(ctx));
  const campaignId = seeded.key.campaignId;
  const destinationId = await t.run(async (ctx) => {
    if (isFixtureCampaign)
      await ctx.db.patch('campaign', campaignId, {
        e2eFixture: fixtureMarker('home'),
      });
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|gm'),
      )
      .unique();
    if (!user) throw new Error('Missing GM');
    if (hasDemoFlag)
      await ctx.db.patch('user', user._id, { characterSheetDemo: true });
    return ctx.db.insert('campaign', {
      name: 'Destination',
      ownerId: 'gm',
      organizationId: 'org',
      description: '',
      ...(isFixtureCampaign && { e2eFixture: fixtureMarker('destination') }),
    });
  });
  const playerId = await t.run(async (ctx) => {
    const player = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|player'),
      )
      .unique();
    if (!player) throw new Error('Missing player');
    return player._id;
  });
  await selectCharacterAuthority(t, 'sheet');
  const createInCampaign = (name: string) =>
    gm.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name,
      kind: 'pc',
      operationId: `create-${name}`,
    });
  const vessa = await createInCampaign('Vessa');
  const bren = await createInCampaign('Bren');
  const pell = await gm.mutation(api.characterSheet.create, {
    name: 'Pell',
    kind: 'pc',
    operationId: 'create-Pell',
  });
  const orrin = await gm.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'Orrin',
      description: '',
      kind: 'pc',
      level: 1,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
  });
  await selectCharacterAuthority(t, authority);
  return {
    t,
    gm,
    campaignId,
    destinationId,
    playerId,
    characters: { vessa, bren, pell, orrin },
  };
}

type Deployment = Awaited<ReturnType<typeof deployment>>;

async function outcome(command: () => Promise<unknown>) {
  try {
    await command();
    return 'allowed';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const campaignRefusal =
  "Character sheets aren't available for this campaign yet.";
const ownerRefusal = "Owner assignment isn't available for this campaign yet.";
const privateCreationRefusal =
  "Private character sheets aren't available for your account yet.";
const privateEditRefusal =
  "Editing isn't available for this character sheet yet.";
const privateMoveRefusal =
  "Private character sheets aren't available for this account yet.";

const allowedOr = (isOpen: boolean, refusal: string) =>
  isOpen ? 'allowed' : refusal;

/**
 * The gate inventory (`f5/gates.md`), each through a public function. `probe`
 * returns what the deployment did; `expected` is the rule for the case.
 * Probes run in order on one deployment; the moves come last because they
 * move the Characters.
 */
const gates: {
  gate: string;
  probe: (d: Deployment) => Promise<unknown>;
  expected: (open: { campaign: boolean; demo: boolean; case: Case }) => unknown;
}[] = [
  {
    gate: 'characterSheet.create in a campaign',
    probe: ({ gm, campaignId }) =>
      outcome(() =>
        gm.mutation(api.characterSheet.create, {
          organizationId: 'org',
          campaignId,
          name: 'Probe',
          kind: 'pc',
          operationId: 'probe-campaign',
        }),
      ),
    expected: ({ campaign }) => allowedOr(campaign, campaignRefusal),
  },
  {
    gate: 'characterSheet.create for a private Character',
    probe: ({ gm }) =>
      outcome(() =>
        gm.mutation(api.characterSheet.create, {
          name: 'Probe',
          kind: 'pc',
          operationId: 'probe-private',
        }),
      ),
    expected: ({ demo }) => allowedOr(demo, privateCreationRefusal),
  },
  {
    gate: 'a campaign sheet writer (loadCharacterSheetFromAccess)',
    probe: ({ gm, characters }) =>
      outcome(() =>
        gm.mutation(api.characterSheet.editBaseScores, {
          characterId: characters.vessa,
          scores: { strength: 14 },
          operationId: 'probe-campaign-edit',
        }),
      ),
    expected: ({ campaign }) => allowedOr(campaign, campaignRefusal),
  },
  {
    gate: 'a private sheet writer (loadCharacterSheetFromAccess)',
    probe: ({ gm, characters }) =>
      outcome(() =>
        gm.mutation(api.characterSheet.editBaseScores, {
          characterId: characters.pell,
          scores: { strength: 14 },
          operationId: 'probe-private-edit',
        }),
      ),
    expected: ({ demo }) => allowedOr(demo, privateEditRefusal),
  },
  {
    gate: 'characterSheet.read ownership offer',
    probe: async ({ gm, characters }) =>
      (
        await gm.query(api.characterSheet.read, {
          characterId: characters.vessa,
        })
      )?.campaign?.ownershipAvailable,
    expected: ({ campaign }) => campaign,
  },
  {
    gate: 'character.listByCampaign sheet rows and ownership offer',
    probe: async ({ gm, campaignId, characters }) => {
      const rows = await gm.query(api.character.listByCampaign, {
        organizationId: 'org',
        campaignId,
      });
      const row = rows.find(({ _id }) => _id === characters.vessa);
      return {
        ownershipAvailable: row?.ownershipAvailable,
        hasClassLevels: row?.classLevels !== undefined,
      };
    },
    expected: ({ campaign }) => ({
      ownershipAvailable: campaign,
      hasClassLevels: campaign,
    }),
  },
  {
    gate: 'character.listOwnerCandidates',
    probe: ({ gm, campaignId }) =>
      outcome(() =>
        gm.query(api.character.listOwnerCandidates, {
          organizationId: 'org',
          campaignId,
          paginationOpts: { cursor: null, numItems: 10 },
        }),
      ),
    expected: ({ campaign }) => allowedOr(campaign, ownerRefusal),
  },
  {
    gate: 'character.reassignOwner',
    probe: ({ gm, campaignId, characters, playerId }) =>
      outcome(() =>
        gm.mutation(api.character.reassignOwner, {
          organizationId: 'org',
          campaignId,
          characterId: characters.bren,
          ownerUserId: playerId,
          operationId: 'probe-owner',
        }),
      ),
    expected: ({ campaign }) => allowedOr(campaign, ownerRefusal),
  },
  {
    // Creating through the militia ledger makes a Militia-only sheet where
    // sheets are open; before that only fixture campaigns get one.
    gate: 'character.createCharacter makes a sheet',
    probe: async ({ t, gm, campaignId }) => {
      const id = await gm.mutation(api.character.createCharacter, {
        organizationId: 'org',
        character: {
          campaignId,
          name: 'Probe',
          description: '',
          kind: 'pc',
          level: 2,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
      });
      return (await t.run((ctx) => ctx.db.get('character', id)))?.sheetMode;
    },
    expected: ({ campaign }) => (campaign ? 'militiaOnly' : undefined),
  },
  {
    // A ledger edit of a Militia-only sheet goes to the sheet where sheets
    // are open; elsewhere it writes the flat columns, as before.
    gate: 'character.updateCharacter edits a Militia-only sheet',
    probe: async ({ t, gm, characters }) => {
      const before = await t.run((ctx) =>
        ctx.db.get('character', characters.orrin),
      );
      await gm.mutation(api.character.updateCharacter, {
        organizationId: 'org',
        characterId: characters.orrin,
        patch: { level: 3 },
      });
      const after = await t.run((ctx) =>
        ctx.db.get('character', characters.orrin),
      );
      return {
        sheetRevisionAdvanced:
          (after?.sheetRevision ?? 0) > (before?.sheetRevision ?? 0),
        flatLevel: after?.level,
      };
    },
    expected: ({ campaign }) =>
      campaign
        ? { sheetRevisionAdvanced: true, flatLevel: 1 }
        : { sheetRevisionAdvanced: false, flatLevel: 3 },
  },
  {
    gate: 'characterMoves.destinations',
    probe: async ({ gm, characters, destinationId }) => {
      const result = await gm.query(api.characterMoves.destinations, {
        characterId: characters.vessa,
      });
      return {
        available: result.available,
        offersDestination: result.destinations.some(
          ({ campaignId }) => campaignId === destinationId,
        ),
      };
    },
    expected: ({ campaign }) => ({
      available: campaign,
      offersDestination: campaign,
    }),
  },
  {
    gate: 'characterMoves.start from a campaign to No campaign',
    probe: ({ gm, characters }) =>
      outcome(() =>
        gm.mutation(api.characterMoves.start, {
          characterId: characters.vessa,
          operationId: 'probe-leave',
        }),
      ),
    expected: ({ campaign, demo }) =>
      allowedOr(campaign, campaignRefusal) === 'allowed'
        ? allowedOr(demo, privateMoveRefusal)
        : campaignRefusal,
  },
  {
    gate: 'characterMoves.start from No campaign into a campaign',
    probe: ({ gm, characters, destinationId }) =>
      outcome(() =>
        gm.mutation(api.characterMoves.start, {
          characterId: characters.pell,
          destinationCampaignId: destinationId,
          operationId: 'probe-join',
        }),
      ),
    expected: ({ campaign, demo }) =>
      !demo ? privateEditRefusal : allowedOr(campaign, campaignRefusal),
  },
];

const cases: Case[] = (['legacy', 'sheet'] as const).flatMap((authority) =>
  [false, true].flatMap((isFixtureCampaign) =>
    [false, true].map((hasDemoFlag) => ({
      authority,
      isFixtureCampaign,
      hasDemoFlag,
    })),
  ),
);

describe.each(cases)(
  'authority $authority, fixture campaign $isFixtureCampaign, demo flag $hasDemoFlag',
  (testCase) => {
    test('every gate in the inventory decides by the shared rule', async () => {
      const d = await deployment(testCase);
      const open = {
        campaign: testCase.authority === 'sheet' || testCase.isFixtureCampaign,
        demo: testCase.authority === 'sheet' || testCase.hasDemoFlag,
        case: testCase,
      };
      const actual: Record<string, unknown> = {};
      const expected: Record<string, unknown> = {};
      for (const { gate, probe, expected: rule } of gates) {
        actual[gate] = await probe(d);
        expected[gate] = rule(open);
      }
      expect(actual).toEqual(expected);
    });
  },
);

test('sheet authority keeps membership and ownership in front of every gate', async () => {
  const d = await deployment({
    authority: 'sheet',
    isFixtureCampaign: false,
    hasDemoFlag: false,
  });
  await d.t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|outsider',
      orgIds: [{ orgId: 'elsewhere', role: 'member' }],
    }),
  );
  const outsider = d.t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const refusals = await Promise.all([
    outcome(() =>
      outsider.mutation(api.characterSheet.create, {
        organizationId: 'org',
        campaignId: d.campaignId,
        name: 'Intruder',
        kind: 'pc',
        operationId: 'intrude',
      }),
    ),
    outcome(() =>
      outsider.query(api.characterSheet.read, {
        characterId: d.characters.vessa,
      }),
    ),
    outcome(() =>
      outsider.mutation(api.characterSheet.editBaseScores, {
        characterId: d.characters.vessa,
        scores: { strength: 18 },
        operationId: 'intrude-edit',
      }),
    ),
    outcome(() =>
      outsider.query(api.characterSheet.read, {
        characterId: d.characters.pell,
      }),
    ),
    outcome(() =>
      outsider.mutation(api.characterSheet.editBaseScores, {
        characterId: d.characters.pell,
        scores: { strength: 18 },
        operationId: 'intrude-private',
      }),
    ),
    outcome(() =>
      outsider.query(api.character.listOwnerCandidates, {
        organizationId: 'org',
        campaignId: d.campaignId,
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ),
    outcome(() =>
      outsider.mutation(api.characterMoves.start, {
        characterId: d.characters.pell,
        destinationCampaignId: d.campaignId,
        operationId: 'intrude-move',
      }),
    ),
  ]);
  for (const refusal of refusals) expect(refusal).not.toBe('allowed');
  // A member who doesn't own the private Character can't open it either.
  const player = d.t.withIdentity({ tokenIdentifier: 'test|player' });
  expect(
    await outcome(() =>
      player.query(api.characterSheet.read, {
        characterId: d.characters.pell,
      }),
    ),
  ).not.toBe('allowed');
  expect(
    await outsider.query(api.character.listByCampaign, {
      organizationId: 'org',
      campaignId: d.campaignId,
    }),
  ).toEqual([]);
});
