/**
 * The TAI64N Log Reader's page makes claims in prose and in a code block. This guard reads the
 * page as text and holds each to a library call, so the prose cannot drift from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nextLeapSecond } from "@northguild/gmt/timescale/calculate";
import { fromTai64n, toTai64n } from "@northguild/gmt/timescale/convert";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/tai64n-log-reader.mdx"),
  "utf8",
);

describe("daemontools on a UTC clock", () => {
  it("reads 27 s before the UTC instant the host meant", () => {
    const label =
      "@" + (2n ** 62n + 10n + 1704067200n).toString(16) + "00000000";
    expect(fromTai64n(label)).toBe("2023-12-31T23:59:33Z");
    expect(page).toContain("reads 27 s early for any time since 2017-01-01");
  });

  it("holds while no leap second is scheduled after 2017-01-01", () => {
    // Fails when IERS schedules a new second: reword "since 2017-01-01" and "37 s" then.
    expect(nextLeapSecond("2017-01-01T00:00:00Z")).toBe("");
    expect(page).toContain("TAI − UTC is 37 s");
  });
});

describe("the code block", () => {
  const block = /```ts\n([\s\S]*?)```/.exec(page)?.[1] ?? "";
  const calls = [...block.matchAll(/^(\w+)\("([^"]*)"\); \/\/ "([^"]*)"$/gm)];
  const fns = { fromTai64n, toTai64n } as Record<string, (s: string) => string>;

  it("holds four calls", () => {
    expect(calls).toHaveLength(4);
  });

  it.each([0, 1, 2, 3])("call %i returns what the comment says", (i) => {
    const [, fn, arg, expected] = calls[i]!;
    expect(fns[fn!]!(arg!)).toBe(expected);
  });
});
