// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import { findReviewedClassCasting } from '../src/lib/character-sheet-casting-tables';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

// The granted-levels mechanism family's public proof
// (`scripts/catalog/launch-mechanism-proofs.ts`, `spell-granted-levels`): an
// imported class feature's `spellcasting` names its Granted Spells by spell
// key, and a Catalog Release resolves each key to its Spell Catalog Entry.
// The bodies are a synthetic fixture shaped as imported Spells and class
// features: a slot-style domain granting one Spell at each level 1 to 9 (the
// 1st-level one also on the cleric list), and a schedule-style sorcerer
// bloodline granting one at each level N from sorcerer 2N + 1 (CRB pp. 38,
// 72; PRD #251 D10), and an Inquisitor's Domain, whose chosen domain gives
// its powers only (APG p. 38), so it carries `optionGrantsSpells: false`.
// Every read and write the test makes is public.
const domainKey = 'pf1/grantedProofDomain';
const inquisitorDomainKey = 'pf1/grantedProofInquisitorDomain';
const bloodlineKey = 'pf1/grantedProofBloodline';
const spellLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const domainSpell = (level: number) => `pf1/grantedProofDomainSpell${level}`;
const bloodlineSpell = (level: number) =>
  `pf1/grantedProofBloodlineSpell${level}`;

type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
};
function body({ externalKey, name, pack, detail }: Body) {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack,
    name,
    detail,
    description: `${name}.`,
    sources: [{ book: 'PZO1110', pages: '1' }],
    modifiers: [],
    unsupported: [],
  };
}
const spell = ({
  externalKey,
  name,
  levels,
  grantedLevels = {},
}: {
  externalKey: string;
  name: string;
  levels: Record<string, number>;
  grantedLevels?: Record<string, Record<string, number>>;
}) =>
  body({
    externalKey,
    name,
    pack: 'spells',
    detail: {
      kind: 'spell',
      levels,
      grantedLevels,
      school: 'evo',
      subschools: [],
      descriptors: [],
    },
  });
const feature = (
  externalKey: string,
  name: string,
  spellcasting: Record<string, unknown>,
) =>
  body({
    externalKey,
    name,
    pack: 'class-abilities',
    detail: { kind: 'classFeature', spellcasting },
  });

const domainSpells = spellLevels.map((level) =>
  spell({
    externalKey: domainSpell(level),
    name: `Proof Domain Spell ${level}`,
    // Only the 1st-level Spell is on the cleric list, so the others fill
    // only the domain slot.
    levels: level === 1 ? { cleric: 1, wizard: 1 } : { wizard: level },
    grantedLevels: { domain: { Proof: level } },
  }),
);
const bloodlineSpells = spellLevels.map((level) =>
  spell({
    externalKey: bloodlineSpell(level),
    name: `Proof Bloodline Spell ${level}`,
    levels: { wizard: level },
    grantedLevels: { bloodline: { Proof: level } },
  }),
);
const domainSpellcasting = (spellKey: (level: number) => string) => ({
  optionKind: 'domain',
  extraSlot: 'domain',
  grantedSpells: {
    style: 'slot',
    spells: spellLevels.map((spellLevel) => ({
      spellLevel,
      spellKey: spellKey(spellLevel),
    })),
  },
});
const domain = feature(
  domainKey,
  'Proof Domain',
  domainSpellcasting(domainSpell),
);
const bloodline = feature(bloodlineKey, 'Proof Bloodline', {
  optionKind: 'bloodline',
  grantedSpells: {
    style: 'schedule',
    schedule: spellLevels.map((spellLevel) => ({
      spellLevel,
      classLevel: 2 * spellLevel + 1,
    })),
    spells: spellLevels.map((spellLevel) => ({
      spellLevel,
      spellKey: bloodlineSpell(spellLevel),
    })),
  },
});
// The Inquisitor's 1st-level Domain prompt: the flag withholds the chosen
// domain's Spells and slot. Removing the flag is this proof's RED.
const inquisitorChooser = feature(
  inquisitorDomainKey,
  'Proof Inquisitor Domain',
  { chooses: 'domain', optionGrantsSpells: false },
);
const inquisitorDetail: Record<string, unknown> = {
  ...inquisitorChooser.detail,
  picksByLevel: [{ classLevel: 1, list: 'Domain', count: 1 }],
};
const inquisitorDomain = { ...inquisitorChooser, detail: inquisitorDetail };
const bodies = [
  ...domainSpells,
  ...bloodlineSpells,
  domain,
  bloodline,
  inquisitorDomain,
];

