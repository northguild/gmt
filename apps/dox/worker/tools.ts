/**
 * DOX-C3b (#139) — the Worker half of the widget tools.
 *
 * The schemas and names live in `src/lib/dox-tools.ts`, shared with the client.
 * This file adds the one thing the browser must never carry: an `execute`.
 *
 * ## Why these have an `execute` at all
 *
 * The instinct for generative UI is an *execute-less* tool — the model emits a
 * call, the client renders a widget from `part.input`, and nothing runs on the
 * server. That breaks, and not on the happy path: it breaks on the reader's
 * **second** question.
 *
 * Verified against `ai@7.0.95` rather than reasoned about (see
 * `tools.test.ts`, which pins it). Running an assistant turn carrying a
 * tool part back through `convertToModelMessages`:
 *
 *     execute-less (state "input-available")
 *       → user[text] | assistant[text, tool-call]
 *
 *     with execute  (state "output-available")
 *       → user[text] | assistant[text, tool-call] | tool[tool-result]
 *
 * The first is a `functionCall` with no `functionResponse` — history Gemini
 * rejects. The reader sees a widget mount perfectly, asks a follow-up, and gets
 * an opaque mid-stream failure whose cause is one turn upstream.
 *
 * So each tool gets an `execute` that does **no I/O and no model call**. It
 * validates its input and returns a small object. Because `streamText`'s default
 * `stopWhen` is `isStepCount(1)`, this costs no extra upstream request and no
 * extra quota — which matters against a shared free-tier pool.
 *
 * The widget is still rendered entirely on the client, from `part.input`. This
 * output is for the model's benefit, not the reader's: it tells the next turn
 * that a globe for Tokyo has already been shown, and it gives a hallucinated
 * zone somewhere to be reported that is better than a red box in the rail.
 *
 * **The client never trusts this.** `widget-registry.ts` re-validates every
 * input before mounting. This is advice to the model; that is the boundary.
 */
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import {
  DOX_TOOL_DOCS,
  ENABLED_TOOL_NAMES,
  showBillingDeadlinesInput,
  showConnectionCheckerInput,
  showConverterBenchInput,
  showCrossingClockInput,
  showCutoffCountdownInput,
  showCutoffRulerInput,
  showCutoffStackInput,
  showDeliverySchedulerInput,
  showDepartureBoardInput,
  showDstInspectorInput,
  showDwellLedgerInput,
  showEtaDriftInput,
  showFreeTimeLedgerInput,
  showGlobeInput,
  showIntervalVisualizerInput,
  showPunctualityBoardInput,
  showTimetableReaderInput,
} from "../src/lib/dox-tools";

const docFor = (name: string) =>
  DOX_TOOL_DOCS.find((d) => d.name === name)?.purpose ?? name;

/** The zones in a call that this runtime cannot resolve. Empty is the good case. */
function unknownZones(zones: readonly string[]): string[] {
  return zones.filter((zone) => !isValidTimeZone(zone));
}

function accept(widget: string) {
  return { ok: true as const, widget };
}

function reject(widget: string, note: string) {
  return { ok: false as const, widget, note };
}

/**
 * Tools with a server-side `execute` attached, for `streamText`.
 *
 * A function rather than a constant so the Worker builds them per request —
 * they close over nothing today, but a tool that ever needs request context
 * should not require restructuring this.
 */
/**
 * @param names Which tools to return. **Production must not pass this** — the
 *   default is the only correct value, and offering a tool whose widget is not
 *   registered means the model promises a widget the panel cannot show.
 *   It exists so tests can exercise a pending tool's `execute` before its widget
 *   is extracted, which is what makes enabling one genuinely a one-line change.
 *   `chat-handler.test.ts` asserts the *offered* set equals `ENABLED_TOOL_NAMES`,
 *   so a stray argument here fails there rather than reaching a reader.
 */
