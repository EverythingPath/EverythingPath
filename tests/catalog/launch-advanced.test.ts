// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { launchManifestCopies } from './launch-manifest';
import {
  inspectLaunchInventory,
  launchInventoryHash,
} from '../../scripts/catalog/launch-inventory';

const document: unknown = JSON.parse(
  await readFile(
    new URL(
      '../../scripts/catalog/scopes/campaign-mvp-v1.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const freshManifest = launchManifestCopies(document);

it.each(['pf1/tU2oGF0EOkgJl5fj', 'pf1/j1fzO9UphypgM5L4'])(
  'rejects omission of the printed Oracle choice %s with its path and owner',
  (key) => {
    const manifest = freshManifest();
    expect(
      manifest.rows.some(
        (row) => row.key === key && row.requirement === 'required',
      ),
    ).toBe(true);
    manifest.rows = manifest.rows.filter((row) => row.key !== key);
    const findings = inspectLaunchInventory(manifest).inventoryErrors.filter(
      (finding) => finding.key === key,
    );
    expect(findings.some(({ code }) => code === 'advanced-required')).toBe(
      true,
    );
    expect(
      findings.some(({ paths }) =>
        paths.some(({ keys }) => keys.includes('pf1/5S0u8yFcP861wgd1')),
      ),
    ).toBe(true);
    expect(findings.every(({ owner }) => (owner?.issue ?? 0) > 0)).toBe(true);
  },
);

it('retains all 200 printed Bloodrager list memberships and rejects removal of Frigid Touch after pool recommitment', () => {
  const manifest = freshManifest();
  const root = 'pf1/E27lMw9YNOAjS009';
  const list = manifest.semanticContracts.filter(
    (entry) => entry.root === root && entry.channel === 'printed spell list',
  );
  expect(list).toHaveLength(200);
  const frigid = list.find(({ name }) =>
    name.toLowerCase().includes('frigid touch'),
  );
  expect(frigid?.parameters).toContainEqual({
    name: 'spell level',
    values: ['2'],
  });
  if (!frigid) throw new Error('Missing Frigid Touch.');
  const pool = manifest.pools.find(
    ({ root: key, name }) =>
      key === root && name === 'Printed printed spell list',
  );
  if (!pool) throw new Error('Missing exact printed Bloodrager list.');
  pool.members = pool.members.filter((key) => !frigid.targets.includes(key));
  pool.membersSha256 = launchInventoryHash(pool.members);
  manifest.semanticContracts = manifest.semanticContracts.filter(
    ({ id }) => id !== frigid.id,
  );
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code, key }) => code === 'advanced-contract' && key === frigid.id,
    ),
  ).toBe(true);
});

it('keeps patron acquisition levels distinct from ordinary known-spell allowances', () => {
  const manifest = freshManifest();
  const grants = manifest.semanticContracts.filter(
    ({ channel }) => channel === 'patron additional spell',
  );
  expect(grants).toHaveLength(109);
  const grant = grants.find(
    ({ acquisitionLevels }) => acquisitionLevels[0] === 12,
  );
  expect(grant?.spellAccess).toMatchObject({
    destination: 'known',
    consumesKnownAllowance: false,
    exchangeable: false,
  });
  if (!grant) throw new Error('Missing sixth patron grant.');
  grant.acquisitionLevels = [];
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code, key }) => code === 'advanced-contract' && key === grant.id,
    ),
  ).toBe(true);
});

it('represents Qinggong Power Attack as its source-bound temporary feat with its own cost and waiver', () => {
  const manifest = freshManifest();
  const power = manifest.semanticContracts.find(
    ({ name, channel }) =>
      name === 'Power Attack' && channel.startsWith('qinggong:'),
  );
  expect(power?.identity).toMatchObject({
    kind: 'source-choice',
    parent: 'pf1/sRkGFqJGumBoP8pD',
    nativeDefinition: 'Ki Power ~ Power Attack',
  });
  expect(power?.conditionalEffect).toMatchObject({
    kind: 'temporary feat',
    kiCost: 1,
    activation: 'free',
    duration: 'until next turn',
    permanent: false,
  });
  expect(power?.prerequisitePolicy).toBe('waived in channel');
  if (!power?.conditionalEffect) throw new Error('Missing Qinggong wrapper.');
  power.conditionalEffect.duration = 'source ability';
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code, key }) => code === 'advanced-contract' && key === power.id,
    ),
  ).toBe(true);
});

