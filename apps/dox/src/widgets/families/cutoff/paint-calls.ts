/**
 * paintCalls: write the calls a reading made into a code frame already on the page.
 *
 * It updates the `<code>` text and the copy button's text in place, and never replaces the
 * frame, so a keyboard user's focus on the copy button survives the once-a-second redraw of a
 * live countdown. `slot` is the element that holds one `codeFrame`.
 */
import type { EdiCall } from "~/lib/edi-widgets";
import { setHtml } from "../../builders/html";
import type { GmtCopy } from "../../primitives/copy/copy";
import { callLines } from "../gnss/call-lines";

export function paintCalls(slot: HTMLElement, calls: readonly EdiCall[]): void {
  const { code, plain } = callLines(calls);
  const codeEl = slot.querySelector("code");
  if (codeEl !== null) setHtml(codeEl, code);
  const copyEl = slot.querySelector<GmtCopy>("gmt-copy");
  if (copyEl !== null) copyEl.text = plain;
}
