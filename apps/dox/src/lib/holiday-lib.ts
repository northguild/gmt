/**
 * Loads the real gmt functions the three holiday tools share (the Holiday Rule
 * Builder, the Observance Comparator and Moving Feasts), at module granularity,
 * and hands them back as a `HolidayLib`.
 *
 * `nthWeekdayOfMonth`, `easterSunday`, `observedDate`, `holidayDates` and
 * `buildBusinessCalendar` live in `calendar/rules`; `isValidHolidayRule` in
 * `calendar/validate`; `isBusinessDay` and `areDatesEqual` in `plain/compare`.
 * Each name is picked from its module and nothing else is read. Moving Feasts
 * extends this with `plain/calculate` in its own loader.
 *
 * The types come from the library. Re-declaring `HolidayRule` here would be a
 * second source of truth for a shape the library owns.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * each widget's mount reaches it, so a rejected import, or a name a module no
 * longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import type {
  BusinessCalendar,
  BusinessCalendarSpec,
  HolidayDatesOptions,
  HolidayRule,
  ObservancePolicy,
  WeekdayOrdinal,
} from "@northguild/gmt";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

/** The functions the three tools call, as the library declares them. */
export interface HolidayLib {
  // calendar/rules
  nthWeekdayOfMonth(
    year: number,
    month: number,
    weekday: number,
    n: WeekdayOrdinal,
  ): string;
  easterSunday(
    year: number,
    options?: { computus?: "gregorian" | "julian" },
  ): string;
  observedDate(
    isoDate: string,
    policy: ObservancePolicy,
    calendar?: BusinessCalendar,
  ): string;
  holidayDates(
    rule: HolidayRule,
    year: number,
    options?: HolidayDatesOptions,
  ): string[];
  buildBusinessCalendar(spec: BusinessCalendarSpec): BusinessCalendar | null;
  // calendar/validate
  isValidHolidayRule(rule: unknown): rule is HolidayRule;
  // plain/compare
  isBusinessDay(value: string, calendar?: BusinessCalendar): boolean;
  areDatesEqual(a: string, b: string): boolean;
}

/** Reads each name from a module, and fails loudly on a name it lacks. */
function pick(module: Record<string, unknown>, names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => {
      if (typeof module[name] !== "function") {
        throw new Error(`The library module has no ${name}.`);
      }
      return [name, module[name]];
    }),
  );
}

export async function loadHolidayLib(): Promise<HolidayLib> {
  try {
    const [rules, validate, compare] = await Promise.all([
      GMT_MODULES["calendar/rules"](),
      GMT_MODULES["calendar/validate"](),
      GMT_MODULES["plain/compare"](),
    ]);
    return {
      ...pick(rules, [
        "nthWeekdayOfMonth",
        "easterSunday",
        "observedDate",
        "holidayDates",
        "buildBusinessCalendar",
      ]),
      ...pick(validate, ["isValidHolidayRule"]),
      ...pick(compare, ["isBusinessDay", "areDatesEqual"]),
    } as unknown as HolidayLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
