import {
  type ChangeEvent,
  type CSSProperties,
  type ReactElement,
  type SyntheticEvent,
  useRef,
  useState,
} from "react";
import {
  type ColumnDef,
  type ColumnDefWithDefaults,
  type DataRow,
  getLeafColumnsFromColumnDefs as getLeafColumns,
  Grid,
  type NonEmptyArray,
  type Point,
} from "./Grid";
import { type Cell, range, type Range } from "./Body";
import type { FiltererProps } from "./Filter";
import { colDefs, data, generateData, groupedColumnDefs } from "./stories";
import type { SortState } from "./Sorter";

export default {
  meta: {
    hotkeys: false,
  },
};

const manyRows = generateData(100_000, 10);
const manyColumns = generateData(10, 10_000);

export function Simple(): ReactElement {
  const defs = colDefs
    .slice(0, 2)
    .concat(colDefs.slice(4, 7))
    .map((def) => ({
      ...def,
      width: 160,
    }));
  return (
    <>
      <h1>Simple</h1>
      <p>
        This example demonstates most basic implementation of the grid,
        providing the only two required props: <code>columnDefs</code> and{" "}
        <code>data</code>.
      </p>
      <Grid columnDefs={defs} data={data.slice(0, 6)} />
    </>
  );
}

export function Sizing(): ReactElement {
  const [isBlock, setIsBlock] = useState<boolean>(false);
  const containerStyles = isBlock
    ? { display: "block", height: "240px" }
    : { width: "500px", height: "200px" };
  return (
    <div>
      <h1>Sizing</h1>
      <p>
        <button onClick={() => setIsBlock(!isBlock)}>Toggle sizing</button>
      </p>
      <Grid
        columnDefs={colDefs}
        data={data}
        styles={{ container: containerStyles }}
      />
    </div>
  );
}

export function Styling(): ReactElement {
  const [gapState, setGapState] = useState(0);
  const gapStates = [
    { columnGap: 1, rowGap: 0 },
    { columnGap: 0, rowGap: 1 },
    1,
  ];
  return (
    <div>
      <h1>Grid gap styling</h1>
      <p>
        <button
          onClick={() => setGapState((prev) => (prev === 2 ? 0 : prev + 1))}
          type="button"
        >
          Change gap style
        </button>
      </p>
      <Grid
        columnDefs={colDefs}
        data={data}
        gap={gapStates[gapState]}
        styles={{
          container: {
            borderColor: gapState === 1 ? "transparent" : "var(--border-color)",
          },
        }}
      />
    </div>
  );
}

export function CustomAriaLabels(): ReactElement {
  const defs = colDefs.map((def) => {
    return {
      ...def,
      ariaCellLabel: "Value",
      ariaHeaderCellLabel: "Thing",
    };
  });

  return (
    <>
      <h1>Custom aria labels</h1>
      <Grid columnDefs={defs} data={data} />;
    </>
  );
}

export function Sorting(): ReactElement {
  const [sorts, setSorts] = useState({});
  const defs = colDefs.map((def) => ({
    ...def,
    sortable: true,
    sortStates:
      def.field === "primaryPropertyType"
        ? ([
            { label: "unsorted", symbol: "🏢" },
            { label: "ascending", symbol: "🏫" },
            { label: "descending", symbol: "🏛️" },
          ] satisfies NonEmptyArray<SortState>)
        : ([
            { label: "unsorted", symbol: "↑↓", iterable: false },
            { label: "ascending", symbol: "↑" },
            { label: "descending", symbol: "↓" },
          ] satisfies NonEmptyArray<SortState>),
    width: 180,
  }));

  function sortingFunction(
    data: DataRow[],
    columnSorts: { [key: string]: string },
  ) {
    return data.toSorted((a: DataRow, b: DataRow) => {
      for (let [field, value] of Object.entries(columnSorts)) {
        if (value === "unsorted") {
          continue;
        }

        const rowA = a[field] as string;
        const rowB = b[field] as string;

        let result =
          rowA == rowB
            ? 0
            : rowA > rowB ||
                (typeof rowA === "number" && typeof rowB === "string")
              ? 1
              : -1;
        result *= value === "ascending" ? 1 : -1;

        if (result !== 0) {
          return result;
        }
      }

      return 0;
    });
  }

  return (
    <div>
      <h1>Sorting</h1>
      <p>
        In this example, you can define your own custom sort symbols (see the{" "}
        <em>Primary Property Type - Self-Selected</em> column). You can also
        define which sort states you can cycle through. In this example, all of
        the other columns exclude the "unsorted" state from being cycled to.
      </p>
      <Grid
        columnDefs={defs}
        columnSorts={sorts}
        data={sortingFunction(data, sorts)}
        handleSort={(columnSort, e) => {
          if (columnSort !== undefined) {
            if (e.shiftKey || e.metaKey) {
              // multi column sort
              setSorts({ ...sorts, ...columnSort });
            } else {
              // single column sort
              setSorts(columnSort);
            }
          }
        }}
      />
    </div>
  );
}

