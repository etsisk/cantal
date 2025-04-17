import type { CSSProperties, ReactNode } from "react";
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
  styles:
    | {
        base?: CSSProperties;
        edited?: CSSProperties;
        focused?: CSSProperties;
        selected?: CSSProperties;
      }
    | ((children: ReactNode) => {
        base?: CSSProperties;
        edited?: CSSProperties;
        focused?: CSSProperties;
        selected?: CSSProperties;
      });
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
  styles,
  virtualRowIndex,
}: CellProps) {
  if (position === undefined) {
    console.warn("Column definition not found.");
    return null;
  }
  const columnSpan =
    endColumnIndex - startColumnIndex - (columnIndex - startColumnIndex);
  const rowSpan = endRowIndex - startRowIndex + 1 - (rowIndex - startRowIndex);
  const userStyles = typeof styles === "function" ? styles(children) : styles;
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
        ...userStyles.base,
        ...(selected ? userStyles.selected : {}),
        ...(isFocused ? userStyles.focused : {}),
        ...(isEditing ? userStyles.edited : {}),
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
