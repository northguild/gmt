/**
 * The GTFS Trip Board's page makes claims in prose and in a code block. This guard reads the
 * page as text and holds each to a library call, so the prose cannot drift from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gtfsToInstant } from "@northguild/gmt/rail/convert";
import { convertUtcToZoned } from "@northguild/gmt/utc/convert";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/gtfs-trip-board.mdx"),
  "utf8",
);

describe("the prose", () => {
  it("never says since midnight", () => {
    expect(page).not.toMatch(/since midnight/i);
  });

  it("names the calls in code font", () => {
    for (const fn of ["gtfsToInstant", "convertUtcToZoned", "diffUtc"]) {
      expect(page).toContain(`\`${fn}\``);
    }
  });

  it("sizes the mistake by the change, not by a fixed hour", () => {
    expect(page).toContain("the size of the change, an hour in most zones");
  });

  it("is tagged rail", () => {
    expect(page).toMatch(/industries:\s*\[rail\]/);
  });
});

describe("the code block", () => {
  const block = /```ts\n([\s\S]*?)```/.exec(page)?.[1] ?? "";
  const calls = [...block.matchAll(/^(\w+)\((.*?)\); \/\/ (.*)$/gm)];
  const fns: Record<string, unknown> = { gtfsToInstant, convertUtcToZoned };

  it("holds three calls", () => {
    expect(calls).toHaveLength(3);
  });

  it("imports each function from its own module", () => {
    expect(block).toContain('from "@northguild/gmt/rail/convert"');
    expect(block).toContain('from "@northguild/gmt/utc/convert"');
  });

  it.each([0, 1, 2])("call %i returns what the comment says", (i) => {
    const [, fn, args, expected] = calls[i]!;
    const result = (fns[fn!] as (...a: unknown[]) => unknown)(
      ...(new Function(`return [${args}]`)() as unknown[]),
    );
    expect(result).toEqual(new Function(`return (${expected})`)() as unknown);
  });
});
