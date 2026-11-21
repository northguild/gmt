import {
  filingKey,
  filings,
  type UpstreamFiling,
} from "~/data/upstream-filings";
import { filingFacts, findFiling } from "./filing";

describe("findFiling", () => {
  it("finds a filing of each tracker kind by its key", () => {
    for (const key of ["nodejs/node#67076", "ICU-23609", "CLDR-19873"]) {
      expect(filingKey(findFiling(key))).toBe(key);
    }
  });

  it("throws for a key that is not in the data", () => {
    expect(() => findFiling("nodejs/node#1")).toThrow(/not in src\/data/);
  });

  it("throws when the list no longer holds the filing", () => {
    const without = filings.filter((f) => filingKey(f) !== "ICU-23609");
    expect(() => findFiling("ICU-23609", without)).toThrow();
  });
});

describe("filingFacts", () => {
  it("reads the reference, the tracker heading, the state and the link", () => {
    const facts = filingFacts("ICU-23609");
    expect(facts).toMatchObject({
      ref: "ICU-23609",
      group: "Unicode Jira (ICU and CLDR)",
    });
    expect(facts.url).toMatch(/^https:\/\//);
  });

  describe("names the state", () => {
    const pr = filings.find((f) => f.tracker === "github")!;
    const jira = filings.find((f) => f.tracker === "jira")!;
    const label = (f: UpstreamFiling): string =>
      filingFacts(filingKey(f), [f]).stateLabel;

    it.each([
      ["Open", "open", null],
      ["Closed", "closed", null],
      ["Merged", "closed", "2026-01-02T00:00:00Z"],
    ] as const)(
      "%s for a GitHub filing that is %s, merged at %s",
      (want, state, mergedAt) => {
        expect(label({ ...pr, state, mergedAt } as UpstreamFiling)).toBe(want);
      },
    );

    it.each([
      ["Open", "open"],
      ["Closed", "closed"],
    ] as const)("%s for a Jira filing that is %s", (want, state) => {
      expect(label({ ...jira, state })).toBe(want);
    });
  });
});
