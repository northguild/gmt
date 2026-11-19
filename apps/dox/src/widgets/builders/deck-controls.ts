/**
 * The deck's controls and dialogs as markup: pure, with no DOM. `Deck.astro` renders it on the
 * server and the tests render it into jsdom, so both see the same elements.
 * `lib/slides/deck-mount.ts` wires them.
 *
 * - The bar: previous, a dot for each slide and next, then an info button at the bottom right
 *   whose popover holds the overview, help, blank, fullscreen and unlock buttons, each with its key
 *   when it has one, and under them the credits for the sky, the Earth and anything else the deck
 *   shows. The licences ask for the credit wherever the material is shown, and the menu is on every
 *   slide. The unlock button carries both padlocks; the mount renames it Lock once the
 *   slides are unlocked and marks it `data-unlocked`, and the stylesheet shows the padlock that
 *   matches its name. The pager's names are the carousel's to write
 *   (`widgets/builders/carousel.ts`).
 * - The help dialog: the key table (`lib/slides/keys.ts` passes it) as a real table, so it never
 *   drifts from the keys.
 * - The overview dialog: an empty list the mount fills from the slides on the page, with
 *   `overviewItems`.
 * - The unlock dialog: a secret-phrase field with its Unlock button joined to its end, and an alert
 *   for a wrong phrase. There is no `<form>`: the mount listens for the button's click and Enter
 *   in the field.
 */
import { octicon } from "~/lib/octicons";
import { button } from "./button";
import { creditList, type DataCredit } from "./data-credits";
import { html, type SafeHtml } from "./html";
import { field } from "./layout";
import { table } from "./table";
import { textInput } from "./text-input";

/** The info menu's tools: the button id is `deck-<action>`, and its key is that action's first. */
const TOOLS = [
  { action: "overview", label: "Overview" },
  { action: "help", label: "Keys" },
  { action: "blank", label: "Blank" },
  { action: "fullscreen", label: "Fullscreen" },
  { action: "unlock", label: "Unlock" },
] as const;

/** A row of the deck's key table, as the menu reads it. */
interface KeyActionRow {
  action: string;
  keys: readonly string[];
}

/**
 * The end of a tool's row: its key, or for Unlock (which has none) both padlocks. The stylesheet
 * shows the open padlock while the slides are locked and the shut one once they are unlocked, so
 * the icon always pictures what a click does.
 */
function toolEnd(action: string, key: string | undefined): SafeHtml {
  if (key !== undefined) return html`<kbd aria-hidden="true">${key}</kbd>`;
  if (action !== "unlock") return html``;
  return html`<span class="gmt-deck-menu-icon" data-icon="unlock">${octicon("unlock")}</span><span class="gmt-deck-menu-icon" data-icon="lock">${octicon("lock")}</span>`;
}

/** One tool of the info menu, with its key from the key table when the table has one. */
function tool(
  t: (typeof TOOLS)[number],
  keyRows: readonly KeyActionRow[],
): SafeHtml {
  const key = keyRows.find((row) => row.action === t.action)?.keys[0];
  return html`<button type="button" class="gmt-deck-menu-item" id="deck-${t.action}"${key === undefined ? "" : html` aria-keyshortcuts="${key}"`}><span data-deck-tool-label>${t.label}</span>${toolEnd(t.action, key)}</button>`;
}

/** The info menu's credits, under its tools; nothing when the deck shows nothing to credit. */
function menuCredits(credits: readonly DataCredit[]): SafeHtml {
  if (credits.length === 0) return html``;
  return html`<section class="gmt-deck-credits" aria-labelledby="deck-credits-title">
          <h2 class="gmt-deck-credits-title" id="deck-credits-title">Credits</h2>
          ${creditList(credits)}
        </section>`;
}

/**
 * The bar under the stage. Hidden until the mount confirms the stage (`slides.css`). The key rows
 * are `lib/slides/keys.ts`'s table, so the menu's keys are the keys the deck answers to.
 * `credits` are the sources of what the deck draws, listed in the menu under its tools.
 */
