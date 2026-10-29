import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MIN_FRAMES,
  arrowMoveProblems,
  blockOffSite,
  colorAlpha,
  controlPresence,
  crashProblem,
  dragProblem,
  emptyRunProblem,
  exclusionMatches,
  exclusionProblems,
  focusVisibleProblem,
  isExcluded,
  isOffSite,
  jumpProblems,
  keyboardMoveProblems,
  maxFrameJump,
  motionProblem,
  pageProblems,
  pointerMoveProblems,
  skippedProblem,
  tabWalkPages,
  tabWalkProblems,
  collapseStops,
  obscuredByProblem,
  obscuredMessage,
  SEGMENT_CAP,
  contrastApplied,
  emulationNotAppliedProblem,
  frameDiagnostic,
  px1,
  locatorCountProblem,
  staleRectMessage,
  staleRectProblem,
  waitForFrames,
  transparencyProblems,
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
      matches: RegExp;
      handler: (route: { fulfill: (answer: unknown) => void }) => void;
    }[] = [];
    return {
      routes,
      route: async (
        matches: RegExp,
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
    // A pattern, not a function, so the browser's driver leaves same-site requests alone.
    expect(matches).toBeInstanceOf(RegExp);
    const routed = (url: string) => matches.test(url);
    expect(routed("https://cloudflareinsights.com/cdn-cgi/rum")).toBe(true);
    expect(routed("http://127.0.0.1:4381/tools/")).toBe(false);
    expect(routed("http://127.0.0.1:4381")).toBe(false);
    expect(routed("http://127.0.0.1:4381/_astro/a.js?v=1#x")).toBe(false);
    // Another port, host or scheme is another origin, as `isOffSite` says.
    expect(routed("http://127.0.0.1:43811/")).toBe(true);
    expect(routed("http://127.0.0.1:4382/")).toBe(true);
    expect(routed("http://localhost:4381/")).toBe(true);
    expect(routed("https://127.0.0.1:4381/")).toBe(true);
    // No request, no route.
    expect(routed("data:text/plain,hello")).toBe(false);
    expect(routed("blob:http://127.0.0.1:4381/1f0c")).toBe(false);
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
      "canada-clock-still.mjs",
      "canada-layout-check.mjs",
      "canada-stored-still.mjs",
      "contrast-measure.mjs",
      "data-credits-check.mjs",
      "globe-smoke.mjs",
      "grow-measure.mjs",
      "readout-still.mjs",
      "table-fit.mjs",
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

describe("collapseStops", () => {
  it("folds the segments of one field into a single stop", () => {
    expect(collapseStops(["a", "d", "d", "d", "d", "d", "d", "b"])).toEqual([
      "a",
      "d",
      "b",
    ]);
  });
  it("leaves a run longer than the cap as it came", () => {
    const run = Array<string>(SEGMENT_CAP + 1).fill("d");
    expect(collapseStops(["a", ...run, "b"])).toEqual(["a", ...run, "b"]);
  });
  it("keeps stops on nothing apart", () => {
    expect(collapseStops(["a", null, null, "b"])).toEqual([
      "a",
      null,
      null,
      "b",
    ]);
  });
});

describe("obscuredByProblem", () => {
  it("is clear when any box of a wrapped link is hit", () => {
    expect(
      obscuredByProblem([
        { ok: false, by: "div.gap" },
        { ok: true, by: "a.link" },
      ]),
    ).toBeNull();
  });
  it("names what covers the control when every box is covered", () => {
    expect(
      obscuredByProblem([
        { ok: false, by: "header" },
        { ok: false, by: "nav" },
      ]),
    ).toBe("nav");
  });
  it("is clear with no samples", () => {
    expect(obscuredByProblem([])).toBeNull();
  });
});

describe("tabWalkProblems with date segments", () => {
  it("counts the segments of a date field as one stop", () => {
    const seq = ["a", "d", "d", "d", "d", "d", "d", "b", "c"];
    expect(
      tabWalkProblems({ candidates: ["a", "d", "b", "c"], sequence: seq }),
    ).toEqual([]);
  });
  it("still calls a control that holds focus a trap", () => {
    const run = Array<string>(SEGMENT_CAP + 2).fill("d");
    const found = tabWalkProblems({
      candidates: ["d", "b", "c"],
      sequence: run,
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ rule: "tab-trap", selector: "d" });
  });
});

describe("tabWalkProblems", () => {
  const candidates = ["a", "b", "c"];
  it("passes a walk that reaches every candidate", () => {
    expect(tabWalkProblems({ candidates, sequence: ["a", "b", "c"] })).toEqual(
      [],
    );
  });
  it("ignores stops on nothing and extra stops that are not candidates", () => {
    expect(
      tabWalkProblems({
        candidates,
        sequence: ["a", null, "scroller", "b", "c"],
      }),
    ).toEqual([]);
  });
  it("names a candidate that never took focus", () => {
    const found = tabWalkProblems({ candidates, sequence: ["a", "c"] });
    expect(found).toEqual([
      { rule: "tab-unreached", selector: "b", message: expect.any(String) },
    ]);
  });
  it("reports a trap once, with the unreached count, instead of one finding each", () => {
    const four = ["a", "b", "c", "d"];
    const found = tabWalkProblems({
      candidates: four,
      sequence: ["a", "b", "c", "b"],
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ rule: "tab-trap", selector: "b" });
    expect(found[0].message).toMatch(
      /1 of 4 controls still unreached \(first: d\)/,
    );
  });
  it("calls a wrap to the first stop with candidates unvisited tab-unreached, not a trap", () => {
    const found = tabWalkProblems({ candidates, sequence: ["a", "b", "a"] });
    expect(found).toEqual([
      { rule: "tab-unreached", selector: "c", message: expect.any(String) },
    ]);
  });
  it("lets focus wrap to the start once every candidate has been visited", () => {
    expect(
      tabWalkProblems({ candidates, sequence: ["a", "b", "c", "a"] }),
    ).toEqual([]);
  });
});

describe("tabWalkPages", () => {
  const all = [
    "/reference/types/Z/",
    "/reference/types/A/",
    "/reference/calendar/",
    "/reference/calendar/business/",
    "/reference/calendar/business/nextBusinessDay/",
    "/reference/calendar/business/businessDaysBetween/",
    "/tools/x/",
    "/",
  ];
  it("keeps every page outside /reference/ and one function and one type page", () => {
    expect(tabWalkPages(all)).toEqual([
      "/",
      "/tools/x/",
      "/reference/calendar/business/businessDaysBetween/",
      "/reference/types/A/",
    ]);
  });
  it("copes with a site that has no reference pages", () => {
    expect(tabWalkPages(["/", "/why-gmt/"])).toEqual(["/", "/why-gmt/"]);
  });
});

describe("focusVisibleProblem", () => {
  const rest = {
    outlineStyle: "none",
    outlineWidth: "0px",
    boxShadow: "none",
    borderColor: "rgb(1, 1, 1) rgb(1, 1, 1) rgb(1, 1, 1) rgb(1, 1, 1)",
    backgroundColor: "rgba(0, 0, 0, 0)",
  };
  it("passes a 2px outline", () => {
    expect(
      focusVisibleProblem({
        before: rest,
        after: { ...rest, outlineStyle: "solid", outlineWidth: "2px" },
      }),
    ).toEqual([]);
  });
  it("passes the UA auto ring", () => {
    expect(
      focusVisibleProblem({
        before: rest,
        after: { ...rest, outlineStyle: "auto", outlineWidth: "1px" },
      }),
    ).toEqual([]);
  });
  it("fails a 1px outline with nothing else", () => {
    const found = focusVisibleProblem({
      before: rest,
      after: { ...rest, outlineStyle: "solid", outlineWidth: "1px" },
    });
    expect(found[0].rule).toBe("focus-invisible");
  });
  it("passes a box-shadow that appears, fails one that was already there", () => {
    const shadow = "rgb(0, 0, 0) 0px 0px 4px 0px";
    expect(
      focusVisibleProblem({
        before: rest,
        after: { ...rest, boxShadow: shadow },
      }),
    ).toEqual([]);
    expect(
      focusVisibleProblem({
        before: { ...rest, boxShadow: shadow },
        after: { ...rest, boxShadow: shadow },
      }),
    ).toHaveLength(1);
  });
  it("passes a changed border or background colour", () => {
    expect(
      focusVisibleProblem({
        before: rest,
        after: {
          ...rest,
          borderColor: "rgb(9, 9, 9) rgb(9, 9, 9) rgb(9, 9, 9) rgb(9, 9, 9)",
        },
      }),
    ).toEqual([]);
    expect(
      focusVisibleProblem({
        before: rest,
        after: { ...rest, backgroundColor: "rgb(5, 5, 5)" },
      }),
    ).toEqual([]);
  });
  it("fails when nothing changed", () => {
    expect(focusVisibleProblem({ before: rest, after: rest })).toHaveLength(1);
  });
});

describe("arrowMoveProblems", () => {
  const keys = ["ArrowRight", "ArrowLeft"];
  it("passes a slider that moves and comes back", () => {
    expect(
      arrowMoveProblems({ before: "5", moved: "6", restored: "5", keys }),
    ).toEqual([]);
  });
  it("fails one that ignores the first key", () => {
    expect(
      arrowMoveProblems({ before: "5", moved: "5", restored: "5", keys })[0],
    ).toMatch(/ArrowRight did not change/);
  });
  it("fails one that does not come back", () => {
    expect(
      arrowMoveProblems({ before: "5", moved: "6", restored: "6", keys })[0],
    ).toMatch(/ArrowLeft did not restore 5/);
  });
  it("fails a control with no value", () => {
    expect(
      arrowMoveProblems({ before: null, moved: null, restored: null, keys })[0],
    ).toMatch(/exposes no value/);
  });
});

describe("axe exclusions", () => {
  const entry = {
    rule: "color-contrast",
    selector: ".a",
    pages: ["/tools/x/"],
    reason: "measured 7.1:1 on the real pixels, axe read the gradient as white",
  };
  const hit = { rule: "color-contrast", selector: ".a", page: "/tools/x/" };
  it("matches only when rule, selector and page all match", () => {
    expect(exclusionMatches(entry, hit)).toBe(true);
    expect(exclusionMatches(entry, { ...hit, rule: "label" })).toBe(false);
    expect(exclusionMatches(entry, { ...hit, selector: ".b" })).toBe(false);
    expect(exclusionMatches(entry, { ...hit, page: "/tools/y/" })).toBe(false);
  });
  it('treats "*" as every page', () => {
    expect(
      exclusionMatches(
        { ...entry, pages: ["*"] },
        { ...hit, page: "/anything/" },
      ),
    ).toBe(true);
  });
  it("isExcluded asks every entry", () => {
    expect(isExcluded([], hit)).toBe(false);
    expect(isExcluded([{ ...entry, selector: ".z" }, entry], hit)).toBe(true);
  });
  it("accepts an empty file and a complete entry, and rejects a missing reason", () => {
    expect(exclusionProblems([])).toEqual([]);
    expect(exclusionProblems([entry])).toEqual([]);
    expect(exclusionProblems([{ ...entry, reason: "" }])[0]).toMatch(/reason/);
    expect(exclusionProblems([{ ...entry, pages: [] }])[0]).toMatch(/pages/);
    expect(exclusionProblems({})[0]).toMatch(/array/);
  });
});

describe("colorAlpha", () => {
  it("reads the alpha of the computed colour forms", () => {
    expect(colorAlpha("rgb(1, 2, 3)")).toBe(1);
    expect(colorAlpha("rgba(1, 2, 3, 0.5)")).toBe(0.5);
    expect(colorAlpha("rgb(1 2 3 / 25%)")).toBe(0.25);
    expect(colorAlpha("color(srgb 0.1 0.2 0.3 / 0.92)")).toBe(0.92);
    expect(colorAlpha("oklch(0.5 0.1 200)")).toBe(1);
    expect(colorAlpha("transparent")).toBe(0);
    expect(colorAlpha("rgba(0, 0, 0, 0)")).toBe(0);
  });
  it("returns null for something that is not a colour", () => {
    expect(colorAlpha("")).toBeNull();
    expect(colorAlpha("blue")).toBeNull();
  });
});

describe("transparencyProblems", () => {
  it("passes a flat, nearly opaque element", () => {
    expect(
      transparencyProblems({
        backdropFilter: "none",
        backgroundColor: "rgb(10, 10, 10)",
      }),
    ).toEqual([]);
    expect(
      transparencyProblems({
        backdropFilter: "none",
        backgroundColor: "rgba(10, 10, 10, 0.92)",
      }),
    ).toEqual([]);
  });
  it("names the blur that is still there", () => {
    const found = transparencyProblems({
      backdropFilter: "blur(12px)",
      backgroundColor: "rgb(10, 10, 10)",
    });
    expect(found.map((f) => f.rule)).toEqual(["transparency-blur"]);
  });
  it("names a fill under 0.9", () => {
    const found = transparencyProblems({
      backdropFilter: "none",
      backgroundColor: "rgba(10, 10, 10, 0.4)",
    });
    expect(found.map((f) => f.rule)).toEqual(["transparency-fill"]);
  });
  it("reports both when both fail", () => {
    expect(
      transparencyProblems({
        backdropFilter: "blur(4px)",
        backgroundColor: "rgba(0, 0, 0, 0)",
      }).map((f) => f.rule),
    ).toEqual(["transparency-blur", "transparency-fill"]);
  });
});

describe("motionProblem", () => {
  it("flags a running infinite animation and a long one", () => {
    expect(
      motionProblem({
        playState: "running",
        iterations: Infinity,
        remainingMs: 0,
      }),
    ).toBe(true);
    expect(
      motionProblem({ playState: "running", iterations: 1, remainingMs: 5000 }),
    ).toBe(true);
  });
  it("lets a short or finished animation go", () => {
    expect(
      motionProblem({ playState: "running", iterations: 1, remainingMs: 800 }),
    ).toBe(false);
    expect(
      motionProblem({
        playState: "finished",
        iterations: Infinity,
        remainingMs: 0,
      }),
    ).toBe(false);
    expect(
      motionProblem({
        playState: "paused",
        iterations: Infinity,
        remainingMs: 0,
      }),
    ).toBe(false);
  });
});

describe("waitForFrames", () => {
  it("returns as soon as the state holds", async () => {
    let n = 0;
    const out = await waitForFrames(
      async () => ++n,
      (v: number) => v >= 3,
      { maxMs: 1000, now: () => 0 },
    );
    expect(out).toEqual({ ok: true, frames: 3, last: 3 });
  });

  it("times out with the frame count and the last sample", async () => {
    let clock = 0;
    const out = await waitForFrames(
      async () => "stale",
      () => false,
      { maxMs: 50, now: () => (clock += 20) },
    );
    expect(out.ok).toBe(false);
    expect(out.frames).toBeGreaterThan(1);
    expect(out.last).toBe("stale");
  });
});

describe("emulation not applied", () => {
  it("is applied only when the border matches and no shadow is left", () => {
    expect(
      contrastApplied({ border: "#fff", strong: "#fff", shadowCount: 0 }),
    ).toBe(true);
    expect(
      contrastApplied({ border: "#000", strong: "#fff", shadowCount: 0 }),
    ).toBe(false);
    expect(
      contrastApplied({ border: "#fff", strong: "#fff", shadowCount: 2 }),
    ).toBe(false);
  });

  it("names the frames, the media query and both token values", () => {
    const p = emulationNotAppliedProblem({
      frames: 120,
      matches: false,
      border: "#111",
      strong: "#fff",
      shadowCount: 1,
    });
    expect(p.rule).toBe("emulation-not-applied");
    expect(p.target).toBe("root");
    expect(p.message).toContain("120 animation frames");
    expect(p.message).toContain("is false");
    expect(p.message).toContain("#111");
    expect(p.message).toContain("#fff");
  });
});

describe("px1", () => {
  it("prints one decimal place", () => {
    expect(px1(12)).toBe("12.0");
    expect(px1(12.349)).toBe("12.3");
  });
});

describe("staleRectProblem", () => {
  const rows = (tops: number[], heights: number[]) =>
    tops.map((top, i) => ({ key: `k${i}`, top, height: heights[i] }));

  it("is null when nothing moved past half a pixel", () => {
    expect(
      staleRectProblem(rows([0, 10], [10, 10]), rows([0.4, 10.4], [10, 10])),
    ).toBeNull();
  });

  it("names the element that moved most and the first taller one above it", () => {
    const p = staleRectProblem(
      rows([0, 10, 20], [10, 10, 10]),
      rows([0, 10, 32], [10, 12, 10]),
    );
    expect(p).toMatchObject({ moved: "k2", cause: "k1", countChanged: false });
    expect(p?.largest).toBe(12);
    expect(staleRectMessage(p!)).toContain("k2 shifted 12.0 px");
  });

  it("reports a changed element count", () => {
    const p = staleRectProblem(rows([0], [1]), rows([0, 5], [1, 1]));
    expect(p?.countChanged).toBe(true);
    expect(staleRectMessage(p!)).toContain("more or fewer elements");
  });
});

describe("obscuredMessage and frameDiagnostic", () => {
  it("lists the covering element, the container, the viewport and the breakpoint", () => {
    const message = obscuredMessage("the control", {
      by: "banner › generic",
      byRect: { left: 0, top: 0, width: 100, height: 56 },
      byDisplay: "block",
      byPosition: "fixed",
      byZIndex: "10",
      rect: { left: 4, top: 20, width: 80, height: 24 },
      container: {
        identity: "page",
        rect: { left: 0, top: 0, width: 1000, height: 800 },
        scrollTop: 120.25,
        scrollPaddingBlock: "auto",
      },
      viewport: { width: 1000, height: 800 },
      narrow: false,
    });
    for (const part of [
      "banner › generic",
      "position fixed",
      "z-index 10",
      "scrollTop 120.3",
      "1000x800",
      "false",
    ])
      expect(message).toContain(part);
  });

  it("names the frame, the element, its sizes and the fonts", () => {
    const text = frameDiagnostic({
      index: 7,
      msSinceNavigation: 812.4,
      key: "widget:x › table",
      before: { width: 400, height: 100 },
      after: { width: 400, height: 148.26 },
      fonts: { status: "loading", loaded: ["Mono"] },
    });
    expect(text).toContain("frame 7, 812 ms");
    expect(text).toContain("400.0x100.0 -> 400.0x148.3");
    expect(text).toContain("status loading");
    expect(text).toContain("newly loaded: Mono");
  });
});

describe("locatorCountProblem", () => {
  it("accepts exactly one by default", () => {
    expect(locatorCountProblem("root", 1)).toBeNull();
    expect(locatorCountProblem("root", 0)).toBe(
      "root matched 0 element(s), expected 1",
    );
    expect(locatorCountProblem("root", 2)).toContain("matched 2");
  });

  it("takes a range for an optional control or a list", () => {
    expect(locatorCountProblem("c", 0, { min: 0, max: 1 })).toBeNull();
    expect(locatorCountProblem("c", 3, { min: 1, max: 99 })).toBeNull();
    expect(locatorCountProblem("c", 2, { min: 0, max: 1 })).toBe(
      "c matched 2 element(s), expected 0 to 1",
    );
  });
});
