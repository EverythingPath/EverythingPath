import { pcgenPin } from '../../../scripts/catalog/inventory';
import { pcgenOwnerEmissionFiles } from './owner-emission-files';

// #716 D4, the saved-sheet proof of a Bloodrager 4 / Monk 1 / Dragon Disciple
// 3 (convex/characterSheetDragonDisciple716.integration.test.ts): the D1
// emission tree, which holds Dragon Disciple's PCGen files, plus the Foundry
// Bloodrager and Monk with every class ability their rows name and every
// record those abilities' descriptions link to, so the gate admits both
// classes whole and the test can install their released rows.

/** The Bloodrager (ACG) and its 17 class abilities, in its `links.classAssociations` order. */
export const bloodragerFiles = [
  'pf1/packs/classes/bloodrager.E27lMw9YNOAjS009.yaml',
  'pf1/packs/class-abilities/bloodrager-bloodline.Aq9rx7oWgv7A7kiV.yaml',
  'pf1/packs/class-abilities/bloodrage.5op6M5xchCJNsYRt.yaml',
  'pf1/packs/class-abilities/fast-movement.9EX00obqhGHcrOdp.yaml',
  'pf1/packs/class-abilities/uncanny-dodge.7WaQxnVaaoL4AGr8.yaml',
  'pf1/packs/class-abilities/blood-sanctuary.xvBGDYUbsE4Ozean.yaml',
  'pf1/packs/class-abilities/bloodrager-spells.uomEu0NuSl6Q43fP.yaml',
  'pf1/packs/class-abilities/blood-casting.HFab4vfATqdqnlSJ.yaml',
  'pf1/packs/class-abilities/eschew-materials.vVkKDPniD09W5JgO.yaml',
  'pf1/packs/class-abilities/improved-uncanny-dodge.ZfnHhhTFQVo0Lj4P.yaml',
  'pf1/packs/class-abilities/bloodline-feat-blo.xxD5AbgfJ5OuzVld.yaml',
  'pf1/packs/class-abilities/damage-reduction.RENIeTVjWB7Mq6Mw.yaml',
  'pf1/packs/class-abilities/bloodline-spells-blo.RJ66UHdnwJ7VuWFo.yaml',
  'pf1/packs/class-abilities/exchange-spell-low.XfN89DtlUrwHGNrp.yaml',
  'pf1/packs/class-abilities/greater-bloodrage.FsOPunvM3kGqD32i.yaml',
  'pf1/packs/class-abilities/indomitable-will.Q3x319WbNkCssApD.yaml',
  'pf1/packs/class-abilities/tireless-bloodrage.vETLfsVXQo1qG2PX.yaml',
  'pf1/packs/class-abilities/mighty-bloodrage.NoJMNxuXDTHzPMcm.yaml',
];

/** The Monk (CRB) and its 23 class abilities, in its `links.classAssociations` order. */
export const monkFiles = [
  'pf1/packs/classes/monk.W8dxwZ1CZiwLKsqr.yaml',
  'pf1/packs/class-abilities/bonus-feat-mnk.VjHjPja5QABBgRvR.yaml',
  'pf1/packs/class-abilities/flurry-of-blows.JKJoHy5NveXGaZqv.yaml',
  'pf1/packs/class-abilities/stunning-fist.2ausI8g6SsmbOpgF.yaml',
  'pf1/packs/class-abilities/unarmed-strike.a4SPdPuOFdmfJdHN.yaml',
  'pf1/packs/class-abilities/ac-bonus-mnk.4zVndIJ8NMWWzl1T.yaml',
  'pf1/packs/class-abilities/evasion.KQYCRLEdD4bGA5ak.yaml',
  'pf1/packs/class-abilities/fast-movement-mnk.CK5L0YJDENqBxLqv.yaml',
  'pf1/packs/class-abilities/maneuver-training.E7enBZN7FCsoyIof.yaml',
  'pf1/packs/class-abilities/still-mind.8VUae7CIgCidvSfg.yaml',
  'pf1/packs/class-abilities/ki-pool.2Og23i3rRXu5QQlg.yaml',
  'pf1/packs/class-abilities/slow-fall.M4bXVPXouXroIt90.yaml',
  'pf1/packs/class-abilities/high-jump.WJEF9WHs27kaFYJL.yaml',
  'pf1/packs/class-abilities/purity-of-body.82G7gl4C1AvtSHI4.yaml',
  'pf1/packs/class-abilities/wholeness-of-body.ZPrMO00Iz2SfrNMq.yaml',
  'pf1/packs/class-abilities/improved-evasion.Cc2eFfhJYlClCGEH.yaml',
  'pf1/packs/class-abilities/diamond-body.nRffrQSKTqjeBAO5.yaml',
  'pf1/packs/class-abilities/abundant-step.XJtvco1XWggmr5LU.yaml',
  'pf1/packs/class-abilities/diamond-soul.bCdFkzKiVg52ufhu.yaml',
  'pf1/packs/class-abilities/quivering-palm.n4SWyKVcdmZK4t7d.yaml',
  'pf1/packs/class-abilities/timeless-body.5JlthJkVGEHPZypG.yaml',
  'pf1/packs/class-abilities/tongue-of-the-sun-and-moon.NKzRm45051DUHkd5.yaml',
  'pf1/packs/class-abilities/empty-body.dtnkUkinLVIl1b2T.yaml',
  'pf1/packs/class-abilities/perfect-self.NNEU7hzPSu2LTyZv.yaml',
];

