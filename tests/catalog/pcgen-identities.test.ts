// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  isCurrentDecision,
  locatorKeyOf,
  parseIdentityLedger,
} from '../../scripts/catalog/everythingpath-identities';
import ledgerData from '../../scripts/catalog/everythingpath-identities.json';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import {
  assignPcgenIdentities,
  featureDerivation,
  ownerDerivation,
  ownerSubjects,
  pcgenBookFacts,
} from '../../scripts/catalog/pcgen/identities';
import { variantReviewItems } from '../../scripts/catalog/pcgen/variant-review';
import {
  inventoryPcgen,
  type PcgenOwner,
} from '../../scripts/catalog/pcgen/inventory';
import { readPcgenTree, type PcgenTree } from '../../scripts/catalog/pcgen/lst';
import { allIncrementKeys } from '../../scripts/catalog/pcgen/schedules';
import { representativeCompanionRules } from '../../src/lib/catalog/representative-companion-rules';
import { pcgen716IdentityFiles } from '../fixtures/pcgen-716/identity-files';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import {
  pcgenCheckout,
  pcgenCheckoutIsAtPin,
  readPinned,
} from './pinned-sources';

// #716 P6 (plan §5; research note 716-p6 §1–§2): `everythingpath/` keys
// through the identity ledger over the pinned excerpt of every Appendix D
// variant group and the sixteen rule-keyed archetypes.

const reservedKeys = allIncrementKeys();
const ledger = parseIdentityLedger(ledgerData, { reservedKeys });
const books = pcgenBookFacts(
  await readPinned('pf1', 'module/registry/sources.mjs'),
);

function assign(tree: PcgenTree) {
  const inventory = inventoryPcgen(tree);
  const view = buildEffectiveView(tree);
  return {
    inventory,
    view,
    ...assignPcgenIdentities({ inventory, view, ledger, books, reservedKeys }),
  };
}
const corpus = assign(await readPcgenFixtureTree(pcgen716IdentityFiles));
const ownerAt = (file: string, line: number) => {
  const owner = corpus.inventory.owners.find(
    ({ record }) =>
      record.locator.file.endsWith(file) && record.locator.line === line,
  );
  if (!owner) throw new Error(`No owner at ${file}:${line}.`);
  return owner;
};
const locatorOf = (owner: PcgenOwner) =>
  locatorKeyOf({ source: 'pcgen', locator: owner.record.locator });
const keyOf = (file: string, line: number) =>
  corpus.owners.keys.get(locatorOf(ownerAt(file, line)));

describe('keys derived from the PCGen KEY (plan §5)', () => {
  it.each([
    ['apg_abilities_class.lst', 2664, 'everythingpath/ranger-beast-master'],
    ['ag_abilities_class.lst', 836, 'everythingpath/fighter-lore-warden-ag'],
    ['hhh_abilities_class.lst', 235, 'everythingpath/wizard-pact-wizard-hh'],
    // The reviewed spelling of PCGen's `Enlightenend`.
    [
      'ag_abilities_class.lst',
      698,
      'everythingpath/bloodrager-enlightened-bloodrager-ag',
    ],
    ['iswg_classes.lst', 23, 'everythingpath/hellknight'],
  ])('%s:%i is %s', (file, line, key) => {
    expect(ownerDerivation(ownerAt(file, line)).derivedKey).toBe(key);
  });

  it('keys a feature under its owner, without the owner’s name or tag', () => {
    const feature = (owner: PcgenOwner, key: string) => {
      const row = corpus.inventory.rows.find(
        (candidate) =>
          candidate.owner === owner && candidate.feature?.locator.key === key,
      );
      if (!row?.feature) throw new Error(`No ${key}.`);
      const derived = ownerDerivation(owner);
      return featureDerivation({
        feature: row.feature,
        ownerKey: derived.derivedKey ?? '',
        owner: derived,
      });
    };
    // apg_abilities_class.lst:2679; um_abilities_class.lst:1891; AG's
    // `~ AG` Lore Warden features; a feature several rangers share.
    expect(
      feature(
        ownerAt('apg_abilities_class.lst', 2664),
        'Beast Master ~ Animal Companion',
      ),
    ).toBe('everythingpath/ranger-beast-master-animal-companion');
    const synthesist = corpus.inventory.owners.find(
      ({ record }) => record.locator.key === 'Summoner Archetype ~ Synthesist',
    );
    if (!synthesist) throw new Error('No Synthesist.');
    expect(feature(synthesist, 'Synthesist ~ Greater Shielded Meld')).toBe(
      'everythingpath/summoner-synthesist-greater-shielded-meld',
    );
    expect(
      feature(
        ownerAt('ag_abilities_class.lst', 836),
        'Lore Warden ~ Scholastic ~ AG',
      ),
    ).toBe('everythingpath/fighter-lore-warden-ag-scholastic');
    expect(
      feature(
        ownerAt('apg_abilities_class.lst', 2669),
        'No Spellcasting ~ Ranger',
      ),
    ).toBe('everythingpath/ranger-no-spellcasting-ranger');
  });
});

