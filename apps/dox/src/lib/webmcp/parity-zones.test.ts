/**
 * @vitest-environment jsdom
 *
 * The zone tools against their pages. For each page the example, a second preset, a refused input
 * and each branch the tool reports. The converter, the DST inspector, the interval visualizer and
 * the zone planner are compared with what the page's redraw computed; the globe is compared by
 * function: its tool and its clock panel read one `readZoneNow`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { screen } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import {
  importsOf,
  resolveLocal,
  SRC,
  stripComments,
} from "~/test/import-graph";
import { installJsdomShims } from "~/test/jsdom-shims";
import type { RenderedWidget } from "~/test/render-widget";
import { expectParity, type ParityOptions } from "~/test/webmcp-parity";
import { CONVERTER_DEFAULTS, converterFacts } from "../converter-bench";
import { dstFacts } from "../dst-inspector";
import { intervalFacts } from "../interval-visualizer";
import { readZoneNow, readZonesAt } from "../zone-clock";
import { jsonSafe } from "./json-safe";
import type { PageToolResult } from "./model-context";

vi.mock("../converter-bench", async (importOriginal) => {
  const real = await importOriginal<typeof import("../converter-bench")>();
  return { ...real, converterFacts: vi.fn(real.converterFacts) };
});
vi.mock("../dst-inspector", async (importOriginal) => {
  const real = await importOriginal<typeof import("../dst-inspector")>();
  return { ...real, dstFacts: vi.fn(real.dstFacts) };
});
vi.mock("../interval-visualizer", async (importOriginal) => {
  const real = await importOriginal<typeof import("../interval-visualizer")>();
  return { ...real, intervalFacts: vi.fn(real.intervalFacts) };
});
vi.mock("../zone-clock", async (importOriginal) => {
  const real = await importOriginal<typeof import("../zone-clock")>();
  return { ...real, readZonesAt: vi.fn(real.readZonesAt) };
});

installJsdomShims();

// One fixed moment, so a page that reads the clock and the tool see the same instant.
const NOW = "2026-11-16T12:00:00Z";
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

type Args = Record<string, unknown>;
type Tool = Awaited<ReturnType<typeof loadTool>>;

async function loadTool(slug: string) {
  return (await import(`./tools/${slug}.ts`)).default;
}
async function exampleOf(slug: string): Promise<Args> {
  const { def } = await import(`./tools/${slug}.ts`);
  return def.example as Args;
}

const entryOf = (name: string) => WIDGET_REGISTRY[name] as AnyWidgetEntry;

/** The chat rail parses a call's args into the widget's own before it mounts; do the same here. */
function railEntryOf(name: string): AnyWidgetEntry {
  const entry = entryOf(name);
  const widgetArgs = (input: unknown): never => {
    const parsed = entry.parse(input);
    if (!parsed.ok) throw new Error(parsed.reason);
    return parsed.args as never;
  };
  return {
    ...entry,
    load: async () => {
      const loaded = await entry.load();
      return {
        renderTemplate: (idPrefix, args) =>
          loaded.renderTemplate(idPrefix, widgetArgs(args)),
        mount: (root, args, signal) =>
          loaded.mount(root, widgetArgs(args), signal),
      };
    },
  } as AnyWidgetEntry;
}

interface Spied {
  mockClear(): unknown;
  mock: { calls: unknown[][]; results: { type: string; value?: unknown }[] };
}
const spy = (fn: unknown) => fn as unknown as Spied;

/** The facts the page computed, put through the tool's own shape. */
function shaped(
  fn: unknown,
  build: (value: unknown, call: unknown[]) => unknown,
) {
  return {
    mockClear: () => spy(fn).mockClear(),
    get mock() {
      const last = spy(fn).mock.results.at(-1);
      const call = spy(fn).mock.calls.at(-1) ?? [];
      return {
        results:
          last?.type === "return"
            ? [{ type: "return", value: jsonSafe(build(last.value, call)) }]
            : [{ type: "none" }],
      };
    },
  };
}

type Obj = Record<string, unknown>;
const o = (value: unknown): Obj => value as Obj;

const converterFactsOf = shaped(converterFacts, (v) => ({
  converted: o(v).converted,
  parts: o(v).parts,
  relative: o(v).relative,
}));
const dstFactsOf = shaped(dstFacts, (v) => {
  const f = o(v);
  return {
    transitions: f.transitions,
    probe:
      f.value === ""
        ? null
        : {
            value: f.value,
            wallTime: f.plainValue,
            resolved: f.result,
            classification: f.classification,
          },
  };
});
const plannerFactsOf = shaped(readZonesAt, (v, call) => ({
  at: String(call[1]).replace("+00:00[UTC]", "Z"),
  zones: v,
}));

interface Case {
  label: string;
  slug: string;
  tool: string;
  widget: string;
  facts: ParityOptions["facts"];
  example?: Args;
  second: Args;
  refused: Args;
  invalid: Args;
  /** Notes the tool writes that its page never shows. */
  own: (args: Args) => string[];
}

