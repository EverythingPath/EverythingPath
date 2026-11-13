import { useState, type ComponentProps } from 'react';
import { Input } from '~/components/ui/input';

function display(value: unknown) {
  return typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
    ? String(value)
    : '';
}
// Keep transient text such as "0." while the form retains the parsed value.
export function CampaignContextInput({
  value,
  onValueChange,
  numeric,
  numericFormat,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: unknown;
  onValueChange: (value: unknown) => void;
  numeric?: boolean;
  numericFormat?: 'integer' | 'decimal';
}) {
  const [input, setInput] = useState({ source: value, text: display(value) });
  return (
    <Input
      {...props}
      inputMode={numeric ? 'decimal' : undefined}
      value={Object.is(value, input.source) ? input.text : display(value)}
      onChange={(event) => {
        const text = event.target.value;
        const parsed = numeric
          ? text.trim() === ''
            ? null
            : (!numericFormat ||
                  (numericFormat === 'integer'
                    ? /^[+-]?\d+$/
                    : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
                  ).test(text.trim())) &&
                Number.isFinite(Number(text))
              ? Number(text)
              : text
          : text;
        setInput({ source: parsed, text });
        onValueChange(parsed);
      }}
    />
  );
}
