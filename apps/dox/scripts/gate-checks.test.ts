import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MIN_FRAMES,
  blockOffSite,
  controlPresence,
  crashProblem,
  dragProblem,
  emptyRunProblem,
  isOffSite,
  jumpProblems,
  keyboardMoveProblems,
  maxFrameJump,
  pageProblems,
  pointerMoveProblems,
  skippedProblem,
} from "./gate-checks.mjs";

describe("pageProblems", () => {
  const ok = { status: 200, rootSelector: ".r", rootFound: true, frames: 100 };
  it("passes a 200 page whose root was sampled", () => {
    expect(pageProblems(ok)).toEqual([]);
  });
  it("fails a non-200 response", () => {
    expect(pageProblems({ ...ok, status: 404 })[0]).toMatch(/HTTP 404/);
    expect(pageProblems({ ...ok, status: null })[0]).toMatch(
      /no HTTP response/,
    );
  });
  it("fails a root that matched nothing", () => {
    expect(pageProblems({ ...ok, rootFound: false, frames: 0 })).toEqual([
      "root selector .r matched nothing on the page",
    ]);
  });
  it("fails a measurement with too few frames", () => {
    expect(pageProblems({ ...ok, frames: MIN_FRAMES - 1 })[0]).toMatch(
      /nothing was measured/,
    );
  });
});

describe("skipped interactions and drags", () => {
  it("a skip reason is a failure; no reason is not", () => {
    expect(skippedProblem("the drag", "handle not visible")).toEqual([
      "the drag did not happen: handle not visible",
    ]);
    expect(skippedProblem("the drag", null)).toEqual([]);
  });
  it("a drag that leaves the value alone fails", () => {
    expect(dragProblem("3", "3")).toHaveLength(1);
    expect(dragProblem("3", "9")).toEqual([]);
    expect(dragProblem(null, null)).toEqual([]);
  });
});

describe("jumpProblems", () => {
  it("asserts the page root and <main>, and nothing under reduced motion", () => {
    const base = { limit: 48, reduce: false };
    expect(jumpProblems({ ...base, maxJump: 10, mainMaxJump: 10 })).toEqual([]);
    expect(
      jumpProblems({ ...base, maxJump: 60, mainMaxJump: 10 }),
    ).toHaveLength(1);
    expect(jumpProblems({ ...base, maxJump: 10, mainMaxJump: 60 })[0]).toMatch(
      /<main>/,
    );
    expect(
      jumpProblems({ ...base, reduce: true, maxJump: 900, mainMaxJump: 900 }),
    ).toEqual([]);
  });
});

describe("zero checks", () => {
  it("is never a pass", () => {
    expect(emptyRunProblem(0, "drags")).toMatch(/nothing was checked/);
    expect(emptyRunProblem(3, "drags")).toBeNull();
  });
});

describe("controlPresence", () => {
  it("fails a required control that is absent, skips an optional one", () => {
    expect(
      controlPresence({ visible: false, optional: false, id: "x" }),
    ).toEqual({
      problems: ["x: required control is missing or hidden"],
      proceed: false,
    });
    expect(
      controlPresence({ visible: false, optional: true, id: "x" }),
    ).toEqual({
      problems: [],
      proceed: false,
    });
    expect(
      controlPresence({ visible: true, optional: false, id: "x" }).proceed,
    ).toBe(true);
  });
});

describe("move checks", () => {
  it("fails a keyboard sweep that moves nothing", () => {
    expect(
      keyboardMoveProblems({ home: "0", up: ["0", "0"], down: ["0"] }),
    ).toHaveLength(2);
  });
  it("passes a sweep that goes out and back", () => {
    expect(
      keyboardMoveProblems({
        home: "0",
        up: ["5", "10", "10"],
        down: ["5", "0", "0"],
      }),
    ).toEqual([]);
  });
  it("fails a sweep that never comes back", () => {
    expect(
      keyboardMoveProblems({ home: "0", up: ["5", "5"], down: ["5"] }),
    ).toEqual(["PageDown never moved the value off 5"]);
  });
  it("fails a control with no readable value", () => {
    expect(keyboardMoveProblems({ home: null, up: [], down: [] })).toHaveLength(
      1,
    );
    expect(pointerMoveProblems({ start: null, far: "1" })).toHaveLength(1);
  });
  it("fails a pointer drag that ends where it began", () => {
    expect(pointerMoveProblems({ start: "0", far: "0" })).toHaveLength(1);
    expect(pointerMoveProblems({ start: "0", far: "90" })).toEqual([]);
  });
});

describe("maxFrameJump", () => {
  it("is the largest step between neighbouring frames, up or down", () => {
    expect(maxFrameJump([100, 140, 180, 190])).toBe(40);
    expect(maxFrameJump([500, 100, 100])).toBe(400);
    expect(maxFrameJump([])).toBe(0);
    expect(maxFrameJump([300])).toBe(0);
  });

  it("catches a pop that was painted, and is not fooled by a height that was not", () => {
    // Laid out at 1531 for one sampling task, then pinned back before paint: the
    // painted series never left 1246 until it eased.
    const raw = [1246, 1531, 1246, 1286, 1326];
    const painted = [1246, 1246, 1246, 1286, 1326];
    expect(maxFrameJump(raw)).toBe(285);
    expect(maxFrameJump(painted)).toBe(40);
    // A pop that really was painted is in the painted series, and fails.
    const popped = [1246, 1246, 1531, 1531, 1531];
    expect(maxFrameJump(popped)).toBe(285);
    expect(
      jumpProblems({
        maxJump: maxFrameJump(popped),
        mainMaxJump: maxFrameJump(popped),
        limit: 48,
        reduce: false,
      }),
    ).toHaveLength(2);
    expect(
      jumpProblems({
        maxJump: maxFrameJump(painted),
        mainMaxJump: maxFrameJump(painted),
        limit: 48,
        reduce: false,
      }),
    ).toEqual([]);
  });
});

