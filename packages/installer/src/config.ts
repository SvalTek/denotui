/**
 * JSONC-preserving task insertion. Deno's `deno add` already keeps comments on
 * JSONC files; `jsonc-parser` does the same for our edit, so existing tasks and
 * comments survive reinstallation.
 */
import {
  applyEdits,
  modify,
  parse,
  type ParseError,
  printParseErrorCode,
} from "jsonc-parser";

export const BUILD_TASK = "denotui:build";
export const BUILD_COMMAND = "deno run -RW @denotui/compiler/cli compile .";

export interface ConfigUpdate {
  text: string;
  changed: boolean;
}

export function upsertBuildTask(text: string): ConfigUpdate {
  const errors: ParseError[] = [];
  parse(text, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const first = errors[0];
    throw new Error(
      `invalid JSONC: ${
        printParseErrorCode(first.error)
      } at offset ${first.offset}`,
    );
  }

  const edits = modify(text, ["tasks", BUILD_TASK], BUILD_COMMAND, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  });
  const next = applyEdits(text, edits);
  return { text: next, changed: next !== text };
}
