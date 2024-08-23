import { useState } from 'react';
import {
  type ColumnDef,
  type DataRow,
  Grid,
} from './Grid';
import { colDefs, data, groupedColumnDefs } from './stories';

export const Simple = () => {
  const defs = colDefs
    .slice(0, 2)
    .concat(colDefs.slice(4, 7))
    .map((def) => ({
      ...def,
      width: 160,
    }));
  return <Grid columnDefs={defs} data={data.slice(0, 6)} />;
};

export const Sizing = () => {
  const [isBlock, setIsBlock] = useState<boolean>(false);
  const containerStyles = isBlock
    ? { display: 'block', height: '240px' }
    : { height: '200px', width: '500px' };
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
};

export const Styling = () => {
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
            borderColor: gapState === 1 ? 'transparent' : '#ccc',
          },
        }}
      />
    </div>
  );
};

export const CustomAriaLabels = () => {
  const defs = colDefs.map((def) => {
    return {
      ...def,
      ariaCellLabel: 'Value',
      ariaHeaderCellLabel: 'Thing',
    };
  });

  return <Grid columnDefs={defs} data={data} />;
};

export const Sorting = () => {
  const [sorts, setSorts] = useState({});
  const defs = colDefs.map((def) => ({
    ...def,
    sortable: true,
    sortStates: [
      { label: 'unsorted', symbol: '↑↓', iterable: false },
      { label: 'ascending', symbol: '↑' },
      { label: 'descending', symbol: '↓' },
    ],
    width: 180,
  }));

  function sortingFunction(
    data: DataRow[],
    columnSorts: { [key: string]: string },
  ) {
    return data.toSorted((a: DataRow, b: DataRow) => {
      for (let [field, value] of Object.entries(columnSorts)) {
        if (value === 'unsorted') {
          continue;
        }

        const rowA = a[field];
        const rowB = b[field];

        let result = rowA == rowB ? 0 : rowA > rowB ? 1 : -1;
        result *= value === 'ascending' ? 1 : -1;

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
};
