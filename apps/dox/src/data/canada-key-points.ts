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
            "Your saved events: appointments, bookings and shifts your app saved before you updated may be an hour off in these places. Find them with ",
            { link: "Did your saved events move?", href: "#canada-stored-title" },
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

/**
 * The "How gmt helps" card: a lede, a verified line with a link to the tests, one case card per
 * kind of saved event that can be wrong, and a call to the checker. Shaped like the home page's
 * fault cards (`date-faults.ts`): a tag, `input → output`, then one line of why.
 */
export const HELP_HEADING = "How gmt helps";
const CLASSIFY_HREF = "/reference/zoned/classify/classifyStoredZoned/";
const CONVERT_HREF = "/reference/zoned/convert/convertPlainDateTimeToZoned/";
const TESTS_HREF =
  "https://github.com/northguild/gmt/blob/main/packages/gmt/src/test/oh-canada.test.ts";

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

export const HELP: HelpCard = {
  lede: [
    "Once your runtime is updated, every gmt zoned function gives the right time for these places. Use them as usual with the zone name, such as ",
    { code: "America/Vancouver" },
    ". Nothing extra is needed.",
  ],
  verified: [
    "gmt’s tests run on the newest release of every Node.js version gmt supports, and fail if any of them is missing this change. The server behind this page is checked for it every day. ",
    { link: "See the tests", href: TESTS_HREF },
    ".",
  ],
  intro: "Only events saved before the update can be wrong.",
  cases: [
    {
      tag: "Saved with an offset",
      input: "2026-11-15T09:00:00-08:00[America/Vancouver]",
      output: '""',
      why: [
        "The zoned functions return ",
        { code: '""' },
        " for it, because ",
        { code: "-08:00" },
        " is no longer Vancouver\u2019s offset on that date. ",
        { fn: "classifyStoredZoned", href: CLASSIFY_HREF },
        " says why and gives both fixes: keep 9:00 local, or keep the old moment (10:00 local).",
      ],
    },
    {
      tag: "Saved as UTC only",
      input: "2026-11-15T17:00:00Z",
      output: "10:00",
      outputNote: "an hour late",
      why: [
        "It reads with no error but shows 10:00 in Vancouver. If you kept the local time and place, convert them again with ",
        { fn: "convertPlainDateTimeToZoned", href: CONVERT_HREF },
        ".",
      ],
    },
  ],
  cta: {
    lead: "To check your saved events without writing code:",
    link: "Did your saved events move?",
    href: "#canada-stored-title",
  },
};

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
  const lines = ["", `## ${HELP_HEADING}`, "", partsMarkdown(HELP.lede), "", partsMarkdown(HELP.verified), "", HELP.intro, ""];
  for (const item of HELP.cases) {
    lines.push(`### ${item.tag}`, "");
    lines.push(`\`${item.input}\` \u2192 \`${item.output}\`${item.outputNote ? ` (${item.outputNote})` : ""}`, "");
    lines.push(partsMarkdown(item.why), "");
  }
  lines.push(`${HELP.cta.lead} [${HELP.cta.link}](${HELP.cta.href})`, "");
  return lines.join("\n");
}

/** The whole help card as plain text, for a test to search. */
export function helpText(): string {
  return [
    HELP_HEADING,
    partsText(HELP.lede),
    partsText(HELP.verified),
    HELP.intro,
    ...HELP.cases.flatMap((c) => [c.tag, c.input, c.output, c.outputNote ?? "", partsText(c.why)]),
    `${HELP.cta.lead} ${HELP.cta.link}`,
  ].join("\n");
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
