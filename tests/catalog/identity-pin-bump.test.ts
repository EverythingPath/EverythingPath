// @vitest-environment node
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  locatorKeyOf,
  parseIdentityLedger,
  type IdentityLedger,
} from '../../scripts/catalog/everythingpath-identities';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import {
  assignIdentities,
  assignPcgenIdentities,
  freezeProposals,
  ownerSubjects,
  pcgenBookFacts,
} from '../../scripts/catalog/pcgen/identities';
import { variantReviewItems } from '../../scripts/catalog/pcgen/variant-review';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import { readPcgenTree } from '../../scripts/catalog/pcgen/lst';
import { allIncrementKeys } from '../../scripts/catalog/pcgen/schedules';
import { reviewedRemapSchema } from '../../src/lib/catalog/imported-entry-schema';
import { materializePinnedTree, readPinned } from './pinned-sources';

// #716 P6 (plan §5; research note 716-p6 §5): the ledger check on a pinned
// excerpt and on mutated copies of it, as a later PCGen pin could change it.
// Each mutation edits a real record in the copy only.

const pfsfg =
  'campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst';
const agAbilities = 'roleplaying_game/adventurers_guide/ag_abilities_class.lst';
const potsClass =
  'player_companion/people_of_the_stars/pots_abilities_class.lst';
const potsRace = 'player_companion/people_of_the_stars/pots_abilities_race.lst';
const iswgClasses = 'campaign_setting/inner_sea_world_guide/iswg_classes.lst';
const agClasses = 'roleplaying_game/adventurers_guide/ag_classes.lst';
const excerpt = [
  'campaign_setting/pathfinder_society_field_guide/pathfinder_society_field_guide.pcc',
  pfsfg,
  'roleplaying_game/adventurers_guide/_adventurers_guide.pcc',
  agAbilities,
  agClasses,
  'roleplaying_game/adventurers_guide/ag_abilitycategories.lst',
  'player_companion/people_of_the_stars/_people_of_the_stars.pcc',
  potsClass,
  potsRace,
  'campaign_setting/inner_sea_world_guide/inner_sea_world_guide.pcc',
  iswgClasses,
  'campaign_setting/inner_sea_world_guide/iswg_abilities_class.lst',
  'roleplaying_game/core_rulebook/cr_abilitycategories.lst',
  'roleplaying_game/advanced_players_guide/apg_abilitycategories.lst',
  'roleplaying_game/advanced_class_guide/acg_abilitycategories.lst',
  // The Core Rulebook's Arcane Trickster and PCGen's Undead Slayer's
  // Handbook copy of it (owner decision 5).
  'roleplaying_game/core_rulebook/core_rulebook.pcc',
  'roleplaying_game/core_rulebook/cr_classes.lst',
  'player_companion/undead_slayers_handbook/_undead_slayers_handbook.pcc',
  'player_companion/undead_slayers_handbook/ush_classes.lst',
];
// Monster Codex's Grenadier (p.116), the reprint a later pin brings.
const monsterCodex = [
  'roleplaying_game/monster_codex/_monster_codex.pcc',
  'roleplaying_game/monster_codex/mc_abilities_class.lst',
];

const reservedKeys = allIncrementKeys();
const books = pcgenBookFacts(
  await readPinned('pf1', 'module/registry/sources.mjs'),
);

/** Reads the excerpt (and any extra files) after `mutate` edits the copy. */
async function readExcerpt(
  mutate: (path: (file: string) => string) => Promise<void> = () =>
    Promise.resolve(),
  extra: readonly string[] = [],
) {
  const materialized = await materializePinnedTree(
    [...excerpt, ...extra].map((file) => `pcgen/${pcgenPin.directory}/${file}`),
  );
  try {
    await mutate((file) => join(materialized.pcgenPath, file));
    return await readPcgenTree(materialized.pcgenPath);
  } finally {
    await materialized.dispose();
  }
}
type Tree = Awaited<ReturnType<typeof readExcerpt>>;
function check(
  tree: Tree,
  ledger: IdentityLedger,
  identityRemaps: Parameters<
    typeof assignPcgenIdentities
  >[0]['identityRemaps'] = [],
) {
  const inventory = inventoryPcgen(tree);
  const view = buildEffectiveView(tree);
  return {
    inventory,
    view,
    ...assignPcgenIdentities({
      inventory,
      view,
      ledger: parseIdentityLedger(ledger, { reservedKeys }),
      books,
      reservedKeys,
      identityRemaps,
    }),
  };
}
async function edit(path: string, change: (text: string) => string) {
  await writeFile(path, change(await readFile(path, 'utf8')));
}
const pcgenLocator = (file: string, line: number, key: string) => ({
  source: 'pcgen' as const,
  locator: { file, line, key },
});
const locator = (file: string, key: string) =>
  locatorKeyOf(pcgenLocator(file, 1, key));
