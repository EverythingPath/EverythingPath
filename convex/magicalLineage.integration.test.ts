// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  releaseFixture,
  prepare,
  reconcile,
  activationArgs,
} from '../tests/catalog-release-fixture';
import { magicalLineage } from '../e2e/fixtures/magical-lineage';
import { buildCharacterSheetSelectionsView } from '../src/components/character-sheet/character-sheet-selections-view-model';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { representativeSpellCatalog } from './lib/representativeSpellCatalog';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const f = await releaseFixture(modules);
  await f.t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const member = f.t.withIdentity({ tokenIdentifier: 'test|member' });
  const catalogEntryId = await f.t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...magicalLineage,
      scope: 'global',
    }),
  );
  const scope = { ...f.scope, campaignId: f.campaignId };
  const read = async () => {
    const sheet = withSheetCatalog(
      await f.owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  };
  return { ...f, member, scope, catalogEntryId, read };
}

test.each(['normal', 'dormant', 'kept'] as const)(
  '%s public Magical Lineage notes-only edits preserve another member’s spell change and clear',
  async (path) => {
    const { owner, member, scope, catalogEntryId, read } = await fixture();
    let slotId = 'trait:general';
    let sourceId: Id<'characterSheetEntry'> | undefined;
    if (path !== 'normal') {
      const additional = (await read()).catalogEntries.find(
        (entry) => entry.ruleIdentity === 'additional-traits',
      )!;
      sourceId = await owner.mutation(api.characterSheet.fillSelectionSlot, {
        ...scope,
        slotId: 'feat:general',
        position: 0,
        catalogEntryId: additional._id,
        operationId: 'additional-traits',
      });
      slotId = (await read()).calculated.selectionRules.slots.find(
        (slot) =>
          slot.kind === 'trait' &&
          slot.grantedBy?.kind === 'entry' &&
          slot.grantedBy.entryId === sourceId,
      )!.id;
    }
    const entryId = await owner.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId,
      position: 0,
      catalogEntryId,
      choice: 'Magic Missile',
      operationId: 'initial-choice',
    });
    if (sourceId) {
      await owner.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId: sourceId,
        active: false,
        operationId: 'source-off',
      });
      if (path === 'kept') {
        await member.mutation(api.characterSheet.setDormantEntryKept, {
          ...scope,
          target: { entryId },
          kept: true,
          operationId: 'keep-lineage',
        });
      }
      expect((await read()).calculated.resolvedEntries).toContainEqual(
        expect.objectContaining({
          storedEntryId: entryId,
          dormant: true,
          counting: path === 'kept',
        }),
      );
    }
    for (const [index, choice] of ['Fireball', null].entries()) {
      await member.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId,
        choice,
        operationId: `other-member-${index}`,
      });
      await owner.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId,
        notes: `Spell notes ${index}`,
        operationId: `notes-only-${index}`,
      });
      for (const session of [owner, member]) {
        const sheet = await session.query(api.characterSheet.read, scope);
        expect(
          sheet?.entries.find((entry) => entry._id === entryId),
        ).toMatchObject({
          state: { kind: 'trait', choice },
          notes: `Spell notes ${index}`,
        });
      }
    }
  },
);

