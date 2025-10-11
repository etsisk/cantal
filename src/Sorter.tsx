import type { PointerEvent, ReactElement } from "react";

export interface SortState {
  iterable?: boolean;
  label: string;
  symbol: string;
}

interface SorterProps {
  className?: string;
  handleSort: (e: PointerEvent<HTMLButtonElement>) => void;
  state: SortState;
}

export function Sorter({
  className,
  handleSort,
  state,
}: SorterProps): ReactElement {
  function handlePointerUp(e: PointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    handleSort(e);
  }

  return (
    <button
      aria-label={`Sort: ${state.label}`}
      aria-live="assertive"
      className={className}
      onPointerUp={handlePointerUp}
    >
      {state.symbol}
    </button>
  );
}
