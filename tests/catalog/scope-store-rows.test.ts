// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  committedScopeRows,
  readStore,
  scopeStoreGaps,
  sourceStorePath,
  type ScopeRow,
  type ScopeVersion,
  type StoreView,
} from './scope-store-rows';

// pbl-store-topup: a static presence check of the pinned store against what
// the committed scopes select (tests/fixtures/pinned/README.md, "What the
// scopes need"): the record of every selected Foundry key, the file of every
// selected PCGen owner, and every file a required or selected row binds, with
// its file digest where the binding records one. It needs no pinned checkouts
// and does not prove that an import succeeds. Resolving the MVP scope takes
// about 7 s.
const rows = await committedScopeRows();
const store = readStore();

describe('the committed scopes against the pinned store', () => {
  it('reads the operator’s selection and every required row', () => {
    const count = (scope: ScopeVersion, test: (row: ScopeRow) => boolean) =>
      rows.filter((row) => row.scope === scope && test(row)).length;
    // The MVP scope selects its 4,261 required upstream rows
    // (release-scope.test.ts) and the 1,962 optional rows they cite.
    expect(count('campaign-mvp-v1', (row) => row.selected)).toBe(6_223);
    expect(
      count('campaign-mvp-v1', (row) => !row.selected),
      'required rows with no upstream record of their own: rule, resource, local and EverythingPath rows',
    ).toBe(16_666 - 4_261);
    expect(count('campaign-mvp-v1', (row) => row.ownerFiles.length > 0)).toBe(
      0,
    );
    expect(count('campaign-party-v1', (row) => row.selected)).toBe(728);
    // The party's PCGen selection emits six owners from five PCGen files.
    const owners = rows.filter(
      (row) => row.scope === 'campaign-party-v1' && row.ownerFiles.length > 0,
    );
    expect(owners).toHaveLength(6);
    expect(new Set(owners.flatMap(({ ownerFiles }) => ownerFiles)).size).toBe(
      5,
    );
    expect(count('campaign-party-v1', (row) => !row.selected)).toBe(6);
  });

  it('holds a file for every row, with the bytes its scope binds', () => {
    const gaps = scopeStoreGaps(rows, store);
    expect(
      gaps,
      `${gaps.length} gaps, one per missing record, PCGen owner file or bound file of a selected or required scope row: copy each file from its pin (tests/fixtures/pinned/README.md, "Rules")`,
    ).toEqual([]);
  });
});

