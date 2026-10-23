/**
 * DOX-C3b (#139) — the tools Dox may call to answer with a live widget instead
 * of only prose.
 *
 * Shared deliberately between the Worker and the browser. The Worker passes
 * these to `streamText`; the chat rail validates a streamed tool call against
 * the *same* schemas before mounting anything. One definition, so the two can
 * never disagree about what a valid call looks like.
 *
 * Client-safe: this module imports only `ai` and `zod`, both of which the chat
 * island already bundles. It must not reach `scripts/` — see
 * `client-graph.test.ts`.
 */
import { tool } from "ai";
import type { IsoWeekday } from "@northguild/gmt";
import { z } from "zod";
import {
  GNSS_DECODER_MODES,
  GNSS_WEEK_COUNTERS,
  RINEX_WEEK_SYSTEMS,
} from "./gnss-names";

/**
 * The shape of an IANA zone identifier — `Area/Location`, optionally with a
 * third segment (`America/Argentina/Salta`).
 *
 * This deliberately does **not** prove the zone exists. `"Mars/Olympus_Mons"`
 * passes it, and is meant to: a regex cannot know the tz database, and pretending
 * otherwise would put the check in the wrong place. Existence is decided at the
 * mount boundary against `@northguild/gmt`'s own validator, which is both the
 * honest place for it and the site making its own argument. See
 * `widget-registry.ts`.
 */
export const zoneSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+){0,2}$/,
    "must look like an IANA zone identifier, e.g. Europe/London",
  );

/** An ISO-8601 local or zoned date-time, as the widgets' inputs accept. */
export const dateTimeSchema = z.string().min(4).max(64);

/**
 * An ISO 8601 duration, as `scheduleDelivery` and `crossingTime` read a
 * leg's `duration` or `dwellAfter`. This checks shape, not validity — an
 * invalid duration is the widget's sentinel to show, not a reason to refuse
 * the call before it reaches the library.
 */
export const durationSchema = z.string().min(3).max(32);

/**
 * An ISO date, as `billingTimeline` reads `anchorOn` and the other billing
 * dates. This checks shape, not validity — an invalid date is the widget's
 * sentinel to show, not a reason to refuse the call before it reaches the
 * library.
 */
export const plainDateSchema = z.string().min(10).max(64);

/**
 * One zone, not a list.
 *
 * The spec sketched `showGlobe({ zones })`, which presumes the globe can pin a
 * set. It cannot: `GlobeHost.selectZone` sets *the* selected zone (`globe.ts`'s
 * `setSelected`), and the clock panel beside it already lists every plottable
 * zone, virtualized. A `zones` array would have silently kept only the last
 * entry — a tool argument the model believes in and the widget ignores is worse
 * than a narrower tool.
 */
export const showGlobeInput = z.object({
  zone: zoneSchema,
});

export const showDstInspectorInput = z.object({
  zone: zoneSchema,
  year: z.number().int().min(1900).max(2100),
  preset: z.enum(["gap", "overlap", "normal", "fixed"]).optional(),
  disambiguation: z
    .enum(["compatible", "earlier", "later", "reject"])
    .optional(),
  offset: z.enum(["prefer", "use", "ignore", "reject"]).optional(),
});

export const showIntervalVisualizerInput = z.object({
  aStart: dateTimeSchema,
  aEnd: dateTimeSchema,
  bStart: dateTimeSchema,
  bEnd: dateTimeSchema,
});

/**
 * A dwell: two instants and the zone its days are counted in.
 *
 * `zone` is required here although `dwellTime` can take it from a bracketed
 * entry: a model answering "23:00 in Johannesburg" sends a wall time with no
 * offset, and the widget reads it in this zone (`resolveWallTime`). Without a
 * zone there is nothing to count days in, which the widget can still show, but
 * is not a question worth a tool call.
 */
export const showDwellLedgerInput = z.object({
  entry: dateTimeSchema,
  exit: dateTimeSchema,
  zone: zoneSchema,
  compareZone: zoneSchema.optional(),
});

/**
 * A container's clock and the tariff it is read against.
 *
 * `firstDay`, `basis` and `chargeBasis` are required here as they are in the
 * library: each is worth days of charges, so a model must say which the reader
 * meant rather than have one picked for them. `zone` is the terminal's.
 */
export const showFreeTimeLedgerInput = z.object({
  clockStart: dateTimeSchema,
  clockEnd: dateTimeSchema,
  freeDays: z.number().int().min(0).max(365),
  firstDay: z.enum(["eventDay", "nextDay"]),
  basis: z.enum(["calendar", "working"]),
  chargeBasis: z.enum(["calendar", "working"]),
  zone: zoneSchema,
  weekend: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  holidays: z.array(z.string().min(10).max(10)).max(64).optional(),
  tiers: z.array(z.number().int().min(1)).max(16).optional(),
});

export const showConverterBenchInput = z.object({
  value: dateTimeSchema,
  from: zoneSchema,
  to: zoneSchema,
  locale: z.string().max(16).optional(),
});

/**
 * The deadline chain around a demurrage or detention invoice: the anchor, the
 * dates as they exist, and the three windows. Windows are required here as
 * they are in the library — a missing window is a wrong deadline, so a model
 * must say which the reader meant rather than have one defaulted.
 */
export const showBillingDeadlinesInput = z.object({
  anchorOn: plainDateSchema,
  invoiceIssuedOn: plainDateSchema.optional(),
  requestReceivedOn: plainDateSchema.optional(),
  issueDays: z.number().int().min(0).max(3650),
  disputeDays: z.number().int().min(0).max(3650),
  resolutionDays: z.number().int().min(0).max(3650),
  agreedResolutionOn: plainDateSchema.optional(),
});

/**
 * A multi-leg journey (TRAN-9): 1 to 4 legs chained by `scheduleDelivery`.
 * `departure` is optional on every leg here — the library requires it only
 * on the first, and a later leg either chains from the previous leg's
 * arrival plus its `dwellAfter` or names its own scheduled departure — so the
 * shape schema cannot enforce which; that is the widget's sentinel to show.
 */
export const showDeliverySchedulerInput = z.object({
  legs: z
    .array(
      z.object({
        departure: dateTimeSchema.optional(),
        duration: durationSchema,
        timeZone: zoneSchema,
        dwellAfter: durationSchema.optional(),
        mode: z.string().min(1).max(16).optional(),
      }),
    )
    .min(1)
    .max(4),
  startTimeZone: zoneSchema.optional(),
});

/**
 * One handoff (TRAN-9): an arriving leg, the handling time at the port (the
 * minimum connect time) and a scheduled onward departure, checked by
 * `scheduleDelivery`.
 */
export const showConnectionCheckerInput = z.object({
  inboundDeparture: dateTimeSchema,
  inboundDuration: durationSchema,
  portZone: zoneSchema,
  handlingMinutes: z.number().int().min(0).max(240),
  onwardDeparture: dateTimeSchema,
  onwardDuration: durationSchema.optional(),
  onwardZone: zoneSchema.optional(),
});

/**
 * A transport timetable's printed local departure times (TRAN-9), read as
 * exact instants through `scheduleDelivery`'s `startTimeZone`. `offsets` is
 * optional and, when given, one entry per `departures` entry — a blank entry
 * leaves that row's offset unset.
 */
export const showTimetableReaderInput = z.object({
  startTimeZone: zoneSchema,
  departures: z.array(dateTimeSchema).min(1).max(4),
  offsets: z.array(z.string().max(9)).max(4).optional(),
  duration: durationSchema,
  timeZone: zoneSchema,
});

/**
 * A crossing (TRAN-9): a canal transit, a strait passage, a border queue,
 * logged as two instants and read on the clock of the zone that
 * administers it.
 */
export const showCrossingClockInput = z.object({
  entry: dateTimeSchema,
  exit: dateTimeSchema,
  targetZone: zoneSchema,
});

