/**
 * The "Upgrade to at least" card shared by the dated clock-change checkers: the types a checker's
 * rows are written in, and the function that turns them into Markdown. Each checker keeps
 * its own wording and rows in its own `<checker>-runtime-minimums.ts` as a `MinimumsText`.
 *
 * Here rather than in a mount so the text surfaces (`.md`, `llms-full.txt`, retrieval chunks)
 * render the same words as the page. The page's markup is `minimumsCard` in
 * `widgets/families/clockcheck/info-card.ts`.
 */

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