describe("crashProblem", () => {
  it("turns a thrown error into a failed run with its first line", () => {
    expect(
      crashProblem(
        new Error(
          "page.evaluate: Target page, context or browser has been closed\n  at x",
        ),
      ),
    ).toEqual([
      "the run crashed: page.evaluate: Target page, context or browser has been closed",
    ]);
    expect(crashProblem("boom")).toEqual(["the run crashed: boom"]);
  });
});

describe("isOffSite", () => {
  const base = "http://127.0.0.1:4381";
  it.each`
    url                                                      | expected | why
    ${"http://127.0.0.1:4381/tools/dtm-decoder/"}            | ${false} | ${"a page of the site under test"}
    ${"http://127.0.0.1:4381/_astro/a.js?v=1#x"}             | ${false} | ${"a query and a fragment do not change the origin"}
    ${"https://static.cloudflareinsights.com/beacon.min.js"} | ${true}  | ${"the analytics script"}
    ${"https://cloudflareinsights.com/cdn-cgi/rum"}          | ${true}  | ${"the request that script sends"}
    ${"http://127.0.0.1:4382/"}                              | ${true}  | ${"another port is another origin"}
    ${"http://localhost:4381/"}                              | ${true}  | ${"another host name is another origin"}
    ${"https://127.0.0.1:4381/"}                             | ${true}  | ${"another scheme is another origin"}
    ${"data:text/plain,hello"}                               | ${false} | ${"a data URL makes no request"}
    ${"blob:http://127.0.0.1:4381/1f0c"}                     | ${false} | ${"a blob URL makes no request"}
    ${"about:blank"}                                         | ${false} | ${"about:blank makes no request"}
  `("$url is $expected: $why", ({ url, expected }) => {
    expect(isOffSite(url, base)).toBe(expected);
    // Playwright hands a route predicate a URL object, not a string.
    expect(isOffSite(new URL(url), base)).toBe(expected);
  });

  it("ignores a trailing slash and a path on the base", () => {
    expect(isOffSite("http://127.0.0.1:4381/x", `${base}/`)).toBe(false);
    expect(isOffSite("http://127.0.0.1:4381/x", `${base}/tools/`)).toBe(false);
  });
});

describe("blockOffSite", () => {
  /** A stand-in for a Playwright page or context: it records the one route. */
  const fakeTarget = () => {
    const routes: {
      matches: (url: URL) => boolean;
      handler: (route: { fulfill: (answer: unknown) => void }) => void;
    }[] = [];
    return {
      routes,
      route: async (
        matches: (url: URL) => boolean,
        handler: (route: { fulfill: (answer: unknown) => void }) => void,
      ) => {
        routes.push({ matches, handler });
      },
    };
  };

  it("routes off-site requests only, so a same-site request is never intercepted", async () => {
    const target = fakeTarget();
    await blockOffSite(target, "http://127.0.0.1:4381");
    expect(target.routes).toHaveLength(1);
    const [{ matches }] = target.routes;
    expect(matches(new URL("https://cloudflareinsights.com/cdn-cgi/rum"))).toBe(
      true,
    );
    expect(matches(new URL("http://127.0.0.1:4381/tools/"))).toBe(false);
  });

  it("answers an off-site request with an empty script, and never lets it leave", async () => {
    const target = fakeTarget();
    await blockOffSite(target, "http://127.0.0.1:4381");
    const answers: unknown[] = [];
    target.routes[0].handler({ fulfill: (answer) => answers.push(answer) });
    expect(answers).toEqual([
      { status: 200, contentType: "text/javascript", body: "" },
    ]);
  });
});

describe("every browser gate", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const gates = readdirSync(here)
    .filter((file) => file.endsWith(".mjs"))
    .map((file) => ({
      file,
      source: readFileSync(path.join(here, file), "utf8"),
    }))
    // A gate loads pages of the built site. A script that draws its own markup
    // in a browser (the favicon build) loads none.
    .filter(
      ({ source }) =>
        source.includes('from "@playwright/test"') && source.includes(".goto("),
    );

  it("finds the gates that load a page of the site", () => {
    expect(gates.map(({ file }) => file).sort()).toEqual([
      "contrast-measure.mjs",
      "globe-smoke.mjs",
      "grow-measure.mjs",
      "readout-still.mjs",
      "visual-snapshot.mjs",
    ]);
  });

  // A context covers the pages opened from it. A page opened straight from the
  // browser has a context of its own, so it needs its own call.
  it("each keeps every context and page it opens on the site under test", () => {
    const count = (source: string, pattern: RegExp) =>
      [...source.matchAll(pattern)].length;
    const uncovered = gates
      .map(({ file, source }) => ({
        file,
        opened: count(source, /\bbrowser\.new(?:Context|Page)\(/g),
        blocked: count(source, /\bblockOffSite\(/g),
      }))
      .filter(({ opened, blocked }) => opened === 0 || blocked !== opened);
    expect(uncovered).toEqual([]);
  });
});
