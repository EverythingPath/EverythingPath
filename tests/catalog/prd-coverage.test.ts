// @vitest-environment node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  archetypesInScope,
  classCoverageOf,
  coverageOf,
  prdClassExclusions,
  prdClassSchedules,
  prdExclusions,
} from '../../scripts/catalog/prd-coverage';
import { prdCaptureName } from '../../scripts/catalog/prd-identity';
import {
  checklistFileSchema,
  completeManifestSchema,
} from '../../scripts/catalog/prd-manifest';
import { pinnedPath } from './pinned-sources';

// #716 P8: the PRD capture must hold every checklist archetype from a book
// the plan captures (plan §1), or name why it doesn't.
async function committed() {
  const manifest = completeManifestSchema.parse(
    JSON.parse(await readFile(pinnedPath('prd', 'manifest.json'), 'utf8')),
  );
  const checklist = checklistFileSchema.parse(
    JSON.parse(
      await readFile(pinnedPath('prd', 'checklist/pf-archetypes.json'), 'utf8'),
    ),
  );
  return { manifest, checklist };
}

describe('the PRD capture coverage', () => {
  it('maps every checklist archetype from a captured book to a captured page or a named exclusion', async () => {
    const { manifest, checklist } = await committed();
    const inScope = archetypesInScope(checklist.items);
    // APG, UM, UC, ARG, ACG, OA, MC and TG archetypes in the pinned checklist.
    expect(inScope).toHaveLength(448);
    const captured = new Set(
      manifest.pages
        .filter((page) => page.role === 'archetypes')
        .map((page) => page.path),
    );
    const byItem = new Map(
      manifest.coverage.items.map((entry) => [entry.item, entry]),
    );
    expect(byItem.size).toBe(inScope.length);
    for (const item of inScope) {
      const entry = byItem.get(item.file);
      expect(entry, item.name).toBeDefined();
      if (entry?.kind === 'page')
        expect(captured.has(entry.page), item.name).toBe(true);
      else if (entry?.kind === 'excluded')
        expect(manifest.coverage.exclusions[entry.exclusion], item.name).toBe(
          prdExclusions[entry.exclusion].reason,
        );
    }
  });

  it('captures the Monster Codex troll chapter for Druid (Troll Fury), Monster Codex p.224', async () => {
    const { manifest } = await committed();
    expect(
      manifest.coverage.items.find(
        (entry) => entry.name === 'Druid (Troll Fury)',
      ),
    ).toMatchObject({ kind: 'page', page: 'monsterCodex/trolls.html' });
    expect(
      manifest.pages
        .filter((page) => page.book === 'MC')
        .map((page) => page.path),
    ).toEqual([
      'monsterCodex/bugbears.html',
      'monsterCodex/gnolls.html',
      'monsterCodex/goblins.html',
      'monsterCodex/hobgoblins.html',
      'monsterCodex/kobolds.html',
      'monsterCodex/lizardfolk.html',
      'monsterCodex/trolls.html',
    ]);
  });

  it("excludes only ARG's uncommon races, which the plan doesn't capture", async () => {
    const { manifest } = await committed();
    const excluded = manifest.coverage.items.filter(
      (entry) => entry.kind === 'excluded',
    );
    expect(Object.keys(manifest.coverage.exclusions)).toEqual([
      'arg-uncommon-races',
    ]);
    expect(excluded.map((entry) => entry.name).sort()).toEqual([
      'Alchemist (Bogborn Alchemist)',
      'Alchemist (Deep Bomber)',
      'Bard (Shadow Puppeteer)',
      'Druid (Naga Aspirant)',
      'Fighter (Airborne Ambusher)',
      'Magus (Elemental Knight)',
      'Monk (Gray disciple)',
      'Monk (Treetop Monk)',
      'Oracle (Reincarnated Oracle)',
      'Ranger (Wave Warden)',
      'Rogue (Deadly Courtesan)',
      'Rogue (Eldritch Raider)',
      'Rogue (Kitsune Trickster)',
      'Witch (Dreamweaver)',
    ]);
  });

  it('finds an archetype by its heading on a page of its book', () => {
    // The heading as Monster Codex's kobold chapter prints it.
    const items = [
      {
        file: 'src/pf-archetypes/alchemist/alchemist-alchemical-trapper.qirxnEzln0keXPws.yaml',
        blob: '33151f779c7400dc454b95ca1d5f7ee8fac47a4c',
        name: 'Alchemist (Alchemical Trapper)',
        type: 'feat',
        subType: 'misc',
        classes: ['Alchemist'],
        sources: [{ id: 'PZO1130', pages: '128' }],
      },
    ];
    const kobolds = {
      path: 'monsterCodex/kobolds.html',
      book: 'MC',
      html: '<h2 id = "kobold-archetypes">Kobold Archetypes</h2><h3 id = "alchemical-trapper">Alchemical Trapper (Alchemist)</h3>',
    };
    expect(coverageOf({ items, pages: [kobolds] })).toEqual([
      {
        kind: 'page',
        item: items[0]?.file,
        name: 'Alchemist (Alchemical Trapper)',
        page: 'monsterCodex/kobolds.html',
      },
    ]);
    expect(() =>
      coverageOf({ items, pages: [{ ...kobolds, book: 'ARG' }] }),
    ).toThrow(/Alchemist \(Alchemical Trapper\).*no captured page/);
  });

  // Optional audit: the coverage recomputed from the full capture's pages.
  const capture = join(
    homedir(),
    'repos/everythingpath/sources',
    prdCaptureName,
  );
  it.skipIf(!existsSync(capture))(
    'matches the coverage recomputed from the full capture',
    async () => {
      const { manifest, checklist } = await committed();
      const pages = await Promise.all(
        manifest.pages
          .filter((page) => page.role === 'archetypes')
          .map(async (page) => ({
            path: page.path,
            book: page.book,
            html: await readFile(join(capture, page.file), 'utf8'),
          })),
      );
      expect(coverageOf({ items: checklist.items, pages })).toEqual(
        manifest.coverage.items,
      );
    },
  );
});

