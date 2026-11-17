// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseIdentityLedger } from '../../scripts/catalog/everythingpath-identities';
import ledger from '../../scripts/catalog/everythingpath-identities.json';
import {
  archetypeClassContext,
  mapArchetype,
  type ArchetypeClassContext,
  type ArchetypeMapping,
} from '../../scripts/catalog/pcgen/archetypes';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import {
  assignPcgenIdentities,
  pcgenBookFacts,
} from '../../scripts/catalog/pcgen/identities';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import { readPcgenTree } from '../../scripts/catalog/pcgen/lst';
import { allIncrementKeys } from '../../scripts/catalog/pcgen/schedules';
import { pcgen716JudgmentArcanaFiles } from '../fixtures/pcgen-716/judgment-arcana-files';
import {
  bindArchetypeMapper,
  listReplacements,
  readArchetypeDetail,
  readInventoryClass,
  readPrdText,
  scheduleChecks,
  summarizeItems,
} from './pcgen-716-schedules';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import {
  pcgenCheckout,
  pcgenCheckoutIsAtPin,
  readPinned,
} from './pinned-sources';

// archetype-mapper-gaps (PRD #251): old-style TYPE spellings that named no
// schedule row though PCGen's own text names one, so the mapper raised an
// `unknown:*` review item that was its own gap, not an ambiguity in the
// sources. Each fixture raised the item before; a genuine unknown stays.

const tree = await readPcgenFixtureTree(pcgen716JudgmentArcanaFiles);
const view = buildEffectiveView(tree);
const reservedKeys = allIncrementKeys();
const inventory = inventoryPcgen(tree);
const identities = assignPcgenIdentities({
  inventory,
  view,
  ledger: parseIdentityLedger(ledger, { reservedKeys }),
  books: pcgenBookFacts(await readPinned('pf1', 'module/registry/sources.mjs')),
  reservedKeys,
});
const { mapPublishedArchetype } = bindArchetypeMapper({
  tree,
  view,
  identities,
});
const { derive, schedule } = scheduleChecks({ tree, view });
const map = (archetype: string) =>
  mapPublishedArchetype({
    className: readInventoryClass({ inventory, archetype }),
    archetype,
  });
const itemIds = (mapping: ArchetypeMapping) =>
  summarizeItems(mapping).map(([, id]) => id);

const aThousandFaces = 'pf1/MXj2WoyW7vLxiVYw';

describe('the druid’s A Thousand Faces, spelled without its article', () => {
  it('reads TYPE DruidThousandFaces as A Thousand Faces, which PCGen bridges only as DruidAThousandFaces', () => {
    // cr_abilities_globalvar.lst:394 bridges TYPE.DruidAThousandFaces; the
    // APG druids write DruidThousandFaces (apg_abilities_class.lst:1890,
    // :1894, :1895), and their 13th-level abilities say "This ability
    // replaces a thousand faces" (APG pp.99-100,
    // advancedPlayersGuide/coreClasses/druid.html:365, :396, :404).
    const bridges = derive('Druid').typeBridges;
    expect(bridges.get('DruidAThousandFaces')).toBe('AThousandFaces');
    expect(bridges.has('DruidThousandFaces')).toBe(false);
    for (const archetype of [
      'Druid Archetype ~ Arctic Druid',
      'Druid Archetype ~ Jungle Druid',
      'Druid Archetype ~ Mountain Druid',
    ]) {
      const mapping = map(archetype);
      expect(listReplacements(mapping), archetype).toContainEqual([
        13,
        aThousandFaces,
        'whole',
      ]);
      expect(itemIds(mapping), archetype).not.toContain(
        'unknown:ThousandFaces',
      );
    }
  });

  it('gives the urban druid its own A Thousand Faces at 6th in place of the 13th-level one', () => {
    // "An urban druid gains this ability at 6th level" (APG p.101,
    // advancedPlayersGuide/coreClasses/druid.html:426), granted at Druid 6
    // (apg_abilities_class.lst:1898).
    const urban = map('Druid Archetype ~ Urban Druid');
    expect(listReplacements(urban)).toContainEqual([
      13,
      aThousandFaces,
      'whole',
    ]);
    expect(readArchetypeDetail(urban).adds).toContainEqual({
      classLevel: 6,
      externalKey: expect.stringContaining('a-thousand-faces'),
    });
    // It removes the base feature, so its own is no alteration of it.
    expect(itemIds(urban)).not.toContain('alters:a-thousand-faces');
    expect(itemIds(urban)).not.toContain('unknown:ThousandFaces');
  });
});

