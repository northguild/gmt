import { Temporal } from "@js-temporal/polyfill";
import { isObject } from "../../internal";
import { isValidDate } from "../../plain/validate/isValidDate";

/** The dates a billing timeline is counted from: the anchor, and the invoice and request once they exist. */
export interface BillingDates {
  /**
   * The date the issue window is counted from, as an ISO date, such as the date the charge was
   * last incurred or, for a re-bill, the issuance date of the invoice received.
   */
  anchorOn: string;
  /** The date the invoice was issued, once it has been. */
  invoiceIssuedOn?: string;
  /** The date the dispute request was received, once it has been. */
  requestReceivedOn?: string;
}

/** The three windows the caller supplies, in calendar days, none defaulted, and an optional agreed resolution date. */
export interface BillingWindows {
  /** Days from `anchorOn` within which the invoice must be issued. */
  issueDays: number;
  /** Days from `invoiceIssuedOn` within which a dispute may be raised. */
  disputeDays: number;
  /** Days from `requestReceivedOn` within which the dispute must be resolved. */
  resolutionDays: number;
  /** A resolution date the parties agreed instead; it replaces the computed one. */
  agreedResolutionOn?: string;
}

/** What `billingTimeline` returns: each deadline as an ISO date, and each comparison once its date exists. */
export interface BillingDeadlines {
  /** `anchorOn + issueDays`. */
  invoiceDeadline: string;
  /** Whether `invoiceIssuedOn` is on or before `invoiceDeadline`; `null` until an invoice date exists. */
  issuedByDeadline: boolean | null;
  /** `invoiceIssuedOn + disputeDays`; `null` until an invoice date exists. */
  disputeDeadline: string | null;
  /** Whether `requestReceivedOn` is on or before `disputeDeadline`; `null` until a request date exists. */
  requestedByDeadline: boolean | null;
  /** `requestReceivedOn + resolutionDays`, or `agreedResolutionOn`; `null` until a request date exists. */
  resolutionDeadline: string | null;
}

