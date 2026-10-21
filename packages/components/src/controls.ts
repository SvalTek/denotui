/**
 * Interactive components.
 *
 * Components own focus and key handling; state is either controlled by props
 * (`value`/`checked`/`selected` + callbacks) or kept in a frontmatter atom when
 * no controlled prop is supplied. Handlers are registered once in frontmatter.
 */
import { atom } from "nanostores";
import { component, type ComponentType, h } from "@denotui/runtime";
import { Box, Text } from "./builtins.ts";
import { Row } from "./layout.ts";
import { List } from "./data.ts";
import {
  asArray,
  asNumber,
  asString,
  childrenOf,
  hostProps,
  textChildren,
} from "./util.ts";

export const Button: ComponentType = component("Button", (props, ctx) => {
  const focus = ctx.focus({ autoFocus: props.autoFocus === true });
  const press = (): void => {
    const onPress = props.onPress;
    if (typeof onPress === "function") (onPress as () => void)();
  };
  ctx.onKey((event) => {
    if (
      event.name === "return" || event.name === "space" || event.text === " "
    ) {
      press();
      event.preventDefault();
    }
  });

  return () => {
    const focused = focus.isFocused();
    const label = props.label !== undefined
      ? asString(props.label)
      : textChildren(props);
    return h(Box, {
      ...hostProps(props),
      padding: props.padding ?? [0, 1],
      bg: focused ? props.focusBg ?? "blue" : props.bg,
      flexShrink: 0,
    }, [
      h(Text, {
        fg: focused ? props.focusFg ?? "white" : props.fg,
        bold: props.bold !== false,
        dim: props.dim === true,
      }, [label]),
    ]);
  };
});

export const TextInput: ComponentType = component("TextInput", (props, ctx) => {
  const focus = ctx.focus({ autoFocus: props.autoFocus === true });
  const $value = atom(props.value === undefined ? "" : String(props.value));
  const $cursor = atom(0);

  const emit = (next: string, cursor: number): void => {
    $value.set(next);
    $cursor.set(Math.max(0, Math.min(cursor, next.length)));
    const onChange = props.onChange;
    if (typeof onChange === "function") {
      (onChange as (value: string) => void)(next);
    }
  };

  // Controlled mode: follow the prop only when it actually changed. Comparing
  // against the previous prop (not the internal value) avoids reverting a local
  // edit while the parent's update is still in flight.
  let lastValue = props.value === undefined ? undefined : String(props.value);
  ctx.effect(() => {
    if (props.value !== undefined) {
      const next = String(props.value);
      if (next !== lastValue) {
        lastValue = next;
        if (next !== $value.get()) $value.set(next);
      }
    }
    const length = $value.get().length;
    if ($cursor.get() > length) $cursor.set(length);
  });

  ctx.onKey((event) => {
    if (event.ctrl || event.meta) return; // Leave shortcuts to the application.
    const text = $value.get();
    const cursor = $cursor.get();

    if (event.text !== null && event.text.length > 0) {
      emit(
        text.slice(0, cursor) + event.text + text.slice(cursor),
        cursor + event.text.length,
      );
      event.preventDefault();
      return;
    }

    switch (event.name) {
      case "backspace":
        if (cursor > 0) {
          emit(text.slice(0, cursor - 1) + text.slice(cursor), cursor - 1);
        }
        event.preventDefault();
        break;
      case "delete":
        if (cursor < text.length) {
          emit(text.slice(0, cursor) + text.slice(cursor + 1), cursor);
        }
        event.preventDefault();
        break;
      case "left":
        $cursor.set(Math.max(0, cursor - 1));
        event.preventDefault();
        break;
      case "right":
        $cursor.set(Math.min(text.length, cursor + 1));
        event.preventDefault();
        break;
      case "home":
        $cursor.set(0);
        event.preventDefault();
        break;
      case "end":
        $cursor.set(text.length);
        event.preventDefault();
        break;
      case "return": {
        const onSubmit = props.onSubmit;
        if (typeof onSubmit === "function") {
          (onSubmit as (value: string) => void)(text);
        }
        event.preventDefault();
        break;
      }
    }
  });

  return () => {
    const focused = focus.isFocused();
    const text = ctx.use($value);
    const cursor = ctx.use($cursor);
    const mask = props.mask === undefined ? null : String(props.mask);
    const display = (value: string): string =>
      mask === null ? value : mask.repeat(Math.max(0, value.length));

    if (text === "" && !focused) {
      return h(Text, { dim: true, fg: props.fg }, [
        asString(props.placeholder, ""),
      ]);
    }
    if (!focused) return h(Text, { fg: props.fg }, [display(text)]);

    if (text === "") {
      const placeholder = asString(props.placeholder, "");
      return h(Row, { gap: 0 }, [
        h(Text, {
          inverse: true,
          fg: props.cursorColor ?? props.fg,
          bg: props.cursorBg,
        }, [" "]),
        placeholder === ""
          ? null
          : h(Text, { dim: true, fg: props.placeholderColor }, [placeholder]),
      ]);
    }

    const before = display(text.slice(0, cursor));
    const current = text[cursor];
    const after = display(text.slice(cursor + 1));
    return h(Row, { gap: 0 }, [
      h(Text, { fg: props.fg }, [before]),
      h(Text, {
        inverse: true,
        fg: props.cursorColor ?? props.fg,
        bg: props.cursorBg,
      }, [current === undefined ? " " : display(current)]),
      h(Text, { fg: props.fg }, [after]),
    ]);
  };
});

