/**
 * The Code B Day Ruler page states dates in prose and in one code block. This guard reads the page
 * as text and holds every one of them to the library, so the prose cannot drift from it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatCcsdsAsciiA } from "@northguild/gmt/timescale/format";
import { parseCcsdsAsciiB } from "@northguild/gmt/timescale/parse";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/code-b-day-ruler.mdx"),
  "utf8",
);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The library's reading of `year-day`, as "D Month". */
function dateOf(year: number, day: string): string {
  const instant = parseCcsdsAsciiB(
    `${String(year).padStart(4, "0")}-${day}T00:00:00Z`,
  );
  if (instant === "") return "";
  const a = formatCcsdsAsciiA(instant, 0);
  return `${Number(a.slice(8, 10))} ${MONTHS[Number(a.slice(5, 7)) - 1]}`;
}

describe("the prose dates", () => {
  it.each([
    [61, 2024, "1 March"],
    [61, 2026, "2 March"],
    [59, 2024, "28 February"],
    [59, 2026, "28 February"],
    [366, 2016, "31 December"],
    [60, 2000, "29 February"],
    [60, 2100, "1 March"],
  ] as const)("day %i of %i is %s", (day, year, words) => {
    expect(dateOf(year, String(day).padStart(3, "0"))).toBe(words);
  });

  it("states those dates in the page", () => {
    expect(page).toContain("Day 061 is 1 March in 2024 and 2 March in 2026");
    expect(page).toContain("`2024-059` and `2026-059` are both 28 February");
    expect(page).toContain("`2016-366` is 31 December 2016");
    expect(page).toContain(
      "day 060 is 29 February in 2000 and 1 March in 2100",
    );
  });

  it("is refused by the library for 2017-366", () => {
    expect(parseCcsdsAsciiB("2017-366T00:00:00Z")).toBe("");
    expect(page).toContain("refuses `2017-366`");
  });
});

describe("the code block", () => {
  const block = /```ts\n([\s\S]*?)```/.exec(page)?.[1] ?? "";
  const calls = [...block.matchAll(/^(.*); \/\/ (.*)$/gm)].filter(
    (m) => !m[1]!.startsWith("import"),
  );

  it("holds three calls", () => expect(calls).toHaveLength(3));

  it.each([0, 1, 2])("call %i returns what the comment says", (i) => {
    const [, call, expected] = calls[i]!;
    const text = /"([^"]*)"/.exec(call!)![1]!;
    const instant = parseCcsdsAsciiB(text);
    const got = call!.startsWith("formatCcsdsAsciiA")
      ? formatCcsdsAsciiA(instant, 0)
      : instant;
    expect(`"${got}"`).toBe(expected);
  });
});
