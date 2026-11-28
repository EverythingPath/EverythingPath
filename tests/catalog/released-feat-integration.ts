/// <reference types="vite/client" />
// pbl-released-feats-2 (PRD #251): the shared setup of the released feat
// integration files (released-feats-330.integration.test.ts and
// released-feats-339.integration.test.ts), moved here from the first one:
// `setUp` builds the fresh Convex test database, campaigns and Character a
// row runs on, with the steps and refusals rows share; `toggle`, `replace`
// and `replaceFeat` change the selection; `localOn` and `localAt` find a local
// Situation on an inserted definition; `pinnedFieldsCheck` builds a file's
// `expectPinned` over its own table of pinned literals.
import { convexTest } from 'convex-test';
import { expect } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import type { FeatBatch } from './released-feat-keys';
import type { FeatDefinition } from './released-feat-sheet';

const modules = import.meta.glob('../../convex/**/*.ts');

/**
 * A file's `expectPinned(name, definition)` over its table of pinned
 * literals, by feat name: the definition's rule-bearing fields (Modifiers,
 * Situational Notes, prerequisites, slot grants and the Additional Traits
 * flag) equal its pins; one it has and its pins lack (a Note, a prerequisite
 * list) fails as well.
 */
export function pinnedFieldsCheck<Pins extends Record<string, object>>(
  pinnedFields: Pins,
) {
  return function expectPinned(
    name: keyof Pins & string,
    definition: FeatDefinition,
  ) {
    expect(
      {
        modifiers: definition.modifiers,
        situationalNotes: definition.situationalNotes,
        prerequisites: definition.prerequisites,
        grantsSlots: definition.grantsSlots,
        additionalTraits: definition.detail.additionalTraits,
      },
      name,
    ).toEqual(pinnedFields[name]);
  };
}

/** A local Situation of a definition's first Modifier on the target. */
export function localOn(definition: FeatDefinition, target: string) {
  const situation = definition.modifiers.find((row) => row.target === target)
    ?.condition?.situation;
  if (typeof situation !== 'object' || !('local' in situation))
    throw new Error(`Missing local ${target} Situation`);
  return situation;
}

/**
 * A local Situation of a definition's Modifier at the index (the first by
 * default), whatever its target.
 */
export function localAt(definition: FeatDefinition, index = 0) {
  const situation = definition.modifiers[index]?.condition?.situation;
  if (typeof situation !== 'object' || !('local' in situation))
    throw new Error(`Missing local Situation of Modifier ${index}`);
  return situation;
}

/**
 * A fresh Convex test database with an owner and a member of one
 * organization and an outsider of another, an isolated campaign of the
 * batch with one Character, and another campaign of the organization; the
 * batch tests each built this. `insert` installs a definition on the
 * Character only; `fighterLevel` makes its Class Level a Fighter's with 10
 * hit points.
 */
