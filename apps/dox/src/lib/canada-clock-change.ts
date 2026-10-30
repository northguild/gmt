/**
 * The Canada 2026 clock-change checker — the facts and shapes the server and the page share.
 * Pure: no DOM, no network. `worker/canada-clock-change.ts` computes every value at request
 * time; nothing here holds a computed offset, because the runtime's time zone data is what the page
 * exists to show.
 */
import { CANADA_MINIMUMS } from "../data/canada-runtime-minimums";
import { minimumsMarkdown } from "../data/clock-change-minimums";
import { HELP } from "../data/canada-key-points";
import {
  SERVERS_LINE,
  SERVERS_TITLE,
  cityOf,
  nodeProbeCommand,
} from "./clock-change-common";
import type { ProbeFact } from "./clock-change-common";
import { helpMarkdown } from "./clock-change-help";
import type {
  ProbeConfig,
  ProbeInstant,
  VerdictPlace,
  VerdictText,
} from "./clock-change-probe";
import { REGION_KEY, classPhrase } from "./clock-change-tense";
import type { Moment, Tensed, TenseView } from "./clock-change-tense";
import type { MapZone } from "./zone-map";
import { withBase } from "./site";

/** The instant every probe row is read at: a Monday noon UTC, after all five changes took effect. */
export const PROBE_INSTANT = "2026-11-02T12:00:00Z";

/**
 * `PROBE_INSTANT` as epoch milliseconds. `Intl.DateTimeFormat#formatToParts` takes a number, so the
 * page needs no native date object to read the browser's offset. A test pins it to the library's
 * own conversion of `PROBE_INSTANT`.
 */
export const PROBE_EPOCH_MS = 1793620800000;

/** The year the Canadian zones stop changing their clocks in. The year after is read too. */
export const CANADA_STOP_YEAR = 2026;

/** The one instant the probe rows are read at. */
export const CANADA_PROBE_INSTANTS: readonly ProbeInstant[] = [
  { iso: PROBE_INSTANT, epochMs: PROBE_EPOCH_MS, role: "verdict" },
];

/**
 * Source: IANA tzdb `NEWS`, releases 2026b-2026e
 * (<https://data.iana.org/time-zones/tzdb/NEWS>): BC to permanent -07 (2026b), AB to -06 and
 * Morocco to +00 (2026c), NT west to -06 (2026d), MB to -05 (2026e).
 */
export const PROBE_ZONES: readonly ProbeFact[] = [
  { zone: "America/Vancouver", offset: "-07:00", release: "2026b" },
  { zone: "America/Edmonton", offset: "-06:00", release: "2026c" },
  { zone: "Africa/Casablanca", offset: "+00:00", release: "2026c" },
  { zone: "America/Inuvik", offset: "-06:00", release: "2026d" },
  { zone: "America/Winnipeg", offset: "-05:00", release: "2026e" },
];

/**
 * The four Canadian zones the page is about: the probe zones without Casablanca. Casablanca stays
 * in `PROBE_ZONES` (the API still answers it); nothing on the page shows it.
 */
export const TABLE_ZONES: readonly ProbeFact[] = PROBE_ZONES.filter(
  (fact) => fact.zone !== "Africa/Casablanca",
);

/**
 * The zones that stop changing their clocks in 2026, from the tzdb 2026e facts above. The map's
 * first class is read from here, never from a runtime's own data, so it looks the same wherever
 * it is served.
 */
export const STOPPED_ZONES: ReadonlySet<string> = new Set(
  TABLE_ZONES.map((fact) => fact.zone),
);

/** The table zones plus Toronto, the control that still changes its clocks. */
export const TRANSITION_ZONES: readonly string[] = [
  ...TABLE_ZONES.map((fact) => fact.zone),
  "America/Toronto",
];

/** The five zones the clocks show. */
export const CLOCK_ZONES: readonly string[] = [
  "America/Vancouver",
  "America/Edmonton",
  "America/Inuvik",
  "America/Winnipeg",
  "America/Toronto",
];

/** The zone picker of the stored-times check: the same five. */
export const STORED_ZONES: readonly string[] = CLOCK_ZONES;

/**
 * The example lines. The first five are Toronto lines that give one of each kind on any tz
 * data; the last three are Canadian lines whose kind changed in 2026. The labels here never
 * claim a kind: the Worker's answer is what shows.
 */
export const STORED_PRESET: string = [
  "2026-07-01T12:00:00-04:00[America/Toronto]",
  "2026-11-01T01:30:00-04:00[America/Toronto]",
  "2026-07-01T12:00:00-05:00[America/Toronto]",
  "2026-11-01T01:30:00-06:00[America/Toronto]",
  "2027-03-14T02:30:00-05:00[America/Toronto]",
  "2026-11-15T09:00:00-08:00[America/Vancouver]",
  "2027-03-14T02:30:00-07:00[America/Edmonton]",
  "2026-11-01T01:30:00-05:00[America/Winnipeg]",
].join("\n");

