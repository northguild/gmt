import { Temporal } from "@js-temporal/polyfill";
import { isObject } from "../../internal";
import { isValidInstant } from "../../precision/validate/isValidInstant";
import type { Interval } from "../../types";

/**
 * The events a container's charging clocks run between, named after the DCSA Track & Trace
 * equipment events they correspond to (`equipmentEventTypeCode` with `emptyIndicatorCode`):
 *
 * - `discharged`: DISC, laden — the full container is discharged from the vessel (import).
 * - `available`: no DCSA event — the container availability date some import tariffs start at,
 *   and which the US invoice rule requires (46 CFR 541.6(b)(6)).
 * - `gatedOut`: GTOT, laden — the full container leaves the terminal (import).
 * - `emptyReturned`: GTIN, empty — the empty is returned to the terminal or depot (import).
 * - `emptyReleased`: GTOT or PICK, empty — the empty is picked up for stuffing (export).
 * - `gatedIn`: GTIN, laden — the full container is received at the terminal (export).
 * - `loaded`: LOAD, laden — the full container is loaded on board (export).
 */
export type ClockEventType =
  | "discharged"
  | "available"
  | "gatedOut"
  | "emptyReturned"
  | "emptyReleased"
  | "gatedIn"
  | "loaded";

/** A container event: what happened and the instant it happened. */
export interface ClockEvent {
  type: ClockEventType;
  /** ISO 8601 instant string: `Z`, an offset, or a bracketed zone. */
  at: string;
}

/** Which charge is being clocked. `combined` is the merged demurrage-and-detention clock. */
export type ClockScope = "demurrage" | "detention" | "storage" | "combined";

/** Which leg of the container's cycle the clock is on. */
export type ClockDirection = "import" | "export";

/** Where an import demurrage, storage or combined clock starts, when the tariff says so. */
export type ClockStartEvent = "discharged" | "available";

/** The options `demurrageClock` reads. */
export interface ClockOptions {
  /** `"import"` or `"export"`; required, because the same scope runs between different events in each. */
  direction: ClockDirection;
  /** Import only: `"discharged"` (the default) or `"available"`. Not read for export or detention. */
  startEvent?: ClockStartEvent;
}

const CLOCK_EVENT_TYPES: readonly ClockEventType[] = [
  "discharged",
  "available",
  "gatedOut",
  "emptyReturned",
  "emptyReleased",
  "gatedIn",
  "loaded",
];
const CLOCK_SCOPES: readonly ClockScope[] = [
  "demurrage",
  "detention",
  "storage",
  "combined",
];
const CLOCK_START_EVENTS: readonly ClockStartEvent[] = [
  "discharged",
  "available",
];

/** The export clocks: fixed pairs, no start-event choice. */
const EXPORT_CLOCKS: Record<ClockScope, [ClockEventType, ClockEventType]> = {
  demurrage: ["gatedIn", "loaded"],
  storage: ["gatedIn", "loaded"],
  detention: ["emptyReleased", "gatedIn"],
  combined: ["emptyReleased", "loaded"],
};

