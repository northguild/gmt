import { Temporal } from "@js-temporal/polyfill";
import {
  bandsByTier,
  parseFreeDays,
  parseFreeTimeTerms,
  parseTiers,
  walkFreeTime,
} from "../../internal";
import { isValidInstant } from "../../precision/validate/isValidInstant";
import type { FreeTimeBasis, FreeTimeOptions } from "../../types";

/** A band of chargeable-day ordinals and how many of the charged days fell in it. */
export interface TierBand {
  /** First chargeable-day ordinal of the band, from 1. */
  from: number;
  /** Last ordinal of the band, or `null` for the open final band. */
  to: number | null;
  /** Charged days that fell in the band. */
  days: number;
}

/** What `chargeableDays` returns: the day count an invoice bills, and the dates that back it. */
export interface FreeTimeCharges {
  /** Free days the dwell touched, at most the tariff's `freeDays`. */
  freeDaysUsed: number;
  /** Counted days on or after `expiresAt` the dwell touched. */
  chargeableDays: number;
  /** The instant free time ended, as a UTC instant, as `freeTimeExpiry` reports it. */
  expiresAt: string;
  /**
   * The local dates charged, ascending. Carriers' day-numbered tariff grids and progressive tiers
   * are applied to this list; on US trades, 46 CFR 541.6(b)(8) also requires the invoice to print it.
   */
  chargedDates: string[];
  /** The charged days split into the `tiers` bands; one open band when no tiers were given. */
  byTier: TierBand[];
}

/** `FreeTimeOptions` plus how charged days are counted, and the optional tier boundaries. */
export type FreeTimeChargeOptions = FreeTimeOptions & {
  /**
   * How days after expiry are charged: `"calendar"` charges every local day, `"working"` only the
   * working days of `calendar`. No default; see `chargeableDays`.
   */
  chargeBasis: FreeTimeBasis;
  tiers?: number[];
};

