/**
 * @vitest-environment jsdom
 *
 * The ledger and intermodal tools against their pages. For each page the example, a second preset
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
import { BILLING_PRESETS, billingFacts } from "../billing-deadlines";
import { BL_DATE_PRESETS, readBlDate } from "../bl-date-stamp";
import { DEMURRAGE_PRESETS, readClocks } from "../demurrage-clock";
import { DWELL_PRESETS, dwellFacts } from "../dwell-ledger";
import { EPCIS_PRESETS, readEpcis } from "../epcis-event-reader";
import { FREE_TIME_PRESETS, freeTimeFacts } from "../free-time-ledger";

vi.mock("../billing-deadlines", async (importOriginal) => {
  const real = await importOriginal<typeof import("../billing-deadlines")>();
  return { ...real, billingFacts: vi.fn(real.billingFacts) };
});
vi.mock("../bl-date-stamp", async (importOriginal) => {
  const real = await importOriginal<typeof import("../bl-date-stamp")>();
  return { ...real, readBlDate: vi.fn(real.readBlDate) };
});
vi.mock("../demurrage-clock", async (importOriginal) => {
  const real = await importOriginal<typeof import("../demurrage-clock")>();
  return { ...real, readClocks: vi.fn(real.readClocks) };
});
vi.mock("../dwell-ledger", async (importOriginal) => {
  const real = await importOriginal<typeof import("../dwell-ledger")>();
  return { ...real, dwellFacts: vi.fn(real.dwellFacts) };
});
vi.mock("../epcis-event-reader", async (importOriginal) => {
  const real = await importOriginal<typeof import("../epcis-event-reader")>();
  return { ...real, readEpcis: vi.fn(real.readEpcis) };
});
vi.mock("../free-time-ledger", async (importOriginal) => {
  const real = await importOriginal<typeof import("../free-time-ledger")>();
  return { ...real, freeTimeFacts: vi.fn(real.freeTimeFacts) };
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

/** The fields a preset fills in, and none it leaves blank: the schemas take no empty string. */
const filled = (fields: Args): Args =>
  Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== ""));