export const Select: ComponentType = component("Select", (props, ctx) => {
  const focus = ctx.focus({ autoFocus: props.autoFocus === true });
  const $selected = atom(asNumber(props.selected, 0));
  const itemsOf = (): unknown[] => asArray(props.items ?? [], "<Select> items");

  let lastSelected = typeof props.selected === "number" ? props.selected : null;
  ctx.effect(() => {
    const length = itemsOf().length;
    const requested = typeof props.selected === "number"
      ? props.selected
      : null;
    if (requested !== null && requested !== lastSelected) {
      lastSelected = requested;
      const clamped = length === 0
        ? 0
        : Math.max(0, Math.min(requested, length - 1));
      if (clamped !== $selected.get()) $selected.set(clamped);
    } else if (length > 0 && $selected.get() >= length) {
      $selected.set(length - 1);
    }
  });

  const move = (next: number, commit: boolean): void => {
    const items = itemsOf();
    if (items.length === 0) return;
    const index = ((next % items.length) + items.length) % items.length;
    const previous = $selected.get();
    $selected.set(index);
    const onChange = props.onChange;
    if (index !== previous && typeof onChange === "function") {
      (onChange as (item: unknown, index: number) => void)(
        items[index],
        index,
      );
    }
    if (commit) {
      const onSelect = props.onSelect;
      if (typeof onSelect === "function") {
        (onSelect as (item: unknown, index: number) => void)(
          items[index],
          index,
        );
      }
    }
  };

  ctx.onKey((event) => {
    if (event.name === "up" || event.name === "k") {
      move($selected.get() - 1, false);
      event.preventDefault();
    } else if (event.name === "down" || event.name === "j") {
      move($selected.get() + 1, false);
      event.preventDefault();
    } else if (event.name === "home") {
      move(0, false);
      event.preventDefault();
    } else if (event.name === "end") {
      move(itemsOf().length - 1, false);
      event.preventDefault();
    } else if (event.name === "return") {
      move($selected.get(), true);
      event.preventDefault();
    }
  });

  return () =>
    h(List, {
      items: itemsOf(),
      selected: ctx.use($selected),
      focused: focus.isFocused(),
      marker: props.marker,
      markerColor: props.markerColor,
      gap: props.gap,
    }, childrenOf(props));
});

export const Checkbox: ComponentType = component("Checkbox", (props, ctx) => {
  const focus = ctx.focus({ autoFocus: props.autoFocus === true });
  const $checked = atom(props.checked === true);

  let lastChecked = typeof props.checked === "boolean" ? props.checked : null;
  ctx.effect(() => {
    const next = typeof props.checked === "boolean" ? props.checked : null;
    if (next !== null && next !== lastChecked) {
      lastChecked = next;
      if (next !== $checked.get()) $checked.set(next);
    }
  });

  const toggle = (): void => {
    const next = !$checked.get();
    $checked.set(next);
    const onChange = props.onChange;
    if (typeof onChange === "function") {
      (onChange as (checked: boolean) => void)(next);
    }
  };

  ctx.onKey((event) => {
    if (
      event.name === "space" || event.name === "return" || event.text === " "
    ) {
      toggle();
      event.preventDefault();
    }
  });

  return () => {
    const focused = focus.isFocused();
    const checked = ctx.use($checked);
    return h(Row, { gap: 1 }, [
      h(Text, {
        inverse: focused,
        bold: checked,
        fg: props.color ?? (checked ? "green" : null),
      }, [checked ? "[x]" : "[ ]"]),
      h(Text, { fg: props.labelColor }, [
        props.label !== undefined ? String(props.label) : textChildren(props),
      ]),
    ]);
  };
});

export const Toggle: ComponentType = component("Toggle", (props, ctx) => {
  const focus = ctx.focus({ autoFocus: props.autoFocus === true });
  const $on = atom(props.on === true || props.checked === true);

  const controlledValue = (): boolean | null =>
    typeof props.on === "boolean"
      ? props.on
      : typeof props.checked === "boolean"
      ? props.checked
      : null;
  let lastOn = controlledValue();
  ctx.effect(() => {
    const next = controlledValue();
    if (next !== null && next !== lastOn) {
      lastOn = next;
      if (next !== $on.get()) $on.set(next);
    }
  });

  const toggle = (): void => {
    const next = !$on.get();
    $on.set(next);
    const onChange = props.onChange;
    if (typeof onChange === "function") {
      (onChange as (on: boolean) => void)(next);
    }
  };

  ctx.onKey((event) => {
    if (
      event.name === "space" || event.name === "return" || event.text === " "
    ) {
      toggle();
      event.preventDefault();
    }
  });

  return () => {
    const focused = focus.isFocused();
    const on = ctx.use($on);
    return h(Row, { gap: 1 }, [
      h(Text, {
        inverse: focused,
        fg: on ? props.onColor ?? "green" : props.offColor ?? "gray",
      }, [on ? "● on" : "○ off"]),
      h(Text, { fg: props.labelColor }, [
        props.label !== undefined ? String(props.label) : textChildren(props),
      ]),
    ]);
  };
});

export const Tabs: ComponentType = component("Tabs", (props) => () => {
  const tabs = asArray(props.tabs ?? [], "<Tabs> tabs");
  const active = asNumber(props.active, 0);
  return h(
    Row,
    { gap: props.gap ?? 0 },
    tabs.map((tab, index) => {
      const selected = index === active;
      return h(Text, {
        key: `tab:${index}`,
        bg: selected ? props.activeBg ?? "blue" : props.bg,
        fg: selected ? props.activeFg ?? "white" : props.fg,
        bold: selected,
      }, [` ${String(tab)} `]);
    }),
  );
});
