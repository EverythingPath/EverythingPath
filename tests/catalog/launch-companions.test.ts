// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { launchManifestCopies } from './launch-manifest';
import {
  inspectLaunchInventory,
  launchInventoryHash,
  renderLaunchInventoryReport,
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

it('requires the three original APG forms and their Small variants without Unchained progression', () => {
  const manifest = freshManifest();
  const pool = manifest.pools.find(
    ({ name }) => name === 'original eidolon base forms and evolutions',
  );
  expect(pool?.members).not.toContain('pf1-content/B2McodEGU4IGjGqi');
  expect(
    manifest.rows
      .filter(
        ({ key, kind }) =>
          kind === 'eidolonForm' && pool?.members.includes(key),
      )
      .map(({ key }) => key)
      .sort(),
  ).toEqual([
    'pf1-content/1MtxTKRS4WoOq2YK',
    'pf1-content/2MtuHihJXq3zcdbW',
    'pf1-content/C1c1pIWUhbO0m54c',
    'pf1-content/OlW1rZtFebpvIRKO',
    'pf1-content/Thxu8cGB9fglytxD',
    'pf1-content/hbjII7pJ4ECZ2Z5k',
  ]);
});

it('accounts for every original companion key and detects a removed remainder', () => {
  const manifest = freshManifest();
  const entries = manifest.companionPartitions.flatMap(
    ({ entries }) => entries,
  );
  expect(entries).toHaveLength(538);
  expect(new Set(entries.map(({ key }) => key)).size).toBe(538);
  const originals = new Set(
    manifest.batches.flatMap(({ originalInventory }) => originalInventory),
  );
  expect(entries.every(({ key }) => originals.has(key))).toBe(true);
  const pool = manifest.pools.find(
    ({ name }) => name === 'familiar species inventory',
  );
  if (!pool) throw new Error('Missing familiar pool.');
  pool.remainder = pool.remainder.filter(
    ({ locator }) => locator !== 'pf1-content/IkhZvC7RO8qjpIXM',
  );
  expect(inspectLaunchInventory(manifest).inventoryErrors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'companion-remainder' }),
    ]),
  );
});

it('rejects removing a Small form even when the caller recomputes its pool checksum', () => {
  const manifest = freshManifest();
  const pool = manifest.pools.find(
    ({ name }) => name === 'original eidolon base forms and evolutions',
  );
  if (!pool) throw new Error('Missing original eidolon pool.');
  pool.members = pool.members.filter(
    (key) => key !== 'pf1-content/OlW1rZtFebpvIRKO',
  );
  pool.membersSha256 = launchInventoryHash(pool.members);
  manifest.rows = manifest.rows.filter(
    ({ key }) => key !== 'pf1-content/OlW1rZtFebpvIRKO',
  );
  expect(inspectLaunchInventory(manifest).inventoryErrors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'pool-authority' }),
      expect.objectContaining({
        code: 'companion-mechanism',
        key: 'pf1-content/OlW1rZtFebpvIRKO',
      }),
    ]),
  );
});

it('detects deleting the unlinked Swallow Whole prerequisite and free Biped limbs', () => {
  const manifest = freshManifest();
  manifest.edges = manifest.edges.filter(
    ({ from, to, kind }) =>
      !(
        (from === 'pf1-content/K7aAiH88SR9NJI5h' &&
          to === 'pf1-content/vzn9K3Nbmlhf3Rl4' &&
          kind === 'prerequisite') ||
        (from === 'pf1-content/OlW1rZtFebpvIRKO' &&
          to === 'pf1-content/8tW8LjPoCSbMliA1' &&
          kind === 'grant')
      ),
  );
  const report = inspectLaunchInventory(manifest);
  expect(report.inventoryErrors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'companion-semantic-edge',
        key: 'pf1-content/vzn9K3Nbmlhf3Rl4',
      }),
      expect.objectContaining({
        code: 'companion-semantic-edge',
        key: 'pf1-content/8tW8LjPoCSbMliA1',
      }),
    ]),
  );
});

it('retains familiar incoming roots and reports an omitted construction feat with its original owner', () => {
  const manifest = freshManifest();
  manifest.rows = manifest.rows.filter(
    ({ key }) => key !== 'pf1/DMSYzt5jD9vk0DGy',
  );
  const report = inspectLaunchInventory(manifest);
  const missing = report.launchFailures.find(
    ({ code, key }) =>
      code === 'dependency-missing' && key === 'pf1/DMSYzt5jD9vk0DGy',
  );
  expect(missing?.owner?.issue).toBeGreaterThan(0);
  for (const name of [
    'Wizard',
    'Witch',
    'Sorcerer',
    'Magus',
    'Exploiter Wizard',
  ]) {
    const root = manifest.roots.find((root) => root.name === name);
    expect(
      missing?.paths.some(
        ({ keys }) =>
          keys[0] === root?.key &&
          keys.includes('pf1-content/5Sp99yWEydCCieRi'),
      ),
    ).toBe(true);
  }
});