// A checked record names its review receipt (#757); these cases don't check
// receipts, so they cite #716 P6's rules review.
const reviewer = {
  reviewedBy: 'reviewer',
  reviewedOn: '2026-10-18',
  receipt: 'reviewer-20261018-081620-1216172',
};
const checked = (rationale: string, evidence: string) => ({
  status: 'checked' as const,
  rationale,
  evidence,
  ...reviewer,
});

const pristine = await readExcerpt();
// The ledger as P6 freezes it: every record's key derived once, owners
// first, its held variants left out.
const empty: IdentityLedger = {
  pcgenCommit: pcgenPin.commit,
  identities: [],
  variantDecisions: [],
  locatorRemaps: [],
  heldSources: [],
  retirements: [],
};
const owned = freezeProposals(empty, check(pristine, empty).owners.proposals);
const frozen = freezeProposals(
  owned,
  check(pristine, owned).features.proposals,
);
const baseline = check(pristine, frozen);
const keyOf = (report: ReturnType<typeof check>, file: string, key: string) =>
  report.owners.keys.get(locator(file, key)) ??
  report.features.keys.get(locator(file, key));
const loreWardenAg = 'Fighter Archetype ~ Lore Warden ~ AG';
const enlightenend = 'Bloodrager Archetype ~ Enlightenend Bloodrager ~ AG';
const enlightened = 'Bloodrager Archetype ~ Enlightened Bloodrager ~ AG';