/**
 * The checker's own rate-limit policy, shared by GET and POST. Per isolate, like the chat
 * limiter: blunt protection, not a global limit.
 */
export const CANADA_RATE_LIMIT = { max: 20, windowSeconds: 60 } as const;

export interface ProbeRow {
  zone: string;
  offset: string;
}

export interface TransitionRow {
  zone: string;
  year: number;
  instant: string;
  offsetBefore: string;
  offsetAfter: string;
  wallBefore: string;
}

export interface CanadaCheck {
  now: string;
  probe: ProbeRow[];
  transitions: TransitionRow[];
  zones: MapZone[];
}

/**
 * The one-line Node probe the page offers for the reader's own runtime. It prints each
 * city's UTC offset at `PROBE_INSTANT`; the output matches the page's "Correct" column when the
 * runtime carries tzdb 2026e data. `GMT` alone (UTC) is read as `+00:00`.
 */
export const NODE_PROBE_COMMAND = nodeProbeCommand(
  TABLE_ZONES.map((fact) => fact.zone),
  PROBE_EPOCH_MS,
);

/** The "Your browser" card's rows and instant: the table zones read at `PROBE_INSTANT`. */
export function canadaProbe(idPrefix: string): ProbeConfig {
  return {
    idPrefix,
    zones: TABLE_ZONES.map((fact) => ({
      zone: fact.zone,
      expected: { verdict: fact.offset },
    })),
    instants: CANADA_PROBE_INSTANTS,
  };
}

/**
 * Where "For developers" points. The page has the Key points card, so the link stays on the page;
 * the chat copy has none, so it opens that section of the checker page.
 */
function developersHref(where: VerdictPlace): string {
  return where === "page"
    ? "#canada-developers"
    : `${withBase("/check/canada-2026-clock-change/")}#canada-developers`;
}

/** The "Your browser" card's words. The HTML fields are written here, never by a reader. */
export function canadaVerdict(where: VerdictPlace): VerdictText {
  return {
    title: "Your browser",
    correctNote: "tzdb 2026e",
    yoursNote: "2 Nov 2026",
    checking: "Checking your browser&hellip;",
    right: "Your browser has the new rules for all four places.",
    wrongBefore: "Your browser has old time zone data for ",
    wrongAfter: ". From 1 November 2026 it shows their time an hour wrong.",
    more: [
      "<strong>For you:</strong> update your browser. If it is already up to date, its maker has not shipped the fix yet. Check again after the next update.",
      `<strong>For developers:</strong> your users&rsquo; browsers can be the same. See step 2 under <a href="${developersHref(where)}">For developers</a>.`,
    ],
    unknown: "Your browser cannot read these zones.",
  };
}

/**
 * The moment each stopped zone does not turn its clocks back: 1 November 2026 at 02:00 local time,
 * as a UTC instant and the offset in force just before. The words of the date and time are the
 * library's (`momentWords`); only the instants are stated here, and a test pins each to the
 * library. The region's moment is the latest of the four, so the region's sentences flip when
 * the last zone has passed.
 */
export const CANADA_MOMENTS: Readonly<Record<string, Moment>> = {
  "America/Vancouver": { at: "2026-11-01T09:00:00Z", from: "-07:00" },
  "America/Edmonton": { at: "2026-11-01T08:00:00Z", from: "-06:00" },
  "America/Inuvik": { at: "2026-11-01T08:00:00Z", from: "-06:00" },
  "America/Winnipeg": { at: "2026-11-01T07:00:00Z", from: "-05:00" },
  [REGION_KEY]: { at: "2026-11-01T09:00:00Z", from: "-07:00" },
};

/**
 * The class words of a zone's `kind` in both forms. A dated phrase, so it stays true after 2027;
 * the four zones change at four instants, so the legend carries local time only.
 */
export function canadaClassText(
  kind: MapZone["kind"],
  id: string | null,
  view: TenseView,
): Tensed {
  return classPhrase(kind, id, view, false);
}

/** What the command prints on a runtime with the new data: `[city, offset]` per table zone. */
export function expectedProbeOutput(): [string, string][] {
  return TABLE_ZONES.map((fact) => [cityOf(fact.zone), fact.offset]);
}

/** The card as Markdown for the `.md` twin and the llms files, command included. */
export function serversMarkdown(): string {
  return [
    "",
    `## ${SERVERS_TITLE}`,
    "",
    SERVERS_LINE,
    "",
    "```sh",
    NODE_PROBE_COMMAND,
    "```",
    "",
    `Expected: ${expectedProbeOutput()
      .map(([city, offset]) => `\`${city}\` ${offset}`)
      .join(" \u00b7 ")}`,
    minimumsMarkdown(CANADA_MINIMUMS),
    helpMarkdown(HELP),
  ].join("\n");
}
