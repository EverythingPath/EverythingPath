import type { LaunchManifest, LaunchOwner } from './launch-inventory-schema.ts';
import { launchAuthority as authority } from './launch-inventory-authority.ts';

export function launchOwner(
  issue: number,
  responsibility: string,
  evidence: string[],
): LaunchOwner {
  return { issue, responsibility, evidence };
}

const sectionContracts = [
  [
    'Authority, coverage and current baseline',
    [767, 413],
    'The 21-class/eight-race baseline is frozen here; production authority remains legacy until a qualified cutover.',
  ],
  [
    'Character, sheet and persistence contract',
    [261, 413],
    'Reuse one Character and persisted sheet; migration, stable identities and lifecycle equality remain launch work.',
  ],
  [
    'Living-sheet workflow and approved presentation',
    [583, 769],
    'Reuse Build out, level editing and Accept; saved Magical Lineage choice and shared feedback remain launch work.',
  ],
  [
    'Navigation and the two presentations',
    [583, 767],
    'Reuse Full/Militia-only presentations and navigation; realistic browser qualification remains required.',
  ],
  [
    'Class Levels, race and advancement',
    [704, 740, 771, 772],
    '420 printed level checkpoints; standard traits, progression and casting need curated public-sheet proof.',
  ],
  [
    'Grants, Selections and dormancy',
    [305, 704],
    'Reuse Grants, Selections and dormant choices; all inventoried class options require exact bound grants.',
  ],
  [
    'Archetypes, Unchained Classes and casting conflicts',
    [716, 702, 731],
    'Exploiter replaces bond/school; original Monk remains distinct. Preserve all other archetype/prestige inventories.',
  ],
  [
    'Modifiers and derived statistics',
    [731, 734, 704],
    'Promised numbers remain calculated work, including Unchained formulas and companion size.',
  ],
  [
    'Situations and curation',
    [303, 734],
    'Reuse Situation stacking and curation; source/action conditions and held corrections remain owned.',
  ],
  [
    'Spellcasting',
    [771, 772, 586, 769],
    'Class-list levels, casting allowances and grants require source-backed schedules; sole manual exception is Magical Lineage metamagic.',
  ],
  [
    'Attacks, Proficiencies and item state',
    [761, 764, 584],
    'Baseline gear, ammunition, Base Items and Item Abilities need importer/admission proof; #762 effective armor is reused.',
  ],
  [
    'Advisory checks and recorded prerequisites',
    [739, 731],
    'Prerequisite alternatives, feature identity, recorded-level warnings and candidate castsSpell dependencies remain owned.',
  ],
  [
    'Catalog scopes, copies and complete homebrew departure',
    [319, 770],
    'Reuse recorded departures and scopes; implement the versioned release selector separately.',
  ],
  [
    'Ownership, access loss and deletion',
    [413],
    'Initial activation/lifecycle handoff remains; preserve indefinite retention and deletion/grace precedence. No new retention decision.',
  ],
  [
    'Companions, allocations and Combined Forms',
    [707, 733, 763],
    'Animal companions, mounts, familiars and original eidolon are launch work. Cohorts, Synthesist, brood and later subtype scope remain #251 remainder.',
  ],
  [
    'Militia integration and frozen history',
    [423, 413, 714],
    'Reuse militia facts and frozen history; coherent activation/equality/recovery still need rehearsal.',
  ],
  [
    'Catalog import, content curation and notices',
    [716, 736, 737],
    'Inventory every required held body/notice; no source clearance or checked promotion follows from inventory.',
  ],
  [
    'Catalog Releases and concurrent publication',
    [310, 770, 732],
    'Original #310 implementation remains fulfilled. Scoped immutable artifact, actual adapters and measured operating bounds remain follow-ups.',
  ],
  [
    'Initial migration and cleanup',
    [413, 714, 715],
    'Identity installation, companion backfill, cutover and recovery remain; cleanup follows successful real activation.',
  ],
] as const;

