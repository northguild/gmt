import { Temporal } from "@js-temporal/polyfill";
import type { Disambiguation, Offset } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return an array of zoned datetime strings representing each hour boundary of the anchor's local day.
 *
 * - With no options, steps hourly from the day's `startOfDay()` up to (not including) the next day's `startOfDay()`, so the result always stays on the anchor's date. A day whose local midnight is skipped (e.g. `America/Santiago` on 2024-09-08) starts at 01:00 and has 23 entries.
 * - Passing `disambiguation` or `offset` opts into wall-clock resolution instead: the window starts at local midnight resolved with those options and runs 24 wall-clock hours, which can end on the next date.
 * - Handles DST transitions by skipping non-existent hours in the loop (independent of `disambiguation`/`offset` below — arithmetic `.add()` never consults either option, it always resolves as Temporal's default).
 * - In zones with a 30-minute shift (`Australia/Lord_Howe`), entries after the transition land on :30 — hourly steps are exact elapsed hours, not wall-clock hour marks (2024-10-06 gives `00:00`, `01:00`, `02:30`, … `23:30`).
 * - `disambiguation` controls DST gap/overlap resolution only for the midnight anchor itself, on the rare zone/date where local midnight is itself ambiguous (most IANA zones transition at 2am/3am, not midnight): "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in `[]`).
 * - `offset` controls whether the source's existing UTC offset is kept when computing the midnight anchor: "prefer" (Temporal's own default — keeps the source offset whenever still valid for the target midnight, which **makes `disambiguation` inert in that case**; note this is not universal — if the source's offset isn't valid for midnight at all (e.g. midnight itself falls inside a gap), `"prefer"` still throws/resolves via `disambiguation` same as `"ignore"` would), "use", "ignore" (**this function's default** — always recomputes from time zone + local time, discarding the stale offset), or "reject" (throws if the source offset is invalid for midnight, independent of `disambiguation`). Leave `offset` at its default unless you specifically need Temporal's raw `.with()` semantics.
 * - Returns [] for invalid input.
 *
 * @param anchor zoned ISO 8601 datetime string used as anchor
 * @param optionsArg optional: disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore")
 * @returns array of zoned ISO 8601 strings for each hour in the day
 *
 * @example mapZonedHoursInDay("2024-02-29T12:34:56.789+00:00[UTC]") // ["2024-02-29T00:00:00+00:00[UTC]", "2024-02-29T01:00:00+00:00[UTC]", ..., "2024-02-29T23:00:00+00:00[UTC]"]
 * @example mapZonedHoursInDay("2024-03-10T12:34:56.789-05:00[America/New_York]") // ["2024-03-10T00:00:00-05:00[America/New_York]", ...] (skips 2 AM due to DST; unaffected by `disambiguation` since this gap is inside the loop's arithmetic, not the anchor)
 * @example mapZonedHoursInDay("2024-09-08T12:00:00-03:00[America/Santiago]") // ["2024-09-08T01:00:00-03:00[America/Santiago]", ..., "2024-09-08T23:00:00-03:00[America/Santiago]"] (23 entries; midnight is skipped)
 * @example mapZonedHoursInDay("2018-11-04T12:00:00-02:00[America/Sao_Paulo]", { disambiguation: "reject" }) // [] (midnight itself is the DST transition in this historical Brazil zone/date, so the anchor is ambiguous and "reject" throws)
 * @example mapZonedHoursInDay("2018-11-04T12:00:00-02:00[America/Sao_Paulo]", { disambiguation: "reject", offset: "prefer" }) // [] (the source's -02:00 offset is also invalid at midnight here, so even "prefer" falls through to disambiguation and "reject" still throws — contrast with startOfZoned's Nov 3 America/New_York example, where "prefer" IS valid at the target time and suppresses disambiguation)
 * @example mapZonedHoursInDay("invalid") // []
 */
export function mapZonedHoursInDay(
  anchor: string,
  optionsArg?: { disambiguation?: Disambiguation; offset?: Offset },
): string[] {
  if (!isValidZonedDateTime(anchor)) {
    return [];
  }

  const disambiguation = optionsArg?.disambiguation ?? "compatible";
  const offset = optionsArg?.offset ?? "ignore";

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(anchor);
    const wallClock =
      optionsArg?.disambiguation !== undefined ||
      optionsArg?.offset !== undefined;

    // Default: the real local day, from its first instant to the next day's first instant.
    const start = wallClock
      ? zonedDateTime.with(
          {
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
            microsecond: 0,
            nanosecond: 0,
          },
          { disambiguation, offset },
        )
      : zonedDateTime.startOfDay();
    const nextDay = wallClock
      ? start.add({ days: 1 })
      : zonedDateTime.add({ days: 1 }).startOfDay();

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
