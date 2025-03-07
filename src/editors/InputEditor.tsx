import {
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useRef,
} from "react";
import type { DataRow, LeafColumn } from "../Grid";

type InputType = "color" | "date" | "email" | "number" | "tel" | "text";
export interface EditorProps {
  columnDef: LeafColumn;
  columnIndex: number;
  data: DataRow;
  handleChange: (value: string) => void;
  rowIndex: number;
  selectInitialValue?: boolean;
  value?: string | number;
}

interface InputEditorProps extends EditorProps {
  style?: CSSProperties;
  type?: InputType;
}

export function InputEditor({
  handleChange,
  selectInitialValue = true,
  style = {},
  type = "text",
  value = "",
}: InputEditorProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      if (selectInitialValue) {
        ref.current.select();
      }
      ref.current.focus();
    }
  }, []);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!["Enter", "Tab", "Escape"].includes(e.key)) {
      e.stopPropagation();
    }
  }
  const inputStyle: CSSProperties = {
    border: 0,
    borderRadius: 0,
    boxSizing: "border-box",
    fontSize: 14,
    height: "100%",
    outline: "none",
    padding: "0px 4px",
    width: "100%",
    ...style,
  };
  return (
    <input
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        handleChange(e.target.value)
      }
      onKeyDown={handleKeyDown}
      ref={ref}
      style={inputStyle}
      type={type}
      value={value}
    />
  );
}
