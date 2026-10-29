/**
 * Registers the kit's custom elements.
 *
 * Call `defineElements()` on the first line of each `mountX()`, never at module top
 * level: SSR and node tests import these modules, and there is no `customElements`
 * there. It is idempotent (a name already registered is skipped) and does nothing
 * without `customElements`. `customElements.define` upgrades elements already in
 * the document, so it does not matter whether `innerHTML` or `mount` ran first.
 */
import { GmtChips } from "./primitives/chips/chips";
import { GmtCombobox } from "./primitives/combobox/combobox";
import { GmtCopy } from "./primitives/copy/copy";
import { GmtGrow } from "./primitives/grow/grow";
import { GmtHandle } from "./primitives/handle/handle";
import { GmtListbox } from "./primitives/listbox/listbox";
import { GmtPreset } from "./primitives/preset/preset";
import { GmtRange } from "./primitives/range/range";
import { GmtReadout } from "./primitives/readout/readout";

export const ELEMENTS = {
  "gmt-range": GmtRange,
  "gmt-handle": GmtHandle,
  "gmt-readout": GmtReadout,
  "gmt-preset": GmtPreset,
  "gmt-chips": GmtChips,
  "gmt-copy": GmtCopy,
  "gmt-grow": GmtGrow,
  "gmt-listbox": GmtListbox,
  "gmt-combobox": GmtCombobox,
} as const satisfies Record<string, CustomElementConstructor>;

export function defineElements(): void {
  if (typeof customElements === "undefined") return;
  for (const [name, ctor] of Object.entries(ELEMENTS)) {
    if (customElements.get(name) === undefined)
      customElements.define(name, ctor);
  }
}
