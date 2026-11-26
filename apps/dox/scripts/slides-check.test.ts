import {
  UNLOCK_STORAGE_KEY,
  UNLOCK_STORAGE_VALUE,
} from "../src/lib/slides/unlock";
import {
  angularDistance,
  backwardWalk,
  colourDistance,
  DECK_UNLOCK,
  deckRoutes,
  forwardWalk,
  frameStats,
  frameVerdict,
  insideBox,
  isSixteenByNine,
  marginedLayers,
  meanColour,
  paneOffsets,
  parseCentres,
  parsePair,
  sameBox,
  wallMismatches,
} from "./lib/slides-check-helpers.mjs";

const SLIDES = [
  { id: "title", builds: 0 },
  { id: "one-clock", builds: 2 },
  { id: "date", builds: 1 },
];

describe("DECK_UNLOCK", () => {
  it("is the entry the deck reads to open every slide", () => {
    expect(DECK_UNLOCK).toEqual({
      key: UNLOCK_STORAGE_KEY,
      value: UNLOCK_STORAGE_VALUE,
    });
  });
});

describe("deckRoutes", () => {
  it("lists a route per deck folder, sorted", () => {
    expect(deckRoutes(["b-deck", "a-deck"])).toEqual([
      "/slides/a-deck/",
      "/slides/b-deck/",
    ]);
  });
});

describe("the walk through a deck", () => {
  it("shows every build of a slide before the next slide", () => {
    expect(forwardWalk(SLIDES).map((s) => s.hash)).toEqual([
      "#title",
      "#one-clock",
      "#one-clock/1",
      "#one-clock/2",
      "#date",
      "#date/1",
    ]);
  });

  it("walks back through the same states in reverse", () => {
    expect(backwardWalk(SLIDES).map((s) => s.hash)).toEqual(
      forwardWalk(SLIDES)
        .map((s) => s.hash)
        .reverse(),
    );
  });

  it("numbers slides and builds", () => {
    expect(forwardWalk(SLIDES)[3]).toEqual({
      slide: 1,
      build: 2,
      hash: "#one-clock/2",
    });
  });
});

describe("boxes", () => {
  const stage = { x: 0, y: 100, width: 1280, height: 720 };

  it.each([
    [{ x: 10, y: 110, width: 100, height: 50 }, true],
    [{ x: 0, y: 100, width: 1280, height: 720 }, true],
    [{ x: 0, y: 99.5, width: 1280, height: 720 }, true],
    [{ x: -5, y: 110, width: 100, height: 50 }, false],
    [{ x: 1200, y: 110, width: 100, height: 50 }, false],
    [{ x: 10, y: 800, width: 100, height: 50 }, false],
  ])("insideBox %j is %s", (box, inside) => {
    expect(insideBox(box, stage)).toBe(inside);
  });

  it("sameBox allows half a pixel and no more", () => {
    expect(sameBox(stage, { ...stage, y: 100.4 })).toBe(true);
    expect(sameBox(stage, { ...stage, width: 1281 })).toBe(false);
  });

  it("isSixteenByNine accepts rounding and rejects other ratios", () => {
    expect(isSixteenByNine({ width: 1280, height: 720 })).toBe(true);
    expect(isSixteenByNine({ width: 1279, height: 720 })).toBe(true);
    expect(isSixteenByNine({ width: 1280, height: 800 })).toBe(false);
  });
});

describe("angularDistance", () => {
  it("is zero for a point and itself, and a quarter turn along the equator", () => {
    expect(angularDistance([10, 20], [10, 20])).toBeCloseTo(0, 9);
    expect(angularDistance([0, 0], [90, 0])).toBeCloseTo(90, 9);
  });

  it("goes the short way over the antimeridian and over the pole", () => {
    expect(angularDistance([179, 0], [-179, 0])).toBeCloseTo(2, 9);
    expect(angularDistance([0, 89], [180, 89])).toBeCloseTo(2, 9);
  });
});

describe("parsePair", () => {
  it("reads a published pair and refuses anything else", () => {
    expect(parsePair("24.90 -60.20")).toEqual([24.9, -60.2]);
    expect(parsePair("")).toBeNull();
    expect(parsePair(undefined)).toBeNull();
    expect(parsePair("24.9,60")).toBeNull();
  });
});

describe("frameStats", () => {
  it("takes the median of an odd and an even count, and the worst", () => {
    expect(frameStats([16, 40, 17])).toEqual({
      count: 3,
      median: 17,
      worst: 40,
    });
    expect(frameStats([10, 20, 30, 40])).toEqual({
      count: 4,
      median: 25,
      worst: 40,
    });
    expect(frameStats([])).toEqual({ count: 0, median: 0, worst: 0 });
  });
});