/**
 * Count the days a container is charged for between the start of its clock and its exit,
 * and list the dates behind the count.
 *
 * Lays out free time with the same walk as `freeTimeExpiry`, then counts the days on or after
 * the expiry that the half-open dwell `[clockStart, clockEnd)` touched. The result is the
 * auditable form of a demurrage or detention charge: `chargedDates` lists the days behind the
 * count, which is what a carrier's day-numbered tariff grid is applied to, and on US trades is
 * what the US invoice rule requires an invoice to print ("the specific date(s) for which
 * demurrage and/or detention were charged", 46 CFR 541.6(b)(8)). No regulation or industry
 * standard fixes how the days are counted; every term below is the tariff's. GMT computes days,
 * never money: `byTier` says how many days fell in each band so the caller can apply its rates.
 *
 * - **Half-open at the exit.** A day is charged when it started before `clockEnd`, so a
 *   gate-out at exactly `expiresAt` is `0` chargeable days and one nanosecond later is `1`. A
 *   zero-length dwell touches the day it sits on, as `dwellTime` counts. On the calendar basis
 *   with `firstDay: "eventDay"`, `freeDaysUsed + chargeableDays` equals `dwellTime(...).calendarDays`,
 *   with one exception: a fall-back that re-enters the day before the event day (`America/Goose_Bay`,
 *   00:01 on 7 November 2010 back into the 6th) is a date `dwellTime` counts as touched, and a
 *   tariff never counts a date before the event day.
 * - **The free-time terms are `freeTimeExpiry`'s**: `basis`, `timeZone`, `firstDay` and
 *   `calendar` mean the same, and `firstDay` has no default.
 * - **`chargeBasis` says how days after expiry are charged, and has no default.** Outside the
 *   US, free time and charges are mostly both calendar days. Where free time is granted in
 *   working days (the usual US shape), the days after it are mostly charged as calendar days,
 *   weekends and holidays included (Hapag-Lloyd's US tables: "Rate per Calendar day"; ACL: "Once
 *   free time expires ... charged on calendar days"): `basis: "working", chargeBasis: "calendar"`.
 *   Some tariffs charge working days only, and California law requires it at its terminals, for
 *   free time and charges alike (Cal. Bus. & Prof. Code § 22928: neither while the gate is closed
 *   nor on a holiday): both `"working"`.
 *   Either `"working"` needs `calendar`. The two differ by every closed day after expiry, so
 *   neither is assumed.
 * - **`freeDays` may be `0`** for a tariff with no free time: `expiresAt` is the start of day one,
 *   the first day counted on `basis` (under `"nextDay"`, the first after the event day), and days
 *   before it are neither free nor charged.
 * - **`tiers` are day bands, not rates.** `[5, 10]` names the last chargeable-day ordinal of
 *   each band: days 1–5, 6–10 and 11 onward. Every band is returned, an empty one with
 *   `days: 0`, and the last is always open. Omitted, `byTier` is the single open band
 *   `{ from: 1, to: null }`. A list that is not strictly ascending positive whole numbers
 *   returns `null`.
 * - Returns `null` when either instant is invalid, `clockEnd` is before `clockStart` (an
 *   inverted dwell is a data error), `freeDays` is not a whole number of at least `0`, the
 *   options fail as they do for `freeTimeExpiry`, `tiers` has a hole, an unsafe integer or does not ascend, or the walk would pass
 *   10,000 local days.
 *
 * @param clockStart ISO 8601 instant string of the event that starts the clock
 * @param clockEnd ISO 8601 instant string of the event that stops it (gate-out or empty return)
 * @param freeDays whole number of free days the tariff allows, 0 or more
 * @param options { basis, chargeBasis, timeZone, firstDay, calendar?, tiers?: number[] }
 * @returns the free days used, the chargeable days, the expiry, the charged dates and the days per tier band, or null on invalid input
 *
 * @example chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:00Z", 3, { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }) // { freeDaysUsed: 3, chargeableDays: 0, expiresAt: "2024-06-17T04:00:00Z", chargedDates: [], byTier: [{ from: 1, to: null, days: 0 }] } (gate-out exactly at expiry is free)
 * @example chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:01Z", 3, { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }) // { freeDaysUsed: 3, chargeableDays: 1, expiresAt: "2024-06-17T04:00:00Z", chargedDates: ["2024-06-17"], byTier: [{ from: 1, to: null, days: 1 }] } (one second later is a charged day)
 * @example chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:01Z", 3, { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "nextDay" }) // { freeDaysUsed: 3, chargeableDays: 0, expiresAt: "2024-06-18T04:00:00Z", chargedDates: [], byTier: [{ from: 1, to: null, days: 0 }] } (the other start-day convention: still free)
 * @example chargeableDays("2024-06-14T19:00:00Z", "2024-06-28T15:00:00Z", 3, { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay", tiers: [5, 10] }) // { freeDaysUsed: 3, chargeableDays: 12, expiresAt: "2024-06-17T04:00:00Z", chargedDates: ["2024-06-17", "2024-06-18", "2024-06-19", "2024-06-20", "2024-06-21", "2024-06-22", "2024-06-23", "2024-06-24", "2024-06-25", "2024-06-26", "2024-06-27", "2024-06-28"], byTier: [{ from: 1, to: 5, days: 5 }, { from: 6, to: 10, days: 5 }, { from: 11, to: null, days: 2 }] }
 * @example chargeableDays("2024-06-14T19:00:00Z", "2024-06-24T15:00:00Z", 3, { basis: "working", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay", calendar: { weekend: [6, 7], holidays: ["2024-06-19"], timeZone: "America/New_York" } }) // { freeDaysUsed: 3, chargeableDays: 6, expiresAt: "2024-06-19T04:00:00Z", chargedDates: ["2024-06-19", "2024-06-20", "2024-06-21", "2024-06-22", "2024-06-23", "2024-06-24"], byTier: [{ from: 1, to: null, days: 6 }] } (free days in working days, every calendar day after expiry charged)
 * @example chargeableDays("2024-06-14T19:00:00Z", "2024-06-24T15:00:00Z", 3, { basis: "working", chargeBasis: "working", timeZone: "America/New_York", firstDay: "eventDay", calendar: { weekend: [6, 7], holidays: ["2024-06-19"], timeZone: "America/New_York" } }) // { freeDaysUsed: 3, chargeableDays: 3, expiresAt: "2024-06-19T04:00:00Z", chargedDates: ["2024-06-20", "2024-06-21", "2024-06-24"], byTier: [{ from: 1, to: null, days: 3 }] } (California-style: closed days after expiry are not charged)
 * @example chargeableDays("2024-06-14T19:00:00Z", "2024-06-15T15:00:00Z", 3, { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }) // { freeDaysUsed: 2, chargeableDays: 0, expiresAt: "2024-06-17T04:00:00Z", chargedDates: [], byTier: [{ from: 1, to: null, days: 0 }] } (out on the second free day)
 * @example chargeableDays("2024-06-14T19:00:00Z", "2024-06-16T15:00:00Z", 0, { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }) // { freeDaysUsed: 0, chargeableDays: 3, expiresAt: "2024-06-14T04:00:00Z", chargedDates: ["2024-06-14", "2024-06-15", "2024-06-16"], byTier: [{ from: 1, to: null, days: 3 }] } (no free time: every day is charged)
 * @example chargeableDays("2024-06-14T19:00:00Z", "2024-06-28T15:00:00Z", 3, { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay", tiers: [10, 5] }) // null (tiers must ascend)
 * @example chargeableDays("2024-06-17T04:00:01Z", "2024-06-14T19:00:00Z", 3, { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }) // null (exit before the clock started)
 * @example chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:01Z", 3, { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York" }) // null (firstDay has no default)
 * @example chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:01Z", 3, { basis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }) // null (chargeBasis has no default)
 */
export function chargeableDays(
  clockStart: string,
  clockEnd: string,
  freeDays: number,
  options: FreeTimeChargeOptions,
): FreeTimeCharges | null {
  const terms = parseFreeTimeTerms(options, true);
  const allowed = parseFreeDays(freeDays, 0);
  const tiers = terms === null ? null : parseTiers(options.tiers);

  if (
    !isValidInstant(clockStart) ||
    !isValidInstant(clockEnd) ||
    terms === null ||
    allowed === null ||
    tiers === null
  ) {
    return null;
  }

  try {
    const start = Temporal.Instant.from(clockStart).toZonedDateTimeISO(
      terms.timeZone,
    );
    const end = Temporal.Instant.from(clockEnd).toZonedDateTimeISO(
      terms.timeZone,
    );
    if (Temporal.ZonedDateTime.compare(start, end) > 0) {
      return null;
    }

    const ledger = walkFreeTime(start, allowed, terms, end);
    if (ledger === null) {
      return null;
    }

    return {
      freeDaysUsed: ledger.used,
      chargeableDays: ledger.charged.length,
      expiresAt: ledger.expiresAt.toInstant().toString(),
      chargedDates: ledger.charged.map((day) => day.date),
      byTier: bandsByTier(tiers, ledger.charged.length),
    };
  } catch {
    return null;
  }
}
