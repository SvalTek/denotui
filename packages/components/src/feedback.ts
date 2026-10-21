/**
 * Feedback components. Spinner is the first stateful component: its timer lives
 * in frontmatter and is started once (guarded effect) rather than restarted on
 * every render.
 */
import { atom } from "nanostores";
import { component, type ComponentType, h } from "@denotui/runtime";
import { Text } from "./builtins.ts";
import { Row } from "./layout.ts";
import { asNumber } from "./util.ts";

type IntervalHandle = Parameters<typeof clearInterval>[0];

const DEFAULT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export const Spinner: ComponentType = component("Spinner", (props, ctx) => {
  const $frame = atom(0);
  const frames = Array.isArray(props.frames) && props.frames.length > 0
    ? props.frames.map((frame) => String(frame))
    : DEFAULT_FRAMES;
  const interval = Math.max(16, Math.round(1000 / asNumber(props.fps, 10)));
  let timer: IntervalHandle | null = null;

  ctx.effect(() => {
    const active = props.active !== false;
    if (active && timer === null) {
      timer = setInterval(() => $frame.set($frame.get() + 1), interval);
    } else if (!active && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  });
  ctx.onCleanup(() => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  });

  return () => {
    const frame = frames[ctx.use($frame) % frames.length];
    const label = props.label !== undefined ? ` ${String(props.label)}` : "";
    return h(Text, { fg: props.color ?? "cyan" }, [`${frame}${label}`]);
  };
});

export const ProgressBar: ComponentType = component(
  "ProgressBar",
  (props) => () => {
    const width = Math.max(1, Math.floor(asNumber(props.width, 20)));
    const max = Math.max(1, asNumber(props.max, 100));
    const value = Math.min(Math.max(asNumber(props.value, 0), 0), max);
    const filled = Math.round((value / max) * width);
    const percent = `${Math.round((value / max) * 100)}%`;
    const children: unknown[] = [];

    if (props.label !== undefined) {
      children.push(
        h(Text, { dim: props.labelDim !== false }, [`${String(props.label)} `]),
      );
    }
    children.push(
      h(Text, { fg: props.filledColor ?? "green" }, ["█".repeat(filled)]),
    );
    children.push(
      h(Text, {
        fg: props.emptyColor ?? "gray",
        dim: true,
      }, ["░".repeat(width - filled)]),
    );
    if (props.showPercent !== false) {
      children.push(h(Text, { dim: true }, [` ${percent}`]));
    }

    return h(Row, { gap: 0 }, children);
  },
);
