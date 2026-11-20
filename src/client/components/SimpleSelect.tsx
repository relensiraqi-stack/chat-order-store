import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";

/** A select over a short list of labelled values. */
export function SimpleSelect({
  items,
  value,
  onChange,
  label,
  testId,
  className,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  testId?: string;
  className?: string;
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v !== null && onChange(String(v))}>
      <SelectTrigger aria-label={label} data-testid={testId} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
