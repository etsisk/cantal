import {
  type CSSProperties,
  type Dispatch,
  type FC,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  type SetStateAction,
  type SyntheticEvent,
  useRef,
  useState,
} from "react";
import {
  Body,
  type Cell,
  type ColumnSpan,
  type EditCell,
  type IndexedArray,
  type Range,
} from "./Body";
import { Header } from "./Header";
import { Filter, type FiltererProps } from "./Filter";
import type { SortState } from "./Sorter";
import { type EditorProps, InputEditor } from "./editors/InputEditor";

type RefCallback<T> = (instance: T | null) => void;
export type NonEmptyArray<T> = [T, ...T[]];
type TFilterProps<T> = FC<T>;
type AriaCellLabelArgs = {
  columnIndex: number;
  data: DataRow;
  def: LeafColumn;
  rowIndex: number;
  value: unknown;
};
type AriaCellLabel = string | ((args: AriaCellLabelArgs) => string);
type AriaHeaderCellLabel =
  | string
  | ((args: { def: ColumnDefWithDefaults; position: Position }) => string);
type EditableArgs = { data: DataRow; rowIndex: number; value: unknown };
type Editable =
  | boolean
  | (({ data, rowIndex, value }: EditableArgs) => boolean);

export type DataRow = Record<string, unknown>;
type EditorComponent = <T extends EditorProps>(
  args: unknown,
) => (props: T) => ReactNode;
export interface ColumnDef {
  allowEditCellOverflow?: boolean;
  ariaCellLabel?: AriaCellLabel;
  ariaHeaderCellLabel?: AriaHeaderCellLabel;
  editable?: Editable;
  editor?: EditorComponent;
  field: string;
  filterable?: boolean;
  filterer?: TFilterProps<FiltererProps>;
  minWidth?: number;
  pinned?: "start" | "end";
  resizable?: boolean;
  rowSpanComparator?: (prev: unknown, curr: unknown) => boolean;
  rowSpanning?: boolean;
  sortable?: boolean;
  sortStates?: NonEmptyArray<SortState>;
  subcolumns?: ColumnDef[];
  title?: string;
  valueParser?: (value: unknown) => typeof value;
  valueRenderer?: <T>(args: {
    columnDef: LeafColumn;
    data: DataRow;
    value: T;
  }) => ReactNode;
  width?: string | number;
}

