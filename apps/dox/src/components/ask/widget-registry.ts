/**
 * DOX-C3b (#139) — the fixed, typed map from a tool name to a mountable widget.
 *
 * ## No dynamic code, anywhere on this path
 *
 * The DoD line is "no `eval` or dynamic code execution exists anywhere in the
 * registry or its dispatch path — verified by reading the implementation".
 * Concretely, in this file:
 *
 *   - `WIDGET_REGISTRY` is an object literal with literal keys. Lookup is a
 *     guarded property read (`Object.hasOwn`), never a constructed key.
 *   - Each `load` is a literal `import("…")` with a static specifier — which is
 *     also what keeps d3-geo, world-atlas and the Temporal polyfill out of the
 *     chat chunk until a widget is actually mounted.
 *   - Nothing here reaches `playground-client.ts`, the one module in `src/` that
 *     contains a `new Function` (its `evaluateArg`, reachable only from
 *     `PlaygroundForm.astro`). Keep it that way.
 *
 * The spec also sketched a generic `showPlayground({ fn, args })`. It is
 * deliberately **not** here: it is the only entry with any reason to approach
 * `evaluateArg`, and it would turn the line above from a fact into an argument —
 * for the least reader value of the five, since a citation already links to the
 * playground page itself.
 *
 * ## Three layers of validation, because a schema is not enough
 *
 *   1. **Shape** — the widget's own zod schema, re-run here even though the
 *      Worker ran it. The client is what renders; it validates what it renders.
 *   2. **Semantics** — `validate()`. `"Mars/Olympus_Mons"` clears the zone regex
 *      by design (see `dox-tools.ts`) and fails here, against
 *      `@northguild/gmt`'s own `isValidTimeZone`. There is a pleasing symmetry
 *      in the docs site refusing a hallucinated zone by calling the library it
 *      documents.
 *   3. **Runtime** — `MountedWidget` wraps the mount in try/catch.
 *
 * Template and mount arrive together, from the one `import()`. The template
 * functions live in the same modules as their mounts, and those modules import
 * the Temporal polyfill and each widget's logic at the top — importing a
 * template statically put every mount and the polyfill in the chat's first
 * download, and made every `import()` here load nothing new. The rail shows a
 * loading state for the moment the chunk takes instead.
 */
/* Type-only: erased at build time, so none of these modules — nor the Temporal
   polyfill and gmt modules behind them — enter the chat chunk. The one runtime
   path to a mount module is each entry's `load()`. `widget-graph.test.ts`
   fails if a value import creeps back in. */
