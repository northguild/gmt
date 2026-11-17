/**
 * @vitest-environment jsdom
 *
 * The time-scale and satellite tools against their pages. For each page the example, a second
 * preset and a refused input: the tool's `result` is what the page's redraw computed, and a
 * library refusal reads the way the page reads it. A schema refusal resolves `invalid-input`.
 */
import { screen } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import type { RenderedWidget } from "~/test/render-widget";
import { expectParity, fakeModelContext } from "~/test/webmcp-parity";
import type { PageToolResult } from "./model-context";
import { offerPageTool, WEBMCP_MARKER } from "./offer";
import { readCode, writeInstant } from "../ccsds-time-code-decoder";
import { readElapsed } from "../elapsed-vs-clock";
import { readRollover } from "../gnss-rollover-checker";
import { readGnss } from "../gnss-week-decoder";
import { readTimeline } from "../leap-second-timeline";
import { readClocks } from "../satellite-clock-converter";
import { readStack } from "../terrestrial-time-stack";

const rulerReturns = vi.hoisted(() => [] as unknown[]);

vi.mock("../ccsds-time-code-decoder", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../ccsds-time-code-decoder")>();
  return {
    ...real,
    readCode: vi.fn(real.readCode),
    writeInstant: vi.fn(real.writeInstant),
  };
});
vi.mock("../code-b-day-ruler", async (importOriginal) => {
  const real = await importOriginal<typeof import("../code-b-day-ruler")>();
  return {
    ...real,
    createRuler: vi.fn((lib: Parameters<typeof real.createRuler>[0]) => {
      const ruler = real.createRuler(lib);
      return {
        ...ruler,
        read: (state: Parameters<typeof ruler.read>[0]) => {
          const value = ruler.read(state);
          rulerReturns.push(value);
          return value;
        },
      };
    }),
  };
});
vi.mock("../elapsed-vs-clock", async (importOriginal) => {
  const real = await importOriginal<typeof import("../elapsed-vs-clock")>();
  return { ...real, readElapsed: vi.fn(real.readElapsed) };
});
vi.mock("../gnss-rollover-checker", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../gnss-rollover-checker")>();
  return { ...real, readRollover: vi.fn(real.readRollover) };
});
vi.mock("../gnss-week-decoder", async (importOriginal) => {
  const real = await importOriginal<typeof import("../gnss-week-decoder")>();
  return { ...real, readGnss: vi.fn(real.readGnss) };
});
vi.mock("../leap-second-timeline", async (importOriginal) => {
  const real = await importOriginal<typeof import("../leap-second-timeline")>();
  return { ...real, readTimeline: vi.fn(real.readTimeline) };
});
vi.mock("../satellite-clock-converter", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../satellite-clock-converter")>();
  return { ...real, readClocks: vi.fn(real.readClocks) };
});
vi.mock("../terrestrial-time-stack", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../terrestrial-time-stack")>();
  return { ...real, readStack: vi.fn(real.readStack) };
});

installJsdomShims();

// The two live-clock pages read "now" through `clockNow`; one fixed moment makes the page and the
// tool see the same instant.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2026-11-16T12:00:00Z");
});
afterEach(() => {
  vi.useRealTimers();
});

type Args = Record<string, unknown>;
type Tool = Awaited<ReturnType<typeof loadTool>>;
interface Facts {
  mockClear(): unknown;
  mock: { results: { type: string; value?: unknown }[] };
}

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

const spy = (fn: unknown) => fn as unknown as Facts;

type Obj = Record<string, unknown>;
const omit = (value: unknown, keys: string[]): Obj =>
  Object.fromEntries(
    Object.entries(value as Obj).filter(([k]) => !keys.includes(k)),
  );
const pick = (value: unknown, keys: string[]): Obj =>
  Object.fromEntries(keys.map((k) => [k, (value as Obj)[k]]));

