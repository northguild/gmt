/**
 * @vitest-environment jsdom
 *
 * A widget whose library cannot load must say so. Every mount used to catch
 * that failure and return an inert handle, leaving controls that looked live
 * and did nothing; nothing tested the path, so nothing noticed. Here each
 * library-backed mount meets a `GMT_MODULES` whose every import rejects.
 */
import { canadaTense, moroccoTense } from "./clock-change-tense.fixture";
import { installJsdomShims } from "~/test/jsdom-shims";
import { within } from "@testing-library/dom";
import { setHtml, type SafeHtml } from "~/widgets/builders";
import { GMT_MODULES } from "./gmt-modules";
import {
  mountBillingDeadlines,
  renderBillingDeadlinesTemplate,
} from "./billing-deadlines-mount";
import {
  mountConnectionChecker,
  renderConnectionCheckerTemplate,
} from "./connection-checker-mount";
import {
  mountConverterBench,
  renderConverterTemplate,
} from "./converter-bench-mount";
import {
  mountDeliveryScheduler,
  renderDeliverySchedulerTemplate,
} from "./delivery-scheduler-mount";
import { mountDstInspector, renderDstTemplate } from "./dst-inspector-mount";
import {
  mountTimetableReader,
  renderTimetableReaderTemplate,
} from "./timetable-reader-mount";
import {
  mountCrossingClock,
  renderCrossingClockTemplate,
} from "./crossing-clock-mount";
import {
  mountCutoffStack,
  renderCutoffStackTemplate,
} from "./cutoff-stack-mount";
import {
  mountCutoffRuler,
  renderCutoffRulerTemplate,
} from "./cutoff-ruler-mount";
import {
  mountCutoffCountdown,
  renderCutoffCountdownTemplate,
} from "./cutoff-countdown-mount";
import {
  mountPunctualityBoard,
  renderPunctualityBoardTemplate,
} from "./punctuality-board-mount";
import { mountEtaDrift, renderEtaDriftTemplate } from "./eta-drift-mount";
import {
  mountDepartureBoard,
  renderDepartureBoardTemplate,
} from "./departure-board-mount";
import { mountDtmDecoder, renderDtmDecoderTemplate } from "./dtm-decoder-mount";
import {
  mountBlDateStamp,
  renderBlDateStampTemplate,
} from "./bl-date-stamp-mount";
import {
  mountDemurrageClock,
  renderDemurrageClockTemplate,
} from "./demurrage-clock-mount";
import {
  mountEpcisEventReader,
  renderEpcisEventReaderTemplate,
} from "./epcis-event-reader-mount";
import {
  mountJourneySplit,
  renderJourneySplitTemplate,
} from "./journey-split-mount";
import {
  mountX12TimeReader,
  renderX12TimeReaderTemplate,
} from "./x12-time-reader-mount";
import {
  mountDwellLedger,
  renderDwellLedgerTemplate,
} from "./dwell-ledger-mount";
import {
  mountFreeTimeLedger,
  renderFreeTimeLedgerTemplate,
} from "./free-time-ledger-mount";
import {
  mountIntervalVisualizer,
  renderIntervalTemplate,
} from "./interval-visualizer-mount";
import { showUnavailable, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  mountGnssWeekDecoder,
  renderGnssWeekDecoderTemplate,
} from "./gnss-week-decoder-mount";
import {
  mountSatelliteClockConverter,
  renderSatelliteClockConverterTemplate,
} from "./satellite-clock-converter-mount";
import {
  mountGnssRolloverChecker,
  renderGnssRolloverCheckerTemplate,
} from "./gnss-rollover-checker-mount";
import {
  mountLeapSecondTimeline,
  renderLeapSecondTimelineTemplate,
} from "./leap-second-timeline-mount";
import {
  mountElapsedVsClock,
  renderElapsedVsClockTemplate,
} from "./elapsed-vs-clock-mount";
import {
  mountStoredTimeAudit,
  renderStoredTimeAuditTemplate,
} from "./stored-time-audit-mount";
import {
  mountHolidayRuleBuilder,
  renderHolidayRuleBuilderTemplate,
} from "./holiday-rule-builder-mount";
import {
  mountObservanceComparator,
  renderObservanceComparatorTemplate,
} from "./observance-comparator-mount";
import {
  mountMovingFeasts,
  renderMovingFeastsTemplate,
} from "./moving-feasts-mount";
import {
  mountCanadaClockChangeWidget,
  renderCanadaClockChangeWidgetTemplate,
} from "./canada-clock-change-mount";
import {
  mountMoroccoClockChangeWidget,
  renderMoroccoClockChangeWidgetTemplate,
} from "./morocco-clock-change-mount";
import {
  mountDurationParserBench,
  renderDurationParserBenchTemplate,
} from "./duration-parser-bench-mount";
import {
  mountIdTimestampDecoder,
  renderIdTimestampDecoderTemplate,
} from "./id-timestamp-decoder-mount";
import {
  mountCronInAZone,
  renderCronInAZoneTemplate,
} from "./cron-in-a-zone-mount";
import {
  mountLeapDayBirthday,
  renderLeapDayBirthdayTemplate,
} from "./leap-day-birthday-mount";
import {
  mountColumnTimestampBridge,
  renderColumnTimestampBridgeTemplate,
} from "./column-timestamp-bridge-mount";

