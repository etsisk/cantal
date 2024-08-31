import type { CSSProperties, PointerEvent } from "react";
import {
  type ColumnDefWithDefaults,
  getLeafColumns,
  type LeafColumn,
} from "./Grid";
import { HeaderCell } from "./HeaderCell";

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

interface HeaderProps {
  canvasWidth: string;
  columnDefs: ColumnDefWithDefaults[];
  sorts: { [key: string]: string };
  filters: { [key: string]: string };
  handleFilter: (field: string, value: string) => void;
  handleResize: (
    field: string,
    value: number,
    columnDefs: ColumnDefWithDefaults[],
  ) => void;
  handleSort: (
    nextSortMode: { [key: string]: string },
    e: PointerEvent<HTMLButtonElement>,
  ) => void;
  leafColumns: LeafColumn[];
  ref: { current: any };
  styles: CSSProperties;
}

export function Header({
  canvasWidth,
  columnDefs,
  filters,
  handleFilter,
  handleResize,
  handleSort,
  leafColumns,
  ref,
  sorts,
  styles,
}: HeaderProps) {
  const maxDepth = getColumnDepth(leafColumns);
  const positions = getColumnPositions(leafColumns, maxDepth);
  const pinnedStartColumns = leafColumns.filter(
    (def) => def.pinned === "start",
  );
  const unpinnedColumns = leafColumns.filter(
    (def) => def.pinned !== "start" && def.pinned !== "end",
  );
  const pinnedEndColumns = leafColumns.filter((def) => def.pinned === "end");

  function handleColumnResize(
    columnDef: LeafColumn | ColumnDefWithDefaults,
    columnWidth: number,
    delta: number,
  ): void {
    if (columnDef.subcolumns && columnDef.subcolumns.length > 0) {
      const childLeafColumns = getLeafColumns([columnDef]);
      const totalLeafColWidth = childLeafColumns
        .map((col) => col.width)
        .reduce((a, b) => a + b, 0);
      const newWidth = totalLeafColWidth + delta;
      const newDefs = childLeafColumns.map((def) => ({
        ...def,
        width: Math.max(
          def.minWidth,
          Math.round((def.width * newWidth) / totalLeafColWidth),
        ),
      }));
      const resizedColumnDefs = childLeafColumns.reduce((resized, def, i) => {
        if (resized.length === 0) {
          return replaceColumn(columnDefs, def, newDefs[i]);
        }
        return replaceColumn(resized, def, newDefs[i]);
      }, []);
      handleResize(columnDef.field, newWidth, resizedColumnDefs);
    } else if (columnDef) {
      const newWidth = columnWidth + delta;
      const width = Math.max(columnDef.minWidth, newWidth);
      const resizedColumnDefs = replaceColumn(columnDefs, columnDef, {
        ...columnDef,
        width,
      });
      handleResize(columnDef.field, width, resizedColumnDefs);
    }
  }

  function replaceColumn(
    columnDefs: ColumnDefWithDefaults[],
    existingLeafColumn: LeafColumn | ColumnDefWithDefaults,
    newLeafColumn: LeafColumn | ColumnDefWithDefaults,
  ): ColumnDefWithDefaults[] {
    const colDefs = [];
    const newDef = getColumnDefWithDefaults(newLeafColumn);

    for (let def of columnDefs) {
      if (def.field === existingLeafColumn.field) {
        colDefs.push(newDef);
      } else if (
        isLeafColumn(existingLeafColumn) && existingLeafColumn.ancestors
          .map((ancestor: ColumnDefWithDefaults) => ancestor.field)
          .includes(def.field)
      ) {
        colDefs.push({
          ...def,
          subcolumns: replaceColumn(
            def.subcolumns,
            existingLeafColumn,
            newLeafColumn,
          ),
        });
      } else {
        colDefs.push(def);
      }
    }
    return colDefs;
  }

  function getColumnDefWithDefaults(def: LeafColumn | ColumnDefWithDefaults): ColumnDefWithDefaults {
    if (isLeafColumn(def)) {
      const { ancestors, ...columnDefWithDefaults } = def;
      return columnDefWithDefaults;
    }
    return def;
  }

  function isLeafColumn(def: LeafColumn | ColumnDefWithDefaults): def is LeafColumn {
    return Object.hasOwn(def, 'ancestors');
  }

  const viewportStyles = {
    overflow: "hidden",
    width: "inherit",
  };

  const canvasStyles = {
    width: canvasWidth,
  };

  const pinnedStyles = {
    ...styles,
    backgroundColor: "var(--background-color)",
    display: "grid",
    gridTemplateColumns: "subgrid",
    insetInline: 0,
    position: "sticky",
  };

  const pinnedLeftStyles = {
    ...pinnedStyles,
    gridColumn: `1 / ${pinnedStartColumns.length + 1}`,
  };

  const unpinnedStyles = {
    ...styles,
    display: "grid",
    gridColumn: `${pinnedStartColumns.length + 1} / ${
      leafColumns.length - pinnedEndColumns.length + 1
    }`,
    gridTemplateColumns: "subgrid",
  };

  const pinnedRightStyles = {
    ...pinnedStyles,
    gridColumn: `${leafColumns.length - pinnedEndColumns.length + 1} / ${
      leafColumns.length + 1
    }`,
  };

  return (
    <div className="cantal-header-viewport" ref={ref} style={viewportStyles}>
      <div className="cantal-header-canvas" style={canvasStyles}>
        <div className="cantal-header" style={{ display: "grid", ...styles }}>
          {pinnedStartColumns.length > 0 || pinnedEndColumns.length > 0 ? (
            <>
              {pinnedStartColumns.length > 0 && (
                <div
                  className="cantal-header-pinned-left"
                  style={pinnedLeftStyles}
                >
                  {pinnedStartColumns.map((def: LeafColumn) =>
                    [...def.ancestors.concat(def)].map((def: LeafColumn) => (
                      <HeaderCell
                        columnDef={def}
                        filterer={def.filterer}
                        filters={filters}
                        handleFilter={handleFilter}
                        handleResize={handleColumnResize}
                        handleSort={handleSort}
                        key={def.field}
                        position={positions.get(def)}
                        sorts={sorts}
                      />
                    )),
                  )}
                </div>
              )}
              {unpinnedColumns.length > 0 && (
                <div className="cantal-header-unpinned" style={unpinnedStyles}>
                  {unpinnedColumns.map((def: LeafColumn) =>
                    [...def.ancestors.concat(def)].map((def: LeafColumn) => (
                      <HeaderCell
                        columnDef={def}
                        filterer={def.filterer}
                        filters={filters}
                        handleFilter={handleFilter}
                        handleResize={handleColumnResize}
                        handleSort={handleSort}
                        key={def.field}
                        position={positions.get(def)}
                        sorts={sorts}
                      />
                    )),
                  )}
                </div>
              )}
              {pinnedEndColumns.length > 0 && (
                <div
                  className="mestia-header-pinned-right"
                  style={pinnedRightStyles}
                >
                  {pinnedEndColumns.map((def: LeafColumn) =>
                    [...def.ancestors.concat(def)].map((def: LeafColumn) => (
                      <HeaderCell
                        columnDef={def}
                        filterer={def.filterer}
                        filters={filters}
                        handleFilter={handleFilter}
                        handleResize={handleColumnResize}
                        handleSort={handleSort}
                        key={def.field}
                        position={positions.get(def)}
                        sorts={sorts}
                      />
                    )),
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {leafColumns.map((def: LeafColumn) =>
                [...def.ancestors.concat(def)].map((def: LeafColumn) => (
                  <HeaderCell
                    columnDef={def}
                    filterer={def.filterer}
                    filters={filters}
                    handleFilter={handleFilter}
                    handleResize={handleColumnResize}
                    handleSort={handleSort}
                    key={def.field}
                    position={positions.get(def)}
                    sorts={sorts}
                  />
                )),
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// function getColumnDepth(
//   columnDefs: ColumnDefWithDefaults[],
//   depth: number = 1,
// ) {
//   let maxDepth = depth;
//   for (const def of columnDefs) {
//     if (def.subcolumns && def.subcolumns.length > 0) {
//       maxDepth = getColumnDepth(def.subcolumns, depth + 1);
//     }
//   }
//   return maxDepth;
// }

function getColumnDepth(leafColumns: LeafColumn[]): number {
  return leafColumns.reduce((depth, leafColumn) => {
    return Math.max(depth, leafColumn.ancestors.length + 1);
  }, 1);
}

function getColumnPositions(
  leafColumns: LeafColumn[],
  columnDepth: number,
): WeakMap<LeafColumn, Position> {
  const wm = new WeakMap();
  let columnIndex = 1;
  let pinnedIndex = 1;
  let pinned: 'start' | 'end' | undefined;
  for (let def of leafColumns) {
    if (columnIndex > 1 && pinned !== def.pinned) {
      pinnedIndex = 1;
    }

    for (let i = 0; i < def.ancestors.length; i++) {
      const ancestor = def.ancestors[i];
      const lineage = def.ancestors.slice(0, i);
      const meta = wm.get(ancestor);
      if (!meta) {
        wm.set(ancestor, {
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

    wm.set(def, {
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
  return wm;
}
