/**
 * A small JavaScript/TypeScript scanner shared by two compile-time jobs:
 *
 *  - rewriting reactive reads in template expressions (`$foo` -> `ctx.use($foo)`),
 *  - locating top-level `import` declarations in frontmatter.
 *
 * We deliberately do not parse JavaScript. Both jobs only need to know where
 * *code* is, as opposed to strings, template literals, comments and regex
 * literals — which is exactly what a lexer gives us. Sharing one scanner keeps
 * both features on the same notion of "inside a literal".
 *
 * The only heuristic is the classic regex-vs-division decision, based on the
 * previous significant token. It errs toward treating `/` as division after any
 * token that can end an expression, which is what TypeScript/JS lexers do.
 */

export type TokenKind =
  | "ident"
  | "number"
  | "string"
  | "template"
  | "regex"
  | "punct"
  | "comment";

export interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
  /** True when a line break appears between the previous token and this one. */
  nlBefore: boolean;
}

export interface ImportSpan {
  start: number;
  end: number;
}

const KEYWORDS_BEFORE_EXPRESSION: Record<string, true> = {
  return: true,
  typeof: true,
  instanceof: true,
  in: true,
  of: true,
  new: true,
  delete: true,
  void: true,
  throw: true,
  case: true,
  do: true,
  else: true,
  yield: true,
  await: true,
  export: true,
  default: true,
};

/** Multi-character punctuation, longest first, so `===` never lexes as `==`+`=`. */
const PUNCTUATION = [
  ">>>=",
  "===",
  "!==",
  "**=",
  "&&=",
  "||=",
  "??=",
  "<<=",
  ">>=",
  ">>>",
  "...",
  "=>",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "??",
  "?.",
  "++",
  "--",
  "**",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<",
  ">>",
  "|>",
  "::",
];