import type { ConverterArgs } from "~/lib/converter-bench-mount";
import type { GlobeArgs } from "~/lib/globe-mount";
import type { BillingDeadlinesArgs } from "~/lib/billing-deadlines-mount";
import type { BlDateStampArgs } from "~/lib/bl-date-stamp-mount";
import type { ConnectionCheckerArgs } from "~/lib/connection-checker-mount";
import type { DeliverySchedulerArgs } from "~/lib/delivery-scheduler-mount";
import type { DemurrageClockArgs } from "~/lib/demurrage-clock-mount";
import type { DstArgs } from "~/lib/dst-inspector-mount";
import type { DwellLedgerArgs } from "~/lib/dwell-ledger-mount";
import type { EpcisEventReaderArgs } from "~/lib/epcis-event-reader-mount";
import type { FreeTimeLedgerArgs } from "~/lib/free-time-ledger-mount";
import type { IntervalArgs } from "~/lib/interval-visualizer-mount";
import type { JourneySplitArgs } from "~/lib/journey-split-mount";
import type { CrossingClockArgs } from "~/lib/crossing-clock-mount";
import type { TimetableReaderArgs } from "~/lib/timetable-reader-mount";
import type { CutoffStackArgs } from "~/lib/cutoff-stack-mount";
import type { CutoffRulerArgs } from "~/lib/cutoff-ruler-mount";
import type { CutoffCountdownArgs } from "~/lib/cutoff-countdown-mount";
import type { PunctualityBoardArgs } from "~/lib/punctuality-board-mount";
import type { EtaDriftArgs } from "~/lib/eta-drift-mount";
import type { DepartureBoardArgs } from "~/lib/departure-board-mount";
import type { DtmDecoderArgs } from "~/lib/dtm-decoder-mount";
import type { X12TimeReaderArgs } from "~/lib/x12-time-reader-mount";
import type { ZonePlannerArgs } from "~/lib/zone-planner-mount";
import type { GnssWeekDecoderArgs } from "~/lib/gnss-week-decoder-mount";
import type { SatelliteClockConverterArgs } from "~/lib/satellite-clock-converter-mount";
import type { GnssRolloverCheckerArgs } from "~/lib/gnss-rollover-checker-mount";
import type { LeapSecondTimelineArgs } from "~/lib/leap-second-timeline-mount";
import type { ElapsedVsClockArgs } from "~/lib/elapsed-vs-clock-mount";
import type { IdTimestampDecoderArgs } from "~/lib/id-timestamp-decoder-mount";
import type { ColumnTimestampBridgeArgs } from "~/lib/column-timestamp-bridge-mount";
import type { StoredTimeAuditArgs } from "~/lib/stored-time-audit-mount";
import type { HolidayRuleBuilderArgs } from "~/lib/holiday-rule-builder-mount";
import type { ObservanceComparatorArgs } from "~/lib/observance-comparator-mount";
import type { MovingFeastsArgs } from "~/lib/moving-feasts-mount";
import type { CanadaClockChangeArgs } from "~/lib/canada-clock-change-mount";
import type { DurationParserBenchArgs } from "~/lib/duration-parser-bench-mount";
import {
  showBillingDeadlinesInput,
  showBlDateStampInput,
  showCanadaClockChangeInput,
  showConnectionCheckerInput,
  showConverterBenchInput,
  showCrossingClockInput,
  showCutoffCountdownInput,
  showCutoffRulerInput,
  showCutoffStackInput,
  showDeliverySchedulerInput,
  showDemurrageClockInput,
  showDepartureBoardInput,
  showDstInspectorInput,
  showDtmDecoderInput,
  showEpcisEventReaderInput,
  showElapsedVsClockInput,
  showGnssRolloverCheckerInput,
  showGnssWeekDecoderInput,
  showLeapSecondTimelineInput,
  showSatelliteClockConverterInput,
  showStoredTimeAuditInput,
  showHolidayRuleBuilderInput,
  showObservanceComparatorInput,
  showMovingFeastsInput,
  showDurationParserBenchInput,
  showIdTimestampDecoderInput,
  showColumnTimestampBridgeInput,
  showDwellLedgerInput,
  showEtaDriftInput,
  showFreeTimeLedgerInput,
  showGlobeInput,
  showIntervalVisualizerInput,
  showJourneySplitInput,
  showPunctualityBoardInput,
  showTimetableReaderInput,
  showX12TimeReaderInput,
  showZonePlannerInput,
} from "~/lib/dox-tools";
import type { MountFn } from "~/lib/widget-mount";
import type { WidgetKind } from "~/lib/widget-permalink";

/**
 * A registry entry with its argument type erased.
 *
 * The registry is heterogeneous — each widget has its own `Args` — so it cannot
 * be a `Record` of a single generic type without either lying (`never`, which
 * does not typecheck) or spreading `any` through every consumer. Instead the
 * erasure happens exactly once, in `defineWidget`, and is sound by construction:
 * an entry's `parse`, `mount` and `validate` are checked against the *same*
 * `Args` inside that call, and nothing else ever constructs the args they
 * receive.
 */
export interface AnyWidgetEntry {
  title: string;
  kind: WidgetKind;
  parse: (
    input: unknown,
  ) => { ok: true; args: unknown } | { ok: false; reason: string };
  load: () => Promise<LoadedWidget<never>>;
  validate?: (args: unknown) => Promise<string | null>;
}

/** What one `load()` brings back: the markup and the code that wires it. */
export interface LoadedWidget<Args> {
  /**
   * Markup for the mount to wire. Pure — no DOM access.
   *
   * Takes the args so a seeded widget paints seeded on its first frame rather
   * than rendering defaults and correcting itself a moment later. `idPrefix`
   * namespaces any `id` the markup needs, so a widget in the rail cannot
   * collide with the same widget on the page behind it.
   */
  renderTemplate: (idPrefix: string, args: Args) => string;
  mount: MountFn<Args>;
}

export interface WidgetEntry<Args> {
  /** Shown on the Artifact frame. */
  title: string;
  kind: WidgetKind;
  /** Parses unknown input into `Args`, or reports why it cannot. */
  parse: (
    input: unknown,
  ) => { ok: true; args: Args } | { ok: false; reason: string };
  /** Lazy, with a literal specifier. The only runtime path to the widget. */
  load: () => Promise<LoadedWidget<Args>>;
  /** Semantic check the schema cannot make. `null` means fine. */
  validate?: (args: Args) => Promise<string | null>;
}

