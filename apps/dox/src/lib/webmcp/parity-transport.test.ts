/**
 * @vitest-environment jsdom
 *
 * The transport and cut-off tools against their pages. For each page the example, a second preset
 * and a refused input: the tool's `result` is what the page's redraw computed, and a library
 * refusal reads the way the page reads it. A schema refusal resolves `invalid-input`.
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
import { collectCountdownFacts, COUNTDOWN_PRESETS } from "../cutoff-countdown";
import { collectStackFacts, STACK_PRESETS } from "../cutoff-stack";
import { CONNECTION_PRESETS, connectionFacts } from "../connection-checker";
import { CROSSING_PRESETS, crossingFacts } from "../crossing-clock";
import { buildItinerary, DELIVERY_PRESETS } from "../delivery-scheduler";
import { JOURNEY_PRESETS, readJourney } from "../journey-split";

vi.mock("../cutoff-countdown", async (importOriginal) => {
  const real = await importOriginal<typeof import("../cutoff-countdown")>();
  return {
    ...real,
    collectCountdownFacts: vi.fn(real.collectCountdownFacts),
  };
});
vi.mock("../cutoff-stack", async (importOriginal) => {
  const real = await importOriginal<typeof import("../cutoff-stack")>();
  return { ...real, collectStackFacts: vi.fn(real.collectStackFacts) };
});
vi.mock("../connection-checker", async (importOriginal) => {
  const real = await importOriginal<typeof import("../connection-checker")>();
  return { ...real, connectionFacts: vi.fn(real.connectionFacts) };
});
vi.mock("../crossing-clock", async (importOriginal) => {
  const real = await importOriginal<typeof import("../crossing-clock")>();
  return { ...real, crossingFacts: vi.fn(real.crossingFacts) };
});
vi.mock("../delivery-scheduler", async (importOriginal) => {
  const real = await importOriginal<typeof import("../delivery-scheduler")>();
  return { ...real, buildItinerary: vi.fn(real.buildItinerary) };
});
vi.mock("../journey-split", async (importOriginal) => {
  const real = await importOriginal<typeof import("../journey-split")>();
  return { ...real, readJourney: vi.fn(real.readJourney) };
});

installJsdomShims();

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

function preset<T extends { id: string }>(
  presets: readonly T[],
  id: string,
): T {
  const found = presets.find((p) => p.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return found;
}

/** A leg with only the fields it has: the schema takes no empty string. */
function legArgs(leg: {
  departure: string;
  duration: string;
  timeZone: string;
  dwellAfter: string;
  mode: string;
}) {
  return {
    ...(leg.departure === "" ? {} : { departure: leg.departure }),
    duration: leg.duration,
    timeZone: leg.timeZone,
    ...(leg.dwellAfter === "" ? {} : { dwellAfter: leg.dwellAfter }),
    ...(leg.mode === "" ? {} : { mode: leg.mode }),
  };
}

const countdownArgs = (id: string): Args => {
  const p = preset(COUNTDOWN_PRESETS, id);
  return { cutoff: p.cutoff, now: p.now, timeZone: p.timeZone };
};
const stackArgs = (id: string): Args => {
  const p = preset(STACK_PRESETS, id);
  return {
    anchor: p.anchor,
    timeZone: p.timeZone,
    cutoffs: p.cutoffs.map(({ name, offset, atLocalTime }) => ({
      name,
      offset,
      ...(atLocalTime === "" ? {} : { atLocalTime }),
    })),
    ...(p.calendar ? { weekend: [...p.weekend] } : {}),
    ...(p.holidays === "" ? {} : { holidays: p.holidays.split(",") }),
    ...(p.roll === "" ? {} : { roll: p.roll }),
  };
};
const connectionArgs = (id: string): Args => {
  const { state } = preset(CONNECTION_PRESETS, id);
  return { ...state, handlingMinutes: Number(state.handlingMinutes) };
};
const crossingArgs = (id: string): Args => ({
  ...preset(CROSSING_PRESETS, id).state,
});
const deliveryArgs = (id: string): Args => {
  const p = preset(DELIVERY_PRESETS, id);
  return {
    legs: p.legs.map(legArgs),
    ...(p.startTimeZone === "" ? {} : { startTimeZone: p.startTimeZone }),
  };
};
const journeyArgs = (id: string): Args => {
  const p = preset(JOURNEY_PRESETS, id);
  return {
    legs: p.legs.map(legArgs),
    ...(p.startTimeZone === "" ? {} : { startTimeZone: p.startTimeZone }),
  };
};

