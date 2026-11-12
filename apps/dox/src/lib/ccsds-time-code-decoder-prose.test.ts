/**
 * The CCSDS Time Code Decoder's page makes claims in prose and in a code block. This guard reads
 * the page as text and holds each to a library call, so the prose cannot drift from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatCcsdsAsciiA,
  formatCcsdsAsciiB,
} from "@northguild/gmt/timescale/format";
import {
  parseCcsdsAsciiA,
  parseCcsdsAsciiB,
} from "@northguild/gmt/timescale/parse";
import {
  leapSecondsBetween,
  nextLeapSecond,
} from "@northguild/gmt/timescale/calculate";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/ccsds-time-code-decoder.mdx"),
  "utf8",
);

describe("the leap-second sentences", () => {
  it("states the count UTC has inserted since 1972", () => {
    expect(
      leapSecondsBetween("1972-01-01T00:00:00Z", "2026-11-10T00:00:00Z"),
    ).toBe(27);
    expect(page).toContain("UTC has inserted 27 since 1972");
  });

  it("holds while no leap second is scheduled after 2017-01-01", () => {
    // Fails when IERS schedules a new second: reword the page then.
    expect(nextLeapSecond("2017-01-01T00:00:00Z")).toBe("");
  });
});

describe("the day-of-year claims", () => {
  it("reads 2024-061 as 1 March and refuses 2023-366", () => {
    expect(parseCcsdsAsciiB("2024-061T00:00:00Z")).toBe("2024-03-01T00:00:00Z");
    expect(parseCcsdsAsciiB("2023-366T00:00:00Z")).toBe("");
    expect(page).toContain("2024-061");
    expect(page).toContain("2023-366");
  });

  it("refuses lower-case t and z", () => {
    expect(parseCcsdsAsciiA("2024-06-15t10:30:00z")).toBe("");
    expect(parseCcsdsAsciiB("2024-167t10:30:00z")).toBe("");
  });
});

describe("the code block", () => {
  const block = /```ts\n([\s\S]*?)```/.exec(page)?.[1] ?? "";
  const calls = [...block.matchAll(/^(\w+)\((.*?)\); \/\/ (.*)$/gm)];
  const fns: Record<string, (...a: never[]) => unknown> = {
    parseCcsdsAsciiA,
    parseCcsdsAsciiB,
    formatCcsdsAsciiA,
    formatCcsdsAsciiB,
  } as never;

  it("holds five calls", () => {
    expect(calls).toHaveLength(5);
  });

  it.each([0, 1, 2, 3, 4])("call %i returns what the comment says", (i) => {
    const [, fn, args, expected] = calls[i]!;
    const result = (fns[fn!]! as (...a: unknown[]) => unknown)(
      ...(JSON.parse(`[${args}]`) as unknown[]),
    );
    expect(JSON.stringify(result)).toBe(expected);
  });
});