it('rejects deletion of the Inferno Bomb Smoke Bomb prerequisite despite unchanged option pools', () => {
  const manifest = freshManifest();
  const dependency = manifest.semanticContracts.find(
    ({ from, kind, targets }) =>
      from === 'pf1/VtiYY27yIG8ctrE8' &&
      kind === 'prerequisite' &&
      targets.includes('pf1/pT7c2VLJk8Pq4YgK'),
  );
  expect(dependency).toBeDefined();
  if (!dependency) throw new Error('Missing Smoke Bomb prerequisite.');
  manifest.edges = manifest.edges.filter(
    ({ from, to }) =>
      !(from === dependency.id && to === 'pf1/pT7c2VLJk8Pq4YgK'),
  );
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code }) => code === 'advanced-semantic-edge',
    ),
  ).toBe(true);
});

it('uses exactly 24 regular exploits and preserves the five Blade Adept identities as remainders', () => {
  const manifest = freshManifest();
  const pool = manifest.pools.find(
    ({ name }) => name === 'eligible ordinary ACG arcanist exploits',
  );
  expect(pool?.members).toHaveLength(24);
  expect(pool?.members).not.toContain('pf1-content/6hf1C8HofXth3ilP');
  expect(
    manifest.batches.some(({ originalInventory }) =>
      originalInventory.includes('pf1-content/6hf1C8HofXth3ilP'),
    ),
  ).toBe(true);
});

it('distinguishes zero-cost immediate Qinggong feats from source-unspecified original Monk ability costs', () => {
  const manifest = freshManifest();
  const powers = manifest.semanticContracts.filter(
    ({ conditionalEffect }) => conditionalEffect !== undefined,
  );
  expect(powers).toHaveLength(78);
  for (const name of ['Deny Death', 'Ki Stand'])
    expect(
      powers.find((entry) => entry.name === name)?.conditionalEffect,
    ).toMatchObject({
      kiCost: 0,
      activation: 'immediate',
      duration: 'until next turn',
    });
  for (const name of ['diamond body', 'diamond soul', 'perfect self'])
    expect(
      powers.find((entry) => entry.name.toLowerCase() === name)
        ?.conditionalEffect,
    ).toMatchObject({ kind: 'monk ability', kiCost: null });
});

it('requires Distance through the Exploiter Arcane Weapon path and its ranged-only governing definition', () => {
  const manifest = freshManifest();
  const key = 'pf1-content/w7DE5kpg0K1OZKL5';
  const entry = manifest.semanticContracts.find(
    ({ from, targets, channel }) =>
      from === 'pf1/8LTtHB6wiIh5tB6J' &&
      channel === 'Exploiter Arcane Weapon property choices' &&
      targets.includes(key),
  );
  expect(entry).toBeDefined();
  manifest.rows = manifest.rows.filter((row) => row.key !== key);
  const findings = inspectLaunchInventory(manifest).inventoryErrors.filter(
    (finding) => finding.key === key,
  );
  expect(findings.some(({ code }) => code === 'advanced-required')).toBe(true);
  expect(
    findings.some(({ paths }) =>
      paths.some(({ keys }) =>
        keys.includes('everythingpath/wizard-exploiter-wizard'),
      ),
    ),
  ).toBe(true);
});

