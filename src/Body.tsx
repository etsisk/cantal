import {
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
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
  getColumnEndBoundary,
  getColumnStartBoundary,
  type ColumnDefWithDefaults,
  type DataRow,
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

type Direction = "left" | "right" | "up" | "down";

interface BodyProps {
  canvasWidth: string;
  columnGap: number;
  containerHeight: number;
  data: any[];
  focusedCell?: Cell | null;
  handleFocusedCellChange: (
    focusCell: Cell,
    e: SyntheticEvent,
    point?: Point,
  ) => void;
  handleKeyDown: (args: HandleKeyDownArgs) => void;
  handlePointerDown: (args: HandlePointerDownArgs) => void;
  handleSelection?: (
    selectedRanges: IndexedArray<Range>,
    endPoint: Point | null,
    e:
      | PointerEvent
      | ReactPointerEvent<HTMLDivElement>
      | KeyboardEvent<HTMLDivElement>,
  ) => void;
  headerViewportRef: RefObject<HTMLDivElement | null>;
  leafColumns: LeafColumn[];
  overscanColumns: number;
  overscanRows: number;
  positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>;
  rowGap: number;
  rowHeight?: number;
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
  containerHeight,
  data,
  focusedCell = null,
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
    if (/*!editCell && */ focusedCell && focusedCellRef.current) {
      focusedCellRef.current.focus();
    }
  }, [/*editCell, */ focusedCell]);

  useEffect(() => {
    if (!focusedCell || !viewportRef.current) {
      return;
    }
    // TODO: Are there edge cases with virtualization
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
    if (viewportRect.left !== null && cellInlineStart < viewportRect.left) {
      viewportRef.current.scrollLeft = cellInlineStart;
    } else if (cellInlineEnd > viewportRect.right) {
      viewportRef.current.scrollLeft = cellInlineEnd - viewportRect.width;
    }

    if (cellBlockStart < viewportRect.top) {
      viewportRef.current.scrollTop = cellBlockStart;
    } else if (cellBlockEnd > viewportRect.bottom) {
      viewportRef.current.scrollTop = cellBlockEnd - viewportRect.height;
    }
  }, [columnGap, focusedCell, leafColumns]);

  // QUESTION: use useRef instead?
  useEffect(() => {
    function pointerMove(e: PointerEvent): void {
      const cell = getCellFromEvent(e);
      const point = canvasRef.current
        ? getPointFromEvent(e, canvasRef.current)
        : null;

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
      if (showSelectionBox && point !== null) {
        setEndDragPoint(point);
      }
    }

    function pointerUp(e: PointerEvent) {
      handleSelection?.(selectedRanges, null, e);
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
    const startBoundary = pinnedStartColumns.length
      ? getColumnStartBoundary(
          pinnedStartColumns.length,
          leafColumns,
          columnGap,
        )
      : scrollLeft;
    const endBoundary = pinnedEndColumns.length
      ? scrollLeft +
        offsetWidth -
        getColumnEndBoundary(
          pinnedEndColumns.length - leafColumns.length,
          leafColumns,
          columnGap,
        )
      : scrollLeft + offsetWidth;
    if (startBoundary !== null) {
      const bRect = viewport.getBoundingClientRect();
      console.log({
        hand: {
          bottom: scrollTop + offsetHeight,
          height: offsetHeight,
          left: startBoundary,
          right: endBoundary,
          top: scrollTop,
          width: endBoundary - startBoundary,
        },
        dom: {
          ...bRect,
          left: scrollLeft,
          right: bRect.width + scrollLeft,
        },
      });
      // TODO: Consider using getBoundingClientRect as a fallback
      return {
        bottom: scrollTop + offsetHeight,
        height: offsetHeight,
        left: startBoundary,
        right: endBoundary,
        top: scrollTop,
        width: endBoundary - startBoundary,
      };
    }
    return {
      bottom: scrollTop + offsetHeight,
      height: offsetHeight,
      left: startBoundary, // ?
      right: endBoundary,
      top: scrollTop,
      width: endBoundary - startBoundary, // ?
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

      const firstVisibleColumn = Math.max(
        (columnEndBoundaries.findIndex((b) => b > startBoundary) ?? 0) -
          overscanColumns,
        0,
      );
      const lastVisibleColumn =
        Math.min(
          (columnEndBoundaries.findIndex((b) => b > endBoundary) ?? 0) +
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
    const str = getCopyMatrix(data, leafColumns, selectedRanges)
      .map((row) => row.join("\t"))
      .join("\n");
    navigator.clipboard.writeText(str);
  }

  function handleEvent(
    e: PointerEvent | ReactPointerEvent<HTMLDivElement>,
    eventLabel: string,
  ) {}

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
          null,
          e,
        );
      } else {
        navigateCell(e, dir);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      navigateCell(e, e.shiftKey ? "left" : "right", true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      navigateCell(e, e.shiftKey ? "up" : "down");
    } else if (e.key === "c" && (e.metaKey || e.ctrlKey)) {
      handleCopy();
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
    if (dir === "up") {
      if (focusedCell.rowIndex === 0) {
        return false;
      }
      // First check if rowSpans exist for column
      const hasSpans =
        !!rowSpans?.[focusedCell.rowIndex]?.[focusedCell.columnIndex];
      let rowOffset = 1;
      if (hasSpans) {
        while (focusedCell.rowIndex - rowOffset > 0) {
          const row = rowSpans[focusedCell.rowIndex - rowOffset];
          if (row) {
            const span = row[focusedCell.columnIndex];
            if (span === 1) {
              break;
            }
            rowOffset += 1;
          } else {
            return false;
          }
        }
      }
      const offset = hasSpans ? rowOffset : 1;
      const newFocusedCell = {
        ...focusedCell,
        rowIndex: focusedCell.rowIndex - offset,
      };

      handleFocusedCellChange(newFocusedCell, e);
      setSelectionRangeToFocusedCell(newFocusedCell, e);
    } else if (dir === "down") {
      if (focusedCell.rowIndex >= data.length - 1) {
        return false;
      }

      const offset =
        rowSpans?.[focusedCell.rowIndex]?.[focusedCell.columnIndex] ?? 1;
      if (focusedCell.rowIndex + offset > data.length - 1) {
        return false;
      }
      const newFocusedCell = {
        ...focusedCell,
        rowIndex: focusedCell.rowIndex + offset,
      };

      handleFocusedCellChange(newFocusedCell, e);
      setSelectionRangeToFocusedCell(newFocusedCell, e);
    } else if (dir === "left") {
      if (focusedCell.columnIndex === 0) {
        if (wrap) {
          if (focusedCell.rowIndex === 0) {
            return false;
          }

          const newFocusedCell = {
            ...focusedCell,
            columnIndex: leafColumns.length - 1,
            rowIndex: focusedCell.rowIndex - 1,
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
        columnIndex: focusedCell.columnIndex - 1,
      };

      handleFocusedCellChange(newFocusedCell, e);
      setSelectionRangeToFocusedCell(newFocusedCell, e);
    } else if (dir === "right") {
      if (focusedCell.columnIndex >= leafColumns.length - 1) {
        if (wrap) {
          if (focusedCell.rowIndex >= data.length - 1) {
            // Remove focus from the grid
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

      const newFocusedCell = {
        ...focusedCell,
        columnIndex: focusedCell.columnIndex + 1,
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
      | KeyboardEvent<HTMLDivElement>,
  ) {
    if (selectionFollowsFocus && handleSelection) {
      const point = getPointFromEvent(e, canvasRef.current);

      handleSelection(
        [range(focusedCell.rowIndex, focusedCell.columnIndex)],
        point,
        // getSelectionRangeWithMergedCells(
        //   new Range(focusedCell.rowIdx, focusedCell.colIdx),
        //   rangeSelectionBehavior,
        //   leafColumns,
        //   data,
        //   hasGridBodyAreas,
        //   columnSpansByRow
        // ),
        e,
      );
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const cell = getCellFromEvent(e);
    const point = getPointFromEvent(e, canvasRef.current);

    if (!cell || !point) {
      return;
    }

    const columnDef = leafColumns[cell.columnIndex];

    if (!columnDef) {
      return;
    }

    handlePointerDown({
      e,
      cell,
      point,
      columnDef,
      defaultHandler: () => defaultHandlePointerDown(e, cell, point),
    });
    // Allow DIV elements to take focus
    e.preventDefault();
    // Persist event object across function calls
    e.persist();
  }

  function defaultHandlePointerDown(
    e: ReactPointerEvent<HTMLDivElement>,
    cell: Cell,
    point: Point,
  ): void {
    // if (isSameCell(cell, editCell)) {
    //   return;
    // }

    // if (editCell) {
    //   commitCellEdit();
    // }

    if (
      e.shiftKey &&
      focusedCell &&
      selectedRanges &&
      selectedRanges.length > 0 &&
      handleSelection
    ) {
      handleSelection(
        //   getSelectionRangeWithMergedCells(
        [
          range(focusedCell.rowIndex, focusedCell.columnIndex).merge(
            range(cell.rowIndex, cell.columnIndex),
          ),
        ],
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
    if (e.button === 0 && !e.ctrlKey) {
      handleFocusedCellChange(cell, e, point);

      if (handleSelection) {
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

  const rowSpans = leafColumns
    .slice(visibleColumnStart, visibleColumnEnd + 1)
    .some((lc) => lc.rowSpanning)
    ? getRowSpans(leafColumns, data, visibleColumns, visibleRows)
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
                        const relativeRowIndex =
                          (virtual === true || virtual === "rows") &&
                          visibleRows[0]
                            ? rowIndex - visibleRows[0]
                            : rowIndex;
                        if (
                          columnDef.rowSpanning &&
                          visibleRows[relativeRowIndex - 1] !== undefined &&
                          columnDef.rowSpanComparator(
                            columnDef.valueRenderer({
                              columnDef,
                              data: data[rowIndex - 1],
                              value: data[rowIndex - 1][columnDef.field],
                            }),
                            columnDef.valueRenderer({
                              columnDef,
                              data: row,
                              value: row[columnDef.field],
                            }),
                          )
                        ) {
                          return null;
                        }
                        const rowSpan = rowSpans?.[rowIndex]?.[columnIndex];
                        const isFocused =
                          rowSpan && rowSpan > 1
                            ? focusedCell?.columnIndex === columnIndex &&
                              focusedCell?.rowIndex >= rowIndex &&
                              focusedCell?.rowIndex < rowIndex + rowSpan
                            : focusedCell?.rowIndex === rowIndex &&
                              focusedCell?.columnIndex === columnIndex;
                        return (
                          <Cell
                            ariaLabel={
                              typeof columnDef.ariaCellLabel === "function"
                                ? columnDef.ariaCellLabel({
                                    columnIndex,
                                    data: row,
                                    def: columnDef,
                                    rowIndex,
                                    value: row[columnDef.field],
                                  })
                                : columnDef.ariaCellLabel
                            }
                            columnDef={columnDef}
                            columnIndex={columnIndex}
                            isFocused={isFocused}
                            key={`${rowIndex}-${columnIndex}`}
                            position={positions.get(columnDef)}
                            rowIndex={rowIndex}
                            rowIndexRelative={relativeRowIndex}
                            rowSpan={rowSpan}
                            selected={rangesContainCell(selectedRanges, {
                              columnIndex,
                              rowIndex,
                            })}
                          >
                            {columnDef.valueRenderer({
                              columnDef,
                              data: row,
                              value: row[columnDef.field],
                            })}
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
                      const relativeRowIndex =
                        (virtual === true || virtual === "rows") &&
                        visibleRows[0]
                          ? rowIndex - visibleRows[0]
                          : rowIndex;
                      if (
                        columnDef.rowSpanning &&
                        visibleRows[relativeRowIndex - 1] !== undefined &&
                        columnDef.rowSpanComparator(
                          columnDef.valueRenderer({
                            columnDef,
                            data: data[rowIndex - 1],
                            value: data[rowIndex - 1][columnDef.field],
                          }),
                          columnDef.valueRenderer({
                            columnDef,
                            data: row,
                            value: row[columnDef.field],
                          }),
                        )
                      ) {
                        return null;
                      }
                      // TODO: Can we avoid 'colIndex' calculation?
                      const colIndex =
                        columnIndex + pinnedStartLeafColumns.length;
                      const rowSpan = rowSpans?.[rowIndex]?.[colIndex];
                      const isFocused =
                        rowSpan && rowSpan > 1
                          ? focusedCell?.columnIndex === colIndex &&
                            focusedCell?.rowIndex >= rowIndex &&
                            focusedCell?.rowIndex < rowIndex + rowSpan
                          : focusedCell?.rowIndex === rowIndex &&
                            focusedCell?.columnIndex === colIndex;
                      return (
                        <Cell
                          ariaLabel={
                            typeof columnDef.ariaCellLabel === "function"
                              ? columnDef.ariaCellLabel({
                                  columnIndex,
                                  data: row,
                                  def: columnDef,
                                  rowIndex,
                                  value: row[columnDef.field],
                                })
                              : columnDef.ariaCellLabel
                          }
                          columnDef={columnDef}
                          columnIndex={colIndex}
                          isFocused={isFocused}
                          key={`${rowIndex}-${colIndex}`}
                          position={positions.get(columnDef)}
                          rowIndex={rowIndex}
                          rowIndexRelative={relativeRowIndex}
                          rowSpan={rowSpan}
                          selected={rangesContainCell(selectedRanges, {
                            columnIndex,
                            rowIndex,
                          })}
                        >
                          {columnDef.valueRenderer({
                            columnDef,
                            data: row,
                            value: row[columnDef.field],
                          })}
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
                        const relativeRowIndex =
                          (virtual === true || virtual === "rows") &&
                          visibleRows[0]
                            ? rowIndex - visibleRows[0]
                            : rowIndex;
                        if (
                          columnDef.rowSpanning &&
                          visibleRows[relativeRowIndex - 1] !== undefined &&
                          columnDef.rowSpanComparator(
                            columnDef.valueRenderer({
                              columnDef,
                              data: data[rowIndex - 1],
                              value: data[rowIndex - 1][columnDef.field],
                            }),
                            columnDef.valueRenderer({
                              columnDef,
                              data: row,
                              value: row[columnDef.field],
                            }),
                          )
                        ) {
                          return null;
                        }
                        // TODO: Can we avoid 'colIndex' calculation?
                        const colIndex =
                          columnIndex +
                          pinnedStartLeafColumns.length +
                          unpinnedLeafColumns.length;
                        const rowSpan = rowSpans?.[rowIndex]?.[colIndex];
                        const isFocused =
                          rowSpan && rowSpan > 1
                            ? focusedCell?.columnIndex === colIndex &&
                              focusedCell?.rowIndex >= rowIndex &&
                              focusedCell?.rowIndex < rowIndex + rowSpan
                            : focusedCell?.rowIndex === rowIndex &&
                              focusedCell?.columnIndex === colIndex;
                        return (
                          <Cell
                            ariaLabel={
                              typeof columnDef.ariaCellLabel === "function"
                                ? columnDef.ariaCellLabel({
                                    columnIndex,
                                    data: row,
                                    def: columnDef,
                                    rowIndex,
                                    value: row[columnDef.field],
                                  })
                                : columnDef.ariaCellLabel
                            }
                            columnDef={columnDef}
                            columnIndex={colIndex}
                            isFocused={isFocused}
                            key={`${rowIndex}-${colIndex}`}
                            position={positions.get(columnDef)}
                            rowIndex={rowIndex}
                            rowIndexRelative={relativeRowIndex}
                            rowSpan={rowSpan}
                            selected={rangesContainCell(selectedRanges, {
                              columnIndex,
                              rowIndex,
                            })}
                          >
                            {columnDef.valueRenderer({
                              columnDef,
                              data: row,
                              value: row[columnDef.field],
                            })}
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
                  const relativeRowIndex =
                    (virtual === true || virtual === "rows") && visibleRows[0]
                      ? rowIndex - visibleRows[0]
                      : rowIndex;
                  if (
                    columnDef.rowSpanning &&
                    visibleRows[relativeRowIndex - 1] !== undefined &&
                    columnDef.rowSpanComparator(
                      columnDef.valueRenderer({
                        columnDef,
                        data: data[rowIndex - 1],
                        value: data[rowIndex - 1][columnDef.field],
                      }),
                      columnDef.valueRenderer({
                        columnDef,
                        data: row,
                        value: row[columnDef.field],
                      }),
                    )
                  ) {
                    return null;
                  }
                  const rowSpan = rowSpans?.[rowIndex]?.[columnIndex];
                  const isFocused =
                    rowSpan && rowSpan > 1
                      ? focusedCell?.columnIndex === columnIndex &&
                        focusedCell?.rowIndex >= rowIndex &&
                        focusedCell?.rowIndex < rowIndex + rowSpan
                      : focusedCell?.rowIndex === rowIndex &&
                        focusedCell?.columnIndex === columnIndex;
                  return (
                    <Cell
                      ariaLabel={
                        typeof columnDef.ariaCellLabel === "function"
                          ? columnDef.ariaCellLabel({
                              columnIndex,
                              data: row,
                              def: columnDef,
                              rowIndex,
                              value: row[columnDef.field],
                            })
                          : columnDef.ariaCellLabel
                      }
                      columnDef={columnDef}
                      columnIndex={columnIndex}
                      key={`${rowIndex}-${columnIndex}`}
                      isFocused={isFocused}
                      position={positions.get(columnDef)}
                      rowIndex={rowIndex}
                      rowIndexRelative={relativeRowIndex}
                      rowSpan={rowSpan}
                      selected={rangesContainCell(selectedRanges, {
                        columnIndex,
                        rowIndex,
                      })}
                    >
                      {columnDef.valueRenderer({
                        columnDef,
                        data: row,
                        value: row[columnDef.field],
                      })}
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
    | KeyboardEvent<HTMLDivElement>,
  element: HTMLDivElement | null,
): Point | null {
  if (element === null || isKeyboardEvent(event)) {
    return null;
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
    | ReactPointerEvent<HTMLDivElement>,
): e is KeyboardEvent<HTMLDivElement> {
  return (e as KeyboardEvent<HTMLDivElement>).key !== undefined;
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

      if (!rowSpanning) {
        spans[rowIndex][columnIndex] = 1;
      } else {
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
            )
          ) {
            if (rowIndex + span + 1 > endIndex + 1) {
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
  }
  return spans;
}