const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;
const WHITESPACE = /[\s\uFEFF\u00A0]/;

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const length = source.length;
  let index = 0;
  let newlinePending = false;
  let previousSignificant: Token | null = null;

  const push = (kind: TokenKind, start: number, end: number): void => {
    if (end <= start) return;
    const token: Token = {
      kind,
      text: source.slice(start, end),
      start,
      end,
      nlBefore: newlinePending,
    };
    newlinePending = false;
    tokens.push(token);
    if (kind !== "comment") previousSignificant = token;
  };

  const skipTrivia = (): void => {
    while (index < length) {
      const char = source[index];
      if (char === "\n") {
        newlinePending = true;
        index++;
        continue;
      }
      if (WHITESPACE.test(char)) {
        index++;
        continue;
      }
      if (char === "/" && source[index + 1] === "/") {
        const start = index;
        index += 2;
        while (index < length && source[index] !== "\n") index++;
        push("comment", start, index);
        continue;
      }
      if (char === "/" && source[index + 1] === "*") {
        const start = index;
        index += 2;
        while (
          index < length &&
          !(source[index] === "*" && source[index + 1] === "/")
        ) {
          if (source[index] === "\n") newlinePending = true;
          index++;
        }
        index = Math.min(length, index + 2);
        push("comment", start, index);
        continue;
      }
      break;
    }
  };

  const scanString = (quote: string): void => {
    const start = index;
    index++;
    while (index < length) {
      const char = source[index];
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === quote) {
        index++;
        break;
      }
      if (char === "\n") break; // Unterminated string: stop at the line end.
      index++;
    }
    push("string", start, index);
  };

  const scanRegex = (): void => {
    const start = index;
    index++;
    let inClass = false;
    while (index < length) {
      const char = source[index];
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === "[") inClass = true;
      else if (char === "]") inClass = false;
      else if (char === "/" && !inClass) {
        index++;
        break;
      } else if (char === "\n") {
        break;
      }
      index++;
    }
    while (index < length && /[a-z]/i.test(source[index])) index++;
    push("regex", start, index);
  };

  const scanIdent = (): void => {
    const start = index;
    index++;
    while (index < length && IDENT_PART.test(source[index])) index++;
    push("ident", start, index);
  };

  const scanNumber = (): void => {
    const start = index;
    index++;
    while (index < length && /[0-9a-zA-Z_.]/.test(source[index])) index++;
    push("number", start, index);
  };

  const canEndExpression = (token: Token | null): boolean => {
    if (!token) return false;
    if (token.kind === "ident") {
      return KEYWORDS_BEFORE_EXPRESSION[token.text] !== true;
    }
    if (
      token.kind === "number" ||
      token.kind === "string" ||
      token.kind === "template" ||
      token.kind === "regex"
    ) {
      return true;
    }
    if (token.kind === "punct") {
      return [
        ")",
        "]",
        "}",
        "++",
        "--",
      ].includes(token.text);
    }
    return false;
  };

  /** Scans code until EOF, or until the `}` closing a `${ ... }` hole. */
  const scanCode = (stopAtBrace: boolean): void => {
    let depth = 0;
    while (index < length) {
      skipTrivia();
      if (index >= length) return;
      const char = source[index];
      if (stopAtBrace && char === "}" && depth === 0) return;

      if (char === "`") {
        scanTemplate();
        continue;
      }
      if (char === '"' || char === "'") {
        scanString(char);
        continue;
      }
      if (char === "/") {
        if (source[index + 1] === "/" || source[index + 1] === "*") {
          continue; // skipTrivia consumes it on the next iteration.
        }
        if (canEndExpression(previousSignificant)) {
          const start = index;
          index++;
          if (source[index] === "=") index++;
          push("punct", start, index);
          continue;
        }
        scanRegex();
        continue;
      }
      if (IDENT_START.test(char)) {
        scanIdent();
        continue;
      }
      if (/[0-9]/.test(char)) {
        scanNumber();
        continue;
      }

      let matched = "";
      for (const candidate of PUNCTUATION) {
        if (source.startsWith(candidate, index)) {
          matched = candidate;
          break;
        }
      }
      const lengthOfToken = matched.length || 1;
      const text = matched || char;
      if (text === "{" || text === "[" || text === "(") depth++;
      else if (text === "}" || text === "]" || text === ")") depth--;
      push("punct", index, index + lengthOfToken);
      index += lengthOfToken;
    }
  };

  /** Scans a template literal, including `${ ... }` holes (which are code). */
  const scanTemplate = (): void => {
    let chunkStart = index;
    index++; // opening backtick
    while (index < length) {
      const char = source[index];
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === "`") {
        index++;
        push("template", chunkStart, index);
        return;
      }
      if (char === "$" && source[index + 1] === "{") {
        if (index > chunkStart) push("template", chunkStart, index);
        push("punct", index, index + 2);
        index += 2;
        scanCode(true);
        if (source[index] === "}") {
          push("punct", index, index + 1);
          index++;
        }
        chunkStart = index;
        continue;
      }
      if (char === "\n") newlinePending = true;
      index++;
    }
    push("template", chunkStart, length);
  };

  scanCode(false);
  return tokens;
}

function previousSignificant(
  tokens: Token[],
  from: number,
): Token | null {
  for (let i = from - 1; i >= 0; i--) {
    if (tokens[i].kind !== "comment") return tokens[i];
  }
  return null;
}

function nextSignificant(tokens: Token[], from: number): Token | null {
  for (let i = from + 1; i < tokens.length; i++) {
    if (tokens[i].kind !== "comment") return tokens[i];
  }
  return null;
}

