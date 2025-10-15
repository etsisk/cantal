import { CSSProperties, Dispatch, FC, KeyboardEvent, MouseEvent, PointerEvent as PointerEvent$1, ReactElement, ReactNode, RefObject, SetStateAction, SyntheticEvent, UIEvent } from "react";

//#region src/Cell.d.ts
interface CellProps {
  allowEditCellOverflow: boolean;
  ariaLabel: string;
  children: ReactNode;
  classNames?: {
    base?: string;
    edited?: string;
    focused?: string;
    selected?: string;
  };
  columnDef: ColumnDefWithDefaults | LeafColumn;
  columnIndex: number;
  columnIndexRelative: number;
  endColumnIndex: number;
  endRowIndex: number;
  isEditing: boolean;
  isFocused: boolean;
  position: Position | undefined;
  rowIndex: number;
  selected: boolean;
  startColumnIndex: number;
  startRowIndex: number;
  styles: {
    base?: CSSProperties;
    edited?: CSSProperties;
    focused?: CSSProperties;
    selected?: CSSProperties;
  } | ((children: ReactNode) => {
    base?: CSSProperties;
    edited?: CSSProperties;
    focused?: CSSProperties;
    selected?: CSSProperties;
  });
  virtualRowIndex: number;
}
declare function Cell({
  allowEditCellOverflow,
  ariaLabel,
  children,
  classNames,
  columnDef,
  columnIndex,
  columnIndexRelative,
  endColumnIndex,
  endRowIndex,
  isEditing,
  isFocused,
  position,
  rowIndex,
  selected,
  startColumnIndex,
  startRowIndex,
  styles,
  virtualRowIndex
}: CellProps): ReactElement | null;
//#endregion
//#region src/Body.d.ts
interface Cell {
  columnIndex: number;
  rowIndex: number;
}
interface EditCell extends Cell {
  selectInitialValue: boolean;
  value: string;
}
interface Range {
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
interface IndexedArray<T> extends Array<T> {
  [index: number]: T;
}
//#endregion
//#region src/Filter.d.ts
interface FiltererProps {
  className?: string;
  field: string;
  handleFilter: (field: string, value: string) => void;
  value?: string;
}
//#endregion
//#region src/Sorter.d.ts
interface SortState {
  iterable?: boolean;
  label: string;
  symbol: string;
}
//#endregion
//#region src/editors/InputEditor.d.ts
interface EditorProps {
  columnDef: LeafColumn;
  columnIndex: number;
  data: DataRow;
  handleChange: (value: string) => void;
  rowIndex: number;
  selectInitialValue?: boolean;
  value?: string | number;
}
//#endregion
//#region src/Grid.d.ts
type NonEmptyArray<T> = [T, ...T[]];
type TFilterProps<T> = FC<T>;
type AriaCellLabelArgs = {
  columnIndex: number;
  data: DataRow;
  def: LeafColumn;
  rowIndex: number;
  value: unknown;
};
type AriaCellLabel = string | ((args: AriaCellLabelArgs) => string);
type AriaHeaderCellLabel = string | ((args: {
  def: ColumnDefWithDefaults;
  position: Position;
}) => string);
type EditableArgs = {
  data: DataRow;
  rowIndex: number;
  value: unknown;
};
type Editable = boolean | (({
  data,
  rowIndex,
  value
}: EditableArgs) => boolean);
type DataRow = Record<string, unknown>;
type EditorComponent = <T extends EditorProps>(args: unknown) => (props: T) => ReactNode;
interface ColumnDef {
  allowEditCellOverflow?: boolean;
  ariaCellLabel?: AriaCellLabel;
  ariaHeaderCellLabel?: AriaHeaderCellLabel;
  cellClassNames?: {
    base?: string;
    selected?: string;
    focused?: string;
    edited?: string;
  } | ((row: DataRow, columnDef: LeafColumn, rowIndex: number, columnIndex: number) => {
    base?: string;
    selected?: string;
    focused?: string;
    edited?: string;
  });
  editable?: Editable;
  editor?: EditorComponent;
  field: string;
  filterable?: boolean;
  filterer?: TFilterProps<FiltererProps>;
  headerCellClassNames?: {
    container?: string;
    content?: string;
    filter?: string;
    label?: string;
    resizer?: string;
    sorter?: string;
  } | (({
    columnDef,
    position
  }: {
    columnDef: LeafColumn | ColumnDefWithDefaults;
    position?: Position;
  }) => {
    container?: string;
    content?: string;
    filter?: string;
    label?: string;
    resizer?: string;
    sorter?: string;
  });
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
interface ColumnDefWithDefaults extends ColumnDef {
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
interface LeafColumn extends ColumnDefWithDefaults {
  ancestors: ColumnDefWithDefaults[];
}
interface Position {
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
interface Point {
  x: number;
  y: number;
}
interface HandleKeyDownArgs {
  e: KeyboardEvent<HTMLDivElement>;
  cell: Cell;
  columnDef: LeafColumn;
  defaultHandler: () => void;
}
interface HandlePointerDownArgs {
  e: PointerEvent$1<HTMLDivElement>;
  cell: Cell;
  point: Point;
  columnDef: ColumnDefWithDefaults;
  defaultHandler: () => void;
}
interface HandleDoublePointerDownArgs {
  e: PointerEvent$1<HTMLDivElement> | MouseEvent<HTMLDivElement>;
  cell: Cell;
  point?: Point;
  columnDef: ColumnDefWithDefaults;
  defaultHandler: () => void;
}
interface HandleHeaderPointerDownArgs {
  e: PointerEvent$1<HTMLDivElement>;
  columnDef: ColumnDefWithDefaults;
  columnIndexEnd: number;
  columnIndexStart: number;
  defaultHandler: () => void;
  rowIndexEnd: number;
  rowIndexStart: number;
}
interface UserStyles {
  cell?: {
    base?: CSSProperties;
  } | ((rowData: DataRow, columnDef: LeafColumn, rowIndex: number, columnIndex: number) => {
    base?: CSSProperties;
  });
  container?: CSSProperties;
}
interface GridRef extends Partial<HTMLDivElement> {
  copy: (data: DataRow[], leafColumns: LeafColumn[], selectedRanges: Range[]) => void;
}
interface GridProps {
  body?: (leafColumns: LeafColumn[], positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>, visibleStartColumn: number, visibleEndColumn: number, styles: {
    computed: CSSProperties;
    user?: UserStyles;
  }, height: number, canvasWidth: string, headerViewportRef: RefObject<HTMLDivElement | null>, setState: {
    setVisibleEndColumn: Dispatch<SetStateAction<number>>;
    setVisibleStartColumn: Dispatch<SetStateAction<number>>;
  }) => ReactNode;
  columnDefs: ColumnDef[];
  columnSorts?: {
    [key: string]: string;
  };
  columnSpans?: string;
  data: DataRow[];
  editCell?: EditCell | undefined;
  filters?: {
    [key: string]: string;
  };
  focusedCell?: Cell | null;
  gap?: number | {
    columnGap: number;
    rowGap: number;
  };
  handleContextMenu?: (args: {
    event: MouseEvent;
    defaultHandler: () => void;
  }) => void;
  handleHeaderPointerDown?: (args: HandleHeaderPointerDownArgs) => void;
  handleDoublePointerDown?: (args: HandleDoublePointerDownArgs) => void;
  handleEdit?: (editRows: {
    [key: string]: DataRow;
  }, leafColumns: LeafColumn[]) => void;
  handleEditCellChange?: (cell?: EditCell) => void;
  handleFocusedCellChange?: (focusedCell: Cell, event: SyntheticEvent, point?: Point) => void;
  handleFilter?: (field: string, value: string) => void;
  handleKeyDown?: (args: HandleKeyDownArgs) => void;
  handlePointerDown?: (args: HandlePointerDownArgs) => void;
  handleResize?: (field: string, value: number, columnDefs: ColumnDefWithDefaults[]) => void;
  handleScroll?: ({
    event,
    viewportElement
  }: {
    event: UIEvent<HTMLDivElement>;
    viewportElement: HTMLDivElement;
  }) => void;
  handleSelection?: (selectedRanges: IndexedArray<Range>, endPoint: Point | undefined, e: PointerEvent | PointerEvent$1<HTMLDivElement> | KeyboardEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>) => void;
  handleSort?: (nextSortMode: {
    [key: string]: string;
  } | undefined, e: PointerEvent$1<HTMLButtonElement>) => void;
  header?: (colDefs: ColumnDefWithDefaults[], leafColumns: LeafColumn[], positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>, visibleStartColumn: number, visibleEndColumn: number, styles: CSSProperties, ref: RefObject<HTMLDivElement | null>, canvasWidth: string) => ReactNode;
  id?: string;
  overscanColumns?: number;
  overscanRows?: number;
  ref?: RefObject<GridRef | null>;
  rowHeight?: number;
  rowId?: string;
  selectedRanges?: IndexedArray<Range>;
  selectionFollowsFocus?: boolean;
  showSelectionBox?: boolean;
  styles?: UserStyles;
  virtual?: "columns" | "rows" | boolean;
}
declare function Grid({
  body,
  columnDefs,
  columnSorts,
  columnSpans,
  data,
  editCell,
  filters,
  focusedCell,
  gap,
  handleContextMenu,
  handleDoublePointerDown,
  handleEdit,
  handleEditCellChange,
  handleFocusedCellChange,
  handleFilter,
  handleHeaderPointerDown,
  handleKeyDown,
  handlePointerDown,
  handleResize,
  handleScroll,
  handleSelection,
  handleSort,
  header,
  id,
  overscanColumns,
  overscanRows,
  ref,
  rowHeight,
  rowId,
  selectedRanges,
  selectionFollowsFocus,
  showSelectionBox,
  styles,
  virtual
}: GridProps): ReactElement;
declare function getLeafColumnsFromColumnDefs(columnDefs: ColumnDef[]): LeafColumn[];
//#endregion
export { Grid, getLeafColumnsFromColumnDefs as getLeafColumns };