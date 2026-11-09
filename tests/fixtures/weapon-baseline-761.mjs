// Independent expectation producer. Reads pinned YAML and PCGen; never imports
// the importer, its rules, release adapter, or a generated preview.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const fixture = new URL('./weapon-baseline-761.json', import.meta.url);
const read = (url) => readFileSync(url, 'utf8');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const metadata = JSON.parse(read(fixture));
const pcgenRoot = new URL(
  './pinned/pcgen/data/pathfinder/paizo/',
  import.meta.url,
);

function comparison(row) {
  const locator = row.contracts.find(
    (id) =>
      id.startsWith('rule/pcgen/') && id.includes('equip_arms_armor.lst:'),
  );
  if (!locator) return {};
  const [path, line] = locator.slice('rule/pcgen/'.length).split(':');
  const source = read(new URL(path, pcgenRoot)).split('\n')[Number(line) - 1];
  if (!source) throw new Error(`Missing comparison ${locator}`);
  return Object.fromEntries(
    source
      .split('\t')
      .filter(Boolean)
      .slice(1)
      .map((tag) => {
        const colon = tag.indexOf(':');
        return [tag.slice(0, colon), tag.slice(colon + 1)];
      }),
  );
}

export function buildWeaponBaseline() {
  return metadata.map(({ key, source, sha256, contracts }) => {
    const bytes = readFileSync(
      new URL(`./pinned/pf1/${source}`, import.meta.url),
    );
    if (hash(bytes) !== sha256) throw new Error(`Source changed: ${key}`);
    const native = parse(bytes.toString());
    const s = native.system;
    const pcgen = comparison({ contracts });
    const expected = {
      kind: 'item',
      consumable: false,
      price: s.price ?? 0,
      weight: s.weight?.value ?? 0,
    };
    const result = { key, source, sha256, contracts, expected };
    if (s.enh !== undefined)
      expected.magic = {
        enhancement: s.enh,
        masterwork: s.masterwork === true,
      };
    if (native.type === 'loot') {
      expected.ammunition = true;
      return result;
    }
    const action = s.actions[0];
    const part = action.damage?.parts?.[0];
    const die = /sizeRoll\((\d+), (\d+), @size\)/.exec(part?.formula ?? '');
    const ability = action.ability ?? {};
    const baseType = s.baseTypes[0];
    const ranged = s.weaponSubtype === 'ranged';
    const composite = s.tags?.includes('Composite');
    const bow = composite || ['Shortbow', 'Longbow'].includes(baseType);
    const crossbow = /crossbow/i.test(baseType);
    const sling = /sling/i.test(baseType);
    const thrown =
      s.actions.some((a) => a.actionType === 'twak') ||
      (key === 'pf1/7zvBqNNlc5i5EtFd' && pcgen.TYPE.includes('Thrown'));
    // Native melee grip is authoritative for the ordinary Medium weapon. CRB
    // Dart/Shuriken/Hand Crossbow WIELD:Light fills an absent ranged grip.
    let grip =
      { '1h': 'oneHanded', '2h': 'twoHanded' }[s.weaponSubtype] ?? 'light';
    if (ranged) grip = s.hands === 2 ? 'twoHanded' : 'oneHanded';
    if (ranged && pcgen.WIELD === 'Light') grip = 'light';
    if (pcgen.WIELD === 'TwoHandsOnly') grip = 'twoHanded';
    // Sling Staff prose explicitly distinguishes firing and loading. SIZE:S
    // is why PCGen has 1d6; native Medium sizeRoll(1,8) stays 1d8.
    if (baseType === 'Halfling Sling Staff') {
      if (
        pcgen.SIZE !== 'S' ||
        pcgen.WIELD !== 'OneHandOnly' ||
        !s.description.unidentified.includes('fire, but not load')
      )
        throw new Error('Sling Staff source contract changed');
      grip = 'oneHanded';
    }
    const weapon = {
      baseType,
      proficiency: s.proficient === true ? 'always' : (s.subType ?? 'simple'),
      groups: s.weaponGroups ?? [],
      handedness: grip,
      attackType: ranged ? 'ranged' : 'melee',
      damageTypes: part?.types ?? [],
      finesse: s.properties?.fin === true,
      monk: s.properties?.mnk === true,
      thrown: thrown && !sling,
    };
    expected.weapon = weapon;
    if (die) {
      weapon.dice = `${die[1]}d${die[2]}`;
      if (
        ability.critRange !== null &&
        ability.critRange !== 0 &&
        pcgen.CRITMULT !== '-'
      )
        weapon.threat = ability.critRange ?? 20;
      if (pcgen.CRITMULT !== '-') weapon.mult = ability.critMult ?? 2;
    } else {
      if (typeof ability.critRange === 'number' && ability.critRange > 0)
        weapon.threat = ability.critRange;
      if (typeof ability.critMult === 'number') weapon.mult = ability.critMult;
    }
    if (!ranged) weapon.strengthDamage = 'melee';
    else if (sling) weapon.strengthDamage = 'sling';
    else if (crossbow) weapon.strengthDamage = 'crossbow';
    else if (bow) weapon.strengthDamage = composite ? 'compositeBow' : 'bow';
    else if (thrown) weapon.strengthDamage = 'thrown';
    if (composite) weapon.strengthRating = ability.max ?? 0;
    const range = s.actions.find((a) => a.range?.units === 'ft');
    if ((ranged || thrown) && Number(range?.range.value) > 0)
      weapon[ranged ? 'rangeIncrement' : 'thrownRangeIncrement'] = Number(
        range.range.value,
      );
    if (key === 'pf1/7zvBqNNlc5i5EtFd')
      weapon.thrownRangeIncrement = Number(pcgen.RANGE);
    if (sling) weapon.reload = 'move';
    if (bow) weapon.reload = 'free';
    if (crossbow && !baseType.includes('Double'))
      weapon.reload = baseType.includes('Repeating')
        ? 'free'
        : baseType.includes('Heavy')
          ? 'fullRound'
          : 'move';
    if (baseType === 'Blowgun') weapon.unresolved = ['strengthDamage'];
    if (baseType === 'Double Crossbow') weapon.unresolved = ['reload'];
    if (key === 'pf1/J0zfGICU57qryKxj') weapon.unresolved = ['criticalEffects'];
    if (weapon.unresolved)
      result.candidateRefusal = `unresolved ${weapon.unresolved.join(', ')}`;
    return result;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bytes =
    '[\n' +
    buildWeaponBaseline()
      .map((row) => '  ' + JSON.stringify(row))
      .join(',\n') +
    '\n]\n';
  if (process.argv.includes('--write')) writeFileSync(fixture, bytes);
  else if (read(fixture) !== bytes)
    throw new Error(
      'Weapon expectations differ; inspect source decisions before --write',
    );
  console.log(
    `Source-derived expectations: ${metadata.length} records; ${hash(bytes)}`,
  );
}
