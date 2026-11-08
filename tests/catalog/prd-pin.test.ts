// @vitest-environment node
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prdPin } from '../../scripts/catalog/inventory';
import { verifyPrdCapture } from '../../scripts/catalog/prd-pin';
import { pinnedPath, pinnedStore } from './pinned-sources';

// The #716 P8 PRD capture: the store keeps its manifest and the excerpts the
// tests need, byte-identical to the capture (tests/fixtures/pinned/README.md).
const store = join(pinnedStore, 'prd');
const excerpts = [
  'pages/index.html',
  'pages/openGameLicense.html',
  'checklist/pf-archetypes.json',
  'checklist/pf-prestige-classes.json',
  // The class tables #716 P7a's schedules are checked against.
  'pages/coreRulebook/classes/druid.html',
  'pages/advancedPlayersGuide/baseClasses/summoner.html',
  'pages/unchained/classes/summoner.html',
  'pages/advancedClassGuide/classes/hunter.html',
  // Broodmaster's restricted features (#716 P7a).
  'pages/ultimateMagic/spellcastingClassOptions/summoner.html',
  // The class tables #716 P7b's schedules are checked against, and Zen
  // Archer's replacements.
  'pages/coreRulebook/classes/monk.html',
  'pages/unchained/classes/monk.html',
  'pages/advancedClassGuide/classes/brawler.html',
  'pages/ultimateCombat/classes/ninja.html',
  'pages/unchained/classes/rogue.html',
  'pages/advancedPlayersGuide/coreClasses/monk.html',
  // The class tables #716 P7c's schedules are checked against, and the
  // replacements of Archaeologist, Hateful Rager and Invulnerable Rager.
  'pages/coreRulebook/classes/bard.html',
  'pages/coreRulebook/classes/barbarian.html',
  'pages/unchained/classes/barbarian.html',
  'pages/advancedClassGuide/classes/skald.html',
  'pages/advancedClassGuide/classes/bloodrager.html',
  'pages/ultimateCombat/classArchetypes/bard.html',
  'pages/advancedRaceGuide/coreRaces/halfOrcs.html',
  'pages/advancedPlayersGuide/coreClasses/barbarian.html',
  // The class tables #716 P7d's schedules are checked against, and the
  // replacements of Oath against Undeath and Strategist.
  'pages/coreRulebook/classes/paladin.html',
  'pages/advancedPlayersGuide/coreClasses/paladin.html',
  'pages/advancedPlayersGuide/baseClasses/cavalier.html',
  'pages/ultimateCombat/classes/samurai.html',
  'pages/ultimateMagic/spellcastingClassOptions/paladin.html',
  'pages/ultimateCombat/classArchetypes/cavalier.html',
  // The class tables #716 P7e's schedules are checked against, and the
  // replacements of Clone Master, Cleaner and Psychic Detective.
  'pages/advancedPlayersGuide/baseClasses/alchemist.html',
  'pages/advancedClassGuide/classes/investigator.html',
  'pages/advancedClassGuide/classes/slayer.html',
  'pages/ultimateMagic/spellcastingClassOptions/alchemist.html',
  'pages/advancedClassGuide/classOptions/slayer.html',
  'pages/occultAdventures/archetypes/other.html',
  // The class tables #772's schedules are checked against, and the
  // replacements of Spellbreaker and Staff Magus.
  'pages/advancedPlayersGuide/baseClasses/inquisitor.html',
  'pages/ultimateMagic/spellcasters/magus.html',
  'pages/ultimateCombat/classArchetypes/inquisitor.html',
  'pages/ultimateMagic/spellcastingClassOptions/magus.html',
  // The class tables #771A's schedules are checked against, and the
  // replacements of Ecclesitheurge and Eldritch Scrapper.
  'pages/coreRulebook/classes/cleric.html',
  'pages/coreRulebook/classes/sorcerer.html',
  'pages/advancedClassGuide/classOptions/cleric.html',
  'pages/advancedClassGuide/classOptions/sorcerer.html',
  // The class tables #771B's schedules are checked against, and the
  // replacements of Shigenjo, Bouda and Mountain Witch.
  'pages/advancedPlayersGuide/baseClasses/oracle.html',
  'pages/advancedPlayersGuide/baseClasses/witch.html',
  'pages/advancedRaceGuide/featuredRaces/tengus.html',
  'pages/monsterCodex/gnolls.html',
  'pages/advancedClassGuide/classOptions/witch.html',
  // #771C: the Exploiter Wizard's additions and the arcanist's reservoir,
  // exploits and greater exploits they are checked against.
  'pages/advancedClassGuide/classOptions/wizard.html',
  'pages/advancedClassGuide/classes/arcanist.html',
];
const capture = join(homedir(), 'repos/everythingpath/sources', prdPin.capture);

