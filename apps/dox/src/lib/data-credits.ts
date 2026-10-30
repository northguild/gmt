/**
 * The data-credits panel's content and markup (CORE-88).
 *
 * A drawing of third-party data carries an info button on the drawing itself, which opens a small
 * popup; each source is a row, label left, credit right. The globe's button is the fourth of its
 * control stack; a map's is a glass square in the drawing's corner. The pure part lives here so
 * the Astro shells and the plain-DOM mounts (the chat's, which cannot instantiate an Astro
 * component) render the same markup.
 *
 * The time-zone shapes are timezone-boundary-builder's, derived from OpenStreetMap, offered under the
 * ODbL 1.0 (§4.2–4.3: notice; §4.4: share-alike). The wording follows its README § Licenses at the pinned release.
 */
import {
  dataCredits,
  type DataCredit,
  type DataCreditsPlacement,
} from "~/widgets/builders";

export type { DataCredit, DataCreditsPlacement };

/** The timezone-boundary-builder release the boundary files come from (see `built.md` § Boundary data). */
export const TBB_TAG = "2026e";

/** The Natural Earth release the coastlines come from (see `built.md` § Boundary data). */
export const NE_TAG = "v5.1.2";

export const TZ_BOUNDARIES: DataCredit = {
  label: "Time zone boundaries",
  parts: [
    "© ",
    {
      text: "OpenStreetMap contributors",
      href: "https://www.openstreetmap.org/copyright",
    },
    ", ",
    {
      text: "timezone-boundary-builder",
      href: `https://github.com/evansiroky/timezone-boundary-builder/releases/tag/${TBB_TAG}`,
    },
    " (",
    { text: "ODbL", href: "https://opendatacommons.org/licenses/odbl/1-0/" },
    ").",
  ],
};

export const COASTLINES: DataCredit = {
  label: "Coastlines",
  parts: [
    {
      text: "Natural Earth",
      href: "https://www.naturalearthdata.com/",
    },
    " (public domain, ",
    {
      text: NE_TAG,
      href: `https://github.com/nvkelso/natural-earth-vector/releases/tag/${NE_TAG}`,
    },
    ").",
  ],
};

export const EARTH_IMAGERY: DataCredit = {
  label: "Earth imagery",
  parts: ["NASA Earth Observatory (Blue Marble Next Generation)."],
};

/**
 * The info button and its popover, as one string. `""` for an empty list, so a drawing with
 * nothing to credit gets no button. `id` must be unique in the document: two mounts of one drawing
 * (the page's and the chat's) each pass their own prefix.
 */
export function renderDataCreditsHtml(
  credits: readonly DataCredit[],
  opts: { id: string; placement: DataCreditsPlacement },
): string {
  return dataCredits({ credits, ...opts }).toString();
}

let watching = false;

/**
 * Keeps each credits button's `aria-expanded` true to its panel. A `popovertarget` button should
 * expose its expanded state with no attribute, but WebKit's accessibility tree does not (a bare
 * `<button popovertarget>` with its popover open reads as a plain button in Safari 26), so a
 * screen-reader user there would never hear it. The popover's `toggle` event does not bubble, so
 * one capturing listener on the document covers every panel, the chat's mounts included.
 * Idempotent; call it from any client code that puts a credits button on a page.
 */
export function watchDataCredits(): void {
  if (watching || typeof document === "undefined") return;
  watching = true;
  document.addEventListener(
    "toggle",
    (event) => {
      const panel = event.target;
      if (
        !(panel instanceof HTMLElement) ||
        !panel.hasAttribute("data-credits-panel")
      )
        return;
      const open = (event as ToggleEvent).newState === "open";
      for (const button of document.querySelectorAll(
        `[popovertarget="${CSS.escape(panel.id)}"]`,
      ))
        button.setAttribute("aria-expanded", String(open));
    },
    true,
  );
}
