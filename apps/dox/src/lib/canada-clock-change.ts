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
import { helpMarkdown } from "./clock-change-help";
import type { ProbeConfig, VerdictText } from "./clock-change-probe";
import type { MapZone } from "./zone-map";

/** The instant every probe row is read at: a Monday noon UTC, after all five changes took effect. */
export const PROBE_INSTANT = "2026-11-02T12:00:00Z";

/**
 * `PROBE_INSTANT` as epoch milliseconds. `Intl.DateTimeFormat#formatToParts` takes a number, so the
 * page needs no native date object to read the browser's offset. A test pins it to the library's
 * own conversion of `PROBE_INSTANT`.
 */
export const PROBE_EPOCH_MS = 1793620800000;

/** A zone whose rule changed in one of the 2026 tzdb releases. */
export interface ProbeFact {
  zone: string;
  /** The offset the tzdb 2026e release gives `zone` at `PROBE_INSTANT`. */
  tzdb2026e: string;
  /** The first tzdb release that carries the change. */
  release: "2026b" | "2026c" | "2026d" | "2026e";
}

/**
 * Source: IANA tzdb `NEWS`, releases 2026b-2026e
 * (<https://data.iana.org/time-zones/tzdb/NEWS>): BC to permanent -07 (2026b), AB to -06 and
 * Morocco to +00 (2026c), NT west to -06 (2026d), MB to -05 (2026e).
 */
export const PROBE_ZONES: readonly ProbeFact[] = [
  { zone: "America/Vancouver", tzdb2026e: "-07:00", release: "2026b" },
  { zone: "America/Edmonton", tzdb2026e: "-06:00", release: "2026c" },
  { zone: "Africa/Casablanca", tzdb2026e: "+00:00", release: "2026c" },
  { zone: "America/Inuvik", tzdb2026e: "-06:00", release: "2026d" },
  { zone: "America/Winnipeg", tzdb2026e: "-05:00", release: "2026e" },
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
  year: 2026 | 2027;
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
      expected: fact.tzdb2026e,
    })),
    instants: [
      { iso: PROBE_INSTANT, epochMs: PROBE_EPOCH_MS, role: "verdict" },
    ],
  };
}

/** The "Your browser" card's words. The HTML fields are written here, never by a reader. */
export const CANADA_VERDICT: VerdictText = {
  title: "Your browser",
  correctNote: "tzdb 2026e",
  yoursNote: "2 Nov 2026",
  checking: "Checking your browser&hellip;",
  right: "Your browser has the new rules for all four places.",
  wrongBefore: "Your browser has old time zone data for ",
  wrongAfter: ". From 1 November 2026 it shows their time an hour wrong.",
  more: [
    "<strong>For you:</strong> update your browser. If it is already up to date, its maker has not shipped the fix yet. Check again after the next update.",
    '<strong>For developers:</strong> your users&rsquo; browsers can be the same. See step 2 under <a href="#canada-developers">For developers</a>.',
  ],
  unknown: "Your browser cannot read these zones.",
};

/** The class word for a zone's `kind`: a dated phrase, so it stays true after 2027. */
export const KIND_LABELS: Readonly<Record<MapZone["kind"], string>> = {
  "stopped-2026": "Stops changing clocks in 2026",
  "changes-2027": "Still changes clocks",
  "none-2026-2027": "Never changes clocks",
};

export function mapKindLabel(kind: MapZone["kind"]): string {
  return KIND_LABELS[kind];
}

/** What the command prints on a runtime with the new data: `[city, offset]` per table zone. */
export function expectedProbeOutput(): [string, string][] {
  return TABLE_ZONES.map((fact) => [cityOf(fact.zone), fact.tzdb2026e]);
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
