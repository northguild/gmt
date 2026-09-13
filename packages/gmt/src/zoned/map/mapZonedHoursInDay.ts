import { Temporal } from "@js-temporal/polyfill";
import type { Disambiguation, Offset } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return an array of zoned datetime strings representing each hour boundary of the anchor's local day.
 *
 * - Steps hourly from the day's `startOfDay()` up to (not including) the next day's `startOfDay()`, so the result always stays on the anchor's date. A day whose local midnight is skipped (e.g. `America/Santiago` on 2024-09-08) starts at 01:00 and has 23 entries.
 * - Handles DST transitions: hourly steps are exact elapsed hours, so a spring-forward day has 23 entries and a fall-back day 25.
 * - In zones with a 30-minute shift (`Australia/Lord_Howe`), entries after the transition land on :30 — hourly steps are exact elapsed hours, not wall-clock hour marks (2024-10-06 gives `00:00`, `01:00`, `02:30`, … `23:30`).
 * - The day is the anchor's calendar date, as TC39's `startOfDay()`/`hoursInDay` define it. This differs from `startOfZoned(…, "day")` only where a fall-back re-enters the previous date: `America/Goose_Bay` fell back at 00:01 on 2010-11-07, so an anchor at `2010-11-06T23:30:00-04:00` maps 6 November's 24 hours (ending at 00:00-03:00 on the 7th, before the anchor), while `startOfZoned` puts that anchor in a reopened 59-minute day.
 * - `disambiguation` and `offset` are deprecated and ignored: the day's window is always real instants, as TC39's `startOfDay()` takes neither.
 * - Returns [] for invalid input.
 *
 * @param anchor zoned ISO 8601 datetime string used as anchor
 * @param optionsArg optional: disambiguation and offset (deprecated, ignored)
 * @returns array of zoned ISO 8601 strings for each hour in the day
 *
 * @example mapZonedHoursInDay("2024-02-29T12:34:56.789+00:00[UTC]") // ["2024-02-29T00:00:00+00:00[UTC]", "2024-02-29T01:00:00+00:00[UTC]", ..., "2024-02-29T23:00:00+00:00[UTC]"]
 * @example mapZonedHoursInDay("2024-03-10T12:34:56.789-05:00[America/New_York]") // ["2024-03-10T00:00:00-05:00[America/New_York]", ...] (23 entries; 2 AM is skipped)
 * @example mapZonedHoursInDay("2024-09-08T12:00:00-03:00[America/Santiago]") // ["2024-09-08T01:00:00-03:00[America/Santiago]", ..., "2024-09-08T23:00:00-03:00[America/Santiago]"] (23 entries; midnight is skipped)
 * @example mapZonedHoursInDay("2018-11-04T12:00:00-02:00[America/Sao_Paulo]", { disambiguation: "reject" }) // ["2018-11-04T01:00:00-02:00[America/Sao_Paulo]", ...] (23 entries; midnight is skipped and the deprecated option is ignored)
 * @example mapZonedHoursInDay("invalid") // []
 */
export function mapZonedHoursInDay(
  anchor: string,
  _optionsArg?: {
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    disambiguation?: Disambiguation;
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    offset?: Offset;
  },
): string[] {
  if (!isValidZonedDateTime(anchor)) {
    return [];
  }

  try {
    const start = Temporal.ZonedDateTime.from(anchor).startOfDay();
    const nextDay = start.add({ days: 1 }).startOfDay();

    const result: string[] = [];

    for (
      let current = start;
      Temporal.Instant.compare(current.toInstant(), nextDay.toInstant()) < 0;
      current = current.add({ hours: 1 })
    ) {
      result.push(current.toString());
    }

    return result;
  } catch {
    return [];
  }
}
