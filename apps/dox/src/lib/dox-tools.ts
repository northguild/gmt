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
  | "showFreeTimeLedger";

export const DOX_TOOL_INPUTS = {
  showGlobe: showGlobeInput,
  showDstInspector: showDstInspectorInput,
  showIntervalVisualizer: showIntervalVisualizerInput,
  showConverterBench: showConverterBenchInput,
  showDwellLedger: showDwellLedgerInput,
  showFreeTimeLedger: showFreeTimeLedgerInput,
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
    args: "clockStart, clockEnd (ISO date-times; a plain 2024-06-14T15:00:00 is read as wall time in zone), freeDays (whole number), firstDay (eventDay | nextDay: whether the event day is free day one; ask if the reader did not say), basis (calendar | working: how free days are counted), chargeBasis (calendar | working: how days after free time are charged; outside the US both are mostly calendar days; where free time is in working days, the usual US shape, most tariffs charge calendar days, California terminals working days; ask if the reader did not say), zone (the terminal's IANA id), weekend (optional ISO weekday numbers, working basis), holidays (optional ISO dates, working basis), tiers (optional last chargeable-day ordinal of each band)",
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
 * All six are enabled, every one backed by a registered widget.
 */
export const ENABLED_TOOL_NAMES = [
  "showGlobe",
  "showConverterBench",
  "showIntervalVisualizer",
  "showDstInspector",
  "showDwellLedger",
  "showFreeTimeLedger",
] as const satisfies readonly DoxToolName[];

export type EnabledToolName = (typeof ENABLED_TOOL_NAMES)[number];

/** Prompt copy for the offered tools only. */
export const ENABLED_TOOL_DOCS = DOX_TOOL_DOCS.filter((doc) =>
  (ENABLED_TOOL_NAMES as readonly DoxToolName[]).includes(doc.name),
);
