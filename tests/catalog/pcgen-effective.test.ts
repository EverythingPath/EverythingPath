// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildEffectiveView,
  type PcgenEffectiveView,
} from '../../scripts/catalog/pcgen/effective';
import { toPcgenKey } from '../../scripts/catalog/pcgen/keys';
import {
  recordsByKey,
  type PcgenRecord,
  type PcgenTree,
} from '../../scripts/catalog/pcgen/lst';
import { readPcgen716Tree } from './pcgen-716-tree';

// #716 P3 fix round 1: PCGen's effective records, merged as its loader does
// (natives, `.COPY`, `.MOD` in `.pcc` load order, `.FORGET`), from pinned
// PCGen files. The raw inventory keeps every record and line.
let tree: PcgenTree;
let view: PcgenEffectiveView;
beforeAll(async () => {
  tree = await readPcgen716Tree();
  view = buildEffectiveView(tree);
}, 60_000);

const b2 = 'roleplaying_game/bestiary_2/b2_abilities_race.lst';
const ce = 'roleplaying_game/core_essentials/ce_abilities_race.lst';
const iswgPfs = 'campaign_setting/inner_sea_world_guide/_pfs';

const recordsOf = (category: string, key: string) =>
  recordsByKey(tree.abilities.get(toPcgenKey(category)) ?? new Map(), key);
const effectiveOf = (record: PcgenRecord | undefined) => {
  const effective = record && view.records.get(record);
  if (!effective) throw new Error('No effective record');
  return effective;
};
/** Effective tokens as `file:line token`, so each shows where it came from. */
const sourced = (record: PcgenRecord | undefined) =>
  effectiveOf(record).tokens.map(
    ({ file, line, token }) => `${file.split('/').at(-1)}:${line} ${token}`,
  );

describe('.COPY', () => {
  it('copies its source’s content and provenance, then applies its own line (Cetaceal ~ Push, b2_abilities_race.lst:40)', () => {
    const [cetaceal] = recordsOf('Special Ability', 'Cetaceal ~ Push');
    expect(cetaceal?.tokens).toEqual([
      'Push',
      'KEY:Cetaceal ~ Push',
      'ASPECT:Ability Benefit|(tail slap,10 ft.)',
    ]);
    expect(cetaceal?.copyOf).toMatchObject({ file: b2, line: 40, key: 'Push' });
    expect(effectiveOf(cetaceal).copiedFrom?.locator).toEqual({
      file: ce,
      line: 1467,
      key: 'Push',
    });
    expect(sourced(cetaceal)).toEqual([
      'b2_abilities_race.lst:40 Push',
      'ce_abilities_race.lst:1467 CATEGORY:Special Ability',
      'ce_abilities_race.lst:1467 TYPE:SpecialAttack.Extraordinary.AttackOption',
      expect.stringMatching(
        /^ce_abilities_race\.lst:1467 DESC:You can choose to make a free combat maneuver check/,
      ),
      'ce_abilities_race.lst:1467 SOURCEPAGE:p.303',
      'b2_abilities_race.lst:40 KEY:Cetaceal ~ Push',
      'b2_abilities_race.lst:40 ASPECT:Ability Benefit|(tail slap,10 ft.)',
    ]);
  });

  it('keeps the source’s description and overrides its output name (Allosaurus ~ Rake, ce_abilities_race.lst:2006 from :1469)', () => {
    const [allosaurus] = recordsOf('Special Ability', 'Allosaurus ~ Rake');
    const tokens = sourced(allosaurus);
    expect(tokens).toContainEqual(
      expect.stringMatching(
        /^ce_abilities_race\.lst:1469 DESC:You gain extra natural attacks/,
      ),
    );
    expect(tokens).toContain('ce_abilities_race.lst:2006 OUTPUTNAME:Rake');
    expect(
      tokens.filter((token) => token.includes(' OUTPUTNAME:')),
    ).toHaveLength(1);
  });

  it('inherits the source’s grants (Brijidine ~ Entrap, b2_abilities_race.lst:152 from Entrap ~ Su, ce_abilities_race.lst:1872)', () => {
    const [brijidine] = recordsOf('Special Ability', 'Brijidine ~ Entrap');
    expect(brijidine?.grants).toEqual([]);
    expect(effectiveOf(brijidine).grants).toEqual([
      {
        category: 'Ability Focus',
        nature: 'AUTOMATIC',
        keys: ['Entrap'],
        prerequisites: [],
        file: ce,
        line: 1872,
      },
    ]);
  });
});