export function buildWorkerTools(
  names: readonly string[] = ENABLED_TOOL_NAMES,
) {
  const all = {
    showGlobe: tool({
      description: docFor("showGlobe"),
      inputSchema: showGlobeInput,
      execute: ({ zone }) =>
        isValidTimeZone(zone)
          ? accept("globe")
          : reject(
              "globe",
              `"${zone}" is not an IANA time zone this runtime knows. Say so plainly rather than inventing one.`,
            ),
    }),

    showDstInspector: tool({
      description: docFor("showDstInspector"),
      inputSchema: showDstInspectorInput,
      execute: ({ zone }) =>
        isValidTimeZone(zone)
          ? accept("dst-inspector")
          : reject(
              "dst-inspector",
              `"${zone}" is not an IANA time zone this runtime knows.`,
            ),
    }),

    showIntervalVisualizer: tool({
      description: docFor("showIntervalVisualizer"),
      inputSchema: showIntervalVisualizerInput,
      // No zone arguments to check; the widget validates its own date-times and
      // renders an inline error rather than throwing.
      execute: () => accept("interval-visualizer"),
    }),

    showConverterBench: tool({
      description: docFor("showConverterBench"),
      inputSchema: showConverterBenchInput,
      execute: ({ from, to }) => {
        const unknown = unknownZones([from, to]);
        return unknown.length > 0
          ? reject(
              "converter-bench",
              `not IANA time zones this runtime knows: ${unknown.join(", ")}.`,
            )
          : accept("converter-bench");
      },
    }),

    showDwellLedger: tool({
      description: docFor("showDwellLedger"),
      inputSchema: showDwellLedgerInput,
      execute: ({ zone, compareZone }) => {
        const unknown = unknownZones(
          compareZone === undefined ? [zone] : [zone, compareZone],
        );
        return unknown.length > 0
          ? reject(
              "dwell-ledger",
              `not IANA time zones this runtime knows: ${unknown.join(", ")}.`,
            )
          : accept("dwell-ledger");
      },
    }),

    showFreeTimeLedger: tool({
      description: docFor("showFreeTimeLedger"),
      inputSchema: showFreeTimeLedgerInput,
      execute: ({ zone }) =>
        isValidTimeZone(zone)
          ? accept("free-time-ledger")
          : reject(
              "free-time-ledger",
              `"${zone}" is not an IANA time zone this runtime knows.`,
            ),
    }),

    // No zones to check — every argument is a date or a window. An invalid
    // date is the widget's sentinel to show, not something this runtime can
    // reject in advance.
    showBillingDeadlines: tool({
      description: docFor("showBillingDeadlines"),
      inputSchema: showBillingDeadlinesInput,
      execute: () => accept("billing-deadlines"),
    }),

    showDeliveryScheduler: tool({
      description: docFor("showDeliveryScheduler"),
      inputSchema: showDeliverySchedulerInput,
      execute: ({ legs, startTimeZone }) => {
        const unknown = unknownZones([
          ...(Array.isArray(legs) ? legs.map((l) => l.timeZone) : []),
          ...(startTimeZone ? [startTimeZone] : []),
        ]);
        return unknown.length > 0
          ? reject(
              "delivery-scheduler",
              `not IANA time zones this runtime knows: ${unknown.join(", ")}.`,
            )
          : accept("delivery-scheduler");
      },
    }),

    showConnectionChecker: tool({
      description: docFor("showConnectionChecker"),
      inputSchema: showConnectionCheckerInput,
      execute: ({ portZone, onwardZone }) => {
        const unknown = unknownZones(
          onwardZone ? [portZone, onwardZone] : [portZone],
        );
        return unknown.length > 0
          ? reject(
              "connection-checker",
              `not IANA time zones this runtime knows: ${unknown.join(", ")}.`,
            )
          : accept("connection-checker");
      },
    }),

    showTimetableReader: tool({
      description: docFor("showTimetableReader"),
      inputSchema: showTimetableReaderInput,
      execute: ({ startTimeZone, timeZone }) => {
        const unknown = unknownZones([startTimeZone, timeZone]);
        return unknown.length > 0
          ? reject(
              "timetable-reader",
              `not IANA time zones this runtime knows: ${unknown.join(", ")}.`,
            )
          : accept("timetable-reader");
      },
    }),

    showCrossingClock: tool({
      description: docFor("showCrossingClock"),
      inputSchema: showCrossingClockInput,
      execute: ({ targetZone }) =>
        isValidTimeZone(targetZone)
          ? accept("crossing-clock")
          : reject(
              "crossing-clock",
              `"${targetZone}" is not an IANA time zone this runtime knows.`,
            ),
    }),

    showCutoffStack: tool({
      description: docFor("showCutoffStack"),
      inputSchema: showCutoffStackInput,
      execute: ({ timeZone }) => {
        const unknown = unknownZones([timeZone]);
        return unknown.length > 0
          ? reject(
              "cutoff-stack",
              `not IANA time zones this runtime knows: ${unknown.join(", ")}.`,
            )
          : accept("cutoff-stack");
      },
    }),

    showCutoffRuler: tool({
      description: docFor("showCutoffRuler"),
      inputSchema: showCutoffRulerInput,
      execute: ({ timeZone }) => {
        const unknown = unknownZones([timeZone]);
        return unknown.length > 0
          ? reject(
              "cutoff-ruler",
              `not IANA time zones this runtime knows: ${unknown.join(", ")}.`,
            )
          : accept("cutoff-ruler");
      },
    }),

    showCutoffCountdown: tool({
      description: docFor("showCutoffCountdown"),
      inputSchema: showCutoffCountdownInput,
      execute: ({ timeZone }) => {
        const unknown = unknownZones([timeZone]);
        return unknown.length > 0
          ? reject(
              "cutoff-countdown",
              `not IANA time zones this runtime knows: ${unknown.join(", ")}.`,
            )
          : accept("cutoff-countdown");
      },
    }),

    // Every argument is a time or a duration. An invalid one is the widget's
    // sentinel to show, not something this runtime can reject in advance.
    showPunctualityBoard: tool({
      description: docFor("showPunctualityBoard"),
      inputSchema: showPunctualityBoardInput,
      execute: () => accept("punctuality-board"),
    }),

    showEtaDrift: tool({
      description: docFor("showEtaDrift"),
      inputSchema: showEtaDriftInput,
      execute: () => accept("eta-drift"),
    }),

    // The one zone is the onward leg's destination, and it is optional.
    showDepartureBoard: tool({
      description: docFor("showDepartureBoard"),
      inputSchema: showDepartureBoardInput,
      execute: ({ onwardZone }) => {
        const unknown = unknownZones(onwardZone ? [onwardZone] : []);
        return unknown.length > 0
          ? reject(
              "departure-board",
              `not IANA time zones this runtime knows: ${unknown.join(", ")}.`,
            )
          : accept("departure-board");
      },
    }),
  };

  return Object.fromEntries(
    Object.entries(all).filter(([name]) => names.includes(name)),
  ) as Partial<typeof all>;
}

export type DoxTools = ReturnType<typeof buildWorkerTools>;

/**
 * A `UIMessage` that knows about Dox's tools.
 *
 * Without this the SDK's `tools` options degrade to `Tool<unknown, unknown>`
 * and reject a real tool set — `safeValidateUIMessages` keys its `tools` option
 * on the message type's inferred tools, so the message type has to carry them.
 */
export type DoxUIMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<DoxTools>
>;
