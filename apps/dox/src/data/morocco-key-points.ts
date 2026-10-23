/**
 * The Morocco 2026 clock-change checker's "Key points" and "How gmt helps" card, as the page
 * states them.
 *
 * Here rather than in `MoroccoClockChange.astro` so the text surfaces render the same words: a
 * component's frontmatter is not importable, and passing the tag through would ship a raw
 * `<MoroccoClockChange />` into `.md`, `llms-full.txt` and the retrieval chunks (see `mdx-jsx.ts`).
 *
 * Dates and offsets are the facts of tzdb 2026c (`MOROCCO_PROBE` in `morocco-clock-change.ts`).
 * "Morocco and Western Sahara" appears once, in the first card, where it repeats tzdb's own
 * description of the two zones.
 */
import type { HelpCard, KeyCard } from "../lib/clock-check/key-points";

export const MOROCCO_KEY_POINTS: KeyCard[] = [
  {
    heading: "What changed",
    blocks: [
      {
        kind: "p",
        parts: [
          "tzdb 2026c changes the rules for Morocco and Western Sahara: ",
          { code: "Africa/Casablanca" },
          " and ",
          { code: "Africa/El_Aaiun" },
          ". From 20 September 2026 both stay on UTC+00:00, with no clock changes in 2027.",
        ],
      },
      {
        kind: "p",
        parts: [
          "Time zone data older than 2026c keeps ",
          { code: "+01:00" },
          " the rest of the year, and still turns the clocks back for Ramadan from 7 February to 14 March 2027. Those changes no longer happen.",
        ],
      },
      {
        kind: "p",
        parts: [
          "This page checks your browser. A red ✗ below means its time zone data is out of date.",
        ],
      },
    ],
  },
  {
    id: "morocco-developers",
    heading: "What to do: three checks",
    blocks: [
      {
        kind: "ol",
        items: [
          [
            "Your servers: run ",
            { link: "Test your own servers", href: "#morocco-servers-title" },
            " on every server, container and CI image. If it prints a different offset, update the runtime or the OS tzdata package and rebuild your images.",
          ],
          [
            "Your users’ browsers: you can’t update them, and some will lag behind for weeks. If your web page works out times in these two places in the browser, work them out on your updated server and send the result instead.",
          ],
          [
            "Your saved events: appointments, bookings and shifts your app saved before you updated may be an hour off in these places. Find them with ",
            {
              link: "Did your saved events move?",
              href: "#morocco-stored-title",
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
  "https://github.com/northguild/gmt/blob/main/packages/gmt/src/test/morocco-2026.test.ts";

export const MOROCCO_HELP: HelpCard = {
  lede: [
    "Once your runtime is updated, every gmt zoned function gives the right time for these places. Use them as usual with the zone name, such as ",
    { code: "Africa/Casablanca" },
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
      input: "2027-06-01T09:00:00+01:00[Africa/Casablanca]",
      output: '""',
      why: [
        "The zoned functions return ",
        { code: '""' },
        " for it, because ",
        { code: "+01:00" },
        " is no longer Casablanca’s offset on that date. ",
        { fn: "classifyStoredZoned", href: CLASSIFY_HREF },
        " says why and gives both fixes: keep 9:00 local, or keep the old moment (8:00 local).",
      ],
    },
    {
      tag: "Saved as UTC only",
      input: "2027-06-01T08:00:00Z",
      output: "08:00",
      outputNote: "an hour early",
      why: [
        "It reads with no error but shows 08:00 in Casablanca. If you kept the local time and place, convert them again with ",
        { fn: "convertPlainDateTimeToZoned", href: CONVERT_HREF },
        ".",
      ],
    },
  ],
  cta: {
    lead: "To check your saved events without writing code:",
    link: "Did your saved events move?",
    href: "#morocco-stored-title",
  },
};