/**
 * A sailing's whole stack of cut-offs (TRAN-10): 1 to 4 named deadlines
 * counted back from one departure by `cutoffSchedule`. `weekend` and
 * `holidays` are optional, but `roll` is required whenever either is given —
 * there is no default, so the model must ask rather than guess which way a
 * cut-off on a closed day moves.
 */
export const showCutoffStackInput = z.object({
  anchor: dateTimeSchema,
  timeZone: zoneSchema,
  cutoffs: z
    .array(
      z.object({
        name: z.string().min(1).max(24),
        offset: durationSchema,
        atLocalTime: z.string().min(4).max(12).optional(),
      }),
    )
    .min(1)
    .max(4),
  weekend: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  holidays: z.array(plainDateSchema).max(5).optional(),
  roll: z
    .enum([
      "preceding",
      "following",
      "modifiedPreceding",
      "modifiedFollowing",
      "none",
    ])
    .optional(),
});

/**
 * One departure's "N days before" read three ways by `cutoffAt` (TRAN-10):
 * N calendar days, N × 24 exact hours, and N days before at a fixed local
 * time.
 */
export const showCutoffRulerInput = z.object({
  anchor: dateTimeSchema,
  timeZone: zoneSchema,
  days: z.number().int().min(1).max(7),
  atLocalTime: z.string().min(4).max(12),
});

/**
 * A cut-off compared with a moment (TRAN-10) by `isPastCutoff` and
 * `timeToCutoff`. `now` is optional: omitting it means the reader's own
 * clock, read live by the widget — never a value this tool invents.
 */
export const showCutoffCountdownInput = z.object({
  cutoff: dateTimeSchema,
  now: dateTimeSchema.optional(),
  timeZone: zoneSchema,
});

/**
 * Planned and actual times judged by `scheduleDeviation`,
 * `classifyPunctuality` and `punctualityRate` (TRAN-57). `late` is required:
 * GMT holds no default tolerance, so a model must ask rather than guess what
 * on time means. `early` and `compareLate` are optional.
 */
export const showPunctualityBoardInput = z.object({
  pairs: z
    .array(z.object({ planned: dateTimeSchema, actual: dateTimeSchema }))
    .min(1)
    .max(6),
  late: durationSchema,
  early: durationSchema.optional(),
  compareLate: durationSchema.optional(),
});

/**
 * The timestamps of one event (TRAN-57): each a class (PLN, EST, REQ, ACT), the
 * time it names and when it was recorded. `bestAvailable` picks one and
 * `estimateDrift` measures how far the estimate moved. `tolerance` is optional.
 */
export const showEtaDriftInput = z.object({
  events: z
    .array(
      z.object({
        classifier: z.enum(["PLN", "EST", "REQ", "ACT"]),
        at: dateTimeSchema,
        recordedAt: dateTimeSchema,
      }),
    )
    .min(1)
    .max(6),
  tolerance: durationSchema.optional(),
});

/**
 * An arrival against a timetable (TRAN-57): `nextDeparture` finds the first
 * departure at or after the arrival plus the minimum connection. Give either
 * `departures` (a list) or `headway` with `from` and `to` (a service every N
 * minutes). `onwardDuration` and `onwardZone` let the widget hand the result to
 * the Delivery Scheduler.
 */
export const showDepartureBoardInput = z.object({
  after: dateTimeSchema,
  departures: z.array(dateTimeSchema).min(1).max(6).optional(),
  headway: durationSchema.optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  minimumConnection: durationSchema.optional(),
  onwardDuration: durationSchema.optional(),
  onwardZone: zoneSchema.optional(),
});

/**
 * The Zone Planner: zones pinned side by side on one slider, so a meeting time
 * can be proposed across them. `time` is the reference instant the slider shifts
 * from, a UTC instant ending in `Z`; without it the planner starts at now,
 * rounded forward to the next 5 minutes.
 */
export const showZonePlannerInput = z.object({
  zones: z.array(zoneSchema).min(1).max(8),
  time: z.string().min(10).max(64).optional(),
});

/**
 * A short code of the EDI timestamp tools: a UN/EDIFACT 2379 format code, an X12
 * 623 time code or an X12 1250 qualifier. Checks shape, not validity: a code
 * the library does not read is the widget's sentinel to show, never a schema
 * failure.
 */
export const ediCodeSchema = z.string().min(1).max(8);

/**
 * The DTM Decoder: a UN/EDIFACT `DTM` segment, or a value and its 2379 format
 * code, classified by `classifyEdifactDtmFormat` and read by the parser of its
 * kind. `zone1` to `zone4` are zones the reader named,
 * to read an offsetless value in.
 */
export const showDtmDecoderInput = z.object({
  input: z.string().min(1).max(64),
  format: ediCodeSchema.optional(),
  zone1: zoneSchema.optional(),
  zone2: zoneSchema.optional(),
  zone3: zoneSchema.optional(),
  zone4: zoneSchema.optional(),
});

/**
 * The X12 Time Reader: an X12 date (element 373), time (element 337) and time
 * code (element 623), read by `parseX12DateAndTime` (or `parseX12Date` or
 * `parseX12Time`), `classifyX12TimeCode` and `x12TimeCodeOffset` or
 * `x12TimeCodeZone`, and optionally a `DTP` value (an element 1251 value and its
 * 1250 qualifier) classified and read by the parser of its kind. `zone` to `zone4` are zones the reader named, to
 * read a local time in. Every field is optional because any of the three
 * elements may be empty; one of the date, the time, or the `DTP` value is
 * needed, or the widget has nothing to read.
 */
export const showX12TimeReaderInput = z
  .object({
    date: z.string().min(1).max(64).optional(),
    time: z.string().min(1).max(64).optional(),
    timeCode: ediCodeSchema.optional(),
    zone: zoneSchema.optional(),
    zone2: zoneSchema.optional(),
    zone3: zoneSchema.optional(),
    zone4: zoneSchema.optional(),
    format: ediCodeSchema.optional(),
    value: z.string().min(1).max(64).optional(),
  })
  .refine(
    (v) =>
      v.date !== undefined || v.time !== undefined || v.value !== undefined,
    {
      message: "Send a date, a time or a DTP value.",
    },
  );

/**
 * The Demurrage Clock: a container's events, and the four clocks that run
 * between them, each read by `demurrageClock`. `direction` is required here as
 * it is in the library: the same clock runs between different events on each
 * leg, so a model must say which the reader meant and never infer it from the
 * events. `type` and `scope` are the library's names; a value it does not read is
 * the widget's sentinel to show, not a reason to refuse the call. Each `at` carries
 * its offset or `Z`. `zone` is the terminal's clock, a display zone that is not an
 * argument of the library call, and is passed only when the reader named one.
 */
export const showDemurrageClockInput = z.object({
  events: z
    .array(
      z.object({
        type: z.string().min(1).max(32),
        at: dateTimeSchema,
      }),
    )
    .min(1)
    .max(6),
  scope: z.enum(["demurrage", "detention", "storage", "combined"]),
  direction: z.enum(["import", "export"]),
  startEvent: z.enum(["discharged", "available"]).optional(),
  zone: zoneSchema.optional(),
});

/**
 * A place for `bolTimestamp`: an IANA zone id or a UTC offset (`+08:00`). This
 * checks shape only, as `zoneSchema` does, and it also takes an offset. A zone
 * the library does not read is not a reason to refuse the call: the B/L Date
 * Stamp shows its own `NO SIGNAL`, with the reason, which is the lesson.
 */
export const placeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[A-Za-z0-9_+:-]+(\/[A-Za-z0-9_+-]+){0,2}$/,
    "must look like an IANA zone identifier or a UTC offset, e.g. Europe/London or +08:00",
  );

/**
 * The B/L Date Stamp: a moment, the event it stamps and the place of the event,
 * read by `bolTimestamp`. `value` carries its offset or `Z`. `timeZone` is the
 * place as the reader named it, a zone id or an offset, and is never guessed
 * from a port. `zone2` to `zone4` are other calendars to set beside it. `latest`
 * is the reader's own latest date allowed.
 */
