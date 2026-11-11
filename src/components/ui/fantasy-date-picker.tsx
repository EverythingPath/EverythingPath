'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  createDateFromFantasyParts,
  fantasyWeekdayHeadersMondayFirst,
  getFantasyDateParts,
  getFantasyMonthsForGregorianYear,
} from '~/helpers/ARDateConverter';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { cn } from '~/lib/utils';

type DisplayMonth = {
  year: number;
  monthIndex: number;
};

export function FantasyDatePicker({
  value,
  onChange,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const selectedDate = parseDateInputValue(value);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [displayMonth, setDisplayMonth] = useState<DisplayMonth>(() =>
    getDisplayMonth(selectedDate ?? new Date()),
  );

  const month = useMemo(
    () => getFantasyMonthsForGregorianYear(displayMonth.year - 2700)[displayMonth.monthIndex],
    [displayMonth],
  );

  const firstDateOfMonth = useMemo(
    () =>
      createDateFromFantasyParts({
        year: displayMonth.year,
        monthIndex: displayMonth.monthIndex,
        day: 1,
      }),
    [displayMonth],
  );
  const firstWeekdayIndex = (firstDateOfMonth.getUTCDay() + 6) % 7;
  const totalDays = month?.days ?? 31;
  const dayCells = useMemo(
    () => buildDayCells(displayMonth, firstWeekdayIndex, totalDays),
    [displayMonth, firstWeekdayIndex, totalDays],
  );

  function openPicker() {
    setDisplayMonth(getDisplayMonth(selectedDate ?? new Date()));
    setIsOpen((current) => !current);
  }

  function shiftMonth(delta: -1 | 1) {
    setDisplayMonth((current) => {
      const nextMonthIndex = current.monthIndex + delta;
      if (nextMonthIndex < 0) {
        return { year: current.year - 1, monthIndex: 11 };
      }
      if (nextMonthIndex > 11) {
        return { year: current.year + 1, monthIndex: 0 };
      }
      return { year: current.year, monthIndex: nextMonthIndex };
    });
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      // Safe cast: pointer events dispatched to the document always target a
      // Node.
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        onClick={openPicker}
        aria-label={ariaLabel}
        className="border-primary bg-card text-foreground hover:bg-card hover:text-foreground focus-visible:bg-card active:bg-card flex h-9 w-full items-center justify-between border-2 px-3 font-mono text-left font-normal shadow-none"
      >
        <span>{selectedDate ? formatPickerValue(selectedDate) : 'Choose in-game date'}</span>
        <Calendar className="h-4 w-4" />
      </Button>
      {isOpen ? (
        <Card className="bg-card border-primary absolute top-full z-50 mt-2 w-[19rem] border-2 p-3 shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <p className="font-sans text-lg font-bold">{month?.name}</p>
                <p className="text-muted-foreground font-mono text-xs">{displayMonth.year}</p>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {fantasyWeekdayHeadersMondayFirst.map((weekday) => (
                <div
                  key={weekday.name}
                  className="text-muted-foreground px-1 py-1 text-center font-mono text-[11px] uppercase"
                >
                  {weekday.nameShort}
                </div>
              ))}
              {dayCells.map((cell) => {
                if (cell.day === null) {
                  return <div key={cell.key} className="h-9" />;
                }
                const day = cell.day;

                return (
                  <Button
                    key={cell.key}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const nextDate = createDateFromFantasyParts({
                        year: displayMonth.year,
                        monthIndex: displayMonth.monthIndex,
                        day,
                      });
                      onChange(nextDate.toISOString().slice(0, 10));
                      setIsOpen(false);
                    }}
                    className={cn(
                      'h-9 border-2 px-0 font-mono text-sm',
                      isSelectedDay({
                        selectedDate,
                        displayMonth,
                        day,
                      })
                        ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border-primary bg-card hover:bg-primary/5',
                    )}
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function parseDateInputValue(value: string) {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDisplayMonth(date: Date): DisplayMonth {
  const parts = getFantasyDateParts(date);
  return { year: parts.year, monthIndex: parts.monthIndex };
}

function isSelectedDay({
  selectedDate,
  displayMonth,
  day,
}: {
  selectedDate: Date | null;
  displayMonth: DisplayMonth;
  day: number;
}) {
  if (!selectedDate) {
    return false;
  }
  const selectedParts = getFantasyDateParts(selectedDate);
  return (
    selectedParts.year === displayMonth.year &&
    selectedParts.monthIndex === displayMonth.monthIndex &&
    selectedParts.day === day
  );
}

function formatPickerValue(date: Date) {
  const parts = getFantasyDateParts(date);
  return `${parts.day} ${parts.month.name} ${parts.year}`;
}

function buildDayCells(
  displayMonth: DisplayMonth,
  firstWeekdayIndex: number,
  totalDays: number,
) {
  const cells: Array<{ key: string; day: number | null }> = [];

  for (let emptyCell = 0; emptyCell < firstWeekdayIndex; emptyCell += 1) {
    cells.push({
      key: `empty-${displayMonth.year}-${displayMonth.monthIndex}-${emptyCell + 1}`,
      day: null,
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({
      key: `${displayMonth.year}-${displayMonth.monthIndex}-${day}`,
      day,
    });
  }

  return cells;
}
