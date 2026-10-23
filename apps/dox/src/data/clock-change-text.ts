/**
 * The words every dated tz-change checker's "Key points" and "How gmt helps" cards are built from:
 * the shapes of the text, and the functions that turn it into HTML, plain text and Markdown. Each
 * checker keeps its own wording in its own `<checker>-key-points.ts`.
 *
 * Here rather than in an `.astro` component so the text surfaces render the same words: a
 * component's frontmatter is not importable, and passing the tag through would ship a raw
 * component tag into `.md`, `llms-full.txt` and the retrieval chunks (see `mdx-jsx.ts`).
 */

/** A run of text: plain, code, or a link to an anchor on the same page. */
export type KeyPart =
  | string
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
