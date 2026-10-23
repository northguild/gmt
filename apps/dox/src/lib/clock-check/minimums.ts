/**
 * The "Upgrade to at least" card every clock-change checker shows: the shapes of a row and the
 * renderers for the card's list and its Markdown. A checker supplies the words and the rows.
 *
 * Here rather than in the mount so the text surfaces (`.md`, `llms-full.txt`, retrieval chunks)
 * render the same words as the page.
 */

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

/** The card's words and rows, as a checker states them. */
export interface MinimumsCard {
  heading: string;
  intro: string;
  footer: string;
  /** The note under the card: why the device matters, with no function names. */
  note: string;
  rows: readonly RuntimeMinimum[];
}

const partsHtml = (parts: readonly MinimumPart[]) =>
  parts
    .map((p) =>
      typeof p === "string"
        ? escapeHtml(p)
        : `<code>${escapeHtml(p.code)}</code>`,
    )
    .join("");

/** The rows as list items: name, the versions, then a link to each source. */
export function minimumsItemsHtml(rows: readonly RuntimeMinimum[]): string {
  return rows
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
          ? ` <span class="gmt-check-minimums-src">Source: ${links}</span>`
          : "") +
        `</li>`
      );
    })
    .join("");
}

/** The card as Markdown for the `.md` twin and the llms files. */
export function minimumsMarkdown(card: MinimumsCard): string {
  const lines = ["", `## ${card.heading}`, "", card.intro, ""];
  for (const row of card.rows) {
    const text = row.parts
      .map((p) => (typeof p === "string" ? p : `\`${p.code}\``))
      .join("");
    const links = row.sources.map((s) => `[${s.label}](${s.href})`).join(", ");
    lines.push(`- **${row.name}**: ${text}${links ? ` Source: ${links}` : ""}`);
  }
  lines.push("", card.footer, "", card.note, "");
  return lines.join("\n");
}