export const showBlDateStampInput = z.object({
  value: dateTimeSchema,
  event: z.enum(["shippedOnBoard", "received", "issue"]),
  timeZone: placeSchema,
  zone2: placeSchema.optional(),
  zone3: placeSchema.optional(),
  zone4: placeSchema.optional(),
  latest: plainDateSchema.optional(),
});

/**
 * The EPCIS Event Reader: the two required time fields of a GS1 EPCIS event,
 * read by `parseEpcisEvent` and written back by `formatEpcisEvent`. Both values
 * are passed exactly as the reader gave them, and a value the library does not
 * read is the widget's `NO SIGNAL` to show, not a reason to refuse the call.
 * `eventTimeZoneOffset` is optional here because leaving it out is the lesson:
 * the library does not assume UTC, and the tool is never given a default.
 */
export const showEpcisEventReaderInput = z.object({
  eventTime: z.string().min(1).max(64),
  eventTimeZoneOffset: z.string().min(1).max(16).optional(),
});

/**
 * The Journey Split: the Delivery Scheduler's legs, with the journey's hours
 * sorted into moving and waiting. The legs are the same, so the schema is the
 * same one: `multimodalETA` takes the legs `scheduleDelivery` takes. `departure`
 * is optional on every leg here, as it is there, and which leg needs one is the
 * widget's sentinel to show.
 */
export const showJourneySplitInput = showDeliverySchedulerInput;

/**
 * The GNSS Week Decoder: a satellite week number and time of week read to UTC
 * on a rollover era, a RINEX navigation-file week, or a UTC instant turned into
 * each counter's week, time of week and era. The library takes an era as an
 * integer or `"rolling"`; a string keeps the schema flat for every provider.
 * The era is never defaulted, because the library requires it: `broadcast`
 * needs exactly one of `rolloverEra` and `rolloverNotBefore`. A value the
 * library does not read is the widget's `NO SIGNAL` to show, not a reason to
 * refuse the call.
 */
export const showGnssWeekDecoderInput = z
  .object({
    mode: z.enum(GNSS_DECODER_MODES),
    counter: z.enum(GNSS_WEEK_COUNTERS).optional(),
    system: z.enum(RINEX_WEEK_SYSTEMS).optional(),
    week: z.number().int().min(0).optional(),
    timeOfWeekSeconds: z.number().min(0).optional(),
    rolloverEra: z
      .string()
      .regex(/^(?:0|[1-9]\d{0,5}|rolling)$/)
      .optional(),
    rolloverNotBefore: z.string().min(10).max(64).optional(),
    utc: z.string().min(10).max(64).optional(),
  })
  .refine(
    (v) =>
      v.mode === "broadcast"
        ? v.counter !== undefined &&
          v.week !== undefined &&
          v.timeOfWeekSeconds !== undefined &&
          (v.rolloverEra === undefined) !== (v.rolloverNotBefore === undefined)
        : v.mode === "rinex"
          ? v.system !== undefined &&
            v.week !== undefined &&
            v.timeOfWeekSeconds !== undefined
          : v.utc !== undefined,
    {
      message:
        "broadcast needs counter, week, timeOfWeekSeconds and exactly one of rolloverEra and rolloverNotBefore; rinex needs system, week and timeOfWeekSeconds; utc needs utc.",
    },
  );

/**
 * The Satellite Clock Converter: one instant, as a UTC instant or a string
 * ending in the name of a time scale. The string is passed exactly as the
 * reader gave it; one the library does not read is the widget's `NO SIGNAL`.
 */
export const showSatelliteClockConverterInput = z.object({
  value: z.string().min(10).max(64),
});

/**
 * The GNSS Rollover Checker: a week counter and the firmware's era, given as
 * the build date the receiver counts from or as an era number, with the date
 * to check. Exactly one of the two era forms is required, and neither is
 * defaulted. `date` is left out for today.
 */
export const showGnssRolloverCheckerInput = z
  .object({
    counter: z.enum(GNSS_WEEK_COUNTERS),
    firmwareNotBefore: z.string().min(10).max(64).optional(),
    firmwareEra: z
      .string()
      .regex(/^(?:0|[1-9]\d{0,5})$/)
      .optional(),
    date: z.string().min(10).max(64).optional(),
  })
  .refine(
    (v) =>
      (v.firmwareNotBefore === undefined) !== (v.firmwareEra === undefined),
    {
      message: "Send exactly one of firmwareNotBefore and firmwareEra.",
    },
  );

/**
 * The Leap Second Timeline: a date for TAI - UTC, two dates to count the leap
 * seconds between, and a timestamp to check for a real 23:59:60. Each is
 * optional and at least one is needed. Dates are passed as the reader gave
 * them; one the library does not read is the widget's `NO SIGNAL`.
 */
export const showLeapSecondTimelineInput = z
  .object({
    date: z.string().min(10).max(64).optional(),
    check: z.string().min(10).max(64).optional(),
    from: z.string().min(10).max(64).optional(),
    to: z.string().min(10).max(64).optional(),
  })
  .refine(
    (v) =>
      v.date !== undefined ||
      v.check !== undefined ||
      v.from !== undefined ||
      v.to !== undefined,
    { message: "Send a date, a check, a from or a to." },
  );

/**
 * Elapsed vs. Clock Difference: two UTC instants, passed exactly as the reader
 * gave them.
 */
export const showElapsedVsClockInput = z.object({
  start: z.string().min(10).max(64),
  end: z.string().min(10).max(64),
});

/**
 * Stored Time Audit: the reader's stored RFC 9557 strings, one per line,
 * exactly as given (`line` picks which one to draw). The chat args are the
 * permalink args.
 */
export const showStoredTimeAuditInput = z.object({
  values: z
    .string()
    .min(1)
    .max(1000)
    // Not trimmed: the args are passed exactly as given. A blank list is
    // refused so the card opens on the reader's empty box, not a preset.
    .refine((s) => s.trim() !== "", { message: "Send at least one line." }),
  line: z
    .string()
    .regex(/^(?:[1-9]|1[0-2])$/)
    .optional(),
});

/** Typed as the library's `IsoWeekday`, so a parsed shift is a `HolidayRule` shift. */
const isoWeekdaySchema = z
  .number()
  .int()
  .min(1)
  .max(7) as unknown as z.ZodType<IsoWeekday>;

/** Where a holiday on one weekday is observed. */
const observanceShiftSchema = z.union([
  z.literal("nextWorkingDay"),
  z.object({ next: isoWeekdaySchema }),
  z.object({ previous: isoWeekdaySchema }),
]);

/** An observance policy: ISO weekday keys, each with a shift. A weekday left
 * out moves nothing. */
const observancePolicySchema = z.object({
  1: observanceShiftSchema.optional(),
  2: observanceShiftSchema.optional(),
  3: observanceShiftSchema.optional(),
  4: observanceShiftSchema.optional(),
  5: observanceShiftSchema.optional(),
  6: observanceShiftSchema.optional(),
  7: observanceShiftSchema.optional(),
});

/** One `HolidayRule`, as the library types it. */
const holidayRuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fixed"),
    name: z.string().max(64),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    observed: observancePolicySchema.optional(),
  }),
  z.object({
    kind: z.literal("calendarFixed"),
    name: z.string().max(64),
    calendar: z.string().min(1).max(32),
    monthCode: z.string().regex(/^M\d{2}L?$/),
    day: z.number().int().min(1).max(31),
    observed: observancePolicySchema.optional(),
  }),
  z.object({
    kind: z.literal("nthWeekday"),
    name: z.string().max(64),
    month: z.number().int().min(1).max(12),
    weekday: isoWeekdaySchema,
    n: z.union([z.number().int().min(-5).max(5), z.literal("last")]),
  }),
  z.object({
    kind: z.literal("easterRelative"),
    name: z.string().max(64),
    offsetDays: z.number().int().min(-400).max(400),
    computus: z.enum(["gregorian", "julian"]).optional(),
  }),
  z.object({
    kind: z.literal("dates"),
    name: z.string().max(64),
    dates: z.array(plainDateSchema).max(60),
  }),
]);

