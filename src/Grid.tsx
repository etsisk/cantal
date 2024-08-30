import {
  type CSSProperties,
  type FC,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useRef,
} from "react";
import { Body, type Cell } from "./Body";
import { Header, type Position } from "./Header";
import { Filter } from "./Filter";
import type { SortState } from "./Sorter";

export interface ColumnDef {
  ariaCellLabel?: string;
  ariaHeaderCellLabel?:
    | string
    | ((props: { def: ColumnDefWithDefaults; position: Position }) => string);
  field: string;
  filterable?: boolean;
  filterer?: FC;
  minWidth?: number;
  pinned?: "start" | "end";
  resizable?: boolean;
  sortable?: boolean;
  sortStates?: SortState[];
  subcolumns?: ColumnDef[];
  title?: string;
  width?: string | number;
}

export interface ColumnDefWithDefaults extends ColumnDef {
  filterer: FC;
  minWidth: number;
  sortStates: SortState[];
  subcolumns: ColumnDefWithDefaults[];
  width: number;
}

export interface LeafColumn extends ColumnDefWithDefaults {
  ancestors: ColumnDefWithDefaults[];
}

export interface DataRow {
  [key: string]: unknown;
}

interface GridProps {
  body?: (
    leafColumns: ColumnDefWithDefaults[],
    focusedCell: Cell | null,
    styles: CSSProperties,
    handleFocusedCellChange: (
      focusedCell: Cell,
      e: SyntheticEvent<Element, Event>,
    ) => void,
    containerRef: RefObject<HTMLDivElement | null>,
    headerViewportRef: RefObject<HTMLDivElement | null>,
    canvasWidth: string,
  ) => ReactNode;
  columnDefs: ColumnDef[];
  columnSorts?: { [key: string]: string };
  data: Record<string, unknown>[];
  filters?: { [key: string]: string };
  focusedCell?: { columnIndex: number; rowIndex: number } | null;
  gap?: number | { columnGap: number; rowGap: number };
  handleFocusedCellChange?: (
    focusedCell?: Cell,
    event?: SyntheticEvent,
  ) => void;
  handleFilter?: (field: string, value: string) => void;
  handleResize?: (
    field: string,
    value: number,
    columnDefs: ColumnDefWithDefaults[],
  ) => void;
  handleSort?: (
    nextSortMode: { [key: string]: string },
    e: PointerEvent<HTMLButtonElement>,
  ) => void;
  header?: (
    colDefs: ColumnDefWithDefaults[],
    leafColumns: ColumnDefWithDefaults[],
    styles: CSSProperties,
    ref: RefObject<HTMLDivElement | null>,
    canvasWidth: string,
  ) => ReactNode;
  id?: string;
  styles?: {
    container: CSSProperties;
  };
}
export function Grid({
  body = (
    leafColumns: LeafColumn[],
    focusedCell: Cell | null,
    styles: CSSProperties,
    handleFocusedCellChange = noop,
    containerRef: RefObject<HTMLDivElement | null>,
    headerViewportRef: RefObject<HTMLDivElement | null>,
    canvasWidth: string,
  ) => (
    <Body
      canvasWidth={canvasWidth}
      containerRef={containerRef}
      data={data}
      focusedCell={focusedCell}
      handleFocusedCellChange={handleFocusedCellChange}
      headerViewportRef={headerViewportRef}
      leafColumns={leafColumns}
      styles={styles}
    />
  ),
  columnDefs,
  columnSorts = {},
  data,
  filters = {},
  focusedCell = null,
  gap = { columnGap: 1, rowGap: 1 },
  handleFocusedCellChange = noop,
  handleFilter = noop,
  handleResize = noop,
  handleSort = noop,
  header = (
    colDefs: ColumnDefWithDefaults[],
    leafColumns: LeafColumn[],
    styles,
    ref: RefObject<HTMLDivElement | null>,
    canvasWidth: string,
  ) => (
    <Header
      canvasWidth={canvasWidth}
      columnDefs={colDefs}
      filters={filters}
      handleFilter={handleFilter}
      handleResize={handleResize}
      handleSort={handleSort}
      leafColumns={leafColumns}
      ref={ref}
      sorts={columnSorts}
      styles={styles}
    />
  ),
  styles,
}: GridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerViewportRef = useRef<HTMLDivElement>(null);
  const { columnGap, rowGap } =
    typeof gap === "number" ? { columnGap: gap, rowGap: gap } : gap;
  const colDefs = applyColumnDefDefaults(columnDefs, columnDefDefaults);
  if (process.env.NODE_ENV === "development") {
    validateProps({
      body,
      columnDefs: colDefs,
      columnSorts,
      data,
      header,
    });
  }
  const leafColumns = getLeafColumns(colDefs);
  const orderedLeafColumns = pinColumns(leafColumns);
  const gridTemplateColumns = getColumnWidths(orderedLeafColumns);
  const canvasWidth = getGridCanvasWidth(orderedLeafColumns, columnGap);
  const computedStyles = {
    columnGap,
    gridTemplateColumns,
    rowGap,
  };

  return (
    <div className="cantal" ref={containerRef} style={styles?.container}>
      {header(
        colDefs,
        leafColumns,
        { ...computedStyles, gridAutoRows: `minmax(${27}px, auto)` },
        headerViewportRef,
        canvasWidth,
      )}
      {body(
        leafColumns,
        focusedCell,
        computedStyles,
        handleFocusedCellChange,
        containerRef,
        headerViewportRef,
        canvasWidth,
      )}
    </div>
  );
}