export function launchCoverage(
  rows: LaunchManifest['rows'],
): LaunchManifest['coverage'] {
  const allKeys = rows
    .filter(({ requirement }) => requirement === 'required')
    .map(({ key }) => key);
  const keysFor = (...kinds: string[]) =>
    rows
      .filter(
        ({ kind, requirement }) =>
          requirement === 'required' && kinds.includes(kind),
      )
      .map(({ key }) => key);
  const sections = sectionContracts.map(([name, issues, mechanism], index) => ({
    contract: `#251 §${index + 1}`,
    disposition: 'launch work' as const,
    owners: issues.map((issue) =>
      launchOwner(issue, name, [
        `https://github.com/AndreasUnunger/EverythingPath/issues/${issue}`,
      ]),
    ),
    keys:
      index === 4 || index === 6 || index === 9
        ? keysFor('class', 'archetype', 'classFeature')
        : [],
    mechanisms: [mechanism],
    evidence: [
      `https://github.com/AndreasUnunger/EverythingPath/issues/251`,
      'docs/character-sheet/',
    ],
  }));
  const followups: LaunchManifest['coverage'] = [
    {
      contract: '#251 acceptance appendix',
      disposition: 'launch work',
      owners: [
        launchOwner(
          767,
          'Current and next party builds, public persistence/authorization, shared sessions, browser and artifact qualification',
          [
            'https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461',
          ],
        ),
      ],
      keys: allKeys,
      mechanisms: [
        'Every applicable acceptance case remains required; inherited fixture gates do not qualify this launch.',
      ],
      evidence: [
        'https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461',
        'docs/character-sheet/',
      ],
    },
    {
      contract: '#731',
      disposition: 'launch work',
      owners: [
        launchOwner(731, 'P-04/P-05/P-06/P-07/P-15', [
          'https://github.com/AndreasUnunger/EverythingPath/issues/731',
        ]),
      ],
      keys: keysFor(
        'class',
        'archetype',
        'spell',
        'companion',
        'familiar',
        'eidolonForm',
      ),
      mechanisms: [
        'P-04 recorded-level Warning fingerprints; P-05 castsSpell whole-list candidate discovery; P-06 deselection rebinding; P-07 hyphenated unchained-monk formulas/familiar level double counts; P-15 Stealth/Fly size. Shadowdancer key and nonlaunch Unchained classes remain broader work.',
      ],
      evidence: [
        'src/lib/character-sheet.ts',
        'convex/lib/catalogCandidateDefinition.ts',
        'docs/character-sheet/companions.md',
      ],
    },
    {
      contract: '#732',
      disposition: 'launch work',
      owners: [
        launchOwner(732, 'P-11/P-13 measured operating bounds', [
          'docs/catalog-import/releases.md',
        ]),
      ],
      keys: allKeys,
      mechanisms: [
        'Measure actual builds against 128 sheet rows, 256 reachable dependencies, 256 Spell metadata overrides/1 MiB and 16 downstream/move Characters. No bounds qualification is inferred from inventory. History Rewrite P-12 and Registry read optimization T-09 remain preserved remainder.',
      ],
      evidence: [
        'https://github.com/AndreasUnunger/EverythingPath/issues/732',
        'src/lib/catalog/release-limits.ts',
      ],
    },
    {
      contract: '#733',
      disposition: 'launch work',
      owners: [
        launchOwner(
          733,
          'P-10 original-eidolon missing promised automation; Q-03 applicable companion reading',
          ['docs/character-sheet/companions.md'],
        ),
      ],
      keys: keysFor('eidolonForm', 'eidolonEvolution', 'companion', 'familiar'),
      mechanisms: [
        'Extra Evolution/non-table pool sources, evolution natural attacks and arms/claws restrictions remain outstanding where reached. Original-eidolon numeric promises are not blanket prose. Kami/later subtypes, cohorts, brood and Synthesist stay broader #251 work unless required by a semantic path.',
      ],
      evidence: [
        'https://github.com/AndreasUnunger/EverythingPath/issues/733',
        'src/lib/character-sheet-eidolon-progression.ts',
      ],
    },
    {
      contract: '#734',
      disposition: 'launch work',
      owners: [
        launchOwner(
          734,
          'CD-01/CD-02/CD-05/CD-06 selected held feat/spell corrections',
          ['scripts/catalog/legal/'],
        ),
      ],
      keys: keysFor('feat', 'spell'),
      mechanisms: [
        'Affected inventoried keys retain original batch ownership and holds; retarget shield bonuses, repair body/Note defects and rebind full closure before admission. Unselected keys remain original inventory remainder.',
      ],
      evidence: [
        'https://github.com/AndreasUnunger/EverythingPath/issues/734',
        'scripts/catalog/legal/',
      ],
    },
    {
      contract: '#735',
      disposition: 'launch work',
      owners: [
        launchOwner(735, 'S-03/S-04 held spell and CRB feat reassessment', [
          'docs/catalog-import/curation.md',
        ]),
      ],
      keys: keysFor('feat', 'spell'),
      mechanisms: [
        'Later-book spell-list metadata alone is not body attribution; CRB original-rule mechanical evidence can suffice. Existing holds require fresh owning-batch reassessment, not inventory clearance.',
      ],
      evidence: ['https://github.com/AndreasUnunger/EverythingPath/issues/735'],
    },
    {
      contract: '#736',
      disposition: 'launch work',
      owners: [
        launchOwner(736, 'N-01/02/03/13/14, S-02 and Q-07/08 as reached', [
          'scripts/catalog/legal/held-notices.json',
        ]),
      ],
      keys: keysFor('notice', 'spell', 'feat', 'race'),
      mechanisms: [
        'Required PZO1131 Unchained/action metadata, Tiefling PZO9280 and actual discrepant whole bodies retain named holds; no book/policy clearance is inferred. Unreached book wording remains broader work.',
      ],
      evidence: ['https://github.com/AndreasUnunger/EverythingPath/issues/736'],
    },
    {
      contract: '#737',
      disposition: 'launch work',
      owners: [
        launchOwner(
          737,
          'N-05/08/09/10/11/12/15 actual required notice chains',
          ['scripts/catalog/notice-dependencies.ts'],
        ),
      ],
      keys: keysFor('notice', 'spell', 'feat', 'trait'),
      mechanisms: [
        'Reconcile governing, inherited, polymorph and Unchained action notices for exact selected keys. Preserve original holds/schema evidence and historical bindings; unrelated records remain full original inventory remainder.',
      ],
      evidence: [
        'https://github.com/AndreasUnunger/EverythingPath/issues/737',
        'scripts/catalog/legal/',
      ],
    },
  ];
  const appendix = authority.appendix.cases.map((entry) => ({
    contract: `#251 appendix ${entry.id}`,
    disposition: 'launch work' as const,
    owners: [
      launchOwner(
        entry.group === 'api' ? 413 : 767,
        `Qualify applicable ${entry.group} acceptance through the public boundary`,
        [
          'https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461',
        ],
      ),
    ],
    keys: [],
    mechanisms: [
      entry.text,
      'Reuse existing implementation and tests where applicable; qualify actual launch inputs. Nonbaseline classes/cohorts/Combined Forms and full original inventories remain the broader #251 acceptance, not completed by this manifest.',
    ],
    evidence: [
      entry.group === 'calculation'
        ? 'src/lib/character-sheet.test.ts'
        : entry.group === 'api'
          ? 'convex/characterSheet.integration.test.ts'
          : 'e2e/',
      `sha256:${authority.appendix.bodySha256}`,
    ],
  }));
  const affectedNames = new Set([
    'Swordplay Deflection',
    'Shield Gauntlet Style',
    'Improvised Defenses',
    'Cornugon Shield',
    'Cooperative Swarmer',
    'Kinetic Invocation',
    'Volley Fire',
    'Marcher-Lord',
    'Fall Guy',
    'Lifeless Gaze',
    'Dragon Roar',
    'Demonic Nemesis',
    'Smiting Reversal',
    'Touvette Defender',
    'Champion',
    'Armored Athlete',
    'Cypher Script',
    'Cypher Magic',
    'Bane',
    'Transfiguring Touch',
    'Detect Relations',
    'Siege of Trees',
    'Torrent of Elemental Rage',
    'Restore Eidolon',
    'Temporal Stasis',
    'Metabolic Molting',
    'Protection from Evil',
    'Radiation Ward',
    'Draconic Malice',
    'Instant Weapon',
    'Pain Strike',
    'Skald Rage Power',
    'Expel Blood',
    'Blessing of Luck and Resolve',
    'Burrow',
    'Linebreaker',
    'Deathwine',
    'Hydraulic Push',
    'Languid Venom',
    'Outer Planes Traveler',
    'Scurrying Swarmer',
  ]);
  const corrections = followups.find(({ contract }) => contract === '#734');
  if (corrections)
    corrections.keys = rows
      .filter(
        (row) => row.requirement === 'required' && affectedNames.has(row.name),
      )
      .map(({ key }) => key);
  const specific: LaunchManifest['coverage'] = [
    {
      contract: '#731 P-07',
      disposition: 'launch work',
      owners: [
        launchOwner(
          731,
          'Hyphenated Unchained formula identities and familiar effective-level double counts',
          ['src/lib/character-sheet.ts', '#731'],
        ),
      ],
      keys: ['pf1/5mQIOIw4hDhlREPo', ...keysFor('familiar')],
      mechanisms: [
        'Use the actual unchained-monk rule identity in formulas. Prove familiar counts with combined supported sources; the Shadowdancer rename and nonbaseline Unchained classes stay broader work.',
      ],
      evidence: ['https://github.com/AndreasUnunger/EverythingPath/issues/731'],
    },
    {
      contract: '#733 P-10',
      disposition: 'launch work',
      owners: [
        launchOwner(
          733,
          'Original eidolon pool sources, natural attacks and arm/claw eligibility',
          ['src/lib/character-sheet-eidolon-progression.ts', '#707'],
        ),
      ],
      keys: rows
        .filter(
          (row) =>
            row.name === 'Extra Evolution' ||
            ['eidolonForm', 'eidolonEvolution'].includes(row.kind),
        )
        .map(({ key }) => key),
      mechanisms: [
        'Extra Evolution must increase the pool; evolution attacks and natural-attack limits remain promised work. No blanket prose disposition is authorized.',
      ],
      evidence: ['https://github.com/AndreasUnunger/EverythingPath/issues/733'],
    },
    {
      contract: '#732 P-12/T-09 remainder',
      disposition: 'preserved remainder',
      owners: [
        launchOwner(
          732,
          'History Rewrite decision and measured Registry read optimization',
          ['#732'],
        ),
      ],
      keys: [],
      mechanisms: [
        'Neither History Rewrite nor Registry optimization is implemented or waived by this inventory; retain the original issue obligations.',
      ],
      evidence: ['https://github.com/AndreasUnunger/EverythingPath/issues/732'],
    },
    {
      contract: '#733 nonbaseline remainder',
      disposition: 'preserved remainder',
      owners: [
        launchOwner(
          733,
          'Cohorts, Synthesist/brood and later subtype requirements',
          ['#251 §15', '#733'],
        ),
      ],
      keys: [],
      mechanisms: [
        'Retain all broader companion coverage and documented rule interpretations. They enter launch only if an actual required semantic path proves the need.',
      ],
      evidence: ['docs/character-sheet/companions.md'],
    },
    {
      contract: '#716 nine inherited rationale decisions',
      disposition: 'preserved remainder',
      owners: [
        launchOwner(
          716,
          'Separate source-backed rationale correction and fresh authentic review before renewed reliance',
          [
            '#766 authentic r1 R3; dispositions 7/8/11/21–26',
            '#766 r2 fixture-only boundary',
          ],
        ),
      ],
      keys: [
        'everythingpath/monk-windstep-master',
        'everythingpath/unchained-monk-windstep-master',
        'everythingpath/summoner-storm-caller',
        'everythingpath/unchained-summoner-storm-caller',
        'everythingpath/monk-invested-regent',
        'everythingpath/unchained-monk-invested-regent',
        'everythingpath/monk-brazen-disciple',
        'everythingpath/unchained-monk-brazen-disciple',
        'everythingpath/monk-black-asp',
        'everythingpath/unchained-monk-black-asp',
        'everythingpath/monk-sage-counselor',
        'everythingpath/unchained-monk-sage-counselor',
        'everythingpath/rogue-consigliere',
        'everythingpath/rogue-unchained-consigliere',
        'everythingpath/rogue-phantom-thief',
        'everythingpath/rogue-unchained-phantom-thief',
        'everythingpath/summoner-leshy-caller',
        'everythingpath/unchained-summoner-leshy-caller',
      ],
      mechanisms: [
        'Optional nonroot archetypes; retain all nine records and historical receipts/allowlist unchanged. If reached as a required dependency, expose its root path and this before-reliance requirement. Inventory status never renews their admission authority.',
      ],
      evidence: ['docs/catalog-import/campaign-mvp.md'],
    },
  ];
  return [...sections, ...followups, ...appendix, ...specific];
}
