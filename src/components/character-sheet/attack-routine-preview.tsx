'use client';
import { useId, type ReactNode } from 'react';
import type { RequestedSituation } from '~/lib/character-sheet-situations';
import { AttackFlurryLine } from './attack-line';
import { AttackRateNotes } from './attack-rate-notes';
import { AttackWarningParagraph } from './attack-warning-paragraph';
import { useBreakdownResolver } from './breakdown-resolver';
import { describeExtraDice, sortExtraDamage } from './extra-damage';
import { fieldLabel } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Row = ReturnType<typeof useCharacterSheet>['attacks']['rows'][number];
type Line = Row['singleView'][number];

const describeHand = (line: Line) =>
  line.endLabel
    ? `${line.roleLabel ?? line.positionLabel}, ${line.endLabel.toLowerCase()}`
    : (line.roleLabel ?? line.positionLabel);
/**
 * "1d8+3 plus 1d6 fire/19–20/×2": the damage with its always-on and
 * previewed Item Ability dice, the critical and the range; burst dice read
 * apart as a note on the critical hit.
 */
function describeHit(line: Line, selections: readonly RequestedSituation[]) {
  const dice = sortExtraDamage(line.extraDamage, selections);
  const plus = dice.hit
    .map(({ part }) => ` plus ${describeExtraDice(part)}`)
    .join('');
  return {
    text: `${line.damage.text}${plus}/${line.critical.text}${line.range ? `, ${line.range.text}` : ''}`,
    critical: dice.critical.map(({ part }) => part.text).join(', ') || null,
  };
}

/** The rules marking a line: its extra attack, its arrows, its Vital Strike. */
const describeTags = (line: Line) =>
  [
    line.extraAttack?.label ?? null,
    line.projectilesLabel,
    line.vitalStrike?.label ?? null,
  ].filter((tag) => tag !== null);

/**
 * Runs of attacks that differ only in their bonus, in the resolver's order:
 * "+6/+1 (1d8+3/19–20/×2)". Each run keeps its own weapon, damage and
 * critical, so an off hand, a double weapon's other end or a natural attack
 * reads separately, named with its hand or its primary or secondary role,
 * and a line a rule marks (Haste, 2 arrows, Vital Strike) reads on its own
 * with the rule's name after it.
 */
function summarize(lines: Line[], selections: readonly RequestedSituation[]) {
  const runs: { key: string; first: Line; lines: Line[] }[] = [];
  for (const line of lines) {
    const hit = describeHit(line, selections);
    const key = [
      line.hand,
      line.end,
      line.weaponName,
      line.mode,
      line.roleLabel ?? line.positionLabel,
      line.damageKindLabel,
      hit.text,
      hit.critical,
      ...describeTags(line),
    ].join('|');
    const last = runs.at(-1);
    if (last?.key === key) last.lines.push(line);
    else runs.push({ key, first: line, lines: [line] });
  }
  const isLeadShown = lines.some(
    (line) => line.hand === 'off' || line.attackKind === 'natural',
  );
  return runs.map(({ first, lines: run }, index) => {
    const bonuses = run.map((line) => line.attack.text).join('/');
    const hit = describeHit(first, selections);
    return {
      key: `${index}:${first.hand}:${first.end}`,
      lead: isLeadShown ? `${describeHand(first)}: ${first.weaponName}` : null,
      text: `${bonuses} (${hit.text})`,
      critical: hit.critical,
      damageKind: first.damageKindLabel,
      tags: describeTags(first),
    };
  });
}

function Sequence({
  title,
  lines,
  lead,
}: {
  title: string;
  lines: Line[];
  /** What heads the runs: a flurry of blows' own line. */
  lead?: ReactNode;
}) {
  const resolver = useBreakdownResolver();
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground">{title}</dt>
      <dd className="min-w-0 flex-1 basis-40 space-y-0.5">
        {lead}
        {summarize(lines, resolver.selected.selections).map((run) => (
          <span key={run.key} className="block [overflow-wrap:anywhere]">
            {run.lead ? (
              <span className="text-muted-foreground">{run.lead} </span>
            ) : null}
            <span className="font-mono">{run.text}</span>
            {run.critical ? (
              <span className="text-muted-foreground"> ({run.critical})</span>
            ) : null}
            {run.damageKind ? (
              <span className="text-muted-foreground"> {run.damageKind}</span>
            ) : null}
            {run.tags.length > 0 ? (
              <span className="text-muted-foreground">
                {' '}
                {run.tags.join(', ')}
              </span>
            ) : null}
          </span>
        ))}
      </dd>
    </div>
  );
}

/** The Rend after the full attack, as the lines read: "1d10+6 Once per round, when both hands hit." */
function RendSummary({ rend }: { rend: NonNullable<Row['rendView']> }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground">{rend.label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">
        <span className="font-mono">{rend.text}</span>
        <span className="text-muted-foreground"> {rend.note}</span>
      </dd>
    </div>
  );
}

/**
 * The saved routine as the sheet calculates it, kept until the next result
 * arrives, with its Two-Weapon Rend, the resolver's reload and throw-rate
 * notes and its warnings. The option notes read in the Options field above.
 * A full attack shaped by a flurry of blows (#414) is headed by the same
 * flurry line as the card.
 */
export function AttackRoutinePreview({ row }: { row: Row }) {
  const id = useId();
  const flurry = row.flurry;
  return (
    <section
      aria-labelledby={id}
      className="border-foreground/15 space-y-1 border-t pt-3"
    >
      <h3 id={id} className={fieldLabel}>
        As it attacks now
      </h3>
      {row.singleView.length > 0 ? (
        <dl className="space-y-0.5 text-sm">
          <Sequence title="Single attack" lines={row.singleView} />
          <Sequence
            title={flurry ? `Full attack · ${flurry.name}` : 'Full attack'}
            lines={row.fullView}
            lead={
              flurry ? (
                <AttackFlurryLine
                  flurry={flurry}
                  routineName={row.name}
                  entryId={row.entryId}
                />
              ) : null
            }
          />
          {row.rendView ? <RendSummary rend={row.rendView} /> : null}
        </dl>
      ) : null}
      {row.twoWeaponPenaltySummary ? (
        <p className="text-muted-foreground text-xs">
          {row.twoWeaponPenaltySummary}
        </p>
      ) : null}
      <AttackRateNotes notes={row.attackRateNotes} label="Attack rate" />
      {row.warnings.map((warning) => (
        <AttackWarningParagraph
          key={`${warning.check}:${warning.subject}`}
          warning={warning}
        />
      ))}
    </section>
  );
}
