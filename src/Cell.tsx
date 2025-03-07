import type { ReactNode } from "react";
import type { ColumnDefWithDefaults, LeafColumn, Position } from "./Grid";

interface CellProps {
  allowEditCellOverflow: boolean;
  ariaLabel: string;
  children: ReactNode;
  columnDef: ColumnDefWithDefaults | LeafColumn;
  columnIndex: number;
  columnIndexRelative: number;
  endColumnIndex: number;
  endRowIndex: number;
  isEditing: boolean;
  isFocused: boolean;
  position: Position | undefined;
  rowIndex: number;
  selected: boolean;
  startColumnIndex: number;
  startRowIndex: number;
  virtualRowIndex: number;
}

export function Cell({
  allowEditCellOverflow,
  ariaLabel,
  children,
  columnDef,
  columnIndex,
  // QUESTION: Maybe we don't need `columnIndexRelative`?
  columnIndexRelative,
  endColumnIndex,
  endRowIndex,
  isEditing,
  isFocused,
  position,
  rowIndex,
  selected = false,
  startColumnIndex,
  startRowIndex,
  virtualRowIndex,
}: CellProps) {
  if (position === undefined) {
    console.warn("Column definition not found.");
    return null;
  }
  const columnSpan =
    endColumnIndex - startColumnIndex - (columnIndex - startColumnIndex);
  const rowSpan = endRowIndex - startRowIndex + 1 - (rowIndex - startRowIndex);
  return (
    <div
      aria-label={ariaLabel}
      className={`cantal-cell-base${isFocused ? " cantal-cell-focused" : ""}${
        columnDef.pinned ? ` cantal-cell-pinned-${columnDef.pinned}` : ""
      }${selected ? " cantal-cell-selected" : ""}${isEditing ? " cantal-cell-editing" : ""}`}
      data-col-idx={columnIndex}
      data-field={columnDef.field}
      data-row-idx={startRowIndex}
      data-row-end-idx={endRowIndex}
      role="gridcell"
      style={{
        gridColumnStart: position.pinnedIndex,
        gridColumnEnd: position.pinnedIndexEnd + columnSpan,
        gridRowStart: virtualRowIndex + 1,
        gridRowEnd: virtualRowIndex + 1 + rowSpan,
        ...(allowEditCellOverflow && isEditing
          ? { overflow: "visible", zIndex: 0 }
          : {}),
      }}
    >
      {children}
    </div>
  );
}
