import {
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
  type SyntheticEvent,
  type UIEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Cell } from "./Cell";
import {
  applyColumnSpanDefDefaults,
  getPinnedColumnsOffset,
  type ColumnDefWithDefaults,
  type DataRow,
  type HandleDoublePointerDownArgs,
  type HandleKeyDownArgs,
  type HandlePointerDownArgs,
  type LeafColumn,
  type Point,
  type Position,
} from "./Grid";

export interface Cell {
  columnIndex: number;
  rowIndex: number;
}

export interface EditCell extends Cell {
  selectInitialValue: boolean;
  value: string;
}

type Direction = "left" | "right" | "up" | "down";
export type ColumnSpan = { field: string; from: number; to: number };

interface BodyProps {
  canvasWidth: string;
  columnGap: number;
  columnSpans?: string;
  containerHeight: number;
  data: any[];
  editCell?: EditCell | undefined;
  focusedCell?: Cell | null;
  handleContextMenu: (args: {
    cell: Cell;
    columnDef: LeafColumn;
    defaultHandler: () => void;
    event: MouseEvent;
  }) => void;
  handleDoublePointerDown: (args: HandleDoublePointerDownArgs) => void;
  handleEdit: (
    editRows: { [key: string]: DataRow },
    leafColumns: LeafColumn[],
  ) => void;
  handleEditCellChange: (editCell?: EditCell) => void;
  handleFocusedCellChange: (
    focusCell: Cell,
    e: SyntheticEvent,
    point?: Point,
  ) => void;
  handleKeyDown: (args: HandleKeyDownArgs) => void;
  handlePointerDown: (args: HandlePointerDownArgs) => void;
  handleSelection?: (
    selectedRanges: IndexedArray<Range>,
    endPoint: Point | undefined,
    e:
      | PointerEvent
      | ReactPointerEvent<HTMLDivElement>
      | KeyboardEvent<HTMLDivElement>
      | MouseEvent<HTMLDivElement>,
  ) => void;
  headerViewportRef: RefObject<HTMLDivElement | null>;
  leafColumns: LeafColumn[];
  overscanColumns: number;
  overscanRows: number;
  positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>;
  rowGap: number;
  rowHeight?: number;
  rowId?: string;
  selectedRanges: IndexedArray<Range>;
  selectionFollowsFocus?: boolean;
  setState: {
    setVisibleEndColumn: Dispatch<SetStateAction<number>>;
    setVisibleStartColumn: Dispatch<SetStateAction<number>>;
  };
  showSelectionBox?: boolean;
  styles: CSSProperties;
  virtual: "columns" | "rows" | boolean;
  visibleColumnEnd: number;
  visibleColumnStart: number;
}

