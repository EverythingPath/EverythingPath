'use client';
import { Check } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { UpkeepRankBoon, UpkeepRankGain, UpkeepSections } from './types';
import { upkeepStepAnchor } from './source-anchors';
import { IssueNotes, ReasonedDecision, Step } from './upkeep-parts';
import {
  boonDescription,
  chooseBoonFeat,
  clearBoon,
  recordBoon,
} from './upkeep-rank';

// Step 4. The header carries the rank transition; under it the training
// sentence, then one block per rank gained this week with a compact row per
// PC: the name beside the feat cards of a fixed title, or an outcome editor
// for open boons. Everything shown comes from the rank facts.

type Edit = (edit: WeeklyDraftEdit) => unknown;

function rankEffect(rank: UpkeepSections['rank']) {
  if (rank.status === 'waiting') return 'Waiting for the steps above';
  if (rank.after === null) return 'Highest player-character level needed';
  if (rank.after === rank.before) return `Stays rank ${rank.before}`;
  return `Rank ${rank.before} → ${rank.after}`;
}

// The training judged against Table 6-1: the rank it reaches, the PC-level
// cap that holds it back, or the next threshold ahead.
function trainingLine({
  training,
  before,
  after,
  next,
  capped,
}: UpkeepSections['rank']) {
  if (training === null || after === null) return null;
  if (capped && capped.trainingRank > after)
    return `Training ${training} reaches rank ${capped.trainingRank}, but the highest player-character level (${capped.highestPcLevel}) holds the militia at rank ${after}.`;
  if (capped && next)
    return `Training ${training}. Rank ${next.rank} needs ${next.minimumTraining} training and a level ${next.rank} player character; the highest is level ${capped.highestPcLevel}.`;
  if (after > before)
    return `Training ${training} reaches rank ${after}.${next ? ` Rank ${next.rank} needs ${next.minimumTraining}.` : ''}`;
  if (next)
    return `Training ${training} of the ${next.minimumTraining} that rank ${next.rank} needs.`;
  return `Training ${training}. Rank ${after} is the highest rank.`;
}

export function Rank({
  rank,
  edit,
  disabled,
}: {
  rank: UpkeepSections['rank'];
  edit: Edit;
  disabled: boolean;
}) {
  const training = trainingLine(rank);
  return (
    <Step
      number={4}
      title="Rank"
      anchor={upkeepStepAnchor('rank')}
      status={rank.status}
      effect={rankEffect(rank)}
    >
      {rank.status === 'waiting' && (
        <p className="text-muted-foreground text-sm">
          Rank is worked out once every roll and decision above is in.
        </p>
      )}
      {training && <p className="text-muted-foreground text-sm">{training}</p>}
      {rank.gains.map((gain) => (
        <Gain key={gain.rank} gain={gain} edit={edit} disabled={disabled} />
      ))}
      <IssueNotes issues={rank.issues} />
    </Step>
  );
}

function Gain({
  gain,
  edit,
  disabled,
}: {
  gain: UpkeepRankGain;
  edit: Edit;
  disabled: boolean;
}) {
  return (
    <section aria-label={`Rank ${gain.rank} boon`} className="space-y-3">
      <div className="space-y-0.5">
        <h4 className="text-sm font-semibold">
          Rank {gain.rank}{' '}
          <span className="text-muted-foreground font-normal">
            · training {gain.minimumTraining}
          </span>
        </h4>
        <p className="text-sm">{boonDescription(gain.reward)}</p>
      </div>
      {gain.boons.map((boon) =>
        boon.feats ? (
          <FeatRow
            key={boon.subjectId}
            rank={gain.rank}
            boon={boon}
            feats={boon.feats}
            edit={edit}
            disabled={disabled}
          />
        ) : (
          <OutcomeEditor
            key={boon.subjectId}
            boon={boon}
            label={`${boon.name} boon outcome`}
            edit={edit}
            disabled={disabled}
          />
        ),
      )}
    </section>
  );
}

// One PC and the feat cards of the title: the name beside the cards, above
// them on a phone. Tapping the chosen card clears it again.
function FeatRow({
  rank,
  boon,
  feats,
  edit,
  disabled,
}: {
  rank: number;
  boon: UpkeepRankBoon;
  feats: NonNullable<UpkeepRankBoon['feats']>;
  edit: Edit;
  disabled: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={`${boon.name} rank ${rank} feat`}
      className="space-y-2"
    >
      <div className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
        <p className="min-w-0 text-sm [overflow-wrap:anywhere]">{boon.name}</p>
        <div className="flex flex-wrap gap-2">
          {feats.options.map((feat) => {
            const selected = feat === feats.selected;
            return (
              // Hover only lifts and tints the border, never the fill, so it
              // cannot resemble the chosen card.
              <Button
                key={feat}
                type="button"
                variant="outline"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => {
                  const e = chooseBoonFeat(boon, feat);
                  if (e) edit(e);
                }}
                className="hover:border-primary/60 aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:hover:border-primary aria-pressed:hover:bg-primary/15 hover:bg-background hover:text-foreground h-auto min-h-11 min-w-0 flex-1 basis-40 justify-start gap-2 rounded-lg border-2 px-3 py-2 text-left whitespace-normal transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 motion-reduce:transform-none"
              >
                {selected && <Check aria-hidden className="size-4 shrink-0" />}
                <span className="min-w-0 [overflow-wrap:anywhere]">{feat}</span>
              </Button>
            );
          })}
        </div>
      </div>
      {boon.required && (
        <p className="text-muted-foreground text-xs sm:pl-[calc(9rem+1rem)]">
          Choose a feat for {boon.name}.
        </p>
      )}
    </div>
  );
}

// The free-text outcome of an open boon (Skilled, Gift, XP, Champion).
function OutcomeEditor({
  boon,
  label,
  edit,
  disabled,
}: {
  boon: UpkeepRankBoon;
  label: string;
  edit: Edit;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1">
      {boon.required && (
        <p className="text-muted-foreground text-xs">
          Record the outcome for {boon.name}.
        </p>
      )}
      <ReasonedDecision
        label={label}
        current={boon.outcome ?? ''}
        disabled={disabled}
        submitLabel="Record outcome"
        clearLabel="Clear outcome"
        requiredMessage="Enter the boon outcome."
        onSave={(outcome) => edit(recordBoon(boon, outcome))}
        onClear={() => {
          const e = clearBoon(boon);
          if (e) edit(e);
        }}
      />
    </div>
  );
}
