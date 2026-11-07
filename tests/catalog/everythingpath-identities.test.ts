// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  locatorKeyOf,
  parseIdentityLedger,
} from '../../scripts/catalog/everythingpath-identities';
import ledger from '../../scripts/catalog/everythingpath-identities.json';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { allIncrementKeys } from '../../scripts/catalog/pcgen/schedules';
import { hashStructureSource } from '../../scripts/catalog/structure-curation';
import { upstreamKeyOf } from '../../src/lib/catalog/imported-entry-schema';
import { readPinned } from './pinned-sources';

async function pinnedLines(file: string) {
  return (await readPinned('pcgen', `${pcgenPin.directory}/${file}`)).split(
    /\r?\n/,
  );
}
// An ability record's KEY, or a prestige class line's name.
const keyOf = (line: string) =>
  line
    .split('\t')
    .find((token) => token.startsWith('KEY:'))
    ?.slice('KEY:'.length) ?? /^CLASS:([^\t]+)/.exec(line)?.[1];

// Plan §5's reviewed exception: PCGen keeps the two Lore Wardens apart.
const pfsfgLoreWarden = {
  source: 'pcgen',
  locator: {
    file: 'campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst',
    line: 253,
    key: 'Fighter Archetype ~ Lore Warden',
  },
} as const;
const agLoreWarden = {
  source: 'pcgen',
  locator: {
    file: 'roleplaying_game/adventurers_guide/ag_abilities_class.lst',
    line: 836,
    key: 'Fighter Archetype ~ Lore Warden ~ AG',
  },
} as const;
// Plan §5's same-book duplicates: People of the Stars p.11 in PCGen's class
// and race files, under one KEY.
const potsClassOutrider = {
  source: 'pcgen',
  locator: {
    file: 'player_companion/people_of_the_stars/pots_abilities_class.lst',
    line: 7,
    key: 'Cavalier Archetype ~ Qabarat Outrider',
  },
} as const;
const potsRaceOutrider = {
  source: 'pcgen',
  locator: {
    file: 'player_companion/people_of_the_stars/pots_abilities_race.lst',
    line: 117,
    key: 'Cavalier Archetype ~ Qabarat Outrider',
  },
} as const;
// A checked record names its review receipt (#757); these cases don't check
// receipts, so they cite #716 P6's rules review.
const reviewer = {
  reviewedBy: 'reviewer',
  reviewedOn: '2026-10-17',
  receipt: 'reviewer-20261018-081620-1216172',
};
// A decision binds each record's hash; here, the hash of its record line.
async function bound(source: { locator: { file: string; line: number } }) {
  const text = (await pinnedLines(source.locator.file))[
    source.locator.line - 1
  ];
  return {
    source,
    sourceSha256: hashStructureSource([
      { source: source as typeof pfsfgLoreWarden, text: text ?? '' },
    ]),
  };
}
const [pfsfgBound, agBound, potsClassBound, potsRaceBound] = await Promise.all(
  [pfsfgLoreWarden, agLoreWarden, potsClassOutrider, potsRaceOutrider].map(
    bound,
  ),
);
const noEntries = { locatorRemaps: [], heldSources: [], retirements: [] };
// Ultimate Intrigue p.21 and Adventurer's Guide p.33: one KEY, two books.
const uiRingleader = {
  source: 'pcgen',
  locator: {
    file: 'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst',
    line: 222,
    key: 'Bard Archetype ~ Ringleader',
  },
} as const;
const agRingleader = {
  source: 'pcgen',
  locator: {
    file: 'roleplaying_game/adventurers_guide/ag_abilities_class.lst',
    line: 636,
    key: 'Bard Archetype ~ Ringleader',
  },
} as const;
// Adventurer's Guide p.120 under PCGen's misspelt KEY, and the Core
// Rulebook's Arcane Trickster (p.376) with PCGen's Undead Slayer's Handbook
// copy of it.
const agEnlightened = {
  source: 'pcgen',
  locator: {
    file: 'roleplaying_game/adventurers_guide/ag_abilities_class.lst',
    line: 698,
    key: 'Bloodrager Archetype ~ Enlightenend Bloodrager ~ AG',
  },
} as const;
const crbArcaneTrickster = {
  source: 'pcgen',
  locator: {
    file: 'roleplaying_game/core_rulebook/cr_classes.lst',
    line: 345,
    key: 'Arcane Trickster',
  },
} as const;
const ushArcaneTrickster = {
  source: 'pcgen',
  locator: {
    file: 'player_companion/undead_slayers_handbook/ush_classes.lst',
    line: 53,
    key: 'Arcane Trickster',
  },
} as const;
const [uiRingleaderBound, agRingleaderBound, ushBound] = await Promise.all(
  [uiRingleader, agRingleader, ushArcaneTrickster].map(bound),
);
const checked = (rationale: string, evidence: string) => ({
  status: 'checked' as const,
  rationale,
  evidence,
  ...reviewer,
});

