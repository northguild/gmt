import { Temporal } from "@js-temporal/polyfill";
import { instantFrom } from "../../internal";
import { isObject } from "../../internal/isObject";
import { type CutoffOptions, cutoffAt } from "./cutoffAt";

/** One named deadline in a cut-off stack: how long before the anchor, and at what local time. */
export interface Cutoff {
  /** The caller's label, echoed back (`"document"`, `"VGM"`); GMT does not interpret it. */
  name: string;
  /** The ISO 8601 duration before the anchor, as `cutoffAt` takes it. */
  offset: string;
  /**
   * The local time of day the cut-off is pinned to, as `cutoffAt` takes it.
   *
   * @defaultValue None. The cut-off is the offset taken off the anchor, with no time of day
   * pinned.
   */
  atLocalTime?: string;
}

/** One computed deadline in a cut-off schedule. */
export interface CutoffTime {
  /** The entry's `name`, echoed back. */
  name: string;
  /** The cut-off as a zoned string in the options' `timeZone`. */
  at: string;
}

/** Options for `cutoffSchedule`: `cutoffAt`'s, with `atLocalTime` read from each entry instead. */
export interface CutoffScheduleOptions {
  /** The time zone every cut-off is read in: an IANA name or a UTC offset. */
  timeZone: string;
  /**
   * The working week and holidays every cut-off's local date is rolled against. Requires `roll`.
   *
   * @defaultValue None. No cut-off's date is rolled; a `roll` without it returns `[]`.
   */
  calendar?: CutoffOptions["calendar"];
  /**
   * How a cut-off on a non-business day moves, as `rollDate` moves it. Requires `calendar`.
   *
   * @defaultValue None. No cut-off's date is rolled; a `calendar` without it returns `[]`.
   */
  roll?: CutoffOptions["roll"];
}

/**
 * Compute a whole stack of cut-offs against one anchor event, earliest first.
 *
 * An ocean booking carries several deadlines counted back from the same departure —
 * documentation, VGM, gate-in, customs — and when the vessel is rescheduled all of them move.
 * `cutoffSchedule` computes each entry with `cutoffAt` against the one anchor, so a new
 * departure is one call and every deadline follows it.
 *
 * - Each entry is `cutoffAt(anchor, entry.offset, { ...options, atLocalTime: entry.atLocalTime })`:
 *   the same local-time resolution, the same rolling, the same sentinel. `atLocalTime` belongs
 *   to the entry; one in `options` is not read.
 * - Sorted earliest first by instant, not by the text of the local time: on a fall-back day
 *   01:30 on the first pass is before 01:15 on the second. Entries on the same instant keep the
 *   order they were given in.
 * - `name` is an opaque string echoed back; duplicates are kept.
 * - Every entry must succeed: one invalid entry, or one cut-off in a skipped local hour,
 *   returns `[]` rather than a stack with a deadline silently missing. An empty `cutoffs` array
 *   returns `[]`.
 *
 * @param anchor ISO 8601 instant or zoned datetime string of the event the deadlines count back from
 * @param cutoffs the named deadlines, each with an offset and an optional local time of day
 * @param options The zone every cut-off is read in, and how one rolls off a non-business day, as cutoffAt takes them
 * @returns the named cut-offs, earliest first, or [] on invalid input
 *
 * @example cutoffSchedule("2024-06-14T16:00:00Z", [{ name: "gate-in", offset: "P1D" }, { name: "document", offset: "P2D", atLocalTime: "17:00" }, { name: "VGM", offset: "P1D", atLocalTime: "10:00" }], { timeZone: "Europe/Amsterdam" }) // [{ name: "document", at: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]" }, { name: "VGM", at: "2024-06-13T10:00:00+02:00[Europe/Amsterdam]" }, { name: "gate-in", at: "2024-06-13T18:00:00+02:00[Europe/Amsterdam]" }]
 * @example cutoffSchedule("2024-06-18T16:00:00Z", [{ name: "document", offset: "P2D", atLocalTime: "17:00" }, { name: "VGM", offset: "P1D", atLocalTime: "10:00" }], { timeZone: "Europe/Amsterdam", calendar: { weekend: [6, 7], holidays: [], timeZone: "Europe/Amsterdam" }, roll: "preceding" }) // [{ name: "document", at: "2024-06-14T17:00:00+02:00[Europe/Amsterdam]" }, { name: "VGM", at: "2024-06-17T10:00:00+02:00[Europe/Amsterdam]" }] (Sunday's document cut-off rolls back to Friday)
 * @example cutoffSchedule("2024-06-14T16:00:00Z", [], { timeZone: "Europe/Amsterdam" }) // []
 * @example cutoffSchedule("2024-06-14T16:00:00Z", [{ name: "document", offset: "2 days" }], { timeZone: "Europe/Amsterdam" }) // []
 * @example cutoffSchedule("2024-03-11T22:00:00Z", [{ name: "gate-in", offset: "P1D" }, { name: "VGM", offset: "P1D", atLocalTime: "02:30" }], { timeZone: "America/New_York" }) // [] (02:30 on 10 March never happened)
 */
export function cutoffSchedule(
  anchor: string,
  cutoffs: Cutoff[],
  options: CutoffScheduleOptions,
): CutoffTime[] {
  try {
    if (!Array.isArray(cutoffs) || !isObject(options)) {
      return [];
    }
    const { timeZone, calendar, roll } = options;

    const schedule: { name: string; at: string; instant: Temporal.Instant }[] =
      [];
    for (const cutoff of cutoffs) {
      if (!isObject(cutoff)) {
        return [];
      }
      const { name, offset, atLocalTime } = cutoff as Cutoff;
      if (typeof name !== "string") {
        return [];
      }
      const at = cutoffAt(anchor, offset, {
        timeZone,
        atLocalTime,
        calendar,
        roll,
      });
      if (at === "") {
        return [];
      }
      schedule.push({ name, at, instant: instantFrom(at) });
    }

    // Array.prototype.sort is stable, so entries on the same instant keep their input order.
    return schedule
      .sort((a, b) => Temporal.Instant.compare(a.instant, b.instant))
      .map(({ name, at }) => ({ name, at }));
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