/**
 * The one place the argument type is erased. Everything above the line is
 * type-checked against a concrete `Args`; everything below treats args as
 * opaque and only ever hands them back to the same entry.
 */
function defineWidget<Args>(entry: WidgetEntry<Args>): AnyWidgetEntry {
  return entry as unknown as AnyWidgetEntry;
}

async function checkZones(zones: readonly string[]): Promise<string | null> {
  const { isValidTimeZone } = await import("@northguild/gmt/zoned/validate");
  const unknown = zones.filter((zone) => !isValidTimeZone(zone));
  if (unknown.length === 0) return null;
  return unknown.length === 1
    ? `${unknown[0]} isn't a time zone this browser knows about.`
    : `These aren't time zones this browser knows about: ${unknown.join(", ")}.`;
}

const globeEntry = defineWidget<GlobeArgs>({
  title: "Zoned Earth",
  kind: "globe",
  parse: (input) => {
    const result = showGlobeInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  // The globe seeds after mount instead: `focusZone` animates there, which
  // reads better than snapping to the zone on the first frame.
  load: () =>
    import("~/lib/globe-mount").then((m) => ({
      renderTemplate: (idPrefix) => m.renderGlobeTemplate({ idPrefix }),
      mount: m.mountGlobe,
    })),
  validate: ({ zone }) => (zone ? checkZones([zone]) : Promise.resolve(null)),
});

/**
 * A literal object with literal keys. Do not make this dynamic.
 *
 * The four Tier 2 widgets, the Dwell Ledger (TRAN-8), the Free Time Ledger
 * (INT-12) and the Billing Deadlines widget (INT-58) are registered.
 * `ENABLED_TOOL_NAMES` remains the declaration of what the model is offered,
 * and a test asserts the two sets are equal — so a tool cannot be offered
 * without a widget to mount. Until then those tool names are known to `dox-tools.ts` but
 * unregistered here — and `ENABLED_TOOL_NAMES` keeps them from being offered to
 * the model at all, so Dox can never promise a widget this build cannot show.
 */
const converterEntry = defineWidget<ConverterArgs>({
  title: "Converter + format bench",
  kind: "converter",
  parse: (input) => {
    const result = showConverterBenchInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  load: () =>
    import("~/lib/converter-bench-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderConverterTemplate(args),
      mount: m.mountConverterBench,
    })),
  /* `ConverterArgs` are all optional — the template falls back to its own
     defaults — so only the zones actually supplied are checked. */
  validate: ({ from, to }) =>
    checkZones([from, to].filter((zone): zone is string => !!zone)),
});

const intervalEntry = defineWidget<IntervalArgs>({
  title: "Interval algebra visualizer",
  kind: "interval",
  parse: (input) => {
    const result = showIntervalVisualizerInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  // Seeds after mount rather than in the template: `applyPreset()` runs at the
  // end of setup and would overwrite anything painted here.
  load: () =>
    import("~/lib/interval-visualizer-mount").then((m) => ({
      renderTemplate: () => m.renderIntervalTemplate(),
      mount: m.mountIntervalVisualizer,
    })),
  /* No zones to check. The widget pre-validates each interval with the
     library's own `isValidZonedRange` and renders the invalid case visibly
     differently from the empty one — see the component docstring — so a
     nonsense date reaches an explanatory state rather than an error box. */
});

const dstEntry = defineWidget<DstArgs>({
  title: "DST transition inspector",
  kind: "dst",
  parse: (input) => {
    const result = showDstInspectorInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template rather than after mount: every argument here is a
     control value, and `setupWidget` reads those controls on its first render.
     Writing them afterwards would be a second source of truth for one state. */
  load: () =>
    import("~/lib/dst-inspector-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderDstTemplate(args),
      mount: m.mountDstInspector,
    })),
  validate: ({ zone }) => (zone ? checkZones([zone]) : Promise.resolve(null)),
});

const dwellEntry = defineWidget<DwellLedgerArgs>({
  title: "Dwell ledger",
  kind: "dwell",
  parse: (input) => {
    const result = showDwellLedgerInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template, like the DST inspector: every argument is a control
     value. The mount then reads a zoneless wall time in `zone`. */
  load: () =>
    import("~/lib/dwell-ledger-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderDwellLedgerTemplate(args),
      mount: m.mountDwellLedger,
    })),
  validate: ({ zone, compareZone }) =>
    checkZones([zone, compareZone].filter((z): z is string => !!z)),
});

