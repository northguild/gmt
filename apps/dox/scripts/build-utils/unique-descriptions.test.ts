import { describe, expect, it } from "vitest";
import {
  uniqueDescriptions,
  valueKind,
  type DescribedPage,
} from "./unique-descriptions";

const page = (
  id: string,
  description: string,
  namespace: string,
  kind?: string,
): DescribedPage => ({ id, description, namespace, kind });

describe("uniqueDescriptions", () => {
  it("qualifies each page of a group with the value kind it works on", () => {
    const changed = uniqueDescriptions([
      page(
        "utc/c/isBeforeUtc",
        "Return whether a is before b.",
        "utc",
        "UTC date-time strings",
      ),
      page(
        "unix/c/isBeforeUnix",
        "Return whether a is before b.",
        "unix",
        "Unix epoch values",
      ),
      page("zoned/c/other", "Something else.", "zoned"),
    ]);
    expect([...changed]).toEqual([
      [
        "utc/c/isBeforeUtc",
        "Return whether a is before b, for UTC date-time strings.",
      ],
      [
        "unix/c/isBeforeUnix",
        "Return whether a is before b, for Unix epoch values.",
      ],
    ]);
  });

  it("falls back to the namespace when a page states no kind", () => {
    const changed = uniqueDescriptions([
      page("plain/a/f", "Return the end of the week.", "plain"),
      page(
        "zoned/a/g",
        "Return the end of the week.",
        "zoned",
        "zoned date-time strings",
      ),
    ]);
    expect(changed.get("plain/a/f")).toBe(
      "Return the end of the week, in the plain namespace.",
    );
    expect(changed.get("zoned/a/g")).toBe(
      "Return the end of the week, in the zoned namespace.",
    );
  });

  it("leaves a unique description out of the result", () => {
    const changed = uniqueDescriptions([
      page("a/b/c", "Only one.", "a", "plain date strings"),
      page("a/b/d", "Another.", "a", "plain date strings"),
    ]);
    expect(changed.size).toBe(0);
  });

  it("adds the full stop when a description has none", () => {
    const changed = uniqueDescriptions([
      page("a/b/c", "Same line", "a", "plain date strings"),
      page("a/b/d", "Same line", "a", "plain time strings"),
    ]);
    expect(changed.get("a/b/c")).toBe("Same line, for plain date strings.");
  });

  it("throws for a group that neither kind nor namespace splits", () => {
    expect(() =>
      uniqueDescriptions([
        page("plain/a/f", "Same.", "plain", "plain date strings"),
        page("plain/b/g", "Same.", "plain", "plain date strings"),
      ]),
    ).toThrow(/plain\/a\/f, plain\/b\/g/);
  });

  it("throws when a qualified line equals another page's description", () => {
    expect(() =>
      uniqueDescriptions([
        page("a/b/c", "Same.", "a", "plain date strings"),
        page("a/b/d", "Same.", "a", "plain time strings"),
        page("a/b/e", "Same, for plain date strings.", "a"),
      ]),
    ).toThrow(/another page/);
  });

  it("does not change its input", () => {
    const input = [
      page("a/b/c", "Same.", "a", "plain date strings"),
      page("a/b/d", "Same.", "a", "plain time strings"),
    ];
    const copy = structuredClone(input);
    uniqueDescriptions(input);
    expect(input).toEqual(copy);
  });
});

describe("valueKind", () => {
  it.each([
    ["intervalContainsDate", "plain date strings"],
    ["intervalContainsDateTime", "plain date-time strings"],
    ["intervalContainsTime", "plain time strings"],
    ["isBeforeUtc", "UTC date-time strings"],
    ["isBeforeUnix", "Unix epoch values"],
    ["isBeforeZoned", "zoned date-time strings"],
    ["getLocaleZonedEndOfWeek", "zoned date-time strings"],
    ["getLocaleEndOfWeek", undefined],
  ])("%s works on %s", (name, kind) => {
    expect(valueKind(name)).toBe(kind);
  });
});
