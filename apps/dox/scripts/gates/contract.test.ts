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