describe("frameVerdict", () => {
  /** A refly that resolves to each flight's frame times in turn, and counts the flights. */
  const flights = (...runs: number[][]) =>
    vi.fn(async () => runs.shift() ?? []);

  it("passes a smooth tour without flying any step again", async () => {
    const refly = flights();
    expect(await frameVerdict([16.7, 16.6, 16.8, 17, 33.9], refly)).toBeNull();
    expect(refly).not.toHaveBeenCalled();
  });

  it("names the median when it is over", async () => {
    expect(await frameVerdict([20, 21, 22], flights())).toMatch(
      /median frame took 21\.0 ms/,
    );
  });

  it("clears a worst frame that does not come back in three flights of its step: the runner paused", async () => {
    const refly = flights([16.7, 33.3], [16.7, 16.7], [16.7, 33.4]);
    expect(await frameVerdict([16, 16, 50], refly)).toBeNull();
    expect(refly).toHaveBeenCalledTimes(3);
  });

  it("reports a worst frame that comes back on its step: the deck is slow", async () => {
    const refly = flights([16.7, 16.7], [16.7, 50.1], [16.7]);
    const verdict = await frameVerdict([16, 16, 50], refly);
    expect(verdict).toMatch(/worst frame took 50\.0 ms, over 34/);
    expect(verdict).toMatch(
      /50\.1 ms when that step was flown again \(flight 2 of 3\)/,
    );
    expect(refly).toHaveBeenCalledTimes(2);
  });

  it("reports a worst frame whose step draws no frame when flown again", async () => {
    expect(await frameVerdict([16, 16, 50], flights([]))).toMatch(
      /flying that step again drew no frame/,
    );
  });

  it("fails a tour with no moving frame", async () => {
    expect(await frameVerdict([], flights())).toMatch(/no frame was drawn/);
  });
});

describe("parseCentres", () => {
  it("reads the published pairs in order", () => {
    expect(parseCentres("423.9,184.4 857.1,184.4")).toEqual([
      [423.9, 184.4],
      [857.1, 184.4],
    ]);
  });

  it("is null for nothing or for a malformed pair", () => {
    expect(parseCentres("")).toBeNull();
    expect(parseCentres(undefined)).toBeNull();
    expect(parseCentres("1,2 oops")).toBeNull();
  });
});

describe("meanColour", () => {
  it("averages each channel and ignores alpha", () => {
    expect(meanColour([0, 100, 200, 255, 100, 200, 100, 0])).toEqual([
      50, 150, 150,
    ]);
  });

  it("is null for no pixels", () => {
    expect(meanColour([])).toBeNull();
  });
});

describe("colourDistance", () => {
  it("is the largest channel difference", () => {
    expect(colourDistance([10, 20, 30], [12, 60, 25])).toBe(40);
  });
});

describe("wallMismatches", () => {
  const capture = [100, 150, 200];

  it("passes panes within the tolerance", () => {
    expect(
      wallMismatches([{ id: "a", drawn: [110, 140, 190], capture }]),
    ).toEqual([]);
  });

  it("names the pane whose drawn centre is another colour", () => {
    const bad = wallMismatches([
      { id: "a", drawn: capture, capture },
      { id: "b", drawn: [2, 6, 12], capture },
    ]);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatchObject({ id: "b" });
    expect(bad[0].why).toContain("rgb(2, 6, 12)");
  });

  it("fails a centre that could not be read", () => {
    expect(wallMismatches([{ id: "a", drawn: null, capture }])).toEqual([
      { id: "a", why: "its centre could not be read" },
    ]);
    expect(
      wallMismatches([{ id: "a", drawn: capture, capture: null }]),
    ).toHaveLength(1);
  });
});

describe("paneOffsets", () => {
  it("passes panes drawn on their captions' figures", () => {
    expect(
      paneOffsets(
        ["a", "b"],
        [
          [10, 20],
          [30.6, 40],
        ],
        [
          [10.4, 20],
          [30, 40.9],
        ],
      ),
    ).toEqual([]);
  });

  it("names a pane drawn a rem below its caption", () => {
    expect(paneOffsets(["moment"], [[100, 216]], [[100, 200]])).toEqual([
      {
        id: "moment",
        why: "it is drawn 0.0 px across and 16.0 px down from its caption's figure, over 1",
      },
    ]);
  });

  it("names a pane with no measurement", () => {
    expect(paneOffsets(["a"], [], [[0, 0]])).toEqual([
      { id: "a", why: "its pane or its caption could not be measured" },
    ]);
  });
});

describe("marginedLayers", () => {
  it("passes layers with no margin", () => {
    expect(
      marginedLayers([{ name: "<canvas>", margins: [0, 0, 0, 0] }]),
    ).toEqual([]);
  });

  it("names a layer given Starlight's flow margin", () => {
    expect(
      marginedLayers([
        { name: "<canvas>", margins: [0, 0, 0, 0] },
        { name: "<canvas data-wall-canvas>", margins: [16, 0, 0, 0] },
      ]),
    ).toEqual(["<canvas data-wall-canvas> has a margin of 16 0 0 0 px"]);
  });
});