describe('a pin bump against the identity ledger (#716 P6)', () => {
  it('freezes the excerpt’s keys once, holding only its variants', () => {
    expect(keyOf(baseline, agAbilities, loreWardenAg)).toBe(
      'everythingpath/fighter-lore-warden-ag',
    );
    expect(keyOf(baseline, pfsfg, 'Alchemist Archetype ~ Grenadier')).toBe(
      'everythingpath/alchemist-grenadier',
    );
    for (const part of [baseline.owners, baseline.features]) {
      expect(part.vanished).toEqual([]);
      expect(part.proposals.every(({ hold }) => hold === 'variant')).toBe(true);
    }
  });

  it('changes nothing when a line shifts', async () => {
    const shifted = check(
      await readExcerpt((path) =>
        edit(path(agAbilities), (text) => `# A new comment line\n${text}`),
      ),
      frozen,
    );
    expect(shifted.owners.keys).toEqual(baseline.owners.keys);
    expect(shifted.features.keys).toEqual(baseline.features.keys);
    expect([...shifted.owners.vanished, ...shifted.features.vanished]).toEqual(
      [],
    );
  });

  it('keeps the locator when only the KEY’s case changes', async () => {
    const recased = check(
      await readExcerpt((path) =>
        edit(path(agAbilities), (text) =>
          text.replaceAll(loreWardenAg, 'Fighter Archetype ~ Lore warden ~ AG'),
        ),
      ),
      frozen,
    );
    expect(
      recased.owners.keys.get(
        locator(agAbilities, 'Fighter Archetype ~ Lore warden ~ AG'),
      ),
    ).toBe('everythingpath/fighter-lore-warden-ag');
    expect(recased.owners.vanished).toEqual([]);
  });

  it('fails a KEY rename until a reviewed locator remap keeps the identity', async () => {
    const renamed = await readExcerpt((path) =>
      edit(path(agAbilities), (text) =>
        text.replaceAll(enlightenend, enlightened),
      ),
    );
    const unreviewed = check(renamed, frozen);
    expect(unreviewed.owners.passed).toBe(false);
    expect(
      unreviewed.owners.vanished.map(({ externalKey }) => externalKey),
    ).toEqual(['everythingpath/bloodrager-enlightened-bloodrager-ag']);
    expect(
      unreviewed.owners.proposals.find(
        ({ source }) => source.locator.key === enlightened,
      )?.hold,
    ).toBe('collision');

    const remapped = check(renamed, {
      ...frozen,
      locatorRemaps: [
        {
          externalKey: 'everythingpath/bloodrager-enlightened-bloodrager-ag',
          from: pcgenLocator(agAbilities, 698, enlightenend),
          to: pcgenLocator(agAbilities, 698, enlightened),
          review: checked(
            'PCGen corrected the KEY; the record is unchanged.',
            'ag_abilities_class.lst:698',
          ),
        },
      ],
    });
    expect(remapped.owners.vanished).toEqual([]);
    expect(remapped.owners.keys.get(locator(agAbilities, enlightened))).toBe(
      'everythingpath/bloodrager-enlightened-bloodrager-ag',
    );
    expect(
      remapped.owners.proposals.filter(
        ({ source }) => source.locator.key === enlightened,
      ),
    ).toEqual([]);
  });

  it('fails a file move until a reviewed locator remap keeps the identity', async () => {
    const movedFile = pfsfg.replace('.lst', '_moved.lst');
    const moved = await readExcerpt((path) =>
      rename(path(pfsfg), path(movedFile)),
    );
    const loreWarden = 'Fighter Archetype ~ Lore Warden';
    const unreviewed = check(moved, frozen);
    expect(
      unreviewed.owners.vanished.map(({ externalKey }) => externalKey),
    ).toContain('everythingpath/fighter-lore-warden');
    const remapped = check(moved, {
      ...frozen,
      locatorRemaps: [
        {
          externalKey: 'everythingpath/fighter-lore-warden',
          from: pcgenLocator(pfsfg, 253, loreWarden),
          to: pcgenLocator(movedFile, 253, loreWarden),
          review: checked('PCGen moved the file.', `${movedFile}:253`),
        },
      ],
    });
    expect(remapped.owners.keys.get(locator(movedFile, loreWarden))).toBe(
      'everythingpath/fighter-lore-warden',
    );
    expect(
      remapped.owners.vanished.map(({ externalKey }) => externalKey),
    ).not.toContain('everythingpath/fighter-lore-warden');
  });

  it('reports a new Grenadier reprint as a held proposal that takes no existing key', async () => {
    const bumped = check(await readExcerpt(undefined, monsterCodex), frozen);
    const grenadier = 'Alchemist Archetype ~ Grenadier';
    expect(bumped.owners.keys.get(locator(pfsfg, grenadier))).toBe(
      'everythingpath/alchemist-grenadier',
    );
    expect(
      bumped.owners.proposals
        .filter(({ source }) => source.locator.key === grenadier)
        .map(({ externalKey, hold, source }) => [
          externalKey,
          hold,
          source.locator.file,
        ]),
    ).toEqual([
      [
        'everythingpath/alchemist-grenadier-mc',
        'variant',
        'roleplaying_game/monster_codex/mc_abilities_class.lst',
      ],
    ]);
  });

  it('fails a deleted record until it is retired, and never reuses the retired key', async () => {
    const grenadier = 'Alchemist Archetype ~ Grenadier';
    const deleted = await readExcerpt((path) =>
      edit(path(pfsfg), (text) =>
        text
          .split('\n')
          .filter((line) => !line.includes(`KEY:${grenadier}\t`))
          .join('\n'),
      ),
    );
    expect(
      check(deleted, frozen).owners.vanished.map(
        ({ externalKey }) => externalKey,
      ),
    ).toEqual(['everythingpath/alchemist-grenadier']);
    const retired: IdentityLedger = {
      ...frozen,
      identities: frozen.identities.filter(
        ({ externalKey }) =>
          externalKey !== 'everythingpath/alchemist-grenadier',
      ),
      retirements: [
        {
          externalKey: 'everythingpath/alchemist-grenadier',
          sources: [pcgenLocator(pfsfg, 215, grenadier)],
          reason: 'Its record vanished at a pin bump.',
          reviewedBy: reviewer.reviewedBy,
          reviewedOn: reviewer.reviewedOn,
        },
      ],
    };
    expect(check(deleted, retired).owners.vanished).toEqual([]);
    // The record coming back is a new proposal; the retired key stays taken.
    const returned = check(pristine, retired).owners.proposals.find(
      ({ source }) => source.locator.key === grenadier,
    );
    expect(returned?.externalKey).toBe(
      'everythingpath/alchemist-grenadier-pfsfg',
    );
  });

  describe('a collapsed variant', () => {
    // People of the Stars p.11 in PCGen's class and race files: the
    // expected reprint decision, mechanics from the class file.
    const outrider = 'Cavalier Archetype ~ Qabarat Outrider';
    const classSource = pcgenLocator(potsClass, 7, outrider);
    const raceSource = pcgenLocator(potsRace, 117, outrider);
    const hashOf = (file: string) =>
      ownerSubjects({
        inventory: baseline.inventory,
        view: baseline.view,
      }).find(
        ({ source }) =>
          source.locator.file === file && source.locator.key === outrider,
      )?.sourceSha256 ?? '';
    const collapsed: IdentityLedger = {
      ...frozen,
      identities: [
        ...frozen.identities,
        {
          externalKey: 'everythingpath/cavalier-qabarat-outrider',
          kind: 'archetype',
          sources: [classSource, raceSource],
        },
      ],
      variantDecisions: [
        {
          decision: 'same-identity',
          externalKey: 'everythingpath/cavalier-qabarat-outrider',
          sources: [
            { source: classSource, sourceSha256: hashOf(potsClass) },
            { source: raceSource, sourceSha256: hashOf(potsRace) },
          ],
          mechanicsFrom: classSource,
          review: checked(
            'One People of the Stars archetype in two PCGen files.',
            'pots_abilities_class.lst:7; pots_abilities_race.lst:117',
          ),
        },
      ],
    };

    it('collapses both records into one identity while both hashes hold', () => {
      const report = check(pristine, collapsed);
      expect(report.owners.staleDecisions).toEqual([]);
      for (const file of [potsClass, potsRace]) {
        expect(report.owners.keys.get(locator(file, outrider))).toBe(
          'everythingpath/cavalier-qabarat-outrider',
        );
        expect(report.owners.holds.get(locator(file, outrider))).toBe(
          undefined,
        );
      }
    });

    it.each([
      ['the record it takes no mechanics from', potsRace],
      ['the record it takes mechanics from', potsClass],
    ])('reopens the decision when %s changes', async (_, file) => {
      // A later pin correcting the record's page: its tokens change.
      const report = check(
        await readExcerpt((path) =>
          edit(path(file), (text) =>
            text
              .split('\n')
              .map((line) =>
                line.includes(`KEY:${outrider}\t`)
                  ? line.replace('SOURCEPAGE:p.11', 'SOURCEPAGE:p.12')
                  : line,
              )
              .join('\n'),
          ),
        ),
        collapsed,
      );
      expect(report.owners.staleDecisions).toHaveLength(1);
      for (const held of [potsClass, potsRace])
        expect(report.owners.holds.get(locator(held, outrider))).toBe('stale');
    });
  });

  it('resolves references to a merged identity through its identity remap', () => {
    // Hellknight, ISWG p.278 and AG, first frozen apart and then reviewed
    // as one prestige class: `everythingpath/hellknight-ag` merges into
    // `everythingpath/hellknight` by a reviewed-remaps.json entry.
    const iswg = pcgenLocator(iswgClasses, 23, 'Hellknight');
    const ag = pcgenLocator(agClasses, 170, 'Hellknight');
    const hash = (file: string) =>
      ownerSubjects({
        inventory: baseline.inventory,
        view: baseline.view,
      }).find(
        ({ source }) =>
          source.locator.file === file && source.locator.key === 'Hellknight',
      )?.sourceSha256 ?? '';
    const merged: IdentityLedger = {
      ...frozen,
      identities: [
        ...frozen.identities,
        {
          externalKey: 'everythingpath/hellknight',
          kind: 'prestigeClass',
          sources: [iswg, ag],
        },
      ],
      variantDecisions: [
        {
          decision: 'same-identity',
          externalKey: 'everythingpath/hellknight',
          sources: [
            { source: iswg, sourceSha256: hash(iswgClasses) },
            { source: ag, sourceSha256: hash(agClasses) },
          ],
          mechanicsFrom: iswg,
          review: checked(
            'A reprint: both grant the same ten `~ HK` features.',
            'iswg_classes.lst:23; ag_classes.lst:170',
          ),
        },
      ],
    };
    const remap = reviewedRemapSchema.parse({
      from: 'everythingpath/hellknight-ag',
      to: 'everythingpath/hellknight',
      kind: 'prestigeClass',
      reason: 'The two Hellknight identities were reviewed as one reprint.',
      evidence: 'iswg_classes.lst:23; ag_classes.lst:170',
      ...reviewer,
    });
    const report = check(pristine, merged, [remap]);
    expect(report.owners.keys.get(locator(agClasses, 'Hellknight'))).toBe(
      'everythingpath/hellknight',
    );
    expect(report.owners.resolveKey('everythingpath/hellknight-ag')).toBe(
      'everythingpath/hellknight',
    );
    expect([
      ...report.owners.keys.values(),
      ...report.features.keys.values(),
    ]).not.toContain('everythingpath/hellknight-ag');
  });

  it('fails when every record of a scope vanished, the last one or all of them', () => {
    // The check covers the ledger's owners and features whatever survives.
    const features = frozen.identities.filter(({ kind }) =>
      kind.endsWith('Feature'),
    );
    expect(features.length).toBeGreaterThan(0);
    const none = assignIdentities({
      ledger: frozen,
      scope: 'features',
      subjects: [],
      books,
      reservedKeys,
    });
    expect(none.passed).toBe(false);
    expect(none.vanished.map(({ externalKey }) => externalKey).sort()).toEqual(
      features.map(({ externalKey }) => externalKey).sort(),
    );
  });

  describe('a held source (USH’s Arcane Trickster)', () => {
    const arcaneTrickster = 'Arcane Trickster';
    const ushFile = 'player_companion/undead_slayers_handbook/ush_classes.lst';
    const crbFile = 'roleplaying_game/core_rulebook/cr_classes.lst';
    const subjectsOf = (tree: Tree) =>
      ownerSubjects({
        inventory: inventoryPcgen(tree),
        view: buildEffectiveView(tree),
      }).filter(({ source }) => source.locator.key === arcaneTrickster);
    const [crb, ush] = [crbFile, ushFile].map((file) =>
      subjectsOf(pristine).find(({ source }) => source.locator.file === file),
    );
    if (!crb || !ush) throw new Error('No Arcane Tricksters.');
    const ledger: IdentityLedger = {
      ...empty,
      identities: [
        {
          externalKey: 'everythingpath/arcane-trickster',
          kind: 'prestigeClass',
          sources: [crb.source],
        },
      ],
      heldSources: [
        {
          source: ush.source,
          sourceSha256: ush.sourceSha256,
          kind: 'prestigeClass',
          duplicateOf: 'everythingpath/arcane-trickster',
          conflict: 'attribution',
          text: "PCGen's Undead Slayer's Handbook copies the Core Rulebook's Arcane Trickster.",
          review: checked(
            'Owner decision 5.',
            'ush_classes.lst:53; cr_classes.lst:345',
          ),
        },
      ],
    };
    const ownersCheck = (tree: Tree) =>
      assignIdentities({
        ledger: parseIdentityLedger(ledger),
        scope: 'owners',
        subjects: subjectsOf(tree),
        books,
      });

    it('passes while its record is the one reviewed', () => {
      const report = ownersCheck(pristine);
      expect(report.heldRecords.map(({ hold }) => hold)).toEqual([
        'attribution',
      ]);
      expect(report.passed).toBe(true);
    });

    it('fails once its record changes, or once it vanishes', async () => {
      const changed = ownersCheck(
        await readExcerpt((path) =>
          edit(path(ushFile), (text) =>
            text.replace(
              'CLASS:Arcane Trickster\t',
              'CLASS:Arcane Trickster\tOUTPUTNAME:Arcane Trickster\t',
            ),
          ),
        ),
      );
      expect(changed.heldRecords.map(({ hold }) => hold)).toEqual(['stale']);
      expect(changed.passed).toBe(false);
      const gone = ownersCheck(
        await readExcerpt((path) =>
          edit(path(ushFile), (text) =>
            text
              .split('\n')
              .filter((line) => !line.startsWith('CLASS:Arcane Trickster'))
              .join('\n'),
          ),
        ),
      );
      expect(
        gone.vanishedHeldSources.map(({ duplicateOf }) => duplicateOf),
      ).toEqual(['everythingpath/arcane-trickster']);
      expect(gone.passed).toBe(false);
    });
  });

  it('checks the effective SOURCEPAGE, after a `.MOD`', async () => {
    const pagesOf = (tree: Tree) => {
      const report = check(tree, frozen);
      return variantReviewItems({
        inventory: report.inventory,
        view: report.view,
        ledger: frozen,
        books,
        keys: report.owners.keys,
      })
        .filter(({ id }) => id === 'page')
        .map(({ text }) => text);
    };
    // AG's Hellknight cites ISWG's p.278 (ag_classes.lst:170).
    expect(pagesOf(pristine)).toContain(
      "Hellknight cites p.278 (ag_classes.lst:170), but Adventurer's Guide has 192 pages.",
    );
    // A later pin's `.MOD` correcting it clears the conflict; one moving
    // the Inner Sea World Guide's beyond its 320 pages raises one.
    const modded = await readExcerpt(async (path) => {
      await edit(
        path(agClasses),
        (text) => `${text}\nCLASS:Hellknight.MOD\tSOURCEPAGE:p.84\n`,
      );
      await edit(
        path(iswgClasses),
        (text) => `${text}\nCLASS:Hellknight.MOD\tSOURCEPAGE:p.378\n`,
      );
    });
    const pages = pagesOf(modded);
    expect(pages.filter((text) => text.includes('ag_classes.lst:170'))).toEqual(
      [],
    );
    expect(pages).toContain(
      'Hellknight cites p.378 (iswg_classes.lst:23), but Inner Sea World Guide has 320 pages.',
    );
  });
});
