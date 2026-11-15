'use client';
import { useState } from 'react';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { normalizeMaterial } from '~/lib/character-sheet-items';
import { cn } from '~/lib/utils';

// CRB pp. 154–155: the special materials the sheet applies. Anything else is
// kept as the words entered and changes no number.
const materials = [
  { value: 'adamantine', label: 'Adamantine' },
  { value: 'alchemical silver', label: 'Alchemical silver' },
  { value: 'cold iron', label: 'Cold iron' },
  { value: 'darkwood', label: 'Darkwood' },
  { value: 'dragonhide', label: 'Dragonhide' },
  { value: 'mithral', label: 'Mithral' },
] as const;
const none = 'none';
const other = 'other';

/**
 * An item part's material: none, one of the special materials the sheet
 * applies, or Other… with free text kept as entered. Choosing saves at once
 * through `onChange`, like the fields beside it.
 */
export function MaterialSelect({
  label,
  value,
  isDisabled,
  describedBy,
  onChange,
}: {
  /** The select's name; its free text reads "<label>, other". */
  label: string;
  value: string;
  isDisabled: boolean;
  describedBy?: string;
  onChange: (material: string) => void;
}) {
  const [isOther, setIsOther] = useState(false);
  const known = materials.find(
    (material) =>
      normalizeMaterial(material.value) === normalizeMaterial(value),
  );
  const selected = isOther
    ? other
    : value.trim() === ''
      ? none
      : (known?.value ?? other);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Select
        value={selected}
        disabled={isDisabled}
        onValueChange={(next) => {
          if (next === other) {
            setIsOther(true);
            return;
          }
          setIsOther(false);
          onChange(next === none ? '' : next);
        }}
      >
        <SelectTrigger
          aria-label={label}
          aria-describedby={describedBy}
          className="h-11 w-full max-w-56 rounded-none font-mono text-sm md:h-8 md:py-1"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={none}>None</SelectItem>
          {materials.map((material) => (
            <SelectItem key={material.value} value={material.value}>
              {material.label}
            </SelectItem>
          ))}
          <SelectItem value={other}>Other…</SelectItem>
        </SelectContent>
      </Select>
      {selected === other ? (
        <Input
          type="text"
          autoComplete="off"
          aria-label={`${label}, other`}
          placeholder="Material"
          value={value}
          disabled={isDisabled}
          aria-describedby={describedBy}
          className={cn('h-11 w-full max-w-56 md:h-8')}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </div>
  );
}
