/**
 * The Morocco 2026 clock-change checker's "Key points" and "How gmt helps" cards, as the page
 * states them. The shapes and the functions that render them are in `clock-change-text.ts`.
 *
 * Dates and offsets are the page's facts from `morocco-clock-change.ts`: tzdb 2026c records that
 * Morocco and Western Sahara stay on +00:00 from 20 September 2026 at 02:00 local time.
 */

import type { HelpCard, KeyCard } from "./clock-change-text";

export const MOROCCO_KEY_POINTS: KeyCard[] = [
  {
    heading: "What tzdb records",
    blocks: [
      {
        kind: "p",
        parts: [
          "tzdb 2026c, the time zone database, records that ",
          { code: "Africa/Casablanca" },
          " and ",
          { code: "Africa/El_Aaiun" },
          " (Morocco and Western Sahara) stop changing their clocks. Since 20 September 2026 at 02:00 local time they stay on UTC+00 all year.",
        ],
      },
      {
        kind: "p",
        parts: [
          "Phones, computers and apps learn about changes like this from time zone updates.",
        ],
      },
    ],
  },
  {
    heading: "What old data does",
    blocks: [
      {
        kind: "p",
        parts: [
          "Data from tzdb 2026b or earlier puts both places an hour ahead (+01:00) for most of the year, and back on +00:00 only in the weeks of Ramadan (7 February to 14 March 2027 in that data). So it is right for a few weeks and an hour wrong for the rest of the year.",
        ],
      },
      {
        kind: "p",
        parts: [
          "This page checks your browser at two moments. A red ✗ below means its time zone data is out of date.",
        ],
      },
    ],
  },
  {
    id: "morocco-developers",
    heading: "What to do",
    blocks: [
      {
        kind: "ol",
        items: [
          [
            "Your servers: run ",
            { link: "Test your own servers", href: "#morocco-servers-title" },
            " below the map on every server, container and CI image. If it prints a different offset, update the runtime or the OS tzdata package and rebuild your images.",
          ],
          [
            "Your users’ browsers: you can’t update them, and some lag behind for weeks. If your web page works out times in these two places in the browser, work them out on your updated server and send the result instead.",
          ],
          [
            "Your saved events: appointments, bookings and shifts your app saved before you updated may be an hour off. Find them with ",
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

/**
 * The "How gmt helps" card: a lede, a verified line with a link to the tests, one case card per
 * kind of saved event that can be wrong, and a call to the checker.
 */
const CLASSIFY_HREF = "/reference/zoned/classify/classifyStoredZoned/";
const CONVERT_HREF = "/reference/zoned/convert/convertPlainDateTimeToZoned/";
const TESTS_HREF =
  "https://github.com/northguild/gmt/blob/main/packages/gmt/src/test/oh-morocco.test.ts";

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
      input: "2026-11-16T09:00:00+01:00[Africa/Casablanca]",
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
      input: "2026-11-16T08:00:00Z",
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
