import { Children, isValidElement, type ReactNode } from 'react';

// A test double for `~/components/ui/select`. Radix Select needs pointer
// geometry jsdom lacks; a native select keeps the same value/onValueChange
// contract and takes the trigger's id and accessible name. Use it with
// `vi.mock('~/components/ui/select', () => import('./native-select-test-double'))`.

type Props = { children?: ReactNode; [key: string]: unknown };

export const SelectTrigger = (_: Props) => null;

const text = (node: ReactNode): string =>
  Children.toArray(node)
    .map((child) =>
      typeof child === 'string' || typeof child === 'number'
        ? String(child)
        : isValidElement<Props>(child)
          ? text(child.props.children)
          : '',
    )
    .join('');

function trigger(node: ReactNode): Props | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Props>(child)) continue;
    if (child.type === SelectTrigger) return child.props;
    const nested = trigger(child.props.children);
    if (nested) return nested;
  }
  return null;
}

export function Select({
  value,
  onValueChange,
  disabled,
  children,
}: Props & {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const props = trigger(children);
  return (
    <select
      id={props?.id as string | undefined}
      aria-label={props?.['aria-label'] as string | undefined}
      aria-describedby={props?.['aria-describedby'] as string | undefined}
      className={props?.className as string | undefined}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      <option value="" />
      {children}
    </select>
  );
}
export const SelectValue = () => null;
export const SelectContent = ({ children }: Props) => <>{children}</>;
export const SelectGroup = ({ children }: Props) => <>{children}</>;
export const SelectLabel = () => null;
export const SelectSeparator = () => null;
export const SelectItem = ({
  value,
  disabled,
  children,
}: Props & { value: string; disabled?: boolean }) => (
  <option value={value} disabled={disabled}>
    {text(children)}
  </option>
);
