import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BROWSER_LABELS,
  COMPAT_ORIGIN,
  compatFile,
  compatPage,
  compatPaths,
  groupResults,
  runBrowserCompat,
} from "../../../../scripts/lib/native-suite-compat.mjs";
import {
  ENGINE_IDS,
  WORKAROUNDS,
} from "../../../../scripts/lib/workarounds.mjs";

/**
 * The compat check in a browser (#364): the page, the files it may load, the grouping of its
 * results, and the Playwright run with a fake browser. No browser is launched here; the real legs
 * run in the temporal-oracle workflow.
 */

const PATHS = {
  dist: "/repo/packages/gmt/dist",
  polyfill: "export const Temporal = {};\n",
};

/** One passing probe per defect every workaround group names, on the given engine. */
const everyProbe = (over: Partial<{ passes: boolean }> = {}) =>
  WORKAROUNDS.flatMap((w) =>
    w.defects.map((defect) => ({
      defect,
      calendar: "iso8601",
      name: `${defect} probe`,
      output: "spec value",
      passes: true,
      ...over,
    })),
  );

const groupOf = (groups: ReturnType<typeof groupResults>, id: string) => {
  const group = groups.find((g) => g.workaround.defects.join("+") === id);
  if (!group) throw new Error(`no group ${id}`);
  return group;
};

describe("compatPage", () => {
  const page = compatPage();

  it("maps the one specifier the compiled repros import onto the page's own bundle", () => {
    const map = /<script type="importmap">(.*?)<\/script>/s.exec(page);
    if (!map) throw new Error("no import map");
    expect(JSON.parse(map[1])).toEqual({
      imports: { "temporal-polyfill/full/implementation": "/polyfill.js" },
    });
  });

  it("loads the compiled repros and capabilities from the dist prefix and leaves window.__compat", () => {
    expect(page).toContain('import("/dist/internal/temporalCompat/repros.js")');
    expect(page).toContain(
      'import("/dist/internal/temporalCompat/capabilities.js")',
    );
    expect(page).toContain("window.__compat = {\n    results:");
    expect(page).toContain("window.__compat = { error:");
    expect(page.startsWith('<!doctype html>\n<meta charset="utf-8">')).toBe(
      true,
    );
  });
});

describe("compatFile", () => {
  it("serves the in-memory polyfill bundle at its page path", () => {
    expect(compatFile("/polyfill.js", PATHS)).toEqual({
      body: PATHS.polyfill,
      contentType: "text/javascript",
    });
  });

  it("serves nothing at the old jsbi path", () => {
    expect(compatFile("/jsbi.js", PATHS)).toBeNull();
  });

  it("serves a .js file under dist", () => {
    expect(
      compatFile("/dist/internal/temporalCompat/repros.js", PATHS),
    ).toEqual({
      path: "/repo/packages/gmt/dist/internal/temporalCompat/repros.js",
      contentType: "text/javascript",
    });
  });

  it.each`
    pathname                                         | what
    ${"/"}                                           | ${"the page itself"}
    ${"/dist/"}                                      | ${"the dist folder"}
    ${"/dist/internal/temporalCompat/repros.js.map"} | ${"a source map"}
    ${"/dist/package.json"}                          | ${"a file that is not .js"}
    ${"/dist/../package.json"}                       | ${"a path that leaves dist"}
    ${"/dist/..%2Fpackage.js"}                       | ${"an encoded step out of dist"}
    ${"/other.js"}                                   | ${"a .js file outside dist"}
    ${"/repo/packages/gmt/dist/index.js"}            | ${"an absolute path to dist"}
  `("refuses $pathname ($what)", ({ pathname }: { pathname: string }) => {
    expect(compatFile(pathname, PATHS)).toBeNull();
  });
});

describe("compatPaths", () => {
  let root = "";
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "compat-paths-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("throws when dist has no compiled repros", () => {
    expect(() => compatPaths(root)).toThrow(
      "packages/gmt/dist is missing: run pnpm build first",
    );
  });

  it("finds dist and bundles the installed polyfill's full implementation into one file with no imports left", () => {
    const folder = join(root, "packages/gmt/dist/internal/temporalCompat");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "repros.js"), "export const repros = [];\n");
    const paths = compatPaths(root);
    expect(paths.dist).toBe(join(root, "packages/gmt/dist"));
    expect(paths.polyfill).toMatch(/\bexport\s*\{[^}]*\bTemporal\b/);
    expect(paths.polyfill).not.toMatch(/^\s*import[\s"'{]/m);
    expect(paths.polyfill).not.toMatch(/\bfrom\s*["']/);
  });
});

