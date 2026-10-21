/**
 * Vnode tree -> Yoga tree -> positioned boxes and text runs.
 *
 * Component and fragment nodes are transparent: their children participate in
 * the parent's flex layout. `Box` maps props onto Yoga; `Text` becomes a leaf
 * with a measure function driven by `measure.ts`.
 *
 * Defaults differ from raw Yoga in one place: Box defaults to a column flex
 * direction, which matches how terminal UIs stack content.
 */
import Yoga, {
  Align,
  Display,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  MeasureMode,
  type Node as YogaNode,
  Overflow,
  Wrap,
} from "yoga-layout";
import type { Color, Style } from "@denotui/terminal";
import { readBorder, readColor, readTextStyle } from "./style.ts";
import { splitLines, textWidth, wrapText } from "./measure.ts";
import type {
  BorderPlan,
  LayoutBox,
  LayoutInput,
  LayoutInputHost,
  LayoutInputText,
  LayoutNode,
  LayoutOptions,
  LayoutText,
} from "./types.ts";

const FLEX_DIRECTION: Record<string, FlexDirection> = {
  row: FlexDirection.Row,
  column: FlexDirection.Column,
  "row-reverse": FlexDirection.RowReverse,
  "column-reverse": FlexDirection.ColumnReverse,
};

const JUSTIFY: Record<string, Justify> = {
  start: Justify.FlexStart,
  "flex-start": Justify.FlexStart,
  center: Justify.Center,
  end: Justify.FlexEnd,
  "flex-end": Justify.FlexEnd,
  "space-between": Justify.SpaceBetween,
  "space-around": Justify.SpaceAround,
  "space-evenly": Justify.SpaceEvenly,
};

const ALIGN: Record<string, Align> = {
  auto: Align.Auto,
  start: Align.FlexStart,
  "flex-start": Align.FlexStart,
  center: Align.Center,
  end: Align.FlexEnd,
  "flex-end": Align.FlexEnd,
  stretch: Align.Stretch,
  baseline: Align.Baseline,
  "space-between": Align.SpaceBetween,
  "space-around": Align.SpaceAround,
  "space-evenly": Align.SpaceEvenly,
};

const WRAP: Record<string, Wrap> = {
  nowrap: Wrap.NoWrap,
  "no-wrap": Wrap.NoWrap,
  wrap: Wrap.Wrap,
  "wrap-reverse": Wrap.WrapReverse,
};

const OVERFLOW: Record<string, Overflow> = {
  visible: Overflow.Visible,
  hidden: Overflow.Hidden,
  scroll: Overflow.Scroll,
};

type DimensionProp =
  | "width"
  | "height"
  | "minWidth"
  | "minHeight"
  | "maxWidth"
  | "maxHeight";

const SET_POINT: Record<
  DimensionProp,
  (node: YogaNode, value: number) => void
> = {
  width: (node, value) => node.setWidth(value),
  height: (node, value) => node.setHeight(value),
  minWidth: (node, value) => node.setMinWidth(value),
  minHeight: (node, value) => node.setMinHeight(value),
  maxWidth: (node, value) => node.setMaxWidth(value),
  maxHeight: (node, value) => node.setMaxHeight(value),
};

const SET_PERCENT: Record<
  DimensionProp,
  (node: YogaNode, value: number) => void
> = {
  width: (node, value) => node.setWidthPercent(value),
  height: (node, value) => node.setHeightPercent(value),
  minWidth: (node, value) => node.setMinWidthPercent(value),
  minHeight: (node, value) => node.setMinHeightPercent(value),
  maxWidth: (node, value) => node.setMaxWidthPercent(value),
  maxHeight: (node, value) => node.setMaxHeightPercent(value),
};