installJsdomShims();

const MOUNTS: [string, () => SafeHtml, MountFn<never>][] = [
  [
    "dwell ledger",
    () => renderDwellLedgerTemplate("load-error"),
    mountDwellLedger as MountFn<never>,
  ],
  [
    "free time ledger",
    () => renderFreeTimeLedgerTemplate("load-error"),
    mountFreeTimeLedger as MountFn<never>,
  ],
  [
    "billing deadlines",
    () => renderBillingDeadlinesTemplate("test"),
    mountBillingDeadlines as MountFn<never>,
  ],
  [
    "DST inspector",
    () => renderDstTemplate("load-error"),
    mountDstInspector as MountFn<never>,
  ],
  [
    "interval visualizer",
    () => renderIntervalTemplate("load-error"),
    mountIntervalVisualizer as MountFn<never>,
  ],
  [
    "converter bench",
    () => renderConverterTemplate("converter-bench"),
    mountConverterBench as MountFn<never>,
  ],
  [
    "delivery scheduler",
    () => renderDeliverySchedulerTemplate("load-error"),
    mountDeliveryScheduler as MountFn<never>,
  ],
  [
    "connection checker",
    () => renderConnectionCheckerTemplate("test"),
    mountConnectionChecker as MountFn<never>,
  ],
  [
    "timetable reader",
    () => renderTimetableReaderTemplate("test"),
    mountTimetableReader as MountFn<never>,
  ],
  [
    "crossing clock",
    () => renderCrossingClockTemplate("load-error"),
    mountCrossingClock as MountFn<never>,
  ],
  [
    "cutoff stack",
    () => renderCutoffStackTemplate("load-error"),
    mountCutoffStack as MountFn<never>,
  ],
  [
    "cutoff ruler",
    () => renderCutoffRulerTemplate("test"),
    mountCutoffRuler as MountFn<never>,
  ],
  [
    "cutoff countdown",
    () => renderCutoffCountdownTemplate("test"),
    mountCutoffCountdown as MountFn<never>,
  ],
  [
    "punctuality board",
    () => renderPunctualityBoardTemplate("load-error"),
    mountPunctualityBoard as MountFn<never>,
  ],
  [
    "eta drift chart",
    () => renderEtaDriftTemplate("test"),
    mountEtaDrift as MountFn<never>,
  ],
  [
    "departure board",
    () => renderDepartureBoardTemplate("load-error"),
    mountDepartureBoard as MountFn<never>,
  ],
  [
    "dtm decoder",
    () => renderDtmDecoderTemplate("dtm-decoder"),
    mountDtmDecoder as MountFn<never>,
  ],
  [
    "x12 time reader",
    () => renderX12TimeReaderTemplate("x12-time-reader"),
    mountX12TimeReader as MountFn<never>,
  ],
  [
    "demurrage clock",
    () => renderDemurrageClockTemplate("load-error"),
    mountDemurrageClock as MountFn<never>,
  ],
  [
    "b/l date stamp",
    () => renderBlDateStampTemplate("test"),
    mountBlDateStamp as MountFn<never>,
  ],
  [
    "epcis event reader",
    () => renderEpcisEventReaderTemplate("test"),
    mountEpcisEventReader as MountFn<never>,
  ],
  [
    "journey split",
    () => renderJourneySplitTemplate("test"),
    mountJourneySplit as MountFn<never>,
  ],
  [
    "gnss week decoder",
    () => renderGnssWeekDecoderTemplate("test"),
    mountGnssWeekDecoder as MountFn<never>,
  ],
  [
    "satellite clock converter",
    () => renderSatelliteClockConverterTemplate("test"),
    mountSatelliteClockConverter as MountFn<never>,
  ],
  [
    "gnss rollover checker",
    () => renderGnssRolloverCheckerTemplate("test"),
    mountGnssRolloverChecker as MountFn<never>,
  ],
  [
    "leap second timeline",
    () => renderLeapSecondTimelineTemplate("leap-second-timeline"),
    mountLeapSecondTimeline as MountFn<never>,
  ],
  [
    "elapsed vs. clock difference",
    () => renderElapsedVsClockTemplate("test"),
    mountElapsedVsClock as MountFn<never>,
  ],
  [
    "stored time audit",
    () => renderStoredTimeAuditTemplate("test"),
    mountStoredTimeAudit as MountFn<never>,
  ],
  [
    "holiday rule builder",
    () => renderHolidayRuleBuilderTemplate("test"),
    mountHolidayRuleBuilder as MountFn<never>,
  ],
  [
    "observance comparator",
    () => renderObservanceComparatorTemplate("test"),
    mountObservanceComparator as MountFn<never>,
  ],
  [
    "moving feasts",
    () => renderMovingFeastsTemplate("test"),
    mountMovingFeasts as MountFn<never>,
  ],
  [
    "canada clock-change checker",
    () => renderCanadaClockChangeWidgetTemplate("canada", canadaTense),
    mountCanadaClockChangeWidget as MountFn<never>,
  ],
  [
    "morocco clock-change checker",
    () => renderMoroccoClockChangeWidgetTemplate("morocco", moroccoTense),
    mountMoroccoClockChangeWidget as MountFn<never>,
  ],
  [
    "duration parser bench",
    () => renderDurationParserBenchTemplate("load-error"),
    mountDurationParserBench as MountFn<never>,
  ],
  [
    "id timestamp decoder",
    () => renderIdTimestampDecoderTemplate("id-timestamp-decoder"),
    mountIdTimestampDecoder as MountFn<never>,
  ],
  [
    "column timestamp bridge",
    () => renderColumnTimestampBridgeTemplate("column-timestamp-bridge"),
    mountColumnTimestampBridge as MountFn<never>,
  ],
  [
    "cron in a zone",
    () => renderCronInAZoneTemplate("cron-in-a-zone"),
    mountCronInAZone as MountFn<never>,
  ],
  [
    "leap-day birthday",
    () => renderLeapDayBirthdayTemplate("test"),
    mountLeapDayBirthday as MountFn<never>,
  ],
];

