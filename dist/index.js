import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

//#region src/Cell.tsx
function Cell({ allowEditCellOverflow, ariaLabel, children, classNames, columnDef, columnIndex, columnIndexRelative, endColumnIndex, endRowIndex, isEditing, isFocused, position, rowIndex, selected = false, startColumnIndex, startRowIndex, styles, virtualRowIndex }) {
	if (position === void 0) {
		console.warn("Column definition not found.");
		return null;
	}
	const columnSpan = endColumnIndex - startColumnIndex - (columnIndex - startColumnIndex);
	const rowSpan = endRowIndex - startRowIndex + 1 - (rowIndex - startRowIndex);
	const userClasses = `${classNames?.base ?? ""}${selected ? ` ${classNames?.selected}` : ""}${isFocused ? ` ${classNames?.focused}` : ""}${isEditing ? ` ${classNames?.edited}` : ""}`;
	const userStyles = typeof styles === "function" ? styles(children) : styles;
	return /* @__PURE__ */ jsx("div", {
		"aria-label": ariaLabel,
		className: `cantal-cell-base${isFocused ? " cantal-cell-focused" : ""}${columnDef.pinned ? ` cantal-cell-pinned-${columnDef.pinned}` : ""}${selected ? " cantal-cell-selected" : ""}${isEditing ? " cantal-cell-editing" : ""}${userClasses.length ? ` ${userClasses}` : ""}`,
		"data-col-idx": columnIndex,
		"data-field": columnDef.field,
		"data-row-idx": startRowIndex,
		"data-row-end-idx": endRowIndex,
		role: "gridcell",
		style: {
			...userStyles.base,
			...selected ? userStyles.selected : {},
			...isFocused ? userStyles.focused : {},
			...isEditing ? userStyles.edited : {},
			gridColumnStart: position.pinnedIndex,
			gridColumnEnd: position.pinnedIndexEnd + columnSpan,
			gridRowStart: virtualRowIndex + 1,
			gridRowEnd: virtualRowIndex + 1 + rowSpan,
			...allowEditCellOverflow && isEditing ? {
				overflow: "visible",
				zIndex: 0
			} : {}
		},
		children
	});
}

