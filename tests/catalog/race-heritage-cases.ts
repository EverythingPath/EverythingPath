// pbl-reseed-generic (PRD #251): the nine published heritage Racial Traits
// the race sheet tests import from the pinned store, each with its race, the
// store files it is imported from and the record's pinned SHA-256. The rows
// are the fields those tests read of the race-import-740 batch's
// heritages.json, with their values unchanged; `kind` names the test path
// each takes there (its `mapping` and `shapechangedAbility`).
import type { Ability } from '../../src/lib/character-sheet-abilities';

type HeritageSource = {
  name: string;
  externalKey: string;
  race: string;
  raceFile: string;
  path: string;
  folderFiles: string[];
  sourceSha256: string;
};

export type HeritageCase =
  /** Mapped: selected, it gives these ability scores (10 in each before). */
  | (HeritageSource & { kind: 'mapped'; ordinaryScores: number[] })
  /** Mapped, and +2 to one more ability while shapechanged. */
  | (HeritageSource & {
      kind: 'shapechanged';
      ordinaryScores: number[];
      shapechangedAbility: Ability;
    })
  /**
   * Withheld for a source conflict: imported with its Base Statistics
   * replacement unresolved; the tests' expected scores are their own.
   */
  | (HeritageSource & { kind: 'withheldSourceConflict' });