describe("groupResults", () => {
  it("gives one group per workaround in script order, with the repro and output of each probe", () => {
    const groups = groupResults(everyProbe(), "v8");
    expect(groups.map((g) => g.workaround)).toEqual(WORKAROUNDS);
    const d16 = groupOf(groups, "D16");
    expect(d16.results).toEqual([
      {
        repro: { defect: "D16", calendar: "iso8601", name: "D16 probe" },
        output: "spec value",
        passes: true,
      },
    ]);
    expect(d16.passing).toBe(1);
  });

  it("on V8, every passing group is removable except the one-engine groups", () => {
    const groups = groupResults(everyProbe(), "v8");
    const states = Object.fromEntries(
      groups.map((g) => [g.workaround.defects.join("+"), g.state]),
    );
    expect(states.D17).toBe("out-of-scope");
    expect(states.D19).toBe("out-of-scope");
    expect(
      Object.entries(states)
        .filter(([id]) => id !== "D17" && id !== "D19")
        .every(([, state]) => state === "removable"),
    ).toBe(true);
  });

  it("the same results on Firefox make the Firefox-only group removable", () => {
    const groups = groupResults(everyProbe(), ENGINE_IDS.firefox);
    expect(groupOf(groups, "D17").state).toBe("removable");
    expect(groupOf(groups, "D19").state).toBe("out-of-scope");
  });

  it("on WebKit the Firefox-only group is out of scope and the WebKit-only group is removable", () => {
    const groups = groupResults(everyProbe(), ENGINE_IDS.webkit);
    expect(groupOf(groups, "D17").state).toBe("out-of-scope");
    expect(groupOf(groups, "D19").state).toBe("removable");
  });

  it("one failing probe makes its group still needed, on any engine", () => {
    for (const engineId of ["v8", "firefox", "webkit"]) {
      const results = everyProbe().map((r) =>
        r.defect === "D17" ? { ...r, output: "wrong", passes: false } : r,
      );
      const d17 = groupOf(groupResults(results, engineId), "D17");
      expect(d17.state).toBe("still-needed");
      expect(d17.passing).toBe(0);
      expect(d17.results[0].output).toBe("wrong");
    }
  });

  it("a group with no probe in the results is still needed: no evidence is not a pass", () => {
    const results = everyProbe().filter((r) => r.defect !== "D16");
    const d16 = groupOf(groupResults(results, "v8"), "D16");
    expect(d16.results).toEqual([]);
    expect(d16.state).toBe("still-needed");
  });

  it("throws on a repro whose defect no group claims, naming each once", () => {
    const stray = { calendar: "iso8601", name: "x", output: "y", passes: true };
    expect(() =>
      groupResults(
        [
          ...everyProbe(),
          { ...stray, defect: "D99" },
          { ...stray, defect: "D99" },
          { ...stray, defect: "D42" },
        ],
        "v8",
      ),
    ).toThrow(
      "repros with no workaround group in scripts/lib/workarounds.mjs: D99, D42",
    );
  });
});

