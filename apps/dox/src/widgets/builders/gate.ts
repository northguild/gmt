/**
 * The `data-gate` hook the browser gates read (`scripts/lib/locate.mjs`, `gate("part")`,
 * the selector `[data-gate~="part"]`). A builder writes it only when the caller names a
 * part, so a page that no gate measures carries none. Several parts share one element as
 * a space-separated list, such as `"drawn track"`.
 */
import { html, type SafeHtml } from "./html";

/** Shared by every builder option bag that takes a gate hook. */
export interface GateOption {
  /** The part name (or space-separated names) a browser gate finds this element by. */
  gate?: string;
}

/** `data-gate="…"` for a tag's attribute list, or nothing. */
export function gateAttr(gate: string | undefined): SafeHtml {
  return gate === undefined || gate === "" ? html`` : html`data-gate="${gate}"`;
}