it('preserves source-only choices, governing notices and explicit source discrepancies', () => {
  const manifest = freshManifest();
  const fox = manifest.rows.find(
    ({ key }) => key === 'pf1-content/A3iwocEZULdxK0n7',
  );
  if (!fox) throw new Error('Missing APG Fox candidate.');
  fox.holds = fox.holds.filter(
    ({ reason }) => !reason.startsWith('APG Fox is Young Dog'),
  );
  manifest.rows = manifest.rows.filter(
    ({ key }) =>
      !['rule/companions/apg-young-octopus', 'notice/PZO1112'].includes(key),
  );
  const report = inspectLaunchInventory(manifest);
  expect(report.inventoryErrors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'companion-source-hold', key: fox.key }),
      expect.objectContaining({
        code: 'companion-mechanism',
        key: 'rule/companions/apg-young-octopus',
      }),
      expect.objectContaining({
        code: 'dependency-missing',
        key: 'notice/PZO1112',
      }),
    ]),
  );
  expect(report.launchQualified).toBe(false);
});

it('keeps companion mechanics owned and refuses prose or stale source substitutions', () => {
  const manifest = freshManifest();
  const row = manifest.rows.find(
    ({ key }) => key === 'pf1-content/Y9TQUVRlnkdFJoHG',
  );
  if (!row) throw new Error('Missing Large evolution.');
  row.mechanisms = [
    {
      name: 'Large',
      disposition: 'permitted prose',
      status: 'permitted',
      contract: 'Manually record the size change.',
      evidence: ['Original APG Large evolution'],
    },
  ];
  row.sources = row.sources.filter(({ repository }) => repository !== 'prd');
  row.publicTestOwner.issue = 768;
  expect(inspectLaunchInventory(manifest).inventoryErrors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'companion-mechanism', key: row.key }),
      expect.objectContaining({ code: 'companion-source', key: row.key }),
      expect.objectContaining({ code: 'companion-owner', key: row.key }),
      expect.objectContaining({ code: 'prose-authority', key: row.key }),
    ]),
  );
});

const withoutResearch = () => {
  const manifest = freshManifest();
  manifest.research = [];
  manifest.pools = manifest.pools.map((pool) => ({ ...pool, research: [] }));
  return manifest;
};

it('keeps launch and party qualification pending after the source partitions and exact output correspondences are incorporated: inspection', () => {
  const manifest = withoutResearch();
  const report = inspectLaunchInventory(manifest);
  expect(report.inventoryErrors).toEqual([]);
  expect(
    report.inventoryErrors.filter(
      ({ code }) => code === 'core-playable-identity',
    ),
  ).toHaveLength(0);
  expect(
    report.inventoryErrors.some(({ code }) => code.startsWith('companion-')),
  ).toBe(false);
  expect(report.genericComplete).toBe(true);
  expect(report.launchQualified).toBe(false);
  expect(report.party.status).toBe('pending');
});

it('keeps launch and party qualification pending after the source partitions and exact output correspondences are incorporated: rendered report', () => {
  const manifest = withoutResearch();
  expect(renderLaunchInventoryReport(manifest)).toContain(
    'Companion eligibility partitions',
  );
});

it('preserves advanced companion incoming contracts and their actual downstream owners', () => {
  const manifest = freshManifest();
  expect(
    manifest.rows.find(({ key }) => key === 'pf1/NCJajMqriTEmVaMT')
      ?.implementationOwner.issue,
  ).toBe(772);
  expect(
    manifest.rows.find(({ key }) => key === 'pf1/3d9Rgw40NV8ohRtf')
      ?.implementationOwner.issue,
  ).toBe(771);
  const cavalier = manifest.rows.find(
    ({ key }) => key === 'rule/companions/cavalier-mount',
  );
  const oracle = manifest.rows.find(
    ({ key }) => key === 'rule/companions/oracle-mount',
  );
  expect(
    cavalier?.mechanisms.some(({ contract }) =>
      contract.includes('no Share Spells'),
    ),
  ).toBe(true);
  expect(
    oracle?.mechanisms.some(({ contract }) =>
      contract.includes('does not inherit Cavalier'),
    ),
  ).toBe(true);
  expect(
    manifest.rows.find(
      ({ key }) => key === 'rule/companions/exploiter-familiar-alternatives',
    )?.mechanisms[0]?.contract,
  ).toContain('does not stack');
  const ki = manifest.rows.find(({ key }) => key === 'pf1/H2LczaspdINB2MIt');
  expect(
    ki?.mechanisms.some(({ contract }) =>
      contract.includes('does not grant a species'),
    ),
  ).toBe(true);
  expect(
    manifest.edges
      .filter(({ from, kind }) => from === ki?.key && kind !== 'citation')
      .some(({ to }) =>
        manifest.rows.some(
          ({ key, kind }) =>
            key === to &&
            ['companion', 'familiar', 'eidolonForm'].includes(kind),
        ),
      ),
  ).toBe(false);
  expect(
    manifest.rows.find(
      ({ key }) => key === 'rule/companions/original-summoner-interface',
    )?.mechanisms[0]?.contract,
  ).toContain('Twin Eidolon');
});