describe("runBrowserCompat with a fake browser", () => {
  let root = "";
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "compat-run-"));
    const folder = join(root, "packages/gmt/dist/internal/temporalCompat");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "repros.js"), "export const repros = [];\n");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  interface Route {
    request: () => { url: () => string };
    fulfill: (response: Record<string, unknown>) => Promise<void>;
  }

  /** A Playwright stand-in that records what the runner asks of it and answers with `outcome`. */
  const fakePlaywright = (outcome: unknown, version = "1.2.3") => {
    const log: Record<string, unknown>[] = [];
    let handler: ((route: Route) => Promise<void>) | null = null;
    const tab = {
      goto: async (url: string) => log.push({ goto: url }),
      waitForFunction: async (
        fn: () => boolean,
        arg: unknown,
        options: { timeout: number },
      ) => log.push({ waitForFunction: options.timeout }),
      evaluate: async () => outcome,
    };
    const context = {
      route: async (pattern: string, fn: (route: Route) => Promise<void>) => {
        handler = fn;
        log.push({ route: pattern });
      },
      newPage: async () => tab,
    };
    const browser = {
      version: () => version,
      newContext: async (options: unknown) => {
        log.push({ newContext: options });
        return context;
      },
      close: async () => log.push({ close: true }),
    };
    const launcher = { launch: async () => browser };
    return {
      log,
      module: { chromium: launcher, firefox: launcher, webkit: launcher },
      route: (pathname: string) => {
        const fulfilled: Record<string, unknown>[] = [];
        if (!handler) throw new Error("no route was registered");
        return handler({
          request: () => ({ url: () => `${COMPAT_ORIGIN}${pathname}` }),
          fulfill: async (response) => {
            fulfilled.push(response);
          },
        }).then(() => fulfilled[0]);
      },
    };
  };

  it("runs the page in a UTC, en-US context on the virtual origin and returns the leg's verdict", async () => {
    const fake = fakePlaywright({ results: everyProbe() });
    const verdict = await runBrowserCompat("webkit", root, {
      playwright: async () => fake.module,
    });
    expect(verdict).toMatchObject({
      source: "temporal-compat-webkit",
      status: "ran",
      leg: "webkit",
      engine: "WebKit 1.2.3",
      engineId: "webkit",
      runtime: { node: process.version },
    });
    expect(verdict.runtime.polyfill).toMatch(/^\d+\.\d+\.\d+/);
    expect(verdict.runtime.playwright).toMatch(/^\d+\.\d+\.\d+/);
    expect(verdict.counts).toEqual({
      workarounds: WORKAROUNDS.length,
      stillNeeded: 0,
      removable: WORKAROUNDS.length - 1,
      outOfScope: 1,
    });
    expect(verdict.workarounds.find((w) => w.id === "D17")).toMatchObject({
      state: "out-of-scope",
      engines: ["firefox"],
    });
    expect(verdict.workarounds.find((w) => w.id === "D19")).toMatchObject({
      state: "removable",
      engines: ["webkit"],
    });
    expect(fake.log).toEqual([
      { newContext: { timezoneId: "UTC", locale: "en-US" } },
      { route: "http://gmt.local/**" },
      { goto: "http://gmt.local/" },
      { waitForFunction: 60_000 },
      { close: true },
    ]);
  });

  it("names the browser the way the native-suite verdicts do", () => {
    expect(BROWSER_LABELS).toEqual({
      chromium: "Chromium",
      firefox: "Firefox",
      webkit: "WebKit",
    });
  });

  it("answers the page at /, a dist file from disk, and 404 for anything else", async () => {
    const fake = fakePlaywright({ results: everyProbe() });
    await runBrowserCompat("chromium", root, {
      playwright: async () => fake.module,
    });
    const page = await fake.route("/");
    expect(page).toMatchObject({ status: 200, contentType: "text/html" });
    expect(String(page.body)).toBe(compatPage());
    const repros = await fake.route("/dist/internal/temporalCompat/repros.js");
    expect(repros).toMatchObject({
      status: 200,
      contentType: "text/javascript",
    });
    expect(String(repros.body)).toBe("export const repros = [];\n");
    const polyfill = await fake.route("/polyfill.js");
    expect(polyfill).toMatchObject({
      status: 200,
      contentType: "text/javascript",
    });
    expect(String(polyfill.body).length).toBeGreaterThan(1000);
    expect(await fake.route("/dist/../package.json")).toEqual({
      status: 404,
      body: "not found",
    });
    expect(await fake.route("/favicon.ico")).toEqual({
      status: 404,
      body: "not found",
    });
  });

  it("throws the page's error, naming the leg, and still closes the browser", async () => {
    const fake = fakePlaywright({ error: "TypeError: boom\n  at <anonymous>" });
    await expect(
      runBrowserCompat("firefox", root, {
        playwright: async () => fake.module,
      }),
    ).rejects.toThrow(
      "the compat page failed in firefox: TypeError: boom\n  at <anonymous>",
    );
    expect(fake.log.at(-1)).toEqual({ close: true });
  });

  it("throws when Playwright cannot be loaded, before any browser is asked for", async () => {
    await expect(
      runBrowserCompat("chromium", root, {
        playwright: async () => {
          throw new Error("Cannot find package 'playwright'");
        },
      }),
    ).rejects.toThrow(
      "playwright is not installed: Cannot find package 'playwright'",
    );
  });

  it("throws before loading Playwright when dist is missing", async () => {
    rmSync(join(root, "packages"), { recursive: true });
    let loaded = false;
    await expect(
      runBrowserCompat("chromium", root, {
        playwright: async () => {
          loaded = true;
          return fakePlaywright({ results: [] }).module;
        },
      }),
    ).rejects.toThrow("packages/gmt/dist is missing: run pnpm build first");
    expect(loaded).toBe(false);
  });
});
