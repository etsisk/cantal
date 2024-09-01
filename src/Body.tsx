import {
  type CSSProperties,
  type PointerEvent,
  type RefObject,
  type SyntheticEvent,
  type UIEvent,
  useEffect,
  useRef,
} from "react";
import { Cell } from "./Cell";
import type { ColumnDefWithDefaults, LeafColumn, Position } from "./Grid";

export interface Cell {
  columnIndex: number;
  rowIndex: number;
}

interface BodyProps {
  canvasWidth: string;
  containerRef: RefObject<HTMLDivElement | null>;
  data: any[];
  focusedCell: Cell | null;
  handleFocusedCellChange: (focusCell: Cell, e: SyntheticEvent) => void;
  headerViewportRef: RefObject<HTMLDivElement | null>;
  leafColumns: ColumnDefWithDefaults[];
  positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>;
  styles: CSSProperties;
}

export function Body({
  canvasWidth,
  containerRef,
  data,
  focusedCell,
  handleFocusedCellChange,
  headerViewportRef,
  leafColumns,
  positions,
  styles,
}: BodyProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
      const boxSizing =
        getComputedStyle(containerRef.current)?.boxSizing ?? "content-box";
      const containerHeight =
        boxSizing === "content-box"
          ? containerRef.current.clientHeight
          : containerRef.current.offsetHeight;
      viewportRef.current.style.height = `${
        containerHeight - headerViewportRef.current.offsetHeight
      }px`;
    }
  }, []);

  // QUESTION: Pass these values down to avoid duplicate work?
  const pinnedStartLeafColumns = leafColumns.filter(
    (lc) => lc.pinned === "start",
  );
  const pinnedEndLeafColumns = leafColumns.filter((lc) => lc.pinned === "end");
  const unpinnedLeafColumns = leafColumns.filter(
    (lc) => lc.pinned !== "start" && lc.pinned !== "end",
  );

  function handleEvent(e: PointerEvent, eventLabel: string) {}
  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    const cell = getCellFromEvent(e);
    if (!cell) {
      return;
    }
    handleFocusedCellChange(cell, e);
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
    backgroundColor: 'var(--background-color)',
    display: 'grid',
    gridTemplateColumns: 'subgrid',
    insetInline: 0,
    position: 'sticky',
  }

  const pinnedStartStyles = {
    ...pinnedStyles,
    gridColumn: `1 / ${pinnedStartLeafColumns.length + 1}`,
  };

  const unpinnedStyles = {
    ...styles,
    display: 'grid',
    gridColumn: `${pinnedStartLeafColumns.length + 1} / ${leafColumns.length - pinnedEndLeafColumns.length + 1}`,
    gridTemplateColumns: 'subgrid',
  };

  const pinnedEndStyles = {
    ...pinnedStyles,
    gridColumn: `${leafColumns.length - pinnedEndLeafColumns.length + 1} / ${leafColumns.length + 1}`,
  }

  return (
    <div
      className="cantal-body-viewport"
      onScroll={handleScroll}
      ref={viewportRef}
      style={viewportStyles}
    >
      <div
        className="cantal-body-canvas"
        onPointerDown={handlePointerDown}
        onPointerUp={(e: PointerEvent<HTMLDivElement>) =>
          handleEvent(e, "onPointerUp")
        }
        style={canvasStyles}
      >
        <div className="cantal-focus-sink"></div>
        <div
          className="cantal-body"
          style={{
            display: "grid",
            ...styles,
          }}
        >
          {pinnedStartLeafColumns.length > 0 || pinnedEndLeafColumns.length > 0 ? (
            <>
              {pinnedStartLeafColumns.length > 0 && (
                <div className="cantal-body-pinned-start" style={pinnedStartStyles}>
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
