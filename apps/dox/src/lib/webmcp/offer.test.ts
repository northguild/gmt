import { offerPageTool, offerPageTools, WEBMCP_MARKER } from "./offer";
import type { ModelContextToolInit } from "./model-context";

const as = <T>(value: unknown): T => value as T;

const TOOL: ModelContextToolInit = {
  name: "check_example",
  title: "Example",
  description: "An example.",
  inputSchema: { type: "object" },
  annotations: { readOnlyHint: true },
  execute: async () => ({
    ok: true,
    tool: "check_example",
    input: {},
    result: null,
    notes: [],
  }),
};

/** A document whose head holds a marker naming `slug`, or none. */
function documentWith(slug: string | null, modelContext?: unknown): Document {
  return as<Document>({
    head: {
      querySelector: (selector: string) =>
        slug !== null && selector === `meta[name="${WEBMCP_MARKER}"]`
          ? {
              getAttribute: (name: string) =>
                name === "content" ? slug : null,
            }
          : null,
    },
    modelContext,
  });
}

const navigatorOf = (modelContext?: unknown) => as<Navigator>({ modelContext });

describe("offerPageTool", () => {
  it("registers the module's tool and passes the signal on", async () => {
    const registerTool = vi.fn();
    const signal = new AbortController().signal;
    const load = vi.fn(async () => ({ default: TOOL }));
    const outcome = await offerPageTool("cutoff-ruler", load, {
      doc: documentWith("cutoff-ruler", { registerTool }),
      nav: navigatorOf(),
      signal,
    });
    expect(outcome).toBe("registered");
    expect(registerTool).toHaveBeenCalledExactlyOnceWith(TOOL, { signal });
  });

  it("awaits a registration that returns a promise", async () => {
    let settled = false;
    const registerTool = vi.fn(async () => {
      await Promise.resolve();
      settled = true;
    });
    await offerPageTool("a-page", async () => ({ default: TOOL }), {
      doc: documentWith("a-page", { registerTool }),
      nav: navigatorOf(),
    });
    expect(settled).toBe(true);
  });

  it.each([
    ["no marker", null],
    ["a marker naming another page", "other-page"],
  ])("skips with %s, and loads nothing", async (_label, marker) => {
    const registerTool = vi.fn();
    const load = vi.fn(async () => ({ default: TOOL }));
    const outcome = await offerPageTool("cutoff-ruler", load, {
      doc: documentWith(marker, { registerTool }),
      nav: navigatorOf(),
    });
    expect(outcome).toBe("skipped");
    expect(load).not.toHaveBeenCalled();
    expect(registerTool).not.toHaveBeenCalled();
  });

  it("reports absent, and loads nothing, when the browser has no model context", async () => {
    const load = vi.fn(async () => ({ default: TOOL }));
    const outcome = await offerPageTool("cutoff-ruler", load, {
      doc: documentWith("cutoff-ruler"),
      nav: navigatorOf(),
    });
    expect(outcome).toBe("absent");
    expect(load).not.toHaveBeenCalled();
  });

  it("skips a slug already offered to the same document", async () => {
    const registerTool = vi.fn();
    const doc = documentWith("cutoff-ruler", { registerTool });
    const load = async () => ({ default: TOOL });
    const first = await offerPageTool("cutoff-ruler", load, {
      doc,
      nav: navigatorOf(),
    });
    const second = await offerPageTool("cutoff-ruler", load, {
      doc,
      nav: navigatorOf(),
    });
    expect([first, second]).toEqual(["registered", "skipped"]);
    expect(registerTool).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "a duplicate name",
      () => {
        throw new DOMException("exists", "InvalidStateError");
      },
      "InvalidStateError",
    ],
    [
      "a policy refusal",
      async () => {
        throw new DOMException("no", "NotAllowedError");
      },
      "NotAllowedError",
    ],
  ])(
    "fails quietly, warning once, on %s",
    async (_label, registerTool, name) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const outcome = await offerPageTool(
        "cutoff-ruler",
        async () => ({ default: TOOL }),
        {
          doc: documentWith("cutoff-ruler", { registerTool }),
          nav: navigatorOf(),
        },
      );
      expect(outcome).toBe("failed");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain(TOOL.name);
      expect(warn.mock.calls[0]?.[0]).toContain(name);
    },
  );

  it("fails quietly when the chunk does not load", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const outcome = await offerPageTool(
      "cutoff-ruler",
      () => Promise.reject(new TypeError("Failed to fetch")),
      {
        doc: documentWith("cutoff-ruler", { registerTool: vi.fn() }),
        nav: navigatorOf(),
      },
    );
    expect(outcome).toBe("failed");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("offerPageTools", () => {
  const SECOND: ModelContextToolInit = { ...TOOL, name: "check_other" };

  it("registers each tool of one marker once, with the signal", async () => {
    const registerTool = vi.fn();
    const signal = new AbortController().signal;
    const doc = documentWith("slides/a-deck", { registerTool });
    const load = vi.fn(async () => ({ default: [TOOL, SECOND] }));
    const first = await offerPageTools("slides/a-deck", load, {
      doc,
      nav: navigatorOf(),
      signal,
    });
    const second = await offerPageTools("slides/a-deck", load, {
      doc,
      nav: navigatorOf(),
      signal,
    });
    expect([first, second]).toEqual(["registered", "skipped"]);
    expect(registerTool.mock.calls).toEqual([
      [TOOL, { signal }],
      [SECOND, { signal }],
    ]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("skips a marker naming another page, and loads nothing", async () => {
    const load = vi.fn(async () => ({ default: [TOOL] }));
    const outcome = await offerPageTools("slides/a-deck", load, {
      doc: documentWith("tools/x", { registerTool: vi.fn() }),
      nav: navigatorOf(),
    });
    expect(outcome).toBe("skipped");
    expect(load).not.toHaveBeenCalled();
  });

  it("names the tool that was refused when a later one fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const registerTool = vi.fn((tool: ModelContextToolInit) => {
      if (tool.name === SECOND.name)
        throw new DOMException("exists", "InvalidStateError");
    });
    const outcome = await offerPageTools(
      "slides/a-deck",
      async () => ({ default: [TOOL, SECOND] }),
      {
        doc: documentWith("slides/a-deck", { registerTool }),
        nav: navigatorOf(),
      },
    );
    expect(outcome).toBe("failed");
    expect(warn.mock.calls[0]?.[0]).toContain(SECOND.name);
    warn.mockRestore();
  });
});
