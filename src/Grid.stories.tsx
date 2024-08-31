import { type ChangeEvent, useRef, useState } from "react";
import {
  type ColumnDef,
  type ColumnDefWithDefaults,
  type DataRow,
  getLeafColumns,
  Grid,
} from "./Grid";
import type { FilterProps } from "./Filter";
import { colDefs, data, groupedColumnDefs } from "./stories";

export function Simple() {
  const defs = colDefs
    .slice(0, 2)
    .concat(colDefs.slice(4, 7))
    .map((def) => ({
      ...def,
      width: 160,
    }));
  return <Grid columnDefs={defs} data={data.slice(0, 6)} />;
}

export function Sizing() {
  const [isBlock, setIsBlock] = useState<boolean>(false);
  const containerStyles = isBlock
    ? { display: "block", height: "240px" }
    : { height: "200px", width: "500px" };
  // const defs = colDefs.map((def: ColumnDef) => ({ ...def, width: '1fr' }));
  return (
    <div>
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

export function Styling() {
  const [gapState, setGapState] = useState(0);
  const gapStates = [
    { columnGap: 1, rowGap: 0 },
    { columnGap: 0, rowGap: 1 },
    1,
  ];
  return (
    <div>
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
            borderColor: gapState === 1 ? "transparent" : "#ccc",
          },
        }}
      />
    </div>
  );
}

export function CustomAriaLabels() {
  const defs = colDefs.map((def) => {
    return {
      ...def,
      ariaCellLabel: "Value",
      ariaHeaderCellLabel: "Thing",
    };
  });

  return <Grid columnDefs={defs} data={data} />;
}

export function Sorting() {
  const [sorts, setSorts] = useState({});
  const defs = colDefs.map((def) => ({
    ...def,
    sortable: true,
    sortStates: [
      { label: "unsorted", symbol: "↑↓", iterable: false },
      { label: "ascending", symbol: "↑" },
      { label: "descending", symbol: "↓" },
    ],
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

        const rowA = a[field];
        const rowB = b[field];

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
    <div>
      <Grid
        columnDefs={defs}
        columnSorts={sorts}
        data={sortingFunction(data, sorts)}
        handleSort={(columnSort, e) => {
          if (e.shiftKey || e.metaKey) {
            // multi column sort
            setSorts({ ...sorts, ...columnSort });
          } else {
            // single column sort
            setSorts(columnSort);
          }
        }}
      />
    </div>
  );
}

interface SelectProps extends FilterProps {
  options: { label: string; value: string }[];
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

function CitySelecter(props) {
  const uniqueArr = Array.from(new Set(data.map((row) => row.city)));
  const options = [
    { label: "All", value: "" },
    ...uniqueArr.map((city) => ({ label: city, value: city })),
  ];
  return <SelectFilterer {...props} options={options} />;
}
export function Filtering() {
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const defs = colDefs
    .map((def) => ({
      ...def,
      filterable: true,
    }))
    .map((def) =>
      def.field === "city" ? { ...def, filterer: CitySelecter } : def,
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

export function ColumnResizing() {
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
  return <Grid columnDefs={defs} data={data} handleResize={handleResize} />;
}

export function GroupedColumns() {
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
    <Grid
      columnDefs={defs}
      data={data}
      handleResize={handleResize}
      styles={{ container: { height: 410 } }}
    />
  );
}

export function PinnedColumns() {
  const ref = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState("");
  const [pinned, setPinned] = useState({});
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
      <h3>TODO</h3>
      <ul>
        <li>Fix grid-row-end, grid-column-end (when pinning occurs)</li>
        <li>Ensure `columnIndex`, `columnIndexEnd` are properly set</li>
        <li>Avoid multiple copies of ancestors from rendering (when all subcolumns aren't split)</li>
        <li>Apply pinned columns to body component</li>
      </ul>
      <br />
      <Grid
        columnDefs={defs}
        data={data}
        styles={{ container: { height: 500, width: 1100 } }}
      />
    </div>
  );
}