/**
 * Lay out the deadline chain around a demurrage or detention invoice: the last date it may be
 * issued, the last date it may be disputed, and the last date the dispute must be resolved.
 *
 * A billing regime or service contract can set up to three windows around an invoice: one to
 * issue it, one to dispute it, and one to resolve the dispute. The number of days in each is the
 * caller's fact; GMT carries none of them. The arithmetic is this function's: each deadline is a
 * date, counted in calendar days from a date, with the anchor as day zero and the deadline day
 * itself inside the window.
 *
 * - **Day zero is the anchor and the deadline is `anchor + days`** on the ISO 8601 calendar
 *   (`Temporal.PlainDate.add`); a date is "by the deadline" when
 *   `Temporal.PlainDate.compare(date, deadline) <= 0`. That is this function's stated contract,
 *   not a reading of any rule; a regime that counts differently passes a different number.
 * - **Deadlines are dates, never instants.** Reduce an instant to the billing party's local date
 *   first with `convertUtcToPlainDate(instant, { timeZone })`; this function does not guess a
 *   zone. `anchorOn` is whatever date the caller counts from, such as the last charged date
 *   (`chargeableDays(...).chargedDates.at(-1)`) or, for a party re-billing a charge it was
 *   itself billed, the issuance date of the invoice it received.
 * - **Windows have no defaults.** Each is a safe integer of at least `0`; a missing, negative or
 *   non-integer window returns `null`, because a silently defaulted window is a wrong deadline.
 * - **The chain fills in as its dates exist.** With only `anchorOn` the result is a forecast:
 *   `invoiceDeadline` is set and every other field is `null`. An invoice date sets
 *   `issuedByDeadline` and `disputeDeadline`; a request date sets `requestedByDeadline` and
 *   `resolutionDeadline`. An explicit `undefined` is an omission; any other value must be a
 *   valid ISO date.
 * - **The booleans compare dates and say nothing else.** Whether a charge is payable, whether a
 *   dispute must be heard, and any consequence are the consumer's. GMT computes dates, not
 *   liability.
 * - **`agreedResolutionOn` replaces the computed `resolutionDeadline`** when given. It must be a
 *   valid date on or after `requestReceivedOn`, else `null`; it is validated even when no
 *   request exists, but cannot act without one.
 * - **A request cannot precede the invoice it disputes.** `requestReceivedOn` without
 *   `invoiceIssuedOn`, or earlier than it, is a data error and returns `null`. An invoice earlier
 *   than the anchor is allowed: an invoice may be issued while charges still accrue.
 * - Every emitted date is canonical bare ISO (`Temporal.PlainDate#toString()`), so an input
 *   annotation such as `[u-ca=iso8601]` does not reach the output, as `addDate` behaves.
 * - Returns `null` when `dates` or `windows` is not an object, `anchorOn` or a given optional
 *   date is not a valid ISO date, a window is missing or not a safe integer of at least `0`, a
 *   request exists without an invoice or before it, `agreedResolutionOn` is before the request,
 *   or a deadline would leave Temporal's range.
 *
 * @param dates { anchorOn: string, invoiceIssuedOn?: string, requestReceivedOn?: string } ISO dates
 * @param windows { issueDays: number, disputeDays: number, resolutionDays: number, agreedResolutionOn?: string } calendar-day windows, none defaulted
 * @returns { invoiceDeadline, issuedByDeadline, disputeDeadline, requestedByDeadline, resolutionDeadline }, or null on invalid input
 *
 * @example billingTimeline({ anchorOn: "2026-03-01" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 }) // { invoiceDeadline: "2026-03-31", issuedByDeadline: null, disputeDeadline: null, requestedByDeadline: null, resolutionDeadline: null } (no invoice yet: a forecast)
 * @example billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 }) // { invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-30", requestedByDeadline: null, resolutionDeadline: null } (day 30 is the last day by the deadline)
 * @example billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-04-01" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 }) // { invoiceDeadline: "2026-03-31", issuedByDeadline: false, disputeDeadline: "2026-05-01", requestedByDeadline: null, resolutionDeadline: null } (day 31)
 * @example billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-19" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 }) // { invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-19", requestedByDeadline: true, resolutionDeadline: "2026-05-19" }
 * @example billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-20" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30, agreedResolutionOn: "2026-06-01" }) // { invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-19", requestedByDeadline: false, resolutionDeadline: "2026-06-01" } (an agreed date replaces the computed one)
 * @example billingTimeline({ anchorOn: "2026-03-10", invoiceIssuedOn: "2026-04-05" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 }) // { invoiceDeadline: "2026-04-09", issuedByDeadline: true, disputeDeadline: "2026-05-05", requestedByDeadline: null, resolutionDeadline: null } (a re-bill anchored on the invoice it received, not on the charge)
 * @example billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-05", requestReceivedOn: "2026-03-18" }, { issueDays: 14, disputeDays: 14, resolutionDays: 45 }) // { invoiceDeadline: "2026-03-15", issuedByDeadline: true, disputeDeadline: "2026-03-19", requestedByDeadline: true, resolutionDeadline: "2026-05-02" } (a service contract's own windows)
 * @example billingTimeline({ anchorOn: "2028-01-30" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 }) // { invoiceDeadline: "2028-02-29", issuedByDeadline: null, disputeDeadline: null, requestedByDeadline: null, resolutionDeadline: null } (calendar days across a leap day)
 * @example billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, { disputeDays: 30, resolutionDays: 30 }) // null (issueDays has no default)
 * @example billingTimeline({ anchorOn: "2026-03-01", requestReceivedOn: "2026-04-19" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 }) // null (a request cannot precede the invoice it disputes)
 */
