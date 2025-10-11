import {
  type FC,
  type PointerEvent,
  type ReactElement,
  useRef,
  useState,
} from "react";
import type { ColumnDefWithDefaults, NonEmptyArray, Position } from "./Grid";
import { Resizer } from "./Resizer";
import { Sorter, type SortState } from "./Sorter";
import type { FiltererProps } from "./Filter";

interface HeaderCellProps {
  classNames?: {
    container?: string;
    content?: string;
    filter?: string;
    label?: string;
    resizer?: string;
    sorter?: string;
  };
  columnDef: ColumnDefWithDefaults;
  filters: { [key: string]: string };
  filterer: FC<FiltererProps> | null;
  handleFilter: (field: string, value: string) => void;
  handleResize: (
    columnDef: ColumnDefWithDefaults,
    columnWidth: number,
    delta: number,
  ) => void;
  handleSort: (
    nextSortMode: { [key: string]: string } | undefined,
    e: PointerEvent<HTMLButtonElement>,
  ) => void;
  position: Position | undefined;
  sorts: { [key: string]: string };
}

export function HeaderCell({
  classNames,
  columnDef,
  filterer: Filter = null,
  filters,
  handleFilter,
  handleResize,
  handleSort,
  position,
  sorts,
}: HeaderCellProps): ReactElement | null {
  const [width, setWidth] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);

  function handleColumnResize(xDelta: number): void {
    const columnWidth = getColumnWidth();
    handleResize(columnDef, columnWidth, xDelta);
  }

  function getColumnWidth(): number {
    if (typeof columnDef.width === "string") {
      return width;
    }
    return columnDef.width;
  }

  if (position === undefined) {
    console.warn("Column definition not found.");
    return null;
  }

  return (
    <div
      aria-label={
        isFn(columnDef.ariaHeaderCellLabel)
          ? columnDef.ariaHeaderCellLabel({ def: columnDef, position })
          : columnDef.ariaHeaderCellLabel
      }
      className={`cantal-headercell${classNames?.container ? ` ${classNames.container}` : ""}`}
      data-column-end={position.pinnedIndexEnd}
      data-column-start={position.pinnedIndex}
      data-field={columnDef.field}
      data-row-end={position.depth + 1}
      data-row-start={position.level + 1}
      ref={ref}
      role="columnheader"
      style={{
        gridRowStart: position.level + 1,
        gridColumnStart: position.pinnedIndex,
        gridRowEnd: position.depth + 1,
        gridColumnEnd: position.pinnedIndexEnd,
        position: columnDef.resizable ? "sticky" : "static",
      }}
    >
      <div
        className={`cantal-headercell-content${classNames?.content ? ` ${classNames.content}` : ""}`}
      >
        <div
          className={`cantal-headercell-label${classNames?.label ? ` ${classNames.label}` : ""}`}
        >
          {columnDef.sortable && columnDef.sortStates.length ? (
            <>
              <span className="cantal-headercell-label-text">
                {columnDef.title}
              </span>
              <Sorter
                className={`cantal-headercell-sorter${classNames?.sorter ? ` ${classNames.sorter}` : ""}`}
                handleSort={(e) =>
                  handleSort(
                    updateSorts(columnDef.field, sorts, columnDef.sortStates),
                    e,
                  )
                }
                state={findState(columnDef.field, sorts, columnDef.sortStates)}
              />
            </>
          ) : (
            columnDef.title
          )}
        </div>
        {columnDef.filterable && Filter && (
          <Filter
            className={`cantal-headercell-filter${classNames?.filter ? ` ${classNames.filter}` : ""}`}
            field={columnDef.field}
            handleFilter={handleFilter}
            value={filters[columnDef.field]}
          />
        )}
      </div>
      {columnDef.resizable && (
        <Resizer
          className={`cantal-headercell-resizer${classNames?.resizer ? ` ${classNames.resizer}` : ""}`}
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
  field: string,
  sorting: { [key: string]: string },
  states: NonEmptyArray<SortState>,
): { [key: string]: string } | undefined {
  const currentSortState =
    states.find((state) => state.label === sorting[field]) ??
    findState(field, sorting, states);
  const iterableStates = states.filter((state) => state.iterable !== false);

  if (isNonEmptyArray(iterableStates)) {
    const nextMode = getNextSortLabel(currentSortState, iterableStates);
    return { [field]: nextMode };
  }

  return sorting;
}

function getNextSortLabel(
  currentState: SortState | undefined,
  states: NonEmptyArray<SortState>,
) {
  const currentIndex = states.findIndex(
    (state) => state.label === currentState?.label,
  );
  const nextIndex = (currentIndex + 1) % states.length;
  return states[nextIndex]?.label ?? states[0].label;
}

function findState(
  field: string,
  sorting: { [key: string]: string },
  states: NonEmptyArray<SortState>,
): SortState {
  const foundByLabel = states.find((state) => state.label === sorting[field]);
  if (foundByLabel) {
    return foundByLabel;
  }
  const foundByIterable = states.find((state) => state.iterable === false);
  if (foundByIterable) {
    return foundByIterable;
  }
  return states[0];
}

function isNonEmptyArray<Type>(arr: Type[]): arr is NonEmptyArray<Type> {
  return arr.length > 0;
}

function isFn(
  maybeFn:
    | string
    | (({
        def,
        position,
      }: {
        def: ColumnDefWithDefaults;
        position: Position;
      }) => string),
): maybeFn is (args: {
  def: ColumnDefWithDefaults;
  position: Position;
}) => string {
  return typeof maybeFn === "function";
}
