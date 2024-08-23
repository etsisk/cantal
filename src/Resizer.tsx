import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from 'react';

interface ResizerProps {
  className?: string;
  handleResize: (xOffset: number) => void;
  handleResizeEnd: () => void;
  handleResizeStart: () => void;
  style?: CSSProperties;
}

export function Resizer({
  className,
  handleResize,
  handleResizeEnd,
  handleResizeStart,
  style = {},
}: ResizerProps) {
  const [dragStarted, setDragStarted] = useState<boolean>(false);
  const [dragStartPosition, setDragStartPosition] = useState<number | null>(
    null,
  );

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragStarted(true);
    setDragStartPosition(e.clientX);
    handleResizeStart();
  }

  function handlePointerMove(e: PointerEvent) {
    if (dragStarted) {
      e.preventDefault();
      if (dragStartPosition !== null) {
        const delta = e.clientX - dragStartPosition;
        if (delta > 0 || delta < 0) {
          handleResize(delta);
        }
      }
    }
  }

  function handlePointerUp() {
    if (dragStarted) {
      setDragStarted(false);
      setDragStartPosition(null);
      handleResizeEnd();
    }
  }

  useEffect(() => {
    if (dragStarted) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    }

    return function cleanup() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragStarted]);

  return (
    <div
      {...(className ? { className } : {})}
      onPointerDown={handlePointerDown}
      style={style}
    ></div>
  );
}

