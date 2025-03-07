import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from "react";
import type { EditorProps } from "./InputEditor";

interface TextAreaEditorProps extends EditorProps {
  rows?: number;
  style?: CSSProperties;
}

export function TextAreaEditor({
  handleChange,
  selectInitialValue = true,
  rows = 3,
  style = {},
  value = "",
}: TextAreaEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      if (selectInitialValue) {
        ref.current.select();
      }
      ref.current.focus();
    }
  }, []);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && e.altKey) {
      handleChange(value + "\n");
      e.stopPropagation();
    }

    if (!["Enter", "Tab", "Escape"].includes(e.key)) {
      e.stopPropagation();
    }
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLTextAreaElement>) {
    // Stop propagation so pointer can resize text area
    e.stopPropagation();
  }

  const inputStyle: CSSProperties = {
    border: "2px solid var(--border-color)",
    borderRadius: "4px",
    fontSize: 14,
    outline: "none",
    padding: "2px 4px",
    width: "100%",
    ...style,
  };
  return (
    <textarea
      onChange={(e) => handleChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      ref={ref}
      rows={rows}
      style={inputStyle}
      value={value}
    />
  );
}
