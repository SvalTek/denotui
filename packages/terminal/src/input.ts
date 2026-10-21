/**
 * Keyboard input.
 *
 * Key decoding uses Node's `readline.emitKeypressEvents` (Deno's Node
 * compatibility layer) rather than a hand-written escape-sequence parser: it is
 * battle-tested, handles UTF-8 and CSI/SS3 sequences, and is the same code path
 * Node TUIs use. We normalize its events into a small `KeyEvent` so the input
 * layer can be swapped later (mouse, bracketed paste, a raw decoder) without
 * touching application code.
 */
import { emitKeypressEvents } from "node:readline";
import process from "node:process";
import type { Readable } from "node:stream";

export interface KeyEvent {
  /** Normalized name: `"a"`, `"up"`, `"return"`, `"escape"`, `"tab"`, `"backspace"`… */
  name: string;
  /** Raw sequence that produced the event. */
  sequence: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  /** Printable text, or null for control/function keys. */
  text: string | null;
}

interface RawKeypress {
  name?: string;
  sequence?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export type KeypressStream = Readable & { setRawMode?(mode: boolean): void };

function containsControlChar(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function normalizeKeypress(
  text: string | undefined,
  key: RawKeypress,
): KeyEvent {
  const sequence = key.sequence ?? text ?? "";
  return {
    name: key.name ?? text ?? sequence,
    sequence,
    ctrl: key.ctrl === true,
    meta: key.meta === true,
    shift: key.shift === true,
    text: text && !containsControlChar(text) && !key.ctrl && !key.meta
      ? text
      : null,
  };
}

/** Attach the Node keypress parser to a stream; returns a detach function. */
export function attachKeypress(
  stream: KeypressStream,
  onKey: (key: KeyEvent) => void,
): () => void {
  const listener = (text: string | undefined, key: RawKeypress): void => {
    onKey(normalizeKeypress(text, key));
  };
  emitKeypressEvents(stream);
  stream.on("keypress", listener);
  return () => stream.off("keypress", listener);
}

export interface KeyboardOptions {
  stream?: KeypressStream;
  /** Called when the underlying stream closes. */
  onClose?: () => void;
}

export class Keyboard {
  readonly #stream: KeypressStream;
  #detach: (() => void) | null = null;
  #started = false;

  constructor(options: KeyboardOptions = {}) {
    this.#stream = options.stream ?? process.stdin;
  }

  start(onKey: (key: KeyEvent) => void): void {
    if (this.#started) return;
    this.#started = true;
    this.#stream.setRawMode?.(true);
    this.#stream.resume?.();
    this.#detach = attachKeypress(this.#stream, onKey);
  }

  stop(): void {
    if (!this.#started) return;
    this.#started = false;
    this.#detach?.();
    this.#detach = null;
    this.#stream.setRawMode?.(false);
    this.#stream.pause?.();
  }
}