test('two public API identities retain Magical Lineage through past-level edits, dormancy, restoration and clearing without changing casting', async () => {
  const { t, owner, member, outsider, scope, catalogEntryId, read } =
    await fixture();
  const initial = await read();
  const level = initial.entries.find((entry) => entry.kind === 'classLevel')!;
  const wizard = initial.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'wizard',
  )!;
  const additional = initial.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'additional-traits',
  )!;
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { intelligence: 18 },
    operationId: 'intelligence',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  // Real imported Haste (wizard level 3) stays level 3 even when named here.
  const haste = representativeSpellCatalog.find(
    (spell) => spell.name === 'Haste',
  )!;
  const [spellId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      spells: [haste],
      operationId: 'fixture-haste',
    },
  );
  if (!spellId) throw new Error('Missing Haste');
  const spellEntryId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: spellId,
    operationId: 'record-haste',
  });
  expect(
    (await read()).entries.find((entry) => entry._id === spellEntryId),
  ).toMatchObject({ state: { kind: 'spell', level: 3 } });
  const baseline = (await read()).calculated.spellcastings;
  expect(baseline).toHaveLength(1);
  expect(baseline[0]?.castableSpellLevels).toEqual([0, 1]);
  expect(
    baseline[0]?.slots.find((slot) => slot.spellLevel === 1),
  ).toMatchObject({ base: 1, bonus: 1, total: 2, dc: { total: 15 } });
  // APG Additional Traits supplies real trait slots that disappear when it is off.
  const sourceId = await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: additional._id,
    operationId: 'additional-traits',
  });
  const slot = (await read()).calculated.selectionRules.slots.find(
    (slot) =>
      slot.kind === 'trait' &&
      slot.grantedBy?.kind === 'entry' &&
      slot.grantedBy.entryId === sourceId,
  )!;
  expect(slot).toBeDefined();
  const entryId = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: slot.id,
    position: 0,
    catalogEntryId,
    choice: 'Haste',
    gainedAtClassLevel: level._id,
    operationId: 'choose-spell',
  });
  expect((await read()).calculated.spellcastings).toEqual(baseline);
  expect(
    (await read()).entries.find((entry) => entry._id === spellEntryId),
  ).toMatchObject({ state: { kind: 'spell', level: 3 } });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: wizard._id,
    operationId: 'next-level',
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    choice: 'Burning Hands',
    operationId: 'change-spell',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    hpGained: 7,
    operationId: 'past-level',
  });
  const beforeOff = await read();
  expect(
    beforeOff.entries.find((entry) => entry._id === entryId),
  ).toMatchObject({
    state: { choice: 'Burning Hands' },
    gainedAtClassLevel: level._id,
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: sourceId,
    active: false,
    operationId: 'source-off',
  });
  const dormant = await read();
  expect(dormant.calculated.resolvedEntries).toContainEqual(
    expect.objectContaining({
      storedEntryId: entryId,
      dormant: true,
      counting: false,
      entry: expect.objectContaining({
        state: { kind: 'trait', choice: 'Burning Hands' },
      }),
    }),
  );
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: sourceId,
    active: true,
    operationId: 'restore-source',
  });
  const restored = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  )!;
  expect(restored.calculated.resolvedEntries).toContainEqual(
    expect.objectContaining({
      storedEntryId: entryId,
      dormant: false,
      counting: true,
    }),
  );
  expect(
    buildCharacterSheetSelectionsView(restored).rows.find(
      (row) => row.entryId === entryId,
    ),
  ).toMatchObject({
    choice: 'Burning Hands',
    choiceLabel: 'Chosen spell',
    choiceIncomplete: false,
  });
  expect(restored.calculated.spellcastings).toEqual(
    beforeOff.calculated.spellcastings,
  );
  const beforeClear = restored.calculated.spellcastings;
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    choice: null,
    operationId: 'clear-spell',
  });
  const reloaded = await read();
  expect(
    buildCharacterSheetSelectionsView(reloaded).rows.find(
      (row) => row.entryId === entryId,
    ),
  ).toMatchObject({ choice: null, choiceIncomplete: true });
  expect(reloaded.calculated.spellcastings).toEqual(beforeClear);
  expect(
    reloaded.entries.find((entry) => entry._id === spellEntryId),
  ).toMatchObject({ state: { kind: 'spell', level: 3 } });
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
  await expect(
    outsider.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId,
      choice: 'Fireball',
      operationId: 'unauthorized',
    }),
  ).rejects.toThrow();
  const otherCampaign = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Other table',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
    }),
  );
  await expect(
    member.mutation(api.characterSheet.editSelection, {
      ...scope,
      campaignId: otherCampaign,
      entryId,
      choice: 'Fireball',
      operationId: 'wrong-campaign',
    }),
  ).rejects.toThrow();
  expect(
    (await read()).entries.find((entry) => entry._id === entryId),
  ).toMatchObject({ state: { choice: null } });
});

test('ordinary fixture content publication preserves the chosen spell and its public presentation across both API identities', async () => {
  const { t, owner, member, scope, catalogEntryId, read } = await fixture();
  const entryId = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId,
    choice: 'Magic Missile',
    operationId: 'before-publication',
  });
  const before = (await read()).calculated.spellcastings;
  await prepare(t, [
    {
      kind: 'definition',
      key: magicalLineage.ruleIdentity,
      payload: {
        externalKey: magicalLineage.ruleIdentity,
        upstreamKey: magicalLineage.ruleIdentity,
        pack: 'pf-traits',
        name: 'Family spell',
        detail: magicalLineage.detail,
        description: magicalLineage.description,
        sources: [],
        modifiers: [],
        unsupported: [],
      },
    },
  ]);
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  for (const session of [owner, member]) {
    const sheet = withSheetCatalog(
      await session.query(api.characterSheet.read, scope),
    )!;
    expect(sheet.entries.find((entry) => entry._id === entryId)).toMatchObject({
      state: { kind: 'trait', choice: 'Magic Missile' },
    });
    expect(
      buildCharacterSheetSelectionsView(sheet).rows.find(
        (row) => row.entryId === entryId,
      ),
    ).toMatchObject({
      name: 'Family spell',
      choice: 'Magic Missile',
      description: magicalLineage.description,
      choiceLabel: 'Chosen spell',
      choiceIncomplete: false,
    });
    expect(sheet.calculated.spellcastings).toEqual(before);
  }
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    choice: 'Burning Hands',
    operationId: 'after-publication',
  });
  expect(
    (await read()).entries.find((entry) => entry._id === entryId),
  ).toMatchObject({ state: { choice: 'Burning Hands' } });
});
