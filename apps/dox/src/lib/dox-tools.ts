/**
 * DOX-C3b (#139) — the tools Dox may call to answer with a live widget instead
 * of only prose.
 *
 * Shared deliberately between the Worker and the browser. The Worker passes
 * these to `streamText`; the chat rail validates a streamed tool call against
 * the *same* schemas before mounting anything. One definition, so the two can
 * never disagree about what a valid call looks like.
 *
 * The schemas, the names and the prompt copy live in `dox-tool-schemas.ts`,
 * which imports no `ai`, so the WebMCP tool modules can share them without
 * the chat's SDK. This module re-exports all of it and adds `DOX_TOOLS`.
 *
 * Client-safe: this module imports only `ai` and `zod`, both of which the chat
 * island already bundles. It must not reach `scripts/` — see
 * `client-graph.test.ts`.
 */
import { tool } from "ai";
import {
  DOX_TOOL_DOCS,
  type DoxToolName,
  showBillingDeadlinesInput,
  showBlDateStampInput,
  showCanadaClockChangeInput,
  showCcsdsTimeCodeDecoderInput,
  showCodeBDayRulerInput,
  showColumnTimestampBridgeInput,
  showConnectionCheckerInput,
  showConverterBenchInput,
  showCronInAZoneInput,
  showCrossingClockInput,
  showCutoffCountdownInput,
  showCutoffRulerInput,
  showCutoffStackInput,
  showDatabaseTimestampReaderInput,
  showDeliverySchedulerInput,
  showDemurrageClockInput,
  showDepartureBoardInput,
  showDoublePrecisionMeterInput,
  showDstInspectorInput,
  showDtmDecoderInput,
  showDurationParserBenchInput,
  showDwellLedgerInput,
  showElapsedVsClockInput,
  showEpcisEventReaderInput,
  showEtaDriftInput,
  showExpiryCalculatorInput,
  showFhirDateCheckerInput,
  showFixTimestampReaderInput,
  showFreeTimeLedgerInput,
  showGlobeInput,
  showGnssRolloverCheckerInput,
  showGnssWeekDecoderInput,
  showGtfsServiceDayClockInput,
  showGtfsTimeReaderInput,
  showGtfsTripBoardInput,
  showHl7TimestampReaderInput,
  showHolidayRuleBuilderInput,
  showIdTimestampDecoderInput,
  showIntervalVisualizerInput,
  showJourneySplitInput,
  showJulianDayCounterInput,
  showLeapDayBirthdayInput,
  showLeapSecondTimelineInput,
  showMoroccoClockChangeInput,
  showMovingFeastsInput,
  showObservanceComparatorInput,
  showPtpClockConverterInput,
  showPunctualityBoardInput,
  showReportTimeResolverInput,
  showSatelliteClockConverterInput,
  showSsimDateReaderInput,
  showStoredTimeAuditInput,
  showSwiftValueDateReaderInput,
  showTai64nLogReaderInput,
  showTerrestrialTimeStackInput,
  showTimetableReaderInput,
  showUsSunshineProtectionActInput,
  showX12TimeReaderInput,
  showZonePlannerInput,
} from "./dox-tool-schemas";

export * from "./dox-tool-schemas";

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
  showIdTimestampDecoder: tool({
    description: DOX_TOOL_DOCS[35].purpose,
    inputSchema: showIdTimestampDecoderInput,
  }),
  showColumnTimestampBridge: tool({
    description: DOX_TOOL_DOCS[36].purpose,
    inputSchema: showColumnTimestampBridgeInput,
  }),
  showMoroccoClockChange: tool({
    description: DOX_TOOL_DOCS[37].purpose,
    inputSchema: showMoroccoClockChangeInput,
  }),
  showCronInAZone: tool({
    description: DOX_TOOL_DOCS[38].purpose,
    inputSchema: showCronInAZoneInput,
  }),
  showLeapDayBirthday: tool({
    description: DOX_TOOL_DOCS[39].purpose,
    inputSchema: showLeapDayBirthdayInput,
  }),
  showExpiryCalculator: tool({
    description: DOX_TOOL_DOCS[40].purpose,
    inputSchema: showExpiryCalculatorInput,
  }),
  showDatabaseTimestampReader: tool({
    description: DOX_TOOL_DOCS[41].purpose,
    inputSchema: showDatabaseTimestampReaderInput,
  }),
  showTai64nLogReader: tool({
    description: DOX_TOOL_DOCS[42].purpose,
    inputSchema: showTai64nLogReaderInput,
  }),
  showTerrestrialTimeStack: tool({
    description: DOX_TOOL_DOCS[43].purpose,
    inputSchema: showTerrestrialTimeStackInput,
  }),
  showFixTimestampReader: tool({
    description: DOX_TOOL_DOCS[44].purpose,
    inputSchema: showFixTimestampReaderInput,
  }),
  showHl7TimestampReader: tool({
    description: DOX_TOOL_DOCS[45].purpose,
    inputSchema: showHl7TimestampReaderInput,
  }),
  showSsimDateReader: tool({
    description: DOX_TOOL_DOCS[46].purpose,
    inputSchema: showSsimDateReaderInput,
  }),
  showReportTimeResolver: tool({
    description: DOX_TOOL_DOCS[47].purpose,
    inputSchema: showReportTimeResolverInput,
  }),
  showJulianDayCounter: tool({
    description: DOX_TOOL_DOCS[48].purpose,
    inputSchema: showJulianDayCounterInput,
  }),
  showDoublePrecisionMeter: tool({
    description: DOX_TOOL_DOCS[49].purpose,
    inputSchema: showDoublePrecisionMeterInput,
  }),
  showCcsdsTimeCodeDecoder: tool({
    description: DOX_TOOL_DOCS[50].purpose,
    inputSchema: showCcsdsTimeCodeDecoderInput,
  }),
  showCodeBDayRuler: tool({
    description: DOX_TOOL_DOCS[51].purpose,
    inputSchema: showCodeBDayRulerInput,
  }),
  showFhirDateChecker: tool({
    description: DOX_TOOL_DOCS[52].purpose,
    inputSchema: showFhirDateCheckerInput,
  }),
  showSwiftValueDateReader: tool({
    description: DOX_TOOL_DOCS[53].purpose,
    inputSchema: showSwiftValueDateReaderInput,
  }),
  showGtfsTimeReader: tool({
    description: DOX_TOOL_DOCS[54].purpose,
    inputSchema: showGtfsTimeReaderInput,
  }),
  showUsSunshineProtectionAct: tool({
    description: DOX_TOOL_DOCS[55].purpose,
    inputSchema: showUsSunshineProtectionActInput,
  }),
  showGtfsServiceDayClock: tool({
    description: DOX_TOOL_DOCS[56].purpose,
    inputSchema: showGtfsServiceDayClockInput,
  }),
  showGtfsTripBoard: tool({
    description: DOX_TOOL_DOCS[58].purpose,
    inputSchema: showGtfsTripBoardInput,
  }),
  showPtpClockConverter: tool({
    description: DOX_TOOL_DOCS[57].purpose,
    inputSchema: showPtpClockConverterInput,
  }),
} as const;

/** Every tool name, in the order `DOX_TOOLS` lists them. */
export const DOX_TOOL_NAMES = Object.keys(DOX_TOOLS) as DoxToolName[];