const MIN_COLUMN_WIDTH = 70;
const DEFAULT_COLUMN_WIDTH = 100;

// QUESTION: Avoid setting minWidth, width for columns with subcolumns?
const columnDefDefaults = {
  ariaHeaderCellLabel: ({ position }: { position: Position }) =>
    `Column ${position.columnIndex}${
      position.ancestors.length ? ", " : ""
    }${position.ancestors
      .map((ancestor) => ancestor.title)
      .filter((title) => {
        if (typeof title === "string") {
          return title.trim() !== "";
        }
        return false;
      })
      .join(" ")}`,
  filterer: Filter,
  minWidth: MIN_COLUMN_WIDTH,
  sortStates: [
    { label: "unsorted", symbol: "↑↓", iterable: false },
    { label: "ascending", symbol: "↑", iterable: true },
    { label: "descending", symbol: "↓", iterable: true },
  ],
  subcolumns: [],
  width: DEFAULT_COLUMN_WIDTH,
};

function applyColumnDefDefaults(
  defs: ColumnDef[],
  defaults: Partial<ColumnDef>,
): ColumnDefWithDefaults[] {
  const { minWidth, width, ...widthlessDefaults } = defaults;
  return defs.map((def) => {
    let defDefaults = defaults;
    if (def.subcolumns && def.subcolumns.length > 0) {
      defDefaults = widthlessDefaults;
      def.subcolumns = applyColumnDefDefaults(def.subcolumns, defaults);
    }

    // TODO: Check for typeof defaults
    // TODO: Apply component instance defaults

    const defWithDefaults = { ...defDefaults, ...def } as ColumnDefWithDefaults;

    // TODO: Consider filling in/normalizing `iterable` sort state for states that don't have it
    // TODO: Make sure aria hidden for cell and header cell match up

    return defWithDefaults;
  });
}

// export function getLeafColumns(
//   defs: ColumnDefWithDefaults[],
// ): ColumnDefWithDefaults[] {
//   return defs.flatMap((def) => {
//     if (def.subcolumns && def.subcolumns.length > 0) {
//       return getLeafColumns(def.subcolumns).flat();
//     }
//     return [def];
//   });
// }

// TODO: Expose API to consumers
export function getLeafColumns(columnDefs: ColumnDefWithDefaults[], ancestors: ColumnDefWithDefaults[] = []): LeafColumn[] {
  return columnDefs
    .map((def) => {
      if (def.subcolumns && def.subcolumns.length > 0) {
        const parents = [...ancestors, def];
        return getLeafColumns(def.subcolumns, parents);
      }
      // throw column def warning if def.pinned is something other than 'start', 'end', undefined
      if (ancestors.length > 0) {
        const parent = ancestors.at(-1);
        if (parent.subcolumns.some((d) => d.pinned !== def.pinned)) {
          return {
            ...def,
            ancestors: ancestors.toSpliced(-1, 1, {
              ...parent,
              subcolumns: parent.subcolumns.filter(
                (d) => d.pinned === def.pinned,
              ),
            }),
          };
        }
      }
      return { ...def, ancestors };
    })
    .flat();
}

// QUESTION: Expose API to consumers?
function pinColumns(columnDefs: LeafColumn[]): LeafColumn[] {
    return columnDefs.toSorted((a: LeafColumn, b: LeafColumn) =>
    a.pinned === b.pinned
      ? 0
      : a.pinned === 'start'
        ? -1
        : a.pinned === 'end'
          ? 1
          : !['start', 'end'].includes(a.pinned) && b.pinned === 'start'
            ? 1
            : !['start', 'end'].includes(a.pinned) && b.pinned === 'end'
              ? -1
              : 0,
  );
}

function getColumnWidths(leafColumns: ColumnDefWithDefaults[]): string {
  return leafColumns
    .map((columnDef) => {
      if (columnDef.width) {
        return `${Math.max(columnDef.width, columnDef.minWidth)}px`;
      } else {
        return `${DEFAULT_COLUMN_WIDTH}px`;
      }
    })
    .join(" ");
}

export function getGridCanvasWidth(
  leafColumns: ColumnDefWithDefaults[],
  columnGap: number,
): string {
  const endBoundary = getColumnEndBoundary(
    leafColumns.length - 1,
    leafColumns,
    columnGap,
  );
  return endBoundary ? `${endBoundary}px` : "auto";
}

function getColumnEndBoundary(
  colIdx: number,
  leafColumns: ColumnDefWithDefaults[],
  columnGap: number,
) {
  const startBoundary = getColumnStartBoundary(
    colIdx + 1,
    leafColumns,
    columnGap,
  );

  if (startBoundary === null) {
    return null;
  }

  return startBoundary - columnGap;
}

// Returns null if one of the leaf columns before colIdx
// does not have an integer width
export function getColumnStartBoundary(
  colIdx: number,
  leafColumns: ColumnDefWithDefaults[],
  columnGap: number,
) {
  const totalColumnWidths = leafColumns
    ?.slice(0, colIdx)
    .map((col: ColumnDefWithDefaults) =>
      Number.isInteger(col.width) ? col.width : null,
    )
    .reduce(
      (a: number | null, b: number | null) =>
        a === null || b === null ? null : a + b,
      0,
    );

  if (totalColumnWidths === null || totalColumnWidths === undefined) {
    return null;
  }

  return totalColumnWidths + colIdx * columnGap;
}

function validateProps(props) {}
function noop() {}
