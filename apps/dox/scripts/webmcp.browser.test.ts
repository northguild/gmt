import { readdirSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import {
  chromium,
  webkit,
  type Browser,
  type BrowserContext,
  type BrowserType,
  type Page,
} from "@playwright/test";
import { distDirOrSkip } from "./dist-dir";
import { serveStatic } from "./lib/static-server.mjs";
import type { PageToolDef } from "../src/lib/webmcp/page-tool";

/**
 * WebMCP on the built site, in a real browser.
 *
 * Absent mode (the browsers' own state: no model context) runs on every tool page. The page must
 * mount, log nothing, and load no zod: a browser without WebMCP fetches no new chunk. Fake mode
 * defines `document.modelContext` before the page's scripts run and checks that each tool page
 * registers its one tool, which then answers. The tools are every module in `src/lib/webmcp/tools`,
 * found when the file runs, so a slice that adds a module is covered with no edit here.
 *
 * A browser that really ships WebMCP (Chrome behind a flag or the trial) is an owner check; here
 * the platform is the fake in `FAKE_MODEL_CONTEXT`.
 */

const dist = distDirOrSkip();
const ENGINES: [string, BrowserType][] = [
  ["chromium", chromium],
  ["webkit", webkit],
];

/** The folders of `dist/gmt/tools`, minus none: the index page is a folder too and is skipped. */
const SLUGS =
  dist === null
    ? []
    : readdirSync(join(dist, "gmt", "tools"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

/** Runs before any page script: a configurable getter, as the platform defines it on `Document`. */
const FAKE_MODEL_CONTEXT = `
  (() => {
    const tools = [];
    window.__webmcp = tools;
    Object.defineProperty(Document.prototype, "modelContext", {
      configurable: true,
      get() {
        return {
          registerTool(tool) {
            if (tools.some((t) => t.name === tool.name)) {
              return Promise.reject(new DOMException("duplicate", "InvalidStateError"));
            }
            tools.push(tool);
            return Promise.resolve();
          },
        };
      },
    });
  })();
`;

/**
 * Every tool module's definition. The folder is read when the file runs, not by
 * `import.meta.glob`: Vitest's module cache keys a glob on this file's text, so a module added
 * later would be left out until this file changed.
 */
const TOOLS_DIR = resolve(import.meta.dirname, "../src/lib/webmcp/tools");
const TOOL_FILES = readdirSync(TOOLS_DIR)
  .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
  .sort();
const TOOLS: PageToolDef[] = (
  await Promise.all(
    TOOL_FILES.map(
      async (file) =>
        ((await import(join(TOOLS_DIR, file))) as { def: PageToolDef }).def,
    ),
  )
).sort((a, b) => a.page.localeCompare(b.page));

// Each module is named for its page, so the folder listing is the list of pages tested.
it("tests every tool module in the folder", () => {
  expect(TOOLS.length).toBeGreaterThan(0);
  expect(TOOLS.map((tool) => tool.page).sort()).toEqual(
    TOOL_FILES.map((file) => file.slice(0, -".ts".length)),
  );
});

let server: Server | undefined;

beforeAll(async () => {
  if (dist === null) return;
  server = (await serveStatic(resolve(dist), 0)) as Server;
});

afterAll(async () => {
  await new Promise<void>((done) =>
    server ? server.close(() => done()) : done(),
  );
});

function base(): string {
  if (server === undefined) throw new Error("no server");
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/gmt`;
}

/**
 * Noise the pages make with or without WebMCP: a ResizeObserver notice, WebGPU finding no adapter
 * in a headless browser, and the browser's own line for a third-party resource that did not load.
 * A same-origin response or request that fails is still a problem (below), so a missing chunk is
 * not hidden.
 */
const KNOWN_NOISE = [
  /ResizeObserver loop/,
  /No available adapters/,
  /^Failed to load resource/,
];

/** Third parties (analytics, remote fonts) are cut off: slower to fail than to serve, and not ours. */
async function sameOriginOnly(context: BrowserContext, origin: string) {
  await context.route(
    (url) => /^https?:$/.test(url.protocol) && !url.href.startsWith(origin),
    (route) => route.abort(),
  );
}

/** Script bodies the page fetched, and what it logged. */
function watch(page: Page, origin: string) {
  const bodies: Promise<string>[] = [];
  const problems: string[] = [];
  const note = (text: string) => {
    if (!KNOWN_NOISE.some((noise) => noise.test(text))) problems.push(text);
  };
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      bodies.push(response.text().catch(() => ""));
    }
    if (response.url().startsWith(origin) && response.status() >= 400) {
      problems.push(`${response.status()} ${response.url()}`);
    }
  });
  // The browser words a network failure as "Failed to load resource", which KNOWN_NOISE hides for
  // third parties. A same-origin request that fails with no status is caught here.
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(origin)) {
      problems.push(`request failed ${request.url()}`);
    }
  });
  page.on("pageerror", (error) => note(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) note(message.text());
  });
  return {
    problems,
    scripts: async () => (await Promise.all(bodies)).join("\n"),
  };
}

describe.each(ENGINES)("WebMCP on the built site in %s", (_name, type) => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (dist !== null) browser = await type.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it("has tool pages to check", () => {
    if (dist === null) return;
    expect(SLUGS.length).toBeGreaterThan(1);
  });

  describe("without a model context", () => {
    it.concurrent.each(SLUGS)(
      "%s mounts, logs nothing and loads no zod",
      { timeout: 60_000 },
      async (slug) => {
        if (browser === undefined || server === undefined) return;
        const context = await browser.newContext();
        try {
          await sameOriginOnly(context, base());
          const page = await context.newPage();
          const seen = watch(page, base());
          await page.goto(`${base()}/tools/${slug}/`, {
            waitUntil: "networkidle",
            timeout: 60_000,
          });
          const state = await page.evaluate(() => ({
            roots: document.querySelectorAll("[data-widget]").length,
            unavailable: document.querySelectorAll('[data-state="unavailable"]')
              .length,
          }));
          expect(state.roots).toBeGreaterThan(0);
          expect(state.unavailable).toBe(0);
          expect(seen.problems).toEqual([]);
          expect(await seen.scripts()).not.toContain("ZodError");
        } finally {
          await context.close();
        }
      },
    );
  });

  describe("with a model context", () => {
    /** Loads a tool's page with the fake platform and calls its tool. */
    async function callTool(tool: PageToolDef) {
      if (browser === undefined || server === undefined) return null;
      const context = await browser.newContext();
      try {
        await sameOriginOnly(context, base());
        await context.addInitScript(FAKE_MODEL_CONTEXT);
        const page = await context.newPage();
        const seen = watch(page, base());
        await page.goto(`${base()}/tools/${tool.page}/`, {
          waitUntil: "networkidle",
          timeout: 60_000,
        });
        await page.waitForFunction(
          () =>
            (window as unknown as { __webmcp: unknown[] }).__webmcp.length > 0,
        );
        const summary = await page.evaluate(
          async ({ example }) => {
            const tools = (window as unknown as { __webmcp: any[] }).__webmcp;
            const registered = tools[0];
            const ok = await registered.execute(example, {});
            const empty = await registered.execute({}, {});
            return {
              count: tools.length,
              name: registered.name,
              schemaType: registered.inputSchema.type,
              annotations: registered.annotations,
              ok,
              empty,
              json: JSON.parse(JSON.stringify(ok)),
            };
          },
          { example: tool.example },
        );
        return { summary, seen, scripts: await seen.scripts() };
      } finally {
        await context.close();
      }
    }

    it.concurrent.each(TOOLS.map((tool) => [tool.page, tool] as const))(
      "%s registers its one tool, which answers its example",
      { timeout: 60_000 },
      async (_slug, tool) => {
        const run = await callTool(tool);
        if (run === null) return;
        const { summary, seen } = run;
        expect(summary.count).toBe(1);
        expect(summary.name).toBe(tool.name);
        expect(summary.schemaType).toBe("object");
        expect(summary.annotations).toEqual({ readOnlyHint: true });
        expect(summary.ok.ok).toBe(true);
        expect(summary.json).toEqual(summary.ok);
        // An empty call is refused only by a schema with a required key.
        if (!tool.input.safeParse({}).success) {
          expect(summary.empty.ok).toBe(false);
          expect(summary.empty.error).toBe("invalid-input");
        }
        expect(seen.problems).toEqual([]);
      },
    );

    // The control for the absent-mode check, once for each engine: the zod chunk really does load
    // when a model context is there, so "loads no zod" above is not vacuous.
    it(
      "loads the zod chunk when a model context is there",
      { timeout: 60_000 },
      async () => {
        const first = TOOLS[0];
        if (first === undefined) throw new Error("no tool modules");
        const run = await callTool(first);
        if (run === null) return;
        expect(run.scripts).toContain("ZodError");
      },
    );
  });
});
