/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { extractCatalogDescriptionText } from '../../src/lib/catalog/description-text';
import { spellFixture } from '../fixtures/spells-532/sheet';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');

test.each([
  {
    className: 'Wizard',
    spells: [
      ['Enlarge Person', 1],
      ['Read Magic', 0],
      ['Form of the Dragon I', 6],
    ],
  },
] as const)(
  'an isolated $className collection roundtrips real held Spell metadata through public writers',
  async ({ className, spells }) => {
    for (const [name] of spells) {
      expect(
        reviewedAdmission.assessments.find(
          (row) => row.externalKey === spellFixture(name).externalKey,
        )?.status,
      ).toBe('unresolved');
    }
    const t = convexTest(schema, modules);
    const campaignId = await t.run(async (ctx) => {
      for (const [name, orgId] of [
        ['owner', 'org'],
        ['member', 'org'],
        ['outsider', 'other'],
      ] as const) {
        await ctx.db.insert('user', {
          tokenIdentifier: `spell532|${name}`,
          orgIds: [{ orgId, role: 'member' }],
          characterSheetDemo: true,
        });
      }
      return ctx.db.insert('campaign', {
        name: 'Isolated held Spells #532',
        description: '',
        organizationId: 'org',
        ownerId: 'spell532|owner',
        e2eFixture: {
          namespace: 'spells-532',
          version: 1,
          workerKey: '0',
          caseKey: className,
          campaignKey: className,
        },
      });
    });
    const owner = t.withIdentity({ tokenIdentifier: 'spell532|owner' });
    const member = t.withIdentity({ tokenIdentifier: 'spell532|member' });
    const outsider = t.withIdentity({ tokenIdentifier: 'spell532|outsider' });
    const characterId = await owner.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name: 'Source-backed Spell collection preview',
      kind: 'pc',
      operationId: 'create-spells-532',
    });
    const scope = { organizationId: 'org', campaignId, characterId };
    const initial = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
    const castingClass = initial?.catalogEntries.find(
      (entry) => entry.name === className && entry.detail.kind === 'class',
    );
    if (!level) throw new Error('Missing initial class level');
    if (!castingClass) throw new Error('Missing Wizard baseline');
    const castingClassId = castingClass._id;
    await member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: level._id,
      classEntryId: castingClassId,
      operationId: 'class-baseline',
    });
    await member.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores: { strength: 10, intelligence: 14, wisdom: 14, charisma: 14 },
      operationId: 'base-scores',
    });
    const baseline = await owner.query(api.characterSheet.read, scope);
    if (!baseline) throw new Error('Missing baseline calculation');
    const casting = baseline.calculated.spellcastings.find(
      (row) => row.classEntryId === castingClassId,
    );
    expect(casting).toMatchObject({
      classLevels: 1,
      casterLevel: { total: 1 },
      concentration: { total: 3 },
    });
    expect(casting?.slots.find((row) => row.spellLevel === 1)?.dc.total).toBe(
      13,
    );
    // The internal writer installs only into this convex-test Character catalog.
    // No shipping permission, running Spell Effect or Catalog Release is created.
    const spellIds = await owner.mutation(
      internal.characterSheetSpells.installPreparedCatalog,
      {
        ...scope,
        spells: spells.map(([name]) => spellFixture(name)),
        operationId: 'isolated-spell-catalog',
      },
    );
    const filters = { ...scope, castingClassId };
    const recordedIds: Id<'characterSheetEntry'>[] = [];
    for (const [index, [name, spellLevel]] of spells.entries()) {
      const catalogEntryId = spellIds[index];
      if (!catalogEntryId) throw new Error(`Missing installed Spell: ${name}`);
      const page = await member.query(api.characterSheetSpells.browse, {
        ...filters,
        spellLevel,
        paginationOpts: { cursor: null, numItems: 25 },
      });
      expect(page.page).toContainEqual(
        expect.objectContaining({
          catalogEntryId,
          name,
          spellLevel,
          school: spellFixture(name).detail.school,
        }),
      );
      const entryId = await member.mutation(api.characterSheetSpells.record, {
        ...filters,
        catalogEntryId,
        operationId: `record-${index}`,
      });
      recordedIds.push(entryId);
      const saved = withSheetCatalog(
        await owner.query(api.characterSheet.read, scope),
      );
      if (!saved) throw new Error('Missing isolated saved sheet');
      expect(
        saved.entries.find((entry) => entry._id === entryId),
      ).toMatchObject({
        kind: 'spell',
        state: {
          kind: 'spell',
          castingClassId,
          level: spellLevel,
        },
      });
      const fixture = spellFixture(name);
      expect(
        saved.catalogEntries.find((entry) => entry._id === catalogEntryId),
      ).toMatchObject({
        scope: 'character',
        characterId,
        ruleIdentity: fixture.externalKey,
        sources: fixture.sources,
        modifiers: [],
        detail: {
          kind: 'spell',
          levels: fixture.detail.levels,
          school: fixture.detail.school,
        },
      });
      const collection = saved.calculated.spellCollections.collections.find(
        (row) => row.classEntryId === castingClassId,
      );
      expect(collection).toMatchObject({
        heading: 'Spellbook',
      });
      expect(collection?.spells).toContainEqual({
        entryId,
        catalogEntryId,
        ruleIdentity: fixture.externalKey,
        name,
        classEntryId: castingClassId,
        castingClassName: className,
        school: fixture.detail.school,
        description: extractCatalogDescriptionText({
          html: fixture.description,
        }),
        spellLevel,
        explicitLevel: spellLevel,
        offList: false,
        twoSlots: false,
      });
      if (spellLevel > 1) {
        expect(saved.calculated.warnings).toContainEqual(
          expect.objectContaining({
            kind: 'rules',
            check: 'spellLevel',
            subject: entryId,
            message: `${className} cannot cast level ${spellLevel} spells yet.`,
          }),
        );
      } else {
        expect(saved.calculated.warnings).not.toContainEqual(
          expect.objectContaining({ check: 'spellLevel', subject: entryId }),
        );
      }
      expect(saved.calculated.abilities).toEqual(baseline.calculated.abilities);
      expect(saved.calculated.derivedStatistics).toEqual(
        baseline.calculated.derivedStatistics,
      );
      expect(saved.permanentCalculated.abilities).toEqual(
        baseline.permanentCalculated.abilities,
      );
      expect(saved.permanentCalculated.derivedStatistics).toEqual(
        baseline.permanentCalculated.derivedStatistics,
      );
      expect(saved.permanentCalculated.proficiencies).toEqual(
        baseline.permanentCalculated.proficiencies,
      );
      expect(saved.calculated.proficiencies).toEqual(
        baseline.calculated.proficiencies,
      );
      expect(saved.calculated.spellcastings).toEqual(
        baseline.calculated.spellcastings,
      );
      expect(saved.calculated.spellEffects).toEqual(
        baseline.calculated.spellEffects,
      );
      const client = calculateCharacterSheetPreview(saved);
      expect(client.abilities).toEqual(saved.calculated.abilities);
      expect(client.derivedStatistics).toEqual(
        saved.calculated.derivedStatistics,
      );
      expect(client.spellCollections).toEqual(
        saved.calculated.spellCollections,
      );
      expect(client.spellEffects).toEqual(saved.calculated.spellEffects);
      expect(client.spellcastings).toEqual(saved.calculated.spellcastings);
      expect(saved.calculated.abilities.strength.score).toBe(10);
      expect(saved.calculated.abilities.intelligence.score).toBe(14);
      expect(saved.calculated.abilities.wisdom.score).toBe(14);
      expect(
        (await member.query(api.characterSheet.read, scope))?.calculated
          .abilities,
      ).toEqual(saved.calculated.abilities);
    }
    const otherCampaignId = await t.run((ctx) =>
      ctx.db.insert('campaign', {
        name: 'Other campaign',
        description: '',
        organizationId: 'org',
        ownerId: 'spell532|owner',
      }),
    );
    await expect(
      member.query(api.characterSheet.read, {
        ...scope,
        campaignId: otherCampaignId,
      }),
    ).rejects.toThrow();
    await expect(
      member.query(api.characterSheetSpells.browse, {
        ...filters,
        campaignId: otherCampaignId,
        paginationOpts: { cursor: null, numItems: 25 },
      }),
    ).rejects.toThrow();
    await expect(
      outsider.query(api.characterSheet.read, scope),
    ).rejects.toThrow();
    await expect(
      outsider.query(api.characterSheetSpells.browse, {
        ...filters,
        paginationOpts: { cursor: null, numItems: 25 },
      }),
    ).rejects.toThrow();
    const firstEntryId = recordedIds[0];
    const firstSpellId = spellIds[0];
    if (!firstEntryId || !firstSpellId)
      throw new Error('Missing recorded Spell');
    await expect(t.query(api.characterSheet.read, scope)).rejects.toThrow();
    await expect(
      t.mutation(api.characterSheetSpells.record, {
        ...filters,
        catalogEntryId: firstSpellId,
        operationId: 'unauthenticated-record-refused',
      }),
    ).rejects.toThrow();

    const secondCharacterId = await member.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name: 'Separate Character catalog',
      kind: 'pc',
      operationId: 'create-separate-spell-catalog',
    });
    const secondScope = { ...scope, characterId: secondCharacterId };
    const secondSheet = withSheetCatalog(
      await member.query(api.characterSheet.read, secondScope),
    );
    const secondLevel = secondSheet?.entries.find(
      (entry) => entry.kind === 'classLevel',
    );
    const secondCastingClass = secondSheet?.catalogEntries.find(
      (entry) => entry.name === className && entry.detail.kind === 'class',
    );
    if (!secondLevel) throw new Error('Missing second Character class level');
    if (!secondCastingClass) throw new Error('Missing second Wizard baseline');
    await member.mutation(api.characterSheet.editClassLevel, {
      ...secondScope,
      entryId: secondLevel._id,
      classEntryId: secondCastingClass._id,
      operationId: 'second-character-wizard',
    });
    const secondBrowser = await member.query(api.characterSheetSpells.browse, {
      ...filters,
      characterId: secondCharacterId,
      castingClassId: secondCastingClass._id,
      spellLevel: 2,
      paginationOpts: { cursor: null, numItems: 25 },
    });
    expect(secondBrowser.page.map((row) => row.catalogEntryId)).not.toContain(
      firstSpellId,
    );
    await expect(
      member.mutation(api.characterSheetSpells.record, {
        ...filters,
        characterId: secondCharacterId,
        castingClassId: secondCastingClass._id,
        catalogEntryId: firstSpellId,
        operationId: 'another-character-spell-refused',
      }),
    ).rejects.toThrow();
    await expect(
      member.mutation(api.characterSheetSpells.record, {
        ...filters,
        campaignId: otherCampaignId,
        catalogEntryId: firstSpellId,
        operationId: 'wrong-campaign-record-refused',
      }),
    ).rejects.toThrow();
    await expect(
      outsider.mutation(api.characterSheetSpells.record, {
        ...filters,
        catalogEntryId: firstSpellId,
        operationId: 'outsider-record-refused',
      }),
    ).rejects.toThrow();
    await expect(
      outsider.mutation(api.characterSheetSpells.remove, {
        ...scope,
        entryId: firstEntryId,
        operationId: 'outsider-remove-refused',
      }),
    ).rejects.toThrow();
    expect(
      (await owner.query(api.characterSheet.read, scope))?.entries.some(
        (entry) => entry._id === firstEntryId,
      ),
    ).toBe(true);
    await member.mutation(api.characterSheetSpells.remove, {
      ...scope,
      entryId: firstEntryId,
      operationId: 'member-removes-spell',
    });
    const removed = await owner.query(api.characterSheet.read, scope);
    expect(removed?.entries.some((entry) => entry._id === firstEntryId)).toBe(
      false,
    );
    expect(removed?.entries.some((entry) => entry._id === recordedIds[1])).toBe(
      true,
    );
  },
);
