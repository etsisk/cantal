import {
  type CSSProperties,
  type PointerEvent,
  type RefObject,
  type SyntheticEvent,
  type UIEvent,
  useEffect,
  useRef,
} from "react";
import type { ColumnDefWithDefaults } from "./Grid";

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
  const pinnedLeftColumns = leafColumns.filter((lc) => lc.pinned === "start");
  const pinnedRightColumns = leafColumns.filter((lc) => lc.pinned === "end");
  const unpinnedColumns = leafColumns.filter(
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
          {pinnedLeftColumns.length > 0 || pinnedRightColumns > 0 ? (
            <>
              {pinnedLeftColumns.length > 0 && (
                <div className="cantal-body-pinned-left">
                  {data.map((row, rowIndex) => {
                    return pinnedLeftColumns.map((columnDef, columnIndex) => {
                      const isFocused =
                        focusedCell?.rowIndex === rowIndex &&
                        focusedCell?.columnIndex === columnIndex;
                      return (
                        <div
                          aria-label={columnDef.ariaCellLabel}
                          className={`cantal-cell-base cantal-cell-pinned-start${
                            isFocused ? " cantal-cell-focused" : ""
                          }`}
                          data-col-idx={columnIndex}
                          data-row-idx={rowIndex}
                          key={`${rowIndex}-${columnIndex}`}
                          role="gridcell"
                        >
                          {row[columnDef.field]}
                        </div>
                      );
                    });
                  })}
                </div>
              )}
              <div className="cantal-body-unpinned">
                {unpinnedColumns.length > 0 &&
                  data.map((row, rowIndex) => {
                    return unpinnedColumns.map((columnDef, colIndex) => {
                      const columnIndex = colIndex + pinnedLeftColumns.length;
                      const isFocused =
                        focusedCell?.rowIndex === rowIndex &&
                        focusedCell?.columnIndex === columnIndex;
                      return (
                        <div
                          aria-label={columnDef.ariaCellLabel}
                          className={`cantal-cell-base${
                            isFocused ? " cantal-cell-focused" : ""
                          }`}
                          data-col-idx={columnIndex}
                          data-row-idx={rowIndex}
                          key={`${rowIndex}-${columnIndex}`}
                          role="gridcell"
                        >
                          {row[columnDef.field]}
                        </div>
                      );
                    });
                  })}
              </div>
              {pinnedRightColumns.length > 0 && (
                <div className="cantal-body-pinned-right">
                  {data.map((row, rowIndex) => {
                    return pinnedRightColumns.map((columnDef, colIndex) => {
                      const columnIndex =
                        colIndex +
                        pinnedLeftColumns.length +
                        unpinnedColumns.length;
                      const isFocused =
                        focusedCell?.rowIndex === rowIndex &&
                        focusedCell?.columnIndex === columnIndex;
                      return (
                        <div
                          aria-label={columnDef.ariaCellLabel}
                          className={`cantal-cell-base cantal-cell-pinned-end${
                            isFocused ? " cantal-cell-focused" : ""
                          }`}
                          data-col-idx={columnIndex}
                          data-row-idx={rowIndex}
                          key={`${rowIndex}-${columnIndex}`}
                          role="gridcell"
                        >
                          {row[columnDef.field]}
                        </div>
                      );
                    });
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {data.map((row, rowIndex) => {
                return unpinnedColumns.map((columnDef, colIndex) => {
                  const columnIndex = colIndex + pinnedLeftColumns.length;
                  const isFocused =
                    focusedCell?.rowIndex === rowIndex &&
                    focusedCell?.columnIndex === columnIndex;
                  return (
                    <div
                      aria-label={columnDef.ariaCellLabel}
                      className={`cantal-cell-base${
                        isFocused ? " cantal-cell-focused" : ""
                      }`}
                      data-col-idx={columnIndex}
                      data-row-idx={rowIndex}
                      key={`${rowIndex}-${columnIndex}`}
                      role="gridcell"
                    >
                      {row[columnDef.field]}
                    </div>
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