describe('the identity ledger over the excerpt (plan §5)', () => {
  it('accounts for every frozen record: none vanished, no decision stale', () => {
    for (const part of [corpus.owners, corpus.features]) {
      expect(part.vanished).toEqual([]);
      expect(part.staleDecisions).toEqual([]);
    }
    const frozen = new Set(
      ledger.identities.map(({ externalKey }) => externalKey),
    );
    const assigned = new Set([
      ...corpus.owners.keys.values(),
      ...corpus.features.keys.values(),
    ]);
    expect([...frozen].filter((key) => !assigned.has(key))).toEqual([]);
  });

  // #716 "Rule-keyed identities" (#741): the identities #410's companion
  // rules and #422's specimens key on, frozen in the ledger.
  it('holds the sixteen rule-keyed archetypes under their rule identities', () => {
    // The book each comes from (docs/catalog-import/archetypes.md).
    const ruleKeyed = {
      'ranger-beast-master': 'apg_abilities_class.lst',
      'druid-pack-lord': 'um_abilities_class.lst',
      'hunter-packmaster': 'acg_abilities_class.lst',
      'summoner-broodmaster': 'um_abilities_class.lst',
      'summoner-master-summoner': 'um_abilities_class.lst',
      'summoner-synthesist': 'um_abilities_class.lst',
      'monk-zen-archer': 'apg_abilities_class.lst',
      'ranger-skirmisher': 'apg_abilities_class.lst',
      'ranger-dandy': 'ui_abilities_class.lst',
      'witch-seducer': 'lotfw_abilities_class.lst',
      'witch-ley-line-guardian': 'oa_abilities_class.lst',
      'witch-mountain-witch': 'acg_abilities_class.lst',
      'magus-eldritch-scion': 'acg_abilities_class.lst',
      'magus-mindblade': 'oa_abilities_class.lst',
      'investigator-questioner': 'magtt_abilities_class.lst',
      'investigator-psychic-detective': 'oa_abilities_class.lst',
    };
    expect(
      Object.fromEntries(
        Object.keys(ruleKeyed).map((ruleKey) => {
          const identity = ledger.identities.find(
            ({ externalKey }) => externalKey === `everythingpath/${ruleKey}`,
          );
          const [source] = identity?.sources ?? [];
          return [
            ruleKey,
            source?.source === 'pcgen'
              ? source.locator.file.split('/').at(-1)
              : undefined,
          ];
        }),
      ),
    ).toEqual(ruleKeyed);
  });

  it('holds every feature identity the companion and Combined Form tables name', () => {
    const named = Object.values(representativeCompanionRules).flatMap((rule) =>
      [
        'allocation' in rule ? rule.allocation : undefined,
        'componentAllocation' in rule ? rule.componentAllocation : undefined,
        'reduction' in rule ? rule.reduction : undefined,
        'fusion' in rule ? rule.fusion : undefined,
      ].flatMap((table) =>
        table ? [table.archetypeIdentity, ...table.featureIdentities] : [],
      ),
    );
    // character-sheet-combined-form.ts's Shielded Melds (Ultimate Magic p. 81).
    const melds = [
      'summoner-synthesist-shielded-meld',
      'summoner-synthesist-greater-shielded-meld',
    ];
    const held = new Set(
      ledger.identities.map(({ externalKey }) => externalKey),
    );
    expect(named.length).toBeGreaterThan(10);
    expect(
      [...named, ...melds].filter((key) => !held.has(`everythingpath/${key}`)),
    ).toEqual([]);
  });
});