//#endregion
//#region src/utils/clipboard.ts
function copy(data, leafColumns, selectedRanges) {
	const str = getCopyMatrix(data, leafColumns, selectedRanges).map((row) => row.join("	")).join("\n");
	navigator.clipboard.writeText(str);
}
function getCopyMatrix(data, leafColumns, selectedRanges) {
	if (selectedRanges === null || selectedRanges.length === 0) return [];
	const mergedRange = getMergedRangeFromRanges(selectedRanges);
	const [numRows, numCols] = mergedRange.shape();
	const matrix = Array.from(Array(numRows + 1), () => new Array(numCols + 1).fill("\\0"));
	for (let row = mergedRange.fromRow; row <= mergedRange.toRow; row++) {
		const dataRow = data[row];
		const rowIndex = row - mergedRange.fromRow;
		if (!dataRow) continue;
		for (let column = mergedRange.fromColumn; column <= mergedRange.toColumn; column++) {
			const columnIndex = column - mergedRange.fromColumn;
			if (selectedRanges.every((range$1) => !range$1.contains(row, column))) continue;
			const columnDef = leafColumns[column];
			if (!columnDef || !matrix[rowIndex]) continue;
			if (columnDef?.valueRenderer) {
				const renderedValue = columnDef.valueRenderer({
					columnDef,
					data: dataRow,
					value: dataRow[columnDef.field]
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
function getMergedRangeFromRanges(ranges) {
	return ranges.slice(1).reduce((merged, range$1) => merged.merge(range$1), ranges[0]);
}

//#endregion
//#region src/Body.tsx
function Body({ canvasWidth, columnGap, columnSpans, containerHeight, data, editCell, focusedCell = null, handleContextMenu, handleDoublePointerDown, handleEdit, handleEditCellChange, handleFocusedCellChange, handleKeyDown, handlePointerDown, handleScroll, handleSelection, headerViewportRef, leafColumns, overscanColumns, overscanRows, positions, rowGap, rowHeight = 27, rowId, selectedRanges, selectionFollowsFocus = false, setState, showSelectionBox, styles, virtual, visibleColumnEnd, visibleColumnStart }) {
	const viewportRef = useRef(null);
	const canvasRef = useRef(null);
	const focusedCellRef = useRef(null);
	const [visibleRows, setVisibleRows] = useState(() => {
		if (virtual === true || virtual === "rows") return spread(0, Math.floor(window.innerHeight / rowHeight));
		return spread(0, data.length);
	});
	const [startDragCell, setStartDragCell] = useState(void 0);
	const [startDragPoint, setStartDragPoint] = useState(void 0);
	const [endDragPoint, setEndDragPoint] = useState(void 0);
	useEffect(() => {
		if (viewportRef.current && headerViewportRef.current) viewportRef.current.style.height = `${containerHeight - headerViewportRef.current.offsetHeight}px`;
	}, [containerHeight]);
	useEffect(() => {
		if (!editCell && focusedCell && focusedCellRef.current) focusedCellRef.current.focus();
	}, [editCell, focusedCell]);
	useEffect(() => {
		if (!focusedCell || !viewportRef.current) return;
		const columnDef = leafColumns[focusedCell?.columnIndex];
		if (columnDef === void 0) return;
		const viewportRect = getViewportBoundingBox(viewportRef.current, leafColumns, columnGap);
		const cellInlineStart = leafColumns.reduce((offset, def, i) => {
			if (i < focusedCell.columnIndex) return offset + def.width + rowGap;
			return offset;
		}, 0);
		const cellInlineEnd = cellInlineStart + columnDef.width;
		const cellBlockStart = rowHeight * focusedCell.rowIndex + focusedCell.rowIndex * rowGap;
		const cellBlockEnd = cellBlockStart + rowHeight;
		if (cellInlineStart < viewportRect.left) viewportRef.current.scrollLeft = cellInlineStart - viewportRect.leftOffset;
		else if (cellInlineEnd > viewportRect.right - viewportRect.rightOffset) viewportRef.current.scrollLeft = cellInlineEnd - viewportRect.width + viewportRect.rightOffset;
		if (cellBlockStart < viewportRect.top) viewportRef.current.scrollTop = cellBlockStart;
		else if (cellBlockEnd > viewportRect.bottom) viewportRef.current.scrollTop = cellBlockEnd - viewportRect.height;
	}, [
		columnGap,
		focusedCell,
		leafColumns.map((lc) => lc.field).join("-")
	]);
	useEffect(() => {
		function pointerMove(e) {
			const cell = getCellFromEvent(e);
			const point = canvasRef.current ? getPointFromEvent(e, canvasRef.current) : void 0;
			if (!cell || !startDragCell) return;
			handleSelection?.([range(startDragCell.rowIndex, startDragCell.columnIndex, cell.rowIndex, cell.columnIndex)], point, e);
			if (showSelectionBox && point !== void 0) setEndDragPoint(point);
		}
		function pointerUp(e) {
			handleSelection?.(selectedRanges, void 0, e);
			setStartDragCell(void 0);
			setStartDragPoint(void 0);
			setEndDragPoint(void 0);
		}
		if (startDragCell) {
			window.addEventListener("pointermove", pointerMove);
			window.addEventListener("pointerup", pointerUp);
		}
		return function cleanup() {
			window.removeEventListener("pointermove", pointerMove);
			window.removeEventListener("pointerup", pointerUp);
		};
	}, [
		selectedRanges,
		showSelectionBox,
		startDragCell
	]);
	function getViewportBoundingBox(viewport, leafColumns$1, columnGap$1) {
		const { offsetHeight, offsetWidth, scrollLeft, scrollTop } = viewport;
		const pinnedStartColumns = leafColumns$1.filter((def) => def.pinned === "start");
		const pinnedEndColumns = leafColumns$1.filter((def) => def.pinned === "end");
		const startBoundaryOffset = getPinnedColumnsOffset(pinnedStartColumns, columnGap$1);
		const endBoundaryOffset = getPinnedColumnsOffset(pinnedEndColumns, columnGap$1);
		const startBoundary = pinnedStartColumns.length ? startBoundaryOffset + scrollLeft : scrollLeft;
		const endBoundary = pinnedEndColumns.length ? scrollLeft + offsetWidth - endBoundaryOffset : scrollLeft + offsetWidth;
		const bRect = viewport.getBoundingClientRect();
		return {
			bottom: scrollTop + offsetHeight,
			height: offsetHeight,
			left: startBoundary,
			leftOffset: startBoundaryOffset,
			right: endBoundary,
			rightOffset: endBoundaryOffset,
			top: scrollTop,
			width: bRect.width
		};
	}
	const pinnedStartLeafColumns = leafColumns.filter((lc) => lc.pinned === "start");
	const pinnedEndLeafColumns = leafColumns.filter((lc) => lc.pinned === "end");
	const unpinnedLeafColumns = leafColumns.filter((lc) => lc.pinned !== "start" && lc.pinned !== "end");
	function getVisibleColumnsRange() {
		if (viewportRef.current && (virtual === true || virtual === "columns")) {
			const { offsetWidth, scrollLeft } = viewportRef.current;
			const startBoundary = scrollLeft + pinnedStartLeafColumns.reduce((sum, lc) => sum + lc.width, 0) + Math.max(pinnedStartLeafColumns.length - 1, 0) * columnGap;
			const endBoundary = Math.max(scrollLeft, scrollLeft + offsetWidth - (pinnedEndLeafColumns.reduce((sum, lc) => sum + lc.width, 0) + Math.max(pinnedEndLeafColumns.length - 1, 0) * columnGap));
			const columnEndBoundaries = getColumnEndBoundaries(endBoundary);
			const startIndex = columnEndBoundaries.findIndex((b) => b > startBoundary);
			const firstVisibleColumn = Math.max((startIndex === -1 ? 0 : startIndex) - overscanColumns, 0);
			const endIndex = columnEndBoundaries.findIndex((b) => b > endBoundary);
			return [firstVisibleColumn, Math.min((endIndex === -1 ? leafColumns.length - 1 : endIndex) + overscanColumns, leafColumns.length - 1) + 1];
		}
		return [0, leafColumns.length];
	}
	function getColumnEndBoundaries(endBoundary) {
		const endBoundaries = [];
		let startBoundary = 0;
		for (let column of leafColumns) {
			if (startBoundary > endBoundary) break;
			endBoundaries.push(startBoundary + column.width + columnGap);
			startBoundary += column.width + columnGap;
		}
		return endBoundaries;
	}
	function getVisibleRowsRange() {
		if (viewportRef.current && (virtual === true || virtual === "rows")) {
			const { scrollTop, offsetHeight } = viewportRef.current;
			const rowHeightWithGap = rowHeight + rowGap;
			return spread(Math.max(Math.floor((scrollTop + rowGap) / rowHeightWithGap) - overscanRows, 0), Math.min(Math.floor((scrollTop + offsetHeight) / rowHeightWithGap) + overscanRows, data.length - 1) + 1);
		}
		return spread(0, data.length);
	}
	function handleCopy() {
		copy(data, leafColumns, selectedRanges);
	}
	function handleEvent(e, eventLabel) {}
	function handlePaste() {
		navigator.clipboard.readText().then((clipboardText) => {
			handleEdit(getEditRowsFromPasteMatrix(createPasteMatrix(clipboardText), data, leafColumns, selectedRanges, focusedCell, columnSpans), leafColumns);
		});
	}
	function onKeyDown(e) {
		if (!focusedCell) return;
		const columnDef = leafColumns[focusedCell.columnIndex];
		if (!columnDef) return;
		handleKeyDown({
			e,
			cell: focusedCell,
			columnDef,
			defaultHandler: () => defaultHandleKeyDown(e)
		});
		e.stopPropagation();
	}
	function defaultHandleKeyDown(e) {
		if ([
			"ArrowUp",
			"ArrowDown",
			"ArrowLeft",
			"ArrowRight"
		].includes(e.key)) {
			e.preventDefault();
			const dir = e.key.replace("Arrow", "").toLowerCase();
			if (e.shiftKey && focusedCell && selectedRanges && selectedRanges.length > 0 && handleSelection) handleSelection([getExpandedSelectionRangeOnKey(e.key, focusedCell, selectedRanges[0], data, leafColumns)], void 0, e);
			else navigateCell(e, dir);
		} else if (e.key === "Tab") {
			if (editCell) commitCellEdit();
			e.preventDefault();
			navigateCell(e, e.shiftKey ? "left" : "right", true);
		} else if (e.key === "Escape") {
			if (editCell) cancelCellEdit();
			e.preventDefault();
		} else if (e.key === "Enter") {
			commitCellEdit();
			e.preventDefault();
			navigateCell(e, e.shiftKey ? "up" : "down");
		} else if (e.key === "c" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleCopy();
		} else if (e.key === "v" && (e.metaKey || e.ctrlKey)) handlePaste();
		else if (isKeyDownPrintable(e)) startCellEdit(focusedCell, "");
		else if (e.key === "Backspace" || e.key === "Delete") startCellEdit(focusedCell, "");
		else if (e.key === "F2" || e.key === "u" && e.ctrlKey) startCellEdit(focusedCell, void 0, false);
	}
	function startCellEdit(cell, value, selectInitialValue) {
		if (!cell) return;
		const row = data[cell.rowIndex];
		const leafColumn$1 = leafColumns[cell.columnIndex];
		if (!row || !leafColumn$1) return;
		const columnDef = columnSpans ? applyColumnSpanDefDefaults(getColumnSpan(row[columnSpans], cell.columnIndex), leafColumn$1) : leafColumn$1;
		const topLeftMostCell = {
			columnIndex: getColumnIndex(cell.columnIndex, row, columnSpans),
			rowIndex: getRowIndex(cell.rowIndex, cell.columnIndex, data, columnDef, columnSpans)
		};
		if (!isCellEditable(topLeftMostCell, row, columnDef) || isSameCell({
			columnIndex: topLeftMostCell.columnIndex,
			rowIndex: topLeftMostCell.rowIndex
		}, editCell)) return;
		handleEditCellChange({
			...topLeftMostCell,
			selectInitialValue: selectInitialValue ?? value === void 0,
			value: value ?? data[topLeftMostCell.rowIndex][columnDef.field]
		});
	}
	function commitCellEdit(value) {
		if (!editCell) return;
		const row = data[editCell.rowIndex];
		const leafColumn$1 = leafColumns[editCell.columnIndex];
		if (!leafColumn$1 || !row) return;
		const columnDef = columnSpans ? applyColumnSpanDefDefaults(getColumnSpan(row[columnSpans], editCell.columnIndex), leafColumn$1) : leafColumn$1;
		handleEditCellChange(void 0);
		handleEdit({ [rowId ? row[rowId] : editCell.rowIndex]: { [columnDef.field]: value !== void 0 ? columnDef.valueParser(value) : columnDef.valueParser(editCell.value) } }, leafColumns);
	}
	function cancelCellEdit() {
		if (editCell) handleEditCellChange(void 0);
	}
	function navigateCell(e, dir, wrap = false) {
		if (!focusedCell) return false;
		const columnDef = leafColumns[focusedCell.columnIndex];
		if (!columnDef) return false;
		if (dir === "up") {
			const rowIndex = getRowIndex(focusedCell.rowIndex - 1, focusedCell.columnIndex, data, columnDef, columnSpans);
			if (focusedCell.rowIndex === 0) return false;
			const newFocusedCell = {
				...focusedCell,
				rowIndex
			};
			handleFocusedCellChange(newFocusedCell, e);
			setSelectionRangeToFocusedCell(newFocusedCell, e);
		} else if (dir === "down") {
			const rowIndex = getLastRowIndex(focusedCell.rowIndex, focusedCell.columnIndex, data, columnDef, columnSpans);
			if (rowIndex >= data.length - 1) return false;
			const newFocusedCell = {
				...focusedCell,
				rowIndex: rowIndex + 1
			};
			handleFocusedCellChange(newFocusedCell, e);
			setSelectionRangeToFocusedCell(newFocusedCell, e);
		} else if (dir === "left") {
			const columnIndex = getColumnIndex(focusedCell.columnIndex - 1, data[focusedCell.rowIndex], columnSpans);
			if (focusedCell.columnIndex === 0) if (wrap) {
				if (focusedCell.rowIndex === 0) return false;
				const newFocusedCell$1 = {
					...focusedCell,
					columnIndex: getColumnIndex(leafColumns.length - 1, data[focusedCell.rowIndex - 1], columnSpans),
					rowIndex: getRowIndex(focusedCell.rowIndex - 1, columnIndex, data, columnDef, columnSpans)
				};
				handleFocusedCellChange(newFocusedCell$1, e);
				setSelectionRangeToFocusedCell(newFocusedCell$1, e);
				return true;
			} else return false;
			const newFocusedCell = {
				...focusedCell,
				columnIndex
			};
			handleFocusedCellChange(newFocusedCell, e);
			setSelectionRangeToFocusedCell(newFocusedCell, e);
		} else if (dir === "right") {
			const columnIndex = getColumnIndex(focusedCell.columnIndex, data[focusedCell.rowIndex], columnSpans, "end");
			if (columnIndex + 1 > leafColumns.length - 1) if (wrap) {
				if (focusedCell.rowIndex >= data.length - 1) return false;
				const newFocusedCell$1 = {
					columnIndex: 0,
					rowIndex: focusedCell.rowIndex + 1
				};
				handleFocusedCellChange(newFocusedCell$1, e);
				setSelectionRangeToFocusedCell(newFocusedCell$1, e);
				return true;
			} else return false;
			if (columnIndex + 1 > leafColumns.length - 1) return false;
			const newFocusedCell = {
				...focusedCell,
				columnIndex: columnIndex + 1
			};
			handleFocusedCellChange(newFocusedCell, e);
			setSelectionRangeToFocusedCell(newFocusedCell, e);
		}
		return true;
	}
	function setSelectionRangeToFocusedCell(focusedCell$1, e) {
		if (selectionFollowsFocus && handleSelection) {
			const point = getPointFromEvent(e, canvasRef.current);
			handleSelection(getSelectionRangeWithSpans(range(focusedCell$1.rowIndex, focusedCell$1.columnIndex)), point, e);
		}
	}
	function getSelectionRangeWithSpans(selectedRange) {
		const columnDef = leafColumns[selectedRange.fromColumn];
		if (!columnDef) return [selectedRange];
		const startColumn = getColumnIndex(selectedRange.fromColumn, data[selectedRange.fromRow], columnSpans);
		const endColumn = getColumnIndex(selectedRange.toColumn, data[selectedRange.fromRow], columnSpans, "end");
		return [range(getRowIndex(selectedRange.fromRow, selectedRange.fromColumn, data, columnDef, columnSpans), startColumn, getLastRowIndex(selectedRange.toRow, selectedRange.fromColumn, data, columnDef, columnSpans), endColumn)];
	}
	function onPointerDown(e) {
		e.persist?.();
		e.preventDefault?.();
		const cell = getCellFromEvent(e);
		const eventIsPointerEvent = isPointerEvent(e);
		const point = eventIsPointerEvent ? getPointFromEvent(e, canvasRef.current) : void 0;
		if (!cell || !point && eventIsPointerEvent) return;
		const columnDef = leafColumns[cell.columnIndex];
		if (!columnDef) return;
		if (e.detail === 2 || e.type === "dblclick") handleDoublePointerDown({
			e,
			cell,
			point,
			columnDef,
			defaultHandler: () => startCellEdit(cell)
		});
		else if (eventIsPointerEvent && point) handlePointerDown({
			e,
			cell,
			point,
			columnDef,
			defaultHandler: () => defaultHandlePointerDown(e, cell, point)
		});
	}
	function defaultHandlePointerDown(e, cell, point) {
		if (isSameCell(cell, editCell)) return;
		if (editCell) commitCellEdit();
		if (e.shiftKey && focusedCell && selectedRanges && selectedRanges.length > 0 && handleSelection) {
			handleSelection(getSelectionRangeWithSpans(range(focusedCell.rowIndex, focusedCell.columnIndex).merge(range(cell.rowIndex, cell.columnIndex))), point, e);
			return;
		}
		if (e.button === 0 && !e.ctrlKey && point) {
			handleFocusedCellChange(cell, e, point);
			if (handleSelection && point) {
				setStartDragCell(cell);
				setStartDragPoint(point);
				setSelectionRangeToFocusedCell(cell, e);
			}
		}
	}
	function onScroll(e) {
		if (headerViewportRef.current) headerViewportRef.current.scrollLeft = e.currentTarget.scrollLeft;
		if (viewportRef.current && (virtual === true || virtual === "rows")) setVisibleRows(getVisibleRowsRange());
		if (viewportRef.current && (virtual === true || virtual === "columns")) {
			const [start, end] = getVisibleColumnsRange();
			setState.setVisibleStartColumn(start);
			setState.setVisibleEndColumn(end);
		}
		if (viewportRef.current) handleScroll({
			event: e,
			viewportElement: viewportRef.current
		});
	}
	const visibleColumns = spread(visibleColumnStart, visibleColumnEnd);
	const viewportStyles = {
		overflow: "auto",
		width: "inherit"
	};
	const canvasStyles = {
		height: virtual === "rows" || virtual === true ? (rowHeight + rowGap) * data.length - rowGap : "auto",
		width: canvasWidth
	};
	const pinnedStyles = {
		...styles.computed,
		backgroundColor: "var(--background-color)",
		display: "grid",
		gridAutoRows: rowHeight,
		gridTemplateColumns: "subgrid",
		height: "max-content",
		insetInline: 0,
		position: "sticky"
	};
	const pinnedStartStyles = {
		...pinnedStyles,
		gridColumn: `1 / ${pinnedStartLeafColumns.length + 1}`
	};
	const unpinnedStyles = {
		...styles.computed,
		display: "grid",
		gridAutoRows: rowHeight,
		gridColumn: `${pinnedStartLeafColumns.length + 1} / ${leafColumns.length - pinnedEndLeafColumns.length + 1}`,
		gridTemplateColumns: "subgrid"
	};
	const pinnedEndStyles = {
		...pinnedStyles,
		gridColumn: `${leafColumns.length - pinnedEndLeafColumns.length + 1} / ${leafColumns.length + 1}`
	};
	const leafColumn = focusedCell ? leafColumns[focusedCell.columnIndex] : void 0;
	const colSpans = columnSpans ? getColumnSpans(columnSpans, data, visibleColumns, visibleRows) : void 0;
	leafColumns.slice(visibleColumnStart, visibleColumnEnd + 1).some((lc) => lc.rowSpanning) && getRowSpans(leafColumns, data, visibleColumns, visibleRows, colSpans);
	return /* @__PURE__ */ jsxs("div", {
		className: "cantal-body-viewport",
		onScroll,
		ref: viewportRef,
		style: viewportStyles,
		children: [/* @__PURE__ */ jsxs("div", {
			className: "cantal-body-canvas",
			onContextMenu: (e) => {
				const cell = getCellFromEvent(e);
				if (!cell || handleContextMenu === void 0) return;
				const columnDef = leafColumns[cell.columnIndex];
				if (!columnDef) return;
				handleContextMenu({
					cell,
					columnDef,
					event: e,
					defaultHandler: () => {
						if (!rangesContainCell(selectedRanges, cell)) {
							handleFocusedCellChange(cell, e);
							setSelectionRangeToFocusedCell(cell, e);
						}
					}
				});
			},
			onDoubleClick: (e) => onPointerDown({
				...e,
				detail: 2
			}),
			onKeyDown,
			onPointerDown,
			onPointerUp: (e) => handleEvent(e, "onPointerUp"),
			ref: canvasRef,
			style: canvasStyles,
			children: [
				focusedCell && leafColumn && /* @__PURE__ */ jsx("div", {
					"aria-label": leafColumn.ariaCellLabel instanceof Function ? leafColumn.ariaCellLabel({
						def: leafColumn,
						columnIndex: focusedCell.columnIndex,
						data: data[focusedCell.rowIndex],
						rowIndex: focusedCell.rowIndex,
						value: data[focusedCell.rowIndex] ? data[focusedCell.rowIndex][leafColumn.field] : null
					}) : leafColumn.ariaCellLabel,
					"aria-live": "polite",
					className: "cantal-focused-cell",
					ref: focusedCellRef,
					role: "gridcell",
					style: {
						position: "fixed",
						top: 0,
						left: 0,
						width: 0,
						height: 0,
						overflow: "hidden"
					},
					tabIndex: -1,
					children: data[focusedCell.rowIndex] ? leafColumn.valueRenderer({
						columnDef: leafColumn,
						data: data[focusedCell.rowIndex],
						value: data[focusedCell.rowIndex][leafColumn.field]
					}) : null
				}),
				data.length > 0 && /* @__PURE__ */ jsx("div", {
					className: "cantal-focus-sink",
					style: {
						position: "fixed",
						top: 0,
						left: 0,
						width: 0,
						height: 0,
						overflow: "hidden"
					},
					tabIndex: 0
				}),
				/* @__PURE__ */ jsx("div", {
					className: "cantal-body",
					style: {
						display: "grid",
						gridAutoRows: rowHeight,
						insetBlockStart: visibleRows[0] ? visibleRows[0] * (rowHeight + rowGap) : 0,
						...pinnedStartLeafColumns.concat(pinnedEndLeafColumns).length > 0 ? { height: `${rowHeight * visibleRows.length + rowGap * visibleRows.length - 1}px` } : {},
						...styles.computed
					},
					children: pinnedStartLeafColumns.length > 0 || pinnedEndLeafColumns.length > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
						pinnedStartLeafColumns.length > 0 && /* @__PURE__ */ jsx("div", {
							className: "cantal-body-pinned-start",
							style: pinnedStartStyles,
							children: visibleRows.map((rowIndex) => {
								const row = data[rowIndex];
								return pinnedStartLeafColumns.map((columnDef, columnIndex) => {
									let colDef = columnDef;
									const relativeColumnIndex = (virtual === true || virtual === "columns") && visibleColumns[0] ? columnIndex - visibleColumns[0] : columnIndex;
									const relativeRowIndex = (virtual === true || virtual === "rows") && visibleRows[0] ? rowIndex - visibleRows[0] : rowIndex;
									let startRowIndex = rowIndex;
									let endRowIndex = rowIndex;
									if (columnDef.rowSpanning) {
										if (relativeRowIndex !== 0 && isRowSpanned(columnDef, row, data[rowIndex - 1]) && !isColumnSpanned(data[rowIndex - 1], columnSpans, columnIndex)) return null;
										startRowIndex = getRowIndex(rowIndex, columnIndex, data, columnDef, columnSpans);
										endRowIndex = getLastRowIndex(rowIndex, columnIndex, data, columnDef, columnSpans);
									}
									let startColumnIndex = columnIndex;
									let endColumnIndex = columnIndex;
									if (columnSpans) {
										if (columnIndex !== 0 && isColumnSpanned(row, columnSpans, columnIndex)) return null;
										startColumnIndex = getColumnIndex(columnIndex, row, columnSpans);
										endColumnIndex = getColumnIndex(columnIndex, row, columnSpans, "end");
										colDef = applyColumnSpanDefDefaults(getColumnSpan(row[columnSpans], columnIndex, "from"), columnDef);
									}
									const Editor = colDef.editor({
										columnDef: colDef,
										columnIndex,
										data: row,
										rowIndex,
										value: colDef.valueRenderer({
											columnDef: colDef,
											data: row,
											value: row[colDef.field]
										})
									});
									const isEditing = isSameCell({
										columnIndex,
										rowIndex
									}, editCell);
									const isFocused = isCellFocused(focusedCell, startRowIndex, startColumnIndex, endRowIndex, endColumnIndex);
									return /* @__PURE__ */ jsx(Cell, {
										allowEditCellOverflow: colDef.allowEditCellOverflow,
										ariaLabel: typeof colDef.ariaCellLabel === "function" ? colDef.ariaCellLabel({
											columnIndex,
											data: row,
											def: colDef,
											rowIndex,
											value: row[colDef.field]
										}) : colDef.ariaCellLabel,
										classNames: typeof colDef.cellClassNames === "function" ? colDef.cellClassNames(row, colDef, rowIndex, columnIndex) : colDef.cellClassNames,
										columnDef: colDef,
										columnIndex,
										columnIndexRelative: relativeColumnIndex,
										endColumnIndex,
										endRowIndex,
										isEditing,
										isFocused,
										position: positions.get(columnDef),
										rowIndex,
										selected: rangesContainCell(selectedRanges, {
											columnIndex,
											rowIndex
										}),
										startColumnIndex,
										startRowIndex,
										styles: typeof styles.user?.cell === "function" ? styles.user.cell.bind(void 0, row, colDef, rowIndex, columnIndex) : styles.user?.cell ?? {},
										virtualRowIndex: relativeRowIndex,
										children: isEditing && Editor ? /* @__PURE__ */ jsx(Editor, {
											columnDef: colDef,
											columnIndex,
											data: row,
											handleChange: (value) => {
												if (editCell) handleEditCellChange({
													...editCell,
													selectInitialValue: false,
													value
												});
											},
											rowIndex,
											selectInitialValue: editCell?.selectInitialValue,
											value: editCell?.value
										}) : colDef.valueRenderer({
											columnDef: colDef,
											data: row,
											value: row[colDef.field]
										})
									}, `${rowIndex}-${columnIndex}`);
								});
							})
						}),
						/* @__PURE__ */ jsx("div", {
							className: "cantal-body-unpinned",
							style: unpinnedStyles,
							children: unpinnedLeafColumns.length > 0 && visibleRows.map((rowIndex) => {
								const row = data[rowIndex];
								return visibleColumns.map((columnIndex) => {
									const columnDef = unpinnedLeafColumns[columnIndex];
									if (!columnDef) return null;
									let colDef = columnDef;
									const relativeColumnIndex = (virtual === true || virtual === "columns") && visibleColumns[0] ? columnIndex - visibleColumns[0] : columnIndex;
									const relativeRowIndex = (virtual === true || virtual === "rows") && visibleRows[0] ? rowIndex - visibleRows[0] : rowIndex;
									const colIndex = columnIndex + pinnedStartLeafColumns.length;
									let startRowIndex = rowIndex;
									let endRowIndex = rowIndex;
									if (columnDef.rowSpanning) {
										if (relativeRowIndex !== 0 && isRowSpanned(columnDef, row, data[rowIndex - 1]) && !isColumnSpanned(data[rowIndex - 1], columnSpans, colIndex)) return null;
										startRowIndex = getRowIndex(rowIndex, colIndex, data, columnDef, columnSpans);
										endRowIndex = getLastRowIndex(rowIndex, colIndex, data, columnDef, columnSpans);
									}
									let startColumnIndex = colIndex;
									let endColumnIndex = colIndex;
									if (columnSpans) {
										if (relativeColumnIndex !== 0 && isColumnSpanned(row, columnSpans, colIndex)) return null;
										startColumnIndex = getColumnIndex(colIndex, row, columnSpans);
										endColumnIndex = getColumnIndex(colIndex, row, columnSpans, "end");
										colDef = applyColumnSpanDefDefaults(getColumnSpan(row[columnSpans], colIndex, "from"), columnDef);
									}
									const Editor = colDef.editor({
										columnDef: colDef,
										columnIndex: colIndex,
										data: row,
										rowIndex,
										value: colDef.valueRenderer({
											columnDef: colDef,
											data: row,
											value: row[colDef.field]
										})
									});
									const isEditing = isSameCell({
										columnIndex: colIndex,
										rowIndex
									}, editCell);
									const isFocused = isCellFocused(focusedCell, startRowIndex, startColumnIndex, endRowIndex, endColumnIndex);
									return /* @__PURE__ */ jsx(Cell, {
										allowEditCellOverflow: colDef.allowEditCellOverflow,
										ariaLabel: typeof colDef.ariaCellLabel === "function" ? colDef.ariaCellLabel({
											columnIndex: colIndex,
											data: row,
											def: colDef,
											rowIndex,
											value: row[colDef.field]
										}) : colDef.ariaCellLabel,
										classNames: typeof colDef.cellClassNames === "function" ? colDef.cellClassNames(row, colDef, rowIndex, colIndex) : colDef.cellClassNames,
										columnDef: colDef,
										columnIndex: colIndex,
										columnIndexRelative: relativeColumnIndex,
										endColumnIndex,
										endRowIndex,
										isEditing,
										isFocused,
										position: positions.get(columnDef),
										rowIndex,
										selected: rangesContainCell(selectedRanges, {
											columnIndex: colIndex,
											rowIndex
										}),
										startColumnIndex,
										startRowIndex,
										styles: typeof styles.user?.cell === "function" ? styles.user.cell.bind(void 0, row, colDef, rowIndex, colIndex) : styles.user?.cell ?? {},
										virtualRowIndex: relativeRowIndex,
										children: isEditing && Editor ? /* @__PURE__ */ jsx(Editor, {
											columnDef: colDef,
											columnIndex: colIndex,
											data: row,
											handleChange: (value) => {
												if (editCell) handleEditCellChange({
													...editCell,
													selectInitialValue: false,
													value
												});
											},
											rowIndex,
											selectInitialValue: editCell?.selectInitialValue,
											value: editCell?.value
										}) : colDef.valueRenderer({
											columnDef: colDef,
											data: row,
											value: row[colDef.field]
										})
									}, `${rowIndex}-${colIndex}`);
								});
							})
						}),
						pinnedEndLeafColumns.length > 0 && /* @__PURE__ */ jsx("div", {
							className: "cantal-body-pinned-end",
							style: pinnedEndStyles,
							children: visibleRows.map((rowIndex) => {
								const row = data[rowIndex];
								return pinnedEndLeafColumns.map((columnDef, columnIndex) => {
									let colDef = columnDef;
									const relativeColumnIndex = (virtual === true || virtual === "columns") && visibleColumns[0] ? columnIndex - visibleColumns[0] : columnIndex;
									const relativeRowIndex = (virtual === true || virtual === "rows") && visibleRows[0] ? rowIndex - visibleRows[0] : rowIndex;
									const colIndex = columnIndex + pinnedStartLeafColumns.length + unpinnedLeafColumns.length;
									let startRowIndex = rowIndex;
									let endRowIndex = rowIndex;
									if (columnDef.rowSpanning) {
										if (relativeRowIndex !== 0 && isRowSpanned(columnDef, row, data[rowIndex - 1]) && !isColumnSpanned(data[rowIndex - 1], columnSpans, colIndex)) return null;
										startRowIndex = getRowIndex(rowIndex, colIndex, data, columnDef, columnSpans);
										endRowIndex = getLastRowIndex(rowIndex, colIndex, data, columnDef, columnSpans);
									}
									let startColumnIndex = colIndex;
									let endColumnIndex = colIndex;
									if (columnSpans) {
										if (columnIndex !== 0 && isColumnSpanned(row, columnSpans, colIndex)) return null;
										startColumnIndex = getColumnIndex(colIndex, row, columnSpans);
										endColumnIndex = getColumnIndex(colIndex, row, columnSpans, "end");
										colDef = applyColumnSpanDefDefaults(getColumnSpan(row[columnSpans], colIndex, "from"), columnDef);
									}
									const Editor = colDef.editor({
										columnDef: colDef,
										columnIndex: colIndex,
										data: row,
										rowIndex,
										value: colDef.valueRenderer({
											columnDef: colDef,
											data: row,
											value: row[colDef.field]
										})
									});
									const isEditing = isSameCell({
										columnIndex: colIndex,
										rowIndex
									}, editCell);
									const isFocused = isCellFocused(focusedCell, startRowIndex, startColumnIndex, endRowIndex, endColumnIndex);
									return /* @__PURE__ */ jsx(Cell, {
										allowEditCellOverflow: colDef.allowEditCellOverflow,
										ariaLabel: typeof colDef.ariaCellLabel === "function" ? colDef.ariaCellLabel({
											columnIndex,
											data: row,
											def: columnDef,
											rowIndex,
											value: row[columnDef.field]
										}) : colDef.ariaCellLabel,
										classNames: typeof colDef.cellClassNames === "function" ? colDef.cellClassNames(row, colDef, rowIndex, colIndex) : colDef.cellClassNames,
										columnDef: colDef,
										columnIndex: colIndex,
										columnIndexRelative: relativeColumnIndex,
										endColumnIndex,
										endRowIndex,
										isEditing,
										isFocused,
										position: positions.get(columnDef),
										rowIndex,
										selected: rangesContainCell(selectedRanges, {
											columnIndex: colIndex,
											rowIndex
										}),
										startColumnIndex,
										startRowIndex,
										styles: typeof styles.user?.cell === "function" ? styles.user.cell.bind(void 0, row, colDef, rowIndex, colIndex) : styles.user?.cell ?? {},
										virtualRowIndex: relativeRowIndex,
										children: isEditing && Editor ? /* @__PURE__ */ jsx(Editor, {
											columnDef: colDef,
											columnIndex: colIndex,
											data: row,
											handleChange: (value) => {
												if (editCell) handleEditCellChange({
													...editCell,
													selectInitialValue: false,
													value
												});
											},
											rowIndex,
											selectInitialValue: editCell?.selectInitialValue,
											value: editCell?.value
										}) : colDef.valueRenderer({
											columnDef: colDef,
											data: row,
											value: row[colDef.field]
										})
									}, `${rowIndex}-${colIndex}`);
								});
							})
						})
					] }) : /* @__PURE__ */ jsx(Fragment, { children: visibleRows.map((rowIndex) => {
						const row = data[rowIndex];
						return visibleColumns.map((columnIndex) => {
							const columnDef = unpinnedLeafColumns[columnIndex];
							if (!row || !columnDef) return null;
							let columnDefForSpan = columnDef;
							const relativeColumnIndex = (virtual === true || virtual === "columns") && visibleColumns[0] ? columnIndex - visibleColumns[0] : columnIndex;
							const relativeRowIndex = (virtual === true || virtual === "rows") && visibleRows[0] ? rowIndex - visibleRows[0] : rowIndex;
							let startRowIndex = rowIndex;
							let endRowIndex = rowIndex;
							if (columnDef.rowSpanning) {
								if (relativeRowIndex !== 0 && isRowSpanned(columnDef, row, data[rowIndex - 1]) && !isColumnSpanned(data[rowIndex - 1], columnSpans, columnIndex)) return null;
								startRowIndex = getRowIndex(rowIndex, columnIndex, data, columnDef, columnSpans);
								endRowIndex = getLastRowIndex(rowIndex, columnIndex, data, columnDef, columnSpans);
							}
							let startColumnIndex = columnIndex;
							let endColumnIndex = columnIndex;
							if (columnSpans) {
								if (relativeColumnIndex !== 0 && isColumnSpanned(row, columnSpans, columnIndex)) return null;
								startColumnIndex = getColumnIndex(columnIndex, row, columnSpans);
								endColumnIndex = getColumnIndex(columnIndex, row, columnSpans, "end");
								columnDefForSpan = applyColumnSpanDefDefaults(getColumnSpan(row[columnSpans], columnIndex, "from"), columnDef);
							}
							const Editor = columnDefForSpan.editor({
								columnDef: columnDefForSpan,
								columnIndex,
								data: row,
								rowIndex,
								value: columnDefForSpan.valueRenderer({
									columnDef: columnDefForSpan,
									data: row,
									value: row[columnDefForSpan.field]
								})
							});
							const isEditing = isSameCell({
								columnIndex,
								rowIndex
							}, editCell);
							const isFocused = isCellFocused(focusedCell, startRowIndex, startColumnIndex, endRowIndex, endColumnIndex);
							return /* @__PURE__ */ jsx(Cell, {
								allowEditCellOverflow: columnDefForSpan.allowEditCellOverflow,
								ariaLabel: typeof columnDefForSpan.ariaCellLabel === "function" ? columnDefForSpan.ariaCellLabel({
									columnIndex,
									data: row,
									def: columnDefForSpan,
									rowIndex,
									value: row[columnDefForSpan.field]
								}) : columnDef.ariaCellLabel,
								classNames: typeof columnDefForSpan.cellClassNames === "function" ? columnDefForSpan.cellClassNames(row, columnDefForSpan, rowIndex, columnIndex) : columnDefForSpan.cellClassNames,
								columnDef: columnDefForSpan,
								columnIndex,
								columnIndexRelative: relativeColumnIndex,
								endColumnIndex,
								endRowIndex,
								isEditing,
								isFocused,
								position: positions.get(columnDef),
								rowIndex,
								selected: rangesContainCell(selectedRanges, {
									columnIndex: startColumnIndex,
									rowIndex: startRowIndex
								}),
								startColumnIndex,
								startRowIndex,
								styles: typeof styles.user?.cell === "function" ? styles.user.cell.bind(void 0, row, columnDefForSpan, rowIndex, columnIndex) : styles.user?.cell ?? {},
								virtualRowIndex: relativeRowIndex,
								children: isEditing && Editor ? /* @__PURE__ */ jsx(Editor, {
									columnDef: columnDefForSpan,
									columnIndex,
									data: row,
									handleChange: (value) => {
										if (editCell) handleEditCellChange({
											...editCell,
											selectInitialValue: false,
											value
										});
									},
									rowIndex,
									selectInitialValue: editCell?.selectInitialValue,
									value: editCell?.value
								}) : columnDefForSpan.valueRenderer({
									columnDef: columnDefForSpan,
									data: row,
									value: row[columnDefForSpan.field]
								})
							}, `${rowIndex}-${columnIndex}`);
						});
					}) })
				})
			]
		}), showSelectionBox && startDragPoint && endDragPoint && /* @__PURE__ */ jsx("div", {
			className: "cantal-selection-box",
			style: {
				height: Math.abs(startDragPoint.y - endDragPoint.y),
				left: Math.min(startDragPoint.x, endDragPoint.x),
				top: Math.min(startDragPoint.y, endDragPoint.y),
				width: Math.abs(startDragPoint.x - endDragPoint.x)
			}
		})]
	});
}
function getCellFromEvent(event) {
	const cell = event.target.closest("[role=gridcell]");
	if (!cell) return null;
	const columnIndex = cell.getAttribute("data-col-idx");
	const rowIndex = cell.getAttribute("data-row-idx");
	if (!columnIndex || !rowIndex) return null;
	return {
		columnIndex: +columnIndex,
		rowIndex: +rowIndex
	};
}
function getPointFromEvent(event, element) {
	if (element === null || isKeyboardEvent(event) || isMouseEvent(event)) return;
	return {
		x: event.clientX - element.getBoundingClientRect().left,
		y: event.clientY - element.getBoundingClientRect().top
	};
}
function rangesContainCell(ranges, cell) {
	if (!cell) return false;
	for (let range$1 of ranges) if (range$1.contains(cell.rowIndex, cell.columnIndex)) return true;
	return false;
}
function range(startRow, startColumn, endRow, endColumn) {
	const _endColumn = endColumn ?? startColumn;
	const _endRow = endRow ?? startRow;
	const fromColumn = Math.max(0, Math.min(startColumn, _endColumn));
	const fromRow = Math.max(0, Math.min(startRow, _endRow));
	const toColumn = Math.max(startColumn, _endColumn);
	const toRow = Math.max(startRow, _endRow);
	function contains(row, column) {
		return row >= fromRow && row <= toRow && column >= fromColumn && column <= toColumn;
	}
	function containsMultipleCells() {
		const s = shape();
		return s[0] > 0 || s[1] > 0 || fromColumn === void 0 && toColumn === void 0;
	}
	function equals(other) {
		return fromRow === other.fromRow && fromColumn === other.fromColumn && toRow === other.toRow && toColumn === other.toColumn;
	}
	function merge(other) {
		return range(Math.min(fromRow, other.fromRow), Math.min(fromColumn, other.fromColumn), Math.max(toRow, other.toRow), Math.max(toColumn, other.toColumn));
	}
	function shape() {
		return [toRow - fromRow, toColumn - fromColumn];
	}
	function toString() {
		return `rows ${fromRow} to ${toRow}; columns ${fromColumn} to ${toColumn}`;
	}
	return {
		contains,
		containsMultipleCells,
		equals,
		fromColumn,
		fromRow,
		merge,
		shape,
		toColumn,
		toRow,
		toString
	};
}
function getExpandedSelectionRangeOnKey(key, focusedCell, selectedRange, data, leafColumns) {
	if (selectedRange === void 0) return range(focusedCell.rowIndex, focusedCell.columnIndex);
	return range(Math.min(data.length - 1, selectedRange.fromRow + (selectedRange.fromRow > focusedCell.rowIndex ? 0 : key === "ArrowUp" && selectedRange.toRow === focusedCell.rowIndex ? -1 : key === "ArrowDown" && selectedRange.toRow === focusedCell.rowIndex ? 1 : 0)), Math.min(leafColumns.length - 1, selectedRange.fromColumn + (selectedRange.fromColumn > focusedCell.columnIndex ? 0 : key === "ArrowLeft" && selectedRange.toColumn === focusedCell.columnIndex ? -1 : key === "ArrowRight" && selectedRange.toColumn === focusedCell.columnIndex ? 1 : 0)), Math.min(data.length - 1, selectedRange.toRow + (selectedRange.toRow <= focusedCell.rowIndex ? 0 : key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0)), Math.min(leafColumns.length - 1, selectedRange.toColumn + (selectedRange.toColumn <= focusedCell.columnIndex ? 0 : key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0)));
}
function createPasteMatrix(s) {
	return s.split("\n").map((row) => row.split("	"));
}
function getEditRowsFromPasteMatrix(matrix, data, leafColumns, selectedRanges, focusedCell, rowId, columnSpans) {
	const editRows = {};
	const selectedRange = selectedRanges[0];
	if (matrix.length === 1 && matrix[0]?.length === 1 && selectedRange && selectedRange.containsMultipleCells()) {
		const pasteValue = matrix[0]?.[0];
		if (pasteValue === void 0 || isNullLikeCharacter(pasteValue)) return editRows;
		for (let rowIndex = selectedRange.fromRow; rowIndex <= selectedRange.toRow; rowIndex++) {
			const editRow = {};
			const rowData = data[rowIndex];
			if (!rowData) continue;
			for (let columnIndex = selectedRange.fromColumn; columnIndex <= selectedRange.toColumn; columnIndex++) {
				let columnDef = leafColumns[columnIndex];
				if (!columnDef) break;
				if (!isCellEditable({
					columnIndex,
					rowIndex
				}, rowData, columnDef) || isColumnSpanned(rowData, columnSpans, columnIndex)) continue;
				editRow[columnDef.field] = columnDef.valueParser(pasteValue);
			}
			if (Object.keys(editRow).length > 0) editRows[rowId ? rowData[rowId] : rowIndex] = editRow;
		}
	} else if (focusedCell) {
		let pasteRowIndex = 0;
		for (let rowIndex = focusedCell.rowIndex; rowIndex < focusedCell.rowIndex + matrix.length; rowIndex++) {
			const rowData = data[rowIndex];
			const pasteRow = matrix[pasteRowIndex];
			if (!rowData || !pasteRow) continue;
			const editRow = {};
			for (let pasteColumnIndex = 0; pasteColumnIndex < pasteRow.length; pasteColumnIndex++) {
				let columnDef = leafColumns[focusedCell.columnIndex + pasteColumnIndex];
				if (!columnDef) break;
				if (!isCellEditable({
					columnIndex: focusedCell.columnIndex + pasteColumnIndex,
					rowIndex
				}, rowData, columnDef) || isColumnSpanned(rowData, columnSpans, focusedCell.columnIndex + pasteColumnIndex)) continue;
				editRow[columnDef.field] = columnDef.valueParser(pasteRow[pasteColumnIndex]);
			}
			if (Object.keys(editRow).length > 0) editRows[rowId ? rowData[rowId] : rowIndex] = editRow;
			pasteRowIndex++;
		}
	}
	return editRows;
}
function isNullLikeCharacter(char) {
	return char === "\\0";
}
function isKeyboardEvent(e) {
	return e.key !== void 0;
}
function isMouseEvent(e) {
	return e.key === void 0 && e.pointerId === void 0;
}
function spread(start, end) {
	return Array.from({ length: end - start }, (v, i) => start + i);
}
function getRowSpans(leafColumns, data, visibleColumns, visibleRows, colSpans) {
	const spans = {};
	for (let columnIndex of visibleColumns) {
		const colDef = leafColumns[columnIndex];
		if (!colDef) continue;
		const { field, rowSpanComparator, rowSpanning } = colDef;
		if (!rowSpanning) continue;
		let endIndex = visibleRows.at(-1);
		if (!endIndex) continue;
		for (let rowIndex of visibleRows) {
			spans[rowIndex] ??= {};
			if ((colSpans?.[rowIndex]?.[columnIndex] ?? 0) > 0) {
				spans[rowIndex][columnIndex] = 1;
				continue;
			}
			let span = 1;
			while (rowIndex + span <= endIndex + 1) {
				const currentRow = data[rowIndex];
				const nextRow = data[rowIndex + span];
				if (currentRow && nextRow && rowSpanComparator(colDef.valueRenderer({
					columnDef: colDef,
					data: currentRow,
					value: currentRow[field]
				}), colDef.valueRenderer({
					columnDef: colDef,
					data: nextRow,
					value: nextRow[field]
				})) && [void 0, 0].includes(colSpans?.[rowIndex + span]?.[columnIndex])) {
					if (rowIndex + span > endIndex) {
						spans[rowIndex][columnIndex] = span;
						break;
					}
					span += 1;
				} else {
					spans[rowIndex][columnIndex] = span;
					break;
				}
			}
		}
	}
	return spans;
}
function getColumnSpans(key, data, visibleColumns, visibleRows) {
	const spans = {};
	for (let rowIndex of visibleRows) {
		const row = data[rowIndex];
		if (!row) continue;
		if (!visibleColumns.at(-1)) continue;
		const columnSpans = row[key];
		if (!isColumnSpans(columnSpans)) continue;
		for (let columnIndex of visibleColumns) {
			spans[rowIndex] ??= {};
			const columnSpan = columnSpans.find((cs) => cs.from <= columnIndex && columnIndex <= cs.to);
			if (columnSpan !== void 0) spans[rowIndex][columnIndex] = columnSpan.to - columnIndex;
			else spans[rowIndex][columnIndex] = 0;
		}
	}
	return spans;
}
function getRowIndex(rowIndex, columnIndex, data, columnDef, columnSpans) {
	let newRowIndex = rowIndex;
	while (newRowIndex > 0) {
		const row = data[newRowIndex];
		const prevRow = data[newRowIndex - 1];
		const rowIsSpanned = isRowSpanned(columnDef, row, prevRow);
		const columnIsSpanned = isColumnSpanned(row, columnSpans, columnIndex);
		if (!rowIsSpanned || columnIsSpanned || rowIsSpanned && isColumnSpanned(prevRow, columnSpans, columnIndex)) break;
		newRowIndex--;
	}
	return newRowIndex;
}
function getLastRowIndex(rowIndex, columnIndex, data, columnDef, columnSpans) {
	let newRowIndex = rowIndex;
	while (newRowIndex < data.length - 1) {
		const row = data[newRowIndex];
		const nextRow = data[newRowIndex + 1];
		const rowIsSpanned = isRowSpanned(columnDef, nextRow, row);
		if (isColumnSpanned(row, columnSpans, columnIndex) || !rowIsSpanned || rowIsSpanned && isColumnSpanned(nextRow, columnSpans, columnIndex)) break;
		newRowIndex++;
	}
	return newRowIndex;
}
function getColumnIndex(columnIndex, row, columnSpans, boundary = "start") {
	if (!row || !columnSpans) return columnIndex;
	const colSpans = row[columnSpans];
	if (!isColumnSpans(colSpans)) return columnIndex;
	const span = colSpans.find((span$1) => span$1.from <= columnIndex && columnIndex <= span$1.to);
	if (span === void 0) return columnIndex;
	if (boundary === "start") return span.from;
	return span.to;
}
function isRowSpanned(columnDef, row, prevRow) {
	return columnDef.rowSpanning && row !== void 0 && prevRow !== void 0 && columnDef.rowSpanComparator(columnDef.valueRenderer({
		columnDef,
		data: prevRow,
		value: prevRow[columnDef.field]
	}), columnDef.valueRenderer({
		columnDef,
		data: row,
		value: row[columnDef.field]
	}));
}
function isColumnSpanned(row, columnSpans, columnIndex) {
	if (!row || !columnSpans) return false;
	const colSpans = row[columnSpans];
	if (isColumnSpans(colSpans) && colSpans.find((span) => span.from < columnIndex && columnIndex <= span.to)) return true;
	return false;
}
function isColumnSpans(columnSpans) {
	return Array.isArray(columnSpans) && columnSpans.every((columnSpan) => typeof columnSpan.field === "string" && typeof columnSpan.from === "number" && typeof columnSpan.to === "number");
}
function isCellFocused(cell, rowIndex, columnIndex, endRowIndex, endColumnIndex) {
	if (!cell) return false;
	const matchesColumn = columnIndex <= cell.columnIndex && cell.columnIndex <= endColumnIndex;
	const matchesRow = rowIndex <= cell.rowIndex && cell.rowIndex <= endRowIndex;
	return matchesColumn && matchesRow;
}
function getColumnSpan(spans, columnIndex, condition = "in") {
	if (!Array.isArray(spans)) return;
	return spans.find(({ from, to }) => {
		if (condition === "from") return columnIndex === from;
		return from <= columnIndex && columnIndex <= to;
	});
}
function isSameCell(cellA, cellB) {
	return cellA?.rowIndex === cellB?.rowIndex && cellA?.columnIndex === cellB?.columnIndex;
}
function isKeyDownPrintable(e) {
	return !e.metaKey && !e.ctrlKey && e.key.length === 1;
}
function isCellEditable(cell, row, columnDef) {
	if (typeof columnDef.editable === "function") return columnDef.editable({
		data: row,
		rowIndex: cell.rowIndex,
		value: row[columnDef.field]
	});
	return columnDef.editable;
}
function isPointerEvent(event) {
	return event.type.startsWith("pointer");
}

//#endregion
//#region src/Resizer.tsx
function Resizer({ className, handleResize, handleResizeEnd, handleResizeStart, style = {} }) {
	const [dragStarted, setDragStarted] = useState(false);
	const [dragStartPosition, setDragStartPosition] = useState(null);
	function handlePointerDown(e) {
		e.preventDefault();
		setDragStarted(true);
		setDragStartPosition(e.clientX);
		handleResizeStart();
	}
	function handlePointerMove(e) {
		if (dragStarted) {
			e.preventDefault();
			if (dragStartPosition !== null) {
				const delta = e.clientX - dragStartPosition;
				if (delta > 0 || delta < 0) handleResize(delta);
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
			document.addEventListener("pointermove", handlePointerMove);
			document.addEventListener("pointerup", handlePointerUp);
		}
		return function cleanup() {
			document.removeEventListener("pointermove", handlePointerMove);
			document.removeEventListener("pointerup", handlePointerUp);
		};
	}, [dragStarted]);
	return /* @__PURE__ */ jsx("div", {
		...className ? { className } : {},
		onPointerDown: handlePointerDown,
		style
	});
}

//#endregion
//#region src/Sorter.tsx
function Sorter({ className, handleSort, state }) {
	function handlePointerUp(e) {
		e.stopPropagation();
		handleSort(e);
	}
	return /* @__PURE__ */ jsx("button", {
		"aria-label": `Sort: ${state.label}`,
		"aria-live": "assertive",
		className,
		onPointerUp: handlePointerUp,
		children: state.symbol
	});
}

//#endregion
//#region src/HeaderCell.tsx
function HeaderCell({ classNames, columnDef, filterer: Filter$1 = null, filters, handleFilter, handleResize, handleSort, position, sorts }) {
	const [width, setWidth] = useState(0);
	const ref = useRef(null);
	function handleColumnResize(xDelta) {
		handleResize(columnDef, getColumnWidth(), xDelta);
	}
	function getColumnWidth() {
		if (typeof columnDef.width === "string") return width;
		return columnDef.width;
	}
	if (position === void 0) {
		console.warn("Column definition not found.");
		return null;
	}
	return /* @__PURE__ */ jsxs("div", {
		"aria-label": isFn(columnDef.ariaHeaderCellLabel) ? columnDef.ariaHeaderCellLabel({
			def: columnDef,
			position
		}) : columnDef.ariaHeaderCellLabel,
		className: `cantal-headercell${classNames?.container ? ` ${classNames.container}` : ""}`,
		"data-column-end": position.pinnedIndexEnd,
		"data-column-start": position.pinnedIndex,
		"data-field": columnDef.field,
		"data-row-end": position.depth + 1,
		"data-row-start": position.level + 1,
		ref,
		role: "columnheader",
		style: {
			gridRowStart: position.level + 1,
			gridColumnStart: position.pinnedIndex,
			gridRowEnd: position.depth + 1,
			gridColumnEnd: position.pinnedIndexEnd,
			position: columnDef.resizable ? "sticky" : "static"
		},
		children: [/* @__PURE__ */ jsxs("div", {
			className: `cantal-headercell-content${classNames?.content ? ` ${classNames.content}` : ""}`,
			children: [/* @__PURE__ */ jsx("div", {
				className: `cantal-headercell-label${classNames?.label ? ` ${classNames.label}` : ""}`,
				children: columnDef.sortable && columnDef.sortStates.length ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("span", {
					className: "cantal-headercell-label-text",
					children: columnDef.title
				}), /* @__PURE__ */ jsx(Sorter, {
					className: `cantal-headercell-sorter${classNames?.sorter ? ` ${classNames.sorter}` : ""}`,
					handleSort: (e) => handleSort(updateSorts(columnDef.field, sorts, columnDef.sortStates), e),
					state: findState(columnDef.field, sorts, columnDef.sortStates)
				})] }) : columnDef.title
			}), columnDef.filterable && Filter$1 && /* @__PURE__ */ jsx(Filter$1, {
				className: `cantal-headercell-filter${classNames?.filter ? ` ${classNames.filter}` : ""}`,
				field: columnDef.field,
				handleFilter,
				value: filters[columnDef.field]
			})]
		}), columnDef.resizable && /* @__PURE__ */ jsx(Resizer, {
			className: `cantal-headercell-resizer${classNames?.resizer ? ` ${classNames.resizer}` : ""}`,
			handleResize: handleColumnResize,
			handleResizeEnd: () => setWidth(0),
			handleResizeStart: () => {
				if (typeof columnDef.width === "string" && ref.current) {
					const { width: width$1 } = ref.current.getBoundingClientRect();
					setWidth(width$1);
				}
			}
		})]
	});
}
function updateSorts(field, sorting, states) {
	const currentSortState = states.find((state) => state.label === sorting[field]) ?? findState(field, sorting, states);
	const iterableStates = states.filter((state) => state.iterable !== false);
	if (isNonEmptyArray(iterableStates)) {
		const nextMode = getNextSortLabel(currentSortState, iterableStates);
		return { [field]: nextMode };
	}
	return sorting;
}
function getNextSortLabel(currentState, states) {
	return states[(states.findIndex((state) => state.label === currentState?.label) + 1) % states.length]?.label ?? states[0].label;
}
function findState(field, sorting, states) {
	const foundByLabel = states.find((state) => state.label === sorting[field]);
	if (foundByLabel) return foundByLabel;
	const foundByIterable = states.find((state) => state.iterable === false);
	if (foundByIterable) return foundByIterable;
	return states[0];
}
function isNonEmptyArray(arr) {
	return arr.length > 0;
}
function isFn(maybeFn) {
	return typeof maybeFn === "function";
}

