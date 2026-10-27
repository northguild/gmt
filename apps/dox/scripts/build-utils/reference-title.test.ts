import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TITLE_SUFFIX } from "../../src/lib/head-tags";
import { MAX, referenceHeadTitle, type TitleDoc } from "./reference-title";

const doc = (
  over: Partial<TitleDoc> & Pick<TitleDoc, "name" | "description">,
): TitleDoc => ({
  kind: "function",
  namespace: "plain",
  module: "calculate",
  ...over,
});

describe("referenceHeadTitle", () => {
  it.each([
    [
      doc({
        name: "businessDaysBetween",
        namespace: "calendar",
        module: "business",
        description:
          "Count the working days between two local dates, **excluding `start` and including `end`**.",
      }),
      "businessDaysBetween(): count the working days",
    ],
    [
      doc({
        name: "easterSunday",
        namespace: "calendar",
        module: "rules",
        description:
          "Easter Sunday of a year as an ISO date, by the Gregorian computus unless the Julian one is asked for.",
      }),
      "easterSunday(): Easter Sunday of a year as an ISO date",
    ],
    [
      doc({
        name: "isValidDate",
        module: "validate",
        description: "Return true if `value` is a valid ISO PlainDate string.",
      }),
      "isValidDate(): whether value is a valid ISO PlainDate string",
    ],
    [
      doc({
        name: "addZoned",
        namespace: "zoned",
        description:
          "Add a temporal amount to a zoned ISO 8601 datetime string and return a zoned ISO 8601 string.",
      }),
      "addZoned(): add a temporal amount",
    ],
    [
      doc({
        name: "formatDate",
        module: "format",
        description:
          "Return a localized string for a PlainDate ISO input using Intl options.",
      }),
      "formatDate(): a localized string for a PlainDate ISO input",
    ],
  ])("writes %#", (input, expected) => {
    expect(referenceHeadTitle(input)).toBe(expected);
  });

  it("falls back to the name and its place when no cut leaves a title that fits", () => {
    expect(
      referenceHeadTitle(
        doc({
          name: "intervalAbutsZoned",
          namespace: "zoned",
          module: "interval",
          description:
            "Whether two half-open zoned intervals are exactly adjacent",
        }),
      ),
    ).toBe("intervalAbutsZoned() in zoned/interval");
    expect(
      referenceHeadTitle(
        doc({ name: "x", description: "", namespace: "plain", module: "get" }),
      ),
    ).toBe("x() in plain/get");
  });

  it("names a type or a regex constant without brackets", () => {
    expect(
      referenceHeadTitle(
        doc({
          name: "day",
          kind: "regex",
          namespace: "regex",
          module: "date",
          description: "RegExp matching an ISO 8601 day of the month.",
        }),
      ),
    ).toBe("day: RegExp matching an ISO 8601 day of the month");
    expect(
      referenceHeadTitle(
        doc({
          name: "DateUnit",
          kind: "type",
          namespace: "types",
          module: "types",
          description: "A date unit in the singular. More text follows.",
        }),
      ),
    ).toBe("DateUnit: a date unit in the singular");
  });

  it("never cuts inside a bracket or a quote", () => {
    const title = referenceHeadTitle(
      doc({
        name: "parseThing",
        module: "parse",
        description:
          'Read a value in the "year-week" form with the week count to the end of [the range and more words here',
      }),
    );
    expect(title).not.toContain("[");
    expect((title.match(/"/g) ?? []).length % 2).toBe(0);
  });

  it("does not cut at an abbreviation", () => {
    expect(
      referenceHeadTitle(
        doc({
          name: "zoneOf",
          module: "get",
          description: "Read a zone, e.g. Europe/Berlin, from a string.",
        }),
      ),
    ).toBe("zoneOf(): read a zone, e.g. Europe/Berlin, from a string");
  });

  it("leaves a title of a cut clause without a trailing comma", () => {
    const title = referenceHeadTitle(
      doc({
        name: "fromSnowflake",
        namespace: "precision",
        module: "convert",
        description:
          "Read the instant a Snowflake id carries, as an ISO 8601 UTC string, for any epoch.",
      }),
    );
    expect(title).not.toMatch(/[,;:]$/);
  });
});

describe("the live corpus", () => {
  const corpusPath = resolve(
    import.meta.dirname,
    "..",
    "..",
    "src",
    "generated",
    "reference",
    "gmt-corpus.json",
  );
  const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as Array<
    TitleDoc & { inlineOn?: string }
  >;
  const pages = corpus.filter((entry) => entry.inlineOn === undefined);

  it("gives every page a title that fits with the suffix", () => {
    for (const entry of pages) {
      const full = referenceHeadTitle(entry) + TITLE_SUFFIX;
      expect(full.length, full).toBeLessThanOrEqual(MAX);
    }
  });

  it("gives no two pages the same title", () => {
    const seen = new Map<string, string>();
    for (const entry of pages) {
      const title = referenceHeadTitle(entry);
      const other = seen.get(title);
      expect(other, `${entry.name} repeats ${other}: ${title}`).toBeUndefined();
      seen.set(title, entry.name);
    }
  });

  it("starts each title with the page's name", () => {
    for (const entry of pages) {
      expect(referenceHeadTitle(entry).startsWith(entry.name)).toBe(true);
    }
  });

  it("does not cut between an `either` and its `or`", () => {
    const title = referenceHeadTitle({
      name: "getUnixNow",
      kind: "function",
      namespace: "precision",
      module: "current",
      description:
        "Get the current Unix timestamp in either seconds or milliseconds as a string.",
    });
    expect(title).not.toMatch(/either seconds$/);
    expect(title.length + " · GMT".length).toBeLessThanOrEqual(70);
  });
});
