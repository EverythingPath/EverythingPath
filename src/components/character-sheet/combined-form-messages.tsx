'use client';
import { Info, TriangleAlert } from 'lucide-react';
import { cn } from '~/lib/utils';

/**
 * Lines about the Combined Form that are never warnings to accept: why a
 * value cannot be stated (muted, informational), or a rule the two builds
 * break (amber, advisory).
 */
export function CombinedFormMessages({
  messages,
  tone = 'info',
  className,
}: {
  messages: readonly string[];
  tone?: 'info' | 'advisory';
  className?: string;
}) {
  if (messages.length === 0) return null;
  const Icon = tone === 'advisory' ? TriangleAlert : Info;
  return (
    <ul className={cn('flex flex-col gap-1', className)}>
      {messages.map((message) => (
        <li
          key={message}
          className={cn(
            'flex items-start gap-1.5 text-xs [overflow-wrap:anywhere]',
            tone === 'advisory' ? 'text-amber-300' : 'text-muted-foreground',
          )}
        >
          <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
          <span className="min-w-0">{message}</span>
        </li>
      ))}
    </ul>
  );
}
