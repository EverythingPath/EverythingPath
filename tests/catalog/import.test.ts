// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { resolve, join } from 'node:path';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { creatureTypeProgressionSeeds } from '../../src/lib/character-sheet-creature-types';
import {
  importCatalog,
  draftCatalogCuration,
  draftCatalogCurationWithReport,
} from '../../scripts/catalog/import.ts';

const fixtures = resolve('tests/fixtures/catalog');
const system = resolve(fixtures, 'pf1');
const content = resolve(fixtures, 'pf1-content');

it('reports the same draft coverage as importing the generated records', async () => {
  const input = {
    systemPath: resolve('tests/fixtures/curation/pf1'),
    contentPath: resolve('tests/fixtures/curation/pf1-content'),
    remaps: [],
  };
  const result = await draftCatalogCurationWithReport(input);
  expect(result.draft).toEqual(await draftCatalogCuration(input));
  const artifact = await importCatalog({ ...input, curation: result.draft });
  expect(result.report).toEqual(artifact.curation);
  expect(result.inputs).toEqual(artifact.catalog.inputs);
});

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function copyFixtures() {
  const root = await mkdtemp(join(tmpdir(), 'catalog-import-'));
  temporary.push(root);
  await cp(fixtures, root, { recursive: true });
  return root;
}

