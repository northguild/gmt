/**
 * The facts and shapes every clock-change checker shares, the Worker and the page alike. Pure: no
 * DOM, no network, no HTML. The Worker computes every value at request time; nothing here holds a
 * computed offset, because the runtime's time zone data is what a checker page exists to show.
 *
 * A checker supplies a `ClockCheckFacts` (its id, its API path, its probe instant and zones) and
 * the rest of the checker reads from it.
 */
import type { StoredZonedClassification } from "@northguild/gmt";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";

/** A zone whose rule changed in a tzdb release, with the offsets either side of the change. */
export interface ProbeFact {
  zone: string;
  /** The offset the reference tz data gives `zone` at the probe instant. */
  offset: string;
  /** The offset `zone` had at that instant under the rules before the change. */
  oldOffset: string;
  /** The first tzdb release that carries the change. */
  release: string;
}

export interface ProbeRow {
  zone: string;
  offset: string;
}

export interface Change {
  instant: string;
  offsetBefore: string;
  offsetAfter: string;
}

export interface ZoneNow {
  zone: string;
  offset: string;
  last: Change | null;
  next: Change | null;
}

export interface TransitionRow extends Change {
  zone: string;
  year: number;
  wallBefore: string;
}

/** What one checker is: shared by its Worker handler and its page. */
export interface ClockCheckFacts {
  /** a short lowercase word: the rate-limit bucket, the root class `gmt-<id>` and the API path `/api/<id>-clock-change`. */
  id: string;
  /** A UTC instant (ends in `Z`). The epoch milliseconds are derived from it, never written twice. */
  probeInstant: string;
  /** The API's probe rows. */
  probe: readonly ProbeFact[];
  transitionYears: readonly number[];
  clockZones: readonly string[];
  storedZones: readonly string[];
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
 * A checker's rate-limit policy, shared by GET and POST. Per isolate, like the chat limiter:
 * blunt protection, not a global limit.
 */
export const CHECK_RATE_LIMIT = { max: 20, windowSeconds: 60 } as const;

/**
 * `facts.probeInstant` as epoch milliseconds. `Intl.DateTimeFormat#formatToParts` takes a number,
 * so the page needs no native date object to read the browser's offset.
 */
export function probeEpochMs(
  facts: Pick<ClockCheckFacts, "probeInstant">,
): number {
  const epoch = convertUtcToUnix(facts.probeInstant);
  if (epoch === null) {
    throw new Error(
      `The probe instant "${facts.probeInstant}" is not a UTC instant.`,
    );
  }
  return epoch;
}

/** `America/Los_Angeles` as `Los Angeles`: the place name of a zone id. */
export function cityOf(zone: string): string {
  return (zone.split("/").at(-1) ?? zone).replace(/_/g, " ");
}

/** An offset for display: the minus sign is U+2212, so it reads as a minus and not a hyphen. */
export function signedOffset(offset: string): string {
  return offset.replace("-", "−");
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

/**
 * The one-line Node probe a page offers for the reader's own runtime. It prints each city's UTC
 * offset at the probe instant; the output matches the page's "Correct" column when the runtime
 * carries the reference tz data. `GMT` alone (UTC) is read as `+00:00`.
 */
export function nodeProbeCommand(
  table: readonly ProbeFact[],
  probeInstant: string,
): string {
  return `node -e 'for (const z of ${JSON.stringify(table.map((fact) => fact.zone))}) console.log(z.split("/").pop().replace("_", " "), new Intl.DateTimeFormat("en", { timeZone: z, timeZoneName: "longOffset" }).format(${probeEpochMs({ probeInstant })}).replace(/.*GMT/, "") || "+00:00")'`;
}

/** What the command prints on a runtime with the new data: `[city, offset]` per table zone. */
export function expectedProbeOutput(
  table: readonly ProbeFact[],
): [string, string][] {
  return table.map((fact) => [cityOf(fact.zone), fact.offset]);
}