/**
 * Pick the two events a charge's clock runs between.
 *
 * No regulation or industry standard fixes these events; the carriers' published tariffs agree
 * on them (import: Maersk's terms, CMA CGM's general terms, Hapag-Lloyd, ACL; export: Maersk, CMA
 * CGM, ACL), and DCSA's glossary draws the line they rest on: demurrage is charged while the
 * container is inside the terminal or depot, detention while it is outside, and storage is the
 * charge for the terminal's space, paid to the terminal or to the carrier on its behalf. Export
 * storage (`gatedIn` → `loaded`) follows from that storage definition; no tariff read quotes it.
 * The merged clock runs demurrage and detention as one period, a named tariff product at Maersk
 * ("Combined"), CMA CGM ("merged") and MSC. `demurrageClock` selects the pair for the charge and
 * direction asked for, so the wrong pair can never reach `chargeableDays`.
 *
 * | scope | import | export |
 * | --- | --- | --- |
 * | `demurrage`, `storage` | `startEvent` → `gatedOut` | `gatedIn` → `loaded` |
 * | `detention` | `gatedOut` → `emptyReturned` | `emptyReleased` → `gatedIn` |
 * | `combined` | `startEvent` → `emptyReturned` | `emptyReleased` → `loaded` |
 *
 * - **`direction` has no default.** The same scope name selects different events on the import and
 *   export legs, and guessing it from the events present would be a silent guess.
 * - **`startEvent` is import only**: `"discharged"` by default, the classic definition, or
 *   `"available"` for tariffs that start at the availability date. It is not read for detention
 *   or export, so one options object can serve every scope on a leg. A tariff that starts at
 *   customs release (Hapag-Lloyd Japan) or ends export demurrage at the cut-off or the scheduled
 *   sailing passes that instant as the event's `at`; GMT does not invent an event for one tariff.
 * - Events may be in any order, and every one must be `{ type, at }` with a known type and a
 *   valid instant, used or not, with no holes in the array: a list with a bad entry is a bad list.
 * - The result is an `Interval`, half-open `[start, end)`, in the caller's own strings, and feeds
 *   `chargeableDays(start, end, …)` directly.
 * - US usage differs in words, not events: MSC USA calls the in-terminal container charge
 *   "detention" and the out-of-terminal one "per diem". GMT's scope names follow the global usage.
 * - Returns `null` when `events` is not an array or holds an invalid event or a hole, `scope`,
 *   `direction` or `startEvent` is unknown, `options` is not an object, a required event is
 *   missing or occurs more than once (a container discharged twice is a data error, not a choice),
 *   or the end event precedes the start event.
 *
 * @param events the container's events, `{ type, at }`, `type` one of discharged, available, gatedOut, emptyReturned, emptyReleased, gatedIn, loaded
 * @param scope "demurrage" | "detention" | "storage" | "combined"
 * @param options { direction: "import" | "export", startEvent?: "discharged" | "available" }
 * @returns { start, end } of the requested clock, or null on invalid input
 *
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "available", at: "2024-06-15T12:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }, { type: "emptyReturned", at: "2024-06-27T09:00:00Z" }], "demurrage", { direction: "import" }) // { start: "2024-06-14T19:00:00Z", end: "2024-06-20T14:30:00Z" }
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "available", at: "2024-06-15T12:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }, { type: "emptyReturned", at: "2024-06-27T09:00:00Z" }], "detention", { direction: "import" }) // { start: "2024-06-20T14:30:00Z", end: "2024-06-27T09:00:00Z" } (gate-out to empty return, not discharge)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "available", at: "2024-06-15T12:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }, { type: "emptyReturned", at: "2024-06-27T09:00:00Z" }], "combined", { direction: "import" }) // { start: "2024-06-14T19:00:00Z", end: "2024-06-27T09:00:00Z" } (merged: discharge to empty return)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "available", at: "2024-06-15T12:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "demurrage", { direction: "import", startEvent: "available" }) // { start: "2024-06-15T12:00:00Z", end: "2024-06-20T14:30:00Z" }
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "storage", { direction: "import" }) // { start: "2024-06-14T19:00:00Z", end: "2024-06-20T14:30:00Z" }
 * @example demurrageClock([{ type: "emptyReleased", at: "2024-07-01T08:00:00Z" }, { type: "gatedIn", at: "2024-07-05T16:00:00Z" }, { type: "loaded", at: "2024-07-09T03:00:00Z" }], "demurrage", { direction: "export" }) // { start: "2024-07-05T16:00:00Z", end: "2024-07-09T03:00:00Z" } (gate-in full to loaded on board)
 * @example demurrageClock([{ type: "emptyReleased", at: "2024-07-01T08:00:00Z" }, { type: "gatedIn", at: "2024-07-05T16:00:00Z" }, { type: "loaded", at: "2024-07-09T03:00:00Z" }], "detention", { direction: "export" }) // { start: "2024-07-01T08:00:00Z", end: "2024-07-05T16:00:00Z" } (empty picked up to gate-in full)
 * @example demurrageClock([{ type: "emptyReleased", at: "2024-07-01T08:00:00Z" }, { type: "gatedIn", at: "2024-07-05T16:00:00Z" }, { type: "loaded", at: "2024-07-09T03:00:00Z" }], "combined", { direction: "export" }) // { start: "2024-07-01T08:00:00Z", end: "2024-07-09T03:00:00Z" }
 * @example demurrageClock([{ type: "gatedOut", at: "2024-06-20T10:30:00-04:00[America/New_York]" }, { type: "emptyReturned", at: "2024-06-27T09:00:00Z" }], "detention", { direction: "import", startEvent: "available" }) // { start: "2024-06-20T10:30:00-04:00[America/New_York]", end: "2024-06-27T09:00:00Z" } (startEvent is not read for detention; strings are echoed as given)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "demurrage") // null (direction has no default)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "demurrage", { direction: "import", startEvent: "available" }) // null (no availability event)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }], "demurrage", { direction: "import" }) // null (still in the terminal: no gate-out)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "discharged", at: "2024-06-15T19:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "demurrage", { direction: "import" }) // null (discharged twice)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-21T19:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "demurrage", { direction: "import" }) // null (gate-out before discharge)
 * @example demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }, { type: "gatedOut", at: "2024-06-20T14:30:00Z" }], "laytime", { direction: "import" }) // null (not a clock this function selects)
 */
export function demurrageClock(
  events: ClockEvent[],
  scope: ClockScope,
  options: ClockOptions,
): Interval | null {
  if (
    !Array.isArray(events) ||
    !CLOCK_SCOPES.includes(scope) ||
    !isObject(options)
  ) {
    return null;
  }

  const { direction } = options;
  if (direction !== "import" && direction !== "export") {
    return null;
  }

  // An explicit `undefined` is an omission (TC39 GetOption); `null` is a value, and not a valid one.
  const startEvent: ClockStartEvent =
    options.startEvent === undefined ? "discharged" : options.startEvent;
  if (!CLOCK_START_EVENTS.includes(startEvent)) {
    return null;
  }

  // `Array.from` turns a hole into `undefined`, which the check rejects; `every` would skip it.
  const list = Array.from(events) as unknown[];
  const wellFormed = list.every(
    (event) =>
      isObject(event) &&
      CLOCK_EVENT_TYPES.includes((event as ClockEvent).type) &&
      typeof (event as ClockEvent).at === "string" &&
      isValidInstant((event as ClockEvent).at),
  );
  if (!wellFormed) {
    return null;
  }

  const [startType, endType]: [ClockEventType, ClockEventType] =
    direction === "export"
      ? EXPORT_CLOCKS[scope]
      : scope === "detention"
        ? ["gatedOut", "emptyReturned"]
        : [startEvent, scope === "combined" ? "emptyReturned" : "gatedOut"];

  const only = (type: ClockEventType): string | null => {
    const matches = (list as ClockEvent[]).filter(
      (event) => event.type === type,
    );
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
