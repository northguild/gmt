import type { BusinessCalendar } from "./business-calendar";

/**
 * How days are counted: every local calendar day, or only the terminal's working days. Used for
 * free time (`basis`) and, separately, for the days charged after it (`chargeBasis`), because
 * published tariffs commonly count the two differently.
 */
export type FreeTimeBasis = "calendar" | "working";

/**
 * Whether the day of the triggering event is free day one (`"eventDay"`), or free time starts
 * on the following counted day (`"nextDay"`). The two conventions differ by one full day of
 * charges, so no function defaults it.
 */
export type FreeTimeFirstDay = "eventDay" | "nextDay";

/**
 * The tariff terms a free-time count needs. Free time is set by carrier, lane, trade and service
 * contract, never by port, so every term is a parameter and no counting term has a default.
 */
export type FreeTimeOptions = {
  /**
   * Which days use up free time. `"calendar"` counts every local day, so a weekend burns two free
   * days while the terminal is shut; `"working"` counts only the days `calendar` marks as
   * working, and the clock does not run on weekends or holidays.
   */
  basis: FreeTimeBasis;
  /**
   * The time zone of the terminal, depot or yard whose local midnight ends a day, an IANA name or
   * UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or a stored offset
   * (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns). GMT does not resolve a port or terminal code
   * to a zone. A UTC offset such as `"+02:00"` observes no DST.
   */
  timeZone: string;
  /**
   * Where free time starts. `"eventDay"` makes the day of the event that starts the clock free
   * day one; `"nextDay"` starts free time on the following counted day.
   */
  firstDay: FreeTimeFirstDay;
  /**
   * The terminal's working week and holidays. It is required when a counting basis is
   * `"working"` and not read otherwise. Its own `timeZone` is not used: `timeZone` above is the
   * counting zone.
   *
   * @defaultValue None. A `"working"` basis without it is invalid input.
   */
  calendar?: BusinessCalendar;
};
