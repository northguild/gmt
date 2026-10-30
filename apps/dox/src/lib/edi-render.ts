/**
 * The text half of the EDI pictures, shared by the DTM Decoder and the
 * X12 Time Reader: what the calls returned, one line each, and the line a
 * refused call prints.
 */
import { formatValue, type EdiCall } from "./edi-widgets";

/** What the calls returned, one result per line in the order the calls were made. */
export function callResultsText(calls: readonly EdiCall[]): string {
  return calls.map((c) => formatValue(c.result)).join("\n");
}

/** The line a call that gave the library's sentinel prints in the results pane. */
export const NO_SIGNAL_LINE = "NO SIGNAL";
