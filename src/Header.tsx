import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  SyntheticEvent,
} from "react";
import {
  type ColumnDefWithDefaults,
  getLeafColumns,
  type HandleHeaderPointerDownArgs,
  invokeDefaultHandler,
  type LeafColumn,
  type Position,
} from "./Grid";
import { HeaderCell } from "./HeaderCell";

interface HeaderProps {
  canvasWidth: string;
  columnDefs: ColumnDefWithDefaults[];
  filters: { [key: string]: string };
  handleFilter: (field: string, value: string) => void;
  handlePointerDown: (args: HandleHeaderPointerDownArgs) => void;
  handleResize: (
    field: string,
    value: number,
    columnDefs: ColumnDefWithDefaults[],
  ) => void;
  handleSort: (
    nextSortMode: { [key: string]: string } | undefined,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  leafColumns: LeafColumn[];
  positions: WeakMap<ColumnDefWithDefaults | LeafColumn, Position>;
  ref: { current: any };
  sorts: { [key: string]: string };
  styles: CSSProperties;
  visibleColumnEnd: number;
  visibleColumnStart: number;
}

export function Header({
  canvasWidth,
  columnDefs,
  filters,
  handleFilter,
  handleResize,
  handleSort,
  leafColumns,
  positions,
  ref,
  sorts,
  styles,
  visibleColumnEnd,
  visibleColumnStart,
  ...props
}: HeaderProps) {
  const pinnedStartLeafColumns = leafColumns.filter(
    (def) => def.pinned === "start",
  );
  const unpinnedLeafColumns = leafColumns.filter(
    (def) => def.pinned !== "start" && def.pinned !== "end",
  );
  const pinnedEndLeafColumns = leafColumns.filter(
    (def) => def.pinned === "end",
  );

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
      const resizedColumnDefs = childLeafColumns.reduce(
        (
          resized: ColumnDefWithDefaults[],
          def: LeafColumn | ColumnDefWithDefaults,
          i: number,
        ) => {
          if (newDefs[i] === undefined) {
            return resized;
          }
          if (resized.length === 0) {
            return replaceColumn(columnDefs, def, newDefs[i]);
          }
          return replaceColumn(resized, def, newDefs[i]);
        },
        [],
      );
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

  function handleEvent(
    event: ReactPointerEvent<HTMLDivElement>,
    eventName: string,
  ) {
    const { columnEnd, columnStart, field, rowEnd, rowStart } =
      getAttributeFromHeaderEvent(event, [
        "column-end",
        "column-start",
        "field",
        "row-end",
        "row-start",
      ]);
    if (field === undefined || field === null) {
      return;
    }
    const columnDef = findColumnDefByField(columnDefs, field);
    if (columnDef === undefined) {
      return;
    }
    const namedFunction = eventName.replace("on", "handle");
    const handler = isHandler(props, namedFunction)
      ? props[namedFunction]
      : invokeDefaultHandler;

    handler?.({
      columnDef,
      columnIndexEnd: Number(columnEnd),
      columnIndexStart: Number(columnStart),
      defaultHandler: () => {},
      e: event,
      rowIndexEnd: Number(rowEnd),
      rowIndexStart: Number(rowStart),
    });
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
        isLeafColumn(existingLeafColumn) &&
        existingLeafColumn.ancestors
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

  function getColumnDefWithDefaults(
    def: LeafColumn | ColumnDefWithDefaults,
  ): ColumnDefWithDefaults {
    if (isLeafColumn(def)) {
      const { ancestors, ...columnDefWithDefaults } = def;
      return columnDefWithDefaults;
    }
    return def;
  }

  function isLeafColumn(
    def: LeafColumn | ColumnDefWithDefaults,
  ): def is LeafColumn {
    return Object.hasOwn(def, "ancestors");
  }

  const viewportStyles: CSSProperties = {
    overflow: "hidden",
    width: "inherit",
  };

  const canvasStyles: CSSProperties = {
    width: canvasWidth,
  };

  const pinnedStyles: CSSProperties = {
    ...styles,
    backgroundColor: "var(--background-color)",
    display: "grid",
    gridTemplateColumns: "subgrid",
    insetInline: 0,
    position: "sticky",
  };

  const pinnedStartStyles: CSSProperties = {
    ...pinnedStyles,
    gridColumn: `1 / ${pinnedStartLeafColumns.length + 1}`,
  };

  const unpinnedStyles: CSSProperties = {
    ...styles,
    display: "grid",
    gridColumn: `${pinnedStartLeafColumns.length + 1} / ${
      leafColumns.length - pinnedEndLeafColumns.length + 1
    }`,
    gridTemplateColumns: "subgrid",
  };

  const pinnedEndStyles: CSSProperties = {
    ...pinnedStyles,
    gridColumn: `${leafColumns.length - pinnedEndLeafColumns.length + 1} / ${
      leafColumns.length + 1
    }`,
  };

  return (
    <div className="cantal-header-viewport" ref={ref} style={viewportStyles}>
      <div className="cantal-header-canvas" style={canvasStyles}>
        <div
          className="cantal-header"
          onPointerDown={(e) => handleEvent(e, "onPointerDown")}
          style={{ display: "grid", ...styles }}
        >
          {pinnedStartLeafColumns.length > 0 ||
          pinnedEndLeafColumns.length > 0 ? (
            <>
              {pinnedStartLeafColumns.length > 0 && (
                <div
                  className="cantal-header-pinned-start"
                  style={pinnedStartStyles}
                >
                  {getFlattenedColumns(pinnedStartLeafColumns).map(
                    (def: LeafColumn | ColumnDefWithDefaults) => (
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
              {unpinnedLeafColumns.length > 0 && (
                <div className="cantal-header-unpinned" style={unpinnedStyles}>
                  {getFlattenedColumns(
                    unpinnedLeafColumns.slice(
                      visibleColumnStart,
                      visibleColumnEnd + 1,
                    ),
                  ).map((def: LeafColumn | ColumnDefWithDefaults) => (
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
              {pinnedEndLeafColumns.length > 0 && (
                <div
                  className="cantal-header-pinned-end"
                  style={pinnedEndStyles}
                >
                  {getFlattenedColumns(pinnedEndLeafColumns).map(
                    (def: LeafColumn | ColumnDefWithDefaults) => (
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
              {getFlattenedColumns(
                leafColumns.slice(visibleColumnStart, visibleColumnEnd + 1),
              ).map((def: LeafColumn | ColumnDefWithDefaults) => (
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

function getFlattenedColumns(leafColumns: LeafColumn[]) {
  const columnsSeen: Record<string, boolean> = {};
  const flattenedColumns = [];
  for (let leafColumn of leafColumns) {
    for (let ancestor of leafColumn.ancestors) {
      if (columnsSeen[ancestor.field]) {
        continue;
      }
      columnsSeen[ancestor.field] = true;
      flattenedColumns.push(ancestor);
    }
    flattenedColumns.push(leafColumn);
  }
  return flattenedColumns;
}

function getAttributeFromHeaderEvent(
  event: SyntheticEvent | PointerEvent,
  attr: string[],
): { [key: (typeof attr)[number]]: string } {
  const target = event.target;
  if (target instanceof HTMLElement) {
    const headerCell = target?.closest('[role="columnheader"]');
    const attributesWithValues = attr.reduce(
      (acc: { [key: (typeof attr)[number]]: string }, attribute) => {
        const value = headerCell?.getAttribute(`data-${attribute}`);
        if (value !== undefined && value !== null) {
          acc[kebabToCamelCase(attribute)] = value;
        }
        return acc;
      },
      {},
    );
    return attributesWithValues;
  }
  return {};
}

function kebabToCamelCase(str: string): string {
  return str
    .split("-")
    .map((w: string, i: number) => {
      if (i === 0) {
        return w;
      }
      return w.at(0)?.toUpperCase() + w.slice(1);
    })
    .join("");
}

function findColumnDefByField(
  columnDefs: (ColumnDefWithDefaults | LeafColumn)[],
  field: string,
): ColumnDefWithDefaults | LeafColumn | undefined {
  for (let def of columnDefs) {
    if (def.field === field) {
      return def;
    }

    if (def.subcolumns && def.subcolumns.length > 0) {
      const result = findColumnDefByField(def.subcolumns, field);
      if (result) {
        return result;
      }
    }
  }
  return undefined;
}

function isHandler<X extends {}, Y extends PropertyKey>(
  obj: X,
  prop: Y,
): obj is X & Record<Y, HeaderProps["handlePointerDown"]> {
  return obj.hasOwnProperty(prop);
}
