import { useRef, useState } from "react";
import { type DataRow, getLeafColumns, Grid, type LeafColumn } from "./Grid";
import { type Cell, type EditCell, range, type Range } from "./Body";
import { colDefs, data } from "./stories";
import { TextAreaEditor } from "./editors/TextAreaEditor";

export default {
  meta: {
    hotkeys: false,
  },
};

export function Simple() {
  const [gridData, setGridData] = useState(data);
  const [editCell, setEditCell] = useState<EditCell | undefined>(undefined);
  const [focusedCell, setFocusedCell] = useState<Cell | undefined>(undefined);
  const [selectedRanges, setSelectedRanges] = useState<Range[]>([]);
  const defs = colDefs
    .slice(0, 2)
    .concat(colDefs.slice(4, 7))
    .map((def) => ({
      ...def,
      editable: true,
      width: 160,
    }));

  function handleEdit(editedRows: { [key: string]: DataRow }): void {
    const newData = gridData.slice();

    for (let id in editedRows) {
      const rowIdx = newData.findIndex(
        (row, rowIndex) => rowIndex === Number(id),
      );

      if (newData[rowIdx]) {
        const editedRow = editedRows[id];

        Object.keys(editedRow ?? {}).forEach(
          (field) =>
            editedRow?.[field] === undefined && delete editedRow?.[field],
        );

        newData[rowIdx] = { ...newData[rowIdx], ...editedRow };
      }
    }

    setGridData(newData);
  }

  return (
    <>
      <h1>Simple cell editing</h1>
      <p>
        Enable editing and pasting in the grid by setting <code>editable</code>{" "}
        to <code>true</code> in the column definition and providing{" "}
        <code>editCell</code>, <code>handleEditCellChange</code>, and{" "}
        <code>handleEdit</code> props:
      </p>
      <ul>
        <li>
          <code>editCell</code> holds the current cell under edit mode and
          should mirror the edit cell object passed from the grid in{" "}
          <code>handleEditCellChange</code>
        </li>
        <li>
          <code>handleEditCellChange</code> is called when the user starts,
          commits, or cancels an edit, or while the editor value is being
          changed depending on the editor
        </li>
        <li>
          All editable columns use the built-in <code>TextEditor</code>{" "}
          component by default, which provides a basic <code>input</code>{" "}
          element that allows free text
        </li>
        <li>
          When an edit is committed or a paste operation is performed,{" "}
          <code>handleEdit</code> is called with an object of row IDs / indices
          and the changed values for each row
        </li>
        <ul>
          {/*<li>
            If an `rowId` prop is provided, <code>handleEdit</code> will be
            called with an object of row IDs using the ID field from each data
            row. Otherwise, <code>handleEdit</code> will be called with an
            object of row indices
          </li>*/}
          <li>
            If a <code>valueParser</code> function is provided in the column
            definition, all edit values will be passed through the parser before
            sending them back through <code>handleEdit</code>
          </li>
        </ul>
      </ul>
      <Grid
        columnDefs={defs}
        data={gridData}
        editCell={editCell}
        focusedCell={focusedCell}
        handleEdit={handleEdit}
        handleEditCellChange={(newEditCell) => {
          setEditCell(newEditCell);
        }}
        handleFocusedCellChange={(focusedCell) => {
          setFocusedCell(focusedCell);
          setSelectedRanges([
            range(focusedCell.rowIndex, focusedCell.columnIndex),
          ]);
        }}
        // rowId="propertyId"
        handleSelection={(selectedRanges: Range[]) => {
          setSelectedRanges(selectedRanges);
        }}
        selectedRanges={selectedRanges}
        styles={{
          container: {
            height: 200,
          },
        }}
      />
      <p>
        <strong>Supported behaviors include:</strong>
      </p>
      <ul>
        <li>Double-click a cell to edit it</li>
        <li>
          Press any printable key in a focused cell (<kbd>A-Z</kbd>,{" "}
          <kbd>0-9</kbd>, punctuation, etc...)
        </li>
        <li>
          Press <kbd>Backspace</kbd> or <kbd>Delete</kbd> a focused cell to open
          the editor and clear cell contents
        </li>
        <li>
          Press <kbd>F2</kbd> or <kbd>Ctrl+U</kbd> to edit the focused cell and
          place the cursor at the end
        </li>
        <li>
          Paste something from the system clipboard using <kbd>Cmd+V</kbd> or{" "}
          <kbd>Ctrl+V</kbd>
        </li>
      </ul>
    </>
  );
}

