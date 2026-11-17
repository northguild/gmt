/**
 * @vitest-environment jsdom
 *
 * The rail, punctuality and aviation tools against their pages. For each page the example, a
 * second preset and a refused input: the tool's `result` is what the page's redraw computed, and a
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
import { collectDepartureFacts, DEPARTURE_PRESETS } from "../departure-board";
import { collectDriftFacts, ETA_PRESETS } from "../eta-drift";
import { collectBoardFacts, PUNCTUALITY_PRESETS } from "../punctuality-board";
import { rowFacts, TIMETABLE_PRESETS } from "../timetable-reader";
import {
  buildModel as buildSsimModel,
  SSIM_PRESETS,
} from "../ssim-date-reader";
import {
  buildModel as buildMetarModel,
  buildNotamModel,
  NOTAM_PRESETS,
} from "../report-time-resolver";
import {
  collectGtfsFacts,
  READ_PRESETS,
  WRITE_PRESETS,
} from "../gtfs-time-reader";
import {
  computeClock,
  PRESETS as CLOCK_PRESETS,
} from "../gtfs-service-day-clock";
import { computeTrip, PRESETS as TRIP_PRESETS } from "../gtfs-trip-board";

vi.mock("../departure-board", async (importOriginal) => {
  const real = await importOriginal<typeof import("../departure-board")>();
  return {
    ...real,
    collectDepartureFacts: vi.fn(real.collectDepartureFacts),
  };
});
vi.mock("../eta-drift", async (importOriginal) => {
  const real = await importOriginal<typeof import("../eta-drift")>();
  return { ...real, collectDriftFacts: vi.fn(real.collectDriftFacts) };
});
vi.mock("../punctuality-board", async (importOriginal) => {
  const real = await importOriginal<typeof import("../punctuality-board")>();
  return { ...real, collectBoardFacts: vi.fn(real.collectBoardFacts) };
});
vi.mock("../timetable-reader", async (importOriginal) => {
  const real = await importOriginal<typeof import("../timetable-reader")>();
  return { ...real, rowFacts: vi.fn(real.rowFacts) };
});
vi.mock("../ssim-date-reader", async (importOriginal) => {
  const real = await importOriginal<typeof import("../ssim-date-reader")>();
  return { ...real, buildModel: vi.fn(real.buildModel) };
});
vi.mock("../report-time-resolver", async (importOriginal) => {
  const real = await importOriginal<typeof import("../report-time-resolver")>();
  return {
    ...real,
    buildModel: vi.fn(real.buildModel),
    buildNotamModel: vi.fn(real.buildNotamModel),
  };
});
vi.mock("../gtfs-time-reader", async (importOriginal) => {
  const real = await importOriginal<typeof import("../gtfs-time-reader")>();
  return { ...real, collectGtfsFacts: vi.fn(real.collectGtfsFacts) };
});
vi.mock("../gtfs-service-day-clock", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../gtfs-service-day-clock")>();
  return { ...real, computeClock: vi.fn(real.computeClock) };
});
vi.mock("../gtfs-trip-board", async (importOriginal) => {
  const real = await importOriginal<typeof import("../gtfs-trip-board")>();
  return { ...real, computeTrip: vi.fn(real.computeTrip) };
});

installJsdomShims();

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

/**
 * The chat rail parses a call's args into the widget's own (`yearWindow` is `window`, `reference`
 * is `ref`) before it mounts; `renderWidget` hands the args over as given. This entry parses them
 * first, the way the rail does, so one object feeds both the page and the tool.
 */
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

