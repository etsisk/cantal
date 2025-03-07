import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useState,
} from "react";
import { Grid, type DataRow, type LeafColumn, type Point } from "./Grid";
import {
  type Cell,
  type EditCell,
  type IndexedArray,
  range,
  type Range,
} from "./Body";
import { colDefs, data } from "./stories";

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

  return (
    <div style={{ position: "relative" }}>
      <Grid
        columnDefs={defs}
        data={gridData}
        editCell={editCell}
        focusedCell={focusedCell}
        handleContextMenu={({ event, defaultHandler }) => {
          event.preventDefault();
          setContextMenu({
            x: event.clientX - 50,
            y: event.clientY - 50,
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
        selectedRanges={selectedRanges}
        styles={{
          cell: (
            rowData: DataRow,
            columnDef: LeafColumn,
            rowIndex: number,
            columnIndex: number,
          ) => {
            let bgColor = "#fff";

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
              marginBlock: "0.5rem",
              paddingInline: "1rem",
            }}
          >
            <li>
              <button
                onClick={() => {
                  setColorRanges((prev) =>
                    prev.concat([
                      { color: "#80ff00", range: selectedRanges[0] as Range },
                    ]),
                  );
                }}
              >
                Green
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
      ref={ref}
      style={{
        backgroundColor: "burlywood",
        insetBlockStart: position.y,
        insetInlineStart: position.x,
        position: "absolute",
      }}
    >
      {children}
    </div>
  );
}
