import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useRef,
  useState,
} from "react";
import {
  getLeafColumns,
  Grid,
  type ColumnDefWithDefaults,
  type DataRow,
  type GridRef,
  type LeafColumn,
  type Point,
} from "./Grid";
import {
  type Cell,
  type EditCell,
  type IndexedArray,
  range,
  type Range,
} from "./Body";
import { colDefs, data, groupedColumnDefs } from "./stories";

export default {
  meta: {
    hotkeys: false,
  },
};

export function ContextMenu() {
  const [gridData, setGridData] = useState(data);
  const [editCell, setEditCell] = useState<EditCell | undefined>(undefined);
  const [focusedCell, setFocusedCell] = useState<Cell | undefined>(undefined);
  const [selectedRanges, setSelectedRanges] = useState<IndexedArray<Range>>([]);
  const [contextMenu, setContextMenu] = useState<Point | undefined>(undefined);
  const [colorRanges, setColorRanges] = useState<
    { color: string; range: Range }[]
  >([]);
  const gridRef = useRef<GridRef | null>(null);
  const defs = colDefs
    .slice(0, 2)
    .concat(colDefs.slice(4, 7))
    .map((def) => ({
      ...def,
      editable: true,
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

  const leafColumns = getLeafColumns(defs);

  return (
    <div>
      <Grid
        columnDefs={defs}
        data={gridData}
        editCell={editCell}
        focusedCell={focusedCell}
        handleContextMenu={({ event, defaultHandler }) => {
          event.preventDefault();
          setContextMenu({
            x: event.pageX,
            y: event.pageY,
          });
          defaultHandler();
        }}
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
        id="my-grid"
        ref={gridRef}
        selectedRanges={selectedRanges}
        styles={{
          cell: (
            rowData: DataRow,
            columnDef: LeafColumn,
            rowIndex: number,
            columnIndex: number,
          ) => {
            let bgColor = "var(--cell-background-color)";

            for (let colorRange of colorRanges) {
              if (colorRange.range.contains(rowIndex, columnIndex)) {
                bgColor = colorRange.color;
                break;
              }
            }

            return {
              base: { backgroundColor: bgColor },
            };
          },
        }}
      />
      {contextMenu !== undefined && (
        <CtxMenu position={contextMenu} reset={setContextMenu}>
          <ul
            style={{
              listStyle: "none",
              marginBlock: "0.25rem",
              paddingInline: 0,
            }}
          >
            <li>
              <button
                onClick={() => {
                  setColorRanges((prev) =>
                    prev.concat([
                      { color: "#5cb800", range: selectedRanges[0] as Range },
                    ]),
                  );
                  setContextMenu(undefined);
                }}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: 0,
                  fontSize: "1rem",
                  width: "100%",
                }}
              >
                Green
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  gridRef.current?.copy(gridData, leafColumns, selectedRanges);
                  setContextMenu(undefined);
                }}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: 0,
                  fontSize: "1rem",
                  width: "100%",
                }}
              >
                Copy
              </button>
            </li>
          </ul>
        </CtxMenu>
      )}
    </div>
  );
}

interface CtxMenuProps {
  children: ReactNode;
  position: Point;
  reset: Dispatch<SetStateAction<Point | undefined>>;
}

function CtxMenu({ children, position, reset }: CtxMenuProps) {
  const ref = (node: HTMLDivElement) => {
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "Escape") {
        reset(undefined);
        e.stopPropagation();
      }
    }

    function handleClick(e: PointerEvent) {
      if (node.contains(e.target as Node)) {
        return;
      }
      reset(undefined);
      e.stopPropagation();
    }

    document.addEventListener("pointerdown", handleClick, true);
    document.addEventListener("keyup", handleKeyUp, true);
    return () => {
      document.removeEventListener("pointerdown", handleClick, true);
      document.removeEventListener("keyup", handleKeyUp, true);
    };
  };

  return (
    <div
      className="ladle-ctx-menu"
      ref={ref}
      style={{
        backgroundColor: "gainsboro",
        insetBlockStart: position.y,
        insetInlineStart: position.x,
        position: "absolute",
        width: "8rem",
      }}
    >
      {children}
    </div>
  );
}

export function ColumnSelection() {
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<Range[]>([]);

  function handleHeaderPointerDown({
    columnIndexEnd,
    columnIndexStart,
  }: {
    columnIndexEnd: number;
    columnIndexStart: number;
  }) {
    setFocusedCell({ columnIndex: columnIndexStart - 1, rowIndex: 0 });
    setSelectedRanges([
      range(0, columnIndexStart - 1, data.length - 1, columnIndexEnd - 2),
    ]);
  }
  return (
    <>
      <h1>Header click column selection</h1>
      <Grid
        columnDefs={groupedColumnDefs}
        data={data}
        focusedCell={focusedCell}
        handleHeaderPointerDown={handleHeaderPointerDown}
        selectedRanges={selectedRanges}
      />
    </>
  );
}
