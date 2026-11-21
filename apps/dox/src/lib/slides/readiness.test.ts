// @vitest-environment jsdom
import { runReadiness, type ReadinessOptions } from "./readiness";
import { chatRow } from "./readiness-chat";
import { readDeckAssets } from "./readiness-files";
import { rowOrder, type ReadinessRow } from "./readiness-rows";
import type { AssetRow } from "./stage-data";

/** A deck's own file list, as its stage data would name it. */
const WALL: readonly AssetRow[] = [
  {
    id: "wall",
    label: "Wall images",
    selector: "[data-wall-pane] img",
    attribute: "src",
    none: "No wall images listed",
  },
];

const DECK = "https://example.test/gmt/slides/talk/";
const DECK_HTML = `<!doctype html><head>
  <link rel="preload" as="fetch" href="/gmt/_astro/sky.bin">
  <link rel="preload" as="image" href="/gmt/slides/talk/wall/a.webp">
  <link rel="preload" as="fetch" href="/gmt/earth.webp">
</head><body>
  <figure data-wall-pane="a"><img src="/gmt/slides/talk/wall/a.webp" alt="A"></figure>
  <figure data-wall-pane="b"><img src="/gmt/slides/talk/wall/b.webp" alt="B"></figure>
  <div data-recording-src="/gmt/slides/talk/recorded/ask.json"></div>
</body>`;

const BRAINS_OK = {
  visitor: { unlimited: true },
  brains: [
    { state: "spent", remaining: 0 },
    { state: "ok", remaining: 12 },
  ],
};

let controller: AbortController;
beforeEach(() => {
  controller = new AbortController();
});
afterEach(() => {
  controller.abort();
  vi.unstubAllGlobals();
});

/** Stubs `fetch`: `answers` maps an address to a status; anything not listed fails to connect. */
function stubFetch(answers: Record<string, number | object>) {
  const calls: { url: string; cache?: RequestCache }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, cache: init?.cache });
      const answer = answers[url];
      if (answer === undefined) throw new TypeError("offline");
      if (typeof answer === "number")
        return new Response(url === DECK ? DECK_HTML : "x", { status: answer });
      return new Response(JSON.stringify(answer), { status: 200 });
    }),
  );
  return calls;
}

const ALL_OK = {
  [DECK]: 200,
  "https://example.test/gmt/_astro/sky.bin": 200,
  "https://example.test/gmt/earth.webp": 200,
  "https://example.test/gmt/slides/talk/wall/a.webp": 200,
  "https://example.test/gmt/slides/talk/wall/b.webp": 200,
  "https://example.test/gmt/slides/talk/recorded/ask.json": 200,
  "https://example.test/gmt/api/brains": BRAINS_OK,
};

function options(over: Partial<ReadinessOptions> = {}): ReadinessOptions {
  return {
    signal: controller.signal,
    deckUrl: DECK,
    brainsUrl: "https://example.test/gmt/api/brains",
    env: { renderer: "webgpu", reducedMotion: false, fullscreen: true },
    fonts: ["1em Michroma"],
    fontSet: { check: () => true },
    assetRows: WALL,
    modules: [{ name: "unix/get", load: async () => ({}) }],
    ...over,
  };
}

const byId = (rows: readonly ReadinessRow[], id: string) =>
  rows.find((r) => r.id === id)!;

describe("readDeckAssets", () => {
  it("lists preloads, wall images and recordings once each, as absolute addresses", () => {
    const assets = readDeckAssets(DECK_HTML, DECK, WALL);
    expect(assets.rows["wall"]).toEqual([
      "https://example.test/gmt/slides/talk/wall/a.webp",
      "https://example.test/gmt/slides/talk/wall/b.webp",
    ]);
    expect(assets.recordings).toEqual([
      "https://example.test/gmt/slides/talk/recorded/ask.json",
    ]);
    expect(assets.preloads).toEqual([
      "https://example.test/gmt/_astro/sky.bin",
      "https://example.test/gmt/earth.webp",
    ]);
  });

  it("lists nothing for markup with nothing in it", () => {
    expect(readDeckAssets("", DECK, WALL)).toEqual({
      preloads: [],
      rows: { wall: [] },
      recordings: [],
    });
  });
});

describe("chatRow", () => {
  it("is ready with a dev cookie and a brain that has allowance", () => {
    expect(chatRow(BRAINS_OK)).toMatchObject({ status: "ok" });
  });

  it("says the demos will play their recordings without the unlimited flag", () => {
    const r = chatRow({ ...BRAINS_OK, visitor: { unlimited: false } });
    expect(r.status).toBe("failed");
    expect(r.text).toContain("the demos will play their recordings");
  });

  it("says so when every brain is spent, and for an unreadable answer", () => {
    const spent = chatRow({
      visitor: { unlimited: true },
      brains: [{ state: "spent", remaining: 0 }],
    });
    expect(spent.text).toContain("no brain has allowance left");
    expect(chatRow(null).text).toContain(
      "the demos will play their recordings",
    );
  });
});