// Research note 716-p6 §2 and its review: revisions stay separate; reprints
// collapse only through a checked variant review; the rest is review.
describe('variant decisions (plan §5, Appendix D)', () => {
  const separate = [
    ['fighter-lore-warden', 'fighter-lore-warden-ag'],
    [
      'bloodrager-enlightened-bloodrager',
      'bloodrager-enlightened-bloodrager-ag',
    ],
    ['wizard-pact-wizard', 'wizard-pact-wizard-hh'],
    // Two of the twelve Unchained pairs.
    ['monk-scaled-fist', 'unchained-monk-scaled-fist'],
    ['rogue-consigliere', 'rogue-unchained-consigliere'],
    // Same-KEY revisions: the earlier book keeps the bare key. Ultimate
    // Intrigue (2016) precedes the Adventurer's Guide (2017); People of the
    // North precedes Ultimate Wilderness (Viking's Berserker at 4 and 5).
    ['bard-ringleader', 'bard-ringleader-ag'],
    ['fighter-viking', 'fighter-viking-uw'],
    ['arcanist-magaambyan-initiate', 'arcanist-magaambyan-initiate-ag'],
    // Prestige revisions: Seekers of Secrets' 7 levels against AG's 10.
    ['pathfinder-savant', 'pathfinder-savant-ag'],
    ['lion-blade', 'lion-blade-isi'],
  ] as const satisfies readonly (readonly [string, string])[];

  it.each(separate)(
    'keeps %s and %s apart under a current checked decision',
    (first, second) => {
      const decision = ledger.variantDecisions.find(
        (candidate) =>
          candidate.decision === 'separate-identities' &&
          candidate.identities.some(
            ({ externalKey }) => externalKey === `everythingpath/${first}`,
          ),
      );
      if (decision?.decision !== 'separate-identities')
        throw new Error(`No decision on ${first}.`);
      expect(decision.identities.map(({ externalKey }) => externalKey)).toEqual(
        [`everythingpath/${first}`, `everythingpath/${second}`],
      );
      const current = new Map(
        ownerSubjects(corpus).map(({ source, sourceSha256 }) => [
          locatorKeyOf(source),
          sourceSha256,
        ]),
      );
      expect(isCurrentDecision(decision, current)).toBe(true);
    },
  );

  it('separates all 31 revision groups the note lists, the twelve Unchained pairs included', () => {
    expect(ledger.variantDecisions).toHaveLength(31);
    expect(
      ledger.variantDecisions.every(
        ({ decision, review }) =>
          decision === 'separate-identities' && review.status === 'checked',
      ),
    ).toBe(true);
    expect(
      ledger.variantDecisions.filter(
        (decision) =>
          decision.decision === 'separate-identities' &&
          decision.identities.some(({ externalKey }) =>
            externalKey.includes('unchained-'),
          ),
      ),
    ).toHaveLength(12);
  });

  const items = variantReviewItems({
    ...corpus,
    ledger,
    books,
    keys: corpus.owners.keys,
  });
  const itemsOf = (key: string) =>
    items
      .filter(({ externalKey }) => externalKey === `everythingpath/${key}`)
      .map(({ kind, id }) => `${kind}:${id}`)
      .sort();

  it('holds reprints, shared KEY and all, as variants with their differing facts', () => {
    // Hellknight: ISWG p.278 and AG; its AlignmentAuraLVL bonus differs.
    expect(itemsOf('hellknight')).toEqual([
      'conflict:page',
      'conflict:variant:level',
      'conflict:variant:level',
      'variant:variant',
      'variant:variant',
    ]);
    expect(itemsOf('red-mantis-assassin')).toEqual([
      'conflict:page',
      'variant:variant',
      'variant:variant',
    ]);
    // Same-KEY records not in the ledger share their key, held as variants.
    for (const [file, line] of [
      ['pfsfg_abilities_class.lst', 215],
      ['mc_abilities_class.lst', 9],
    ] as const) {
      const locator = locatorOf(ownerAt(file, line));
      expect(corpus.owners.keys.get(locator)).toBe(
        'everythingpath/alchemist-grenadier',
      );
      expect(corpus.owners.holds.get(locator)).toBe('variant');
    }
  });

  it('holds the page PCGen copied from the Inner Sea World Guide as a page conflict', () => {
    const pages = items
      .filter(({ id }) => id === 'page')
      .map(({ externalKey, text }) => [externalKey, text]);
    expect(pages).toEqual([
      [
        'everythingpath/hellknight',
        "Hellknight cites p.278 (ag_classes.lst:170), but Adventurer's Guide has 192 pages.",
      ],
      [
        'everythingpath/red-mantis-assassin',
        "Red Mantis Assassin cites p.282 (ag_classes.lst:325), but Adventurer's Guide has 192 pages.",
      ],
    ]);
  });

  it('holds AG’s added alignment and dropped PRETEXT as prerequisite conflicts', () => {
    expect(itemsOf('warpriest-mantis-zealot')).toEqual([
      'conflict:variant:prerequisites',
      'conflict:variant:prerequisites',
      'variant:variant',
      'variant:variant',
    ]);
    expect(itemsOf('pathfinder-delver')).toEqual([
      'conflict:variant:prerequisites',
      'conflict:variant:prerequisites',
      'variant:variant',
      'variant:variant',
    ]);
  });

  it('sends the three non-identical People of the Stars duplicates to review', () => {
    for (const key of [
      'cavalier-qabarat-outrider',
      'druid-season-keeper',
      'ranger-bow-nomad',
    ])
      expect(itemsOf(key), key).toEqual(['variant:variant', 'variant:variant']);
  });

  it('raises nothing for a separated revision', () => {
    for (const [first, second] of separate)
      expect([...itemsOf(first), ...itemsOf(second)], first).toEqual([]);
  });

  // Owner decision 5: the Core Rulebook's mechanics; USH's copy is held.
  it('keys the Core Rulebook’s Arcane Trickster and holds USH’s copy as an attribution conflict', () => {
    expect(keyOf('cr_classes.lst', 345)).toBe(
      'everythingpath/arcane-trickster',
    );
    const ush = locatorOf(ownerAt('ush_classes.lst', 53));
    expect(corpus.owners.keys.has(ush)).toBe(false);
    expect(corpus.owners.holds.get(ush)).toBe('attribution');
    expect(
      corpus.owners.heldRecords.map(({ duplicateOf, hold, text }) => [
        duplicateOf,
        hold,
        text.includes('asserts no Undead Slayer'),
      ]),
    ).toEqual([['everythingpath/arcane-trickster', 'attribution', true]]);
    expect(itemsOf('arcane-trickster')).toEqual([]);
  });
});

