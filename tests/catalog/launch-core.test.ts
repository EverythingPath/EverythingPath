// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import {
  launchInventoryDocument,
  parseLaunchInventory,
} from '../../scripts/catalog/launch-inventory-document';
import { inspectLaunchInventory } from '../../scripts/catalog/launch-inventory';
import { formatPrerequisite } from '../../scripts/catalog/pcgen/pre';
import { launchManifestCopies } from './launch-manifest';

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

it('rejects a shared source-text reference whose document dictionary is missing', () => {
  const encoded = launchInventoryDocument(freshManifest());
  expect(encoded.encoding).toBe('campaign-inventory-tables-v2');
  expect(() => parseLaunchInventory({ ...encoded, textTable: {} })).toThrow(
    /Missing inventory text/,
  );
});

it('requires Crossbow Mastery through its printed Crossbow style and general feat availability', () => {
  const manifest = freshManifest();
  const key = 'pf1-content/cKthdANSm9kgKc29';
  expect(manifest.rows.some((row) => row.key === key)).toBe(true);
  manifest.rows = manifest.rows.filter((row) => row.key !== key);
  const missing = inspectLaunchInventory(manifest).inventoryErrors.filter(
    (finding) => finding.key === key,
  );
  expect(missing.some(({ code }) => code === 'core-required')).toBe(true);
  expect(
    missing.some(({ paths }) =>
      paths.some(({ keys }) => keys.includes('pf1/QQctIGRdc3WWFNzO')),
    ),
  ).toBe(true);
  expect(missing.some(({ owner }) => (owner?.issue ?? 0) > 0)).toBe(true);
});

it.each([
  'pf1/JIljkqPWhmvAPYbI',
  'pf1-content/w7DE5kpg0K1OZKL5',
  'pf1-content/TVpSAKDLXYCHG3uz',
  'pf1-content/1TO09L6Wa8VasAVe',
])('requires the original source-backed equipment definition %s', (key) => {
  const manifest = freshManifest();
  expect(manifest.rows.some((row) => row.key === key)).toBe(true);
  const reduced = {
    ...manifest,
    rows: manifest.rows.filter((row) => row.key !== key),
  };
  expect(
    inspectLaunchInventory(reduced).inventoryErrors.some(
      (finding) => finding.code === 'core-required' && finding.key === key,
    ),
  ).toBe(true);
});

it('retains alternative counts and parameter-sensitive prerequisites independently of waived channels', () => {
  const manifest = freshManifest();
  const prerequisites = manifest.semanticContracts.filter(
    ({ kind }) => kind === 'prerequisite',
  );
  expect(
    prerequisites.some(({ prerequisites }) =>
      prerequisites.some(
        ({ kind, count }) => kind === 'PREMULT' && count === 1,
      ),
    ),
  ).toBe(true);
  expect(
    prerequisites.some(({ prerequisites }) =>
      JSON.stringify(prerequisites).includes('TYPE.'),
    ),
  ).toBe(true);
  expect(
    prerequisites.every(
      ({ prerequisitePolicy }) => prerequisitePolicy === 'ordinary',
    ),
  ).toBe(true);
  const trip = manifest.semanticContracts.find(
    ({ name, channel }) =>
      name === 'Improved Trip' && channel === 'Monk bonus feats',
  );
  expect(trip?.prerequisitePolicy).toBe('waived in channel');
  for (const contract of prerequisites)
    expect(contract.prerequisites.map(formatPrerequisite)).toEqual(
      contract.nativeRequirements,
    );
});

it('gates shared domain spells by casting owner and detects an Inquisitor spell grant', () => {
  const manifest = freshManifest();
  const grants = manifest.semanticContracts.filter(
    ({ channel }) => channel === 'domain spell',
  );
  expect(grants).toHaveLength(463);
  expect(
    grants.every(
      ({ castingContexts, excludedContexts }) =>
        castingContexts.includes('druid-nature-bond-domain') &&
        excludedContexts.includes('inquisitor-domain'),
    ),
  ).toBe(true);
  const grant = grants[0];
  if (!grant) throw new Error('Missing domain spells.');
  grant.castingContexts.push('inquisitor-domain');
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code, key }) => code === 'core-contract' && key === grant.id,
    ),
  ).toBe(true);
});

