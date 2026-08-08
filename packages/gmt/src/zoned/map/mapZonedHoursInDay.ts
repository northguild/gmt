import { Temporal } from "@js-temporal/polyfill";
import type { Disambiguation, Offset } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return an array of zoned datetime strings representing each hour boundary for the 24-hour window starting at midnight of the anchor's local day.
 *
 * - Handles DST transitions by skipping non-existent hours in the loop (independent of `disambiguation`/`offset` below — arithmetic `.add()` never consults either option, it always resolves as Temporal's default).
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

    const start = zonedDateTime.with(
      {
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
      },
      { disambiguation, offset },
    );
    const nextDay = start.add({ days: 1 });

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