describe('.MOD in .pcc load order', () => {
  it('applies Inner Sea Magic’s rewrite, then the Advanced Player’s Guide additions (Judgment ~ Smiting)', () => {
    const apg =
      'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
    const ism = 'campaign_setting/inner_sea_magic/ism_abilities_class.lst';
    const [smiting] = recordsOf('Special Ability', 'Judgment ~ Smiting');
    expect(smiting?.mods.map(({ file, line }) => `${file}:${line}`)).toEqual([
      `${ism}:268`,
      `${apg}:322`,
      `${apg}:323`,
    ]);
    // Campaigns load by descending RANK (SourceFileLoader.java:879), so Inner
    // Sea Magic (201107) loads before the APG (201008), and .MOD lines apply in
    // load order (LstObjectFileLoader.java:641).
    const effective = effectiveOf(smiting);
    expect(
      effective.appliedMods.map(({ file, line }) => `${file}:${line}`),
    ).toEqual([`${ism}:268`, `${apg}:322`, `${apg}:323`]);
    // ISM's DESC:.CLEAR removes the APG record's own description; its three
    // descriptions stay, and the APG's two .MOD descriptions follow them.
    const descriptions = effective.tokens.filter(({ token }) =>
      token.startsWith('DESC:'),
    );
    expect(
      descriptions.map(({ file, line, token }) => [
        `${file}:${line}`,
        token.slice(0, 'DESC:'.length + 60),
      ]),
    ).toEqual([
      [
        `${ism}:268`,
        "DESC:This judgment bathes the inquisitor's weapons in a divine li",
      ],
      [
        `${ism}:268`,
        "DESC:The inquisitor's weapons also count as silver for the purpos",
      ],
      [
        `${ism}:268`,
        "DESC:The inquisitor's weapons also count as adamantine for the pu",
      ],
      [
        `${apg}:322`,
        "DESC:The inquisitor's weapons also count as one alignment type (c",
      ],
      [
        `${apg}:323`,
        "DESC:The inquisitor's weapons also count as adamantine for the pu",
      ],
    ]);
    expect(effective.tokens.map(({ token }) => token)).toContain(
      'SOURCEPAGE:p.39',
    );
  });
});

describe('class .MOD headers and conditional _pfs overlays', () => {
  const pfsClasses = `${iswgPfs}/pfs_iswg_classes.lst`;
  const hellknights = () =>
    tree.prestigeClasses.filter(({ locator }) => locator.key === 'Hellknight');

  it('keeps a CLASS:<name>.MOD header’s locator and tokens on every Hellknight it may modify', () => {
    expect(
      hellknights().map(({ locator, mods }) => [
        `${locator.file}:${locator.line}`,
        mods.map(({ file, line, tokens, binding }) => [
          `${file}:${line}`,
          tokens,
          binding,
        ]),
      ]),
    ).toEqual(
      [
        'campaign_setting/inner_sea_world_guide/iswg_classes.lst:23',
        'roleplaying_game/adventurers_guide/ag_classes.lst:170',
      ].map((owner) => [
        owner,
        [
          [
            `${pfsClasses}:7`,
            ['CLASS:Hellknight.MOD', 'TYPE:PFSLegal'],
            'other-pack',
          ],
        ],
      ]),
    );
  });

  it('records the Pathfinder Society modification as an optional overlay with its condition, not applied', () => {
    for (const hellknight of hellknights()) {
      const effective = effectiveOf(hellknight);
      expect(effective.appliedMods).toEqual([]);
      expect(effective.tokens.map(({ token }) => token)).not.toContain(
        'TYPE:PFSLegal',
      );
      expect(
        effective.optionalOverlays.map(({ kind, directive, condition }) => [
          kind,
          `${directive.file}:${directive.line}`,
          condition,
        ]),
      ).toEqual([
        [
          'mod',
          `${pfsClasses}:7`,
          {
            pcc: `${iswgPfs}/_.pcc`,
            line: 81,
            conditions: [
              'PRECAMPAIGN:1,INCLUDES=Inner Sea World Guide',
              'PRECAMPAIGN:1,Pathfinder Society Core Assumption',
              'PRECAMPAIGN:2,INCLUDES=Bestiary,INCLUDES=Ultimate Magic',
            ],
          },
        ],
      ]);
    }
    const [discipline] = recordsOf('Special Ability', 'Discipline ~ HK');
    expect(
      effectiveOf(discipline).optionalOverlays.map(
        ({ condition }) => condition.line,
      ),
    ).toEqual([78]);
  });
});