function preset<T extends { id: string }>(
  presets: readonly T[],
  id: string,
): T {
  const found = presets.find((p) => p.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return found;
}

const departureArgs = (id: string): Args => {
  const p = preset(DEPARTURE_PRESETS, id);
  return {
    after: p.after,
    ...(p.form === "list"
      ? { departures: [...p.departures] }
      : { headway: p.headway.headway, from: p.headway.from, to: p.headway.to }),
    ...(p.minimumConnection === ""
      ? {}
      : { minimumConnection: p.minimumConnection }),
    ...(p.onwardDuration === "" ? {} : { onwardDuration: p.onwardDuration }),
    ...(p.onwardZone === "" ? {} : { onwardZone: p.onwardZone }),
  };
};
const etaArgs = (id: string): Args => {
  const p = preset(ETA_PRESETS, id);
  return {
    events: p.events.map((e) => ({ ...e })),
    ...(p.tolerance === "" ? {} : { tolerance: p.tolerance }),
  };
};
const punctualityArgs = (id: string): Args => {
  const p = preset(PUNCTUALITY_PRESETS, id);
  return {
    pairs: p.rows.map((r) => ({ ...r })),
    late: p.late,
    ...(p.early === undefined ? {} : { early: p.early }),
    ...(p.compareLate === undefined ? {} : { compareLate: p.compareLate }),
  };
};
const timetableArgs = (id: string): Args => {
  const p = preset(TIMETABLE_PRESETS, id);
  const offsets = p.rows.map((r) => r.offset);
  return {
    startTimeZone: p.startTimeZone,
    departures: p.rows.map((r) => r.departure),
    ...(offsets.every((o) => o === "") ? {} : { offsets }),
    duration: p.duration,
    timeZone: p.timeZone,
  };
};
const ssimArgs = (id: string): Args => {
  const p = preset(SSIM_PRESETS, id);
  return {
    value: p.value,
    ...(p.window === ""
      ? {}
      : { yearWindow: p.window === "rolling" ? "rolling" : Number(p.window) }),
    locale: p.locale,
    date: p.date,
  };
};
const notamArgs = (id: string): Args => {
  const p = preset(NOTAM_PRESETS, id);
  return { itemB: p.itemB, itemC: p.itemC, yearWindow: Number(p.window) };
};
const clockArgs = (id: string): Args => {
  const p = preset(CLOCK_PRESETS, id);
  return { serviceDate: p.date, time: p.time, timeZone: p.zone };
};
const tripArgs = (id: string): Args => {
  const p = preset(TRIP_PRESETS, id);
  return { stopTimes: p.rows, date: p.date, zone: p.zone };
};
const gtfsArgs = (read: number, write: number): Args => {
  const r = READ_PRESETS[read];
  const w = WRITE_PRESETS[write];
  if (!r || !w) throw new Error("no preset");
  return { value: r.value, seconds: w.seconds, dayOverflow: w.dayOverflow };
};

const spy = (fn: unknown) => fn as unknown as Facts;

/** The timetable page draws one `rowFacts` per printed row in a redraw: the last redraw's are the last rows. */
function lastRows(rows: number): Facts {
  const rowSpy = vi.mocked(rowFacts);
  return {
    mockClear: () => rowSpy.mockClear(),
    get mock() {
      const all = rowSpy.mock.results;
      return {
        results: [
          { type: "return", value: all.slice(-rows).map((r) => r.value) },
        ],
      };
    },
  };
}

/** The report time page draws both sections; the tool reads only the sections whose fields it was given. */
function reportFacts(args: Args): Facts {
  const metar = ["group", "reference", "metarPreset"].some((k) => k in args);
  const notam = ["itemB", "itemC", "yearWindow", "notamPreset"].some(
    (k) => k in args,
  );
  const metarSpy = vi.mocked(buildMetarModel);
  const notamSpy = vi.mocked(buildNotamModel);
  return {
    mockClear: () => {
      metarSpy.mockClear();
      notamSpy.mockClear();
    },
    get mock() {
      return {
        results: [
          {
            type: "return",
            value: {
              metar: metar
                ? (metarSpy.mock.results.at(-1)?.value ?? null)
                : null,
              notam: notam
                ? (notamSpy.mock.results.at(-1)?.value ?? null)
                : null,
            },
          },
        ],
      };
    },
  };
}

type AsideKind = "complementary" | "note" | "list";

interface Case {
  slug: string;
  tool: string;
  widget: string;
  facts: (args: Args) => Facts;
  second: Args;
  /** An input the schema accepts and the library refuses. */
  refused: Args;
  /** How the page reads the refusal, and where. */
  aside: { role: AsideKind; name: string; prefix?: RegExp };
  /** An input the schema refuses. */
  invalid: Args;
}

const cases: Case[] = [
  {
    slug: "departure-board",
    tool: "find_next_departure",
    widget: "showDepartureBoard",
    facts: () => spy(collectDepartureFacts),
    second: departureArgs("ferry-list"),
    refused: { ...departureArgs("ferry-list"), after: "2024-06-15 10:05" },
    aside: { role: "complementary", name: "Why NO SIGNAL" },
    invalid: { departures: ["2024-06-15T10:30:00+03:00"] },
  },
  {
    slug: "eta-drift",
    tool: "compute_eta_drift",
    widget: "showEtaDrift",
    facts: () => spy(collectDriftFacts),
    second: etaArgs("req-beats-est"),
    refused: {
      events: [
        {
          classifier: "EST",
          at: "2024-06-15 10:00",
          recordedAt: "2024-06-15T08:00:00Z",
        },
      ],
    },
    aside: { role: "complementary", name: "Why NO SIGNAL" },
    invalid: { events: [] },
  },
  {
    slug: "punctuality-board",
    tool: "check_punctuality",
    widget: "showPunctualityBoard",
    facts: () => spy(collectBoardFacts),
    second: punctualityArgs("sixty-and-120"),
    refused: {
      pairs: [
        { planned: "2024-06-15 10:00", actual: "2024-06-15T10:05:00+02:00" },
      ],
      late: "PT15M",
    },
    aside: { role: "complementary", name: "Why NO SIGNAL" },
    invalid: { pairs: [], late: "PT15M" },
  },
  {
    slug: "timetable-reader",
    tool: "read_timetable_times",
    widget: "showTimetableReader",
    facts: (args) => lastRows((args.departures as string[]).length),
    second: timetableArgs("offset-picks"),
    refused: {
      startTimeZone: "Europe/London",
      departures: ["2024-10-27T25:30:00"],
      duration: "PT1H",
      timeZone: "Europe/London",
    },
    aside: { role: "complementary", name: "Why null", prefix: /^Row 1: / },
    invalid: { departures: [] },
  },
  {
    slug: "ssim-date-reader",
    tool: "read_ssim_date",
    widget: "showSsimDateReader",
    facts: () => spy(buildSsimModel),
    // The example's window is 2000, so these two use others: a wrong window mapping shows.
    second: ssimArgs("archive"),
    refused: ssimArgs("leap-1900"),
    aside: { role: "note", name: "Reason for the read" },
    invalid: {},
  },
  {
    slug: "report-time-resolver",
    tool: "resolve_aviation_report_time",
    widget: "showReportTimeResolver",
    facts: reportFacts,
    second: notamArgs("opadd-estimate"),
    refused: { group: "999999Z", reference: "2024-07-01T00:05:00Z" },
    aside: { role: "note", name: "Reason for the report time" },
    invalid: { bogus: "x" },
  },
  {
    slug: "gtfs-time-reader",
    tool: "read_gtfs_stop_time",
    widget: "showGtfsTimeReader",
    facts: () => spy(collectGtfsFacts),
    second: gtfsArgs(1, 1),
    refused: { value: "25:99:00" },
    aside: { role: "note", name: "Reason for the read" },
    invalid: {},
  },
  {
    slug: "gtfs-service-day-clock",
    tool: "convert_gtfs_service_time",
    widget: "showGtfsServiceDayClock",
    facts: () => spy(computeClock),
    second: clockArgs("fall-back"),
    refused: clockArgs("no-noon"),
    aside: { role: "note", name: "Reason for the GTFS instant" },
    invalid: {},
  },
  {
    slug: "gtfs-trip-board",
    tool: "convert_gtfs_trip_times",
    widget: "showGtfsTripBoard",
    facts: () => spy(computeTrip),
    second: tripArgs("night-train"),
    refused: tripArgs("no-noon"),
    aside: { role: "list", name: "Notes on the paste" },
    invalid: {},
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

describe.each(cases)("$tool against $slug", (c) => {
  it("returns what the page computes for its first preset", async () => {
    const args = await exampleOf(c.slug);
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
        const why = screen.getByRole(c.aside.role, { name: c.aside.name });
        const first = notes[0] as string;
        expect(why).toHaveTextContent(first.replace(c.aside.prefix ?? "", ""));
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