const REACTIVE_IDENTIFIER = /^\$[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Rewrites store reads in a template expression. A binding written `$foo` is
 * the Nanostores convention for "this is a store"; reading `$foo` in a template
 * means "read its current value and subscribe the component", so the emitted
 * code becomes `ctx.use($foo)`.
 *
 * Property names (`obj.$foo`), object keys, shorthand properties and text
 * inside literals/comments are left alone.
 */
export function rewriteReactive(source: string): string {
  const tokens = tokenize(source);
  const parts: string[] = [];
  const braceStack: Array<"object" | "block"> = [];
  let cursor = 0;

  const previousSignificantToken = (index: number): Token | null => {
    for (let i = index - 1; i >= 0; i--) {
      if (tokens[i].kind !== "comment") return tokens[i];
    }
    return null;
  };

  const isObjectBrace = (previous: Token | null): boolean => {
    if (!previous) return true;
    if (previous.kind === "ident") {
      return previous.text === "return" || previous.text === "yield";
    }
    if (previous.kind !== "punct") return false;
    return [
      "{",
      ",",
      "(",
      "[",
      ":",
      "=",
      "?",
      "||",
      "&&",
      "??",
      "!",
    ].includes(previous.text);
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === "punct") {
      if (token.text === "{") {
        braceStack.push(
          isObjectBrace(previousSignificantToken(i)) ? "object" : "block",
        );
      } else if (token.text === "${") {
        braceStack.push("block");
      } else if (token.text === "}") {
        braceStack.pop();
      }
      continue;
    }
    if (token.kind !== "ident" || !REACTIVE_IDENTIFIER.test(token.text)) {
      continue;
    }

    const previous = previousSignificant(tokens, i);
    if (previous && (previous.text === "." || previous.text === "?.")) {
      continue;
    }
    const next = nextSignificant(tokens, i);
    const inObject = braceStack[braceStack.length - 1] === "object";
    if (inObject) {
      // Object literal key: `{ $x: ... }` — not a value read.
      if (
        next?.text === ":" &&
        (previous === null || previous.text === "{" || previous.text === ",")
      ) {
        continue;
      }
      // Object literal shorthand: `{ $x }` / `{ a, $x }`.
      if (
        (next?.text === "}" || next?.text === ",") &&
        (previous === null || previous.text === "{" || previous.text === ",")
      ) {
        continue;
      }
    }

    parts.push(source.slice(cursor, token.start), `ctx.use(${token.text})`);
    cursor = token.end;
  }

  parts.push(source.slice(cursor));
  return parts.join("");
}

/**
 * Returns the parameter names of untyped arrow functions in a template
 * expression. Generated modules are TypeScript that Deno type-checks
 * (`deno check`, `deno compile`), and a parameter with no contextual type is an
 * implicit `any`. The compiler cannot infer item types, so typed arrows are the
 * supported authoring form: `(agent: Agent) => ...`.
 *
 * Detection only — the source is never rewritten. Defaults and rest parameters
 * are skipped because TypeScript infers those.
 */
export function findUntypedArrowParams(source: string): string[] {
  const tokens = tokenize(source);
  const names: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind !== "punct" || token.text !== "=>") continue;
    const previous = previousSignificantIndex(tokens, i);
    if (previous < 0) continue;
    const params = tokens[previous];

    if (params.kind === "ident") {
      names.push(params.text);
      continue;
    }
    if (params.text === "}") {
      names.push("{...}");
      continue;
    }
    if (params.text === "]") {
      names.push("[...]");
      continue;
    }
    if (params.text !== ")") continue;

    const open = matchingOpen(tokens, previous);
    if (open < 0) continue;
    collectUntyped(tokens, open, previous, names);
  }

  return names;
}

function collectUntyped(
  tokens: Token[],
  open: number,
  close: number,
  names: string[],
): void {
  const segments: Token[][] = [[]];
  let depth = 0;
  for (let i = open + 1; i < close; i++) {
    const token = tokens[i];
    if (token.kind === "comment") continue;
    if (token.kind === "punct") {
      if (token.text === "(" || token.text === "[" || token.text === "{") {
        depth++;
      } else if (
        token.text === ")" || token.text === "]" || token.text === "}"
      ) {
        depth--;
      } else if (token.text === ":" && depth === 0) {
        return; // Typed list.
      } else if (token.text === "," && depth === 0) {
        segments.push([]);
        continue;
      }
    }
    segments[segments.length - 1].push(token);
  }

  for (const segment of segments) {
    if (!segment.length) continue;
    const first = segment[0];
    if (first.text === "...") continue;
    if (segment.some((token) => token.kind === "punct" && token.text === "=")) {
      continue;
    }
    if (first.kind === "ident") names.push(first.text);
    else if (first.text === "{") names.push("{...}");
    else if (first.text === "[") names.push("[...]");
  }
}