describe('the PRD capture class coverage', () => {
  // #716 P8b (owner decision 8 of 2026-10-20): the 40 base-class schedules
  // of research/716-p7-rules.md §1, each at the captured page that prints its
  // class table (as the 2026-10-20 capture found them), or not in the PRD.
  const expected: Record<string, string> = {
    barbarian: 'coreRulebook/classes/barbarian.html',
    bard: 'coreRulebook/classes/bard.html',
    cleric: 'coreRulebook/classes/cleric.html',
    druid: 'coreRulebook/classes/druid.html',
    monk: 'coreRulebook/classes/monk.html',
    paladin: 'coreRulebook/classes/paladin.html',
    sorcerer: 'coreRulebook/classes/sorcerer.html',
    alchemist: 'advancedPlayersGuide/baseClasses/alchemist.html',
    // The APG prints the antipaladin, an alternate class, in its paladin
    // options.
    antipaladin: 'advancedPlayersGuide/coreClasses/paladin.html',
    cavalier: 'advancedPlayersGuide/baseClasses/cavalier.html',
    inquisitor: 'advancedPlayersGuide/baseClasses/inquisitor.html',
    oracle: 'advancedPlayersGuide/baseClasses/oracle.html',
    summoner: 'advancedPlayersGuide/baseClasses/summoner.html',
    witch: 'advancedPlayersGuide/baseClasses/witch.html',
    magus: 'ultimateMagic/spellcasters/magus.html',
    gunslinger: 'ultimateCombat/classes/gunslinger.html',
    ninja: 'ultimateCombat/classes/ninja.html',
    samurai: 'ultimateCombat/classes/samurai.html',
    arcanist: 'advancedClassGuide/classes/arcanist.html',
    bloodrager: 'advancedClassGuide/classes/bloodrager.html',
    brawler: 'advancedClassGuide/classes/brawler.html',
    hunter: 'advancedClassGuide/classes/hunter.html',
    investigator: 'advancedClassGuide/classes/investigator.html',
    shaman: 'advancedClassGuide/classes/shaman.html',
    skald: 'advancedClassGuide/classes/skald.html',
    slayer: 'advancedClassGuide/classes/slayer.html',
    swashbuckler: 'advancedClassGuide/classes/swashbuckler.html',
    warpriest: 'advancedClassGuide/classes/warpriest.html',
    kineticist: 'occultAdventures/classes/kineticist.html',
    medium: 'occultAdventures/classes/medium.html',
    mesmerist: 'occultAdventures/classes/mesmerist.html',
    occultist: 'occultAdventures/classes/occultist.html',
    psychic: 'occultAdventures/classes/psychic.html',
    spiritualist: 'occultAdventures/classes/spiritualist.html',
    'unchained-barbarian': 'unchained/classes/barbarian.html',
    'unchained-monk': 'unchained/classes/monk.html',
    'unchained-rogue': 'unchained/classes/rogue.html',
    'unchained-summoner': 'unchained/classes/summoner.html',
    vigilante: 'not-in-prd',
    shifter: 'not-in-prd',
  };

  it('maps each of the 40 schedules to a captured class page or "not in the PRD"', async () => {
    const { manifest } = await committed();
    const { classes } = manifest.coverage;
    expect(prdClassSchedules).toHaveLength(40);
    expect(
      Object.fromEntries(
        classes.schedules.map((entry) => [
          entry.schedule,
          entry.kind === 'page' ? entry.page : entry.exclusion,
        ]),
      ),
    ).toEqual(expected);
    expect(classes.schedules.map((entry) => entry.schedule)).toEqual(
      prdClassSchedules.map((entry) => entry.schedule),
    );
    const captured = new Set(manifest.pages.map((page) => page.path));
    for (const entry of classes.schedules)
      if (entry.kind === 'page')
        expect(captured.has(entry.page), entry.name).toBe(true);
    expect(classes.exclusions).toEqual({
      'not-in-prd': prdClassExclusions['not-in-prd'].reason,
    });
  });

  it("captures every base class the PRD's class indexes and root link", async () => {
    const { manifest } = await committed();
    const byBook: Record<string, number> = {};
    for (const page of manifest.pages)
      if (page.role === 'classes')
        byBook[page.book] = (byBook[page.book] ?? 0) + 1;
    // CRB 11 (Fighter, Ranger, Rogue and Wizard too), APG 6, UM 1, UC 3,
    // ACG 10, OA 6, Pathfinder Unchained 4.
    expect(byBook).toEqual({
      CRB: 11,
      APG: 6,
      UM: 1,
      UC: 3,
      ACG: 10,
      OA: 6,
      PU: 4,
    });
  });

  it("names neither book of the excluded classes in the PRD's book list", async () => {
    // The PRD's root page, the capture's evidence for "not in the PRD".
    const root = await readFile(pinnedPath('prd', 'pages/index.html'), 'utf8');
    for (const book of prdClassExclusions['not-in-prd'].books)
      expect(root).not.toContain(book);
    for (const book of ['Ultimate Magic', 'Ultimate Combat', 'Unchained'])
      expect(root).toContain(book);
    expect(root).not.toMatch(/vigilante|shifter/i);
  });

  // Unchained's barbarian page as the PRD prints its table: captioned
  // without "Table:", under the class's plain heading.
  const unchainedBarbarian = {
    schedule: 'unchained-barbarian',
    name: 'Barbarian (Unchained)',
    book: 'PU',
    table: 'Unchained Barbarian',
  };
  const page = {
    path: 'unchained/classes/barbarian.html',
    book: 'PU',
    html: '<h1>Barbarian</h1><table id="unchained-barbarian-progression"><caption>Unchained Barbarian</caption><thead><tr><th>Level</th><th>Base Attack Bonus</th><th>Fort Save</th></tr></thead></table>',
  };

  it("finds a schedule by its class table's caption on a page of its book", () => {
    expect(
      classCoverageOf({ schedules: [unchainedBarbarian], pages: [page] }),
    ).toEqual([
      {
        kind: 'page',
        schedule: 'unchained-barbarian',
        name: 'Barbarian (Unchained)',
        page: 'unchained/classes/barbarian.html',
      },
    ]);
    expect(() =>
      classCoverageOf({
        schedules: [unchainedBarbarian],
        pages: [{ ...page, book: 'CRB' }],
      }),
    ).toThrow(/Barbarian \(Unchained\).*no captured page/);
  });

  it('reads "Table:" captions and needs a progression table', () => {
    // The CRB prints its tables as "Table: Barbarian".
    const barbarian = {
      schedule: 'barbarian',
      name: 'Barbarian',
      book: 'CRB',
      table: 'Barbarian',
    };
    const crb = {
      path: 'coreRulebook/classes/barbarian.html',
      book: 'CRB',
      html: '<table><caption>Table:  Barbarian</caption><tr><th>Level</th><th>Base Attack Bonus</th></tr></table>',
    };
    expect(classCoverageOf({ schedules: [barbarian], pages: [crb] })).toEqual([
      expect.objectContaining({ kind: 'page', page: crb.path }),
    ]);
    // The unchained page's table isn't the CRB barbarian's.
    expect(() =>
      classCoverageOf({
        schedules: [barbarian],
        pages: [{ ...page, book: 'CRB' }],
      }),
    ).toThrow(/no captured page/);
    // A caption alone, without the level progression, isn't a class table.
    expect(() =>
      classCoverageOf({
        schedules: [barbarian],
        pages: [
          {
            ...crb,
            html: '<table><caption>Table: Barbarian</caption><tr><th>Rage Power</th></tr></table>',
          },
        ],
      }),
    ).toThrow(/no captured page/);
  });

  it('fails a schedule excluded as not in the PRD whose table a captured page prints', () => {
    expect(() =>
      classCoverageOf({
        schedules: [
          {
            schedule: 'vigilante',
            name: 'Vigilante',
            book: 'UI',
            table: 'Vigilante',
          },
        ],
        pages: [
          {
            path: 'ultimateIntrigue/classes/vigilante.html',
            book: 'UI',
            html: '<table><caption>Vigilante</caption><tr><th>Base Attack Bonus</th></tr></table>',
          },
        ],
      }),
    ).toThrow(/Vigilante.*despite exclusion not-in-prd/);
  });
});

// Optional audit: the class coverage recomputed from the full capture.
describe.skipIf(
  !existsSync(join(homedir(), 'repos/everythingpath/sources', prdCaptureName)),
)('the PRD capture class coverage, recomputed', () => {
  it('matches the class coverage recomputed from the full capture', async () => {
    const { manifest } = await committed();
    const capture = join(
      homedir(),
      'repos/everythingpath/sources',
      prdCaptureName,
    );
    const pages = await Promise.all(
      manifest.pages.map(async (page) => ({
        path: page.path,
        book: page.book,
        html: await readFile(join(capture, page.file), 'utf8'),
      })),
    );
    expect(classCoverageOf({ schedules: prdClassSchedules, pages })).toEqual(
      manifest.coverage.classes.schedules,
    );
  });
});
