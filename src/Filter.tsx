import type { ChangeEvent, CSSProperties } from "react";

export interface FilterProps {
  className?: string;
  field: string;
  handleFilter: (field: string, value: string) => void;
  placeholder?: string;
  styles?: CSSProperties;
  value: string;
}

export function Filter({ className, field, handleFilter, placeholder = '', styles = {}, value = '' }: FilterProps) {
  return (
    <input
      className="cantal-headercell-filter"
      onChange={(e: ChangeEvent<HTMLInputElement>) => handleFilter(field, e.target.value)}
      placeholder={placeholder}
      style={styles}
      type="search"
      value={value}
    />
  );
}