const freeTimeEntry = defineWidget<FreeTimeLedgerArgs>({
  title: "Free time ledger",
  kind: "freetime",
  parse: (input) => {
    const result = showFreeTimeLedgerInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template, like the Dwell Ledger: every argument is a control
     value. The mount then reads a zoneless wall time in `zone`. */
  load: () =>
    import("~/lib/free-time-ledger-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderFreeTimeLedgerTemplate(args),
      mount: m.mountFreeTimeLedger,
    })),
  validate: ({ zone }) => (zone ? checkZones([zone]) : Promise.resolve(null)),
});

const billingEntry = defineWidget<BillingDeadlinesArgs>({
  title: "Billing deadlines",
  kind: "billing",
  parse: (input) => {
    const result = showBillingDeadlinesInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template, like the Free Time Ledger: every argument is a
     control value. No zones to check, so no `validate`. */
  load: () =>
    import("~/lib/billing-deadlines-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderBillingDeadlinesTemplate(args),
      mount: m.mountBillingDeadlines,
    })),
});

const deliveryEntry = defineWidget<DeliverySchedulerArgs>({
  title: "Delivery scheduler",
  kind: "delivery",
  parse: (input) => {
    const result = showDeliverySchedulerInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template, like the Free Time Ledger: every argument is a
     control value. The mount then reads each leg's own departure. */
  load: () =>
    import("~/lib/delivery-scheduler-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderDeliverySchedulerTemplate(args),
      mount: m.mountDeliveryScheduler,
    })),
  validate: (a) =>
    checkZones([
      ...(a.legs ?? []).map((l) => l.timeZone).filter((z): z is string => !!z),
      ...(a.startTimeZone ? [a.startTimeZone] : []),
    ]),
});

const connectionEntry = defineWidget<ConnectionCheckerArgs>({
  title: "Connection checker",
  kind: "connection",
  parse: (input) => {
    const result = showConnectionCheckerInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  load: () =>
    import("~/lib/connection-checker-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderConnectionCheckerTemplate(args),
      mount: m.mountConnectionChecker,
    })),
  validate: ({ portZone, onwardZone }) =>
    checkZones([
      ...(portZone ? [portZone] : []),
      ...(onwardZone ? [onwardZone] : []),
    ]),
});

const timetableEntry = defineWidget<TimetableReaderArgs>({
  title: "Timetable reader",
  kind: "timetable",
  parse: (input) => {
    const result = showTimetableReaderInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  load: () =>
    import("~/lib/timetable-reader-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderTimetableReaderTemplate(args),
      mount: m.mountTimetableReader,
    })),
  validate: ({ startTimeZone, timeZone }) =>
    checkZones([startTimeZone, timeZone].filter((z): z is string => !!z)),
});

const crossingEntry = defineWidget<CrossingClockArgs>({
  title: "Crossing clock",
  kind: "crossing",
  parse: (input) => {
    const result = showCrossingClockInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  load: () =>
    import("~/lib/crossing-clock-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderCrossingClockTemplate(args),
      mount: m.mountCrossingClock,
    })),
  validate: ({ targetZone }) =>
    targetZone ? checkZones([targetZone]) : Promise.resolve(null),
});

const cutoffStackEntry = defineWidget<CutoffStackArgs>({
  title: "Cut-off stack",
  kind: "cutoffstack",
  parse: (input) => {
    const result = showCutoffStackInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  load: () =>
    import("~/lib/cutoff-stack-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderCutoffStackTemplate(args),
      mount: m.mountCutoffStack,
    })),
  validate: ({ timeZone }) =>
    timeZone ? checkZones([timeZone]) : Promise.resolve(null),
});

const cutoffRulerEntry = defineWidget<CutoffRulerArgs>({
  title: "Cut-off ruler",
  kind: "cutoffruler",
  parse: (input) => {
    const result = showCutoffRulerInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  load: () =>
    import("~/lib/cutoff-ruler-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderCutoffRulerTemplate(args),
      mount: m.mountCutoffRuler,
    })),
  validate: ({ timeZone }) =>
    timeZone ? checkZones([timeZone]) : Promise.resolve(null),
});

const cutoffCountdownEntry = defineWidget<CutoffCountdownArgs>({
  title: "Cut-off countdown",
  kind: "cutoffcountdown",
  parse: (input) => {
    const result = showCutoffCountdownInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  load: () =>
    import("~/lib/cutoff-countdown-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderCutoffCountdownTemplate(args),
      mount: m.mountCutoffCountdown,
    })),
  validate: ({ timeZone }) =>
    timeZone ? checkZones([timeZone]) : Promise.resolve(null),
});