describe('pinned catalog extraction', () => {
  it('starts imported playable races at zero racial HD even when upstream supplies a count', async () => {
    const root = await copyFixtures();
    const path = join(root, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
    const source = await readFile(path, 'utf8');
    await writeFile(
      path,
      source.replace('system:\n', 'system:\n  racialHitDice: 4\n'),
    );
    const result = await importCatalog({
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    });
    expect(
      result.catalog.entries.find(
        (entry) => entry.externalKey === 'pf1/e6IaBxKgMxy1yKlr',
      )?.detail,
    ).toMatchObject({
      kind: 'race',
      racialHitDice: 0,
    });
  });

  it('seeds all thirteen creature-type progressions from the pinned imported resources', async () => {
    const result = await importCatalog({
      systemPath: system,
      contentPath: content,
      remaps: [],
    });
    const resources = result.catalog.resources.filter(
      (resource) => resource.detail.kind === 'creatureType',
    );
    expect(resources).toHaveLength(13);
    for (const seed of creatureTypeProgressionSeeds) {
      const resource = resources.find(
        (entry) => entry.externalKey === seed.sourceKey,
      );
      expect(resource, seed.name).toBeDefined();
      const detail = resource!.detail;
      expect(detail, seed.name).toMatchObject({
        kind: 'creatureType',
        tag: seed.creatureType,
        hitDie: seed.progression.hitDie,
        bab: seed.progression.bab,
        saves: seed.progression.saves,
        skillRanksPerHitDie: seed.progression.skillRanksPerHitDie,
        classSkills: seed.progression.classSkills
          .map((skill) => `skill.${skill}`)
          .sort(),
      });
    }
  });

  it('extracts inspectable entries with pack-independent identity and deterministic output', async () => {
    const result = await importCatalog({
      systemPath: system,
      contentPath: content,
      remaps: [],
    });
    expect(result.catalog.purpose).toBe('preview');
    expect(result.catalog.entries).toContainEqual(
      expect.objectContaining({
        externalKey: 'pf1/e6IaBxKgMxy1yKlr',
        name: 'Human',
        pack: 'races',
        detail: expect.objectContaining({ kind: 'race', racialHitDice: 0 }),
        sources: [{ book: 'PZO1110', pages: '27' }],
      }),
    );
    expect(
      await importCatalog({
        systemPath: system,
        contentPath: content,
        remaps: [],
      }),
    ).toEqual(result);
  });

  it('compares recursive records and undeclared packs without silently admitting them', async () => {
    const root = await copyFixtures();
    await mkdir(join(root, 'pf1/packs/new-pack/nested'), { recursive: true });
    const human = await readFile(
      join(root, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml'),
      'utf8',
    );
    await writeFile(
      join(root, 'pf1/packs/new-pack/nested/new.yaml'),
      human.replaceAll('e6IaBxKgMxy1yKlr', 'newIdentity12345'),
    );
    const result = await importCatalog({
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    });
    expect(result.comparison.records).toContainEqual(
      expect.objectContaining({
        externalKey: 'pf1/newIdentity12345',
        pack: 'new-pack',
        status: 'unassigned',
      }),
    );
    expect(result.comparison.coverageComplete).toBe(false);
    expect(result.comparison.packs).toContainEqual(
      expect.objectContaining({
        pack: 'new-pack',
        declared: false,
        present: true,
        unassigned: 1,
      }),
    );
  });

  it('reports the undecided society pack without importing its item records', async () => {
    const root = await copyFixtures();
    await mkdir(join(root, 'pf1-content/src/pf-society'), { recursive: true });
    await writeFile(
      join(root, 'pf1-content/src/pf-society/item.yaml'),
      '_id: societyItem\n_key: "!items!societyItem"\nname: Society Item\ntype: equipment\n',
    );
    const result = await importCatalog({
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    });
    expect(result.comparison.records).toContainEqual(
      expect.objectContaining({
        externalKey: 'pf1-content/societyItem',
        status: 'unassigned',
      }),
    );
    expect(
      result.catalog.entries.some(
        (entry) => entry.externalKey === 'pf1-content/societyItem',
      ),
    ).toBe(false);
  });

  it('preserves the parse failure as the cause of an invalid upstream record error', async () => {
    const root = await copyFixtures();
    await writeFile(join(root, 'pf1/packs/races/broken.yaml'), 'name: [');
    await expect(
      importCatalog({
        systemPath: join(root, 'pf1'),
        contentPath: join(root, 'pf1-content'),
        remaps: [],
      }),
    ).rejects.toMatchObject({
      message: 'Invalid upstream YAML record: pf1/packs/races/broken.yaml',
      cause: expect.any(Error),
    });
  });

  it('rejects different majors and versions other than the pinned releases', async () => {
    const root = await copyFixtures();
    const path = join(root, 'pf1-content/module.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    await writeFile(path, JSON.stringify({ ...manifest, version: '12.0.0' }));
    await expect(
      importCatalog({
        systemPath: join(root, 'pf1'),
        contentPath: join(root, 'pf1-content'),
        remaps: [],
      }),
    ).rejects.toThrow('major');
    await writeFile(path, JSON.stringify({ ...manifest, version: '11.5.0' }));
    await expect(
      importCatalog({
        systemPath: join(root, 'pf1'),
        contentPath: join(root, 'pf1-content'),
        remaps: [],
      }),
    ).rejects.toThrow('pinned');
  });

  it('uses default kinds and progression for unrecognized upstream labels', async () => {
    const root = await copyFixtures();
    const { parse, stringify } = await import('yaml');
    const buffFile = join(root, 'pf1/packs/buffs/haste.NWImcWGTjCtw1Zf0.yaml');
    const buff = parse(await readFile(buffFile, 'utf8'));
    buff.system.subType = 'constructor';
    await writeFile(buffFile, stringify(buff));
    await writeFile(
      join(root, 'pf1/packs/classes/unknown.yaml'),
      stringify({
        _id: 'unknownClass',
        _key: '!items!unknownClass',
        name: 'Unknown Class',
        type: 'class',
        system: { subType: 'constructor', bab: 'constructor' },
      }),
    );
    const { catalog } = await importCatalog({
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    });
    expect(
      catalog.entries.find(
        (entry) => entry.externalKey === 'pf1/NWImcWGTjCtw1Zf0',
      )?.detail,
    ).toEqual({ kind: 'manual' });
    expect(
      catalog.entries.find((entry) => entry.externalKey === 'pf1/unknownClass')
        ?.detail,
    ).toMatchObject({ kind: 'class', classKind: 'base', bab: 'half' });
  });

  it('maps representative kinds, companion resources and explicit per-record exclusions', async () => {
    const { catalog, comparison } = await importCatalog({
      systemPath: system,
      contentPath: content,
      remaps: [],
    });
    const kinds = new Set(catalog.entries.map((entry) => entry.detail.kind));
    expect(kinds).toEqual(
      new Set([
        'race',
        'class',
        'classFeature',
        'feat',
        'trait',
        'racialTrait',
        'item',
        'itemAbility',
        'spell',
        'spellEffect',
        'manual',
      ]),
    );
    expect(
      new Set(catalog.resources.map((entry) => entry.detail.kind)),
    ).toEqual(
      new Set([
        'creatureType',
        'companionFeature',
        'companion',
        'familiar',
        'eidolonForm',
        'eidolonEvolution',
      ]),
    );
    expect(
      catalog.resources.filter((entry) => entry.detail.kind === 'creatureType'),
    ).toHaveLength(13);
    expect(
      catalog.entries.filter((entry) => entry.pack === 'monster-abilities'),
    ).toHaveLength(13);
    expect(catalog.entries).toContainEqual(
      expect.objectContaining({
        externalKey: 'pf1/fOSuWwRSZLTrROch',
        detail: expect.objectContaining({
          kind: 'item',
          weapon: expect.objectContaining({
            dice: '1d4',
            threat: 19,
            mult: 2,
            thrown: true,
            finesse: true,
          }),
        }),
      }),
    );
    expect(catalog.entries).toContainEqual(
      expect.objectContaining({
        name: 'Fighter',
        detail: expect.objectContaining({
          kind: 'class',
          hitDie: 10,
          bab: 'full',
          skillRanksPerLevel: 2,
        }),
      }),
    );
    expect(catalog.entries).toContainEqual(
      expect.objectContaining({
        externalKey: 'pf1/NWImcWGTjCtw1Zf0',
        detail: expect.objectContaining({
          kind: 'spellEffect',
          spellKey: 'pf1/s9amdo5398alb5p0',
          defaultCasterLevel: 5,
          lastsOverOneDay: false,
        }),
      }),
    );
    expect(catalog.entries).toContainEqual(
      expect.objectContaining({
        externalKey: 'pf1-content/XpZ3k2gmqEF6xnuE',
        detail: expect.objectContaining({ kind: 'racialTrait' }),
      }),
    );
    expect(
      catalog.entries.find(
        (entry) => entry.externalKey === 'pf1/Iv8lkpAQXwsBqVwt',
      )?.detail.kind,
    ).toBe('item');
    expect(
      catalog.resources.find(
        (entry) => entry.externalKey === 'pf1-content/YB38Da80HxcuK3wE',
      )?.detail.kind,
    ).toBe('eidolonEvolution');
    expect(
      comparison.records.find(
        (record) => record.externalKey === 'pf1/Vm8ccE6qchTx2Trn',
      )?.status,
    ).toBe('excluded');
    for (const id of [
      'OGvHcwhmrl2F70Rh',
      'jTaeREVBdEeawArA',
      'upTvrmZoeKq2LI0F',
    ]) {
      expect(comparison.records).toContainEqual(
        expect.objectContaining({
          externalKey: `pf1-content/${id}`,
          status: 'excluded',
        }),
      );
    }
  });

  it('sanitizes rules HTML, resolves catalog links and keeps unsafe mechanics inert and reported', async () => {
    const root = await copyFixtures();
    const file = join(root, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
    const { parse, stringify } = await import('yaml');
    const record = parse(await readFile(file, 'utf8'));
    record.system.description.value =
      '<p onclick="evil()">Safe <strong>rules</strong><script>evil()</script><img src="x" onerror="evil()"><a href="javascript:evil()">bad</a><a href="https://example.org/rules">good</a> @UUID[Compendium.pf1.spells.Item.s9amdo5398alb5p0]{Haste} @UUID[Compendium.pf1.macros.Item.missing]{Unknown}</p>';
    record.system.changes = [
      { target: 'str', type: 'racial', formula: '2' },
      {
        target: 'skill.per',
        type: 'competence',
        formula: 'floor(@attributes.hd.total / 2)',
      },
      { target: 'str', type: 'racial', formula: 'globalThis.evil()' },
      { target: 'missingTarget', type: 'racial', formula: '3' },
    ];
    await writeFile(file, stringify(record));
    const result = await importCatalog({
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    });
    const human = result.catalog.entries.find(
      (entry) => entry.name === 'Human',
    );
    expect(human?.description).toBe(
      '<p>Safe <strong>rules</strong>bad<a href="https://example.org/rules">good</a> <a href="catalog:pf1/s9amdo5398alb5p0">Haste</a> Unknown</p>',
    );
    expect(human?.modifiers).toEqual([
      { target: 'ability.str', bonusType: 'racial', value: 2 },
      {
        target: 'skill.per',
        bonusType: 'competence',
        value: { formula: 'floor(@hitDice / 2)' },
      },
    ]);
    expect(human?.unsupported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'changes',
          value: {
            target: 'str',
            type: 'racial',
            formula: 'globalThis.evil()',
          },
        }),
        expect.objectContaining({
          field: 'changes',
          value: { target: 'missingTarget', type: 'racial', formula: '3' },
        }),
      ]),
    );
    expect(result.unsupported.entries).toContainEqual(
      expect.objectContaining({ externalKey: 'pf1/e6IaBxKgMxy1yKlr' }),
    );
  });

  it('preserves retained formulas and plain strings while sanitizing known HTML fields', async () => {
    const root = await copyFixtures();
    const { parse, stringify } = await import('yaml');
    const file = join(root, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
    const record = parse(await readFile(file, 'utf8'));
    record.system.actions = [
      {
        name: 'Tom & Jerry',
        condition: 'a<b',
        damage: { parts: [{ formula: '@size < 3 ? 1 : 2' }] },
        description: '<p onclick="evil()">Rules<script>evil()</script></p>',
        conditionals: [
          {
            name: '<b>Bonus</b><script>evil()</script>',
            modifiers: [{ formula: 'a<b' }],
          },
        ],
      },
    ];
    record.system.contextNotes = [
      { target: 'skill.per', text: '<b>Notice</b><script>evil()</script>' },
    ];
    await writeFile(file, stringify(record));
    const { catalog } = await importCatalog({
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    });
    const human = catalog.entries.find((entry) => entry.name === 'Human');
    expect(human?.unsupported).toContainEqual(
      expect.objectContaining({
        field: 'gameContent',
        value: expect.objectContaining({
          actions: [
            {
              name: 'Tom & Jerry',
              condition: 'a<b',
              damage: { parts: [{ formula: '@size < 3 ? 1 : 2' }] },
              description: '<p>Rules</p>',
              conditionals: [
                { name: '<b>Bonus</b>', modifiers: [{ formula: 'a<b' }] },
              ],
            },
          ],
        }),
      }),
    );
    expect(human?.unsupported).toContainEqual(
      expect.objectContaining({
        field: 'contextNotes',
        value: { target: 'skill.per', text: 'Notice' },
      }),
    );
  });

  it('flags all five documented attribution holds without resolving their notices', async () => {
    const root = await copyFixtures();
    const { parse, stringify } = await import('yaml');
    const file = join(root, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
    const record = parse(await readFile(file, 'utf8'));
    const heldSources = [
      { name: 'Pathfinder Comic', publisher: 'Dynamite Entertainment' },
      { id: 'DYN0032-E' },
      { id: 'DYN0010-A' },
      { title: 'Pathfinder: Worldscape #2' },
      { id: 'DYN0046-HC', publisher: 'Paizo' },
      { id: 'PZOGWK0001' },
      { id: 'PZOPSS0412' },
      { id: 'PZO9297' },
      { id: 'PZO9064' },
    ];
    for (const [index, source] of heldSources.entries()) {
      await writeFile(
        join(root, 'pf1/packs/races', `held${index}.yaml`),
        stringify({
          ...record,
          _id: `held${index}`,
          _key: `!items!held${index}`,
          system: { ...record.system, sources: [source] },
        }),
      );
    }
    const { catalog } = await importCatalog({
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    });
    for (const index of heldSources.keys()) {
      const entry = catalog.entries.find(
        (entry) => entry.externalKey === `pf1/held${index}`,
      );
      expect(entry?.unsupported).toContainEqual(
        expect.objectContaining({
          field: 'attribution',
          reason: expect.stringContaining('notice/evidence hold'),
        }),
      );
    }
  });

  it.each(['CadEsVvAN7kdruSH', 'aLCy6zW8AldME74r', 'xhUw4hzZlljYFCzj'])(
    'holds identified Worldscape weapon %s when upstream omits its source metadata',
    async (id) => {
      const root = await copyFixtures();
      const { parse, stringify } = await import('yaml');
      const file = join(root, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
      const record = parse(await readFile(file, 'utf8'));
      await writeFile(
        file,
        stringify({
          ...record,
          _id: id,
          _key: `!items!${id}`,
          name: 'Thark rifle',
          system: { ...record.system, sources: [] },
        }),
      );
      const { catalog } = await importCatalog({
        systemPath: join(root, 'pf1'),
        contentPath: join(root, 'pf1-content'),
        remaps: [],
      });
      const rifle = catalog.entries.find(
        (entry) => entry.externalKey === `pf1/${id}`,
      );
      expect(rifle?.sources).toEqual([]);
      expect(rifle?.unsupported).toContainEqual(
        expect.objectContaining({
          field: 'attribution',
          reason: expect.stringContaining('notice/evidence hold'),
        }),
      );
    },
  );

  it('associates spell effects from the first spell link with variant and inverted names', async () => {
    const root = await copyFixtures();
    const { parse, stringify } = await import('yaml');
    const spellFile = join(
      root,
      'pf1/packs/spells/nested/haste.s9amdo5398alb5p0.yaml',
    );
    const spell = parse(await readFile(spellFile, 'utf8'));
    const variants = [
      {
        id: 'aligned',
        spell: 'Align Weapon',
        effect: 'Align Weapon (Lawful)',
        link: '@Compendium[pf1.spells.aligned]',
      },
      {
        id: 'immunity',
        spell: 'Spell Immunity, Greater',
        effect: 'Greater Spell Immunity',
        link: '@UUID[Compendium.pf1.spells.Item.immunity]',
      },
      {
        id: 'mismatch',
        spell: 'Unrelated',
        effect: 'Haste',
        link: '@Compendium[pf1.spells.mismatch] @UUID[Compendium.pf1.spells.Item.s9amdo5398alb5p0]',
      },
    ];
    for (const variant of variants) {
      await writeFile(
        join(root, 'pf1/packs/spells', `${variant.id}.yaml`),
        stringify({
          ...spell,
          _id: variant.id,
          _key: `!items!${variant.id}`,
          name: variant.spell,
        }),
      );
      await writeFile(
        join(root, 'pf1/packs/buffs', `${variant.id}.yaml`),
        stringify({
          _id: `${variant.id}Effect`,
          _key: `!items!${variant.id}Effect`,
          name: variant.effect,
          type: 'buff',
          system: { subType: 'spell', description: { value: variant.link } },
        }),
      );
    }
    const { catalog } = await importCatalog({
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    });
    expect(
      catalog.entries.find((entry) => entry.externalKey === 'pf1/alignedEffect')
        ?.detail,
    ).toMatchObject({ spellKey: 'pf1/aligned' });
    expect(
      catalog.entries.find(
        (entry) => entry.externalKey === 'pf1/immunityEffect',
      )?.detail,
    ).toMatchObject({ spellKey: 'pf1/immunity' });
    expect(
      catalog.entries.find(
        (entry) => entry.externalKey === 'pf1/mismatchEffect',
      )?.detail,
    ).not.toHaveProperty('spellKey');
  });

  it('applies reviewed cross-repository remaps to entries and links, rejecting incompatible or conflicting identities', async () => {
    const remap = {
      from: 'pf1/s9amdo5398alb5p0',
      to: 'pf1-content/previousHaste123',
      kind: 'spell',
      reason: 'Fixture relocation retaining the established identity.',
      evidence: 'Fixture-only reviewed example',
      reviewedBy: 'Fixture reviewer',
      reviewedOn: '2026-10-02',
    };
    const result = await importCatalog({
      systemPath: system,
      contentPath: content,
      remaps: [remap],
    });
    expect(result.catalog.entries).toContainEqual(
      expect.objectContaining({
        externalKey: remap.to,
        upstreamKey: remap.from,
        detail: expect.objectContaining({ kind: 'spell' }),
      }),
    );
    expect(
      result.catalog.entries.find(
        (entry) => entry.externalKey === 'pf1/NWImcWGTjCtw1Zf0',
      )?.detail,
    ).toMatchObject({ spellKey: remap.to });
    expect(
      result.catalog.entries.find(
        (entry) => entry.externalKey === 'pf1/NWImcWGTjCtw1Zf0',
      )?.description,
    ).toContain('catalog:pf1-content/previousHaste123');
    await expect(
      importCatalog({
        systemPath: system,
        contentPath: content,
        remaps: [{ ...remap, kind: 'item' }],
      }),
    ).rejects.toThrow('kind');
    await expect(
      importCatalog({
        systemPath: system,
        contentPath: content,
        remaps: [{ ...remap, to: 'pf1/e6IaBxKgMxy1yKlr' }],
      }),
    ).rejects.toThrow('identity');
    await expect(
      importCatalog({
        systemPath: system,
        contentPath: content,
        remaps: [{ ...remap, reviewedBy: '' }],
      }),
    ).rejects.toThrow();
  });

  it('preserves custom upstream source titles without inventing a book code', async () => {
    const result = await importCatalog({
      systemPath: system,
      contentPath: content,
      remaps: [],
    });
    const breeze = result.catalog.entries.find(
      (entry) => entry.externalKey === 'pf1/hw79kc0v9smvb6mj',
    );
    expect(breeze?.sources).toContainEqual({
      book: 'Paizo Blog - Ultimate Cantrips',
      pages: '',
    });
    expect(breeze?.unsupported).toContainEqual(
      expect.objectContaining({
        field: 'sources',
        reason: expect.stringContaining('custom'),
        value: expect.objectContaining({
          url: 'https://paizo.com/community/blog/v5748dyo5lc7e&page=2?Ultimate-Cantrips',
        }),
      }),
    );
  });

  it('resolves already-retained identity links and rejects same-stage or forward formula dependencies', async () => {
    const root = await copyFixtures();
    const { parse, stringify } = await import('yaml');
    const file = join(root, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
    const record = parse(await readFile(file, 'utf8'));
    record.system.description.value =
      '@UUID[Compendium.pf-content.spells.Item.previousHaste123]{Haste}';
    record.system.changes = [
      { target: 'str', type: 'racial', formula: '@bab' },
      { target: 'bab', type: 'untyped', formula: '@bab' },
    ];
    await writeFile(file, stringify(record));
    const result = await importCatalog({
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [
        {
          from: 'pf1/s9amdo5398alb5p0',
          to: 'pf1-content/previousHaste123',
          kind: 'spell',
          reason: 'Fixture relocation',
          evidence: 'Fixture-only review',
          reviewedBy: 'Fixture reviewer',
          reviewedOn: '2026-10-02',
        },
      ],
    });
    const human = result.catalog.entries.find(
      (entry) => entry.name === 'Human',
    );
    expect(human?.description).toBe(
      '<a href="catalog:pf1-content/previousHaste123">Haste</a>',
    );
    expect(human?.modifiers).toEqual([]);
    expect(
      human?.unsupported.filter((issue) => issue.field === 'changes'),
    ).toHaveLength(2);
  });

  it('fills v11 omitted Wizard progression defaults and preserves several historical aliases', async () => {
    const root = await copyFixtures();
    const { parse, stringify } = await import('yaml');
    const file = join(root, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
    const record = parse(await readFile(file, 'utf8'));
    record.system.description.value =
      '@UUID[Compendium.pf-content.spells.Item.oldHasteOne]{First} @UUID[Compendium.pf-content.spells.Item.oldHasteTwo]{Second}';
    await writeFile(file, stringify(record));
    const remaps = ['oldHasteOne', 'oldHasteTwo'].map((id) => ({
      from: `pf1-content/${id}`,
      to: 'pf1/s9amdo5398alb5p0',
      kind: 'spell',
      reason: 'Fixture reviewed merge',
      evidence: 'Fixture-only comparison',
      reviewedBy: 'Fixture reviewer',
      reviewedOn: '2026-10-02',
    }));
    const { catalog } = await importCatalog({
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps,
    });
    expect(
      catalog.entries.find((entry) => entry.name === 'Wizard')?.detail,
    ).toMatchObject({
      bab: 'half',
      hitDie: 6,
      saves: { fort: 'poor', ref: 'poor', will: 'good' },
    });
    expect(
      catalog.entries.find((entry) => entry.name === 'Human')?.description,
    ).toBe(
      '<a href="catalog:pf1/s9amdo5398alb5p0">First</a> <a href="catalog:pf1/s9amdo5398alb5p0">Second</a>',
    );
  });

  it('keeps companion embedded game content inspectable without runtime scripts or global identities', async () => {
    const root = await copyFixtures();
    const { parse, stringify } = await import('yaml');
    const file = join(
      root,
      'pf1-content/src/pf-eidolon-forms/Aberrant_Baseform_UdfkktRJL6fLSGHG.yaml',
    );
    const record = parse(await readFile(file, 'utf8'));
    record.system.details = {
      biography: { value: '<p>Aberrant description</p>' },
    };
    record.items = [
      {
        _id: 'embeddedOnly',
        name: 'Embedded feature',
        type: 'feat',
        system: {
          description: { value: '<p>Game content</p>' },
          changes: [
            { target: 'str', formula: '@size < 3 ? 1 : 2', type: 'racial' },
          ],
          contextNotes: [
            { text: '<b>Notice</b><script>runtime-sentinel</script>' },
          ],
          actions: [
            {
              name: 'Tom & Jerry',
              condition: 'a<b',
              conditionals: [
                { name: '<i>Bonus</i><script>runtime-sentinel</script>' },
              ],
            },
          ],
          scriptCalls: [{ command: 'runtime-sentinel' }],
        },
      },
    ];
    await writeFile(file, stringify(record));
    const result = await importCatalog({
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    });
    const resource = result.catalog.resources.find(
      (entry) => entry.externalKey === 'pf1-content/UdfkktRJL6fLSGHG',
    );
    expect(resource?.description).toContain('Aberrant');
    expect(resource?.unsupported).toContainEqual(
      expect.objectContaining({
        field: 'embeddedItems',
        value: [
          expect.objectContaining({
            name: 'Embedded feature',
            description: '<p>Game content</p>',
            content: {
              changes: [
                { target: 'str', formula: '@size < 3 ? 1 : 2', type: 'racial' },
              ],
              contextNotes: [{ text: '<b>Notice</b>' }],
              actions: [
                {
                  name: 'Tom & Jerry',
                  condition: 'a<b',
                  conditionals: [{ name: '<i>Bonus</i>' }],
                },
              ],
            },
          }),
        ],
      }),
    );
    expect(JSON.stringify(result.catalog)).not.toContain('runtime-sentinel');
    expect(
      result.catalog.entries.some((entry) =>
        entry.externalKey.endsWith('/embeddedOnly'),
      ),
    ).toBe(false);
  });

  it('reproduces the committed representative catalog and inventory artifacts byte for byte', async () => {
    const result = await importCatalog({
      systemPath: system,
      contentPath: content,
      remaps: [],
    });
    for (const [name, report] of Object.entries(result)) {
      expect(JSON.stringify(report, null, 2) + '\n').toBe(
        await readFile(join(fixtures, 'expected', `${name}.json`), 'utf8'),
      );
    }
  });
});

it('admits resolved named caster-level scaling and recorded Spell Effect caster levels before ability resolution', async () => {
  // #251 §8: qualified casting values feed dependent stats; recorded Spell Effect CL is an early input.
  const root = await copyFixtures();
  const { parse, stringify } = await import('yaml');
  const humanFile = join(root, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
  const human = parse(await readFile(humanFile, 'utf8'));
  human.system.changes = [
    {
      target: 'damage',
      type: 'untyped',
      formula: '@casterLevel.arcane + @casterLevel.campaign.wizard',
    },
    { target: 'str', type: 'racial', formula: '@casterLevel.arcane' },
  ];
  await writeFile(humanFile, stringify(human));
  const spellFile = join(
    root,
    'pf1/packs/buffs/accurate-stance.CjQ4VmDIRBb3k7Dg.yaml',
  );
  const effect = parse(await readFile(spellFile, 'utf8'));
  effect.system.subType = 'spell';
  effect.system.changes = [
    { target: 'str', type: 'enh', formula: 'floor(@casterLevel / 6)' },
  ];
  await writeFile(spellFile, stringify(effect));
  const result = await importCatalog({
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  });
  expect(
    result.catalog.entries.find((entry) => entry.name === 'Human')?.modifiers,
  ).toEqual([
    {
      target: 'damage',
      bonusType: 'untyped',
      value: { formula: '@casterLevel.arcane + @casterLevel.campaign.wizard' },
    },
  ]);
  expect(
    result.catalog.entries.find((entry) => entry.name === 'Accurate Stance')
      ?.modifiers,
  ).toEqual([
    {
      target: 'ability.str',
      bonusType: 'enhancement',
      value: { formula: 'floor(@casterLevel / 6)' },
    },
  ]);
});

it('retains unsafe integer literals as unsupported instead of admitting corrupted numeric contributions', async () => {
  const root = await copyFixtures();
  const { parse, stringify } = await import('yaml');
  const file = join(root, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
  const human = parse(await readFile(file, 'utf8'));
  human.system.changes = [
    { target: 'str', type: 'racial', formula: '9007199254740993' },
    { target: 'str', type: 'racial', formula: '-9007199254740993' },
    { target: 'str', type: 'racial', formula: '9'.repeat(400) },
    { target: 'damage', type: 'untyped', formula: '9007199254740993 + 1' },
  ];
  await writeFile(file, stringify(human));
  const result = await importCatalog({
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  });
  const entry = result.catalog.entries.find(
    (catalog) => catalog.name === 'Human',
  );
  expect(entry?.modifiers).toEqual([]);
  expect(
    entry?.unsupported.filter((issue) => issue.field === 'changes'),
  ).toHaveLength(4);
});

it('uses the sheet grammar bounds when admitting catalog formulas', async () => {
  // #251 §8: importer and calculation admit one closed, bounded language.
  const root = await copyFixtures();
  const { parse, stringify } = await import('yaml');
  const file = join(root, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
  const human = parse(await readFile(file, 'utf8'));
  const longArithmetic = '1+'.repeat(100) + '1';
  const excessiveNesting = '('.repeat(65) + '1' + ')'.repeat(65);
  human.system.changes = [
    { target: 'damage', type: 'untyped', formula: longArithmetic },
    { target: 'damage', type: 'untyped', formula: excessiveNesting },
    { target: 'damage', type: 'untyped', formula: '0'.repeat(4097) },
    { target: 'damage', type: 'untyped', formula: '@resources.rage' },
    { target: 'damage', type: 'untyped', formula: '@item.level' },
  ];
  await writeFile(file, stringify(human));
  const result = await importCatalog({
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  });
  const entry = result.catalog.entries.find(
    (catalog) => catalog.name === 'Human',
  );
  expect(entry?.modifiers).toEqual([
    {
      target: 'damage',
      bonusType: 'untyped',
      value: { formula: longArithmetic },
    },
  ]);
  expect(
    entry?.unsupported.filter((issue) => issue.field === 'changes'),
  ).toHaveLength(4);
});
