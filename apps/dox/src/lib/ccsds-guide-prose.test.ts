/**
 * The leap-seconds guide makes claims about CCSDS ASCII time codes in prose and in a code block.
 * This guard reads the guide as text and runs every `call // result` line against the library, so
 * the prose cannot drift from it.
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

const guide = readFileSync(
  join(
    __dirname,
    "../content/docs/guides/core-date-operations/leap-seconds-and-tai.mdx",
  ),
  "utf8",
);
const section =
  /## CCSDS ASCII time codes\n([\s\S]*?)\n## /.exec(guide)?.[1] ?? "";

describe("the CCSDS section", () => {
  it("is present and within 25 lines", () => {
    expect(section).not.toBe("");
    expect(section.trim().split("\n").length).toBeLessThanOrEqual(25);
  });

  it("names the standard by number and no law", () => {
    expect(section).toContain("CCSDS 301.0-B-4");
  });
});

describe("the code block", () => {
  const block = /```ts\n([\s\S]*?)```/.exec(section)?.[1] ?? "";
  const calls = [...block.matchAll(/^(\w+)\((.*?)\); \/\/ (.*)$/gm)];
  const fns: Record<string, (...a: never[]) => unknown> = {
    parseCcsdsAsciiA,
    parseCcsdsAsciiB,
    formatCcsdsAsciiA,
    formatCcsdsAsciiB,
  } as never;

  it("imports both subpaths", () => {
    expect(block).toContain('from "@northguild/gmt/timescale/parse"');
    expect(block).toContain('from "@northguild/gmt/timescale/format"');
  });

  it("holds four calls", () => {
    expect(calls).toHaveLength(4);
  });

  it.each([0, 1, 2, 3])("call %i returns what the comment says", (i) => {
    const [, fn, args, expected] = calls[i]!;
    const result = (fns[fn!]! as (...a: unknown[]) => unknown)(
      ...(JSON.parse(`[${args}]`) as unknown[]),
    );
    expect(JSON.stringify(result)).toBe(expected);
  });
});

describe("the prose claims", () => {
  it("reads a second of 60 only where UTC inserted one", () => {
    expect(parseCcsdsAsciiA("2016-12-31T23:59:60Z")).toBe(
      "2016-12-31T23:59:60Z",
    );
    expect(parseCcsdsAsciiA("2017-12-31T23:59:60Z")).toBe("");
  });

  it("returns an empty string for a code coarser than whole seconds", () => {
    expect(parseCcsdsAsciiA("2016-12-31T23:59")).toBe("");
  });

  it("keeps up to nine fraction digits when reading and cuts when writing", () => {
    expect(parseCcsdsAsciiA("2016-12-31T23:59:59.123456789Z")).toBe(
      "2016-12-31T23:59:59.123456789Z",
    );
    expect(formatCcsdsAsciiA("2026-12-31T23:59:59.9999999Z", 3)).toBe(
      "2026-12-31T23:59:59.999Z",
    );
  });

  it("writes a Z whether or not one was read", () => {
    expect(parseCcsdsAsciiB("2016-366T23:59:59")).toBe("2016-12-31T23:59:59Z");
    expect(formatCcsdsAsciiB("2016-12-31T23:59:59Z").endsWith("Z")).toBe(true);
  });
});
