/**
 * The pure helpers every dated tz-change checker shares (Canada's, and each later one): the shape
 * of a clock change, place names, offset words and the tick arithmetic. No DOM, no network, no
 * checker-specific fact, so the Worker and the page can both import it.
 */

/** One clock change in a zone, as `getDstTransitions` returns it. */
export interface Change {
  instant: string;
  offsetBefore: string;
  offsetAfter: string;
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

const OFFSET_PARTS = /^([+-])(\d{2}):(\d{2})(?::(\d{2}(?:\.\d{1,9})?))?$/;

/**
 * Seconds `offset` runs ahead of UTC, a fraction kept: `-05:00` is -18000 and Monrovia's
 * `-00:44:30` is -2670. `null` for text that is not `±HH:MM[:SS[.f]]`. Read without Temporal,
 * because the Worker and the page share this file and the page loads no polyfill for it.
 */
export function offsetSeconds(offset: string): number | null {
  const match = OFFSET_PARTS.exec(offset);
  if (match === null) return null;
  const [, sign, hours, minutes, seconds] = match;
  const total =
    Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds ?? 0);
  return sign === "-" ? -total : total;
}

/** Whole seconds ahead of UTC as `±HH:MM`, or `±HH:MM:SS` when not a whole minute. */
export function offsetFromSeconds(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hm = `${totalSeconds < 0 ? "-" : "+"}${pad(Math.floor(abs / 3600))}:${pad(Math.floor(abs / 60) % 60)}`;
  return abs % 60 === 0 ? hm : `${hm}:${pad(abs % 60)}`;
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
 * One clock change as a line of text, or "none in <emptyYears>" for `null`
 * (`emptyYears` such as `"2026 or 2027"`). The instant is UTC, to the minute, or
 * to the second when it falls between minutes.
 */
export function changeText(change: Change | null, emptyYears: string): string {
  if (change === null) return `none in ${emptyYears}`;
  const { instant, offsetBefore, offsetAfter } = change;
  return `${instant.slice(0, 10)} ${utcClockText(instant)} UTC, ${offsetBefore} → ${offsetAfter}`;
}

/**
 * The clock time of a UTC instant string (`…THH:MM:SS…Z`): `HH:MM`, or `HH:MM:SS` when the
 * seconds are not zero. Monrovia left `-00:44:30` at `1972-01-07T00:44:30Z`; cutting that to
 * `00:44` would name a moment 30 seconds early.
 */
export function utcClockText(instant: string): string {
  const hms = instant.slice(11, 19);
  return hms.endsWith(":00") ? hms.slice(0, 5) : hms;
}

/** Milliseconds from `now` to the next whole second, read from its fraction. */
export function msToNextSecond(now: string): number {
  const match = /:\d{2}\.(\d+)Z$/.exec(now);
  const millis = match === null ? 0 : Number(`0.${match[1]}`) * 1000;
  return Math.max(50, Math.ceil(1000 - millis));
}

/** The sentinel as a tooltip on a readout that has lost its signal. */
export const SIGNAL_LOST = "⟨ NO SIGNAL — invalid input ⟩";

/** The "Test your own servers" card's words: one source for the page, the `.md` twin and the llms files. */
export const SERVERS_TITLE = "Test your own servers";
export const SERVERS_LINE =
  "Run this wherever your code runs (servers, containers, CI). It must print the Correct offsets below. If it doesn't, update the runtime or the OS tzdata package and rebuild images.";

/**
 * The one-line Node probe the page offers for the reader's own runtime. It prints each city's UTC
 * offset at `epochMs`; the output matches the page's "Correct" column when the runtime carries the
 * new data. `GMT` alone (UTC) is read as `+00:00`. `epochMs` is a number, so the command and the
 * page need no native date object.
 */
export function nodeProbeCommand(
  zones: readonly string[],
  epochMs: number,
): string {
  return `node -e 'for (const z of ${JSON.stringify(zones)}) console.log(z.split("/").pop().replace("_", " "), new Intl.DateTimeFormat("en", { timeZone: z, timeZoneName: "longOffset" }).format(${epochMs}).replace(/.*GMT/, "") || "+00:00")'`;
}

/** A zone whose rule changed in a tzdb release, and the offset that release gives it. */
export interface ProbeFact {
  zone: string;
  /** The offset the reference release gives `zone` at the verdict instant. */
  offset: string;
  /** The first tzdb release that carries the change. */
  release: string;
}