const punctualityEntry = defineWidget<PunctualityBoardArgs>({
  title: "Punctuality board",
  kind: "punctuality",
  parse: (input) => {
    const result = showPunctualityBoardInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template: every argument is a control value or a row the
     mount reads again. No zones to check, so no `validate`: the widget shows
     an invalid time as NO SIGNAL with its reason. */
  load: () =>
    import("~/lib/punctuality-board-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderPunctualityBoardTemplate(args),
      mount: m.mountPunctualityBoard,
    })),
});

const etaDriftEntry = defineWidget<EtaDriftArgs>({
  title: "ETA drift chart",
  kind: "etadrift",
  parse: (input) => {
    const result = showEtaDriftInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control
     value. No zones to check, so no `validate`: an invalid time is NO SIGNAL
     with its reason, while fewer than two estimates is a neutral "nothing to
     measure yet" note, not NO SIGNAL. */
  load: () =>
    import("~/lib/eta-drift-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderEtaDriftTemplate(args),
      mount: m.mountEtaDrift,
    })),
});

const departureEntry = defineWidget<DepartureBoardArgs>({
  title: "Departure board",
  kind: "departure",
  parse: (input) => {
    const result = showDepartureBoardInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control
     value. Only the onward destination is a zone. */
  load: () =>
    import("~/lib/departure-board-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderDepartureBoardTemplate(args),
      mount: m.mountDepartureBoard,
    })),
  validate: ({ onwardZone }) =>
    onwardZone ? checkZones([onwardZone]) : Promise.resolve(null),
});

const dtmEntry = defineWidget<DtmDecoderArgs>({
  title: "DTM decoder",
  kind: "dtm",
  parse: (input) => {
    const result = showDtmDecoderInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control
     value. Only the four zones are checked here; a code or window the library
     does not read is the widget's own NO SIGNAL, with its reason. */
  load: () =>
    import("~/lib/dtm-decoder-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderDtmDecoderTemplate(args),
      mount: m.mountDtmDecoder,
    })),
  validate: ({ zone1, zone2, zone3, zone4 }) =>
    checkZones([zone1, zone2, zone3, zone4].filter((z): z is string => !!z)),
});

const x12TimeEntry = defineWidget<X12TimeReaderArgs>({
  title: "X12 time reader",
  kind: "xtime",
  parse: (input) => {
    const result = showX12TimeReaderInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control
     value. Only the zones are checked here; a code or window the library does
     not read is the widget's own NO SIGNAL, with its reason. */
  load: () =>
    import("~/lib/x12-time-reader-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderX12TimeReaderTemplate(args),
      mount: m.mountX12TimeReader,
    })),
  validate: ({ zone, zone2, zone3, zone4 }) =>
    checkZones([zone, zone2, zone3, zone4].filter((z): z is string => !!z)),
});

const demurrageEntry = defineWidget<DemurrageClockArgs>({
  title: "Demurrage clock",
  kind: "demclock",
  parse: (input) => {
    const result = showDemurrageClockInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control
     value. Only the terminal's zone is checked here; an event the library does
     not read is the widget's own NO SIGNAL, with its reason. */
  load: () =>
    import("~/lib/demurrage-clock-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderDemurrageClockTemplate(args),
      mount: m.mountDemurrageClock,
    })),
  validate: ({ zone }) => (zone ? checkZones([zone]) : Promise.resolve(null)),
});

const blDateEntry = defineWidget<BlDateStampArgs>({
  title: "B/L date stamp",
  kind: "bldate",
  parse: (input) => {
    const result = showBlDateStampInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control
     value. There is deliberately no `validate`. The place may be a zone id or a
     UTC offset, and a place the library does not read is this widget's own
     NO SIGNAL, with its reason, so refusing it here would hide the lesson. */
  load: () =>
    import("~/lib/bl-date-stamp-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderBlDateStampTemplate(args),
      mount: m.mountBlDateStamp,
    })),
});

const epcisEntry = defineWidget<EpcisEventReaderArgs>({
  title: "EPCIS event reader",
  kind: "epcis",
  parse: (input) => {
    const result = showEpcisEventReaderInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control
     value. There is deliberately no `validate`. A time or an offset the library
     does not read is this widget's own NO SIGNAL, with its reason, so refusing
     it here would hide the lesson. */
  load: () =>
    import("~/lib/epcis-event-reader-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderEpcisEventReaderTemplate(args),
      mount: m.mountEpcisEventReader,
    })),
});