interface Case {
  slug: string;
  tool: string;
  widget: string;
  facts: ReturnType<typeof vi.fn>;
  second: Args;
  /** An input the schema accepts and the library refuses. */
  refused: Args;
  /** The page's own reading of the refusal. */
  aside: string;
  /** An input the schema refuses. */
  invalid: Args;
}

const cases: Case[] = [
  {
    slug: "cutoff-countdown",
    tool: "compute_time_to_cutoff",
    widget: "showCutoffCountdown",
    facts: vi.mocked(collectCountdownFacts),
    second: countdownArgs("on-time"),
    refused: countdownArgs("zoneless-now"),
    aside: "Why NO SIGNAL",
    invalid: { cutoff: 12, timeZone: "Europe/Amsterdam" },
  },
  {
    slug: "cutoff-stack",
    tool: "list_sailing_cutoffs",
    widget: "showCutoffStack",
    facts: vi.mocked(collectStackFacts),
    second: stackArgs("holiday"),
    refused: stackArgs("no-roll"),
    aside: "Why NO SIGNAL",
    invalid: { anchor: "2024-06-17T18:00:00+02:00", cutoffs: [] },
  },
  {
    slug: "connection-checker",
    tool: "check_connection",
    widget: "showConnectionChecker",
    facts: vi.mocked(connectionFacts),
    second: connectionArgs("spring-forward"),
    refused: { ...connectionArgs("made"), portZone: "Nowhere/City" },
    aside: "Why no verdict",
    invalid: { ...connectionArgs("made"), handlingMinutes: -5 },
  },
  {
    slug: "crossing-clock",
    tool: "compute_crossing_time",
    widget: "showCrossingClock",
    facts: vi.mocked(crossingFacts),
    second: crossingArgs("fall-back"),
    refused: crossingArgs("inverted"),
    aside: "Why null",
    invalid: { entry: "2024-03-31T00:00:00Z", exit: "2024-03-31T07:00:00Z" },
  },
  {
    slug: "delivery-scheduler",
    tool: "schedule_delivery",
    widget: "showDeliveryScheduler",
    facts: vi.mocked(buildItinerary),
    second: deliveryArgs("ship-scheduled"),
    refused: deliveryArgs("missed-connection"),
    aside: "Why NO SIGNAL",
    invalid: { legs: [] },
  },
  {
    slug: "journey-split",
    tool: "compute_journey_split",
    widget: "showJourneySplit",
    facts: vi.mocked(readJourney),
    second: journeyArgs("no-schedule"),
    refused: journeyArgs("missed-connection"),
    aside: "Why there is no result",
    invalid: { legs: [] },
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
    const tool = toolOf(c);
    expect(tool.name).toBe(c.tool);
    await expectParity({
      entry: entryOf(c.widget),
      args: await exampleOf(c.slug),
      facts: c.facts,
      tool,
    });
  });

  it("returns what the page computes for a second preset", async () => {
    await expectParity({
      entry: entryOf(c.widget),
      args: c.second,
      facts: c.facts,
      tool: toolOf(c),
    });
  });

  it("explains an input the library refuses in the page's own words", async () => {
    await expectParity({
      entry: entryOf(c.widget),
      args: c.refused,
      facts: c.facts,
      tool: toolOf(c),
      inspect: async (_page: RenderedWidget, result) => {
        const { notes } = okOf(result);
        expect(notes).toHaveLength(1);
        const why = screen.getByRole("complementary", { name: c.aside });
        expect(why).toHaveTextContent(notes[0] as string);
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

describe("compute_time_to_cutoff without a moment", () => {
  it("reads the clock and reports the moment it used", async () => {
    const tool = tools.get("cutoff-countdown") as Tool;
    const result = okOf(
      await tool.execute(
        {
          cutoff: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]",
          timeZone: "Europe/Amsterdam",
        },
        {},
      ),
    );
    const input = result.input as { now?: string };
    expect(input.now).toMatch(/Z$/);
    expect((result.result as { past: boolean }).past).toBe(true);
  });
});
