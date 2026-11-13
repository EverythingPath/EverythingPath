type Team = {
  id: string;
  name: string;
  type: string;
  tier: number;
  size: number;
  recruitment?: { check: string; dc: number };
  grantedActions: string[];
  upgrade?: { to: string[]; cost: number };
};

const teams: Team[] = [
  {
    id: 'moles',
    name: 'Moles',
    type: 'Espionage',
    tier: 1,
    size: 3,
    recruitment: { check: 'Secrecy', dc: 15 },
    grantedActions: ['secureCache'],
    upgrade: { to: ['propagandists'], cost: 250 },
  },
  {
    id: 'propagandists',
    name: 'Propagandists',
    type: 'Espionage',
    tier: 2,
    size: 3,
    upgrade: { to: ['saboteurs', 'spies'], cost: 1000 },
    grantedActions: ['secureCache', 'spreadPropaganda'],
  },
  {
    id: 'saboteurs',
    name: 'Saboteurs',
    type: 'Espionage',
    tier: 3,
    size: 3,
    grantedActions: ['sabotage', 'secureCache', 'spreadPropaganda'],
  },
  {
    id: 'spies',
    name: 'Spies',
    type: 'Espionage',
    tier: 3,
    size: 3,
    grantedActions: ['covertAction', 'secureCache', 'spreadPropaganda'],
  },
  {
    id: 'informants',
    name: 'Informants',
    type: 'Intelligence',
    tier: 1,
    size: 6,
    recruitment: { check: 'Loyalty', dc: 10 },
    grantedActions: ['gatherInformation'],
    upgrade: { to: ['conspirators'], cost: 250 },
  },
  {
    id: 'conspirators',
    name: 'Conspirators',
    type: 'Intelligence',
    tier: 2,
    size: 6,
    upgrade: { to: ['scholars', 'spellcasters'], cost: 1000 },
    grantedActions: ['activateRefuge', 'gatherInformation'],
  },
  {
    id: 'scholars',
    name: 'Scholars',
    type: 'Intelligence',
    tier: 3,
    size: 6,
    grantedActions: ['activateRefuge', 'gatherInformation', 'knowledgeCheck'],
  },
  {
    id: 'spellcasters',
    name: 'Spellcasters',
    type: 'Intelligence',
    tier: 3,
    size: 6,
    grantedActions: ['activateRefuge', 'gatherInformation', 'restoreCharacter'],
  },
  {
    id: 'defenders',
    name: 'Defenders',
    type: 'Military',
    tier: 1,
    size: 6,
    recruitment: { check: 'Security', dc: 15 },
    grantedActions: ['reduceDanger'],
    upgrade: { to: ['infiltrators'], cost: 250 },
  },
  {
    id: 'infiltrators',
    name: 'Infiltrators',
    type: 'Military',
    tier: 2,
    size: 6,
    upgrade: { to: ['guardians', 'specialists'], cost: 1000 },
    grantedActions: ['reduceDanger', 'rescueCharacter'],
  },
  {
    id: 'guardians',
    name: 'Guardians',
    type: 'Military',
    tier: 3,
    size: 6,
    grantedActions: ['manipulateEvents', 'reduceDanger', 'rescueCharacter'],
  },
  {
    id: 'specialists',
    name: 'Specialists',
    type: 'Military',
    tier: 3,
    size: 6,
    grantedActions: ['reduceDanger', 'rescueCharacter', 'strikeTeam'],
  },
  {
    id: 'patrons',
    name: 'Patrons',
    type: 'Treasury',
    tier: 1,
    size: 6,
    recruitment: { check: 'Loyalty', dc: 10 },
    grantedActions: ['earnGold'],
    upgrade: { to: ['merchants'], cost: 50 },
  },
  {
    id: 'merchants',
    name: 'Merchants',
    type: 'Treasury',
    tier: 2,
    size: 6,
    upgrade: { to: ['blackMarketeers', 'fixers'], cost: 200 },
    grantedActions: ['brokerMarket', 'earnGold'],
  },
  {
    id: 'blackMarketeers',
    name: 'Black Marketeers',
    type: 'Treasury',
    tier: 3,
    size: 6,
    grantedActions: ['activateBlackMarket', 'brokerMarket', 'earnGold'],
  },
  {
    id: 'fixers',
    name: 'Fixers',
    type: 'Treasury',
    tier: 3,
    size: 6,
    grantedActions: ['brokerMarket', 'earnGold', 'specialOrder'],
  },
];
export default teams;
