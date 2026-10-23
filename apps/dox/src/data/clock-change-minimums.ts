/**
 * The "Upgrade to at least" card shared by the dated clock-change checkers: the types a checker's
 * rows are written in, and the functions that turn them into HTML and Markdown. Each checker keeps
 * its own wording and rows in its own `<checker>-runtime-minimums.ts` as a `MinimumsText`.
 *
 * Here rather than in a mount so the text surfaces (`.md`, `llms-full.txt`, retrieval chunks)
 * render the same words as the page.
 */

import { INFO_ICON } from "../lib/clock-change-probe";

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const escapeAttr = escapeHtml;

/** One run of text in a row: plain, or a version in a code chip. */
export type MinimumPart = string | { code: string };

/** A source link; the text says which release or page it is. */
export interface MinimumSource {
  label: string;
  href: string;
}

export interface RuntimeMinimum {
  name: string;
  parts: MinimumPart[];
  sources: MinimumSource[];
}

/** Everything a checker's card says: its words and its rows. */
export interface MinimumsText {
  heading: string;
  intro: string;
  footer: string;
  /** The line under the card: why the device matters, with no function names. */
  note: string;
  rows: RuntimeMinimum[];
}

const partsHtml = (parts: MinimumPart[]) =>
  parts
    .map((p) =>
      typeof p === "string"
        ? escapeHtml(p)
        : `<code>${escapeHtml(p.code)}</code>`,
    )
    .join("");

/** The rows as list items: name, the versions, then a link to each source. */
export function minimumsItemsHtml(text: MinimumsText): string {
  return text.rows
    .map((row) => {
      const links = row.sources
        .map(
          (s) =>
            `<a href="${escapeAttr(s.href)}" rel="noopener noreferrer">${escapeHtml(s.label)}</a>`,
        )
        .join(", ");
      return (
        `<li><strong>${escapeHtml(row.name)}</strong> ${partsHtml(row.parts)}` +
        (links
          ? ` <span class="gmt-clockcheck-minimums-src">Source: ${links}</span>`
          : "") +
        `</li>`
      );
    })
    .join("");
}

/** The card as Markdown for the `.md` twin and the llms files. */
export function minimumsMarkdown(text: MinimumsText): string {
  const lines = ["", `## ${text.heading}`, "", text.intro, ""];
  for (const row of text.rows) {
    const body = row.parts
      .map((p) => (typeof p === "string" ? p : `\`${p.code}\``))
      .join("");
    const links = row.sources.map((s) => `[${s.label}](${s.href})`).join(", ");
    lines.push(`- **${row.name}**: ${body}${links ? ` Source: ${links}` : ""}`);
  }
  lines.push("", text.footer, "", text.note, "");
  return lines.join("\n");
}

/** The card: the servers card's info-card style, full width. `idPrefix` makes its heading id. */
export function minimumsCardHtml(idPrefix: string, text: MinimumsText): string {
  return (
    `<section class="gmt-clockcheck-minimums" aria-labelledby="${idPrefix}-minimums-title">` +
    INFO_ICON +
    `<div class="gmt-clockcheck-servers-body">` +
    `<h4 id="${idPrefix}-minimums-title">${escapeHtml(text.heading)}</h4>` +
    `<p>${escapeHtml(text.intro)}</p>` +
    `<ul class="gmt-clockcheck-minimums-list">${minimumsItemsHtml(text)}</ul>` +
    `<p>${escapeHtml(text.footer)}</p>` +
    `<p class="gmt-clockcheck-minimums-note">${escapeHtml(text.note)}</p>` +
    `</div></section>`
  );
}