const copies: string[] = [];
afterEach(async () => {
  await Promise.all(
    copies.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function copyOfStore() {
  const root = await mkdtemp(join(tmpdir(), 'prd-pin-'));
  copies.push(root);
  await cp(store, root, { recursive: true });
  return root;
}

describe('the prd pin', () => {
  it('holds the committed manifest and its excerpts', async () => {
    await expect(
      verifyPrdCapture(store, { files: excerpts }),
    ).resolves.toMatchObject({ files: 50 });
  });

  it('records the capture the owner approved', async () => {
    const manifest = JSON.parse(
      await readFile(pinnedPath('prd', 'manifest.json'), 'utf8'),
    );
    expect(manifest.status).toBe('complete');
    expect(manifest.retiredBy).toBe('20180913');
    // The OGL page's latest Wayback capture with status 200 before the
    // PRD's retirement, as Wayback's CDX index listed it on 2026-10-18.
    expect(
      manifest.pages.find(
        (page: { path: string }) => page.path === 'openGameLicense.html',
      ),
    ).toMatchObject({
      originalUrl: 'http://paizo.com/pathfinderRPG/prd/openGameLicense.html',
      captureUrl:
        'https://web.archive.org/web/20180827152533id_/http://paizo.com:80/pathfinderRPG/prd/openGameLicense.html',
      captureTimestamp: '20180827152533',
    });
    expect(manifest.checklist).toEqual([
      expect.objectContaining({
        repo: 'https://gitlab.com/Tryss_Farron/pf1e-archetypes',
        commit: '92ddcb60027e3088e5afd0645183c031ec3e9bb4',
        path: 'src/pf-prestige-classes',
      }),
      expect.objectContaining({ path: 'src/pf-archetypes' }),
    ]);
  });

  it('fails when a file is missing', async () => {
    const root = await copyOfStore();
    await rm(join(root, 'pages/openGameLicense.html'));
    await expect(verifyPrdCapture(root, { files: excerpts })).rejects.toThrow(
      /lacks pages\/openGameLicense\.html/,
    );
  });

  it('fails when a file changes', async () => {
    const root = await copyOfStore();
    const file = join(root, 'checklist/pf-prestige-classes.json');
    const bytes = await readFile(file);
    bytes[10] = bytes[10] === 0x20 ? 0x09 : 0x20;
    await writeFile(file, bytes);
    await expect(verifyPrdCapture(root, { files: excerpts })).rejects.toThrow(
      /checklist\/pf-prestige-classes\.json changed/,
    );
  });

  it('fails when the manifest changes', async () => {
    const root = await copyOfStore();
    await writeFile(
      join(root, 'manifest.json'),
      `${await readFile(join(root, 'manifest.json'), 'utf8')} `,
    );
    await expect(verifyPrdCapture(root, { files: excerpts })).rejects.toThrow(
      /manifest changed/,
    );
  });

  it('fails for a file the manifest does not list', async () => {
    await expect(
      verifyPrdCapture(store, { files: ['pages/index2.html'] }),
    ).rejects.toThrow(/doesn't list pages\/index2\.html/);
  });

  it('checks the whole capture only when every file is present', async () => {
    await expect(verifyPrdCapture(store)).rejects.toThrow(/lacks pages\//);
  });

  // Optional audit: the full capture, when it is present.
  it.skipIf(!existsSync(capture))(
    'matches the full capture and the store excerpts it holds',
    async () => {
      await expect(verifyPrdCapture(capture)).resolves.toMatchObject({
        contentSha256: prdPin.contentSha256,
      });
      for (const file of ['manifest.json', ...excerpts])
        expect(await readFile(join(store, file))).toEqual(
          await readFile(join(capture, file)),
        );
    },
  );
});