const loreWardens = {
  pcgenCommit: pcgenPin.commit,
  identities: [
    {
      externalKey: 'everythingpath/fighter-lore-warden',
      kind: 'archetype',
      sources: [pfsfgLoreWarden],
    },
    {
      externalKey: 'everythingpath/fighter-lore-warden-ag',
      kind: 'archetype',
      sources: [agLoreWarden],
    },
  ],
  variantDecisions: [
    {
      decision: 'separate-identities',
      identities: [
        { externalKey: 'everythingpath/fighter-lore-warden', ...pfsfgBound },
        { externalKey: 'everythingpath/fighter-lore-warden-ag', ...agBound },
      ],
      review: {
        status: 'checked',
        rationale:
          'A revision: PCGen notes "Due to massive changes to Lore Warden, added ~ AG to all keys".',
        evidence:
          'pcgen:roleplaying_game/adventurers_guide/ag_abilities_class.lst:833',
        ...reviewer,
      },
    },
  ],
  ...noEntries,
};
const qabaratOutrider = {
  pcgenCommit: pcgenPin.commit,
  identities: [
    {
      externalKey: 'everythingpath/cavalier-qabarat-outrider',
      kind: 'archetype',
      sources: [potsClassOutrider, potsRaceOutrider],
    },
  ],
  variantDecisions: [
    {
      decision: 'same-identity',
      externalKey: 'everythingpath/cavalier-qabarat-outrider',
      sources: [potsClassBound, potsRaceBound],
      mechanicsFrom: potsClassOutrider,
      review: {
        status: 'checked',
        rationale: 'The same People of the Stars archetype in two PCGen files.',
        evidence: 'People of the Stars p.11',
        ...reviewer,
      },
    },
  ],
  ...noEntries,
};