/** The feats and Spells the class abilities' descriptions link to, and theirs in turn. */
export const linkedFiles = [
  'pf1/packs/feats/catch-off-guard.bZ1YdzkT8NtRIEJ4.yaml',
  'pf1/packs/feats/combat-expertise.NFxHebU1XhEs5WJh.yaml',
  'pf1/packs/feats/combat-reflexes.h9nHYLxXvIXBTmup.yaml',
  'pf1/packs/feats/deflect-arrows.ACEQfonKVqh0fwkK.yaml',
  'pf1/packs/feats/dodge.JreaiTHdyWFNj3Tb.yaml',
  'pf1/packs/feats/eschew-materials.ElqchQT5WB625HPg.yaml',
  'pf1/packs/feats/gorgon-s-fist.nhUawPP4jfED3CYV.yaml',
  'pf1/packs/feats/greater-two-weapon-fighting.ieltigobtFrlTXIt.yaml',
  'pf1/packs/feats/improved-bull-rush.dn2KgHFQRbuoNRx0.yaml',
  'pf1/packs/feats/improved-critical.TbOPtIL8Fv8obXtP.yaml',
  'pf1/packs/feats/improved-disarm.711B9WNFgpdDKKf2.yaml',
  'pf1/packs/feats/improved-feint.tocde3sKG1O3GKgd.yaml',
  'pf1/packs/feats/improved-grapple.ZmQkRk93nbHxsQSt.yaml',
  'pf1/packs/feats/improved-trip.gTrGPxzN054GfpkM.yaml',
  'pf1/packs/feats/improved-two-weapon-fighting.3fNdl7eIUJ5d5fwg.yaml',
  'pf1/packs/feats/improved-unarmed-strike.2aTFNMs3pW6nUBlr.yaml',
  'pf1/packs/feats/medusa-s-wrath.sOCyCmNxe2MBbEaI.yaml',
  'pf1/packs/feats/mobility.R7L4SlGRlnThqFrP.yaml',
  'pf1/packs/feats/power-attack.FUW5mIXHNBBIQ1Sq.yaml',
  'pf1/packs/feats/scorpion-style.2AfSIVge3bg8r6wr.yaml',
  'pf1/packs/feats/snatch-arrows.bHcqTC4Lf3aVl3VO.yaml',
  'pf1/packs/feats/spring-attack.ugQyUpqPBDsqLyra.yaml',
  'pf1/packs/feats/stunning-fist.GsjouI6B8X7BA5wN.yaml',
  'pf1/packs/feats/throw-anything.gGfXQq0IZrxdcZDx.yaml',
  'pf1/packs/feats/two-weapon-fighting.Ee7JHADKEK37tTHs.yaml',
  'pf1/packs/spells/bear-s-endurance.usdv1eqvibmxun6x.yaml',
  'pf1/packs/spells/dimension-door.ojwg1ki98tq8xyh9.yaml',
  'pf1/packs/spells/ethereal-jaunt.btccs4sjo2nog1a0.yaml',
  'pf1/packs/spells/etherealness.gw9bes9othfqm7mi.yaml',
];

/** The whole tree, `<repo>/<path>` keys for `materializePinnedTree`. */
export const dragonDiscipleSheetFiles = [
  ...pcgenOwnerEmissionFiles.map(
    (path) => `pcgen/${pcgenPin.directory}/${path}`,
  ),
  ...bloodragerFiles,
  ...monkFiles,
  ...linkedFiles,
];
