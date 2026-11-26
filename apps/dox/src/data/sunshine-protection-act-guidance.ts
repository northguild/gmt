/**
 * The Sunshine Protection Act page's guidance: how disruptive it would be if clocks stopped
 * changing, from the evidence in `context/domination/research/us-permanent-daylight-time.md`.
 * The shapes are in `clock-change-text.ts`; `keyPoints` renders the cards with
 * `US_GUIDANCE_HEADING`.
 *
 * The text is dated and tense-free about the national proposal ("As of 13 November 2026") and
 * names no law, bill or legislature. Scientific societies are named: they are sources, not
 * lawmaking bodies. The card about neighbouring states counts the rows in `STATES` that carry
 * `waitsOn` field.
 */
import { withBase } from "../lib/site";
import stateNames from "../lib/us-state-names.json";
import type { KeyCard } from "./clock-change-text";
import { STATES } from "./sunshine-protection-act-proposals";

export const US_GUIDANCE_HEADING = "If the clocks stop changing";

const NUMBER_WORDS = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

/** The names of the states whose law waits on other states, in `STATES` order. */
const tiedNames = (): string[] =>
  STATES.flatMap((row) =>
    row.kind === "adopted" &&
    row.position === "daylight-if-allowed" &&
    row.waitsOn !== null
      ? [(stateNames as Record<string, string>)[row.postal] ?? row.postal]
      : [],
  );

/** "Delaware, Oregon and Idaho". */
const joinNames = (names: readonly string[]): string =>
  names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

const tied = tiedNames();
const TIED_SENTENCE = `${NUMBER_WORDS[tied.length] ?? String(tied.length)} ${tied.length === 1 ? "state ties its switch" : "states tie their switch"} to other states: ${joinNames(tied)}.`;

// `/check/` has no page of its own, so a bare string under it reads as a public file in the bundle
// scan: these two are put under the base here. `withBase` leaves a based path as it is.
const CANADA_HREF = withBase("/check/canada-2026-clock-change/");
const MOROCCO_HREF = withBase("/check/morocco-2026-clock-change/");
const AUDIT_HREF = "/tools/stored-time-audit/";
const CLASSIFY_HREF = "/reference/zoned/classify/classifyStoredZoned/";
const CONVERT_HREF = "/reference/zoned/convert/convertPlainDateTimeToZoned/";

export const US_GUIDANCE: readonly KeyCard[] = [
  {
    id: "sunshine-notice",
    heading: "Devices learn about a change from a tz release",
    blocks: [
      {
        kind: "p",
        parts: [
          "Phones, servers and browsers read their clock rules from the IANA tz database. A change reaches a device only after a new release ships and the device installs it.",
        ],
      },
      {
        kind: "p",
        parts: [
          "The tz maintainers ask for a year’s notice. In 2022 a Mexican law ended daylight time in most of the country, and Chihuahua’s clocks changed two days after the law was published.",
        ],
      },
      {
        kind: "p",
        parts: [
          "The national proposal starts on the day it becomes law. It sets no later start date, so it gives no notice period.",
        ],
      },
      {
        kind: "p",
        parts: [
          "See what a runtime with old tz data gets wrong: ",
          { link: "Canada", href: CANADA_HREF },
          " and ",
          { link: "Morocco", href: MOROCCO_HREF },
          ".",
        ],
      },
    ],
  },
  {
    id: "sunshine-saved",
    heading: "Saved future times can shift",
    blocks: [
      {
        kind: "p",
        parts: [
          "A meeting saved as a local time keeps its local time. A meeting saved as an instant keeps its instant, so its local time moves by an hour when the rules change.",
        ],
      },
      {
        kind: "p",
        parts: [
          "Find your saved times with ",
          { link: "Stored Time Audit", href: AUDIT_HREF },
          " or ",
          { fn: "classifyStoredZoned", href: CLASSIFY_HREF },
          ". To fix one, keep its local time and place and convert them again with ",
          { fn: "convertPlainDateTimeToZoned", href: CONVERT_HREF },
          ".",
        ],
      },
    ],
  },
  {
    id: "sunshine-neighbours",
    heading: "Neighbours follow, or do not",
    blocks: [
      {
        kind: "p",
        parts: [
          "Mexican areas near the border follow US daylight time rules. A US change would leave them changing alone unless they follow.",
        ],
      },
      {
        kind: "p",
        parts: [TIED_SENTENCE],
      },
      {
        kind: "p",
        parts: [
          "A state that was already on standard time all year before the day the proposal becomes law could keep its time. Arizona’s offset from its neighbours would then stay the same all year.",
        ],
      },
    ],
  },
  {
    id: "sunshine-health",
    heading: "What sleep and safety research says",
    blocks: [
      {
        kind: "ol",
        items: [
          [
            "The Society for Research on Biological Rhythms, an international body of scientists, prefers standard time all year to either switching or daylight time all year.",
          ],
          [
            "A 2026 review of 157 studies from 36 countries linked the spring change to harm and daylight time in summer to fewer deaths and crashes. It called the evidence limited.",
          ],
          [
            "In 2018 the European Commission asked the public. Of around 4.6 million replies, 84% wanted the changes to end. EU member states have not agreed a position, so the changes continue.",
          ],
          [
            "In 2019 the European Biological Rhythms Society, the European Sleep Research Society and the Society for Research on Biological Rhythms wrote together to the European Commission. They said standard time all year is the best option for public health.",
          ],
          [
            "In the United States, the American Academy of Sleep Medicine calls for standard time all year.",
          ],
          [
            "Fatal crashes rose 6% after the spring change in a study of 732,835 US crashes from 1996 to 2017. The rise was larger in the morning and in the west of each zone.",
          ],
        ],
      },
    ],
  },
  {
    id: "sunshine-history",
    heading: "It has been tried before",
    blocks: [
      {
        kind: "ol",
        items: [
          [
            "The United States kept daylight time all year from January 1974. It went back to standard time that October.",
          ],
          [
            "The United Kingdom kept summer time all year from 1968 to 1971, then went back.",
          ],
          [
            "Russia moved to permanent summer time in 2011 and to permanent winter time in 2014.",
          ],
          [
            "A 2026 review of 157 studies from 36 countries found effects in both directions by season, on limited evidence.",
          ],
        ],
      },
    ],
  },
];