it('rejects reintroducing a Blade Adept exploit after recomputing its local pool commitment', () => {
  const manifest = freshManifest();
  const pool = manifest.pools.find(
    ({ name }) => name === 'eligible ordinary ACG arcanist exploits',
  );
  if (!pool) throw new Error('Missing Exploiter pool.');
  pool.members.push('pf1-content/6hf1C8HofXth3ilP');
  pool.membersSha256 = launchInventoryHash(pool.members);
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code }) => code === 'pool-authority',
    ),
  ).toBe(true);
});

it('retains the ACG Thrown Weapon extension separately with all eight conditional tier members', () => {
  const manifest = freshManifest();
  const members = manifest.semanticContracts.filter(
    ({ root, channel }) =>
      root === 'pf1/cOY76lMUkupH534m' &&
      channel === 'ACG Thrown Weapon extension',
  );
  expect(members).toHaveLength(8);
  expect(
    members.filter(({ minimumClassLevel }) => minimumClassLevel === 2),
  ).toHaveLength(4);
  expect(
    members.filter(({ minimumClassLevel }) => minimumClassLevel === 6),
  ).toHaveLength(2);
  expect(
    members.filter(({ minimumClassLevel }) => minimumClassLevel === 10),
  ).toHaveLength(2);
  expect(
    members.every(({ qualification }) => qualification === 'held discrepancy'),
  ).toBe(true);
});

it.each([
  'pf1/NCJajMqriTEmVaMT',
  'pf1/YQgJJcgq11g7TBWP',
  'pf1/h2HnbWEh7rlY0JcF',
])('rejects loss of a shared incoming familiar context %s', (from) => {
  const manifest = freshManifest();
  const contract = manifest.semanticContracts.find(
    (entry) =>
      entry.from === from &&
      entry.channel === 'class-side cross-worker interface',
  );
  if (!contract) throw new Error('Missing class-side familiar context.');
  manifest.edges = manifest.edges.filter(
    (edge) => !(edge.from === contract.root && edge.to === from),
  );
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code }) => code === 'advanced-semantic-edge',
    ),
  ).toBe(true);
});

it('distinguishes selected orders and bloodlines from their automatic level-gated powers', () => {
  const manifest = freshManifest();
  const orderPowers = manifest.semanticContracts.filter(({ channel }) =>
    channel.startsWith('order ability:'),
  );
  const bloodlinePowers = manifest.semanticContracts.filter(({ channel }) =>
    channel.startsWith('bloodline power:'),
  );
  expect(orderPowers).toHaveLength(18);
  expect(bloodlinePowers).toHaveLength(60);
  expect(
    orderPowers.every(
      ({ kind, acquisitionLevels }) =>
        kind === 'grant' &&
        acquisitionLevels.length === 1 &&
        [2, 8, 15].includes(acquisitionLevels[0] ?? 0),
    ),
  ).toBe(true);
  expect(
    bloodlinePowers.every(
      ({ kind, acquisitionLevels }) =>
        kind === 'grant' &&
        acquisitionLevels.length === 1 &&
        [1, 4, 8, 12, 16, 20].includes(acquisitionLevels[0] ?? 0),
    ),
  ).toBe(true);
  expect(
    manifest.semanticContracts.find(
      ({ channel, name }) => channel === 'mystery' && name === 'Heavens',
    )?.disposition,
  ).toBe('recorded choice');
});

it('keeps embedded judgments under the original Inquisitor Judgment body owner', () => {
  const manifest = freshManifest();
  const parent = manifest.rows.find(
    ({ key }) => key === 'pf1/qI4IouTn4uvDPSXv',
  );
  if (!parent) throw new Error('Missing Judgment parent.');
  const judgments = manifest.semanticContracts.filter(
    ({ channel }) => channel === 'judgment',
  );
  expect(judgments).toHaveLength(9);
  expect(
    judgments.every(
      ({ publicTestOwner }) =>
        publicTestOwner.issue === parent.inventoryOwner.issue,
    ),
  ).toBe(true);
  expect(
    judgments.every(({ identity }) => identity.kind === 'source-choice'),
  ).toBe(true);
});