it('limits borrowed Exploiter bloodline and school loans to the source first-level powers', () => {
  const { semanticContracts } = freshManifest();
  for (const id of ['R02', 'R03']) {
    const loan = semanticContracts.find(
      (entry) => entry.id === `rule/core/shared/${id}`,
    )?.loan;
    expect(loan).toMatchObject({
      firstLevelOnly: true,
      sourceLevel: 1,
      grantsArcana: false,
      grantsSpells: false,
      grantsFeats: false,
      grantsSlots: false,
    });
  }
  expect(
    semanticContracts.find(({ id }) => id === 'rule/core/shared/R06')
      ?.spellAccess,
  ).toMatchObject({
    destination: 'borrowed book',
    permanent: false,
    slotAdjustment: 1,
  });
  expect(
    semanticContracts.find(({ id }) => id === 'rule/core/shared/R05')
      ?.spellAccess,
  ).toMatchObject({
    count: 14,
    destination: 'book',
    levelSource: 'borrowed class',
  });
  expect(
    semanticContracts.find(({ id }) => id === 'rule/core/shared/R04')
      ?.spellAccess,
  ).toMatchObject({
    alternatives: [
      { count: 1, minimumBelowHighest: 0 },
      { count: 2, minimumBelowHighest: 1 },
    ],
    requiresAbsentFromReceivingList: false,
  });
  expect(
    semanticContracts.find(({ id }) => id === 'rule/core/shared/R05')
      ?.spellAccess?.perLevel,
  ).toHaveLength(7);
});

it('resolves the three source contracts to the two existing playable identities independently of party data', () => {
  const manifest = freshManifest();
  const missing = inspectLaunchInventory({
    ...manifest,
    research: [],
  }).inventoryErrors.filter(({ code }) => code === 'core-playable-identity');
  expect(missing).toEqual([]);
  for (const [key, issue] of [
    ['pf1-content/f3r6wtifa8bXlcJG', 356],
    ['pf1/7ZiUSYUV1zRqgkrf', 609],
  ] as const) {
    const row = manifest.rows.find((entry) => entry.key === key);
    expect(row).toMatchObject({
      requirement: 'required',
      inventoryOwner: { issue },
      publicTestOwner: { issue },
    });
  }
  const feat = manifest.rows.find(
    ({ key }) => key === 'pf1-content/f3r6wtifa8bXlcJG',
  );
  expect(feat?.admission.state).toBe('held');
  // Its PZO1131 and PZO1115 notice holds are cleared (owner decisions
  // 2026-10-30) and stay in feats-356.json as evidence; the row keeps its
  // whole-content hold and its notice dependency.
  expect(feat?.holds.map(({ reason }) => reason)).toEqual([
    'feats-356-whole-content-f3r6wtifa8bXlcJG',
  ]);
  expect(
    manifest.edges.some(
      ({ from, to, kind }) =>
        from === feat?.key && to === 'notice/PZO1131' && kind === 'notice',
    ),
  ).toBe(true);
  expect(manifest.party.status).toBe('pending');
});

it.each(['pf1-content/iSHRZjOWa5TnYKXe', 'pf1-content/pJnY2ujJJeo4Zlta'])(
  'rejects substituting a different Underfoot identity %s',
  (key) => {
    const manifest = freshManifest();
    const contract = manifest.semanticContracts.find(
      ({ name }) => name === 'Underfoot feat',
    );
    if (!contract) throw new Error('Missing source-only Underfoot.');
    contract.identity = { kind: 'catalog', key };
    expect(
      inspectLaunchInventory(manifest).inventoryErrors.some(
        ({ code, key }) => code === 'core-contract' && key === contract.id,
      ),
    ).toBe(true);
  },
);

it('retains literal PCGen evidence without asserting a compiled effective identity', () => {
  const manifest = freshManifest();
  const row = manifest.rows.find(
    ({ key }) =>
      key ===
      'rule/pcgen/roleplaying_game/advanced_players_guide/apg_feats.lst:206',
  );
  const source = row?.sources.find(
    ({ repository, locator }) =>
      repository === 'pcgen' && locator.endsWith('apg_feats.lst:206'),
  );
  expect(source?.effectiveSha256).toBeNull();
  expect(source?.rawSha256).toBe(source?.rawLineSha256);
  if (!source) throw new Error('Missing literal source.');
  source.effectiveSha256 = source.rawSha256;
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code }) => code === 'source-effective',
    ),
  ).toBe(true);
});

it('requires both weapon ends and the compatible Longbow ammunition dependency', () => {
  const manifest = freshManifest();
  expect(
    manifest.semanticContracts.find(
      ({ id }) => id === 'rule/core/equipment-shape/pf1/PmiF2bF8uhzghtuz',
    )?.parameters,
  ).toContainEqual({
    name: 'independent weapon ends',
    values: ['primary', 'secondary'],
  });
  manifest.edges = manifest.edges.filter(
    ({ from, to }) =>
      !(
        from === 'rule/core/ammunition/pf1/PqJih70EG2A1XNGf' &&
        to === 'pf1/23HXFjpPnuLFOylm'
      ),
  );
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code, key }) =>
        code === 'core-semantic-edge' && key === 'pf1/23HXFjpPnuLFOylm',
    ),
  ).toBe(true);
});

