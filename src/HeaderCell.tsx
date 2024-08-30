import { type FC, type PointerEvent,  useRef, useState } from "react";
import { type ColumnDefWithDefaults } from "./Grid";
import type { Position } from "./Header";
import { Resizer } from "./Resizer";
import { Sorter, type SortState } from "./Sorter";

interface HeaderCellProps {
  columnDef: ColumnDefWithDefaults;
  filters: { [key: string]: string };
  filterer: FC | null;
  handleFilter: (field: string, value: string) => void;
  handleResize: (
    columnDef: ColumnDefWithDefaults,
    columnWidth: number,
    delta: number,
  ) => void;
  handleSort: (
    nextSortMode: { [key: string]: string },
    e: PointerEvent<HTMLButtonElement>,
  ) => void;
  position: Position;
  sorts: { [key: string]: string };
}

export function HeaderCell({
  columnDef,
  filterer: Filter = null,
  filters,
  handleFilter,
  handleResize,
  handleSort,
  position,
  sorts,
}: HeaderCellProps) {
  const [width, setWidth] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);

  function handleColumnResize(xDelta: number) {
    const columnWidth = getColumnWidth();
    handleResize(columnDef, columnWidth, xDelta);
  }

  function getColumnWidth() {
    if (typeof columnDef.width === "string") {
      return width;
    }
    return columnDef.width;
  }
  if (columnDef.field === 'fullAddress') {
    console.log(position);
  }
  return (
    <div
      aria-label={
        typeof columnDef?.ariaHeaderCellLabel === "function"
          ? columnDef.ariaHeaderCellLabel({ def: columnDef, position })
          : columnDef.ariaHeaderCellLabel
      }
      className="cantal-headercell"
      data-field={columnDef.field}
      ref={ref}
      role="columnheader"
      style={{
        gridRowStart: position.level + 1,
        gridColumnStart: position.columnIndex + 1,
        gridRowEnd: position.depth + 1,
        gridColumnEnd: position.columnIndexEnd + 1,
        position: columnDef.resizable ? "sticky" : "static",
      }}
    >
      <div className="cantal-headercell-content">
        <div className="cantal-headercell-label">
          {columnDef.sortable ? (
            <>
              <span className="cantal-headercell-label-text">
                {columnDef.title}
              </span>
              <Sorter
                className="cantal-headercell-sorter"
                handleSort={(e) => handleSort(updateSorts(columnDef, sorts), e)}
                state={findState(columnDef, sorts)}
              />
            </>
          ) : (
            columnDef.title
          )}
        </div>
        {columnDef.filterable && Filter && (
          <Filter
            field={columnDef.field}
            handleFilter={handleFilter}
            value={filters[columnDef.field]}
          />
        )}
      </div>
      {columnDef.resizable && (
        <Resizer
          className="cantal-headercell-resizer"
          handleResize={handleColumnResize}
          handleResizeEnd={() => setWidth(0)}
          handleResizeStart={() => {
            if (typeof columnDef.width === "string" && ref.current) {
              const { width } = ref.current.getBoundingClientRect();
              setWidth(width);
            }
          }}
        />
      )}
    </div>
  );
}

function updateSorts(
  def: ColumnDefWithDefaults,
  sorting: { [key: string]: string },
): { [key: string]: string } {
  const currentSortState = def.sortStates.find(
    (state) => state.label === sorting[def.field],
  );
  const nextMode = getNextSortLabel(
    currentSortState,
    def.sortStates.filter((state) => state.iterable !== false),
  );
  return { [def.field]: nextMode };
}

function getNextSortLabel(
  currentState: SortState | undefined,
  states: SortState[],
) {
  const currentIndex = states.findIndex(
    (state) => state.label === currentState?.label,
  );
  const nextIndex = (currentIndex + 1) % states.length;
  return states[nextIndex].label;
}

function findState(
  def: ColumnDefWithDefaults,
  sorting: { [key: string]: string },
): SortState {
  const foundByLabel = def.sortStates.find(
    (state) => state.label === sorting[def.field],
  );
  if (foundByLabel) {
    return foundByLabel;
  }
  const foundByIterable = def.sortStates.find(
    (state) => state.iterable === false,
  );
  if (foundByIterable) {
    return foundByIterable;
  }
  return def.sortStates[0];
}
