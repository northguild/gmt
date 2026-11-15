/**
 * The GTFS Service Day Clock's page makes claims in prose and in a code block. This guard reads
 * the page as text and holds each to a library call, so the prose cannot drift from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveLocal } from "@northguild/gmt/instant/convert";
import { gtfsToInstant } from "@northguild/gmt/rail/convert";
import { addUtc } from "@northguild/gmt/utc/calculate";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/gtfs-service-day-clock.mdx"),
  "utf8",
);

describe("the prose", () => {
  it("never says since midnight", () => {
    expect(page).not.toMatch(/since midnight/i);
  });

  it("names the three calls in code font", () => {
    for (const fn of ["gtfsToInstant", "resolveLocal", "addUtc"]) {
      expect(page).toContain(`\`${fn}\``);
    }
  });

  it("is tagged rail", () => {
    expect(page).toMatch(/industries:\s*\[rail\]/);
  });
});

describe("the code block", () => {
  const block = /```ts\n([\s\S]*?)```/.exec(page)?.[1] ?? "";
  const calls = [...block.matchAll(/^(\w+)\((.*?)\); \/\/ (.*)$/gm)];
  const fns: Record<string, (...a: never[]) => unknown> = {
    gtfsToInstant,
    resolveLocal,
    addUtc,
  } as never;

  it("holds seven calls", () => {
    expect(calls).toHaveLength(7);
  });

  it("imports each function from its own module", () => {
    expect(block).toContain('from "@northguild/gmt/rail/convert"');
    expect(block).toContain('from "@northguild/gmt/instant/convert"');
    expect(block).toContain('from "@northguild/gmt/utc/calculate"');
  });

  it.each([0, 1, 2, 3, 4, 5, 6])(
    "call %i returns what the comment says",
    (i) => {
      const [, fn, args, expected] = calls[i]!;
      // The comment is a JavaScript literal; compare as parsed values.
      const result = (fns[fn!]! as (...a: unknown[]) => unknown)(
        ...(new Function(`return [${args}]`)() as unknown[]),
      );
      const want = new Function(`return (${expected})`)() as unknown;
      expect(result).toEqual(want);
    },
  );
});