export function OverflowEditors() {
  const [gridData, setGridData] = useState(data.slice(0, 20));
  const [editCell, setEditCell] = useState<EditCell | undefined>(undefined);
  const [focusedCell, setFocusedCell] = useState<Cell | undefined>(undefined);
  const [selectedRanges, setSelectedRanges] = useState<Range[]>([]);
  const defs = colDefs
    .slice(0, 2)
    .concat(colDefs.slice(4, 7))
    .map((def) => ({
      ...def,
      allowEditCellOverflow: true,
      editable: true,
      editor: () => TextAreaEditor,
      width: 160,
    }));

  function handleEdit(editedRows: { [key: string]: DataRow }): void {
    const newData = gridData.slice();

    for (let id in editedRows) {
      const rowIdx = newData.findIndex(
        (row, rowIndex) => rowIndex === Number(id),
      );

      if (newData[rowIdx]) {
        const editedRow = editedRows[id];

        Object.keys(editedRow ?? {}).forEach(
          (field) =>
            editedRow?.[field] === undefined && delete editedRow?.[field],
        );

        newData[rowIdx] = { ...newData[rowIdx], ...editedRow };
      }
    }

    setGridData(newData);
  }
  return (
    <>
      <h1>Overflow editors</h1>
      <Grid
        columnDefs={defs}
        data={gridData}
        editCell={editCell}
        focusedCell={focusedCell}
        handleEdit={handleEdit}
        handleEditCellChange={(newEditCell) => {
          setEditCell(newEditCell);
        }}
        handleFocusedCellChange={(focusedCell) => {
          setFocusedCell(focusedCell);
          setSelectedRanges([
            range(focusedCell.rowIndex, focusedCell.columnIndex),
          ]);
        }}
        handleSelection={(selectedRanges: Range[]) => {
          setSelectedRanges(selectedRanges);
        }}
        selectedRanges={selectedRanges}
        styles={{
          container: {
            height: 400,
            width: 600,
          },
        }}
      />
    </>
  );
}

export function PinnedAndSpanned() {
  const ref = useRef<HTMLFormElement>(null);
  const [pinned, setPinned] = useState<{ [key: string]: "start" | "end" }>({});
  const [selected, setSelected] = useState("");
  const [gridData, setGridData] = useState(data.slice(0, 20));
  const [editCell, setEditCell] = useState<EditCell | undefined>(undefined);
  const [focusedCell, setFocusedCell] = useState<Cell | undefined>(undefined);
  const [selectedRanges, setSelectedRanges] = useState<Range[]>([]);
  const defs = colDefs
    .slice(0, 2)
    .concat(colDefs.slice(4, 9))
    .map((def) => ({
      ...def,
      allowEditCellOverflow: true,
      editable: true,
      ...(Object.keys(pinned).includes(def.field)
        ? { pinned: pinned[def.field] }
        : {}),
      rowSpanning: true,
      width: 160,
    }));

  function handleEdit(
    editedRows: { [key: string]: DataRow },
    leafColumns: LeafColumn[],
  ): void {
    const newData = gridData.slice();

    for (let id in editedRows) {
      const rowIdx: number = newData.findIndex(
        (row, rowIndex) => rowIndex === Number(id),
      );

      const originalRow = gridData[rowIdx];
      if (newData[rowIdx]) {
        const editedRow = editedRows[id];

        Object.keys(editedRow ?? {}).forEach(
          (field) =>
            editedRow?.[field] === undefined && delete editedRow?.[field],
        );

        newData[rowIdx] = { ...newData[rowIdx], ...editedRow };

        for (let field of Object.keys(editedRow ?? {})) {
          const columnDef = leafColumns.find((def) => def.field === field);
          if (!columnDef) {
            continue;
          }
          let rowIndex: number = rowIdx + 1;

          while (rowIndex < gridData.length) {
            const nextRow = gridData[rowIndex];
            if (!originalRow || !nextRow) {
              break;
            }
            const originalRowField = getValue(originalRow, field);
            const nextRowField = getValue(nextRow, field);
            if (
              originalRowField === undefined ||
              nextRowField === undefined ||
              columnDef.valueRenderer({
                columnDef,
                data: nextRow,
                value: nextRowField,
              }) !==
                columnDef.valueRenderer({
                  columnDef,
                  data: originalRow,
                  value: originalRowField,
                })
            ) {
              break;
            }

            newData[rowIndex] = Object.assign({}, newData[rowIndex], {
              [field]: editedRow?.[field],
            });

            rowIndex++;
          }
        }
      }
    }

    setGridData(newData);
  }

  function getValue(
    object: { [key: string]: unknown } | undefined,
    field: string,
  ): unknown | undefined {
    if (object === undefined) {
      return;
    }
    if (Object.hasOwn(object, field)) {
      return object[field];
    }
    return;
  }

  return (
    <>
      <h1>Editing pinned columns and spanned cells</h1>

      <h2>TODO</h2>
      <ul>
        <li>
          Figure out why selections that enter spans in the middle aren't
          getting set properly
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
        data={gridData}
        editCell={editCell}
        focusedCell={focusedCell}
        handleEdit={handleEdit}
        handleEditCellChange={(newEditCell) => {
          setEditCell(newEditCell);
        }}
        handleFocusedCellChange={(focusedCell) => {
          setFocusedCell(focusedCell);
          setSelectedRanges([
            range(focusedCell.rowIndex, focusedCell.columnIndex),
          ]);
        }}
        handleSelection={(selectedRanges: Range[]) => {
          setSelectedRanges(selectedRanges);
        }}
        selectedRanges={selectedRanges}
        styles={{
          container: {
            height: 400,
            width: 900,
          },
        }}
      />
    </>
  );
}
