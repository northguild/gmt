/**
 * Loads the real gmt functions the operating-hours tools call, at module granularity, and hands
 * them back as an `HoursLib`.
 *
 * The six operating functions live in `calendar/hours`; `isValidOperatingSchedule` is
 * `calendar/validate`'s, `isValidInterval` is `interval/validate`'s and `isValidDuration` is
 * `duration/validate`'s. Each name is picked from its module and nothing else is read.
 *
 * A heavy module: only a tool's mount, a facts test or a WebMCP tool imports it, never the chat
 * island's static graph. A module that fails to load, or a name it no longer exports, becomes a
 * `WidgetLoadError` rather than a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import { pickTyped } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

type Hours = typeof import("@northguild/gmt/calendar/hours");
type CalendarValidate = typeof import("@northguild/gmt/calendar/validate");
type IntervalValidate = typeof import("@northguild/gmt/interval/validate");
type DurationValidate = typeof import("@northguild/gmt/duration/validate");

/** The functions the operating-hours tools call, as the library declares them. */
export type HoursLib = Pick<
  Hours,
  | "operatingIntervals"
  | "isOpenAt"
  | "nextOpenAt"
  | "nextCloseAt"
  | "operatingTimeBetween"
  | "addOperatingTime"
> &
  Pick<CalendarValidate, "isValidOperatingSchedule"> &
  Pick<IntervalValidate, "isValidInterval"> &
  Pick<DurationValidate, "isValidDuration">;

export async function loadHoursLib(): Promise<HoursLib> {
  try {
    const [hours, calendarValidate, intervalValidate, durationValidate] =
      await Promise.all([
        GMT_MODULES["calendar/hours"](),
        GMT_MODULES["calendar/validate"](),
        GMT_MODULES["interval/validate"](),
        GMT_MODULES["duration/validate"](),
      ]);
    return {
      ...pickTyped<
        Hours,
        | "operatingIntervals"
        | "isOpenAt"
        | "nextOpenAt"
        | "nextCloseAt"
        | "operatingTimeBetween"
        | "addOperatingTime"
      >(hours, [
        "operatingIntervals",
        "isOpenAt",
        "nextOpenAt",
        "nextCloseAt",
        "operatingTimeBetween",
        "addOperatingTime",
      ]),
      ...pickTyped<CalendarValidate, "isValidOperatingSchedule">(
        calendarValidate,
        ["isValidOperatingSchedule"],
      ),
      ...pickTyped<IntervalValidate, "isValidInterval">(intervalValidate, [
        "isValidInterval",
      ]),
      ...pickTyped<DurationValidate, "isValidDuration">(durationValidate, [
        "isValidDuration",
      ]),
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
