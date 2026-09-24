import { Temporal } from "@js-temporal/polyfill";
import { isObject, isOptionsArgument } from "../../internal";
import { isValidInstant } from "../../precision/validate/isValidInstant";
import type { Interval } from "../../types";

/** The four events a container's charging clocks run between. */
export type ClockEventType =
  | "discharged"
  | "available"
  | "gatedOut"
  | "emptyReturned";

/** A container event: what happened and the instant it happened. */
export interface ClockEvent {
  type: ClockEventType;
  /** ISO 8601 instant string: `Z`, an offset, or a bracketed zone. */
  at: string;
}

/** Which charge is being clocked. */
export type ClockScope = "demurrage" | "detention" | "storage";

/** Where an import demurrage or storage clock starts, when the tariff says so. */
export type ClockStartEvent = "discharged" | "available";

const CLOCK_EVENT_TYPES: readonly ClockEventType[] = [
  "discharged",
  "available",
  "gatedOut",
  "emptyReturned",
];
const CLOCK_SCOPES: readonly ClockScope[] = [
  "demurrage",
  "detention",
  "storage",
];
const CLOCK_START_EVENTS: readonly ClockStartEvent[] = [
  "discharged",
  "available",
];

/**
 * Pick the two events a charge's clock runs between.
 *
 * Three clocks are routinely confused. **Demurrage** runs from discharge from the vessel until
 * the container leaves the terminal gate. **Detention** runs from gate-out until the empty is
 * returned. Terminal **storage** runs over the same window as demurrage but is the terminal's
 * own charge with its own free time. `demurrageClock` selects the start and end events for the
 * requested charge from a container's event list, so the wrong pair can never reach
 * `chargeableDays`.
 *
 * - **`demurrage` and `storage`** run from `startEvent` to `gatedOut`. `startEvent` defaults to
 *   `"discharged"`, the classic definition; `"available"` is for tariffs that start the import
 *   clock at the container availability date, which 46 CFR 541.6 also requires on the invoice.
 * - **`detention`** runs from `gatedOut` to `emptyReturned`. `startEvent` is not read for it, so
 *   one options object can serve all three scopes.
 * - Events may be in any order, and every element must be `{ type, at }` with a known type and
 *   a valid instant, used or not: an event list with a bad entry is a bad list.
 * - The result is an `Interval`, half-open `[start, end)`, echoing the caller's own strings, and
 *   feeds `chargeableDays(start, end, …)` directly.
 * - Returns `null` when `events` is not an array or holds an invalid event, `scope` or
 *   `startEvent` is unknown, `options` is not an object, a required event is missing or occurs
 *   more than once (a container discharged twice is a data error, not a choice), or the end
 *   event precedes the start event.
 *
 * @param events the container's events, `{ type: "discharged" | "available" | "gatedOut" | "emptyReturned", at: string }`
 * @param scope "demurrage" | "detention" | "storage"
 * @param options optional: { startEvent?: "discharged" | "available" } for demurrage and storage
 * @returns { start, end } of the requested clock, or null on invalid input
 *
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "available", at: "2024-06-15T12:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }, { type: "emptyReturned", at: "2024-06-27T09:00:00Z" }], "demurrage") // { start: "2024-06-14T19:00:00Z", end: "2024-06-20T14:30:00Z" }
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "available", at: "2024-06-15T12:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }, { type: "emptyReturned", at: "2024-06-27T09:00:00Z" }], "detention") // { start: "2024-06-20T14:30:00Z", end: "2024-06-27T09:00:00Z" } (gate-out to empty return, not discharge)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "available", at: "2024-06-15T12:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "demurrage", { startEvent: "available" }) // { start: "2024-06-15T12:00:00Z", end: "2024-06-20T14:30:00Z" }
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "storage") // { start: "2024-06-14T19:00:00Z", end: "2024-06-20T14:30:00Z" }
 * @example demurrageClock([{ type: "gatedOut", at: "2024-06-20T10:30:00-04:00[America/New_York]" }, { type: "emptyReturned", at: "2024-06-27T09:00:00Z" }], "detention", { startEvent: "available" }) // { start: "2024-06-20T10:30:00-04:00[America/New_York]", end: "2024-06-27T09:00:00Z" } (startEvent is not read for detention; strings are echoed as given)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "demurrage", { startEvent: "available" }) // null (no availability event)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }], "demurrage") // null (still in the terminal: no gate-out)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "discharged", at: "2024-06-15T19:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "demurrage") // null (discharged twice)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-21T19:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "demurrage") // null (gate-out before discharge)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "laytime") // null (not a clock this function selects)
 */
export function demurrageClock(
  events: ClockEvent[],
  scope: ClockScope,
  options?: { startEvent?: ClockStartEvent },
): Interval | null {
  if (
    !Array.isArray(events) ||
    !CLOCK_SCOPES.includes(scope) ||
    !isOptionsArgument(options)
  ) {
    return null;
  }

  // An explicit `undefined` is an omission (TC39 GetOption); `null` is a value, and not a valid one.
  const startEvent: ClockStartEvent =
    options?.startEvent === undefined ? "discharged" : options.startEvent;
  if (!CLOCK_START_EVENTS.includes(startEvent)) {
    return null;
  }

  const wellFormed = events.every(
    (event) =>
      isObject(event) &&
      CLOCK_EVENT_TYPES.includes((event as ClockEvent).type) &&
      typeof (event as ClockEvent).at === "string" &&
      isValidInstant((event as ClockEvent).at),
  );
  if (!wellFormed) {
    return null;
  }

  const startType: ClockEventType =
    scope === "detention" ? "gatedOut" : startEvent;
  const endType: ClockEventType =
    scope === "detention" ? "emptyReturned" : "gatedOut";

  const only = (type: ClockEventType): string | null => {
    const matches = events.filter((event) => event.type === type);
    return matches.length === 1 ? matches[0].at : null;
  };

  const start = only(startType);
  const end = only(endType);
  if (start === null || end === null) {
    return null;
  }

  try {
    return Temporal.Instant.compare(
      Temporal.Instant.from(start),
      Temporal.Instant.from(end),
    ) > 0
      ? null
      : { start, end };
  } catch {
    return null;
  }
}
