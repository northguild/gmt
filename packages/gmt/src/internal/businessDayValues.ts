import { Temporal } from "@js-temporal/polyfill";
import {
  parseBusinessCalendar,
  resolveBusinessCalendar,
  stepBusinessDates,
} from "./businessCalendar";
import { isValidAmount } from "./isValidAmount";
import { isValidDate } from "../plain/validate";
import type { BusinessCalendar } from "../types";

/**
 * The shared body of `addBusinessDays` and `subtractBusinessDays`: validate, resolve the
 * calendar, and walk `amount` working days from `value`.
 *
 * - `sign` is the direction a **positive** `amount` moves — `1` for adding, `-1` for
 *   subtracting — so a negative `amount` walks the other way in both.
 * - `calendar` is optional; absent means Saturday–Sunday with no holidays.
 * - Returns `""` on an invalid date, a non-integer or out-of-range `amount`, an invalid
 *   calendar, and when the walk runs past `MAX_BUSINESS_DAY_STEPS`.
 */
export function stepBusinessDaysValue(
  value: string,
  amount: number,
  sign: 1 | -1,
  calendar: BusinessCalendar | undefined,
): string {
  const resolved = resolveBusinessCalendar(calendar);

  if (
    !isValidDate(value) ||
    !isValidAmount(amount) ||
    !Number.isInteger(amount) ||
    resolved === null
  ) {
    return "";
  }

  if (amount === 0) {
    return value;
  }

  try {
    const direction: 1 | -1 = amount > 0 ? sign : sign === 1 ? -1 : 1;
    const result = stepBusinessDates(
      Temporal.PlainDate.from(value),
      direction,
      Math.abs(amount),
      resolved,
    );

    return result === null ? "" : result.toString();
  } catch {
    return "";
  }
}

/**
 * The shared body of `nextBusinessDay` and `previousBusinessDay`: the first working day
 * **strictly** one business day away from `value`, in `direction`.
 *
 * Unlike `stepBusinessDaysValue`, `calendar` is required — these two assume no weekend, so an
 * absent calendar is invalid input rather than the Saturday–Sunday default.
 */
export function neighbourBusinessDayValue(
  value: string,
  direction: 1 | -1,
  calendar: BusinessCalendar,
): string {
  const resolved = parseBusinessCalendar(calendar);

  if (!isValidDate(value) || resolved === null) {
    return "";
  }

  try {
    const result = stepBusinessDates(
      Temporal.PlainDate.from(value),
      direction,
      1,
      resolved,
    );

    return result === null ? "" : result.toString();
  } catch {
    return "";
  }
}