// Over the whole pinned checkout, when it is present: the excerpt's hashes
// are the corpus's, and every key is unique. Vitest runs a skipped describe's
// body while collecting, so the tree is read only when the checkout is there;
// without it (CI) the two tests skip instead of failing the file.
const wholeTree = pcgenCheckoutIsAtPin()
  ? assign(await readPcgenTree(`${pcgenCheckout}/data/pathfinder/paizo`))
  : undefined;

describe.skipIf(!wholeTree)(
  'the identity ledger over the whole PCGen tree',
  () => {
    const ledger = () => {
      if (!wholeTree) throw new Error('the PCGen checkout is not at its pin');
      return wholeTree;
    };

    it('binds the corpus’s hashes and loses no frozen record', () => {
      const whole = ledger();
      for (const part of [whole.owners, whole.features]) {
        expect(part.vanished).toEqual([]);
        expect(part.staleDecisions).toEqual([]);
      }
    });

    it('derives no key twice for records of different KEYs', () => {
      const whole = ledger();
      for (const part of [whole.owners, whole.features])
        expect(
          part.proposals.filter(({ hold }) => hold === 'collision'),
        ).toEqual([]);
      const owners = new Set(whole.owners.keys.values());
      expect(
        [...new Set(whole.features.keys.values())].filter((key) =>
          owners.has(key),
        ),
      ).toEqual([]);
    });
  },
);