export function billingTimeline(
  dates: BillingDates,
  windows: BillingWindows,
): BillingDeadlines | null {
  try {
    return layOutDeadlines(dates, windows);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}

/** A window is a whole number of calendar days, zero or more. */
function isWindow(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** An optional date is absent (`undefined`) or a valid ISO date; anything else is invalid. */
function optionalDate(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "string" && isValidDate(value) ? value : null;
}

/** `date + days` on the ISO calendar, canonical. Throws `RangeError` past Temporal's range. */
function plusDays(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

/** Whether `date` is on or before `deadline`. */
function byDeadline(date: string, deadline: string): boolean {
  return (
    Temporal.PlainDate.compare(
      Temporal.PlainDate.from(date),
      Temporal.PlainDate.from(deadline),
    ) <= 0
  );
}

/** The dates, each a valid ISO date, with no request before its invoice; `null` otherwise. */
function readDates(dates: BillingDates): BillingDates | null {
  const { anchorOn } = dates;
  if (typeof anchorOn !== "string" || !isValidDate(anchorOn)) {
    return null;
  }
  const invoiceIssuedOn = optionalDate(dates.invoiceIssuedOn);
  const requestReceivedOn = optionalDate(dates.requestReceivedOn);
  if (invoiceIssuedOn === null || requestReceivedOn === null) {
    return null;
  }
  // A request cannot precede the invoice it disputes.
  if (
    requestReceivedOn !== undefined &&
    (invoiceIssuedOn === undefined ||
      !byDeadline(invoiceIssuedOn, requestReceivedOn))
  ) {
    return null;
  }
  return { anchorOn, invoiceIssuedOn, requestReceivedOn };
}

/** The three windows, each present and valid, and the agreed date if given; `null` otherwise. */
function readWindows(windows: BillingWindows): BillingWindows | null {
  const { issueDays, disputeDays, resolutionDays } = windows;
  if (
    !isWindow(issueDays) ||
    !isWindow(disputeDays) ||
    !isWindow(resolutionDays)
  ) {
    return null;
  }
  const agreedResolutionOn = optionalDate(windows.agreedResolutionOn);
  if (agreedResolutionOn === null) {
    return null;
  }
  return { issueDays, disputeDays, resolutionDays, agreedResolutionOn };
}

/** The agreed date when given, else `requestReceivedOn + resolutionDays`; `null` with no request. */
function resolutionDeadline(
  requestReceivedOn: string | undefined,
  windows: BillingWindows,
): string | null {
  if (requestReceivedOn === undefined) {
    return null;
  }
  return windows.agreedResolutionOn === undefined
    ? plusDays(requestReceivedOn, windows.resolutionDays)
    : Temporal.PlainDate.from(windows.agreedResolutionOn).toString();
}

/** Whether `date` is on or before `deadline`; `null` until both exist. */
function onOrBefore(
  date: string | undefined,
  deadline: string | null,
): boolean | null {
  return date === undefined || deadline === null
    ? null
    : byDeadline(date, deadline);
}

/** An agreed resolution date cannot precede the request it resolves. */
function agreedAfterRequest(
  requestReceivedOn: string | undefined,
  agreedResolutionOn: string | undefined,
): boolean {
  return (
    requestReceivedOn === undefined ||
    agreedResolutionOn === undefined ||
    byDeadline(requestReceivedOn, agreedResolutionOn)
  );
}

/** `billingTimeline` without the guard; every read of its arguments happens here. */
function layOutDeadlines(
  dates: BillingDates,
  windows: BillingWindows,
): BillingDeadlines | null {
  if (!isObject(dates) || !isObject(windows)) {
    return null;
  }
  const read = readDates(dates);
  const counts = readWindows(windows);
  if (
    read === null ||
    counts === null ||
    !agreedAfterRequest(read.requestReceivedOn, counts.agreedResolutionOn)
  ) {
    return null;
  }

  const { anchorOn, invoiceIssuedOn, requestReceivedOn } = read;
  const invoiceDeadline = plusDays(anchorOn, counts.issueDays);
  const disputeDeadline =
    invoiceIssuedOn === undefined
      ? null
      : plusDays(invoiceIssuedOn, counts.disputeDays);
  return {
    invoiceDeadline,
    issuedByDeadline: onOrBefore(invoiceIssuedOn, invoiceDeadline),
    disputeDeadline,
    requestedByDeadline: onOrBefore(requestReceivedOn, disputeDeadline),
    resolutionDeadline: resolutionDeadline(requestReceivedOn, counts),
  };
}
