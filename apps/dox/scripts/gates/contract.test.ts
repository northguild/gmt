import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { shardOf } from "./contract.mjs";

const PAGES = Array.from({ length: 23 }, (_, i) => `/page-${23 - i}/`);

describe("shardOf", () => {
  it("covers the sorted list exactly once across four shards", () => {
    const shards = [1, 2, 3, 4].map((i) => shardOf(PAGES, { i, n: 4 }));
    expect(shards.flat().sort()).toEqual([...PAGES].sort());
    expect(new Set(shards.flat()).size).toBe(PAGES.length);
  });

  it("returns the whole sorted list for 1/1 and for no shard", () => {
    expect(shardOf(PAGES, { i: 1, n: 1 })).toEqual([...PAGES].sort());
    expect(shardOf(PAGES, null)).toEqual([...PAGES].sort());
  });

  it("deals the sorted list round-robin, so a shard's order is stable", () => {
    const sorted = [...PAGES].sort();
    expect(shardOf(PAGES, { i: 2, n: 4 })).toEqual(
      sorted.filter((_, idx) => idx % 4 === 1),
    );
    expect(shardOf([...PAGES].reverse(), { i: 2, n: 4 })).toEqual(
      shardOf(PAGES, { i: 2, n: 4 }),
    );
  });

  it("does not change the list it is given", () => {
    const copy = [...PAGES];
    shardOf(PAGES, { i: 3, n: 4 });
    expect(PAGES).toEqual(copy);
  });
});

describe("shardOf with costs", () => {
  const COSTS: Record<string, number> = {
    "/a/": 16,
    "/b/": 12,
    "/c/": 10,
    "/d/": 9,
    "/e/": 5,
    "/f/": 4,
    "/g/": 4,
    "/h/": 1,
  };
  const pages = Object.keys(COSTS).reverse();
  const shards = (n: number) =>
    Array.from({ length: n }, (_, i) => shardOf(pages, { i: i + 1, n }, COSTS));
  const minutes = (list: string[]) =>
    list.reduce((sum, p) => sum + COSTS[p]!, 0);

  it("covers the list exactly once, each shard sorted", () => {
    const all = shards(3);
    expect(all.flat().sort()).toEqual([...pages].sort());
    expect(new Set(all.flat()).size).toBe(pages.length);
    for (const s of all) expect(s).toEqual([...s].sort());
  });

  it("deals the costliest first, each to the lightest shard", () => {
    expect(shards(3)).toEqual([
      ["/a/", "/f/"],
      ["/b/", "/e/", "/g/"],
      ["/c/", "/d/", "/h/"],
    ]);
    expect(shards(3).map(minutes)).toEqual([20, 21, 20]);
  });

  it("splits the cost evenly where round-robin by name does not", () => {
    const roundRobin = [1, 2, 3].map((i) => shardOf(pages, { i, n: 3 }));
    const spread = (all: string[][]) =>
      Math.max(...all.map(minutes)) - Math.min(...all.map(minutes));
    expect(spread(shards(3))).toBeLessThan(spread(roundRobin));
  });

  it("returns the whole sorted list for no shard, costs or not", () => {
    expect(shardOf(pages, null, COSTS)).toEqual([...pages].sort());
  });

  it("refuses a page with no positive cost, naming it", () => {
    expect(() => shardOf([...pages, "/new/"], { i: 1, n: 2 }, COSTS)).toThrow(
      "no measured cost for /new/",
    );
    expect(() =>
      shardOf(["/a/", "/z/"], { i: 1, n: 2 }, { "/a/": 1, "/z/": 0 }),
    ).toThrow("/z/");
  });
});

// The runner reads a page list through a pipe, and a pipe on macOS takes stdout asynchronously, so
// a list printed just before `process.exit` was cut at 64 KiB.
describe("applyPageContract through a pipe", () => {
  const CONTRACT = pathToFileURL(
    path.join(import.meta.dirname, "contract.mjs"),
  ).href;
  const PAGES_LONG = Array.from({ length: 20_000 }, (_, i) => `/page-${i}/`);
  // The child builds the same list: Linux caps one argument at 128 KiB, so the list cannot be
  // passed in the script.
  const run = (flag: string) =>
    spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const { applyPageContract } = await import(${JSON.stringify(CONTRACT)});
        const pages = Array.from({ length: 20_000 }, (_, i) => \`/page-\${i}/\`);
        const costs = Object.fromEntries(pages.map((p) => [p, 1]));
        await applyPageContract({ gate: "long", pages, costs, argv: [${JSON.stringify(flag)}] });
        console.log("ran on");`,
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );

  it("prints a list far over 64 KiB whole, then exits before the script runs on", () => {
    const r = run("--list-pages");
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(4 * 65_536);
    expect(JSON.parse(r.stdout)).toEqual(PAGES_LONG);
  });

  it("prints the costs whole too", () => {
    const r = run("--list-page-costs");
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(0);
    expect(Object.keys(JSON.parse(r.stdout))).toEqual(PAGES_LONG);
  });
});