/** A facts spy whose value is projected the way the tool projects it, on the test's own side. */
function projected(
  fn: unknown,
  project: (value: Obj, args: Args) => unknown,
  args: Args,
): Facts {
  const inner = spy(fn);
  return {
    mockClear: () => inner.mockClear(),
    get mock() {
      const last = inner.mock.results.at(-1);
      return {
        results: [
          last?.type === "return"
            ? { type: "return", value: project(last.value as Obj, args) }
            : { type: last?.type ?? "none" },
        ],
      };
    },
  };
}

const SENTINEL_KEYS = ["state", "plates", "calls", "failure", "emptyText"];

function ccsdsFacts(args: Args): Facts {
  const readSpy = vi.mocked(readCode);
  const writeSpy = vi.mocked(writeInstant);
  return {
    mockClear: () => {
      readSpy.mockClear();
      writeSpy.mockClear();
    },
    get mock() {
      const reading = readSpy.mock.results.at(-1)?.value;
      const writing = writeSpy.mock.results.at(-1)?.value;
      return {
        results: [
          {
            type: "return",
            value: {
              read:
                args.code === undefined || reading === undefined
                  ? null
                  : pick(reading, [
                      "kind",
                      "which",
                      "instant",
                      "digits",
                      "dropped",
                      "secondSixty",
                      "zSent",
                      "dayCaption",
                      "reason",
                    ]),
              write:
                args.instant === undefined || writing === undefined
                  ? null
                  : pick(writing, ["kind", "a", "b", "cut"]),
            },
          },
        ],
      };
    },
  };
}

function rulerFacts(): Facts {
  return {
    mockClear: () => {
      rulerReturns.length = 0;
    },
    get mock() {
      const last = rulerReturns.at(-1) as Obj | undefined;
      return {
        results: [
          {
            type: last === undefined ? "none" : "return",
            value:
              last === undefined
                ? undefined
                : {
                    day: last.day,
                    dayText: last.dayText,
                    sentence: last.sentence,
                    lanes: (last.lanes as Obj[]).map((lane) =>
                      pick(lane, [
                        "status",
                        "year",
                        "length",
                        "header",
                        "codeB",
                        "codeA",
                        "date",
                        "monthDay",
                        "missing",
                      ]),
                    ),
                  },
          },
        ],
      };
    },
  };
}

const text = (value: unknown) => (value === null ? null : String(value));

const timelineFacts = (args: Args): Facts =>
  projected(
    readTimeline,
    (v) => {
      const date = args.date !== undefined && args.date !== "";
      const check = args.check !== undefined && args.check !== "";
      const between =
        args.from !== undefined &&
        args.from !== "" &&
        args.to !== undefined &&
        args.to !== "";
      return {
        steps: (v.steps as Obj[]).map((s) => omit(s, ["ms"])),
        startOffset: v.startOffset,
        offset: date ? pick(v.offset, ["offset", "next"]) : null,
        between: between ? pick(v.between, ["count", "counted"]) : null,
        check: check
          ? pick(v.check, ["verdict", "insertion", "isLeap", "hasSecond60"])
          : null,
      };
    },
    args,
  );

const gnssFacts = (args: Args): Facts =>
  projected(
    readGnss,
    (v, a) => ({
      ...pick(v, [
        "status",
        "utc",
        "system",
        "modulus",
        "week",
        "counters",
        "rinexRows",
      ]),
      // The page keeps the counter in its state but does not use it in rinex mode.
      counter: a.mode === "rinex" ? null : v.counter,
      lanes: (v.lanes as Obj[]).map((l) =>
        omit(l, ["pin", "today", "gapBefore"]),
      ),
    }),
    args,
  );

type AsideKind = "complementary" | "note" | "list";

interface Case {
  slug: string;
  /** Names a second case on a page. */
  label?: string;
  /** Used in place of the tool's own example. */
  example?: Args;
  tool: string;
  widget: string;
  facts: (args: Args) => Facts;
  second: Args;
  /** An input the schema accepts and the library refuses. */
  refused: Args;
  /** How the page reads the refusal: in a named aside, or as plain text. */
  aside: { role: AsideKind; name: string } | { text: true };
  /** An input the schema refuses. */
  invalid: Args;
}

