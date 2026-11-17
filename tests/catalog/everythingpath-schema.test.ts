// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hashText, parseCuration } from '../../scripts/catalog/curation';
import { parseCandidateKeys } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import {
  importedCatalogEntrySchema,
  reviewedRemapSchema,
} from '../../src/lib/catalog/imported-entry-schema';
import { readPinned } from './pinned-sources';

// #716 keys follow the seeds' rule identities (`ranger-beast-master`,
// `witch-seducer-fey-charm`, src/lib/catalog/representative-companion-rules.ts)
// under the `everythingpath/` prefix; plan §5.
const accepted = [
  'everythingpath/ranger-beast-master',
  'everythingpath/witch-seducer-fey-charm',
  'everythingpath/fighter-lore-warden',
  'everythingpath/arcane-trickster',
];
const rejected = [
  'everythingpath/',
  'everythingpath/Fighter-Lore-Warden',
  'everythingpath/fighter_lore_warden',
  'everythingpath/fighter--lore-warden',
  'everythingpath/-fighter-lore-warden',
  // Never a source path, locator or URL (#716 acceptance: "Pinned sources").
  'everythingpath/campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst',
  'pcgen:campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst#Fighter Archetype ~ Lore Warden',
  'https://paizo.com/pathfinderRPG/prd/advancedPlayersGuide/classes/fighter.html',
];

describe('everythingpath/ catalog keys', () => {
  it('selects #716 keys beside Foundry keys for a curation batch', () => {
    expect(
      parseCandidateKeys(['pf1/Q1cY8r0Pvb66pMG0', ...accepted]),
    ).toHaveLength(5);
  });

  it.each(rejected)('rejects %j as a candidate key', (key) => {
    expect(() => parseCandidateKeys([key])).toThrow();
  });

  it('records a reviewed remap between #716 identities', () => {
    const remap = {
      from: 'everythingpath/fighter-lore-warden',
      to: 'everythingpath/fighter-lore-warden-pfsfg',
      kind: 'archetype',
      reason: 'Pin bump changed the locator of the PFSFG Lore Warden.',
      evidence:
        'pcgen:campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst#Fighter Archetype ~ Lore Warden',
      reviewedBy: 'reviewer',
      reviewedOn: '2026-10-17',
    };
    expect(reviewedRemapSchema.parse(remap)).toEqual(remap);
    for (const key of rejected)
      expect(
        reviewedRemapSchema.safeParse({ ...remap, to: key }).success,
        key,
      ).toBe(false);
  });

  it('binds a Curation Overlay record to a #716 key', () => {
    const text =
      'Quick wits and deceptive techniques can often succeed where brute force might not.';
    const record = {
      externalKey: 'everythingpath/fighter-lore-warden',
      kind: 'description',
      target: 'description',
      text,
      textSha256: hashText(text),
      status: 'drafted',
      outputs: [],
      rationale: 'Drafted from the PCGen DESC; review pending.',
    };
    expect(parseCuration({ records: [record] }).records[0]?.externalKey).toBe(
      'everythingpath/fighter-lore-warden',
    );
    for (const key of rejected)
      expect(
        () => parseCuration({ records: [{ ...record, externalKey: key }] }),
        key,
      ).toThrow();
  });
});

// Lore Warden's Scholastic, Pathfinder Society Field Guide p.31 (PCGen
// campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst:258).
const scholasticLocator = {
  file: 'campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst',
  line: 258,
  key: 'Lore Warden ~ Scholastic',
};
async function pinnedLine({ file, line }: { file: string; line: number }) {
  const text = await readPinned('pcgen', `${pcgenPin.directory}/${file}`);
  return text.split(/\r?\n/)[line - 1]!.split('\t').filter(Boolean);
}
const tag = (tokens: string[], name: string) =>
  tokens.find((token) => token.startsWith(`${name}:`))?.slice(name.length + 1);