interface BuildNode {
  kind: "box" | "text";
  yoga: YogaNode;
  props: Record<string, unknown>;
  /** Text content (only for text nodes). */
  text: string;
  wrap: boolean;
  style: Style | null;
  border: BorderPlan | null;
  clip: boolean;
  scrollX: number;
  scrollY: number;
  children: BuildNode[];
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function percentage(value: string): number | null {
  if (!value.endsWith("%")) return null;
  const parsed = Number.parseFloat(value.slice(0, -1));
  return Number.isFinite(parsed) ? parsed : null;
}

function applyDimension(
  node: YogaNode,
  prop: DimensionProp,
  value: unknown,
): void {
  if (value === undefined || value === null) return;
  if (isNumber(value)) {
    SET_POINT[prop](node, value);
    return;
  }
  if (value === "auto") {
    // min/max dimensions are already auto by default.
    if (prop === "width") node.setWidthAuto();
    else if (prop === "height") node.setHeightAuto();
    return;
  }
  if (typeof value === "string") {
    const percent = percentage(value);
    if (percent !== null) {
      SET_PERCENT[prop](node, percent);
      return;
    }
  }
  throw new TypeError(
    `denotui: invalid ${prop} value ${JSON.stringify(value)}`,
  );
}

type SpacingKind = "padding" | "margin";

const EDGE_NAMES: Record<string, Edge> = {
  top: Edge.Top,
  right: Edge.Right,
  bottom: Edge.Bottom,
  left: Edge.Left,
  horizontal: Edge.Horizontal,
  vertical: Edge.Vertical,
  all: Edge.All,
};

function applySpacing(
  node: YogaNode,
  kind: SpacingKind,
  value: unknown,
): void {
  if (value === undefined || value === null) return;
  const set = (edge: Edge, amount: number): void => {
    if (kind === "padding") node.setPadding(edge, amount);
    else node.setMargin(edge, amount);
  };

  if (isNumber(value)) {
    set(Edge.All, value);
    return;
  }
  if (Array.isArray(value)) {
    const amounts = value.filter(isNumber);
    if (amounts.length !== value.length) {
      throw new TypeError(`denotui: ${kind} must contain numbers`);
    }
    if (amounts.length === 1) set(Edge.All, amounts[0]);
    else if (amounts.length === 2) {
      set(Edge.Vertical, amounts[0]);
      set(Edge.Horizontal, amounts[1]);
    } else if (amounts.length === 4) {
      set(Edge.Top, amounts[0]);
      set(Edge.Right, amounts[1]);
      set(Edge.Bottom, amounts[2]);
      set(Edge.Left, amounts[3]);
    } else {
      throw new TypeError(`denotui: ${kind} accepts 1, 2 or 4 numbers`);
    }
    return;
  }
  if (typeof value === "object") {
    for (const [name, amount] of Object.entries(value)) {
      const edge = EDGE_NAMES[name];
      if (edge === undefined || !isNumber(amount)) {
        throw new TypeError(`denotui: invalid ${kind}.${name}`);
      }
      set(edge, amount);
    }
    return;
  }
  throw new TypeError(
    `denotui: invalid ${kind} value ${JSON.stringify(value)}`,
  );
}

function applyGap(node: YogaNode, value: unknown): void {
  if (value === undefined || value === null) return;
  if (isNumber(value)) {
    node.setGap(Gutter.All, value);
    return;
  }
  if (Array.isArray(value) && value.length === 2 && value.every(isNumber)) {
    node.setGap(Gutter.Row, value[0]);
    node.setGap(Gutter.Column, value[1]);
    return;
  }
  if (typeof value === "object") {
    for (const [name, amount] of Object.entries(value)) {
      if (!isNumber(amount)) {
        throw new TypeError(`denotui: invalid gap.${name}`);
      }
      if (name === "row") node.setGap(Gutter.Row, amount);
      else if (name === "column") node.setGap(Gutter.Column, amount);
      else throw new TypeError(`denotui: unknown gap key "${name}"`);
    }
    return;
  }
  throw new TypeError(`denotui: invalid gap value ${JSON.stringify(value)}`);
}

function applyBoxStyle(node: YogaNode, props: Record<string, unknown>): void {
  const border = readBorder(props);
  if (border !== null) {
    if (border.top) node.setBorder(Edge.Top, 1);
    if (border.right) node.setBorder(Edge.Right, 1);
    if (border.bottom) node.setBorder(Edge.Bottom, 1);
    if (border.left) node.setBorder(Edge.Left, 1);
  }

  const direction = props.direction;
  if (direction === undefined) {
    node.setFlexDirection(FlexDirection.Column);
  } else if (typeof direction === "string") {
    const value = FLEX_DIRECTION[direction];
    if (value === undefined) {
      throw new TypeError(`denotui: invalid direction "${direction}"`);
    }
    node.setFlexDirection(value);
  } else {
    throw new TypeError("denotui: direction must be a string");
  }

  applyEnum(
    node,
    "justifyContent",
    props.justifyContent,
    JUSTIFY,
    (value) => node.setJustifyContent(value),
  );
  applyEnum(
    node,
    "alignItems",
    props.alignItems,
    ALIGN,
    (value) => node.setAlignItems(value),
  );
  applyEnum(
    node,
    "alignSelf",
    props.alignSelf,
    ALIGN,
    (value) => node.setAlignSelf(value),
  );
  applyEnum(
    node,
    "alignContent",
    props.alignContent,
    ALIGN,
    (value) => node.setAlignContent(value),
  );
  applyEnum(node, "wrap", props.wrap, WRAP, (value) => node.setFlexWrap(value));
  applyEnum(
    node,
    "overflow",
    props.overflow,
    OVERFLOW,
    (value) => node.setOverflow(value),
  );
  applyEnum(
    node,
    "display",
    props.display,
    { none: Display.None, flex: Display.Flex },
    (value) => node.setDisplay(value),
  );

  for (const prop of Object.keys(SET_POINT) as DimensionProp[]) {
    applyDimension(node, prop, props[prop]);
  }

  if (isNumber(props.flexGrow)) node.setFlexGrow(props.flexGrow);
  if (isNumber(props.flexShrink)) node.setFlexShrink(props.flexShrink);

  const basis = props.flexBasis;
  if (isNumber(basis)) node.setFlexBasis(basis);
  else if (basis === "auto") node.setFlexBasisAuto();
  else if (typeof basis === "string") {
    const percent = percentage(basis);
    if (percent === null) {
      throw new TypeError(`denotui: invalid flexBasis "${basis}"`);
    }
    node.setFlexBasisPercent(percent);
  } else if (basis !== undefined && basis !== null) {
    throw new TypeError("denotui: flexBasis must be a number, percent or auto");
  }

  applySpacing(node, "padding", props.padding);
  applySpacing(node, "margin", props.margin);
  applyGap(node, props.gap);
}

function applyEnum<T>(
  _node: YogaNode,
  prop: string,
  raw: unknown,
  table: Record<string, T>,
  apply: (value: T) => void,
): void {
  if (raw === undefined || raw === null) return;
  if (typeof raw !== "string" || table[raw] === undefined) {
    throw new TypeError(
      `denotui: invalid ${prop} value ${JSON.stringify(raw)}`,
    );
  }
  apply(table[raw]);
}

function flatten(
  inputs: readonly LayoutInput[],
  out: Array<LayoutInputHost | LayoutInputText>,
): void {
  for (const input of inputs) {
    if (input.kind === "text") out.push(input);
    else if (input.kind === "element") out.push(input);
    else flatten(input.children, out);
  }
}

function collectText(inputs: readonly LayoutInput[]): string {
  const leaves: Array<LayoutInputHost | LayoutInputText> = [];
  flatten(inputs, leaves);
  let text = "";
  for (const leaf of leaves) {
    if (leaf.kind === "text") text += leaf.value;
    else {
      throw new TypeError(
        `denotui: <Text> can only contain text; found <${leaf.type}>`,
      );
    }
  }
  return text;
}

export function layoutTree(
  source: LayoutInput,
  options: LayoutOptions,
): LayoutNode[] {
  const rootYoga = Yoga.Node.create();
  rootYoga.setWidth(options.width);
  rootYoga.setHeight(options.height);
  rootYoga.setFlexDirection(FlexDirection.Column);
  rootYoga.setOverflow(Overflow.Hidden);

  const root: BuildNode = {
    kind: "box",
    yoga: rootYoga,
    props: {},
    text: "",
    wrap: false,
    style: null,
    border: null,
    clip: false,
    scrollX: 0,
    scrollY: 0,
    children: [],
  };

  buildChildren(root, [source]);
  rootYoga.calculateLayout(options.width, options.height, Yoga.DIRECTION_LTR);

  const output: LayoutNode[] = [];
  collect(root, 0, 0, output);
  rootYoga.freeRecursive();
  return output;
}

function buildChildren(
  parent: BuildNode,
  inputs: readonly LayoutInput[],
): void {
  const leaves: Array<LayoutInputHost | LayoutInputText> = [];
  flatten(inputs, leaves);

  let pending = "";
  const flushText = (): void => {
    if (pending === "") return;
    createTextNode(parent, pending, {}, true);
    pending = "";
  };

  for (const leaf of leaves) {
    if (leaf.kind === "text") {
      pending += leaf.value;
      continue;
    }
    flushText();
    if (leaf.type === "text") {
      createTextNode(
        parent,
        collectText(leaf.children),
        leaf.props,
        leaf.props.wrap !== false,
      );
    } else if (leaf.type === "box") {
      parent.children.push(buildBox(leaf));
    } else {
      throw new TypeError(`denotui: unknown intrinsic element <${leaf.type}>`);
    }
  }
  flushText();

  let index = 0;
  for (const child of parent.children) {
    parent.yoga.insertChild(child.yoga, index++);
  }
}

function buildBox(host: LayoutInputHost): BuildNode {
  const yoga = Yoga.Node.create();
  applyBoxStyle(yoga, host.props);
  const node: BuildNode = {
    kind: "box",
    yoga,
    props: host.props,
    text: "",
    wrap: false,
    style: null,
    border: readBorder(host.props),
    clip: host.props.overflow === "hidden",
    scrollX: isNumber(host.props.scrollX) ? host.props.scrollX : 0,
    scrollY: isNumber(host.props.scrollY) ? host.props.scrollY : 0,
    children: [],
  };
  buildChildren(node, host.children);
  return node;
}

function createTextNode(
  parent: BuildNode,
  text: string,
  props: Record<string, unknown>,
  wrap: boolean,
): void {
  const yoga = Yoga.Node.create();
  const node: BuildNode = {
    kind: "text",
    yoga,
    props,
    text,
    wrap,
    style: readTextStyle(props),
    border: null,
    clip: false,
    scrollX: 0,
    scrollY: 0,
    children: [],
  };
  yoga.setMeasureFunc((width, widthMode, height, heightMode) =>
    measureTextNode(text, wrap, width, widthMode, height, heightMode)
  );
  parent.children.push(node);
}

function measureTextNode(
  text: string,
  wrap: boolean,
  width: number,
  widthMode: MeasureMode,
  height: number,
  heightMode: MeasureMode,
): { width: number; height: number } {
  const available = widthMode === MeasureMode.Undefined
    ? null
    : Math.max(0, Math.floor(width));
  if (available === 0) return { width: 0, height: 0 };

  const lines = available !== null && wrap && available > 0
    ? wrapText(text, available)
    : splitLines(text);
  const contentWidth = textWidth(lines);
  const contentHeight = lines.length;

  const resultWidth = widthMode === MeasureMode.Exactly
    ? available ?? contentWidth
    : widthMode === MeasureMode.AtMost
    ? Math.min(contentWidth, available ?? contentWidth)
    : contentWidth;

  const resultHeight = heightMode === MeasureMode.Exactly
    ? Math.max(0, Math.floor(height))
    : heightMode === MeasureMode.AtMost
    ? Math.min(contentHeight, Math.max(0, Math.floor(height)))
    : contentHeight;

  return {
    width: Math.max(0, Math.round(resultWidth)),
    height: Math.max(0, Math.round(resultHeight)),
  };
}

function collect(
  node: BuildNode,
  offsetX: number,
  offsetY: number,
  output: LayoutNode[],
): void {
  for (const child of node.children) {
    const layout = child.yoga.getComputedLayout();
    const x = Math.round(offsetX + layout.left - node.scrollX);
    const y = Math.round(offsetY + layout.top - node.scrollY);
    const width = Math.max(0, Math.round(layout.width));
    const height = Math.max(0, Math.round(layout.height));

    if (child.kind === "text") {
      const lines = width > 0
        ? (child.wrap ? wrapText(child.text, width) : splitLines(child.text))
        : [];
      const text: LayoutText = {
        kind: "text",
        x,
        y,
        width,
        height,
        lines,
        style: child.style,
      };
      output.push(text);
      continue;
    }

    const background: Color | null = readColor(
      child.props.bg,
      "Box bg",
    );
    const box: LayoutBox = {
      kind: "box",
      x,
      y,
      width,
      height,
      background,
      border: child.border,
      clip: child.clip,
      children: [],
    };
    output.push(box);
    collect(child, x, y, box.children);
  }
}