export const heritageCases: HeritageCase[] = [
  {
    kind: 'mapped',
    name: 'Angel-Blooded (Angelkin)',
    externalKey: 'pf1-content/TbnWNAk91q2wgqCP',
    race: 'pf1/FHY3oIk5zSOFncJH',
    raceFile: 'pf1/packs/races/aasimar.FHY3oIk5zSOFncJH.yaml',
    path: 'pf1-content/src/pf-racial-traits/Angel_Blooded__Angelkin__TbnWNAk91q2wgqCP.yaml',
    folderFiles: [
      'pf1-content/src/pf-racial-traits/Subraces_ttv0r2Ha7k0ji27j.yaml',
      'pf1-content/src/pf-racial-traits/Aasimar_U1wK0c0t4RdHqzbU.yaml',
      'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
    ],
    sourceSha256:
      '8ae856ec2d3454bbe305e8a76ad8e6fb6a604dfa713f8bb12734432bfa04f479',
    ordinaryScores: [12, 10, 10, 10, 10, 12],
  },
  {
    kind: 'mapped',
    name: 'Jiang-Shi Born (Ru-Shi)',
    externalKey: 'pf1-content/Ni5twdUyps9MQyOX',
    race: 'pf1/puKk997wHX3kIRkR',
    raceFile: 'pf1/packs/races/dhampir.puKk997wHX3kIRkR.yaml',
    path: 'pf1-content/src/pf-racial-traits/Jiang_Shi_Born__Ru_Shi__Ni5twdUyps9MQyOX.yaml',
    folderFiles: [
      'pf1-content/src/pf-racial-traits/Subraces_2hvOVmG4lyZ6PZ2G.yaml',
      'pf1-content/src/pf-racial-traits/Dhampir_QPyW1vOWOSSxqWWv.yaml',
      'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
    ],
    sourceSha256:
      '5e5d961b3ef1f2f8c66b1423f49a3e868b62d9055847e8de9f875dd5bb7991ff',
    ordinaryScores: [12, 8, 10, 12, 10, 10],
  },
  {
    kind: 'mapped',
    name: 'Vetala-Born (Ajibachana)',
    externalKey: 'pf1-content/yodj1nKWZ1hzQVVv',
    race: 'pf1/puKk997wHX3kIRkR',
    raceFile: 'pf1/packs/races/dhampir.puKk997wHX3kIRkR.yaml',
    path: 'pf1-content/src/pf-racial-traits/Vetala_Born__Ajibachana__yodj1nKWZ1hzQVVv.yaml',
    folderFiles: [
      'pf1-content/src/pf-racial-traits/Subraces_2hvOVmG4lyZ6PZ2G.yaml',
      'pf1-content/src/pf-racial-traits/Dhampir_QPyW1vOWOSSxqWWv.yaml',
      'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
    ],
    sourceSha256:
      '93fadc4ae4d5e9d9e5e0716f6c4c792bbf3223e51fd4ecfdfcc312379ef9ad0c',
    ordinaryScores: [10, 12, 10, 12, 8, 10],
  },
  {
    kind: 'mapped',
    name: 'Mistsoul (Vapor Undine)',
    externalKey: 'pf1-content/yRISJZyDwhGV0jFO',
    race: 'pf1/iqJvhd7NbmybUl0y',
    raceFile: 'pf1/packs/races/undine.iqJvhd7NbmybUl0y.yaml',
    path: 'pf1-content/src/pf-racial-traits/Mistsoul__Vapor_Undine__yRISJZyDwhGV0jFO.yaml',
    folderFiles: [
      'pf1-content/src/pf-racial-traits/Subrace_IcEKOd8iP5Pcehuo.yaml',
      'pf1-content/src/pf-racial-traits/Undine_8zuQiFz3p29tdJKe.yaml',
      'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
    ],
    sourceSha256:
      '9d3d20dedc2f6052dbb9224229413d67880b22c09aaeb7cc2f2663dc04a31c42',
    ordinaryScores: [10, 10, 12, 8, 12, 10],
  },
  {
    kind: 'withheldSourceConflict',
    name: 'Wereboar-Kin (Ragebred)',
    externalKey: 'pf1-content/Mb0hz0BAj51wOmUr',
    race: 'pf1/apWl6JIJ8U8p0azq',
    raceFile: 'pf1/packs/races/skinwalker.apWl6JIJ8U8p0azq.yaml',
    path: 'pf1-content/src/pf-racial-traits/Wereboar_Kin__Ragebred__Mb0hz0BAj51wOmUr.yaml',
    folderFiles: [
      'pf1-content/src/pf-racial-traits/Subraces_dWD4t4Bq2TdYAE3h.yaml',
      'pf1-content/src/pf-racial-traits/Skinwalker_Yauhqdv1M3VrpYQr.yaml',
      'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
    ],
    sourceSha256:
      '63c90c7d2077aea0c1c892d7524b21635d2ee603ac00674332cd612c42bbe382',
  },
  {
    kind: 'withheldSourceConflict',
    name: 'Werecrocodile-Kin (Scaleheart)',
    externalKey: 'pf1-content/uj0JvFUtrmpOSNVa',
    race: 'pf1/apWl6JIJ8U8p0azq',
    raceFile: 'pf1/packs/races/skinwalker.apWl6JIJ8U8p0azq.yaml',
    path: 'pf1-content/src/pf-racial-traits/Werecrocodile_Kin__Scaleheart__uj0JvFUtrmpOSNVa.yaml',
    folderFiles: [
      'pf1-content/src/pf-racial-traits/Subraces_dWD4t4Bq2TdYAE3h.yaml',
      'pf1-content/src/pf-racial-traits/Skinwalker_Yauhqdv1M3VrpYQr.yaml',
      'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
    ],
    sourceSha256:
      '7a949e4fdb458d100b4f04f16ee48087c2e0aa8d0e81505e6028f6c67aa0753d',
  },
  {
    kind: 'shapechanged',
    name: 'Wereshark-Kin (Seascarred)',
    externalKey: 'pf1-content/wrqUJsULTxngAMQb',
    race: 'pf1/apWl6JIJ8U8p0azq',
    raceFile: 'pf1/packs/races/skinwalker.apWl6JIJ8U8p0azq.yaml',
    path: 'pf1-content/src/pf-racial-traits/Wereshark_Kin__Seascarred__wrqUJsULTxngAMQb.yaml',
    folderFiles: [
      'pf1-content/src/pf-racial-traits/Subraces_dWD4t4Bq2TdYAE3h.yaml',
      'pf1-content/src/pf-racial-traits/Skinwalker_Yauhqdv1M3VrpYQr.yaml',
      'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
    ],
    sourceSha256:
      'd85c76ce1310650be823d67fe716caf7c434a3a5cfa1cf1b23fd5d4677c7a204',
    ordinaryScores: [10, 10, 10, 8, 12, 10],
    shapechangedAbility: 'constitution',
  },
  {
    kind: 'mapped',
    name: 'Daemon-Spawn (Grimspawn)',
    externalKey: 'pf1-content/zlOXohhDPfhgEstJ',
    race: 'pf1/nVjKDLZSRONzYm8f',
    raceFile: 'pf1/packs/races/tiefling.nVjKDLZSRONzYm8f.yaml',
    path: 'pf1-content/src/pf-racial-traits/Daemon_Spawn__Grimspawn__zlOXohhDPfhgEstJ.yaml',
    folderFiles: [
      'pf1-content/src/pf-racial-traits/Subraces_4NSgjZqYScI33X8K.yaml',
      'pf1-content/src/pf-racial-traits/Tiefling_IPPDGMZfb6Lfx9ij.yaml',
      'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
    ],
    sourceSha256:
      '9febb2f397078770e14c83f609dd6a7b97c14b202828d3b62ed353447e838114',
    ordinaryScores: [10, 12, 10, 12, 8, 10],
  },
  {
    kind: 'mapped',
    name: 'Demodand-Spawn (Foulspawn)',
    externalKey: 'pf1-content/zaQk4Qx8fsdxsOSW',
    race: 'pf1/nVjKDLZSRONzYm8f',
    raceFile: 'pf1/packs/races/tiefling.nVjKDLZSRONzYm8f.yaml',
    path: 'pf1-content/src/pf-racial-traits/Demodand_Spawn__Foulspawn__zaQk4Qx8fsdxsOSW.yaml',
    folderFiles: [
      'pf1-content/src/pf-racial-traits/Subraces_4NSgjZqYScI33X8K.yaml',
      'pf1-content/src/pf-racial-traits/Tiefling_IPPDGMZfb6Lfx9ij.yaml',
      'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
    ],
    sourceSha256:
      'c1c9bbedffd13eb4017587059e22f2b84592d18ee902559530b64a48e11b16e4',
    ordinaryScores: [10, 10, 12, 8, 12, 10],
  },
];
