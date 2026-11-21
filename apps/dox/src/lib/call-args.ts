/**
 * The arguments of a real call, as `[html, plain]`, in the two places a widget prints a call.
 *
 * `frameCallArgs` is for a code frame (`codeFrame`, a `pre`): the line scrolls sideways and never
 * wraps, so the html has no break points. Chromium breaks at a `<wbr>` even under
 * `white-space: pre`, so a seam left in a frame's code would wrap it there and nowhere else.
 *
 * `cellCallArgs` is for a cell or card that wraps: the html has a `<wbr>` after the `(` that opens
 * the arguments and after each `, `, and a string (`codeString`) keeps its dates whole.
 *
 * `plain` is the text a copy button copies, the same for both. This lives apart from
 * `punctuality-widgets` because the cell html reaches widget CSS, which WebMCP code must not.
 */
import { codeString } from "~/widgets/builders/code-string";
import { callArgsPlain, renderValue } from "./punctuality-widgets";
import { codeSpan } from "./widget-ui";

const SEAM = ", <wbr />";

export function frameCallArgs(args: readonly unknown[]): [string, string] {
  const htmlStr = (s: string) => codeSpan("str", JSON.stringify(s));
  return [
    args.map((a) => renderValue(a, htmlStr)).join(", "),
    callArgsPlain(args),
  ];
}

export function cellCallArgs(args: readonly unknown[]): [string, string] {
  const htmlStr = (s: string) => codeString(s).toString();
  return [
    args.length === 0
      ? ""
      : `<wbr />${args.map((a) => renderValue(a, htmlStr, SEAM)).join(SEAM)}`,
    callArgsPlain(args),
  ];
}
