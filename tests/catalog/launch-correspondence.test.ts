// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { launchManifestCopies } from './launch-manifest';
import { inspectLaunchInventory } from '../../scripts/catalog/launch-inventory';

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
const prefix = 'rule/pcgen/roleplaying_game/advanced_players_guide/';

it.each(['pf1-content/f3r6wtifa8bXlcJG', 'pf1/7ZiUSYUV1zRqgkrf'])(
  'rejects omission of the existing required output %s',
  (key) => {
    const manifest = freshManifest();
    expect(manifest.rows.find((row) => row.key === key)?.requirement).toBe(
      'required',
    );
    manifest.rows = manifest.rows.filter((row) => row.key !== key);
    expect(
      inspectLaunchInventory(manifest).inventoryErrors.some(
        (finding) => finding.code === 'core-required' && finding.key === key,
      ),
    ).toBe(true);
  },
);

it('preserves separate Inquisitor and Cleric Aura contracts without granting domain spells or a Druid Toil choice', () => {
  const manifest = freshManifest();
  for (const [line, root, context] of [
    [1805, 'pf1/Fv3FbmXptuDRiL5y', 'inquisitor-domain'],
    [1875, 'pf1/SjFqQceVeVBzBwgn', 'cleric-domain'],
  ] as const) {
    const contract = manifest.semanticContracts.find(
      ({ id }) => id === `${prefix}apg_abilities_class.lst:${line}`,
    );
    expect(contract).toMatchObject({
      root,
      from: 'pf1/6rqIMKpnCiimDyLo',
      identity: { kind: 'catalog', key: 'pf1/7ZiUSYUV1zRqgkrf' },
      acquisitionLevels: [8],
      castingContexts: [context],
    });
    expect(contract?.replacement).toMatchObject({
      entries: ['pf1/9ezUAbso44HrKLyr'],
    });
    expect(contract?.parameters).toContainEqual({
      name: 'retained power',
      values: ['pf1/zeLaBkwTp9wlzZJv'],
    });
    expect(contract?.excludedContexts).toContain('druid-nature-bond-domain');
    expect(
      contract?.sources.some(({ locator }) =>
        locator.includes(line === 1805 ? ':468' : ':3796'),
      ),
    ).toBe(true);
  }
  expect(
    manifest.rows.filter(({ key }) => key === 'pf1/7ZiUSYUV1zRqgkrf'),
  ).toHaveLength(1);
  expect(
    manifest.rows.find(({ key }) => key === 'pf1/7ZiUSYUV1zRqgkrf')?.admission
      .state,
  ).toBe('unreviewed');
});

it('rejects lost Underfoot size requirements and Dodge/Mobility prerequisites', () => {
  const manifest = freshManifest();
  const contract = manifest.semanticContracts.find(
    ({ id }) => id === `${prefix}apg_feats.lst:206`,
  );
  expect(contract?.targets).toEqual(
    expect.arrayContaining([
      'pf1-content/f3r6wtifa8bXlcJG',
      'pf1/JreaiTHdyWFNj3Tb',
      'pf1/R7L4SlGRlnThqFrP',
    ]),
  );
  expect(contract?.nativeRequirements).toContain('PRESIZELTEQ:S');
  if (!contract) throw new Error('Missing Underfoot.');
  contract.nativeRequirements = contract.nativeRequirements.filter(
    (entry) => entry !== 'PRESIZELTEQ:S',
  );
  manifest.edges = manifest.edges.filter(
    ({ from, to }) => from !== contract.id || to !== 'pf1/R7L4SlGRlnThqFrP',
  );
  const errors = inspectLaunchInventory(manifest).inventoryErrors;
  expect(errors.some(({ code }) => code === 'core-contract')).toBe(true);
  expect(errors.some(({ code }) => code === 'core-semantic-edge')).toBe(true);
});

it.each(['pf1-content/f3r6wtifa8bXlcJG', 'pf1/7ZiUSYUV1zRqgkrf'])(
  'rejects a wrong native owner and stale body binding for %s',
  (key) => {
    const manifest = freshManifest();
    const row = manifest.rows.find((entry) => entry.key === key);
    if (!row?.sources[0])
      throw new Error('Missing native correspondence output.');
    row.publicTestOwner.issue = 768;
    row.sources[0].rawSha256 = 'f'.repeat(64);
    const errors = inspectLaunchInventory(manifest).inventoryErrors;
    expect(
      errors.some(
        (finding) => finding.code === 'core-owner' && finding.key === key,
      ),
    ).toBe(true);
    expect(
      errors.some(
        (finding) => finding.code === 'core-source' && finding.key === key,
      ),
    ).toBe(true);
  },
);

it.each([1805, 1875])(
  'rejects loss of Aura source %s, its aspects and replacement contract',
  (line) => {
    const manifest = freshManifest();
    const contract = manifest.semanticContracts.find(
      ({ id }) => id === `${prefix}apg_abilities_class.lst:${line}`,
    );
    if (!contract) throw new Error('Missing Aura source.');
    contract.sources = contract.sources.filter(
      ({ locator }) => !locator.endsWith(`:${line}`),
    );
    contract.replacement = null;
    contract.contract = 'Aura of Repitition';
    expect(
      inspectLaunchInventory(manifest).inventoryErrors.some(
        ({ code, key }) => code === 'core-contract' && key === contract.id,
      ),
    ).toBe(true);
  },
);