describe('the category TYPE written with a space', () => {
  it('skips <Class> Archetype as it skips <Class>Archetype', () => {
    // ism_abilities_class.lst:335, oa_abilities_class.lst:1895, :1918.
    for (const archetype of [
      'Sorcerer Archetype ~ Razmiran Priest',
      'Rogue Archetype ~ Escapologist',
      'Witch Archetype ~ Ley Line Guardian',
    ])
      expect(itemIds(map(archetype)), archetype).not.toContain(
        'unknown: Archetype',
      );
  });
});

describe('numbered TYPE parts spelled <Class><F>Lvl<n>', () => {
  it('reads BombDamageLvl15 and 17 as the bomb rows at 15th and 17th (Psychonaut)', async () => {
    const page = await readPrdText({
      page: 'ultimateMagic/spellcastingClassOptions/alchemist.html',
      from: 421,
      to: 422,
    });
    expect(page).toContain(
      'At 15th level, a psychonaut adds moment of prescience',
    );
    expect(page).toContain(
      'This ability replaces the increase to bomb damage at this level.',
    );
    const psychonaut = map('Alchemist Archetype ~ Psychonaut');
    expect(listReplacements(psychonaut)).toEqual(
      expect.arrayContaining([
        [15, 'everythingpath/alchemist-bomb-15', 'part'],
        [17, 'everythingpath/alchemist-bomb-17', 'part'],
      ]),
    );
    expect(
      itemIds(psychonaut).filter((id) => String(id).startsWith('unknown:')),
    ).toEqual([]);
  });

  it('reads DiscoveryLvl18 as the 18th-level discovery (Preservationist)', async () => {
    const page = await readPrdText({
      page: 'ultimateMagic/spellcastingClassOptions/alchemist.html',
      from: 413,
      to: 413,
    });
    expect(page).toContain('This ability replaces his 18th-level discovery.');
    const preservationist = map('Alchemist Archetype ~ Preservationist');
    expect(listReplacements(preservationist)).toContainEqual([
      18,
      'everythingpath/alchemist-discovery-18',
      'part',
    ]);
    expect(itemIds(preservationist)).not.toContain('unknown:DiscoveryLvl18');
  });

  it('reads the level as the class level, not the part’s number: BloodlineSpellLvl3 is the bloodline spell at 3rd (Razmiran Priest)', () => {
    // The sorcerer's bloodline spells are numbered by spell level
    // (BloodlineSpell1 at 3rd, cr_abilities_class.lst:2338); the Lvl
    // spelling counts class levels, as Eldritch Scrapper's text shows
    // (below). Razmiran Priest's FACTs name BloodlineSpell3 and 5
    // (ism_abilities_class.lst:451), the rows at 7th and 11th, against its
    // TYPEs: the reviewed numbering defect still holds it for review.
    const razmiran = map('Sorcerer Archetype ~ Razmiran Priest');
    expect(listReplacements(razmiran)).toEqual(
      expect.arrayContaining([
        [3, 'pf1/qlQxKPARGGdOgNWm', 'part'],
        [5, 'everythingpath/sorcerer-bloodline-spell-5', 'part'],
        [7, 'everythingpath/sorcerer-bloodline-spell-7', 'part'],
        [11, 'everythingpath/sorcerer-bloodline-spell-11', 'part'],
      ]),
    );
    expect(itemIds(razmiran)).toContain('defect:bloodline-spell-numbering');
    expect(
      itemIds(razmiran).filter((id) => String(id).startsWith('unknown:')),
    ).toEqual([]);
  });

  it('reads BloodlinePowerLvl1 as the 1st-level power, which shares the Bloodline row and stays held (Eldritch Scrapper)', () => {
    // "replaces the sorcerer's bloodline powers gained 1st, 9th, and 15th
    // levels" (advancedClassGuide/classOptions/sorcerer.html:354).
    const scrapper = map('Sorcerer Archetype ~ Eldritch Scrapper');
    expect(listReplacements(scrapper)).toEqual([
      [9, 'everythingpath/sorcerer-bloodline-9', 'part'],
      [15, 'everythingpath/sorcerer-bloodline-15', 'part'],
    ]);
    expect(itemIds(scrapper)).toContain('sharedRow:BloodlinePower1');
    expect(
      itemIds(scrapper).filter((id) => String(id).startsWith('unknown:')),
    ).toEqual([]);
  });

  it('still holds a Lvl spelling that names no row: Vivisectionist’s BombDamageLvl1', () => {
    // Bombs are gained at 1st; their damage first increases at 3rd, so no
    // bomb damage row stands at 1st (um_abilities_class.lst:846).
    expect(itemIds(map('Alchemist Archetype ~ Vivisectionist'))).toContain(
      'unknown:BombDamageLvl1',
    );
  });
});