export interface ColumnDefWithDefaults extends ColumnDef {
  allowEditCellOverflow: boolean;
  ariaCellLabel: AriaCellLabel;
  ariaHeaderCellLabel: AriaHeaderCellLabel;
  editable: Editable;
  editor: EditorComponent;
  filterer: TFilterProps<FiltererProps>;
  minWidth: number;
  rowSpanComparator: (prev: unknown, curr: unknown) => boolean;
  rowSpanning: boolean;
  sortStates: NonEmptyArray<SortState>;
  subcolumns: ColumnDefWithDefaults[];
  valueParser: (value: unknown) => typeof value;
  valueRenderer: <T>(args: {
    columnDef: LeafColumn;
    data: DataRow;
    value: T;
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

export interface HandleKeyDownArgs {
  e: KeyboardEvent<HTMLDivElement>;
  cell: Cell;
  columnDef: LeafColumn;
  defaultHandler: () => void;
}

export interface HandlePointerDownArgs {
  e: ReactPointerEvent<HTMLDivElement>;
  cell: Cell;
  point: Point;
  columnDef: ColumnDefWithDefaults;
  defaultHandler: () => void;
}

export interface HandleDoublePointerDownArgs {
  e: ReactPointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>;
  cell: Cell;
  point?: Point;
  columnDef: ColumnDefWithDefaults;
  defaultHandler: () => void;
}

interface GridProps {
  body?: (
    leafColumns: LeafColumn[],
    positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>,
    visibleStartColumn: number,
    visibleEndColumn: number,
    styles: CSSProperties,
    height: number,
    canvasWidth: string,
    headerViewportRef: RefObject<HTMLDivElement | null>,
    setState: {
      setVisibleEndColumn: Dispatch<SetStateAction<number>>;
      setVisibleStartColumn: Dispatch<SetStateAction<number>>;
    },
  ) => ReactNode;
  columnDefs: ColumnDef[];
  columnSorts?: { [key: string]: string };
  columnSpans?: string;
  data: DataRow[];
  editCell?: EditCell | undefined;
  filters?: { [key: string]: string };
  focusedCell?: Cell | null;
  gap?: number | { columnGap: number; rowGap: number };
  handleContextMenu?: (args: {
    event: MouseEvent;
    defaultHandler: () => void;
  }) => void;
  handleDoublePointerDown?: (args: HandleDoublePointerDownArgs) => void;
  handleEdit?: (
    editRows: { [key: string]: DataRow },
    leafColumns: LeafColumn[],
  ) => void;
  handleEditCellChange?: (cell?: EditCell) => void;
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
    selectedRanges: IndexedArray<Range>,
    endPoint: Point | undefined,
    e:
      | PointerEvent
      | ReactPointerEvent<HTMLDivElement>
      | KeyboardEvent<HTMLDivElement>
      | MouseEvent<HTMLDivElement>,
  ) => void;
  handleSort?: (
    nextSortMode: { [key: string]: string } | undefined,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  header?: (
    colDefs: ColumnDefWithDefaults[],
    leafColumns: LeafColumn[],
    positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>,
    visibleStartColumn: number,
    visibleEndColumn: number,
    styles: CSSProperties,
    ref: RefObject<HTMLDivElement | null>,
    canvasWidth: string,
  ) => ReactNode;
  id?: string;
  overscanColumns?: number;
  overscanRows?: number;
  rowHeight?: number;
  rowId?: string;
  selectedRanges?: IndexedArray<Range>;
  selectionFollowsFocus?: boolean;
  showSelectionBox?: boolean;
  styles?: {
    cell?:
      | CSSProperties
      | ((
          rowData: DataRow,
          columnDef: LeafColumn,
          rowIndex: number,
          columnIndex: number,
        ) => { base?: CSSProperties });
    container?: CSSProperties;
  };
  virtual?: "columns" | "rows" | boolean;
}

export function Grid({
  body = (
    leafColumns: LeafColumn[],
    positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>,
    visibleStartColumn: number,
    visibleEndColumn: number,
    styles: CSSProperties,
    height: number,
    canvasWidth: string,
    headerViewportRef: RefObject<HTMLDivElement | null>,
    setState: {
      setVisibleEndColumn: Dispatch<SetStateAction<number>>;
      setVisibleStartColumn: Dispatch<SetStateAction<number>>;
    },
  ) => (
    <Body
      canvasWidth={canvasWidth}
      columnGap={typeof gap === "number" ? gap : gap.columnGap}
      columnSpans={columnSpans}
      containerHeight={height}
      data={data}
      editCell={editCell}
      focusedCell={focusedCell}
      handleContextMenu={handleContextMenu}
      handleEdit={handleEdit}
      handleEditCellChange={handleEditCellChange}
      handleFocusedCellChange={handleFocusedCellChange}
      handleKeyDown={handleKeyDown}
      handlePointerDown={handlePointerDown}
      handleDoublePointerDown={handleDoublePointerDown}
      handleSelection={handleSelection}
      headerViewportRef={headerViewportRef}
      leafColumns={leafColumns}
      overscanColumns={overscanColumns}
      overscanRows={overscanRows}
      positions={positions}
      rowGap={typeof gap === "number" ? gap : gap.rowGap}
      rowHeight={rowHeight}
      rowId={rowId}
      selectedRanges={selectedRanges}
      selectionFollowsFocus={selectionFollowsFocus}
      setState={setState}
      showSelectionBox={showSelectionBox}
      styles={styles}
      virtual={virtual}
      visibleColumnEnd={visibleEndColumn}
      visibleColumnStart={visibleStartColumn}
    />
  ),
  columnDefs,
  columnSorts = {},
  columnSpans,
  data,
  editCell,
  filters = {},
  focusedCell,
  gap = { columnGap: 1, rowGap: 1 },
  handleContextMenu = noop,
  handleDoublePointerDown = invokeDefaultHanlder,
  handleEdit = noop,
  handleEditCellChange = noop,
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
    visibleStartColumn: number,
    visibleEndColumn: number,
    styles: CSSProperties,
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
      visibleColumnEnd={visibleEndColumn}
      visibleColumnStart={visibleStartColumn}
    />
  ),
  id,
  overscanColumns = 3,
  overscanRows = 3,
  rowHeight,
  rowId,
  selectedRanges = [],
  selectionFollowsFocus,
  showSelectionBox,
  styles,
  virtual = false,
}: GridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerViewportRef = useRef<HTMLDivElement>(null);
  const [visibleStartColumn, setVisibleStartColumn] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const sizeRef = (node: HTMLDivElement) => {
    const ro = new ResizeObserver(([entry]) => {
      if (entry) {
        setHeight(Math.ceil(entry.contentRect.height));
      }
    });
    if (node !== null) {
      ro.observe(node);
    }
    return () => {
      ro.disconnect();
    };
  };
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
  const [visibleEndColumn, setVisibleEndColumn] = useState<number>(() => {
    if (virtual === true || virtual === "columns") {
      return Math.min(
        leafColumns.length,
        window.innerWidth / DEFAULT_COLUMN_WIDTH,
      );
    }
    return leafColumns.length;
  });
  const orderedLeafColumns = pinColumns(leafColumns);
  const maxDepth = getColumnDepth(leafColumns);
  const positions = getColumnPositions(orderedLeafColumns, maxDepth);
  // TODO: There's room to optimize call to `getColumnWidths` but we need
  // to take pinned columns into account
  const gridTemplateColumns = getColumnWidths(orderedLeafColumns);
  const canvasWidth = getGridCanvasWidth(orderedLeafColumns, columnGap);
  // TODO: Figure out how to pass prop styles to body component
  const computedStyles = {
    columnGap,
    gridTemplateColumns,
    rowGap,
  };

  const containerStyles: CSSProperties = {
    ...(selectedRanges.length > 0
      ? { WebkitUserSelect: "none", userSelect: "none" }
      : {}),
    ...styles?.container,
  };

  return (
    <div
      className="cantal"
      // TODO: use random id fallback
      // Update the docs too
      id={id}
      ref={mergeRefs(containerRef, sizeRef)}
      style={containerStyles}
    >
      {header(
        colDefs,
        orderedLeafColumns,
        positions,
        visibleStartColumn,
        visibleEndColumn,
        // TODO: headerRowHeight prop
        { ...computedStyles, gridAutoRows: `minmax(${27}px, auto)` },
        headerViewportRef,
        canvasWidth,
      )}
      {body(
        orderedLeafColumns,
        positions,
        visibleStartColumn,
        visibleEndColumn,
        computedStyles,
        height,
        canvasWidth,
        headerViewportRef,
        { setVisibleEndColumn, setVisibleStartColumn },
      )}
    </div>
  );
}

const MIN_COLUMN_WIDTH = 70;
const DEFAULT_COLUMN_WIDTH = 100;

// QUESTION: Avoid setting minWidth, width for columns with subcolumns?
const columnDefDefaults = {
  allowEditCellOverflow: false,
  ariaCellLabel: ({
    columnIndex,
    data,
    def,
    rowIndex,
    value,
  }: AriaCellLabelArgs): string =>
    `Column ${columnIndex + 1}${
      typeof def.pinned === "string" && ["start", "end"].includes(def.pinned)
        ? ", pinned"
        : ""
    }${def.title ? `, ${def.title}` : ""}`,
  // TODO: Add 'pinned' to header aria label
  ariaHeaderCellLabel: ({
    def,
    position,
  }: {
    def: ColumnDefWithDefaults | LeafColumn;
    position: Position;
  }): string =>
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
  editable: false,
  editor: () => InputEditor,
  filterer: Filter,
  minWidth: MIN_COLUMN_WIDTH,
  rowSpanComparator: (prev: unknown, curr: unknown) => prev === curr,
  rowSpanning: false,
  sortStates: [
    { label: "unsorted", symbol: "↑↓", iterable: false },
    { label: "ascending", symbol: "↑", iterable: true },
    { label: "descending", symbol: "↓", iterable: true },
  ] satisfies NonEmptyArray<SortState>,
  subcolumns: [],
  valueParser: (value: unknown) => value,
  valueRenderer: (args: {
    columnDef: ColumnDefWithDefaults;
    data: DataRow;
    value: unknown;
  }) => args.value as ReactNode,
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

export function applyColumnSpanDefDefaults(
  columnSpan: ColumnSpan | undefined,
  columnDef: LeafColumn,
): LeafColumn {
  if (columnSpan === undefined) {
    return columnDef;
  }
  if (columnSpan.field === columnDef.field) {
    return Object.assign({}, columnDef, columnSpan);
  }
  return Object.assign(
    {},
    columnDefDefaults,
    { ancestors: [], pinned: columnDef.pinned },
    columnSpan,
  );
}

// TODO: Expose API to consumers
export function getLeafColumns(
  columnDefs: (ColumnDef | ColumnDefWithDefaults)[],
  ancestors: (ColumnDef | ColumnDefWithDefaults)[] = [],
): LeafColumn[] {
  // QUESTION: check if defs are of type ColumnDef (or don't)
  // and applyDefaults since there's an assumption that LeafColumns are a bunch of columns with defaults
  return columnDefs
    .map((def) => {
      if (def.subcolumns && def.subcolumns.length > 0) {
        const parents = [...ancestors, def];
        return getLeafColumns(def.subcolumns, parents);
      }
      // TODO: throw column def warning if def.pinned is something other than 'start', 'end', undefined
      if (ancestors.length > 0) {
        const parent = ancestors.at(-1);
        if (parent?.subcolumns?.some((d) => d.pinned !== def.pinned)) {
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
          : a.pinned === undefined && b.pinned === "start"
            ? 1
            : a.pinned === undefined && b.pinned === "end"
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
      if (!ancestor) {
        continue;
      }
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

function getColumnEndBoundary(
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
function getColumnStartBoundary(
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

export function getPinnedColumnsOffset(
  leafColumns: LeafColumn[],
  columnGap: number,
): number {
  if (leafColumns.length === 0) {
    return 0;
  }

  const columnWidths = leafColumns.reduce(
    (widths, column) => widths + column.width,
    0,
  );
  return columnGap * leafColumns.length + columnWidths;
}

function validateProps<TTemporaryGeneric>(props: TTemporaryGeneric) {}
function noop() {}
interface DefaultHandlerArgs {
  defaultHandler: () => void;
}
function invokeDefaultHanlder({ defaultHandler }: DefaultHandlerArgs) {
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