const none = (): string[] => [];

const cases: Case[] = [
  {
    label: "",
    slug: "converter-bench",
    tool: "convert_instant_between_zones",
    widget: "showConverterBench",
    facts: converterFactsOf,
    second: {
      value: "2024-11-03T01:30:00",
      from: "America/New_York",
      to: "Asia/Tokyo",
      locale: "ja",
    },
    refused: {
      value: "not a date",
      from: "Europe/London",
      to: "Australia/Sydney",
    },
    invalid: { value: "2024-03-15T14:30:00" },
    own: none,
  },
  {
    label: "with a zone the library does not know",
    slug: "converter-bench",
    tool: "convert_instant_between_zones",
    widget: "showConverterBench",
    facts: converterFactsOf,
    example: { ...CONVERTER_DEFAULTS, locale: "en" } as Args,
    second: {
      value: "2024-03-15T14:30:00Z",
      from: "UTC",
      to: "Mars/Olympus_Mons",
    },
    refused: { value: "2024-03-15T14:30:00Z", from: "UTC", to: "Nowhere/Land" },
    invalid: {},
    own: none,
  },
  {
    slug: "dst-inspector",
    label: "",
    tool: "list_dst_transitions",
    widget: "showDstInspector",
    facts: dstFactsOf,
    second: {
      zone: "Europe/London",
      year: 2024,
      preset: "overlap",
      disambiguation: "later",
    },
    refused: { zone: "Mars/Olympus_Mons", year: 2024, preset: "gap" },
    invalid: { zone: "Europe/London", year: 1800 },
    own: none,
  },
  {
    slug: "dst-inspector",
    label: "with the preset the schema allows and the page lacks",
    tool: "list_dst_transitions",
    widget: "showDstInspector",
    facts: dstFactsOf,
    example: { zone: "America/New_York", year: 2024, preset: "fixed" },
    second: { zone: "America/New_York", year: 2024, preset: "normal" },
    refused: { zone: "Asia/Tokyo", year: 2024, preset: "gap" },
    invalid: { year: 2024 },
    own: none,
  },
  {
    slug: "dst-inspector",
    label: "with an offset rule",
    tool: "list_dst_transitions",
    widget: "showDstInspector",
    facts: dstFactsOf,
    example: {
      zone: "America/New_York",
      year: 2024,
      preset: "overlap",
      offset: "prefer",
    },
    second: {
      zone: "America/New_York",
      year: 2025,
      preset: "overlap",
      disambiguation: "earlier",
      offset: "reject",
    },
    refused: { zone: "Pacific/Honolulu", year: 2024, offset: "use" },
    invalid: { zone: "UTC", year: 2024, offset: "sometimes" },
    own: none,
  },
  {
    slug: "interval-visualizer",
    label: "",
    tool: "compare_intervals",
    widget: "showIntervalVisualizer",
    facts: spy(intervalFacts) as Spied,
    second: {
      aStart: "2024-03-09T12:00:00-05:00[America/New_York]",
      aEnd: "2024-03-10T12:00:00-04:00[America/New_York]",
      bStart: "2024-03-10T00:00:00-05:00[America/New_York]",
      bEnd: "2024-03-12T00:00:00-04:00[America/New_York]",
    },
    refused: {
      aStart: "2024-06-30T00:00:00+00:00[UTC]",
      aEnd: "2024-01-01T00:00:00+00:00[UTC]",
      bStart: "2024-04-01T00:00:00+00:00[UTC]",
      bEnd: "2024-12-31T00:00:00+00:00[UTC]",
    },
    invalid: { aStart: "2024-01-01T00:00:00+00:00[UTC]" },
    own: none,
  },
  {
    slug: "interval-visualizer",
    label: "with intervals that share no time, and with plain values",
    tool: "compare_intervals",
    widget: "showIntervalVisualizer",
    facts: spy(intervalFacts) as Spied,
    example: {
      aStart: "2024-01-01T00:00:00+00:00[UTC]",
      aEnd: "2024-01-31T00:00:00+00:00[UTC]",
      bStart: "2024-03-01T00:00:00+00:00[UTC]",
      bEnd: "2024-03-31T00:00:00+00:00[UTC]",
    },
    second: {
      aStart: "2024-01-01T00:00:00",
      aEnd: "2024-06-30T00:00:00",
      bStart: "2024-04-01T00:00:00",
      bEnd: "2024-12-31T00:00:00",
    },
    refused: {
      aStart: "garbage",
      aEnd: "2024-01-01T00:00:00+00:00[UTC]",
      bStart: "2024-04-01T00:00:00+00:00[UTC]",
      bEnd: "garbage",
    },
    invalid: {},
    own: none,
  },
  {
    slug: "zone-planner",
    label: "",
    tool: "compare_zone_clocks",
    widget: "showZonePlanner",
    facts: plannerFactsOf,
    second: {
      zones: ["Australia/Sydney", "Pacific/Auckland"],
      time: "2024-04-07T02:00:00Z",
    },
    refused: {
      zones: ["Mars/Olympus_Mons", "Europe/Berlin"],
      time: "2024-03-10T12:00:00Z",
    },
    invalid: { zones: [] },
    own: none,
  },
  {
    slug: "zone-planner",
    label: "with no time, a repeated zone and an unplaceable one",
    tool: "compare_zone_clocks",
    widget: "showZonePlanner",
    facts: plannerFactsOf,
    example: { zones: ["Europe/Paris", "Europe/Paris", "Asia/Kolkata"] },
    second: { zones: ["America/Chicago"], time: "not a time" },
    refused: {
      zones: ["Europe/London", "Mars/Olympus_Mons"],
      time: "2024-10-27T01:30:00Z",
    },
    invalid: { zones: ["UTC"], time: "x" },
    own: none,
  },
];

