import type { CSSProperties, PointerEvent } from "react";
import { type ColumnDefWithDefaults, getLeafColumns, ColumnDef } from "./Grid";
import { HeaderCell } from "./HeaderCell";

export interface Position {
  ancestors: ColumnDefWithDefaults[];
  columnIndex: number;
  columnIndexEnd: number;
  field: string;
  level: number;
  subcolumnIndex: number;
}

interface HeaderProps {
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
  const flattenedColumns = getFlattenedColumns(columnDefs, positions);
  const columnDepth = Math.max(
    ...flattenedColumns.map((col) => positions.get(col).level),
  );

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

  // TODO: Code clean up
  function handleColumnResize(
    columnDef: ColumnDefWithDefaults,
    columnWidth: number,
    delta: number,
  ) {}

  const viewportStyles = {
    overflow: 'hidden',
    width: 'inherit',
  };

  const canvasStyles = {
    width: canvasWidth,
  };

  const pinnedStyles = {
    backgroundColor: 'var(--background-color)',
    gridTemplateColumns: 'subgrid',
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
  }

  return (
    <div className="cantal-header-viewport" ref={ref} style={viewportStyles}>
      <div className="cantal-header-canvas" style={canvasStyles}>
        <div className="cantal-header" style={{display: 'grid', ...styles}}>
          {pinnedLeftColumns.length > 0 || pinnedRightColumns.length > 0 ? (
            <>
              {pinnedLeftColumns.length > 0 && (
                <div
                  className="cantal-header-pinned-left"
                  style={pinnedLeftStyles}
                >
                  {pinnedLeftColumns.flatMap(
                    (def: ColumnDefWithDefaults) =>
                      positions.get(def).ancestors
                        .concat(def)
                        .map((def) => (
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
                {unpinnedColumns.map(
                  (def: ColumnDefWithDefaults) => (
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
                  ),
                )}
              </div>
              {pinnedRightColumns.length > 0 && (
                <div
                  className="mestia-header-pinned-right"
                  style={pinnedRightStyles}
                >
                  {pinnedRightColumns.map(
                    (def: ColumnDefWithDefaults) => (
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
                    ),
                  )}
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

function getFlattenedColumns(
  defs: ColumnDefWithDefaults[],
  weakMap: WeakMap<ColumnDefWithDefaults, Position>,
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
        level + 1,
        parentIndex + columnIndex,
        ancestors.concat([def]),
      );

      const lastSubcolumn: ColumnDefWithDefaults=
        flattenedSubcolumns[flattenedSubcolumns.length - 1];

      flattenedColumns.push([def, flattenedSubcolumns].flat());
      weakMap.set(def, {
        ancestors,
        columnIndex: parentIndex + columnIndex,
        columnIndexEnd: weakMap.get(lastSubcolumn)?.columnIndex ?? parentIndex + columnIndex,
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
