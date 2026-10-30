/**
 * paintOutput: write the lines a call returned into a `callOutput` already on the page.
 *
 * The output is focusable, so a live countdown that redrew it every second would drop a
 * keyboard reader's focus. This builds the new output with the kit builder, then copies its
 * state and its lines into the one on the page, which stays where it is. `slot` is the element
 * that holds one `callOutput`.
 */
import { raw, setHtml } from "../../builders/html";
import { callOutput, type CallOutputOptions } from "../gnss/call-output";

export function paintOutput(slot: HTMLElement, o: CallOutputOptions): void {
  const target = slot.querySelector("output");
  if (target === null) return;
  const scratch = document.createElement("div");
  setHtml(scratch, callOutput(o));
  const next = scratch.querySelector("output");
  if (next === null) return;
  target.dataset["state"] = next.dataset["state"] ?? "empty";
  if (target.innerHTML !== next.innerHTML) setHtml(target, raw(next.innerHTML));
}
