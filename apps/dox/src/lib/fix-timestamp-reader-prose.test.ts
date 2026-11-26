/**
 * The FIX Timestamp Reader's page makes claims in prose and in a code block. This guard reads
 * the page as text and holds each to a library call, so the prose cannot drift from the library.
 * The leap-second count is read here through `timescale`, so the tool itself calls nothing
 * outside `finance/*` and Finance's `drawsOn` stays empty.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatFixUtcTimestamp } from "@northguild/gmt/finance/format";
import { parseFixUtcTimestamp } from "@northguild/gmt/finance/parse";
import { isValidFixUtcTimestamp } from "@northguild/gmt/finance/validate";
import {
  leapSecondsBetween,
  nextLeapSecond,
} from "@northguild/gmt/timescale/calculate";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/fix-timestamp-reader.mdx"),
  "utf8",
);

describe("the leap-second sentence", () => {
  it("states the count UTC has inserted since 1972", () => {
    expect(
      leapSecondsBetween("1972-01-01T00:00:00Z", "2026-11-10T00:00:00Z"),
    ).toBe(27);
    expect(page).toContain("UTC has inserted 27 since 1972");
  });

  it("holds while no leap second is scheduled after 2017-01-01", () => {
    // Fails when IERS schedules a new second: reword "none has been scheduled since" then.
    expect(nextLeapSecond("2017-01-01T00:00:00Z")).toBe("");
    expect(page).toContain("none has been scheduled since");
  });

  it("calls 20161231-23:59:60.500 inserted and 20171231-23:59:60 refused", () => {
    expect(parseFixUtcTimestamp("20161231-23:59:60.500")?.leapSecond).toBe(
      true,
    );
    expect(parseFixUtcTimestamp("20171231-23:59:60")).toBeNull();
  });
});

describe("the code block", () => {
  const block = /```ts\n([\s\S]*?)```/.exec(page)?.[1] ?? "";
  const calls = [
    ...block.matchAll(/^(\w+)\((.*?)\)(\?\.precision)?; \/\/ (.*)$/gm),
  ];
  const fns: Record<string, (...a: never[]) => unknown> = {
    isValidFixUtcTimestamp,
    parseFixUtcTimestamp,
    formatFixUtcTimestamp,
  } as never;

  it("holds five calls", () => {
    expect(calls).toHaveLength(5);
  });

  it.each([0, 1, 2, 3, 4])("call %i returns what the comment says", (i) => {
    const [, fn, args, member, expected] = calls[i]!;
    const result = (fns[fn!]! as (...a: unknown[]) => unknown)(
      ...(JSON.parse(`[${args}]`) as unknown[]),
    );
    const shown =
      member === undefined
        ? result
        : (result as { precision: string } | null)?.precision;
    expect(JSON.stringify(shown)).toBe(expected);
  });
});