describe("a widget whose library fails to load", () => {
  const originals = { ...GMT_MODULES };
  const offline = new Error("Failed to fetch dynamically imported module");

  beforeEach(() => {
    for (const key of Object.keys(GMT_MODULES)) {
      GMT_MODULES[key] = () => Promise.reject(offline);
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.assign(GMT_MODULES, originals);
    vi.restoreAllMocks();
  });

  it.each(MOUNTS)(
    "%s throws WidgetLoadError carrying the cause",
    async (_name, template, mount) => {
      const root = document.createElement("div");
      setHtml(root, template());
      document.body.append(root);

      const failure = await mount(
        root,
        {} as never,
        new AbortController().signal,
      ).then(
        () => null,
        (error: unknown) => error,
      );
      root.remove();
      expect(failure).toBeInstanceOf(WidgetLoadError);
      expect((failure as Error).cause).toBe(offline);
    },
  );
});

describe("showUnavailable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds one notice with a reload link, keeps the content, and logs the cause", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const root = document.createElement("div");
    const kept = document.createElement("button");
    kept.textContent = "controls";
    root.append(kept);
    document.body.append(root);

    const cause = new Error("offline");
    showUnavailable(root, cause);
    showUnavailable(root, cause);

    const view = within(root);
    const notices = view.getAllByRole("status");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toHaveTextContent("couldn\u2019t load");
    // An empty href is the page reloading itself; aria-query does not count it as a link.
    expect(within(notices[0]).getByText("Reload the page")).toHaveAttribute(
      "href",
      "",
    );
    // The server-rendered content is kept, not replaced.
    expect(view.getByRole("button", { name: "controls" })).toBeInTheDocument();
    expect(logged).toHaveBeenCalledWith("widget failed to load", cause);
    root.remove();
  });
});
