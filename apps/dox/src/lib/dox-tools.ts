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
import { z } from "zod";

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
    "must look like an IANA zone identifier, e.g. America/New_York",
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
 * entry: a model answering "23:00 in New York" sends a wall time with no
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
  | "showX12TimeReader";

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
    args: "aStart, aEnd, bStart, bEnd — ISO date-times. Include a zone when the reader named one (2024-11-03T09:00:00-04:00[America/New_York]); a plain 2024-11-03T09:00:00 is fine when they did not, and is read as UTC.",
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
] as const satisfies readonly DoxToolName[];

export type EnabledToolName = (typeof ENABLED_TOOL_NAMES)[number];

/** Prompt copy for the offered tools only. */
export const ENABLED_TOOL_DOCS = DOX_TOOL_DOCS.filter((doc) =>
  (ENABLED_TOOL_NAMES as readonly DoxToolName[]).includes(doc.name),
);
