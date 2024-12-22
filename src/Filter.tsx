import type { ChangeEvent, CSSProperties } from "react";

export interface FiltererProps {
  field: string;
  handleFilter: (field: string, value: string) => void;
  value?: string;
}

interface FilterProps extends FiltererProps {
  className?: string;
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
}: FilterProps) {
  return (
    <input
      className="cantal-headercell-filter"
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