//#endregion
//#region src/Header.tsx
function Header({ canvasWidth, columnDefs, filters, handleFilter, handleResize, handleSort, leafColumns, positions, ref, sorts, styles, visibleColumnEnd, visibleColumnStart,...props }) {
	const pinnedStartLeafColumns = leafColumns.filter((def) => def.pinned === "start");
	const unpinnedLeafColumns = leafColumns.filter((def) => def.pinned !== "start" && def.pinned !== "end");
	const pinnedEndLeafColumns = leafColumns.filter((def) => def.pinned === "end");
	function handleColumnResize(columnDef, columnWidth, delta) {
		if (columnDef.subcolumns && columnDef.subcolumns.length > 0) {
			const childLeafColumns = getLeafColumns([columnDef]);
			const totalLeafColWidth = childLeafColumns.map((col) => col.width).reduce((a, b) => a + b, 0);
			const newWidth = totalLeafColWidth + delta;
			const newDefs = childLeafColumns.map((def) => ({
				...def,
				width: Math.max(def.minWidth, Math.round(def.width * newWidth / totalLeafColWidth))
			}));
			const resizedColumnDefs = childLeafColumns.reduce((resized, def, i) => {
				if (newDefs[i] === void 0) return resized;
				if (resized.length === 0) return replaceColumn(columnDefs, def, newDefs[i]);
				return replaceColumn(resized, def, newDefs[i]);
			}, []);
			handleResize(columnDef.field, newWidth, resizedColumnDefs);
		} else if (columnDef) {
			const newWidth = columnWidth + delta;
			const width = Math.max(columnDef.minWidth, newWidth);
			const resizedColumnDefs = replaceColumn(columnDefs, columnDef, {
				...columnDef,
				width
			});
			handleResize(columnDef.field, width, resizedColumnDefs);
		}
	}
	function handleEvent(event, eventName) {
		const { columnEnd, columnStart, field, rowEnd, rowStart } = getAttributeFromHeaderEvent(event, [
			"column-end",
			"column-start",
			"field",
			"row-end",
			"row-start"
		]);
		if (field === void 0 || field === null) return;
		const columnDef = findColumnDefByField(columnDefs, field);
		if (columnDef === void 0) return;
		const namedFunction = eventName.replace("on", "handle");
		(isHandler(props, namedFunction) ? props[namedFunction] : invokeDefaultHandler)?.({
			columnDef,
			columnIndexEnd: Number(columnEnd),
			columnIndexStart: Number(columnStart),
			defaultHandler: () => {},
			e: event,
			rowIndexEnd: Number(rowEnd),
			rowIndexStart: Number(rowStart)
		});
	}
	function replaceColumn(columnDefs$1, existingLeafColumn, newLeafColumn) {
		const colDefs = [];
		const newDef = getColumnDefWithDefaults(newLeafColumn);
		for (let def of columnDefs$1) if (def.field === existingLeafColumn.field) colDefs.push(newDef);
		else if (isLeafColumn(existingLeafColumn) && existingLeafColumn.ancestors.map((ancestor) => ancestor.field).includes(def.field)) colDefs.push({
			...def,
			subcolumns: replaceColumn(def.subcolumns, existingLeafColumn, newLeafColumn)
		});
		else colDefs.push(def);
		return colDefs;
	}
	function getColumnDefWithDefaults(def) {
		if (isLeafColumn(def)) {
			const { ancestors,...columnDefWithDefaults } = def;
			return columnDefWithDefaults;
		}
		return def;
	}
	function isLeafColumn(def) {
		return Object.hasOwn(def, "ancestors");
	}
	const viewportStyles = {
		overflow: "hidden",
		width: "inherit"
	};
	const canvasStyles = { width: canvasWidth };
	const pinnedStyles = {
		...styles,
		backgroundColor: "var(--background-color)",
		display: "grid",
		gridTemplateColumns: "subgrid",
		insetInline: 0,
		position: "sticky"
	};
	const pinnedStartStyles = {
		...pinnedStyles,
		gridColumn: `1 / ${pinnedStartLeafColumns.length + 1}`
	};
	const unpinnedStyles = {
		...styles,
		display: "grid",
		gridColumn: `${pinnedStartLeafColumns.length + 1} / ${leafColumns.length - pinnedEndLeafColumns.length + 1}`,
		gridTemplateColumns: "subgrid"
	};
	const pinnedEndStyles = {
		...pinnedStyles,
		gridColumn: `${leafColumns.length - pinnedEndLeafColumns.length + 1} / ${leafColumns.length + 1}`
	};
	return /* @__PURE__ */ jsx("div", {
		className: "cantal-header-viewport",
		ref,
		style: viewportStyles,
		children: /* @__PURE__ */ jsx("div", {
			className: "cantal-header-canvas",
			style: canvasStyles,
			children: /* @__PURE__ */ jsx("div", {
				className: "cantal-header",
				onPointerDown: (e) => handleEvent(e, "onPointerDown"),
				style: {
					display: "grid",
					...styles
				},
				children: pinnedStartLeafColumns.length > 0 || pinnedEndLeafColumns.length > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
					pinnedStartLeafColumns.length > 0 && /* @__PURE__ */ jsx("div", {
						className: "cantal-header-pinned-start",
						style: pinnedStartStyles,
						children: getFlattenedColumns(pinnedStartLeafColumns).map((def) => /* @__PURE__ */ jsx(HeaderCell, {
							classNames: typeof def.headerCellClassNames === "function" ? def.headerCellClassNames({
								columnDef: def,
								position: positions.get(def)
							}) : def.headerCellClassNames,
							columnDef: def,
							filterer: def.filterer,
							filters,
							handleFilter,
							handleResize: handleColumnResize,
							handleSort,
							position: positions.get(def),
							sorts
						}, def.field))
					}),
					unpinnedLeafColumns.length > 0 && /* @__PURE__ */ jsx("div", {
						className: "cantal-header-unpinned",
						style: unpinnedStyles,
						children: getFlattenedColumns(unpinnedLeafColumns.slice(visibleColumnStart, visibleColumnEnd + 1)).map((def) => /* @__PURE__ */ jsx(HeaderCell, {
							classNames: typeof def.headerCellClassNames === "function" ? def.headerCellClassNames({
								columnDef: def,
								position: positions.get(def)
							}) : def.headerCellClassNames,
							columnDef: def,
							filterer: def.filterer,
							filters,
							handleFilter,
							handleResize: handleColumnResize,
							handleSort,
							position: positions.get(def),
							sorts
						}, def.field))
					}),
					pinnedEndLeafColumns.length > 0 && /* @__PURE__ */ jsx("div", {
						className: "cantal-header-pinned-end",
						style: pinnedEndStyles,
						children: getFlattenedColumns(pinnedEndLeafColumns).map((def) => /* @__PURE__ */ jsx(HeaderCell, {
							classNames: typeof def.headerCellClassNames === "function" ? def.headerCellClassNames({
								columnDef: def,
								position: positions.get(def)
							}) : def.headerCellClassNames,
							columnDef: def,
							filterer: def.filterer,
							filters,
							handleFilter,
							handleResize: handleColumnResize,
							handleSort,
							position: positions.get(def),
							sorts
						}, def.field))
					})
				] }) : /* @__PURE__ */ jsx(Fragment, { children: getFlattenedColumns(leafColumns.slice(visibleColumnStart, visibleColumnEnd + 1)).map((def) => /* @__PURE__ */ jsx(HeaderCell, {
					classNames: typeof def.headerCellClassNames === "function" ? def.headerCellClassNames({
						columnDef: def,
						position: positions.get(def)
					}) : def.headerCellClassNames,
					columnDef: def,
					filterer: def.filterer,
					filters,
					handleFilter,
					handleResize: handleColumnResize,
					handleSort,
					position: positions.get(def),
					sorts
				}, def.field)) })
			})
		})
	});
}
function getFlattenedColumns(leafColumns) {
	const columnsSeen = {};
	const flattenedColumns = [];
	for (let leafColumn of leafColumns) {
		for (let ancestor of leafColumn.ancestors) {
			if (columnsSeen[ancestor.field]) continue;
			columnsSeen[ancestor.field] = true;
			flattenedColumns.push(ancestor);
		}
		flattenedColumns.push(leafColumn);
	}
	return flattenedColumns;
}
function getAttributeFromHeaderEvent(event, attr) {
	const target = event.target;
	if (target instanceof HTMLElement) {
		const headerCell = target?.closest("[role=\"columnheader\"]");
		return attr.reduce((acc, attribute) => {
			const value = headerCell?.getAttribute(`data-${attribute}`);
			if (value !== void 0 && value !== null) acc[kebabToCamelCase(attribute)] = value;
			return acc;
		}, {});
	}
	return {};
}
function kebabToCamelCase(str) {
	return str.split("-").map((w, i) => {
		if (i === 0) return w;
		return w.at(0)?.toUpperCase() + w.slice(1);
	}).join("");
}
function findColumnDefByField(columnDefs, field) {
	for (let def of columnDefs) {
		if (def.field === field) return def;
		if (def.subcolumns && def.subcolumns.length > 0) {
			const result = findColumnDefByField(def.subcolumns, field);
			if (result) return result;
		}
	}
}
function isHandler(obj, prop) {
	return obj.hasOwnProperty(prop);
}

