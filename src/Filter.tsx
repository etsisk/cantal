import type { ChangeEvent, CSSProperties, ReactElement } from "react";

export interface FiltererProps {
  className?: string;
  field: string;
  handleFilter: (field: string, value: string) => void;
  value?: string;
}

interface FilterProps extends FiltererProps {
  placeholder?: string;
  styles?: CSSProperties;
}

export function Filter({
  className,
  field,
  handleFilter,
  placeholder = "",
  styles = {},
  value = "",
}: FilterProps): ReactElement {
  return (
    <input
      className={className}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        handleFilter(field, e.target.value)
      }
      placeholder={placeholder}
      style={styles}
      type="search"
      value={value}
    />
  );
}
