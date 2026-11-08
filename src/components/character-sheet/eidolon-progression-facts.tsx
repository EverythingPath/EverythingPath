'use client';
import type { EidolonProgressionView } from './character-eidolon-progression-view-model';
import { FactList, type Fact } from './companion-progression-facts';
import { EidolonLevelReduction } from './eidolon-level-reduction';
import { chip, fieldLabel, formatModifier } from './sheet-parts';

type Projection = EidolonProgressionView['ordinary'];
type Brood = NonNullable<Projection['brood']>;

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';

/** A brood eidolon's allocated share of one component, or Unresolved. */
function broodShare(brood: Brood, key: Brood['components'][number]['key']) {
  return brood.components.find((item) => item.key === key)?.value ?? null;
}

/**
 * The eidolon's numbers as the sheet calculates them for the chosen
 * projection: its summoner level, actual Hit Dice and own Class Levels kept
 * apart, the totals they give with the armor bonus split, then the budgets
 * and the features the table grants. A null value reads Unresolved. A
 * Broodmaster eidolon (#419) reads its Strength and Dexterity bonuses as
 * separate allocated shares, and its notes say which numbers are shares of
 * the brood's budget and which still read the whole summoner level.
 */
export function EidolonProgressionFacts({
  projection,
}: {
  projection: Projection;
}) {
  const { armor, brood, reduction } = projection;
  // A reduced progression keeps the actual summoner level and the level the
  // eidolon table is read at apart; otherwise they are one value.
  const levelFacts: Fact[] = reduction
    ? [
        { label: 'Summoner level', value: reduction.summonerLevel },
        { label: 'Eidolon table level', value: reduction.tableLevel },
      ]
    : [{ label: 'Summoner level', value: projection.summonerLevel }];
  const abilityFacts: Fact[] = brood
    ? [
        {
          label: 'Strength bonus',
          value: broodShare(brood, 'strengthBonus'),
          isSigned: true,
        },
        {
          label: 'Dexterity bonus',
          value: broodShare(brood, 'dexterityBonus'),
          isSigned: true,
        },
      ]
    : [
        {
          label: 'Strength and Dexterity bonus',
          value: projection.strengthDexterityBonus,
          isSigned: true,
        },
      ];
  return (
    <div className="flex flex-col gap-3">
      <FactList
        label="Progression"
        facts={[
          ...levelFacts,
          { label: 'Actual Hit Dice', value: projection.actualHitDice },
          { label: 'Class Levels', value: projection.classLevels },
          { label: 'Maximum HP', value: projection.hp },
        ]}
      />
      {reduction ? <EidolonLevelReduction reduction={reduction} /> : null}
      {brood ? (
        <p className={note}>
          The summoner level comes from the supporting source below and is never
          counted as Class Levels. Hit Dice, the evolution pool and budgets are
          this eidolon’s allocated shares of the brood’s budget.
        </p>
      ) : reduction ? (
        <p className={note}>
          The summoner level comes from the supporting source below and is
          reduced as shown before the eidolon table is read. The eidolon table
          level sets Hit Dice, the evolution pool, budgets and everything else
          gained by summoner level, and is never counted as Class Levels.
        </p>
      ) : (
        <p className={note}>
          The summoner level comes from the supporting source below. It sets Hit
          Dice, the evolution pool and budgets, and is never counted as Class
          Levels.
        </p>
      )}
      <FactList
        label="Base results"
        facts={[
          { label: 'Base attack bonus', value: projection.bab, isSigned: true },
          {
            label: 'Fortitude',
            value: projection.saves.fortitude,
            isSigned: true,
          },
          { label: 'Reflex', value: projection.saves.reflex, isSigned: true },
          { label: 'Will', value: projection.saves.will, isSigned: true },
          { label: 'Armor bonus', value: armor.total, isSigned: true },
          ...abilityFacts,
        ]}
      />
      {brood ? (
        <p className={note}>
          Base attack bonus and saves: whole summoner level, shared by the
          brood. Armor, Strength and Dexterity bonuses are allocated shares.
        </p>
      ) : null}
      {armor.total !== null &&
      armor.armor !== null &&
      armor.natural !== null ? (
        <p className={note}>
          {`Armor bonus ${formatModifier(armor.total)}: ${armor.armor} as armor, ${armor.natural} natural armor, including the base form’s +2 and evolution increases.`}
        </p>
      ) : null}
      <FactList
        label="Budgets"
        facts={[
          { label: 'General feats', value: projection.budgets.generalFeats },
          { label: 'Skill ranks', value: projection.budgets.skillRanks },
          {
            label: 'Ability increases',
            value: projection.budgets.abilityIncreases,
          },
          { label: 'Max attacks', value: projection.budgets.maxAttacks },
        ]}
      />
      {brood ? (
        <p className={note}>
          General feats, skill ranks and max attacks are allocated from the
          brood; ability increases follow the eidolon’s Hit Dice.
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <span className={fieldLabel}>Features</span>
        {projection.features.length > 0 ? (
          <ul aria-label="Features" className="flex flex-wrap gap-1">
            {projection.features.map((feature) => (
              <li key={feature} className={chip}>
                {feature}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            {projection.summonerLevel === null ? 'Unresolved' : 'None'}
          </p>
        )}
      </div>
    </div>
  );
}