function previousSignificantIndex(tokens: Token[], from: number): number {
  for (let i = from - 1; i >= 0; i--) {
    if (tokens[i].kind !== "comment") return i;
  }
  return -1;
}

function matchingOpen(tokens: Token[], closeIndex: number): number {
  const close = tokens[closeIndex].text;
  const open = close === ")" ? "(" : close === "}" ? "{" : "[";
  let depth = 0;
  for (let i = closeIndex; i >= 0; i--) {
    const token = tokens[i];
    if (token.kind !== "punct") continue;
    if (token.text === close) depth++;
    else if (token.text === open) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Detects JSX in an attribute expression. Astro structures JSX in child
 * expressions but hands attribute expressions back as raw source; emitting that
 * source produces invalid TypeScript. Callers turn this into a compile error and
 * point at the function-child form instead.
 */
export function looksLikeJsx(source: string): boolean {
  const tokens = tokenize(source);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind !== "punct" || token.text !== "<") continue;

    // A comparison (`a<b`) is not JSX. Only treat `<` as JSX where an
    // expression can start.
    const previous = previousSignificant(tokens, i);
    const startsExpression = previous === null ||
      (previous.kind === "punct" &&
        ["(", "[", "{", ",", ":", "=", "=>", "?", "||", "&&", "??", "!"]
          .includes(previous.text)) ||
      (previous.kind === "ident" &&
        ["return", "yield", "default"].includes(previous.text));
    if (!startsExpression) continue;

    const next = nextSignificant(tokens, i);
    if (!next || next.start !== token.end) continue;
    if (next.kind === "ident" || next.text === ">" || next.text === "/") {
      return true;
    }
  }
  return false;
}

export function findImportSpans(source: string): ImportSpan[] {
  const tokens = tokenize(source);
  const spans: ImportSpan[] = [];
  let depth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === "comment") continue;

    if (depth === 0 && token.kind === "ident" && token.text === "import") {
      const previous = previousSignificant(tokens, i);
      const next = nextSignificant(tokens, i);
      if (previous?.text === ".") continue; // `x.import`
      if (next && (next.text === "(" || next.text === ".")) continue;
      const end = findImportEnd(tokens, i);
      spans.push({ start: token.start, end: end.end });
      i = end.tokenIndex;
      continue;
    }

    if (token.kind === "punct") {
      if (token.text === "{" || token.text === "[" || token.text === "(") {
        depth++;
      } else if (
        token.text === "}" || token.text === "]" || token.text === ")"
      ) {
        depth = Math.max(0, depth - 1);
      }
    }
  }

  return spans;
}

function findImportEnd(
  tokens: Token[],
  startIndex: number,
): { end: number; tokenIndex: number } {
  const first = tokens[startIndex];
  let depth = 0;
  let last: Token = first;

  for (let i = startIndex + 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === "comment") continue;

    if (token.nlBefore && depth === 0) {
      const continues = last.text === "import" ||
        last.text === "from" ||
        last.text === "with" ||
        last.text === "assert" ||
        (token.kind === "ident" &&
          (token.text === "from" || token.text === "with" ||
            token.text === "assert")) ||
        token.text === "{" ||
        token.text === "*";
      if (!continues) return { end: last.end, tokenIndex: i - 1 };
    }

    if (token.kind === "punct") {
      if (token.text === "{" || token.text === "[" || token.text === "(") {
        depth++;
      } else if (
        token.text === "}" || token.text === "]" || token.text === ")"
      ) {
        depth = Math.max(0, depth - 1);
      } else if (token.text === ";" && depth === 0) {
        return { end: token.end, tokenIndex: i };
      }
    }
    last = token;
  }

  return { end: last.end, tokenIndex: tokens.length - 1 };
}
