import source from './accepted-campaign.json';
import { militiaSnapshotSchema } from '../../src/lib/canonical-weekly-source';
import { militiaSetupSchema } from '../../src/lib/canonical-setup';

// Synthetic accepted week retained from the cutover rehearsal. It exercises
// the supported setup path without rebuilding retired database storage.
export function acceptedCampaignSetup(characterId: string) {
  const snapshot = militiaSnapshotSchema.parse(source.snapshot);
  snapshot.characters = snapshot.characters.map((person) => ({
    ...person,
    characterId,
  }));
  snapshot.roster.people = snapshot.roster.people.map((person) => ({
    ...person,
    characterId,
  }));
  snapshot.roster.officers = snapshot.roster.officers.map((officer) => ({
    ...officer,
    characterId,
  }));
  snapshot.roster.teams = snapshot.roster.teams.map((team) => ({
    ...team,
    managerCharacterId: characterId,
  }));
  return militiaSetupSchema.parse({
    mode: 'existing',
    phase: 'upkeep',
    notes: 'Accepted mid-campaign state',
    state: { week: 9, militiaSnapshot: snapshot, context: source.context },
  });
}
