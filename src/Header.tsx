import type { CSSProperties, PointerEvent } from "react";
import { ColumnDef, type ColumnDefWithDefaults, getLeafColumns } from "./Grid";
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
  subcolumnIndex: number;
}

interface HeaderProps {
  canvasWidth: number;
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
  leafColumns: ColumnDefWithDefaults[];
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
  const positions = new WeakMap();
  const maxDepth = getColumnDepth(columnDefs);
  const flattenedColumns = getFlattenedColumns(columnDefs, positions, maxDepth);

  // TODO: Include Ancenstors and properly define their columnIndex, columnIndexEnd
  const pinnedLeftColumns = flattenedColumns
    .filter((def) => def.pinned === "start")
    .map((def, i: number) => ({
      def,
      position: { ...positions.get(def), columnIndex: i, columnIndexEnd: i },
    }));
  const unpinnedColumns = flattenedColumns.filter((def) => {
    if (def.subcolumns.length) {
      return getLeafColumns(def.subcolumns).some(
        (d) => d.pinned !== "start" && d.pinned !== "end",
      );
    }
    return def.pinned !== "start" && def.pinned !== "end";
  });
  const pinnedRightColumns = flattenedColumns
    .filter((def) => def.pinned === "end")
    .map((def: ColumnDefWithDefaults, i: number) => ({
      def,
      position: {
        ...positions.get(def),
        columnIndex: pinnedLeftColumns.length + unpinnedColumns.length + i,
        columnIndexEnd: pinnedLeftColumns.length + unpinnedColumns.length + i,
      },
    }));

  function handleColumnResize(
    columnDef: ColumnDefWithDefaults,
    columnWidth: number,
    delta: number,
  ) {
    if (columnDef.subcolumns && columnDef.subcolumns.length > 0) {
      const childLeafColumns = getLeafColumns(columnDef.subcolumns);
      const totalLeafColWidth = childLeafColumns
        .map((col) => col.width)
        .reduce((a, b) => a + b, 0);
      const newWidth = totalLeafColWidth + delta;
      const newDefs = childLeafColumns.map((def) => ({ ...def, width: Math.max(def.minWidth, Math.round((def.width * newWidth) / totalLeafColWidth))}));
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
    existingDef: ColumnDefWithDefaults,
    newDef: ColumnDefWithDefaults,
  ): ColumnDefWithDefaults[] {
    const colDefs = [];
    const meta = positions.get(existingDef);
    for (let def of columnDefs) {
      if (def.field === existingDef.field) {
        colDefs.push(newDef);
      } else if (
        meta.ancestors
          .map((ancestor: ColumnDefWithDefaults) => ancestor.field)
          .includes(def.field)
      ) {
        colDefs.push({
          ...def,
          subcolumns: replaceColumn(def.subcolumns, existingDef, newDef),
        });
      } else {
        colDefs.push(def);
      }
    }
    return colDefs;
  }

  const viewportStyles = {
    overflow: "hidden",
    width: "inherit",
  };

  const canvasStyles = {
    width: canvasWidth,
  };

  const pinnedStyles = {
    backgroundColor: "var(--background-color)",
    gridTemplateColumns: "subgrid",
  };

  const pinnedLeftStyles = {
    ...pinnedStyles,
    gridColumn: `1 / ${pinnedLeftColumns.length - 1}`,
  };

  const unpinnedStyles = {
    gridColumn: `${pinnedLeftColumns.length + 1} / ${
      leafColumns.length - pinnedRightColumns.length + 1
    }`,
  };

  const pinnedRightStyles = {
    ...pinnedStyles,
    gridColumn: `${leafColumns.length - pinnedRightColumns.length + 1} / ${
      leafColumns.length + 1
    }`,
  };

  return (
    <div className="cantal-header-viewport" ref={ref} style={viewportStyles}>
      <div className="cantal-header-canvas" style={canvasStyles}>
        <div className="cantal-header" style={{ display: "grid", ...styles }}>
          {pinnedLeftColumns.length > 0 || pinnedRightColumns.length > 0 ? (
            <>
              {pinnedLeftColumns.length > 0 && (
                <div
                  className="cantal-header-pinned-left"
                  style={pinnedLeftStyles}
                >
                  {pinnedLeftColumns.flatMap((def: ColumnDefWithDefaults) =>
                    positions
                      .get(def)
                      .ancestors.concat(def)
                      .map((def: ColumnDefWithDefaults) => (
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
              <div className="cantal-header-unpinned" style={unpinnedStyles}>
                {unpinnedColumns.map((def: ColumnDefWithDefaults) => (
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
                ))}
              </div>
              {pinnedRightColumns.length > 0 && (
                <div
                  className="mestia-header-pinned-right"
                  style={pinnedRightStyles}
                >
                  {pinnedRightColumns.map((def: ColumnDefWithDefaults) => (
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
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {unpinnedColumns.map((def: ColumnDefWithDefaults) => (
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
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getColumnDepth(
  columnDefs: ColumnDefWithDefaults[],
  depth: number = 1,
) {
  let maxDepth = depth;
  for (const def of columnDefs) {
    if (def.subcolumns && def.subcolumns.length > 0) {
      maxDepth = getColumnDepth(def.subcolumns, depth + 1);
    }
  }
  return maxDepth;
}

function getFlattenedColumns(
  defs: ColumnDefWithDefaults[],
  weakMap: WeakMap<ColumnDefWithDefaults, Position>,
  depth: number,
  level = 0,
  parentIndex = 0,
  ancestors: ColumnDefWithDefaults[] = [],
): ColumnDefWithDefaults[] {
  const flattenedColumns = [];
  let index = 0;
  let columnIndex = 0;
  for (const def of defs) {
    if (def.subcolumns && def.subcolumns.length > 0) {
      const flattenedSubcolumns = getFlattenedColumns(
        def.subcolumns,
        weakMap,
        depth,
        level + 1,
        parentIndex + columnIndex,
        ancestors.concat([def]),
      );

      const lastSubcolumn: ColumnDefWithDefaults =
        flattenedSubcolumns[flattenedSubcolumns.length - 1];

      flattenedColumns.push([def, flattenedSubcolumns].flat());
      weakMap.set(def, {
        ancestors,
        columnIndex: parentIndex + columnIndex,
        columnIndexEnd:
          weakMap.get(lastSubcolumn)?.columnIndex ?? parentIndex + columnIndex,
        depth: level + 1,
        field: def.field,
        level,
        subcolumnIndex: index,
      });
      columnIndex += getLeafColumns(def.subcolumns).length;
    } else {
      flattenedColumns.push([def]);
      weakMap.set(def, {
        ancestors,
        columnIndex: parentIndex + columnIndex,
        columnIndexEnd: parentIndex + columnIndex,
        depth,
        field: def.field,
        level,
        subcolumnIndex: index,
      });
      columnIndex++;
    }

    index++;
  }

  return flattenedColumns.flat();
}