const cases: Case[] = [
  {
    slug: "satellite-clock-converter",
    tool: "convert_instant_to_satellite_clocks",
    widget: "showSatelliteClockConverter",
    facts: (args) =>
      projected(
        readClocks,
        (v) => omit(v, [...SENTINEL_KEYS, "footnote"]),
        args,
      ),
    second: { value: "2024-01-01T00:00:04 BDT" },
    refused: { value: "2024-01-01T00:00:37 UTC" },
    aside: { role: "complementary", name: "Why there is no result" },
    invalid: {},
  },
  {
    slug: "terrestrial-time-stack",
    tool: "convert_instant_to_terrestrial_scales",
    widget: "showTerrestrialTimeStack",
    facts: (args) =>
      projected(
        readStack,
        (v) => ({
          ...omit(v, [...SENTINEL_KEYS, "footnote", "rows"]),
          rows: (v.rows as Obj[]).map((r) => omit(r, ["call", "backCall"])),
        }),
        args,
      ),
    second: { value: "2026-01-01T00:01:09.184 TT" },
    refused: { value: "1971-12-31T23:59:59Z" },
    aside: { text: true },
    invalid: { value: "x".repeat(65) },
  },
  {
    slug: "elapsed-vs-clock-difference",
    tool: "compare_elapsed_and_clock_seconds",
    widget: "showElapsedVsClock",
    facts: (args) =>
      projected(
        readElapsed,
        (v) => ({
          clockNanoseconds: text(v.clock),
          elapsedNanoseconds: text(v.elapsed),
          count: v.count,
          counted: v.counted,
        }),
        args,
      ),
    second: { start: "2000-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" },
    refused: { start: "1960-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" },
    aside: { text: true },
    invalid: {},
  },
  {
    slug: "leap-second-timeline",
    tool: "list_leap_seconds",
    widget: "showLeapSecondTimeline",
    facts: timelineFacts,
    second: {
      date: "2016-01-01T00:00:00Z",
      check: "2017-12-31T23:59:60Z",
      from: "2024-01-01T00:00:00Z",
      to: "2000-01-01T00:00:00Z",
    },
    refused: { date: "1971-01-01T00:00:00Z" },
    aside: { text: true },
    invalid: {},
  },
  {
    slug: "gnss-rollover-checker",
    tool: "check_gnss_week_rollover",
    widget: "showGnssRolloverChecker",
    facts: (args) =>
      projected(
        readRollover,
        (v) => omit(v, [...SENTINEL_KEYS, "strip", "fuse", "countdown"]),
        args,
      ),
    second: {
      counter: "GAL",
      firmwareEra: "0",
      date: "2078-03-01T00:00:00Z",
    },
    refused: {
      counter: "BDT",
      firmwareNotBefore: "not a date at all",
      date: "2030-01-01T00:00:00Z",
    },
    aside: { role: "complementary", name: "Why there is no result" },
    invalid: { counter: "GAL" },
  },
  {
    slug: "gnss-week-decoder",
    tool: "decode_gnss_week",
    widget: "showGnssWeekDecoder",
    facts: gnssFacts,
    second: {
      mode: "rinex",
      system: "GPS",
      week: 1930,
      timeOfWeekSeconds: 17,
    },
    refused: {
      mode: "broadcast",
      counter: "GPS-LNAV",
      week: 1024,
      timeOfWeekSeconds: 0,
      rolloverEra: "2",
    },
    aside: { role: "complementary", name: "Why there is no result" },
    invalid: {},
  },
  {
    slug: "ccsds-time-code-decoder",
    tool: "decode_ccsds_time_code",
    widget: "showCcsdsTimeCodeDecoder",
    facts: ccsdsFacts,
    second: {
      code: "2024-06-15T14:30:00Z",
      instant: "2024-06-15T14:30:00+02:00",
      digits: "auto",
    },
    refused: { code: "2024-001T00:00:00", instant: "2024-06-15T14:30:00" },
    aside: { text: true },
    invalid: { digits: "10" },
  },
  {
    slug: "code-b-day-ruler",
    tool: "convert_day_of_year_to_date",
    widget: "showCodeBDayRuler",
    facts: () => rulerFacts(),
    second: { year: 2016, compareYear: 2017, day: 366 },
    refused: { year: 2024, compareYear: 2025, day: 366 },
    aside: { text: true },
    invalid: { day: 400 },
  },
  {
    slug: "gnss-week-decoder",
    label: "from a UTC instant on one counter",
    tool: "decode_gnss_week",
    widget: "showGnssWeekDecoder",
    facts: gnssFacts,
    example: { mode: "utc", utc: "2026-01-01T00:00:00Z", counter: "GAL" },
    second: { mode: "utc", utc: "2024-06-15T12:00:00Z", counter: "GPS-LNAV" },
    refused: { mode: "utc", utc: "not an instant at all", counter: "GAL" },
    aside: { role: "complementary", name: "Why there is no result" },
    invalid: { mode: "utc" },
  },
  {
    slug: "ccsds-time-code-decoder",
    label: "with only a code",
    tool: "decode_ccsds_time_code",
    widget: "showCcsdsTimeCodeDecoder",
    facts: ccsdsFacts,
    example: { code: "2016-366T23:59:60.5Z" },
    second: { code: "2024-001T00:00:00Z" },
    refused: { code: "2023-366T00:00:00Z" },
    aside: { text: true },
    invalid: { digits: "10" },
  },
  {
    slug: "ccsds-time-code-decoder",
    label: "with only an instant",
    tool: "decode_ccsds_time_code",
    widget: "showCcsdsTimeCodeDecoder",
    facts: ccsdsFacts,
    example: { instant: "2026-12-31T23:59:59.9999999Z" },
    second: { instant: "2024-06-15T14:30:00+02:00", digits: "2" },
    refused: { instant: "2024-06-15T14:30:00" },
    aside: { text: true },
    invalid: { digits: "10" },
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
      facts: c.facts(args),
      tool: toolOf(c),
    });
    expect(toolOf(c).name).toBe(c.tool);
  });

  it("returns what the page computes for a second preset", async () => {
    await expectParity({
      entry: railEntryOf(c.widget),
      args: c.second,
      facts: c.facts(c.second),
      tool: toolOf(c),
    });
  });

  it("explains an input the library refuses in the page's own words", async () => {
    await expectParity({
      entry: railEntryOf(c.widget),
      args: c.refused,
      facts: c.facts(c.refused),
      tool: toolOf(c),
      inspect: async (_page: RenderedWidget, result) => {
        const { notes } = okOf(result);
        expect(notes.length).toBeGreaterThan(0);
        const first = notes[0] as string;
        if ("text" in c.aside) {
          // Every sentence the tool reports is one the page shows.
          for (const note of notes) {
            expect(screen.getAllByText(note).length).toBeGreaterThan(0);
          }
        } else {
          const why = screen.getByRole(c.aside.role, { name: c.aside.name });
          expect(why).toHaveTextContent(first);
        }
      },
    });
  });

  it("resolves invalid-input for arguments the schema refuses", async () => {
    const result = await toolOf(c).execute(c.invalid, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid-input");
  });

  it("registers through offerPageTool on a page that names it", async () => {
    const fake = fakeModelContext();
    const controller = new AbortController();
    const doc = document.implementation.createHTMLDocument("");
    const meta = doc.createElement("meta");
    meta.name = WEBMCP_MARKER;
    meta.content = c.slug;
    doc.head.append(meta);
    Object.defineProperty(doc, "modelContext", { value: fake.context });
    try {
      const outcome = await offerPageTool(
        c.slug,
        () => import(`./tools/${c.slug}.ts`),
        { doc, signal: controller.signal },
      );
      expect(outcome).toBe("registered");
      expect(fake.tools.has(c.tool)).toBe(true);
    } finally {
      controller.abort();
    }
    expect(fake.tools.size).toBe(0);
  });
});