it('rejects dropping a supporting downstream owner from the companion handoff', () => {
  const manifest = freshManifest();
  const coverage = manifest.coverage.find(({ contract }) =>
    contract.startsWith('#768 companion rule/companions/oracle-mount:'),
  );
  if (!coverage) throw new Error('Missing Oracle companion handoff.');
  expect(coverage.owners.map(({ issue }) => issue).sort()).toEqual([
    707, 763, 771,
  ]);
  coverage.owners = coverage.owners.filter(({ issue }) => issue !== 763);
  expect(inspectLaunchInventory(manifest).inventoryErrors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'companion-coverage',
        key: 'rule/companions/oracle-mount',
      }),
    ]),
  );
});

it('retains the later fixed-species Druid grant without making it a printed baseline domain choice: optional grant', () => {
  const manifest = freshManifest();
  const normal = manifest.pools.find(
    ({ name }) => name === 'familiar species inventory',
  );
  expect(normal?.members).not.toContain('pf1-content/VZVKypC7oF3GS3rp');
  expect(manifest.edges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        from: 'pf1-content/wELy6Lt4LABAHtlg',
        to: 'pf1-content/VZVKypC7oF3GS3rp',
        kind: 'grant',
      }),
    ]),
  );
  expect(
    manifest.edges.some(
      ({ from, to, kind }) =>
        from === 'pf1-content/wELy6Lt4LABAHtlg' &&
        to === 'rule/companions/familiar-choices' &&
        kind !== 'citation',
    ),
  ).toBe(false);
  const report = inspectLaunchInventory(manifest);
  expect(
    manifest.rows.find(({ key }) => key === 'pf1-content/wELy6Lt4LABAHtlg')
      ?.requirement,
  ).toBe('optional');
  expect(report.incoming['pf1-content/VZVKypC7oF3GS3rp'] ?? []).toEqual([]);
});

it('retains the later fixed-species Druid grant without making it a printed baseline domain choice: selected grant', () => {
  const manifest = freshManifest();
  // Selecting this source-specific grant creates the actual required path while
  // leaving ordinary CRB/APG domain and familiar choices unchanged.
  manifest.edges.push({
    from: 'pf1/7eZQP0MzeO2svmVF',
    to: 'pf1-content/wELy6Lt4LABAHtlg',
    kind: 'option',
    reason: 'Selected source-specific Druid familiar grant',
    condition: 'Optional later domain selected',
    evidence: ['src/pf-class-abilities/Familiar_wELy6Lt4LABAHtlg.yaml'],
  });
  manifest.rows = manifest.rows.filter(
    ({ key }) => key !== 'pf1-content/VZVKypC7oF3GS3rp',
  );
  const missing = inspectLaunchInventory(manifest).launchFailures.find(
    ({ code, key }) =>
      code === 'dependency-missing' && key === 'pf1-content/VZVKypC7oF3GS3rp',
  );
  expect(
    missing?.paths.some(({ keys }) =>
      keys.includes('pf1-content/wELy6Lt4LABAHtlg'),
    ),
  ).toBe(true);
});

it('preserves core companion incoming paths including Serpentfriend and conditional Leadership', () => {
  const manifest = freshManifest();
  expect(manifest.edges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        from: 'pf1/uvk4mwFGtss9mx6W',
        to: 'pf1-content/v0VaNqeX19Pa4oyr',
        kind: 'grant',
        condition: expect.stringContaining('Sorcerer-2'),
      }),
      expect.objectContaining({
        from: 'pf1/hd6MiVc69RyEuDpU',
        to: 'pf1/R3a1OV18RwDJftvq',
        kind: 'grant',
        condition: expect.stringContaining('8'),
      }),
    ]),
  );
  expect(
    manifest.rows.find(
      ({ key }) => key === 'rule/companions/nobility-leadership-interface',
    )?.mechanisms[0]?.contract,
  ).toContain('+2');
  manifest.rows = manifest.rows.filter(
    ({ key }) => key !== 'pf1-content/v0VaNqeX19Pa4oyr',
  );
  const report = inspectLaunchInventory(manifest);
  expect(
    report.launchFailures.some(
      ({ code, key, paths }) =>
        code === 'dependency-missing' &&
        key === 'pf1-content/v0VaNqeX19Pa4oyr' &&
        paths.some(({ keys }) => keys.includes('pf1/uvk4mwFGtss9mx6W')),
    ),
  ).toBe(true);
});