describe('scopeStoreGaps', () => {
  // Alertness and Deflect Arrows, as the committed scopes require them.
  const alertness = rows.find(
    (row) =>
      row.scope === 'campaign-mvp-v1' && row.key === 'pf1/Q1cY8r0Pvb66pMG0',
  )!;
  const deflectArrows = rows.find(
    (row) =>
      row.scope === 'campaign-party-v1' && row.key === 'pf1/ACEQfonKVqh0fwkK',
  )!;
  const alertnessFile = 'pf1/packs/feats/alertness.Q1cY8r0Pvb66pMG0.yaml';
  const without = (change: Partial<StoreView>): StoreView => ({
    ...store,
    ...change,
  });

  it('passes rows the store holds', () => {
    expect(alertness.sources).toEqual([
      expect.objectContaining({
        repository: 'pf1',
        locator: alertnessFile.slice(4),
      }),
    ]);
    expect(scopeStoreGaps([alertness, deflectArrows], store)).toEqual([]);
  });

  it('names a row whose record the store lacks, in either scope', () => {
    const view = without({ recordFile: () => undefined });
    expect(scopeStoreGaps([alertness, deflectArrows], view)).toEqual([
      'campaign-mvp-v1 pf1/Q1cY8r0Pvb66pMG0 (Alertness): no store file',
      'campaign-party-v1 pf1/ACEQfonKVqh0fwkK (Deflect Arrows): no store file',
    ]);
  });

  it('names a bound file the store lacks or holds with other bytes', () => {
    expect(
      scopeStoreGaps([alertness], without({ read: () => undefined })),
    ).toEqual([
      `campaign-mvp-v1 pf1/Q1cY8r0Pvb66pMG0 (Alertness): ${alertnessFile} is absent`,
    ]);
    const edited = without({
      read: (path) => Buffer.concat([store.read(path)!, Buffer.from('\n')]),
    });
    expect(scopeStoreGaps([alertness], edited)).toEqual([
      `campaign-mvp-v1 pf1/Q1cY8r0Pvb66pMG0 (Alertness): ${alertnessFile} differs from its bound digest`,
    ]);
  });

  it('names a file bound at a pin the store does not hold', () => {
    const [source] = alertness.sources;
    const moved = {
      ...alertness,
      sources: [{ ...source!, pin: '0'.repeat(40) }],
    };
    expect(scopeStoreGaps([moved], store)).toEqual([
      `campaign-mvp-v1 pf1/Q1cY8r0Pvb66pMG0 (Alertness): ${alertnessFile} is bound at pin ${'0'.repeat(40)}`,
    ]);
  });

  it('inspects the PRD and PCGen files a rule row binds', () => {
    // Ki Stand (a Monk choice) binds Ultimate Magic's monk page; the APG
    // young octopus binds three PCGen familiar files.
    const kiStand = rows.find((row) => row.key === 'rule/advanced/choice/406')!;
    const octopus = rows.find(
      (row) => row.key === 'rule/companions/apg-young-octopus',
    )!;
    const monkPage =
      'prd/pages/ultimateMagic/spellcastingClassOptions/monk.html';
    const familiars =
      'pcgen/data/pathfinder/paizo/roleplaying_game/core_essentials/ce_races_familiar_apg.lst';
    expect(kiStand.selected).toBe(false);
    expect(kiStand.sources.map(sourceStorePath)).toContain(monkPage);
    expect(octopus.sources.map(sourceStorePath)).toContain(familiars);
    expect(scopeStoreGaps([kiStand, octopus], store)).toEqual([]);
    const lacking = (missing: string) =>
      without({
        read: (path) => (path === missing ? undefined : store.read(path)),
      });
    expect(scopeStoreGaps([kiStand], lacking(monkPage))).toEqual([
      `campaign-mvp-v1 rule/advanced/choice/406 (${kiStand.name}): ${monkPage} is absent`,
    ]);
    const edited = without({
      read: (path) =>
        path === familiars
          ? Buffer.concat([store.read(path)!, Buffer.from('\n')])
          : store.read(path),
    });
    expect(scopeStoreGaps([octopus], edited)).toEqual([
      `campaign-mvp-v1 rule/companions/apg-young-octopus (${octopus.name}): ${familiars} differs from its bound digest`,
    ]);
  });

  it('checks only the presence of a PCGen file bound by its compiled record', () => {
    // The Exploiter Wizard binds the record PCGen compiles from the Advanced
    // Class Guide's class abilities, whose digest is not the file's.
    const exploiter = rows.find(
      (row) => row.key === 'everythingpath/wizard-exploiter-wizard',
    )!;
    const source = exploiter.sources.find(
      ({ repository }) => repository === 'pcgen',
    );
    expect(source?.rawFileSha256).toBeUndefined();
    expect(scopeStoreGaps([exploiter], store)).toEqual([]);
    const path = sourceStorePath(source!);
    expect(
      scopeStoreGaps(
        [exploiter],
        without({
          read: (file) => (file === path ? undefined : store.read(file)),
        }),
      ),
    ).toEqual([
      `campaign-mvp-v1 everythingpath/wizard-exploiter-wizard (Exploiter Wizard): ${path} is absent`,
    ]);
  });

  it('names a selected PCGen owner whose file the store lacks', () => {
    // Mad Dog, a party Barbarian archetype, from Animal Archive.
    const madDog = rows.find(
      (row) => row.key === 'everythingpath/barbarian-mad-dog',
    )!;
    const file =
      'pcgen/data/pathfinder/paizo/player_companion/animal_archive/anar_abilities_class.lst';
    expect(madDog.ownerFiles).toEqual([file]);
    expect(scopeStoreGaps([madDog], store)).toEqual([]);
    const lacking = without({
      read: (path) => (path === file ? undefined : store.read(path)),
    });
    expect(scopeStoreGaps(rows, lacking)).toEqual([
      `campaign-party-v1 everythingpath/barbarian-mad-dog (Mad Dog): ${file}, its PCGen owner's file, is absent`,
    ]);
  });

  it('finds PRD and PCGen bindings at their store paths, without line or anchor', () => {
    const binding = { pin: '', rawSha256: '', effectiveSha256: null };
    expect(
      sourceStorePath({
        ...binding,
        repository: 'prd',
        locator: 'pages/coreRulebook/classes/bard.html:381',
      }),
    ).toBe('prd/pages/coreRulebook/classes/bard.html');
    expect(
      sourceStorePath({
        ...binding,
        repository: 'prd',
        locator: 'pages/coreRulebook/classes/wizard.html#387-391,446-496',
      }),
    ).toBe('prd/pages/coreRulebook/classes/wizard.html');
    expect(
      sourceStorePath({
        ...binding,
        repository: 'prd',
        locator:
          'pages/coreRulebook/classes/rogue.html:[(391, 405), (414, 422)]',
      }),
    ).toBe('prd/pages/coreRulebook/classes/rogue.html');
    expect(
      sourceStorePath({
        ...binding,
        repository: 'pcgen',
        locator:
          'roleplaying_game/core_essentials/ce_abilities_familiar_cr.lst#L14-L32',
      }),
    ).toBe(
      'pcgen/data/pathfinder/paizo/roleplaying_game/core_essentials/ce_abilities_familiar_cr.lst',
    );
  });
});