it('retains racial fractional advancement, caps and every original source partition', () => {
  const manifest = freshManifest();
  const favored = manifest.semanticContracts.filter(
    ({ channel }) => channel === 'racial favored class',
  );
  expect(favored).toHaveLength(64);
  expect(
    favored.some(({ parameters }) =>
      parameters.some(
        ({ name, values }) =>
          name === 'source fractions' && values.includes('1/6'),
      ),
    ),
  ).toBe(true);
  expect(
    favored.some(({ contract }) => contract.includes('maximum DR 10/magic')),
  ).toBe(true);
  expect(
    manifest.sourceAccounting.filter(
      ({ family }) => family === 'native equipment',
    ),
  ).toHaveLength(1300);
  expect(
    manifest.sourceAccounting.filter(
      ({ family }) => family === 'core class inventory',
    ),
  ).toHaveLength(1659);
  manifest.sourceAccounting = manifest.sourceAccounting.filter(
    ({ family }) => family !== 'native equipment',
  );
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code }) => code === 'core-accounting',
    ),
  ).toBe(true);
});

it('keeps source-specific spell rules and seven core lists separate from metadata-only selectors', () => {
  const manifest = freshManifest();
  expect(
    manifest.pools.filter(
      ({ name, purpose }) =>
        name.endsWith('source-bound core spell list') &&
        purpose === 'eligibility',
    ),
  ).toHaveLength(7);
  expect(
    manifest.sourceAccounting.filter(
      ({ family }) => family === 'Wizard metadata selector',
    ),
  ).toHaveLength(1898);
  expect(
    manifest.sourceAccounting.filter(
      ({ family }) => family === 'Oracle symbol selector',
    ),
  ).toHaveLength(23);
  const hero = new Set(
    manifest.semanticContracts
      .filter(({ castingContexts }) =>
        castingContexts.includes('optional hero points'),
      )
      .flatMap(({ targets }) => targets),
  );
  expect(hero.size).toBe(5);
  expect(hero.has('pf1/gTOG6zLrWHgHztQ8')).toBe(true);
  expect(hero.has('pf1/eiocqcnac13xai90')).toBe(false);
  expect(
    manifest.semanticContracts
      .filter(({ channel }) => channel === 'Oracle polarity additional known')
      .every(
        ({ spellAccess }) =>
          spellAccess?.destination === 'known' &&
          !spellAccess.exchangeable &&
          !spellAccess.consumesKnownAllowance,
      ),
  ).toBe(true);
});

it('retains only source-eligible Rage subdomain picks at twelve and sixteen', () => {
  const { semanticContracts } = freshManifest();
  const rage = semanticContracts.find(
    ({ id }) => id === 'rule/core/rage-subdomain-picks',
  );
  expect(rage?.acquisitionLevels).toEqual([12, 16]);
  expect(rage?.targets).not.toContain('pf1/oTI8ZxitbbayhztA');
  expect(rage?.targets).toContain('pf1/4PgX7imAqTsFrctT');
});

it('retains the exact printed core choice sets rather than broad native tags', () => {
  const { pools, checkpoints } = freshManifest();
  for (const [name, count] of [
    ['Barbarian printed rage powers coreRulebook', 28],
    ['Barbarian printed rage powers advancedPlayersGuide', 48],
    ['Cleric printed domains', 33],
    ['Cleric printed subdomains', 66],
    ['Druid printed nature bond domains', 7],
    ['Druid printed eligible APG subdomains', 13],
    ['Fighter printed weapon groups', 14],
    ['Monk printed bonus feats', 17],
    ['Original Rogue printed ordinary talents', 44],
    ['Original Rogue printed advanced talents', 20],
    ['Wizard printed schools coreRulebook', 9],
    ['Wizard printed schools advancedPlayersGuide', 20],
  ] as const)
    expect(pools.find((pool) => pool.name === name)?.members).toHaveLength(
      count,
    );
  expect(
    pools.filter(({ name }) => name.startsWith('Ranger printed style ')),
  ).toHaveLength(7);
  expect(
    checkpoints.filter(({ className }) =>
      [
        'Barbarian',
        'Bard',
        'Cleric',
        'Druid',
        'Fighter',
        'Monk',
        'Paladin',
        'Ranger',
        'Rogue',
        'Sorcerer',
        'Wizard',
      ].includes(className),
    ),
  ).toHaveLength(220);
});

