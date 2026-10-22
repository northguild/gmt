/**
 * The Canada 2026 clock-change checker's "Key points", as the page states them.
 *
 * Here rather than in `CanadaKeyPoints.astro` so the text surfaces render the same words: a
 * component's frontmatter is not importable, and passing the tag through would ship a raw
 * `<CanadaKeyPoints />` into `.md`, `llms-full.txt` and the retrieval chunks (see
 * `mdx-jsx.ts`'s `renderCanadaKeyPoints`).
 *
 * Dates and offsets are the page's tzdb 2026e facts (`PROBE_ZONES` in `canada-clock-change.ts`):
 * British Columbia, Alberta, the Northwest Territories and Manitoba do not turn back on 2026-11-01.
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

export const KEY_POINTS: KeyCard[] = [
  {
    heading: "What is happening",
    blocks: [
      {
        kind: "p",
        parts: [
          { code: "British Columbia" },
          ", ",
          { code: "Alberta" },
          ", the ",
          { code: "Northwest Territories" },
          " and ",
          { code: "Manitoba" },
          " stop changing their clocks. On 1 November 2026 they do not turn them back. They stay on summer time for good.",
        ],
      },
      {
        kind: "p",
        parts: [
          "Phones, computers and apps learn about changes like this from time zone updates. One that has not updated turns the clock back on 1 November 2026 anyway, and shows those places an hour wrong from then on.",
        ],
      },
      {
        kind: "p",
        parts: [
          "This page checks your browser. A red \u2717 below means its time zone data is out of date.",
        ],
      },
    ],
  },
  {
    id: "canada-developers",
    heading: "For developers: three checks",
    blocks: [
      {
        kind: "ol",
        items: [
          [
            "Your servers: run ",
            { link: "Test your own servers", href: "#canada-servers-title" },
            " below the map on every server, container and CI image. If it prints a different offset, update the runtime or the OS tzdata package and rebuild your images.",
          ],
          [
            "Your users\u2019 browsers: you can\u2019t update them, and some will lag behind for weeks. If your web page works out times in these four places in the browser, work them out on your updated server and send the result instead.",
          ],
          [
            "Your saved data: future events saved before you updated may be an hour off in these places. Find them with ",
            { link: "Check saved times", href: "#canada-stored-title" },
            " below, or ",
            { code: "classifyStoredZoned" },
            " in your code. To fix one, keep its local time and place and convert them again with ",
            { code: "convertPlainDateTimeToZoned" },
            ".",
          ],
        ],
      },
    ],
  },
];

/** The "How gmt helps" card: what the library does about old data, and which saved times can be wrong. */
export const HELP_HEADING = "How gmt helps";
const CLASSIFY_HREF = "/reference/zoned/classify/classifyStoredZoned/";
const CONVERT_HREF = "/reference/zoned/convert/convertPlainDateTimeToZoned/";
export type HelpBlock =
  | { kind: "p"; parts: KeyPart[] }
  | { kind: "ul"; items: KeyPart[][] };
export const HELP_BLOCKS: HelpBlock[] = [
  {
    kind: "p",
    parts: [
      "Once your runtime is updated, every gmt zoned function gives the right time for these places. Use them as usual with the zone name, such as ",
      { code: "America/Vancouver" },
      ". Nothing extra is needed.",
    ],
  },
  { kind: "p", parts: ["Only times saved before the update can be wrong:"] },
  {
    kind: "ul",
    items: [
      [
        { strong: "Saved with an offset" },
        ", like ",
        { code: "2026-11-15T09:00:00-08:00[America/Vancouver]" },
        ": the zoned functions return ",
        { code: '""' },
        " for it, because ",
        { code: "-08:00" },
        " is no longer Vancouver\u2019s offset on that date. ",
        { fn: "classifyStoredZoned", href: CLASSIFY_HREF },
        " says why and gives both fixes: keep 9:00 local, or keep the old moment (10:00 local).",
      ],
      [
        { strong: "Saved as UTC only" },
        ", like ",
        { code: "2026-11-15T17:00:00Z" },
        ": it reads with no error but shows 10:00, an hour late. If you kept the local time and place, convert them again with ",
        { fn: "convertPlainDateTimeToZoned", href: CONVERT_HREF },
        ".",
      ],
    ],
  },
  {
    kind: "p",
    parts: [
      "To check saved times without writing code, use ",
      { link: "Check saved times", href: "#canada-stored-title" },
      " below.",
    ],
  },
];

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
              ? `<a class="gmt-canada-help-fn" href="${escapeText(resolveHref(part.href))}"><code>${escapeText(part.fn)}</code></a>`
              : `<a href="${escapeText(resolveHref(part.href))}">${escapeText(part.link)}</a>`,
    )
    .join("");
}

/** The help card as Markdown, for the `.md` twin and the llms files. */
export function helpMarkdown(): string {
  const lines = ["", `## ${HELP_HEADING}`, ""];
  for (const block of HELP_BLOCKS) {
    if (block.kind === "p") lines.push(partsMarkdown(block.parts), "");
    else {
      for (const item of block.items) lines.push(`- ${partsMarkdown(item)}`);
      lines.push("");
    }
  }
  return lines.join("\n");
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
export function keyPointsMarkdown(): string {
  const lines: string[] = ["", `## ${KEY_POINTS_HEADING}`, ""];
  for (const card of KEY_POINTS) {
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
