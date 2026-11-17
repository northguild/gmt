/**
 * @vitest-environment jsdom
 *
 * The pilot tool against its page: the same facts the Cut-off Ruler computes for a preset come
 * back from `check_eta_against_cutoff`, and a refusal reads the way the page reads it.
 */
import { screen } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectParity, fakeModelContext } from "~/test/webmcp-parity";
import { RULER_PRESETS, collectRulerFacts } from "../cutoff-ruler";
import { offerPageTool, WEBMCP_MARKER } from "./offer";

vi.mock("../cutoff-ruler", async (importOriginal) => {
  const real = await importOriginal<typeof import("../cutoff-ruler")>();
  return { ...real, collectRulerFacts: vi.fn(real.collectRulerFacts) };
});

installJsdomShims();

const entry = WIDGET_REGISTRY["showCutoffRuler"] as AnyWidgetEntry;
const facts = vi.mocked(collectRulerFacts);

const argsOf = (id: string) => {
  const p = RULER_PRESETS.find((preset) => preset.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return {
    anchor: p.anchor,
    timeZone: p.timeZone,
    days: Number(p.days),
    atLocalTime: p.atLocalTime,
  };
};

let tool: Awaited<ReturnType<typeof loadTool>>;
async function loadTool() {
  return (await import("./tools/cutoff-ruler")).default;
}

beforeEach(async () => {
  tool = await loadTool();
});

describe("check_eta_against_cutoff against the Cut-off Ruler", () => {
  it("returns what the page computes for its first preset", async () => {
    const { def } = await import("./tools/cutoff-ruler");
    await expectParity({
      entry,
      args: def.example as Record<string, unknown>,
      facts,
      tool,
    });
  });

  it("returns what the page computes for a second preset", async () => {
    await expectParity({ entry, args: argsOf("amsterdam-june"), facts, tool });
  });

  it("explains a reading the library refuses in the page's own words", async () => {
    await expectParity({
      entry,
      args: argsOf("skipped-hour"),
      facts,
      tool,
      inspect: async (_page, result) => {
        if (!result.ok) throw new Error("expected ok");
        expect(result.notes).toHaveLength(1);
        const why = screen.getByRole("complementary", {
          name: "Why NO SIGNAL",
        });
        expect(why).toHaveTextContent(result.notes[0] as string);
      },
    });
  });

  it("resolves invalid-input for arguments the schema refuses", async () => {
    const result = await tool.execute({ days: "many" }, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid-input");
  });

  it("registers through offerPageTool on a page that names it, and the registered tool runs", async () => {
    const fake = fakeModelContext();
    const controller = new AbortController();
    const doc = document.implementation.createHTMLDocument("");
    const meta = doc.createElement("meta");
    meta.name = WEBMCP_MARKER;
    meta.content = "cutoff-ruler";
    doc.head.append(meta);
    Object.defineProperty(doc, "modelContext", { value: fake.context });
    try {
      const outcome = await offerPageTool(
        "cutoff-ruler",
        () => import("./tools/cutoff-ruler"),
        {
          doc,
          signal: controller.signal,
        },
      );
      expect(outcome).toBe("registered");
      const registered = fake.tools.get("check_eta_against_cutoff");
      expect(registered).toBeDefined();
      const result = await registered?.execute(argsOf("amsterdam-june"), {});
      expect(result?.ok).toBe(true);
    } finally {
      controller.abort();
    }
    expect(fake.tools.size).toBe(0);
  });
});
