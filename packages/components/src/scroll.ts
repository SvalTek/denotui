/**
 * Vertical scroll viewport.
 *
 * Clipping and offsets are supported by the layout/paint pipeline: the view is
 * an `overflow: hidden` box whose children are shifted by `scrollY`. Scrolling
 * is controlled by `scroll` or, when `focusable`, by arrow/page keys using
 * `contentHeight` to clamp.
 */
import { atom } from "nanostores";
import { component, type ComponentType, h } from "@denotui/runtime";
import { Box } from "./builtins.ts";
import { asNumber, childrenOf, hostProps } from "./util.ts";

export const ScrollView: ComponentType = component(
  "ScrollView",
  (props, ctx) => {
    const focusable = props.focusable === true || props.autoFocus === true;
    const focus = focusable
      ? ctx.focus({ autoFocus: props.autoFocus === true })
      : null;
    const $scroll = atom(Math.max(0, asNumber(props.scroll, 0)));

    function maxScroll(): number {
      const viewport = asNumber(props.height, 0);
      const content = asNumber(props.contentHeight, Number.POSITIVE_INFINITY);
      if (viewport <= 0 || !Number.isFinite(content)) {
        return Number.MAX_SAFE_INTEGER;
      }
      return Math.max(0, content - viewport);
    }

    function scrollTo(next: number): void {
      const clamped = Math.max(0, Math.min(Math.round(next), maxScroll()));
      if (clamped === $scroll.get()) return;
      $scroll.set(clamped);
      const onScroll = props.onScroll;
      if (typeof onScroll === "function") {
        (onScroll as (value: number) => void)(clamped);
      }
    }

    ctx.effect(() => {
      if (typeof props.scroll === "number" && props.scroll !== $scroll.get()) {
        $scroll.set(Math.max(0, Math.min(props.scroll, maxScroll())));
      } else if ($scroll.get() > maxScroll()) {
        $scroll.set(Math.max(0, maxScroll()));
      }
    });

    if (focus !== null) {
      ctx.onKey((event) => {
        const page = Math.max(1, asNumber(props.height, 10) - 1);
        switch (event.name) {
          case "up":
          case "k":
            scrollTo($scroll.get() - 1);
            event.preventDefault();
            break;
          case "down":
          case "j":
            scrollTo($scroll.get() + 1);
            event.preventDefault();
            break;
          case "pageup":
            scrollTo($scroll.get() - page);
            event.preventDefault();
            break;
          case "pagedown":
            scrollTo($scroll.get() + page);
            event.preventDefault();
            break;
          case "home":
            scrollTo(0);
            event.preventDefault();
            break;
          case "end":
            scrollTo(maxScroll());
            event.preventDefault();
            break;
        }
      });
    }

    return () => {
      const scroll = ctx.use($scroll);
      return h(Box, {
        ...hostProps(props),
        width: props.width ?? "100%",
        height: props.height,
        overflow: "hidden",
        scrollY: scroll,
        direction: props.direction ?? "column",
      }, childrenOf(props));
    };
  },
);
