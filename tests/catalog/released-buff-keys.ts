// pbl-released-buffs (PRD #251): the buff batch units' Spell Effects and
// other buffs, as committed data, for the released buff tests
// (released-buffs.test.ts and released-buffs.integration.test.ts). For each
// batch:
//
// - `named`: each buff a resolver block, a rule-bearing check of a proof
//   block or an integration test looks up by name, with the key the batch
//   preview gave that name;
// - `references`: every other key the named buffs' imported fields name (the
//   Spell a Spell Effect's `spellKey` names, and the Spells, class
//   abilities, feats, racial traits and items their descriptions link), the
//   old tests' literal keys among them, so that each named buff comes out as
//   the release (the whole store imported) emits it. No context key is
//   needed: with these, every named buff imports equal to its preview row.
//
// No buff case checks every entry of a batch, so no batch has an `every`
// list. Nothing here reads a batch directory.

/** One buff batch's keys. */
type BuffBatchKeys = {
  named: Readonly<Record<string, string>>;
  references: readonly string[];
};

export const buffBatches = {
  'buffs-547': {
    named: {
      'Accurate Stance': 'pf1/CjQ4VmDIRBb3k7Dg',
      Aid: 'pf1/qmwVJUZ7ZuvF3tAB',
      Bane: 'pf1/D2huasedfGMSetP7',
      Barkskin: 'pf1/kG8EriOOSJmDmYZd',
      Bless: 'pf1/QYVZS8MfOKzjpCm1',
      "Bull's Strength": 'pf1/ClOy4KHJFDdt0ALh',
      'Calm Stance': 'pf1/o0U6E2WvMBTectrc',
      'Dire Prophecy': 'pf1/B1lq0g41olpQMfzK',
      'Divine Favor': 'pf1/3czZB6whbQo9WhxR',
      'Fighting Defensively': 'pf1/V8cRFtOQA6ltklEl',
      Fly: 'pf1/sfmKrukx8vFoXLBf',
      'Guarded Stance': 'pf1/UTsRSrDTUDDEvwT5',
      'Hard Light Shield': 'pf1/0AfEoAsDnhvMUW2D',
      Haste: 'pf1/NWImcWGTjCtw1Zf0',
      'Heroism, Greater': 'pf1/T2j3SnpatLbS32O1',
      'Inspire Courage': 'pf1/3p34GJemfcLdKckV',
      'Knockdown Stance': 'pf1/fqDf4Cbv8tqRbygg',
      Magboots: 'pf1/eKiKTrSBNLubVI6g',
      'Mage Armor': 'pf1/IlO0CNpAIKZtNYu8',
      'Powerful Stance': 'pf1/HC9wMz9Ko93PgB8D',
      'Prayer (Negative)': 'pf1/MFogxSkB5dBmUI5i',
      Rage: 'pf1/UgjpRD8vtiSWRxuL',
      'Rage (Unchained)': 'pf1/ciAO4KwMonUzAGY0',
      'Reckless Stance': 'pf1/KLUCuieSvkTD4qem',
      Shield: 'pf1/olTpyao476hOEzzm',
      'Shield of Faith': 'pf1/WgCWQxR53UdVSGPB',
      Slow: 'pf1/OQQYaNxXsb974T8j',
      'Strength Stance': 'pf1/aqCSTZjMKDXU0DeT',
      'Total Defense': 'pf1/DvcRWaWndZ1s2tB4',
      'Veemod (Black)': 'pf1/G4KDVMpA5nH0r9sF',
      'Veemod (Brown)': 'pf1/64LMZn1hx4DeI08O',
      'Veemod (Green)': 'pf1/1MspZVYeg3IMlGVL',
      'Veemod (Powered Armor)': 'pf1/WRwcMIspQq9acUQW',
      Ward: 'pf1/e6LhyzMnHZc5Vlni',
    },
    references: [
      'pf1/042BafLhw5SsMsg6', // Accurate Stance (UC) (classFeature), named by Accurate Stance
      'pf1/05i5rxwim12hwktu', // Bull's Strength (spell), named by Bull's Strength
      'pf1/0BtaS9u6bxDBaKhH', // Veemod goggles (item), named by Veemod (Black), Veemod (Brown), Veemod (Green)
      'pf1/21bxbzdaawjrnvyo', // Divine Favor (spell), named by Divine Favor
      'pf1/2Az38ZPYwjYBKZd2', // Rage (UC) (classFeature), named by Rage (Unchained)
      'pf1/3c9wm12qx3pWhh79', // Strength Stance (UC) (classFeature), named by Strength Stance
      'pf1/3etxlex8u32g0hrx', // Bane (spell), named by Bane
      'pf1/7d6sv5ecvi7kho3m', // Fly (spell), named by Fly
      'pf1/8nVgKDcPUcJBCYL7', // Calm Stance (UC) (classFeature), named by Calm Stance
      'pf1/9dvLuZUA2Wy1TBht', // Veemod (green) (item), named by Veemod (Green)
      'pf1/IO2EwSxZUfTuDJ9l', // Knockdown Stance (UC) (classFeature), named by Knockdown Stance
      'pf1/KPauZdmqDDxXj6OU', // Dire Prophecy (classFeature), named by Dire Prophecy
      'pf1/WSqWT9ZIshtC5vlV', // Rage (classFeature), named by Rage
      'pf1/Z0EXCnJBeBUdIb4H', // Guarded Stance (UC) (classFeature), named by Guarded Stance
      'pf1/alQVMlHc89hMxK2M', // Hard light shield (item), named by Hard Light Shield
      'pf1/eecEg8w7FECEclV5', // Powered Armor (item), named by Veemod (Powered Armor)
      'pf1/etzfM5q6bFFSnRjU', // Ward (classFeature), named by Ward
      'pf1/h56K6HEBOItImPPL', // Inspire Courage (classFeature), named by Inspire Courage
      'pf1/hu8179fdqfkl0bqj', // Prayer (spell), named by Prayer (Negative)
      'pf1/ibk7jrc5rwubpia6', // Aid (spell), named by Aid
      'pf1/isntpKkbAc8v2SuT', // Reckless Stance (UC) (classFeature), named by Reckless Stance
      'pf1/jJfwLVduz8FtcgEg', // Veemod (brown) (item), named by Veemod (Brown)
      'pf1/jcr72piqo6g549e1', // Slow (spell), named by Slow
      'pf1/jhIfmOlvPbwZwCq1', // Veemod (black) (item), named by Veemod (Black)
      'pf1/la7kuehewu85ybnt', // Barkskin (spell), named by Barkskin
      'pf1/nK3XfCurRf9nRZiD', // Magboots (item), named by Magboots
      'pf1/s9amdo5398alb5p0', // Haste (spell), named by Haste
      'pf1/sz7j540uypmqqvti', // Shield (spell), named by Shield
      'pf1/uJ4WSKQo1W8GZ9vr', // Powerful Stance (UC) (classFeature), named by Powerful Stance
      'pf1/ucc0a31d1y86oleh', // Mage Armor (spell), named by Mage Armor
      'pf1/wa0zb2pncesmm9lz', // Bless (spell), named by Bless
      'pf1/y2uhoqr4itdbw5g4', // Shield of Faith (spell), named by Shield of Faith; a literal of buffs547.integration.test.ts:19
      'pf1/z0duc2v2n3ioynta', // Heroism, Greater (spell), named by Heroism, Greater
    ],
  },
  'pf-buffs-548': {
    named: {
      'Acute Senses': 'pf1-content/3cimRYgdw7AiOVci',
      'Animal Focus (Bear)': 'pf1-content/Mgi0taTxLOPN6y2V',
      'Animal Focus (Falcon)': 'pf1-content/30MZFYjOgu59ZoXj',
      'Animal Focus (Owl)': 'pf1-content/LR64SMLpzgyMNNcm',
      'Aspect of the Bear': 'pf1-content/IKplHwGtIcu4tPWm',
      'Aspect of the Wolf': 'pf1-content/MPLcJJ9ChkKRQFBm',
      'Blessing of Courage and Life': 'pf1-content/93oIrx2wLSx0jMkM',
      'Blessings of Luck and Resolve': 'pf1-content/GxJkSFnUVZFRaL60',
      'Bullet Shield': 'pf1-content/6RPLqDcY42xhf1vG',
      'Burst of Glory': 'pf1-content/EmavEsO0Mv42N03v',
      'Change Shape (Skinwalker - Beast Talker, DEX)':
        'pf1-content/HCA9XtDHKEM0LKPf',
      'Change Shape (Skinwalker - Beast Talker, Natural Armor)':
        'pf1-content/8tGMOYDj4liqSfQw',
      'Cloak of Chaos': 'pf1-content/Gop7EqmpSCJEToKh',
      'Crushing Despair': 'pf1-content/6k7GsF01oeTNRdHn',
      "Darkvision 60'": 'pf1-content/EXl28IFj2KFuQNTj',
      'Debilitating Injury (Disoriented)': 'pf1-content/3V4SKStquBCW8grU',
      'Dispel Chaos': 'pf1-content/9biFvl9p1s2nD8ya',
      'Dispel Good': 'pf1-content/MbUvot7Y0XjIWhDv',
      'Divine Power': 'pf1-content/0hRYCva2hdwUNFh6',
      'Evil Eye (AC)': 'pf1-content/5CWQRKQxsM14G93h',
      'Evil Eye (Saves)': 'pf1-content/2Ob3MdeFHK2wLkyu',
      'Great Cleave': 'pf1-content/KyHDVDUcLeU6zftx',
      Guidance: 'pf1-content/5Dnr5RMWjDeWfOQy',
      Halo: 'pf1-content/3EO6OKoyQ8kd6Nyz',
      'Ill Omen': 'pf1-content/PS0NFxiHHFOPWtMZ',
      'Inspire Heroics': 'pf1-content/5lQmzt3oPWtrZ1Y7',
      Jump: 'pf1-content/AgqXOB4RbAi5QHnR',
      'Lay of the Land': 'pf1-content/P7qbzmQZKvp9PPqP',
      Luckbringer: 'pf1-content/6vlc3rwNTU0SMAZz',
      Lunge: 'pf1-content/7DtG0pydiheVvIS8',
      'Mind Blank': 'pf1-content/DLvn0bOMqIojSfBE',
      'Perfect Placement': 'pf1-content/JANtDnS2x7f440hi',
      'Protection From Good': 'pf1-content/GvC3aWG9B38k6w2X',
      'Protection From Law': 'pf1-content/Daku5HFny6WDVtS4',
      Resistance: 'pf1-content/GdU6Xlwn2phRnfc6',
      'Sanctify Armor': 'pf1-content/K8fLIVFxynjNjWVv',
      'Shield of Law': 'pf1-content/Egx0VjnW33lI4i6o',
      'Squeezing (large)': 'pf1-content/Ej91vWnfFTaxMhyZ',
      'Stunning Barrier': 'pf1-content/AT8nA8OtDW4fF8Yv',
      'Tap Inner Beauty': 'pf1-content/4GpKSkJcwb4jQ3dH',
      'Threefold Aspect (Adult)': 'pf1-content/HcFcqAws28M3kGqb',
      'Threefold Aspect (Young Adult)': 'pf1-content/4vpqjjeo6lAvwqa0',
      'Unerring Weapon': 'pf1-content/5M1texkD3FX1c5D3',
      'Veil of Positive Energy': 'pf1-content/IfR6nJz0I3Z2NrDm',
    },
    references: [
      'pf1-content/2NXp8S2ZZ2Lh5LS3', // Halo (racialTrait), named by Halo
      'pf1-content/HSEQTjNZ9ZPnhZUZ', // Beast Talker (racialTrait), named by Change Shape (Skinwalker - Beast Talker, DEX)
      'pf1-content/mIoJHEWhujpANeaM', // Luckbringer (racialTrait), named by Luckbringer
      'pf1-content/mLxAldGcZ0UnEfd7', // Change Shape (Skinwalker) (racialTrait), named by Change Shape (Skinwalker - Beast Talker, Natural Armor)
      'pf1/09juighnblqlqwro', // Unerring Weapon (spell), named by Unerring Weapon
      'pf1/0yvwyclhkf76veo1', // Divine Power (spell), named by Divine Power; a literal of pfBuffs548.integration.test.ts:20
      'pf1/272szq5d556toqgc', // Blessing of Courage and Life (spell), named by Blessing of Courage and Life
      'pf1/2p6fzj5t03oivndd', // Command (spell), named by Protection From Good, Protection From Law
      'pf1/3lgy3s4h4087ojht', // Dispel Chaos (spell), named by Dispel Chaos
      'pf1/3wdb34u6m64ctji7', // Lay of the Land (spell), named by Lay of the Land
      'pf1/6HSMdwX1VS6nZ6Zf', // Great Cleave (feat), named by Great Cleave
      'pf1/71g6nmvy8qnodwyz', // Protection from Good (spell), named by Protection From Good
      'pf1/7vzu76eg8om0gpf0', // Stunning Barrier (spell), named by Stunning Barrier
      'pf1/8wspht4k8tiugz6u', // Burst of Glory (spell), named by Burst of Glory
      'pf1/LIFTbzT5WDcsDn0O', // Inspire Heroics (classFeature), named by Inspire Heroics
      'pf1/U4o5YunSfhiWoZi8', // Evil Eye (classFeature), named by Evil Eye (AC), Evil Eye (Saves)
      'pf1/blvetbc929cfx4m8', // Mind Blank (spell), named by Mind Blank
      'pf1/ekhygw5fzfe52n35', // Protection from Law (spell), named by Protection From Law
      'pf1/f9adpo6szijchpva', // Acute Senses (spell), named by Acute Senses
      'pf1/fmuea6pmgrylbux7', // Arcane Eye (spell), named by Mind Blank
      'pf1/g66w32kdup1f43bp', // Scrying (spell), named by Mind Blank
      'pf1/g8j278xcu2s1zlwy', // Resistance (spell), named by Resistance
      'pf1/gmgwyjfpeuuc4t4o', // Dispel Magic (spell), named by Dispel Chaos, Dispel Good
      'pf1/jbqo4o2b2tmdz7wv', // True Seeing (spell), named by Threefold Aspect (Adult), Threefold Aspect (Young Adult)
      'pf1/jcr72piqo6g549e1', // Slow (spell), named by Shield of Law
      'pf1/knjoprwzcm3jygwk', // Aspect of the Wolf (spell), named by Aspect of the Wolf
      'pf1/lzj5umxjvogvpg6b', // Shield of Law (spell), named by Shield of Law
      'pf1/m8nue3zocbg7c5o1', // Blessing of Luck and Resolve (spell), named by Blessings of Luck and Resolve
      'pf1/md6ltvqh9paadsm4', // Protection from Chaos (spell), named by Shield of Law
      'pf1/mjddoap3a58b2bux', // Sanctify Armor (spell), named by Sanctify Armor
      'pf1/nL9Ds9nflmID84vo', // Debilitating Injury (classFeature), named by Debilitating Injury (Disoriented)
      'pf1/ncijcs7iaf9apm69', // Perfect Placement (spell), named by Perfect Placement
      'pf1/nnj51dwfkwd15ngj', // Wish (spell), named by Mind Blank
      'pf1/nokru6mxk9p3r513', // See Invisibility (spell), named by Mind Blank
      'pf1/ns2zo6qgd9co02uf', // Jump (spell), named by Jump
      'pf1/o0s3eo85npgigh3w', // Cloak of Chaos (spell), named by Cloak of Chaos
      'pf1/o8ds5jtvf0hf92dw', // Guidance (spell), named by Guidance
      'pf1/q070n0zoq3zojpas', // Dominate Person (spell), named by Protection From Good, Protection From Law
      'pf1/rgd5v3llwoptwcdb', // Good Hope (spell), named by Crushing Despair
      'pf1/s2p7a4biy7bl4ks2', // Limited Wish (spell), named by Mind Blank
      'pf1/suel7sgnztenv551', // Miracle (spell), named by Mind Blank
      'pf1/t1wkaw7wfvboswcb', // Tap Inner Beauty (spell), named by Tap Inner Beauty
      'pf1/tjog6bufg5b08lvq', // Charm Person (spell), named by Protection From Good, Protection From Law
      'pf1/tr7m97npkbgm4wp7', // Detect Evil (spell), named by Mind Blank
      'pf1/ufo5z8s3u6ff45t0', // Aspect of the Bear (spell), named by Aspect of the Bear
      'pf1/vhfj5bkt9hmgvh9p', // Bullet Shield (spell), named by Bullet Shield
      'pf1/vl2mznu91c3efcam', // Locate Creature (spell), named by Mind Blank
      'pf1/w2yf0ksu14e91uae', // Threefold Aspect (spell), named by Threefold Aspect (Adult), Threefold Aspect (Young Adult)
      'pf1/wjdhmfdgwrevax3w', // Ill Omen (spell), named by Ill Omen
      'pf1/xgv1e2ayf1e0br9j', // Dispel Good (spell), named by Dispel Good
      'pf1/xpmhu8rj7gbjns84', // Veil of Positive Energy (spell), named by Veil of Positive Energy
      'pf1/xq2TFr7bsYBBHOi5', // Lunge (feat), named by Lunge
      'pf1/zt7cje76dck9hwp9', // Crushing Despair (spell), named by Crushing Despair
    ],
  },
  'pf-buffs-549': {
    named: {
      Adoration: 'pf1-content/cCD0u4e8iVPQiEEB',
      'Alter Self (Small)': 'pf1-content/mfQQhjRctUmnNoOW',
      'Angelic Aspect (Lesser)': 'pf1-content/SQNQcS6VOXlF7vJx',
      'Animal Focus (Frog)': 'pf1-content/Yr2fjmHuiTy4J6nC',
      'Animal Focus (Wolf)': 'pf1-content/mZ63Rbpnk9UCwtWN',
      'Anticipate Peril': 'pf1-content/RtpsbHxEozt6xoRY',
      'Banner, Greater': 'pf1-content/j3MVnIz62onhe1RK',
      'Blessing of Fervor (Atk, AC, Ref)': 'pf1-content/geWTjY7DETIdiGEf',
      'Certain Grip': 'pf1-content/iYm4uOJ9j9kv5IiM',
      'Change Shape (Skinwalker - Beast Talker, CON)':
        'pf1-content/mEyDsdVHR2V9oQQP',
      'Change Shape (Skinwalker, Natural Armor)':
        'pf1-content/mcSOsUhKl1gXl2jH',
      'Channel Vigor (Limbs)': 'pf1-content/jgjZtSsE7ArzriMi',
      'Channel Vigor (Torso)': 'pf1-content/Pyd0enOa0zFvGbRf',
      Charging: 'pf1-content/WmHIEsLnruuSZcx0',
      Chastise: 'pf1-content/Z3V9WryOHwuJJYIL',
      'Combat Expertise': 'pf1-content/Xwk4zZksBg2KvyEG',
      'Cover (Soft)': 'pf1-content/eD5e5MRoDhHo5W0U',
      'Death Knell': 'pf1-content/d9UQiCnpsiAuVZK4',
      'Debilitating Injury (Bewildered)': 'pf1-content/YX0ZXFOGqZXu57AN',
      'Dispel Evil': 'pf1-content/mXp0Quu18DWpfUca',
      'Dispel Law': 'pf1-content/eKrJIRlv5lCIzu76',
      'Evil Eye (Atk)': 'pf1-content/mDv3xY2HllJpjqe2',
      'Evil Eye (Skill)': 'pf1-content/XBjEZImaTvGXh6Gq',
      Glibness: 'pf1-content/h2CiqYYWaRjnkpag',
      'Good Hope': 'pf1-content/kkDzmQdg0RjnwSLj',
      'Holy Aura': 'pf1-content/mKiX7dYMdLT4NTjX',
      Identify: 'pf1-content/a7ETo6JlLgV2jCvC',
      Jitterbugs: 'pf1-content/Y7vd3pUSG8oqT5ne',
      'Joyous Companion': 'pf1-content/RAYOWB9C1py88D2X',
      'Magic Fang': 'pf1-content/hLyR3HQklOuoI86H',
      'Magic Fang, Greater': 'pf1-content/iIdgvEwRaBBFGH57',
      'Magic Vestment': 'pf1-content/Qqo3DLdlbnXhXe7G',
      'Magic Weapon, Greater': 'pf1-content/ZQ42VAKDzYNxRuIp',
      'Pernicious Poison': 'pf1-content/Xx9cnazY0c0NR5Xe',
      'Protection From Evil': 'pf1-content/lDsREstT0RbVJ14v',
      'Remove Fear': 'pf1-content/lpBAgRhDew61Vmzo',
      'Righteous Might': 'pf1-content/hCnPdxRqx1bF5QpZ',
      'Small Quarter Ally': 'pf1-content/XHZ3aPPuO7Yh6hbb',
      'Smite Evil': 'pf1-content/Vbbl4AC1L593crS7',
      'Smite Good (Tiefling)': 'pf1-content/S0uR7otMBQWSYx0t',
      'Threefold Aspect (Elderly)': 'pf1-content/a1pqQo5D0kNbI1F8',
      'Touch of Good': 'pf1-content/eWKAflRpEuEyXJwW',
      "Tremorsense 30'": 'pf1-content/WVs1d1l2G45GRlQc',
      'Unbreakable Heart': 'pf1-content/dAxQP5Y6zFGMl9Jb',
      'Unholy Aura': 'pf1-content/iseQUmcsHjLuOyHJ',
      'Weapon of Awe': 'pf1-content/Pet3yM3SB2VfqgPy',
      'Wrathful Mantle': 'pf1-content/bU5ry2F5WAKhacZI',
    },
    references: [
      'pf1-content/0padhC2cSPeYhbuU', // Smite Good (racialTrait), named by Smite Good (Tiefling)
      'pf1-content/HSEQTjNZ9ZPnhZUZ', // Beast Talker (racialTrait), named by Change Shape (Skinwalker - Beast Talker, CON)
      'pf1-content/Ral2Kd4diC6McjqC', // Joyous Companion (racialTrait), named by Joyous Companion
      'pf1-content/kqSFEBk1ycJ6PG8y', // Small Quarter Ally (racialTrait), named by Small Quarter Ally
      'pf1-content/mLxAldGcZ0UnEfd7', // Change Shape (Skinwalker) (racialTrait), named by Change Shape (Skinwalker, Natural Armor)
      'pf1-content/tOyZJ3QAQqZDdMxX', // Segadan Halflings (racialTrait), named by Small Quarter Ally
      'pf1/1Yy6Fn3UD82uviFg', // Greater Banner (classFeature), named by Banner, Greater
      'pf1/1gz3zdpxu7uic5ky', // Wrathful Mantle (spell), named by Wrathful Mantle; a literal of pfBuffs549.integration.test.ts:22
      'pf1/2TsDfK0SKC8IGVx4', // Smite Evil (classFeature), named by Smite Evil
      'pf1/2p6fzj5t03oivndd', // Command (spell), named by Protection From Evil
      'pf1/4ratngmltr3z4om5', // Angelic Aspect, Lesser (spell), named by Angelic Aspect (Lesser)
      'pf1/6ax0ythzw8n4bta8', // Righteous Might (spell), named by Righteous Might
      'pf1/6gbb0vdil1e8mhou', // Pernicious Poison (spell), named by Pernicious Poison
      'pf1/71g6nmvy8qnodwyz', // Protection from Good (spell), named by Unholy Aura
      'pf1/73han2zqxg59u18g', // Magic Vestment (spell), named by Magic Vestment
      'pf1/7c8nufdm0pj4bgep', // Glibness (spell), named by Glibness
      'pf1/7td8qAPvj9YEasha', // Touch of Good (classFeature), named by Touch of Good
      'pf1/9tww9fc9049h6iqc', // Cause Fear (spell), named by Remove Fear
      'pf1/NFxHebU1XhEs5WJh', // Combat Expertise (feat), named by Combat Expertise; a literal of pfBuffs549.integration.test.ts:234
      'pf1/U4o5YunSfhiWoZi8', // Evil Eye (classFeature), named by Evil Eye (Atk), Evil Eye (Skill)
      'pf1/axe8kelwutjkwh80', // Jitterbugs (spell), named by Jitterbugs
      'pf1/bgtmki0xl4xl4y91', // Magic Fang, Greater (spell), named by Magic Fang, Greater
      'pf1/cfzk3vkv1c7ncaug', // Magic Fang (spell), named by Magic Fang, Magic Fang, Greater
      'pf1/cvv6oimqks9n62vy', // Magic Weapon (spell), named by Magic Weapon, Greater
      'pf1/eimp8bzk9oabtqpj', // Unbreakable Heart (spell), named by Unbreakable Heart
      'pf1/eu4u4mr1naoiqohz', // Remove Fear (spell), named by Remove Fear
      'pf1/fhuoxhjgf9otqvzh', // Dispel Law (spell), named by Dispel Law
      'pf1/flrn1xmm2wfrxbkf', // Unholy Aura (spell), named by Unholy Aura
      'pf1/gmgwyjfpeuuc4t4o', // Dispel Magic (spell), named by Dispel Evil, Dispel Law
      'pf1/h2i514vklrry38fj', // Adoration (spell), named by Adoration
      'pf1/hlom4mgjkdy2dd5u', // Weapon of Awe (spell), named by Weapon of Awe
      'pf1/j2ngami2cehgw3bt', // Chastise (spell), named by Chastise
      'pf1/ja1p1uuf8fp6fiox', // Anticipate Peril (spell), named by Anticipate Peril
      'pf1/jbqo4o2b2tmdz7wv', // True Seeing (spell), named by Threefold Aspect (Elderly)
      'pf1/k0k8gvqyy3rd5gke', // Death Knell (spell), named by Death Knell
      'pf1/kouqz0pm1xl8xilm', // Alter Self (spell), named by Alter Self (Small)
      'pf1/llxrra87kbofmyhl', // Identify (spell), named by Identify
      'pf1/lmnwhrqgxf9cm9jq', // Certain Grip (spell), named by Certain Grip
      'pf1/n0vm6or4nwaylpfa', // Holy Aura (spell), named by Holy Aura
      'pf1/nL9Ds9nflmID84vo', // Debilitating Injury (classFeature), named by Debilitating Injury (Bewildered)
      'pf1/nsxngq65mbrzgwnm', // Permanency (spell), named by Magic Fang, Magic Fang, Greater
      'pf1/q070n0zoq3zojpas', // Dominate Person (spell), named by Protection From Evil
      'pf1/rgd5v3llwoptwcdb', // Good Hope (spell), named by Good Hope
      'pf1/scyklgov72pvw884', // Blessing of Fervor (spell), named by Blessing of Fervor (Atk, AC, Ref)
      'pf1/sg3eq6xpsum65fgm', // Dispel Evil (spell), named by Dispel Evil
      'pf1/skgjjub1hng29nwo', // Protection from Evil (spell), named by Angelic Aspect (Lesser), Holy Aura, Protection From Evil
      'pf1/tj3xdnlwtgk5ecln', // Channel Vigor (spell), named by Channel Vigor (Limbs), Channel Vigor (Torso)
      'pf1/tjog6bufg5b08lvq', // Charm Person (spell), named by Protection From Evil
      'pf1/w2yf0ksu14e91uae', // Threefold Aspect (spell), named by Threefold Aspect (Elderly)
      'pf1/zq7xi7l5vgpqu7rt', // Magic Weapon, Greater (spell), named by Magic Weapon, Greater
      'pf1/zt7cje76dck9hwp9', // Crushing Despair (spell), named by Good Hope
    ],
  },
} as const satisfies Record<string, BuffBatchKeys>;

export type BuffBatch = keyof typeof buffBatches;

/** Every key the buff tests import: each batch's named keys and references, once. */
export function buffKeys() {
  const batches: readonly BuffBatchKeys[] = Object.values(buffBatches);
  return [
    ...new Set(
      batches.flatMap((batch) => [
        ...Object.values(batch.named),
        ...batch.references,
      ]),
    ),
  ];
}
