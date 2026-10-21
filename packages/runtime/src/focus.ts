/**
 * Focus and key routing.
 *
 * Components opt in with `ctx.focus()`, which places them in mount order and
 * subscribes them to focus changes (focusing/blurring dirties the instance, so
 * render functions can draw a focus ring). `ctx.onKey()` receives keys only
 * while focused; `{ global: true }` handlers always run.
 *
 * `Root.dispatchKey` is the single routing point used by `createApp`:
 * focused handlers → global handlers → Tab traversal → application handler.
 * Handlers can stop propagation or prevent the default Tab.
 */
import type { KeyEvent } from "@denotui/terminal";
import type { Instance } from "./engine.ts";

export interface FocusOptions {
  /** Request focus as soon as the instance mounts. */
  autoFocus?: boolean;
}

export interface FocusHandle {
  isFocused(): boolean;
  focus(): void;
  blur(): void;
}

export interface KeyHandlerOptions {
  global?: boolean;
}

export interface KeyInputEvent extends KeyEvent {
  readonly defaultPrevented: boolean;
  readonly propagationStopped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export type KeyHandler = (event: KeyInputEvent) => void;

class DispatchedKey implements KeyInputEvent {
  readonly name: string;
  readonly sequence: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
  readonly text: string | null;
  #defaultPrevented = false;
  #propagationStopped = false;

  constructor(event: KeyEvent) {
    this.name = event.name;
    this.sequence = event.sequence;
    this.ctrl = event.ctrl;
    this.meta = event.meta;
    this.shift = event.shift;
    this.text = event.text;
  }

  get defaultPrevented(): boolean {
    return this.#defaultPrevented;
  }

  get propagationStopped(): boolean {
    return this.#propagationStopped;
  }

  preventDefault(): void {
    this.#defaultPrevented = true;
  }

  stopPropagation(): void {
    this.#propagationStopped = true;
  }
}

interface Registration {
  instance: Instance;
  handle: FocusHandle;
  handlers: Set<KeyHandler>;
}

interface GlobalHandler {
  instance: Instance;
  handler: KeyHandler;
}

export class FocusManager {
  readonly #markDirty: (instance: Instance) => void;
  readonly #registrations: Registration[] = [];
  readonly #globalHandlers: GlobalHandler[] = [];
  #focused: Registration | null = null;

  constructor(markDirty: (instance: Instance) => void) {
    this.#markDirty = markDirty;
  }

  get focusedInstance(): Instance | null {
    return this.#focused?.instance ?? null;
  }

  register(instance: Instance, options: FocusOptions = {}): FocusHandle {
    const existing = this.#find(instance);
    if (existing) return existing.handle;

    const registration: Registration = {
      instance,
      handlers: new Set(),
      handle: {
        isFocused: () => this.#focused === registration,
        focus: () => this.#setFocus(registration),
        blur: () => {
          if (this.#focused === registration) this.#setFocus(null);
        },
      },
    };
    this.#registrations.push(registration);

    if (options.autoFocus === true || this.#focused === null) {
      this.#setFocus(registration);
    }
    return registration.handle;
  }

  unregister(instance: Instance): void {
    const index = this.#registrations.findIndex((entry) =>
      entry.instance === instance
    );
    if (index === -1) {
      this.#removeGlobalHandlers(instance);
      return;
    }

    const [registration] = this.#registrations.splice(index, 1);
    this.#removeGlobalHandlers(instance);
    if (this.#focused !== registration) return;

    this.#focused = null;
    const next = this.#registrations[index] ??
      this.#registrations[index - 1] ??
      null;
    if (next) this.#setFocus(next);
  }

  addHandler(
    instance: Instance,
    handler: KeyHandler,
    global: boolean,
  ): () => void {
    if (global) {
      const entry = { instance, handler };
      this.#globalHandlers.push(entry);
      return () => {
        const index = this.#globalHandlers.indexOf(entry);
        if (index !== -1) this.#globalHandlers.splice(index, 1);
      };
    }

    const registration = this.#find(instance);
    if (!registration) {
      throw new Error(
        "denotui: ctx.onKey() requires ctx.focus() first (or { global: true })",
      );
    }
    registration.handlers.add(handler);
    return () => registration.handlers.delete(handler);
  }

  /** Deliver a key to focused and global handlers; returns the wrapped event. */
  dispatch(event: KeyEvent): KeyInputEvent {
    const wrapped = new DispatchedKey(event);

    if (this.#focused) {
      for (const handler of this.#focused.handlers) {
        handler(wrapped);
        if (wrapped.propagationStopped) break;
      }
    }

    if (!wrapped.propagationStopped) {
      for (const entry of this.#globalHandlers) {
        entry.handler(wrapped);
        if (wrapped.propagationStopped) break;
      }
    }

    return wrapped;
  }

  /** Move focus by `delta` positions, wrapping. Used for Tab/Shift-Tab. */
  move(delta: number): void {
    if (this.#registrations.length === 0) return;
    const current = this.#focused
      ? this.#registrations.indexOf(this.#focused)
      : -1;
    const index = current === -1
      ? (delta >= 0 ? 0 : this.#registrations.length - 1)
      : (current + delta + this.#registrations.length) %
        this.#registrations.length;
    this.#setFocus(this.#registrations[index]);
  }

  #setFocus(next: Registration | null): void {
    if (this.#focused === next) return;
    const previous = this.#focused;
    this.#focused = next;
    if (previous) this.#markDirty(previous.instance);
    if (next) this.#markDirty(next.instance);
  }

  #find(instance: Instance): Registration | undefined {
    return this.#registrations.find((entry) => entry.instance === instance);
  }

  #removeGlobalHandlers(instance: Instance): void {
    for (let index = this.#globalHandlers.length - 1; index >= 0; index--) {
      if (this.#globalHandlers[index].instance === instance) {
        this.#globalHandlers.splice(index, 1);
      }
    }
  }
}
