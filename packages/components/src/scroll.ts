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

    function maxScroll(): number | null {
      const viewport = asNumber(props.height, 0);
      const content = asNumber(props.contentHeight, Number.POSITIVE_INFINITY);
      if (viewport <= 0 || !Number.isFinite(content)) return null;
      return Math.max(0, content - viewport);
    }

    function scrollTo(next: number): void {
      const max = maxScroll();
      if (max === null) return;
      const clamped = Math.max(0, Math.min(Math.round(next), max));
      if (clamped === $scroll.get()) return;
      $scroll.set(clamped);
      const onScroll = props.onScroll;
      if (typeof onScroll === "function") {
        (onScroll as (value: number) => void)(clamped);
      }
    }

    let lastScroll = typeof props.scroll === "number" ? props.scroll : null;
    ctx.effect(() => {
      const requested = typeof props.scroll === "number" ? props.scroll : null;
      const max = maxScroll();
      if (requested !== null && requested !== lastScroll) {
        lastScroll = requested;
        const clamped = max === null
          ? Math.max(0, requested)
          : Math.max(0, Math.min(requested, max));
        if (clamped !== $scroll.get()) $scroll.set(clamped);
      } else if (max !== null && $scroll.get() > max) {
        $scroll.set(max);
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
          case "end": {
            const max = maxScroll();
            if (max !== null) scrollTo(max);
            event.preventDefault();
            break;
          }
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
