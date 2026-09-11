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

export const showConverterBenchInput = z.object({
  value: dateTimeSchema,
  from: zoneSchema,
  to: zoneSchema,
  locale: z.string().max(16).optional(),
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
  | "showConverterBench";

export const DOX_TOOL_INPUTS = {
  showGlobe: showGlobeInput,
  showDstInspector: showDstInspectorInput,
  showIntervalVisualizer: showIntervalVisualizerInput,
  showConverterBench: showConverterBenchInput,
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
 * All four are now enabled, every one backed by a registered widget.
 */
export const ENABLED_TOOL_NAMES = [
  "showGlobe",
  "showConverterBench",
  "showIntervalVisualizer",
  "showDstInspector",
] as const satisfies readonly DoxToolName[];

export type EnabledToolName = (typeof ENABLED_TOOL_NAMES)[number];

/** Prompt copy for the offered tools only. */
export const ENABLED_TOOL_DOCS = DOX_TOOL_DOCS.filter((doc) =>
  (ENABLED_TOOL_NAMES as readonly DoxToolName[]).includes(doc.name),
);
