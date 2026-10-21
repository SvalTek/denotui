/**
 * Data display: selectable-style lists (presentational), tables and key/value
 * grids. These measure text with the same width rules as layout, so columns line
 * up with wide characters.
 */
import { component, type ComponentType, h } from "@denotui/runtime";
import { Text } from "./builtins.ts";
import { Column, Row } from "./layout.ts";
import {
  asArray,
  asNumber,
  itemKey,
  labelOf,
  padEnd,
  padStart,
  renderChild,
  truncate,
} from "./util.ts";

export const List: ComponentType = component("List", (props) => () => {
  const items = asArray(props.items ?? [], "<List> items");
  const selected = asNumber(props.selected, -1);
  const marker = props.marker !== undefined ? String(props.marker) : "❯";
  const render = renderChild(props);
  const focused = props.focused === true;
  const markerColor = props.markerColor ??
    (focused ? "brightCyan" : "gray");

  const rows = items.map((item, index) => {
    const isSelected = index === selected;
    const content = render !== null
      ? (render as (
        item: unknown,
        index: number,
        selected: boolean,
      ) => unknown)(
        item,
        index,
        isSelected,
      )
      : h(Text, { bold: isSelected }, [labelOf(item)]);
    return h(Row, { key: itemKey(item, index), gap: 0 }, [
      h(Text, { fg: isSelected ? markerColor : null }, [
        isSelected ? `${marker} ` : "  ",
      ]),
      content,
    ]);
  });

  return h(Column, { gap: props.gap ?? 0 }, rows);
});

interface ColumnSpec {
  key: string;
  title: string;
  width: number | null;
  align: "left" | "right";
}

function readColumns(value: unknown): ColumnSpec[] {
  return asArray(value, "<Table> columns").map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new TypeError(`denotui: <Table> column ${index} must be an object`);
    }
    const key = "key" in entry ? String(entry.key) : String(index);
    const title = "title" in entry ? String(entry.title) : key;
    const width = "width" in entry && typeof entry.width === "number"
      ? Math.max(1, Math.floor(entry.width))
      : null;
    const align = "align" in entry && entry.align === "right"
      ? "right"
      : "left";
    return { key, title, width, align };
  });
}

function cellValue(row: unknown, key: string): string {
  if (typeof row !== "object" || row === null || !(key in row)) return "";
  // `key in row` established the property exists; the row is a plain record.
  const record: Record<string, unknown> = row as Record<string, unknown>;
  const value = record[key];
  return value === undefined || value === null ? "" : String(value);
}

export const Table: ComponentType = component("Table", (props) => () => {
  const columns = readColumns(props.columns);
  const rows = asArray(props.rows ?? [], "<Table> rows");
  const gap = Math.max(0, Math.floor(asNumber(props.gap, 1)));
  const header = props.header !== false;

  const widths = columns.map((column) => {
    let width = column.width ?? Math.max(1, column.title.length);
    if (column.width === null) {
      for (const row of rows) {
        width = Math.max(width, cellValue(row, column.key).length);
      }
    }
    return width;
  });

  const format = (text: string, index: number): string => {
    const width = widths[index];
    const clipped = truncate(text, width);
    return columns[index].align === "right"
      ? padStart(clipped, width)
      : padEnd(clipped, width);
  };

  const children: unknown[] = [];
  if (header) {
    children.push(
      h(
        Row,
        { gap },
        columns.map((column, index) =>
          h(Text, {
            key: `head:${column.key}`,
            bold: props.headerBold !== false,
            fg: props.headerColor,
          }, [format(column.title, index)])
        ),
      ),
    );
  }
  rows.forEach((row, rowIndex) => {
    children.push(
      h(
        Row,
        { key: `row:${rowIndex}`, gap },
        columns.map((column, index) =>
          h(Text, { fg: props.cellColor }, [
            format(cellValue(row, column.key), index),
          ])
        ),
      ),
    );
  });

  return h(Column, { gap: props.rowGap ?? 0 }, children);
});

function keyValuePairs(value: unknown): Array<[string, string]> {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (typeof entry !== "object" || entry === null) return ["", ""];
      const label = "label" in entry ? String(entry.label) : "";
      const content = "value" in entry ? String(entry.value) : "";
      return [label, content];
    });
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).map(([label, content]) => [
      label,
      String(content),
    ]);
  }
  throw new TypeError("denotui: <KeyValue> items must be an array or object");
}

export const KeyValue: ComponentType = component("KeyValue", (props) => () => {
  const pairs = keyValuePairs(props.items ?? {});
  const labelWidth = pairs.reduce(
    (width, [label]) => Math.max(width, label.length),
    0,
  );
  return h(
    Column,
    { gap: props.gap ?? 0 },
    pairs.map(([label, value], index) =>
      h(Row, { key: `kv:${index}`, gap: props.separatorGap ?? 1 }, [
        h(Text, { dim: true, fg: props.labelColor }, [
          padEnd(label, labelWidth),
        ]),
        h(Text, { fg: props.valueColor }, [value]),
      ])
    ),
  );
});