describe("runReadiness", () => {
  it("passes every row on a warm load, in order, fetching from the cache", async () => {
    const calls = stubFetch(ALL_OK);
    const heard: string[] = [];
    const rows = await runReadiness(
      options({ onRow: (r) => heard.push(r.id) }),
    );
    expect(rows.map((r) => r.id)).toEqual(rowOrder(WALL));
    expect(rows.filter((r) => r.status === "failed")).toEqual([]);
    expect(heard.sort()).toEqual(rowOrder(WALL).sort());
    expect(byId(rows, "wall").text).toBe("Loaded: 2 files");
    expect(byId(rows, "renderer").text).toBe("WebGPU");
    for (const call of calls.filter((c) => !c.url.endsWith("/api/brains")))
      expect(call.cache).toBe("force-cache");
  });

  it("names a failed file in words and never relies on colour", async () => {
    stubFetch({
      ...ALL_OK,
      "https://example.test/gmt/slides/talk/wall/b.webp": 404,
    });
    const rows = await runReadiness(options());
    const wall = byId(rows, "wall");
    expect(wall.status).toBe("failed");
    expect(wall.text).toBe(
      "Failed: retry on venue Wi-Fi. 1 of 2 did not load: b.webp",
    );
  });

  it("fails every file row when the deck page itself is unreachable", async () => {
    stubFetch({ "https://example.test/gmt/api/brains": BRAINS_OK });
    const rows = await runReadiness(options());
    for (const id of ["preloads", "wall", "recordings"])
      expect(byId(rows, id).text).toContain("the deck page did not load");
    expect(byId(rows, "chat").status).toBe("ok");
  });

  it("gives the recordings row to a brains answer without `unlimited`", async () => {
    stubFetch({
      ...ALL_OK,
      "https://example.test/gmt/api/brains": {
        ...BRAINS_OK,
        visitor: { unlimited: false },
      },
    });
    const rows = await runReadiness(options());
    expect(byId(rows, "chat").text).toMatch(
      /^Failed: the demos will play their recordings/,
    );
  });

  it("reports an offline chat as a failure that never blocks the other rows", async () => {
    const { "https://example.test/gmt/api/brains": _gone, ...rest } = ALL_OK;
    stubFetch(rest);
    const rows = await runReadiness(options());
    expect(byId(rows, "chat").status).toBe("failed");
    expect(byId(rows, "preloads").status).toBe("ok");
  });

  it("fails the three deck rows when no deck window has reported", async () => {
    stubFetch(ALL_OK);
    const rows = await runReadiness(options({ env: null }));
    for (const id of ["renderer", "motion", "fullscreen"])
      expect(byId(rows, id).status).toBe("failed");
  });

  it("says what the deck window reported for motion and fullscreen", async () => {
    stubFetch(ALL_OK);
    const rows = await runReadiness(
      options({
        env: { renderer: "sky", reducedMotion: true, fullscreen: false },
      }),
    );
    expect(byId(rows, "renderer").text).toContain("sky only");
    expect(byId(rows, "motion").text).toContain("Reduced motion is on");
    expect(byId(rows, "fullscreen").text).toContain("not fullscreen");
  });

  it("fails fonts and modules that did not load, naming them", async () => {
    stubFetch(ALL_OK);
    const rows = await runReadiness(
      options({
        fontSet: { check: () => false },
        modules: [
          { name: "unix/get", load: async () => ({}) },
          {
            name: "zoned/format",
            load: async () => Promise.reject(new Error("x")),
          },
        ],
      }),
    );
    expect(byId(rows, "fonts").text).toContain("1em Michroma");
    expect(byId(rows, "modules").text).toContain("zoned/format");
    expect(byId(rows, "modules").text).not.toContain("unix/get");
  });

  it("loads a face the page has not used yet before it calls the font missing", async () => {
    stubFetch(ALL_OK);
    let loaded = false;
    const rows = await runReadiness(
      options({
        fontSet: {
          check: () => loaded,
          load: async () => {
            loaded = true;
            return [];
          },
        },
      }),
    );
    expect(byId(rows, "fonts").status).toBe("ok");
  });

  it("fails a font whose load rejects", async () => {
    stubFetch(ALL_OK);
    const rows = await runReadiness(
      options({
        fontSet: {
          check: () => true,
          load: async () => Promise.reject(new Error("network")),
        },
      }),
    );
    expect(byId(rows, "fonts").text).toContain("1em Michroma");
  });
});

describe("a deck with no file lists of its own", () => {
  it("has no wall row, and the page's images are not read", async () => {
    stubFetch(ALL_OK);
    const rows = await runReadiness(options({ assetRows: [] }));
    expect(rows.map((r) => r.id)).toEqual(rowOrder());
    expect(rows.some((r) => r.id === "wall")).toBe(false);
  });
});