describe('Scrollmaster’s WizardFeat10', () => {
  it('reads it as the 10th-level wizard bonus feat its text replaces', async () => {
    const page = await readPrdText({
      page: 'ultimateMagic/spellcastingClassOptions/wizard.html',
      from: 395,
      to: 395,
    });
    expect(page).toContain(
      'This ability replaces the 10th-level wizard bonus feat.',
    );
    const scrollmaster = map('Wizard Archetype ~ Scrollmaster');
    expect(listReplacements(scrollmaster)).toContainEqual([
      10,
      'everythingpath/wizard-bonus-feats-10',
      'part',
    ]);
    expect(itemIds(scrollmaster)).not.toContain('unknown:Feat10');
  });
});

// --- The whole tree ---------------------------------------------------------

/** The builder's 21 classes, as PCGen names them (`launch-class-sources.ts`). */
const launchClasses = [
  'Alchemist',
  'Barbarian',
  'Bard',
  'Bloodrager',
  'Cavalier',
  'Cleric',
  'Druid',
  'Fighter',
  'Inquisitor',
  'Magus',
  'Monk',
  'Monk (Unchained)',
  'Oracle',
  'Paladin',
  'Ranger',
  'Rogue',
  'Slayer',
  'Sorcerer',
  'Summoner',
  'Witch',
  'Wizard',
];

/** An item's family, as archetype-coverage counted them. */
function familyOf({ kind, id }: { kind: string; id: string }) {
  const prefix =
    /^(alters|defect|unknown|grant|partialFormula|option|classSkills):/.exec(
      id,
    )?.[1];
  if (prefix) return `${prefix}:*`;
  if (id.startsWith('stackingGuard')) return 'stackingGuard';
  if (kind === 'uncheckedCasting') return 'uncheckedCasting';
  if (id === 'NAMEISPI') return 'NAMEISPI';
  return 'other';
}

describe.skipIf(!pcgenCheckoutIsAtPin())(
  'optional audit: every archetype of the 21 classes over the full local PCGen checkout (skips without it)',
  () => {
    it('counts the structure gate’s items by family', async () => {
      const whole = await readPcgenTree(
        `${pcgenCheckout}/${pcgenPin.directory}`,
      );
      const wholeView = buildEffectiveView(whole);
      const owners = inventoryPcgen(whole).owners.filter(
        (owner) =>
          owner.kind === 'canonical' &&
          launchClasses.includes(
            owner.className === 'Unchained Monk'
              ? 'Monk (Unchained)'
              : (owner.className ?? ''),
          ),
      );
      const slug = (key: string) =>
        `everythingpath/${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const byClass = new Map<string, ArchetypeMapping[]>();
      const contexts = new Map<string, ArchetypeClassContext>();
      for (const owner of owners) {
        const className =
          owner.className === 'Unchained Monk'
            ? 'Monk (Unchained)'
            : (owner.className ?? '');
        const context =
          contexts.get(className) ??
          archetypeClassContext({
            tree: whole,
            view: wholeView,
            schedule: schedule(className),
          });
        contexts.set(className, context);
        const { record } = owner;
        const mapping = mapArchetype({
          context,
          record,
          externalKey: slug(`${record.locator.key}@${record.locator.file}`),
          featureKeyOf: (feature) =>
            slug(`${feature.locator.key}@${feature.locator.file}`),
        });
        byClass.set(className, [...(byClass.get(className) ?? []), mapping]);
      }
      const mappings = [...byClass.values()].flat();
      const counts: Record<string, number> = {};
      for (const item of mappings.flatMap(({ items }) => items))
        counts[familyOf(item)] = (counts[familyOf(item)] ?? 0) + 1;
      expect(mappings).toHaveLength(860);
      // Before archetype-mapper-gaps: unknown:* 116 and stackingGuard 234,
      // 261 archetypes with no item of their own (archetype-coverage §2).
      // rotation-3: the class-skill pairs (classSkills:*, 1,784 items over
      // 892 pairs before) are the sheet's to warn about, so none is raised.
      expect(counts).toEqual({
        NAMEISPI: 45,
        'alters:*': 415,
        'defect:*': 212,
        'grant:*': 97,
        'option:*': 66,
        other: 63,
        'partialFormula:*': 84,
        stackingGuard: 173,
        uncheckedCasting: 188,
        'unknown:*': 45,
      });
      expect(mappings.filter(({ items }) => !items.length)).toHaveLength(274);
      // The sheet's class-skill identity: 164 archetypes change the class
      // skills, 8 of them with no added or removed skill recorded.
      const changesClassSkills = mappings.flatMap(({ subject: { entry } }) =>
        entry.detail.kind === 'archetype' && entry.detail.changesClassSkills
          ? [entry.detail]
          : [],
      );
      expect(changesClassSkills).toHaveLength(164);
      expect(
        changesClassSkills.filter(
          (detail) =>
            !detail.classSkillsAdded?.length &&
            !detail.classSkillsRemoved?.length,
        ),
      ).toHaveLength(8);
    }, 30_000);
  },
);