const journeyEntry = defineWidget<JourneySplitArgs>({
  title: "Journey split",
  kind: "journeysplit",
  parse: (input) => {
    const result = showJourneySplitInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control
     value, as the Delivery Scheduler's legs are. Only the zones are checked
     here; a duration or a departure the library does not read is the widget's
     own NO SIGNAL, with its reason. */
  load: () =>
    import("~/lib/journey-split-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderJourneySplitTemplate(args),
      mount: m.mountJourneySplit,
    })),
  validate: (a) =>
    checkZones([
      ...(a.legs ?? []).map((l) => l.timeZone).filter((z): z is string => !!z),
      ...(a.startTimeZone ? [a.startTimeZone] : []),
    ]),
});

const gnssWeekEntry = defineWidget<GnssWeekDecoderArgs>({
  title: "GNSS week decoder",
  kind: "gnssweek",
  parse: (input) => {
    const result = showGnssWeekDecoderInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control value. There is deliberately no `validate`: a value the library does not read is this widget's own NO SIGNAL, with its reason, so refusing it here would hide the lesson. */
  load: () =>
    import("~/lib/gnss-week-decoder-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderGnssWeekDecoderTemplate(args),
      mount: m.mountGnssWeekDecoder,
    })),
});

const satClockEntry = defineWidget<SatelliteClockConverterArgs>({
  title: "Satellite clock converter",
  kind: "satclock",
  parse: (input) => {
    const result = showSatelliteClockConverterInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control value. There is deliberately no `validate`: a value the library does not read is this widget's own NO SIGNAL, with its reason, so refusing it here would hide the lesson. */
  load: () =>
    import("~/lib/satellite-clock-converter-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderSatelliteClockConverterTemplate(args),
      mount: m.mountSatelliteClockConverter,
    })),
});

const rolloverEntry = defineWidget<GnssRolloverCheckerArgs>({
  title: "GNSS rollover checker",
  kind: "rollover",
  parse: (input) => {
    const result = showGnssRolloverCheckerInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control value. There is deliberately no `validate`: a value the library does not read is this widget's own NO SIGNAL, with its reason, so refusing it here would hide the lesson. */
  load: () =>
    import("~/lib/gnss-rollover-checker-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderGnssRolloverCheckerTemplate(args),
      mount: m.mountGnssRolloverChecker,
    })),
});

const leapLineEntry = defineWidget<LeapSecondTimelineArgs>({
  title: "Leap second timeline",
  kind: "leapline",
  parse: (input) => {
    const result = showLeapSecondTimelineInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control value. There is deliberately no `validate`: a value the library does not read is this widget's own NO SIGNAL, with its reason, so refusing it here would hide the lesson. */
  load: () =>
    import("~/lib/leap-second-timeline-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderLeapSecondTimelineTemplate(args),
      mount: m.mountLeapSecondTimeline,
    })),
});

const elapsedEntry = defineWidget<ElapsedVsClockArgs>({
  title: "Elapsed vs. clock difference",
  kind: "elapsed",
  parse: (input) => {
    const result = showElapsedVsClockInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control value. There is deliberately no `validate`: a value the library does not read is this widget's own NO SIGNAL, with its reason, so refusing it here would hide the lesson. */
  load: () =>
    import("~/lib/elapsed-vs-clock-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderElapsedVsClockTemplate(args),
      mount: m.mountElapsedVsClock,
    })),
});

const storedAuditEntry = defineWidget<StoredTimeAuditArgs>({
  title: "Stored time audit",
  kind: "storedaudit",
  parse: (input) => {
    const result = showStoredTimeAuditInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: both arguments are control values. There is deliberately no `validate`: a line the library does not read is this widget's own NO SIGNAL, with its reason, so refusing it here would hide the lesson. */
  load: () =>
    import("~/lib/stored-time-audit-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderStoredTimeAuditTemplate(args),
      mount: m.mountStoredTimeAudit,
    })),
});

const holidayBuilderEntry = defineWidget<HolidayRuleBuilderArgs>({
  title: "Holiday rule builder",
  kind: "holidays",
  parse: (input) => {
    const result = showHolidayRuleBuilderInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control value. A rule the library does not read is a row's own NO SIGNAL, with its reason, so only the zone is checked here. */
  validate: ({ zone }) => (zone ? checkZones([zone]) : Promise.resolve(null)),
  load: () =>
    import("~/lib/holiday-rule-builder-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderHolidayRuleBuilderTemplate(args),
      mount: m.mountHolidayRuleBuilder,
    })),
});