describe('the identity ledger', () => {
  it('is pinned to the PCGen commit and takes no increment key', () => {
    const parsed = parseIdentityLedger(ledger, {
      reservedKeys: allIncrementKeys(),
    });
    expect(parsed.pcgenCommit).toBe(pcgenPin.commit);
    expect(parsed.retirements).toEqual([]);
    expect(parsed.locatorRemaps).toEqual([]);
  });

  it('compares sources by their case-folded KEY, as PCGen does', () => {
    const folded = {
      ...pfsfgLoreWarden,
      locator: {
        ...pfsfgLoreWarden.locator,
        key: 'Fighter Archetype ~ lore warden',
      },
    };
    expect(locatorKeyOf(folded)).toBe(locatorKeyOf(pfsfgLoreWarden));
    expect(() =>
      parseIdentityLedger({
        ...loreWardens,
        identities: [
          loreWardens.identities[0],
          { ...loreWardens.identities[1], sources: [folded] },
        ],
        variantDecisions: [],
      }),
    ).toThrow(/belongs to/);
  });

  it('keeps every key unique across identities, retirements and increment keys', () => {
    const bravery6 = {
      ...loreWardens,
      identities: [
        {
          ...loreWardens.identities[0],
          externalKey: 'everythingpath/fighter-bravery-6',
        },
      ],
      variantDecisions: [],
    };
    expect(() => parseIdentityLedger(bravery6)).not.toThrow();
    expect(() =>
      parseIdentityLedger(bravery6, { reservedKeys: allIncrementKeys() }),
    ).toThrow(/everythingpath\/fighter-bravery-6 is used twice/);
  });

  it('keeps same-KEY records apart only through a checked separate-identities decision', () => {
    const ringleaders = {
      pcgenCommit: pcgenPin.commit,
      identities: [
        {
          externalKey: 'everythingpath/bard-ringleader',
          kind: 'archetype',
          sources: [uiRingleader],
        },
        {
          externalKey: 'everythingpath/bard-ringleader-ag',
          kind: 'archetype',
          sources: [agRingleader],
        },
      ],
      variantDecisions: [],
      ...noEntries,
    };
    expect(() => parseIdentityLedger(ringleaders)).toThrow(
      /share the KEY bard archetype ~ ringleader/,
    );
    expect(
      parseIdentityLedger({
        ...ringleaders,
        variantDecisions: [
          {
            decision: 'separate-identities',
            identities: [
              {
                externalKey: 'everythingpath/bard-ringleader',
                ...uiRingleaderBound,
              },
              {
                externalKey: 'everythingpath/bard-ringleader-ag',
                ...agRingleaderBound,
              },
            ],
            review: checked(
              'A revision: the same KEY with differing grants or levels.',
              'ui_abilities_class.lst:222; ag_abilities_class.lst:636',
            ),
          },
        ],
      }).identities,
    ).toHaveLength(2);
  });

  describe('locator remaps', () => {
    // A KEY rename: a later pin spelling AG's Enlightened Bloodrager right.
    const renamed = {
      ...agEnlightened,
      locator: {
        ...agEnlightened.locator,
        key: 'Bloodrager Archetype ~ Enlightened Bloodrager ~ AG',
      },
    };
    const remap = {
      externalKey: 'everythingpath/bloodrager-enlightened-bloodrager-ag',
      from: agEnlightened,
      to: renamed,
      review: checked(
        'PCGen corrected the KEY; the record is unchanged.',
        'ag_abilities_class.lst:698',
      ),
    };
    const withRemaps = (locatorRemaps: unknown[], extra: unknown[] = []) => ({
      pcgenCommit: pcgenPin.commit,
      identities: [
        {
          externalKey: 'everythingpath/bloodrager-enlightened-bloodrager-ag',
          kind: 'archetype',
          sources: [agEnlightened],
        },
        ...extra,
      ],
      variantDecisions: [],
      locatorRemaps,
      heldSources: [],
      retirements: [],
    });

    it('moves a held locator to a new one', () => {
      expect(parseIdentityLedger(withRemaps([remap])).locatorRemaps).toEqual([
        remap,
      ]);
    });

    it.each([
      [
        'a locator the identity does not hold',
        /does not hold/,
        withRemaps([{ ...remap, from: agLoreWarden }]),
      ],
      [
        'onto a locator another identity holds',
        /which everythingpath\/fighter-lore-warden-ag holds/,
        withRemaps(
          [{ ...remap, to: agLoreWarden }],
          [
            {
              externalKey: 'everythingpath/fighter-lore-warden-ag',
              kind: 'archetype',
              sources: [agLoreWarden],
            },
          ],
        ),
      ],
      [
        'the same locator twice',
        /remapped twice/,
        withRemaps([remap, { ...remap, to: pfsfgLoreWarden }]),
      ],
      [
        'onto its own locator in another case',
        /changes nothing/,
        withRemaps([
          {
            ...remap,
            to: {
              ...agEnlightened,
              locator: {
                ...agEnlightened.locator,
                key: agEnlightened.locator.key.toUpperCase(),
              },
            },
          },
        ]),
      ],
    ])('rejects a remap of %s', (_, message, value) => {
      expect(() => parseIdentityLedger(value)).toThrow(message);
    });
  });

  describe('held sources', () => {
    const held = {
      ...ushBound,
      kind: 'prestigeClass',
      duplicateOf: 'everythingpath/arcane-trickster',
      conflict: 'attribution',
      text: "PCGen's Undead Slayer's Handbook copies the Core Rulebook's Arcane Trickster.",
      review: checked(
        'Owner decision 5: mechanics from the Core Rulebook; the copy is held.',
        'ush_classes.lst:53; cr_classes.lst:345',
      ),
    };
    const arcaneTrickster = (heldSources: unknown[], sources: unknown[]) => ({
      pcgenCommit: pcgenPin.commit,
      identities: [
        {
          externalKey: 'everythingpath/arcane-trickster',
          kind: 'prestigeClass',
          sources,
        },
      ],
      variantDecisions: [],
      locatorRemaps: [],
      heldSources,
      retirements: [],
    });

    it('holds a copy that is no printing beside the identity it duplicates', () => {
      expect(
        parseIdentityLedger(arcaneTrickster([held], [crbArcaneTrickster]))
          .heldSources,
      ).toEqual([held]);
    });

    it('rejects a held source an identity also holds, or one duplicating no identity', () => {
      expect(() =>
        parseIdentityLedger({
          ...arcaneTrickster([held], [crbArcaneTrickster]),
          identities: [
            {
              externalKey: 'everythingpath/arcane-trickster',
              kind: 'prestigeClass',
              sources: [crbArcaneTrickster],
            },
            {
              externalKey: 'everythingpath/arcane-trickster-ush',
              kind: 'prestigeClass',
              sources: [ushArcaneTrickster],
            },
          ],
        }),
      ).toThrow(/is held and an identity's source/);
      expect(() =>
        parseIdentityLedger(
          arcaneTrickster(
            [{ ...held, duplicateOf: 'everythingpath/arcane-tricksters' }],
            [crbArcaneTrickster],
          ),
        ),
      ).toThrow(/duplicates unknown/);
    });
  });

  it('names a source by the upstream key PCGen entries carry', () => {
    expect(upstreamKeyOf(pfsfgLoreWarden)).toBe(
      'pcgen:campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst#Fighter Archetype ~ Lore Warden',
    );
    expect(
      upstreamKeyOf({
        source: 'prd',
        locator: { path: 'ultimateCombat/classes/fighter.html', id: 'archer' },
      }),
    ).toBe('prd:ultimateCombat/classes/fighter.html#archer');
  });

  it('cites real PCGen records', async () => {
    for (const { locator } of [
      pfsfgLoreWarden,
      agLoreWarden,
      potsClassOutrider,
      potsRaceOutrider,
      uiRingleader,
      agRingleader,
      agEnlightened,
      crbArcaneTrickster,
      ushArcaneTrickster,
    ])
      expect(keyOf((await pinnedLines(locator.file))[locator.line - 1]!)).toBe(
        locator.key,
      );
    expect((await pinnedLines(agLoreWarden.locator.file))[832]).toBe(
      '##Due to massive changes to Lore Warden, added ~ AG to all keys to prevent conflicts with PFSFG version',
    );
  });

  it('keeps reviewed separate identities apart', () => {
    expect(parseIdentityLedger(loreWardens).identities).toHaveLength(2);
  });

  it('collapses variants into one identity only through a checked decision', () => {
    expect(
      parseIdentityLedger(qabaratOutrider).identities[0]?.sources,
    ).toHaveLength(2);
    expect(() =>
      parseIdentityLedger({ ...qabaratOutrider, variantDecisions: [] }),
    ).toThrow(/checked same-identity decision/);
    expect(() =>
      parseIdentityLedger({
        ...qabaratOutrider,
        variantDecisions: [
          {
            ...qabaratOutrider.variantDecisions[0],
            review: {
              status: 'drafted',
              rationale:
                'The same People of the Stars archetype in two PCGen files.',
              evidence: 'People of the Stars p.11',
            },
          },
        ],
      }),
    ).toThrow(/checked same-identity decision/);
  });

  it('rejects a reprint that cites one source twice and leaves the other unreviewed', () => {
    expect(() =>
      parseIdentityLedger({
        ...qabaratOutrider,
        variantDecisions: [
          {
            ...qabaratOutrider.variantDecisions[0],
            sources: [potsClassBound, potsClassBound],
          },
        ],
      }),
    ).toThrow(/cites .* more than once/);
  });

  it.each([
    [
      'a source claimed by two identities',
      /belongs to/,
      {
        ...loreWardens,
        identities: [
          loreWardens.identities[0],
          { ...loreWardens.identities[1], sources: [pfsfgLoreWarden] },
        ],
        variantDecisions: [],
      },
    ],
    [
      'a duplicate identity',
      /Duplicate identity/,
      {
        ...loreWardens,
        identities: [loreWardens.identities[0], loreWardens.identities[0]],
        variantDecisions: [],
      },
    ],
    [
      'a Foundry key as an identity',
      /externalKey/,
      {
        ...loreWardens,
        identities: [
          { ...loreWardens.identities[0], externalKey: 'pf1/Q1cY8r0Pvb66pMG0' },
        ],
        variantDecisions: [],
      },
    ],
    [
      'a separate-identities decision pairing an identity with a source it does not hold',
      /does not hold exactly/,
      {
        ...loreWardens,
        variantDecisions: [
          {
            ...loreWardens.variantDecisions[0],
            identities: [
              { externalKey: 'everythingpath/fighter-lore-warden', ...agBound },
              {
                externalKey: 'everythingpath/fighter-lore-warden-ag',
                ...pfsfgBound,
              },
            ],
          },
        ],
      },
    ],
    [
      'a separate-identities decision citing one source twice',
      /cites .* more than once/,
      {
        ...loreWardens,
        variantDecisions: [
          {
            ...loreWardens.variantDecisions[0],
            identities: [
              {
                externalKey: 'everythingpath/fighter-lore-warden',
                ...pfsfgBound,
              },
              {
                externalKey: 'everythingpath/fighter-lore-warden',
                ...pfsfgBound,
              },
            ],
          },
        ],
      },
    ],
    [
      'a decision naming an identity the ledger lacks',
      /unknown identity/,
      {
        ...loreWardens,
        identities: [loreWardens.identities[0]],
      },
    ],
    [
      'a checked decision without a reviewer',
      /reviewedBy/,
      {
        ...loreWardens,
        variantDecisions: [
          {
            ...loreWardens.variantDecisions[0],
            review: {
              ...loreWardens.variantDecisions[0]!.review,
              reviewedBy: undefined,
            },
          },
        ],
      },
    ],
    [
      'a same-identity decision taking mechanics from another source',
      /one of its sources/,
      {
        ...qabaratOutrider,
        variantDecisions: [
          {
            ...qabaratOutrider.variantDecisions[0],
            mechanicsFrom: agLoreWarden,
          },
        ],
      },
    ],
    [
      'a retirement of an identity still in the ledger',
      /still in the ledger/,
      {
        ...loreWardens,
        retirements: [
          {
            externalKey: 'everythingpath/fighter-lore-warden',
            sources: [pfsfgLoreWarden],
            reason: 'Its locator vanished at a pin bump.',
            reviewedBy: reviewer.reviewedBy,
            reviewedOn: reviewer.reviewedOn,
          },
        ],
      },
    ],
    [
      'a commit that is not a full hash',
      /pcgenCommit/,
      { ...loreWardens, pcgenCommit: '25523dbc' },
    ],
  ])('rejects %s', (_, message, value) => {
    expect(() => parseIdentityLedger(value)).toThrow(message);
  });
});
