import { describe, expect, it } from "vitest";
import {
  MIN_FRAMES,
  controlPresence,
  crashProblem,
  dragProblem,
  emptyRunProblem,
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