/**
 * The Holiday Rule Builder: the rules, the weekend, a year and a zone, exactly
 * as the reader gave them. The rules are never invented. A rule list is cut at
 * the widget's own row limit. The chat args are the permalink args.
 */
export const showHolidayRuleBuilderInput = z.object({
  rules: z.array(holidayRuleSchema).min(1).max(12).optional(),
  weekend: z.array(isoWeekdaySchema).max(7).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  zone: zoneSchema.optional(),
});

/**
 * The Observance Comparator: one to three holidays as month and day, the years
 * to compare and the weekend, with up to four policies the reader gave.
 */
export const showObservanceComparatorInput = z.object({
  holidays: z
    .array(
      z.object({
        month: z.number().int().min(1).max(12),
        day: z.number().int().min(1).max(31),
      }),
    )
    .min(1)
    .max(3)
    .optional(),
  years: z
    .object({
      from: z.number().int().min(1900).max(2100),
      to: z.number().int().min(1900).max(2100),
    })
    .optional(),
  weekend: z.array(isoWeekdaySchema).max(7).optional(),
  policies: z.array(observancePolicySchema).min(1).max(4).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
});

/** The Easter offsets Moving Feasts has a row for (`FEAST_OFFSETS`). */
const FEAST_OFFSET_DAYS: readonly number[] = [-46, -2, 0, 1, 39, 49, 50];

/**
 * Moving Feasts: a year, with the Easter offsets and the weekday-in-month rule
 * the reader named. Each is optional; the widget fills the rest with its first
 * example. An offset the widget has no row for is refused here, so the model
 * hears why rather than the widget showing its defaults.
 */
export const showMovingFeastsInput = z.object({
  year: z.number().int().min(1900).max(2100).optional(),
  offsets: z
    .array(z.number().int())
    .max(7)
    .refine((list) => list.every((n) => FEAST_OFFSET_DAYS.includes(n)), {
      message: `Each offset is one of ${FEAST_OFFSET_DAYS.join(", ")}.`,
    })
    .optional(),
  month: z.number().int().min(1).max(12).optional(),
  weekday: isoWeekdaySchema.optional(),
  n: z.union([z.number().int().min(-5).max(5), z.literal("last")]).optional(),
});

/**
 * Canada 2026 clock-change checker: optionally one zone to pin on its map.
 *
 * The id is checked against the checker's own list (`canada-zones.json`) in the Worker's
 * `execute` and the registry's `validate`, not here: a zone outside the list is a call to
 * refuse with a reason, not a malformed one.
 */
export const showCanadaClockChangeInput = z.object({
  zone: zoneSchema.optional(),
});

/**
 * Duration Parser Bench: the reader's duration string exactly as given (never
 * trimmed or corrected: a leading space is a case the bench shows). The chat
 * args are the permalink args.
 */
export const showDurationParserBenchInput = z.object({
  text: z.string().min(1).max(64),
  locale: z.string().min(2).max(35).optional(),
});

/**
 * What a tool returns to the model.
 *
 * The widget is rendered on the client from `part.input`; this output exists so
 * the tool call reaches a *terminal* state. That is not a nicety — see
 * `worker/tools.ts` for the concrete failure it avoids on the reader's second
 * question.
 */
export const toolOutput = z.object({
  ok: z.boolean(),
  widget: z.string(),
  note: z.string().optional(),
});

export type DoxToolName =
  | "showGlobe"
  | "showDstInspector"
  | "showIntervalVisualizer"
  | "showConverterBench"
  | "showDwellLedger"
  | "showFreeTimeLedger"
  | "showBillingDeadlines"
  | "showDeliveryScheduler"
  | "showConnectionChecker"
  | "showTimetableReader"
  | "showCrossingClock"
  | "showCutoffStack"
  | "showCutoffRuler"
  | "showCutoffCountdown"
  | "showPunctualityBoard"
  | "showEtaDrift"
  | "showDepartureBoard"
  | "showZonePlanner"
  | "showDtmDecoder"
  | "showX12TimeReader"
  | "showDemurrageClock"
  | "showBlDateStamp"
  | "showEpcisEventReader"
  | "showJourneySplit"
  | "showGnssWeekDecoder"
  | "showSatelliteClockConverter"
  | "showGnssRolloverChecker"
  | "showLeapSecondTimeline"
  | "showElapsedVsClock"
  | "showStoredTimeAudit"
  | "showHolidayRuleBuilder"
  | "showObservanceComparator"
  | "showMovingFeasts"
  | "showCanadaClockChange"
  | "showDurationParserBench";

export const DOX_TOOL_INPUTS = {
  showGlobe: showGlobeInput,
  showDstInspector: showDstInspectorInput,
  showIntervalVisualizer: showIntervalVisualizerInput,
  showConverterBench: showConverterBenchInput,
  showDwellLedger: showDwellLedgerInput,
  showFreeTimeLedger: showFreeTimeLedgerInput,
  showBillingDeadlines: showBillingDeadlinesInput,
  showDeliveryScheduler: showDeliverySchedulerInput,
  showConnectionChecker: showConnectionCheckerInput,
  showTimetableReader: showTimetableReaderInput,
  showCrossingClock: showCrossingClockInput,
  showCutoffStack: showCutoffStackInput,
  showCutoffRuler: showCutoffRulerInput,
  showCutoffCountdown: showCutoffCountdownInput,
  showPunctualityBoard: showPunctualityBoardInput,
  showEtaDrift: showEtaDriftInput,
  showDepartureBoard: showDepartureBoardInput,
  showZonePlanner: showZonePlannerInput,
  showDtmDecoder: showDtmDecoderInput,
  showX12TimeReader: showX12TimeReaderInput,
  showDemurrageClock: showDemurrageClockInput,
  showBlDateStamp: showBlDateStampInput,
  showEpcisEventReader: showEpcisEventReaderInput,
  showJourneySplit: showJourneySplitInput,
  showGnssWeekDecoder: showGnssWeekDecoderInput,
  showSatelliteClockConverter: showSatelliteClockConverterInput,
  showGnssRolloverChecker: showGnssRolloverCheckerInput,
  showLeapSecondTimeline: showLeapSecondTimelineInput,
  showElapsedVsClock: showElapsedVsClockInput,
  showStoredTimeAudit: showStoredTimeAuditInput,
  showHolidayRuleBuilder: showHolidayRuleBuilderInput,
  showObservanceComparator: showObservanceComparatorInput,
  showMovingFeasts: showMovingFeastsInput,
  showCanadaClockChange: showCanadaClockChangeInput,
  showDurationParserBench: showDurationParserBenchInput,
} as const;