//#endregion
//#region src/Filter.tsx
function Filter({ className, field, handleFilter, placeholder = "", styles = {}, value = "" }) {
	return /* @__PURE__ */ jsx("input", {
		className,
		onChange: (e) => handleFilter(field, e.target.value),
		placeholder,
		style: styles,
		type: "search",
		value
	});
}

//#endregion
//#region src/editors/InputEditor.tsx
function InputEditor({ handleChange, selectInitialValue = true, style = {}, type = "text", value = "" }) {
	const ref = useRef(null);
	useEffect(() => {
		if (ref.current) {
			if (selectInitialValue) ref.current.select();
			ref.current.focus();
		}
	}, []);
	function handleKeyDown(e) {
		if (![
			"Enter",
			"Tab",
			"Escape"
		].includes(e.key)) e.stopPropagation();
	}
	return /* @__PURE__ */ jsx("input", {
		onChange: (e) => handleChange(e.target.value),
		onKeyDown: handleKeyDown,
		ref,
		style: {
			border: 0,
			borderRadius: 0,
			boxSizing: "border-box",
			fontSize: 14,
			height: "100%",
			outline: "none",
			padding: "0px 4px",
			width: "100%",
			...style
		},
		type,
		value
	});
}

//#endregion
//#region src/Grid.tsx
function Grid({ body = (leafColumns$1, positions$1, visibleStartColumn$1, visibleEndColumn$1, styles$1, height$1, canvasWidth$1, headerViewportRef$1, setState) => /* @__PURE__ */ jsx(Body, {
	canvasWidth: canvasWidth$1,
	columnGap: typeof gap === "number" ? gap : gap.columnGap,
	columnSpans,
	containerHeight: height$1,
	data,
	editCell,
	focusedCell,
	handleContextMenu,
	handleEdit,
	handleEditCellChange,
	handleFocusedCellChange,
	handleKeyDown,
	handlePointerDown,
	handleDoublePointerDown,
	handleScroll,
	handleSelection,
	headerViewportRef: headerViewportRef$1,
	leafColumns: leafColumns$1,
	overscanColumns,
	overscanRows,
	positions: positions$1,
	rowGap: typeof gap === "number" ? gap : gap.rowGap,
	rowHeight,
	rowId,
	selectedRanges,
	selectionFollowsFocus,
	setState,
	showSelectionBox,
	styles: styles$1,
	virtual,
	visibleColumnEnd: visibleEndColumn$1,
	visibleColumnStart: visibleStartColumn$1
}), columnDefs, columnSorts = {}, columnSpans, data, editCell, filters = {}, focusedCell, gap = {
	columnGap: 1,
	rowGap: 1
}, handleContextMenu = noop, handleDoublePointerDown = invokeDefaultHandler, handleEdit = noop, handleEditCellChange = noop, handleFocusedCellChange = noop, handleFilter = noop, handleHeaderPointerDown = invokeDefaultHandler, handleKeyDown = invokeDefaultHandler, handlePointerDown = invokeDefaultHandler, handleResize = noop, handleScroll = noop, handleSelection, handleSort = noop, header = (colDefs$1, leafColumns$1, positions$1, visibleStartColumn$1, visibleEndColumn$1, styles$1, ref$1, canvasWidth$1) => /* @__PURE__ */ jsx(Header, {
	canvasWidth: canvasWidth$1,
	columnDefs: colDefs$1,
	filters,
	handleFilter,
	handlePointerDown: handleHeaderPointerDown,
	handleResize,
	handleSort,
	leafColumns: leafColumns$1,
	positions: positions$1,
	ref: ref$1,
	sorts: columnSorts,
	styles: styles$1,
	visibleColumnEnd: visibleEndColumn$1,
	visibleColumnStart: visibleStartColumn$1
}), id, overscanColumns = 3, overscanRows = 3, ref, rowHeight, rowId, selectedRanges = [], selectionFollowsFocus, showSelectionBox, styles, virtual = false }) {
	const containerRef = useRef(null);
	const headerViewportRef = useRef(null);
	const [visibleStartColumn, setVisibleStartColumn] = useState(0);
	const [height, setHeight] = useState(0);
	useImperativeHandle(ref, () => ({ copy }));
	const sizeRef = (node) => {
		const ro = new ResizeObserver(([entry]) => {
			if (entry) setHeight(Math.ceil(entry.contentRect.height));
		});
		if (node !== null) ro.observe(node);
		return () => {
			ro.disconnect();
		};
	};
	const { columnGap, rowGap } = typeof gap === "number" ? {
		columnGap: gap,
		rowGap: gap
	} : gap;
	const colDefs = applyColumnDefDefaults(columnDefs, columnDefDefaults);
	if (process.env.NODE_ENV === "development") validateProps({
		body,
		columnDefs: colDefs,
		columnSorts,
		data,
		header
	});
	const leafColumns = getLeafColumns(colDefs);
	const [visibleEndColumn, setVisibleEndColumn] = useState(() => {
		if (virtual === true || virtual === "columns") return Math.min(leafColumns.length, window.innerWidth / DEFAULT_COLUMN_WIDTH);
		return leafColumns.length;
	});
	const orderedLeafColumns = pinColumns(leafColumns);
	const positions = getColumnPositions(orderedLeafColumns, getColumnDepth(leafColumns));
	const gridTemplateColumns = getColumnWidths(orderedLeafColumns);
	const canvasWidth = getGridCanvasWidth(orderedLeafColumns, columnGap);
	const computedStyles = {
		columnGap,
		gridTemplateColumns,
		rowGap
	};
	const containerStyles = {
		...selectedRanges.length > 0 ? {
			WebkitUserSelect: "none",
			userSelect: "none"
		} : {},
		...styles?.container
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "cantal",
		id,
		ref: mergeRefs(containerRef, sizeRef),
		style: containerStyles,
		children: [header(colDefs, orderedLeafColumns, positions, visibleStartColumn, visibleEndColumn, {
			...computedStyles,
			gridAutoRows: `minmax(27px, auto)`
		}, headerViewportRef, canvasWidth), body(orderedLeafColumns, positions, visibleStartColumn, visibleEndColumn, {
			computed: computedStyles,
			user: styles
		}, height, canvasWidth, headerViewportRef, {
			setVisibleEndColumn,
			setVisibleStartColumn
		})]
	});
}
const MIN_COLUMN_WIDTH = 70;
const DEFAULT_COLUMN_WIDTH = 100;
const columnDefDefaults = {
	allowEditCellOverflow: false,
	ariaCellLabel: ({ columnIndex, data, def, rowIndex, value }) => `Column ${columnIndex + 1}${typeof def.pinned === "string" && ["start", "end"].includes(def.pinned) ? ", pinned" : ""}${def.title ? `, ${def.title}` : ""}`,
	ariaHeaderCellLabel: ({ def, position }) => `Column ${position.columnIndex}, ${position.ancestors.map((ancestor) => ancestor.title).filter((title) => {
		if (typeof title === "string") return title.trim() !== "";
		return false;
	}).concat([def.title]).join(" ")}`,
	editable: false,
	editor: () => InputEditor,
	filterer: Filter,
	minWidth: MIN_COLUMN_WIDTH,
	rowSpanComparator: (prev, curr) => prev === curr,
	rowSpanning: false,
	sortStates: [
		{
			label: "unsorted",
			symbol: "↑↓",
			iterable: false
		},
		{
			label: "ascending",
			symbol: "↑",
			iterable: true
		},
		{
			label: "descending",
			symbol: "↓",
			iterable: true
		}
	],
	subcolumns: [],
	valueParser: (value) => value,
	valueRenderer: (args) => args.value,
	width: DEFAULT_COLUMN_WIDTH
};
function applyColumnDefDefaults(defs, defaults) {
	const { minWidth, width,...widthlessDefaults } = defaults;
	return defs.map((def) => {
		let defDefaults = defaults;
		if (def.subcolumns && def.subcolumns.length > 0) {
			defDefaults = widthlessDefaults;
			def.subcolumns = applyColumnDefDefaults(def.subcolumns, defaults);
		}
		return {
			...defDefaults,
			...def
		};
	});
}
function applyColumnSpanDefDefaults(columnSpan, columnDef) {
	if (columnSpan === void 0) return columnDef;
	if (columnSpan.field === columnDef.field) return Object.assign({}, columnDef, columnSpan);
	return Object.assign({}, columnDefDefaults, {
		ancestors: [],
		pinned: columnDef.pinned
	}, columnSpan);
}
function getLeafColumnsFromColumnDefs(columnDefs) {
	return getLeafColumns(applyColumnDefDefaults(columnDefs, columnDefDefaults));
}
function getLeafColumns(columnDefs, ancestors = []) {
	return columnDefs.map((def) => {
		if (def.subcolumns && def.subcolumns.length > 0) {
			const parents = [...ancestors, def];
			return getLeafColumns(def.subcolumns, parents);
		}
		if (ancestors.length > 0) {
			const parent = ancestors.at(-1);
			if (parent?.subcolumns?.some((d) => d.pinned !== def.pinned)) return {
				...def,
				ancestors: ancestors.toSpliced(-1, 1, {
					...parent,
					subcolumns: parent.subcolumns.filter((d) => d.pinned === def.pinned)
				})
			};
		}
		return {
			...def,
			ancestors
		};
	}).flat();
}
function pinColumns(columnDefs) {
	return columnDefs.toSorted((a, b) => a.pinned === b.pinned ? 0 : a.pinned === "start" ? -1 : a.pinned === "end" ? 1 : a.pinned === void 0 && b.pinned === "start" ? 1 : a.pinned === void 0 && b.pinned === "end" ? -1 : 0);
}
function getColumnDepth(leafColumns) {
	return leafColumns.reduce((depth, leafColumn) => {
		return Math.max(depth, leafColumn.ancestors.length + 1);
	}, 1);
}
function getColumnPositions(leafColumns, columnDepth) {
	const positions = /* @__PURE__ */ new WeakMap();
	let columnIndex = 1;
	let pinnedIndex = 1;
	let pinned;
	for (let def of leafColumns) {
		if (columnIndex > 1 && pinned !== def.pinned) pinnedIndex = 1;
		for (let i = 0; i < def.ancestors.length; i++) {
			const ancestor = def.ancestors[i];
			if (!ancestor) continue;
			const lineage = def.ancestors.slice(0, i);
			if (!positions.get(ancestor)) positions.set(ancestor, {
				ancestors: lineage,
				columnIndex,
				columnIndexEnd: columnIndex + (ancestor.subcolumns?.length ?? 0),
				field: ancestor.field,
				depth: i + 1,
				level: i,
				pinnedIndex,
				pinnedIndexEnd: pinnedIndex + (ancestor.subcolumns?.length ?? 0),
				subcolumnIndex: lineage.at(-1)?.subcolumns?.findIndex((d) => d.field === ancestor.field) ?? 0
			});
		}
		positions.set(def, {
			ancestors: def.ancestors,
			columnIndex,
			columnIndexEnd: columnIndex,
			depth: columnDepth,
			field: def.field,
			level: def.ancestors.length,
			pinnedIndex,
			pinnedIndexEnd: pinnedIndex + 1,
			subcolumnIndex: def.ancestors.at(-1)?.subcolumns?.findIndex((d) => d.field === def.field) ?? 0
		});
		pinned = def.pinned;
		pinnedIndex++;
		columnIndex++;
	}
	return positions;
}
function getColumnWidths(leafColumns) {
	return leafColumns.map((columnDef) => {
		if (columnDef.width) return `${Math.max(columnDef.width, columnDef.minWidth)}px`;
		else return `${DEFAULT_COLUMN_WIDTH}px`;
	}).join(" ");
}
function getGridCanvasWidth(leafColumns, columnGap) {
	const endBoundary = getColumnEndBoundary(leafColumns.length - 1, leafColumns, columnGap);
	return endBoundary ? `${endBoundary}px` : "auto";
}
function getColumnEndBoundary(colIdx, leafColumns, columnGap) {
	const startBoundary = getColumnStartBoundary(colIdx + 1, leafColumns, columnGap);
	if (startBoundary === null) return null;
	return startBoundary - columnGap;
}
function getColumnStartBoundary(colIdx, leafColumns, columnGap) {
	const totalColumnWidths = leafColumns?.slice(0, colIdx).map((col) => Number.isInteger(col.width) ? col.width : null).reduce((a, b) => a === null || b === null ? null : a + b, 0);
	if (totalColumnWidths === null || totalColumnWidths === void 0) return null;
	return totalColumnWidths + colIdx * columnGap;
}
function getPinnedColumnsOffset(leafColumns, columnGap) {
	if (leafColumns.length === 0) return 0;
	const columnWidths = leafColumns.reduce((widths, column) => widths + column.width, 0);
	return columnGap * leafColumns.length + columnWidths;
}
function validateProps(props) {}
function noop() {}
function invokeDefaultHandler({ defaultHandler }) {
	return defaultHandler();
}
function mergeRefs(...refs) {
	return (instance) => {
		refs.forEach((ref) => {
			if (typeof ref === "function") ref(instance);
			else if (ref != null) ref.current = instance;
		});
	};
}

//#endregion
export { Grid, getLeafColumnsFromColumnDefs as getLeafColumns };