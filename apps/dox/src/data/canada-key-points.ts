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

import {
  helpMarkdown as helpMarkdownOf,
  helpText as helpTextOf,
  keyPointsMarkdown as keyPointsMarkdownOf,
  type HelpCard,
  type KeyCard,
} from "../lib/clock-check/key-points";

// The shapes and renderers are shared by every clock-change checker; this module keeps Canada's
// words and re-exports the rest so what imported them from here still can.
export {
  HELP_HEADING,
  KEY_POINTS_HEADING,
  partsHtml,
  partsMarkdown,
  partsText,
  type HelpCard,
  type HelpCase,
  type KeyBlock,
  type KeyCard,
  type KeyPart,
} from "../lib/clock-check/key-points";

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
            {
              link: "Did your saved events move?",
              href: "#canada-stored-title",
            },
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

const CLASSIFY_HREF = "/reference/zoned/classify/classifyStoredZoned/";
const CONVERT_HREF = "/reference/zoned/convert/convertPlainDateTimeToZoned/";
const TESTS_HREF =
  "https://github.com/northguild/gmt/blob/main/packages/gmt/src/test/oh-canada.test.ts";

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

/** The help card as Markdown, for the `.md` twin and the llms files. */
export const helpMarkdown = (): string => helpMarkdownOf(HELP);

/** The whole help card as plain text, for a test to search. */
export const helpText = (): string => helpTextOf(HELP);

/** The whole section as Markdown, for the `.md` twin and the llms files. */
export const keyPointsMarkdown = (): string => keyPointsMarkdownOf(KEY_POINTS);