/** Prompt copy, kept beside the schemas so the two cannot drift. */
export const DOX_TOOL_DOCS: {
  name: DoxToolName;
  purpose: string;
  when: string;
  args: string;
}[] = [
  {
    name: "showGlobe",
    purpose:
      "A rotating globe centred on one zone, with live clocks for every zone beside it.",
    when: "the reader asks what time it is somewhere, or where a zone is",
    args: "zone (one IANA id to centre on)",
  },
  {
    name: "showDstInspector",
    purpose:
      "An interactive inspector for a zone's DST transitions in a given year, scrubbable minute by minute.",
    when: "the reader asks what happens to a specific local time across a DST change — a gap or an overlap",
    args: "zone (IANA id), year (1900-2100), preset (gap|overlap|normal|fixed), disambiguation, offset",
  },
  {
    name: "showIntervalVisualizer",
    purpose:
      "Two time intervals on a shared timeline, with their intersection, union, difference and XOR.",
    when: "the reader asks how two time ranges relate — overlap, gaps, combining them",
    args: "aStart, aEnd, bStart, bEnd — ISO date-times. Include a zone when the reader named one (2024-10-27T09:00:00+00:00[Europe/London]); a plain 2024-10-27T09:00:00 is fine when they did not, and is read as UTC.",
  },
  {
    name: "showConverterBench",
    purpose:
      "A converter showing one instant across two zones and every supported format.",
    when: "the reader asks to convert a specific time between two zones, or how it formats",
    args: "value (ISO date-time; a plain 2024-03-15T14:30:00 is read as UTC), from (IANA id), to (IANA id), locale (optional BCP-47 tag)",
  },
  {
    name: "showDwellLedger",
    purpose:
      "A dwell drawn on a zone's real local-day grid: the elapsed hours, and every local calendar day the dwell touched, counted by dwellTime.",
    when: "the reader asks how long something sat somewhere, or how many days a dwell, stay, layover or visit counts",
    args: "entry, exit (ISO date-times; a plain 2024-06-15T23:00:00 is read as wall time in zone), zone (IANA id the days are counted in), compareZone (optional second IANA id, to show the same instants counted elsewhere)",
  },
  {
    name: "showFreeTimeLedger",
    purpose:
      "A container's free time and demurrage drawn on the terminal's real local-day grid: the free days, the expiry, the chargeable days and their dates, counted by freeTimeExpiry and chargeableDays.",
    when: "the reader asks when free time ends, how many days of demurrage or detention are due, which dates are charged, or how the start-day convention or a working-day tariff changes the answer",
    args: "clockStart, clockEnd (ISO date-times; a plain 2024-06-14T15:00:00 is read as wall time in zone), freeDays (whole number), firstDay (eventDay | nextDay: whether the event day is free day one; ask if the reader did not say), basis (calendar | working: how free days are counted), chargeBasis (calendar | working: how days after free time are charged; many tariffs count both in calendar days, and where free time is in working days most charge calendar days after it, some working days only; ask if the reader did not say), zone (the terminal's IANA id), weekend (optional ISO weekday numbers, working basis), holidays (optional ISO dates, working basis), tiers (optional last chargeable-day ordinal of each band)",
  },
  {
    name: "showBillingDeadlines",
    purpose:
      "The deadline chain around a demurrage or detention invoice on a day strip: the last date to issue it, to dispute it and to resolve the dispute, each counted in calendar days by billingTimeline, with every window a number the reader supplies.",
    when: "the reader asks for the last date to issue, dispute or resolve a demurrage or detention invoice, or whether an invoice or dispute date falls on or before such a deadline",
    args: "anchorOn (ISO date the issue window counts from: the last date a charge accrued, or for a re-bill the issuance date of the invoice received), invoiceIssuedOn (optional ISO date), requestReceivedOn (optional ISO date; needs invoiceIssuedOn), issueDays, disputeDays, resolutionDays (whole numbers of calendar days from the reader's tariff or contract; never assume them: ask if the reader did not say), agreedResolutionOn (optional ISO date the parties agreed). Dates only: reduce a date-time to the billing party's local date.",
  },
  {
    name: "showDeliveryScheduler",
    purpose:
      "A multi-leg journey — truck, ship, rail — chained by scheduleDelivery into one ETA, with every handoff an exact instant, each arrival shown in the zone it lands in, and a missed connection shown as null.",
    when: "the reader asks when a multi-leg or multi-modal shipment arrives, or what local time each leg lands at across a DST change or the Date Line",
    args: "legs (1 to 4, in travel order): departure (ISO date-time with an offset or a bracketed zone; required on the first leg; on a later leg only when it has a scheduled departure), duration (ISO 8601 time units such as PT46H or P11D; no months or years), timeZone (IANA id where the leg arrives), dwellAfter (optional handling time at the handoff after the leg), mode (optional tag such as truck, ship or rail). startTimeZone (optional IANA id a zoneless first departure is read in). Never invent a zone: ask if the reader did not name one.",
  },
  {
    name: "showConnectionChecker",
    purpose:
      "One handoff checked by scheduleDelivery: an arriving leg, the handling time at the port (the minimum connect time) and a scheduled onward departure, made or missed, beside the naive check of the times as printed.",
    when: "the reader asks whether cargo or a passenger makes a scheduled onward departure after a handoff with a given handling time",
    args: "inboundDeparture (ISO date-time with an offset or a bracketed zone), inboundDuration (ISO 8601 time units), portZone (IANA id of the handoff), handlingMinutes (whole minutes, 0 to 240; ask if the reader did not say), onwardDeparture (the scheduled departure, with a bracketed zone, e.g. 2024-03-31T14:00:00[Europe/Amsterdam]), onwardDuration and onwardZone (optional)",
  },
  {
    name: "showTimetableReader",
    purpose:
      "A transport timetable's printed local departure times read as exact instants through scheduleDelivery's startTimeZone, marking a time the clock shows twice (the earlier instant) or never (the later instant).",
    when: "the reader asks which instant a printed timetable or schedule departure time means, especially on a night the clocks change",
    args: "startTimeZone (IANA id the timetable is printed in), departures (1 to 4 wall times as printed, e.g. 2024-10-27T02:30:00, with no offset), offsets (optional, one per departure, to pick a pass), duration (the run time, ISO 8601 time units), timeZone (IANA id where it arrives)",
  },
  {
    name: "showCrossingClock",
    purpose:
      "A crossing — a canal transit, a strait passage, a border queue — timed by crossingTime: the exact elapsed hours, with the entry and exit read on the clock of the zone that administers it.",
    when: "the reader asks how long a crossing, transit or passage between two logged times really took, or what the entry and exit read on one zone's clock, especially across a DST change",
    args: "entry, exit (ISO date-times; a plain 2024-03-10T00:00 is read as wall time in targetZone), targetZone (IANA id of the clock the crossing is read on)",
  },
  {
    name: "showCutoffStack",
    purpose:
      "A sailing's whole stack of cut-offs, computed by cutoffSchedule against one departure, earliest first, on a day timeline with closed days shaded and each cut-off a weekend or holiday rolled drawn where it landed and where it would have been.",
    when: "the reader asks when each of several deadlines or cut-offs before a sailing, flight or loading closes, or how a weekend or holiday moves them",
    args: "anchor (the event the cut-offs count back from: an ISO date-time with an offset or a bracketed zone), timeZone (IANA id of the terminal's clock), cutoffs (1 to 4, each a name, an offset as an ISO 8601 duration such as P2D or PT48H, and an optional atLocalTime such as 17:00), weekend (optional ISO weekday numbers of closed days, 6 and 7 for Saturday and Sunday), holidays (optional ISO dates, up to 5), roll (preceding, following, modifiedPreceding, modifiedFollowing or none; required whenever weekend or holidays are given: there is no default, so ask which way a cut-off on a closed day moves). Never invent a zone.",
  },
  {
    name: "showCutoffRuler",
    purpose:
      'One departure\'s "N days before" read three ways by cutoffAt on one exact-time axis: N calendar days (P2D), N × 24 exact hours (PT48H), and N days before at a fixed local time, with any DST change between them marked.',
    when: "the reader asks whether N days before an event is the same as N × 24 hours before, or where a days-before cut-off lands across a DST change",
    args: "anchor (ISO date-time with an offset or a bracketed zone), timeZone (IANA id of the clock the cut-off is read on), days (whole days, 1 to 7), atLocalTime (the local time of day for the pinned reading, e.g. 17:00)",
  },
  {
    name: "showCutoffCountdown",
    purpose:
      "A cut-off compared with a moment by isPastCutoff and timeToCutoff: the time left, or how late as a negative duration, with the cut-off counted as passed at the deadline itself.",
    when: "the reader asks whether a cut-off or deadline has passed at a given time, or how much time is left or how late they are",
    args: "cutoff (ISO date-time with an offset or a bracketed zone), now (optional ISO date-time with an offset or zone; omit it to use the reader's own clock), timeZone (IANA id of the clock both are shown on)",
  },
  {
    name: "showPunctualityBoard",
    purpose:
      "Planned and actual times judged by scheduleDeviation, classifyPunctuality and punctualityRate on one axis, with the tolerance band drawn and draggable: each deviation in exact time, early, on time or late with both edges outside, and the on-time rate.",
    when: "the reader asks whether an arrival or departure was late, early or on time, by how much, or what share of several was on time under a tolerance",
    args: "pairs (1 to 6, each a planned and an actual ISO date-time with an offset or a bracketed zone), late (the late tolerance as an ISO 8601 duration such as PT15M or P1D; required: there is no default, so ask for it), early (optional early tolerance; without it an early arrival is on time), compareLate (optional second late tolerance to compare side by side, such as PT120M against PT60M)",
  },
  {
    name: "showEtaDrift",
    purpose:
      "Planned, estimated, requested and actual timestamps of one event plotted by when each was recorded: the best available pick from bestAvailable with its class beside the naive latest-recorded pick, and how far the estimate moved from estimateDrift, against an optional tolerance.",
    when: "the reader asks which of several planned, estimated, requested or actual times to show for an arrival or event, or how far an ETA or estimate moved between revisions",
    args: "events (1 to 6, each a classifier PLN, EST, REQ or ACT, an at time and a recordedAt time, both ISO date-times with an offset or a bracketed zone), tolerance (optional ISO 8601 duration such as PT8H; exceedsTolerance is true only when the drift is greater than it)",
  },
  {
    name: "showDepartureBoard",
    purpose:
      "A timetable on a time rail with the arrival as a draggable marker and the minimum connection as a hatched bar: the departure nextDeparture says the arrival can make, beside the naive pick with no connection time, with a service window's end excluded and a link to hand the result to the Delivery Scheduler.",
    when: "the reader asks which departure from a timetable, or from a service every N minutes, an arrival can still make after a connection or boarding time",
    args: "after (the arrival: ISO date-time with an offset or a bracketed zone written with its offset), departures (1 to 6 departures, each with an offset) or headway with from and to (a service every headway, an ISO 8601 duration such as PT20M, from the first departure up to but never at to), minimumConnection (optional ISO 8601 duration such as PT45M), onwardDuration and onwardZone (optional: the next leg's duration and the IANA id of its destination, to hand the result to the Delivery Scheduler). Give either departures or headway, from and to.",
  },
  {
    name: "showZonePlanner",
    purpose:
      "Several zones pinned side by side on one slider: every pinned clock moves together, each says whether it is in daylight saving at that instant, and a clock change that falls inside the shift is named on the zone it affects. A button jumps to the next change among the zones shown.",
    when: "the reader asks what time it is in several places at once, or wants to find or propose a meeting time across zones, or asks which of their zones changes clocks first",
    args: "zones (1 to 8 IANA ids, in the order to show them), time (optional UTC instant ending in Z, such as 2026-03-08T06:45:00Z, that the slider shifts from; omit it to start at now, rounded forward to the next 5 minutes). Never invent a zone.",
  },
  {
    name: "showDtmDecoder",
    purpose:
      "A UN/EDIFACT DTM segment or value decoded against its 2379 format code: classifyEdifactDtmFormat names the kind (date, time, local date-time, date-time with offset, date period or date-time period), the parser of that kind reads it, and the tool shows whether the offset is stated or not, the instant an offsetless value names in each zone the reader chooses, and the value written back by the matching formatter.",
    when: "the reader asks what a UN/EDIFACT DTM segment, value or 2379 format code such as 203, 303 or 718 means, whether it carries an offset, or what instant it names",
    args: "input (a whole DTM segment such as DTM+137:202406151430:203' or the bare value such as 202406151430; at most 64 characters), format (the 2379 format code; needed with a bare value), zone1 to zone4 (optional IANA ids to read an offsetless value in; only zones the reader named: never choose one from a port, a place, a partner or an abbreviation).",
  },
  {
    name: "showX12TimeReader",
    purpose:
      "An X12 date, time and time code read by parseX12DateAndTime, classifyX12TimeCode and x12TimeCodeOffset or x12TimeCodeZone (elements 373, 337 and 623, as AT7, G62 and DTM carry them): whether the offset is stated or not, the instant once a stated offset or a zone the reader picks fixes it, and the date and time written back by formatX12Date and formatX12TimeElement, in the form the time was sent. A DTP value (a 1250 qualifier and an element 1251 value) is classified by classifyX12DateTimePeriodFormat and read by the parser of its kind.",
    when: "the reader asks what an X12 date, time or time code means, what a 623 time code such as ET, LT, UT or 13 states, what instant the date, time and time code of an AT7, G62 or DTM name, or what a DTP value under a 1250 qualifier such as D8, RD8 or DTS means",
    args: "date (element 373 as sent, such as 20240615; leave out when only a time is sent), time (element 337 as sent, such as 1430; leave out when only a date is sent), timeCode (optional element 623 time code such as ET, LT, UT or 13, exactly as sent), zone, zone2, zone3 and zone4 (optional IANA ids to read a local time in; only zones the reader named: never choose one from the time code, a place or a partner), format and value (a DTP value: the 1250 qualifier such as RD8, and the element 1251 value such as 20240615-20240620).",
  },
  {
    name: "showDemurrageClock",
    purpose:
      "A container's events and the four clocks that run between them, each read by demurrageClock: which two events bound demurrage, detention, storage and the merged clock, drawn as half-open bars under one rail of events over the terminal's local days, and a link to count the chosen clock's days in the Free Time Ledger.",
    when: "the reader asks which events a demurrage, detention, storage or combined clock runs between, or how detention differs from demurrage",
    args: "events (1 to 6 of { type, at }: type is one of discharged, available, gatedOut, emptyReturned, emptyReleased, gatedIn, loaded; at is an ISO instant with Z, an offset, or an offset and a bracketed zone: never a bare local time), scope (demurrage | detention | storage | combined), direction (import | export: required, and never guessed from the events; ask if the reader did not say), startEvent (optional, discharged | available: where an import demurrage, storage or combined clock starts), zone (optional IANA id of the terminal, only when the reader named one: it sets the day columns and the local times, and is not an argument of demurrageClock)",
  },
  {
    name: "showBlDateStamp",
    purpose:
      "A moment and the place of an event, and the calendar date bolTimestamp gives for it, the date a bill of lading carries, set against the UTC date and up to three other calendars and drawn as lanes of local days on one time axis, with a slider that moves the moment.",
    when: "the reader asks what date goes on a bill of lading, or why a B/L date differs from a UTC timestamp",
    args: "value (the moment: an ISO instant with Z, an offset, or an offset and a bracketed zone: never a bare local time), event (shippedOnBoard | received | issue: the DCSA fields shippedOnBoardDate, receivedForShipmentDate and issueDate), timeZone (the place of the event as the reader named it: an IANA id or a UTC offset such as +08:00; never guessed from a port or a city), zone2, zone3 and zone4 (optional other calendars to set beside it, each an IANA id or an offset), latest (optional YYYY-MM-DD, the latest date allowed, the reader's own date)",
  },
  {
    name: "showEpcisEventReader",
    purpose:
      "The two required time fields of a GS1 EPCIS 2.0 event, eventTime and eventTimeZoneOffset, read by parseEpcisEvent: whether the offset is stated, the instant, the offset and the local time at the event, the same moment on a UTC day rail and a local day rail with the two dates compared, and the fields written back by formatEpcisEvent, with a link to read the moment as a shipped on board date.",
    when: "the reader asks what a GS1 EPCIS eventTime and eventTimeZoneOffset mean, what local time an EPCIS event happened at, or why an event needs both fields",
    args: "eventTime (as the reader gave it, such as 2024-06-15T23:30:00Z; at most 64 characters), eventTimeZoneOffset (as the reader gave it, such as +02:00; leave it out when the reader gave none: never fill it, and never assume UTC)",
  },
  {
    name: "showJourneySplit",
    purpose:
      "A multi-leg journey's hours sorted two ways on one scale, in the order they happen and gathered into moving and waiting: multimodalETA gives the ETA, the moving time and the waiting time, scheduleDelivery the instant each leg leaves and arrives, and diffUtcAsDuration each wait, split into the handling the reader stated and the wait for a scheduled departure, with a link to open the same legs in the Delivery Scheduler.",
    when: "the reader asks how much of a multi-leg journey is moving and how much is waiting, or what the total transit and dwell of a multimodal move are",
    args: "legs (1 to 4, in travel order): departure (ISO date-time with an offset or a bracketed zone; required on the first leg; on a later leg only when it has a scheduled departure), duration (ISO 8601 time units such as PT46H or P11D; no months or years), timeZone (IANA id where the leg arrives), dwellAfter (optional handling time at the hand-off after the leg), mode (optional tag such as truck, ship or rail). startTimeZone (optional IANA id a zoneless first departure is read in). Never invent a zone: ask if the reader did not name one.",
  },
  {
    name: "showGnssWeekDecoder",
    purpose:
      "Decode a satellite week number and time of week to UTC on every rollover era, read a RINEX navigation-file week, or turn a UTC instant into each counter's week, time of week and era, with each system's offset from UTC.",
    when: "the reader asks what UTC instant a GPS, Galileo, BeiDou, QZSS or NavIC week number and time of week is, about a week rollover or which era a week belongs to, about a RINEX navigation-file week, or about the offset between UTC and a satellite system's time at an instant",
    args: "mode is broadcast, rinex or utc. Pass counter (for example GPS-LNAV), week, timeOfWeekSeconds and either rolloverEra (digits or rolling) or rolloverNotBefore (the date a receiver counts from) as the reader gave them; never pick an era for them. system names a RINEX record's system. utc is an ISO 8601 instant.",
  },
  {
    name: "showSatelliteClockConverter",
    purpose:
      "Show one instant on every satellite clock and on TAI, with each clock's lead over UTC on that date.",
    when: "the reader asks what a GPS, Galileo, BeiDou, QZSS, GLONASS or NavIC clock or TAI reads at an instant, how far a satellite clock is from UTC, or to convert a time-scale string to UTC",
    args: "value exactly as the reader gave it: a UTC instant or a string ending in TAI, GPS, GAL, BDT, QZS, GLO or IRN",
  },
  {
    name: "showGnssRolloverChecker",
    purpose:
      "Check when a receiver whose firmware counts weeks from a build date, or fixes the rollover era, starts reporting wrong dates, for any satellite week counter, with the next wrap of every counter.",
    when: "the reader asks about a GNSS week rollover, whether a receiver is affected, when the next rollover is, or why a receiver reports a date about 19.6 years early",
    args: "counter as named (for example IRN-LNAV); firmwareNotBefore when the reader gives a build or release date, firmwareEra as digits when they give an era; date only when the reader names one",
  },
  {
    name: "showLeapSecondTimeline",
    purpose:
      "Show every leap second UTC has had on a timeline, TAI - UTC at a date, the leap seconds between two dates, and whether a 23:59:60 was really inserted.",
    when: "the reader asks how many leap seconds there are or were between dates, what TAI - UTC was on a date, whether a 23:59:60 timestamp is real, or when leap seconds end",
    args: "date (for TAI - UTC), check (a timestamp to test for a 23:59:60), from and to (the span to count): dates exactly as the reader gave them; send only what they named",
  },
  {
    name: "showElapsedVsClock",
    purpose:
      "Compare the clock difference between two UTC instants with the seconds that really passed, and list the leap seconds between them.",
    when: "the reader asks how many seconds really passed between two UTC times, why a duration across a leap second is a second short, or how to measure elapsed time across 23:59:60",
    args: "start and end: both instants exactly as the reader gave them",
  },
  {
    name: "showStoredTimeAudit",
    purpose:
      "Check stored RFC 9557 strings that carry both an offset and a zone, show whether each still names one instant under this browser's time zone rules, and every reading it allows when it does not",
    when: "Call when the reader asks why a stored zoned time no longer parses or resolves, whether a stored offset still matches its zone, what happens to stored future events after a time zone rule change, or how Temporal's `offset` option reads such a string",
    args: "values: the reader's strings exactly as given, one per line, each with an offset or `Z` and a bracketed zone; never invent or correct one. line: optional, which line to draw",
  },
  {
    name: "showHolidayRuleBuilder",
    purpose:
      "Build a holiday calendar from rules (fixed dates, dates in another calendar, a weekday of a month, days from Easter, listed dates), and show which rule closed which day of a year, with the day a rule is moved from and to.",
    when: "the reader asks how a set of holiday rules becomes closed days, where a holiday lands when it falls on a weekend, or how the order of rules changes the result",
    args: "rules (the reader's rules exactly as given, each with a name and a kind; leave an observance out unless the reader gave one), weekend (ISO weekdays, 1 Monday to 7 Sunday), year, zone. Pass only rules, dates and policies the reader gave. Never supply a place's holidays or its observance policy from memory. A rule moved by its policy closes only its observed day. To close both days, list the rule twice, once with no policy.",
  },
  {
    name: "showObservanceComparator",
    purpose:
      "Compare observance policies side by side: where each of one to three holidays is observed, year by year, under up to four policies the reader gave.",
    when: "the reader asks how a holiday moves when it falls on a weekend, or where two policies disagree on the same date",
    args: "holidays (month and day), years (from and to), weekend (ISO weekdays), policies (the reader's own, as weekday to shift), year (the row to open). Pass only rules, dates and policies the reader gave. Never supply a place's holidays or its observance policy from memory. Policies are the reader's; never name a place's policy.",
  },
  {
    name: "showMovingFeasts",
    purpose:
      "Show Easter Sunday by the Gregorian and the Julian computus in a year, the days around it, and the n-th weekday of a month.",
    when: "the reader asks when Easter falls, how far apart the two Easters are, or which date the third Monday or last Sunday of a month is",
    args: "year; offsets (days from Easter, only ones the reader named, each one of -46, -2, 0, 1, 39, 49 and 50; for any other, say so instead of calling); month, weekday (1 Monday to 7 Sunday) and n (1 to 5, -1 to -5 or last) for a weekday of a month. Pass only rules, dates and policies the reader gave. Never supply a place's holidays or its observance policy from memory.",
  },
  {
    name: "showCanadaClockChange",
    purpose:
      "Check whether a device or server has current time zone data for the clock changes that apply from 2026: a table of four zones' correct offsets beside the reader's browser, a check-mark or cross verdict for the reader's browser with what to do, a command to test the reader's own servers, a card on how gmt finds and repairs saved events, the 2026 and 2027 clock changes, live clocks, a map of the zones with the last and next change for each, and a Did your saved events move? form, pre-filled with an example and run on load, that reads up to 50 pasted saved events and says which are out of date and what to do about each.",
    when: "Call when the reader asks whether their runtime, server or browser still applies an old clock change, whether its time zone data is current, or what a zone's next clock change is",
    args: "zone: optional, one IANA id from the checker's list to pin on the map (never a province or a place name).",
  },
  {
    name: "showDurationParserBench",
    purpose:
      "Read a duration string people write (`2h 30m`, `1.5h`, `3 days`) under GMT's published grammar, and show the ISO 8601 duration, the compact form, the locale words, and why `1m` is a minute and `P1M` a month.",
    when: "the reader asks what a duration string such as `30s`, `1m`, `7d` or `1.5h` means, whether `m` is a minute or a month, how to parse a timeout or config duration, or why writing laytime as `3 days` is not always 72 hours",
    args: "text: the reader's string exactly as given, never corrected; locale: only when the reader names one.",
  },
];

