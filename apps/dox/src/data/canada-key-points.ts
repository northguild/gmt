/**
 * The Canada 2026 clock-change checker's "Key points" and "How gmt helps" cards, as the page states
 * them. The shapes and the functions that render them are in `clock-change-text.ts`.
 *
 * Dates and offsets are the page's tzdb 2026e facts (`PROBE_ZONES` in `canada-clock-change.ts`):
 * British Columbia, Alberta, the Northwest Territories and Manitoba do not turn back on 2026-11-01.
 */

import { REGION_KEY } from "../lib/clock-change-tense";
import type { HelpCard, KeyCard } from "./clock-change-text";

/** The date and time of the change on every stopped zone's own clock, as the text on the page words it. */
const CHANGE_DATED = "1 November 2026";

/**
 * The Key points in both tenses. `when` is the change's date and time in words, written by the
 * library at run time (`momentWords`). The card the page shows picks `before` or `after` by the
 * clock; `KEY_POINTS` below has the dated wording only, true on any day.
 */
export function canadaKeyPoints(when: string): KeyCard[] {
  return [
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
            {
              tense: REGION_KEY,
              before: ` will stop changing their clocks. On ${when} local time they will not turn them back. They will stay on summer time for good.`,
              after: ` stopped changing their clocks. On ${when} local time they did not turn them back. They stay on summer time for good.`,
              dated: ` stop changing their clocks. From ${CHANGE_DATED}, they stay on summer time for good.`,
            },
          ],
        },
        {
          kind: "p",
          parts: [
            "Phones, computers and apps learn about changes like this from time zone updates. One that has not updated ",
            {
              tense: REGION_KEY,
              before: `will turn the clock back on ${CHANGE_DATED} anyway, and will show those places an hour wrong from then on.`,
              after: `turned the clock back on ${CHANGE_DATED} anyway, and has shown those places an hour wrong since then.`,
              dated: `turns the clock back on ${CHANGE_DATED} anyway, and shows those places an hour wrong from then on.`,
            },
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
                href: "#canada-stored-heading",
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
}

/** The Key points as text that runs no code states them: the dated wording, true on any day. */
export const KEY_POINTS: KeyCard[] = canadaKeyPoints(CHANGE_DATED);

/**
 * The "How gmt helps" card: a lede, a verified line with a link to the tests, one case card per
 * kind of saved event that can be wrong, and a call to the checker. Shaped like the home page's
 * fault cards (`date-faults.ts`): a tag, `input → output`, then one line of why.
 */
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
    href: "#canada-stored-heading",
  },
};
