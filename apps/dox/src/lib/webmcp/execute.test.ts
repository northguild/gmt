// @vitest-environment node
/**
 * `executePageTool` is the one run path for WebMCP and MCP. It runs in plain Node here, with no
 * `document`, `window` or `location`, which proves the Worker can call it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { SITE_URL } from "../site";
import { WidgetLoadError } from "../widget-mount";
import {
  definePageTool,
  executePageTool,
  type PageToolDef,
  type PageToolRun,
} from "./page-tool";

const MODULES = import.meta.glob<{ def: PageToolDef }>("./tools/*.ts", {
  eager: true,
});
const DEFS = Object.entries(MODULES).map(([file, mod]) => ({
  slug: file.replace(/^.*\//, "").replace(/\.ts$/, ""),
  def: mod.def,
}));

const controllers: AbortController[] = [];
const controller = (): AbortController => {
  const made = new AbortController();
  controllers.push(made);
  return made;
};
afterEach(() => {
  for (const made of controllers.splice(0)) made.abort();
  vi.restoreAllMocks();
});

describe("executePageTool in Node", () => {
  it("has no browser globals", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof location).toBe("undefined");
  });

  it.each(DEFS)("$slug answers its example", async ({ slug, def }) => {
    const answer = await executePageTool(def, def.example, {
      base: SITE_URL,
      signal: controller().signal,
    });
    expect(answer).toMatchObject({ ok: true, tool: def.name });
    if (answer.ok && answer.link !== undefined) {
      expect(answer.link.startsWith(`${SITE_URL}/tools/${slug}/`)).toBe(true);
    }
    expect(structuredClone(answer)).toEqual(answer);
    expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
  });

  it.each(DEFS)("$slug refuses a wrong first required key", async ({ def }) => {
    const schema = z.toJSONSchema(def.input, { io: "input" }) as {
      required?: string[];
      properties?: Record<string, { type?: string }>;
    };
    const key = schema.required?.[0];
    if (!key) return;
    const wrong = schema.properties?.[key]?.type === "string" ? 42 : "wrong";
    const spy = vi.spyOn(def, "run");
    const answer = await executePageTool(
      def,
      { ...(def.example as object), [key]: wrong },
      { base: SITE_URL, signal: controller().signal },
    );
    expect(answer).toMatchObject({ ok: false, error: "invalid-input" });
    if (!answer.ok && answer.error === "invalid-input") {
      expect(answer.issues.map((issue) => issue.path)).toContain(key);
    }
    expect(spy).not.toHaveBeenCalled();
  });
});

const input = z.object({ n: z.number() });
const make = (run: (args: { n: number }) => Promise<PageToolRun<unknown>>) =>
  definePageTool({
    page: "x",
    name: "check_x",
    title: "X",
    doxTool: "showCutoffRuler",
    returns: "x",
    calls: ["f"],
    input,
    example: { n: 1 },
    run,
  });

describe("executePageTool failures", () => {
  it("resolves unavailable for a WidgetLoadError", async () => {
    const def = make(async () => {
      throw new WidgetLoadError(new Error("zones failed to load"));
    });
    const answer = await executePageTool(
      def,
      { n: 1 },
      { base: SITE_URL, signal: controller().signal },
    );
    expect(answer).toEqual({
      ok: false,
      tool: "check_x",
      error: "unavailable",
      message: "The library for this widget could not be loaded.",
    });
  });

  it("rejects with signal.reason when already aborted", async () => {
    const def = make(async () => ({ input: {}, result: 1, notes: [] }));
    const made = controller();
    const reason = new Error("stop");
    made.abort(reason);
    await expect(
      executePageTool(def, { n: 1 }, { base: SITE_URL, signal: made.signal }),
    ).rejects.toBe(reason);
  });

  it("rethrows any other error", async () => {
    const def = make(async () => {
      throw new RangeError("boom");
    });
    await expect(
      executePageTool(
        def,
        { n: 1 },
        { base: SITE_URL, signal: controller().signal },
      ),
    ).rejects.toThrow("boom");
  });

  it("checkJson rejects a result that is not JSON safe", async () => {
    const def = make(async () => ({
      input: {},
      result: Number.NaN,
      notes: [],
    }));
    await expect(
      executePageTool(
        def,
        { n: 1 },
        { base: SITE_URL, signal: controller().signal, checkJson: true },
      ),
    ).rejects.toThrow("JSON round trip");
  });
});