/**
 * Tool definitions without `execute` — the Worker attaches one (see
 * `worker/tools.ts`). Exported for the client, which needs the schemas and the
 * names but must never carry server behaviour.
 */
export const DOX_TOOLS = {
  showGlobe: tool({
    description: DOX_TOOL_DOCS[0].purpose,
    inputSchema: showGlobeInput,
  }),
  showDstInspector: tool({
    description: DOX_TOOL_DOCS[1].purpose,
    inputSchema: showDstInspectorInput,
  }),
  showIntervalVisualizer: tool({
    description: DOX_TOOL_DOCS[2].purpose,
    inputSchema: showIntervalVisualizerInput,
  }),
  showConverterBench: tool({
    description: DOX_TOOL_DOCS[3].purpose,
    inputSchema: showConverterBenchInput,
  }),
  showDwellLedger: tool({
    description: DOX_TOOL_DOCS[4].purpose,
    inputSchema: showDwellLedgerInput,
  }),
  showFreeTimeLedger: tool({
    description: DOX_TOOL_DOCS[5].purpose,
    inputSchema: showFreeTimeLedgerInput,
  }),
  showBillingDeadlines: tool({
    description: DOX_TOOL_DOCS[6].purpose,
    inputSchema: showBillingDeadlinesInput,
  }),
  showDeliveryScheduler: tool({
    description: DOX_TOOL_DOCS[7].purpose,
    inputSchema: showDeliverySchedulerInput,
  }),
  showConnectionChecker: tool({
    description: DOX_TOOL_DOCS[8].purpose,
    inputSchema: showConnectionCheckerInput,
  }),
  showTimetableReader: tool({
    description: DOX_TOOL_DOCS[9].purpose,
    inputSchema: showTimetableReaderInput,
  }),
  showCrossingClock: tool({
    description: DOX_TOOL_DOCS[10].purpose,
    inputSchema: showCrossingClockInput,
  }),
  showCutoffStack: tool({
    description: DOX_TOOL_DOCS[11].purpose,
    inputSchema: showCutoffStackInput,
  }),
  showCutoffRuler: tool({
    description: DOX_TOOL_DOCS[12].purpose,
    inputSchema: showCutoffRulerInput,
  }),
  showCutoffCountdown: tool({
    description: DOX_TOOL_DOCS[13].purpose,
    inputSchema: showCutoffCountdownInput,
  }),
  showPunctualityBoard: tool({
    description: DOX_TOOL_DOCS[14].purpose,
    inputSchema: showPunctualityBoardInput,
  }),
  showEtaDrift: tool({
    description: DOX_TOOL_DOCS[15].purpose,
    inputSchema: showEtaDriftInput,
  }),
  showDepartureBoard: tool({
    description: DOX_TOOL_DOCS[16].purpose,
    inputSchema: showDepartureBoardInput,
  }),
  showZonePlanner: tool({
    description: DOX_TOOL_DOCS[17].purpose,
    inputSchema: showZonePlannerInput,
  }),
  showDtmDecoder: tool({
    description: DOX_TOOL_DOCS[18].purpose,
    inputSchema: showDtmDecoderInput,
  }),
  showX12TimeReader: tool({
    description: DOX_TOOL_DOCS[19].purpose,
    inputSchema: showX12TimeReaderInput,
  }),
  showDemurrageClock: tool({
    description: DOX_TOOL_DOCS[20].purpose,
    inputSchema: showDemurrageClockInput,
  }),
  showBlDateStamp: tool({
    description: DOX_TOOL_DOCS[21].purpose,
    inputSchema: showBlDateStampInput,
  }),
  showEpcisEventReader: tool({
    description: DOX_TOOL_DOCS[22].purpose,
    inputSchema: showEpcisEventReaderInput,
  }),
  showJourneySplit: tool({
    description: DOX_TOOL_DOCS[23].purpose,
    inputSchema: showJourneySplitInput,
  }),
  showGnssWeekDecoder: tool({
    description: DOX_TOOL_DOCS[24].purpose,
    inputSchema: showGnssWeekDecoderInput,
  }),
  showSatelliteClockConverter: tool({
    description: DOX_TOOL_DOCS[25].purpose,
    inputSchema: showSatelliteClockConverterInput,
  }),
  showGnssRolloverChecker: tool({
    description: DOX_TOOL_DOCS[26].purpose,
    inputSchema: showGnssRolloverCheckerInput,
  }),
  showLeapSecondTimeline: tool({
    description: DOX_TOOL_DOCS[27].purpose,
    inputSchema: showLeapSecondTimelineInput,
  }),
  showElapsedVsClock: tool({
    description: DOX_TOOL_DOCS[28].purpose,
    inputSchema: showElapsedVsClockInput,
  }),
  showStoredTimeAudit: tool({
    description: DOX_TOOL_DOCS[29].purpose,
    inputSchema: showStoredTimeAuditInput,
  }),
  showHolidayRuleBuilder: tool({
    description: DOX_TOOL_DOCS[30].purpose,
    inputSchema: showHolidayRuleBuilderInput,
  }),
  showObservanceComparator: tool({
    description: DOX_TOOL_DOCS[31].purpose,
    inputSchema: showObservanceComparatorInput,
  }),
  showMovingFeasts: tool({
    description: DOX_TOOL_DOCS[32].purpose,
    inputSchema: showMovingFeastsInput,
  }),
  showCanadaClockChange: tool({
    description: DOX_TOOL_DOCS[33].purpose,
    inputSchema: showCanadaClockChangeInput,
  }),
  showDurationParserBench: tool({
    description: DOX_TOOL_DOCS[34].purpose,
    inputSchema: showDurationParserBenchInput,
  }),
} as const;