const blArgs = (id: string): Args => {
  const p = preset(BL_DATE_PRESETS, id);
  return filled({
    value: p.value,
    event: p.event,
    timeZone: p.timeZone,
    zone2: p.zone2,
    zone3: p.zone3,
    zone4: p.zone4,
    latest: p.latest,
  });
};
const demurrageArgs = (id: string): Args => {
  const p = preset(DEMURRAGE_PRESETS, id);
  return filled({
    events: p.events.map((e) => ({ ...e })),
    scope: p.scope,
    direction: p.direction,
    startEvent: p.startEvent,
    zone: p.zone,
  });
};
const epcisArgs = (id: string): Args => {
  const p = preset(EPCIS_PRESETS, id);
  return filled({
    eventTime: p.eventTime,
    eventTimeZoneOffset: p.eventTimeZoneOffset,
  });
};
const billingArgs = (id: string): Args => {
  const p = preset(BILLING_PRESETS, id);
  return filled({
    anchorOn: p.anchorOn,
    invoiceIssuedOn: p.invoiceIssuedOn,
    requestReceivedOn: p.requestReceivedOn,
    agreedResolutionOn: p.agreedResolutionOn,
    issueDays: Number(p.issueDays),
    disputeDays: Number(p.disputeDays),
    resolutionDays: Number(p.resolutionDays),
  });
};
const dwellArgs = (id: string): Args => {
  const p = preset(DWELL_PRESETS, id);
  return filled({
    entry: p.entry,
    exit: p.exit,
    zone: p.zone,
    compareZone: p.compareZone ?? "",
  });
};
const freeTimeArgs = (id: string): Args => {
  const p = preset(FREE_TIME_PRESETS, id);
  return {
    clockStart: p.clockStart,
    clockEnd: p.clockEnd,
    freeDays: Number(p.freeDays),
    firstDay: p.firstDay,
    basis: p.basis,
    chargeBasis: p.chargeBasis,
    zone: p.zone,
    ...(p.basis === "working" || p.chargeBasis === "working"
      ? {
          weekend: [...p.weekend],
          ...(p.holidays === "" ? {} : { holidays: p.holidays.split("\n") }),
        }
      : {}),
    ...(p.tiers === ""
      ? {}
      : { tiers: p.tiers.split(",").map((t) => Number(t.trim())) }),
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
  /** The label of the page's aside for the refusal. */
  aside: string;
  /** An input the schema refuses. */
  invalid: Args;
}

const cases: Case[] = [
  {
    slug: "bl-date-stamp",
    tool: "compute_bill_of_lading_date",
    widget: "showBlDateStamp",
    facts: vi.mocked(readBlDate),
    second: blArgs("shanghai-morning"),
    refused: { ...blArgs("shanghai-morning"), timeZone: "Nowhere/City" },
    aside: "No result",
    invalid: { value: 5 },
  },
  {
    slug: "demurrage-clock",
    tool: "compute_demurrage_clocks",
    widget: "showDemurrageClock",
    facts: vi.mocked(readClocks),
    second: demurrageArgs("import-detention"),
    refused: {
      events: [{ type: "discharged", at: "2024-06-14T19:00:00Z" }],
      scope: "detention",
      direction: "import",
    },
    aside: "No result",
    invalid: { events: [], scope: "demurrage", direction: "import" },
  },
  {
    slug: "epcis-event-reader",
    tool: "read_epcis_event_time",
    widget: "showEpcisEventReader",
    facts: vi.mocked(readEpcis),
    second: epcisArgs("offsets-disagree"),
    refused: { eventTime: "2024-06-15T23:30:00Z" },
    aside: "Why there is no result",
    invalid: { eventTime: "" },
  },
  {
    slug: "billing-deadlines",
    tool: "compute_billing_deadlines",
    widget: "showBillingDeadlines",
    facts: vi.mocked(billingFacts),
    second: billingArgs("thirty-day-31"),
    refused: { ...billingArgs("thirty-day-30"), anchorOn: "2026-02-30" },
    aside: "Why null",
    invalid: { ...billingArgs("thirty-day-30"), issueDays: -1 },
  },
  {
    slug: "dwell-ledger",
    tool: "compute_dwell_time",
    widget: "showDwellLedger",
    facts: vi.mocked(dwellFacts),
    second: dwellArgs("london-vs-amsterdam"),
    refused: {
      entry: "2024-06-16T00:00:00Z",
      exit: "2024-06-15T00:00:00Z",
      zone: "UTC",
    },
    aside: "Why no result",
    invalid: { entry: 1, exit: "2024-06-15T00:00:00Z", zone: "UTC" },
  },
  {
    slug: "free-time-ledger",
    tool: "compute_free_time_and_demurrage",
    widget: "showFreeTimeLedger",
    facts: vi.mocked(freeTimeFacts),
    second: freeTimeArgs("read-as-next-day"),
    refused: {
      ...freeTimeArgs("friday-three-days"),
      clockEnd: "2024-06-10T00:00:00Z",
    },
    aside: "Why null",
    invalid: { ...freeTimeArgs("friday-three-days"), freeDays: -1 },
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

describe("compute_dwell_time notes", () => {
  const longDwell = {
    entry: "2024-01-01T00:00:00Z",
    exit: "2026-01-01T00:00:00Z",
    zone: "UTC",
  };

  it("says why the dates are not listed for a dwell over the cap", async () => {
    const tool = await loadTool("dwell-ledger");
    const result = okOf(await tool.execute(longDwell, {}));
    expect(result.notes).toEqual([
      "The dwell is longer than 366 days, so its dates are not listed.",
    ]);
    expect((result.result as { touchedDays: unknown }).touchedDays).toBeNull();
  });

  it("gives only the reason when there is no zone to count in", async () => {
    const tool = await loadTool("dwell-ledger");
    const result = okOf(
      await tool.execute({ ...longDwell, zone: "Mars/Olympus" }, {}),
    );
    expect((result.result as { result: unknown }).result).toBeNull();
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).not.toMatch(/longer than/);
  });
});