it('keeps core ordinary and domain companion levels and the Arcane master inputs distinct', () => {
  const manifest = freshManifest();
  const nature = manifest.rows.find(
    ({ key }) => key === 'pf1/wZ40bxNVn95BbLBV',
  );
  const domain = manifest.rows.find(
    ({ key }) => key === 'pf1/1jMb1iCiNjS5yfwe',
  );
  expect(
    nature?.mechanisms.some(
      ({ name, contract }) =>
        name === 'Core Nature Bond companion interface' &&
        contract.includes('24'),
    ),
  ).toBe(true);
  expect(
    domain?.mechanisms.some(
      ({ name, contract }) =>
        name === 'Core Animal domain companion interface' &&
        contract.includes('level-3'),
    ),
  ).toBe(true);
  expect(
    manifest.coverage.some(
      ({ contract, mechanisms }) =>
        contract.includes('Arcane familiar master interface') &&
        mechanisms.some((text) => text.includes('Wizard3')),
    ),
  ).toBe(true);
});

it('requires only companion-dependent creature types and preserves the full progression inventories', () => {
  const manifest = freshManifest();
  const pool = manifest.pools.find(
    ({ name }) => name === 'companion progression and creature types',
  );
  expect(pool?.members).not.toContain('pf1/WiROthmRgcwDncDM');
  expect(pool?.members).not.toContain('pf1/AbOSfjvKMqpNihdM');
  expect(pool?.members).toContain('pf1/H8FbMUps5Z0gQdvV');
  expect(pool?.members).toContain('pf1-content/FLDY1YB8IHw4G4gV');
  const partition = manifest.companionPartitions.find(
    ({ id }) => id === 'progression-and-types',
  );
  expect(partition?.entries).toHaveLength(35);
  expect(manifest.edges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        from: 'pf1-content/xrvwqb9Jg9wkfGiF',
        to: 'pf1/X2WLdbFFedaah6VC',
        kind: 'requirement',
      }),
    ]),
  );
});

it('keeps CRB animal stat aliases and Ranger dire rat without making later species Druid options', () => {
  const manifest = freshManifest();
  const pool = manifest.pools.find(
    ({ name }) => name === 'animal companion and mount species inventory',
  );
  expect(pool?.members).not.toContain('pf1-content/3lDv7SOQ7qlh6QYc');
  expect(pool?.members).toContain('pf1-content/Tlj7Lrd0R5ZpQfre');
  expect(pool?.members).toContain('pf1-content/mHKqdOJWIn6WNi9H');
  const partition = manifest.companionPartitions.find(
    ({ id }) => id === 'animal-companions',
  );
  expect(
    partition?.entries.find(
      ({ key }) => key === 'pf1-content/nBiMhJVaRzvUO1a5',
    ),
  ).toMatchObject({
    eligibility: 'conditional',
    condition: expect.stringContaining('Ranger'),
  });
  expect(manifest.edges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        from: 'rule/companions/cavalier-mount',
        to: 'pf1-content/LJouU7rai472j5UQ',
        condition: expect.stringContaining('4'),
      }),
    ]),
  );
});

it('separates normal CRB/APG familiars and conditional Improved Familiar choices from later additions', () => {
  const manifest = freshManifest();
  const pool = manifest.pools.find(
    ({ name }) => name === 'familiar species inventory',
  );
  expect(pool?.members).not.toContain('pf1-content/IkhZvC7RO8qjpIXM');
  expect(pool?.members).not.toContain('pf1-content/FT8IzdLTEv5nKGpn');
  expect(pool?.members).toContain('pf1-content/HmfGUGQEPPll9Rg8');
  const partition = manifest.companionPartitions.find(
    ({ id }) => id === 'familiars',
  );
  expect(
    partition?.entries.find(
      ({ key }) => key === 'pf1-content/u6VZRmy9UvbXd7rs',
    ),
  ).toMatchObject({
    eligibility: 'conditional',
    condition: expect.stringContaining('7'),
  });
  expect(
    manifest.rows.find(
      ({ key }) => key === 'rule/companions/apg-young-octopus',
    ),
  ).toMatchObject({
    requirement: 'required',
    implementationOwner: { issue: 763 },
  });
});