export const DOX_TOOL_NAMES = Object.keys(DOX_TOOLS) as DoxToolName[];

/**
 * The tools the model is actually offered — which is to say, the ones the
 * client can actually mount.
 *
 * **This is the parity contract, and it exists because the alternative is Dox
 * lying to the reader.** A tool defined above but absent from the widget
 * registry is one the model will happily call and the panel cannot show: the
 * answer promises a DST inspector and the transcript says the widget is not in
 * this build. Offering only what can be mounted makes that unreachable.
 *
 * Every schema above stays defined regardless, so a tool can be added here in
 * one line as its widget lands. `widget-registry.test.ts` asserts this list and
 * the registry's keys are the same set, so the two cannot drift — adding a tool
 * here without registering its widget fails the suite rather than reaching a
 * reader.
 *
 * Every tool is enabled, every one backed by a registered widget.
 */
export const ENABLED_TOOL_NAMES = [
  "showGlobe",
  "showConverterBench",
  "showIntervalVisualizer",
  "showDstInspector",
  "showDwellLedger",
  "showFreeTimeLedger",
  "showBillingDeadlines",
  "showDeliveryScheduler",
  "showConnectionChecker",
  "showTimetableReader",
  "showCrossingClock",
  "showCutoffStack",
  "showCutoffRuler",
  "showCutoffCountdown",
  "showPunctualityBoard",
  "showEtaDrift",
  "showDepartureBoard",
  "showZonePlanner",
  "showDtmDecoder",
  "showX12TimeReader",
  "showDemurrageClock",
  "showBlDateStamp",
  "showEpcisEventReader",
  "showJourneySplit",
  "showGnssWeekDecoder",
  "showSatelliteClockConverter",
  "showGnssRolloverChecker",
  "showLeapSecondTimeline",
  "showElapsedVsClock",
  "showStoredTimeAudit",
  "showHolidayRuleBuilder",
  "showObservanceComparator",
  "showMovingFeasts",
  "showCanadaClockChange",
  "showDurationParserBench",
] as const satisfies readonly DoxToolName[];

export type EnabledToolName = (typeof ENABLED_TOOL_NAMES)[number];

/** Prompt copy for the offered tools only. */
export const ENABLED_TOOL_DOCS = DOX_TOOL_DOCS.filter((doc) =>
  (ENABLED_TOOL_NAMES as readonly DoxToolName[]).includes(doc.name),
);
