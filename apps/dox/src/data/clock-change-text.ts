/**
 * The words every dated tz-change checker's "Key points" and "How gmt helps" cards are built from:
 * the shapes of the text, and the functions that turn it into HTML, plain text and Markdown. Each
 * checker keeps its own wording in its own `<checker>-key-points.ts`.
 *
 * Here rather than in an `.astro` component so the text surfaces render the same words: a
 * component's frontmatter is not importable, and passing the tag through would ship a raw
 * component tag into `.md`, `llms-full.txt` and the retrieval chunks (see `mdx-jsx.ts`).
 */

/**
 * A run of text: plain, code, or a link to an anchor on the same page.
 *
 * A `tense` part is a stretch of text about a change that has a date. The page shows `before` or
 * `after`, whichever is true now (`tense` names the moment that decides, a key of the region's
 * moments): `keyPointsHtml` writes the whole paragraph in both forms. Every function here writes
 * `dated`, a wording that is true on any day, for the text that runs no code (the `.md` twin, the
 * llms files, a test).
 */
export type KeyPart =
  | string
  | { tense: string; before: string; after: string; dated: string }
  | { code: string }
  | { strong: string }
  /** A function name, in a code chip, linked to its reference page. */
  | { fn: string; href: string }
  | { link: string; href: string };

export type KeyBlock =
  | { kind: "p"; parts: KeyPart[] }
  | { kind: "ol"; items: KeyPart[][] };

export interface KeyCard {
  /** An anchor for the card, when other text links to it. */
  id?: string;
  heading: string;
  blocks: KeyBlock[];
}

export const KEY_POINTS_HEADING = "Key points";
export const HELP_HEADING = "How gmt helps";

export interface HelpCase {
  tag: string;
  input: string;
  output: string;
  /** Said beside the output, such as "an hour late". */
  outputNote?: string;
  why: KeyPart[];
}

export interface HelpCard {
  lede: KeyPart[];
  verified: KeyPart[];
  intro: string;
  cases: HelpCase[];
  /** The call to action: a sentence, then a link styled as a button. */
  cta: { lead: string; link: string; href: string };
}

/** The key of the moment that decides a run of parts, or `null` when no part in it has a tense. */
export function tenseKeyOf(parts: KeyPart[]): string | null {
  for (const part of parts) {
    if (typeof part !== "string" && "tense" in part) return part.tense;
  }
  return null;
}

/** The parts with every `tense` part written out in one form, so the run reads as one sentence. */
export function partsInForm(
  parts: KeyPart[],
  form: "before" | "after",
): KeyPart[] {
  return parts.map((part) =>
    typeof part !== "string" && "tense" in part ? part[form] : part,
  );
}

const escapeText = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The parts as HTML: code as chips, links as anchors (`href` goes through `resolveHref`). */
export function partsHtml(
  parts: KeyPart[],
  resolveHref: (href: string) => string = (href) => href,
): string {
  return parts
    .map((part) =>
      typeof part === "string"
        ? escapeText(part)
        : "tense" in part
          ? escapeText(part.dated)
          : "code" in part
            ? `<code>${escapeText(part.code)}</code>`
            : "strong" in part
              ? `<strong>${escapeText(part.strong)}</strong>`
              : "fn" in part
                ? `<a class="gmt-clockcheck-help-fn" href="${escapeText(resolveHref(part.href))}"><code>${escapeText(part.fn)}</code></a>`
                : `<a href="${escapeText(resolveHref(part.href))}">${escapeText(part.link)}</a>`,
    )
    .join("");
}

/** The parts as plain text (what a screen-reader-free surface such as a test compares). */
export function partsText(parts: KeyPart[]): string {
  return parts
    .map((part) =>
      typeof part === "string"
        ? part
        : "tense" in part
          ? part.dated
          : "code" in part
            ? part.code
            : "strong" in part
              ? part.strong
              : "fn" in part
                ? part.fn
                : part.link,
    )
    .join("");
}

/** The parts as Markdown: code in backticks, links as `[text](#anchor)`. */
export function partsMarkdown(parts: KeyPart[]): string {
  return parts
    .map((part) =>
      typeof part === "string"
        ? part
        : "tense" in part
          ? part.dated
          : "code" in part
            ? `\`${part.code}\``
            : "strong" in part
              ? `**${part.strong}**`
              : "fn" in part
                ? `[\`${part.fn}\`](${part.href})`
                : `[${part.link}](${part.href})`,
    )
    .join("");
}

/** The whole section as Markdown, for the `.md` twin and the llms files. */
export function keyPointsMarkdown(cards: readonly KeyCard[]): string {
  const lines: string[] = ["", `## ${KEY_POINTS_HEADING}`, ""];
  for (const card of cards) {
    lines.push(`### ${card.heading}`, "");
    for (const block of card.blocks) {
      if (block.kind === "p") {
        lines.push(partsMarkdown(block.parts), "");
      } else {
        block.items.forEach((item, i) => {
          lines.push(`${i + 1}. ${partsMarkdown(item)}`);
        });
        lines.push("");
      }
    }
  }
  return lines.join("\n");
}
