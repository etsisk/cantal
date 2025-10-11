import { type ReactElement, useRef, useState } from "react";
import {
  getLeafColumnsFromColumnDefs as getLeafColumns,
  Grid,
  type ColumnDefWithDefaults,
  type LeafColumn,
  type Position,
} from "./Grid";
import { type Cell, type Range } from "./Body";
import { colDefs, data } from "./stories";
import "./styling.stories.css";

export default {
  meta: {
    hotkeys: false,
  },
};

export function Classes(): ReactElement {
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState("");
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<Range[]>([]);
  const [pinned, setPinned] = useState<{ [key: string]: "start" | "end" }>({});
  const defs = colDefs
    .slice(0, 2)
    .concat(colDefs.slice(4, 7))
    .map((def) => ({
      ...def,
      cellClassNames: {
        base: "custom-base",
        focused: "custom-focused",
        selected: "custom-selected",
      },
      filterable: true,
      headerCellClassNames: ({
        columnDef,
        position,
      }: {
        columnDef: LeafColumn | ColumnDefWithDefaults;
        position?: Position;
      }) => {
        return {
          container: `container-${columnDef?.field}`,
          label: `label-${position?.depth ?? "1"}`,
        };
      },
      ...(Object.keys(pinned).includes(def.field)
        ? { pinned: pinned[def.field] }
        : {}),
      width: 160,
    }));
  return (
    <>
      <h1>Styling with classes</h1>
      <p>
        Cantal comes with a default stylesheet with classes that you can ignore
        or override with your own classes by using the{" "}
        <code>headerCellClassNames</code> and
        <code>cellClassNames</code> column definition properties.
      </p>
      <form ref={formRef}>
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
            if (formRef.current) {
              setSelected("");
              formRef.current?.reset();
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
            formRef.current?.reset();
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
            formRef.current?.reset();
          }}
          type="button"
        >
          Unpin
        </button>
      </form>
      <br />
      <Grid
        columnDefs={defs}
        data={data.slice(0, 6)}
        focusedCell={focusedCell}
        handleFocusedCellChange={(cell: Cell) => {
          if (cell) {
            setFocusedCell(cell);
          }
        }}
        handleSelection={(selectedRanges: Range[]) => {
          setSelectedRanges(selectedRanges);
        }}
        id="grid"
        selectedRanges={selectedRanges}
      />
      <p>
        The <code>headerCellClassNames</code> column definition property can be
        assigned an object or a function. In the case of a object, the expected
        shape of the object looks like this:
      </p>

      <pre>
        {`{
  container: 'cantal-headercell',           // represents the outer element
  content: 'cantal-headercell-content',     // represents the inner element
  filter: 'cantal-headercell-filter',       // the filter element
  label: 'cantal-headercell-label',         // the column title
  resizer: 'cantal-headercell-resizer',     // the resizer element
  sorter: 'cantal-headercell-sorter',       // the sort element
}`}
      </pre>
      <p>
        In the case of a function, it would be called with the following
        parameters:
      </p>
      <ul>
        <li>
          <code>columDef</code>: the column definition
        </li>
        <li>
          <code>position</code>: an object containing the properties
          <code>ancestors</code>, <code>columnIndex</code>,{" "}
          <code>columIndexEnd</code>, <code>depth</code>, <code>field</code>,{" "}
          <code>level</code>, <code>pinnedIndex</code>,{" "}
          <code>pinnedIndexEnd</code>, and
          <code>subcolumnIndex</code>
        </li>
      </ul>
      <p>
        Its expected return value would be an object with the same expected
        shape as passing an object directly.
      </p>
      <pre>
        {`(columDef, position) => ({
  container: 'cantal-headercell',
  content: 'cantal-headercell-content',
  filter: 'cantal-headercell-filter',
  label: 'cantal-headercell-label',
  resizer: 'cantal-headercell-resizer',
  sorter: 'cantal-headercell-sorter',
});`}
      </pre>
      <p>
        The `cssClassNames` column definition property can be assigned an object
        or a function. In the case of a object, the expected shape of the object
        looks like this:
      </p>
      <pre>
        {`{
  base: 'cantal-cell-base',         // base class
  edited: 'cantal-cell-editing',    // class applied when cell is being edited
  focused: 'cantal-cell-focused',   // class applied when cell is focused
  selected: 'cantal-cell-selected', // class applied when cell is selected
}`}
      </pre>
      <p>
        In the case of a function, it would be called with the following
        parameters:
      </p>
      <ul>
        <li>
          <code>row</code>: the row data object
        </li>
        <li>
          <code>columnDef</code>: the column definition object
        </li>
        <li>
          <code>rowIndex</code>: the row's index
        </li>
        <li>
          <code>columnIndex</code>: the column's index
        </li>
      </ul>
      <pre>
        {`(row, columnDef, rowIndex, columnIndex) => ({
  base: 'cantal-cell-base',
  edited: 'cantal-cell-editing',
  focused: 'cantal-cell-focused',
  selected: 'cantal-cell-selected',
});`}
      </pre>
      <p>
        In each case, the object passed or the object returned from the function
        passed, would consist of some or all the keys listed and their
        corresponding values would be strings.
      </p>
    </>
  );
}