async function scholasticEntry() {
  const tokens = await pinnedLine(scholasticLocator);
  const pcgen = { source: 'pcgen', locator: scholasticLocator } as const;
  return {
    externalKey: 'everythingpath/fighter-lore-warden-scholastic',
    upstreamKey: `pcgen:${scholasticLocator.file}#${scholasticLocator.key}`,
    pack: 'campaign_setting/pathfinder_society_field_guide',
    name: tokens[0]!,
    detail: { kind: 'classFeature' },
    description: tag(tokens, 'DESC')!,
    sources: [
      {
        book: 'Pathfinder Society Field Guide',
        pages: tag(tokens, 'SOURCEPAGE')!.replace(/^p\./, ''),
      },
    ],
    modifiers: [],
    unsupported: [],
    provenance: { name: pcgen, description: pcgen, sources: pcgen },
  };
}

describe('field provenance', () => {
  it('records the PCGen locator of each imported field', async () => {
    const entry = await scholasticEntry();
    expect(tag(await pinnedLine(scholasticLocator), 'KEY')).toBe(
      'Lore Warden ~ Scholastic',
    );
    expect(entry.name).toBe('Scholastic');
    expect(entry.sources).toEqual([
      { book: 'Pathfinder Society Field Guide', pages: '31' },
    ]);
    expect(importedCatalogEntrySchema.parse(entry).provenance).toEqual(
      entry.provenance,
    );
  });

  it('records a PRD gap fill and a Curation Overlay field', async () => {
    const entry = {
      ...(await scholasticEntry()),
      provenance: {
        name: { source: 'pcgen', locator: scholasticLocator },
        description: {
          source: 'prd',
          locator: {
            path: 'pathfinderSocietyFieldGuide/fighter.html',
            id: 'scholastic',
          },
        },
        modifiers: {
          source: 'overlay',
          locator: {
            externalKey: 'everythingpath/fighter-lore-warden-scholastic',
            kind: 'note',
            target: 'skillRanks',
          },
        },
      },
    };
    expect(importedCatalogEntrySchema.parse(entry).provenance).toEqual(
      entry.provenance,
    );
  });

  it('keeps Foundry entries valid without provenance', async () => {
    const { provenance: _, ...entry } = await scholasticEntry();
    expect(
      importedCatalogEntrySchema.safeParse({
        ...entry,
        externalKey: 'pf1/Q1cY8r0Pvb66pMG0',
        upstreamKey: 'pf1/Q1cY8r0Pvb66pMG0',
      }).success,
    ).toBe(true);
  });

  it('names fields by their path in the entry', async () => {
    const entry = await scholasticEntry();
    const pcgen = entry.provenance.name;
    expect(
      importedCatalogEntrySchema.safeParse({
        ...entry,
        provenance: { 'detail.parentFeature': pcgen },
      }).success,
    ).toBe(true);
    for (const field of ['', '$name', '_id', 'detail..part', 'Lore Warden'])
      expect(
        importedCatalogEntrySchema.safeParse({
          ...entry,
          provenance: { [field]: pcgen },
        }).success,
        field,
      ).toBe(false);
  });

  it.each([
    ['an unknown source', { source: 'aon', locator: scholasticLocator }],
    [
      'a PCGen line 0',
      { source: 'pcgen', locator: { ...scholasticLocator, line: 0 } },
    ],
    [
      'an absolute PCGen path',
      {
        source: 'pcgen',
        locator: { ...scholasticLocator, file: `/${scholasticLocator.file}` },
      },
    ],
    [
      'a PCGen path leaving the data',
      {
        source: 'pcgen',
        locator: { ...scholasticLocator, file: '../pcgen/core.lst' },
      },
    ],
    [
      'a PCGen file that is not a list file',
      {
        source: 'pcgen',
        locator: {
          ...scholasticLocator,
          file: 'campaign_setting/pathfinder_society_field_guide/OGL.txt',
        },
      },
    ],
    [
      'a PCGen locator without a KEY',
      { source: 'pcgen', locator: { ...scholasticLocator, key: '' } },
    ],
    [
      'a PRD URL instead of a path',
      {
        source: 'prd',
        locator: {
          path: 'https://paizo.com/pathfinderRPG/prd/openGameLicense.html',
          id: 'x',
        },
      },
    ],
    [
      'an overlay record without a target',
      {
        source: 'overlay',
        locator: {
          externalKey: 'everythingpath/fighter-lore-warden',
          kind: 'note',
        },
      },
    ],
  ])('rejects %s', async (_, provenance) => {
    const entry = {
      ...(await scholasticEntry()),
      provenance: { name: provenance },
    };
    expect(importedCatalogEntrySchema.safeParse(entry).success).toBe(false);
  });
});
