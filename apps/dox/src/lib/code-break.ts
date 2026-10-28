/**
 * Where a code token in a table cell may wrap.
 *
 * A code token is never broken inside a word, at a hyphen or at a `.`. A cell's code may wrap in
 * two places only: at a run of spaces, and directly after a `/` that joins two names
 * (`Europe/` `Berlin`, `@northguild/` `gmt/` `zoned`). A `/` is not a break point when it is
 * doubled (`//`), stands alone between spaces, has nothing before or after it, or is followed by
 * a digit (`1/2`; UAX #14 rule LB25 keeps a slash before a number).
 *
 * `codeBreakHtml` and `codeBreakHast` wrap each piece in `<span class="gmt-cw">`, which the
 * stylesheet sets to `white-space: nowrap`, and put a `<wbr>` after each joining `/`. The code
 * element carries `gmt-codebreak` (`white-space: pre-wrap`) so the spaces between pieces wrap
 * and keep their width. Text with one piece comes back unchanged, so a short token keeps the
 * plain `nowrap` code rule.
 *
 * A leaf with no imports besides `escapeHtml`, so a widget or a rehype plugin can use it.
 */
import { escapeHtml } from "./inline-code-html";

/** The class on the code element that has break points. */
export const CODE_BREAK_CLASS = "gmt-codebreak";
/** The class on each unbreakable piece. */
export const CODE_PIECE_CLASS = "gmt-cw";

type Part =
  | { kind: "space"; text: string }
  | { kind: "piece"; text: string; wbrAfter: boolean };

/** True when a break is allowed between `text[index]` (a `/`) and the character after it. */
function breaksAfterSlash(text: string, index: number): boolean {
  const before = text[index - 1];
  const after = text[index + 1];
  if (before === undefined || after === undefined) return false;
  if (before === " " || before === "/") return false;
  return after !== " " && after !== "/" && !/\d/.test(after);
}

function parts(text: string): Part[] {
  const out: Part[] = [];
  let current = "";
  const flush = (wbrAfter: boolean): void => {
    if (current !== "") out.push({ kind: "piece", text: current, wbrAfter });
    current = "";
  };
  for (let i = 0; i < text.length;) {
    if (text[i] === " ") {
      flush(false);
      let end = i;
      while (text[end] === " ") end += 1;
      out.push({ kind: "space", text: text.slice(i, end) });
      i = end;
      continue;
    }
    current += text[i];
    if (text[i] === "/" && breaksAfterSlash(text, i)) flush(true);
    i += 1;
  }
  flush(false);
  return out;
}

/** The unbreakable pieces of `text`, in order, without the spaces between them. */
export function codeBreakPieces(text: string): string[] {
  return parts(text)
    .filter((part) => part.kind === "piece")
    .map((part) => part.text);
}

/** Escaped HTML for `text`, each piece in a `gmt-cw` span; `text` unchanged when it has one. */
export function codeBreakHtml(text: string): string {
  if (codeBreakPieces(text).length < 2) return escapeHtml(text);
  return parts(text)
    .map((part) =>
      part.kind === "space"
        ? part.text
        : `<span class="${CODE_PIECE_CLASS}">${escapeHtml(part.text)}</span>${part.wbrAfter ? "<wbr>" : ""}`,
    )
    .join("");
}

export interface HastText {
  type: "text";
  value: string;
}
export interface HastElement {
  type: "element";
  tagName: string;
  properties: Record<string, unknown>;
  children: (HastText | HastElement)[];
}

/** The same markup as `codeBreakHtml`, as hast children. */
export function codeBreakHast(text: string): (HastText | HastElement)[] {
  if (codeBreakPieces(text).length < 2) return [{ type: "text", value: text }];
  const out: (HastText | HastElement)[] = [];
  for (const part of parts(text)) {
    if (part.kind === "space") {
      out.push({ type: "text", value: part.text });
      continue;
    }
    out.push({
      type: "element",
      tagName: "span",
      properties: { className: [CODE_PIECE_CLASS] },
      children: [{ type: "text", value: part.text }],
    });
    if (part.wbrAfter) {
      out.push({
        type: "element",
        tagName: "wbr",
        properties: {},
        children: [],
      });
    }
  }
  return out;
}

/** `gmt-codebreak` for text that has break points, `undefined` for text that has none. */
export const codeBreakClass = (text: string): string | undefined =>
  codeBreakPieces(text).length > 1 ? CODE_BREAK_CLASS : undefined;
