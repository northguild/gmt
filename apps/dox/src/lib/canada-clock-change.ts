/**
 * The Canada 2026 clock-change checker — the facts and shapes the server and the page share.
 * Pure: no DOM, no network. `worker/canada-clock-change.ts` computes every value at request
 * time; nothing here holds a computed offset, because the runtime's time zone data is what the page
 * exists to show.
 */
import type { StoredZonedClassification } from "@northguild/gmt";
import { minimumsMarkdown } from "../data/canada-runtime-minimums";
import { helpMarkdown } from "../data/canada-key-points";

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

/** `America/Los_Angeles` as `Los Angeles`: the place name of a zone id. */
export function cityOf(zone: string): string {
  return (zone.split("/").at(-1) ?? zone).replace(/_/g, " ");
}

/** An offset for display: the minus sign is U+2212, so it reads as a minus and not a hyphen. */
export function signedOffset(offset: string): string {
  return offset.replace("-", "\u2212");
}
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
 * The most lines a POST classifies. The Worker runs the polyfill on workerd and is budgeted for
 * the Workers Free limit of 10 ms CPU per request (over it is Error 1102). Measured under
 * `wrangler dev` from the client, distinct Toronto lines, warm, median of 12 posts, minus a
 * 1-line baseline of about 2 ms: 25 lines 3.8 ms, 50 lines 7.0 to 7.4 ms, 60 lines 8.3 ms, 100 lines 14.0 ms,
 * 200 lines 29.4 ms: about 0.15 ms a line. 50 is the largest that stays near 7 ms; with the
 * baseline that is about 9.4 ms of wall time, which overstates CPU time. Re-measure before
 * raising it; the deploy smoke posts this many lines and checks every one was read.
 */
export const STORED_MAX_LINES = 50;
export const STORED_MAX_BYTES = 20_000;

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

export interface Change {
  instant: string;
  offsetBefore: string;
  offsetAfter: string;
}

export interface MapZone {
  zone: string;
  offset: string;
  last: Change | null;
  next: Change | null;
  kind: "stopped-2026" | "changes-2027" | "none-2026-2027";
}

export interface CanadaCheck {
  now: string;
  probe: ProbeRow[];
  transitions: TransitionRow[];
  zones: MapZone[];
}

/** One posted line, classified with the server's time zone data. */
export interface StoredRow {
  /** 1-based line number in the input. */
  line: number;
  /** The line as posted. */
  input: string;
  /** The string classified, after the zone is completed; `null` when no form completes it. */
  value: string | null;
  result: StoredZonedClassification | null;
}

/** The `POST` answer. */
export interface StoredCheck {
  zone: string;
  /** True when the input was over `STORED_MAX_LINES` lines or `STORED_MAX_BYTES` bytes. */
  truncated: boolean;
  rows: StoredRow[];
}

/**
 * The one-line Node probe the page offers for the reader's own runtime. It prints each
 * city's UTC offset at `PROBE_INSTANT`; the output matches the page's "Correct" column when the
 * runtime carries tzdb 2026e data. `GMT` alone (UTC) is read as `+00:00`.
 */
export const NODE_PROBE_COMMAND = `node -e 'for (const z of ${JSON.stringify(TABLE_ZONES.map((fact) => fact.zone))}) console.log(z.split("/").pop().replace("_", " "), new Intl.DateTimeFormat("en", { timeZone: z, timeZoneName: "longOffset" }).format(${PROBE_EPOCH_MS}).replace(/.*GMT/, "") || "+00:00")'`;

const KIND_LABELS: Record<MapZone["kind"], string> = {
  "stopped-2026": "Stops changing clocks in 2026",
  "changes-2027": "Still changes clocks",
  "none-2026-2027": "Never changes clocks",
};

/** The class word for a zone's `kind`: a dated phrase, so it stays true after 2027. */
export function mapKindLabel(kind: MapZone["kind"]): string {
  return KIND_LABELS[kind];
}

/**
 * One clock change as a line of text, or "none in <emptyYears>" for `null`
 * (`emptyYears` such as `"2026 or 2027"`). The instant is UTC, to the minute.
 */
export function changeText(change: Change | null, emptyYears: string): string {
  if (change === null) return `none in ${emptyYears}`;
  const { instant, offsetBefore, offsetAfter } = change;
  return `${instant.slice(0, 10)} ${instant.slice(11, 16)} UTC, ${offsetBefore} → ${offsetAfter}`;
}

/**
 * `Intl.DateTimeFormat` `longOffset` text as a stored offset: `"GMT-07:00"` is `"-07:00"`,
 * `"GMT+05:30"` is `"+05:30"`, and a bare `"GMT"` is `"+00:00"`. Text that is not a `longOffset`
 * returns `""`, so the caller shows the browser column as unknown rather than guessing.
 */
export function offsetFromIntl(longOffset: string): string {
  if (longOffset === "GMT") return "+00:00";
  const match = /^GMT([+\-−])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(longOffset);
  if (match === null) return "";
  const [, sign, hours, minutes, seconds] = match;
  const base = `${sign === "+" ? "+" : "-"}${hours}:${minutes}`;
  return seconds === undefined ? base : `${base}:${seconds}`;
}

/**
 * The `HH:MM:SS` of a plain date-time (`YYYY-MM-DDTHH:mm[:ss[.f]]`). A string with no seconds
 * field reads `:00`.
 */
export function wallHms(wall: string): string {
  const seconds = wall[16] === ":" ? wall.slice(17, 19) : "";
  return `${wall.slice(11, 16)}:${/^\d\d$/.test(seconds) ? seconds : "00"}`;
}

/** The "Test your own servers" card's words: one source for the page, the `.md` twin and the llms files. */
export const SERVERS_TITLE = "Test your own servers";
export const SERVERS_LINE =
  "Run this wherever your code runs (servers, containers, CI). It must print the Correct offsets below. If it doesn't, update the runtime or the OS tzdata package and rebuild images.";

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
    minimumsMarkdown(),
    helpMarkdown(),
  ].join("\n");
}
