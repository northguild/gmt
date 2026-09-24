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
 *
 * - `basis`: `"calendar"` counts every local day, so a weekend burns two free days while the
 *   terminal is shut; `"working"` counts only the days `calendar` marks as working, and the
 *   clock does not run on weekends or holidays.
 * - `timeZone`: the IANA identifier of the terminal, depot or yard whose local midnight ends a
 *   day. GMT does not resolve a port or terminal code to a zone. A fixed offset such as
 *   `"+02:00"` is accepted, as `isValidTimeZone` accepts it, but observes no DST.
 * - `firstDay`: `"eventDay"` or `"nextDay"`, see `FreeTimeFirstDay`.
 * - `calendar`: the terminal's `BusinessCalendar`, required when `basis` is `"working"` and not
 *   read when it is `"calendar"`. Its `timeZone` field is not read either, as the business-day
 *   functions never read it: `timeZone` above is the counting zone.
 */
export type FreeTimeOptions = {
  basis: FreeTimeBasis;
  timeZone: string;
  firstDay: FreeTimeFirstDay;
  calendar?: BusinessCalendar;
};
