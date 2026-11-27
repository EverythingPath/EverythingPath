import { launchOwner } from './launch-inventory-coverage.ts';

export const classSources: Record<
  string,
  { path: string; caption: string; books: string[] }
> = {};
for (const name of [
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
])
  classSources[name] = {
    path: `pages/coreRulebook/classes/${name.toLowerCase()}.html`,
    caption: name,
    books: ['PZO1110', 'PZO1115'],
  };
for (const name of [
  'Alchemist',
  'Cavalier',
  'Inquisitor',
  'Oracle',
  'Summoner',
  'Witch',
])
  classSources[name] = {
    path: `pages/advancedPlayersGuide/baseClasses/${name.toLowerCase()}.html`,
    caption: name,
    books: ['PZO1110', 'PZO1115'],
  };
for (const name of ['Bloodrager', 'Slayer'])
  classSources[name] = {
    path: `pages/advancedClassGuide/classes/${name.toLowerCase()}.html`,
    caption: name,
    books: ['PZO1110', 'PZO1115', 'PZO1129'],
  };
classSources.Magus = {
  path: 'pages/ultimateMagic/spellcasters/magus.html',
  caption: 'Magus',
  books: ['PZO1110', 'PZO1115', 'PZO1117'],
};
classSources['Monk (Unchained)'] = {
  path: 'pages/unchained/classes/monk.html',
  caption: 'Unchained Monk',
  books: ['PZO1131'],
};

export function classScheduleOwner(name: string) {
  const issue = ['Cleric', 'Sorcerer', 'Oracle', 'Witch'].includes(name)
    ? 771
    : ['Inquisitor', 'Magus'].includes(name)
      ? 772
      : 716;
  return launchOwner(issue, `Source-backed ${name} level schedule`, [
    'scripts/catalog/pcgen/schedules.ts',
    `#${issue}`,
  ]);
}