interface SelectProps extends FiltererProps {
  options: { label: string; value: string }[];
  styles?: CSSProperties;
}

function SelectFilterer({ field, handleFilter, options, styles }: SelectProps) {
  const filterStyle = {
    display: "block",
    margin: "4px 0 0",
    ...styles,
  };

  function handleInputChange(e: ChangeEvent<HTMLSelectElement>) {
    handleFilter(e.target.name, e.target.value);
  }

  return (
    <select
      aria-label="Filter"
      onChange={handleInputChange}
      name={field}
      style={filterStyle}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function CitySelect(props: FiltererProps) {
  const uniqueArr = Array.from(new Set(data.map((row) => row.city as string)));
  const options = [
    { label: "All", value: "" },
    ...uniqueArr.map((city) => ({ label: city, value: city })),
  ];
  return <SelectFilterer {...props} options={options} />;
}
export function Filtering(): ReactElement {
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const defs = colDefs
    .map((def) => ({
      ...def,
      filterable: true,
    }))
    .map((def) =>
      def.field === "city" ? { ...def, filterer: CitySelect } : def,
    );

  function filter(
    data: { [key: string]: unknown }[],
    filters: { [key: string]: string },
  ) {
    return data.filter((row) => {
      for (let [field, filterValue] of Object.entries(filters)) {
        if (filterValue.length === 0) {
          continue;
        }
        const value = row[field];
        if (value === undefined || value === null) {
          return false;
        }
        if (!String(value).toLowerCase().includes(filterValue.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }

  return (
    <div>
      <h1>Filtering</h1>
      <Grid
        columnDefs={defs}
        data={filter(data, filters)}
        filters={filters}
        handleFilter={(field: string, value: string) =>
          setFilters((prev) => ({ ...prev, [field]: value }))
        }
      />
    </div>
  );
}

export function ColumnResizing(): ReactElement {
  const [defs, setDefs] = useState<ColumnDef[]>(
    colDefs.map((def) => ({ ...def, resizable: true })),
  );
  function handleResize(
    field: string,
    width: number,
    columnDefs: ColumnDefWithDefaults[],
  ) {
    setDefs(columnDefs);
  }
  return (
    <>
      <h1>Column resizing</h1>
      <Grid columnDefs={defs} data={data} handleResize={handleResize} />
    </>
  );
}

export function GroupedColumns(): ReactElement {
  const [defs, setDefs] = useState(resizable(groupedColumnDefs.slice(0, 5)));

  function resizable(defs: ColumnDef[]): ColumnDef[] {
    return defs.slice(0).map((def: ColumnDef) => {
      if (def.subcolumns && def.subcolumns?.length > 0) {
        return {
          ...def,
          resizable: true,
          subcolumns: resizable(def.subcolumns),
        };
      }
      return { ...def, resizable: true };
    });
  }

  function handleResize(
    field: string,
    width: number,
    columnDefs: ColumnDefWithDefaults[],
  ) {
    setDefs(columnDefs);
  }

  return (
    <>
      <h1>Grouped columns</h1>
      <Grid
        columnDefs={defs}
        data={data}
        handleResize={handleResize}
        styles={{ container: { height: 410 } }}
      />
    </>
  );
}

export function PinnedColumns(): ReactElement {
  const ref = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState("");
  const [pinned, setPinned] = useState<{ [key: string]: "start" | "end" }>({});
  const defs = groupedColumnDefs.slice(0, 5).map((gc, i) =>
    gc.subcolumns?.length
      ? {
          ...gc,
          subcolumns:
            gc.subcolumns?.map((sc) =>
              Object.keys(pinned).includes(sc.field)
                ? { ...sc, pinned: pinned[sc.field] }
                : sc,
            ) ?? [],
        }
      : Object.keys(pinned).includes(gc.field)
        ? { ...gc, pinned: pinned[gc.field] }
        : gc,
  );

  return (
    <div>
      <h1>Pinned columns</h1>
      <form ref={ref}>
        <label htmlFor="select">Choose a column to pin:</label>
        <select
          id="select"
          onChange={(e) => setSelected(e.target.value)}
          style={{ display: "block" }}
          value={selected}
        >
          <option value="" />
          {getLeafColumns(defs).map((def) => (
            <option key={def.field} value={def.field}>
              {def.title}
            </option>
          ))}
        </select>
        <button
          disabled={selected === ""}
          onClick={() => {
            setPinned((prev) => ({ ...prev, [selected]: "start" }));
            if (ref.current) {
              setSelected("");
              ref.current?.reset();
            }
          }}
          type="button"
        >
          Left
        </button>
        <button
          disabled={selected === ""}
          onClick={() => {
            setPinned((prev) => ({ ...prev, [selected]: "end" }));
            setSelected("");
            ref.current?.reset();
          }}
          type="button"
        >
          Right
        </button>
        <button
          disabled={
            !Object.keys(pinned).includes(selected) ||
            Object.keys(pinned).length === 0
          }
          onClick={() => {
            setPinned((prev) =>
              Object.keys(prev)
                .filter((key) => key !== selected)
                .reduce(
                  (obj, key) => ({
                    ...obj,
                    [key]: prev[key as keyof typeof prev],
                  }),
                  {},
                ),
            );
            setSelected("");
            ref.current?.reset();
          }}
          type="button"
        >
          Unpin
        </button>
      </form>
      <br />
      <Grid
        columnDefs={defs}
        data={data}
        styles={{ container: { height: 500, width: 1100 } }}
      />
    </div>
  );
}

export function CellFocus(): ReactElement {
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  return (
    <>
      <h1>Cell focus</h1>
      <Grid
        columnDefs={colDefs}
        data={data}
        focusedCell={focusedCell}
        handleFocusedCellChange={(
          cell: Cell,
          e: SyntheticEvent,
          point: Point | undefined,
        ) => {
          if (cell) {
            setFocusedCell(cell);
          }
        }}
        styles={{ container: { height: 400, width: "800px" } }}
      />
    </>
  );
}

export function CellSelection(): ReactElement {
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<Range[]>([]);
  const [selectionMode, setSelectionMode] = useState<string>("lib-managed");
  const [showSelection, setShowSelection] = useState<boolean>(true);

  return (
    <>
      <h1>Cell selection</h1>
      <h2>Supported behaviors</h2>
      <ul>
        <li>Mouse/press down and drag to select a range of cells</li>
        <li>
          Click on a cell to focus, then <kbd>Shift</kbd> + click to select a
          range of cells
        </li>
        <li>
          Click on a cell to focus, then press <kbd>Shift</kbd> +{" "}
          <kbd>ArrowKey</kbd> to change the range of cells selected
        </li>
      </ul>
      <p>
        Cell focus and selection are independent of each other and the behavior
        can be defined at various levels of your app. Play around with the
        options below:
      </p>
      <fieldset style={{ marginBlock: "0.5rem" }}>
        <legend>Cell selection</legend>
        <label style={{ display: "block", marginBlock: "0.5rem" }}>
          <input
            checked={selectionMode === "unmanaged"}
            id="unmanaged"
            onChange={() => setSelectionMode("unmanaged")}
            name="selection-mode"
            type="radio"
          />{" "}
          Unmanaged - allows for cell focus to be independent of cell selection
        </label>
        <label style={{ display: "block", marginBlock: "0.5rem" }}>
          <input
            checked={selectionMode === "app-managed"}
            id="app-managed"
            name="selection-mode"
            onChange={() => setSelectionMode("app-managed")}
            type="radio"
          />{" "}
          App-managed - app logic can define the relationship between cell focus
          and cell selection
        </label>
        <label style={{ display: "block", marginBlock: "0.5rem" }}>
          <input
            checked={selectionMode === "lib-managed"}
            id="lib-managed"
            name="selection-mode"
            onChange={() => setSelectionMode("lib-managed")}
            type="radio"
          />{" "}
          Lib-managed - <code>selectionFollowsFocus</code> keeps cell selection
          updated on cell focus change. It's handy when row spanning is enabled
          because Cantal calculates the ranges for you.
        </label>
      </fieldset>
      <p>Lastly, you can optional render a cursor selection area.</p>
      <label>
        <input
          checked={showSelection}
          onChange={() => setShowSelection((prev) => !prev)}
          type="checkbox"
        />{" "}
        Draw selection area
      </label>
      <p />
      <Grid
        columnDefs={colDefs}
        data={data}
        focusedCell={focusedCell}
        handleFocusedCellChange={(cell: Cell) => {
          if (cell) {
            setFocusedCell(cell);
            if (selectionMode === "app-managed") {
              const appRange = range(cell.rowIndex, cell.columnIndex);
              setSelectedRanges([appRange]);
            }
          }
        }}
        handleSelection={(selectedRanges: Range[]) => {
          setSelectedRanges(selectedRanges);
        }}
        selectedRanges={selectedRanges}
        selectionFollowsFocus={selectionMode === "lib-managed"}
        showSelectionBox={showSelection}
      />
    </>
  );
}

export function CellCopy(): ReactElement {
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<Range[]>([]);
  return (
    <>
      <h1>Cell copy</h1>
      <Grid
        columnDefs={colDefs}
        data={data}
        focusedCell={focusedCell}
        handleFocusedCellChange={(cell: Cell) => {
          if (cell) {
            setFocusedCell(cell);
          }
        }}
        handleSelection={(selectedRanges: Range[]) => {
          setSelectedRanges(selectedRanges);
        }}
        selectedRanges={selectedRanges}
        selectionFollowsFocus={true}
      />
    </>
  );
}

export function ProgrammaticControls(): ReactElement {
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [columnFilter, setColumnFilter] = useState<string>("");
  const [sorts, setSorts] = useState({});
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<Range[]>([]);
  const defs = colDefs
    .filter(
      (def) =>
        columnFilter === "" ||
        def.title?.toLowerCase().includes(columnFilter.toLowerCase()),
    )
    .map((def) => ({
      ...def,
      filterable: true,
      sortable: true,
    }));

  function filter(
    data: { [key: string]: unknown }[],
    filters: { [key: string]: string },
  ) {
    return data.filter((row) => {
      for (let [field, filterValue] of Object.entries(filters)) {
        if (filterValue.length === 0) {
          continue;
        }
        const value = row[field];
        if (value === undefined || value === null) {
          return false;
        }
        if (!String(value).toLowerCase().includes(filterValue.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }

  function sortingFunction(
    data: DataRow[],
    columnSorts: { [key: string]: string },
  ) {
    return data.toSorted((a: DataRow, b: DataRow) => {
      for (let [field, value] of Object.entries(columnSorts)) {
        if (value === "unsorted") {
          continue;
        }

        const rowA = a[field] as string;
        const rowB = b[field] as string;

        let result = rowA == rowB ? 0 : rowA > rowB ? 1 : -1;
        result *= value === "ascending" ? 1 : -1;

        if (result !== 0) {
          return result;
        }
      }

      return 0;
    });
  }

  const leafColumns = getLeafColumns(defs);
  return (
    <div>
      <h1>Programmatic controls</h1>
      <h2 style={{ marginBlockEnd: "5px" }}>Sorting</h2>
      <button onClick={() => setSorts({ city: "ascending" })}>
        Sort by Borough
      </button>
      <button
        onClick={() => setSorts({ city: "ascending", address: "ascending" })}
      >
        Sort by Borough and Address
      </button>
      <button onClick={() => setSorts({})}>Reset sort</button>
      <h2 style={{ marginBlockEnd: "5px" }}>Filtering</h2>
      <button onClick={() => setFilters({ city: "Staten Island" })}>
        Show properties only from Staten Island
      </button>
      <button onClick={() => setFilters({})}>Clear all filters</button>
      <input
        onChange={(e) => setColumnFilter(e.target.value)}
        placeholder="Filter columns..."
        type="text"
        value={columnFilter}
      />
      <h2 style={{ marginBlockEnd: "5px" }}>Focusing</h2>
      <button onClick={() => setFocusedCell({ columnIndex: 1, rowIndex: 1 })}>
        Focus the second row in the second column
      </button>
      <button onClick={() => setFocusedCell(null)}>Clear cell focus</button>
      <h2 style={{ marginBlockEnd: "5px" }}>Selection</h2>
      <button
        onClick={() => {
          setSelectedRanges([range(1, 0, 1, leafColumns.length - 1)]);
        }}
      >
        Select 2nd row
      </button>
      <button
        onClick={() => {
          setSelectedRanges([
            range(1, 0, 1, leafColumns.length - 1),
            range(3, 0, 3, leafColumns.length - 1),
          ]);
        }}
      >
        Select 2nd and 4th rows
      </button>
      <button
        onClick={() => {
          setSelectedRanges([range(0, 0), range(1, 1), range(2, 2)]);
        }}
      >
        Select 3 separate cells
      </button>
      <button onClick={() => setSelectedRanges([])}>
        Reset cell selection
      </button>
      <Grid
        columnDefs={defs}
        columnSorts={sorts}
        data={sortingFunction(filter(data, filters), sorts)}
        filters={filters}
        focusedCell={focusedCell}
        handleFilter={(field: string, value: string) =>
          setFilters((prev) => ({ ...prev, [field]: value }))
        }
        handleFocusedCellChange={(cell: Cell) => {
          setFocusedCell(cell);
        }}
        handleSelection={(selectedRanges: Range[]) => {
          setSelectedRanges(selectedRanges);
        }}
        handleSort={(columnSort, e) => {
          if (columnSort !== undefined) {
            if (e.shiftKey || e.metaKey) {
              setSorts({ ...sorts, ...columnSort });
            } else {
              setSorts(columnSort);
            }
          }
        }}
        selectedRanges={selectedRanges}
      />
    </div>
  );
}

export function VirtualRows(): ReactElement {
  const { colDefs, data } = manyRows;
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  const [pinned, setPinned] = useState<{ [key: string]: "start" | "end" }>({});
  const [selected, setSelected] = useState("");
  return (
    <>
      <h1>Virtual rows</h1>
      <form>
        <label htmlFor="select">Choose a column to pin:</label>
        <select
          id="select"
          onChange={(e) => setSelected(e.target.value)}
          style={{ display: "block" }}
          value={selected}
        >
          <option value="" />
          {getLeafColumns(colDefs).map((def) => (
            <option key={def.field} value={def.field}>
              {def.title}
            </option>
          ))}
        </select>
        <button
          disabled={selected === ""}
          formAction={() => {
            setPinned((prev) => ({ ...prev, [selected]: "start" }));
            setSelected("");
          }}
        >
          Left
        </button>
        <button
          disabled={selected === ""}
          formAction={() => {
            setPinned((prev) => ({ ...prev, [selected]: "end" }));
            setSelected("");
          }}
        >
          Right
        </button>
        <button
          disabled={
            !Object.keys(pinned).includes(selected) ||
            Object.keys(pinned).length === 0
          }
          formAction={() => {
            setPinned((prev) =>
              Object.keys(prev)
                .filter((key) => key !== selected)
                .reduce(
                  (obj, key) => ({
                    ...obj,
                    [key]: prev[key as keyof typeof prev],
                  }),
                  {},
                ),
            );
            setSelected("");
          }}
        >
          Unpin
        </button>
      </form>
      <br />
      <Grid
        columnDefs={colDefs.map((def) => {
          return Object.keys(pinned).includes(def.field)
            ? { ...def, pinned: pinned[def.field] }
            : def;
        })}
        data={data}
        focusedCell={focusedCell}
        handleFocusedCellChange={(cell: Cell) => {
          if (cell) {
            setFocusedCell(cell);
          }
        }}
        styles={{
          container: {
            height: 300,
          },
        }}
        virtual="rows"
      />
      <h2>Focus management</h2>
      <p>
        If your focused cell scrolls out of the "window" and is removed from the
        DOM, Cantal is smart enough to not lose focus. Try clicking on a cell to
        set it in focus, then scroll up or down by ~50 rows or so to make sure
        the cell is removed from the DOM. Now use your arrow keys to change the
        cell in focus.
      </p>
    </>
  );
}

export function VirtualColumns(): ReactElement {
  const { colDefs, data } = manyColumns;
  const [pinned, setPinned] = useState<{ [key: string]: "start" | "end" }>({});
  const [selected, setSelected] = useState("");
  return (
    <>
      <h1>Virtual columns</h1>
      <form>
        <label htmlFor="select">Choose a column to pin:</label>
        <select
          id="select"
          onChange={(e) => setSelected(e.target.value)}
          style={{ display: "block" }}
          value={selected}
        >
          <option value="" />
          {getLeafColumns(colDefs).map((def) => (
            <option key={def.field} value={def.field}>
              {def.title}
            </option>
          ))}
        </select>
        <button
          disabled={selected === ""}
          formAction={() => {
            setPinned((prev) => ({ ...prev, [selected]: "start" }));
            setSelected("");
          }}
        >
          Left
        </button>
        <button
          disabled={selected === ""}
          formAction={() => {
            setPinned((prev) => ({ ...prev, [selected]: "end" }));
            setSelected("");
          }}
        >
          Right
        </button>
        <button
          disabled={
            !Object.keys(pinned).includes(selected) ||
            Object.keys(pinned).length === 0
          }
          formAction={() => {
            setPinned((prev) =>
              Object.keys(prev)
                .filter((key) => key !== selected)
                .reduce(
                  (obj, key) => ({
                    ...obj,
                    [key]: prev[key as keyof typeof prev],
                  }),
                  {},
                ),
            );
            setSelected("");
          }}
        >
          Unpin
        </button>
      </form>
      <br />
      <Grid
        columnDefs={colDefs.map((def) => {
          return Object.keys(pinned).includes(def.field)
            ? { ...def, pinned: pinned[def.field] }
            : def;
        })}
        data={data}
        styles={{
          container: {
            width: 1000,
          },
        }}
        virtual="columns"
      />
    </>
  );
}

export function RowSpanning(): ReactElement {
  const [sorts, setSorts] = useState({});
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<Range[]>([]);
  const [pinned, setPinned] = useState<{ [key: string]: "start" | "end" }>({});
  const [selected, setSelected] = useState("");
  const defs = colDefs
    .slice(0, 2)
    .concat(colDefs.slice(4, 7))
    .map((def) => ({
      ...def,
      rowSpanning: def.field === "city",
      ...(def.field === "zip"
        ? {
            rowSpanning: true,
            sortable: true,
            sortStates: [
              { label: "unsorted", symbol: "↑↓" },
              { label: "ascending", symbol: "↑" },
              { label: "descending", symbol: "↓" },
            ] satisfies NonEmptyArray<SortState>,
          }
        : {}),
      width: 160,
    }));

  function sortingFunction(
    data: DataRow[],
    columnSorts: { [key: string]: string },
  ) {
    return data.toSorted((a: DataRow, b: DataRow) => {
      for (let [field, value] of Object.entries(columnSorts)) {
        if (value === "unsorted") {
          continue;
        }

        const rowA = a[field] as string;
        const rowB = b[field] as string;

        let result = rowA == rowB ? 0 : rowA > rowB ? 1 : -1;
        result *= value === "ascending" ? 1 : -1;

        if (result !== 0) {
          return result;
        }
      }

      return 0;
    });
  }

  return (
    <>
      <h1>Row spanning</h1>
      <form>
        <label htmlFor="select">Choose a column to pin:</label>
        <select
          id="select"
          onChange={(e) => setSelected(e.target.value)}
          style={{ display: "block" }}
          value={selected}
        >
          <option value="" />
          {getLeafColumns(defs).map((def) => (
            <option key={def.field} value={def.field}>
              {def.title}
            </option>
          ))}
        </select>
        <button
          disabled={selected === ""}
          formAction={() => {
            setPinned((prev) => ({ ...prev, [selected]: "start" }));
            setSelected("");
          }}
        >
          Left
        </button>
        <button
          disabled={selected === ""}
          formAction={() => {
            setPinned((prev) => ({ ...prev, [selected]: "end" }));
            setSelected("");
          }}
        >
          Right
        </button>
        <button
          disabled={
            !Object.keys(pinned).includes(selected) ||
            Object.keys(pinned).length === 0
          }
          formAction={() => {
            setPinned((prev) =>
              Object.keys(prev)
                .filter((key) => key !== selected)
                .reduce(
                  (obj, key) => ({
                    ...obj,
                    [key]: prev[key as keyof typeof prev],
                  }),
                  {},
                ),
            );
            setSelected("");
          }}
        >
          Unpin
        </button>
      </form>
      <br />
      <Grid
        columnDefs={defs.map((def) => {
          return Object.keys(pinned).includes(def.field)
            ? { ...def, pinned: pinned[def.field] }
            : def;
        })}
        columnSorts={sorts}
        data={sortingFunction(data, sorts)}
        focusedCell={focusedCell}
        handleFocusedCellChange={(cell: Cell) => {
          if (cell) {
            setFocusedCell(cell);
          }
        }}
        handleSelection={(selectedRanges: Range[]) => {
          setSelectedRanges(selectedRanges);
        }}
        handleSort={(columnSort, e) => {
          if (columnSort !== undefined) {
            if (e.shiftKey || e.metaKey) {
              // multi column sort
              setSorts({ ...sorts, ...columnSort });
            } else {
              // single column sort
              setSorts(columnSort);
            }
          }
        }}
        selectedRanges={selectedRanges}
        selectionFollowsFocus={true}
        showSelectionBox={true}
        styles={{
          container: {
            height: 300,
          },
        }}
        virtual="rows"
      />
    </>
  );
}

export function ColumnSpanning(): ReactElement {
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<Range[]>([]);
  const ref = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState("");
  const [pinned, setPinned] = useState<{ [key: string]: "start" | "end" }>({});
  const columnDefinitions = colDefs
    .map((def) =>
      def.field === "meteredAreasEnergy" ? { ...def, rowSpanning: true } : def,
    )
    .map((cd) =>
      Object.keys(pinned).includes(cd.field)
        ? { ...cd, pinned: pinned[cd.field] }
        : cd,
    );
  function sortingFunction(
    data: DataRow[],
    columnSorts: { [key: string]: string },
  ) {
    return data.toSorted((a: DataRow, b: DataRow) => {
      for (let [field, value] of Object.entries(columnSorts)) {
        if (value === "unsorted") {
          continue;
        }

        const rowA = a[field] as string;
        const rowB = b[field] as string;

        let result =
          rowA == rowB
            ? 0
            : rowA > rowB ||
                (typeof rowA === "number" && typeof rowB === "string")
              ? 1
              : -1;
        result *= value === "ascending" ? 1 : -1;

        if (result !== 0) {
          return result;
        }
      }

      return 0;
    });
  }

  return (
    <>
      <h1>Column spanning</h1>
      <h2>TODO</h2>
      <ul>
        <li>
          Consider removing focus/selection when interacting with header
          elements (e.g. sorter)
        </li>
      </ul>
      <form ref={ref}>
        <label htmlFor="select">Choose a column to pin:</label>
        <select
          id="select"
          onChange={(e) => setSelected(e.target.value)}
          style={{ display: "block" }}
          value={selected}
        >
          <option value="" />
          {getLeafColumns(columnDefinitions).map((def) => (
            <option key={def.field} value={def.field}>
              {def.title}
            </option>
          ))}
        </select>
        <button
          disabled={selected === ""}
          onClick={() => {
            setPinned((prev) => ({ ...prev, [selected]: "start" }));
            if (ref.current) {
              setSelected("");
              ref.current?.reset();
            }
          }}
          type="button"
        >
          Left
        </button>
        <button
          disabled={selected === ""}
          onClick={() => {
            setPinned((prev) => ({ ...prev, [selected]: "end" }));
            setSelected("");
            ref.current?.reset();
          }}
          type="button"
        >
          Right
        </button>
        <button
          disabled={
            !Object.keys(pinned).includes(selected) ||
            Object.keys(pinned).length === 0
          }
          onClick={() => {
            setPinned((prev) =>
              Object.keys(prev)
                .filter((key) => key !== selected)
                .reduce(
                  (obj, key) => ({
                    ...obj,
                    [key]: prev[key as keyof typeof prev],
                  }),
                  {},
                ),
            );
            setSelected("");
            ref.current?.reset();
          }}
          type="button"
        >
          Unpin
        </button>
      </form>
      <br />
      <Grid
        columnDefs={columnDefinitions}
        columnSpans="columnSpans"
        data={sortingFunction(data, { energyStarScore: "descending" }).flatMap(
          (row, i) => {
            if (i === 0) {
              return [
                {
                  columnSpans: [
                    {
                      field: "eggcellent",
                      from: 0,
                      to: colDefs.length - 1,
                      valueRenderer: () => "Excellent",
                    },
                  ],
                },
                row,
              ];
            }
            if (row.energyStarScore === 79) {
              return [
                {
                  columnSpans: [
                    {
                      field: "meteredAreasEnergy",
                      from: 4,
                      to: 16,
                    },
                  ],
                  meteredAreasEnergy: "Whole Property",
                },
                row,
              ];
            }
            if (row.energyStarScore === 66) {
              return [
                {
                  columnSpans: [
                    {
                      field: "poor",
                      from: 0,
                      to: 5,
                      valueRenderer: () => "Poor",
                    },
                  ],
                },
                row,
              ];
            }
            if (
              row.energyStarScore === "Not Available" &&
              i < data.length - 1
            ) {
              return [
                {
                  columnSpans: [
                    {
                      field: "na",
                      from: colDefs.length - 7,
                      to: colDefs.length - 1,
                      valueRenderer: () => "Not Available",
                    },
                  ],
                },
                row,
              ];
            }
            return [row];
          },
        )}
        focusedCell={focusedCell}
        handleFocusedCellChange={(cell: Cell) => {
          if (cell) {
            setFocusedCell(cell);
          }
        }}
        handleSelection={(selectedRanges: Range[]) => {
          setSelectedRanges(selectedRanges);
        }}
        selectedRanges={selectedRanges}
        selectionFollowsFocus={true}
        styles={{
          container: {
            height: "50vh",
            width: "calc(100vw - 375px)",
          },
        }}
        virtual={true}
      />
    </>
  );
}