describe('.FORGET', () => {
  const tian = () => recordsOf('Background', 'Tian');

  it('removes the records loaded before it and keeps them in the raw inventory (Tian, dep_abilities.lst:19)', () => {
    const forget =
      'player_companion/dragon_empires_primer/dep_abilities.lst:19';
    // Forgets run after every record, copy and modification
    // (LstObjectFileLoader.java:96-103) and remove the object loaded under the
    // key (:629), whatever its source: every Tian goes.
    expect(
      tian().map(({ locator, forgottenBy }) => [
        `${locator.file}:${locator.line}`,
        forgottenBy.map(({ file, line }) => `${file}:${line}`),
        view.records.has(tian().find((record) => record.locator === locator)!),
      ]),
    ).toEqual([
      [
        'campaign_setting/inner_sea_world_guide/iswg_abilities.lst:22',
        [forget],
        false,
      ],
      [
        'player_companion/humans_of_golarion/hog_abilities.lst:46',
        [forget],
        false,
      ],
      [
        'player_companion/inner_sea_primer/isp_abilities.lst:21',
        [forget],
        false,
      ],
    ]);
    expect(
      view.forgotten
        .filter(({ record }) => record.locator.key === 'Tian')
        .map(({ directive }) => `${directive.file}:${directive.line}`),
    ).toEqual([forget, forget, forget]);
  });

  it('keeps a Pathfinder Society forget as an optional overlay on every Pathfinder Savant (pfs_sos_classes.lst:8)', () => {
    const savants = tree.prestigeClasses.filter(
      ({ locator }) => locator.key === 'Pathfinder Savant',
    );
    const forget =
      'forget campaign_setting/seekers_of_secrets/_pfs/pfs_sos_classes.lst:8';
    // The forget's file loads only with the PFS campaign (its _pfs/_.pcc:47
    // PRECAMPAIGN), so it is an overlay with that condition, not applied. When
    // it applies it removes the key's loaded object (LstObjectFileLoader.java:629),
    // whichever record that is, the PFS record itself included.
    expect(
      savants.map((savant) => [
        `${savant.locator.file}:${savant.locator.line}`,
        savant.isPfs,
        effectiveOf(savant).optionalOverlays.map(
          ({ kind, directive, condition }) =>
            `${kind} ${directive.file}:${directive.line} ${condition.pcc}:${condition.line}`,
        ),
      ]),
    ).toEqual(
      [
        ['campaign_setting/seekers_of_secrets/sos_classes.lst:22', false],
        [
          'campaign_setting/seekers_of_secrets/_pfs/pfs_sos_classes.lst:11',
          true,
        ],
        ['roleplaying_game/adventurers_guide/ag_classes.lst:297', false],
      ].map(([locator, isPfs]) => [
        locator,
        isPfs,
        [`${forget} campaign_setting/seekers_of_secrets/_pfs/_.pcc:47`],
      ]),
    );
  });
});