/** A stored identity stub of the body's kind, for the release to replace. */
function stub({ name, externalKey, detail }: (typeof bodies)[number]) {
  const identity = {
    scope: 'global' as const,
    name,
    ruleIdentity: externalKey,
    modifiers: [],
    sources: [],
    stacksWithItself: false,
  };
  return detail.kind === 'spell'
    ? { ...identity, detail: { kind: 'spell' as const } }
    : { ...identity, detail: { kind: 'classFeature' as const } };
}

type Viewer = Awaited<ReturnType<typeof releaseFixture>>['owner'];
/** One public saved-sheet read with its catalog. */
async function readSheet(
  viewer: Viewer,
  scope: { organizationId: string; characterId: Id<'character'> },
) {
  const sheet = withSheetCatalog(
    await viewer.query(api.characterSheet.read, scope),
  );
  if (!sheet) throw new Error('Missing saved sheet');
  return sheet;
}
type Sheet = Awaited<ReturnType<typeof readSheet>>;

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion (as `characterSheetModifiers.integration.test.ts` installs
 * them), and an Inquisitor class: a spontaneous divine caster whose Domain
 * gives powers but no domain Spells or slot (APG p. 38).
 */
async function fixture() {
  const { t, owner, outsider, scope, create } = await releaseFixture(modules);
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const ids = new Map<string, Id<'catalogEntry'>>();
  const id = (key: string) => {
    const found = ids.get(key);
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  await t.run(async (ctx) => {
    for (const entry of bodies)
      ids.set(
        entry.externalKey,
        await ctx.db.insert('catalogEntry', stub(entry)),
      );
    const inquisitor = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Inquisitor',
      ruleIdentity: 'pf1/grantedProofInquisitor',
      modifiers: [],
      sources: [{ book: 'PZO1115', pages: '38' }],
      stacksWithItself: false,
      detail: {
        kind: 'class',
        casting: findReviewedClassCasting('inquisitor'),
        classKind: 'base',
        hitDie: 8,
        bab: 'threeQuarters',
        saves: { fort: 'good', ref: 'poor', will: 'good' },
        skillRanksPerLevel: 6,
        classSkills: [],
        featuresByLevel: [
          { classLevel: 1, catalogEntryId: id(inquisitorDomainKey) },
        ],
        picksByLevel: [],
      },
    });
    ids.set('inquisitor', inquisitor);
  });
  await prepare(
    t,
    bodies.map((entry) => ({
      kind: 'definition',
      key: entry.externalKey,
      payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(entry))),
    })),
  );
  await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    for (const { externalKey } of bodies) {
      const stored = await ctx.db.get('catalogEntry', id(externalKey));
      if (!stored) throw new Error('Missing stored identity');
      const { _id, _creationTime, ...definition } = await candidateDefinition(
        ctx,
        release,
        stored,
      );
      await ctx.db.replace('catalogEntry', _id, definition);
    }
  });
  /** A Character with a first Class Level of the class, and its sheet. */
  async function character(name: string, classEntry: (sheet: Sheet) => string) {
    const characterId =
      name === 'Vessa' ? scope.characterId : await create(name);
    const own = { organizationId: 'org', characterId };
    const read = (viewer: Viewer = member) => readSheet(viewer, own);
    const initial = await read(owner);
    const level = initial.entries.find((entry) => entry.kind === 'classLevel');
    if (!level) throw new Error('Missing first Class Level');
    const classEntryId = classEntry(initial) as Id<'catalogEntry'>;
    await member.mutation(api.characterSheet.editClassLevel, {
      ...own,
      entryId: level._id,
      classEntryId,
      operationId: 'first-level',
    });
    let count = 1;
    const addLevel = () =>
      member.mutation(api.characterSheet.addClassLevel, {
        ...own,
        classEntryId,
        operationId: `level-${(count += 1)}`,
      });
    /** The Grant Key of the Character's class feature of this rule identity. */
    async function grantKeyOf(ruleIdentity: string) {
      const sheet = await read();
      const definition = sheet.catalogEntries.find(
        (row) => row.ruleIdentity === ruleIdentity,
      );
      const row = sheet.calculated.resolvedEntries.find(
        ({ entry }) =>
          'catalogEntryId' in entry && entry.catalogEntryId === definition?._id,
      );
      if (!row || !('grantKey' in row.entry) || !row.entry.grantKey)
        throw new Error(`Missing ${ruleIdentity} Grant`);
      return row.entry.grantKey;
    }
    return {
      scope: own,
      read,
      addLevel,
      grantKeyOf,
      firstLevel: level._id,
      classEntryId,
    };
  }
  const classNamed = (name: string) => (sheet: Sheet) => {
    const found = sheet.catalogEntries.find(
      (entry) => entry.detail.kind === 'class' && entry.name === name,
    );
    if (!found) throw new Error(`Missing ${name}`);
    return found._id;
  };
  return { t, owner, member, outsider, id, character, classNamed };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
