import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SyntheticEvent,
  type UIEvent,
  useCallback,
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
    selectedRanges: Range[],
    endPoint: Point,
    e:
      | PointerEvent
      | ReactPointerEvent<HTMLDivElement>
      | KeyboardEvent<HTMLDivElement>,
  ) => void;
  headerViewportRef: RefObject<HTMLDivElement | null>;
  leafColumns: LeafColumn[];
  positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>;
  rowGap: number;
  rowHeight?: number;
  selectedRanges: Range[];
  selectionFollowsFocus?: boolean;
  showSelectionBox?: boolean;
  styles: CSSProperties;
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
  positions,
  rowGap,
  rowHeight = 27,
  selectedRanges,
  selectionFollowsFocus = false,
  showSelectionBox,
  styles,
}: BodyProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // QUESTION: Should `focusedCellRef` be defined here or on Grid.tsx?
  const focusedCellRef = useRef<HTMLDivElement>(null);
  const [startDragCell, setStartDragCell] = useState<Cell | undefined>(
    undefined,
  );
  const [startDragPoint, setStartDragPoint] = useState<Point | undefined>(
    undefined,
  );
  const [endDragPoint, setEndDragPoint] = useState<Point | undefined>(
    undefined,
  );

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.style.height = `${
        containerHeight - headerViewportRef.current.offsetHeight
      }px`;
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
    if (columnDef === undefined || columnDef.pinned !== undefined) {
      return;
    }
    const viewportRect = getViewportBoundingBox(
      viewportRef.current,
      leafColumns,
      columnGap,
    );
    // TODO: Account for non-pixel based widths (e.g. '1fr')
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

  useEffect(() => {
    function pointerMove(e: PointerEvent): void {
      const cell = getCellFromEvent(e);
      const point = getPointFromEvent(e, canvasRef.current);

      if (!cell) {
        return;
      }

      handleSelection(
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
      if (showSelectionBox) {
        setEndDragPoint(point);
      }
    }

    function pointerUp(e: PointerEvent) {
      handleSelection(selectedRanges, null, e);
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
    return {
      bottom: scrollTop + offsetHeight,
      height: offsetHeight,
      left: startBoundary,
      right: endBoundary,
      top: scrollTop,
      width: endBoundary - startBoundary,
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

    handleKeyDown({
      e,
      cell: focusedCell,
      columnDef: leafColumns[focusedCell.columnIndex],
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
    } else if (e.key === "c" && (e.metaKey || e.ctrlKey)) {
      handleCopy();
    }
  }

  function navigateCell(
    e: KeyboardEvent<HTMLDivElement>,
    dir: Direction,
    wrap: boolean = false,
  ): boolean {
    // QUESTION: Merge into single function?
    // return hasGridBodyAreas
    //   ? navigateCellByGridColumn(event, dir, wrap)
    //   : navigateCellByOne(event, dir, wrap);
    return navigateCellByOne(e, dir, wrap);
  }

  function navigateCellByOne(
    e: KeyboardEvent<HTMLDivElement>,
    dir: Direction,
    wrap: boolean,
  ): boolean {
    if (dir === "up") {
      if (focusedCell.rowIndex === 0) {
        return false;
      }
      const newFocusedCell = {
        ...focusedCell,
        rowIndex: focusedCell.rowIndex - 1,
      };

      handleFocusedCellChange(newFocusedCell, e);
      setSelectionRangeToFocusedCell(newFocusedCell, e);
    } else if (dir === "down") {
      if (focusedCell.rowIndex >= data.length - 1) {
        return false;
      }

      const newFocusedCell = {
        ...focusedCell,
        rowIndex: focusedCell.rowIndex + 1,
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

  function setSelectionRangeToFocusedCell(focusedCell: Cell, e) {
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
    if (!cell) {
      return;
    }

    handlePointerDown({
      e,
      cell,
      point,
      columnDef: leafColumns[cell.columnIndex],
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
  }

  const viewportStyles = {
    overflow: "auto",
    width: "inherit",
  };

  const canvasStyles = {
    width: canvasWidth,
  };

  const pinnedStyles = {
    ...styles,
    backgroundColor: "var(--background-color)",
    display: "grid",
    gridAutoRows: rowHeight,
    gridTemplateColumns: "subgrid",
    insetInline: 0,
    position: "sticky",
  };

  const pinnedStartStyles = {
    ...pinnedStyles,
    gridColumn: `1 / ${pinnedStartLeafColumns.length + 1}`,
  };

  const unpinnedStyles = {
    ...styles,
    display: "grid",
    gridAutoRows: rowHeight,
    gridColumn: `${pinnedStartLeafColumns.length + 1} / ${
      leafColumns.length - pinnedEndLeafColumns.length + 1
    }`,
    gridTemplateColumns: "subgrid",
  };

  const pinnedEndStyles = {
    ...pinnedStyles,
    gridColumn: `${leafColumns.length - pinnedEndLeafColumns.length + 1} / ${
      leafColumns.length + 1
    }`,
  };

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
        {focusedCell && leafColumns[focusedCell.columnIndex] && (
          <div
            aria-label={
              leafColumns[focusedCell.columnIndex].ariaCellLabel instanceof
              Function
                ? leafColumns[focusedCell.columnIndex].ariaCellLabel({
                    def: leafColumns[focusedCell.columnIndex],
                    columnIndex: focusedCell.columnIndex,
                    data: data[focusedCell.rowIndex],
                    rowIndex: focusedCell.rowIndex,
                    value: data[focusedCell.rowIndex]
                      ? data[focusedCell.rowIndex][
                          leafColumns[focusedCell.columnIndex].field
                        ]
                      : null,
                  })
                : leafColumns[focusedCell.columnIndex].ariaCellLabel
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
              ? leafColumns[focusedCell.columnIndex].valueRenderer({
                  columnDef: leafColumns[focusedCell.columnIndex],
                  data: data[focusedCell.rowIndex],
                  value:
                    data[focusedCell.rowIndex][
                      leafColumns[focusedCell.columnIndex].field
                    ],
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
                  {data.map((row, rowIndex) => {
                    return pinnedStartLeafColumns.map(
                      (columnDef, columnIndex) => {
                        const isFocused =
                          focusedCell?.rowIndex === rowIndex &&
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
                            selected={rangesContainCell(selectedRanges, {
                              columnIndex,
                              rowIndex,
                            })}
                          >
                            {row[columnDef.field]}
                          </Cell>
                        );
                      },
                    );
                  })}
                </div>
              )}
              <div className="cantal-body-unpinned" style={unpinnedStyles}>
                {unpinnedLeafColumns.length > 0 &&
                  data.map((row, rowIndex) => {
                    return unpinnedLeafColumns.map((columnDef, columnIndex) => {
                      // TODO: Can we avoid 'colIndex' calculation?
                      const colIndex =
                        columnIndex + pinnedStartLeafColumns.length;
                      const isFocused =
                        focusedCell?.rowIndex === rowIndex &&
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
                          selected={rangesContainCell(selectedRanges, {
                            columnIndex,
                            rowIndex,
                          })}
                        >
                          {row[columnDef.field]}
                        </Cell>
                      );
                    });
                  })}
              </div>
              {pinnedEndLeafColumns.length > 0 && (
                <div className="cantal-body-pinned-end" style={pinnedEndStyles}>
                  {data.map((row, rowIndex) => {
                    return pinnedEndLeafColumns.map(
                      (columnDef, columnIndex) => {
                        // TODO: Can we avoid 'colIndex' calculation?
                        const colIndex =
                          columnIndex +
                          pinnedStartLeafColumns.length +
                          unpinnedLeafColumns.length;
                        const isFocused =
                          focusedCell?.rowIndex === rowIndex &&
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
                            selected={rangesContainCell(selectedRanges, {
                              columnIndex,
                              rowIndex,
                            })}
                          >
                            {row[columnDef.field]}
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
              {data.map((row, rowIndex) => {
                return unpinnedLeafColumns.map((columnDef, columnIndex) => {
                  const isFocused =
                    focusedCell?.rowIndex === rowIndex &&
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
                      selected={rangesContainCell(selectedRanges, {
                        columnIndex,
                        rowIndex,
                      })}
                    >
                      {row[columnDef.field]}
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
  event: PointerEvent | ReactPointerEvent<HTMLDivElement>,
  element: HTMLDivElement,
): Point {
  return {
    x: event.clientX - element.getBoundingClientRect().left,
    y: event.clientY - element.getBoundingClientRect().top,
  };
}

function rangesContainCell(ranges: Range[], cell: Cell): boolean {
  if (!cell) {
    return false;
  }
  for (let i in ranges) {
    const range = ranges[i];

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
  focusedCell: Cell | null,
  selectedRange: Range,
  data: Record<string, unknown>[],
  leafColumns: LeafColumn[],
): Range {
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
  selectedRanges: Range[],
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

      // TODO: Verify valueGetter design
      // if (columnDef.valueGetter) {
      // matrix[rowIndex][columnIndex] = columnDef.valueGetter({
      // colDef: columnDef,
      // data: dataRow,
      // value: dataRow[columnDef.field],
      // });
      // continue;
      // }

      if (columnDef.valueRenderer) {
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

function getMergedRangeFromRanges(ranges: Range[]): Range {
  return ranges
    .slice(1)
    .reduce((merged, range) => merged.merge(range), ranges[0]);
}