const observanceEntry = defineWidget<ObservanceComparatorArgs>({
  title: "Observance comparator",
  kind: "observance",
  parse: (input) => {
    const result = showObservanceComparatorInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control value, and a policy the library does not read is a column's own NO SIGNAL. There is deliberately no `validate`. */
  load: () =>
    import("~/lib/observance-comparator-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderObservanceComparatorTemplate(args),
      mount: m.mountObservanceComparator,
    })),
});

const movingFeastsEntry = defineWidget<MovingFeastsArgs>({
  title: "Moving feasts",
  kind: "feasts",
  parse: (input) => {
    const result = showMovingFeastsInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control value. There is deliberately no `validate`: a month with no such weekday is this widget's own NO SIGNAL, with its reason. */
  load: () =>
    import("~/lib/moving-feasts-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) => m.renderMovingFeastsTemplate(args),
      mount: m.mountMovingFeasts,
    })),
});

const canadaClockEntry = defineWidget<CanadaClockChangeArgs>({
  title: "Canada 2026 clock-change checker",
  kind: "canadaclock",
  parse: (input) => {
    const result = showCanadaClockChangeInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* The mount pins the zone once the Worker has answered, so the template paints the same
     everywhere. The credits button is in the frame's corner: the map draws third-party shapes. */
  load: () =>
    import("~/lib/canada-clock-change-mount").then((m) => ({
      renderTemplate: (idPrefix) =>
        m.renderCanadaClockChangeWidgetTemplate(idPrefix),
      mount: m.mountCanadaClockChangeWidget,
    })),
  /* A zone outside the checker's own list would open unpinned, so refuse it with the reason.
     The list is a JSON import kept out of the chat's first download. */
  validate: async ({ zone }) => {
    if (zone === undefined) return null;
    const { default: list } = await import("~/lib/canada-zones.json");
    return list.zones.includes(zone)
      ? null
      : `${zone} isn't one of the zones the checker lists.`;
  },
});

const durationBenchEntry = defineWidget<DurationParserBenchArgs>({
  title: "Duration parser bench",
  kind: "durationbench",
  parse: (input) => {
    const result = showDurationParserBenchInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: both arguments are control values. There is deliberately no `validate`: a string the grammar refuses is this widget's own NO SIGNAL, with its reason, so refusing it here would hide the lesson. */
  load: () =>
    import("~/lib/duration-parser-bench-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderDurationParserBenchTemplate(args),
      mount: m.mountDurationParserBench,
    })),
});

const idDecoderEntry = defineWidget<IdTimestampDecoderArgs>({
  title: "ID timestamp decoder",
  kind: "iddecode",
  parse: (input) => {
    const result = showIdTimestampDecoderInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control value. There is deliberately no `validate`: an identifier no decoder reads is this widget's own NO SIGNAL, with its reason, so refusing it here would hide the lesson. */
  load: () =>
    import("~/lib/id-timestamp-decoder-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderIdTimestampDecoderTemplate(args),
      mount: m.mountIdTimestampDecoder,
    })),
});

