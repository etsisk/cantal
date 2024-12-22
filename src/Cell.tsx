import type { ReactNode } from "react";
import type { ColumnDefWithDefaults, LeafColumn, Position } from "./Grid";

interface CellProps {
  ariaLabel: string;
  children: ReactNode;
  columnDef: ColumnDefWithDefaults | LeafColumn;
  columnIndex: number;
  isFocused: boolean;
  position: Position | undefined;
  rowIndex: number;
  selected: boolean;
}

export function Cell({
  ariaLabel,
  children,
  columnDef,
  columnIndex,
  isFocused,
  position,
  rowIndex,
  selected = false,
}: CellProps) {
  if (position === undefined) {
    console.warn("Column definition not found.");
    return null;
  }
  return (
    <div
      aria-label={ariaLabel}
      className={`cantal-cell-base${isFocused ? " cantal-cell-focused" : ""}${
        columnDef.pinned
          ? ` cantal-cell-pinned-${columnDef.pinned}`
          : selected
            ? " cantal-cell-selected"
            : ""
      }`}
      data-col-idx={columnIndex}
      data-field={columnDef.field}
      data-row-idx={rowIndex}
      role="gridcell"
      style={{
        gridColumnStart: position.pinnedIndex,
        gridColumnEnd: position.pinnedIndexEnd,
      }}
    >
      {children}
    </div>
  );
}
