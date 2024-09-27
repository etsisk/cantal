import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type SyntheticEvent,
  type UIEvent,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Cell } from "./Cell";
import {
  getColumnEndBoundary,
  getColumnStartBoundary,
  type ColumnDefWithDefaults,
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
  containerHeight: number;
  data: any[];
  focusedCell: Cell | null;
  handleFocusedCellChange: (
    focusCell: Cell,
    e: SyntheticEvent,
    point?: Point,
  ) => void;
  handleKeyDown: (args: HandleKeyDownArgs) => void;
  handlePointerDown: (args: HandlePointerDownArgs) => void;
  headerViewportRef: RefObject<HTMLDivElement | null>;
  leafColumns: LeafColumn[];
  positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>;
  styles: CSSProperties;
}

export function Body({
  canvasWidth,
  containerHeight,
  data,
  focusedCell,
  handleFocusedCellChange,
  handleKeyDown,
  handlePointerDown,
  headerViewportRef,
  leafColumns,
  positions,
  styles,
}: BodyProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // QUESTION: Should this be defined here or on Grid.tsx?
  const focusedCellRef = useRef<HTMLDivElement>(null);

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
    // TODO: scroll cell into viewport
    // 1. Get columnDef from focusedCell.columnIndex
    // 2. Return early if columnDef is pinned
    // 3. Use arithmetic to calculate offset (column widths, row height, viewport size)
    // 4. Are there edge cases with virtualization
    const columnDef = leafColumns[focusedCell?.columnIndex];
    if (columnDef === undefined || columnDef.pinned !== undefined) {
      return;
    }
    // TODO: Softcode rowHeight
    const rowHeight = 27;
    const viewportRect = getViewportBoundingBox(
      viewportRef.current,
      leafColumns,
    );
    // TODO: Account for non-pixel based widths (e.g. '1fr')
    const cellInlineStart = leafColumns.reduce((offset, def, i) => {
      if (i < focusedCell.columnIndex) {
        // TODO: Avoid hardcoding `rowGap`
        return offset + def.width + 1;
      }
      return offset;
    }, 0);
    const cellInlineEnd = cellInlineStart + columnDef.width;
    const cellBlockStart =
      // TODO: Avoid hardcoding `rowGap`
      rowHeight * focusedCell.rowIndex + focusedCell.rowIndex * 1;
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
  }, [focusedCell, leafColumns]);

  // TODO: Live somewhere else
  // TODO: Pass `columnGap` as a prop from Grid.tsx
  function getViewportBoundingBox(
    viewport: HTMLDivElement,
    leafColumns: LeafColumn[],
    columnGap: number = 1,
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

  function handleEvent(e: PointerEvent, eventLabel: string) {}

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
        focusedCell //&&
        // selectedRanges &&
        // selectedRanges.length > 0 &&
        // handleSelection
      ) {
        // TODO: range rangeSelection
      } else {
        navigateCell(e, dir);
      }
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
    } else if (dir === "down") {
      if (focusedCell.rowIndex >= data.length - 1) {
        return false;
      }

      const newFocusedCell = {
        ...focusedCell,
        rowIndex: focusedCell.rowIndex + 1,
      };

      handleFocusedCellChange(newFocusedCell, e);
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
    }
    return true;
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const cell = getCellFromEvent(e);
    const point = {
      x: e.clientX - canvasRef.current.getBoundingClientRect().left,
      y: e.clientY - canvasRef.current.getBoundingClientRect().top,
    };
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
  }

  function defaultHandlePointerDown(
    e: PointerEvent<HTMLDivElement>,
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
      focusedCell //&&
      // selectedRanges &&
      // selectedRanges.length > 0 &&
      // handleSelection
    ) {
      // handleSelection(
      //   getSelectionRangeWithMergedCells(
      //     new Range(focusedCell.rowIdx, focusedCell.colIdx).merge(
      //       new Range(cell.rowIdx, cell.colIdx)
      //     ),
      //     rangeSelectionBehavior,
      //     leafColumns,
      //     data,
      //     hasGridBodyAreas,
      //     columnSpansByRow
      //   ),
      //   e
      // );
      return;
    }

    // Only start cell drag for a left mouse button down
    if (e.button === 0 && !e.ctrlKey) {
      // if (handleSelection) {
      //   dispatch(startCellDrag(cell));
      // }
      //
      handleFocusedCellChange(cell, e, point);
      // setSelectionRangeToFocusedCell(cell, e);
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
    // TODO: Avoid hard-coding rowHeight
    gridAutoRows: 27,
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
        onPointerUp={(e: PointerEvent<HTMLDivElement>) =>
          handleEvent(e, "onPointerUp")
        }
        ref={canvasRef}
        style={canvasStyles}
      >
        {focusedCell && leafColumns[focusedCell.columnIndex] && (
          <div
            aria-label={
              typeof leafColumns[focusedCell.columnIndex].ariaCellLabel ===
              "function"
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
                            columnDef={columnDef}
                            columnIndex={columnIndex}
                            isFocused={isFocused}
                            key={`${rowIndex}-${columnIndex}`}
                            position={positions.get(columnDef)}
                            rowIndex={rowIndex}
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
                          columnDef={columnDef}
                          columnIndex={colIndex}
                          isFocused={isFocused}
                          key={`${rowIndex}-${colIndex}`}
                          position={positions.get(columnDef)}
                          rowIndex={rowIndex}
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
                            columnDef={columnDef}
                            columnIndex={colIndex}
                            isFocused={isFocused}
                            key={`${rowIndex}-${colIndex}`}
                            position={positions.get(columnDef)}
                            rowIndex={rowIndex}
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
    </div>
  );
}

function getCellFromEvent(event: SyntheticEvent) {
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
