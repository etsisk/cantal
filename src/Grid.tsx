import {
  type CSSProperties,
  type FC,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  type SyntheticEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { Body, type Cell } from "./Body";
import { Header } from "./Header";
import { Filter } from "./Filter";
import type { SortState } from "./Sorter";

type RefCallback<T> = (instance: T | null) => void;

export interface ColumnDef {
  ariaCellLabel?:
    | string
    | ((props: {
        columnIndex: number;
        data: { [key: string]: unknown };
        def: ColumnDef;
        rowIndex: number;
        value: unknown;
      }) => string);
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
  valueRenderer?: (args: {
    columnDef: ColumnDefWithDefaults;
    data: { [key: string]: unknown };
    value: unknown;
  }) => ReactNode;
  width?: string | number;
}

export interface ColumnDefWithDefaults extends ColumnDef {
  ariaCellLabel:
    | string
    | ((props: {
        columnIndex: number;
        data: { [key: string]: unknown };
        def: ColumnDef;
        rowIndex: number;
        value: unknown;
      }) => string);
  ariaHeaderCellLabel: string;
  filterer: FC;
  minWidth: number;
  sortStates: SortState[];
  subcolumns: ColumnDefWithDefaults[];
  valueRenderer: (args: {
    columnDef: ColumnDefWithDefaults;
    data: { [key: string]: unknown };
    value: unknown;
  }) => ReactNode;
  width: number;
}

export interface LeafColumn extends ColumnDefWithDefaults {
  ancestors: ColumnDefWithDefaults[];
}

// QUESTION: add subcolumns property?
// Could be useful for resizing (knowing if it's a leaf column or an ancestor)
export interface Position {
  ancestors: ColumnDefWithDefaults[];
  columnIndex: number;
  columnIndexEnd: number;
  depth: number;
  field: string;
  level: number;
  pinnedIndex: number;
  pinnedIndexEnd: number;
  subcolumnIndex: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface DataRow {
  [key: string]: unknown;
}

export interface HandleKeyDownArgs {
  e: KeyboardEvent<HTMLDivElement>;
  cell: Cell;
  columnDef: ColumnDefWithDefaults;
  defaultHandler: () => void;
}

export interface HandlePointerDownArgs {
  e: PointerEvent<HTMLDivElement>;
  cell: Cell;
  point: Point;
  columnDef: ColumnDefWithDefaults;
  defaultHandler: () => void;
}

interface GridProps {
  body?: (
    leafColumns: LeafColumn[],
    positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>,
    styles: CSSProperties,
    height: number,
    canvasWidth: string,
    headerViewportRef: RefObject<HTMLDivElement | null>,
  ) => ReactNode;
  columnDefs: ColumnDef[];
  columnSorts?: { [key: string]: string };
  data: Record<string, unknown>[];
  filters?: { [key: string]: string };
  focusedCell?: Cell | null;
  gap?: number | { columnGap: number; rowGap: number };
  handleFocusedCellChange?: (
    focusedCell: Cell,
    event: SyntheticEvent,
    point?: Point,
  ) => void;
  handleFilter?: (field: string, value: string) => void;
  handleKeyDown?: (args: HandleKeyDownArgs) => void;
  handlePointerDown?: (args: HandlePointerDownArgs) => void;
  handleResize?: (
    field: string,
    value: number,
    columnDefs: ColumnDefWithDefaults[],
  ) => void;
  handleSelection?: (
    selectedRanges: Range[],
    endPoint: Point,
    e: PointerEvent<Window> | KeyboardEvent<HTMLDivElement>,
  ) => void;
  handleSort?: (
    nextSortMode: { [key: string]: string },
    e: PointerEvent<HTMLButtonElement>,
  ) => void;
  header?: (
    colDefs: ColumnDefWithDefaults[],
    leafColumns: ColumnDefWithDefaults[],
    positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>,
    styles: CSSProperties,
    ref: RefObject<HTMLDivElement | null>,
    canvasWidth: string,
  ) => ReactNode;
  id?: string;
  rowHeight?: number;
  selectedRanges?: Range[];
  selectionFollowsFocus?: boolean;
  showSelectionBox?: boolean;
  styles?: {
    container: CSSProperties;
  };
}
export function Grid({
  body = (
    leafColumns: LeafColumn[],
    positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>,
    styles: CSSProperties,
    height: number,
    canvasWidth: string,
    headerViewportRef: RefObject<HTMLDivElement | null>,
  ) => (
    <Body
      canvasWidth={canvasWidth}
      columnGap={typeof gap === "number" ? gap : gap.columnGap}
      containerHeight={height}
      data={data}
      focusedCell={focusedCell}
      handleFocusedCellChange={handleFocusedCellChange}
      handleKeyDown={handleKeyDown}
      handlePointerDown={handlePointerDown}
      handleSelection={handleSelection}
      headerViewportRef={headerViewportRef}
      leafColumns={leafColumns}
      positions={positions}
      rowGap={typeof gap === "number" ? gap : gap.rowGap}
      rowHeight={rowHeight}
      selectedRanges={selectedRanges}
      selectionFollowsFocus={selectionFollowsFocus}
      showSelectionBox={showSelectionBox}
      styles={styles}
    />
  ),
  columnDefs,
  columnSorts = {},
  data,
  filters = {},
  focusedCell,
  gap = { columnGap: 1, rowGap: 1 },
  handleFocusedCellChange = noop,
  handleFilter = noop,
  handleKeyDown = invokeDefaultHanlder,
  handlePointerDown = invokeDefaultHanlder,
  handleResize = noop,
  handleSelection,
  handleSort = noop,
  header = (
    colDefs: ColumnDefWithDefaults[],
    leafColumns: LeafColumn[],
    positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>,
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
      positions={positions}
      ref={ref}
      sorts={columnSorts}
      styles={styles}
    />
  ),
  rowHeight,
  selectedRanges = [],
  selectionFollowsFocus,
  showSelectionBox,
  styles,
}: GridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerViewportRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);
  const sizeRef = useCallback((node: HTMLElement) => {
    if (node !== null) {
      const resizeObserver = new ResizeObserver((entries) => {
        setHeight(entries[0].contentRect.height);
      });
      resizeObserver.observe(node);
    }
  }, []);
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
  const maxDepth = getColumnDepth(leafColumns);
  const positions = getColumnPositions(orderedLeafColumns, maxDepth);
  const gridTemplateColumns = getColumnWidths(orderedLeafColumns);
  const canvasWidth = getGridCanvasWidth(orderedLeafColumns, columnGap);
  const computedStyles = {
    columnGap,
    gridTemplateColumns,
    rowGap,
  };

  const containerStyles = {
    ...(selectedRanges.length > 0
      ? { WebkitUserSelect: "none", userSelect: "none" }
      : {}),
    ...styles?.container,
  };

  return (
    <div
      className="cantal"
      ref={mergeRefs(containerRef, sizeRef)}
      style={containerStyles}
    >
      {header(
        colDefs,
        orderedLeafColumns,
        positions,
        { ...computedStyles, gridAutoRows: `minmax(${27}px, auto)` },
        headerViewportRef,
        canvasWidth,
      )}
      {body(
        orderedLeafColumns,
        positions,
        computedStyles,
        height,
        canvasWidth,
        headerViewportRef,
      )}
    </div>
  );
}

const MIN_COLUMN_WIDTH = 70;
const DEFAULT_COLUMN_WIDTH = 100;

// QUESTION: Avoid setting minWidth, width for columns with subcolumns?
const columnDefDefaults = {
  ariaCellLabel: ({
    def,
    columnIndex,
    data,
    rowIndex,
    value,
  }: {
    def: ColumnDefWithDefaults;
    columnIndex: number;
    data: { [key: string]: unknown };
    rowIndex: number;
    value: unknown;
  }): string =>
    `Column ${columnIndex + 1}${
      ["start", "end"].includes(def.pinned) ? ", pinned" : ""
    }${def.title ? `, ${def.title}` : ""}`,
  // TODO: Add 'pinned' to header aria label
  ariaHeaderCellLabel: ({
    def,
    position,
  }: {
    def: ColumnDefWithDefaults | LeafColumn;
    position: Position;
  }) =>
    `Column ${position.columnIndex}, ${position.ancestors
      .map((ancestor) => ancestor.title)
      .filter((title) => {
        if (typeof title === "string") {
          return title.trim() !== "";
        }
        return false;
      })
      .concat([def.title])
      .join(" ")}`,
  filterer: Filter,
  minWidth: MIN_COLUMN_WIDTH,
  sortStates: [
    { label: "unsorted", symbol: "↑↓", iterable: false },
    { label: "ascending", symbol: "↑", iterable: true },
    { label: "descending", symbol: "↓", iterable: true },
  ],
  subcolumns: [],
  valueRenderer: (args: {
    columnDef: ColumnDefWithDefaults;
    data: { [key: string]: unknown };
    value: unknown;
  }) => args.value,
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
export function getLeafColumns(
  columnDefs: ColumnDefWithDefaults[],
  ancestors: ColumnDefWithDefaults[] = [],
): LeafColumn[] {
  return columnDefs
    .map((def) => {
      if (def.subcolumns && def.subcolumns.length > 0) {
        const parents = [...ancestors, def];
        return getLeafColumns(def.subcolumns, parents);
      }
      // TODO: throw column def warning if def.pinned is something other than 'start', 'end', undefined
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
      : a.pinned === "start"
        ? -1
        : a.pinned === "end"
          ? 1
          : !["start", "end"].includes(a.pinned) && b.pinned === "start"
            ? 1
            : !["start", "end"].includes(a.pinned) && b.pinned === "end"
              ? -1
              : 0,
  );
}

function getColumnDepth(leafColumns: LeafColumn[]): number {
  return leafColumns.reduce((depth, leafColumn) => {
    return Math.max(depth, leafColumn.ancestors.length + 1);
  }, 1);
}

function getColumnPositions(
  leafColumns: LeafColumn[],
  columnDepth: number,
): WeakMap<LeafColumn | ColumnDefWithDefaults, Position> {
  const positions = new WeakMap();
  let columnIndex = 1;
  let pinnedIndex = 1;
  let pinned: "start" | "end" | undefined;
  for (let def of leafColumns) {
    if (columnIndex > 1 && pinned !== def.pinned) {
      pinnedIndex = 1;
    }

    for (let i = 0; i < def.ancestors.length; i++) {
      const ancestor = def.ancestors[i];
      const lineage = def.ancestors.slice(0, i);
      const meta = positions.get(ancestor);
      if (!meta) {
        positions.set(ancestor, {
          ancestors: lineage,
          columnIndex,
          columnIndexEnd: columnIndex + (ancestor.subcolumns?.length ?? 0),
          field: ancestor.field,
          depth: i + 1,
          level: i,
          pinnedIndex,
          pinnedIndexEnd: pinnedIndex + (ancestor.subcolumns?.length ?? 0),
          subcolumnIndex:
            lineage
              .at(-1)
              ?.subcolumns?.findIndex((d) => d.field === ancestor.field) ?? 0,
        });
      }
    }

    positions.set(def, {
      ancestors: def.ancestors,
      columnIndex,
      columnIndexEnd: columnIndex,
      depth: columnDepth,
      field: def.field,
      level: def.ancestors.length,
      pinnedIndex,
      pinnedIndexEnd: pinnedIndex + 1,
      subcolumnIndex:
        def.ancestors
          .at(-1)
          ?.subcolumns?.findIndex((d) => d.field === def.field) ?? 0,
    });

    pinned = def.pinned;
    pinnedIndex++;
    columnIndex++;
  }
  return positions;
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

export function getColumnEndBoundary(
  colIdx: number,
  leafColumns: ColumnDefWithDefaults[],
  columnGap: number,
): number | null {
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
): number | null {
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
function invokeDefaultHanlder({ defaultHandler }) {
  return defaultHandler();
}

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (instance: T | null) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(instance);
      } else if (ref != null) {
        (ref as RefObject<T | null>).current = instance;
      }
    });
  };
}
