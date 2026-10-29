/**
 * callLines and outputOf: the "calls made" and "what the calls returned" halves of an
 * identifier tool.
 *
 * `callLines` turns the calls a reading made into the code frame's highlighted lines and the
 * plain text its copy button copies. `outputOf` turns the same calls into the lines of a
 * `callOutput`, one result for each call in the order they were made. When some calls were
 * refused (`null` or `""`) and some were not, each refused call reads NO SIGNAL on its own
 * line; when none was refused the whole pane does, and when all were the pane is the lost
 * state.
 */
import type { EdiCall } from "~/lib/edi-widgets";
import { callArgs, formatValue } from "~/lib/punctuality-widgets";
import { codeSpan } from "~/lib/widget-ui";
import { raw, type SafeHtml } from "../../builders/html";
import { CALL_OUTPUT_LOST, type CallOutputLine } from "../gnss/call-output";

export interface CallLines {
  code: SafeHtml;
  plain: string;
}

export function callLines(calls: readonly EdiCall[]): CallLines {
  const lines = calls.map((c) => {
    const [argsHtml, plain] = callArgs(c.args);
    return {
      html: `${codeSpan("fn", c.fn)}(${argsHtml})`,
      plain: `${c.fn}(${plain})`,
    };
  });
  return {
    code: raw(lines.map((l) => l.html).join("\n")),
    plain: lines.map((l) => l.plain).join("\n"),
  };
}

const refused = (call: EdiCall): boolean =>
  call.result === null || call.result === "";

export interface CallOutputState {
  state: "live" | "sentinel" | "empty";
  lines: CallOutputLine[];
}

const lost = (): CallOutputLine => ({ text: CALL_OUTPUT_LOST, lost: true });

export function outputOf(
  status: "ok" | "empty" | "sentinel",
  calls: readonly EdiCall[],
): CallOutputState {
  if (status === "empty") return { state: "empty", lines: [] };
  const live = (c: EdiCall): CallOutputLine => ({
    text: formatValue(c.result),
    lost: false,
  });
  if (status !== "sentinel") return { state: "live", lines: calls.map(live) };
  const refusals = calls.filter(refused).length;
  if (refusals === 0) return { state: "sentinel", lines: [lost()] };
  return {
    state: refusals === calls.length ? "sentinel" : "live",
    lines: calls.map((c) => (refused(c) ? lost() : live(c))),
  };
}
