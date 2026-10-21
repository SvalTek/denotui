/**
 * Headless-friendly application loop: runtime commits -> layout -> paint ->
 * diff -> screen.
 *
 * Everything the loop touches (screen, input) is injectable, so the same path
 * can be exercised in tests without a TTY. Resize resets both buffers and does a
 * full repaint; frames are painted synchronously per commit, and the runtime has
 * already coalesced store updates into one commit.
 */
import { layoutTree, paintLayout } from "@denotui/layout";
import {
  CellBuffer,
  diffBuffers,
  Keyboard,
  type KeyEvent,
  Screen,
  type TerminalSize,
} from "@denotui/terminal";
import type { ComponentType } from "./component.ts";
import type { KeyInputEvent } from "./focus.ts";
import { createRoot, type Node, type Root } from "./engine.ts";

export interface AppScreen {
  readonly size: TerminalSize;
  start(): void;
  stop(): void;
  write(frame: string): void;
  onResize(listener: (size: TerminalSize) => void): () => void;
}

export interface AppInput {
  start(onKey: (key: KeyEvent) => void): void;
  stop(): void;
}

export interface AppOptions {
  screen?: AppScreen;
  input?: AppInput;
  onKey?: (event: KeyInputEvent) => void;
  /** Quit on Ctrl-C (default true). */
  exitOnCtrlC?: boolean;
}

export interface App {
  readonly root: Root;
  start(): void;
  stop(): void;
}

export function createApp(
  type: ComponentType,
  props: Record<string, unknown> = {},
  options: AppOptions = {},
): App {
  const root = createRoot();
  const screen: AppScreen = options.screen ?? new Screen();
  const input: AppInput = options.input ?? new Keyboard();

  let front = new CellBuffer(screen.size.columns, screen.size.rows);
  let back = new CellBuffer(screen.size.columns, screen.size.rows);
  let tree: Node | null = null;
  let running = false;
  let started = false;

  let forceFull = false;

  const paint = (): void => {
    if (!running || tree === null) return;
    const size = screen.size;
    if (front.width !== size.columns || front.height !== size.rows) {
      front = new CellBuffer(size.columns, size.rows);
      back = new CellBuffer(size.columns, size.rows);
    }
    back.clear();
    paintLayout(
      back,
      layoutTree(tree, { width: size.columns, height: size.rows }),
    );
    const frame = diffBuffers(front, back, forceFull);
    forceFull = false;
    if (frame !== "") screen.write(frame);
    const previous = front;
    front = back;
    back = previous;
  };

  root.onCommit((document) => {
    tree = document;
    paint();
  });

  screen.onResize(() => {
    // Force a full-cell repaint instead of clearing: the terminal may already
    // have reflowed content, and a clear causes a visible blank frame. Every
    // visible cell (including blanks) is written in one atomic frame.
    front = new CellBuffer(screen.size.columns, screen.size.rows);
    back = new CellBuffer(screen.size.columns, screen.size.rows);
    forceFull = true;
    paint();
  });

  const stop = (): void => {
    if (!started) return;
    started = false;
    running = false;
    input.stop();
    root.unmount();
    screen.stop();
  };

  root.onError = (error) => {
    // Restore the terminal before the process dies. A failure while restoring
    // must not mask the original error.
    try {
      stop();
    } catch {
      // Best effort: continue to surface the original error.
    }
    throw error;
  };

  const handleKey = (key: KeyEvent): void => {
    if (!running) return;
    try {
      const event = root.dispatchKey(key);
      if (!event.propagationStopped) options.onKey?.(event);
      if (
        !event.defaultPrevented && running && options.exitOnCtrlC !== false &&
        event.ctrl && event.name === "c"
      ) {
        stop();
      }
    } catch (error) {
      stop();
      throw error;
    }
  };

  return {
    root,
    start(): void {
      if (started) return;
      started = true;
      running = true;
      try {
        screen.start();
        input.start(handleKey);
        root.mount(type, props);
      } catch (error) {
        stop();
        throw error;
      }
    },
    stop,
  };
}
