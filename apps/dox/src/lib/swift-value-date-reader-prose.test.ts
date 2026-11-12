/**
 * The SWIFT Value Date Reader's page makes claims in prose and in a code block. This guard reads
 * the page as text and holds each to a library call, so the prose cannot drift from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatSwiftDate } from "@northguild/gmt/finance/format";
import { parseSwiftDate } from "@northguild/gmt/finance/parse";
import { isValidSwiftDate } from "@northguild/gmt/finance/validate";
import { realFinanceLib } from "~/test/finance-fixture";
import { READ_PRESETS, deriveBands } from "./swift-value-date-reader";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/swift-value-date-reader.mdx"),
  "utf8",
);

describe("the keypoint", () => {
  const bands = deriveBands(realFinanceLib);

  it("states the years the bands give", () => {
    expect(parseSwiftDate("240615").startsWith("2024")).toBe(true);
    expect(parseSwiftDate("990615")).toBe("");
    expect(parseSwiftDate("750101")).toBe("");
    expect(page).toContain("`24` is 2024, and a `99` or a `75` is refused");
  });

  it("names the years the bands read, and refuses 99 and 75 outside them", () => {
    const refused = bands.list.filter((b) => b.firstYear === null);
    for (const yy of ["99", "75"]) {
      expect(refused.some((b) => b.from <= yy && yy <= b.to)).toBe(true);
    }
    expect(page).toContain("only 2001 to 2060");
    expect([bands.first, bands.last]).toEqual([2001, 2060]);
  });
});

describe("the code block", () => {
  const block = /```ts\n([\s\S]*?)```/.exec(page)?.[1] ?? "";
  const calls = [...block.matchAll(/^(\w+)\((.*?)\); \/\/ (.*)$/gm)];
  const fns: Record<string, (...a: never[]) => unknown> = {
    parseSwiftDate,
    formatSwiftDate,
    isValidSwiftDate,
  } as never;

  it("holds six calls", () => {
    expect(calls).toHaveLength(6);
  });

  it.each([0, 1, 2, 3, 4, 5])("call %i returns what the comment says", (i) => {
    const [, fn, args, expected] = calls[i]!;
    const result = (fns[fn!]! as (...a: unknown[]) => unknown)(
      ...(JSON.parse(`[${args}]`) as unknown[]),
    );
    expect(JSON.stringify(result)).toBe(expected);
  });
});

describe("the permalinks", () => {
  it("name presets that exist", () => {
    const ids = [...page.matchAll(/%22preset%22%3A%22([\w-]+)%22/g)].map(
      (m) => m[1],
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(READ_PRESETS.map((p) => p.id)).toContain(id);
    }
  });
});