const tools = new Map<string, Tool>();
beforeAll(async () => {
  for (const c of cases) tools.set(c.slug, await loadTool(c.slug));
});
const toolOf = (c: Case): Tool => {
  const tool = tools.get(c.slug);
  if (!tool) throw new Error(`no tool ${c.slug}`);
  return tool;
};
function okOf(result: PageToolResult<unknown>) {
  if (!result.ok) throw new Error("expected ok");
  return result;
}

describe.each(cases)("$tool against $slug $label", (c) => {
  it("returns what the page computes for its first preset", async () => {
    const args = c.example ?? (await exampleOf(c.slug));
    await expectParity({
      entry: railEntryOf(c.widget),
      args,
      facts: c.facts,
      tool: toolOf(c),
    });
    expect(toolOf(c).name).toBe(c.tool);
  });

  it("returns what the page computes for a second preset", async () => {
    await expectParity({
      entry: railEntryOf(c.widget),
      args: c.second,
      facts: c.facts,
      tool: toolOf(c),
    });
  });

  it("reports an input the library refuses", async () => {
    await expectParity({
      entry: railEntryOf(c.widget),
      args: c.refused,
      facts: c.facts,
      tool: toolOf(c),
      inspect: (_page: RenderedWidget, result) => {
        okOf(result);
      },
    });
  });

  it("resolves invalid-input for arguments the schema refuses", async () => {
    const result = await toolOf(c).execute(c.invalid, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid-input");
  });
});

describe("zone-planner with no zone it can place", () => {
  it("reads nothing, where the page opens on its own pins", async () => {
    const tool = await loadTool("zone-planner");
    const result = await tool.execute(
      { zones: ["Mars/Olympus_Mons"], time: "2024-03-10T12:00:00Z" },
      {},
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toEqual({ at: "2024-03-10T12:00:00Z", zones: [] });
      expect(result.notes.length).toBeGreaterThan(0);
      expect(result.link).toBeUndefined();
    }
  });
});

describe("zoned-earth", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["Europe/London"],
    ["America/New_York"],
    ["Pacific/Auckland"],
    ["Mars/Olympus_Mons"],
  ])(
    "returns the reading the globe's clock panel reads for %s",
    async (zone) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime("2026-03-29T01:30:00Z");
      const tool = await loadTool("zoned-earth");
      const result = await tool.execute({ zone }, {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.result).toEqual(jsonSafe(readZoneNow(zone)));
        expect(result.input).toMatchObject({
          zone,
          now: expect.stringMatching(/^2026-03-29T01:30:00(\.\d+)?Z$/),
        });
      }
    },
  );

  it("says when the library does not know the zone", async () => {
    const tool = await loadTool("zoned-earth");
    const result = await tool.execute({ zone: "Mars/Olympus_Mons" }, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(o(result.result).ok).toBe(false);
      expect(result.notes.length).toBeGreaterThan(1);
    }
  });

  it("resolves invalid-input for arguments the schema refuses", async () => {
    const tool = await loadTool("zoned-earth");
    const result = await tool.execute({}, {});
    expect(result.ok).toBe(false);
  });

  it("is the one zone-clock module the globe reads", () => {
    // Same module, found by the import graph the other WebMCP tests use; the name is checked in
    // the comment-free source because the graph records specifiers, not bindings.
    const zoneClock = path.join(SRC, "lib/zone-clock.ts");
    for (const file of [
      path.join(SRC, "lib/globe.ts"),
      path.join(SRC, "lib/webmcp/tools/zoned-earth.ts"),
    ]) {
      const reads = importsOf(file).some(
        (ref) =>
          ref.kind === "static" &&
          resolveLocal(file, ref.specifier) === zoneClock,
      );
      expect(reads).toBe(true);
      expect(stripComments(readFileSync(file, "utf8"))).toMatch(
        /\breadZoneNow\b/,
      );
    }
  });
});
