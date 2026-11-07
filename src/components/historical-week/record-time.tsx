import type { RecordDate } from './finished-weeks-types';

export function RecordTime({
  date,
  className,
}: {
  date: RecordDate;
  className?: string;
}) {
  return (
    <time dateTime={date.dateTime} className={className}>
      {date.label}
    </time>
  );
}
