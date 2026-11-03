/**
 * The words of a dated clock-change checker's changes (CORE-89, CORE-91). A region states each
 * change as a `Moment` (the UTC instant and the offset in force just before it); every change is
 * past, so each sentence is written once in the past tense. This module holds the parts no region
 * owns:
 *
 * - the date and time words of a moment, written by the library (`formatZonedDateTime` for the
 *   local clock reading, `formatUtc` for UTC), never typed;
 * - the class phrase of a zone on a checker's map.
 *
 * The library comes in as `TenseLib` (the page loads it lazily, `loadClockLib`), so this file
 * carries no polyfill. No region words live here.
 */
import { SIGNAL_LOST } from "./clock-change-common";

/** One change of clocks: the UTC instant it takes effect, and the UTC offset in force just before it. */
export interface Moment {
  at: string;
  from: string;
}

/** A moment in words: `20 September 2026 at 02:00` on the local clock, and `01:00` in UTC. */
interface MomentWords {
  local: string;
  utc: string;
}

/** The library functions the words need. `ClockLib` (`clock-change-mount.ts`) carries them. */
export interface TenseLib {
  convertUtcToPlainDateTime(
    value: string,
    options: { timeZone: string },
  ): string;
  formatUtc(
    value: string,
    locale?: string,
    options?: Intl.DateTimeFormatOptions & { timeZone?: string },
  ): string;
  formatZonedDateTime(
    value: string,
    locale?: string,
    options?: Intl.DateTimeFormatOptions,
  ): string;
}

/** The words of a moment. */
export interface TenseView {
  /** The moment `key` in words, or `null` when the library could not write it. */
  words(key: string): MomentWords | null;
}

/** The key of the moment that decides a whole region's phrases: its latest change. */
export const REGION_KEY = "region";

/** One fixed locale and format for every page and the chat: day month year, 24-hour. */
const LOCALE = "en-GB";
const DATE_FORMAT = { day: "numeric", month: "long", year: "numeric" } as const;
const TIME_FORMAT = {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
} as const;

/**
 * The date and time of a moment, written by the library. The local reading is the instant at the
 * `from` offset, so it is the clock as it read just before the change; both the date and the time
 * come from `formatZonedDateTime`. The UTC time is `formatUtc`'s, with its date added when it is not
 * the local date. `null` when the library returns `""` for any part (invalid input).
 */
export function momentWords(lib: TenseLib, moment: Moment): MomentWords | null {
  const plain = lib.convertUtcToPlainDateTime(moment.at, {
    timeZone: moment.from,
  });
  if (plain === "") return null;
  const zoned = `${plain}${moment.from}[${moment.from}]`;
  const localDate = lib.formatZonedDateTime(zoned, LOCALE, DATE_FORMAT);
  const localTime = lib.formatZonedDateTime(zoned, LOCALE, TIME_FORMAT);
  const utcDate = lib.formatUtc(moment.at, LOCALE, DATE_FORMAT);
  const utcTime = lib.formatUtc(moment.at, LOCALE, TIME_FORMAT);
  if ([localDate, localTime, utcDate, utcTime].includes("")) return null;
  return {
    local: `${localDate} at ${localTime}`,
    utc: utcDate === localDate ? utcTime : `${utcDate} at ${utcTime}`,
  };
}

/**
 * A moment as the end of a phrase: `20 September 2026 at 02:00 local time`, with ` (01:00 UTC)`
 * when `withUtc`. The signal-lost mark when the library could not write the moment, never a blank.
 */
function whenText(words: MomentWords | null, withUtc: boolean): string {
  if (words === null) return SIGNAL_LOST;
  return withUtc
    ? `${words.local} local time (${words.utc} UTC)`
    : `${words.local} local time`;
}

/** The three classes of a zone on a checker's map. */
type ClassKind = "stopped" | "changes-after" | "none";

/**
 * The words of a map class. The class of the zones that stop names its change in the past tense:
 * the zone's own moment when `id` is a zone, the region's when `id` is `null` (the legend). A zone's
 * text states local time and UTC; the legend adds UTC only when `sharedInstant`, that is when every
 * stopped zone changes at one instant.
 */
export function classPhrase(
  kind: ClassKind,
  id: string | null,
  view: TenseView,
  sharedInstant: boolean,
): string {
  if (kind === "changes-after") return "Still changes clocks";
  if (kind === "none") return "Never changes clocks";
  const when = whenText(
    view.words(id ?? REGION_KEY),
    id !== null || sharedInstant,
  );
  return `Stopped changing clocks on ${when}`;
}

/** The region's change in words for a sentence: the date and local time, or the signal-lost mark. */
export function regionWhen(view: TenseView): string {
  return view.words(REGION_KEY)?.local ?? SIGNAL_LOST;
}

/**
 * The view of the moments a region states. A moment the library cannot read has no words (`null`).
 */
export function tenseView(
  lib: TenseLib,
  moments: Readonly<Record<string, Moment>>,
): TenseView {
  const worded = new Map<string, MomentWords | null>();
  return {
    words(key) {
      if (!worded.has(key)) {
        const moment = moments[key];
        if (moment === undefined) {
          throw new Error(`No change moment for ${key}.`);
        }
        worded.set(key, momentWords(lib, moment));
      }
      return worded.get(key) ?? null;
    },
  };
}