type Spellcasting = Sheet['calculated']['spellcastings'][number];

function casting(sheet: Sheet, classEntryId: string) {
  const found = sheet.calculated.spellcastings.find(
    (row) => row.classEntryId === classEntryId,
  );
  if (!found) throw new Error('Missing Spellcasting');
  return found;
}
/** The castable spell levels of 1st and up, from the per-level slots. */
const castableLevels = (row: Spellcasting) =>
  row.slots
    .map((slot) => slot.spellLevel)
    .filter((level) => level > 0)
    .sort((left, right) => left - right);
const grantedLevels = (row: Spellcasting) =>
  row.grantedSpells.map((granted) => granted.spellLevel);

test('a released domain grants its Spell and the domain slot at each castable level, tags the Spells off the class list as domain slot only, and grants neither through a Domain whose text grants powers only', async () => {
  const loaded = await fixture();
  const { id, character, classNamed, outsider } = loaded;
  // The release resolved each spell key to its Spell Catalog Entry.
  const stored = await loaded.t.run((ctx) =>
    ctx.db.get('catalogEntry', id(domainKey)),
  );
  expect(stored?.detail).toEqual({
    kind: 'classFeature',
    spellcasting: {
      optionKind: 'domain',
      extraSlot: 'domain',
      grantedSpells: {
        style: 'slot',
        spells: spellLevels.map((spellLevel) => ({
          spellLevel,
          catalogEntryId: id(domainSpell(spellLevel)),
        })),
      },
    },
  });

  // A Cleric chooses the domain through the Domains prompt.
  const cleric = await character('Vessa', classNamed('Cleric'));
  const domains = await cleric.grantKeyOf('cleric-domains');
  await loaded.member.mutation(api.characterSheet.selectEntry, {
    ...cleric.scope,
    catalogEntryId: id(domainKey),
    selectionSource: {
      kind: 'prompt',
      source: { kind: 'grant', grantKey: domains },
      list: 'Domains',
      classLevel: 1,
    },
    operationId: 'proof-domain',
  });
  for (let level = 1; level <= 17; level += 1) {
    if (level > 1) await cleric.addLevel();
    const row = casting(await cleric.read(), cleric.classEntryId);
    const castable = castableLevels(row);
    // Cleric N casts spell level ⌈N / 2⌉; the domain follows every one.
    expect(castable).toEqual(spellLevels.slice(0, Math.ceil(level / 2)));
    expect(grantedLevels(row)).toEqual(castable);
    expect(row.extraSlots).toEqual([{ kind: 'domain', label: '+1 domain' }]);
    // One domain slot at each castable level of 1st and up.
    expect(row.slots.map((slot) => [slot.spellLevel, slot.extra])).toEqual(
      row.slots.map((slot) => [slot.spellLevel, slot.spellLevel ? 1 : 0]),
    );
  }
  const full = casting(await cleric.read(loaded.owner), cleric.classEntryId);
  expect(
    full.grantedSpells.map((granted) => ({
      catalogEntryId: granted.catalogEntryId,
      spellLevel: granted.spellLevel,
      style: granted.style,
      optionKind: granted.optionKind,
      domainSlotOnly: granted.domainSlotOnly,
      sources: granted.sources.map((source) => source.name),
    })),
  ).toEqual(
    spellLevels.map((spellLevel) => ({
      catalogEntryId: id(domainSpell(spellLevel)),
      spellLevel,
      style: 'slot',
      optionKind: 'domain',
      // The 1st-level Spell is on the cleric list; the rest fill only the
      // domain slot.
      domainSlotOnly: spellLevel !== 1,
      sources: ['Proof Domain'],
    })),
  );

  // The same domain chosen through an Inquisitor's Domain, whose text grants
  // powers only, gives no Spells or slot.
  const inquisitor = await character('Ilsa', () => id('inquisitor'));
  await loaded.member.mutation(api.characterSheet.selectEntry, {
    ...inquisitor.scope,
    catalogEntryId: id(domainKey),
    selectionSource: {
      kind: 'prompt',
      source: {
        kind: 'grant',
        grantKey: await inquisitor.grantKeyOf(inquisitorDomainKey),
      },
      list: 'Domain',
      classLevel: 1,
    },
    operationId: 'inquisitor-domain',
  });
  for (let level = 2; level <= 7; level += 1) await inquisitor.addLevel();
  const inquisitorCasting = casting(
    await inquisitor.read(),
    inquisitor.classEntryId,
  );
  expect(castableLevels(inquisitorCasting)).toEqual([1, 2, 3]);
  expect(inquisitorCasting.grantedSpells).toEqual([]);
  expect(inquisitorCasting.extraSlots).toEqual([]);
  expect(inquisitorCasting.slots.map((slot) => slot.extra)).toEqual(
    inquisitorCasting.slots.map(() => 0),
  );
  await expect(
    outsider.query(api.characterSheet.read, cleric.scope),
  ).rejects.toThrow('You do not have access to this org');
});

