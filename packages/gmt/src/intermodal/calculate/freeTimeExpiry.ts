import { Temporal } from "@js-temporal/polyfill";
import {
  parseFreeDays,
  parseFreeTimeTerms,
  walkFreeTime,
} from "../../internal";
import { isValidInstant } from "../../precision/validate/isValidInstant";
import type { FreeTimeOptions } from "../../types";

/** What `freeTimeExpiry` returns: the free-time window as local dates, and the instant it ends. */
export interface FreeTime {
  /** Free day one, as a local date in the counting zone. */
  freeTimeStart: string;
  /** The last free day, as a local date in the counting zone. */
  lastFreeDay: string;
  /** The instant free time ends: the start of the local day after `lastFreeDay`, as a UTC instant. */
  expiresAt: string;
}

/**
 * Lay out a container's free time from the instant its clock started, and say when it ends.
 *
 * Free time is the money calculation in container logistics, and none of its terms is a fact
 * about the port: the number of free days, whether the day of discharge is free day one, and
 * whether weekends count are all set by the carrier's tariff or the service contract. So every
 * term is a parameter. No regulation or industry standard fixes how free time is counted (DCSA
 * types only its unit, calendar or working days); the result is the window every tariff states,
 * and on US trades the US invoice rule requires an invoice to print it: the allowed free time and
 * the start and end dates of free time (46 CFR 541.6(b)(3)–(5)).
 *
 * - **Days are the terminal's local days.** `clockStart` is an instant (`Z`, an offset, or a
 *   bracketed zone, of which only the instant is read); its local date in `options.timeZone` is
 *   the event day. A container discharged at 23:00 has used a free day by 00:01 under
 *   `firstDay: "eventDay"`. Day boundaries are the zone's real ones, as `floorToZone` and
 *   `dwellTime` find them: a 23- or 25-hour day is one day, a date the zone deleted is never a
 *   free day, and a fall-back that re-enters an earlier date never moves the count backwards.
 * - **`firstDay` has no default.** `"eventDay"` makes the event day free day one; `"nextDay"`
 *   starts free time on the following counted day. The two differ by exactly one day of charges,
 *   and a silent default here is a wrong invoice, so omitting it returns `null`.
 * - **`basis` decides which days count.** `"calendar"` counts every local day, so a weekend
 *   burns two free days while the terminal is shut. `"working"` counts only the working days of
 *   `options.calendar` (its weekend and holidays; `calendar.timeZone` is not read), and is
 *   required to have one: a working-day count without a calendar is a guess and returns `null`.
 *   Under `"working"` a Saturday discharge starts free time on Monday under either `firstDay`.
 *   A tariff counting "calendar days excluding bank holidays" (Hapag-Lloyd Japan, MSC Vietnam) is
 *   `"working"` with an empty `weekend`. How days after expiry are charged is a separate term;
 *   see `chargeableDays`'s `chargeBasis`.
 * - **`expiresAt` is half-open.** It is the first instant of the local day after `lastFreeDay`,
 *   as a UTC instant. A gate-out at exactly `expiresAt` is not a chargeable day; see
 *   `chargeableDays`. Under `"working"` it can fall on a weekend, which is then simply not
 *   chargeable.
 * - `freeDays` is a whole number of at least `1`: with no free days there is no last free day
 *   to name, and `chargeableDays` accepts `0` for that tariff.
 * - Returns `null` when `clockStart` is not an instant, `freeDays` is not a whole number of at
 *   least `1`, `options` is not an object, `basis` or `firstDay` is missing or unknown,
 *   `timeZone` is invalid, `basis` is `"working"` without a valid `BusinessCalendar`, or the walk
 *   would pass 10,000 local days.
 *
 * @param clockStart ISO 8601 instant string of the event that starts the clock (discharge, availability or gate-out)
 * @param freeDays whole number of free days the tariff allows, at least 1
 * @param options { basis: "calendar" | "working", timeZone: string, firstDay: "eventDay" | "nextDay", calendar?: BusinessCalendar }
 * @returns the free-time start and last free day as local dates, and the expiry instant, or null on invalid input
 *
 * @example freeTimeExpiry("2024-06-14T19:00:00Z", 3, { basis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }) // { freeTimeStart: "2024-06-14", lastFreeDay: "2024-06-16", expiresAt: "2024-06-17T04:00:00Z" } (a Friday discharge: the weekend is consumed)
 * @example freeTimeExpiry("2024-06-14T19:00:00Z", 3, { basis: "calendar", timeZone: "America/New_York", firstDay: "nextDay" }) // { freeTimeStart: "2024-06-15", lastFreeDay: "2024-06-17", expiresAt: "2024-06-18T04:00:00Z" } (the same tariff read the other way: one more day)
 * @example freeTimeExpiry("2024-06-14T19:00:00Z", 3, { basis: "working", timeZone: "America/New_York", firstDay: "eventDay", calendar: { weekend: [6, 7], holidays: [], timeZone: "America/New_York" } }) // { freeTimeStart: "2024-06-14", lastFreeDay: "2024-06-18", expiresAt: "2024-06-19T04:00:00Z" } (Friday, Monday, Tuesday: the weekend does not count)
 * @example freeTimeExpiry("2024-06-14T19:00:00Z", 3, { basis: "working", timeZone: "America/New_York", firstDay: "eventDay", calendar: { weekend: [6, 7], holidays: ["2024-06-17"], timeZone: "America/New_York" } }) // { freeTimeStart: "2024-06-14", lastFreeDay: "2024-06-19", expiresAt: "2024-06-20T04:00:00Z" } (a terminal holiday on the Monday moves expiry a day)
 * @example freeTimeExpiry("2024-06-15T14:00:00Z", 2, { basis: "working", timeZone: "America/New_York", firstDay: "eventDay", calendar: { weekend: [6, 7], holidays: [], timeZone: "America/New_York" } }) // { freeTimeStart: "2024-06-17", lastFreeDay: "2024-06-18", expiresAt: "2024-06-19T04:00:00Z" } (a Saturday discharge: free time starts Monday)
 * @example freeTimeExpiry("2024-06-15T03:00:00Z", 1, { basis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }) // { freeTimeStart: "2024-06-14", lastFreeDay: "2024-06-14", expiresAt: "2024-06-15T04:00:00Z" } (23:00 local on the 14th: the free day is over an hour later)
 * @example freeTimeExpiry("2024-09-07T15:00:00Z", 1, { basis: "calendar", timeZone: "America/Santiago", firstDay: "eventDay" }) // { freeTimeStart: "2024-09-07", lastFreeDay: "2024-09-07", expiresAt: "2024-09-08T04:00:00Z" } (Santiago skipped midnight on the 8th, so the day starts at 01:00)
 * @example freeTimeExpiry("2024-06-14T19:00:00Z", 3, { basis: "calendar", timeZone: "America/New_York" }) // null (firstDay has no default)
 * @example freeTimeExpiry("2024-06-14T19:00:00Z", 3, { basis: "working", timeZone: "America/New_York", firstDay: "eventDay" }) // null (a working-day count needs the terminal's calendar)
 * @example freeTimeExpiry("2024-06-14T19:00:00Z", 0, { basis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }) // null (no free days means no last free day)
 * @example freeTimeExpiry("2024-06-14T19:00:00", 3, { basis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }) // null (no offset: not an instant)
 */
export function freeTimeExpiry(
  clockStart: string,
  freeDays: number,
  options: FreeTimeOptions,
): FreeTime | null {
  const terms = parseFreeTimeTerms(options);
  const allowed = parseFreeDays(freeDays, 1);

  if (!isValidInstant(clockStart) || terms === null || allowed === null) {
    return null;
  }

  try {
    const start = Temporal.Instant.from(clockStart).toZonedDateTimeISO(
      terms.timeZone,
    );
    const ledger = walkFreeTime(start, allowed, terms);
    if (ledger === null) {
      return null;
    }

    return {
      freeTimeStart: ledger.free[0].date,
      lastFreeDay: ledger.free[allowed - 1].date,
      expiresAt: ledger.expiresAt.toInstant().toString(),
    };
  } catch {
    return null;
  }
}