export async function setUp(batch: FeatBatch) {
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `${batch}|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: `Isolated ${batch}`,
      description: '',
      organizationId: 'org',
      ownerId: `${batch}|owner`,
      e2eFixture: {
        namespace: batch,
        version: 1,
        workerKey: '0',
        caseKey: 'released',
        campaignKey: 'released',
      },
    });
    const wrongCampaignId = await ctx.db.insert('campaign', {
      name: 'Other isolated campaign',
      description: '',
      organizationId: 'org',
      ownerId: `${batch}|owner`,
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: `${batch}|owner` });
  const member = t.withIdentity({ tokenIdentifier: `${batch}|member` });
  const outsider = t.withIdentity({ tokenIdentifier: `${batch}|outsider` });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: `Released ${batch} fixture`,
    kind: 'pc',
    operationId: `create-${batch}`,
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const insert = (definition: FeatDefinition) =>
    t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      }),
    );
  async function fighterLevel() {
    const initial = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const level = initial?.entries.find((row) => row.kind === 'classLevel');
    const fighter = initial?.catalogEntries.find(
      (row) => row.detail?.kind === 'class' && row.name === 'Fighter',
    );
    if (!level || !fighter) throw new Error('Missing baseline Fighter');
    await member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: level._id,
      classEntryId: fighter._id,
      hpGained: 10,
      operationId: 'fighter-baseline',
    });
  }
  /**
   * The selection cannot be read or edited through the other campaign or by
   * an outsider, its catalog copies cannot be listed there or by an outsider,
   * and an anonymous caller cannot read the sheet.
   */
  async function expectRefusals(
    entryId: Awaited<ReturnType<typeof select>>,
    active: boolean,
  ) {
    const noAccess = 'You do not have access to this org';
    await expect(
      member.query(api.characterSheet.read, {
        ...scope,
        campaignId: wrongCampaignId,
      }),
    ).rejects.toThrow('Character not found');
    await expect(
      member.query(api.catalogCopies.list, {
        ...scope,
        campaignId: wrongCampaignId,
      }),
    ).rejects.toThrow('Character not found');
    await expect(
      member.mutation(api.characterSheet.editSelection, {
        ...scope,
        campaignId: wrongCampaignId,
        entryId,
        active,
        operationId: 'wrong-campaign-refused',
      }),
    ).rejects.toThrow('Character not found');
    await expect(t.query(api.characterSheet.read, scope)).rejects.toThrow(
      noAccess,
    );
    await expect(
      outsider.query(api.characterSheet.read, scope),
    ).rejects.toThrow(noAccess);
    await expect(outsider.query(api.catalogCopies.list, scope)).rejects.toThrow(
      noAccess,
    );
    await expect(
      outsider.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId,
        active,
        operationId: 'outsider-refused',
      }),
    ).rejects.toThrow(noAccess);
  }
  const select = (catalogEntryId: Awaited<ReturnType<typeof insert>>) =>
    member.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId,
      operationId: 'select-feat',
    });
  /** The saved sheet as the identity reads it (the owner by default). */
  async function readSaved(identity: typeof owner = owner) {
    const sheet = await identity.query(api.characterSheet.read, scope);
    if (!sheet) throw new Error('Missing saved sheet');
    return sheet;
  }
  async function readClient() {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing saved sheet');
    return sheet;
  }
  /**
   * pbl-released-feats-2: the further refusals the feats339 and feats342 to
   * feats347 tests made. A campaign-scoped copy of the definition in the
   * other campaign cannot replace the selection's feat, and an anonymous
   * caller can neither list the catalog copies nor edit the selection.
   */
  async function expectForeignAndAnonymousRefusals(
    entryId: Awaited<ReturnType<typeof select>>,
    definition: FeatDefinition,
  ) {
    const foreignId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: wrongCampaignId,
        ...definition,
        stacksWithItself: false,
      }),
    );
    await expect(
      member.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId,
        catalogEntryId: foreignId,
        active: true,
        operationId: 'foreign-definition-refused',
      }),
    ).rejects.toThrow('Catalog Entry does not belong to this Character');
    await expect(t.query(api.catalogCopies.list, scope)).rejects.toThrow(
      'You do not have access to this org',
    );
    await expect(
      t.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId,
        active: true,
        operationId: 'anonymous-refused',
      }),
    ).rejects.toThrow('You do not have access to this org');
  }
  return {
    t,
    owner,
    member,
    scope,
    insert,
    fighterLevel,
    select,
    readSaved,
    readClient,
    expectRefusals,
    expectForeignAndAnonymousRefusals,
  };
}

export type Setup = Awaited<ReturnType<typeof setUp>>;

export type FeatRow = {
  batch: FeatBatch;
  /** What the row's batch test checked, as its title. */
  title: string;
  /** The row's own steps and assertions, after the shared setup. */
  check(setup: Setup): Promise<void>;
};

/** The one-feat rows' shared steps: switch the selection off, then on. */
export async function toggle(
  { member, scope }: Setup,
  entryId: Awaited<ReturnType<Setup['select']>>,
  active: boolean,
) {
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    active,
    operationId: active ? 'restore-feat' : 'switch-off-feat',
  });
}

/** The two-feat rows' shared step: replace the selection's feat, active. */
export async function replace(
  setup: Setup,
  entryId: Awaited<ReturnType<Setup['select']>>,
  catalogEntryId: Awaited<ReturnType<Setup['insert']>>,
) {
  await replaceFeat(setup, entryId, { catalogEntryId, active: true });
}

/**
 * pbl-released-feats-2: replace the selection's feat with exactly the
 * changes given (the feat, and `active` only where the row's batch test sent
 * it); nothing else is added.
 */
export async function replaceFeat(
  { member, scope }: Setup,
  entryId: Awaited<ReturnType<Setup['select']>>,
  change: {
    catalogEntryId: Awaited<ReturnType<Setup['insert']>>;
    active?: boolean;
  },
) {
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    ...change,
    operationId: 'replace-feat',
  });
}