export function deckControls(
  keyRows: readonly KeyActionRow[],
  credits: readonly DataCredit[],
): SafeHtml {
  return html`<div class="gmt-deck-bar" data-deck-bar>
    <div class="gmt-deck-pager">
      <button type="button" class="gmt-deck-step" data-deck-step="-1" aria-label="Previous"><span aria-hidden="true">&#8249;</span></button>
      <div class="gmt-deck-dots" data-deck-dots></div>
      <button type="button" class="gmt-deck-step" data-deck-step="1" aria-label="Next"><span aria-hidden="true">&#8250;</span></button>
    </div>
    <div class="gmt-deck-tools">
      <button type="button" class="gmt-deck-step gmt-deck-info" id="deck-menu" popovertarget="deck-menu-panel" aria-label="Slide options">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5.5M12 7.75v.01"></path></svg>
      </button>
      <div class="gmt-deck-menu" id="deck-menu-panel" popover>
        <div class="gmt-deck-menu-tools">${TOOLS.map((t) => tool(t, keyRows))}</div>
        ${menuCredits(credits)}
      </div>
    </div>
    <p class="gmt-sr-only" data-deck-live role="status" aria-live="polite" aria-atomic="true"></p>
  </div>`;
}

/**
 * One native modal dialog with a heading, its body and a close button. The frame is a dark island:
 * the site hands a dialog in a dark island the light theme back (for the header's search), and the
 * deck stays dark in both themes.
 */
function dialog(name: string, title: string, body: SafeHtml): SafeHtml {
  return html`<dialog class="gmt-deck-dialog" data-deck-dialog="${name}" aria-labelledby="deck-${name}-title">
    <div class="gmt-deck-dialog-frame gmt-theme-dark">
      <h2 id="deck-${name}-title" class="gmt-deck-dialog-title">${title}</h2>
      ${body}
      <div class="gmt-deck-dialog-close">
        ${button({ id: `deck-${name}-close`, label: "Close" })}
      </div>
    </div>
  </dialog>`;
}

export interface KeyHelpRow {
  keys: readonly string[];
  label: string;
}

/** The help dialog: every key the deck answers to. */
export function helpDialog(keyRows: readonly KeyHelpRow[]): SafeHtml {
  const rows = keyRows.map((row) => ({
    keys: html`${row.keys.map(
      (k, i) => html`${i > 0 ? " or " : ""}<kbd>${k}</kbd>`,
    )}`,
    does: row.label,
  }));
  return dialog(
    "help",
    "Keys",
    table({
      caption: "Keys for the slides",
      columns: [
        { key: "keys", header: "Key", align: "start", numeric: false },
        { key: "does", header: "What it does", align: "start", numeric: false },
      ],
      rows,
    }),
  );
}

/**
 * The overview dialog: its lists are filled by the mount, the talk's slides first and then, under
 * their own heading, the spares (shown only once one is in reach).
 */
export function overviewDialog(): SafeHtml {
  return dialog(
    "overview",
    "Slides",
    html`<ol class="gmt-deck-overview" data-deck-overview></ol>
      <h3 class="gmt-deck-overview-heading" data-deck-overview-spares hidden>Spare slides, for questions</h3>
      <ol class="gmt-deck-overview" data-deck-overview-spare hidden></ol>`,
  );
}

export interface OverviewItem {
  id: string;
  title: string;
  minutes: number | null;
}

/** The overview's list items: one link to `#<id>` for each slide, with its minutes. */
export function overviewItems(items: readonly OverviewItem[]): SafeHtml {
  return html`${items.map(
    (item) =>
      html`<li><a href="#${item.id}" data-deck-goto="${item.id}">${item.title}</a>${item.minutes === null ? "" : html` <span class="gmt-deck-minutes">${item.minutes} min</span>`}</li>`,
  )}`;
}

/**
 * The unlock dialog: the secret phrase that opens every slide after the first. The Unlock button
 * is the field's add-on, joined to the input's end (`.gmt-deck-addon` in `slides.css`). The phrase
 * is typed on the projected screen, so it shows as dots.
 */
function unlockDialog(): SafeHtml {
  return dialog(
    "unlock",
    "Unlock the slides",
    html`<div class="gmt-deck-unlock">
      ${field({
        id: "deck-unlock-code",
        label: "Secret phrase",
        control: (ids) =>
          html`<div class="gmt-deck-addon">${textInput({
            ...ids,
            autocomplete: "off",
            spellcheck: false,
            maxLength: 64,
            masked: true,
          })}${button({ id: "deck-unlock-go", label: "Unlock" })}</div>`,
      })}
      <p class="gmt-deck-unlock-error" id="deck-unlock-error" role="alert" data-deck-unlock-error></p>
    </div>`,
  );
}

/** The three dialogs, for the end of the deck root. */
export function deckDialogs(keyRows: readonly KeyHelpRow[]): SafeHtml {
  return html`${overviewDialog()}${helpDialog(keyRows)}${unlockDialog()}`;
}
