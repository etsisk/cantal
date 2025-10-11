import type { DataRow, LeafColumn } from "../Grid";
import type { IndexedArray, Range } from "../Body";

export function copy(
  data: DataRow[],
  leafColumns: LeafColumn[],
  selectedRanges: Range[],
): void {
  const str = getCopyMatrix(data, leafColumns, selectedRanges)
    .map((row) => row.join("\t"))
    .join("\n");
  navigator.clipboard.writeText(str);
}

function getCopyMatrix(
  data: DataRow[],
  leafColumns: LeafColumn[],
  selectedRanges: IndexedArray<Range>,
): unknown[][] {
  if (selectedRanges === null || selectedRanges.length === 0) {
    return [];
  }

  const mergedRange = getMergedRangeFromRanges(selectedRanges);
  const [numRows, numCols] = mergedRange.shape();
  const matrix = Array.from(Array(numRows + 1), () =>
    new Array(numCols + 1).fill("\\0"),
  );

  for (let row = mergedRange.fromRow; row <= mergedRange.toRow; row++) {
    const dataRow = data[row];
    const rowIndex = row - mergedRange.fromRow;

    if (!dataRow) {
      continue;
    }

    for (
      let column = mergedRange.fromColumn;
      column <= mergedRange.toColumn;
      column++
    ) {
      const columnIndex = column - mergedRange.fromColumn;

      // Don't write to matrix if cell is not selected
      if (selectedRanges.every((range) => !range.contains(row, column))) {
        continue;
      }

      const columnDef = leafColumns[column];

      if (!columnDef || !matrix[rowIndex]) {
        continue;
      }

      // TODO: Verify valueGetter design
      // if (columnDef?.valueGetter) {
      // matrix[rowIndex][columnIndex] = columnDef.valueGetter({
      // colDef: columnDef,
      // data: dataRow,
      // value: dataRow[columnDef.field],
      // });
      // continue;
      // }

      if (columnDef?.valueRenderer) {
        const renderedValue = columnDef.valueRenderer({
          columnDef,
          data: dataRow,
          value: dataRow[columnDef.field],
        });

        if (typeof renderedValue !== "object") {
          matrix[rowIndex][columnIndex] = renderedValue;
          continue;
        }
      }

      matrix[rowIndex][columnIndex] = dataRow[columnDef.field] ?? "";
    }
  }

  return matrix;
}

function getMergedRangeFromRanges(ranges: IndexedArray<Range>): Range {
  return ranges
    .slice(1)
    .reduce(
      (merged: Range, range: Range) => merged.merge(range),
      ranges[0] as Range,
    );
}
