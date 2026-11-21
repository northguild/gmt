/**
 * outputOf: the "what the calls returned" half of an identifier tool. The "calls made" half is the
 * shared `callLines` (`../gnss/call-lines`).
 *
 * `outputOf` turns the calls a reading made into the lines of a `callOutput`, one result for each
 * call in the order they were made. When some calls were refused (`null` or `""`) and some were
 * not, each refused call reads NO SIGNAL on its own line; when none was refused the whole pane
 * does, and when all were the pane is the lost state.
 */
import type { EdiCall } from "~/lib/edi-widgets";
import { formatValue } from "~/lib/punctuality-widgets";
import { CALL_OUTPUT_LOST, type CallOutputLine } from "../gnss/call-output";

const refused = (call: EdiCall): boolean =>
  call.result === null || call.result === "";

interface CallOutputState {
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
