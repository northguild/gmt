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
import { escapeAttr } from "./widget-ui";

export interface DataCredit {
  readonly label: string;
  readonly parts: readonly (string | { text: string; href: string })[];
}

/** The timezone-boundary-builder release the boundary files come from (see `built.md` § Boundary data). */
export const TBB_TAG = "2026e";

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

export const EARTH_IMAGERY: DataCredit = {
  label: "Earth imagery",
  parts: ["NASA Earth Observatory (Blue Marble Next Generation)."],
};

const ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false">' +
  '<circle cx="12" cy="12" r="9.25"/><path d="M12 11v5.5"/><circle cx="12" cy="7.75" r=".5" fill="currentColor"/></svg>';

function renderPart(part: DataCredit["parts"][number]): string {
  if (typeof part === "string") return escapeAttr(part);
  return `<a href="${escapeAttr(part.href)}" rel="noopener">${escapeAttr(part.text)}</a>`;
}

/** `stack`: the button is one of a control stack and takes the stack's button styling.
 *  `corner`: a glass square in the corner of a drawing. */
export type DataCreditsPlacement = "stack" | "corner";

/**
 * The info button and its popover, as one string. `""` for an empty list, so a drawing with
 * nothing to credit gets no button. `id` must be unique in the document: two mounts of one drawing
 * (the page's and the chat's) each pass their own prefix.
 */
export function renderDataCreditsHtml(
  credits: readonly DataCredit[],
  opts: { id: string; placement: DataCreditsPlacement },
): string {
  if (credits.length === 0) return "";
  const id = escapeAttr(opts.id);
  const placement = escapeAttr(opts.placement);
  const rows = credits
    .map(
      (c) =>
        `<dt>${escapeAttr(c.label)}</dt><dd>${c.parts.map(renderPart).join("")}</dd>`,
    )
    .join("");
  return (
    `<button type="button" class="gmt-data-credits-button" data-placement="${placement}" popovertarget="${id}" aria-label="Data credits" aria-expanded="false">${ICON}</button>` +
    `<div id="${id}" class="gmt-data-credits-panel gmt-glass" data-placement="${placement}" popover><dl>${rows}</dl></div>`
  );
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
      if (!(panel instanceof HTMLElement) || !panel.classList.contains("gmt-data-credits-panel"))
        return;
      const open = (event as ToggleEvent).newState === "open";
      for (const button of document.querySelectorAll(`[popovertarget="${CSS.escape(panel.id)}"]`))
        button.setAttribute("aria-expanded", String(open));
    },
    true,
  );
}
