/**
 * callLines and outputOf: the two halves of a GNSS tool's "what the library returns" section.
 *
 * `callLines` turns the calls a reading made into the code frame's highlighted lines and the
 * plain text its copy button copies. `outputOf` turns the same calls into the lines of a
 * `callOutput`: one result for each call in the order they were made. A failed reading
 * replaces only the calls that gave `null` or `""` with NO SIGNAL; when none did, or every
 * one did, the pane is the whole-pane NO SIGNAL.
 */
import { callArgs, formatValue } from "~/lib/punctuality-widgets";
import { NO_SIGNAL_LINE } from "~/lib/edi-render";
import type { EdiCall } from "~/lib/edi-widgets";
import { codeSpan } from "~/lib/widget-ui";
import { raw, type SafeHtml } from "../../builders/html";
import type { CallOutputLine } from "./call-output";

interface CallLines {
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
  if (refusals === 0) {
    return { state: "sentinel", lines: [{ text: NO_SIGNAL_LINE, lost: true }] };
  }
  const lines = calls.map((c): CallOutputLine =>
    refused(c) ? { text: NO_SIGNAL_LINE, lost: true } : live(c),
  );
  return { state: refusals === calls.length ? "sentinel" : "live", lines };
}