export function Body({
  canvasWidth,
  columnGap,
  columnSpans,
  containerHeight,
  data,
  editCell,
  focusedCell = null,
  handleContextMenu,
  handleDoublePointerDown,
  handleEdit,
  handleEditCellChange,
  handleFocusedCellChange,
  handleKeyDown,
  handlePointerDown,
  handleSelection,
  headerViewportRef,
  leafColumns,
  overscanColumns,
  overscanRows,
  positions,
  rowGap,
  rowHeight = 27,
  rowId,
  selectedRanges,
  selectionFollowsFocus = false,
  setState,
  showSelectionBox,
  styles,
  virtual,
  visibleColumnEnd,
  visibleColumnStart,
}: BodyProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // QUESTION: Should `focusedCellRef` be defined here or on Grid.tsx?
  const focusedCellRef = useRef<HTMLDivElement>(null);
  // TODO: Switch to primative value state for visibleRows
  const [visibleRows, setVisibleRows] = useState<number[]>(() => {
    if (virtual === true || virtual === "rows") {
      return spread(0, Math.floor(window.innerHeight / rowHeight));
    }
    return spread(0, data.length);
  });
  const [startDragCell, setStartDragCell] = useState<Cell | undefined>(
    undefined,
  );
  const [startDragPoint, setStartDragPoint] = useState<Point | undefined>(
    undefined,
  );
  const [endDragPoint, setEndDragPoint] = useState<Point | undefined>(
    undefined,
  );

  // NOTE: there are few cases where we could skip the useEffect and calculate the viewport height based on styles + math
  useEffect(() => {
    if (viewportRef.current && headerViewportRef.current) {
      viewportRef.current.style.height = `${containerHeight - headerViewportRef.current.offsetHeight}px`;
    }
  }, [containerHeight]);

  useEffect(() => {
    if (!editCell && focusedCell && focusedCellRef.current) {
      focusedCellRef.current.focus();
    }
  }, [editCell, focusedCell]);

  useEffect(() => {
    if (!focusedCell || !viewportRef.current) {
      return;
    }
    const columnDef = leafColumns[focusedCell?.columnIndex];
    if (columnDef === undefined) {
      return;
    }
    const viewportRect = getViewportBoundingBox(
      viewportRef.current,
      leafColumns,
      columnGap,
    );
    // NOTE: Doesn't acccount for non-pixel based widths (e.g. '1fr')
    // QUESTION: Maybe check for from index to make sure start of column span
    // is scrolled into view?
    // It's not clear what the correct behavior should be
    const cellInlineStart = leafColumns.reduce((offset, def, i) => {
      if (i < focusedCell.columnIndex) {
        return offset + def.width + rowGap;
      }
      return offset;
    }, 0);
    const cellInlineEnd = cellInlineStart + columnDef.width;
    const cellBlockStart =
      rowHeight * focusedCell.rowIndex + focusedCell.rowIndex * rowGap;
    const cellBlockEnd = cellBlockStart + rowHeight;
    // TODO: Consider extracting scroll logic into reusable function
    if (cellInlineStart < viewportRect.left) {
      viewportRef.current.scrollLeft =
        cellInlineStart - viewportRect.leftOffset;
    } else if (cellInlineEnd > viewportRect.right - viewportRect.rightOffset) {
      viewportRef.current.scrollLeft =
        cellInlineEnd - viewportRect.width + viewportRect.rightOffset;
    }

    if (cellBlockStart < viewportRect.top) {
      viewportRef.current.scrollTop = cellBlockStart;
    } else if (cellBlockEnd > viewportRect.bottom) {
      viewportRef.current.scrollTop = cellBlockEnd - viewportRect.height;
    }
    // NOTE: Woof
  }, [columnGap, focusedCell, leafColumns.map((lc) => lc.field).join("-")]);

  // QUESTION: use useRef instead?
  useEffect(() => {
    function pointerMove(e: PointerEvent): void {
      const cell = getCellFromEvent(e);
      const point = canvasRef.current
        ? getPointFromEvent(e, canvasRef.current)
        : undefined;

      if (!cell || !startDragCell) {
        return;
      }

      handleSelection?.(
        [
          range(
            startDragCell.rowIndex,
            startDragCell.columnIndex,
            cell.rowIndex,
            cell.columnIndex,
          ),
        ],
        point,
        e,
      );
      if (showSelectionBox && point !== undefined) {
        setEndDragPoint(point);
      }
    }

    function pointerUp(e: PointerEvent) {
      handleSelection?.(selectedRanges, undefined, e);
      setStartDragCell(undefined);
      setStartDragPoint(undefined);
      setEndDragPoint(undefined);
    }
    if (startDragCell) {
      window.addEventListener("pointermove", pointerMove);
      window.addEventListener("pointerup", pointerUp);
    }

    return function cleanup() {
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
    };
  }, [selectedRanges, showSelectionBox, startDragCell]);

  // TODO: `getViewportBoundingBox` should live somewhere else
  function getViewportBoundingBox(
    viewport: HTMLDivElement,
    leafColumns: LeafColumn[],
    columnGap: number,
  ) {
    const { offsetHeight, offsetWidth, scrollLeft, scrollTop } = viewport;
    const pinnedStartColumns = leafColumns.filter(
      (def) => def.pinned === "start",
    );
    const pinnedEndColumns = leafColumns.filter((def) => def.pinned === "end");
    // TODO: Account for spanned cells
    // Column spans in particular don't seem to jump to the from cell when virtualized
    const startBoundaryOffset = getPinnedColumnsOffset(
      pinnedStartColumns,
      columnGap,
    );
    const endBoundaryOffset = getPinnedColumnsOffset(
      pinnedEndColumns,
      columnGap,
    );
    const startBoundary = pinnedStartColumns.length
      ? startBoundaryOffset + scrollLeft
      : scrollLeft;
    const endBoundary = pinnedEndColumns.length
      ? scrollLeft + offsetWidth - endBoundaryOffset
      : scrollLeft + offsetWidth;
    const bRect = viewport.getBoundingClientRect();
    return {
      bottom: scrollTop + offsetHeight,
      height: offsetHeight,
      left: startBoundary,
      leftOffset: startBoundaryOffset,
      right: endBoundary,
      rightOffset: endBoundaryOffset,
      top: scrollTop,
      width: bRect.width,
    };
  }

  // QUESTION: Pass these values down to avoid duplicate work?
  const pinnedStartLeafColumns = leafColumns.filter(
    (lc) => lc.pinned === "start",
  );
  const pinnedEndLeafColumns = leafColumns.filter((lc) => lc.pinned === "end");
  const unpinnedLeafColumns = leafColumns.filter(
    (lc) => lc.pinned !== "start" && lc.pinned !== "end",
  );

  // TODO: Rename function to better describe output
  function getVisibleColumnsRange(): [number, number] {
    if (viewportRef.current && (virtual === true || virtual === "columns")) {
      const { offsetWidth, scrollLeft } = viewportRef.current;
      const startBoundary =
        scrollLeft +
        pinnedStartLeafColumns.reduce((sum, lc) => sum + lc.width, 0) +
        Math.max(pinnedStartLeafColumns.length - 1, 0) * columnGap;
      const endBoundary = Math.max(
        scrollLeft,
        scrollLeft +
          offsetWidth -
          (pinnedEndLeafColumns.reduce((sum, lc) => sum + lc.width, 0) +
            Math.max(pinnedEndLeafColumns.length - 1, 0) * columnGap),
      );
      const columnEndBoundaries = getColumnEndBoundaries(endBoundary);
      const startIndex = columnEndBoundaries.findIndex(
        (b) => b > startBoundary,
      );
      const firstVisibleColumn = Math.max(
        (startIndex === -1 ? 0 : startIndex) - overscanColumns,
        0,
      );
      const endIndex = columnEndBoundaries.findIndex((b) => b > endBoundary);
      const lastVisibleColumn =
        Math.min(
          (endIndex === -1 ? leafColumns.length - 1 : endIndex) +
            overscanColumns,
          leafColumns.length - 1,
        ) + 1;
      return [firstVisibleColumn, lastVisibleColumn];
    }
    return [0, leafColumns.length];
  }

  function getColumnEndBoundaries(endBoundary: number): number[] {
    const endBoundaries = [];
    let startBoundary = 0;
    for (let column of leafColumns) {
      if (startBoundary > endBoundary) {
        break;
      }
      endBoundaries.push(startBoundary + column.width + columnGap);
      startBoundary += column.width + columnGap;
    }
    return endBoundaries;
  }

  function getVisibleRowsRange() {
    if (viewportRef.current && (virtual === true || virtual === "rows")) {
      const { scrollTop, offsetHeight } = viewportRef.current;
      const rowHeightWithGap = rowHeight + rowGap;
      const firstVisibleRow = Math.max(
        Math.floor((scrollTop + rowGap) / rowHeightWithGap) - overscanRows,
        0,
      );
      const lastVisibleRow =
        Math.min(
          Math.floor((scrollTop + offsetHeight) / rowHeightWithGap) +
            overscanRows,
          data.length - 1,
        ) + 1;
      return spread(firstVisibleRow, lastVisibleRow);
    }
    return spread(0, data.length);
  }

  function handleCopy() {
    // TODO: Enhance copy matrix to account for spanned cells
    const str = getCopyMatrix(data, leafColumns, selectedRanges)
      .map((row) => row.join("\t"))
      .join("\n");
    navigator.clipboard.writeText(str);
  }

  function handleEvent(
    e: PointerEvent | ReactPointerEvent<HTMLDivElement>,
    eventLabel: string,
  ) {}

  function handlePaste() {
    navigator.clipboard.readText().then((clipboardText) => {
      const pasteMatrix = createPasteMatrix(clipboardText);
      handleEdit(
        getEditRowsFromPasteMatrix(
          pasteMatrix,
          data,
          leafColumns,
          selectedRanges,
          focusedCell,
          columnSpans,
        ),
        leafColumns,
      );
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!focusedCell) {
      return;
    }

    const columnDef = leafColumns[focusedCell.columnIndex];

    if (!columnDef) {
      return;
    }

    handleKeyDown({
      e,
      cell: focusedCell,
      columnDef,
      defaultHandler: () => defaultHandleKeyDown(e),
    });
    e.stopPropagation();
  }

  function defaultHandleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const dir = e.key.replace("Arrow", "").toLowerCase() as Direction;
      if (
        e.shiftKey &&
        focusedCell &&
        selectedRanges &&
        selectedRanges.length > 0 &&
        handleSelection
      ) {
        // TODO: make `point` optional?
        // const point = getPointFromEvent(e, canvasRef.current);
        handleSelection(
          [
            getExpandedSelectionRangeOnKey(
              e.key,
              focusedCell,
              selectedRanges[0],
              data,
              leafColumns,
            ),
          ],
          // TODID: Made `point` null - doesn't make sense for keyboard event
          // point,
          undefined,
          e,
        );
      } else {
        navigateCell(e, dir);
      }
    } else if (e.key === "Tab") {
      if (editCell) {
        commitCellEdit();
      }
      e.preventDefault();
      navigateCell(e, e.shiftKey ? "left" : "right", true);
    } else if (e.key === "Escape") {
      if (editCell) {
        cancelCellEdit();
      }
      e.preventDefault();
    } else if (e.key === "Enter") {
      commitCellEdit();
      e.preventDefault();
      navigateCell(e, e.shiftKey ? "up" : "down");
    } else if (e.key === "c" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCopy();
    } else if (e.key === "v" && (e.metaKey || e.ctrlKey)) {
      handlePaste();
    } else if (isKeyDownPrintable(e)) {
      startCellEdit(focusedCell, "");
    } else if (e.key === "Backspace" || e.key === "Delete") {
      startCellEdit(focusedCell, "");
    } else if (e.key === "F2" || (e.key === "u" && e.ctrlKey)) {
      startCellEdit(focusedCell, undefined, false);
    }
  }

  function startCellEdit(
    cell: Cell | null,
    value?: "",
    selectInitialValue?: boolean | undefined,
  ) {
    if (!cell) {
      return;
    }

    const row = data[cell.rowIndex];
    const leafColumn = leafColumns[cell.columnIndex];
    if (!row || !leafColumn) {
      return;
    }

    const columnDef = columnSpans
      ? applyColumnSpanDefDefaults(
          getColumnSpan(row[columnSpans], cell.columnIndex),
          leafColumn,
        )
      : leafColumn;
    const topLeftMostCell = {
      columnIndex: getColumnIndex(cell.columnIndex, row, columnSpans),
      rowIndex: getRowIndex(
        cell.rowIndex,
        cell.columnIndex,
        data,
        columnDef,
        columnSpans,
      ),
    };

    if (
      !isCellEditable(topLeftMostCell, row, columnDef) ||
      isSameCell(
        {
          columnIndex: topLeftMostCell.columnIndex,
          rowIndex: topLeftMostCell.rowIndex,
        },
        editCell,
      )
    ) {
      return;
    }

    handleEditCellChange({
      ...topLeftMostCell,
      selectInitialValue: selectInitialValue ?? value === undefined,
      value: value ?? data[topLeftMostCell.rowIndex][columnDef.field],
    });
  }

  function commitCellEdit(value?: unknown) {
    if (!editCell) {
      return;
    }

    const row = data[editCell.rowIndex];
    const leafColumn = leafColumns[editCell.columnIndex];
    if (!leafColumn || !row) {
      return;
    }
    const columnDef = columnSpans
      ? applyColumnSpanDefDefaults(
          getColumnSpan(row[columnSpans], editCell.columnIndex),
          leafColumn,
        )
      : leafColumn;
    handleEditCellChange(undefined);
    handleEdit(
      {
        [rowId ? row[rowId] : editCell.rowIndex]: {
          [columnDef.field]:
            value !== undefined
              ? columnDef.valueParser(value)
              : columnDef.valueParser(editCell.value),
        },
      },
      leafColumns,
    );
  }

  function cancelCellEdit() {
    if (editCell) {
      handleEditCellChange(undefined);
    }
  }

  function navigateCell(
    e: KeyboardEvent<HTMLDivElement>,
    dir: Direction,
    wrap: boolean = false,
  ): boolean {
    if (!focusedCell) {
      return false;
    }
    const columnDef = leafColumns[focusedCell.columnIndex];
    if (!columnDef) {
      return false;
    }
    if (dir === "up") {
      const rowIndex = getRowIndex(
        focusedCell.rowIndex - 1,
        focusedCell.columnIndex,
        data,
        columnDef,
        columnSpans,
      );
      if (focusedCell.rowIndex === 0) {
        return false;
      }
      const newFocusedCell = {
        ...focusedCell,
        rowIndex: rowIndex,
      };

      handleFocusedCellChange(newFocusedCell, e);
      setSelectionRangeToFocusedCell(newFocusedCell, e);
    } else if (dir === "down") {
      const rowIndex = getLastRowIndex(
        focusedCell.rowIndex,
        focusedCell.columnIndex,
        data,
        columnDef,
        columnSpans,
      );
      if (rowIndex >= data.length - 1) {
        return false;
      }

      const newFocusedCell = {
        ...focusedCell,
        rowIndex: rowIndex + 1,
      };

      handleFocusedCellChange(newFocusedCell, e);
      setSelectionRangeToFocusedCell(newFocusedCell, e);
    } else if (dir === "left") {
      const columnIndex = getColumnIndex(
        focusedCell.columnIndex - 1,
        data[focusedCell.rowIndex],
        columnSpans,
      );
      if (focusedCell.columnIndex === 0) {
        if (wrap) {
          if (focusedCell.rowIndex === 0) {
            return false;
          }

          const newFocusedCell = {
            ...focusedCell,
            columnIndex: getColumnIndex(
              // QUESTION: Account for columns pinned on the right side?
              leafColumns.length - 1,
              data[focusedCell.rowIndex - 1],
              columnSpans,
            ),
            // rowIndex: focusedCell.rowIndex - 1,
            rowIndex: getRowIndex(
              focusedCell.rowIndex - 1,
              columnIndex,
              data,
              columnDef,
              columnSpans,
            ),
          };

          handleFocusedCellChange(newFocusedCell, e);
          setSelectionRangeToFocusedCell(newFocusedCell, e);
          return true;
        } else {
          return false;
        }
      }

      const newFocusedCell = {
        ...focusedCell,
        columnIndex,
      };

      handleFocusedCellChange(newFocusedCell, e);
      setSelectionRangeToFocusedCell(newFocusedCell, e);
    } else if (dir === "right") {
      const columnIndex = getColumnIndex(
        focusedCell.columnIndex,
        data[focusedCell.rowIndex],
        columnSpans,
        "end",
      );

      if (columnIndex + 1 > leafColumns.length - 1) {
        if (wrap) {
          if (focusedCell.rowIndex >= data.length - 1) {
            // TODO: Remove focus from the grid
            // setKeepFocus(false);
            return false;
          }

          const newFocusedCell = {
            columnIndex: 0,
            rowIndex: focusedCell.rowIndex + 1,
          };

          handleFocusedCellChange(newFocusedCell, e);
          setSelectionRangeToFocusedCell(newFocusedCell, e);
          return true;
        } else {
          return false;
        }
      }

      if (columnIndex + 1 > leafColumns.length - 1) {
        return false;
      }
      const newFocusedCell = {
        ...focusedCell,
        columnIndex: columnIndex + 1,
      };

      handleFocusedCellChange(newFocusedCell, e);
      setSelectionRangeToFocusedCell(newFocusedCell, e);
    }
    return true;
  }

  function setSelectionRangeToFocusedCell(
    focusedCell: Cell,
    e:
      | PointerEvent
      | ReactPointerEvent<HTMLDivElement>
      | KeyboardEvent<HTMLDivElement>
      | MouseEvent<HTMLDivElement>,
  ) {
    if (selectionFollowsFocus && handleSelection) {
      const point = getPointFromEvent(e, canvasRef.current);

      handleSelection(
        getSelectionRangeWithSpans(
          range(focusedCell.rowIndex, focusedCell.columnIndex),
        ),
        point,
        e,
      );
    }
  }

  function getSelectionRangeWithSpans(selectedRange: Range): Range[] {
    const columnDef = leafColumns[selectedRange.fromColumn];
    if (!columnDef) {
      return [selectedRange];
    }

    const startColumn = getColumnIndex(
      selectedRange.fromColumn,
      data[selectedRange.fromRow],
      columnSpans,
    );
    const endColumn = getColumnIndex(
      selectedRange.toColumn,
      data[selectedRange.fromRow],
      columnSpans,
      "end",
    );
    const startRow = getRowIndex(
      selectedRange.fromRow,
      selectedRange.fromColumn,
      data,
      columnDef,
      columnSpans,
    );
    const endRow = getLastRowIndex(
      selectedRange.toRow,
      selectedRange.fromColumn,
      data,
      columnDef,
      columnSpans,
    );
    return [range(startRow, startColumn, endRow, endColumn)];
  }

  function onPointerDown(
    e: ReactPointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
  ) {
    // Persist event object across function calls
    e.persist?.();
    // Allow DIV elements to take focus
    e.preventDefault?.();

    const cell = getCellFromEvent(e);
    const eventIsPointerEvent = isPointerEvent(e);
    const point = eventIsPointerEvent
      ? getPointFromEvent(e, canvasRef.current)
      : undefined;

    if (!cell || (!point && eventIsPointerEvent)) {
      return;
    }

    const columnDef = leafColumns[cell.columnIndex];

    if (!columnDef) {
      return;
    }

    if (e.detail === 2 || e.type === "dblclick") {
      handleDoublePointerDown({
        e,
        cell,
        point,
        columnDef,
        defaultHandler: () => startCellEdit(cell),
      });
    } else if (eventIsPointerEvent && point) {
      handlePointerDown({
        e,
        cell,
        point,
        columnDef,
        defaultHandler: () => defaultHandlePointerDown(e, cell, point),
      });
    }
  }

  function defaultHandlePointerDown(
    e: ReactPointerEvent<HTMLDivElement>,
    cell: Cell,
    point: Point | undefined,
  ): void {
    if (isSameCell(cell, editCell)) {
      return;
    }

    if (editCell) {
      commitCellEdit();
    }

    if (
      e.shiftKey &&
      focusedCell &&
      selectedRanges &&
      selectedRanges.length > 0 &&
      handleSelection
    ) {
      handleSelection(
        getSelectionRangeWithSpans(
          range(focusedCell.rowIndex, focusedCell.columnIndex).merge(
            range(cell.rowIndex, cell.columnIndex),
          ),
        ),
        //   getSelectionRangeWithMergedCells(
        // [
        // range(focusedCell.rowIndex, focusedCell.columnIndex).merge(
        // range(cell.rowIndex, cell.columnIndex),
        // ),
        // ],
        //     rangeSelectionBehavior,
        //     leafColumns,
        //     data,
        //     hasGridBodyAreas,
        //     columnSpansByRow
        //   ),
        point,
        e,
      );
      return;
    }

    // Only start cell drag for a left mouse button down
    if (e.button === 0 && !e.ctrlKey && point) {
      handleFocusedCellChange(cell, e, point);

      if (handleSelection && point) {
        setStartDragCell(cell);
        setStartDragPoint(point);
        setSelectionRangeToFocusedCell(cell, e);
      }
    }
  }

  function handleScroll(e: UIEvent<HTMLDivElement>) {
    if (headerViewportRef.current) {
      headerViewportRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    if (viewportRef.current && (virtual === true || virtual === "rows")) {
      setVisibleRows(getVisibleRowsRange());
    }
    if (viewportRef.current && (virtual === true || virtual === "columns")) {
      const [start, end] = getVisibleColumnsRange();
      setState.setVisibleStartColumn(start);
      setState.setVisibleEndColumn(end);
    }
  }

  const visibleColumns = spread(visibleColumnStart, visibleColumnEnd);
  const viewportStyles: CSSProperties = {
    overflow: "auto",
    width: "inherit",
  };

  const canvasStyles: CSSProperties = {
    height:
      virtual === "rows" || virtual === true
        ? (rowHeight + rowGap) * data.length - rowGap
        : "auto",
    width: canvasWidth,
  };

  const pinnedStyles: CSSProperties = {
    ...styles,
    backgroundColor: "var(--background-color)",
    display: "grid",
    gridAutoRows: rowHeight,
    gridTemplateColumns: "subgrid",
    height: "max-content",
    insetInline: 0,
    position: "sticky",
  };

  const pinnedStartStyles: CSSProperties = {
    ...pinnedStyles,
    gridColumn: `1 / ${pinnedStartLeafColumns.length + 1}`,
  };

  const unpinnedStyles: CSSProperties = {
    ...styles,
    display: "grid",
    gridAutoRows: rowHeight,
    gridColumn: `${pinnedStartLeafColumns.length + 1} / ${
      leafColumns.length - pinnedEndLeafColumns.length + 1
    }`,
    gridTemplateColumns: "subgrid",
  };

  const pinnedEndStyles: CSSProperties = {
    ...pinnedStyles,
    gridColumn: `${leafColumns.length - pinnedEndLeafColumns.length + 1} / ${
      leafColumns.length + 1
    }`,
  };

  const leafColumn = focusedCell
    ? leafColumns[focusedCell.columnIndex]
    : undefined;

  // QUESTION: If we didn't limit span matrices to visible columns/rows,
  // would it be better than calculating individual cell bounds?
  // Currently, we calculate it for:
  // - each rendered cell
  // - navigate cell action
  // - selection range when following focus
  // QUESTION: Could we get away with limiting span matrices to
  // focusedCell indices?
  const colSpans = columnSpans
    ? getColumnSpans(columnSpans, data, visibleColumns, visibleRows)
    : undefined;
  const rowSpans = leafColumns
    .slice(visibleColumnStart, visibleColumnEnd + 1)
    .some((lc) => lc.rowSpanning)
    ? getRowSpans(leafColumns, data, visibleColumns, visibleRows, colSpans)
    : undefined;

  return (
    <div
      className="cantal-body-viewport"
      onScroll={handleScroll}
      ref={viewportRef}
      style={viewportStyles}
    >
      <div
        className="cantal-body-canvas"
        onContextMenu={(e) => {
          const cell = getCellFromEvent(e);
          if (!cell || handleContextMenu === undefined) {
            return;
          }
          const columnDef = leafColumns[cell.columnIndex];
          if (!columnDef) {
            return;
          }
          handleContextMenu({
            cell,
            columnDef,
            event: e,
            defaultHandler: () => {
              if (!rangesContainCell(selectedRanges, cell)) {
                handleFocusedCellChange(cell, e);
                setSelectionRangeToFocusedCell(cell, e);
              }
            },
          });
        }}
        onDoubleClick={(e) => onPointerDown({ ...e, detail: 2 })}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={(e: ReactPointerEvent<HTMLDivElement>) =>
          handleEvent(e, "onPointerUp")
        }
        ref={canvasRef}
        style={canvasStyles}
      >
        {focusedCell && leafColumn && (
          <div
            aria-label={
              leafColumn.ariaCellLabel instanceof Function
                ? leafColumn.ariaCellLabel({
                    def: leafColumn,
                    columnIndex: focusedCell.columnIndex,
                    data: data[focusedCell.rowIndex],
                    rowIndex: focusedCell.rowIndex,
                    value: data[focusedCell.rowIndex]
                      ? data[focusedCell.rowIndex][leafColumn.field]
                      : null,
                  })
                : leafColumn.ariaCellLabel
            }
            aria-live="polite"
            className="cantal-focused-cell"
            ref={focusedCellRef}
            role="gridcell"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              overflow: "hidden",
            }}
            tabIndex={-1}
          >
            {data[focusedCell.rowIndex]
              ? leafColumn.valueRenderer({
                  columnDef: leafColumn,
                  data: data[focusedCell.rowIndex],
                  value: data[focusedCell.rowIndex][leafColumn.field],
                })
              : null}
          </div>
        )}
        {data.length > 0 && (
          <div
            className="cantal-focus-sink"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              overflow: "hidden",
            }}
            tabIndex={0}
          ></div>
        )}
        <div
          className="cantal-body"
          style={{
            display: "grid",
            gridAutoRows: rowHeight,
            insetBlockStart: visibleRows[0]
              ? visibleRows[0] * (rowHeight + rowGap)
              : 0,
            ...(pinnedStartLeafColumns.concat(pinnedEndLeafColumns).length > 0
              ? {
                  height: `${rowHeight * visibleRows.length + rowGap * visibleRows.length - 1}px`,
                }
              : {}),
            ...styles,
          }}
        >
          {pinnedStartLeafColumns.length > 0 ||
          pinnedEndLeafColumns.length > 0 ? (
            <>
              {pinnedStartLeafColumns.length > 0 && (
                <div
                  className="cantal-body-pinned-start"
                  style={pinnedStartStyles}
                >
                  {visibleRows.map((rowIndex) => {
                    const row = data[rowIndex];
                    return pinnedStartLeafColumns.map(
                      (columnDef, columnIndex) => {
                        let colDef = columnDef;
                        const relativeColumnIndex =
                          (virtual === true || virtual === "columns") &&
                          visibleColumns[0]
                            ? columnIndex - visibleColumns[0]
                            : columnIndex;
                        const relativeRowIndex =
                          (virtual === true || virtual === "rows") &&
                          visibleRows[0]
                            ? rowIndex - visibleRows[0]
                            : rowIndex;
                        let startRowIndex = rowIndex;
                        let endRowIndex = rowIndex;
                        if (columnDef.rowSpanning) {
                          if (
                            relativeRowIndex !== 0 &&
                            isRowSpanned(columnDef, row, data[rowIndex - 1]) &&
                            !isColumnSpanned(
                              data[rowIndex - 1],
                              columnSpans,
                              columnIndex,
                            )
                          ) {
                            return null;
                          }
                          startRowIndex = getRowIndex(
                            rowIndex,
                            columnIndex,
                            data,
                            columnDef,
                            columnSpans,
                          );
                          endRowIndex = getLastRowIndex(
                            rowIndex,
                            columnIndex,
                            data,
                            columnDef,
                            columnSpans,
                          );
                        }
                        let startColumnIndex = columnIndex;
                        let endColumnIndex = columnIndex;
                        if (columnSpans) {
                          if (
                            columnIndex !== 0 &&
                            isColumnSpanned(row, columnSpans, columnIndex)
                          ) {
                            return null;
                          }
                          startColumnIndex = getColumnIndex(
                            columnIndex,
                            row,
                            columnSpans,
                          );
                          endColumnIndex = getColumnIndex(
                            columnIndex,
                            row,
                            columnSpans,
                            "end",
                          );
                          colDef = applyColumnSpanDefDefaults(
                            getColumnSpan(
                              row[columnSpans],
                              columnIndex,
                              "from",
                            ),
                            columnDef,
                          );
                        }
                        const Editor = colDef.editor({
                          columnDef: colDef,
                          columnIndex,
                          data: row,
                          rowIndex,
                          value: colDef.valueRenderer({
                            columnDef: colDef,
                            data: row,
                            value: row[colDef.field],
                          }),
                        });
                        const isEditing = isSameCell(
                          { columnIndex, rowIndex },
                          editCell,
                        );
                        const isFocused = isCellFocused(
                          focusedCell,
                          startRowIndex,
                          startColumnIndex,
                          endRowIndex,
                          endColumnIndex,
                        );
                        return (
                          <Cell
                            allowEditCellOverflow={colDef.allowEditCellOverflow}
                            ariaLabel={
                              typeof colDef.ariaCellLabel === "function"
                                ? colDef.ariaCellLabel({
                                    columnIndex,
                                    data: row,
                                    def: colDef,
                                    rowIndex,
                                    value: row[colDef.field],
                                  })
                                : colDef.ariaCellLabel
                            }
                            columnDef={colDef}
                            columnIndex={columnIndex}
                            columnIndexRelative={relativeColumnIndex}
                            endColumnIndex={endColumnIndex}
                            endRowIndex={endRowIndex}
                            isEditing={isEditing}
                            isFocused={isFocused}
                            key={`${rowIndex}-${columnIndex}`}
                            position={positions.get(columnDef)}
                            rowIndex={rowIndex}
                            selected={rangesContainCell(selectedRanges, {
                              columnIndex,
                              rowIndex,
                            })}
                            startColumnIndex={startColumnIndex}
                            startRowIndex={startRowIndex}
                            virtualRowIndex={relativeRowIndex}
                          >
                            {isEditing && Editor ? (
                              <Editor
                                columnDef={colDef}
                                columnIndex={columnIndex}
                                data={row}
                                handleChange={(value: string) => {
                                  if (editCell) {
                                    handleEditCellChange({
                                      ...editCell,
                                      selectInitialValue: false,
                                      value,
                                    });
                                  }
                                }}
                                rowIndex={rowIndex}
                                selectInitialValue={
                                  editCell?.selectInitialValue
                                }
                                value={editCell?.value}
                              />
                            ) : (
                              colDef.valueRenderer({
                                columnDef: colDef,
                                data: row,
                                value: row[colDef.field],
                              })
                            )}
                          </Cell>
                        );
                      },
                    );
                  })}
                </div>
              )}
              <div className="cantal-body-unpinned" style={unpinnedStyles}>
                {unpinnedLeafColumns.length > 0 &&
                  visibleRows.map((rowIndex) => {
                    const row = data[rowIndex];
                    return visibleColumns.map((columnIndex) => {
                      const columnDef = unpinnedLeafColumns[columnIndex];
                      if (!columnDef) {
                        return null;
                      }
                      let colDef = columnDef;
                      const relativeColumnIndex =
                        (virtual === true || virtual === "columns") &&
                        visibleColumns[0]
                          ? columnIndex - visibleColumns[0]
                          : columnIndex;
                      const relativeRowIndex =
                        (virtual === true || virtual === "rows") &&
                        visibleRows[0]
                          ? rowIndex - visibleRows[0]
                          : rowIndex;
                      // TODO: Can we avoid 'colIndex' calculation?
                      const colIndex =
                        columnIndex + pinnedStartLeafColumns.length;
                      let startRowIndex = rowIndex;
                      let endRowIndex = rowIndex;
                      if (columnDef.rowSpanning) {
                        if (
                          relativeRowIndex !== 0 &&
                          isRowSpanned(columnDef, row, data[rowIndex - 1]) &&
                          !isColumnSpanned(
                            data[rowIndex - 1],
                            columnSpans,
                            colIndex,
                          )
                        ) {
                          return null;
                        }
                        startRowIndex = getRowIndex(
                          rowIndex,
                          colIndex,
                          data,
                          columnDef,
                          columnSpans,
                        );
                        endRowIndex = getLastRowIndex(
                          rowIndex,
                          colIndex,
                          data,
                          columnDef,
                          columnSpans,
                        );
                      }
                      let startColumnIndex = colIndex;
                      let endColumnIndex = colIndex;
                      if (columnSpans) {
                        if (
                          relativeColumnIndex !== 0 &&
                          isColumnSpanned(row, columnSpans, colIndex)
                        ) {
                          return null;
                        }
                        startColumnIndex = getColumnIndex(
                          colIndex,
                          row,
                          columnSpans,
                        );
                        endColumnIndex = getColumnIndex(
                          colIndex,
                          row,
                          columnSpans,
                          "end",
                        );
                        colDef = applyColumnSpanDefDefaults(
                          getColumnSpan(row[columnSpans], colIndex, "from"),
                          columnDef,
                        );
                      }
                      const Editor = colDef.editor({
                        columnDef: colDef,
                        columnIndex: colIndex,
                        data: row,
                        rowIndex,
                        value: colDef.valueRenderer({
                          columnDef: colDef,
                          data: row,
                          value: row[colDef.field],
                        }),
                      });
                      const isEditing = isSameCell(
                        { columnIndex: colIndex, rowIndex },
                        editCell,
                      );
                      const isFocused = isCellFocused(
                        focusedCell,
                        startRowIndex,
                        startColumnIndex,
                        endRowIndex,
                        endColumnIndex,
                      );
                      return (
                        <Cell
                          allowEditCellOverflow={colDef.allowEditCellOverflow}
                          ariaLabel={
                            typeof colDef.ariaCellLabel === "function"
                              ? colDef.ariaCellLabel({
                                  columnIndex: colIndex,
                                  data: row,
                                  def: colDef,
                                  rowIndex,
                                  value: row[colDef.field],
                                })
                              : colDef.ariaCellLabel
                          }
                          columnDef={colDef}
                          columnIndex={colIndex}
                          columnIndexRelative={relativeColumnIndex}
                          endColumnIndex={endColumnIndex}
                          endRowIndex={endRowIndex}
                          isEditing={isEditing}
                          isFocused={isFocused}
                          key={`${rowIndex}-${colIndex}`}
                          position={positions.get(columnDef)}
                          rowIndex={rowIndex}
                          selected={rangesContainCell(selectedRanges, {
                            columnIndex: colIndex,
                            rowIndex,
                          })}
                          startColumnIndex={startColumnIndex}
                          startRowIndex={startRowIndex}
                          virtualRowIndex={relativeRowIndex}
                        >
                          {isEditing && Editor ? (
                            <Editor
                              columnDef={colDef}
                              columnIndex={colIndex}
                              data={row}
                              handleChange={(value: string) => {
                                if (editCell) {
                                  handleEditCellChange({
                                    ...editCell,
                                    selectInitialValue: false,
                                    value,
                                  });
                                }
                              }}
                              rowIndex={rowIndex}
                              selectInitialValue={editCell?.selectInitialValue}
                              value={editCell?.value}
                            />
                          ) : (
                            colDef.valueRenderer({
                              columnDef: colDef,
                              data: row,
                              value: row[colDef.field],
                            })
                          )}
                        </Cell>
                      );
                    });
                  })}
              </div>
              {pinnedEndLeafColumns.length > 0 && (
                <div className="cantal-body-pinned-end" style={pinnedEndStyles}>
                  {visibleRows.map((rowIndex) => {
                    const row = data[rowIndex];
                    return pinnedEndLeafColumns.map(
                      (columnDef, columnIndex) => {
                        let colDef = columnDef;
                        const relativeColumnIndex =
                          (virtual === true || virtual === "columns") &&
                          visibleColumns[0]
                            ? columnIndex - visibleColumns[0]
                            : columnIndex;
                        const relativeRowIndex =
                          (virtual === true || virtual === "rows") &&
                          visibleRows[0]
                            ? rowIndex - visibleRows[0]
                            : rowIndex;
                        // TODO: Can we avoid 'colIndex' calculation?
                        const colIndex =
                          columnIndex +
                          pinnedStartLeafColumns.length +
                          unpinnedLeafColumns.length;
                        let startRowIndex = rowIndex;
                        let endRowIndex = rowIndex;
                        if (columnDef.rowSpanning) {
                          if (
                            relativeRowIndex !== 0 &&
                            isRowSpanned(columnDef, row, data[rowIndex - 1]) &&
                            !isColumnSpanned(
                              data[rowIndex - 1],
                              columnSpans,
                              colIndex,
                            )
                          ) {
                            return null;
                          }
                          startRowIndex = getRowIndex(
                            rowIndex,
                            colIndex,
                            data,
                            columnDef,
                            columnSpans,
                          );
                          endRowIndex = getLastRowIndex(
                            rowIndex,
                            colIndex,
                            data,
                            columnDef,
                            columnSpans,
                          );
                        }
                        let startColumnIndex = colIndex;
                        let endColumnIndex = colIndex;
                        if (columnSpans) {
                          if (
                            columnIndex !== 0 &&
                            isColumnSpanned(row, columnSpans, colIndex)
                          ) {
                            return null;
                          }
                          startColumnIndex = getColumnIndex(
                            colIndex,
                            row,
                            columnSpans,
                          );
                          endColumnIndex = getColumnIndex(
                            colIndex,
                            row,
                            columnSpans,
                            "end",
                          );
                          colDef = applyColumnSpanDefDefaults(
                            getColumnSpan(row[columnSpans], colIndex, "from"),
                            columnDef,
                          );
                        }
                        const Editor = colDef.editor({
                          columnDef: colDef,
                          columnIndex: colIndex,
                          data: row,
                          rowIndex,
                          value: colDef.valueRenderer({
                            columnDef: colDef,
                            data: row,
                            value: row[colDef.field],
                          }),
                        });
                        const isEditing = isSameCell(
                          { columnIndex: colIndex, rowIndex },
                          editCell,
                        );
                        const isFocused = isCellFocused(
                          focusedCell,
                          startRowIndex,
                          startColumnIndex,
                          endRowIndex,
                          endColumnIndex,
                        );
                        return (
                          <Cell
                            allowEditCellOverflow={colDef.allowEditCellOverflow}
                            ariaLabel={
                              typeof colDef.ariaCellLabel === "function"
                                ? colDef.ariaCellLabel({
                                    columnIndex,
                                    data: row,
                                    def: columnDef,
                                    rowIndex,
                                    value: row[columnDef.field],
                                  })
                                : colDef.ariaCellLabel
                            }
                            columnDef={colDef}
                            columnIndex={colIndex}
                            columnIndexRelative={relativeColumnIndex}
                            endColumnIndex={endColumnIndex}
                            endRowIndex={endRowIndex}
                            isEditing={isEditing}
                            isFocused={isFocused}
                            key={`${rowIndex}-${colIndex}`}
                            position={positions.get(columnDef)}
                            rowIndex={rowIndex}
                            selected={rangesContainCell(selectedRanges, {
                              columnIndex: colIndex,
                              rowIndex,
                            })}
                            startColumnIndex={startColumnIndex}
                            startRowIndex={startRowIndex}
                            virtualRowIndex={relativeRowIndex}
                          >
                            {isEditing && Editor ? (
                              <Editor
                                columnDef={colDef}
                                columnIndex={colIndex}
                                data={row}
                                handleChange={(value: string) => {
                                  if (editCell) {
                                    handleEditCellChange({
                                      ...editCell,
                                      selectInitialValue: false,
                                      value,
                                    });
                                  }
                                }}
                                rowIndex={rowIndex}
                                selectInitialValue={
                                  editCell?.selectInitialValue
                                }
                                value={editCell?.value}
                              />
                            ) : (
                              colDef.valueRenderer({
                                columnDef: colDef,
                                data: row,
                                value: row[colDef.field],
                              })
                            )}
                          </Cell>
                        );
                      },
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {visibleRows.map((rowIndex) => {
                const row = data[rowIndex];
                return visibleColumns.map((columnIndex) => {
                  const columnDef = unpinnedLeafColumns[columnIndex];
                  if (!row || !columnDef) {
                    return null;
                  }
                  // TODO: find a better name for `columnDefForSpan`
                  let columnDefForSpan = columnDef;
                  const relativeColumnIndex =
                    (virtual === true || virtual === "columns") &&
                    visibleColumns[0]
                      ? columnIndex - visibleColumns[0]
                      : columnIndex;
                  const relativeRowIndex =
                    (virtual === true || virtual === "rows") && visibleRows[0]
                      ? rowIndex - visibleRows[0]
                      : rowIndex;
                  let startRowIndex = rowIndex;
                  let endRowIndex = rowIndex;
                  if (columnDef.rowSpanning) {
                    if (
                      relativeRowIndex !== 0 &&
                      isRowSpanned(columnDef, row, data[rowIndex - 1]) &&
                      !isColumnSpanned(
                        data[rowIndex - 1],
                        columnSpans,
                        columnIndex,
                      )
                    ) {
                      return null;
                    }
                    startRowIndex = getRowIndex(
                      rowIndex,
                      columnIndex,
                      data,
                      columnDef,
                      columnSpans,
                    );
                    endRowIndex = getLastRowIndex(
                      rowIndex,
                      columnIndex,
                      data,
                      columnDef,
                      columnSpans,
                    );
                  }
                  let startColumnIndex = columnIndex;
                  let endColumnIndex = columnIndex;
                  if (columnSpans) {
                    if (
                      relativeColumnIndex !== 0 &&
                      isColumnSpanned(row, columnSpans, columnIndex)
                    ) {
                      return null;
                    }
                    startColumnIndex = getColumnIndex(
                      columnIndex,
                      row,
                      columnSpans,
                    );
                    endColumnIndex = getColumnIndex(
                      columnIndex,
                      row,
                      columnSpans,
                      "end",
                    );
                    columnDefForSpan = applyColumnSpanDefDefaults(
                      getColumnSpan(row[columnSpans], columnIndex, "from"),
                      columnDef,
                    );
                  }
                  const Editor = columnDefForSpan.editor({
                    columnDef: columnDefForSpan,
                    columnIndex,
                    data: row,
                    rowIndex,
                    value: columnDefForSpan.valueRenderer({
                      columnDef: columnDefForSpan,
                      data: row,
                      value: row[columnDefForSpan.field],
                    }),
                  });
                  const isEditing = isSameCell(
                    { columnIndex, rowIndex },
                    editCell,
                  );
                  const isFocused = isCellFocused(
                    focusedCell,
                    startRowIndex,
                    startColumnIndex,
                    endRowIndex,
                    endColumnIndex,
                  );
                  return (
                    <Cell
                      allowEditCellOverflow={
                        columnDefForSpan.allowEditCellOverflow
                      }
                      ariaLabel={
                        typeof columnDefForSpan.ariaCellLabel === "function"
                          ? columnDefForSpan.ariaCellLabel({
                              columnIndex,
                              data: row,
                              def: columnDefForSpan,
                              rowIndex,
                              value: row[columnDefForSpan.field],
                            })
                          : (columnDef.ariaCellLabel as string)
                      }
                      columnDef={columnDefForSpan}
                      columnIndex={columnIndex}
                      columnIndexRelative={relativeColumnIndex}
                      endColumnIndex={endColumnIndex}
                      endRowIndex={endRowIndex}
                      isEditing={isEditing}
                      isFocused={isFocused}
                      key={`${rowIndex}-${columnIndex}`}
                      position={positions.get(columnDef)}
                      rowIndex={rowIndex}
                      selected={rangesContainCell(selectedRanges, {
                        columnIndex: startColumnIndex,
                        rowIndex: startRowIndex,
                      })}
                      startColumnIndex={startColumnIndex}
                      startRowIndex={startRowIndex}
                      virtualRowIndex={relativeRowIndex}
                    >
                      {isEditing && Editor ? (
                        <Editor
                          columnDef={columnDefForSpan}
                          columnIndex={columnIndex}
                          data={row}
                          handleChange={(value: string) => {
                            if (editCell) {
                              handleEditCellChange({
                                ...editCell,
                                selectInitialValue: false,
                                value,
                              });
                            }
                          }}
                          rowIndex={rowIndex}
                          selectInitialValue={editCell?.selectInitialValue}
                          value={editCell?.value}
                        />
                      ) : (
                        columnDefForSpan.valueRenderer({
                          columnDef: columnDefForSpan,
                          data: row,
                          value: row[columnDefForSpan.field],
                        })
                      )}
                    </Cell>
                  );
                });
              })}
            </>
          )}
        </div>
      </div>
      {showSelectionBox && startDragPoint && endDragPoint && (
        <div
          className="cantal-selection-box"
          style={{
            height: Math.abs(startDragPoint.y - endDragPoint.y),
            left: Math.min(startDragPoint.x, endDragPoint.x),
            top: Math.min(startDragPoint.y, endDragPoint.y),
            width: Math.abs(startDragPoint.x - endDragPoint.x),
          }}
        />
      )}
    </div>
  );
}

function getCellFromEvent(event: SyntheticEvent | PointerEvent) {
  const element: HTMLElement = event.target as HTMLElement;
  const cell = element.closest("[role=gridcell]");
  if (!cell) {
    return null;
  }
  const columnIndex = cell.getAttribute("data-col-idx");
  const rowIndex = cell.getAttribute("data-row-idx");

  if (!columnIndex || !rowIndex) {
    return null;
  }
  return {
    columnIndex: +columnIndex,
    rowIndex: +rowIndex,
  };
}

function getPointFromEvent(
  event:
    | PointerEvent
    | ReactPointerEvent<HTMLDivElement>
    | KeyboardEvent<HTMLDivElement>
    | MouseEvent<HTMLDivElement>,
  element: HTMLDivElement | null,
): Point | undefined {
  if (element === null || isKeyboardEvent(event) || isMouseEvent(event)) {
    return;
  }
  return {
    x: event.clientX - element.getBoundingClientRect().left,
    y: event.clientY - element.getBoundingClientRect().top,
  };
}

function rangesContainCell(ranges: IndexedArray<Range>, cell: Cell): boolean {
  if (!cell) {
    return false;
  }
  for (let range of ranges) {
    if (range.contains(cell.rowIndex, cell.columnIndex)) {
      return true;
    }
  }

  return false;
}

export interface Range {
  contains: (row: number, column: number) => boolean;
  containsMultipleCells: () => boolean;
  equals: (other: Range) => boolean;
  fromColumn: number;
  fromRow: number;
  merge: (other: Range) => Range;
  shape: () => [number, number];
  toColumn: number;
  toRow: number;
  toString: () => string;
}

export interface IndexedArray<T> extends Array<T> {
  [index: number]: T;
}

export function range(
  startRow: number,
  startColumn: number,
  endRow?: number,
  endColumn?: number,
): Range {
  const _endColumn = endColumn ?? startColumn;
  const _endRow = endRow ?? startRow;
  const fromColumn = Math.max(0, Math.min(startColumn, _endColumn));
  const fromRow = Math.max(0, Math.min(startRow, _endRow));
  const toColumn = Math.max(startColumn, _endColumn);
  const toRow = Math.max(startRow, _endRow);

  function contains(row: number, column: number): boolean {
    return (
      row >= fromRow &&
      row <= toRow &&
      column >= fromColumn &&
      column <= toColumn
    );
  }

  function containsMultipleCells(): boolean {
    const s = shape();
    return (
      s[0] > 0 ||
      s[1] > 0 ||
      (fromColumn === undefined && toColumn === undefined)
    );
  }

  function equals(other: Range): boolean {
    return (
      fromRow === other.fromRow &&
      fromColumn === other.fromColumn &&
      toRow === other.toRow &&
      toColumn === other.toColumn
    );
  }

  function merge(other: Range): Range {
    return range(
      Math.min(fromRow, other.fromRow),
      Math.min(fromColumn, other.fromColumn),
      Math.max(toRow, other.toRow),
      Math.max(toColumn, other.toColumn),
    );
  }

  function shape(): [number, number] {
    return [toRow - fromRow, toColumn - fromColumn];
  }

  function toString(): string {
    return `rows ${fromRow} to ${toRow}; columns ${fromColumn} to ${toColumn}`;
  }

  return {
    contains,
    containsMultipleCells,
    equals,
    fromColumn,
    fromRow,
    merge,
    shape,
    toColumn,
    toRow,
    toString,
  };
}

function getExpandedSelectionRangeOnKey(
  key: string,
  focusedCell: Cell,
  selectedRange: Range | undefined,
  data: Record<string, unknown>[],
  leafColumns: LeafColumn[],
): Range {
  if (selectedRange === undefined) {
    return range(focusedCell.rowIndex, focusedCell.columnIndex);
  }
  const r = range(
    Math.min(
      data.length - 1,
      selectedRange.fromRow +
        (selectedRange.fromRow > focusedCell.rowIndex
          ? 0
          : key === "ArrowUp" && selectedRange.toRow === focusedCell.rowIndex
            ? -1
            : key === "ArrowDown" &&
                selectedRange.toRow === focusedCell.rowIndex
              ? 1
              : 0),
    ),
    Math.min(
      leafColumns.length - 1,
      selectedRange.fromColumn +
        (selectedRange.fromColumn > focusedCell.columnIndex
          ? 0
          : key === "ArrowLeft" &&
              selectedRange.toColumn === focusedCell.columnIndex
            ? -1
            : key === "ArrowRight" &&
                selectedRange.toColumn === focusedCell.columnIndex
              ? 1
              : 0),
    ),
    Math.min(
      data.length - 1,
      selectedRange.toRow +
        (selectedRange.toRow <= focusedCell.rowIndex
          ? 0
          : key === "ArrowUp"
            ? -1
            : key === "ArrowDown"
              ? 1
              : 0),
    ),
    Math.min(
      leafColumns.length - 1,
      selectedRange.toColumn +
        (selectedRange.toColumn <= focusedCell.columnIndex
          ? 0
          : key === "ArrowLeft"
            ? -1
            : key === "ArrowRight"
              ? 1
              : 0),
    ),
  );
  return r;
}

function getCopyMatrix(
  data: DataRow[],
  leafColumns: LeafColumn[],
  selectedRanges: IndexedArray<Range>,
): unknown[][] {
  if (selectedRanges === null || selectedRanges.length === 0) {
    return [];
  }

  const mergedRange = getMergedRangeFromRanges(selectedRanges);
  const [numRows, numCols] = mergedRange.shape();
  const matrix = Array.from(Array(numRows + 1), () =>
    new Array(numCols + 1).fill("\\0"),
  );

  for (let row = mergedRange.fromRow; row <= mergedRange.toRow; row++) {
    const dataRow = data[row];
    const rowIndex = row - mergedRange.fromRow;

    if (!dataRow) {
      continue;
    }

    for (
      let column = mergedRange.fromColumn;
      column <= mergedRange.toColumn;
      column++
    ) {
      const columnIndex = column - mergedRange.fromColumn;

      // Don't write to matrix if cell is not selected
      if (selectedRanges.every((range) => !range.contains(row, column))) {
        continue;
      }

      const columnDef = leafColumns[column];

      if (!columnDef || !matrix[rowIndex]) {
        continue;
      }

      // TODO: Verify valueGetter design
      // if (columnDef?.valueGetter) {
      // matrix[rowIndex][columnIndex] = columnDef.valueGetter({
      // colDef: columnDef,
      // data: dataRow,
      // value: dataRow[columnDef.field],
      // });
      // continue;
      // }

      if (columnDef?.valueRenderer) {
        const renderedValue = columnDef.valueRenderer({
          columnDef,
          data: dataRow,
          value: dataRow[columnDef.field],
        });

        if (typeof renderedValue !== "object") {
          matrix[rowIndex][columnIndex] = renderedValue;
          continue;
        }
      }

      matrix[rowIndex][columnIndex] = dataRow[columnDef.field] ?? "";
    }
  }

  return matrix;
}

function createPasteMatrix(s: string): string[][] {
  return s.split("\n").map((row: string) => row.split("\t"));
}

function getEditRowsFromPasteMatrix(
  matrix: string[][],
  data: DataRow[],
  leafColumns: LeafColumn[],
  selectedRanges: Range[],
  focusedCell: Cell | null,
  rowId?: string,
  columnSpans?: string,
) {
  const editRows: { [key: string]: { [key: string]: unknown } } = {};
  const selectedRange = selectedRanges[0];

  if (
    matrix.length === 1 &&
    matrix[0]?.length === 1 &&
    selectedRange &&
    selectedRange.containsMultipleCells()
  ) {
    const pasteValue = matrix[0]?.[0];
    if (pasteValue === undefined || isNullLikeCharacter(pasteValue)) {
      return editRows;
    }

    for (
      let rowIndex = selectedRange.fromRow;
      rowIndex <= selectedRange.toRow;
      rowIndex++
    ) {
      const editRow: { [key: string]: unknown } = {};
      const rowData = data[rowIndex];
      // TODO: Apply columnSpan logic
      // const colSpans = rowData?.[columnSpans];

      if (!rowData) {
        continue;
      }

      for (
        let columnIndex = selectedRange.fromColumn;
        columnIndex <= selectedRange.toColumn;
        columnIndex++
      ) {
        let columnDef = leafColumns[columnIndex];
        if (!columnDef) {
          break;
        }

        if (
          !isCellEditable({ columnIndex, rowIndex }, rowData, columnDef) ||
          isColumnSpanned(rowData, columnSpans, columnIndex)
        ) {
          continue;
        }
        // TODO: Apply columnSpan logic
        // columnDef = applyColumnSpanDefDefaults(getColumnSpan(colSpans, columnIndex, 'from'), columnDef);
        //
        editRow[columnDef.field] = columnDef.valueParser(pasteValue);
      }

      if (Object.keys(editRow).length > 0) {
        editRows[rowId ? (rowData[rowId] as string) : rowIndex] = editRow;
      }
    }
  } else if (focusedCell) {
    let pasteRowIndex = 0;
    for (
      let rowIndex = focusedCell.rowIndex;
      rowIndex < focusedCell.rowIndex + matrix.length;
      rowIndex++
    ) {
      const rowData = data[rowIndex];
      const pasteRow = matrix[pasteRowIndex];
      if (!rowData || !pasteRow) {
        continue;
      }
      const editRow: { [key: string]: unknown } = {};

      for (
        let pasteColumnIndex = 0;
        pasteColumnIndex < pasteRow.length;
        pasteColumnIndex++
      ) {
        let columnDef = leafColumns[focusedCell.columnIndex + pasteColumnIndex];
        if (!columnDef) {
          break;
        }

        if (
          !isCellEditable(
            {
              columnIndex: focusedCell.columnIndex + pasteColumnIndex,
              rowIndex,
            },
            rowData,
            columnDef,
          ) ||
          isColumnSpanned(
            rowData,
            columnSpans,
            focusedCell.columnIndex + pasteColumnIndex,
          )
        ) {
          continue;
        }
        // TODO: Apply columnSpan logic
        // columnDef = applyColumnSpanDefDefaults(getColumnSpan(colSpans, focusedCell.columnIndex + pasteColumnIndex, 'from'), columnDef);
        //
        editRow[columnDef.field] = columnDef.valueParser(
          pasteRow[pasteColumnIndex],
        );
      }

      if (Object.keys(editRow).length > 0) {
        editRows[rowId ? (rowData[rowId] as string) : rowIndex] = editRow;
      }
      pasteRowIndex++;
    }
  }
  return editRows;
}

function isNullLikeCharacter(char: string): boolean {
  return char === "\\0";
}

function getMergedRangeFromRanges(ranges: IndexedArray<Range>): Range {
  return ranges
    .slice(1)
    .reduce(
      (merged: Range, range: Range) => merged.merge(range),
      ranges[0] as Range,
    );
}

function isKeyboardEvent(
  e:
    | KeyboardEvent<HTMLDivElement>
    | PointerEvent
    | ReactPointerEvent<HTMLDivElement>
    | MouseEvent<HTMLDivElement>,
): e is KeyboardEvent<HTMLDivElement> {
  return (e as KeyboardEvent<HTMLDivElement>).key !== undefined;
}

function isMouseEvent(
  e:
    | KeyboardEvent<HTMLDivElement>
    | PointerEvent
    | ReactPointerEvent<HTMLDivElement>
    | MouseEvent<HTMLDivElement>,
): e is MouseEvent<HTMLDivElement> {
  return (
    (e as KeyboardEvent<HTMLDivElement>).key === undefined &&
    (e as PointerEvent | ReactPointerEvent<HTMLDivElement>).pointerId ===
      undefined
  );
}

// TODO: Move to a utils file
function spread(start: number, end: number) {
  return Array.from({ length: end - start }, (v, i) => start + i);
}

function getRowSpans(
  leafColumns: LeafColumn[],
  data: DataRow[],
  visibleColumns: number[],
  visibleRows: number[],
  colSpans: { [key: string]: { [key: string]: number } } | undefined,
): { [key: string]: { [key: string]: number } } {
  const spans: { [key: string]: { [key: string]: number } } = {};

  for (let columnIndex of visibleColumns) {
    const colDef = leafColumns[columnIndex];
    if (!colDef) {
      continue;
    }
    const { field, rowSpanComparator, rowSpanning } = colDef;
    if (!rowSpanning) {
      continue;
    }
    let endIndex = visibleRows.at(-1);
    if (!endIndex) {
      continue;
    }

    for (let rowIndex of visibleRows) {
      spans[rowIndex] ??= {};

      const spannedCell = colSpans?.[rowIndex]?.[columnIndex] ?? 0;
      if (spannedCell > 0) {
        spans[rowIndex][columnIndex] = 1;
        continue;
      }

      let span = 1;
      while (rowIndex + span <= endIndex + 1) {
        const currentRow = data[rowIndex];
        const nextRow = data[rowIndex + span];
        if (
          currentRow &&
          nextRow &&
          rowSpanComparator(
            colDef.valueRenderer({
              columnDef: colDef,
              data: currentRow,
              value: currentRow[field],
            }),
            colDef.valueRenderer({
              columnDef: colDef,
              data: nextRow,
              value: nextRow[field],
            }),
          ) &&
          [undefined, 0].includes(colSpans?.[rowIndex + span]?.[columnIndex])
        ) {
          if (rowIndex + span > endIndex) {
            spans[rowIndex][columnIndex] = span;
            break;
          }
          span += 1;
        } else {
          spans[rowIndex][columnIndex] = span;
          break;
        }
      }
    }
  }
  return spans;
}

function getColumnSpans(
  key: string,
  data: DataRow[],
  visibleColumns: number[],
  visibleRows: number[],
) {
  const spans: { [key: string]: { [key: string]: number } } = {};
  for (let rowIndex of visibleRows) {
    const row = data[rowIndex];
    if (!row) {
      continue;
    }
    const endIndex = visibleColumns.at(-1);
    if (!endIndex) {
      continue;
    }

    const columnSpans = row[key];
    if (!isColumnSpans(columnSpans)) {
      continue;
    }
    for (let columnIndex of visibleColumns) {
      spans[rowIndex] ??= {};
      const columnSpan = columnSpans.find(
        (cs: { field: string; from: number; to: number }) =>
          cs.from <= columnIndex && columnIndex <= cs.to,
      );
      if (columnSpan !== undefined) {
        spans[rowIndex][columnIndex] = columnSpan.to - columnIndex;
      } else {
        spans[rowIndex][columnIndex] = 0;
      }
    }
  }
  return spans;
}
// function getColumnSpanz(
// leafColumns: LeafColumn[],
// data: DataRow[],
// visibleColumns: number[],
// visibleRows: number[],
// ) {
// const spans: { [key: string]: { [key: string]: number } } = {};
//
// for (let rowIndex of visibleRows) {
// const row = data[rowIndex];
// if (!row) {
// continue;
// }
// let endIndex = visibleColumns.at(-1);
// if (!endIndex) {
// continue;
// }
//
// for (let columnIndex of visibleColumns) {
// const colDef = leafColumns[columnIndex];
// if (!colDef) {
// continue;
// }
// let span = 1;
// spans[rowIndex] ??= {};
// const { columnSpanning, columnSpanComparator, field } = colDef;
// if (!columnSpanning) {
// spans[rowIndex][columnIndex] = span;
// } else {
// while (columnIndex + span <= endIndex + 1) {
// const nextColumnDef = leafColumns[columnIndex + span];
// if (
// nextColumnDef &&
// columnSpanComparator(
// colDef.valueRenderer({
// columnDef: colDef,
// data: row,
// value: row[colDef.field],
// }),
// nextColumnDef.valueRenderer({
// columnDef: nextColumnDef,
// data: row,
// value: row[nextColumnDef.field],
// }),
// row,
// )
// ) {
// if (columnIndex + span > endIndex) {
// spans[rowIndex][columnIndex] = span;
// break;
// }
// span += 1;
// } else {
// spans[rowIndex][columnIndex] = span;
// }
// }
// }
// }
// }
// return spans;
// }

function getRowIndex(
  rowIndex: number,
  columnIndex: number,
  data: DataRow[],
  columnDef: LeafColumn,
  columnSpans: string | undefined,
): number {
  let newRowIndex = rowIndex;
  while (newRowIndex > 0) {
    const row = data[newRowIndex];
    const prevRow = data[newRowIndex - 1];
    const rowIsSpanned = isRowSpanned(columnDef, row, prevRow);
    const columnIsSpanned = isColumnSpanned(row, columnSpans, columnIndex);
    if (
      !rowIsSpanned ||
      columnIsSpanned ||
      (rowIsSpanned && isColumnSpanned(prevRow, columnSpans, columnIndex))
    ) {
      break;
    }
    newRowIndex--;
  }
  return newRowIndex;
}

function getLastRowIndex(
  rowIndex: number,
  columnIndex: number,
  data: DataRow[],
  columnDef: LeafColumn,
  columnSpans: string | undefined,
): number {
  let newRowIndex = rowIndex;
  while (newRowIndex < data.length - 1) {
    const row = data[newRowIndex];
    const nextRow = data[newRowIndex + 1];
    const rowIsSpanned = isRowSpanned(columnDef, nextRow, row);
    const columnIsSpanned = isColumnSpanned(row, columnSpans, columnIndex);
    if (
      columnIsSpanned ||
      !rowIsSpanned ||
      (rowIsSpanned && isColumnSpanned(nextRow, columnSpans, columnIndex))
    ) {
      break;
    }
    newRowIndex++;
  }
  return newRowIndex;
}

function getColumnIndex(
  columnIndex: number,
  row: DataRow,
  columnSpans: string | undefined,
  boundary: "start" | "end" = "start",
): number {
  if (!row || !columnSpans) {
    return columnIndex;
  }
  const colSpans = row[columnSpans];
  if (!isColumnSpans(colSpans)) {
    return columnIndex;
  }
  const span = colSpans.find(
    // span.from <= columnIndex ? what's the impact ?
    (span) => span.from <= columnIndex && columnIndex <= span.to,
  );
  if (span === undefined) {
    return columnIndex;
  }
  if (boundary === "start") {
    return span.from;
  }
  return span.to;
}

function isRowSpanned(
  columnDef: LeafColumn,
  row: DataRow | undefined,
  prevRow: DataRow | undefined,
): boolean {
  return (
    columnDef.rowSpanning &&
    row !== undefined &&
    prevRow !== undefined &&
    columnDef.rowSpanComparator(
      columnDef.valueRenderer({
        columnDef,
        data: prevRow,
        value: prevRow[columnDef.field],
      }),
      columnDef.valueRenderer({
        columnDef,
        data: row,
        value: row[columnDef.field],
      }),
    )
  );
}

function isColumnSpanned(
  row: DataRow | undefined,
  columnSpans: string | undefined,
  columnIndex: number,
): boolean {
  if (!row || !columnSpans) {
    return false;
  }
  const colSpans = row[columnSpans];
  if (
    isColumnSpans(colSpans) &&
    colSpans.find((span) => span.from < columnIndex && columnIndex <= span.to)
  ) {
    return true;
  }
  return false;
}

function isColumnSpans(columnSpans: unknown): columnSpans is ColumnSpan[] {
  return (
    Array.isArray(columnSpans) &&
    columnSpans.every(
      (columnSpan) =>
        typeof columnSpan.field === "string" &&
        typeof columnSpan.from === "number" &&
        typeof columnSpan.to === "number",
    )
  );
}

function isCellFocused(
  cell: Cell | null,
  rowIndex: number,
  columnIndex: number,
  endRowIndex: number,
  endColumnIndex: number,
) {
  if (!cell) {
    return false;
  }
  const matchesColumn =
    columnIndex <= cell.columnIndex && cell.columnIndex <= endColumnIndex;
  const matchesRow = rowIndex <= cell.rowIndex && cell.rowIndex <= endRowIndex;
  return matchesColumn && matchesRow;
}

function getColumnSpan(
  spans: ColumnSpan[] | undefined,
  columnIndex: number,
  condition: "from" | "in" = "in",
): ColumnSpan | undefined {
  if (!Array.isArray(spans)) {
    return;
  }

  return spans.find(({ from, to }) => {
    if (condition === "from") {
      return columnIndex === from;
    }
    return from <= columnIndex && columnIndex <= to;
  });
}

function isSameCell(cellA: Cell | undefined, cellB: Cell | undefined) {
  return (
    cellA?.rowIndex === cellB?.rowIndex &&
    cellA?.columnIndex === cellB?.columnIndex
  );
}

function isKeyDownPrintable(e: KeyboardEvent) {
  return !e.metaKey && !e.ctrlKey && e.key.length === 1;
}

function isCellEditable(
  cell: Cell,
  row: DataRow,
  columnDef: LeafColumn,
): boolean {
  if (typeof columnDef.editable === "function") {
    return columnDef.editable({
      data: row,
      rowIndex: cell.rowIndex,
      value: row[columnDef.field],
    });
  }
  return columnDef.editable;
}

function isPointerEvent(
  event: ReactPointerEvent | MouseEvent,
): event is ReactPointerEvent {
  return event.type.startsWith("pointer");
}