test('a released sorcerer bloodline grants spell level N at sorcerer 2N + 1, never at 2N', async () => {
  const { id, character, classNamed, member }: Fixture = await fixture();
  const sorcerer = await character('Vessa', classNamed('Sorcerer'));
  const bloodlines = await sorcerer.grantKeyOf('sorcerer-bloodline');
  await member.mutation(api.characterSheet.selectEntry, {
    ...sorcerer.scope,
    catalogEntryId: id(bloodlineKey),
    selectionSource: {
      kind: 'prompt',
      source: { kind: 'grant', grantKey: bloodlines },
      list: 'Bloodlines',
      classLevel: 1,
    },
    operationId: 'proof-bloodline',
  });
  for (let level = 1; level <= 19; level += 1) {
    if (level > 1) await sorcerer.addLevel();
    const row = casting(await sorcerer.read(), sorcerer.classEntryId);
    // Absent at 2N (when the sorcerer first casts level N), present at 2N + 1.
    expect(grantedLevels(row)).toEqual(
      spellLevels.filter((spellLevel) => 2 * spellLevel + 1 <= level),
    );
    expect(row.extraSlots).toEqual([]);
  }
  const full = casting(await sorcerer.read(), sorcerer.classEntryId);
  expect(
    full.grantedSpells.map((granted) => [
      granted.catalogEntryId,
      granted.style,
      granted.optionKind,
      granted.domainSlotOnly,
    ]),
  ).toEqual(
    spellLevels.map((spellLevel) => [
      id(bloodlineSpell(spellLevel)),
      'schedule',
      'bloodline',
      false,
    ]),
  );
});

for (const invalid of ['missing', 'duplicate', 'wrongKind'] as const)
  test(`a released Granted Spell refuses a ${invalid} spell key`, async () => {
    const { t } = await releaseFixture(modules);
    const target = 'pf1/grantedProofTarget';
    const refused = feature(
      'pf1/grantedProofRefused',
      'Refused Domain',
      domainSpellcasting(() => target),
    );
    const featureId = await t.run(async (ctx) => {
      if (invalid === 'duplicate')
        for (let copy = 0; copy < 2; copy += 1)
          await ctx.db.insert(
            'catalogEntry',
            stub(
              spell({
                externalKey: target,
                name: 'Target',
                levels: { wizard: 1 },
              }),
            ),
          );
      if (invalid === 'wrongKind')
        await ctx.db.insert('catalogEntry', {
          scope: 'global',
          name: 'Target',
          ruleIdentity: target,
          modifiers: [],
          sources: [],
          stacksWithItself: false,
          detail: { kind: 'manual' },
        });
      return ctx.db.insert('catalogEntry', stub(refused));
    });
    await prepare(t, [
      {
        kind: 'definition',
        key: refused.externalKey,
        payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(refused))),
      },
    ]);
    const expected = {
      missing: `Candidate reference ${target} is unavailable for ${refused.externalKey}`,
      duplicate: `Duplicate global ruleIdentity ${target}`,
      wrongKind: `Candidate Granted Spell ${target} is not a Spell`,
    };
    await expect(
      t.run(async (ctx) => {
        const release = await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
          .unique();
        const stored = await ctx.db.get('catalogEntry', featureId);
        if (!release || !stored) throw new Error('Missing release');
        return candidateDefinition(ctx, release, stored);
      }),
    ).rejects.toMatchObject({ data: expected[invalid] });
  });
