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
  showConverterBenchInput,
  showDstInspectorInput,
  showGlobeInput,
  showIntervalVisualizerInput,
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
export function buildWorkerTools() {
  return {
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
  };
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