const columnBridgeEntry = defineWidget<ColumnTimestampBridgeArgs>({
  title: "Column timestamp bridge",
  kind: "colbridge",
  parse: (input) => {
    const result = showColumnTimestampBridgeInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded in the template and again by the mount: every argument is a control value. There is deliberately no `validate`: a value no converter can store is this widget's own NO SIGNAL, with its reason, so refusing it here would hide the lesson. */
  load: () =>
    import("~/lib/column-timestamp-bridge-mount").then((m) => ({
      renderTemplate: (_idPrefix, args) =>
        m.renderColumnTimestampBridgeTemplate(args),
      mount: m.mountColumnTimestampBridge,
    })),
});

const plannerEntry = defineWidget<ZonePlannerArgs>({
  title: "Zone planner",
  kind: "planner",
  parse: (input) => {
    const result = showZonePlannerInput.safeParse(input);
    return result.success
      ? { ok: true, args: result.data }
      : {
          ok: false,
          reason: "The widget was asked for with arguments that don't fit.",
        };
  },
  /* Seeded after mount, like the globe: the planner builds its own chrome from
     the pinned zones and the time, so there is nothing to paint in the
     template. */
  load: () =>
    import("~/lib/zone-planner-mount").then((m) => ({
      renderTemplate: (idPrefix) => m.renderZonePlannerTemplate({ idPrefix }),
      mount: m.mountZonePlanner,
    })),
  /* Zones the browser knows, and ones the planner can place: it pins only zones
     with a coordinate, so a valid id without one would be dropped silently. The
     time is a UTC instant, the only form the planner reads. */
  validate: async ({ zones: pinned, time }) => {
    const zones = pinned ?? [];
    const unknown = await checkZones(zones);
    if (unknown) return unknown;
    const [{ COORDINATES_BY_ID }, { convertUtcToUnix }] = await Promise.all([
      import("~/lib/globe-zones"),
      import("@northguild/gmt/utc/convert"),
    ]);
    const unplaceable = zones.filter((zone) => !COORDINATES_BY_ID.has(zone));
    if (unplaceable.length > 0) {
      return `The planner can't place these zones: ${unplaceable.join(", ")}.`;
    }
    if (
      time !== undefined &&
      convertUtcToUnix(time, { epochUnit: "milliseconds" }) === null
    ) {
      return `${time} isn't a UTC instant ending in Z, the form the planner reads.`;
    }
    return null;
  },
});

export const WIDGET_REGISTRY: Record<string, AnyWidgetEntry | undefined> = {
  showGlobe: globeEntry,
  showConverterBench: converterEntry,
  showIntervalVisualizer: intervalEntry,
  showDstInspector: dstEntry,
  showDwellLedger: dwellEntry,
  showFreeTimeLedger: freeTimeEntry,
  showBillingDeadlines: billingEntry,
  showDeliveryScheduler: deliveryEntry,
  showConnectionChecker: connectionEntry,
  showTimetableReader: timetableEntry,
  showCrossingClock: crossingEntry,
  showCutoffStack: cutoffStackEntry,
  showCutoffRuler: cutoffRulerEntry,
  showCutoffCountdown: cutoffCountdownEntry,
  showPunctualityBoard: punctualityEntry,
  showEtaDrift: etaDriftEntry,
  showDepartureBoard: departureEntry,
  showZonePlanner: plannerEntry,
  showDtmDecoder: dtmEntry,
  showX12TimeReader: x12TimeEntry,
  showDemurrageClock: demurrageEntry,
  showBlDateStamp: blDateEntry,
  showEpcisEventReader: epcisEntry,
  showJourneySplit: journeyEntry,
  showGnssWeekDecoder: gnssWeekEntry,
  showSatelliteClockConverter: satClockEntry,
  showGnssRolloverChecker: rolloverEntry,
  showLeapSecondTimeline: leapLineEntry,
  showElapsedVsClock: elapsedEntry,
  showStoredTimeAudit: storedAuditEntry,
  showHolidayRuleBuilder: holidayBuilderEntry,
  showObservanceComparator: observanceEntry,
  showMovingFeasts: movingFeastsEntry,
  showCanadaClockChange: canadaClockEntry,
  showDurationParserBench: durationBenchEntry,
  showIdTimestampDecoder: idDecoderEntry,
  showColumnTimestampBridge: columnBridgeEntry,
};

/** Whether a streamed tool part names a widget this build actually has. */
export function isRegisteredWidget(toolName: string): boolean {
  return Object.hasOwn(WIDGET_REGISTRY, toolName);
}

/** JSON with object keys sorted, so two equal argument objects built in a
 * different key order compare equal. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

/**
 * Whether the rail already shows this widget with these arguments.
 *
 * A starter pill seeds its widget on click; when the model then calls the same
 * tool with the same arguments, remounting would throw away anything the
 * reader has done with it in the meantime.
 */
export function isSameWidget(
  current: { entry: AnyWidgetEntry; args: unknown } | null,
  entry: AnyWidgetEntry,
  args: unknown,
): boolean {
  return (
    current !== null &&
    current.entry === entry &&
    canonical(current.args) === canonical(args)
  );
}

export type ResolvedWidget =
  | { ok: true; entry: AnyWidgetEntry; args: unknown }
  | { ok: false; reason: string };

/**
 * The single dispatch point: tool name plus raw input in, a mountable entry or
 * a reason out. Never throws.
 */
export function resolveWidget(
  toolName: string,
  input: unknown,
): ResolvedWidget {
  if (!Object.hasOwn(WIDGET_REGISTRY, toolName)) {
    return {
      ok: false,
      reason: "Dox asked for a widget this build doesn't have.",
    };
  }
  const entry = WIDGET_REGISTRY[toolName];
  if (!entry) {
    return {
      ok: false,
      reason: "Dox asked for a widget this build doesn't have.",
    };
  }

  const parsed = entry.parse(input);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  return { ok: true, entry, args: parsed.args };
}