it('requires every core disposition and the actual shared Druid receiving path', () => {
  const manifest = freshManifest();
  expect(
    manifest.semanticContracts.find(
      ({ id }) => id === 'rule/core/MagicalLineage',
    )?.root,
  ).toBe('pf1-content/kDx6ZGhbIteoi7lG');
  expect(
    manifest.coverage.filter(({ contract }) =>
      contract.startsWith('#768 core/shared C'),
    ),
  ).toHaveLength(32);
  const contract = manifest.semanticContracts.find(
    ({ channel, name }) =>
      channel === 'Druid nature bond domains' && name === 'Animal Domain',
  );
  expect(contract?.from).toBe('pf1/wZ40bxNVn95BbLBV');
  if (!contract)
    throw new Error('Missing Druid Animal-domain source contract.');
  manifest.edges = manifest.edges.filter(
    ({ from, to }) => !(from === 'pf1/wZ40bxNVn95BbLBV' && to === contract.id),
  );
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code, key }) => code === 'core-semantic-edge' && key === contract.id,
    ),
  ).toBe(true);
});

it('reports shared domain grants without attributing domain spells to the Inquisitor path', () => {
  const manifest = freshManifest();
  const report = inspectLaunchInventory(manifest);
  const domainGrants = manifest.semanticContracts.filter(
    ({ channel }) => channel === 'domain spell',
  );
  expect(
    domainGrants.every(
      ({ id }) =>
        !(report.incoming[id] ?? []).some(
          ({ keys }) => keys[0] === 'pf1/Fv3FbmXptuDRiL5y',
        ),
    ),
  ).toBe(true);
  const air = domainGrants.find(({ from }) => from === 'pf1/flMrvQOBVwXagqow');
  if (!air) throw new Error('Missing shared Air domain source.');
  expect(
    (report.incoming[air.id] ?? []).some(
      ({ keys }) => keys[0] === 'pf1/7eZQP0MzeO2svmVF',
    ),
  ).toBe(true);
});

it('keeps first-level loan powers separate from complete school/bloodline progression witnesses', () => {
  const manifest = freshManifest();
  const school = manifest.semanticContracts.find(
    ({ id }) => id === 'rule/core/shared/R03',
  );
  expect(school?.borrowedPowerKeys).toContain('pf1/2PdDTBiOuBlZ1YgE');
  expect(school?.borrowedPowerKeys).not.toContain('pf1/1aP0lmJYDqM5pMHY');
  const report = inspectLaunchInventory(manifest);
  expect(
    manifest.semanticContracts
      .filter(
        ({ id, channel, root }) =>
          (id.startsWith('rule/core/powers/') &&
            root === 'pf1/AoWSbnuTSGIxmv61') ||
          channel === 'bloodline additional known' ||
          channel === 'Sorcerer bloodline feat',
      )
      .every(
        ({ id }) =>
          !(report.incoming[id] ?? []).some(
            ({ keys }) => keys[0] === 'everythingpath/wizard-exploiter-wizard',
          ),
      ),
  ).toBe(true);
});

it('retains excluded goods and rejects promoting them into required outputs without a policy resolution', () => {
  const manifest = freshManifest();
  const contract = manifest.semanticContracts.find(
    ({ name, qualification }) =>
      name === 'Belt' && qualification === 'policy excluded',
  );
  if (!contract) throw new Error('Missing retained Belt source definition.');
  const row = manifest.rows.find(({ key }) => key === contract.id);
  expect(row?.requirement).toBe('optional');
  if (!row) throw new Error('Missing retained source row.');
  row.requirement = 'required';
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code, key }) => code === 'core-policy-conflict' && key === row.key,
    ),
  ).toBe(true);
});

it('binds Phantasm to its replacement powers and preserves the printed school contract', () => {
  const manifest = freshManifest();
  expect(manifest.rows.some(({ key }) => key === 'pf1/okBdYuHA2VdKyo8L')).toBe(
    true,
  );
  const contract = manifest.semanticContracts.find(
    ({ from, kind }) =>
      from === 'pf1/okBdYuHA2VdKyo8L' && kind === 'replacement',
  );
  expect(contract?.targets).toEqual(
    expect.arrayContaining(['pf1/2PdDTBiOuBlZ1YgE', 'pf1/1aP0lmJYDqM5pMHY']),
  );
  manifest.semanticContracts = manifest.semanticContracts.filter(
    (entry) => entry !== contract,
  );
  expect(
    inspectLaunchInventory(manifest).inventoryErrors.some(
      ({ code }) => code === 'core-contract',
    ),
  ).toBe(true);
});
