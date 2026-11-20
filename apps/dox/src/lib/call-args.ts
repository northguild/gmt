/**
 * callArgs: `[html, plain]` for `renderCallLine`, the arguments of a real call.
 *
 * The html has a `<wbr>` after the `(` that opens the arguments and after each `, `, so a call in
 * a narrow cell breaks at those seams, and a string (`codeString`) keeps its dates whole. `plain`
 * is the text a copy button copies. It lives apart from `punctuality-widgets` because the html
 * half reaches widget CSS, which WebMCP code must not.
 */
import { codeString } from "~/widgets/builders/code-string";
import { callArgsPlain, renderValue } from "./punctuality-widgets";

const SEAM = ", <wbr />";

export function callArgs(args: readonly unknown[]): [string, string] {
  const htmlStr = (s: string) => codeString(s).toString();
  return [
    args.length === 0
      ? ""
      : `<wbr />${args.map((a) => renderValue(a, htmlStr, SEAM)).join(SEAM)}`,
    callArgsPlain(args),
  ];
}
