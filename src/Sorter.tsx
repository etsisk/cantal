import type { PointerEvent } from "react";

export interface SortState {
  iterable?: boolean;
  // TODO: I don't love label being optional here but it's a quick
  // fix for getting an iterable "unsorting" to work
  label: string;
  symbol: string;
}

interface SorterProps {
  className?: string;
  handleSort: (e: PointerEvent<HTMLButtonElement>) => void;
  state: SortState;
}

export function Sorter({ className, handleSort, state }: SorterProps) {
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
