/**
 * Terminal session: alternate screen, cursor visibility, frame output and
 * resize polling.
 *
 * The writer and size source are injectable so the session can be driven
 * headlessly in tests. Size is polled (not signal-driven) because SIGWINCH is
 * not available on Windows; the poll is cheap and only notifies on change.
 */
import {
  CLEAR_SCREEN,
  ENTER_ALT_SCREEN,
  EXIT_ALT_SCREEN,
  HIDE_CURSOR,
  RESET,
  SHOW_CURSOR,
} from "./ansi.ts";

/** Deno returns a number, Node-compatible typings return Timeout. */
type IntervalHandle = Parameters<typeof clearInterval>[0];

export interface TerminalSize {
  columns: number;
  rows: number;
}

export interface FrameWriter {
  writeSync(data: Uint8Array): number;
}

export interface ScreenOptions {
  writer?: FrameWriter;
  size?: () => TerminalSize;
  /** Use the alternate screen buffer (default true). */
  altScreen?: boolean;
  /** Resize poll interval in milliseconds (default 200). */
  resizePollMs?: number;
}

function defaultSize(): TerminalSize {
  try {
    const { columns, rows } = Deno.consoleSize();
    return { columns, rows };
  } catch {
    return { columns: 80, rows: 24 };
  }
}

export class Screen {
  readonly #writer: FrameWriter;
  readonly #provideSize: () => TerminalSize;
  readonly #altScreen: boolean;
  readonly #pollMs: number;
  readonly #encoder = new TextEncoder();
  readonly #listeners = new Set<(size: TerminalSize) => void>();
  #size: TerminalSize;
  #timer: IntervalHandle | null = null;
  #started = false;

  constructor(options: ScreenOptions = {}) {
    this.#writer = options.writer ?? {
      writeSync: (data) => Deno.stdout.writeSync(data),
    };
    this.#provideSize = options.size ?? defaultSize;
    this.#altScreen = options.altScreen ?? true;
    this.#pollMs = options.resizePollMs ?? 200;
    this.#size = this.#provideSize();
  }

  get size(): TerminalSize {
    return this.#size;
  }

  get started(): boolean {
    return this.#started;
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    const prefix = this.#altScreen ? ENTER_ALT_SCREEN + CLEAR_SCREEN : "";
    this.write(prefix + HIDE_CURSOR);
    this.#timer = setInterval(() => this.checkResize(), this.#pollMs);
  }

  stop(): void {
    if (!this.#started) return;
    this.#started = false;
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    const suffix = this.#altScreen ? EXIT_ALT_SCREEN : "";
    this.write(RESET + SHOW_CURSOR + suffix);
  }

  write(frame: string): void {
    if (frame === "") return;
    const bytes = this.#encoder.encode(frame);
    let offset = 0;
    while (offset < bytes.length) {
      const written = this.#writer.writeSync(bytes.subarray(offset));
      if (written <= 0) break;
      offset += written;
    }
  }

  onResize(listener: (size: TerminalSize) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Poll the terminal size now; notifies listeners when it changed. */
  checkResize(): void {
    const next = this.#provideSize();
    if (next.columns === this.#size.columns && next.rows === this.#size.rows) {
      return;
    }
    this.#size = next;
    for (const listener of this.#listeners) listener(next);
  }
}
