import type { ReactNode } from "react";
import type { ColumnDefWithDefaults, LeafColumn, Position } from "./Grid";

interface CellProps {
  children: ReactNode;
  columnDef: ColumnDefWithDefaults | LeafColumn;
  columnIndex: number;
  isFocused: boolean;
  position: Position;
  rowIndex: number;
}

export function Cell({
  children,
  columnDef,
  columnIndex,
  isFocused,
  position,
  rowIndex,
}: CellProps) {
  return (
    <div
      aria-label={
        typeof columnDef.ariaCellLabel === "function"
          ? columnDef.ariaCellLabel({ def: columnDef, position })
          : columnDef.ariaCellLabel
      }
      className={`cantal-cell-base${isFocused ? " cantal-cell-focused" : ""}${
        columnDef.pinned ? ` cantal-cell-pinned-${columnDef.pinned}` : ""
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
